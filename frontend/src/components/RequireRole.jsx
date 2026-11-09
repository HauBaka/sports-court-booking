import { useEffect, useState } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { getMe } from "../services/authService";

/**
 * Bao ve route theo role.
 * - Chua dang nhap -> /login
 * - Dung nhap nhung sai role -> /unauthorized
 * - Dung role -> render <Outlet context={{ user }} />
 *
 * @param {string | string[]} roles - role hoac mang role duoc phep
 */
export default function RequireRole({ roles }) {
  const allowed = Array.isArray(roles) ? roles : [roles];
  const hasToken = Boolean(localStorage.getItem("access_token"));
  const [state, setState] = useState({ status: "loading", user: null, message: "" });

  useEffect(() => {
    if (!hasToken) return;
    let cancelled = false;
    getMe()
      .then((res) => {
        if (!cancelled) setState({ status: "ready", user: res.data, message: "" });
      })
      .catch((err) => {
        if (!cancelled)
          setState({ status: "error", user: null, message: err.message || "Không lấy được thông tin tài khoản." });
      });
    return () => { cancelled = true; };
  }, [hasToken]);

  if (!hasToken) return <Navigate to="/login" replace />;
  if (state.status === "loading") return <p>Đang tải...</p>;
  if (state.status === "error")
    return <p className="notice error" role="alert">{state.message}</p>;
  if (!allowed.includes(state.user?.role))
    return <Navigate to="/unauthorized" replace />;
  return <Outlet context={{ user: state.user }} />;
}
