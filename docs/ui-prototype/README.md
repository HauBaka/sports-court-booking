# Bản mẫu giao diện SCB (Sport Court Booking)

Bản mẫu giao diện đầy đủ của hệ thống đặt sân, dùng dữ liệu mock (không gọi API). Không thay thế `frontend/`; FE lấy bố cục, component và CSS từ đây sang khi làm trang thật.

## Chạy

```
npm install
npm run dev        # chỉ app React, http://localhost:5173
npm run build      # build app vào site/app/
npm run preview    # phục vụ cả site/: trang giới thiệu ở /, app ở /app/
```

Vào nhanh bằng tài khoản mẫu: thêm `?demo=customer`, `?demo=owner` hoặc `?demo=admin` vào đường dẫn app, ví dụ `/app/?demo=owner#/chu-san/lich-dat`. Trang đăng nhập cũng có ba nút tài khoản mẫu. Menu tài khoản có mục đổi vai trò. Dữ liệu lưu ở localStorage (khóa `sanchung-prototype-v4`); xóa khóa này để về dữ liệu gốc.

## Cấu trúc

| Đường dẫn | Nội dung |
| --- | --- |
| `site/index.html` | Trang giới thiệu (HTML tĩnh, kit taste-skill trong `site/assets/`) |
| `site/app/` | App React đã build |
| `app/src/data/mock.js` | Dữ liệu mẫu: cơ sở, sân con, người dùng, đơn, giao dịch, ngày lễ, bài ghép đội |
| `app/src/data/store.jsx` | Kho dữ liệu thay cho REST API: đặt sân, cọc, hủy, kết toán, cấp tiền |
| `app/src/lib/pricing.js` | Tính tiền theo QĐ1, QĐ2, QĐ4, QĐ5 (ở hệ thống thật việc này do Backend làm) |
| `app/src/styles/app.css` | Hệ thống giao diện: màu, chữ, nút, thẻ, bảng, lưới khung giờ |

## Danh sách trang

| Vai trò | Trang | Đường dẫn app |
| --- | --- | --- |
| Mọi người | Trang giới thiệu | `../index.html` |
| Mọi người | Đăng nhập, đăng ký (có bước OTP, mã mẫu 246810) | `#/dang-nhap`, `#/dang-ky` |
| Mọi người | Tìm sân (lọc môn, thành phố, quận, từ khóa, lưới thẻ 2 cột, bản đồ, phân trang) | `#/tim-san` |
| Mọi người | Chi tiết cơ sở: lịch trống theo ngày, thông tin, dịch vụ, đánh giá (tab); bấm Đặt sân mở ngăn đặt sân bên phải | `#/san/:id` |
| Khách hàng, chủ sân | Xác nhận đặt sân, dịch vụ đi kèm, giữ chỗ 10 phút (cùng nội dung với ngăn đặt sân) | `#/dat-san` |
| Khách hàng, chủ sân | Đặt cọc 30% từ ví, đếm ngược giữ chỗ | `#/dat-san/:id` |
| Khách hàng, chủ sân | Kết quả đặt cọc | `#/dat-san/:id/xong` |
| Khách hàng, chủ sân | Lịch đặt của tôi, lọc theo trạng thái | `#/lich-dat` |
| Khách hàng, chủ sân | Chi tiết đơn, hủy với thanh mốc hoàn cọc, đánh giá | `#/lich-dat/:id` |
| Khách hàng | Ví và lịch sử giao dịch | `#/vi` |
| Khách hàng | Ghép đội: đăng bài, xin tham gia, duyệt | `#/ghep-doi` |
| Đã đăng nhập | Hồ sơ | `#/ho-so` |
| Chủ sân | Cơ sở của tôi | `#/chu-san` |
| Chủ sân | Tạo, sửa cơ sở, giờ mở cửa, sân con, khóa giờ (mọi ngày, có lý do) | `#/chu-san/co-so/:id` (`moi` để tạo) |
| Chủ sân | Bảng giá và hệ số, xem trước 7 ngày | `#/chu-san/bang-gia` |
| Chủ sân | Dịch vụ đi kèm | `#/chu-san/dich-vu` |
| Chủ sân | Lịch đặt theo ngày, danh sách đơn bên phải, xác nhận hoàn tất | `#/chu-san/lich-dat` (`?co-so=<id>` để chọn cơ sở) |
| Chủ sân | Ví chủ sân | `#/chu-san/vi` |
| Admin | Tổng quan, dọn giữ chỗ hết hạn | `#/admin` |
| Admin | Cấp tiền vào ví | `#/admin/cap-tien` |
| Admin | Giao dịch ví | `#/admin/giao-dich` |
| Admin | Đơn đặt sân | `#/admin/don-dat` |
| Admin | Danh mục ngày lễ | `#/admin/ngay-le` |

