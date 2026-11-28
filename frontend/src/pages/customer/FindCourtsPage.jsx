import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { listFacilities } from "../../services/facilityService";
import { formatVnd } from "../../utils/format";
import "../../styles/find-courts.css";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const SPORTS = [
  { id: "",  name: "Tất cả môn" },
  { id: 1,   name: "Cầu lông" },
  { id: 2,   name: "Pickleball" },
  { id: 3,   name: "Bóng đá mini" },
];

const PAGE_LIMIT = 10;

export default function FindCourtsPage() {
  // ── Bộ lọc (đang nhập) ──
  const [search,  setSearch]  = useState("");
  const [city,    setCity]    = useState("");
  const [sportId, setSportId] = useState("");

  // ── Params đã áp dụng ──
  const [applied, setApplied] = useState({ search: "", city: "", sportId: "" });

  // ── Phân trang ──
  const [page,       setPage]       = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total,      setTotal]      = useState(0);

  // ── Dữ liệu ──
  const [items,    setItems]    = useState([]);
  const [status,   setStatus]   = useState("loading");
  const [errorMsg, setErrorMsg] = useState("");

  const fetchFacilities = useCallback(async (params, pg) => {
    setStatus("loading");
    try {
      const query = { page: pg, limit: PAGE_LIMIT };
      if (params.search.trim())  query.search   = params.search.trim();
      if (params.city.trim())    query.city     = params.city.trim();
      if (params.sportId !== "") query.sport_id = params.sportId;
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

  useEffect(() => { fetchFacilities(applied, 1); }, [fetchFacilities]); // eslint-disable-line

  const goToPage = (pg) => {
    setPage(pg);
    fetchFacilities(applied, pg);
    document.querySelector(".fc-main")?.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSearch = () => {
    const params = { search, city, sportId };
    setApplied(params);
    setPage(1);
    fetchFacilities(params, 1);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") handleSearch();
  };

  return (
    <div className="fc-page">
      {/* Hero */}
      <div className="fc-hero">
        <div className="fc-hero-inner">
          <h1 className="fc-hero-title">Tìm sân thể thao</h1>
          <p className="fc-hero-sub">Tìm sân gần bạn, đặt ngay trong vài giây</p>
        </div>
      </div>

      {/* Filter bar */}
      <div className="fc-filter-bar" onKeyDown={handleKeyDown}>
        <div className="fc-filter-group fc-filter-group--search">
          <label className="fc-filter-label">Tên cơ sở</label>
          <div className="fc-search-wrap">
            <input
              className="fc-search-input"
              type="text"
              placeholder="Nhập tên sân..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button className="fc-search-clear" type="button" onClick={() => setSearch("")} title="Xóa">✕</button>
            )}
          </div>
        </div>

        <div className="fc-filter-group">
          <label className="fc-filter-label">Thành phố</label>
          <div className="fc-search-wrap">
            <input
              className="fc-search-input"
              type="text"
              placeholder="VD: Hồ Chí Minh"
              value={city}
              onChange={(e) => setCity(e.target.value)}
            />
            {city && (
              <button className="fc-search-clear" type="button" onClick={() => setCity("")} title="Xóa">✕</button>
            )}
          </div>
        </div>

        <div className="fc-filter-group">
          <label className="fc-filter-label">Môn thể thao</label>
          <select
            className="fc-select"
            value={sportId}
            onChange={(e) => setSportId(e.target.value === "" ? "" : Number(e.target.value))}
          >
            {SPORTS.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>

        <div className="fc-filter-action">
          <label className="fc-filter-label">&nbsp;</label>
          <button className="fc-btn-search" type="button" onClick={handleSearch}>
            Tìm sân
          </button>
        </div>
      </div>

      {/* Body: danh sách + bản đồ */}
      <div className="fc-body">

        {/* Cột trái */}
        <div className="fc-main">
          {status === "loading" && (
            <div className="fc-state-box">
              <div className="fc-spinner" />
              <p>Đang tải danh sách sân...</p>
            </div>
          )}

          {status === "error" && (
            <div className="fc-state-box">
              <p className="fc-error-msg">{errorMsg}</p>
              <button className="fc-btn-search" type="button" onClick={() => fetchFacilities(applied, page)}>
                Thử lại
              </button>
            </div>
          )}

          {status === "ready" && (
            <>
              {/* Result bar: chỉ còn số kết quả */}
              <div className="fc-result-bar">
                <span className="fc-result-count">
                  <strong>{total}</strong> sân phù hợp
                  {totalPages > 1 && (
                    <span className="fc-result-page"> · Trang {page}/{totalPages}</span>
                  )}
                </span>
              </div>

              {items.length === 0 ? (
                <div className="fc-empty">
                  <div className="fc-empty-icon">🏟️</div>
                  <p>Chưa có cơ sở nào.</p>
                </div>
              ) : (
                <ul className="fc-list">
                  {items.map((facility, idx) => (
                    <CourtCard
                      key={facility.id}
                      facility={facility}
                      index={(page - 1) * PAGE_LIMIT + idx}
                    />
                  ))}
                </ul>
              )}

              {/* Phân trang */}
              {totalPages > 1 && (
                <div className="fc-pagination">
                  <button
                    className="fc-page-btn"
                    type="button"
                    disabled={page <= 1}
                    onClick={() => goToPage(page - 1)}
                  >
                    ← Trang trước
                  </button>
                  <span className="fc-page-info">{page} / {totalPages}</span>
                  <button
                    className="fc-page-btn"
                    type="button"
                    disabled={page >= totalPages}
                    onClick={() => goToPage(page + 1)}
                  >
                    Trang sau →
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Cột phải: bản đồ */}
        <div className="fc-map-col">
          <FacilitiesMap facilities={items} />
        </div>

      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
//  Card sân
// ─────────────────────────────────────────────────────────────────
function CourtCard({ facility, index }) {
  const address  = [facility.district, facility.city].filter(Boolean).join(", ");
  const hasPrice = facility.min_price != null;

  return (
    <li className="fc-card">
      <div className="fc-card-img">
        <div className="fc-card-img-placeholder">
          <span className="fc-placeholder-icon">🏟️</span>
        </div>
        <span className="fc-card-index">#{index + 1}</span>
      </div>

      <div className="fc-card-body">
        <div className="fc-card-top">
          <div>
            <h2 className="fc-card-name">{facility.name}</h2>
            <p className="fc-card-address">{address || facility.address}</p>
          </div>
        </div>

        <div className="fc-card-tags">
          {facility.total_courts != null && (
            <span className="fc-tag fc-tag-courts">{facility.total_courts} sân</span>
          )}
          {facility.city && (
            <span className="fc-tag fc-tag-courts">{facility.city}</span>
          )}
        </div>

        <div className="fc-card-footer">
          <div className="fc-card-price">
            {hasPrice ? (
              <>
                <span className="fc-price-label">Từ</span>
                <span className="fc-price-value">{formatVnd(facility.min_price)}</span>
                {facility.max_price != null && facility.max_price !== facility.min_price && (
                  <>
                    <span className="fc-price-sep">–</span>
                    <span className="fc-price-max">{formatVnd(facility.max_price)}</span>
                  </>
                )}
                <span className="fc-price-unit">/giờ</span>
              </>
            ) : (
              <span className="fc-price-na">Liên hệ để biết giá</span>
            )}
          </div>
          <Link className="fc-btn-detail" to={`/courts/${facility.id}`}>
            Xem chi tiết
          </Link>
        </div>
      </div>
    </li>
  );
}

// ─────────────────────────────────────────────────────────────────
//  Bản đồ
// ─────────────────────────────────────────────────────────────────
const DEFAULT_CENTER = [10.7769, 106.7009];
const DEFAULT_ZOOM   = 12;

function FacilitiesMap({ facilities }) {
  const pinned = facilities.filter((f) => f.latitude != null && f.longitude != null);
  const center = pinned.length > 0
    ? [
        pinned.reduce((s, f) => s + f.latitude,  0) / pinned.length,
        pinned.reduce((s, f) => s + f.longitude, 0) / pinned.length,
      ]
    : DEFAULT_CENTER;

  return (
    <MapContainer center={center} zoom={DEFAULT_ZOOM} className="fc-map" key={center.join(",")}>
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap contributors</a>'
      />
      {pinned.map((f) => (
        <Marker key={f.id} position={[f.latitude, f.longitude]}>
          <Popup>
            <div className="fc-map-popup">
              <strong className="fc-map-popup-name">{f.name}</strong>
              <p className="fc-map-popup-addr">{f.address}</p>
              {[f.district, f.city].filter(Boolean).length > 0 && (
                <p className="fc-map-popup-addr">{[f.district, f.city].filter(Boolean).join(", ")}</p>
              )}
              <a className="fc-map-popup-link" href={`/courts/${f.id}`}>Xem chi tiết →</a>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
