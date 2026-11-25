import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useStore, userName } from "../data/store";
import { SPORTS, sportName } from "../data/mock";
import { dateTime, initials, shortDay, vnd, signedVnd, slotRange } from "../lib/format";
import { playStarted } from "../lib/pricing";
import { Count, Empty, Modal, Select, StatusBadge, TX_TYPES, usePaged, useToast } from "../components/ui";
import { BalanceChart, SkelCard, SkelRows, useLoading } from "../components/charts";

export function TxTable({ rows, showUser, className = "" }) {
  const { state } = useStore();
  if (!rows.length) return <Empty title="Chưa có giao dịch">Giao dịch ví hiện ở đây khi có cọc, hoàn cọc hoặc cấp tiền.</Empty>;
  return (
    <div className={"table-wrap " + className}>
      <table className="table">
        <thead><tr><th>Mã</th><th>Thời gian</th>{showUser && <th>Người dùng</th>}<th>Loại</th><th>Nội dung</th><th className="r">Số tiền</th></tr></thead>
        <tbody>{rows.map((t) => (
          <tr key={t.id}>
            <td className="mono muted">{t.id}</td><td className="mono small">{dateTime(t.at)}</td>
            {showUser && <td>{userName(state, t.userId)}</td>}
            <td><span className="tag">{TX_TYPES[t.type]}</span></td><td className="ink2">{t.note}</td>
            <td className={"r num " + (t.amount > 0 ? "amount-in" : "amount-out")}>{signedVnd(t.amount)}</td>
          </tr>))}</tbody>
      </table>
    </div>
  );
}

// Ví dạng danh sách: chấm vào/ra, nội dung, thời gian và mã ở dòng phụ, số tiền bên phải.
function TxList({ rows }) {
  if (!rows.length) return <Empty title="Chưa có giao dịch" />;
  return (
    <ul className="txl">
      {rows.map((t) => (
        <li key={t.id}>
          <i className={t.amount > 0 ? "in" : "out"} aria-hidden="true">{t.amount > 0 ? "+" : "−"}</i>
          <div className="txl__main"><div>{t.note}</div><div className="small muted"><span className="mono">{dateTime(t.at)}</span> · {TX_TYPES[t.type]} · <span className="mono">{t.id}</span></div></div>
          <b className={"mono " + (t.amount > 0 ? "amount-in" : "amount-out")}>{signedVnd(t.amount)}</b>
        </li>
      ))}
    </ul>
  );
}

