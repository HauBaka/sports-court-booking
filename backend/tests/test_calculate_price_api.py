# pyright: reportGeneralTypeIssues=false, reportAttributeAccessIssue=false, reportOptionalMemberAccess=false
from datetime import date, datetime, time
from decimal import Decimal
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import BigInteger, create_engine
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

import app.models  # Đảm bảo tất cả tables đều được nạp vào Base.metadata
from app.api.deps import get_db
from app.core.database import Base
from app.core.security import create_access_token, hash_password
from app.main import app
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
    """Tự động tạo mới database và override get_db trước mỗi test, dọn dẹp sau khi xong."""
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

    # User Customer
    pwd_hash = hash_password("CustomerPass123@")
    customer = User(
        id=12,
        name="Nguyễn Văn A",
        email="customer@example.com",
        phone="0901234567",
        password_hash=pwd_hash,
        is_active=True,
    )
    db.add(customer)
    db.commit()
    db.add(UserRole(user_id=12, role_id=1))
    db.commit()

    # Ví của User 12 có số dư 200.000đ (như ví dụ api-endpoints.md mục 3.2)
    wallet = Wallet(id=12, user_id=12, balance=200000)
    db.add(wallet)
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
    db.add(court)
    db.commit()

    # TimeSlots:
    # Slot 1: 16:00 - 17:00
    # Slot 2: 17:00 - 18:00
    # Slot 3: 18:00 - 19:00
    # Slot 99: 07:00 - 08:00 (không gắn vào court_slots)
    ts1 = TimeSlot(id=1, start_time=time(16, 0), end_time=time(17, 0), duration_minutes=60, label="16:00 - 17:00")
    ts2 = TimeSlot(id=2, start_time=time(17, 0), end_time=time(18, 0), duration_minutes=60, label="17:00 - 18:00")
    ts3 = TimeSlot(id=3, start_time=time(18, 0), end_time=time(19, 0), duration_minutes=60, label="18:00 - 19:00")
    ts99 = TimeSlot(id=99, start_time=time(7, 0), end_time=time(8, 0), duration_minutes=60, label="07:00 - 08:00")
    db.add_all([ts1, ts2, ts3, ts99])
    db.commit()

    # CourtSlots cho Court 101: gắn slot 1, 2, 3
    db.add_all([
        CourtSlot(id=1, court_id=101, time_slot_id=1, base_price=100000, is_active=True),
        CourtSlot(id=2, court_id=101, time_slot_id=2, base_price=100000, is_active=True),
        CourtSlot(id=3, court_id=101, time_slot_id=3, base_price=100000, is_active=True),
    ])
    db.commit()

    # PricingRule: Giờ vàng 17h-21h x1.30 cho Facility 1
    rule_peak = PricingRule(
        id=1,
        name="Giờ vàng 17h-21h",
        rule_type="PEAK_HOUR",
        multiplier=Decimal("1.30"),
        applies_to_facility_id=1,
        start_time=time(17, 0),
        end_time=time(21, 0),
    )
    db.add(rule_peak)
    db.commit()

    # Service 1 thuộc Facility 1: Nước tăng lực 20.000đ
    svc1 = Service(id=1, facility_id=1, name="Nước tăng lực", unit_price=20000, is_active=True)
    # Service 2 thuộc cơ sở khác (Facility 999)
    svc2 = Service(id=2, facility_id=999, name="Dịch vụ khác", unit_price=50000, is_active=True)
    db.add_all([svc1, svc2])
    db.commit()
    db.close()

    yield

    Base.metadata.drop_all(bind=test_engine)
    if original_override is not None:
        app.dependency_overrides[get_db] = original_override
    else:
        app.dependency_overrides.pop(get_db, None)


@pytest.fixture
def client():
    with TestClient(app, raise_server_exceptions=False) as test_client:
        yield test_client


@pytest.fixture
def customer_token():
    return create_access_token({"sub": "12", "user_id": 12, "role": "customer"})


def test_chua_dang_nhap_tra_401(client):
    """Gọi tính giá không có header Authorization -> 401 Unauthorized."""
    payload = {
        "court_id": 101,
        "play_date": "2026-11-10",
        "time_slot_ids": [1],
    }
    res = client.post("/api/v1/bookings/calculate-price", json=payload)
    assert res.status_code == 401


