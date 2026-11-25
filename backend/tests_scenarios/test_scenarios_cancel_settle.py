"""Kịch bản hủy, hoàn cọc, kết toán và VI-05 (docs/test-scenarios.md mục 7). Chạy trên CSDL vừa nạp seed S2, S3.
Mỗi ca dùng một khung giờ riêng của ngày U (bảng cuối mục 7). Chạy lại phải nạp lại seed."""
from datetime import datetime, timedelta, timezone

import pytest

from .helpers import (
    ADMIN, API, CUSTOMER_A, CUSTOMER_B, OWNER, OWNER2, auth, balance, book, booking_status, day_u, deposit, execute,
    new_customer, scalar, slot_status, system_balance, tx_count, wait_for,
)

U = day_u()


def deposited(client, prefix, court_id, hour):
    """Khách mới (Admin cấp 100.000đ) đặt 1 khung ngày U rồi cọc."""
    email = new_customer(client, 100000, prefix)
    headers = auth(client, email)
    booking_id = book(client, headers, court_id, U, [hour]).json()["data"]["booking_id"]
    assert deposit(client, headers, booking_id).status_code == 200
    return email, headers, booking_id


def move_start(booking_id, hours):
    # Dời start_at tới mốc cần kiểm. bookings lưu giờ VN, DB chạy UTC nên không dùng NOW() của DB
    start_at = datetime.now(timezone(timedelta(hours=7))).replace(tzinfo=None) + timedelta(hours=hours)
    execute("UPDATE bookings SET start_at = :s WHERE id = :b", s=start_at, b=booking_id)


def cancel(client, headers, booking_id):
    return client.post(f"{API}/bookings/{booking_id}/cancel", headers=headers, json={"cancel_reason": "Bận việc"})


def complete(client, headers, booking_id):
    return client.post(f"{API}/bookings/{booking_id}/complete", headers=headers)


def error_code(res):
    return res.json()["error"]["code"]


@wait_for("SCB-204")
def test_huy_01_huy_tu_24_gio(client):
    email, headers, booking_id = deposited(client, "huy01", 1, 18)
    owner_before, system_before = balance(OWNER), system_balance()
    res = cancel(client, headers, booking_id)
    assert res.status_code == 200
    data = res.json()["data"]
    assert data["status"] == "CANCELLED"
    assert data["refund_percentage"] == 80
    assert data["refunded_to_customer_wallet"] == 31200
    assert data["compensated_to_facility_wallet"] == 7800
    assert data["customer_new_wallet_balance"] == balance(email) == 92200
    assert balance(OWNER) == owner_before + 7800
    assert system_balance() == system_before - 39000
    assert tx_count(booking_id, "REFUND") == tx_count(booking_id, "FORFEIT") == 1
    assert slot_status(client, headers, 1, U, 18) == "AVAILABLE"


@wait_for("SCB-204")
@pytest.mark.parametrize("prefix, hour, hours_left, percent, refund", [
    ("huy02", 19, 18, 50, 19500),
    ("huy03", 20, 6, 0, 0),
])
def test_huy_02_03_muc_hoan_theo_gio(client, prefix, hour, hours_left, percent, refund):
    email, headers, booking_id = deposited(client, prefix, 1, hour)
    move_start(booking_id, hours_left)
    owner_before = balance(OWNER)
    res = cancel(client, headers, booking_id)
    assert res.status_code == 200
    data = res.json()["data"]
    assert data["refund_percentage"] == percent
    assert data["refunded_to_customer_wallet"] == refund
    assert balance(email) == 61000 + refund
    assert balance(OWNER) == owner_before + 39000 - refund
    assert tx_count(booking_id, "REFUND") == (1 if refund else 0)
    assert tx_count(booking_id, "FORFEIT") == 1


