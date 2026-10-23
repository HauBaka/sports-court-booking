-- =============================================================
-- V1__create_all_tables.sql
-- Sports Court Booking — Migration đầu tiên
-- Target: s4a022df8_prod
-- Yêu cầu: MySQL 8.0.16+, InnoDB, STRICT_TRANS_TABLES
-- =============================================================

SET FOREIGN_KEY_CHECKS = 0;
SET sql_mode = 'STRICT_TRANS_TABLES,NO_ENGINE_SUBSTITUTION';

-- =============================================================
-- NHÓM 1: Vai trò & Môn thể thao (không phụ thuộc bảng nào)
-- =============================================================

CREATE TABLE roles (
    id          INT          NOT NULL AUTO_INCREMENT,
    name        VARCHAR(50)  NOT NULL,
    description VARCHAR(255),
    PRIMARY KEY (id),
    UNIQUE KEY uq_roles_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE sports (
    id       INT          NOT NULL AUTO_INCREMENT,
    name     VARCHAR(100) NOT NULL,
    icon_url VARCHAR(512),
    PRIMARY KEY (id),
    UNIQUE KEY uq_sports_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================
-- NHÓM 2: Người dùng
-- =============================================================

CREATE TABLE users (
    id            BIGINT       NOT NULL AUTO_INCREMENT,
    name          VARCHAR(255) NOT NULL,
    email         VARCHAR(255) NOT NULL,
    phone         VARCHAR(20)  NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    is_active     BOOLEAN      NOT NULL DEFAULT true,
    is_system     BOOLEAN      NOT NULL DEFAULT false,
    -- Cột sinh để ép "đúng 1 bản ghi is_system = true" (UNIQUE cho phép nhiều NULL)
    system_key    TINYINT GENERATED ALWAYS AS (IF(is_system, 1, NULL)) STORED,
    PRIMARY KEY (id),
    UNIQUE KEY uq_users_email (email),
    UNIQUE KEY uq_users_phone (phone),
    UNIQUE KEY uq_one_system_user (system_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE user_roles (
    user_id    BIGINT   NOT NULL,
    role_id    INT      NOT NULL,
    granted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, role_id),
    FOREIGN KEY fk_ur_user (user_id) REFERENCES users(id) ON DELETE RESTRICT,
    FOREIGN KEY fk_ur_role (role_id) REFERENCES roles(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================
-- NHÓM 3: Ví tiền (phụ thuộc users)
-- =============================================================

CREATE TABLE wallets (
    id      BIGINT NOT NULL AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    balance BIGINT NOT NULL DEFAULT 0,
    PRIMARY KEY (id),
    UNIQUE KEY uq_wallets_user (user_id),
    CONSTRAINT chk_wallets_balance CHECK (balance >= 0),
    FOREIGN KEY fk_wallet_user (user_id) REFERENCES users(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================
-- NHÓM 4: Cơ sở & Sân (phụ thuộc users, sports)
-- =============================================================

CREATE TABLE facilities (
    id         BIGINT        NOT NULL AUTO_INCREMENT,
    owner_id   BIGINT        NOT NULL,
    name       VARCHAR(255)  NOT NULL,
    address    VARCHAR(500)  NOT NULL,
    city       VARCHAR(100)  NOT NULL,
    district   VARCHAR(100),
    latitude   DECIMAL(10,7),
    longitude  DECIMAL(10,7),
    open_time  TIME          NOT NULL,
    close_time TIME          NOT NULL,
    is_active  BOOLEAN       NOT NULL DEFAULT true,
    PRIMARY KEY (id),
    FOREIGN KEY fk_facility_owner (owner_id) REFERENCES users(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE courts (
    id          BIGINT       NOT NULL AUTO_INCREMENT,
    facility_id BIGINT       NOT NULL,
    sport_id    INT          NOT NULL,
    name        VARCHAR(255) NOT NULL,
    court_type  VARCHAR(50),
    environment ENUM('INDOOR', 'OUTDOOR') NOT NULL,
    open_time   TIME         NOT NULL,
    close_time  TIME         NOT NULL,
    is_active   BOOLEAN      NOT NULL DEFAULT true,
    PRIMARY KEY (id),
    CONSTRAINT chk_courts_times CHECK (open_time < close_time),
    FOREIGN KEY fk_court_facility (facility_id) REFERENCES facilities(id) ON DELETE RESTRICT,
    FOREIGN KEY fk_court_sport (sport_id) REFERENCES sports(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================
-- NHÓM 5: Khung giờ & Bảng giá
-- =============================================================

CREATE TABLE time_slots (
    id               INT         NOT NULL AUTO_INCREMENT,
    start_time       TIME        NOT NULL,
    end_time         TIME        NOT NULL,
    duration_minutes INT         NOT NULL,
    label            VARCHAR(50),
    PRIMARY KEY (id),
    UNIQUE KEY uq_time_slots_start (start_time),
    CONSTRAINT chk_time_slots_order CHECK (end_time > start_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE court_slots (
    id           BIGINT  NOT NULL AUTO_INCREMENT,
    court_id     BIGINT  NOT NULL,
    time_slot_id INT     NOT NULL,
    base_price   BIGINT  NOT NULL,
    is_active    BOOLEAN NOT NULL DEFAULT true,
    PRIMARY KEY (id),
    UNIQUE KEY uq_court_slots (court_id, time_slot_id),
    CONSTRAINT chk_court_slots_price CHECK (base_price >= 0),
    FOREIGN KEY fk_cs_court (court_id) REFERENCES courts(id) ON DELETE RESTRICT,
    FOREIGN KEY fk_cs_timeslot (time_slot_id) REFERENCES time_slots(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE holidays (
    id               INT          NOT NULL AUTO_INCREMENT,
    name             VARCHAR(255) NOT NULL,
    holiday_date     DATE         NOT NULL,
    recurring_yearly BOOLEAN      NOT NULL DEFAULT false,
    PRIMARY KEY (id),
    UNIQUE KEY uq_holidays_date (holiday_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE pricing_rules (
    id                     INT          NOT NULL AUTO_INCREMENT,
    name                   VARCHAR(255) NOT NULL,
    rule_type              ENUM('PEAK_HOUR', 'WEEKEND', 'HOLIDAY') NOT NULL,
    multiplier             DECIMAL(4,2) NOT NULL,
    applies_to_facility_id BIGINT,
    start_time             TIME,
    end_time               TIME,
    day_of_week            TINYINT,
    holiday_id             INT,
    PRIMARY KEY (id),
    CONSTRAINT chk_pricing_multiplier CHECK (multiplier BETWEEN 1.20 AND 1.50),
    CONSTRAINT chk_pricing_rule_shape CHECK (
        (rule_type = 'PEAK_HOUR'
            AND start_time IS NOT NULL AND end_time IS NOT NULL AND start_time < end_time
            AND day_of_week IS NULL AND holiday_id IS NULL)
        OR
        (rule_type = 'WEEKEND'
            AND day_of_week BETWEEN 1 AND 7
            AND start_time IS NULL AND end_time IS NULL AND holiday_id IS NULL)
        OR
        (rule_type = 'HOLIDAY'
            AND holiday_id IS NOT NULL
            AND start_time IS NULL AND end_time IS NULL AND day_of_week IS NULL)
    ),
    FOREIGN KEY fk_pr_facility (applies_to_facility_id) REFERENCES facilities(id) ON DELETE RESTRICT,
    FOREIGN KEY fk_pr_holiday (holiday_id) REFERENCES holidays(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================
-- NHÓM 6: Lịch đặt sân
-- =============================================================

CREATE TABLE bookings (
    id              BIGINT   NOT NULL AUTO_INCREMENT,
    user_id         BIGINT   NOT NULL,
    court_id        BIGINT   NOT NULL,
    play_date       DATE     NOT NULL,
    start_at        DATETIME NOT NULL,
    status          ENUM('PENDING_DEPOSIT', 'DEPOSITED', 'COMPLETED', 'CANCELLED')
                             NOT NULL DEFAULT 'PENDING_DEPOSIT',
    subtotal        BIGINT   NOT NULL DEFAULT 0,
    service_total   BIGINT   NOT NULL DEFAULT 0,
    total_amount    BIGINT   NOT NULL,
    deposit_amount  BIGINT   NOT NULL,
    deposit_percent TINYINT  NOT NULL,
    hold_expires_at DATETIME,
    cancelled_at    DATETIME,
    cancel_reason   TEXT,
    PRIMARY KEY (id),
    -- Unique ghép để booking_slots có thể tham chiếu FK (id, court_id, play_date)
    UNIQUE KEY uq_bookings_id_court_date (id, court_id, play_date),
    CONSTRAINT chk_bookings_subtotal    CHECK (subtotal >= 0),
    CONSTRAINT chk_bookings_svc_total   CHECK (service_total >= 0),
    CONSTRAINT chk_bookings_total_amt   CHECK (total_amount >= 0),
    CONSTRAINT chk_bookings_deposit_amt CHECK (deposit_amount >= 0),
    CONSTRAINT chk_bookings_play_date   CHECK (DATE(start_at) = play_date),
    CONSTRAINT chk_bookings_cancelled   CHECK ((status = 'CANCELLED') = (cancelled_at IS NOT NULL)),
    CONSTRAINT chk_bookings_total       CHECK (total_amount = subtotal + service_total),
    CONSTRAINT chk_bookings_deposit     CHECK (deposit_amount = total_amount * deposit_percent DIV 100),
    CONSTRAINT chk_bookings_deposit_pct CHECK (deposit_percent BETWEEN 1 AND 100),
    FOREIGN KEY fk_booking_user (user_id) REFERENCES users(id) ON DELETE RESTRICT,
    FOREIGN KEY fk_booking_court (court_id) REFERENCES courts(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE booking_slots (
    id           BIGINT       NOT NULL AUTO_INCREMENT,
    booking_id   BIGINT       NOT NULL,
    court_id     BIGINT       NOT NULL,
    play_date    DATE         NOT NULL,
    time_slot_id INT          NOT NULL,
    base_price   BIGINT       NOT NULL,
    final_price  BIGINT       NOT NULL,
    multiplier   DECIMAL(4,2) NOT NULL DEFAULT 1.00,
    released_at  DATETIME,
    -- Cột sinh: NULL khi đã nhả, 1 khi còn active → UNIQUE cho phép nhiều NULL
    active_key   TINYINT GENERATED ALWAYS AS (IF(released_at IS NULL, 1, NULL)) STORED,
    PRIMARY KEY (id),
    -- Chống đặt trùng khung giờ (QĐ3)
    UNIQUE KEY uq_no_double_booking (court_id, play_date, time_slot_id, active_key),
    CONSTRAINT chk_bs_base_price  CHECK (base_price >= 0),
    CONSTRAINT chk_bs_final_amt   CHECK (final_price >= 0),
    CONSTRAINT chk_bs_multiplier  CHECK (multiplier BETWEEN 1.00 AND 1.50),
    CONSTRAINT chk_bs_final_price CHECK (final_price = ROUND(base_price * multiplier, 0)),
    -- FK ghép chống lệch sân/ngày so với booking cha
    FOREIGN KEY fk_bs_booking (booking_id, court_id, play_date)
        REFERENCES bookings(id, court_id, play_date) ON DELETE RESTRICT,
    -- FK ghép chặn đặt ngoài giờ mở cửa
    FOREIGN KEY fk_bs_court_slot (court_id, time_slot_id)
        REFERENCES court_slots(court_id, time_slot_id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================
-- NHÓM 7: Sổ cái giao dịch ví
-- =============================================================

CREATE TABLE wallet_transactions (
    id                 BIGINT   NOT NULL AUTO_INCREMENT,
    from_wallet_id     BIGINT,
    to_wallet_id       BIGINT   NOT NULL,
    type               ENUM('TOPUP', 'DEPOSIT', 'REFUND', 'FORFEIT', 'SETTLE') NOT NULL,
    amount             BIGINT   NOT NULL,
    related_booking_id BIGINT,
    created_by         BIGINT,
    created_at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    -- Chống hoàn cọc hai lần (TOPUP không bị ảnh hưởng vì related_booking_id = NULL)
    UNIQUE KEY uq_one_tx_per_booking_type (related_booking_id, type),
    CONSTRAINT chk_wt_amount    CHECK (amount > 0),
    CONSTRAINT chk_wt_not_self  CHECK (from_wallet_id <> to_wallet_id),
    CONSTRAINT chk_wt_shape CHECK (
        (type = 'TOPUP'
            AND from_wallet_id IS NULL
            AND created_by IS NOT NULL
            AND related_booking_id IS NULL)
        OR
        (type <> 'TOPUP'
            AND from_wallet_id IS NOT NULL
            AND created_by IS NULL
            AND related_booking_id IS NOT NULL)
    ),
    FOREIGN KEY fk_wt_from    (from_wallet_id)     REFERENCES wallets(id) ON DELETE RESTRICT,
    FOREIGN KEY fk_wt_to      (to_wallet_id)        REFERENCES wallets(id) ON DELETE RESTRICT,
    FOREIGN KEY fk_wt_booking (related_booking_id)  REFERENCES bookings(id) ON DELETE RESTRICT,
    FOREIGN KEY fk_wt_admin   (created_by)          REFERENCES users(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================
-- NHÓM 8: Phác thảo — Dịch vụ, Đánh giá, Ghép đội (CN 4, 5)
-- =============================================================

CREATE TABLE services (
    id          INT          NOT NULL AUTO_INCREMENT,
    facility_id BIGINT       NOT NULL,
    name        VARCHAR(255) NOT NULL,
    unit_price  BIGINT       NOT NULL DEFAULT 0,
    unit        VARCHAR(50),
    is_active   BOOLEAN      NOT NULL DEFAULT true,
    PRIMARY KEY (id),
    CONSTRAINT chk_services_price CHECK (unit_price >= 0),
    FOREIGN KEY fk_svc_facility (facility_id) REFERENCES facilities(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE booking_services (
    id          BIGINT NOT NULL AUTO_INCREMENT,
    booking_id  BIGINT NOT NULL,
    service_id  INT    NOT NULL,
    quantity    INT    NOT NULL,
    unit_price  BIGINT NOT NULL,
    total_price BIGINT NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT chk_bsvc_qty        CHECK (quantity >= 1),
    CONSTRAINT chk_bsvc_unit_price CHECK (unit_price >= 0),
    CONSTRAINT chk_bsvc_total_price CHECK (total_price >= 0),
    CONSTRAINT chk_bsvc_total_calc  CHECK (total_price = quantity * unit_price),
    FOREIGN KEY fk_bsvc_booking (booking_id) REFERENCES bookings(id) ON DELETE RESTRICT,
    FOREIGN KEY fk_bsvc_service (service_id) REFERENCES services(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE reviews (
    id         BIGINT  NOT NULL AUTO_INCREMENT,
    booking_id BIGINT  NOT NULL,
    rating     TINYINT NOT NULL,
    comment    TEXT,
    PRIMARY KEY (id),
    UNIQUE KEY uq_reviews_booking (booking_id),
    CONSTRAINT chk_reviews_rating CHECK (rating BETWEEN 1 AND 5),
    FOREIGN KEY fk_review_booking (booking_id) REFERENCES bookings(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE team_posts (
    id             BIGINT       NOT NULL AUTO_INCREMENT,
    user_id        BIGINT       NOT NULL,
    booking_id     BIGINT       NOT NULL,
    title          VARCHAR(500) NOT NULL,
    players_needed INT          NOT NULL,
    status         ENUM('OPEN', 'CLOSED', 'CANCELLED') NOT NULL DEFAULT 'OPEN',
    PRIMARY KEY (id),
    CONSTRAINT chk_tp_players CHECK (players_needed >= 1),
    FOREIGN KEY fk_tp_user    (user_id)    REFERENCES users(id) ON DELETE RESTRICT,
    FOREIGN KEY fk_tp_booking (booking_id) REFERENCES bookings(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE team_post_applications (
    id      BIGINT NOT NULL AUTO_INCREMENT,
    post_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    status  ENUM('PENDING', 'ACCEPTED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
    message TEXT,
    PRIMARY KEY (id),
    FOREIGN KEY fk_tpa_post (post_id) REFERENCES team_posts(id) ON DELETE RESTRICT,
    FOREIGN KEY fk_tpa_user (user_id) REFERENCES users(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================
-- TRIGGERS (ORM không tự sinh, phải viết SQL thô)
-- =============================================================

DELIMITER //

-- Trigger 1: Chặn chuyển trạng thái bookings không hợp lệ (QĐ7)
--   Cho phép: PENDING_DEPOSIT → DEPOSITED | CANCELLED
--             DEPOSITED       → COMPLETED | CANCELLED
CREATE TRIGGER trg_bookings_status_check
BEFORE UPDATE ON bookings
FOR EACH ROW
BEGIN
    IF OLD.status = NEW.status THEN
        -- Không đổi trạng thái: bỏ qua
        SET @_dummy = 0;
    ELSEIF OLD.status = 'PENDING_DEPOSIT' AND NEW.status IN ('DEPOSITED', 'CANCELLED') THEN
        SET @_dummy = 0;
    ELSEIF OLD.status = 'DEPOSITED' AND NEW.status IN ('COMPLETED', 'CANCELLED') THEN
        SET @_dummy = 0;
    ELSE
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Chuyển trạng thái booking không hợp lệ';
    END IF;
END//

-- Trigger 2–4: Chặn xóa cứng lịch đặt, slot và giao dịch ví
CREATE TRIGGER trg_bookings_no_delete
BEFORE DELETE ON bookings
FOR EACH ROW
BEGIN
    SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Không được phép xóa lịch đặt';
END//

CREATE TRIGGER trg_booking_slots_no_delete
BEFORE DELETE ON booking_slots
FOR EACH ROW
BEGIN
    SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Không được phép xóa slot đặt sân';
END//

CREATE TRIGGER trg_wallet_transactions_no_delete
BEFORE DELETE ON wallet_transactions
FOR EACH ROW
BEGIN
    SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Không được phép xóa giao dịch ví';
END//

-- Trigger 5: Chặn UPDATE giao dịch ví (fallback khi không có quyền GRANT)
CREATE TRIGGER trg_wallet_transactions_no_update
BEFORE UPDATE ON wallet_transactions
FOR EACH ROW
BEGIN
    SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Không được phép sửa giao dịch ví';
END//

DELIMITER ;

SET FOREIGN_KEY_CHECKS = 1;

/*
SHOW TABLES;

-- Tạo data tối thiểu để test
INSERT INTO users (id, name, email, phone, password_hash)
VALUES (1, 'Test', 'test@test.com', '0900000001', 'hash');
INSERT INTO wallets (id, user_id, balance) VALUES (1, 1, 100000);

-- Thử set âm → phải lỗi
UPDATE wallets SET balance = -1 WHERE id = 1;

-- Chuẩn bị data tối thiểu
INSERT INTO sports (id, name) VALUES (1, 'Cầu lông');
INSERT INTO users (id, name, email, phone, password_hash, is_system)
VALUES (2, 'Owner', 'owner@test.com', '0900000002', 'hash', false);
INSERT INTO facilities (id, owner_id, name, address, city, open_time, close_time)
VALUES (1, 2, 'Sân Test', '123 Test', 'HCM', '06:00:00', '23:00:00');
INSERT INTO courts (id, facility_id, sport_id, name, environment, open_time, close_time)
VALUES (1, 1, 1, 'Sân 1', 'INDOOR', '06:00:00', '23:00:00');
INSERT INTO time_slots (id, start_time, end_time, duration_minutes)
VALUES (8, '13:00:00', '14:00:00', 60);
INSERT INTO court_slots (court_id, time_slot_id, base_price)
VALUES (1, 8, 100000);

-- Booking 1 hợp lệ
INSERT INTO bookings (id, user_id, court_id, play_date, start_at, status,
    subtotal, service_total, total_amount, deposit_amount, deposit_percent)
VALUES (1, 1, 1, '2027-12-01', '2027-12-01 13:00:00', 'DEPOSITED',
    100000, 0, 100000, 30000, 30);
INSERT INTO booking_slots (booking_id, court_id, play_date, time_slot_id, base_price, final_price, multiplier)
VALUES (1, 1, '2027-12-01', 8, 100000, 100000, 1.00);

-- Booking 2 trùng slot → phải lỗi
INSERT INTO bookings (id, user_id, court_id, play_date, start_at, status,
    subtotal, service_total, total_amount, deposit_amount, deposit_percent)
VALUES (2, 1, 1, '2027-12-01', '2027-12-01 13:00:00', 'DEPOSITED',
    100000, 0, 100000, 30000, 30);
INSERT INTO booking_slots (booking_id, court_id, play_date, time_slot_id, base_price, final_price, multiplier)
VALUES (2, 1, '2027-12-01', 8, 100000, 100000, 1.00);


UPDATE bookings SET status = 'COMPLETED' WHERE id = 1; -- OK
UPDATE bookings SET status = 'DEPOSITED' WHERE id = 1; -- phải lỗi
*/