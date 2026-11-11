from typing import Any, Generic, List, Optional, TypeVar
from pydantic import BaseModel, Field

T = TypeVar("T")


class PaginationMeta(BaseModel):
    page: int = Field(..., description="Trang hiện tại (1-indexed)")
    limit: int = Field(..., description="Số phần tử trên mỗi trang")
    total: int = Field(..., description="Tổng số phần tử")
    total_pages: int = Field(..., description="Tổng số trang")


class SingleResponse(BaseModel, Generic[T]):
    success: bool = True
    message: str
    data: Optional[T] = None


class PaginatedResponse(BaseModel, Generic[T]):
    success: bool = True
    message: str
    data: List[T]
    meta: PaginationMeta
