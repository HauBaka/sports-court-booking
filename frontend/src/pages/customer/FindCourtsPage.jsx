import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { listFacilities } from "../../services/facilityService";
import { formatVnd } from "../../utils/format";
import "../../styles/find-courts.css";

// ── Fix icon Leaflet vỡ khi bundle bằng Vite ────────────────────
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

// ── Hằng số ─────────────────────────────────────────────────────
const SPORTS = [
  { id: "", name: "Tất cả môn" },
  { id: 1,  name: "Cầu lông" },
  { id: 2,  name: "Pickleball" },
  { id: 3,  name: "Bóng đá mini" },
];

const PRICE_RANGES = [
  { label: "Tất cả mức giá", min: null, max: null },
  { label: "Dưới 100.000 đ",        min: 0,      max: 100000 },
  { label: "100.000 – 200.000 đ",   min: 100000, max: 200000 },
  { label: "200.000 – 300.000 đ",   min: 200000, max: 300000 },
  { label: "Trên 300.000 đ",        min: 300000, max: null   },
];

const SORT_OPTIONS = [
  { value: "newest",     label: "Mới nhất" },
  { value: "price_asc",  label: "Giá tăng dần" },
  { value: "price_desc", label: "Giá giảm dần" },
  { value: "name_asc",   label: "Tên A → Z" },
];

const PAGE_LIMIT = 10;

// ── Helpers sort (client-side, chỉ trên trang hiện tại) ─────────
function sortItems(items, sortBy) {
  const copy = [...items];
  if (sortBy === "price_asc")  copy.sort((a, b) => (a.min_price ?? 0) - (b.min_price ?? 0));
  if (sortBy === "price_desc") copy.sort((a, b) => (b.min_price ?? 0) - (a.min_price ?? 0));
  if (sortBy === "name_asc")   copy.sort((a, b) => a.name.localeCompare(b.name, "vi"));
  return copy;
}

// ─────────────────────────────────────────────────────────────────
//  COMPONENT CHÍNH
// ─────────────────────────────────────────────────────────────────
export default function FindCourtsPage() {
  // ── Bộ lọc (đang nhập) ──
  const [search,     setSearch]     = useState("");
  const [city,       setCity]       = useState("");
  const [sportId,    setSportId]    = useState("");
  const [priceRange, setPriceRange] = useState(PRICE_RANGES[0]);

  // ── Params đã áp dụng (commit khi bấm Tìm sân) ──
  const [applied, setApplied] = useState({
    search: "", city: "", sportId: "", priceRange: PRICE_RANGES[0],
  });

  // ── Phân trang ──
  const [page,       setPage]       = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total,      setTotal]      = useState(0);

  // ── Dữ liệu & trạng thái ──
  const [items,   setItems]   = useState([]);
  const [status,  setStatus]  = useState("loading");
  const [errorMsg,setErrorMsg]= useState("");
  const [sortBy,  setSortBy]  = useState("newest");

  // ── Fetch: gửi tất cả filter lên backend ──
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

  // Load lần đầu
  useEffect(() => { fetchFacilities(applied, 1); }, []); // eslint-disable-line

  // Khi đổi trang → fetch trang mới với applied params hiện tại
  const goToPage = (pg) => {
    setPage(pg);
    fetchFacilities(applied, pg);
    // Cuộn lên đầu danh sách
    document.querySelector(".fc-main")?.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSearch = () => {
    const params = { search, city, sportId, priceRange };
    setApplied(params);
    setPage(1);
    fetchFacilities(params, 1);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") handleSearch();
  };

  // Lọc giá client-side (backend chưa có filter giá)
  const filtered = items.filter((f) => {
    const { min, max } = applied.priceRange;
    if (min !== null && (f.max_price ?? 0) < min) return false;
    if (max !== null && (f.min_price ?? 0) > max) return false;
    return true;
  });

  const displayed = sortItems(filtered, sortBy);

  return (
    <div className="fc-page">
      {/* ── Hero ── */}
      <div className="fc-hero">
        <div className="fc-hero-inner">
          <h1 className="fc-hero-title">Tìm sân thể thao</h1>
          <p className="fc-hero-sub">Tìm sân gần bạn, đặt ngay trong vài giây</p>
        </div>
      </div>

      {/* ── Bộ lọc ── */}
      <div className="fc-filter-bar" onKeyDown={handleKeyDown}>

        {/* Tên cơ sở */}
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

        {/* Thành phố */}
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

        {/* Môn thể thao */}
        <div className="fc-filter-group">
          <label className="fc-filter-label">Môn thể thao</label>
          <select
            className="fc-select"
            value={sportId}
            onChange={(e) => setSportId(e.target.value === "" ? "" : Number(e.target.value))}
          >
            {SPORTS.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>

        {/* Mức giá */}
        <div className="fc-filter-group">
          <label className="fc-filter-label">Mức giá</label>
          <select
            className="fc-select"
            value={priceRange.label}
            onChange={(e) => setPriceRange(PRICE_RANGES.find((p) => p.label === e.target.value))}
          >
            {PRICE_RANGES.map((p) => <option key={p.label}>{p.label}</option>)}
          </select>
        </div>

        <div className="fc-filter-action">
          <label className="fc-filter-label">&nbsp;</label>
          <button className="fc-btn-search" type="button" onClick={handleSearch}>
            Tìm sân
          </button>
        </div>
      </div>

      {/* ── Body: danh sách + bản đồ ── */}
      <div className="fc-body">

        {/* Cột trái: danh sách */}
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
              {/* Result bar */}
              <div className="fc-result-bar">
                <span className="fc-result-count">
                  <strong>{total}</strong> sân phù hợp
                  {totalPages > 1 && (
                    <span className="fc-result-page"> · Trang {page}/{totalPages}</span>
                  )}
                </span>
                <div className="fc-sort">
                  <label className="fc-sort-label">Sắp xếp:</label>
                  <select
                    className="fc-select fc-select-sm"
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                  >
                    {SORT_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Danh sách */}
              {displayed.length === 0 ? (
                <div className="fc-empty">
                  <div className="fc-empty-icon">🏟️</div>
                  <p>Không tìm thấy sân phù hợp.</p>
                  <p className="fc-empty-sub">Thử thay đổi bộ lọc để xem thêm kết quả.</p>
                </div>
              ) : (
                <ul className="fc-list">
                  {displayed.map((facility, idx) => (
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
          <FacilitiesMap facilities={displayed} />
        </div>

      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
//  Card sân
// ─────────────────────────────────────────────────────────────────
function CourtCard({ facility, index }) {
  const address = [facility.district, facility.city].filter(Boolean).join(", ");
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
