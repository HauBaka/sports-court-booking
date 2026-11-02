# pyright: reportGeneralTypeIssues=false, reportAttributeAccessIssue=false
from datetime import date

import pytest
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.pricing import Holiday
from tests.db_support import (
    ADMIN_ID,
    CUSTOMER_ID,
    OWNER_A_ID,
    TestingSessionLocal,
    api_client,
    auth_header,
)


@pytest.fixture(scope="module")
def client():
    yield from api_client()


def add_holiday(name: str, holiday_date: date) -> None:
    db = TestingSessionLocal()
    db.add(Holiday(name=name, holiday_date=holiday_date, recurring_yearly=True))
    db.commit()
    db.close()


def count_holidays_on(holiday_date: date) -> int:
    db = TestingSessionLocal()
    n = db.query(Holiday).filter(Holiday.holiday_date == holiday_date).count()
    db.close()
    return n


class TestListHolidays:
    def test_khach_hang_da_dang_nhap_xem_duoc_va_sap_xep_theo_ngay(self, client):
        add_holiday("Quốc Khánh", date(2027, 9, 2))
        add_holiday("Tết Dương Lịch", date(2027, 1, 1))

        res = client.get("/api/v1/holidays", headers=auth_header(CUSTOMER_ID))

        assert res.status_code == 200
        body = res.json()
        assert body["success"] is True
        assert body["message"] == "Lấy danh mục ngày lễ thành công."
        dates = [h["holiday_date"] for h in body["data"]]
        assert dates == sorted(dates)
        assert "2027-01-01" in dates and "2027-09-02" in dates
        first = next(h for h in body["data"] if h["holiday_date"] == "2027-01-01")
        assert first["name"] == "Tết Dương Lịch"
        assert first["recurring_yearly"] is True
        assert set(first) == {"id", "name", "holiday_date", "recurring_yearly"}

    @pytest.mark.parametrize("user_id", [ADMIN_ID, OWNER_A_ID, CUSTOMER_ID])
    def test_moi_vai_tro_da_dang_nhap_deu_goi_duoc(self, client, user_id):
        res = client.get("/api/v1/holidays", headers=auth_header(user_id))
        assert res.status_code == 200

    def test_chua_dang_nhap_bi_401(self, client):
        res = client.get("/api/v1/holidays")
        assert res.status_code == 401
        assert res.json()["success"] is False


class TestCreateHoliday:
    BODY = {"name": "Giỗ Tổ Hùng Vương", "holiday_date": "2027-04-06", "recurring_yearly": True}

    def test_admin_tao_thanh_cong_va_xuat_hien_trong_danh_sach(self, client):
        res = client.post("/api/v1/admin/holidays", json=self.BODY, headers=auth_header(ADMIN_ID))

        assert res.status_code == 201
        assert res.json()["message"] == "Thêm ngày lễ mới thành công."
        data = res.json()["data"]
        assert data["name"] == "Giỗ Tổ Hùng Vương"
        assert data["holiday_date"] == "2027-04-06"
        assert data["recurring_yearly"] is True
        assert isinstance(data["id"], int)

        listed = client.get("/api/v1/holidays", headers=auth_header(CUSTOMER_ID)).json()["data"]
        assert "2027-04-06" in [h["holiday_date"] for h in listed]

    def test_recurring_yearly_mac_dinh_la_false(self, client):
        body = {"name": "Ngày lễ riêng", "holiday_date": "2027-06-15"}
        res = client.post("/api/v1/admin/holidays", json=body, headers=auth_header(ADMIN_ID))
        assert res.status_code == 201
        assert res.json()["data"]["recurring_yearly"] is False

    def test_trung_holiday_date_tra_409_va_khong_tao_them(self, client):
        body = {"name": "Quốc Tế Lao Động", "holiday_date": "2027-05-01", "recurring_yearly": True}
        first = client.post("/api/v1/admin/holidays", json=body, headers=auth_header(ADMIN_ID))
        assert first.status_code == 201

        again = client.post("/api/v1/admin/holidays", json={**body, "name": "Tên khác"}, headers=auth_header(ADMIN_ID))

        assert again.status_code == 409
        assert again.json()["error"]["code"] == "HOLIDAY_DATE_EXISTS"
        assert count_holidays_on(date(2027, 5, 1)) == 1

    def test_hai_request_cung_ngay_song_song_dung_unique_van_ra_409(self, client, monkeypatch):
        """Bước kiểm tra trước lọt (chưa có ngày này) nhưng commit đụng UNIQUE của DB: phải là 409, không phải 500."""

        def commit_dung_unique(self):
            raise IntegrityError("INSERT INTO holidays", {}, Exception("UNIQUE constraint failed: holidays.holiday_date"))

        monkeypatch.setattr(Session, "commit", commit_dung_unique)
        body = {"name": "Chạy đua", "holiday_date": "2027-09-09"}
        res = client.post("/api/v1/admin/holidays", json=body, headers=auth_header(ADMIN_ID))
        monkeypatch.undo()

        assert res.status_code == 409
        assert res.json()["error"]["code"] == "HOLIDAY_DATE_EXISTS"
        assert count_holidays_on(date(2027, 9, 9)) == 0

    def test_chu_san_bi_403(self, client):
        body = {"name": "Lễ của chủ sân", "holiday_date": "2027-07-01"}
        res = client.post("/api/v1/admin/holidays", json=body, headers=auth_header(OWNER_A_ID))
        assert res.status_code == 403
        assert res.json()["error"]["code"] == "AUTH_FORBIDDEN"
        assert count_holidays_on(date(2027, 7, 1)) == 0

    def test_khach_hang_bi_403(self, client):
        body = {"name": "Lễ của khách", "holiday_date": "2027-07-02"}
        res = client.post("/api/v1/admin/holidays", json=body, headers=auth_header(CUSTOMER_ID))
        assert res.status_code == 403
        assert count_holidays_on(date(2027, 7, 2)) == 0

    def test_chua_dang_nhap_bi_401(self, client):
        res = client.post("/api/v1/admin/holidays", json=self.BODY)
        assert res.status_code == 401

    @pytest.mark.parametrize(
        "body",
        [
            {"holiday_date": "2027-08-01"},
            {"name": "", "holiday_date": "2027-08-01"},
            {"name": "Sai ngày", "holiday_date": "không-phải-ngày"},
            {"name": "Thiếu ngày"},
        ],
    )
    def test_du_lieu_sai_tra_422(self, client, body):
        res = client.post("/api/v1/admin/holidays", json=body, headers=auth_header(ADMIN_ID))
        assert res.status_code == 422
        assert res.json()["error"]["code"] == "VALIDATION_ERROR"
