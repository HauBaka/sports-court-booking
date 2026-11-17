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
const short = (n) => (Math.abs(n) >= 1e6 ? `${(n / 1e6).toFixed(1).replace(".0", "").replace(".", ",")}tr` : `${Math.round(n / 1000)}k`);
// ba vạch lưới tròn số từ 0 tới đỉnh
const ticks = (max) => { const step = Math.max(1, Math.pow(10, Math.floor(Math.log10(max / 3 || 1)))); const s = Math.ceil(max / 3 / step) * step; return [0, s, 2 * s, 3 * s]; };
console.assert(ticks(900).at(-1) >= 900 && ticks(1).length === 4, "ticks cover the max");

// Số dư ví theo thời gian: một đường bậc thang, mỗi giao dịch là một bậc.
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
  const top = ticks(Math.max(...pts.map((p) => p.bal), 1));
  const L = 44, R = 10, T = 10, B = 24, iw = Math.max(1, w - L - R), ih = height - T - B;
  const x = (at) => L + ((new Date(at).getTime() - t0) / (t1 - t0 || 1)) * iw;
  const y = (v) => T + ih - (v / top.at(-1)) * ih;
  let d = `M${x(pts[0].at)} ${y(pts[0].bal)}`;
  for (let i = 1; i < pts.length; i++) d += `H${x(pts[i].at)}V${y(pts[i].bal)}`;
  const area = `${d}V${T + ih}H${x(pts[0].at)}Z`;
  const near = (mx) => pts.slice(1, -1).reduce((best, p) => (Math.abs(x(p.at) - mx) < Math.abs(x(best.at) - mx) ? p : best), pts[1] || pts[0]);
  return (
    <div className="chart" ref={ref} role="img" aria-label={`Số dư ví theo thời gian, hiện tại ${vnd(current)}`}>
      {w > 0 && (
        <svg height={height} onMouseLeave={() => setHover(null)} onMouseMove={(e) => { const r = e.currentTarget.getBoundingClientRect(); if (list.length) setHover(near(e.clientX - r.left)); }}>
          <g className="grid axis">{top.map((v) => <g key={v}><line x1={L} x2={L + iw} y1={y(v)} y2={y(v)} /><text x={L - 8} y={y(v) + 4} textAnchor="end">{short(v)}</text></g>)}</g>
          <path className="bal-area" d={area} />
          <path className="bal-line" d={d} />
          {pts.slice(1, -1).map((p) => <circle key={p.tx.id} className="dot" cx={x(p.at)} cy={y(p.bal)} r={4.5} fill={p.tx.amount > 0 ? IN : OUT} />)}
          <g className="axis">
            <text x={L} y={height - 6}>{dm(pts[0].at)}</text>
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
  // cột bo 4px ở đầu, chân nằm trên đường gốc
  const bar = (x0, v, fill) => { const h = (v / top.at(-1)) * ih; if (h < 0.5) return null; const r = Math.min(4, h, bw / 2); const yb = T + ih; return <path d={`M${x0} ${yb}V${yb - h + r}Q${x0} ${yb - h} ${x0 + r} ${yb - h}H${x0 + bw - r}Q${x0 + bw} ${yb - h} ${x0 + bw} ${yb - h + r}V${yb}Z`} fill={fill} />; };
  const sum = (k) => rows.reduce((a, r) => a + r[k], 0);
  return (
    <div className="chart" ref={ref} role="img" aria-label={`Tiền vào ${vnd(sum("in"))} và tiền ra ${vnd(sum("out"))} trong ${days} ngày qua`}>
      <div className="chart__legend" style={{ marginBottom: 8 }}><span><i style={{ background: IN }} />Tiền vào</span><span><i style={{ background: OUT }} />Tiền ra</span></div>
      {w > 0 && (
        <svg height={height} onMouseLeave={() => setHover(null)}>
          <g className="grid axis">{top.map((v) => <g key={v}><line x1={L} x2={L + iw} y1={y(v)} y2={y(v)} /><text x={L - 8} y={y(v) + 4} textAnchor="end">{short(v)}</text></g>)}</g>
          {rows.map((r, i) => {
            const cx = L + slot * i + slot / 2;
            return (
              <g key={r.k}>
                {hover?.k === r.k && <rect x={L + slot * i + 1} y={T} width={slot - 2} height={ih} rx={6} fill="var(--surface-2)" />}
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
