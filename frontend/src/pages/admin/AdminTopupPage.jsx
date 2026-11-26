import { useEffect, useState } from "react";
import { searchUsers, topupWallet, getTopupHistory } from "../../services/adminService";
import { formatVnd } from "../../utils/format";
import Icon from "../../components/ui/Icon";

const PAGE_LIMIT = 5;
const MAX_REASON = 500;
const QUICK = [
  { v: 100_000,   l: "100k" },
  { v: 200_000,   l: "200k" },
  { v: 500_000,   l: "500k" },
  { v: 1_000_000, l: "1 triệu" },
];
const ROLE_LABEL = { customer: "Khách hàng", owner: "Chủ sân", admin: "Admin" };

function initials(name = "") {
  return name.split(" ").filter(Boolean).slice(-2).map((w) => w[0].toUpperCase()).join("");
}
function fmtDateTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const WD = ["CN","T2","T3","T4","T5","T6","T7"];
  return `${WD[d.getDay()]} ${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")} · ${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
}

export default function AdminTopupPage() {
  /* ── Danh sách người dùng ── */
  const [keyword,   setKeyword]   = useState("");
  const [query,     setQuery]     = useState("");
  const [roleFilter,setRoleFilter]= useState("all");
  const [page,      setPage]      = useState(1);
  const [reload,    setReload]    = useState(0);
  const [userList,  setUserList]  = useState({ status: "loading", items: [], meta: null, error: "" });

  /* ── Form cấp tiền ── */
  const [selected, setSelected] = useState(null);
  const [amount,   setAmount]   = useState("");
  const [reason,   setReason]   = useState("");
  const [step,     setStep]     = useState("form"); // form | confirm | sending
  const [formErr,  setFormErr]  = useState("");
  const [done,     setDone]     = useState(null);

  /* ── Lần cấp gần đây ── */
  const [recent, setRecent] = useState([]);

  /* Load danh sách user */
  useEffect(() => {
    let cancelled = false;
    setUserList((s) => ({ ...s, status: "loading" }));
    const params = { page, limit: PAGE_LIMIT };
    if (query) params.search = query;
    searchUsers(params)
      .then((res) => {
        if (!cancelled)
          setUserList({ status: "ready", items: res.data ?? [], meta: res.meta, error: "" });
      })
      .catch((err) => {
        if (!cancelled)
          setUserList({ status: "error", items: [], meta: null, error: err.message || "Không tải được danh sách." });
      });
    return () => { cancelled = true; };
  }, [query, page, roleFilter, reload]);

  /* Load lịch sử cấp gần đây */
  useEffect(() => {
    getTopupHistory({ limit: 5 })
      .then((r) => setRecent(r.data ?? []))
      .catch(() => {});
  }, [done]); // reload sau mỗi lần cấp thành công

  const onSearch = (e) => {
    e.preventDefault();
    setPage(1);
    setQuery(keyword.trim());
  };

  const selectUser = (u) => {
    setSelected(u);
    setAmount("");
    setReason("");
    setStep("form");
    setFormErr("");
    setDone(null);
  };

  const n = Number(amount.replace(/\D/g, ""));
  const reasonOk = reason.trim().length > 0 && reason.trim().length <= MAX_REASON;
  const canSubmit = selected && n > 0 && reasonOk;

  const onSubmit = (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    setFormErr("");
    setStep("confirm");
  };

  const onConfirm = async () => {
    if (step === "sending") return;
    setStep("sending");
    setFormErr("");
    try {
      const res = await topupWallet({ user_id: selected.id, amount: n, reason: reason.trim() });
      const newBal = res.data.new_balance;
      setUserList((s) => ({
        ...s,
        items: s.items.map((u) => u.id === selected.id ? { ...u, balance: newBal } : u),
      }));
      setSelected((s) => ({ ...s, balance: newBal }));
      setDone({ name: selected.name, amount: res.data.granted_amount, before: selected.balance, after: newBal });
      setAmount("");
      setReason("");
      setStep("form");
    } catch (err) {
      setFormErr(err.message || "Không cấp được tiền. Vui lòng thử lại.");
      setStep("form");
    }
  };

  const { status, items, meta, error: listError } = userList;
  const sending = step === "sending";
  const bal = selected?.balance ?? 0;

  return (
    <>
      <div className="page-head">
        <div><h1>Cấp tiền vào ví</h1></div>
      </div>

      <div className="topup">

        {/* ── Cột trái: bảng người dùng ── */}
        <section className="card card--flush topup__users">

          {/* Thanh tìm + filter role */}
          <div className="topup__bar">
            <form
              className="input-group"
              style={{ flex: 1, maxWidth: 360 }}
              role="search"
              onSubmit={onSearch}
            >
              <input
                className="input"
                placeholder="Tìm theo tên, email hoặc SĐT"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                aria-label="Tìm người dùng"
              />
              <button type="submit" className="icon-btn" style={{ position: "absolute", right: 6, top: 6 }}>
                <Icon name="search" size={16} />
              </button>
            </form>
            <div className="seg">
              {[["all","Tất cả"],["customer","Khách hàng"],["owner","Chủ sân"]].map(([k,l]) => (
                <button key={k} type="button"
                  className={roleFilter === k ? "on" : ""}
                  onClick={() => { setRoleFilter(k); setPage(1); }}>
                  {l}
                </button>
              ))}
            </div>
          </div>

          {/* Danh sách */}
          <div className="topup__list">
            {status === "loading" && (
              <div className="stack" style={{ "--gap":"0", padding: "8px 24px" }} aria-hidden="true">
                {[1,2,3,4,5].map((i) => (
                  <div key={i} className="skel-row">
                    <div className="skel skel-line" style={{ width:32, height:32, borderRadius:"50%" }} />
                    <div className="skel skel-line" style={{ width:"55%" }} />
                    <div className="skel skel-line" style={{ width:"20%", justifySelf:"end" }} />
                  </div>
                ))}
              </div>
            )}

            {status === "error" && (
              <div className="notice notice--danger" style={{ margin:16 }}>
                <Icon name="alert" size={16} />{listError}
                <button className="btn btn--sm btn--ghost" style={{ marginLeft:"auto" }}
                  onClick={() => setReload((k) => k+1)}>Thử lại</button>
              </div>
            )}

            {status === "ready" && items.length === 0 && (
              <p className="muted small" style={{ padding:"24px 24px" }}>
                {query ? `Không tìm thấy "${query}".` : "Chưa có người dùng nào."}
              </p>
            )}

            {status === "ready" && items.length > 0 && (() => {
              const filtered = roleFilter === "all"
                ? items
                : items.filter((u) => (u.roles ?? (u.role ? [u.role] : [])).includes(roleFilter));
              return filtered.length === 0 ? (
                <p className="muted small" style={{ padding:"24px 24px" }}>
                  Không có người dùng nào với vai trò này trong trang hiện tại.
                </p>
              ) : (
              <div className="table-wrap flat">
                <table className="table table--pick">
                  <thead>
                    <tr>
                      <th>Người dùng</th>
                      <th>Vai trò</th>
                      <th className="r">Số dư</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((u) => {
                      const isOn = selected?.id === u.id;
                      const roles = u.roles ?? (u.role ? [u.role] : []);
                      return (
                        <tr key={u.id}
                          className={isOn ? "on" : ""}
                          onClick={() => selectUser(u)}
                          tabIndex={0}
                          aria-selected={isOn}
                          onKeyDown={(e) => e.key === "Enter" && selectUser(u)}
                          style={{ cursor: "pointer" }}
                        >
                          <td>
                            <div className="row" style={{ "--gap":"10px" }}>
                              <span className="avatar" style={{ width:32, height:32, fontSize:12, flexShrink:0 }}>
                                {initials(u.name)}
                              </span>
                              <span>
                                {u.name}
                                <small className="muted" style={{ display:"block" }}>{u.email}</small>
                              </span>
                            </div>
                          </td>
                          <td>
                            <span className="tag">
                              {roles.map((r) => ROLE_LABEL[r] ?? r).join(", ")}
                            </span>
                          </td>
                          <td className="r num">
                            {formatVnd(u.balance ?? 0)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              );
            })()}

            {/* Phân trang */}
            {status === "ready" && meta && meta.total_pages > 1 && (
              <div className="topup__pager">
                <nav className="pager" aria-label="Phân trang">
                  <span className="pager__count mono">
                    {(page-1)*PAGE_LIMIT+1}–{Math.min(meta.total, page*PAGE_LIMIT)} / {meta.total}
                  </span>
                  <button className="pager__btn" disabled={page<=1}
                    onClick={() => setPage((p) => p-1)} aria-label="Trang trước">
                    <Icon name="chevL" size={16} />
                  </button>
                  <button className="pager__btn" disabled={page>=meta.total_pages}
                    onClick={() => setPage((p) => p+1)} aria-label="Trang sau">
                    <Icon name="chevR" size={16} />
                  </button>
                </nav>
              </div>
            )}
          </div>
        </section>

        {/* ── Cột phải: form + recent ── */}
        <aside className="topup__side">

          {/* Form cấp tiền */}
          <section className="card topup__form" aria-label="Cấp tiền">
            {!selected && (
              <p className="muted small" style={{ padding:"8px 0" }}>
                Chọn một người dùng ở danh sách để cấp tiền.
              </p>
            )}

            {selected && (
              <form onSubmit={onSubmit} noValidate>
                {/* Header người được chọn */}
                <div className="row" style={{ "--gap":"12px", marginBottom:16 }}>
                  <span className="avatar">{initials(selected.name)}</span>
                  <div>
                    <div style={{ fontWeight:500 }}>{selected.name}</div>
                    <div className="small muted">
                      {(selected.roles ?? [selected.role]).map((r) => ROLE_LABEL[r] ?? r).join(", ")}
                      {" · "}{selected.email}
                    </div>
                  </div>
                </div>

                {/* Số dư hiện tại */}
                <div className="topup__bal">
                  <span className="small muted">Số dư hiện tại</span>
                  <b className="mono">{formatVnd(bal)}</b>
                </div>

                {/* Thông báo kết quả */}
                {done?.name === selected.name && (
                  <div className="notice notice--ok" style={{ marginBottom:12 }}>
                    <Icon name="check" size={16} />
                    Đã cấp <b className="mono">+{formatVnd(done.amount)}</b> cho {done.name}.
                    Số dư <span className="mono">{formatVnd(done.before)}</span> → <b className="mono">{formatVnd(done.after)}</b>
                  </div>
                )}
                {formErr && (
                  <div className="notice notice--danger" style={{ marginBottom:12 }}>
                    <Icon name="alert" size={16} />{formErr}
                  </div>
                )}

                {/* Input số tiền */}
                <div className="field" style={{ marginBottom:8 }}>
                  <label htmlFor="topup-amt">Số tiền cấp (đ)</label>
                  <input
                    id="topup-amt"
                    className="input mono"
                    inputMode="numeric"
                    autoComplete="off"
                    placeholder="200.000"
                    value={n ? n.toLocaleString("vi-VN") : ""}
                    onChange={(e) => setAmount(e.target.value.replace(/\D/g,""))}
                    disabled={step !== "form"}
                    aria-invalid={amount !== "" && n <= 0}
                  />
                </div>

                {/* Quick amounts */}
                <div className="topup__quick">
                  {QUICK.map(({ v, l }) => (
                    <button key={v} type="button"
                      className={"chip" + (n === v ? " on" : "")}
                      disabled={step !== "form"}
                      onClick={() => { setAmount(String(v)); setDone(null); }}>
                      {l}
                    </button>
                  ))}
                </div>

                {/* Input nội dung */}
                <div className="field" style={{ marginTop:12 }}>
                  <label htmlFor="topup-reason">Nội dung (bắt buộc)</label>
                  <input
                    id="topup-reason"
                    className="input"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    disabled={step !== "form"}
                    placeholder="Admin cấp tiền trải nghiệm"
                    maxLength={MAX_REASON}
                  />
                </div>

                {/* Preview số dư sau */}
                <div className="bill-row topup__after">
                  <span className="muted small">Số dư sau khi cấp</span>
                  <span className="num mono">{formatVnd(bal + (n || 0))}</span>
                </div>

                {/* Nút submit / confirm */}
                {step === "form" && (
                  <button className="btn btn--primary btn--block" type="submit" disabled={!canSubmit}>
                    Cấp {n ? formatVnd(n) : "tiền"} cho {selected.name.split(" ").at(-1)}
                  </button>
                )}

                {step !== "form" && (
                  <div className="topup__confirm">
                    <p>
                      Cấp <b className="mono">{formatVnd(n)}</b> cho <b>{selected.name}</b>?
                      <br />
                      <span className="muted small">Giao dịch này không thể hoàn tác.</span>
                    </p>
                    <div className="row" style={{ "--gap":"8px", justifyContent:"flex-end", marginTop:12 }}>
                      <button type="button" className="btn btn--ghost btn--sm"
                        disabled={sending} onClick={() => setStep("form")}>
                        Quay lại
                      </button>
                      <button type="button" className="btn btn--primary btn--sm"
                        disabled={sending} onClick={onConfirm}>
                        {sending ? "Đang cấp…" : "Xác nhận cấp"}
                      </button>
                    </div>
                  </div>
                )}
              </form>
            )}
          </section>

          {/* Lần cấp gần đây */}
          <section className="card topup__recent">
            <h3 style={{ marginBottom:12, fontSize:16, fontWeight:500 }}>Lần cấp gần đây</h3>
            {recent.length === 0 && (
              <p className="muted small">Chưa có lần cấp nào.</p>
            )}
            {recent.map((t) => (
              <div key={t.id} className="bill-row">
                <span>
                  {t.user_name ?? t.user?.name ?? "—"}
                  <small className="muted mono" style={{ display:"block", fontSize:12, marginTop:2 }}>
                    {fmtDateTime(t.created_at)}
                  </small>
                </span>
                <span className="num mono amount-in">+{formatVnd(t.amount)}</span>
              </div>
            ))}
          </section>
        </aside>

      </div>
    </>
  );
}
