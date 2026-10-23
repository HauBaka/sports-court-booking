-- =============================================================
-- S1__sample_data.sql
-- Sports Court Booking — Dữ liệu mẫu
-- Target: s179529_test
-- Yêu cầu: Chạy SAU V1__create_all_tables.sql
-- Mật khẩu tất cả tài khoản: TestPass123@
-- =============================================================

SET FOREIGN_KEY_CHECKS = 0;

-- Xóa dữ liệu cũ trước khi seed (TRUNCATE không kích hoạt trigger DELETE)
TRUNCATE TABLE wallet_transactions;
TRUNCATE TABLE booking_services;
TRUNCATE TABLE booking_slots;
TRUNCATE TABLE bookings;
TRUNCATE TABLE team_post_applications;
TRUNCATE TABLE team_posts;
TRUNCATE TABLE reviews;
TRUNCATE TABLE court_slots;
TRUNCATE TABLE pricing_rules;
TRUNCATE TABLE holidays;
TRUNCATE TABLE courts;
TRUNCATE TABLE facilities;
TRUNCATE TABLE services;
TRUNCATE TABLE wallets;
TRUNCATE TABLE user_roles;
TRUNCATE TABLE users;
TRUNCATE TABLE time_slots;
TRUNCATE TABLE sports;
TRUNCATE TABLE roles;

-- =============================================================
-- 1. Vai trò hệ thống
-- =============================================================

INSERT INTO roles (id, name, description) VALUES
(1, 'CUSTOMER', 'Khách hàng đặt sân'),
(2, 'OWNER',    'Chủ cơ sở thể thao'),
(3, 'ADMIN',    'Quản trị viên hệ thống');

-- =============================================================
-- 2. Môn thể thao
-- =============================================================

INSERT INTO sports (id, name, icon_url) VALUES
(1, 'Cầu lông',     NULL),
(2, 'Pickleball',   NULL),
(3, 'Bóng đá mini', NULL);

-- =============================================================
-- 3. Tài khoản người dùng
-- Mật khẩu: TestPass123@ → bcrypt hash (rounds=12)
-- =============================================================

-- 3a. Tài khoản hệ thống (ví giữ cọc trung gian — is_system = true)
INSERT INTO users (id, name, email, phone, password_hash, is_active, is_system) VALUES
(1, 'System Wallet', 'system@internal.scb', '0000000000',
 '$2b$12$PZwNny64znxkTGU6a9A7KuikgVfJiJsB1Uiruv439Xc6P0IdeBOH6',
 true, true);

-- 3b. Admin
INSERT INTO users (id, name, email, phone, password_hash, is_active, is_system) VALUES
(2, 'Nguyễn Quản Trị', 'admin@scb.vn', '0900000001',
 '$2b$12$PZwNny64znxkTGU6a9A7KuikgVfJiJsB1Uiruv439Xc6P0IdeBOH6',
 true, false);

-- 3c. Chủ sân
INSERT INTO users (id, name, email, phone, password_hash, is_active, is_system) VALUES
(3, 'Trần Văn Chủ', 'owner@scb.vn', '0900000002',
 '$2b$12$PZwNny64znxkTGU6a9A7KuikgVfJiJsB1Uiruv439Xc6P0IdeBOH6',
 true, false);

-- 3d. Khách hàng
INSERT INTO users (id, name, email, phone, password_hash, is_active, is_system) VALUES
(4, 'Lê Khách Hàng A', 'customer.a@scb.vn', '0900000003',
 '$2b$12$PZwNny64znxkTGU6a9A7KuikgVfJiJsB1Uiruv439Xc6P0IdeBOH6',
 true, false),
(5, 'Phạm Khách Hàng B', 'customer.b@scb.vn', '0900000004',
 '$2b$12$PZwNny64znxkTGU6a9A7KuikgVfJiJsB1Uiruv439Xc6P0IdeBOH6',
 true, false);

-- =============================================================
-- 4. Phân quyền
-- =============================================================

INSERT INTO user_roles (user_id, role_id) VALUES
(2, 3),  -- admin    → ADMIN
(3, 2),  -- owner    → OWNER
(4, 1),  -- khách A  → CUSTOMER
(5, 1);  -- khách B  → CUSTOMER

-- =============================================================
-- 5. Ví tiền (mỗi user đúng 1 ví)
-- =============================================================

INSERT INTO wallets (id, user_id, balance) VALUES
(1, 1, 0),       -- ví hệ thống
(2, 2, 0),       -- ví admin
(3, 3, 0),       -- ví chủ sân (ban đầu 0)
(4, 4, 500000),  -- ví khách A: 500.000 VNĐ
(5, 5, 200000);  -- ví khách B: 200.000 VNĐ

-- Ghi nhật ký TOPUP cho khách A và B (admin thực hiện)
INSERT INTO wallet_transactions
    (from_wallet_id, to_wallet_id, type, amount, related_booking_id, created_by) VALUES
(NULL, 4, 'TOPUP', 500000, NULL, 2),
(NULL, 5, 'TOPUP', 200000, NULL, 2);

