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
    sport_id = Column(Integer, nullable=False, default=1)
    name = Column(String(255), nullable=False)
    court_type = Column(String(50), nullable=True)
    environment = Column(String(20), nullable=False, default="INDOOR")
    open_time = Column(Time, nullable=False)
    close_time = Column(Time, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)

    facility = relationship("Facility", back_populates="courts", lazy="joined")

    def __repr__(self) -> str:
        return f"<Court id={self.id} name={self.name} facility_id={self.facility_id}>"

