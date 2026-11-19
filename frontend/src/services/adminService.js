import api from "./api";

// GET /admin/users — tìm người dùng, phân trang (spec 5.4)
export const searchUsers = ({ search, page = 1, limit = 10 } = {}) =>
  api.get("/admin/users", {
    params: { page, limit, ...(search ? { search } : {}) },
  });

// POST /admin/wallet-topups — admin cấp tiền vào ví người dùng (spec 5.3)
export const topupWallet = ({ user_id, amount, reason }) =>
  api.post("/admin/wallet-topups", { user_id, amount, reason });
