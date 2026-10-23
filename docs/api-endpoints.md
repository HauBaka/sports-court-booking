# ĐẶC TẢ DANH SÁCH API (API SPECIFICATION)
## HỆ THỐNG QUẢN LÝ VÀ ĐẶT SÂN THỂ THAO (SPORTS COURT BOOKING)

- **Tài liệu tham chiếu bắt buộc:** `docs/api-conventions.md`, `docs/database-entities.md`
- **Base URL:** `/api/v1`
- **Giao thức & Định dạng:** HTTPS, JSON (`Content-Type: application/json`)
- **Quy ước đặt tên (Naming Conventions):**
  - **URL / Endpoints:** kebab-case, danh từ số nhiều cho tài nguyên (ví dụ: `/api/v1/facilities`, `/api/v1/courts`, `/api/v1/bookings`, `/api/v1/team-posts`).
  - **JSON Keys & Query Params:** snake_case (ví dụ: `facility_id`, `court_id`, `start_time`, `total_amount`).
- **Quy ước Tiền tệ & Thời gian:**
  - **Tiền tệ:** Số nguyên (integer, đơn vị VNĐ), không dùng số thập phân.
  - **Thời gian (Date & Time):** Chuẩn ISO 8601 UTC (`YYYY-MM-DDTHH:mm:ssZ`) hoặc ISO 8601 kèm múi giờ Việt Nam (`+07:00`). Tất cả các mốc giờ chơi và tính toán khoảng cách hủy cọc (`hours_until_start`) được quy đổi chính xác theo giờ Việt Nam (UTC+7) để đảm bảo không bị lệch múi giờ.
- **Cơ chế xác thực & Phân quyền:**
  - **Xác thực:** Bearer Token (JSON Web Token - JWT) HMAC-SHA256 truyền qua Header `Authorization: Bearer <access_token>`.
  - **Phân quyền người dùng (User Roles):** Ánh xạ từ bảng `roles` trong CSDL (`CUSTOMER`, `OWNER`, `ADMIN`) sang định dạng chữ thường trong Token JWT và API:
    - `customer`: Khách hàng tìm kiếm, đặt sân, giữ chỗ, nạp cọc, xem ví cá nhân, hủy lịch và nhận hoàn cọc.
    - `owner`: Chủ cơ sở thể thao quản lý cơ sở (`facilities`), sân con (`courts`), giờ mở/đóng cửa, bảng giá thời điểm (`pricing_rules`), xác nhận hoàn tất buổi chơi và nhận tiền kết toán.
    - `admin`: Quản trị viên cấp cao, quản lý tài khoản người dùng và cấp số dư trải nghiệm (`TOPUP`) vào ví nội bộ (QĐ6).

---

## 1. QUY CHUẨN THIẾT KẾ BẮT BUỘC

### 1.1. Quy chuẩn Database Transaction (ACID & Concurrency Control)
Các thao tác liên quan đến **nhiều bảng dữ liệu**, **thay đổi số dư ví**, **ghi sổ cái `wallet_transactions`**, hoặc **khóa/nhả khung giờ (`bookings`, `booking_slots`)** BẮT BUỘC phải thực thi trong **MỘT Database Transaction duy nhất**:
* Sử dụng cơ chế khóa dòng dữ liệu (`SELECT ... FOR UPDATE` trong SQLAlchemy / MySQL InnoDB) khi kiểm tra khung giờ và số dư ví để triệt tiêu hoàn toàn lỗi **Race Condition / Đặt trùng lịch (Overbooking - QĐ3)**.
* Khi thao tác chuyển tiền giữa các ví (ví khách ↔ ví hệ thống ↔ ví chủ sân), luôn khóa các dòng ví theo thứ tự **`wallet.id` tăng dần** để chống hoàn toàn lỗi kẹt vòng lặp (Deadlock).
* Đảm bảo thứ tự thao tác ghi: Tạo bản ghi `bookings` trước, sau đó mới ghi `wallet_transactions` với `related_booking_id = bookings.id` để không bao giờ vi phạm ràng buộc khóa ngoại (Foreign Key).
* Nếu bất kỳ bước nào trong chuỗi xử lý thất bại, toàn bộ tiến trình phải được **Rollback 100%**.

### 1.2. Quy chuẩn Frontend Zero-Math (Tính toán tập trung tại Backend)
Frontend **TUYỆT ĐỐI KHÔNG TỰ TÍNH TOÁN** bất kỳ phép tính tiền cọc, phụ phí, hệ số nhân giờ cao điểm, hoặc tỉ lệ hoàn tiền nào:
* **Endpoint tính tiền (`POST /bookings/calculate-price`):** Server bóc tách và trả về chi tiết theo từng khung giờ (`slots_breakdown`), áp dụng đúng hệ số nhân cao điểm/ngày lễ của từng slot, tổng tiền sân, tổng dịch vụ, tổng thanh toán, tỉ lệ cọc (30%), tiền cọc bắt buộc trừ ví và số tiền còn lại phải thanh toán tại sân.
* **Endpoint hủy sân (`GET /bookings/{id}/cancel-preview` & `POST /bookings/{id}/cancel`):** Server tự đo khoảng cách thời gian từ lúc bấm hủy đến giờ bắt đầu chơi (`hours_until_start`), đối chiếu các mốc quy định QĐ5 (≥24h: 80%, 12h–24h: 50%, <12h: 0%), trả về tỉ lệ hoàn, tiền hoàn vào ví khách, tiền phạt bồi thường cho chủ sân, và câu thông báo hiển thị.

### 1.3. Cấu trúc Response & Error Envelope chuẩn (Theo `api-conventions.md`)
Mọi phản hồi từ Backend đều tuân thủ cấu trúc chuẩn trong `api-conventions.md`:
* **Thành công (Đơn lẻ - Single Object):** `{"success": true, "message": "...", "data": { ... }}`
* **Thành công (Danh sách phân trang - Paginated List):** `{"success": true, "message": "...", "data": [ ... ], "meta": { "page": 1, "limit": 10, "total": 45, "total_pages": 5 }}`
* **Thành công (Không trả về dữ liệu - No Content / Action Only):** `{"success": true, "message": "...", "data": null}`
* **Lỗi (HTTP Status >= 400):** `{"success": false, "error": { "code": "SLOT_ALREADY_BOOKED", "message": "...", "details": null }}`

---

## 2. DANH SÁCH ENDPOINTS CHI TIẾT THEO EPIC

---

### 🟢 EPIC 1: XÁC THỰC VÀ PHÂN QUYỀN (AUTH & USER MANAGEMENT)

