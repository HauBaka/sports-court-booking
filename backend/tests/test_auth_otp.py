"""Test POST /auth/otp (1.5), POST /auth/password/reset (1.6) và OTP trong đăng ký (1.1).
Mã cố định 123456 (console, không phải production, xem fixture fixed_otp_env), người gửi email là bản giả."""
import logging
from datetime import timedelta

import pytest

from app.core import email_service, otp
from app.core.config import settings
from app.models import email_otp
from app.models.email_otp import EmailOtp
from app.models.user import User
from tests.db_support import TestingSessionLocal, api_client

API = "/api/v1"
CODE = "123456"
WRONG = "000000"
EMAIL = "customer@scb.vn"  # tài khoản seed của db_support, mật khẩu TestPass123@
OLD_PASSWORD = "TestPass123@"
NEW_PASSWORD = "MatKhauMoi456#"
NEW_EMAIL = "nguoi.moi@scb.vn"


@pytest.fixture
def client():
    yield from api_client()


@pytest.fixture
def sent(monkeypatch):
    """Thay sender bằng bản giả, trả về danh sách email đã 'gửi'."""
    box = []
    monkeypatch.setattr(email_service, "send_email", lambda to, subject, html: box.append((to, subject, html)))
    return box


@pytest.fixture
def clock(monkeypatch):
    """Đồng hồ giả: clock.advance(seconds) tua thời gian."""
    class Clock:
        now = email_otp.utcnow()

        def advance(self, seconds):
            self.now += timedelta(seconds=seconds)

    c = Clock()
    monkeypatch.setattr(email_otp, "utcnow", lambda: c.now)
    return c


def ask_otp(client, email, purpose):
    return client.post(f"{API}/auth/otp", json={"email": email, "purpose": purpose})


def reset(client, email=EMAIL, code=CODE, password=NEW_PASSWORD):
    return client.post(f"{API}/auth/password/reset", json={"email": email, "otp_code": code, "new_password": password})


def register_body(code=CODE, email=NEW_EMAIL, phone="0911111111"):
    return {"name": "Người Mới", "email": email, "phone": phone, "password": "MatKhau123@", "role": "customer",
            "otp_code": code}


def login(client, email, password):
    return client.post(f"{API}/auth/login", json={"email": email, "password": password})


def error_code(res):
    return res.json()["error"]["code"]


def count_users():
    db = TestingSessionLocal()
    try:
        return db.query(User).count()
    finally:
        db.close()


# ---------------------------------------------------------------- 1.5 POST /auth/otp

def test_gui_otp_register_thanh_cong_va_chi_gui_mot_email(client, sent):
    res = ask_otp(client, NEW_EMAIL, "REGISTER")
    assert res.status_code == 200
    assert res.json() == {"success": True, "message": "Mã xác thực OTP đã được gửi đến email của bạn.", "data": None}
    assert len(sent) == 1
    to, _subject, html = sent[0]
    assert to == NEW_EMAIL
    assert CODE in html


def test_otp_luu_dang_bam_khong_luu_ma_tho(client, sent):
    ask_otp(client, NEW_EMAIL, "REGISTER")
    db = TestingSessionLocal()
    row = db.query(EmailOtp).one()
    assert row.code_hash != CODE
    assert CODE not in row.code_hash
    assert len(row.code_hash) == 64
    assert row.expires_at - row.created_at == timedelta(minutes=5)
    db.close()


def test_otp_register_email_da_ton_tai_409(client, sent):
    res = ask_otp(client, EMAIL, "REGISTER")
    assert res.status_code == 409
    assert error_code(res) == "AUTH_EMAIL_EXISTS"
    assert sent == []


@pytest.mark.parametrize("body", [
    {"email": "khong-phai-email", "purpose": "REGISTER"},
    {"email": EMAIL, "purpose": "KHAC"},
    {"email": EMAIL},
    {"purpose": "REGISTER"},
])
def test_otp_du_lieu_sai_422(client, sent, body):
    res = client.post(f"{API}/auth/otp", json=body)
    assert res.status_code == 422
    assert error_code(res) == "VALIDATION_ERROR"
    assert sent == []


