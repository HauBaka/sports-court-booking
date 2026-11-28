import { useEffect, useState } from "react";
import { getMyWallet, getMyTransactions } from "../services/walletService";
import { TX_TYPE_LABEL } from "../utils/wallet";
import { formatVnd } from "../utils/format";
import "../styles/wallet.css";

const LIMIT = 10;
const PREVIEW = 3; // mặc định chỉ hiện 3 giao dịch mới nhất

// Biểu tượng vẽ tay, cùng nét 1.8, cùng khung 20px
const ICON_PATHS = {
  TOPUP: "M12 5v14M5 12h14",
  DEPOSIT: "M7 11V8a5 5 0 0 1 10 0v3M6 11h12v9H6z",
  REFUND: "M9 14 4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3",
  FORFEIT: "M12 3 2.5 20h19zM12 10v5M12 18h.01",
  SETTLE: "m5 12 5 5 9-10",
};

function Icon({ d, size = 20 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={d} />
    </svg>
  );
}

const WALLET_ICON = "M3 7a2 2 0 0 1 2-2h13v4M3 7v11a2 2 0 0 0 2 2h14a1 1 0 0 0 1-1v-9a1 1 0 0 0-1-1H5a2 2 0 0 1-2-2zM16 14h.01";

const formatDateTime = (iso) =>
  new Date(iso).toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

export default function WalletPage() {
  const [wallet, setWallet] = useState(null);
  const [type, setType] = useState("");
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState(false);
  const [state, setState] = useState({ status: "loading", items: [], meta: null, error: "" });
  const [reloadKey, setReloadKey] = useState(0);

  // Số dư: tải 1 lần
  useEffect(() => {
    getMyWallet().then((res) => setWallet(res.data)).catch(() => {});
  }, [reloadKey]);

  // Lịch sử: tải lại khi đổi loại hoặc đổi trang
  useEffect(() => {
    let cancelled = false;
    setState((s) => ({ ...s, status: "loading" }));
    getMyTransactions({ type, page, limit: LIMIT })
      .then((res) => {
        if (!cancelled) setState({ status: "ready", items: res.data, meta: res.meta, error: "" });
      })
      .catch((err) => {
        if (!cancelled)
          setState({ status: "error", items: [], meta: null, error: err.message || "Không tải được lịch sử." });
      });
    return () => { cancelled = true; };
  }, [type, page, reloadKey]);

  const chooseType = (value) => {
    setType(value);
    setPage(1); // đổi bộ lọc thì quay về trang 1
    setExpanded(false);
  };

  const { status, items, meta, error } = state;
  const collapsed = items.length > PREVIEW && !expanded;
  const visible = collapsed ? items.slice(0, PREVIEW) : items;
  const chips = [["", "Tất cả"], ...Object.entries(TX_TYPE_LABEL)];

  return (
    <div className="wallet-page">
      <div className="wallet-head">
        <h1>Ví của tôi</h1>
        <p>Số dư và lịch sử giao dịch của bạn.</p>
      </div>

      <section className="balance-card" aria-label="Số dư ví">
        <div>
          <div className="balance-label"><span className="dot" />Số dư hiện tại</div>
          <div className="balance-amount">{wallet ? formatVnd(wallet.balance) : "—"}</div>
          <p className="balance-note">Dùng để đặt cọc sân và nhận hoàn cọc.</p>
        </div>
        <div className="balance-icon"><Icon d={WALLET_ICON} size={26} /></div>
      </section>

      <section className="history-card" aria-label="Lịch sử giao dịch">
        <div className="history-head">
          <h2>Lịch sử giao dịch</h2>
          {status === "ready" && meta && <span className="history-total">{meta.total} giao dịch</span>}
        </div>

        <div className="filter-chips" role="group" aria-label="Lọc theo loại giao dịch">
          {chips.map(([value, label]) => (
            <button
              key={value || "all"}
              type="button"
              className="chip"
              aria-pressed={type === value}
              onClick={() => chooseType(value)}
            >
              {label}
            </button>
          ))}
        </div>

        {status === "loading" && <p className="wallet-state" aria-busy="true">Đang tải...</p>}

        {status === "error" && (
          <div className="wallet-state">
            <p className="wallet-error" role="alert">{error}</p>
            <button className="wallet-retry" type="button" onClick={() => setReloadKey((k) => k + 1)}>
              Thử lại
            </button>
          </div>
        )}

        {status === "ready" && items.length === 0 && (
          <p className="wallet-state">Chưa có giao dịch nào.</p>
        )}

        {status === "ready" && items.length > 0 && (
          <>
            <ul className="tx-list">
              {visible.map((t) => (
                <li key={t.id} className="tx-row">
                  <span className={`tx-icon ${t.type}`}>
                    <Icon d={ICON_PATHS[t.type] ?? ICON_PATHS.TOPUP} />
                  </span>
                  <div className="tx-main">
                    <div className="tx-type">{TX_TYPE_LABEL[t.type] ?? t.type}</div>
                    <div className="tx-meta">
                      {formatDateTime(t.created_at)}
                      {t.related_booking_id != null && <> · Đơn #{t.related_booking_id}</>}
                    </div>
                  </div>
                  <div className="tx-money">
                    <div className="tx-amount">{formatVnd(t.amount)}</div>
                    <div className="tx-after">Số dư sau: {formatVnd(t.balance_after)}</div>
                  </div>
                </li>
              ))}
            </ul>

            {collapsed && (
              <div className="pager">
                <button type="button" onClick={() => setExpanded(true)}>
                  Xem thêm ({meta.total - PREVIEW})
                </button>
              </div>
            )}

            {!collapsed && meta.total_pages > 1 && (
              <div className="pager">
                <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Trước</button>
                <span>Trang {meta.page} / {meta.total_pages}</span>
                <button type="button" disabled={page >= meta.total_pages} onClick={() => setPage((p) => p + 1)}>Sau</button>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
