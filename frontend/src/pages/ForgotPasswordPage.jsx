import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Field from "../components/Field";
import OtpVerify from "../components/OtpVerify";
import PasswordInput from "../components/PasswordInput";
import useOtpChallenge from "../hooks/useOtpChallenge";
import { resetPassword } from "../services/authService";
import { isOtpDead, isOtpError, otpErrorMessage, validateOtpCode } from "../utils/otp";
import { validateNewPassword } from "../utils/password";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ForgotPasswordPage() {
  const navigate = useNavigate();
  // "email": nhập email nhận mã; "reset": nhập mã và mật khẩu mới
  const [step, setStep] = useState("email");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState({});
  const [apiError, setApiError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const otp = useOtpChallenge("RESET_PASSWORD");

  // Bước 1: gửi mã. Backend trả 200 cả khi email chưa đăng ký nên không được nói email có tồn tại hay không.
  const handleSend = async (e) => {
    e.preventDefault();
    setApiError("");
    if (!EMAIL_RE.test(email.trim())) return setErrors({ email: "Email không hợp lệ." });
    setErrors({});

    setSubmitting(true);
    const err = await otp.send(email);
    setSubmitting(false);
    if (!err) return setStep("reset");
    // Vừa gửi mã cách đây chưa tới 60 giây: người dùng có thể đã có mã trong hộp thư.
    if (err.code === "AUTH_OTP_TOO_SOON") {
      otp.setError(otpErrorMessage(err));
      return setStep("reset");
    }
    if (err.code === "VALIDATION_ERROR") return setErrors({ email: "Email không hợp lệ." });
    setApiError(err.message || "Không thể gửi mã. Vui lòng thử lại.");
  };

  const handleResend = async () => {
    const err = await otp.send(email, { resend: true });
    if (err) otp.setError(otpErrorMessage(err));
  };

  const backToEmail = () => {
    otp.reset();
    setErrors({});
    setApiError("");
    setStep("email");
  };

  // Bước 2: đặt mật khẩu mới bằng mã OTP
  const handleReset = async (e) => {
    e.preventDefault();
    const codeError = validateOtpCode(otp.code);
    const errs = {};
    const passwordError = validateNewPassword(password);
    if (passwordError) errs.password = passwordError;
    if (confirm !== password) errs.confirm = "Mật khẩu nhập lại không khớp.";
    otp.setError(codeError);
    setErrors(errs);
    setApiError("");
    if (codeError || Object.keys(errs).length) return;

    setSubmitting(true);
    try {
      await resetPassword({ email, otp_code: otp.code, new_password: password });
      navigate("/login", { state: { passwordReset: true } });
    } catch (err) {
      const fields = err.code === "VALIDATION_ERROR" && Array.isArray(err.details) ? err.details : [];
      const passwordIssue = fields.find((d) => d.field === "new_password");
      if (isOtpError(err) || fields.some((d) => d.field === "otp_code")) {
        otp.setError(otpErrorMessage(err));
        if (isOtpDead(err)) otp.setCode("");
      } else if (passwordIssue) {
        setErrors({ password: passwordIssue.issue });
      } else {
        setApiError(err.message || "Đặt lại mật khẩu thất bại. Vui lòng thử lại.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (step === "reset") {
    return (
      <form className="auth-card" onSubmit={handleReset} noValidate>
        <h1>Đặt lại mật khẩu</h1>

        {apiError && (
          <p className="notice error" role="alert">
            {apiError}
          </p>
        )}

        <OtpVerify
          lead="Nếu email này đã đăng ký, mã gồm 6 chữ số đã được gửi tới"
          email={email.trim()}
          code={otp.code}
          onCodeChange={otp.setCode}
          error={otp.error}
          notice={otp.notice}
          seconds={otp.seconds}
          sending={otp.sending}
          onResend={handleResend}
          onChangeEmail={backToEmail}
        />

        <Field label="Mật khẩu mới" htmlFor="new-password" error={errors.password}>
          <PasswordInput
            id="new-password"
            className={`input${errors.password ? " invalid" : ""}`}
            placeholder="••••••••"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>

        <Field label="Nhập lại mật khẩu mới" htmlFor="confirm-password" error={errors.confirm}>
          <PasswordInput
            id="confirm-password"
            className={`input${errors.confirm ? " invalid" : ""}`}
            placeholder="••••••••"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </Field>

        <button className="btn btn-block" type="submit" disabled={submitting}>
          {submitting ? "Đang đặt lại..." : "Đặt lại mật khẩu"}
        </button>
      </form>
    );
  }

  return (
    <form className="auth-card" onSubmit={handleSend} noValidate>
      <h1>Quên mật khẩu</h1>
      <p className="intro">Nhập email đã đăng ký, chúng tôi sẽ gửi mã xác nhận để bạn đặt lại mật khẩu.</p>

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
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </Field>

      <button className="btn btn-block" type="submit" disabled={submitting}>
        {submitting ? "Đang gửi mã..." : "Gửi mã"}
      </button>

      <p className="auth-foot">
        Nhớ mật khẩu rồi? <Link to="/login">Đăng nhập</Link>
      </p>
    </form>
  );
}