#### 1.1 Đăng ký tài khoản mới
* **Endpoint:** `POST /api/v1/auth/register`
* **Mô tả:** Đăng ký tài khoản mới cho Khách hàng (`customer`) hoặc Chủ sân (`owner`). Mật khẩu được mã hóa an toàn bằng Bcrypt. Tự động khởi tạo một Ví nội bộ với số dư ban đầu bằng 0 VNĐ.
* **Quyền truy cập:** Public.
* **Database Transaction:** **BẮT BUỘC** (Tạo bản ghi `users` và bản ghi `wallets` trong cùng một transaction).
* **Request Body:**
```json
{
  "name": "Nguyễn Văn A",
  "email": "customer@example.com",
  "phone": "0901234567",
  "password": "SecurePassword123@",
  "role": "customer"
}
```
* **Response (201 Created):**
```json
{
  "success": true,
  "message": "Đăng ký tài khoản thành công.",
  "data": {
    "id": 12,
    "name": "Nguyễn Văn A",
    "email": "customer@example.com",
    "phone": "0901234567",
    "role": "customer",
    "wallet_id": 12,
    "balance": 0
  }
}
```
* **Mã lỗi phát sinh:**
  - `409 Conflict`: `AUTH_EMAIL_EXISTS` (Email đã tồn tại) hoặc `AUTH_PHONE_EXISTS` (Số điện thoại đã tồn tại).
  - `422 Unprocessable Entity`: `VALIDATION_ERROR` (Sai định dạng email, mật khẩu yếu).

#### 1.2 Đăng nhập hệ thống
* **Endpoint:** `POST /api/v1/auth/login`
* **Mô tả:** Xác thực thông tin qua email/mật khẩu, cấp mã Access Token JWT chuẩn HMAC-SHA256.
* **Quyền truy cập:** Public.
* **Database Transaction:** Không.
* **Request Body:**
```json
{
  "email": "customer@example.com",
  "password": "SecurePassword123@"
}
```
* **Response (200 OK):**
```json
{
  "success": true,
  "message": "Đăng nhập thành công.",
  "data": {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "token_type": "bearer",
    "user": {
      "id": 12,
      "name": "Nguyễn Văn A",
      "email": "customer@example.com",
      "role": "customer"
    }
  }
}
```
* **Mã lỗi phát sinh:**
  - `401 Unauthorized`: `AUTH_INVALID_CREDENTIALS` (Sai email hoặc mật khẩu).

#### 1.3 Lấy thông tin hồ sơ & Số dư ví hiện tại
* **Endpoint:** `GET /api/v1/auth/me`
* **Mô tả:** Trả về thông tin hồ sơ và số dư ví của tài khoản đang đăng nhập.
* **Quyền truy cập:** Đã đăng nhập (`customer`, `owner`, `admin`).
* **Header:** `Authorization: Bearer <access_token>`
* **Database Transaction:** Không.
* **Response (200 OK):**
```json
{
  "success": true,
  "message": "Lấy thông tin tài khoản thành công.",
  "data": {
    "id": 12,
    "name": "Nguyễn Văn A",
    "email": "customer@example.com",
    "phone": "0901234567",
    "role": "customer",
    "wallet": {
      "id": 12,
      "balance": 500000
    }
  }
}
```

#### 1.4 Đăng xuất hệ thống
* **Endpoint:** `POST /api/v1/auth/logout`
* **Mô tả:** Đăng xuất khỏi hệ thống, hủy phiên làm việc (Frontend xóa `access_token` tại `localStorage`, Backend ghi nhận thu hồi phiên nếu có cơ chế blacklist). Tuân thủ cấu trúc *Thao tác không trả về dữ liệu (No Content / Action Only)* theo mục 2.1.C của `api-conventions.md`.
* **Quyền truy cập:** Đã đăng nhập (`customer`, `owner`, `admin`).
* **Header:** `Authorization: Bearer <access_token>`
* **Database Transaction:** Không.
* **Response (200 OK):**
```json
{
  "success": true,
  "message": "Đăng xuất thành công.",
  "data": null
}
```

---

### 🟢 EPIC 2: QUẢN LÝ CƠ SỞ THỂ THAO, SÂN CON & BẢNG GIÁ (FACILITIES, COURTS & PRICING - QĐ1)

> **Lưu ý kiến trúc CSDL (`database-entities.md`):**
> - Bảng `facilities`: `(id, owner_id, name, address, city, latitude, longitude, is_active)`. Không chứa cột `district`, `open_time`, `close_time`.
> - Bảng `courts`: `(id, facility_id, sport_id, name, court_type, environment, open_time, close_time, is_active)`. Chứa giờ mở/đóng cửa và môi trường thi đấu (`INDOOR`, `OUTDOOR`).
> - Bảng `court_slots`: `(id, court_id, time_slot_id, base_price, is_active)`. Lưu giá cơ sở theo từng khung giờ của sân.
> - Bảng `pricing_rules`: `(id, name, rule_type, multiplier, applies_to_facility_id, start_time, end_time, day_of_week, holiday_id)`. Ràng buộc theo `rule_type`.

#### 2.1 Tra cứu danh sách cơ sở thể thao
* **Endpoint:** `GET /api/v1/facilities`
* **Mô tả:** Tìm kiếm và lọc cơ sở thể thao theo môn thi đấu (`sport_id`), thành phố (`city`), từ khóa tìm kiếm (`search`). Trả về tọa độ địa lý (`latitude`, `longitude`) phục vụ bản đồ tương tác Leaflet / OpenStreetMap.
* **Quyền truy cập:** Public.
* **Query Params:** `sport_id`, `city`, `search`, `page=1`, `limit=10`.
* **Database Transaction:** Không.
* **Response (200 OK - Paginated List):**
```json
{
  "success": true,
  "message": "Lấy danh sách cơ sở thể thao thành công.",
  "data": [
    {
      "id": 1,
      "name": "Cơ Sở Cầu Lông & Pickleball Kỳ Hòa",
      "owner_id": 3,
      "address": "238 Ba Tháng Hai, Phường 12, Quận 10",
      "city": "Hồ Chí Minh",
      "latitude": 10.771921,
      "longitude": 106.671042,
      "is_active": true,
      "min_price": 80000,
      "max_price": 160000,
      "total_courts": 6
    }
  ],
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 1,
    "total_pages": 1
  }
}
```

#### 2.2 Xem chi tiết cơ sở thể thao và danh sách sân con
* **Endpoint:** `GET /api/v1/facilities/{id}`
* **Mô tả:** Lấy thông tin chi tiết một cơ sở kèm danh sách các sân con (`courts`) trực thuộc.
* **Quyền truy cập:** Public.
* **Database Transaction:** Không.
* **Response (200 OK):**
```json
{
  "success": true,
  "message": "Lấy chi tiết cơ sở thành công.",
  "data": {
    "id": 1,
    "name": "Cơ Sở Cầu Lông & Pickleball Kỳ Hòa",
    "owner_id": 3,
    "address": "238 Ba Tháng Hai, Phường 12, Quận 10",
    "city": "Hồ Chí Minh",
    "latitude": 10.771921,
    "longitude": 106.671042,
    "is_active": true,
    "courts": [
      {
        "id": 101,
        "name": "Sân Cầu Lông 1 (Thảm Yonex)",
        "sport_id": 1,
        "court_type": "Tiêu chuẩn thi đấu",
        "environment": "INDOOR",
        "open_time": "06:00:00",
        "close_time": "23:00:00",
        "is_active": true
      },
      {
        "id": 102,
        "name": "Sân Cầu Lông 2 (Thảm Yonex)",
        "sport_id": 1,
        "court_type": "Tiêu chuẩn thi đấu",
        "environment": "INDOOR",
        "open_time": "06:00:00",
        "close_time": "23:00:00",
        "is_active": true
      }
    ]
  }
}
```

