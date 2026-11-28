import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { calculatePrice, createBooking } from "../../services/bookingService";
import { formatTime, formatVnd } from "../../utils/format";
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

/* ── Steps indicator ──────────────────────────────────────────── */
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
export default function BookingConfirmPage() {
  const { state } = useLocation();
  const navigate  = useNavigate();

  if (!state?.courtId || !state?.playDate || !state?.timeSlotIds?.length) {
    return (
      <main className="page"><div className="wrap" style={{ maxWidth:560 }}>
        <div className="notice notice--danger">
          <Icon name="alert" size={16} />Không có thông tin đặt sân.
        </div>
        <Link className="link" to="/courts" style={{ marginTop:12, display:"inline-block" }}>
          ← Về trang tìm sân
        </Link>
      </div></main>
    );
  }

  const { courtId, playDate, timeSlotIds, services = [] } = state;
  return <ConfirmFlow {...{ courtId, playDate, timeSlotIds, services, navigate }} />;
}

function ConfirmFlow({ courtId, playDate, timeSlotIds, services, navigate }) {
  /* Tính giá */
  const [price,       setPrice]       = useState(null);
  const [priceStatus, setPriceStatus] = useState("loading");
  const [priceErr,    setPriceErr]    = useState("");

  useEffect(() => {
    let c = false;
    calculatePrice({ court_id:courtId, play_date:playDate, time_slot_ids:timeSlotIds, services })
      .then((r) => { if(!c){ setPrice(r.data); setPriceStatus("ready"); } })
      .catch((e) => { if(!c){ setPriceErr(e.message||"Không tính được giá."); setPriceStatus("error"); } });
    return () => { c=true; };
  }, [courtId, playDate, timeSlotIds]);

  /* Đặt sân */
  const [booking,     setBooking]     = useState(null);
  const [bookLoading, setBookLoading] = useState(false);
  const [bookErr,     setBookErr]     = useState("");

  /* Countdown */
  const [secs,    setSecs]    = useState(0);
  const timerRef = useRef(null);
  useEffect(() => {
    if (!booking?.hold_expires_at) return;
    clearInterval(timerRef.current);
    setSecs(secondsUntil(booking.hold_expires_at));
    timerRef.current = setInterval(() => setSecs(secondsUntil(booking.hold_expires_at)), 1000);
    return () => clearInterval(timerRef.current);
  }, [booking]);

  const handleBook = async () => {
    setBookLoading(true); setBookErr("");
    try {
      const r = await createBooking({ court_id:courtId, play_date:playDate, time_slot_ids:timeSlotIds, services });
      setBooking(r.data);
    } catch(e) {
      setBookErr(e.code === "SLOT_ALREADY_BOOKED"
        ? "SLOT_CONFLICT"
        : e.message || "Đặt sân thất bại.");
    } finally { setBookLoading(false); }
  };

  /* Guards */
  if (priceStatus === "loading") return (
    <main className="page"><div className="wrap" style={{ maxWidth:560 }}>
      <div className="skel" style={{ height:300, borderRadius:16 }} />
    </div></main>
  );
  if (priceStatus === "error") return (
    <main className="page"><div className="wrap" style={{ maxWidth:560 }}>
      <div className="notice notice--danger"><Icon name="alert" size={16} />{priceErr}</div>
      <button className="btn btn--ghost" style={{ marginTop:12 }} onClick={() => navigate(-1)}>← Quay lại</button>
    </div></main>
  );

  const p  = price;
  const ps = p.pricing_summary;
  const dp = p.deposit_policy;
  const ws = p.user_wallet_status;

  /* Đã giữ chỗ thành công */
  if (booking) {
    return (
      <main className="page"><div className="wrap" style={{ maxWidth:560 }}>
        <Steps at={1} />
        <div className="card" style={{ textAlign:"center", padding:"32px 24px" }}>
          <div className="success__icon" style={{ margin:"0 auto 20px" }} aria-hidden="true">
            <svg viewBox="0 0 52 52">
              <circle className="sc-ring" cx="26" cy="26" r="24" />
              <path className="sc-check" d="M15.5 27l7 7 14-15" />
            </svg>
          </div>
          <h2>Giữ chỗ thành công!</h2>
          <p className="muted" style={{ marginTop:6 }}>Thanh toán cọc trước khi hết giờ</p>

          <dl className="kv" style={{ marginTop:20, textAlign:"left" }}>
            <dt>Mã đặt sân</dt><dd className="mono">#{booking.booking_id}</dd>
            <dt>Sân</dt><dd>{booking.court_name ?? p.court_name}</dd>
            <dt>Ngày</dt><dd>{fmtDate(booking.play_date)}</dd>
            <dt>Tiền cọc</dt><dd className="mono">{formatVnd(booking.deposit_amount_required)}</dd>
          </dl>

          {/* Countdown */}
          <div className={"timer" + (secs <= 60 ? " urgent" : "")} style={{ margin:"20px auto", display:"inline-flex" }}>
            <i />{secs === 0 ? "Đã hết giờ" : `Hết hạn sau ${fmtCountdown(secs)}`}
          </div>

          <div className="row" style={{ "--gap":"10px", justifyContent:"center", marginTop:16 }}>
            <button className="btn btn--primary" disabled={secs === 0}
              onClick={() => navigate(`/bookings/${booking.booking_id}/deposit`, { state:{ booking, priceData:price } })}>
              Thanh toán cọc ngay
            </button>
            <button className="btn btn--ghost" onClick={() => navigate("/courts")}>Về tìm sân</button>
          </div>
        </div>
      </div></main>
    );
  }

  /* Màn xác nhận */
  return (
    <main className="page"><div className="wrap" style={{ maxWidth:560 }}>
      <nav className="crumbs">
        <button className="link" style={{ background:"none", border:0, padding:0, cursor:"pointer" }}
          onClick={() => navigate(-1)}>← Quay lại</button>
        <span>·</span><span className="ink2">Xác nhận đặt sân</span>
      </nav>
      <Steps at={0} />

      <div className="card">
        {/* Thông tin */}
        <div className="row" style={{ "--gap":"14px", marginBottom:18 }}>
          <div>
            <div style={{ fontWeight:500 }}>{p.facility_name}</div>
            <div className="small muted">{p.court_name} · {fmtDate(p.play_date)} · <span className="mono">{p.time_range}</span></div>
          </div>
        </div>

        {/* Chi tiết từng slot */}
        {p.slots_breakdown.map((s) => (
          <div key={s.time_slot_id} className="bill-row">
            <span>
              {formatTime(s.start_time)}–{formatTime(s.end_time)}
              <small>{s.applied_rule}{s.multiplier!==1 && ` × ${s.multiplier.toFixed(2)}`}</small>
            </span>
            <span className="num">{formatVnd(s.final_price)}</span>
          </div>
        ))}

        {/* Tổng */}
        <div className="bill-total" style={{ marginTop:8 }}>
          <span className="muted">Tổng tiền</span>
          <b>{formatVnd(ps.grand_total_amount)}</b>
        </div>

        <dl className="kv small" style={{ marginTop:10 }}>
          <dt>Cọc {dp.deposit_percentage}% từ ví</dt>
          <dd className="num">{formatVnd(dp.deposit_amount_required)}</dd>
          <dt>Trả tại sân</dt>
          <dd className="num">{formatVnd(dp.remaining_amount_due_at_court)}</dd>
        </dl>

        <hr className="divider" />

        {/* Trạng thái ví */}
        <div className={"notice" + (ws.is_balance_sufficient ? " notice--ok" : " notice--warn")}>
          <Icon name="wallet" size={16} />
          <span>
            Số dư ví: <b className="mono">{formatVnd(ws.current_balance)}</b>
            {ws.is_balance_sufficient
              ? ` · Còn lại ${formatVnd(ws.balance_after_deposit)}`
              : " · Không đủ để đặt cọc"}
          </span>
        </div>

        {/* Lỗi */}
        {bookErr === "SLOT_CONFLICT" && (
          <div className="notice notice--danger" style={{ marginTop:12 }}>
            <Icon name="alert" size={16} />Khung giờ vừa bị đặt mất. Vui lòng chọn lại.
            <button className="link small" style={{ marginLeft:"auto" }} onClick={() => navigate(-1)}>Quay lại</button>
          </div>
        )}
        {bookErr && bookErr !== "SLOT_CONFLICT" && (
          <div className="notice notice--danger" style={{ marginTop:12 }}>
            <Icon name="alert" size={16} />{bookErr}
          </div>
        )}

        {/* Nút đặt */}
        <button className="btn btn--primary btn--block btn--lg" style={{ marginTop:16 }}
          onClick={handleBook}
          disabled={bookLoading || !ws.is_balance_sufficient}>
          {bookLoading ? "Đang đặt…" : `Đặt cọc ${formatVnd(dp.deposit_amount_required)}`}
        </button>
        <p className="muted small" style={{ textAlign:"center", marginTop:8 }}>
          Hủy trước 24 giờ hoàn 80% cọc, 12–24 giờ hoàn 50%, dưới 12 giờ không hoàn.
        </p>
      </div>
    </div></main>
  );
}