export function WalletPage() {
  const { state, me } = useStore();
  const [type, setType] = useState("ALL");
  const loading = useLoading();
  const owner = me.role === "owner";
  const mine = state.transactions.filter((t) => t.userId === me.id);
  const rows = mine.filter((t) => type === "ALL" || t.type === type).sort((a, b) => (a.at < b.at ? 1 : -1));
  const { ref, items, pager } = usePaged(rows, 62, { reset: type });
  const sum = (ty) => mine.filter((t) => t.type === ty).reduce((a, t) => a + t.amount, 0);
  const types = owner ? ["SETTLE", "FORFEIT", "DEPOSIT"] : ["TOPUP", "DEPOSIT", "REFUND"];
  const balance = state.wallets[me.id] ?? 0;
  // biểu đồ cao bằng chỗ còn lại trong khung số dư
  const chartRef = useRef(null);
  const [chartH, setChartH] = useState(0);
  useEffect(() => {
    const ro = new ResizeObserver(([e]) => setChartH(Math.round(e.contentRect.height)));
    ro.observe(chartRef.current);
    return () => ro.disconnect();
  }, []);
  const stats = owner ? [["Đã kết toán", sum("SETTLE")], ["Cọc giữ lại khi khách hủy", sum("FORFEIT")]] : [["Đã đặt cọc", -sum("DEPOSIT")], ["Được hoàn lại", sum("REFUND")]];
  const Wrap = owner ? "div" : "main";
  return (
    <Wrap className={owner ? "wallet-page" : "page"}><div className={owner ? "wallet-page" : "wrap"}>
      <div className="page-head"><div><h1>{owner ? "Ví chủ sân" : "Ví của tôi"}</h1></div></div>
      <div className="wallet">
        <section className="card wallet__board" aria-label="Số dư">
          <div className="wallet__top">
            <div><div className="wallet__label">Số dư hiện tại</div><div className="wallet__bal mono">{loading ? "…" : <Count value={balance} from={0} />}</div></div>
            <div className="wallet__mini">{stats.map(([l, v]) => <div key={l}><div className="wallet__label">{l}</div><div className="mono">{loading ? "…" : <Count value={v} from={0} />}</div></div>)}</div>
          </div>
          <div className="wallet__chart" ref={chartRef}>{loading ? <SkelCard h={180} /> : <BalanceChart txs={mine} current={balance} height={Math.max(170, chartH - 8)} />}</div>
        </section>
        <section className="card wallet__list">
          <div className="row between" style={{ marginBottom: 12 }}>
            <h2>Giao dịch</h2>
            <div className="seg seg--scroll">{["ALL", ...types].map((t) => <button key={t} className={type === t ? "on" : ""} onClick={() => setType(t)}>{t === "ALL" ? "Tất cả" : TX_TYPES[t]}</button>)}</div>
          </div>
          <div className="results" ref={ref}>{loading ? <SkelRows /> : <TxList rows={items} />}{!loading && pager}</div>
        </section>
      </div>
    </div></Wrap>
  );
}

export function ProfilePage() {
  const { state, me } = useStore();
  const ROLE = { customer: "Khách hàng", owner: "Chủ sân", admin: "Admin" };
  const mine = state.bookings.filter((b) => b.userId === me.id).sort((a, b) => (a.date < b.date ? 1 : -1));
  const txs = state.transactions.filter((t) => t.userId === me.id).sort((a, b) => (a.at < b.at ? 1 : -1));
  const plays = me.role !== "admin";
  return (
    <main className="page"><div className="wrap">
      <div className={"prof" + (plays ? "" : " prof--solo")}>
        <section className="card prof__card">
          <div className="row" style={{ "--gap": "20px" }}>
            <span className="avatar avatar--lg">{initials(me.name)}</span>
            <div><h1 style={{ fontSize: 30 }}>{me.name}</h1><div className="row" style={{ marginTop: 8 }}><span className="badge badge--deposited">{ROLE[me.role]}</span><span className="muted small">Tham gia {shortDay(me.createdAt)}</span></div></div>
          </div>
          <hr className="divider" />
          <dl className="kv" style={{ gridTemplateColumns: "160px 1fr" }}>
            <dt>Email</dt><dd style={{ textAlign: "left" }}>{me.email}</dd>
            <dt>Số điện thoại</dt><dd style={{ textAlign: "left" }} className="mono">{me.phone}</dd>
            {plays && <><dt>Số đơn đã đặt</dt><dd style={{ textAlign: "left" }}>{mine.length}</dd></>}
          </dl>
          <hr className="divider" />
          <div className="row">
            {me.role === "owner" && <Link className="btn btn--primary" to="/chu-san">Trang chủ sân</Link>}
            {me.role === "admin" && <Link className="btn btn--primary" to="/admin">Trang quản trị</Link>}
            {plays && <Link className="btn" to="/lich-dat">Lịch đặt</Link>}
          </div>
        </section>
        {plays && (
          <div className="prof__side">
            <section className="card prof__wallet">
              <div className="row between"><span className="small muted">Số dư ví</span><Link className="link small" to={me.role === "owner" ? "/chu-san/vi" : "/vi"}>Xem ví</Link></div>
              <b className="mono">{vnd(state.wallets[me.id] ?? 0)}</b>
              {txs.slice(0, 3).map((t) => <div key={t.id} className="bill-row"><span>{t.note}<small className="mono">{dateTime(t.at)}</small></span><span className={"num " + (t.amount > 0 ? "amount-in" : "")}>{signedVnd(t.amount)}</span></div>)}
            </section>
            <section className="card">
              <div className="row between" style={{ marginBottom: 6 }}><h3>Đơn gần đây</h3><Link className="link small" to="/lich-dat">Tất cả</Link></div>
              {mine.length === 0 ? <p className="muted small">Chưa có đơn nào.</p> : mine.slice(0, 3).map((b) => {
                const f = state.facilities.find((x) => x.id === b.facilityId);
                return <Link key={b.id} to={`/lich-dat/${b.id}`} className="bill-row prof__bk"><span>{f.name}<small>{shortDay(b.date)} · <span className="mono">{slotRange(b.slots)}</span></small></span><StatusBadge status={b.status} /></Link>;
              })}
            </section>
          </div>
        )}
      </div>
    </div></main>
  );
}

