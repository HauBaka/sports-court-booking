import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useStore, userName } from "../data/store";
import { SPORTS, sportName } from "../data/mock";
import { dateTime, initials, shortDay, vnd, signedVnd, slotRange } from "../lib/format";
import { playStarted } from "../lib/pricing";
import { Count, Empty, TX_TYPES, useToast } from "../components/ui";
import { BalanceChart, IN, OUT, SkelCard, SkelRows, SkelStats, useLoading } from "../components/charts";

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

export function WalletPage() {
  const { state, me } = useStore();
  const [type, setType] = useState("ALL");
  const loading = useLoading();
  const owner = me.role === "owner";
  const mine = state.transactions.filter((t) => t.userId === me.id);
  const rows = mine.filter((t) => type === "ALL" || t.type === type);
  const sum = (ty) => mine.filter((t) => t.type === ty).reduce((a, t) => a + t.amount, 0);
  const count = (ty) => mine.filter((t) => t.type === ty).length;
  const types = owner ? ["SETTLE", "FORFEIT"] : ["TOPUP", "DEPOSIT", "REFUND"];
  const balance = state.wallets[me.id] ?? 0;
  const Wrap = owner ? "div" : "main";
  return (
    <Wrap className={owner ? "wallet-page" : "page"}><div className={owner ? "wallet-page" : "wrap"}>
      <div className="page-head"><div><h1>{owner ? "Ví chủ sân" : "Ví của tôi"}</h1>
        <p>{owner ? "Tiền cọc của đơn hoàn tất về đây sau khi bạn xác nhận buổi chơi. Đơn bị hủy: phần cọc khách không được hoàn cũng về đây." : "Tiền vào ví do Admin cấp. Mỗi lần cọc, hoàn cọc đều trừ hoặc cộng vào ví và ghi thành một giao dịch."}</p></div></div>
      <div className="wallet">
        <div className="wallet__side">
          <div className="grid-3 wallet__stats stagger">
            {loading ? <SkelStats /> : (<>
              <div className="stat stat--accent">
                <div className="stat__label">Số dư hiện tại</div>
                <div className="stat__value"><Count value={balance} from={0} /></div>
                <div className="stat__foot">{owner ? "Dùng được ngay" : "Đủ cọc cho đơn tiếp theo"}</div>
              </div>
              {owner ? (<>
                <div className="stat"><div className="stat__label"><i className="key" style={{ background: IN }} />Đã kết toán</div><div className="stat__value"><Count value={sum("SETTLE")} from={0} /></div><div className="stat__foot">{count("SETTLE")} buổi chơi hoàn tất</div></div>
                <div className="stat"><div className="stat__label"><i className="key" style={{ background: IN }} />Cọc giữ lại khi khách hủy</div><div className="stat__value"><Count value={sum("FORFEIT")} from={0} /></div><div className="stat__foot">Theo mốc 80%, 50%, 0%</div></div>
              </>) : (<>
                <div className="stat"><div className="stat__label"><i className="key" style={{ background: OUT }} />Đã đặt cọc</div><div className="stat__value"><Count value={-sum("DEPOSIT")} from={0} /></div><div className="stat__foot">{count("DEPOSIT")} lần cọc, mỗi lần 30% tổng tiền</div></div>
                <div className="stat"><div className="stat__label"><i className="key" style={{ background: IN }} />Được hoàn lại</div><div className="stat__value"><Count value={sum("REFUND")} from={0} /></div><div className="stat__foot">Từ {count("REFUND")} đơn đã hủy</div></div>
              </>)}
            </>)}
          </div>
          {loading ? <SkelCard h={250} /> : (
            <section className="card wallet__chart fade-in">
              <div className="card__head"><div><h2>Số dư theo thời gian</h2><p>Mỗi bậc là một giao dịch. Rê chuột lên chấm để xem chi tiết.</p></div></div>
              <BalanceChart txs={mine} current={balance} height={owner ? 140 : 180} />
            </section>
          )}
        </div>
        <section className="card wallet__list">
          <div className="card__head"><div><h2>Lịch sử giao dịch</h2><p>{rows.length} giao dịch, mới nhất ở trên.</p></div></div>
          <div className="chips" style={{ marginBottom: 14 }}>{["ALL", ...types].map((t) => <button key={t} className={"chip" + (type === t ? " on" : "")} onClick={() => setType(t)}>{t === "ALL" ? "Tất cả" : TX_TYPES[t]}</button>)}</div>
          {loading ? <SkelRows /> : <TxTable rows={rows} className="fit flat" />}
        </section>
      </div>
    </div></Wrap>
  );
}

