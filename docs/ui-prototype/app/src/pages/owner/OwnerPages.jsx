import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useStore, occupancy, bookingQuote, userName } from "../../data/store";
import { AMENITIES, CITIES, SPORTS, sportName, PHOTOS } from "../../data/mock";
import { addDays, dateKey, hoursBetween, longDay, parseKey, slotRange, vnd } from "../../lib/format";
import { multiplierFor, playStarted } from "../../lib/pricing";
import { SlotGrid, SlotLegend } from "../../components/SlotGrid";
import { Empty, Icon, Modal, StatusBadge, Switch, useToast } from "../../components/ui";

const useMine = () => {
  const { state, me } = useStore();
  return state.facilities.filter((f) => f.ownerId === me.id);
};

function FacilityPicker({ value, onChange }) {
  const mine = useMine();
  return (
    <select className="select" style={{ width: 280 }} value={value} onChange={(e) => onChange(e.target.value)} aria-label="Cơ sở">
      {mine.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
    </select>
  );
}

/* Danh sách cơ sở */
export function OwnerFacilitiesPage() {
  const { state } = useStore();
  const mine = useMine();
  const today = dateKey(new Date());
  return (
    <>
      <div className="page-head">
        <div><h1>Cơ sở của tôi</h1><p>{mine.length} cơ sở, {mine.reduce((a, f) => a + f.courts.length, 0)} sân con.</p></div>
        <Link className="btn btn--primary" to="/chu-san/co-so/moi"><Icon name="plus" size={16} />Thêm cơ sở</Link>
      </div>
      <div className="grid-4 stagger" style={{ marginBottom: 20, flex: "none" }}>
        {(() => {
          const todays = state.bookings.filter((b) => mine.some((f) => f.id === b.facilityId) && b.date === today);
          const settle = state.transactions.filter((t) => t.type === "SETTLE" && mine.length && t.userId === mine[0].ownerId).reduce((a, t) => a + t.amount, 0);
          return [
            ["Đơn hôm nay", todays.filter((b) => b.status !== "CANCELLED").length, "đơn"],
            ["Chờ đặt cọc", todays.filter((b) => b.status === "PENDING_DEPOSIT").length, "đơn đang giữ chỗ"],
            ["Cần xác nhận hoàn tất", state.bookings.filter((b) => mine.some((f) => f.id === b.facilityId) && b.status === "DEPOSITED" && playStarted(b.date, b.slots[0])).length, "buổi đã chơi"],
            ["Đã kết toán", vnd(settle), "tiền cọc vào ví"],
          ].map(([l, v, s]) => <div key={l} className="stat"><div className="stat__label">{l}</div><div className="stat__value">{v}</div><div className="stat__foot">{s}</div></div>);
        })()}
      </div>
      <div className="grid-2 stagger fit scroll" style={{ alignContent: "start" }}>
        {mine.map((f) => (
          <Link key={f.id} to={`/chu-san/co-so/${f.id}`} className="card card--flush">
            <div className="zoom" style={{ height: 150 }}><img src={f.photos[0]} alt="" /></div>
            <div style={{ padding: 22 }}>
              <div className="row between"><h3 style={{ fontSize: 20 }}>{f.name}</h3><span className="chips">{f.sports.map((s) => <span key={s} className="tag">{sportName(s)}</span>)}</span></div>
              <div className="small ink2" style={{ marginTop: 6 }}>{f.street}, {f.district}, {f.city} · {f.open}–{f.close}</div>
              <hr className="divider" style={{ margin: "16px 0" }} />
              <div className="row between small"><span>{f.courts.filter((c) => c.active).length}/{f.courts.length} sân đang hoạt động</span><span className="muted">{f.rules.length} quy tắc giá · {f.services.filter((s) => s.active).length} dịch vụ</span></div>
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}

/* Tạo / sửa cơ sở + sân con */
const blank = (ownerId) => ({ id: "", ownerId, name: "", sports: [], street: "", district: "", city: "TP.HCM", open: "06:00", close: "22:00", description: "", amenities: [], photos: [PHOTOS.badmintonHall], map: { x: 50, y: 50 }, rating: 0, reviews: 0, courts: [], services: [], rules: [] });
const HOURS = Array.from({ length: 25 }, (_, h) => `${String(h).padStart(2, "0")}:00`).slice(0, 25).map((x) => (x === "24:00" ? "23:59" : x));

export function OwnerFacilityEditPage() {
  const { id } = useParams();
  const { state, api, me } = useStore();
  const nav = useNavigate();
  const toast = useToast();
  const isNew = id === "moi";
  const [f, setF] = useState(() => structuredClone(state.facilities.find((x) => x.id === id) ?? blank(me.id)));
  const [err, setErr] = useState({});
  const [courtEdit, setCourtEdit] = useState(null);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const save = (e) => {
    e.preventDefault();
    const er = {};
    if (!f.name.trim()) er.name = "Nhập tên cơ sở.";
    if (!f.street.trim()) er.street = "Nhập tên đường.";
    if (!f.district) er.district = "Chọn quận, huyện.";
    if (f.open >= f.close) er.close = "Giờ đóng cửa phải sau giờ mở cửa.";
    setErr(er);
    if (Object.keys(er).length) return;
    const out = { ...f, id: f.id || f.name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""), sports: [...new Set(f.courts.map((c) => c.sport))] };
    api.saveFacility(out);
    toast(isNew ? "Đã tạo cơ sở" : "Đã lưu thay đổi");
    nav(`/chu-san/co-so/${out.id}`, { replace: true });
  };

  const saveCourt = (c) => {
    if (c.open < f.open || c.close > f.close) return "Giờ sân phải nằm trong giờ mở cửa của cơ sở.";
    const courts = c.id ? f.courts.map((x) => (x.id === c.id ? c : x)) : [...f.courts, { ...c, id: "c" + Date.now() }];
    setF({ ...f, courts });
    setCourtEdit(null);
    return null;
  };

  return (
    <form className="fill-form" onSubmit={save} noValidate>
      <nav className="crumbs"><Link to="/chu-san">Cơ sở của tôi</Link><span>/</span><span className="ink2">{isNew ? "Thêm cơ sở" : f.name}</span></nav>
      <div className="page-head">
        <div><h1>{isNew ? "Thêm cơ sở" : f.name}</h1><p>Khách thấy thông tin này khi tìm sân.</p></div>
        <div className="row">{!isNew && <Link className="btn" to={`/san/${f.id}`}>Xem như khách</Link>}<button className="btn btn--primary">{isNew ? "Tạo cơ sở" : "Lưu thay đổi"}</button></div>
      </div>
      <div className="split split--narrow">
        <div className="stack scroll" style={{ "--gap": "24px" }}>
          <section className="card">
            <h2 style={{ marginBottom: 20 }}>Thông tin cơ sở</h2>
            <div className="form-grid">
              <div className="field full"><label htmlFor="fn">Tên cơ sở</label><input id="fn" className="input" value={f.name} onChange={set("name")} aria-invalid={!!err.name} />{err.name && <span className="field__err">{err.name}</span>}</div>
              <div className="field"><label htmlFor="fs">Đường</label><input id="fs" className="input" value={f.street} onChange={set("street")} aria-invalid={!!err.street} placeholder="Cộng Hòa" />{err.street && <span className="field__err">{err.street}</span>}</div>
              <div className="field"><label htmlFor="fc">Thành phố</label><select id="fc" className="select" value={f.city} onChange={(e) => setF({ ...f, city: e.target.value, district: "" })}>{Object.keys(CITIES).map((c) => <option key={c}>{c}</option>)}</select></div>
              <div className="field"><label htmlFor="fd">Quận, huyện</label><select id="fd" className="select" value={f.district} onChange={set("district")} aria-invalid={!!err.district}><option value="">Chọn</option>{CITIES[f.city].map((d) => <option key={d}>{d}</option>)}</select>{err.district && <span className="field__err">{err.district}</span>}</div>
              <div className="field"><span className="label">Vị trí trên bản đồ</span><div className="input row" style={{ alignItems: "center", color: "var(--ink-2)" }}><Icon name="pin" size={16} />Ghim theo địa chỉ khi lưu</div></div>
              <div className="field full"><label htmlFor="fde">Mô tả</label><textarea id="fde" className="textarea" value={f.description} onChange={set("description")} placeholder="Số sân, mặt sân, chỗ để xe..." /></div>
            </div>
          </section>

          <section className="card">
            <div className="card__head"><div><h2>Sân con</h2><p>Giờ sân nằm trong giờ mở cửa.</p></div><button type="button" className="btn btn--sm" onClick={() => setCourtEdit({ id: "", name: `Sân ${f.courts.length + 1}`, sport: "badminton", type: "Thảm PVC", indoor: true, open: f.open, close: f.close, price: 100000, active: true })}><Icon name="plus" size={15} />Thêm sân con</button></div>
            {f.courts.length === 0 ? <Empty title="Chưa có sân con">Thêm ít nhất một sân để khách đặt được.</Empty> : (
              <div className="table-wrap"><table className="table">
                <thead><tr><th>Sân</th><th>Môn</th><th>Loại</th><th>Giờ</th><th className="r">Giá cơ sở</th><th>Hoạt động</th><th /></tr></thead>
                <tbody>{f.courts.map((c) => (
                  <tr key={c.id}>
                    <td style={{ fontWeight: 500 }}>{c.name}</td><td>{sportName(c.sport)}</td><td className="ink2">{c.type} · {c.indoor ? "Trong nhà" : "Ngoài trời"}</td>
                    <td className="mono">{c.open}–{c.close}</td><td className="r num">{vnd(c.price)}</td>
                    <td><Switch label={`Bật tắt ${c.name}`} checked={c.active} onChange={(v) => setF({ ...f, courts: f.courts.map((x) => (x.id === c.id ? { ...x, active: v } : x)) })} /></td>
                    <td className="r"><button type="button" className="icon-btn" onClick={() => setCourtEdit(c)} aria-label={`Sửa ${c.name}`}><Icon name="edit" size={16} /></button></td>
                  </tr>))}</tbody>
              </table></div>
            )}
          </section>
        </div>

        <aside className="stack sticky" style={{ "--gap": "16px" }}>
          <section className="card">
            <h3 style={{ marginBottom: 16 }}>Giờ mở cửa</h3>
            <div className="grid-2" style={{ gap: 12 }}>
              <div className="field"><label htmlFor="op">Mở</label><select id="op" className="select" value={f.open} onChange={set("open")}>{HOURS.map((h) => <option key={h}>{h}</option>)}</select></div>
              <div className="field"><label htmlFor="cl">Đóng</label><select id="cl" className="select" value={f.close} onChange={set("close")} aria-invalid={!!err.close}>{HOURS.map((h) => <option key={h}>{h}</option>)}</select></div>
            </div>
            {err.close && <p className="field__err" style={{ marginTop: 8 }}>{err.close}</p>}
            <p className="small muted" style={{ marginTop: 12 }}>Mỗi ngày {hoursBetween(f.open, f.close).length} khung giờ một tiếng.</p>
          </section>
          <section className="card">
            <h3 style={{ marginBottom: 14 }}>Tiện ích</h3>
            <div className="chips">{AMENITIES.map((a) => <button type="button" key={a} className={"chip" + (f.amenities.includes(a) ? " on" : "")} aria-pressed={f.amenities.includes(a)} onClick={() => setF({ ...f, amenities: f.amenities.includes(a) ? f.amenities.filter((x) => x !== a) : [...f.amenities, a] })}>{a}</button>)}</div>
          </section>
          <section className="card">
            <h3 style={{ marginBottom: 14 }}>Ảnh</h3>
            <div className="grid-3" style={{ gap: 8 }}>{f.photos.map((p, i) => <img key={i} src={p} alt="" style={{ aspectRatio: "1", objectFit: "cover", borderRadius: 8 }} />)}<div className="empty" style={{ padding: 0, display: "grid", placeItems: "center", aspectRatio: "1" }}><Icon name="plus" /></div></div>
          </section>
        </aside>
      </div>
      {courtEdit && <CourtModal court={courtEdit} facility={f} onClose={() => setCourtEdit(null)} onSave={saveCourt} />}
    </form>
  );
}

function CourtModal({ court, facility, onClose, onSave }) {
  const [c, setC] = useState(court);
  const [err, setErr] = useState("");
  const set = (k, num) => (e) => setC({ ...c, [k]: num ? Number(e.target.value.replace(/\D/g, "")) : e.target.value });
  const fh = hoursBetween(facility.open, facility.close).concat(facility.close);
  return (
    <Modal title={court.id ? `Sửa ${court.name}` : "Thêm sân con"} onClose={onClose} footer={<><button type="button" className="btn btn--ghost" onClick={onClose}>Hủy</button><button type="button" className="btn btn--primary" onClick={() => setErr(onSave(c) || "")}>Lưu sân</button></>}>
      <div className="form-grid" style={{ marginTop: 16 }}>
        <div className="field"><label htmlFor="cn">Tên sân</label><input id="cn" className="input" value={c.name} onChange={set("name")} /></div>
        <div className="field"><label htmlFor="cs">Môn</label><select id="cs" className="select" value={c.sport} onChange={set("sport")}>{SPORTS.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
        <div className="field"><label htmlFor="ct">Mặt sân</label><input id="ct" className="input" value={c.type} onChange={set("type")} /></div>
        <div className="field"><span className="label">Vị trí</span><div className="seg">{[[true, "Trong nhà"], [false, "Ngoài trời"]].map(([v, l]) => <button type="button" key={l} className={c.indoor === v ? "on" : ""} onClick={() => setC({ ...c, indoor: v })}>{l}</button>)}</div></div>
        <div className="field"><label htmlFor="co">Mở</label><select id="co" className="select" value={c.open} onChange={set("open")}>{fh.map((h) => <option key={h}>{h}</option>)}</select></div>
        <div className="field"><label htmlFor="cc">Đóng</label><select id="cc" className="select" value={c.close} onChange={set("close")}>{fh.map((h) => <option key={h}>{h}</option>)}</select></div>
        <div className="field full"><label htmlFor="cp">Giá cơ sở mỗi giờ (đ)</label><input id="cp" className="input mono" inputMode="numeric" value={c.price.toLocaleString("vi-VN")} onChange={set("price", true)} /></div>
      </div>
      {err && <div className="notice notice--danger" style={{ marginTop: 16 }}><Icon name="alert" />{err}</div>}
    </Modal>
  );
}

/* Bảng giá và hệ số */
const RULE_TYPES = { PEAK: "Giờ cao điểm", WEEKEND: "Cuối tuần", HOLIDAY: "Ngày lễ" };
export function OwnerPricingPage() {
  const { state, api } = useStore();
  const toast = useToast();
  const mine = useMine();
  const [fid, setFid] = useState(mine[0]?.id);
  const f = state.facilities.find((x) => x.id === fid);
  const [rules, setRules] = useState(() => structuredClone(f?.rules ?? []));
  const [prices, setPrices] = useState(() => Object.fromEntries((f?.courts ?? []).map((c) => [c.id, c.price])));
  const [err, setErr] = useState("");
  const pick = (id) => { const x = state.facilities.find((y) => y.id === id); setFid(id); setRules(structuredClone(x.rules)); setPrices(Object.fromEntries(x.courts.map((c) => [c.id, c.price]))); setErr(""); };
  if (!f) return <Empty title="Chưa có cơ sở">Tạo cơ sở trước khi đặt giá.</Empty>;

  const upd = (i, k, v) => setRules(rules.map((r, j) => (j === i ? { ...r, [k]: v, ...(k === "type" ? { label: RULE_TYPES[v] } : {}) } : r)));
  const save = () => {
    const bad = rules.find((r) => r.multiplier < 1.2 || r.multiplier > 1.5);
    if (bad) return setErr("Hệ số phải từ 1,2 đến 1,5 (tăng 20% đến 50%).");
    if (rules.some((r) => r.type === "PEAK" && r.from >= r.to)) return setErr("Giờ kết thúc cao điểm phải sau giờ bắt đầu.");
    api.saveFacility({ ...f, rules, courts: f.courts.map((c) => ({ ...c, price: prices[c.id] })) });
    setErr(""); toast("Đã thay toàn bộ bảng giá");
  };
  const week = Array.from({ length: 7 }, (_, i) => dateKey(addDays(new Date(), i)));
  const hours = hoursBetween(f.open, f.close).filter((_, i) => i % 2 === 0);

  return (
    <>
      <div className="page-head">
        <div><h1>Bảng giá và hệ số</h1><p>Giá theo sân, nhân hệ số cao nhất khi trùng quy tắc.</p></div>
        <div className="row"><FacilityPicker value={fid} onChange={pick} /><button className="btn btn--primary" onClick={save}>Lưu bảng giá</button></div>
      </div>
      {err && <div className="notice notice--danger" style={{ marginBottom: 20 }}><Icon name="alert" />{err}</div>}
      <div className="grid-2 panes">
        <div className="stack" style={{ "--gap": "24px" }}>
          <section className="card">
            <h2 style={{ marginBottom: 16 }}>Giá cơ sở mỗi giờ</h2>
            {f.courts.map((c) => (
              <div key={c.id} className="bill-row" style={{ alignItems: "center" }}>
                <span>{c.name}<small>{sportName(c.sport)}</small></span>
                <input className="input mono" style={{ width: 150, height: 40, textAlign: "right" }} inputMode="numeric" aria-label={`Giá ${c.name}`} value={(prices[c.id] ?? 0).toLocaleString("vi-VN")} onChange={(e) => setPrices({ ...prices, [c.id]: Number(e.target.value.replace(/\D/g, "")) })} />
              </div>
            ))}
          </section>
          <section className="card">
            <div className="card__head"><div><h2>Quy tắc hệ số</h2><p>Mỗi quy tắc một hệ số từ 1,2 đến 1,5.</p></div><button className="btn btn--sm" onClick={() => setRules([...rules, { id: "r" + Date.now(), type: "PEAK", label: "Giờ cao điểm", from: "17:00", to: "20:00", multiplier: 1.3 }])}><Icon name="plus" size={15} />Thêm quy tắc</button></div>
            {rules.length === 0 && <p className="muted">Chưa có quy tắc: mọi giờ tính giá cơ sở.</p>}
            <div className="stack" style={{ "--gap": "12px" }}>
              {rules.map((r, i) => (
                <div key={r.id} className="card card--tight" style={{ background: "var(--surface-2)" }}>
                  <div className="row between">
                    <select className="select" style={{ width: 180, height: 38 }} value={r.type} onChange={(e) => upd(i, "type", e.target.value)} aria-label="Loại quy tắc">{Object.entries(RULE_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
                    <button className="icon-btn" onClick={() => setRules(rules.filter((_, j) => j !== i))} aria-label="Xóa quy tắc"><Icon name="trash" size={16} /></button>
                  </div>
                  {r.type === "PEAK" && (
                    <div className="row" style={{ marginTop: 12 }}>
                      <span className="small muted">Từ</span><select className="select" style={{ width: 110, height: 38 }} value={r.from} onChange={(e) => upd(i, "from", e.target.value)} aria-label="Từ giờ">{HOURS.map((h) => <option key={h}>{h}</option>)}</select>
                      <span className="small muted">đến</span><select className="select" style={{ width: 110, height: 38 }} value={r.to} onChange={(e) => upd(i, "to", e.target.value)} aria-label="Đến giờ">{HOURS.map((h) => <option key={h}>{h}</option>)}</select>
                    </div>
                  )}
                  {r.type === "HOLIDAY" && <p className="small muted" style={{ marginTop: 10 }}>Áp dụng cho {state.holidays.length} ngày trong danh mục ngày lễ do Admin quản lý.</p>}
                  <div className="row" style={{ marginTop: 14 }}>
                    <input type="range" min="1.2" max="1.5" step="0.05" value={r.multiplier} onChange={(e) => upd(i, "multiplier", Number(e.target.value))} style={{ flex: 1, accentColor: "var(--accent)" }} aria-label="Hệ số" />
                    <span className="mono" style={{ width: 120, textAlign: "right" }}>× {r.multiplier.toFixed(2).replace(".", ",")} <span className="muted">(+{Math.round((r.multiplier - 1) * 100)}%)</span></span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
        <section className="card sticky">
          <h2>Hệ số 7 ngày tới</h2>
          <p className="muted small" style={{ margin: "4px 0 18px" }}>Màu càng đậm, giá càng cao.</p>
          <div className="heat">
            <span />{week.map((d) => <span key={d} className="heat__h">{["CN", "T2", "T3", "T4", "T5", "T6", "T7"][parseKey(d).getDay()]}</span>)}
            {hours.map((h) => (
              <Row key={h} h={h} week={week} rules={rules} holidays={state.holidays.map((x) => x.date)} />
            ))}
          </div>
          <div className="legend"><span><i style={{ background: "var(--surface-3)" }} />× 1,0</span><span><i style={{ background: "rgba(31,107,58,.55)" }} />× 1,2</span><span><i style={{ background: "var(--accent)" }} />× 1,5</span></div>
          <hr className="divider" />
          <p className="small ink2">Ví dụ: {f.courts[0]?.name} {vnd(prices[f.courts[0]?.id] ?? 0)}, 19:00 thứ Bảy = {vnd(Math.round((prices[f.courts[0]?.id] ?? 0) * Math.max(1, ...rules.filter((r) => r.type === "WEEKEND" || (r.type === "PEAK" && r.from <= "19:00" && r.to > "19:00")).map((r) => r.multiplier))))}.</p>
        </section>
      </div>
    </>
  );
}
function Row({ h, week, rules, holidays }) {
  return (<>
    <span className="heat__r">{h}</span>
    {week.map((d) => {
      const m = multiplierFor(rules, d, h, holidays).value;
      const a = (m - 1) / 0.5;
      return <span key={d} className="heat__c" style={{ background: m === 1 ? "var(--surface-3)" : `rgba(31,107,58,${0.3 + a * 0.7})`, color: m < 1.35 ? "var(--ink)" : "#fff" }}>{m === 1 ? "" : m.toFixed(1).replace(".", ",")}</span>;
    })}
  </>);
}

/* Dịch vụ đi kèm */
export function OwnerServicesPage() {
  const { state, api } = useStore();
  const toast = useToast();
  const mine = useMine();
  const [fid, setFid] = useState(mine[0]?.id);
  const f = state.facilities.find((x) => x.id === fid);
  const [nw, setNw] = useState({ name: "", unit: "", price: "" });
  const [err, setErr] = useState("");
  if (!f) return <Empty title="Chưa có cơ sở">Tạo cơ sở trước.</Empty>;
  const save = (services) => api.saveFacility({ ...f, services });
  const add = (e) => {
    e.preventDefault();
    if (!nw.name.trim() || !nw.unit.trim() || !Number(nw.price)) return setErr("Nhập đủ tên, đơn vị tính và đơn giá.");
    save([...f.services, { id: "s" + Date.now(), name: nw.name.trim(), unit: nw.unit.trim(), price: Number(nw.price), active: true }]);
    setNw({ name: "", unit: "", price: "" }); setErr(""); toast("Đã thêm dịch vụ");
  };
  return (
    <>
      <div className="page-head"><div><h1>Dịch vụ đi kèm</h1><p>Khách chọn thêm khi đặt sân.</p></div><FacilityPicker value={fid} onChange={setFid} /></div>
      <div className="split split--narrow">
        <div className="table-wrap"><table className="table">
          <thead><tr><th>Dịch vụ</th><th>Đơn vị</th><th className="r">Đơn giá</th><th>Đang bán</th></tr></thead>
          <tbody>{f.services.length === 0 ? <tr><td colSpan="4" className="muted">Chưa có dịch vụ.</td></tr> : f.services.map((s) => (
            <tr key={s.id} style={s.active ? null : { opacity: .55 }}>
              <td style={{ fontWeight: 500 }}>{s.name}</td><td className="ink2">{s.unit}</td>
              <td className="r"><input className="input mono" style={{ width: 130, height: 38, textAlign: "right", marginLeft: "auto" }} aria-label={`Đơn giá ${s.name}`} defaultValue={s.price.toLocaleString("vi-VN")} onBlur={(e) => { save(f.services.map((x) => (x.id === s.id ? { ...x, price: Number(e.target.value.replace(/\D/g, "")) } : x))); toast("Đã cập nhật đơn giá"); }} /></td>
              <td><Switch label={`Bật tắt ${s.name}`} checked={s.active} onChange={(v) => save(f.services.map((x) => (x.id === s.id ? { ...x, active: v } : x)))} /></td>
            </tr>))}</tbody>
        </table></div>
        <form className="card sticky stack" onSubmit={add}>
          <h3>Thêm dịch vụ</h3>
          <div className="field"><label htmlFor="sn">Tên dịch vụ</label><input id="sn" className="input" value={nw.name} onChange={(e) => setNw({ ...nw, name: e.target.value })} placeholder="Thuê vợt" /></div>
          <div className="grid-2" style={{ gap: 12 }}>
            <div className="field"><label htmlFor="su">Đơn vị tính</label><input id="su" className="input" value={nw.unit} onChange={(e) => setNw({ ...nw, unit: e.target.value })} placeholder="cây" /></div>
            <div className="field"><label htmlFor="sp">Đơn giá (đ)</label><input id="sp" className="input mono" inputMode="numeric" value={nw.price} onChange={(e) => setNw({ ...nw, price: e.target.value.replace(/\D/g, "") })} /></div>
          </div>
          {err && <span className="field__err">{err}</span>}
          <button className="btn btn--primary">Thêm dịch vụ</button>
        </form>
      </div>
    </>
  );
}

/* Lịch đặt theo ngày */
export function OwnerSchedulePage() {
  const { state, api } = useStore();
  const toast = useToast();
  const mine = useMine();
  const [fid, setFid] = useState(mine[0]?.id);
  const [date, setDate] = useState(dateKey(new Date()));
  const [filter, setFilter] = useState("ALL");
  const [open, setOpen] = useState(null);
  const f = state.facilities.find((x) => x.id === fid);
  const occ = useMemo(() => (f ? occupancy(state, f.id, date) : {}), [state, f, date]);
  if (!f) return <Empty title="Chưa có cơ sở">Tạo cơ sở trước.</Empty>;
  const rows = state.bookings.filter((b) => b.facilityId === f.id && b.date === date).sort((a, b) => (a.slots[0] < b.slots[0] ? -1 : 1));
  const ob = open && state.bookings.find((b) => b.id === open);
  const shift = (n) => setDate(dateKey(addDays(parseKey(date), n)));
  const counts = Object.values(occ).flatMap((c) => Object.values(c)).reduce((a, o) => ({ ...a, [o.status]: (a[o.status] || 0) + 1 }), {});

  return (
    <>
      <div className="page-head"><div><h1>Lịch đặt theo ngày</h1><p>Bấm ô có đơn để xem và xác nhận hoàn tất.</p></div></div>
      <div className="row between" style={{ marginBottom: 20 }}>
        <div className="row">
          <FacilityPicker value={fid} onChange={setFid} />
          <button className="icon-btn" onClick={() => shift(-1)} aria-label="Ngày trước"><Icon name="chevL" /></button>
          <span style={{ minWidth: 190, textAlign: "center", fontWeight: 500 }}>{longDay(date)}</span>
          <button className="icon-btn" onClick={() => shift(1)} aria-label="Ngày sau"><Icon name="chevR" /></button>
          <button className="btn btn--sm" onClick={() => setDate(dateKey(new Date()))}>Hôm nay</button>
        </div>
        <div className="chips">
          {[["ALL", "Tất cả"], ["FREE", "Trống"], ["PENDING_DEPOSIT", "Chờ cọc"], ["DEPOSITED", "Đã cọc"], ["CANCELLED", "Đã hủy"], ["LOCKED", "Khóa"]].map(([k, l]) => (
            <button key={k} className={"chip" + (filter === k ? " on" : "")} onClick={() => setFilter(k)}>{l}{k !== "ALL" && k !== "FREE" && counts[k] ? <span className="muted">{counts[k]}</span> : null}</button>
          ))}
        </div>
      </div>
      <section className="card scroll" style={{ marginBottom: 16, flex: "1.6 1 0", minHeight: 0 }}>
        <SlotGrid facility={f} date={date} occ={occ} mode="owner" statusFilter={filter} onOpen={setOpen} />
        <SlotLegend owner />
      </section>
      <h2 style={{ marginBottom: 12, fontSize: 18, flex: "none" }}>Chi tiết trong ngày</h2>
      {rows.length === 0 ? <Empty title="Chưa có đơn trên hệ thống trong ngày này">Các ô "Đã cọc" khác là lịch mẫu để minh họa lưới.</Empty> : (
        <div className="table-wrap" style={{ flex: "1 1 0", minHeight: 96 }}><table className="table">
          <thead><tr><th>Giờ</th><th>Sân</th><th>Khách</th><th>Mã đơn</th><th>Trạng thái</th><th className="r">Tiền cọc</th><th /></tr></thead>
          <tbody>{rows.map((b) => {
            const q = bookingQuote(state, b);
            const done = b.status === "DEPOSITED" && playStarted(b.date, b.slots[0]);
            return (
              <tr key={b.id}>
                <td className="mono">{slotRange(b.slots)}</td><td>{f.courts.find((c) => c.id === b.courtId).name}</td><td>{userName(state, b.userId)}</td><td className="mono muted">{b.id}</td>
                <td><StatusBadge status={b.status} /></td><td className="r num">{vnd(q.deposit)}</td>
                <td className="r">{done ? <button className="btn btn--sm btn--primary" onClick={() => { api.completeBooking(b.id); toast(`Đã kết toán ${vnd(q.deposit)} vào ví`); }}>Xác nhận hoàn tất</button> : <button className="btn btn--sm btn--ghost" onClick={() => setOpen(b.id)}>Xem</button>}</td>
              </tr>);
          })}</tbody>
        </table></div>
      )}
      {ob && (() => {
        const q = bookingQuote(state, ob);
        const started = playStarted(ob.date, ob.slots[0]);
        return (
          <Modal title={`Đơn ${ob.id}`} onClose={() => setOpen(null)} footer={<>
            <button className="btn btn--ghost" onClick={() => setOpen(null)}>Đóng</button>
            {ob.status === "DEPOSITED" && <button className="btn btn--primary" disabled={!started} onClick={() => { api.completeBooking(ob.id); toast(`Đã kết toán ${vnd(q.deposit)} vào ví`); setOpen(null); }}>Xác nhận hoàn tất</button>}
          </>}>
            <div className="row" style={{ margin: "6px 0 18px" }}><StatusBadge status={ob.status} /></div>
            <dl className="kv"><dt>Khách</dt><dd>{userName(state, ob.userId)}</dd><dt>Sân</dt><dd>{f.courts.find((c) => c.id === ob.courtId).name}</dd><dt>Giờ</dt><dd className="mono">{slotRange(ob.slots)}</dd><dt>Tổng tiền</dt><dd className="mono">{vnd(q.total)}</dd><dt>Tiền cọc</dt><dd className="mono">{vnd(q.deposit)}</dd><dt>Thu tại sân</dt><dd className="mono">{vnd(q.remaining)}</dd></dl>
            {ob.status === "DEPOSITED" && !started && <p className="small muted" style={{ marginTop: 16 }}>Chỉ xác nhận hoàn tất được khi đã đến giờ chơi.</p>}
          </Modal>
        );
      })()}
    </>
  );
}


