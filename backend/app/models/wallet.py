from sqlalchemy import BigInteger, Column, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base


class Wallet(Base):
    __tablename__ = "wallets"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    user_id = Column(BigInteger, ForeignKey("users.id"), unique=True, nullable=False)
    balance = Column(BigInteger, default=0, nullable=False)

    user = relationship("User", back_populates="wallet")

    def __repr__(self) -> str:
        return f"<Wallet id={self.id} user_id={self.user_id} balance={self.balance}>"

