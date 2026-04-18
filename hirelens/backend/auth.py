"""JWT authentication for HireLens API."""

import os
from datetime import datetime, timedelta, timezone

import hashlib
import hmac
import json
import base64

from fastapi import HTTPException, Request

_ENVIRONMENT = os.getenv("APP_ENV", "development").lower()
_JWT_SECRET = os.getenv("JWT_SECRET_KEY")

if _JWT_SECRET:
    SECRET_KEY = _JWT_SECRET
elif _ENVIRONMENT == "development":
    SECRET_KEY = "hirelens-dev-secret-change-in-production"
else:
    raise RuntimeError("JWT_SECRET_KEY must be set outside development.")

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # 24 hours


def hash_password(password: str) -> str:
    """Hash a password with SHA-256 + salt."""
    salt = os.urandom(16)
    pwd_hash = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, 100_000)
    return (salt + pwd_hash).hex()


def verify_password(password: str, stored_hash: str) -> bool:
    """Verify a password against its stored hash."""
    data = bytes.fromhex(stored_hash)
    salt = data[:16]
    stored_pwd_hash = data[16:]
    pwd_hash = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, 100_000)
    return hmac.compare_digest(pwd_hash, stored_pwd_hash)


def _b64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def _b64url_decode(s: str) -> bytes:
    padding = 4 - len(s) % 4
    return base64.urlsafe_b64decode(s + "=" * padding)


def create_access_token(user_id: int, username: str) -> str:
    """Create a JWT access token."""
    header = _b64url_encode(json.dumps({"alg": ALGORITHM, "typ": "JWT"}).encode())
    exp = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    payload_data = {
        "sub": str(user_id),
        "username": username,
        "exp": int(exp.timestamp()),
    }
    payload = _b64url_encode(json.dumps(payload_data).encode())
    signature_input = f"{header}.{payload}".encode()
    sig = hmac.new(SECRET_KEY.encode(), signature_input, hashlib.sha256).digest()
    signature = _b64url_encode(sig)
    return f"{header}.{payload}.{signature}"


def decode_token(token: str) -> dict:
    """Decode and verify a JWT token."""
    try:
        parts = token.split(".")
        if len(parts) != 3:
            raise ValueError("Invalid token format")

        header_b64, payload_b64, signature_b64 = parts

        # Verify signature
        signature_input = f"{header_b64}.{payload_b64}".encode()
        expected_sig = hmac.new(SECRET_KEY.encode(), signature_input, hashlib.sha256).digest()
        actual_sig = _b64url_decode(signature_b64)
        if not hmac.compare_digest(expected_sig, actual_sig):
            raise ValueError("Invalid signature")

        # Decode payload
        payload = json.loads(_b64url_decode(payload_b64))

        # Check expiration
        if datetime.now(timezone.utc).timestamp() > payload.get("exp", 0):
            raise ValueError("Token expired")

        return payload
    except (ValueError, json.JSONDecodeError, KeyError) as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {e}")


def get_current_user_optional(request: Request) -> dict | None:
    """Extract user from Authorization header, return None if not present."""
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        return None
    token = auth_header.split(" ", 1)[1]
    try:
        return decode_token(token)
    except HTTPException:
        return None


def get_current_user_required(request: Request) -> dict:
    """Extract user from Authorization header, raise 401 if missing."""
    user = get_current_user_optional(request)
    if user is None:
        raise HTTPException(status_code=401, detail="Authentication required")
    return user
