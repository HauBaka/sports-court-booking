# Postman

Bản Postman free không dùng chung workspace được, nên collection và environment lưu dạng JSON trong `docs/postman-export/` và đồng bộ qua Git. Mỗi người tự import trên máy mình.

## 1. Truy cập

- Pull repo mới nhất.
- Import 3 file trong `docs/postman-export/`: `Sports Court Booking API.postman_collection.json`, `local.postman_environment.json`, `dev.postman_environment.json`. Chọn environment `local` hoặc `dev`.
- Không tạo hay tham gia workspace chung.
- Import lại các file JSON mỗi khi có người sửa collection.

## 1.1. Cập nhật file JSON

File JSON trong `docs/postman-export/` là nguồn chính. Sửa request trong Postman, export collection (Collection v2.1) hoặc environment rồi ghi đè file cũ cùng tên, commit cùng PR. Trước khi export, xóa Current value của các biến bí mật để không lộ mật khẩu hay token.

## 2. Environment

| Environment | Dùng cho | `base_url` |
| --- | --- | --- |
| `local` | Máy cá nhân | `http://localhost:8000/api/v1` |
| `dev` | Môi trường thử | Điền URL của môi trường thử |

Các biến `user_email`, `user_password`, `access_token`, `otp_code`, `server_token` để trống trong Git. Mỗi người tự điền ở máy mình (dùng Current value, không dùng Initial value). Không commit mật khẩu hay token thật.

`access_token` tự được lưu sau khi chạy request 1.2 Đăng nhập. Các biến `facility_id`, `court_id`, `booking_id`... điền theo dữ liệu đang test.

## 3. Quy ước đặt tên

- Folder theo Epic: `Epic <số> - <Tên>`, khớp `docs/api-endpoints.md`.
- Request: `<số epic>.<số mục> <Tên mục>`, ví dụ `3.4 Thanh toán tiền cọc 30% qua ví nội bộ`.
- Địa chỉ luôn bắt đầu bằng `{{base_url}}`, không ghi cứng host.
- Request thêm mới đặt đúng folder Epic, đánh số tiếp theo `docs/api-endpoints.md`.
- Folder `Server Control` là công cụ khởi động lại server, không thuộc Epic nào. Request gọi API của panel hosting (không phải API của Backend), xác thực bằng Bearer `{{server_token}}` là API key tài khoản panel (xem `docs/deploy.md` mục 4), không dùng `access_token`.

## 4. Request theo kịch bản

Request kịch bản đặt tên `<tên request> - <mã kịch bản>`, ví dụ `1.1 Đăng ký tài khoản mới - AUTH-03`, nằm trong folder `Test` của từng Epic (ví dụ `Epic 1 - Auth/Test`), tách khỏi request gốc. Postman chỉ để thử tay và các ca đặc biệt; kịch bản chạy tự động ở CI. Test script trong request dùng đúng mã kịch bản của `docs/test-scenarios.md`.

- Chạy trên CSDL vừa nạp seed. `user_email`, `user_password` điền tài khoản seed (xem `database/README.md`), `facility_id` = 1, `court_id` = 1 (SAN-08 dùng sân 2).
- Đăng nhập (1.2) bằng đúng tài khoản trước khi chạy: AUTH-06 dùng Khách A (`customer.a@scb.vn`), SAN-04, 05, 07, 08 dùng Chủ sân A (`owner1@scb.vn`), SAN-06 dùng Chủ sân B (`owner.b@scb.vn`, tạo khi chạy SAN-06).
- AUTH-01 đăng ký `new.user@scb.vn`, chạy lại phải nạp lại seed.
- SAN-07 cần đơn "Đã đặt cọc" của sân 1 khung 22:00 đến 23:00 ngày mai, tạo trước khi chạy.
- SAN-01 đến 03 kiểm hàm hệ số bằng unit test, không có request Postman.
- Từ Sprint 3 đăng ký cần OTP. Request đăng ký tự gọi `POST /auth/otp` ở pre-request rồi gửi `{{otp_code}}`. Ở `local` mã luôn là `123456`, điền `otp_code` = `123456`. Ở `dev` mã gửi qua email thật, mở mail rồi điền `otp_code` trước khi chạy request.
- Các ca ở mục 4.1, 6 của `docs/test-scenarios.md` cần seed E3 (`S3__seed_e3.sql`). Request tự đăng nhập đúng tài khoản ở pre-request (dùng `user_password`), không cần chạy 1.2 trước. Ngày chơi tự tính: `date_t` là thứ Ba kế tiếp, `date_tomorrow` là ngày mai.
- AUTH-13 đổi mật khẩu Khách A, chạy sau cùng rồi nạp lại seed.
- Chỉ có ở pytest, không có request Postman: AUTH-10 phần đếm 4 lần sai, GIA-09, DAT-02, COC-02, COC-03, COC-04, COC-08 (cần sửa DB hoặc tạo khách mới có ví).
