import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useOutletContext, useParams } from "react-router-dom";
import PricingRulesSection from "../../components/PricingRulesSection";
import { createCourt, getFacility } from "../../services/facilityService";
import { formatTime } from "../../utils/format";
import Icon from "../../components/ui/Icon";
import Modal from "../../components/ui/Modal";
import api from "../../services/api";

const SPORTS = [
  { id: 1, label: "Cầu lông" },
  { id: 2, label: "Pickleball" },
  { id: 3, label: "Bóng đá mini" },
];
const SPORT_LABEL = Object.fromEntries(SPORTS.map((s) => [s.id, s.label]));
const ENVIRONMENTS = [
  { value: "INDOOR",  label: "Trong nhà (Indoor)" },
  { value: "OUTDOOR", label: "Ngoài trời (Outdoor)" },
];
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const HOURS = Array.from({ length: 24 }, (_, h) => `${String(h).padStart(2,"0")}:00`);

const EMPTY_COURT = {
  name: "", sport_id: "", court_type: "", environment: "",
  open_time: "", close_time: "", default_base_price: "",
};

function validateCourt(f, facOpen, facClose) {
  const e = {};
  if (!f.name.trim()) e.name = "Vui lòng nhập tên sân.";
  if (!f.sport_id)    e.sport_id = "Vui lòng chọn môn.";
  if (!f.environment) e.environment = "Vui lòng chọn môi trường.";
  const oo = TIME_RE.test(f.open_time), oc = TIME_RE.test(f.close_time);
  if (!oo) e.open_time = "Vui lòng chọn giờ mở.";
  if (!oc) e.close_time = "Vui lòng chọn giờ đóng.";
  if (oo && oc) {
    if (f.open_time >= f.close_time) e.close_time = "Giờ đóng phải sau giờ mở.";
    else {
      const fo = facOpen.slice(0,5), fc = facClose.slice(0,5);
      if (f.open_time < fo || f.close_time > fc)
        e.open_time = `Phải nằm trong ${fo}–${fc}.`;
    }
  }
  const p = Number(f.default_base_price);
  if (f.default_base_price === "") e.default_base_price = "Vui lòng nhập giá.";
  else if (!Number.isInteger(p) || p < 0) e.default_base_price = "Giá phải là số nguyên ≥ 0.";
  return e;
}

