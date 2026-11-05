from datetime import date, time
from decimal import Decimal

import pytest
from pydantic import ValidationError

from app.core.pricing import PricingRuleIn, RuleType, resolve_multiplier


def peak(multiplier="1.30", start=time(17, 0), end=time(21, 0)):
    return PricingRuleIn(
        name="Giờ vàng",
        rule_type=RuleType.PEAK_HOUR,
        multiplier=Decimal(multiplier),
        start_time=start,
        end_time=end,
    )


def weekend(day=6, multiplier="1.40"):
    return PricingRuleIn(
        name="Cuối tuần",
        rule_type=RuleType.WEEKEND,
        multiplier=Decimal(multiplier),
        day_of_week=day,
    )


def holiday(holiday_id=1, multiplier="1.50"):
    return PricingRuleIn(
        name="Ngày lễ",
        rule_type=RuleType.HOLIDAY,
        multiplier=Decimal(multiplier),
        holiday_id=holiday_id,
    )


SATURDAY = date(2026, 11, 7)  # isoweekday() == 6
TUESDAY = date(2026, 11, 3)   # isoweekday() == 2
RULES = [peak(), weekend()]


class TestMultiplierRange:
    def test_1_10_bi_tu_choi(self):
        with pytest.raises(ValidationError):
            peak("1.10")

    def test_1_60_bi_tu_choi(self):
        with pytest.raises(ValidationError):
            peak("1.60")

    @pytest.mark.parametrize("value", ["1.20", "1.30", "1.50"])
    def test_trong_khoang_va_hai_dau_mut_hop_le(self, value):
        assert peak(value).multiplier == Decimal(value)


class TestRuleShape:
    def test_peak_hour_thieu_start_time(self):
        with pytest.raises(ValidationError):
            PricingRuleIn(name="x", rule_type=RuleType.PEAK_HOUR, multiplier=Decimal("1.30"), end_time=time(21, 0))

    def test_peak_hour_thieu_end_time(self):
        with pytest.raises(ValidationError):
            PricingRuleIn(name="x", rule_type=RuleType.PEAK_HOUR, multiplier=Decimal("1.30"), start_time=time(17, 0))

    def test_peak_hour_start_khong_truoc_end(self):
        with pytest.raises(ValidationError):
            peak(start=time(21, 0), end=time(17, 0))
        with pytest.raises(ValidationError):
            peak(start=time(17, 0), end=time(17, 0))

    def test_peak_hour_co_day_of_week_bi_tu_choi(self):
        with pytest.raises(ValidationError):
            PricingRuleIn(name="x", rule_type=RuleType.PEAK_HOUR, multiplier=Decimal("1.30"),
                          start_time=time(17, 0), end_time=time(21, 0), day_of_week=6)

    def test_weekend_thieu_day_of_week(self):
        with pytest.raises(ValidationError):
            PricingRuleIn(name="x", rule_type=RuleType.WEEKEND, multiplier=Decimal("1.40"))

    def test_weekend_co_gio_bi_tu_choi(self):
        with pytest.raises(ValidationError):
            PricingRuleIn(name="x", rule_type=RuleType.WEEKEND, multiplier=Decimal("1.40"),
                          day_of_week=6, start_time=time(8, 0), end_time=time(10, 0))

    @pytest.mark.parametrize("day", [0, 8])
    def test_day_of_week_ngoai_1_den_7_bi_tu_choi(self, day):
        with pytest.raises(ValidationError):
            weekend(day=day)

    def test_holiday_thieu_holiday_id(self):
        with pytest.raises(ValidationError):
            PricingRuleIn(name="x", rule_type=RuleType.HOLIDAY, multiplier=Decimal("1.50"))

    def test_holiday_co_day_of_week_bi_tu_choi(self):
        with pytest.raises(ValidationError):
            PricingRuleIn(name="x", rule_type=RuleType.HOLIDAY, multiplier=Decimal("1.50"),
                          holiday_id=1, day_of_week=6)


