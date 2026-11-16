import { useEffect, useRef } from "react";
import OtpInput from "./OtpInput";
import { OTP_LENGTH } from "../utils/otp";

/**
 * Khối nhập mã OTP dùng chung: dòng báo đã gửi tới email (có "Đổi email"),
 * 6 ô nhập, nút "Gửi lại mã" bị khóa trong lúc đếm ngược.
 */
export default function OtpVerify({
  lead,
  email,
  code,
  onCodeChange,
  error,
  notice,
  seconds,
  sending,
  onResend,
  onChangeEmail,
}) {
  const wrapRef = useRef(null);

  // Vào bước OTP thì đưa con trỏ vào ô đầu tiên.
  useEffect(() => {
    wrapRef.current?.querySelector("input")?.focus();
  }, []);

  const locked = seconds > 0 || sending;

  return (
    <div ref={wrapRef}>
      <p className="otp-lead">
        {lead} <strong>{email}</strong>.{" "}
        <button type="button" className="link-btn" onClick={onChangeEmail}>
          Đổi email
        </button>
      </p>

      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="notice info" role="status">
          {notice}
        </p>
      )}

      <div className="field" role="group" aria-labelledby="otp-label">
        <p id="otp-label" className="field-label">
          Mã xác nhận
        </p>
        <OtpInput value={code} onChange={onCodeChange} length={OTP_LENGTH} invalid={Boolean(error)} />
        <div className="otp-meta">
          <span>Chưa nhận được mã?</span>
          <button type="button" className="link-btn" disabled={locked} onClick={onResend}>
            {sending ? "Đang gửi..." : seconds > 0 ? `Gửi lại mã (${seconds}s)` : "Gửi lại mã"}
          </button>
        </div>
      </div>
    </div>
  );
}
