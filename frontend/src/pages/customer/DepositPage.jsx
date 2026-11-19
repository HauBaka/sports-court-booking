import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate, useLocation, Link } from "react-router-dom";
import { depositBooking } from "../../services/bookingService";
import { useUser } from "../../context/UserContext";
import "../../styles/court-detail.css";

const fmtVnd = (n) => Number(n ?? 0).toLocaleString("vi-VN") + " ₫";

function secondsUntil(isoStr) {
  return Math.max(0, Math.floor((new Date(isoStr) - Date.now()) / 1000));
}
function formatCountdown(secs) {
  const m = String(Math.floor(secs / 60)).padStart(2, "0");
  const s = String(secs % 60).padStart(2, "0");
  return `${m}:${s}`;
}

export default function DepositPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { state } = useLocation();
  const { fetchUser } = useUser();

  // Dữ liệu đơn và giá truyền từ BookingConfirmPage qua navigate state
  const booking = state?.booking;    // response data từ POST /bookings (3.3)
  const priceData = state?.priceData; // response data từ POST /bookings/calculate-price (3.2)

  // Nếu truy cập trực tiếp không có state → yêu cầu đi qua flow đặt sân
  if (!booking) {
    return (
      <div className="cd-page">
        <div className="cd-state-center">
          <p className="cd-error-msg">Không có thông tin đặt sân. Vui lòng đặt lại từ đầu.</p>
          <Link to="/courts" className="cd-btn-retry">Về trang tìm sân</Link>
        </div>
      </div>
    );
  }

  return (
    <DepositFlow
      bookingId={Number(id)}
      booking={booking}
      priceData={priceData}
      navigate={navigate}
      fetchUser={fetchUser}
    />
  );
}

