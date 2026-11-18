import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { getFacility, getFacilityServices } from "../../services/facilityService";
import { getCourtSlots } from "../../services/courtService";
import { calculatePrice, createBooking } from "../../services/bookingService";
import { formatTime } from "../../utils/format";
import "../../styles/court-detail.css";

// Fix icon Leaflet bị vỡ khi bundle bằng Vite
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
function isoToDisplay(dateStr) {
  const { dow, short } = formatDateLabel(dateStr);
  return `${dow}, ${short}`;
}
function timeToMin(t) {
  if (!t) return 0;
  const [h, m] = t.split(":");
  return Number(h) * 60 + Number(m);
}
function normalizeStatus(s) {
  return (s ?? "available").toLowerCase();
}

// Đếm giây còn lại đến holdExpiresAt (ISO string UTC)
function secondsUntil(isoStr) {
  return Math.max(0, Math.floor((new Date(isoStr) - Date.now()) / 1000));
}
function formatCountdown(secs) {
  const m = String(Math.floor(secs / 60)).padStart(2, "0");
  const s = String(secs % 60).padStart(2, "0");
  return `${m}:${s}`;
}

// ─────────────────────────────────────────────────────────────────
//  COMPONENT CHÍNH
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
  const [facility, setFacility] = useState(null);
  const [facilityStatus, setFacilityStatus] = useState("loading");
  const [facilityError, setFacilityError] = useState("");

  // ── Services ──
  const [services, setServices] = useState([]);
  // serviceQty: { [service_id]: quantity }
  const [serviceQty, setServiceQty] = useState({});

  // ── Slots ──
  const [selectedDate, setSelectedDate] = useState(today);
  const [selectedCourt, setSelectedCourt] = useState(null);
  const [slots, setSlots] = useState([]);
  const [slotsStatus, setSlotsStatus] = useState("idle");
  const [slotsError, setSlotsError] = useState("");

  // ── Chọn slot ──
  const [selectedSlots, setSelectedSlots] = useState([]);

  // ── Tính giá (3.2) ──
  const [priceData, setPriceData] = useState(null);   // response.data từ 3.2
  const [priceStatus, setPriceStatus] = useState("idle"); // idle | loading | ready | error

  // ── View: "grid" | "confirm" | "booked" ──
  // grid = lưới khung giờ, confirm = xem giá + đặt, booked = đang giữ chỗ
  const [view, setView] = useState("grid");

  // ── Đặt sân (3.3) ──
  const [booking, setBooking] = useState(null);  // response.data từ 3.3
  const [bookingError, setBookingError] = useState("");
  const [bookingLoading, setBookingLoading] = useState(false);

  // ── Đếm ngược ──
  const [countdown, setCountdown] = useState(0);
  const timerRef = useRef(null);

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
    if (selectedCourt && selectedDate) {
      loadSlots(selectedCourt, selectedDate);
    }
  }, [selectedCourt, selectedDate, loadSlots]);

  // ── Gọi 3.2 mỗi khi slots hoặc dịch vụ thay đổi ──
  const selectedSlotsSorted = useMemo(() => {
    return [...selectedSlots].sort((a, b) => {
      const sa = slots.find((s) => s.time_slot_id === a);
      const sb = slots.find((s) => s.time_slot_id === b);
      return timeToMin(sa?.start_time) - timeToMin(sb?.start_time);
    });
  }, [selectedSlots, slots]);

  const servicesPayload = useMemo(() =>
    Object.entries(serviceQty)
      .filter(([, qty]) => qty > 0)
      .map(([service_id, quantity]) => ({ service_id: Number(service_id), quantity })),
    [serviceQty]
  );

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
      .then((res) => {
        if (cancelled) return;
        setPriceData(res.data);
        setPriceStatus("ready");
      })
      .catch(() => {
        if (cancelled) return;
        setPriceStatus("error");
      });
    return () => { cancelled = true; };
  }, [selectedSlotsSorted, servicesPayload, selectedCourt, selectedDate]);

  // ── Đổi sân / ngày ──
  const handleCourtChange = (cid) => {
    setSelectedCourt(cid);
    setSelectedSlots([]);
    setPriceData(null);
    setView("grid");
  };
  const handleDateChange = (d) => {
    setSelectedDate(d);
    setSelectedSlots([]);
    setPriceData(null);
    setView("grid");
  };

  // ── Chọn slot liên tiếp ──
  // Hai slot liên tiếp khi end_time của slot trước = start_time của slot sau
  const handleSlotClick = (slot) => {
    if (normalizeStatus(slot.status) !== "available") return;

    setSelectedSlots((prev) => {
      if (prev.length === 0) return [slot.time_slot_id];

      // Lấy object đầy đủ của các slot đang chọn, sort theo start_time
      const prevObjs = prev
        .map((sid) => slots.find((s) => s.time_slot_id === sid))
        .filter(Boolean)
        .sort((a, b) => timeToMin(a.start_time) - timeToMin(b.start_time));

      const first = prevObjs[0];
      const last  = prevObjs[prevObjs.length - 1];

      // Bỏ chọn — chỉ cho bỏ ở đầu hoặc cuối dải
      if (prev.includes(slot.time_slot_id)) {
        if (slot.time_slot_id === first.time_slot_id || slot.time_slot_id === last.time_slot_id)
          return prev.filter((sid) => sid !== slot.time_slot_id);
        // Bấm giữa → reset về slot này
        return [slot.time_slot_id];
      }

      // Thêm slot liền trước: start_time của slot = end_time của first
      if (timeToMin(slot.end_time) === timeToMin(first.start_time))
        return [...prev, slot.time_slot_id];

      // Thêm slot liền sau: start_time của slot = end_time của last
      if (timeToMin(slot.start_time) === timeToMin(last.end_time))
        return [...prev, slot.time_slot_id];

      // Không liền kề → reset
      return [slot.time_slot_id];
    });
  };

  // ── Thay đổi số lượng dịch vụ ──
  const handleQtyChange = (serviceId, delta) => {
    setServiceQty((prev) => ({
      ...prev,
      [serviceId]: Math.max(0, (prev[serviceId] ?? 0) + delta),
    }));
  };

  // ── Bấm "Tiếp tục" → vào màn xác nhận ──
  const handleProceed = () => {
    setBookingError("");
    setView("confirm");
  };

  // ── Bấm "Đặt sân" → gọi 3.3 ──
  const handleBook = async () => {
    setBookingLoading(true);
    setBookingError("");
    try {
      const res = await createBooking({
        court_id: selectedCourt,
        play_date: selectedDate,
        time_slot_ids: selectedSlotsSorted,
        services: servicesPayload,
      });
      setBooking(res.data);
      setView("booked");
      // Khởi đếm ngược
      const secs = secondsUntil(res.data.hold_expires_at);
      setCountdown(secs);
    } catch (err) {
      if (err.code === "SLOT_ALREADY_BOOKED") {
        setBookingError("SLOT_ALREADY_BOOKED");
      } else {
        setBookingError(err.message || "Đặt sân thất bại. Vui lòng thử lại.");
      }
    } finally {
      setBookingLoading(false);
    }
  };

  // ── Đếm ngược ──
  useEffect(() => {
    if (view !== "booked" || !booking?.hold_expires_at) return;
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setCountdown(secondsUntil(booking.hold_expires_at));
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [view, booking]);

  // ── Quay lại lưới sau lỗi SLOT_ALREADY_BOOKED ──
  const handleBackToGrid = () => {
    setBookingError("");
    setView("grid");
    setSelectedSlots([]);
    setPriceData(null);
    loadSlots(selectedCourt, selectedDate);
  };

  // ── Render guards ──
  if (facilityStatus === "loading") {
    return (
      <div className="cd-page">
        <div className="cd-state-center">
          <div className="fc-spinner" />
          <p>Đang tải thông tin cơ sở...</p>
        </div>
      </div>
    );
  }
  if (facilityStatus === "error") {
    return (
      <div className="cd-page">
        <div className="cd-breadcrumb">
          <Link to="/courts" className="cd-back-link">← Quay lại tìm sân</Link>
        </div>
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
    .map((sid) => slots.find((s) => s.time_slot_id === sid))
    .filter(Boolean);
  const startTimeFmt = selectedSlotObjs.length
    ? formatTime(selectedSlotObjs[0].start_time) : "";
  const endTimeFmt = selectedSlotObjs.length
    ? formatTime(selectedSlotObjs[selectedSlotObjs.length - 1].end_time) : "";
  const courtName = courts.find((c) => c.id === selectedCourt)?.name ?? "";

  return (
    <div className="cd-page">
      {/* ── Breadcrumb ── */}
      <div className="cd-breadcrumb">
        <Link to="/courts" className="cd-back-link">← Quay lại tìm sân</Link>
      </div>

      {/* ── Header cơ sở ── */}
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
          {facility.description && (
            <p className="cd-description">{facility.description}</p>
          )}
        </div>
      </div>

      {/* ── Bản đồ nhỏ ── */}
      {facility.latitude != null && facility.longitude != null && (
        <div className="cd-map-wrap">
          <MapContainer
            center={[facility.latitude, facility.longitude]}
            zoom={15}
            className="cd-map"
            scrollWheelZoom={false}
          >
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

      {/* ── Khu vực đặt sân ── */}
      <div className="cd-booking-area">

        {/* ════════════════ VIEW: GRID ════════════════ */}
        {view === "grid" && (
          <>
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
                          status === "unavailable" ? "Khung giờ đã qua" :
                          label
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
          </>
        )}

        {/* ════════════════ VIEW: CONFIRM ════════════════ */}
        {view === "confirm" && priceData && (
          <>
            <div className="cd-confirm-header">
              <button className="cd-back-btn" type="button" onClick={() => setView("grid")}>← Quay lại</button>
              <h2 className="cd-section-title" style={{ margin: 0 }}>Xác nhận đặt sân</h2>
            </div>

            {/* Thông tin chung */}
            <div className="cd-confirm-meta">
              <div className="cd-confirm-row"><span>Sân</span><strong>{priceData.court_name}</strong></div>
              <div className="cd-confirm-row"><span>Ngày</span><strong>{isoToDisplay(priceData.play_date)}</strong></div>
              <div className="cd-confirm-row"><span>Giờ</span><strong>{priceData.time_range}</strong></div>
            </div>

            {/* Chi tiết từng khung */}
            <h3 className="cd-breakdown-title">Chi tiết khung giờ</h3>
            <div className="cd-breakdown">
              {priceData.slots_breakdown.map((s) => (
                <div key={s.time_slot_id} className="cd-breakdown-row">
                  <span className="cd-breakdown-time">
                    {formatTime(s.start_time)} – {formatTime(s.end_time)}
                  </span>
                  <span className="cd-breakdown-rule">{s.applied_rule}</span>
                  {s.multiplier !== 1 && (
                    <span className="cd-breakdown-mult">×{s.multiplier.toFixed(2)}</span>
                  )}
                  <span className="cd-breakdown-price">{fmtVnd(s.final_price)}</span>
                </div>
              ))}
            </div>

            {/* Dịch vụ */}
            {priceData.pricing_summary.service_total > 0 && (
              <div className="cd-confirm-row cd-confirm-row--sub">
                <span>Dịch vụ</span>
                <span>{fmtVnd(priceData.pricing_summary.service_total)}</span>
              </div>
            )}

            {/* Tổng */}
            <div className="cd-confirm-totals">
              <div className="cd-confirm-row">
                <span>Tổng tiền sân</span>
                <span>{fmtVnd(priceData.pricing_summary.subtotal)}</span>
              </div>
              {priceData.pricing_summary.service_total > 0 && (
                <div className="cd-confirm-row">
                  <span>Dịch vụ</span>
                  <span>{fmtVnd(priceData.pricing_summary.service_total)}</span>
                </div>
              )}
              <div className="cd-confirm-row cd-confirm-row--total">
                <span>Tổng cộng</span>
                <strong>{fmtVnd(priceData.pricing_summary.grand_total_amount)}</strong>
              </div>
              <div className="cd-confirm-row cd-confirm-row--deposit">
                <span>Cọc ngay qua ví ({priceData.deposit_policy.deposit_percentage}%)</span>
                <strong>{fmtVnd(priceData.deposit_policy.deposit_amount_required)}</strong>
              </div>
              <div className="cd-confirm-row cd-confirm-row--remain">
                <span>Thanh toán tại sân</span>
                <span>{fmtVnd(priceData.deposit_policy.remaining_amount_due_at_court)}</span>
              </div>
            </div>

            {/* Trạng thái ví */}
            <div className={`cd-wallet-status${priceData.user_wallet_status.is_balance_sufficient ? "" : " insufficient"}`}>
              <span>Số dư ví hiện tại: <strong>{fmtVnd(priceData.user_wallet_status.current_balance)}</strong></span>
              {priceData.user_wallet_status.is_balance_sufficient ? (
                <span className="cd-wallet-ok">Đủ số dư · Còn lại {fmtVnd(priceData.user_wallet_status.balance_after_deposit)}</span>
              ) : (
                <span className="cd-wallet-warn">Số dư không đủ để đặt cọc</span>
              )}
            </div>

            {/* Lỗi đặt sân */}
            {bookingError && bookingError !== "SLOT_ALREADY_BOOKED" && (
              <p className="cd-booking-error">{bookingError}</p>
            )}
            {bookingError === "SLOT_ALREADY_BOOKED" && (
              <div className="cd-slot-conflict">
                <p>Có khung giờ vừa bị người khác đặt mất. Vui lòng chọn lại.</p>
                <button className="cd-btn-retry" type="button" onClick={handleBackToGrid}>
                  Quay lại chọn khung giờ
                </button>
              </div>
            )}

            {/* Nút đặt */}
            {!bookingError && (
              <button
                className="cd-btn-book"
                type="button"
                onClick={handleBook}
                disabled={bookingLoading || !priceData.user_wallet_status.is_balance_sufficient}
              >
                {bookingLoading ? "Đang đặt..." : "Xác nhận đặt sân & cọc"}
              </button>
            )}
          </>
        )}

        {/* ════════════════ VIEW: BOOKED ════════════════ */}
        {view === "booked" && booking && (
          <div className="cd-booked">
            <div className="cd-booked-icon">✓</div>
            <h2 className="cd-booked-title">Giữ chỗ thành công!</h2>
            <p className="cd-booked-sub">Vui lòng thanh toán cọc trước khi hết giờ</p>

            <div className="cd-booked-info">
              <div className="cd-confirm-row"><span>Mã đặt sân</span><strong>#{booking.booking_id}</strong></div>
              <div className="cd-confirm-row"><span>Sân</span><strong>{courtName}</strong></div>
              <div className="cd-confirm-row"><span>Ngày</span><strong>{isoToDisplay(booking.play_date)}</strong></div>
              <div className="cd-confirm-row"><span>Tiền cọc</span><strong>{fmtVnd(booking.deposit_amount_required)}</strong></div>
            </div>

            {/* Đếm ngược */}
            <div className={`cd-countdown${countdown <= 60 ? " urgent" : ""}`}>
              <span className="cd-countdown-label">Hết hạn sau</span>
              <span className="cd-countdown-value">{formatCountdown(countdown)}</span>
            </div>

            {countdown === 0 && (
              <p className="cd-booking-error">Đã hết thời gian giữ chỗ. Vui lòng đặt lại.</p>
            )}

            <div className="cd-booked-actions">
              <button
                className="cd-btn-book"
                type="button"
                disabled={countdown === 0}
                onClick={() => navigate(`/bookings/${booking.booking_id}/deposit`)}
              >
                Thanh toán cọc ngay
              </button>
              <button className="cd-btn-outline-sm" type="button" onClick={() => navigate("/courts")}>
                Về trang tìm sân
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
