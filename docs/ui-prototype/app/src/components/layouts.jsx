import { useEffect, useRef, useState } from "react";
import { Link, NavLink, Navigate, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useStore } from "../data/store";
import { vnd, initials } from "../lib/format";
import { Count, Icon, Logo } from "./ui";
import NotFoundPage from "../pages/NotFoundPage";

const ROLE_NAME = { customer: "Khách hàng", owner: "Chủ sân", admin: "Admin" };

function UserMenu() {
  const { me, state, api } = useStore();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const nav = useNavigate();
  useEffect(() => {
    const close = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);
  const home = { customer: "/tim-san", owner: "/chu-san", admin: "/admin" };
  const switchTo = (role) => { api.loginAs(role); setOpen(false); nav(home[role]); };
  return (
    <div className="menu" ref={ref}>
      <button className="menu__btn" onClick={() => setOpen(!open)} aria-expanded={open} aria-label="Tài khoản">
        <span className="avatar">{initials(me.name)}</span>
      </button>
      {open && (
        <div className="menu__panel">
          <div className="menu__head">
            <div style={{ fontWeight: 500 }}>{me.name}</div>
            <div className="small muted">{me.email} · {ROLE_NAME[me.role]}</div>
            <div className="small" style={{ marginTop: 8 }}>Ví: <b className="mono" style={{ color: "var(--accent)", fontWeight: 500 }}>{vnd(state.wallets[me.id] ?? 0)}</b></div>
          </div>
          <Link to="/ho-so" onClick={() => setOpen(false)}>Hồ sơ <Icon name="user" size={16} /></Link>
          {me.role === "customer" && <Link to="/vi" onClick={() => setOpen(false)}>Ví và giao dịch <Icon name="wallet" size={16} /></Link>}
          {me.role === "owner" && <Link to="/chu-san" onClick={() => setOpen(false)}>Trang chủ sân <Icon name="court" size={16} /></Link>}
          {me.role === "admin" && <Link to="/admin" onClick={() => setOpen(false)}>Trang quản trị <Icon name="shield" size={16} /></Link>}
          <div className="menu__label">Xem bản mẫu với vai trò</div>
          {Object.entries(ROLE_NAME).filter(([r]) => r !== me.role).map(([r, n]) => (
            <button key={r} className="item" onClick={() => switchTo(r)}>{n} <Icon name="refresh" size={15} /></button>
          ))}
          <button className="item" onClick={() => { api.logout(); nav("/dang-nhap"); }}>Đăng xuất <Icon name="logout" size={16} /></button>
        </div>
      )}
    </div>
  );
}

export function CustomerLayout() {
  const { me, state } = useStore();
  const [open, setOpen] = useState(false);
  const loc = useLocation();
  useEffect(() => { setOpen(false); window.scrollTo(0, 0); }, [loc.pathname]);
  return (
    <>
      <header className="topnav">
        <div className="wrap topnav__bar">
          <Logo />
          <nav className={"topnav__links" + (open ? " open" : "")} aria-label="Chính">
            <NavLink to="/tim-san">Tìm sân</NavLink>
            <NavLink to="/lich-dat">Lịch đặt của tôi</NavLink>
            <NavLink to="/ghep-doi">Ghép đội</NavLink>
            <NavLink to="/vi">Ví</NavLink>
          </nav>
          <div className="topnav__right">
            {me ? (
              <>
                {me.role !== "admin" && <Link to="/vi" className="wallet-pill"><Icon name="wallet" size={15} />Ví <b><Count value={state.wallets[me.id] ?? 0} /></b></Link>}
                {me.role !== "customer" && <Link className="btn btn--sm" to={me.role === "owner" ? "/chu-san" : "/admin"}>{me.role === "owner" ? "Trang chủ sân" : "Quản trị"}</Link>}
                <UserMenu />
              </>
            ) : (
              <>
                <Link className="btn btn--ghost btn--sm" to="/dang-nhap">Đăng nhập</Link>
                <Link className="btn btn--primary btn--sm" to="/dang-ky">Đăng ký</Link>
              </>
            )}
            <button className="icon-btn burger" onClick={() => setOpen(!open)} aria-label="Mở menu" aria-expanded={open}><Icon name="menu" /></button>
          </div>
        </div>
      </header>
      <div className="route" key={loc.pathname}><Outlet /></div>
      {/* điện thoại: thanh tab ở đáy thay cho menu */}
      <nav className="tabbar" aria-label="Chính">
        {[["/tim-san", "search", "Tìm sân"], ["/lich-dat", "calendar", "Lịch đặt"], ["/ghep-doi", "users", "Ghép đội"], ["/vi", "wallet", "Ví"]].map(([to, ic, l]) => (
          <NavLink key={to} to={to}><Icon name={ic} size={20} />{l}</NavLink>
        ))}
      </nav>
    </>
  );
}

const SIDE = {
  owner: {
    title: "Quản lý sân",
    items: [
      { to: "/chu-san", end: true, icon: "home", label: "Cơ sở của tôi" },
      { to: "/chu-san/lich-dat", icon: "calendar", label: "Lịch đặt theo ngày" },
      { to: "/chu-san/bang-gia", icon: "tag", label: "Bảng giá và hệ số" },
      { to: "/chu-san/dich-vu", icon: "box", label: "Dịch vụ đi kèm" },
      { to: "/chu-san/vi", icon: "wallet", label: "Ví chủ sân" },
    ],
  },
  admin: {
    title: "Quản trị",
    items: [
      { to: "/admin", end: true, icon: "chart", label: "Tổng quan" },
      { to: "/admin/cap-tien", icon: "gift", label: "Cấp tiền vào ví" },
      { to: "/admin/giao-dich", icon: "list", label: "Giao dịch ví" },
      { to: "/admin/don-dat", icon: "calendar", label: "Đơn đặt sân" },
      { to: "/admin/ngay-le", icon: "sun", label: "Danh mục ngày lễ" },
    ],
  },
};

export function ConsoleLayout({ role }) {
  const { me, state } = useStore();
  const [open, setOpen] = useState(false);
  // thanh bên thu gọn còn cột biểu tượng, nhớ lựa chọn giữa các lần vào
  const [mini, setMini] = useState(() => localStorage.getItem("scb-side-mini") === "1");
  const loc = useLocation();
  useEffect(() => { setOpen(false); window.scrollTo(0, 0); }, [loc.pathname]);
  useEffect(() => { localStorage.setItem("scb-side-mini", mini ? "1" : "0"); }, [mini]);
  const side = SIDE[role];
  // màn hẹp mở ngăn kéo, màn rộng thu gọn hoặc mở rộng
  const toggle = () => (matchMedia("(max-width: 1023px)").matches ? setOpen(true) : setMini(!mini));
  const item = (to, icon, label, end) => <NavLink key={to} to={to} end={end} title={mini ? label : undefined}><Icon name={icon} /><span className="side__txt">{label}</span></NavLink>;
  return (
    <div className={"shell" + (mini ? " shell--mini" : "")}>
      <aside className={"side" + (open ? " open" : "")} aria-label={side.title}>
        <Logo to="/tim-san" />
        <div className="side__label">{side.title}</div>
        {side.items.map((i) => item(i.to, i.icon, i.label, i.end))}
        <div className="side__label">Khách hàng</div>
        {item("/tim-san", "search", "Tìm và đặt sân")}
        {role === "owner" && item("/lich-dat", "calendar", "Lịch tôi đặt")}
        <div className="side__foot small" title={mini ? "Số dư ví" : undefined}>
          <div className="muted side__txt">Số dư ví</div>
          <div className="mono side__bal"><Icon name="wallet" size={16} className="side__ico" /><span className="side__txt"><Count value={state.wallets[me.id] ?? 0} /></span></div>
        </div>
      </aside>
      <div className="main">
        <div className="main__top">
          <div className="row">
            <button className="icon-btn" onClick={toggle} aria-label={mini ? "Mở rộng thanh bên" : "Thu gọn thanh bên"} aria-expanded={!mini} title={mini ? "Mở rộng thanh bên" : "Thu gọn thanh bên"}><Icon name="panel" /></button>
            <span className="muted small">{side.title} · {me.name}</span>
          </div>
          <UserMenu />
        </div>
        <div className="main__body route" key={loc.pathname}><Outlet /></div>
      </div>
    </div>
  );
}

export function RequireRole({ roles, children }) {
  const { me } = useStore();
  const loc = useLocation();
  if (!me) return <Navigate to={`/dang-nhap?next=${encodeURIComponent(loc.pathname)}`} replace />;
  // hiện trang báo quyền tại chỗ, không chuyển địa chỉ: đổi vai trò rồi chuyển trang không bị lệnh chuyển này chen ngang
  if (roles && !roles.includes(me.role)) return <NotFoundPage forbidden />;
  return children ?? <Outlet />;
}
