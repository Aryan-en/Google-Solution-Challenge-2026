"""HireLens - FastAPI backend for bias detection in hiring systems."""

import io
import json
import os
import hashlib
from datetime import datetime, timezone
from contextlib import asynccontextmanager
from typing import Annotated
from uuid import uuid4

import pandas as pd
from fastapi import FastAPI, File, Form, UploadFile, HTTPException, Request, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from bias import compute_bias, get_column_info, validate_csv, CSVValidationError
from gemini import get_bias_explanation
from database import (
    init_db,
    save_analysis,
    update_analysis_explanation,
    get_analysis,
    get_history,
    get_latest_analysis_id_for_user,
    create_user,
    get_user_by_username,
)
from auth import hash_password, verify_password, create_access_token, get_current_user_optional, get_current_user_required
from pdf_report import generate_pdf_report

# ── Rate limiter ─────────────────────────────────────────────────────────
limiter = Limiter(key_func=get_remote_address)

# ── File size limit (10 MB) ──────────────────────────────────────────────
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB
UPLOAD_TTL_SECONDS = 60 * 30  # 30 minutes


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(
    title="HireLens",
    description="AI-powered bias detection and mitigation for hiring systems",
    version="2.0.0",
    lifespan=lifespan,
)

app.state.limiter = limiter


@app.exception_handler(RateLimitExceeded)
async def rate_limit_handler(request: Request, exc: RateLimitExceeded):
    return Response(
        content=json.dumps({"detail": "Rate limit exceeded. Please try again later."}),
        status_code=429,
        media_type="application/json",
    )


app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        origin.strip()
        for origin in os.getenv(
            "ALLOWED_ORIGINS",
            "http://localhost:3000,http://127.0.0.1:3000",
        ).split(",")
        if origin.strip()
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory upload store keyed by upload_id to prevent cross-user state collisions.
upload_sessions: dict[str, dict] = {}
latest_upload_by_actor: dict[str, str] = {}
latest_analysis_by_actor: dict[str, int] = {}
anon_analysis_actor: dict[int, str] = {}


def _get_actor_key(request: Request) -> str:
    """Stable actor key based on authenticated user or anonymous request fingerprint."""
    user = get_current_user_optional(request)
    if user:
        return f"user:{user['sub']}"

    ip = get_remote_address(request)
    user_agent = request.headers.get("user-agent", "")
    raw = f"{ip}|{user_agent}".encode("utf-8")
    fingerprint = hashlib.sha256(raw).hexdigest()
    return f"anon:{fingerprint}"


def _cleanup_upload_sessions() -> None:
    """Prune expired uploads from in-memory store."""
    now = datetime.now(timezone.utc).timestamp()
    expired_ids = [
        upload_id
        for upload_id, data in upload_sessions.items()
        if now - data["created_at_ts"] > UPLOAD_TTL_SECONDS
    ]

    for upload_id in expired_ids:
        del upload_sessions[upload_id]

    # Remove stale actor pointers.
    stale_actors = [
        actor for actor, upload_id in latest_upload_by_actor.items() if upload_id not in upload_sessions
    ]
    for actor in stale_actors:
        del latest_upload_by_actor[actor]


def _resolve_analysis_for_request(request: Request, analysis_id: int | None) -> dict:
    """Resolve analysis row and enforce access control for user and anonymous actors."""
    actor_key = _get_actor_key(request)
    user = get_current_user_optional(request)

    resolved_id = analysis_id
    if resolved_id is None:
        if user:
            latest_id = get_latest_analysis_id_for_user(int(user["sub"]))
            if latest_id is None:
                raise HTTPException(status_code=400, detail="No prior analysis found.")
            resolved_id = latest_id
        else:
            latest_id = latest_analysis_by_actor.get(actor_key)
            if latest_id is None:
                raise HTTPException(status_code=400, detail="No prior analysis found.")
            resolved_id = latest_id

    analysis = get_analysis(resolved_id)
    if not analysis:
        raise HTTPException(status_code=404, detail="Analysis not found.")

    owner_user_id = analysis.get("user_id")
    if owner_user_id is not None:
        if not user or int(user["sub"]) != int(owner_user_id):
            raise HTTPException(status_code=403, detail="Not authorized to access this analysis.")
    else:
        expected_actor = anon_analysis_actor.get(int(analysis["id"]))
        if expected_actor != actor_key:
            raise HTTPException(status_code=403, detail="Not authorized to access this analysis.")

    return analysis


# ── Health ───────────────────────────────────────────────────────────────

@app.get("/")
def health_check():
    return {"status": "ok", "service": "HireLens API", "version": "2.0.0"}


# ── Auth ─────────────────────────────────────────────────────────────────

