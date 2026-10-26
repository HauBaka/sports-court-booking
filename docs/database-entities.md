# Thiết kế Cơ sở dữ liệu và Ràng buộc

## PHẦN 1: DANH SÁCH THỰC THỂ VÀ QUAN HỆ

### 1.1 Danh sách thực thể

| # | Thực thể (bảng) | Mô tả | CN | QĐ | Mức độ |
|---|---|---|---|---|---|
| 1 | `users` | Người dùng (khách, chủ sân, Admin). Tài khoản `is_system` làm ví giữ cọc. | 1, 2, 3 | – | Chính thức |
| 2 | `roles` & `user_roles` | Vai trò: CUSTOMER, OWNER, ADMIN. Chủ sân có thêm OWNER. | 1, 2, 3 | – | Chính thức |
| 3 | `wallets` | Ví điện tử nội bộ. | 3 | QĐ6 | Chính thức |
| 4 | `wallet_transactions` | Sổ cái giao dịch ví (TOPUP, DEPOSIT, REFUND, FORFEIT, SETTLE). | 3 | QĐ4, 5, 6 | Chính thức |
| 5 | `sports` | Môn thể thao (Cầu lông, Pickleball, Bóng đá mini). | 1, 2 | – | Chính thức |
| 6 | `facilities` | Cụm sân (Tên, địa chỉ, chủ sân, mô tả, thời lượng ca). | 1 | – | Chính thức |
| 6a | `facility_photos` | Ảnh giới thiệu cụm sân (ảnh chính + ảnh phụ). | 1 | – | Chính thức |
| 6b | `facility_amenities` | Tiện ích của cụm sân (mã code: PARKING, WATER…). | 1 | – | Chính thức |
| 6c | `facility_schedules` | Giờ mở cửa của cụm sân theo từng ngày trong tuần. | 1 | – | Chính thức |
| 7 | `courts` | Sân con (Số người, trong nhà/ngoài trời, giờ mở/đóng cửa). | 1, 2 | – | Chính thức |
| 8 | `time_slots` | Danh mục khung giờ cố định. | 1, 2 | QĐ3 | Chính thức |
| 9 | `court_slots` | Khung giờ hoạt động của sân con kèm giá cơ sở. | 1, 2 | QĐ1 | Chính thức |
| 10 | `holidays` | Ngày lễ. | 1 | QĐ1 | Chính thức |
| 11 | `pricing_rules` | Quy tắc tăng giá (Giờ cao điểm, cuối tuần, ngày lễ). | 1 | QĐ1 | Chính thức |
| 12 | `bookings` | Lịch đặt tổng (tiền, tỉ lệ cọc, trạng thái, các mốc thời gian). | 2, 3 | QĐ2, 4, 5, 7 | Chính thức |
| 13 | `booking_slots` | Khung giờ chi tiết của lịch đặt (giá, hệ số chụp lại). | 2 | QĐ1, 2, 3 | Chính thức |
| 14 | `services` | Dịch vụ đi kèm của từng cụm sân. | 5 | QĐ2 | **[PHÁC THẢO]** |
| 15 | `booking_services` | Dịch vụ đi kèm trong lịch đặt. | 5 | QĐ2 | **[PHÁC THẢO]** |
| 16 | `reviews` | Đánh giá sân sau khi chơi. | 5 | – | **[PHÁC THẢO]** |
| 17 | `team_posts` | Bài đăng tìm đồng đội. | 4 | – | **[PHÁC THẢO]** |
| 18 | `team_post_applications` | Lượt đăng ký tham gia ghép đội. | 4 | – | **[PHÁC THẢO]** |

### 1.2 Bảng quan hệ thực thể

