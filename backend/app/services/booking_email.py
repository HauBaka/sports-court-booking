# pyright: reportAttributeAccessIssue=false, reportArgumentType=false
"""Email xác nhận đặt cọc (FR-25). Gửi lỗi không bao giờ được làm hỏng đơn đã cọc."""
import logging
from html import escape
from typing import Tuple

from app.core.email_service import send_email
from app.models.booking import Booking
from app.models.user import User

logger = logging.getLogger(__name__)


def _vnd(amount: int) -> str:
    return f"{amount:,}".replace(",", ".") + "đ"


def build_deposit_confirmation_email(booking: Booking, user: User) -> Tuple[str, str]:
    """Trả về (subject, html). Chỉ đọc dữ liệu, gọi sau khi đã commit."""
    slots = sorted(booking.slots, key=lambda s: s.time_slot.start_time)
    if slots:
        times = ", ".join(
            f"{s.time_slot.start_time.strftime('%H:%M')}-{s.time_slot.end_time.strftime('%H:%M')}" for s in slots
        )
    else:
        times = "—"
    deposit = int(booking.deposit_amount)
    remaining = int(booking.total_amount) - deposit
    subject = f"Xác nhận đặt cọc đơn #{booking.id}"
    html = (
        f"<p>Xin chào {escape(user.name)},</p>"
        "<p>Bạn đã thanh toán cọc thành công. Thông tin đơn đặt sân:</p>"
        "<ul>"
        f"<li>Mã đơn: <b>#{booking.id}</b></li>"
        f"<li>Sân: {escape(booking.court.name)}</li>"
        f"<li>Ngày chơi: {booking.play_date.strftime('%d/%m/%Y')}</li>"
        f"<li>Khung giờ: {escape(times)}</li>"
        f"<li>Tiền cọc đã thanh toán: <b>{_vnd(deposit)}</b></li>"
        f"<li>Tiền còn lại thanh toán tại sân: <b>{_vnd(remaining)}</b></li>"
        "</ul>"
        "<p>Cảm ơn bạn đã sử dụng Sports Court Booking.</p>"
    )
    return subject, html


def send_email_safely(to: str, subject: str, html: str) -> None:
    """Nuốt mọi lỗi gửi mail (chỉ ghi log): đơn đã DEPOSITED thì API vẫn phải thành công."""
    try:
        send_email(to, subject, html)
    except Exception as exc:  # noqa: BLE001 — EmailSendError hoặc bất kỳ lỗi nào
        logger.error("Gửi email xác nhận cọc thất bại: %s", type(exc).__name__)
