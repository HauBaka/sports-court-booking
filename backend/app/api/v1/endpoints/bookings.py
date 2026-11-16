# pyright: reportAttributeAccessIssue=false, reportArgumentType=false
import logging
from typing import cast

# pyright: reportAttributeAccessIssue=false
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from typing import Optional, cast
from fastapi import APIRouter, BackgroundTasks, Depends, status
from fastapi.responses import JSONResponse
from sqlalchemy import or_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db, require_role
from app.core.exceptions import BusinessException
from app.core.pricing import (
    OrderPricingResult,
    PricingRuleIn,
    RuleType,
    ServicePricingInput,
    SlotPricingInput,
    calculate_booking_price,
)
from app.models.booking import Booking, BookingService, BookingSlot
from app.models.facility import Court, CourtSlot, Service, TimeSlot
from app.models.pricing import Holiday, PricingRule
from app.models.user import User
from app.models.wallet import Wallet
from app.schemas.booking import BookingCalculatePriceIn, BookingCreateIn
from app.services.booking_email import build_deposit_confirmation_email, send_email_safely
from app.services.wallet_service import get_system_wallet, get_wallet_by_user, lock_wallets, transfer

logger = logging.getLogger(__name__)


def _utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)

router = APIRouter()

VN_TZ = timezone(timedelta(hours=7))


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

def now_vn() -> datetime:
    """Trả về thời gian hiện tại theo múi giờ Việt Nam (UTC+7)."""
    return datetime.now(VN_TZ)


