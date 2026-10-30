from datetime import date, datetime, time, timedelta, timezone
from typing import Generator
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import BigInteger, create_engine
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.deps import get_db
from app.core.database import Base
from app.core.security import create_access_token, hash_password
from app.main import app
from app.models.booking import Booking, BookingSlot
from app.models.facility import Court, CourtSlot, Facility, Sport, TimeSlot
from app.models.user import Role, User, UserRole

# SQLite chỉ autoincrement với INTEGER PRIMARY KEY nên biên dịch BigInteger thành INTEGER
@compiles(BigInteger, "sqlite")
def _bigint_as_integer(type_, compiler, **kw):
    return "INTEGER"


# SQLite in-memory cho test suite
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"

test_engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)


def override_get_db() -> Generator[Session, None, None]:
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture(scope="module")
def setup_db():
    Base.metadata.create_all(bind=test_engine)
    db = TestingSessionLocal()

    # 1. Roles
    role_customer = Role(id=1, name="CUSTOMER", description="Khách hàng")
    role_owner = Role(id=2, name="OWNER", description="Chủ sân")
    role_admin = Role(id=3, name="ADMIN", description="Quản trị viên")
    db.add_all([role_customer, role_owner, role_admin])
    db.commit()

    # 2. Sports
    sport_badminton = Sport(id=1, name="Cầu lông")
    sport_pickleball = Sport(id=2, name="Pickleball")
    sport_football = Sport(id=3, name="Bóng đá mini")
    db.add_all([sport_badminton, sport_pickleball, sport_football])
    db.commit()

    # 3. Users
    pwd_hash = hash_password("TestPass123@")
    # User 3: Chủ sân A (Owner A)
    owner_a = User(
        id=3,
        name="Trần Văn Chủ A",
        email="owner.a@scb.vn",
        phone="0900000002",
        password_hash=pwd_hash,
        is_active=True,
    )
    # User 4: Khách hàng (Customer)
    customer = User(
        id=4,
        name="Lê Khách Hàng",
        email="customer@scb.vn",
        phone="0900000003",
        password_hash=pwd_hash,
        is_active=True,
    )
    # User 6: Chủ sân B (Owner B)
    owner_b = User(
        id=6,
        name="Nguyễn Văn Chủ B",
        email="owner.b@scb.vn",
        phone="0900000006",
        password_hash=pwd_hash,
        is_active=True,
    )
    db.add_all([owner_a, customer, owner_b])
    db.commit()

    # User Roles
    db.add_all([
        UserRole(user_id=3, role_id=2),
        UserRole(user_id=4, role_id=1),
        UserRole(user_id=6, role_id=2),
    ])
    db.commit()

    # 4. TimeSlots: 06:00 đến 23:00 (17 slots)
    for hour in range(6, 23):
        start_t = time(hour, 0)
        end_t = time(hour + 1, 0)
        ts = TimeSlot(
            id=hour - 5,  # 1 to 17
            start_time=start_t,
            end_time=end_t,
            duration_minutes=60,
            label=f"{hour:02d}:00 - {hour+1:02d}:00",
        )
        db.add(ts)
    db.commit()

    # 5. Facilities
    # Facility 1: Của Owner A, Active, TP.HCM
    fac_1 = Facility(
        id=1,
        owner_id=3,
        name="Cơ Sở Cầu Lông & Pickleball Kỳ Hòa",
        address="238 Ba Tháng Hai, Phường 12, Quận 10",
        city="Hồ Chí Minh",
        district="Quận 10",
        latitude=10.771921,
        longitude=106.671042,
        open_time=time(6, 0),
        close_time=time(23, 0),
        description="Cơ sở Kỳ Hòa hiện đại",
        is_active=True,
    )
    # Facility 2: Của Owner A, Inactive (để test lọc is_active=false không hiện)
    fac_2 = Facility(
        id=2,
        owner_id=3,
        name="Cơ Sở Tạm Dừng Hoạt Động",
        address="100 Đường Ẩn, Quận 3",
        city="Hồ Chí Minh",
        district="Quận 3",
        open_time=time(6, 0),
        close_time=time(22, 0),
        is_active=False,
    )
    # Facility 3: Của Owner B, Active, Hà Nội
    fac_3 = Facility(
        id=3,
        owner_id=6,
        name="Cơ Sở Bóng Đá & Cầu Lông Hà Nội",
        address="456 Kim Mã, Ba Đình",
        city="Hà Nội",
        district="Ba Đình",
        open_time=time(7, 0),
        close_time=time(22, 0),
        is_active=True,
    )
    db.add_all([fac_1, fac_2, fac_3])
    db.commit()

    # 6. Courts & CourtSlots cho Facility 1
    # Sân 1: Cầu lông, 06:00 - 23:00, 100.000 VNĐ
    court_1 = Court(
        id=1,
        facility_id=1,
        sport_id=1,
        name="Sân Cầu Lông 1 (Thảm Yonex)",
        court_type="STANDARD",
        environment="INDOOR",
        open_time=time(6, 0),
        close_time=time(23, 0),
        is_active=True,
    )
    # Sân 2: Cầu lông, 06:00 - 23:00, 100.000 VNĐ
    court_2 = Court(
        id=2,
        facility_id=1,
        sport_id=1,
        name="Sân Cầu Lông 2 (Thảm Yonex)",
        court_type="STANDARD",
        environment="INDOOR",
        open_time=time(6, 0),
        close_time=time(23, 0),
        is_active=True,
    )
    # Sân 3: Pickleball, 07:00 - 22:00, 120.000 VNĐ
    court_3 = Court(
        id=3,
        facility_id=1,
        sport_id=2,
        name="Sân Pickleball 1",
        court_type="STANDARD",
        environment="INDOOR",
        open_time=time(7, 0),
        close_time=time(22, 0),
        is_active=True,
    )
    # Sân 4: Tạm dừng hoạt động (is_active=False)
    court_4 = Court(
        id=4,
        facility_id=1,
        sport_id=1,
        name="Sân Đang Sửa Chữa",
        court_type="STANDARD",
        environment="INDOOR",
        open_time=time(6, 0),
        close_time=time(23, 0),
        is_active=False,
    )
    db.add_all([court_1, court_2, court_3, court_4])
    db.commit()

    # Gán slots cho court 1, 2 (id 1..17: giá 100.000)
    for slot_id in range(1, 18):
        db.add(CourtSlot(court_id=1, time_slot_id=slot_id, base_price=100000, is_active=True))
        db.add(CourtSlot(court_id=2, time_slot_id=slot_id, base_price=100000, is_active=True))
    # Gán slots cho court 3 (id 2..16: giá 120.000)
    for slot_id in range(2, 17):
        db.add(CourtSlot(court_id=3, time_slot_id=slot_id, base_price=120000, is_active=True))
    db.commit()

    # Sân của Facility 3: Bóng đá mini (sport_id=3)
    court_fac3 = Court(
        id=10,
        facility_id=3,
        sport_id=3,
        name="Sân Bóng Đá Mini 1",
        court_type="STANDARD",
        environment="OUTDOOR",
        open_time=time(7, 0),
        close_time=time(22, 0),
        is_active=True,
    )
    db.add(court_fac3)
    db.commit()
    for slot_id in range(2, 17):
        db.add(CourtSlot(court_id=10, time_slot_id=slot_id, base_price=200000, is_active=True))
    db.commit()

    db.close()
    yield
    Base.metadata.drop_all(bind=test_engine)


