import { useEffect, useState } from "react";
import { listHolidays, createHoliday } from "../../services/adminService";
import Icon from "../../components/ui/Icon";

/** Format "YYYY-MM-DD" → "Thứ Tư, 2/9/2026" */
function fmtDate(str) {
  if (!str) return "—";
  const d = new Date(str + "T00:00:00");
  const WD = ["Chủ Nhật","Thứ Hai","Thứ Ba","Thứ Tư","Thứ Năm","Thứ Sáu","Thứ Bảy"];
  return `${WD[d.getDay()]}, ${d.getDate()}/${d.getMonth()+1}/${d.getFullYear()}`;
}

export default function AdminHolidaysPage() {
  const [holidays, setHolidays] = useState([]);
  const [status,   setStatus]   = useState("loading");
  const [reload,   setReload]   = useState(0);

  /* Form thêm */
  const [name,      setName]      = useState("");
  const [date,      setDate]      = useState("");
  const [yearly,    setYearly]    = useState(true);
  const [formErr,   setFormErr]   = useState("");
  const [submitting,setSubmitting]= useState(false);
  const [doneMsg,   setDoneMsg]   = useState("");

  useEffect(() => {
    setStatus("loading");
    listHolidays()
      .then((r) => { setHolidays(r.data ?? []); setStatus("ready"); })
      .catch(() => setStatus("error"));
  }, [reload]);

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return setFormErr("Vui lòng nhập tên ngày lễ.");
    if (!date)        return setFormErr("Vui lòng chọn ngày.");
    setFormErr(""); setDoneMsg(""); setSubmitting(true);
    try {
      await createHoliday({ name: name.trim(), holiday_date: date, recurring_yearly: yearly });
      setName(""); setDate(""); setYearly(true);
      setDoneMsg("Đã thêm ngày lễ thành công.");
      setReload((k) => k + 1);
    } catch (err) {
      setFormErr(err.message || "Không thêm được ngày lễ.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div className="page-head">
        <h1>Danh mục ngày lễ</h1>
      </div>

      <div className="split split--narrow">

        {/* Bảng danh sách */}
        <div>
          {status === "loading" && (
            <div className="table-wrap">
              <div className="stack" style={{ "--gap":"0", padding:"16px 18px" }} aria-hidden="true">
                {[1,2,3,4,5].map((i) => (
                  <div key={i} className="skel-row">
                    <div className="skel skel-line" style={{ width:"40%" }} />
                    <div className="skel skel-line" style={{ width:"30%" }} />
                    <div className="skel skel-line" style={{ width:"15%" }} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {status === "error" && (
            <div className="notice notice--danger">
              <Icon name="alert" size={16} />Không tải được danh mục ngày lễ.
              <button className="btn btn--sm btn--ghost" style={{ marginLeft:"auto" }}
                onClick={() => setReload((k) => k+1)}>Thử lại</button>
            </div>
          )}

          {status === "ready" && holidays.length === 0 && (
            <div className="empty"><h3>Chưa có ngày lễ nào</h3></div>
          )}

          {status === "ready" && holidays.length > 0 && (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Ngày lễ</th>
                    <th>Ngày</th>
                    <th>Lặp hằng năm</th>
                  </tr>
                </thead>
                <tbody>
                  {[...holidays]
                    .sort((a, b) => a.holiday_date.localeCompare(b.holiday_date))
                    .map((h) => (
                    <tr key={h.id}>
                      <td style={{ fontWeight: 500 }}>{h.name}</td>
                      <td>{fmtDate(h.holiday_date)}</td>
                      <td>
                        {h.recurring_yearly
                          ? <span className="badge badge--deposited">Có</span>
                          : <span className="badge">Không</span>
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Form thêm ngày lễ */}
        <form className="card sticky stack" style={{ "--gap":"14px" }} onSubmit={onSubmit} noValidate>
          <h3>Thêm ngày lễ</h3>

          {doneMsg && (
            <div className="notice notice--ok">
              <Icon name="check" size={16} />{doneMsg}
            </div>
          )}
          {formErr && (
            <div className="notice notice--danger">
              <Icon name="alert" size={16} />{formErr}
            </div>
          )}

          <div className="field">
            <label htmlFor="hol-name">Tên ngày lễ</label>
            <input
              id="hol-name"
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ví dụ: Quốc khánh"
              disabled={submitting}
            />
          </div>

          <div className="field">
            <label htmlFor="hol-date">Ngày</label>
            <input
              id="hol-date"
              className="input"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              disabled={submitting}
            />
          </div>

          <div className="row between">
            <span className="label">Lặp lại hằng năm</span>
            <button
              type="button"
              role="switch"
              aria-checked={yearly ? "true" : "false"}
              className="switch"
              onClick={() => setYearly(!yearly)}
              disabled={submitting}
            />
          </div>

          <button
            className="btn btn--primary"
            type="submit"
            disabled={submitting}
          >
            {submitting ? "Đang thêm…" : "Thêm ngày lễ"}
          </button>
        </form>

      </div>
    </>
  );
}
