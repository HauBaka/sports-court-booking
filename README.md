# Sports Court Booking

Hệ thống quản lý và đặt sân thể thao trực tuyến.

## Cấu trúc thư mục

```text
sports-court-booking/
├── frontend/   # React + Vite: giao diện
├── backend/    # FastAPI: API, unit test
├── database/   # migration, seed, test ràng buộc (MySQL)
├── postman/    # collection, environment để thử API
├── docs/       # đề xuất dự án, ERD, quy ước API, danh sách endpoint
└── .github/    # workflow CI
```

## Tài liệu

| Tài liệu | Nội dung |
| --- | --- |
| [docs/project-proposal.md](docs/project-proposal.md) | Đề xuất dự án |
| [docs/database-entities.md](docs/database-entities.md) | Mô tả các bảng dữ liệu |
| [docs/erd.svg](docs/erd.svg) | Sơ đồ ERD |
| [docs/api-conventions.md](docs/api-conventions.md) | Quy ước thiết kế API |
| [docs/api-endpoints.md](docs/api-endpoints.md) | Danh sách endpoint |
| [docs/postman.md](docs/postman.md) | Hướng dẫn dùng workspace Postman |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Quy tắc branch, commit, PR |

## Yêu cầu

- Node.js 22.12 trở lên
- Python 3.11 hoặc 3.12
- MySQL 8.0.16 trở lên

## Cài đặt và chạy

Chạy theo thứ tự: database, backend, frontend.

### 1. Database

Tạo database rỗng, tạo bảng (migration), nạp dữ liệu mẫu (seed):

```bash
mysql -u root -p -e "CREATE DATABASE sports_court_booking CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
mysql -u root -p sports_court_booking < database/migrations/V1__create_all_tables.sql
mysql -u root -p sports_court_booking < database/seeds/S1__sample_data.sql
```

> [!WARNING]
> Seed xoá sạch dữ liệu các bảng trước khi nạp, chỉ chạy ở máy cá nhân. Migration dùng `DELIMITER` nên phải chạy bằng `mysql` CLI (hoặc DataGrip, DBeaver); PowerShell không hỗ trợ `<`, hãy dùng Git Bash hoặc CMD. Tài khoản mẫu xem trong [database/README.md](database/README.md).

### 2. Backend

Chạy trong thư mục `backend/`.

#### Linux / macOS

```bash
cd backend
python3 -m venv .venv                 # tạo môi trường ảo, tách thư viện khỏi hệ thống
source .venv/bin/activate             # bật môi trường ảo
pip install -r requirements.txt       # cài thư viện
cp .env.example .env                  # tạo file cấu hình
uvicorn app.main:app --reload --port 8000   # chạy server, tự reload khi sửa code
```

#### Windows (PowerShell)

```powershell
cd backend
python -m venv .venv                  # tạo môi trường ảo, tách thư viện khỏi hệ thống
.\.venv\Scripts\Activate.ps1          # bật môi trường ảo
pip install -r requirements.txt       # cài thư viện
copy .env.example .env                # tạo file cấu hình
uvicorn app.main:app --reload --port 8000   # chạy server, tự reload khi sửa code
```

> [!NOTE]
> Sửa `DB_USER`, `DB_PASSWORD` trong `backend/.env` cho khớp MySQL trên máy bạn. Nếu PowerShell chặn chạy script, chạy `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` một lần rồi bật lại môi trường ảo.

Swagger UI: http://localhost:8000/docs

Chạy unit test backend (môi trường ảo đang bật, trong `backend/`):

```bash
pytest tests/ -v
```

### 3. Frontend

Mở terminal khác, chạy trong thư mục `frontend/`. Lệnh giống nhau trên Linux, macOS và Windows, riêng bước copy `.env` trên Windows PowerShell dùng `copy`.

```bash
cd frontend
cp .env.example .env     # tạo file cấu hình, VITE_API_URL trỏ tới backend
npm ci                   # cài thư viện đúng theo package-lock.json
npm run dev              # chạy dev server
```

Mở http://localhost:5173

Kiểm tra frontend (trong `frontend/`):

```bash
npm run lint     # kiểm tra lỗi code
npm test         # chạy unit test
npm run build    # build bản production
```

## Postman

Request thử API nằm trong `postman/`. Mở thư mục repo bằng Local View trong Postman bản desktop, chọn environment `local` hoặc `dev`. Hướng dẫn chi tiết xem [docs/postman.md](docs/postman.md).
