# Code build trên hosting, không chỉnh sửa nếu không cần.
from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles


def mount_frontend(app: FastAPI, dist: Path) -> None:
    """Phục vụ bản build của frontend (Vite) cùng cổng với API.

    Gọi sau khi đã đăng ký mọi route API, vì route bắt tất cả bên dưới
    chỉ nhận những đường dẫn chưa khớp route nào.
    """
    dist = dist.resolve()
    index = dist / "index.html"
    if not index.is_file():
        raise RuntimeError(f"Không tìm thấy {index}. Hãy build frontend trước.")

    assets = dist / "assets"
    if assets.is_dir():
        app.mount("/assets", StaticFiles(directory=assets), name="assets")

    @app.get("/{path:path}", include_in_schema=False)
    def spa(path: str):
        if path.startswith("api/"):
            return JSONResponse(
                status_code=404,
                content={
                    "success": False,
                    "error": {
                        "code": "RESOURCE_NOT_FOUND",
                        "message": "Không tìm thấy tài nguyên yêu cầu trong hệ thống.",
                        "details": None,
                    },
                },
            )
        file = (dist / path).resolve()
        if path and file.is_file() and dist in file.parents:
            return FileResponse(file)
        # index.html không cache để người dùng nhận bản mới sau mỗi lần deploy
        return FileResponse(index, headers={"Cache-Control": "no-cache"})
