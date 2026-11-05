import math
from datetime import time
from typing import Any, Optional, cast
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy import and_, func, or_
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db, get_facility_for_owner, require_role
from app.core.exceptions import BusinessException
from app.models.facility import Court, CourtSlot, Facility, Sport, TimeSlot
from app.models.user import User
from app.schemas.court import CourtCreate
from app.schemas.facility import FacilityCreate

router = APIRouter()


def to_float(value: Any) -> Optional[float]:
    return float(value) if value is not None else None


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


def format_facility(facility: Facility, min_price: Optional[int] = 0, max_price: Optional[int] = 0, total_courts: int = 0) -> dict:
    return {
        "id": facility.id,
        "name": facility.name,
        "owner_id": facility.owner_id,
        "address": facility.address,
        "city": facility.city,
        "district": facility.district,
        "latitude": to_float(facility.latitude),
        "longitude": to_float(facility.longitude),
        "open_time": format_time(facility.open_time),
        "close_time": format_time(facility.close_time),
        "is_active": facility.is_active,
        "min_price": min_price,
        "max_price": max_price,
        "total_courts": total_courts,
    }


# ==============================================================================
# 2.1 Tra cứu danh sách cơ sở thể thao (Public)
# ==============================================================================
@router.get("/facilities", summary="Tra cứu danh sách cơ sở thể thao")
def list_facilities(
    sport_id: Optional[int] = Query(None, description="Lọc theo ID môn thể thao"),
    city: Optional[str] = Query(None, description="Lọc theo tỉnh/thành phố"),
    search: Optional[str] = Query(None, description="Tìm kiếm theo tên cơ sở hoặc địa chỉ"),
    page: int = Query(1, ge=1, description="Trang hiện tại (1-indexed)"),
    limit: int = Query(10, ge=1, le=100, description="Số lượng trên một trang"),
    db: Session = Depends(get_db),
):
    query = db.query(Facility).filter(Facility.is_active == True)

    if sport_id is not None:
        query = query.filter(
            Facility.courts.any(
                and_(Court.sport_id == sport_id, Court.is_active == True)
            )
        )

    if city and city.strip():
        query = query.filter(Facility.city.ilike(f"%{city.strip()}%"))

    if search and search.strip():
        term = f"%{search.strip()}%"
        query = query.filter(
            or_(
                Facility.name.ilike(term),
                Facility.address.ilike(term),
            )
        )

    total = query.count()
    total_pages = math.ceil(total / limit) if total > 0 else 0
    offset = (page - 1) * limit
    facilities = query.order_by(Facility.id.asc()).offset(offset).limit(limit).all()

    # Gộp tính giá và số sân của cả trang bằng 2 query GROUP BY thay vì 2 query cho mỗi cơ sở
    facility_ids = [f.id for f in facilities]
    price_map = {}
    count_map = {}
    if facility_ids:
        price_rows = (
            db.query(
                Court.facility_id,
                func.min(CourtSlot.base_price),
                func.max(CourtSlot.base_price),
            )
            .join(CourtSlot, CourtSlot.court_id == Court.id)
            .filter(
                Court.facility_id.in_(facility_ids),
                Court.is_active == True,
                CourtSlot.is_active == True,
            )
            .group_by(Court.facility_id)
            .all()
        )
        price_map = {row[0]: (row[1], row[2]) for row in price_rows}

        count_rows = (
            db.query(Court.facility_id, func.count(Court.id))
            .filter(Court.facility_id.in_(facility_ids), Court.is_active == True)
            .group_by(Court.facility_id)
            .all()
        )
        count_map = {row[0]: row[1] for row in count_rows}

    data = []
    for f in facilities:
        min_p, max_p = price_map.get(f.id, (0, 0))
        data.append(
            format_facility(
                f,
                min_price=int(min_p or 0),
                max_price=int(max_p or 0),
                total_courts=count_map.get(f.id, 0),
            )
        )

    return {
        "success": True,
        "message": "Lấy danh sách cơ sở thể thao thành công.",
        "data": data,
        "meta": {
            "page": page,
            "limit": limit,
            "total": total,
            "total_pages": total_pages,
        },
    }


# ==============================================================================
# 2.2 Xem chi tiết cơ sở thể thao và danh sách sân con (Public)
# ==============================================================================
@router.get("/facilities/{id}", summary="Xem chi tiết cơ sở thể thao và danh sách sân con")
def get_facility_detail(
    id: int,
    db: Session = Depends(get_db),
):
    facility = db.query(Facility).filter(Facility.id == id, Facility.is_active == True).first()
    if not facility:
        raise BusinessException(
            status_code=status.HTTP_404_NOT_FOUND,
            code="FACILITY_NOT_FOUND",
            message=f"Cơ sở thể thao với ID {id} không tồn tại hoặc đã ngưng hoạt động.",
        )

    # Lấy danh sách sân con đang hoạt động
    courts = (
        db.query(Court)
        .filter(Court.facility_id == facility.id, Court.is_active == True)
        .order_by(Court.id.asc())
        .all()
    )

    data = {
        "id": facility.id,
        "name": facility.name,
        "owner_id": facility.owner_id,
        "address": facility.address,
        "city": facility.city,
        "district": facility.district,
        "latitude": to_float(facility.latitude),
        "longitude": to_float(facility.longitude),
        "open_time": format_time(facility.open_time),
        "close_time": format_time(facility.close_time),
        "description": facility.description,
        "is_active": facility.is_active,
        "courts": [format_court(c) for c in courts],
    }

    return {
        "success": True,
        "message": "Lấy chi tiết cơ sở thành công.",
        "data": data,
    }


