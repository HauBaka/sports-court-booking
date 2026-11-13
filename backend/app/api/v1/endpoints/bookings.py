# pyright: reportAttributeAccessIssue=false
from decimal import Decimal
from typing import cast
from fastapi import APIRouter, Depends, status
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.core.exceptions import BusinessException
from app.core.pricing import (
    PricingRuleIn,
    RuleType,
    ServicePricingInput,
    SlotPricingInput,
    calculate_booking_price,
)
from app.models.facility import Court, CourtSlot, Service, TimeSlot
from app.models.pricing import Holiday, PricingRule
from app.models.user import User
from app.models.wallet import Wallet
from app.schemas.booking import BookingCalculatePriceIn

router = APIRouter()


# ==============================================================================
# 3.2 Xem trước tính tiền đặt sân và tiền cọc (Frontend Zero-Math)
# ==============================================================================
@router.post("/bookings/calculate-price", summary="Xem trước tính tiền đặt sân và tiền cọc")
def calculate_booking_price_preview(
    body: BookingCalculatePriceIn,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # 1. Kiểm tra sân con tồn tại và đang hoạt động
    court = db.query(Court).filter(Court.id == body.court_id).first()
    if not court or not cast(bool, court.is_active) or not (court.facility and cast(bool, court.facility.is_active)):
        raise BusinessException(
            status_code=status.HTTP_404_NOT_FOUND,
            code="COURT_NOT_FOUND",
            message=f"Sân con với ID {body.court_id} không tồn tại hoặc đã tạm dừng hoạt động.",
        )

    # 2. Kiểm tra khung giờ: Khung không thuộc sân trả 422 (Yêu cầu SCB-142)
    court_slots = (
        db.query(CourtSlot)
        .join(TimeSlot, TimeSlot.id == CourtSlot.time_slot_id)
        .filter(
            CourtSlot.court_id == body.court_id,
            CourtSlot.time_slot_id.in_(body.time_slot_ids),
            CourtSlot.is_active == True,
        )
        .all()
    )
    found_ts_ids = {cs.time_slot_id for cs in court_slots}
    invalid_ts_ids = [ts_id for ts_id in body.time_slot_ids if ts_id not in found_ts_ids]
    if invalid_ts_ids:
        raise BusinessException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            code="VALIDATION_ERROR",
            message=f"Khung giờ với ID {invalid_ts_ids} không thuộc sân hoặc đang không hoạt động.",
            details=[
                {
                    "field": "time_slot_ids",
                    "issue": f"Khung giờ với ID {invalid_ts_ids} không thuộc sân {body.court_id}.",
                }
            ],
        )

    # 3. Kiểm tra dịch vụ đi kèm (nếu có): dịch vụ phải thuộc cùng cơ sở và đang hoạt động
    service_inputs: list[ServicePricingInput] = []
    if body.services:
        svc_ids = [s.service_id for s in body.services]
        services_db = (
            db.query(Service)
            .filter(
                Service.id.in_(svc_ids),
                Service.facility_id == court.facility_id,
                Service.is_active == True,
            )
            .all()
        )
        services_map = {s.id: s for s in services_db}
        invalid_svc_ids = [sid for sid in svc_ids if sid not in services_map]
        if invalid_svc_ids:
            raise BusinessException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                code="VALIDATION_ERROR",
                message=f"Dịch vụ với ID {invalid_svc_ids} không thuộc cơ sở hoặc đã ngừng cung cấp.",
                details=[
                    {
                        "field": "services",
                        "issue": f"Dịch vụ với ID {invalid_svc_ids} không thuộc cơ sở của sân này.",
                    }
                ],
            )

        for s_in in body.services:
            svc_entity = services_map[s_in.service_id]
            service_inputs.append(
                ServicePricingInput(
                    service_id=svc_entity.id,
                    name=svc_entity.name,
                    unit_price=int(cast(int, svc_entity.unit_price)),
                    quantity=s_in.quantity,
                )
            )

    # 4. Lấy quy tắc định giá (Pricing Rules) áp dụng cho cơ sở hoặc toàn hệ thống
    rules_db = (
        db.query(PricingRule)
        .filter(
            or_(
                PricingRule.applies_to_facility_id == court.facility_id,
                PricingRule.applies_to_facility_id.is_(None),
            )
        )
        .all()
    )
    pricing_rules: list[PricingRuleIn] = [
        PricingRuleIn(
            name=r.name,
            rule_type=RuleType(r.rule_type),
            multiplier=Decimal(str(r.multiplier)),
            applies_to_facility_id=r.applies_to_facility_id,
            start_time=r.start_time,
            end_time=r.end_time,
            day_of_week=r.day_of_week,
            holiday_id=r.holiday_id,
        )
        for r in rules_db
    ]

    # 5. Lấy danh sách ngày lễ (Holidays) khớp với play_date
    holidays_db = db.query(Holiday).all()
    holiday_ids: set[int] = set()
    for h in holidays_db:
        if h.holiday_date == body.play_date:
            holiday_ids.add(h.id)
        elif cast(bool, h.recurring_yearly) and (
            h.holiday_date.month == body.play_date.month and h.holiday_date.day == body.play_date.day
        ):
            holiday_ids.add(h.id)

    # 6. Chuẩn bị SlotPricingInput
    slot_inputs: list[SlotPricingInput] = [
        SlotPricingInput(
            time_slot_id=cs.time_slot_id,
            start_time=cs.time_slot.start_time,
            end_time=cs.time_slot.end_time,
            base_price=int(cast(int, cs.base_price)),
        )
        for cs in court_slots
    ]

    # 7. Gọi hàm tính tiền đơn dùng chung (SCB-140)
    result = calculate_booking_price(
        play_date=body.play_date,
        slots=slot_inputs,
        rules=pricing_rules,
        holiday_ids=holiday_ids,
        services=service_inputs,
    )

    # 8. Lấy số dư ví người dùng để kiểm tra điều kiện đặt cọc
    wallet = db.query(Wallet).filter(Wallet.user_id == current_user.id).first()
    current_balance = int(cast(int, wallet.balance)) if wallet else 0
    is_balance_sufficient = current_balance >= result.deposit_amount_required
    balance_after_deposit = (
        current_balance - result.deposit_amount_required
        if is_balance_sufficient
        else current_balance
    )

    facility_name = court.facility.name if court.facility else ""

    return {
        "success": True,
        "message": "Tính toán tiền đặt sân thành công.",
        "data": {
            "court_id": court.id,
            "court_name": court.name,
            "facility_name": facility_name,
            "play_date": body.play_date.strftime("%Y-%m-%d"),
            "time_range": result.time_range,
            "slots_breakdown": [
                {
                    "time_slot_id": sb.time_slot_id,
                    "start_time": sb.start_time,
                    "end_time": sb.end_time,
                    "base_price": sb.base_price,
                    "applied_rule": sb.applied_rule,
                    "multiplier": float(sb.multiplier),
                    "final_price": sb.final_price,
                }
                for sb in result.slots_breakdown
            ],
            "pricing_summary": {
                "subtotal": result.subtotal,
                "service_total": result.service_total,
                "grand_total_amount": result.grand_total_amount,
            },
            "deposit_policy": {
                "policy_rule": "QĐ4 - Bắt buộc đặt cọc 30% tổng tiền qua ví nội bộ",
                "deposit_percentage": result.deposit_percentage,
                "deposit_amount_required": result.deposit_amount_required,
                "remaining_amount_due_at_court": result.remaining_amount_due_at_court,
            },
            "user_wallet_status": {
                "current_balance": current_balance,
                "is_balance_sufficient": is_balance_sufficient,
                "balance_after_deposit": balance_after_deposit,
            },
        },
    }
