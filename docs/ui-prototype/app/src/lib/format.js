export const vnd = (n) => (n < 0 ? "−" : "") + Math.abs(Math.round(n)).toLocaleString("vi-VN") + "đ";
export const signedVnd = (n) => (n > 0 ? "+" : "") + vnd(n);

export const addDays = (date, n) => { const d = new Date(date); d.setDate(d.getDate() + n); return d; };
export const dateKey = (date) => {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
export const parseKey = (key) => { const [y, m, d] = key.split("-").map(Number); return new Date(y, m - 1, d); };

const WD = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
const WD_LONG = ["Chủ nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"];
export const shortDay = (key) => { const d = parseKey(key); return `${WD[d.getDay()]} ${d.getDate()}/${d.getMonth() + 1}`; };
export const longDay = (key) => { const d = parseKey(key); return `${WD_LONG[d.getDay()]}, ${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`; };
export const isWeekend = (key) => [0, 6].includes(parseKey(key).getDay());

export const hourOf = (t) => Number(t.slice(0, 2));
export const hh = (h) => `${String(h).padStart(2, "0")}:00`;
export const hoursBetween = (open, close) => { const out = []; for (let h = hourOf(open); h < hourOf(close); h++) out.push(hh(h)); return out; };
export const slotRange = (slots) => {
  if (!slots.length) return "";
  const s = [...slots].sort();
  return `${s[0]}–${hh(hourOf(s[s.length - 1]) + 1)}`;
};
export const dateTime = (iso) => { const [d, t] = iso.split("T"); return `${shortDay(d)} · ${t}`; };
export const initials = (name) => name.split(" ").slice(-2).map((w) => w[0]).join("").toUpperCase();
