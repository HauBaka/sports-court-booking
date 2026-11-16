# pyright: reportGeneralTypeIssues=false, reportAttributeAccessIssue=false
"""FR-25: email xác nhận đặt cọc. Không gửi mail thật: send_email được thay bằng bản giả."""
from datetime import time

import pytest

from app.core.email_service import EmailSendError
from app.models.booking import Booking, BookingSlot
from app.models.facility import Court, TimeSlot
from app.services import booking_email
from tests.db_support import TestingSessionLocal
from tests.test_wallet_deposit import (  # noqa: F401 — fixture `client`, `wallets` dùng chung
    balance,
    booking_status,
    client,
    deposit,
    make_booking,
    tx_count,
    wallets,
    CUSTOMER_ID,
)


@pytest.fixture(autouse=True)
def court_and_slots(client, wallets):
    db = TestingSessionLocal()
    db.query(BookingSlot).delete(synchronize_session=False)
    db.query(Court).delete(synchronize_session=False)
    db.query(TimeSlot).delete(synchronize_session=False)
    db.add(Court(id=1, facility_id=1, sport_id=1, name="Sân Cầu Lông 1", open_time=time(6), close_time=time(23)))
    db.add_all([
        TimeSlot(id=1, start_time=time(8), end_time=time(9)),
        TimeSlot(id=2, start_time=time(9), end_time=time(10)),
    ])
    db.commit()
    db.close()


def add_slots(bid):
    db = TestingSessionLocal()
    b = db.query(Booking).filter(Booking.id == bid).one()
    for ts in (2, 1):  # cố ý thêm ngược để kiểm tra sắp xếp
        db.add(BookingSlot(booking_id=bid, court_id=1, play_date=b.play_date, time_slot_id=ts,
                           base_price=65_000, final_price=65_000))
    db.commit()
    db.close()


@pytest.fixture
def outbox(monkeypatch):
    sent = []
    monkeypatch.setattr(booking_email, "send_email", lambda to, subject, html: sent.append((to, subject, html)))
    return sent


def test_coc_thanh_cong_gui_mail_day_du_thong_tin(client, outbox):
    bid = make_booking(deposit=39_000)
    add_slots(bid)
    assert deposit(client, bid).status_code == 200
    assert len(outbox) == 1
    to, subject, html = outbox[0]
    assert to == "customer@scb.vn" and f"#{bid}" in subject
    assert "Sân Cầu Lông 1" in html
    assert "08:00-09:00, 09:00-10:00" in html
    assert "39.000đ" in html and "91.000đ" in html  # cọc và tiền còn lại (130.000 - 39.000)


def test_gui_mail_loi_van_200_va_don_van_deposited(client, monkeypatch):
    def boom(*a, **k):
        raise EmailSendError("Brevo sập")

    monkeypatch.setattr(booking_email, "send_email", boom)
    bid = make_booking()
    r = deposit(client, bid)
    assert r.status_code == 200
    assert booking_status(bid) == "DEPOSITED" and balance(CUSTOMER_ID) == 461_000 and tx_count("DEPOSIT") == 1


def test_don_chua_co_slot_van_gui_duoc(client, outbox):
    assert deposit(client, make_booking()).status_code == 200
    assert len(outbox) == 1


@pytest.mark.parametrize("kwargs,code", [
    ({"deposit": 500_001}, 402),
    ({"hold_minutes": -1}, 400),
    ({"status": "CANCELLED"}, 400),
])
def test_coc_that_bai_khong_gui_mail(client, outbox, kwargs, code):
    assert deposit(client, make_booking(**kwargs)).status_code == code
    assert outbox == []
