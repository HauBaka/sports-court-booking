from datetime import datetime, timezone
from sqlalchemy import BigInteger, Column, DateTime, Integer, String, UniqueConstraint
from app.core.database import Base


def utcnow() -> datetime:
    """Giờ UTC dạng naive, khớp cột DATETIME của MySQL. Test thay hàm này để giả lập thời gian."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


class EmailOtp(Base):
    """Mã OTP gửi qua email. Mỗi (email, purpose) một dòng, mã mới ghi đè mã cũ.
    Không có khóa ngoại tới users để RESET_PASSWORD với email lạ vẫn có cooldown như email thật."""

    __tablename__ = "email_otps"
    __table_args__ = (UniqueConstraint("email", "purpose", name="uq_email_otps_email_purpose"),)

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    email = Column(String(255), nullable=False, index=True)
    purpose = Column(String(20), nullable=False)  # REGISTER | RESET_PASSWORD
    code_hash = Column(String(64), nullable=False)  # HMAC-SHA256, không lưu mã thô
    attempts = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime, nullable=False, default=utcnow)
    expires_at = Column(DateTime, nullable=False)
    consumed_at = Column(DateTime, nullable=True)  # đã dùng hoặc đã bị hủy (sai đủ 5 lần)

    def __repr__(self) -> str:
        return f"<EmailOtp id={self.id} email={self.email} purpose={self.purpose}>"
