# pyright: reportAttributeAccessIssue=false, reportArgumentType=false
import math
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_role
from app.models.user import User
from app.models.wallet import WalletTransaction
from app.schemas.wallet import TxType
from app.services.wallet_service import get_wallet_by_user

router = APIRouter()


# ==============================================================================
# 5.1 Tra cứu số dư ví hiện tại
# ==============================================================================
@router.get("/wallets/me", summary="Tra cứu số dư ví hiện tại")
def get_my_wallet(
    current_user: User = Depends(require_role("customer", "owner")),
    db: Session = Depends(get_db),
):
    wallet = get_wallet_by_user(db, current_user.id)
    return {
        "success": True,
        "message": "Lấy thông tin ví thành công.",
        "data": {"wallet_id": wallet.id, "user_id": wallet.user_id, "balance": wallet.balance},
    }


# ==============================================================================
# 5.2 Tra cứu lịch sử biến động số dư (chỉ ví của chính mình)
# ==============================================================================
@router.get("/wallets/me/transactions", summary="Tra cứu lịch sử biến động số dư")
def list_my_transactions(
    type: Optional[TxType] = Query(None, description="TOPUP, DEPOSIT, REFUND, FORFEIT, SETTLE"),
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=100),
    current_user: User = Depends(require_role("customer", "owner")),
    db: Session = Depends(get_db),
):
    wallet = get_wallet_by_user(db, current_user.id)

    query = db.query(WalletTransaction).filter(
        or_(WalletTransaction.from_wallet_id == wallet.id, WalletTransaction.to_wallet_id == wallet.id)
    )
    if type:
        query = query.filter(WalletTransaction.type == type)

    total = query.count()
    rows = (
        query.order_by(WalletTransaction.created_at.desc(), WalletTransaction.id.desc())
        .offset((page - 1) * limit)
        .limit(limit)
        .all()
    )
    return {
        "success": True,
        "message": "Lấy lịch sử giao dịch ví thành công.",
        "data": [
            {
                "id": t.id,
                "type": t.type,
                "amount": t.amount,
                "balance_after": t.balance_after,
                "related_booking_id": t.related_booking_id,
                "created_at": t.created_at.isoformat() + "Z" if t.created_at else None,
            }
            for t in rows
        ],
        "meta": {
            "page": page,
            "limit": limit,
            "total": total,
            "total_pages": math.ceil(total / limit) if total > 0 else 0,
        },
    }
