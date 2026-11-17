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

## Ghi chú

- Ảnh là ảnh minh họa từ Wikimedia Commons (danh sách và giấy phép ở `site/credits.html`), cần thay bằng ảnh sân thật.
- Bản đồ ở trang tìm sân là hình minh họa; bản thật dùng Leaflet và OpenStreetMap.
- Lịch nền (các ô "Đã đặt" không có đơn trong kho) được sinh giả lập để lưới trông như thật.
- Chủ sân đặt sân như khách (đề xuất mục 3). API 3.3 `POST /api/v1/bookings` hiện chỉ cho `customer`, cần mở thêm `owner`.
- Khóa giờ lưu ở `court_slots.is_active` và `lock_reason` (CSDL đã có). API chưa có endpoint khóa từng khung giờ, cần Backend bổ sung. Không khóa được khung giờ còn đơn chưa chơi.