def get_token(user_id: int) -> dict:
    token = create_access_token(data={"sub": str(user_id)})
    return {"Authorization": f"Bearer {token}"}


# ==============================================================================
# SUBTASK 1 TESTS: CƠ SỞ THỂ THAO (2.1, 2.2, 2.3)
# ==============================================================================
class TestSubtask1Facilities:
    def test_2_1_list_facilities_public_pagination(self, client, setup_db):
        """2.1 Danh sách cơ sở có phân trang, trả min_price, max_price, total_courts."""
        res = client.get("/api/v1/facilities?page=1&limit=10")
        assert res.status_code == 200
        data = res.json()
        assert data["success"] is True
        assert "message" in data
        assert "meta" in data
        assert data["meta"]["page"] == 1
        assert data["meta"]["limit"] == 10
        assert data["meta"]["total"] == 2  # Cơ sở 1 và 3 (cơ sở 2 is_active=False bị loại)

        fac1 = next(f for f in data["data"] if f["id"] == 1)
        assert fac1["name"] == "Cơ Sở Cầu Lông & Pickleball Kỳ Hòa"
        assert fac1["min_price"] == 100000
        assert fac1["max_price"] == 120000
        assert fac1["total_courts"] == 3  # Sân 1, 2, 3 active (sân 4 inactive bị loại)

    def test_2_1_inactive_facilities_hidden(self, client, setup_db):
        """YÊU CẦU: Cơ sở is_active = false không hiện trong danh sách công khai."""
        res = client.get("/api/v1/facilities")
        data = res.json()
        facility_ids = [f["id"] for f in data["data"]]
        assert 2 not in facility_ids  # Facility 2 is_active=False

    def test_2_1_filter_by_sport_id(self, client, setup_db):
        """2.1 Lọc theo sport_id."""
        # sport_id = 3 (Bóng đá): chỉ có facility 3
        res = client.get("/api/v1/facilities?sport_id=3")
        assert res.status_code == 200
        data = res.json()["data"]
        assert len(data) == 1
        assert data[0]["id"] == 3

        # sport_id = 2 (Pickleball): chỉ có facility 1
        res = client.get("/api/v1/facilities?sport_id=2")
        assert res.status_code == 200
        data = res.json()["data"]
        assert len(data) == 1
        assert data[0]["id"] == 1

    def test_2_1_filter_by_city(self, client, setup_db):
        """2.1 Lọc theo tỉnh/thành phố."""
        res = client.get("/api/v1/facilities?city=Hà Nội")
        assert res.status_code == 200
        data = res.json()["data"]
        assert len(data) == 1
        assert data[0]["id"] == 3

    def test_2_1_filter_by_search(self, client, setup_db):
        """2.1 Tìm kiếm theo tên hoặc địa chỉ."""
        res = client.get("/api/v1/facilities?search=Kỳ Hòa")
        assert res.status_code == 200
        data = res.json()["data"]
        assert len(data) == 1
        assert data[0]["id"] == 1

        res = client.get("/api/v1/facilities?search=Ba Tháng Hai")
        assert res.status_code == 200
        assert len(res.json()["data"]) == 1

    def test_2_2_get_facility_detail(self, client, setup_db):
        """2.2 Xem chi tiết cơ sở và danh sách sân con trực thuộc."""
        res = client.get("/api/v1/facilities/1")
        assert res.status_code == 200
        data = res.json()["data"]
        assert data["id"] == 1
        assert data["name"] == "Cơ Sở Cầu Lông & Pickleball Kỳ Hòa"
        assert len(data["courts"]) == 3  # Chỉ các sân is_active = true
        court_ids = [c["id"] for c in data["courts"]]
        assert 1 in court_ids
        assert 2 in court_ids
        assert 3 in court_ids
        assert 4 not in court_ids

    def test_2_2_get_facility_detail_not_found(self, client, setup_db):
        """2.2 Cơ sở không tồn tại hoặc inactive trả về 404."""
        res = client.get("/api/v1/facilities/9999")
        assert res.status_code == 404
        assert res.json()["error"]["code"] == "FACILITY_NOT_FOUND"

        # Facility 2 is_active=False
        res_inactive = client.get("/api/v1/facilities/2")
        assert res_inactive.status_code == 404
        assert res_inactive.json()["error"]["code"] == "FACILITY_NOT_FOUND"

    def test_2_3_create_facility_success(self, client, setup_db):
        """2.3 Tạo cơ sở mới: Tự động gán owner_id là người dùng hiện tại."""
        body = {
            "name": "Cơ Sở Cầu Lông Tân Bình Mới",
            "address": "123 Hoàng Hoa Thám, Phường 13, Tân Bình",
            "city": "Hồ Chí Minh",
            "district": "Quận Tân Bình",
            "latitude": 10.7992,
            "longitude": 106.6501,
            "open_time": "06:00:00",
            "close_time": "23:00:00",
            "description": "Cơ sở cầu lông mới",
        }
        headers = get_token(user_id=3)  # Owner A
        res = client.post("/api/v1/facilities", json=body, headers=headers)
        assert res.status_code == 201
        data = res.json()["data"]
        assert data["name"] == body["name"]
        assert data["owner_id"] == 3  # Tự gán đúng owner hiện tại
        assert data["is_active"] is True

    def test_2_3_create_facility_forbidden_for_customer(self, client, setup_db):
        """2.3 Khách hàng gọi API tạo cơ sở bị từ chối 403 AUTH_FORBIDDEN."""
        body = {
            "name": "Cơ Sở Của Khách",
            "address": "123 Đường Không Quyền",
            "city": "Hồ Chí Minh",
            "open_time": "06:00:00",
            "close_time": "23:00:00",
        }
        headers = get_token(user_id=4)  # Customer
        res = client.post("/api/v1/facilities", json=body, headers=headers)
        assert res.status_code == 403
        assert res.json()["error"]["code"] == "AUTH_FORBIDDEN"

    def test_2_3_create_facility_invalid_times(self, client, setup_db):
        """2.3 Giờ mở cửa >= giờ đóng cửa bị từ chối 422."""
        body = {
            "name": "Cơ Sở Lỗi Giờ",
            "address": "123 Đường Sai Giờ",
            "city": "Hồ Chí Minh",
            "open_time": "23:00:00",
            "close_time": "06:00:00",
        }
        headers = get_token(user_id=3)
        res = client.post("/api/v1/facilities", json=body, headers=headers)
        assert res.status_code == 422
        assert res.json()["error"]["code"] == "VALIDATION_ERROR"


