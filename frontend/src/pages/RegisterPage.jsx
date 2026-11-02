import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Field from "../components/Field";
import OtpInput from "../components/OtpInput";
import { register, sendOtp } from "../services/authService";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const OTP_LIFETIME_MS = 5 * 60 * 1000;
const RESEND_AFTER_MS = 45 * 1000;

const mmss = (totalSeconds) => {
  const m = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
  const s = String(totalSeconds % 60).padStart(2, "0");
  return `${m}:${s}`;
};

function validate(f, otp, otpSent) {
  const e = {};
  if (!f.full_name.trim()) e.full_name = "Vui lòng nhập họ và tên.";
  if (!/^\d{10}$/.test(f.phone_number)) e.phone_number = "Số điện thoại phải có 10 chữ số.";
  if (!EMAIL_RE.test(f.email.trim())) e.email = "Email không hợp lệ.";
  if (!otpSent) e.otp = "Bấm Gửi mã OTP để nhận mã qua email.";
  else if (!/^\d{6}$/.test(otp)) e.otp = "Mã OTP gồm 6 chữ số.";
  if (f.password.length < 8) e.password = "Mật khẩu tối thiểu 8 ký tự.";
  if (f.confirm !== f.password) e.confirm = "Mật khẩu nhập lại không khớp.";
  if (!f.agree) e.agree = "Bạn cần đồng ý Điều khoản sử dụng.";
  return e;
}

export default function RegisterPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    full_name: "",
    phone_number: "",
    email: "",
    password: "",
    confirm: "",
    agree: false,
  });
  const [otp, setOtp] = useState("");
  const [timers, setTimers] = useState(null); // { expiresAt, resendAt } sau khi gửi OTP
  const [now, setNow] = useState(() => Date.now());
  const [errors, setErrors] = useState({});
  const [apiError, setApiError] = useState("");
  const [sending, setSending] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!timers) return undefined;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [timers]);

  const expiresIn = timers ? Math.max(0, Math.ceil((timers.expiresAt - now) / 1000)) : 0;
  const resendIn = timers ? Math.max(0, Math.ceil((timers.resendAt - now) / 1000)) : 0;

  const set = (key) => (e) => {
    const value = e.target.type === "checkbox" ? e.target.checked : e.target.value;
    setForm((f) => ({ ...f, [key]: value }));
    if (key === "email" && timers) {
      setTimers(null); // đổi email thì phải gửi lại mã
      setOtp("");
    }
  };

  const setPhone = (e) =>
    setForm((f) => ({ ...f, phone_number: e.target.value.replace(/\D/g, "").slice(0, 10) }));

  const handleSendOtp = async () => {
    if (!EMAIL_RE.test(form.email.trim())) {
      setErrors((er) => ({ ...er, email: "Email không hợp lệ." }));
      return;
    }
    setErrors((er) => ({ ...er, email: undefined, otp: undefined }));
    setApiError("");
    setSending(true);
    try {
      await sendOtp(form.email);
      const t = Date.now();
      setNow(t);
      setOtp("");
      setTimers({ expiresAt: t + OTP_LIFETIME_MS, resendAt: t + RESEND_AFTER_MS });
    } catch (err) {
      setErrors((er) => ({ ...er, email: err.message || "Không gửi được mã OTP." }));
    } finally {
      setSending(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate(form, otp, Boolean(timers));
    if (timers && expiresIn === 0 && !errs.otp) errs.otp = "Mã OTP đã hết hạn. Hãy gửi lại mã.";
    setErrors(errs);
    setApiError("");
    if (Object.keys(errs).length) return;

    setSubmitting(true);
    try {
      await register({
        full_name: form.full_name.trim(),
        phone_number: form.phone_number,
        email: form.email,
        otp,
        password: form.password,
      });
      navigate("/login", { state: { registered: true } });
    } catch (err) {
      setApiError(err.message || "Đăng ký thất bại. Vui lòng thử lại.");
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

      <Field label="Họ và tên" htmlFor="full_name" error={errors.full_name}>
        <input
          id="full_name"
          className={cls("full_name")}
          type="text"
          placeholder="Nguyễn Văn Minh"
          autoComplete="name"
          value={form.full_name}
          onChange={set("full_name")}
        />
      </Field>

      <Field label="Số điện thoại" htmlFor="phone_number" error={errors.phone_number}>
        <input
          id="phone_number"
          className={cls("phone_number")}
          type="tel"
          inputMode="numeric"
          placeholder="09xx xxx xxx"
          autoComplete="tel"
          value={form.phone_number}
          onChange={setPhone}
        />
      </Field>

      <Field label="Email" htmlFor="email" error={errors.email}>
        <div className="row">
          <input
            id="email"
            className={cls("email")}
            type="email"
            placeholder="minh@email.com"
            autoComplete="email"
            value={form.email}
            onChange={set("email")}
          />
          <button
            className="btn btn-nowrap"
            type="button"
            onClick={handleSendOtp}
            disabled={sending || (timers !== null && resendIn > 0)}
          >
            {sending ? "Đang gửi..." : "Gửi mã OTP"}
          </button>
        </div>
      </Field>

      {timers && (
        <Field label="Mã OTP (6 số) đã gửi tới email" error={errors.otp}>
          <OtpInput value={otp} onChange={setOtp} invalid={Boolean(errors.otp)} />
          <div className="otp-meta">
            <span>{expiresIn > 0 ? `Mã hết hạn sau ${mmss(expiresIn)}` : "Mã đã hết hạn"}</span>
            {resendIn > 0 ? (
              <span>Gửi lại mã ({mmss(resendIn)})</span>
            ) : (
              <button className="link-btn" type="button" onClick={handleSendOtp} disabled={sending}>
                Gửi lại mã
              </button>
            )}
          </div>
        </Field>
      )}
      {!timers && errors.otp && (
        <p className="field-error" role="alert">
          {errors.otp}
        </p>
      )}

      <Field label="Mật khẩu" htmlFor="password" error={errors.password}>
        <input
          id="password"
          className={cls("password")}
          type="password"
          placeholder="••••••••"
          autoComplete="new-password"
          value={form.password}
          onChange={set("password")}
        />
      </Field>

      <Field label="Nhập lại mật khẩu" htmlFor="confirm" error={errors.confirm}>
        <input
          id="confirm"
          className={cls("confirm")}
          type="password"
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

      {import.meta.env.DEV && (
        <p className="notice info dev-hint">Dữ liệu giả: mã OTP luôn là 123456.</p>
      )}
    </form>
  );
}
