from dataclasses import dataclass
from datetime import datetime, timedelta

from app.core.booking_time import booking_time_to_utc


@dataclass(frozen=True)
class CancellationRefund:
    refund_percentage: int
    refund: int
    forfeit: int


def calculate_cancellation_refund(
    deposit: int, start_at: datetime, now: datetime
) -> CancellationRefund:
    """Tính hoàn cọc QĐ5 trên tổng tiền cọc đã thu của một đơn (VNĐ).

    Bên gọi kiểm tra điều kiện hủy và truyền thời điểm đánh giá qua now.
    """
    time_until_start = booking_time_to_utc(start_at) - booking_time_to_utc(now)
    if time_until_start >= timedelta(hours=24):
        refund_percentage = 80
    elif time_until_start >= timedelta(hours=12):
        refund_percentage = 50
    else:
        refund_percentage = 0

    refund = deposit * refund_percentage // 100
    return CancellationRefund(
        refund_percentage=refund_percentage,
        refund=refund,
        forfeit=deposit - refund,
    )
