# QUY ƯỚC API: RESPONSE, MÃ LỖI VÀ XÁC THỰC

> **Tài liệu tham chiếu:** Task [SCB-54] - Dự án Hệ thống Quản lý và Đặt sân Thể thao  
> **Áp dụng cho:** Đội ngũ Frontend (React) và Backend (FastAPI)

---

## 1. NGUYÊN TẮC THIẾT KẾ CHUNG

1. **Giao thức & Định dạng:**
   - Toàn bộ giao tiếp sử dụng **HTTPS** và định dạng dữ liệu **JSON** (`Content-Type: application/json`).
   - Đường dẫn API gốc: `/api/v1/`
2. **Quy ước đặt tên (Naming Conventions):**
   - **URL/Endpoint:** Viết thường, nối bằng dấu gạch ngang (kebab-case), danh từ số nhiều cho tài nguyên.  
     *Ví dụ:* `/api/v1/courts`, `/api/v1/booking-slots`
   - **JSON Key (Body Request & Response):** Sử dụng **snake_case**.  
     *Ví dụ:* `court_id`, `start_time`, `total_amount`, `is_active`
   - **Query Parameters:** Sử dụng **snake_case**.  
     *Ví dụ:* `?page=1&limit=10&court_type=badminton`
3. **Thời gian (Date & Time):**
   - Tất cả thời gian gửi lên và trả về đều theo chuẩn **ISO 8601 UTC**:  
     `YYYY-MM-DDTHH:mm:ssZ` (Ví dụ: `2026-10-22T14:30:00Z`).
4. **Tiền tệ (Currency):**
   - Số tiền được trả về dưới dạng số nguyên (`integer`, đơn vị VNĐ), không dùng số thập phân.

---

## 2. QUY ƯỚC CẤU TRÚC RESPONSE (RESPONSE FORMAT)

Mọi phản hồi từ Backend đều có cấu trúc JSON thống nhất để Frontend dễ dàng viết bộ lọc dữ liệu (response interceptor).

### 2.1. Phản hồi thành công (Success Response)

#### A. Đối tượng đơn lẻ (Single Object)
Áp dụng cho các thao tác lấy chi tiết (`GET /courts/{id}`), tạo mới (`POST`), cập nhật (`PUT`/`PATCH`):

```json
{
  "success": true,
  "message": "Lấy thông tin sân thành công",
  "data": {
    "id": 1,
    "name": "Sân Cầu Lông A1",
    "court_type": "badminton",
    "price_per_hour": 120000,
    "created_at": "2026-10-22T08:00:00Z"
  }
}
```

#### B. Danh sách có phân trang (Paginated List)
Áp dụng cho các API lấy danh sách (`GET /courts`, `GET /bookings`, `GET /wallet/transactions`):