## Chỗ lệch với tài liệu

Bản mẫu khác tài liệu ở đâu thì làm theo `docs/api-endpoints.md` trên `dev`, sau đó tới ảnh màn hình `docs/images/pNN`. Từ bản mẫu chỉ lấy bố cục, component và CSS. Số mục trong bảng là số mục trong `api-endpoints.md`.

### Chung

| Bản mẫu | Làm theo |
| --- | --- |
| Dữ liệu mẫu, `localStorage`, `data/store.jsx` thay cho API | Gọi `services/` thật |
| FE tự tính tiền sân, cọc, tiền hoàn, số dư (`lib/pricing.js`, `bookingQuote`) | Quy chuẩn Zero-Math (phần 1 của `api-endpoints.md`): mọi số tiền lấy từ response 3.2, 3.4, 3.6, 4.1, 4.2, 4.3. Response không có số nào thì không hiện số đó |
| `HashRouter`, đường dẫn tiếng Việt (`#/tim-san`) | Giữ đường dẫn hiện có của `frontend/` (`/courts`, `/wallet`, `/owner/...`) |
| Lọc, sắp xếp, chia trang ở máy (`usePaged`) | Chia trang bằng `page`, `limit`, `meta` của API. Chỉ lọc theo tham số API nhận |
| Nhãn trạng thái và loại giao dịch trong `components/ui.jsx` | Dùng nhãn đang có ở `frontend/` (`utils/wallet.js`: Nạp tiền, Bồi thường, Quyết toán) |
| Giờ hiển thị theo giờ máy | API trả giờ UTC (`...Z`), đổi sang giờ Việt Nam khi hiện |
| Mã đơn `SC-24817`, mã giao dịch `T-...` | API chỉ trả `id` dạng số |
| Ảnh cơ sở, tiện ích, điểm đánh giá, tab và form đánh giá | Chưa có API, đánh giá thuộc chức năng 5. Không làm |
| Chủ sân đặt sân như khách, kể cả ở cơ sở của mình | SCB-254: đặt ở cơ sở khác được, cơ sở của mình bị 400 `CANNOT_BOOK_OWN_FACILITY`. Chờ SCB-254 merge |
| Khóa giờ theo sân con, có lý do (`LockBoard`) | Chưa có API. Không làm |
| Mã OTP mẫu 246810, nút tài khoản mẫu, `?demo=` | Ở local mã là 123456 (1.5) và không hiện trên giao diện. Bỏ nút tài khoản mẫu |
| Bản đồ minh họa ở trang tìm sân | Giữ Leaflet (SCB-188), ghim theo `latitude`, `longitude` |
| Ô thống kê, biểu đồ, bản đồ nhiệt hệ số, "Buổi sắp tới", tổng kết ngày | Mockup không có, API không có. Không làm |
| Admin tổng quan, giao dịch, đơn đặt, ngày lễ; ví chủ sân (p15, p17) | Ngoài Sprint 4. Riêng p15 và p17 vẽ sai luồng tiền: hoàn cọc đi từ ví hệ thống (4.2), chủ sân chỉ nhận `FORFEIT`, `SETTLE` |

### Đăng ký, đăng nhập (p01, p02)

| Bản mẫu | Làm theo |
| --- | --- |
| "Gửi mã" không gọi server, "Gửi lại mã" bấm được ngay | 1.5 `POST /auth/otp` với `purpose: "REGISTER"`. Đếm ngược 60 giây như p01, gửi sớm bị 429 `AUTH_OTP_TOO_SOON`. Email đã có bị 409 `AUTH_EMAIL_EXISTS` ngay ở bước này |
| Kiểm mã ở máy, hiện "Đã xác minh", tự đếm số lần thử | Mã chỉ được kiểm khi gửi 1.1 `POST /auth/register` kèm `otp_code`. Báo lỗi theo `AUTH_OTP_INVALID`, `AUTH_OTP_EXPIRED`, `AUTH_OTP_TOO_MANY_ATTEMPTS` |
| Đăng ký xong tự đăng nhập | 1.1 không trả token. Chuyển sang trang đăng nhập |
| Thiếu ô nhập lại mật khẩu và ô đồng ý điều khoản | Thêm như p01, chỉ kiểm ở máy |
| Đăng nhập không cần mật khẩu, không có "Quên mật khẩu?" | 1.2 `POST /auth/login`. Giữ trang `/forgot-password` đang có (1.5, 1.6) |

