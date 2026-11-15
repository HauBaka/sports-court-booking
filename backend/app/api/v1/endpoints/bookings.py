# pyright: reportAttributeAccessIssue=false, reportArgumentType=false
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_role
from app.core.exceptions import BusinessException
from app.models.booking import Booking
from app.models.user import User
from app.services.wallet_service import get_system_wallet, get_wallet_by_user, lock_wallets, transfer

router = APIRouter()


# ==============================================================================
# 3.4 Thanh toán tiền cọc 30% qua ví nội bộ (DEPOSITED + sinh DEPOSIT)
# ==============================================================================
@router.post("/bookings/{id}/deposit", summary="Thanh toán tiền cọc qua ví nội bộ")
def pay_deposit(
    id: int,
    current_user: User = Depends(require_role("customer")),
    db: Session = Depends(get_db),
):
    booking = db.query(Booking).filter(Booking.id == id).first()
    if not booking:
        raise BusinessException(status.HTTP_404_NOT_FOUND, "BOOKING_NOT_FOUND", "Không tìm thấy đơn đặt sân.")
    if booking.user_id != current_user.id:
        raise BusinessException(
            status.HTTP_403_FORBIDDEN, "AUTH_FORBIDDEN", "Bạn không có quyền thanh toán cọc cho đơn này."
        )

    now = datetime.now(timezone.utc).replace(tzinfo=None)
    try:
        # Bước 1: khóa ví khách + ví hệ thống theo wallet.id tăng dần.
        customer_wallet = get_wallet_by_user(db, current_user.id)
        system_wallet = get_system_wallet(db)
        lock_wallets(db, [customer_wallet.id, system_wallet.id])

        # Bước 2: chuyển trạng thái có điều kiện; rowcount = 0 → hết hạn / đã đổi trạng thái / gửi trùng.
        updated = (
            db.query(Booking)
            .filter(Booking.id == id, Booking.status == "PENDING_DEPOSIT", Booking.hold_expires_at > now)
            .update({"status": "DEPOSITED", "hold_expires_at": None}, synchronize_session=False)
        )
        if updated != 1:
            raise BusinessException(
                status.HTTP_400_BAD_REQUEST,
                "CANNOT_DEPOSIT_EXPIRED_BOOKING",
                "Đơn đã quá hạn giữ chỗ hoặc không còn ở trạng thái chờ cọc, không thể thanh toán cọc.",
            )

        # Bước 3-5: kiểm tra số dư, trừ/cộng ví, ghi DEPOSIT (một chỗ duy nhất trong transfer()).
        tx = transfer(
            db,
            type="DEPOSIT",
            amount=booking.deposit_amount,
            from_wallet_id=customer_wallet.id,
            to_wallet_id=system_wallet.id,
            related_booking_id=booking.id,
        )
        db.commit()  # Bước 6
    except Exception:
        db.rollback()
        raise

    db.refresh(booking)
    return {
        "success": True,
        "message": "Thanh toán cọc 30% thành công. Đơn đặt sân đã được xác nhận.",
        "data": {
            "booking_id": booking.id,
            "status": booking.status,
            "deposit_amount_paid": tx.amount,
            "remaining_amount_due_at_court": booking.total_amount - tx.amount,
            "wallet_balance_remaining": tx.balance_after,
            "transaction_type": "DEPOSIT",
        },
    }
