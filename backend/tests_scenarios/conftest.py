"""Test kịch bản trên API thật (docs/test-scenarios.md), chạy trên MariaDB đã nạp seed.
Tách khỏi tests/ (unit test dùng SQLite) để hai bên không dùng chung get_db.
Dựng CSDL: docker compose -f docker-compose.test.yml up -d --wait
Chạy: DB_PORT=3307 DB_USER=root DB_PASSWORD=secret DB_NAME=sports_court_booking pytest tests_scenarios/ -v"""
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.main import app  # noqa: E402


@pytest.fixture(scope="session")
def client():
    with TestClient(app) as test_client:
        yield test_client