```json
{
  "success": true,
  "message": "Lấy danh sách sân thành công",
  "data": [
    {
      "id": 1,
      "name": "Sân Cầu Lông A1",
      "price_per_hour": 120000
    },
    {
      "id": 2,
      "name": "Sân Cầu Lông A2",
      "price_per_hour": 120000
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

#### C. Thao tác không trả về dữ liệu (No Content / Action Only)
Áp dụng cho các thao tác như xóa (`DELETE`), đăng xuất (`POST /auth/logout`):

```json
{
  "success": true,
  "message": "Hủy lịch đặt sân thành công",
  "data": null
}
```

---

## 3. QUY ƯỚC MÃ LỖI & PHẢN HỒI LỖI (ERROR HANDLING)

### 3.1. HTTP Status Codes chuẩn

| Status Code | Tên chuẩn | Khi nào sử dụng |
| :--- | :--- | :--- |
| **200** | OK | Thao tác thành công có dữ liệu trả về. |
| **201** | Created | Tạo mới tài nguyên thành công. |
| **204** | No Content | Xóa hoặc xử lý thành công không cần dữ liệu. |
| **400** | Bad Request | Dữ liệu gửi lên sai quy tắc logic nghiệp vụ. |
| **401** | Unauthorized | Chưa xác thực, token không hợp lệ hoặc đã hết hạn. |
| **403** | Forbidden | Đã xác thực nhưng không có quyền thực hiện hành động. |
| **404** | Not Found | Tài nguyên không tồn tại trong hệ thống. |
| **409** | Conflict | Xung đột trạng thái (ví dụ: đặt trùng khung giờ đã khóa). |
| **422** | Unprocessable Entity | Dữ liệu gửi lên không đúng định dạng Schema (Pydantic validation). |
| **500** | Internal Server Error | Lỗi hệ thống server ngoài ý muốn. |

### 3.2. Cấu trúc JSON phản hồi lỗi thống nhất

Khi xảy ra lỗi (HTTP Status >= 400), response trả về luôn tuân theo mẫu sau:

```json
{
  "success": false,
  "error": {
    "code": "SLOT_ALREADY_BOOKED",
    "message": "Khung giờ 19:00 - 20:00 ngày 25/10/2026 đã có người đặt cọc.",
    "details": null
  }
}
```

*Trường hợp lỗi Validate dữ liệu (HTTP 422), `details` sẽ chứa chi tiết từng trường bị sai:*
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Dữ liệu gửi lên không hợp lệ.",
    "details": [
      {
        "field": "phone_number",
        "issue": "Số điện thoại phải có 10 chữ số."
      },
      {
        "field": "start_time",
        "issue": "Thời gian bắt đầu không được ở quá khứ."
      }
    ]
  }
}
```

### 3.3. Bảng danh mục Business Error Codes

| Mã lỗi (`code`) | HTTP Status | Ý nghĩa & Tình huống xảy ra |
| :--- | :---: | :--- |
| **Chung (Common)** | | |
| `INVALID_REQUEST` | 400 | Yêu cầu không hợp lệ. |
| `VALIDATION_ERROR` | 422 | Sai định dạng hoặc thiếu các trường bắt buộc. |
| `RESOURCE_NOT_FOUND` | 404 | Không tìm thấy tài nguyên yêu cầu. |
| `INTERNAL_SERVER_ERROR` | 500 | Lỗi server nội bộ. |
| **Xác thực & Phân quyền (Auth)** | | |
| `AUTH_INVALID_CREDENTIALS` | 400 / 401 | Số điện thoại/Email hoặc mật khẩu không chính xác. |
| `AUTH_TOKEN_EXPIRED` | 401 | Access token đã hết hạn, cần đăng nhập lại. |
| `AUTH_TOKEN_INVALID` | 401 | Token không đúng định dạng hoặc chữ ký không hợp lệ. |
| `AUTH_UNAUTHORIZED` | 401 | Chưa truyền header Authorization Bearer token. |
| `AUTH_FORBIDDEN` | 403 | Không đủ quyền truy cập (ví dụ khách hàng gọi API admin). |
| **Sân & Bảng giá (Courts & Pricing)** | | |
| `COURT_NOT_FOUND` | 404 | Không tìm thấy sân yêu cầu. |
| `COURT_INACTIVE` | 400 | Sân đang tạm dừng hoạt động hoặc bảo trì. |
| `TIME_SLOT_INVALID` | 400 | Khung giờ nằm ngoài giờ mở cửa của sân. |
| `PRICING_NOT_FOUND` | 404 | Chưa cấu hình bảng giá cho khung giờ này. |
| **Đặt sân & Giữ chỗ (Bookings - QĐ1, QĐ2, QĐ3)** | | |
| `BOOKING_NOT_FOUND` | 404 | Không tìm thấy đơn đặt sân. |
| `SLOT_ALREADY_BOOKED` | 409 | Khung giờ đã được khách khác đặt cọc (khóa giờ theo QĐ3). |
| `INVALID_BOOKING_TIME` | 400 | Giờ bắt đầu phải nhỏ hơn giờ kết thúc, tối thiểu 1 tiếng. |
| `CANNOT_CANCEL_BOOKING` | 400 | Lịch đặt đã diễn ra hoặc đã hoàn tất, không thể hủy. |
| **Ví & Tiền cọc (Wallet & Payment - QĐ4, QĐ5, QĐ6)** | | |
| `WALLET_NOT_FOUND` | 404 | Không tìm thấy ví của người dùng. |
| `WALLET_INSUFFICIENT_BALANCE` | 400 | Số dư ví không đủ 30% tiền cọc (QĐ4, QĐ6). |
| `REFUND_NOT_ELIGIBLE` | 400 | Hủy dưới 12 giờ trước giờ chơi: không được hoàn cọc (QĐ5). |
| `DEPOSIT_AMOUNT_INVALID` | 400 | Số tiền nạp cấp vào ví phải lớn hơn 0. |

