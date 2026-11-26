/**
 * BalanceChart — biểu đồ số dư ví theo thời gian.
 * SVG bậc thang bo góc, không dùng thư viện ngoài.
 * Port từ docs/ui-prototype/app/src/components/charts.jsx
 */
import { useEffect, useRef, useState } from "react";

const IN  = "#1f6b3a";
const OUT = "#eb6834";

function useWidth() {
  const ref = useRef(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) => setW(Math.round(e.contentRect.width)));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

const dm = (s) => `${s.slice(8, 10)}/${s.slice(5, 7)}`;
const short = (n) =>
  Math.abs(n) >= 1_000_000
    ? `${String(+(n / 1_000_000).toFixed(2)).replace(".", ",")}tr`
    : `${Math.round(n / 1000)}k`;

function niceStep(max) {
  // Tìm bước chia tròn đẹp để có 3–4 mốc từ 0 lên max
  const raw = max / 3;
  const mag = Math.pow(10, Math.floor(Math.log10(raw || 1)));
  for (const m of [1, 2, 2.5, 5, 10]) {
    const step = m * mag;
    if (step >= raw) return step;
  }
  return mag * 10;
}

function makeTicks(lo, hi) {
  // Luôn bắt đầu từ 0, bước đều, 3–4 mốc bao phủ hi
  const step = niceStep(hi);
  const ticks = [];
  for (let v = 0; v <= hi + step; v += step) {
    ticks.push(v);
    if (ticks.length >= 5) break;
  }
  // Đảm bảo hi nằm trong range
  while (ticks[ticks.length - 1] < hi) ticks.push(ticks[ticks.length - 1] + step);
  return ticks;
}

function softSteps(p, R = 10) {
  let d = `M${p[0][0]} ${p[0][1]}`;
  for (let i = 1; i < p.length; i++) {
    const [x0, y0] = p[i - 1], [x1, y1] = p[i];
    const dy = y1 - y0, sy = Math.sign(dy);
    const nx = p[i + 1]?.[0] ?? x1;
    const r = Math.min(R, (x1 - x0) / 2, (nx - x1) / 2, Math.abs(dy) / 2);
    if (!sy || r <= 0) { d += `H${x1}V${y1}`; continue; }
    d += `H${x1 - r}Q${x1} ${y0} ${x1} ${y0 + sy * r}V${y1 - sy * r}Q${x1} ${y1} ${x1 + r} ${y1}`;
  }
  return d;
}

const TX_LABEL = {
  TOPUP: "Nạp tiền", DEPOSIT: "Đặt cọc",
  REFUND: "Hoàn cọc", FORFEIT: "Bồi thường", SETTLE: "Quyết toán",
};

const fmtVnd = (n) => Number(n ?? 0).toLocaleString("vi-VN") + "đ";

/**
 * @param {{
 *   txs: Array<{ id, created_at: string, amount: number, balance_after: number, type: string }>,
 *   current: number,
 *   height?: number
 * }} props
 */
