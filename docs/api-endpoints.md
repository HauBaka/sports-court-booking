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
  - **Thời gian (Date & Time):** Chuẩn **ISO 8601 UTC** (`YYYY-MM-DDTHH:mm:ssZ`) đồng bộ cho toàn bộ hệ thống API theo quy ước tại `docs/api-conventions.md`. Client (Frontend) chịu trách nhiệm parse và hiển thị theo múi giờ địa phương của người dùng (Việt Nam UTC+7). Các mốc thời gian logic nghiệp vụ (10 phút giữ chỗ, hủy trước 12h/24h) được tính toán trên mốc UTC đồng nhất.
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

Epic API chia nhỏ hơn 5 chức năng trong `docs/project-proposal.md` (mục 3.1.1). Bảng ánh xạ:

| Chức năng (proposal) | Epic Jira | Epic API |
| --- | --- | --- |
| Nền tảng đăng nhập | SCB-67 | Epic 1 |
| 1 Quản lý sân và bảng giá | SCB-2 | Epic 2 |
| 2 Tìm và đặt sân | SCB-3 | Epic 3 |
| 3 Cọc và hoàn cọc qua ví | SCB-4 | Epic 4, Epic 5, mục 3.4 của Epic 3 |
| 4 Ghép đội | SCB-5 | Epic 6 |
| 5 Tiện ích | SCB-6 | Dịch vụ đi kèm (2.11 đến 2.13) nằm ở Epic 2, đánh giá và dashboard chưa có API |

---

### 🟢 EPIC 1: XÁC THỰC VÀ PHÂN QUYỀN (AUTH & USER MANAGEMENT)

#### 1.1 Đăng ký tài khoản mới
* **Endpoint:** `POST /api/v1/auth/register`
* **Mô tả:** Đăng ký tài khoản mới cho Khách hàng (`customer`) hoặc Chủ sân (`owner`). Trước khi gọi đăng ký, Client phải gọi `POST /api/v1/auth/otp` với `purpose = "REGISTER"` để nhận mã OTP 6 số qua email và gửi kèm `otp_code` để xác thực. Mật khẩu được mã hóa an toàn bằng Bcrypt. Tự động khởi tạo một Ví nội bộ với số dư ban đầu bằng 0 VNĐ.
* **Quyền truy cập:** Public.
* **Database Transaction:** **BẮT BUỘC**
  - **Tách riêng bước cập nhật số lần thử (Attempts):** Khi kiểm tra `otp_code`, nếu sai thì việc tăng `attempts` (và hủy mã nếu sai đủ 5 lần) **phải được commit riêng biệt trước khi trả về lỗi 400**. Ở lần sai thứ 5, hệ thống hủy mã và trả về `AUTH_OTP_TOO_MANY_ATTEMPTS`; các lần thử tiếp theo trả về `AUTH_OTP_INVALID`. Không gộp vào transaction chính để tránh việc rollback làm mất số lần nhập sai dẫn đến lỗ hổng brute-force thử vô hạn lần.
  - **Transaction chính:** Chỉ khi `otp_code` hợp lệ, transaction chính mới bắt đầu để thực hiện đồng thời: (1) hủy/đánh dấu đã dùng mã OTP, (2) tạo bản ghi `users`, và (3) tạo bản ghi `wallets`.
