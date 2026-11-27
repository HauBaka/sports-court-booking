"""Giờ do CSDL tự sinh (DEFAULT CURRENT_TIMESTAMP, vd. bookings.created_at) phải là UTC.

API gắn hậu tố Z vào các mốc này, nên không được phụ thuộc múi giờ của server CSDL.
"""
from sqlalchemy import text

from app.core.database import engine


def test_phien_ket_noi_cua_backend_dung_utc():
    with engine.connect() as conn:
        assert conn.execute(text("SELECT @@session.time_zone")).scalar() == "+00:00"
        assert conn.execute(text("SELECT TIMESTAMPDIFF(MINUTE, UTC_TIMESTAMP(), CURRENT_TIMESTAMP())")).scalar() == 0
