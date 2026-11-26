import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { depositBooking } from "../../services/bookingService";
import { useUser } from "../../context/UserContext";
import { formatVnd } from "../../utils/format";
import Icon from "../../components/ui/Icon";

/* ── Helpers ──────────────────────────────────────────────────── */
function fmtDate(str) {
  if (!str) return "";
  const d = new Date(str + "T00:00:00");
  const WD = ["CN","T2","T3","T4","T5","T6","T7"];
  return `${WD[d.getDay()]}, ${d.getDate()}/${d.getMonth()+1}/${d.getFullYear()}`;
}
function secondsUntil(iso) {
  return Math.max(0, Math.floor((new Date(iso) - Date.now()) / 1000));
}
function fmtCountdown(s) {
  return `${String(Math.floor(s/60)).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`;
}

function Steps({ at }) {
  return (
    <ol className="steps" aria-label="Các bước">
      {["Xác nhận","Đặt cọc","Xong"].map((s,i) => (
        <li key={s} className={i <= at ? "on" : ""} aria-current={i===at?"step":undefined}>{s}</li>
      ))}
    </ol>
  );
}

/* ── Main ─────────────────────────────────────────────────────── */
export default function DepositPage() {
  const { id }      = useParams();
  const navigate    = useNavigate();
  const { state }   = useLocation();
  const { fetchUser } = useUser();

  const booking  = state?.booking;
  const priceData = state?.priceData;

  if (!booking) {
    return (
      <main className="page"><div className="wrap" style={{ maxWidth:560 }}>
        <div className="notice notice--danger">
          <Icon name="alert" size={16} />Không có thông tin đặt sân. Vui lòng đặt lại.
        </div>
        <Link className="link" to="/courts" style={{ marginTop:12, display:"inline-block" }}>
          ← Về trang tìm sân
        </Link>
      </div></main>
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

function DepositFlow({ bookingId, booking, priceData, navigate, fetchUser }) {
  /* Countdown */
  const [secs,    setSecs]    = useState(() => secondsUntil(booking.hold_expires_at));
  const timerRef = useRef(null);
  useEffect(() => {
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => setSecs(secondsUntil(booking.hold_expires_at)), 1000);
    return () => clearInterval(timerRef.current);
  }, [booking.hold_expires_at]);

  /* Đặt cọc */
  const [status, setStatus] = useState("idle");
  const [result, setResult] = useState(null);
  const [err,    setErr]    = useState("");

  const handleDeposit = useCallback(async () => {
    setStatus("loading"); setErr("");
    try {
      const r = await depositBooking(bookingId);
      setResult(r.data);
      setStatus("success");
      await fetchUser();
    } catch(e) {
      setErr(e.message || "Thanh toán cọc thất bại.");
      setStatus("error");
    }
  }, [bookingId, fetchUser]);

  const expired = secs === 0;
  const deposit = booking.deposit_amount_required;
  const total   = booking.total_amount;

  /* Thành công */
  if (status === "success" && result) {
    return (
      <main className="page"><div className="wrap" style={{ maxWidth:560 }}>
        <Steps at={2} />
        <div className="success">
          <div className="success__icon" aria-hidden="true">
            <svg viewBox="0 0 52 52">
              <circle className="sc-ring" cx="26" cy="26" r="24" />
              <path className="sc-check" d="M15.5 27l7 7 14-15" />
            </svg>
          </div>
          <h2 className="fade-in">Đã đặt cọc!</h2>
          <p className="muted">Lịch đặt sân đã được xác nhận</p>

          <div className="ticket" style={{ marginTop:24 }}>
            <div style={{ padding:"20px 24px" }}>
              <div className="row between">
                <span className="mono muted">#{result.booking_id}</span>
                <span className="badge badge--deposited">Đã cọc</span>
              </div>
              <h3 style={{ marginTop:8 }}>{priceData?.facility_name ?? "—"}</h3>
              <div className="small ink2" style={{ marginTop:4 }}>{priceData?.court_name}</div>
            </div>
            <div className="ticket__cut" />
            <div className="grid-2" style={{ padding:"20px 24px", gap:14 }}>
              <div><div className="small muted">Đã cọc</div><div className="mono" style={{ color:"var(--accent)" }}>{formatVnd(result.deposit_amount_paid)}</div></div>
              <div><div className="small muted">Trả tại sân</div><div className="mono">{formatVnd(result.remaining_amount_due_at_court)}</div></div>
              <div><div className="small muted">Số dư ví</div><div className="mono">{formatVnd(result.wallet_balance_remaining)}</div></div>
              <div><div className="small muted">Trạng thái</div><span className="badge badge--deposited">Đã đặt cọc</span></div>
            </div>
          </div>

          <div className="row" style={{ justifyContent:"center", marginTop:20, "--gap":"10px" }}>
            <button className="btn btn--primary" onClick={() => navigate("/")}>Về trang chủ</button>
            <button className="btn btn--ghost" onClick={() => navigate("/courts")}>Tìm sân khác</button>
          </div>
        </div>
      </div></main>
    );
  }

  /* Form đặt cọc */
  return (
    <main className="page"><div className="wrap" style={{ maxWidth:560 }}>
      <nav className="crumbs">
        <button className="link" style={{ background:"none", border:0, padding:0, cursor:"pointer" }}
          onClick={() => navigate(-1)}>← Quay lại</button>
        <span>·</span><span className="ink2">Thanh toán cọc</span>
      </nav>
      <Steps at={1} />

      <div className="card">
        {/* Thông tin đơn */}
        <dl className="kv" style={{ marginBottom:18 }}>
          <dt>Mã đặt sân</dt><dd className="mono">#{booking.booking_id}</dd>
          <dt>Sân</dt><dd>{booking.court_name ?? priceData?.court_name ?? "—"}</dd>
          {priceData?.facility_name && <><dt>Cơ sở</dt><dd>{priceData.facility_name}</dd></>}
          <dt>Ngày chơi</dt><dd>{fmtDate(booking.play_date)}</dd>
        </dl>

        {/* Bill */}
        <div className="bill-row">
          <span>Tổng tiền</span>
          <span className="num">{formatVnd(total)}</span>
        </div>
        <div className="bill-row">
          <span>Tiền cọc (30%)</span>
          <span className="num" style={{ color:"var(--accent)", fontWeight:600 }}>{formatVnd(deposit)}</span>
        </div>
        <div className="bill-row">
          <span>Thanh toán tại sân</span>
          <span className="num">{formatVnd(total - deposit)}</span>
        </div>

        {/* Deposit box */}
        <div className="deposit-box" style={{ marginTop:16 }}>
          <span>Cọc ngay</span>
          <b>{formatVnd(deposit)}</b>
        </div>

        {/* Countdown */}
        <div className={"timer" + (expired || secs <= 60 ? " urgent" : "")}
          style={{ margin:"16px 0", display:"inline-flex" }}>
          <i />
          {expired ? "Đã hết thời gian giữ chỗ" : `Hết hạn sau ${fmtCountdown(secs)}`}
        </div>

        {/* Lỗi */}
        {expired && (
          <div className="notice notice--danger">
            <Icon name="alert" size={16} />Thời gian giữ chỗ đã hết. Vui lòng đặt lại.
          </div>
        )}
        {status === "error" && err && (
          <div className="notice notice--danger" style={{ marginTop:8 }}>
            <Icon name="alert" size={16} />{err}
          </div>
        )}

        {/* Nút */}
        {!expired ? (
          <button className="btn btn--primary btn--block btn--lg" style={{ marginTop:16 }}
            onClick={handleDeposit} disabled={status === "loading"}>
            {status === "loading" ? "Đang xử lý…" : `Xác nhận đặt cọc ${formatVnd(deposit)}`}
          </button>
        ) : (
          <button className="btn btn--block" style={{ marginTop:16 }} onClick={() => navigate("/courts")}>
            Chọn lại sân
          </button>
        )}
      </div>
    </div></main>
  );
}
