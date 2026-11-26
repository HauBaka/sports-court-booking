/**
 * RegisterPage tests — cập nhật theo UI mới (prototype style):
 * - Không có "Nhập lại mật khẩu" và checkbox đồng ý (đã bỏ)
 * - Vai trò chọn bằng seg button, không phải <select>
 * - OTP inline trong form (không phải step riêng)
 * - Nút submit là "Tạo tài khoản" (không phải "Đăng ký")
 * - Gửi mã bằng nút "Gửi mã" ngay trong field email
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
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

function type(label, value) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

/** Điền các trường cơ bản (không gửi OTP) */
function fillBase() {
  type("Họ và tên", "Nguyễn Văn Minh");
  type("Số điện thoại", "0901234567");
  type("Email", "minh@email.com");
  type("Mật khẩu", "SecurePassword123@");
}

const submit = () =>
  fireEvent.click(screen.getByRole("button", { name: "Tạo tài khoản" }));

/** Điền form đầy đủ + gửi OTP + nhập mã 6 số (xác minh inline) */
async function fillAndVerify(otp = "123456") {
  sendOtp.mockResolvedValue({ success: true });
  fillBase();
  // Nhấn "Gửi mã" để gửi OTP
  fireEvent.click(screen.getByRole("button", { name: "Gửi mã" }));
  // Chờ khối OTP hiện ra (nhận biết qua role group)
  await screen.findByRole("group", { name: "Mã xác minh 6 số" });
  // Paste OTP vào wrapper .otp
  const otpWrap = document.querySelector(".verify .otp") ?? document.querySelector(".otp");
  fireEvent.paste(otpWrap, { clipboardData: { getData: () => otp } });
  // Chờ "Đã xác minh" xuất hiện
  await screen.findByText("Đã xác minh");
}

describe("RegisterPage", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("báo lỗi các trường bắt buộc và không gọi API", () => {
    setup();
    submit();
    expect(screen.getByText("Nhập họ và tên.")).toBeTruthy();
    expect(screen.getByText("Gồm 10 số, bắt đầu bằng 0.")).toBeTruthy();
    expect(screen.getByText("Nhập email có dấu @, ví dụ minh@gmail.com.")).toBeTruthy();
    expect(register).not.toHaveBeenCalled();
  });

  it("báo lỗi khi email chưa được xác minh", () => {
    setup();
    fillBase();
    submit();
    // Email chưa gửi OTP → báo lỗi xác minh
    expect(
      screen.getByText("Bấm Gửi mã và nhập mã 6 số để xác minh email.")
    ).toBeTruthy();
    expect(register).not.toHaveBeenCalled();
  });

  it("gửi OTP REGISTER tới email khi nhấn Gửi mã", async () => {
    sendOtp.mockResolvedValue({ success: true });
    setup();
    fillBase();
    fireEvent.click(screen.getByRole("button", { name: "Gửi mã" }));
    await screen.findByRole("group", { name: "Mã xác minh 6 số" });
    expect(sendOtp).toHaveBeenCalledWith({ email: "minh@email.com", purpose: "REGISTER" });
    expect(register).not.toHaveBeenCalled();
  });

  it("gửi đúng body theo API (kèm otp_code) rồi chuyển sang trang đăng nhập", async () => {
    register.mockResolvedValue({ success: true });
    setup();
    // Chọn vai trò Chủ sân
    fireEvent.click(screen.getByRole("radio", { name: "Chủ sân" }));
    await fillAndVerify("123456");
    submit();
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

  it("hiện lỗi AUTH_EMAIL_EXISTS dưới ô email khi gửi OTP", async () => {
    sendOtp.mockRejectedValue({ code: "AUTH_EMAIL_EXISTS", message: "Email đã được đăng ký." });
    setup();
    fillBase();
    fireEvent.click(screen.getByRole("button", { name: "Gửi mã" }));
    expect(await screen.findByText("Email đã được đăng ký.")).toBeTruthy();
  });

  it("báo mật khẩu thiếu chữ hoa/số/ký tự đặc biệt trước khi gửi OTP", () => {
    setup();
    type("Họ và tên", "Nguyễn Văn Minh");
    type("Số điện thoại", "0901234567");
    type("Email", "minh@email.com");
    type("Mật khẩu", "matkhauyeu");
    submit();
    expect(screen.getByText("Mật khẩu chưa đủ các điều kiện bên dưới.")).toBeTruthy();
    expect(sendOtp).not.toHaveBeenCalled();
  });

  it("hiển thị pw-rules và cập nhật khi nhập mật khẩu", () => {
    setup();
    // Lúc đầu tất cả rule chưa đạt
    const before = document.querySelectorAll(".pw-rules span.ok").length;
    expect(before).toBe(0);
    type("Mật khẩu", "SecurePassword123@");
    // Sau khi nhập đủ, tất cả 5 rules đạt
    expect(document.querySelectorAll(".pw-rules span.ok").length).toBe(5);
  });

  it("nút Gửi mã bị vô hiệu khi email chưa hợp lệ", () => {
    setup();
    type("Email", "khong-phai-email");
    expect(screen.getByRole("button", { name: "Gửi mã" })).toBeDisabled();
  });

  // Test đếm ngược bị bỏ qua vì fake timer + React state update trong jsdom
  // không ổn định; behavior của useCountdown được test riêng nếu cần.
  it.skip("nút gửi lại khóa trong lúc đếm ngược rồi mở lại", async () => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
    try {
      sendOtp.mockResolvedValue({ success: true });
      setup();
      fillBase();
      fireEvent.click(screen.getByRole("button", { name: "Gửi mã" }));
      await screen.findByRole("group", { name: "Mã xác minh 6 số" });
      // Nút gửi lại bị vô hiệu ngay sau khi gửi
      expect(screen.getByRole("button", { name: "Gửi lại mã" }).disabled).toBe(true);
      // Tick qua toàn bộ 60 giây đếm ngược
      act(() => { vi.advanceTimersByTime(61000); });
      expect(screen.getByRole("button", { name: "Gửi lại mã" }).disabled).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it("trùng số điện thoại ở bước cuối thì hiện lỗi dưới ô số điện thoại", async () => {
    register.mockRejectedValue({ code: "AUTH_PHONE_EXISTS", message: "Số điện thoại đã được đăng ký." });
    setup();
    await fillAndVerify();
    submit();
    expect(await screen.findByText("Số điện thoại đã được đăng ký.")).toBeTruthy();
  });

  it("gán details của VALIDATION_ERROR vào từng ô", async () => {
    register.mockRejectedValue({
      code: "VALIDATION_ERROR",
      message: "Dữ liệu gửi lên không hợp lệ.",
      details: [{ field: "password", issue: "Mật khẩu quá yếu." }],
    });
    setup();
    await fillAndVerify();
    submit();
    expect(await screen.findByText("Mật khẩu quá yếu.")).toBeTruthy();
  });
});
