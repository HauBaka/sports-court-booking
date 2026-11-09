import api from "./api";

// GET /api/v1/holidays — danh sách ngày lễ để chọn holiday_id (spec 2.9).
export const getHolidays = () => api.get("/holidays");

// GET /api/v1/facilities/{id}/pricing-rules — lấy toàn bộ rules hiện tại (spec 2.8b).
export const getPricingRules = (facilityId) =>
  api.get(`/facilities/${facilityId}/pricing-rules`);

// POST /api/v1/facilities/{id}/pricing-rules — lưu toàn bộ rules (spec 2.8).
// Xóa rules cũ và thay bằng danh sách mới trong một lần gửi.
export const savePricingRules = (facilityId, rules) =>
  api.post(`/facilities/${facilityId}/pricing-rules`, { rules });
