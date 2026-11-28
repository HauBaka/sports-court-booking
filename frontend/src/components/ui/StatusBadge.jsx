/**
 * StatusBadge — hiển thị trạng thái đơn đặt sân.
 * Tên và nhãn theo QĐ7:
 *   PENDING_DEPOSIT → Chờ đặt cọc
 *   DEPOSITED       → Đã đặt cọc
 *   COMPLETED       → Đã thanh toán hoàn tất
 *   CANCELLED       → Đã hủy
 */

export const BOOKING_STATUS = {
  PENDING_DEPOSIT: { label: "Chờ đặt cọc", cls: "badge--pending" },
  DEPOSITED:       { label: "Đã đặt cọc",  cls: "badge--deposited" },
  COMPLETED:       { label: "Đã thanh toán hoàn tất", cls: "badge--completed" },
  CANCELLED:       { label: "Đã hủy",      cls: "badge--cancelled" },
};

/**
 * @param {{ status: "PENDING_DEPOSIT"|"DEPOSITED"|"COMPLETED"|"CANCELLED" }} props
 */
export default function StatusBadge({ status }) {
  const def = BOOKING_STATUS[status];
  if (!def) return <span className="badge">{status}</span>;
  return <span className={`badge ${def.cls}`}>{def.label}</span>;
}
