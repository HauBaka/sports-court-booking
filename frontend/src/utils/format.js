// "06:00:00" -> "06:00"
export const formatTime = (t) => (t ? t.slice(0, 5) : "");

const vnd = new Intl.NumberFormat("vi-VN");
export const formatVnd = (amount) => `${vnd.format(amount)} ₫`;

export function formatPriceRange(min, max) {
  if (!max) return "Chưa có bảng giá";
  return min === max ? formatVnd(min) : `${formatVnd(min)} – ${formatVnd(max)}`;
}
