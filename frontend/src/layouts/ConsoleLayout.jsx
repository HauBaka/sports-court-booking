import { useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate, useOutletContext } from "react-router-dom";
import { useUser } from "../context/UserContext";
import { useRole } from "../context/RoleContext";
import { logout } from "../services/authService";
import Icon from "../components/ui/Icon";
import Logo from "../components/ui/Logo";

/** Chuyển tên thành chữ viết tắt. */
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

/** Cấu hình menu bên trái theo role. */
const SIDE = {
  owner: {
    title: "Quản lý sân",
    items: [
      { to: "/owner/facilities", end: true, icon: "home",   label: "Cơ sở của tôi" },
      { to: "/owner/pricing",              icon: "tag",    label: "Bảng giá và hệ số" },
      { to: "/owner/wallet",                   icon: "wallet", label: "Ví chủ sân" },
    ],
    customerItems: [],
  },
  admin: {
    title: "Quản trị",
    items: [
      { to: "/admin",          end: true, icon: "gift", label: "Cấp tiền vào ví" },
      { to: "/admin/holidays",            icon: "sun",  label: "Danh mục ngày lễ" },
      { to: "/health",                    icon: "info", label: "Health check" },
    ],
    customerItems: [],
  },
};

function UserMenu() {
  const { user, clearUser } = useUser();
  const { setRole } = useRole();
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
            <div className="small muted">{user.email}</div>
          </div>
          <button className="item" onClick={handleLogout}>
            Đăng xuất <Icon name="logout" size={16} />
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * ConsoleLayout — layout có sidebar dọc cho owner/admin.
 * @param {"owner"|"admin"} role
 */
export default function ConsoleLayout({ role }) {
  const { user } = useUser();
  const outletCtx = useOutletContext(); // context từ RequireRole ({ user })
  const [open, setOpen] = useState(false);
  const [mini, setMini] = useState(
    () => localStorage.getItem("scb-side-mini") === "1"
  );
  const loc = useLocation();

  useEffect(() => {
    setOpen(false);
    window.scrollTo(0, 0);
  }, [loc.pathname]);

  useEffect(() => {
    localStorage.setItem("scb-side-mini", mini ? "1" : "0");
  }, [mini]);

  const side = SIDE[role];
  const balance = user?.wallet?.balance ?? null;

  const toggle = () =>
    matchMedia("(max-width: 1023px)").matches
      ? setOpen(true)
      : setMini(!mini);

  const SideLink = ({ to, icon, label, end }) => (
    <NavLink to={to} end={end} title={mini ? label : undefined}>
      <Icon name={icon} />
      <span className="side__txt">{label}</span>
    </NavLink>
  );

  return (
    <div className={"shell" + (mini ? " shell--mini" : "")}>
      {/* Overlay khi sidebar mở trên mobile */}
      {open && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 29,
            background: "rgba(10,10,10,.32)",
          }}
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        className={"side" + (open ? " open" : "")}
        aria-label={side.title}
      >
        <Logo to={null} />

        <div className="side__label">{side.title}</div>
        {side.items.map((i) => (
          <SideLink key={i.to} {...i} />
        ))}

        {side.customerItems.length > 0 && (
          <>
            <div className="side__label">Khách hàng</div>
            {side.customerItems.map((i) => (
              <SideLink key={i.to} {...i} />
            ))}
          </>
        )}

        <div className="side__foot small" title={mini ? "Số dư ví" : undefined}>
          {!mini && <div className="muted side__txt">Số dư ví</div>}
          <div className="mono side__bal">
            <Icon name="wallet" size={16} className="side__ico" />
            <span className="side__txt">{vnd(balance)}</span>
          </div>
        </div>
      </aside>

      <div className="main">
        <div className="main__top">
          <div className="row">
            <button
              className="icon-btn"
              onClick={toggle}
              aria-label={mini ? "Mở rộng thanh bên" : "Thu gọn thanh bên"}
              aria-expanded={!mini}
            >
              <Icon name="panel" />
            </button>
            <span className="muted small">
              {side.title}
              {user?.name ? ` · ${user.name}` : ""}
            </span>
          </div>
          <UserMenu />
        </div>

        <div className="main__body route" key={loc.pathname}>
          <Outlet context={outletCtx} />
        </div>
      </div>
    </div>
  );
}
