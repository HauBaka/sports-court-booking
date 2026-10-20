### ĐẠI HỌC KHOA HỌC TỰ NHIÊN TP HCM

### KHOA CÔNG NGHỆ THÔNG TIN

### BỘ MÔN CÔNG NGHỆ PHẦN MỀM

**NHẬP MÔN CÔNG NGHỆ PHẦN MỀM**

## Project Proposal

**Đề tài:** Hệ thống Quản lý và Đặt sân Thể thao

**Nhóm:** 6

**MỤC LỤC**

- [1 Bảng đánh giá thành viên](#1-bảng-đánh-giá-thành-viên)
- [2 Phát biểu bài toán sơ lược](#2-phát-biểu-bài-toán-sơ-lược)
  - [Thực trạng](#thực-trạng)
  - [Các giải pháp hiện có](#các-giải-pháp-hiện-có)
  - [Điểm khác biệt](#điểm-khác-biệt)
  - [Mô tả hệ thống](#mô-tả-hệ-thống)
  - [Môi trường hoạt động](#môi-trường-hoạt-động)
  - [Ràng buộc thiết kế và triển khai](#ràng-buộc-thiết-kế-và-triển-khai)
- [3 Giải pháp đề xuất](#3-giải-pháp-đề-xuất)
  - [3.1 Phần mềm](#31-phần-mềm)
    - [3.1.1 Danh sách các chức năng phần mềm](#311-danh-sách-các-chức-năng-phần-mềm)
    - [3.1.2 Kiến trúc tổng thể phần mềm](#312-kiến-trúc-tổng-thể-phần-mềm)
    - [3.1.3 Các phần không thực hiện](#313-các-phần-không-thực-hiện)
  - [3.2 Phần cứng](#32-phần-cứng)
- [4 Kế hoạch phát triển](#4-kế-hoạch-phát-triển)
  - [4.1 Phân tích yêu cầu](#41-phân-tích-yêu-cầu)
  - [4.2 Thiết kế phần mềm](#42-thiết-kế-phần-mềm)
  - [4.3 Cài đặt (implement) phần mềm](#43-cài-đặt-implement-phần-mềm)
  - [4.4 Kiểm thử phần mềm](#44-kiểm-thử-phần-mềm)
  - [4.5 Triển khai, bảo trì](#45-triển-khai-bảo-trì)
- [5 Kế hoạch nhân sự & chi phí](#5-kế-hoạch-nhân-sự--chi-phí)
  - [5.1 Nhân sự](#51-nhân-sự)
  - [5.2 Chi phí dự kiến](#52-chi-phí-dự-kiến)

**Project Proposal**

# 1 Bảng đánh giá thành viên

| **MSSV** | **Họ Tên** | **% đóng góp (tối đa 100%)** | **Chữ ký** |
| --- | --- | --- | --- |
| 24120307 | Vòng Sau Hậu | 100% | |
| 24120264 | Nguyễn Huỳnh Gia Bảo | 100%  | |
| 24120230 | Dương Danh Toàn | 100%  | |
| 24120278 | Võ Văn Khánh Đăng | 100%  | |
| 24120236 | Bùi Đặng Khả Tuân | 100%  | |

# 2 Phát biểu bài toán sơ lược

#### Thực trạng

Người chơi cầu lông, pickleball, bóng đá mini hiện vẫn đặt sân chủ yếu qua điện thoại, Zalo hoặc Facebook. Chủ sân ghi lịch bằng sổ tay hoặc file Excel, nhận cọc qua chuyển khoản và tự quyết định có hoàn cọc hay không khi khách hủy. Cách làm này gây ra ba vấn đề thường gặp:

**Tình huống 1 – Trùng lịch.** Một nhóm gọi điện đặt sân 19h tối thứ Sáu, chuyển khoản cọc rồi gửi ảnh qua Zalo. Đến giờ chơi, sân đã có nhóm khác vì chủ sân nhận trùng hoặc quên ghi sổ. Khách không có bằng chứng rõ ràng ngoài tin nhắn, hai bên tranh cãi và cả hai nhóm đều mất buổi chơi.

**Tình huống 2 – Hoàn cọc tùy chủ sân.** Khách báo hủy trước một ngày vì trời mưa. Mỗi sân một kiểu: có sân hoàn đủ, có sân hoàn một nửa, có sân không hoàn. Khách phải nhắn qua lại nhiều lần, và vì không có quy định công bố trước nên khách thường chịu thiệt.

**Tình huống 3 – Mức giá đặt sân khác nhau.** Giá sân thay đổi theo khung giờ cao điểm, cuối tuần và ngày lễ. Khi khách đặt lịch, chủ sân hoặc nhân viên phải nhớ áp dụng bảng giá phức tạp (ví dụ: ngày thường khác cuối tuần, giờ vàng từ 17h–20h khác giờ thấp điểm). Việc tính toán nhẩm hoặc tra bảng giá thủ công rất dễ dẫn đến nhầm lẫn, tính thừa hoặc thiếu tiền của khách dẫn đến khách có thể cảm thấy không công bằng nếu họ nghi ngờ chủ sân áp dụng "giá tùy hứng".


#### Các giải pháp hiện có

| Sản phẩm | Đối tượng | Làm tốt | Hạn chế so với bài toán |
| --- | --- | --- | --- |
| Datsan247 (Việt Nam) | Chủ sân và người chơi | Nhiều môn, xem giờ trống, đặt và thanh toán | Nhiều sân không có địa chỉ rõ ràng, chưa đề xuất được sân bãi lân cận |
| ALOBO và ALOBooking (Việt Nam) | ALOBO dành cho chủ sân, ALOBooking dành cho người chơi | Quản lý lịch sân, dịch vụ, công nợ, hóa đơn | Người chơi và chủ sân tách ra 2 nền tảng riêng biệt, vé vãng lai phụ thuộc vào việc chủ hội nhóm/ban tổ chức hôm đó có mở buổi giao lưu hay không |
| Playtomic (quốc tế) | Người chơi, câu lạc bộ | Ghép trận theo trình độ, tự hủy và hoàn tiền khi không đủ người | Tập trung padel/tennis ở châu Âu, gần như chưa có ở Việt Nam |
| CourtReserve (quốc tế) | Câu lạc bộ | Luật đặt sân tùy chỉnh, chống đặt trùng, thu tiền trước | Giao diện di động bị đánh giá khó dùng; thu phí theo tháng |


#### Điểm khác biệt

- Một hệ thống chung cho cả chủ sân và người chơi, thay vì tách thành app riêng cho mỗi bên.
- Chính sách cọc và hoàn cọc công khai, tính tự động qua ví nội bộ, hai bên không phải thương lượng.
- Hướng tới sân cầu lông, pickleball, bóng đá mini tại Việt Nam.
- Tìm và lọc sân theo khu vực, giúp khách thấy các sân lân cận còn trống.
- Bảng giá theo khung giờ được công khai, khách thấy tổng tiền trước khi đặt.


#### Mô tả hệ thống

Hệ thống là ứng dụng web với ba nhóm người dùng. Chủ sân tạo sân, cấu hình khung giờ và bảng giá theo thời điểm. Khách hàng tìm sân trống, đặt sân và đặt cọc 30% từ ví. Admin cấp tiền vào ví người dùng. Chủ sân cũng là một người dùng, chỉ có thêm quyền quản lý sân. Mọi dòng tiền (cọc, hoàn cọc, tiền cọc bị mất) đều đi qua ví nội bộ; nạp tiền và rút tiền thật không nằm trong phạm vi đồ án.

#### Môi trường hoạt động

- Client: trình duyệt web hỗ trợ HTML5/CSS3/JavaScript trên máy tính và điện thoại.
- Server: Cấu hình máy chủ dự kiến với 1 vCPU, 1 GB RAM, 20 GB SSD.
- Dịch vụ ngoài: dịch vụ email Brevo để gửi OTP và xác nhận đặt sân; bản đồ Leaflet với dữ liệu OpenStreetMap.

#### Ràng buộc thiết kế và triển khai

- Frontend và Backend tách riêng, giao tiếp qua REST API.
- Frontend: React.js.
- Backend: Python (FastAPI).
- Cơ sở dữ liệu (CSDL) quan hệ: MySQL.
- Mật khẩu mã hóa bằng Bcrypt, giao tiếp qua HTTPS, xác thực bằng JWT.
- Mã nguồn quản lý bằng Git/GitHub.

# 3 Giải pháp đề xuất

#### 3.1 Phần mềm

#### 3.1.1. Danh sách các chức năng phần mềm

| # | Tính năng | Câu chuyện người dùng | Story cốt lõi | Ưu tiên |
| --- | --- | --- | --- | --- |
| 1 | Quản lý sân và bảng giá | Là chủ sân, tôi muốn đăng sân và đặt giá theo từng khung giờ để khách đặt được và tôi tối ưu doanh thu. | Tạo cụm sân và sân con; cấu hình giờ mở cửa; bảng giá theo thời điểm | Cao |
| 2 | Tìm và đặt sân | Là khách hàng, tôi muốn tìm sân còn trống ở khu vực gần mình và đặt ngay, biết trước tổng tiền, để không phải gọi điện hỏi từng sân. | Lọc sân theo khu vực; xem vị trí sân trên bản đồ; xem lịch trống theo ngày; đặt sân và tính tổng tiền; chống đặt trùng khung giờ | Cao |
| 3 | Cọc và hoàn cọc qua ví | Là khách hàng, tôi muốn đặt cọc và được hoàn cọc theo quy định rõ ràng khi hủy, để không phải thương lượng với chủ sân. | Đặt cọc 30% từ ví; hủy sân và hoàn cọc tự động; Admin cấp tiền vào ví | Cao |
| 4 | Ghép đội | Là người chơi thiếu người, tôi muốn đăng bài tìm đồng đội để đủ người chơi. | Đăng bài tìm người; đăng ký tham gia | Thấp |
| 5 | Tiện ích | Là người dùng, tôi muốn có thêm tiện ích như đánh giá sân, dịch vụ đi kèm, dashboard Admin để dùng hệ thống thuận tiện hơn. | Đánh giá sân; dịch vụ đi kèm | Thấp |

**Quy định liên quan**

| Mã | Nội dung | Chức năng |
| --- | --- | --- |
| QĐ1 | Giờ thường: giá cơ sở. Giờ cao điểm, cuối tuần, ngày lễ: tăng 20%–50% so với giá cơ sở. | 1 |
| QĐ2 | Tổng tiền = giá khung giờ × hệ số thời điểm + phí dịch vụ đi kèm (nếu có). | 2 |
| QĐ3 | Khung giờ đã được đặt cọc sẽ bị khóa, không ai khác đặt được. | 2 |
| QĐ4 | Tiền cọc = 30% tổng tiền, trừ từ ví khách. Số tiền còn lại thanh toán tại sân hoặc chuyển khoản trước giờ chơi. | 3 |
| QĐ5 | Hủy từ 24 giờ trở lên trước giờ chơi: hoàn 80% cọc. Từ 12 đến dưới 24 giờ: hoàn 50%. Dưới 12 giờ: không hoàn. Tiền hoàn vào ví khách, phần không hoàn vào ví chủ sân. | 3 |
| QĐ6 | Mọi dòng tiền đi qua ví và được ghi thành giao dịch. Số dư ví không được âm. Tiền vào ví do Admin cấp. | 3 |
| QĐ7 | Trạng thái lịch đặt: Chờ đặt cọc → Đã đặt cọc → Đã thanh toán hoàn tất; hoặc Đã hủy. | 2, 3 |

#### 3.1.2. Kiến trúc tổng thể phần mềm

Hệ thống theo kiến trúc ba tầng: giao diện, nghiệp vụ, dữ liệu. Frontend chỉ giao tiếp với Backend qua REST API; mọi quy định về giá, cọc, hoàn cọc được xử lý ở Backend.

```text
┌──────────────────────────────────────────────────────────────────────┐
│                     NGƯỜI DÙNG – TRÌNH DUYỆT WEB                     │
│              Khách hàng          Chủ sân          Admin              │
└───────────────────────────────────┬──────────────────────────────────┘
                                    │ HTTPS
┌───────────────────────────────────▼──────────────────────────────────┐
│ FRONTEND – Ứng dụng web                                              │
│ Tìm và đặt sân · Quản lý sân, bảng giá · Ví · Ghép đội · Quản trị    │
└───────────────────────────────────┬──────────────────────────────────┘
                                    │ REST API (JSON) · JWT
┌───────────────────────────────────▼──────────────────────────────────┐
│ BACKEND – Xử lý nghiệp vụ, áp dụng quy định QĐ1–QĐ7                  │
│                                                                      │
│   ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐   │
│   │ Xác thực │ │  Sân và  │ │ Đặt sân  │ │  Ví và   │ │ Ghép đội │   │
│   │phân quyền│ │ bảng giá │ │ khóa giờ │ │giao dịch │ │          │   │
│   └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘   │
└────────────────┬────────────────────────────────────┬────────────────┘
                 │ SQL (transaction)                  │ API
┌────────────────▼────────────────┐ ┌─────────────────▼────────────────┐
│ CSDL QUAN HỆ                    │ │ DỊCH VỤ NGOÀI                    │
│ Tài khoản · Sân · Lịch đặt      │ │ Email: OTP, xác nhận đặt sân     │
│ Ví · Giao dịch ví               │ │ Bản đồ: vị trí sân               │
└─────────────────────────────────┘ └──────────────────────────────────┘
```

| Tầng | Thành phần | Nhiệm vụ chính |
| --- | --- | --- |
| Giao diện | Ứng dụng web cho khách hàng, chủ sân, Admin | Hiển thị dữ liệu, nhận thao tác người dùng, gọi API |
| Nghiệp vụ | Backend gồm 5 module: xác thực và phân quyền, sân và bảng giá, đặt sân, ví và giao dịch, ghép đội | Áp dụng quy định QĐ1–QĐ7; kiểm tra quyền; xử lý tiền trong transaction |
| Dữ liệu | CSDL quan hệ | Lưu trữ dữ liệu; ràng buộc số dư ví không âm và không trùng khung giờ |
| Dịch vụ ngoài | Dịch vụ email, dịch vụ bản đồ | Gửi OTP, xác nhận đặt sân; hiển thị vị trí sân |

#### 3.1.3. Các phần không thực hiện

- Ứng dụng di động riêng (Android/iOS).
- Nạp tiền thật qua QR hoặc cổng thanh toán, rút tiền thật về ngân hàng; nếu kịp chỉ làm bản demo.
- Gửi OTP, thông báo qua SMS.
- Chỉ đường trong ứng dụng (mở bằng Google Maps).
- Chủ sân đánh giá người chơi.

#### 3.2 Phần cứng

- Máy chủ: Sử dụng hosting/VPS hiện có của nhóm với cấu hình dự kiến 1 vCPU, 1 GB RAM và 20 GB SSD.
- CSDL: MySQL do bên hosting cung cấp, chạy riêng với máy chủ ứng dụng.
- Người dùng: máy tính hoặc điện thoại có trình duyệt và Internet.

# 4 Kế hoạch phát triển

Nhóm phát triển theo quy trình **Scrum**, chia thành 5 sprint. Mỗi sprint kết thúc bằng một bản chạy được (Increment). Các giai đoạn 4.1–4.5 không làm tuần tự một lần mà lặp lại trong từng sprint.

**Vai trò Scrum**

| Vai trò | Thành viên | Trách nhiệm |
| --- | --- | --- |
| Product Owner (PO), Scrum Master (SM) | Vòng Sau Hậu | Quản lý Product Backlog và thứ tự ưu tiên; tổ chức các buổi họp Scrum; gỡ vướng mắc cho nhóm |
| Development Team | Bùi Đặng Khả Tuân, Dương Danh Toàn, Nguyễn Huỳnh Gia Bảo, Võ Văn Khánh Đăng | Ước lượng, nhận task và hoàn thành Increment mỗi sprint |

Đề tài do nhóm tự chọn nên không có khách hàng bên ngoài. Hậu kiêm PO và SM để cân bằng giữa nhu cầu sản phẩm và khả năng thực hiện của nhóm. Các quyết định về phạm vi và cắt giảm chức năng được thống nhất cùng cả nhóm tại Sprint Planning và Backlog Refinement.

**Sự kiện Scrum**

| Buổi họp | Khi nào | Nội dung |
| --- | --- | --- |
| Backlog Refinement | Trước Sprint Planning; có thể gộp vào họp giữa sprint trước | PO chuẩn bị bản nháp sprint (mục tiêu, backlog dự kiến, câu hỏi về yêu cầu kèm phương án đề xuất); nhóm làm rõ yêu cầu, thống nhất kỹ thuật; PO cập nhật lại backlog |
| Sprint Planning | Đầu sprint | Chọn việc từ Product Backlog đã cập nhật, chia task, phân công trên Jira |
| Họp giữa sprint | Giữa sprint | Kiểm tra tiến độ, gỡ vướng mắc, điều chỉnh task |
| Sprint Review + Retrospective | Cuối sprint | Demo Increment, rút kinh nghiệm cho sprint sau |
| Họp đột xuất | Khi phát sinh task quan trọng | Phân công lại |

**Công cụ:** Jira (backlog, sprint, bảng task, theo dõi lỗi); GitHub và GitHub Actions (quản lý mã nguồn, Pull Request (PR) và tích hợp liên tục (CI)); Google Meet (họp); Postman (kiểm thử API).

**Lịch sprint dự kiến**

| Sprint | Tuần | Thời gian | Mục tiêu | Chức năng | Thành phẩm |
| --- | --- | --- | --- | --- | --- |
| 1 | Tuần 1–2 | 12/10 – 25/10 | Phân tích, thiết kế, chuẩn bị | – | Project Proposal; Product Backlog trên Jira; chốt công nghệ; thiết kế CSDL và API ban đầu; repo và khung dự án |
| 2 | Tuần 3–4 | 26/10 – 08/11 | Đăng nhập; chủ sân tạo sân và bảng giá | 1 | Đăng ký/đăng nhập; quản lý sân, khung giờ, bảng giá |
| 3 | Tuần 5–6 | 09/11 – 22/11 | Tìm và đặt sân; ví và đặt cọc | 2, 3 | Tìm/lọc sân, vị trí sân trên bản đồ, đặt sân, khóa khung giờ; Admin cấp tiền; cọc từ ví |
| 4 | Tuần 7–8 | 23/11 – 06/12 | Hủy và hoàn cọc; ghép đội | 3, 4 | Đủ luồng đặt – hủy – hoàn cọc vào ví; ghép đội |
| 5 | Tuần 9 | 07/12 – 13/12 | Tiện ích, kiểm thử toàn hệ thống, triển khai | 5 (nếu kịp) | Đánh giá sân, dịch vụ đi kèm, dashboard; bản đã triển khai; báo cáo cuối kỳ |

**Thứ tự cắt giảm khi trễ tiến độ:** chức năng 5 → chức năng 4 (làm bản đơn giản).

**Luồng chính** *đăng nhập → tìm sân → đặt sân → cọc từ ví → hủy/hoàn cọc* **không được cắt**.

#### 4.1 Phân tích yêu cầu

| Hoạt động | Thời điểm | Phụ trách | Thành phẩm |
| --- | --- | --- | --- |
| Phân tích đề tài, xác định phạm vi và 5 tính năng | Sprint 1 | Cả nhóm | Project Proposal |
| Viết user story, tiêu chí chấp nhận (Acceptance Criteria), quy định nghiệp vụ | Sprint 1 | Hậu | Product Backlog trên Jira |
| Làm rõ yêu cầu cho sprint kế tiếp | Backlog Refinement mỗi sprint | Cả nhóm | Backlog cập nhật; câu hỏi về yêu cầu đã được chốt |
| Hoàn thiện tài liệu phân tích theo đợt nộp | Theo yêu cầu của giáo viên | Cả nhóm | Tài liệu phân tích yêu cầu |

#### 4.2 Thiết kế phần mềm

| Hoạt động | Thời điểm | Phụ trách | Thành phẩm |
| --- | --- | --- | --- |
| Thiết kế kiến trúc, chốt công nghệ | Sprint 1 | Tuân, Toàn | Sơ đồ kiến trúc; quyết định công nghệ |
| Thiết kế CSDL, gồm ràng buộc về tiền và khung giờ | Sprint 1; bổ sung trong từng sprint | Bảo | Lược đồ CSDL (ERD) |
| Thiết kế API | Sprint 1; bổ sung trong từng sprint | Tuân, Toàn | Tài liệu API |
| Thiết kế giao diện | Sprint 1; chi tiết trong sprint làm chức năng | Đăng | Wireframe, bản thiết kế giao diện |

#### 4.3 Cài đặt (implement) phần mềm

| Hoạt động | Thời điểm | Phụ trách | Thành phẩm |
| --- | --- | --- | --- |
| Lập trình chức năng theo Sprint Backlog | Sprint 2 – Sprint 5 | Tuân, Toàn (Backend); Bảo (CSDL); Đăng (Frontend) | Mã nguồn trên GitHub |
| Review code qua PR | Mỗi task | Ít nhất 1 thành viên khác | PR đã được duyệt |
| Chạy CI | Mỗi PR vào `dev` | GitHub Actions | Kết quả CI trên PR |
| Demo Increment | Cuối mỗi sprint | Cả nhóm | Bản chạy được trên môi trường thử (staging) |

**Quản lý mã nguồn**

| Nhánh | Mục đích | Quy tắc |
| --- | --- | --- |
| `main` | Bản chính thức | Chỉ merge từ `dev` sau Sprint Review |
| `dev` | Bản tích hợp, triển khai lên môi trường thử | Chỉ merge qua PR: ít nhất 1 người review và CI thành công |
| `feature/<mã task>`, `fix/<mã task>` | Làm từng task hoặc sửa lỗi | Tạo từ `dev`, xóa sau khi merge |

**CI**

| Mục | Nội dung |
| --- | --- |
| Công cụ | GitHub Actions, workflow lưu trong repository |
| Kích hoạt | Mỗi PR vào `dev` và mỗi lần `dev` được cập nhật |
| Các bước | Cài đặt dependencies → kiểm tra code → chạy unit test → build |
| Điều kiện merge | CI thành công và có ít nhất 1 người review; thiết lập bằng branch protection |
| Thành phẩm | Workflow GitHub Actions; kết quả CI hiển thị trên từng PR |

#### 4.4 Kiểm thử phần mềm

| Hoạt động | Thời điểm | Phụ trách | Thành phẩm |
| --- | --- | --- | --- |
| Kiểm thử theo task | Trước khi merge vào `dev`: cập nhật `dev` vào nhánh task rồi chạy kiểm thử cơ bản | Hậu | Kết quả kiểm thử theo kịch bản |
| Kiểm thử tích hợp bằng Postman và thao tác trên giao diện | Sau khi merge vào `dev`, trên môi trường thử | Hậu | Lỗi phát sinh, trường hợp nghiệp vụ hoặc điều kiện tiên quyết còn sót được ghi thành Bug |
| Kiểm thử hồi quy | Trước mỗi Sprint Review | Hậu | Kết quả chạy lại Postman Collection |
| Kiểm thử toàn hệ thống | Sprint 5 | Hậu, cả nhóm | Báo cáo kết quả kiểm thử |

- **Môi trường:** kiểm thử theo task trên nhánh task đã cập nhật từ `dev`; kiểm thử tích hợp trên môi trường thử (chạy nhánh `dev`); khi chuyển thành bản chính thức, dữ liệu test (nhất là số dư ví) được xóa và thay bằng dữ liệu demo.
- **Các lớp kiểm thử:**

| Lớp | Cách làm | Người phụ trách |
| --- | --- | --- |
| Unit test | Test tự động cho các hàm tính tiền: tổng tiền, cọc 30%, hoàn cọc 80% / 50% / 0%, số dư ví; chạy qua CI | Tuân, Toàn viết; Hậu rà soát test case, có dùng AI hỗ trợ review |
| Kiểm thử API | Bộ request Postman cho từng chức năng; chạy lại toàn bộ trước mỗi Sprint Review | Hậu (dựa trên tài liệu API do Backend cung cấp) |
| Kiểm thử chức năng | Kịch bản test viết từ user story và quy định QĐ1–QĐ7; thao tác trên giao diện | Hậu |
| Kiểm tra build | Chạy tự động qua CI | Thành viên phụ trách phần tương ứng |

- Lỗi phát hiện được tạo thành task loại **Bug** trên Jira và giao lại cho người làm task đó.
- **Định nghĩa "Xong" (Definition of Done)** – một task chỉ xong khi:
  1. Code đã được đẩy lên GitHub và được ít nhất một thành viên khác review trước khi merge.
  2. Các bước CI bắt buộc và các test tự động liên quan đã chạy thành công.
  3. Chức năng đã được kiểm thử trên môi trường thử, không chỉ trên máy người code.
  4. Các kịch bản kiểm thử chức năng liên quan đã được thực hiện và đạt.
  5. Chức năng đáp ứng tiêu chí chấp nhận và các quy định nghiệp vụ liên quan.
- **Thành phẩm:** bộ Postman Collection; các test tự động; danh sách kịch bản và kết quả kiểm thử; danh sách lỗi trên Jira.

#### 4.5 Triển khai, bảo trì

| Hoạt động | Thời điểm | Phụ trách | Thành phẩm |
| --- | --- | --- | --- |
| Dựng môi trường thử | Sprint 1 | Cả nhóm | Môi trường thử truy cập được qua Internet |
| Cập nhật môi trường thử | Sau mỗi lần merge vào `dev` | Hậu, Tuân, Toàn | Môi trường thử chạy bản mới nhất |
| Chuyển môi trường thử thành bản chính thức | Sprint 5 | Hậu, Tuân, Toàn | Chuyển sang chạy nhánh `main`; xóa dữ liệu test, nạp dữ liệu demo; chạy qua HTTPS; CSDL có bản sao lưu |
| Viết hướng dẫn cài đặt và sử dụng | Sprint 5 | Cả nhóm | Tài liệu hướng dẫn |
| Bảo trì: sửa lỗi phát sinh khi demo và chấm điểm | Sau khi triển khai đến khi kết thúc môn học | Cả nhóm | Bản sửa lỗi trên `main` |


# 5 Kế hoạch nhân sự & chi phí

#### 5.1 Nhân sự

| Thành viên | MSSV | Vai trò | Công việc chính |
| --- | --- | --- | --- |
| Vòng Sau Hậu | 24120307 | PO, SM, Kiểm thử | Quản lý backlog và sprint trên Jira, giao task, tổ chức họp, viết kịch bản test, kiểm thử API và chức năng |
| Bùi Đặng Khả Tuân | 24120236 | Backend | Xây dựng API, nghiệp vụ đặt sân, ví, unit test |
| Dương Danh Toàn | 24120230 | Backend | Xây dựng API, nghiệp vụ đặt sân, ví, unit test |
| Nguyễn Huỳnh Gia Bảo | 24120264 | Cơ sở dữ liệu | Thiết kế và quản lý CSDL, dữ liệu mẫu, truy vấn tìm kiếm sân |
| Võ Văn Khánh Đăng | 24120278 | Frontend | Thiết kế và xây dựng giao diện web cho khách hàng, chủ sân, admin |

**Rủi ro nhân sự và hướng xử lý**

| Rủi ro | Mức độ | Dấu hiệu nhận biết | Phòng ngừa | Xử lý khi xảy ra | Người theo dõi |
| --- | --- | --- | --- | --- | --- |
| Khối lượng Frontend dồn vào 1 người (giao diện cho 3 nhóm người dùng) | Cao | Có hơn 2 subtask Frontend đang làm cùng lúc, hoặc trễ hạn quá 2 ngày | Giao trước một phần Frontend cho thành viên Backend và CSDL ngay từ Sprint Planning | Chuyển subtask Frontend chưa bắt đầu sang thành viên còn trống thời gian | Hậu |
| Việc CSDL nhiều ở đầu dự án, ít dần về sau | TB | Từ Sprint 3, thành viên CSDL có ít thời gian làm việc hơn | Giao thêm dữ liệu mẫu, tối ưu truy vấn, một phần Frontend và hỗ trợ kiểm thử luồng tiền | Kéo việc của tính năng 5 vào sprint và giao cho thành viên CSDL | Hậu |
| Kiểm thử và quản lý dồn vào 1 người | Cao | Có hơn 3 task chờ kiểm thử | Phần lớn kiểm thử chạy tự động bằng unit test và CI; Hậu tập trung rà soát test case và kiểm thử sơ bộ; Bảo hỗ trợ kiểm thử từ Sprint 3 | Chia task kiểm thử còn tồn cho thành viên khác (không kiểm thử task của chính mình) | Hậu |
| Trễ tiến độ do lịch học, thi | Cao | Ở họp giữa sprint, hơn một nửa công việc chưa chuyển sang In Review | Chỉ lên kế hoạch khoảng 70% thời gian rảnh của mỗi thành viên | Cắt giảm theo thứ tự ở mục 4, giữ nguyên luồng chính | Hậu |

#### 5.2 Chi phí dự kiến

Đồ án ưu tiên dùng hạ tầng sẵn có và các dịch vụ miễn phí.

| Khoản mục | Phương án | Chi phí dự kiến |
| --- | --- | --- |
| Nhân công | 5 sinh viên thực hiện trong khuôn khổ môn học | 0đ |
| Quản lý dự án, mã nguồn, họp, kiểm thử | Jira Free, GitHub, Google Meet, Postman | 0đ |
| Máy chủ / hosting | Tận dụng hosting/VPS hiện có của nhóm | 0đ |
| Tên miền và chứng chỉ SSL | Tên miền phụ miễn phí; SSL miễn phí | 0đ |
| Dịch vụ bản đồ | Trong hạn mức miễn phí | 0đ |
| Gửi email (OTP, thông báo) | Dịch vụ email miễn phí | 0đ |
| Dự phòng | Vượt hạn mức gói miễn phí | 200.000đ |
| **Tổng** | | 200.000đ |
