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

### 3. Thông tin tài khoản seed

| Email | Vai trò | Mật khẩu |
|---|---|---|
| `admin@scb.vn` | Admin | `TestPass123@` |
| `owner@scb.vn` | Owner | `TestPass123@` |
| `customer.a@scb.vn` | Customer | `TestPass123@` |
| `customer.b@scb.vn` | Customer | `TestPass123@` |

## Lưu ý

- **Không chạy seed trên production.** Seed chỉ dành cho môi trường dev/test.
- Migration dùng `DELIMITER //` — phải chạy qua `mysql` CLI hoặc tool hỗ trợ (DataGrip, DBeaver). Không chạy qua SQLAlchemy/pymysql trực tiếp.
- Thông tin kết nối DB lấy từ biến môi trường trong `backend/.env` (xem `backend/.env.example`).
