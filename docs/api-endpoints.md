# ĐẶC TẢ DANH SÁCH API (API SPECIFICATION)
## HỆ THỐNG QUẢN LÝ VÀ ĐẶT SÂN THỂ THAO (SPORTS COURT BOOKING)

- **Base URL:** `backend/api/v1`
- **Giao thức & Định dạng:** HTTPS, JSON (`application/json`)
- **Quy ước đặt tên (Naming Conventions):**
  - **URL / Endpoints:** kebab-case, danh từ số nhiều (ví dụ: `/api/v1/facilities`, `/api/v1/courts`, `/api/v1/bookings`)
  - **JSON Keys & Query Params:** snake_case (ví dụ: `facility_id`, `court_id`, `start_time`, `total_amount`)
- **Quy ước Tiền tệ & Thời gian:**
  - **Tiền tệ:** Số nguyên (integer, đơn vị VNĐ), không dùng số thập phân.
  - **Thời gian:** Chuẩn ISO 8601 UTC (`YYYY-MM-DDTHH:mm:ssZ`).
- **Cơ chế xác thực:** Bearer Token (JSON Web Token - JWT) HMAC-SHA256.
- **Phân quyền người dùng (User Roles):**
  - `customer`: Khách hàng tìm kiếm, đặt sân, xem ví cá nhân, hủy lịch và nhận hoàn cọc.
  - `owner`: Chủ cơ sở thể thao quản lý cụm cơ sở (`facilities`), sân con (`courts`), giờ mở cửa, bảng giá theo thời điểm, xem lịch đặt và ví chủ sân.
  - `admin`: Quản trị viên cấp cao, quản lý tài khoản và cấp tiền vào ví người dùng (QĐ6).

---

## 📌 QUY CHUẨN THIẾT KẾ BẮT BUỘC

### 1. Quy chuẩn Database Transaction (ACID & Concurrency Control)
Tất cả các endpoint có thao tác **thay đổi số dư ví, tạo dòng tiền (sổ cái `wallet_transactions`), thay đổi trạng thái khung giờ (khóa lịch/mở lịch đặt sân trong `bookings` và `booking_slots`)** BẮT BUỘC phải thực thi trong **MỘT Database Transaction duy nhất**:
* Sử dụng cơ chế khóa dòng dữ liệu (`SELECT ... FOR UPDATE` trong SQLAlchemy / MySQL InnoDB) khi kiểm tra khung giờ và số dư ví để triệt tiêu hoàn toàn lỗi **Race Condition / Đặt trùng lịch (Overbooking - QĐ3)**.
* Khi thao tác chuyển tiền giữa hai ví (ví khách ↔ ví hệ thống ↔ ví chủ sân), luôn khóa các dòng ví theo thứ tự **`wallet.id` tăng dần** để chống Deadlock.
* Nếu bất kỳ bước nào trong chuỗi xử lý thất bại (ví dụ: số dư ví không đủ 30% tiền cọc, khung giờ vừa bị khách khác đặt trước, lỗi hệ thống), toàn bộ tiến trình phải được **Rollback**.

### 2. Quy chuẩn Frontend Zero-Math (Tính toán tập trung 100% tại Backend)
Frontend **TUYỆT ĐỐI KHÔNG TỰ TÍNH TOÁN** bất kỳ phép tính tiền cọc, phụ phí, hệ số nhân giờ cao điểm, hoặc tỉ lệ hoàn tiền nào:
* **Endpoint tính tiền (`POST /bookings/calculate-price`):** Server bóc tách và trả về đầy đủ từng thành phần: Giá cơ sở, hệ số cao điểm/ngày lễ, tổng tiền khung giờ, phụ phí dịch vụ, tổng thanh toán, tỉ lệ cọc (30%), số tiền cọc bắt buộc trừ ví, và số tiền còn lại phải thanh toán tại sân. Frontend chỉ việc nhận JSON và hiển thị trực tiếp lên giao diện.
* **Endpoint hủy sân (`GET /bookings/{id}/cancel-preview` & `POST /bookings/{id}/cancel`):** Server tự tính toán khoảng cách thời gian từ lúc bấm hủy đến giờ bắt đầu chơi (`hours_until_start`), đối chiếu các mốc quy định QĐ5 (≥24h: 80%, 12h–24h: 50%, <12h: 0%), trả về tỉ lệ hoàn, số tiền hoàn vào ví khách, số tiền bồi thường cho chủ sân, và câu thông báo hiển thị.

