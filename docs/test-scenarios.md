# Kịch bản kiểm thử phần tiền

Tài liệu liệt kê các tình huống cần kiểm thử của phần tiền: tính giá, giữ chỗ, đặt cọc, đặt trùng, hủy và hoàn cọc, kết toán, ví. Mỗi kịch bản nêu tình huống và kết quả đúng, chưa đi vào từng bước hay dữ liệu cụ thể. Khi API hoàn thành, mỗi mã kịch bản được triển khai thành test case (unit test, test CSDL hoặc request Postman) mang cùng mã.

Quy định QĐ1 đến QĐ7 xem ở `docs/project-proposal.md`. Công thức tiền và luồng xử lý xem ở `docs/database-entities.md`.

## 1. Mẫu kịch bản

| Mã | Story | QĐ | Điều kiện trước | Các bước | Kết quả mong đợi | Kết quả thực tế |
| --- | --- | --- | --- | --- | --- | --- |
| `<NHÓM>-<số>` | Tên story | QĐ liên quan | Dữ liệu và trạng thái cần có | 1. Bước một<br>2. Bước hai | Kết quả cụ thể: số tiền, trạng thái, mã lỗi | Điền khi chạy test |

Nhóm: `GIA` tính giá, `DAT` tạo đơn và giữ chỗ, `COC` đặt cọc, `TRUNG` đặt trùng, `HUY` hủy và hoàn cọc, `KT` kết toán, `VI` ví.

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
