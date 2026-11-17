// section motion, part c:
//   #mon  three drawn scenes, one per sport. Each plays a second of the game through (a jump smash, a side step
//         and a low block, a shot seen from behind the kicker), then goes back to the frame a tenth of a second
//         after the contact: that caught frame is the tile's picture. Hover, focus or a tap plays it again.
//         The first visit shows them one at a time, each alone and large before it goes to its place.
//   #coc  the refund tiers, the cancel-time slider, and a cancel screen that acts out a cancellation at the
//         slider's hour: the booking turns cancelled, the hours go back to free, the refund counts into the wallet.
const SC = window.SC;
const R = SC.reduced();
document.documentElement.classList.add('sc-c');

const EASE = 'cubic-bezier(0.16, 1, 0.3, 1)';
// fill 'backwards' holds the first frame through the delay, then hands the element back to its CSS
const anim = (el, kf, o = {}) => (el && !R ? el.animate(kf, { duration: 700, easing: EASE, fill: 'backwards', ...o }) : null);
const rise = (el, delay, dy = 16, o = {}) => anim(el, [{ opacity: 0, translate: `0 ${dy}px` }, { opacity: 1, translate: '0 0' }], { delay, ...o });
const vnd = n => Math.round(n).toLocaleString('vi-VN') + 'đ';
// fn(eased 0..1) every frame for dur ms after delay; fn(0) at once
const outCubic = k => 1 - (1 - k) ** 3, inOut = k => (k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2);
const tween = (dur, delay, fn, ease = outCubic) => new Promise(done => {
  fn(0);
  const t0 = performance.now() + delay;
  const step = now => { const k = Math.min(1, Math.max(0, (now - t0) / dur)); fn(ease(k)); if (k < 1) requestAnimationFrame(step); else done(); };
  requestAnimationFrame(step);
});

/* ------------------------------------------------------------ #mon: the drawn scenes
   A figure is eleven joints and a tool; a scene is a list of poses in time. Limbs are round strokes between
   joints, so a pose is only coordinates and any frame between two poses is a blend of them.
   Every scene is drawn in a 480 x 360 box that is always shown whole (the floor runs on past it), whatever the
   tile's shape: nothing of the play is ever cut by the tile. */
