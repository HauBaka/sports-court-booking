import { useState } from "react";
import { Link } from "react-router-dom";
import { useStore, bookingQuote, userName } from "../../data/store";
import { longDay, shortDay, slotRange, vnd, initials } from "../../lib/format";
import { Count, Icon, Modal, StatusBadge, STATUS, Switch, TX_TYPES, useToast } from "../../components/ui";
import { TxTable } from "../AccountPages";
import { FlowChart, SkelCard, SkelRows, SkelStats, useLoading } from "../../components/charts";

const ROLE = { customer: "Khách hàng", owner: "Chủ sân", admin: "Admin" };

export function AdminDashboard() {
  const { state, api } = useStore();
  const loading = useLoading();
  const toast = useToast();
  const byRole = (r) => state.users.filter((u) => u.role === r).length;
  const byStatus = Object.keys(STATUS).map((s) => [s, state.bookings.filter((b) => b.status === s).length]);
  const max = Math.max(...byStatus.map(([, n]) => n), 1);
  const topups = state.transactions.filter((t) => t.type === "TOPUP").reduce((a, t) => a + t.amount, 0);
  const courts = state.facilities.reduce((a, f) => a + f.courts.length, 0);
  const pending = state.bookings.filter((b) => b.status === "PENDING_DEPOSIT").length;
  return (
    <>
      <div className="page-head">
        <div><h1>Tổng quan hệ thống</h1><p>Giữ chỗ quá 10 phút được dọn mỗi 60 giây.</p></div>
        <button className="btn" onClick={() => { const n = api.expireHolds(); toast(n ? `Đã hủy ${n} đơn giữ chỗ hết hạn` : "Không có đơn hết hạn"); }}><Icon name="refresh" size={16} />Dọn giữ chỗ hết hạn</button>
      </div>
      <div className="grid-4 stagger" style={{ marginBottom: 20, flex: "none" }}>
        {loading ? <SkelStats n={4} /> : <>
        <div className="stat"><div className="stat__label">Người dùng</div><div className="stat__value"><Count value={state.users.length} from={0} format={Math.round} /></div><div className="stat__foot">{byRole("customer")} khách · {byRole("owner")} chủ sân · {byRole("admin")} admin</div></div>
        <div className="stat"><div className="stat__label">Cơ sở và sân con</div><div className="stat__value">{state.facilities.length}<small>/ {courts} sân</small></div><div className="stat__foot">{state.facilities.filter((f) => f.city === "TP.HCM").length} cơ sở ở TP.HCM</div></div>
        <div className="stat stat--accent"><div className="stat__label">Cọc đang giữ ở ví hệ thống</div><div className="stat__value"><Count value={state.wallets.system} from={0} /></div><div className="stat__foot">Chờ hủy hoặc kết toán</div></div>
        <div className="stat"><div className="stat__label">Tổng tiền Admin đã cấp</div><div className="stat__value"><Count value={topups} from={0} /></div><div className="stat__foot">{state.transactions.filter((t) => t.type === "TOPUP").length} lần cấp</div></div>
        </>}
      </div>
      <div className="grid-2 panes">
        <section className="card">
          <div className="card__head"><div><h2>Đơn theo trạng thái</h2><p>{state.bookings.length} đơn trên hệ thống</p></div>{pending > 0 && <span className="badge badge--pending">{pending} đang giữ chỗ</span>}</div>
          <div className="stack" style={{ "--gap": "16px" }}>
            {byStatus.map(([s, n]) => (
              <div key={s}>
                <div className="row between small" style={{ marginBottom: 6 }}><StatusBadge status={s} /><span className="mono">{n}</span></div>
                <div className="bar"><i style={{ width: `${(n / max) * 100}%`, background: { PENDING_DEPOSIT: "var(--warn)", DEPOSITED: "var(--accent)", COMPLETED: "var(--info)", CANCELLED: "var(--muted)" }[s] }} /></div>
              </div>
            ))}
          </div>
        </section>
        <section className="card">
          <div className="card__head"><div><h2>Giao dịch gần đây</h2></div><Link className="link small" to="/admin/giao-dich">Xem tất cả</Link></div>
          {state.transactions.slice(0, 6).map((t) => (
            <div key={t.id} className="bill-row"><span>{userName(state, t.userId)}<small>{TX_TYPES[t.type]} · {t.note}</small></span><span className={"num " + (t.amount > 0 ? "amount-in" : "")}>{t.amount > 0 ? "+" : ""}{vnd(t.amount)}</span></div>
          ))}
        </section>
      </div>
    </>
  );
}

