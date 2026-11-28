import { Navigate } from "react-router-dom";
import { useRole } from "../context/RoleContext";

/**
 * Trang / — redirect về trang chính theo role.
 * Customer → /courts, Owner → /owner/facilities, Admin → /admin
 */
export default function HomePage() {
  const { role } = useRole();

  if (role === "owner") return <Navigate to="/owner/facilities" replace />;
  if (role === "admin") return <Navigate to="/admin" replace />;
  return <Navigate to="/courts" replace />;
}
