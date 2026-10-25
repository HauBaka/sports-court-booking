# Deploy bản thử lên hosting

Hosting Pterodactyl chạy nhánh `dev`, và CSDL trên hosting được coi là production: dữ liệu ở đây là dữ liệu thật. Kiểm thử làm ở máy cá nhân với MySQL local. Hosting chỉ có một cổng public, nên FastAPI phục vụ cả API và giao diện React trên cùng cổng.

## 1. Cách hoạt động

| Thành phần | Cách chạy |
| --- | --- |
| Code | Lệnh khởi động trên panel đồng bộ nhánh `dev` về `/home/container`, rồi chạy `deploy/start.sh` |
| Frontend | CircleCI (`.circleci/config.yml`) build khi được duyệt (xem mục 4), đưa `dist.zip` lên Release `dev-latest`, rồi khởi động lại server. `start.sh` tải về giải nén vào `frontend/dist` |
| Backend | `backend/main.py` chạy uvicorn ở cổng `SERVER_PORT`. Có `FRONTEND_DIST` thì phục vụ luôn frontend ở `/` |
| CSDL | MySQL tạo ở tab Databases của panel. Tạo bảng bằng tay (xem mục 5) |

Đường dẫn: giao diện ở `/`, API ở `/api/v1/...`, Swagger ở `/docs`, kiểm tra sống ở `/api/v1/health`.

## 2. Cài lần đầu

1. Tab Databases: tạo một database, ghi lại host, cổng, user, mật khẩu, tên.
2. Điền biến môi trường (xem mục 3). Không ghi giá trị thật vào Git hay tài liệu. Tab Startup chỉ có những biến mà egg định nghĩa sẵn. Biến nào không có ở đó (như `DB_*`) thì tạo file `/home/container/backend/.env` bằng File Manager, nội dung theo `backend/.env.example`. File này nằm trong `.gitignore` nên lệnh khởi động không ghi đè.
3. Tab Startup, thay nội dung ô Startup Command bằng lệnh dưới (ô này chạy bằng bash, nhiều dòng được):

```bash
set -e
cd /home/container
BRANCH="${BRANCH:-dev}"
[ -d .git ] || git init -q
git remote get-url origin >/dev/null 2>&1 || git remote add origin https://github.com/HauBaka/sports-court-booking.git
git fetch origin "$BRANCH"
git checkout -f -B "$BRANCH" "origin/$BRANCH"
exec bash deploy/start.sh
```

4. Bấm Start. Log cần thấy `Starting API on port ...`.
5. Không chạy seed trên hosting. `S1__sample_data.sql` TRUNCATE toàn bộ bảng, chạy lên đây là mất dữ liệu thật. Dữ liệu mẫu chỉ dùng ở máy cá nhân.

## 3. Biến cấu hình

| Biến | Đặt ở đâu | Giá trị |
| --- | --- | --- |
| `BRANCH` | Tab Startup, ô nhánh có sẵn | `dev` |
| `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` | File `/home/container/backend/.env` | Lấy ở tab Databases |
| `ENVIRONMENT`, `DEBUG` | Không cần đặt | `start.sh` mặc định `production` và `False` |

Các ô khác của egg (link repo, file chạy, file requirements) không còn được dùng vì Startup Command đã thay bằng lệnh ở mục 2. `SERVER_PORT` do panel cấp, `backend/main.py` tự đọc. Tên biến của backend xem `backend/.env.example`.

## 4. Cập nhật bản mới sau khi merge vào `dev`

1. PR vào `dev` merge xong. Push không tự deploy: CircleCI chạy workflow `deploy` và dừng ở job `hold`.
2. Muốn deploy thì vào giao diện CircleCI, mở pipeline của commit đó, bấm **Approve** ở job `hold`. Sau đó `build-frontend` và `deploy` chạy: build frontend, đưa lên Release, gọi API khởi động lại server. Không bấm thì không deploy.
3. Đợi `deploy` xanh. Thiếu biến thì bước restart bị bỏ qua (có ghi trong log), khi đó bấm Restart trên panel.
4. Xem log trên panel có `Starting API on port ...`.
5. Mở `http://<địa chỉ hosting>:<cổng>/` và `/api/v1/health` kiểm tra. Trang kiểm tra sức khỏe của giao diện phải báo kết nối được API.

Biến cần có ở CircleCI (Project Settings, Environment Variables):

| Biến | Giá trị |
| --- | --- |
| `GH_TOKEN` | Personal Access Token của GitHub, chỉ cấp cho repo này, quyền `Contents: write`, dùng để đưa Release lên |
| `SERVER_URL` | Địa chỉ panel, dạng `https://<tên miền panel>`, không có dấu `/` ở cuối |
| `SERVER_ID` | ID server trên panel (chuỗi ngắn ở URL trang server, hoặc tab Settings) |
| `SERVER_AUTH_TOKEN` | API key tài khoản panel (Account, API Credentials) |

API key của panel có quyền trên cả tài khoản, không chỉ một server. Token và API key không dán vào chat, log hay file trong repo.

## 5. Lưu ý

- Hosting không tự chạy migration. Tạo bảng và đổi schema phải chạy file trong `database/migrations/` bằng tay lên CSDL của hosting, và nên backup trước.
- Sai biến DB thì API vẫn lên nhưng `/api/v1/health` báo `degraded`.
- Muốn quay lại bản cũ: đặt `BRANCH` sang nhánh hoặc tag khác rồi Restart. Schema đã đổi không tự lùi.
- Kiểm tra truy cập từ mạng khác bằng cách mở địa chỉ trên điện thoại dùng 4G, không dùng Wi-Fi của nhóm.