@wait_for("SCB-204")
def test_huy_06_huy_don_chua_coc(client):
    a = auth(client, CUSTOMER_A)
    before = balance(CUSTOMER_A)
    booking_id = book(client, a, 2, U, [10]).json()["data"]["booking_id"]
    res = cancel(client, a, booking_id)
    assert res.status_code == 200
    assert res.json()["data"]["status"] == "CANCELLED"
    assert res.json()["data"].get("refunded_to_customer_wallet", 0) == 0
    assert scalar("SELECT COUNT(*) FROM wallet_transactions WHERE related_booking_id = :b", b=booking_id) == 0
    assert balance(CUSTOMER_A) == before
    assert slot_status(client, a, 2, U, 10) == "AVAILABLE"


@wait_for("SCB-204")
def test_huy_07_huy_sau_gio_bat_dau(client):
    email, headers, booking_id = deposited(client, "huy07", 2, 11)
    move_start(booking_id, -1)
    res = cancel(client, headers, booking_id)
    assert res.status_code == 400
    assert error_code(res) == "CANNOT_CANCEL_BOOKING"
    assert booking_status(booking_id) == "DEPOSITED"
    assert balance(email) == 70000


@wait_for("SCB-204")
def test_huy_08_huy_hai_lan(client):
    email, headers, booking_id = deposited(client, "huy08", 2, 12)
    first = cancel(client, headers, booking_id)
    assert first.status_code == 200
    assert first.json()["data"]["refunded_to_customer_wallet"] == 24000
    second = cancel(client, headers, booking_id)
    assert second.status_code == 400
    assert error_code(second) == "CANNOT_CANCEL_BOOKING"
    assert tx_count(booking_id, "REFUND") == tx_count(booking_id, "FORFEIT") == 1
    assert balance(email) == 94000


@wait_for("SCB-204")
def test_huy_09_huy_don_nguoi_khac(client):
    booking_id = book(client, auth(client, CUSTOMER_A), 2, U, [13]).json()["data"]["booking_id"]
    res = cancel(client, auth(client, CUSTOMER_B), booking_id)
    assert res.status_code == 403
    assert error_code(res) == "AUTH_FORBIDDEN"
    assert booking_status(booking_id) == "PENDING_DEPOSIT"


@wait_for("SCB-199", "SCB-204")
def test_huy_10_huy_don_da_hoan_tat(client):
    _, headers, booking_id = deposited(client, "huy10", 2, 14)
    move_start(booking_id, -1)
    assert complete(client, auth(client, OWNER), booking_id).status_code == 200
    move_start(booking_id, 30)
    res = cancel(client, headers, booking_id)
    assert res.status_code == 400
    assert error_code(res) == "CANNOT_CANCEL_BOOKING"
    assert booking_status(booking_id) == "COMPLETED"
    assert tx_count(booking_id, "REFUND") == 0


@wait_for("SCB-204")
def test_huy_11_xem_truoc_bang_hoan_thuc_te(client):
    _, headers, booking_id = deposited(client, "huy11", 2, 15)
    preview = client.get(f"{API}/bookings/{booking_id}/cancel-preview", headers=headers)
    assert preview.status_code == 200
    data = preview.json()["data"]
    assert data["cancellation_evaluation"]["refund_percentage"] == 80
    assert data["financial_result"]["refund_amount_to_player"] == 24000
    assert data["financial_result"]["penalty_amount_to_facility"] == 6000
    done = cancel(client, headers, booking_id).json()["data"]
    assert done["refunded_to_customer_wallet"] == 24000
    assert done["compensated_to_facility_wallet"] == 6000


@wait_for("SCB-199")
def test_kt_01_ket_toan_sau_gio_choi(client):
    _, _, booking_id = deposited(client, "kt01", 2, 18)
    move_start(booking_id, -1)
    owner_before, system_before = balance(OWNER), system_balance()
    res = complete(client, auth(client, OWNER), booking_id)
    assert res.status_code == 200
    data = res.json()["data"]
    assert data["status"] == "COMPLETED"
    assert data["settled_deposit_amount"] == 39000
    assert data["transaction_type"] == "SETTLE"
    assert balance(OWNER) == owner_before + 39000
    assert system_balance() == system_before - 39000
    assert tx_count(booking_id, "SETTLE") == 1


