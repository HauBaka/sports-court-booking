import logging
from typing import Optional
from fastapi import APIRouter, Depends, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.core.exceptions import BusinessException
from app.core.security import create_access_token, hash_password, verify_password
from app.models.user import Role, User, UserRole
from app.models.wallet import Wallet
from app.schemas.auth import (
    LoginRequest,
    LoginResponseData,
    UserBrief,
    UserProfileResponseData,
    UserRegisterRequest,
    UserRegisterResponseData,
    WalletBrief,
)
from app.schemas.common import SingleResponse

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post(
    "/register",
    status_code=status.HTTP_201_CREATED,
    response_model=SingleResponse[UserRegisterResponseData],
    summary="Đăng ký tài khoản mới",
    description=(
        "Tạo người dùng mới (customer hoặc owner), phân vai trò và khởi tạo ví nội bộ "
        "với số dư 0 trong một transaction."
    ),
)
def register(
    payload: UserRegisterRequest,
    db: Session = Depends(get_db),
):
    """
    Quy trình đăng ký tài khoản mới:
    1. Kiểm tra tính trùng lặp của Email và Số điện thoại (trả về HTTP 409 nếu trùng).
    2. Mã hóa mật khẩu bảo mật bằng thuật toán Bcrypt.
    3. Mở Database Transaction nguyên tử:
       - Tạo bản ghi mới trong bảng 'users'.
       - Gán vai trò chỉ định ('CUSTOMER' hoặc 'OWNER') trong bảng 'user_roles'.
       - Khởi tạo ví nội bộ trong bảng 'wallets' với balance = 0.
       - Commit toàn bộ thay đổi.
    4. Nếu có lỗi ở bất kỳ bước nào (ví dụ lỗi tạo ví), toàn bộ transaction sẽ rollback
       và không để lại bản ghi rác nào trong CSDL.
    """
    # 1. Kiểm tra email đã tồn tại
    existing_email = db.query(User).filter(User.email == payload.email).first()
    if existing_email:
        raise BusinessException(
            status_code=status.HTTP_409_CONFLICT,
            code="AUTH_EMAIL_EXISTS",
            message="Email đã được đăng ký bởi tài khoản khác trong hệ thống.",
        )

    # 2. Kiểm tra số điện thoại đã tồn tại
    existing_phone = db.query(User).filter(User.phone == payload.phone).first()
    if existing_phone:
        raise BusinessException(
            status_code=status.HTTP_409_CONFLICT,
            code="AUTH_PHONE_EXISTS",
            message="Số điện thoại đã được đăng ký trong hệ thống.",
        )

    # 3. Lấy hoặc tạo vai trò tương ứng trong hệ thống
    target_role_name = payload.role.upper()
    role_record = db.query(Role).filter(Role.name == target_role_name).first()
    if not role_record:
        role_description = (
            "Khách hàng đặt sân" if target_role_name == "CUSTOMER" else "Chủ cơ sở thể thao"
        )
        role_record = Role(name=target_role_name, description=role_description)
        db.add(role_record)
        db.flush()

    # 4. Hash mật khẩu bằng Bcrypt
    password_hash = hash_password(payload.password)

    # 5. Thực thi Transaction nguyên tử
    try:
        new_user = User(
            name=payload.name,
            email=payload.email,
            phone=payload.phone,
            password_hash=password_hash,
            is_active=True,
            is_system=False,
        )
        db.add(new_user)
        db.flush()

        user_role = UserRole(user_id=new_user.id, role_id=role_record.id)
        db.add(user_role)
        db.flush()

        wallet = Wallet(user_id=new_user.id, balance=0)
        db.add(wallet)
        db.flush()

        db.commit()
        db.refresh(new_user)
        db.refresh(wallet)
    except IntegrityError as exc:
        db.rollback()
        err_msg = str(exc.orig) if hasattr(exc, "orig") else str(exc)
        err_lower = err_msg.lower()
        if "email" in err_lower:
            raise BusinessException(
                status_code=status.HTTP_409_CONFLICT,
                code="AUTH_EMAIL_EXISTS",
                message="Email đã được đăng ký bởi tài khoản khác trong hệ thống.",
            )
        elif "phone" in err_lower or "thoại" in err_lower:
            raise BusinessException(
                status_code=status.HTTP_409_CONFLICT,
                code="AUTH_PHONE_EXISTS",
                message="Số điện thoại đã được đăng ký trong hệ thống.",
            )
        raise
    except Exception as exc:
        db.rollback()
        logger.error(f"Error during user registration transaction: {exc}", exc_info=True)
        raise BusinessException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            code="INTERNAL_SERVER_ERROR",
            message="Đăng ký tài khoản thất bại do lỗi hệ thống.",
        ) from exc

    return SingleResponse(
        success=True,
        message="Đăng ký tài khoản thành công.",
        data=UserRegisterResponseData(
            id=new_user.id,
            name=new_user.name,
            email=new_user.email,
            phone=new_user.phone,
            role=payload.role.lower(),
            wallet_id=wallet.id,
            balance=wallet.balance,
        ),
    )
