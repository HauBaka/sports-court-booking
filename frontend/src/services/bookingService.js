import api from "./api";

// POST /api/v1/bookings/calculate-price — tính tiền trước khi đặt (spec 3.2).
export const calculatePrice = (payload) =>
  api.post("/bookings/calculate-price", payload);

// POST /api/v1/bookings — tạo đơn & giữ chỗ 10 phút (spec 3.3).
export const createBooking = (payload) =>
  api.post("/bookings", payload);