export function ProfilePage() {
  const { state, me } = useStore();
  const ROLE = { customer: "Khách hàng", owner: "Chủ sân", admin: "Admin" };
  const n = state.bookings.filter((b) => b.userId === me.id).length;
  return (
    <main className="page"><div className="wrap" style={{ maxWidth: 820 }}>
      <div className="card" style={{ padding: 32 }}>
        <div className="row" style={{ "--gap": "20px" }}>
          <span className="avatar avatar--lg">{initials(me.name)}</span>
          <div><h1 style={{ fontSize: 30 }}>{me.name}</h1><div className="row" style={{ marginTop: 8 }}><span className="badge badge--deposited">{ROLE[me.role]}</span><span className="muted small">Tham gia {shortDay(me.createdAt)}</span></div></div>
        </div>
        <hr className="divider" />
        <dl className="kv" style={{ gridTemplateColumns: "180px 1fr" }}>
          <dt>Email</dt><dd style={{ textAlign: "left" }}>{me.email}</dd>
          <dt>Số điện thoại</dt><dd style={{ textAlign: "left" }} className="mono">{me.phone}</dd>
          <dt>Số dư ví</dt><dd style={{ textAlign: "left", color: "var(--accent)" }} className="mono">{vnd(state.wallets[me.id] ?? 0)}</dd>
          {me.role === "customer" && <><dt>Số đơn đã đặt</dt><dd style={{ textAlign: "left" }}>{n}</dd></>}
          <dt>Phiên đăng nhập</dt><dd style={{ textAlign: "left" }}>Hết hạn sau 60 phút không hoạt động</dd>
        </dl>
        <hr className="divider" />
        <div className="row"><Link className="btn" to={me.role === "owner" ? "/chu-san/vi" : "/vi"}>Xem ví</Link><Link className="btn btn--ghost" to="/tim-san">Tìm sân</Link></div>
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

  const submit = (e) => {
    e.preventDefault();
    const f = state.facilities.find((x) => x.id === booking.facilityId);
    api.createPost({ bookingId: booking.id, authorId: me.id, sport: f.courts.find((c) => c.id === booking.courtId).sport, facilityId: f.id, date: booking.date, time: slotRange(booking.slots), need, level, note });
    toast("Đã đăng bài tìm đồng đội");
  };

  return (
    <main className="page"><div className="wrap">
      <div className="page-head"><div><h1>Ghép đội</h1><p>Tìm thêm người cho buổi đã cọc.</p></div></div>
      {booking && !state.posts.some((p) => p.bookingId === booking.id && !p.closed) && (
        <form className="card" style={{ marginBottom: 32 }} onSubmit={submit}>
          <h2 style={{ marginBottom: 4 }}>Đăng bài cho đơn {booking.id}</h2>
          <p className="muted small" style={{ marginBottom: 18 }}>{state.facilities.find((f) => f.id === booking.facilityId).name} · {shortDay(booking.date)} · {slotRange(booking.slots)}</p>
          <div className="form-grid">
            <div className="field"><label htmlFor="need">Cần thêm</label><select id="need" className="select" value={need} onChange={(e) => setNeed(+e.target.value)}>{[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n} người</option>)}</select></div>
            <div className="field"><label htmlFor="lv">Trình độ</label><select id="lv" className="select" value={level} onChange={(e) => setLevel(e.target.value)}>{["Mới chơi", "Trung bình", "Khá"].map((x) => <option key={x}>{x}</option>)}</select></div>
            <div className="field full"><label htmlFor="nt">Ghi chú</label><textarea id="nt" className="textarea" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Đánh đôi, chia tiền sân sau buổi chơi" /></div>
          </div>
          <button className="btn btn--primary" style={{ marginTop: 18 }}>Đăng bài</button>
        </form>
      )}
      <div className="chips" style={{ marginBottom: 16, flex: "none" }}>
        <button className={"chip" + (sport === "all" ? " on" : "")} onClick={() => setSport("all")}>Tất cả môn</button>
        {SPORTS.map((s) => <button key={s.id} className={"chip" + (sport === s.id ? " on" : "")} onClick={() => setSport(s.id)}>{s.name}</button>)}
      </div>
      {open.length === 0 && <Empty title="Chưa có bài nào">Đặt cọc một sân rồi đăng bài từ trang chi tiết đơn.</Empty>}
      <div className="grid-2 fit scroll" style={{ alignContent: "start" }}>
        {open.map((p) => {
          const f = state.facilities.find((x) => x.id === p.facilityId);
          const mine = me && p.authorId === me.id;
          const applied = me && p.applicants.find((a) => a.userId === me.id);
          const accepted = p.applicants.filter((a) => a.status === "ACCEPTED").length;
          const past = playStarted(p.date, p.time.slice(0, 5));
          return (
            <article key={p.id} className="card fade-in">
              <div className="row between"><span className="tag">{sportName(p.sport)}</span><span className="small muted">{accepted}/{p.need} người đã nhận</span></div>
              <h3 style={{ fontSize: 20, marginTop: 14 }}>{f.name}</h3>
              <div className="small ink2" style={{ marginTop: 4 }}>{shortDay(p.date)} · <span className="mono">{p.time}</span> · {f.district}</div>
              <p className="ink2" style={{ marginTop: 14 }}>{p.note}</p>
              <div className="bar" style={{ marginTop: 16 }}><i style={{ width: `${(accepted / p.need) * 100}%` }} /></div>
              <div className="row between" style={{ marginTop: 18 }}>
                <div className="row" style={{ "--gap": "8px" }}><span className="avatar" style={{ width: 30, height: 30, fontSize: 11 }}>{initials(userName(state, p.authorId))}</span><span className="small">{userName(state, p.authorId)} · {p.level}</span></div>
                {!me ? <Link className="btn btn--sm" to="/dang-nhap?next=/ghep-doi">Đăng nhập để tham gia</Link>
                  : mine ? <span className="badge badge--deposited">Bài của bạn</span>
                  : applied ? <span className={"badge " + (applied.status === "ACCEPTED" ? "badge--deposited" : applied.status === "REJECTED" ? "badge--danger" : "badge--pending")}>{{ PENDING: "Chờ duyệt", ACCEPTED: "Đã nhận", REJECTED: "Bị từ chối" }[applied.status]}</span>
                  : <button className="btn btn--primary btn--sm" disabled={past} onClick={() => { api.applyPost(p.id); toast("Đã gửi đăng ký"); }}>Xin tham gia</button>}
              </div>
              {mine && p.applicants.length > 0 && (
                <div style={{ marginTop: 18, paddingTop: 14, borderTop: "1px solid var(--line)" }}>
                  <div className="small muted" style={{ marginBottom: 8 }}>Người đăng ký</div>
                  {p.applicants.map((a) => (
                    <div key={a.userId} className="row between" style={{ padding: "6px 0" }}>
                      <span>{userName(state, a.userId)}</span>
                      {a.status === "PENDING" ? <span className="row" style={{ "--gap": "6px" }}><button className="btn btn--sm btn--primary" onClick={() => api.decide(p.id, a.userId, "ACCEPTED")}>Nhận</button><button className="btn btn--sm btn--ghost" onClick={() => api.decide(p.id, a.userId, "REJECTED")}>Từ chối</button></span>
                        : <span className={"badge " + (a.status === "ACCEPTED" ? "badge--deposited" : "badge--danger")}>{a.status === "ACCEPTED" ? "Đã nhận" : "Đã từ chối"}</span>}
                    </div>
                  ))}
                </div>
              )}
            </article>
          );
        })}
      </div>
    </div></main>
  );
}


