-- =============================================================
-- V2__add_missing_columns_and_tables.sql
-- Bổ sung cột và bảng còn thiếu theo UI mockup
-- Yêu cầu: Chạy SAU V1__create_all_tables.sql
-- =============================================================

SET sql_mode = 'STRICT_TRANS_TABLES,NO_ENGINE_SUBSTITUTION';
SET time_zone = '+00:00';

-- -------------------------------------------------------------
-- 1. users — ảnh đại diện
-- -------------------------------------------------------------
ALTER TABLE users
    ADD COLUMN avatar_url VARCHAR(512) AFTER is_system;

-- -------------------------------------------------------------
-- 2. facilities — thời lượng mỗi ca và mô tả
-- -------------------------------------------------------------
ALTER TABLE facilities
    ADD COLUMN slot_duration_minutes INT NOT NULL DEFAULT 60 AFTER description;

-- -------------------------------------------------------------
-- 3. Bảng mới: facility_photos (ảnh cụm sân)
-- -------------------------------------------------------------
CREATE TABLE facility_photos (
    id          BIGINT       NOT NULL AUTO_INCREMENT,
    facility_id BIGINT       NOT NULL,
    url         VARCHAR(512) NOT NULL,
    is_primary  BOOLEAN      NOT NULL DEFAULT false,
    sort_order  INT          NOT NULL DEFAULT 0,
    PRIMARY KEY (id),
    FOREIGN KEY fk_fp_facility (facility_id) REFERENCES facilities(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------
-- 4. Bảng mới: facility_schedules (giờ mở cửa theo từng ngày)
-- -------------------------------------------------------------
CREATE TABLE facility_schedules (
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

-- -------------------------------------------------------------
-- 5. court_slots — lý do khoá slot (bảo trì...)
-- -------------------------------------------------------------
ALTER TABLE court_slots
    ADD COLUMN lock_reason VARCHAR(255) AFTER is_active;

-- -------------------------------------------------------------
-- 6. bookings — mã đặt sân và thời điểm tạo
--    booking_code nullable vì các bản ghi cũ không có mã
-- -------------------------------------------------------------
ALTER TABLE bookings
    ADD COLUMN booking_code VARCHAR(20)  UNIQUE          AFTER id,
    ADD COLUMN created_at   DATETIME     NOT NULL
                            DEFAULT CURRENT_TIMESTAMP    AFTER cancel_reason;

-- -------------------------------------------------------------
-- 7. reviews — thời điểm đánh giá
-- -------------------------------------------------------------
ALTER TABLE reviews
    ADD COLUMN created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP AFTER comment;

-- -------------------------------------------------------------
-- 8. team_posts — thời điểm đăng bài
-- -------------------------------------------------------------
ALTER TABLE team_posts
    ADD COLUMN created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP AFTER status;