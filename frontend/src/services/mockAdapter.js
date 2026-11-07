import { AxiosError } from "axios";
import { handleFacilities } from "./mockFacilities";
import { fail, ok } from "./mockHelpers";

// Backend giả cho FE làm việc khi chưa có API thật. Chỉ được bật khi VITE_USE_MOCK=true (xem api.js).
// Trả đúng format trong docs/api-endpoints.md và docs/api-conventions.md (key snake_case,
// envelope { success, message, data }, lỗi { code, message, details }).
// Email và mật khẩu của 3 tài khoản mẫu trùng với dữ liệu seed của backend.

const DELAY_MS = import.meta.env.MODE === "test" ? 0 : 400;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TOKEN_RE = /^mock-token-(\d+)$/;

const seedUsers = () => [
  { id: 1, name: "Khách Mẫu A", email: "customer.a@scb.vn", phone: "0901000001", password: "TestPass123@", role: "customer", balance: 500000 },
  { id: 2, name: "Chủ Sân Mẫu", email: "owner@scb.vn", phone: "0901000002", password: "TestPass123@", role: "owner", balance: 0 },
  { id: 3, name: "Quản Trị Mẫu", email: "admin@scb.vn", phone: "0901000003", password: "TestPass123@", role: "admin", balance: 0 },
  { id: 4, name: "Chủ Sân Khác", email: "owner2@scb.vn", phone: "0901000004", password: "TestPass123@", role: "owner", balance: 0 },
];

let users = seedUsers();

// Token đặc biệt để thử luồng hết hạn phiên: localStorage.setItem("access_token", "mock-token-expired")
function authenticate(headers) {
  const header = headers?.Authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return { error: fail(401, "AUTH_UNAUTHORIZED", "Vui lòng đăng nhập để tiếp tục.") };
  }
  const token = header.slice(7);
  if (token === "mock-token-expired") {
    return { error: fail(401, "AUTH_TOKEN_EXPIRED", "Phiên đăng nhập đã hết hạn.") };
  }
  const match = TOKEN_RE.exec(token);
  const user = match && users.find((u) => u.id === Number(match[1]));
  if (!user) return { error: fail(401, "AUTH_TOKEN_INVALID", "Token không hợp lệ.") };
  return { user };
}

function register(body) {
  const { name, email, phone, password, role } = body;
  const details = [];
  if (!name?.trim()) details.push({ field: "name", issue: "Họ tên không được để trống." });
  if (!EMAIL_RE.test(email ?? "")) details.push({ field: "email", issue: "Email không hợp lệ." });
  if (!/^\d{10}$/.test(phone ?? "")) details.push({ field: "phone", issue: "Số điện thoại phải có 10 chữ số." });
  if ((password ?? "").length < 8) details.push({ field: "password", issue: "Mật khẩu phải có ít nhất 8 ký tự." });
  if (!["customer", "owner"].includes(role)) details.push({ field: "role", issue: "Vai trò phải là customer hoặc owner." });
  if (details.length) return fail(422, "VALIDATION_ERROR", "Dữ liệu gửi lên không hợp lệ.", details);

  const mail = email.trim().toLowerCase();
  if (users.some((u) => u.email === mail)) return fail(409, "AUTH_EMAIL_EXISTS", "Email đã được đăng ký.");
  if (users.some((u) => u.phone === phone)) return fail(409, "AUTH_PHONE_EXISTS", "Số điện thoại đã được đăng ký.");

  const id = Math.max(...users.map((u) => u.id)) + 1;
  users.push({ id, name: name.trim(), email: mail, phone, password, role, balance: 0 });
  return ok(201, "Đăng ký tài khoản thành công.", {
    id, name: name.trim(), email: mail, phone, role, wallet_id: id, balance: 0,
  });
}

function login({ email, password }) {
  const user = users.find((u) => u.email === (email ?? "").trim().toLowerCase() && u.password === password);
  if (!user) return fail(401, "AUTH_INVALID_CREDENTIALS", "Email hoặc mật khẩu không chính xác.");
  return ok(200, "Đăng nhập thành công.", {
    access_token: `mock-token-${user.id}`,
    token_type: "bearer",
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
  });
}

function handle(method, path, body, headers, query) {
  const route = `${method} ${path}`;
  if (route === "POST /auth/register") return register(body);
  if (route === "POST /auth/login") return login(body);

  if (route === "GET /auth/me" || route === "POST /auth/logout") {
    const { user, error } = authenticate(headers);
    if (error) return error;
    if (route === "POST /auth/logout") return ok(200, "Đăng xuất thành công.", null);
    return ok(200, "Lấy thông tin tài khoản thành công.", {
      id: user.id, name: user.name, email: user.email, phone: user.phone, role: user.role,
      wallet: { id: user.id, balance: user.balance },
    });
  }

  const facilityResult = handleFacilities(route, { query, body, authenticate: () => authenticate(headers) });
  if (facilityResult) return facilityResult;

  return fail(404, "RESOURCE_NOT_FOUND", "Không tìm thấy tài nguyên yêu cầu.");
}

// Axios adapter: chặn request ở tầng HTTP nên interceptor trong api.js vẫn chạy như khi gọi API thật.
export async function mockAdapter(config) {
  await new Promise((resolve) => setTimeout(resolve, DELAY_MS));
  const path = (config.url || "").split("?")[0];
  const method = (config.method || "get").toUpperCase();
  const body = typeof config.data === "string" && config.data ? JSON.parse(config.data) : {};
  const { status, body: data } = handle(method, path, body, config.headers, config.params ?? {});

  const response = { data, status, statusText: String(status), headers: {}, config, request: {} };
  if (status >= 200 && status < 300) return response;
  throw new AxiosError(
    `Request failed with status code ${status}`,
    status >= 500 ? AxiosError.ERR_BAD_RESPONSE : AxiosError.ERR_BAD_REQUEST,
    config,
    null,
    response
  );
}
