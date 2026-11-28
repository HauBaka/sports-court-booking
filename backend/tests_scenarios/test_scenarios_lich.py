"""Kịch bản xem lịch đặt 3.5, 3.6 (docs/test-scenarios.md mục 7). Chạy trên CSDL vừa nạp seed S2, S3.
Đơn seed id 1 là của Khách B, sân 1, ngày mai."""
from datetime import date, timedelta

from .helpers import ADMIN, API, CUSTOMER_A, OWNER, OWNER2, auth, book, day_u, wait_for

U = day_u()
TOMORROW = date.today() + timedelta(days=1)
pytestmark = wait_for("SCB-199")


def bookings(client, headers, **params):
    return client.get(f"{API}/bookings", headers=headers, params={"limit": 100, **params})


def one_day(day):
    return {"from_date": day.isoformat(), "to_date": day.isoformat()}


def test_lich_01_khach_xem_lich_cua_minh(client):
    a = auth(client, CUSTOMER_A)
    booking_id = book(client, a, 1, U, [8]).json()["data"]["booking_id"]
    assert booking_id in [b["id"] for b in bookings(client, a, **one_day(U)).json()["data"]]
    assert 1 not in [b["id"] for b in bookings(client, a, **one_day(TOMORROW)).json()["data"]]


def test_lich_02_chu_san_xem_lich_co_so_minh(client):
    own = bookings(client, auth(client, OWNER), **one_day(TOMORROW)).json()["data"]
    assert 1 in [b["id"] for b in own]
    assert {b["facility_id"] for b in own} == {1}
    other = bookings(client, auth(client, OWNER2), **one_day(TOMORROW)).json()["data"]
    assert 1 not in {b["facility_id"] for b in other}


def test_lich_03_admin_xem_moi_lich(client):
    res = bookings(client, auth(client, ADMIN), court_id=1, **one_day(TOMORROW))
    assert 1 in [b["id"] for b in res.json()["data"]]


def test_lich_04_loc_theo_trang_thai_va_ngay(client):
    a = auth(client, CUSTOMER_A)
    booking_id = book(client, a, 3, U, [8]).json()["data"]["booking_id"]
    pending = bookings(client, a, status="PENDING_DEPOSIT", **one_day(U)).json()["data"]
    assert booking_id in [b["id"] for b in pending]
    assert {(b["status"], b["play_date"]) for b in pending} == {("PENDING_DEPOSIT", U.isoformat())}
    deposited = bookings(client, a, status="DEPOSITED", **one_day(U)).json()["data"]
    assert booking_id not in [b["id"] for b in deposited]


def test_lich_05_xem_chi_tiet_don(client):
    a = auth(client, CUSTOMER_A)
    booking_id = book(client, a, 1, U, [17]).json()["data"]["booking_id"]
    res = client.get(f"{API}/bookings/{booking_id}", headers=a)
    assert res.status_code == 200
    data = res.json()["data"]
    assert [(s["multiplier"], s["final_price"]) for s in data["slots"]] == [(1.30, 130000)]
    summary = data["pricing_summary"]
    assert (summary["total_amount"], summary["deposit_amount"], summary["remaining_amount_due_at_court"]) == (
        130000, 39000, 91000)


def test_lich_06_xem_chi_tiet_don_khong_thuoc_quyen(client):
    for email in (CUSTOMER_A, OWNER2):
        res = client.get(f"{API}/bookings/1", headers=auth(client, email))
        assert res.status_code == 403
        assert res.json()["error"]["code"] == "AUTH_FORBIDDEN"


def test_lich_07_chua_dang_nhap(client):
    res = client.get(f"{API}/bookings")
    assert res.status_code == 401
    assert res.json()["error"]["code"] == "AUTH_UNAUTHORIZED"
