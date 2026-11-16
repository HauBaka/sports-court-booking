-- =============================================================
-- V4__add_unique_constraint_email_otps.sql
-- Mỗi (email, purpose) đúng một dòng OTP, mã mới ghi đè mã cũ (khớp backend/app/core/otp.py).
-- Thay index thường của V3 bằng UNIQUE KEY.
-- =============================================================

SET sql_mode = 'STRICT_TRANS_TABLES,NO_ENGINE_SUBSTITUTION';

ALTER TABLE email_otps
    DROP INDEX idx_email_otps_email_purpose,
    ADD UNIQUE KEY uq_email_otps_email_purpose (email, purpose);
