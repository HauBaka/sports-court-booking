import { useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { useStore, bookingQuote } from "../data/store";
import { longDay, parseKey, shortDay, slotRange, vnd } from "../lib/format";
import { refundFor, playStarted } from "../lib/pricing";
import { CourtArt, Empty, Icon, Modal, StatusBadge, STATUS, Tip, usePaged, useToast } from "../components/ui";
import { sportName } from "../data/mock";
import { Skel, useLoading } from "../components/charts";

const TABS = ["ALL", "PENDING_DEPOSIT", "DEPOSITED", "COMPLETED", "CANCELLED"];

const WD = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
const startOf = (b) => new Date(`${b.date}T${b.slots[0]}:00`);
// "còn 2 ngày 3 giờ" tới giờ chơi
const until = (b) => { const m = Math.max(0, Math.round((startOf(b) - Date.now()) / 60000)), d = Math.floor(m / 1440), h = Math.floor((m % 1440) / 60); return d ? `còn ${d} ngày ${h} giờ` : h ? `còn ${h} giờ ${m % 60} phút` : `còn ${m} phút`; };

export function MyBookingsPage() {
  const { state, me } = useStore();
  const [tab, setTab] = useState("ALL");
  const loading = useLoading();
  const mine = state.bookings.filter((b) => b.userId === me.id);
  const list = mine.filter((b) => tab === "ALL" || b.status === tab).sort((a, b) => (a.date < b.date ? 1 : -1));
  // 2 cột thẻ từ 1280px, mỗi hàng 124px (thẻ 112 + khe 12)
  // shortcut: số cột đọc lúc render, đổi cỡ cửa sổ qua mốc 1280 cần đổi trang mới tính lại
  const { ref, items, pager } = usePaged(list, 124, { cols: matchMedia("(min-width: 1280px)").matches ? 2 : 1, reset: tab });
  const next = mine.filter((b) => ["DEPOSITED", "PENDING_DEPOSIT"].includes(b.status) && startOf(b) > Date.now()).sort((a, b) => startOf(a) - startOf(b))[0];
  const live = mine.filter((b) => b.status !== "CANCELLED");
  const held = mine.filter((b) => b.status === "DEPOSITED").reduce((a, b) => a + bookingQuote(state, b).deposit, 0);
  const refunded = state.transactions.filter((t) => t.userId === me.id && t.type === "REFUND").reduce((a, t) => a + t.amount, 0);
  return (
    <main className="page"><div className="wrap">
      <div className="page-head">
        <div><h1>Lịch đặt của tôi</h1></div>
        <Link className="btn btn--primary" to="/tim-san">Đặt sân mới</Link>
      </div>
      <div className="mybk">
        <div className="mybk__main">
          <div className="seg seg--scroll" role="tablist" style={{ marginBottom: 14, flex: "none", alignSelf: "flex-start" }}>
            {TABS.map((t) => (
              <button key={t} role="tab" aria-selected={tab === t} className={tab === t ? "on" : ""} onClick={() => setTab(t)}>
                {t === "ALL" ? "Tất cả" : STATUS[t].label} <span className="muted">{t === "ALL" ? mine.length : mine.filter((b) => b.status === t).length}</span>
              </button>
            ))}
          </div>
          {loading ? <div className="bkc-grid" aria-hidden="true">{[0, 1, 2, 3].map((i) => <div key={i} className="card bkc"><Skel w={84} h={88} r={14} /><div><Skel w="55%" h={16} /><Skel w="70%" h={12} style={{ marginTop: 12 }} /><Skel w="40%" h={12} style={{ marginTop: 12 }} /></div></div>)}</div>
            : list.length === 0 ? <Empty title="Không có đơn ở mục này"><Link className="link" to="/tim-san">Tìm sân trống</Link></Empty> : (
            <div className="results" ref={ref}>
              <div className="bkc-grid stagger" key={tab + items.map((b) => b.id).join()}>
                {items.map((b) => {
                  const f = state.facilities.find((x) => x.id === b.facilityId);
                  const c = f.courts.find((x) => x.id === b.courtId);
                  const q = bookingQuote(state, b);
                  const d = parseKey(b.date);
                  return (
                    <Link key={b.id} to={`/lich-dat/${b.id}`} className={"card bkc" + (b.status === "CANCELLED" ? " bkc--off" : "")}>
                      <span className="bkc__date" style={{ backgroundImage: `url(${f.photos[0]})` }}><b>{d.getDate()}</b><span>{WD[d.getDay()]} · Th{d.getMonth() + 1}</span></span>
                      <span className="bkc__main">
                        <span className="bkc__top"><span className="bkc__name">{f.name}</span><StatusBadge status={b.status} /></span>
                        <span className="small ink2">{c.name} · {sportName(c.sport)} · <span className="mono">{slotRange(b.slots)}</span></span>
                        <span className="bkc__foot"><span className="small muted">{f.district} · <span className="mono">{b.id}</span></span><span><span className="mono">{vnd(q.total)}</span> <span className="small muted">cọc <span className="mono">{vnd(q.deposit)}</span></span></span></span>
                      </span>
                    </Link>
                  );
                })}
              </div>
              {pager}
            </div>
          )}
        </div>
        <aside className="mybk__side">
          {next ? (() => {
            const f = state.facilities.find((x) => x.id === next.facilityId);
            const c = f.courts.find((x) => x.id === next.courtId);
            const q = bookingQuote(state, next);
            return (
              <section className="card card--flush upnext">
                <div className="upnext__img"><img src={f.photos[0]} alt="" /><span className="upnext__count"><Icon name="clock" size={14} />{until(next)}</span></div>
                <div className="upnext__body">
                  <span className="small muted">Buổi sắp tới</span>
                  <h3>{f.name}</h3>
                  <div className="ink2 small">{longDay(next.date)} · <span className="mono">{slotRange(next.slots)}</span> · {c.name}</div>
                  <div className="small muted">{f.street}, {f.district}</div>
                  <div className="bill-row" style={{ marginTop: 6 }}><span>{next.status === "DEPOSITED" ? "Còn trả tại sân" : "Cần đặt cọc"}</span><span className="num">{vnd(next.status === "DEPOSITED" ? q.remaining : q.deposit)}</span></div>
                  <div className="row" style={{ "--gap": "8px" }}>
                    <Link className="btn btn--sm btn--primary" to={`/lich-dat/${next.id}`}>{next.status === "DEPOSITED" ? "Xem đơn" : "Đặt cọc ngay"}</Link>
                    {next.status === "DEPOSITED" && <Link className="btn btn--sm" to={`/ghep-doi?don=${next.id}`}><Icon name="users" size={14} />Tìm người chơi</Link>}
                  </div>
                </div>
              </section>
            );
          })() : (
            <section className="card upnext upnext--none"><CourtArt size={96} /><h3>Chưa có buổi sắp tới</h3><Link className="btn btn--sm btn--primary" to="/tim-san">Tìm sân trống</Link></section>
          )}
          <section className="card mybk__stats">
            {[["Buổi đã đặt", live.length], ["Giờ chơi", live.reduce((a, b) => a + b.slots.length, 0)], ["Cọc đang giữ", vnd(held)], ["Đã được hoàn", vnd(refunded)]].map(([l, v]) => (
              <div key={l}><span className="small muted">{l}</span><b className="mono">{v}</b></div>
            ))}
          </section>
        </aside>
      </div>
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
      <div className="page-head">
        <div><div className="row" style={{ "--gap": "12px" }}><h1>{f.name}</h1><StatusBadge status={b.status} /></div>
          <div className="small ink2" style={{ marginTop: 6 }}><Link className="link" to="/lich-dat">Lịch đặt</Link> · <span className="mono">{b.id}</span> · {c.name} · {longDay(b.date)} · <span className="mono">{slotRange(b.slots)}</span></div></div>
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
              <RefundTrack hours={r.hours} pct={r.pct} />
              <dl className="kv"><dt>Tiền cọc đã trả</dt><dd className="mono">{vnd(q.deposit)}</dd><dt>Hoàn vào ví của bạn</dt><dd className="mono" style={{ color: "var(--accent)" }}>{vnd(r.amount)}</dd><dt>Chuyển cho chủ sân</dt><dd className="mono">{vnd(r.forfeit)}</dd></dl>
            </>
          ) : <p className="ink2">Đơn chưa cọc, không trừ tiền.</p>}
        </Modal>
      )}
    </div></main>
  );
}

