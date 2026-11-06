import api from "./api";

// Gọi API thật. Khi VITE_USE_MOCK=true thì request được chặn bởi mockAdapter (xem api.js).
// Interceptor trả về body { success, message, data }, lỗi dạng { code, message, details }.

export const login = ({ email, password }) =>
  api.post("/auth/login", { email: email.trim(), password });

// role bắt buộc là "customer" hoặc "owner"
export const register = ({ name, email, phone, password, role }) =>
  api.post("/auth/register", { name: name.trim(), email: email.trim(), phone, password, role });

export const getMe = () => api.get("/auth/me");

export const logout = () => api.post("/auth/logout");
