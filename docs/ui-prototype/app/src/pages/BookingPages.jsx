import { useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { useStore, bookingQuote } from "../data/store";
import { longDay, slotRange, vnd } from "../lib/format";
import { quote } from "../lib/pricing";
import { Count, HoldRing, Icon, Stepper, useCountdown, useToast } from "../components/ui";

const Steps = ({ at }) => (
  <ol className="steps" aria-label="Các bước">
    {["Chọn giờ", "Đặt cọc", "Xong"].map((s, i) => <li key={s} className={i <= at ? "on" : ""} aria-current={i === at ? "step" : undefined}>{s}</li>)}
  </ol>
);

function BillCard({ facility, court, date, slots, q, children }) {
  return (
    <div className="card">
      <div className="row" style={{ "--gap": "14px", marginBottom: 18 }}>
        <img src={facility.photos[0]} alt="" style={{ width: 64, height: 64, borderRadius: 12, objectFit: "cover" }} />
        <div><div style={{ fontWeight: 500 }}>{facility.name}</div><div className="small muted">{court.name} · {longDay(date)} · <span className="mono">{slotRange(slots)}</span></div></div>
      </div>
      {q.lines.map((l) => <div key={l.slot} className="bill-row"><span>{l.slot}–{String(+l.slot.slice(0, 2) + 1).padStart(2, "0")}:00<small>{l.label}{l.multiplier !== 1 && ` × ${String(l.multiplier).replace(".", ",")}`}</small></span><span className="num">{vnd(l.amount)}</span></div>)}
      {q.serviceLines.map((s) => <div key={s.id} className="bill-row slide-in"><span>{s.name}<small>{s.qty} {s.unit}</small></span><span className="num">{vnd(s.amount)}</span></div>)}
      <div className="bill-total"><span className="muted">Tổng tiền</span><b><Count value={q.total} /></b></div>
      <dl className="kv small" style={{ marginTop: 10 }}><dt>Cọc 30% từ ví</dt><dd className="num">{vnd(q.deposit)}</dd><dt>Trả tại sân</dt><dd className="num">{vnd(q.remaining)}</dd></dl>
      {children}
    </div>
  );
}

export function BookingConfirmPage() {
  const { state, api, me } = useStore();
  const nav = useNavigate();
  const toast = useToast();
  // đọc nháp một lần: sau khi đặt, nháp bị xóa nhưng trang không được tự chuyển về tìm sân
  const [draft] = useState(() => JSON.parse(sessionStorage.getItem("sanchung-draft") || "null"));
  const [qty, setQty] = useState({});
  const [err, setErr] = useState("");
  if (!draft) return <Navigate to="/tim-san" replace />;
  const f = state.facilities.find((x) => x.id === draft.facilityId);
  const court = f.courts.find((c) => c.id === draft.courtId);
  const services = Object.entries(qty).map(([id, n]) => ({ id, qty: n }));
  const q = quote({ facility: f, court, date: draft.date, slots: draft.slots, services, holidays: state.holidays.map((h) => h.date) });
  const balance = state.wallets[me.id] ?? 0;
  const active = f.services.filter((s) => s.active);

  const book = () => {
    const r = api.bookAndPay({ ...draft, services: services.filter((s) => s.qty > 0) });
    if (r.error) return setErr(r.error);
    sessionStorage.removeItem("sanchung-draft");
    if (r.short) { toast("Ví chưa đủ, đã giữ chỗ 10 phút"); return nav(`/dat-san/${r.id}`, { replace: true }); }
    toast("Đặt cọc thành công");
    nav(`/dat-san/${r.id}/xong`, { replace: true });
  };

  return (
    <main className="page"><div className="wrap" style={{ maxWidth: 980 }}>
      <nav className="crumbs"><Link to={`/san/${f.id}`}>{f.name}</Link><span>/</span><span className="ink2">Đặt cọc</span></nav>
      <Steps at={1} />
      <div className="pay-grid">
      <BillCard facility={f} court={court} date={draft.date} slots={draft.slots} q={q} />
      <aside className="card pay-side">
        <h2>Đặt cọc 30%</h2>
        <p className="small muted" style={{ marginTop: 4 }}>Trừ từ ví ngay khi bấm. Phần còn lại trả tại sân.</p>
        {active.length > 0 && (
          <details className="fold" style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--line)" }}>
            <summary>Thêm dịch vụ <span className="row small muted" style={{ "--gap": "6px", fontWeight: 400 }}>Không bắt buộc<Icon name="chevD" size={16} /></span></summary>
            <div className="fold__body" style={{ marginTop: 6 }}>
              {active.map((s) => (
                <div key={s.id} className="bill-row" style={{ alignItems: "center" }}>
                  <span>{s.name}<small>{vnd(s.price)} / {s.unit}</small></span>
                  <Stepper label={s.name} value={qty[s.id] || 0} onChange={(n) => setQty({ ...qty, [s.id]: n })} />
                </div>
              ))}
            </div>
          </details>
        )}
        <div className="row between small" style={{ marginTop: 14 }}><span className="muted">Số dư ví</span><span className="mono">{vnd(balance)}</span></div>
        {err && <div className="notice notice--danger" style={{ marginTop: 14 }}><Icon name="alert" />{err}</div>}
        <button className="btn btn--primary btn--block btn--lg" style={{ marginTop: 16 }} onClick={book}>Đặt cọc&nbsp;<Count value={q.deposit} /></button>
        <Link to={`/san/${f.id}`} className="btn btn--ghost btn--block" style={{ marginTop: 8 }}>Chọn lại giờ</Link>
        <p className="small muted" style={{ marginTop: 12, textAlign: "center" }}>Hủy trước 24 giờ hoàn 80% cọc, 12 đến 24 giờ hoàn 50%.</p>
      </aside>
      </div>
    </div></main>
  );
}

