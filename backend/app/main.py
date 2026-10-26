import logging
from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
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
