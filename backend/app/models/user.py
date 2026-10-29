from datetime import datetime, timezone
from typing import List
from sqlalchemy import BigInteger, Boolean, Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import relationship
from app.core.database import Base


class Role(Base):
    __tablename__ = "roles"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(50), unique=True, nullable=False)
    description = Column(String(255), nullable=True)

    users = relationship("User", secondary="user_roles", back_populates="roles")

    def __repr__(self) -> str:
        return f"<Role id={self.id} name={self.name}>"


class UserRole(Base):
    __tablename__ = "user_roles"

    user_id = Column(BigInteger, ForeignKey("users.id"), primary_key=True)
    role_id = Column(Integer, ForeignKey("roles.id"), primary_key=True)
    granted_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)


class User(Base):
    __tablename__ = "users"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    name = Column(String(255), nullable=False)
    email = Column(String(255), unique=True, nullable=False)
    phone = Column(String(20), unique=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    is_system = Column(Boolean, default=False, nullable=False)
    avatar_url = Column(String(512), nullable=True)

    roles = relationship("Role", secondary="user_roles", back_populates="users", lazy="joined")

    @property
    def role_names(self) -> List[str]:
        """Danh sách tên các vai trò của người dùng (dạng chữ thường để chuẩn hóa so sánh)."""
        return [r.name.lower() for r in self.roles]

    def has_role(self, role_name: str) -> bool:
        """Kiểm tra người dùng có vai trò chỉ định hay không (không phân biệt hoa thường)."""
        return role_name.strip().lower() in self.role_names

    def __repr__(self) -> str:
        return f"<User id={self.id} email={self.email} is_active={self.is_active}>"

