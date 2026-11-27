import { useEffect, useState } from "react";
import { getMyWallet, getMyTransactions } from "../services/walletService";
import { TX_TYPE_LABEL } from "../utils/wallet";
import { formatVnd } from "../utils/format";
import Icon from "../components/ui/Icon";

const LIMIT = 10;

/** Chip lọc loại giao dịch */
const FILTER_CHIPS = [
  ["",         "Tất cả"],
  ["TOPUP",    "Nạp tiền"],
  ["DEPOSIT",  "Đặt cọc"],
  ["REFUND",   "Hoàn cọc"],
  ["FORFEIT",  "Bồi thường"],
  ["SETTLE",   "Quyết toán"],
];

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

/** Format số âm/dương "+1.000.000đ" */
function fmtSigned(n) {
  const abs = Math.abs(n).toLocaleString("vi-VN");
  return (n >= 0 ? "+" : "−") + abs + "đ";
}

/** Format số dư: "183.800 ₫" */
function fmtBalance(n) {
  return n.toLocaleString("vi-VN") + " ₫";
}

export default function WalletPage() {
  /* ── Số dư ── */
  const [wallet,  setWallet]  = useState(null);

  /* ── Giao dịch ── */
  const [type,    setType]    = useState("");
  const [page,    setPage]    = useState(1);
  const [txState, setTxState] = useState({ status: "loading", items: [], meta: null, error: "" });
  const [reload,  setReload]  = useState(0);

  /* Tải số dư */
  useEffect(() => {
    getMyWallet().then((r) => setWallet(r.data)).catch(() => {});
  }, [reload]);

  /* Tải danh sách phân trang theo bộ lọc */
  useEffect(() => {
    let cancelled = false;
    setTxState((s) => ({ ...s, status: "loading" }));
    getMyTransactions({ type, page, limit: LIMIT })
      .then((r) => {
        if (!cancelled)
          setTxState({ status: "ready", items: r.data ?? [], meta: r.meta, error: "" });
      })
      .catch((e) => {
        if (!cancelled)
          setTxState({ status: "error", items: [], meta: null, error: e.message || "Không tải được lịch sử." });
      });
    return () => { cancelled = true; };
  }, [type, page, reload]);

  const changeType = (t) => { setType(t); setPage(1); };

  const { status, items, meta, error } = txState;

  /* ── "Xem thêm" trên 1 trang ── */
  const [expanded, setExpanded] = useState(false);

  // Reset expanded khi items thay đổi
  useEffect(() => { setExpanded(false); }, [items]);

  const visibleItems = expanded ? items : items.slice(0, 3);
  const hiddenCount  = items.length - 3;
  const showSeeMore  = !expanded && hiddenCount > 0;

  // Phân trang chỉ hiện sau khi đã expand (hoặc items <= 3)
  const showPager = expanded || items.length <= 3;

  return (
    <main className="page">
      <div className="wrap">
        <div className="page-head">
          <h1>Ví của tôi</h1>
        </div>

        <div className="wallet">
          {/* ── Cột trái: số dư ── */}
          <section className="card wallet__board">
            <div className="wallet__top">
              <div>
                <div className="wallet__label">Số dư hiện tại</div>
                <div
                  className="wallet__bal mono"
                  aria-label="Số dư ví"
                >
                  {wallet ? fmtBalance(wallet.balance) : "—"}
                </div>
              </div>
              <div className="wallet__mini">
                <div>
                  <div className="wallet__label">Đã đặt cọc</div>
                  <div className="mono">{formatVnd(0)}</div>
                </div>
                <div>
                  <div className="wallet__label">Được hoàn lại</div>
                  <div className="mono">{formatVnd(0)}</div>
                </div>
              </div>
            </div>
          </section>

          {/* ── Cột phải: danh sách giao dịch ── */}
          <section className="card wallet__list" aria-label="Giao dịch">
            <div className="row between" style={{ marginBottom: 12 }}>
              <h2>Giao dịch</h2>
              <div
                className="seg seg--scroll"
                role="group"
                aria-label="Lọc theo loại giao dịch"
              >
                {FILTER_CHIPS.map(([v, l]) => (
                  <button
                    key={v || "all"}
                    type="button"
                    className={type === v ? "on" : ""}
                    onClick={() => changeType(v)}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </div>

            {/* Trạng thái loading */}
            {status === "loading" && (
              <div className="stack" style={{ "--gap": "0px" }} aria-hidden="true">
                {[1,2,3,4,5,6].map((i) => (
                  <div key={i} className="skel-row">
                    <div className="skel skel-line" />
                    <div className="skel skel-line" style={{ width:"80%" }} />
                    <div className="skel skel-line" style={{ width:"60%" }} />
                    <div className="skel skel-line" style={{ width:"70%", justifySelf:"end" }} />
                  </div>
                ))}
              </div>
            )}

            {/* Trạng thái lỗi */}
            {status === "error" && (
              <div className="notice notice--danger">
                <Icon name="alert" size={16} />{error}
                <button
                  className="btn btn--sm btn--ghost"
                  style={{ marginLeft:"auto" }}
                  onClick={() => setReload((k) => k+1)}
                >
                  Thử lại
                </button>
              </div>
            )}

            {/* Trạng thái trống */}
            {status === "ready" && items.length === 0 && (
              <div className="empty">
                <p>Chưa có giao dịch nào.</p>
              </div>
            )}

            {/* Danh sách giao dịch */}
            {status === "ready" && items.length > 0 && (
              <>
                <ul className="txl">
                  {visibleItems.map((t) => (
                    <li key={t.id}>
                      <i className={t.amount > 0 ? "in" : "out"} aria-hidden="true">
                        {t.amount > 0 ? "+" : "−"}
                      </i>
                      <div className="txl__main">
                        <div>
                          {t.description ?? TX_TYPE_LABEL[t.type] ?? t.type}
                          {t.related_booking_id != null && (
                            <span className="mono muted" style={{ fontSize:12, marginLeft:6 }}>
                              · Đơn #{t.related_booking_id}
                            </span>
                          )}
                        </div>
                        <div className="small muted">
                          <span className="mono">{fmtDateTime(t.created_at)}</span>
                          {" · "}{TX_TYPE_LABEL[t.type] ?? t.type}
                          {" · "}<span className="mono">{t.id}</span>
                        </div>
                      </div>
                      <b className={"mono " + (t.amount > 0 ? "amount-in" : "amount-out")}>
                        {fmtSigned(t.amount)}
                      </b>
                    </li>
                  ))}
                </ul>

                {/* Nút Xem thêm */}
                {showSeeMore && (
                  <button
                    type="button"
                    className="btn btn--ghost"
                    style={{ width:"100%", marginTop:8 }}
                    onClick={() => setExpanded(true)}
                  >
                    Xem thêm ({hiddenCount})
                  </button>
                )}

                {/* Phân trang — chỉ hiện sau khi đã expand */}
                {showPager && meta && meta.total_pages > 1 && (
                  <nav className="pager" aria-label="Phân trang giao dịch" style={{ marginTop:12 }}>
                    <span className="pager__count mono">
                      Trang {page} / {meta.total_pages}
                    </span>
                    <button
                      className="pager__btn"
                      disabled={page <= 1}
                      onClick={() => setPage((p) => p-1)}
                    >
                      Trước
                    </button>
                    <button
                      className="pager__btn"
                      disabled={page >= meta.total_pages}
                      onClick={() => setPage((p) => p+1)}
                    >
                      Sau
                    </button>
                  </nav>
                )}
              </>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
