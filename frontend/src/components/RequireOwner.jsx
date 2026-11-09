import { useEffect, useState } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { getMe } from "../services/authService";

// Bọc các route của chủ sân: chưa đăng nhập thì về /login, không phải owner thì báo không có quyền.
// Truyền người dùng hiện tại xuống trang con qua useOutletContext().
export default function RequireOwner() {
  const hasToken = Boolean(localStorage.getItem("access_token"));
  const [state, setState] = useState({ status: "loading", user: null, message: "" });

  useEffect(() => {
    if (!hasToken) return undefined;
    let cancelled = false;
    getMe()
      .then((res) => {
        if (!cancelled) setState({ status: "ready", user: res.data, message: "" });
      })
      .catch((err) => {
        if (!cancelled) {
          setState({ status: "error", user: null, message: err.message || "Không lấy được thông tin tài khoản." });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [hasToken]);

  if (!hasToken) return <Navigate to="/login" replace />;
  if (state.status === "loading") return <p>Đang tải...</p>;
  if (state.status === "error") {
    return (
      <p className="notice error" role="alert">
        {state.message}
      </p>
    );
  }
  if (state.user.role !== "owner") {
    return (
      <p className="notice error" role="alert">
        Trang này chỉ dành cho chủ sân.
      </p>
    );
  }
  return <Outlet context={{ user: state.user }} />;
}
