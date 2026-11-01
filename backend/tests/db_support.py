# pyright: reportGeneralTypeIssues=false, reportAttributeAccessIssue=false
from datetime import time
from typing import Generator, Iterator

from fastapi.testclient import TestClient
from sqlalchemy import BigInteger, create_engine
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.deps import get_db
from app.core.database import Base
from app.core.security import create_access_token, hash_password
from app.main import app
from app.models.facility import Facility
from app.models.user import Role, User, UserRole


# SQLite chỉ autoincrement với INTEGER PRIMARY KEY nên biên dịch BigInteger thành INTEGER
@compiles(BigInteger, "sqlite")
def _bigint_as_integer(type_, compiler, **kw):
    return "INTEGER"


engine = create_engine(
    "sqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

ADMIN_ID = 2
OWNER_A_ID = 3
CUSTOMER_ID = 4
OWNER_B_ID = 6
FACILITY_A_ID = 1  # thuộc chủ sân A
FACILITY_B_ID = 2  # thuộc chủ sân B


def override_get_db() -> Generator[Session, None, None]:
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


def auth_header(user_id: int) -> dict:
    token = create_access_token(data={"sub": str(user_id)})
    return {"Authorization": f"Bearer {token}"}


def seed_users_and_facilities(db: Session) -> None:
    db.add_all(
        [
            Role(id=1, name="CUSTOMER", description="Khách hàng"),
            Role(id=2, name="OWNER", description="Chủ sân"),
            Role(id=3, name="ADMIN", description="Quản trị viên"),
        ]
    )
    db.commit()

    pwd_hash = hash_password("TestPass123@")
    db.add_all(
        [
            User(id=ADMIN_ID, name="Admin", email="admin@scb.vn", phone="0900000001", password_hash=pwd_hash, is_active=True),
            User(id=OWNER_A_ID, name="Chủ sân A", email="owner.a@scb.vn", phone="0900000002", password_hash=pwd_hash, is_active=True),
            User(id=CUSTOMER_ID, name="Khách hàng", email="customer@scb.vn", phone="0900000003", password_hash=pwd_hash, is_active=True),
            User(id=OWNER_B_ID, name="Chủ sân B", email="owner.b@scb.vn", phone="0900000006", password_hash=pwd_hash, is_active=True),
        ]
    )
    db.commit()

    db.add_all(
        [
            UserRole(user_id=ADMIN_ID, role_id=3),
            UserRole(user_id=OWNER_A_ID, role_id=2),
            UserRole(user_id=CUSTOMER_ID, role_id=1),
            UserRole(user_id=OWNER_B_ID, role_id=2),
        ]
    )
    db.commit()

    db.add_all(
        [
            Facility(id=FACILITY_A_ID, owner_id=OWNER_A_ID, name="Cơ sở A", address="1 Đường A", city="TP.HCM",
                     open_time=time(6, 0), close_time=time(23, 0), is_active=True),
            Facility(id=FACILITY_B_ID, owner_id=OWNER_B_ID, name="Cơ sở B", address="2 Đường B", city="Hà Nội",
                     open_time=time(7, 0), close_time=time(22, 0), is_active=True),
        ]
    )
    db.commit()


def api_client() -> Iterator[TestClient]:
    """
    Tạo bảng + dữ liệu nền, gán get_db trỏ vào SQLite in-memory và trả lại override cũ khi xong.
    test_facilities_courts.py gán override ở mức import nên không được ghi đè vĩnh viễn.
    """
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    seed_users_and_facilities(db)
    db.close()

    previous = app.dependency_overrides.get(get_db)
    app.dependency_overrides[get_db] = override_get_db
    try:
        with TestClient(app) as test_client:
            yield test_client
    finally:
        if previous is None:
            app.dependency_overrides.pop(get_db, None)
        else:
            app.dependency_overrides[get_db] = previous
        Base.metadata.drop_all(bind=engine)
