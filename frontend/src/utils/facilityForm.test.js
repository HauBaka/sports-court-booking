import { describe, expect, it } from "vitest";
import { EMPTY_FORM, parseCoordinate, toFacilityPayload, validateFacility } from "./facilityForm";

const valid = {
  ...EMPTY_FORM,
  name: "Cơ Sở Cầu Lông Tân Bình",
  address: "123 Hoàng Hoa Thám, Phường 13",
  latitude: "10.7992",
  longitude: "106.6501",
  open_time: "06:00",
  close_time: "23:00",
};

describe("validateFacility", () => {
  it("dữ liệu hợp lệ thì không có lỗi", () => {
    expect(validateFacility(valid)).toEqual({});
  });

  it("form mặc định (còn trống) báo lỗi tên, địa chỉ, giờ", () => {
    const errors = validateFacility(EMPTY_FORM);
    expect(Object.keys(errors).sort()).toEqual(["address", "close_time", "name", "open_time"]);
  });

  it("tên toàn khoảng trắng bị coi là trống, tên quá 255 ký tự bị chặn", () => {
    expect(validateFacility({ ...valid, name: "   " }).name).toBe("Vui lòng nhập tên cơ sở.");
    expect(validateFacility({ ...valid, name: "a".repeat(256) }).name).toMatch(/255/);
    expect(validateFacility({ ...valid, name: "a".repeat(255) }).name).toBeUndefined();
  });

  it("địa chỉ quá 500 ký tự bị chặn", () => {
    expect(validateFacility({ ...valid, address: "a".repeat(501) }).address).toMatch(/500/);
  });

  it("tọa độ không bắt buộc, để trống cả hai vẫn hợp lệ", () => {
    expect(validateFacility({ ...valid, latitude: "", longitude: "" })).toEqual({});
  });

  it("tọa độ phải là số và nằm trong khoảng hợp lệ", () => {
    expect(validateFacility({ ...valid, latitude: "abc" }).latitude).toBe("Vĩ độ phải là số.");
    expect(validateFacility({ ...valid, latitude: "10.77.1" }).latitude).toBe("Vĩ độ phải là số.");
    expect(validateFacility({ ...valid, latitude: "91" }).latitude).toMatch(/-90 đến 90/);
    expect(validateFacility({ ...valid, longitude: "-181" }).longitude).toMatch(/-180 đến 180/);
    expect(validateFacility({ ...valid, latitude: "-90", longitude: "180" })).toEqual({});
  });

  it("nhập một tọa độ mà thiếu cái còn lại thì báo lỗi ở ô thiếu", () => {
    expect(validateFacility({ ...valid, longitude: "" }).longitude).toMatch(/cả vĩ độ và kinh độ/);
    expect(validateFacility({ ...valid, latitude: "" }).latitude).toMatch(/cả vĩ độ và kinh độ/);
  });

  it("chấp nhận dấu phẩy thập phân", () => {
    expect(parseCoordinate("10,7992")).toBe(10.7992);
    expect(validateFacility({ ...valid, latitude: "10,7992" })).toEqual({});
  });

  it("giờ đóng cửa phải sau giờ mở cửa", () => {
    expect(validateFacility({ ...valid, open_time: "23:00", close_time: "06:00" }).close_time).toBe(
      "Giờ đóng cửa phải sau giờ mở cửa."
    );
    expect(validateFacility({ ...valid, open_time: "06:00", close_time: "06:00" }).close_time).toBeDefined();
  });

  it("thiếu giờ thì báo từng ô", () => {
    const errors = validateFacility({ ...valid, open_time: "", close_time: "" });
    expect(errors.open_time).toBe("Vui lòng chọn giờ mở cửa.");
    expect(errors.close_time).toBe("Vui lòng chọn giờ đóng cửa.");
  });
});

describe("toFacilityPayload", () => {
  it("đổi giờ sang HH:mm:ss, tọa độ sang số, ô trống sang null", () => {
    expect(toFacilityPayload({ ...valid, name: "  Sân A  ", latitude: "10,5" })).toEqual({
      name: "Sân A",
      address: "123 Hoàng Hoa Thám, Phường 13",
      city: "Hồ Chí Minh",
      district: null,
      latitude: 10.5,
      longitude: 106.6501,
      open_time: "06:00:00",
      close_time: "23:00:00",
      description: null,
    });
  });

  it("bỏ trống tọa độ thì gửi null", () => {
    const payload = toFacilityPayload({ ...valid, latitude: "", longitude: "" });
    expect(payload.latitude).toBeNull();
    expect(payload.longitude).toBeNull();
  });
});
