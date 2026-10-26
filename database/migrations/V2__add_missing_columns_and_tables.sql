-- =============================================================
-- V2__add_missing_columns_and_tables.sql
-- Chạy được trên cả test (sau V1 mới) và prod (sau V1 cũ)
-- IF NOT EXISTS → no-op nếu cột/bảng đã tồn tại
-- =============================================================

SET sql_mode = 'STRICT_TRANS_TABLES,NO_ENGINE_SUBSTITUTION';
SET time_zone = '+00:00';

-- =============================================================
-- PHẦN A: Bổ sung những thứ còn thiếu trên prod
--         (đã có sẵn trong V1 mới → no-op trên test)
-- =============================================================

-- A1. facilities — mô tả cụm sân
ALTER TABLE facilities
    ADD COLUMN IF NOT EXISTS description TEXT AFTER close_time;

-- A2. wallet_transactions — số dư sau giao dịch
--     DEFAULT 0 cho các bản ghi cũ trên prod; BE luôn ghi giá trị thật
ALTER TABLE wallet_transactions
    ADD COLUMN IF NOT EXISTS balance_after BIGINT NOT NULL DEFAULT 0 AFTER amount;

-- A3. facility_amenities
CREATE TABLE IF NOT EXISTS facility_amenities (
    facility_id  BIGINT      NOT NULL,
    amenity_code VARCHAR(50) NOT NULL,
    PRIMARY KEY (facility_id, amenity_code),
    FOREIGN KEY fk_fa_facility (facility_id) REFERENCES facilities(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- A4. court_photos
CREATE TABLE IF NOT EXISTS court_photos (
    id         BIGINT       NOT NULL AUTO_INCREMENT,
    court_id   BIGINT       NOT NULL,
    url        VARCHAR(512) NOT NULL,
    is_primary BOOLEAN      NOT NULL DEFAULT false,
    sort_order INT          NOT NULL DEFAULT 0,
    PRIMARY KEY (id),
    FOREIGN KEY fk_cp_court (court_id) REFERENCES courts(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- A5. court_schedules
CREATE TABLE IF NOT EXISTS court_schedules (
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

-- A6. Triggers 7–11
--     DROP IF EXISTS trước để tránh lỗi khi chạy lại
--     (DataGrip không hiểu CREATE OR REPLACE TRIGGER)
DROP TRIGGER IF EXISTS trg_courts_check_times_insert;
DROP TRIGGER IF EXISTS trg_courts_check_times_update;
DROP TRIGGER IF EXISTS trg_facilities_check_courts_update;
DROP TRIGGER IF EXISTS trg_court_schedules_check_insert;
DROP TRIGGER IF EXISTS trg_court_schedules_check_update;

DELIMITER //

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

-- =============================================================
-- PHẦN B: Thêm mới theo UI mockup
--         (cả test lẫn prod đều chưa có)
-- =============================================================

-- B1. users — ảnh đại diện
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS avatar_url VARCHAR(512) AFTER is_system;

-- B2. facilities — thời lượng mỗi ca đặt sân
ALTER TABLE facilities
    ADD COLUMN IF NOT EXISTS slot_duration_minutes INT NOT NULL DEFAULT 60 AFTER description;

-- B3. facility_photos (ảnh cụm sân)
CREATE TABLE IF NOT EXISTS facility_photos (
    id          BIGINT       NOT NULL AUTO_INCREMENT,
    facility_id BIGINT       NOT NULL,
    url         VARCHAR(512) NOT NULL,
    is_primary  BOOLEAN      NOT NULL DEFAULT false,
    sort_order  INT          NOT NULL DEFAULT 0,
    PRIMARY KEY (id),
    FOREIGN KEY fk_fp_facility (facility_id) REFERENCES facilities(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- B4. facility_schedules (giờ mở cửa theo từng ngày trong tuần)
CREATE TABLE IF NOT EXISTS facility_schedules (
    facility_id  BIGINT  NOT NULL,
    day_of_week  TINYINT NOT NULL,
    open_time    TIME    NOT NULL,
    close_time   TIME    NOT NULL,
    is_active    BOOLEAN NOT NULL DEFAULT true,
    PRIMARY KEY (facility_id, day_of_week),
    CONSTRAINT chk_fsch_dow   CHECK (day_of_week BETWEEN 1 AND 7),
    CONSTRAINT chk_fsch_times CHECK (open_time < close_time),
    FOREIGN KEY fk_fsch_facility (facility_id) REFERENCES facilities(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- B5. court_slots — lý do khoá slot (bảo trì...)
ALTER TABLE court_slots
    ADD COLUMN IF NOT EXISTS lock_reason VARCHAR(255) AFTER is_active;

-- B6. bookings — mã đặt sân và thời điểm tạo
--     booking_code nullable vì các bản ghi cũ trên prod không có mã
ALTER TABLE bookings
    ADD COLUMN IF NOT EXISTS booking_code VARCHAR(20) UNIQUE      AFTER id,
    ADD COLUMN IF NOT EXISTS created_at   DATETIME   NOT NULL
                             DEFAULT CURRENT_TIMESTAMP            AFTER cancel_reason;

-- B7. reviews — thời điểm đánh giá
ALTER TABLE reviews
    ADD COLUMN IF NOT EXISTS created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP AFTER comment;

-- B8. team_posts — thời điểm đăng bài
ALTER TABLE team_posts
    ADD COLUMN IF NOT EXISTS created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP AFTER status;
