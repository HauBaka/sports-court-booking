# Model khai báo bằng Column() kiểu cũ nên Pylance báo sai khi gán giá trị cho thuộc tính; runtime vẫn đúng.
# pyright: reportAttributeAccessIssue=false
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_facility_for_owner, get_service_for_owner, require_role
from app.core.exceptions import BusinessException
from app.models.facility import Facility, Service
from app.models.user import User
from app.schemas.service import ServiceCreate, ServiceUpdate

router = APIRouter()


def format_service(service: Service) -> dict:
    return {
        "id": service.id,
        "facility_id": service.facility_id,
        "name": service.name,
        "unit_price": service.unit_price,
        "unit": service.unit,
        "is_active": service.is_active,
    }


# ==============================================================================
# 2.11 Tra cứu danh sách dịch vụ đi kèm của cơ sở (Public)
# ==============================================================================
@router.get("/facilities/{id}/services", summary="Tra cứu danh sách dịch vụ đi kèm của cơ sở")
def list_facility_services(
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

    # Danh sách công khai chỉ hiện dịch vụ đang kinh doanh
    services = (
        db.query(Service)
        .filter(Service.facility_id == id, Service.is_active == True)
        .order_by(Service.id.asc())
        .all()
    )

    return {
        "success": True,
        "message": "Lấy danh sách dịch vụ thành công.",
        "data": [format_service(s) for s in services],
    }


# ==============================================================================
# 2.12 Thêm dịch vụ đi kèm mới cho cơ sở (Chủ sân - Owner)
# ==============================================================================
@router.post(
    "/facilities/{id}/services",
    status_code=status.HTTP_201_CREATED,
    summary="Thêm dịch vụ đi kèm mới cho cơ sở thể thao",
)
def create_facility_service(
    id: int,
    body: ServiceCreate,
    current_user: User = Depends(require_role("owner")),
    facility: Facility = Depends(get_facility_for_owner),
    db: Session = Depends(get_db),
):
    try:
        service = Service(
            facility_id=facility.id,
            name=body.name,
            unit_price=body.unit_price,
            unit=body.unit,
            is_active=True,
        )
        db.add(service)
        db.commit()
        db.refresh(service)
    except Exception:
        db.rollback()
        raise

    return {
        "success": True,
        "message": "Thêm dịch vụ đi kèm thành công.",
        "data": format_service(service),
    }


# ==============================================================================
# 2.13 Cập nhật thông tin dịch vụ đi kèm (Chủ sân - Owner)
# ==============================================================================
@router.patch("/services/{service_id}", summary="Cập nhật thông tin dịch vụ đi kèm")
def update_service(
    service_id: int,
    body: ServiceUpdate,
    current_user: User = Depends(require_role("owner")),
    service: Service = Depends(get_service_for_owner),
    db: Session = Depends(get_db),
):
    try:
        if body.name is not None:
            service.name = body.name
        if body.unit_price is not None:
            service.unit_price = body.unit_price
        if body.unit is not None:
            service.unit = body.unit
        if body.is_active is not None:
            service.is_active = body.is_active

        db.commit()
        db.refresh(service)
    except Exception:
        db.rollback()
        raise

    return {
        "success": True,
        "message": "Cập nhật dịch vụ thành công.",
        "data": format_service(service),
    }