### 3. Cấu trúc Response & Error Envelope chuẩn (Task SCB-54)
Mọi phản hồi từ Backend đều tuân thủ cấu trúc chuẩn trong `api-conventions.md`:
* **Thành công (Đơn lẻ):** `{"success": true, "message": "...", "data": { ... }}`
* **Thành công (Danh sách phân trang):** `{"success": true, "message": "...", "data": [ ... ], "meta": { "page": 1, "limit": 10, "total": 45, "total_pages": 5 }}`
* **Lỗi (HTTP Status >= 400):** `{"success": false, "error": { "code": "SLOT_ALREADY_BOOKED", "message": "...", "details": null }}`

---

## DANH SÁCH ENDPOINTS CHI TIẾT THEO EPIC

---

### 🟢 EPIC 1: XÁC THỰC VÀ PHÂN QUYỀN (AUTH & USER MANAGEMENT)

#### 1.1 Đăng ký tài khoản mới
* **Endpoint:** `POST /api/v1/auth/register`
* **Mô tả:** Đăng ký tài khoản mới cho Khách hàng (`customer`) hoặc Chủ sân (`owner`). Mật khẩu được mã hóa Bcrypt. Tự động khởi tạo một Ví nội bộ với số dư ban đầu bằng 0 VNĐ.
* **Quyền truy cập:** Public (Mọi người).
* **Database Transaction:** **BẮT BUỘC** (Tạo bản ghi `users` và bản ghi `wallets` trong cùng một transaction).
* **Request Body:**
  ```json
  {
    "full_name": "Nguyễn Văn A",
    "email": "customer@example.com",
    "phone": "0901234567",
    "password": "SecurePassword123@",
    "role": "customer" // "customer" hoặc "owner"
  }
  ```
* **Response (201 Created):**
  ```json
  {
    "success": true,
    "message": "Đăng ký tài khoản thành công.",
    "data": {
      "user_id": 12,
      "full_name": "Nguyễn Văn A",
      "email": "customer@example.com",
      "phone": "0901234567",
      "role": "customer",
      "wallet_id": 12,
      "wallet_balance": 0
    }
  }
  ```

#### 1.2 Đăng nhập hệ thống
* **Endpoint:** `POST /api/v1/auth/login`
* **Mô tả:** Xác thực thông tin qua email/mật khẩu, cấp mã Access Token JWT.
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
      "access_token": "eyJhbGciOiJIUzI1NiIsIn...",
      "token_type": "bearer",
      "user": {
        "id": 12,
        "full_name": "Nguyễn Văn A",
        "email": "customer@example.com",
        "role": "customer"
      }
    }
  }
  ```

#### 1.3 Lấy thông tin hồ sơ & Số dư ví hiện tại
* **Endpoint:** `GET /api/v1/auth/me`
* **Mô tả:** Trả về thông tin hồ sơ và số dư ví của tài khoản đang đăng nhập.
* **Quyền truy cập:** Đã đăng nhập (`customer`, `owner`, `admin`).
* **Database Transaction:** Không.
* **Response (200 OK):**
  ```json
  {
    "success": true,
    "message": "Lấy thông tin tài khoản thành công.",
    "data": {
      "id": 12,
      "full_name": "Nguyễn Văn A",
      "email": "customer@example.com",
      "phone": "0901234567",
      "role": "customer",
      "wallet": {
        "wallet_id": 12,
        "balance": 500000
      }
    }
  }
  ```

---

### 🟢 EPIC 2: QUẢN LÝ CƠ SỞ THỂ THAO & BẢNG GIÁ (FACILITIES, COURTS & PRICING - QĐ1)

> **Lưu ý kiến trúc CSDL:** Cụm cơ sở kinh doanh thể thao là **`facilities`**, các sân đấu con bên trong là **`courts`** (theo chuẩn `database-entities.md`).

#### 2.1 Tra cứu danh sách cơ sở thể thao (Facilities)
* **Endpoint:** `GET /api/v1/facilities`
* **Mô tả:** Tìm kiếm và lọc cơ sở thể thao theo môn thi đấu (`sport_id`), quận/huyện, tên sân. Trả về tọa độ địa lý (`latitude`, `longitude`) để vẽ điểm ghim trên bản đồ Leaflet / OpenStreetMap.
* **Quyền truy cập:** Public.
* **Query Params:** `sport_id`, `district`, `search`, `page=1`, `limit=10`.
* **Database Transaction:** Không.
* **Response (200 OK):**
  ```json
  {
    "success": true,
    "message": "Lấy danh sách cơ sở thể thao thành công.",
    "data": [
      {
        "id": 1,
        "name": "Cơ Sở Cầu Lông & Pickleball Kỳ Hòa",
        "owner_id": 3,
        "address": "238 Ba Tháng Hai, Phường 12, Quận 10, TP.HCM",
        "district": "Quận 10",
        "latitude": 10.771921,
        "longitude": 106.671042,
        "open_time": "06:00:00",
        "close_time": "23:00:00",
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
      "address": "238 Ba Tháng Hai, Phường 12, Quận 10, TP.HCM",
      "district": "Quận 10",
      "latitude": 10.771921,
      "longitude": 106.671042,
      "open_time": "06:00:00",
      "close_time": "23:00:00",
      "courts": [
        {
          "id": 101,
          "name": "Sân Cầu Lông 1 (Thảm Yonex)",
          "court_type": "INDOOR",
          "sport_id": 1,
          "is_active": true
        },
        {
          "id": 102,
          "name": "Sân Cầu Lông 2 (Thảm Yonex)",
          "court_type": "INDOOR",
          "sport_id": 1,
          "is_active": true
        }
      ]
    }
  }
  ```

#### 2.3 Tạo cơ sở thể thao mới (Dành cho Chủ sân)
* **Endpoint:** `POST /api/v1/facilities`
* **Mô tả:** Chủ sân đăng ký cơ sở thể thao mới, địa chỉ và giờ mở/đóng cửa hoạt động.
* **Quyền truy cập:** `owner`.
* **Database Transaction:** **BẮT BUỘC** (Tạo bản ghi `facilities` và gắn `owner_id = current_user.id`).
* **Request Body:**
  ```json
  {
    "name": "Cơ Sở Cầu Lông Tân Bình",
    "address": "123 Hoàng Hoa Thám, Phường 13, Quận Tân Bình",
    "district": "Tân Bình",
    "latitude": 10.799200,
    "longitude": 106.650100,
    "open_time": "06:00:00",
    "close_time": "23:00:00"
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
      "open_time": "06:00:00",
      "close_time": "23:00:00"
    }
  }
  ```

#### 2.4 Lấy danh sách sân con của một cơ sở
* **Endpoint:** `GET /api/v1/facilities/{id}/courts`
* **Mô tả:** Lấy danh sách toàn bộ các sân con thuộc cơ sở chỉ định (hỗ trợ chủ cơ sở quản trị hoặc khách hàng xem).
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
        "court_type": "INDOOR",
        "is_active": true
      },
      {
        "id": 102,
        "facility_id": 1,
        "name": "Sân Cầu Lông 2 (Thảm Yonex)",
        "sport_id": 1,
        "court_type": "INDOOR",
        "is_active": true
      }
    ]
  }
  ```