// Tách ra để tránh hooks trong conditional render
function DepositFlow({ bookingId, booking, priceData, navigate, fetchUser }) {
  // ── Countdown giữ chỗ ──
  const [countdown, setCountdown] = useState(() => secondsUntil(booking.hold_expires_at));
  const timerRef = useRef(null);

  useEffect(() => {
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setCountdown(secondsUntil(booking.hold_expires_at));
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [booking.hold_expires_at]);

  // ── Thanh toán cọc ──
  const [depositStatus, setDepositStatus] = useState("idle"); // idle | loading | success | error
  const [depositResult, setDepositResult] = useState(null);
  const [depositError, setDepositError] = useState("");

  const handleDeposit = useCallback(async () => {
    setDepositStatus("loading");
    setDepositError("");
    try {
      const res = await depositBooking(bookingId);
      setDepositResult(res.data);
      setDepositStatus("success");
      // Cập nhật số dư ví trên navbar
      await fetchUser();
    } catch (err) {
      setDepositError(err.message || "Thanh toán cọc thất bại. Vui lòng thử lại.");
      setDepositStatus("error");
    }
  }, [bookingId, fetchUser]);

  const isExpired = countdown === 0;

  // ── Render: đặt cọc thành công ──
  if (depositStatus === "success" && depositResult) {
    return (
      <div className="cd-page">
        <div className="cd-booking-area">
          <div className="cd-booked">
            <div className="cd-booked-icon">✓</div>
            <h2 className="cd-booked-title">Đặt cọc thành công!</h2>
            <p className="cd-booked-sub">Lịch đặt sân đã được xác nhận</p>

            <div className="cd-booked-info">
              <div className="cd-confirm-row">
                <span>Mã đặt sân</span>
                <strong>#{depositResult.booking_id}</strong>
              </div>
              <div className="cd-confirm-row">
                <span>Trạng thái</span>
                <strong style={{ color: "#15803d" }}>Đã đặt cọc</strong>
              </div>
              <div className="cd-confirm-row">
                <span>Tiền cọc đã thanh toán</span>
                <strong>{fmtVnd(depositResult.deposit_amount_paid)}</strong>
              </div>
              <div className="cd-confirm-row">
                <span>Còn thanh toán tại sân</span>
                <strong>{fmtVnd(depositResult.remaining_amount_due_at_court)}</strong>
              </div>
              <div className="cd-confirm-row">
                <span>Số dư ví hiện tại</span>
                <strong style={{ color: "#059669" }}>
                  {fmtVnd(depositResult.wallet_balance_remaining)}
                </strong>
              </div>
            </div>

            <div className="cd-booked-actions">
              <button
                className="cd-btn-book"
                type="button"
                onClick={() => navigate("/")}
              >
                Về trang chủ
              </button>
              <button
                className="cd-btn-outline-sm"
                type="button"
                onClick={() => navigate("/courts")}
              >
                Tìm sân khác
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Render: form đặt cọc ──
  const depositAmount = booking.deposit_amount_required;
  const totalAmount   = booking.total_amount;
  const remaining     = totalAmount - depositAmount;

  return (
    <div className="cd-page">
      <div className="cd-breadcrumb">
        <button
          className="cd-back-link"
          style={{ background: "none", border: "none", cursor: "pointer" }}
          type="button"
          onClick={() => navigate(-1)}
        >
          ← Quay lại
        </button>
      </div>

      <div className="cd-booking-area">
        <h2 className="cd-section-title">Thanh toán tiền cọc</h2>

        {/* Thông tin đơn */}
        <div className="cd-confirm-meta">
          <div className="cd-confirm-row">
            <span>Mã đặt sân</span>
            <strong>#{booking.booking_id}</strong>
          </div>
          <div className="cd-confirm-row">
            <span>Sân</span>
            <strong>{booking.court_name ?? priceData?.court_name}</strong>
          </div>
          {priceData?.facility_name && (
            <div className="cd-confirm-row">
              <span>Cơ sở</span>
              <strong>{priceData.facility_name}</strong>
            </div>
          )}
          <div className="cd-confirm-row">
            <span>Ngày chơi</span>
            <strong>{booking.play_date}</strong>
          </div>
        </div>

        {/* Bảng kê tiền */}
        <div className="cd-confirm-totals" style={{ marginBottom: 16 }}>
          <div className="cd-confirm-row" style={{ padding: "9px 14px" }}>
            <span>Tổng tiền</span>
            <span>{fmtVnd(totalAmount)}</span>
          </div>
          <div className="cd-confirm-row cd-confirm-row--deposit" style={{ padding: "9px 14px" }}>
            <span>Tiền cọc cần thanh toán (30%)</span>
            <strong>{fmtVnd(depositAmount)}</strong>
          </div>
          <div className="cd-confirm-row cd-confirm-row--remain" style={{ padding: "9px 14px" }}>
            <span>Còn lại thanh toán tại sân</span>
            <span>{fmtVnd(remaining)}</span>
          </div>
        </div>

        {/* Countdown */}
        <div
          className={`cd-countdown${isExpired || countdown <= 60 ? " urgent" : ""}`}
          style={{ marginBottom: 16 }}
        >
          <span className="cd-countdown-label">
            {isExpired ? "Đã hết thời gian giữ chỗ" : "Hết hạn sau"}
          </span>
          <span className="cd-countdown-value">
            {isExpired ? "00:00" : formatCountdown(countdown)}
          </span>
        </div>

        {/* Thông báo lỗi */}
        {isExpired && (
          <div className="cd-booking-error">
            Thời gian giữ chỗ đã hết. Vui lòng quay lại chọn sân và đặt lại.
          </div>
        )}
        {depositStatus === "error" && depositError && (
          <div className="cd-booking-error">{depositError}</div>
        )}

        {/* Nút đặt cọc — khóa khi đang xử lý hoặc đã hết hạn */}
        {!isExpired && (
          <button
            className="cd-btn-book"
            type="button"
            onClick={handleDeposit}
            disabled={depositStatus === "loading"}
          >
            {depositStatus === "loading"
              ? "Đang xử lý..."
              : `Xác nhận đặt cọc ${fmtVnd(depositAmount)}`}
          </button>
        )}

        {isExpired && (
          <button
            className="cd-btn-outline-sm"
            type="button"
            onClick={() => navigate("/courts")}
            style={{ width: "100%", marginTop: 8 }}
          >
            Chọn lại sân
          </button>
        )}
      </div>
    </div>
  );
}
