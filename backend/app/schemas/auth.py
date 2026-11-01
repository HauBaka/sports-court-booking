import re
from pydantic import BaseModel, Field, field_validator

# Regex kiểm tra định dạng email tiêu chuẩn
EMAIL_REGEX = re.compile(r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$")


class UserRegisterRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=255, description="Họ và tên người dùng")
    email: str = Field(..., max_length=255, description="Địa chỉ email hợp lệ")
    phone: str = Field(..., description="Số điện thoại gồm 10 chữ số")
    password: str = Field(..., min_length=8, description="Mật khẩu bảo mật tối thiểu 8 ký tự")
    role: str = Field(..., description="Vai trò người dùng: 'customer' hoặc 'owner'")

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        cleaned = v.strip()
        if not cleaned:
            raise ValueError("Họ và tên không được để trống.")
        return cleaned

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str) -> str:
        cleaned = v.strip().lower()
        if not cleaned or not EMAIL_REGEX.match(cleaned):
            raise ValueError("Địa chỉ email không đúng định dạng.")
        return cleaned

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v: str) -> str:
        cleaned = v.strip()
        # Chuẩn hóa: hỗ trợ định dạng số điện thoại Việt Nam (10 chữ số bắt đầu bằng 0 hoặc +84)
        if not re.match(r"^(0|\+84)\d{9}$", cleaned):
            raise ValueError("Số điện thoại không hợp lệ. Số điện thoại phải gồm 10 chữ số.")
        return cleaned

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Mật khẩu phải chứa ít nhất 8 ký tự.")
        if not re.search(r"[A-Z]", v):
            raise ValueError("Mật khẩu phải chứa ít nhất 1 chữ cái in hoa.")
        if not re.search(r"[a-z]", v):
            raise ValueError("Mật khẩu phải chứa ít nhất 1 chữ cái in thường.")
        if not re.search(r"\d", v):
            raise ValueError("Mật khẩu phải chứa ít nhất 1 chữ số.")
        if not re.search(r"[^A-Za-z0-9]", v):
            raise ValueError("Mật khẩu phải chứa ít nhất 1 ký tự đặc biệt.")
        return v

    @field_validator("role")
    @classmethod
    def validate_role(cls, v: str) -> str:
        if not v:
            raise ValueError("Vai trò không được để trống.")
        role_lower = v.strip().lower()
        if role_lower == "admin":
            raise ValueError("Đăng ký với vai trò admin bị từ chối.")
        if role_lower not in ("customer", "owner"):
            raise ValueError("Vai trò không hợp lệ. Chỉ chấp nhận 'customer' hoặc 'owner'.")
        return role_lower


class UserRegisterResponseData(BaseModel):
    id: int = Field(..., description="Mã định danh người dùng")
    name: str = Field(..., description="Họ và tên người dùng")
    email: str = Field(..., description="Địa chỉ email")
    phone: str = Field(..., description="Số điện thoại")
    role: str = Field(..., description="Vai trò người dùng (dạng chữ thường)")
    wallet_id: int = Field(..., description="Mã định danh ví nội bộ")
    balance: int = Field(0, description="Số dư ban đầu của ví (VNĐ)")

    model_config = {"from_attributes": True}