const NS = 'http://www.w3.org/2000/svg';
const el = (name, attrs, parent) => { const e = document.createElementNS(NS, name); for (const k in attrs) e.setAttribute(k, attrs[k]); parent?.append(e); return e; };
const lerp = (a, b, t) => a + (b - a) * t;
const blend = (p, q, t) => { const o = {}; for (const k in p) o[k] = [lerp(p[k][0], q[k][0], t), lerp(p[k][1], q[k][1], t)]; return o; };
const CURVE = { io: inOut, out: outCubic, in: t => t * t, lin: t => t };
// frames: [ms, pose, curve into this pose]; the pose at time t
const poseAt = (frames, t) => {
  if (t <= frames[0][0]) return frames[0][1];
  for (let i = 1; i < frames.length; i++) {
    if (t <= frames[i][0]) { const [t0, p0] = frames[i - 1], [t1, p1, c = 'io'] = frames[i]; return blend(p0, p1, CURVE[c]((t - t0) / (t1 - t0))); }
  }
  return frames[frames.length - 1][1];
};
console.assert(poseAt([[0, { a: [0, 0] }], [100, { a: [10, 20] }, 'lin']], 50).a[1] === 10, 'pose blend');
const pl = (...pts) => 'M' + pts.map(p => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join('L');
const unit = (a, b) => { const x = b[0] - a[0], y = b[1] - a[1], n = Math.hypot(x, y) || 1; return [x / n, y / n]; };
const off = (p, u, d) => [p[0] + u[0] * d, p[1] + u[1] * d];
// j: hd toward the head, nk base of the neck, hp hip, eL hL / eR hR elbow and hand, kL fL / kR fR knee and foot,
//    rk the middle of the tool's face (where it meets the ball).
// wide: half the shoulder line, for a figure seen from the front or the back (0: seen from the side).
// The head always stands one neck above nk, in the direction of hd, so no pose can sink it into the shoulders.
function figure(parent, { w = 1, tool = '', wide = 0 } = {}) {
  const g = el('g', { class: 'sp-fig', fill: 'none', stroke: 'currentColor', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, parent);
  const mk = sw => el('path', { 'stroke-width': sw * w }, g);
  const legL = mk(14), armL = mk(10), legR = mk(14), neck = mk(8);
  const body = wide ? el('path', { 'stroke-width': 9 * w, fill: 'currentColor' }, g) : mk(20);
  const armR = mk(10);
  const head = el('circle', { r: 12.5 * w, fill: 'currentColor', stroke: 'none' }, g);
  const shaft = tool ? mk(tool === 'racket' ? 3 : 5) : null;
  const face = tool === 'racket' ? el('ellipse', { rx: 11 * w, ry: 15 * w, 'stroke-width': 3 * w }, g) : tool ? mk(20) : null;
  return p => {
    const up = unit(p.nk, p.hd), down = unit(p.nk, p.hp), side = [down[1], -down[0]];
    const hc = off(p.nk, up, 25 * w);
    const sL = wide ? off(p.nk, side, -wide) : off(p.nk, down, 5 * w), sR = wide ? off(p.nk, side, wide) : sL;
    const qL = wide ? off(p.hp, side, -wide * 0.62) : p.hp, qR = wide ? off(p.hp, side, wide * 0.62) : p.hp;
    legL.setAttribute('d', pl(qL, p.kL, p.fL)); legR.setAttribute('d', pl(qR, p.kR, p.fR));
    neck.setAttribute('d', pl(p.nk, hc));
    body.setAttribute('d', wide ? pl(sL, sR, qR, qL) + 'Z' : pl(off(p.nk, down, 9 * w), p.hp));
    armL.setAttribute('d', pl(sL, p.eL, p.hL)); armR.setAttribute('d', pl(sR, p.eR, p.hR));
    head.setAttribute('cx', hc[0].toFixed(1)); head.setAttribute('cy', hc[1].toFixed(1));
    if (!tool) return;
    const u = unit(p.hR, p.rk);
    if (tool === 'racket') {
      shaft.setAttribute('d', pl(p.hR, off(p.rk, u, -14 * w)));
      face.setAttribute('cx', p.rk[0].toFixed(1)); face.setAttribute('cy', p.rk[1].toFixed(1));
      face.setAttribute('transform', `rotate(${(Math.atan2(u[1], u[0]) * 180 / Math.PI + 90).toFixed(1)} ${p.rk[0].toFixed(1)} ${p.rk[1].toFixed(1)})`);
    } else {
      shaft.setAttribute('d', pl(p.hR, off(p.rk, u, -9 * w)));
      face.setAttribute('d', pl(off(p.rk, u, -8 * w), off(p.rk, u, 8 * w)));
    }
  };
}
const J = (hd, nk, hp, eL, hL, eR, hR, kL, fL, kR, fR, rk = hR) => ({ hd, nk, hp, eL, hL, eR, hR, kL, fL, kR, fR, rk });
const shadow = (svg, y) => el('ellipse', { class: 'sp-shadow', cy: y, ry: 5 }, svg);
const floor = (svg, y) => el('rect', { class: 'sp-floor', x: -600, y, width: 1680, height: 900 }, svg);
const bz = (u, a, b, c) => [(1 - u) ** 2 * a[0] + 2 * u * (1 - u) * b[0] + u * u * c[0], (1 - u) ** 2 * a[1] + 2 * u * (1 - u) * b[1] + u * u * c[1]];
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));

