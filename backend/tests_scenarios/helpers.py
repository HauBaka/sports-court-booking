"""Hàm dùng chung cho test kịch bản. Tài khoản seed xem database/README.md."""
from datetime import date, timedelta

from sqlalchemy import text

from app.core.database import engine

API = "/api/v1"
PASSWORD = "TestPass123@"  # mật khẩu mọi tài khoản seed
OTP_CODE = "123456"  # mã cố định khi EMAIL_BACKEND=console, không phải production (SCB-136)


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


def slot_id(hour):
    """time_slots trong seed: id 1 là 06:00 đến 07:00, mỗi khung 1 giờ."""
    return hour - 5


def scalar(sql, **params):
    with engine.connect() as conn:
        return conn.execute(text(sql), params).scalar()


def execute(sql, **params):
    with engine.begin() as conn:
        conn.execute(text(sql), params)
