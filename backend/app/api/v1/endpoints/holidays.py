from fastapi import APIRouter, Depends, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db, require_role
from app.core.exceptions import BusinessException
from app.models.pricing import Holiday
from app.models.user import User
from app.schemas.pricing import HolidayCreate

router = APIRouter()


def format_holiday(holiday: Holiday) -> dict:
    return {
        "id": holiday.id,
        "name": holiday.name,
        "holiday_date": holiday.holiday_date.isoformat(),
        "recurring_yearly": bool(holiday.recurring_yearly),
    }


# ==============================================================================
# 2.9 Danh sách ngày lễ (mọi người dùng đã đăng nhập)
# ==============================================================================
@router.get("/holidays", summary="Lấy danh sách ngày lễ")
def list_holidays(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    holidays = db.query(Holiday).order_by(Holiday.holiday_date.asc()).all()
    return {
        "success": True,
        "message": "Lấy danh mục ngày lễ thành công.",
        "data": [format_holiday(h) for h in holidays],
    }


# ==============================================================================
# 2.10 Thêm ngày lễ (chỉ Admin)
# ==============================================================================
@router.post("/admin/holidays", status_code=status.HTTP_201_CREATED, summary="Thêm ngày lễ mới")
def create_holiday(
    body: HolidayCreate,
    current_user: User = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    conflict = BusinessException(
        status_code=status.HTTP_409_CONFLICT,
        code="HOLIDAY_DATE_EXISTS",
        message=f"Ngày {body.holiday_date.isoformat()} đã có trong danh sách ngày lễ.",
    )

    if db.query(Holiday.id).filter(Holiday.holiday_date == body.holiday_date).first():
        raise conflict

    holiday = Holiday(
        name=body.name,
        holiday_date=body.holiday_date,
        recurring_yearly=body.recurring_yearly,
    )
    db.add(holiday)
    try:
        db.commit()
    except IntegrityError:
        # Hai request cùng ngày chạy song song: UNIQUE của DB là chốt chặn cuối cùng
        db.rollback()
        raise conflict
    db.refresh(holiday)

    return {
        "success": True,
        "message": "Thêm ngày lễ mới thành công.",
        "data": format_holiday(holiday),
    }
