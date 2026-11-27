import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { listMyFacilities, getFacility } from "../../services/facilityService";
import { getHolidays, getPricingRules, savePricingRules } from "../../services/pricingService";
import Icon from "../../components/ui/Icon";

/* ── Constants ─────────────────────────────────────────────────── */
const RULE_TYPES = [
  { value: "PEAK_HOUR", label: "Giờ cao điểm" },
  { value: "WEEKEND",   label: "Cuối tuần" },
  { value: "HOLIDAY",   label: "Ngày lễ" },
];
const MULT_MIN  = 1.20;
const MULT_MAX  = 1.50;
const MULT_STEP = 0.05;
const HOURS_GRID = ["06:00","08:00","10:00","12:00","14:00","16:00","18:00","20:00"];
const WD_SHORT = ["CN","T2","T3","T4","T5","T6","T7"];
const TIME_OPTIONS = Array.from({length:24}, (_,h) => `${String(h).padStart(2,"0")}:00`);

let _key = 0;
const nextKey = () => ++_key;

function emptyRule() {
  return { _key: nextKey(), name:"", rule_type:"PEAK_HOUR",
           multiplier:1.30, start_time:"17:00", end_time:"20:00",
           day_of_week:"", holiday_id:"" };
}

function rulesFromApi(arr) {
  return (arr ?? []).map((r) => ({
    _key: nextKey(),
    name:        r.name,
    rule_type:   r.rule_type,
    multiplier:  r.multiplier,
    start_time:  r.start_time ? r.start_time.slice(0,5) : "17:00",
    end_time:    r.end_time   ? r.end_time.slice(0,5)   : "20:00",
    day_of_week: r.day_of_week != null ? String(r.day_of_week) : "",
    holiday_id:  r.holiday_id  != null ? String(r.holiday_id)  : "",
  }));
}

/* Tính multiplier cho ô (ngày, giờ) dựa vào rules */
function multFor(rules, dayOfWeek, hour, holidayDates) {
  let m = 1;
  for (const r of rules) {
    const mult = Number(r.multiplier);
    if (r.rule_type === "PEAK_HOUR") {
      const h = `${hour}:00`;
      if (r.start_time <= h && h < r.end_time) m = Math.max(m, mult);
    }
    if (r.rule_type === "WEEKEND") {
      if (String(dayOfWeek) === String(r.day_of_week)) m = Math.max(m, mult);
    }
    if (r.rule_type === "HOLIDAY") {
      // simplification: nếu có rule holiday thì áp lên weekend
      if (dayOfWeek === 0 || dayOfWeek === 6) m = Math.max(m, mult);
    }
  }
  return m;
}

/* Format multiplier "×1,30\n+30%" */
function fmtMult(m) {
  return `×${m.toFixed(2).replace(".",",")}`;
}
function fmtPct(m) {
  return `+${Math.round((m-1)*100)}%`;
}

/* Màu ô heat */
function heatStyle(m) {
  if (m <= 1) return { background:"var(--surface-3)", color:"var(--muted)" };
  const a = (m - 1) / 0.5;
  return {
    background: `rgba(31,107,58,${0.3 + a*0.7})`,
    color: m < 1.35 ? "var(--ink)" : "#fff",
  };
}

