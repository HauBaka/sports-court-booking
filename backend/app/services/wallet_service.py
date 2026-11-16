# Model khai báo bằng Column() kiểu cũ nên Pylance báo sai khi gán giá trị cho thuộc tính; runtime vẫn đúng.
# pyright: reportAttributeAccessIssue=false, reportArgumentType=false
"""
Dịch vụ ví nội bộ (QĐ6). Dùng chung cho cọc, hủy/hoàn cọc, kết toán ở Sprint 4.

Quy ước: các hàm ở đây KHÔNG commit/rollback — chạy trong transaction của nơi gọi.
Lỗi nghiệp vụ được raise trước khi ghi gì, nên nơi gọi rollback là sạch.
Cố ý không có hàm sửa/xóa giao dịch: sổ cái chỉ ghi thêm.
"""
from typing import Dict, List, Optional

from fastapi import status
from sqlalchemy.orm import Session

from app.core.exceptions import BusinessException
from app.models.user import User
from app.models.wallet import WALLET_TX_TYPES, Wallet, WalletTransaction


def get_wallet_by_user(db: Session, user_id: int) -> Wallet:
    wallet = db.query(Wallet).filter(Wallet.user_id == user_id).first()
    if not wallet:
        raise BusinessException(
            status.HTTP_404_NOT_FOUND, "WALLET_NOT_FOUND", "Không tìm thấy ví nội bộ của người dùng."
        )
    return wallet


def get_system_wallet(db: Session) -> Wallet:
    wallet = (
        db.query(Wallet)
        .join(User, User.id == Wallet.user_id)
        .filter(User.is_system == True)  # noqa: E712
        .first()
    )
    if not wallet:
        raise BusinessException(
            status.HTTP_404_NOT_FOUND, "WALLET_NOT_FOUND", "Không tìm thấy ví hệ thống trung gian."
        )
    return wallet


def lock_wallets(db: Session, wallet_ids: List[int]) -> Dict[int, Wallet]:
    """SELECT ... FOR UPDATE theo wallet.id tăng dần (chống deadlock). Trả về {id: Wallet} đã khóa."""
    ids = sorted(set(wallet_ids))
    rows = db.query(Wallet).filter(Wallet.id.in_(ids)).order_by(Wallet.id.asc()).with_for_update().all()
    locked = {w.id: w for w in rows}
    for wid in ids:
        if wid not in locked:
            raise BusinessException(
                status.HTTP_404_NOT_FOUND, "WALLET_NOT_FOUND", f"Không tìm thấy ví với ID {wid}."
            )
    return locked


def transfer(
    db: Session,
    *,
    type: str,
    amount: int,
    to_wallet_id: int,
    from_wallet_id: Optional[int] = None,
    related_booking_id: Optional[int] = None,
    created_by: Optional[int] = None,
) -> WalletTransaction:
    """
    Chuyển `amount` từ ví nguồn sang ví đích và ghi đúng một dòng wallet_transactions.
    from_wallet_id=None chỉ dành cho TOPUP (tiền được cấp mới vào hệ thống).

    - Khóa các ví liên quan theo id tăng dần.
    - Thiếu số dư → WALLET_INSUFFICIENT_BALANCE (402), chưa đổi gì.
    - balance_after = số dư của ví phía người dùng (không phải ví hệ thống) sau giao dịch:
      ví nguồn với DEPOSIT, ví đích với các loại còn lại.
    """
    if type not in WALLET_TX_TYPES:
        raise ValueError(f"Loại giao dịch ví không hợp lệ: {type}")
    if not isinstance(amount, int) or isinstance(amount, bool) or amount <= 0:
        raise BusinessException(
            status.HTTP_400_BAD_REQUEST, "DEPOSIT_AMOUNT_INVALID", "Số tiền phải là số nguyên lớn hơn 0 VNĐ."
        )
    if (type == "TOPUP") != (from_wallet_id is None):
        raise ValueError("from_wallet_id chỉ được để trống với giao dịch TOPUP.")
    if from_wallet_id == to_wallet_id:
        raise ValueError("Ví nguồn và ví đích phải khác nhau.")

    wallets = lock_wallets(db, [w for w in (from_wallet_id, to_wallet_id) if w is not None])
    src = wallets[from_wallet_id] if from_wallet_id is not None else None
    dst = wallets[to_wallet_id]

    if src is not None and src.balance < amount:
        raise BusinessException(
            status.HTTP_402_PAYMENT_REQUIRED,
            "WALLET_INSUFFICIENT_BALANCE",
            "Số dư ví không đủ để thực hiện giao dịch.",
        )

    if src is not None:
        src.balance = src.balance - amount
    dst.balance = dst.balance + amount

    tx = WalletTransaction(
        from_wallet_id=from_wallet_id,
        to_wallet_id=to_wallet_id,
        type=type,
        amount=amount,
        balance_after=src.balance if (type == "DEPOSIT" and src is not None) else dst.balance,
        related_booking_id=related_booking_id,
        created_by=created_by,
    )
    db.add(tx)
    db.flush()
    return tx