#### 2.3 Tạo cơ sở thể thao mới (Dành cho Chủ sân)
* **Endpoint:** `POST /api/v1/facilities`
* **Mô tả:** Chủ sân đăng ký cơ sở thể thao mới. Tự động gán `owner_id = current_user.id` và `is_active = true`.
* **Quyền truy cập:** `owner`.
* **Database Transaction:** Không.
* **Request Body:**
```json
{
  "name": "Cơ Sở Cầu Lông Tân Bình",
  "address": "123 Hoàng Hoa Thám, Phường 13, Quận Tân Bình",
  "city": "Hồ Chí Minh",
  "latitude": 10.7992,
  "longitude": 106.6501
}
```
* **Response (201 Created):**
```json
{
  "success": true,
  "message": "Tạo cơ sở thể thao thành công.",
  "data": {
    "id": 5,
    "name": "Cơ Sở Cầu Lông Tân Bình",
    "owner_id": 3,
    "address": "123 Hoàng Hoa Thám, Phường 13, Quận Tân Bình",
    "city": "Hồ Chí Minh",
    "latitude": 10.7992,
    "longitude": 106.6501,
    "is_active": true
  }
}
```

#### 2.4 Lấy danh sách sân con của một cơ sở
* **Endpoint:** `GET /api/v1/facilities/{id}/courts`
* **Mô tả:** Lấy danh sách toàn bộ các sân con thuộc cơ sở chỉ định.
* **Quyền truy cập:** Public.
* **Database Transaction:** Không.
* **Response (200 OK):**
```json
{
  "success": true,
  "message": "Lấy danh sách sân con thành công.",
  "data": [
    {
      "id": 101,
      "facility_id": 1,
      "name": "Sân Cầu Lông 1 (Thảm Yonex)",
      "sport_id": 1,
      "court_type": "Tiêu chuẩn thi đấu",
      "environment": "INDOOR",
      "open_time": "06:00:00",
      "close_time": "23:00:00",
      "is_active": true
    }
  ]
}
```

#### 2.5 Tạo sân con mới thuộc cơ sở thể thao
* **Endpoint:** `POST /api/v1/facilities/{id}/courts`
* **Mô tả:** Thêm sân con mới vào cơ sở thể thao, thiết lập giờ hoạt động (`open_time`, `close_time`), môi trường thi đấu và khởi tạo giá cơ sở (`court_slots.base_price`) cho các khung giờ hoạt động.
* **Quyền truy cập:** `owner` (chủ sở hữu cơ sở thể thao).
* **Database Transaction:** **BẮT BUỘC** (Tạo bản ghi `courts` và khởi tạo các bản ghi `court_slots` ban đầu trong cùng một transaction).
* **Request Body:**
```json
{
  "name": "Sân 1 - Thảm Tiêu Chuẩn",
  "sport_id": 1,
  "court_type": "Tiêu chuẩn thi đấu",
  "environment": "INDOOR",
  "open_time": "06:00:00",
  "close_time": "23:00:00",
  "default_base_price": 100000
}
```
* **Response (201 Created):**
```json
{
  "success": true,
  "message": "Tạo sân con thành công.",
  "data": {
    "id": 105,
    "facility_id": 5,
    "name": "Sân 1 - Thảm Tiêu Chuẩn",
    "sport_id": 1,
    "court_type": "Tiêu chuẩn thi đấu",
    "environment": "INDOOR",
    "open_time": "06:00:00",
    "close_time": "23:00:00",
    "is_active": true
  }
}
```

#### 2.6 Xem chi tiết một sân con cụ thể (Courts)
* **Endpoint:** `GET /api/v1/courts/{court_id}`
* **Mô tả:** Lấy thông tin chi tiết một sân con cụ thể.
* **Quyền truy cập:** Public.
* **Database Transaction:** Không.
* **Response (200 OK):**
```json
{
  "success": true,
  "message": "Lấy chi tiết sân con thành công.",
  "data": {
    "id": 101,
    "facility_id": 1,
    "name": "Sân Cầu Lông 1 (Thảm Yonex)",
    "sport_id": 1,
    "court_type": "Tiêu chuẩn thi đấu",
    "environment": "INDOOR",
    "open_time": "06:00:00",
    "close_time": "23:00:00",
    "is_active": true
  }
}
```

#### 2.7 Cập nhật thông tin sân con (Dành cho Chủ sân)
* **Endpoint:** `PATCH /api/v1/courts/{court_id}`
* **Mô tả:** Chủ cơ sở điều chỉnh tên sân, giờ mở/đóng cửa, hoặc bật/tắt trạng thái hoạt động (`is_active = false` khi bảo trì sân).
* **Quyền truy cập:** `owner` (chủ sở hữu sân con).
* **Database Transaction:** Không.
* **Request Body:**
```json
{
  "name": "Sân Cầu Lông 1 (Thảm Yonex Nâng Cấp)",
  "open_time": "05:30:00",
  "close_time": "23:30:00",
  "is_active": true
}
```
* **Response (200 OK):**
```json
{
  "success": true,
  "message": "Cập nhật thông tin sân con thành công.",
  "data": {
    "id": 101,
    "name": "Sân Cầu Lông 1 (Thảm Yonex Nâng Cấp)",
    "is_active": true
  }
}
```

#### 2.8 Cấu hình quy tắc giá theo thời điểm (Áp dụng QĐ1)
* **Endpoint:** `POST /api/v1/facilities/{id}/pricing-rules`
* **Mô tả:** Thiết lập quy tắc nhân giá theo cơ sở (`applies_to_facility_id = id`). Tuân thủ nghiêm ngặt ràng buộc CSDL theo từng loại `rule_type`:
  - `PEAK_HOUR`: Bắt buộc có `start_time`, `end_time` (`start_time < end_time`); `day_of_week` và `holiday_id` phải là `null`.
  - `WEEKEND`: Bắt buộc `day_of_week BETWEEN 1 AND 7` (1: Thứ Hai, ..., 6: Thứ Bảy, 7: Chủ Nhật); `start_time`, `end_time` và `holiday_id` phải là `null`. (Nếu cấu hình cả Thứ Bảy và Chủ Nhật, gửi 2 bản ghi riêng biệt cho ngày 6 và ngày 7).
  - `HOLIDAY`: Bắt buộc có `holiday_id` (trỏ đến bản ghi trong bảng `holidays`); `start_time`, `end_time` và `day_of_week` phải là `null`.
  - Hệ số nhân `multiplier`: Bắt buộc từ `1.20` đến `1.50`.
