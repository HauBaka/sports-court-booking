import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useStore, bookingQuote, userName } from "../../data/store";
import { dateTime, signedVnd, longDay, shortDay, slotRange, vnd, initials } from "../../lib/format";
import { playStarted } from "../../lib/pricing";
import { Count, Icon, StatusBadge, STATUS, Switch, TX_TYPES, usePaged, useToast } from "../../components/ui";
import { TxTable } from "../AccountPages";
import { FlowChart, Skel, SkelCard, SkelRows, SkelStats, useLoading } from "../../components/charts";

const ROLE = { customer: "Khách hàng", owner: "Chủ sân", admin: "Admin" };

const ST_COLOR = { PENDING_DEPOSIT: "var(--warn)", DEPOSITED: "var(--accent)", COMPLETED: "var(--info)", CANCELLED: "#b9bab3" };

export function AdminDashboard() {
  const { state, api } = useStore();
  const loading = useLoading();
  const toast = useToast();
  const byRole = (r) => state.users.filter((u) => u.role === r).length;
  const byStatus = Object.keys(STATUS).map((s) => [s, state.bookings.filter((b) => b.status === s).length]);
  const topups = state.transactions.filter((t) => t.type === "TOPUP").reduce((a, t) => a + t.amount, 0);
  const courts = state.facilities.reduce((a, f) => a + f.courts.length, 0);
  const pending = state.bookings.filter((b) => b.status === "PENDING_DEPOSIT");
  const played = state.bookings.filter((b) => b.status === "DEPOSITED" && playStarted(b.date, b.slots[0]));
  const empty = state.users.filter((u) => u.role === "customer" && !(state.wallets[u.id] > 0));
  const facName = (id) => state.facilities.find((f) => f.id === id)?.name;
  // cơ sở nhiều đơn nhất (không tính đơn hủy)
  const top = state.facilities.map((f) => [f, state.bookings.filter((b) => b.facilityId === f.id && b.status !== "CANCELLED").length]).sort((a, b) => b[1] - a[1]).slice(0, 3);
  const topMax = Math.max(1, ...top.map(([, n]) => n));
  return (
    <>
      <div className="page-head">
        <div><h1>Tổng quan hệ thống</h1></div>
        <button className="btn" onClick={() => { const n = api.expireHolds(); toast(n ? `Đã hủy ${n} đơn giữ chỗ hết hạn` : "Không có đơn hết hạn"); }}><Icon name="refresh" size={16} />Dọn giữ chỗ hết hạn</button>
      </div>
      <div className="grid-4 stagger" style={{ marginBottom: 16, flex: "none" }}>
        {loading ? <SkelStats n={4} /> : <>
        <div className="stat"><div className="stat__label">Người dùng</div><div className="stat__value"><Count value={state.users.length} from={0} format={Math.round} /></div><div className="stat__foot">{byRole("customer")} khách · {byRole("owner")} chủ sân · {byRole("admin")} admin</div></div>
        <div className="stat"><div className="stat__label">Cơ sở và sân con</div><div className="stat__value">{state.facilities.length}<small>/ {courts} sân</small></div><div className="stat__foot">{state.facilities.filter((f) => f.city === "TP.HCM").length} cơ sở ở TP.HCM</div></div>
        <div className="stat stat--accent"><div className="stat__label">Cọc đang giữ ở ví hệ thống</div><div className="stat__value"><Count value={state.wallets.system} from={0} /></div><div className="stat__foot">Chờ hủy hoặc kết toán</div></div>
        <div className="stat"><div className="stat__label">Tổng tiền Admin đã cấp</div><div className="stat__value"><Count value={topups} from={0} /></div><div className="stat__foot">{state.transactions.filter((t) => t.type === "TOPUP").length} lần cấp</div></div>
        </>}
      </div>
      <div className="adash">
        <div className="adash__col">
          <section className="card">
            <div className="card__head"><div><h2>Dòng tiền 14 ngày</h2></div></div>
            {loading ? <Skel h={130} r={14} /> : <FlowChart txs={state.transactions} days={14} height={130} />}
          </section>
          <section className="card">
            <div className="card__head"><div><h2>Đơn theo trạng thái</h2></div><span className="small muted"><span className="mono">{state.bookings.length}</span> đơn</span></div>
            <div className="stackbar" role="img" aria-label={byStatus.map(([s, n]) => `${STATUS[s].label} ${n}`).join(", ")}>
              {byStatus.filter(([, n]) => n).map(([s, n]) => <i key={s} style={{ flexGrow: n, background: ST_COLOR[s] }} />)}
            </div>
            <div className="stackbar__legend">{byStatus.map(([s, n]) => <span key={s}><i style={{ background: ST_COLOR[s] }} />{STATUS[s].label} <b className="mono">{n}</b></span>)}</div>
          </section>
        </div>
        <section className="card adash__todo">
          <div className="card__head"><div><h2>Cần xử lý</h2></div><span className="badge badge--pending">{pending.length + played.length + empty.length}</span></div>
          <ul className="todo">
            {played.map((b) => (
              <li key={b.id}><span className="todo__dot" style={{ background: "var(--accent)" }} /><span className="todo__txt"><span className="mono">{b.id}</span> đã chơi, chờ xác nhận<small>{facName(b.facilityId)} · {shortDay(b.date)} <span className="mono">{slotRange(b.slots)}</span></small></span>
                <button className="btn btn--sm" onClick={() => { api.completeBooking(b.id); toast(`Đã xác nhận ${b.id}`); }}>Xác nhận</button></li>
            ))}
            {pending.map((b) => (
              <li key={b.id}><span className="todo__dot" style={{ background: "var(--warn)" }} /><span className="todo__txt"><span className="mono">{b.id}</span> đang giữ chỗ<small>{userName(state, b.userId)} · {facName(b.facilityId)}{b.holdUntil ? <> · hết hạn <span className="mono">{b.holdUntil.slice(11, 16)}</span></> : null}</small></span>
                <Link className="btn btn--sm btn--ghost" to="/admin/don-dat">Xem</Link></li>
            ))}
            {empty.map((u) => (
              <li key={u.id}><span className="todo__dot" style={{ background: "var(--info)" }} /><span className="todo__txt">Ví trống, chưa đặt được sân<small>{u.name} · {u.email}</small></span>
                <Link className="btn btn--sm btn--ghost" to={`/admin/cap-tien?u=${u.id}`}>Cấp tiền</Link></li>
            ))}
            {pending.length + played.length + empty.length === 0 && <li className="muted small">Không có việc cần xử lý.</li>}
          </ul>
        </section>
        <div className="adash__col">
          <section className="card">
            <div className="card__head"><div><h2>Cơ sở nhiều đơn</h2></div></div>
            <div className="stack" style={{ "--gap": "12px" }}>
              {top.map(([f, n]) => (
                <div key={f.id} className="topf"><img src={f.photos[0]} alt="" /><div><div className="row between small"><span className="topf__name">{f.name}</span><span className="mono">{n}</span></div><div className="bar"><i style={{ width: `${(n / topMax) * 100}%` }} /></div></div></div>
              ))}
            </div>
          </section>
          <section className="card adash__tx">
            <div className="card__head"><div><h2>Giao dịch gần đây</h2></div><Link className="link small" to="/admin/giao-dich">Xem tất cả</Link></div>
            {[...state.transactions].sort((a, b) => (a.at < b.at ? 1 : -1)).slice(0, 4).map((t) => (
              <div key={t.id} className="bill-row"><span>{userName(state, t.userId)}<small>{TX_TYPES[t.type]} · <span className="mono">{t.at.slice(5, 10).split("-").reverse().join("/")}</span></small></span><span className={"num " + (t.amount > 0 ? "amount-in" : "")}>{t.amount > 0 ? "+" : ""}{vnd(t.amount)}</span></div>
            ))}
          </section>
        </div>
      </div>
    </>
  );
}

