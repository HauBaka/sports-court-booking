import api from "./api";

// GET /wallets/me — số dư ví (spec 5.1)
export const getMyWallet = () => api.get("/wallets/me");

// GET /wallets/me/transactions — lịch sử, phân trang, lọc theo loại (spec 5.2)
export const getMyTransactions = ({ type, page = 1, limit = 10 } = {}) =>
  api.get("/wallets/me/transactions", {
    params: { page, limit, ...(type ? { type } : {}) },
  });
