// section motion, part b:
//   #dat  one device and one column of words. The four steps are four screens of the same device: one card, one
//         bar (step, title, progress, replay), the screens sliding through it. The first time, the device plays
//         the steps large and alone (carried in from #lich's court grid), then steps back to the left and the
//         words and the step tabs come in on the right, so the visitor can play any step again.
//   #vi   a tactics board: three wallets as three players, the deposit as the one ball passed between them.
//         One case at a time, three steps, each held long enough to read; the visitor picks the case and the step.
const SC = window.SC;
const html = document.documentElement;
const STOP = Symbol('stop');
const E = 'cubic-bezier(.16, 1, .3, 1)', IO = 'cubic-bezier(.62, .02, .2, 1)';
const vnd = n => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.') + 'đ';
console.assert(vnd(405200) === '405.200đ' && vnd(0) === '0đ' && vnd(18960) === '18.960đ', 'vnd format');

// a cancellable run: every wait rejects with STOP once a newer run has started
function runner() {
  let token = 0;
  const timers = new Set(), anims = new Set();
  const stop = () => { token++; timers.forEach(clearTimeout); timers.clear(); anims.forEach(a => a.cancel()); anims.clear(); };
  const ctx = () => {
    const my = token;
    const live = () => my === token;
    return {
      live,
      wait: ms => new Promise((res, rej) => { const t = setTimeout(() => { timers.delete(t); live() ? res() : rej(STOP); }, ms); timers.add(t); }),
      anim(el, kf, o) { const a = el.animate(kf, o); anims.add(a); a.finished.then(() => anims.delete(a), () => {}); return a; },
      count(el, from, to, ms, fmt = vnd) {
        const t0 = performance.now();
        return new Promise(res => {
          const tick = now => {
            if (!live()) return res();
            const k = Math.max(0, Math.min(1, (now - t0) / ms)), e = 1 - Math.pow(1 - k, 3);
            el.textContent = fmt(from + (to - from) * e);
            k < 1 ? requestAnimationFrame(tick) : res();
          };
          requestAnimationFrame(tick);
        });
      },
    };
  };
  return { stop, ctx };
}
const swallow = e => { if (e !== STOP) throw e; };

/* ================================================================ #dat */
const dat = document.getElementById('dat');
if (dat) initDat(dat);

