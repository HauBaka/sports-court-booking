# pyright: reportGeneralTypeIssues=false, reportAttributeAccessIssue=false
"""SCB-199: 3.5 danh sách đơn theo vai trò, 3.6 chi tiết đơn, 4.3 kết toán cọc (KT-01..05, VI-05)."""
from datetime import datetime, time, timedelta
from decimal import Decimal

import pytest

from app.api.v1.endpoints import bookings as bookings_ep
from app.core.security import hash_password
from app.models.booking import Booking, BookingService, BookingSlot
from app.models.facility import Court, CourtSlot, Service, Sport, TimeSlot
from app.models.user import User, UserRole
from app.models.wallet import Wallet, WalletTransaction
from tests.db_support import (
    ADMIN_ID,
    CUSTOMER_ID,
    FACILITY_A_ID,
    FACILITY_B_ID,
    OWNER_A_ID,
    OWNER_B_ID,
    TestingSessionLocal,
    api_client,
    auth_header,
)

SYSTEM_ID = 90
OTHER_CUSTOMER_ID = 91
SYSTEM_WALLET, CUSTOMER_WALLET, OWNER_A_WALLET, OWNER_B_WALLET = 1, 2, 3, 4
COURT_A, COURT_A2, COURT_B = 1, 2, 3
SYSTEM_START = 100_000  # ví hệ thống đang giữ cọc của nhiều đơn


@pytest.fixture(scope="module")
def client():
    gen = api_client()
    test_client = next(gen)
    db = TestingSessionLocal()
    pwd = hash_password("TestPass123@")
    db.add(User(id=SYSTEM_ID, name="Hệ thống", email="sys@scb.vn", phone="0900000090",
                password_hash=pwd, is_system=True))
    db.add(User(id=OTHER_CUSTOMER_ID, name="Khách khác", email="other@scb.vn", phone="0900000091",
                password_hash=pwd))
    db.add(UserRole(user_id=OTHER_CUSTOMER_ID, role_id=1))
    db.add(Sport(id=1, name="Cầu lông"))
    for cid, fid, name in [(COURT_A, FACILITY_A_ID, "Sân A1"), (COURT_A2, FACILITY_A_ID, "Sân A2"),
                           (COURT_B, FACILITY_B_ID, "Sân B1")]:
        db.add(Court(id=cid, facility_id=fid, sport_id=1, name=name,
                     open_time=time(7), close_time=time(22), is_active=True))
    db.add(TimeSlot(id=1, start_time=time(16), end_time=time(17)))
    db.add(TimeSlot(id=2, start_time=time(17), end_time=time(18)))
    db.add(CourtSlot(court_id=COURT_A, time_slot_id=1, base_price=100_000))
    db.add(CourtSlot(court_id=COURT_A, time_slot_id=2, base_price=100_000))
    db.add(CourtSlot(court_id=COURT_B, time_slot_id=1, base_price=100_000))
    db.add(Service(id=1, facility_id=FACILITY_A_ID, name="Thuê vợt", unit_price=20_000))
    db.commit()
    db.close()
    try:
        yield test_client
    finally:
        next(gen, None)


@pytest.fixture(autouse=True)
def clean(client):
    """Mỗi test bắt đầu không có đơn, không có sổ cái, ví về số dư gốc."""
    db = TestingSessionLocal()
    for model in (WalletTransaction, BookingSlot, BookingService, Booking, Wallet):
        db.query(model).delete(synchronize_session=False)
    db.add_all([
        Wallet(id=SYSTEM_WALLET, user_id=SYSTEM_ID, balance=SYSTEM_START),
        Wallet(id=CUSTOMER_WALLET, user_id=CUSTOMER_ID, balance=500_000),
        Wallet(id=OWNER_A_WALLET, user_id=OWNER_A_ID, balance=0),
        Wallet(id=OWNER_B_WALLET, user_id=OWNER_B_ID, balance=0),
    ])
    db.commit()
    db.close()


def now_naive():
    return bookings_ep.now_vn().replace(tzinfo=None)


def make_booking(user_id=CUSTOMER_ID, court_id=COURT_A, status="DEPOSITED", start_at=None, **extra):
    start_at = start_at or now_naive() - timedelta(hours=1)
    values = dict(
        user_id=user_id, court_id=court_id, play_date=start_at.date(), start_at=start_at, status=status,
        subtotal=230_000, service_total=40_000, total_amount=270_000, deposit_amount=81_000,
        cancelled_at=now_naive() if status == "CANCELLED" else None,
    )
    values.update(extra)
    db = TestingSessionLocal()
    booking = Booking(**values)
    db.add(booking)
    db.commit()
    bid = booking.id
    db.close()
    return bid


