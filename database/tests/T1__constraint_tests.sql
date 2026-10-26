-- 1. Kiểm tra dữ liệu seed đã nạp đúng
-- -------------------------------------------------------------
SELECT 'users'        AS bang, COUNT(*) AS so_ban_ghi FROM users
UNION ALL SELECT 'wallets',       COUNT(*) FROM wallets
UNION ALL SELECT 'facilities',    COUNT(*) FROM facilities
UNION ALL SELECT 'courts',        COUNT(*) FROM courts
UNION ALL SELECT 'time_slots',    COUNT(*) FROM time_slots
UNION ALL SELECT 'court_slots',   COUNT(*) FROM court_slots
UNION ALL SELECT 'pricing_rules', COUNT(*) FROM pricing_rules;
-- Kỳ vọng: 5, 5, 1, 3, 17, 49, 4

-- -------------------------------------------------------------
-- 2. CHECK wallets.balance >= 0
-- -------------------------------------------------------------
-- 2a. Cập nhật số dư âm → phải lỗi
UPDATE wallets SET balance = -1 WHERE id = 4;
-- Kỳ vọng: ERROR [3819] Check constraint 'chk_wallets_balance' is violated

-- 2b. Đặt lại về giá trị hợp lệ (nếu test 2a không lỗi — bảo vệ)
UPDATE wallets SET balance = 500000 WHERE id = 4;

-- -------------------------------------------------------------
-- 3. Chống đặt trùng khung giờ (QĐ3)
-- -------------------------------------------------------------
-- 3a. Booking hợp lệ
INSERT INTO bookings (id, booking_code, user_id, court_id, play_date, start_at, status,
    subtotal, service_total, total_amount, deposit_amount, deposit_percent)
VALUES (1, 'SB2712-0001', 4, 1, '2027-12-01', '2027-12-01 13:00:00', 'DEPOSITED',
    100000, 0, 100000, 30000, 30);
-- Kỳ vọng: OK

INSERT INTO booking_slots
    (booking_id, court_id, play_date, time_slot_id, base_price, final_price, multiplier)
VALUES (1, 1, '2027-12-01', 8, 100000, 100000, 1.00);
-- Kỳ vọng: OK

-- 3b. Đặt trùng slot (cùng sân + ngày + khung giờ, booking khác) → phải lỗi
INSERT INTO bookings (id, booking_code, user_id, court_id, play_date, start_at, status,
    subtotal, service_total, total_amount, deposit_amount, deposit_percent)
VALUES (2, 'SB2712-0002', 5, 1, '2027-12-01', '2027-12-01 13:00:00', 'DEPOSITED',
    100000, 0, 100000, 30000, 30);
-- Kỳ vọng: OK (booking chưa lỗi, lỗi xảy ra ở booking_slots)

INSERT INTO booking_slots
    (booking_id, court_id, play_date, time_slot_id, base_price, final_price, multiplier)
VALUES (2, 1, '2027-12-01', 8, 100000, 100000, 1.00);
-- Kỳ vọng: ERROR [1062] Duplicate entry for key 'uq_no_double_booking'

-- -------------------------------------------------------------
-- 4. Trigger chặn chuyển trạng thái không hợp lệ (QĐ7)
-- -------------------------------------------------------------
-- 4a. DEPOSITED → COMPLETED: hợp lệ
UPDATE bookings SET status = 'COMPLETED' WHERE id = 1;
-- Kỳ vọng: OK

-- 4b. COMPLETED → DEPOSITED: không hợp lệ → phải lỗi
UPDATE bookings SET status = 'DEPOSITED' WHERE id = 1;
-- Kỳ vọng: ERROR [45000] Chuyển trạng thái booking không hợp lệ

-- -------------------------------------------------------------
-- 5. Trigger chặn giờ sân con vượt giờ cụm sân (trg_courts_check_times_insert)
-- -------------------------------------------------------------
-- 5a. Tạo sân với giờ hợp lệ (nằm trong 06:00–23:00 của facility 1) → OK
INSERT INTO courts (id, facility_id, sport_id, name, environment, open_time, close_time)
VALUES (99, 1, 1, 'Sân test hợp lệ', 'INDOOR', '08:00:00', '20:00:00');
-- Kỳ vọng: OK

-- 5b. Tạo sân vượt giờ facility (close_time > 23:00) → phải lỗi
INSERT INTO courts (id, facility_id, sport_id, name, environment, open_time, close_time)
VALUES (100, 1, 1, 'Sân test vượt giờ', 'INDOOR', '06:00:00', '23:30:00');
-- Kỳ vọng: ERROR [45000] Giờ sân con phải nằm trong giờ mở cửa của cụm sân

-- Dọn dẹp
DELETE FROM court_slots WHERE court_id = 99;
DELETE FROM courts WHERE id = 99;

-- -------------------------------------------------------------
-- 6. CHECK chk_bsvc_total_calc (total_price = quantity * unit_price)
-- -------------------------------------------------------------
-- Cần booking hợp lệ và service tồn tại (dùng booking id=1 đã tạo ở test 3)
-- Trước tiên thêm service mẫu
INSERT INTO services (id, facility_id, name, unit_price, unit) VALUES (1, 1, 'Thuê vợt', 20000, 'cái');

-- 6a. total_price đúng công thức → OK
INSERT INTO booking_services (booking_id, service_id, quantity, unit_price, total_price)
VALUES (1, 1, 3, 20000, 60000);
-- Kỳ vọng: OK

-- 6b. total_price sai công thức (3 * 20000 = 60000, nhưng ghi 99999) → phải lỗi
INSERT INTO booking_services (booking_id, service_id, quantity, unit_price, total_price)
VALUES (1, 1, 3, 20000, 99999);
-- Kỳ vọng: ERROR [3819] Check constraint 'chk_bsvc_total_calc' is violated
