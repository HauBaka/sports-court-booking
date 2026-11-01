from unittest.mock import patch
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import BigInteger, create_engine
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.deps import get_db
from app.core.database import Base
from app.core.security import verify_password
from app.main import app
from app.models.user import Role, User, UserRole
from app.models.wallet import Wallet


# SQLite chỉ autoincrement với INTEGER PRIMARY KEY nên biên dịch BigInteger thành INTEGER
@compiles(BigInteger, "sqlite")
def _bigint_as_integer(type_, compiler, **kw):
    return "INTEGER"


# SQLite in-memory database cho test
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"
test_engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture(autouse=True)
def setup_database():
    """Tạo mới các bảng trước mỗi test và dọn dẹp sau khi chạy."""
    original_override = app.dependency_overrides.get(get_db)
    app.dependency_overrides[get_db] = override_get_db

    Base.metadata.create_all(bind=test_engine)
    db = TestingSessionLocal()

    # Khởi tạo 3 vai trò mẫu chuẩn theo seeds (CUSTOMER, OWNER, ADMIN)
    role_customer = Role(id=1, name="CUSTOMER", description="Khách hàng đặt sân")
    role_owner = Role(id=2, name="OWNER", description="Chủ cơ sở thể thao")
    role_admin = Role(id=3, name="ADMIN", description="Quản trị viên hệ thống")
    db.add_all([role_customer, role_owner, role_admin])
    db.commit()
    db.close()

    yield

    Base.metadata.drop_all(bind=test_engine)
    if original_override is not None:
        app.dependency_overrides[get_db] = original_override
    else:
        app.dependency_overrides.pop(get_db, None)


@pytest.fixture
def client():
    with TestClient(app, raise_server_exceptions=False) as test_client:
        yield test_client


# ==============================================================================
# 1. TEST ĐĂNG KÝ THÀNH CÔNG VỚI VAI TRÒ CUSTOMER VÀ OWNER
# ==============================================================================

def test_register_customer_success(client: TestClient):
    """
    Đăng ký tài khoản mới thành công với vai trò customer:
    - Trả về HTTP 201 Created.
    - CSDL tạo đủ 3 bản ghi: users, user_roles (CUSTOMER), và wallets (balance = 0).
    - Mật khẩu được mã hóa an toàn bằng Bcrypt.
    """
    payload = {
        "name": "Nguyễn Văn Khách",
        "email": "customer1@example.com",
        "phone": "0901234567",
        "password": "Password123@",
        "role": "customer",
    }

    response = client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == 201

    res_data = response.json()
    assert res_data["success"] is True
    assert res_data["message"] == "Đăng ký tài khoản thành công."

    data = res_data["data"]
    assert data["name"] == payload["name"]
    assert data["email"] == payload["email"]
    assert data["phone"] == payload["phone"]
    assert data["role"] == "customer"
    assert "wallet_id" in data
    assert data["balance"] == 0

    # Kiểm tra CSDL
    db: Session = TestingSessionLocal()
    user = db.query(User).filter(User.email == payload["email"]).first()
    assert user is not None
    assert user.name == payload["name"]
    assert user.phone == payload["phone"]
    assert user.is_active is True
    assert user.is_system is False

    # Mật khẩu không được lưu plain text mà phải là Bcrypt hash
    assert user.password_hash != payload["password"]
    assert verify_password(payload["password"], user.password_hash) is True

    # Kiểm tra vai trò
    assert len(user.roles) == 1
    assert user.roles[0].name == "CUSTOMER"

    # Kiểm tra ví nội bộ
    wallet = db.query(Wallet).filter(Wallet.user_id == user.id).first()
    assert wallet is not None
    assert wallet.balance == 0
    assert wallet.id == data["wallet_id"]
    db.close()


def test_register_owner_success(client: TestClient):
    """
    Đăng ký tài khoản mới thành công với vai trò owner:
    - Trả về HTTP 201 Created.
    - Gán vai trò OWNER.
    - Khởi tạo ví nội bộ với balance = 0.
    """
    payload = {
        "name": "Trần Thị Chủ Sân",
        "email": "owner1@example.com",
        "phone": "0987654321",
        "password": "OwnerSecret456#",
        "role": "owner",
    }

    response = client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == 201

    res_data = response.json()
    assert res_data["success"] is True
    assert res_data["data"]["role"] == "owner"

    db: Session = TestingSessionLocal()
    user = db.query(User).filter(User.email == payload["email"]).first()
    assert user is not None
    assert len(user.roles) == 1
    assert user.roles[0].name == "OWNER"

    wallet = db.query(Wallet).filter(Wallet.user_id == user.id).first()
    assert wallet is not None
    assert wallet.balance == 0
    db.close()


