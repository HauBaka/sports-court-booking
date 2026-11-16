// Thời gian chờ giữa 2 lần gửi OTP (backend cũng áp cooldown 60 giây theo email).
export const OTP_RESEND_SECONDS = 60;
export const OTP_LENGTH = 6;

const OTP_ERROR_MESSAGES = {
  AUTH_OTP_INVALID: "Mã OTP không đúng. Vui lòng kiểm tra lại.",
  AUTH_OTP_EXPIRED: "Mã OTP đã hết hạn (sau 5 phút). Hãy gửi lại mã mới.",
  AUTH_OTP_TOO_MANY_ATTEMPTS: "Bạn đã nhập sai 5 lần nên mã đã bị hủy. Hãy gửi lại mã mới.",
  AUTH_OTP_TOO_SOON: "Vui lòng đợi 60 giây rồi gửi lại mã.",
};

// Mã lỗi mà mã OTP hiện tại không còn dùng được nữa: cần xóa ô nhập và gửi mã mới.
const OTP_DEAD_CODES = ["AUTH_OTP_EXPIRED", "AUTH_OTP_TOO_MANY_ATTEMPTS"];

export const isOtpError = (err) => err?.code in OTP_ERROR_MESSAGES;
export const isOtpDead = (err) => OTP_DEAD_CODES.includes(err?.code);

export function otpErrorMessage(err) {
  if (OTP_ERROR_MESSAGES[err?.code]) return OTP_ERROR_MESSAGES[err.code];
  if (err?.code === "VALIDATION_ERROR") {
    const detail = Array.isArray(err.details) && err.details.find((d) => d.field === "otp_code");
    if (detail) return `Mã OTP phải gồm đúng ${OTP_LENGTH} chữ số.`;
  }
  return err?.message || "Không thể xử lý yêu cầu. Vui lòng thử lại.";
}

// Kiểm tra mã OTP phía client: chỉ báo khi chưa nhập đủ 6 số, đúng/sai do backend quyết định.
export const validateOtpCode = (code) =>
  /^\d{6}$/.test(code) ? "" : `Vui lòng nhập đủ ${OTP_LENGTH} chữ số.`;
