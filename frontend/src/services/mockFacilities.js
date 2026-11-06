import { fail, ok } from "./mockHelpers";

// Mock Epic 2 (cơ sở thể thao): GET /facilities (2.1) và POST /facilities (2.3).
// Hành vi bám theo backend: GET chỉ trả cơ sở đang hoạt động, KHÔNG có bộ lọc theo chủ sân;
// POST chỉ cho role owner, tự gán owner_id, is_active=true, lỗi 422 theo kiểu pydantic.

const seedFacilities = () => [
  {
    id: 1, owner_id: 2, name: "Cơ Sở Cầu Lông & Pickleball Kỳ Hòa",
    address: "238 Ba Tháng Hai, Phường 12, Quận 10", city: "Hồ Chí Minh", district: "Quận 10",
    latitude: 10.771921, longitude: 106.671042, open_time: "06:00:00", close_time: "23:00:00",
    description: "Cơ sở cầu lông và pickleball trung tâm Quận 10.", is_active: true,
    min_price: 80000, max_price: 160000, total_courts: 6,
  },
  {
    id: 2, owner_id: 2, name: "Cơ Sở Cầu Lông Tân Bình",
    address: "123 Hoàng Hoa Thám, Phường 13, Quận Tân Bình", city: "Hồ Chí Minh", district: "Quận Tân Bình",
    latitude: 10.7992, longitude: 106.6501, open_time: "06:00:00", close_time: "22:00:00",
    description: null, is_active: true,
    min_price: 100000, max_price: 120000, total_courts: 3,
  },
  {
    id: 3, owner_id: 4, name: "Sân Bóng Đá Mini Thủ Đức",
    address: "45 Võ Văn Ngân, Phường Bình Thọ", city: "Hồ Chí Minh", district: "TP. Thủ Đức",
    latitude: 10.8505, longitude: 106.7717, open_time: "05:30:00", close_time: "22:30:00",
    description: null, is_active: true,
    min_price: 200000, max_price: 350000, total_courts: 4,
  },
];

let facilities = seedFacilities();

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;
const toTime = (t) => (t.length === 5 ? `${t}:00` : t);

const listItem = (f) => ({
  id: f.id, name: f.name, owner_id: f.owner_id, address: f.address, city: f.city, district: f.district,
  latitude: f.latitude, longitude: f.longitude, open_time: f.open_time, close_time: f.close_time,
  is_active: f.is_active, min_price: f.min_price, max_price: f.max_price, total_courts: f.total_courts,
});

const createdItem = (f) => ({
  id: f.id, name: f.name, owner_id: f.owner_id, address: f.address, city: f.city, district: f.district,
  latitude: f.latitude, longitude: f.longitude, open_time: f.open_time, close_time: f.close_time,
  description: f.description, is_active: f.is_active,
});

const validation = (details) => fail(422, "VALIDATION_ERROR", "Dữ liệu gửi lên không hợp lệ.", details);

function listFacilities(query) {
  const page = query.page === undefined ? 1 : Number(query.page);
  const limit = query.limit === undefined ? 10 : Number(query.limit);
  const details = [];
  if (!Number.isInteger(page) || page < 1) details.push({ field: "page", issue: "Input should be greater than or equal to 1" });
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) details.push({ field: "limit", issue: "Input should be between 1 and 100" });
  if (details.length) return validation(details);

  const has = (text, term) => text.toLowerCase().includes(term.trim().toLowerCase());
  // sport_id bị bỏ qua vì mock chưa có sân con
  let rows = facilities.filter((f) => f.is_active);
  if (query.city?.trim()) rows = rows.filter((f) => has(f.city, query.city));
  if (query.search?.trim()) rows = rows.filter((f) => has(f.name, query.search) || has(f.address, query.search));
  rows.sort((a, b) => a.id - b.id);

  const total = rows.length;
  const start = (page - 1) * limit;
  return ok(200, "Lấy danh sách cơ sở thể thao thành công.", rows.slice(start, start + limit).map(listItem), {
    page, limit, total, total_pages: total > 0 ? Math.ceil(total / limit) : 0,
  });
}

function validateCreate(body) {
  const details = [];
  const text = (field, { required = false, max }) => {
    const value = body[field];
    if (value === undefined || value === null) {
      if (required) details.push({ field, issue: "Field required" });
    } else if (typeof value !== "string") {
      details.push({ field, issue: "Input should be a valid string" });
    } else if (required && value.length < 1) {
      details.push({ field, issue: "String should have at least 1 character" });
    } else if (value.length > max) {
      details.push({ field, issue: `String should have at most ${max} characters` });
    }
  };
  text("name", { required: true, max: 255 });
  text("address", { required: true, max: 500 });
  text("city", { required: true, max: 100 });
  text("district", { max: 100 });
  text("description", { max: Infinity });

  for (const field of ["latitude", "longitude"]) {
    const value = body[field];
    if (value !== undefined && value !== null && typeof value !== "number") {
      details.push({ field, issue: "Input should be a valid number" });
    }
  }

  let timesValid = true;
  for (const field of ["open_time", "close_time"]) {
    const value = body[field];
    if (value === undefined || value === null) {
      details.push({ field, issue: "Field required" });
      timesValid = false;
    } else if (typeof value !== "string" || !TIME_RE.test(value)) {
      details.push({ field, issue: "Input should be in a valid time format" });
      timesValid = false;
    }
  }
  // Lỗi từ model_validator của pydantic: backend trả field là "body" kèm tiền tố "Value error, "
  if (timesValid && toTime(body.open_time) >= toTime(body.close_time)) {
    details.push({
      field: "body",
      issue: "Value error, Giờ mở cửa (open_time) phải trước giờ đóng cửa (close_time).",
    });
  }
  return details;
}

function createFacility(body, user) {
  const details = validateCreate(body);
  if (details.length) return validation(details);

  const facility = {
    id: Math.max(0, ...facilities.map((f) => f.id)) + 1,
    owner_id: user.id,
    name: body.name,
    address: body.address,
    city: body.city,
    district: body.district ?? null,
    latitude: body.latitude ?? null,
    longitude: body.longitude ?? null,
    open_time: toTime(body.open_time),
    close_time: toTime(body.close_time),
    description: body.description ?? null,
    is_active: true,
    min_price: 0,
    max_price: 0,
    total_courts: 0,
  };
  facilities.push(facility);
  return ok(201, "Tạo cơ sở thể thao thành công.", createdItem(facility));
}

// Trả về null nếu route không thuộc module này.
export function handleFacilities(route, { query, body, authenticate }) {
  if (route === "GET /facilities") return listFacilities(query);

  if (route === "POST /facilities") {
    const { user, error } = authenticate();
    if (error) return error;
    if (user.role !== "owner") {
      return fail(403, "AUTH_FORBIDDEN", "Bạn không có quyền thực hiện thao tác này.");
    }
    return createFacility(body, user);
  }
  return null;
}