#### 2.5 Tạo sân con trực thuộc cơ sở thể thao
* **Endpoint:** `POST /api/v1/facilities/{id}/courts`
* **Mô tả:** Thêm sân con mới vào cơ sở thể thao, thiết lập giá cơ sở và khung giờ hoạt động.
* **Quyền truy cập:** `owner` (chủ sở hữu cơ sở thể thao).
* **Database Transaction:** **BẮT BUỘC** (Tạo bản ghi `courts` và khởi tạo các bản ghi `court_slots` ban đầu).
* **Request Body:**
  ```json
  {
    "name": "Sân 1 - Thảm Tiêu Chuẩn",
    "sport_id": 1,
    "court_type": "INDOOR",
    "default_price": 100000
  }
  ```
* **Response (201 Created):**
  ```json
  {
    "success": true,
    "message": "Tạo sân con thành công.",
    "data": {
      "court_id": 105,
      "facility_id": 5,
      "name": "Sân 1 - Thảm Tiêu Chuẩn",
      "court_type": "INDOOR",
      "is_active": true
    }
  }
  ```

#### 2.6 Xem chi tiết một sân con cụ thể (Courts)
* **Endpoint:** `GET /api/v1/courts/{court_id}`
* **Mô tả:** Lấy thông tin chi tiết một sân con cụ thể phục vụ trang quản trị của Chủ sân hoặc xem chi tiết sân.
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
      "facility_name": "Cơ Sở Cầu Lông & Pickleball Kỳ Hòa",
      "name": "Sân Cầu Lông 1 (Thảm Yonex)",
      "sport_id": 1,
      "sport_name": "Cầu Lông",
      "court_type": "INDOOR",
      "is_active": true,
    }
  }
  ```

#### 2.7 Cập nhật thông tin sân con (Dành cho Chủ sân)
* **Endpoint:** `PATCH /api/v1/courts/{court_id}`
* **Mô tả:** Chủ cơ sở điều chỉnh tên sân, hoặc bật/tắt trạng thái (`is_active = false` tạm ngừng đặt sân).
* **Quyền truy cập:** `owner` (chủ sở hữu sân con).
* **Database Transaction:** Không (hoặc Bắt buộc nếu cập nhật lại cấu hình slot giờ).
* **Request Body:**
  ```json
  {
    "name": "Sân Cầu Lông 1 (Thảm Yonex Nâng Cấp)",
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
* **Mô tả:** Thiết lập quy tắc nhân giá cho giờ cao điểm (`PEAK_HOUR`), cuối tuần (`WEEKEND`), ngày lễ (`HOLIDAY`). Khi nhiều quy tắc cùng khớp, hệ thống chọn `MAX(multiplier)`.
* **Quyền truy cập:** `owner` (chủ sở hữu cơ sở thể thao).
* **Database Transaction:** **BẮT BUỘC** (Vô hiệu quy tắc cũ và thêm các quy tắc `pricing_rules` mới).
* **Request Body:**
  ```json
  {
    "court_id": null, // null áp dụng cho toàn bộ sân thuộc cơ sở, hoặc truyền court_id cụ thể
    "rules": [
      {
        "rule_type": "PEAK_HOUR",
        "description": "Giờ vàng 17h-21h các ngày trong tuần",
        "start_time": "17:00:00",
        "end_time": "21:00:00",
        "day_of_week": null,
        "multiplier": 1.30 // Tăng 30% theo QĐ1
      },
      {
        "rule_type": "WEEKEND",
        "description": "Cả ngày Thứ Bảy và Chủ Nhật",
        "start_time": "06:00:00",
        "end_time": "22:00:00",
        "day_of_week": 6, // 6: Thứ Bảy, 7: Chủ Nhật
        "multiplier": 1.40 // Tăng 40% theo QĐ1
      },
      {
        "rule_type": "HOLIDAY",
        "description": "Ngày lễ",
        "start_time": "06:00:00",
        "end_time": "22:00:00",
        "day_of_week": null,
        "multiplier": 1.50 // Tăng 50% theo QĐ1
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
      "facility_id": 5,
      "total_rules_active": 3
    }
  }
  ```

---

### 🟢 EPIC 3: LỊCH TRỐNG, TÍNH TIỀN VÀ ĐẶT SÂN (BOOKINGS & SLOT LOCK)

#### 3.1 Xem sơ đồ khung giờ trống theo ngày của sân con
* **Endpoint:** `GET /api/v1/courts/{court_id}/slots`
* **Mô tả:** Lấy danh sách toàn bộ các khung giờ trong ngày chỉ định (`date=YYYY-MM-DD`). Trả về trạng thái khung giờ: `AVAILABLE` (Trống), `HOLDING` (Đang giữ chỗ chờ cọc), `BOOKED` (Đã đặt cọc).
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
          "slot_id": 1,
          "start_time": "16:00:00",
          "end_time": "17:00:00",
          "base_price": 100000,
          "status": "AVAILABLE"
        },
        {
          "slot_id": 2,
          "start_time": "17:00:00",
          "end_time": "18:00:00",
          "base_price": 100000,
          "status": "BOOKED" // Đã có người đặt cọc (QĐ3)
        },
        {
          "slot_id": 3,
          "start_time": "18:00:00",
          "end_time": "19:00:00",
          "base_price": 100000,
          "status": "AVAILABLE"
        }
      ]
    }
  }
  ```

#### 3.2 Xem trước tính tiền đặt sân và tiền cọc (Frontend Zero-Math)
* **Endpoint:** `POST /api/v1/bookings/calculate-price`
* **Mô tả:** **Server tính toán toàn bộ chi phí theo QĐ1, QĐ2, QĐ4**. Frontend tuyệt đối không tự tính mà chỉ việc hiển thị dữ liệu từ API này lên màn hình xác nhận đặt sân.
* **Quyền truy cập:** Đã đăng nhập (`customer`).
* **Database Transaction:** Không.
* **Request Body:**
  ```json
  {
    "court_id": 101,
    "play_date": "2026-11-10",
    "time_slot_ids": [3, 4], // Ví dụ 2 slot: 18:00-19:00 và 19:00-20:00
    "service_ids": [1] // Thuê thêm vợt/nước uống (nếu có)
  }
  ```
* **Response Payload (Frontend chỉ hiển thị, không tự tính):**
  ```json
  {
    "success": true,
    "message": "Tính toán tiền đặt sân thành công.",
    "data": {
      "court_id": 101,
      "court_name": "Sân Cầu Lông 1",
      "facility_name": "Cơ Sở Cầu Lông & Pickleball Kỳ Hòa",
      "play_date": "2026-11-10",
      "time_range": "18:00 - 20:00 (2 khung giờ)",
      "pricing_breakdown": {
        "base_price_per_slot": 100000,
        "is_peak_hour": true,
        "applied_multiplier": 1.30,
        "price_per_slot_effective": 130000,
        "total_court_amount": 260000,
        "total_services_amount": 20000,
        "grand_total_amount": 280000 // Tổng tiền theo QĐ2
      },
      "deposit_policy": {
        "policy_rule": "QĐ4 - Bắt buộc đặt cọc 30% tổng tiền qua ví nội bộ",
        "deposit_percentage": 30,
        "deposit_amount_required": 84000, // 280.000 * 30% = 84.000 VNĐ
        "remaining_amount_due_at_court": 196000 // 70% thanh toán tại sân
      },
      "user_wallet_status": {
        "current_balance": 200000,
        "is_balance_sufficient": true,
        "balance_after_deposit": 116000
      }
    }
  }
  ```

#### 3.3 Đặt sân và trừ cọc 30% từ ví nội bộ (Áp dụng QĐ2, QĐ3, QĐ4, QĐ6, QĐ7)
* **Endpoint:** `POST /api/v1/bookings`
* **Mô tả:** Tiến hành đặt sân chính thức và thanh toán cọc 30%.
* **Quyền truy cập:** Đã đăng nhập (`customer`).
* **Database Transaction:** **BẮT BUỘC (ACID TRANSACTION VỚI SELECT ... FOR UPDATE)**
  * **Bước 1:** Khóa hàng (`SELECT ... FOR UPDATE`) các khung giờ trong `court_slots` và kiểm tra ràng buộc duy nhất trong `booking_slots` (`court_id`, `play_date`, `time_slot_id`, `active_key=1`). Nếu khung giờ đã bị giữ/đặt -> Rollback và báo lỗi `409 Conflict` (Mã lỗi `SLOT_ALREADY_BOOKED`).
  * **Bước 2:** Khóa hàng ví khách hàng (`wallets.id`) và ví hệ thống trung gian (`is_system = true`) theo thứ tự `wallet.id` tăng dần (tránh Deadlock).
  * **Bước 3:** Kiểm tra số dư ví khách (`balance >= deposit_amount_required`). Nếu thiếu tiền -> Rollback và báo lỗi `400 Bad Request` (Mã lỗi `WALLET_INSUFFICIENT_BALANCE`).
  * **Bước 4:** Trừ tiền ví khách (`balance = balance - :deposit`) và cộng tiền vào ví giữ cọc trung gian của hệ thống (`balance = balance + :deposit`).
  * **Bước 5:** Ghi bản ghi vào sổ cái `wallet_transactions` với `type = 'DEPOSIT'`, lưu `related_booking_id`.
  * **Bước 6:** Tạo bản ghi `bookings` trạng thái `DEPOSITED` (QĐ7) và các bản ghi `booking_slots` tương ứng với `active_key = 1` (QĐ3).
  * **Bước 7:** Commit Transaction.
* **Request Body:**
  ```json
  {
    "court_id": 101,
    "play_date": "2026-11-10",
    "time_slot_ids": [3, 4],
    "service_ids": [1],
    "note": "Đặt trận đấu giao lưu tối thứ Ba"
  }
  ```
* **Response (201 Created):**
  ```json
  {
    "success": true,
    "message": "Đặt sân và trừ tiền cọc 30% thành công.",
    "data": {
      "booking_id": 105,
      "booking_code": "BK-20261110-0105",
      "court_id": 101,
      "court_name": "Sân Cầu Lông 1",
      "play_date": "2026-11-10",
      "start_at": "2026-11-10T18:00:00Z",
      "end_at": "2026-11-10T20:00:00Z",
      "total_amount": 280000,
      "deposit_amount_paid": 84000,
      "remaining_amount_at_court": 196000,
      "status": "DEPOSITED",
      "wallet_balance_remaining": 116000
    }
  }
  ```

---

### 🟢 EPIC 4: HỦY SÂN VÀ HOÀN CỌC TỰ ĐỘNG (CANCELLATION & REFUND - QĐ5, QĐ7)

#### 4.1 Xem trước số tiền hoàn khi hủy lịch (Frontend Zero-Math)
* **Endpoint:** `GET /api/v1/bookings/{id}/cancel-preview`
* **Mô tả:** **Server tính toán toàn bộ số tiền hoàn trả theo QĐ5**. Đo khoảng cách từ thời điểm hiện tại (`:now`) đến giờ bắt đầu chơi (`start_at`) và trả về chi tiết chính sách hoàn cọc để Frontend hiển thị hộp thoại xác nhận.
* **Quyền truy cập:** Đã đăng nhập (`customer` sở hữu đơn đặt).
* **Database Transaction:** Không.
* **Response Payload (Frontend chỉ hiển thị, không tự tính):**
  ```json
  {
    "success": true,
    "message": "Tính toán chính sách hoàn cọc thành công.",
    "data": {
      "booking_id": 105,
      "booking_code": "BK-20261110-0105",
      "deposit_amount_paid": 84000,
      "schedule_info": {
        "play_date": "2026-11-10",
        "start_at": "2026-11-10T18:00:00Z"
      },
      "cancellation_evaluation": {
        "evaluated_at": "2026-11-09T10:00:00Z",
        "hours_until_start": 32.0,
        "rule_matched": "QĐ5.1 - Hủy từ 24 giờ trở lên trước giờ chơi (Hoàn 80% cọc)",
        "refund_percentage": 80,
        "penalty_percentage": 20
      },
      "financial_result": {
        "refund_amount_to_player": 67200, // 84.000 * 80% = 67.200 VNĐ
        "penalty_amount_to_facility": 16800, // 84.000 * 20% = 16.800 VNĐ
        "customer_display_message": "Bạn đang yêu cầu hủy trước 32.0 giờ. Theo quy định QĐ5, bạn sẽ được hoàn lại 80% tiền cọc (67.200 VNĐ) vào ví nội bộ ngay lập tức."
      }
    }
  }
  ```

#### 4.2 Thực hiện hủy lịch và hoàn cọc tự động (Áp dụng QĐ5, QĐ6, QĐ7)
* **Endpoint:** `POST /api/v1/bookings/{id}/cancel`
* **Mô tả:** Xác nhận hủy đơn đặt sân, tự động hoàn cọc vào ví khách và bồi thường cho chủ cơ sở.
* **Quyền truy cập:** Đã đăng nhập (`customer` sở hữu đơn hoặc `admin`).
* **Database Transaction:** **BẮT BUỘC (ACID TRANSACTION VỚI ROW LOCKING)**
  * **Bước 1:** Khóa hàng (`SELECT ... FOR UPDATE`) đơn đặt trong bảng `bookings`. Kiểm tra trạng thái hiện tại (nếu khác `DEPOSITED` hoặc `:now >= start_at` -> Rollback báo lỗi `400 Bad Request`).
  * **Bước 2:** Tính toán lại khoảng cách `hours_until_start = (start_at - :now)` để áp dụng tỉ lệ hoàn QĐ5:
    * `hours_until_start >= 24h`: Hoàn 80% (`refund = deposit * 80 DIV 100`).
    * `12h <= hours_until_start < 24h`: Hoàn 50% (`refund = deposit * 50 DIV 100`).
    * `< 12h`: Hoàn 0% (`refund = 0`).
    * `forfeit = deposit - refund` (tiền phạt cọc đền bù chủ sân).
  * **Bước 3:** Khóa hàng các ví liên quan (ví hệ thống, ví khách, ví chủ cơ sở) theo thứ tự `wallet.id` tăng dần.
  * **Bước 4:** Trừ số dư ví hệ thống trung gian (`balance = balance - deposit_amount_paid`).
  * **Bước 5:** Nếu `refund > 0`: Cộng `refund` vào ví khách hàng và ghi bản ghi `wallet_transactions` loại `REFUND`.
  * **Bước 6:** Nếu `forfeit > 0`: Cộng `forfeit` vào ví chủ cơ sở (`facility.owner_id`) và ghi bản ghi `wallet_transactions` loại `FORFEIT`.
  * **Bước 7:** Cập nhật `bookings`: `status = 'CANCELLED'`, `cancelled_at = :now`.
  * **Bước 8:** Cập nhật `booking_slots`: `released_at = :now`, `active_key` tự chuyển về `NULL` để mở lại khung giờ cho người khác đặt (QĐ3).
  * **Bước 9:** Commit Transaction.
* **Request Body:**
  ```json
  {
    "cancellation_reason": "Bận việc gia đình đột xuất"
  }
  ```
* **Response (200 OK):**
  ```json
  {
    "success": true,
    "message": "Hủy đơn đặt sân thành công. Tiền cọc đã được hoàn trả tự động theo quy định.",
    "data": {
      "booking_id": 105,
      "booking_code": "BK-20261110-0105",
      "status": "CANCELLED",
      "hours_before_start": 32.0,
      "refund_percentage": 80,
      "refunded_to_customer_wallet": 67200,
      "compensated_to_facility_wallet": 16800,
      "customer_new_wallet_balance": 183200
    }
  }
  ```

#### 4.3 Xác nhận hoàn tất buổi chơi & Kết toán cọc cho chủ sân
* **Endpoint:** `POST /api/v1/bookings/{id}/complete`
* **Mô tả:** Khi khách hàng đến nhận sân và hoàn tất buổi chơi (điều kiện `:now >= start_at`), Chủ cơ sở hoặc Hệ thống bấm xác nhận hoàn tất. Toàn bộ khoản tiền cọc 30% đang được giữ ở Ví hệ thống sẽ được **kết toán chuyển sang Ví của Chủ cơ sở (`SETTLE`)**, đơn chuyển sang trạng thái `COMPLETED` (QĐ7).
* **Quyền truy cập:** `owner` (chủ sở hữu cơ sở thể thao) hoặc `admin`.
* **Database Transaction:** **BẮT BUỘC (ACID TRANSACTION VỚI ROW LOCKING)**
  * **Bước 1:** Kiểm tra điều kiện thời gian: `:now >= start_at` (buổi chơi đã bắt đầu hoặc kết thúc). Nếu chưa đến giờ -> Báo lỗi `400 Bad Request` ("Chưa đến giờ chơi, không thể kết toán").
  * **Bước 2:** Khóa hàng (`SELECT ... FOR UPDATE`) đơn đặt `bookings`. Kiểm tra `status == 'DEPOSITED'`.
  * **Bước 3:** Khóa hàng ví hệ thống trung gian (`is_system = true`) và ví chủ cơ sở (`facility.owner_id`) theo thứ tự `wallet.id` tăng dần.
  * **Bước 4:** Trừ số dư ví hệ thống: `balance = balance - deposit_amount`.
  * **Bước 5:** Cộng số dư ví chủ cơ sở: `balance = balance + deposit_amount`.
  * **Bước 6:** **Ghi bản ghi vào sổ cái `wallet_transactions` với `type = 'SETTLE'`** (`from_wallet_id = ví hệ thống`, `to_wallet_id = ví chủ sân`, `related_booking_id = booking.id`).
  * **Bước 7:** Cập nhật `bookings`: `status = 'COMPLETED'`.
  * **Bước 8:** Commit Transaction.
* **Request Body:** Không yêu cầu (hoặc kèm ghi chú check-in tùy chọn).
* **Response (200 OK):**
  ```json
  {
    "success": true,
    "message": "Xác nhận hoàn tất buổi chơi và kết toán tiền cọc cho chủ sân thành công.",
    "data": {
      "booking_id": 105,
      "booking_code": "BK-20261110-0105",
      "status": "COMPLETED",
      "settled_deposit_amount": 84000,
      "transferred_to_owner_wallet_id": 3,
      "transaction_type": "SETTLE"
    }
  }
  ```


---

### 🟢 EPIC 5: VÍ NỘI BỘ VÀ LỊCH SỬ DÒNG TIỀN (WALLETS & TRANSACTIONS - QĐ6)

#### 5.1 Tra cứu số dư ví & Lịch sử biến động số dư
* **Endpoint:** `GET /api/v1/wallets/me`
* **Mô tả:** Lấy thông tin ví và danh sách các giao dịch phát sinh (cọc, hoàn cọc, nạp tiền) của người dùng hiện tại.
* **Quyền truy cập:** Đã đăng nhập (`customer`, `owner`).
* **Database Transaction:** Không.
* **Response (200 OK):**
  ```json
  {
    "success": true,
    "message": "Lấy thông tin ví thành công.",
    "data": {
      "wallet_id": 12,
      "current_balance": 183200,
      "transactions": [
        {
          "transaction_id": 501,
          "type": "REFUND",
          "amount": 67200,
          "balance_after": 183200,
          "related_booking_code": "BK-20261110-0105",
          "description": "Hoàn 80% tiền cọc hủy đơn đặt sân",
          "created_at": "2026-11-09T10:05:00Z"
        },
        {
          "transaction_id": 480,
          "type": "DEPOSIT",
          "amount": -84000,
          "balance_after": 116000,
          "related_booking_code": "BK-20261110-0105",
          "description": "Đặt cọc 30% đơn đặt sân",
          "created_at": "2026-11-08T15:00:00Z"
        },
        {
          "transaction_id": 401,
          "type": "TOPUP",
          "amount": 200000,
          "balance_after": 200000,
          "related_booking_code": null,
          "description": "Nạp tiền",
          "created_at": "2026-11-01T09:00:00Z"
        }
      ]
    }
  }
  ```

#### 5.2 Admin cấp tiền vào ví người dùng (QĐ6)
* **Endpoint:** `POST /api/v1/admin/wallets/grant`
* **Mô tả:** Quản trị viên cấp số dư vào ví cho người dùng.
* **Quyền truy cập:** `admin`.
* **Database Transaction:** **BẮT BUỘC** (Cộng số dư ví và ghi bản ghi `wallet_transactions` loại `TOPUP`).
* **Request Body:**
  ```json
  {
    "user_id": 12,
    "amount": 500000,
    "reason": "Nạp số dư tài khoản"
  }
  ```
* **Response (200 OK):**
  ```json
  {
    "success": true,
    "message": "Nạp tiền vào ví thành công.",
    "data": {
      "user_id": 12,
      "granted_amount": 500000,
      "new_balance": 683200
    }
  }
  ```

---

### 🟢 EPIC 6: BÀI ĐĂNG TÌM ĐỒNG ĐỘI (MATCHMAKING)

#### 6.1 Xem danh sách bài đăng tìm người chơi
* **Endpoint:** `GET /api/v1/matches`
* **Mô tả:** Lấy danh sách các bài đăng tìm đồng đội ghép trận (lọc theo môn, cơ sở, khu vực, trình độ).
* **Quyền truy cập:** Public.
* **Database Transaction:** Không.
* **Response (200 OK):**
  ```json
  {
    "success": true,
    "message": "Lấy danh sách bài đăng ghép trận thành công.",
    "data": [
      {
        "id": 1,
        "title": "Cần tìm 2 bạn đánh đôi cầu lông trình độ trung bình khá",
        "sport_id": 1,
        "facility_name": "Cơ Sở Cầu Lông Tân Bình",
        "play_date": "2026-11-10",
        "start_time": "18:00:00",
        "end_time": "20:00:00",
        "slots_needed": 2,
        "slots_joined": 1
      }
    ]
  }
  ```

#### 6.2 Đăng bài tìm đồng đội
* **Endpoint:** `POST /api/v1/matches`
* **Mô tả:** Người chơi tạo bài đăng tìm kiếm người ghép đội giao lưu.
* **Quyền truy cập:** `customer`.
* **Database Transaction:** Không.
* **Request Body:**
  ```json
  {
    "title": "Cần tìm 2 bạn đánh đôi cầu lông trình độ trung bình khá",
    "sport_id": 1,
    "facility_id": 5,
    "play_date": "2026-11-10",
    "start_time": "18:00:00",
    "end_time": "20:00:00",
    "slots_needed": 2
  }
  ```
* **Response (201 Created):**
  ```json
  {
    "success": true,
    "message": "Đăng bài tìm đồng đội thành công.",
    "data": {
      "match_id": 10,
      "title": "Cần tìm 2 bạn đánh đôi cầu lông trình độ trung bình khá",
      "slots_needed": 2
    }
  }
  ```

#### 6.3 Đăng ký tham gia ghép trận
* **Endpoint:** `POST /api/v1/matches/{id}/join`
* **Mô tả:** Người chơi đăng ký một suất tham gia trận đấu.
* **Quyền truy cập:** `customer`.
* **Database Transaction:** **BẮT BUỘC** (Khóa dòng bài đăng `SELECT ... FOR UPDATE` để kiểm tra `slots_joined < slots_needed`, chống nhận vượt quá số người cần).
* **Response (200 OK):**
  ```json
  {
    "success": true,
    "message": "Đăng ký tham gia ghép trận thành công.",
    "data": {
      "match_id": 10,
      "remaining_slots": 0,
      "status": "FULL"
    }
  }
  ```

---

## 📋 BẢNG TỔNG HỢP HTTP STATUS CODES & BUSINESS ERROR CODES (THEO TASK SCB-54)

| Mã lỗi (`code`) | HTTP Status | Trường hợp phát sinh |
| :--- | :---: | :--- |
| `VALIDATION_ERROR` | **422** | Dữ liệu gửi lên sai định dạng Schema (Pydantic validation). |
| `AUTH_INVALID_CREDENTIALS` | **401** | Email hoặc mật khẩu không chính xác. |
| `AUTH_TOKEN_EXPIRED` | **401** | Access token JWT đã hết hạn. |
| `AUTH_FORBIDDEN` | **403** | Không đủ quyền truy cập (ví dụ: `customer` cố tình gọi API tạo cơ sở của `owner`). |
| `FACILITY_NOT_FOUND` | **404** | Không tìm thấy cơ sở thể thao yêu cầu. |
| `COURT_NOT_FOUND` | **404** | Không tìm thấy sân con yêu cầu. |
| `SLOT_ALREADY_BOOKED` | **409** | Khung giờ đã có khách khác đặt cọc hoặc đang giữ chỗ (chống trùng lịch QĐ3). |
| `WALLET_INSUFFICIENT_BALANCE` | **400** | Số dư ví không đủ 30% tiền cọc (QĐ4, QĐ6). |
| `REFUND_NOT_ELIGIBLE` | **400** | Hủy sân dưới 12 giờ trước giờ chơi: Không được hoàn cọc (QĐ5). |
| `BOOKING_NOT_FOUND` | **404** | Không tìm thấy đơn đặt sân. |
| `CANNOT_SETTLE_BEFORE_START` | **400** | Chưa đến giờ chơi, chưa thể kết toán cọc cho chủ sân. |
| `INTERNAL_SERVER_ERROR` | **500** | Lỗi máy chủ hoặc Database Exception. |