* **Quyền truy cập:** `owner` (chủ sở hữu cơ sở thể thao).
* **Database Transaction:** **BẮT BUỘC** (Xóa quy tắc cũ và thêm các quy tắc `pricing_rules` mới trong cùng transaction).
* **Request Body:**
```json
{
  "rules": [
    {
      "name": "Giờ vàng 17h-21h",
      "rule_type": "PEAK_HOUR",
      "start_time": "17:00:00",
      "end_time": "21:00:00",
      "day_of_week": null,
      "holiday_id": null,
      "multiplier": 1.3
    },
    {
      "name": "Cuối tuần Thứ Bảy",
      "rule_type": "WEEKEND",
      "start_time": null,
      "end_time": null,
      "day_of_week": 6,
      "holiday_id": null,
      "multiplier": 1.4
    },
    {
      "name": "Cuối tuần Chủ Nhật",
      "rule_type": "WEEKEND",
      "start_time": null,
      "end_time": null,
      "day_of_week": 7,
      "holiday_id": null,
      "multiplier": 1.4
    },
    {
      "name": "Ngày lễ Quốc Khánh",
      "rule_type": "HOLIDAY",
      "start_time": null,
      "end_time": null,
      "day_of_week": null,
      "holiday_id": 1,
      "multiplier": 1.5
    }
  ]
}
```
* **Response (200 OK):**
```json
{
  "success": true,
  "message": "Cấu hình bảng giá theo thời điểm thành công.",
  "data": {
    "facility_id": 1,
    "total_rules_created": 4
  }
}
```

---

### 🟢 EPIC 3: LỊCH TRỐNG, TÍNH TIỀN, GIỮ CHỖ VÀ ĐẶT CỌC (BOOKINGS, SLOT LOCK & DEPOSIT)

> **Luồng nghiệp vụ đặt sân chuẩn CSDL (`database-entities.md`):**
> 1. **Kiểm tra lịch trống (`GET /courts/{court_id}/slots`):** Khách chọn ngày, xem khung giờ `AVAILABLE`, `HOLDING`, `BOOKED`.
> 2. **Tính tiền xem trước (`POST /bookings/calculate-price`):** Server bóc tách chi tiết hệ số và tiền cọc 30% (Frontend Zero-Math).
> 3. **Tạo lịch giữ chỗ tạm (`POST /bookings` - Luồng 1 CSDL):** Khóa khung giờ tạm thời trong 10 phút, tạo `bookings` với trạng thái `PENDING_DEPOSIT` và `hold_expires_at = MIN(now + 10m, start_at)`.
> 4. **Thanh toán cọc (`POST /bookings/{id}/deposit` - Luồng 2 CSDL):** Khách xác nhận trừ tiền cọc từ ví, chuyển trạng thái `bookings` sang `DEPOSITED`, sinh giao dịch ví `DEPOSIT` (`related_booking_id = booking.id`).

#### 3.1 Xem sơ đồ khung giờ trống theo ngày của sân con
* **Endpoint:** `GET /api/v1/courts/{court_id}/slots`
* **Mô tả:** Lấy danh sách toàn bộ các khung giờ trong ngày chỉ định (`date=YYYY-MM-DD`). Trả về trạng thái khung giờ:
  - `AVAILABLE`: Khung giờ trống, sẵn sàng cho đặt chỗ.
  - `HOLDING`: Khung giờ đang được giữ chỗ tạm thời trong đơn đặt `PENDING_DEPOSIT` (`hold_expires_at > :now`).
  - `BOOKED`: Khung giờ đã được đặt cọc thành công (`DEPOSITED` hoặc `COMPLETED` với `active_key = 1`).
* **Quyền truy cập:** Public.
* **Query Params:** `date=YYYY-MM-DD` (bắt buộc).
* **Database Transaction:** Không.
* **Response (200 OK):**
```json
{
  "success": true,
  "message": "Lấy lịch khung giờ thành công.",
  "data": {
    "court_id": 101,
    "date": "2026-11-10",
    "slots": [
      {
        "time_slot_id": 1,
        "start_time": "16:00:00",
        "end_time": "17:00:00",
        "base_price": 100000,
        "status": "AVAILABLE"
      },
      {
        "time_slot_id": 2,
        "start_time": "17:00:00",
        "end_time": "18:00:00",
        "base_price": 100000,
        "status": "HOLDING"
      },
      {
        "time_slot_id": 3,
        "start_time": "18:00:00",
        "end_time": "19:00:00",
        "base_price": 100000,
        "status": "BOOKED"
      }
    ]
  }
}
```

#### 3.2 Xem trước tính tiền đặt sân và tiền cọc (Frontend Zero-Math)
* **Endpoint:** `POST /api/v1/bookings/calculate-price`
* **Mô tả:** Server tính toán toàn bộ chi phí theo QĐ1, QĐ2, QĐ4. Trả về chi tiết hệ số nhân của từng khung giờ riêng biệt (`slots_breakdown`), tổng tiền sân, tiền dịch vụ, tổng thanh toán và tiền cọc 30%.
* **Quyền truy cập:** Đã đăng nhập (`customer`).
* **Database Transaction:** Không.
* **Request Body:**
```json
{
  "court_id": 101,
  "play_date": "2026-11-10",
  "time_slot_ids": [1, 3],
  "services": [
    {
      "service_id": 1,
      "quantity": 2
    }
  ]
}
```
* **Response (200 OK - Frontend chỉ hiển thị, không tự tính):**
```json
{
  "success": true,
  "message": "Tính toán tiền đặt sân thành công.",
  "data": {
    "court_id": 101,
    "court_name": "Sân Cầu Lông 1 (Thảm Yonex)",
    "facility_name": "Cơ Sở Cầu Lông & Pickleball Kỳ Hòa",
    "play_date": "2026-11-10",
    "slots_breakdown": [
      {
        "time_slot_id": 1,
        "time_range": "16:00:00 - 17:00:00",
        "base_price": 100000,
        "applied_rule": "GIỜ THƯỜNG",
        "multiplier": 1.0,
        "final_price": 100000
      },
      {
        "time_slot_id": 3,
        "time_range": "18:00:00 - 19:00:00",
        "base_price": 100000,
        "applied_rule": "PEAK_HOUR (17h-21h)",
        "multiplier": 1.3,
        "final_price": 130000
      }
    ],
    "pricing_summary": {
      "subtotal": 230000,
      "service_total": 40000,
      "total_amount": 270000
    },
    "deposit_policy": {
      "policy_rule": "QĐ4 - Bắt buộc đặt cọc 30% tổng tiền qua ví nội bộ",
      "deposit_percent": 30,
      "deposit_amount_required": 81000,
      "remaining_amount_due_at_court": 189000
    },
    "user_wallet_status": {
      "current_balance": 200000,
      "is_balance_sufficient": true,
      "balance_after_deposit": 119000
    }
  }
}
```

