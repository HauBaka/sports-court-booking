import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Outlet, Route, Routes } from "react-router-dom";
import MyFacilitiesPage from "./MyFacilitiesPage";
import { listMyFacilities } from "../../services/facilityService";

vi.mock("../../services/facilityService", () => ({ listMyFacilities: vi.fn() }));

const facility = {
  id: 1,
  name: "Cơ Sở Kỳ Hòa",
  owner_id: 2,
  address: "238 Ba Tháng Hai",
  city: "Hồ Chí Minh",
  district: "Quận 10",
  open_time: "06:00:00",
  close_time: "23:00:00",
  is_active: true,
  min_price: 80000,
  max_price: 160000,
  total_courts: 6,
};

function setup(entry = "/owner/facilities") {
  render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route element={<Outlet context={{ user: { id: 2, role: "owner" } }} />}>
          <Route path="/owner/facilities" element={<MyFacilitiesPage />} />
        </Route>
      </Routes>
    </MemoryRouter>
  );
}

describe("MyFacilitiesPage", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("gọi API theo id chủ sân và hiện thông tin từng cơ sở", async () => {
    listMyFacilities.mockResolvedValue([facility]);
    setup();
    expect(screen.getByText("Đang tải danh sách...")).toBeTruthy();
    expect(await screen.findByText("Cơ Sở Kỳ Hòa")).toBeTruthy();
    expect(listMyFacilities).toHaveBeenCalledWith(2);
    expect(screen.getByText("Giờ mở cửa: 06:00 – 23:00")).toBeTruthy();
    expect(screen.getByText("Số sân: 6")).toBeTruthy();
    expect(screen.getByText(/Giá: 80\.000 ₫ – 160\.000 ₫/)).toBeTruthy();
    expect(screen.getByText("Quận 10, Hồ Chí Minh")).toBeTruthy();
  });

  it("chưa có cơ sở thì hiện trạng thái trống kèm nút tạo", async () => {
    listMyFacilities.mockResolvedValue([]);
    setup();
    expect(await screen.findByText("Bạn chưa có cơ sở nào.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Tạo cơ sở đầu tiên" })).toBeTruthy();
  });

  it("cơ sở mới chưa có bảng giá thì ghi rõ", async () => {
    listMyFacilities.mockResolvedValue([{ ...facility, total_courts: 0, min_price: 0, max_price: 0 }]);
    setup();
    expect(await screen.findByText(/Chưa có bảng giá/)).toBeTruthy();
  });

  it("báo lỗi và cho thử lại", async () => {
    listMyFacilities.mockRejectedValueOnce({ code: "NETWORK_ERROR", message: "Mất kết nối." });
    listMyFacilities.mockResolvedValueOnce([facility]);
    setup();
    expect(await screen.findByText("Mất kết nối.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Thử lại" }));
    expect(await screen.findByText("Cơ Sở Kỳ Hòa")).toBeTruthy();
    expect(listMyFacilities).toHaveBeenCalledTimes(2);
  });

  it("vừa tạo xong thì hiện thông báo và đánh dấu cơ sở mới", async () => {
    listMyFacilities.mockResolvedValue([facility]);
    setup({ pathname: "/owner/facilities", state: { created: { id: 1, name: "Cơ Sở Kỳ Hòa" } } });
    expect(await screen.findByText(/Đã tạo cơ sở “Cơ Sở Kỳ Hòa”/)).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Cơ Sở Kỳ Hòa" }).closest("li").className).toContain("highlight");
  });
});
