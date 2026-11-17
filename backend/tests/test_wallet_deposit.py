# pyright: reportGeneralTypeIssues=false, reportAttributeAccessIssue=false
from datetime import date, datetime, timedelta, timezone

import pytest

from app.api.v1.endpoints import bookings as bookings_ep
from app.core.security import hash_password
from app.models.booking import Booking
from app.models.user import Role, User, UserRole
from app.models.wallet import Wallet, WalletTransaction
from app.services import wallet_service
from tests.db_support import (
    ADMIN_ID,
    CUSTOMER_ID,
    OWNER_A_ID,
    TestingSessionLocal,
    api_client,
    auth_header,
)

SYSTEM_ID = 90
OTHER_CUSTOMER_ID = 91


@pytest.fixture(scope="module")
def client():
    yield from api_client()


@pytest.fixture(autouse=True)
def wallets(client):
    """Mỗi test: ví khách 500.000, ví hệ thống 0, xóa sổ cái và đơn cũ (chỉ dùng DB test in-memory)."""
    db = TestingSessionLocal()
    db.query(WalletTransaction).delete(synchronize_session=False)
    db.query(Booking).delete(synchronize_session=False)
    db.query(Wallet).delete(synchronize_session=False)
    db.query(UserRole).filter(UserRole.user_id.in_([SYSTEM_ID, OTHER_CUSTOMER_ID])).delete(synchronize_session=False)
    db.query(User).filter(User.id.in_([SYSTEM_ID, OTHER_CUSTOMER_ID])).delete(synchronize_session=False)
    pwd = hash_password("TestPass123@")
    db.add(User(id=SYSTEM_ID, name="Hệ thống", email="sys@scb.vn", phone="0900000090",
                password_hash=pwd, is_system=True))
    db.add(User(id=OTHER_CUSTOMER_ID, name="Khách khác", email="other@scb.vn", phone="0900000091",
                password_hash=pwd))
    db.add(UserRole(user_id=OTHER_CUSTOMER_ID, role_id=1))
    db.flush()
    db.add_all([
        Wallet(id=1, user_id=SYSTEM_ID, balance=0),
        Wallet(id=2, user_id=CUSTOMER_ID, balance=500_000),
        Wallet(id=3, user_id=OTHER_CUSTOMER_ID, balance=0),
        Wallet(id=4, user_id=OWNER_A_ID, balance=0),
    ])
    db.commit()
    db.close()


def make_booking(user_id=CUSTOMER_ID, status="PENDING_DEPOSIT", deposit=39_000, hold_minutes=10):
    db = TestingSessionLocal()
    now = bookings_ep.now_vn().replace(tzinfo=None)  # bookings lưu giờ VN, khớp 3.3/3.7
    b = Booking(
        user_id=user_id, court_id=1, play_date=date.today() + timedelta(days=3),
        start_at=now + timedelta(days=3), status=status, subtotal=130_000, total_amount=130_000,
        deposit_amount=deposit, hold_expires_at=now + timedelta(minutes=hold_minutes) if status == "PENDING_DEPOSIT" else None,
    )
    db.add(b)
    db.commit()
    bid = b.id
    db.close()
    return bid


def balance(user_id):
    db = TestingSessionLocal()
    v = db.query(Wallet).filter(Wallet.user_id == user_id).one().balance
    db.close()
    return v


def tx_count(type_=None):
    db = TestingSessionLocal()
    q = db.query(WalletTransaction)
    if type_:
        q = q.filter(WalletTransaction.type == type_)
    n = q.count()
    db.close()
    return n


def booking_status(bid):
    db = TestingSessionLocal()
    s = db.query(Booking).filter(Booking.id == bid).one().status
    db.close()
    return s


def deposit(client, bid, user_id=CUSTOMER_ID):
    return client.post(f"/api/v1/bookings/{bid}/deposit", headers=auth_header(user_id))


