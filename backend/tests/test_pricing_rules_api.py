# pyright: reportGeneralTypeIssues=false, reportAttributeAccessIssue=false
from datetime import date, time
from decimal import Decimal
from typing import List

import pytest
from sqlalchemy.orm import Session

from app.core.pricing import resolve_multiplier
from app.models.pricing import Holiday, PricingRule
from tests.db_support import (
    CUSTOMER_ID,
    FACILITY_A_ID,
    FACILITY_B_ID,
    OWNER_A_ID,
    OWNER_B_ID,
    TestingSessionLocal,
    api_client,
    auth_header,
)


@pytest.fixture(scope="module")
def client():
    yield from api_client()


PEAK = {"name": "Giờ vàng", "rule_type": "PEAK_HOUR", "multiplier": 1.30,
        "start_time": "17:00:00", "end_time": "21:00:00"}
SATURDAY = {"name": "Thứ Bảy", "rule_type": "WEEKEND", "multiplier": 1.40, "day_of_week": 6}
SUNDAY = {"name": "Chủ Nhật", "rule_type": "WEEKEND", "multiplier": 1.40, "day_of_week": 7}


def url(facility_id: int) -> str:
    return f"/api/v1/facilities/{facility_id}/pricing-rules"


def set_rules(facility_id: int, names: List[str]) -> None:
    """Đặt sẵn bộ quy tắc "cũ" cho cơ sở bằng cách ghi thẳng vào DB."""
    db: Session = TestingSessionLocal()
    db.query(PricingRule).filter(PricingRule.applies_to_facility_id == facility_id).delete()
    for name in names:
        db.add(PricingRule(name=name, rule_type="WEEKEND", multiplier=Decimal("1.40"),
                           applies_to_facility_id=facility_id, day_of_week=6))
    db.commit()
    db.close()


def rule_names(facility_id: int) -> List[str]:
    db: Session = TestingSessionLocal()
    rows = db.query(PricingRule).filter(PricingRule.applies_to_facility_id == facility_id).all()
    names = sorted(r.name for r in rows)
    db.close()
    return names


