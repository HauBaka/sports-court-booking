/**
 * DayStrip — dải nút chọn ngày (7 ngày tính từ hôm nay).
 * Tách ra từ CourtDetailPage để dùng lại.
 *
 * @param {{
 *   dates: string[],       // mảng "YYYY-MM-DD"
 *   value: string,         // ngày đang chọn
 *   onChange: (d: string) => void,
 * }} props
 */

const WD = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

export default function DayStrip({ dates, value, onChange }) {
  return (
    <div className="days" role="tablist" aria-label="Chọn ngày">
      {dates.map((d, i) => {
        const dt  = new Date(d + "T00:00:00");
        const dow = i === 0 ? "Hôm nay" : WD[dt.getDay()];
        const day = dt.getDate();
        const mon = `Th${dt.getMonth() + 1}`;
        return (
          <button
            key={d}
            role="tab"
            aria-selected={d === value}
            className={"day" + (d === value ? " on" : "")}
            onClick={() => onChange(d)}
          >
            <span>{dow}</span>
            <b>{day}</b>
            <span>{mon}</span>
          </button>
        );
      })}
    </div>
  );
}
