from fastapi.testclient import TestClient


def test_root_endpoint(client: TestClient):
    """Test that root endpoint returns HTTP 200 with welcome message."""
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert "message" in data
    assert data["docs"] == "/docs"
    assert data["health"] == "/health"


def test_healthcheck_endpoint(client: TestClient):
    """Test that /health endpoint responds successfully."""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] in ["healthy", "degraded"]
    assert "service" in data
    assert "timestamp" in data
    assert "database" in data
    assert "status" in data["database"]


def test_api_v1_healthcheck_endpoint(client: TestClient):
    """Test that /api/v1/health endpoint also responds."""
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] in ["healthy", "degraded"]


def test_healthcheck_database_connected(client: TestClient, monkeypatch):
    """Test healthcheck response when database is connected."""
    from app.api.v1.endpoints import health

    monkeypatch.setattr(
        health,
        "check_db_connection",
        lambda: {"status": "connected", "error": None},
    )

    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["database"]["status"] == "connected"
    assert data["database"]["error"] is None


def test_healthcheck_database_disconnected_strict(client: TestClient, monkeypatch):
    """Test healthcheck response with strict=true when database is disconnected."""
    from app.api.v1.endpoints import health

    monkeypatch.setattr(
        health,
        "check_db_connection",
        lambda: {"status": "disconnected", "error": "Can't connect to MySQL server"},
    )

    # When strict=True, it should return 503
    response = client.get("/health?strict=true")
    assert response.status_code == 503
    data = response.json()
    assert data["status"] == "degraded"
    assert data["database"]["status"] == "disconnected"
