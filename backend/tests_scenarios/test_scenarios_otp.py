"""Kịch bản AUTH-07..14 (docs/test-scenarios.md mục 4.1). Chạy trên CSDL đã nạp seed E3 (S3__seed_e3.sql).
Mã OTP trong seed và mã gửi ở máy cá nhân, CI đều là 123456."""
import uuid

import pytest

from .helpers import API, OTP_CODE, PASSWORD, login, scalar, execute

pytestmark = pytest.mark.skip(reason="Chờ SCB-136, SCB-137: POST /auth/otp, đăng ký có OTP, POST /auth/password/reset")


def new_email(prefix):
    return f"{prefix}.{uuid.uuid4().hex[:8]}@scb.vn"


def send_otp(client, email, purpose="REGISTER"):
    return client.post(f"{API}/auth/otp", json={"email": email, "purpose": purpose})


def register(client, email, code, phone="0900000021"):
    return client.post(f"{API}/auth/register", json={
        "name": "Khách OTP", "email": email, "phone": phone, "password": PASSWORD, "role": "customer", "otp_code": code,
    })


def user_count(email):
    return scalar("SELECT COUNT(*) FROM users WHERE email = :e", e=email)


def error_code(res):
    return res.json()["error"]["code"]


def test_auth_07_dang_ky_dung_otp(client):
    res = register(client, "newuser@scb.vn", OTP_CODE)
    assert res.status_code == 201
    assert res.json()["data"]["balance"] == 0
    assert scalar("SELECT consumed_at FROM email_otps WHERE email = 'newuser@scb.vn'") is not None


def test_auth_08_sai_otp(client):
    email = new_email("otp.wrong")
    send_otp(client, email)
    res = register(client, email, "000000", phone="0900000022")
    assert error_code(res) == "AUTH_OTP_INVALID"
    assert user_count(email) == 0
    assert scalar("SELECT attempts FROM email_otps WHERE email = :e", e=email) == 1


def test_auth_09_otp_het_han(client):
    res = register(client, "late@scb.vn", OTP_CODE, phone="0900000023")
    assert error_code(res) == "AUTH_OTP_EXPIRED"
    assert user_count("late@scb.vn") == 0


def test_auth_10_sai_5_lan(client):
    email = new_email("otp.attempts")
    send_otp(client, email)
    for _ in range(4):  # biên: sai 4 lần vẫn được nhập tiếp
        assert error_code(register(client, email, "000000", phone="0900000024")) == "AUTH_OTP_INVALID"
    assert error_code(register(client, email, "000000", phone="0900000024")) == "AUTH_OTP_TOO_MANY_ATTEMPTS"
    assert register(client, email, OTP_CODE, phone="0900000024").status_code >= 400
    assert user_count(email) == 0
    # Dòng seed đã sai 5 lần: nhập đúng mã cũng bị từ chối
    assert register(client, "locked@scb.vn", OTP_CODE, phone="0900000025").status_code >= 400
    assert user_count("locked@scb.vn") == 0


def test_auth_11_otp_da_dung(client):
    res = register(client, "done@scb.vn", OTP_CODE, phone="0900000026")
    assert res.status_code >= 400
    assert user_count("done@scb.vn") == 0


def test_auth_12_gui_lai_trong_60_giay(client):
    email = new_email("otp.resend")
    assert send_otp(client, email).status_code == 200
    res = send_otp(client, email)
    assert error_code(res) == "AUTH_OTP_TOO_SOON"
    assert scalar("SELECT COUNT(*) FROM email_otps WHERE email = :e", e=email) == 1


def test_auth_14_quen_mat_khau_email_khong_ton_tai(client):
    known = send_otp(client, "customer.b@scb.vn", "RESET_PASSWORD")
    res = send_otp(client, "khong.co@scb.vn", "RESET_PASSWORD")
    assert res.status_code == 200
    assert res.json()["message"] == known.json()["message"]  # không lộ email nào có tài khoản
    assert scalar("SELECT COUNT(*) FROM email_otps WHERE email = 'khong.co@scb.vn'") == 0


def test_auth_13_dat_lai_mat_khau(client):
    # Đổi mật khẩu Khách A: lưu hash cũ, trả lại cuối test để các kịch bản khác vẫn đăng nhập được
    old_hash = scalar("SELECT password_hash FROM users WHERE email = 'customer.a@scb.vn'")
    try:
        res = client.post(f"{API}/auth/password/reset", json={
            "email": "customer.a@scb.vn", "otp_code": OTP_CODE, "new_password": "MatKhauMoi123@",
        })
        assert res.status_code == 200
        old = login(client, "customer.a@scb.vn")
        assert old.status_code == 401
        assert error_code(old) == "AUTH_INVALID_CREDENTIALS"
        assert "access_token" in login(client, "customer.a@scb.vn", "MatKhauMoi123@").json()["data"]
    finally:
        execute("UPDATE users SET password_hash = :h WHERE email = 'customer.a@scb.vn'", h=old_hash)
