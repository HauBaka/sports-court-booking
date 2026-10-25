# Postman

Workspace Postman dùng chung để thử API. Request nằm trong `postman/`, đồng bộ qua Git.

## 1. Truy cập

- Workspace: mở `.postman/resources.yaml`, lấy `workspace.id`, hoặc xin lời mời từ PM.
- Postman bản desktop: mở thư mục repo bằng Local View, chọn environment `local` hoặc `dev`.

## 2. Environment

| Environment | Dùng cho | `base_url` |
| --- | --- | --- |
| `local` | Máy cá nhân | `http://localhost:8000/api/v1` |
| `dev` | Môi trường thử | Điền URL của môi trường thử |

Các biến `user_email`, `user_password`, `access_token`, `server_token` để trống trong Git. Mỗi người tự điền ở máy mình (dùng Current value, không dùng Initial value). Không commit mật khẩu hay token thật.

`access_token` tự được lưu sau khi chạy request 1.2 Đăng nhập. Các biến `facility_id`, `court_id`, `booking_id`... điền theo dữ liệu đang test.

## 3. Quy ước đặt tên

- Folder theo Epic: `Epic <số> - <Tên>`, khớp `docs/api-endpoints.md`.
- Request: `<số epic>.<số mục> <Tên mục>`, ví dụ `3.4 Thanh toán tiền cọc 30% qua ví nội bộ`.
- Địa chỉ luôn bắt đầu bằng `{{base_url}}`, không ghi cứng host.
- Request thêm mới đặt đúng folder Epic, đánh số tiếp theo `docs/api-endpoints.md`.
- Folder `Server Control` là công cụ khởi động lại server, không thuộc Epic nào.