// Chỉ dùng khi ví chưa đủ: đơn đang giữ chỗ 10 phút, chờ cọc.
export function BookingPayPage() {
  const { id } = useParams();
  const { state, api, me } = useStore();
  const nav = useNavigate();
  const toast = useToast();
  const b = state.bookings.find((x) => x.id === id);
  const { left } = useCountdown(b?.holdUntil || 0);
  const [err, setErr] = useState("");
  if (!b) return <Navigate to="/lich-dat" replace />;
  if (b.status !== "PENDING_DEPOSIT") return <Navigate to={`/dat-san/${id}/xong`} replace />;
  const f = state.facilities.find((x) => x.id === b.facilityId);
  const court = f.courts.find((c) => c.id === b.courtId);
  const q = bookingQuote(state, b);
  const balance = state.wallets[me.id] ?? 0;
  const short = balance < q.deposit;
  const expired = left === 0;

  const pay = () => {
    const r = api.payDeposit(id);
    if (r.error) return setErr(r.error);
    toast("Đặt cọc thành công");
    nav(`/dat-san/${id}/xong`, { replace: true });
  };

  return (
    <main className="page"><div className="wrap" style={{ maxWidth: 980 }}>
      <Steps at={1} />
      <div className="row between" style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 28 }}>Đơn {id}</h1>
        {!expired && <HoldRing until={b.holdUntil} />}
      </div>
      <div className="pay-grid">
      <BillCard facility={f} court={court} date={b.date} slots={b.slots} q={q} />
      <aside className="card pay-side">
        <h2>Đặt cọc {vnd(q.deposit)}</h2>
        <div className="row between small" style={{ marginTop: 10 }}><span className="muted">Số dư ví</span><span className="mono">{vnd(balance)}</span></div>
        {expired ? <div className="notice notice--danger" style={{ marginTop: 14 }}><Icon name="alert" />Hết giờ giữ chỗ. Chọn giờ lại.</div>
          : short && <div className="notice notice--warn" style={{ marginTop: 14 }}><Icon name="wallet" />Ví thiếu {vnd(q.deposit - balance)}. Nhờ Admin cấp tiền rồi bấm đặt cọc.</div>}
        {err && <div className="notice notice--danger" style={{ marginTop: 14 }}><Icon name="alert" />{err}</div>}
        <button className="btn btn--primary btn--block btn--lg" style={{ marginTop: 16 }} disabled={expired || short} onClick={pay}>Đặt cọc {vnd(q.deposit)}</button>
        <button className="btn btn--ghost btn--block" style={{ marginTop: 8 }} onClick={() => { api.cancelBooking(id); nav(`/san/${f.id}`); }}>Hủy giữ chỗ</button>
      </aside>
      </div>
    </div></main>
  );
}

export function BookingResultPage() {
  const { id } = useParams();
  const { state } = useStore();
  const b = state.bookings.find((x) => x.id === id);
  if (!b) return <Navigate to="/lich-dat" replace />;
  const f = state.facilities.find((x) => x.id === b.facilityId);
  const court = f.courts.find((c) => c.id === b.courtId);
  const q = bookingQuote(state, b);
  return (
    <main className="page"><div className="wrap">
      <div className="success">
        <div className="success__icon" aria-hidden="true">
          <svg viewBox="0 0 52 52"><circle className="sc-ring" cx="26" cy="26" r="24" /><path className="sc-check" d="M15.5 27l7 7 14-15" /></svg>
        </div>
        <h1 className="fade-in">Đã đặt cọc</h1>
        <p className="ink2 fade-in" style={{ marginTop: 10 }}>Khung giờ đã giữ cho bạn.</p>
        <div className="ticket">
          <div className="ticket__top">
            <img src={f.photos[0]} alt="" />
            <div style={{ padding: 24 }}>
              <div className="row between"><span className="mono muted">{b.id}</span><span className="badge badge--deposited">Đã cọc</span></div>
              <h2 style={{ marginTop: 10 }}>{f.name}</h2>
              <div className="small ink2" style={{ marginTop: 4 }}>{f.street}, {f.district}</div>
            </div>
          </div>
          <div className="ticket__cut" />
          <div className="grid-3" style={{ padding: 24, gap: 16 }}>
            <div><div className="small muted">Sân</div><div>{court.name}</div></div>
            <div><div className="small muted">Ngày</div><div>{longDay(b.date)}</div></div>
            <div><div className="small muted">Giờ</div><div className="mono">{slotRange(b.slots)}</div></div>
            <div><div className="small muted">Đã cọc</div><div className="mono" style={{ color: "var(--accent)" }}>{vnd(q.deposit)}</div></div>
            <div><div className="small muted">Trả tại sân</div><div className="mono">{vnd(q.remaining)}</div></div>
            <div><div className="small muted">Tổng tiền</div><div className="mono">{vnd(q.total)}</div></div>
          </div>
        </div>
        <div className="row" style={{ justifyContent: "center", marginTop: 28 }}>
          <Link className="btn btn--primary" to={`/lich-dat/${b.id}`}>Xem đơn</Link>
          <Link className="btn" to="/lich-dat">Lịch đặt của tôi</Link>
        </div>
      </div>
    </div></main>
  );
}
