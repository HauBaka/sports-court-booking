import { useEffect, useRef, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useUser } from "../context/UserContext";
import { useRole } from "../context/RoleContext";
import { logout } from "../services/authService";
import Icon from "../components/ui/Icon";
import Logo from "../components/ui/Logo";

/** Chuyển tên thành chữ viết tắt (ví dụ "Nguyễn Văn A" → "NVA"). */
function initials(name = "") {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 3)
    .map((w) => w[0].toUpperCase())
    .join("");
}

/** Format số dư ví theo VND. */
function vnd(n) {
  if (n == null) return "—";
  return n.toLocaleString("vi-VN") + " ₫";
}

function UserMenu() {
  const { user, clearUser } = useUser();
  const { role, setRole } = useRole();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const nav = useNavigate();

  useEffect(() => {
    const close = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const handleLogout = async () => {
    setOpen(false);
    try { await logout(); } catch { /* bỏ qua lỗi mạng */ }
    localStorage.removeItem("access_token");
    setRole(null);
    clearUser();
    nav("/login", { replace: true });
  };

  if (!user) return null;

  const balance = user.wallet?.balance ?? null;
  const ROLE_LABEL = { customer: "Khách hàng", owner: "Chủ sân", admin: "Admin" };

  return (
    <div className="menu" ref={ref}>
      <button
        className="menu__btn"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-label="Tài khoản"
      >
        <span className="avatar">{initials(user.name)}</span>
      </button>

      {open && (
        <div className="menu__panel">
          <div className="menu__head">
            <div style={{ fontWeight: 500 }}>{user.name}</div>
            <div className="small muted">
              {user.email} · {ROLE_LABEL[role] ?? role}
            </div>
            {balance != null && (
              <div className="small" style={{ marginTop: 8 }}>
                Ví:{" "}
                <b className="mono" style={{ color: "var(--accent)", fontWeight: 500 }}>
                  {vnd(balance)}
                </b>
              </div>
            )}
          </div>

          <Link to="/profile" onClick={() => setOpen(false)}>
            Hồ sơ <Icon name="user" size={16} />
          </Link>
          {role === "customer" && (
            <Link to="/wallet" onClick={() => setOpen(false)}>
              Ví và giao dịch <Icon name="wallet" size={16} />
            </Link>
          )}
          {role === "owner" && (
            <Link to="/owner/facilities" onClick={() => setOpen(false)}>
              Trang chủ sân <Icon name="court" size={16} />
            </Link>
          )}
          {role === "admin" && (
            <Link to="/admin" onClick={() => setOpen(false)}>
              Trang quản trị <Icon name="shield" size={16} />
            </Link>
          )}

          <button className="item" onClick={handleLogout}>
            Đăng xuất <Icon name="logout" size={16} />
          </button>
        </div>
      )}
    </div>
  );
}

export default function CustomerLayout() {
  const { user } = useUser();
  const { role } = useRole();
  const [open, setOpen] = useState(false);
  const loc = useLocation();

  useEffect(() => {
    setOpen(false);
    window.scrollTo(0, 0);
  }, [loc.pathname]);

  const balance = user?.wallet?.balance ?? null;

  return (
    <>
      <header className="topnav">
        <div className="wrap topnav__bar">
          <Logo />

          <nav
            className={"topnav__links" + (open ? " open" : "")}
            aria-label="Chính"
          >
            <NavLink to="/courts">Tìm sân</NavLink>
            <NavLink to="/wallet">Ví</NavLink>
          </nav>

          <div className="topnav__right">
            {user ? (
              <>
                {role !== "admin" && balance != null && (
                  <Link to="/wallet" className="wallet-pill">
                    <Icon name="wallet" size={15} />
                    Ví <b>{vnd(balance)}</b>
                  </Link>
                )}
                {role === "owner" && (
                  <Link className="btn btn--sm" to="/owner/facilities">
                    Trang chủ sân
                  </Link>
                )}
                {role === "admin" && (
                  <Link className="btn btn--sm" to="/admin">
                    Quản trị
                  </Link>
                )}
                <UserMenu />
              </>
            ) : (
              <>
                <Link className="btn btn--ghost btn--sm" to="/login">
                  Đăng nhập
                </Link>
                <Link className="btn btn--primary btn--sm" to="/register">
                  Đăng ký
                </Link>
              </>
            )}
            <button
              className="icon-btn burger"
              onClick={() => setOpen(!open)}
              aria-label="Mở menu"
              aria-expanded={open}
            >
              <Icon name="menu" />
            </button>
          </div>
        </div>
      </header>

      <div className="route" key={loc.pathname}>
        <Outlet />
      </div>

      {/* Điện thoại: thanh tab ở đáy */}
      <nav className="tabbar" aria-label="Chính">
        {[
          ["/courts", "search", "Tìm sân"],
          ["/wallet", "wallet", "Ví"],
        ].map(([to, ic, label]) => (
          <NavLink key={to} to={to}>
            <Icon name={ic} size={20} />
            {label}
          </NavLink>
        ))}
      </nav>
    </>
  );
}