| Bảng Nguồn (1) | Bảng Đích (N) | Khóa ngoại | Ghi chú |
|---|---|---|---|
| `users` | `wallets` | `user_id` | 1-1 (Mỗi người đúng 1 ví) |
| `users` | `roles` | `user_id`, `role_id` | N-N (qua bảng `user_roles`) |
| `users` | `facilities` | `owner_id` | Chủ sở hữu cụm sân |
| `facilities` | `facility_photos` | `facility_id` | |
| `facilities` | `facility_schedules` | `facility_id` | |
| `facilities` | `courts` | `facility_id` | |
| `sports` | `courts` | `sport_id` | |
| `courts` | `court_slots` | `court_id` | |
| `time_slots` | `court_slots` | `time_slot_id` | |
| `facilities` | `pricing_rules` | `applies_to_facility_id` | Áp dụng quy tắc cho cụm sân |
| `holidays` | `pricing_rules` | `holiday_id` | Móc quy tắc vào ngày lễ cụ thể |
| `users` | `bookings` | `user_id` | Khách đặt sân |
| `courts` | `bookings` | `court_id` | |
| `bookings` | `booking_slots` | `(booking_id, court_id, play_date)` | Khóa ngoại ghép chống lệch sân/ngày |
| `court_slots` | `booking_slots` | `(court_id, time_slot_id)` | Khóa ngoại ghép chống đặt ngoài giờ mở cửa |
| `wallets` | `wallet_transactions` | `from_wallet_id` / `to_wallet_id` | Nguồn và đích |
| `bookings` | `wallet_transactions` | `related_booking_id` | Giao dịch thuộc về lịch nào |
| `users` | `wallet_transactions` | `created_by` | Admin thực hiện TOPUP |
| `facilities` | `services` | `facility_id` | Dịch vụ của cụm sân cụ thể **[PHÁC THẢO]** |
| `services` | `booking_services` | `service_id` | **[PHÁC THẢO]** |
| `bookings` | `booking_services` | `booking_id` | **[PHÁC THẢO]** |
| `bookings` | `reviews` | `booking_id` | 1-1 (Mỗi lịch 1 review) **[PHÁC THẢO]** |
| `users` | `team_posts` | `user_id` | Người đăng **[PHÁC THẢO]** |
| `bookings` | `team_posts` | `booking_id` | Liên kết lịch đặt với bài ghép đội **[PHÁC THẢO]** |
| `team_posts` | `team_post_applications` | `post_id` | **[PHÁC THẢO]** |
| `users` | `team_post_applications` | `user_id` | Người ứng tuyển **[PHÁC THẢO]** |

---

## PHẦN 1B: CHI TIẾT THUỘC TÍNH CÁC ENTITY

### Nhóm 1 — Người dùng & Ví tiền

*   **`users`**: `id` (BIGINT PK), `name` (VARCHAR), `email` (VARCHAR UNIQUE), `phone` (VARCHAR UNIQUE), `password_hash` (VARCHAR), `is_active` (BOOLEAN DEFAULT true), `is_system` (BOOLEAN DEFAULT false), `avatar_url` (VARCHAR, nullable).
    > Tài khoản `is_system = true` có đúng **1 bản ghi**, tạo bằng seed script. Tìm bằng `WHERE is_system = true`; không hardcode ID trong `.env`. Để CSDL ép "đúng 1 bản ghi": cột sinh `IF(is_system, 1, NULL)` kèm `UNIQUE` (tương tự `active_key`).
*   **`roles`**: `id` (INT PK), `name` (`CUSTOMER`, `OWNER`, `ADMIN`), `description` (VARCHAR).
*   **`user_roles`**: `user_id` (BIGINT FK), `role_id` (INT FK), `granted_at` (DATETIME), PK `(user_id, role_id)`.
*   **`wallets`**: `id` (BIGINT PK), `user_id` (BIGINT FK UNIQUE), `balance` (BIGINT NOT NULL DEFAULT 0, CHECK balance >= 0).
*   **`wallet_transactions`**: `id` (BIGINT PK), `from_wallet_id` (BIGINT FK, nullable), `to_wallet_id` (BIGINT FK, NOT NULL), `type` (ENUM: `TOPUP`, `DEPOSIT`, `REFUND`, `FORFEIT`, `SETTLE`), `amount` (BIGINT NOT NULL, CHECK amount > 0), `related_booking_id` (BIGINT FK, nullable), `created_by` (BIGINT FK → users.id, nullable — chỉ TOPUP), `created_at` (DATETIME).

    | type | from_wallet_id | to_wallet_id | created_by | related_booking_id |
    |---|---|---|---|---|
    | TOPUP | NULL | ví khách | Admin id | NULL |
    | DEPOSIT | ví khách | ví hệ thống | NULL | booking id |
    | REFUND | ví hệ thống | ví khách | NULL | booking id |
    | FORFEIT | ví hệ thống | ví chủ sân | NULL | booking id |
    | SETTLE | ví hệ thống | ví chủ sân | NULL | booking id |

### Nhóm 2 — Sân bãi & Bảng giá