function initDat(root) {
  const steps = [...root.querySelectorAll('.mo-pc__step')];
  const figs = [...root.querySelectorAll('.mo-pc__visual')];
  const list = root.querySelector('.mo-pc__steps');
  const stage = root.querySelector('.dat-stage');
  const text = root.querySelector('.mo-pc__text');
  if (steps.length !== 4 || figs.length !== 4 || !list || !stage || !text) return;
  const titles = steps.map(s => s.querySelector('h3')?.textContent || '');
  const snaps = figs.map(f => f.querySelector('.tour').innerHTML);

  // the tabs: real buttons in a tablist, one per step, each naming its drawn screen
  const tabs = document.createElement('div');
  tabs.className = 'dat-tabs';
  tabs.setAttribute('role', 'tablist');
  tabs.setAttribute('aria-label', 'Các bước đặt sân');
  const btns = steps.map((s, i) => {
    figs[i].id ||= `dat-screen-${i + 1}`;
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'dat-tab'; b.id = `dat-tab-${i + 1}`;
    b.setAttribute('role', 'tab'); b.setAttribute('aria-controls', figs[i].id);
    b.innerHTML = `<span class="dat-tab__n">0${i + 1}</span><span class="dat-tab__h">${titles[i]}</span><span class="dat-tab__p">${s.querySelector('p')?.textContent || ''}</span>`;
    tabs.append(b);
    return b;
  });

  // the cursor: a drawn arrow that moves into whichever figure is acting
  const cursor = document.createElement('span');
  cursor.className = 'dat-cursor';
  cursor.setAttribute('aria-hidden', 'true');
  cursor.innerHTML = '<svg viewBox="0 0 22 22"><path d="M4 2.5v15.6l4.1-3.9 2.8 6.3 2.7-1.2-2.8-6.2 5.7-.4z" fill="var(--u-ink, #1d1d1b)" stroke="#fff" stroke-width="1.4" stroke-linejoin="round"/></svg>';
  let cx = 0, cy = 0;

  const R = runner();
  let cur = 0, visible = false, timer = 0, seq = 0, bar = null, carried = false;
  // 'wait' until the section is first seen in full-page mode, 'run' while the four steps play alone, then 'done'
  let intro = 'done';
  // the kit's pinned moment is let go once it mounts: this section is one screen, its steps play in place
  const letGo = () => { if (!root.__moment?.destroy) return false; root.__moment.destroy(); root.__moment = null; return true; };
  if (!letGo()) new MutationObserver((m, o) => { if (letGo()) o.disconnect(); }).observe(root, { attributes: true, attributeFilter: ['data-moment-mounted'] });
  const live = () => root.classList.contains('is-live');

  // layout offset of el inside fig (transforms ignored, so a figure still settling its scale is fine)
  const at = (el, fig, fx = 0.5, fy = 0.5) => {
    let x = 0, y = 0, n = el;
    while (n && n !== fig) { x += n.offsetLeft; y += n.offsetTop; n = n.offsetParent; }
    return [x + el.offsetWidth * fx, y + el.offsetHeight * fy];
  };
  const place = (x, y) => { cx = x; cy = y; cursor.style.transform = `translate(${x}px, ${y}px)`; };
  const final = i => {
    const t = figs[i].querySelector('.tour');
    if (t.innerHTML !== snaps[i]) t.innerHTML = snaps[i];
    figs[i].querySelectorAll('.dat-ring').forEach(r => r.remove());
  };
  const stopAll = () => { R.stop(); clearInterval(timer); cursor.classList.remove('is-on'); figs.forEach((f, i) => final(i)); };

  function stepTo(i, ctx) {
    const fig = figs[i];
    const move = async (x, y, ms) => {
      const from = `translate(${cx}px, ${cy}px)`;
      place(x, y);
      ctx.anim(cursor, [{ transform: from }, { transform: cursor.style.transform }], { duration: ms, easing: 'cubic-bezier(.45, 0, .2, 1)' });
      await ctx.wait(ms);
    };
    const press = async () => {
      ctx.anim(cursor.firstChild, [{ transform: 'scale(1)' }, { transform: 'scale(.82)' }, { transform: 'scale(1)' }], { duration: 220, easing: 'ease-out' });
      const r = document.createElement('span');
      r.className = 'dat-ring'; r.style.left = cx + 'px'; r.style.top = cy + 'px';
      fig.append(r);
      ctx.anim(r, [{ transform: 'scale(.2)', opacity: 0.9 }, { transform: 'scale(1)', opacity: 0 }], { duration: 480, easing: E, fill: 'forwards' }).finished.then(() => r.remove(), () => r.remove());
      await ctx.wait(200);
    };
    const show = () => {
      fig.append(cursor);
      place(fig.clientWidth * 0.84, fig.clientHeight * 0.9);
      cursor.classList.add('is-on');
    };
    const go = (el, fx, fy) => at(el, fig, fx, fy);
    return { fig, move, press, show, go };
  }

  const pick = (ctx, c, cls, word) => {
    c.className = cls; c.textContent = word;
    ctx.anim(c, [{ transform: 'scale(.9)' }, { transform: 'none' }], { duration: 240, easing: E });
  };

  const acts = [
    // 1: pick 19:00, then 20:00, then press Tiếp tục (short: the two hours were just picked in #lich, so only the press)
    async (ctx, s, short) => {
      const cells = [...s.fig.querySelectorAll('.slot--pick')];
      const sum = s.fig.querySelector('.slots__sum > span');
      const btn = s.fig.querySelector('.slots__go');
      s.show();
      if (!short) {
        cells.forEach(c => { c.className = 'slot'; c.textContent = 'Trống'; });
        sum.textContent = 'Chưa chọn giờ';
        await ctx.wait(120);
        await s.move(...s.go(cells[0], 0.55, 0.6), 460);
        await s.press(); pick(ctx, cells[0], 'slot slot--pick', 'Đã chọn'); sum.textContent = 'Sân 1 · 19:00–20:00';
        await s.move(...s.go(cells[1], 0.55, 0.6), 320);
        await s.press(); pick(ctx, cells[1], 'slot slot--pick tour__click', 'Đã chọn'); sum.textContent = 'Sân 1 · 19:00–21:00';
      } else await ctx.wait(260);
      await s.move(...s.go(btn, 0.6, 0.6), 420);
      btn.classList.add('is-hover');
      await ctx.wait(160);
      btn.classList.add('is-press'); await s.press(); btn.classList.remove('is-press');
      await ctx.wait(260);
    },
    // 2: the bill builds row by row, the cursor points at the peak-hour row, the total counts, the deposit bar fills
    async (ctx, s) => {
      const rows = [...s.fig.querySelectorAll('.bill__rows > li')];
      const total = s.fig.querySelector('.bill__total .num');
      const dep = s.fig.querySelector('.bill__dep');
      rows.forEach((li, n) => ctx.anim(li, [{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }], { duration: 300, delay: 60 + n * 100, easing: E, fill: 'backwards' }));
      ctx.anim(dep, [{ clipPath: 'inset(0 100% 0 0 round 14px)' }, { clipPath: 'inset(0 0 0 0 round 14px)' }], { duration: 560, delay: 640, easing: 'cubic-bezier(.65, 0, .35, 1)', fill: 'backwards' });
      total.textContent = '0đ';
      s.show();
      await ctx.wait(160);
      const counting = ctx.wait(200).then(() => ctx.count(total, 0, 316000, 700));
      await s.move(...s.go(rows[0].querySelector('small'), 0.7, 0.5), 500);
      rows[0].classList.add('is-hl');
      await counting;
      total.textContent = '316.000đ';
      await ctx.wait(900);
    },
    // 3: the hold timer runs; the cursor presses the deposit button, which shows a short loading state
    async (ctx, s) => {
      const t = s.fig.querySelector('.pay__timer');
      const btn = s.fig.querySelector('.pay__btn');
      let left = 9 * 60 + 41;
      const tick = () => { left = Math.max(0, left - 1); t.textContent = `Còn ${String(left / 60 | 0).padStart(2, '0')}:${String(left % 60).padStart(2, '0')}`; };
      clearInterval(timer); timer = setInterval(tick, 1000);
      s.show();
      await ctx.wait(240);
      await s.move(...s.go(btn, 0.62, 0.55), 520);
      btn.classList.add('is-hover');
      await ctx.wait(180);
      btn.classList.add('is-press'); await s.press(); btn.classList.remove('is-press', 'is-hover');
      btn.classList.add('is-load');
      btn.innerHTML = '<svg class="dat-spin" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 2a6 6 0 1 0 6 6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>Đang trừ ví';
      await ctx.wait(800);
      btn.classList.remove('is-load'); btn.textContent = 'Đặt cọc 94.800đ';
      await ctx.wait(160);
    },
    // 4: the two picked cells turn into the visitor's booking; the wallet counts down to 405.200đ
    async (ctx) => {
      const fig = figs[3];
      const cells = [...fig.querySelectorAll('.slot--mine')];
      const spent = fig.querySelector('.slots__sum > span');
      const rest = fig.querySelector('.slots__sum > b');
      cells.forEach(c => { c.className = 'slot slot--pick'; c.textContent = 'Đã chọn'; });
      rest.textContent = 'Còn 500.000đ';
      spent.style.opacity = '0';
      await ctx.wait(220);
      for (const c of cells) {
        ctx.anim(c, [{ transform: 'scale(1)' }, { transform: 'scale(.86)' }], { duration: 150, easing: 'ease-in' })
          .finished.then(() => { if (!ctx.live()) return; c.className = 'slot slot--mine'; c.textContent = 'Của bạn'; ctx.anim(c, [{ transform: 'scale(.86)' }, { transform: 'none' }], { duration: 300, easing: E }); }, () => {});
        await ctx.wait(150);
      }
      await ctx.wait(200);
      spent.style.opacity = '';
      ctx.anim(spent, [{ opacity: 0, transform: 'translateY(4px)' }, { opacity: 1, transform: 'none' }], { duration: 300, easing: E });
      await ctx.count(rest, 500000, 405200, 800, n => 'Còn ' + vnd(n));
      rest.textContent = 'Còn 405.200đ';
      await ctx.wait(500);
    },
  ];

  // show step i; with `play` its screen acts the step out once. Resolves true when the act ran to its end
  async function select(i, { play = true, short = false, focus = false } = {}) {
    cur = i;
    btns.forEach((b, n) => { b.setAttribute('aria-selected', String(n === i)); b.tabIndex = n === i ? 0 : -1; b.classList.toggle('is-done', n < i); });
    if (focus) btns[i].focus();
    // the screens stand in a row behind the device's window: the ones before the step to its left, the rest to its right
    figs.forEach((f, n) => { f.classList.toggle('is-on', n === i); f.classList.toggle('is-out', n < i); });
    if (bar) {
      bar.children[0].textContent = `${i + 1} / 4`;
      bar.children[1].textContent = titles[i];
      [...bar.children[2].children].forEach((seg, n) => { seg.className = n < i ? 'is-done' : n === i ? 'is-on' : ''; });
    }
    stopAll();
    if (!play || !visible || SC.reduced()) return false;
    const ctx = R.ctx();
    try { await acts[i](ctx, stepTo(i, ctx), short); cursor.classList.remove('is-on'); return true; } catch (e) { swallow(e); return false; }
  }
  // the steps one after the other, no wait between them; stops when a tab is pressed or the section is left
  async function playAll(from = 0, o = {}) {
    const my = ++seq;
    root.classList.add('is-playing');
    for (let i = from; i < 4; i++) {
      const ok = await select(i, { short: o.short && i === from });
      if (my !== seq) return false;
      if (!ok) break;
    }
    root.classList.remove('is-playing');
    return true;
  }
  const manual = (i, focus) => { seq++; root.classList.remove('is-playing'); settle(); select(i, { focus }); };
  btns.forEach((b, i) => b.addEventListener('click', () => manual(i)));
  tabs.addEventListener('keydown', e => {
    const k = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    const i = k ? (cur + k + 4) % 4 : e.key === 'Home' ? 0 : e.key === 'End' ? 3 : -1;
    if (i < 0) return;
    e.preventDefault();
    manual(i, true);
  });

  /* the intro (full-page mode, first visit): the stage alone in the middle, large; the words wait */
  const centre = () => {
    const w = root.querySelector('.mo-pc__grid').getBoundingClientRect();
    root.style.setProperty('--dat-dx', `${Math.round(w.width / 2 - stage.offsetLeft - stage.offsetWidth / 2)}px`);
    // the device is as tall as its tallest screen, so its frame never changes between steps
    const h = Math.max(...figs.map(f => f.querySelector('.tour')?.offsetHeight || 0));
    if (h) root.style.setProperty('--dat-h', `${h}px`);
  };
  function settle() {
    if (intro === 'done') return;
    intro = 'done';
    root.classList.remove('dat-intro');
    SC.intercept = null;
  }
  function startIntro(o) {
    if (intro !== 'wait') return playAll(0, o);
    intro = 'run';
    // a step (wheel, key, swipe) during the intro ends it: down shows the words and stays, up leaves
    SC.intercept = dir => { if (intro !== 'run') return false; settle(); return dir > 0; };
    return playAll(0, o).then(ok => { if (ok) setTimeout(settle, 350); });
  }

  // one screen: the stage on the left, the heading, the four tabs and the replay control on the right
  function build() {
    root.classList.add('dat-viewer', 'dat-one');
    const frame = stage.querySelector('.mo-pc__visuals');
    figs.forEach(f => frame.append(f));
    if (!bar) {
      // the device's bar: which step, its title, four progress marks, and the replay control in the corner
      bar = document.createElement('div'); bar.className = 'dat-bar';
      bar.innerHTML = '<b aria-hidden="true"></b><span class="dat-bar__t" aria-hidden="true"></span><span class="dat-bar__segs" aria-hidden="true"><i></i><i></i><i></i><i></i></span>';
      const again = document.createElement('button'); again.type = 'button'; again.className = 'dat-again';
      again.setAttribute('aria-label', 'Xem lại cả bốn bước'); again.title = 'Xem lại cả bốn bước';
      again.innerHTML = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M13.2 8A5.2 5.2 0 1 1 11 3.8M11.2 1.6v2.6H8.6" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
      again.addEventListener('click', () => playAll(0));
      bar.append(again);
      frame.prepend(bar);
      const skip = document.createElement('button'); skip.type = 'button'; skip.className = 'dat-skip'; skip.textContent = 'Bỏ qua phần xem trước';
      skip.addEventListener('click', settle);
      stage.append(skip);
      if (html.classList.contains('sc-fp') && !SC.reduced()) { intro = 'wait'; root.classList.add('dat-intro'); }
    }
    list.before(tabs);
    centre();
    select(cur, { play: false });
  }
  let wasLive = null;
  const modeIfChanged = () => { if (live() !== wasLive) { wasLive = live(); if (!wasLive) build(); } };
  new MutationObserver(modeIfChanged).observe(root, { attributes: true, attributeFilter: ['class'] });
  addEventListener('resize', centre);

  // acts run only while the section holds the screen; leaving ends the intro for good
  new IntersectionObserver(es => {
    const v = es[es.length - 1].isIntersecting;
    if (v === visible) return;
    visible = v;
    if (!v) { seq++; root.classList.remove('is-playing'); stopAll(); if (intro === 'run') settle(); }
  }, { rootMargin: '-30% 0px -30% 0px' }).observe(root);
  document.addEventListener('visibilitychange', () => { if (document.hidden) { seq++; stopAll(); } });

  wasLive = live();
  if (!wasLive) build();
  // reached any other way than from #lich: the steps play from the first, in full
  SC.onEnter(root, () => { if (!carried) setTimeout(() => { visible = true; startIntro(); }, 500); });

  /* #lich -> #dat: a frame closes round what the first step is about, the hours 18:00 to 21:00 of Sân 1 to 3 (the
     same twelve cells and four hour heads stand in the device's first screen), and everything outside it fades
     away: the noise is dropped and only the hours on the frame are carried. The framed cells travel, each to its own
     cell in the device, the frame fading as they set off; the device comes up round them and they let go.
     The carried cells are copies laid exactly on the originals, so nothing jumps when the section under them goes. */
  SC.morph['lich>dat'] = async ({ from, enter }) => {
    const app = from.querySelector('.app'), head = from.querySelector('.grid--top');
    const g = from.querySelector('.app__pane--open .slots__grid'), tg = figs[0].querySelector('.tour__grid');
    const dev = stage.querySelector('.mo-pc__visuals');
    if (!app || !g || !tg || !dev) return;
    // #lich's grid has seven columns (label, 17:00 to 22:00), the device's five (label, 18:00 to 21:00)
    const src = [], dst = [];
    for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) { src.push(g.children[r * 7 + 2 + c]); dst.push(tg.children[r * 5 + 1 + c]); }
    if (src.some(x => !x || !x.offsetWidth) || dst.some(x => !x)) return;
    carried = true;
    seq++; visible = true;
    select(0, { play: false });
    const first = intro === 'wait';
    // measure the device's first screen where it will stand, its own slide-in already through
    figs[0].getAnimations().forEach(x => x.finish());
    final(0);
    const R0 = src.map(x => x.getBoundingClientRect()), R1 = dst.map(x => x.getBoundingClientRect());
    const k = R1[4].height / R0[4].height;
    const box = (rs, pad) => {
      const l = Math.min(...rs.map(r => r.left)), t = Math.min(...rs.map(r => r.top)), rr = Math.max(...rs.map(r => r.right)), b = Math.max(...rs.map(r => r.bottom));
      return { left: `${l - pad}px`, top: `${t - pad}px`, width: `${rr - l + 2 * pad}px`, height: `${b - t + 2 * pad}px`, borderRadius: `${12 + pad}px` };
    };
    const layer = document.createElement('div');
    layer.className = 'ui dat-lift';
    layer.setAttribute('aria-hidden', 'true');
    const frame = document.createElement('i');
    frame.className = 'dat-carry';
    layer.append(frame);
    const copies = src.map((x, n) => {
      const c = x.cloneNode(true), r = R0[n];
      Object.assign(c.style, { left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px` });
      layer.append(c);
      return c;
    });
    document.body.append(layer);

    const list = [];
    const a = (el, kf, o) => { if (el) list.push(el.animate(kf, { fill: 'both', easing: E, ...o })); };
    const F0 = 380, OUT = 160, GO = 620, D = 820, LAND = GO + D;
    // the frame closes in round the twelve hours
    a(frame, [{ opacity: 0, ...box(R0, 34) }, { opacity: 1, ...box(R0, 12) }], { duration: F0 + 120 });
    // everything outside it thins out and goes (the copies hold what is inside)
    a(head, [{ opacity: 1, filter: 'blur(0px)' }, { opacity: 0, filter: 'blur(6px)' }], { duration: 520, delay: OUT, easing: 'cubic-bezier(.4, 0, .2, 1)' });
    a(app, [{ opacity: 1, filter: 'blur(0px)' }, { opacity: 0, filter: 'blur(6px)' }], { duration: 520, delay: OUT, easing: 'cubic-bezier(.4, 0, .2, 1)' });
    // the framed hours travel, each to its own cell in the device; the frame goes with them
    a(frame, [box(R0, 12), box(R1, 12 * k)], { duration: D, delay: GO, easing: IO, fill: 'forwards' });
    copies.forEach((c, n) => {
      const r = R0[n], q = R1[n];
      a(c, [
        { left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px`, transform: 'scale(1)' },
        { left: `${q.left}px`, top: `${q.top}px`, width: `${q.width / k}px`, height: `${q.height / k}px`, transform: `scale(${k})` },
      ], { duration: D, delay: GO, easing: IO, fill: 'forwards' });
    });
    // the device comes up round them once they are nearly there, then the copies and the frame let go
    a(dev, [{ opacity: 0, transform: 'scale(.97)' }, { opacity: 1, transform: 'none' }], { duration: 420, delay: LAND - 120 });
    // the frame has done its job once the outside is gone: it fades as the cells set off
    a(frame, [{ opacity: 1 }, { opacity: 0 }], { duration: 480, delay: GO, easing: 'linear', fill: 'forwards' });
    copies.forEach(c => a(c, [{ opacity: 1 }, { opacity: 0 }], { duration: 200, delay: LAND + 320, easing: 'linear', fill: 'forwards' }));
    a(stage.querySelector('.dat-skip'), [{ opacity: 0 }, { opacity: 1 }], { duration: 500, delay: LAND, easing: 'linear' });
    if (!first) a(text, [{ opacity: 0, transform: 'translateX(32px)' }, { opacity: 1, transform: 'none' }], { duration: 800, delay: LAND - 200 });
    enter();
    await new Promise(r => setTimeout(r, LAND + 560));
    list.forEach(x => x.cancel());
    layer.remove();
    carried = false;
    startIntro({ short: true });
  };
}

