-- S4__seed_e4.sql
-- Dữ liệu mẫu E4: đơn đủ trạng thái, hoàn cọc, kết toán, bài ghép đội
-- Chạy sau S3. CHỈ chạy ở máy cá nhân và DB test của CI, KHÔNG chạy lên DB server (có TRUNCATE).
-- S4 dựng lại các bảng đơn, khung giờ, giao dịch (gồm đơn 1 chép từ S3), nên sửa đơn 1 ở S3 thì sửa cả ở đây.
-- Chạy lại nhiều lần không bị trùng: TRUNCATE rồi nạp lại, user C và D dùng ON DUPLICATE KEY.
-- Không seed đơn ở mốc T-30h, T-18h, T-6h vì mốc trôi theo giờ. Test hủy tự tạo đơn qua API.
-- Mọi đơn: 2 slot x 100.000đ, hệ số 1.00, tổng 200.000đ, cọc 50% = 100.000đ.

SET FOREIGN_KEY_CHECKS = 0;
SET time_zone = '+00:00';

TRUNCATE TABLE team_post_applications;
TRUNCATE TABLE team_posts;
TRUNCATE TABLE wallet_transactions;
TRUNCATE TABLE booking_slots;
TRUNCATE TABLE bookings;

-- Hai khách mới C, D (mật khẩu TestPass123@, cùng hash với các tài khoản S2)
INSERT INTO users (id, name, email, phone, password_hash, is_active, is_system) VALUES
(7, 'Vũ Khách C',    'customer.c@scb.vn', '0900000007',
 '$2b$12$PZwNny64znxkTGU6a9A7KuikgVfJiJsB1Uiruv439Xc6P0IdeBOH6', true, false),
(8, 'Đặng Khách D',  'customer.d@scb.vn', '0900000008',
 '$2b$12$PZwNny64znxkTGU6a9A7KuikgVfJiJsB1Uiruv439Xc6P0IdeBOH6', true, false)
ON DUPLICATE KEY UPDATE id = id;

INSERT INTO user_roles (user_id, role_id) VALUES
(7, 1),
(8, 1)
ON DUPLICATE KEY UPDATE user_id = user_id;

INSERT INTO wallets (id, user_id, balance) VALUES
(7, 7, 0),
(8, 8, 0)
ON DUPLICATE KEY UPDATE id = id;

-- Đơn 1: chép từ S3. Đơn 2: ngày kia. Đơn 3: hôm qua, chờ kết toán.
-- Đơn 4: đã COMPLETED. Đơn 5: đã hủy, có hoàn cọc và mất cọc.
INSERT INTO bookings
    (id, booking_code, user_id, court_id, play_date, start_at, status,
     subtotal, service_total, total_amount, deposit_amount, deposit_percent,
     hold_expires_at, cancelled_at, cancel_reason)
VALUES
(1, CONCAT('SB', DATE_FORMAT(CURDATE(), '%y%m'), '-1'), 6, 1,
 CURDATE() + INTERVAL 1 DAY, TIMESTAMP(CURDATE() + INTERVAL 1 DAY, '08:00:00'),
 'DEPOSITED', 200000, 0, 200000, 100000, 50, NULL, NULL, NULL),
(2, CONCAT('SB', DATE_FORMAT(CURDATE(), '%y%m'), '-2'), 7, 2,
 CURDATE() + INTERVAL 2 DAY, TIMESTAMP(CURDATE() + INTERVAL 2 DAY, '10:00:00'),
 'DEPOSITED', 200000, 0, 200000, 100000, 50, NULL, NULL, NULL),
(3, CONCAT('SB', DATE_FORMAT(CURDATE(), '%y%m'), '-3'), 7, 2,
 CURDATE() - INTERVAL 1 DAY, TIMESTAMP(CURDATE() - INTERVAL 1 DAY, '10:00:00'),
 'DEPOSITED', 200000, 0, 200000, 100000, 50, NULL, NULL, NULL),
(4, CONCAT('SB', DATE_FORMAT(CURDATE(), '%y%m'), '-4'), 8, 2,
 CURDATE() - INTERVAL 3 DAY, TIMESTAMP(CURDATE() - INTERVAL 3 DAY, '10:00:00'),
 'COMPLETED', 200000, 0, 200000, 100000, 50, NULL, NULL, NULL),
(5, CONCAT('SB', DATE_FORMAT(CURDATE(), '%y%m'), '-5'), 8, 2,
 CURDATE() + INTERVAL 3 DAY, TIMESTAMP(CURDATE() + INTERVAL 3 DAY, '10:00:00'),
 'CANCELLED', 200000, 0, 200000, 100000, 50, NULL, NOW(), 'Khách đổi lịch');