#### 3.3 Tạo lịch đặt sân và giữ chỗ tạm (Luồng 1 CSDL - `PENDING_DEPOSIT`)
* **Endpoint:** `POST /api/v1/bookings`
* **Mô tả:** Khách hàng tiến hành tạo đơn đặt sân để giữ chỗ tạm trong 10 phút. Chưa trừ tiền ví.
* **Quyền truy cập:** Đã đăng nhập (`customer`).
* **Database Transaction:** **BẮT BUỘC (ACID TRANSACTION VỚI ROW LOCKING)**
  - **Bước 1:** Kiểm tra `time_slot_ids` hợp lệ với giờ mở cửa của sân con (`court_slots`).
  - **Bước 2:** Khóa hàng (`SELECT ... FOR UPDATE`) các khung giờ trong `court_slots` và kiểm tra ràng buộc duy nhất trong `booking_slots` (`court_id`, `play_date`, `time_slot_id`, `active_key=1`). Nếu khung giờ đã có người đặt cọc hoặc đang được giữ chỗ -> Rollback báo `409 Conflict` (`SLOT_ALREADY_BOOKED`).
  - **Bước 3:** Tính toán giá: `subtotal`, `service_total`, `total_amount`, `deposit_amount = total_amount * 30 DIV 100`.
  - **Bước 4:** Thiết lập `hold_expires_at = MIN(:now + 10 phút, start_at)`.
  - **Bước 5:** Tạo bản ghi `bookings` trạng thái `PENDING_DEPOSIT`, gán `user_id = current_user.id`.
  - **Bước 6:** Tạo các bản ghi con `booking_slots` với `active_key = 1` và `booking_services` nếu có.
  - **Bước 7:** Commit Transaction. (Lưu ý: Chưa ghi sổ cái `wallet_transactions` vì chưa thu tiền).
* **Request Body:**
```json
{
  "court_id": 101,
  "play_date": "2026-11-10",
  "time_slot_ids": [1, 3],
  "services": [
    {
      "service_id": 1,
      "quantity": 2
    }
  ],
  "note": "Giao lưu thể thao"
}
```
* **Response (201 Created):**
```json
{
  "success": true,
  "message": "Tạo lịch đặt và giữ chỗ thành công. Vui lòng thanh toán cọc trong vòng 10 phút.",
  "data": {
    "id": 105,
    "booking_code": "BK-20261110-0105",
    "court_id": 101,
    "play_date": "2026-11-10",
    "start_at": "2026-11-10T16:00:00+07:00",
    "end_at": "2026-11-10T19:00:00+07:00",
    "status": "PENDING_DEPOSIT",
    "total_amount": 270000,
    "deposit_amount_required": 81000,
    "hold_expires_at": "2026-11-08T15:10:00+07:00"
  }
}
```

#### 3.4 Đặt cọc 30% cho lịch đặt đang giữ chỗ (Luồng 2 CSDL - `DEPOSIT`)
* **Endpoint:** `POST /api/v1/bookings/{id}/deposit`
* **Mô tả:** Khách hàng thanh toán 30% tiền cọc từ ví nội bộ để xác nhận đơn đặt sân chính thức.
* **Quyền truy cập:** Đã đăng nhập (`customer` sở hữu đơn đặt).
* **Database Transaction:** **BẮT BUỘC (ACID TRANSACTION VỚI ROW LOCKING)**
  - **Bước 1:** Khóa hàng ví khách hàng (`wallets.id`) và ví hệ thống trung gian (`is_system = true`) theo thứ tự `wallet.id` tăng dần (chống hoàn toàn lỗi Deadlock).
  - **Bước 2:** Kiểm tra số dư ví khách: `balance >= deposit_amount`. Nếu thiếu tiền -> Rollback báo `400 Bad Request` (`WALLET_INSUFFICIENT_BALANCE`).
  - **Bước 3:** Khóa hàng đơn đặt `bookings`. Kiểm tra `status == 'PENDING_DEPOSIT'` và `hold_expires_at > :now`. Nếu hết hạn -> Rollback báo `400 Bad Request` ("Lịch giữ chỗ đã hết hạn").
  - **Bước 4:** Cập nhật `bookings`: `status = 'DEPOSITED'`, `hold_expires_at = NULL`.
  - **Bước 5:** Trừ số dư ví khách (`balance = balance - deposit_amount`), cộng số dư ví hệ thống trung gian (`balance = balance + deposit_amount`).
  - **Bước 6:** Ghi bản ghi vào sổ cái `wallet_transactions` với `type = 'DEPOSIT'`, `from_wallet_id = ví khách`, `to_wallet_id = ví hệ thống`, `related_booking_id = id`. (Được thực thi sau khi đã có `bookings.id`, đảm bảo đúng khóa ngoại).
  - **Bước 7:** Commit Transaction.
* **Request Body:** Không yêu cầu.
* **Response (200 OK):**
```json
{
  "success": true,
  "message": "Thanh toán cọc 30% thành công. Đơn đặt sân đã được xác nhận.",
  "data": {
    "booking_id": 105,
    "booking_code": "BK-20261110-0105",
    "status": "DEPOSITED",
    "deposit_amount_paid": 81000,
    "remaining_amount_due_at_court": 189000,
    "wallet_balance_remaining": 119000
  }
}
```

#### 3.5 Tra cứu danh sách lịch đặt sân (Paginated List)
* **Endpoint:** `GET /api/v1/bookings`
* **Mô tả:** Lấy danh sách lịch đặt sân có phân trang và bộ lọc:
  - Khách hàng (`customer`): Chỉ xem lịch đặt của chính mình (`user_id = current_user.id`).
  - Chủ cơ sở (`owner`): Xem toàn bộ lịch đặt tại các sân thuộc cơ sở mình quản lý.
  - Quản trị viên (`admin`): Xem toàn bộ lịch đặt trên hệ thống.
* **Quyền truy cập:** Đã đăng nhập (`customer`, `owner`, `admin`).
* **Query Params:** `status`, `court_id`, `facility_id`, `from_date`, `to_date`, `page=1`, `limit=10`.
* **Database Transaction:** Không.
* **Response (200 OK - Paginated List):**
```json
{
  "success": true,
  "message": "Lấy danh sách lịch đặt sân thành công.",
  "data": [
    {
      "id": 105,
      "booking_code": "BK-20261110-0105",
      "facility_id": 1,
      "facility_name": "Cơ Sở Cầu Lông & Pickleball Kỳ Hòa",
      "court_id": 101,
      "court_name": "Sân Cầu Lông 1 (Thảm Yonex)",
      "play_date": "2026-11-10",
      "start_at": "2026-11-10T16:00:00+07:00",
      "total_amount": 270000,
      "deposit_amount": 81000,
      "remaining_amount": 189000,
      "status": "DEPOSITED",
      "created_at": "2026-11-08T15:00:00+07:00"
    }
  ],
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 1,
    "total_pages": 1
  }
}
```

#### 3.6 Xem thông tin chi tiết đơn đặt sân
* **Endpoint:** `GET /api/v1/bookings/{id}`
* **Mô tả:** Trả về thông tin đầy đủ của một đơn đặt sân, danh sách các khung giờ con (`booking_slots`), dịch vụ phụ trợ (`booking_services`) và bảng kê tài chính.
* **Quyền truy cập:** Đã đăng nhập (`customer` sở hữu đơn, `owner` quản lý cơ sở, `admin`).
* **Database Transaction:** Không.
* **Response (200 OK):**
```json
{
  "success": true,
  "message": "Lấy chi tiết đơn đặt sân thành công.",
  "data": {
    "id": 105,
    "booking_code": "BK-20261110-0105",
    "user_id": 12,
    "customer_name": "Nguyễn Văn A",
    "customer_phone": "0901234567",
    "facility_name": "Cơ Sở Cầu Lông & Pickleball Kỳ Hòa",
    "court_name": "Sân Cầu Lông 1 (Thảm Yonex)",
    "play_date": "2026-11-10",
    "start_at": "2026-11-10T16:00:00+07:00",
    "status": "DEPOSITED",
    "slots": [
      {
        "time_slot_id": 1,
        "time_range": "16:00:00 - 17:00:00",
        "final_price": 100000
      },
      {
        "time_slot_id": 3,
        "time_range": "18:00:00 - 19:00:00",
        "final_price": 130000
      }
    ],
    "services": [
      {
        "service_id": 1,
        "name": "Thuê vợt",
        "quantity": 2,
        "unit_price": 20000,
        "total_price": 40000
      }
    ],
    "pricing_summary": {
      "subtotal": 230000,
      "service_total": 40000,
      "total_amount": 270000,
      "deposit_amount_paid": 81000,
      "remaining_amount_due_at_court": 189000
    },
    "created_at": "2026-11-08T15:00:00+07:00"
  }
}
```

