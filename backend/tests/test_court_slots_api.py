# pyright: reportGeneralTypeIssues=false, reportAttributeAccessIssue=false, reportOptionalMemberAccess=false
from datetime import date, datetime, time, timedelta, timezone
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import BigInteger, create_engine
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.deps import get_db
from app.core.database import Base
from app.core.security import hash_password
from app.main import app
from app.models.booking import Booking, BookingSlot
from app.models.facility import Court, CourtSlot, Facility, Sport, TimeSlot
from app.models.user import Role, User, UserRole

@compiles(BigInteger, "sqlite")
def _bigint_as_integer(type_, compiler, **kw):
    return "INTEGER"


SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"

test_engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture(scope="module")
def setup_court_slots_db():
    Base.metadata.create_all(bind=test_engine)
    db = TestingSessionLocal()

    # Tạo User Owner và Customer
    pwd_hash = hash_password("SecurePass123@")
    owner = User(id=1, name="Chủ Sân Test", email="owner@test.vn", phone="0901111111", password_hash=pwd_hash, is_active=True)
    customer = User(id=2, name="Khách Hàng Test", email="customer@test.vn", phone="0902222222", password_hash=pwd_hash, is_active=True)
    db.add_all([owner, customer])
    db.commit()

    # Sport
    sport = Sport(id=1, name="Cầu lông")
    db.add(sport)
    db.commit()

    # Facility
    facility = Facility(
        id=1,
        owner_id=1,
        name="Cụm Sân Test",
        address="123 Đường Test",
        city="Hồ Chí Minh",
        open_time=time(6, 0),
        close_time=time(23, 0),
        is_active=True,
    )
    db.add(facility)
    db.commit()

    # Court
    court = Court(
        id=101,
        facility_id=1,
        sport_id=1,
        name="Sân Cầu Lông 101",
        open_time=time(6, 0),
        close_time=time(23, 0),
        is_active=True,
    )
    db.add(court)
    db.commit()

    # TimeSlots: slot 1 (16:00-17:00), slot 2 (17:00-18:00), slot 3 (18:00-19:00), slot 4 (19:00-20:00), slot 5 (20:00-21:00)
    ts_list = [
        TimeSlot(id=1, start_time=time(16, 0), end_time=time(17, 0), duration_minutes=60, label="16:00 - 17:00"),
        TimeSlot(id=2, start_time=time(17, 0), end_time=time(18, 0), duration_minutes=60, label="17:00 - 18:00"),
        TimeSlot(id=3, start_time=time(18, 0), end_time=time(19, 0), duration_minutes=60, label="18:00 - 19:00"),
        TimeSlot(id=4, start_time=time(19, 0), end_time=time(20, 0), duration_minutes=60, label="19:00 - 20:00"),
        TimeSlot(id=5, start_time=time(20, 0), end_time=time(21, 0), duration_minutes=60, label="20:00 - 21:00"),
    ]
    db.add_all(ts_list)
    db.commit()

    # CourtSlots
    cs_list = [
        CourtSlot(id=1, court_id=101, time_slot_id=1, base_price=100000, is_active=True),
        CourtSlot(id=2, court_id=101, time_slot_id=2, base_price=100000, is_active=True),
        CourtSlot(id=3, court_id=101, time_slot_id=3, base_price=100000, is_active=True),
        CourtSlot(id=4, court_id=101, time_slot_id=4, base_price=100000, is_active=True),
        CourtSlot(id=5, court_id=101, time_slot_id=5, base_price=100000, is_active=True),
    ]
    db.add_all(cs_list)
    db.commit()

    # Dữ liệu tạo tay cho các trạng thái mục 3.1 trong ngày 2026-11-10:
    target_date = date(2026, 11, 10)
    now_utc = datetime.now(timezone.utc)

    # Đơn 1: Đã đặt cọc (DEPOSITED) cho slot 2 (17:00-18:00) -> BOOKED
    booking_deposited = Booking(
        id=201,
        user_id=2,
        court_id=101,
        play_date=target_date,
        start_at=datetime(2026, 11, 10, 10, 0),
        status="DEPOSITED",
        subtotal=100000,
        total_amount=100000,
        deposit_amount=30000,
    )
    db.add(booking_deposited)
    db.commit()
    db.add(
        BookingSlot(
            id=301,
            booking_id=201,
            court_id=101,
            play_date=target_date,
            time_slot_id=2,
            base_price=100000,
            final_price=100000,
            released_at=None,
        )
    )

    # Đơn 2: Đang giữ chỗ (PENDING_DEPOSIT, còn hạn giữ chỗ 10 phút) cho slot 3 (18:00-19:00) -> HOLDING
    booking_holding = Booking(
        id=202,
        user_id=2,
        court_id=101,
        play_date=target_date,
        start_at=datetime(2026, 11, 10, 11, 0),
        status="PENDING_DEPOSIT",
        hold_expires_at=now_utc + timedelta(minutes=8),
        subtotal=100000,
        total_amount=100000,
        deposit_amount=30000,
    )
    db.add(booking_holding)
    db.commit()
    db.add(
        BookingSlot(
            id=302,
            booking_id=202,
            court_id=101,
            play_date=target_date,
            time_slot_id=3,
            base_price=100000,
            final_price=100000,
            released_at=None,
        )
    )

    # Đơn 3: Hết hạn giữ chỗ (PENDING_DEPOSIT, hold_expires_at <= now) cho slot 4 (19:00-20:00) -> AVAILABLE
    booking_expired = Booking(
        id=203,
        user_id=2,
        court_id=101,
        play_date=target_date,
        start_at=datetime(2026, 11, 10, 12, 0),
        status="PENDING_DEPOSIT",
        hold_expires_at=now_utc - timedelta(minutes=5),  # Quá hạn 5 phút trước
        subtotal=100000,
        total_amount=100000,
        deposit_amount=30000,
    )
    db.add(booking_expired)
    db.commit()
    db.add(
        BookingSlot(
            id=303,
            booking_id=203,
            court_id=101,
            play_date=target_date,
            time_slot_id=4,
            base_price=100000,
            final_price=100000,
            released_at=None,
        )
    )

    # Đơn 4: Đã hủy và nhả slot (released_at IS NOT NULL) cho slot 5 (20:00-21:00) -> AVAILABLE
    booking_released = Booking(
        id=204,
        user_id=2,
        court_id=101,
        play_date=target_date,
        start_at=datetime(2026, 11, 10, 13, 0),
        status="CANCELLED",
        subtotal=100000,
        total_amount=100000,
        deposit_amount=30000,
    )
    db.add(booking_released)
    db.commit()
    db.add(
        BookingSlot(
            id=304,
            booking_id=204,
            court_id=101,
            play_date=target_date,
            time_slot_id=5,
            base_price=100000,
            final_price=100000,
            released_at=now_utc - timedelta(hours=1),  # Đã nhả
        )
    )

    # Slot 1 không có đơn nào -> AVAILABLE
    db.commit()
    db.close()