# ==============================================================================
# 2. TEST TỪ CHỐI ĐĂNG KÝ VỚI VAI TRÒ ADMIN HOẶC SAI VAI TRÒ
# ==============================================================================

def test_register_role_admin_rejected(client: TestClient):
    """
    Đăng ký với vai trò admin phải bị từ chối:
    - Trả về mã lỗi 422 Unprocessable Entity.
    - Không có bất kỳ bản ghi user nào được tạo trong DB.
    """
    payload = {
        "name": "Kẻ Mạo Danh Admin",
        "email": "admin_fake@example.com",
        "phone": "0909999999",
        "password": "AdminPassword123@",
        "role": "admin",
    }

    response = client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == 422

    res_data = response.json()
    assert res_data["success"] is False
    assert res_data["error"]["code"] == "VALIDATION_ERROR"

    # Kiểm tra CSDL không có user nào
    db: Session = TestingSessionLocal()
    user = db.query(User).filter(User.email == payload["email"]).first()
    assert user is None
    db.close()


def test_register_invalid_role_rejected(client: TestClient):
    """Đăng ký với vai trò không tồn tại (vd: manager) phải trả về lỗi 422."""
    payload = {
        "name": "Người Dùng Mới",
        "email": "manager@example.com",
        "phone": "0908888888",
        "password": "Password123@",
        "role": "manager",
    }

    response = client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "VALIDATION_ERROR"


# ==============================================================================
# 3. TEST TRÙNG LẶP EMAIL HOẶC SỐ ĐIỆN THOẠI (HTTP 409 CONFLICT)
# ==============================================================================

def test_register_duplicate_email_returns_409(client: TestClient):
    """
    Đăng ký tài khoản với email đã tồn tại:
    - Trả về HTTP 409 Conflict.
    - Error code: AUTH_EMAIL_EXISTS.
    """
    # 1. Đăng ký tài khoản đầu tiên
    payload1 = {
        "name": "Người Dùng A",
        "email": "duplicate@example.com",
        "phone": "0901111111",
        "password": "Password123@",
        "role": "customer",
    }
    res1 = client.post("/api/v1/auth/register", json=payload1)
    assert res1.status_code == 201

    # 2. Đăng ký tài khoản thứ hai với cùng email nhưng khác số điện thoại
    payload2 = {
        "name": "Người Dùng B",
        "email": "duplicate@example.com",
        "phone": "0902222222",
        "password": "Password456@",
        "role": "customer",
    }
    res2 = client.post("/api/v1/auth/register", json=payload2)
    assert res2.status_code == 409

    res_data = res2.json()
    assert res_data["success"] is False
    assert res_data["error"]["code"] == "AUTH_EMAIL_EXISTS"


def test_register_duplicate_phone_returns_409(client: TestClient):
    """
    Đăng ký tài khoản với số điện thoại đã tồn tại:
    - Trả về HTTP 409 Conflict.
    - Error code: AUTH_PHONE_EXISTS.
    """
    # 1. Đăng ký tài khoản đầu tiên
    payload1 = {
        "name": "Người Dùng A",
        "email": "userA@example.com",
        "phone": "0903333333",
        "password": "Password123@",
        "role": "customer",
    }
    res1 = client.post("/api/v1/auth/register", json=payload1)
    assert res1.status_code == 201

    # 2. Đăng ký tài khoản thứ hai với cùng số điện thoại nhưng khác email
    payload2 = {
        "name": "Người Dùng B",
        "email": "userB@example.com",
        "phone": "0903333333",
        "password": "Password456@",
        "role": "owner",
    }
    res2 = client.post("/api/v1/auth/register", json=payload2)
    assert res2.status_code == 409

    res_data = res2.json()
    assert res_data["success"] is False
    assert res_data["error"]["code"] == "AUTH_PHONE_EXISTS"


# ==============================================================================
# 4. TEST VALIDATION MẬT KHẨU YẾU VÀ EMAIL SAI ĐỊNH DẠNG (HTTP 422)
# ==============================================================================

