import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { listFacilities } from "../../services/facilityService";
import { formatVnd } from "../../utils/format";
import Icon from "../../components/ui/Icon";
import Pager from "../../components/ui/Pager";

/* Leaflet default icon fix */
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const SPORTS = [
  { id: "",  name: "Tất cả môn" },
  { id: "1", name: "Cầu lông" },
  { id: "2", name: "Pickleball" },
  { id: "3", name: "Bóng đá mini" },
];

const PAGE_LIMIT = 6;
const DEFAULT_CENTER = [10.7769, 106.7009];
const DEFAULT_ZOOM   = 12;

export default function FindCourtsPage() {
  /* ── Bộ lọc (đang nhập) ── */
  const [q,        setQ]        = useState("");
  const [city,     setCity]     = useState("");
  const [district, setDistrict] = useState("");
  const [sport,    setSport]    = useState("");

  /* ── Dữ liệu ── */
  const [items,      setItems]      = useState([]);
  const [total,      setTotal]      = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page,       setPage]       = useState(0);
  const [status,     setStatus]     = useState("loading");
  const [errorMsg,   setErrorMsg]   = useState("");

  const [hot, setHot] = useState(null);
  const nav = useNavigate();
  const resultsRef = useRef(null);

  const fetchFacilities = useCallback(async (params, pg0) => {
    setStatus("loading");
    try {
      const query = { page: pg0 + 1, limit: PAGE_LIMIT };
      if (params.q.trim())       query.search   = params.q.trim();
      if (params.city.trim())    query.city     = params.city.trim();
      if (params.district.trim())query.district = params.district.trim();
      if (params.sport)          query.sport_id = params.sport;
      const res = await listFacilities(query);
      setItems(res.data ?? []);
      setTotal(res.meta?.total ?? 0);
      setTotalPages(res.meta?.total_pages ?? 1);
      setStatus("ready");
    } catch {
      setErrorMsg("Không tải được danh sách sân. Vui lòng thử lại.");
      setStatus("error");
    }
  }, []);

  const [applied, setApplied] = useState({ q: "", city: "", district: "", sport: "" });

  useEffect(() => { fetchFacilities(applied, 0); }, [fetchFacilities]); // eslint-disable-line

  const applyFilters = () => {
    const params = { q, city, district, sport };
    setApplied(params);
    setPage(0);
    fetchFacilities(params, 0);
  };

  const goPage = (pg0) => {
    setPage(pg0);
    fetchFacilities(applied, pg0);
    resultsRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <main className="page">
      <div className="wrap">
        <h1 className="sr-only">Tìm sân còn trống</h1>

        {/* ── Search bar: tên + thành phố + quận ── */}
        <form
          className="sbar"
          role="search"
          onSubmit={(e) => { e.preventDefault(); applyFilters(); }}
        >
          <label className="sbar__seg sbar__seg--q">
            <span>Tìm theo tên</span>
            <input
              placeholder="Tên sân hoặc tên đường, ví dụ Cộng Hòa"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            {q && (
              <button
                type="button"
                className="sbar__clear"
                aria-label="Xóa từ khóa"
                onClick={() => setQ("")}
              >
                <Icon name="x" size={12} />
              </button>
            )}
          </label>

          <label className="sbar__seg">
            <span>Thành phố</span>
            <input
              className="sbar__sel"
              placeholder="TPHCM"
              value={city}
              onChange={(e) => setCity(e.target.value)}
            />
          </label>

          <label className="sbar__seg">
            <span>Quận, huyện</span>
            <input
              className="sbar__sel"
              placeholder="Tất cả quận"
              value={district}
              onChange={(e) => setDistrict(e.target.value)}
            />
          </label>

          <button className="sbar__go" type="submit">
            <Icon name="search" size={18} />Tìm sân
          </button>
        </form>

        {/* ── Chip môn + số kết quả ── */}
        <div className="result-bar">
          <div className="chips" role="group" aria-label="Môn thể thao">
            {SPORTS.map((s) => (
              <button
                key={s.id}
                type="button"
                className={"chip" + (sport === s.id ? " on" : "")}
                onClick={() => {
                  setSport(s.id);
                  const np = { ...applied, sport: s.id };
                  setApplied(np);
                  setPage(0);
                  fetchFacilities(np, 0);
                }}
              >
                {s.name}
              </button>
            ))}
          </div>
          <span className="muted small">
            {status === "loading"
              ? "Đang tìm…"
              : `${total} cơ sở${applied.district ? ` ở ${applied.district}` : applied.city ? ` ở ${applied.city}` : ""}`}
          </span>
        </div>

        {/* ── Split: danh sách | bản đồ ── */}
        <div className="split split--search">

          <div className="results" ref={resultsRef}>
            {status === "loading" && (
              <div className="fac-grid stagger">
                {[0,1,2,3].map((i) => <SkeletonCard key={i} />)}
              </div>
            )}

            {status === "error" && (
              <div className="notice notice--danger">
                <Icon name="alert" size={16} />
                {errorMsg}
                <button
                  type="button"
                  className="btn btn--sm"
                  style={{ marginLeft: "auto" }}
                  onClick={() => fetchFacilities(applied, page)}
                >
                  Thử lại
                </button>
              </div>
            )}

            {status === "ready" && items.length === 0 && (
              <div className="empty">
                <h3>Chưa có sân phù hợp</h3>
                <button
                  type="button"
                  className="link"
                  onClick={() => {
                    const p = { q: "", city: "", district: "", sport: "" };
                    setQ(""); setCity(""); setDistrict(""); setSport("");
                    setApplied(p); setPage(0); fetchFacilities(p, 0);
                  }}
                >
                  Bỏ bộ lọc
                </button>
              </div>
            )}

            {status === "ready" && items.length > 0 && (
              <>
                <div className="fac-grid stagger" key={items.map((f) => f.id).join()}>
                  {items.map((f) => (
                    <FacilityCard
                      key={f.id}
                      facility={f}
                      hot={hot === f.id}
                      onHover={setHot}
                    />
                  ))}
                </div>
                <Pager
                  page={page}
                  pages={totalPages}
                  size={PAGE_LIMIT}
                  total={total}
                  onPage={goPage}
                />
              </>
            )}
          </div>

          <div className="sticky hide-sm">
            <FacilitiesMap
              facilities={items}
              hot={hot}
              setHot={setHot}
              onOpen={(id) => nav(`/courts/${id}`)}
            />
          </div>
        </div>
      </div>
    </main>
  );
}

