import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useStore, occupancy } from "../data/store";
import { sportName } from "../data/mock";
import { dateKey, longDay, slotRange, vnd, shortDay } from "../lib/format";
import { quote } from "../lib/pricing";
import { DayStrip, SlotGrid, SlotLegend } from "../components/SlotGrid";
import { Count, Icon, Rating } from "../components/ui";
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
    nav(me ? "/dat-san" : "/dang-nhap?next=/dat-san");
  };

  return (
    <main className="page">
      <div className="wrap">
        <nav className="crumbs" aria-label="Vị trí"><Link to="/tim-san">Tìm sân</Link><span>/</span><span>{f.district}</span><span>/</span><span className="ink2">{f.name}</span></nav>
        <div className="split">
          <div className="stack scroll" style={{ "--gap": "32px" }}>
          <div className="gallery">
            {f.photos.slice(0, 3).map((p, i) => <div key={i}><img src={p} alt={i === 0 ? `Sân của ${f.name}` : ""} /></div>)}
            {f.photos.length < 3 && <div><img src={f.photos[0]} alt="" style={{ filter: "grayscale(.4)" }} /></div>}
          </div>
            <section>
              <div className="chips" style={{ marginBottom: 14 }}>{f.sports.map((s) => <span key={s} className="tag">{sportName(s)}</span>)}</div>
              <h1>{f.name}</h1>
              <div className="row ink2" style={{ marginTop: 12, "--gap": "18px" }}>
                <span className="row" style={{ "--gap": "6px" }}><Icon name="pin" size={16} />{f.street}, {f.district}, {f.city}</span>
                <span className="row" style={{ "--gap": "6px" }}><Icon name="clock" size={16} />{f.open}–{f.close}</span>
                <Rating value={f.rating} count={f.reviews} />
              </div>
              <p className="ink2" style={{ marginTop: 18, maxWidth: "64ch" }}>{f.description}</p>
              <div className="chips" style={{ marginTop: 18 }}>{f.amenities.map((a) => <span key={a} className="chip chip--static">{a}</span>)}</div>
            </section>

            <section className="card" aria-labelledby="lich-h">
              <div className="card__head">
                <div><h2 id="lich-h">Lịch trống theo ngày</h2><p>Bấm ô trống trên cùng một sân.</p></div>
              </div>
              <DayStrip value={date} onChange={changeDate} />
              <div style={{ marginTop: 20 }}>
                {loading ? <div className="stack" style={{ "--gap": "8px" }} aria-hidden="true">{[0, 1, 2, 3].map((i) => <Skel key={i} h={52} r={12} />)}</div>
                  : <SlotGrid facility={f} date={date} occ={occ} selected={sel} onToggle={toggle} />}
              </div>
              <SlotLegend />
            </section>

            <section aria-labelledby="san-con-h">
              <h2 id="san-con-h" style={{ marginBottom: 16 }}>Sân con và giá cơ sở</h2>
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
              {f.rules.length > 0 && (
                <div className="chips" style={{ marginTop: 14 }}>
                  {f.rules.map((r) => <span key={r.id} className="chip chip--static">{r.label}{r.from ? ` ${r.from}–${r.to}` : ""} × {String(r.multiplier).replace(".", ",")}</span>)}
                </div>
              )}
            </section>

            {f.services.some((s) => s.active) && (
              <section aria-labelledby="dv-h">
                <h2 id="dv-h" style={{ marginBottom: 16 }}>Dịch vụ đi kèm</h2>
                <div className="grid-3 stagger">
                  {f.services.filter((s) => s.active).map((s) => (
                    <div key={s.id} className="card card--tight"><div style={{ fontWeight: 500 }}>{s.name}</div><div className="muted small">{vnd(s.price)} / {s.unit}</div></div>
                  ))}
                </div>
              </section>
            )}

            <section aria-labelledby="dg-h">
              <div className="row between" style={{ marginBottom: 8 }}>
                <h2 id="dg-h">Đánh giá</h2><Rating value={f.rating} count={f.reviews} />
              </div>
              {reviews.length === 0 && <p className="muted">Chưa có đánh giá.</p>}
              {reviews.map((r, i) => (
                <div className="review" key={i}>
                  <div className="row between"><div className="row"><span className="avatar">{r.by.split(" ").pop()[0]}</span><div><div style={{ fontWeight: 500 }}>{r.by}</div><div className="small muted">{shortDay(r.at)}</div></div></div>
                    <span className="stars">{Array.from({ length: 5 }, (_, k) => <Icon key={k} name="star" size={14} fill style={{ opacity: k < r.stars ? 1 : .2 }} />)}</span></div>
                  <p className="ink2" style={{ marginTop: 10 }}>{r.text}</p>
                </div>
              ))}
            </section>
          </div>

          <aside className="card sticky" aria-labelledby="dat-h">
            <h2 id="dat-h">Đặt sân</h2>
            <p className="muted small" style={{ marginTop: 4 }}>Giá từ</p>
            <div className="price" style={{ fontSize: 30 }}>{vnd(Math.min(...f.courts.filter((c) => c.active).map((c) => c.price)))}<small> / giờ</small></div>
            <hr className="divider" />
            {!q ? (
              <div className="notice"><Icon name="info" />Chọn giờ trống trong lịch.</div>
            ) : (
              <div className="slide-in">
                <dl className="kv">
                  <dt>Sân</dt><dd>{court.name}</dd>
                  <dt>Ngày</dt><dd>{longDay(date)}</dd>
                  <dt>Giờ</dt><dd className="mono">{sel.slots.length === 1 || isRun(sel.slots) ? slotRange(sel.slots) : [...sel.slots].sort().join(", ")} ({sel.slots.length} giờ)</dd>
                </dl>
                <hr className="divider" />
                {q.lines.map((l) => (
                  <div key={l.slot} className="bill-row slide-in"><span>{l.slot}<small>{l.label}{l.multiplier !== 1 && ` × ${String(l.multiplier).replace(".", ",")}`}</small></span><span className="num">{vnd(l.amount)}</span></div>
                ))}
                <div className="bill-total"><span className="muted">Tạm tính</span><b><Count value={q.total} /></b></div>
                <div className="deposit-box"><span>Cọc 30%</span><b><Count value={q.deposit} /></b></div>
              </div>
            )}
            <button className="btn btn--primary btn--block btn--lg" style={{ marginTop: 18 }} disabled={!q} onClick={go}>Đặt sân<Icon name="arrowR" size={16} /></button>
          </aside>
          {q && (
            <div className="book-bar" role="region" aria-label="Tóm tắt đặt sân">
              <div><small>{court.name} · {sel.slots.length} giờ · cọc <Count value={q.deposit} /></small><b><Count value={q.total} /></b></div>
              <button className="btn btn--primary" onClick={go}>Đặt sân<Icon name="arrowR" size={16} /></button>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

const isRun = (slots) => { const h = slots.map((s) => +s.slice(0, 2)).sort((a, b) => a - b); return h.every((x, i) => !i || x === h[i - 1] + 1); };
