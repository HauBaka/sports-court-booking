import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import RegisterPage from "./RegisterPage";
import { register } from "../services/authService";

vi.mock("../services/authService", () => ({ register: vi.fn() }));

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

  it("gửi đúng body theo API (name, phone, role) rồi chuyển sang trang đăng nhập", async () => {
    register.mockResolvedValue({ success: true });
    setup();
    fillValid();
    fireEvent.change(screen.getByLabelText("Vai trò"), { target: { value: "owner" } });
    submit();
    expect(await screen.findByText("TRANG_DANG_NHAP")).toBeTruthy();
    expect(register).toHaveBeenCalledWith({
      name: "Nguyễn Văn Minh",
      phone: "0901234567",
      email: "minh@email.com",
      password: "SecurePassword123@",
      role: "owner",
    });
  });

  it("hiện lỗi AUTH_EMAIL_EXISTS dưới ô email", async () => {
    register.mockRejectedValue({ code: "AUTH_EMAIL_EXISTS", message: "Email đã được đăng ký." });
    setup();
    fillValid();
    submit();
    expect(await screen.findByText("Email đã được đăng ký.")).toBeTruthy();
  });

  it("gán details của VALIDATION_ERROR vào từng ô", async () => {
    register.mockRejectedValue({
      code: "VALIDATION_ERROR",
      message: "Dữ liệu gửi lên không hợp lệ.",
      details: [{ field: "password", issue: "Mật khẩu quá yếu." }],
    });
    setup();
    fillValid();
    submit();
    expect(await screen.findByText("Mật khẩu quá yếu.")).toBeTruthy();
  });
});
