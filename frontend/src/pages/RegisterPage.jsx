import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Icon from "../components/ui/Icon";
import OtpInput from "../components/OtpInput";
import useOtpChallenge from "../hooks/useOtpChallenge";
import { register } from "../services/authService";
import { isOtpDead, isOtpError, otpErrorMessage, validateOtpCode } from "../utils/otp";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const API_FIELDS = ["name", "phone", "email", "password", "role"];

/** Điều kiện mật khẩu — cùng luật với backend */
const PW_RULES = [
  ["8 ký tự trở lên", (p) => p.length >= 8],
  ["Chữ hoa",         (p) => /[A-Z]/.test(p)],
  ["Chữ thường",      (p) => /[a-z]/.test(p)],
  ["Số",              (p) => /\d/.test(p)],
  ["Ký tự đặc biệt",  (p) => /[^A-Za-z0-9]/.test(p)],
];

function pwOk(p) { return PW_RULES.every(([, t]) => t(p)); }

function validate(f) {
  const e = {};
  if (f.name.trim().length < 2) e.name = "Nhập họ và tên.";
  if (!/^\d{10}$/.test(f.phone)) e.phone = "Gồm 10 số, bắt đầu bằng 0.";
  if (!EMAIL_RE.test(f.email.trim())) e.email = "Nhập email có dấu @, ví dụ minh@gmail.com.";
  if (!pwOk(f.password)) e.password = "Mật khẩu chưa đủ các điều kiện bên dưới.";
  return e;
}

const otpFieldInvalid = (err) =>
  err.code === "VALIDATION_ERROR" &&
  Array.isArray(err.details) &&
  err.details.some((d) => d.field === "otp_code");