class TestReplaceRules:
    def test_thay_the_bo_cu_bang_bo_moi_va_dem_dung(self, client):
        set_rules(FACILITY_A_ID, ["Cũ 1", "Cũ 2", "Cũ 3"])

        res = client.post(url(FACILITY_A_ID), json={"rules": [PEAK, SATURDAY]}, headers=auth_header(OWNER_A_ID))

        assert res.status_code == 200
        body = res.json()
        assert body["success"] is True
        assert body["message"] == "Cấu hình bảng giá theo thời điểm thành công."
        assert body["data"] == {"facility_id": FACILITY_A_ID, "total_rules_active": 2}
        assert rule_names(FACILITY_A_ID) == ["Giờ vàng", "Thứ Bảy"]

    def test_dem_theo_so_quy_tac_thuc_te(self, client):
        res = client.post(url(FACILITY_A_ID), json={"rules": [PEAK, SATURDAY, SUNDAY]}, headers=auth_header(OWNER_A_ID))
        assert res.status_code == 200
        assert res.json()["data"]["total_rules_active"] == 3

    def test_bo_rong_xoa_het_quy_tac(self, client):
        set_rules(FACILITY_A_ID, ["Cũ 1"])
        res = client.post(url(FACILITY_A_ID), json={"rules": []}, headers=auth_header(OWNER_A_ID))
        assert res.status_code == 200
        assert res.json()["data"]["total_rules_active"] == 0
        assert rule_names(FACILITY_A_ID) == []

    def test_gia_tri_duoc_luu_dung(self, client):
        res = client.post(url(FACILITY_A_ID), json={"rules": [PEAK]}, headers=auth_header(OWNER_A_ID))
        assert res.status_code == 200

        db = TestingSessionLocal()
        rule = db.query(PricingRule).filter(PricingRule.applies_to_facility_id == FACILITY_A_ID).one()
        assert rule.rule_type == "PEAK_HOUR"
        assert rule.multiplier == Decimal("1.30")
        assert rule.start_time == time(17, 0)
        assert rule.end_time == time(21, 0)
        assert rule.day_of_week is None and rule.holiday_id is None
        db.close()

    def test_khong_dong_den_quy_tac_cua_co_so_khac(self, client):
        set_rules(FACILITY_B_ID, ["Của cơ sở B"])
        set_rules(FACILITY_A_ID, ["Cũ của A"])

        res = client.post(url(FACILITY_A_ID), json={"rules": [PEAK]}, headers=auth_header(OWNER_A_ID))

        assert res.status_code == 200
        assert rule_names(FACILITY_B_ID) == ["Của cơ sở B"]

    def test_quy_tac_ngay_le_tro_toi_ngay_le_co_that(self, client):
        db = TestingSessionLocal()
        db.add(Holiday(id=1, name="Tết Dương Lịch", holiday_date=date(2027, 1, 1), recurring_yearly=True))
        db.commit()
        db.close()

        rule = {"name": "Tết", "rule_type": "HOLIDAY", "multiplier": 1.50, "holiday_id": 1}
        res = client.post(url(FACILITY_A_ID), json={"rules": [rule]}, headers=auth_header(OWNER_A_ID))

        assert res.status_code == 200
        assert res.json()["data"]["total_rules_active"] == 1

    @pytest.mark.parametrize("value", [1.20, 1.50])
    def test_hai_dau_mut_cua_khoang_he_so_duoc_luu(self, client, value):
        """Số JSON 1.2 / 1.5 không được bị lệch dấu phẩy động mà rơi ra ngoài [1.20, 1.50]."""
        rule = {**PEAK, "multiplier": value}
        res = client.post(url(FACILITY_A_ID), json={"rules": [rule]}, headers=auth_header(OWNER_A_ID))

        assert res.status_code == 200
        db = TestingSessionLocal()
        saved = db.query(PricingRule).filter(PricingRule.applies_to_facility_id == FACILITY_A_ID).one()
        assert saved.multiplier == Decimal(str(value))
        db.close()

    def test_applies_to_facility_id_trong_body_bi_bo_qua(self, client):
        """Cơ sở lấy từ đường dẫn (đã kiểm quyền sở hữu), không tin trường trong body."""
        set_rules(FACILITY_A_ID, [])
        set_rules(FACILITY_B_ID, ["Của cơ sở B"])
        sneaky = {**PEAK, "applies_to_facility_id": FACILITY_B_ID}

        res = client.post(url(FACILITY_A_ID), json={"rules": [sneaky]}, headers=auth_header(OWNER_A_ID))

        assert res.status_code == 200
        assert rule_names(FACILITY_A_ID) == ["Giờ vàng"]
        assert rule_names(FACILITY_B_ID) == ["Của cơ sở B"]


class TestSavedRulesFeedResolveMultiplier:
    def test_quy_tac_luu_qua_api_doc_lai_tu_db_van_cho_dung_he_so(self, client):
        """Sprint 3 sẽ đọc quy tắc từ DB rồi gọi resolve_multiplier: kiểm tra trọn đường POST -> DB -> hệ số."""
        res = client.post(url(FACILITY_A_ID), json={"rules": [PEAK, SATURDAY, SUNDAY]}, headers=auth_header(OWNER_A_ID))
        assert res.status_code == 200

        db = TestingSessionLocal()
        rules = db.query(PricingRule).filter(PricingRule.applies_to_facility_id == FACILITY_A_ID).all()
        assert resolve_multiplier(date(2026, 11, 7), time(18, 0), rules) == Decimal("1.40")  # thứ Bảy 18h
        assert resolve_multiplier(date(2026, 11, 3), time(18, 0), rules) == Decimal("1.30")  # thứ Ba 18h
        assert resolve_multiplier(date(2026, 11, 3), time(10, 0), rules) == Decimal("1.00")  # ngoài mọi quy tắc
        db.close()


