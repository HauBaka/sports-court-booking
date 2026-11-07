import { useEffect, useState } from "react";
import { Link, useLocation, useOutletContext } from "react-router-dom";
import { listMyFacilities } from "../../services/facilityService";
import { formatPriceRange, formatTime } from "../../utils/format";
import "../../styles/facility.css";

export default function MyFacilitiesPage() {
  const { user } = useOutletContext();
  const location = useLocation();
  const created = location.state?.created;
  const [reloadKey, setReloadKey] = useState(0);
  const [state, setState] = useState({ status: "loading", items: [], error: "" });

  useEffect(() => {
    let cancelled = false;
    listMyFacilities(user.id)
      .then((items) => {
        if (!cancelled) setState({ status: "ready", items, error: "" });
      })
      .catch((err) => {
        if (!cancelled) {
          setState({ status: "error", items: [], error: err.message || "Không tải được danh sách cơ sở." });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [user.id, reloadKey]);

  const retry = () => {
    setState({ status: "loading", items: [], error: "" });
    setReloadKey((k) => k + 1);
  };

  return (
    <div className="owner-page">
      <div className="page-head">
        <h1>Cơ sở của tôi</h1>
        <Link className="btn btn-link" to="/owner/facilities/new">
          + Thêm cơ sở
        </Link>
      </div>

      {created && (
        <p className="notice success" role="status">
          Đã tạo cơ sở “{created.name}”.
        </p>
      )}

      {state.status === "loading" && <p>Đang tải danh sách...</p>}

      {state.status === "error" && (
        <>
          <p className="notice error" role="alert">
            {state.error}
          </p>
          <button className="btn" type="button" onClick={retry}>
            Thử lại
          </button>
        </>
      )}

      {state.status === "ready" && state.items.length === 0 && (
        <div className="empty">
          <p>Bạn chưa có cơ sở nào.</p>
          <Link className="btn btn-link" to="/owner/facilities/new">
            Tạo cơ sở đầu tiên
          </Link>
        </div>
      )}

      {state.status === "ready" && state.items.length > 0 && (
        <ul className="facility-list">
          {state.items.map((f) => (
            <li key={f.id} className={`facility-card${created?.id === f.id ? " highlight" : ""}`}>
              <h2>{f.name}</h2>
              <p>{f.address}</p>
              <p className="muted">{[f.district, f.city].filter(Boolean).join(", ")}</p>
              <div className="facility-meta">
                <span>
                  Giờ mở cửa: {formatTime(f.open_time)} – {formatTime(f.close_time)}
                </span>
                <span>Số sân: {f.total_courts}</span>
                <span>Giá: {formatPriceRange(f.min_price, f.max_price)}</span>
                {f.is_active && <span className="badge">Đang hoạt động</span>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
