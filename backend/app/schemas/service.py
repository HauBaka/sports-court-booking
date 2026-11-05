from typing import Optional
from pydantic import BaseModel, Field


class ServiceCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255, description="Tên dịch vụ")
    unit_price: int = Field(..., ge=0, description="Đơn giá (VNĐ), không được âm")
    unit: Optional[str] = Field(None, max_length=50, description="Đơn vị tính (chai, bộ/giờ...)")


class ServiceUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255, description="Tên dịch vụ")
    unit_price: Optional[int] = Field(None, ge=0, description="Đơn giá (VNĐ), không được âm")
    unit: Optional[str] = Field(None, max_length=50, description="Đơn vị tính")
    is_active: Optional[bool] = Field(None, description="Bật/tắt kinh doanh dịch vụ")
