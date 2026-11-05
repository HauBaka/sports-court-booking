import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { RoleProvider } from "../context/RoleContext";
import LoginPage from "./LoginPage";
import { login } from "../services/authService";

vi.mock("../services/authService", () => ({ login: vi.fn() }));

function setup() {
  render(
    <RoleProvider>
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    </RoleProvider>
  );
}

function fillAndSubmit(email, password) {
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: email } });
  fireEvent.change(screen.getByLabelText("Mật khẩu"), { target: { value: password } });
  fireEvent.click(screen.getByRole("button", { name: "Đăng nhập" }));
}

describe("LoginPage", () => {
  afterEach(() => {
    cleanup();
    localStorage.clear();
    vi.clearAllMocks();
  });

  it("báo lỗi khi bỏ trống và không gọi API", () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: "Đăng nhập" }));
    expect(screen.getByText("Email không hợp lệ.")).toBeTruthy();
    expect(screen.getByText("Vui lòng nhập mật khẩu.")).toBeTruthy();
    expect(login).not.toHaveBeenCalled();
  });

  it("đăng nhập thành công thì lưu access_token", async () => {
    login.mockResolvedValue({ data: { access_token: "abc", user: { role: "admin" } } });
    setup();
    fillAndSubmit("admin@example.com", "12345678");
    await waitFor(() => expect(localStorage.getItem("access_token")).toBe("abc"));
  });

  it("hiện thông báo lỗi từ API", async () => {
    login.mockRejectedValue({ code: "AUTH_INVALID_CREDENTIALS", message: "Sai thông tin." });
    setup();
    fillAndSubmit("a@b.com", "wrongpass");
    expect(await screen.findByText("Sai thông tin.")).toBeTruthy();
  });
});