export default function BalanceChart({ txs = [], current = 0, height = 180 }) {
  const [ref, w] = useWidth();
  const [hover, setHover] = useState(null);

  // Sắp xếp theo thời gian tăng dần, dùng created_at từ API thực
  const list = [...txs].sort((a, b) => (a.created_at < b.created_at ? -1 : 1));

  // Tính số dư tại mỗi thời điểm đi ngược từ số dư hiện tại
  let bal = current;
  const after = new Array(list.length);
  for (let i = list.length - 1; i >= 0; i--) {
    after[i] = bal;
    bal -= list[i].amount;
  }
  const startBal = bal;

  const now = new Date().toISOString().slice(0, 16);
  const t0 = list.length
    ? new Date(list[0].created_at).getTime() - 86_400_000
    : Date.now() - 7 * 86_400_000;
  const t1 = Date.now();

  const pts = [
    { at: new Date(t0).toISOString().slice(0, 16), bal: startBal },
    ...list.map((t, i) => ({ at: t.created_at.slice(0, 16), bal: after[i], tx: t })),
    { at: now, bal: current },
  ];

  const top = makeTicks(
    Math.min(...pts.map((p) => p.bal)),
    Math.max(...pts.map((p) => p.bal), 1)
  );
  // top[0] luôn = 0, top[top.length-1] là mốc cao nhất
  const yMin = top[0];
  const yMax = top[top.length - 1];

  const L = 48, R = 56, T = 12, B = 26;
  const iw = Math.max(1, w - L - R);
  const ih = height - T - B;

  const xOf = (at) => L + ((new Date(at).getTime() - t0) / (t1 - t0 || 1)) * iw;
  const yOf = (v)  => T + ih - ((v - yMin) / (yMax - yMin || 1)) * ih;

  const d    = softSteps(pts.map((p) => [xOf(p.at), yOf(p.bal)]));
  const area = `${d}V${T + ih}H${xOf(pts[0].at)}Z`;

  const near = (mx) =>
    pts.slice(1, -1).reduce(
      (best, p) => (Math.abs(xOf(p.at) - mx) < Math.abs(xOf(best.at) - mx) ? p : best),
      pts[1] || pts[0]
    );

  return (
    <div
      className="chart"
      ref={ref}
      role="img"
      aria-label={`Số dư ví theo thời gian, hiện tại ${fmtVnd(current)}`}
    >
      {w > 0 && (
        <svg
          height={height}
          onMouseLeave={() => setHover(null)}
          onMouseMove={(e) => {
            if (!list.length) return;
            const r = e.currentTarget.getBoundingClientRect();
            setHover(near(e.clientX - r.left));
          }}
        >
          {/* Lưới + nhãn trục Y */}
          <g className="grid axis">
            {top.map((v) => (
              <g key={v}>
                <line x1={L} x2={L + iw} y1={yOf(v)} y2={yOf(v)} />
                <text x={L - 8} y={yOf(v) + 4} textAnchor="end">{short(v)}</text>
              </g>
            ))}
          </g>

          {/* Vùng tô */}
          <defs>
            <linearGradient id="bal-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="currentColor" stopOpacity=".2" />
              <stop offset="1" stopColor="currentColor" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path className="bal-area" d={area} fill="url(#bal-fill)" />

          {/* Đường */}
          <path className="bal-line" d={d} pathLength="1" />

          {/* Điểm giao dịch */}
          {pts.slice(1, -1).map((p) => (
            <circle
              key={p.tx.id}
              className="dot"
              cx={xOf(p.at)}
              cy={yOf(p.bal)}
              r={hover?.tx?.id === p.tx.id ? 6 : 3.5}
              fill={p.tx.amount > 0 ? IN : OUT}
            />
          ))}

          {/* Điểm hiện tại */}
          <circle className="dot" cx={xOf(now)} cy={yOf(current)} r={5.5} fill="currentColor" />

          {/* Nhãn trục X: đầu = ngày đầu tiên, cuối = Hôm nay, giữa = ngày có giao dịch */}
          <g className="axis">
            {/* Đầu: ngày giao dịch đầu tiên */}
            <text x={L} y={height - 6}>
              {list.length ? dm(list[0].created_at) : dm(pts[0].at)}
            </text>

            {/* Giữa: các ngày khác nhau có giao dịch, lọc bỏ trùng và quá gần */}
            {list.length >= 2 && (() => {
              const firstDay = list.length ? dm(list[0].created_at) : "";
              const seen = new Set([firstDay, "Hôm nay"]);
              const midLabels = [];
              for (const p of pts.slice(1, -1)) {
                const label = dm(p.at);
                if (seen.has(label)) continue;
                const px = xOf(p.at);
                if (px - L < 55 || (L + iw) - px < 65) continue;
                const last = midLabels[midLabels.length - 1];
                if (last && Math.abs(px - last.px) < 48) continue;
                seen.add(label);
                midLabels.push({ label, px });
              }
              return midLabels.map(({ label, px }) => (
                <text key={label} x={px} y={height - 6} textAnchor="middle">{label}</text>
              ));
            })()}

            {/* Cuối: Hôm nay — luôn hiện */}
            <text x={L + iw} y={height - 6} textAnchor="end">Hôm nay</text>
          </g>

          {/* Đường dọc hover */}
          {hover && (
            <line className="cross" x1={xOf(hover.at)} x2={xOf(hover.at)} y1={T} y2={T + ih} />
          )}
          <rect className="hit" x={L} y={0} width={iw} height={height} fill="transparent" />
        </svg>
      )}

      {/* Tooltip */}
      {hover && (
        <div
          className="chart__tip"
          style={{
            left: Math.min(Math.max(xOf(hover.at), 90), w - 90),
            top:  yOf(hover.bal),
          }}
        >
          <div className="muted">
            {dm(hover.at)} · {hover.at.slice(11, 16)} · {TX_LABEL[hover.tx.type] ?? hover.tx.type}
          </div>
          <div>
            {hover.tx.amount > 0 ? "+" : "−"}
            {fmtVnd(Math.abs(hover.tx.amount))}
          </div>
          <div className="muted">
            Số dư sau đó <b style={{ color: "var(--ink)" }}>{fmtVnd(hover.bal)}</b>
          </div>
        </div>
      )}
    </div>
  );
}
