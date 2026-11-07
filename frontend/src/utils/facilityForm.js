// Giới hạn khớp với schema FacilityCreate của backend (backend/app/schemas/facility.py).
export const LIMITS = { name: 255, address: 500, city: 100, district: 100 };

export const EMPTY_FORM = {
  name: "",
  address: "",
  city: "Hồ Chí Minh",
  district: "",
  latitude: "",
  longitude: "",
  open_time: "",
  close_time: "",
  description: "",
};

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const NUMBER_RE = /^-?\d+(\.\d+)?$/;

// "" -> null (bỏ trống), số hợp lệ -> number, còn lại -> NaN. Chấp nhận dấu phẩy thập phân.
export function parseCoordinate(text) {
  const t = text.trim().replace(",", ".");
  if (t === "") return null;
  return NUMBER_RE.test(t) ? Number(t) : NaN;
}

export function validateFacility(form) {
  const errors = {};

  const name = form.name.trim();
  if (!name) errors.name = "Vui lòng nhập tên cơ sở.";
  else if (name.length > LIMITS.name) errors.name = `Tên cơ sở tối đa ${LIMITS.name} ký tự.`;

  const address = form.address.trim();
  if (!address) errors.address = "Vui lòng nhập địa chỉ.";
  else if (address.length > LIMITS.address) errors.address = `Địa chỉ tối đa ${LIMITS.address} ký tự.`;

  const city = form.city.trim();
  if (!city) errors.city = "Vui lòng nhập tỉnh/thành phố.";
  else if (city.length > LIMITS.city) errors.city = `Tỉnh/thành phố tối đa ${LIMITS.city} ký tự.`;

  if (form.district.trim().length > LIMITS.district) {
    errors.district = `Quận/huyện tối đa ${LIMITS.district} ký tự.`;
  }

  // Tọa độ không bắt buộc, nhưng đã nhập thì phải đủ cả hai và nằm trong khoảng hợp lệ.
  const lat = parseCoordinate(form.latitude);
  const lng = parseCoordinate(form.longitude);
  if (Number.isNaN(lat)) errors.latitude = "Vĩ độ phải là số.";
  else if (lat !== null && (lat < -90 || lat > 90)) errors.latitude = "Vĩ độ phải nằm trong khoảng -90 đến 90.";
  if (Number.isNaN(lng)) errors.longitude = "Kinh độ phải là số.";
  else if (lng !== null && (lng < -180 || lng > 180)) errors.longitude = "Kinh độ phải nằm trong khoảng -180 đến 180.";
  const MISSING_PAIR = "Vui lòng nhập cả vĩ độ và kinh độ, hoặc để trống cả hai.";
  if (lat !== null && lng === null && !errors.longitude) errors.longitude = MISSING_PAIR;
  if (lng !== null && lat === null && !errors.latitude) errors.latitude = MISSING_PAIR;

  if (!TIME_RE.test(form.open_time)) errors.open_time = "Vui lòng chọn giờ mở cửa.";
  if (!TIME_RE.test(form.close_time)) errors.close_time = "Vui lòng chọn giờ đóng cửa.";
  if (!errors.open_time && !errors.close_time && form.open_time >= form.close_time) {
    errors.close_time = "Giờ đóng cửa phải sau giờ mở cửa.";
  }

  return errors;
}

// Chuyển dữ liệu form thành body POST /facilities (giờ dạng HH:mm:ss, ô trống thành null).
export function toFacilityPayload(form) {
  return {
    name: form.name.trim(),
    address: form.address.trim(),
    city: form.city.trim(),
    district: form.district.trim() || null,
    latitude: parseCoordinate(form.latitude),
    longitude: parseCoordinate(form.longitude),
    open_time: `${form.open_time}:00`,
    close_time: `${form.close_time}:00`,
    description: form.description.trim() || null,
  };
}