### Tìm sân, chi tiết sân (p03, p04)

| Bản mẫu | Làm theo |
| --- | --- |
| Lọc quận, sắp xếp, nhãn "N giờ trống" | 2.1 `GET /facilities` chỉ nhận `sport_id`, `city`, `search`. Không làm phần còn lại |
| Giá thấp nhất tự tính từ sân con; `street`, `district`, mã môn dạng chữ | `min_price`, `max_price`, `address`, `sport_id` dạng số của 2.1 |
| Lịch trống của cả cơ sở lấy một lần | 3.1 `GET /courts/{court_id}/slots?date=` cho từng sân con. Chọn ô bằng `time_slot_ids` |
| Ô Đóng, Khóa, Đã cọc, Hoàn tất, Đã hủy | 3.1 chỉ có `AVAILABLE`, `HOLDING`, `BOOKED`, `UNAVAILABLE` (giờ đã qua) |
| `type`, `indoor`, giá từng sân, chip quy tắc giá | `court_type`, `environment` (`INDOOR`, `OUTDOOR`). 2.2 không trả giá; quy tắc giá (2.8b) chỉ chủ sân đọc được nên không hiện |
| Thanh tạm tính cho mọi người | 3.2 `POST /bookings/calculate-price` chỉ cho `customer` đã đăng nhập |

### Đặt sân, đặt cọc (p05, p06)

| Bản mẫu | Làm theo |
| --- | --- |
| Giữ chỗ và trả cọc gộp một bước (`bookAndPay`) | Hai bước: 3.3 `POST /bookings` tạo đơn `PENDING_DEPOSIT`, rồi 3.4 `POST /bookings/{id}/deposit` |
| Giữ chỗ cố định 10 phút | Đếm theo `hold_expires_at` của 3.3, ngắn hơn 10 phút khi sát giờ chơi |
| Báo "Khung X vừa có người đặt" | 409 `SLOT_ALREADY_BOOKED` không nói khung nào. Xử lý thêm 402 `WALLET_INSUFFICIENT_BALANCE`, 400 `CANNOT_DEPOSIT_EXPIRED_BOOKING` |
| Chỉ có màn thành công | p06 có thẻ thất bại (thiếu tiền, hết giờ giữ). Bỏ nút "Yêu cầu cấp tiền" vì chưa có API |
| Chọn dịch vụ đi kèm | Giữ dù p05 không có. Gửi `services: [{service_id, quantity}]` |
| p05 có chuyển khoản, QR, ô họ tên và SĐT | Không làm. Chỉ cọc bằng ví (3.4), đơn gắn với tài khoản |

### Lịch đặt, hủy sân (p07, p08, chi tiết đơn)

| Bản mẫu | Làm theo |
| --- | --- |
| 5 tab trạng thái | 3 tab như p07: Sắp tới (`PENDING_DEPOSIT`, `DEPOSITED`), Đã hoàn thành, Đã hủy. 3.5 `GET /bookings?status=` nhận một trạng thái mỗi lần |
| Cả thẻ đơn là một link | Thêm nút Chi tiết và Hủy đặt như p07 |
| Chủ sân thấy nút Hủy ở chi tiết đơn | 4.2 chỉ cho khách chủ đơn hoặc admin hủy |
| Hủy trong modal, thanh kéo mốc 0/12/24 giờ | Trang hủy riêng như p08, số lấy từ 4.1 `GET /bookings/{id}/cancel-preview` (`refund_amount_to_player`, `rule_matched`, `customer_display_message`) |
| Không có lý do hủy; có dòng "Chuyển cho chủ sân" | Lý do và ghi chú như p08, gửi chung một chuỗi `cancel_reason` cho 4.2 `POST /bookings/{id}/cancel`. Bỏ dòng chuyển cho chủ sân. Bỏ dòng "Số dư sau khi hoàn" của p08 vì 4.1 không trả |

### Ví (p09)

| Bản mẫu | Làm theo |
| --- | --- |
| Danh sách có ghi chú, không có số dư sau | Bảng như p09: Thời gian, Loại, Mô tả, Số tiền, Số dư sau (`balance_after` của 5.2). Mô tả chỉ có `related_booking_id` |
| Số tiền âm trong dữ liệu mẫu | `amount` luôn dương, dấu suy từ `type`. Lọc bằng 5.2 `?type=` |

### Chủ sân: cơ sở, sân con, bảng giá (p10 đến p13)

