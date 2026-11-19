import { useState, useEffect, useRef } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import { calculatePrice, createBooking } from "../../services/bookingService";
import { formatTime } from "../../utils/format";
import "../../styles/court-detail.css";

// ─────────────────────────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────────────────────────
const fmtVnd = (n) => Number(n ?? 0).toLocaleString("vi-VN") + " ₫";

function isoToDisplay(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  const days = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
  const dow = days[d.getDay()];
  return `${dow}, ${d.getDate()}/${d.getMonth() + 1}`;
}

function secondsUntil(isoStr) {
  return Math.max(0, Math.floor((new Date(isoStr) - Date.now()) / 1000));
}
function formatCountdown(secs) {
  const m = String(Math.floor(secs / 60)).padStart(2, "0");
  const s = String(secs % 60).padStart(2, "0");
  return `${m}:${s}`;
}

// ─────────────────────────────────────────────────────────────────
//  COMPONENT
// ─────────────────────────────────────────────────────────────────
export default function BookingConfirmPage() {
  const { state } = useLocation();
  const navigate  = useNavigate();

  // Nếu truy cập trực tiếp không có state → về trang tìm sân
  if (!state?.courtId || !state?.playDate || !state?.timeSlotIds?.length) {
    return (
      <div className="cd-page">
        <div className="cd-state-center">
          <p className="cd-error-msg">Không có thông tin đặt sân. Vui lòng chọn lại.</p>
          <Link to="/courts" className="cd-btn-retry">Về trang tìm sân</Link>
        </div>
      </div>
    );
  }

  const { courtId, playDate, timeSlotIds, services = [] } = state;

  return <ConfirmFlow courtId={courtId} playDate={playDate} timeSlotIds={timeSlotIds} services={services} />;
}

// ─────────────────────────────────────────────────────────────────
//  Flow confirm → booked (tách riêng để tránh hooks trong if)
// ─────────────────────────────────────────────────────────────────
function ConfirmFlow({ courtId, playDate, timeSlotIds, services }) {
  const navigate = useNavigate();

  // ── Tính giá ──
  const [priceData, setPriceData]     = useState(null);
  const [priceStatus, setPriceStatus] = useState("loading");
  const [priceError, setPriceError]   = useState("");

  useEffect(() => {
    let cancelled = false;
    setPriceStatus("loading");
    calculatePrice({ court_id: courtId, play_date: playDate, time_slot_ids: timeSlotIds, services })
      .then((res) => { if (!cancelled) { setPriceData(res.data); setPriceStatus("ready"); } })
      .catch((err) => { if (!cancelled) { setPriceError(err.message || "Không tính được giá."); setPriceStatus("error"); } });
    return () => { cancelled = true; };
  }, [courtId, playDate, timeSlotIds]);

  // ── Đặt sân ──
  const [booking, setBooking]           = useState(null);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingError, setBookingError]   = useState("");

  // ── Đếm ngược ──
  const [countdown, setCountdown] = useState(0);
  const timerRef = useRef(null);

  useEffect(() => {
    if (!booking?.hold_expires_at) return;
    clearInterval(timerRef.current);
    setCountdown(secondsUntil(booking.hold_expires_at));
    timerRef.current = setInterval(() => {
      setCountdown(secondsUntil(booking.hold_expires_at));
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [booking]);

  const handleBook = async () => {
    setBookingLoading(true);
    setBookingError("");
    try {
      const res = await createBooking({
        court_id: courtId,
        play_date: playDate,
        time_slot_ids: timeSlotIds,
        services,
      });
      setBooking(res.data);
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

  // ── Render: loading giá ──
  if (priceStatus === "loading") {
    return (
      <div className="cd-page">
        <div className="cd-state-center"><div className="fc-spinner" /><p>Đang tính giá...</p></div>
      </div>
    );
  }

  // ── Render: lỗi tính giá ──
  if (priceStatus === "error") {
    return (
      <div className="cd-page">
        <div className="cd-state-center">
          <p className="cd-error-msg">{priceError}</p>
          <button className="cd-btn-retry" type="button" onClick={() => navigate(-1)}>← Quay lại</button>
        </div>
      </div>
    );
  }

  // ── Render: đã giữ chỗ thành công ──
  if (booking) {
    return (
      <div className="cd-page">
        <div className="cd-booking-area">
          <div className="cd-booked">
            <div className="cd-booked-icon">✓</div>
            <h2 className="cd-booked-title">Giữ chỗ thành công!</h2>
            <p className="cd-booked-sub">Vui lòng thanh toán cọc trước khi hết giờ</p>

            <div className="cd-booked-info">
              <div className="cd-confirm-row"><span>Mã đặt sân</span><strong>#{booking.booking_id}</strong></div>
              <div className="cd-confirm-row"><span>Sân</span><strong>{booking.court_name ?? priceData?.court_name}</strong></div>
              <div className="cd-confirm-row"><span>Ngày</span><strong>{isoToDisplay(booking.play_date)}</strong></div>
              <div className="cd-confirm-row"><span>Tiền cọc</span><strong>{fmtVnd(booking.deposit_amount_required)}</strong></div>
            </div>

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
                onClick={() => navigate(`/bookings/${booking.booking_id}/deposit`, { state: { booking, priceData } })}
              >
                Thanh toán cọc ngay
              </button>
              <button className="cd-btn-outline-sm" type="button" onClick={() => navigate("/courts")}>
                Về trang tìm sân
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Render: màn xác nhận ──
  return (
    <div className="cd-page">
      <div className="cd-breadcrumb">
        <button className="cd-back-link" style={{ background: "none", border: "none", cursor: "pointer" }} onClick={() => navigate(-1)}>
          ← Quay lại
        </button>
      </div>

      <div className="cd-booking-area">
        <h2 className="cd-section-title">Xác nhận đặt sân</h2>

        {/* Thông tin chung */}
        <div className="cd-confirm-meta">
          <div className="cd-confirm-row"><span>Sân</span><strong>{priceData.court_name}</strong></div>
          <div className="cd-confirm-row"><span>Cơ sở</span><strong>{priceData.facility_name}</strong></div>
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
          <span>Số dư ví: <strong>{fmtVnd(priceData.user_wallet_status.current_balance)}</strong></span>
          {priceData.user_wallet_status.is_balance_sufficient ? (
            <span className="cd-wallet-ok">Đủ số dư · Còn lại {fmtVnd(priceData.user_wallet_status.balance_after_deposit)}</span>
          ) : (
            <span className="cd-wallet-warn">Số dư không đủ để đặt cọc</span>
          )}
        </div>

        {/* Lỗi */}
        {bookingError && bookingError !== "SLOT_ALREADY_BOOKED" && (
          <p className="cd-booking-error">{bookingError}</p>
        )}
        {bookingError === "SLOT_ALREADY_BOOKED" && (
          <div className="cd-slot-conflict">
            <p>Có khung giờ vừa bị người khác đặt mất. Vui lòng chọn lại.</p>
            <button className="cd-btn-retry" type="button" onClick={() => navigate(-1)}>
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
      </div>
    </div>
  );
}
