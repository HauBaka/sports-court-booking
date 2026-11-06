import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import FacilityCreatePage from "./FacilityCreatePage";
import { createFacility } from "../../services/facilityService";

vi.mock("../../services/facilityService", () => ({ createFacility: vi.fn() }));

function ListStub() {
  const created = useLocation().state?.created;
  return <p>DANH_SACH: {created?.name}</p>;
}

function setup() {
  render(
    <MemoryRouter initialEntries={["/owner/facilities/new"]}>
      <Routes>
        <Route path="/owner/facilities/new" element={<FacilityCreatePage />} />
        <Route path="/owner/facilities" element={<ListStub />} />
      </Routes>
    </MemoryRouter>
  );
}

const type = (label, value) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
const submit = () => fireEvent.click(screen.getByRole("button", { name: "Tạo cơ sở" }));

function fillValid() {
  type("Tên cơ sở", "  Cơ Sở Cầu Lông Tân Bình ");
  type("Địa chỉ", "123 Hoàng Hoa Thám");
  type("Vĩ độ", "10.7992");
  type("Kinh độ", "106.6501");
  type("Giờ mở cửa", "06:00");
  type("Giờ đóng cửa", "23:00");
}

describe("FacilityCreatePage", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("để trống thì báo lỗi các trường bắt buộc và không gọi API", () => {
    setup();
    submit();
    expect(screen.getByText("Vui lòng nhập tên cơ sở.")).toBeTruthy();
    expect(screen.getByText("Vui lòng nhập địa chỉ.")).toBeTruthy();
    expect(screen.getByText("Vui lòng chọn giờ mở cửa.")).toBeTruthy();
    expect(screen.getByText("Vui lòng chọn giờ đóng cửa.")).toBeTruthy();
    expect(createFacility).not.toHaveBeenCalled();
  });

  it("tọa độ và giờ sai thì chặn trước khi gửi", () => {
    setup();
    fillValid();
    type("Vĩ độ", "200");
    type("Kinh độ", "abc");
    type("Giờ mở cửa", "23:00");
    type("Giờ đóng cửa", "06:00");
    submit();
    expect(screen.getByText(/-90 đến 90/)).toBeTruthy();
    expect(screen.getByText("Kinh độ phải là số.")).toBeTruthy();
    expect(screen.getByText("Giờ đóng cửa phải sau giờ mở cửa.")).toBeTruthy();
    expect(createFacility).not.toHaveBeenCalled();
  });

  it("gửi đúng body theo API rồi về danh sách kèm thông tin cơ sở vừa tạo", async () => {
    createFacility.mockResolvedValue({ data: { id: 9, name: "Cơ Sở Cầu Lông Tân Bình" } });
    setup();
    fillValid();
    submit();
    expect(await screen.findByText("DANH_SACH: Cơ Sở Cầu Lông Tân Bình")).toBeTruthy();
    expect(createFacility).toHaveBeenCalledWith({
      name: "Cơ Sở Cầu Lông Tân Bình",
      address: "123 Hoàng Hoa Thám",
      city: "Hồ Chí Minh",
      district: null,
      latitude: 10.7992,
      longitude: 106.6501,
      open_time: "06:00:00",
      close_time: "23:00:00",
      description: null,
    });
  });

  it("gán details của VALIDATION_ERROR vào từng ô, lỗi field body hiện ở đầu form", async () => {
    createFacility.mockRejectedValue({
      code: "VALIDATION_ERROR",
      message: "Dữ liệu gửi lên không hợp lệ.",
      details: [
        { field: "name", issue: "String should have at most 255 characters" },
        { field: "body", issue: "Value error, Giờ mở cửa phải trước giờ đóng cửa." },
      ],
    });
    setup();
    fillValid();
    submit();
    expect(await screen.findByText("String should have at most 255 characters")).toBeTruthy();
    expect(screen.getByText("Giờ mở cửa phải trước giờ đóng cửa.")).toBeTruthy();
  });

  it("hiện lỗi không có quyền từ API", async () => {
    createFacility.mockRejectedValue({ code: "AUTH_FORBIDDEN", message: "Bạn không có quyền thực hiện thao tác này." });
    setup();
    fillValid();
    submit();
    expect(await screen.findByText("Bạn không có quyền thực hiện thao tác này.")).toBeTruthy();
  });
});
