from datetime import date
from typing import List
from pydantic import BaseModel, Field

from app.core.pricing import PricingRuleIn


class PricingRulesReplace(BaseModel):
    rules: List[PricingRuleIn] = Field(..., description="Bộ quy tắc mới, thay thế toàn bộ bộ cũ của cơ sở")


class HolidayCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255, description="Tên ngày lễ")
    holiday_date: date = Field(..., description="Ngày lễ (YYYY-MM-DD), không được trùng ngày đã có")
    recurring_yearly: bool = Field(default=False, description="Lặp lại hằng năm")
