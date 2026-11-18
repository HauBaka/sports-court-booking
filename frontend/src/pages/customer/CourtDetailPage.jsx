import { useState, useEffect, useMemo, useCallback } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { getFacility, getFacilityServices } from "../../services/facilityService";
import { getCourtSlots } from "../../services/courtService";
import { calculatePrice } from "../../services/bookingService";
import { formatTime } from "../../utils/format";
import "../../styles/court-detail.css";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

// ─────────────────────────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────────────────────────
const fmtVnd = (n) => Number(n ?? 0).toLocaleString("vi-VN") + " ₫";

function getTodayStr() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm   = String(d.getMonth() + 1).padStart(2, "0");
  const dd   = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}
function addDays(dateStr, n) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}
function formatDateLabel(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  const days = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
  return { dow: days[d.getDay()], short: `${d.getDate()}/${d.getMonth() + 1}` };
}
function timeToMin(t) {
  if (!t) return 0;
  const [h, m] = t.split(":");
  return Number(h) * 60 + Number(m);
}
function normalizeStatus(s) {
  return (s ?? "available").toLowerCase();
}

// ─────────────────────────────────────────────────────────────────
//  COMPONENT
// ─────────────────────────────────────────────────────────────────
export default function CourtDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const today = getTodayStr();
  const dates = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(today, i)),
    [today]
  );

  // ── Facility ──
  const [facility, setFacility]           = useState(null);
  const [facilityStatus, setFacilityStatus] = useState("loading");
  const [facilityError, setFacilityError]   = useState("");

  // ── Services ──
  const [services, setServices]   = useState([]);
  const [serviceQty, setServiceQty] = useState({});

  // ── Slots ──
  const [selectedDate, setSelectedDate]   = useState(today);
  const [selectedCourt, setSelectedCourt] = useState(null);
  const [slots, setSlots]                 = useState([]);
  const [slotsStatus, setSlotsStatus]     = useState("idle");
  const [slotsError, setSlotsError]       = useState("");

  // ── Chọn slot ──
  const [selectedSlots, setSelectedSlots] = useState([]);

  // ── Tính giá preview ──
  const [priceData, setPriceData]     = useState(null);
  const [priceStatus, setPriceStatus] = useState("idle");

  // ── Load facility + services ──
  useEffect(() => {
    let cancelled = false;
    setFacilityStatus("loading");
    Promise.all([getFacility(id), getFacilityServices(id)])
      .then(([fRes, sRes]) => {
        if (cancelled) return;
        const f = fRes.data;
        setFacility(f);
        const firstActive = (f.courts ?? []).find((c) => c.is_active !== false);
        setSelectedCourt(firstActive?.id ?? f.courts?.[0]?.id ?? null);
        setFacilityStatus("ready");
        const svcs = sRes.data ?? [];
        setServices(svcs);
        const initQty = {};
        svcs.forEach((s) => { initQty[s.id] = 0; });
        setServiceQty(initQty);
      })
      .catch((err) => {
        if (cancelled) return;
        setFacilityError(err.message || "Không tải được thông tin cơ sở.");
        setFacilityStatus("error");
      });
    return () => { cancelled = true; };
  }, [id]);

  // ── Load slots ──
  const loadSlots = useCallback(async (courtId, date) => {
    if (!courtId) return;
    setSlotsStatus("loading");
    setSlotsError("");
    setSelectedSlots([]);
    setPriceData(null);
    try {
      const res = await getCourtSlots(courtId, date);
      setSlots(res.data?.slots ?? []);
      setSlotsStatus("ready");
    } catch (err) {
      setSlotsError(err.message || "Không tải được lịch khung giờ.");
      setSlotsStatus("error");
      setSlots([]);
    }
  }, []);

  useEffect(() => {
    if (selectedCourt && selectedDate) loadSlots(selectedCourt, selectedDate);
  }, [selectedCourt, selectedDate, loadSlots]);

  // ── Slots đã chọn, sort theo start_time ──
  const selectedSlotsSorted = useMemo(() =>
    [...selectedSlots].sort((a, b) => {
      const sa = slots.find((s) => s.time_slot_id === a);
      const sb = slots.find((s) => s.time_slot_id === b);
      return timeToMin(sa?.start_time) - timeToMin(sb?.start_time);
    }),
    [selectedSlots, slots]
  );

  const servicesPayload = useMemo(() =>
    Object.entries(serviceQty)
      .filter(([, qty]) => qty > 0)
      .map(([service_id, quantity]) => ({ service_id: Number(service_id), quantity })),
    [serviceQty]
  );

  // ── Gọi calculate-price khi slot / dịch vụ thay đổi ──
  useEffect(() => {
    if (selectedSlotsSorted.length === 0 || !selectedCourt) {
      setPriceData(null);
      setPriceStatus("idle");
      return;
    }
    let cancelled = false;
    setPriceStatus("loading");
    calculatePrice({
      court_id: selectedCourt,
      play_date: selectedDate,
      time_slot_ids: selectedSlotsSorted,
      services: servicesPayload,
    })
      .then((res) => { if (!cancelled) { setPriceData(res.data); setPriceStatus("ready"); } })
      .catch(() => { if (!cancelled) setPriceStatus("error"); });
    return () => { cancelled = true; };
  }, [selectedSlotsSorted, servicesPayload, selectedCourt, selectedDate]);

  // ── Đổi sân / ngày ──
  const handleCourtChange = (cid) => { setSelectedCourt(cid); setSelectedSlots([]); setPriceData(null); };
  const handleDateChange  = (d)   => { setSelectedDate(d);    setSelectedSlots([]); setPriceData(null); };

  // ── Chọn slot liên tiếp (so theo time, không phải index) ──
  const handleSlotClick = (slot) => {
    if (normalizeStatus(slot.status) !== "available") return;
    setSelectedSlots((prev) => {
      if (prev.length === 0) return [slot.time_slot_id];
      const prevObjs = prev
        .map((sid) => slots.find((s) => s.time_slot_id === sid))
        .filter(Boolean)
        .sort((a, b) => timeToMin(a.start_time) - timeToMin(b.start_time));
      const first = prevObjs[0];
      const last  = prevObjs[prevObjs.length - 1];
      if (prev.includes(slot.time_slot_id)) {
        if (slot.time_slot_id === first.time_slot_id || slot.time_slot_id === last.time_slot_id)
          return prev.filter((sid) => sid !== slot.time_slot_id);
        return [slot.time_slot_id];
      }
      if (timeToMin(slot.end_time)   === timeToMin(first.start_time)) return [...prev, slot.time_slot_id];
      if (timeToMin(slot.start_time) === timeToMin(last.end_time))    return [...prev, slot.time_slot_id];
      return [slot.time_slot_id];
    });
  };

  // ── Dịch vụ ──
  const handleQtyChange = (serviceId, delta) => {
    setServiceQty((prev) => ({ ...prev, [serviceId]: Math.max(0, (prev[serviceId] ?? 0) + delta) }));
  };

  // ── Tiếp tục → navigate sang trang xác nhận ──
  const handleProceed = () => {
    navigate("/booking/confirm", {
      state: {
        courtId:      selectedCourt,
        playDate:     selectedDate,
        timeSlotIds:  selectedSlotsSorted,
      },
    });
  };

  // ── Render guards ──
  if (facilityStatus === "loading") {
    return (
      <div className="cd-page">
        <div className="cd-state-center"><div className="fc-spinner" /><p>Đang tải thông tin cơ sở...</p></div>
      </div>
    );
  }
  if (facilityStatus === "error") {
    return (
      <div className="cd-page">
        <div className="cd-breadcrumb"><Link to="/courts" className="cd-back-link">← Quay lại tìm sân</Link></div>
        <div className="cd-state-center">
          <p className="cd-error-msg">{facilityError}</p>
          <Link to="/courts" className="cd-btn-retry">← Quay lại tìm sân</Link>
        </div>
      </div>
    );
  }

  const courts = facility.courts ?? [];
  const courtTypes = [...new Set(courts.map((c) => c.court_type).filter(Boolean))];
  const selectedSlotObjs = selectedSlotsSorted
    .map((sid) => slots.find((s) => s.time_slot_id === sid)).filter(Boolean);
  const startTimeFmt = selectedSlotObjs.length ? formatTime(selectedSlotObjs[0].start_time) : "";
  const endTimeFmt   = selectedSlotObjs.length ? formatTime(selectedSlotObjs[selectedSlotObjs.length - 1].end_time) : "";

  return (
    <div className="cd-page">
      {/* Breadcrumb */}
      <div className="cd-breadcrumb">
        <Link to="/courts" className="cd-back-link">← Quay lại tìm sân</Link>
      </div>

      {/* Header cơ sở */}
      <div className="cd-header">
        <div className="cd-header-img">
          <div className="cd-header-img-placeholder"><span>🏟️</span></div>
        </div>
        <div className="cd-header-info">
          <div className="cd-header-top">
            <div>
              <h1 className="cd-facility-name">{facility.name}</h1>
              <p className="cd-facility-address">{facility.address}</p>
              {facility.district && facility.city && (
                <p className="cd-facility-address">{facility.district}, {facility.city}</p>
              )}
            </div>
          </div>
          {courtTypes.length > 0 && (
            <div className="cd-sports-tags">
              {courtTypes.map((t) => <span key={t} className="cd-sport-tag">{t}</span>)}
            </div>
          )}
          <div className="cd-hours-row">
            <span className="cd-hours-label">Giờ mở cửa:</span>
            <span className="cd-hours-value">
              {formatTime(facility.open_time)} – {formatTime(facility.close_time)}
            </span>
          </div>
          {facility.description && <p className="cd-description">{facility.description}</p>}
        </div>
      </div>

      {/* Bản đồ nhỏ */}
      {facility.latitude != null && facility.longitude != null && (
        <div className="cd-map-wrap">
          <MapContainer center={[facility.latitude, facility.longitude]} zoom={15} className="cd-map" scrollWheelZoom={false}>
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap contributors</a>'
            />
            <Marker position={[facility.latitude, facility.longitude]}>
              <Popup><strong>{facility.name}</strong><br />{facility.address}</Popup>
            </Marker>
          </MapContainer>
        </div>
      )}

      {/* Khu vực chọn sân & khung giờ */}
      <div className="cd-booking-area">
        <h2 className="cd-section-title">Chọn sân & khung giờ</h2>

        {courts.length === 0 ? (
          <p className="cd-no-courts">Cơ sở này chưa có sân con nào.</p>
        ) : (
          <>
            {/* Tabs sân */}
            <div className="cd-court-tabs">
              {courts.map((c) => (
                <button
                  key={c.id}
                  className={`cd-court-tab${selectedCourt === c.id ? " active" : ""}${c.is_active === false ? " inactive" : ""}`}
                  onClick={() => c.is_active !== false && handleCourtChange(c.id)}
                  type="button"
                  disabled={c.is_active === false}
                  title={c.is_active === false ? "Sân đang tạm ngưng" : c.court_type}
                >
                  <span className="cd-court-tab-name">{c.name}</span>
                  <span className="cd-court-tab-sport">{c.court_type ?? c.environment}</span>
                </button>
              ))}
            </div>

            {/* Strip ngày */}
            <div className="cd-date-strip">
              {dates.map((d) => {
                const { dow, short } = formatDateLabel(d);
                const isToday = d === today;
                return (
                  <button
                    key={d}
                    className={`cd-date-btn${selectedDate === d ? " active" : ""}${isToday ? " today" : ""}`}
                    onClick={() => handleDateChange(d)}
                    type="button"
                  >
                    <span className="cd-date-dow">{isToday ? "Hôm nay" : dow}</span>
                    <span className="cd-date-day">{short}</span>
                  </button>
                );
              })}
            </div>

            {/* Chú giải */}
            <div className="cd-legend">
              <span className="cd-legend-item"><span className="cd-legend-dot available" />Trống</span>
              <span className="cd-legend-item"><span className="cd-legend-dot unavailable" />Đã qua giờ</span>
              <span className="cd-legend-item"><span className="cd-legend-dot holding" />Đang giữ chỗ</span>
              <span className="cd-legend-item"><span className="cd-legend-dot booked" />Đã đặt</span>
              <span className="cd-legend-item"><span className="cd-legend-dot selected" />Đang chọn</span>
            </div>

            {/* Lưới slot */}
            {slotsStatus === "loading" && (
              <div className="cd-slots-loading"><div className="fc-spinner" /><span>Đang tải lịch...</span></div>
            )}
            {slotsStatus === "error" && (
              <div className="cd-slots-error">
                <p>{slotsError}</p>
                <button className="cd-btn-retry" type="button" onClick={() => loadSlots(selectedCourt, selectedDate)}>Thử lại</button>
              </div>
            )}
            {slotsStatus === "ready" && slots.length === 0 && (
              <p className="cd-no-slots">Không có khung giờ nào trong ngày này.</p>
            )}
            {slotsStatus === "ready" && slots.length > 0 && (
              <>
                <div className="cd-slots-grid">
                  {slots.map((slot) => {
                    const status = normalizeStatus(slot.status);
                    const isSelected = selectedSlots.includes(slot.time_slot_id);
                    const isSelectable = status === "available";
                    const label = `${formatTime(slot.start_time)} – ${formatTime(slot.end_time)}`;
                    return (
                      <button
                        key={slot.time_slot_id}
                        type="button"
                        className={["cd-slot", `cd-slot--${status}`, isSelected ? "cd-slot--selected" : ""].join(" ").trim()}
                        onClick={() => handleSlotClick(slot)}
                        disabled={!isSelectable}
                        title={
                          status === "booked"      ? "Đã được đặt" :
                          status === "holding"     ? "Đang có người giữ chỗ" :
                          status === "unavailable" ? "Khung giờ đã qua" : label
                        }
                      >
                        <span className="cd-slot-time">{label}</span>
                        {isSelectable && slot.base_price != null && (
                          <span className="cd-slot-price">{fmtVnd(slot.base_price)}</span>
                        )}
                        {status === "booked"      && <span className="cd-slot-badge">Đã đặt</span>}
                        {status === "holding"     && <span className="cd-slot-badge">Giữ chỗ</span>}
                        {status === "unavailable" && <span className="cd-slot-badge">Qua giờ</span>}
                      </button>
                    );
                  })}
                </div>
                <p className="cd-slots-hint">Chỉ chọn được các khung liên tiếp trên cùng một sân.</p>
              </>
            )}

            {/* Dịch vụ đi kèm */}
            {services.length > 0 && selectedSlots.length > 0 && (
              <div className="cd-services">
                <h3 className="cd-services-title">Dịch vụ đi kèm <span className="cd-services-opt">(tùy chọn)</span></h3>
                <div className="cd-services-list">
                  {services.map((svc) => (
                    <div key={svc.id} className="cd-service-row">
                      <div className="cd-service-info">
                        <span className="cd-service-name">{svc.name}</span>
                        <span className="cd-service-price">{fmtVnd(svc.unit_price)} / {svc.unit}</span>
                      </div>
                      <div className="cd-service-qty">
                        <button type="button" className="cd-qty-btn" onClick={() => handleQtyChange(svc.id, -1)} disabled={!serviceQty[svc.id]}>−</button>
                        <span className="cd-qty-val">{serviceQty[svc.id] ?? 0}</span>
                        <button type="button" className="cd-qty-btn" onClick={() => handleQtyChange(svc.id, 1)}>+</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Nút Tiếp tục */}
            {selectedSlots.length > 0 && (
              <div className="cd-proceed-bar">
                {priceStatus === "loading" && <span className="cd-price-loading">Đang tính giá...</span>}
                {priceStatus === "ready" && priceData && (
                  <span className="cd-price-preview">
                    {startTimeFmt} – {endTimeFmt} &nbsp;·&nbsp;
                    <strong>{fmtVnd(priceData.pricing_summary.grand_total_amount)}</strong>
                  </span>
                )}
                <button
                  className="cd-btn-proceed"
                  type="button"
                  onClick={handleProceed}
                  disabled={priceStatus !== "ready"}
                >
                  Tiếp tục →
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
