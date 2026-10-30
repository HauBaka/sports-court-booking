# Model khai báo bằng Column() kiểu cũ nên Pylance báo sai khi gán giá trị cho thuộc tính; runtime vẫn đúng.
# pyright: reportAttributeAccessIssue=false
from datetime import date, datetime, time, timezone
from typing import cast
from fastapi import APIRouter, Depends, status
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.api.deps import get_court_for_owner, get_db, require_role
from app.core.exceptions import BusinessException
from app.models.booking import Booking, BookingSlot
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
    # Sân thuộc cơ sở đã ngưng hoạt động thì không công khai
    if not court or not (court.facility and court.facility.is_active):
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


# ==============================================================================
# 2.7 Cập nhật thông tin sân con (Chủ sân - Owner)
# ==============================================================================
@router.patch("/courts/{court_id}", summary="Cập nhật thông tin sân con")
def update_court(
    court_id: int,
    body: CourtUpdate,
    current_user: User = Depends(require_role("owner")),
    court: Court = Depends(get_court_for_owner),
    db: Session = Depends(get_db),
):
    cur_open = cast(time, court.open_time)
    cur_close = cast(time, court.close_time)
    new_open = body.open_time if body.open_time is not None else cur_open
    new_close = body.close_time if body.close_time is not None else cur_close
    schedule_changed = new_open != cur_open or new_close != cur_close

    # Chỉ kiểm tra khoảng giờ khi có đổi giờ, để PATCH tên/trạng thái không bị chặn bởi dữ liệu cũ
    if schedule_changed:
        if new_open >= new_close:
            raise BusinessException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                code="VALIDATION_ERROR",
                message="Giờ mở cửa (open_time) phải trước giờ đóng cửa (close_time).",
            )

        facility = court.facility or db.query(Facility).filter(Facility.id == court.facility_id).first()
        if facility:
            if new_open < cast(time, facility.open_time) or new_close > cast(time, facility.close_time):
                raise BusinessException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    code="VALIDATION_ERROR",
                    message="Giờ sân con phải nằm trong giờ mở cửa của cụm sân.",
                )

    today = date.today()

    try:
        # 1. Xử lý khi cập nhật giờ hoạt động
        if schedule_changed:
            # Kiểm tra xem có đơn DEPOSITED nào trong tương lai ở khung giờ bị cắt ngoài khoảng [new_open, new_close]
            conflict_booking = (
                db.query(Booking)
                .join(BookingSlot, BookingSlot.booking_id == Booking.id)
                .join(TimeSlot, TimeSlot.id == BookingSlot.time_slot_id)
                .filter(
                    Booking.court_id == court.id,
                    Booking.status == "DEPOSITED",
                    Booking.play_date >= today,
                    BookingSlot.released_at.is_(None),
                    or_(
                        TimeSlot.start_time < new_open,
                        TimeSlot.end_time > new_close,
                    ),
                )
                .first()
            )

            if conflict_booking:
                raise BusinessException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    code="CANNOT_UPDATE_COURT_SCHEDULE_ACTIVE_BOOKINGS",
                    message="Không thể thay đổi giờ hoạt động vì có lịch đặt cọc trong tương lai ở khung giờ bị cắt.",
                )

            # Cập nhật giờ hoạt động của sân con
            court.open_time = new_open
            court.close_time = new_close

            # Đồng bộ court_slots
            existing_slots = db.query(CourtSlot).filter(CourtSlot.court_id == court.id).all()
            existing_map = {cs.time_slot_id: cs for cs in existing_slots}

            all_time_slots = db.query(TimeSlot).all()
            default_price = int(cast(int, existing_slots[0].base_price)) if existing_slots else 100000

            for ts in all_time_slots:
                in_range = cast(time, ts.start_time) >= new_open and cast(time, ts.end_time) <= new_close
                if ts.id in existing_map:
                    existing_map[ts.id].is_active = in_range
                elif in_range:
                    new_cs = CourtSlot(
                        court_id=court.id,
                        time_slot_id=ts.id,
                        base_price=default_price,
                        is_active=True,
                    )
                    db.add(new_cs)

        # 2. Xử lý khi tạm ngưng hoạt động sân (is_active = false)
        if body.is_active is False and court.is_active is True:
            # Kiểm tra nếu đang có đơn DEPOSITED trong tương lai
            has_deposited = (
                db.query(Booking)
                .filter(
                    Booking.court_id == court.id,
                    Booking.status == "DEPOSITED",
                    Booking.play_date >= today,
                )
                .first()
            )

            if has_deposited:
                raise BusinessException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    code="CANNOT_DEACTIVATE_COURT_ACTIVE_BOOKINGS",
                    message="Không thể tắt hoạt động sân vì đang có đơn đặt cọc trong tương lai.",
                )

            court.is_active = False

            # Hủy các đơn đang giữ chỗ tạm PENDING_DEPOSIT và nhả slot
            pending_bookings = (
                db.query(Booking)
                .filter(
                    Booking.court_id == court.id,
                    Booking.status == "PENDING_DEPOSIT",
                )
                .all()
            )
            now = datetime.now(timezone.utc)
            for pb in pending_bookings:
                pb.status = "CANCELLED"
                pb.cancelled_at = now
                pb.cancel_reason = "Sân tạm ngưng hoạt động"
                for slot in pb.slots:
                    if slot.released_at is None:
                        slot.released_at = now

        elif body.is_active is True:
            court.is_active = True

        # 3. Cập nhật các trường thông tin cơ bản khác
        if body.name is not None:
            court.name = body.name
        if body.court_type is not None:
            court.court_type = body.court_type
        if body.environment is not None:
            court.environment = body.environment

        db.commit()
        db.refresh(court)

        return {
            "success": True,
            "message": "Cập nhật thông tin sân con và đồng bộ khung giờ hoạt động thành công.",
            "data": format_court(court),
        }
    except Exception:
        db.rollback()
        raise
