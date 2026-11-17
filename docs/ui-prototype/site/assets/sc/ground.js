/*
  Sân Chung, the ground: one fixed layer behind every section (core.js mounts it in full-page mode).
  It is a single long drawing sheet of a sports complex, one region per section, stacked top to bottom. Going to a
  section moves the camera to its region (a pan, a small turn), while the sheet's colour runs to that section's
  ground, so sections never meet at an edge. Everything is hairline, in the ink of the section on show.
    region space: 1600 x 900, x = 800 on the screen's centre line, y = 0 at the screen's top (1 unit = 1 CSS px)
    courts are to scale inside their own group (1 unit = 10 cm; the pitch 1 unit = 20 cm)
*/
const GAP = 1500;
const f = n => +n.toFixed(2);
const P = (d, cls = '') => `<path d="${d}" pathLength="1"${cls ? ` class="${cls}"` : ''}/>`;
const T = (x, y, s, size = 12, anchor = 'middle') => `<text x="${x}" y="${y}" font-size="${size}" text-anchor="${anchor}">${s}</text>`;
// a group at (x, y), scaled k and turned; its strokes keep the sheet's width whatever the scale (core.css reads --gk)
const G = (x, y, k, rot, inner) => `<g data-k style="--gk:${k}" transform="translate(${x} ${y}) rotate(${rot}) scale(${k})">${inner}</g>`;
const circle = (cx, cy, r) => `M${f(cx + r)} ${cy}A${r} ${r} 0 1 1 ${f(cx - r)} ${cy}A${r} ${r} 0 1 1 ${f(cx + r)} ${cy}`;
const ticks = (r1, r2, n, skip = 0) => Array.from({ length: n }, (_, i) => {
  if (skip && i % skip === 0) return '';
  const a = (i / n) * 2 * Math.PI, c = Math.cos(a), d = Math.sin(a);
  return `M${f(c * r1)} ${f(d * r1)}L${f(c * r2)} ${f(d * r2)}`;
}).join('');

/* ---------------------------------------------------------------- courts, to scale */
// badminton, 13.40 x 6.10 m: side lines 0.46 m in, long service lines 0.76 m in, short service lines 1.98 m off the net
const badminton = () => P('M0 0H134V61H0Z') + P('M0 4.6H134M0 56.4H134') + P('M7.6 0V61M126.4 0V61') + P('M47.2 0V61M86.8 0V61')
  + P('M0 30.5H47.2M86.8 30.5H134') + P('M67 -4V65', 'net');
// pickleball, 13.41 x 6.10 m: the non-volley line 2.13 m off the net
const pickle = () => P('M0 0H134.1V61H0Z') + P('M45.7 0V61M88.4 0V61') + P('M0 30.5H45.7M88.4 30.5H134.1') + P('M67 -4V65', 'net');
// five-a-side, 40 x 20 m (1 unit = 20 cm): 6 m penalty arcs, 3 m centre circle, 3 m goals
const pitch = () => P('M0 0H200V100H0Z') + P('M100 0V100') + P(circle(100, 50, 15)) + P('M0 20A30 30 0 0 1 0 80') + P('M200 20A30 30 0 0 0 200 80')
  + P('M0 42.5H-5V57.5H0M200 42.5H205V57.5H200') + P(circle(100, 50, 0.8));

/* ---------------------------------------------------------------- objects, drawn large and cut by the screen's edge */
// a shuttlecock, cork down (about 96 x 200)
const shuttle = () => P('M-24 0A24 27 0 0 0 24 0Z') + P('M-24 0H24M-23 -10H23')
  + P('M-22 -10L-70 -170M22 -10L70 -170') + P('M-70 -170Q-52 -187 -35 -172Q-17 -189 0 -174Q17 -189 35 -172Q52 -187 70 -170')
  + P('M-11 -10L-35 -172M0 -10V-174M11 -10L35 -172') + P('M-37 -60Q0 -51 37 -60M-49 -100Q0 -89 49 -100');