export default function FacilityDetailPage() {
  const { id }   = useParams();
  const { user } = useOutletContext();
  const navigate = useNavigate();
  const location = useLocation();
  const updatedCourt = location.state?.updatedCourt;

  const [tab, setTab]           = useState("info");
  const [facility, setFacility] = useState(null);
  const [courts,   setCourts]   = useState([]);
  const [loadStatus, setLoadStatus] = useState("loading");
  const [loadError,  setLoadError]  = useState("");

  /* ── Sửa thông tin cơ sở ── */
  const [form,       setForm]       = useState(null);
  const [formErrors, setFormErrors] = useState({});
  const [formApiErr, setFormApiErr] = useState("");
  const [saving,     setSaving]     = useState(false);
  const [savedMsg,   setSavedMsg]   = useState("");

  /* ── Sửa sân con ── */
  const [editCourt,     setEditCourt]     = useState(null); // court object đang sửa
  const [editForm,      setEditForm]      = useState({});
  const [editErrors,    setEditErrors]    = useState({});
  const [editApiErr,    setEditApiErr]    = useState("");
  const [savingCourt,   setSavingCourt]   = useState(false);
  const [showCourtForm, setShowCourtForm] = useState(false);
  const [courtForm,     setCourtForm]     = useState(EMPTY_COURT);
  const [courtErrors,   setCourtErrors]   = useState({});
  const [courtApiErr,   setCourtApiErr]   = useState("");
  const [addingCourt,   setAddingCourt]   = useState(false);

  /* Load */
  useEffect(() => {
    let cancelled = false;
    setLoadStatus("loading");
    getFacility(id)
      .then((res) => {
        if (cancelled) return;
        const f = res.data;
        if (f.owner_id !== user.id) { navigate("/owner/facilities", { replace: true }); return; }
        setFacility(f);
        setForm({
          name:        f.name        ?? "",
          address:     f.address     ?? "",
          city:        f.city        ?? "",
          district:    f.district    ?? "",
          latitude:    f.latitude    != null ? String(f.latitude)  : "",
          longitude:   f.longitude   != null ? String(f.longitude) : "",
          open_time:   (f.open_time  ?? "").slice(0,5),
          close_time:  (f.close_time ?? "").slice(0,5),
          description: f.description ?? "",
        });
        const raw = f.courts ?? [];
        setCourts(updatedCourt ? raw.map((c) => c.id === updatedCourt.id ? updatedCourt : c) : raw);
        setLoadStatus("ready");
      })
      .catch((err) => {
        if (cancelled) return;
        if (err.code === "RESOURCE_NOT_FOUND") navigate("/owner/facilities", { replace: true });
        else { setLoadError(err.message || "Không tải được."); setLoadStatus("error"); }
      });
    return () => { cancelled = true; };
  }, [id, user.id, navigate]);

  const setF = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  /* Lưu thông tin cơ sở */
  const handleSave = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!form.name.trim())    errs.name    = "Vui lòng nhập tên cơ sở.";
    if (!form.address.trim()) errs.address = "Vui lòng nhập địa chỉ.";
    if (!form.city.trim())    errs.city    = "Vui lòng nhập thành phố.";
    if (!TIME_RE.test(form.open_time))  errs.open_time  = "Vui lòng chọn giờ mở cửa.";
    if (!TIME_RE.test(form.close_time)) errs.close_time = "Vui lòng chọn giờ đóng cửa.";
    if (!errs.open_time && !errs.close_time && form.open_time >= form.close_time)
      errs.close_time = "Giờ đóng cửa phải sau giờ mở cửa.";
    setFormErrors(errs);
    setFormApiErr("");
    if (Object.keys(errs).length) return;

    setSaving(true);
    setSavedMsg("");
    try {
      const payload = {
        name:        form.name.trim(),
        address:     form.address.trim(),
        city:        form.city.trim(),
        district:    form.district.trim() || null,
        latitude:    form.latitude  ? Number(form.latitude)  : null,
        longitude:   form.longitude ? Number(form.longitude) : null,
        open_time:   `${form.open_time}:00`,
        close_time:  `${form.close_time}:00`,
        description: form.description.trim() || null,
      };
      const res = await api.patch(`/facilities/${id}`, payload);
      setFacility(res.data);
      setSavedMsg("Đã lưu thay đổi.");
    } catch (err) {
      setFormApiErr(err.message || "Không lưu được.");
    } finally {
      setSaving(false);
    }
  };

  /* Thêm sân con */
  const handleAddCourt = async (e) => {
    e.preventDefault();
    const errs = validateCourt(courtForm, facility.open_time, facility.close_time);
    setCourtErrors(errs);
    setCourtApiErr("");
    if (Object.keys(errs).length) return;

    setAddingCourt(true);
    try {
      const res = await createCourt(id, {
        name:               courtForm.name.trim(),
        sport_id:           Number(courtForm.sport_id),
        court_type:         courtForm.court_type.trim() || "STANDARD",
        environment:        courtForm.environment,
        open_time:          `${courtForm.open_time}:00`,
        close_time:         `${courtForm.close_time}:00`,
        default_base_price: Number(courtForm.default_base_price),
      });
      setCourts((prev) => [...prev, res.data]);
      setCourtForm(EMPTY_COURT);
      setShowCourtForm(false);
    } catch (err) {
      if (err.code === "VALIDATION_ERROR" && Array.isArray(err.details)) {
        const fe = {}, gen = [];
        for (const { field, issue } of err.details) {
          if (field in EMPTY_COURT) fe[field] = issue;
          else gen.push(issue.replace(/^Value error, /, ""));
        }
        setCourtErrors(fe);
        setCourtApiErr(gen.join(" ") || err.message || "Dữ liệu không hợp lệ.");
      } else {
        setCourtApiErr(err.message || "Không thêm được sân.");
      }
    } finally {
      setAddingCourt(false);
    }
  };

  const openEditCourt = (c) => {
    setEditCourt(c);
    setEditForm({
      name:        c.name,
      sport_id:    String(c.sport_id),
      court_type:  c.court_type ?? "",
      environment: c.environment ?? "INDOOR",
      open_time:   (c.open_time  ?? "").slice(0,5),
      close_time:  (c.close_time ?? "").slice(0,5),
    });
    setEditErrors({});
    setEditApiErr("");
  };

  const handleSaveCourt = async () => {
    const errs = {};
    if (!editForm.name.trim())             errs.name       = "Vui lòng nhập tên sân.";
    if (!TIME_RE.test(editForm.open_time))  errs.open_time  = "Chọn giờ mở.";
    if (!TIME_RE.test(editForm.close_time)) errs.close_time = "Chọn giờ đóng.";
    if (!errs.open_time && !errs.close_time && editForm.open_time >= editForm.close_time)
      errs.close_time = "Giờ đóng phải sau giờ mở.";
    setEditErrors(errs);
    if (Object.keys(errs).length) return;

    setSavingCourt(true);
    setEditApiErr("");
    try {
      const res = await api.patch(`/courts/${editCourt.id}`, {
        name:       editForm.name.trim(),
        open_time:  `${editForm.open_time}:00`,
        close_time: `${editForm.close_time}:00`,
      });
      setCourts((prev) => prev.map((c) => c.id === editCourt.id ? { ...c, ...res.data } : c));
      setEditCourt(null);
    } catch (err) {
      setEditApiErr(err.message || "Không lưu được sân.");
    } finally {
      setSavingCourt(false);
    }
  };

  /* Guards */
  if (loadStatus === "loading") return (
    <div className="page-head"><div className="skel" style={{ width:200, height:28 }} /></div>
  );
  if (loadStatus === "error") return (
    <div className="notice notice--danger">
      <Icon name="alert" size={16} />{loadError}
      <Link className="btn btn--sm btn--ghost" style={{ marginLeft:"auto" }} to="/owner/facilities">Quay lại</Link>
    </div>
  );

  return (
    <form onSubmit={(e) => e.preventDefault()} noValidate>
      {/* Page head */}
      <div className="page-head">
        <h1>{facility.name}</h1>
      {tab === "courts" && null}
      </div>

      {/* Tabs */}
      <div className="seg seg--scroll fedit__tabs" role="tablist">
        {[["info","Thông tin"], ["courts",`Sân con (${courts.length})`]].map(([k,l]) => (
          <button key={k} type="button" role="tab"
            aria-selected={tab===k} className={tab===k?"on":""}
            onClick={() => setTab(k)}>{l}
            {k==="info" && Object.keys(formErrors).length > 0 && (
              <span style={{ width:6,height:6,borderRadius:"50%",background:"var(--danger)",display:"inline-block",marginLeft:6,verticalAlign:1 }} />
            )}
          </button>
        ))}
      </div>

      {/* ── Tab: Thông tin ── */}
      {tab === "info" && (
        <div className="fedit__info">
          <section className="card">
            {savedMsg && (
              <div className="notice notice--ok" style={{ marginBottom:16 }}>
                <Icon name="check" size={16} />{savedMsg}
              </div>
            )}
            {formApiErr && (
              <div className="notice notice--danger" style={{ marginBottom:16 }}>
                <Icon name="alert" size={16} />{formApiErr}
              </div>
            )}

            <div className="form-grid">
              <div className="field full">
                <label htmlFor="fe-name">Tên cơ sở</label>
                <input id="fe-name" className="input" value={form.name} onChange={setF("name")} disabled />
              </div>

              <div className="field full">
                <label htmlFor="fe-addr">Địa chỉ</label>
                <input id="fe-addr" className="input" value={form.address} onChange={setF("address")} disabled />
              </div>

              <div className="field">
                <label htmlFor="fe-city">Thành phố</label>
                <input id="fe-city" className="input" value={form.city} onChange={setF("city")} disabled />
              </div>

              <div className="field">
                <label htmlFor="fe-dist">Quận, huyện</label>
                <input id="fe-dist" className="input" value={form.district} onChange={setF("district")} disabled />
              </div>

              <div className="field">
                <label htmlFor="fe-lat">Vĩ độ</label>
                <input id="fe-lat" className="input mono" value={form.latitude} onChange={setF("latitude")} disabled />
              </div>

              <div className="field">
                <label htmlFor="fe-lng">Kinh độ</label>
                <input id="fe-lng" className="input mono" value={form.longitude} onChange={setF("longitude")} disabled />
              </div>

              <div className="field full">
                <label htmlFor="fe-desc">Mô tả</label>
                <textarea id="fe-desc" className="textarea" value={form.description} onChange={setF("description")} disabled />
              </div>
            </div>
          </section>

          {/* Cột phải: giờ */}
          <section className="card fedit__aside">
            <h3>Giờ mở cửa</h3>
            <div className="grid-2" style={{ gap:12, marginTop:12 }}>
              <div className="field">
                <label htmlFor="fe-open">Mở</label>
                <select id="fe-open" className="select mono" value={form.open_time} onChange={setF("open_time")} disabled>
                  {HOURS.map((h) => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>
              <div className="field">
                <label htmlFor="fe-close">Đóng</label>
                <select id="fe-close" className="select mono" value={form.close_time} onChange={setF("close_time")} disabled>
                  {HOURS.map((h) => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>
            </div>
          </section>
        </div>
      )}

      {/* ── Tab: Sân con ── */}
      {tab === "courts" && (
        <section className="card">
          <div className="card__head">
            <h2>Sân con</h2>
            <button className="btn btn--sm" type="button"
              onClick={() => { setShowCourtForm(true); setCourtErrors({}); setCourtApiErr(""); }}>
              <Icon name="plus" size={14} />Thêm sân con
            </button>
          </div>

          {courts.length === 0 ? (
            <div className="empty"><h3>Chưa có sân con nào</h3><p>Thêm ít nhất một sân để khách đặt được.</p></div>
          ) : (
            <div className="table-wrap flat">
              <table className="table">
                <thead>
                  <tr>
                    <th>Sân</th>
                    <th>Môn</th>
                    <th>Loại</th>
                    <th>Giờ</th>
                    <th>Khóa giờ</th>
                    <th>Hoạt động</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {courts.map((c) => (
                    <tr key={c.id}>
                      <td style={{ fontWeight: 500 }}>{c.name}</td>
                      <td>{SPORT_LABEL[c.sport_id] ?? `#${c.sport_id}`}</td>
                      <td className="ink2">
                        {[c.court_type, c.environment === "INDOOR" ? "Trong nhà" : "Ngoài trời"].filter(Boolean).join(" · ")}
                      </td>
                      <td className="mono small">
                        {formatTime(c.open_time)}–{formatTime(c.close_time)}
                      </td>
                      <td className="muted small">Không</td>
                      <td>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={c.is_active ? "true" : "false"}
                          className="switch"
                          style={{ cursor: "default", pointerEvents: "none" }}
                        />
                      </td>
                      <td className="r">
                        <button type="button" className="icon-btn" title="Sửa sân"
                          onClick={() => openEditCourt(c)}>
                          <Icon name="edit" size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* Modal thêm sân con */}
      {showCourtForm && (
        <Modal
          title="Thêm sân con"
          onClose={() => { setShowCourtForm(false); setCourtForm(EMPTY_COURT); setCourtErrors({}); setCourtApiErr(""); }}
          footer={
            <>
              <button type="button" className="btn btn--ghost"
                onClick={() => { setShowCourtForm(false); setCourtForm(EMPTY_COURT); setCourtErrors({}); setCourtApiErr(""); }}>
                Hủy
              </button>
              <button type="button" className="btn btn--primary" disabled={addingCourt} onClick={handleAddCourt}>
                {addingCourt ? "Đang lưu…" : "Lưu sân"}
              </button>
            </>
          }
        >
          {courtApiErr && (
            <div className="notice notice--danger" style={{ marginBottom:16 }}>
              <Icon name="alert" size={16} />{courtApiErr}
            </div>
          )}
          <div className="form-grid" style={{ marginTop:16 }}>
            {/* Tên sân */}
            <div className="field">
              <label htmlFor="cn-name">Tên sân</label>
              <input id="cn-name" className="input" placeholder="Sân 4"
                value={courtForm.name}
                onChange={(e) => setCourtForm((f) => ({ ...f, name: e.target.value }))}
                aria-invalid={!!courtErrors.name} />
              {courtErrors.name && <span className="field__err">{courtErrors.name}</span>}
            </div>

            {/* Môn */}
            <div className="field">
              <label htmlFor="cn-sport">Môn</label>
              <select id="cn-sport" className="select"
                value={courtForm.sport_id}
                onChange={(e) => setCourtForm((f) => ({ ...f, sport_id: e.target.value }))}
                aria-invalid={!!courtErrors.sport_id}>
                <option value="">Chọn môn</option>
                {SPORTS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
              {courtErrors.sport_id && <span className="field__err">{courtErrors.sport_id}</span>}
            </div>

            {/* Mặt sân */}
            <div className="field">
              <label htmlFor="cn-type">Mặt sân</label>
              <input id="cn-type" className="input" placeholder="Thảm PVC"
                value={courtForm.court_type}
                onChange={(e) => setCourtForm((f) => ({ ...f, court_type: e.target.value }))} />
            </div>

            {/* Vị trí — seg */}
            <div className="field">
              <label>Vị trí</label>
              <div className="seg">
                {[["INDOOR","Trong nhà"],["OUTDOOR","Ngoài trời"]].map(([v,l]) => (
                  <button key={v} type="button"
                    className={courtForm.environment === v ? "on" : ""}
                    onClick={() => setCourtForm((f) => ({ ...f, environment: v }))}>
                    {l}
                  </button>
                ))}
              </div>
              {courtErrors.environment && <span className="field__err">{courtErrors.environment}</span>}
            </div>

            {/* Giờ mở */}
            <div className="field">
              <label htmlFor="cn-open">Mở</label>
              <select id="cn-open" className="select mono"
                value={courtForm.open_time}
                onChange={(e) => setCourtForm((f) => ({ ...f, open_time: e.target.value }))}
                aria-invalid={!!courtErrors.open_time}>
                <option value="">Chọn</option>
                {HOURS.map((h) => <option key={h} value={h}>{h}</option>)}
              </select>
              {courtErrors.open_time && <span className="field__err">{courtErrors.open_time}</span>}
            </div>

            {/* Giờ đóng */}
            <div className="field">
              <label htmlFor="cn-close">Đóng</label>
              <select id="cn-close" className="select mono"
                value={courtForm.close_time}
                onChange={(e) => setCourtForm((f) => ({ ...f, close_time: e.target.value }))}
                aria-invalid={!!courtErrors.close_time}>
                <option value="">Chọn</option>
                {HOURS.map((h) => <option key={h} value={h}>{h}</option>)}
              </select>
              {courtErrors.close_time && <span className="field__err">{courtErrors.close_time}</span>}
            </div>

            {/* Giá — full width */}
            <div className="field full">
              <label htmlFor="cn-price">Giá cơ sở mỗi giờ (₫)</label>
              <input id="cn-price" className="input mono" type="number" min="0" step="1000"
                placeholder="100.000"
                value={courtForm.default_base_price}
                onChange={(e) => setCourtForm((f) => ({ ...f, default_base_price: e.target.value }))}
                aria-invalid={!!courtErrors.default_base_price} />
              {courtErrors.default_base_price && <span className="field__err">{courtErrors.default_base_price}</span>}
            </div>
          </div>
        </Modal>
      )}

      {/* Modal sửa sân con */}
      {editCourt && (
        <Modal
          title={`Sửa ${editCourt.name}`}
          onClose={() => setEditCourt(null)}
          footer={
            <>
              <button type="button" className="btn btn--ghost" onClick={() => setEditCourt(null)}>Hủy</button>
              <button type="button" className="btn btn--primary" disabled={savingCourt} onClick={handleSaveCourt}>
                {savingCourt ? "Đang lưu…" : "Lưu sân"}
              </button>
            </>
          }
        >
          {editApiErr && (
            <div className="notice notice--danger" style={{ marginBottom:16 }}>
              <Icon name="alert" size={16} />{editApiErr}
            </div>
          )}
          <div className="form-grid" style={{ marginTop:16 }}>
            {/* Tên sân */}
            <div className="field">
              <label htmlFor="ed-name">Tên sân</label>
              <input id="ed-name" className="input"
                value={editForm.name}
                onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                aria-invalid={!!editErrors.name} />
              {editErrors.name && <span className="field__err">{editErrors.name}</span>}
            </div>

            {/* Môn — read only */}
            <div className="field">
              <label>Môn</label>
              <select className="select" value={editForm.sport_id} disabled>
                {SPORTS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </div>

            {/* Mặt sân — read only */}
            <div className="field">
              <label>Mặt sân</label>
              <input className="input" value={editForm.court_type} disabled />
            </div>

            {/* Vị trí — read only */}
            <div className="field">
              <label>Vị trí</label>
              <div className="seg">
                {[["INDOOR","Trong nhà"],["OUTDOOR","Ngoài trời"]].map(([v,l]) => (
                  <button key={v} type="button"
                    className={editForm.environment === v ? "on" : ""}
                    disabled>
                    {l}
                  </button>
                ))}
              </div>
            </div>

            {/* Giờ mở */}
            <div className="field">
              <label htmlFor="ed-open">Mở</label>
              <select id="ed-open" className="select mono"
                value={editForm.open_time}
                onChange={(e) => setEditForm((f) => ({ ...f, open_time: e.target.value }))}
                aria-invalid={!!editErrors.open_time}>
                {HOURS.map((h) => <option key={h} value={h}>{h}</option>)}
              </select>
              {editErrors.open_time && <span className="field__err">{editErrors.open_time}</span>}
            </div>

            {/* Giờ đóng */}
            <div className="field">
              <label htmlFor="ed-close">Đóng</label>
              <select id="ed-close" className="select mono"
                value={editForm.close_time}
                onChange={(e) => setEditForm((f) => ({ ...f, close_time: e.target.value }))}
                aria-invalid={!!editErrors.close_time}>
                {HOURS.map((h) => <option key={h} value={h}>{h}</option>)}
              </select>
              {editErrors.close_time && <span className="field__err">{editErrors.close_time}</span>}
            </div>
          </div>
        </Modal>
      )}

    </form>
  );
}