export function AdminTopupPage() {
  const { state, api } = useStore();
  const toast = useToast();
  const [params] = useSearchParams();
  const [q, setQ] = useState("");
  const [role, setRole] = useState("all");
  const all = state.users.filter((u) => u.role !== "admin");
  const [pickId, setPickId] = useState(() => (all.some((u) => u.id === params.get("u")) ? params.get("u") : all[0]?.id));
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");
  const [done, setDone] = useState(null);
  const users = all.filter((u) => (role === "all" || u.role === role) && (u.name + u.email).toLowerCase().includes(q.toLowerCase()));
  // hàng bảng cao khoảng 57px, chừa chỗ cho đầu bảng và thanh phân trang
  const pg = usePaged(users, 67, { reserve: 100, reset: q + role });
  const pick = all.find((u) => u.id === pickId);
  const bal = state.wallets[pickId] ?? 0;
  const n = Number(amount);
  const choose = (id) => { setPickId(id); setAmount(""); setErr(""); setDone(null); };
  const submit = (e) => {
    e.preventDefault();
    if (!n || n < 10000) return setErr("Nhập số tiền từ 10.000đ trở lên.");
    if (n > 10000000) return setErr("Mỗi lần cấp tối đa 10.000.000đ.");
    api.topup(pick.id, n, note.trim() || "Admin cấp tiền");
    setDone({ id: pick.id, amount: n, before: bal, after: bal + n });
    toast(`Đã cấp ${vnd(n)} cho ${pick.name}`);
    setAmount(""); setNote(""); setErr("");
  };
  const recent = state.transactions.filter((t) => t.type === "TOPUP").sort((a, b) => (a.at < b.at ? 1 : -1)).slice(0, 4);
  return (
    <>
      <div className="page-head"><div><h1>Cấp tiền vào ví</h1></div></div>
      <div className="topup">
        <section className="card card--flush topup__users">
          <div className="topup__bar">
            <div className="input-group" style={{ flex: 1, maxWidth: 360 }}><input className="input" placeholder="Tìm theo tên hoặc email" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Tìm người dùng" /><span style={{ position: "absolute", right: 14, top: 14, color: "var(--muted)" }}><Icon name="search" /></span></div>
            <div className="seg">{[["all", "Tất cả"], ["customer", "Khách hàng"], ["owner", "Chủ sân"]].map(([k, l]) => <button key={k} className={role === k ? "on" : ""} onClick={() => setRole(k)}>{l}</button>)}</div>
          </div>
          <div className="results" ref={pg.ref}><div className="table-wrap flat"><table className="table table--pick">
            <thead><tr><th>Người dùng</th><th>Vai trò</th><th className="r">Số dư</th></tr></thead>
            <tbody>{pg.items.map((u) => (
              <tr key={u.id} className={u.id === pickId ? "on" : ""} onClick={() => choose(u.id)} tabIndex={0} onKeyDown={(e) => e.key === "Enter" && choose(u.id)} aria-selected={u.id === pickId}>
                <td><div className="row" style={{ "--gap": "10px" }}><span className="avatar" style={{ width: 32, height: 32, fontSize: 12 }}>{initials(u.name)}</span><span>{u.name}<small className="muted" style={{ display: "block" }}>{u.email}</small></span></div></td>
                <td><span className="tag">{ROLE[u.role]}</span></td>
                <td className={"r num" + (done?.id === u.id ? " flash" : "")} key={done?.id === u.id ? done.after : "b"}>{vnd(state.wallets[u.id] ?? 0)}</td>
              </tr>))}</tbody>
          </table></div><div className="topup__pager">{pg.pager}</div></div>
        </section>

        <aside className="topup__side">
          {pick && (
            <form className="card topup__form" onSubmit={submit}>
              <div className="row" style={{ "--gap": "12px" }}><span className="avatar">{initials(pick.name)}</span><div><div style={{ fontWeight: 500 }}>{pick.name}</div><div className="small muted">{ROLE[pick.role]} · {pick.email}</div></div></div>
              <div className="topup__bal"><span className="small muted">Số dư hiện tại</span><b className="mono"><Count key={pick.id} value={bal} /></b></div>
              {done?.id === pick.id && (
                <div className="notice notice--ok topup__done"><Icon name="check" /><span>Đã cấp <b className="mono">+{vnd(done.amount)}</b>. Số dư <span className="mono">{vnd(done.before)}</span> → <b className="mono">{vnd(done.after)}</b></span></div>
              )}
              <div className="field"><label htmlFor="amt">Số tiền cấp (đ)</label><input id="amt" className="input mono" inputMode="numeric" value={amount ? n.toLocaleString("vi-VN") : ""} onChange={(e) => { setAmount(e.target.value.replace(/\D/g, "")); setDone(null); }} aria-invalid={!!err} placeholder="200.000" />{err && <span className="field__err">{err}</span>}</div>
              <div className="topup__quick">{[[100000, "100k"], [200000, "200k"], [500000, "500k"], [1000000, "1 triệu"]].map(([v, l]) => <button type="button" key={v} className={"chip" + (n === v ? " on" : "")} onClick={() => { setAmount(String(v)); setDone(null); }}>{l}</button>)}</div>
              <div className="field"><label htmlFor="nt">Nội dung</label><input id="nt" className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Admin cấp tiền" /></div>
              <div className="bill-row topup__after"><span>Số dư sau khi cấp</span><span className="num">{vnd(bal + (n || 0))}</span></div>
              <button className="btn btn--primary btn--block" disabled={!n}>Cấp {n ? vnd(n) : "tiền"} cho {pick.name.split(" ").at(-1)}</button>
            </form>
          )}
          <section className="card topup__recent">
            <h3>Lần cấp gần đây</h3>
            {recent.map((t) => <div key={t.id} className="bill-row"><span>{userName(state, t.userId)}<small className="mono">{dateTime(t.at)}</small></span><span className="num amount-in">+{vnd(t.amount)}</span></div>)}
          </section>
        </aside>
      </div>
    </>
  );
}

