import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useUser } from "../context/UserContext";
import { getMyWallet, getMyTransactions } from "../services/walletService";
import { listBookings } from "../services/bookingService";
import Icon from "../components/ui/Icon";
import StatusBadge from "../components/ui/StatusBadge";

const ROLE_LABEL = {
  customer: "Khách hàng",
  owner:    "Chủ sân",
  admin:    "Quản trị viên",
};

/** Chữ viết tắt từ tên — "Nguyễn Minh" → "NM" */
function initials(name = "") {
  return name.split(" ").filter(Boolean).slice(-2).map((w) => w[0].toUpperCase()).join("");
}

/** Format "2026-11-25T08:49:00" → "T4 25/11 · 08:49" */
function fmtDateTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const WD = ["CN","T2","T3","T4","T5","T6","T7"];
  const dow = WD[d.getDay()];
  const dd  = String(d.getDate()).padStart(2,"0");
  const mm  = String(d.getMonth()+1).padStart(2,"0");
  const hh  = String(d.getHours()).padStart(2,"0");
  const min = String(d.getMinutes()).padStart(2,"0");
  return `${dow} ${dd}/${mm} · ${hh}:${min}`;
}

/** Format "T4 2/9" từ ISO date string */
function fmtJoinDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const WD = ["CN","T2","T3","T4","T5","T6","T7"];
  return `${WD[d.getDay()]} ${d.getDate()}/${d.getMonth()+1}`;
}

/** Format số dư ngắn gọn */
function fmtBal(n) {
  return Number(n ?? 0).toLocaleString("vi-VN") + "đ";
}

/** Format số tiền có dấu */
function fmtSigned(n) {
  return (n >= 0 ? "+" : "−") + Math.abs(n).toLocaleString("vi-VN") + "đ";
}

/** Format khung giờ từ booking: "18:00–19:00" */
function fmtSlots(slots = []) {
  if (!slots.length) return "";
  const times = slots.map((s) => s.start_time?.slice(0,5)).filter(Boolean).sort();
  const last  = slots.map((s) => s.end_time?.slice(0,5)).filter(Boolean).sort().pop();
  return times[0] && last ? `${times[0]}–${last}` : "";
}

export default function ProfilePage() {
  const { user, loading: userLoading } = useUser();

  const [wallet,   setWallet]   = useState(null);
  const [recentTx, setRecentTx] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [totalBk,  setTotalBk]  = useState(null);

  useEffect(() => {
    if (!user) return;
    getMyWallet().then((r) => setWallet(r.data)).catch(() => {});
    getMyTransactions({ page: 1, limit: 3 }).then((r) => setRecentTx(r.data ?? [])).catch(() => {});
    listBookings({ page: 1, limit: 3, sort: "desc" })
      .then((r) => { setBookings(r.data ?? []); setTotalBk(r.meta?.total ?? null); })
      .catch(() => {});
  }, [user]);

  if (userLoading) return (
    <main className="page"><div className="wrap">
      <div className="skel" style={{ width: 200, height: 20, marginTop: 32 }} />
    </div></main>
  );
  if (!user) return (
    <main className="page"><div className="wrap">
      <p className="muted">Bạn chưa đăng nhập.</p>
    </div></main>
  );

  return (
    <main className="page">
      <div className="wrap">
        <div className="prof">

          {/* ── Cột trái: thông tin cá nhân ── */}
          <section className="card prof__card">
            {/* Avatar + tên + badge */}
            <div className="row" style={{ "--gap": "16px", marginBottom: 20 }}>
              <span className="avatar avatar--lg">{initials(user.name)}</span>
              <div>
                <h1 style={{ fontSize: 28, fontWeight: 500 }}>{user.name}</h1>
                <div className="row" style={{ "--gap": "10px", marginTop: 6 }}>
                  <span className="badge badge--deposited">{ROLE_LABEL[user.role] ?? user.role}</span>
                  {user.created_at && (
                    <span className="muted small">Tham gia {fmtJoinDate(user.created_at)}</span>
                  )}
                </div>
              </div>
            </div>

            <hr className="divider" />

            {/* Thông tin dạng key-value */}
            <dl className="kv" style={{ gridTemplateColumns: "140px 1fr", rowGap: 14 }}>
              <dt>Email</dt>
              <dd style={{ textAlign: "left" }}>{user.email}</dd>
              <dt>Số điện thoại</dt>
              <dd style={{ textAlign: "left" }} className="mono">{user.phone || "—"}</dd>
              {totalBk != null && (
                <>
                  <dt>Số đơn đã đặt</dt>
                  <dd style={{ textAlign: "left" }}>{totalBk}</dd>
                </>
              )}
            </dl>

            <hr className="divider" />

            <div className="row" style={{ "--gap": "10px" }}>
              <button className="btn" disabled style={{ opacity: 0.5, cursor: "not-allowed" }}>
                Lịch đặt
              </button>
            </div>
          </section>

          {/* ── Cột phải ── */}
          <div className="prof__side">

            {/* Card ví */}
            <section className="card">
              <div className="row between" style={{ marginBottom: 8 }}>
                <span className="small muted">Số dư ví</span>
                <Link className="link small" to="/wallet">Xem ví</Link>
              </div>

              <div className="wallet__bal mono" style={{ marginBottom: 14 }}>
                {wallet ? fmtBal(wallet.balance) : "—"}
              </div>

              {/* 3 giao dịch gần nhất */}
              {recentTx.map((t) => (
                <div key={t.id} className="bill-row">
                  <span>
                    {t.description ?? (t.related_booking_id ? `Cọc đơn SC-${t.related_booking_id}` : "Giao dịch")}
                    <small className="mono" style={{ display: "block", color: "var(--muted)", fontSize: 12, marginTop: 2 }}>
                      {fmtDateTime(t.created_at)}
                    </small>
                  </span>
                  <span className={"num " + (t.amount > 0 ? "amount-in" : "amount-out")}>
                    {fmtSigned(t.amount)}
                  </span>
                </div>
              ))}
            </section>

            {/* Card đơn gần đây */}
            {bookings.length > 0 && (
              <section className="card">
                <div className="row between" style={{ marginBottom: 14 }}>
                  <h3 style={{ fontSize: 16, fontWeight: 500 }}>Đơn gần đây</h3>
                  <Link className="link small" to="/wallet">Tất cả</Link>
                </div>

                {bookings.map((b) => {
                  const slots   = b.booking_slots ?? [];
                  const timeStr = fmtSlots(slots);
                  const dateStr = b.play_date
                    ? (() => {
                        const d = new Date(b.play_date + "T00:00:00");
                        const WD = ["CN","T2","T3","T4","T5","T6","T7"];
                        return `${WD[d.getDay()]} ${d.getDate()}/${d.getMonth()+1}`;
                      })()
                    : "";
                  return (
                    <div key={b.id} className="bill-row" style={{ alignItems: "center" }}>
                      <span>
                        <div style={{ fontWeight: 500, fontSize: 14 }}>
                          {b.facility_name ?? b.court_name ?? `Đơn #${b.id}`}
                        </div>
                        <small className="muted" style={{ fontSize: 12 }}>
                          {[dateStr, timeStr].filter(Boolean).join(" · ")}
                        </small>
                      </span>
                      <StatusBadge status={b.status} />
                    </div>
                  );
                })}
              </section>
            )}
          </div>

        </div>
      </div>
    </main>
  );
}
