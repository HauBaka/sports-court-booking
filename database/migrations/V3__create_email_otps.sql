SET sql_mode = 'STRICT_TRANS_TABLES,NO_ENGINE_SUBSTITUTION';
SET time_zone = '+00:00';

CREATE TABLE IF NOT EXISTS email_otps (
    id          BIGINT       NOT NULL AUTO_INCREMENT,
    email       VARCHAR(255) NOT NULL,
    purpose     ENUM('REGISTER', 'RESET_PASSWORD') NOT NULL,
    code_hash   VARCHAR(255) NOT NULL,
    expires_at  DATETIME     NOT NULL,
    attempts    INT          NOT NULL DEFAULT 0,
    consumed_at DATETIME     NULL,
    created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    CONSTRAINT chk_email_otps_attempts CHECK (attempts >= 0),
    INDEX idx_email_otps_email_purpose (email, purpose)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
