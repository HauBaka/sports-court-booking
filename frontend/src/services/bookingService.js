import api from "./api";

// POST /api/v1/bookings/calculate-price — tính tiền trước khi đặt (spec 3.2).
export const calculatePrice = (payload) =>
  api.post("/bookings/calculate-price", payload);

// POST /api/v1/bookings — tạo đơn & giữ chỗ 10 phút (spec 3.3).
export const createBooking = (payload) =>
  api.post("/bookings", payload);

// GET /api/v1/bookings/:id — chi tiết đơn đặt sân (spec 3.6).
export const getBookingDetail = (bookingId) =>
  api.get(`/bookings/${bookingId}`);

// POST /api/v1/bookings/:id/deposit — thanh toán cọc 30% qua ví (spec 3.4).
export const depositBooking = (bookingId) =>
  api.post(`/bookings/${bookingId}/deposit`);
