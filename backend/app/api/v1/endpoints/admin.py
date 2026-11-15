# pyright: reportAttributeAccessIssue=false, reportArgumentType=false
import math
from typing import Optional

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_role
from app.core.exceptions import BusinessException
from app.models.user import User
from app.models.wallet import Wallet
from app.schemas.wallet import WalletTopupRequest
from app.services.wallet_service import get_wallet_by_user, transfer

router = APIRouter()


def _parse_amount(raw) -> int:
    """Chỉ nhận số nguyên dương; 0, âm, có phần lẻ, chuỗi, bool đều bị từ chối."""
    if isinstance(raw, float) and raw.is_integer():
        raw = int(raw)
    if not isinstance(raw, int) or isinstance(raw, bool) or raw <= 0:
        raise BusinessException(
            status.HTTP_400_BAD_REQUEST,
            "DEPOSIT_AMOUNT_INVALID",
            "Số tiền cấp phải là số nguyên lớn hơn 0 VNĐ.",
        )
    return raw


# ==============================================================================
# 5.3 Admin nạp tiền trải nghiệm vào ví người dùng (TOPUP)
# ==============================================================================
@router.post("/admin/wallet-topups", summary="Admin nạp tiền vào ví người dùng")
def admin_topup(
    body: WalletTopupRequest,
    admin: User = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    amount = _parse_amount(body.amount)

    target = db.query(User).filter(User.id == body.user_id).first()
    if not target:
        raise BusinessException(
            status.HTTP_404_NOT_FOUND, "RESOURCE_NOT_FOUND", f"Người dùng với ID {body.user_id} không tồn tại."
        )
    wallet = get_wallet_by_user(db, target.id)

    try:
        tx = transfer(db, type="TOPUP", amount=amount, to_wallet_id=wallet.id, created_by=admin.id)
        db.commit()
    except Exception:
        db.rollback()
        raise

    return {
        "success": True,
        "message": "Nạp tiền vào ví người dùng thành công.",
        "data": {
            "user_id": target.id,
            "granted_amount": amount,
            "new_balance": tx.balance_after,
            "transaction_type": "TOPUP",
        },
    }


# ==============================================================================
# 5.4 Admin tra cứu danh sách người dùng
# ==============================================================================
@router.get("/admin/users", summary="Admin tra cứu danh sách người dùng")
def admin_list_users(
    search: Optional[str] = Query(None, description="Tên, email hoặc số điện thoại (khớp tương đối)"),
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=100),
    admin: User = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    query = (
        db.query(User, Wallet.balance)
        .outerjoin(Wallet, Wallet.user_id == User.id)
        .filter(User.is_system == False)  # noqa: E712 — không liệt kê tài khoản hệ thống
    )
    keyword = (search or "").strip()
    if keyword:
        # Escape ký tự đại diện để "%" / "_" người dùng gõ được hiểu theo nghĩa đen
        escaped = keyword.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
        pattern = f"%{escaped}%"
        query = query.filter(
            or_(
                User.name.like(pattern, escape="\\"),
                User.email.like(pattern, escape="\\"),
                User.phone.like(pattern, escape="\\"),
            )
        )

    total = query.count()
    rows = query.order_by(User.id.asc()).offset((page - 1) * limit).limit(limit).all()
    return {
        "success": True,
        "message": "Lấy danh sách người dùng thành công.",
        "data": [
            {
                "id": u.id,
                "name": u.name,
                "email": u.email,
                "phone": u.phone,
                "roles": [r.name.lower() for r in u.roles],
                "balance": balance or 0,
            }
            for u, balance in rows
        ],
        "meta": {
            "page": page,
            "limit": limit,
            "total": total,
            "total_pages": math.ceil(total / limit) if total > 0 else 0,
        },
    }
