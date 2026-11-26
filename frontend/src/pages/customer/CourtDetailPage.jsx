import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { getFacility, getFacilityServices } from "../../services/facilityService";
import { getCourtSlots } from "../../services/courtService";
import { calculatePrice } from "../../services/bookingService";
import { formatTime, formatVnd } from "../../utils/format";
import Icon from "../../components/ui/Icon";

/* ── Helpers ──────────────────────────────────────────────────── */
function getTodayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function addDays(s, n) {
  const d = new Date(s); d.setDate(d.getDate() + n); return d.toISOString().slice(0,10);
}
function timeToMin(t = "") {
  const [h, m] = t.split(":"); return Number(h)*60 + Number(m||0);
}

const WD = ["CN","T2","T3","T4","T5","T6","T7"];

/* ── DayStrip ─────────────────────────────────────────────────── */
function DayStrip({ dates, value, onChange }) {
  return (
    <div className="days" role="tablist" aria-label="Chọn ngày">
      {dates.map((d, i) => {
        const dt   = new Date(d + "T00:00:00");
        const dow  = i === 0 ? "Hôm nay" : WD[dt.getDay()];
        const date = dt.getDate();
        const mon  = `Th${dt.getMonth()+1}`;
        return (
          <button key={d} role="tab" aria-selected={d === value}
            className={"day" + (d === value ? " on" : "")}
            onClick={() => onChange(d)}>
            <span>{dow}</span><b>{date}</b><span>{mon}</span>
          </button>
        );
      })}
    </div>
  );
}

/* ── SlotLegend ───────────────────────────────────────────────── */
function SlotLegend() {
  return (
    <div className="legend">
      <span><i />Trống</span>
      <span><i style={{ background:"var(--accent)", borderColor:"transparent" }} />Đang chọn</span>
      <span><i style={{ borderStyle:"dashed", borderColor:"rgb(138 83 0/.45)", background:"var(--warn-soft)" }} />Người khác đang giữ</span>
      <span><i style={{ background:"var(--accent-soft)", borderColor:"rgb(31 107 58/.3)" }} />Đã cọc</span>
    </div>
  );
}

/* ── SlotRow — một hàng sân trong lưới ───────────────────────── */
function SlotRow({ court, slots, selected, onToggle }) {
  return (
    <>
      {/* Cột tên sân (sticky trái) */}
      <span className="gs-c">
        {court.name}
        <small>{court.court_type ?? ""}</small>
      </span>

      {/* Các ô giờ */}
      {slots.map((s) => {
        const isPicked = selected.includes(s.time_slot_id);
        const st = s.status?.toUpperCase() ?? "AVAILABLE";
        const disabled = st !== "AVAILABLE";

        let cls = "slot";
        if      (isPicked)         cls += " slot--pick";
        else if (st === "HOLDING") cls += " slot--held";
        else if (st === "BOOKED")  cls += " slot--taken";
        else if (st === "UNAVAILABLE") cls += " slot--past";

        const label = isPicked ? "Đang chọn"
          : st === "HOLDING"     ? "Đang giữ"
          : st === "BOOKED"      ? "Đã cọc"
          : st === "UNAVAILABLE" ? "Qua giờ"
          : "Trống";

        return (
          <button
            key={s.time_slot_id}
            className={cls}
            disabled={disabled}
            aria-pressed={isPicked}
            aria-label={`${formatTime(s.start_time)}: ${label}`}
            onClick={() => !disabled && onToggle(court.id, s.time_slot_id)}
          >
            {label}
          </button>
        );
      })}
    </>
  );
}

