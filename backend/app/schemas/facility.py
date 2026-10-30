from datetime import time
from typing import List, Optional
from pydantic import BaseModel, Field, model_validator
from app.schemas.court import CourtItem


class FacilityCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255, description="Tên cơ sở thể thao")
    address: str = Field(..., min_length=1, max_length=500, description="Địa chỉ chi tiết")
    city: str = Field(..., min_length=1, max_length=100, description="Tỉnh/Thành phố")
    district: Optional[str] = Field(None, max_length=100, description="Quận/Huyện")
    latitude: Optional[float] = Field(None, description="Tọa độ vĩ độ")
    longitude: Optional[float] = Field(None, description="Tọa độ kinh độ")
    open_time: time = Field(..., description="Giờ mở cửa (HH:MM:SS)")
    close_time: time = Field(..., description="Giờ đóng cửa (HH:MM:SS)")
    description: Optional[str] = Field(None, description="Mô tả cơ sở thể thao")

    @model_validator(mode="after")
    def validate_times(self) -> "FacilityCreate":
        if self.open_time >= self.close_time:
            raise ValueError("Giờ mở cửa (open_time) phải trước giờ đóng cửa (close_time).")
        return self


class FacilityItem(BaseModel):
    id: int
    name: str
    owner_id: int
    address: str
    city: str
    district: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    open_time: str
    close_time: str
    is_active: bool
    min_price: Optional[int] = 0
    max_price: Optional[int] = 0
    total_courts: int = 0

    model_config = {"from_attributes": True}


class FacilityDetail(BaseModel):
    id: int
    name: str
    owner_id: int
    address: str
    city: str
    district: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    open_time: str
    close_time: str
    description: Optional[str] = None
    is_active: bool
    courts: List[CourtItem] = []

    model_config = {"from_attributes": True}
