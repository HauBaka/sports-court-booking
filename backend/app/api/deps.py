from typing import Generator, List, Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
import jwt
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import verify_token
from app.models.user import User

# HTTPBearer với auto_error=False để tự xử lý trả về mã lỗi 401 Unauthorized khi thiếu header
security_bearer = HTTPBearer(auto_error=False)


def get_current_user(
    auth_credentials: Optional[HTTPAuthorizationCredentials] = Depends(security_bearer),
    db: Session = Depends(get_db),
) -> User:
    """
    Dependency lấy thông tin người dùng hiện tại từ JWT token trong header Authorization: Bearer.
    
    Quy tắc nghiệp vụ:
    - Thiếu token: Trả về HTTP 401 Unauthorized.
    - Token hết hạn hoặc sai chữ ký: Trả về HTTP 401 Unauthorized.
    - Không tìm thấy người dùng: Trả về HTTP 401 Unauthorized.
    - Tài khoản bị vô hiệu hóa (is_active = false): Bị từ chối (HTTP 400 Bad Request).
    """
    if not auth_credentials or not auth_credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Yêu cầu đăng nhập. Thiếu header Authorization: Bearer.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if auth_credentials.scheme.lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Phương thức xác thực không hợp lệ. Yêu cầu Bearer token.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = auth_credentials.credentials

    try:
        payload = verify_token(token)
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token đã hết hạn. Vui lòng đăng nhập lại.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except (jwt.InvalidTokenError, Exception):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token không hợp lệ hoặc sai chữ ký.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Lấy định danh user từ payload (hỗ trợ cả sub lẫn user_id)
    user_id = payload.get("sub") or payload.get("user_id")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Payload của token không hợp lệ (thiếu sub/user_id).",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        user_id_int = int(user_id)
    except (ValueError, TypeError):
        user_id_int = user_id

    user = db.query(User).filter(User.id == user_id_int).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Người dùng không tồn tại trong hệ thống.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Kiểm tra trạng thái kích hoạt của tài khoản
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tài khoản đã bị vô hiệu hóa.",
        )

    return user


def require_role(*roles: str):
    """
    Dependency factory kiểm tra vai trò của người dùng hiện tại (RBAC).
    
    Quy tắc:
    - roles: Danh sách vai trò chấp nhận (truyền dạng chữ thường như 'owner', 'admin', 'customer').
    - Khớp không phân biệt hoa thường với bảng roles ('CUSTOMER', 'OWNER', 'ADMIN').
    - Sai vai trò: Trả về HTTP 403 Forbidden.
    """
    normalized_required_roles = [r.strip().lower() for r in roles]

    def role_checker(current_user: User = Depends(get_current_user)) -> User:
        user_roles = [r.name.lower() for r in current_user.roles]
        # Nếu người dùng có ít nhất một vai trò hợp lệ trong danh sách yêu cầu
        has_permission = any(req_role in user_roles for req_role in normalized_required_roles)

        if not has_permission:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Không đủ quyền truy cập. Yêu cầu một trong các vai trò: {', '.join(normalized_required_roles)}.",
            )

        return current_user

    return role_checker

