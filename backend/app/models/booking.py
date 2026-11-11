from sqlalchemy import (
    BigInteger,
    Column,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
)
from sqlalchemy.orm import relationship
from app.core.database import Base


class Booking(Base):
    __tablename__ = "bookings"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    user_id = Column(BigInteger, ForeignKey("users.id"), nullable=False)
    court_id = Column(BigInteger, ForeignKey("courts.id"), nullable=False)
    play_date = Column(Date, nullable=False)
    start_at = Column(DateTime, nullable=False)
    status = Column(String(30), default="PENDING_DEPOSIT", nullable=False)
    subtotal = Column(BigInteger, default=0, nullable=False)
    service_total = Column(BigInteger, default=0, nullable=False)
    total_amount = Column(BigInteger, default=0, nullable=False)
    deposit_amount = Column(BigInteger, default=0, nullable=False)
    deposit_percent = Column(Integer, default=30, nullable=False)
    hold_expires_at = Column(DateTime, nullable=True)
    cancelled_at = Column(DateTime, nullable=True)
    cancel_reason = Column(Text, nullable=True)

    court = relationship("Court", back_populates="bookings")
    slots = relationship("BookingSlot", back_populates="booking", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<Booking id={self.id} court_id={self.court_id} status={self.status} play_date={self.play_date}>"


class BookingSlot(Base):
    __tablename__ = "booking_slots"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    booking_id = Column(BigInteger, ForeignKey("bookings.id"), nullable=False)
    court_id = Column(BigInteger, ForeignKey("courts.id"), nullable=False)
    play_date = Column(Date, nullable=False)
    time_slot_id = Column(Integer, ForeignKey("time_slots.id"), nullable=False)
    base_price = Column(BigInteger, nullable=False)
    final_price = Column(BigInteger, nullable=False)
    multiplier = Column(Numeric(4, 2), default=1.00, nullable=False)
    released_at = Column(DateTime, nullable=True)

    booking = relationship("Booking", back_populates="slots")
    court = relationship("Court")
    time_slot = relationship("TimeSlot", lazy="joined")

    def __repr__(self) -> str:
        return f"<BookingSlot id={self.id} booking_id={self.booking_id} time_slot_id={self.time_slot_id}>"
