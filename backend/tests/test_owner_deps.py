from datetime import time
import pytest
from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.deps import get_court_for_owner, get_db, get_facility_for_owner
from app.core.database import Base
from app.core.security import create_access_token, hash_password
from app.models.facility import Court, Facility
from app.models.user import Role, User, UserRole

# Sử dụng SQLite in-memory độc lập cho test
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Tạo FastAPI app kiểm thử các dependency sở hữu
owner_test_app = FastAPI()


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


owner_test_app.dependency_overrides[get_db] = override_get_db


@owner_test_app.put("/facilities/{facility_id}")
def update_facility(facility: Facility = Depends(get_facility_for_owner)):
    """Endpoint mẫu dùng get_facility_for_owner (SCB-83, 88)."""
    return {
        "id": facility.id,
        "name": facility.name,
        "owner_id": facility.owner_id,
    }


@owner_test_app.put("/courts/{court_id}")
def update_court(court: Court = Depends(get_court_for_owner)):
    """Endpoint mẫu dùng get_court_for_owner (SCB-88, 93)."""
    return {
        "id": court.id,
        "name": court.name,
        "facility_id": court.facility_id,
        "facility_name": court.facility.name,
    }


@pytest.fixture(scope="module")
def setup_owner_database():
    """Khởi tạo CSDL mẫu với cấu trúc từ S1__sample_data.sql."""
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()

    # 1. Tạo vai trò
    role_owner = Role(id=2, name="OWNER", description="Chủ sân")
    role_customer = Role(id=1, name="CUSTOMER", description="Khách hàng")
    db.add_all([role_owner, role_customer])
    db.commit()

    pwd_hash = hash_password("Secret123456")

    # 2. Tạo User theo dữ liệu mẫu:
    # User 3: Trần Văn Chủ (Chủ cơ sở 1)
    owner_a = User(
        id=3,
        name="Trần Văn Chủ",
        email="owner@scb.vn",
        phone="0900000002",
        password_hash=pwd_hash,
        is_active=True,
    )
    # User 4: Lê Khách Hàng A
    customer = User(
        id=4,
        name="Lê Khách Hàng A",
        email="customer.a@scb.vn",
        phone="0900000003",
        password_hash=pwd_hash,
        is_active=True,
    )
    # User 6: Chủ sân khác (Chủ cơ sở khác)
    owner_b = User(
        id=6,
        name="Nguyễn Văn Chủ Khác",
        email="owner2@scb.vn",
        phone="0900000006",
        password_hash=pwd_hash,
        is_active=True,
    )
    db.add_all([owner_a, customer, owner_b])
    db.commit()

    # Gán vai trò
    db.add_all([
        UserRole(user_id=3, role_id=2),  # Owner A
        UserRole(user_id=4, role_id=1),  # Customer
        UserRole(user_id=6, role_id=2),  # Owner B
    ])
    db.commit()

    # 3. Tạo Cơ sở thể thao (Facility 1 thuộc Owner A: user_id=3)
    facility_1 = Facility(
        id=1,
        owner_id=3,
        name="Cơ Sở Cầu Lông & Pickleball Kỳ Hòa",
        address="238 Ba Tháng Hai, Phường 12, Quận 10, TP.HCM",
        city="TP.HCM",
        district="Quận 10",
        latitude=10.7719210,
        longitude=106.6710420,
        open_time=time(6, 0),
        close_time=time(23, 0),
        is_active=True,
    )
    db.add(facility_1)
    db.commit()

    # 4. Tạo Sân con thuộc Cơ sở 1
    court_1 = Court(
        id=1,
        facility_id=1,
        sport_id=1,
        name="Sân Cầu Lông 1 (Thảm Yonex)",
        court_type="STANDARD",
        environment="INDOOR",
        open_time=time(6, 0),
        close_time=time(23, 0),
        is_active=True,
    )
    court_2 = Court(
        id=2,
        facility_id=1,
        sport_id=1,
        name="Sân Cầu Lông 2 (Thảm Yonex)",
        court_type="STANDARD",
        environment="INDOOR",
        open_time=time(6, 0),
        close_time=time(23, 0),
        is_active=True,
    )
    db.add_all([court_1, court_2])
    db.commit()
    db.close()

    yield

    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def owner_client(setup_owner_database):
    """Test client cho owner_test_app."""
    return TestClient(owner_test_app)