---

### 🟢 EPIC 4: HỦY SÂN, HOÀN CỌC VÀ KẾT TOÁN TIỀN SÂN (CANCELLATION, REFUND & SETTLEMENT)

#### 4.1 Xem trước số tiền hoàn khi hủy lịch (Frontend Zero-Math)
* **Endpoint:** `GET /api/v1/bookings/{id}/cancel-preview`
* **Mô tả:** Server đo khoảng cách thời gian từ hiện tại (`:now`) đến giờ bắt đầu chơi (`start_at`) để tính toán chính sách hoàn cọc theo QĐ5:
  - Nếu đơn ở trạng thái `PENDING_DEPOSIT`: Chưa thu cọc, hoàn 0 VNĐ.
  - Nếu đơn ở trạng thái `DEPOSITED`:
    - `hours_until_start >= 24h`: Hoàn 80% cọc (`refund = deposit * 80 DIV 100`), phạt 20% (`forfeit = deposit - refund`).
    - `12h <= hours_until_start < 24h`: Hoàn 50% cọc (`refund = deposit * 50 DIV 100`), phạt 50% (`forfeit = deposit - refund`).
    - `< 12h`: Hoàn 0% cọc (`refund = 0`), phạt 100% (`forfeit = deposit`). Vẫn cho phép hủy sân giải phóng giờ chơi, không bị báo lỗi 400.
* **Quyền truy cập:** Đã đăng nhập (`customer` sở hữu đơn đặt).
* **Database Transaction:** Không.
* **Response (200 OK - Frontend chỉ hiển thị):**
```json
{
  "success": true,
  "message": "Tính toán chính sách hoàn cọc thành công.",
  "data": {
    "booking_id": 105,
    "booking_code": "BK-20261110-0105",
    "deposit_amount_paid": 81000,
    "schedule_info": {
      "play_date": "2026-11-10",
      "start_at": "2026-11-10T16:00:00+07:00"
    },
    "cancellation_evaluation": {
      "evaluated_at": "2026-11-09T08:00:00+07:00",
      "hours_until_start": 32.0,
      "rule_matched": "QĐ5.1 - Hủy từ 24 giờ trở lên trước giờ chơi (Hoàn 80% cọc)",
      "refund_percentage": 80,
      "penalty_percentage": 20
    },
    "financial_result": {
      "refund_amount_to_player": 64800,
      "penalty_amount_to_facility": 16200,
      "customer_display_message": "Bạn đang yêu cầu hủy trước 32.0 giờ. Theo quy định QĐ5, bạn sẽ được hoàn lại 80% tiền cọc (64.800 VNĐ) vào ví nội bộ ngay lập tức."
    }
  }
}
```

#### 4.2 Thực hiện hủy lịch và xử lý cọc tự động (Luồng 3 CSDL - `REFUND`, `FORFEIT`)
* **Endpoint:** `POST /api/v1/bookings/{id}/cancel`
* **Mô tả:** Xác nhận hủy đơn đặt sân (hỗ trợ hủy cả `PENDING_DEPOSIT` và `DEPOSITED`).
* **Quyền truy cập:** Đã đăng nhập (`customer` sở hữu đơn hoặc `admin`).
* **Database Transaction:** **BẮT BUỘC (ACID TRANSACTION VỚI ROW LOCKING)**
  - **Bước 1:** Khóa hàng (`SELECT ... FOR UPDATE`) đơn đặt trong bảng `bookings`. Kiểm tra `status IN ('PENDING_DEPOSIT', 'DEPOSITED')` và `:now < start_at`. (Nếu `:now >= start_at` -> Báo lỗi `400 Bad Request` với mã `CANNOT_CANCEL_BOOKING`).
  - **Bước 2:** Cập nhật `bookings`: `status = 'CANCELLED'`, `cancelled_at = :now`, `cancel_reason = request.cancel_reason`.
  - **Bước 3:** Cập nhật `booking_slots`: `released_at = :now` (cột sinh `active_key` tự chuyển về `NULL` để nhả khung giờ theo QĐ3).
  - **Bước 4:** NẾU trạng thái cũ là `DEPOSITED`:
    - Khóa hàng các ví liên quan (ví hệ thống, ví khách, ví chủ cơ sở) theo thứ tự `wallet.id` tăng dần.
    - Tính `hours_until_start = (start_at - :now)`. Tính `refund` và `forfeit` theo QĐ5.
    - Trừ số dư ví hệ thống: `balance = balance - deposit_amount`.
    - Nếu `refund > 0`: Cộng `refund` vào ví khách hàng và ghi bản ghi `wallet_transactions` loại `REFUND`.
    - Nếu `forfeit > 0`: Cộng `forfeit` vào ví chủ cơ sở (`facility.owner_id`) và ghi bản ghi `wallet_transactions` loại `FORFEIT`.
  - **Bước 5:** NẾU trạng thái cũ là `PENDING_DEPOSIT`: Không có giao dịch ví nào được ghi nhận.
  - **Bước 6:** Commit Transaction.
* **Request Body:**
```json
{
  "cancel_reason": "Bận việc đột xuất không tham gia được"
}
```
* **Response (200 OK):**
```json
{
  "success": true,
  "message": "Hủy đơn đặt sân thành công. Khung giờ đã được mở lại.",
  "data": {
    "booking_id": 105,
    "booking_code": "BK-20261110-0105",
    "status": "CANCELLED",
    "hours_until_start": 32.0,
    "refund_percentage": 80,
    "refunded_to_customer_wallet": 64800,
    "compensated_to_facility_wallet": 16200,
    "customer_new_wallet_balance": 183800
  }
}
```

