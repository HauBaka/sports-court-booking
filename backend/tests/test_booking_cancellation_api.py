from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, time, timedelta
from threading import Barrier

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.api.deps import get_db
from app.api.v1.endpoints import bookings
from app.core.database import Base
from app.main import app
from app.models.booking import Booking, BookingSlot
from app.models.facility import Court, CourtSlot, Sport, TimeSlot
from app.models.user import User, UserRole
from app.models.wallet import Wallet, WalletTransaction
from tests.db_support import ADMIN_ID, CUSTOMER_ID, OWNER_A_ID, auth_header, seed_users_and_facilities


NOW = datetime(2026, 11, 9, 12, tzinfo=bookings.VN_TZ)
PLAY_DATE = "2026-11-10"
BASE_PATH = "/api/v1/bookings"
SYSTEM_ID = 90
OTHER_CUSTOMER_ID = 91


@pytest.fixture
def cancellation_api(tmp_path, monkeypatch):
    engine = create_engine(f"sqlite:///{tmp_path / 'cancellation.db'}")
    sessions = sessionmaker(bind=engine, autoflush=False)
    Base.metadata.create_all(engine)
    with sessions() as db:
        seed_users_and_facilities(db)
        db.add_all([
            User(id=SYSTEM_ID, name="Hệ thống", email="system@example.com", phone="0900000090",
                 password_hash="unused", is_system=True),
            User(id=OTHER_CUSTOMER_ID, name="Khách khác", email="other@example.com", phone="0900000091",
                 password_hash="unused"),
            Sport(id=1, name="Cầu lông"),
            TimeSlot(id=1, start_time=time(18), end_time=time(19), duration_minutes=60),
        ])
        db.flush()
        db.add(Court(id=1, facility_id=1, sport_id=1, name="Sân 1", open_time=time(6), close_time=time(23)))
        db.flush()
        db.add_all([
            UserRole(user_id=OTHER_CUSTOMER_ID, role_id=1),
            Wallet(user_id=CUSTOMER_ID, balance=100_000),
            Wallet(user_id=OWNER_A_ID, balance=0),
            Wallet(user_id=SYSTEM_ID, balance=0),
            CourtSlot(court_id=1, time_slot_id=1, base_price=130_000, is_active=True),
        ])
        db.commit()

    def override_get_db():
        with sessions() as db:
            yield db

    monkeypatch.setitem(app.dependency_overrides, get_db, override_get_db)
    monkeypatch.setattr(bookings, "now_vn", lambda: NOW)
    try:
        with TestClient(app) as client:
            yield client, sessions
    finally:
        engine.dispose()


def book_slot(client, *, paid=False):
    headers = auth_header(CUSTOMER_ID)
    response = client.post(BASE_PATH, headers=headers, json={
        "court_id": 1, "play_date": PLAY_DATE, "time_slot_ids": [1],
    })
    assert response.status_code == 201, response.json()
    booking_id = response.json()["data"]["booking_id"]
    if paid:
        response = client.post(f"{BASE_PATH}/{booking_id}/deposit", headers=headers)
        assert response.status_code == 200, response.json()
    return booking_id


def preview(client, booking_id, user_id=CUSTOMER_ID):
    return client.get(f"{BASE_PATH}/{booking_id}/cancel-preview", headers=auth_header(user_id))


def cancel(client, booking_id, user_id=CUSTOMER_ID):
    return client.post(
        f"{BASE_PATH}/{booking_id}/cancel", headers=auth_header(user_id), json={"cancel_reason": "Bận việc"},
    )