@wait_for("SCB-199")
def test_kt_02_ket_toan_truoc_gio_choi(client):
    _, _, booking_id = deposited(client, "kt02", 2, 19)
    res = complete(client, auth(client, OWNER), booking_id)
    assert res.status_code == 400
    assert error_code(res) == "CANNOT_SETTLE_BEFORE_START"
    assert booking_status(booking_id) == "DEPOSITED"


@wait_for("SCB-199")
def test_kt_03_don_chua_coc_hoac_da_huy(client):
    a, owner = auth(client, CUSTOMER_A), auth(client, OWNER)
    pending = book(client, a, 2, U, [16]).json()["data"]["booking_id"]
    cancelled = book(client, a, 2, U, [17]).json()["data"]["booking_id"]
    execute("UPDATE bookings SET hold_expires_at = NOW() - INTERVAL 1 MINUTE WHERE id = :b", b=cancelled)
    assert client.post(f"{API}/admin/bookings/expire-holds", headers=auth(client, ADMIN)).status_code == 200
    assert booking_status(cancelled) == "CANCELLED"
    owner_before = balance(OWNER)
    for booking_id in (pending, cancelled):
        move_start(booking_id, -1)
        assert complete(client, owner, booking_id).status_code == 400
        assert tx_count(booking_id, "SETTLE") == 0
    assert balance(OWNER) == owner_before


@wait_for("SCB-199")
def test_kt_04_ket_toan_hai_lan(client):
    _, _, booking_id = deposited(client, "kt04", 2, 20)
    move_start(booking_id, -1)
    owner = auth(client, OWNER)
    owner_before = balance(OWNER)
    assert complete(client, owner, booking_id).status_code == 200
    assert complete(client, owner, booking_id).status_code == 400
    assert tx_count(booking_id, "SETTLE") == 1
    assert balance(OWNER) == owner_before + 39000


@wait_for("SCB-199")
def test_kt_05_chu_san_khac_ket_toan(client):
    _, _, booking_id = deposited(client, "kt05", 1, 21)
    move_start(booking_id, -1)
    res = complete(client, auth(client, OWNER2), booking_id)
    assert res.status_code == 403
    assert error_code(res) == "AUTH_FORBIDDEN"
    assert booking_status(booking_id) == "DEPOSITED"
    assert tx_count(booking_id, "SETTLE") == 0


@wait_for("SCB-199", "SCB-204")
def test_vi_05_tong_tien_khong_doi(client):
    email = new_customer(client, 100000, "vi05")
    headers = auth(client, email)
    total_before = scalar("SELECT SUM(balance) FROM wallets")
    first = book(client, headers, 1, U, [6]).json()["data"]["booking_id"]
    assert deposit(client, headers, first).status_code == 200
    assert cancel(client, headers, first).status_code == 200
    second = book(client, headers, 1, U, [7]).json()["data"]["booking_id"]
    assert deposit(client, headers, second).status_code == 200
    move_start(second, -1)
    assert complete(client, auth(client, OWNER), second).status_code == 200
    assert scalar("SELECT SUM(balance) FROM wallets") == total_before
    # Số dư mỗi ví bằng tiền vào trừ tiền ra trong sổ giao dịch
    assert scalar("""
        SELECT COUNT(*) FROM wallets w WHERE w.balance <>
            COALESCE((SELECT SUM(amount) FROM wallet_transactions WHERE to_wallet_id = w.id), 0)
          - COALESCE((SELECT SUM(amount) FROM wallet_transactions WHERE from_wallet_id = w.id), 0)
    """) == 0