class TestResolveMultiplier:
    def test_thu_bay_18h_khop_ca_hai_tra_he_so_lon_nhat(self):
        assert resolve_multiplier(SATURDAY, time(18, 0), RULES) == Decimal("1.40")

    def test_thu_bay_18h_gia_100k_thanh_140k(self):
        multiplier = resolve_multiplier(SATURDAY, time(18, 0), RULES)
        assert round(100_000 * multiplier) == 140_000

    def test_thu_ba_18h_chi_khop_gio_vang(self):
        assert resolve_multiplier(TUESDAY, time(18, 0), RULES) == Decimal("1.30")

    def test_thu_ba_18h_gia_100k_thanh_130k(self):
        multiplier = resolve_multiplier(TUESDAY, time(18, 0), RULES)
        assert round(100_000 * multiplier) == 130_000

    def test_khong_quy_tac_nao_khop_tra_1_00(self):
        assert resolve_multiplier(TUESDAY, time(6, 0), RULES) == Decimal("1.00")

    def test_bo_quy_tac_rong_tra_1_00(self):
        assert resolve_multiplier(SATURDAY, time(18, 0), []) == Decimal("1.00")

    def test_thu_bay_ngoai_gio_vang_chi_khop_cuoi_tuan(self):
        assert resolve_multiplier(SATURDAY, time(9, 0), RULES) == Decimal("1.40")

    def test_gio_bat_dau_thuoc_khung_gio_ket_thuc_thi_khong(self):
        assert resolve_multiplier(TUESDAY, time(17, 0), [peak()]) == Decimal("1.30")
        assert resolve_multiplier(TUESDAY, time(21, 0), [peak()]) == Decimal("1.00")

    def test_ngay_le_chi_khop_khi_holiday_id_co_trong_tap_ngay_le_hom_do(self):
        rules = [peak(), holiday(holiday_id=1)]
        assert resolve_multiplier(TUESDAY, time(18, 0), rules, holiday_ids={1}) == Decimal("1.50")
        assert resolve_multiplier(TUESDAY, time(18, 0), rules, holiday_ids={2}) == Decimal("1.30")
        assert resolve_multiplier(TUESDAY, time(18, 0), rules) == Decimal("1.30")

    def test_chu_nhat_khop_day_of_week_7(self):
        sunday = date(2026, 11, 8)
        assert resolve_multiplier(sunday, time(9, 0), [weekend(day=7, multiplier="1.35")]) == Decimal("1.35")


# Bộ quy tắc giống hệt seed S1 của cơ sở 1: cao điểm 17-21h 1,30; thứ Bảy 1,40; Chủ nhật 1,40; Tết (holiday_id 1) 1,50
SEED_RULES = [peak(), weekend(day=6), weekend(day=7), holiday(holiday_id=1)]
BASE_PRICE = 100_000  # giá cơ sở của sân 1 trong seed (đồng/giờ)
SUNDAY = date(2026, 11, 8)


def slot_price(play_date, play_time, holiday_ids=None):
    return round(BASE_PRICE * resolve_multiplier(play_date, play_time, SEED_RULES, holiday_ids))


class TestKichBanSeed:
    """SAN-01..03 trong docs/test-scenarios.md mục 5, tính trên đúng bộ quy tắc seed S1."""

    def test_san_01_gio_cao_diem_ngay_thuong(self):
        assert resolve_multiplier(TUESDAY, time(18, 0), SEED_RULES, holiday_ids=set()) == Decimal("1.30")
        assert slot_price(TUESDAY, time(18, 0), holiday_ids=set()) == 130_000

    def test_san_02_nhieu_quy_tac_cung_khop_lay_lon_nhat_khong_cong_don(self):
        multiplier = resolve_multiplier(SATURDAY, time(18, 0), SEED_RULES, holiday_ids=set())
        assert multiplier == Decimal("1.40")  # khớp cả cao điểm 1,30 lẫn cuối tuần 1,40
        assert slot_price(SATURDAY, time(18, 0), holiday_ids=set()) == 140_000  # không phải 1,30 x 1,40 = 182.000

    def test_san_03_ngoai_moi_quy_tac(self):
        assert resolve_multiplier(TUESDAY, time(10, 0), SEED_RULES, holiday_ids=set()) == Decimal("1.00")
        assert slot_price(TUESDAY, time(10, 0), holiday_ids=set()) == 100_000

    def test_chu_nhat_theo_seed_cung_la_1_40(self):
        assert slot_price(SUNDAY, time(10, 0), holiday_ids=set()) == 140_000

    def test_ngay_le_tet_1_50_thang_gio_cao_diem_va_cuoi_tuan(self):
        assert slot_price(TUESDAY, time(10, 0), holiday_ids={1}) == 150_000
        assert slot_price(SATURDAY, time(18, 0), holiday_ids={1}) == 150_000  # 1,50 lớn hơn 1,40 và 1,30
