import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Field from "../../components/Field";
import { createFacility } from "../../services/facilityService";
import { EMPTY_FORM, toFacilityPayload, validateFacility } from "../../utils/facilityForm";
import "../../styles/facility.css";

// Tên field backend trả trong details của VALIDATION_ERROR (trùng key của form)
const FORM_FIELDS = Object.keys(EMPTY_FORM);

export default function FacilityCreatePage() {
  const navigate = useNavigate();
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [apiError, setApiError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const cls = (key) => `input${errors[key] ? " invalid" : ""}`;

  const showApiError = (err) => {
    if (err.code === "VALIDATION_ERROR" && Array.isArray(err.details)) {
      const fieldErrors = {};
      const general = [];
      for (const { field, issue } of err.details) {
        // Lỗi gắn với cả form (ví dụ giờ mở cửa sau giờ đóng cửa) backend trả field "body"
        if (FORM_FIELDS.includes(field)) fieldErrors[field] = issue;
        else general.push(issue.replace(/^Value error, /, ""));
      }
      setErrors(fieldErrors);
      return setApiError(general.join(" ") || err.message || "Dữ liệu gửi lên không hợp lệ.");
    }
    return setApiError(err.message || "Không tạo được cơ sở. Vui lòng thử lại.");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validateFacility(form);
    setErrors(errs);
    setApiError("");
    if (Object.keys(errs).length) return;

    setSubmitting(true);
    try {
      const res = await createFacility(toFacilityPayload(form));
      navigate("/owner/facilities", { state: { created: { id: res.data.id, name: res.data.name } } });
    } catch (err) {
      showApiError(err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="owner-page">
      <div className="page-head">
        <div className="page-head-left">
          <Link className="back-link" to="/owner/facilities">←</Link>
          <h1>Thêm cơ sở mới</h1>
        </div>
      </div>

      <form className="facility-form" onSubmit={handleSubmit} noValidate>
        {apiError && (
          <p className="notice error" role="alert">
            {apiError}
          </p>
        )}

        <Field label="Tên cơ sở" htmlFor="name" error={errors.name}>
          <input id="name" className={cls("name")} type="text"
            placeholder="Cơ Sở Cầu Lông Tân Bình" value={form.name} onChange={set("name")} />
        </Field>

        <Field label="Địa chỉ" htmlFor="address" error={errors.address}>
          <input id="address" className={cls("address")} type="text"
            placeholder="123 Hoàng Hoa Thám, Phường 13" value={form.address} onChange={set("address")} />
        </Field>

        <div className="form-grid">
          <Field label="Tỉnh/Thành phố" htmlFor="city" error={errors.city}>
            <input id="city" className={cls("city")} type="text" value={form.city} onChange={set("city")} />
          </Field>
          <Field label="Quận/Huyện (không bắt buộc)" htmlFor="district" error={errors.district}>
            <input id="district" className={cls("district")} type="text"
              placeholder="Quận Tân Bình" value={form.district} onChange={set("district")} />
          </Field>

          <Field label="Vĩ độ" htmlFor="latitude" error={errors.latitude}>
            <input id="latitude" className={cls("latitude")} type="text" inputMode="decimal"
              placeholder="10.7992" value={form.latitude} onChange={set("latitude")} />
          </Field>
          <Field label="Kinh độ" htmlFor="longitude" error={errors.longitude}>
            <input id="longitude" className={cls("longitude")} type="text" inputMode="decimal"
              placeholder="106.6501" value={form.longitude} onChange={set("longitude")} />
          </Field>

          <Field label="Giờ mở cửa" htmlFor="open_time" error={errors.open_time}>
            <input id="open_time" className={cls("open_time")} type="time"
              value={form.open_time} onChange={set("open_time")} />
          </Field>
          <Field label="Giờ đóng cửa" htmlFor="close_time" error={errors.close_time}>
            <input id="close_time" className={cls("close_time")} type="time"
              value={form.close_time} onChange={set("close_time")} />
          </Field>
        </div>
        <p className="hint">Tọa độ không bắt buộc, nếu nhập thì cần đủ cả vĩ độ và kinh độ.</p>

        <Field label="Mô tả (không bắt buộc)" htmlFor="description" error={errors.description}>
          <textarea id="description" className={cls("description")}
            value={form.description} onChange={set("description")} />
        </Field>

        <div className="form-actions">
          <Link className="btn btn-outline btn-link" to="/owner/facilities">
            Hủy
          </Link>
          <button className="btn" type="submit" disabled={submitting}>
            {submitting ? "Đang tạo..." : "Tạo cơ sở"}
          </button>
        </div>
      </form>
    </div>
  );
}
