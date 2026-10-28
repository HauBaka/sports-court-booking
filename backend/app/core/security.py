from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional
import bcrypt
import jwt
from app.core.config import settings


def create_access_token(
    data: Dict[str, Any],
    expires_delta: Optional[timedelta] = None,
) -> str:
    """
    Tạo JSON Web Token (JWT) sử dụng thuật toán đối xứng HS256.
    
    Thời hạn và khóa bí mật được lấy từ cấu hình biến môi trường (settings).
    """
    to_encode = data.copy()
    now = datetime.now(timezone.utc)

    if expires_delta:
        expire = now + expires_delta
    else:
        expire = now + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)

    to_encode.update({
        "exp": expire,
        "iat": now,
    })

    encoded_jwt = jwt.encode(
        to_encode,
        settings.JWT_SECRET,
        algorithm=settings.JWT_ALGORITHM,
    )
    return encoded_jwt


def verify_token(token: str) -> Dict[str, Any]:
    """
    Kiểm tra và giải mã JWT token với khóa bí mật và thuật toán HS256 từ biến môi trường.
    
    Ném ra:
        - jwt.ExpiredSignatureError: Khi token đã hết hạn.
        - jwt.InvalidSignatureError: Khi token sai chữ ký.
        - jwt.InvalidTokenError: Khi token không hợp lệ hoặc bị giả mạo.
    
    Trả về:
        Dict[str, Any]: Dữ liệu payload của token đã được giải mã.
    """
    return jwt.decode(
        token,
        settings.JWT_SECRET,
        algorithms=[settings.JWT_ALGORITHM],
    )


def hash_password(password: str) -> str:
    """
    Băm mật khẩu thô bằng thuật toán Bcrypt.
    
    Lưu ý bảo mật: Mật khẩu thô không bao giờ được phép lưu trữ hoặc ghi log.
    """
    if not password:
        raise ValueError("Password cannot be empty")

    password_bytes = password.encode("utf-8")
    salt = bcrypt.gensalt(rounds=settings.BCRYPT_ROUNDS)
    hashed = bcrypt.hashpw(password_bytes, salt)
    return hashed.decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    So sánh mật khẩu thô với chuỗi hash Bcrypt đã lưu.
    
    Lưu ý bảo mật: Mật khẩu thô không bao giờ được phép lưu trữ hoặc ghi log.
    """
    if not plain_password or not hashed_password:
        return False

    try:
        return bcrypt.checkpw(
            plain_password.encode("utf-8"),
            hashed_password.encode("utf-8"),
        )
    except (ValueError, TypeError):
        return False

