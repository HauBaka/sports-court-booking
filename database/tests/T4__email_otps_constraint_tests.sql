-- Hợp lệ: attempts mặc định 0, consumed_at mặc định NULL
insert into email_otps(email, purpose, code_hash, expires_at)
values ('test@scb.vn', 'REGISTER', 'hash', now() + interval 5 minute);
select attempts, consumed_at from email_otps where email = 'test@scb.vn';
-- Kỳ vọng: attempts = 0, consumed_at = NULL

-- purpose sai
insert into email_otps(email, purpose, code_hash, expires_at)
values ('test@scb.vn', 'LOGIN', 'hash', now() + interval 5 minute);
-- Kỳ vọng: error [1265] Data truncated for column 'purpose'

-- attempts âm
insert into email_otps(email, purpose, code_hash, expires_at, attempts)
values ('test@scb.vn', 'REGISTER', 'hash', now() + interval 5 minute, -1);
-- Kỳ vọng: error [4025] CONSTRAINT `chk_email_otps_attempts` failed

-- attempts = 0 vẫn hợp lệ (kiểm tra biên của >= 0)
insert into email_otps(email, purpose, code_hash, expires_at, attempts)
values ('test@scb.vn', 'RESET_PASSWORD', 'hash', now() + interval 5 minute, 0);
-- Kỳ vọng: ok
