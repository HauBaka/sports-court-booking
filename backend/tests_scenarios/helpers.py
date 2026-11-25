"""Hàm dùng chung cho test kịch bản. Tài khoản seed xem database/README.md."""
import uuid
from datetime import date, timedelta

import pytest
from sqlalchemy import text

from app.core.database import engine

API = "/api/v1"
PASSWORD = "TestPass123@"  # mật khẩu mọi tài khoản seed
OTP_CODE = "123456"  # mã cố định khi EMAIL_BACKEND=console, không phải production (SCB-136)
CUSTOMER_A, CUSTOMER_B, ADMIN = "customer.a@scb.vn", "customer.b@scb.vn", "admin@scb.vn"
OWNER, OWNER2 = "owner1@scb.vn", "owner2@scb.vn"  # chủ cơ sở 1 (sân 1, 2, 3) và cơ sở 2


def login(client, email, password=PASSWORD):
    return client.post(f"{API}/auth/login", json={"email": email, "password": password})


def auth(client, email, password=PASSWORD):
    return {"Authorization": f"Bearer {login(client, email, password).json()['data']['access_token']}"}


def register(client, email, phone, role="customer", name="Nguyễn Văn A"):
    """Đăng ký có OTP: gửi mã (POST /auth/otp) rồi đăng ký kèm otp_code.
    Trước khi SCB-136 merge, /auth/otp trả 404 và otp_code bị bỏ qua, nên hàm vẫn chạy được."""
    client.post(f"{API}/auth/otp", json={"email": email, "purpose": "REGISTER"})
    return client.post(f"{API}/auth/register", json={
        "name": name, "email": email, "phone": phone, "password": PASSWORD, "role": role, "otp_code": OTP_CODE,
    })


def next_tuesday():
    """Ngày T trong docs/test-scenarios.md mục 6: thứ Ba kế tiếp, không tính hôm nay."""
    today = date.today()
    return today + timedelta(days=(1 - today.weekday()) % 7 or 7)


def day_u():
    """Ngày U trong docs/test-scenarios.md mục 7: thứ Ba sau ngày T."""
    return next_tuesday() + timedelta(days=7)


def wait_for(*tasks):
    """Skip test khi endpoint chưa merge. Bỏ marker khi task BE đã vào dev (SCB-251)."""
    return pytest.mark.skip(reason="Chờ " + ", ".join(tasks))


def slot_id(hour):
    """time_slots trong seed: id 1 là 06:00 đến 07:00, mỗi khung 1 giờ."""
    return hour - 5


def scalar(sql, **params):
    with engine.connect() as conn:
        return conn.execute(text(sql), params).scalar()


def execute(sql, **params):
    with engine.begin() as conn:
        conn.execute(text(sql), params)


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


def tx_count(booking_id, tx_type):
    return scalar("SELECT COUNT(*) FROM wallet_transactions WHERE type = :t AND related_booking_id = :b",
                  t=tx_type, b=booking_id)


def booking_status(booking_id):
    return scalar("SELECT status FROM bookings WHERE id = :b", b=booking_id)


def slot_status(client, headers, court_id, play_date, hour):
    res = client.get(f"{API}/courts/{court_id}/slots", params={"date": play_date.isoformat()}, headers=headers)
    return next(s["status"] for s in res.json()["data"]["slots"] if s["time_slot_id"] == slot_id(hour))


def new_customer(client, amount, prefix="coc"):
    """Khách mới ví 0đ, email theo mã ca, Admin cấp `amount` bằng 5.3."""
    email = f"{prefix}.{uuid.uuid4().hex[:8]}@scb.vn"
    user_id = register(client, email, "09" + str(uuid.uuid4().int)[:8]).json()["data"]["id"]
    client.post(f"{API}/admin/wallet-topups", headers=auth(client, ADMIN), json={"user_id": user_id, "amount": amount})
    return email
