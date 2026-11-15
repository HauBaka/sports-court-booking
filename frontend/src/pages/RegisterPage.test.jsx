import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import RegisterPage from "./RegisterPage";
import { register, sendOtp } from "../services/authService";

vi.mock("../services/authService", () => ({ register: vi.fn(), sendOtp: vi.fn() }));

function setup() {
  render(
    <MemoryRouter initialEntries={["/register"]}>
      <Routes>
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/login" element={<p>TRANG_DANG_NHAP</p>} />
      </Routes>
    </MemoryRouter>
  );
}

function fillValid() {
  const type = (label, value) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
  type("Họ và tên", "Nguyễn Văn Minh");
  type("Số điện thoại", "0901234567");
  type("Email", "minh@email.com");
  type("Mật khẩu", "SecurePassword123@");
  type("Nhập lại mật khẩu", "SecurePassword123@");
  fireEvent.click(screen.getByLabelText("Tôi đồng ý Điều khoản sử dụng"));
}

const submit = () => fireEvent.click(screen.getByRole("button", { name: "Đăng ký" }));

// Điền form hợp lệ, gửi OTP và nhập đủ 6 số để tới bước xác nhận
async function toOtpStep() {
  sendOtp.mockResolvedValue({ success: true });
  setup();
  fillValid();
  submit();
  await screen.findByRole("heading", { name: "Xác nhận email" });
}
const typeOtp = (code = "123456") =>
  fireEvent.paste(document.querySelector(".otp"), { clipboardData: { getData: () => code } });
const confirm = () => fireEvent.click(screen.getByRole("button", { name: "Xác nhận và đăng ký" }));