#### 4.3 Xác nhận hoàn tất buổi chơi & Kết toán cọc cho chủ sân (Luồng 4 CSDL - `SETTLE`)
* **Endpoint:** `POST /api/v1/bookings/{id}/complete`
* **Mô tả:** Khi khách hàng đến nhận sân và hoàn tất buổi chơi (điều kiện `:now >= start_at`), Chủ cơ sở bấm xác nhận hoàn tất. Toàn bộ khoản tiền cọc 30% đang được giữ ở Ví hệ thống sẽ được kết toán chuyển sang Ví của Chủ cơ sở (`SETTLE`), đơn chuyển sang trạng thái `COMPLETED` (QĐ7).
* **Quyền truy cập:** `owner` (chủ sở hữu cơ sở) hoặc `admin`.
* **Database Transaction:** **BẮT BUỘC (ACID TRANSACTION VỚI ROW LOCKING)**
  - **Bước 1:** Kiểm tra điều kiện thời gian: `:now >= start_at`. Nếu chưa đến giờ -> Báo lỗi `400 Bad Request` (`CANNOT_SETTLE_BEFORE_START`).
  - **Bước 2:** Khóa hàng (`SELECT ... FOR UPDATE`) đơn đặt `bookings`. Kiểm tra `status == 'DEPOSITED'`.
  - **Bước 3:** Khóa hàng ví hệ thống trung gian (`is_system = true`) và ví chủ cơ sở (`facility.owner_id`) theo thứ tự `wallet.id` tăng dần.
  - **Bước 4:** Trừ số dư ví hệ thống: `balance = balance - deposit_amount`.
  - **Bước 5:** Cộng số dư ví chủ cơ sở: `balance = balance + deposit_amount`.
  - **Bước 6:** Ghi bản ghi vào sổ cái `wallet_transactions` với `type = 'SETTLE'` (`from_wallet_id = ví hệ thống`, `to_wallet_id = ví chủ sân`, `related_booking_id = booking.id`).
  - **Bước 7:** Cập nhật `bookings`: `status = 'COMPLETED'`.
  - **Bước 8:** Commit Transaction.
* **Request Body:** Không yêu cầu.
* **Response (200 OK):**
```json
{
  "success": true,
  "message": "Xác nhận hoàn tất buổi chơi và kết toán tiền cọc cho chủ sân thành công.",
  "data": {
    "booking_id": 105,
    "booking_code": "BK-20261110-0105",
    "status": "COMPLETED",
    "settled_deposit_amount": 81000,
    "owner_wallet_id": 3,
    "transaction_type": "SETTLE"
  }
}
```

---

### 🟢 EPIC 5: VÍ NỘI BỘ VÀ LỊCH SỬ DÒNG TIỀN (WALLETS & TRANSACTIONS - QĐ6)

#### 5.1 Tra cứu số dư ví người dùng hiện tại
* **Endpoint:** `GET /api/v1/wallets/me`
* **Mô tả:** Lấy thông tin ví và số dư khả dụng hiện tại của tài khoản đang đăng nhập.
* **Quyền truy cập:** Đã đăng nhập (`customer`, `owner`).
* **Database Transaction:** Không.
* **Response (200 OK):**
```json
{
  "success": true,
  "message": "Lấy thông tin ví thành công.",
  "data": {
    "id": 12,
    "user_id": 12,
    "balance": 183800
  }
}
```

#### 5.2 Tra cứu lịch sử biến động số dư (Paginated List)
* **Endpoint:** `GET /api/v1/wallets/me/transactions`
* **Mô tả:** Lấy danh sách lịch sử giao dịch ví của người dùng hiện tại (hỗ trợ phân trang và lọc theo loại giao dịch). Bao quát đủ 5 loại: `TOPUP`, `DEPOSIT`, `REFUND`, `FORFEIT`, `SETTLE`.
* **Quyền truy cập:** Đã đăng nhập (`customer`, `owner`).
* **Query Params:** `type`, `page=1`, `limit=10`.
* **Database Transaction:** Không.
* **Response (200 OK - Paginated List):**
```json
{
  "success": true,
  "message": "Lấy lịch sử giao dịch ví thành công.",
  "data": [
    {
      "id": 501,
      "type": "REFUND",
      "amount": 64800,
      "from_wallet_id": 1,
      "to_wallet_id": 12,
      "related_booking_id": 105,
      "created_at": "2026-11-09T08:05:00+07:00"
    },
    {
      "id": 480,
      "type": "DEPOSIT",
      "amount": 81000,
      "from_wallet_id": 12,
      "to_wallet_id": 1,
      "related_booking_id": 105,
      "created_at": "2026-11-08T15:05:00+07:00"
    },
    {
      "id": 401,
      "type": "TOPUP",
      "amount": 200000,
      "from_wallet_id": null,
      "to_wallet_id": 12,
      "related_booking_id": null,
      "created_at": "2026-11-01T09:00:00+07:00"
    }
  ],
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 3,
    "total_pages": 1
  }
}
```

#### 5.3 Admin nạp tiền vào ví trải nghiệm người dùng (QĐ6 - `TOPUP`)
* **Endpoint:** `POST /api/v1/admin/wallet-topups`
* **Mô tả:** Quản trị viên cấp số dư vào ví cho người dùng để trải nghiệm chức năng đồ án môn học.
* **Quyền truy cập:** `admin`.
* **Database Transaction:** **BẮT BUỘC** (Cộng số dư ví và ghi bản ghi `wallet_transactions` loại `TOPUP` trong cùng transaction).
* **Request Body:**
```json
{
  "user_id": 12,
  "amount": 500000,
  "reason": "Cấp số dư tài khoản trải nghiệm đồ án môn học"
}
```
* **Response (201 Created):**
```json
{
  "success": true,
  "message": "Nạp tiền vào ví thành công.",
  "data": {
    "user_id": 12,
    "wallet_id": 12,
    "granted_amount": 500000,
    "new_balance": 683800
  }
}
```

---

### 🟢 EPIC 6: BÀI ĐĂNG TÌM ĐỒNG ĐỘI (MATCHMAKING & TEAM POSTS - CHỨC NĂNG 4)

> **Lưu ý kiến trúc CSDL (`database-entities.md`):**
> - Bảng `team_posts`: `(id, user_id, booking_id, title, players_needed, status: OPEN, CLOSED, CANCELLED)`.
> - Bảng `team_post_applications`: `(id, post_id, user_id, status: PENDING, ACCEPTED, REJECTED, message)`.

#### 6.1 Xem danh sách bài đăng tìm người chơi (Paginated List)
* **Endpoint:** `GET /api/v1/team-posts`
* **Mô tả:** Lấy danh sách các bài đăng tìm đồng đội ghép trận kèm thông tin lịch đặt sân liên kết.
* **Quyền truy cập:** Public.
* **Query Params:** `status=OPEN`, `page=1`, `limit=10`.
* **Database Transaction:** Không.
* **Response (200 OK - Paginated List):**
```json
{
  "success": true,
  "message": "Lấy danh sách bài đăng ghép trận thành công.",
  "data": [
    {
      "id": 1,
      "user_id": 12,
      "booking_id": 105,
      "title": "Cần tìm 2 bạn đánh đôi cầu lông trình độ trung bình khá",
      "players_needed": 2,
      "status": "OPEN",
      "court_name": "Sân Cầu Lông 1 (Thảm Yonex)",
      "play_date": "2026-11-10",
      "time_range": "16:00:00 - 19:00:00",
      "created_at": "2026-11-08T16:00:00+07:00"
    }
  ],
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 1,
    "total_pages": 1
  }
}
```