def test_thieu_date_tra_422(client, setup_court_slots_db):
    """Thiếu tham số query date -> 422 Unprocessable Entity."""
    res = client.get("/api/v1/courts/101/slots")
    assert res.status_code == 422
    data = res.json()
    assert data["success"] is False
    assert data["error"]["code"] == "VALIDATION_ERROR"


def test_sai_format_date_tra_422(client, setup_court_slots_db):
    """Sai định dạng date (không phải YYYY-MM-DD) -> 422 Unprocessable Entity."""
    res = client.get("/api/v1/courts/101/slots?date=2026-99-99")
    assert res.status_code == 422
    data = res.json()
    assert data["success"] is False
    assert data["error"]["code"] == "VALIDATION_ERROR"

    res_str = client.get("/api/v1/courts/101/slots?date=invalid-date")
    assert res_str.status_code == 422


def test_court_khong_ton_tai_tra_404(client, setup_court_slots_db):
    """Sân con không tồn tại -> 404 COURT_NOT_FOUND."""
    res = client.get("/api/v1/courts/99999/slots?date=2026-11-10")
    assert res.status_code == 404
    data = res.json()
    assert data["success"] is False
    assert data["error"]["code"] == "COURT_NOT_FOUND"


def test_ca_ba_trang_thai_va_hold_het_han(client, setup_court_slots_db):
    """
    Yêu cầu SCB-141:
    - Trạng thái AVAILABLE, HOLDING, BOOKED theo đúng điều kiện mục 3.1.
    - Đơn hết hạn giữ chỗ hiện là AVAILABLE.
    - Test cho cả 3 trạng thái bằng dữ liệu tạo tay.
    """
    res = client.get("/api/v1/courts/101/slots?date=2026-11-10")
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert data["data"]["court_id"] == 101
    assert data["data"]["date"] == "2026-11-10"

    slots = {s["time_slot_id"]: s for s in data["data"]["slots"]}

    # Slot 1: Không có ai đặt -> AVAILABLE
    assert slots[1]["status"] == "AVAILABLE"
    assert slots[1]["start_time"] == "16:00:00"
    assert slots[1]["end_time"] == "17:00:00"

    # Slot 2: Đơn DEPOSITED (released_at is None) -> BOOKED
    assert slots[2]["status"] == "BOOKED"
    assert slots[2]["start_time"] == "17:00:00"
    assert slots[2]["end_time"] == "18:00:00"

    # Slot 3: Đơn PENDING_DEPOSIT (hold_expires_at > now, released_at is None) -> HOLDING
    assert slots[3]["status"] == "HOLDING"
    assert slots[3]["start_time"] == "18:00:00"
    assert slots[3]["end_time"] == "19:00:00"

    # Slot 4: Đơn PENDING_DEPOSIT nhưng hold_expires_at <= now (hết hạn giữ chỗ 10 phút) -> AVAILABLE
    assert slots[4]["status"] == "AVAILABLE"
    assert slots[4]["start_time"] == "19:00:00"
    assert slots[4]["end_time"] == "20:00:00"

    # Slot 5: Đơn đã nhả (released_at IS NOT NULL) -> AVAILABLE
    assert slots[5]["status"] == "AVAILABLE"
    assert slots[5]["start_time"] == "20:00:00"
    assert slots[5]["end_time"] == "21:00:00"
