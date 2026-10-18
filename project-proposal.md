**NHẬP MÔN CÔNG NGHỆ PHẦN MỀM**

**Project Proposal**

**Đề tài:** Hệ thống Quản lý và Đặt sân Thể thao

**Nhóm:** TODO - Hậu: điền STT nhóm

Bộ môn Công nghệ phần mềm

Khoa Công nghệ thông tin

Đại học Khoa học tự nhiên TP HCM

**MỤC LỤC**

[**Các nội dung chính**](#các-nội-dung-chính)

[**1 Bảng đánh giá thành viên**](#1-bảng-đánh-giá-thành-viên)

[**2 Phát biểu bài toán sơ lược**](#2-phát-biểu-bài-toán-sơ-lược)

[**3 Giải pháp đề xuất**](#3-giải-pháp-đề-xuất)

[**4 Kế hoạch phát triển**](#4-kế-hoạch-phát-triển)

[**5 Kế hoạch nhân sự & chi phí**](#5-kế-hoạch-nhân-sự--chi-phí)

**Project Proposal**

# Các nội dung chính

Tài liệu gồm các nội dung:

- Phát biểu bài toán sơ lược
- Giải pháp đề xuất
- Kế hoạch phát triển
- Kế hoạch nhân sự & chi phí

# 1 Bảng đánh giá thành viên

| **MSSV** | **Họ Tên** | **% đóng góp (tối đa 100%)** | **Chữ ký** |
| --- | --- | --- | --- |
| 24120307 | Vòng Sau Hậu | TODO - Hậu | |
| 24120264 | Nguyễn Huỳnh Gia Bảo | TODO - Hậu | |
| 24120230 | Dương Danh Toàn | TODO - Hậu | |
| 24120278 | Võ Văn Khánh Đăng | TODO - Hậu | |
| 24120236 | Bùi Đặng Khả Tuân | TODO - Hậu | |

# 2 Phát biểu bài toán sơ lược

#### Thực trạng

Người chơi cầu lông, pickleball, bóng đá mini hiện vẫn đặt sân chủ yếu qua điện thoại, Zalo hoặc Facebook. Chủ sân ghi lịch bằng sổ tay hoặc file Excel, nhận cọc qua chuyển khoản và tự quyết định có hoàn cọc hay không khi khách hủy. Cách làm này gây ra hai vấn đề thường gặp:

**Tình huống 1 – Trùng lịch.** Một nhóm gọi điện đặt sân 19h tối thứ Sáu, chuyển khoản cọc rồi gửi ảnh qua Zalo. Đến giờ chơi, sân đã có nhóm khác vì chủ sân nhận trùng hoặc quên ghi sổ. Khách không có bằng chứng rõ ràng ngoài tin nhắn, hai bên tranh cãi và cả hai nhóm đều mất buổi chơi.

**Tình huống 2 – Hoàn cọc tùy chủ sân.** Khách báo hủy trước một ngày vì trời mưa. Mỗi sân một kiểu: có sân hoàn đủ, có sân hoàn một nửa, có sân không hoàn. Khách phải nhắn qua lại nhiều lần, và vì không có quy định công bố trước nên khách thường chịu thiệt.

TODO - Toàn: xem xét lại 2 tình huống (bổ sung số liệu hoặc ví dụ thực tế nếu có).

#### Các giải pháp hiện có

| Sản phẩm | Đối tượng | Làm tốt | Hạn chế so với bài toán |
| --- | --- | --- | --- |
| Datsan247 (Việt Nam) | Người chơi | Nhiều môn, xem giờ trống, đặt và thanh toán | Chỉ là kênh đặt sân cho khách |
| ALOBO (Việt Nam) | Chủ sân | Quản lý lịch, dịch vụ, công nợ, hóa đơn | Phần mềm cho chủ sân, khách không tìm sân ở đây |
| Playtomic (quốc tế) | Người chơi, câu lạc bộ | Ghép trận theo trình độ, tự hủy và hoàn tiền khi không đủ người | Tập trung padel/tennis ở châu Âu, gần như chưa có ở Việt Nam |
| CourtReserve (quốc tế) | Câu lạc bộ | Luật đặt sân tùy chỉnh, chống đặt trùng, thu tiền trước | Giao diện di động bị đánh giá khó dùng; thu phí theo tháng |

TODO - Toàn: tải thử Datsan247, ALOBO để kiểm chứng bảng trên.

#### Điểm khác biệt

- Một hệ thống chung cho cả chủ sân và người chơi, thay vì tách thành app riêng cho mỗi bên.
- Chính sách cọc và hoàn cọc công khai, tính tự động qua ví nội bộ, hai bên không phải thương lượng.
- Hướng tới sân cầu lông, pickleball, bóng đá mini tại Việt Nam.

TODO - Toàn: xem lại điểm khác biệt sau khi kiểm chứng đối thủ.

#### Mô tả hệ thống

Hệ thống là ứng dụng web với ba nhóm người dùng. Chủ sân tạo sân, cấu hình khung giờ và bảng giá theo thời điểm. Khách hàng tìm sân trống, đặt sân và đặt cọc 30% từ ví. Admin cấp tiền vào ví người dùng. Chủ sân cũng là một người dùng, chỉ có thêm quyền quản lý sân. Mọi dòng tiền (cọc, hoàn cọc, tiền cọc bị mất) đều đi qua ví nội bộ; nạp tiền và rút tiền thật không nằm trong phạm vi đồ án.

#### Môi trường hoạt động

- Client: trình duyệt web hỗ trợ HTML5/CSS3/JavaScript trên máy tính và điện thoại.
- Server: TODO - Tuân, Toàn: ghi môi trường server sau khi chốt framework (hosting hiện tại hỗ trợ Node.js hoặc Python, 1 CPU, 1 GB RAM, 20 GB ổ đĩa).
- Dịch vụ ngoài: dịch vụ email để gửi OTP và xác nhận đặt sân Brevo; dịch vụ bản đồ Leaflet và OpenStreetMap.

#### Ràng buộc thiết kế và triển khai

- Frontend và Backend tách riêng, giao tiếp qua REST API.
- Frontend: React.js.
- Backend: TODO - Tuân, Toàn: chọn framework, ưu tiên nền Node.js hoặc Python vì hosting hiện tại chạy được.
- CSDL quan hệ: TODO - Bảo: chọn hệ quản trị (ví dụ PostgreSQL, MySQL).
- Mật khẩu mã hóa bằng Bcrypt, giao tiếp qua HTTPS, xác thực bằng JWT.
- Mã nguồn quản lý bằng Git/GitHub.

# 3 Giải pháp đề xuất

#### 3.1 Phần mềm

#### 3.1.1. Danh sách các chức năng phần mềm

| # | Câu chuyện người dùng | Chức năng | Ưu tiên |
| --- | --- | --- | --- |
| 1 | Là chủ sân, tôi muốn đăng sân và đặt giá theo từng khung giờ để khách đặt được và tôi tối ưu doanh thu. | Quản lý sân, khung giờ, bảng giá theo thời điểm | Cao |
| 2 | Là khách hàng, tôi muốn tìm sân còn trống và đặt ngay, biết trước tổng tiền, để không phải gọi điện hỏi từng sân. | Tìm, lọc sân trống; đặt sân; khóa khung giờ đã đặt | Cao |
| 3 | Là khách hàng, tôi muốn đặt cọc và được hoàn cọc theo quy định rõ ràng khi hủy, để không phải thương lượng với chủ sân. | Đặt cọc từ ví; hủy sân và hoàn cọc tự động; Admin cấp tiền vào ví | Cao |
| 4 | Là người chơi thiếu người, tôi muốn đăng bài tìm đồng đội để đủ người chơi. | Đăng bài ghép đội; đăng ký tham gia | Thấp |
| 5 | Là người dùng, tôi muốn có thêm các tiện ích để dùng hệ thống thuận tiện hơn. | Đánh giá sân; dịch vụ đi kèm; xem vị trí sân trên bản đồ; dashboard Admin | Thấp |

**Quy định liên quan**

| Mã | Nội dung | Chức năng |
| --- | --- | --- |
| QĐ1 | Giờ thường: giá cơ sở. Giờ cao điểm, cuối tuần, ngày lễ: tăng 20%–50% so với giá cơ sở. | 1 |
| QĐ2 | Tổng tiền = giá khung giờ × hệ số thời điểm + phí dịch vụ đi kèm (nếu có). | 2 |
| QĐ3 | Khung giờ đã được đặt cọc sẽ bị khóa, không ai khác đặt được. | 2 |
| QĐ4 | Tiền cọc = 30% tổng tiền, trừ từ ví khách. Số tiền còn lại thanh toán tại sân hoặc chuyển khoản trước giờ chơi. | 3 |
| QĐ5 | Hủy trước 24 giờ: hoàn 80% cọc. Hủy 12–24 giờ: hoàn 50%. Hủy dưới 12 giờ: không hoàn. Tiền hoàn vào ví khách, phần không hoàn vào ví chủ sân. | 3 |
| QĐ6 | Mọi dòng tiền đi qua ví và được ghi thành giao dịch. Số dư ví không được âm. Tiền vào ví do Admin cấp. | 3 |
| QĐ7 | Trạng thái lịch đặt: Chờ đặt cọc → Đã đặt cọc → Đã thanh toán hoàn tất; hoặc Đã hủy. | 2, 3 |

#### 3.1.2. Kiến trúc tổng thể phần mềm

```text
┌──────────────────────────────────────────────────────────┐
│ CLIENT – Ứng dụng web                                    │
│ Khách hàng  |  Chủ sân  |  Admin                         │
└────────────────────────────┬─────────────────────────────┘
                             │ HTTPS – REST API (JWT)
                             ▼
┌──────────────────────────────────────────────────────────┐
│ BACKEND                                                  │
│ Xác thực | Sân & bảng giá | Đặt sân | Ví | Ghép đội      │
└──────────────┬──────────────────────────────┬────────────┘
               ▼                              ▼
┌───────────────────────────┐   ┌──────────────────────────┐
│ CSDL quan hệ              │   │ Dịch vụ ngoài            │
│ tài khoản, sân, lịch đặt, │   │ Email, bản đồ            │
│ ví, giao dịch             │   │                          │
└───────────────────────────┘   └──────────────────────────┘
```

#### 3.1.3. Các phần không thực hiện

- Ứng dụng di động riêng (Android/iOS).
- Nạp tiền thật qua QR hoặc cổng thanh toán, rút tiền thật về ngân hàng; nếu kịp chỉ làm bản demo.
- Gửi OTP, thông báo qua SMS.
- Chỉ đường trong ứng dụng (mở bằng Google Maps).
- Chủ sân đánh giá người chơi.

#### 3.2 Phần cứng

- Máy chủ: TODO - Tuân, Toàn: cập nhật sau khi Backend và Frontend chốt framework (hosting hiện tại: 1 CPU, 1 GB RAM, 20 GB ổ đĩa).
- Người dùng: máy tính hoặc điện thoại có trình duyệt và Internet.

# 4 Kế hoạch phát triển

Nhóm phát triển theo quy trình **Scrum**. Dự án kéo dài khoảng **9 tuần**, bắt đầu từ 12/10/2026 (TODO - Hậu: điền hạn cuối chính thức), chia thành 5 sprint. Mỗi sprint kết thúc bằng một bản chạy được (Increment). Các giai đoạn 4.1–4.5 không làm tuần tự một lần mà lặp lại trong từng sprint; mỗi mục ghi rõ giai đoạn đó diễn ra khi nào và tạo ra thành phẩm gì.

**Vai trò Scrum**

| Vai trò | Thành viên |
| --- | --- |
| Product Owner, Scrum Master | Vòng Sau Hậu |
| Development Team | Bùi Đặng Khả Tuân, Dương Danh Toàn, Nguyễn Huỳnh Gia Bảo, Võ Văn Khánh Đăng |

**Sự kiện Scrum** (họp online qua Google Meet)

| Buổi họp | Khi nào | Nội dung |
| --- | --- | --- |
| Sprint Planning | Đầu sprint | Chọn việc từ Product Backlog, chia task trên Jira |
| Họp giữa sprint | Giữa sprint | Kiểm tra tiến độ, gỡ vướng mắc, điều chỉnh task |
| Sprint Review + Retrospective | Cuối sprint | Demo Increment, rút kinh nghiệm cho sprint sau |
| Họp đột xuất | Khi phát sinh task quan trọng | Phân công lại |

Những ngày không họp, mỗi thành viên tự cập nhật trạng thái task trên Jira và báo lên nhóm chat khi bị vướng.

**Công cụ:** Jira (backlog, sprint, bảng task, theo dõi lỗi); GitHub (mã nguồn); Google Meet (họp); Postman (kiểm thử API).

**Lịch sprint**

| Sprint | Tuần | Thời gian | Mục tiêu | Chức năng | Thành phẩm |
| --- | --- | --- | --- | --- | --- |
| 0 | Tuần 1–2 | 12/10 – 25/10 | Phân tích, thiết kế, chuẩn bị | – | Project Proposal; Product Backlog trên Jira; chốt công nghệ; thiết kế CSDL và API ban đầu; repo và khung dự án |
| 1 | Tuần 3–4 | 26/10 – 08/11 | Đăng nhập; chủ sân tạo sân và bảng giá | 1 | Đăng ký/đăng nhập; quản lý sân, khung giờ, bảng giá |
| 2 | Tuần 5–6 | 09/11 – 22/11 | Tìm và đặt sân; ví và đặt cọc | 2, 3 | Tìm/lọc sân, đặt sân, khóa khung giờ; Admin cấp tiền; cọc từ ví |
| 3 | Tuần 7–8 | 23/11 – 06/12 | Hủy và hoàn cọc; ghép đội | 3, 4 | Đủ luồng đặt – hủy – hoàn cọc vào ví; ghép đội |
| 4 | Tuần 9 | 07/12 – 13/12 | Tiện ích, kiểm thử toàn hệ thống, triển khai | 5 (nếu kịp) | Đánh giá sân, dịch vụ đi kèm, bản đồ, dashboard; bản đã triển khai; báo cáo cuối kỳ |

TODO - Hậu: bổ sung các mốc nộp giữa kỳ của giáo viên vào cuối sprint gần nhất.

**Thứ tự cắt giảm khi trễ tiến độ:** chức năng 5 → chức năng 4 (làm bản đơn giản).

**Luồng chính** *đăng nhập → tìm sân → đặt sân → cọc từ ví → hủy/hoàn cọc* **không được cắt**.

#### 4.1 Phân tích yêu cầu

- **Khi nào:** chủ yếu ở Sprint 0 (tuần 1–2); đầu mỗi sprint làm rõ thêm các chức năng của sprint đó trong Sprint Planning.
- **Công việc:** đọc mô tả đề tài, viết user story, xác định quy định nghiệp vụ, sắp ưu tiên backlog.
- **Thành phẩm:** Project Proposal; Product Backlog trên Jira; tài liệu phân tích yêu cầu.

#### 4.2 Thiết kế phần mềm

- **Khi nào:** thiết kế tổng thể ở Sprint 0; thiết kế chi tiết từng chức năng ngay trong sprint làm chức năng đó.
- **Công việc:** chốt công nghệ; thiết kế CSDL (đặc biệt bảng ví và giao dịch); thiết kế danh sách API; thiết kế giao diện.
- **Thành phẩm:** sơ đồ kiến trúc; lược đồ CSDL (Bảo); tài liệu API (Tuân, Toàn); bản thiết kế giao diện (Đăng).

#### 4.3 Cài đặt (implement) phần mềm

- **Khi nào:** Sprint 1 – Sprint 4, theo lịch sprint ở trên.
- **Cách làm:** mỗi task là một nhánh Git; xong thì tạo Pull Request để ít nhất 1 thành viên khác xem trước khi gộp vào nhánh chính. Thành viên rảnh việc hỗ trợ thành viên khác.
- **Thành phẩm:** Increment chạy được sau mỗi sprint, demo ở Sprint Review.

#### 4.4 Kiểm thử phần mềm

- **Khi nào:** trong từng sprint (kiểm thử từng chức năng khi xong) và tuần 9 (kiểm thử toàn hệ thống).
- **Môi trường:** kiểm thử trên một bản thử (staging) tách riêng với bản chính thức, để dữ liệu test (nhất là số dư ví) không ảnh hưởng bản demo.
- **Các lớp kiểm thử:**

| Lớp | Cách làm | Người phụ trách |
| --- | --- | --- |
| Unit test | Test tự động cho các hàm tính tiền: tổng tiền, cọc 30%, hoàn cọc 80% / 50% / 0%, số dư ví | Tuân, Toàn |
| Kiểm thử API | Bộ request Postman cho từng chức năng; chạy lại toàn bộ trước mỗi Sprint Review | Hậu (dựa trên tài liệu API do Backend cung cấp) |
| Kiểm thử chức năng | Kịch bản test viết từ user story và quy định QĐ1–QĐ7; bấm thử trên giao diện, ghi đạt/không đạt | Hậu |

- Lỗi phát hiện được tạo thành task loại **Bug** trên Jira và giao lại cho người làm task đó.
- **Định nghĩa "Xong" (Definition of Done)** – một task chỉ xong khi:
  1. Code đã đẩy lên GitHub và được ít nhất 1 thành viên khác xem qua.
  2. Chạy được trên bản thử, không chỉ trên máy người code.
  3. Đã có request Postman hoặc kịch bản test cho chức năng đó.
  4. Tester đã kiểm thử và đánh dấu đạt.
  5. Đúng các quy định nghiệp vụ liên quan (nếu có).
- **Thành phẩm:** bộ Postman Collection; danh sách kịch bản test và kết quả; danh sách lỗi trên Jira.

#### 4.5 Triển khai, bảo trì

- **Triển khai:** dựng bản thử từ Sprint 1 để kiểm thử liên tục; triển khai bản chính thức lên hosting của nhóm ở tuần 9 (TODO - Tuân, Toàn: ghi cách triển khai sau khi chốt framework).
- **Bảo trì:** sửa lỗi phát hiện trong quá trình demo và chấm điểm.
- **Thành phẩm:** hệ thống chạy trên máy chủ; hướng dẫn cài đặt và hướng dẫn sử dụng.

# 5 Kế hoạch nhân sự & chi phí

#### 5.1 Nhân sự

| Thành viên | MSSV | Vai trò | Công việc chính |
| --- | --- | --- | --- |
| Vòng Sau Hậu | 24120307 | Quản lý dự án, Product Owner, Scrum Master, Kiểm thử | Quản lý backlog và sprint trên Jira, giao task, tổ chức họp, viết kịch bản test, kiểm thử API và chức năng |
| Bùi Đặng Khả Tuân | 24120236 | Backend | Xây dựng API, nghiệp vụ đặt sân, ví, unit test |
| Dương Danh Toàn | 24120230 | Backend | Xây dựng API, nghiệp vụ đặt sân, ví, unit test |
| Nguyễn Huỳnh Gia Bảo | 24120264 | Cơ sở dữ liệu | Thiết kế và quản lý CSDL, dữ liệu mẫu, truy vấn tìm kiếm sân |
| Võ Văn Khánh Đăng | 24120278 | Frontend | Thiết kế và xây dựng giao diện web cho khách hàng, chủ sân, admin |

Thành viên rảnh việc sẽ hỗ trợ các mảng khác.

**Rủi ro nhân sự và hướng xử lý**

| Rủi ro | Hướng xử lý |
| --- | --- |
| Frontend chỉ có 1 người, khối lượng giao diện lớn (3 nhóm người dùng) | Thành viên backend rảnh việc hỗ trợ một phần giao diện (ví dụ trang Admin) |
| Việc CSDL dồn ở đầu dự án, ít dần về sau | Từ Sprint 2, Bảo hỗ trợ dữ liệu mẫu, truy vấn và kiểm thử luồng tiền |
| Trễ tiến độ do lịch học, thi | Cắt giảm theo thứ tự ở mục 4; giữ nguyên luồng chính |

#### 5.2 Chi phí dự kiến

Đồ án ưu tiên dùng hạ tầng sẵn có và các dịch vụ miễn phí.

| Khoản mục | Phương án | Chi phí dự kiến |
| --- | --- | --- |
| Nhân công | 5 sinh viên thực hiện trong khuôn khổ môn học | 0đ |
| Quản lý dự án, mã nguồn, họp, kiểm thử | Jira Free, GitHub, Google Meet, Postman | 0đ |
| Máy chủ / hosting | Hosting sẵn có của nhóm (TODO - Tuân, Toàn: cập nhật nếu đổi hosting sau khi chốt framework) | TODO - Hậu: xác nhận chi phí hosting |
| Tên miền và chứng chỉ SSL | Tên miền phụ miễn phí; SSL miễn phí (Let's Encrypt) | 0đ |
| Dịch vụ bản đồ | Trong hạn mức miễn phí | 0đ |
| Gửi email (OTP, thông báo) | Dịch vụ email miễn phí | 0đ |
| Dự phòng | Vượt hạn mức gói miễn phí | 200.000đ |
| **Tổng** | | TODO - Hậu: tính lại sau khi có chi phí hosting |
