import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useStore, occupancy } from "../data/store";
import { CITIES, SPORTS, sportName } from "../data/mock";
import { dateKey, hoursBetween, hourOf, vnd } from "../lib/format";
import { Empty, Icon, Rating } from "../components/ui";

const PAGE = 4;

function freeHoursToday(state, f) {
  const today = dateKey(new Date());
  const occ = occupancy(state, f.id, today);
  const nowH = new Date().getHours();
  let n = 0;
  for (const c of f.courts.filter((x) => x.active)) for (const h of hoursBetween(c.open, c.close)) if (hourOf(h) > nowH && (!occ[c.id][h] || occ[c.id][h].ghost)) n++;
  return n;
}

export default function SearchPage() {
  const { state } = useStore();
  const nav = useNavigate();
  const [sport, setSport] = useState("all");
  const [city, setCity] = useState("TP.HCM");
  const [district, setDistrict] = useState("");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("rating");
  const [page, setPage] = useState(1);
  const [hot, setHot] = useState(null);
  // giả lập độ trễ mạng lần đầu để thấy khung chờ
  const [loading, setLoading] = useState(true);
  useEffect(() => { const t = setTimeout(() => setLoading(false), 400); return () => clearTimeout(t); }, []);

  const results = useMemo(() => {
    const k = q.trim().toLowerCase();
    const list = state.facilities.filter((f) =>
      (sport === "all" || f.sports.includes(sport)) && f.city === city && (!district || f.district === district) &&
      (!k || (f.name + " " + f.street + " " + f.district).toLowerCase().includes(k)));
    const minPrice = (f) => Math.min(...f.courts.filter((c) => c.active).map((c) => c.price));
    return list.map((f) => ({ ...f, from: minPrice(f), free: freeHoursToday(state, f) }))
      .sort((a, b) => (sort === "price" ? a.from - b.from : sort === "free" ? b.free - a.free : b.rating - a.rating));
  }, [state, sport, city, district, q, sort]);

  const pages = Math.max(1, Math.ceil(results.length / PAGE));
  const shown = results.slice((page - 1) * PAGE, page * PAGE);
  const reset = (fn) => (v) => { fn(v); setPage(1); };

  return (
    <main className="page">
      <div className="wrap">
        <div className="page-head">
          <div>
            <h1>Tìm sân còn trống</h1>
            <p>Chọn môn và khu vực. Mỗi sân hiện số giờ còn trống hôm nay và giá thấp nhất mỗi giờ.</p>
          </div>
        </div>

        <form className="sbar" onSubmit={(e) => e.preventDefault()} role="search">
          <label className="sbar__seg sbar__seg--q"><span>Tìm theo tên</span>
            <input placeholder="Tên sân hoặc tên đường, ví dụ Cộng Hòa" value={q} onChange={(e) => reset(setQ)(e.target.value)} />
            {q && <button type="button" className="sbar__clear" aria-label="Xóa từ khóa" onClick={() => reset(setQ)("")}><Icon name="x" size={12} /></button>}
          </label>
          <label className="sbar__seg"><span>Thành phố</span>
            <select value={city} onChange={(e) => { setCity(e.target.value); setDistrict(""); setPage(1); }}>
              {Object.keys(CITIES).map((c) => <option key={c}>{c}</option>)}
            </select>
          </label>
          <label className="sbar__seg"><span>Quận, huyện</span>
            <select value={district} onChange={(e) => reset(setDistrict)(e.target.value)}>
              <option value="">Tất cả quận</option>
              {CITIES[city].map((d) => <option key={d}>{d}</option>)}
            </select>
          </label>
          <label className="sbar__seg"><span>Xếp theo</span>
            <select value={sort} onChange={(e) => setSort(e.target.value)}>
              <option value="rating">Đánh giá cao nhất</option><option value="price">Giá thấp nhất</option><option value="free">Nhiều giờ trống nhất</option>
            </select>
          </label>
          <button className="sbar__go"><Icon name="search" size={18} />Tìm sân</button>
        </form>

        <div className="result-bar">
          <div className="chips" role="group" aria-label="Môn">
            <button className={"chip" + (sport === "all" ? " on" : "")} onClick={() => reset(setSport)("all")}>Tất cả môn</button>
            {SPORTS.map((s) => <button key={s.id} className={"chip" + (sport === s.id ? " on" : "")} onClick={() => reset(setSport)(s.id)}>{s.name}</button>)}
          </div>
          <span className="muted small">{loading ? "Đang tìm…" : `${results.length} cơ sở ở ${district || city}`}</span>
        </div>

        <div className="split split--search">
          <div className="stack stagger scroll" style={{ "--gap": "16px" }} key={loading ? "sk" : page}>
            {loading && [0, 1, 2].map((i) => <SkeletonCard key={i} />)}
            {!loading && shown.length === 0 && <Empty title="Chưa có sân phù hợp">Thử bỏ bớt bộ lọc quận hoặc chọn môn khác.</Empty>}
            {!loading && shown.map((f) => (
              <Link key={f.id} to={`/san/${f.id}`} className={"card fac" + (hot === f.id ? " is-hot" : "")} onMouseEnter={() => setHot(f.id)} onMouseLeave={() => setHot(null)}>
                <div className="fac__img"><img src={f.photos[0]} alt={`Sân của ${f.name}`} loading="lazy" /></div>
                <div className="fac__body">
                  <div className="row between"><div className="chips">{f.sports.map((s) => <span key={s} className="tag">{sportName(s)}</span>)}</div><Rating value={f.rating} count={f.reviews} /></div>
                  <h3 style={{ fontSize: 20 }}>{f.name}</h3>
                  <div className="row small ink2" style={{ "--gap": "6px" }}><Icon name="pin" size={15} />{f.street}, {f.district} · {f.open}–{f.close}</div>
                  <div className="fac__foot">
                    <div><div className="muted small">Giá từ</div><div className="price">{vnd(f.from)}<small> / giờ</small></div></div>
                    <span className={"badge " + (f.free > 0 ? "badge--deposited" : "badge--cancelled")}>{f.free > 0 ? `Còn ${f.free} giờ trống hôm nay` : "Hôm nay đã kín"}</span>
                  </div>
                </div>
              </Link>
            ))}
            {!loading && pages > 1 && (
              <nav className="row" aria-label="Phân trang" style={{ justifyContent: "center", marginTop: 8 }}>
                <button className="icon-btn" disabled={page === 1} onClick={() => setPage(page - 1)} aria-label="Trang trước"><Icon name="chevL" /></button>
                {Array.from({ length: pages }, (_, i) => <button key={i} className={"chip" + (page === i + 1 ? " on" : "")} onClick={() => setPage(i + 1)}>{i + 1}</button>)}
                <button className="icon-btn" disabled={page === pages} onClick={() => setPage(page + 1)} aria-label="Trang sau"><Icon name="chevR" /></button>
              </nav>
            )}
          </div>
          <div className="sticky hide-sm">
            <MapView items={loading ? [] : results} hot={hot} setHot={setHot} onOpen={(id) => nav(`/san/${id}`)} />
          </div>
        </div>
      </div>
    </main>
  );
}

