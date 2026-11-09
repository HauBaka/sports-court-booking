import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useOutletContext, useParams } from "react-router-dom";
import Field from "../../components/Field";
import PricingRulesSection from "../../components/PricingRulesSection";
import { createCourt, getFacility } from "../../services/facilityService";
import { formatTime } from "../../utils/format";
import "../../styles/facility.css";

// Danh sách môn thể thao (không có endpoint /sports, hardcode theo dữ liệu thực tế).
const SPORTS = [
  { id: 1, label: "Cầu lông" },
  { id: 2, label: "Pickleball" },
  { id: 3, label: "Bóng đá mini" },
];
const SPORT_LABEL = Object.fromEntries(SPORTS.map((s) => [s.id, s.label]));

const ENVIRONMENTS = [
  { value: "INDOOR", label: "Trong nhà (Indoor)" },
  { value: "OUTDOOR", label: "Ngoài trời (Outdoor)" },
];

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

const EMPTY_COURT = {
  name: "",
  sport_id: "",
  court_type: "",
  environment: "",
  open_time: "",
  close_time: "",
  default_base_price: "",
};

export default function FacilityDetailPage() {
  const { id } = useParams();
  const { user } = useOutletContext();
  const navigate = useNavigate();
  const location = useLocation();
  const updatedCourt = location.state?.updatedCourt;

  const [facility, setFacility] = useState(null);
  const [courts, setCourts] = useState([]);
  const [loadStatus, setLoadStatus] = useState("loading"); // loading | ready | error
  const [loadError, setLoadError] = useState("");

  // ── Thêm sân con ──
  const [showCourtForm, setShowCourtForm] = useState(false);
  const [courtForm, setCourtForm] = useState(EMPTY_COURT);
  const [courtErrors, setCourtErrors] = useState({});
  const [courtApiError, setCourtApiError] = useState("");
  const [addingCourt, setAddingCourt] = useState(false);

  // ── Load ──
  useEffect(() => {
    let cancelled = false;
    setLoadStatus("loading");
    setLoadError("");

    getFacility(id)
      .then((res) => {
        if (cancelled) return;
        const f = res.data;
        if (f.owner_id !== user.id) {
          navigate("/owner/facilities", { replace: true });
          return;
        }
        setFacility(f);
        // Nếu vừa cập nhật một sân con (navigate từ CourtDetailPage), sync lại court đó.
        const raw = f.courts ?? [];
        if (updatedCourt) {
          setCourts(raw.map((c) => (c.id === updatedCourt.id ? updatedCourt : c)));
        } else {
          setCourts(raw);
        }
        setLoadStatus("ready");
      })
      .catch((err) => {
        if (cancelled) return;
        if (err.code === "RESOURCE_NOT_FOUND") {
          navigate("/owner/facilities", { replace: true });
        } else {
          setLoadError(err.message || "Không tải được thông tin cơ sở.");
          setLoadStatus("error");
        }
      });

    return () => { cancelled = true; };
  }, [id, user.id, navigate]);

  // ── Helpers ──
  const setCourtField = (key) => (e) =>
    setCourtForm((f) => ({ ...f, [key]: e.target.value }));

  const clsCourt = (key) => `input${courtErrors[key] ? " invalid" : ""}`;

  // ── Thêm sân con ────────────────────────────────────────────────────────

  const validateCourt = (f, facilityOpenTime, facilityCloseTime) => {
    const errors = {};

    if (!f.name.trim()) errors.name = "Vui lòng nhập tên sân.";
    if (!f.sport_id) errors.sport_id = "Vui lòng chọn môn thể thao.";
    if (!f.environment) errors.environment = "Vui lòng chọn môi trường thi đấu.";

    const openOk = TIME_RE.test(f.open_time);
    const closeOk = TIME_RE.test(f.close_time);
    if (!openOk) errors.open_time = "Vui lòng chọn giờ mở cửa.";
    if (!closeOk) errors.close_time = "Vui lòng chọn giờ đóng cửa.";

    if (openOk && closeOk) {
      if (f.open_time >= f.close_time) {
        errors.close_time = "Giờ đóng cửa phải sau giờ mở cửa.";
      } else {
        // Giờ sân con phải nằm trong giờ của facility
        const facOpen = facilityOpenTime.slice(0, 5);
        const facClose = facilityCloseTime.slice(0, 5);
        if (f.open_time < facOpen || f.close_time > facClose) {
          errors.open_time = `Phải nằm trong giờ cơ sở: ${facOpen} – ${facClose}.`;
        }
      }
    }

    const price = Number(f.default_base_price);
    if (f.default_base_price === "") {
      errors.default_base_price = "Vui lòng nhập giá thuê sân.";
    } else if (!Number.isInteger(price) || price < 0) {
      errors.default_base_price = "Giá phải là số nguyên không âm.";
    }

    return errors;
  };

  const handleAddCourt = async (e) => {
    e.preventDefault();
    const errs = validateCourt(courtForm, facility.open_time, facility.close_time);
    setCourtErrors(errs);
    setCourtApiError("");
    if (Object.keys(errs).length) return;

    setAddingCourt(true);
    try {
      const res = await createCourt(id, {
        name: courtForm.name.trim(),
        sport_id: Number(courtForm.sport_id),
        court_type: courtForm.court_type.trim() || "STANDARD",
        environment: courtForm.environment,
        open_time: `${courtForm.open_time}:00`,
        close_time: `${courtForm.close_time}:00`,
        default_base_price: Number(courtForm.default_base_price),
      });
      setCourts((prev) => [...prev, res.data]);
      setCourtForm(EMPTY_COURT);
      setShowCourtForm(false);
    } catch (err) {
      if (err.code === "VALIDATION_ERROR" && Array.isArray(err.details)) {
        const fieldErrs = {};
        const general = [];
        for (const { field, issue } of err.details) {
          if (field in EMPTY_COURT) fieldErrs[field] = issue;
          else general.push(issue.replace(/^Value error, /, ""));
        }
        setCourtErrors(fieldErrs);
        setCourtApiError(general.join(" ") || err.message || "Dữ liệu không hợp lệ.");
      } else {
        setCourtApiError(err.message || "Không thêm được sân. Vui lòng thử lại.");
      }
    } finally {
      setAddingCourt(false);
    }
  };

  const cancelCourtForm = () => {
    setShowCourtForm(false);
    setCourtForm(EMPTY_COURT);
    setCourtErrors({});
    setCourtApiError("");
  };

  // ── Render ───────────────────────────────────────────────────────────────

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
          <Link className="back-link" to="/owner/facilities">←</Link>
          <h1>{facility.name}</h1>
          <p className="facility-address">
            {facility.address}{facility.district ? `, ${facility.district}` : ""}, {facility.city}
          </p>
        </div>
        <div className="facility-hours-badge">
          <span className="facility-hours-label">Giờ mở cửa</span>
          <span className="facility-hours-value">
            {formatTime(facility.open_time)} – {formatTime(facility.close_time)}
          </span>
        </div>
      </div>

      {/* ── Danh sách sân con ── */}
      <section className="detail-section">
        <div className="section-head">
          <h2>Sân con ({courts.length})</h2>
          {!showCourtForm && (
            <button className="btn btn-sm" type="button" onClick={() => setShowCourtForm(true)}>
              + Thêm sân
            </button>
          )}
        </div>

        {/* Form thêm sân con */}
        {showCourtForm && (
          <form className="inline-form court-form" onSubmit={handleAddCourt} noValidate>
            {courtApiError && (
              <p className="notice error" role="alert">{courtApiError}</p>
            )}

            <Field label="Tên sân" htmlFor="court_name" error={courtErrors.name}>
              <input
                id="court_name"
                className={clsCourt("name")}
                type="text"
                placeholder="VD: Sân Cầu Lông A1"
                value={courtForm.name}
                onChange={setCourtField("name")}
              />
            </Field>

            <div className="form-grid">
              <Field label="Môn thể thao" htmlFor="court_sport" error={courtErrors.sport_id}>
                <select
                  id="court_sport"
                  className={clsCourt("sport_id")}
                  value={courtForm.sport_id}
                  onChange={setCourtField("sport_id")}
                >
                  <option value="">-- Chọn môn --</option>
                  {SPORTS.map((s) => (
                    <option key={s.id} value={s.id}>{s.label}</option>
                  ))}
                </select>
              </Field>

              <Field label="Môi trường" htmlFor="court_env" error={courtErrors.environment}>
                <select
                  id="court_env"
                  className={clsCourt("environment")}
                  value={courtForm.environment}
                  onChange={setCourtField("environment")}
                >
                  <option value="">-- Chọn môi trường --</option>
                  {ENVIRONMENTS.map((env) => (
                    <option key={env.value} value={env.value}>{env.label}</option>
                  ))}
                </select>
              </Field>

              <Field label="Giờ mở cửa sân" htmlFor="court_open" error={courtErrors.open_time}>
                <input
                  id="court_open"
                  className={clsCourt("open_time")}
                  type="time"
                  value={courtForm.open_time}
                  onChange={setCourtField("open_time")}
                />
              </Field>

              <Field label="Giờ đóng cửa sân" htmlFor="court_close" error={courtErrors.close_time}>
                <input
                  id="court_close"
                  className={clsCourt("close_time")}
                  type="time"
                  value={courtForm.close_time}
                  onChange={setCourtField("close_time")}
                />
              </Field>
            </div>

            <p className="hint">
              Giờ sân phải nằm trong giờ cơ sở:&nbsp;
              <strong>{formatTime(facility.open_time)} – {formatTime(facility.close_time)}</strong>.
            </p>

            <div className="form-grid">
              <Field
                label="Loại sân (không bắt buộc)"
                htmlFor="court_type"
                error={courtErrors.court_type}
              >
                <input
                  id="court_type"
                  className={clsCourt("court_type")}
                  type="text"
                  placeholder="VD: STANDARD, Tiêu chuẩn thi đấu"
                  value={courtForm.court_type}
                  onChange={setCourtField("court_type")}
                />
              </Field>

              <Field label="Giá thuê mặc định / giờ (₫)" htmlFor="court_price" error={courtErrors.default_base_price}>
                <input
                  id="court_price"
                  className={clsCourt("default_base_price")}
                  type="number"
                  min="0"
                  step="1000"
                  placeholder="100000"
                  value={courtForm.default_base_price}
                  onChange={setCourtField("default_base_price")}
                />
              </Field>
            </div>

            <div className="form-actions">
              <button className="btn btn-outline" type="button" onClick={cancelCourtForm}>
                Hủy
              </button>
              <button className="btn" type="submit" disabled={addingCourt}>
                {addingCourt ? "Đang thêm..." : "Thêm sân"}
              </button>
            </div>
          </form>
        )}

        {/* Danh sách sân */}
        {courts.length === 0 ? (
          <div className="empty">
            <p>Cơ sở chưa có sân con nào.</p>
          </div>
        ) : (
          <ul className="court-list">
            {courts.map((c) => (
              <li key={c.id} className={`court-card${!c.is_active ? " court-inactive" : ""}`}>
                <div className="court-info">
                  <span className="court-name">{c.name}</span>
                  <span className="court-sport">
                    {SPORT_LABEL[c.sport_id] ?? `Môn #${c.sport_id}`}
                    {" · "}
                    {c.court_type}
                    {" · "}
                    {c.environment === "INDOOR" ? "Trong nhà" : "Ngoài trời"}
                  </span>
                </div>
                <div className="court-right">
                  <span className="court-hours">
                    {formatTime(c.open_time)} – {formatTime(c.close_time)}
                  </span>
                  {!c.is_active && (
                    <span className="badge badge-inactive">Ngừng hoạt động</span>
                  )}
                  <Link
                    className="btn btn-sm btn-outline btn-link"
                    to={`/owner/courts/${c.id}`}
                  >
                    Chi tiết
                  </Link>
                  <Link
                    className="btn btn-sm btn-link"
                    to={`/owner/courts/${c.id}/edit`}
                  >
                    Sửa
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── Quy tắc giá ── */}
      <PricingRulesSection facilityId={id} />
    </div>
  );
}
