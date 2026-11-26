# Database

Thư mục chứa migration và dữ liệu mẫu cho hệ thống Sports Court Booking.

## Yêu cầu

- MySQL 8.0.16+ hoặc MariaDB 10.5+ (cần hỗ trợ CHECK constraint và Generated column)
- Công cụ kết nối: `mysql` CLI, DataGrip, DBeaver hoặc tương đương
- Engine InnoDB, `STRICT_TRANS_TABLES` bật

## Cấu trúc

```
database/
├── migrations/
│   ├── V1__create_all_tables.sql   # Tạo toàn bộ bảng, ràng buộc và trigger
│   ├── V2 ... V4                   # Bổ sung cột, bảng email_otps, UNIQUE (email, purpose)
│   └── V5__team_posts_indexes.sql  # Ghép đội: thêm created_at cho đơn ứng tuyển, index (status, created_at)
├── seeds/
│   ├── S1__sample_data.sql         # Dữ liệu cũ (bị S2 xóa và nạp lại)
│   ├── S2__seed_e2.sql             # Người dùng, ví, cơ sở, sân, giá
│   ├── S3__seed_e3.sql             # OTP, ví khách, đơn DEPOSITED ngày mai
│   └── S4__seed_e4.sql             # Đơn đủ trạng thái, hoàn cọc, kết toán, bài ghép đội
└── tests/
    ├── T1 ... T4                   # Kiểm thử ràng buộc (chạy sau seed)
    └── T5__team_posts_constraint_tests.sql  # CHECK players_needed, status của ghép đội
```

## Cách chạy

### 1. Chạy migration (tạo bảng)

```bash
mysql -h <host> -P <port> -u <user> -p'<password>' <database> \
  < database/migrations/V1__create_all_tables.sql
```

### 2. Chạy seed (dữ liệu mẫu — chỉ dùng cho dev/test)

```bash
mysql -h <host> -P <port> -u <user> -p'<password>' <database> \
  < database/seeds/S1__sample_data.sql
```

> Script seed tự TRUNCATE toàn bộ bảng trước khi chèn, có thể chạy lại nhiều lần.

### 3. Thông tin tài khoản seed (sau khi chạy S2, S3 và S4)

| Email | Vai trò | Mật khẩu | Số dư ví |
|---|---|---|---|
| `system@internal.scb` | Hệ thống (giữ cọc) | `TestPass123@` | 300.000đ |
| `admin@scb.vn` | Admin | `TestPass123@` | 0đ |
| `owner1@scb.vn` | Owner (Cơ sở 1) | `TestPass123@` | 120.000đ |
| `owner2@scb.vn` | Owner (Cơ sở 2) | `TestPass123@` | 0đ |
| `customer.a@scb.vn` | Customer | `TestPass123@` | 500.000đ |
| `customer.b@scb.vn` | Customer | `TestPass123@` | 200.000đ |
| `customer.c@scb.vn` | Customer | `TestPass123@` | 200.000đ |
| `customer.d@scb.vn` | Customer | `TestPass123@` | 280.000đ |

Đơn mẫu: 1 đơn `DEPOSITED` của `customer.b@scb.vn`, Sân Cầu Lông 1, ngày mai 08:00 đến 10:00, tổng 200.000đ, cọc 100.000đ.

> - Đơn mẫu và OTP còn hạn tính theo ngày giờ lúc nạp seed. Nạp lại S3 trước mỗi lần test để có dữ liệu đúng ngày.
> - Thứ tự chạy: migrations (V1 đến V5), rồi S2, S3, S4. S3 và S4 dựa vào user, ví, sân và khung giờ của S2. S1 là dữ liệu cũ, bị S2 xóa và nạp lại.

### 4. Dữ liệu mẫu E4 (S4)

Đơn dùng Sân Cầu Lông 2 (khung 10:00 đến 12:00), mỗi đơn tổng 200.000đ, cọc 50% là 100.000đ. Riêng đơn 1 là đơn của S3.

| Đơn | Khách | Ngày chơi | Trạng thái | Giao dịch ví |
|---|---|---|---|---|
| 1 | B | Ngày mai (Sân 1, 08:00 đến 10:00) | `DEPOSITED` | `DEPOSIT` 100.000đ |
| 2 | C | Ngày kia | `DEPOSITED` | `DEPOSIT` 100.000đ |
| 3 | C | Hôm qua | `DEPOSITED`, chờ kết toán | `DEPOSIT` 100.000đ |
| 4 | D | 3 ngày trước | `COMPLETED` | `DEPOSIT`, `SETTLE` 100.000đ (hệ thống sang chủ sân 1) |
| 5 | D | 3 ngày sau | `CANCELLED` | `DEPOSIT` 100.000đ, `REFUND` 80.000đ, `FORFEIT` 20.000đ (QĐ5: hoàn 80%, refund + forfeit = cọc) |

Bài ghép đội: 1 bài `OPEN` của khách C gắn đơn 2, cần 2 người, có 1 đơn ứng tuyển `PENDING` của khách D.

> - Số dư mỗi ví bằng tổng giao dịch của ví đó (VI-05). Tổng số dư các ví là 1.600.000đ, bằng tổng các lần `TOPUP`.
> - S4 không có đơn ở các mốc T-30h, T-18h, T-6h vì mốc trôi theo giờ. Test hủy tự tạo đơn qua API.
> - S4 dựng lại các bảng đơn, khung giờ, giao dịch và ghép đội, kể cả đơn 1 của S3. Chạy lại nhiều lần không bị trùng dữ liệu.

## Lưu ý

- **Không chạy seed trên production.** Seed chỉ dành cho môi trường dev/test.
- **S3 và S4 có `TRUNCATE`** (xóa sạch bảng đơn, khung giờ, giao dịch). Chỉ chạy ở máy cá nhân và DB test của CI, không chạy lên DB server.
- Migration dùng `DELIMITER //` — phải chạy qua `mysql` CLI hoặc tool hỗ trợ (DataGrip, DBeaver). Không chạy qua SQLAlchemy/pymysql trực tiếp.
- Thông tin kết nối DB lấy từ biến môi trường trong `backend/.env` (xem `backend/.env.example`).
