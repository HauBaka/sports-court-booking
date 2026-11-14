"""Tạo, gửi và kiểm mã OTP email (docs/api-endpoints.md mục 1.5, 1.6, 1.1).

Luật: 6 số, hạn 5 phút, gửi lại sau 60 giây (theo email), sai 5 lần hủy mã, dùng một lần.
Mã chỉ lưu dạng HMAC-SHA256; mã thô không bao giờ vào DB hay log (trừ chế độ console).
"""
import hashlib
import hmac
import logging
import secrets
import datetime
from datetime import datetime
from datetime import timedelta
from typing import Optional

from fastapi import status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core import email_service
from app.core.config import settings
from app.core.exceptions import BusinessException
from app.models import email_otp as otp_model
from app.models.email_otp import EmailOtp
from app.models.user import User

logger = logging.getLogger(__name__)

PURPOSE_REGISTER = "REGISTER"
PURPOSE_RESET_PASSWORD = "RESET_PASSWORD"
PURPOSES = (PURPOSE_REGISTER, PURPOSE_RESET_PASSWORD)

OTP_LENGTH = 6
OTP_TTL = timedelta(minutes=5)
OTP_COOLDOWN = timedelta(seconds=60)
OTP_MAX_ATTEMPTS = 5
FIXED_DEV_CODE = "123456"


def _now():
    # Gọi qua module để test thay được đồng hồ bằng monkeypatch
    return otp_model.utcnow()


def _use_fixed_code() -> bool:
    """console và ENVIRONMENT khác production thì mã cố định 123456. Production luôn ngẫu nhiên."""
    return (
        settings.EMAIL_BACKEND.strip().lower() == "console"
        and settings.ENVIRONMENT.strip().lower() != "production"
    )


def generate_code() -> str:
    if _use_fixed_code():
        return FIXED_DEV_CODE
    return f"{secrets.randbelow(10 ** OTP_LENGTH):0{OTP_LENGTH}d}"


def hash_code(email: str, purpose: str, code: str) -> str:
    message = f"{email}|{purpose}|{code}".encode("utf-8")
    return hmac.new(settings.JWT_SECRET.encode("utf-8"), message, hashlib.sha256).hexdigest()


def _error(code: str, message: str) -> BusinessException:
    return BusinessException(status_code=status.HTTP_400_BAD_REQUEST, code=code, message=message)


def verify_otp(db: Session, email: str, purpose: str, code: str) -> None:
    """Kiểm mã. Sai thì commit riêng số lần thử rồi ném 400. Đúng thì đánh dấu đã dùng nhưng KHÔNG commit:
    nơi gọi commit cùng transaction chính, nếu transaction đó rollback thì mã chưa bị tiêu."""
    row: Optional[EmailOtp] = (
        db.query(EmailOtp)
        .filter(EmailOtp.email == email, EmailOtp.purpose == purpose)
        .with_for_update()
        .first()
    )
    if row is None or row.consumed_at is not None:
        db.rollback()
        raise _error("AUTH_OTP_INVALID", "Mã OTP không chính xác hoặc đã bị hủy.")
    if _now() > row.expires_at:
        db.rollback()
        raise _error("AUTH_OTP_EXPIRED", "Mã OTP đã hết hạn. Vui lòng yêu cầu mã mới.")

    if hmac.compare_digest(row.code_hash, hash_code(email, purpose, code)):
        row.consumed_at = _now()
        return

    row.attempts += 1
    too_many = row.attempts >= OTP_MAX_ATTEMPTS
    if too_many:
        row.consumed_at = _now()
    db.commit()  # commit riêng, không bị rollback cùng transaction chính
    if too_many:
        raise _error(
            "AUTH_OTP_TOO_MANY_ATTEMPTS",
            "Bạn đã nhập sai quá 5 lần. Mã OTP đã bị hủy, vui lòng yêu cầu mã mới.",
        )
    raise _error("AUTH_OTP_INVALID", "Mã OTP không chính xác hoặc đã bị hủy.")


