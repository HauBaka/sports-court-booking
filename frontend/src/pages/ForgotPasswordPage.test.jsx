import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import ForgotPasswordPage from "./ForgotPasswordPage";
import { resetPassword, sendOtp } from "../services/authService";

vi.mock("../services/authService", () => ({ sendOtp: vi.fn(), resetPassword: vi.fn() }));

function LoginStub() {
  const { state } = useLocation();
  return <p>{state?.passwordReset ? "DA_DAT_LAI" : "TRANG_DANG_NHAP"}</p>;
}

function setup() {
  render(
    <MemoryRouter initialEntries={["/forgot-password"]}>
      <Routes>
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/login" element={<LoginStub />} />
      </Routes>
    </MemoryRouter>
  );
}

const typeEmail = (v = "minh@email.com") =>
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: v } });
const sendCode = () => fireEvent.click(screen.getByRole("button", { name: "Gửi mã" }));
const typeOtp = (code = "123456") =>
  fireEvent.paste(document.querySelector(".otp"), { clipboardData: { getData: () => code } });
const typePasswords = (a = "NewPassword1@", b = a) => {
  fireEvent.change(screen.getByLabelText("Mật khẩu mới"), { target: { value: a } });
  fireEvent.change(screen.getByLabelText("Nhập lại mật khẩu mới"), { target: { value: b } });
};
const submitReset = () => fireEvent.click(screen.getByRole("button", { name: "Đặt lại mật khẩu" }));

async function toResetStep() {
  sendOtp.mockResolvedValue({ success: true });
  setup();
  typeEmail();
  sendCode();
  await screen.findByRole("heading", { name: "Đặt lại mật khẩu" });
}

describe("ForgotPasswordPage", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("email sai định dạng thì không gửi mã", () => {
    setup();
    typeEmail("khong-phai-email");
    sendCode();
    expect(screen.getByText("Email không hợp lệ.")).toBeTruthy();
    expect(sendOtp).not.toHaveBeenCalled();
  });

  it("gửi OTP RESET_PASSWORD rồi sang bước đặt lại, không tiết lộ email có tồn tại", async () => {
    await toResetStep();
    expect(sendOtp).toHaveBeenCalledWith({ email: "minh@email.com", purpose: "RESET_PASSWORD" });
    expect(screen.getByText(/Nếu email này đã đăng ký/)).toBeTruthy();
  });

  it("đặt lại thành công thì về trang đăng nhập kèm thông báo", async () => {
    resetPassword.mockResolvedValue({ success: true });
    await toResetStep();
    typeOtp();
    typePasswords();
    submitReset();
    expect(await screen.findByText("DA_DAT_LAI")).toBeTruthy();
    expect(resetPassword).toHaveBeenCalledWith({
      email: "minh@email.com",
      otp_code: "123456",
      new_password: "NewPassword1@",
    });
  });

  it("báo lỗi khi thiếu mã, mật khẩu yếu hoặc nhập lại không khớp", async () => {
    await toResetStep();
    typePasswords("yeu", "khac");
    submitReset();
    expect(screen.getByText("Vui lòng nhập đủ 6 chữ số.")).toBeTruthy();
    expect(screen.getByText(/chữ hoa, chữ thường, số và ký tự đặc biệt/)).toBeTruthy();
    expect(screen.getByText("Mật khẩu nhập lại không khớp.")).toBeTruthy();
    expect(resetPassword).not.toHaveBeenCalled();
  });

  it.each([
    ["AUTH_OTP_INVALID", "Mã OTP không đúng. Vui lòng kiểm tra lại."],
    ["AUTH_OTP_EXPIRED", "Mã OTP đã hết hạn (sau 5 phút). Hãy gửi lại mã mới."],
    ["AUTH_OTP_TOO_MANY_ATTEMPTS", "Bạn đã nhập sai 5 lần nên mã đã bị hủy. Hãy gửi lại mã mới."],
  ])("hiện thông báo tiếng Việt cho %s", async (code, message) => {
    resetPassword.mockRejectedValue({ code, message: "english" });
    await toResetStep();
    typeOtp();
    typePasswords();
    submitReset();
    expect(await screen.findByText(message)).toBeTruthy();
  });

  it("lỗi mật khẩu mới từ backend hiện dưới ô mật khẩu", async () => {
    resetPassword.mockRejectedValue({
      code: "VALIDATION_ERROR",
      details: [{ field: "new_password", issue: "Mật khẩu mới quá yếu." }],
    });
    await toResetStep();
    typeOtp();
    typePasswords();
    submitReset();
    expect(await screen.findByText("Mật khẩu mới quá yếu.")).toBeTruthy();
  });

  it("Đổi email quay về bước nhập email", async () => {
    await toResetStep();
    fireEvent.click(screen.getByRole("button", { name: "Đổi email" }));
    expect(screen.getByRole("heading", { name: "Quên mật khẩu" })).toBeTruthy();
  });
});
