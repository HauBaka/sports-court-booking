import api from "./api";

// GET /api/v1/courts/{court_id} — xem chi tiết sân con (spec 2.6).
export const getCourt = (courtId) => api.get(`/courts/${courtId}`);

// PATCH /api/v1/courts/{court_id} — cập nhật thông tin sân con (spec 2.7).
// Tất cả field đều optional (partial update).
export const updateCourt = (courtId, payload) => api.patch(`/courts/${courtId}`, payload);
