-- S3__seed_e3.sql
-- Dữ liệu mẫu E3: OTP đăng ký / quên mk
-- Mã OTP mẫu cho mọi dòng: 123456 (bcrypt rounds = 12)
-- chạy lại được: chỉ TRUNCATE email_otps, không đụng bảng của S1/S2
SET FOREIGN_KEY_CHECKS = 0;
SET time_zone = '+00:00';
TRUNCATE TABLE email_otps;
TRUNCATE TABLE wallet_transactions;
TRUNCATE TABLE booking_slots;
TRUNCATE TABLE bookings;
INSERT INTO email_otps(email, purpose, code_hash, expires_at, attempts, consumed_at) values
-- còn hạn, chưa dùng
('newuser@scb.vn', 'REGISTER', '$2b$12$COnbRlcG9kJHkL4cgjSXR.eq7rCGI0YeQ/8Z7ny2QjjR0o8rpK.w', NOW() + INTERVAL 5 MINUTE, 0, NULL),
-- đã hết hạn
('late@scb.vn', 'REGISTER', '$2b$12$COnbRlcG9kJHkL4cgjSXR.eq7rCGI0YeQ/8Z7ny2QjjR0o8rpK.w', NOW() - INTERVAL 1 MINUTE, 0, NULL),
-- sai 5 lần, bị khóa
('locked@scb.vn', 'REGISTER', '$2b$12$COnbRlcG9kJHkL4cgjSXR.eq7rCGI0YeQ/8Z7ny2QjjR0o8rpK.w', NOW() + INTERVAL 5 MINUTE, 5, NULL),
-- đã dùng xong
('done@scb.vn', 'REGISTER', '$2b$12$COnbRlcG9kJHkL4cgjSXR.eq7rCGI0YeQ/8Z7ny2QjjR0o8rpK.w', NOW() + INTERVAL 5 MINUTE, 0, NOW()),
-- quên mk của tk có thật trong S2
('customer.a@scb.vn', 'RESET_PASSWORD', '$2b$12$COnbRlcG9kJHkL4cgjSXR.eq7rCGI0YeQ/8Z7ny2QjjR0o8rpK.w', NOW() + INTERVAL 5 MINUTE, 0, NULL);

-- Đơn DEPOSITED ngày mai của khách B, sân cầu lông 1, 08:00–10:00
-- multiplier cố định 1.00 để tiền không đổi theo thứ trong tuần
INSERT INTO bookings
    (id, booking_code, user_id, court_id, play_date, start_at, status,
     subtotal, service_total, total_amount, deposit_amount, deposit_percent, hold_expires_at)
VALUES
(1, CONCAT('SB', DATE_FORMAT(CURDATE(), '%y%m'), '-1'), 6, 1,
 CURDATE() + INTERVAL 1 DAY,
 TIMESTAMP(CURDATE() + INTERVAL 1 DAY, '08:00:00'),
 'DEPOSITED', 200000, 0, 200000, 100000, 50, NULL);

INSERT INTO booking_slots
    (booking_id, court_id, play_date, time_slot_id, base_price, final_price, multiplier)
VALUES
(1, 1, CURDATE() + INTERVAL 1 DAY, 3, 100000, 100000, 1.00),
(1, 1, CURDATE() + INTERVAL 1 DAY, 4, 100000, 100000, 1.00);

INSERT INTO wallet_transactions
    (from_wallet_id, to_wallet_id, type, amount, balance_after, related_booking_id, created_by)
VALUES
(NULL, 5, 'TOPUP',   500000, 500000, NULL, 2),   -- nạp cho khách A
(NULL, 6, 'TOPUP',   300000, 300000, NULL, 2),   -- nạp cho khách B
(6,    1, 'DEPOSIT', 100000, 200000, 1,    NULL); -- B cọc đơn 1, balance_after là số dư ví B

UPDATE wallets SET balance = 100000 WHERE id = 1;  -- ví hệ thống
UPDATE wallets SET balance = 500000 WHERE id = 5;  -- khách A
UPDATE wallets SET balance = 200000 WHERE id = 6;  -- khách B

SET FOREIGN_KEY_CHECKS = 1;

