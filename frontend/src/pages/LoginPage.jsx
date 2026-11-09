import { useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import Field from "../components/Field";
import PasswordInput from "../components/PasswordInput";
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

  const [form, setForm] = useState({ email: "", password: "" });
  const [errors, setErrors] = useState({});
  const [apiError, setApiError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const set = (key) => (e) =>
    setForm((f) => ({ ...f, [key]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!EMAIL_RE.test(form.email.trim())) errs.email = "Email không hợp lệ.";
    if (!form.password) errs.password = "Vui lòng nhập mật khẩu.";
    setErrors(errs);
    setApiError("");
    if (Object.keys(errs).length) return;

    setSubmitting(true);
    try {
      const res = await login({ email: form.email, password: form.password });
      localStorage.setItem("access_token", res.data.access_token);
      setRole(res.data.user.role);
      await fetchUser();
      navigate("/", { replace: true });
    } catch (err) {
      if (err.code === "AUTH_INVALID_CREDENTIALS") {
        setErrors({ password: "Email hoặc mật khẩu không chính xác." });
      } else {
        setApiError(err.message || "Đăng nhập thất bại. Vui lòng thử lại.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="auth-card" onSubmit={handleSubmit} noValidate>
      <h1>Đăng nhập</h1>

      {location.state?.registered && (
        <p className="notice success">Đăng ký thành công. Hãy đăng nhập để tiếp tục.</p>
      )}
      {params.get("expired") && (
        <p className="notice info">Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.</p>
      )}
      {apiError && (
        <p className="notice error" role="alert">
          {apiError}
        </p>
      )}

      <Field label="Email" htmlFor="email" error={errors.email}>
        <input
          id="email"
          className={`input${errors.email ? " invalid" : ""}`}
          type="email"
          placeholder="minh@email.com"
          autoComplete="email"
          value={form.email}
          onChange={set("email")}
        />
      </Field>

      <Field label="Mật khẩu" htmlFor="password" error={errors.password}>
        <PasswordInput
          id="password"
          className={`input${errors.password ? " invalid" : ""}`}
          placeholder="••••••••"
          autoComplete="current-password"
          value={form.password}
          onChange={set("password")}
        />
      </Field>

      <button className="btn btn-block" type="submit" disabled={submitting}>
        {submitting ? "Đang đăng nhập..." : "Đăng nhập"}
      </button>

      <p className="auth-foot">
        Chưa có tài khoản? <Link to="/register">Đăng ký</Link>
      </p>
    </form>
  );
}
