# Kịch bản kiểm thử

Tài liệu liệt kê các tình huống cần kiểm thử của phần xác thực và phân quyền (mục 4), quản lý sân và bảng giá (mục 5) và phần tiền: tính giá, giữ chỗ, đặt cọc, đặt trùng, hủy và hoàn cọc, kết toán, ví. Mỗi kịch bản nêu tình huống và kết quả đúng, chưa đi vào từng bước hay dữ liệu cụ thể. Khi API hoàn thành, mỗi mã kịch bản được triển khai thành test case (unit test, test CSDL hoặc request Postman) mang cùng mã.

Quy định QĐ1 đến QĐ7 xem ở `docs/project-proposal.md`. Công thức tiền và luồng xử lý xem ở `docs/database-entities.md`.

## 1. Mẫu kịch bản

| Mã | Story | QĐ | Điều kiện trước | Các bước | Kết quả mong đợi | Kết quả thực tế |
| --- | --- | --- | --- | --- | --- | --- |
| `<NHÓM>-<số>` | Tên story | QĐ liên quan | Dữ liệu và trạng thái cần có | 1. Bước một<br>2. Bước hai | Kết quả cụ thể: số tiền, trạng thái, mã lỗi | Điền khi chạy test |

Nhóm: `AUTH` xác thực và phân quyền, `SAN` quản lý sân và bảng giá, `GIA` tính giá, `DAT` tạo đơn và giữ chỗ, `COC` đặt cọc, `TRUNG` đặt trùng, `HUY` hủy và hoàn cọc, `KT` kết toán, `VI` ví.

## 2. Kịch bản mẫu có số tiền

Dữ liệu dùng chung: sân giá cơ sở 100.000đ/giờ, giờ cao điểm 17:00 đến 21:00 hệ số 1.30, cọc 30% tổng tiền. Khách A có ví 500.000đ, Khách B có ví 200.000đ. Đơn mẫu: Khách A đặt sân khung 18:00 đến 19:00 ngày thường, tiền sân 130.000đ, cọc 39.000đ. "T−30h" là thời điểm còn 30 giờ đến giờ chơi.

| Mã | Story | QĐ | Điều kiện trước | Các bước | Kết quả mong đợi | Kết quả thực tế |
| --- | --- | --- | --- | --- | --- | --- |
| GIA-02 | Tính tiền đặt sân | QĐ1, QĐ2 | Sân giá 100.000đ/giờ, cao điểm hệ số 1.30 | Xem trước giá khung 18:00 đến 19:00 ngày thường | Hệ số 1.30<br>Tiền sân 130.000đ, cọc 39.000đ, còn lại 91.000đ | |
| COC-01 | Đặt cọc | QĐ4, QĐ6 | Đơn mẫu đang chờ đặt cọc, còn hạn giữ chỗ | Khách A thanh toán cọc | Đơn chuyển "Đã đặt cọc"<br>Ví A 500.000đ còn 461.000đ<br>Ví hệ thống nhận 39.000đ, có 1 giao dịch cọc | |
| HUY-01 | Hủy và hoàn cọc | QĐ5 | Đơn mẫu đã đặt cọc | Khách A hủy ở T−30h | Hoàn 80%: 31.200đ vào ví A<br>Chủ sân nhận 7.800đ<br>Đơn "Đã hủy", khung giờ được nhả | |
| HUY-02 | Hủy và hoàn cọc | QĐ5 | Đơn mẫu đã đặt cọc | Khách A hủy ở T−18h | Hoàn 50%: 19.500đ vào ví A<br>Chủ sân nhận 19.500đ | |
| HUY-03 | Hủy và hoàn cọc | QĐ5 | Đơn mẫu đã đặt cọc | Khách A hủy ở T−6h | Không hoàn<br>Chủ sân nhận toàn bộ 39.000đ | |
| TRUNG-01 | Chống đặt trùng | QĐ3 | Khách A đã đặt cọc đơn mẫu | Khách B đặt cùng sân, ngày, khung 18:00 đến 19:00 | Bị từ chối `SLOT_ALREADY_BOOKED` (409)<br>Không tạo đơn cho B, ví B vẫn 200.000đ | |

## 3. Danh sách tình huống cần kiểm thử

Cột "Cấp" là nơi nên kiểm: Unit (hàm tính, không cần CSDL), DB (ràng buộc CSDL, cần MySQL), API (luồng qua API, cần API và MySQL).

### Tính giá

