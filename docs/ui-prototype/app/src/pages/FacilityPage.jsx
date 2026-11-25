import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useStore, occupancy } from "../data/store";
import { sportName } from "../data/mock";
import { dateKey, slotRange, vnd, shortDay } from "../lib/format";
import { quote } from "../lib/pricing";
import { DayStrip, SlotGrid, SlotLegend } from "../components/SlotGrid";
import { Count, Icon, Rating } from "../components/ui";
import { BookingDrawer } from "./BookingPages";
import { Skel, useLoading } from "../components/charts";
import NotFoundPage from "./NotFoundPage";

export default function FacilityPage() {
  const { id } = useParams();
  const { state, me } = useStore();
  const nav = useNavigate();
  const f = state.facilities.find((x) => x.id === id);
  const [date, setDate] = useState(dateKey(new Date()));
  const loading = useLoading();
  const [sel, setSel] = useState({ courtId: null, slots: [] });
  const [tab, setTab] = useState("lich");
  const [draft, setDraft] = useState(null);
  const occ = useMemo(() => (f ? occupancy(state, f.id, date) : {}), [state, f, date]);
  if (!f) return <NotFoundPage />;

  const court = f.courts.find((c) => c.id === sel.courtId);
  const q = court && sel.slots.length ? quote({ facility: f, court, date, slots: sel.slots, holidays: state.holidays.map((h) => h.date) }) : null;
  const reviews = state.reviews[f.id] || [];

  const toggle = (courtId, slot) => setSel((s) => {
    if (s.courtId !== courtId) return { courtId, slots: [slot] };
    return { courtId, slots: s.slots.includes(slot) ? s.slots.filter((x) => x !== slot) : [...s.slots, slot] };
  });
  const changeDate = (d) => { setDate(d); setSel({ courtId: null, slots: [] }); };
  const go = () => {
    const draft = { facilityId: f.id, courtId: sel.courtId, date, slots: [...sel.slots].sort() };
    sessionStorage.setItem("sanchung-draft", JSON.stringify(draft));
    // đã đăng nhập: mở ngăn đặt sân ngay trên trang; chưa: đăng nhập rồi về trang xác nhận
    if (me) setDraft(draft); else nav("/dang-nhap?next=/dat-san");
  };

  const TABS = [["lich", "Lịch trống"], ["info", "Sân và giá"], ...(f.services.some((x) => x.active) ? [["dv", "Dịch vụ"]] : []), ["dg", `Đánh giá (${reviews.length})`]];
  return (
    <main className="page">
      <div className="wrap">
        <header className="fhead">
          <div className="fhead__text">
            <div className="small muted"><Link className="link" to="/tim-san">Tìm sân</Link> · {f.district} · {f.sports.map(sportName).join(", ")}</div>
            <h1>{f.name}</h1>
            <div className="row small ink2" style={{ "--gap": "14px" }}>
              <span className="row" style={{ "--gap": "5px" }}><Icon name="pin" size={15} />{f.street}, {f.district}</span>
              <span className="row" style={{ "--gap": "5px" }}><Icon name="clock" size={15} /><span className="mono">{f.open}–{f.close}</span></span>
              <Rating value={f.rating} count={f.reviews} />
            </div>
          </div>
          <div className="fhead__photos">{[0, 1, 2].map((i) => <div key={i}><img src={f.photos[i % f.photos.length]} alt={i === 0 ? `Sân của ${f.name}` : ""} /></div>)}</div>
        </header>

        <div className="seg seg--scroll ftabs" role="tablist" aria-label="Thông tin cơ sở">
          {TABS.map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>{l}</button>)}
        </div>

        <div className="fbody" key={tab}>
          {tab === "lich" && (
            <section className="card fboard" aria-label="Lịch trống theo ngày">
              <div className="fboard__top"><DayStrip value={date} onChange={changeDate} /><SlotLegend /></div>
              <div className="fboard__grid">
                {loading ? <div className="stack" style={{ "--gap": "8px" }} aria-hidden="true">{[0, 1, 2, 3].map((i) => <Skel key={i} h={52} r={12} />)}</div>
                  : <SlotGrid facility={f} date={date} occ={occ} selected={sel} onToggle={toggle} />}
              </div>
            </section>
          )}
          {tab === "info" && (
            <section className="scroll stack" style={{ "--gap": "18px" }}>
              <p className="ink2" style={{ maxWidth: "64ch" }}>{f.description}</p>
              <div className="chips">{f.amenities.map((a) => <span key={a} className="chip chip--static">{a}</span>)}</div>
              <div className="table-wrap">
                <table className="table">
                  <thead><tr><th>Sân</th><th>Môn</th><th>Mặt sân</th><th>Giờ</th><th className="r">Giá mỗi giờ</th></tr></thead>
                  <tbody>{f.courts.map((c) => (
                    <tr key={c.id} style={c.active ? null : { opacity: .5 }}>
                      <td>{c.name}{!c.active && <span className="badge badge--cancelled" style={{ marginLeft: 8 }}>Tạm ngưng</span>}</td>
                      <td>{sportName(c.sport)}</td><td>{c.type} · {c.indoor ? "Trong nhà" : "Ngoài trời"}</td><td className="mono">{c.open}–{c.close}</td><td className="r num">{vnd(c.price)}</td>
                    </tr>))}</tbody>
                </table>
              </div>
              {f.rules.length > 0 && <div className="chips">{f.rules.map((r) => <span key={r.id} className="chip chip--static">{r.label}{r.from ? ` ${r.from}–${r.to}` : ""} × {String(r.multiplier).replace(".", ",")}</span>)}</div>}
            </section>
          )}
          {tab === "dv" && (
            <section className="grid-3 stagger" style={{ alignContent: "start" }}>
              {f.services.filter((x) => x.active).map((x) => (
                <div key={x.id} className="card card--tight"><div style={{ fontWeight: 500 }}>{x.name}</div><div className="muted small mono">{vnd(x.price)} / {x.unit}</div></div>
              ))}
            </section>
          )}
          {tab === "dg" && (
            <section className="scroll reviews">
              {reviews.length === 0 && <p className="muted">Chưa có đánh giá.</p>}
              {reviews.map((r, i) => (
                <div className="review" key={i}>
                  <div className="row between"><div className="row"><span className="avatar">{r.by.split(" ").pop()[0]}</span><div><div style={{ fontWeight: 500 }}>{r.by}</div><div className="small muted">{shortDay(r.at)}</div></div></div>
                    <span className="stars">{Array.from({ length: 5 }, (_, k) => <Icon key={k} name="star" size={14} fill style={{ opacity: k < r.stars ? 1 : .2 }} />)}</span></div>
                  <p className="ink2" style={{ marginTop: 10 }}>{r.text}</p>
                </div>
              ))}
            </section>
          )}
        </div>

        <div className={"fbar" + (q ? " is-on" : "")} role="region" aria-label="Tóm tắt đặt sân">
          {q ? (
            <div className="fbar__text">
              <span className="small ink2">{court.name} · {shortDay(date)} · <span className="mono">{sel.slots.length === 1 || isRun(sel.slots) ? slotRange(sel.slots) : [...sel.slots].sort().join(", ")}</span></span>
              <span><b className="mono"><Count value={q.total} /></b><span className="small muted"> · cọc <span className="mono"><Count value={q.deposit} /></span></span></span>
            </div>
          ) : (
            <div className="fbar__text"><span className="small muted">Chọn ô trống trên cùng một sân</span><span>Giá từ <b className="mono">{vnd(Math.min(...f.courts.filter((c) => c.active).map((c) => c.price)))}</b><span className="small muted">/giờ</span></span></div>
          )}
          <button className="btn btn--primary btn--lg" disabled={!q} onClick={go}>Đặt sân<Icon name="arrowR" size={16} /></button>
        </div>
      </div>
      {draft && <BookingDrawer draft={draft} onClose={() => { setDraft(null); setSel({ courtId: null, slots: [] }); }} />}
    </main>
  );
}

const isRun = (slots) => { const h = slots.map((s) => +s.slice(0, 2)).sort((a, b) => a - b); return h.every((x, i) => !i || x === h[i - 1] + 1); };
