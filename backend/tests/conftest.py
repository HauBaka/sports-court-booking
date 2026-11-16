import sys
from pathlib import Path
import pytest
from fastapi.testclient import TestClient

# Ensure backend directory is in python search path
BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.core.config import settings
from app.main import app


@pytest.fixture(autouse=True)
def fixed_otp_env(monkeypatch):
    """OTP luôn là 123456 trong test, bất kể .env của máy: console và ENVIRONMENT khác production."""
    monkeypatch.setattr(settings, "EMAIL_BACKEND", "console")
    monkeypatch.setattr(settings, "ENVIRONMENT", "development")


@pytest.fixture(scope="session")
def client():
    """Fixture providing a TestClient for FastAPI app."""
    with TestClient(app) as test_client:
        yield test_client