| Mã | Tình huống | Kết quả đúng | QĐ | Cấp |
| --- | --- | --- | --- | --- |
| GIA-01 | Giờ thường | Dùng giá cơ sở của sân, hệ số 1.00 | QĐ1 | Unit |
| GIA-02 | Giờ cao điểm | Nhân hệ số cao điểm (xem mục 2) | QĐ1 | Unit |
| GIA-03 | Cuối tuần, ngày lễ | Nhân hệ số của quy tắc tương ứng | QĐ1 | Unit |
| GIA-04 | Khung giờ thuộc nhiều quy tắc | Lấy hệ số cao nhất, không cộng dồn | QĐ1 | Unit |
| GIA-05 | Đơn nhiều khung giờ | Hệ số tính riêng từng khung, tổng tiền bằng tổng các khung | QĐ1, QĐ2 | Unit |
| GIA-06 | Khung giờ sát ranh giới cao điểm | Khung bắt đầu đúng giờ mở cao điểm tính cao điểm, khung bắt đầu đúng giờ kết thúc thì không | QĐ1 | Unit |
| GIA-07 | Hệ số ở biên cho phép và ngoài biên | Biên dưới, biên trên được chấp nhận. Ngoài biên bị từ chối | QĐ1 | DB |
| GIA-08 | Quy tắc giá sai dạng (cuối tuần có giờ, ngày lễ thiếu ngày) | Bị từ chối, không lưu | QĐ1 | DB |
| GIA-09 | Đổi bảng giá sau khi đã có đơn | Đơn cũ giữ nguyên giá đã chụp, chỉ đơn mới theo giá mới | QĐ1, QĐ2 | API |
| GIA-10 | Client tự gửi số tiền lên | Server bỏ qua, tự tính lại | QĐ2 | API |

### Tạo đơn và giữ chỗ

| Mã | Tình huống | Kết quả đúng | QĐ | Cấp |
| --- | --- | --- | --- | --- |
| DAT-01 | Tạo đơn hợp lệ | Trạng thái "Chờ đặt cọc", giữ khung giờ, chưa trừ tiền ví | QĐ3, QĐ7 | API |
| DAT-02 | Quá hạn giữ chỗ mà chưa cọc | Đơn tự hủy, khung giờ trống lại, không có giao dịch ví | QĐ3, QĐ7 | API |
| DAT-03 | Giờ chơi sát hơn thời hạn giữ chỗ | Hạn giữ chỗ không vượt quá giờ chơi | QĐ3 | Unit |
| DAT-04 | Đặt khung giờ đã qua hoặc đang diễn ra | Bị từ chối | QĐ3 | API |
| DAT-05 | Đặt ngoài giờ hoạt động của sân, hoặc sân tạm dừng | Bị từ chối | QĐ3 | DB |
| DAT-06 | Chưa đăng nhập | Bị từ chối 401 | QĐ7 | API |

### Đặt cọc

| Mã | Tình huống | Kết quả đúng | QĐ | Cấp |
| --- | --- | --- | --- | --- |
| COC-01 | Cọc đơn hợp lệ | Trừ ví khách, cộng ví hệ thống, đơn "Đã đặt cọc" (xem mục 2) | QĐ4, QĐ6 | API |
| COC-02 | Số dư đúng bằng tiền cọc | Thành công, ví về 0 | QĐ6 | API |
| COC-03 | Số dư thiếu dù chỉ 1đ | Bị từ chối `WALLET_INSUFFICIENT_BALANCE`, ví và đơn giữ nguyên | QĐ4, QĐ6 | DB |
| COC-04 | Cọc đơn đã quá hạn giữ chỗ | Bị từ chối, không trừ tiền | QĐ7 | API |
| COC-05 | Gửi trùng hoặc đồng thời yêu cầu cọc cùng đơn | Chỉ trừ tiền một lần, một giao dịch cọc | QĐ6 | API |
| COC-06 | Hai đơn cọc đồng thời, tổng vượt số dư | Một đơn thành công, một đơn bị từ chối, ví không âm | QĐ6 | DB |
| COC-07 | Cọc đơn của người khác | Bị từ chối 403 | QĐ7 | API |
| COC-08 | Cọc đơn đã hủy hoặc đã hoàn tất | Bị từ chối, không trừ tiền | QĐ7 | API |

### Đặt trùng khung giờ

| Mã | Tình huống | Kết quả đúng | QĐ | Cấp |
| --- | --- | --- | --- | --- |
| TRUNG-01 | Đặt khung giờ đã được cọc | Bị từ chối 409 (xem mục 2) | QĐ3 | DB |
| TRUNG-02 | Đặt khung giờ người khác đang giữ chỗ còn hạn | Bị từ chối 409 | QĐ3 | DB |
| TRUNG-03 | Đơn nhiều khung giờ, một khung bị trùng | Cả đơn bị từ chối, không giữ khung nào | QĐ3 | API |
| TRUNG-04 | Khung liền kề, khác sân, khác ngày | Không coi là trùng, đặt được | QĐ3 | DB |
| TRUNG-05 | Hai người đặt cùng khung cùng lúc | Chỉ một người thành công | QĐ3 | DB |
| TRUNG-06 | Đặt lại khung giờ vừa được hủy | Đặt được | QĐ3, QĐ5 | API |

