import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import RequireRole from "./RequireRole";
import { getMe } from "../services/authService";

vi.mock("../services/authService", () => ({ getMe: vi.fn() }));

/**
 * Helper render voi RequireRole bao gom cac route phu tro:
 * /login, /unauthorized, va trang con duoc bao ve.
 */
function setup({ roles, initialPath = "/protected" } = {}) {
  render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route element={<RequireRole roles={roles} />}>
          <Route path="/protected" element={<p>TRANG_BAO_VE</p>} />
        </Route>
        <Route path="/login" element={<p>TRANG_DANG_NHAP</p>} />
        <Route path="/unauthorized" element={<p>TRANG_KHONG_QUYEN</p>} />
      </Routes>
    </MemoryRouter>
  );
}

describe("RequireRole", () => {
  afterEach(() => {
    cleanup();
    localStorage.clear();
    vi.clearAllMocks();
  });

  // --- Chua dang nhap ---
  it("chua co token thi redirect ve /login, khong goi API", () => {
    setup({ roles: "owner" });
    expect(screen.getByText("TRANG_DANG_NHAP")).toBeTruthy();
    expect(getMe).not.toHaveBeenCalled();
  });

  // --- Dung role ---
  it("owner vao route owner thi hien trang duoc bao ve", async () => {
    localStorage.setItem("access_token", "tok");
    getMe.mockResolvedValue({ data: { id: 2, role: "owner" } });
    setup({ roles: "owner" });
    expect(await screen.findByText("TRANG_BAO_VE")).toBeTruthy();
  });

  it("admin vao route admin thi hien trang duoc bao ve", async () => {
    localStorage.setItem("access_token", "tok");
    getMe.mockResolvedValue({ data: { id: 3, role: "admin" } });
    setup({ roles: "admin" });
    expect(await screen.findByText("TRANG_BAO_VE")).toBeTruthy();
  });

  it("roles la mang thi chap nhan ca hai role", async () => {
    localStorage.setItem("access_token", "tok");
    getMe.mockResolvedValue({ data: { id: 2, role: "owner" } });
    setup({ roles: ["owner", "admin"] });
    expect(await screen.findByText("TRANG_BAO_VE")).toBeTruthy();
  });

  // --- Sai role ---
  it("customer vao route owner thi redirect ve /unauthorized", async () => {
    localStorage.setItem("access_token", "tok");
    getMe.mockResolvedValue({ data: { id: 1, role: "customer" } });
    setup({ roles: "owner" });
    expect(await screen.findByText("TRANG_KHONG_QUYEN")).toBeTruthy();
    expect(screen.queryByText("TRANG_BAO_VE")).toBeNull();
  });

  it("customer vao route admin thi redirect ve /unauthorized", async () => {
    localStorage.setItem("access_token", "tok");
    getMe.mockResolvedValue({ data: { id: 1, role: "customer" } });
    setup({ roles: "admin" });
    expect(await screen.findByText("TRANG_KHONG_QUYEN")).toBeTruthy();
    expect(screen.queryByText("TRANG_BAO_VE")).toBeNull();
  });

  it("owner vao route admin thi redirect ve /unauthorized", async () => {
    localStorage.setItem("access_token", "tok");
    getMe.mockResolvedValue({ data: { id: 2, role: "owner" } });
    setup({ roles: "admin" });
    expect(await screen.findByText("TRANG_KHONG_QUYEN")).toBeTruthy();
    expect(screen.queryByText("TRANG_BAO_VE")).toBeNull();
  });

  // --- Loi API ---
  it("getMe loi thi hien thong bao loi, khong vao trang duoc bao ve", async () => {
    localStorage.setItem("access_token", "tok");
    getMe.mockRejectedValue({ message: "Không lấy được thông tin tài khoản." });
    setup({ roles: "owner" });
    expect(
      await screen.findByText("Không lấy được thông tin tài khoản.")
    ).toBeTruthy();
    expect(screen.queryByText("TRANG_BAO_VE")).toBeNull();
  });
});