@pytest.mark.parametrize("invalid_password", [
    "Short1!",            # Dưới 8 ký tự
    "alllowercase123!",   # Thiếu chữ hoa
    "ALLUPPERCASE123!",   # Thiếu chữ thường
    "NoDigitsSpecial!",   # Thiếu số
    "NoSpecialChar123",   # Thiếu ký tự đặc biệt
])
def test_register_weak_password_returns_422(client: TestClient, invalid_password: str):
    """Mật khẩu không đáp ứng tiêu chuẩn an toàn phải trả về HTTP 422 VALIDATION_ERROR."""
    payload = {
        "name": "Người Dùng Test",
        "email": "test_pass@example.com",
        "phone": "0904444444",
        "password": invalid_password,
        "role": "customer",
    }
    response = client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "VALIDATION_ERROR"


@pytest.mark.parametrize("invalid_email", [
    "not-an-email",
    "user@",
    "@domain.com",
    "user@domain",
    "",
])
def test_register_invalid_email_returns_422(client: TestClient, invalid_email: str):
    """Email không đúng định dạng phải trả về HTTP 422 VALIDATION_ERROR."""
    payload = {
        "name": "Người Dùng Test",
        "email": invalid_email,
        "phone": "0905555555",
        "password": "Password123@",
        "role": "customer",
    }
    response = client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "VALIDATION_ERROR"


@pytest.mark.parametrize("invalid_phone", [
    "12345",         # Quá ngắn
    "090123456789",  # Quá dài (12 số)
    "abcdefghij",    # Ký tự chữ
    "",
])
def test_register_invalid_phone_returns_422(client: TestClient, invalid_phone: str):
    """Số điện thoại không đúng chuẩn phải trả về HTTP 422 VALIDATION_ERROR."""
    payload = {
        "name": "Người Dùng Test",
        "email": "valid_email@example.com",
        "phone": invalid_phone,
        "password": "Password123@",
        "role": "customer",
    }
    response = client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "VALIDATION_ERROR"


# ==============================================================================
# 5. TEST TRANSACTION ROLLBACK KHI LỖI Ở BƯỚC TẠO VÍ
# ==============================================================================

def test_rollback_on_wallet_creation_failure(client: TestClient):
    """
    TIÊU CHÍ QUAN TRỌNG NHẤT:
    Lỗi ở bước tạo ví thì không còn bản ghi users nào trong DB (test rollback).
    - Giả lập lỗi khi insert/add ví.
    - Transaction phải rollback toàn bộ.
    - Kiểm tra bảng users, user_roles và wallets không còn bất kỳ dữ liệu nào.
    """
    payload = {
        "name": "Người Dùng Thất Bại",
        "email": "rollback_test@example.com",
        "phone": "0907777777",
        "password": "Password123@",
        "role": "customer",
    }

    # Lưu lại số lượng bản ghi ban đầu
    db: Session = TestingSessionLocal()
    initial_users_count = db.query(User).count()
    initial_user_roles_count = db.query(UserRole).count()
    initial_wallets_count = db.query(Wallet).count()
    db.close()

    original_add = Session.add

    def mock_add(self, instance, *args, **kwargs):
        # Nếu đối tượng được thêm vào session là Wallet, giả lập lỗi runtime
        if isinstance(instance, Wallet):
            raise RuntimeError("Mô phỏng sự cố hệ thống khi tạo ví!")
        return original_add(self, instance, *args, **kwargs)

    with patch.object(Session, "add", side_effect=mock_add, autospec=True):
        response = client.post("/api/v1/auth/register", json=payload)
        # Server phải trả về mã lỗi 500 do Runtime Exception không bắt trước
        assert response.status_code == 500

    # KIỂM TRA TÍNH TOÀN VẸN CỦA CSDL SAU KHI ROLLBACK:
    db_verify: Session = TestingSessionLocal()
    # 1. Không còn bản ghi users nào tương ứng với email đăng ký
    failed_user = db_verify.query(User).filter(User.email == payload["email"]).first()
    assert failed_user is None, "Lỗi: Bản ghi User vẫn tồn tại sau khi bước tạo ví thất bại!"

    # 2. Tổng số lượng user, user_roles, wallets giữ nguyên trạng thái trước khi gọi API
    assert db_verify.query(User).count() == initial_users_count
    assert db_verify.query(UserRole).count() == initial_user_roles_count
    assert db_verify.query(Wallet).count() == initial_wallets_count
    db_verify.close()