### Hủy và hoàn cọc

| Mã | Tình huống | Kết quả đúng | QĐ | Cấp |
| --- | --- | --- | --- | --- |
| HUY-01 | Hủy từ 24 giờ trở lên | Hoàn 80% cọc, phần còn lại cho chủ sân (xem mục 2) | QĐ5 | Unit, API |
| HUY-02 | Hủy từ 12 đến dưới 24 giờ | Hoàn 50% cọc (xem mục 2) | QĐ5 | Unit, API |
| HUY-03 | Hủy dưới 12 giờ | Không hoàn, chủ sân nhận toàn bộ cọc (xem mục 2) | QĐ5 | Unit, API |
| HUY-04 | Hủy đúng mốc 24 giờ hoặc 12 giờ | Tính theo mức cao hơn của mốc đó | QĐ5 | Unit |
| HUY-05 | Hủy ngay dưới mốc 24 giờ hoặc 12 giờ | Tính theo mức thấp hơn | QĐ5 | Unit |
| HUY-06 | Hủy đơn chưa cọc | Đơn hủy, nhả khung giờ, không có giao dịch ví | QĐ5, QĐ7 | API |
| HUY-07 | Hủy từ giờ bắt đầu trở đi | Bị từ chối, đơn giữ nguyên | QĐ7 | API |
| HUY-08 | Hủy hai lần hoặc đồng thời | Chỉ hoàn một lần | QĐ6 | API |
| HUY-09 | Hủy đơn của người khác | Bị từ chối 403 | QĐ7 | API |
| HUY-10 | Hủy đơn đã hoàn tất | Bị từ chối | QĐ7 | API |
| HUY-11 | Số tiền xem trước hoàn so với số hoàn thực tế | Bằng nhau | QĐ5 | API |
| HUY-12 | Đơn nhiều khung giờ | Hoàn tính trên tổng tiền cọc của đơn | QĐ5 | Unit |
| HUY-13 | Số tiền hoàn có phần lẻ | Hoàn cộng phần chuyển cho chủ sân luôn bằng đúng tiền cọc | QĐ5, QĐ6 | Unit |

### Kết toán cho chủ sân

| Mã | Tình huống | Kết quả đúng | QĐ | Cấp |
| --- | --- | --- | --- | --- |
| KT-01 | Xác nhận hoàn tất sau giờ chơi | Cọc chuyển từ ví hệ thống sang ví chủ sân, đơn "Đã thanh toán hoàn tất" | QĐ6, QĐ7 | API |
| KT-02 | Xác nhận trước giờ chơi | Bị từ chối | QĐ7 | API |
| KT-03 | Đơn chưa cọc hoặc đã hủy | Không kết toán được | QĐ7 | DB |
| KT-04 | Xác nhận hai lần hoặc đồng thời | Chỉ chuyển tiền một lần | QĐ6 | API |
| KT-05 | Người không phải chủ sân của cơ sở xác nhận | Bị từ chối 403 | QĐ7 | API |

### Ví

| Mã | Tình huống | Kết quả đúng | QĐ | Cấp |
| --- | --- | --- | --- | --- |
| VI-01 | Admin cấp tiền | Số dư tăng, có giao dịch ghi người cấp | QĐ6 | API |
| VI-02 | Số tiền cấp bằng 0, âm hoặc có phần lẻ | Bị từ chối | QĐ6 | DB |
| VI-03 | Người không phải Admin cấp tiền | Bị từ chối 403 | QĐ6 | API |
| VI-04 | Xem lịch sử giao dịch | Đủ giao dịch, đúng loại, chỉ thấy ví của mình | QĐ6 | API |
| VI-05 | Sau cọc, hủy, kết toán | Tổng số dư các ví không đổi, số dư mỗi ví khớp tổng giao dịch của ví đó | QĐ6 | DB |

## 4. Kịch bản xác thực và phân quyền - Epic 1 (SCB-67)

Endpoint xem ở `docs/api-endpoints.md` mục 1.1 đến 1.6 và 2.3. Từ Sprint 3 đăng ký phải có OTP: gọi `POST /auth/otp` (mục 1.5) trước rồi gửi `otp_code` khi `POST /auth/register` (mục 1.1). Ở máy cá nhân và CI (`EMAIL_BACKEND=console`, không phải production) mã OTP luôn là `123456`. Dữ liệu dùng chung lấy từ seed `database/seeds/S2__seed_e2.sql`, tài khoản và mật khẩu xem ở `database/README.md`. Dùng Khách A (`customer.a@scb.vn`, số điện thoại `0900000004`, mật khẩu `TestPass123@`). Test chạy trên CSDL test đã nạp seed. Người đăng ký mới trong AUTH-01 dùng email `new.user@scb.vn` và số điện thoại `0900000010`, không có trong seed.