#### 6.2 Đăng bài tìm đồng đội
* **Endpoint:** `POST /api/v1/team-posts`
* **Mô tả:** Người chơi đã đặt sân tạo bài đăng tìm kiếm người ghép đội giao lưu.
* **Quyền truy cập:** `customer`.
* **Database Transaction:** Không.
* **Request Body:**
```json
{
  "booking_id": 105,
  "title": "Cần tìm 2 bạn đánh đôi cầu lông trình độ trung bình khá",
  "players_needed": 2
}
```
* **Response (201 Created):**
```json
{
  "success": true,
  "message": "Đăng bài tìm đồng đội thành công.",
  "data": {
    "id": 1,
    "user_id": 12,
    "booking_id": 105,
    "title": "Cần tìm 2 bạn đánh đôi cầu lông trình độ trung bình khá",
    "players_needed": 2,
    "status": "OPEN"
  }
}
```

#### 6.3 Đăng ký ứng tuyển tham gia ghép đội
* **Endpoint:** `POST /api/v1/team-posts/{id}/applications`
* **Mô tả:** Người chơi khác gửi lời nhắn đăng ký một suất tham gia trận đấu.
* **Quyền truy cập:** `customer`.
* **Database Transaction:** Không.
* **Request Body:**
```json
{
  "message": "Mình đánh cầu lông 2 năm, xin 1 slot giao lưu nhé!"
}
```
* **Response (201 Created):**
```json
{
  "success": true,
  "message": "Gửi yêu cầu tham gia thành công. Vui lòng chờ người tạo duyệt.",
  "data": {
    "id": 10,
    "post_id": 1,
    "user_id": 15,
    "status": "PENDING",
    "message": "Mình đánh cầu lông 2 năm, xin 1 slot giao lưu nhé!"
  }
}
```

#### 6.4 Phê duyệt hoặc từ chối ứng viên ghép đội
* **Endpoint:** `PATCH /api/v1/team-posts/{id}/applications/{app_id}`
* **Mô tả:** Người đăng bài duyệt (`ACCEPTED`) hoặc từ chối (`REJECTED`) yêu cầu ứng tuyển của người chơi khác.
* **Quyền truy cập:** `customer` (chủ bài đăng).
* **Database Transaction:** **BẮT BUỘC** (Cập nhật trạng thái `team_post_applications` và tự động cập nhật `status = 'CLOSED'` nếu đã đủ số người cần).
* **Request Body:**
```json
{
  "status": "ACCEPTED"
}
```
* **Response (200 OK):**
```json
{
  "success": true,
  "message": "Phê duyệt thành viên tham gia thành công.",
  "data": {
    "id": 10,
    "post_id": 1,
    "status": "ACCEPTED"
  }
}
```

---

## 3. BẢNG DANH MỤC HTTP STATUS CODES & BUSINESS ERROR CODES

| Nhóm nghiệp vụ | Mã lỗi (`code`) | HTTP Status | Ý nghĩa & Tình huống phát sinh |
| :--- | :--- | :---: | :--- |
| **1. Chung (Common)** | `INVALID_REQUEST` | **400** | Yêu cầu không hợp lệ hoặc vi phạm logic nghiệp vụ chung. |
| | `VALIDATION_ERROR` | **422** | Dữ liệu gửi lên sai định dạng Schema (Pydantic validation). Có danh sách `details`. |
| | `RESOURCE_NOT_FOUND` | **404** | Không tìm thấy tài nguyên yêu cầu trong hệ thống. |
| | `INTERNAL_SERVER_ERROR` | **500** | Lỗi server nội bộ hoặc Database Exception ngoài ý muốn. |
| **2. Xác thực & Phân quyền (Auth)** | `AUTH_INVALID_CREDENTIALS` | **401** | Email hoặc mật khẩu không chính xác khi đăng nhập. |
| | `AUTH_TOKEN_EXPIRED` | **401** | Access token JWT đã hết hạn (`exp`), cần đăng nhập lại. |
| | `AUTH_TOKEN_INVALID` | **401** | Token không đúng định dạng JWT hoặc chữ ký HMAC-SHA256 không hợp lệ. |
| | `AUTH_UNAUTHORIZED` | **401** | Request yêu cầu đăng nhập nhưng thiếu Header `Authorization: Bearer <token>`. |
| | `AUTH_FORBIDDEN` | **403** | Đã xác thực nhưng không đủ quyền thực hiện hành động (ví dụ khách hàng gọi API admin). |
| | `AUTH_EMAIL_EXISTS` | **409** | Email đã được sử dụng bởi tài khoản khác trong hệ thống. |
| | `AUTH_PHONE_EXISTS` | **409** | Số điện thoại đã được sử dụng bởi tài khoản khác trong hệ thống. |
| **3. Cơ sở, Sân & Bảng giá** | `FACILITY_NOT_FOUND` | **404** | Không tìm thấy cơ sở thể thao theo ID yêu cầu. |
| | `COURT_NOT_FOUND` | **404** | Không tìm thấy sân con theo ID yêu cầu. |
| | `COURT_INACTIVE` | **400** | Sân con đang tạm dừng hoạt động hoặc đang bảo trì (`is_active = false`). |
| | `TIME_SLOT_INVALID` | **400** | Khung giờ nằm ngoài giờ mở cửa/đóng cửa của sân. |
| | `PRICING_NOT_FOUND` | **404** | Chưa cấu hình bảng giá cơ sở hoặc bảng giá theo thời điểm cho khung giờ này. |
| **4. Đặt sân & Giữ chỗ (Bookings - QĐ1, 2, 3)** | `BOOKING_NOT_FOUND` | **404** | Không tìm thấy đơn đặt sân theo ID yêu cầu. |
| | `SLOT_ALREADY_BOOKED` | **409** | Khung giờ đã có khách khác đặt cọc hoặc đang giữ chỗ (chống trùng lịch QĐ3). |
| | `INVALID_BOOKING_TIME` | **400** | Giờ bắt đầu phải nhỏ hơn giờ kết thúc, thời gian đặt phải ở tương lai. |
| | `CANNOT_CANCEL_BOOKING` | **400** | Lịch đặt đã bắt đầu diễn ra (`:now >= start_at`) hoặc đã hoàn tất, không thể hủy. |
| | `CANNOT_SETTLE_BEFORE_START` | **400** | Buổi chơi chưa bắt đầu (`:now < start_at`), chưa thể thực hiện kết toán cọc. |
| **5. Ví & Tiền cọc (Wallet & Payment - QĐ4, 5, 6)** | `WALLET_NOT_FOUND` | **404** | Không tìm thấy ví nội bộ của người dùng trong hệ thống. |
| | `WALLET_INSUFFICIENT_BALANCE` | **400** | Số dư ví hiện tại không đủ 30% tiền cọc (vi phạm ràng buộc số dư QĐ4, QĐ6). Ánh xạ từ lỗi CSDL 3819 `chk_wallets_balance`. |
| | `REFUND_NOT_ELIGIBLE` | **400** | Yêu cầu hoàn cọc không hợp lệ theo quy định hoàn tiền QĐ5. |
| | `DEPOSIT_AMOUNT_INVALID` | **400** | Số tiền nạp cấp vào ví (`TOPUP`) hoặc tiền cọc phải là số nguyên lớn hơn 0 VNĐ. |
