"""TRUNG-05: Hai request thực sự cạnh tranh trên MariaDB đã nạp migrations/seeds.

Chạy cùng tests_scenarios/ bằng cấu hình docker-compose.test.yml (cổng 3307).
Không override get_db và không dùng SQLite/create_all để thay thế schema thật.
"""
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, time, timedelta
from threading import Barrier, Lock
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import event, text

from app.api.v1.endpoints.bookings import VN_TZ
from app.core.database import SessionLocal, engine
from app.core.security import create_access_token
from app.main import app
from app.models.booking import Booking, BookingService, BookingSlot
from app.models.facility import Court, CourtSlot, Facility, Service, TimeSlot
from app.models.wallet import Wallet


@pytest.fixture
def booking_race_data():
    """Tạo sân riêng để không chiếm các slot hoặc thay đổi ví trong dữ liệu seed."""
    with SessionLocal.begin() as db:
        version = db.execute(text("SELECT VERSION()")).scalar_one()
        assert "mariadb" in version.lower(), "TRUNG-05 phải chạy trên MariaDB thật"
        assert db.execute(text(
            "SHOW INDEX FROM booking_slots WHERE Key_name = 'uq_no_double_booking'"
        )).first() is not None, "Phải nạp migrations có UNIQUE chống trùng slot"

        facility = Facility(
            owner_id=3, name=f"TRUNG-05 {uuid4().hex}", address="Cơ sở kiểm thử",
            city="TP.HCM", open_time=time(6), close_time=time(23), is_active=True,
        )
        db.add(facility)
        db.flush()
        court = Court(
            facility_id=facility.id, sport_id=1, name="Sân test cạnh tranh",
            open_time=time(6), close_time=time(23), is_active=True,
        )
        db.add(court)
        db.flush()  # Trigger MariaDB tự tạo court_slots.
        slot_ids = [slot.id for slot in db.query(TimeSlot).filter(
            TimeSlot.start_time >= time(6), TimeSlot.end_time <= time(23),
        ).order_by(TimeSlot.start_time).limit(2)]
        assert len(slot_ids) == 2
        db.query(CourtSlot).filter(
            CourtSlot.court_id == court.id, CourtSlot.time_slot_id.in_(slot_ids),
        ).update({CourtSlot.base_price: 100000}, synchronize_session=False)
        service = Service(
            facility_id=facility.id, name="Dịch vụ kiểm thử", unit_price=20000, is_active=True,
        )
        db.add(service)
        db.flush()
        data = {
            "court_id": court.id, "facility_id": facility.id, "service_id": service.id,
            "slot_ids": slot_ids,
            "play_date": (datetime.now(VN_TZ).date() + timedelta(days=3)).isoformat(),
        }

    try:
        yield data
    finally:
        # Trigger cấm xóa lịch đặt: nhả slot, hủy đơn và tắt sân test sau mỗi lượt.
        now = datetime.now(VN_TZ).replace(tzinfo=None)
        with SessionLocal.begin() as db:
            db.query(BookingSlot).filter(BookingSlot.court_id == data["court_id"]).update(
                {BookingSlot.released_at: now}, synchronize_session=False,
            )
            db.query(Booking).filter(Booking.court_id == data["court_id"]).update({
                Booking.status: "CANCELLED", Booking.cancelled_at: now,
                Booking.cancel_reason: "Dọn dữ liệu test TRUNG-05",
            }, synchronize_session=False)
            db.query(Court).filter(Court.id == data["court_id"]).update({Court.is_active: False})
            db.query(Facility).filter(Facility.id == data["facility_id"]).update({Facility.is_active: False})


@pytest.mark.parametrize("overlapping_slots", [False, True], ids=["same-slot", "overlapping-multi-slot"])
def test_trung_05_concurrent_bookings_on_mariadb(booking_race_data, overlapping_slots):
    data = booking_race_data
    users = [5, 6]  # Hai khách hàng khác nhau sau khi nạp S2/S3.
    requested_slots = [[data["slot_ids"][0]], data["slot_ids"] if overlapping_slots else [data["slot_ids"][0]]]
    with SessionLocal() as db:
        balances_before = dict(db.query(Wallet.user_id, Wallet.balance).filter(Wallet.user_id.in_(users)).all())
    assert set(balances_before) == set(users)

    # Chỉ thả hai SELECT FOR UPDATE khi cả hai transaction đã đến cùng điểm khóa.
    # CONNECTION_ID riêng chứng minh request dùng hai kết nối DB độc lập.
    at_lock = Barrier(2, timeout=10)
    guard = Lock()
    connection_ids = set()

    def synchronize_slot_locks(conn, cursor, statement, parameters, context, executemany):
        if "FROM court_slots" in statement and "FOR UPDATE" in statement:
            with guard:
                connection_ids.add(conn.connection.driver_connection.thread_id())
            at_lock.wait()

    def book(index):
        token = create_access_token(data={"sub": str(users[index]), "roles": ["customer"]})
        with TestClient(app) as client:
            return client.post("/api/v1/bookings", json={
                "court_id": data["court_id"], "play_date": data["play_date"],
                "time_slot_ids": requested_slots[index],
                "services": [{"service_id": data["service_id"], "quantity": 1}],
            }, headers={"Authorization": f"Bearer {token}"})

    event.listen(engine, "before_cursor_execute", synchronize_slot_locks)
    try:
        with ThreadPoolExecutor(max_workers=2) as executor:
            futures = [executor.submit(book, i) for i in range(2)]
            responses = [future.result(timeout=25) for future in futures]
    finally:
        event.remove(engine, "before_cursor_execute", synchronize_slot_locks)

    assert len(connection_ids) == 2
    assert sorted(response.status_code for response in responses) == [201, 409], [r.text for r in responses]
    winner = next(i for i, response in enumerate(responses) if response.status_code == 201)
    assert responses[1 - winner].json()["error"]["code"] == "SLOT_ALREADY_BOOKED"

    with SessionLocal() as db:
        bookings = db.query(Booking).filter(Booking.court_id == data["court_id"]).all()
        assert len(bookings) == 1  # Không còn đơn hoặc chi tiết dở dang của request thua.
        booking = bookings[0]
        assert booking.id == responses[winner].json()["data"]["booking_id"]
        assert booking.user_id == users[winner]
        assert booking.status == "PENDING_DEPOSIT"
        slots = db.query(BookingSlot).filter(BookingSlot.court_id == data["court_id"]).all()
        assert {slot.time_slot_id for slot in slots} == set(requested_slots[winner])
        assert len(slots) == len(requested_slots[winner])
        assert all(slot.booking_id == booking.id and slot.released_at is None for slot in slots)
        assert db.query(BookingService).filter(BookingService.service_id == data["service_id"]).count() == 1
        assert dict(db.query(Wallet.user_id, Wallet.balance).filter(Wallet.user_id.in_(users)).all()) == balances_before
        assert db.execute(text(
            "SELECT COUNT(*) FROM wallet_transactions WHERE related_booking_id = :booking_id"
        ), {"booking_id": booking.id}).scalar_one() == 0