| Mã | Story | QĐ | Điều kiện trước | Các bước | Kết quả mong đợi |
| --- | --- | --- | --- | --- | --- |
| AUTH-01 | Đăng ký tài khoản | QĐ6 | Seed đã nạp, chưa có `new.user@scb.vn` | 1. `POST /auth/otp` (gửi OTP) với email `new.user@scb.vn`, `purpose` = `REGISTER`<br>2. `POST /auth/register` với email `new.user@scb.vn`, phone `0900000010`, role `customer`, `otp_code` = `123456`<br>3. Đăng nhập rồi `GET /auth/me` | Bước 1: 200<br>Bước 2: 201, `role` = `customer`, có `wallet_id`, `balance` = 0<br>Bước 3: `wallet.balance` = 0đ, không có giao dịch ví<br>Phản hồi không chứa mật khẩu |
| AUTH-02 | Đăng ký trùng email | | Seed đã nạp | `POST /auth/otp` với email `customer.a@scb.vn`, `purpose` = `REGISTER` | 409 `AUTH_EMAIL_EXISTS`<br>Không gửi OTP, không tạo user, không tạo ví |
| AUTH-03 | Đăng ký trùng số điện thoại | | Seed đã nạp | 1. `POST /auth/otp` với email `new.user@scb.vn`, `purpose` = `REGISTER`<br>2. `POST /auth/register` với email `new.user@scb.vn`, phone `0900000004`, `otp_code` = `123456` | Bước 2: 409 `AUTH_PHONE_EXISTS`<br>Không tạo user, không tạo ví |
| AUTH-04 | Đăng nhập sai mật khẩu | | Seed đã nạp | `POST /auth/login` với email `customer.a@scb.vn`, mật khẩu `SaiMatKhau123@` | 401 `AUTH_INVALID_CREDENTIALS`<br>Không có `access_token` |
| AUTH-05 | Gọi API cần đăng nhập khi thiếu token | QĐ7 | Không gửi header `Authorization` | `GET /auth/me` | 401 `AUTH_UNAUTHORIZED` |
| AUTH-06 | Khách gọi API của chủ sân | QĐ7 | Khách A đã đăng nhập, có `access_token` | `POST /facilities` với token của Khách A, body hợp lệ | 403 `AUTH_FORBIDDEN`<br>Không tạo cơ sở |

### 4.1. OTP và đặt lại mật khẩu (SCB-175)

Endpoint: `POST /auth/otp` gửi mã OTP 6 số qua email (mục 1.5), `POST /auth/register` đăng ký kèm `otp_code` (mục 1.1), `POST /auth/password/reset` đặt lại mật khẩu bằng OTP (mục 1.6). Luật: mã có hạn 5 phút, chỉ dùng một lần, gửi lại sau 60 giây, sai 5 lần thì mã bị hủy. HTTP status của các mã `AUTH_OTP_*` xem ở `docs/api-conventions.md`.

Dữ liệu lấy từ seed E3 (`database/seeds/S3__seed_e3.sql`), mọi dòng OTP trong seed đều có mã `123456`. Ca nào cần OTP mới thì tự gọi `POST /auth/otp` với email riêng của ca đó (`otp.wrong@`, `otp.attempts@`, `otp.resend@`), mã cũng là `123456`. OTP trong seed:

| Email | `purpose` | Trạng thái OTP trong seed |
| --- | --- | --- |
| `newuser@scb.vn` | `REGISTER` | Còn hạn, `attempts` = 0, chưa dùng. Chỉ AUTH-07 dùng |
| `late@scb.vn` | `REGISTER` | Hết hạn 1 phút trước |
| `locked@scb.vn` | `REGISTER` | Còn hạn, `attempts` = 5 |
| `done@scb.vn` | `REGISTER` | Còn hạn, đã dùng (`consumed_at` có giá trị) |
| `customer.a@scb.vn` | `RESET_PASSWORD` | Còn hạn, chưa dùng. Tài khoản có thật, mật khẩu `TestPass123@` |

