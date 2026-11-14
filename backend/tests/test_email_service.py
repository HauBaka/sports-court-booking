"""Test dịch vụ gửi email. Không gọi Brevo thật: httpx.post được thay bằng bản giả."""
import logging

import httpx
import pytest

from app.core import email_service
from app.core.config import settings


class FakeResponse:
    def __init__(self, status_code=201, text="{}"):
        self.status_code = status_code
        self.text = text


@pytest.fixture
def brevo(monkeypatch):
    monkeypatch.setattr(settings, "EMAIL_BACKEND", "brevo")
    monkeypatch.setattr(settings, "BREVO_API_KEY", "key-gia-cho-test")
    monkeypatch.setattr(settings, "EMAIL_FROM", "from@example.com")
    calls = []

    def fake_post(url, **kwargs):
        calls.append((url, kwargs))
        return FakeResponse()

    monkeypatch.setattr(email_service.httpx, "post", fake_post)
    return calls


def test_console_chi_ghi_log_khong_goi_brevo(monkeypatch, caplog):
    monkeypatch.setattr(settings, "EMAIL_BACKEND", "console")

    def boom(*args, **kwargs):
        raise AssertionError("Chế độ console không được gọi mạng")

    monkeypatch.setattr(email_service.httpx, "post", boom)
    with caplog.at_level(logging.INFO, logger="app.core.email_service"):
        email_service.send_email("a@example.com", "Tiêu đề", "<p>Nội dung</p>")
    assert "a@example.com" in caplog.text
    assert "Tiêu đề" in caplog.text


def test_brevo_gui_dung_payload_va_header(brevo):
    email_service.send_email("a@example.com", "Tiêu đề", "<p>Nội dung</p>")
    url, kwargs = brevo[0]
    assert url == email_service.BREVO_SEND_URL
    assert kwargs["headers"]["api-key"] == "key-gia-cho-test"
    assert kwargs["json"]["to"] == [{"email": "a@example.com"}]
    assert kwargs["json"]["sender"]["email"] == "from@example.com"
    assert kwargs["json"]["subject"] == "Tiêu đề"
    assert kwargs["json"]["htmlContent"] == "<p>Nội dung</p>"
    assert kwargs["timeout"] == email_service.BREVO_TIMEOUT_SECONDS


def test_brevo_tra_loi_4xx_nem_email_send_error(brevo, monkeypatch):
    monkeypatch.setattr(email_service.httpx, "post", lambda *a, **k: FakeResponse(401, "Key not found"))
    with pytest.raises(email_service.EmailSendError, match="401"):
        email_service.send_email("a@example.com", "s", "h")


def test_brevo_loi_mang_nem_email_send_error(brevo, monkeypatch):
    def timeout(*args, **kwargs):
        raise httpx.ConnectTimeout("hết giờ")

    monkeypatch.setattr(email_service.httpx, "post", timeout)
    with pytest.raises(email_service.EmailSendError, match="Brevo"):
        email_service.send_email("a@example.com", "s", "h")


def test_brevo_thieu_api_key(monkeypatch):
    monkeypatch.setattr(settings, "EMAIL_BACKEND", "brevo")
    monkeypatch.setattr(settings, "BREVO_API_KEY", None)
    with pytest.raises(email_service.EmailSendError, match="BREVO_API_KEY"):
        email_service.send_email("a@example.com", "s", "h")


def test_backend_khong_hop_le(monkeypatch):
    monkeypatch.setattr(settings, "EMAIL_BACKEND", "smtp")
    with pytest.raises(email_service.EmailSendError, match="EMAIL_BACKEND"):
        email_service.send_email("a@example.com", "s", "h")


def test_brevo_khong_ghi_noi_dung_email_ra_log(brevo, monkeypatch, caplog):
    monkeypatch.setattr(email_service.httpx, "post", lambda *a, **k: FakeResponse(500, "lỗi phía Brevo"))
    with caplog.at_level(logging.INFO, logger="app.core.email_service"):
        with pytest.raises(email_service.EmailSendError):
            email_service.send_email("a@example.com", "s", "<h2>987654</h2>")
    assert "987654" not in caplog.text