# ==============================================================================
# SUBTASK 2 TESTS: SÂN CON & KHỞI TẠO COURT_SLOTS (2.4, 2.5, 2.6)
# ==============================================================================
class TestSubtask2Courts:
    def test_2_4_list_courts_of_facility(self, client, setup_db):
        """2.4 Lấy danh sách sân con của cơ sở."""
        res = client.get("/api/v1/facilities/1/courts")
        assert res.status_code == 200
        data = res.json()["data"]
        assert len(data) == 3
        assert all(c["facility_id"] == 1 for c in data)

    def test_2_4_list_courts_non_existent_facility(self, client, setup_db):
        """2.4 Cơ sở không tồn tại trả về 404."""
        res = client.get("/api/v1/facilities/9999/courts")
        assert res.status_code == 404
        assert res.json()["error"]["code"] == "FACILITY_NOT_FOUND"

    def test_2_6_get_court_detail(self, client, setup_db):
        """2.6 Lấy chi tiết sân con."""
        res = client.get("/api/v1/courts/1")
        assert res.status_code == 200
        data = res.json()["data"]
        assert data["id"] == 1
        assert data["name"] == "Sân Cầu Lông 1 (Thảm Yonex)"
        assert data["open_time"] == "06:00:00"
        assert data["close_time"] == "23:00:00"

    def test_2_6_get_court_detail_not_found(self, client, setup_db):
        """2.6 Sân không tồn tại trả về 404."""
        res = client.get("/api/v1/courts/9999")
        assert res.status_code == 404
        assert res.json()["error"]["code"] == "COURT_NOT_FOUND"

    def test_2_5_create_court_with_slots_in_transaction(self, client, setup_db):
        """
        YÊU CẦU: Tạo sân với default_base_price = 100000, giờ 06:00–23:00
        thì mỗi khung giờ nằm trong khoảng có đúng một court_slots giá 100.000 trong cùng transaction.
        """
        body = {
            "name": "Sân Cầu Lông 99 Mới",
            "sport_id": 1,
            "court_type": "STANDARD",
            "environment": "INDOOR",
            "open_time": "06:00:00",
            "close_time": "23:00:00",
            "default_base_price": 100000,
        }
        headers = get_token(user_id=3)  # Owner A sở hữu Facility 1
        res = client.post("/api/v1/facilities/1/courts", json=body, headers=headers)
        assert res.status_code == 201
        court_data = res.json()["data"]
        court_id = court_data["id"]

        # Kiểm tra court_slots đã được tạo trong cùng transaction
        db = TestingSessionLocal()
        slots = db.query(CourtSlot).filter(CourtSlot.court_id == court_id).all()
        assert len(slots) == 17  # Đúng 17 khung giờ từ 06:00 đến 23:00
        for slot in slots:
            assert slot.base_price == 100000
            assert slot.is_active is True
        db.close()

    def test_2_5_create_court_open_time_ge_close_time_rejected(self, client, setup_db):
        """YÊU CẦU: open_time >= close_time bị từ chối (422)."""
        body = {
            "name": "Sân Lỗi Giờ",
            "sport_id": 1,
            "open_time": "18:00:00",
            "close_time": "18:00:00",
            "default_base_price": 100000,
        }
        headers = get_token(user_id=3)
        res = client.post("/api/v1/facilities/1/courts", json=body, headers=headers)
        assert res.status_code == 422
        assert res.json()["error"]["code"] == "VALIDATION_ERROR"

    def test_2_5_create_court_outside_facility_hours_rejected(self, client, setup_db):
        """Giờ sân con nằm ngoài giờ cơ sở bị từ chối 422."""
        # Facility 1 mở 06:00 đến 23:00. Thử tạo sân mở từ 05:00
        body = {
            "name": "Sân Vượt Giờ Cơ Sở",
            "sport_id": 1,
            "open_time": "05:00:00",
            "close_time": "22:00:00",
            "default_base_price": 100000,
        }
        headers = get_token(user_id=3)
        res = client.post("/api/v1/facilities/1/courts", json=body, headers=headers)
        assert res.status_code == 422
        assert res.json()["error"]["code"] == "VALIDATION_ERROR"

    def test_2_5_create_court_other_owner_forbidden(self, client, setup_db):
        """Chủ sân khác (Owner B) tạo sân ở cơ sở của Owner A bị từ chối 403."""
        body = {
            "name": "Sân Trộm",
            "sport_id": 1,
            "open_time": "06:00:00",
            "close_time": "23:00:00",
            "default_base_price": 100000,
        }
        headers = get_token(user_id=6)  # Owner B
        res = client.post("/api/v1/facilities/1/courts", json=body, headers=headers)
        assert res.status_code == 403
        assert res.json()["error"]["code"] == "AUTH_FORBIDDEN"

    def test_2_5_rollback_on_error_no_orphan_court(self, client, setup_db, monkeypatch):
        """
        YÊU CẦU: Lỗi giữa chừng thì không còn bản ghi courts mồ côi (Rollback).
        """
        db_before = TestingSessionLocal()
        count_courts_before = db_before.query(Court).count()
        db_before.close()

        # Giả lập lỗi giữa chừng khi thêm CourtSlot
        original_query = Session.query

        def faulty_query(self, *args, **kwargs):
            if args and args[0] is TimeSlot:
                raise RuntimeError("Mô phỏng lỗi DB giữa transaction khi lấy time_slots!")
            return original_query(self, *args, **kwargs)

        monkeypatch.setattr(Session, "query", faulty_query)

        body = {
            "name": "Sân Mồ Côi Cần Rollback",
            "sport_id": 1,
            "open_time": "06:00:00",
            "close_time": "23:00:00",
            "default_base_price": 100000,
        }
        headers = get_token(user_id=3)

        with pytest.raises(RuntimeError):
            client.post("/api/v1/facilities/1/courts", json=body, headers=headers)

        # Kiểm tra sau khi rollback: Số lượng sân không tăng, không có bản ghi mồ côi
        db_after = TestingSessionLocal()
        count_courts_after = db_after.query(Court).count()
        orphan = db_after.query(Court).filter(Court.name == "Sân Mồ Côi Cần Rollback").first()
        db_after.close()

        assert count_courts_after == count_courts_before
        assert orphan is None