def _otp_email_html(code: str, purpose: str) -> str:
    action = "đăng ký tài khoản" if purpose == PURPOSE_REGISTER else "đặt lại mật khẩu"
    minutes = int(OTP_TTL.total_seconds() // 60)
    # ===== CHỈNH SỬA GIAO DIỆN EMAIL OTP =====
    # Muốn đổi giao diện email OTP thì sửa khối HTML bên dưới (màu, logo, chữ, bố cục).
    # Lưu ý: dùng CSS inline và <table> để Gmail/Outlook hiển thị đúng.
    # Mã OTP phải nằm trong thẻ <h2> đầu tiên (test_auth_otp.py tách mã từ thẻ này).
    brand_name = "Sports Court Booking"
    brand_color = "#16a34a"  # màu chủ đạo (header, mã OTP)
    # logo_url: nếu có logo công khai (https) thì thay vào, rồi thêm <img> vào header
    return (
    f'<div style="background-color: #f4f5f7; padding: 32px 16px; font-family: -apple-system, BlinkMacSystemFont, \'Segoe UI\', Roboto, Helvetica, Arial, sans-serif;">'
    f'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 480px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);">'
    
    # --- Header ---
    f'<tr><td style="background-color: {brand_color}; padding: 24px; text-align: center; color: #ffffff; font-size: 22px; font-weight: 700; letter-spacing: 0.5px;">{brand_name}</td></tr>'
    
    # --- Nội dung ---
    f'<tr><td style="padding: 32px 24px; color: #1f2937; font-size: 15px; line-height: 24px;">'
    f'<p style="margin: 0 0 16px; font-size: 16px;">Xin chào,</p>'
    f'<p style="margin: 0 0 24px; color: #4b5563;">Bạn vừa yêu cầu mã xác thực để <b>{action}</b>. Vui lòng sử dụng mã bên dưới:</p>'
    
    # --- Ô mã OTP ---
    f'<div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; text-align: center; margin: 0 0 24px;">'
    f'<h2 style="margin: 0; font-size: 36px; letter-spacing: 10px; color: {brand_color}; font-weight: 800; font-family: \'Courier New\', Courier, monospace;">{code}</h2>'
    f'</div>'
    
    f'<p style="margin: 0 0 12px; color: #4b5563; font-size: 14px;">Mã xác thực có hiệu lực trong vòng <b>{minutes} phút</b> và chỉ sử dụng được một lần.</p>'
    
    # --- Cảnh báo bảo mật ---
    f'<div style="background-color: #fef2f2; border-left: 4px solid #ef4444; padding: 12px 16px; border-radius: 4px; margin-top: 20px;">'
    f'<p style="margin: 0; color: #991b1b; font-size: 13px; line-height: 18px;">⚠️ <b>Lưu ý bảo mật:</b> Không chia sẻ mã này cho bất kỳ ai, kể cả nhân viên của {brand_name}.</p>'
    f'</div>'
    
    f'</td></tr>'
    
    # --- Footer ---
    f'<tr><td style="padding: 20px 24px; background-color: #f8fafc; color: #94a3b8; font-size: 12px; text-align: center; line-height: 18px; border-top: 1px solid #f1f5f9;">'
    f'Nếu bạn không yêu cầu mã này, vui lòng bỏ qua email này.<br>'
    f'&copy; {datetime.now().year} {brand_name}. All rights reserved.'
    f'</td></tr>'
    
    f'</table></div>'
    )
    # ===== HẾT PHẦN CHỈNH SỬA GIAO DIỆN EMAIL OTP =====


def request_otp(db: Session, email: str, purpose: str) -> None:
    """POST /auth/otp: kiểm cooldown, tạo mã, lưu băm, gửi email."""
    user_exists = db.query(User.id).filter(User.email == email).first() is not None
    if purpose == PURPOSE_REGISTER and user_exists:
        raise BusinessException(
            status_code=status.HTTP_409_CONFLICT,
            code="AUTH_EMAIL_EXISTS",
            message="Email đã được đăng ký bởi tài khoản khác trong hệ thống.",
        )

    now = _now()
    # Cooldown tính theo email (mọi purpose), kể cả email không có trong users
    last_sent = db.query(func.max(EmailOtp.created_at)).filter(EmailOtp.email == email).scalar()
    if last_sent is not None and now - last_sent < OTP_COOLDOWN:
        retry_after = max(1, int((OTP_COOLDOWN - (now - last_sent)).total_seconds()) + 1)
        raise BusinessException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            code="AUTH_OTP_TOO_SOON",
            message="Vui lòng chờ 60 giây trước khi yêu cầu mã mới.",
            details={"retry_after_seconds": retry_after},
            headers={"Retry-After": str(retry_after)},
        )

    code = generate_code()
    row = db.query(EmailOtp).filter(EmailOtp.email == email, EmailOtp.purpose == purpose).first()
    if row is None:
        row = EmailOtp(email=email, purpose=purpose)
        db.add(row)
    row.code_hash = hash_code(email, purpose, code)
    row.attempts = 0
    row.created_at = now
    row.expires_at = now + OTP_TTL
    row.consumed_at = None
    db.commit()

    # RESET_PASSWORD với email không tồn tại: vẫn lưu dòng (để có cooldown) nhưng không gửi mail
    if purpose == PURPOSE_RESET_PASSWORD and not user_exists:
        return

    try:
        email_service.send_email(email, "Mã xác thực OTP - Sports Court Booking", _otp_email_html(code, purpose))
    except email_service.EmailSendError as exc:
        # Gửi lỗi thì bỏ mã vừa tạo để người dùng thử lại ngay, không bị cooldown oan
        db.delete(row)
        db.commit()
        logger.error("Gửi OTP thất bại cho purpose=%s: %s", purpose, exc)
        raise BusinessException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            code="EMAIL_SEND_FAILED",
            message="Không gửi được email xác thực. Vui lòng thử lại sau.",
        ) from exc