/* ================================================================ #vi */
const vi = document.getElementById('vi');
if (vi) initVi(vi);

function initVi(root) {
  const tb = root.querySelector('[data-tb]');
  const board = tb?.querySelector('.tb__board'), svg = tb?.querySelector('.tb__lines');
  if (!board || !svg) return;
  const P = {};
  board.querySelectorAll('[data-p]').forEach(p => { P[p.dataset.p] = p; });
  const KEYS = ['kh', 'ht', 'cs'];
  const valEl = k => P[k].querySelector('.tb-p__v');
  const ballA = board.querySelector('.tb-ball:not(.tb-ball--b)'), ballB = board.querySelector('.tb-ball--b');
  const say = tb.querySelector('.tb__say');
  const sw = [...tb.querySelectorAll('.tb-switch button')], stepBtns = [...tb.querySelectorAll('.tb-steps button')];
  const NS = 'http://www.w3.org/2000/svg';
  // the page's example booking: wallet 500.000đ, deposit 30% of 316.000đ; cancelled 24 hours or more ahead, 80% comes back
  const WALLET = 500000, DEP = 94800, BACK = DEP * 0.8, KEEP = DEP - BACK;
  console.assert(BACK === 75840 && KEEP === 18960 && WALLET - DEP === 405200, 'board amounts');
  // balances [khách, hệ thống, chủ sân] after each step
  const BAL = {
    play: [[WALLET, 0, 0], [WALLET - DEP, DEP, 0], [WALLET - DEP, 0, DEP]],
    cancel: [[WALLET, 0, 0], [WALLET - DEP, DEP, 0], [WALLET - DEP + BACK, 0, KEEP]],
  };
  Object.values(BAL).forEach(rows => rows.forEach(r => console.assert(r[0] + r[1] + r[2] === WALLET, 'no money appears or is lost')));
  const SAY = {
    play: ['Trước khi đặt, ví khách có 500.000đ tiền thử.', 'Đặt cọc 30%: 94.800đ rời ví khách và nằm ở ví hệ thống. Khung giờ khóa.', 'Chơi xong, chủ sân xác nhận: ví hệ thống chuyển 94.800đ cho chủ sân.'],
    cancel: ['Trước khi đặt, ví khách có 500.000đ tiền thử.', 'Đặt cọc 30%: 94.800đ rời ví khách và nằm ở ví hệ thống. Khung giờ khóa.', 'Hủy trước 24 giờ: 80% về ví khách, 20% cho chủ sân. Hủy muộn hơn thì hoàn 50% hoặc 0%.'],
  };

  // the passes: forward arcs over the players, the refund on a higher arc back to the customer
  const mk = cls => { const p = document.createElementNS(NS, 'path'); p.setAttribute('class', cls); svg.append(p); return p; };
  const L = { a: mk('tb-line'), b: mk('tb-line'), back: mk('tb-line tb-line--back') };
  let D = {};
  function layout() {
    const W = board.clientWidth, H = board.clientHeight;
    if (!W || !H) return;
    const pt = {};
    KEYS.forEach(k => { const d = P[k].querySelector('.tb-p__disc'); let x = d.offsetWidth / 2, y = 0; for (let n = d; n && n !== board; n = n.offsetParent) { x += n.offsetLeft; y += n.offsetTop; } pt[k] = [Math.round(x), Math.round(y - 12)]; });
    const arc = (p, q, h) => `M${p[0]} ${p[1]}Q${(p[0] + q[0]) / 2} ${Math.min(p[1], q[1]) - h} ${q[0]} ${q[1]}`;
    const h = Math.min(96, pt.kh[1] - 40);
    D = { a: arc(pt.kh, pt.ht, h), b: arc(pt.ht, pt.cs, h), back: arc(pt.ht, pt.kh, Math.min(150, pt.kh[1] - 16)), rest: Object.fromEntries(KEYS.map(k => [k, `M${pt[k][0]} ${pt[k][1]}h0.1`])) };
    L.a.setAttribute('d', D.a); L.b.setAttribute('d', D.b); L.back.setAttribute('d', D.back);
    tb.classList.add('is-laid');
    paint(step, kind);
  }

  const R = runner();
  let kind = 'play', step = 0, shown = [0, 0, 0];
  const put = (ball, d, at = 100) => { ball.style.offsetPath = `path("${d}")`; ball.style.offsetDistance = at + '%'; };
  const setBal = (vals, ctx) => KEYS.forEach((k, i) => {
    const from = shown[i], to = vals[i];
    shown[i] = to;
    if (ctx && from !== to) ctx.count(valEl(k), from, to, 800); else valEl(k).textContent = vnd(to);
    P[k].classList.toggle('is-holding', to > 0 && k === 'ht');
  });
  const mark = () => {
    sw.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.case === kind)));
    stepBtns.forEach((b, i) => { b.setAttribute('aria-current', i === step ? 'step' : 'false'); b.classList.toggle('is-past', i < step); });
    stepBtns[2].lastChild.textContent = kind === 'play' ? 'Chơi xong' : 'Khách hủy';
    say.firstElementChild.textContent = step + 1;
    say.lastElementChild.textContent = SAY[kind][step];
    tb.dataset.kind = kind; tb.dataset.step = step;
    L.a.classList.toggle('is-on', step >= 1); L.b.classList.toggle('is-on', step === 2); L.back.classList.toggle('is-on', step === 2 && kind === 'cancel');
  };
  // the still picture of one step
  function paint(s, kd) {
    step = s; kind = kd;
    if (!D.rest) return mark();
    setBal(BAL[kd][s]);
    const split = s === 2 && kd === 'cancel';
    ballB.hidden = !split;
    ballA.textContent = vnd(split ? BACK : DEP);
    ballB.textContent = vnd(KEEP);
    put(ballA, D.rest[s === 0 ? 'kh' : s === 1 ? 'ht' : kd === 'play' ? 'cs' : 'kh']);
    put(ballB, D.rest.cs);
    mark();
  }
  // the pass into step s, then its balances count
  async function pass(ctx, s) {
    const o = { duration: 1300, easing: IO, fill: 'forwards' };
    const fly = (ball, d) => { ball.style.offsetPath = `path("${d}")`; return ctx.anim(ball, [{ offsetDistance: '0%' }, { offsetDistance: '100%' }], o); };
    step = s; mark();
    ctx.anim(say, [{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }], { duration: 600, easing: E });
    if (s === 0) { paint(0, kind); return; }
    if (s === 2 && kind === 'cancel') {
      ballB.hidden = false; ballA.textContent = vnd(BACK); ballB.textContent = vnd(KEEP);
      fly(ballA, D.back); fly(ballB, D.b);
    } else fly(ballA, s === 1 ? D.a : D.b);
    await ctx.wait(1250);
    setBal(BAL[kind][s], ctx);
    const hit = s === 1 ? ['ht'] : kind === 'play' ? ['cs'] : ['kh', 'cs'];
    hit.forEach(k => { P[k].classList.remove('is-hit'); void P[k].offsetWidth; P[k].classList.add('is-hit'); });
  }
  // one case from the start: each step is held long enough to read its line
  async function play(kd, from = 0) {
    R.stop();
    kind = kd;
    paint(Math.max(0, from - 1), kd);
    if (SC.reduced()) { paint(2, kd); return; }
    const ctx = R.ctx();
    tb.classList.add('is-playing');
    try {
      if (from === 0) { await pass(ctx, 0); await ctx.wait(1900); from = 1; }
      for (let s = from; s <= 2; s++) { await pass(ctx, s); await ctx.wait(s === 2 ? 600 : 3200); }
    } catch (e) { swallow(e); }
    if (ctx.live()) tb.classList.remove('is-playing');
  }
  sw.forEach(b => b.addEventListener('click', () => play(b.dataset.case)));
  stepBtns.forEach((b, i) => b.addEventListener('click', () => { R.stop(); tb.classList.remove('is-playing'); if (i === 0 || SC.reduced()) paint(i, kind); else play(kind, i); }));
  tb.querySelector('.tb-again')?.addEventListener('click', () => play(kind));

  new ResizeObserver(layout).observe(board);
  layout();
  paint(SC.reduced() ? 2 : 0, 'play');
  SC.onEnter(root, () => { if (!SC.reduced()) setTimeout(() => play('play'), 900); });
}