| Mã | Story | QĐ | Điều kiện trước | Các bước | Kết quả mong đợi |
| --- | --- | --- | --- | --- | --- |
| AUTH-07 | Đăng ký đúng OTP | QĐ6 | Seed E3 đã nạp, chưa có user `newuser@scb.vn` | `POST /auth/register` với email `newuser@scb.vn`, phone `0900000021`, role `customer`, `otp_code` = `123456` | 201, có `wallet_id`, `balance` = 0<br>OTP chuyển sang đã dùng |
| AUTH-08 | Sai OTP | | Chưa có user `otp.wrong@scb.vn` | 1. `POST /auth/otp` với email `otp.wrong@scb.vn`, `purpose` = `REGISTER`<br>2. `POST /auth/register` với email `otp.wrong@scb.vn`, `otp_code` = `000000` | Bước 2: `AUTH_OTP_INVALID`<br>Không tạo user, `attempts` của OTP tăng lên 1 |
| AUTH-09 | OTP hết hạn | | Seed E3 đã nạp | `POST /auth/register` với email `late@scb.vn`, `otp_code` = `123456` | `AUTH_OTP_EXPIRED`<br>Không tạo user |
| AUTH-10 | Sai 5 lần | | Chưa có user `otp.attempts@scb.vn` | 1. `POST /auth/otp` với email `otp.attempts@scb.vn`, `purpose` = `REGISTER`<br>2. `POST /auth/register` với `otp_code` = `000000`, lặp 4 lần<br>3. Gửi sai lần thứ 5<br>4. Gửi đúng `123456`<br>5. `POST /auth/register` với email `locked@scb.vn` (seed, đã sai 5 lần), `otp_code` = `123456` | Bước 2: cả 4 lần trả `AUTH_OTP_INVALID`<br>Bước 3: `AUTH_OTP_TOO_MANY_ATTEMPTS`<br>Bước 4, 5: bị từ chối, không tạo user |
| AUTH-11 | OTP đã dùng | | Seed E3 đã nạp | `POST /auth/register` với email `done@scb.vn`, `otp_code` = `123456` | Bị từ chối, không tạo user |
| AUTH-12 | Gửi lại OTP trong 60 giây | | Chưa có OTP nào của `otp.resend@scb.vn` | 1. `POST /auth/otp` với email `otp.resend@scb.vn`, `purpose` = `REGISTER`<br>2. Gọi lại ngay | Bước 1: 200<br>Bước 2: `AUTH_OTP_TOO_SOON`, không gửi mail mới |
| AUTH-13 | Đặt lại mật khẩu | | Seed E3 đã nạp | 1. `POST /auth/password/reset` với email `customer.a@scb.vn`, `otp_code` = `123456`, `new_password` = `MatKhauMoi123@`<br>2. Đăng nhập bằng mật khẩu cũ `TestPass123@`<br>3. Đăng nhập bằng `MatKhauMoi123@` | Bước 1: 200<br>Bước 2: 401 `AUTH_INVALID_CREDENTIALS`<br>Bước 3: 200, có `access_token` |
| AUTH-14 | Quên mật khẩu với email không tồn tại | | Không có user `khong.co@scb.vn` | `POST /auth/otp` với email `khong.co@scb.vn`, `purpose` = `RESET_PASSWORD` | 200, cùng câu thông báo như email có thật<br>Không tạo OTP, không gửi mail |

AUTH-13 đổi mật khẩu của Khách A: chạy sau cùng hoặc nạp lại seed trước khi chạy kịch bản khác.

## 5. Kịch bản quản lý sân và bảng giá - Epic 2 (SCB-2)

Endpoint xem ở `docs/api-endpoints.md` mục 2.7, 2.8. Dữ liệu dùng chung lấy từ seed `database/seeds/S2__seed_e2.sql`: cơ sở 1 của `owner1@scb.vn` (Chủ sân A), sân 1 và sân 2 giá cơ sở 100.000đ/giờ, giờ mở 06:00 đến 23:00. Bảng giá seed của cơ sở 1 có 3 quy tắc: cao điểm 17:00 đến 21:00 hệ số 1,30, thứ Bảy hệ số 1,40, Chủ nhật hệ số 1,40. Các kịch bản giá chỉ kiểm hệ số và việc lưu quy tắc, tính tiền đặt sân thuộc Sprint 3.

