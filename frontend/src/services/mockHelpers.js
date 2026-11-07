// Dạng response giả dùng chung cho các module mock (xem docs/api-conventions.md).
export const ok = (status, message, data, meta) => ({
  status,
  body: { success: true, message, data, ...(meta && { meta }) },
});

export const fail = (status, code, message, details = null) => ({
  status,
  body: { success: false, error: { code, message, details } },
});
