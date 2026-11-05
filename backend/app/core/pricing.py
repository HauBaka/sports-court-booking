from __future__ import annotations

from datetime import date, time
from decimal import Decimal
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field, model_validator


class RuleType(str, Enum):
    PEAK_HOUR = "PEAK_HOUR"
    WEEKEND   = "WEEKEND"
    HOLIDAY   = "HOLIDAY"


class PricingRuleIn(BaseModel):
    name:                   str
    rule_type:              RuleType
    multiplier:             Decimal = Field(..., ge=Decimal("1.20"), le=Decimal("1.50"))
    applies_to_facility_id: Optional[int] = None
    start_time:             Optional[time] = None
    end_time:               Optional[time] = None
    day_of_week:            Optional[int]  = Field(None, ge=1, le=7)  # isoweekday: 1=Mon, 7=Sun
    holiday_id:             Optional[int]  = None

    @model_validator(mode="after")
    def check_rule_shape(self) -> "PricingRuleIn":
        rt = self.rule_type
        if rt == RuleType.PEAK_HOUR:
            if self.start_time is None or self.end_time is None:
                raise ValueError("PEAK_HOUR cần start_time và end_time")
            if self.start_time >= self.end_time:
                raise ValueError("start_time phải trước end_time")
            if self.day_of_week is not None or self.holiday_id is not None:
                raise ValueError("PEAK_HOUR không được có day_of_week/holiday_id")
        elif rt == RuleType.WEEKEND:
            if self.day_of_week is None:
                raise ValueError("WEEKEND cần day_of_week")
            if self.start_time is not None or self.end_time is not None or self.holiday_id is not None:
                raise ValueError("WEEKEND không được có start_time/end_time/holiday_id")
        elif rt == RuleType.HOLIDAY:
            if self.holiday_id is None:
                raise ValueError("HOLIDAY cần holiday_id")
            if self.start_time is not None or self.end_time is not None or self.day_of_week is not None:
                raise ValueError("HOLIDAY không được có start_time/end_time/day_of_week")
        return self


def resolve_multiplier(
    play_date:   date,
    play_time:   time,
    rules:       list[PricingRuleIn],
    holiday_ids: set[int] | None = None,
) -> Decimal:
    """Trả hệ số cao nhất trong các quy tắc khớp. Mặc định 1.00 nếu không có."""
    if holiday_ids is None:
        holiday_ids = set()

    best = Decimal("1.00")
    for rule in rules:
        matched = False
        if rule.rule_type == RuleType.PEAK_HOUR:
            matched = rule.start_time <= play_time < rule.end_time  # type: ignore[operator]
        elif rule.rule_type == RuleType.WEEKEND:
            matched = play_date.isoweekday() == rule.day_of_week
        elif rule.rule_type == RuleType.HOLIDAY:
            matched = rule.holiday_id in holiday_ids
        if matched and rule.multiplier > best:
            best = rule.multiplier
    return best