export default function RegisterPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: "", phone: "", email: "", password: "", role: "customer",
  });
  const [errors, setErrors] = useState({});
  const [apiError, setApiError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showPw, setShowPw] = useState(false);

  /* ── OTP inline (gửi mã ngay trong form) ─────────────────── */
  const otp = useOtpChallenge("REGISTER");
  // sentTo: email đã gửi OTP đến; verified: email đã xác minh thành công
  const [sentTo, setSentTo] = useState("");
  const [verified, setVerified] = useState("");
  const otpInputRef = useRef(null);

  const emailOk   = EMAIL_RE.test(form.email.trim());
  const isVerified = verified && verified === form.email.trim();
  const codeOpen   = sentTo && sentTo === form.email.trim() && !isVerified;

  const set = (key) => (e) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const setPhone = (e) =>
    setForm((f) => ({ ...f, phone: e.target.value.replace(/\D/g, "").slice(0, 10) }));

  /* Gửi OTP xác minh email */
  const sendCode = async () => {
    if (!emailOk) return setErrors((p) => ({ ...p, email: "Nhập email có dấu @, ví dụ minh@gmail.com." }));
    setErrors((p) => ({ ...p, email: undefined }));
    otp.reset();
    setSentTo(form.email.trim());
    const err = await otp.send(form.email.trim());
    if (err && err.code !== "AUTH_OTP_TOO_SOON") {
      setErrors((p) => ({ ...p, email: err.message || "Không gửi được mã." }));
      setSentTo("");
    }
    setTimeout(() => otpInputRef.current?.querySelector("input")?.focus(), 50);
  };

  /* Tự kiểm tra OTP khi đủ 6 số */
  useEffect(() => {
    if (!codeOpen || otp.code.length < 6) return;
    // Prototype gọi API ngay; thực tế OTP verify ở bước submit — ở đây ta mark verified khi code đủ dài
    // để UI mở khóa nút submit (kiểm tra thực sự ở handleSubmit)
    setVerified(sentTo);
    setErrors((p) => ({ ...p, email: undefined }));
  }, [otp.code]); // eslint-disable-line react-hooks/exhaustive-deps

  const showApiError = (err) => {
    if (err.code === "AUTH_EMAIL_EXISTS") return setErrors({ email: err.message });
    if (err.code === "AUTH_PHONE_EXISTS") return setErrors({ phone: err.message });
    if (err.code === "VALIDATION_ERROR" && Array.isArray(err.details)) {
      const fe = {};
      for (const { field, issue } of err.details)
        if (API_FIELDS.includes(field)) fe[field] = issue;
      if (Object.keys(fe).length) return setErrors(fe);
    }
    setApiError(err.message || "Đăng ký thất bại. Vui lòng thử lại.");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const er = validate(form);
    if (!isVerified) er.email = er.email ?? "Bấm Gửi mã và nhập mã 6 số để xác minh email.";
    setErrors(er);
    setApiError("");
    if (Object.keys(er).length) return;

    const codeError = validateOtpCode(otp.code);
    if (codeError) { otp.setError(codeError); return; }

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
        if (isOtpDead(err)) { otp.setCode(""); setVerified(""); }
      } else {
        otp.reset(); setVerified(""); setSentTo("");
        showApiError(err);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <h1>Tạo tài khoản</h1>
      <p className="auth__lead">
        Đã có tài khoản?{" "}
        <Link className="link" to="/login">Đăng nhập</Link>
      </p>

      <form className="reg" onSubmit={handleSubmit} noValidate>
        {/* Lỗi API chung */}
        {apiError && (
          <div className="notice notice--danger wide" role="alert">
            <Icon name="alert" size={16} />{apiError}
          </div>
        )}

        {/* ── Role picker ─────────────────────────────────────── */}
        <div className="seg wide" role="radiogroup" aria-label="Bạn là">
          {[["customer", "Người chơi"], ["owner", "Chủ sân"]].map(([v, l]) => (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={form.role === v}
              className={form.role === v ? "on" : ""}
              onClick={() => setForm((f) => ({ ...f, role: v }))}
            >
              {l}
            </button>
          ))}
        </div>

        {/* ── Họ và tên ─────────────────────────────────────── */}
        <div className="field">
          <label htmlFor="reg-name">Họ và tên</label>
          <input
            id="reg-name"
            className="input"
            type="text"
            placeholder="Nguyễn Văn Minh"
            autoComplete="name"
            value={form.name}
            onChange={set("name")}
            aria-invalid={!!errors.name}
          />
          {errors.name && <span className="field__err">{errors.name}</span>}
        </div>

        {/* ── Số điện thoại ────────────────────────────────── */}
        <div className="field">
          <label htmlFor="reg-phone">Số điện thoại</label>
          <input
            id="reg-phone"
            className="input"
            type="tel"
            inputMode="numeric"
            placeholder="0901234567"
            autoComplete="tel"
            value={form.phone}
            onChange={setPhone}
            aria-invalid={!!errors.phone}
          />
          {errors.phone && <span className="field__err">{errors.phone}</span>}
        </div>

        {/* ── Email + OTP inline ──────────────────────────── */}
        <div className="field wide">
          <div className="row between">
            <label htmlFor="reg-email">Email</label>
            {isVerified && (
              <span className="verified">
                <i><Icon name="check" size={12} /></i>
                Đã xác minh
              </span>
            )}
          </div>
          <div className="input-group">
            <input
              id="reg-email"
              className="input"
              type="email"
              placeholder="ten@gmail.com"
              autoComplete="email"
              value={form.email}
              onChange={(e) => {
                set("email")(e);
                // Reset xác minh khi đổi email
                if (verified && verified !== e.target.value.trim()) {
                  setVerified(""); setSentTo(""); otp.reset();
                }
              }}
              aria-invalid={!!errors.email}
            />
            {!isVerified && (
              <button
                type="button"
                className={"btn btn--sm input-act" + (emailOk ? " btn--primary" : "")}
                disabled={!emailOk || otp.sending || (codeOpen && otp.seconds > 0)}
                onClick={sendCode}
              >
                {otp.sending ? "Đang gửi..." : codeOpen ? "Đã gửi" : "Gửi mã"}
              </button>
            )}
          </div>
          {errors.email && <span className="field__err">{errors.email}</span>}

          {/* Khối nhập OTP */}
          {codeOpen && (
            <div className="verify" ref={otpInputRef}>
              <div className="verify__row">
                <div role="group" aria-label="Mã xác minh 6 số">
                  <OtpInput
                    value={otp.code}
                    onChange={otp.setCode}
                    length={6}
                    invalid={!!otp.error}
                  />
                </div>
                <div style={{ textAlign: "right" }}>
                  <div className="mono small">
                    {otp.seconds > 0 ? `${otp.seconds}s` : "Hết hạn"}
                  </div>
                  <button
                    type="button"
                    className="link small"
                    disabled={otp.seconds > 0 || otp.sending}
                    onClick={sendCode}
                  >
                    Gửi lại mã
                  </button>
                </div>
              </div>
              {otp.error && <span className="field__err">{otp.error}</span>}
              {otp.notice && (
                <span className="form-note" style={{ color: "var(--accent)" }}>
                  {otp.notice}
                </span>
              )}
              <span className="form-note">Đã gửi tới {sentTo}.</span>
            </div>
          )}
        </div>

        {/* ── Mật khẩu + pw-rules ─────────────────────────── */}
        <div className="field wide">
          <label htmlFor="reg-pw">Mật khẩu</label>
          <div className="input-group">
            <input
              id="reg-pw"
              className="input"
              type={showPw ? "text" : "password"}
              autoComplete="new-password"
              value={form.password}
              onChange={set("password")}
              aria-invalid={!!errors.password}
            />
            <button
              type="button"
              className="btn btn--ghost btn--sm input-act"
              onClick={() => setShowPw(!showPw)}
            >
              {showPw ? "Ẩn" : "Hiện"}
            </button>
          </div>
          {errors.password && <span className="field__err">{errors.password}</span>}

          {/* Điều kiện mật khẩu */}
          <div className="pw-rules" aria-label="Điều kiện mật khẩu">
            {PW_RULES.map(([label, test]) => (
              <span key={label} className={test(form.password) ? "ok" : ""}>
                <Icon name={test(form.password) ? "check" : "x"} size={12} />
                {label}
              </span>
            ))}
          </div>
        </div>

        <button
          className="btn btn--primary btn--lg btn--block wide"
          type="submit"
          disabled={submitting}
        >
          {submitting ? "Đang đăng ký..." : "Tạo tài khoản"}
        </button>
      </form>
    </>
  );
}
