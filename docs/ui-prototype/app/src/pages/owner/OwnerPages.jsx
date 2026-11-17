import { Fragment, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useStore, occupancy, bookingQuote, userName } from "../../data/store";
import { AMENITIES, CITIES, SPORTS, sportName, PHOTOS } from "../../data/mock";
import { addDays, dateKey, hourOf, hoursBetween, longDay, parseKey, slotRange, vnd } from "../../lib/format";
import { multiplierFor, playStarted } from "../../lib/pricing";
import { SlotGrid, SlotLegend } from "../../components/SlotGrid";
import { Empty, Icon, Modal, Select, StatusBadge, Switch, Tip, useToast } from "../../components/ui";

const useMine = () => {
  const { state, me } = useStore();
  return state.facilities.filter((f) => f.ownerId === me.id);
};

function FacilityPicker({ value, onChange }) {
  const mine = useMine();
  return (
    <Select className="select" style={{ width: 280 }} value={value} onChange={(e) => onChange(e.target.value)} aria-label="Cơ sở">
      {mine.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
    </Select>
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
        <div><h1>Cơ sở của tôi</h1></div>
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
      <div className="ofac-grid stagger">
        {mine.map((f) => {
          // tỉ lệ khung giờ đã có người trong hôm nay, tính trên các sân đang hoạt động
          const occ = occupancy(state, f.id, today);
          const act = f.courts.filter((c) => c.active);
          const total = act.reduce((a, c) => a + hoursBetween(c.open, c.close).length, 0);
          const busy = act.reduce((a, c) => a + Object.values(occ[c.id] || {}).filter((o) => !o.ghost && o.status !== "CANCELLED").length, 0);
          const pct = total ? Math.round((busy / total) * 100) : 0;
          return (
            <article key={f.id} className="card card--flush ofac">
              <Link to={`/chu-san/co-so/${f.id}`} className="zoom ofac__img"><img src={f.photos[0]} alt="" /></Link>
              <div className="ofac__body">
                <div className="small muted">{f.sports.map(sportName).join(" · ")} · {f.district}</div>
                <h3>{f.name}</h3>
                <div className="small ink2">{act.length}/{f.courts.length} sân hoạt động · <span className="mono">{f.open}–{f.close}</span></div>
                <div className="ofac__occ"><div className="bar"><i style={{ width: pct + "%" }} /></div><span className="small"><span className="mono">{pct}%</span> kín hôm nay</span></div>
                <div className="row" style={{ "--gap": "8px" }}>
                  <Link className="btn btn--sm btn--primary" to={`/chu-san/lich-dat?co-so=${f.id}`}>Lịch hôm nay</Link>
                  <Link className="btn btn--sm" to={`/chu-san/co-so/${f.id}`}><Icon name="edit" size={14} />Sửa</Link>
                </div>
              </div>
            </article>
          );
        })}
        <Link to="/chu-san/co-so/moi" className="ofac ofac--add"><Icon name="plus" size={22} />Thêm cơ sở</Link>
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
  const [tab, setTab] = useState("info");
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const save = (e) => {
    e.preventDefault();
    const er = {};
    if (!f.name.trim()) er.name = "Nhập tên cơ sở.";
    if (!f.street.trim()) er.street = "Nhập tên đường.";
    if (!f.district) er.district = "Chọn quận, huyện.";
    if (f.open >= f.close) er.close = "Giờ đóng cửa phải sau giờ mở cửa.";
    setErr(er);
    if (Object.keys(er).length) return setTab("info");
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

  const nLocks = f.courts.reduce((n, c) => n + Object.keys(c.locks || {}).length, 0);
  const TABS = [["info", "Thông tin"], ["courts", `Sân con`, f.courts.length], ["locks", "Khóa giờ", nLocks]];
  return (
    <form className="fill-form" onSubmit={save} noValidate>
      <div className="page-head">
        <div><h1>{isNew ? "Thêm cơ sở" : f.name}</h1></div>
        <div className="row">{!isNew && <Link className="btn" to={`/san/${f.id}`}>Xem như khách</Link>}<button className="btn btn--primary">{isNew ? "Tạo cơ sở" : "Lưu thay đổi"}</button></div>
      </div>
      <div className="seg seg--scroll fedit__tabs" role="tablist">
        {TABS.map(([k, l, n]) => (
          <button type="button" key={k} role="tab" aria-selected={tab === k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>
            {l}{n ? <span className="muted mono"> {n}</span> : null}{k === "info" && Object.keys(err).length ? <span className="dot-err" aria-label="Có lỗi" /> : null}
          </button>
        ))}
      </div>

      {tab === "info" && (
        <div className="fedit__info">
          <section className="card">
            <div className="form-grid">
              <div className="field full"><label htmlFor="fn">Tên cơ sở</label><input id="fn" className="input" value={f.name} onChange={set("name")} aria-invalid={!!err.name} />{err.name && <span className="field__err">{err.name}</span>}</div>
              <div className="field"><label htmlFor="fs">Đường</label><input id="fs" className="input" value={f.street} onChange={set("street")} aria-invalid={!!err.street} placeholder="Cộng Hòa" />{err.street && <span className="field__err">{err.street}</span>}</div>
              <div className="field"><label htmlFor="fc">Thành phố</label><Select id="fc" className="select" value={f.city} onChange={(e) => setF({ ...f, city: e.target.value, district: "" })}>{Object.keys(CITIES).map((c) => <option key={c}>{c}</option>)}</Select></div>
              <div className="field"><label htmlFor="fd">Quận, huyện</label><Select id="fd" className="select" value={f.district} onChange={set("district")} aria-invalid={!!err.district}><option value="">Chọn</option>{CITIES[f.city].map((d) => <option key={d}>{d}</option>)}</Select>{err.district && <span className="field__err">{err.district}</span>}</div>
              <div className="field"><span className="label">Vị trí trên bản đồ</span><div className="input row" style={{ alignItems: "center", color: "var(--ink-2)" }}><Icon name="pin" size={16} />Ghim theo địa chỉ khi lưu</div></div>
              <div className="field full"><label htmlFor="fde">Mô tả</label><textarea id="fde" className="textarea" value={f.description} onChange={set("description")} placeholder="Số sân, mặt sân, chỗ để xe..." /></div>
            </div>
          </section>
          <section className="card fedit__aside">
            <div>
              <h3>Giờ mở cửa</h3>
              <div className="grid-2" style={{ gap: 12, marginTop: 12 }}>
                <div className="field"><label htmlFor="op">Mở</label><Select id="op" className="select mono" value={f.open} onChange={set("open")}>{HOURS.map((h) => <option key={h}>{h}</option>)}</Select></div>
                <div className="field"><label htmlFor="cl">Đóng</label><Select id="cl" className="select mono" value={f.close} onChange={set("close")} aria-invalid={!!err.close}>{HOURS.map((h) => <option key={h}>{h}</option>)}</Select></div>
              </div>
              {err.close && <p className="field__err" style={{ marginTop: 8 }}>{err.close}</p>}
            </div>
            <div>
              <h3>Tiện ích</h3>
              <div className="chips" style={{ marginTop: 12 }}>{AMENITIES.map((a) => <button type="button" key={a} className={"chip" + (f.amenities.includes(a) ? " on" : "")} aria-pressed={f.amenities.includes(a)} onClick={() => setF({ ...f, amenities: f.amenities.includes(a) ? f.amenities.filter((x) => x !== a) : [...f.amenities, a] })}>{a}</button>)}</div>
            </div>
            <div>
              <h3>Ảnh</h3>
              <div className="fedit__photos">{f.photos.map((p, i) => <img key={i} src={p} alt="" />)}<button type="button" className="fedit__add" aria-label="Thêm ảnh"><Icon name="plus" /></button></div>
            </div>
          </section>
        </div>
      )}

      {tab === "courts" && (
        <section className="card fedit__panel">
          <div className="card__head"><div><h2>Sân con</h2></div><button type="button" className="btn btn--sm" onClick={() => setCourtEdit({ id: "", name: `Sân ${f.courts.length + 1}`, sport: "badminton", type: "Thảm PVC", indoor: true, open: f.open, close: f.close, price: 100000, active: true })}><Icon name="plus" size={15} />Thêm sân con</button></div>
          {f.courts.length === 0 ? <Empty title="Chưa có sân con">Thêm ít nhất một sân để khách đặt được.</Empty> : (
            <div className="table-wrap flat"><table className="table">
              <thead><tr><th>Sân</th><th>Môn</th><th>Loại</th><th>Giờ</th><th className="r">Giá cơ sở</th><th>Khóa giờ</th><th>Hoạt động</th><th /></tr></thead>
              <tbody>{f.courts.map((c) => (
                <tr key={c.id}>
                  <td style={{ fontWeight: 500 }}>{c.name}</td><td>{sportName(c.sport)}</td><td className="ink2">{c.type} · {c.indoor ? "Trong nhà" : "Ngoài trời"}</td>
                  <td className="mono">{c.open}–{c.close}</td><td className="r num">{vnd(c.price)}</td>
                  <td className="ink2">{Object.keys(c.locks || {}).length ? <button type="button" className="link" onClick={() => setTab("locks")}>{Object.keys(c.locks).length} khung</button> : "Không"}</td>
                  <td><Switch label={`Bật tắt ${c.name}`} checked={c.active} onChange={(v) => setF({ ...f, courts: f.courts.map((x) => (x.id === c.id ? { ...x, active: v } : x)) })} /></td>
                  <td className="r"><button type="button" className="icon-btn" onClick={() => setCourtEdit(c)} aria-label={`Sửa ${c.name}`}><Icon name="edit" size={16} /></button></td>
                </tr>))}</tbody>
            </table></div>
          )}
        </section>
      )}

      {tab === "locks" && (
        <section className="card fedit__panel">
          {f.courts.length === 0 ? <Empty title="Chưa có sân con">Thêm sân con trước khi khóa giờ.</Empty>
            : <LockBoard f={f} onChange={(courtId, locks) => setF({ ...f, courts: f.courts.map((c) => (c.id === courtId ? { ...c, locks } : c)) })} />}
        </section>
      )}
      {courtEdit && <CourtModal court={courtEdit} facility={f} onClose={() => setCourtEdit(null)} onSave={saveCourt} />}
    </form>
  );
}

const LOCK_REASONS = ["Bảo trì", "Giữ cho lớp học", "Giải đấu"];
const CELL = { DEPOSITED: ["slot--deposited", "Đã cọc"], PENDING_DEPOSIT: ["slot--held", "Chờ cọc"], COMPLETED: ["slot--completed", "Hoàn tất"] };
// Mỗi sân con một dải ô giờ; ô hiện trạng thái của ngày đang xem (khóa, đã cọc, chờ cọc, mở).
// Khóa áp dụng mọi ngày và bị chặn nếu khung giờ còn đơn chưa chơi (không tự hủy đơn của khách).
function LockBoard({ f, onChange }) {
  const { state } = useStore();
  const [date, setDate] = useState(dateKey(new Date()));
  const [pop, setPop] = useState(null);
  const [other, setOther] = useState("");
  const wrap = useRef(null);
  const saved = state.facilities.some((x) => x.id === f.id);
  const occ = useMemo(() => (saved ? occupancy(state, f.id, date) : {}), [state, saved, f.id, date]);
  const hours = hoursBetween(f.open, f.close);
  const pending = (courtId, h) => state.bookings.filter((b) => b.courtId === courtId && b.slots.includes(h) && ["DEPOSITED", "PENDING_DEPOSIT"].includes(b.status) && !playStarted(b.date, h));
  const cell = (c, h) => {
    if (hourOf(h) < hourOf(c.open) || hourOf(h) >= hourOf(c.close)) return { k: "out", cls: " slot--locked slot--off", label: "Đóng" };
    if (c.locks?.[h]) return { k: "lock", cls: " slot--locked", label: "Khóa", sub: c.locks[h] };
    const o = occ[c.id]?.[h];
    if (o && !o.ghost && CELL[o.status]) return { k: "busy", cls: " " + CELL[o.status][0], label: CELL[o.status][1], sub: o.name };
    return { k: "free", cls: "", label: "Mở" };
  };
  const show = (e, c, h) => {
    const r = e.currentTarget.getBoundingClientRect(), w = wrap.current.getBoundingClientRect();
    const up = r.top - w.top > w.height / 2;
    const x = Math.min(Math.max(r.left - w.left + r.width / 2, 150), w.width - 150);
    setOther("");
    setPop((p) => (p?.c === c.id && p.h === h ? null : { c: c.id, h, x, y: up ? r.top - w.top - 8 : r.bottom - w.top + 8, up }));
  };
  const lock = (c, h, reason) => { onChange(c.id, { ...c.locks, [h]: reason }); setPop(null); };
  const unlock = (c, h) => { const { [h]: _, ...rest } = c.locks; onChange(c.id, rest); setPop(null); };
  const shift = (n) => { setPop(null); setDate(dateKey(addDays(parseKey(date), n))); };
  const pc = pop && f.courts.find((x) => x.id === pop.c);
  const pcell = pc && cell(pc, pop.h);
  const pbs = pc && pending(pc.id, pop.h);
  return (
    <div className="lkb" ref={wrap}>
      <div className="lkb__top">
        <h2>Khóa giờ<Tip>Khung giờ khóa áp dụng mọi ngày, khách không đặt được. Bấm một ô để khóa hoặc mở lại. Nhớ bấm Lưu thay đổi.</Tip></h2>
        <span className="seg sched__day">
          <button type="button" onClick={() => shift(-1)} aria-label="Ngày trước"><Icon name="chevL" size={16} /></button>
          <button type="button" className="on" onClick={() => { setPop(null); setDate(dateKey(new Date())); }} title="Về hôm nay">{longDay(date)}</button>
          <button type="button" onClick={() => shift(1)} aria-label="Ngày sau"><Icon name="chevR" size={16} /></button>
        </span>
      </div>
      <div className="slots-scroll lkb__scroll" onScroll={() => pop && setPop(null)}><div className="grid-slots lockb" style={{ "--cols": hours.length }}>
        <span />{hours.map((h) => <span key={h} className="gs-h">{h}</span>)}
        {f.courts.map((c) => (<Fragment key={c.id}>
          <span className="gs-c">{c.name}<small>{Object.keys(c.locks || {}).length ? `${Object.keys(c.locks).length} khung khóa` : sportName(c.sport)}</small></span>
          {hours.map((h) => {
            const x = cell(c, h);
            const on = pop?.c === c.id && pop.h === h;
            return (
              <button type="button" key={c.id + h} className={"slot" + x.cls + (on ? " slot--focus" : "")} disabled={x.k === "out"} aria-expanded={on} onClick={(e) => show(e, c, h)} aria-label={`${c.name} ${h}: ${x.label}${x.sub ? ", " + x.sub : ""}`}>
                {x.label}{x.sub && <small>{x.sub}</small>}
              </button>
            );
          })}
        </Fragment>))}
      </div></div>
      <div className="legend">
        <span><i className="lg-free" />Mở</span><span><i className="lg-lock" />Khóa</span><span><i className="lg-dep" />Đã cọc</span><span><i className="lg-held" />Chờ cọc</span>
      </div>
      {pop && (
        <div className={"lk__pop" + (pop.up ? " up" : "")} style={{ left: pop.x, top: pop.y }} role="dialog" aria-label={`${pc.name} ${pop.h}`} onKeyDown={(e) => e.key === "Escape" && setPop(null)}>
          <div className="lk__head"><b>{pc.name} · <span className="mono">{pop.h}</span></b><button type="button" className="icon-btn" onClick={() => setPop(null)} aria-label="Đóng"><Icon name="x" size={15} /></button></div>
          {pcell.k === "lock" ? (<>
            <p className="small ink2">Đang khóa mọi ngày: {pcell.sub}.</p>
            <button type="button" className="btn btn--sm btn--block" onClick={() => unlock(pc, pop.h)}>Mở khóa khung này</button>
          </>) : pbs.length || pcell.k === "busy" ? (
            <p className="small ink2"><Icon name="alert" size={15} style={{ verticalAlign: -3, color: "var(--warn)", marginRight: 4 }} />
              Chưa khóa được: {pbs.length ? <>còn {pbs.length} đơn chưa chơi ({pbs.map((b) => <span key={b.id} className="mono">{b.id} </span>)}).</> : <>{pcell.sub} đã đặt khung này hôm đó.</>}{" "}
              <Link className="link" to={`/chu-san/lich-dat?co-so=${f.id}`}>Mở lịch đặt</Link>
            </p>
          ) : (<>
            <p className="small muted">Khóa mọi ngày, chọn lý do:</p>
            <div className="chips">{LOCK_REASONS.map((x) => <button type="button" key={x} className="chip" onClick={() => lock(pc, pop.h, x)}>{x}</button>)}</div>
            <div className="row" style={{ "--gap": "8px" }}>
              <input className="input" style={{ height: 36, flex: 1 }} placeholder="Lý do khác" value={other} autoFocus onChange={(e) => setOther(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); other.trim() && lock(pc, pop.h, other.trim()); } }} />
              <button type="button" className="btn btn--sm btn--primary" disabled={!other.trim()} onClick={() => lock(pc, pop.h, other.trim())}>Khóa</button>
            </div>
          </>)}
        </div>
      )}
    </div>
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
        <div className="field"><label htmlFor="cs">Môn</label><Select id="cs" className="select" value={c.sport} onChange={set("sport")}>{SPORTS.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></div>
        <div className="field"><label htmlFor="ct">Mặt sân</label><input id="ct" className="input" value={c.type} onChange={set("type")} /></div>
        <div className="field"><span className="label">Vị trí</span><div className="seg">{[[true, "Trong nhà"], [false, "Ngoài trời"]].map(([v, l]) => <button type="button" key={l} className={c.indoor === v ? "on" : ""} onClick={() => setC({ ...c, indoor: v })}>{l}</button>)}</div></div>
        <div className="field"><label htmlFor="co">Mở</label><Select id="co" className="select" value={c.open} onChange={set("open")}>{fh.map((h) => <option key={h}>{h}</option>)}</Select></div>
        <div className="field"><label htmlFor="cc">Đóng</label><Select id="cc" className="select" value={c.close} onChange={set("close")}>{fh.map((h) => <option key={h}>{h}</option>)}</Select></div>
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
        <div><h1>Bảng giá và hệ số</h1></div>
        <div className="row"><FacilityPicker value={fid} onChange={pick} /><button className="btn btn--primary" onClick={save}>Lưu bảng giá</button></div>
      </div>
      {err && <div className="notice notice--danger" style={{ marginBottom: 16, flex: "none" }}><Icon name="alert" />{err}</div>}
      <section className="card price-base">
        <h2>Giá cơ sở mỗi giờ</h2>
        <div className="price-tiles">
          {f.courts.map((c) => (
            <label key={c.id} className="ptile">
              <span className="ptile__name">{c.name}</span>
              <span className="small muted">{sportName(c.sport)}{c.active ? "" : " · tạm ngưng"}</span>
              <input className="input mono" inputMode="numeric" aria-label={`Giá ${c.name}`} value={(prices[c.id] ?? 0).toLocaleString("vi-VN")} onChange={(e) => setPrices({ ...prices, [c.id]: Number(e.target.value.replace(/\D/g, "")) })} />
            </label>
          ))}
        </div>
      </section>
      <div className="price-split">
        <section className="card">
          <div className="card__head"><div><h2>Quy tắc hệ số<Tip>Mỗi quy tắc một hệ số từ 1,2 đến 1,5. Trùng nhiều quy tắc thì lấy hệ số cao nhất.</Tip></h2></div><button className="btn btn--sm" onClick={() => setRules([...rules, { id: "r" + Date.now(), type: "PEAK", label: "Giờ cao điểm", from: "17:00", to: "20:00", multiplier: 1.3 }])}><Icon name="plus" size={15} />Thêm quy tắc</button></div>
          {rules.length === 0 ? <p className="muted">Chưa có quy tắc: mọi giờ tính giá cơ sở.</p> : (
            <ul className="rules">
              {rules.map((r, i) => (
                <li key={r.id} className="rule">
                  <Select className="select select--sm" value={r.type} onChange={(e) => upd(i, "type", e.target.value)} aria-label="Loại quy tắc">{Object.entries(RULE_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select>
                  <div className="rule__when">
                    {r.type === "PEAK" && <><Select className="select select--sm mono" style={{ width: 92 }} value={r.from} onChange={(e) => upd(i, "from", e.target.value)} aria-label="Từ giờ">{HOURS.map((h) => <option key={h}>{h}</option>)}</Select>–<Select className="select select--sm mono" style={{ width: 92 }} value={r.to} onChange={(e) => upd(i, "to", e.target.value)} aria-label="Đến giờ">{HOURS.map((h) => <option key={h}>{h}</option>)}</Select></>}
                    {r.type === "WEEKEND" && "Thứ Bảy và Chủ nhật"}
                    {r.type === "HOLIDAY" && `${state.holidays.length} ngày lễ trong danh mục`}
                  </div>
                  <span className="mstep" role="group" aria-label="Hệ số">
                    <button type="button" disabled={r.multiplier <= 1.2} onClick={() => upd(i, "multiplier", Math.round((r.multiplier - 0.05) * 100) / 100)} aria-label="Giảm hệ số">−</button>
                    <output className="mono">×{r.multiplier.toFixed(2).replace(".", ",")}<small>+{Math.round((r.multiplier - 1) * 100)}%</small></output>
                    <button type="button" disabled={r.multiplier >= 1.5} onClick={() => upd(i, "multiplier", Math.round((r.multiplier + 0.05) * 100) / 100)} aria-label="Tăng hệ số">+</button>
                  </span>
                  <button className="icon-btn" onClick={() => setRules(rules.filter((_, j) => j !== i))} aria-label="Xóa quy tắc"><Icon name="trash" size={16} /></button>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="card">
          <h2 style={{ marginBottom: 10 }}>Hệ số 7 ngày tới</h2>
          <div className="heat">
            <span />{week.map((d) => <span key={d} className="heat__h">{["CN", "T2", "T3", "T4", "T5", "T6", "T7"][parseKey(d).getDay()]}</span>)}
            {hours.map((h) => (
              <Row key={h} h={h} week={week} rules={rules} holidays={state.holidays.map((x) => x.date)} />
            ))}
          </div>
          <div className="row between price-foot">
            <div className="legend" style={{ marginTop: 0 }}><span><i style={{ background: "var(--surface-3)" }} />× 1,0</span><span><i style={{ background: "rgba(31,107,58,.55)" }} />× 1,2</span><span><i style={{ background: "var(--accent)" }} />× 1,5</span></div>
            <span className="small ink2">{f.courts[0]?.name}, 19:00 thứ Bảy: <span className="mono">{vnd(Math.round((prices[f.courts[0]?.id] ?? 0) * Math.max(1, ...rules.filter((r) => r.type === "WEEKEND" || (r.type === "PEAK" && r.from <= "19:00" && r.to > "19:00")).map((r) => r.multiplier))))}</span></span>
          </div>
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
      <div className="page-head"><div><h1>Dịch vụ đi kèm</h1></div><FacilityPicker value={fid} onChange={setFid} /></div>
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
  const [params] = useSearchParams();
  const [fid, setFid] = useState(() => (mine.some((x) => x.id === params.get("co-so")) ? params.get("co-so") : mine[0]?.id));
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
      <div className="page-head"><div><h1>Lịch đặt theo ngày</h1></div>
        <div className="row">
          <FacilityPicker value={fid} onChange={setFid} />
          <span className="seg sched__day">
            <button onClick={() => shift(-1)} aria-label="Ngày trước"><Icon name="chevL" size={16} /></button>
            <button className="on" onClick={() => setDate(dateKey(new Date()))} title="Về hôm nay">{longDay(date)}</button>
            <button onClick={() => shift(1)} aria-label="Ngày sau"><Icon name="chevR" size={16} /></button>
          </span>
        </div>
      </div>
      <div className="chips" style={{ marginBottom: 14, flex: "none" }}>
        {[["ALL", "Tất cả"], ["FREE", "Trống"], ["PENDING_DEPOSIT", "Chờ cọc"], ["DEPOSITED", "Đã cọc"], ["CANCELLED", "Đã hủy"], ["LOCKED", "Khóa"]].map(([k, l]) => (
          <button key={k} className={"chip" + (filter === k ? " on" : "")} onClick={() => setFilter(k)}>{l}{k !== "ALL" && k !== "FREE" && counts[k] ? <span className="muted">{counts[k]}</span> : null}</button>
        ))}
      </div>
      <div className="sched">
        <div className="sched__left">
          <section className="card sched__board">
            <div className="sched__grid"><SlotGrid facility={f} date={date} occ={occ} mode="owner" statusFilter={filter} onOpen={setOpen} /></div>
            <SlotLegend owner />
          </section>
          {(() => {
            // tổng kết ngày từ đơn thật: tiền dự kiến, cọc đã nhận, phần thu tại sân, độ kín
            const live = rows.filter((b) => b.status !== "CANCELLED").map((b) => bookingQuote(state, b));
            const act = f.courts.filter((c) => c.active);
            const total = act.reduce((a, c) => a + hoursBetween(c.open, c.close).length, 0);
            const busy = act.reduce((a, c) => a + Object.values(occ[c.id] || {}).filter((o) => !o.ghost && o.status !== "LOCKED").length, 0);
            return (
              <div className="sched__sum">
                {[["Tiền sân dự kiến", vnd(live.reduce((a, q) => a + q.total, 0))], ["Cọc đã giữ", vnd(live.reduce((a, q) => a + q.deposit, 0))], ["Thu tại sân", vnd(live.reduce((a, q) => a + q.remaining, 0))], ["Độ kín", `${total ? Math.round((busy / total) * 100) : 0}%`]].map(([l, v]) => (
                  <div key={l}><span className="small muted">{l}</span><b className="mono">{v}</b></div>
                ))}
              </div>
            );
          })()}
        </div>
        <aside className="card sched__side">
          <h3>Đơn trong ngày <span className="muted mono small">{rows.length}</span></h3>
          {rows.length === 0 ? <Empty title="Chưa có đơn" /> : (
            <ul className="sched__list">{rows.map((b) => {
              const q = bookingQuote(state, b);
              const done = b.status === "DEPOSITED" && playStarted(b.date, b.slots[0]);
              return (
                <li key={b.id}>
                  <button className="sched__item" onClick={() => setOpen(b.id)}>
                    <span className="row between"><span className="mono">{slotRange(b.slots)}</span><StatusBadge status={b.status} /></span>
                    <span className="small muted">{userName(state, b.userId)} · {f.courts.find((c) => c.id === b.courtId).name} · cọc <span className="mono">{vnd(q.deposit)}</span></span>
                  </button>
                  {done && <button className="sched__done" onClick={() => { api.completeBooking(b.id); toast(`Đã kết toán ${vnd(q.deposit)} vào ví`); }}><Icon name="check" size={14} />Xác nhận hoàn tất</button>}
                </li>
              );
            })}</ul>
          )}
        </aside>
      </div>
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
            {ob.status === "DEPOSITED" && !started && <p className="small muted" style={{ marginTop: 16 }}>Xác nhận được khi đến giờ chơi.</p>}
          </Modal>
        );
      })()}
    </>
  );
}


