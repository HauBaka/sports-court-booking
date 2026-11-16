# pyright: reportGeneralTypeIssues=false, reportAttributeAccessIssue=false, reportOptionalMemberAccess=false
from datetime import date, datetime, time, timedelta, timezone
from decimal import Decimal
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import BigInteger, create_engine
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

import app.models  # Đảm bảo nạp toàn bộ metadata
from app.api.deps import get_db
from app.core.database import Base
from app.core.security import create_access_token, hash_password
from app.main import app
from app.models.booking import Booking, BookingService, BookingSlot
from app.models.facility import Court, CourtSlot, Facility, Service, Sport, TimeSlot
from app.models.pricing import PricingRule
from app.models.user import Role, User, UserRole
from app.models.wallet import Wallet

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


@pytest.fixture(autouse=True)
def setup_database():
    """Tự động tạo mới database và override get_db trước mỗi test."""
    original_override = app.dependency_overrides.get(get_db)
    app.dependency_overrides[get_db] = override_get_db

    Base.metadata.create_all(bind=test_engine)
    db = TestingSessionLocal()

    # Roles
    db.add_all([
        Role(id=1, name="CUSTOMER", description="Khách hàng"),
        Role(id=2, name="OWNER", description="Chủ sân"),
    ])
    db.commit()

    # User Customer (ID 12)
    pwd_hash = hash_password("CustomerPass123@")
    customer = User(
        id=12,
        name="Nguyễn Văn A",
        email="customer@example.com",
        phone="0901234567",
        password_hash=pwd_hash,
        is_active=True,
    )
    # User Customer B (ID 13)
    customer_b = User(
        id=13,
        name="Khách Hàng B",
        email="customer.b@example.com",
        phone="0901234568",
        password_hash=pwd_hash,
        is_active=True,
    )
    db.add_all([customer, customer_b])
    db.commit()

    db.add_all([
        UserRole(user_id=12, role_id=1),
        UserRole(user_id=13, role_id=1),
    ])
    db.commit()

    # Wallets
    w1 = Wallet(id=12, user_id=12, balance=500000)
    w2 = Wallet(id=13, user_id=13, balance=200000)
    db.add_all([w1, w2])
    db.commit()

    # Sport & Facility
    sport = Sport(id=1, name="Cầu lông")
    facility = Facility(
        id=1,
        owner_id=12,
        name="Cơ Sở Cầu Lông & Pickleball Kỳ Hòa",
        address="238 Ba Tháng Hai",
        city="Hồ Chí Minh",
        open_time=time(6, 0),
        close_time=time(23, 0),
        is_active=True,
    )
    db.add_all([sport, facility])
    db.commit()

    # Service thuộc cơ sở 1
    svc1 = Service(
        id=1,
        facility_id=1,
        name="Thuê vợt Yonex Astrox",
        unit_price=20000,
        is_active=True,
    )
    db.add(svc1)
    db.commit()

    # Court 101
    court = Court(
        id=101,
        facility_id=1,
        sport_id=1,
        name="Sân Cầu Lông 1 (Thảm Yonex)",
        open_time=time(6, 0),
        close_time=time(23, 0),
        is_active=True,
    )
    # Court 102 (không hoạt động)
    court_inactive = Court(
        id=102,
        facility_id=1,
        sport_id=1,
        name="Sân Cầu Lông 2 (Bảo trì)",
        open_time=time(6, 0),
        close_time=time(23, 0),
        is_active=False,
    )
    db.add_all([court, court_inactive])
    db.commit()

    # TimeSlots
    ts1 = TimeSlot(id=1, start_time=time(8, 0), end_time=time(9, 0), duration_minutes=60, label="08:00 - 09:00")
    ts2 = TimeSlot(id=2, start_time=time(9, 0), end_time=time(10, 0), duration_minutes=60, label="09:00 - 10:00")
    ts3 = TimeSlot(id=3, start_time=time(18, 0), end_time=time(19, 0), duration_minutes=60, label="18:00 - 19:00")
    ts99 = TimeSlot(id=99, start_time=time(7, 0), end_time=time(8, 0), duration_minutes=60, label="07:00 - 08:00")
    db.add_all([ts1, ts2, ts3, ts99])
    db.commit()

    # CourtSlots cho Court 101: slot 1 (100k), slot 2 (100k), slot 3 (100k)
    cs1 = CourtSlot(court_id=101, time_slot_id=1, base_price=100000, is_active=True)
    cs2 = CourtSlot(court_id=101, time_slot_id=2, base_price=100000, is_active=True)
    cs3 = CourtSlot(court_id=101, time_slot_id=3, base_price=100000, is_active=True)
    db.add_all([cs1, cs2, cs3])
    db.commit()

    # Pricing Rule: Khung giờ cao điểm (18:00 - 20:00) x1.30
    rule = PricingRule(
        name="Giờ cao điểm tối",
        rule_type="PEAK_HOUR",
        multiplier=Decimal("1.30"),
        start_time=time(17, 0),
        end_time=time(20, 0),
    )
    db.add(rule)
    db.commit()
    db.close()

    yield

    Base.metadata.drop_all(bind=test_engine)
    if original_override:
        app.dependency_overrides[get_db] = original_override
    else:
        app.dependency_overrides.pop(get_db, None)


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def customer_headers():
    token = create_access_token(data={"sub": "12", "user_id": 12, "roles": ["customer"]})
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def customer_b_headers():
    token = create_access_token(data={"sub": "13", "user_id": 13, "roles": ["customer"]})
    return {"Authorization": f"Bearer {token}"}


