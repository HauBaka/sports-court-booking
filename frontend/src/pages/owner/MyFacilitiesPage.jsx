import { useEffect, useState } from "react";
import { Link, useLocation, useOutletContext } from "react-router-dom";
import { listMyFacilities } from "../../services/facilityService";
import { formatTime, formatPriceRange } from "../../utils/format";
import Icon from "../../components/ui/Icon";

export default function MyFacilitiesPage() {
  const { user } = useOutletContext();
  const location = useLocation();
  const created = location.state?.created;
  const [reloadKey, setReloadKey] = useState(0);
  const [state, setState] = useState({ status: "loading", items: [], error: "" });

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading", items: [], error: "" });
    listMyFacilities(user.id)
      .then((items) => {
        if (!cancelled) setState({ status: "ready", items, error: "" });
      })
      .catch((err) => {
        if (!cancelled)
          setState({ status: "error", items: [], error: err.message || "Không tải được danh sách cơ sở." });
      });
    return () => { cancelled = true; };
  }, [user.id, reloadKey]);

  const { status, items, error } = state;

  return (
    <>
      <div className="page-head">
        <h1>Cơ sở của tôi</h1>
        <Link to="/owner/facilities/new" className="btn btn--primary">
          <Icon name="plus" size={16} />
          Thêm cơ sở
        </Link>
      </div>

      {/* Thông báo vừa tạo */}
      {created && (
        <div className="notice notice--ok" style={{ marginBottom: 16, flex: "none" }}>
          <Icon name="check" size={16} />
          Đã tạo cơ sở &ldquo;{created.name}&rdquo;.
        </div>
      )}

      {/* Loading */}
      {status === "loading" && (
        <p>Đang tải danh sách...</p>
      )}

      {/* Lỗi */}
      {status === "error" && (
        <div className="notice notice--danger">
          <Icon name="alert" size={16} />{error}
          <button
            className="btn btn--sm btn--ghost"
            style={{ marginLeft: "auto" }}
            onClick={() => setReloadKey((k) => k + 1)}
          >
            Thử lại
          </button>
        </div>
      )}

      {/* Trống */}
      {status === "ready" && items.length === 0 && (
        <div className="empty">
          <p>Bạn chưa có cơ sở nào.</p>
          <Link to="/owner/facilities/new" className="btn btn--primary">
            Tạo cơ sở đầu tiên
          </Link>
        </div>
      )}

      {/* Danh sách */}
      {status === "ready" && items.length > 0 && (
        <ul className="ofac-grid stagger" style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {items.map((f) => {
            const totalCourts = f.total_courts ?? 0;
            const isNew = created?.id === f.id;

            return (
              <li key={f.id} className={`card card--flush ofac${isNew ? " highlight" : ""}`}>
                {/* Ảnh */}
                <Link to={`/owner/facilities/${f.id}`} className="zoom ofac__img">
                  {f.cover_photo
                    ? <img src={f.cover_photo} alt="" loading="lazy" />
                    : <div style={{
                        width: "100%", height: "100%",
                        background: "var(--accent-soft)",
                        display: "grid", placeItems: "center",
                      }}>
                        <Icon name="court" size={40} style={{ color: "var(--accent)", opacity: .4 }} />
                      </div>
                  }
                </Link>

                {/* Body */}
                <div className="ofac__body">
                  {/* Địa điểm */}
                  {(f.district || f.city) && (
                    <div className="small muted">
                      {[f.district, f.city].filter(Boolean).join(", ")}
                    </div>
                  )}

                  <h2>{f.name}</h2>

                  {/* Giờ mở cửa */}
                  {f.open_time && f.close_time && (
                    <div className="small">
                      Giờ mở cửa: {formatTime(f.open_time)} – {formatTime(f.close_time)}
                    </div>
                  )}

                  {/* Số sân */}
                  <div className="small">
                    Số sân: {totalCourts}
                  </div>

                  {/* Giá */}
                  <div className="small">
                    Giá: {formatPriceRange(f.min_price, f.max_price)}
                  </div>

                  {/* Actions */}
                  <div className="row" style={{ "--gap": "8px" }}>
                    <Link
                      className="btn btn--sm btn--primary"
                      to={`/owner/facilities/${f.id}`}
                    >
                      Quản lý
                    </Link>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