| Bản mẫu | Làm theo |
| --- | --- |
| Một nút Lưu cho cả cơ sở, sân con và khóa giờ | Chưa có API sửa cơ sở. Sân con tạo ngay bằng 2.5 `POST /facilities/{id}/courts`, sửa bằng 2.7 `PATCH /courts/{court_id}` (tên, giờ, `is_active`) |
| Đổi giờ, tắt sân không kiểm đơn | Báo lỗi 400 `CANNOT_UPDATE_COURT_SCHEDULE_ACTIVE_BOOKINGS`, `CANNOT_DEACTIVATE_COURT_ACTIVE_BOOKINGS` |
| Sửa môn và giá trong modal sửa sân | 2.7 không đổi được `sport_id` và giá. Giá chỉ đặt một lần bằng `default_base_price` (2.5) |
| Chọn giờ từ 00:00 đến 23:59, dữ liệu mẫu có giờ lẻ 05:30 | Khung 1 giờ, từ 06:00 đến 23:00 (`time_slots`) |
| p12 có giờ theo từng thứ và thời lượng ca | Chưa có API. Giờ nằm trong form cơ sở và sân |
| Loại `PEAK`; một quy tắc cho cả cuối tuần, một cho mọi ngày lễ | 2.8: `PEAK_HOUR`; cuối tuần là hai quy tắc `day_of_week` 6 và 7; mỗi ngày lễ một quy tắc theo `holiday_id` (2.9); quy tắc nào cũng cần `name`. Làm như `PricingRulesSection` trên `dev` |
| Lưu bảng giá chung với sân | 2.8 `POST /facilities/{id}/pricing-rules` thay toàn bộ, đọc lại bằng 2.8b `GET` cùng đường dẫn |
| Dịch vụ bắt buộc đơn vị, giá lớn hơn 0 | 2.12: `unit` không bắt buộc, `unit_price` từ 0. Sửa giá, bật tắt bằng 2.13 `PATCH /services/{service_id}` |

### Lịch đặt theo ngày của chủ sân (p14)

| Bản mẫu | Làm theo |
| --- | --- |
| Ô hiện tên khách và trạng thái Hoàn tất, Đã hủy, Khóa | Trạng thái lấy từ 3.1 (bốn giá trị ở trên). API không trả tên khách |
| Danh sách đơn lấy từ kho mẫu | 3.5 `GET /bookings?facility_id=&from_date=&to_date=` |
| Nút "Xác nhận hoàn tất" | 4.3 `POST /bookings/{id}/complete`, chỉ khi đơn `DEPOSITED` và đã tới giờ chơi (400 `CANNOT_SETTLE_BEFORE_START`). Số tiền lấy `settled_deposit_amount` |

### Ghép đội (6.1 đến 6.4)

| Bản mẫu | Làm theo |
| --- | --- |
| Thẻ bài có môn, sân, giờ, trình độ, ghi chú, số người đã nhận | 6.1 `GET /team-posts` chỉ trả `title`, `players_needed`, `status`, `booking_id`, `user_id`. Phần còn lại chưa có API |
| Form đăng bài gồm số người, trình độ, ghi chú | 6.2 `POST /team-posts`: `booking_id`, `title`, `players_needed`. Chỉ đơn `DEPOSITED` chưa tới giờ, mỗi đơn một bài `OPEN` |
| Xin tham gia không kèm lời nhắn, vai trò nào cũng xin được | 6.3 `POST /team-posts/{id}/applications` có `message`, chỉ `customer` |
| Xem danh sách người xin, duyệt theo người dùng | Duyệt bằng 6.4 `PATCH /team-posts/{id}/applications/{app_id}`, đủ người thì bài tự `CLOSED`. API xem danh sách người xin chờ SCB-191 |

## Ghi chú

- Ảnh là ảnh minh họa từ Wikimedia Commons (danh sách và giấy phép ở `site/credits.html`), cần thay bằng ảnh sân thật.
- Bản đồ ở trang tìm sân là hình minh họa; bản thật dùng Leaflet và OpenStreetMap.
- Lịch nền (các ô "Đã đặt" không có đơn trong kho) được sinh giả lập để lưới trông như thật.
- Chủ sân đặt sân như khách (đề xuất mục 3). Phía API do SCB-254 làm, xem bảng chỗ lệch.
- Khóa giờ lưu ở `court_slots.is_active` và `lock_reason` (CSDL đã có). API chưa có endpoint khóa từng khung giờ, cần Backend bổ sung. Không khóa được khung giờ còn đơn chưa chơi.
