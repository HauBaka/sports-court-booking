import api from "./api";

export const login = ({ email, password }) =>
  api.post("/auth/login", { email: email.trim(), password });

// role bắt buộc là "customer" hoặc "owner"
export const register = ({ name, email, phone, password, role }) =>
  api.post("/auth/register", { name: name.trim(), email: email.trim(), phone, password, role });

export const getMe = () => api.get("/auth/me");

export const logout = () => api.post("/auth/logout");
