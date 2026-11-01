import pytest
from fastapi.testclient import TestClient
from sqlalchemy import BigInteger, create_engine
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.deps import get_db
from app.core.database import Base
from app.core.security import hash_password
from app.main import app
from app.models.user import Role, User, UserRole
from app.models.wallet import Wallet


# SQLite chỉ autoincrement với INTEGER PRIMARY KEY nên biên dịch BigInteger thành INTEGER
@compiles(BigInteger, "sqlite")
def _bigint_as_integer(type_, compiler, **kw):
    return "INTEGER"


# SQLite in-memory database độc lập cho test suite
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
    """Khởi tạo cấu trúc bảng và nạp dữ liệu mẫu chuẩn theo database/seeds/S1__sample_data.sql."""
    original_override = app.dependency_overrides.get(get_db)
    app.dependency_overrides[get_db] = override_get_db

    Base.metadata.create_all(bind=test_engine)
    db: Session = TestingSessionLocal()

    # 1. Khởi tạo 3 vai trò hệ thống
    role_customer = Role(id=1, name="CUSTOMER", description="Khách hàng đặt sân")
    role_owner = Role(id=2, name="OWNER", description="Chủ cơ sở thể thao")
    role_admin = Role(id=3, name="ADMIN", description="Quản trị viên hệ thống")
    db.add_all([role_customer, role_owner, role_admin])
    db.flush()

    # 2. Mật khẩu mẫu chung đã hash Bcrypt
    default_pwd_hash = hash_password("TestPass123@")

    # 3. Tạo các tài khoản người dùng theo seeds/S1__sample_data.sql:
    # 3a. Admin
    user_admin = User(
        id=2,
        name="Nguyễn Quản Trị",
        email="admin@scb.vn",
        phone="0900000001",
        password_hash=default_pwd_hash,
        is_active=True,
        is_system=False,
    )
    # 3b. Chủ sân
    user_owner = User(
        id=3,
        name="Trần Văn Chủ",
        email="owner@scb.vn",
        phone="0900000002",
        password_hash=default_pwd_hash,
        is_active=True,
        is_system=False,
    )
    # 3c. Khách hàng A (Ví 500.000 VNĐ)
    user_customer_a = User(
        id=4,
        name="Lê Khách Hàng A",
        email="customer.a@scb.vn",
        phone="0900000003",
        password_hash=default_pwd_hash,
        is_active=True,
        is_system=False,
    )
    # 3d. Khách hàng B (Ví 200.000 VNĐ)
    user_customer_b = User(
        id=5,
        name="Phạm Khách Hàng B",
        email="customer.b@scb.vn",
        phone="0900000004",
        password_hash=default_pwd_hash,
        is_active=True,
        is_system=False,
    )
    # 3e. Tài khoản bị vô hiệu hóa
    user_inactive = User(
        id=6,
        name="Người Dùng Bị Khóa",
        email="inactive@scb.vn",
        phone="0900000005",
        password_hash=default_pwd_hash,
        is_active=False,
        is_system=False,
    )
    db.add_all([user_admin, user_owner, user_customer_a, user_customer_b, user_inactive])
    db.flush()

    # 4. Gán vai trò
    db.add_all([
        UserRole(user_id=2, role_id=3),  # admin -> ADMIN
        UserRole(user_id=3, role_id=2),  # owner -> OWNER
        UserRole(user_id=4, role_id=1),  # customer A -> CUSTOMER
        UserRole(user_id=5, role_id=1),  # customer B -> CUSTOMER
        UserRole(user_id=6, role_id=1),  # inactive -> CUSTOMER
    ])
    db.flush()

    # 5. Khởi tạo Ví tiền theo dữ liệu mẫu:
    # Ví Admin: 0 VNĐ, Ví Chủ sân: 0 VNĐ, Ví Khách A: 500.000 VNĐ, Ví Khách B: 200.000 VNĐ
    wallet_admin = Wallet(id=2, user_id=2, balance=0)
    wallet_owner = Wallet(id=3, user_id=3, balance=0)
    wallet_customer_a = Wallet(id=4, user_id=4, balance=500000)
    wallet_customer_b = Wallet(id=5, user_id=5, balance=200000)
    wallet_inactive = Wallet(id=6, user_id=6, balance=10000)
    db.add_all([wallet_admin, wallet_owner, wallet_customer_a, wallet_customer_b, wallet_inactive])

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
# 1. KIỂM THỬ POST /api/v1/auth/login
# ==============================================================================

