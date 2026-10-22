# Sports Court Booking - Hệ thống Quản lý và Đặt sân Thể thao

Dự án môn học Nhập môn Công nghệ Phần mềm - Nhóm 6.

## Cấu trúc dự án

```text
sports-court-booking/
├── backend/       # FastAPI: mã nguồn API và unit test
├── frontend/      # React: mã nguồn giao diện
├── database/      # migration, script dữ liệu mẫu (seed)
├── docs/          # ERD, quy ước API, quyết định công nghệ
├── .github/       # workflow GitHub Actions, mẫu PR
├── docker-compose.yml # khởi chạy toàn bộ hệ thống bằng 1 lệnh
└── README.md
```

## Chạy nhanh bằng một lệnh (Docker Compose)

Yêu cầu: Đã cài đặt [Docker](https://www.docker.com/) và Docker Compose.

1. Khởi chạy toàn bộ hệ thống (MySQL + Backend):
   ```bash
   docker compose up --build
   ```

2. Truy cập các dịch vụ:
   - **Backend API Docs (Swagger):** [http://localhost:8000/docs](http://localhost:8000/docs)
   - **Healthcheck Endpoint:** [http://localhost:8000/health](http://localhost:8000/health)

3. Dừng hệ thống:
   ```bash
   docker compose down
   ```

## Hướng dẫn phát triển Backend độc lập

Xem chi tiết tại [backend/README.md](backend/README.md).