// Thanh mốc hoàn cọc QĐ5: trục là số giờ còn lại đến giờ chơi (0 đến 48+), núm ở vị trí hiện tại.
function RefundTrack({ hours, pct }) {
  const pos = Math.min(1, Math.max(0, hours / 48));
  const zones = [[0, 12, "0%"], [12, 24, "50%"], [24, 48, "80%"]];
  return (
    <div className="rtrack" aria-label={`Còn ${Math.floor(hours)} giờ đến giờ chơi, hoàn ${pct}% cọc`}>
      <div className="rtrack__head"><span className="ink2">Còn <b className="mono">{Math.floor(hours)} giờ</b> đến giờ chơi</span><b className="rtrack__pct">Hoàn {pct}%<Tip>Hủy trước 24 giờ hoàn 80% cọc, 12 đến dưới 24 giờ hoàn 50%, dưới 12 giờ không hoàn.</Tip></b></div>
      <div className="rtrack__bar">
        {zones.map(([a, b, l]) => <span key={a} className={"rtrack__zone" + (hours >= a && (hours < b || b === 48) ? " on" : "")} style={{ flex: b - a }}>{l}</span>)}
        <i className="rtrack__knob" style={{ left: `${pos * 100}%` }} />
      </div>
      <div className="rtrack__ticks mono"><span>0 giờ</span><span style={{ left: "25%" }}>12</span><span style={{ left: "50%" }}>24</span><span style={{ left: "100%" }}>48+</span></div>
    </div>
  );
}