def test_pending_booking_preview_can_be_followed_by_cancellation_and_rebooking(cancellation_api):
    client, sessions = cancellation_api
    booking_id = book_slot(client)

    response = preview(client, booking_id)
    assert response.status_code == 200
    data = response.json()["data"]
    assert data["booking_id"] == booking_id
    assert data["deposit_amount_paid"] == data["cancellation_evaluation"]["refund_percentage"] == 0
    assert data["cancellation_evaluation"]["penalty_percentage"] == 0
    assert data["financial_result"]["refund_amount_to_player"] == 0
    assert data["financial_result"]["penalty_amount_to_facility"] == 0
    assert "chưa thanh toán cọc" in data["financial_result"]["customer_display_message"]
    with sessions() as db:
        assert db.get(Booking, booking_id).status == "PENDING_DEPOSIT"
        assert db.query(BookingSlot).one().released_at is None

    response = cancel(client, booking_id)
    assert response.status_code == 200
    assert response.json()["data"] == {
        "booking_id": booking_id, "status": "CANCELLED", "hours_until_start": 30.0,
        "refund_percentage": 0, "refunded_to_customer_wallet": 0,
        "compensated_to_facility_wallet": 0, "customer_new_wallet_balance": 100_000,
    }
    with sessions() as db:
        booking = db.get(Booking, booking_id)
        assert booking.status == "CANCELLED" and booking.cancel_reason == "Bận việc"
        assert booking.cancelled_at == db.query(BookingSlot).one().released_at == NOW.replace(tzinfo=None)
        assert db.query(WalletTransaction).count() == 0
        assert db.query(Wallet).filter_by(user_id=CUSTOMER_ID).one().balance == 100_000

    assert book_slot(client) != booking_id


@pytest.mark.parametrize(("hours", "percent", "refund_amount"), [(30, 80, 31_200), (18, 50, 19_500), (6, 0, 0)])
def test_paid_cancellation_matches_preview_and_transfers_once(cancellation_api, monkeypatch, hours, percent, refund_amount):
    client, sessions = cancellation_api
    booking_id = book_slot(client, paid=True)
    evaluated_at = NOW + timedelta(hours=30 - hours)
    monkeypatch.setattr(bookings, "now_vn", lambda: evaluated_at)

    response = preview(client, booking_id)
    assert response.status_code == 200
    data = response.json()["data"]
    assert data["deposit_amount_paid"] == 39_000
    assert data["schedule_info"] == {"play_date": PLAY_DATE, "start_at": "2026-11-10T11:00:00Z"}
    evaluation = data["cancellation_evaluation"]
    assert evaluation["evaluated_at"] == bookings.booking_time_to_utc(evaluated_at).strftime("%Y-%m-%dT%H:%M:%SZ")
    assert evaluation["hours_until_start"] == hours
    assert evaluation["refund_percentage"] == percent and evaluation["penalty_percentage"] == 100 - percent
    financial_result = data["financial_result"]

    response = cancel(client, booking_id)
    assert response.status_code == 200
    data = response.json()["data"]
    assert data["refunded_to_customer_wallet"] == financial_result["refund_amount_to_player"] == refund_amount
    assert data["compensated_to_facility_wallet"] == financial_result["penalty_amount_to_facility"] == 39_000 - refund_amount
    assert data["customer_new_wallet_balance"] == 61_000 + refund_amount

    duplicate = cancel(client, booking_id)
    assert duplicate.status_code == 400 and duplicate.json()["error"]["code"] == "CANNOT_CANCEL_BOOKING"
    with sessions() as db:
        assert {wallet.user_id: wallet.balance for wallet in db.query(Wallet)} == {
            CUSTOMER_ID: 61_000 + refund_amount, OWNER_A_ID: 39_000 - refund_amount, SYSTEM_ID: 0,
        }
        transactions = db.query(WalletTransaction).filter_by(related_booking_id=booking_id).all()
        expected = {"DEPOSIT": 39_000, "FORFEIT": 39_000 - refund_amount}
        if refund_amount:
            expected["REFUND"] = refund_amount
        assert len(transactions) == len(expected)
        assert {tx.type: tx.amount for tx in transactions} == expected
        # chk_wt_shape yêu cầu created_by là NULL với giao dịch gắn với booking.
        assert all(tx.created_by is None and tx.from_wallet_id is not None for tx in transactions)


