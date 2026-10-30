from typing import Any, Optional
from fastapi import HTTPException


class BusinessException(HTTPException):
    """
    Ngoại lệ nghiệp vụ có cấu trúc mã lỗi chuẩn theo docs/api-conventions.md.
    """

    def __init__(
        self,
        status_code: int,
        code: str,
        message: str,
        details: Optional[Any] = None,
        headers: Optional[dict] = None,
    ):
        super().__init__(
            status_code=status_code,
            detail={"code": code, "message": message, "details": details},
            headers=headers,
        )
        self.code = code
        self.message = message
        self.details = details
