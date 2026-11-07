### ĐẠI HỌC KHOA HỌC TỰ NHIÊN TP HCM

### KHOA CÔNG NGHỆ THÔNG TIN

### BỘ MÔN CÔNG NGHỆ PHẦN MỀM

**NHẬP MÔN CÔNG NGHỆ PHẦN MỀM**

## Phân tích yêu cầu (Analysis Report)

**Đề tài:** Hệ thống Quản lý và Đặt sân Thể thao

**Nhóm:** 6

**MỤC LỤC**

- [1 Bảng đánh giá thành viên](#1-bảng-đánh-giá-thành-viên)
- [2 Mô tả bài toán](#2-mô-tả-bài-toán)
- [3 Tổng quan yêu cầu](#3-tổng-quan-yêu-cầu)
  - [3.1 Danh sách các stakeholder](#31-danh-sách-các-stakeholder)
  - [3.2 Danh sách yêu cầu](#32-danh-sách-yêu-cầu)
    - [3.2.1 Đặc tả yêu cầu chức năng](#321-đặc-tả-yêu-cầu-chức-năng)
    - [3.2.2 Đặc tả yêu cầu phi chức năng](#322-đặc-tả-yêu-cầu-phi-chức-năng)
- [4 Đặc tả yêu cầu](#4-đặc-tả-yêu-cầu)
  - [4.1 Sơ đồ Use Case](#41-sơ-đồ-use-case)
  - [4.2 Đặc tả Use Case](#42-đặc-tả-use-case)
- [5 Bản mẫu (Prototype)](#5-bản-mẫu-prototype)

# 1 Bảng đánh giá thành viên

| **MSSV** | **Họ Tên** | **% đóng góp (tối đa 100%)** | **Chữ ký** |
| --- | --- | --- | --- |
| 24120307 | Vòng Sau Hậu | 100% | |
| 24120264 | Nguyễn Huỳnh Gia Bảo | 100% | |
| 24120230 | Dương Danh Toàn | 100% | |
| 24120278 | Võ Văn Khánh Đăng | 100% | |
| 24120236 | Bùi Đặng Khả Tuân | 100% | |

# 2 Mô tả bài toán

#### Nghiệp vụ

Người chơi cầu lông, pickleball, bóng đá mini đặt sân qua điện thoại, Zalo hoặc Facebook. Chủ sân ghi lịch bằng sổ tay hoặc Excel, nhận cọc chuyển khoản và tự quyết định hoàn cọc. Ba vấn đề thường gặp: trùng lịch, hoàn cọc tùy chủ sân, giá đổi theo giờ cao điểm, cuối tuần, ngày lễ nên tính nhẩm dễ sai.

Hệ thống là ứng dụng web có ba nhóm người dùng:

- **Khách hàng** tìm sân còn trống, xem trước tổng tiền, đặt sân và đặt cọc 30% từ ví nội bộ, hủy sân và nhận hoàn cọc theo quy định.
- **Chủ sân** tạo cơ sở và sân con, cấu hình khung giờ, bảng giá, dịch vụ đi kèm; sau buổi chơi xác nhận hoàn tất để nhận tiền cọc.
- **Admin** cấp tiền vào ví người dùng, quản lý danh mục ngày lễ và kích hoạt dọn các đơn giữ chỗ hết hạn.

Mọi dòng tiền (cọc, hoàn cọc, tiền cọc bị mất, kết toán) đi qua ví nội bộ và được ghi thành giao dịch. Nạp và rút tiền thật nằm ngoài phạm vi.

#### Luồng nghiệp vụ chính

1. Khách tìm cơ sở theo môn, thành phố, từ khóa; xem lịch trống của sân con theo ngày.
2. Khách chọn các khung giờ, hệ thống tính tiền và tiền cọc. Khách tạo đơn, hệ thống giữ chỗ tối đa 10 phút (trạng thái `PENDING_DEPOSIT`).
3. Khách đặt cọc 30% từ ví trong thời gian giữ chỗ. Tiền chuyển sang ví hệ thống giữ hộ, đơn sang `DEPOSITED`, khung giờ bị khóa với mọi người khác.
4. Khách hủy: tiền cọc được hoàn hoặc mất theo mốc thời gian. Khách đến chơi: chủ sân xác nhận hoàn tất, tiền cọc chuyển từ ví hệ thống sang ví chủ sân, đơn sang `COMPLETED`.
5. Hết 10 phút mà chưa cọc, đơn tự hủy và khung giờ được nhả.

#### Quy định nghiệp vụ

| Mã | Nội dung |
| --- | --- |
| QĐ1 | Giờ thường: giá cơ sở. Giờ cao điểm, cuối tuần, ngày lễ: tăng 20%–50% so với giá cơ sở. Khung giờ thuộc nhiều quy tắc thì lấy hệ số cao nhất. |
| QĐ2 | Tổng tiền = giá khung giờ × hệ số thời điểm + phí dịch vụ đi kèm (nếu có). |
| QĐ3 | Khung giờ đã được đặt cọc sẽ bị khóa, không ai khác đặt được. |
| QĐ4 | Tiền cọc = 30% tổng tiền, trừ từ ví khách. Số tiền còn lại thanh toán tại sân hoặc chuyển khoản trước giờ chơi. |
| QĐ5 | Hủy từ 24 giờ trở lên trước giờ chơi: hoàn 80% cọc. Từ 12 đến dưới 24 giờ: hoàn 50%. Dưới 12 giờ: không hoàn. Tiền hoàn vào ví khách, phần không hoàn vào ví chủ sân. |
| QĐ6 | Mọi dòng tiền đi qua ví và được ghi thành giao dịch. Số dư ví không được âm. Tiền vào ví do Admin cấp. |
| QĐ7 | Trạng thái lịch đặt: Chờ đặt cọc (`PENDING_DEPOSIT`) → Đã đặt cọc (`DEPOSITED`) → Hoàn tất (`COMPLETED`); hoặc Đã hủy (`CANCELLED`). |

#### Môi trường hoạt động

- Client: trình duyệt web hỗ trợ HTML5/CSS3/JavaScript trên máy tính và điện thoại.
- Server: 1 vCPU, 1 GB RAM, 20 GB SSD.
- Dịch vụ ngoài: email Brevo; bản đồ Leaflet với dữ liệu OpenStreetMap.

#### Ràng buộc thiết kế và triển khai

- Frontend và Backend tách riêng, giao tiếp qua REST API (`/api/v1`, JSON).
- Frontend: React.js. Backend: Python (FastAPI). CSDL quan hệ: MySQL.
- Mật khẩu mã hóa bằng Bcrypt, giao tiếp qua HTTPS, xác thực bằng JWT.
- Tiền là số nguyên VNĐ; thời gian theo ISO 8601 UTC. Mọi tính toán tiền làm ở Backend, Frontend chỉ hiển thị.
- Mã nguồn quản lý bằng Git/GitHub.

#### Ngoài phạm vi

Ứng dụng di động riêng; nạp và rút tiền thật; SMS; chỉ đường trong ứng dụng; chủ sân đánh giá người chơi.

#### Thuật ngữ

| Thuật ngữ | Nghĩa |
| --- | --- |
| Cơ sở | Một cụm sân của một chủ sân, có địa chỉ và giờ mở cửa. |
| Sân con | Một sân cụ thể trong cơ sở (ví dụ Sân 1), thuộc một môn. |
| Khung giờ | Đơn vị thời gian nhỏ nhất có thể đặt của một sân con. |
| Giữ chỗ | Khóa tạm các khung giờ tối đa 10 phút để khách đặt cọc. |
| Tiền cọc | 30% tổng tiền, trừ từ ví khách khi đặt cọc. |
| Ví nội bộ | Tài khoản tiền trong hệ thống của mỗi người dùng; số dư không âm. |
| Ví hệ thống | Ví trung gian giữ tiền cọc cho đến khi hủy hoặc kết toán. |
| Hoàn cọc | Trả lại một phần tiền cọc vào ví khách khi hủy, theo QĐ5. |
| Kết toán | Chuyển tiền cọc từ ví hệ thống sang ví chủ sân sau buổi chơi. |
| Hệ số giá | Số nhân áp lên giá cơ sở ở giờ cao điểm, cuối tuần, ngày lễ. |

# 3 Tổng quan yêu cầu

#### 3.1 Danh sách các stakeholder

| STT | Stakeholder | Mô tả |
| --- | --- | --- |
| 1 | Khách hàng (người chơi) | Loại: end user. Tìm sân, đặt sân, đặt cọc, hủy, xem ví. Quan tâm giá rõ ràng và hoàn cọc công bằng. |
| 2 | Chủ sân | Loại: end user. Sở hữu cơ sở và sân con, đặt giá, nhận đơn, xác nhận hoàn tất, nhận tiền kết toán. Quan tâm không bị trùng lịch và được bồi thường khi khách hủy muộn. |
| 3 | Admin | Loại: system manager. Cấp tiền vào ví, quản lý ngày lễ, dọn đơn giữ chỗ hết hạn. |
| 4 | Đội phát triển (nhóm 6) | Loại: system manager. Xây dựng, kiểm thử, vận hành hệ thống. |
| 5 | Giảng viên môn Nhập môn CNPM | Loại: external stakeholder. Người đặt yêu cầu và đánh giá đồ án. |
| 6 | Dịch vụ email Brevo | Loại: external stakeholder. Bên ngoài, gửi email cho hệ thống. |
| 7 | Dịch vụ bản đồ OpenStreetMap / Leaflet | Loại: external stakeholder. Bên ngoài, cung cấp bản đồ hiển thị vị trí sân. |
| 8 | Bên cung cấp hosting/VPS | Loại: external stakeholder. Cung cấp máy chủ và MySQL. |

```text
                Khách hàng        Chủ sân          Admin
                    │                │                │
                    ▼                ▼                ▼
        ┌─────────────────────────────────────────────────┐
        │   Hệ thống Quản lý và Đặt sân Thể thao          │
        └─────────────────────────────────────────────────┘
                    │                │                │
                    ▼                ▼                ▼
             Email Brevo      OpenStreetMap       Hosting/VPS
```

#### 3.2 Danh sách yêu cầu

`FR-xx`: yêu cầu chức năng; `NFR-xx`: yêu cầu phi chức năng.

#### 3.2.1 Đặc tả yêu cầu chức năng

**Nhóm A. Tài khoản (nền tảng đăng nhập)**

| User Story | Requirement | Details |
| --- | --- | --- |
| Là người dùng mới, tôi muốn đăng ký tài khoản khách hàng hoặc chủ sân để dùng hệ thống. | FR-01 Đăng ký tài khoản | Nhập họ tên, email, số điện thoại (10 chữ số), mật khẩu, vai trò. Mật khẩu tối thiểu 8 ký tự, có chữ hoa, chữ thường, số, ký tự đặc biệt; được mã hóa khi lưu. Email và số điện thoại không trùng tài khoản khác. Tài khoản chỉ được tạo khi nhập đúng mã OTP 6 số gửi qua email (Brevo), hiệu lực 5 phút, sai quá 5 lần thì xin mã mới. Ví số dư 0đ được tạo cùng tài khoản. |
| Là người dùng, tôi muốn đăng nhập để dùng các chức năng theo quyền của mình. | FR-02 Đăng nhập | Đăng nhập bằng email và mật khẩu, nhận phiên đăng nhập có hiệu lực 60 phút. Sai email hoặc mật khẩu thì từ chối. |
| Là người dùng, tôi muốn đăng xuất để người khác không dùng tiếp phiên của tôi. | FR-03 Đăng xuất | Kết thúc phiên làm việc; người dùng phải đăng nhập lại để dùng chức năng cần quyền. |
| Là người dùng, tôi muốn xem hồ sơ và số dư ví của mình. | FR-04 Xem hồ sơ và số dư | Hiển thị thông tin tài khoản, vai trò và số dư ví hiện tại. Chỉ người đã đăng nhập. |

**Nhóm B. Quản lý sân và bảng giá (chức năng 1)**

| User Story | Requirement | Details |
| --- | --- | --- |
| Là chủ sân, tôi muốn đăng cơ sở thể thao của mình để khách tìm thấy. | FR-05 Tạo cơ sở thể thao | Nhập tên, địa chỉ, thành phố, quận, tọa độ, giờ mở và đóng cửa, mô tả. Hệ thống gán chủ sở hữu là người đang đăng nhập. Chỉ vai trò chủ sân. |
| Là chủ sân, tôi muốn thêm sân con vào cơ sở và đặt giá cơ sở để khách đặt được. | FR-06 Tạo sân con | Nhập tên, môn, loại sân, trong nhà hoặc ngoài trời, giờ mở và đóng (phải nằm trong giờ mở cửa của cơ sở), giá cơ sở mỗi khung giờ. Sân và các khung giờ hoạt động được tạo cùng lúc. Chỉ chủ của cơ sở. |
| Là chủ sân, tôi muốn sửa giờ hoạt động hoặc tạm ngưng sân mà không làm hỏng đơn đã cọc. | FR-07 Cập nhật sân con | Sửa tên, giờ mở và đóng, bật hoặc tắt hoạt động. Từ chối nếu còn đơn đã đặt cọc trong tương lai bị ảnh hưởng. Khi ngưng sân, các đơn `PENDING_DEPOSIT` tự hủy và nhả khung giờ. |
| Là chủ sân, tôi muốn đặt hệ số giá cho giờ cao điểm, cuối tuần, ngày lễ để tối ưu doanh thu. | FR-08 Cấu hình quy tắc giá theo thời điểm | Ba loại quy tắc: giờ cao điểm, cuối tuần, ngày lễ, mỗi quy tắc có hệ số nhân (QĐ1: tăng 20%–50%). Nhiều quy tắc cùng khớp thì lấy hệ số cao nhất. Bộ quy tắc mới thay hoàn toàn bộ cũ, không lưu dở dang. |
| Là chủ sân hoặc Admin, tôi muốn có danh mục ngày lễ để gắn hệ số giá cho ngày lễ. | FR-09 Quản lý danh mục ngày lễ | Mọi người dùng xem được danh mục; chỉ Admin thêm ngày lễ mới (tên, ngày, lặp lại hằng năm hay không); không thêm trùng ngày đã có. |
| Là chủ sân, tôi muốn khai báo dịch vụ đi kèm (thuê vợt, nước, bóng) để khách chọn khi đặt. | FR-10 Quản lý dịch vụ đi kèm | Chủ sân thêm (tên, đơn vị tính, đơn giá), sửa đơn giá, bật hoặc tắt dịch vụ của cơ sở mình. Mọi người xem được danh sách dịch vụ đang bán. Phí dịch vụ cộng vào tổng tiền (QĐ2). |

**Nhóm C. Tìm và đặt sân (chức năng 2)**

| User Story | Requirement | Details |
| --- | --- | --- |
| Là khách hàng, tôi muốn tìm sân ở khu vực gần mình để không phải gọi hỏi từng sân. | FR-11 Tìm cơ sở thể thao | Lọc theo môn, thành phố, từ khóa; phân trang. Kết quả có tọa độ để hiện trên bản đồ. Không cần đăng nhập. |
| Là khách hàng, tôi muốn xem chi tiết cơ sở và các sân con trước khi chọn. | FR-12 Xem chi tiết cơ sở và sân con | Hiển thị thông tin cơ sở, danh sách sân con đang hoạt động, dịch vụ đi kèm. Không cần đăng nhập. |
| Là khách hàng, tôi muốn xem sân trống theo ngày để chọn giờ phù hợp. | FR-13 Xem lịch khung giờ theo ngày | Mỗi khung giờ có trạng thái: trống, đang giữ chỗ, đã đặt cọc. Đơn giữ chỗ quá 10 phút coi là trống ngay. |
| Là khách hàng, tôi muốn biết tổng tiền và tiền cọc trước khi đặt để không bị bất ngờ. | FR-14 Xem trước tiền đặt sân | Hệ thống trả chi tiết từng khung giờ (giá, hệ số), tiền dịch vụ, tổng tiền, tiền cọc 30%, tiền còn lại (QĐ1, QĐ2, QĐ4). Giao diện không tự tính. |
| Là khách hàng, tôi muốn đặt các khung giờ và được giữ chỗ trong lúc thanh toán cọc. | FR-15 Tạo đơn và giữ chỗ | Chọn sân, ngày, một hoặc nhiều khung giờ, dịch vụ kèm số lượng. Đơn ở `PENDING_DEPOSIT`, giữ chỗ tối đa 10 phút hoặc đến giờ chơi nếu ngắn hơn. Chưa trừ tiền. Từ chối giờ đã qua. |
| Là khách hàng, tôi muốn chắc rằng sân tôi đã cọc không bị người khác đặt trùng. | FR-16 Chống đặt trùng | Một khung giờ chỉ thuộc về một đơn còn hiệu lực (QĐ3). Hai người đặt cùng lúc thì chỉ một người thành công, người kia bị từ chối vì khung giờ đã có người đặt. |
| Là người dùng, tôi muốn xem danh sách và chi tiết đơn đặt sân của mình. | FR-17 Xem danh sách và chi tiết đơn | Khách xem đơn của mình; chủ sân xem đơn tại cơ sở của mình; Admin xem tất cả. Lọc theo trạng thái, cơ sở, sân, khoảng ngày; phân trang. Chi tiết gồm khung giờ, dịch vụ, bảng kê tiền. |

**Nhóm D. Cọc, hoàn cọc và ví (chức năng 3)**

| User Story | Requirement | Details |
| --- | --- | --- |
| Là khách hàng, tôi muốn đặt cọc từ ví để giữ chắc sân. | FR-18 Đặt cọc 30% | Trừ 30% tổng tiền từ ví khách, cộng vào ví hệ thống, ghi giao dịch `DEPOSIT`, đơn sang `DEPOSITED` (QĐ4, QĐ6, QĐ7). Hết hạn giữ chỗ hoặc ví thiếu tiền thì từ chối, không trừ tiền. Trừ ví, ghi giao dịch và đổi trạng thái đơn xảy ra cùng lúc hoặc không xảy ra gì. |
| Là khách hàng, tôi muốn biết trước mình được hoàn bao nhiêu nếu hủy. | FR-19 Xem trước hoàn cọc | Hệ thống tính số giờ còn lại đến giờ chơi và trả tỉ lệ hoàn (≥24 giờ: 80%, 12 đến dưới 24 giờ: 50%, dưới 12 giờ: 0%) cùng số tiền (QĐ5). |
| Là khách hàng, tôi muốn hủy sân và nhận hoàn cọc theo quy định rõ ràng, không phải thương lượng. | FR-20 Hủy đơn và hoàn cọc | Khách (chủ đơn) hoặc Admin hủy được đơn `PENDING_DEPOSIT` và `DEPOSITED` khi chưa đến giờ chơi. Đơn đã cọc: ghi `REFUND` về ví khách và `FORFEIT` về ví chủ sân theo QĐ5. Khung giờ được nhả. Bài đăng tìm đồng đội liên quan (nếu có) bị đóng. |
| Là chủ sân, tôi muốn xác nhận buổi chơi đã xong để nhận tiền cọc. | FR-21 Xác nhận hoàn tất và kết toán | Chủ sân (chủ cơ sở) hoặc Admin làm được khi đã đến giờ chơi và đơn đang `DEPOSITED`. Chuyển tiền cọc từ ví hệ thống sang ví chủ sân, ghi `SETTLE`, đơn sang `COMPLETED`. |
| Là người dùng, tôi muốn xem số dư và lịch sử giao dịch ví để đối chiếu tiền. | FR-22 Xem ví và lịch sử giao dịch | Số dư hiện tại; lịch sử có phân trang, lọc theo loại (`TOPUP`, `DEPOSIT`, `REFUND`, `FORFEIT`, `SETTLE`). Số dư không được âm (QĐ6). |
| Là Admin, tôi muốn cấp tiền vào ví người dùng để họ trải nghiệm hệ thống. | FR-23 Admin cấp tiền vào ví | Chọn người dùng và số tiền, hệ thống cộng ví và ghi `TOPUP` kèm người cấp (QĐ6). |
| Là khách hàng, tôi muốn sân tôi giữ dở được nhả ra khi tôi không cọc kịp. | FR-24 Nhả giữ chỗ hết hạn | Tiến trình nền chạy mỗi 60 giây, hủy đơn `PENDING_DEPOSIT` quá hạn và nhả khung giờ, không ghi giao dịch ví. Admin có thể kích hoạt thủ công. |
| Là khách hàng, tôi muốn nhận email xác nhận khi đặt cọc thành công để lưu lại thông tin đặt sân. | FR-30 Email xác nhận đặt sân | Sau khi đặt cọc thành công, hệ thống gửi email xác nhận qua dịch vụ Brevo, gồm mã đơn, sân, khung giờ, tiền cọc và tiền còn lại. Gửi email lỗi thì không ảnh hưởng đơn đã cọc. |

**Nhóm E. Ghép đội và tiện ích (chức năng 4, 5; ưu tiên thấp)**

| User Story | Requirement | Details |
| --- | --- | --- |
| Là người chơi thiếu người, tôi muốn đăng bài tìm đồng đội cho sân đã đặt. | FR-25 Đăng bài tìm đồng đội | Chỉ đơn `DEPOSITED` của chính mình và chưa đến giờ chơi; mỗi đơn có tối đa một bài đang mở. |
| Là người chơi, tôi muốn đăng ký tham gia bài của người khác. | FR-26 Đăng ký tham gia | Bài phải đang mở; không tự đăng ký bài của mình; không đăng ký trùng. |
| Là người đăng bài, tôi muốn duyệt hoặc từ chối người đăng ký. | FR-27 Duyệt người đăng ký | Chủ bài chuyển trạng thái đăng ký sang đồng ý hoặc từ chối. |
| Là khách hàng, tôi muốn đánh giá sân sau khi chơi để giúp người khác chọn. | FR-28 Đánh giá sân | Chỉ khách có đơn `COMPLETED` của chính mình được đánh giá, mỗi đơn một đánh giá, không sửa sau khi gửi. Gồm số sao từ 1 đến 5 và bình luận (không bắt buộc). Điểm trung bình và các đánh giá hiển thị trong trang chi tiết cơ sở (FR-12). |
| Là Admin, tôi muốn xem thống kê tổng quan hệ thống. | FR-29 Dashboard Admin | Chỉ Admin xem. Hiển thị: tổng số người dùng theo vai trò, tổng số cơ sở và sân con, số đơn theo từng trạng thái (`PENDING_DEPOSIT`, `DEPOSITED`, `COMPLETED`, `CANCELLED`), tổng tiền cọc đang giữ ở ví hệ thống, tổng tiền Admin đã cấp. |

#### 3.2.2 Đặc tả yêu cầu phi chức năng

| User Story | Requirement | Details |
| --- | --- | --- |
| Là khách hàng, tôi muốn trang tải nhanh để không phải chờ khi tìm sân. | NFR-01 Hiệu năng giao diện (sản phẩm – hiệu năng) | Trang tìm sân và lịch trống hiển thị trong tối đa 3 giây ở 95% lượt tải, mạng 4G, khi dữ liệu ở mức 50 cơ sở. |
| Là khách hàng, tôi muốn thao tác đặt sân phản hồi ngay. | NFR-02 Thời gian phản hồi API (sản phẩm – hiệu năng) | 95% request đọc phản hồi dưới 1 giây, request ghi (đặt, cọc, hủy) dưới 2 giây, với 20 người dùng đồng thời trên máy chủ 1 vCPU, 1 GB RAM. |
| Là chủ sân, tôi muốn không bao giờ bị đặt trùng giờ. | NFR-03 Toàn vẹn khi đồng thời (sản phẩm – độ tin cậy) | Khi 2 yêu cầu đặt cùng sân, ngày, khung giờ chạy đồng thời, đúng 1 yêu cầu thành công, 0 trường hợp hai đơn còn hiệu lực trên cùng khung giờ. |
| Là người dùng, tôi muốn tiền trong ví luôn đúng. | NFR-04 Toàn vẹn tiền (sản phẩm – độ tin cậy) | Số dư ví không bao giờ âm. Mọi biến động số dư có đúng 1 bản ghi giao dịch tương ứng, không xóa hay sửa. Thao tác tiền thất bại thì không để lại thay đổi nào. Tiền lưu số nguyên VNĐ. |
| Là người dùng, tôi muốn tài khoản và dữ liệu cá nhân được bảo vệ. | NFR-05 Bảo mật (sản phẩm – bảo mật) | Mật khẩu được mã hóa bằng Bcrypt khi lưu. Giao tiếp qua HTTPS. Xác thực bằng JWT; request thiếu phiên hợp lệ hoặc sai quyền bị từ chối. Mỗi API kiểm tra quyền theo vai trò khách, chủ sân, Admin. |
| Là khách hàng, tôi muốn dùng được trên điện thoại. | NFR-06 Tương thích (tổ chức – môi trường) | Giao diện hiển thị đúng ở chiều rộng từ 360px đến 1920px, trên 2 phiên bản mới nhất của Chrome, Edge, Firefox, Safari. |
| Là người dùng mới, tôi muốn tự dùng được mà không cần hướng dẫn dài. | NFR-07 Khả dụng (sản phẩm – khả năng sử dụng) | Khách hàng mới hoàn thành luồng tìm sân, đặt, cọc trong tối đa 5 phút mà không cần hướng dẫn. Thông báo lỗi bằng tiếng Việt, nêu rõ cần làm gì. |
| Là chủ sân, tôi muốn hệ thống chạy ổn định giờ khách đặt. | NFR-08 Độ sẵn sàng (sản phẩm – độ tin cậy) | Trong thời gian demo và chấm điểm, hệ thống hoạt động liên tục; tiến trình nền nhả giữ chỗ chạy mỗi 60 giây. Tối đa 1 giờ ngừng hoạt động có kế hoạch mỗi tuần. |
| Là người dùng, tôi muốn thấy giá đúng với quy định đã công bố. | NFR-09 Tính đúng đắn của nghiệp vụ (sản phẩm – độ tin cậy) | Mọi phép tính giá, cọc, hoàn cọc làm ở Backend theo QĐ1 đến QĐ5; Frontend chỉ hiển thị. Các kịch bản trong `docs/test-scenarios.md` đạt 100%. |
| Là nhà phát triển, tôi muốn API nhất quán để Frontend dùng dễ. | NFR-10 Chuẩn giao tiếp (tổ chức – phát triển) | API theo `docs/api-conventions.md`: REST, JSON, thời gian ISO 8601 UTC, phản hồi và mã lỗi theo một khuôn chung. |
| Là nhà phát triển, tôi muốn mã nguồn được kiểm soát chất lượng. | NFR-11 Quy trình phát triển (tổ chức – phát triển) | Mã nguồn trên GitHub, theo `CONTRIBUTING.md`: mỗi PR cần 1 approve và CI chạy qua trước khi gộp; phần tính tiền có unit test. |
| Là khách hàng, tôi muốn biết hệ thống tuân quy định bên ngoài. | NFR-12 Ràng buộc bên ngoài (bên ngoài – quy định) | Bản đồ dùng dữ liệu OpenStreetMap, ghi nguồn đúng giấy phép. Chỉ dùng ví nội bộ, không xử lý thanh toán thật. |
| Là chủ sân, tôi muốn hệ thống tự phục hồi sau sự cố mà không mất đơn đã cọc. | NFR-13 Khôi phục sau lỗi (sản phẩm – độ tin cậy) | Sau lỗi hệ thống, dịch vụ tự khởi động lại và hoạt động trở lại trong tối đa 5 phút. Không mất đơn đã đặt cọc và giao dịch ví đã ghi. |
| Là quản trị hệ thống, tôi muốn có bản sao lưu để khôi phục dữ liệu. | NFR-14 Sao lưu (tổ chức – vận hành) | CSDL sao lưu tự động mỗi đêm, giữ 7 bản gần nhất. Thử khôi phục thành công ít nhất 1 lần trước buổi demo. |
| Là đội vận hành, tôi muốn biết hệ thống chứa được bao nhiêu dữ liệu. | NFR-15 Lưu trữ (sản phẩm – lưu trữ) | Lưu được tối thiểu 1.000 người dùng, 50 cơ sở, 20.000 đơn đặt sân trong gói 20 GB của máy chủ. |
| Là người dùng, tôi muốn thông tin cá nhân không bị lộ cho người khác. | NFR-16 Riêng tư và kiểm toán (bên ngoài – pháp lý) | Email và số điện thoại chỉ hiển thị cho chính chủ và vai trò có quyền. Mọi lần Admin cấp tiền được ghi lại cùng người thực hiện. |

# 4 Đặc tả yêu cầu

#### 4.1 Sơ đồ Use Case

Tác nhân: Khách hàng, Chủ sân, Admin, Hệ thống (tiến trình nền). FR-25 đến FR-29 ưu tiên thấp, chưa đặc tả.

```mermaid
flowchart LR
  KH([Khách hàng])
  CS([Chủ sân])
  AD([Admin])
  HT([Hệ thống - tiến trình nền])
  subgraph SYS[Hệ thống Quản lý và Đặt sân Thể thao]
    subgraph G1[Tài khoản]
      U001(U001 Đăng ký)
      U002(U002 Đăng nhập)
      U003(U003 Đăng xuất)
      U004(U004 Xem hồ sơ)
    end
    subgraph G2[Quản lý sân và bảng giá]
      U005(U005 Tạo cơ sở)
      U006(U006 Tạo sân con)
      U007(U007 Cập nhật sân con)
      U008(U008 Cấu hình quy tắc giá)
      U009(U009 Quản lý ngày lễ)
      U010(U010 Quản lý dịch vụ đi kèm)
    end
    subgraph G3[Tìm và đặt sân]
      U011(U011 Tìm cơ sở và sân)
      U012(U012 Xem lịch khung giờ)
      U013(U013 Xem trước tiền)
      U014(U014 Đặt sân và giữ chỗ)
      U015(U015 Xem đơn đặt sân)
    end
    subgraph G4[Cọc, hoàn cọc và ví]
      U016(U016 Đặt cọc)
      U017(U017 Hủy đơn và hoàn cọc)
      U018(U018 Xác nhận hoàn tất)
      U019(U019 Xem ví và giao dịch)
      U020(U020 Cấp tiền vào ví)
      U021(U021 Nhả giữ chỗ hết hạn)
    end
  end
  KH --- U001 & U002 & U003 & U004 & U011 & U012 & U014 & U015 & U016 & U017 & U019
  U001 & U002 & U003 & U004 & U005 & U006 & U007 & U008 & U010 & U011 & U015 & U018 & U019 --- CS
  U002 & U003 & U004 & U009 & U015 & U020 & U021 --- AD
  U021 --- HT
  U014 -. include .-> U013
```

| Tác nhân | Use case |
| --- | --- |
| Khách hàng | U001, U002, U003, U004, U011, U012, U013, U014, U015, U016, U017, U019 |
| Chủ sân | U001, U002, U003, U004, U005, U006, U007, U008, U010, U011, U015, U018, U019 |
| Admin | U002, U003, U004, U009, U015, U020, U021 |
| Hệ thống (tiến trình nền) | U021 |

#### 4.2 Đặc tả Use Case

Tiền điều kiện chung: người dùng dùng trình duyệt có Internet; use case yêu cầu đăng nhập thì phải có phiên đăng nhập hợp lệ.

**Nhóm A. Tài khoản**

##### U001 – Đăng ký tài khoản

| Mục | Nội dung |
| --- | --- |
| Use case ID | U001 |
| Tên Use Case | Đăng ký tài khoản |
| Yêu cầu liên quan | FR-01 |
| Tóm tắt | Người dùng mới tạo tài khoản khách hàng hoặc chủ sân, xác minh email bằng OTP. Hệ thống tạo kèm ví nội bộ số dư 0đ. |
| Tác nhân | Khách hàng, Chủ sân (chưa có tài khoản) |
| Điều kiện tiên quyết | Chưa đăng nhập. |
| Kết quả | Thành công: Có tài khoản mới với vai trò đã chọn và một ví số dư 0đ.<br>Thất bại: Không tạo tài khoản và ví. |
| Kịch bản chính | 1. Người dùng nhập họ tên, email, số điện thoại, mật khẩu, chọn vai trò.<br>2. Hệ thống kiểm tra định dạng và email, số điện thoại chưa tồn tại.<br>3. Hệ thống gửi mã OTP đến email.<br>4. Người dùng nhập OTP.<br>5. Hệ thống tạo tài khoản và ví, mật khẩu được mã hóa.<br>6. Hệ thống báo đăng ký thành công. |
| Kịch bản phụ | 2a. Email hoặc số điện thoại đã tồn tại: từ chối và báo lý do.<br>2b. Sai định dạng hoặc mật khẩu yếu: từ chối và báo lý do.<br>3a. Không gửi được email: báo lỗi, không tạo tài khoản.<br>4a. OTP sai: cho nhập lại; sai quá 5 lần thì xin mã mới.<br>4b. OTP quá 5 phút: báo hết hạn, cho gửi lại. |
| Ràng buộc phi chức năng | Mật khẩu được mã hóa khi lưu (NFR-05). Không có tài khoản thiếu ví (NFR-04). |

##### U002 – Đăng nhập

| Mục | Nội dung |
| --- | --- |
| Use case ID | U002 |
| Tên Use Case | Đăng nhập |
| Yêu cầu liên quan | FR-02 |
| Tóm tắt | Người dùng xác thực bằng email và mật khẩu để nhận phiên đăng nhập. |
| Tác nhân | Khách hàng, Chủ sân, Admin |
| Điều kiện tiên quyết | Đã có tài khoản. |
| Kết quả | Thành công: Nhận phiên đăng nhập; giao diện hiển thị theo vai trò.<br>Thất bại: Không cấp phiên, người dùng vẫn chưa đăng nhập. |
| Kịch bản chính | 1. Người dùng nhập email và mật khẩu.<br>2. Hệ thống kiểm tra thông tin.<br>3. Hệ thống cấp phiên đăng nhập.<br>4. Giao diện lưu phiên và chuyển về trang chính. |
| Kịch bản phụ | 2a. Sai email hoặc mật khẩu: từ chối và báo lý do, cho nhập lại. |
| Ràng buộc phi chức năng | Kênh truyền mã hóa, phiên có thời hạn (NFR-05). Phản hồi dưới 1 giây (NFR-02). |

##### U003 – Đăng xuất

| Mục | Nội dung |
| --- | --- |
| Use case ID | U003 |
| Tên Use Case | Đăng xuất |
| Yêu cầu liên quan | FR-03 |
| Tóm tắt | Người dùng kết thúc phiên làm việc. |
| Tác nhân | Khách hàng, Chủ sân, Admin |
| Điều kiện tiên quyết | Đã đăng nhập. |
| Kết quả | Thành công: Phiên bị xóa ở máy người dùng; phải đăng nhập lại để dùng chức năng cần quyền.<br>Thất bại: Phiên luôn bị xóa ở máy người dùng, kể cả khi gửi yêu cầu lỗi. |
| Kịch bản chính | 1. Người dùng bấm đăng xuất.<br>2. Giao diện gửi yêu cầu đăng xuất.<br>3. Hệ thống ghi nhận kết thúc phiên.<br>4. Giao diện xóa phiên và về trang đăng nhập. |
| Kịch bản phụ | 2a. Phiên đã hết hạn: giao diện vẫn xóa phiên và về trang đăng nhập. |
| Ràng buộc phi chức năng | NFR-05. |

##### U004 – Xem hồ sơ

| Mục | Nội dung |
| --- | --- |
| Use case ID | U004 |
| Tên Use Case | Xem hồ sơ và số dư |
| Yêu cầu liên quan | FR-04 |
| Tóm tắt | Người dùng xem thông tin tài khoản, vai trò và số dư ví. |
| Tác nhân | Khách hàng, Chủ sân, Admin |
| Điều kiện tiên quyết | Đã đăng nhập. |
| Kết quả | Thành công: Hiển thị hồ sơ và số dư hiện tại.<br>Thất bại: Không hiển thị dữ liệu, yêu cầu đăng nhập lại. |
| Kịch bản chính | 1. Người dùng mở trang hồ sơ.<br>2. Hệ thống đọc tài khoản và ví của người đang đăng nhập.<br>3. Hệ thống hiển thị thông tin. |
| Kịch bản phụ | 2a. Phiên thiếu hoặc hết hạn: yêu cầu đăng nhập lại, chuyển về đăng nhập. |
| Ràng buộc phi chức năng | NFR-02, NFR-05. |

**Nhóm B. Quản lý sân và bảng giá**

##### U005 – Tạo cơ sở thể thao

| Mục | Nội dung |
| --- | --- |
| Use case ID | U005 |
| Tên Use Case | Tạo cơ sở thể thao |
| Yêu cầu liên quan | FR-05 |
| Tóm tắt | Chủ sân đăng ký một cơ sở (cụm sân) mới. |
| Tác nhân | Chủ sân |
| Điều kiện tiên quyết | Đã đăng nhập với vai trò chủ sân. |
| Kết quả | Thành công: Cơ sở mới ở trạng thái hoạt động, thuộc về chủ sân đang đăng nhập.<br>Thất bại: Không tạo cơ sở. |
| Kịch bản chính | 1. Chủ sân chọn thêm cơ sở.<br>2. Nhập tên, địa chỉ, thành phố, quận, tọa độ, giờ mở và đóng cửa, mô tả.<br>3. Hệ thống kiểm tra dữ liệu.<br>4. Hệ thống lưu cơ sở, gán chủ sở hữu.<br>5. Hệ thống hiển thị cơ sở vừa tạo. |
| Kịch bản phụ | 3a. Thiếu hoặc sai dữ liệu: từ chối và báo lý do.<br>1a. Người dùng không phải chủ sân: từ chối vì không đủ quyền. |
| Ràng buộc phi chức năng | NFR-05 (kiểm tra quyền). |

##### U006 – Tạo sân con

| Mục | Nội dung |
| --- | --- |
| Use case ID | U006 |
| Tên Use Case | Tạo sân con |
| Yêu cầu liên quan | FR-06 |
| Tóm tắt | Chủ sân thêm sân con vào cơ sở, đặt giờ hoạt động và giá cơ sở. |
| Tác nhân | Chủ sân |
| Điều kiện tiên quyết | Đã đăng nhập; là chủ của cơ sở. |
| Kết quả | Thành công: Sân con mới cùng các khung giờ hoạt động và giá cơ sở.<br>Thất bại: Không tạo sân và khung giờ nào. |
| Kịch bản chính | 1. Chủ sân chọn cơ sở, bấm thêm sân.<br>2. Nhập tên, môn, loại sân, trong nhà hoặc ngoài trời, giờ mở và đóng, giá cơ sở mỗi khung giờ.<br>3. Hệ thống kiểm tra dữ liệu và quyền sở hữu cơ sở.<br>4. Hệ thống tạo sân và các khung giờ cùng lúc.<br>5. Hệ thống hiển thị sân vừa tạo. |
| Kịch bản phụ | 3a. Không phải chủ cơ sở: từ chối vì không đủ quyền.<br>3b. Dữ liệu sai (giờ đóng trước giờ mở, giá âm): từ chối và báo lý do.<br>3c. Giờ sân nằm ngoài giờ mở cửa của cơ sở: từ chối và báo lý do. |
| Ràng buộc phi chức năng | Sân và khung giờ được tạo cùng lúc (NFR-04). |

##### U007 – Cập nhật sân con

| Mục | Nội dung |
| --- | --- |
| Use case ID | U007 |
| Tên Use Case | Cập nhật sân con |
| Yêu cầu liên quan | FR-07 |
| Tóm tắt | Chủ sân sửa tên, giờ hoạt động hoặc tạm ngưng sân. |
| Tác nhân | Chủ sân |
| Điều kiện tiên quyết | Đã đăng nhập; là chủ của sân con. |
| Kết quả | Thành công: Thông tin sân được cập nhật, khung giờ đồng bộ theo giờ mới; hoặc sân bị ẩn khi ngưng.<br>Thất bại: Giữ nguyên thông tin sân, khung giờ và các đơn hiện có. |
| Kịch bản chính | 1. Chủ sân sửa tên, giờ mở và đóng, hoặc tắt hoạt động sân.<br>2. Hệ thống kiểm tra còn đơn `DEPOSITED` trong tương lai bị ảnh hưởng không.<br>3. Không xung đột: hệ thống cập nhật sân và các khung giờ theo giờ mới.<br>4. Nếu ngưng sân: hủy các đơn `PENDING_DEPOSIT`, nhả khung giờ.<br>5. Hệ thống báo thành công. |
| Kịch bản phụ | 3a. Giờ mới cắt mất khung giờ đã có đơn đã cọc: từ chối và báo lý do, giữ nguyên.<br>3b. Ngưng sân khi còn đơn đã cọc: từ chối và báo lý do, giữ nguyên. |
| Ràng buộc phi chức năng | Cập nhật xong toàn bộ hoặc không đổi gì (NFR-04). |

##### U008 – Cấu hình quy tắc giá

| Mục | Nội dung |
| --- | --- |
| Use case ID | U008 |
| Tên Use Case | Cấu hình quy tắc giá theo thời điểm |
| Yêu cầu liên quan | FR-08 |
| Tóm tắt | Chủ sân đặt hệ số nhân giá cho giờ cao điểm, cuối tuần, ngày lễ của cơ sở (QĐ1). |
| Tác nhân | Chủ sân |
| Điều kiện tiên quyết | Đã đăng nhập; là chủ của cơ sở. Với quy tắc ngày lễ, ngày lễ đã có trong danh mục. |
| Kết quả | Thành công: Bộ quy tắc giá mới thay bộ cũ của cơ sở.<br>Thất bại: Giữ nguyên bộ quy tắc cũ. |
| Kịch bản chính | 1. Chủ sân mở trang bảng giá của cơ sở.<br>2. Thêm các quy tắc: loại (cao điểm, cuối tuần, ngày lễ), hệ số, khung giờ hoặc thứ hoặc ngày lễ áp dụng.<br>3. Hệ thống kiểm tra từng quy tắc theo loại.<br>4. Hệ thống thay toàn bộ quy tắc cũ bằng quy tắc mới.<br>5. Hệ thống báo số quy tắc đang áp dụng. |
| Kịch bản phụ | 3a. Quy tắc thiếu trường bắt buộc theo loại hoặc hệ số ngoài khoảng 1.20–1.50: từ chối và báo lý do, không lưu gì.<br>3b. Không phải chủ cơ sở: từ chối vì không đủ quyền. |
| Ràng buộc phi chức năng | Khi nhiều quy tắc cùng khớp một khung giờ, lấy hệ số cao nhất, không cộng dồn (QĐ1). |

##### U009 – Quản lý ngày lễ

| Mục | Nội dung |
| --- | --- |
| Use case ID | U009 |
| Tên Use Case | Quản lý danh mục ngày lễ |
| Yêu cầu liên quan | FR-09 |
| Tóm tắt | Admin thêm ngày lễ vào danh mục; chủ sân xem danh mục để gắn quy tắc giá. |
| Tác nhân | Admin (thêm); Chủ sân (xem) |
| Điều kiện tiên quyết | Đã đăng nhập. Thêm ngày lễ cần vai trò Admin. |
| Kết quả | Thành công: Danh mục có thêm ngày lễ mới.<br>Thất bại: Danh mục ngày lễ không đổi. |
| Kịch bản chính | 1. Admin mở trang danh mục ngày lễ.<br>2. Nhập tên, ngày, chọn lặp lại hằng năm hay không.<br>3. Hệ thống kiểm tra và lưu.<br>4. Danh mục hiển thị ngày lễ mới. |
| Kịch bản phụ | 3a. Dữ liệu sai hoặc ngày đã có trong danh mục: từ chối và báo lý do.<br>1a. Người dùng không phải Admin: từ chối vì không đủ quyền khi thêm. |
| Ràng buộc phi chức năng | NFR-05. |

##### U010 – Quản lý dịch vụ đi kèm

| Mục | Nội dung |
| --- | --- |
| Use case ID | U010 |
| Tên Use Case | Quản lý dịch vụ đi kèm |
| Yêu cầu liên quan | FR-10 |
| Tóm tắt | Chủ sân thêm, sửa đơn giá, bật hoặc tắt dịch vụ đi kèm (thuê vợt, nước, bóng). |
| Tác nhân | Chủ sân |
| Điều kiện tiên quyết | Đã đăng nhập; là chủ của cơ sở. |
| Kết quả | Thành công: Danh sách dịch vụ của cơ sở được cập nhật; dịch vụ đang bật xuất hiện khi khách đặt sân.<br>Thất bại: Danh sách dịch vụ không đổi. |
| Kịch bản chính | 1. Chủ sân mở danh sách dịch vụ của cơ sở.<br>2. Thêm dịch vụ (tên, đơn vị tính, đơn giá) hoặc sửa đơn giá hoặc tắt dịch vụ.<br>3. Hệ thống kiểm tra quyền sở hữu và dữ liệu.<br>4. Hệ thống lưu và hiển thị danh sách mới. |
| Kịch bản phụ | 3a. Không phải chủ cơ sở: từ chối vì không đủ quyền.<br>3b. Đơn giá âm hoặc thiếu tên: từ chối và báo lý do. |
| Ràng buộc phi chức năng | Phí dịch vụ được cộng vào tổng tiền (QĐ2). Dịch vụ đã tắt không tính vào đơn mới. |

**Nhóm C. Tìm và đặt sân**

##### U011 – Tìm cơ sở và sân

| Mục | Nội dung |
| --- | --- |
| Use case ID | U011 |
| Tên Use Case | Tìm cơ sở và sân |
| Yêu cầu liên quan | FR-11, FR-12 |
| Tóm tắt | Người dùng tìm cơ sở theo môn, thành phố, từ khóa và xem chi tiết cơ sở, sân con, vị trí trên bản đồ. |
| Tác nhân | Khách hàng, Chủ sân (không cần đăng nhập) |
| Điều kiện tiên quyết | Không. |
| Kết quả | Thành công: Danh sách cơ sở phù hợp; xem được chi tiết cơ sở, sân con và dịch vụ.<br>Thất bại: Không có kết quả hoặc báo cơ sở không tồn tại; dữ liệu không đổi. |
| Kịch bản chính | 1. Người dùng nhập bộ lọc (môn, thành phố, từ khóa).<br>2. Hệ thống trả danh sách cơ sở phân trang, kèm tọa độ.<br>3. Giao diện hiển thị danh sách và ghim trên bản đồ.<br>4. Người dùng chọn một cơ sở.<br>5. Hệ thống hiển thị thông tin cơ sở, các sân con đang hoạt động và dịch vụ đi kèm. |
| Kịch bản phụ | 2a. Không có kết quả: hiển thị thông báo không tìm thấy.<br>4a. Cơ sở không tồn tại hoặc ngừng hoạt động: báo không tìm thấy. |
| Ràng buộc phi chức năng | Hiển thị trong 3 giây (NFR-01). Bản đồ OpenStreetMap (NFR-12). |

##### U012 – Xem lịch khung giờ

| Mục | Nội dung |
| --- | --- |
| Use case ID | U012 |
| Tên Use Case | Xem lịch khung giờ theo ngày |
| Yêu cầu liên quan | FR-13 |
| Tóm tắt | Khách xem trạng thái các khung giờ của một sân con trong một ngày. |
| Tác nhân | Khách hàng |
| Điều kiện tiên quyết | Sân con đang hoạt động. |
| Kết quả | Thành công: Mỗi khung giờ hiện trạng thái trống, đang giữ chỗ hoặc đã đặt cọc, kèm giá cơ sở.<br>Thất bại: Không hiển thị lịch; dữ liệu không đổi. |
| Kịch bản chính | 1. Khách chọn sân con và ngày.<br>2. Hệ thống xác định trạng thái từng khung giờ tại thời điểm hiện tại.<br>3. Giao diện hiển thị lịch; khung giờ trống chọn được. |
| Kịch bản phụ | 1a. Thiếu ngày hoặc sai định dạng: từ chối và báo lý do.<br>2a. Đơn giữ chỗ đã quá 10 phút: tính là trống ngay, không cần chờ tiến trình nền. |
| Ràng buộc phi chức năng | NFR-01, NFR-02. |

##### U013 – Xem trước tiền đặt sân

| Mục | Nội dung |
| --- | --- |
| Use case ID | U013 |
| Tên Use Case | Xem trước tiền đặt sân |
| Yêu cầu liên quan | FR-14 |
| Tóm tắt | Hệ thống tính tổng tiền, tiền cọc và tiền còn lại cho các khung giờ và dịch vụ đã chọn. Được U014 include. |
| Tác nhân | Khách hàng |
| Điều kiện tiên quyết | Đã đăng nhập; đã chọn ít nhất một khung giờ. |
| Kết quả | Thành công: Bảng kê tiền chi tiết từng khung giờ; chưa tạo đơn, chưa giữ chỗ.<br>Thất bại: Không có bảng kê tiền; chưa tạo đơn. |
| Kịch bản chính | 1. Khách chọn khung giờ và dịch vụ.<br>2. Giao diện gửi lựa chọn cho hệ thống.<br>3. Hệ thống tính giá từng khung theo hệ số lớn nhất khớp, cộng dịch vụ, tính cọc 30% và phần còn lại.<br>4. Giao diện hiển thị đúng số hệ thống tính. |
| Kịch bản phụ | 3a. Khung giờ không thuộc sân hoặc ngoài giờ mở cửa: báo lỗi, không tính.<br>3b. Dịch vụ đã tắt: báo lỗi. |
| Ràng buộc phi chức năng | Giao diện không tự tính tiền (NFR-09). Tiền là số nguyên VNĐ (NFR-04). Công thức: QĐ1, QĐ2, QĐ4. |

##### U014 – Đặt sân và giữ chỗ

| Mục | Nội dung |
| --- | --- |
| Use case ID | U014 |
| Tên Use Case | Đặt sân và giữ chỗ |
| Yêu cầu liên quan | FR-15, FR-16 |
| Tóm tắt | Khách tạo đơn cho một hoặc nhiều khung giờ; hệ thống giữ chỗ tối đa 10 phút chờ đặt cọc. |
| Tác nhân | Khách hàng |
| Điều kiện tiên quyết | Đã đăng nhập; các khung giờ đang trống; giờ bắt đầu ở tương lai. |
| Kết quả | Thành công: Đơn `PENDING_DEPOSIT` kèm hạn giữ chỗ; các khung giờ bị giữ. Chưa trừ tiền ví.<br>Thất bại: Không tạo đơn, không giữ khung giờ, ví không đổi. |
| Kịch bản chính | 1. Khách xem trước tiền (U013) rồi bấm đặt sân.<br>2. Hệ thống giải phóng các đơn giữ chỗ quá hạn trên cùng khung giờ.<br>3. Hệ thống kiểm tra khung giờ chưa có đơn còn hiệu lực (an toàn khi đặt cùng lúc), nằm trong giờ mở cửa và chưa qua giờ bắt đầu.<br>4. Hệ thống tính tiền, đặt hạn giữ chỗ (10 phút hoặc đến giờ bắt đầu nếu sớm hơn).<br>5. Hệ thống tạo đơn, lưu hệ số và giá tại thời điểm đặt.<br>6. Hệ thống trả mã đơn, tiền cọc và hạn giữ chỗ. |
| Kịch bản phụ | 3a. Khung giờ đã có đơn còn hiệu lực: từ chối, không tạo đơn.<br>3b. Giờ bắt đầu đã qua: từ chối.<br>3c. Ngoài giờ mở cửa hoặc sân ngưng: từ chối, không tạo đơn. |
| Ràng buộc phi chức năng | Chống đặt trùng khi đồng thời (QĐ3, NFR-03). Đơn được tạo đầy đủ hoặc không tạo gì (NFR-04). Phản hồi dưới 2 giây (NFR-02). |

##### U015 – Xem đơn đặt sân

| Mục | Nội dung |
| --- | --- |
| Use case ID | U015 |
| Tên Use Case | Xem danh sách và chi tiết đơn đặt sân |
| Yêu cầu liên quan | FR-17 |
| Tóm tắt | Người dùng xem các đơn thuộc phạm vi quyền của mình và mở chi tiết một đơn. |
| Tác nhân | Khách hàng, Chủ sân, Admin |
| Điều kiện tiên quyết | Đã đăng nhập. |
| Kết quả | Thành công: Danh sách đơn (khách: đơn của mình; chủ sân: đơn tại cơ sở của mình; Admin: tất cả) và chi tiết từng đơn.<br>Thất bại: Không hiển thị đơn; không lộ đơn của người khác. |
| Kịch bản chính | 1. Người dùng mở danh sách đơn, có thể lọc theo trạng thái, cơ sở, sân, khoảng ngày.<br>2. Hệ thống trả danh sách phân trang theo quyền.<br>3. Người dùng chọn một đơn.<br>4. Hệ thống hiển thị khung giờ, dịch vụ, bảng kê tiền, trạng thái. |
| Kịch bản phụ | 3a. Mở đơn không thuộc quyền mình: từ chối vì không đủ quyền.<br>3b. Đơn không tồn tại: báo không tìm thấy. |
| Ràng buộc phi chức năng | NFR-02, NFR-05. |

**Nhóm D. Cọc, hoàn cọc và ví**

##### U016 – Đặt cọc

| Mục | Nội dung |
| --- | --- |
| Use case ID | U016 |
| Tên Use Case | Đặt cọc 30% bằng ví |
| Yêu cầu liên quan | FR-18, FR-30 |
| Tóm tắt | Khách thanh toán tiền cọc từ ví cho đơn đang giữ chỗ để khóa khung giờ. |
| Tác nhân | Khách hàng |
| Điều kiện tiên quyết | Đã đăng nhập; là chủ đơn; đơn ở `PENDING_DEPOSIT` và còn hạn giữ chỗ; số dư ví không ít hơn tiền cọc. |
| Kết quả | Thành công: Đơn sang `DEPOSITED`; ví khách giảm, ví hệ thống tăng đúng tiền cọc; có 1 giao dịch `DEPOSIT`; khung giờ bị khóa với mọi người (QĐ3).<br>Thất bại: Đơn giữ nguyên trạng thái, ví không đổi, không có giao dịch. |
| Kịch bản chính | 1. Khách mở đơn và bấm đặt cọc.<br>2. Hệ thống kiểm tra đơn còn hạn và đang chờ cọc.<br>3. Hệ thống kiểm tra số dư đủ.<br>4. Hệ thống trừ ví khách, cộng ví hệ thống, ghi giao dịch `DEPOSIT`, chuyển đơn sang `DEPOSITED`.<br>5. Hệ thống báo thành công và số dư mới.<br>6. Hệ thống gửi email xác nhận đặt sân (FR-30). |
| Kịch bản phụ | 2a. Đơn đã hết hạn hoặc đã đổi trạng thái: từ chối và báo lý do, không trừ tiền.<br>3a. Số dư không đủ: từ chối và báo lý do, không trừ tiền, đơn vẫn chờ cọc đến hết hạn.<br>1a. Không phải chủ đơn: từ chối vì không đủ quyền.<br>6a. Gửi email lỗi: bỏ qua, đơn vẫn ở `DEPOSITED`. |
| Ràng buộc phi chức năng | Trừ tiền, cộng tiền, ghi giao dịch và đổi trạng thái đơn xảy ra cùng lúc hoặc không xảy ra gì; số dư không âm (QĐ4, QĐ6, NFR-04). |

##### U017 – Hủy đơn và hoàn cọc

| Mục | Nội dung |
| --- | --- |
| Use case ID | U017 |
| Tên Use Case | Hủy đơn và hoàn cọc |
| Yêu cầu liên quan | FR-19, FR-20 |
| Tóm tắt | Khách xem trước tiền hoàn, rồi hủy đơn. Hệ thống tự chia tiền cọc giữa ví khách và ví chủ sân theo QĐ5. |
| Tác nhân | Khách hàng (Admin cũng làm được) |
| Điều kiện tiên quyết | Đã đăng nhập; là chủ đơn (hoặc Admin); đơn ở `PENDING_DEPOSIT` hoặc `DEPOSITED`; chưa đến giờ chơi. |
| Kết quả | Thành công: Đơn `CANCELLED`; khung giờ được nhả. Nếu đơn đã cọc: tiền hoàn về ví khách và phần còn lại về ví chủ sân.<br>Thất bại: Đơn giữ nguyên trạng thái, không hoàn tiền. |
| Kịch bản chính | 1. Khách mở đơn và bấm hủy.<br>2. Hệ thống tính số giờ còn lại và trả tỉ lệ hoàn (≥24 giờ: 80%, 12 đến dưới 24 giờ: 50%, dưới 12 giờ: 0%) cùng số tiền.<br>3. Khách đọc, nhập lý do và xác nhận.<br>4. Hệ thống đổi đơn sang `CANCELLED`, nhả khung giờ.<br>5. Nếu đơn đã cọc: ghi `REFUND` về ví khách và `FORFEIT` về ví chủ sân (phần không hoàn).<br>6. Hệ thống báo số tiền hoàn và số dư ví mới. |
| Kịch bản phụ | 4a. Đơn đã hủy, đã hoàn tất hoặc đã qua giờ chơi: từ chối và báo lý do.<br>3a. Khách bỏ qua xác nhận: không đổi gì.<br>5a. Đơn chưa cọc: không có giao dịch ví.<br>Ví dụ: cọc 39.000đ, hủy còn 30 giờ: hoàn 31.200đ, chủ sân nhận 7.800đ. |
| Ràng buộc phi chức năng | Giao diện không tự tính hoàn cọc (NFR-09). Hoàn cọc và đổi trạng thái đơn xảy ra cùng lúc (NFR-04). Bài đăng tìm đồng đội liên quan bị đóng. |

##### U018 – Xác nhận hoàn tất

| Mục | Nội dung |
| --- | --- |
| Use case ID | U018 |
| Tên Use Case | Xác nhận hoàn tất và kết toán cọc |
| Yêu cầu liên quan | FR-21 |
| Tóm tắt | Sau buổi chơi, chủ sân xác nhận để tiền cọc đang giữ chuyển sang ví chủ sân. |
| Tác nhân | Chủ sân (Admin cũng làm được) |
| Điều kiện tiên quyết | Đã đăng nhập; là chủ cơ sở của đơn; đơn `DEPOSITED`; đã đến giờ bắt đầu chơi. |
| Kết quả | Thành công: Đơn `COMPLETED`; ví hệ thống giảm và ví chủ sân tăng đúng tiền cọc; có 1 giao dịch `SETTLE`.<br>Thất bại: Đơn giữ nguyên `DEPOSITED`, ví không đổi. |
| Kịch bản chính | 1. Chủ sân mở đơn của buổi chơi và bấm hoàn tất.<br>2. Hệ thống kiểm tra đã đến giờ chơi và đơn đang `DEPOSITED`.<br>3. Hệ thống chuyển tiền cọc sang ví chủ sân, ghi `SETTLE`, đổi đơn sang `COMPLETED`.<br>4. Hệ thống báo thành công. |
| Kịch bản phụ | 2a. Chưa đến giờ chơi: từ chối và báo lý do.<br>2b. Đơn không ở `DEPOSITED`: báo lỗi, không đổi gì.<br>2c. Không phải chủ cơ sở: từ chối vì không đủ quyền. |
| Ràng buộc phi chức năng | Chuyển tiền và đổi trạng thái đơn cùng lúc; mỗi đơn kết toán đúng một lần (NFR-04). Phần tiền còn lại (70%) trả tại sân, ngoài hệ thống. |

##### U019 – Xem ví và giao dịch

| Mục | Nội dung |
| --- | --- |
| Use case ID | U019 |
| Tên Use Case | Xem ví và lịch sử giao dịch |
| Yêu cầu liên quan | FR-22 |
| Tóm tắt | Người dùng xem số dư và lịch sử biến động ví. |
| Tác nhân | Khách hàng, Chủ sân |
| Điều kiện tiên quyết | Đã đăng nhập. |
| Kết quả | Thành công: Hiển thị số dư và danh sách giao dịch phân trang.<br>Thất bại: Không hiển thị ví; dữ liệu không đổi. |
| Kịch bản chính | 1. Người dùng mở trang ví.<br>2. Hệ thống trả số dư hiện tại.<br>3. Người dùng xem lịch sử, có thể lọc theo loại (`TOPUP`, `DEPOSIT`, `REFUND`, `FORFEIT`, `SETTLE`).<br>4. Hệ thống trả danh sách giao dịch của ví đó. |
| Kịch bản phụ | 3a. Chưa có giao dịch: hiển thị danh sách rỗng. |
| Ràng buộc phi chức năng | Mỗi người chỉ thấy ví của mình (NFR-05). Tổng các giao dịch khớp số dư (NFR-04). |

##### U020 – Cấp tiền vào ví

| Mục | Nội dung |
| --- | --- |
| Use case ID | U020 |
| Tên Use Case | Admin cấp tiền vào ví |
| Yêu cầu liên quan | FR-23 |
| Tóm tắt | Admin cộng tiền trải nghiệm vào ví một người dùng (QĐ6). |
| Tác nhân | Admin |
| Điều kiện tiên quyết | Đã đăng nhập với vai trò Admin; người nhận tồn tại. |
| Kết quả | Thành công: Ví người nhận tăng đúng số tiền; có 1 giao dịch `TOPUP` ghi rõ Admin thực hiện.<br>Thất bại: Ví người nhận không đổi, không có giao dịch. |
| Kịch bản chính | 1. Admin chọn người dùng và nhập số tiền.<br>2. Hệ thống kiểm tra số tiền là số nguyên dương.<br>3. Hệ thống cộng ví và ghi giao dịch `TOPUP` cùng lúc.<br>4. Hệ thống báo số dư mới. |
| Kịch bản phụ | 2a. Số tiền không hợp lệ: từ chối và báo lý do.<br>2b. Người nhận không tồn tại: báo không tìm thấy.<br>1a. Không phải Admin: từ chối vì không đủ quyền. |
| Ràng buộc phi chức năng | NFR-04, NFR-05. Chỉ cấp tiền trong hệ thống, không nạp tiền thật. |

##### U021 – Nhả giữ chỗ hết hạn

| Mục | Nội dung |
| --- | --- |
| Use case ID | U021 |
| Tên Use Case | Nhả giữ chỗ hết hạn |
| Yêu cầu liên quan | FR-24 |
| Tóm tắt | Hệ thống hủy các đơn chờ cọc quá hạn và mở lại khung giờ. Admin có thể kích hoạt thủ công. |
| Tác nhân | Hệ thống (tiến trình nền), Admin |
| Điều kiện tiên quyết | Có đơn `PENDING_DEPOSIT` với hạn giữ chỗ đã qua. Kích hoạt thủ công cần vai trò Admin. |
| Kết quả | Thành công: Các đơn quá hạn thành `CANCELLED`, khung giờ được nhả. Không có giao dịch ví.<br>Thất bại: Đơn chưa xử lý được sẽ được xử lý ở lần chạy sau; không có đơn bị hủy dở. |
| Kịch bản chính | 1. Tiến trình nền chạy mỗi 60 giây (hoặc Admin kích hoạt).<br>2. Hệ thống tìm các đơn chờ cọc quá hạn.<br>3. Hệ thống đổi các đơn đó sang `CANCELLED` và nhả khung giờ.<br>4. Hệ thống ghi số đơn đã xử lý. |
| Kịch bản phụ | 2a. Không có đơn quá hạn: không làm gì.<br>1a. Người gọi thủ công không phải Admin: từ chối vì không đủ quyền. |
| Ràng buộc phi chức năng | Chạy mỗi 60 giây (NFR-08). Không ghi giao dịch ví vì chưa thu cọc. |


# 5 Bản mẫu (Prototype)

Wireframe 17 màn hình `P01` đến `P17` (nguồn `prototypes.svg`, ảnh trong `images/`).

| Mã | Màn hình | Vai trò | Use case |
| --- | --- | --- | --- |
| P01 | Đăng ký | Khách hàng | U001 |
| P02 | Đăng nhập | Khách hàng | U002 |
| P03 | Tìm và lọc sân | Khách hàng | U011 |
| P04 | Chi tiết sân và lịch trống | Khách hàng | U011, U012 |
| P05 | Xác nhận đặt sân | Khách hàng | U013, U014 |
| P06 | Kết quả đặt cọc | Khách hàng | U016 |
| P07 | Lịch đặt của tôi | Khách hàng | U015 |
| P08 | Hủy đặt sân | Khách hàng | U017 |
| P09 | Ví của khách | Khách hàng | U004, U019 |
| P10 | Danh sách cụm sân | Chủ sân | U005 |
| P11 | Tạo và sửa cụm sân, sân con | Chủ sân | U005, U006, U007 |
| P12 | Giờ mở cửa | Chủ sân | U007 |
| P13 | Bảng giá và hệ số | Chủ sân | U008 |
| P14 | Lịch đặt theo ngày | Chủ sân | U015 |
| P15 | Ví của chủ sân | Chủ sân | U019 |
| P16 | Admin cấp tiền | Admin | U020 |
| P17 | Danh sách giao dịch | Admin | U019 |

**Nhóm A. Khách hàng**

##### P01 – Đăng ký (U001)

![P01 Đăng ký](images/p01-dang-ky.png)

##### P02 – Đăng nhập (U002)

![P02 Đăng nhập](images/p02-dang-nhap.png)

##### P03 – Tìm và lọc sân (U011)

![P03 Tìm và lọc sân](images/p03-tim-san.png)

##### P04 – Chi tiết sân và lịch trống (U011, U012)

![P04 Chi tiết sân và lịch trống](images/p04-chi-tiet-san.png)

##### P05 – Xác nhận đặt sân (U013, U014)

![P05 Xác nhận đặt sân](images/p05-xac-nhan-dat-san.png)

##### P06 – Kết quả đặt cọc (U016)

![P06 Kết quả đặt cọc](images/p06-ket-qua-dat-coc.png)

##### P07 – Lịch đặt của tôi (U015)

![P07 Lịch đặt của tôi](images/p07-lich-dat-cua-toi.png)

##### P08 – Hủy đặt sân (U017)

![P08 Hủy đặt sân](images/p08-huy-dat-san.png)

##### P09 – Ví của khách (U004, U019)

![P09 Ví của khách](images/p09-vi-khach.png)

**Nhóm B. Chủ sân**

##### P10 – Danh sách cụm sân (U005)

![P10 Danh sách cụm sân](images/p10-ds-cum-san.png)

##### P11 – Tạo và sửa cụm sân, sân con (U005, U006, U007)

![P11 Tạo và sửa cụm sân, sân con](images/p11-sua-cum-san.png)

##### P12 – Giờ mở cửa (U007)

![P12 Giờ mở cửa](images/p12-gio-mo-cua.png)

##### P13 – Bảng giá và hệ số (U008)

![P13 Bảng giá và hệ số](images/p13-bang-gia.png)

##### P14 – Lịch đặt theo ngày (U015)

![P14 Lịch đặt theo ngày](images/p14-lich-dat-theo-ngay.png)

##### P15 – Ví của chủ sân (U019)

![P15 Ví của chủ sân](images/p15-vi-chu-san.png)

**Nhóm C. Admin**

##### P16 – Admin cấp tiền (U020)

![P16 Admin cấp tiền](images/p16-admin-cap-tien.png)

##### P17 – Danh sách giao dịch (U019)

![P17 Danh sách giao dịch](images/p17-admin-giao-dich.png)
