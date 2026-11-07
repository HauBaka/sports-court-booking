import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import RequireAuth from "./RequireAuth";

function setup(initialPath = "/") {
  render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route element={<RequireAuth />}>
          <Route path="/" element={<p>TRANG_CHU</p>} />
        </Route>
        <Route path="/login" element={<p>TRANG_DANG_NHAP</p>} />
      </Routes>
    </MemoryRouter>
  );
}

describe("RequireAuth", () => {
  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  it("chua co token thi redirect ve /login", () => {
    setup();
    expect(screen.getByText("TRANG_DANG_NHAP")).toBeTruthy();
    expect(screen.queryByText("TRANG_CHU")).toBeNull();
  });

  it("co token thi hien trang duoc bao ve", () => {
    localStorage.setItem("access_token", "any-token");
    setup();
    expect(screen.getByText("TRANG_CHU")).toBeTruthy();
    expect(screen.queryByText("TRANG_DANG_NHAP")).toBeNull();
  });

  it("xoa token giua chung thi redirect ve /login", () => {
    localStorage.setItem("access_token", "any-token");
    setup();
    expect(screen.getByText("TRANG_CHU")).toBeTruthy();

    // Xoa token (simulate logout o tab khac)
    localStorage.removeItem("access_token");
    cleanup();
    setup();
    expect(screen.getByText("TRANG_DANG_NHAP")).toBeTruthy();
  });
});
