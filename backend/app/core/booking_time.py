from datetime import datetime, timedelta, timezone

VN_TZ = timezone(timedelta(hours=7))


def booking_time_to_utc(value: datetime) -> datetime:
    """Đọc DATETIME không có múi giờ của booking theo giờ Việt Nam."""
    if value.utcoffset() is None:
        value = value.replace(tzinfo=VN_TZ)
    return value.astimezone(timezone.utc)
