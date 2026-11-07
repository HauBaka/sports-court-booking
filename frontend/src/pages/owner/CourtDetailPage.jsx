import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useOutletContext, useParams } from "react-router-dom";
import { getCourt } from "../../services/courtService";
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

export default function CourtDetailPage() {
  const { courtId } = useParams();
  const { user } = useOutletContext();
  const navigate = useNavigate();
  const location = useLocation();

  const [court, setCourt] = useState(null);
  const [facility, setFacility] = useState(null);
  const [loadStatus, setLoadStatus] = useState("loading");
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoadStatus("loading");
    setLoadError("");

    // Nếu vừa lưu từ CourtEditPage, dùng dữ liệu mới trả về luôn
    const fresh = location.state?.updatedCourt;

    getCourt(courtId)
      .then(async (res) => {
        if (cancelled) return;
        const c = fresh ?? res.data;
        const fRes = await getFacility(c.facility_id);
        if (cancelled) return;
        const f = fRes.data;
        if (f.owner_id !== user.id) {
          navigate("/owner/facilities", { replace: true });
          return;
        }
        setCourt(c);
        setFacility(f);
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
          <h1>{court.name}</h1>
          <p className="facility-address">
            {SPORT_LABEL[court.sport_id] ?? `Môn #${court.sport_id}`}
            {" · "}
            {court.environment === "INDOOR" ? "Trong nhà" : "Ngoài trời"}
          </p>
        </div>
        <Link
          className="btn btn-link"
          to={`/owner/courts/${court.id}/edit`}
        >
          Sửa thông tin
        </Link>
      </div>

      {/* ── Thông tin chi tiết ── */}
      <section className="detail-section">
        <div className="section-head">
          <h2>Thông tin sân</h2>
        </div>

        {location.state?.updatedCourt && (
          <p className="notice success" role="status">Đã lưu thay đổi thành công.</p>
        )}

        <dl className="court-meta-list">
          <div className="court-meta-row">
            <dt>Tên sân</dt>
            <dd>{court.name}</dd>
          </div>
          <div className="court-meta-row">
            <dt>Môn thể thao</dt>
            <dd>{SPORT_LABEL[court.sport_id] ?? `ID ${court.sport_id}`}</dd>
          </div>
          <div className="court-meta-row">
            <dt>Loại sân</dt>
            <dd>{court.court_type || "—"}</dd>
          </div>
          <div className="court-meta-row">
            <dt>Môi trường</dt>
            <dd>{court.environment === "INDOOR" ? "Trong nhà (Indoor)" : "Ngoài trời (Outdoor)"}</dd>
          </div>
          <div className="court-meta-row">
            <dt>Giờ hoạt động</dt>
            <dd>{formatTime(court.open_time)} – {formatTime(court.close_time)}</dd>
          </div>
          <div className="court-meta-row">
            <dt>Trạng thái</dt>
            <dd>
              {court.is_active
                ? <span className="badge">Đang hoạt động</span>
                : <span className="badge badge-inactive">Ngừng hoạt động</span>}
            </dd>
          </div>
          <div className="court-meta-row">
            <dt>ID sân</dt>
            <dd>#{court.id}</dd>
          </div>
          <div className="court-meta-row">
            <dt>Thuộc cơ sở</dt>
            <dd>
              <Link to={`/owner/facilities/${facility.id}`}>{facility.name}</Link>
            </dd>
          </div>
        </dl>
      </section>
    </div>
  );
}
