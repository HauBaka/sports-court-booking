import { useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import Icon from "../components/ui/Icon";
import { useRole } from "../context/RoleContext";
import { useUser } from "../context/UserContext";
import { login } from "../services/authService";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const { setRole } = useRole();
  const { fetchUser } = useUser();

  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [show, setShow] = useState(false);
  const [errors, setErrors] = useState({});
  const [apiError, setApiError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const er = {};
    if (!EMAIL_RE.test(email.trim())) er.email = "Email không hợp lệ.";
    if (!pw) er.pw = "Vui lòng nhập mật khẩu.";
    setErrors(er);
    setApiError("");
    if (Object.keys(er).length) return;

    setSubmitting(true);
    try {
      const res = await login({ email: email.trim(), password: pw });
      const HOME = { customer: "/courts", owner: "/owner/facilities", admin: "/admin" };
      const role = res.data.user.role;
      localStorage.setItem("access_token", res.data.access_token);
      setRole(role);
      await fetchUser();
      navigate(HOME[role] ?? "/", { replace: true });
    } catch (err) {
      if (err.code === "AUTH_INVALID_CREDENTIALS") {
        setErrors({ pw: "Email hoặc mật khẩu không chính xác." });
      } else {
        setApiError(err.message || "Đăng nhập thất bại. Vui lòng thử lại.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <h1>Đăng nhập</h1>
      <p className="auth__lead">
        Chưa có tài khoản?{" "}
        <Link className="link" to="/register">Tạo tài khoản mới</Link>
      </p>

      <form className="stack" onSubmit={handleSubmit} noValidate style={{ "--gap": "14px" }}>
        {/* Thông báo từ redirect */}
        {location.state?.registered && (
          <div className="notice notice--ok">
            <Icon name="check" size={16} />
            Đăng ký thành công. Hãy đăng nhập để tiếp tục.
          </div>
        )}
        {location.state?.passwordReset && (
          <div className="notice notice--ok">
            <Icon name="check" size={16} />
            Đặt lại mật khẩu thành công. Hãy đăng nhập bằng mật khẩu mới.
          </div>
        )}
        {params.get("expired") && (
          <div className="notice">
            <Icon name="info" size={16} />
            Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.
          </div>
        )}
        {apiError && (
          <div className="notice notice--danger" role="alert">
            <Icon name="alert" size={16} />
            {apiError}
          </div>
        )}

        {/* Email */}
        <div className="field">
          <label htmlFor="login-email">Email</label>
          <input
            id="login-email"
            className="input"
            type="email"
            autoComplete="email"
            placeholder="ten@gmail.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-invalid={!!errors.email}
          />
          {errors.email && <span className="field__err">{errors.email}</span>}
        </div>

        {/* Mật khẩu */}
        <div className="field">
          <label htmlFor="login-pw">Mật khẩu</label>
          <div className="input-group">
            <input
              id="login-pw"
              className="input"
              type={show ? "text" : "password"}
              autoComplete="current-password"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              aria-invalid={!!errors.pw}
            />
            <button
              type="button"
              className="btn btn--ghost btn--sm input-act"
              onClick={() => setShow(!show)}
            >
              {show ? "Ẩn" : "Hiện"}
            </button>
          </div>
          {errors.pw && <span className="field__err">{errors.pw}</span>}
          <div style={{ textAlign: "right", marginTop: 4 }}>
            <Link className="link small" to="/forgot-password">Quên mật khẩu?</Link>
          </div>
        </div>

        <button
          className="btn btn--primary btn--lg btn--block"
          type="submit"
          disabled={submitting}
        >
          {submitting ? "Đang đăng nhập..." : "Đăng nhập"}
        </button>
      </form>
    </>
  );
}