describe("RegisterPage", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("báo lỗi các trường bắt buộc và không gọi API", () => {
    setup();
    submit();
    expect(screen.getByText("Vui lòng nhập họ và tên.")).toBeTruthy();
    expect(screen.getByText("Số điện thoại phải có 10 chữ số.")).toBeTruthy();
    expect(screen.getByText("Email không hợp lệ.")).toBeTruthy();
    expect(screen.getByText("Bạn cần đồng ý Điều khoản sử dụng.")).toBeTruthy();
    expect(register).not.toHaveBeenCalled();
  });

  it("gửi OTP REGISTER tới email rồi chuyển sang bước xác nhận", async () => {
    await toOtpStep();
    expect(sendOtp).toHaveBeenCalledWith({ email: "minh@email.com", purpose: "REGISTER" });
    expect(register).not.toHaveBeenCalled();
    expect(screen.getByText("minh@email.com")).toBeTruthy();
  });

  it("gửi đúng body theo API (kèm otp_code) rồi chuyển sang trang đăng nhập", async () => {
    register.mockResolvedValue({ success: true });
    sendOtp.mockResolvedValue({ success: true });
    setup();
    fillValid();
    fireEvent.change(screen.getByLabelText("Vai trò"), { target: { value: "owner" } });
    submit();
    await screen.findByRole("heading", { name: "Xác nhận email" });
    typeOtp();
    confirm();
    expect(await screen.findByText("TRANG_DANG_NHAP")).toBeTruthy();
    expect(register).toHaveBeenCalledWith({
      name: "Nguyễn Văn Minh",
      phone: "0901234567",
      email: "minh@email.com",
      password: "SecurePassword123@",
      role: "owner",
      otp_code: "123456",
    });
  });

  it("chưa nhập đủ 6 số thì không gọi đăng ký", async () => {
    await toOtpStep();
    typeOtp("123");
    confirm();
    expect(screen.getByText("Vui lòng nhập đủ 6 chữ số.")).toBeTruthy();
    expect(register).not.toHaveBeenCalled();
  });

  it.each([
    ["AUTH_OTP_INVALID", "Mã OTP không đúng. Vui lòng kiểm tra lại."],
    ["AUTH_OTP_EXPIRED", "Mã OTP đã hết hạn (sau 5 phút). Hãy gửi lại mã mới."],
    ["AUTH_OTP_TOO_MANY_ATTEMPTS", "Bạn đã nhập sai 5 lần nên mã đã bị hủy. Hãy gửi lại mã mới."],
  ])("hiện thông báo tiếng Việt cho %s", async (code, message) => {
    register.mockRejectedValue({ code, message: "english" });
    await toOtpStep();
    typeOtp();
    confirm();
    expect(await screen.findByText(message)).toBeTruthy();
  });

  it("nút gửi lại khóa 60 giây rồi mở lại", async () => {
    // Chỉ giả lập đồng hồ đếm ngược; scheduler của React vẫn dùng timer thật
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
    try {
      await toOtpStep();
      expect(screen.getByRole("button", { name: "Gửi lại mã (60s)" }).disabled).toBe(true);
      act(() => {
        vi.advanceTimersByTime(59000);
      });
      expect(screen.getByRole("button", { name: "Gửi lại mã (1s)" }).disabled).toBe(true);
      act(() => {
        vi.advanceTimersByTime(1000);
      });
      const btn = screen.getByRole("button", { name: "Gửi lại mã" });
      expect(btn.disabled).toBe(false);
      fireEvent.click(btn);
      expect(await screen.findByRole("button", { name: "Gửi lại mã (60s)" })).toBeTruthy();
      expect(sendOtp).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it("Đổi email quay lại form và giữ nguyên dữ liệu đã nhập", async () => {
    await toOtpStep();
    fireEvent.click(screen.getByRole("button", { name: "Đổi email" }));
    expect(screen.getByLabelText("Email").value).toBe("minh@email.com");
    expect(screen.getByLabelText("Họ và tên").value).toBe("Nguyễn Văn Minh");
  });

  it("gửi OTP quá sớm (429) vẫn sang bước nhập mã và báo chờ 60 giây", async () => {
    sendOtp.mockRejectedValue({ code: "AUTH_OTP_TOO_SOON", message: "too soon" });
    setup();
    fillValid();
    submit();
    expect(await screen.findByText("Vui lòng đợi 60 giây rồi gửi lại mã.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Gửi lại mã (60s)" }).disabled).toBe(true);
  });

  it("hiện lỗi AUTH_EMAIL_EXISTS dưới ô email khi gửi OTP", async () => {
    sendOtp.mockRejectedValue({ code: "AUTH_EMAIL_EXISTS", message: "Email đã được đăng ký." });
    setup();
    fillValid();
    submit();
    expect(await screen.findByText("Email đã được đăng ký.")).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Xác nhận email" })).toBeNull();
  });

  it("trùng số điện thoại ở bước cuối thì quay lại form và báo dưới ô số điện thoại", async () => {
    register.mockRejectedValue({ code: "AUTH_PHONE_EXISTS", message: "Số điện thoại đã được đăng ký." });
    await toOtpStep();
    typeOtp();
    confirm();
    expect(await screen.findByText("Số điện thoại đã được đăng ký.")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Tạo tài khoản" })).toBeTruthy();
  });

  it("gán details của VALIDATION_ERROR vào từng ô", async () => {
    register.mockRejectedValue({
      code: "VALIDATION_ERROR",
      message: "Dữ liệu gửi lên không hợp lệ.",
      details: [{ field: "password", issue: "Mật khẩu quá yếu." }],
    });
    await toOtpStep();
    typeOtp();
    confirm();
    expect(await screen.findByText("Mật khẩu quá yếu.")).toBeTruthy();
  });

  it("báo mật khẩu thiếu chữ hoa/số/ký tự đặc biệt trước khi gửi OTP", () => {
    setup();
    fillValid();
    fireEvent.change(screen.getByLabelText("Mật khẩu"), { target: { value: "matkhauyeu" } });
    submit();
    expect(screen.getByText(/chữ hoa, chữ thường, số và ký tự đặc biệt/)).toBeTruthy();
    expect(sendOtp).not.toHaveBeenCalled();
  });
});
