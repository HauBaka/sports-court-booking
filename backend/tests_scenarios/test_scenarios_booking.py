"""Kịch bản đặt sân, đặt cọc, ví (docs/test-scenarios.md mục 6). Chạy trên CSDL vừa nạp seed S2, S3.
Mỗi ca dùng một khung giờ riêng (bảng cuối mục 6). Chạy lại phải nạp lại seed."""
import uuid
from datetime import date, timedelta

import pytest

from .helpers import API, auth, execute, next_tuesday, register, scalar, slot_id

CUSTOMER_A, CUSTOMER_B, ADMIN, OWNER = "customer.a@scb.vn", "customer.b@scb.vn", "admin@scb.vn", "owner1@scb.vn"
T = next_tuesday()
TOMORROW = date.today() + timedelta(days=1)

skip_booking = pytest.mark.skip(reason="Chờ SCB-145: POST /bookings")
skip_deposit = pytest.mark.skip(reason="Chờ SCB-145, SCB-151: POST /bookings, POST /bookings/{id}/deposit")
skip_wallet = pytest.mark.skip(reason="Chờ SCB-150: API ví 5.1 đến 5.4")


def book(client, headers, court_id, play_date, hours, **extra):
    return client.post(f"{API}/bookings", headers=headers, json={
        "court_id": court_id, "play_date": play_date.isoformat(),
        "time_slot_ids": [slot_id(h) for h in hours], "services": [], **extra,
    })


def deposit(client, headers, booking_id):
    return client.post(f"{API}/bookings/{booking_id}/deposit", headers=headers)


def balance(email):
    return scalar("SELECT w.balance FROM wallets w JOIN users u ON u.id = w.user_id WHERE u.email = :e", e=email)


def system_balance():
    return scalar("SELECT balance FROM wallets WHERE id = 1")


def deposit_count(booking_id):
    return scalar("SELECT COUNT(*) FROM wallet_transactions WHERE type = 'DEPOSIT' AND related_booking_id = :b", b=booking_id)


def slot_status(client, headers, court_id, play_date, hour):
    res = client.get(f"{API}/courts/{court_id}/slots", params={"date": play_date.isoformat()}, headers=headers)
    return next(s["status"] for s in res.json()["data"]["slots"] if s["time_slot_id"] == slot_id(hour))


def expire(booking_id):
    # Không chờ 10 phút: đẩy hạn giữ chỗ về quá khứ
    execute("UPDATE bookings SET hold_expires_at = NOW() - INTERVAL 1 MINUTE WHERE id = :b", b=booking_id)


def new_customer(client, amount):
    """Khách mới ví 0đ, Admin cấp `amount` bằng 5.3."""
    email = f"coc.{uuid.uuid4().hex[:8]}@scb.vn"
    user_id = register(client, email, "09" + str(uuid.uuid4().int)[:8]).json()["data"]["id"]
    client.post(f"{API}/admin/wallet-topups", headers=auth(client, ADMIN), json={"user_id": user_id, "amount": amount})
    return email


@skip_booking
def test_gia_09_doi_bang_gia_sau_khi_co_don(client):
    a, owner = auth(client, CUSTOMER_A), auth(client, OWNER)
    rules = client.get(f"{API}/facilities/1/pricing-rules", headers=owner).json()["data"]
    first = book(client, a, 1, T, [20]).json()["data"]
    assert first["total_amount"] == 130000
    changed = [{**r, "multiplier": 1.50} if r["rule_type"] == "PEAK_HOUR" else r for r in rules]
    try:
        assert client.post(f"{API}/facilities/1/pricing-rules", headers=owner, json={"rules": changed}).status_code == 200
        second = book(client, a, 2, T, [20]).json()["data"]
        assert second["total_amount"] == 150000
        assert second["deposit_amount_required"] == 45000
        assert scalar("SELECT total_amount FROM bookings WHERE id = :b", b=first["booking_id"]) == 130000
    finally:
        client.post(f"{API}/facilities/1/pricing-rules", headers=owner, json={"rules": rules})


@skip_booking
def test_gia_10_bo_qua_so_tien_client_gui(client):
    res = book(client, auth(client, CUSTOMER_A), 1, T, [19], total_amount=1000, deposit_amount=300)
    data = res.json()["data"]
    assert data["total_amount"] == 130000
    assert data["deposit_amount_required"] == 39000


@pytest.mark.skip(reason="Chờ SCB-145, SCB-141: POST /bookings, GET /courts/{id}/slots")
def test_dat_01_tao_don_hop_le(client):
    a = auth(client, CUSTOMER_A)
    tx_before = scalar("SELECT COUNT(*) FROM wallet_transactions")
    res = book(client, a, 1, T, [10])
    assert res.status_code == 201
    data = res.json()["data"]
    assert data["status"] == "PENDING_DEPOSIT"
    assert data["total_amount"] == 100000
    assert data["deposit_amount_required"] == 30000
    assert slot_status(client, a, 1, T, 10) == "HOLDING"
    assert balance(CUSTOMER_A) == 500000
    assert scalar("SELECT COUNT(*) FROM wallet_transactions") == tx_before


