/**
 * SlotGrid — lưới khung giờ trống của một sân con.
 *
 * Nhận `slots` trực tiếp từ response API 3.1:
 *   GET /api/v1/courts/{court_id}/slots?date=YYYY-MM-DD
 *
 * Mỗi slot có shape:
 *   { time_slot_id, start_time, end_time, base_price, status }
 *
 * Status từ API 3.1:
 *   AVAILABLE   — trống, có thể chọn
 *   HOLDING     — người khác đang giữ chỗ (chờ cọc)
 *   BOOKED      — đã đặt cọc
 *   UNAVAILABLE — đã qua giờ hoặc không khả dụng
 */

/** Map status API 3.1 → { className, label } */
const SLOT_STATUS = {
  AVAILABLE:   { cls: "",               label: "Trống" },
  HOLDING:     { cls: "slot--held",     label: "Đang giữ" },
  BOOKED:      { cls: "slot--taken",    label: "Đã cọc" },
  UNAVAILABLE: { cls: "slot--past",     label: "Không khả dụng" },
};

/** Format "HH:MM:SS" → "HH:MM" */
function fmtTime(t = "") {
  return t.slice(0, 5);
}

/** Format giá tiền VND ngắn gọn */
function fmtPrice(n) {
  if (!n) return "";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1) + "M";
  if (n >= 1_000) return Math.round(n / 1_000) + "K";
  return String(n);
}

/**
 * @param {{
 *   slots: Array<{
 *     time_slot_id: number,
 *     start_time: string,
 *     end_time: string,
 *     base_price: number,
 *     status: "AVAILABLE"|"HOLDING"|"BOOKED"|"UNAVAILABLE"
 *   }>,
 *   selected: number[],          // mảng time_slot_id đang chọn
 *   onToggle: (id: number) => void,
 *   showPrice?: boolean,         // hiện giá trong ô (mặc định true)
 * }} props
 */
export default function SlotGrid({ slots = [], selected = [], onToggle, showPrice = true }) {
  if (!slots.length) {
    return (
      <div className="empty" style={{ padding: "32px 24px" }}>
        <p>Không có khung giờ nào trong ngày này.</p>
      </div>
    );
  }

  return (
    <div className="slots-scroll" role="group" aria-label="Lưới khung giờ">
      <div
        className="grid-slots"
        style={{ "--cols": slots.length, gridTemplateColumns: `repeat(${slots.length}, minmax(72px, 1fr))` }}
      >
        {/* Header: giờ bắt đầu */}
        {slots.map((s) => (
          <span key={s.time_slot_id} className="gs-h">
            {fmtTime(s.start_time)}
          </span>
        ))}

        {/* Slots */}
        {slots.map((s) => {
          const isPicked = selected.includes(s.time_slot_id);
          const statusDef = SLOT_STATUS[s.status] ?? { cls: "", label: s.status };
          const unavailable = s.status === "BOOKED" || s.status === "UNAVAILABLE" || s.status === "HOLDING";
          const disabled = unavailable;

          let cls = "slot";
          if (isPicked) {
            cls += " slot--pick";
          } else if (statusDef.cls) {
            cls += ` ${statusDef.cls}`;
          }

          const label = isPicked
            ? "Đã chọn"
            : statusDef.label;

          return (
            <button
              key={s.time_slot_id}
              className={cls}
              disabled={disabled}
              aria-pressed={isPicked}
              aria-label={`${fmtTime(s.start_time)}–${fmtTime(s.end_time)}: ${label}`}
              onClick={() => !disabled && onToggle?.(s.time_slot_id)}
            >
              {label}
              {showPrice && s.base_price > 0 && !isPicked && (
                <small>{fmtPrice(s.base_price)}</small>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * SlotLegend — chú thích màu sắc cho lưới giờ.
 *
 * @param {{ owner?: boolean }} props
 *   owner=true  → chú giải cho view chủ sân (6 mục)
 *   owner=false → chú giải cho view khách đặt sân (5 mục, mặc định)
 */
export function SlotLegend({ owner = false }) {
  if (owner) {
    return (
      <div className="legend">
        <span><i />Trống</span>
        <span><i style={{ borderStyle: "dashed", borderColor: "var(--warn)" }} />Chờ cọc</span>
        <span><i style={{ background: "var(--accent-soft)", borderColor: "rgba(31,107,58,.3)" }} />Đã cọc</span>
        <span><i style={{ background: "var(--info-soft)", borderColor: "transparent" }} />Hoàn tất</span>
        <span><i style={{ borderStyle: "dotted" }} />Đã hủy</span>
        <span><i style={{ background: "var(--surface-3)", borderColor: "transparent" }} />Khóa</span>
      </div>
    );
  }
  return (
    <div className="legend">
      <span><i />Trống</span>
      <span><i style={{ background: "var(--accent)", borderColor: "transparent" }} />Đang chọn</span>
      <span><i style={{ borderStyle: "dashed", borderColor: "var(--warn)" }} />Người khác đang giữ</span>
      <span><i style={{ background: "var(--surface-3)", borderColor: "transparent" }} />Đã cọc</span>
      <span><i style={{ opacity: .4 }} />Đã qua giờ</span>
    </div>
  );
}