def test_otp_gui_lai_truoc_60_giay_429_sau_60_giay_duoc(client, sent, clock):
    assert ask_otp(client, NEW_EMAIL, "REGISTER").status_code == 200
    clock.advance(59)
    res = ask_otp(client, NEW_EMAIL, "REGISTER")
    assert res.status_code == 429
    assert error_code(res) == "AUTH_OTP_TOO_SOON"
    assert "Retry-After" in res.headers
    assert len(sent) == 1
    clock.advance(1)
    assert ask_otp(client, NEW_EMAIL, "REGISTER").status_code == 200
    assert len(sent) == 2


def test_cooldown_dong_nhat_giua_email_co_that_va_email_la(client, sent, clock):
    for email in (EMAIL, "khong.ton.tai@scb.vn"):
        assert ask_otp(client, email, "RESET_PASSWORD").status_code == 200
        res = ask_otp(client, email, "RESET_PASSWORD")
        assert res.status_code == 429
        assert error_code(res) == "AUTH_OTP_TOO_SOON"
    # Chỉ email có thật được gửi mail
    assert [to for to, _, _ in sent] == [EMAIL]


def test_cooldown_tinh_theo_email_ca_khi_doi_purpose(client, sent, clock):
    assert ask_otp(client, NEW_EMAIL, "REGISTER").status_code == 200
    assert ask_otp(client, NEW_EMAIL, "RESET_PASSWORD").status_code == 429


def test_gui_email_loi_tra_502_va_thu_lai_ngay_duoc(client, monkeypatch, sent):
    def fail(to, subject, html):
        raise email_service.EmailSendError("Brevo sập")

    monkeypatch.setattr(email_service, "send_email", fail)
    res = ask_otp(client, NEW_EMAIL, "REGISTER")
    assert res.status_code == 502
    assert error_code(res) == "EMAIL_SEND_FAILED"

    monkeypatch.setattr(email_service, "send_email", lambda to, s, h: sent.append(to))
    assert ask_otp(client, NEW_EMAIL, "REGISTER").status_code == 200  # không bị cooldown oan


# ---------------------------------------------------------------- mã cố định và ngẫu nhiên

def test_console_va_khong_production_ma_luon_123456():
    assert {otp.generate_code() for _ in range(20)} == {"123456"}


@pytest.mark.parametrize("backend, environment", [("console", "production"), ("brevo", "development"),
                                                  ("brevo", "production")])
def test_ma_ngau_nhien_khi_la_ban_that(monkeypatch, backend, environment):
    monkeypatch.setattr(settings, "EMAIL_BACKEND", backend)
    monkeypatch.setattr(settings, "ENVIRONMENT", environment)
    codes = {otp.generate_code() for _ in range(30)}
    assert all(len(c) == 6 and c.isdigit() for c in codes)
    assert len(codes) > 1


def test_production_gui_ma_ngau_nhien_khong_ghi_log_ma_tho(client, monkeypatch, sent, caplog):
    monkeypatch.setattr(settings, "EMAIL_BACKEND", "brevo")
    monkeypatch.setattr(settings, "ENVIRONMENT", "production")
    with caplog.at_level(logging.DEBUG):
        assert ask_otp(client, NEW_EMAIL, "REGISTER").status_code == 200
    real_code = sent[0][2].split("<h2")[1].split(">")[1].split("<")[0]
    assert len(real_code) == 6 and real_code.isdigit()
    assert real_code not in caplog.text
    db = TestingSessionLocal()
    assert real_code not in db.query(EmailOtp).one().code_hash
    db.close()


# ---------------------------------------------------------------- mã lỗi của verify (qua 1.6)

def test_verify_chua_xin_ma_la_invalid(client, sent):
    res = reset(client)
    assert res.status_code == 400
    assert error_code(res) == "AUTH_OTP_INVALID"