export function AdminTransactionsPage() {
  const { state } = useStore();
  const [type, setType] = useState("ALL");
  const loading = useLoading();
  const rows = state.transactions.filter((t) => type === "ALL" || t.type === type).sort((a, b) => (a.at < b.at ? 1 : -1));
  const pg = usePaged(rows, 57, { reserve: 116, reset: type });
  const inSum = state.transactions.filter((t) => t.amount > 0).reduce((a, t) => a + t.amount, 0);
  const outSum = -state.transactions.filter((t) => t.amount < 0).reduce((a, t) => a + t.amount, 0);
  const byType = Object.keys(TX_TYPES).map((t) => { const xs = state.transactions.filter((x) => x.type === t); return [t, xs.length, xs.reduce((a, x) => a + x.amount, 0)]; });
  return (
    <>
      <div className="page-head"><div><h1>Giao dịch ví</h1></div></div>
      <div className="txp">
        <div className="txp__main">
          <div className="chips" style={{ marginBottom: 12, flex: "none" }}>{["ALL", ...Object.keys(TX_TYPES)].map((t) => <button key={t} className={"chip" + (type === t ? " on" : "")} onClick={() => setType(t)}>{t === "ALL" ? "Tất cả" : TX_TYPES[t]} <span className="muted">{t === "ALL" ? state.transactions.length : state.transactions.filter((x) => x.type === t).length}</span></button>)}</div>
          <div className="results" ref={pg.ref}>{loading ? <SkelRows /> : <><TxTable rows={pg.items} showUser />{pg.pager}</>}</div>
        </div>
        <aside className="txp__side">
          {loading ? <SkelCard h={220} /> : (
            <section className="card fade-in">
              <div className="card__head"><div><h2>Dòng tiền 21 ngày</h2></div></div>
              <div className="txp__sum"><div><span className="small muted">Vào</span><b className="mono amount-in">{vnd(inSum)}</b></div><div><span className="small muted">Ra</span><b className="mono">{vnd(outSum)}</b></div></div>
              <FlowChart txs={state.transactions} height={150} />
            </section>
          )}
          <section className="card">
            <h3 style={{ marginBottom: 6 }}>Theo loại</h3>
            {byType.map(([t, n, sum]) => <div key={t} className="bill-row"><span>{TX_TYPES[t]}<small><span className="mono">{n}</span> giao dịch</small></span><span className={"num" + (sum > 0 ? " amount-in" : "")}>{signedVnd(sum)}</span></div>)}
          </section>
        </aside>
      </div>
    </>
  );
}

