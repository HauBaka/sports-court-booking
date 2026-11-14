"""Kịch bản AUTH-01..06 (docs/test-scenarios.md mục 4). Chạy trên CSDL test đã nạp seed."""
import random
import uuid

import pytest
from sqlalchemy import text

from app.core.database import engine


API = "/api/v1"
PASSWORD = "TestPass123@"  # mật khẩu tài khoản seed, xem database/README.md


OTP_CODE = "123456"  # EMAIL_BACKEND=console và ENVIRONMENT khác production thì OTP luôn là 123456


def register_body(email, phone):
    return {"name": "Nguyễn Văn A", "email": email, "phone": phone, "password": PASSWORD, "role": "customer",
            "otp_code": OTP_CODE}


def request_otp(client, email, purpose="REGISTER"):
    return client.post(f"{API}/auth/otp", json={"email": email, "purpose": purpose})


def login(client, email, password=PASSWORD):
    return client.post(f"{API}/auth/login", json={"email": email, "password": password})


def test_auth_01_dang_ky_thanh_cong_vi_so_du_0(client):
    # Email và số điện thoại ngẫu nhiên để chạy lại được trên cùng CSDL
    email = f"new.{uuid.uuid4().hex[:8]}@scb.vn"
    phone = "09" + "".join(random.choices("0123456789", k=8))
    assert request_otp(client, email).status_code == 200
    res = client.post(f"{API}/auth/register", json=register_body(email, phone))
    assert res.status_code == 201
    data = res.json()["data"]
    assert data["role"] == "customer"
    assert data["wallet_id"]
    assert data["balance"] == 0
    assert "password" not in res.text

    token = login(client, email).json()["data"]["access_token"]
    me = client.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me.json()["data"]["wallet"]["balance"] == 0


def test_auth_02_trung_email(client):
    assert request_otp(client, "customer.a@scb.vn").status_code == 409  # 1.5 cũng chặn email đã đăng ký
    res = client.post(f"{API}/auth/register", json=register_body("customer.a@scb.vn", "0900000011"))
    assert res.status_code == 409
    assert res.json()["error"]["code"] == "AUTH_EMAIL_EXISTS"


def test_auth_03_trung_so_dien_thoai(client):
    email = f"other.{uuid.uuid4().hex[:8]}@scb.vn"
    assert request_otp(client, email).status_code == 200
    res = client.post(f"{API}/auth/register", json=register_body(email, "0900000003"))
    assert res.status_code == 409
    assert res.json()["error"]["code"] == "AUTH_PHONE_EXISTS"


def test_auth_04_sai_mat_khau(client):
    res = login(client, "customer.a@scb.vn", "SaiMatKhau123@")
    assert res.status_code == 401
    assert res.json()["error"]["code"] == "AUTH_INVALID_CREDENTIALS"
    assert "access_token" not in res.text


def test_auth_05_thieu_token(client):
    res = client.get(f"{API}/auth/me")
    assert res.status_code == 401
    assert res.json()["error"]["code"] == "AUTH_UNAUTHORIZED"


def test_auth_06_khach_goi_api_chu_san(client):
    token = login(client, "customer.a@scb.vn").json()["data"]["access_token"]
    body = {
        "name": "Cơ Sở Thử Quyền", "address": "1 Đường Thử, Quận 1", "city": "Hồ Chí Minh",
        "district": "Quận 1", "latitude": 10.77, "longitude": 106.7,
        "open_time": "06:00:00", "close_time": "23:00:00",
    }
    res = client.post(f"{API}/facilities", json=body, headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 403
    assert res.json()["error"]["code"] == "AUTH_FORBIDDEN"


def test_auth_07_dat_lai_mat_khau_voi_otp(client):
    """1.5 + 1.6: đặt lại xong, mật khẩu cũ 401, mật khẩu mới đăng nhập được."""
    email = f"reset.{uuid.uuid4().hex[:8]}@scb.vn"
    phone = "09" + "".join(random.choices("0123456789", k=8))
    assert request_otp(client, email).status_code == 200
    assert client.post(f"{API}/auth/register", json=register_body(email, phone)).status_code == 201

    # Vừa xin mã đăng ký nên phải qua 60 giây mới xin được mã đặt lại. Xóa dòng OTP để khỏi chờ.
    with engine.begin() as conn:
        conn.execute(text("DELETE FROM email_otps WHERE email = :e"), {"e": email})
    assert request_otp(client, email, "RESET_PASSWORD").status_code == 200
    new_password = "MatKhauMoi456#"
    res = client.post(f"{API}/auth/password/reset",
                      json={"email": email, "otp_code": OTP_CODE, "new_password": new_password})
    assert res.status_code == 200
    assert login(client, email, PASSWORD).status_code == 401
    assert login(client, email, new_password).status_code == 200


def test_auth_08_dang_ky_sai_otp_khong_tao_user(client):
    email = f"wrong.{uuid.uuid4().hex[:8]}@scb.vn"
    assert request_otp(client, email).status_code == 200
    body = register_body(email, "09" + "".join(random.choices("0123456789", k=8)))
    body["otp_code"] = "000000"
    res = client.post(f"{API}/auth/register", json=body)
    assert res.status_code == 400
    assert res.json()["error"]["code"] == "AUTH_OTP_INVALID"
    assert login(client, email).status_code == 401  # không có user nào được tạo
