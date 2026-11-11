from datetime import timedelta
import pytest
from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.deps import get_current_user, get_db, require_role
from app.core.database import Base
from app.core.security import create_access_token, hash_password
from app.models.user import Role, User, UserRole

# Sử dụng SQLite in-memory độc lập cho test
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Tạo một FastAPI app để kiểm thử các dependencies
app_under_test = FastAPI()


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


app_under_test.dependency_overrides[get_db] = override_get_db


@app_under_test.get("/me")
def read_current_user(user: User = Depends(get_current_user)):
    return {
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "is_active": user.is_active,
        "roles": user.role_names,
    }


@app_under_test.get("/customer-zone")
def customer_zone(user: User = Depends(require_role("customer"))):
    return {"message": "Welcome customer", "user_id": user.id}


@app_under_test.get("/owner-zone")
def owner_zone(user: User = Depends(require_role("owner"))):
    return {"message": "Welcome owner", "user_id": user.id}


@app_under_test.get("/admin-zone")
def admin_zone(user: User = Depends(require_role("admin"))):
    return {"message": "Welcome admin", "user_id": user.id}


@pytest.fixture(scope="module")
def setup_database():
    """Khởi tạo cấu trúc bảng và nạp dữ liệu mẫu ban đầu."""
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()

    # 1. Tạo 3 vai trò chuẩn theo bảng roles: CUSTOMER, OWNER, ADMIN
    role_customer = Role(id=1, name="CUSTOMER", description="Khách hàng đặt sân")
    role_owner = Role(id=2, name="OWNER", description="Chủ sân")
    role_admin = Role(id=3, name="ADMIN", description="Quản trị viên")
    db.add_all([role_customer, role_owner, role_admin])
    db.commit()

    # 2. Tạo người dùng kiểm thử
    pwd_hash = hash_password("Secret123456")

    user_customer = User(
        id=1,
        name="Nguyen Van Customer",
        email="customer@example.com",
        phone="0901000001",
        password_hash=pwd_hash,
        is_active=True,
    )
    user_owner = User(
        id=2,
        name="Tran Van Owner",
        email="owner@example.com",
        phone="0901000002",
        password_hash=pwd_hash,
        is_active=True,
    )
    user_admin = User(
        id=3,
        name="Le Van Admin",
        email="admin@example.com",
        phone="0901000003",
        password_hash=pwd_hash,
        is_active=True,
    )
    user_inactive = User(
        id=4,
        name="Inactive User",
        email="inactive@example.com",
        phone="0901000004",
        password_hash=pwd_hash,
        is_active=False,  # Tài khoản bị vô hiệu hóa
    )

    db.add_all([user_customer, user_owner, user_admin, user_inactive])
    db.commit()

    # 3. Gán vai trò cho từng người dùng
    db.add_all([
        UserRole(user_id=1, role_id=1),  # user 1 -> CUSTOMER
        UserRole(user_id=2, role_id=2),  # user 2 -> OWNER
        UserRole(user_id=3, role_id=3),  # user 3 -> ADMIN
        UserRole(user_id=4, role_id=1),  # user 4 -> CUSTOMER (nhưng inactive)
    ])
    db.commit()
    db.close()

    yield

    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def auth_client(setup_database):
    """Test client kết nối với app_under_test."""
    return TestClient(app_under_test)


class TestGetCurrentUser:
    """Kiểm tra dependency get_current_user."""

    def test_missing_token_returns_401(self, auth_client):
        """YÊU CẦU: Không có token trong header Authorization phải trả về 401 Unauthorized."""
        response = auth_client.get("/me")
        assert response.status_code == 401
        assert "Thiếu header Authorization: Bearer" in response.json()["detail"]

    def test_invalid_scheme_returns_401(self, auth_client):
        """Header Authorization không phải Bearer phải trả về 401."""
        response = auth_client.get("/me", headers={"Authorization": "Basic dXNlcjpwYXNz"})
        assert response.status_code == 401
        assert "Bearer" in response.headers.get("WWW-Authenticate", "") or "Bearer" in response.json()["detail"]

    def test_expired_token_returns_401(self, auth_client):
        """YÊU CẦU: Token hết hạn phải trả về 401 Unauthorized."""
        expired_token = create_access_token(
            data={"sub": "1"},
            expires_delta=timedelta(seconds=-10),
        )
        response = auth_client.get("/me", headers={"Authorization": f"Bearer {expired_token}"})
        assert response.status_code == 401
        assert "Token đã hết hạn" in response.json()["detail"]

    def test_invalid_signature_token_returns_401(self, auth_client):
        """YÊU CẦU: Token sai chữ ký phải trả về 401 Unauthorized."""
        fake_token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxIn0.invalidsignature123"
        response = auth_client.get("/me", headers={"Authorization": f"Bearer {fake_token}"})
        assert response.status_code == 401
        assert "Token không hợp lệ hoặc sai chữ ký" in response.json()["detail"]

    def test_user_not_found_returns_401(self, auth_client):
        """Token chứa user_id không tồn tại trong CSDL phải trả về 401."""
        token = create_access_token(data={"sub": "9999"})
        response = auth_client.get("/me", headers={"Authorization": f"Bearer {token}"})
        assert response.status_code == 401
        assert "Người dùng không tồn tại" in response.json()["detail"]

    def test_inactive_account_rejected(self, auth_client):
        """YÊU CẦU: Tài khoản có is_active = false phải bị từ chối truy cập."""
        token_inactive = create_access_token(data={"sub": "4"})
        response = auth_client.get("/me", headers={"Authorization": f"Bearer {token_inactive}"})
        # Bị từ chối với status code lỗi 400 Bad Request
        assert response.status_code == 400
        assert "Tài khoản đã bị vô hiệu hóa" in response.json()["detail"]

    def test_valid_user_success(self, auth_client):
        """Tài khoản hợp lệ và đang hoạt động lấy thông tin thành công."""
        token = create_access_token(data={"sub": "1"})
        response = auth_client.get("/me", headers={"Authorization": f"Bearer {token}"})
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == 1
        assert data["email"] == "customer@example.com"
        assert "customer" in data["roles"]


