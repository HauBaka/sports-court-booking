import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import RegisterPage from "./RegisterPage";
import { register, sendOtp } from "../services/authService";

vi.mock("../services/authService", () => ({ register: vi.fn(), sendOtp: vi.fn() }));

function setup() {
  render(
    <MemoryRouter>
      <RegisterPage />
    </MemoryRouter>
  );
}

describe("RegisterPage", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("báo lỗi các trường bắt buộc và không gọi API", () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: "Đăng ký" }));
    expect(screen.getByText("Vui lòng nhập họ và tên.")).toBeTruthy();
    expect(screen.getByText("Số điện thoại phải có 10 chữ số.")).toBeTruthy();
    expect(screen.getByText("Bấm Gửi mã OTP để nhận mã qua email.")).toBeTruthy();
    expect(screen.getByText("Bạn cần đồng ý Điều khoản sử dụng.")).toBeTruthy();
    expect(register).not.toHaveBeenCalled();
  });

  it("gửi OTP thì hiện ô nhập mã và đồng hồ đếm ngược", async () => {
    sendOtp.mockResolvedValue({ success: true });
    setup();
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "minh@email.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Gửi mã OTP" }));
    expect(await screen.findByText(/Mã OTP \(6 số\)/)).toBeTruthy();
    expect(screen.getByText("Mã hết hạn sau 05:00")).toBeTruthy();
    expect(sendOtp).toHaveBeenCalledWith("minh@email.com");
  });
});