export function AdminBookingsPage() {
  const { state, api } = useStore();
  const toast = useToast();
  const [st, setSt] = useState("ALL");
  const rows = state.bookings.filter((b) => st === "ALL" || b.status === st).sort((a, b) => (a.date < b.date ? 1 : -1));
  const pg = usePaged(rows, 57, { reserve: 120, reset: st });
  return (
    <>
      <div className="page-head"><div><h1>Đơn đặt sân</h1></div></div>
      <div className="chips" style={{ marginBottom: 16, flex: "none" }}>{["ALL", ...Object.keys(STATUS)].map((s) => <button key={s} className={"chip" + (st === s ? " on" : "")} onClick={() => setSt(s)}>{s === "ALL" ? "Tất cả" : STATUS[s].label}</button>)}</div>
      <div className="results" ref={pg.ref}><div className="table-wrap"><table className="table">
        <thead><tr><th>Mã</th><th>Khách</th><th>Cơ sở</th><th>Ngày, giờ</th><th>Trạng thái</th><th className="r">Tổng</th><th /></tr></thead>
        <tbody>{pg.items.map((b) => {
          const f = state.facilities.find((x) => x.id === b.facilityId);
          return (
            <tr key={b.id}>
              <td className="mono muted">{b.id}</td><td>{userName(state, b.userId)}</td><td>{f.name}</td>
              <td><span className="small">{shortDay(b.date)}</span> <span className="mono small">{slotRange(b.slots)}</span></td>
              <td><StatusBadge status={b.status} /></td><td className="r num">{vnd(bookingQuote(state, b).total)}</td>
              <td className="r">{["PENDING_DEPOSIT", "DEPOSITED"].includes(b.status) && <button className="btn btn--sm btn--ghost" onClick={() => { api.cancelBooking(b.id); toast(`Đã hủy ${b.id}`); }}>Hủy</button>}</td>
            </tr>);
        })}</tbody>
      </table></div>{pg.pager}</div>
    </>
  );
}

