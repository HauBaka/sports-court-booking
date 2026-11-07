import { Link } from "react-router-dom";
import { useRole } from "../context/RoleContext";

const HOME_BY_ROLE = {
  owner: "/owner/facilities",
  admin: "/admin",
  customer: "/",
};

export default function UnauthorizedPage() {
  const { role } = useRole();
  const home = HOME_BY_ROLE[role] ?? "/";
  return (
    <div style={{ padding: "40px 24px", textAlign: "center" }}>
      <h1 style={{ fontSize: 48, margin: "0 0 8px" }}>403</h1>
      <p style={{ fontSize: 18, marginBottom: 24 }}>Bạn không có quyền truy cập trang này.</p>
      <Link to={home} style={{ color: "#15803d", fontWeight: 600 }}>
        &larr; Quay về trang của bạn
      </Link>
    </div>
  );
}
