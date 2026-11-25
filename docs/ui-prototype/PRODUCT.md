# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Người chơi (khách hàng), ưu tiên số một.** Người chơi cầu lông, pickleball, bóng đá mini tại Việt Nam. Họ cần tìm sân còn trống ở khu vực gần mình, biết tổng tiền trước khi đặt, đặt và cọc ngay mà không phải gọi điện hay nhắn Zalo hỏi từng sân. Khi có xung đột trong thiết kế, nhu cầu của người chơi thắng.
- **Chủ sân.** Tạo cơ sở và sân con, cấu hình giờ mở cửa và bảng giá theo thời điểm, xem lịch đặt, xác nhận buổi chơi đã xong. Chủ sân cũng là một người dùng, chỉ có thêm quyền quản lý sân.
- **Admin.** Cấp tiền vào ví người dùng, xem giao dịch, xác nhận buổi chơi.

## Product Purpose

Hệ thống web đặt sân và quản lý sân, dùng chung cho người chơi và chủ sân. Nó thay cách đặt sân qua điện thoại, Zalo, sổ tay và Excel, vốn gây ra trùng lịch, hoàn cọc tùy chủ sân và tính giá nhầm. Thành công là người chơi đặt được sân trống, biết trước tổng tiền và tiền cọc, và khi hủy được hoàn cọc theo quy định công bố trước, không phải thương lượng.

## Positioning

- Một hệ thống chung cho cả chủ sân và người chơi, không tách thành hai app.
- Chính sách cọc và hoàn cọc công khai, tính tự động qua ví nội bộ.
- Bảng giá theo khung giờ công khai, khách thấy tổng tiền trước khi đặt.
- Khung giờ đã cọc bị khóa, không ai khác đặt được.
- Hướng tới sân cầu lông, pickleball, bóng đá mini tại Việt Nam; tìm và lọc sân theo khu vực.

Đối thủ đã xét trong đề xuất: Datsan247, ALOBO / ALOBooking, Playtomic, CourtReserve (`../project-proposal.md`, mục 2).

## Operating Context

- Đồ án môn Nhập môn Công nghệ phần mềm (NMCNPM), HCMUS, nhóm 6. Giảng viên chấm qua tài liệu và bản demo.
- Người dùng truy cập bằng trình duyệt trên máy tính và điện thoại.
- `docs/ui-prototype/` là bản mẫu giao diện dùng dữ liệu mock, không gọi API: `app/` là app React, `site/index.html` là trang giới thiệu. Nhóm Frontend lấy bố cục, component và CSS từ đây sang `frontend/` khi làm trang thật.

## Capabilities and Constraints

Chức năng (đề xuất, mục 3.1.1): quản lý sân và bảng giá; tìm và đặt sân (lọc theo khu vực, bản đồ, lịch trống theo ngày, tổng tiền, chống đặt trùng); cọc và hoàn cọc qua ví; ghép đội (ưu tiên thấp); tiện ích như đánh giá sân, dịch vụ đi kèm (ưu tiên thấp).

Quy định nghiệp vụ phải giữ đúng:

| Mã | Nội dung |
| --- | --- |
| QĐ1 | Giờ thường: giá cơ sở. Giờ cao điểm, cuối tuần, ngày lễ: tăng 20%–50%. |
| QĐ2 | Tổng tiền = giá khung giờ × hệ số thời điểm + phí dịch vụ đi kèm. |
| QĐ3 | Khung giờ đã cọc bị khóa. |
| QĐ4 | Tiền cọc = 30% tổng tiền, trừ từ ví. Phần còn lại trả tại sân hoặc chuyển khoản trước giờ chơi. |
| QĐ5 | Hủy từ 24 giờ trở lên: hoàn 80% cọc; 12 đến dưới 24 giờ: 50%; dưới 12 giờ: 0%. |
| QĐ6 | Mọi dòng tiền đi qua ví và ghi thành giao dịch. Số dư không âm. Tiền vào ví do Admin cấp. |
| QĐ7 | Trạng thái đơn: Chờ đặt cọc → Đã đặt cọc → Đã thanh toán hoàn tất; hoặc Đã hủy. |

Ngoài phạm vi: app di động riêng; nạp và rút tiền thật qua cổng thanh toán; OTP qua SMS; chỉ đường trong app; chủ sân đánh giá người chơi.

Ràng buộc kỹ thuật của hệ thống thật: Frontend React, Backend FastAPI, MySQL, REST API, JWT, Bcrypt, HTTPS. Email qua Brevo, bản đồ Leaflet với OpenStreetMap.

## Brand Commitments

- Tên sản phẩm: **Sport Court Booking (SCB)**. Logo và giao diện ghi "SCB"; tiêu đề trang ghi đủ "SCB: Sport Court Booking".
- Mọi nội dung bằng tiếng Việt. Câu ngắn, mộc, không giọng AI, không câu sáo.

## Evidence on Hand

- Đề xuất dự án: `../project-proposal.md`. Báo cáo phân tích: `../analysis-report.md`. Danh sách API: `../api-endpoints.md`. Thực thể CSDL: `../database-entities.md`.
- Dữ liệu mẫu của bản mẫu: `app/src/data/mock.js` (cơ sở, sân con, người dùng, đơn, giao dịch, ngày lễ, bài ghép đội).
- Chưa có cơ sở, khách hàng, đánh giá, lời chứng thực hay số liệu thật. Không được bịa số liệu, đánh giá hay khách hàng; tên cơ sở và giá trong bản mẫu là dữ liệu mẫu.

## Product Principles

1. Người chơi thấy đúng và đủ trước khi trả tiền: lịch trống, tổng tiền, tiền cọc, mức hoàn khi hủy.
2. Quy định thay cho thương lượng: giá, cọc và hoàn cọc theo QĐ1–QĐ7, công khai, tính tự động.
3. Một hệ thống cho hai bên: thao tác của chủ sân và của người chơi là hai mặt của cùng một đơn.
4. Không hứa điều hệ thống không làm: không giả cổng thanh toán, không bịa bằng chứng xã hội.
