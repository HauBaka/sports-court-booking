"""KT-04, VI-05: kết toán (4.3) chạy đồng thời và lỗi giữa chừng, trên MariaDB đã nạp migrations/seeds.

Chạy cùng tests_scenarios/ bằng cấu hình docker-compose.test.yml (cổng 3307).
"""
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, time, timedelta
from threading import Barrier, Event

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import event

from app.api.v1.endpoints import bookings as bookings_ep
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


def customer_of(booking_id):
    """(email, wallet_id) của khách đặt đơn."""
    sql = "SELECT {} FROM bookings b JOIN users u ON u.id = b.user_id JOIN wallets w ON w.user_id = u.id WHERE b.id = :b"
    return scalar(sql.format("u.email"), b=booking_id), scalar(sql.format("w.id"), b=booking_id)


def money_state(booking_id):
    """Trạng thái đơn, số dư các ví liên quan và số giao dịch của đơn theo từng loại."""
    _, wallet_id = customer_of(booking_id)
    return {
        "status": scalar("SELECT status FROM bookings WHERE id = :b", b=booking_id),
        "system": scalar("SELECT balance FROM wallets WHERE id = 1"),
        "owner": owner_balance(),
        "customer": scalar("SELECT balance FROM wallets WHERE id = :w", w=wallet_id),
        "total": total_balance(),
        **{t: scalar("SELECT COUNT(*) FROM wallet_transactions WHERE related_booking_id = :b AND type = :t",
                     b=booking_id, t=t) for t in ("DEPOSIT", "SETTLE", "REFUND", "FORFEIT")},
    }


def post(url, headers, json=None):
    """Request trong luồng riêng; lỗi server (vd. deadlock) trả về 500 thay vì ném exception ra test."""
    with TestClient(app, raise_server_exceptions=False) as thread_client:
        return thread_client.post(url, headers=headers, json=json)


def test_gui_lai_coc_trong_luc_ket_toan_khong_deadlock(client, deposited_bookings):
    """Request cọc gửi lại (đơn đã cọc) chạy xen với 4.3 trên cùng đơn.

    Ép thứ tự xấu nhất: cọc giữ ví rồi mới để kết toán khóa đơn. Nếu hai API khóa đơn và ví ngược
    thứ tự nhau, MariaDB báo deadlock (1213) và một request nhận 500.
    """
    booking_id = deposited_bookings[0]
    email, wallet_id = customer_of(booking_id)
    customer, owner = auth(client, email), auth(client, OWNER)
    before = money_state(booking_id)
    deposit_has_wallets, settle_has_booking = Event(), Event()

    def interleave(conn, cursor, statement, parameters, context, executemany):
        if "FOR UPDATE" not in statement:
            return
        if "FROM wallets" in statement and wallet_id in parameters.values() and not deposit_has_wallets.is_set():
            deposit_has_wallets.set()
            # Nếu cọc đã khóa đơn trước thì kết toán không lấy được đơn: hết 2 giây thì đi tiếp.
            settle_has_booking.wait(timeout=2)
        elif "FROM bookings" in statement and deposit_has_wallets.is_set():
            settle_has_booking.set()

    event.listen(engine, "after_cursor_execute", interleave)
    try:
        with ThreadPoolExecutor(max_workers=2) as executor:
            retry = executor.submit(post, f"{API}/bookings/{booking_id}/deposit", customer)
            assert deposit_has_wallets.wait(timeout=10)
            settle = executor.submit(post, f"{API}/bookings/{booking_id}/complete", owner)
            retry, settle = retry.result(timeout=25), settle.result(timeout=25)
    finally:
        event.remove(engine, "after_cursor_execute", interleave)

    assert (retry.status_code, settle.status_code) == (400, 200), [retry.text, settle.text]
    assert retry.json()["error"]["code"] == "CANNOT_DEPOSIT_EXPIRED_BOOKING"
    assert money_state(booking_id) == {
        **before, "status": "COMPLETED", "SETTLE": 1,
        "system": before["system"] - DEPOSIT, "owner": before["owner"] + DEPOSIT,
    }


