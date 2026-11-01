from fastapi import APIRouter
from app.api.v1.endpoints import courts, facilities, health, services

api_router = APIRouter()
api_router.include_router(health.router, tags=["Health"])
api_router.include_router(facilities.router, tags=["Facilities"])
api_router.include_router(courts.router, tags=["Courts"])
api_router.include_router(services.router, tags=["Services"])