---

## 4. QUY ƯỚC XÁC THỰC & PHÂN QUYỀN (AUTHENTICATION & AUTHORIZATION)

### 4.1. Cơ chế xác thực
- Hệ thống sử dụng **JSON Web Token (JWT)** chuẩn HMAC-SHA256.
- Khi người dùng đăng nhập thành công qua `POST /api/v1/auth/login`, Backend trả về `access_token`.
- Frontend lưu `access_token` vào `localStorage` hoặc bộ nhớ an toàn.

### 4.2. Truyền Token qua Header
Mọi request cần xác thực bắt buộc phải đính kèm Header:
```http
Authorization: Bearer <access_token>
```

### 4.3. Cấu trúc Payload của JWT Token
```json
{
  "sub": 12,
  "email": "customer@example.com",
  "role": "customer",
  "exp": 1792670400,
  "iat": 1792584000
}
```

### 4.4. Phân quyền người dùng (User Roles)
Hệ thống gồm 3 nhóm quyền người dùng:
1. `customer`: Khách hàng tìm sân, đặt sân, hủy đặt cọc, xem ví cá nhân.
2. `owner`: Chủ sân có toàn quyền quản lý cụm sân, sân con, giờ mở cửa, bảng giá thời điểm của mình; xem lịch đặt và ví chủ sân.
3. `admin`: Quản trị viên cấp cao: cấp tiền vào ví người dùng (QĐ6), quản lý tài khoản toàn hệ thống.

---

## 5. HƯỚNG DẪN TÍCH HỢP DÀNH CHO FRONTEND (REACT)

Đoạn mã mẫu cấu hình Axios Interceptor cho Frontend để tự động áp dụng quy ước:

```javascript
import axios from 'axios';

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request Interceptor: Tự động gắn token
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor: Xử lý Response chuẩn và mã lỗi
apiClient.interceptors.response.use(
  (response) => {
    // Trả thẳng dữ liệu từ payload chuẩn { success, message, data, meta }
    return response.data;
  },
  (error) => {
    const status = error.response ? error.response.status : null;
    const errorData = error.response ? error.response.data?.error : null;

    if (status === 401) {
      // Hết hạn phiên đăng nhập -> Đăng xuất và điều hướng về trang Login
      localStorage.removeItem('access_token');
      window.location.href = '/login?expired=true';
    }

    // Ném lỗi để component/toast hiển thị error.message hoặc error.code
    return Promise.reject(errorData || {
      code: 'NETWORK_ERROR',
      message: 'Không thể kết nối đến máy chủ. Vui lòng thử lại!'
    });
  }
);

export default apiClient;
```

---

## 6. QUY TRÌNH REVIEW & XÁC NHẬN

- [ ] Phía **Backend**: Đã hoàn thiện văn bản và cam kết phản hồi đúng cấu trúc.
- [ ] Phía **Frontend** (phụ trách: Đăng): Đã đọc, thảo luận và đồng ý với các định dạng trên để tiến hành xây dựng giao diện.
