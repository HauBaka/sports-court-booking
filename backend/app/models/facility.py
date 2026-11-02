from sqlalchemy import (
    BigInteger,
    Boolean,
    Column,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    Time,
)
from sqlalchemy.orm import relationship
from app.core.database import Base


class Sport(Base):
    __tablename__ = "sports"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(100), unique=True, nullable=False)
    icon_url = Column(String(512), nullable=True)

    courts = relationship("Court", back_populates="sport")

    def __repr__(self) -> str:
        return f"<Sport id={self.id} name={self.name}>"


class Facility(Base):
    __tablename__ = "facilities"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    owner_id = Column(BigInteger, ForeignKey("users.id"), nullable=False)
    name = Column(String(255), nullable=False)
    address = Column(String(500), nullable=False)
    city = Column(String(100), nullable=False)
    district = Column(String(100), nullable=True)
    latitude = Column(Numeric(10, 7), nullable=True)
    longitude = Column(Numeric(10, 7), nullable=True)
    open_time = Column(Time, nullable=False)
    close_time = Column(Time, nullable=False)
    description = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    slot_duration_minutes = Column(Integer, default=60, nullable=False)

    owner = relationship("User", backref="facilities")
    courts = relationship("Court", back_populates="facility", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<Facility id={self.id} name={self.name} owner_id={self.owner_id}>"


class Court(Base):
    __tablename__ = "courts"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    facility_id = Column(BigInteger, ForeignKey("facilities.id"), nullable=False)
    sport_id = Column(Integer, ForeignKey("sports.id"), nullable=False, default=1)
    name = Column(String(255), nullable=False)
    court_type = Column(String(50), nullable=True)
    environment = Column(String(20), nullable=False, default="INDOOR")
    open_time = Column(Time, nullable=False)
    close_time = Column(Time, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)

    facility = relationship("Facility", back_populates="courts", lazy="joined")
    sport = relationship("Sport", back_populates="courts")
    court_slots = relationship("CourtSlot", back_populates="court", cascade="all, delete-orphan")
    bookings = relationship("Booking", back_populates="court")

    def __repr__(self) -> str:
        return f"<Court id={self.id} name={self.name} facility_id={self.facility_id}>"


class TimeSlot(Base):
    __tablename__ = "time_slots"

    id = Column(Integer, primary_key=True, autoincrement=True)
    start_time = Column(Time, nullable=False)
    end_time = Column(Time, nullable=False)
    duration_minutes = Column(Integer, nullable=False, default=60)
    label = Column(String(50), nullable=True)

    court_slots = relationship("CourtSlot", back_populates="time_slot")

    def __repr__(self) -> str:
        return f"<TimeSlot id={self.id} {self.start_time}-{self.end_time}>"


class CourtSlot(Base):
    __tablename__ = "court_slots"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    court_id = Column(BigInteger, ForeignKey("courts.id"), nullable=False)
    time_slot_id = Column(Integer, ForeignKey("time_slots.id"), nullable=False)
    base_price = Column(BigInteger, nullable=False, default=100000)
    is_active = Column(Boolean, default=True, nullable=False)

    court = relationship("Court", back_populates="court_slots")
    time_slot = relationship("TimeSlot", back_populates="court_slots", lazy="joined")

    def __repr__(self) -> str:
        return f"<CourtSlot id={self.id} court_id={self.court_id} time_slot_id={self.time_slot_id} base_price={self.base_price}>"