def test_login_success_customer(client: TestClient):
    """Đăng nhập thành công với tài khoản khách hàng, trả JWT access token và thông tin user."""
    payload = {
        "email": "customer.a@scb.vn",
        "password": "TestPass123@",
    }
    response = client.post("/api/v1/auth/login", json=payload)
    assert response.status_code == 200

    res_data = response.json()
    assert res_data["success"] is True
    assert res_data["message"] == "Đăng nhập thành công."

    data = res_data["data"]
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert data["user"]["id"] == 4
    assert data["user"]["name"] == "Lê Khách Hàng A"
    assert data["user"]["email"] == "customer.a@scb.vn"
    assert data["user"]["role"] == "customer"


def test_login_success_owner(client: TestClient):
    """Đăng nhập thành công với tài khoản chủ sân."""
    payload = {
        "email": "owner@scb.vn",
        "password": "TestPass123@",
    }
    response = client.post("/api/v1/auth/login", json=payload)
    assert response.status_code == 200

    data = response.json()["data"]
    assert data["user"]["id"] == 3
    assert data["user"]["role"] == "owner"


def test_login_wrong_email_returns_401(client: TestClient):
    """Đăng nhập với email không tồn tại trả về 401 AUTH_INVALID_CREDENTIALS."""
    payload = {
        "email": "notfound@scb.vn",
        "password": "TestPass123@",
    }
    response = client.post("/api/v1/auth/login", json=payload)
    assert response.status_code == 401

    res_data = response.json()
    assert res_data["success"] is False
    assert res_data["error"]["code"] == "AUTH_INVALID_CREDENTIALS"
    assert res_data["error"]["message"] == "Email hoặc mật khẩu không chính xác."


def test_login_wrong_password_returns_401(client: TestClient):
    """Đăng nhập với email đúng nhưng mật khẩu sai trả về 401 AUTH_INVALID_CREDENTIALS."""
    payload = {
        "email": "customer.a@scb.vn",
        "password": "WrongPassword999!",
    }
    response = client.post("/api/v1/auth/login", json=payload)
    assert response.status_code == 401

    res_data = response.json()
    assert res_data["success"] is False
    assert res_data["error"]["code"] == "AUTH_INVALID_CREDENTIALS"
    assert res_data["error"]["message"] == "Email hoặc mật khẩu không chính xác."


def test_login_same_message_for_wrong_email_and_wrong_password(client: TestClient):
    """
    TIÊU CHÍ BẮT BUỘC (Anti-enumeration):
    Đăng nhập sai phải trả 401 cùng một thông báo cho cả sai email và sai mật khẩu.
    """
    res_wrong_email = client.post(
        "/api/v1/auth/login",
        json={"email": "wrong_email@scb.vn", "password": "AnyPassword123@"},
    )
    res_wrong_pass = client.post(
        "/api/v1/auth/login",
        json={"email": "customer.a@scb.vn", "password": "WrongPassword123@"},
    )

    assert res_wrong_email.status_code == 401
    assert res_wrong_pass.status_code == 401

    # Cùng mã lỗi nghiệp vụ
    assert res_wrong_email.json()["error"]["code"] == res_wrong_pass.json()["error"]["code"]
    # Cùng thông báo lỗi
    assert res_wrong_email.json()["error"]["message"] == res_wrong_pass.json()["error"]["message"]
    assert res_wrong_email.json()["error"]["message"] == "Email hoặc mật khẩu không chính xác."


def test_login_inactive_user_rejected(client: TestClient):
    """Đăng nhập vào tài khoản đã bị vô hiệu hóa (is_active = False) bị từ chối với 400 Bad Request."""
    payload = {
        "email": "inactive@scb.vn",
        "password": "TestPass123@",
    }
    response = client.post("/api/v1/auth/login", json=payload)
    assert response.status_code == 400
    assert "vô hiệu hóa" in response.json()["error"]["message"]


def test_login_email_case_insensitivity(client: TestClient):
    """Email không phân biệt hoa thường khi đăng nhập."""
    payload = {
        "email": "CUSTOMER.A@SCB.VN",
        "password": "TestPass123@",
    }
    response = client.post("/api/v1/auth/login", json=payload)
    assert response.status_code == 200
    assert response.json()["success"] is True


