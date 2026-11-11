import { Navigate, Outlet } from "react-router-dom";

/**
 * Redirect ve /login neu chua co token.
 * Khong goi API - chi kiem tra token trong localStorage de tranh delay.
 */
export default function RequireAuth() {
  const hasToken = Boolean(localStorage.getItem("access_token"));
  if (!hasToken) return <Navigate to="/login" replace />;
  return <Outlet />;
}
