import { useUser } from "../context/UserContext";

const ROLE_LABEL = {
  customer: "Khách hàng",
  owner: "Chủ sân",
  admin: "Quản trị viên",
};

export default function ProfilePage() {
  const { user, loading } = useUser();

  if (loading) return <p style={{ padding: 24 }}>Đang tải...</p>;
  if (!user) return <p style={{ padding: 24 }}>Bạn chưa đăng nhập.</p>;

  return (
    <div style={{ maxWidth: 480, margin: "32px auto", padding: "0 16px" }}>
      <h2 style={{ marginBottom: 20 }}>Thông tin tài khoản</h2>

      <div className="profile-card">
        <Row label="Họ và tên" value={user.name} />
        <Row label="Email" value={user.email} />
        <Row label="Số điện thoại" value={user.phone} />
        <Row label="Vai trò" value={ROLE_LABEL[user.role] ?? user.role} />
        {user.wallet != null && (
          <Row
            label="Số dư ví"
            value={user.wallet.balance.toLocaleString("vi-VN") + " đ"}
            highlight
          />
        )}
      </div>
    </div>
  );
}

function Row({ label, value, highlight }) {
  return (
    <div className="profile-row">
      <span className="profile-label">{label}</span>
      <span className={highlight ? "profile-value highlight" : "profile-value"}>{value}</span>
    </div>
  );
}