export function AdminHolidaysPage() {
  const { state, api } = useStore();
  const toast = useToast();
  const [h, setH] = useState({ name: "", date: "", yearly: true });
  const [err, setErr] = useState("");
  const add = (e) => {
    e.preventDefault();
    if (!h.name.trim() || !h.date) return setErr("Nhập tên và chọn ngày.");
    const r = api.addHoliday({ ...h, name: h.name.trim() });
    if (r.error) return setErr(r.error);
    setH({ name: "", date: "", yearly: true }); setErr(""); toast("Đã thêm ngày lễ");
  };
  return (
    <>
      <div className="page-head"><div><h1>Danh mục ngày lễ</h1></div></div>
      <div className="split split--narrow">
        <div className="table-wrap"><table className="table">
          <thead><tr><th>Ngày lễ</th><th>Ngày</th><th>Lặp hằng năm</th></tr></thead>
          <tbody>{[...state.holidays].sort((a, b) => (a.date < b.date ? -1 : 1)).map((x) => (
            <tr key={x.id}><td style={{ fontWeight: 500 }}>{x.name}</td><td>{longDay(x.date)}</td><td>{x.yearly ? <span className="badge badge--deposited">Có</span> : <span className="badge">Không</span>}</td></tr>
          ))}</tbody>
        </table></div>
        <form className="card sticky stack" onSubmit={add}>
          <h3>Thêm ngày lễ</h3>
          <div className="field"><label htmlFor="hn">Tên ngày lễ</label><input id="hn" className="input" value={h.name} onChange={(e) => setH({ ...h, name: e.target.value })} /></div>
          <div className="field"><label htmlFor="hd">Ngày</label><input id="hd" className="input" type="date" value={h.date} onChange={(e) => setH({ ...h, date: e.target.value })} /></div>
          <div className="row between"><span className="label">Lặp lại hằng năm</span><Switch label="Lặp lại hằng năm" checked={h.yearly} onChange={(v) => setH({ ...h, yearly: v })} /></div>
          {err && <span className="field__err">{err}</span>}
          <button className="btn btn--primary">Thêm ngày lễ</button>
        </form>
      </div>
    </>
  );
}
