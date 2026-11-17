import { useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { useStore, bookingQuote } from "../data/store";
import { longDay, shortDay, slotRange, vnd } from "../lib/format";
import { refundFor, playStarted } from "../lib/pricing";
import { Empty, Icon, Modal, StatusBadge, STATUS, useToast } from "../components/ui";
import { Skel, useLoading } from "../components/charts";

const TABS = ["ALL", "PENDING_DEPOSIT", "DEPOSITED", "COMPLETED", "CANCELLED"];

export function MyBookingsPage() {
  const { state, me } = useStore();
  const [tab, setTab] = useState("ALL");
  const loading = useLoading();
  const mine = state.bookings.filter((b) => b.userId === me.id);
  const list = mine.filter((b) => tab === "ALL" || b.status === tab).sort((a, b) => (a.date < b.date ? 1 : -1));
  const upcoming = mine.filter((b) => b.status === "DEPOSITED" && !playStarted(b.date, b.slots[0]));
  return (
    <main className="page"><div className="wrap">
      <div className="page-head">
        <div><h1>Lịch đặt của tôi</h1><p>{upcoming.length ? `${upcoming.length} buổi sắp tới đã cọc.` : "Chưa có buổi nào sắp tới."}</p></div>
        <Link className="btn btn--primary" to="/tim-san">Đặt sân mới</Link>
      </div>
      <div className="seg seg--scroll" role="tablist" style={{ marginBottom: 16, flex: "none" }}>
        {TABS.map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} className={tab === t ? "on" : ""} onClick={() => setTab(t)}>
            {t === "ALL" ? "Tất cả" : STATUS[t].label} <span className="muted">{t === "ALL" ? mine.length : mine.filter((b) => b.status === t).length}</span>
          </button>
        ))}
      </div>
      {loading ? <div className="stack fit scroll" style={{ "--gap": "12px" }} aria-hidden="true">{[0, 1, 2, 3].map((i) => <div key={i} className="card card--tight bk-row"><Skel w={72} h={72} r={12} /><div><Skel w="45%" h={16} /><Skel w="60%" h={12} style={{ marginTop: 10 }} /></div><Skel w={90} h={20} /></div>)}</div>
        : list.length === 0 ? <Empty title="Không có đơn ở mục này"><Link className="link" to="/tim-san">Tìm sân trống</Link></Empty> : (
        <div className="stack stagger fit scroll" style={{ "--gap": "12px" }} key={tab}>
          {list.map((b) => {
            const f = state.facilities.find((x) => x.id === b.facilityId);
            const c = f.courts.find((x) => x.id === b.courtId);
            const q = bookingQuote(state, b);
            return (
              <Link key={b.id} to={`/lich-dat/${b.id}`} className="card card--tight bk-row">
                <img src={f.photos[0]} alt="" />
                <div style={{ minWidth: 0 }}>
                  <div className="row" style={{ "--gap": "10px" }}><span style={{ fontWeight: 500, fontSize: 16 }}>{f.name}</span><StatusBadge status={b.status} /></div>
                  <div className="small ink2" style={{ marginTop: 6 }}>{c.name} · {shortDay(b.date)} · <span className="mono">{slotRange(b.slots)}</span></div>
                  <div className="small muted mono" style={{ marginTop: 2 }}>{b.id}</div>
                </div>
                <div className="bk-row__price" style={{ textAlign: "right" }}>
                  <div className="price" style={{ fontSize: 18 }}>{vnd(q.total)}</div>
                  <div className="small muted">cọc {vnd(q.deposit)}</div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div></main>
  );
}

export function BookingDetailPage() {
  const { id } = useParams();
  const { state, api, me } = useStore();
  const toast = useToast();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [stars, setStars] = useState(5);
  const [text, setText] = useState("");
  const b = state.bookings.find((x) => x.id === id);
  if (!b || (b.userId !== me.id && me.role === "customer")) return <Navigate to="/lich-dat" replace />;
  const f = state.facilities.find((x) => x.id === b.facilityId);
  const c = f.courts.find((x) => x.id === b.courtId);
  const q = bookingQuote(state, b);
  const started = playStarted(b.date, b.slots[0]);
  const r = refundFor(b.date, b.slots[0], b.status === "DEPOSITED" ? q.deposit : 0);
  const canCancel = ["PENDING_DEPOSIT", "DEPOSITED"].includes(b.status) && !started;
  const post = state.posts.find((p) => p.bookingId === b.id && !p.closed);

  const steps = [
    { label: "Tạo đơn", done: true, at: shortDay(b.createdAt) },
    { label: "Đặt cọc 30% từ ví", done: ["DEPOSITED", "COMPLETED"].includes(b.status) || (b.status === "CANCELLED" && b.refund) },
    b.status === "CANCELLED" ? { label: b.refund ? `Đã hủy, hoàn ${b.refund.pct}% cọc (${vnd(b.refund.amount)})` : "Đã hủy", bad: true } : { label: "Chơi xong, chủ sân xác nhận", done: b.status === "COMPLETED" },
  ];

  return (
    <main className="page"><div className="wrap" style={{ maxWidth: 1080 }}>
      <nav className="crumbs"><Link to="/lich-dat">Lịch đặt của tôi</Link><span>/</span><span className="ink2 mono">{b.id}</span></nav>
      <div className="page-head">
        <div><div className="row" style={{ "--gap": "12px" }}><h1>{f.name}</h1><StatusBadge status={b.status} /></div>
          <p>{c.name} · {longDay(b.date)} · <span className="mono">{slotRange(b.slots)}</span></p></div>
        <div className="row">
          {b.status === "PENDING_DEPOSIT" && <Link className="btn btn--primary" to={`/dat-san/${b.id}`}>Đặt cọc ngay</Link>}
          {b.status === "DEPOSITED" && !started && !post && <Link className="btn" to={`/ghep-doi?don=${b.id}`}>Đăng tìm đồng đội</Link>}
          {canCancel && <button className="btn btn--danger" onClick={() => setCancelOpen(true)}>Hủy đặt sân</button>}
        </div>
      </div>

      <div className="split">
        <div className="stack scroll" style={{ "--gap": "24px" }}>
          <section className="card">
            <h2 style={{ marginBottom: 16 }}>Tiền</h2>
            {q.lines.map((l) => <div key={l.slot} className="bill-row"><span>{l.slot}<small>{vnd(l.base)} × {String(l.multiplier).replace(".", ",")} · {l.label}</small></span><span className="num">{vnd(l.amount)}</span></div>)}
            {q.serviceLines.map((s) => <div key={s.id} className="bill-row"><span>{s.name}<small>{s.qty} {s.unit} × {vnd(s.price)}</small></span><span className="num">{vnd(s.amount)}</span></div>)}
            <div className="bill-total"><span className="muted">Tổng tiền</span><b>{vnd(q.total)}</b></div>
            <dl className="kv" style={{ marginTop: 16 }}><dt>Tiền cọc 30%</dt><dd className="mono">{vnd(q.deposit)}</dd><dt>Còn lại trả tại sân</dt><dd className="mono">{vnd(q.remaining)}</dd></dl>
          </section>

          {b.status === "COMPLETED" && (
            <section className="card">
              <h2 style={{ marginBottom: 6 }}>Đánh giá sân</h2>
              {b.reviewed ? <p className="muted">Bạn đã đánh giá buổi này.</p> : (
                <form onSubmit={(e) => { e.preventDefault(); api.review(b.id, stars, text); toast("Đã gửi đánh giá"); }} className="stack">
                  <div className="stars" role="radiogroup" aria-label="Số sao">{[1, 2, 3, 4, 5].map((n) => <button type="button" key={n} className={n <= stars ? "on" : ""} onClick={() => setStars(n)} aria-label={`${n} sao`}><Icon name="star" size={26} fill /></button>)}</div>
                  <div className="field"><label htmlFor="rv">Nhận xét (không bắt buộc)</label><textarea id="rv" className="textarea" value={text} onChange={(e) => setText(e.target.value)} /></div>
                  <div><button className="btn btn--primary">Gửi đánh giá</button></div>
                </form>
              )}
            </section>
          )}
          {post && <div className="notice notice--ok"><Icon name="users" />Đơn này có bài tìm đồng đội đang mở, cần {post.need} người. <Link className="link" to="/ghep-doi">Xem bài</Link></div>}
        </div>

        <aside className="stack sticky" style={{ "--gap": "16px" }}>
          <div className="card">
            <h3 style={{ marginBottom: 16 }}>Trạng thái đơn</h3>
            <ol className="timeline">{steps.map((s, i) => <li key={i} className={s.done ? "done" : s.bad ? "bad" : ""}>{s.label}{s.at && <small>{s.at}</small>}</li>)}</ol>
          </div>
          <div className="card">
            <h3 style={{ marginBottom: 12 }}>Địa điểm</h3>
            <p className="ink2">{f.street}, {f.district}, {f.city}</p>
            <a className="link small" href={`https://www.openstreetmap.org/search?query=${encodeURIComponent(f.street + " " + f.district + " " + f.city)}`} target="_blank" rel="noreferrer">Mở bản đồ</a>
          </div>
        </aside>
      </div>

      {cancelOpen && (
        <Modal title="Hủy đặt sân?" onClose={() => setCancelOpen(false)} footer={<>
          <button className="btn btn--ghost" onClick={() => setCancelOpen(false)}>Giữ đơn</button>
          <button className="btn btn--danger" onClick={() => { api.cancelBooking(b.id); setCancelOpen(false); toast(b.status === "DEPOSITED" ? `Đã hủy, hoàn ${vnd(r.amount)} vào ví` : "Đã hủy giữ chỗ"); }}>Xác nhận hủy</button>
        </>}>
          {b.status === "DEPOSITED" ? (
            <>
              <p className="ink2">Còn {Math.floor(r.hours)} giờ đến giờ chơi: hoàn <b style={{ color: "var(--accent)" }}>{r.pct}%</b> cọc.</p>
              <div className="tiers" style={{ margin: "18px 0" }}>
                <div className={"tier" + (r.pct === 80 ? " on" : "")}><b>80%</b><span>Từ 24 giờ</span></div>
                <div className={"tier" + (r.pct === 50 ? " on" : "")}><b>50%</b><span>12–24 giờ</span></div>
                <div className={"tier" + (r.pct === 0 ? " on" : "")}><b>0%</b><span>Dưới 12 giờ</span></div>
              </div>
              <dl className="kv"><dt>Tiền cọc đã trả</dt><dd className="mono">{vnd(q.deposit)}</dd><dt>Hoàn vào ví của bạn</dt><dd className="mono" style={{ color: "var(--accent)" }}>{vnd(r.amount)}</dd><dt>Chuyển cho chủ sân</dt><dd className="mono">{vnd(r.forfeit)}</dd></dl>
            </>
          ) : <p className="ink2">Đơn chưa cọc, không trừ tiền.</p>}
        </Modal>
      )}
    </div></main>
  );
}