*   **`sports`**: `id` (INT PK), `name` (VARCHAR UNIQUE), `icon_url` (VARCHAR).
*   **`facilities`**: `id` (BIGINT PK), `owner_id` (BIGINT FK), `name`, `address`, `city`, `district` (VARCHAR), `latitude`, `longitude` (DECIMAL), `open_time`, `close_time` (TIME NOT NULL), `description` (TEXT, nullable), `slot_duration_minutes` (INT DEFAULT 60), `is_active` (BOOLEAN).
*   **`facility_photos`**: `id` (BIGINT PK), `facility_id` (BIGINT FK), `url` (VARCHAR NOT NULL), `is_primary` (BOOLEAN DEFAULT false), `sort_order` (INT DEFAULT 0).
*   **`facility_amenities`**: `facility_id` (BIGINT FK), `amenity_code` (VARCHAR 50). PK `(facility_id, amenity_code)`.
*   **`facility_schedules`**: `facility_id` (BIGINT FK), `day_of_week` (TINYINT, CHECK 1–7), `open_time`, `close_time` (TIME NOT NULL), `is_active` (BOOLEAN). PK `(facility_id, day_of_week)`. *Dùng khi giờ mở cửa khác nhau theo ngày; nếu tất cả ngày giống nhau thì dùng `facilities.open_time`/`close_time`.*
*   **`courts`**: `id` (BIGINT PK), `facility_id` (BIGINT FK), `sport_id` (INT FK), `name` (VARCHAR), `court_type` (VARCHAR), `environment` (ENUM: `INDOOR`, `OUTDOOR`), `open_time`, `close_time` (TIME), `is_active` (BOOLEAN). *Ràng buộc:* `CHECK (open_time < close_time)`.
*   **`time_slots`**: `id` (INT PK), `start_time` (TIME UNIQUE), `end_time` (TIME), `duration_minutes` (INT), `label` (VARCHAR). *Ràng buộc:* `CHECK (end_time > start_time)`.
*   **`court_slots`**: `id` (BIGINT PK), `court_id` (BIGINT FK), `time_slot_id` (INT FK), `base_price` (BIGINT NOT NULL, CHECK base_price >= 0), `is_active` (BOOLEAN), `lock_reason` (VARCHAR, nullable — lý do khoá slot: bảo trì…). *Ràng buộc:* `UNIQUE (court_id, time_slot_id)`.
*   **`holidays`**: `id` (INT PK), `name` (VARCHAR), `holiday_date` (DATE NOT NULL UNIQUE), `recurring_yearly` (BOOLEAN).
*   **`pricing_rules`**: `id` (INT PK), `name` (VARCHAR), `rule_type` (ENUM: `PEAK_HOUR`, `WEEKEND`, `HOLIDAY`), `multiplier` (DECIMAL(4,2) NOT NULL, CHECK multiplier BETWEEN 1.20 AND 1.50), `applies_to_facility_id` (BIGINT FK, nullable), `start_time`, `end_time` (TIME, nullable), `day_of_week` (TINYINT, nullable), `holiday_id` (INT FK, nullable).

    *Ràng buộc theo `rule_type`:*
    ```sql
    CHECK (
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
    )
    ```

### Nhóm 3 — Lịch đặt

*   **`bookings`**: `id` (BIGINT PK), `booking_code` (VARCHAR(20) UNIQUE, nullable — sinh bởi BE theo định dạng `SB{YYMM}-{id}`), `user_id` (BIGINT FK), `court_id` (BIGINT FK), `play_date` (DATE), `start_at` (DATETIME), `status` (ENUM: `PENDING_DEPOSIT`, `DEPOSITED`, `COMPLETED`, `CANCELLED`), `subtotal`, `service_total`, `total_amount`, `deposit_amount` (BIGINT), `deposit_percent` (TINYINT, CHECK BETWEEN 1 AND 100), `hold_expires_at` (DATETIME, nullable), `cancelled_at` (DATETIME, nullable), `cancel_reason` (TEXT), `created_at` (DATETIME DEFAULT NOW()).
    *Ràng buộc:* `UNIQUE (id, court_id, play_date)`, `CHECK (DATE(start_at) = play_date)`, `CHECK ((status = 'CANCELLED') = (cancelled_at IS NOT NULL))`.
*   **`booking_slots`**: `id` (BIGINT PK), `booking_id` (BIGINT), `court_id` (BIGINT), `play_date` (DATE), `time_slot_id` (INT), `base_price`, `final_price` (BIGINT), `multiplier` (DECIMAL(4,2), CHECK BETWEEN 1.00 AND 1.50), `released_at` (DATETIME, nullable), `active_key` (TINYINT GENERATED ALWAYS AS (`IF(released_at IS NULL, 1, NULL)`) STORED).
    *Ràng buộc:* Khóa ngoại ghép với `bookings(id, court_id, play_date)` và `court_slots(court_id, time_slot_id)`, `UNIQUE (court_id, play_date, time_slot_id, active_key)`. (Khóa ngoại ghép đã đảm bảo `court_id` và `play_date` khớp booking cha cả INSERT lẫn UPDATE — không cần trigger riêng.)

