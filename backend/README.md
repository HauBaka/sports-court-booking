# Backend - Sports Court Booking API

Hệ thống API Backend xây dựng trên **Python (FastAPI)** kết nối cơ sở dữ liệu **MySQL**.

## Yêu cầu môi trường
- Python 3.11 hoặc 3.12
- MySQL 8.0 (hoặc chạy qua Docker)

## Cài đặt và chạy môi trường ảo (Local Development)

1. Di chuyển vào thư mục `backend`:
   ```bash
   cd backend
   ```

2. Tạo và kích hoạt môi trường ảo:
   ```bash
   # Windows PowerShell
   python -m venv .venv
   .\.venv\Scripts\Activate.ps1

   # Linux/macOS
   python3 -m venv .venv
   source .venv/bin/activate
   ```

3. Cài đặt thư viện:
   ```bash
   pip install -r requirements.txt
   ```

4. Cấu hình biến môi trường:
   ```bash
   cp .env.example .env
   # Chỉnh sửa thông tin kết nối DB nếu cần
   ```

5. Khởi động server:
   ```bash
   uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
   ```

6. Kiểm tra:
   - Swagger UI: [http://localhost:8000/docs](http://localhost:8000/docs)
   - Healthcheck: [http://localhost:8000/health](http://localhost:8000/health)

## Chạy Unit Test

Chạy lệnh:
```bash
pytest tests/ -v
```
