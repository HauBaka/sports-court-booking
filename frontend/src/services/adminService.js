import api from "./api";

// GET /admin/users — tìm người dùng, phân trang (spec 5.4)
export const searchUsers = ({ search, page = 1, limit = 10 } = {}) =>
  api.get("/admin/users", {
    params: { page, limit, ...(search ? { search } : {}) },
  });

// POST /admin/wallet-topups — admin cấp tiền vào ví người dùng (spec 5.3)
export const topupWallet = ({ user_id, amount, reason }) =>
  api.post("/admin/wallet-topups", { user_id, amount, reason });

// GET /admin/wallet-topups — lịch sử cấp tiền gần đây
export const getTopupHistory = ({ page = 1, limit = 5 } = {}) =>
  api.get("/admin/wallet-topups", { params: { page, limit } });

// GET /holidays — danh mục ngày lễ (spec 2.9, public)
export const listHolidays = () => api.get("/holidays");

// POST /admin/holidays — thêm ngày lễ mới (spec 2.10, admin only)
export const createHoliday = ({ name, holiday_date, recurring_yearly }) =>
  api.post("/admin/holidays", { name, holiday_date, recurring_yearly });
