import { addDays, dateKey, hoursBetween, hourOf, parseKey } from "../lib/format";
import { sportName } from "../data/mock";

const WD = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

export function DayStrip({ value, onChange, days = 7, start = new Date() }) {
  return (
    <div className="days" role="tablist" aria-label="Chọn ngày">
      {Array.from({ length: days }, (_, i) => {
        const k = dateKey(addDays(start, i));
        const d = parseKey(k);
        return (
          <button key={k} role="tab" aria-selected={k === value} className={"day" + (k === value ? " on" : "")} onClick={() => onChange(k)}>
            <span>{i === 0 ? "Hôm nay" : WD[d.getDay()]}</span><b>{d.getDate()}</b><span>Th{d.getMonth() + 1}</span>
          </button>
        );
      })}
    </div>
  );
}

const isPast = (date, slot) => {
  const t = parseKey(date); t.setHours(hourOf(slot));
  return t < new Date();
};

// mode "customer": chọn ô trống; mode "owner": xem trạng thái và tên khách.
export function SlotGrid({ facility, date, occ, mode = "customer", selected, onToggle, onOpen, statusFilter }) {
  const courts = facility.courts.filter((c) => c.active || mode === "owner");
  const hours = hoursBetween(facility.open, facility.close);
  return (
    <div className="slots-scroll">
      <div className="grid-slots" style={{ "--cols": hours.length }}>
        <span />
        {hours.map((h) => <span key={h} className="gs-h">{h}</span>)}
        {courts.map((c) => (
          <Row key={c.id} {...{ c, hours, date, occ: occ[c.id] || {}, mode, selected, onToggle, onOpen, statusFilter }} />
        ))}
      </div>
    </div>
  );
}

function Row({ c, hours, date, occ, mode, selected, onToggle, onOpen, statusFilter }) {
  return (
    <>
      <span className="gs-c">{c.name}<small>{sportName(c.sport)}{!c.active && " · tạm ngưng"}</small></span>
      {hours.map((h) => {
        const inHours = hourOf(h) >= hourOf(c.open) && hourOf(h) < hourOf(c.close);
        const o = occ[h];
        const past = isPast(date, h);
        if (mode === "owner") {
          let cls = "slot", label = "Trống", sub = null;
          if (!c.active || !inHours) { cls += " slot--locked"; label = "Khóa"; sub = !c.active ? "Tạm ngưng" : null; }
          else if (o) {
            const map = { DEPOSITED: ["slot--deposited", "Đã cọc"], PENDING_DEPOSIT: ["slot--held", "Chờ cọc"], COMPLETED: ["slot--completed", "Hoàn tất"], CANCELLED: ["slot--cancelled", "Đã hủy"], LOCKED: ["slot--locked", "Khóa"] };
            [cls, label] = ["slot " + map[o.status][0], map[o.status][1]]; sub = o.name;
          }
          const hidden = statusFilter && statusFilter !== "ALL" && !(o ? o.status === statusFilter : statusFilter === "FREE");
          return (
            <button key={h} className={cls} style={hidden ? { opacity: .18 } : null} onClick={() => o?.bookingId && onOpen?.(o.bookingId)} aria-label={`${c.name} ${h}: ${label}${sub ? ", " + sub : ""}`}>
              {label}{sub && <small>{sub}</small>}
            </button>
          );
        }
        const picked = selected?.courtId === c.id && selected.slots.includes(h);
        const taken = o && !o.ghost;
        let cls = "slot", label = "Trống";
        if (!inHours) { cls += " slot--locked"; label = "Đóng"; }
        else if (taken && o.status === "PENDING_DEPOSIT") { cls += " slot--held"; label = "Đang giữ"; }
        else if (taken && o.status === "LOCKED") { cls += " slot--locked"; label = o.name; }
        else if (taken) { cls += " slot--taken"; label = "Đã cọc"; }
        else if (picked) { cls += " slot--pick"; label = "Đã chọn"; }
        if (past && !picked) cls += " slot--past";
        const disabled = !inHours || taken || past;
        return (
          <button key={h} className={cls} disabled={disabled} aria-pressed={picked} onClick={() => onToggle(c.id, h)} aria-label={`${c.name} ${h}: ${label}`}>{label}</button>
        );
      })}
    </>
  );
}

export function SlotLegend({ owner }) {
  return owner ? (
    <div className="legend">
      <span><i />Trống</span>
      <span><i style={{ borderStyle: "dashed", borderColor: "var(--warn)" }} />Chờ cọc</span>
      <span><i style={{ background: "var(--accent-soft)", borderColor: "rgba(31,107,58,.3)" }} />Đã cọc</span>
      <span><i style={{ background: "var(--info-soft)", borderColor: "transparent" }} />Hoàn tất</span>
      <span><i style={{ borderStyle: "dotted" }} />Đã hủy</span>
      <span><i style={{ background: "var(--surface-3)", borderColor: "transparent" }} />Khóa</span>
    </div>
  ) : (
    <div className="legend">
      <span><i />Trống</span>
      <span><i style={{ background: "var(--accent)", borderColor: "transparent" }} />Đang chọn</span>
      <span><i style={{ borderStyle: "dashed", borderColor: "var(--warn)" }} />Người khác đang giữ</span>
      <span><i style={{ background: "var(--surface-3)", borderColor: "transparent" }} />Đã cọc</span>
    </div>
  );
}
