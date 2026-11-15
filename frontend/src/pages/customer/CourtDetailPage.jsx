import { useState, useEffect, useMemo, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { getFacility } from "../../services/facilityService";
import { getCourtSlots } from "../../services/courtService";
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
//  Helpers ngày
// ─────────────────────────────────────────────────────────────────
function getTodayStr() {
  return new Date().toISOString().slice(0, 10);
}

function addDays(dateStr, n) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function formatDateLabel(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  const days = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
  const dow = days[d.getDay()];
  const day = d.getDate();
  const month = d.getMonth() + 1;
  return { dow, short: `${day}/${month}`, full: `${dow}, ${day}/${month}` };
}

function isoToDisplay(dateStr) {
  return formatDateLabel(dateStr).full;
}

// ─────────────────────────────────────────────────────────────────
//  Chuyển "HH:MM:SS" → số phút từ 0h
// ─────────────────────────────────────────────────────────────────
function timeToMin(t) {
  if (!t) return 0;
  const parts = t.split(":");
  return Number(parts[0]) * 60 + Number(parts[1]);
}

// ─────────────────────────────────────────────────────────────────
//  Normalize trạng thái API → chữ thường (AVAILABLE → available)
//  API trả: AVAILABLE | BOOKED | HOLDING
// ─────────────────────────────────────────────────────────────────
function normalizeStatus(s) {
  return (s ?? "available").toLowerCase();
}

const fmtVnd = (n) => Number(n).toLocaleString("vi-VN") + " ₫";

// ─────────────────────────────────────────────────────────────────
//  COMPONENT CHÍNH
// ─────────────────────────────────────────────────────────────────
export default function CourtDetailPage() {
  const { id } = useParams(); // facility id

  const today = getTodayStr();
  const dates = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(today, i)),
    [today]
  );

  // ── State cơ sở ──
  const [facility, setFacility] = useState(null);
  const [facilityStatus, setFacilityStatus] = useState("loading"); // loading | ready | error
  const [facilityError, setFacilityError] = useState("");

  // ── State slot ──
  const [selectedDate, setSelectedDate] = useState(today);
  const [selectedCourt, setSelectedCourt] = useState(null); // court id
  const [slots, setSlots] = useState([]);
  const [slotsStatus, setSlotsStatus] = useState("idle"); // idle | loading | ready | error
  const [slotsError, setSlotsError] = useState("");

  // ── State chọn ──
  // selectedSlots: mảng time_slot_id đã chọn (thứ tự tăng dần theo startMin)
  const [selectedSlots, setSelectedSlots] = useState([]);

  // ── Load cơ sở ──
  useEffect(() => {
    let cancelled = false;
    setFacilityStatus("loading");
    getFacility(id)
      .then((res) => {
        if (cancelled) return;
        const f = res.data;
        setFacility(f);
        // Mặc định chọn sân đầu tiên đang active
        const firstActive = (f.courts ?? []).find((c) => c.is_active !== false);
        setSelectedCourt(firstActive?.id ?? f.courts?.[0]?.id ?? null);
        setFacilityStatus("ready");
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

  // Tải slots khi sân hoặc ngày thay đổi
  useEffect(() => {
    if (selectedCourt && selectedDate) {
      loadSlots(selectedCourt, selectedDate);
    }
  }, [selectedCourt, selectedDate, loadSlots]);

  // ── Đổi sân / ngày ──
  const handleCourtChange = (cid) => {
    setSelectedCourt(cid);
    setSelectedSlots([]);
  };
  const handleDateChange = (d) => {
    setSelectedDate(d);
    setSelectedSlots([]);
  };

  // ── Logic chọn slot liên tiếp ──
  // selectedSlots: mảng time_slot_id; ta so sánh theo index trong mảng slots
  const handleSlotClick = (slot) => {
    if (normalizeStatus(slot.status) !== "available") return;

    const slotIndex = slots.findIndex((s) => s.time_slot_id === slot.time_slot_id);

    setSelectedSlots((prev) => {
      if (prev.length === 0) return [slot.time_slot_id];

      // Index của các slot đang chọn
      const prevIndexes = prev.map((id) => slots.findIndex((s) => s.time_slot_id === id));
      const minIdx = Math.min(...prevIndexes);
      const maxIdx = Math.max(...prevIndexes);

      // Bỏ chọn slot đang chọn — chỉ cho bỏ ở đầu hoặc cuối
      if (prev.includes(slot.time_slot_id)) {
        if (slotIndex === minIdx || slotIndex === maxIdx) {
          return prev.filter((id) => id !== slot.time_slot_id);
        }
        // Bấm giữa → reset về chỉ slot này
        return [slot.time_slot_id];
      }

      // Thêm slot liền kề trước
      if (slotIndex === minIdx - 1) {
        const prevSlot = slots[slotIndex];
        if (normalizeStatus(prevSlot?.status) !== "available") return prev;
        return [...prev, slot.time_slot_id];
      }
      // Thêm slot liền kề sau
      if (slotIndex === maxIdx + 1) {
        const nextSlot = slots[slotIndex];
        if (normalizeStatus(nextSlot?.status) !== "available") return prev;
        return [...prev, slot.time_slot_id];
      }

      // Không liền kề → reset
      return [slot.time_slot_id];
    });
  };

  // ── Tóm tắt đặt sân ──
  const bookingSummary = useMemo(() => {
    if (selectedSlots.length === 0 || !facility) return null;

    const selectedSlotObjs = selectedSlots
      .map((id) => slots.find((s) => s.time_slot_id === id))
      .filter(Boolean)
      .sort((a, b) => timeToMin(a.start_time) - timeToMin(b.start_time));

    if (selectedSlotObjs.length === 0) return null;

    const startTime = formatTime(selectedSlotObjs[0].start_time);
    const endTime = formatTime(selectedSlotObjs[selectedSlotObjs.length - 1].end_time);
    const total = selectedSlotObjs.reduce((sum, s) => sum + (s.base_price ?? 0), 0);
    const court = (facility.courts ?? []).find((c) => c.id === selectedCourt);

    return {
      court: court?.name ?? "",
      date: isoToDisplay(selectedDate),
      time: `${startTime} – ${endTime}`,
      duration: selectedSlotObjs.length,
      total,
      time_slot_ids: selectedSlotObjs.map((s) => s.time_slot_id),
    };
  }, [selectedSlots, slots, selectedDate, selectedCourt, facility]);

  // ── Render guard ──
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
  const courtObj = courts.find((c) => c.id === selectedCourt);

  // Lấy danh sách sport từ courts (mỗi court có sport_id, không có sport name trực tiếp)
  // API trả court_type thay vì sport name, dùng court_type để hiển thị tag
  const courtTypes = [...new Set(courts.map((c) => c.court_type).filter(Boolean))];

  return (
    <div className="cd-page">
      {/* ── Breadcrumb ── */}
      <div className="cd-breadcrumb">
        <Link to="/courts" className="cd-back-link">← Quay lại tìm sân</Link>
      </div>

      {/* ── Header cơ sở ── */}
      <div className="cd-header">
        <div className="cd-header-img">
          <div className="cd-header-img-placeholder">
            <span>🏟️</span>
          </div>
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
              {courtTypes.map((t) => (
                <span key={t} className="cd-sport-tag">{t}</span>
              ))}
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
              <Popup>
                <strong>{facility.name}</strong><br />
                {facility.address}
              </Popup>
            </Marker>
          </MapContainer>
        </div>
      )}

      {/* ── Khu vực đặt sân ── */}
      <div className="cd-booking-area">
        <h2 className="cd-section-title">Chọn sân & khung giờ</h2>

        {courts.length === 0 ? (
          <p className="cd-no-courts">Cơ sở này chưa có sân con nào.</p>
        ) : (
          <>
            {/* Chọn sân con */}
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

            {/* Chọn ngày */}
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
              <span className="cd-legend-item">
                <span className="cd-legend-dot available" />Trống
              </span>
              <span className="cd-legend-item">
                <span className="cd-legend-dot holding" />Đang giữ chỗ
              </span>
              <span className="cd-legend-item">
                <span className="cd-legend-dot booked" />Đã đặt
              </span>
              <span className="cd-legend-item">
                <span className="cd-legend-dot selected" />Đang chọn
              </span>
            </div>

            {/* Lưới khung giờ */}
            {slotsStatus === "loading" && (
              <div className="cd-slots-loading">
                <div className="fc-spinner" />
                <span>Đang tải lịch...</span>
              </div>
            )}

            {slotsStatus === "error" && (
              <div className="cd-slots-error">
                <p>{slotsError}</p>
                <button
                  className="cd-btn-retry"
                  type="button"
                  onClick={() => loadSlots(selectedCourt, selectedDate)}
                >
                  Thử lại
                </button>
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
                    const startFmt = formatTime(slot.start_time);
                    const endFmt = formatTime(slot.end_time);
                    const label = `${startFmt} – ${endFmt}`;

                    return (
                      <button
                        key={slot.time_slot_id}
                        type="button"
                        className={[
                          "cd-slot",
                          `cd-slot--${status}`,
                          isSelected ? "cd-slot--selected" : "",
                        ].join(" ").trim()}
                        onClick={() => handleSlotClick(slot)}
                        disabled={!isSelectable}
                        title={
                          status === "booked"
                            ? "Khung giờ này đã được đặt"
                            : status === "holding"
                            ? "Đang có người giữ chỗ"
                            : `${label} — ${fmtVnd(slot.base_price)}`
                        }
                      >
                        <span className="cd-slot-time">{label}</span>
                        {isSelectable && slot.base_price != null && (
                          <span className="cd-slot-price">{fmtVnd(slot.base_price)}</span>
                        )}
                        {status === "booked" && (
                          <span className="cd-slot-badge">Đã đặt</span>
                        )}
                        {status === "holding" && (
                          <span className="cd-slot-badge">Giữ chỗ</span>
                        )}
                      </button>
                    );
                  })}
                </div>

                <p className="cd-slots-hint">
                  Nhấn vào khung trống để chọn. Chỉ chọn được các khung liên tiếp trên cùng một sân.
                </p>
              </>
            )}
          </>
        )}
      </div>

    </div>
  );
}