// a scene: view, the part of the 480 x 360 box the play needs; dur, the whole play; shot, the frame the tile keeps (a tenth of a second after the contact, or the
// keeper starting to go); draw(t)
const SCENES = {
  // side view: a lob comes over the net, the player jumps and smashes it back down over the net
  badminton(svg) {
    floor(svg, 330);
    el('path', { class: 'sp-line', d: 'M-600 330H1080M60 330L26 360M250 330L232 360' }, svg);
    el('path', { class: 'sp-net', d: 'M330 181L346 175V324L330 330ZM330 196L346 190M330 211L346 205M335 179V209M341 177V207' }, svg);
    el('path', { class: 'sp-line sp-line--strong', d: 'M330 181V330M346 175V324' }, svg);
    const sh = shadow(svg, 332);
    const trail = el('path', { class: 'sp-trail' }, svg);
    const draw = figure(svg, { tool: 'racket' });
    const bird = el('g', { class: 'sp-bird' }, svg);
    const cone = el('path', { class: 'sp-bird__cone' }, bird), cork = el('circle', { class: 'sp-bird__cork', r: 5.5 }, bird);
    const HIT = [214, 62], T = 820, V = [0.6, 0.36];
    const F = [
      [0, J([158, 171], [154, 196], [150, 250], [136, 216], [128, 238], [172, 214], [190, 196], [138, 292], [130, 330], [166, 290], [174, 330], [206, 170])],
      [320, J([152, 185], [150, 210], [148, 262], [170, 196], [192, 176], [166, 196], [150, 176], [134, 300], [130, 330], [168, 298], [174, 330], [128, 156]), 'io'],
      [640, J([146, 117], [150, 142], [154, 196], [176, 122], [196, 98], [130, 124], [116, 144], [140, 236], [116, 262], [170, 236], [158, 274], [100, 170]), 'out'],
      [T, J([170, 120], [164, 144], [158, 198], [160, 170], [172, 190], [182, 118], [198, 90], [142, 238], [122, 268], [178, 232], [186, 270], HIT), 'in'],
      [960, J([180, 139], [172, 162], [162, 214], [158, 186], [150, 206], [198, 168], [218, 186], [146, 256], [130, 292], [182, 250], [190, 292], [240, 216]), 'out'],
      [1160, J([184, 173], [176, 196], [164, 246], [156, 216], [146, 236], [196, 214], [204, 238], [150, 290], [142, 330], [184, 288], [196, 330], [214, 268]), 'io'],
    ];
    return {
      view: '76 16 404 334', dur: 1240, shot: T + 100,
      draw(t) {
        const p = poseAt(F, t);
        draw(p);
        const air = 330 - Math.max(p.fL[1], p.fR[1]);
        sh.setAttribute('cx', p.hp[0]); sh.setAttribute('rx', Math.max(14, 34 - air * 0.3));
        let pos, dir;
        if (t < T) {
          const u = clamp((t - 60) / (T - 60)), a = [476, 150], b = [330, -64], c = HIT;
          pos = bz(u, a, b, c); const q = bz(Math.min(1, u + 0.02), a, b, c); dir = [q[0] - pos[0], q[1] - pos[1]];
          trail.setAttribute('d', '');
        } else {
          const k = t - T; pos = [HIT[0] + V[0] * k, HIT[1] + V[1] * k]; dir = V;
          const back = Math.min(k, 150);
          trail.setAttribute('d', pl(off(pos, V, -back * 0.8 - 30), off(pos, V, -30)) + pl([pos[0] - V[0] * back * 0.6 - 34, pos[1] - V[1] * back * 0.6 - 4], [pos[0] - 34, pos[1] - 6]) + pl([pos[0] - V[0] * back * 0.6 - 16, pos[1] - V[1] * back * 0.6 - 30], [pos[0] - 16, pos[1] - 32]));
        }
        const [ux, uy] = unit([0, 0], dir);
        cork.setAttribute('cx', pos[0].toFixed(1)); cork.setAttribute('cy', pos[1].toFixed(1));
        cone.setAttribute('d', `M${(pos[0] - ux * 4).toFixed(1)} ${(pos[1] - uy * 4).toFixed(1)}L${(pos[0] - ux * 25 - uy * 11).toFixed(1)} ${(pos[1] - uy * 25 + ux * 11).toFixed(1)}L${(pos[0] - ux * 25 + uy * 11).toFixed(1)} ${(pos[1] - uy * 25 - ux * 11).toFixed(1)}Z`);
      },
    };
  },
  // seen across the net: two side steps, a lunge and a low block; the ball comes from our side and goes back over
  pickleball(svg) {
    floor(svg, 226);
    el('path', { class: 'sp-line', d: 'M-600 226H1080M96 226L40 300M384 226L440 300M240 226V300' }, svg);
    const sh = shadow(svg, 292);
    const draw = figure(svg, { tool: 'paddle', wide: 15, w: 0.92 });
    el('path', { class: 'sp-net', d: 'M-600 300H1080V344H-600ZM-600 315H1080M-600 330H1080' + Array.from({ length: 25 }, (_, i) => `M${i * 20} 300V344`).join('') }, svg);
    el('path', { class: 'sp-line sp-line--strong', d: 'M-600 300H1080' }, svg);
    const trail = el('path', { class: 'sp-trail' }, svg);
    const ball = el('circle', { class: 'sp-ball' }, svg);
    const HIT = [322, 238], T = 760;
    const F = [
      [0, J([190, 134], [190, 160], [190, 212], [168, 182], [172, 202], [212, 182], [222, 200], [174, 250], [166, 290], [206, 250], [214, 290], [236, 182])],
      [260, J([223, 130], [222, 156], [220, 208], [200, 178], [204, 198], [244, 178], [254, 196], [210, 248], [206, 290], [234, 248], [238, 290], [270, 180]), 'io'],
      [500, J([247, 134], [246, 160], [245, 212], [224, 182], [226, 202], [270, 182], [282, 198], [228, 250], [216, 290], [264, 250], [276, 290], [300, 190]), 'io'],
      [T, J([280, 150], [272, 174], [262, 222], [252, 198], [240, 214], [296, 196], [308, 220], [240, 254], [214, 290], [290, 252], [300, 290], HIT), 'out'],
      [900, J([282, 148], [274, 172], [264, 220], [252, 196], [238, 208], [300, 190], [316, 204], [242, 254], [214, 290], [292, 250], [300, 290], [336, 214]), 'out'],
      [1200, J([276, 142], [270, 168], [262, 218], [250, 192], [240, 208], [294, 190], [306, 208], [244, 254], [222, 290], [286, 250], [296, 290], [322, 192]), 'io'],
    ];
    return {
      view: '100 92 330 262', dur: 1240, shot: T + 100,
      draw(t) {
        const p = poseAt(F, t);
        draw(p);
        sh.setAttribute('cx', (p.fL[0] + p.fR[0]) / 2); sh.setAttribute('rx', 22 + (p.fR[0] - p.fL[0]) * 0.4);
        let pos, r;
        if (t < T) {
          const u = clamp((t - 160) / (T - 160));
          pos = bz(u, [352, 392], [388, 236], HIT); r = lerp(15, 7.5, u);
          trail.setAttribute('d', '');
        } else {
          const u = clamp((t - T) / 440), e = 1 - (1 - u) ** 2;
          const B = [372, 150], C = [418, 372];
          pos = bz(e, HIT, B, C); r = lerp(7.5, 16, e);
          trail.setAttribute('d', pl(bz(Math.max(0, e - 0.34), HIT, B, C), bz(Math.max(0, e - 0.1), HIT, B, C)));
        }
        ball.setAttribute('cx', pos[0].toFixed(1)); ball.setAttribute('cy', pos[1].toFixed(1)); ball.setAttribute('r', r.toFixed(1));
      },
    };
  },
  // from behind the kicker: the plant, the swing, the shot leaves for the far corner and the keeper goes
  football(svg) {
    floor(svg, 196);
    el('path', { class: 'sp-line', d: 'M-600 196H1080M214 196L186 228H420L390 196M110 344Q240 300 380 344' }, svg);
    el('path', { class: 'sp-net', d: 'M232 196V128H372V196' + Array.from({ length: 9 }, (_, i) => `M${246 + i * 14} 128V196`).join('') + 'M232 145H372M232 162H372M232 179H372' }, svg);
    el('path', { class: 'sp-line sp-line--strong', d: 'M232 196V128H372V196' }, svg);
    const keeper = figure(svg, { w: 0.5, wide: 6 });
    const trail = el('path', { class: 'sp-trail' }, svg);
    const ball = el('circle', { class: 'sp-ball' }, svg);
    const sh = shadow(svg, 344);
    const kicker = figure(svg, { w: 1.45, wide: 21 });
    const T = 880, A = [208, 322], B = [344, 146];
    const K = [
      [0, J([302, 133], [302, 146], [302, 167], [292, 154], [286, 162], [312, 154], [318, 162], [296, 182], [293, 196], [308, 182], [311, 196])],
      [960, J([302, 136], [302, 149], [302, 169], [291, 157], [284, 163], [313, 157], [320, 163], [295, 183], [292, 196], [309, 183], [312, 196]), 'io'],
      [1180, J([322, 137], [318, 148], [312, 167], [314, 140], [320, 130], [328, 139], [336, 129], [304, 182], [296, 196], [318, 183], [318, 196]), 'io'],
      [1400, J([338, 150], [332, 158], [320, 172], [338, 151], [346, 144], [340, 155], [349, 150], [310, 180], [300, 190], [312, 185], [304, 196]), 'out'],
    ];
    // the run-up from the left edge (two strides and a long bound), the plant beside the ball with the kicking leg
    // cocked high behind and the body leaning away, the strike, and the leg swinging on up across the line of the shot
    const F = [
      [0, J([96, 140], [94, 170], [92, 238], [72, 200], [66, 226], [116, 188], [128, 166], [88, 290], [84, 342], [106, 292], [100, 318])],
      [260, J([124, 134], [122, 164], [118, 234], [104, 184], [106, 160], [140, 196], [150, 220], [108, 288], [96, 320], [124, 290], [130, 342]), 'lin'],
      [520, J([146, 138], [146, 168], [144, 238], [114, 176], [90, 166], [176, 196], [190, 220], [154, 288], [160, 336], [138, 290], [152, 316]), 'lin'],
      [740, J([138, 144], [148, 172], [162, 240], [118, 160], [90, 148], [184, 200], [204, 222], [168, 292], [172, 342], [188, 288], [200, 256]), 'out'],
      [T, J([146, 144], [156, 172], [168, 240], [124, 164], [96, 156], [188, 198], [206, 216], [170, 292], [172, 342], [196, 290], [204, 332]), 'in'],
      [1100, J([144, 140], [156, 170], [172, 238], [124, 154], [98, 134], [194, 194], [216, 208], [170, 290], [170, 340], [200, 258], [214, 204]), 'out'],
      [1440, J([174, 142], [174, 172], [176, 240], [150, 196], [142, 222], [198, 200], [206, 226], [168, 292], [164, 342], [194, 290], [208, 332]), 'io'],
    ];
    return {
      view: '64 92 336 266', dur: 1540, shot: 1100,
      draw(t) {
        const p = poseAt(F, t);
        kicker(p); keeper(poseAt(K, t));
        sh.setAttribute('cx', p.hp[0]); sh.setAttribute('rx', 54);
        const u = clamp((t - T) / 520);
        const x = lerp(A[0], B[0], u), y = lerp(A[1], B[1], u) - 30 * Math.sin(Math.PI * u);
        ball.setAttribute('cx', x.toFixed(1)); ball.setAttribute('cy', y.toFixed(1)); ball.setAttribute('r', lerp(12, 4.5, u).toFixed(1));
        const u0 = Math.max(0, u - 0.3);
        trail.setAttribute('d', u > 0 ? pl([lerp(A[0], B[0], u0), lerp(A[1], B[1], u0) - 30 * Math.sin(Math.PI * u0)], [lerp(A[0], B[0], u * 0.94), lerp(A[1], B[1], u * 0.94) - 30 * Math.sin(Math.PI * u * 0.94) + 2]) : '');
      },
    };
  },
};

