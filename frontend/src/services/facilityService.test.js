import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Chạy qua api.js thật với VITE_USE_MOCK=true để kiểm tra mock Epic 2 đúng format backend.
let auth;
let facilities;

async function loginAs(email) {
  const { data } = await auth.login({ email, password: "TestPass123@" });
  localStorage.setItem("access_token", data.access_token);
  return data.user;
}

const newFacility = {
  name: "Cơ Sở Mới",
  address: "1 Lê Lợi",
  city: "Hồ Chí Minh",
  district: null,
  latitude: null,
  longitude: null,
  open_time: "06:00:00",
  close_time: "22:00:00",
  description: null,
};

beforeEach(async () => {
  vi.stubEnv("VITE_USE_MOCK", "true");
  vi.resetModules();
  auth = await import("./authService");
  facilities = await import("./facilityService");
});

afterEach(() => {
  vi.unstubAllEnvs();
  localStorage.clear();
});

describe("facilityService với dữ liệu giả", () => {
  it("danh sách công khai có phân trang đúng format", async () => {
    const res = await facilities.listFacilities({ page: 1, limit: 2 });
    expect(res.success).toBe(true);
    expect(res.data).toHaveLength(2);
    expect(res.meta).toEqual({ page: 1, limit: 2, total: 3, total_pages: 2 });
    expect(res.data[0]).toMatchObject({ owner_id: 2, total_courts: 6, min_price: 80000 });
  });

  it("limit ngoài khoảng 1 đến 100 trả VALIDATION_ERROR", async () => {
    await expect(facilities.listFacilities({ limit: 500 })).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
      details: [{ field: "limit", issue: expect.any(String) }],
    });
  });

  it("listMyFacilities chỉ trả cơ sở của chủ sân đó", async () => {
    const mine = await facilities.listMyFacilities(2);
    expect(mine.map((f) => f.id)).toEqual([1, 2]);
    expect(await facilities.listMyFacilities(4)).toHaveLength(1);
    expect(await facilities.listMyFacilities(999)).toEqual([]);
  });

  it("chủ sân tạo cơ sở xong thì thấy ngay trong danh sách của mình", async () => {
    const owner = await loginAs("owner@scb.vn");
    const res = await facilities.createFacility(newFacility);
    expect(res.data).toMatchObject({ name: "Cơ Sở Mới", owner_id: owner.id, is_active: true });

    const mine = await facilities.listMyFacilities(owner.id);
    expect(mine).toHaveLength(3);
    expect(mine.at(-1)).toMatchObject({ id: res.data.id, total_courts: 0, min_price: 0, max_price: 0 });
  });

  it("giờ HH:mm được chuẩn hóa thành HH:mm:ss", async () => {
    await loginAs("owner@scb.vn");
    const res = await facilities.createFacility({ ...newFacility, open_time: "06:30", close_time: "21:00" });
    expect(res.data).toMatchObject({ open_time: "06:30:00", close_time: "21:00:00" });
  });

  it("khách hàng tạo cơ sở bị từ chối AUTH_FORBIDDEN", async () => {
    await loginAs("customer.a@scb.vn");
    await expect(facilities.createFacility(newFacility)).rejects.toMatchObject({ code: "AUTH_FORBIDDEN" });
    expect(await facilities.listMyFacilities(1)).toEqual([]);
  });

  it("giờ mở cửa không trước giờ đóng cửa trả lỗi field body như backend", async () => {
    await loginAs("owner@scb.vn");
    const err = await facilities
      .createFacility({ ...newFacility, open_time: "22:00:00", close_time: "06:00:00" })
      .catch((e) => e);
    expect(err.code).toBe("VALIDATION_ERROR");
    expect(err.details).toEqual([{ field: "body", issue: expect.stringContaining("open_time") }]);
  });

  it("thiếu trường bắt buộc trả lỗi theo từng field", async () => {
    await loginAs("owner@scb.vn");
    const err = await facilities.createFacility({ ...newFacility, name: undefined, city: "" }).catch((e) => e);
    expect(err.details.map((d) => d.field).sort()).toEqual(["city", "name"]);
  });
});