def test_verify_sai_ma_invalid(client, sent):
    ask_otp(client, EMAIL, "RESET_PASSWORD")
    res = reset(client, code=WRONG)
    assert res.status_code == 400
    assert error_code(res) == "AUTH_OTP_INVALID"


def test_verify_het_han_sau_5_phut(client, sent, clock):
    ask_otp(client, EMAIL, "RESET_PASSWORD")
    clock.advance(5 * 60 + 1)
    res = reset(client)
    assert res.status_code == 400
    assert error_code(res) == "AUTH_OTP_EXPIRED"


def test_verify_dung_ma_o_giay_thu_300_van_hop_le(client, sent, clock):
    ask_otp(client, EMAIL, "RESET_PASSWORD")
    clock.advance(5 * 60)
    assert reset(client).status_code == 200


def test_verify_sai_5_lan_huy_ma_lan_5_too_many_roi_invalid(client, sent):
    ask_otp(client, EMAIL, "RESET_PASSWORD")
    for _ in range(4):
        assert error_code(reset(client, code=WRONG)) == "AUTH_OTP_INVALID"
    res = reset(client, code=WRONG)
    assert res.status_code == 400
    assert error_code(res) == "AUTH_OTP_TOO_MANY_ATTEMPTS"
    # Mã đã bị hủy: ngay cả nhập đúng cũng không dùng được
    res = reset(client, code=CODE)
    assert res.status_code == 400
    assert error_code(res) == "AUTH_OTP_INVALID"
    assert login(client, EMAIL, OLD_PASSWORD).status_code == 200  # mật khẩu không đổi


def test_verify_sai_4_lan_roi_dung_van_thanh_cong(client, sent):
    ask_otp(client, EMAIL, "RESET_PASSWORD")
    for _ in range(4):
        reset(client, code=WRONG)
    assert reset(client, code=CODE).status_code == 200


def test_verify_dung_mot_lan(client, sent):
    ask_otp(client, EMAIL, "RESET_PASSWORD")
    assert reset(client).status_code == 200
    res = reset(client, password="KhacNua789#")
    assert res.status_code == 400
    assert error_code(res) == "AUTH_OTP_INVALID"


def test_ma_cu_het_hieu_luc_khi_xin_ma_moi(client, monkeypatch, sent, clock):
    monkeypatch.setattr(otp, "generate_code", lambda: "111111")
    ask_otp(client, EMAIL, "RESET_PASSWORD")
    clock.advance(61)
    monkeypatch.setattr(otp, "generate_code", lambda: "222222")
    ask_otp(client, EMAIL, "RESET_PASSWORD")
    assert error_code(reset(client, code="111111")) == "AUTH_OTP_INVALID"
    assert reset(client, code="222222").status_code == 200


def test_ma_register_khong_dung_duoc_cho_reset(client, sent):
    ask_otp(client, NEW_EMAIL, "REGISTER")
    assert error_code(reset(client, email=NEW_EMAIL)) == "AUTH_OTP_INVALID"


def test_otp_code_khong_du_6_so_422(client, sent):
    for bad in ("12345", "1234567", "abcdef", ""):
        res = reset(client, code=bad)
        assert res.status_code == 422
        assert error_code(res) == "VALIDATION_ERROR"


# ---------------------------------------------------------------- 1.6 đặt lại mật khẩu

def test_dat_lai_mat_khau_mat_khau_cu_401_moi_dang_nhap_duoc(client, sent):
    assert login(client, EMAIL, OLD_PASSWORD).status_code == 200
    ask_otp(client, EMAIL, "RESET_PASSWORD")
    res = reset(client)
    assert res.status_code == 200
    assert res.json()["data"] is None
    assert login(client, EMAIL, OLD_PASSWORD).status_code == 401
    assert login(client, EMAIL, NEW_PASSWORD).status_code == 200


