"""Kịch bản AUTH-01..06 (docs/test-scenarios.md mục 4). Chạy trên CSDL test đã nạp seed."""
import pytest

pytestmark = pytest.mark.skip(reason="Chờ API đăng ký, đăng nhập, hồ sơ (SCB-80, SCB-81) và dependency phân quyền (SCB-76). Bỏ dòng này khi API xong")

API = "/api/v1"
PASSWORD = "TestPass123@"  # mật khẩu tài khoản seed, xem database/README.md


def register_body(email, phone):
    return {"name": "Nguyễn Văn A", "email": email, "phone": phone, "password": PASSWORD, "role": "customer"}


def login(client, email, password=PASSWORD):
    return client.post(f"{API}/auth/login", json={"email": email, "password": password})


def test_auth_01_dang_ky_thanh_cong_vi_so_du_0(client):
    res = client.post(f"{API}/auth/register", json=register_body("new.user@scb.vn", "0900000010"))
    assert res.status_code == 201
    data = res.json()["data"]
    assert data["role"] == "customer"
    assert data["wallet_id"]
    assert data["balance"] == 0
    assert "password" not in res.text

    token = login(client, "new.user@scb.vn").json()["data"]["access_token"]
    me = client.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me.json()["data"]["wallet"]["balance"] == 0


def test_auth_02_trung_email(client):
    res = client.post(f"{API}/auth/register", json=register_body("customer.a@scb.vn", "0900000011"))
    assert res.status_code == 409
    assert res.json()["error"]["code"] == "AUTH_EMAIL_EXISTS"


def test_auth_03_trung_so_dien_thoai(client):
    res = client.post(f"{API}/auth/register", json=register_body("other.user@scb.vn", "0900000003"))
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