# ==============================================================================
# SUBTASK 3 TESTS: CẬP NHẬT SÂN CON, KIỂM XUNG ĐỘT, TẠM NGƯNG (2.7)
# ==============================================================================
class TestSubtask3CourtUpdate:
    def test_2_7_other_owner_update_forbidden(self, client, setup_db):
        """SAN-06: Chủ khác không sửa được sân con -> 403 AUTH_FORBIDDEN."""
        headers = get_token(user_id=6)  # Owner B
        res = client.patch("/api/v1/courts/1", json={"name": "Sân bị sửa trái phép"}, headers=headers)
        assert res.status_code == 403
        assert res.json()["error"]["code"] == "AUTH_FORBIDDEN"

        # Tên không bị đổi
        db = TestingSessionLocal()
        court = db.query(Court).filter(Court.id == 1).first()
        assert court.name == "Sân Cầu Lông 1 (Thảm Yonex)"
        db.close()

    def test_2_7_change_schedule_rejected_if_deposited_booking_in_cutoff_slot(self, client, setup_db):
        """
        SAN-07: Đổi giờ đóng cửa 23:00 -> 22:00 khi có đơn DEPOSITED ở slot 17 (22:00-23:00)
        Bị từ chối bằng 400 CANNOT_UPDATE_COURT_SCHEDULE_ACTIVE_BOOKINGS.
        """
        db = TestingSessionLocal()
        play_date = date.today() + timedelta(days=2)
        start_at = datetime.combine(play_date, time(22, 0))

        # Tạo đơn đặt DEPOSITED ở slot 17 (22:00 - 23:00)
        booking = Booking(
            user_id=4,
            court_id=1,
            play_date=play_date,
            start_at=start_at,
            status="DEPOSITED",
            subtotal=100000,
            service_total=0,
            total_amount=100000,
            deposit_amount=30000,
            deposit_percent=30,
        )
        db.add(booking)
        db.flush()

        slot_item = BookingSlot(
            booking_id=booking.id,
            court_id=1,
            play_date=play_date,
            time_slot_id=17,  # Slot 22:00-23:00
            base_price=100000,
            final_price=100000,
            multiplier=1.00,
            released_at=None,
        )
        db.add(slot_item)
        db.commit()
        booking_id = booking.id
        db.close()

        # Gọi PATCH đổi giờ đóng cửa về 22:00:00 (cắt bỏ slot 17)
        headers = get_token(user_id=3)
        res = client.patch("/api/v1/courts/1", json={"close_time": "22:00:00"}, headers=headers)
        assert res.status_code == 400
        assert res.json()["error"]["code"] == "CANNOT_UPDATE_COURT_SCHEDULE_ACTIVE_BOOKINGS"

        # Dọn dẹp đơn test
        db_clean = TestingSessionLocal()
        b_clean = db_clean.query(Booking).filter(Booking.id == booking_id).first()
        b_clean.status = "CANCELLED"
        b_clean.cancelled_at = datetime.now(timezone.utc)
        for s in b_clean.slots:
            s.released_at = datetime.now(timezone.utc)
        db_clean.commit()
        db_clean.close()

    def test_2_7_change_schedule_sync_court_slots_success(self, client, setup_db):
        """
        SAN-08: Đổi giờ đóng cửa 23:00 thành 22:00 khi không có lịch xung đột.
        Khung giờ sau 22:00 (slot 17) có is_active = false, các khung khác vẫn true.
        """
        headers = get_token(user_id=3)  # Owner A
        res = client.patch("/api/v1/courts/2", json={"close_time": "22:00:00"}, headers=headers)
        assert res.status_code == 200
        data = res.json()["data"]
        assert data["close_time"] == "22:00:00"

        # Kiểm tra bảng court_slots của sân 2
        db = TestingSessionLocal()
        inactive_slots = (
            db.query(CourtSlot.time_slot_id)
            .filter(CourtSlot.court_id == 2, CourtSlot.is_active == False)
            .all()
        )
        inactive_ids = [s[0] for s in inactive_slots]
        assert inactive_ids == [17]  # Đúng khung 17 (22:00-23:00) chuyển thành false

        active_count = (
            db.query(CourtSlot)
            .filter(CourtSlot.court_id == 2, CourtSlot.is_active == True)
            .count()
        )
        assert active_count == 16  # 16 khung từ 06:00 đến 22:00 vẫn active
        db.close()

    def test_2_7_deactivate_court_rejected_if_deposited_booking(self, client, setup_db):
        """
        YÊU CẦU: Tạm ngưng sân: từ chối bằng 400 CANNOT_DEACTIVATE_COURT_ACTIVE_BOOKINGS
        nếu có lịch DEPOSITED trong tương lai.
        """
        db = TestingSessionLocal()
        play_date = date.today() + timedelta(days=3)
        booking = Booking(
            user_id=4,
            court_id=1,
            play_date=play_date,
            start_at=datetime.combine(play_date, time(10, 0)),
            status="DEPOSITED",
            total_amount=100000,
            deposit_amount=30000,
            deposit_percent=30,
        )
        db.add(booking)
        db.commit()
        booking_id = booking.id
        db.close()

        headers = get_token(user_id=3)
        res = client.patch("/api/v1/courts/1", json={"is_active": False}, headers=headers)
        assert res.status_code == 400
        assert res.json()["error"]["code"] == "CANNOT_DEACTIVATE_COURT_ACTIVE_BOOKINGS"

        # Sân 1 vẫn active
        db_check = TestingSessionLocal()
        c1 = db_check.query(Court).filter(Court.id == 1).first()
        assert c1.is_active is True

        # Dọn dẹp
        b_clean = db_check.query(Booking).filter(Booking.id == booking_id).first()
        b_clean.status = "CANCELLED"
        b_clean.cancelled_at = datetime.now(timezone.utc)
        db_check.commit()
        db_check.close()

    def test_2_7_deactivate_court_cancels_pending_deposit_and_releases_slots(self, client, setup_db):
        """
        YÊU CẦU: Tạm ngưng: nếu không có lịch DEPOSITED, hủy các lịch PENDING_DEPOSIT
        và nhả khung giờ trong cùng một transaction.
        """
        db = TestingSessionLocal()
        play_date = date.today() + timedelta(days=1)
        start_at = datetime.combine(play_date, time(14, 0))

        # Đơn PENDING_DEPOSIT
        pb = Booking(
            user_id=4,
            court_id=3,
            play_date=play_date,
            start_at=start_at,
            status="PENDING_DEPOSIT",
            total_amount=120000,
            deposit_amount=36000,
            deposit_percent=30,
        )
        db.add(pb)
        db.flush()

        bs = BookingSlot(
            booking_id=pb.id,
            court_id=3,
            play_date=play_date,
            time_slot_id=9,  # 14:00 - 15:00
            base_price=120000,
            final_price=120000,
            multiplier=1.00,
            released_at=None,
        )
        db.add(bs)
        db.commit()
        pb_id = pb.id
        db.close()

        # Gọi PATCH tạm ngưng sân 3
        headers = get_token(user_id=3)
        res = client.patch("/api/v1/courts/3", json={"is_active": False}, headers=headers)
        assert res.status_code == 200
        assert res.json()["data"]["is_active"] is False

        # Kiểm tra đơn PENDING_DEPOSIT đã bị hủy và slot đã được nhả
        db_check = TestingSessionLocal()
        b_after = db_check.query(Booking).filter(Booking.id == pb_id).first()
        assert b_after.status == "CANCELLED"
        assert b_after.cancelled_at is not None
        assert b_after.cancel_reason == "Sân tạm ngưng hoạt động"

        slot_after = db_check.query(BookingSlot).filter(BookingSlot.booking_id == pb_id).first()
        assert slot_after.released_at is not None
        db_check.close()

    def test_2_7_patch_rollback_on_error(self, client, setup_db, monkeypatch):
        """
        YÊU CẦU: Lỗi giữa chừng thì không thay đổi gì (Rollback).
        """
        db = TestingSessionLocal()
        court_orig = db.query(Court).filter(Court.id == 1).first()
        orig_name = court_orig.name
        db.close()

        # Giả lập lỗi khi commit
        def faulty_commit(self):
            raise RuntimeError("Mô phỏng lỗi DB commit giữa transaction!")

        monkeypatch.setattr(Session, "commit", faulty_commit)

        headers = get_token(user_id=3)
        with pytest.raises(RuntimeError):
            client.patch("/api/v1/courts/1", json={"name": "Tên Cần Rollback"}, headers=headers)

        # Kiểm tra tên sân không bị thay đổi
        db_check = TestingSessionLocal()
        court_after = db_check.query(Court).filter(Court.id == 1).first()
        assert court_after.name == orig_name
        db_check.close()