export function TeamPage() {
  const { state, me, api } = useStore();
  const toast = useToast();
  const [params] = useSearchParams();
  const [sport, setSport] = useState("all");
  const fromBooking = params.get("don");
  const booking = fromBooking && state.bookings.find((b) => b.id === fromBooking && b.userId === me?.id && b.status === "DEPOSITED");
  const [need, setNeed] = useState(2);
  const [level, setLevel] = useState("Trung bình");
  const [note, setNote] = useState("");
  const open = state.posts.filter((p) => !p.closed && (sport === "all" || p.sport === sport));
  const [review, setReview] = useState(null);
  const { ref, items, pager } = usePaged(open, 214, { cols: matchMedia("(min-width: 1280px)").matches ? 3 : 2, min: 3, reserve: 56, reset: sport });

  const submit = (e) => {
    e.preventDefault();
    const f = state.facilities.find((x) => x.id === booking.facilityId);
    api.createPost({ bookingId: booking.id, authorId: me.id, sport: f.courts.find((c) => c.id === booking.courtId).sport, facilityId: f.id, date: booking.date, time: slotRange(booking.slots), need, level, note });
    toast("Đã đăng bài tìm đồng đội");
  };

  return (
    <main className="page"><div className="wrap">
      <div className="page-head"><div><h1>Ghép đội</h1></div></div>
      {booking && !state.posts.some((p) => p.bookingId === booking.id && !p.closed) && (
        <form className="card" style={{ marginBottom: 32 }} onSubmit={submit}>
          <h2 style={{ marginBottom: 4 }}>Đăng bài cho đơn {booking.id}</h2>
          <p className="muted small" style={{ marginBottom: 18 }}>{state.facilities.find((f) => f.id === booking.facilityId).name} · {shortDay(booking.date)} · {slotRange(booking.slots)}</p>
          <div className="form-grid">
            <div className="field"><label htmlFor="need">Cần thêm</label><Select id="need" className="select" value={need} onChange={(e) => setNeed(+e.target.value)}>{[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n} người</option>)}</Select></div>
            <div className="field"><label htmlFor="lv">Trình độ</label><Select id="lv" className="select" value={level} onChange={(e) => setLevel(e.target.value)}>{["Mới chơi", "Trung bình", "Khá"].map((x) => <option key={x}>{x}</option>)}</Select></div>
            <div className="field full"><label htmlFor="nt">Ghi chú</label><textarea id="nt" className="textarea" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Đánh đôi, chia tiền sân sau buổi chơi" /></div>
          </div>
          <button className="btn btn--primary" style={{ marginTop: 18 }}>Đăng bài</button>
        </form>
      )}
      <div className="chips" style={{ marginBottom: 16, flex: "none" }}>
        <button className={"chip" + (sport === "all" ? " on" : "")} onClick={() => setSport("all")}>Tất cả môn</button>
        {SPORTS.map((s) => <button key={s.id} className={"chip" + (sport === s.id ? " on" : "")} onClick={() => setSport(s.id)}>{s.name}</button>)}
      </div>
      {open.length === 0 && <Empty title="Chưa có bài nào"><Link className="link" to="/lich-dat">Đăng bài từ đơn đã cọc</Link></Empty>}
      <div className="results" ref={ref}>
      <div className="team-grid">
        {items.map((p) => {
          const f = state.facilities.find((x) => x.id === p.facilityId);
          const mine = me && p.authorId === me.id;
          const applied = me && p.applicants.find((a) => a.userId === me.id);
          const accepted = p.applicants.filter((a) => a.status === "ACCEPTED").length;
          const past = playStarted(p.date, p.time.slice(0, 5));
          return (
            <article key={p.id} className="card team-card fade-in">
              <div className="row between"><span className="tag">{sportName(p.sport)}</span><span className="small muted">{accepted}/{p.need} người đã nhận</span></div>
              <h3 style={{ fontSize: 19, marginTop: 10 }}>{f.name}</h3>
              <div className="small ink2" style={{ marginTop: 4 }}>{shortDay(p.date)} · <span className="mono">{p.time}</span> · {f.district}</div>
              <p className="ink2 team-card__note">{p.note}</p>
              <div className="bar" style={{ marginTop: 12 }}><i style={{ width: `${(accepted / p.need) * 100}%` }} /></div>
              <div className="row between team-card__foot">
                <div className="row" style={{ "--gap": "8px" }}><span className="avatar" style={{ width: 30, height: 30, fontSize: 11 }}>{initials(userName(state, p.authorId))}</span><span className="small">{userName(state, p.authorId)} · {p.level}</span></div>
                {!me ? <Link className="btn btn--sm" to="/dang-nhap?next=/ghep-doi">Đăng nhập để tham gia</Link>
                  : mine ? <button className="btn btn--sm" onClick={() => setReview(p.id)}>Người đăng ký ({p.applicants.length})</button>
                  : applied ? <span className={"badge " + (applied.status === "ACCEPTED" ? "badge--deposited" : applied.status === "REJECTED" ? "badge--danger" : "badge--pending")}>{{ PENDING: "Chờ duyệt", ACCEPTED: "Đã nhận", REJECTED: "Bị từ chối" }[applied.status]}</span>
                  : <button className="btn btn--primary btn--sm" disabled={past} onClick={() => { api.applyPost(p.id); toast("Đã gửi đăng ký"); }}>Xin tham gia</button>}
              </div>
            </article>
          );
        })}
      </div>
      {pager}
      </div>
      {review && (() => {
        const p = state.posts.find((x) => x.id === review);
        return (
          <Modal title="Người đăng ký" onClose={() => setReview(null)}>
            {p.applicants.length === 0 && <p className="muted">Chưa có ai đăng ký.</p>}
            {p.applicants.map((a) => (
              <div key={a.userId} className="row between" style={{ padding: "8px 0", borderTop: "1px solid var(--line)" }}>
                <span className="row" style={{ "--gap": "10px" }}><span className="avatar" style={{ width: 30, height: 30, fontSize: 11 }}>{initials(userName(state, a.userId))}</span>{userName(state, a.userId)}</span>
                {a.status === "PENDING" ? <span className="row" style={{ "--gap": "6px" }}><button className="btn btn--sm btn--primary" onClick={() => api.decide(p.id, a.userId, "ACCEPTED")}>Nhận</button><button className="btn btn--sm btn--ghost" onClick={() => api.decide(p.id, a.userId, "REJECTED")}>Từ chối</button></span>
                  : <span className={"badge " + (a.status === "ACCEPTED" ? "badge--deposited" : "badge--danger")}>{a.status === "ACCEPTED" ? "Đã nhận" : "Đã từ chối"}</span>}
              </div>
            ))}
          </Modal>
        );
      })()}
    </div></main>
  );
}


