from datetime import date
from decimal import Decimal
from typing import List, Optional
from pydantic import BaseModel, Field


class BookingServiceItem(BaseModel):
    service_id: int
    quantity: int = Field(..., gt=0, description="Số lượng dịch vụ (phải lớn hơn 0)")


class BookingCalculatePriceIn(BaseModel):
    court_id: int = Field(..., description="ID sân con cần tính giá")
    play_date: date = Field(..., description="Ngày chơi (YYYY-MM-DD)")
    time_slot_ids: List[int] = Field(..., min_length=1, description="Danh sách ID các khung giờ chọn đặt (tối thiểu 1 khung)")
    services: Optional[List[BookingServiceItem]] = Field(default=[], description="Danh sách dịch vụ đi kèm")


class SlotBreakdownItemSchema(BaseModel):
    time_slot_id: int
    start_time: str
    end_time: str
    base_price: int
    applied_rule: str
    multiplier: Decimal
    final_price: int


class PricingSummarySchema(BaseModel):
    subtotal: int
    service_total: int
    grand_total_amount: int


class DepositPolicySchema(BaseModel):
    policy_rule: str
    deposit_percentage: int
    deposit_amount_required: int
    remaining_amount_due_at_court: int


class UserWalletStatusSchema(BaseModel):
    current_balance: int
    is_balance_sufficient: bool
    balance_after_deposit: int


class BookingCalculatePriceResponseData(BaseModel):
    court_id: int
    court_name: str
    facility_name: str
    play_date: str
    time_range: str
    slots_breakdown: List[SlotBreakdownItemSchema]
    pricing_summary: PricingSummarySchema
    deposit_policy: DepositPolicySchema
    user_wallet_status: UserWalletStatusSchema