@pytest.mark.parametrize("fail_after", ["transfer", "UPDATE bookings"], ids=["sau-chuyen-tien", "sau-doi-trang-thai"])
def test_loi_truoc_commit_thi_rollback_toan_bo(client, deposited_bookings, monkeypatch, fail_after):
    booking_id = deposited_bookings[0]
    owner = auth(client, OWNER)
    before = money_state(booking_id)
    failed = []

    def fail(*args):
        failed.append(True)
        raise RuntimeError("lỗi giả lập trước commit")

    def fail_after_status_update(conn, cursor, statement, parameters, context, executemany):
        if statement.startswith("UPDATE bookings"):
            fail()

    if fail_after == "transfer":
        real_transfer = bookings_ep.transfer
        monkeypatch.setattr(bookings_ep, "transfer", lambda *a, **kw: (real_transfer(*a, **kw), fail()))
    else:
        event.listen(engine, "after_cursor_execute", fail_after_status_update)
    try:
        response = post(f"{API}/bookings/{booking_id}/complete", owner)
    finally:
        monkeypatch.undo()
        if fail_after != "transfer":
            event.remove(engine, "after_cursor_execute", fail_after_status_update)

    assert failed and response.status_code == 500
    assert money_state(booking_id) == before
    # Khóa đã được nhả và đơn còn kết toán lại được đúng một lần.
    assert post(f"{API}/bookings/{booking_id}/complete", owner).status_code == 200
    assert money_state(booking_id)["SETTLE"] == 1


@pytest.mark.skipif("/api/v1/bookings/{id}/cancel" not in app.openapi()["paths"], reason="Chờ API 4.2 (SCB-204)")
@pytest.mark.parametrize("hours, expected", [
    (-1, {"status": "COMPLETED", "SETTLE": 1, "system": -30000, "owner": 30000}),
    (30, {"status": "CANCELLED", "REFUND": 1, "FORFEIT": 1, "system": -30000, "owner": 6000, "customer": 24000}),
], ids=["da-den-gio-ket-toan-thang", "chua-den-gio-huy-thang"])
def test_huy_va_ket_toan_dong_thoi(client, deposited_bookings, hours, expected):
    booking_id = deposited_bookings[0]
    start_at = datetime.now(VN_TZ).replace(tzinfo=None) + timedelta(hours=hours)
    with SessionLocal.begin() as db:  # đơn test không có booking_slots nên đổi được cả ngày chơi
        db.query(Booking).filter(Booking.id == booking_id).update(
            {Booking.start_at: start_at, Booking.play_date: start_at.date()})
    customer, owner = auth(client, customer_of(booking_id)[0]), auth(client, OWNER)
    before = money_state(booking_id)
    at_lock = Barrier(2, timeout=10)

    def synchronize_booking_locks(conn, cursor, statement, parameters, context, executemany):
        if "FROM bookings" in statement and "FOR UPDATE" in statement:
            at_lock.wait()

    event.listen(engine, "before_cursor_execute", synchronize_booking_locks)
    try:
        with ThreadPoolExecutor(max_workers=2) as executor:
            cancel = executor.submit(post, f"{API}/bookings/{booking_id}/cancel", customer, {"cancel_reason": "Bận"})
            settle = executor.submit(post, f"{API}/bookings/{booking_id}/complete", owner)
            cancel, settle = cancel.result(timeout=25), settle.result(timeout=25)
    finally:
        event.remove(engine, "before_cursor_execute", synchronize_booking_locks)

    wanted = (400, 200) if hours < 0 else (200, 400)
    assert (cancel.status_code, settle.status_code) == wanted, [cancel.text, settle.text]
    money = ("system", "owner", "customer")
    assert money_state(booking_id) == {
        **before, **{k: v for k, v in expected.items() if k not in money},
        **{k: before[k] + expected.get(k, 0) for k in money},
    }