def test_tinh_gia_thanh_cong_chuan_muc_3_2(client, customer_token):
    """
    Yêu cầu SCB-142:
    - Trả slots_breakdown và các tổng như mục 3.2.
    - Slot 1 (16:00-17:00, 100k, x1.00 -> 100k, 'Giá giờ thường').
    - Slot 2 (17:00-18:00, 100k, x1.30 -> 130k, 'Giờ vàng 17h-21h').
    - 2 chai nước (40k).
    - subtotal = 230k, service_total = 40k, grand_total = 270k.
    - deposit_amount = 81k, remaining = 189k.
    - user_wallet_status: balance 200k, sufficient True, balance_after = 119k.
    """
    headers = {"Authorization": f"Bearer {customer_token}"}
    payload = {
        "court_id": 101,
        "play_date": "2026-11-10",  # Thứ Ba
        "time_slot_ids": [1, 2],
        "services": [
            {"service_id": 1, "quantity": 2}
        ],
    }
    res = client.post("/api/v1/bookings/calculate-price", json=payload, headers=headers)
    assert res.status_code == 200
    body = res.json()
    assert body["success"] is True
    data = body["data"]

    assert data["court_id"] == 101
    assert data["court_name"] == "Sân Cầu Lông 1 (Thảm Yonex)"
    assert data["facility_name"] == "Cơ Sở Cầu Lông & Pickleball Kỳ Hòa"
    assert data["play_date"] == "2026-11-10"
    assert data["time_range"] == "16:00 - 18:00 (2 khung giờ)"

    # Slots breakdown
    assert len(data["slots_breakdown"]) == 2
    sb1 = data["slots_breakdown"][0]
    assert sb1["time_slot_id"] == 1
    assert sb1["applied_rule"] == "Giá giờ thường"
    assert sb1["multiplier"] == 1.0
    assert sb1["final_price"] == 100000

    sb2 = data["slots_breakdown"][1]
    assert sb2["time_slot_id"] == 2
    assert sb2["applied_rule"] == "Giờ vàng 17h-21h"
    assert sb2["multiplier"] == 1.3
    assert sb2["final_price"] == 130000

    # Pricing summary
    assert data["pricing_summary"]["subtotal"] == 230000
    assert data["pricing_summary"]["service_total"] == 40000
    assert data["pricing_summary"]["grand_total_amount"] == 270000

    # Deposit policy
    assert data["deposit_policy"]["deposit_percentage"] == 30
    assert data["deposit_policy"]["deposit_amount_required"] == 81000
    assert data["deposit_policy"]["remaining_amount_due_at_court"] == 189000

    # User wallet status
    assert data["user_wallet_status"]["current_balance"] == 200000
    assert data["user_wallet_status"]["is_balance_sufficient"] is True
    assert data["user_wallet_status"]["balance_after_deposit"] == 119000


def test_khung_khong_thuoc_san_tra_422(client, customer_token):
    """
    Yêu cầu SCB-142: Khung không thuộc sân trả 422.
    Slot 99 không được cấu hình trong court_slots của sân 101 -> 422 VALIDATION_ERROR.
    """
    headers = {"Authorization": f"Bearer {customer_token}"}
    payload = {
        "court_id": 101,
        "play_date": "2026-11-10",
        "time_slot_ids": [1, 99],
    }
    res = client.post("/api/v1/bookings/calculate-price", json=payload, headers=headers)
    assert res.status_code == 422
    body = res.json()
    assert body["success"] is False
    assert body["error"]["code"] == "VALIDATION_ERROR"
    assert "99" in body["error"]["message"]


def test_court_khong_ton_tai_tra_404(client, customer_token):
    """Sân không tồn tại -> 404 COURT_NOT_FOUND."""
    headers = {"Authorization": f"Bearer {customer_token}"}
    payload = {
        "court_id": 99999,
        "play_date": "2026-11-10",
        "time_slot_ids": [1],
    }
    res = client.post("/api/v1/bookings/calculate-price", json=payload, headers=headers)
    assert res.status_code == 404
    body = res.json()
    assert body["success"] is False
    assert body["error"]["code"] == "COURT_NOT_FOUND"


def test_dich_vu_khong_thuoc_co_so_tra_422(client, customer_token):
    """Dịch vụ không thuộc cơ sở của sân -> 422 VALIDATION_ERROR."""
    headers = {"Authorization": f"Bearer {customer_token}"}
    payload = {
        "court_id": 101,
        "play_date": "2026-11-10",
        "time_slot_ids": [1],
        "services": [
            {"service_id": 2, "quantity": 1}  # Service 2 thuộc cơ sở 999
        ],
    }
    res = client.post("/api/v1/bookings/calculate-price", json=payload, headers=headers)
    assert res.status_code == 422
    body = res.json()
    assert body["success"] is False
    assert body["error"]["code"] == "VALIDATION_ERROR"