// a badminton racket, head up (about 130 x 400)
const racket = () => {
  const rx = 62, ry = 80, cy = -200;
  let s = '';
  for (const x of [-36, -18, 0, 18, 36]) { const h = ry * Math.sqrt(1 - (x / rx) ** 2); s += `M${x} ${f(cy - h)}V${f(cy + h)}`; }
  for (const y of [-48, -24, 0, 24, 48]) { const w = rx * Math.sqrt(1 - (y / ry) ** 2); s += `M${f(-w)} ${cy + y}H${f(w)}`; }
  return P(`M${rx} ${cy}A${rx} ${ry} 0 1 1 ${-rx} ${cy}A${rx} ${ry} 0 1 1 ${rx} ${cy}`) + P(s, 'thin') + P('M-16 -122L-4 -96V60M16 -122L4 -96V60') + P('M-10 60H10V176Q0 184 -10 176Z') + P('M-10 84H10M-10 108H10M-10 132H10M-10 156H10', 'thin');
};
// a pickleball paddle with its ball (about 200 x 260)
const paddle = () => P('M-60 -150Q-60 -196 -14 -196H14Q60 -196 60 -150V-70Q60 -18 14 -6H-14Q-60 -18 -60 -70Z') + P('M-14 -6V84Q0 92 14 84V-6') + P('M-14 20H14M-14 44H14M-14 68H14', 'thin')
  + P(circle(104, 40, 34)) + P([[92, 26], [112, 22], [122, 40], [104, 42], [88, 48], [100, 60], [118, 58]].map(([x, y]) => circle(x, y, 3.6)).join(''), 'thin');
// a football: the centre pentagon, the five seams to the edge (r = 120)
const football = () => {
  const pt = (r, a) => [f(r * Math.cos((a * Math.PI) / 180)), f(r * Math.sin((a * Math.PI) / 180))];
  let pent = '', seams = '';
  for (let k = 0; k < 5; k++) {
    const a = -90 + 72 * k, [x, y] = pt(40, a), [ox, oy] = pt(82, a), [l1, l2] = pt(120, a - 24), [r1, r2] = pt(120, a + 24), [mx, my] = pt(92, a + 36);
    pent += `${k ? 'L' : 'M'}${x} ${y}`;
    seams += `M${x} ${y}L${ox} ${oy}L${l1} ${l2}M${ox} ${oy}L${r1} ${r2}M${ox} ${oy}L${mx} ${my}`;
  }
  return P(circle(0, 0, 120)) + P(pent + 'Z') + P(seams, 'thin');
};
// a stopwatch, its hand on the 19:00 of the page's example booking (r = 100)
const stopwatch = () => P(circle(0, 0, 100)) + P(circle(0, 0, 88), 'thin') + P(ticks(78, 88, 12)) + P(ticks(83, 88, 60, 5), 'thin')
  + P('M-13 -100V-124H13V-100M-20 -124H20V-136H-20Z') + P('M68 -76L80 -90L92 -80L80 -66') + P('M0 0V-66') + P('M0 0L-24 41.6') + P(circle(0, 0, 4));
// a whistle with its cord ring (about 190 x 130)
const whistle = () => P('M-12 -50H118V-16H44A52 52 0 1 1 -12 -50Z') + P(circle(-4, 2, 14), 'thin') + P('M52 -50V-16', 'thin') + P(circle(-58, -40, 13)) + P('M136 -62L158 -78M140 -34H168M134 -6L154 10', 'thin');
// a net between two posts, seen from the side (w x h)
const net = (w, h) => {
  let mesh = '';
  for (let x = 20; x < w; x += 20) mesh += `M${x} 0V${h}`;
  for (let y = 14; y < h; y += 14) mesh += `M0 ${y}H${w}`;
  return P(`M0 -8V${h + 70}M${w} -8V${h + 70}`) + P(`M0 0H${w}V${h}H0Z`) + P(mesh, 'thin') + P(`M-40 ${h + 70}H${w + 40}`);
};
const cone = () => P('M0 -60L22 0H-22Z') + P('M-8 -38H8M-15 -18H15', 'thin') + P('M-30 0H30');