-- =============================================================
-- 6. Cụm sân (facility)
-- =============================================================

INSERT INTO facilities
    (id, owner_id, name, address, city, district, latitude, longitude, open_time, close_time, is_active)
VALUES
(1, 3,
 'Cơ Sở Cầu Lông & Pickleball Kỳ Hòa',
 '238 Ba Tháng Hai, Phường 12, Quận 10, TP.HCM',
 'TP.HCM', 'Quận 10', 10.7719210, 106.6710420,
 '06:00:00', '23:00:00', true);

-- =============================================================
-- 7. Sân con (courts)
-- =============================================================

INSERT INTO courts
    (id, facility_id, sport_id, name, court_type, environment, open_time, close_time, is_active)
VALUES
(1, 1, 1, 'Sân Cầu Lông 1 (Thảm Yonex)', 'STANDARD', 'INDOOR', '06:00:00', '23:00:00', true),
(2, 1, 1, 'Sân Cầu Lông 2 (Thảm Yonex)', 'STANDARD', 'INDOOR', '06:00:00', '23:00:00', true),
(3, 1, 2, 'Sân Pickleball 1',             'STANDARD', 'INDOOR', '07:00:00', '22:00:00', true);

-- =============================================================
-- 8. Khung giờ cố định (1h/slot, 06:00–23:00 = 17 slot)
-- =============================================================

INSERT INTO time_slots (id, start_time, end_time, duration_minutes, label) VALUES
( 1, '06:00:00', '07:00:00', 60, '06:00 - 07:00'),
( 2, '07:00:00', '08:00:00', 60, '07:00 - 08:00'),
( 3, '08:00:00', '09:00:00', 60, '08:00 - 09:00'),
( 4, '09:00:00', '10:00:00', 60, '09:00 - 10:00'),
( 5, '10:00:00', '11:00:00', 60, '10:00 - 11:00'),
( 6, '11:00:00', '12:00:00', 60, '11:00 - 12:00'),
( 7, '12:00:00', '13:00:00', 60, '12:00 - 13:00'),
( 8, '13:00:00', '14:00:00', 60, '13:00 - 14:00'),
( 9, '14:00:00', '15:00:00', 60, '14:00 - 15:00'),
(10, '15:00:00', '16:00:00', 60, '15:00 - 16:00'),
(11, '16:00:00', '17:00:00', 60, '16:00 - 17:00'),
(12, '17:00:00', '18:00:00', 60, '17:00 - 18:00'),
(13, '18:00:00', '19:00:00', 60, '18:00 - 19:00'),
(14, '19:00:00', '20:00:00', 60, '19:00 - 20:00'),
(15, '20:00:00', '21:00:00', 60, '20:00 - 21:00'),
(16, '21:00:00', '22:00:00', 60, '21:00 - 22:00'),
(17, '22:00:00', '23:00:00', 60, '22:00 - 23:00');

-- =============================================================
-- 9. Court slots — nối sân với khung giờ, gán giá cơ sở
-- =============================================================

-- Sân cầu lông 1 & 2: tất cả 17 slot, 100.000 VNĐ/h
INSERT INTO court_slots (court_id, time_slot_id, base_price, is_active)
SELECT 1, id, 100000, true FROM time_slots;

INSERT INTO court_slots (court_id, time_slot_id, base_price, is_active)
SELECT 2, id, 100000, true FROM time_slots;

-- Sân pickleball: slot 07:00–22:00 (id 2–16), 120.000 VNĐ/h
INSERT INTO court_slots (court_id, time_slot_id, base_price, is_active)
SELECT 3, id, 120000, true FROM time_slots WHERE id BETWEEN 2 AND 16;

-- =============================================================
-- 10. Bảng giá theo thời điểm (QĐ1)
-- =============================================================

INSERT INTO pricing_rules
    (name, rule_type, multiplier, applies_to_facility_id, start_time, end_time, day_of_week, holiday_id)
VALUES
('Giờ vàng chiều tối (17h–21h)',  'PEAK_HOUR', 1.30, 1, '17:00:00', '21:00:00', NULL, NULL),
('Cuối tuần — Thứ Bảy',           'WEEKEND',   1.40, 1, NULL,        NULL,       6,    NULL),
('Cuối tuần — Chủ Nhật',          'WEEKEND',   1.40, 1, NULL,        NULL,       7,    NULL),
('Ngày lễ Tết Dương Lịch',        'HOLIDAY',   1.50, 1, NULL,        NULL,       NULL, 1);

-- =============================================================
-- 11. Ngày lễ mẫu
-- =============================================================

INSERT INTO holidays (name, holiday_date, recurring_yearly) VALUES
('Tết Dương Lịch',      '2027-01-01', true),
('Giỗ Tổ Hùng Vương',   '2027-04-06', true),
('Ngày Giải Phóng',     '2027-04-30', true),
('Quốc Tế Lao Động',    '2027-05-01', true),
('Quốc Khánh',          '2027-09-02', true);

SET FOREIGN_KEY_CHECKS = 1;



