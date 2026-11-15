from datetime import datetime, timezone

from sqlalchemy import BigInteger, CheckConstraint, Column, DateTime, Enum, ForeignKey, UniqueConstraint, event
from sqlalchemy.orm import relationship
from app.core.database import Base

WALLET_TX_TYPES = ("TOPUP", "DEPOSIT", "REFUND", "FORFEIT", "SETTLE")


class Wallet(Base):
    __tablename__ = "wallets"
    __table_args__ = (CheckConstraint("balance >= 0", name="chk_wallets_balance"),)

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    user_id = Column(BigInteger, ForeignKey("users.id"), unique=True, nullable=False)
    balance = Column(BigInteger, default=0, nullable=False)

    user = relationship("User", back_populates="wallet")

    def __repr__(self) -> str:
        return f"<Wallet id={self.id} user_id={self.user_id} balance={self.balance}>"


class WalletTransaction(Base):
    """Sổ cái ví: chỉ INSERT, không bao giờ sửa/xóa (có trigger chặn ở CSDL, event chặn ở ORM)."""

    __tablename__ = "wallet_transactions"
    __table_args__ = (
        UniqueConstraint("related_booking_id", "type", name="uq_one_tx_per_booking_type"),
        CheckConstraint("amount > 0", name="chk_wt_amount"),
    )

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    from_wallet_id = Column(BigInteger, ForeignKey("wallets.id"), nullable=True)
    to_wallet_id = Column(BigInteger, ForeignKey("wallets.id"), nullable=False)
    type = Column(Enum(*WALLET_TX_TYPES, name="wallet_tx_type"), nullable=False)
    amount = Column(BigInteger, nullable=False)
    # Số dư của ví nhận (to_wallet) sau giao dịch
    balance_after = Column(BigInteger, nullable=False)
    related_booking_id = Column(BigInteger, ForeignKey("bookings.id"), nullable=True)
    created_by = Column(BigInteger, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc).replace(tzinfo=None), nullable=False)

    def __repr__(self) -> str:
        return f"<WalletTransaction id={self.id} type={self.type} amount={self.amount}>"


@event.listens_for(WalletTransaction, "before_update")
@event.listens_for(WalletTransaction, "before_delete")
def _forbid_ledger_mutation(mapper, connection, target):
    raise RuntimeError("Sổ cái wallet_transactions chỉ cho phép ghi thêm, không được sửa hoặc xóa.")
