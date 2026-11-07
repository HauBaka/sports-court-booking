import api from "./api";

export const listFacilities = (params) => api.get("/facilities", { params });

export const createFacility = (payload) => api.post("/facilities", payload);

// GET /facilities/:id trả kèm courts[] nhúng bên trong data (theo API spec 2.2).
export const getFacility = (id) => api.get(`/facilities/${id}`);

// POST /facilities/:id/courts — tạo sân con mới (spec 2.5).
export const createCourt = (facilityId, payload) =>
  api.post(`/facilities/${facilityId}/courts`, payload);

// GET /facilities chưa có bộ lọc theo chủ sân (spec 2.1),
// nên duyệt qua các trang rồi lọc theo owner_id ở FE. Đổi sang bộ lọc của BE khi có.
export async function listMyFacilities(ownerId) {
  const mine = [];
  let page = 1;
  let totalPages = 1;
  do {
    const res = await listFacilities({ page, limit: 100 });
    mine.push(...res.data.filter((f) => f.owner_id === ownerId));
    totalPages = res.meta?.total_pages ?? 1;
    page += 1;
  } while (page <= totalPages);
  return mine;
}