class TestDeposit:
    def test_coc_01_coc_hop_le(self, client):
        bid = make_booking()
        r = deposit(client, bid)
        assert r.status_code == 200
        d = r.json()["data"]
        assert d["status"] == "DEPOSITED" and d["wallet_balance_remaining"] == 461_000
        assert d["remaining_amount_due_at_court"] == 91_000
        assert balance(CUSTOMER_ID) == 461_000 and balance(SYSTEM_ID) == 39_000
        assert tx_count("DEPOSIT") == 1 and booking_status(bid) == "DEPOSITED"

    def test_coc_02_so_du_dung_bang_tien_coc(self, client):
        bid = make_booking(deposit=500_000)
        assert deposit(client, bid).status_code == 200
        assert balance(CUSTOMER_ID) == 0 and balance(SYSTEM_ID) == 500_000

    def test_coc_03_thieu_1_dong(self, client):
        bid = make_booking(deposit=500_001)
        r = deposit(client, bid)
        assert r.status_code == 402
        assert r.json()["error"]["code"] == "WALLET_INSUFFICIENT_BALANCE"
        assert balance(CUSTOMER_ID) == 500_000 and balance(SYSTEM_ID) == 0
        assert tx_count() == 0 and booking_status(bid) == "PENDING_DEPOSIT"

    def test_coc_04_don_het_han(self, client):
        bid = make_booking(hold_minutes=-1)
        r = deposit(client, bid)
        assert r.status_code == 400
        assert r.json()["error"]["code"] == "CANNOT_DEPOSIT_EXPIRED_BOOKING"
        assert balance(CUSTOMER_ID) == 500_000 and tx_count() == 0

    def test_coc_05_gui_hai_lan_chi_tru_mot_lan(self, client):
        bid = make_booking()
        assert deposit(client, bid).status_code == 200
        assert deposit(client, bid).status_code == 400
        assert balance(CUSTOMER_ID) == 461_000 and tx_count("DEPOSIT") == 1

    def test_coc_07_don_nguoi_khac(self, client):
        bid = make_booking(user_id=OTHER_CUSTOMER_ID)
        assert deposit(client, bid).status_code == 403
        assert balance(CUSTOMER_ID) == 500_000 and tx_count() == 0

    def test_coc_08_don_da_huy(self, client):
        bid = make_booking(status="CANCELLED")
        assert deposit(client, bid).status_code == 400
        assert tx_count() == 0

    def test_don_khong_ton_tai(self, client):
        assert deposit(client, 99999).status_code == 404


class TestWalletApis:
    def test_5_1_xem_so_du(self, client):
        r = client.get("/api/v1/wallets/me", headers=auth_header(CUSTOMER_ID))
        assert r.status_code == 200 and r.json()["data"]["balance"] == 500_000

    def test_vi_04_lich_su_chi_thay_vi_cua_minh_va_loc_theo_type(self, client):
        deposit(client, make_booking())
        client.post("/api/v1/admin/wallet-topups", headers=auth_header(ADMIN_ID),
                    json={"user_id": OTHER_CUSTOMER_ID, "amount": 1000})
        r = client.get("/api/v1/wallets/me/transactions", headers=auth_header(CUSTOMER_ID))
        body = r.json()
        assert body["meta"]["total"] == 1 and body["data"][0]["type"] == "DEPOSIT"
        assert body["data"][0]["balance_after"] == 461_000
        r = client.get("/api/v1/wallets/me/transactions?type=TOPUP", headers=auth_header(CUSTOMER_ID))
        assert r.json()["meta"]["total"] == 0
        r = client.get("/api/v1/wallets/me/transactions?limit=0", headers=auth_header(CUSTOMER_ID))
        assert r.status_code == 422

    def test_vi_01_admin_cap_tien(self, client):
        r = client.post("/api/v1/admin/wallet-topups", headers=auth_header(ADMIN_ID),
                        json={"user_id": CUSTOMER_ID, "amount": 200_000, "reason": "test"})
        assert r.status_code == 200 and r.json()["data"]["new_balance"] == 700_000
        db = TestingSessionLocal()
        tx = db.query(WalletTransaction).one()
        assert tx.type == "TOPUP" and tx.created_by == ADMIN_ID and tx.from_wallet_id is None
        db.close()

    @pytest.mark.parametrize("amount", [0, -5, 1000.5, "1000", True, None])
    def test_vi_02_so_tien_khong_hop_le(self, client, amount):
        r = client.post("/api/v1/admin/wallet-topups", headers=auth_header(ADMIN_ID),
                        json={"user_id": CUSTOMER_ID, "amount": amount})
        assert r.status_code in (400, 422)
        assert balance(CUSTOMER_ID) == 500_000 and tx_count() == 0

    def test_vi_03_khong_phai_admin(self, client):
        r = client.post("/api/v1/admin/wallet-topups", headers=auth_header(CUSTOMER_ID),
                        json={"user_id": CUSTOMER_ID, "amount": 1000})
        assert r.status_code == 403
        assert client.get("/api/v1/admin/users", headers=auth_header(CUSTOMER_ID)).status_code == 403

    def test_5_4_tim_theo_email_va_sdt(self, client):
        h = auth_header(ADMIN_ID)
        r = client.get("/api/v1/admin/users?search=customer@scb", headers=h).json()
        assert [u["id"] for u in r["data"]] == [CUSTOMER_ID] and r["data"][0]["balance"] == 500_000
        r = client.get("/api/v1/admin/users?search=0900000091", headers=h).json()
        assert [u["id"] for u in r["data"]] == [OTHER_CUSTOMER_ID]
        # ký tự % được hiểu theo nghĩa đen, không khớp mọi người
        assert client.get("/api/v1/admin/users?search=%25", headers=h).json()["meta"]["total"] == 0
        # tài khoản hệ thống không bị liệt kê
        assert SYSTEM_ID not in [u["id"] for u in client.get("/api/v1/admin/users?limit=100", headers=h).json()["data"]]