def add_slots(booking_id, time_slot_ids, released_at=None):
    db = TestingSessionLocal()
    booking = db.query(Booking).filter(Booking.id == booking_id).one()
    for slot in time_slot_ids:
        multiplier, price = {1: ("1.00", 100_000), 2: ("1.30", 130_000)}[slot]
        db.add(BookingSlot(booking_id=booking_id, court_id=booking.court_id, play_date=booking.play_date,
                           time_slot_id=slot, base_price=100_000, multiplier=Decimal(multiplier),
                           final_price=price, released_at=released_at))
    db.commit()
    db.close()


def balances():
    db = TestingSessionLocal()
    result = {w.id: w.balance for w in db.query(Wallet).all()}
    db.close()
    return result


def transactions():
    db = TestingSessionLocal()
    rows = db.query(WalletTransaction).all()
    db.close()
    return rows


def status_of(bid):
    db = TestingSessionLocal()
    value = db.query(Booking).filter(Booking.id == bid).one().status
    db.close()
    return value


# ==============================================================================
# 3.5 GET /bookings
# ==============================================================================
def list_ids(client, user_id, **params):
    res = client.get("/api/v1/bookings", params=params, headers=auth_header(user_id))
    assert res.status_code == 200, res.text
    return sorted(item["id"] for item in res.json()["data"])


@pytest.fixture
def three_bookings():
    mine_a = make_booking(court_id=COURT_A)
    mine_b = make_booking(court_id=COURT_B)
    other_a = make_booking(user_id=OTHER_CUSTOMER_ID, court_id=COURT_A2)
    return mine_a, mine_b, other_a