def _format_utc_timestamp(value: datetime) -> str:
    """Đổi DATETIME giờ Việt Nam trong booking sang UTC trước khi gắn hậu tố Z."""
    if value.tzinfo is None:
        value = value.replace(tzinfo=VN_TZ)
    return value.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _prepare_pricing(
    db: Session,
    court: Court,
    play_date: date,
    court_slots: list[CourtSlot],
    services_in: Optional[list] = None,
) -> tuple[OrderPricingResult, list[ServicePricingInput]]:
    """Helper tính giá dùng chung giữa xem trước (3.2) và tạo đơn (3.3)."""
    # 1. Dịch vụ đi kèm
    service_inputs: list[ServicePricingInput] = []
    if services_in:
        svc_ids = [s.service_id for s in services_in]
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

        for s_in in services_in:
            svc_entity = services_map[s_in.service_id]
            service_inputs.append(
                ServicePricingInput(
                    service_id=svc_entity.id,
                    name=svc_entity.name,
                    unit_price=int(cast(int, svc_entity.unit_price)),
                    quantity=s_in.quantity,
                )
            )

    # 2. Quy tắc định giá
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

    # 3. Danh sách ngày lễ
    holidays_db = db.query(Holiday).all()
    holiday_ids: set[int] = set()
    for h in holidays_db:
        if h.holiday_date == play_date:
            holiday_ids.add(h.id)
        elif cast(bool, h.recurring_yearly) and (
            h.holiday_date.month == play_date.month and h.holiday_date.day == play_date.day
        ):
            holiday_ids.add(h.id)

    # 4. SlotPricingInput
    slot_inputs: list[SlotPricingInput] = [
        SlotPricingInput(
            time_slot_id=cs.time_slot_id,
            start_time=cs.time_slot.start_time,
            end_time=cs.time_slot.end_time,
            base_price=int(cast(int, cs.base_price)),
        )
        for cs in court_slots
    ]

    # 5. Gọi hàm tính tiền
    result = calculate_booking_price(
        play_date=play_date,
        slots=slot_inputs,
        rules=pricing_rules,
        holiday_ids=holiday_ids,
        services=service_inputs,
    )
    return result, service_inputs


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

    # 2. Kiểm tra khung giờ: Khung không thuộc sân trả 422
    court_slots = (
        db.query(CourtSlot)
        .join(TimeSlot, TimeSlot.id == CourtSlot.time_slot_id)
        .filter(
            CourtSlot.court_id == body.court_id,
            CourtSlot.time_slot_id.in_(body.time_slot_ids),
            CourtSlot.is_active == True,
        )
        .order_by(TimeSlot.start_time)
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

    # 3. Tính tiền
    result, _ = _prepare_pricing(
        db=db,
        court=court,
        play_date=body.play_date,
        court_slots=court_slots,
        services_in=body.services,
    )

    # 4. Lấy số dư ví người dùng để kiểm tra điều kiện đặt cọc
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


# ==============================================================================
# 3.4 Thanh toán tiền cọc 30% qua ví nội bộ (DEPOSITED + sinh DEPOSIT)
# ==============================================================================
@router.post("/bookings/{id}/deposit", summary="Thanh toán tiền cọc qua ví nội bộ")
def pay_deposit(
    id: int,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(require_role("customer")),
    db: Session = Depends(get_db),
):
    booking = db.query(Booking).filter(Booking.id == id).first()
    if not booking:
        raise BusinessException(status.HTTP_404_NOT_FOUND, "BOOKING_NOT_FOUND", "Không tìm thấy đơn đặt sân.")
    if booking.user_id != current_user.id:
        raise BusinessException(
            status.HTTP_403_FORBIDDEN, "AUTH_FORBIDDEN", "Bạn không có quyền thanh toán cọc cho đơn này."
        )

    try:
        # Bước 1: khóa ví khách + ví hệ thống theo wallet.id tăng dần.
        customer_wallet = get_wallet_by_user(db, current_user.id)
        system_wallet = get_system_wallet(db)
        lock_wallets(db, [customer_wallet.id, system_wallet.id])

        # Lấy giờ SAU khi có khóa: chờ khóa có thể kéo dài qua hold_expires_at,
        # dùng giờ lấy trước đó sẽ cho cọc nhầm đơn đã hết hạn.
        now = _utcnow()

        # Bước 2: chuyển trạng thái có điều kiện; rowcount = 0 → hết hạn / đã đổi trạng thái / gửi trùng.
        updated = (
            db.query(Booking)
            .filter(Booking.id == id, Booking.status == "PENDING_DEPOSIT", Booking.hold_expires_at > now)
            .update({"status": "DEPOSITED", "hold_expires_at": None}, synchronize_session=False)
        )
        if updated != 1:
            raise BusinessException(
                status.HTTP_400_BAD_REQUEST,
                "CANNOT_DEPOSIT_EXPIRED_BOOKING",
                "Đơn đã quá hạn giữ chỗ hoặc không còn ở trạng thái chờ cọc, không thể thanh toán cọc.",
            )

        # Bước 3-5: kiểm tra số dư, trừ/cộng ví, ghi DEPOSIT (một chỗ duy nhất trong transfer()).
        tx = transfer(
            db,
            type="DEPOSIT",
            amount=booking.deposit_amount,
            from_wallet_id=customer_wallet.id,
            to_wallet_id=system_wallet.id,
            related_booking_id=booking.id,
        )
        db.commit()  # Bước 6
    except Exception:
        db.rollback()
        raise

    db.refresh(booking)

    # FR-25: gửi mail sau commit. Soạn nội dung ngay (session còn mở), gửi nền; lỗi nào cũng chỉ ghi log.
    try:
        subject, html = build_deposit_confirmation_email(booking, current_user)
        background_tasks.add_task(send_email_safely, current_user.email, subject, html)
    except Exception:  # noqa: BLE001
        logger.exception("Không soạn được email xác nhận cọc cho đơn %s", booking.id)

    return {
        "success": True,
        "message": "Thanh toán cọc 30% thành công. Đơn đặt sân đã được xác nhận.",
        "data": {
            "booking_id": booking.id,
            "status": booking.status,
            "deposit_amount_paid": tx.amount,
            "remaining_amount_due_at_court": booking.total_amount - tx.amount,
            "wallet_balance_remaining": tx.balance_after,
            "transaction_type": "DEPOSIT",
        },
# 3.3 Tạo lịch đặt sân và giữ chỗ tạm (SCB-145)
# ==============================================================================
@router.post("/bookings", summary="Tạo lịch đặt sân và giữ chỗ tạm")
def create_booking(
    body: BookingCreateIn,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Quy trình 6 bước tạo đơn giữ chỗ tạm thời trong Database Transaction (ACID):
    - Bước 1: Dọn dẹp lười (Lazy release) các đơn PENDING_DEPOSIT đã quá hạn trên các khung đang đặt.
    - Bước 2: Khóa dòng và kiểm tra xung đột (SELECT ... FOR UPDATE). Trả 409 SLOT_ALREADY_BOOKED nếu trùng.
    - Bước 3: Kiểm tra điều kiện mở cửa và thời gian bắt đầu chơi (start_at <= :now -> 400 INVALID_BOOKING_TIME).
    - Bước 4: Tính tiền bằng SCB-140, thiết lập hold_expires_at = MIN(:now + 10 phút, start_at).
    - Bước 5: Tạo đơn bookings (PENDING_DEPOSIT), booking_slots và booking_services.
    - Bước 6: Commit Transaction. Chưa trừ tiền ví, chưa có giao dịch ví.
    """
    # Kiểm tra sân con tồn tại và đang hoạt động
    court = db.query(Court).filter(Court.id == body.court_id).first()
    if not court or not cast(bool, court.is_active) or not (court.facility and cast(bool, court.facility.is_active)):
        raise BusinessException(
            status_code=status.HTTP_404_NOT_FOUND,
            code="COURT_NOT_FOUND",
            message=f"Sân con với ID {body.court_id} không tồn tại hoặc đã tạm dừng hoạt động.",
        )

    # Lấy các khung giờ thuộc sân con
    court_slots = (
        db.query(CourtSlot)
        .join(TimeSlot, TimeSlot.id == CourtSlot.time_slot_id)
        .filter(
            CourtSlot.court_id == body.court_id,
            CourtSlot.time_slot_id.in_(body.time_slot_ids),
            CourtSlot.is_active == True,
        )
        .order_by(TimeSlot.start_time)
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

    # Kiểm tra cả giờ sân và giờ cơ sở, kể cả khi court_slots còn active sau khi đổi lịch.
    open_time = max(court.open_time, court.facility.open_time)
    close_time = min(court.close_time, court.facility.close_time)
    if any(
        not (open_time <= cs.time_slot.start_time < cs.time_slot.end_time <= close_time)
        for cs in court_slots
    ):
        raise BusinessException(
            status_code=status.HTTP_400_BAD_REQUEST,
            code="INVALID_BOOKING_TIME",
            message="Toàn bộ khung giờ đặt phải nằm trong giờ mở cửa của sân và cơ sở.",
        )

    # Bước 3: Kiểm tra thời gian bắt đầu chơi (DAT-04)
    min_start_time = min(cs.time_slot.start_time for cs in court_slots)
    start_at = datetime.combine(body.play_date, min_start_time)
    current_vn = now_vn()
    current_time = current_vn.replace(tzinfo=None)

    if start_at <= current_time:
        raise BusinessException(
            status_code=status.HTTP_400_BAD_REQUEST,
            code="INVALID_BOOKING_TIME",
            message="Thời gian bắt đầu chơi phải ở tương lai, không thể đặt khung giờ đã qua hoặc đang diễn ra.",
        )

    # BẮT ĐẦU TRANSACTION KIỂM SOÁT ĐỒNG THỜI VÀ LAZY RELEASE
    # Bước 1: Dọn dẹp lười (Lazy release) các đơn PENDING_DEPOSIT đã quá hạn trên chính các khung giờ này
    expired_slots = (
        db.query(BookingSlot)
        .join(Booking, Booking.id == BookingSlot.booking_id)
        .filter(
            BookingSlot.court_id == body.court_id,
            BookingSlot.play_date == body.play_date,
            BookingSlot.time_slot_id.in_(body.time_slot_ids),
            Booking.status == "PENDING_DEPOSIT",
            Booking.hold_expires_at <= current_time,
            BookingSlot.released_at.is_(None),
        )
        .all()
    )
    if expired_slots:
        exp_booking_ids = list({s.booking_id for s in expired_slots})
        db.query(Booking).filter(
            Booking.id.in_(exp_booking_ids),
            Booking.status == "PENDING_DEPOSIT",
            Booking.hold_expires_at <= current_time,
        ).update(
            {
                Booking.status: "CANCELLED",
                Booking.cancelled_at: current_time,
                Booking.cancel_reason: "Hết hạn giữ chỗ 10 phút",
            },
            synchronize_session=False,
        )
        db.query(BookingSlot).filter(
            BookingSlot.booking_id.in_(exp_booking_ids),
            BookingSlot.released_at.is_(None),
        ).update(
            {BookingSlot.released_at: current_time},
            synchronize_session=False,
        )
        db.flush()

    # Bước 2: Khóa dòng và kiểm tra xung đột (SELECT ... FOR UPDATE)
    # Khóa các dòng court_slots theo thứ tự time_slot_id để serialize concurrent requests và chống race condition
    db.query(CourtSlot).filter(
        CourtSlot.court_id == body.court_id,
        CourtSlot.time_slot_id.in_(body.time_slot_ids),
    ).order_by(CourtSlot.time_slot_id).with_for_update().all()

    # Kiểm tra xem có khung giờ nào đang bị giữ hoặc đã đặt cọc hay không
    conflicting_slots = (
        db.query(BookingSlot)
        .filter(
            BookingSlot.court_id == body.court_id,
            BookingSlot.play_date == body.play_date,
            BookingSlot.time_slot_id.in_(body.time_slot_ids),
            BookingSlot.released_at.is_(None),
        )
        .with_for_update()
        .all()
    )
    if conflicting_slots:
        raise BusinessException(
            status_code=status.HTTP_409_CONFLICT,
            code="SLOT_ALREADY_BOOKED",
            message="Một hoặc nhiều khung giờ đã có người đặt cọc hoặc đang trong thời gian giữ chỗ hợp lệ.",
        )

    # Bước 4: Tính tiền & thiết lập thời hạn giữ chỗ
    result, service_inputs = _prepare_pricing(
        db=db,
        court=court,
        play_date=body.play_date,
        court_slots=court_slots,
        services_in=body.services,
    )

    # hold_expires_at không vượt quá start_at (DAT-03)
    hold_expires_at = min(current_time + timedelta(minutes=10), start_at)

    # Bước 5: Tạo bản ghi bookings và booking_slots
    try:
        booking = Booking(
            user_id=current_user.id,
            court_id=body.court_id,
            play_date=body.play_date,
            start_at=start_at,
            status="PENDING_DEPOSIT",
            subtotal=result.subtotal,
            service_total=result.service_total,
            total_amount=result.grand_total_amount,
            deposit_amount=result.deposit_amount_required,
            deposit_percent=result.deposit_percentage,
            hold_expires_at=hold_expires_at,
            cancelled_at=None,
            cancel_reason=None,
        )
        db.add(booking)
        db.flush()

        slots_map = {sb.time_slot_id: sb for sb in result.slots_breakdown}
        for ts_id in body.time_slot_ids:
            sb = slots_map[ts_id]
            db.add(
                BookingSlot(
                    booking_id=booking.id,
                    court_id=body.court_id,
                    play_date=body.play_date,
                    time_slot_id=ts_id,
                    base_price=sb.base_price,
                    final_price=sb.final_price,
                    multiplier=Decimal(str(sb.multiplier)),
                    released_at=None,
                )
            )

        if service_inputs:
            for s_in in service_inputs:
                db.add(
                    BookingService(
                        booking_id=booking.id,
                        service_id=s_in.service_id,
                        quantity=s_in.quantity,
                        unit_price=s_in.unit_price,
                        total_price=s_in.quantity * s_in.unit_price,
                    )
                )

        db.commit()
    except IntegrityError:
        db.rollback()
        raise BusinessException(
            status_code=status.HTTP_409_CONFLICT,
            code="SLOT_ALREADY_BOOKED",
            message="Một hoặc nhiều khung giờ đã có người đặt cọc hoặc đang trong thời gian giữ chỗ hợp lệ.",
        )

    # Bước 6: Trả về kết quả 201 Created
    start_at_str = _format_utc_timestamp(start_at)
    hold_expires_at_str = _format_utc_timestamp(hold_expires_at)

    return JSONResponse(
        status_code=status.HTTP_201_CREATED,
        content={
            "success": True,
            "message": "Giữ chỗ tạm thời thành công. Vui lòng thanh toán cọc trong vòng 10 phút.",
            "data": {
                "booking_id": booking.id,
                "court_id": court.id,
                "court_name": court.name,
                "play_date": body.play_date.strftime("%Y-%m-%d"),
                "start_at": start_at_str,
                "status": "PENDING_DEPOSIT",
                "total_amount": booking.total_amount,
                "deposit_amount_required": booking.deposit_amount,
                "hold_expires_at": hold_expires_at_str,
            },
        },
    )


# ==============================================================================
# 3.7 Dọn dẹp và nhả giữ chỗ hết hạn (SCB-146)
# ==============================================================================
def expire_holds_job(db: Session, now: Optional[datetime] = None) -> dict:
    """Hàm quét và dọn dẹp các đơn PENDING_DEPOSIT hết hạn giữ chỗ (dùng cho Cron và Endpoint Admin)."""
    if now is None:
        now = now_vn().replace(tzinfo=None)

    # 1. Tìm các đơn PENDING_DEPOSIT có hold_expires_at <= now
    expired_bookings = (
        db.query(Booking)
        .filter(
            Booking.status == "PENDING_DEPOSIT",
            Booking.hold_expires_at <= now,
        )
        .all()
    )
    if not expired_bookings:
        return {
            "total_expired_bookings_cancelled": 0,
            "total_slots_released": 0,
            "executed_at": _format_utc_timestamp(now),
        }

    expired_booking_ids = [b.id for b in expired_bookings]

    # 2. Cập nhật bookings sang CANCELLED
    updated_bookings_count = (
        db.query(Booking)
        .filter(
            Booking.id.in_(expired_booking_ids),
            Booking.status == "PENDING_DEPOSIT",
        )
        .update(
            {
                Booking.status: "CANCELLED",
                Booking.cancelled_at: now,
                Booking.cancel_reason: "Hết hạn giữ chỗ 10 phút",
            },
            synchronize_session=False,
        )
    )

    # 3. Cập nhật booking_slots sang released_at = now
    updated_slots_count = (
        db.query(BookingSlot)
        .filter(
            BookingSlot.booking_id.in_(expired_booking_ids),
            BookingSlot.released_at.is_(None),
        )
        .update(
            {BookingSlot.released_at: now},
            synchronize_session=False,
        )
    )

    db.commit()

    return {
        "total_expired_bookings_cancelled": updated_bookings_count,
        "total_slots_released": updated_slots_count,
        "executed_at": _format_utc_timestamp(now),
    }


@router.post(
    "/admin/bookings/expire-holds",
    summary="Dọn dẹp và nhả giữ chỗ hết hạn (Admin / Test)",
    tags=["Bookings"],
)
def trigger_expire_holds(
    current_user: User = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    """Endpoint cho phép Admin hoặc kịch bản kiểm thử CI/CD kích hoạt dọn dẹp giữ chỗ hết hạn ngay lập tức."""
    result = expire_holds_job(db)
    return {
        "success": True,
        "message": "Quét và dọn dẹp các lịch giữ chỗ hết hạn thành công.",
        "data": result,
    }