def test_login_missing_fields_returns_422(client: TestClient):
    """Thiếu trường email hoặc password phải trả về lỗi 422 VALIDATION_ERROR."""
    res1 = client.post("/api/v1/auth/login", json={"email": "customer.a@scb.vn"})
    assert res1.status_code == 422
    assert res1.json()["error"]["code"] == "VALIDATION_ERROR"

    res2 = client.post("/api/v1/auth/login", json={"password": "TestPass123@"})
    assert res2.status_code == 422
    assert res2.json()["error"]["code"] == "VALIDATION_ERROR"


# ==============================================================================
# 2. KIỂM THỬ GET /api/v1/auth/me (SỐ DƯ VÍ THEO DỮ LIỆU MẪU)
# ==============================================================================

def test_get_me_customer_a_wallet_balance_500k(client: TestClient):
    """
    TIÊU CHÍ BẮT BUỘC:
    /auth/me trả số dư ví đúng theo dữ liệu mẫu:
    - Khách A có số dư ví 500.000 VNĐ.
    """
    # 1. Đăng nhập Khách A
    login_res = client.post(
        "/api/v1/auth/login",
        json={"email": "customer.a@scb.vn", "password": "TestPass123@"},
    )
    assert login_res.status_code == 200
    token = login_res.json()["data"]["access_token"]

    # 2. Gọi GET /auth/me
    response = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200

    res_data = response.json()
    assert res_data["success"] is True
    assert res_data["message"] == "Lấy thông tin tài khoản thành công."

    data = res_data["data"]
    assert data["id"] == 4
    assert data["name"] == "Lê Khách Hàng A"
    assert data["email"] == "customer.a@scb.vn"
    assert data["phone"] == "0900000003"
    assert data["role"] == "customer"

    # Kiểm tra số dư ví đúng 500.000 VNĐ theo mẫu
    assert data["wallet"] is not None
    assert data["wallet"]["id"] == 4
    assert data["wallet"]["balance"] == 500000


def test_get_me_customer_b_wallet_balance_200k(client: TestClient):
    """
    TIÊU CHÍ BẮT BUỘC:
    /auth/me trả số dư ví đúng theo dữ liệu mẫu:
    - Khách B có số dư ví 200.000 VNĐ.
    """
    login_res = client.post(
        "/api/v1/auth/login",
        json={"email": "customer.b@scb.vn", "password": "TestPass123@"},
    )
    token = login_res.json()["data"]["access_token"]

    response = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200

    data = response.json()["data"]
    assert data["id"] == 5
    assert data["wallet"]["balance"] == 200000


def test_get_me_owner_wallet_balance_zero(client: TestClient):
    """Chủ sân có ví ban đầu số dư 0 VNĐ theo dữ liệu mẫu."""
    login_res = client.post(
        "/api/v1/auth/login",
        json={"email": "owner@scb.vn", "password": "TestPass123@"},
    )
    token = login_res.json()["data"]["access_token"]

    response = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200

    data = response.json()["data"]
    assert data["id"] == 3
    assert data["role"] == "owner"
    assert data["wallet"]["balance"] == 0


def test_get_me_without_token_returns_401(client: TestClient):
    """Gọi /auth/me mà không gửi header Authorization trả về 401."""
    response = client.get("/api/v1/auth/me")
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "AUTH_UNAUTHORIZED"


def test_get_me_invalid_token_returns_401(client: TestClient):
    """Gọi /auth/me với token sai chữ ký hoặc không hợp lệ trả về 401."""
    response = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": "Bearer invalid.jwt.token"},
    )
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "AUTH_TOKEN_INVALID"


# ==============================================================================
# 3. KIỂM THỬ POST /api/v1/auth/logout (TRẢ VỀ data: null)
# ==============================================================================

def test_logout_success_returns_data_null(client: TestClient):
    """
    TIÊU CHÍ BẮT BUỘC:
    POST /auth/logout (trả data: null)
    - Trả về HTTP 200 OK.
    - Cấu trúc: success=True, message="Đăng xuất thành công.", data=null.
    """
    login_res = client.post(
        "/api/v1/auth/login",
        json={"email": "customer.a@scb.vn", "password": "TestPass123@"},
    )
    token = login_res.json()["data"]["access_token"]

    response = client.post(
        "/api/v1/auth/logout",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200

    res_data = response.json()
    assert res_data["success"] is True
    assert res_data["message"] == "Đăng xuất thành công."
    assert res_data["data"] is None


def test_logout_without_token_returns_401(client: TestClient):
    """Gọi /auth/logout mà không có token trả về 401 Unauthorized."""
    response = client.post("/api/v1/auth/logout")
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "AUTH_UNAUTHORIZED"