@pytest.mark.skip(reason="Chờ SCB-145, SCB-146, SCB-141: POST /bookings, expire-holds, GET slots")
def test_dat_02_het_han_giu_cho_va_coc_08(client):
    a = auth(client, CUSTOMER_A)
    booking_id = book(client, a, 2, T, [6]).json()["data"]["booking_id"]
    expire(booking_id)
    assert client.post(f"{API}/admin/bookings/expire-holds", headers=auth(client, ADMIN)).status_code == 200
    assert scalar("SELECT status FROM bookings WHERE id = :b", b=booking_id) == "CANCELLED"
    assert slot_status(client, a, 2, T, 6) == "AVAILABLE"
    assert balance(CUSTOMER_A) == 500000
    # COC-08: cọc đơn đã hủy
    res = deposit(client, a, booking_id)
    assert res.status_code == 400
    assert res.json()["error"]["code"] == "CANNOT_DEPOSIT_EXPIRED_BOOKING"
    assert balance(CUSTOMER_A) == 500000


@skip_booking
def test_dat_04_khung_gio_da_qua(client):
    res = book(client, auth(client, CUSTOMER_A), 1, date.today() - timedelta(days=1), [10])
    assert res.status_code == 400
    assert res.json()["error"]["code"] == "INVALID_BOOKING_TIME"


@skip_booking
def test_dat_06_chua_dang_nhap(client):
    res = book(client, {}, 1, T, [11])
    assert res.status_code == 401
    assert res.json()["error"]["code"] == "AUTH_UNAUTHORIZED"


@skip_deposit
def test_coc_01_coc_don_hop_le(client):
    a = auth(client, CUSTOMER_A)
    a_before, sys_before = balance(CUSTOMER_A), system_balance()
    booking_id = book(client, a, 1, T, [18]).json()["data"]["booking_id"]
    res = deposit(client, a, booking_id)
    assert res.status_code == 200
    data = res.json()["data"]
    assert data["status"] == "DEPOSITED"
    assert data["deposit_amount_paid"] == 39000
    assert data["remaining_amount_due_at_court"] == 91000
    assert balance(CUSTOMER_A) == a_before - 39000
    assert system_balance() == sys_before + 39000
    assert deposit_count(booking_id) == 1


@pytest.mark.skip(reason="Chờ SCB-137, SCB-150, SCB-145, SCB-151: đăng ký có OTP, cấp tiền, đặt sân, đặt cọc")
@pytest.mark.parametrize("code, amount, hour, ok", [("coc_02", 39000, 18, True), ("coc_03", 38999, 19, False)])
def test_coc_02_03_so_du_bien(client, code, amount, hour, ok):
    email = new_customer(client, amount)
    headers = auth(client, email)
    booking_id = book(client, headers, 2, T, [hour]).json()["data"]["booking_id"]
    res = deposit(client, headers, booking_id)
    if ok:  # COC-02: số dư đúng bằng tiền cọc
        assert res.status_code == 200
        assert balance(email) == 0
    else:  # COC-03: thiếu 1đ
        assert res.status_code == 402
        assert res.json()["error"]["code"] == "WALLET_INSUFFICIENT_BALANCE"
        assert balance(email) == amount
        assert scalar("SELECT status FROM bookings WHERE id = :b", b=booking_id) == "PENDING_DEPOSIT"
        assert deposit_count(booking_id) == 0


@skip_deposit
def test_coc_04_coc_don_het_han(client):
    a = auth(client, CUSTOMER_A)
    before = balance(CUSTOMER_A)
    booking_id = book(client, a, 1, T, [6]).json()["data"]["booking_id"]
    expire(booking_id)
    res = deposit(client, a, booking_id)
    assert res.status_code == 400
    assert res.json()["error"]["code"] == "CANNOT_DEPOSIT_EXPIRED_BOOKING"
    assert balance(CUSTOMER_A) == before


@skip_deposit
def test_coc_05_gui_coc_hai_lan(client):
    a = auth(client, CUSTOMER_A)
    before = balance(CUSTOMER_A)
    booking_id = book(client, a, 1, T, [7]).json()["data"]["booking_id"]
    assert deposit(client, a, booking_id).status_code == 200
    assert deposit(client, a, booking_id).status_code >= 400
    assert balance(CUSTOMER_A) == before - 30000
    assert deposit_count(booking_id) == 1


