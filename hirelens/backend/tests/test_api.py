"""Tests for FastAPI endpoints."""

import io
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))


class TestHealthCheck:
    def test_health(self, client):
        response = client.get("/")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"
        assert data["service"] == "HireLens API"


class TestUpload:
    def test_upload_csv(self, client, sample_csv_bytes):
        response = client.post(
            "/api/upload",
            files={"file": ("test.csv", io.BytesIO(sample_csv_bytes), "text/csv")},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["row_count"] == 20
        assert len(data["columns"]) > 0

    def test_upload_non_csv(self, client):
        response = client.post(
            "/api/upload",
            files={"file": ("test.txt", io.BytesIO(b"hello"), "text/plain")},
        )
        assert response.status_code == 400
        assert "CSV" in response.json()["detail"]

    def test_upload_empty_csv(self, client):
        csv_data = b"col1,col2\n"
        response = client.post(
            "/api/upload",
            files={"file": ("empty.csv", io.BytesIO(csv_data), "text/csv")},
        )
        # Empty CSV with headers but no data rows
        assert response.status_code == 400

    def test_upload_oversized_file(self, client):
        # 11 MB of data
        large_data = b"a,b\n" + b"1,2\n" * (11 * 1024 * 1024 // 4)
        response = client.post(
            "/api/upload",
            files={"file": ("big.csv", io.BytesIO(large_data), "text/csv")},
        )
        assert response.status_code == 413


class TestAnalyze:
    def test_analyze_without_upload(self, client):
        response = client.post(
            "/api/analyze",
            data={"target_column": "hired", "protected_column": "gender"},
        )
        assert response.status_code == 400

    def test_analyze_flow(self, client, sample_csv_bytes):
        # Upload first
        client.post(
            "/api/upload",
            files={"file": ("test.csv", io.BytesIO(sample_csv_bytes), "text/csv")},
        )
        # Then analyze
        response = client.post(
            "/api/analyze",
            data={"target_column": "hired", "protected_column": "gender"},
        )
        assert response.status_code == 200
        data = response.json()
        assert "disparate_impact" in data
        assert "bias_detected" in data
        assert data["analysis_id"] is not None

    def test_analyze_invalid_column(self, client, sample_csv_bytes):
        client.post(
            "/api/upload",
            files={"file": ("test.csv", io.BytesIO(sample_csv_bytes), "text/csv")},
        )
        response = client.post(
            "/api/analyze",
            data={"target_column": "nonexistent", "protected_column": "gender"},
        )
        assert response.status_code == 400


class TestMultiAttribute:
    def test_multi_analyze(self, client, sample_csv_bytes):
        client.post(
            "/api/upload",
            files={"file": ("test.csv", io.BytesIO(sample_csv_bytes), "text/csv")},
        )
        response = client.post(
            "/api/analyze/multi",
            data={"target_column": "hired", "protected_columns": "gender"},
        )
        assert response.status_code == 200
        data = response.json()
        assert "gender" in data["results_by_attribute"]


class TestSimulate:
    def test_simulate_flow(self, client, sample_csv_bytes):
        client.post(
            "/api/upload",
            files={"file": ("test.csv", io.BytesIO(sample_csv_bytes), "text/csv")},
        )
        client.post(
            "/api/analyze",
            data={"target_column": "score", "protected_column": "gender", "threshold": "60"},
        )
        response = client.post("/api/simulate", data={"threshold": "70"})
        assert response.status_code == 200
        data = response.json()
        assert "disparate_impact" in data


class TestReport:
    def test_json_report(self, client, sample_csv_bytes):
        client.post(
            "/api/upload",
            files={"file": ("test.csv", io.BytesIO(sample_csv_bytes), "text/csv")},
        )
        client.post(
            "/api/analyze",
            data={"target_column": "hired", "protected_column": "gender"},
        )
        response = client.get("/api/report")
        assert response.status_code == 200
        data = response.json()
        assert data["report_title"] == "HireLens - Bias Analysis Report"

    def test_pdf_report(self, client, sample_csv_bytes):
        client.post(
            "/api/upload",
            files={"file": ("test.csv", io.BytesIO(sample_csv_bytes), "text/csv")},
        )
        client.post(
            "/api/analyze",
            data={"target_column": "hired", "protected_column": "gender"},
        )
        response = client.get("/api/report/pdf")
        assert response.status_code == 200
        assert response.headers["content-type"] == "application/pdf"
        # PDF starts with %PDF
        assert response.content[:5] == b"%PDF-"


class TestAuth:
    def test_register(self, client):
        response = client.post(
            "/api/auth/register",
            data={"username": "testuser", "password": "password123"},
        )
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert data["username"] == "testuser"

    def test_register_short_username(self, client):
        response = client.post(
            "/api/auth/register",
            data={"username": "ab", "password": "password123"},
        )
        assert response.status_code == 400

    def test_register_duplicate(self, client):
        client.post(
            "/api/auth/register",
            data={"username": "testuser", "password": "password123"},
        )
        response = client.post(
            "/api/auth/register",
            data={"username": "testuser", "password": "password456"},
        )
        assert response.status_code == 409

    def test_login(self, client):
        client.post(
            "/api/auth/register",
            data={"username": "testuser", "password": "password123"},
        )
        response = client.post(
            "/api/auth/login",
            data={"username": "testuser", "password": "password123"},
        )
        assert response.status_code == 200
        assert "token" in response.json()

    def test_login_wrong_password(self, client):
        client.post(
            "/api/auth/register",
            data={"username": "testuser", "password": "password123"},
        )
        response = client.post(
            "/api/auth/login",
            data={"username": "testuser", "password": "wrong"},
        )
        assert response.status_code == 401

    def test_me_endpoint(self, client):
        reg = client.post(
            "/api/auth/register",
            data={"username": "testuser", "password": "password123"},
        )
        token = reg.json()["token"]
        response = client.get(
            "/api/auth/me",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 200
        assert response.json()["username"] == "testuser"

    def test_me_unauthorized(self, client):
        response = client.get("/api/auth/me")
        assert response.status_code == 401


class TestHistory:
    def test_history_empty(self, client):
        response = client.get("/api/history")
        assert response.status_code == 200
        assert response.json()["count"] == 0

    def test_history_after_analysis(self, client, sample_csv_bytes):
        client.post(
            "/api/upload",
            files={"file": ("test.csv", io.BytesIO(sample_csv_bytes), "text/csv")},
        )
        client.post(
            "/api/analyze",
            data={"target_column": "hired", "protected_column": "gender"},
        )
        response = client.get("/api/history")
        assert response.status_code == 200
        data = response.json()
        assert data["count"] == 1
        assert data["analyses"][0]["filename"] == "test.csv"

    def test_history_detail(self, client, sample_csv_bytes):
        client.post(
            "/api/upload",
            files={"file": ("test.csv", io.BytesIO(sample_csv_bytes), "text/csv")},
        )
        analyze_resp = client.post(
            "/api/analyze",
            data={"target_column": "hired", "protected_column": "gender"},
        )
        analysis_id = analyze_resp.json()["analysis_id"]
        response = client.get(f"/api/history/{analysis_id}")
        assert response.status_code == 200
        data = response.json()
        assert data["filename"] == "test.csv"
        assert "bias_results" in data
