"""KT-04, VI-05: kết toán đồng thời (4.3) trên MariaDB đã nạp migrations/seeds.

Chạy cùng tests_scenarios/ bằng cấu hình docker-compose.test.yml (cổng 3307).
"""
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, time, timedelta
from threading import Barrier

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import event

from app.api.v1.endpoints.bookings import VN_TZ
from app.core.database import SessionLocal, engine
from app.main import app
from app.models.booking import Booking
from app.models.facility import Court, Facility

from .helpers import API, auth, register, scalar

ADMIN, OWNER = "admin@scb.vn", "owner1@scb.vn"
DEPOSIT = 30000


@pytest.fixture
def deposited_bookings(client):
    """Hai đơn đã cọc và đã đến giờ chơi, trên sân riêng, của một khách mới (không đụng số dư seed)."""
    suffix = datetime.now().strftime("%H%M%S%f")
    email = f"kt.{suffix}@scb.vn"
    user_id = register(client, email, "08" + suffix[-8:]).json()["data"]["id"]
    client.post(f"{API}/admin/wallet-topups", headers=auth(client, ADMIN),
                json={"user_id": user_id, "amount": 2 * DEPOSIT})

    now = datetime.now(VN_TZ).replace(tzinfo=None)
    start_at = now - timedelta(minutes=5)
    with SessionLocal.begin() as db:
        facility = Facility(owner_id=3, name=f"KT-04 {suffix}", address="Cơ sở kiểm thử", city="TP.HCM",
                            open_time=time(6), close_time=time(23), is_active=True)
        db.add(facility)
        db.flush()
        court = Court(facility_id=facility.id, sport_id=1, name="Sân test kết toán",
                      open_time=time(6), close_time=time(23), is_active=True)
        db.add(court)
        db.flush()
        # API 3.3 không cho đặt giờ đã qua nên tạo thẳng đơn chờ cọc, rồi cọc qua API 3.4.
        bookings = [Booking(
            user_id=user_id, court_id=court.id, play_date=start_at.date(), start_at=start_at,
            status="PENDING_DEPOSIT", subtotal=100000, service_total=0, total_amount=100000,
            deposit_amount=DEPOSIT, deposit_percent=30, hold_expires_at=now + timedelta(minutes=10),
        ) for _ in range(2)]
        db.add_all(bookings)
        db.flush()
        ids = [b.id for b in bookings]
        facility_id, court_id = facility.id, court.id

    customer = auth(client, email)
    for booking_id in ids:
        assert client.post(f"{API}/bookings/{booking_id}/deposit", headers=customer).status_code == 200

    try:
        yield ids
    finally:
        # Trigger cấm xóa đơn và cấm đổi trạng thái đơn COMPLETED nên chỉ tắt sân test.
        with SessionLocal.begin() as db:
            db.query(Court).filter(Court.id == court_id).update({Court.is_active: False})
            db.query(Facility).filter(Facility.id == facility_id).update({Facility.is_active: False})


def settle_concurrently(client, booking_ids):
    """Gọi 4.3 song song, chỉ thả khi cả hai request đã đến lệnh khóa đơn."""
    headers = auth(client, OWNER)
    at_lock = Barrier(2, timeout=10)

    def synchronize_booking_locks(conn, cursor, statement, parameters, context, executemany):
        if "FROM bookings" in statement and "FOR UPDATE" in statement:
            at_lock.wait()

    def settle(booking_id):
        with TestClient(app) as thread_client:
            return thread_client.post(f"{API}/bookings/{booking_id}/complete", headers=headers)

    event.listen(engine, "before_cursor_execute", synchronize_booking_locks)
    try:
        with ThreadPoolExecutor(max_workers=2) as executor:
            futures = [executor.submit(settle, booking_id) for booking_id in booking_ids]
            return [future.result(timeout=25) for future in futures]
    finally:
        event.remove(engine, "before_cursor_execute", synchronize_booking_locks)


def total_balance():
    return scalar("SELECT SUM(balance) FROM wallets")


def owner_balance():
    return scalar("SELECT balance FROM wallets WHERE user_id = 3")


def settle_count(booking_id):
    return scalar("SELECT COUNT(*) FROM wallet_transactions WHERE type = 'SETTLE' AND related_booking_id = :b",
                  b=booking_id)


def test_kt_04_ket_toan_dong_thoi_mot_don(client, deposited_bookings):
    booking_id = deposited_bookings[0]
    total_before, owner_before = total_balance(), owner_balance()

    responses = settle_concurrently(client, [booking_id, booking_id])

    assert sorted(r.status_code for r in responses) == [200, 400], [r.text for r in responses]
    loser = next(r for r in responses if r.status_code == 400)
    assert loser.json()["error"]["code"] == "CANNOT_SETTLE_BOOKING"
    assert settle_count(booking_id) == 1
    assert owner_balance() == owner_before + DEPOSIT
    assert total_balance() == total_before
    assert scalar("SELECT status FROM bookings WHERE id = :b", b=booking_id) == "COMPLETED"


def test_vi_05_ket_toan_dong_thoi_hai_don_chung_vi(client, deposited_bookings):
    total_before, owner_before = total_balance(), owner_balance()

    responses = settle_concurrently(client, deposited_bookings)

    assert [r.status_code for r in responses] == [200, 200], [r.text for r in responses]
    assert [settle_count(b) for b in deposited_bookings] == [1, 1]
    assert owner_balance() == owner_before + 2 * DEPOSIT  # không mất cập nhật số dư
    assert total_balance() == total_before