# ==============================================================================
# TESTS FOR SCB-145: POST /api/v1/bookings
# ==============================================================================

def test_create_booking_success(client, customer_headers):
    """DAT-01: Tạo đơn giữ chỗ hợp lệ, trạng thái PENDING_DEPOSIT, chưa trừ ví."""
    future_date = (date.today() + timedelta(days=3)).strftime("%Y-%m-%d")
    payload = {
        "court_id": 101,
        "play_date": future_date,
        "time_slot_ids": [1, 2],
        "services": [{"service_id": 1, "quantity": 2}],
    }
    res = client.post("/api/v1/bookings", json=payload, headers=customer_headers)
    assert res.status_code == 201
    body = res.json()
    assert body["success"] is True
    data = body["data"]
    assert data["court_id"] == 101
    assert data["court_name"] == "Sân Cầu Lông 1 (Thảm Yonex)"
    assert data["status"] == "PENDING_DEPOSIT"
    # Tiền: 2 slot x 100k = 200k + 2 dịch vụ x 20k = 40k -> total = 240k, deposit 30% = 72k
    assert data["total_amount"] == 240000
    assert data["deposit_amount_required"] == 72000
    assert "hold_expires_at" in data

    # Kiểm tra CSDL
    db = TestingSessionLocal()
    booking = db.query(Booking).filter(Booking.id == data["booking_id"]).first()
    assert booking is not None
    assert booking.user_id == 12
    assert booking.status == "PENDING_DEPOSIT"
    assert len(booking.slots) == 2
    assert len(booking.services) == 1
    assert booking.services[0].total_price == 40000

    # Kiểm tra ví: chưa bị trừ tiền
    wallet = db.query(Wallet).filter(Wallet.user_id == 12).first()
    assert wallet.balance == 500000
    db.close()


def test_create_booking_hold_expires_at_cannot_exceed_start_at(client, customer_headers, monkeypatch):
    """DAT-03: Khi giờ đặt sát giờ chơi (< 10 phút), hold_expires_at không được vượt quá start_at."""
    from app.api.v1.endpoints import bookings

    target_date = date(2026, 11, 20)
    # Giả lập thời điểm gọi đặt là 07:55:00 sáng (cách giờ chơi slot 1 lúc 08:00:00 đúng 5 phút)
    simulated_now = datetime(2026, 11, 20, 7, 55, 0, tzinfo=timezone(timedelta(hours=7)))
    monkeypatch.setattr(bookings, "now_vn", lambda: simulated_now)

    payload = {
        "court_id": 101,
        "play_date": target_date.strftime("%Y-%m-%d"),
        "time_slot_ids": [1],  # 08:00 - 09:00
    }
    res = client.post("/api/v1/bookings", json=payload, headers=customer_headers)
    assert res.status_code == 201
    data = res.json()["data"]
    # start_at = 2026-11-20T08:00:00Z
    # now + 10 phút = 08:05:00Z > start_at
    # Do đó hold_expires_at bắt buộc phải bằng start_at
    assert data["start_at"] == "2026-11-20T08:00:00Z"
    assert data["hold_expires_at"] == "2026-11-20T08:00:00Z"


def test_create_booking_unauthorized(client):
    """DAT-06: Chưa đăng nhập trả về 401."""
    future_date = (date.today() + timedelta(days=3)).strftime("%Y-%m-%d")
    payload = {
        "court_id": 101,
        "play_date": future_date,
        "time_slot_ids": [1],
    }
    res = client.post("/api/v1/bookings", json=payload)
    assert res.status_code == 401
    assert res.json()["error"]["code"] == "AUTH_UNAUTHORIZED"


def test_create_booking_past_time_rejected(client, customer_headers):
    """DAT-04: Đặt ngày trong quá khứ bị từ chối 400 INVALID_BOOKING_TIME."""
    past_date = (date.today() - timedelta(days=1)).strftime("%Y-%m-%d")
    payload = {
        "court_id": 101,
        "play_date": past_date,
        "time_slot_ids": [1],
    }
    res = client.post("/api/v1/bookings", json=payload, headers=customer_headers)
    assert res.status_code == 400
    assert res.json()["error"]["code"] == "INVALID_BOOKING_TIME"