def test_dat_lai_mat_khau_yeu_422_va_khong_tieu_ma(client, sent):
    ask_otp(client, EMAIL, "RESET_PASSWORD")
    res = reset(client, password="yeu")
    assert res.status_code == 422
    assert error_code(res) == "VALIDATION_ERROR"
    assert reset(client).status_code == 200  # mã vẫn dùng được


def test_dat_lai_email_la_khong_lo_thong_tin(client, sent):
    """Email không có tài khoản: có xin mã (cooldown), nhập 123456 vẫn chỉ nhận AUTH_OTP_INVALID."""
    ask_otp(client, "khong.ton.tai@scb.vn", "RESET_PASSWORD")
    res = reset(client, email="khong.ton.tai@scb.vn")
    assert res.status_code == 400
    assert error_code(res) == "AUTH_OTP_INVALID"


# ---------------------------------------------------------------- 1.1 đăng ký có OTP

def test_dang_ky_sai_otp_khong_tao_user(client, sent):
    ask_otp(client, NEW_EMAIL, "REGISTER")
    before = count_users()
    res = client.post(f"{API}/auth/register", json=register_body(code=WRONG))
    assert res.status_code == 400
    assert error_code(res) == "AUTH_OTP_INVALID"
    assert count_users() == before
    assert login(client, NEW_EMAIL, "MatKhau123@").status_code == 401


def test_dang_ky_chua_xin_otp_khong_tao_user(client, sent):
    before = count_users()
    res = client.post(f"{API}/auth/register", json=register_body())
    assert res.status_code == 400
    assert error_code(res) == "AUTH_OTP_INVALID"
    assert count_users() == before


def test_dang_ky_thieu_otp_code_422(client, sent):
    body = register_body()
    del body["otp_code"]
    res = client.post(f"{API}/auth/register", json=body)
    assert res.status_code == 422
    assert error_code(res) == "VALIDATION_ERROR"


def test_dang_ky_otp_het_han(client, sent, clock):
    ask_otp(client, NEW_EMAIL, "REGISTER")
    clock.advance(5 * 60 + 1)
    before = count_users()
    res = client.post(f"{API}/auth/register", json=register_body())
    assert error_code(res) == "AUTH_OTP_EXPIRED"
    assert count_users() == before


def test_dang_ky_sai_5_lan_huy_ma_dung_cung_khong_dung_duoc(client, sent):
    ask_otp(client, NEW_EMAIL, "REGISTER")
    for _ in range(4):
        assert error_code(client.post(f"{API}/auth/register", json=register_body(code=WRONG))) == "AUTH_OTP_INVALID"
    res = client.post(f"{API}/auth/register", json=register_body(code=WRONG))
    assert error_code(res) == "AUTH_OTP_TOO_MANY_ATTEMPTS"
    before = count_users()
    res = client.post(f"{API}/auth/register", json=register_body())
    assert error_code(res) == "AUTH_OTP_INVALID"
    assert count_users() == before


def test_dang_ky_dung_otp_thanh_cong_va_chi_dung_mot_lan(client, sent):
    ask_otp(client, NEW_EMAIL, "REGISTER")
    res = client.post(f"{API}/auth/register", json=register_body())
    assert res.status_code == 201
    assert login(client, NEW_EMAIL, "MatKhau123@").status_code == 200
    # Mã đã dùng: người khác (email khác chưa xin mã) không dùng lại được
    res = client.post(f"{API}/auth/register", json=register_body(email="khac@scb.vn", phone="0922222222"))
    assert error_code(res) == "AUTH_OTP_INVALID"


def test_dang_ky_trung_so_dien_thoai_khong_tieu_ma(client, sent):
    """409 xảy ra trước khi kiểm mã nên không tốn lượt thử, mã vẫn còn dùng được với số khác."""
    ask_otp(client, NEW_EMAIL, "REGISTER")
    res = client.post(f"{API}/auth/register", json=register_body(phone="0900000003"))  # số của khách seed
    assert res.status_code == 409
    assert error_code(res) == "AUTH_PHONE_EXISTS"
    assert client.post(f"{API}/auth/register", json=register_body()).status_code == 201
