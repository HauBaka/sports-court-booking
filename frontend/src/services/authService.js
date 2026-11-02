// DỮ LIỆU GIẢ: thay phần thân các hàm bằng api.post(...) khi BE sẵn sàng.
// Giữ nguyên tên hàm, dạng trả về { success, message, data } và dạng lỗi { code, message }
// để các trang không phải sửa.

export const MOCK_OTP = "123456";

const users = [
  { id: 1, full_name: "Khách Mẫu", email: "customer@example.com", password: "12345678", role: "customer" },
  { id: 2, full_name: "Chủ Sân Mẫu", email: "owner@example.com", password: "12345678", role: "owner" },
  { id: 3, full_name: "Quản Trị Mẫu", email: "admin@example.com", password: "12345678", role: "admin" },
];
const otpSentTo = new Set();

const delay = (ms = 600) => new Promise((resolve) => setTimeout(resolve, ms));
const ok = (data, message) => ({ success: true, message, data });
const fail = (code, message) => Promise.reject({ code, message });
const norm = (email) => email.trim().toLowerCase();

export async function sendOtp(email) {
  await delay();
  const mail = norm(email);
  if (users.some((u) => u.email === mail)) {
    return fail("EMAIL_ALREADY_EXISTS", "Email này đã được đăng ký.");
  }
  otpSentTo.add(mail);
  return ok(null, "Đã gửi mã OTP");
}

export async function register({ full_name, email, otp, password }) {
  await delay();
  const mail = norm(email);
  if (!otpSentTo.has(mail)) return fail("OTP_NOT_SENT", "Vui lòng bấm Gửi mã OTP trước.");
  if (otp !== MOCK_OTP) return fail("OTP_INVALID", "Mã OTP không đúng.");
  users.push({ id: users.length + 1, full_name, email: mail, password, role: "customer" });
  otpSentTo.delete(mail);
  return ok(null, "Đăng ký thành công");
}

export async function login({ email, password }) {
  await delay();
  const user = users.find((u) => u.email === norm(email) && u.password === password);
  if (!user) return fail("AUTH_INVALID_CREDENTIALS", "Email hoặc mật khẩu không chính xác.");
  return ok(
    {
      access_token: `mock-token-${user.id}`,
      user: { id: user.id, full_name: user.full_name, email: user.email, role: user.role },
    },
    "Đăng nhập thành công"
  );
}
