import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import RequireOwner from "./RequireOwner";
import { getMe } from "../services/authService";

vi.mock("../services/authService", () => ({ getMe: vi.fn() }));

function setup() {
  render(
    <MemoryRouter initialEntries={["/owner/facilities"]}>
      <Routes>
        <Route element={<RequireOwner />}>
          <Route path="/owner/facilities" element={<p>TRANG_CHU_SAN</p>} />
        </Route>
        <Route path="/login" element={<p>TRANG_DANG_NHAP</p>} />
      </Routes>
    </MemoryRouter>
  );
}

describe("RequireOwner", () => {
  afterEach(() => {
    cleanup();
    localStorage.clear();
    vi.clearAllMocks();
  });

  it("chưa đăng nhập thì chuyển về /login và không gọi API", () => {
    setup();
    expect(screen.getByText("TRANG_DANG_NHAP")).toBeTruthy();
    expect(getMe).not.toHaveBeenCalled();
  });

  it("chủ sân thì hiện trang con", async () => {
    localStorage.setItem("access_token", "t");
    getMe.mockResolvedValue({ data: { id: 2, role: "owner" } });
    setup();
    expect(await screen.findByText("TRANG_CHU_SAN")).toBeTruthy();
  });

  it("khách hàng thì báo không có quyền", async () => {
    localStorage.setItem("access_token", "t");
    getMe.mockResolvedValue({ data: { id: 1, role: "customer" } });
    setup();
    expect(await screen.findByText("Trang này chỉ dành cho chủ sân.")).toBeTruthy();
    expect(screen.queryByText("TRANG_CHU_SAN")).toBeNull();
  });
});
