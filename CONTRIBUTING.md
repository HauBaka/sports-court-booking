# CONTRIBUTING

## 1. Chung

- Việc nào cũng có task trên Jira (key `SCB`) trước khi làm.
- Tài liệu, commit, PR viết tiếng Việt. Tên biến, hàm, bảng, cột, endpoint viết tiếng Anh.
- Không commit secret (`.env`, API key). Chỉ commit `.env.example`.
- Vướng thì báo trong nhóm, không đợi họp.

## 2. Cấu trúc repo

Repo dùng chung một nơi, mỗi phần nằm trong thư mục riêng ở thư mục gốc:

```text
sports-court-booking/
├── frontend/      # React: mã nguồn giao diện, .env.example riêng
├── backend/       # FastAPI: mã nguồn API và unit test, .env.example riêng
├── database/      # migration, script dữ liệu mẫu (seed)
├── docs/          # ERD, quy ước API, quyết định công nghệ, hướng dẫn deploy
├── .github/       # workflow GitHub Actions, mẫu PR
├── README.md      # cách cài và chạy dự án ở máy cá nhân
└── CONTRIBUTING.md
```

- Mỗi thư mục tự chạy được độc lập (có file cấu hình và hướng dẫn trong `README.md`), không import chéo mã nguồn giữa `frontend/` và `backend/`. Hai bên chỉ nói chuyện qua REST API.
- Tài liệu thiết kế (ERD, quy ước API, quyết định công nghệ) để trong `docs/`, không để rải rác trong thư mục code, để ai cũng tìm thấy ở một chỗ.
- File cấu hình theo môi trường đọc từ biến môi trường. Mỗi thư mục có `.env.example` liệt kê đủ tên biến, giá trị mẫu không phải giá trị thật.
- Thêm thư mục hoặc đổi cấu trúc ở thư mục gốc thì báo cả nhóm, vì ảnh hưởng đường dẫn trong CI và deploy.

## 3. Branch

| Branch | Mục đích | Quy tắc |
| --- | --- | --- |
| `main` | Bản chính thức, đã qua Sprint Review | Chỉ merge từ `dev`. Không push trực tiếp |
| `dev` | Bản tích hợp, chạy trên môi trường thử | Chỉ merge qua PR, cần 1 review và CI pass. Không push trực tiếp |
| `feature/<key>-<mô tả>` | Làm một chức năng hoặc một task | Tạo từ `dev`, xóa sau khi merge |
| `fix/<key>-<mô tả>` | Sửa một lỗi | Tạo từ `dev`, xóa sau khi merge |

Cách đặt tên branch:

- `<key>` là mã task trên Jira, để từ tên branch tìm được task và ngược lại.
- `<mô tả>` viết thường, không dấu, nối bằng dấu gạch ngang, ngắn gọn (2–5 từ).
- Một branch chỉ làm một task. Việc khác thì tạo branch khác, tránh PR lẫn nhiều thứ.

Ví dụ:

| Branch | Ý nghĩa |
| --- | --- |
| `feature/SCB-60-khung-backend` | Làm khung Backend (task SCB-60) |
| `feature/SCB-62-khung-frontend` | Làm khung Frontend (task SCB-62) |
| `fix/SCB-81-trung-khung-gio` | Sửa lỗi đặt trùng khung giờ (bug SCB-81) |

## 4. Quy trình một task

1. Nhận task trên Jira, chuyển sang In Progress, tạo branch từ `dev` mới nhất.
2. Code, commit nhỏ và thường xuyên.
3. Trước khi mở PR: pull `dev` về branch của mình, giải quyết conflict, chạy thử ở máy.
4. Mở PR vào `dev`, nhờ 1 người review, chuyển task sang In Review.
5. Review xong và CI pass thì squash merge, xóa branch, chuyển task sang Done.

## 5. Commit

Định dạng: `<loại>(<phạm vi>): <mô tả> [<key>]`

| Thành phần | Giá trị |
| --- | --- |
| Loại | `feat` (thêm chức năng), `fix` (sửa lỗi), `docs` (tài liệu), `refactor` (đổi cấu trúc, không đổi hành vi), `test` (thêm hoặc sửa test), `chore` (cấu hình, CI, thư viện) |
| Phạm vi | `fe`, `be`, `db`, `ci`, `docs` |
| Mô tả | Một câu ngắn, bắt đầu bằng động từ, nói rõ đã làm gì |
| Key | Mã task Jira |

Ví dụ:

| Commit | Ý nghĩa |
| --- | --- |
| `feat(be): thêm API đăng nhập [SCB-70]` | Thêm chức năng ở Backend |
| `fix(fe): sửa lỗi không hiện tiền cọc ở trang đặt sân [SCB-81]` | Sửa lỗi ở Frontend |
| `feat(db): thêm bảng giao dịch ví [SCB-61]` | Thêm migration |
| `docs(docs): cập nhật ERD sau khi review [SCB-50]` | Sửa tài liệu |
| `chore(ci): thêm bước chạy unit test vào workflow [SCB-14]` | Sửa cấu hình CI |

## 6. Pull Request

Quy tắc:

- Một PR cho một task.
- Tiêu đề viết đúng định dạng commit: `<loại>(<phạm vi>): <mô tả> [<key>]`. Mô tả chi tiết đã có trong task Jira nên phần mô tả PR không bắt buộc. Chỉ ghi thêm khi có điều cần lưu ý (ví dụ ảnh chụp khi đổi giao diện).
- PR nhỏ, tập trung. Nếu PR quá lớn thì tách thành nhiều PR.
- Review trong khoảng 1 ngày làm việc. Quá hạn thì nhắc trong nhóm.
- PR đổi schema CSDL nên có Bảo xem. PR đổi API nên có phía FE/BE còn lại xem.
- Merge khi có 1 approve và CI pass. Người mở PR tự merge sau khi đủ điều kiện.

Ví dụ tiêu đề PR:

| Tiêu đề | Ý nghĩa |
| --- | --- |
| `feat(be): thêm API đăng nhập [SCB-70]` | PR thêm chức năng ở Backend |
| `fix(fe): sửa lỗi không hiện tiền cọc ở trang đặt sân [SCB-81]` | PR sửa lỗi ở Frontend |
| `feat(db): thêm bảng giao dịch ví [SCB-61]` | PR thêm migration |