class TestListBookings:
    def test_customer_chi_thay_don_cua_minh(self, client, three_bookings):
        mine_a, mine_b, other_a = three_bookings
        assert list_ids(client, CUSTOMER_ID) == [mine_a, mine_b]
        assert list_ids(client, OTHER_CUSTOMER_ID) == [other_a]

    def test_customer_gui_facility_id_khac_van_chi_thay_don_cua_minh(self, client, three_bookings):
        mine_a, mine_b, other_a = three_bookings
        assert list_ids(client, CUSTOMER_ID, facility_id=FACILITY_A_ID) == [mine_a]
        assert list_ids(client, OTHER_CUSTOMER_ID, facility_id=FACILITY_B_ID) == []
        assert list_ids(client, CUSTOMER_ID, court_id=COURT_A2) == []

    def test_owner_chi_thay_don_o_co_so_cua_minh(self, client, three_bookings):
        mine_a, mine_b, other_a = three_bookings
        assert list_ids(client, OWNER_A_ID) == [mine_a, other_a]
        assert list_ids(client, OWNER_B_ID) == [mine_b]
        assert list_ids(client, OWNER_A_ID, facility_id=FACILITY_B_ID) == []
        assert list_ids(client, OWNER_A_ID, court_id=COURT_B) == []

    def test_owner_thay_don_co_so_minh_va_don_minh_dat_o_co_so_khac(self, client):
        at_my_facility = make_booking(court_id=COURT_A)
        my_booking_elsewhere = make_booking(user_id=OWNER_A_ID, court_id=COURT_B)
        make_booking(user_id=OTHER_CUSTOMER_ID, court_id=COURT_B)

        assert list_ids(client, OWNER_A_ID) == [at_my_facility, my_booking_elsewhere]
        assert list_ids(client, OWNER_A_ID, facility_id=FACILITY_B_ID) == [my_booking_elsewhere]
        assert list_ids(client, OWNER_A_ID, court_id=COURT_B) == [my_booking_elsewhere]

    def test_admin_thay_het(self, client, three_bookings):
        assert list_ids(client, ADMIN_ID) == sorted(three_bookings)

    @pytest.mark.parametrize("user_id", [OWNER_A_ID, ADMIN_ID], ids=["chu-san", "admin"])
    def test_response_dung_spec(self, client, user_id):
        bid = make_booking(start_at=datetime(2026, 11, 10, 16, 0), created_at=datetime(2026, 11, 10, 7, 30))
        add_slots(bid, [2, 1])
        body = client.get("/api/v1/bookings", headers=auth_header(user_id)).json()
        assert body == {
            "success": True,
            "message": "Lấy danh sách lịch đặt sân thành công.",
            "data": [{
                "id": bid, "facility_id": FACILITY_A_ID, "facility_name": "Cơ sở A",
                "court_id": COURT_A, "court_name": "Sân A1", "play_date": "2026-11-10",
                "start_at": "2026-11-10T09:00:00Z", "end_at": "2026-11-10T11:00:00Z",
                "customer_name": "Khách hàng", "customer_phone": "0900000003",
                "total_amount": 270_000, "deposit_amount": 81_000,
                "status": "DEPOSITED", "created_at": "2026-11-10T07:30:00Z",
            }],
            "meta": {"page": 1, "limit": 10, "total": 1, "total_pages": 1},
        }

    def test_customer_khong_nhan_thong_tin_lien_he(self, client):
        make_booking()
        [item] = client.get("/api/v1/bookings", headers=auth_header(CUSTOMER_ID)).json()["data"]
        assert "customer_name" not in item and "customer_phone" not in item

    def test_end_at_tinh_ca_khung_da_nha_va_dung_tung_don(self, client):
        cancelled = make_booking(status="CANCELLED", start_at=datetime(2026, 11, 10, 16))
        add_slots(cancelled, [1, 2], released_at=datetime(2026, 11, 9, 10))
        short = make_booking(start_at=datetime(2026, 11, 11, 16))
        add_slots(short, [1])
        data = client.get("/api/v1/bookings", headers=auth_header(CUSTOMER_ID)).json()["data"]
        assert {item["id"]: item["end_at"] for item in data} == {
            cancelled: "2026-11-10T11:00:00Z", short: "2026-11-11T10:00:00Z",
        }

    def test_tu_ngay_sau_den_ngay(self, client):
        res = client.get("/api/v1/bookings", params={"from_date": "2026-11-03", "to_date": "2026-11-02"},
                         headers=auth_header(CUSTOMER_ID))
        assert res.status_code == 400 and res.json()["error"]["code"] == "INVALID_REQUEST"

    def test_loc_status_va_khoang_ngay(self, client):
        d1 = make_booking(start_at=datetime(2026, 11, 1, 16), status="COMPLETED")
        d2 = make_booking(start_at=datetime(2026, 11, 2, 16))
        d3 = make_booking(start_at=datetime(2026, 11, 3, 16))
        assert list_ids(client, CUSTOMER_ID, status="COMPLETED") == [d1]
        assert list_ids(client, CUSTOMER_ID, from_date="2026-11-02") == [d2, d3]
        assert list_ids(client, CUSTOMER_ID, to_date="2026-11-02") == [d1, d2]
        assert list_ids(client, CUSTOMER_ID, from_date="2026-11-02", to_date="2026-11-02") == [d2]
        assert list_ids(client, CUSTOMER_ID, status="DEPOSITED", to_date="2026-11-02") == [d2]

    def test_sap_xep_mac_dinh_va_phan_trang(self, client):
        # Thứ tự tạo cố ý khác thứ tự mong đợi: play_date DESC, start_at DESC, id DESC
        starts = [
            datetime(2026, 11, 2, 16), datetime(2026, 11, 3, 8), datetime(2026, 11, 1, 20),
            datetime(2026, 11, 3, 18), datetime(2026, 11, 2, 16),
        ]
        made = [make_booking(start_at=start) for start in starts]
        ids = [made[i] for i in (2, 0, 4, 1, 3)]  # tăng dần theo (play_date, start_at, id)
        pages = []
        for page in (1, 2, 3, 4):
            body = client.get("/api/v1/bookings", params={"page": page, "limit": 2},
                              headers=auth_header(CUSTOMER_ID)).json()
            assert body["meta"] == {"page": page, "limit": 2, "total": 5, "total_pages": 3}
            pages.append([item["id"] for item in body["data"]])
        assert pages == [[ids[4], ids[3]], [ids[2], ids[1]], [ids[0]], []]

    def test_khong_co_don(self, client):
        body = client.get("/api/v1/bookings", headers=auth_header(CUSTOMER_ID)).json()
        assert body["data"] == [] and body["meta"]["total"] == 0 and body["meta"]["total_pages"] == 0

    @pytest.mark.parametrize("params", [
        {"status": "PAID"}, {"page": 0}, {"limit": 0}, {"limit": 101}, {"from_date": "10/11/2026"},
    ])
    def test_tham_so_sai(self, client, params):
        res = client.get("/api/v1/bookings", params=params, headers=auth_header(CUSTOMER_ID))
        assert res.status_code == 422 and res.json()["error"]["code"] == "VALIDATION_ERROR"

    def test_chua_dang_nhap(self, client):
        assert client.get("/api/v1/bookings").status_code == 401


