#!/usr/bin/env bash
# Chạy thử toàn bộ kiểm tra của SCB-88: hàm tính hệ số (SCB-89), API bảng giá 2.8 (SCB-90), API ngày lễ 2.9 và 2.10.
# Test chạy trên SQLite in-memory: không cần MariaDB, không đụng dữ liệu thật.
# Dùng (chạy ở thư mục nào cũng được):  bash backend/scripts/check_scb88.sh

set -u
cd "$(dirname "${BASH_SOURCE[0]}")/.." || exit 1  # vào thư mục backend

# shellcheck disable=SC1091
[ -f .venv/bin/activate ] && source .venv/bin/activate

FILES="tests/test_pricing.py tests/test_pricing_rules_api.py tests/test_holidays_api.py"
fail=0

echo "== 1/3 Biên dịch code và test"
python -m compileall -q app tests || fail=1

echo "== 2/3 flake8 (cổng CI: lỗi cú pháp, tên chưa định nghĩa)"
if python -m flake8 --version >/dev/null 2>&1; then
  python -m flake8 app tests --count --select=E9,F63,F7,F82 --show-source --statistics || fail=1
else
  echo "   Bỏ qua vì chưa cài flake8 (cài bằng: pip install flake8)."
fi

echo "== 3/3 pytest: SCB-89 + SCB-90 + ngày lễ"
# shellcheck disable=SC2086
python -m pytest $FILES -v -ra -p no:cacheprovider || fail=1

echo
if [ "$fail" -eq 0 ]; then
  echo "TẤT CẢ ĐẠT: SCB-88 sẵn sàng đẩy lên PR."
else
  echo "CÓ LỖI: đọc các dòng FAILED / ERROR ở trên."
fi
exit "$fail"
