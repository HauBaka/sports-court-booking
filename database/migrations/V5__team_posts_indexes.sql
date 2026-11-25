SET sql_mode = 'STRICT_TRANS_TABLES,NO_ENGINE_SUBSTITUTION';

ALTER TABLE team_post_applications
    ADD COLUMN IF NOT EXISTS created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP AFTER message;

ALTER TABLE team_posts
    ADD INDEX IF NOT EXISTS idx_team_posts_status_created (status, created_at);
    