# ==============================================================================
# 3.6 GET /bookings/{id}
# ==============================================================================
def detail(client, bid, user_id=CUSTOMER_ID):
    return client.get(f"/api/v1/bookings/{bid}", headers=auth_header(user_id))


class TestOwnerBooking:
    def test_owner_cannot_book_own_facility(self, client):
        response = client.post("/api/v1/bookings", headers=auth_header(OWNER_A_ID), json={
            "court_id": COURT_A, "play_date": (now_naive().date() + timedelta(days=2)).isoformat(),
            "time_slot_ids": [1],
        })

        assert response.status_code == 400
        assert response.json()["error"]["code"] == "CANNOT_BOOK_OWN_FACILITY"
        with TestingSessionLocal() as db:
            assert db.query(Booking).count() == 0
            assert db.query(BookingSlot).count() == 0

    def test_owner_can_deposit_view_and_cancel_own_booking_elsewhere(self, client):
        with TestingSessionLocal() as db:
            db.get(Wallet, OWNER_A_WALLET).balance = 100_000
            db.commit()

        headers = auth_header(OWNER_A_ID)
        response = client.post("/api/v1/bookings", headers=headers, json={
            "court_id": COURT_B, "play_date": (now_naive().date() + timedelta(days=2)).isoformat(),
            "time_slot_ids": [1],
        })
        assert response.status_code == 201, response.text
        booking_id = response.json()["data"]["booking_id"]
        path = f"/api/v1/bookings/{booking_id}"
        facility_owner_headers = auth_header(OWNER_B_ID)
        cancel_body = {"cancel_reason": "Đổi lịch chơi"}

        assert client.post(f"{path}/deposit", headers=facility_owner_headers).status_code == 403
        deposit = client.post(f"{path}/deposit", headers=headers)
        assert deposit.status_code == 200, deposit.text
        assert deposit.json()["data"]["wallet_balance_remaining"] == 70_000
        assert balances()[SYSTEM_WALLET] == SYSTEM_START + 30_000

        booking_detail = detail(client, booking_id, OWNER_A_ID)
        assert booking_detail.status_code == 200 and booking_detail.json()["data"]["user_id"] == OWNER_A_ID
        assert client.get(f"{path}/cancel-preview", headers=facility_owner_headers).status_code == 403
        assert client.post(f"{path}/cancel", headers=facility_owner_headers, json=cancel_body).status_code == 403
        preview = client.get(f"{path}/cancel-preview", headers=headers)
        assert preview.status_code == 200, preview.text
        assert preview.json()["data"]["financial_result"]["refund_amount_to_player"] == 24_000

        cancelled = client.post(f"{path}/cancel", headers=headers, json=cancel_body)
        assert cancelled.status_code == 200, cancelled.text
        assert cancelled.json()["data"]["customer_new_wallet_balance"] == 94_000
        assert status_of(booking_id) == "CANCELLED"
        assert balances()[OWNER_B_WALLET] == 6_000


