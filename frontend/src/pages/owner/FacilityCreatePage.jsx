import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createFacility } from "../../services/facilityService";
import { EMPTY_FORM, toFacilityPayload, validateFacility } from "../../utils/facilityForm";
import Icon from "../../components/ui/Icon";

const HOURS = Array.from({ length: 24 }, (_, h) =>
  `${String(h).padStart(2, "0")}:00`
);

const FORM_FIELDS = Object.keys(EMPTY_FORM);

export default function FacilityCreatePage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState("info");
  const [form, setForm] = useState({ ...EMPTY_FORM, city: "Hồ Chí Minh", open_time: "06:00", close_time: "22:00" });
  const [errors, setErrors] = useState({});
  const [apiError, setApiError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const showApiError = (err) => {
    if (err.code === "VALIDATION_ERROR" && Array.isArray(err.details)) {
      const fieldErrors = {};
      const general = [];
      for (const { field, issue } of err.details) {
        if (FORM_FIELDS.includes(field)) fieldErrors[field] = issue;
        else general.push(issue.replace(/^Value error, /, ""));
      }
      setErrors(fieldErrors);
      setApiError(general.join(" ") || err.message || "Dữ liệu không hợp lệ.");
      return;
    }
    setApiError(err.message || "Không tạo được cơ sở. Vui lòng thử lại.");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validateFacility(form);
    setErrors(errs);
    setApiError("");
    if (Object.keys(errs).length) { setTab("info"); return; }

    setSubmitting(true);
    try {
      const payload = { ...toFacilityPayload(form) };
      const res = await createFacility(payload);
      navigate("/owner/facilities", {
        state: { created: { id: res.data.id, name: res.data.name } },
      });
    } catch (err) {
      showApiError(err);
    } finally {
      setSubmitting(false);
    }
  };

  const hasErr = (keys) => keys.some((k) => errors[k]);

  return (
    <form onSubmit={handleSubmit} noValidate>
      {/* Page head */}
      <div className="page-head">
        <h1>Thêm cơ sở</h1>
        <button className="btn btn--primary" type="submit" disabled={submitting}>
          {submitting ? "Đang tạo…" : "Tạo cơ sở"}
        </button>
      </div>

      {/* Tabs */}
      <div className="seg seg--scroll fedit__tabs" role="tablist" aria-label="Mục">
        {[
          ["info",   "Thông tin",  hasErr(["name","address","city","district","latitude","longitude","open_time","close_time"])],
          ["courts", "Sân con",    false],
          ["locks",  "Khóa giờ",   false],
        ].map(([k, l, err]) => (
          <button key={k} type="button" role="tab"
            aria-selected={tab === k}
            className={tab === k ? "on" : ""}
            onClick={() => setTab(k)}
          >
            {l}
            {err && <span style={{ width:6, height:6, borderRadius:"50%", background:"var(--danger)", display:"inline-block", marginLeft:6, verticalAlign:1 }} aria-label="Có lỗi" />}
          </button>
        ))}
      </div>

      {/* Tab: Thông tin */}
      {tab === "info" && (
        <div className="fedit__info">

          {/* Cột trái: form */}
          <section className="card">
            {apiError && (
              <div className="notice notice--danger" style={{ marginBottom:16 }}>
                <Icon name="alert" size={16} />{apiError}
              </div>
            )}

            <div className="form-grid">
              {/* Tên cơ sở — full width */}
              <div className="field full">
                <label htmlFor="fc-name">Tên cơ sở</label>
                <input id="fc-name" className="input" type="text"
                  value={form.name} onChange={set("name")}
                  aria-invalid={!!errors.name} />
                {errors.name && <span className="field__err">{errors.name}</span>}
              </div>

              {/* Địa chỉ — full width */}
              <div className="field full">
                <label htmlFor="fc-addr">Địa chỉ</label>
                <input id="fc-addr" className="input" type="text"
                  placeholder="123 Hoàng Hoa Thám, Phường 13, Quận Tân Bình"
                  value={form.address} onChange={set("address")}
                  aria-invalid={!!errors.address} />
                {errors.address && <span className="field__err">{errors.address}</span>}
              </div>

              {/* Thành phố */}
              <div className="field">
                <label htmlFor="fc-city">Thành phố</label>
                <input id="fc-city" className="input" type="text"
                  placeholder="Hồ Chí Minh"
                  value={form.city} onChange={set("city")}
                  aria-invalid={!!errors.city} />
                {errors.city && <span className="field__err">{errors.city}</span>}
              </div>

              {/* Quận huyện */}
              <div className="field">
                <label htmlFor="fc-dist">Quận, huyện <span className="muted small">(không bắt buộc)</span></label>
                <input id="fc-dist" className="input" type="text"
                  placeholder="Quận Tân Bình"
                  value={form.district} onChange={set("district")} />
                {errors.district && <span className="field__err">{errors.district}</span>}
              </div>

              {/* Vĩ độ */}
              <div className="field">
                <label htmlFor="fc-lat">Vĩ độ <span className="muted small">(không bắt buộc)</span></label>
                <input id="fc-lat" className="input mono" type="text"
                  inputMode="decimal" placeholder="10.7992"
                  value={form.latitude} onChange={set("latitude")}
                  aria-invalid={!!errors.latitude} />
                {errors.latitude && <span className="field__err">{errors.latitude}</span>}
              </div>

              {/* Kinh độ */}
              <div className="field">
                <label htmlFor="fc-lng">Kinh độ <span className="muted small">(không bắt buộc)</span></label>
                <input id="fc-lng" className="input mono" type="text"
                  inputMode="decimal" placeholder="106.6501"
                  value={form.longitude} onChange={set("longitude")}
                  aria-invalid={!!errors.longitude} />
                {errors.longitude && <span className="field__err">{errors.longitude}</span>}
              </div>

              {/* Mô tả — full width */}
              <div className="field full">
                <label htmlFor="fc-desc">Mô tả <span className="muted small">(không bắt buộc)</span></label>
                <textarea id="fc-desc" className="textarea"
                  placeholder="Số sân, mặt sân, chỗ để xe..."
                  value={form.description} onChange={set("description")} />
              </div>
            </div>
          </section>

          {/* Cột phải: giờ + tiện ích + ảnh */}
          <section className="card fedit__aside">

            <hr className="divider" />

            {/* Giờ mở cửa */}
            <div>
              <h3>Giờ mở cửa</h3>
              <div className="grid-2" style={{ gap:12, marginTop:12 }}>
                <div className="field">
                  <label htmlFor="fc-open">Mở</label>
                  <select id="fc-open" className="select mono"
                    value={form.open_time} onChange={set("open_time")}
                    aria-invalid={!!errors.open_time}>
                    {HOURS.map((h) => <option key={h} value={h}>{h}</option>)}
                  </select>
                  {errors.open_time && <span className="field__err">{errors.open_time}</span>}
                </div>
                <div className="field">
                  <label htmlFor="fc-close">Đóng</label>
                  <select id="fc-close" className="select mono"
                    value={form.close_time} onChange={set("close_time")}
                    aria-invalid={!!errors.close_time}>
                    {HOURS.map((h) => <option key={h} value={h}>{h}</option>)}
                  </select>
                  {errors.close_time && <span className="field__err">{errors.close_time}</span>}
                </div>
              </div>
            </div>

          </section>
        </div>
      )}

      {/* Tab: Sân con — placeholder */}
      {tab === "courts" && (
        <section className="card">
          <div className="empty">
            <h3>Lưu cơ sở trước</h3>
            <p>Thêm sân con sau khi đã tạo xong cơ sở.</p>
          </div>
        </section>
      )}

      {/* Tab: Khóa giờ — placeholder */}
      {tab === "locks" && (
        <section className="card">
          <div className="empty">
            <h3>Lưu cơ sở trước</h3>
            <p>Khóa giờ sau khi đã tạo xong cơ sở và thêm sân con.</p>
          </div>
        </section>
      )}
    </form>
  );
}
