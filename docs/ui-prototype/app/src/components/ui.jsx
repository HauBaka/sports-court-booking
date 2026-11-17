import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { vnd } from "../lib/format";

const P = {
  search: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14Zm9 16-4-4",
  pin: "M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21Zm0-9a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z",
  star: "M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9L12 3.5Z",
  calendar: "M5 6h14v14H5zM5 10h14M9 3v4M15 3v4",
  wallet: "M4 7h14a2 2 0 0 1 2 2v9H4zM4 7V6a2 2 0 0 1 2-2h10v3M16 13h1",
  clock: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-13v5l3 2",
  check: "M5 12.5l4.5 4.5L19 7.5",
  x: "M6 6l12 12M18 6 6 18",
  plus: "M12 5v14M5 12h14",
  chevR: "M9 6l6 6-6 6",
  chevL: "M15 6l-6 6 6 6",
  chevD: "M6 9l6 6 6-6",
  home: "M4 11 12 4l8 7v9h-5v-6H9v6H4z",
  court: "M4 5h16v14H4zM12 5v14M4 12h16M8 9v6M16 9v6",
  tag: "M3 12V4h8l9 9-8 8-9-9Zm5-4h.01",
  users: "M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm-6 9c.6-3 3-5 6-5s5.4 2 6 5M16 4.5a3.5 3.5 0 0 1 0 6.5M18 15c1.6.6 2.7 2.4 3 5",
  chart: "M4 20V10M10 20V4M16 20v-7M22 20H2",
  box: "M4 7l8-4 8 4v10l-8 4-8-4zM4 7l8 4 8-4M12 11v10",
  gift: "M4 10h16v10H4zM2 7h20v3H2zM12 7v13M12 7S10 3 8 3.5 7 7 12 7Zm0 0s2-4 4-3.5S17 7 12 7Z",
  list: "M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01",
  logout: "M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10",
  user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 9c.8-3.5 3.6-6 7-6s6.2 2.5 7 6",
  menu: "M4 7h16M4 17h16",
  sun: "M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10ZM12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2",
  info: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-11v6m0-9h.01",
  alert: "M12 3 2 20h20L12 3Zm0 6v5m0 3h.01",
  arrowR: "M5 12h14M13 6l6 6-6 6",
  refresh: "M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7",
  edit: "M4 20h4L19 9l-4-4L4 16zM14 6l4 4",
  trash: "M5 7h14M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3",
  ball: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM5 6.5c3 2 4 6 3 11M19 6.5c-3 2-4 6-3 11",
  mail: "M3 6h18v12H3zM3 7l9 6 9-6",
  shield: "M12 3 4 6v6c0 4.5 3.4 8 8 9 4.6-1 8-4.5 8-9V6l-8-3Z",
};

export function Icon({ name, size = 18, fill = false, ...rest }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={fill ? "currentColor" : "none"} stroke={fill ? "none" : "currentColor"} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...rest}>
      <path d={P[name]} />
    </svg>
  );
}

export const Logo = ({ to = "../index.html" }) =>
  to.startsWith("..") ? <a className="logo" href={to}><span className="logo__mark" />Sân Chung</a>
    : <Link className="logo" to={to}><span className="logo__mark" />Sân Chung</Link>;

export const STATUS = {
  PENDING_DEPOSIT: { label: "Chờ đặt cọc", cls: "pending" },
  DEPOSITED: { label: "Đã cọc", cls: "deposited" },
  COMPLETED: { label: "Hoàn tất", cls: "completed" },
  CANCELLED: { label: "Đã hủy", cls: "cancelled" },
};
export const StatusBadge = ({ status }) => <span className={`badge badge--${STATUS[status].cls}`}>{STATUS[status].label}</span>;

export const TX_TYPES = {
  TOPUP: "Admin cấp tiền", DEPOSIT: "Đặt cọc", REFUND: "Hoàn cọc", FORFEIT: "Cọc không hoàn", SETTLE: "Kết toán",
};

export function Rating({ value, count }) {
  return <span className="rating"><Icon name="star" size={14} fill />{value.toFixed(1)}{count != null && <span className="muted">({count} đánh giá)</span>}</span>;
}

export function Modal({ title, children, onClose, footer }) {
  useEffect(() => {
    const k = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  return (
    <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title}>
        <h2>{title}</h2>
        {children}
        {footer && <div className="modal__foot">{footer}</div>}
      </div>
    </div>
  );
}

export const Empty = ({ title, children }) => <div className="empty"><h3>{title}</h3><div>{children}</div></div>;

const ToastCtx = createContext(() => {});
export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const push = useCallback((text) => {
    const id = Math.random();
    setItems((x) => [...x, { id, text }]);
    setTimeout(() => setItems((x) => x.filter((t) => t.id !== id)), 3200);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toasts" role="status">{items.map((t) => <div className="toast" key={t.id}><i />{t.text}</div>)}</div>
    </ToastCtx.Provider>
  );
}
export const useToast = () => useContext(ToastCtx);

export function Switch({ checked, onChange, label }) {
  return <button type="button" role="switch" aria-checked={checked} aria-label={label} className="switch" onClick={() => onChange(!checked)} />;
}

export function Stepper({ value, onChange, min = 0, max = 20, label }) {
  return (
    <span className="stepper" aria-label={label}>
      <button type="button" onClick={() => onChange(Math.max(min, value - 1))} aria-label="Bớt">−</button>
      <span>{value}</span>
      <button type="button" onClick={() => onChange(Math.min(max, value + 1))} aria-label="Thêm">+</button>
    </span>
  );
}

export function useCountdown(until) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  const left = Math.max(0, new Date(until) - now);
  const m = Math.floor(left / 60000), s = Math.floor((left % 60000) / 1000);
  return { left, text: `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` };
}

const reduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// Số chạy từ giá trị cũ (hoặc from) tới giá trị mới, giảm tốc dần.
export function useCountUp(value, from = value, ms = 600) {
  const [v, setV] = useState(from);
  const cur = useRef(from);
  useEffect(() => {
    const start = cur.current;
    if (start === value || reduced()) { cur.current = value; setV(value); return; }
    let raf, t0;
    const step = (t) => {
      t0 ??= t;
      const k = Math.min(1, (t - t0) / ms);
      cur.current = start + (value - start) * (1 - Math.pow(1 - k, 3));
      setV(cur.current);
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, ms]);
  return v;
}
export const Count = ({ value, from, format = vnd }) => format(useCountUp(value, from));

// Vòng đếm ngược giữ chỗ 10 phút.
export function HoldRing({ until, total = 10 * 60000 }) {
  const { left, text } = useCountdown(until);
  const C = 2 * Math.PI * 15;
  return (
    <span className="hold-ring" aria-live="polite">
      <svg width="36" height="36" viewBox="0 0 36 36" aria-hidden="true"><circle className="track" cx="18" cy="18" r="15" /><circle className="val" cx="18" cy="18" r="15" strokeDasharray={C} strokeDashoffset={C * (1 - left / total)} /></svg>
      <span><span className="hold-ring__label">Giữ chỗ còn </span>{text}</span>
    </span>
  );
}
