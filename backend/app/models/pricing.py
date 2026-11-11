from sqlalchemy import (
    BigInteger,
    Boolean,
    Column,
    Date,
    Enum,
    ForeignKey,
    Integer,
    Numeric,
    SmallInteger,
    String,
    Time,
)
from app.core.database import Base


class Holiday(Base):
    __tablename__ = "holidays"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(255), nullable=False)
    holiday_date = Column(Date, nullable=False, unique=True)
    recurring_yearly = Column(Boolean, default=False, nullable=False)

    def __repr__(self) -> str:
        return f"<Holiday id={self.id} date={self.holiday_date} name={self.name}>"


class PricingRule(Base):
    __tablename__ = "pricing_rules"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(255), nullable=False)
    rule_type = Column(Enum("PEAK_HOUR", "WEEKEND", "HOLIDAY", name="pricing_rule_type"), nullable=False)
    multiplier = Column(Numeric(4, 2), nullable=False)
    applies_to_facility_id = Column(BigInteger, ForeignKey("facilities.id"), nullable=True)
    start_time = Column(Time, nullable=True)
    end_time = Column(Time, nullable=True)
    day_of_week = Column(SmallInteger, nullable=True)
    holiday_id = Column(Integer, ForeignKey("holidays.id"), nullable=True)

    def __repr__(self) -> str:
        return f"<PricingRule id={self.id} type={self.rule_type} x{self.multiplier} facility={self.applies_to_facility_id}>"
