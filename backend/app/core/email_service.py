"""Dịch vụ gửi email dùng chung (OTP, email đặt cọc...).

EMAIL_BACKEND=console: chỉ ghi ra log (máy cá nhân, CI). EMAIL_BACKEND=brevo: gọi API Brevo.
Mọi lỗi gửi đều được gói thành EmailSendError để nơi gọi bắt và trả lỗi rõ ràng, không làm sập server.
"""
import logging

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

BREVO_SEND_URL = "https://api.brevo.com/v3/smtp/email"
BREVO_TIMEOUT_SECONDS = 10.0


class EmailSendError(Exception):
    """Gửi email thất bại (cấu hình thiếu, Brevo từ chối, hết thời gian chờ, lỗi mạng)."""


def send_email(to: str, subject: str, html: str) -> None:
    backend = (settings.EMAIL_BACKEND or "console").strip().lower()
    if backend == "console":
        # Chỉ chế độ console mới được ghi nội dung (có thể chứa OTP) ra log
        logger.info("[EMAIL console] to=%s subject=%s\n%s", to, subject, html)
        return
    if backend == "brevo":
        _send_via_brevo(to, subject, html)
        return
    raise EmailSendError(f"EMAIL_BACKEND không hợp lệ: {settings.EMAIL_BACKEND!r} (chỉ nhận 'console' hoặc 'brevo').")


def _send_via_brevo(to: str, subject: str, html: str) -> None:
    if not settings.BREVO_API_KEY:
        raise EmailSendError("Thiếu BREVO_API_KEY nên không gửi được email.")
    payload = {
        "sender": {"email": settings.EMAIL_FROM, "name": settings.EMAIL_FROM_NAME},
        "to": [{"email": to}],
        "subject": subject,
        "htmlContent": html,
    }
    try:
        response = httpx.post(
            BREVO_SEND_URL,
            json=payload,
            headers={"api-key": settings.BREVO_API_KEY, "accept": "application/json"},
            timeout=BREVO_TIMEOUT_SECONDS,
        )
    except httpx.HTTPError as exc:
        logger.error("Brevo không phản hồi: %s", type(exc).__name__)
        raise EmailSendError(f"Không kết nối được Brevo: {type(exc).__name__}") from exc
    if response.status_code >= 400:
        # Không ghi nội dung email; chỉ ghi mã trạng thái và phần lỗi do Brevo trả về
        logger.error("Brevo từ chối gửi email: HTTP %s %s", response.status_code, response.text[:300])
        raise EmailSendError(f"Brevo từ chối gửi email (HTTP {response.status_code}): {response.text[:300]}")
