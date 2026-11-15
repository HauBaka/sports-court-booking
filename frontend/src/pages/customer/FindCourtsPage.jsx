import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { listFacilities } from "../../services/facilityService";
import { formatVnd } from "../../utils/format";
import "../../styles/find-courts.css";

// ── Fix icon mặc định của Leaflet bị vỡ khi bundle bằng Vite ────
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

// ── Dữ liệu tĩnh cho bộ lọc ─────────────────────────────────────
const DISTRICTS = [
  "Tất cả khu vực",
  "Quận 1, TP.HCM",
  "Quận 3, TP.HCM",
  "Quận 7, TP.HCM",
  "Bình Thạnh, TP.HCM",
  "Tân Bình, TP.HCM",
  "Thủ Đức, TP.HCM",
  "Gò Vấp, TP.HCM",
];

const PRICE_RANGES = [
  { label: "Tất cả mức giá", min: null, max: null },
  { label: "Dưới 100.000 đ", min: 0, max: 100000 },
  { label: "100.000 – 200.000 đ", min: 100000, max: 200000 },
  { label: "200.000 – 300.000 đ", min: 200000, max: 300000 },
  { label: "Trên 300.000 đ", min: 300000, max: null },
];

const SORT_OPTIONS = [
  { value: "newest", label: "Mới nhất" },
  { value: "price_asc", label: "Giá tăng dần" },
  { value: "price_desc", label: "Giá giảm dần" },
  { value: "name_asc", label: "Tên A → Z" },
];

// ── Helpers ──────────────────────────────────────────────────────
function sortItems(items, sortBy) {
  const copy = [...items];
  if (sortBy === "price_asc") copy.sort((a, b) => (a.min_price ?? 0) - (b.min_price ?? 0));
  else if (sortBy === "price_desc") copy.sort((a, b) => (b.min_price ?? 0) - (a.min_price ?? 0));
  else if (sortBy === "name_asc") copy.sort((a, b) => a.name.localeCompare(b.name, "vi"));
  return copy;
}

function matchesFilters(facility, { district, priceRange }) {
  if (district !== "Tất cả khu vực") {
    const loc = `${facility.district ?? ""}, ${facility.city ?? ""}`;
    if (!loc.toLowerCase().includes(district.split(",")[0].trim().toLowerCase())) return false;
  }
  if (priceRange.min !== null && (facility.max_price ?? 0) < priceRange.min) return false;
  if (priceRange.max !== null && (facility.min_price ?? 0) > priceRange.max) return false;
  return true;
}

// ── Component chính ───────────────────────────────────────────────
export default function FindCourtsPage() {
  const [allItems, setAllItems] = useState([]);
  const [status, setStatus] = useState("loading"); // loading | ready | error
  const [errorMsg, setErrorMsg] = useState("");

  // Bộ lọc (input đang nhập)
  const [search, setSearch] = useState("");
  const [district, setDistrict] = useState("Tất cả khu vực");
  const [priceRange, setPriceRange] = useState(PRICE_RANGES[0]);
  const [sortBy, setSortBy] = useState("newest");

  // Params đã áp dụng (chỉ cập nhật khi bấm Tìm sân)
  const [appliedParams, setAppliedParams] = useState({
    search: "",
    district: "Tất cả khu vực",
    priceRange: PRICE_RANGES[0],
  });

  const fetchFacilities = useCallback(async (params) => {
    setStatus("loading");
    try {
      const query = { limit: 100 };
      if (params.search.trim()) query.search = params.search.trim();
      const res = await listFacilities(query);
      setAllItems(res.data ?? []);
      setStatus("ready");
    } catch {
      setErrorMsg("Không tải được danh sách sân. Vui lòng thử lại.");
      setStatus("error");
    }
  }, []);

  // Load lần đầu
  useEffect(() => { fetchFacilities(appliedParams); }, []);  // eslint-disable-line

  const handleSearch = () => {
    const params = { search, district, priceRange };
    setAppliedParams(params);
    fetchFacilities(params);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") handleSearch();
  };

  // Lọc client: district + priceRange (search đã lọc ở backend)
  const displayed = sortItems(
    allItems.filter((f) => matchesFilters(f, appliedParams)),
    sortBy
  );

  return (
    <div className="fc-page">
      {/* ── Hero / tiêu đề ── */}
      <div className="fc-hero">
        <div className="fc-hero-inner">
          <h1 className="fc-hero-title">Tìm sân thể thao</h1>
          <p className="fc-hero-sub">
            Tìm sân gần bạn, đặt ngay trong vài giây
          </p>
        </div>
      </div>

      {/* ── Bộ lọc ── */}
      <div className="fc-filter-bar" onKeyDown={handleKeyDown}>
        {/* Tìm theo tên */}
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
              <button
                className="fc-search-clear"
                type="button"
                onClick={() => setSearch("")}
                title="Xóa"
              >✕</button>
            )}
          </div>
        </div>

        <div className="fc-filter-group">
          <label className="fc-filter-label">Khu vực</label>
          <select
            className="fc-select"
            value={district}
            onChange={(e) => setDistrict(e.target.value)}
          >
            {DISTRICTS.map((d) => <option key={d}>{d}</option>)}
          </select>
        </div>

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

      {/* ── Nội dung chính ── */}
      <div className="fc-body">

        {/* ── Cột trái: danh sách ── */}
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
              <button className="fc-btn-search" type="button" onClick={() => fetchFacilities(appliedParams)}>
                Thử lại
              </button>
            </div>
          )}

          {status === "ready" && (
            <>
              {/* Thanh kết quả + sắp xếp */}
              <div className="fc-result-bar">
                <span className="fc-result-count">
                  <strong>{displayed.length}</strong> sân phù hợp
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

              {/* Danh sách sân */}
              {displayed.length === 0 ? (
                <div className="fc-empty">
                  <div className="fc-empty-icon">🏟️</div>
                  <p>Không tìm thấy sân phù hợp.</p>
                  <p className="fc-empty-sub">Thử thay đổi bộ lọc để xem thêm kết quả.</p>
                </div>
              ) : (
                <ul className="fc-list">
                  {displayed.map((facility, idx) => (
                    <CourtCard key={facility.id} facility={facility} index={idx} />
                  ))}
                </ul>
              )}
            </>
          )}
        </div>

        {/* ── Cột phải: bản đồ ── */}
        <div className="fc-map-col">
          <FacilitiesMap facilities={displayed} />
        </div>

      </div>
    </div>
  );
}

