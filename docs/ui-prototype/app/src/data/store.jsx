// Kho dữ liệu mock thay cho REST API: giữ trạng thái trong bộ nhớ và localStorage.
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import * as M from "./mock";
import { quote, refundFor, HOLD_MINUTES } from "../lib/pricing";
import { dateKey } from "../lib/format";

const KEY = "sanchung-prototype-v2";

function seed() {
  const s = {
    users: M.USERS, facilities: M.FACILITIES, bookings: M.BOOKINGS, holidays: M.HOLIDAYS,
    wallets: { ...M.WALLETS }, posts: M.TEAM_POSTS, reviews: M.REVIEWS, session: null, seq: 24830,
  };
  // tiền cọc trong lịch sử ví khớp với bảng tính giá
  s.transactions = M.TRANSACTIONS.map((t) => {
    const m = t.type === "DEPOSIT" && t.note.match(/SC-\d+/);
    const b = m && s.bookings.find((x) => x.id === m[0]);
    return b ? { ...t, amount: -bookingQuote(s, b).deposit } : t;
  });
  return s;
}

export function bookingQuote(state, b) {
  const facility = state.facilities.find((f) => f.id === b.facilityId);
  const court = facility.courts.find((c) => c.id === b.courtId);
  return quote({ facility, court, date: b.date, slots: b.slots, services: b.services, holidays: state.holidays.map((h) => h.date) });
}

const NAMES = ["Trần Hùng", "Lê Thu", "Phạm An", "Võ Dũng", "Hoàng Nam", "Đỗ Quyên", "Bùi Khoa", "Ngô Vy", "Đặng Tín", "Mai Linh"];
const hash = (str) => { let h = 2166136261; for (const c of str) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return ((h >>> 0) % 1000) / 1000; };

// Trạng thái từng khung giờ: đơn thật trong kho + lịch nền giả lập cho các ngày.
export function occupancy(state, facilityId, date) {
  const f = state.facilities.find((x) => x.id === facilityId);
  const map = {};
  const now = new Date();
  for (const c of f.courts) {
    map[c.id] = {};
    for (let h = Number(c.open.slice(0, 2)); h < Number(c.close.slice(0, 2)); h++) {
      const slot = `${String(h).padStart(2, "0")}:00`;
      const r = hash(c.id + date + slot);
      const busyHour = h >= 17 && h <= 20 ? 0.45 : h < 8 ? 0.2 : 0.12;
      if (r < busyHour) map[c.id][slot] = { status: "DEPOSITED", name: NAMES[Math.floor(r * 1000) % NAMES.length] };
      else if (r > 0.97) map[c.id][slot] = { status: "LOCKED", name: "Bảo trì" };
    }
  }
  for (const b of state.bookings) {
    if (b.facilityId !== facilityId || b.date !== date || !map[b.courtId]) continue;
    const expired = b.status === "PENDING_DEPOSIT" && b.holdUntil && new Date(b.holdUntil) < now;
    if (b.status === "CANCELLED" || expired) {
      for (const s of b.slots) if (!map[b.courtId][s]?.bookingId) map[b.courtId][s] = { status: "CANCELLED", name: userName(state, b.userId), bookingId: b.id, ghost: true };
      continue;
    }
    for (const s of b.slots) map[b.courtId][s] = { status: b.status, name: userName(state, b.userId), bookingId: b.id };
  }
  return map;
}

export const userName = (state, id) => state.users.find((u) => u.id === id)?.name ?? "Khách";

const Ctx = createContext(null);