def test_create_booking_court_not_found(client, customer_headers):
    """Sân không tồn tại hoặc đã tắt hoạt động trả về 404 COURT_NOT_FOUND."""
    future_date = (date.today() + timedelta(days=3)).strftime("%Y-%m-%d")
    # Sân 999 không tồn tại
    res1 = client.post("/api/v1/bookings", json={"court_id": 999, "play_date": future_date, "time_slot_ids": [1]}, headers=customer_headers)
    assert res1.status_code == 404
    assert res1.json()["error"]["code"] == "COURT_NOT_FOUND"

    # Sân 102 bị vô hiệu hóa
    res2 = client.post("/api/v1/bookings", json={"court_id": 102, "play_date": future_date, "time_slot_ids": [1]}, headers=customer_headers)
    assert res2.status_code == 404
    assert res2.json()["error"]["code"] == "COURT_NOT_FOUND"


def test_create_booking_invalid_slot_returns_422(client, customer_headers):
    """Khung giờ không thuộc sân trả về 422 VALIDATION_ERROR."""
    future_date = (date.today() + timedelta(days=3)).strftime("%Y-%m-%d")
    payload = {
        "court_id": 101,
        "play_date": future_date,
        "time_slot_ids": [99],  # Slot 99 không thuộc court 101
    }
    res = client.post("/api/v1/bookings", json=payload, headers=customer_headers)
    assert res.status_code == 422
    assert res.json()["error"]["code"] == "VALIDATION_ERROR"


def test_create_booking_duplicate_slot_rejected(client, customer_headers, customer_b_headers):
    """TRUNG-01 & TRUNG-02: Khung giờ đã có người giữ hoặc đặt cọc trả 409 SLOT_ALREADY_BOOKED."""
    future_date = (date.today() + timedelta(days=3)).strftime("%Y-%m-%d")
    payload = {
        "court_id": 101,
        "play_date": future_date,
        "time_slot_ids": [1],
    }
    # Khách A đặt thành công
    res_a = client.post("/api/v1/bookings", json=payload, headers=customer_headers)
    assert res_a.status_code == 201

    # Khách B đặt cùng khung -> 409
    res_b = client.post("/api/v1/bookings", json=payload, headers=customer_b_headers)
    assert res_b.status_code == 409
    assert res_b.json()["error"]["code"] == "SLOT_ALREADY_BOOKED"

    # Ví khách B không bị trừ tiền
    db = TestingSessionLocal()
    w = db.query(Wallet).filter(Wallet.user_id == 13).first()
    assert w.balance == 200000
    db.close()


def test_create_booking_multi_slot_one_conflicted(client, customer_headers, customer_b_headers):
    """TRUNG-03: Đơn nhiều khung giờ, 1 khung bị trùng -> cả đơn bị từ chối 409, không giữ khung nào."""
    future_date = (date.today() + timedelta(days=3)).strftime("%Y-%m-%d")
    # Khách A đặt slot 1
    res_a = client.post("/api/v1/bookings", json={"court_id": 101, "play_date": future_date, "time_slot_ids": [1]}, headers=customer_headers)
    assert res_a.status_code == 201

    # Khách B đặt cả slot 1 và slot 2 -> Bị từ chối cả 2
    res_b = client.post("/api/v1/bookings", json={"court_id": 101, "play_date": future_date, "time_slot_ids": [1, 2]}, headers=customer_b_headers)
    assert res_b.status_code == 409
    assert res_b.json()["error"]["code"] == "SLOT_ALREADY_BOOKED"

    # Slot 2 vẫn trống: Khách B có thể đặt riêng slot 2 thành công
    res_b2 = client.post("/api/v1/bookings", json={"court_id": 101, "play_date": future_date, "time_slot_ids": [2]}, headers=customer_b_headers)
    assert res_b2.status_code == 201


def test_lazy_release_expired_hold_on_create(client, customer_headers, customer_b_headers):
    """Mục 3.3 Bước 1 & DAT-02: Đơn cũ hết hạn giữ chỗ -> tự động nhả (Lazy release), khách mới đặt được."""
    future_date = (date.today() + timedelta(days=3)).strftime("%Y-%m-%d")
    # Khách A đặt slot 1
    res_a = client.post("/api/v1/bookings", json={"court_id": 101, "play_date": future_date, "time_slot_ids": [1]}, headers=customer_headers)
    assert res_a.status_code == 201
    booking_id = res_a.json()["data"]["booking_id"]

    # Giả lập đơn Khách A bị quá hạn 10 phút
    db = TestingSessionLocal()
    b = db.query(Booking).filter(Booking.id == booking_id).first()
    past_expire = datetime.now() - timedelta(minutes=5)
    b.hold_expires_at = past_expire
    db.commit()
    db.close()

    # Khách B đặt vào chính slot 1 -> Kích hoạt lazy release, Khách B đặt thành công 201!
    res_b = client.post("/api/v1/bookings", json={"court_id": 101, "play_date": future_date, "time_slot_ids": [1]}, headers=customer_b_headers)
    assert res_b.status_code == 201

    # Kiểm tra đơn cũ của Khách A đã chuyển CANCELLED
    db = TestingSessionLocal()
    old_booking = db.query(Booking).filter(Booking.id == booking_id).first()
    assert old_booking.status == "CANCELLED"
    assert old_booking.cancelled_at is not None
    assert old_booking.slots[0].released_at is not None
    db.close()