def test_cancellation_permissions_and_missing_booking(cancellation_api):
    client, _ = cancellation_api
    booking_id = book_slot(client)

    for action in (preview, cancel):
        forbidden = action(client, booking_id, OTHER_CUSTOMER_ID)
        assert forbidden.status_code == 403 and forbidden.json()["error"]["code"] == "AUTH_FORBIDDEN"
        missing = action(client, booking_id + 1)
        assert missing.status_code == 404 and missing.json()["error"]["code"] == "BOOKING_NOT_FOUND"

    assert preview(client, booking_id, ADMIN_ID).status_code == 403
    assert cancel(client, booking_id, ADMIN_ID).status_code == 200


@pytest.mark.parametrize(("booking_status", "hours_left"), [("DEPOSITED", 0), ("DEPOSITED", -1), ("COMPLETED", 30)])
def test_cancellation_rejects_ineligible_booking(cancellation_api, monkeypatch, booking_status, hours_left):
    client, sessions = cancellation_api
    booking_id = book_slot(client, paid=True)
    with sessions() as db:
        db.get(Booking, booking_id).status = booking_status
        db.commit()
    monkeypatch.setattr(bookings, "now_vn", lambda: NOW + timedelta(hours=30 - hours_left))

    for action in (preview, cancel):
        response = action(client, booking_id)
        assert response.status_code == 400 and response.json()["error"]["code"] == "CANNOT_CANCEL_BOOKING"

    with sessions() as db:
        assert db.get(Booking, booking_id).status == booking_status
        assert db.query(BookingSlot).one().released_at is None
        assert db.query(WalletTransaction).one().type == "DEPOSIT"


def test_second_transfer_failure_rolls_back_cancellation_and_first_transfer(cancellation_api):
    client, sessions = cancellation_api
    booking_id = book_slot(client, paid=True)
    with sessions() as db:
        db.query(Wallet).filter_by(user_id=SYSTEM_ID).one().balance = 31_200
        db.commit()

    response = cancel(client, booking_id)
    assert response.status_code == 402 and response.json()["error"]["code"] == "WALLET_INSUFFICIENT_BALANCE"
    with sessions() as db:
        assert db.get(Booking, booking_id).status == "DEPOSITED"
        assert db.query(BookingSlot).one().released_at is None
        assert db.query(WalletTransaction).one().type == "DEPOSIT"
        assert {wallet.user_id: wallet.balance for wallet in db.query(Wallet)} == {
            CUSTOMER_ID: 61_000, OWNER_A_ID: 0, SYSTEM_ID: 31_200,
        }


def test_simultaneous_cancellation_transfers_only_once(cancellation_api, monkeypatch):
    client, sessions = cancellation_api
    booking_id = book_slot(client, paid=True)
    original_get_booking = bookings._get_booking
    barrier = Barrier(2, timeout=5)

    def load_booking_together(*args, **kwargs):
        booking = original_get_booking(*args, **kwargs)
        # SQLite bỏ qua FOR UPDATE. Ép hai request cùng đọc trạng thái cũ trước khi cập nhật.
        barrier.wait()
        return booking

    monkeypatch.setattr(bookings, "_get_booking", load_booking_together)
    with ThreadPoolExecutor(max_workers=2) as executor:
        futures = [executor.submit(cancel, client, booking_id) for _ in range(2)]
        responses = [future.result(timeout=10) for future in futures]

    successful, rejected = sorted(responses, key=lambda response: response.status_code)
    assert successful.status_code == 200
    assert rejected.status_code == 400 and rejected.json()["error"]["code"] == "CANNOT_CANCEL_BOOKING"
    with sessions() as db:
        assert db.get(Booking, booking_id).status == "CANCELLED"
        transactions = db.query(WalletTransaction).all()
        assert len(transactions) == 3
        assert {tx.type: tx.amount for tx in transactions} == {
            "DEPOSIT": 39_000, "REFUND": 31_200, "FORFEIT": 7_800,
        }