/* ---------------------------------------------------------------- one region per section, top to bottom */
const dim = (x1, x2, y, label) => P(`M${x1} ${y}H${x2}M${x1} ${y - 6}V${y + 6}M${x2} ${y - 6}V${y + 6}`, 'thin') + T((x1 + x2) / 2, y - 10, label);
const REGION = {
  top: () => G(-150, 700, 4.6, -14, badminton()) + G(690, 196, 0.5, 28, shuttle()),
  lich: () => G(880, 150, 5.2, -6, badminton() + T(67, -9, '13,40 m', 3) + P('M0 -6H134M0 -8V-4M134 -8V-4', 'thin')) + G(1530, 560, 1.15, -148, shuttle()) + G(60, 610, 0.9, 24, racket()),
  dat: () => G(140, 250, 5, 0, pickle() + T(56.3, 73, '2,13 m', 3) + P('M45.7 68H67M45.7 66V70M67 66V70', 'thin')) + G(1470, 700, 1.25, 16, paddle()),
  vi: () => G(820, 150, 3.9, -4, pitch() + T(100, -6, '40 m', 4)) + G(96, 690, 1.5, 12, football()) + G(1500, 640, 1, 0, cone()) + G(1560, 660, 0.8, 0, cone()),
  mon: () => G(628, 92, 0.42, 24, shuttle()) + G(690, 178, 0.3, 0, P(circle(0, 0, 34)) + P([[-12, -14], [8, -18], [18, 0], [0, 2], [-16, 8], [-4, 20], [14, 18]].map(([x, y]) => circle(x, y, 3.6)).join(''), 'thin'))
    + G(748, 124, 0.24, 0, football()) + P('M-200 236H1800', 'thin'),
  coc: () => G(1420, 140, 2.1, 0, stopwatch()) + T(1180, 96, '19:00', 13, 'end') + G(60, 760, 1.1, -18, whistle()),
  'chu-san': () => G(540, 150, 1, 0, net(520, 84)) + dim(540, 1060, 120, '6,10 m') + T(1076, 196, '1,55 m', 12, 'start') + G(96, 690, 1.1, 32, shuttle()) + G(1520, 700, 1.1, -28, shuttle()),
  'hoi-dap': () => `<g data-k style="--gk:1.75" transform="translate(770 420) scale(1.75)">${P('M0 150H402') + P('M201 150V104') + P('M36 112Q214 -92 392 150', 'dash') + P('M36 112Q150 22 232 150', 'dash') + P('M48 62L322 150', 'dash') + T(207, 100, '1,55 m', 7, 'start')}</g>`
    + G(84, 300, 1, -14, whistle()),
  contact: () => G(40, 70, 7.6, 0, pitch()) + G(1500, 200, 0.6, 30, shuttle()),
};

// the sheet's colour under each section; `dark` turns the ink light
export const GROUNDS = {
  top: '#f6f4ee', lich: '#fafaf6', dat: '#eff0e8', vi: '#131714', mon: '#f8f6f0', coc: '#f0efe6', 'chu-san': '#f5f6f0', 'hoi-dap': '#faf9f4', contact: '#121512',
};
const DARK = new Set(['vi', 'contact']);
// a small turn and step back per region, so no two camera moves are the same
const CAM = { top: [0, 1], lich: [0, 1], dat: [0, 1], vi: [-1.5, 1.03], mon: [0, 1], coc: [1.5, 1], 'chu-san': [0, 1.02], 'hoi-dap': [-1, 1], contact: [2, 1.04] };

