import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Field from "../components/Field";
import PasswordInput from "../components/PasswordInput";
import { register } from "../services/authService";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Tên field backend trả trong details của VALIDATION_ERROR
const API_FIELDS = ["name", "phone", "email", "password", "role"];

function validate(f) {
  const e = {};
  if (!f.name.trim()) e.name = "Vui lòng nhập họ và tên.";
  if (!/^\d{10}$/.test(f.phone)) e.phone = "Số điện thoại phải có 10 chữ số.";
  if (!EMAIL_RE.test(f.email.trim())) e.email = "Email không hợp lệ.";
  if (f.password.length < 8) e.password = "Mật khẩu tối thiểu 8 ký tự.";
  if (f.confirm !== f.password) e.confirm = "Mật khẩu nhập lại không khớp.";
  if (!f.agree) e.agree = "Bạn cần đồng ý Điều khoản sử dụng.";
  return e;
}

export default function RegisterPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    role: "customer",
    password: "",
    confirm: "",
    agree: false,
  });
  const [errors, setErrors] = useState({});
  const [apiError, setApiError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const set = (key) => (e) =>
    setForm((f) => ({ ...f, [key]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));

  const setPhone = (e) =>
    setForm((f) => ({ ...f, phone: e.target.value.replace(/\D/g, "").slice(0, 10) }));

  const showApiError = (err) => {
    if (err.code === "AUTH_EMAIL_EXISTS") return setErrors({ email: err.message });
    if (err.code === "AUTH_PHONE_EXISTS") return setErrors({ phone: err.message });
    if (err.code === "VALIDATION_ERROR" && Array.isArray(err.details)) {
      const fieldErrors = {};
      for (const { field, issue } of err.details) {
        if (API_FIELDS.includes(field)) fieldErrors[field] = issue;
      }
      if (Object.keys(fieldErrors).length) return setErrors(fieldErrors);
    }
    return setApiError(err.message || "Đăng ký thất bại. Vui lòng thử lại.");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate(form);
    setErrors(errs);
    setApiError("");
    if (Object.keys(errs).length) return;

    setSubmitting(true);
    try {
      await register({
        name: form.name,
        phone: form.phone,
        email: form.email,
        password: form.password,
        role: form.role,
      });
      navigate("/login", { state: { registered: true } });
    } catch (err) {
      showApiError(err);
    } finally {
      setSubmitting(false);
    }
  };

  const cls = (key) => `input${errors[key] ? " invalid" : ""}`;

  return (
    <form className="auth-card" onSubmit={handleSubmit} noValidate>
      <h1>Tạo tài khoản</h1>

      {apiError && (
        <p className="notice error" role="alert">
          {apiError}
        </p>
      )}

      <Field label="Họ và tên" htmlFor="name" error={errors.name}>
        <input
          id="name"
          className={cls("name")}
          type="text"
          placeholder="Nguyễn Văn Minh"
          autoComplete="name"
          value={form.name}
          onChange={set("name")}
        />
      </Field>

      <Field label="Số điện thoại" htmlFor="phone" error={errors.phone}>
        <input
          id="phone"
          className={cls("phone")}
          type="tel"
          inputMode="numeric"
          placeholder="09xx xxx xxx"
          autoComplete="tel"
          value={form.phone}
          onChange={setPhone}
        />
      </Field>

      <Field label="Email" htmlFor="email" error={errors.email}>
        <input
          id="email"
          className={cls("email")}
          type="email"
          placeholder="minh@email.com"
          autoComplete="email"
          value={form.email}
          onChange={set("email")}
        />
      </Field>

      <Field label="Vai trò" htmlFor="role" error={errors.role}>
        <select id="role" className={cls("role")} value={form.role} onChange={set("role")}>
          <option value="customer">Khách hàng</option>
          <option value="owner">Chủ sân</option>
        </select>
      </Field>

      <Field label="Mật khẩu" htmlFor="password" error={errors.password}>
        <PasswordInput
          id="password"
          className={cls("password")}
          placeholder="••••••••"
          autoComplete="new-password"
          value={form.password}
          onChange={set("password")}
        />
      </Field>

      <Field label="Nhập lại mật khẩu" htmlFor="confirm" error={errors.confirm}>
        <PasswordInput
          id="confirm"
          className={cls("confirm")}
          placeholder="••••••••"
          autoComplete="new-password"
          value={form.confirm}
          onChange={set("confirm")}
        />
      </Field>

      <div className="field">
        <label className="check">
          <input type="checkbox" checked={form.agree} onChange={set("agree")} />
          Tôi đồng ý Điều khoản sử dụng
        </label>
        {errors.agree && (
          <p className="field-error" role="alert">
            {errors.agree}
          </p>
        )}
      </div>

      <button className="btn btn-block" type="submit" disabled={submitting}>
        {submitting ? "Đang đăng ký..." : "Đăng ký"}
      </button>

      <p className="auth-foot">
        Đã có tài khoản? <Link to="/login">Đăng nhập</Link>
      </p>
    </form>
  );
}