/* ── Facility card ── */
function FacilityCard({ facility: f, hot, onHover }) {
  const hasPrice = f.min_price != null;
  const courts   = f.total_courts;
  const sports   = f.sports_names ?? [];

  return (
    <Link
      to={`/courts/${f.id}`}
      className={"card fac" + (hot ? " is-hot" : "")}
      onMouseEnter={() => onHover(f.id)}
      onMouseLeave={() => onHover(null)}
    >
      <div className="fac__img">
        {f.cover_photo ? (
          <img src={f.cover_photo} alt="" loading="lazy" />
        ) : (
          <div style={{
            position: "absolute", inset: 0,
            background: "linear-gradient(135deg,var(--accent-soft),var(--surface-3))",
            display: "grid", placeItems: "center",
          }}>
            <Icon name="court" size={40} style={{ color: "var(--accent)", opacity: .4 }} />
          </div>
        )}
      </div>

      <div className="fac__body">
        <div className="row between small">
          <span className="muted">{sports.length > 0 ? sports.join(" · ") : "Thể thao"}</span>
          {f.rating != null && (
            <span className="rating">
              <Icon name="star" size={13} fill />
              {Number(f.rating).toFixed(1)}
            </span>
          )}
        </div>

        <h3>{f.name}</h3>

        <div className="fac__addr small ink2">
          <Icon name="pin" size={14} />
          {[f.district, f.city].filter(Boolean).join(", ") || f.address || "—"}
        </div>

        <div className="fac__foot">
          <div className="price">
            {hasPrice ? (
              <>
                {formatVnd(f.min_price)}
                {f.max_price != null && f.max_price !== f.min_price && (
                  <small style={{ color: "var(--muted)" }}> – {formatVnd(f.max_price)}</small>
                )}
                <small>/giờ</small>
              </>
            ) : (
              <small style={{ color: "var(--muted)" }}>Liên hệ</small>
            )}
          </div>
          {courts != null && (
            <span className={"badge" + (courts > 0 ? " badge--deposited" : " badge--cancelled")}>
              {courts > 0 ? `${courts} giờ trống` : "Hôm nay kín"}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

/* ── Skeleton ── */
function SkeletonCard() {
  return (
    <div className="card fac fac--skel" aria-hidden="true">
      <div className="fac__img skel" style={{ borderRadius: 0 }} />
      <div className="fac__body">
        <div className="skel" style={{ width: 120, height: 16 }} />
        <div className="skel" style={{ width: "70%", height: 22, marginTop: 4 }} />
        <div className="skel" style={{ width: "55%", height: 14, marginTop: 4 }} />
        <div className="fac__foot">
          <div className="skel" style={{ width: 110, height: 28 }} />
          <div className="skel" style={{ width: 90, height: 20, borderRadius: 999 }} />
        </div>
      </div>
    </div>
  );
}

/* ── Map ── */
function FacilitiesMap({ facilities, hot, setHot, onOpen }) {
  const pinned = facilities.filter((f) => f.latitude != null && f.longitude != null);
  const center = pinned.length > 0
    ? [
        pinned.reduce((s, f) => s + f.latitude,  0) / pinned.length,
        pinned.reduce((s, f) => s + f.longitude, 0) / pinned.length,
      ]
    : DEFAULT_CENTER;

  return (
    <div className="map" role="region" aria-label="Bản đồ vị trí các cơ sở">
      <MapContainer center={center} zoom={DEFAULT_ZOOM} key={center.join(",")}>
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>'
        />
        {pinned.map((f) => (
          <Marker key={f.id} position={[f.latitude, f.longitude]}>
            <Popup>
              <strong>{f.name}</strong>
              <p style={{ margin: "4px 0 0", fontSize: 13 }}>
                {[f.district, f.city].filter(Boolean).join(", ")}
              </p>
              {f.min_price != null && (
                <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--accent)", fontWeight: 600 }}>
                  Từ {formatVnd(f.min_price)}/giờ
                </p>
              )}
              <a
                href={`/courts/${f.id}`}
                style={{ display: "inline-block", marginTop: 8, fontSize: 13, fontWeight: 600, color: "var(--accent)" }}
              >
                Xem chi tiết →
              </a>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