const mon = document.getElementById('mon');
if (mon) {
  const tiles = [...mon.querySelectorAll('.sports__tile[data-sport]')].filter(t => SCENES[t.dataset.sport]);
  const plays = tiles.map(tile => {
    const svg = el('svg', { class: 'sp', preserveAspectRatio: 'xMidYMid meet', 'aria-hidden': 'true', focusable: 'false' });
    const box = document.createElement('div');
    box.className = 'sp-box';
    box.append(svg);
    const sc = SCENES[tile.dataset.sport](svg);
    svg.setAttribute('viewBox', sc.view);
    // the catch: a flash, and (in CSS, on .sp-box) four corner marks, like a frame taken out of the film
    el('rect', { class: 'sp-flash', x: -600, y: -600, width: 1680, height: 1560 }, svg);
    tile.prepend(box);
    sc.draw(sc.shot);
    tile.classList.add('is-caught');
    let raf = 0, end = null;
    // the whole play, then the tile goes back to the caught frame; resolves when it has
    const play = () => new Promise(done => {
      cancelAnimationFrame(raf); end?.();
      end = done;
      if (R) return done();
      tile.classList.remove('is-caught');
      const t0 = performance.now() + 200;
      const step = now => {
        const t = now - t0;
        if (t < sc.dur) { sc.draw(Math.max(0, t)); raf = requestAnimationFrame(step); return; }
        sc.draw(sc.shot); tile.classList.add('is-caught'); end = null; done();
      };
      sc.draw(0);
      raf = requestAnimationFrame(step);
    });
    tile.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse' && !mon.classList.contains('mon-intro')) play(); });
    tile.addEventListener('focus', () => { if (tile.matches(':focus-visible')) play(); });
    tile.addEventListener('click', play);
    return play;
  });

  /* The first visit in full-page mode shows the three one at a time: each scene comes up alone and large in the
     middle of the screen, plays, and only then goes to its place in the row; the heading comes last. A step
     (wheel, key, swipe) during it ends it: down puts everything in place, up leaves. */
  const fpIntro = document.documentElement.classList.contains('sc-fp') && !R && tiles.length === 3;
  if (fpIntro) mon.classList.add('mon-intro');
  SC.onEnter(mon, async () => {
    if (!fpIntro) { plays.forEach((p, i) => setTimeout(p, 500 + i * 450)); return; }
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const IO = 'cubic-bezier(.62, .02, .2, 1)';
    let over = false;
    const anims = [];
    const finish = () => {
      if (over) return;
      over = true;
      anims.forEach(a => a.cancel());
      tiles.forEach(t => { t.classList.add('is-placed'); t.style.zIndex = ''; });
      mon.classList.remove('mon-intro');
      SC.intercept = null;
    };
    SC.intercept = dir => { if (over) return false; finish(); return dir > 0; };
    new IntersectionObserver((es, io) => { if (!es[es.length - 1].isIntersecting) { finish(); io.disconnect(); } }, { rootMargin: '-30% 0px -30% 0px' }).observe(mon);
    const at = (elm, root) => { let x = 0, y = 0; for (let n = elm; n && n !== root; n = n.offsetParent) { x += n.offsetLeft; y += n.offsetTop; } return [x, y]; };
    const bar = document.querySelector('header.nav')?.offsetHeight || 0;
    await sleep(260);
    // the middle tile comes last: shown large in the middle, a later one would land on top of it
    const order = tiles.map((_, n) => n).sort((m, n) => (m === 1) - (n === 1));
    for (let o = 0; o < order.length && !over; o++) {
      const i = order[o], tile = tiles[i], [x, y] = at(tile, mon), w = tile.offsetWidth, h = tile.offsetHeight;
      // alone in the middle of what the header leaves of the screen, as large as fits
      const k = Math.min(1.6, (mon.offsetHeight - bar - 56) / h, (mon.offsetWidth - 160) / w);
      const big = `translate(${mon.offsetWidth / 2 - x - w / 2}px, ${bar + (mon.offsetHeight - bar) / 2 - y - h / 2}px) scale(${k})`;
      tile.style.zIndex = 3;
      anims.push(tile.animate([{ opacity: 0, transform: `${big} scale(.94)` }, { opacity: 1, transform: big }], { duration: 520, easing: EASE, fill: 'both' }));
      await sleep(260);
      if (over) break;
      await plays[i]();
      await sleep(520);
      if (over) break;
      tile.classList.add('is-placed');
      const down = tile.animate([{ transform: big }, { transform: 'none' }], { duration: 900, easing: IO, fill: 'both' });
      anims.push(down);
      down.finished.then(() => { tile.style.zIndex = ''; }, () => {});
      await sleep(o < order.length - 1 ? 520 : 760);
    }
    finish();
  });
}

