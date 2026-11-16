import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Field from "../components/Field";
import PasswordInput from "../components/PasswordInput";
import OtpVerify from "../components/OtpVerify";
import useOtpChallenge from "../hooks/useOtpChallenge";
import { register } from "../services/authService";
import { isOtpDead, isOtpError, otpErrorMessage, validateOtpCode } from "../utils/otp";
import { validateNewPassword } from "../utils/password";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Tên field backend trả trong details của VALIDATION_ERROR
const API_FIELDS = ["name", "phone", "email", "password", "role"];

function validate(f) {
  const e = {};
  if (!f.name.trim()) e.name = "Vui lòng nhập họ và tên.";
  if (!/^\d{10}$/.test(f.phone)) e.phone = "Số điện thoại phải có 10 chữ số.";
  if (!EMAIL_RE.test(f.email.trim())) e.email = "Email không hợp lệ.";
  const passwordError = validateNewPassword(f.password);
  if (passwordError) e.password = passwordError;
  if (f.confirm !== f.password) e.confirm = "Mật khẩu nhập lại không khớp.";
  if (!f.agree) e.agree = "Bạn cần đồng ý Điều khoản sử dụng.";
  return e;
}

// 422 mà lỗi nằm ở ô otp_code (không đúng 6 chữ số)
const otpFieldInvalid = (err) =>
  err.code === "VALIDATION_ERROR" && Array.isArray(err.details) && err.details.some((d) => d.field === "otp_code");

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
  // "form": nhập thông tin; "otp": nhập mã xác nhận gửi qua email
  const [step, setStep] = useState("form");
  const otp = useOtpChallenge("REGISTER");

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

  // Bước 1: kiểm tra form rồi gửi OTP tới email
  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate(form);
    setErrors(errs);
    setApiError("");
    if (Object.keys(errs).length) return;

    setSubmitting(true);
    const err = await otp.send(form.email);
    setSubmitting(false);
    if (!err) return setStep("otp");
    // Vừa gửi mã cách đây chưa tới 60 giây: người dùng có thể đã có mã trong hộp thư.
    if (err.code === "AUTH_OTP_TOO_SOON") {
      otp.setError(otpErrorMessage(err));
      return setStep("otp");
    }
    showApiError(err);
  };

  const handleResend = async () => {
    const err = await otp.send(form.email, { resend: true });
    if (err) otp.setError(otpErrorMessage(err));
  };

  const backToForm = () => {
    otp.reset();
    setStep("form");
  };

  // Bước 2: gửi thông tin đăng ký kèm mã OTP
  const handleConfirm = async (e) => {
    e.preventDefault();
    const codeError = validateOtpCode(otp.code);
    otp.setError(codeError);
    if (codeError) return;

    setSubmitting(true);
    try {
      await register({
        name: form.name,
        phone: form.phone,
        email: form.email,
        password: form.password,
        role: form.role,
        otp_code: otp.code,
      });
      navigate("/login", { state: { registered: true } });
    } catch (err) {
      if (isOtpError(err) || otpFieldInvalid(err)) {
        otp.setError(otpErrorMessage(err));
        if (isOtpDead(err)) otp.setCode("");
      } else {
        // Lỗi thuộc về thông tin ở bước 1 (trùng số điện thoại, sai định dạng...): quay lại form để sửa.
        otp.reset();
        setStep("form");
        showApiError(err);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const cls = (key) => `input${errors[key] ? " invalid" : ""}`;

  if (step === "otp") {
    return (
      <form className="auth-card" onSubmit={handleConfirm} noValidate>
        <h1>Xác nhận email</h1>

        <OtpVerify
          lead="Mã gồm 6 chữ số đã được gửi tới"
          email={form.email.trim()}
          code={otp.code}
          onCodeChange={otp.setCode}
          error={otp.error}
          notice={otp.notice}
          seconds={otp.seconds}
          sending={otp.sending}
          onResend={handleResend}
          onChangeEmail={backToForm}
        />

        <button className="btn btn-block" type="submit" disabled={submitting}>
          {submitting ? "Đang đăng ký..." : "Xác nhận và đăng ký"}
        </button>
      </form>
    );
  }

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
        {submitting ? "Đang gửi mã..." : "Đăng ký"}
      </button>

      <p className="auth-foot">
        Đã có tài khoản? <Link to="/login">Đăng nhập</Link>
      </p>
    </form>
  );
}