export default function OwnerPricingPage() {
  const { user } = useOutletContext();

  /* Cơ sở */
  const [facilities, setFacilities] = useState([]);
  const [facId,      setFacId]      = useState(null);
  const [courts,     setCourts]     = useState([]);

  /* Giá cơ sở mỗi giờ — map courtId → price */
  const [prices, setPrices] = useState({});

  /* Rules */
  const [rules,       setRules]       = useState([]);
  const [holidays,    setHolidays]    = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [saving,      setSaving]      = useState(false);
  const [savedMsg,    setSavedMsg]    = useState("");
  const [apiErr,      setApiErr]      = useState("");

  /* Load danh sách cơ sở */
  useEffect(() => {
    listMyFacilities(user.id)
      .then((items) => {
        setFacilities(items);
        if (items.length) setFacId(items[0].id);
      })
      .catch(() => {});
    getHolidays().then((r) => setHolidays(r.data ?? [])).catch(() => {});
  }, [user.id]);

  /* Load courts + rules khi đổi cơ sở */
  useEffect(() => {
    if (!facId) return;
    setLoading(true);
    Promise.all([getFacility(facId), getPricingRules(facId)])
      .then(([fRes, rRes]) => {
        const fac    = fRes.data;
        const cts    = fac.courts ?? [];
        setCourts(cts);
        // Khởi tạo prices từ min_price hoặc 0
        const p = {};
        cts.forEach((c) => { p[c.id] = c.min_price ?? 0; });
        setPrices(p);
        setRules(rulesFromApi(rRes.data?.rules));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [facId]);

  const upd = (key, field, val) =>
    setRules((prev) => prev.map((r) => r._key === key ? { ...r, [field]: val } : r));

  const adjMult = (key, delta) =>
    setRules((prev) => prev.map((r) => {
      if (r._key !== key) return r;
      const v = Math.round((Number(r.multiplier) + delta) * 100) / 100;
      return { ...r, multiplier: Math.min(MULT_MAX, Math.max(MULT_MIN, v)) };
    }));

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true); setApiErr(""); setSavedMsg("");
    try {
      const payload = rules.map((r) => ({
        name:        r.name.trim() || (RULE_TYPES.find((t) => t.value===r.rule_type)?.label ?? r.rule_type),
        rule_type:   r.rule_type,
        multiplier:  Number(r.multiplier),
        start_time:  r.rule_type==="PEAK_HOUR" ? `${r.start_time}:00` : null,
        end_time:    r.rule_type==="PEAK_HOUR" ? `${r.end_time}:00`   : null,
        day_of_week: r.rule_type==="WEEKEND"   ? Number(r.day_of_week) : null,
        holiday_id:  r.rule_type==="HOLIDAY"   ? Number(r.holiday_id)  : null,
      }));
      await savePricingRules(facId, payload);
      setSavedMsg("Đã lưu bảng giá.");
    } catch (err) {
      setApiErr(err.message || "Không lưu được.");
    } finally {
      setSaving(false);
    }
  };

  /* Heat grid: 7 ngày tới */
  const days = Array.from({length:7}, (_,i) => {
    const d = new Date(); d.setDate(d.getDate()+i); return d;
  });

  /* Sân đầu tiên để preview — chưa dùng, giữ courts để render bảng */
  const firstCourt = courts[0];

  return (
    <form onSubmit={handleSave} noValidate>
      <div className="page-head">
        <h1>Bảng giá và hệ số</h1>
        <div className="row" style={{ "--gap":"10px" }}>
          {/* Dropdown chọn cơ sở */}
          <select className="select" style={{ width:240 }}
            value={facId ?? ""} onChange={(e) => setFacId(Number(e.target.value))}>
            {facilities.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
          <button className="btn btn--primary" type="submit" disabled={saving}>
            {saving ? "Đang lưu…" : "Lưu bảng giá"}
          </button>
        </div>
      </div>

      {savedMsg && <div className="notice notice--ok" style={{ marginBottom:16, flex:"none" }}><Icon name="check" size={16} />{savedMsg}</div>}
      {apiErr   && <div className="notice notice--danger" style={{ marginBottom:16, flex:"none" }}><Icon name="alert" size={16} />{apiErr}</div>}

      {loading ? (
        <div className="skel" style={{ height:200, borderRadius:16 }} />
      ) : (
        <section className="card" style={{ maxWidth: 640 }}>
          <div className="card__head">
            <h2>Quy tắc hệ số</h2>
            <button type="button" className="btn btn--sm"
              onClick={() => setRules((p) => [...p, emptyRule()])}>
              <Icon name="plus" size={14} />Thêm quy tắc
            </button>
          </div>

          {rules.length === 0 && (
            <p className="muted small">Chưa có quy tắc. Thêm để áp hệ số giá.</p>
          )}

          <ul className="rules">
            {rules.map((r) => (
              <li key={r._key} className="rule">
                <select className="select select--sm" value={r.rule_type}
                  onChange={(e) => upd(r._key, "rule_type", e.target.value)}>
                  {RULE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>

                <div className="rule__when">
                  {r.rule_type === "PEAK_HOUR" && (
                    <>
                      <select className="select select--sm mono" style={{ width:88 }}
                        value={r.start_time}
                        onChange={(e) => upd(r._key, "start_time", e.target.value)}>
                        {TIME_OPTIONS.map((h) => <option key={h} value={h}>{h}</option>)}
                      </select>
                      <span className="muted">–</span>
                      <select className="select select--sm mono" style={{ width:88 }}
                        value={r.end_time}
                        onChange={(e) => upd(r._key, "end_time", e.target.value)}>
                        {TIME_OPTIONS.map((h) => <option key={h} value={h}>{h}</option>)}
                      </select>
                    </>
                  )}
                  {r.rule_type === "WEEKEND" && (
                    <span className="small ink2">Thứ Bảy và Chủ nhật</span>
                  )}
                  {r.rule_type === "HOLIDAY" && (
                    <span className="small ink2">{holidays.length} ngày lễ trong danh mục</span>
                  )}
                </div>

                <span className="mstep" role="group" aria-label="Hệ số">
                  <button type="button" disabled={Number(r.multiplier) <= MULT_MIN}
                    onClick={() => adjMult(r._key, -MULT_STEP)} aria-label="Giảm hệ số">−</button>
                  <output className="mono">
                    {fmtMult(Number(r.multiplier))}
                    <small>{fmtPct(Number(r.multiplier))}</small>
                  </output>
                  <button type="button" disabled={Number(r.multiplier) >= MULT_MAX}
                    onClick={() => adjMult(r._key, +MULT_STEP)} aria-label="Tăng hệ số">+</button>
                </span>

                <button type="button" className="icon-btn"
                  onClick={() => setRules((p) => p.filter((x) => x._key !== r._key))}
                  aria-label="Xóa quy tắc">
                  <Icon name="trash" size={16} />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </form>
  );
}