@skip_deposit
def test_coc_07_coc_don_nguoi_khac(client):
    booking_id = book(client, auth(client, CUSTOMER_A), 1, T, [11]).json()["data"]["booking_id"]
    res = deposit(client, auth(client, CUSTOMER_B), booking_id)
    assert res.status_code == 403
    assert res.json()["error"]["code"] == "AUTH_FORBIDDEN"
    assert balance(CUSTOMER_B) == 200000
    assert scalar("SELECT status FROM bookings WHERE id = :b", b=booking_id) == "PENDING_DEPOSIT"


@skip_booking
def test_trung_01_dat_khung_da_coc(client):
    bookings_before = scalar("SELECT COUNT(*) FROM bookings")
    res = book(client, auth(client, CUSTOMER_A), 1, TOMORROW, [8])
    assert res.status_code == 409
    assert res.json()["error"]["code"] == "SLOT_ALREADY_BOOKED"
    assert scalar("SELECT COUNT(*) FROM bookings") == bookings_before
    assert balance(CUSTOMER_A) == 500000


@pytest.mark.skip(reason="Chờ SCB-145, SCB-141: POST /bookings, GET /courts/{id}/slots")
def test_trung_03_nhieu_khung_mot_khung_trung(client):
    a = auth(client, CUSTOMER_A)
    res = book(client, a, 1, TOMORROW, [7, 8])
    assert res.status_code == 409
    assert res.json()["error"]["code"] == "SLOT_ALREADY_BOOKED"
    assert slot_status(client, a, 1, TOMORROW, 7) == "AVAILABLE"


@skip_booking
def test_trung_04_khung_lien_ke_khac_san(client):
    a = auth(client, CUSTOMER_A)
    assert book(client, a, 1, TOMORROW, [10]).status_code == 201
    assert book(client, a, 2, TOMORROW, [8]).status_code == 201


@skip_wallet
def test_vi_01_admin_cap_tien(client):
    before = balance(CUSTOMER_B)
    res = client.post(f"{API}/admin/wallet-topups", headers=auth(client, ADMIN), json={"user_id": 6, "amount": 100000})
    assert res.status_code == 200
    assert balance(CUSTOMER_B) == before + 100000
    tx = client.get(f"{API}/wallets/me/transactions", headers=auth(client, CUSTOMER_B)).json()["data"][0]
    assert tx["type"] == "TOPUP"
    assert tx["amount"] == 100000
    assert scalar("SELECT created_by FROM wallet_transactions WHERE id = :t", t=tx["id"]) == 2  # admin


@skip_wallet
@pytest.mark.parametrize("amount", [0, -1000, 1000.5])
def test_vi_02_so_tien_cap_sai(client, amount):
    before = balance(CUSTOMER_B)
    res = client.post(f"{API}/admin/wallet-topups", headers=auth(client, ADMIN), json={"user_id": 6, "amount": amount})
    assert res.status_code == 422
    assert res.json()["error"]["code"] == "VALIDATION_ERROR"
    assert balance(CUSTOMER_B) == before


@skip_wallet
def test_vi_03_khong_phai_admin_cap_tien(client):
    before = balance(CUSTOMER_A)
    res = client.post(f"{API}/admin/wallet-topups", headers=auth(client, CUSTOMER_A), json={"user_id": 5, "amount": 100000})
    assert res.status_code == 403
    assert res.json()["error"]["code"] == "AUTH_FORBIDDEN"
    assert balance(CUSTOMER_A) == before


@skip_wallet
def test_vi_04_xem_lich_su_giao_dich(client):
    b = auth(client, CUSTOMER_B)
    wallet_id = scalar("SELECT id FROM wallets WHERE user_id = 6")
    txs = client.get(f"{API}/wallets/me/transactions", headers=b).json()["data"]
    assert {"TOPUP", "DEPOSIT"} <= {t["type"] for t in txs}
    own = scalar("SELECT COUNT(*) FROM wallet_transactions WHERE from_wallet_id = :w OR to_wallet_id = :w", w=wallet_id)
    assert len(txs) == own  # không lẫn giao dịch của ví khác
    deposits = client.get(f"{API}/wallets/me/transactions", headers=b, params={"type": "DEPOSIT"}).json()["data"]
    assert [(t["amount"], t["related_booking_id"]) for t in deposits] == [(100000, 1)]


@skip_wallet
def test_vi_06_admin_tim_nguoi_dung(client):
    res = client.get(f"{API}/admin/users", headers=auth(client, ADMIN), params={"search": "customer.a"})
    users = res.json()["data"]
    assert [u["id"] for u in users] == [5]
    assert users[0]["balance"] == balance(CUSTOMER_A)
    res = client.get(f"{API}/admin/users", headers=auth(client, CUSTOMER_A), params={"search": "customer.a"})
    assert res.status_code == 403
