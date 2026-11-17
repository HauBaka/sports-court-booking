import { useEffect, useRef, useState } from "react";
import { vnd } from "../lib/format";
import { TX_TYPES } from "./ui";

// Biểu đồ vẽ bằng SVG theo đúng bề rộng khung (đo bằng ResizeObserver), không cần thư viện.
// Màu: xanh sân cho tiền vào, cam cho tiền ra (đã chạy kiểm tra mù màu và tương phản của dataviz).
export const IN = "#1f6b3a", OUT = "#eb6834";

function useWidth() {
  const ref = useRef(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    const ro = new ResizeObserver(([e]) => setW(Math.round(e.contentRect.width)));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

const day = (s) => s.slice(0, 10);
const dm = (s) => `${s.slice(8, 10)}/${s.slice(5, 7)}`;
const short = (n) => (Math.abs(n) >= 1e6 ? `${String(+(n / 1e6).toFixed(2)).replace(".", ",")}tr` : `${Math.round(n / 1000)}k`);
// ba vạch lưới tròn số từ 0 tới đỉnh
const ticks = (max) => { const step = Math.max(1, Math.pow(10, Math.floor(Math.log10(max / 3 || 1)))); const s = Math.ceil(max / 3 / step) * step; return [0, s, 2 * s, 3 * s]; };
console.assert(ticks(900).at(-1) >= 900 && ticks(1).length === 4, "ticks cover the max");
// bốn vạch lưới ôm sát khoảng [lo, hi] để bậc số dư nhìn rõ, không kéo từ 0
const range = (lo, hi) => {
  const mag = 10 ** Math.floor(Math.log10(Math.max(hi - lo, hi * 0.12, 1) / 3));
  for (const m of [1, 2, 2.5, 5, 10, 20, 50]) { const s = m * mag, a = Math.max(0, Math.floor(lo / s) * s); if (a + 3 * s >= hi) return [a, a + s, a + 2 * s, a + 3 * s]; }
  return ticks(hi);
};
console.assert(range(1100000, 1300000)[0] >= 1000000 && range(1100000, 1300000)[3] >= 1300000, "range hugs the data");

// Đường bậc thang bo góc: số dư vẫn nhảy đúng tại giao dịch, chỉ góc bậc được bo cho mềm.
export function softSteps(p, R = 10) {
  let d = `M${p[0][0]} ${p[0][1]}`;
  for (let i = 1; i < p.length; i++) {
    const [x0, y0] = p[i - 1], [x1, y1] = p[i], dy = y1 - y0, sy = Math.sign(dy);
    const nx = p[i + 1]?.[0] ?? x1, r = Math.min(R, (x1 - x0) / 2, (nx - x1) / 2, Math.abs(dy) / 2);
    if (!sy || r <= 0) { d += `H${x1}V${y1}`; continue; }
    d += `H${x1 - r}Q${x1} ${y0} ${x1} ${y0 + sy * r}V${y1 - sy * r}Q${x1} ${y1} ${x1 + r} ${y1}`;
  }
  return d;
}
console.assert(softSteps([[0, 10], [20, 0], [40, 0]]).includes("Q"), "steps get rounded corners");

// Số dư ví theo thời gian: một đường bậc thang bo góc, mỗi giao dịch là một bậc.
export function BalanceChart({ txs, current, height = 180 }) {
  const [ref, w] = useWidth();
  const [hover, setHover] = useState(null);
  const list = [...txs].sort((a, b) => (a.at < b.at ? -1 : 1));
  // đi ngược từ số dư hiện tại để biết số dư sau mỗi giao dịch
  let bal = current;
  const after = new Array(list.length);
  for (let i = list.length - 1; i >= 0; i--) { after[i] = bal; bal -= list[i].amount; }
  const start = bal;
  const now = new Date().toISOString().slice(0, 16);
  const t0 = list.length ? new Date(list[0].at).getTime() - 864e5 : Date.now() - 7 * 864e5, t1 = Date.now();
  const pts = [{ at: new Date(t0).toISOString().slice(0, 16), bal: start }, ...list.map((t, i) => ({ at: t.at, bal: after[i], tx: t })), { at: now, bal: current }];
  const top = range(Math.min(...pts.map((p) => p.bal)), Math.max(...pts.map((p) => p.bal), 1));
  const L = 50, R = 14, T = 12, B = 26, iw = Math.max(1, w - L - R), ih = height - T - B;
  const x = (at) => L + ((new Date(at).getTime() - t0) / (t1 - t0 || 1)) * iw;
  const y = (v) => T + ih - ((v - top[0]) / (top[3] - top[0] || 1)) * ih;
  const d = softSteps(pts.map((p) => [x(p.at), y(p.bal)]));
  const area = `${d}V${T + ih}H${x(pts[0].at)}Z`;
  const near = (mx) => pts.slice(1, -1).reduce((best, p) => (Math.abs(x(p.at) - mx) < Math.abs(x(best.at) - mx) ? p : best), pts[1] || pts[0]);
  return (
    <div className="chart" ref={ref} role="img" aria-label={`Số dư ví theo thời gian, hiện tại ${vnd(current)}`}>
      {w > 0 && (
        <svg height={height} onMouseLeave={() => setHover(null)} onMouseMove={(e) => { const r = e.currentTarget.getBoundingClientRect(); if (list.length) setHover(near(e.clientX - r.left)); }}>
          <g className="grid axis">{top.map((v) => <g key={v}><line x1={L} x2={L + iw} y1={y(v)} y2={y(v)} /><text x={L - 8} y={y(v) + 4} textAnchor="end">{short(v)}</text></g>)}</g>
          <defs><linearGradient id="bal-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="currentColor" stopOpacity=".2" /><stop offset="1" stopColor="currentColor" stopOpacity="0" /></linearGradient></defs>
          <path className="bal-area" d={area} fill="url(#bal-fill)" />
          <path className="bal-line" d={d} pathLength="1" />
          {pts.slice(1, -1).map((p) => <circle key={p.tx.id} className="dot" cx={x(p.at)} cy={y(p.bal)} r={hover?.tx.id === p.tx.id ? 6 : 3.5} fill={p.tx.amount > 0 ? IN : OUT} />)}
          <circle className="dot dot--now" cx={x(now)} cy={y(current)} r={5.5} fill="currentColor" />
          <g className="axis">
            <text x={L} y={height - 6}>{dm(pts[0].at)}</text>
            <text x={L + iw / 2} y={height - 6} textAnchor="middle">{dm(new Date((t0 + t1) / 2).toISOString())}</text>
            <text x={L + iw} y={height - 6} textAnchor="end">Hôm nay</text>
          </g>
          {hover && <line className="cross" x1={x(hover.at)} x2={x(hover.at)} y1={T} y2={T + ih} />}
          <rect className="hit" x={L} y={0} width={iw} height={height} />
        </svg>
      )}
      {hover && (
        <div className="chart__tip" style={{ left: Math.min(Math.max(x(hover.at), 90), w - 90), top: y(hover.bal) }}>
          <div className="muted">{dm(hover.at)} · {hover.at.slice(11, 16)} · {TX_TYPES[hover.tx.type]}</div>
          <div>{hover.tx.amount > 0 ? "+" : "−"}{vnd(Math.abs(hover.tx.amount))}</div>
          <div className="muted">Số dư sau đó <b style={{ color: "var(--ink)" }}>{vnd(hover.bal)}</b></div>
        </div>
      )}
    </div>
  );
}

// Tiền vào và tiền ra theo ngày: hai cột cạnh nhau mỗi ngày, có chú thích và tooltip từng ngày.
export function FlowChart({ txs, days = 21, height = 170 }) {
  const [ref, w] = useWidth();
  const [hover, setHover] = useState(null);
  const today = new Date();
  const keys = Array.from({ length: days }, (_, i) => { const d = new Date(today); d.setDate(d.getDate() - (days - 1 - i)); return d.toISOString().slice(0, 10); });
  const rows = keys.map((k) => {
    const ts = txs.filter((t) => day(t.at) === k);
    return { k, in: ts.filter((t) => t.amount > 0).reduce((a, t) => a + t.amount, 0), out: -ts.filter((t) => t.amount < 0).reduce((a, t) => a + t.amount, 0), n: ts.length };
  });
  const top = ticks(Math.max(...rows.map((r) => Math.max(r.in, r.out)), 1));
  const L = 44, R = 6, T = 8, B = 22, iw = Math.max(1, w - L - R), ih = height - T - B;
  const slot = iw / days, bw = Math.max(3, Math.min(14, (slot - 6) / 2));
  const y = (v) => T + ih - (v / top.at(-1)) * ih;
  // đầu cột bo tròn hết, chân nằm trên đường gốc
  const bar = (x0, v, fill) => { const h = (v / top.at(-1)) * ih; if (h < 0.5) return null; const r = Math.min(bw / 2, h); const yb = T + ih; return <path d={`M${x0} ${yb}V${yb - h + r}Q${x0} ${yb - h} ${x0 + r} ${yb - h}H${x0 + bw - r}Q${x0 + bw} ${yb - h} ${x0 + bw} ${yb - h + r}V${yb}Z`} fill={fill} className="bar" />; };
  const sum = (k) => rows.reduce((a, r) => a + r[k], 0);
  return (
    <div className="chart" ref={ref} role="img" aria-label={`Tiền vào ${vnd(sum("in"))} và tiền ra ${vnd(sum("out"))} trong ${days} ngày qua`}>
      <div className="chart__legend chart__legend--top"><span><i style={{ background: IN }} />Tiền vào</span><span><i style={{ background: OUT }} />Tiền ra</span></div>
      {w > 0 && (
        <svg height={height} onMouseLeave={() => setHover(null)}>
          <g className="grid axis">{top.map((v) => <g key={v}><line x1={L} x2={L + iw} y1={y(v)} y2={y(v)} /><text x={L - 8} y={y(v) + 4} textAnchor="end">{short(v)}</text></g>)}</g>
          {rows.map((r, i) => {
            const cx = L + slot * i + slot / 2;
            return (
              <g key={r.k}>
                {hover?.k === r.k && <rect className="band" x={L + slot * i + 1} y={T} width={slot - 2} height={ih} rx={Math.min(10, slot / 2)} />}
                {bar(cx - bw - 1, r.in, IN)}
                {bar(cx + 1, r.out, OUT)}
                <rect className="hit" x={L + slot * i} y={0} width={slot} height={height} onMouseEnter={() => setHover({ ...r, cx })} />
              </g>
            );
          })}
          <g className="axis">
            <text x={L + slot / 2} y={height - 6} textAnchor="middle">{dm(keys[0])}</text>
            <text x={L + slot * Math.floor(days / 2) + slot / 2} y={height - 6} textAnchor="middle">{dm(keys[Math.floor(days / 2)])}</text>
            <text x={L + iw - slot / 2} y={height - 6} textAnchor="middle">Hôm nay</text>
          </g>
        </svg>
      )}
      {hover && (
        <div className="chart__tip" style={{ left: Math.min(Math.max(hover.cx, 90), w - 90), top: 36 }}>
          <div className="muted">Ngày {dm(hover.k)} · {hover.n} giao dịch</div>
          <div><i style={{ display: "inline-block", width: 8, height: 8, borderRadius: 2, background: IN, marginRight: 6 }} />Vào <b>{vnd(hover.in)}</b></div>
          <div><i style={{ display: "inline-block", width: 8, height: 8, borderRadius: 2, background: OUT, marginRight: 6 }} />Ra <b>{vnd(hover.out)}</b></div>
        </div>
      )}
    </div>
  );
}

// Khung chờ dùng chung: giả lập độ trễ mạng lần đầu vào trang.
export function useLoading(ms = 450) {
  const [loading, setLoading] = useState(true);
  useEffect(() => { const t = setTimeout(() => setLoading(false), ms); return () => clearTimeout(t); }, [ms]);
  return loading;
}
export const Skel = ({ w = "100%", h = 14, r, style }) => <div className="skel" style={{ width: w, height: h, borderRadius: r, ...style }} aria-hidden="true" />;
export const SkelRows = ({ n = 6 }) => (
  <div className="table-wrap fit" aria-hidden="true">
    {Array.from({ length: n }, (_, i) => <div className="skel-row" key={i}><Skel h={12} /><Skel h={12} w="80%" /><Skel h={12} w={`${60 + ((i * 17) % 30)}%`} /><Skel h={12} w="70%" style={{ justifySelf: "end" }} /></div>)}
  </div>
);
export const SkelStats = ({ n = 3 }) => Array.from({ length: n }, (_, i) => <div className="stat" key={i} aria-hidden="true"><Skel w={110} h={12} /><Skel w="60%" h={30} style={{ marginTop: 14 }} /><Skel w={140} h={11} style={{ marginTop: 12 }} /></div>);
export const SkelCard = ({ h = 180 }) => <div className="card" aria-hidden="true"><Skel w={140} h={14} /><Skel h={h - 70} style={{ marginTop: 18 }} r={14} /></div>;
