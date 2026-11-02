from datetime import time
from typing import Optional
from pydantic import BaseModel, Field, field_validator, model_validator


class CourtCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255, description="Tên sân con")
    sport_id: int = Field(default=1, description="ID môn thể thao")
    court_type: Optional[str] = Field(None, max_length=50, description="Loại sân (tiêu chuẩn...)")
    environment: str = Field(default="INDOOR", description="INDOOR hoặc OUTDOOR")
    open_time: time = Field(..., description="Giờ mở cửa sân (HH:MM:SS)")
    close_time: time = Field(..., description="Giờ đóng cửa sân (HH:MM:SS)")
    default_base_price: int = Field(default=100000, ge=0, description="Giá cơ sở ban đầu (VNĐ)")

    @field_validator("environment")
    @classmethod
    def validate_environment(cls, v: str) -> str:
        upper_v = v.strip().upper()
        if upper_v not in ("INDOOR", "OUTDOOR"):
            raise ValueError("environment phải là 'INDOOR' hoặc 'OUTDOOR'")
        return upper_v

    @model_validator(mode="after")
    def validate_times(self) -> "CourtCreate":
        if self.open_time >= self.close_time:
            raise ValueError("Giờ mở cửa (open_time) phải trước giờ đóng cửa (close_time).")
        return self


class CourtUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255, description="Tên sân con")
    court_type: Optional[str] = Field(None, max_length=50, description="Loại sân")
    environment: Optional[str] = Field(None, description="INDOOR hoặc OUTDOOR")
    open_time: Optional[time] = Field(None, description="Giờ mở cửa sân")
    close_time: Optional[time] = Field(None, description="Giờ đóng cửa sân")
    is_active: Optional[bool] = Field(None, description="Trạng thái hoạt động")

    @field_validator("environment")
    @classmethod
    def validate_environment(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            upper_v = v.strip().upper()
            if upper_v not in ("INDOOR", "OUTDOOR"):
                raise ValueError("environment phải là 'INDOOR' hoặc 'OUTDOOR'")
            return upper_v
        return v

    @model_validator(mode="after")
    def validate_times(self) -> "CourtUpdate":
        if self.open_time is not None and self.close_time is not None:
            if self.open_time >= self.close_time:
                raise ValueError("Giờ mở cửa (open_time) phải trước giờ đóng cửa (close_time).")
        return self


class CourtItem(BaseModel):
    id: int
    facility_id: int
    name: str
    sport_id: int
    court_type: Optional[str] = None
    environment: str
    open_time: str
    close_time: str
    is_active: bool

    model_config = {"from_attributes": True}