### Nhóm 4 — Phác thảo (CN 4, 5)

*   **`services`**: `id` (INT PK), `facility_id` (BIGINT FK), `name` (VARCHAR), `unit_price` (BIGINT, CHECK >= 0), `unit` (VARCHAR), `is_active` (BOOLEAN).
*   **`booking_services`**: `id` (BIGINT PK), `booking_id` (BIGINT FK), `service_id` (INT FK), `quantity` (INT, CHECK >= 1), `unit_price`, `total_price` (BIGINT).
*   **`reviews`**: `id` (BIGINT PK), `booking_id` (BIGINT FK UNIQUE), `rating` (TINYINT, CHECK 1-5), `comment` (TEXT), `created_at` (DATETIME DEFAULT NOW()).
*   **`team_posts`**: `id` (BIGINT PK), `user_id` (BIGINT FK), `booking_id` (BIGINT FK), `title` (VARCHAR), `players_needed` (INT, CHECK >= 1), `status` (ENUM: `OPEN`, `CLOSED`, `CANCELLED`), `created_at` (DATETIME DEFAULT NOW()).
*   **`team_post_applications`**: `id` (BIGINT PK), `post_id` (BIGINT FK), `user_id` (BIGINT FK), `status` (ENUM: `PENDING`, `ACCEPTED`, `REJECTED`), `message` (TEXT).

---

## PHẦN 2: RÀNG BUỘC DỮ LIỆU & LUỒNG NGHIỆP VỤ

*Quy ước: MySQL 8.0.16+, Engine InnoDB, `STRICT_TRANS_TABLES` bật.*

### 2.1 Mười một (11) Ràng buộc mức CSDL

| # | Ràng buộc | Thực thi | Nơi đặt |
|---|---|---|---|
| 1 | **Trạng thái QĐ7 & Chuyển hướng hợp lệ** | `ENUM` + `STRICT_TRANS_TABLES`. Trigger `BEFORE UPDATE`: chỉ cho phép `PENDING_DEPOSIT` → `DEPOSITED`/`CANCELLED` và `DEPOSITED` → `COMPLETED`/`CANCELLED`. | `bookings` |
| 2 | **Tiền lưu số nguyên VND & ≥ 0** | Kiểu `BIGINT` cho mọi cột tiền, `CHECK (amount > 0)` cho transaction, `CHECK (amount >= 0)` cho các cột còn lại. Phép chia nguyên `DIV`. | Mọi bảng tiền |
| 3 | **Không xóa/sửa cứng lịch và giao dịch** | Khóa ngoại `RESTRICT`. Trigger `BEFORE DELETE` báo lỗi SQLSTATE '45000' trên `bookings`, `booking_slots`, `wallet_transactions`. Trigger `BEFORE UPDATE` báo lỗi SQLSTATE '45000' trên `wallet_transactions` (fallback khi hosting dùng chung không cho GRANT). `GRANT` tước `UPDATE`, `DELETE`, `DROP` của user ứng dụng nếu có quyền (`DROP` cần thiết để chặn TRUNCATE). | `bookings`, `booking_slots`, `wallet_transactions` |
| 4 | **Số dư ví khớp tổng giao dịch** | Cập nhật `balance` bằng phép **cộng/trừ tương đối** (`SET balance = balance ± :amount`), không ghi đè bằng số tính ở Python (chống hai request đè nhau). INSERT sổ cái trong cùng 1 Transaction. Truy vấn đối soát chạy định kỳ trong CI/CD. | `wallets` |
| 5 | **Mỗi người dùng đúng 1 ví** | `UNIQUE(user_id)`. Backend tạo User và Wallet trong cùng 1 Transaction. | `wallets` |
| 6 | **Số dư ví không âm** | `CHECK (balance >= 0)` + `SELECT ... FOR UPDATE` ở Backend trước khi trừ. | `wallets` |
| 7 | **Không trùng khung giờ** | `UNIQUE (court_id, play_date, time_slot_id, active_key)` kết hợp cột sinh `STORED`. | `booking_slots` |
| 8 | **Khung giờ thuộc sân mở cửa** | Khóa ngoại ghép `FOREIGN KEY (court_id, time_slot_id) REFERENCES court_slots (court_id, time_slot_id)`. | `booking_slots` |
| 9 | **Công thức tính tiền & tỉ lệ** | `CHECK (total_amount = subtotal + service_total)`, `CHECK (deposit_amount = total_amount * deposit_percent DIV 100)`, `CHECK (final_price = ROUND(base_price * multiplier, 0))`. `subtotal = SUM(booking_slots.final_price)` và `service_total = SUM(booking_services.total_price)` không CHECK được ở DB — Backend tính trong transaction và có unit test. | `bookings`, `booking_slots` |
| 10 | **Logic quy tắc giá** | `CHECK (multiplier BETWEEN 1.20 AND 1.50)` trên `pricing_rules`; `CHECK (multiplier BETWEEN 1.00 AND 1.50)` trên `booking_slots`. CHECK theo `rule_type` (xem PHẦN 1B). **Khi nhiều quy tắc khớp, Backend lấy `MAX(multiplier)`.** | `pricing_rules`, `booking_slots` |
| 11 | **Hình dạng giao dịch ví & chống hoàn cọc hai lần** | `CHECK (from_wallet_id <> to_wallet_id)` (to_wallet_id đã NOT NULL ở mức cột). CHECK hình dạng đầy đủ: `CHECK ((type = 'TOPUP' AND from_wallet_id IS NULL AND created_by IS NOT NULL AND related_booking_id IS NULL) OR (type <> 'TOPUP' AND from_wallet_id IS NOT NULL AND created_by IS NULL AND related_booking_id IS NOT NULL))`. `UNIQUE (related_booking_id, type)` — áp dụng mọi loại; TOPUP không bị ảnh hưởng vì `related_booking_id = NULL`. | `wallet_transactions` |