@app.post("/api/auth/register")
@limiter.limit("5/minute")
async def register(request: Request, username: str = Form(...), password: str = Form(...)):
    """Register a new user account."""
    if len(username) < 3:
        raise HTTPException(status_code=400, detail="Username must be at least 3 characters.")
    if len(password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters.")
    if get_user_by_username(username):
        raise HTTPException(status_code=409, detail="Username already taken.")

    pwd_hash = hash_password(password)
    user_id = create_user(username, pwd_hash)
    token = create_access_token(user_id, username)

    return {"token": token, "user_id": user_id, "username": username}


@app.post("/api/auth/login")
@limiter.limit("10/minute")
async def login(request: Request, username: str = Form(...), password: str = Form(...)):
    """Log in and receive a JWT token."""
    user = get_user_by_username(username)
    if not user or not verify_password(password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid username or password.")

    token = create_access_token(user["id"], user["username"])
    return {"token": token, "user_id": user["id"], "username": user["username"]}


@app.get("/api/auth/me")
async def get_me(request: Request):
    """Get current user info from token."""
    user = get_current_user_required(request)
    return {"user_id": int(user["sub"]), "username": user["username"]}


# ── Upload ───────────────────────────────────────────────────────────────

@app.post("/api/upload")
@limiter.limit("20/minute")
async def upload_csv(request: Request, file: UploadFile = File(...)):
    """Upload a CSV file and return column information for configuration."""
    if not file.filename or not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only CSV files are accepted.")

    contents = await file.read()

    # File size check
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=413,
            detail=f"File too large. Maximum size is {MAX_FILE_SIZE // (1024 * 1024)} MB.",
        )

    try:
        df = pd.read_csv(io.BytesIO(contents))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to parse CSV: {str(e)}")

    if df.empty:
        raise HTTPException(status_code=400, detail="CSV file is empty.")

    info = get_column_info(df)
    _cleanup_upload_sessions()
    actor_key = _get_actor_key(request)
    upload_id = str(uuid4())
    upload_sessions[upload_id] = {
        "actor_key": actor_key,
        "csv_data": contents.decode("utf-8"),
        "filename": file.filename,
        "created_at_ts": datetime.now(timezone.utc).timestamp(),
    }
    latest_upload_by_actor[actor_key] = upload_id
    info["upload_id"] = upload_id

    return info


# ── Analyze ──────────────────────────────────────────────────────────────

@app.post("/api/analyze")
@limiter.limit("30/minute")
async def analyze_bias(
    request: Request,
    target_column: str = Form(...),
    protected_column: str = Form(...),
    threshold: float = Form(0.5),
    upload_id: str | None = Form(None),
):
    """Run bias analysis on the previously uploaded dataset."""
    _cleanup_upload_sessions()
    actor_key = _get_actor_key(request)
    resolved_upload_id = upload_id or latest_upload_by_actor.get(actor_key)
    if not resolved_upload_id or resolved_upload_id not in upload_sessions:
        raise HTTPException(status_code=400, detail="No dataset uploaded. Please upload a CSV first.")

    upload_data = upload_sessions[resolved_upload_id]
    if upload_data["actor_key"] != actor_key:
        raise HTTPException(status_code=403, detail="Not authorized to use this uploaded file.")

    df = pd.read_csv(io.StringIO(upload_data["csv_data"]))

    # CSV validation
    try:
        warnings = validate_csv(df, target_column, protected_column)
    except CSVValidationError as e:
        raise HTTPException(status_code=400, detail=str(e))

    results = compute_bias(df, target_column, protected_column, threshold)
    results["warnings"] = warnings

    # Persist to DB
    user = get_current_user_optional(request)
    user_id = int(user["sub"]) if user else None
    analysis_id = save_analysis(
        user_id=user_id,
        filename=upload_data.get("filename", "unknown"),
        source_csv=upload_data.get("csv_data"),
        target_column=target_column,
        protected_column=protected_column,
        threshold=threshold,
        bias_results=results,
    )
    results["analysis_id"] = analysis_id
    latest_analysis_by_actor[actor_key] = analysis_id
    if user_id is None:
        anon_analysis_actor[analysis_id] = actor_key

    return results


# ── Multi-attribute analysis ─────────────────────────────────────────────

@app.post("/api/analyze/multi")
@limiter.limit("15/minute")
async def analyze_bias_multi(
    request: Request,
    target_column: str = Form(...),
    protected_columns: str = Form(...),
    threshold: float = Form(0.5),
    upload_id: str | None = Form(None),
):
    """Run bias analysis across multiple protected attributes at once.

    protected_columns should be a comma-separated list, e.g. 'gender,race,age'.
    """
    _cleanup_upload_sessions()
    actor_key = _get_actor_key(request)
    resolved_upload_id = upload_id or latest_upload_by_actor.get(actor_key)
    if not resolved_upload_id or resolved_upload_id not in upload_sessions:
        raise HTTPException(status_code=400, detail="No dataset uploaded. Please upload a CSV first.")

    upload_data = upload_sessions[resolved_upload_id]
    if upload_data["actor_key"] != actor_key:
        raise HTTPException(status_code=403, detail="Not authorized to use this uploaded file.")

    df = pd.read_csv(io.StringIO(upload_data["csv_data"]))
    columns = [c.strip() for c in protected_columns.split(",") if c.strip()]

    if not columns:
        raise HTTPException(status_code=400, detail="Provide at least one protected column.")

    all_results = {}
    for col in columns:
        try:
            warnings = validate_csv(df, target_column, col)
        except CSVValidationError as e:
            all_results[col] = {"error": str(e)}
            continue

        result = compute_bias(df, target_column, col, threshold)
        result["warnings"] = warnings
        all_results[col] = result

    return {"target_column": target_column, "results_by_attribute": all_results}


# ── Explain ──────────────────────────────────────────────────────────────

@app.post("/api/explain")
@limiter.limit("10/minute")
async def explain_bias(request: Request, analysis_id: int | None = Form(None)):
    """Get AI-generated explanation of the bias analysis results."""
    analysis = _resolve_analysis_for_request(request, analysis_id)
    bias_results = analysis["bias_results"]

    explanation = await get_bias_explanation(bias_results)

    # Update DB record if exists
    update_analysis_explanation(int(analysis["id"]), explanation)

    return explanation


# ── Simulate ─────────────────────────────────────────────────────────────

@app.post("/api/simulate")
@limiter.limit("30/minute")
async def simulate_threshold(
    request: Request,
    threshold: float = Form(...),
    analysis_id: int | None = Form(None),
):
    """Recalculate bias with a different hiring threshold."""
    analysis = _resolve_analysis_for_request(request, analysis_id)

    source_csv = analysis.get("source_csv")
    if not source_csv:
        raise HTTPException(status_code=400, detail="Original dataset is not available for simulation.")

    prev = analysis["bias_results"]
    df = pd.read_csv(io.StringIO(source_csv))

    results = compute_bias(df, prev["target_column"], prev["protected_column"], threshold)
    results["analysis_id"] = int(analysis["id"])
    return results


# ── Reports ──────────────────────────────────────────────────────────────

@app.get("/api/report")
async def generate_report(request: Request, analysis_id: int | None = Query(None)):
    """Generate a downloadable JSON report of the full analysis."""
    analysis = _resolve_analysis_for_request(request, analysis_id)

    report = {
        "report_title": "HireLens - Bias Analysis Report",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "dataset": analysis.get("filename", "unknown"),
        "bias_analysis": analysis.get("bias_results"),
        "ai_explanation": analysis.get("explanation"),
    }

    return report


@app.get("/api/report/pdf")
async def generate_pdf(request: Request, analysis_id: int | None = Query(None)):
    """Generate a downloadable PDF report."""
    analysis = _resolve_analysis_for_request(request, analysis_id)

    pdf_bytes = generate_pdf_report(
        bias_results=analysis["bias_results"],
        explanation=analysis.get("explanation"),
        filename=analysis.get("filename", "unknown"),
    )

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": "attachment; filename=hirelens-bias-report.pdf"},
    )


# ── History ──────────────────────────────────────────────────────────────

@app.get("/api/history")
async def get_analysis_history(
    request: Request,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
):
    """Get analysis history for the authenticated user."""
    user = get_current_user_required(request)
    user_id = int(user["sub"])
    history = get_history(user_id=user_id, limit=limit)

    return {
        "count": len(history),
        "analyses": [
            {
                "id": h["id"],
                "filename": h["filename"],
                "target_column": h["target_column"],
                "protected_column": h["protected_column"],
                "disparate_impact": h["bias_results"].get("disparate_impact"),
                "bias_detected": h["bias_results"].get("bias_detected"),
                "created_at": h["created_at"],
            }
            for h in history
        ],
    }


@app.get("/api/history/{analysis_id}")
async def get_analysis_detail(request: Request, analysis_id: int):
    """Get full details of a specific past analysis for the authenticated user."""
    user = get_current_user_required(request)
    analysis = get_analysis(analysis_id)
    if not analysis:
        raise HTTPException(status_code=404, detail="Analysis not found.")

    if int(analysis.get("user_id") or -1) != int(user["sub"]):
        raise HTTPException(status_code=403, detail="Not authorized to access this analysis.")

    return analysis


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