export function StoreProvider({ children }) {
  const [state, setState] = useState(() => {
    let s = null;
    try { const saved = JSON.parse(localStorage.getItem(KEY)); if (saved?.users) s = saved; } catch { /* dữ liệu hỏng thì tạo lại */ }
    s ??= seed();
    // ?demo=customer|owner|admin: vào thẳng bằng tài khoản mẫu (để chụp màn hình, trình diễn)
    const demo = new URLSearchParams(location.search).get("demo");
    const u = demo && s.users.find((x) => x.role === demo);
    if (u) s = { ...s, session: { userId: u.id } };
    return s;
  });
  // bỏ ?demo khỏi địa chỉ để tải lại trang không đè vai trò vừa đổi
  useEffect(() => { if (location.search.includes("demo=")) history.replaceState(null, "", location.pathname + location.hash); }, []);
  useEffect(() => { localStorage.setItem(KEY, JSON.stringify(state)); }, [state]);

  // fn sửa trực tiếp bản sao; phải trả về bản sao (không phải s cũ), nếu không mọi thay đổi bị bỏ
  const update = useCallback((fn) => setState((s) => { const c = structuredClone(s); return fn(c) ?? c; }), []);

  const api = useMemo(() => {
    const tx = (s, userId, type, amount, note) => {
      s.transactions.unshift({ id: "T-" + (9100 + s.transactions.length), userId, type, amount, at: new Date().toISOString().slice(0, 16), note });
      s.wallets[userId] = (s.wallets[userId] ?? 0) + amount;
    };
    const ownerOf = (s, b) => s.facilities.find((f) => f.id === b.facilityId).ownerId;
    return {
      reset: () => setState(seed()),
      login: (email) => {
        const u = state.users.find((x) => x.email.toLowerCase() === email.trim().toLowerCase());
        if (!u) return { error: "Email hoặc mật khẩu chưa đúng." };
        update((s) => { s.session = { userId: u.id }; });
        return { user: u };
      },
      loginAs: (role) => update((s) => { s.session = { userId: s.users.find((u) => u.role === role).id }; }),
      logout: () => update((s) => { s.session = null; }),
      register: (data) => {
        if (state.users.some((u) => u.email === data.email)) return { error: "Email này đã có tài khoản." };
        if (state.users.some((u) => u.phone === data.phone)) return { error: "Số điện thoại này đã có tài khoản." };
        const id = "u-" + Date.now();
        update((s) => { s.users.push({ id, ...data, createdAt: dateKey(new Date()) }); s.wallets[id] = 0; s.session = { userId: id }; });
        return { id };
      },
      // Giữ chỗ và đặt cọc trong một bước. Ví thiếu tiền thì chỉ giữ chỗ 10 phút, trả về short.
      bookAndPay: ({ facilityId, courtId, date, slots, services }) => {
        const occ = occupancy(state, facilityId, date)[courtId];
        const clash = slots.find((x) => occ[x] && !occ[x].ghost);
        if (clash) return { error: `Khung ${clash} vừa có người đặt. Chọn giờ khác.` };
        const id = "SC-" + (state.seq + 1);
        const userId = state.session.userId;
        const b = { id, userId, facilityId, courtId, date, slots: [...slots].sort(), services, createdAt: dateKey(new Date()) };
        const { deposit } = bookingQuote(state, b);
        const short = Math.max(0, deposit - (state.wallets[userId] ?? 0));
        update((s) => {
          s.seq += 1;
          if (short) { s.bookings.unshift({ ...b, status: "PENDING_DEPOSIT", holdUntil: new Date(Date.now() + HOLD_MINUTES * 60000).toISOString() }); return; }
          s.bookings.unshift({ ...b, status: "DEPOSITED", paidAt: new Date().toISOString() });
          tx(s, userId, "DEPOSIT", -deposit, `Cọc đơn ${id}`);
          s.wallets.system += deposit;
        });
        return { id, short };
      },
      payDeposit: (id) => {
        const b = state.bookings.find((x) => x.id === id);
        if (b.holdUntil && new Date(b.holdUntil) < new Date()) return { error: "Hết thời gian giữ chỗ. Đơn đã hủy, hãy đặt lại." };
        const { deposit } = bookingQuote(state, b);
        if ((state.wallets[b.userId] ?? 0) < deposit) return { error: "Ví không đủ tiền để đặt cọc." };
        update((s) => {
          const x = s.bookings.find((y) => y.id === id);
          x.status = "DEPOSITED"; x.paidAt = new Date().toISOString();
          tx(s, x.userId, "DEPOSIT", -deposit, `Cọc đơn ${id}`);
          s.wallets.system += deposit;
        });
        return { ok: true };
      },
      cancelBooking: (id) => update((s) => {
        const b = s.bookings.find((y) => y.id === id);
        if (b.status === "DEPOSITED") {
          const { deposit } = bookingQuote(s, b);
          const r = refundFor(b.date, b.slots[0], deposit);
          if (r.amount) tx(s, b.userId, "REFUND", r.amount, `Hoàn ${r.pct}% cọc đơn ${id}`);
          if (r.forfeit) tx(s, ownerOf(s, b), "FORFEIT", r.forfeit, `Phần cọc không hoàn đơn ${id}`);
          s.wallets.system -= deposit;
          b.refund = { pct: r.pct, amount: r.amount };
        }
        b.status = "CANCELLED";
        s.posts = s.posts.map((p) => (p.bookingId === id ? { ...p, closed: true } : p));
      }),
      completeBooking: (id) => update((s) => {
        const b = s.bookings.find((y) => y.id === id);
        const { deposit } = bookingQuote(s, b);
        b.status = "COMPLETED";
        tx(s, ownerOf(s, b), "SETTLE", deposit, `Kết toán đơn ${id}`);
        s.wallets.system -= deposit;
      }),
      expireHolds: () => {
        let n = 0;
        update((s) => { for (const b of s.bookings) if (b.status === "PENDING_DEPOSIT" && (!b.holdUntil || new Date(b.holdUntil) < new Date())) { b.status = "CANCELLED"; n++; } });
        return n;
      },
      topup: (userId, amount, note) => update((s) => { tx(s, userId, "TOPUP", amount, note || "Admin cấp tiền"); }),
      saveFacility: (f) => update((s) => {
        const i = s.facilities.findIndex((x) => x.id === f.id);
        if (i >= 0) s.facilities[i] = f; else s.facilities.push(f);
      }),
      addHoliday: (h) => {
        if (state.holidays.some((x) => x.date === h.date)) return { error: "Ngày này đã có trong danh mục." };
        update((s) => { s.holidays.push({ id: "h" + Date.now(), ...h }); });
        return { ok: true };
      },
      review: (bookingId, stars, text) => update((s) => {
        const b = s.bookings.find((y) => y.id === bookingId);
        b.reviewed = true;
        (s.reviews[b.facilityId] ||= []).unshift({ by: userName(s, b.userId), stars, text, at: dateKey(new Date()) });
      }),
      createPost: (post) => update((s) => { s.posts.unshift({ id: "P-" + (40 + s.posts.length), applicants: [], ...post }); }),
      applyPost: (postId) => update((s) => { s.posts.find((p) => p.id === postId).applicants.push({ userId: s.session.userId, status: "PENDING" }); }),
      decide: (postId, userId, status) => update((s) => { s.posts.find((p) => p.id === postId).applicants.find((a) => a.userId === userId).status = status; }),
    };
  }, [state, update]);

  const me = state.session ? state.users.find((u) => u.id === state.session.userId) : null;
  const value = useMemo(() => ({ state, api, me }), [state, api, me]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useStore = () => useContext(Ctx);
