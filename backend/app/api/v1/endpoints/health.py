from datetime import datetime, timezone
from fastapi import APIRouter, Response, status
from app.core.config import settings
from app.core.database import check_db_connection

router = APIRouter()


@router.get("/health", summary="Health check endpoint")
def health_check(response: Response, strict: bool = False):
    """
    Endpoint kiểm tra trạng thái hoạt động của hệ thống và kết nối CSDL:
    - Trạng thái web API
    - Trạng thái kết nối Database MySQL
    """
    db_result = check_db_connection()
    is_db_connected = db_result["status"] == "connected"

    overall_status = "healthy" if is_db_connected else "degraded"

    if strict and not is_db_connected:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE

    return {
        "status": overall_status,
        "service": settings.PROJECT_NAME,
        "environment": settings.ENVIRONMENT,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "database": db_result,
    }