* **Request Body:**
```json
{
  "name": "Nguyễn Văn A",
  "email": "customer@example.com",
  "phone": "0901234567",
  "password": "SecurePassword123@",
  "role": "customer",
  "otp_code": "123456"
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
  - `400 Bad Request`: `AUTH_OTP_INVALID` (Mã OTP không chính xác hoặc đã bị hủy), `AUTH_OTP_EXPIRED` (Mã OTP đã hết hạn 5 phút), `AUTH_OTP_TOO_MANY_ATTEMPTS` (Nhập sai OTP đủ 5 lần; hệ thống hủy mã ở lần sai thứ 5, các lần thử tiếp theo trả `AUTH_OTP_INVALID`).
  - `409 Conflict`: `AUTH_EMAIL_EXISTS` (Email đã tồn tại) hoặc `AUTH_PHONE_EXISTS` (Số điện thoại đã tồn tại).
  - `422 Unprocessable Entity`: `VALIDATION_ERROR` (Sai định dạng email, mật khẩu yếu, `otp_code` không đúng 6 chữ số).

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

#### 1.5 Gửi mã xác thực OTP qua email
* **Endpoint:** `POST /api/v1/auth/otp`
* **Mô tả:** Gửi mã xác thực OTP gồm 6 chữ số qua email người dùng, phục vụ luồng Đăng ký tài khoản mới (`REGISTER`) hoặc Đặt lại mật khẩu (`RESET_PASSWORD`).
* **Quy chuẩn nghiệp vụ & Hiệu lực mã OTP:**
  - **Định dạng:** Mã số ngẫu nhiên gồm đúng **6 chữ số**.
  - **Thời hạn hiệu lực:** Mã có hạn trong **5 phút** kể từ thời điểm tạo.
  - **Số lần sử dụng:** Dùng **1 lần duy nhất** (single-use), sau khi xác thực thành công mã sẽ tự động bị xóa/hủy.
  - **Giãn cách gửi lại (Cooldown):** Tối thiểu **60 giây** giữa các lần yêu cầu gửi mã mới tính theo từng `email`. Cooldown áp dụng cho mọi email kể cả email không tồn tại trong hệ thống. Nếu gửi lại trước 60 giây, hệ thống trả lỗi `429 Too Many Requests` (`AUTH_OTP_TOO_SOON`).
  - **Cơ chế ghi đè:** Mỗi lần tạo mã OTP mới thành công sẽ lập tức thay thế và vô hiệu hóa mã cũ trước đó.
  - **Chống Brute-force:** Nhập sai **đủ 5 lần** thì hủy mã OTP. Ở lần nhập sai thứ 5, hệ thống hủy mã và trả lỗi `400 Bad Request` (`AUTH_OTP_TOO_MANY_ATTEMPTS`); các lần gọi tiếp theo trả lỗi `AUTH_OTP_INVALID`.
  - **Xử lý theo mục đích (`purpose`) & Bảo mật chống User Enumeration:**
    - `REGISTER`: Nếu email đã tồn tại trong hệ thống $\rightarrow$ trả về `409 Conflict` (`AUTH_EMAIL_EXISTS`), không tạo mã và không gửi email.
    - `RESET_PASSWORD`: Áp dụng cơ chế chống dò quét tài khoản người dùng:
      - Cooldown được tính theo email cho **cả email tồn tại lẫn email không tồn tại** (bảng `email_otps` không có ràng buộc khóa ngoại tới bảng `users`, nên hệ thống vẫn lưu dòng OTP để kích hoạt cooldown, chỉ bỏ qua bước gửi mail thực tế nếu email không có trong bảng `users`).
      - Nhờ vậy, khi gọi 2 lần liên tiếp: email có thật hay email không tồn tại thì lần 1 đều trả về `200 OK`, và lần 2 (nếu gọi lại trước 60 giây) đều trả về `429 Too Many Requests` (`AUTH_OTP_TOO_SOON`). Hành vi của API hoàn toàn đồng nhất, triệt tiêu khả năng kẻ tấn công dựa vào phản hồi để dò biết email nào đã đăng ký tài khoản.
* **Quyền truy cập:** Public.
* **Database Transaction:** Không.
* **Request Body:**
```json
{
  "email": "customer@example.com",
  "purpose": "REGISTER"
}
```
*(Hoặc `"purpose": "RESET_PASSWORD"`)*
* **Response (200 OK):**
```json
{
  "success": true,
  "message": "Mã xác thực OTP đã được gửi đến email của bạn.",
  "data": null
}
```
* **Mã lỗi phát sinh:**
  - `409 Conflict`: `AUTH_EMAIL_EXISTS` (Email đã tồn tại khi gửi OTP đăng ký).
  - `429 Too Many Requests`: `AUTH_OTP_TOO_SOON` (Gửi lại quá sớm khi chưa hết 60 giây giãn cách).
  - `422 Unprocessable Entity`: `VALIDATION_ERROR` (Sai định dạng email, `purpose` không hợp lệ).
  - `502 Bad Gateway`: `EMAIL_SEND_FAILED` (Nhà cung cấp email lỗi hoặc quá thời gian chờ). Hệ thống bỏ mã vừa tạo nên người dùng gọi lại ngay được, không bị tính cooldown.
* **Mã cố định khi phát triển:** Khi `EMAIL_BACKEND=console` và `ENVIRONMENT` khác `production`, mã OTP luôn là `123456` (dùng cho test, CI và Postman local). Ở `production` mã luôn ngẫu nhiên, kể cả khi `EMAIL_BACKEND=console`. Mã chỉ lưu dạng băm HMAC-SHA256 trong bảng `email_otps`.

#### 1.6 Đặt lại mật khẩu
* **Endpoint:** `POST /api/v1/auth/password/reset`
* **Mô tả:** Đặt lại mật khẩu mới cho tài khoản thông qua xác thực mã OTP 6 số đã gửi qua email. Mật khẩu mới bắt buộc phải tuân theo cùng quy tắc/luật mật khẩu của đăng ký (tối thiểu 8 ký tự, bao gồm chữ hoa, chữ thường, chữ số và ký tự đặc biệt). Đổi mật khẩu thành công sẽ vô hiệu hóa mã OTP.
* **Quyền truy cập:** Public.
* **Database Transaction:** **BẮT BUỘC**
  - **Tách riêng bước cập nhật số lần thử (Attempts):** Khi kiểm tra `otp_code`, nếu sai thì việc tăng `attempts` (và hủy mã nếu sai đủ 5 lần) **phải được commit riêng biệt trước khi trả về lỗi 400**. Ở lần sai thứ 5, hệ thống hủy mã và trả về `AUTH_OTP_TOO_MANY_ATTEMPTS`; các lần thử tiếp theo trả về `AUTH_OTP_INVALID`. Tuyệt đối không gộp chung vào transaction chính làm rollback bộ đếm attempts khi gặp lỗi, nhằm triệt tiêu nguy cơ brute-force thử OTP vô hạn.
  - **Transaction chính:** Chỉ khi `otp_code` hợp lệ, transaction chính mới bắt đầu để thực hiện đồng thời: (1) hủy/đánh dấu đã sử dụng mã OTP, và (2) cập nhật Bcrypt hash của mật khẩu mới cho tài khoản người dùng.
* **Request Body:**
```json
{
  "email": "customer@example.com",
  "otp_code": "123456",
  "new_password": "NewSecurePassword123@"
}
```
* **Response (200 OK):**
```json
{
  "success": true,
  "message": "Đặt lại mật khẩu thành công. Vui lòng đăng nhập lại với mật khẩu mới.",
  "data": null
}
```
* **Mã lỗi phát sinh:**
  - `400 Bad Request`: `AUTH_OTP_INVALID` (Mã OTP không chính xác hoặc đã bị hủy), `AUTH_OTP_EXPIRED` (Mã OTP đã hết hạn 5 phút), `AUTH_OTP_TOO_MANY_ATTEMPTS` (Nhập sai OTP đủ 5 lần; hệ thống hủy mã ở lần sai thứ 5, các lần thử tiếp theo trả `AUTH_OTP_INVALID`).
  - `422 Unprocessable Entity`: `VALIDATION_ERROR` (Sai định dạng email, `otp_code` không đúng 6 số, hoặc mật khẩu mới không đạt chuẩn bảo mật).

---

### 🟢 EPIC 2: QUẢN LÝ CƠ SỞ THỂ THAO, SÂN CON & BẢNG GIÁ (FACILITIES, COURTS & PRICING - QĐ1)

> **Lưu ý kiến trúc CSDL (`database-entities.md`):**
> - Bảng `facilities`: `(id, owner_id, name, address, city, district, latitude, longitude, open_time, close_time, description, is_active)`.
> - Bảng `facility_amenities`: danh mục tiện ích của cơ sở (wifi, bãi đỗ xe, căn tin...).
> - Bảng `courts`: `(id, facility_id, sport_id, name, court_type, environment, open_time, close_time, is_active)`. Chứa giờ mở/đóng cửa và môi trường thi đấu (`INDOOR`, `OUTDOOR`).
> - Bảng `court_photos`: lưu trữ URL hình ảnh sân con.
> - Bảng `court_schedules`: cấu hình lịch hoạt động chi tiết theo thứ trong tuần (`day_of_week`).
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
      "district": "Quận 10",
      "latitude": 10.771921,
      "longitude": 106.671042,
      "open_time": "06:00:00",
      "close_time": "23:00:00",
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
    "district": "Quận 10",
    "latitude": 10.771921,
    "longitude": 106.671042,
    "open_time": "06:00:00",
    "close_time": "23:00:00",
    "description": "Cơ sở thể thao hiện đại với thảm Yonex tiêu chuẩn thi đấu quốc tế.",
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
  "district": "Quận Tân Bình",
  "latitude": 10.7992,
  "longitude": 106.6501,
  "open_time": "06:00:00",
  "close_time": "23:00:00",
  "description": "Cơ sở cầu lông mới thành lập tại Tân Bình."
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
    "district": "Quận Tân Bình",
    "latitude": 10.7992,
    "longitude": 106.6501,
    "open_time": "06:00:00",
    "close_time": "23:00:00",
    "description": "Cơ sở cầu lông mới thành lập tại Tân Bình.",
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
* **Mô tả:** Chủ cơ sở điều chỉnh tên sân, giờ hoạt động hoặc bật/tắt trạng thái hoạt động (`is_active = false`).
* **Quyền truy cập:** `owner` (chủ sở hữu sân con).
* **Database Transaction:** **BẮT BUỘC (ACID TRANSACTION KHI THAY ĐỔI GIỜ HOẶC TRẠNG THÁI)**
  * **Xử lý khi cập nhật giờ hoạt động (`open_time`, `close_time`):**
    1. *Kiểm tra xung đột lịch đặt:* Quét bảng `bookings` và `booking_slots`. Nếu đang tồn tại các đơn đặt cọc **`DEPOSITED` trong tương lai** (`play_date >= CURRENT_DATE`) nằm ở các khung giờ bị cắt bỏ ngoài khoảng giờ mới ➔ **Từ chối cập nhật**, trả về lỗi `400 Bad Request` (Mã lỗi `CANNOT_UPDATE_COURT_SCHEDULE_ACTIVE_BOOKINGS`). Chủ sân phải liên hệ khách hàng dời lịch hoặc hủy đơn trước.
    2. *Đồng bộ cấu hình `court_slots`:* Nếu không có xung đột, cập nhật `courts.open_time`, `courts.close_time`, đồng thời tự động cập nhật cờ `is_active` trên bảng `court_slots` của sân: các slot ngoài khoảng `[open_time, close_time]` chuyển sang `is_active = false`; các slot trong khoảng chuyển sang `is_active = true` (hoặc chèn mới). Ràng buộc khóa ngoại ghép ở `booking_slots` nhờ đó luôn phản ánh đúng giờ mở cửa thực tế.
  * **Xử lý khi tạm ngưng hoạt động sân (`is_active = false`):**
    1. *Kiểm tra đơn cọc:* Nếu sân đang có lịch đặt `DEPOSITED` trong tương lai ➔ **Từ chối cập nhật**, trả về lỗi `400 Bad Request` (Mã lỗi `CANNOT_DEACTIVATE_COURT_ACTIVE_BOOKINGS`).
    2. *Hủy giữ chỗ tạm thời:* Cập nhật `courts.is_active = false`. Toàn bộ các đơn đang giữ chỗ tạm (`PENDING_DEPOSIT`) trên sân này được tự động hủy (`status = 'CANCELLED'`) và nhả slot (`released_at = :now`). Sân con bị ẩn khỏi danh sách nhận lịch mới trên `GET /courts/{id}/slots`.
* **Request Body:**
  ```json
  {
    "name": "Sân Cầu Lông 1 (Thảm Yonex Nâng Cấp)",
    "open_time": "06:00:00",
    "close_time": "23:30:00",
    "is_active": true
  }
  ```
* **Response (200 OK):**
  ```json
  {
    "success": true,
    "message": "Cập nhật thông tin sân con và đồng bộ khung giờ hoạt động thành công.",
    "data": {
      "id": 101,
      "name": "Sân Cầu Lông 1 (Thảm Yonex Nâng Cấp)",
      "open_time": "06:00:00",
      "close_time": "23:30:00",
      "is_active": true
    }
  }
  ```

#### 2.8 Cấu hình quy tắc giá theo thời điểm (Áp dụng QĐ1)
* **Endpoint:** `POST /api/v1/facilities/{id}/pricing-rules`
* **Mô tả:** Thiết lập quy tắc nhân giá cho giờ cao điểm (`PEAK_HOUR`), cuối tuần (`WEEKEND`), ngày lễ (`HOLIDAY`). Tuân thủ nghiêm ngặt ràng buộc CHECK của bảng `pricing_rules`. Khi nhiều quy tắc cùng khớp, hệ thống chọn `MAX(multiplier)`.
* **Quyền truy cập:** `owner` (chủ sở hữu cơ sở thể thao).
* **Database Transaction:** **BẮT BUỘC** (Xóa/thay thế các quy tắc cũ và chèn các quy tắc `pricing_rules` mới).
* **Request Body:**
  ```json
  {
    "rules": [
      {
        "name": "Giờ vàng 17h-21h các ngày trong tuần",
        "rule_type": "PEAK_HOUR",
        "multiplier": 1.30,
        "start_time": "17:00:00",
        "end_time": "21:00:00",
        "day_of_week": null,
        "holiday_id": null
      },
      {
        "name": "Ngày Thứ Bảy",
        "rule_type": "WEEKEND",
        "multiplier": 1.40,
        "start_time": null,
        "end_time": null,
        "day_of_week": 6,
        "holiday_id": null
      },
      {
        "name": "Ngày Chủ Nhật",
        "rule_type": "WEEKEND",
        "multiplier": 1.40,
        "start_time": null,
        "end_time": null,
        "day_of_week": 7,
        "holiday_id": null
      },
      {
        "name": "Tết Dương Lịch",
        "rule_type": "HOLIDAY",
        "multiplier": 1.50,
        "start_time": null,
        "end_time": null,
        "day_of_week": null,
        "holiday_id": 1
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
      "total_rules_active": 4
    }
  }
  ```


#### 2.8b Xem quy tắc giá hiện tại của cơ sở
* **Endpoint:** `GET /api/v1/facilities/{id}/pricing-rules`
* **Mô tả:** Trả toàn bộ bộ quy tắc giá đang áp dụng cho cơ sở, cùng định dạng với request body của 2.8 để frontend đọc về, chỉnh sửa rồi gửi lại.
* **Quyền truy cập:** `owner` (chủ sở hữu cơ sở thể thao).
* **Database Transaction:** Không cần (chỉ đọc).
* **Response (200 OK):**
  ```json
  {
    "success": true,
    "message": "Lấy bảng giá theo thời điểm thành công.",
    "data": {
      "facility_id": 1,
      "rules": [
        {
          "id": 10,
          "name": "Giờ vàng 17h-21h các ngày trong tuần",
          "rule_type": "PEAK_HOUR",
          "multiplier": 1.3,
          "start_time": "17:00:00",
          "end_time": "21:00:00",
          "day_of_week": null,
          "holiday_id": null
        }
      ]
    }
  }
  ```
  Cơ sở chưa có quy tắc nào thì `rules` là `[]`.
* **Lỗi:** `401` chưa đăng nhập, `403` không phải chủ cơ sở, `404 FACILITY_NOT_FOUND`.

#### 2.9 Tra cứu danh mục ngày lễ trong năm (Holidays)
* **Endpoint:** `GET /api/v1/holidays`
* **Mô tả:** Lấy danh mục các ngày lễ trong hệ thống. Dùng cho giao diện của Chủ sân để lấy `holiday_id` khi cấu hình bảng giá thời điểm (`HOLIDAY`) tại mục 2.8.
* **Quyền truy cập:** Public (hoặc Đã đăng nhập).
* **Database Transaction:** Không.
* **Response (200 OK):**
  ```json
  {
    "success": true,
    "message": "Lấy danh mục ngày lễ thành công.",
    "data": [
      {
        "id": 1,
        "name": "Tết Dương Lịch",
        "holiday_date": "2026-01-01",
        "recurring_yearly": true
      },
      {
        "id": 2,
        "name": "Giải phóng miền Nam & Quốc tế Lao động",
        "holiday_date": "2026-04-30",
        "recurring_yearly": true
      },
      {
        "id": 3,
        "name": "Quốc Khánh",
        "holiday_date": "2026-09-02",
        "recurring_yearly": true
      }
    ]
  }
  ```

#### 2.10 Thêm ngày lễ mới vào hệ thống (Dành cho Quản trị viên)
* **Endpoint:** `POST /api/v1/admin/holidays`
* **Mô tả:** Quản trị viên cấu hình ngày lễ mới vào bảng `holidays` trong CSDL.
* **Quyền truy cập:** `admin`.
* **Database Transaction:** Không.
* **Request Body:**
  ```json
  {
    "name": "Giỗ Tổ Hùng Vương",
    "holiday_date": "2026-04-26",
    "recurring_yearly": false
  }
  ```
* **Response (201 Created):**
  ```json
  {
    "success": true,
    "message": "Thêm ngày lễ mới thành công.",
    "data": {
      "id": 4,
      "name": "Giỗ Tổ Hùng Vương",
      "holiday_date": "2026-04-26",
      "recurring_yearly": false
    }
  }
  ```

#### 2.11 Tra cứu danh sách dịch vụ đi kèm của cơ sở thể thao (Services)
* **Endpoint:** `GET /api/v1/facilities/{id}/services`
* **Mô tả:** Lấy danh sách các dịch vụ phụ trợ đang hoạt động của một cơ sở (thuê vợt, mua nước suối, bóng thi đấu...). Frontend gọi API này để hiển thị danh sách kèm đơn giá cho khách chọn trước khi gọi `calculate-price` và `POST /bookings`.
* **Quyền truy cập:** Public.
* **Database Transaction:** Không.
* **Response (200 OK):**
  ```json
  {
    "success": true,
    "message": "Lấy danh sách dịch vụ thành công.",
    "data": [
      {
        "id": 1,
        "facility_id": 1,
        "name": "Thuê 2 vợt cầu lông Yonex",
        "unit_price": 20000,
        "unit": "bộ/giờ",
        "is_active": true
      },
      {
        "id": 2,
        "facility_id": 1,
        "name": "Nước khoáng đóng chai",
        "unit_price": 10000,
        "unit": "chai",
        "is_active": true
      }
    ]
  }
  ```

#### 2.12 Thêm dịch vụ đi kèm mới cho cơ sở thể thao (Dành cho Chủ sân)
* **Endpoint:** `POST /api/v1/facilities/{id}/services`
* **Mô tả:** Chủ cơ sở tạo thêm dịch vụ phụ trợ mới trực thuộc cơ sở thể thao của mình.
* **Quyền truy cập:** `owner` (chủ sở hữu cơ sở thể thao).
* **Database Transaction:** Không.
* **Request Body:**
  ```json
  {
    "name": "Thuê giày thể thao",
    "unit_price": 30000,
    "unit": "đôi/buổi"
  }
  ```
* **Response (201 Created):**
  ```json
  {
    "success": true,
    "message": "Thêm dịch vụ đi kèm thành công.",
    "data": {
      "id": 3,
      "facility_id": 1,
      "name": "Thuê giày thể thao",
      "unit_price": 30000,
      "unit": "đôi/buổi",
      "is_active": true
    }
  }
  ```

#### 2.13 Cập nhật thông tin dịch vụ đi kèm (Dành cho Chủ sân)
* **Endpoint:** `PATCH /api/v1/services/{service_id}`
* **Mô tả:** Chủ cơ sở cập nhật đơn giá hoặc bật/tắt trạng thái kinh doanh dịch vụ (`is_active = false`).
* **Quyền truy cập:** `owner` (chủ sở hữu cơ sở thể thao).
* **Database Transaction:** Không.
* **Request Body:**
  ```json
  {
    "unit_price": 35000,
    "is_active": true
  }
  ```
* **Response (200 OK):**
  ```json
  {
    "success": true,
    "message": "Cập nhật dịch vụ thành công.",
    "data": {
      "id": 3,
      "unit_price": 35000,
      "is_active": true
    }
  }
  ```

---

### 🟢 EPIC 3: LỊCH TRỐNG, TÍNH TIỀN, ĐẶT SÂN & QUẢN LÝ GIỮ CHỖ

#### 3.1 Xem sơ đồ khung giờ trống theo ngày của sân con (Quy tắc lọc Hold quá hạn & Khung giờ đã qua)
* **Endpoint:** `GET /api/v1/courts/{court_id}/slots`
* **Mô tả:** Lấy danh sách toàn bộ các khung giờ trong ngày chỉ định (`date=YYYY-MM-DD`). 
* **Quy tắc phân loại trạng thái khung giờ (Gắn kết thời gian thực `:now` theo giờ Việt Nam UTC+7):**
  * **`BOOKED` (Đã đặt cọc):** Tồn tại `booking_slots.released_at IS NULL` VÀ `bookings.status = 'DEPOSITED'` (áp dụng cho cả khung giờ trong quá khứ lẫn tương lai).
  * **`UNAVAILABLE` (Không khả dụng / Đã qua giờ):** Khung giờ nằm trong quá khứ hoặc đang diễn ra (`ngày chơi < hôm nay` hoặc `ngày chơi = hôm nay và start_time <= giờ hiện tại theo giờ Việt Nam`), chưa có ai đặt cọc (`BOOKED`). Khung này không thể đặt được nữa.
  * **`HOLDING` (Đang giữ chỗ chờ cọc):** Khung giờ trong tương lai, tồn tại `booking_slots.released_at IS NULL` VÀ `bookings.status = 'PENDING_DEPOSIT'` VÀ `bookings.hold_expires_at > :now`.
  * **`AVAILABLE` (Trống - có thể đặt):** Khung giờ trong tương lai, VÀ:
    - Chưa có bản ghi `booking_slots` nào, HOẶC
    - `booking_slots.released_at IS NOT NULL` (đã nhả), HOẶC
    - Thuộc đơn `PENDING_DEPOSIT` nhưng **`bookings.hold_expires_at <= :now`** (đã hết hạn giữ chỗ 10 phút, coi là trống ngay lập tức trên UI).
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
* **Mô tả:** **Server tính toán toàn bộ chi phí theo QĐ1, QĐ2, QĐ4**. Trả về mảng chi tiết hệ số cho từng khung giờ riêng biệt (`slots_breakdown`). Frontend tuyệt đối không tự tính.
* **Quyền truy cập:** Đã đăng nhập (`customer`).
* **Database Transaction:** Không.
* **Request Body:**
  ```json
  {
    "court_id": 101,
    "play_date": "2026-11-10",
    "time_slot_ids": [1, 2],
    "services": [
      {
        "service_id": 1,
        "quantity": 2
      }
    ]
  }
  ```
* **Response Payload (Frontend chỉ hiển thị, không tự tính):**
  ```json
  {
    "success": true,
    "message": "Tính toán tiền đặt sân thành công.",
    "data": {
      "court_id": 101,
      "court_name": "Sân Cầu Lông 1 (Thảm Yonex)",
      "facility_name": "Cơ Sở Cầu Lông & Pickleball Kỳ Hòa",
      "play_date": "2026-11-10",
      "time_range": "16:00 - 18:00 (2 khung giờ)",
      "slots_breakdown": [
        {
          "time_slot_id": 1,
          "start_time": "16:00:00",
          "end_time": "17:00:00",
          "base_price": 100000,
          "applied_rule": "Giá giờ thường",
          "multiplier": 1.00,
          "final_price": 100000
        },
        {
          "time_slot_id": 2,
          "start_time": "17:00:00",
          "end_time": "18:00:00",
          "base_price": 100000,
          "applied_rule": "Giờ vàng 17h-21h",
          "multiplier": 1.30,
          "final_price": 130000
        }
      ],
      "pricing_summary": {
        "subtotal": 230000,
        "service_total": 40000,
        "grand_total_amount": 270000
      },
      "deposit_policy": {
        "policy_rule": "QĐ4 - Bắt buộc đặt cọc 30% tổng tiền qua ví nội bộ",
        "deposit_percentage": 30,
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

#### 3.3 Tạo lịch đặt sân và giữ chỗ tạm (Luồng 1 CSDL - `PENDING_DEPOSIT` & Lazy Release)
* **Endpoint:** `POST /api/v1/bookings`
* **Mô tả:** Tạo đơn đặt sân tạm thời và khóa giữ chỗ trong 10 phút. Chưa trừ tiền ví, chưa ghi sổ cái `wallet_transactions`.
* **Múi giờ:** `play_date` và giờ của slot được hiểu theo giờ Việt Nam (UTC+7). Response chuyển `start_at`, `hold_expires_at` sang UTC trước khi gắn `Z`: ví dụ 08:00 giờ Việt Nam là 01:00Z; ngày của timestamp UTC có thể khác `play_date`.
* **Quyền truy cập:** Đã đăng nhập (`customer`).
* **Database Transaction:** **BẮT BUỘC (ACID TRANSACTION VỚI LAZY RELEASE VÀ ROW LOCKING)**
  * **Bước 1 (Dọn dẹp lười giữ chỗ quá hạn - Opportunistic / Lazy Release):**
    Trước khi kiểm tra xung đột, thực thi lệnh UPDATE để giải phóng ngay các đơn hold đã quá hạn trên chính các khung giờ đang đặt:
    ```sql
    UPDATE bookings b
    JOIN booking_slots bs ON b.id = bs.booking_id
    SET b.status = 'CANCELLED',
        b.cancelled_at = :now,
        bs.released_at = :now
    WHERE bs.court_id = :court_id 
      AND bs.play_date = :play_date 
      AND bs.time_slot_id IN (:time_slot_ids)
      AND b.status = 'PENDING_DEPOSIT' 
      AND b.hold_expires_at <= :now
      AND bs.released_at IS NULL;
    ```
    *(Bước này cập nhật `released_at = :now`, làm cột sinh `active_key` tự động về `NULL`, giải phóng hoàn toàn ràng buộc UNIQUE cho các slot quá hạn).*
  * **Bước 2 (Kiểm tra xung đột bằng `SELECT ... FOR UPDATE`):**
    Khóa và kiểm tra xem còn bản ghi nào trong `booking_slots` có `active_key = 1` trên các khung giờ này hay không. Nếu còn dòng ➔ Nghĩa là khung giờ đang bị giữ bởi đơn `DEPOSITED` hoặc đơn `PENDING_DEPOSIT` còn hạn. Rollback và báo lỗi `409 Conflict` (`SLOT_ALREADY_BOOKED`).
  * **Bước 3 (Kiểm tra điều kiện mở cửa sân):**
    Kiểm tra toàn bộ `time_slot_id` thuộc `court_slots` của sân. Mỗi slot phải bắt đầu từ giờ mở cửa và kết thúc trước hoặc đúng giờ đóng cửa của cả sân lẫn cơ sở, kể cả khi `court_slots.is_active = true`. Tính `start_at = play_date + MIN(start_time)`. Từ chối slot ngoài giờ hoạt động hoặc `start_at <= :now` bằng mã lỗi `400 INVALID_BOOKING_TIME`.
  * **Bước 4 (Tính tiền & Thiết lập thời hạn giữ chỗ):**
    Tính toán chi phí, đặt `hold_expires_at = MIN(:now + 10 phút, start_at)`.
  * **Bước 5 (Tạo đơn và chi tiết slot):**
    INSERT bản ghi `bookings` với `status = 'PENDING_DEPOSIT'`.
    INSERT các bản ghi `booking_slots` (kèm `multiplier`, `final_price`, `active_key = 1`) và `booking_services` (nếu có).
  * **Bước 6:** Commit Transaction.
* **Request Body:**
  ```json
  {
    "court_id": 101,
    "play_date": "2026-11-10",
    "time_slot_ids": [1, 2],
    "services": [
      {
        "service_id": 1,
        "quantity": 2
      }
    ]
  }
  ```
* **Response (201 Created):**
  ```json
  {
    "success": true,
    "message": "Giữ chỗ tạm thời thành công. Vui lòng thanh toán cọc trong vòng 10 phút.",
    "data": {
      "booking_id": 105,
      "court_id": 101,
      "court_name": "Sân Cầu Lông 1 (Thảm Yonex)",
      "play_date": "2026-11-10",
      "start_at": "2026-11-10T09:00:00Z",
      "status": "PENDING_DEPOSIT",
      "total_amount": 270000,
      "deposit_amount_required": 81000,
      "hold_expires_at": "2026-11-10T07:40:00Z"
    }
  }
  ```

#### 3.4 Thanh toán tiền cọc 30% qua ví nội bộ (Luồng 2 CSDL - `DEPOSITED` & Sinh `DEPOSIT`)
* **Endpoint:** `POST /api/v1/bookings/{id}/deposit`
* **Mô tả:** Khách hàng xác nhận thanh toán cọc 30% từ ví nội bộ cho đơn đang giữ chỗ. Tiền cọc được chuyển từ ví khách sang ví hệ thống trung gian (`is_system = true`).
* **Quyền truy cập:** Đã đăng nhập (`customer` sở hữu đơn).
* **Database Transaction:** **BẮT BUỘC (ACID TRANSACTION VỚI SELECT ... FOR UPDATE)**
  * **Bước 1:** Khóa hàng (`SELECT ... FOR UPDATE`) ví khách hàng và ví hệ thống theo thứ tự `wallet.id` tăng dần (chống Deadlock).
  * **Bước 2:** Cập nhật đơn đặt:
    ```sql
    UPDATE bookings 
    SET status = 'DEPOSITED', hold_expires_at = NULL 
    WHERE id = :id AND status = 'PENDING_DEPOSIT' AND hold_expires_at > :now;
    ```
    Kiểm tra `rowcount = 1`. Nếu bằng 0 ➔ Đơn đã hết hạn 10 phút hoặc đã bị đổi trạng thái -> Rollback và báo lỗi `400 Bad Request` (`CANNOT_DEPOSIT_EXPIRED_BOOKING`).
  * **Bước 3:** Kiểm tra số dư ví khách (`balance >= deposit_amount`). Nếu thiếu tiền ➔ Rollback và báo lỗi `402 Payment Required` (`WALLET_INSUFFICIENT_BALANCE`, ánh xạ từ ràng buộc CSDL `chk_wallets_balance`).
  * **Bước 4:** Trừ tiền ví khách (`balance = balance - :deposit`) và cộng tiền vào ví hệ thống (`balance = balance + :deposit`).
  * **Bước 5:** **Ghi bản ghi vào sổ cái `wallet_transactions` với `type = 'DEPOSIT'`**:
    (`from_wallet_id = ví khách`, `to_wallet_id = ví hệ thống`, `related_booking_id = booking.id`, `amount = deposit_amount`, `created_by = NULL`).
  * **Bước 6:** Commit Transaction.
* **Response (200 OK):**
  ```json
  {
    "success": true,
    "message": "Thanh toán cọc 30% thành công. Đơn đặt sân đã được xác nhận.",
    "data": {
      "booking_id": 105,
      "status": "DEPOSITED",
      "deposit_amount_paid": 81000,
      "remaining_amount_due_at_court": 189000,
      "wallet_balance_remaining": 119000,
      "transaction_type": "DEPOSIT"
    }
  }
  ```

#### 3.5 Tra cứu danh sách lịch đặt sân (Paginated List)
* **Endpoint:** `GET /api/v1/bookings`
* **Mô tả:** Lấy danh sách lịch đặt sân có phân trang và bộ lọc. Tự động áp dụng phân quyền: `customer` chỉ thấy đơn của mình, `owner` chỉ thấy đơn tại các cơ sở thuộc quyền sở hữu của mình, `admin` thấy toàn bộ.
* **Quyền truy cập:** Đã đăng nhập (`customer`, `owner`, `admin`).
* **Query Params:** `status`, `facility_id`, `court_id`, `from_date`, `to_date`, `page=1`, `limit=10`.
  * `from_date` và `to_date` dùng định dạng `YYYY-MM-DD` và lọc trực tiếp theo `play_date` (ngày chơi theo giờ Việt Nam), bao gồm cả hai đầu mốc. Có thể truyền từng mốc riêng. Nếu `from_date > to_date`, trả `400 INVALID_REQUEST`.
* **Sắp xếp mặc định:** `play_date DESC, start_at DESC, id DESC`, trước khi phân trang.
* **Trường trả về:** `end_at` là thời điểm kết thúc khung giờ cuối của đơn (kể cả khung giờ đã nhả khi hủy), chuyển sang UTC theo quy tắc múi giờ tại 3.3. Chỉ phản hồi cho `owner` và `admin` mới có `customer_name` và `customer_phone` lấy từ hồ sơ người đặt.
* **Database Transaction:** Không.
* **Response (200 OK - Paginated List chuẩn 2.1.B, ví dụ cho `owner` hoặc `admin`):**
  ```json
  {
    "success": true,
    "message": "Lấy danh sách lịch đặt sân thành công.",
    "data": [
      {
        "id": 105,
        "facility_id": 1,
        "facility_name": "Cơ Sở Cầu Lông & Pickleball Kỳ Hòa",
        "court_id": 101,
        "court_name": "Sân Cầu Lông 1 (Thảm Yonex)",
        "play_date": "2026-11-10",
        "start_at": "2026-11-10T09:00:00Z",
        "end_at": "2026-11-10T11:00:00Z",
        "customer_name": "Nguyễn Minh An",
        "customer_phone": "0901234567",
        "total_amount": 270000,
        "deposit_amount": 81000,
        "status": "DEPOSITED",
        "created_at": "2026-11-10T07:30:00Z"
      }
    ],
    "meta": {
      "page": 1,
      "limit": 10,
      "total": 45,
      "total_pages": 5
    }
  }
  ```

#### 3.6 Xem thông tin chi tiết đơn đặt sân (Single Object)
* **Endpoint:** `GET /api/v1/bookings/{id}`
* **Mô tả:** Lấy toàn bộ thông tin chi tiết một đơn đặt sân (khung giờ chi tiết, dịch vụ, bảng kê tiền).
* **Quyền truy cập:** Đã đăng nhập (`customer` sở hữu đơn, `owner` quản lý cơ sở, `admin`).
* **Lỗi nghiệp vụ:** `404 BOOKING_NOT_FOUND` nếu ID không tồn tại. Trả `403 AUTH_FORBIDDEN` nếu đơn tồn tại nhưng nằm ngoài phạm vi truy cập của người gọi.
* **Trường trả về:** `customer_name` là tên người đặt. `cancel_reason` là lý do hủy hoặc `null` nếu chưa có lý do hủy.
* **Database Transaction:** Không.
* **Response (200 OK - Single Object chuẩn 2.1.A):**
  ```json
  {
    "success": true,
    "message": "Lấy chi tiết đơn đặt sân thành công.",
    "data": {
      "id": 105,
      "user_id": 12,
      "customer_name": "Nguyễn Minh An",
      "court_id": 101,
      "court_name": "Sân Cầu Lông 1 (Thảm Yonex)",
      "facility_name": "Cơ Sở Cầu Lông & Pickleball Kỳ Hòa",
      "play_date": "2026-11-10",
      "start_at": "2026-11-10T09:00:00Z",
      "status": "DEPOSITED",
      "slots": [
        {
          "time_slot_id": 1,
          "start_time": "16:00:00",
          "end_time": "17:00:00",
          "base_price": 100000,
          "multiplier": 1.00,
          "final_price": 100000
        },
        {
          "time_slot_id": 2,
          "start_time": "17:00:00",
          "end_time": "18:00:00",
          "base_price": 100000,
          "multiplier": 1.30,
          "final_price": 130000
        }
      ],
      "services": [
        {
          "service_id": 1,
          "name": "Thuê 2 vợt cầu lông Yonex",
          "quantity": 2,
          "unit_price": 20000,
          "total_price": 40000
        }
      ],
      "pricing_summary": {
        "subtotal": 230000,
        "service_total": 40000,
        "total_amount": 270000,
        "deposit_amount": 81000,
        "remaining_amount_due_at_court": 189000
      },
      "hold_expires_at": null,
      "cancelled_at": null,
      "cancel_reason": null
    }
  }
  ```

#### 3.7 Tác vụ tự động dọn dẹp và nhả giữ chỗ hết hạn (Luồng 3b CSDL & Endpoint Quản trị)
* **Cơ chế chạy ngầm (Scheduled Background Worker):**
  * Tiến trình nền (APScheduler / FastAPI BackgroundTasks / Cron) chạy định kỳ mỗi **60 giây**.
  * Quét các đơn `PENDING_DEPOSIT` có `hold_expires_at <= :now`.
  * Thực hiện cập nhật:
    ```sql
    UPDATE bookings 
    SET status = 'CANCELLED', cancelled_at = :now 
    WHERE status = 'PENDING_DEPOSIT' AND hold_expires_at <= :now;

    UPDATE booking_slots 
    SET released_at = :now 
    WHERE booking_id IN (:expired_booking_ids) AND released_at IS NULL;
    ```
  * Cột sinh `active_key` tự động chuyển về `NULL`. Tuyệt đối không ghi giao dịch ví (chưa thu cọc).
* **Endpoint Kích hoạt thủ công / Kiểm thử tự động:** `POST /api/v1/admin/bookings/expire-holds`
* **Mô tả:** Cho phép quản trị viên hoặc kịch bản kiểm thử CI/CD kích hoạt dọn dẹp ngay lập tức mà không cần chờ chu kỳ Cron.
* **Quyền truy cập:** `admin`.
* **Database Transaction:** **BẮT BUỘC**.
* **Response (200 OK):**
  ```json
  {
    "success": true,
    "message": "Quét và dọn dẹp các lịch giữ chỗ hết hạn thành công.",
    "data": {
      "total_expired_bookings_cancelled": 2,
      "total_slots_released": 4,
      "executed_at": "2026-11-10T07:45:00Z"
    }
  }
  ```

---

### 🟢 EPIC 4: HỦY SÂN, HOÀN CỌC VÀ KẾT TOÁN TIỀN SÂN (CANCELLATION, REFUND & SETTLEMENT)

#### 4.1 Xem trước số tiền hoàn khi hủy lịch (Frontend Zero-Math)
* **Endpoint:** `GET /api/v1/bookings/{id}/cancel-preview`
* **Mô tả:** **Server tính toán toàn bộ số tiền hoàn trả theo QĐ5**. Đo khoảng cách từ thời điểm hiện tại (`:now`) đến giờ bắt đầu chơi (`start_at`) và trả về chi tiết chính sách hoàn cọc để Frontend hiển thị hộp thoại xác nhận.
* **Quyền truy cập:** Đã đăng nhập (`customer` sở hữu đơn đặt).
* **Điều kiện hủy:** Đơn phải có trạng thái `PENDING_DEPOSIT` hoặc `DEPOSITED`, và `:now < start_at`. Trả `400 CANNOT_CANCEL_BOOKING` nếu không thỏa điều kiện, `404 BOOKING_NOT_FOUND` nếu đơn không tồn tại, hoặc `403 AUTH_FORBIDDEN` nếu người gọi không có quyền.
* **Đơn `PENDING_DEPOSIT`:** Trả `deposit_amount_paid`, `refund_percentage`, `penalty_percentage`, `refund_amount_to_player` và `penalty_amount_to_facility` đều bằng `0`. `rule_matched` và `customer_display_message` cho biết đơn chưa thanh toán cọc. Xem trước chỉ đọc dữ liệu.
* **Database Transaction:** Không.
* **Response (200 OK, đơn đã cọc 39.000đ, hủy trước giờ chơi 30 giờ):**
  ```json
  {
    "success": true,
    "message": "Tính toán chính sách hoàn cọc thành công.",
    "data": {
      "booking_id": 106,
      "deposit_amount_paid": 39000,
      "schedule_info": {
        "play_date": "2026-11-10",
        "start_at": "2026-11-10T09:00:00Z"
      },
      "cancellation_evaluation": {
        "evaluated_at": "2026-11-09T03:00:00Z",
        "hours_until_start": 30.0,
        "rule_matched": "QĐ5.1 - Hủy từ 24 giờ trở lên trước giờ chơi (Hoàn 80% cọc)",
        "refund_percentage": 80,
        "penalty_percentage": 20
      },
      "financial_result": {
        "refund_amount_to_player": 31200,
        "penalty_amount_to_facility": 7800,
        "customer_display_message": "Bạn đang yêu cầu hủy trước giờ chơi 30 giờ. Khi xác nhận hủy, bạn sẽ được hoàn 31.200 VNĐ vào ví nội bộ theo QĐ5."
      }
    }
  }
  ```

#### 4.2 Thực hiện hủy lịch và xử lý cọc tự động (Luồng 3 CSDL - Sinh `REFUND` và/hoặc `FORFEIT`)
* **Endpoint:** `POST /api/v1/bookings/{id}/cancel`
* **Mô tả:** Khách hàng hủy đơn đặt sân (áp dụng cho cả đơn `PENDING_DEPOSIT` và `DEPOSITED`). Nếu đơn đã cọc (`DEPOSITED`), tự động hoàn cọc vào ví khách (`REFUND`) và bồi thường cho chủ cơ sở (`FORFEIT`).
* **Quyền truy cập:** Đã đăng nhập (`customer` sở hữu đơn hoặc `admin`).
* **Lỗi nghiệp vụ:** `404 BOOKING_NOT_FOUND` nếu đơn không tồn tại, `403 AUTH_FORBIDDEN` nếu người gọi không có quyền, `400 CANNOT_CANCEL_BOOKING` nếu trạng thái hoặc thời điểm không cho phép hủy.
* **Database Transaction:** **BẮT BUỘC (ACID TRANSACTION VỚI ROW LOCKING)**
  * **Bước 1:** Khóa hàng (`SELECT ... FOR UPDATE`) đơn đặt trong bảng `bookings`, kiểm tra quyền truy cập rồi đọc trạng thái và thời điểm để áp dụng điều kiện hủy tại 4.1. Nếu không thỏa điều kiện hủy, rollback và trả `400 CANNOT_CANCEL_BOOKING`.
  * **Bước 2:** Cập nhật bảng `bookings`: `status = 'CANCELLED'`, `cancelled_at = :now`, `cancel_reason = :cancel_reason`.
  * **Bước 3:** Cập nhật bảng `booking_slots`: `released_at = :now` (cột sinh `active_key` tự chuyển về `NULL` để mở lại khung giờ cho người khác đặt).
  * **Bước 3b (Đóng bài đăng ghép đội liên quan):** Khóa bài đăng `OPEN` liên kết với đơn trước khi đổi `team_posts.status` thành `CANCELLED`. Chuyển các đơn ứng tuyển `PENDING` của bài thành `REJECTED` trong cùng transaction.
  * **Bước 4 (Chỉ khi trạng thái cũ là `DEPOSITED`):**
    * Tính `hours_until_start = start_at - :now`:
      - `>= 24h`: `refund = deposit * 80 DIV 100`.
      - `12h <= x < 24h`: `refund = deposit * 50 DIV 100`.
      - `< 12h`: `refund = 0`.
      - `forfeit = deposit - refund`.
    * Khóa các ví sẽ cập nhật số dư theo thứ tự `wallet.id` tăng dần, gồm ví hệ thống, ví khách nếu `refund > 0` và ví chủ cơ sở nếu `forfeit > 0`.
    * Trừ tiền ví hệ thống: `balance = balance - deposit_amount`.
    * **Nếu `refund > 0`**: Cộng ví khách và ghi `wallet_transactions` loại `REFUND` (`from_wallet_id = ví hệ thống`, `to_wallet_id = ví khách`, `related_booking_id = booking.id`).
    * **Nếu `forfeit > 0`**: Cộng ví chủ sân và ghi `wallet_transactions` loại `FORFEIT` (`from_wallet_id = ví hệ thống`, `to_wallet_id = ví chủ sân`, `related_booking_id = booking.id`).
  * **Bước 5:** Commit Transaction. Với đơn `PENDING_DEPOSIT`, bỏ qua bước 4 và vẫn hủy đơn, nhả khung giờ. `refund_percentage`, `refunded_to_customer_wallet` và `compensated_to_facility_wallet` đều bằng `0`. Số dư ví khách giữ nguyên và không phát sinh giao dịch ví.
* **Request Body:**
  ```json
  {
    "cancel_reason": "Bận việc gia đình đột xuất"
  }
  ```
* **Response (200 OK, đơn đã cọc 39.000đ, hủy trước giờ chơi 30 giờ):**
  ```json
  {
    "success": true,
    "message": "Hủy đơn đặt sân thành công. Tiền cọc đã được xử lý tự động theo quy định.",
    "data": {
      "booking_id": 106,
      "status": "CANCELLED",
      "hours_until_start": 30.0,
      "refund_percentage": 80,
      "refunded_to_customer_wallet": 31200,
      "compensated_to_facility_wallet": 7800,
      "customer_new_wallet_balance": 92200
    }
  }
  ```

#### 4.3 Xác nhận hoàn tất buổi chơi & Kết toán cọc cho chủ sân (Luồng 4 CSDL - Sinh `SETTLE`)
* **Endpoint:** `POST /api/v1/bookings/{id}/complete`
* **Mô tả:** Khi khách hàng đến nhận sân và hoàn tất buổi chơi (điều kiện `:now >= start_at`), Chủ cơ sở bấm xác nhận hoàn tất. Toàn bộ khoản tiền cọc 30% đang được giữ ở Ví hệ thống sẽ được **kết toán chuyển sang Ví của Chủ cơ sở (`SETTLE`)**, đơn chuyển sang trạng thái `COMPLETED` (QĐ7).
* **Quyền truy cập:** `owner` (chủ sở hữu cơ sở thể thao) hoặc `admin`.
* **Lỗi nghiệp vụ:** `404 BOOKING_NOT_FOUND` nếu đơn không tồn tại, `403 AUTH_FORBIDDEN` nếu người gọi không có quyền, `400 CANNOT_SETTLE_BOOKING` nếu trạng thái khác `DEPOSITED` (KT-03, KT-04), `400 CANNOT_SETTLE_BEFORE_START` nếu đơn đã cọc nhưng chưa đến giờ bắt đầu (KT-02).
* **Database Transaction:** **BẮT BUỘC (ACID TRANSACTION VỚI ROW LOCKING)**
  * **Bước 1:** Khóa hàng (`SELECT ... FOR UPDATE`) đơn đặt trong `bookings` và kiểm tra quyền. Đọc trạng thái sau khi đã khóa. Nếu trạng thái khác `DEPOSITED`, kể cả `COMPLETED` sau lần kết toán trước, rollback và trả `400 CANNOT_SETTLE_BOOKING`.
  * **Bước 2:** Kiểm tra `:now >= start_at`. Nếu chưa đến giờ, rollback và trả `400 CANNOT_SETTLE_BEFORE_START`.
  * **Bước 3:** Khóa hàng ví hệ thống trung gian (`is_system = true`) và ví chủ cơ sở (`facility.owner_id`) theo thứ tự `wallet.id` tăng dần.
  * **Bước 4:** Trừ số dư ví hệ thống: `balance = balance - deposit_amount`.
  * **Bước 5:** Cộng số dư ví chủ cơ sở: `balance = balance + deposit_amount`.
  * **Bước 6:** **Ghi bản ghi vào sổ cái `wallet_transactions` với `type = 'SETTLE'`** (`from_wallet_id = ví hệ thống`, `to_wallet_id = ví chủ sân`, `related_booking_id = booking.id`).
  * **Bước 7:** Cập nhật `bookings`: `status = 'COMPLETED'`.
  * **Bước 8:** Commit Transaction.
* **Response (200 OK):**
  ```json
  {
    "success": true,
    "message": "Xác nhận hoàn tất buổi chơi và kết toán tiền cọc cho chủ sân thành công.",
    "data": {
      "booking_id": 105,
      "status": "COMPLETED",
      "settled_deposit_amount": 81000,
      "transferred_to_owner_wallet_id": 3,
      "transaction_type": "SETTLE"
    }
  }
  ```

---

### 🟢 EPIC 5: VÍ NỘI BỘ VÀ LỊCH SỬ DÒNG TIỀN (WALLETS & TRANSACTIONS - QĐ6)

#### 5.1 Tra cứu số dư ví hiện tại
* **Endpoint:** `GET /api/v1/wallets/me`
* **Mô tả:** Lấy thông tin ví và số dư khả dụng hiện tại của người dùng.
* **Quyền truy cập:** Đã đăng nhập (`customer`, `owner`).
* **Database Transaction:** Không.
* **Response (200 OK):**
  ```json
  {
    "success": true,
    "message": "Lấy thông tin ví thành công.",
    "data": {
      "wallet_id": 12,
      "user_id": 12,
      "balance": 183800
    }
  }
  ```

#### 5.2 Tra cứu lịch sử biến động số dư (Paginated List)
* **Endpoint:** `GET /api/v1/wallets/me/transactions`
* **Mô tả:** Lấy danh sách lịch sử giao dịch ví của người dùng có phân trang. Hỗ trợ lọc theo loại giao dịch (`TOPUP`, `DEPOSIT`, `REFUND`, `FORFEIT`, `SETTLE`).
* **Quyền truy cập:** Đã đăng nhập (`customer`, `owner`).
* **Query Params:** `type`, `page=1`, `limit=10`.
* **Database Transaction:** Không.
* **Response (200 OK - Paginated List chuẩn 2.1.B):**
  ```json
  {
    "success": true,
    "message": "Lấy lịch sử giao dịch ví thành công.",
    "data": [
      {
        "id": 501,
        "type": "REFUND",
        "amount": 64800,
        "balance_after": 183800,
        "related_booking_id": 105,
        "created_at": "2026-11-09T03:05:00Z"
      },
      {
        "id": 480,
        "type": "DEPOSIT",
        "amount": 81000,
        "balance_after": 119000,
        "related_booking_id": 105,
        "created_at": "2026-11-08T08:00:00Z"
      },
      {
        "id": 401,
        "type": "TOPUP",
        "amount": 200000,
        "balance_after": 200000,
        "related_booking_id": null,
        "created_at": "2026-11-01T02:00:00Z"
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

#### 5.3 Admin nạp tiền trải nghiệm vào ví người dùng (Sinh `TOPUP` - QĐ6)
* **Endpoint:** `POST /api/v1/admin/wallet-topups`
* **Mô tả:** Quản trị viên cấp tiền vào ví cho người dùng để thử nghiệm hệ thống.
* **Quyền truy cập:** `admin`.
* **Database Transaction:** **BẮT BUỘC** (Cộng số dư ví và ghi bản ghi `wallet_transactions` loại `TOPUP` với `created_by = current_admin.id`, `related_booking_id = NULL`).
* **Request Body:**
  ```json
  {
    "user_id": 12,
    "amount": 500000,
    "reason": "Cấp số dư tài khoản trải nghiệm đồ án môn học"
  }
  ```
* **Response (200 OK):**
  ```json
  {
    "success": true,
    "message": "Nạp tiền vào ví người dùng thành công.",
    "data": {
      "user_id": 12,
      "granted_amount": 500000,
      "new_balance": 683800,
      "transaction_type": "TOPUP"
    }
  }
  ```

#### 5.4 Admin tra cứu danh sách người dùng (Paginated List)
* **Endpoint:** `GET /api/v1/admin/users`
* **Mô tả:** Quản trị viên tìm kiếm và lọc danh sách tài khoản người dùng trong hệ thống có phân trang. Hỗ trợ tìm kiếm theo từ khóa trùng khớp tương đối với tên người dùng (`name`), email (`email`), hoặc số điện thoại (`phone`). Trả về danh sách thông tin người dùng kèm danh sách vai trò (`roles`) và số dư ví nội bộ hiện tại (`balance`).
* **Quyền truy cập:** `admin`.
* **Header:** `Authorization: Bearer <access_token>`
* **Query Params:** `search`, `page=1`, `limit=10`.
* **Database Transaction:** Không.
* **Response (200 OK - Paginated List chuẩn 2.1.B):**
  ```json
  {
    "success": true,
    "message": "Lấy danh sách người dùng thành công.",
    "data": [
      {
        "id": 12,
        "name": "Nguyễn Văn A",
        "email": "customer@example.com",
        "phone": "0901234567",
        "roles": [
          "customer"
        ],
        "balance": 183800
      },
      {
        "id": 3,
        "name": "Trần Văn Chủ Sân",
        "email": "owner@example.com",
        "phone": "0912345678",
        "roles": [
          "owner"
        ],
        "balance": 5200000
      }
    ],
    "meta": {
      "page": 1,
      "limit": 10,
      "total": 2,
      "total_pages": 1
    }
  }
  ```
* **Mã lỗi phát sinh:**
  - `401 Unauthorized`: `AUTH_UNAUTHORIZED`, `AUTH_TOKEN_EXPIRED`, `AUTH_TOKEN_INVALID`.
  - `403 Forbidden`: `AUTH_FORBIDDEN` (Không có quyền Admin).
  - `422 Unprocessable Entity`: `VALIDATION_ERROR` (`page` hoặc `limit` không hợp lệ).

---

### 🟢 EPIC 6: BÀI ĐĂNG TÌM ĐỒNG ĐỘI (MATCHMAKING - PHÁC THẢO CHỨC NĂNG 4)

#### 6.1 Xem danh sách bài đăng tìm đồng đội (Paginated List)
* **Endpoint:** `GET /api/v1/team-posts`
* **Mô tả:** Lấy danh sách các bài đăng tìm người chơi ghép trận (lọc theo trạng thái `OPEN`, `CLOSED`, `CANCELLED`).
* **Quyền truy cập:** Danh sách chung là public. `mine=true` yêu cầu đăng nhập, nếu thiếu token thì trả `401 AUTH_UNAUTHORIZED`.
* **Query Params:** `status=OPEN`, `mine=false`, `page=1`, `limit=10`. `mine=true` lọc thêm theo `team_posts.user_id = current_user.id`. Bộ lọc `status` vẫn áp dụng, ví dụ `?mine=true&status=CLOSED` lấy các bài đã đóng của người gọi.
* **Trường trả về:** `author_name` lấy từ hồ sơ người đăng. `facility_name`, `court_name`, `play_date` và `start_at` lấy theo đơn đặt liên kết. `accepted_count` là số đơn ứng tuyển có `status = 'ACCEPTED'` của bài, bằng `0` khi chưa duyệt ai.
* **Database Transaction:** Không.
* **Response (200 OK - Paginated List chuẩn 2.1.B):**
  ```json
  {
    "success": true,
    "message": "Lấy danh sách bài đăng ghép trận thành công.",
    "data": [
      {
        "id": 1,
        "user_id": 12,
        "author_name": "Nguyễn Minh An",
        "booking_id": 105,
        "facility_name": "Cơ Sở Cầu Lông & Pickleball Kỳ Hòa",
        "court_name": "Sân Cầu Lông 1 (Thảm Yonex)",
        "play_date": "2026-11-10",
        "start_at": "2026-11-10T09:00:00Z",
        "title": "Cần tìm 2 bạn đánh đôi cầu lông trình độ trung bình khá",
        "players_needed": 2,
        "accepted_count": 1,
        "status": "OPEN",
        "created_at": "2026-11-08T09:00:00Z"
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

#### 6.2 Tạo bài đăng tìm đồng đội
* **Endpoint:** `POST /api/v1/team-posts`
* **Mô tả:** Người chơi đã đặt sân (`booking_id`) tạo bài đăng tìm đồng đội chia sẻ chi phí/giao lưu.
* **Quyền truy cập:** `customer` (chủ sở hữu đơn đặt sân).
* **Database Transaction:** **BẮT BUỘC (KIỂM TRA QUYỀN SỞ HỮU & TRẠNG THÁI ĐƠN)**
  * **Các bước kiểm tra ràng buộc nghiệp vụ:**
    1. *Kiểm tra quyền sở hữu đơn đặt:* Khóa hàng đơn đặt (`SELECT ... FOR UPDATE`). Trả `404 BOOKING_NOT_FOUND` nếu đơn không tồn tại hoặc `403 AUTH_FORBIDDEN` nếu `bookings.user_id` khác `current_user.id`.
    2. *Kiểm tra trạng thái đơn đặt:* Nếu trạng thái khác `DEPOSITED`, trả `400 BOOKING_NOT_DEPOSITED`.
    3. *Kiểm tra thời gian thi đấu:* Yêu cầu `bookings.start_at > :now`. Nếu đã đến giờ bắt đầu hoặc đã qua giờ chơi, trả `400 INVALID_BOOKING_TIME`.
    4. *Kiểm tra trùng bài đăng:* Mỗi đơn đặt sân chỉ có tối đa một bài `OPEN`. Nếu đã có bài `OPEN` cho đơn này, trả `409 TEAM_POST_ALREADY_EXISTS`.
  * Thực hiện INSERT bản ghi `team_posts` với `status = 'OPEN'`.
* **Request Body:** `title` tối đa 500 ký tự, `players_needed` là số nguyên từ `1` trở lên.
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
      "id": 10,
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
* **Mô tả:** Người chơi gửi yêu cầu đăng ký tham gia vào trận đấu ghép đội.
* **Quyền truy cập:** `customer`.
* **Database Transaction:** **BẮT BUỘC (KIỂM TRA CHỐNG TỰ ỨNG TUYỂN & CHỐNG ỨNG TUYỂN TRÙNG LẶP)**
  * **Các bước kiểm tra ràng buộc nghiệp vụ:**
    1. *Kiểm tra bài đăng:* Khóa bài đăng (`SELECT ... FOR UPDATE`). Trả `404 TEAM_POST_NOT_FOUND` nếu bài không tồn tại hoặc `400 TEAM_POST_CLOSED` nếu trạng thái khác `OPEN`.
    2. *Chặn tự ứng tuyển vào bài của chính mình:* Nếu `current_user.id = team_posts.user_id`, trả `400 CANNOT_APPLY_OWN_POST`.
    3. *Chặn ứng tuyển trùng lặp:* Nếu đã có đơn `PENDING` hoặc `ACCEPTED` của người gọi cho bài này, trả `409 APPLICATION_ALREADY_EXISTS`.
  * Nếu chưa có bản ghi, tạo đơn `PENDING`. Nếu đơn trước đó đã `REJECTED` và bài vẫn `OPEN`, dùng lại bản ghi theo khóa duy nhất `(post_id, user_id)`, đặt lại `status = 'PENDING'`, `message` và `created_at` theo lần gửi mới. Cả hai trường hợp trả `201`.
* **Request Body:** `message` là chuỗi tùy chọn, có thể là `null`.
  ```json
  {
    "message": "Mình đánh cầu lông 2 năm, xin tham gia giao lưu nhé!"
  }
  ```
* **Response (201 Created):**
  ```json
  {
    "success": true,
    "message": "Gửi yêu cầu tham gia thành công. Vui lòng chờ chủ bài đăng phê duyệt.",
    "data": {
      "id": 25,
      "post_id": 10,
      "user_id": 15,
      "status": "PENDING",
      "message": "Mình đánh cầu lông 2 năm, xin tham gia giao lưu nhé!"
    }
  }
  ```

#### 6.4 Phê duyệt ứng viên tham gia ghép đội
* **Endpoint:** `PATCH /api/v1/team-posts/{id}/applications/{app_id}`
* **Mô tả:** Chủ bài đăng duyệt (`ACCEPTED`) hoặc từ chối (`REJECTED`) người đăng ký.
* **Quyền truy cập:** `customer` (chủ sở hữu bài đăng).
* **Database Transaction:** **BẮT BUỘC**.
  1. Khóa bài đăng (`SELECT ... FOR UPDATE`). Trả `404 TEAM_POST_NOT_FOUND` nếu bài không tồn tại, `403 AUTH_FORBIDDEN` nếu người gọi không phải chủ bài, hoặc `400 TEAM_POST_CLOSED` nếu trạng thái bài khác `OPEN`.
  2. Khóa và kiểm tra đơn ứng tuyển. Trả `404 APPLICATION_NOT_FOUND` nếu `app_id` không tồn tại hoặc thuộc bài khác, và `400 APPLICATION_NOT_PENDING` nếu đơn có trạng thái khác `PENDING`.
  3. Cập nhật trạng thái đơn. Khi duyệt `ACCEPTED`, nếu số đơn `ACCEPTED` đạt `players_needed`, đổi bài thành `CLOSED` và chuyển mọi đơn `PENDING` còn lại thành `REJECTED` trong cùng transaction.
* **Request Body:** `status` chỉ nhận `ACCEPTED` hoặc `REJECTED`.
  ```json
  {
    "status": "ACCEPTED"
  }
  ```
* **Response (200 OK):**
  ```json
  {
    "success": true,
    "message": "Cập nhật trạng thái ứng viên thành công.",
    "data": {
      "id": 25,
      "post_id": 10,
      "user_id": 15,
      "status": "ACCEPTED"
    }
  }
  ```

#### 6.5 Xem danh sách ứng viên của bài đăng ghép đội (Paginated List)
* **Endpoint:** `GET /api/v1/team-posts/{id}/applications`
* **Quyền truy cập:** Chỉ người đã tạo bài (`team_posts.user_id = current_user.id`). Nếu bài không tồn tại, trả `404 TEAM_POST_NOT_FOUND`. Nếu người gọi không phải chủ bài, trả `403 AUTH_FORBIDDEN`.
* **Query Params:** `page=1`, `limit=10`. Trả ứng tuyển ở mọi trạng thái, sắp xếp `created_at DESC, id DESC`. Nếu chưa có ứng viên, trả `200` với `data: []`.
* **Trường trả về:** `id`, `user_id`, `name` lấy từ hồ sơ ứng viên, `message` (có thể là `null`), `status`, `created_at` (ISO 8601 UTC).
* **Database Transaction:** Không.
* **Response (200 OK - Paginated List chuẩn 2.1.B):**
  ```json
  {
    "success": true,
    "message": "Lấy danh sách ứng viên thành công.",
    "data": [
      {
        "id": 25,
        "user_id": 15,
        "name": "Trần Ngọc Mai",
        "message": "Mình đánh cầu lông 2 năm, xin tham gia giao lưu nhé!",
        "status": "PENDING",
        "created_at": "2026-11-08T10:00:00Z"
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

---

## 📋 BẢNG TỔNG HỢP HTTP STATUS CODES & BUSINESS ERROR CODES (TASK SCB-54)

| Nhóm | Mã lỗi (`code`) | HTTP Status | Ý nghĩa & Tình huống phát sinh |
| :--- | :--- | :---: | :--- |
| **1. Chung (Common)** | `INVALID_REQUEST` | **400** | Yêu cầu không hợp lệ hoặc dữ liệu sai quy tắc logic nghiệp vụ. |
| | `VALIDATION_ERROR` | **422** | Sai định dạng Schema (Pydantic validation). Trả về chi tiết mảng `details`. |
| | `RESOURCE_NOT_FOUND` | **404** | Không tìm thấy tài nguyên yêu cầu trong hệ thống. |
| | `INTERNAL_SERVER_ERROR` | **500** | Lỗi server nội bộ hoặc Database Exception ngoài ý muốn. |
| **2. Xác thực & Phân quyền** | `AUTH_INVALID_CREDENTIALS` | **401** | Email hoặc mật khẩu không chính xác khi đăng nhập. |
| | `AUTH_TOKEN_EXPIRED` | **401** | Access token JWT đã hết hạn (`exp`), cần đăng nhập lại. |
| | `AUTH_TOKEN_INVALID` | **401** | Token không đúng định dạng JWT hoặc chữ ký xác thực HMAC không hợp lệ. |
| | `AUTH_UNAUTHORIZED` | **401** | Request yêu cầu đăng nhập nhưng thiếu Header `Authorization: Bearer <token>`. |
| | `AUTH_FORBIDDEN` | **403** | Đã xác thực nhưng không đủ quyền thực hiện hành động. |
| | `AUTH_EMAIL_EXISTS` | **409** | Email đã được sử dụng bởi tài khoản khác trong hệ thống. |
| | `AUTH_PHONE_EXISTS` | **409** | Số điện thoại đã được đăng ký trong hệ thống. |
| **3. Cơ sở, Sân & Bảng giá** | `FACILITY_NOT_FOUND` | **404** | Không tìm thấy cơ sở thể thao (`facilities`) theo ID yêu cầu. |
| | `COURT_NOT_FOUND` | **404** | Không tìm thấy sân con (`courts`) theo ID yêu cầu. |
| | `COURT_INACTIVE` | **400** | Sân con đang tạm dừng hoạt động hoặc bảo trì (`is_active = false`). |
| | `CANNOT_UPDATE_COURT_SCHEDULE_ACTIVE_BOOKINGS` | **400** | Không thể thu hẹp giờ mở/đóng cửa vì còn lịch đặt cọc `DEPOSITED` trong tương lai. |
| | `CANNOT_DEACTIVATE_COURT_ACTIVE_BOOKINGS` | **400** | Không thể tạm ngưng sân vì còn lịch đặt cọc `DEPOSITED` trong tương lai. |
| | `TIME_SLOT_INVALID` | **400** | Khung giờ nằm ngoài giờ mở cửa/đóng cửa của sân. |
| | `PRICING_NOT_FOUND` | **404** | Chưa cấu hình bảng giá cơ sở hoặc bảng giá theo thời điểm cho khung giờ này. |
| **4. Đặt sân & Giữ chỗ** | `BOOKING_NOT_FOUND` | **404** | Không tìm thấy đơn đặt sân. |
| | `SLOT_ALREADY_BOOKED` | **409** | Khung giờ đã có người đặt cọc hoặc đang trong thời gian giữ chỗ hợp lệ (QĐ3). |
| | `INVALID_BOOKING_TIME` | **400** | Giờ bắt đầu phải ở tương lai khi đặt sân hoặc tạo bài ghép đội. |
| | `CANNOT_CANCEL_BOOKING` | **400** | Chỉ đơn `PENDING_DEPOSIT` hoặc `DEPOSITED` mới được hủy và chỉ khi `:now < start_at`. |
| | `CANNOT_DEPOSIT_EXPIRED_BOOKING` | **400** | Đơn đặt sân đã quá hạn giữ chỗ 10 phút, không thể thanh toán cọc. |
| | `CANNOT_SETTLE_BEFORE_START` | **400** | Buổi chơi chưa diễn ra (`:now < start_at`), không thể kết toán cọc cho chủ sân tại 4.3. |
| | `CANNOT_SETTLE_BOOKING` | **400** | Chỉ kết toán đơn `DEPOSITED`. Áp dụng cả khi đơn đã `COMPLETED` do kết toán trước đó. |
| **5. Ví & Tiền cọc** | `WALLET_NOT_FOUND` | **404** | Không tìm thấy ví nội bộ của người dùng trong hệ thống. |
| | `WALLET_INSUFFICIENT_BALANCE` | **402** | Số dư ví hiện tại không đủ 30% tiền cọc (vi phạm ràng buộc số dư QĐ4, QĐ6, ánh xạ từ `chk_wallets_balance`). |
| | `DEPOSIT_AMOUNT_INVALID` | **400** | Số tiền nạp cấp vào ví (`TOPUP`) hoặc tiền cọc phải lớn hơn 0 VNĐ. |
| **6. Ghép đội & Dịch vụ** | `BOOKING_NOT_DEPOSITED` | **400** | Đơn đặt sân chưa thanh toán cọc `DEPOSITED`, không thể tạo bài tìm đồng đội. |
| | `CANNOT_APPLY_OWN_POST` | **400** | Người tạo bài không thể tự gửi yêu cầu ứng tuyển vào bài đăng của chính mình. |
| | `APPLICATION_ALREADY_EXISTS` | **409** | Bạn đã có đơn ứng tuyển đang chờ duyệt hoặc đã được chấp thuận cho bài này. |
| | `TEAM_POST_CLOSED` | **400** | Chỉ có thể ứng tuyển hoặc xử lý đơn ứng tuyển khi bài ở trạng thái `OPEN`. |
| | `TEAM_POST_NOT_FOUND` | **404** | Không tìm thấy bài đăng ghép đội. |
| | `TEAM_POST_ALREADY_EXISTS` | **409** | Đơn đặt sân đã có bài đăng ghép đội `OPEN`. |
| | `APPLICATION_NOT_FOUND` | **404** | Không tìm thấy đơn ứng tuyển trong bài đăng được yêu cầu. |
| | `APPLICATION_NOT_PENDING` | **400** | Chỉ chủ bài mới được duyệt hoặc từ chối đơn `PENDING`. |

