import { useState } from "react";
import { sendOtp } from "../services/authService";
import { OTP_RESEND_SECONDS } from "../utils/otp";
import useCountdown from "./useCountdown";

/**
 * Trạng thái dùng chung cho bước nhập OTP (đăng ký và quên mật khẩu):
 * mã đang nhập, lỗi/thông báo, đang gửi, và đồng hồ khóa nút "Gửi lại mã".
 */
export default function useOtpChallenge(purpose) {
  const [seconds, startCountdown] = useCountdown();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [sending, setSending] = useState(false);

  // Trả về null nếu gửi thành công, ngược lại trả về lỗi để trang tự xử lý.
  const send = async (email, { resend = false } = {}) => {
    setError("");
    setNotice("");
    setSending(true);
    try {
      await sendOtp({ email, purpose });
      startCountdown(OTP_RESEND_SECONDS);
      setCode("");
      if (resend) setNotice("Đã gửi mã mới. Mã cũ không còn dùng được.");
      return null;
    } catch (err) {
      // Backend báo vừa gửi xong: khóa nút gửi lại thêm 60 giây (tối đa, không biết chính xác còn bao lâu).
      if (err.code === "AUTH_OTP_TOO_SOON") startCountdown(OTP_RESEND_SECONDS);
      return err;
    } finally {
      setSending(false);
    }
  };

  const reset = () => {
    setCode("");
    setError("");
    setNotice("");
  };

  return { seconds, code, setCode, error, setError, notice, sending, send, reset };
}
