import { useEffect, useState } from "react";
import Field from "./Field";
import { getHolidays, savePricingRules } from "../services/pricingService";
import "../styles/facility.css";
import "../styles/pricing.css";

const RULE_TYPES = [
  { value: "PEAK_HOUR", label: "Giờ cao điểm" },
  { value: "WEEKEND",   label: "Cuối tuần" },
  { value: "HOLIDAY",   label: "Ngày lễ" },
];

const DAY_OF_WEEK_OPTIONS = [
  { value: 6, label: "Thứ Bảy" },
  { value: 7, label: "Chủ Nhật" },
];

const MULTIPLIER_MIN = 1.20;
const MULTIPLIER_MAX = 1.50;
const MULTIPLIER_STEP = 0.05;

const emptyRule = () => ({
  _key: crypto.randomUUID(),
  name: "",
  rule_type: "PEAK_HOUR",
  multiplier: "1.30",
  // PEAK_HOUR
  start_time: "",
  end_time: "",
  // WEEKEND
  day_of_week: "",
  // HOLIDAY
  holiday_id: "",
});

// ── localStorage helpers ──
const storageKey = (facilityId) => `pricing_rules_${facilityId}`;

function loadFromStorage(facilityId) {
  try {
    const raw = localStorage.getItem(storageKey(facilityId));
    if (!raw) return [];
    // Restore payload thành form state (thêm _key cho mỗi rule)
    return JSON.parse(raw).map((r) => ({
      _key: crypto.randomUUID(),
      name: r.name,
      rule_type: r.rule_type,
      multiplier: String(r.multiplier),
      start_time: r.start_time ? r.start_time.slice(0, 5) : "",
      end_time:   r.end_time   ? r.end_time.slice(0, 5)   : "",
      day_of_week: r.day_of_week != null ? String(r.day_of_week) : "",
      holiday_id:  r.holiday_id  != null ? String(r.holiday_id)  : "",
    }));
  } catch (_e) {
    return [];
  }
}

function saveToStorage(facilityId, payload) {
  try {
    localStorage.setItem(storageKey(facilityId), JSON.stringify(payload));
  } catch (_e) { /* quota exceeded — bỏ qua */ }
}

function clearStorage(facilityId) {
  localStorage.removeItem(storageKey(facilityId));
}

function validateRule(rule, index) {
  const errs = {};
  if (!rule.name.trim()) errs.name = "Vui lòng nhập tên quy tắc.";

  const m = parseFloat(rule.multiplier);
  if (isNaN(m) || m < MULTIPLIER_MIN || m > MULTIPLIER_MAX) {
    errs.multiplier = `Hệ số phải từ ${MULTIPLIER_MIN} đến ${MULTIPLIER_MAX}.`;
  }

  if (rule.rule_type === "PEAK_HOUR") {
    const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
    if (!TIME_RE.test(rule.start_time)) errs.start_time = "Vui lòng chọn giờ bắt đầu.";
    if (!TIME_RE.test(rule.end_time))   errs.end_time   = "Vui lòng chọn giờ kết thúc.";
    if (!errs.start_time && !errs.end_time && rule.start_time >= rule.end_time) {
      errs.end_time = "Giờ kết thúc phải sau giờ bắt đầu.";
    }
  }

  if (rule.rule_type === "WEEKEND") {
    if (!rule.day_of_week) errs.day_of_week = "Vui lòng chọn thứ trong tuần.";
  }

  if (rule.rule_type === "HOLIDAY") {
    if (!rule.holiday_id) errs.holiday_id = "Vui lòng chọn ngày lễ.";
  }

  return Object.keys(errs).length ? { [`${index}`]: errs } : null;
}