### 2.2 Công thức & Luồng Transaction cho Backend (SCB-52 Checklist)

**Công thức hoàn cọc (QĐ5):** Tính khoảng cách giữa `:now` và `bookings.start_at`:
*   `>= 24h`: Hoàn 80% → `refund = deposit_amount * 80 DIV 100`
*   `12h ≤ x < 24h`: Hoàn 50% → `refund = deposit_amount * 50 DIV 100`
*   `< 12h`: Hoàn 0%
*   `forfeit = deposit_amount - refund`

**Lưu ý làm tròn:** Dùng `Decimal` với `ROUND_HALF_UP` ở Python để đồng bộ với `ROUND` của MySQL.

---

**Luồng 1 — Tạo lịch (Giữ slot tạm):**
1. Tính `start_at = play_date + MIN(start_time)` của các khung giờ được chọn.
2. Kiểm tra tất cả `time_slot_id` có trong `court_slots` của sân, `start_time >= open_time` và `end_time <= close_time`. Từ chối nếu `start_at <= now` (không cho đặt slot đã qua hoặc đang diễn ra).
3. Tính giá: `base_price` từ `court_slots`; `multiplier = MAX(multiplier các quy tắc khớp)` hoặc 1.00; `final_price = ROUND(base_price × multiplier)`; `subtotal = SUM(final_price)`; `service_total = SUM(booking_services.total_price)` (0 nếu không có dịch vụ); `total_amount = subtotal + service_total`; `deposit_percent` (cấu hình hệ thống); `deposit_amount = total_amount × deposit_percent DIV 100`.
4. Đặt `hold_expires_at = MIN(now + X phút, start_at)` — tránh hold vượt qua giờ chơi.
5. INSERT `bookings` và `booking_slots` trong cùng 1 Transaction.
6. Không dùng "kiểm tra slot trống rồi chèn" làm lớp chặn duy nhất — bắt lỗi `1062` (Duplicate) → HTTP 409.

**Luồng 2 — Đặt cọc (Thanh toán):**
1. `SELECT ... FOR UPDATE` ví khách và ví hệ thống theo thứ tự `wallet.id` tăng dần (tránh deadlock).
2. `UPDATE bookings SET status = 'DEPOSITED', hold_expires_at = NULL WHERE id = :id AND status = 'PENDING_DEPOSIT' AND hold_expires_at > :now` → kiểm tra `rowcount = 1`; bằng 0 nghĩa là lịch đã hết hạn hoặc bị đổi trạng thái.
3. `SET balance = balance - :amount` ví khách, `SET balance = balance + :amount` ví hệ thống → INSERT `DEPOSIT`.

