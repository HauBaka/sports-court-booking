-- =============================================================
-- V1_5__prod_catchup.sql
-- Bổ sung những thứ đã sửa thẳng V1 sau khi prod deploy lần đầu
-- Chỉ chạy trên DB đã có V1 CŨ (prod: s4a022df8_prod)
-- KHÔNG chạy trên DB drop/tạo lại từ V1 mới nhất
-- =============================================================

SET sql_mode = 'STRICT_TRANS_TABLES,NO_ENGINE_SUBSTITUTION';
SET time_zone = '+00:00';

-- -------------------------------------------------------------
-- 1. facilities — mô tả cụm sân
-- -------------------------------------------------------------
ALTER TABLE facilities
    ADD COLUMN description TEXT AFTER close_time;

-- -------------------------------------------------------------
-- 2. wallet_transactions — số dư sau giao dịch
--    DEFAULT 0 cho các bản ghi cũ; BE sẽ luôn ghi giá trị thật
-- -------------------------------------------------------------
ALTER TABLE wallet_transactions
    ADD COLUMN balance_after BIGINT NOT NULL DEFAULT 0 AFTER amount;

-- -------------------------------------------------------------
-- 3. Bảng mới: facility_amenities
-- -------------------------------------------------------------
CREATE TABLE facility_amenities (
    facility_id  BIGINT      NOT NULL,
    amenity_code VARCHAR(50) NOT NULL,
    PRIMARY KEY (facility_id, amenity_code),
    FOREIGN KEY fk_fa_facility (facility_id) REFERENCES facilities(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------
-- 4. Bảng mới: court_photos
-- -------------------------------------------------------------
CREATE TABLE court_photos (
    id         BIGINT       NOT NULL AUTO_INCREMENT,
    court_id   BIGINT       NOT NULL,
    url        VARCHAR(512) NOT NULL,
    is_primary BOOLEAN      NOT NULL DEFAULT false,
    sort_order INT          NOT NULL DEFAULT 0,
    PRIMARY KEY (id),
    FOREIGN KEY fk_cp_court (court_id) REFERENCES courts(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------
-- 5. Bảng mới: court_schedules
-- -------------------------------------------------------------
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

-- -------------------------------------------------------------
-- 6. Trigger: chặn UPDATE courts vượt giờ facility
-- -------------------------------------------------------------
DELIMITER //

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

-- 7. Trigger: chặn UPDATE facilities thu hẹp giờ khi sân con còn vượt
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

-- 8. Trigger: chặn INSERT court_schedules vượt giờ sân
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

-- 9. Trigger: chặn UPDATE court_schedules vượt giờ sân
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