class TestRejectWholeSetKeepsOldRules:
    OLD = ["Cũ 1", "Cũ 2"]

    def assert_rejected_and_old_intact(self, res):
        assert res.status_code == 422
        assert res.json()["error"]["code"] == "VALIDATION_ERROR"
        assert rule_names(FACILITY_A_ID) == self.OLD

    def test_mot_quy_tac_he_so_vuot_tran_thi_ca_bo_bi_tu_choi(self, client):
        set_rules(FACILITY_A_ID, self.OLD)
        bad = {**SATURDAY, "multiplier": 1.60}
        res = client.post(url(FACILITY_A_ID), json={"rules": [PEAK, bad]}, headers=auth_header(OWNER_A_ID))
        self.assert_rejected_and_old_intact(res)

    def test_he_so_duoi_san_bi_tu_choi(self, client):
        set_rules(FACILITY_A_ID, self.OLD)
        bad = {**PEAK, "multiplier": 1.10}
        res = client.post(url(FACILITY_A_ID), json={"rules": [bad, SATURDAY]}, headers=auth_header(OWNER_A_ID))
        self.assert_rejected_and_old_intact(res)

    @pytest.mark.parametrize("value", [1.19, 1.51])
    def test_he_so_sat_ngoai_hai_dau_mut_bi_tu_choi(self, client, value):
        set_rules(FACILITY_A_ID, self.OLD)
        bad = {**PEAK, "multiplier": value}
        res = client.post(url(FACILITY_A_ID), json={"rules": [SATURDAY, bad]}, headers=auth_header(OWNER_A_ID))
        self.assert_rejected_and_old_intact(res)

    @pytest.mark.parametrize("day", [0, 8])
    def test_day_of_week_ngoai_1_den_7_bi_tu_choi(self, client, day):
        set_rules(FACILITY_A_ID, self.OLD)
        bad = {**SATURDAY, "day_of_week": day}
        res = client.post(url(FACILITY_A_ID), json={"rules": [PEAK, bad]}, headers=auth_header(OWNER_A_ID))
        self.assert_rejected_and_old_intact(res)

    def test_peak_hour_thieu_gio_bi_tu_choi(self, client):
        set_rules(FACILITY_A_ID, self.OLD)
        bad = {"name": "Thiếu giờ", "rule_type": "PEAK_HOUR", "multiplier": 1.30}
        res = client.post(url(FACILITY_A_ID), json={"rules": [SATURDAY, bad]}, headers=auth_header(OWNER_A_ID))
        self.assert_rejected_and_old_intact(res)

    def test_weekend_co_start_time_bi_tu_choi(self, client):
        set_rules(FACILITY_A_ID, self.OLD)
        bad = {**SATURDAY, "start_time": "08:00:00", "end_time": "10:00:00"}
        res = client.post(url(FACILITY_A_ID), json={"rules": [PEAK, bad]}, headers=auth_header(OWNER_A_ID))
        self.assert_rejected_and_old_intact(res)

    def test_holiday_id_khong_ton_tai_bi_tu_choi(self, client):
        set_rules(FACILITY_A_ID, self.OLD)
        bad = {"name": "Lễ ma", "rule_type": "HOLIDAY", "multiplier": 1.50, "holiday_id": 9999}
        res = client.post(url(FACILITY_A_ID), json={"rules": [PEAK, bad]}, headers=auth_header(OWNER_A_ID))
        self.assert_rejected_and_old_intact(res)

    def test_thieu_truong_rules_bi_tu_choi(self, client):
        set_rules(FACILITY_A_ID, self.OLD)
        res = client.post(url(FACILITY_A_ID), json={}, headers=auth_header(OWNER_A_ID))
        self.assert_rejected_and_old_intact(res)

    def test_loi_giua_transaction_thi_rollback_bo_cu_con_nguyen(self, client, monkeypatch):
        set_rules(FACILITY_A_ID, self.OLD)

        def faulty_commit(self):
            raise RuntimeError("Mô phỏng lỗi DB khi commit giữa transaction!")

        monkeypatch.setattr(Session, "commit", faulty_commit)
        with pytest.raises(RuntimeError):
            client.post(url(FACILITY_A_ID), json={"rules": [PEAK, SATURDAY]}, headers=auth_header(OWNER_A_ID))
        monkeypatch.undo()

        assert rule_names(FACILITY_A_ID) == self.OLD


