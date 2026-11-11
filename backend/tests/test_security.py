from datetime import timedelta
import jwt
import pytest
from app.core.config import settings
from app.core.security import (
    create_access_token,
    verify_token,
    hash_password,
    verify_password,
)


class TestJWTHS256:
    """Kiểm tra chức năng tạo và xác thực JWT token sử dụng thuật toán HS256."""

    def test_create_and_verify_valid_token(self):
        """Token hợp lệ tạo ra phải giải mã thành công và chứa đúng thông tin payload."""
        payload_data = {"sub": "user_123", "role": "customer", "email": "user@example.com"}
        token = create_access_token(data=payload_data)

        assert isinstance(token, str)
        assert len(token) > 0

        # Kiểm tra header thuật toán là HS256
        unverified_header = jwt.get_unverified_header(token)
        assert unverified_header["alg"] == "HS256"

        # Giải mã và xác thực token
        decoded = verify_token(token)
        assert decoded["sub"] == "user_123"
        assert decoded["role"] == "customer"
        assert decoded["email"] == "user@example.com"
        assert "exp" in decoded
        assert "iat" in decoded

    def test_token_expiration_rejected(self):
        """YÊU CẦU: Token hết hạn phải bị từ chối (ném ra ExpiredSignatureError)."""
        payload_data = {"sub": "user_expired"}
        # Tạo token với thời hạn âm (đã hết hạn trong quá khứ)
        expired_token = create_access_token(
            data=payload_data,
            expires_delta=timedelta(seconds=-1),
        )

        with pytest.raises(jwt.ExpiredSignatureError):
            verify_token(expired_token)

    def test_token_invalid_signature_rejected(self):
        """YÊU CẦU: Token sai chữ ký phải bị từ chối (ném ra InvalidSignatureError)."""
        payload_data = {"sub": "user_wrong_signature"}
        # Tạo token giả mạo bằng một secret key khác
        fake_secret = "completely_different_fake_secret_key"
        fake_token = jwt.encode(
            {"sub": "user_wrong_signature"},
            fake_secret,
            algorithm="HS256",
        )

        with pytest.raises(jwt.InvalidSignatureError):
            verify_token(fake_token)

    def test_token_tampered_payload_rejected(self):
        """Token bị can thiệp thay đổi payload giữa chừng phải bị từ chối."""
        token = create_access_token(data={"sub": "normal_user", "role": "customer"})
        parts = token.split(".")
        assert len(parts) == 3

        # Thay thế payload bằng payload giả mạo role admin
        fake_payload_b64 = "eyJzdWIiOiAibm9ybWFsX3VzZXIiLCAicm9sZSI6ICJhZG1pbiJ9"
        tampered_token = f"{parts[0]}.{fake_payload_b64}.{parts[2]}"

        with pytest.raises((jwt.InvalidSignatureError, jwt.DecodeError)):
            verify_token(tampered_token)

    def test_custom_expiration_delta(self):
        """Token với expires_delta tùy chỉnh được tính toán chính xác."""
        payload_data = {"sub": "user_custom_exp"}
        delta = timedelta(minutes=15)
        token = create_access_token(data=payload_data, expires_delta=delta)
        decoded = verify_token(token)

        assert decoded["sub"] == "user_custom_exp"
        # Khoảng cách exp - iat xấp xỉ 15 phút (900s)
        duration = decoded["exp"] - decoded["iat"]
        assert 898 <= duration <= 902


class TestBcryptPassword:
    """Kiểm tra chức năng băm và kiểm tra mật khẩu bằng Bcrypt."""

    def test_hash_password_success(self):
        """Băm mật khẩu thành công và trả về chuỗi hash bcrypt ($2b$)."""
        raw_password = "SecurePassword@2026"
        hashed = hash_password(raw_password)

        assert isinstance(hashed, str)
        assert hashed != raw_password
        # Định dạng hash của bcrypt luôn bắt đầu với $2a$, $2b$ hoặc $2y$
        assert hashed.startswith("$2")

    def test_hash_password_salting(self):
        """Hai lần băm cùng một mật khẩu phải sinh ra 2 hash khác nhau do cơ chế salt ngẫu nhiên."""
        raw_password = "SamePassword123"
        hash1 = hash_password(raw_password)
        hash2 = hash_password(raw_password)

        assert hash1 != hash2

    def test_verify_password_correct(self):
        """Kiểm tra đúng mật khẩu phải trả về True."""
        raw_password = "CorrectHorseBatteryStaple"
        hashed = hash_password(raw_password)

        assert verify_password(raw_password, hashed) is True

    def test_verify_password_incorrect(self):
        """Kiểm tra sai mật khẩu phải trả về False."""
        raw_password = "CorrectPassword"
        hashed = hash_password(raw_password)

        assert verify_password("WrongPassword", hashed) is False

    def test_verify_password_with_empty_or_invalid_hash(self):
        """Kiểm tra mật khẩu với hash rỗng hoặc định dạng không hợp lệ phải trả về False an toàn."""
        assert verify_password("password", "") is False
        assert verify_password("", "valid_or_invalid_hash") is False
        assert verify_password("password", "invalid_hash_string") is False

    def test_hash_empty_password_raises_error(self):
        """Băm mật khẩu rỗng phải ném ValueError."""
        with pytest.raises(ValueError):
            hash_password("")