class TestFacilityOwnerDependency:
    """Kiểm tra dependency get_facility_for_owner (SCB-77)."""

    def test_facility_not_found_returns_404(self, owner_client):
        """YÊU CẦU: Cơ sở không tồn tại trong CSDL phải trả về 404 Not Found."""
        token_owner_a = create_access_token(data={"sub": "3"})
        headers = {"Authorization": f"Bearer {token_owner_a}"}

        response = owner_client.put("/facilities/9999", headers=headers)
        assert response.status_code == 404
        assert "không tồn tại" in response.json()["detail"]

    def test_other_owner_accessing_facility_returns_403(self, owner_client):
        """YÊU CẦU: Chủ khác (Owner B) truy cập cơ sở của Owner A phải trả về 403 Forbidden."""
        token_owner_b = create_access_token(data={"sub": "6"})
        headers = {"Authorization": f"Bearer {token_owner_b}"}

        response = owner_client.put("/facilities/1", headers=headers)
        assert response.status_code == 403
        assert "Bạn không có quyền quản lý cơ sở thể thao này" in response.json()["detail"]

    def test_customer_accessing_facility_returns_403(self, owner_client):
        """Khách hàng không sở hữu cơ sở phải trả về 403 Forbidden."""
        token_customer = create_access_token(data={"sub": "4"})
        headers = {"Authorization": f"Bearer {token_customer}"}

        response = owner_client.put("/facilities/1", headers=headers)
        assert response.status_code == 403
        assert "Bạn không có quyền quản lý cơ sở thể thao này" in response.json()["detail"]

    def test_correct_owner_accessing_facility_success(self, owner_client):
        """Chính chủ sở hữu (Owner A) truy cập cơ sở thành công (200 OK)."""
        token_owner_a = create_access_token(data={"sub": "3"})
        headers = {"Authorization": f"Bearer {token_owner_a}"}

        response = owner_client.put("/facilities/1", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == 1
        assert data["owner_id"] == 3
        assert data["name"] == "Cơ Sở Cầu Lông & Pickleball Kỳ Hòa"


class TestCourtOwnerDependency:
    """Kiểm tra dependency get_court_for_owner thông qua cơ sở cha (SCB-77)."""

    def test_court_not_found_returns_404(self, owner_client):
        """YÊU CẦU: Sân con không tồn tại trong CSDL phải trả về 404 Not Found."""
        token_owner_a = create_access_token(data={"sub": "3"})
        headers = {"Authorization": f"Bearer {token_owner_a}"}

        response = owner_client.put("/courts/9999", headers=headers)
        assert response.status_code == 404
        assert "không tồn tại" in response.json()["detail"]

    def test_other_owner_accessing_court_returns_403(self, owner_client):
        """YÊU CẦU: Chủ khác (Owner B) truy cập sân con của Owner A phải trả về 403 Forbidden."""
        token_owner_b = create_access_token(data={"sub": "6"})
        headers = {"Authorization": f"Bearer {token_owner_b}"}

        response = owner_client.put("/courts/1", headers=headers)
        assert response.status_code == 403
        assert "Bạn không có quyền quản lý sân con này" in response.json()["detail"]

    def test_customer_accessing_court_returns_403(self, owner_client):
        """Khách hàng không sở hữu sân con phải trả về 403 Forbidden."""
        token_customer = create_access_token(data={"sub": "4"})
        headers = {"Authorization": f"Bearer {token_customer}"}

        response = owner_client.put("/courts/1", headers=headers)
        assert response.status_code == 403
        assert "Bạn không có quyền quản lý sân con này" in response.json()["detail"]

    def test_correct_owner_accessing_court_success(self, owner_client):
        """Chính chủ sở hữu (Owner A) truy cập sân con thuộc cơ sở của mình thành công (200 OK)."""
        token_owner_a = create_access_token(data={"sub": "3"})
        headers = {"Authorization": f"Bearer {token_owner_a}"}

        response = owner_client.put("/courts/1", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == 1
        assert data["facility_id"] == 1
        assert data["name"] == "Sân Cầu Lông 1 (Thảm Yonex)"
        assert data["facility_name"] == "Cơ Sở Cầu Lông & Pickleball Kỳ Hòa"

