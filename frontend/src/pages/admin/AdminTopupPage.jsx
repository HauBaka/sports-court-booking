import { useEffect, useState } from "react";
import { searchUsers, topupWallet } from "../../services/adminService";
import { formatVnd } from "../../utils/format";
import "../../styles/wallet.css";
import "../../styles/admin.css";

const LIMIT = 10;
const MAX_REASON = 500; // khớp giới hạn của backend
const MAX_DIGITS = 12; // chặn gõ quá dài, tránh số vượt giới hạn an toàn
const QUICK_AMOUNTS = [50000, 100000, 500000];

const ROLE_LABEL = {
  customer: "Khách hàng",
  owner: "Chủ sân",
  admin: "Quản trị viên",
};

export default function AdminTopupPage() {
  // ── Tìm người dùng ──
  const [keyword, setKeyword] = useState(""); // ô đang gõ
  const [query, setQuery] = useState(""); // từ khóa đã bấm Tìm
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);
  const [list, setList] = useState({ status: "loading", items: [], meta: null, error: "" });

  // ── Cấp tiền ──
  const [selected, setSelected] = useState(null);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [step, setStep] = useState("form"); // form | confirm | sending
  const [error, setError] = useState("");
  const [done, setDone] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setList((l) => ({ ...l, status: "loading" }));
    searchUsers({ search: query, page, limit: LIMIT })
      .then((res) => {
        if (!cancelled) setList({ status: "ready", items: res.data, meta: res.meta, error: "" });
      })
      .catch((err) => {
        if (!cancelled)
          setList({ status: "error", items: [], meta: null, error: err.message || "Không tải được danh sách." });
      });
    return () => { cancelled = true; };
  }, [query, page, reloadKey]);

  const onSearch = (e) => {
    e.preventDefault();
    setPage(1);
    setQuery(keyword.trim());
  };

  const selectUser = (user) => {
    setSelected(user);
    setAmount("");
    setReason("");
    setStep("form");
    setError("");
    setDone(null);
  };

  const onAmountChange = (e) => {
    // chỉ nhận chữ số
    setAmount(e.target.value.replace(/\D/g, "").slice(0, MAX_DIGITS));
  };

  const amountNumber = Number(amount);
  const amountOk = amount !== "" && Number.isSafeInteger(amountNumber) && amountNumber > 0;
  const reasonTrimmed = reason.trim();
  const reasonOk = reasonTrimmed.length > 0 && reasonTrimmed.length <= MAX_REASON;
  const canSubmit = Boolean(selected) && amountOk && reasonOk;

  const onSubmit = (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    setError("");
    setStep("confirm");
  };

  const onConfirm = async () => {
    if (!canSubmit || step === "sending") return;
    setStep("sending");
    setError("");
    try {
      const res = await topupWallet({
        user_id: selected.id,
        amount: amountNumber,
        reason: reasonTrimmed,
      });
      const newBalance = res.data.new_balance;
      setList((l) => ({
        ...l,
        items: l.items.map((u) => (u.id === selected.id ? { ...u, balance: newBalance } : u)),
      }));
      setSelected((s) => ({ ...s, balance: newBalance }));
      setDone({ name: selected.name, amount: res.data.granted_amount, balance: newBalance });
      setAmount("");
      setReason("");
      setStep("form");
    } catch (err) {
      setError(err.message || "Không cấp được tiền. Vui lòng thử lại.");
      setStep("form");
    }
  };

  const { status, items, meta, error: listError } = list;
  const sending = step === "sending";

  return (
    <div className="wallet-page admin-page">
      <div className="wallet-head">
        <h1>Cấp tiền vào ví</h1>
        <p>Tìm người dùng, nhập số tiền và lý do để cấp số dư trải nghiệm.</p>
      </div>

      <div className="admin-grid">
        {/* ── Cột trái: tìm và chọn người dùng ── */}
        <section className="history-card" aria-label="Danh sách người dùng">
          <form className="admin-search" role="search" onSubmit={onSearch}>
            <input
              type="search"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="Tìm theo tên, email hoặc số điện thoại"
              aria-label="Tìm người dùng"
            />
            <button type="submit" className="wallet-retry">Tìm</button>
          </form>

          {status === "loading" && <p className="wallet-state" aria-busy="true">Đang tải...</p>}

          {status === "error" && (
            <div className="wallet-state">
              <p className="wallet-error" role="alert">{listError}</p>
              <button className="wallet-retry" type="button" onClick={() => setReloadKey((k) => k + 1)}>
                Thử lại
              </button>
            </div>
          )}

          {status === "ready" && items.length === 0 && (
            <p className="wallet-state">
              {query ? `Không tìm thấy người dùng nào khớp “${query}”.` : "Chưa có người dùng nào."}
            </p>
          )}

          {status === "ready" && items.length > 0 && (
            <>
              <p className="history-total">{meta.total} người dùng</p>
              <ul className="tx-list">
                {items.map((u) => {
                  const isSelected = selected?.id === u.id;
                  return (
                    <li key={u.id} className={`user-row${isSelected ? " selected" : ""}`}>
                      <div className="tx-main">
                        <div className="tx-type">{u.name}</div>
                        <div className="tx-meta">{u.email} · {u.phone}</div>
                        <div className="tx-meta">
                          {u.roles.map((r) => ROLE_LABEL[r] ?? r).join(", ")} · Số dư {formatVnd(u.balance)}
                        </div>
                      </div>
                      <button
                        type="button"
                        className="chip"
                        aria-pressed={isSelected}
                        onClick={() => selectUser(u)}
                      >
                        {isSelected ? "Đang chọn" : "Chọn"}
                      </button>
                    </li>
                  );
                })}
              </ul>

              {meta.total_pages > 1 && (
                <div className="pager">
                  <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Trước</button>
                  <span>Trang {meta.page} / {meta.total_pages}</span>
                  <button type="button" disabled={page >= meta.total_pages} onClick={() => setPage((p) => p + 1)}>Sau</button>
                </div>
              )}
            </>
          )}
        </section>

        {/* ── Cột phải: form cấp tiền ── */}
        <section className="history-card topup-card" aria-label="Cấp tiền">
          {!selected && (
            <p className="wallet-state">Chọn một người dùng ở danh sách để cấp tiền.</p>
          )}

          {selected && (
            <form onSubmit={onSubmit} noValidate>
              <h2 className="topup-title">Cấp tiền cho {selected.name}</h2>
              <p className="tx-meta">{selected.email} · Số dư hiện tại {formatVnd(selected.balance)}</p>

              {done && (
                <p className="notice success" role="status">
                  Đã cấp {formatVnd(done.amount)} cho {done.name}. Số dư mới: {formatVnd(done.balance)}.
                </p>
              )}
              {error && <p className="wallet-error" role="alert">{error}</p>}

              <label className="topup-label" htmlFor="topup-amount">Số tiền (₫)</label>
              <input
                id="topup-amount"
                className="topup-input"
                inputMode="numeric"
                autoComplete="off"
                value={amount}
                onChange={onAmountChange}
                disabled={step !== "form"}
                placeholder="Ví dụ 100000"
              />
              <div className="topup-hint">
                {amountOk ? `= ${formatVnd(amountNumber)}` : "Nhập số nguyên lớn hơn 0."}
              </div>
              <div className="filter-chips">
                {QUICK_AMOUNTS.map((v) => (
                  <button
                    key={v}
                    type="button"
                    className="chip"
                    disabled={step !== "form"}
                    onClick={() => setAmount(String(v))}
                  >
                    {formatVnd(v)}
                  </button>
                ))}
              </div>

              <label className="topup-label" htmlFor="topup-reason">Lý do (bắt buộc)</label>
              <textarea
                id="topup-reason"
                className="topup-input"
                rows={3}
                maxLength={MAX_REASON}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                disabled={step !== "form"}
                placeholder="Ví dụ: Cấp số dư trải nghiệm đồ án môn học"
              />
              <div className="topup-hint">
                {reasonTrimmed.length === 0 && reason.length > 0
                  ? "Lý do không được chỉ có khoảng trắng."
                  : `${reasonTrimmed.length}/${MAX_REASON}`}
              </div>

              {step === "form" && (
                <button type="submit" className="wallet-retry topup-submit" disabled={!canSubmit}>
                  Cấp tiền
                </button>
              )}

              {step !== "form" && (
                <div className="topup-confirm" role="group" aria-label="Xác nhận cấp tiền">
                  <p>
                    Cấp <strong>{formatVnd(amountNumber)}</strong> cho <strong>{selected.name}</strong>?
                    Giao dịch này không thể hoàn tác.
                  </p>
                  <div className="topup-confirm-actions">
                    <button type="button" className="chip" disabled={sending} onClick={() => setStep("form")}>
                      Quay lại
                    </button>
                    <button type="button" className="wallet-retry" disabled={sending} onClick={onConfirm}>
                      {sending ? "Đang cấp..." : "Xác nhận cấp"}
                    </button>
                  </div>
                </div>
              )}
            </form>
          )}
        </section>
      </div>
    </div>
  );
}