export function AdminTopupPage() {
  const { state, api } = useStore();
  const toast = useToast();
  const [q, setQ] = useState("");
  const [pick, setPick] = useState(null);
  const [amount, setAmount] = useState("");
  const [err, setErr] = useState("");
  const users = state.users.filter((u) => u.role !== "admin" && (u.name + u.email).toLowerCase().includes(q.toLowerCase()));
  const submit = () => {
    const n = Number(amount);
    if (!n || n < 10000) return setErr("Nhập số tiền từ 10.000đ trở lên.");
    if (n > 10000000) return setErr("Mỗi lần cấp tối đa 10.000.000đ.");
    api.topup(pick.id, n, "Admin cấp tiền");
    toast(`Đã cấp ${vnd(n)} cho ${pick.name}`);
    setPick(null); setAmount(""); setErr("");
  };
  return (
    <>
      <div className="page-head"><div><h1>Cấp tiền vào ví</h1><p>Bản mẫu chưa nạp tiền thật. Mỗi lần cấp ghi một giao dịch.</p></div></div>
      <div className="input-group" style={{ maxWidth: 420, marginBottom: 20 }}><input className="input" placeholder="Tìm theo tên hoặc email" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Tìm người dùng" /><span style={{ position: "absolute", right: 14, top: 14, color: "var(--muted)" }}><Icon name="search" /></span></div>
      <div className="table-wrap"><table className="table">
        <thead><tr><th>Người dùng</th><th>Email</th><th>Vai trò</th><th className="r">Số dư</th><th /></tr></thead>
        <tbody>{users.map((u) => (
          <tr key={u.id}>
            <td><div className="row" style={{ "--gap": "10px" }}><span className="avatar" style={{ width: 32, height: 32, fontSize: 12 }}>{initials(u.name)}</span>{u.name}</div></td>
            <td className="ink2">{u.email}</td><td><span className="tag">{ROLE[u.role]}</span></td>
            <td className="r num">{vnd(state.wallets[u.id] ?? 0)}</td>
            <td className="r"><button className="btn btn--sm" onClick={() => { setPick(u); setErr(""); }}>Cấp tiền</button></td>
          </tr>))}</tbody>
      </table></div>
      {pick && (
        <Modal title={`Cấp tiền cho ${pick.name}`} onClose={() => setPick(null)} footer={<><button className="btn btn--ghost" onClick={() => setPick(null)}>Hủy</button><button className="btn btn--primary" onClick={submit}>Cấp {amount ? vnd(Number(amount)) : "tiền"}</button></>}>
          <p className="ink2">Số dư hiện tại <span className="mono">{vnd(state.wallets[pick.id] ?? 0)}</span></p>
          <div className="field" style={{ marginTop: 18 }}><label htmlFor="amt">Số tiền (đ)</label><input id="amt" className="input mono" inputMode="numeric" autoFocus value={amount ? Number(amount).toLocaleString("vi-VN") : ""} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))} aria-invalid={!!err} />{err && <span className="field__err">{err}</span>}</div>
          <div className="chips" style={{ marginTop: 12 }}>{[100000, 200000, 500000, 1000000].map((n) => <button key={n} className="chip" onClick={() => setAmount(String(n))}>{vnd(n)}</button>)}</div>
        </Modal>
      )}
    </>
  );
}

export function AdminTransactionsPage() {
  const { state } = useStore();
  const [type, setType] = useState("ALL");
  const loading = useLoading();
  const rows = state.transactions.filter((t) => type === "ALL" || t.type === type);
  const inSum = state.transactions.filter((t) => t.amount > 0).reduce((a, t) => a + t.amount, 0);
  const outSum = -state.transactions.filter((t) => t.amount < 0).reduce((a, t) => a + t.amount, 0);
  return (
    <>
      <div className="page-head"><div><h1>Giao dịch ví</h1><p>Mọi lần cấp tiền, cọc, hoàn cọc và kết toán trên hệ thống. Rê chuột lên cột để xem từng ngày.</p></div></div>
      <div className="tx-top">
        {loading ? <SkelCard h={200} /> : (
          <section className="card fade-in">
            <div className="card__head"><div><h2>Dòng tiền 21 ngày qua</h2><p>Vào {vnd(inSum)} · Ra {vnd(outSum)}</p></div></div>
            <FlowChart txs={state.transactions} height={118} />
          </section>
        )}
      </div>
      <div className="chips" style={{ margin: "14px 0 12px", flex: "none" }}>{["ALL", ...Object.keys(TX_TYPES)].map((t) => <button key={t} className={"chip" + (type === t ? " on" : "")} onClick={() => setType(t)}>{t === "ALL" ? "Tất cả" : TX_TYPES[t]} <span className="muted">{t === "ALL" ? state.transactions.length : state.transactions.filter((x) => x.type === t).length}</span></button>)}</div>
      {loading ? <SkelRows /> : <TxTable rows={rows} showUser className="fit" />}
    </>
  );
}

export function AdminBookingsPage() {
  const { state, api } = useStore();
  const toast = useToast();
  const [st, setSt] = useState("ALL");
  const rows = state.bookings.filter((b) => st === "ALL" || b.status === st).sort((a, b) => (a.date < b.date ? 1 : -1));
  return (
    <>
      <div className="page-head"><div><h1>Đơn đặt sân</h1><p>Hủy được đơn chưa đến giờ chơi.</p></div></div>
      <div className="chips" style={{ marginBottom: 20 }}>{["ALL", ...Object.keys(STATUS)].map((s) => <button key={s} className={"chip" + (st === s ? " on" : "")} onClick={() => setSt(s)}>{s === "ALL" ? "Tất cả" : STATUS[s].label}</button>)}</div>
      <div className="table-wrap"><table className="table">
        <thead><tr><th>Mã</th><th>Khách</th><th>Cơ sở</th><th>Ngày, giờ</th><th>Trạng thái</th><th className="r">Tổng</th><th /></tr></thead>
        <tbody>{rows.map((b) => {
          const f = state.facilities.find((x) => x.id === b.facilityId);
          return (
            <tr key={b.id}>
              <td className="mono muted">{b.id}</td><td>{userName(state, b.userId)}</td><td>{f.name}</td>
              <td><span className="small">{shortDay(b.date)}</span> <span className="mono small">{slotRange(b.slots)}</span></td>
              <td><StatusBadge status={b.status} /></td><td className="r num">{vnd(bookingQuote(state, b).total)}</td>
              <td className="r">{["PENDING_DEPOSIT", "DEPOSITED"].includes(b.status) && <button className="btn btn--sm btn--ghost" onClick={() => { api.cancelBooking(b.id); toast(`Đã hủy ${b.id}`); }}>Hủy</button>}</td>
            </tr>);
        })}</tbody>
      </table></div>
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
      <div className="page-head"><div><h1>Danh mục ngày lễ</h1><p>Ngày lễ dùng cho hệ số giá của chủ sân.</p></div></div>
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
