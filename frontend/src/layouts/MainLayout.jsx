import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useRole } from "../context/RoleContext";
import { useUser } from "../context/UserContext";
import { logout } from "../services/authService";

const MENU_BY_ROLE = {
  customer: [{ to: "/", label: "Trang chủ" }],
  owner: [
    { to: "/", label: "Trang chủ" },
    { to: "/owner/facilities", label: "Cơ sở của tôi" },
  ],
  admin: [
    { to: "/", label: "Trang chủ" },
    { to: "/admin", label: "Quản trị" },
    { to: "/health", label: "Healthcheck" },
  ],
};

function formatBalance(n) {
  if (n == null) return "";
  return n.toLocaleString("vi-VN") + " đ";
}

export default function MainLayout() {
  const { role, setRole } = useRole();
  const { user, clearUser } = useUser();
  const navigate = useNavigate();
  const menu = MENU_BY_ROLE[role] ?? MENU_BY_ROLE.customer;

  const handleLogout = async () => {
    try { await logout(); } catch (_e) { /* bo qua loi mang */ }
    localStorage.removeItem("access_token");
    setRole(null);
    clearUser();
    navigate("/login", { replace: true });
  };

  return (
    <div className="app">
      <header className="navbar">
        <strong>SCB</strong>
        <nav>
          {menu.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) => (isActive ? "active" : "")}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 13 }}>
          {user ? (
            <>
              {user.wallet != null && (
                <span style={{ color: "#86efac", fontWeight: 600 }}>
                  Ví: {formatBalance(user.wallet.balance)}
                </span>
              )}
              <NavLink
                to="/profile"
                style={{ color: "#e2e8f0", textDecoration: "none" }}
                title={user.email}
              >
                {user.name}
              </NavLink>
              <button
                onClick={handleLogout}
                style={{ background: "none", border: "1px solid #475569", color: "#cbd5e1",
                         padding: "4px 12px", borderRadius: 6, cursor: "pointer", fontSize: 13 }}
              >
                Đăng xuất
              </button>
            </>
          ) : (
            <NavLink to="/login" style={{ color: "#cbd5e1" }}>Đăng nhập</NavLink>
          )}
        </div>
      </header>
      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}
