import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { depositBooking } from "../../services/bookingService";
import { getBookingDetail } from "../../services/bookingService";
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
  const { fetchUser } = useUser();

  // ── Tải thông tin đơn ──
  const [booking, setBooking] = useState(null);
  const [loadStatus, setLoadStatus] = useState("loading"); // loading | ready | error
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoadStatus("loading");
    getBookingDetail(id)
      .then((res) => {
        if (cancelled) return;
        const b = res.data;
        // Chỉ cho phép đặt cọc khi đơn còn ở PENDING_DEPOSIT
        if (b.status !== "PENDING_DEPOSIT") {
          setLoadError(
            b.status === "DEPOSITED"
              ? "Đơn này đã được thanh toán cọc."
              : "Đơn này không còn ở trạng thái chờ cọc."
          );
          setLoadStatus("error");
        } else {
          setBooking(b);
          setLoadStatus("ready");
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setLoadError(err.message || "Không tải được thông tin đơn đặt sân.");
        setLoadStatus("error");
      });
    return () => { cancelled = true; };
  }, [id]);

  // ── Countdown giữ chỗ ──
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

  // ── Thanh toán cọc ──
  const [depositStatus, setDepositStatus] = useState("idle"); // idle | loading | success | error
  const [depositResult, setDepositResult] = useState(null);
  const [depositError, setDepositError] = useState("");

  const handleDeposit = useCallback(async () => {
    setDepositStatus("loading");
    setDepositError("");
    try {
      const res = await depositBooking(id);
      setDepositResult(res.data);
      setDepositStatus("success");
      // Cập nhật số dư ví trên navbar
      await fetchUser();
    } catch (err) {
      setDepositError(err.message || "Thanh toán cọc thất bại. Vui lòng thử lại.");
      setDepositStatus("error");
    }
  }, [id, fetchUser]);

  // ── Render: loading ──
  if (loadStatus === "loading") {
    return (
      <div className="cd-page">
        <div className="cd-state-center">
          <div className="fc-spinner" />
          <p>Đang tải thông tin đơn đặt sân...</p>
        </div>
      </div>
    );
  }

  // ── Render: lỗi tải ──
  if (loadStatus === "error") {
    return (
      <div className="cd-page">
        <div className="cd-state-center">
          <p className="cd-error-msg">{loadError}</p>
          <button className="cd-btn-retry" type="button" onClick={() => navigate("/courts")}>
            Về trang tìm sân
          </button>
        </div>
      </div>
    );
  }

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
  const isExpired = countdown === 0;

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
            <strong>#{booking.id}</strong>
          </div>
          <div className="cd-confirm-row">
            <span>Sân</span>
            <strong>{booking.court_name}</strong>
          </div>
          <div className="cd-confirm-row">
            <span>Cơ sở</span>
            <strong>{booking.facility_name}</strong>
          </div>
          <div className="cd-confirm-row">
            <span>Ngày chơi</span>
            <strong>{booking.play_date}</strong>
          </div>
        </div>

        {/* Bảng kê tiền */}
        <div className="cd-confirm-totals" style={{ marginBottom: 16 }}>
          <div className="cd-confirm-row" style={{ padding: "9px 14px" }}>
            <span>Tổng tiền</span>
            <span>{fmtVnd(booking.pricing_summary?.total_amount)}</span>
          </div>
          <div className="cd-confirm-row cd-confirm-row--deposit" style={{ padding: "9px 14px" }}>
            <span>Tiền cọc cần thanh toán (30%)</span>
            <strong>{fmtVnd(booking.pricing_summary?.deposit_amount)}</strong>
          </div>
          <div className="cd-confirm-row cd-confirm-row--remain" style={{ padding: "9px 14px" }}>
            <span>Còn lại thanh toán tại sân</span>
            <span>{fmtVnd(booking.pricing_summary?.remaining_amount_due_at_court)}</span>
          </div>
        </div>

        {/* Countdown */}
        <div className={`cd-countdown${isExpired || countdown <= 60 ? " urgent" : ""}`}
          style={{ marginBottom: 16 }}
        >
          <span className="cd-countdown-label">
            {isExpired ? "Đã hết thời gian giữ chỗ" : "Hết hạn sau"}
          </span>
          <span className="cd-countdown-value">
            {isExpired ? "00:00" : formatCountdown(countdown)}
          </span>
        </div>

        {/* Lỗi hết hạn hoặc thiếu tiền */}
        {isExpired && (
          <div className="cd-booking-error">
            Thời gian giữ chỗ đã hết. Vui lòng quay lại chọn sân và đặt lại.
          </div>
        )}
        {depositStatus === "error" && depositError && (
          <div className="cd-booking-error">{depositError}</div>
        )}

        {/* Nút đặt cọc */}
        {!isExpired && (
          <button
            className="cd-btn-book"
            type="button"
            onClick={handleDeposit}
            disabled={depositStatus === "loading"}
          >
            {depositStatus === "loading"
              ? "Đang xử lý..."
              : `Xác nhận đặt cọc ${fmtVnd(booking.pricing_summary?.deposit_amount)}`}
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
