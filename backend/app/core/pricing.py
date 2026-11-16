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


def resolve_applied_rule_name(
    play_date:   date,
    play_time:   time,
    rules:       list[PricingRuleIn],
    holiday_ids: set[int] | None = None,
) -> tuple[Decimal, str]:
    """
    Trả về (multiplier, rule_name).
    Nếu không có quy tắc nào khớp hoặc multiplier == 1.00: trả về (Decimal("1.00"), "Giá giờ thường").
    Nếu có quy tắc khớp: trả về hệ số cao nhất và tên của quy tắc đó.
    """
    if holiday_ids is None:
        holiday_ids = set()

    best_mult = Decimal("1.00")
    best_name = "Giá giờ thường"

    for rule in rules:
        matched = False
        if rule.rule_type == RuleType.PEAK_HOUR:
            # GIA-06: Khung bắt đầu đúng giờ kết thúc cao điểm thì không tính cao điểm (start_time <= play_time < end_time)
            matched = rule.start_time <= play_time < rule.end_time  # type: ignore[operator]
        elif rule.rule_type == RuleType.WEEKEND:
            matched = play_date.isoweekday() == rule.day_of_week
        elif rule.rule_type == RuleType.HOLIDAY:
            matched = rule.holiday_id in holiday_ids

        if matched and rule.multiplier > best_mult:
            best_mult = rule.multiplier
            best_name = rule.name

    return best_mult, best_name


def resolve_multiplier(
    play_date:   date,
    play_time:   time,
    rules:       list[PricingRuleIn],
    holiday_ids: set[int] | None = None,
) -> Decimal:
    """Trả hệ số cao nhất trong các quy tắc khớp. Mặc định 1.00 nếu không có."""
    mult, _ = resolve_applied_rule_name(play_date, play_time, rules, holiday_ids)
    return mult


class SlotPricingInput(BaseModel):
    time_slot_id: int
    start_time: time
    end_time: time
    base_price: int


class ServicePricingInput(BaseModel):
    service_id: int
    name: str = ""
    unit_price: int
    quantity: int = Field(..., gt=0)


class SlotBreakdownItem(BaseModel):
    time_slot_id: int
    start_time: str
    end_time: str
    base_price: int
    applied_rule: str
    multiplier: Decimal
    final_price: int


class OrderPricingResult(BaseModel):
    slots_breakdown: list[SlotBreakdownItem]
    subtotal: int
    service_total: int
    grand_total_amount: int
    deposit_percentage: int = 30
    deposit_amount_required: int
    remaining_amount_due_at_court: int
    time_range: str


def calculate_booking_price(
    play_date:   date,
    slots:       list[SlotPricingInput],
    rules:       list[PricingRuleIn],
    holiday_ids: set[int] | None = None,
    services:    list[ServicePricingInput] | None = None,
) -> OrderPricingResult:
    """
    Hàm tính tiền đơn dùng chung (SCB-140).
    Nhận ngày, danh sách khung giờ, danh mục quy tắc giá, ngày lễ, và danh sách dịch vụ.
    Trả từng khung (giá cơ sở, hệ số, thành tiền, quy tắc áp dụng), tổng tiền, cọc 30%, còn lại.

    Quy tắc tuân thủ:
    - GIA-05: Đơn nhiều khung tính hệ số riêng từng khung; tổng tiền bằng tổng các khung.
    - GIA-06: Khung bắt đầu đúng giờ kết thúc cao điểm thì không tính cao điểm.
    - GIA-10: Giá cơ sở và đơn giá dịch vụ do server quản lý, không dùng số tiền từ client.
    - QĐ4: Bắt buộc đặt cọc 30% tổng tiền qua ví nội bộ (làm tròn số nguyên VNĐ).
    """
    if holiday_ids is None:
        holiday_ids = set()
    if services is None:
        services = []

    # Sắp xếp các khung giờ theo thứ tự thời gian bắt đầu tăng dần
    sorted_slots = sorted(slots, key=lambda s: s.start_time)

    slots_breakdown: list[SlotBreakdownItem] = []
    subtotal = 0

    for s in sorted_slots:
        mult, rule_name = resolve_applied_rule_name(play_date, s.start_time, rules, holiday_ids)
        final_price = round(s.base_price * mult)
        subtotal += final_price

        slots_breakdown.append(
            SlotBreakdownItem(
                time_slot_id=s.time_slot_id,
                start_time=s.start_time.strftime("%H:%M:%S"),
                end_time=s.end_time.strftime("%H:%M:%S"),
                base_price=s.base_price,
                applied_rule=rule_name,
                multiplier=mult,
                final_price=final_price,
            )
        )

    # Tính tiền dịch vụ
    service_total = sum(svc.unit_price * svc.quantity for svc in services)

    # Tổng tiền đơn
    grand_total_amount = subtotal + service_total

    # Tiền cọc 30% (QĐ4)
    deposit_percentage = 30
    deposit_amount_required = round(grand_total_amount * deposit_percentage / 100)
    remaining_amount_due_at_court = grand_total_amount - deposit_amount_required

    # Chuỗi hiển thị khoảng thời gian
    if sorted_slots:
        first_start = sorted_slots[0].start_time.strftime("%H:%M")
        last_end = sorted_slots[-1].end_time.strftime("%H:%M")
        time_range = f"{first_start} - {last_end} ({len(sorted_slots)} khung giờ)"
    else:
        time_range = ""

    return OrderPricingResult(
        slots_breakdown=slots_breakdown,
        subtotal=subtotal,
        service_total=service_total,
        grand_total_amount=grand_total_amount,
        deposit_percentage=deposit_percentage,
        deposit_amount_required=deposit_amount_required,
        remaining_amount_due_at_court=remaining_amount_due_at_court,
        time_range=time_range,
    )