/* ── Main page ────────────────────────────────────────────────── */
export default function CourtDetailPage() {
  const { id }     = useParams();
  const navigate   = useNavigate();
  const today      = getTodayStr();
  const dates      = useMemo(() => Array.from({length:7},(_,i) => addDays(today,i)), [today]);

  /* Facility */
  const [facility, setFacility]   = useState(null);
  const [fStatus,  setFStatus]    = useState("loading");
  const [fError,   setFError]     = useState("");

  /* Services */
  const [services,    setServices]    = useState([]);
  const [serviceQty,  setServiceQty]  = useState({});

  /* Ngày & sân đang xem */
  const [selDate,  setSelDate]  = useState(today);
  const [selCourt, setSelCourt] = useState(null);  // court.id

  /* Slots của sân đang xem */
  const [slots,       setSlots]       = useState([]);
  const [slotsStatus, setSlotsStatus] = useState("idle");

  /* Slot đã chọn: { courtId, ids[] } — chỉ cho phép 1 sân */
  const [selection, setSelection] = useState({ courtId: null, ids: [] });

  /* Tính giá */
  const [priceData,   setPriceData]   = useState(null);
  const [priceStatus, setPriceStatus] = useState("idle");

  /* Tab */
  const [tab, setTab] = useState("lich");

  /* Load facility + services */
  useEffect(() => {
    setFStatus("loading");
    Promise.all([getFacility(id), getFacilityServices(id)])
      .then(([fRes, sRes]) => {
        const f = fRes.data;
        setFacility(f);
        const first = (f.courts ?? []).find((c) => c.is_active !== false) ?? f.courts?.[0];
        setSelCourt(first?.id ?? null);
        setFStatus("ready");
        const svcs = sRes.data ?? [];
        setServices(svcs);
        setServiceQty(Object.fromEntries(svcs.map((s) => [s.id, 0])));
      })
      .catch((e) => { setFError(e.message || "Không tải được thông tin cơ sở."); setFStatus("error"); });
  }, [id]);

  /* Load slots khi đổi sân hoặc ngày */
  const loadSlots = useCallback(async (courtId, date) => {
    if (!courtId) return;
    setSlotsStatus("loading");
    setSlots([]);
    try {
      const res = await getCourtSlots(courtId, date);
      setSlots(res.data?.slots ?? []);
      setSlotsStatus("ready");
    } catch {
      setSlotsStatus("error");
    }
  }, []);

  useEffect(() => {
    if (selCourt && selDate) loadSlots(selCourt, selDate);
  }, [selCourt, selDate, loadSlots]);

  /* Đổi ngày: giữ sân, bỏ chọn slot */
  const changeDate = (d) => {
    setSelDate(d);
    setSelection({ courtId: null, ids: [] });
    setPriceData(null);
  };

  /* Toggle slot — đổi sân thì reset selection */
  const toggleSlot = (courtId, slotId) => {
    setSelection((prev) => {
      let ids;
      if (prev.courtId !== courtId) {
        ids = [slotId];
      } else if (prev.ids.includes(slotId)) {
        ids = prev.ids.filter((x) => x !== slotId);
      } else {
        ids = [...prev.ids, slotId];
      }
      return { courtId: ids.length ? courtId : null, ids };
    });
    setPriceData(null);
  };

  /* Services payload */
  const servicesPayload = useMemo(() =>
    Object.entries(serviceQty)
      .filter(([,q]) => q > 0)
      .map(([service_id, quantity]) => ({ service_id: Number(service_id), quantity })),
    [serviceQty]);

  /* Tính giá */
  const sortedIds = useMemo(() =>
    [...selection.ids].sort((a, b) => {
      const sa = slots.find((s) => s.time_slot_id === a);
      const sb = slots.find((s) => s.time_slot_id === b);
      return timeToMin(sa?.start_time) - timeToMin(sb?.start_time);
    }),
    [selection.ids, slots]);

  useEffect(() => {
    if (!sortedIds.length || !selection.courtId) { setPriceData(null); setPriceStatus("idle"); return; }
    let cancelled = false;
    setPriceStatus("loading");
    calculatePrice({ court_id: selection.courtId, play_date: selDate, time_slot_ids: sortedIds, services: servicesPayload })
      .then((res) => { if (!cancelled) { setPriceData(res.data); setPriceStatus("ready"); } })
      .catch(() => { if (!cancelled) setPriceStatus("error"); });
    return () => { cancelled = true; };
  }, [sortedIds, servicesPayload, selection.courtId, selDate]);

  /* Tiếp tục → confirm */
  const handleProceed = () => navigate("/booking/confirm", {
    state: { courtId: selection.courtId, playDate: selDate, timeSlotIds: sortedIds, services: servicesPayload },
  });

  /* Tất cả giờ bắt đầu duy nhất (header hàng ngang) — PHẢI trước guard return */
  const headers = useMemo(() => {
    const times = [...new Set(slots.map((s) => s.start_time))].sort();
    return times;
  }, [slots]);

  /* Derived từ facility — an toàn khi facility null vì dùng ?? [] */
  const courts  = facility?.courts ?? [];
  const sports  = facility?.sports_names ?? [];
  const minPrice = courts.length
    ? Math.min(...courts.filter((c) => c.is_active !== false).map((c) => c.base_hourly_rate ?? c.price ?? 0))
    : null;
  const selSlotObjs = sortedIds.map((sid) => slots.find((s) => s.time_slot_id === sid)).filter(Boolean);
  const timeRange = selSlotObjs.length
    ? `${formatTime(selSlotObjs[0].start_time)}–${formatTime(selSlotObjs[selSlotObjs.length-1].end_time)}`
    : null;

  /* ── Render guards (sau tất cả hooks) ── */
  if (fStatus === "loading") return (
    <main className="page"><div className="wrap">
      <div className="notice" style={{ marginTop: 32 }}>
        <div className="skel" style={{ width: 200, height: 20 }} />
      </div>
    </div></main>
  );
  if (fStatus === "error") return (
    <main className="page"><div className="wrap">
      <div className="notice notice--danger"><Icon name="alert" size={16} />{fError}</div>
      <Link to="/courts" className="link" style={{ marginTop: 12, display: "inline-block" }}>← Quay lại tìm sân</Link>
    </div></main>
  );

  /* Tabs */
  const TABS = [
    ["lich", "Lịch trống"],
    ["info", "Sân và giá"],
    ...(services.length ? [["dv", "Dịch vụ"]] : []),
  ];

  return (
    <main className="page">
      <div className="wrap">

        {/* ── Breadcrumb ── */}
        <div className="crumbs">
          <Link to="/courts">Tìm sân</Link>
          <span>·</span>
          <span>{facility.district ?? facility.city}</span>
          {sports.length > 0 && <><span>·</span><span>{sports.join(", ")}</span></>}
        </div>

        {/* ── fhead: tiêu đề trái + ảnh phải ── */}
        <header className="fhead">
          <div className="fhead__text">
            <h1>{facility.name}</h1>
            <div className="row small ink2" style={{ "--gap": "14px", marginTop: 6 }}>
              {facility.address && (
                <span className="row" style={{ "--gap": "5px" }}>
                  <Icon name="pin" size={14} />
                  {[facility.address, facility.district].filter(Boolean).join(", ")}
                </span>
              )}
              {(facility.open_time || facility.close_time) && (
                <span className="row" style={{ "--gap": "5px" }}>
                  <Icon name="clock" size={14} />
                  <span className="mono">{formatTime(facility.open_time)}–{formatTime(facility.close_time)}</span>
                </span>
              )}
              {facility.rating != null && (
                <span className="rating">
                  <Icon name="star" size={13} fill />
                  {Number(facility.rating).toFixed(1)}
                  {facility.reviews_count != null && <span className="muted">({facility.reviews_count} đánh giá)</span>}
                </span>
              )}
            </div>
          </div>

          {/* Ảnh 3 cột — chỉ render khi có ít nhất 1 ảnh thực */}
          {(() => {
            const photos = facility.photos ?? (facility.cover_photo ? [facility.cover_photo] : []);
            if (!photos.length) return null;
            return (
              <div className="fhead__photos">
                {[0,1,2].map((i) => (
                  <div key={i}>
                    <img src={photos[i % photos.length]} alt="" loading="lazy" />
                  </div>
                ))}
              </div>
            );
          })()}
        </header>

        {/* ── Tabs ── */}
        <div className="seg seg--scroll ftabs" role="tablist" aria-label="Thông tin cơ sở">
          {TABS.map(([k, l]) => (
            <button key={k} role="tab" aria-selected={tab===k}
              className={tab===k ? "on" : ""} onClick={() => setTab(k)}>
              {l}
            </button>
          ))}
        </div>

        {/* ── Tab: Lịch trống ── */}
        {tab === "lich" && (
          <section className="card fboard" aria-label="Lịch trống theo ngày">
            {/* Dải ngày + chú giải */}
            <div className="fboard__top">
              <DayStrip dates={dates} value={selDate} onChange={changeDate} />
              <SlotLegend />
            </div>

            {/* Lưới slot */}
            <div className="fboard__grid slots-scroll">
              {slotsStatus === "loading" && (
                <div className="stack" style={{ "--gap":"8px" }} aria-hidden="true">
                  {[0,1,2].map((i) => (
                    <div key={i} className="skel" style={{ height:52, borderRadius:12 }} />
                  ))}
                </div>
              )}

              {slotsStatus === "error" && (
                <div className="notice notice--danger">
                  <Icon name="alert" size={16} />Không tải được lịch khung giờ.
                  <button className="btn btn--sm btn--ghost" style={{ marginLeft:"auto" }}
                    onClick={() => loadSlots(selCourt, selDate)}>Thử lại</button>
                </div>
              )}

              {slotsStatus === "ready" && slots.length === 0 && (
                <p className="muted small">Không có khung giờ nào trong ngày này.</p>
              )}

              {slotsStatus === "ready" && slots.length > 0 && headers.length > 0 && (
                <div
                  className="grid-slots"
                  style={{ "--cols": headers.length, gridTemplateColumns: `140px repeat(${headers.length}, minmax(72px,1fr))` }}
                >
                  {/* Header hàng giờ */}
                  <span />
                  {headers.map((h) => (
                    <span key={h} className="gs-h">{formatTime(h)}</span>
                  ))}

                  {/* Hàng mỗi sân */}
                  {courts.filter((c) => c.is_active !== false).map((court) => {
                    /* Map header → slot tương ứng của sân này */
                    const courtSlots = slots.filter((s) =>
                      s.court_id == null || s.court_id === court.id
                    );
                    const slotByTime = Object.fromEntries(
                      courtSlots.map((s) => [s.start_time, s])
                    );
                    return (
                      <SlotRow
                        key={court.id}
                        court={court}
                        slots={headers.map((h) => slotByTime[h]).filter(Boolean)}
                        selected={selection.courtId === court.id ? selection.ids : []}
                        onToggle={toggleSlot}
                      />
                    );
                  })}
                </div>
              )}
            </div>
          </section>
        )}

        {/* ── Tab: Sân và giá ── */}
        {tab === "info" && (
          <section className="scroll stack" style={{ "--gap":"18px" }}>
            {facility.description && (
              <p className="ink2" style={{ maxWidth:"64ch" }}>{facility.description}</p>
            )}
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Sân</th>
                    <th>Loại</th>
                    <th>Môi trường</th>
                    <th className="r">Giá/giờ</th>
                  </tr>
                </thead>
                <tbody>
                  {courts.map((c) => (
                    <tr key={c.id} style={c.is_active===false ? { opacity:.5 } : null}>
                      <td>
                        {c.name}
                        {c.is_active===false && (
                          <span className="badge badge--cancelled" style={{ marginLeft:8 }}>Tạm ngưng</span>
                        )}
                      </td>
                      <td>{c.court_type ?? "—"}</td>
                      <td>{c.environment ?? "—"}</td>
                      <td className="r num">
                        {c.base_hourly_rate != null ? formatVnd(c.base_hourly_rate) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* ── Tab: Dịch vụ ── */}
        {tab === "dv" && (
          <section className="grid-3 stagger" style={{ alignContent:"start" }}>
            {services.map((svc) => (
              <div key={svc.id} className="card card--tight">
                <div style={{ fontWeight:500 }}>{svc.name}</div>
                <div className="muted small mono">{formatVnd(svc.unit_price)} / {svc.unit}</div>
              </div>
            ))}
          </section>
        )}

        {/* ── Bottom bar: tóm tắt + nút đặt sân ── */}
        <div className={"fbar" + (selection.ids.length ? " is-on" : "")}>
          <div className="fbar__text">
            {selection.ids.length ? (
              <>
                <span className="small ink2">
                  {courts.find((c) => c.id === selection.courtId)?.name}
                  {timeRange && <> · <span className="mono">{timeRange}</span></>}
                </span>
                <span>
                  {priceStatus === "loading" && <span className="muted small">Đang tính giá…</span>}
                  {priceStatus === "ready" && priceData && (
                    <>
                      <b className="mono">{formatVnd(priceData.pricing_summary?.grand_total_amount ?? 0)}</b>
                      <span className="small muted"> · cọc <span className="mono">{formatVnd(priceData.pricing_summary?.deposit_amount ?? 0)}</span></span>
                    </>
                  )}
                </span>
              </>
            ) : (
              <>
                <span className="small muted">Chọn ô trống trên cùng một sân</span>
                {minPrice != null && (
                  <span>Giá từ <b className="mono">{formatVnd(minPrice)}</b><span className="small muted">/giờ</span></span>
                )}
              </>
            )}
          </div>
          <button
            className="btn btn--primary btn--lg"
            disabled={!selection.ids.length || priceStatus !== "ready"}
            onClick={handleProceed}
          >
            Đặt sân <Icon name="arrowR" size={16} />
          </button>
        </div>

      </div>
    </main>
  );
}
