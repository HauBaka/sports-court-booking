"""Kịch bản SAN-04..08 (docs/test-scenarios.md mục 5). Chạy trên CSDL test đã nạp seed.
SAN-01..03 kiểm hàm chọn hệ số, viết cùng hàm đó ở SCB-89."""
from datetime import date, datetime, timedelta

import pytest
from sqlalchemy import text

from app.core.database import engine

pytestmark = pytest.mark.skip(reason="Chờ API cơ sở, sân con, bảng giá (SCB-84, SCB-86, SCB-90). Bỏ dòng này khi API xong")

API = "/api/v1"
PASSWORD = "TestPass123@"
LAST_SLOT_ID = 17  # khung 22:00 đến 23:00 trong seed


def auth(client, email):
    res = client.post(f"{API}/auth/login", json={"email": email, "password": PASSWORD})
    return {"Authorization": f"Bearer {res.json()['data']['access_token']}"}


def peak_rule(multiplier):
    return {"rules": [{
        "name": "Giờ vàng 17h-21h", "rule_type": "PEAK_HOUR", "multiplier": multiplier,
        "start_time": "17:00:00", "end_time": "21:00:00", "day_of_week": None, "holiday_id": None,
    }]}


def count_rules():
    with engine.connect() as conn:
        return conn.execute(text("SELECT COUNT(*) FROM pricing_rules WHERE applies_to_facility_id = 1")).scalar()


@pytest.mark.parametrize("code, multiplier", [("san_04", 1.10), ("san_05", 1.60)])
def test_san_04_05_he_so_ngoai_bien(client, code, multiplier):
    res = client.post(f"{API}/facilities/1/pricing-rules", json=peak_rule(multiplier), headers=auth(client, "owner@scb.vn"))
    assert res.status_code == 422
    assert res.json()["error"]["code"] == "VALIDATION_ERROR"
    assert count_rules() == 4  # bảng giá seed không đổi


def test_san_06_sua_san_cua_chu_khac(client):
    client.post(f"{API}/auth/register", json={
        "name": "Chủ Sân B", "email": "owner.b@scb.vn", "phone": "0900000020", "password": PASSWORD, "role": "owner",
    })
    res = client.patch(f"{API}/courts/1", json={"name": "Sân bị đổi tên trái phép"}, headers=auth(client, "owner.b@scb.vn"))
    assert res.status_code == 403
    assert res.json()["error"]["code"] == "AUTH_FORBIDDEN"
    with engine.connect() as conn:
        name = conn.execute(text("SELECT name FROM courts WHERE id = 1")).scalar()
    assert name == "Sân Cầu Lông 1 (Thảm Yonex)"


@pytest.fixture
def deposited_booking():
    """Đơn 'Đã đặt cọc' của sân 1 ngày mai, khung 22:00 đến 23:00 (Khách A)."""
    play_date = date.today() + timedelta(days=1)
    start_at = datetime.combine(play_date, datetime.min.time()).replace(hour=22)
    with engine.begin() as conn:
        booking_id = conn.execute(text(
            "INSERT INTO bookings (user_id, court_id, play_date, start_at, status, subtotal, service_total,"
            " total_amount, deposit_amount, deposit_percent)"
            " VALUES (4, 1, :d, :s, 'DEPOSITED', 100000, 0, 100000, 30000, 30)"), {"d": play_date, "s": start_at}).lastrowid
        conn.execute(text(
            "INSERT INTO booking_slots (booking_id, court_id, play_date, time_slot_id, base_price, final_price, multiplier)"
            " VALUES (:b, 1, :d, :t, 100000, 100000, 1.00)"), {"b": booking_id, "d": play_date, "t": LAST_SLOT_ID})
    yield booking_id
    with engine.begin() as conn:
        # Trigger chặn xóa booking_slots, nên nhả slot và hủy đơn thay vì xóa.
        conn.execute(text("UPDATE booking_slots SET released_at = NOW() WHERE booking_id = :b"), {"b": booking_id})
        conn.execute(text("UPDATE bookings SET status = 'CANCELLED', cancelled_at = NOW() WHERE id = :b"), {"b": booking_id})


def test_san_07_doi_gio_khi_con_lich_coc(client, deposited_booking):
    res = client.patch(f"{API}/courts/1", json={"close_time": "22:00:00"}, headers=auth(client, "owner@scb.vn"))
    assert res.status_code == 400
    assert res.json()["error"]["code"] == "CANNOT_UPDATE_COURT_SCHEDULE_ACTIVE_BOOKINGS"
    with engine.connect() as conn:
        close_time = conn.execute(text("SELECT close_time FROM courts WHERE id = 1")).scalar()
    assert str(close_time) == "23:00:00"


def test_san_08_doi_gio_khi_khong_co_lich(client):
    res = client.patch(f"{API}/courts/2", json={"close_time": "22:00:00"}, headers=auth(client, "owner@scb.vn"))
    assert res.status_code == 200
    assert res.json()["data"]["close_time"] == "22:00:00"
    with engine.connect() as conn:
        inactive = conn.execute(text(
            "SELECT time_slot_id FROM court_slots WHERE court_id = 2 AND is_active = false")).scalars().all()
    assert inactive == [LAST_SLOT_ID]