-- Đơn 5 đã hủy nên khung giờ được nhả (released_at)
INSERT INTO booking_slots
    (booking_id, court_id, play_date, time_slot_id, base_price, final_price, multiplier, released_at) VALUES
(1, 1, CURDATE() + INTERVAL 1 DAY, 3, 100000, 100000, 1.00, NULL),
(1, 1, CURDATE() + INTERVAL 1 DAY, 4, 100000, 100000, 1.00, NULL),
(2, 2, CURDATE() + INTERVAL 2 DAY, 5, 100000, 100000, 1.00, NULL),
(2, 2, CURDATE() + INTERVAL 2 DAY, 6, 100000, 100000, 1.00, NULL),
(3, 2, CURDATE() - INTERVAL 1 DAY, 5, 100000, 100000, 1.00, NULL),
(3, 2, CURDATE() - INTERVAL 1 DAY, 6, 100000, 100000, 1.00, NULL),
(4, 2, CURDATE() - INTERVAL 3 DAY, 5, 100000, 100000, 1.00, NULL),
(4, 2, CURDATE() - INTERVAL 3 DAY, 6, 100000, 100000, 1.00, NULL),
(5, 2, CURDATE() + INTERVAL 3 DAY, 5, 100000, 100000, 1.00, NOW()),
(5, 2, CURDATE() + INTERVAL 3 DAY, 6, 100000, 100000, 1.00, NOW());

-- Sổ cái theo thứ tự thời gian. balance_after: DEPOSIT ghi số dư ví khách,
-- loại còn lại ghi số dư ví nhận. Ví: 1 hệ thống, 3 chủ sân 1, 5 A, 6 B, 7 C, 8 D.
-- QĐ5 đơn 5 (hủy từ 24h trở lên): refund 80.000 + forfeit 20.000 = cọc 100.000
INSERT INTO wallet_transactions
    (from_wallet_id, to_wallet_id, type, amount, balance_after, related_booking_id, created_by)
VALUES
(NULL, 5, 'TOPUP',   500000, 500000, NULL, 2),
(NULL, 6, 'TOPUP',   300000, 300000, NULL, 2),
(NULL, 7, 'TOPUP',   400000, 400000, NULL, 2),
(NULL, 8, 'TOPUP',   400000, 400000, NULL, 2),
(6,    1, 'DEPOSIT', 100000, 200000, 1,    NULL),  -- B còn 200.000
(7,    1, 'DEPOSIT', 100000, 300000, 2,    NULL),  -- C còn 300.000
(7,    1, 'DEPOSIT', 100000, 200000, 3,    NULL),  -- C còn 200.000
(8,    1, 'DEPOSIT', 100000, 300000, 4,    NULL),  -- D còn 300.000
(1,    3, 'SETTLE',  100000, 100000, 4,    NULL),  -- chủ sân 1 nhận, còn 100.000
(8,    1, 'DEPOSIT', 100000, 200000, 5,    NULL),  -- D còn 200.000
(1,    8, 'REFUND',   80000, 280000, 5,    NULL),  -- D nhận lại, còn 280.000
(1,    3, 'FORFEIT',  20000, 120000, 5,    NULL);  -- chủ sân 1 nhận thêm, còn 120.000

-- Số dư mỗi ví = tổng giao dịch của ví đó (VI-05), tính từ sổ cái
UPDATE wallets w SET balance =
    COALESCE((SELECT SUM(t.amount) FROM wallet_transactions t WHERE t.to_wallet_id = w.id), 0)
  - COALESCE((SELECT SUM(t.amount) FROM wallet_transactions t WHERE t.from_wallet_id = w.id), 0)
WHERE w.id > 0;  -- cố ý cập nhật mọi ví; WHERE chỉ để DataGrip không báo "UPDATE không có WHERE"

-- Bài ghép đội OPEN của C, gắn đơn ngày kia, có 1 đơn ứng tuyển PENDING của D
INSERT INTO team_posts (id, user_id, booking_id, title, players_needed, status) VALUES
(1, 7, 2, 'Tìm 2 bạn đánh đôi cầu lông', 2, 'OPEN');

INSERT INTO team_post_applications (id, post_id, user_id, message, status) VALUES
(1, 1, 8, 'Mình trình trung bình, xin vào đội', 'PENDING');

SET FOREIGN_KEY_CHECKS = 1;
