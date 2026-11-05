from fastapi import APIRouter
from app.api.v1.endpoints import (
    auth,
    courts,
    facilities,
    health,
    holidays,
    pricing_rules,
    services,
)

api_router = APIRouter()
api_router.include_router(health.router, tags=["Health"])
api_router.include_router(auth.router, prefix="/auth", tags=["Auth"])
api_router.include_router(facilities.router, tags=["Facilities"])
api_router.include_router(courts.router, tags=["Courts"])
api_router.include_router(services.router, tags=["Services"])
api_router.include_router(pricing_rules.router, tags=["Pricing Rules"])
api_router.include_router(holidays.router, tags=["Holidays"])