class TestPermissions:
    def test_chu_san_khac_bi_403_va_bo_cu_con_nguyen(self, client):
        set_rules(FACILITY_A_ID, ["Cũ 1"])
        res = client.post(url(FACILITY_A_ID), json={"rules": [PEAK]}, headers=auth_header(OWNER_B_ID))
        assert res.status_code == 403
        assert res.json()["error"]["code"] == "AUTH_FORBIDDEN"
        assert rule_names(FACILITY_A_ID) == ["Cũ 1"]

    def test_khach_hang_bi_403(self, client):
        set_rules(FACILITY_A_ID, ["Cũ 1"])
        res = client.post(url(FACILITY_A_ID), json={"rules": [PEAK]}, headers=auth_header(CUSTOMER_ID))
        assert res.status_code == 403
        assert res.json()["error"]["code"] == "AUTH_FORBIDDEN"
        assert rule_names(FACILITY_A_ID) == ["Cũ 1"]

    def test_khong_dang_nhap_bi_401(self, client):
        res = client.post(url(FACILITY_A_ID), json={"rules": [PEAK]})
        assert res.status_code == 401

    def test_co_so_khong_ton_tai_bi_404(self, client):
        res = client.post(url(9999), json={"rules": [PEAK]}, headers=auth_header(OWNER_A_ID))
        assert res.status_code == 404
        assert res.json()["error"]["code"] == "FACILITY_NOT_FOUND"


class TestGetRules:
    def test_tra_ve_bo_quy_tac_hien_tai_dung_dinh_dang(self, client):
        client.post(url(FACILITY_A_ID), json={"rules": [PEAK, SATURDAY]}, headers=auth_header(OWNER_A_ID))

        res = client.get(url(FACILITY_A_ID), headers=auth_header(OWNER_A_ID))

        assert res.status_code == 200
        data = res.json()["data"]
        assert data["facility_id"] == FACILITY_A_ID
        rules = data["rules"]
        assert [r["name"] for r in rules] == ["Giờ vàng", "Thứ Bảy"]
        assert rules[0] == {
            "id": rules[0]["id"], "name": "Giờ vàng", "rule_type": "PEAK_HOUR", "multiplier": 1.3,
            "start_time": "17:00:00", "end_time": "21:00:00", "day_of_week": None, "holiday_id": None,
        }
        assert rules[1]["day_of_week"] == 6 and rules[1]["start_time"] is None

    def test_co_so_chua_co_quy_tac_tra_danh_sach_rong(self, client):
        set_rules(FACILITY_A_ID, [])
        res = client.get(url(FACILITY_A_ID), headers=auth_header(OWNER_A_ID))
        assert res.status_code == 200
        assert res.json()["data"]["rules"] == []

    def test_chi_tra_quy_tac_cua_co_so_do(self, client):
        set_rules(FACILITY_A_ID, ["Của A"])
        set_rules(FACILITY_B_ID, ["Của B"])
        res = client.get(url(FACILITY_A_ID), headers=auth_header(OWNER_A_ID))
        assert [r["name"] for r in res.json()["data"]["rules"]] == ["Của A"]

    def test_chu_san_khac_bi_403(self, client):
        res = client.get(url(FACILITY_A_ID), headers=auth_header(OWNER_B_ID))
        assert res.status_code == 403
        assert res.json()["error"]["code"] == "AUTH_FORBIDDEN"

    def test_khach_hang_bi_403(self, client):
        res = client.get(url(FACILITY_A_ID), headers=auth_header(CUSTOMER_ID))
        assert res.status_code == 403

    def test_khong_dang_nhap_bi_401(self, client):
        assert client.get(url(FACILITY_A_ID)).status_code == 401

    def test_co_so_khong_ton_tai_bi_404(self, client):
        res = client.get(url(9999), headers=auth_header(OWNER_A_ID))
        assert res.status_code == 404
        assert res.json()["error"]["code"] == "FACILITY_NOT_FOUND"
