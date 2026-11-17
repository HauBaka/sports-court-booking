# Bản mẫu giao diện Sân Chung

Bản mẫu giao diện đầy đủ của hệ thống đặt sân, dùng dữ liệu mock (không gọi API). Không thay thế `frontend/`; FE lấy bố cục, component và CSS từ đây sang khi làm trang thật.

## Chạy

```
npm install
npm run dev        # chỉ app React, http://localhost:5173
npm run build      # build app vào site/app/
npm run preview    # phục vụ cả site/: trang giới thiệu ở /, app ở /app/
```

Vào nhanh bằng tài khoản mẫu: thêm `?demo=customer`, `?demo=owner` hoặc `?demo=admin` vào đường dẫn app, ví dụ `/app/?demo=owner#/chu-san/lich-dat`. Trang đăng nhập cũng có ba nút tài khoản mẫu. Menu tài khoản có mục đổi vai trò. Dữ liệu lưu ở localStorage (khóa `sanchung-prototype-v2`); xóa khóa này để về dữ liệu gốc.

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
| Mọi người | Tìm sân (lọc môn, thành phố, quận, từ khóa, bản đồ, phân trang) | `#/tim-san` |
| Mọi người | Chi tiết cơ sở, lịch trống theo ngày, đánh giá | `#/san/:id` |
| Khách hàng | Xác nhận đặt sân, dịch vụ đi kèm, giữ chỗ 10 phút | `#/dat-san` |
| Khách hàng | Đặt cọc 30% từ ví, đếm ngược giữ chỗ | `#/dat-san/:id` |
| Khách hàng | Kết quả đặt cọc | `#/dat-san/:id/xong` |
| Khách hàng | Lịch đặt của tôi, lọc theo trạng thái | `#/lich-dat` |
| Khách hàng | Chi tiết đơn, hủy và xem trước hoàn cọc, đánh giá | `#/lich-dat/:id` |
| Khách hàng | Ví và lịch sử giao dịch | `#/vi` |
| Khách hàng | Ghép đội: đăng bài, xin tham gia, duyệt | `#/ghep-doi` |
| Đã đăng nhập | Hồ sơ | `#/ho-so` |
| Chủ sân | Cơ sở của tôi | `#/chu-san` |
| Chủ sân | Tạo, sửa cơ sở, giờ mở cửa, sân con | `#/chu-san/co-so/:id` (`moi` để tạo) |
| Chủ sân | Bảng giá và hệ số, xem trước 7 ngày | `#/chu-san/bang-gia` |
| Chủ sân | Dịch vụ đi kèm | `#/chu-san/dich-vu` |
| Chủ sân | Lịch đặt theo ngày, xác nhận hoàn tất | `#/chu-san/lich-dat` |
| Chủ sân | Ví chủ sân | `#/chu-san/vi` |
| Admin | Tổng quan, dọn giữ chỗ hết hạn | `#/admin` |
| Admin | Cấp tiền vào ví | `#/admin/cap-tien` |
| Admin | Giao dịch ví | `#/admin/giao-dich` |
| Admin | Đơn đặt sân | `#/admin/don-dat` |
| Admin | Danh mục ngày lễ | `#/admin/ngay-le` |

## Ghi chú

- Tên "Sân Chung" là tên tạm cho bản mẫu. Ảnh là ảnh minh họa từ Wikimedia Commons (danh sách và giấy phép ở `site/credits.html`), cần thay bằng ảnh sân thật.
- Bản đồ ở trang tìm sân là hình minh họa; bản thật dùng Leaflet và OpenStreetMap.
- Lịch nền (các ô "Đã đặt" không có đơn trong kho) được sinh giả lập để lưới trông như thật.
