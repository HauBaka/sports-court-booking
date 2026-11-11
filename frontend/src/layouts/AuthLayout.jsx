import { Link, Outlet, useLocation } from "react-router-dom";
import "../styles/auth.css";

export default function AuthLayout() {
  const { pathname } = useLocation();
  const isRegister = pathname === "/register";

  return (
    <div className="auth-page">
      <header className="auth-header">
        <Link to="/" className="auth-brand">
          SCB
        </Link>
        <p>
          {isRegister ? (
            <>
              Đã có tài khoản? <Link to="/login">Đăng nhập</Link>
            </>
          ) : (
            <>
              Chưa có tài khoản? <Link to="/register">Đăng ký</Link>
            </>
          )}
        </p>
      </header>
      <main className="auth-main">
        <Outlet />
      </main>
    </div>
  );
}
