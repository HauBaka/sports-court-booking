# Model khai báo bằng Column() kiểu cũ nên Pylance báo sai khi gán giá trị cho thuộc tính; runtime vẫn đúng.
# pyright: reportAttributeAccessIssue=false
from datetime import date, datetime, time, timezone
from typing import cast
from fastapi import APIRouter, Depends, status
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.api.deps import get_court_for_owner, get_db, require_role
from app.core.exceptions import BusinessException

from app.models.facility import Court, CourtSlot, Facility, TimeSlot
from app.models.user import User
from app.schemas.court import CourtUpdate

router = APIRouter()


def format_time(t) -> str:
    if isinstance(t, str):
        return t
    return t.strftime("%H:%M:%S")


def format_court(court: Court) -> dict:
    return {
        "id": court.id,
        "facility_id": court.facility_id,
        "name": court.name,
        "sport_id": court.sport_id,
        "court_type": court.court_type,
        "environment": court.environment,
        "open_time": format_time(court.open_time),
        "close_time": format_time(court.close_time),
        "is_active": court.is_active,
    }


# ==============================================================================
# 2.6 Xem chi tiết một sân con cụ thể (Public)
# ==============================================================================
@router.get("/courts/{court_id}", summary="Xem chi tiết một sân con cụ thể")
def get_court_detail(
    court_id: int,
    db: Session = Depends(get_db),
):
    court = db.query(Court).filter(Court.id == court_id).first()
    if not court:
        raise BusinessException(
            status_code=status.HTTP_404_NOT_FOUND,
            code="COURT_NOT_FOUND",
            message=f"Sân con với ID {court_id} không tồn tại.",
        )

    return {
        "success": True,
        "message": "Lấy chi tiết sân con thành công.",
        "data": format_court(court),
    }