| Mã | Story | QĐ | Điều kiện trước | Các bước | Kết quả mong đợi |
| --- | --- | --- | --- | --- | --- |
| SAN-01 | Hệ số giờ cao điểm | QĐ1 | Seed đã nạp. Ngày chơi là thứ Ba, không phải ngày lễ | Lấy hệ số của sân 1 khung 18:00 đến 19:00 | Hệ số 1,30<br>Giá khung 100.000 × 1,30 = 130.000đ |
| SAN-02 | Nhiều quy tắc cùng khớp | QĐ1 | Seed đã nạp. Ngày chơi là thứ Bảy, không phải ngày lễ | Lấy hệ số của sân 1 khung 18:00 đến 19:00 | Khớp cao điểm 1,30 và cuối tuần 1,40, lấy hệ số lớn nhất 1,40, không cộng dồn<br>Giá khung 100.000 × 1,40 = 140.000đ |
| SAN-03 | Ngoài mọi quy tắc | QĐ1 | Seed đã nạp. Ngày chơi là thứ Ba, không phải ngày lễ | Lấy hệ số của sân 1 khung 10:00 đến 11:00 | Hệ số 1,00<br>Giá khung 100.000đ |
| SAN-04 | Hệ số dưới biên | QĐ1 | Chủ sân A đã đăng nhập | `POST /facilities/1/pricing-rules` với một quy tắc `PEAK_HOUR` hệ số 1,10 | 422 `VALIDATION_ERROR`<br>Không lưu, bảng giá cơ sở 1 vẫn 3 quy tắc như seed |
| SAN-05 | Hệ số trên biên | QĐ1 | Chủ sân A đã đăng nhập | `POST /facilities/1/pricing-rules` với một quy tắc `PEAK_HOUR` hệ số 1,60 | 422 `VALIDATION_ERROR`<br>Không lưu, bảng giá cơ sở 1 vẫn 3 quy tắc như seed |
| SAN-06 | Sửa sân của chủ khác | QĐ7 | Chủ sân B đã đăng ký (role `owner`), chưa có cơ sở nào, đã đăng nhập | `PATCH /courts/1` với token của Chủ sân B, đổi `name` | 403 `AUTH_FORBIDDEN`<br>Tên sân 1 không đổi |
| SAN-07 | Đổi giờ khi còn lịch cọc | QĐ3, QĐ7 | Có đơn "Đã đặt cọc" của sân 1 ngày mai, khung 22:00 đến 23:00. Chủ sân A đã đăng nhập | `PATCH /courts/1` đổi `close_time` thành `22:00:00` | 400 `CANNOT_UPDATE_COURT_SCHEDULE_ACTIVE_BOOKINGS`<br>`close_time` sân 1 vẫn 23:00, `court_slots` không đổi |
| SAN-08 | Đổi giờ khi không có lịch | QĐ3 | Sân 2 không có đơn đặt cọc nào. Chủ sân A đã đăng nhập | `PATCH /courts/2` đổi `close_time` thành `22:00:00` | 200<br>`close_time` sân 2 là 22:00<br>`court_slots` khung 22:00 đến 23:00 của sân 2 chuyển `is_active = false`, các khung từ 06:00 đến 22:00 vẫn `true` |

## 6. Kịch bản đặt sân, đặt cọc và ví - Epic 3, Epic 5 (SCB-176)

Mục 3 chỉ nêu tình huống. Mục này chọn các ca chạy qua API và ghi đủ dữ liệu, các bước, số tiền.

Endpoint:

| Mục | Endpoint | Việc |
| --- | --- | --- |
| 2.8 | `POST /facilities/{id}/pricing-rules` | Chủ sân thay bảng giá của cơ sở |
| 3.1 | `GET /courts/{id}/slots?date=` | Xem lưới khung giờ trống của sân |
| 3.3 | `POST /bookings` | Tạo đơn, giữ chỗ 10 phút, chưa trừ ví |
| 3.4 | `POST /bookings/{id}/deposit` | Đặt cọc 30% từ ví |
| 3.7 | `POST /admin/bookings/expire-holds` | Admin nhả các đơn giữ chỗ đã hết hạn |
| 5.1 | `GET /wallets/me` | Xem số dư ví |
| 5.2 | `GET /wallets/me/transactions` | Xem lịch sử giao dịch ví |
| 5.3 | `POST /admin/wallet-topups` | Admin cấp tiền vào ví |
| 5.4 | `GET /admin/users?search=` | Admin tìm người dùng |

Dữ liệu chung, lấy từ seed S2 và S3 (`database/README.md` mục 3). Mật khẩu mọi tài khoản là `TestPass123@`.

| Dữ liệu | Giá trị |
| --- | --- |
| Tài khoản | Admin `admin@scb.vn` (id 2). Chủ sân cơ sở 1 `owner1@scb.vn`. Khách A `customer.a@scb.vn` (id 5), ví 500.000đ. Khách B `customer.b@scb.vn` (id 6), ví 200.000đ. Ví hệ thống 100.000đ |
| Sân | Sân 1 và sân 2 thuộc cơ sở 1, giá cơ sở 100.000đ/giờ, mở 06:00 đến 23:00 |
| Bảng giá cơ sở 1 | Cao điểm 17:00 đến 21:00 hệ số 1,30. Thứ Bảy, Chủ nhật hệ số 1,40 |
| Đơn seed | Đơn id 1, `DEPOSITED`, của Khách B, sân 1, ngày mai, 08:00 đến 10:00 |
| Ngày T | Thứ Ba kế tiếp, không phải ngày lễ. Không dùng "ngày mai" cho ca có số tiền vì ngày mai có thể là cuối tuần |
| Khách mới | Tài khoản đăng ký mới trong ca (ví 0đ), Admin cấp tiền bằng 5.3 |

Mỗi ca đặt một khung giờ riêng để các ca không đặt trùng nhau. Chạy lại phải nạp lại seed. Số dư ghi trong bảng là số khi vừa nạp seed. Khi chạy nhiều ca liền nhau, kiểm phần chênh lệch số dư trước và sau ca.

