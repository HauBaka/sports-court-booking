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

## 4. Request theo kịch bản

Request kịch bản đặt tên `<tên request> - <mã kịch bản>`, ví dụ `1.1 Đăng ký tài khoản mới - AUTH-02`, nằm cạnh request gốc cùng mục. Test script trong request dùng đúng mã kịch bản của `docs/test-scenarios.md`.

- Chạy trên CSDL vừa nạp seed. `user_email`, `user_password` điền tài khoản seed (xem `database/README.md`), `facility_id` = 1, `court_id` = 1 (SAN-08 dùng sân 2).
- Đăng nhập (1.2) bằng đúng tài khoản trước khi chạy: AUTH-06 dùng Khách A, SAN-04, 05, 07, 08 dùng Chủ sân A, SAN-06 dùng Chủ sân B.
- AUTH-01 đăng ký `new.user@scb.vn`, chạy lại phải nạp lại seed.
- SAN-07 cần đơn "Đã đặt cọc" của sân 1 khung 22:00 đến 23:00 ngày mai, tạo trước khi chạy.
- SAN-01 đến 03 kiểm hàm hệ số bằng unit test, không có request Postman.