// ── Card sân ─────────────────────────────────────────────────────
function CourtCard({ facility, index }) {
  const address = [facility.district, facility.city].filter(Boolean).join(", ");

  return (
    <li className="fc-card">
      {/* Placeholder ảnh cố định */}
      <div className="fc-card-img">
        <div className="fc-card-img-placeholder">
          <span className="fc-placeholder-icon">🏟️</span>
        </div>
        <span className="fc-card-index">#{index + 1}</span>
      </div>

      {/* Thông tin */}
      <div className="fc-card-body">
        <div className="fc-card-top">
          <div>
            <h2 className="fc-card-name">{facility.name}</h2>
            <p className="fc-card-address">{address || facility.address}</p>
          </div>
        </div>

        {/* Tags */}
        <div className="fc-card-tags">
          {facility.total_courts != null && (
            <span className="fc-tag fc-tag-courts">{facility.total_courts} sân</span>
          )}
          {facility.city && (
            <span className="fc-tag fc-tag-courts">{facility.city}</span>
          )}
        </div>

        {/* Footer card */}
        <div className="fc-card-footer">
          <div className="fc-card-price">
            {facility.min_price ? (
              <>
                <span className="fc-price-label">Từ</span>
                <span className="fc-price-value">{formatVnd(facility.min_price)}</span>
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

// ── Bản đồ ───────────────────────────────────────────────────────
// Trung tâm mặc định: TP.HCM
const DEFAULT_CENTER = [10.7769, 106.7009];
const DEFAULT_ZOOM = 12;

function FacilitiesMap({ facilities }) {
  // Chỉ lấy cơ sở có toạ độ hợp lệ
  const pinned = facilities.filter(
    (f) => f.latitude != null && f.longitude != null
  );

  // Tính center từ danh sách ghim, fallback về HCM
  const center =
    pinned.length > 0
      ? [
          pinned.reduce((s, f) => s + f.latitude, 0) / pinned.length,
          pinned.reduce((s, f) => s + f.longitude, 0) / pinned.length,
        ]
      : DEFAULT_CENTER;

  return (
    <MapContainer
      center={center}
      zoom={DEFAULT_ZOOM}
      className="fc-map"
      // key buộc re-mount khi center thay đổi đáng kể (danh sách mới)
      key={center.join(",")}
    >
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
                <p className="fc-map-popup-addr">
                  {[f.district, f.city].filter(Boolean).join(", ")}
                </p>
              )}
              <a
                className="fc-map-popup-link"
                href={`/courts/${f.id}`}
              >
                Xem chi tiết →
              </a>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
