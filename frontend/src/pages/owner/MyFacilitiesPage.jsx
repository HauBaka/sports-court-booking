import { useEffect, useState } from "react";
import { Link, useLocation, useOutletContext } from "react-router-dom";
import { listMyFacilities } from "../../services/facilityService";
import { formatTime } from "../../utils/format";
import Icon from "../../components/ui/Icon";

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
        <div className="ofac-grid stagger" aria-hidden="true">
          {[0,1,2].map((i) => (
            <div key={i} className="card card--flush ofac">
              <div className="ofac__img skel" />
              <div className="ofac__body" style={{ gap: 10 }}>
                <div className="skel" style={{ width: 100, height: 12 }} />
                <div className="skel" style={{ width: "70%", height: 20 }} />
                <div className="skel" style={{ width: "55%", height: 12 }} />
                <div className="ofac__occ">
                  <div className="bar"><i style={{ width:"30%" }} /></div>
                  <div className="skel" style={{ width: 80, height: 12 }} />
                </div>
                <div className="row" style={{ "--gap":"8px" }}>
                  <div className="skel" style={{ width: 110, height: 34, borderRadius: 999 }} />
                  <div className="skel" style={{ width: 70, height: 34, borderRadius: 999 }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Lỗi */}
      {status === "error" && (
        <div className="notice notice--danger">
          <Icon name="alert" size={16} />{error}
          <button className="btn btn--sm btn--ghost" style={{ marginLeft:"auto" }}
            onClick={() => { setState({ status:"loading", items:[], error:"" }); setReloadKey((k) => k+1); }}>
            Thử lại
          </button>
        </div>
      )}

      {/* Trống */}
      {status === "ready" && items.length === 0 && (
        <div className="ofac-grid">
          <Link to="/owner/facilities/new" className="ofac ofac--add">
            <Icon name="plus" size={22} />
            Thêm cơ sở
          </Link>
        </div>
      )}

      {/* Danh sách */}
      {status === "ready" && items.length > 0 && (
        <div className="ofac-grid stagger">
          {items.map((f) => {
            const activeCourts = (f.courts ?? []).filter((c) => c.is_active !== false).length;
            const totalCourts  = (f.courts ?? []).length || f.total_courts || 0;
            const pct = f.occupancy_pct ?? 0; // % kín hôm nay nếu API trả về
            const sports = f.sports_names ?? [];

            return (
              <article key={f.id} className="card card--flush ofac">
                {/* Ảnh */}
                <Link to={`/owner/facilities/${f.id}`} className="zoom ofac__img">
                  {f.cover_photo
                    ? <img src={f.cover_photo} alt="" loading="lazy" />
                    : <div style={{
                        width:"100%", height:"100%",
                        background:"var(--accent-soft)",
                        display:"grid", placeItems:"center"
                      }}>
                        <Icon name="court" size={40} style={{ color:"var(--accent)", opacity:.4 }} />
                      </div>
                  }
                </Link>

                {/* Body */}
                <div className="ofac__body">
                  <div className="small muted">
                    {sports.length > 0 ? sports.join(" · ") : "Thể thao"}
                    {f.district && ` · ${f.district}`}
                  </div>

                  <h3>{f.name}</h3>

                  <div className="small ink2">
                    {totalCourts > 0
                      ? `${activeCourts}/${totalCourts} sân hoạt động`
                      : "—"
                    }
                    {f.open_time && f.close_time && (
                      <> · <span className="mono">{formatTime(f.open_time)}–{formatTime(f.close_time)}</span></>
                    )}
                  </div>

                  {/* Thanh % kín */}
                  <div className="ofac__occ">
                    <div className="bar"><i style={{ width: pct + "%" }} /></div>
                    <span className="small"><span className="mono">{pct}%</span> kín hôm nay</span>
                  </div>

                  {/* Actions */}
                  <div className="row" style={{ "--gap":"8px" }}>
                    <Link
                      className="btn btn--sm btn--primary"
                      to={`/owner/facilities/${f.id}`}
                    >
                      Lịch hôm nay
                    </Link>
                  </div>
                </div>
              </article>
            );
          })}

          {/* Nút thêm cơ sở */}
          <Link to="/owner/facilities/new" className="ofac ofac--add">
            <Icon name="plus" size={22} />
            Thêm cơ sở
          </Link>
        </div>
      )}
    </>
  );
}
