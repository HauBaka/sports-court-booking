import axios from "axios";
import { mockAdapter } from "./mockAdapter";

const USE_MOCK = import.meta.env.VITE_USE_MOCK === "true";
const PUBLIC_PATHS = ["/auth/login", "/auth/register"];
// Chỉ các lỗi này mới nghĩa là phiên hỏng. Sai mật khẩu cũng là 401 nhưng phải hiện lỗi tại form.
const TOKEN_ERRORS = ["AUTH_TOKEN_EXPIRED", "AUTH_TOKEN_INVALID", "AUTH_UNAUTHORIZED"];

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:8000/api/v1",
  timeout: 10000,
  headers: { "Content-Type": "application/json" },
  ...(USE_MOCK && { adapter: mockAdapter }),
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("access_token");
  if (token && !PUBLIC_PATHS.includes(config.url)) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const status = error.response?.status;
    const errorData = error.response?.data?.error;

    if (status === 401 && TOKEN_ERRORS.includes(errorData?.code)) {
      localStorage.removeItem("access_token");
      window.location.href = "/login?expired=true";
    }

    return Promise.reject(
      errorData || {
        code: "NETWORK_ERROR",
        message: "Không thể kết nối đến máy chủ. Vui lòng thử lại!",
      }
    );
  }
);

export default api;