export function mountGround(ids) {
  // the box is in the markup (index.html), so the sheet is there on the first paint; a page without it gets one
  let box = document.querySelector('.sc-ground');
  if (!box) {
    box = document.createElement('div');
    box.className = 'sc-ground';
    box.setAttribute('aria-hidden', 'true');
    box.innerHTML = '<i class="sc-g-tone"></i><i class="sc-g-dots"></i><i class="sc-g-light"></i><i class="sc-g-night"></i>';
    document.body.prepend(box);
  }
  const tone = box.querySelector('.sc-g-tone'), night = box.querySelector('.sc-g-night');
  // the tape down the left edge: a mark every 5 m of the sheet, so a move reads as distance covered. Only the stretch
  // on screen (and, during a move, the stretch travelled) is drawn: the whole sheet as one layer cost ~200 MB to raster.
  const TAPE = ids.length * GAP + 800;
  const ticks = (lo, hi) => {
    let s = `<path d="M22 ${lo}V${hi}" class="thin"/>`;
    for (let y = Math.ceil(lo / 50) * 50, n = y / 50; y < hi; y += 50, n++) s += `<path d="M22 ${y}H${n % 4 ? 28 : 36}" class="thin"/>${n % 4 ? '' : `<text x="42" y="${y + 4}" font-size="10">${n * 5} m</text>`}`;
    return s;
  };
  // Each region is its own drawing, and the tape and the plan are two blocks moved by transform alone: a camera move
  // is then a move of ready pictures (the compositor's work), not a redraw of every line on every frame.
  box.insertAdjacentHTML('beforeend', `<div class="sc-tape"></div><div class="sc-plan">${ids.map((id, i) =>
    `<svg class="sc-region${DARK.has(id) ? ' is-dark' : ''}" data-r="${id}" width="1600" height="900" style="top:${i * GAP}px" focusable="false">${(REGION[id] || (() => ''))()}</svg>`).join('')}</div>`);
  const tapeG = box.querySelector('.sc-tape'), plan = box.querySelector('.sc-plan');
  const regions = [...plan.children];
  // the tape's screen top sits at at * GAP + 400 on the sheet (see place()); draw the span between two such stops
  const top = n => n * GAP + 400;
  const drawTape = (a, b) => {
    const lo = Math.max(0, Math.min(top(a), top(b)) - 200), hi = Math.min(TAPE, Math.max(top(a), top(b)) + innerHeight + 200);
    tapeG.innerHTML = `<svg width="90" height="${hi - lo}" viewBox="0 ${lo} 90 ${hi - lo}" style="position:absolute;left:0;top:${lo}px;max-width:none;overflow:visible" focusable="false">${ticks(lo, hi)}</svg>`;
  };
  let at = -1, tidy = 0;
  const place = () => {
    const [rot, zoom] = CAM[ids[at]] || [0, 1];
    plan.style.transform = `translate(${f(innerWidth / 2)}px, ${f(innerHeight / 2)}px) rotate(${rot}deg) scale(${zoom}) translate(-800px, ${-(at * GAP + innerHeight / 2)}px)`;
    tapeG.style.transform = `translate(0px, ${-at * GAP - 400}px)`;
  };
  addEventListener('resize', () => { if (at >= 0) { drawTape(at, at); place(); } });
  // only the region on show (and, during a move, the one being left) is in the page at all
  const near = keep => regions.forEach((r, n) => r.classList.toggle('is-near', keep.includes(n)));
  return {
    // move to section i; `still` skips the travel (a jump the visitor did not ask the page to animate)
    aim(i, still) {
      const from = at, id = ids[i], dark = DARK.has(id), was = DARK.has(ids[from]);
      at = i;
      clearTimeout(tidy);
      box.classList.toggle('is-still', !!still);
      tone.style.backgroundColor = GROUNDS[id] || GROUNDS.top;
      box.classList.toggle('is-dark', dark);
      // the night sheet comes up from the side the dark section lies on, and leaves by the far side
      if (dark !== was || from < 0) {
        const side = i > from ? 1 : -1;
        if (dark && !still) { night.style.transition = 'none'; night.style.transform = `translateY(${side * 150}vh)`; void night.offsetWidth; night.style.transition = ''; }
        night.style.transform = dark ? 'none' : `translateY(${-side * 150}vh)`;
      }
      near(still || from < 0 ? [i] : [from, i]);
      drawTape(still || from < 0 ? i : from, i);
      place();
      if (regions[i] && !regions[i].classList.contains('is-in')) { void regions[i].getBoundingClientRect(); regions[i].classList.add('is-in'); }
      if (still) requestAnimationFrame(() => requestAnimationFrame(() => box.classList.remove('is-still')));
      else tidy = setTimeout(() => { near([at]); drawTape(at, at); }, 1300);
    },
  };
}