/* ------------------------------------------------------------ #coc */
const DEPOSIT = 94800, WALLET = 405200;
const refund = h => (h >= 24 ? 80 : h >= 12 ? 50 : 0);
const refundText = p => (p ? `Hoàn ${p}% · ${vnd(DEPOSIT * p / 100)} về ví` : 'Hoàn 0% · 0đ, tiền cọc chuyển cho chủ sân');
// self-check: the three boundaries of the refund rule and the amounts from the 94.800đ deposit
console.assert(refund(48) === 80 && refund(24) === 80 && refund(23.99) === 50 && refund(12) === 50 && refund(11.99) === 0 && refund(11) === 0 && refund(0) === 0, 'refund tiers');
console.assert(refundText(80) === 'Hoàn 80% · 75.840đ về ví' && refundText(50) === 'Hoàn 50% · 47.400đ về ví', 'refund amounts');

const coc = document.getElementById('coc');
const tiers = coc?.querySelector('.tiers');
const calc = coc?.querySelector('[data-coc-calc]');
if (tiers && calc) {
  const lis = [...tiers.children];
  const range = calc.querySelector('input'), hours = calc.querySelector('.coc-calc__h'), out = calc.querySelector('output');
  const dots = [...calc.querySelectorAll('.coc-dots > i')], marks = [...calc.querySelectorAll('.coc-marks > button')];
  const screen = initCancel(coc.querySelector('[data-cx]'));
  let prev = +range.value;
  const set = () => {
    const h = +range.value, p = refund(h);
    calc.style.setProperty('--h', h);
    range.setAttribute('aria-valuetext', `${h} giờ`);
    hours.textContent = `${h} giờ`;
    const t = refundText(p);
    if (out.textContent !== t) { out.textContent = t; if (!R) anim(out, [{ opacity: 0.2, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }], { duration: 420 }); }
    lis.forEach((li, i) => li.classList.toggle('is-on', i === [80, 50, 0].indexOf(p)));
    calc.dataset.tier = p;
    // a checkpoint lights once the thumb has reached it, and flashes as the thumb crosses it
    dots.forEach(d => {
      const at = +d.dataset.h;
      d.classList.toggle('is-past', h >= at);
      if (!R && at !== prev && (prev - at) * (h - at) <= 0 && h !== prev) anim(d, [{ transform: 'translate(-50%, -50%) scale(1.9)' }, { transform: 'translate(-50%, -50%) scale(1)' }], { duration: 450 });
    });
    marks.forEach(m => m.setAttribute('aria-pressed', String(+m.dataset.h === h)));
    prev = h;
    screen?.preview(h);
  };
  calc.hidden = false;
  set();
  // the visitor moves the slider: the screen shows that hour's numbers at once and acts it out when the hand rests
  let idle = 0;
  const moved = () => { tiers.classList.add('is-live'); set(); clearTimeout(idle); idle = setTimeout(() => screen?.run(+range.value), 650); };
  range.addEventListener('input', moved);
  // a checkpoint button runs the thumb to its hour
  marks.forEach(m => m.addEventListener('click', () => {
    tiers.classList.add('is-live');
    const from = +range.value, to = +m.dataset.h;
    if (R || from === to) { range.value = to; moved(); return; }
    tween(380, 0, k => { const v = Math.round(from + (to - from) * k); if (v !== +range.value || k === 1) { range.value = v; set(); } }).then(moved);
  }));
  // each tier's rule becomes a drawn line
  tiers.classList.add('c-ruled');
  lis.forEach(li => { const r = document.createElement('span'); r.className = 'c-rule'; r.setAttribute('aria-hidden', 'true'); li.append(r); });
  SC.onEnter(coc, () => {
    if (R) { tiers.classList.add('is-live'); return; }
    // one tier after the other, each number counting up from 0
    lis.forEach((li, i) => {
      const d = 350 + i * 420, stat = li.querySelector('.t-stat'), to = parseInt(stat.textContent, 10);
      anim(li.querySelector('.c-rule'), [{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], { delay: d, duration: 1100 });
      rise(li.querySelector(':scope > span'), d + 150, 12);
      anim(stat, [{ opacity: 0, translate: '0 10px' }, { opacity: 1, translate: '0 0' }], { delay: d, duration: 500 });
      if (to) tween(1200, d, k => { stat.textContent = Math.round(to * k) + '%'; }, inOut);
    });
    rise(calc, 1500, 12);
    // then the slider shows what it does: the knob runs from 0 to 30 hours, each tier lights as it is crossed,
    // and the screen cancels the booking at 30 hours
    let touched = false;
    ['pointerdown', 'keydown'].forEach(t => calc.addEventListener(t, () => { touched = true; }, { once: true }));
    range.value = 0; set();
    setTimeout(() => {
      tiers.classList.add('is-live');
      tween(2000, 0, k => { if (touched) return; const v = Math.round(30 * k); if (v !== +range.value) { range.value = v; set(); } }, inOut)
        .then(() => { if (!touched) screen?.run(+range.value); });
    }, 1900);
  });
}

// the cancel screen: preview(h) writes hour h's numbers; run(h) acts the cancellation out
function initCancel(root) {
  if (!root) return null;
  const $ = k => root.querySelector(`[data-cx="${k}"]`);
  const app = root.querySelector('.cx__app'), again = root.querySelector('.cx__again');
  const cursor = document.createElement('span');
  cursor.className = 'dat-cursor cx__cursor';
  cursor.innerHTML = '<svg viewBox="0 0 22 22"><path d="M4 2.5v15.6l4.1-3.9 2.8 6.3 2.7-1.2-2.8-6.2 5.7-.4z" fill="var(--u-ink, #1d1d1b)" stroke="#fff" stroke-width="1.4" stroke-linejoin="round"/></svg>';
  app.append(cursor);
  let token = 0, hour = 30;
  const STOP = Symbol('stop');
  const sleep = (ms, my) => new Promise((res, rej) => setTimeout(() => (my === token ? res() : rej(STOP)), ms));
  const parts = h => { const p = refund(h), back = DEPOSIT * p / 100; return { p, back, keep: DEPOSIT - back }; };
  console.assert(parts(30).back === 75840 && parts(30).keep === 18960 && parts(13).back === 47400 && parts(3).keep === DEPOSIT, 'cancel split');
  const rest = h => {
    const { p, back, keep } = parts(h);
    $('h').textContent = `${h} giờ`; $('pct').textContent = `${p}%`; $('back').textContent = vnd(back); $('keep').textContent = vnd(keep);
    $('st').textContent = 'Đã cọc'; $('st').className = 'cx__st';
    [$('c1'), $('c2')].forEach(c => { c.className = ''; });
    $('wallet').textContent = vnd(WALLET);
    $('btn').textContent = 'Hủy đặt sân'; $('btn').className = 'cx__btn';
    app.classList.remove('is-done', 'is-zero');
    again.querySelector('span').textContent = `Chạy lại với ${h} giờ`;
    cursor.classList.remove('is-on');
  };
  const done = h => {
    const { back } = parts(h);
    rest(h);
    $('st').textContent = 'Đã hủy'; $('st').className = 'cx__st is-off';
    [$('c1'), $('c2')].forEach(c => { c.className = 'is-free'; });
    $('wallet').textContent = vnd(WALLET + back);
    $('btn').textContent = 'Đã hủy'; $('btn').className = 'cx__btn is-off';
    $('toast').textContent = back ? `Đã hủy. ${vnd(back)} đã về ví.` : 'Đã hủy. Tiền cọc chuyển cho chủ sân.';
    app.classList.add('is-done'); app.classList.toggle('is-zero', !back);
  };
  async function run(h) {
    const my = ++token;
    hour = h;
    if (R) { done(h); return; }
    const { back } = parts(h), btn = $('btn');
    rest(h);
    again.hidden = false;
    root.classList.add('is-running');
    try {
      await sleep(350, my);
      // the cursor comes down to the button and presses it
      const x = btn.offsetLeft + btn.offsetWidth * 0.62, y = btn.offsetTop + btn.offsetHeight * 0.55;
      cursor.classList.add('is-on');
      cursor.animate([{ transform: `translate(${app.clientWidth * 0.86}px, ${app.clientHeight * 0.3}px)` }, { transform: `translate(${x}px, ${y}px)` }], { duration: 620, easing: 'cubic-bezier(.45, 0, .2, 1)', fill: 'forwards' });
      await sleep(640, my);
      btn.classList.add('is-press');
      await sleep(180, my);
      btn.classList.remove('is-press'); btn.classList.add('is-load'); btn.textContent = 'Đang hủy';
      await sleep(750, my);
      cursor.classList.remove('is-on');
      btn.className = 'cx__btn is-off'; btn.textContent = 'Đã hủy';
      $('st').textContent = 'Đã hủy'; $('st').className = 'cx__st is-off';
      anim($('st'), [{ transform: 'scale(.8)' }, { transform: 'none' }], { duration: 400 });
      for (const c of [$('c1'), $('c2')]) { c.className = 'is-free'; anim(c, [{ transform: 'scale(.86)' }, { transform: 'none' }], { duration: 360 }); await sleep(140, my); }
      await sleep(260, my);
      $('toast').textContent = back ? `Đã hủy. ${vnd(back)} đã về ví.` : 'Đã hủy. Tiền cọc chuyển cho chủ sân.';
      app.classList.add('is-done'); app.classList.toggle('is-zero', !back);
      if (back) await tween(900, 0, k => { if (my === token) $('wallet').textContent = vnd(WALLET + back * k); });
    } catch (e) { if (e !== STOP) throw e; }
    if (my === token) root.classList.remove('is-running');
  }
  again.addEventListener('click', () => run(hour));
  rest(hour);
  return { run, preview(h) { token++; hour = h; rest(h); root.classList.remove('is-running'); } };
}