class TestWalletService:
    def test_thieu_so_du_khong_doi_gi(self, client):
        db = TestingSessionLocal()
        from app.core.exceptions import BusinessException
        with pytest.raises(BusinessException) as e:
            wallet_service.transfer(db, type="REFUND", amount=1, from_wallet_id=1, to_wallet_id=2,
                                    related_booking_id=1)
        assert e.value.code == "WALLET_INSUFFICIENT_BALANCE"
        db.rollback()
        db.close()
        assert balance(SYSTEM_ID) == 0 and balance(CUSTOMER_ID) == 500_000 and tx_count() == 0

    def test_khong_co_ham_sua_xoa_giao_dich(self):
        names = [n for n in dir(wallet_service) if any(w in n.lower() for w in ("update", "delete", "edit", "remove"))]
        assert names == []

    def test_orm_chan_sua_xoa_so_cai(self, client):
        deposit(client, make_booking())
        db = TestingSessionLocal()
        tx = db.query(WalletTransaction).one()
        tx.amount = 1
        with pytest.raises(RuntimeError):
            db.flush()
        db.rollback()
        db.delete(db.query(WalletTransaction).one())
        with pytest.raises(RuntimeError):
            db.flush()
        db.rollback()
        db.close()


class TestRaceRegression:
    """Hồi quy cho hai lỗi review: số dư cũ trong session và giờ lấy trước khi chờ khóa."""

    def test_so_du_cu_trong_session_khong_ghi_de_giao_dich_khac(self, client):
        db_a = TestingSessionLocal()
        wallet_id = wallet_service.get_wallet_by_user(db_a, CUSTOMER_ID).id  # A đã nạp ví (500.000) vào session

        # Request khác (session B) cộng 10.000 và commit trong lúc A chưa khóa
        db_b = TestingSessionLocal()
        wallet_service.transfer(db_b, type="TOPUP", amount=10_000, to_wallet_id=wallet_id, created_by=ADMIN_ID)
        db_b.commit()
        db_b.close()

        # A nạp thêm 20.000: phải dựa trên số dư mới nhất (510.000), không phải 500.000 cũ
        wallet_service.transfer(db_a, type="TOPUP", amount=20_000, to_wallet_id=wallet_id, created_by=ADMIN_ID)
        db_a.commit()
        db_a.close()
        assert balance(CUSTOMER_ID) == 530_000
        assert tx_count("TOPUP") == 2

    def test_het_han_trong_luc_cho_khoa_thi_tu_choi(self, client, monkeypatch):
        from datetime import timedelta
        real_lock = bookings_ep.lock_wallets
        real_now = bookings_ep.now_vn
        state = {"waited": False}

        def slow_lock(db, ids):
            result = real_lock(db, ids)
            state["waited"] = True  # giả lập đã chờ khóa quá hold_expires_at
            return result

        monkeypatch.setattr(bookings_ep, "lock_wallets", slow_lock)
        monkeypatch.setattr(
            bookings_ep, "now_vn", lambda: real_now() + timedelta(minutes=30) if state["waited"] else real_now()
        )
        bid = make_booking(hold_minutes=10)
        r = deposit(client, bid)
        assert r.status_code == 400
        assert r.json()["error"]["code"] == "CANNOT_DEPOSIT_EXPIRED_BOOKING"
        assert booking_status(bid) == "PENDING_DEPOSIT"
        assert balance(CUSTOMER_ID) == 500_000 and tx_count() == 0

    def test_coc_06_hai_don_tong_vuot_so_du(self, client):
        b1, b2 = make_booking(deposit=300_000), make_booking(deposit=300_000)
        codes = sorted([deposit(client, b1).status_code, deposit(client, b2).status_code])
        assert codes == [200, 402]
        assert balance(CUSTOMER_ID) == 200_000 and tx_count("DEPOSIT") == 1