class TestRequireRole:
    """Kiểm tra phân quyền vai trò require_role cho cả 3 vai trò: customer, owner, admin."""

    def test_role_customer(self, auth_client):
        """Kiểm thử vai trò CUSTOMER: chỉ vào được customer-zone, bị 403 ở owner và admin zone."""
        token = create_access_token(data={"sub": "1"})
        headers = {"Authorization": f"Bearer {token}"}

        # 1. Gọi endpoint yêu cầu vai trò customer -> Thành công 200
        res_customer = auth_client.get("/customer-zone", headers=headers)
        assert res_customer.status_code == 200
        assert res_customer.json()["message"] == "Welcome customer"

        # 2. Gọi endpoint yêu cầu vai trò owner -> Bị từ chối 403
        res_owner = auth_client.get("/owner-zone", headers=headers)
        assert res_owner.status_code == 403
        assert "Không đủ quyền truy cập" in res_owner.json()["detail"]

        # 3. Gọi endpoint yêu cầu vai trò admin -> Bị từ chối 403
        res_admin = auth_client.get("/admin-zone", headers=headers)
        assert res_admin.status_code == 403
        assert "Không đủ quyền truy cập" in res_admin.json()["detail"]

    def test_role_owner(self, auth_client):
        """Kiểm thử vai trò OWNER: chỉ vào được owner-zone, bị 403 ở customer và admin zone."""
        token = create_access_token(data={"sub": "2"})
        headers = {"Authorization": f"Bearer {token}"}

        # 1. Gọi endpoint yêu cầu vai trò owner -> Thành công 200
        res_owner = auth_client.get("/owner-zone", headers=headers)
        assert res_owner.status_code == 200
        assert res_owner.json()["message"] == "Welcome owner"

        # 2. Gọi endpoint yêu cầu vai trò customer -> Bị từ chối 403
        res_customer = auth_client.get("/customer-zone", headers=headers)
        assert res_customer.status_code == 403

        # 3. Gọi endpoint yêu cầu vai trò admin -> Bị từ chối 403
        res_admin = auth_client.get("/admin-zone", headers=headers)
        assert res_admin.status_code == 403

    def test_role_admin(self, auth_client):
        """Kiểm thử vai trò ADMIN: chỉ vào được admin-zone, bị 403 ở customer và owner zone."""
        token = create_access_token(data={"sub": "3"})
        headers = {"Authorization": f"Bearer {token}"}

        # 1. Gọi endpoint yêu cầu vai trò admin -> Thành công 200
        res_admin = auth_client.get("/admin-zone", headers=headers)
        assert res_admin.status_code == 200
        assert res_admin.json()["message"] == "Welcome admin"

        # 2. Gọi endpoint yêu cầu vai trò customer -> Bị từ chối 403
        res_customer = auth_client.get("/customer-zone", headers=headers)
        assert res_customer.status_code == 403

        # 3. Gọi endpoint yêu cầu vai trò owner -> Bị từ chối 403
        res_owner = auth_client.get("/owner-zone", headers=headers)
        assert res_owner.status_code == 403

    def test_role_case_insensitivity(self, auth_client):
        """Kiểm thử so khớp không phân biệt hoa thường ('owner' vs 'OWNER')."""
        @app_under_test.get("/case-test")
        def case_test(user: User = Depends(require_role("OWNER"))):
            return {"ok": True}

        token = create_access_token(data={"sub": "2"})  # user 2 có role OWNER
        res = auth_client.get("/case-test", headers={"Authorization": f"Bearer {token}"})
        assert res.status_code == 200
        assert res.json()["ok"] is True
