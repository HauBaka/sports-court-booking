import { NavLink, Outlet } from "react-router-dom";
import { useRole } from "../context/RoleContext";

const MENU_BY_ROLE = {
  customer: [{ to: "/", label: "Trang chủ" }],
  owner: [{ to: "/", label: "Trang chủ" }],
  admin: [
    { to: "/", label: "Trang chủ" },
    { to: "/health", label: "Healthcheck" },
  ],
};

export default function MainLayout() {
  const { role, setRole } = useRole();
  const menu = MENU_BY_ROLE[role] ?? [];

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
        <select value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="customer">Khách hàng</option>
          <option value="owner">Chủ sân</option>
          <option value="admin">Admin</option>
        </select>
      </header>
      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}