class TestBookingDetail:
    def test_response_dung_spec(self, client):
        bid = make_booking(start_at=datetime(2026, 11, 10, 16, 0))
        add_slots(bid, [2, 1])  # thêm slot 17h trước slot 16h để kiểm tra thứ tự trả về
        db = TestingSessionLocal()
        db.add(BookingService(booking_id=bid, service_id=1, quantity=2, unit_price=20_000, total_price=40_000))
        db.commit()
        db.close()

        res = detail(client, bid)
        assert res.status_code == 200
        assert res.json() == {
            "success": True,
            "message": "Lấy chi tiết đơn đặt sân thành công.",
            "data": {
                "id": bid, "user_id": CUSTOMER_ID, "customer_name": "Khách hàng",
                "court_id": COURT_A, "court_name": "Sân A1", "facility_name": "Cơ sở A", "play_date": "2026-11-10", "start_at": "2026-11-10T09:00:00Z",
                "status": "DEPOSITED",
                "slots": [
                    {"time_slot_id": 1, "start_time": "16:00:00", "end_time": "17:00:00",
                     "base_price": 100_000, "multiplier": 1.0, "final_price": 100_000},
                    {"time_slot_id": 2, "start_time": "17:00:00", "end_time": "18:00:00",
                     "base_price": 100_000, "multiplier": 1.3, "final_price": 130_000},
                ],
                "services": [{"service_id": 1, "name": "Thuê vợt", "quantity": 2,
                              "unit_price": 20_000, "total_price": 40_000}],
                "pricing_summary": {
                    "subtotal": 230_000, "service_total": 40_000, "total_amount": 270_000,
                    "deposit_amount": 81_000, "remaining_amount_due_at_court": 189_000,
                },
                "hold_expires_at": None,
                "cancelled_at": None,
                "cancel_reason": None,
            },
        }

    def test_don_da_huy_co_ly_do(self, client):
        bid = make_booking(status="CANCELLED", cancel_reason="Bận việc gia đình")
        assert detail(client, bid).json()["data"]["cancel_reason"] == "Bận việc gia đình"

    def test_lay_so_da_luu_khong_tinh_lai(self, client):
        # Số lưu cố ý không khớp bảng giá hay tỉ lệ 30% hiện tại
        bid = make_booking(subtotal=111, service_total=0, total_amount=111, deposit_amount=7)
        assert detail(client, bid).json()["data"]["pricing_summary"] == {
            "subtotal": 111, "service_total": 0, "total_amount": 111,
            "deposit_amount": 7, "remaining_amount_due_at_court": 104,
        }

    def test_thoi_gian_giu_cho_va_huy_doi_sang_utc(self, client):
        pending = make_booking(status="PENDING_DEPOSIT", hold_expires_at=datetime(2026, 11, 10, 14, 40))
        cancelled = make_booking(status="CANCELLED", cancelled_at=datetime(2026, 11, 10, 14, 45))
        assert detail(client, pending).json()["data"]["hold_expires_at"] == "2026-11-10T07:40:00Z"
        assert detail(client, cancelled).json()["data"]["cancelled_at"] == "2026-11-10T07:45:00Z"

    @pytest.mark.parametrize("user_id", [CUSTOMER_ID, OWNER_A_ID, ADMIN_ID],
                             ids=["chu-don", "chu-san", "admin"])
    def test_duoc_xem(self, client, user_id):
        assert detail(client, make_booking(), user_id).status_code == 200

    @pytest.mark.parametrize("user_id", [OTHER_CUSTOMER_ID, OWNER_B_ID], ids=["khach-khac", "chu-san-khac"])
    def test_khong_duoc_xem(self, client, user_id):
        res = detail(client, make_booking(), user_id)
        assert res.status_code == 403 and res.json()["error"]["code"] == "AUTH_FORBIDDEN"

    def test_khong_ton_tai(self, client):
        res = detail(client, 99999)
        assert res.status_code == 404 and res.json()["error"]["code"] == "BOOKING_NOT_FOUND"

    def test_chua_dang_nhap(self, client):
        assert client.get(f"/api/v1/bookings/{make_booking()}").status_code == 401


# ==============================================================================
# 4.3 POST /bookings/{id}/complete
# ==============================================================================
def complete(client, bid, user_id=OWNER_A_ID):
    return client.post(f"/api/v1/bookings/{bid}/complete", headers=auth_header(user_id))


def assert_untouched(bid, expected_status):
    assert status_of(bid) == expected_status
    assert transactions() == []
    assert balances()[SYSTEM_WALLET] == SYSTEM_START and balances()[OWNER_A_WALLET] == 0


