from fastapi import APIRouter, Depends, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_facility_for_owner, require_role
from app.core.exceptions import BusinessException
from app.models.facility import Facility
from app.models.pricing import Holiday, PricingRule
from app.models.user import User
from app.schemas.pricing import PricingRulesReplace

router = APIRouter()


# ==============================================================================
# 2.8b Xem bộ quy tắc giá hiện tại của cơ sở (Chủ sân - Owner)
# ==============================================================================
@router.get(
    "/facilities/{id}/pricing-rules",
    status_code=status.HTTP_200_OK,
    summary="Xem bộ quy tắc giá hiện tại của cơ sở",
)
def get_pricing_rules(
    current_user: User = Depends(require_role("owner")),
    facility: Facility = Depends(get_facility_for_owner),
    db: Session = Depends(get_db),
):
    rows = (
        db.query(PricingRule)
        .filter(PricingRule.applies_to_facility_id == facility.id)
        .order_by(PricingRule.id.asc())
        .all()
    )
    return {
        "success": True,
        "message": "Lấy bảng giá theo thời điểm thành công.",
        "data": {
            "facility_id": facility.id,
            "rules": [
                {
                    "id": r.id,
                    "name": r.name,
                    "rule_type": r.rule_type,
                    "multiplier": float(r.multiplier),
                    "start_time": r.start_time.strftime("%H:%M:%S") if r.start_time else None,
                    "end_time": r.end_time.strftime("%H:%M:%S") if r.end_time else None,
                    "day_of_week": r.day_of_week,
                    "holiday_id": r.holiday_id,
                }
                for r in rows
            ],
        },
    }


# ==============================================================================
# 2.8 Thay thế bộ quy tắc giá của cơ sở (Chủ sân - Owner)
# ==============================================================================
@router.post(
    "/facilities/{id}/pricing-rules",
    status_code=status.HTTP_200_OK,
    summary="Thay thế toàn bộ bộ quy tắc giá của cơ sở",
)
def replace_pricing_rules(
    body: PricingRulesReplace,
    current_user: User = Depends(require_role("owner")),
    facility: Facility = Depends(get_facility_for_owner),
    db: Session = Depends(get_db),
):
    # Pydantic đã kiểm tra cả bộ trước khi vào hàm: một quy tắc sai thì cả bộ bị 422, chưa đụng DB.
    holiday_ids = {r.holiday_id for r in body.rules if r.holiday_id is not None}
    if holiday_ids:
        found = {row[0] for row in db.query(Holiday.id).filter(Holiday.id.in_(holiday_ids)).all()}
        missing = sorted(holiday_ids - found)
        if missing:
            raise BusinessException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                code="VALIDATION_ERROR",
                message="Có quy tắc trỏ tới ngày lễ không tồn tại.",
                details=[{"field": "rules", "issue": f"holiday_id {missing} không tồn tại."}],
            )

    try:
        db.query(PricingRule).filter(
            PricingRule.applies_to_facility_id == facility.id
        ).delete(synchronize_session=False)

        db.add_all(
            [
                PricingRule(
                    name=r.name,
                    rule_type=r.rule_type.value,
                    multiplier=r.multiplier,
                    applies_to_facility_id=facility.id,
                    start_time=r.start_time,
                    end_time=r.end_time,
                    day_of_week=r.day_of_week,
                    holiday_id=r.holiday_id,
                )
                for r in body.rules
            ]
        )
        db.commit()
    except Exception:
        db.rollback()
        raise

    total_rules_active = (
        db.query(func.count(PricingRule.id))
        .filter(PricingRule.applies_to_facility_id == facility.id)
        .scalar()
    )

    return {
        "success": True,
        "message": "Cấu hình bảng giá theo thời điểm thành công.",
        "data": {"facility_id": facility.id, "total_rules_active": total_rules_active},
    }
