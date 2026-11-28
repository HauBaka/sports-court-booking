from datetime import datetime, time, timedelta, timezone

import pytest

from app.core.cancellation import CancellationRefund, calculate_cancellation_refund
from app.core.pricing import SlotPricingInput, calculate_booking_price


START_AT = datetime(2026, 11, 27, 18, 0)


@pytest.mark.parametrize(
    ("time_until_start", "expected"),
    [
        pytest.param(timedelta(hours=30), CancellationRefund(80, 31_200, 7_800), id="HUY-01"),
        pytest.param(timedelta(hours=18), CancellationRefund(50, 19_500, 19_500), id="HUY-02"),
        pytest.param(timedelta(hours=6), CancellationRefund(0, 0, 39_000), id="HUY-03"),
        pytest.param(timedelta(hours=24), CancellationRefund(80, 31_200, 7_800), id="HUY-04-24h"),
        pytest.param(timedelta(hours=12), CancellationRefund(50, 19_500, 19_500), id="HUY-04-12h"),
        pytest.param(timedelta(hours=24, seconds=-1), CancellationRefund(50, 19_500, 19_500), id="HUY-05-24h"),
        pytest.param(timedelta(hours=12, seconds=-1), CancellationRefund(0, 0, 39_000), id="HUY-05-12h"),
    ],
)
def test_refund_policy_thresholds(time_until_start, expected):
    result = calculate_cancellation_refund(39_000, START_AT, START_AT - time_until_start)

    assert result == expected
    assert result.refund + result.forfeit == 39_000


def test_refund_is_calculated_on_total_booking_deposit():
    # HUY-12: Tổng cọc 6.006đ cho hai slot. Hoàn từng slot sẽ làm mất 1đ do làm tròn.
    slots = [
        SlotPricingInput(time_slot_id=1, start_time=time(18), end_time=time(19), base_price=10_010),
        SlotPricingInput(time_slot_id=2, start_time=time(19), end_time=time(20), base_price=10_010),
    ]
    pricing = calculate_booking_price(START_AT.date(), slots, rules=[])

    result = calculate_cancellation_refund(
        pricing.deposit_amount_required, START_AT, START_AT - timedelta(hours=18)
    )

    assert result == CancellationRefund(50, 3_003, 3_003)


@pytest.mark.parametrize(("deposit", "refund", "forfeit"), [(12_345, 6_172, 6_173), (12_347, 6_173, 6_174)])
def test_refund_rounds_down_and_forfeit_keeps_the_remainder(deposit, refund, forfeit):
    # HUY-13: 50% của số cọc lẻ luôn có phần dư 0,5đ.
    result = calculate_cancellation_refund(deposit, START_AT, START_AT - timedelta(hours=18))

    assert result == CancellationRefund(50, refund, forfeit)


def test_naive_booking_start_is_vietnam_time_when_now_is_utc():
    start_at = datetime(2026, 11, 27, 0, 30)
    now = datetime(2026, 11, 25, 17, 30, tzinfo=timezone.utc)

    at_threshold = calculate_cancellation_refund(39_000, start_at, now)
    below_threshold = calculate_cancellation_refund(39_000, start_at, now + timedelta(seconds=1))

    assert at_threshold.refund_percentage == 80
    assert below_threshold.refund_percentage == 50
