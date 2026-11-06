import api from "./api";

export const listFacilities = (params) => api.get("/facilities", { params });

export const createFacility = (payload) => api.post("/facilities", payload);

// GET /facilities chưa có bộ lọc theo chủ sân (docs/api-endpoints.md mục 2.1),
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
