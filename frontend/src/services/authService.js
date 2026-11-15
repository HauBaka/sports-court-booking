import api from "./api";

export const login = ({ email, password }) =>
  api.post("/auth/login", { email: email.trim(), password });

// purpose: "REGISTER" hoặc "RESET_PASSWORD"
export const sendOtp = ({ email, purpose }) =>
  api.post("/auth/otp", { email: email.trim(), purpose });

// role bắt buộc là "customer" hoặc "owner"; otp_code là mã 6 số nhận qua email (purpose REGISTER)
export const register = ({ name, email, phone, password, role, otp_code }) =>
  api.post("/auth/register", { name: name.trim(), email: email.trim(), phone, password, role, otp_code });

export const resetPassword = ({ email, otp_code, new_password }) =>
  api.post("/auth/password/reset", { email: email.trim(), otp_code, new_password });

export const getMe = () => api.get("/auth/me");

export const logout = () => api.post("/auth/logout");
