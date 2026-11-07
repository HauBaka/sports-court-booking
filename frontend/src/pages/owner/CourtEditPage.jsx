import { useEffect, useState } from "react";
import { Link, useNavigate, useOutletContext, useParams } from "react-router-dom";
import Field from "../../components/Field";
import { getCourt, updateCourt } from "../../services/courtService";
import { getFacility } from "../../services/facilityService";
import { formatTime } from "../../utils/format";
import "../../styles/facility.css";

const SPORTS = [
  { id: 1, label: "Cầu lông" },
  { id: 2, label: "Pickleball" },
  { id: 3, label: "Bóng đá 5 người" },
  { id: 4, label: "Bóng đá 7 người" },
  { id: 5, label: "Tennis" },
  { id: 6, label: "Bóng rổ" },
  { id: 7, label: "Bóng chuyền" },
];
const SPORT_LABEL = Object.fromEntries(SPORTS.map((s) => [s.id, s.label]));

const ENVIRONMENTS = [
  { value: "INDOOR", label: "Trong nhà (Indoor)" },
  { value: "OUTDOOR", label: "Ngoài trời (Outdoor)" },
];

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const toHHmm = (t) => (t ? t.slice(0, 5) : "");

export default function CourtEditPage() {
  const { courtId } = useParams();
  const { user } = useOutletContext();
  const navigate = useNavigate();

  const [court, setCourt] = useState(null);
  const [facility, setFacility] = useState(null);
  const [loadStatus, setLoadStatus] = useState("loading");
  const [loadError, setLoadError] = useState("");

  const [form, setForm] = useState(null);
  const [errors, setErrors] = useState({});
  const [apiError, setApiError] = useState("");
  const [saving, setSaving] = useState(false);

  // ── Load ──
  useEffect(() => {
    let cancelled = false;
    setLoadStatus("loading");
    setLoadError("");

    getCourt(courtId)
      .then(async (res) => {
        if (cancelled) return;
        const c = res.data;
        const fRes = await getFacility(c.facility_id);
        if (cancelled) return;
        const f = fRes.data;
        if (f.owner_id !== user.id) {
          navigate("/owner/facilities", { replace: true });
          return;
        }
        setCourt(c);
        setFacility(f);
        setForm({
          name: c.name,
          court_type: c.court_type ?? "",
          environment: c.environment,
          open_time: toHHmm(c.open_time),
          close_time: toHHmm(c.close_time),
          is_active: c.is_active,
        });
        setLoadStatus("ready");
      })
      .catch((err) => {
        if (cancelled) return;
        if (err.code === "RESOURCE_NOT_FOUND") {
          navigate("/owner/facilities", { replace: true });
        } else {
          setLoadError(err.message || "Không tải được thông tin sân.");
          setLoadStatus("error");
        }
      });

    return () => { cancelled = true; };
  }, [courtId, user.id, navigate]);

  // ── Validate ──
  const validate = (f) => {
    const errs = {};
    if (!f.name.trim()) errs.name = "Vui lòng nhập tên sân.";
    if (!f.environment) errs.environment = "Vui lòng chọn môi trường.";

    const openOk = TIME_RE.test(f.open_time);
    const closeOk = TIME_RE.test(f.close_time);
    if (!openOk) errs.open_time = "Vui lòng chọn giờ mở cửa.";
    if (!closeOk) errs.close_time = "Vui lòng chọn giờ đóng cửa.";

    if (openOk && closeOk) {
      if (f.open_time >= f.close_time) {
        errs.close_time = "Giờ đóng cửa phải sau giờ mở cửa.";
      } else {
        const facOpen = toHHmm(facility.open_time);
        const facClose = toHHmm(facility.close_time);
        if (f.open_time < facOpen || f.close_time > facClose) {
          errs.open_time = `Phải nằm trong giờ cơ sở: ${facOpen} – ${facClose}.`;
        }
      }
    }
    return errs;
  };

  // ── Submit ──
  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate(form);
    setErrors(errs);
    setApiError("");
    if (Object.keys(errs).length) return;

    setSaving(true);
    try {
      const res = await updateCourt(courtId, {
        name: form.name.trim(),
        court_type: form.court_type.trim() || "STANDARD",
        environment: form.environment,
        open_time: `${form.open_time}:00`,
        close_time: `${form.close_time}:00`,
        is_active: form.is_active,
      });
      // Sau khi lưu thành công → về trang chi tiết
      navigate(`/owner/facilities/${facility.id}`, { replace: true });
    } catch (err) {
      if (err.code === "VALIDATION_ERROR" && Array.isArray(err.details)) {
        const fieldErrs = {};
        const general = [];
        for (const { field, issue } of err.details) {
          if (["name", "court_type", "environment", "open_time", "close_time"].includes(field)) {
            fieldErrs[field] = issue;
          } else {
            general.push(issue.replace(/^Value error, /, ""));
          }
        }
        setErrors(fieldErrs);
        setApiError(general.join(" ") || err.message || "Dữ liệu không hợp lệ.");
      } else if (err.code === "CANNOT_UPDATE_COURT_SCHEDULE_ACTIVE_BOOKINGS") {
        setApiError("Không thể thay đổi giờ vì đang có lịch đặt cọc trong tương lai. Vui lòng liên hệ khách hàng dời lịch trước.");
      } else if (err.code === "CANNOT_DEACTIVATE_COURT_ACTIVE_BOOKINGS") {
        setApiError("Không thể tạm ngưng sân vì đang có lịch đặt cọc trong tương lai.");
      } else {
        setApiError(err.message || "Không cập nhật được sân. Vui lòng thử lại.");
      }
    } finally {
      setSaving(false);
    }
  };

  const set = (key) => (e) => {
    const value = e.target.type === "checkbox" ? e.target.checked : e.target.value;
    setForm((f) => ({ ...f, [key]: value }));
  };
  const cls = (key) => `input${errors[key] ? " invalid" : ""}`;

  // ── Render ──
  if (loadStatus === "loading") {
    return <div className="owner-page"><p>Đang tải...</p></div>;
  }

  if (loadStatus === "error") {
    return (
      <div className="owner-page">
        <p className="notice error" role="alert">{loadError}</p>
        <Link className="btn btn-outline btn-link" to="/owner/facilities">← Quay lại</Link>
      </div>
    );
  }

  return (
    <div className="owner-page">
      {/* ── Header ── */}
      <div className="page-head">
        <div>
          <Link className="back-link" to={`/owner/facilities/${facility.id}`}>←</Link>
          <h1>Sửa thông tin sân</h1>
          <p className="facility-address">
            {SPORT_LABEL[court.sport_id] ?? `Môn #${court.sport_id}`}
            {" · "}
            {facility.name}
          </p>
        </div>
      </div>

      {/* ── Form ── */}
      <section className="detail-section">
        <form className="inline-form" onSubmit={handleSubmit} noValidate>
          {apiError && (
            <p className="notice error" role="alert">{apiError}</p>
          )}

          <Field label="Tên sân" htmlFor="court_name" error={errors.name}>
            <input
              id="court_name"
              className={cls("name")}
              type="text"
              value={form.name}
              onChange={set("name")}
            />
          </Field>

          <div className="form-grid">
            <Field label="Môi trường" htmlFor="court_env" error={errors.environment}>
              <select
                id="court_env"
                className={cls("environment")}
                value={form.environment}
                onChange={set("environment")}
              >
                {ENVIRONMENTS.map((env) => (
                  <option key={env.value} value={env.value}>{env.label}</option>
                ))}
              </select>
            </Field>

            <Field label="Loại sân" htmlFor="court_type" error={errors.court_type}>
              <input
                id="court_type"
                className={cls("court_type")}
                type="text"
                placeholder="VD: STANDARD"
                value={form.court_type}
                onChange={set("court_type")}
              />
            </Field>

            <Field label="Giờ mở cửa" htmlFor="court_open" error={errors.open_time}>
              <input
                id="court_open"
                className={cls("open_time")}
                type="time"
                value={form.open_time}
                onChange={set("open_time")}
              />
            </Field>

            <Field label="Giờ đóng cửa" htmlFor="court_close" error={errors.close_time}>
              <input
                id="court_close"
                className={cls("close_time")}
                type="time"
                value={form.close_time}
                onChange={set("close_time")}
              />
            </Field>
          </div>

          <p className="hint">
            Giờ sân phải nằm trong giờ cơ sở:&nbsp;
            <strong>{formatTime(facility.open_time)} – {formatTime(facility.close_time)}</strong>.
          </p>

          <div className="court-active-toggle">
            <label className="toggle-label" htmlFor="is_active">
              <input
                id="is_active"
                type="checkbox"
                checked={form.is_active}
                onChange={set("is_active")}
              />
              <span>Sân đang hoạt động</span>
            </label>
            <p className="hint">Tắt để ẩn sân khỏi danh sách nhận lịch đặt mới.</p>
          </div>

          <div className="form-actions">
            <Link
              className="btn btn-outline btn-link"
              to={`/owner/facilities/${facility.id}`}
            >
              Hủy
            </Link>
            <button className="btn" type="submit" disabled={saving}>
              {saving ? "Đang lưu..." : "Lưu thay đổi"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