# ==============================================================================
# 2.3 Tạo cơ sở thể thao mới (Chủ sân - Owner)
# ==============================================================================
@router.post("/facilities", status_code=status.HTTP_201_CREATED, summary="Tạo cơ sở thể thao mới")
def create_facility(
    body: FacilityCreate,
    current_user: User = Depends(require_role("owner")),
    db: Session = Depends(get_db),
):
    facility = Facility(
        owner_id=current_user.id,
        name=body.name,
        address=body.address,
        city=body.city,
        district=body.district,
        latitude=body.latitude,
        longitude=body.longitude,
        open_time=body.open_time,
        close_time=body.close_time,
        description=body.description,
        is_active=True,
    )

    db.add(facility)
    db.commit()
    db.refresh(facility)

    data = {
        "id": facility.id,
        "name": facility.name,
        "owner_id": facility.owner_id,
        "address": facility.address,
        "city": facility.city,
        "district": facility.district,
        "latitude": to_float(facility.latitude),
        "longitude": to_float(facility.longitude),
        "open_time": format_time(facility.open_time),
        "close_time": format_time(facility.close_time),
        "description": facility.description,
        "is_active": facility.is_active,
    }

    return {
        "success": True,
        "message": "Tạo cơ sở thể thao thành công.",
        "data": data,
    }


# ==============================================================================
# 2.4 Lấy danh sách sân con của một cơ sở (Public)
# ==============================================================================
@router.get("/facilities/{id}/courts", summary="Lấy danh sách sân con của một cơ sở")
def list_facility_courts(
    id: int,
    db: Session = Depends(get_db),
):
    facility = db.query(Facility).filter(Facility.id == id, Facility.is_active == True).first()
    if not facility:
        raise BusinessException(
            status_code=status.HTTP_404_NOT_FOUND,
            code="FACILITY_NOT_FOUND",
            message=f"Cơ sở thể thao với ID {id} không tồn tại hoặc đã ngưng hoạt động.",
        )

    courts = (
        db.query(Court)
        .filter(Court.facility_id == id, Court.is_active == True)
        .order_by(Court.id.asc())
        .all()
    )

    return {
        "success": True,
        "message": "Lấy danh sách sân con thành công.",
        "data": [format_court(c) for c in courts],
    }


# ==============================================================================
# 2.5 Tạo sân con mới thuộc cơ sở thể thao (Chủ sân - Owner)
# ==============================================================================
@router.post(
    "/facilities/{id}/courts",
    status_code=status.HTTP_201_CREATED,
    summary="Tạo sân con mới thuộc cơ sở thể thao",
)
def create_court_for_facility(
    id: int,
    body: CourtCreate,
    current_user: User = Depends(require_role("owner")),
    facility: Facility = Depends(get_facility_for_owner),
    db: Session = Depends(get_db),
):
    # Kiểm tra giờ hoạt động của sân con phải nằm trong giờ mở cửa của cơ sở
    facility_open = cast(time, facility.open_time)
    facility_close = cast(time, facility.close_time)
    if body.open_time < facility_open or body.close_time > facility_close:
        raise BusinessException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            code="VALIDATION_ERROR",
            message="Giờ hoạt động của sân con phải nằm trong giờ mở cửa của cơ sở thể thao.",
            details=[
                {
                    "field": "open_time",
                    "issue": f"Giờ mở cửa và đóng cửa phải nằm trong khoảng {facility_open} - {facility_close}.",
                }
            ],
        )

    if not db.query(Sport.id).filter(Sport.id == body.sport_id).first():
        raise BusinessException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            code="VALIDATION_ERROR",
            message="Môn thể thao không tồn tại.",
            details=[{"field": "sport_id", "issue": f"sport_id {body.sport_id} không tồn tại."}],
        )

    try:
        court = Court(
            facility_id=facility.id,
            sport_id=body.sport_id,
            name=body.name,
            court_type=body.court_type,
            environment=body.environment,
            open_time=body.open_time,
            close_time=body.close_time,
            is_active=True,
        )
        db.add(court)
        db.flush()  # Sinh court.id nhưng chưa commit

        # Lấy tất cả khung giờ trong hệ thống nằm trong [open_time, close_time]
        matching_slots = (
            db.query(TimeSlot)
            .filter(
                TimeSlot.start_time >= court.open_time,
                TimeSlot.end_time <= court.close_time,
            )
            .order_by(TimeSlot.start_time.asc())
            .all()
        )

        # Không có khung giờ nào nằm trọn trong [open_time, close_time] thì sân không thể đặt được
        if not matching_slots:
            raise BusinessException(
                status_code=status.HTTP_400_BAD_REQUEST,
                code="TIME_SLOT_INVALID",
                message="Giờ hoạt động không chứa khung giờ nào hợp lệ. Vui lòng chọn giờ khớp với các khung giờ của hệ thống.",
            )

        for slot in matching_slots:
            court_slot = CourtSlot(
                court_id=court.id,
                time_slot_id=slot.id,
                base_price=body.default_base_price,
                is_active=True,
            )
            db.add(court_slot)

        db.commit()
        db.refresh(court)

        return {
            "success": True,
            "message": "Tạo sân con thành công.",
            "data": format_court(court),
        }
    except Exception:
        db.rollback()
        raise