function MapView({ items, hot, setHot, onOpen }) {
  const ref = useRef(null);
  // ghim rơi xuống lần lượt; dùng Web Animations vì animation CSS trên ghim bị Chromium giữ ở khung đầu (ghim vô hình)
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    ref.current.querySelectorAll(".pin-slot").forEach((el, i) => el.animate(
      [{ opacity: 0, transform: "translateY(-18px)" }, { opacity: 1, transform: "none" }],
      { duration: 500, delay: 120 + i * 60, easing: "cubic-bezier(.16,1,.3,1)", fill: "backwards" }));
  }, [items.length]);
  return (
    <div className="map" ref={ref} role="region" aria-label="Bản đồ vị trí các cơ sở">
      <svg className="streets" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <rect width="100" height="100" fill="#eef1ec" />
        {[12, 27, 41, 56, 70, 86].map((y) => <path key={"h" + y} d={`M0 ${y} C 30 ${y + 3}, 60 ${y - 3}, 100 ${y + 1}`} stroke="#ffffff" strokeWidth=".9" fill="none" />)}
        {[8, 24, 39, 55, 71, 88].map((x) => <path key={"v" + x} d={`M${x} 0 C ${x + 3} 35, ${x - 2} 65, ${x + 2} 100`} stroke="#ffffff" strokeWidth=".9" fill="none" />)}
        <path d="M-5 70 C 20 60, 35 78, 55 68 S 85 50, 105 58" stroke="#ffffff" strokeWidth="2.4" fill="none" />
        <path d="M30 -5 C 34 30, 46 50, 44 105" stroke="#ffffff" strokeWidth="2" fill="none" />
        <path d="M75 -5 C 70 25, 92 55, 88 105" stroke="#cfe0ec" strokeWidth="4" fill="none" />
        <rect x="58" y="20" width="10" height="8" rx="1.5" fill="#d6e6d3" />
        <rect x="14" y="78" width="12" height="9" rx="1.5" fill="#d6e6d3" />
      </svg>
      {items.map((f) => (
        <span key={f.id} className="pin-slot" style={{ left: f.map.x + "%", top: f.map.y + "%" }}><button className={"pin" + (hot === f.id ? " on" : "")} onMouseEnter={() => setHot(f.id)} onMouseLeave={() => setHot(null)} onClick={() => onOpen(f.id)} aria-label={`${f.name}, giá từ ${vnd(f.from)}`}>
          {Math.round(f.from / 1000)}k
        </button></span>
      ))}
      <span className="map__note">Bản đồ minh họa. Bản thật dùng Leaflet với dữ liệu OpenStreetMap.</span>
    </div>
  );
}

const SkeletonCard = () => (
  <div className="card fac fac--skel" aria-hidden="true">
    <div className="fac__img skel" style={{ borderRadius: 0 }} />
    <div className="fac__body">
      <div className="skel" style={{ width: 120, height: 20 }} />
      <div className="skel" style={{ width: "70%", height: 24 }} />
      <div className="skel" style={{ width: "55%", height: 14 }} />
      <div className="fac__foot"><div className="skel" style={{ width: 110, height: 30 }} /><div className="skel" style={{ width: 150, height: 22, borderRadius: 999 }} /></div>
    </div>
  </div>
);