**Luồng 3 — Hủy lịch (do khách):**
1. `SELECT status FROM bookings WHERE id = :id FOR UPDATE` → đọc trạng thái cũ.
2. `UPDATE bookings SET status = 'CANCELLED', cancelled_at = :now WHERE id = :id AND status IN ('PENDING_DEPOSIT', 'DEPOSITED') AND :now < start_at` → kiểm tra `rowcount = 1`.
3. `UPDATE booking_slots SET released_at = :now WHERE booking_id = :id AND released_at IS NULL`.
4. **Chỉ khi** trạng thái cũ (bước 1) là `DEPOSITED`:
    *   `SELECT ... FOR UPDATE` ví hệ thống và ví chủ sân (`booking → court → facility → owner → wallet`) theo thứ tự `wallet.id` tăng dần.
    *   Tính `refund` và `forfeit` theo công thức QĐ5.
    *   **Chỉ INSERT `REFUND` khi `refund > 0`**: `SET balance = balance - refund` ví hệ thống, `SET balance = balance + refund` ví khách.
    *   **Chỉ INSERT `FORFEIT` khi `forfeit > 0`**: `SET balance = balance - forfeit` ví hệ thống, `SET balance = balance + forfeit` ví chủ sân.

**Luồng 3b — Hết hạn cọc (tác vụ định kỳ):**
1. Lấy các lịch `PENDING_DEPOSIT` có `hold_expires_at <= :now` (khớp với điều kiện `> :now` ở luồng 2).
2. `UPDATE bookings SET status = 'CANCELLED', cancelled_at = :now WHERE id = :id AND status = 'PENDING_DEPOSIT'` → kiểm tra `rowcount = 1`.
3. `UPDATE booking_slots SET released_at = :now WHERE booking_id = :id AND released_at IS NULL`.
4. Không ghi giao dịch ví (chưa thu cọc). Không kiểm tra `start_at`.

**Luồng 4 — Hoàn tất lịch (chủ sân xác nhận):**
1. Chỉ cho phép khi `now >= start_at` (buổi chơi đã bắt đầu hoặc kết thúc).
2. `SELECT ... FOR UPDATE` ví hệ thống và ví chủ sân (`booking → court → facility → owner → wallet`) theo thứ tự `wallet.id` tăng dần.
3. `UPDATE bookings SET status = 'COMPLETED' WHERE id = :id AND status = 'DEPOSITED'` → kiểm tra `rowcount = 1`.
4. `SET balance = balance - deposit_amount` ví hệ thống, `SET balance = balance + deposit_amount` ví chủ sân → INSERT `SETTLE`.

**Bắt mã lỗi CSDL:**

| Mã | Ý nghĩa | Xử lý |
|---|---|---|
| `1062` | Trùng khung giờ (Duplicate key) | HTTP 409 |
| `3819` | CHECK constraint thất bại | Nếu tên constraint chứa `chk_wallets_balance` → HTTP 402 "Số dư không đủ"; các CHECK khác là lỗi lập trình, ghi log. **Đặt tên rõ từng CHECK khi tạo bảng** (`CONSTRAINT chk_wallets_balance CHECK (balance >= 0)`). |
| `1213` | Deadlock | Retry 1–2 lần với back-off |

---

### 2.3 Giới hạn của MySQL cần nắm rõ

*   **CHECK bị bỏ qua hoàn toàn nếu MySQL < 8.0.16** — kiểm tra `SELECT VERSION()` trước khi deploy.
*   **CHECK không thấy OLD/NEW**, không dùng subquery hay bảng khác → dùng Trigger cho chuyển trạng thái; dùng Transaction + truy vấn đối soát cho số dư và các tổng.
*   **Không có Partial Unique Index** → dùng cột sinh `active_key` (UNIQUE cho phép nhiều NULL).
*   **Cột sinh không tham chiếu bảng khác** → nhả khung giờ phụ thuộc `released_at` trên chính `booking_slots`; đổi `bookings.status` và `released_at` trong cùng một transaction.
*   **Trigger không chặn được TRUNCATE** (TRUNCATE cần quyền DROP). Tạo Trigger cần quyền TRIGGER; hosting bật binary log có thể cần `SUPER` hoặc `log_bin_trust_function_creators = 1` — thử tạo trigger trên hosting sớm.
*   **ENUM chỉ chặn giá trị sai khi sql_mode có `STRICT_TRANS_TABLES`.**
*   **ORM (SQLAlchemy/Alembic…) không tự sinh trigger và cột sinh** → viết SQL thô trong `database/migrations/`.
