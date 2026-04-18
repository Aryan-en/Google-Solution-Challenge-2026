"""Shared pytest fixtures."""

import os
import sys
import tempfile

import pytest
import pandas as pd
from fastapi.testclient import TestClient

# Add backend directory to path so imports work
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

# Use a temp database for tests
os.environ["DATABASE_PATH"] = os.path.join(tempfile.gettempdir(), "hirelens_test.db")
os.environ["JWT_SECRET_KEY"] = "test-secret-key"


@pytest.fixture(autouse=True)
def clean_db():
    """Remove test DB before each test."""
    db_path = os.environ["DATABASE_PATH"]
    if os.path.exists(db_path):
        os.remove(db_path)
    from database import init_db
    init_db()

    # Clear process-level in-memory stores used by the API between tests.
    try:
        import main
        main.upload_sessions.clear()
        main.latest_upload_by_actor.clear()
        main.latest_analysis_by_actor.clear()
        main.anon_analysis_actor.clear()
    except Exception:
        pass

    yield
    if os.path.exists(db_path):
        os.remove(db_path)


@pytest.fixture
def client():
    """Create a FastAPI test client."""
    from main import app
    app.state.limiter.enabled = False
    return TestClient(app)


@pytest.fixture
def sample_df():
    """Create a sample DataFrame for testing."""
    return pd.DataFrame({
        "candidate_id": range(1, 21),
        "gender": ["male"] * 10 + ["female"] * 10,
        "hired": [1, 1, 1, 1, 1, 1, 1, 1, 0, 0] + [1, 1, 1, 0, 0, 0, 0, 0, 0, 0],
        "score": [80, 75, 70, 65, 60, 55, 50, 45, 40, 35] + [85, 78, 72, 68, 62, 58, 52, 48, 42, 38],
    })


@pytest.fixture
def sample_csv_bytes(sample_df):
    """Return sample CSV as bytes."""
    return sample_df.to_csv(index=False).encode("utf-8")
