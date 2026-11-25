// Mô phỏng phần Backend tính tiền (QĐ1, QĐ2, QĐ4, QĐ5). Giao diện thật sẽ lấy kết quả từ API.
import { hourOf, isWeekend, parseKey } from "./format";

export const DEPOSIT_RATE = 0.3;
export const HOLD_MINUTES = 10;

const inPeak = (rule, slot) => hourOf(slot) >= hourOf(rule.from) && hourOf(slot) < hourOf(rule.to);

// Hệ số cao nhất trong các quy tắc khớp (QĐ1).
export function multiplierFor(rules, dateKey, slot, holidays = []) {
  let best = { value: 1, label: "Giờ thường" };
  for (const r of rules) {
    const hit = (r.type === "PEAK" && inPeak(r, slot)) || (r.type === "WEEKEND" && isWeekend(dateKey)) || (r.type === "HOLIDAY" && holidays.includes(dateKey));
    if (hit && r.multiplier > best.value) best = { value: r.multiplier, label: r.label };
  }
  return best;
}

export function quote({ facility, court, date, slots, services = [], holidays = [] }) {
  const lines = [...slots].sort().map((slot) => {
    const m = multiplierFor(facility.rules, date, slot, holidays);
    return { slot, base: court.price, multiplier: m.value, label: m.label, amount: Math.round(court.price * m.value) };
  });
  const serviceLines = services.filter((s) => s.qty > 0).map((s) => {
    const sv = facility.services.find((x) => x.id === s.id);
    return { ...sv, qty: s.qty, amount: sv.price * s.qty };
  });
  const courtTotal = lines.reduce((a, l) => a + l.amount, 0);
  const serviceTotal = serviceLines.reduce((a, l) => a + l.amount, 0);
  const total = courtTotal + serviceTotal;
  const deposit = Math.floor(total * DEPOSIT_RATE);
  return { lines, serviceLines, courtTotal, serviceTotal, total, deposit, remaining: total - deposit };
}

// QĐ5: tỉ lệ hoàn theo số giờ còn lại đến giờ chơi.
export function refundFor(dateKey, firstSlot, deposit, now = new Date()) {
  const start = parseKey(dateKey); start.setHours(hourOf(firstSlot), 0, 0, 0);
  const hours = (start - now) / 36e5;
  const pct = hours >= 24 ? 80 : hours >= 12 ? 50 : 0;
  const amount = Math.floor((deposit * pct) / 100);
  return { hours, pct, amount, forfeit: deposit - amount, started: hours <= 0 };
}

export const playStarted = (dateKey, firstSlot, now = new Date()) => refundFor(dateKey, firstSlot, 0, now).started;
