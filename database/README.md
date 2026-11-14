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
│   └── V1__create_all_tables.sql   # Tạo toàn bộ bảng, ràng buộc và trigger
├── seeds/
│   └── S1__sample_data.sql         # Dữ liệu mẫu cho môi trường dev/test
└── tests/
    └── T1__constraint_tests.sql    # Kiểm thử ràng buộc (chạy sau seed)
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

### 3. Thông tin tài khoản seed (sau khi chạy S2 và S3)

| Email | Vai trò | Mật khẩu | Số dư ví |
|---|---|---|---|
| `system@internal.scb` | Hệ thống (giữ cọc) | `TestPass123@` | 100.000đ |
| `admin@scb.vn` | Admin | `TestPass123@` | 0đ |
| `owner1@scb.vn` | Owner (Cơ sở 1) | `TestPass123@` | 0đ |
| `owner2@scb.vn` | Owner (Cơ sở 2) | `TestPass123@` | 0đ |
| `customer.a@scb.vn` | Customer | `TestPass123@` | 500.000đ |
| `customer.b@scb.vn` | Customer | `TestPass123@` | 200.000đ |

Đơn mẫu: 1 đơn `DEPOSITED` của `customer.b@scb.vn`, Sân Cầu Lông 1, ngày mai 08:00 đến 10:00, tổng 200.000đ, cọc 100.000đ.

> - Đơn mẫu và OTP còn hạn tính theo ngày giờ lúc nạp seed. Nạp lại S3 trước mỗi lần test để có dữ liệu đúng ngày.
> - Thứ tự chạy: migrations, rồi S2, rồi S3. S3 dựa vào user, ví, sân và khung giờ của S2. S1 là dữ liệu cũ, bị S2 xóa và nạp lại.

## Lưu ý

- **Không chạy seed trên production.** Seed chỉ dành cho môi trường dev/test.
- Migration dùng `DELIMITER //` — phải chạy qua `mysql` CLI hoặc tool hỗ trợ (DataGrip, DBeaver). Không chạy qua SQLAlchemy/pymysql trực tiếp.
- Thông tin kết nối DB lấy từ biến môi trường trong `backend/.env` (xem `backend/.env.example`).