class TestComplete:
    @pytest.mark.parametrize("user_id", [OWNER_A_ID, ADMIN_ID], ids=["chu-san", "admin"])
    def test_kt_01_ket_toan_sau_gio_choi(self, client, user_id):
        bid = make_booking()
        total_before = sum(balances().values())
        res = complete(client, bid, user_id)
        assert res.status_code == 200
        assert res.json() == {
            "success": True,
            "message": "Xác nhận hoàn tất buổi chơi và kết toán tiền cọc cho chủ sân thành công.",
            "data": {
                "booking_id": bid, "status": "COMPLETED", "settled_deposit_amount": 81_000,
                "transferred_to_owner_wallet_id": OWNER_A_WALLET, "transaction_type": "SETTLE",
            },
        }
        after = balances()
        assert after[SYSTEM_WALLET] == SYSTEM_START - 81_000 and after[OWNER_A_WALLET] == 81_000
        assert sum(after.values()) == total_before  # VI-05
        assert status_of(bid) == "COMPLETED"
        [tx] = transactions()
        assert (tx.type, tx.amount, tx.from_wallet_id, tx.to_wallet_id, tx.related_booking_id) == (
            "SETTLE", 81_000, SYSTEM_WALLET, OWNER_A_WALLET, bid)
        assert tx.balance_after == 81_000 and tx.created_by is None

    def test_ket_toan_dung_gio_bat_dau(self, client, monkeypatch):
        start_at = datetime(2026, 11, 10, 16, 0)
        monkeypatch.setattr(bookings_ep, "now_vn", lambda: start_at.replace(tzinfo=bookings_ep.VN_TZ))
        assert complete(client, make_booking(start_at=start_at)).status_code == 200

    def test_kt_02_truoc_gio_choi(self, client):
        bid = make_booking(start_at=now_naive() + timedelta(minutes=1))
        res = complete(client, bid)
        assert res.status_code == 400 and res.json()["error"]["code"] == "CANNOT_SETTLE_BEFORE_START"
        assert_untouched(bid, "DEPOSITED")

    @pytest.mark.parametrize("status", ["PENDING_DEPOSIT", "CANCELLED"])
    @pytest.mark.parametrize("hours", [-1, 24], ids=["da-den-gio", "chua-den-gio"])
    def test_kt_03_chua_coc_hoac_da_huy(self, client, status, hours):
        # Sai trạng thái được kiểm trước giờ chơi (spec 4.3 bước 1)
        bid = make_booking(status=status, start_at=now_naive() + timedelta(hours=hours))
        res = complete(client, bid)
        assert res.status_code == 400 and res.json()["error"]["code"] == "CANNOT_SETTLE_BOOKING"
        assert_untouched(bid, status)

    def test_kt_04_goi_hai_lan_chi_chuyen_mot_lan(self, client):
        bid = make_booking()
        assert complete(client, bid).status_code == 200
        for user_id in (OWNER_A_ID, ADMIN_ID):
            res = complete(client, bid, user_id)
            assert res.status_code == 400 and res.json()["error"]["code"] == "CANNOT_SETTLE_BOOKING"
        assert len(transactions()) == 1
        assert balances()[OWNER_A_WALLET] == 81_000
        assert balances()[SYSTEM_WALLET] == SYSTEM_START - 81_000

    @pytest.mark.parametrize("user_id", [OWNER_B_ID, CUSTOMER_ID], ids=["chu-san-khac", "khach"])
    def test_kt_05_khong_phai_chu_san(self, client, user_id):
        bid = make_booking()
        res = complete(client, bid, user_id)
        assert res.status_code == 403 and res.json()["error"]["code"] == "AUTH_FORBIDDEN"
        assert_untouched(bid, "DEPOSITED")

    def test_vi_he_thong_thieu_tien_thi_rollback(self, client):
        bid = make_booking(deposit_amount=SYSTEM_START + 1)
        res = complete(client, bid)
        assert res.status_code == 402 and res.json()["error"]["code"] == "WALLET_INSUFFICIENT_BALANCE"
        assert_untouched(bid, "DEPOSITED")

    def test_khong_ton_tai(self, client):
        res = complete(client, 99999)
        assert res.status_code == 404 and res.json()["error"]["code"] == "BOOKING_NOT_FOUND"

    def test_vi_05_coc_roi_ket_toan_so_du_khop_so_cai(self, client):
        start_at = now_naive() - timedelta(minutes=5)
        bid = make_booking(status="PENDING_DEPOSIT", start_at=start_at,
                           hold_expires_at=now_naive() + timedelta(minutes=5))
        before = balances()
        assert client.post(f"/api/v1/bookings/{bid}/deposit", headers=auth_header(CUSTOMER_ID)).status_code == 200
        assert complete(client, bid).status_code == 200
        after = balances()
        assert sum(after.values()) == sum(before.values())
        for wallet_id, balance in after.items():
            delta = sum(t.amount for t in transactions() if t.to_wallet_id == wallet_id) - sum(
                t.amount for t in transactions() if t.from_wallet_id == wallet_id)
            assert balance - before[wallet_id] == delta
