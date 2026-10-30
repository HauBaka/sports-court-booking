import logging
from typing import Any
from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException
from app.core.config import settings
from app.core.database import check_db_connection
from app.api.v1.router import api_router
from app.spa import mount_frontend

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger("sports-court-booking")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifecycle events for FastAPI application."""
    logger.info(f"Starting {settings.PROJECT_NAME} [{settings.ENVIRONMENT}]...")
    db_status = check_db_connection()
    if db_status["status"] == "connected":
        logger.info("Successfully connected to MySQL database!")
    else:
        logger.warning(
            f"Could not connect to MySQL database on startup: {db_status['error']}. "
            "Backend will still run and retry connections on requests."
        )
    yield
    logger.info("Shutting down application...")


app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Adjust in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request, exc: StarletteHTTPException):
    status_code = exc.status_code
    detail: Any = exc.detail
    if isinstance(detail, dict) and "code" in detail:
        code = detail["code"]
        message = detail.get("message", "")
        details = detail.get("details", None)
    else:
        message = str(detail) if detail else "Có lỗi xảy ra."
        details = None
        lower_msg = message.lower()
        if status_code == 401:
            if "hết hạn" in lower_msg or "expired" in lower_msg:
                code = "AUTH_TOKEN_EXPIRED"
            elif "không hợp lệ" in lower_msg or "chữ ký" in lower_msg:
                code = "AUTH_TOKEN_INVALID"
            elif "mật khẩu" in lower_msg or "credentials" in lower_msg:
                code = "AUTH_INVALID_CREDENTIALS"
            else:
                code = "AUTH_UNAUTHORIZED"
        elif status_code == 403:
            code = "AUTH_FORBIDDEN"
        elif status_code == 404:
            if "cơ sở" in lower_msg or "facility" in lower_msg:
                code = "FACILITY_NOT_FOUND"
            elif "sân" in lower_msg or "court" in lower_msg:
                code = "COURT_NOT_FOUND"
            else:
                code = "RESOURCE_NOT_FOUND"
        elif status_code == 409:
            if "email" in lower_msg:
                code = "AUTH_EMAIL_EXISTS"
            elif "phone" in lower_msg or "thoại" in lower_msg:
                code = "AUTH_PHONE_EXISTS"
            else:
                code = "CONFLICT"
        elif status_code == 400:
            code = "INVALID_REQUEST"
        elif status_code == 500:
            code = "INTERNAL_SERVER_ERROR"
        else:
            code = "ERROR"

    return JSONResponse(
        status_code=status_code,
        content={
            "success": False,
            "error": {
                "code": code,
                "message": message,
                "details": details,
            },
            "detail": message,
        },
        headers=getattr(exc, "headers", None),
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request, exc: RequestValidationError):
    details = []
    for err in exc.errors():
        loc = err.get("loc", [])
        field = ".".join(str(l) for l in loc if l not in ("body", "query", "path"))
        details.append({
            "field": field or "body",
            "issue": err.get("msg", "Dữ liệu không hợp lệ"),
        })
    return JSONResponse(
        status_code=422,
        content={
            "success": False,
            "error": {
                "code": "VALIDATION_ERROR",
                "message": "Dữ liệu gửi lên không hợp lệ.",
                "details": details,
            },
            "detail": [{k: v for k, v in err.items() if k != "ctx"} for err in exc.errors()],
        },
    )


# Root endpoint
def root():
    return {
        "message": f"Welcome to {settings.PROJECT_NAME}",
        "docs": "/docs",
        "health": f"{settings.API_V1_STR}/health",
        "version": "1.0.0",
    }


# Include versioned API router
app.include_router(api_router, prefix=settings.API_V1_STR)

# Phải đặt cuối cùng: route bắt tất cả của frontend không được che route API
if settings.FRONTEND_DIST:
    mount_frontend(app, Path(settings.FRONTEND_DIST))
else:
    app.get("/", tags=["Root"])(root)
