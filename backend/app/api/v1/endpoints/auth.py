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


@router.post(
    "/login",
    status_code=status.HTTP_200_OK,
    response_model=SingleResponse[LoginResponseData],
    summary="Đăng nhập hệ thống",
    description="Xác thực thông tin qua email/mật khẩu, cấp mã Access Token JWT chuẩn HMAC-SHA256.",
)
def login(
    payload: LoginRequest,
    db: Session = Depends(get_db),
):
    """
    Quy trình đăng nhập:
    - Tìm kiếm người dùng qua email chuẩn hóa (chữ thường).
    - So sánh mật khẩu băm Bcrypt.
    - Bảo mật: Nếu sai email hoặc mật khẩu, trả về cùng mã HTTP 401 Unauthorized
      với cùng error code 'AUTH_INVALID_CREDENTIALS' và message 'Email hoặc mật khẩu không chính xác.'.
    - Kiểm tra trạng thái tài khoản: Nếu is_active = False, từ chối với HTTP 400 Bad Request.
    - Tạo JWT Access Token chứa sub=user.id và role.
    """
    normalized_email = payload.email.strip().lower()
    user = db.query(User).filter(User.email == normalized_email).first()

    # Chống enumeration: sai email hay sai mật khẩu đều trả cùng mã lỗi
    if not user or not verify_password(payload.password, user.password_hash):
        raise BusinessException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            code="AUTH_INVALID_CREDENTIALS",
            message="Email hoặc mật khẩu không chính xác.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Kiểm tra trạng thái hoạt động của tài khoản
    if not user.is_active:
        raise BusinessException(
            status_code=status.HTTP_400_BAD_REQUEST,
            code="INVALID_REQUEST",
            message="Tài khoản đã bị vô hiệu hóa.",
        )

    user_role = user.role_names[0] if user.role_names else "customer"

    token_payload = {
        "sub": str(user.id),
        "user_id": user.id,
        "email": user.email,
        "role": user_role,
        "roles": user.role_names,
    }
    access_token = create_access_token(data=token_payload)

    return SingleResponse(
        success=True,
        message="Đăng nhập thành công.",
        data=LoginResponseData(
            access_token=access_token,
            token_type="bearer",
            user=UserBrief(
                id=user.id,
                name=user.name,
                email=user.email,
                role=user_role,
            ),
        ),
    )


@router.get(
    "/me",
    status_code=status.HTTP_200_OK,
    response_model=SingleResponse[UserProfileResponseData],
    summary="Lấy thông tin hồ sơ & Số dư ví hiện tại",
    description="Trả về thông tin hồ sơ và số dư ví của tài khoản đang đăng nhập.",
)
def get_me(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Lấy thông tin tài khoản hiện tại:
    - Yêu cầu xác thực qua header 'Authorization: Bearer <token>'.
    - Lấy thông tin người dùng và ví nội bộ tương ứng.
    """
    wallet = current_user.wallet
    if not wallet:
        wallet = db.query(Wallet).filter(Wallet.user_id == current_user.id).first()

    wallet_brief: Optional[WalletBrief] = None
    if wallet:
        wallet_brief = WalletBrief(id=wallet.id, balance=wallet.balance)

    user_role = current_user.role_names[0] if current_user.role_names else "customer"

    return SingleResponse(
        success=True,
        message="Lấy thông tin tài khoản thành công.",
        data=UserProfileResponseData(
            id=current_user.id,
            name=current_user.name,
            email=current_user.email,
            phone=current_user.phone,
            role=user_role,
            wallet=wallet_brief,
        ),
    )


@router.post(
    "/logout",
    status_code=status.HTTP_200_OK,
    response_model=SingleResponse[None],
    summary="Đăng xuất hệ thống",
    description="Đăng xuất khỏi hệ thống, trả data: null theo mục 2.1.C của api-conventions.md.",
)
def logout(
    current_user: User = Depends(get_current_user),
):
    """
    Đăng xuất:
    - Yêu cầu Bearer token hợp lệ.
    - Trả về data: null theo quy ước thao tác không trả dữ liệu.
    """
    return SingleResponse(
        success=True,
        message="Đăng xuất thành công.",
        data=None,
    )
