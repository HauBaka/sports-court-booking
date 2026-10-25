#!/usr/bin/env bash
# Code build trên hosting, không chỉnh sửa nếu không cần.
# Chạy trên hosting Pterodactyl sau khi lệnh khởi động đã đồng bộ code từ nhánh dev.
# Thư mục gốc repo chính là /home/container.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

export ENVIRONMENT="${ENVIRONMENT:-production}"
export DEBUG="${DEBUG:-False}"

pip install -U --prefix "$ROOT/.local" -r backend/requirements.txt

# Frontend: lấy bản build mới nhất do GitHub Actions đưa lên Release dev-latest.
# Tải lỗi thì giữ bản cũ để server vẫn lên.
REPO_URL="$(git remote get-url origin)"
REPO_URL="${REPO_URL%.git}"
DIST_ZIP="$(mktemp)"
if curl -fsSL -o "$DIST_ZIP" "$REPO_URL/releases/download/dev-latest/dist.zip"; then
    rm -rf frontend/dist
    python3 -m zipfile -e "$DIST_ZIP" frontend/dist
else
    echo "Cảnh báo: không tải được bản build frontend, dùng bản cũ (nếu có)." >&2
fi
rm -f "$DIST_ZIP"

if [ -f frontend/dist/index.html ]; then
    export FRONTEND_DIST="$ROOT/frontend/dist"
else
    echo "Cảnh báo: chưa có frontend/dist, chỉ chạy API." >&2
fi

cd backend
exec python main.py