| Mã | Story | QĐ | Điều kiện trước | Các bước | Kết quả mong đợi |
| --- | --- | --- | --- | --- | --- |
| GIA-09 | Đổi bảng giá sau khi có đơn | QĐ1, QĐ2 | Khách A, chủ sân cơ sở 1 đã đăng nhập | 1. Khách A gọi 3.3 đặt sân 1, ngày T, 20:00 đến 21:00<br>2. Chủ sân gọi 2.8 đổi cao điểm thành hệ số 1,50, giữ các quy tắc khác<br>3. Khách A gọi 3.3 đặt sân 2, ngày T, 20:00 đến 21:00<br>4. Chủ sân trả bảng giá về như seed | Bước 1: `total_amount` 130.000đ, cọc 39.000đ<br>Bước 3: `total_amount` 150.000đ, cọc 45.000đ<br>Đơn bước 1 vẫn 130.000đ |
| GIA-10 | Client tự gửi số tiền | QĐ2 | Khách A đã đăng nhập | Gọi 3.3 đặt sân 1, ngày T, 19:00 đến 20:00, body thêm `"total_amount": 1000, "deposit_amount": 300` | Server bỏ qua, `total_amount` 130.000đ, cọc 39.000đ |
| DAT-01 | Tạo đơn hợp lệ | QĐ3, QĐ7 | Khách A đã đăng nhập, ví 500.000đ | 1. Gọi 3.3 đặt sân 1, ngày T, 10:00 đến 11:00<br>2. Gọi 3.1 sân 1 ngày T<br>3. Gọi 5.1, 5.2 | Bước 1: 201, `PENDING_DEPOSIT`, `total_amount` 100.000đ, cọc 30.000đ, `hold_expires_at` khoảng 10 phút sau lúc gọi<br>Bước 2: khung 10:00 là `HOLDING`<br>Bước 3: ví vẫn 500.000đ, không có giao dịch mới |
| DAT-02 | Hết hạn giữ chỗ | QĐ3, QĐ7 | Khách A đã đăng nhập. Chỉ chạy bằng pytest | 1. Gọi 3.3 đặt sân 2, ngày T, 06:00 đến 07:00<br>2. Sửa DB: `hold_expires_at = NOW() - INTERVAL 1 MINUTE`<br>3. Admin gọi 3.7<br>4. Gọi 3.1 sân 2 ngày T | Bước 3: đơn chuyển `CANCELLED`<br>Bước 4: khung 06:00 là `AVAILABLE`<br>Ví A không đổi, không có giao dịch ví |
| DAT-04 | Đặt khung giờ đã qua | QĐ3 | Khách A đã đăng nhập | Gọi 3.3 đặt sân 1, ngày hôm qua, 10:00 đến 11:00 | 400 `INVALID_BOOKING_TIME`. Không tạo đơn |
| DAT-06 | Chưa đăng nhập | QĐ7 | Không gửi `Authorization` | Gọi 3.3 đặt sân 1, ngày T, 11:00 đến 12:00 | 401 `AUTH_UNAUTHORIZED`. Không tạo đơn |
| COC-01 | Cọc đơn hợp lệ | QĐ4, QĐ6 | Khách A ví 500.000đ, ví hệ thống 100.000đ | 1. Khách A gọi 3.3 đặt sân 1, ngày T, 18:00 đến 19:00<br>2. Gọi 3.4 với đơn vừa tạo<br>3. Gọi 5.2 | Bước 1: `total_amount` 130.000đ, cọc 39.000đ<br>Bước 2: `DEPOSITED`, `deposit_amount_paid` 39.000đ, `remaining_amount_due_at_court` 91.000đ, `wallet_balance_remaining` 461.000đ. Ví hệ thống 139.000đ<br>Bước 3: có 1 giao dịch `DEPOSIT` 39.000đ, `balance_after` 461.000đ |
| COC-02 | Số dư đúng bằng tiền cọc | QĐ6 | Khách mới, Admin cấp 39.000đ | 1. Gọi 3.3 đặt sân 2, ngày T, 18:00 đến 19:00<br>2. Gọi 3.4 | Bước 2: `DEPOSITED`, ví còn 0đ |
| COC-03 | Số dư thiếu 1đ | QĐ4, QĐ6 | Khách mới, Admin cấp 38.999đ | 1. Gọi 3.3 đặt sân 2, ngày T, 19:00 đến 20:00<br>2. Gọi 3.4 | Bước 2: 402 `WALLET_INSUFFICIENT_BALANCE`<br>Đơn vẫn `PENDING_DEPOSIT`, ví vẫn 38.999đ, không có giao dịch `DEPOSIT` |
| COC-04 | Cọc đơn đã hết hạn giữ chỗ | QĐ7 | Khách A đã đăng nhập. Chỉ chạy bằng pytest | 1. Gọi 3.3 đặt sân 1, ngày T, 06:00 đến 07:00<br>2. Sửa DB: `hold_expires_at = NOW() - INTERVAL 1 MINUTE`<br>3. Gọi 3.4 | Bước 3: 400 `CANNOT_DEPOSIT_EXPIRED_BOOKING`. Ví A không đổi |
| COC-05 | Gửi cọc hai lần | QĐ6 | Khách A đã đăng nhập | 1. Gọi 3.3 đặt sân 1, ngày T, 07:00 đến 08:00 (100.000đ, cọc 30.000đ)<br>2. Gọi 3.4 hai lần liền | Lần 1: `DEPOSITED`, ví A giảm 30.000đ<br>Lần 2: bị từ chối, ví không giảm thêm<br>Chỉ có 1 giao dịch `DEPOSIT` cho đơn |
| COC-07 | Cọc đơn của người khác | QĐ7 | Khách A, Khách B đã đăng nhập | 1. Khách A gọi 3.3 đặt sân 1, ngày T, 11:00 đến 12:00<br>2. Khách B gọi 3.4 với đơn đó | 403 `AUTH_FORBIDDEN`. Ví B vẫn 200.000đ, đơn vẫn `PENDING_DEPOSIT` |
| COC-08 | Cọc đơn đã hủy | QĐ7 | Đơn `CANCELLED` sau DAT-02 | Khách A gọi 3.4 với đơn đó | 400 `CANNOT_DEPOSIT_EXPIRED_BOOKING`. Ví A không đổi |
| TRUNG-01 | Đặt khung đã được cọc | QĐ3 | Đơn seed id 1 | Khách A gọi 3.3 đặt sân 1, ngày mai, 08:00 đến 09:00 | 409 `SLOT_ALREADY_BOOKED`. Không tạo đơn, ví A vẫn 500.000đ |
| TRUNG-03 | Đơn nhiều khung, một khung trùng | QĐ3 | Đơn seed id 1 | 1. Khách A gọi 3.3 đặt sân 1, ngày mai, 07:00 đến 09:00 (2 khung)<br>2. Gọi 3.1 sân 1 ngày mai | Bước 1: 409 `SLOT_ALREADY_BOOKED`<br>Bước 2: khung 07:00 vẫn `AVAILABLE` |
| TRUNG-04 | Khung liền kề, khác sân | QĐ3 | Đơn seed id 1 | 1. Khách A gọi 3.3 đặt sân 1, ngày mai, 10:00 đến 11:00<br>2. Gọi 3.3 đặt sân 2, ngày mai, 08:00 đến 09:00 | Cả hai: 201 `PENDING_DEPOSIT` |
| VI-01 | Admin cấp tiền | QĐ6 | Admin đã đăng nhập | 1. Gọi 5.3 với `user_id` 6, `amount` 100.000<br>2. Khách B gọi 5.2 | Bước 1: ví B 300.000đ<br>Bước 2: có giao dịch `TOPUP` 100.000đ, `balance_after` 300.000đ, ghi người cấp là Admin |
| VI-02 | Số tiền cấp sai | QĐ6 | Admin đã đăng nhập | Gọi 5.3 với `user_id` 6, `amount` lần lượt 0, -1000, 1000.5 | Cả ba: 422 `VALIDATION_ERROR`. Ví B không đổi |
| VI-03 | Không phải Admin cấp tiền | QĐ6 | Khách A đã đăng nhập | Gọi 5.3 với `user_id` 5, `amount` 100.000 | 403 `AUTH_FORBIDDEN`. Ví A không đổi |
| VI-04 | Xem lịch sử giao dịch | QĐ6 | Khách B đã đăng nhập, seed vừa nạp | Gọi 5.2 | Có `TOPUP` 300.000đ và `DEPOSIT` 100.000đ của đơn 1. Không có giao dịch của ví khác. Lọc `type=DEPOSIT` chỉ còn 1 dòng |
| VI-06 | Admin tìm người dùng | | Admin, Khách A đã đăng nhập | 1. Admin gọi 5.4 với `search=customer.a`<br>2. Khách A gọi 5.4 | Bước 1: 1 kết quả, `id` 5, `balance` 500.000đ<br>Bước 2: 403 `AUTH_FORBIDDEN` |

Khung giờ đã dùng, để thêm ca mới không trùng: sân 1 ngày T dùng 06:00 đến 08:00, 10:00 đến 12:00, 18:00 đến 21:00. Sân 2 ngày T dùng 06:00 đến 07:00, 18:00 đến 21:00. Ngày mai dùng sân 1 từ 07:00 đến 11:00 và sân 2 từ 08:00 đến 09:00.
