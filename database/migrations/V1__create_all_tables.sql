
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
    description TEXT,
    is_active   BOOLEAN       NOT NULL DEFAULT true,
    PRIMARY KEY (id),
    CONSTRAINT chk_facilities_times CHECK (open_time < close_time),
    FOREIGN KEY fk_facility_owner (owner_id) REFERENCES users(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE facility_amenities (
    facility_id  BIGINT      NOT NULL,
    amenity_code VARCHAR(50) NOT NULL,
    PRIMARY KEY (facility_id, amenity_code),
    FOREIGN KEY fk_fa_facility (facility_id) REFERENCES facilities(id) ON DELETE RESTRICT
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

CREATE TABLE court_photos (
    id         BIGINT       NOT NULL AUTO_INCREMENT,
    court_id   BIGINT       NOT NULL,
    url        VARCHAR(512) NOT NULL,
    is_primary BOOLEAN      NOT NULL DEFAULT false,
    sort_order INT          NOT NULL DEFAULT 0,
    PRIMARY KEY (id),
    FOREIGN KEY fk_cp_court (court_id) REFERENCES courts(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE court_schedules (
    court_id    BIGINT  NOT NULL,
    day_of_week TINYINT NOT NULL,
    open_time   TIME    NOT NULL,
    close_time  TIME    NOT NULL,
    is_active   BOOLEAN NOT NULL DEFAULT true,
    PRIMARY KEY (court_id, day_of_week),
    CONSTRAINT chk_csch_dow   CHECK (day_of_week BETWEEN 1 AND 7),
    CONSTRAINT chk_csch_times CHECK (open_time < close_time),
    FOREIGN KEY fk_csch_court (court_id) REFERENCES courts(id) ON DELETE RESTRICT
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
    INDEX idx_bookings_expire (status, hold_expires_at),
    CONSTRAINT chk_bookings_subtotal    CHECK (subtotal >= 0),
    CONSTRAINT chk_bookings_svc_total   CHECK (service_total >= 0),
    CONSTRAINT chk_bookings_total_amt   CHECK (total_amount >= 0),
    CONSTRAINT chk_bookings_deposit_amt CHECK (deposit_amount >= 0),
    CONSTRAINT chk_bookings_play_date   CHECK (DATE(start_at) = play_date),
    CONSTRAINT chk_bookings_cancelled  CHECK ((status = 'CANCELLED') = (cancelled_at IS NOT NULL)),
    CONSTRAINT chk_bookings_total      CHECK (total_amount = subtotal + service_total),
    CONSTRAINT chk_bookings_deposit    CHECK (deposit_amount = total_amount * deposit_percent DIV 100),
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
    balance_after      BIGINT   NOT NULL,
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
    CONSTRAINT chk_bsvc_qty         CHECK (quantity >= 1),
    CONSTRAINT chk_bsvc_unit_price  CHECK (unit_price >= 0),
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
    UNIQUE KEY uq_tpa_post_user (post_id, user_id),
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
    IF NOT (
        OLD.status = NEW.status
        OR (OLD.status = 'PENDING_DEPOSIT' AND NEW.status IN ('DEPOSITED', 'CANCELLED'))
        OR (OLD.status = 'DEPOSITED'       AND NEW.status IN ('COMPLETED', 'CANCELLED'))
    ) THEN
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

-- Trigger 6: Tự động tạo court_slots khi tạo sân mới
CREATE TRIGGER trg_courts_after_insert
AFTER INSERT ON courts
FOR EACH ROW
BEGIN
    INSERT INTO court_slots (court_id, time_slot_id, base_price, is_active)
    SELECT NEW.id, id, 0, true
    FROM time_slots
    WHERE start_time >= NEW.open_time
      AND end_time   <= NEW.close_time;
END//

-- Trigger 7: Chặn giờ sân con vượt giờ cụm sân (INSERT)
CREATE TRIGGER trg_courts_check_times_insert
BEFORE INSERT ON courts
FOR EACH ROW
BEGIN
    DECLARE f_open  TIME;
    DECLARE f_close TIME;
    SELECT open_time, close_time INTO f_open, f_close
    FROM facilities WHERE id = NEW.facility_id;
    IF NEW.open_time < f_open OR NEW.close_time > f_close THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Giờ sân con phải nằm trong giờ mở cửa của cụm sân';
    END IF;
END//

-- Trigger 8: Chặn giờ sân con vượt giờ cụm sân (UPDATE)
CREATE TRIGGER trg_courts_check_times_update
BEFORE UPDATE ON courts
FOR EACH ROW
BEGIN
    DECLARE f_open  TIME;
    DECLARE f_close TIME;
    SELECT open_time, close_time INTO f_open, f_close
    FROM facilities WHERE id = NEW.facility_id;
    IF NEW.open_time < f_open OR NEW.close_time > f_close THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Giờ sân con phải nằm trong giờ mở cửa của cụm sân';
    END IF;
END//

-- Trigger 9: Chặn thu hẹp giờ cụm sân khi sân con còn vượt giờ mới
CREATE TRIGGER trg_facilities_check_courts_update
BEFORE UPDATE ON facilities
FOR EACH ROW
BEGIN
    IF EXISTS (
        SELECT 1 FROM courts
        WHERE facility_id = NEW.id
          AND (open_time < NEW.open_time OR close_time > NEW.close_time)
    ) THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Giờ cụm sân không được thu hẹp khi còn sân con vượt giờ';
    END IF;
END//

-- Trigger 10: Chặn giờ lịch ngày vượt giờ sân con (INSERT)
CREATE TRIGGER trg_court_schedules_check_insert
BEFORE INSERT ON court_schedules
FOR EACH ROW
BEGIN
    DECLARE c_open  TIME;
    DECLARE c_close TIME;
    SELECT open_time, close_time INTO c_open, c_close
    FROM courts WHERE id = NEW.court_id;
    IF NEW.open_time < c_open OR NEW.close_time > c_close THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Giờ lịch ngày phải nằm trong giờ mở cửa của sân';
    END IF;
END//

-- Trigger 11: Chặn giờ lịch ngày vượt giờ sân con (UPDATE)
CREATE TRIGGER trg_court_schedules_check_update
BEFORE UPDATE ON court_schedules
FOR EACH ROW
BEGIN
    DECLARE c_open  TIME;
    DECLARE c_close TIME;
    SELECT open_time, close_time INTO c_open, c_close
    FROM courts WHERE id = NEW.court_id;
    IF NEW.open_time < c_open OR NEW.close_time > c_close THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Giờ lịch ngày phải nằm trong giờ mở cửa của sân';
    END IF;
END//

DELIMITER ;