export default function PricingRulesSection({ facilityId }) {
  const [holidays, setHolidays] = useState([]);
  const [loadingHolidays, setLoadingHolidays] = useState(true);

  const [rules, setRules] = useState(() => loadFromStorage(facilityId));
  const [errors, setErrors] = useState({}); // { "index.field": message }
  const [apiError, setApiError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Load holidays
  useEffect(() => {
    getHolidays()
      .then((res) => setHolidays(res.data))
      .catch(() => {/* holidays optional */})
      .finally(() => setLoadingHolidays(false));
  }, []);

  // ── Helpers ──
  const updateRule = (key, field, value) =>
    setRules((prev) =>
      prev.map((r) => (r._key === key ? { ...r, [field]: value } : r))
    );

  const addRule = () => setRules((prev) => [...prev, emptyRule()]);

  const removeRule = (key) =>
    setRules((prev) => prev.filter((r) => r._key !== key));

  const fieldErr = (index, field) => errors[`${index}.${field}`] || "";

  // ── Submit ──
  const handleSave = async (e) => {
    e.preventDefault();
    setApiError("");
    setSaved(false);

    // Client-side validate toàn bộ rules
    const allErrs = {};
    rules.forEach((rule, i) => {
      const errs = validateRule(rule, i);
      if (errs) Object.assign(allErrs, flattenErrs(errs, i));
    });
    if (Object.keys(allErrs).length) {
      setErrors(allErrs);
      return;
    }
    setErrors({});

    // Build payload
    const payload = rules.map((r) => ({
      name: r.name.trim(),
      rule_type: r.rule_type,
      multiplier: parseFloat(r.multiplier),
      start_time:  r.rule_type === "PEAK_HOUR" ? `${r.start_time}:00` : null,
      end_time:    r.rule_type === "PEAK_HOUR" ? `${r.end_time}:00`   : null,
      day_of_week: r.rule_type === "WEEKEND"   ? Number(r.day_of_week) : null,
      holiday_id:  r.rule_type === "HOLIDAY"   ? Number(r.holiday_id)  : null,
    }));

    setSaving(true);
    try {
      await savePricingRules(facilityId, payload);
      saveToStorage(facilityId, payload);
      setSaved(true);
    } catch (err) {
      if (err.code === "VALIDATION_ERROR" && Array.isArray(err.details)) {
        const apiErrs = {};
        for (const { field, issue } of err.details) {
          // field dạng "rules.0" → map về index
          const m = /^rules\.(\d+)$/.exec(field);
          if (m) apiErrs[`${m[1]}._rule`] = issue.replace(/^Value error, /, "");
          else apiErrs[`_general`] = issue.replace(/^Value error, /, "");
        }
        setErrors(apiErrs);
        setApiError(err.message || "Dữ liệu không hợp lệ.");
      } else {
        setApiError(err.message || "Không lưu được quy tắc giá. Vui lòng thử lại.");
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="detail-section">
      <div className="section-head">
        <h2>Quy tắc giá theo thời điểm</h2>
        <button className="btn btn-sm btn-outline" type="button" onClick={addRule}>
          + Thêm quy tắc
        </button>
      </div>

      <p className="hint pricing-hint">
        Hệ số nhân áp dụng lên giá cơ sở của từng sân con. Nếu nhiều quy tắc cùng khớp, hệ số cao nhất được dùng.
        Nhấn <strong>Lưu bảng giá</strong> để áp dụng.
        {rules.length > 0 && !saved && (
          <span className="pricing-cached-note"> · Hiển thị từ lần lưu trước.</span>
        )}
      </p>

      {saved && (
        <p className="notice success" role="status">
          Đã lưu bảng giá thành công.
        </p>
      )}

      {apiError && (
        <p className="notice error" role="alert">{apiError}</p>
      )}

      <form onSubmit={handleSave} noValidate>
        {rules.length === 0 && (
          <div className="empty pricing-empty">
            <p>Chưa có quy tắc nào. Bấm "+ Thêm quy tắc" để bắt đầu.</p>
          </div>
        )}

        <div className="rules-list">
          {rules.map((rule, index) => (
            <div key={rule._key} className="rule-card">
              {/* Lỗi cấp rule từ API */}
              {errors[`${index}._rule`] && (
                <p className="notice error rule-api-error" role="alert">
                  {errors[`${index}._rule`]}
                </p>
              )}

              <div className="rule-header">
                <span className="rule-index">Quy tắc {index + 1}</span>
                <button
                  className="btn-remove"
                  type="button"
                  aria-label="Xóa quy tắc"
                  onClick={() => removeRule(rule._key)}
                >
                  ✕
                </button>
              </div>

              <div className="form-grid rule-grid">
                {/* Tên */}
                <Field label="Tên quy tắc" htmlFor={`rule_name_${index}`} error={fieldErr(index, "name")}>
                  <input
                    id={`rule_name_${index}`}
                    className={`input${fieldErr(index, "name") ? " invalid" : ""}`}
                    type="text"
                    placeholder="VD: Giờ vàng buổi tối"
                    value={rule.name}
                    onChange={(e) => updateRule(rule._key, "name", e.target.value)}
                  />
                </Field>

                {/* Loại */}
                <Field label="Loại quy tắc" htmlFor={`rule_type_${index}`}>
                  <select
                    id={`rule_type_${index}`}
                    className="input"
                    value={rule.rule_type}
                    onChange={(e) => updateRule(rule._key, "rule_type", e.target.value)}
                  >
                    {RULE_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </Field>

                {/* Hệ số */}
                <Field
                  label={`Hệ số (${MULTIPLIER_MIN}–${MULTIPLIER_MAX})`}
                  htmlFor={`rule_mult_${index}`}
                  error={fieldErr(index, "multiplier")}
                >
                  <input
                    id={`rule_mult_${index}`}
                    className={`input${fieldErr(index, "multiplier") ? " invalid" : ""}`}
                    type="number"
                    min={MULTIPLIER_MIN}
                    max={MULTIPLIER_MAX}
                    step={MULTIPLIER_STEP}
                    value={rule.multiplier}
                    onChange={(e) => updateRule(rule._key, "multiplier", e.target.value)}
                  />
                </Field>

                {/* PEAK_HOUR: start_time + end_time */}
                {rule.rule_type === "PEAK_HOUR" && (
                  <>
                    <Field label="Giờ bắt đầu" htmlFor={`rule_start_${index}`} error={fieldErr(index, "start_time")}>
                      <input
                        id={`rule_start_${index}`}
                        className={`input${fieldErr(index, "start_time") ? " invalid" : ""}`}
                        type="time"
                        value={rule.start_time}
                        onChange={(e) => updateRule(rule._key, "start_time", e.target.value)}
                      />
                    </Field>
                    <Field label="Giờ kết thúc" htmlFor={`rule_end_${index}`} error={fieldErr(index, "end_time")}>
                      <input
                        id={`rule_end_${index}`}
                        className={`input${fieldErr(index, "end_time") ? " invalid" : ""}`}
                        type="time"
                        value={rule.end_time}
                        onChange={(e) => updateRule(rule._key, "end_time", e.target.value)}
                      />
                    </Field>
                  </>
                )}

                {/* WEEKEND: day_of_week */}
                {rule.rule_type === "WEEKEND" && (
                  <Field label="Thứ trong tuần" htmlFor={`rule_dow_${index}`} error={fieldErr(index, "day_of_week")}>
                    <select
                      id={`rule_dow_${index}`}
                      className={`input${fieldErr(index, "day_of_week") ? " invalid" : ""}`}
                      value={rule.day_of_week}
                      onChange={(e) => updateRule(rule._key, "day_of_week", e.target.value)}
                    >
                      <option value="">-- Chọn thứ --</option>
                      {DAY_OF_WEEK_OPTIONS.map((d) => (
                        <option key={d.value} value={d.value}>{d.label}</option>
                      ))}
                    </select>
                  </Field>
                )}

                {/* HOLIDAY: holiday_id */}
                {rule.rule_type === "HOLIDAY" && (
                  <Field label="Ngày lễ" htmlFor={`rule_hol_${index}`} error={fieldErr(index, "holiday_id")}>
                    <select
                      id={`rule_hol_${index}`}
                      className={`input${fieldErr(index, "holiday_id") ? " invalid" : ""}`}
                      value={rule.holiday_id}
                      onChange={(e) => updateRule(rule._key, "holiday_id", e.target.value)}
                      disabled={loadingHolidays}
                    >
                      <option value="">-- Chọn ngày lễ --</option>
                      {holidays.map((h) => (
                        <option key={h.id} value={h.id}>
                          {h.name} ({h.holiday_date})
                        </option>
                      ))}
                    </select>
                  </Field>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Nút lưu — chỉ hiện khi có ít nhất 1 rule */}
        {rules.length > 0 && (
          <div className="form-actions pricing-actions">
            <button
              className="btn btn-outline"
              type="button"
              onClick={() => { setRules([]); setErrors({}); setApiError(""); setSaved(false); clearStorage(facilityId); }}
            >
              Xóa tất cả
            </button>
            <button className="btn" type="submit" disabled={saving}>
              {saving ? "Đang lưu..." : "Lưu bảng giá"}
            </button>
          </div>
        )}
      </form>
    </section>
  );
}

// ── Helpers ──
function flattenErrs(ruleErrs, index) {
  const flat = {};
  const errsObj = ruleErrs[`${index}`] || {};
  for (const [field, msg] of Object.entries(errsObj)) {
    flat[`${index}.${field}`] = msg;
  }
  return flat;
}
