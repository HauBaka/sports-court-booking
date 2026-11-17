// section motion, part a: the hero window comes up once and its rows settle in, and #lich walks one booking:
// pick a facility, its court grid loads, two hours are picked, the price comes up.
// Every part ends on the markup as written: the animations are cancelled once the build is through.
const SC = window.SC;
const html = document.documentElement;
const E = 'cubic-bezier(0.16, 1, 0.3, 1)';
// a headless shot sees the page at rest, as the kit's own entrance does (motion.js shot())
const calm = () => !SC || SC.reduced() || html.dataset.motion === 'off' || (/HeadlessChrome/.test(navigator.userAgent) && html.dataset.motion !== 'live');
const css = name => getComputedStyle(html).getPropertyValue(name).trim();

const IN = [{ opacity: 0, transform: 'translateY(5px)' }, { opacity: 1, transform: 'none' }];
const FADE = [{ opacity: 0 }, { opacity: 1 }];
const OUT = [{ opacity: 1 }, { opacity: 0 }];

// one build: animations held (fill both) from the frame they are made, cancelled together at the end
function build() {
  const list = [], layers = [];
  const a = (el, kf, delay, dur = 380, o = {}) => {
    if (!el) return null;
    const x = el.animate(kf, { duration: dur, delay: Math.max(0, delay), easing: E, fill: 'both', ...o });
    list.push(x);
    return x;
  };
  // a skeleton bar over el's box (or its text), in host's own (unscaled) coordinates. The layer is filled off the
  // page and mounted once (end()), so measuring the bars costs one layout for the build, not one per bar
  const layer = host => { const l = document.createElement('div'); l.className = 'a-sk-layer'; l.setAttribute('aria-hidden', 'true'); l.host = host; layers.push(l); return l; };
  const bar = (l, el, o = {}) => {
    const host = l.host, hr = host.getBoundingClientRect(), s = hr.width / host.offsetWidth || 1;
    let r = el.getBoundingClientRect();
    if (o.text) { const g = document.createRange(); g.selectNodeContents(el); r = g.getBoundingClientRect(); }
    if (!r.width) return null;
    const w = (o.w || 1) * r.width / s, h = o.h || r.height / s;
    const b = document.createElement('i');
    b.className = o.cls || ('sc-sk' + (o.round ? ' a-round' : ''));
    Object.assign(b.style, {
      left: (r.left - hr.left) / s - host.clientLeft + 'px',
      top: (r.top - hr.top) / s - host.clientTop + (r.height / s - h) / 2 + 'px',
      width: w + 'px', height: h + 'px',
    });
    l.append(b);
    return b;
  };
  // a step on the same clock as the animations (a timer drifts from them when the first frames are slow)
  const at = (ms, fn) => document.body.animate([{}, {}], { duration: Math.max(0, ms) }).finished.then(fn, () => {});
  const end = (ms, fn) => { layers.forEach(l => l.host.append(l)); return at(ms, () => { list.forEach(x => x.cancel()); layers.forEach(l => l.remove()); fn && fn(); }); };
  return { a, layer, bar, at, end };
}

/* ---------------------------------------------------------------- hero */
function hero() {
  const sec = document.querySelector('main > .hero');
  if (!sec) return;
  const art = sec.querySelector('.hero__art');
  const win = art && art.querySelector('.ly-piece--main');
  const note = art && art.querySelector('.ly-piece--note');
  const free = () => sec.classList.add('a-free', 'a-k0', 'a-k1', 'a-k2');
  if (!win || calm() || !html.classList.contains('m-enter')) return free();
  sec.classList.add('a-hold');
  const rule = (k, ms, at) => (at || ((t, fn) => setTimeout(fn, t)))(ms, () => sec.classList.add('a-k' + k));

  const run = linked => {
    const b = build();
    const { a } = b;
    const accent = css('--p-accent') || '#1f6b3a';

    // the window rises once, with everything in it; nothing in it is shown twice
    a(win, [{ opacity: 0, transform: 'translateY(22px) scale(.985)' }, { opacity: 1, transform: 'none' }], 0, 800);

    // the side nav settles top to bottom; the three sports take their rule in the heading as they land
    const side = [...win.querySelectorAll('.ui-win__side > *')];
    let t = 260, k = 0, labels = 0;
    side.forEach(el => {
      const label = el.classList.contains('ui-win__label');
      if (label) labels++;
      a(el, IN, t, 420);
      if (!label && !labels && k < 3) {
        if (!el.classList.contains('is-on')) a(el, [{ color: accent, offset: 0 }, { color: accent, offset: 0.35 }], t, 900, { fill: 'backwards' });
        if (linked) rule(k, t, b.at);
        k++;
      }
      t += label ? 40 : 110;
    });
    // the rows, each as one piece
    [...win.querySelectorAll('.ui-win__row')].forEach((row, i) => a(row, IN, 380 + i * 60, 460));

    // the note lands over the corner: three lines tick, then the slot locks
    const n = 900;
    if (note && note.offsetWidth) {
      a(note, [{ opacity: 0, transform: 'translate(-10px, 22px)' }, { opacity: 1, transform: 'none' }], n, 600);
      note.querySelectorAll('.note__line').forEach((line, i) => {
        const d = n + 260 + i * 110;
        const dot = line.querySelector('i'), path = line.querySelector('path'), txt = line.querySelector('span');
        a(dot, [{ opacity: 0, transform: 'scale(.4)' }, { opacity: 1, transform: 'none' }], d, 280);
        if (path && path.getTotalLength) {
          const len = Math.ceil(path.getTotalLength());
          path.style.strokeDasharray = len;
          a(path, [{ strokeDashoffset: len }, { strokeDashoffset: 0 }], d + 90, 260);
        }
        a(txt, IN, d + 60, 340);
      });
      a(note.querySelector('.note__chip'), [{ opacity: 0, transform: 'translateY(-8px) scale(1.08)' }, { opacity: 1, transform: 'none' }], n + 260 + 330 + 40, 380);
    }

    sec.classList.add('a-go');
    b.end(2200, () => { note && note.querySelectorAll('path').forEach(p => (p.style.strokeDasharray = '')); free(); });
  };

  // start with the kit's entrance (it waits up to 250ms for the fonts), and only once the window is on screen
  const start = () => {
    const r = art.getBoundingClientRect();
    if (r.top < innerHeight * 0.8 && r.bottom > 0) return run(true);
    // the window is below the fold (a phone): the heading draws its rules on its own, the window builds when reached
    [0, 1, 2].forEach(k => rule(k, 260 + k * 110));
    const io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) { io.disconnect(); run(false); } }, { threshold: 0.3 });
    io.observe(art);
  };
  if (sec.matches('.is-entering, .is-entered')) return start();
  let go = false;
  const once = () => { if (go) return; go = true; mo.disconnect(); start(); };
  const mo = new MutationObserver(() => { if (sec.matches('.is-entering, .is-entered')) once(); });
  mo.observe(sec, { attributes: true, attributeFilter: ['class'] });
  setTimeout(once, 400);
}

/* ---------------------------------------------------------------- #lich */
function lich() {
  const sec = document.getElementById('lich');
  const app = sec && sec.querySelector('.app');
  if (!app) return;
  if (calm()) return sec.classList.add('a-free');
  sec.classList.add('a-hold');

  SC.onEnter(sec, () => {
    const b = build();
    const { a, bar, at } = b;
    const pList = app.querySelector('.app__pane--list'), pOpen = app.querySelector('.app__pane--open');
    // carried over from the hero (carry() below), the list is already on show: only the grid loads, as the window opens on it
    const carried = sec.dataset.from === 'hero';
    const listOn = getComputedStyle(pList).display !== 'none' && !carried;
    // phones hide the list: the grid starts at once
    const o = carried ? -260 : listOn ? 0 : -560;

    // 1. the list loads: side nav, then the facilities top to bottom; then Thành Công is picked
    if (listOn) {
      const sk = b.layer(pList);
      [...pList.querySelectorAll('.ui-win__side > *')].forEach((el, i) => {
        const sb = bar(sk, el, { w: el.classList.contains('ui-win__label') ? 0.4 : 0.6, h: 9 });
        a(el, IN, 60 + i * 30, 300);
        a(sb, OUT, 60 + i * 30, 180);
      });
      const cols = pList.querySelector('.ui-win__cols');
      if (cols && cols.offsetWidth) a(cols, FADE, 60, 300);
      pList.querySelectorAll('.ui-win__row').forEach((row, i) => {
        const r = 100 + i * 35;
        const parts = [...row.children];
        parts.forEach(el => {
          const chip = el.matches('.ui-win__st, .ui-win__age');
          const sb = bar(sk, el, el.classList.contains('ui-avatar') ? { round: true } : chip ? { h: el.classList.contains('ui-win__st') ? 20 : 9 } : { text: true, h: el.classList.contains('ui-win__who') ? 10 : 8, w: el.classList.contains('ui-win__sub') ? 0.75 : 1 });
          a(el, IN, chip ? r + 110 : r, 320);
          a(sb, OUT, chip ? r + 110 : r, 180);
        });
        if (row.classList.contains('is-sel')) {
          // the cause: the facility is picked, with a press
          a(row, [{ backgroundColor: 'transparent', offset: 0 }, { backgroundColor: 'transparent', offset: 0.65 }], 0, 740, { fill: 'backwards', easing: 'linear' });
          a(row, [{ transform: 'none' }, { transform: 'scale(.985)', offset: 0.35 }, { transform: 'none' }], 480, 280);
          a(row.querySelector('.ui-win__who'), [{ color: css('--p-accent'), offset: 0.2 }], 480, 600, { fill: 'none' });
        }
      });
    }

    // 2. the effect: that facility's grid loads
    const sk = b.layer(pOpen);
    const name = pOpen.querySelector('.slots__name'), meta = pOpen.querySelector('.slots__meta');
    const nb = bar(sk, name, { text: true, h: 12 }), mb = bar(sk, meta, { text: true, h: 9 });
    a(name, IN, o + 600); a(nb, OUT, o + 600, 180);
    a(meta, IN, o + 660); a(mb, OUT, o + 660, 180);

    // the day tabs, and the underline slides over to T5 19/11
    const days = [...pOpen.querySelectorAll('.slots__day')].filter(d => d.offsetWidth);
    const on = pOpen.querySelector('.slots__day.is-on');
    days.forEach((d, i) => a(d, FADE, o + 680 + i * 30, 300));
    if (on && days[0] && days[0] !== on) {
      const tab = bar(sk, on, { cls: 'a-tab', h: 2 });
      const r0 = days[0].getBoundingClientRect(), r1 = on.getBoundingClientRect();
      // from the middle of the tab's box down to where its own underline sits
      tab.style.top = parseFloat(tab.style.top) + r1.height / 2 - 1 + 'px';
      const slide = 760, dur = 440;
      a(tab, [{ opacity: 0, transform: `translateX(${r0.left - r1.left}px) scaleX(${r0.width / r1.width})` }, { opacity: 1, transform: `translateX(${r0.left - r1.left}px) scaleX(${r0.width / r1.width})`, offset: 0.25 }, { opacity: 1, transform: 'none' }], o + slide - 120, dur + 120);
      a(on, [{ borderBottomColor: 'transparent', color: css('--u-muted') || 'gray' }, { borderBottomColor: 'transparent', color: css('--u-muted') || 'gray' }], 0, Math.max(1, o + slide + dur), { fill: 'none' });
    }

    // the hours left to right, the courts top to bottom, then the cells in one diagonal wave
    const grid = pOpen.querySelector('.slots__grid');
    const cells = [...grid.children];
    pOpen.querySelectorAll('.slots__h').forEach((h, i) => a(h, IN, o + 740 + i * 35, 320));
    pOpen.querySelectorAll('.slots__c').forEach((c, i) => a(c, [{ opacity: 0, transform: 'translateX(-5px)' }, { opacity: 1, transform: 'none' }], o + 780 + i * 45, 320));
    const picks = [];
    cells.filter(c => c.classList.contains('slot')).forEach(c => {
      const i = cells.indexOf(c), r = Math.floor(i / 7) - 1, col = (i % 7) - 1;
      const d = o + 840 + (r + col) * 35;
      const sb = bar(sk, c, {});
      if (!sb) return;
      a(sb, OUT, d, 200);
      if (c.classList.contains('slot--taken')) a(c, [{ opacity: 0, clipPath: 'inset(45% 45% round 8px)' }, { opacity: 1, clipPath: 'inset(0 0 0 0 round 8px)' }], d, 380);
      else if (c.classList.contains('slot--held')) a(c, [{ opacity: 0, clipPath: 'inset(0 100% 0 0 round 8px)' }, { opacity: 1, clipPath: 'inset(0 0 0 0 round 8px)' }], d, 460);
      else a(c, [{ opacity: 0, transform: 'scale(.94)' }, { opacity: 1, transform: 'none' }], d, 300);
      if (c.classList.contains('slot--pick')) picks.push(c);
    });

    // 3. two hours on Sân 1 are picked, as if clicked
    picks.forEach((c, i) => {
      const word = c.textContent;
      c.classList.add('a-unpick');
      c.textContent = 'Trống';
      const t = o + 1180 + i * 150;
      a(c, [{ transform: 'none' }, { transform: 'scale(.9)', offset: 0.35 }, { transform: 'none' }], t, 280, { fill: 'none', composite: 'replace' });
      at(Math.max(0, t + 90), () => { c.classList.remove('a-unpick'); c.textContent = word; });
    });

    // 4. the sum comes up and its price counts to the total; the legend last
    const sum = pOpen.querySelector('.slots__sum'), price = sum && sum.querySelector('b');
    a(sum, [{ opacity: 0, transform: 'translateY(14px)' }, { opacity: 1, transform: 'none' }], o + 1440, 420);
    if (price) {
      const text = price.textContent, total = parseInt(text.replace(/\D/g, ''), 10);
      const t0 = o + 1480, dur = 460;
      at(Math.max(0, t0), () => {
        const s = performance.now();
        const tick = now => {
          const p = Math.max(0, Math.min(1, (now - s) / dur)), v = Math.round(total * (1 - Math.pow(1 - p, 3)) / 1000) * 1000;
          price.textContent = p < 1 ? v.toLocaleString('vi-VN') + 'đ' : text;
          if (p < 1) requestAnimationFrame(tick);
        };
        price.textContent = '0đ';
        requestAnimationFrame(tick);
      });
    }
    a(pOpen.querySelector('.slots__legend'), FADE, o + 1640, 280);

    b.end(o + 2200, () => sec.classList.add('a-free'));
  });
}

/* ---------------------------------------------------------------- hero <-> #lich: the window grows into the app
   The hero's window and the app's list pane are the same screen at the same size. Going down, the app is laid
   over the window (moved there, cut to the window's outline) and shown at once, whole and on top, so the screen
   never thins out; it then opens out to its own place while the hero's words leave and the ground runs to #lich's;
   #lich's words come last. A cut element has no shadow, so a plain card under it (.a-halo) carries the frame's
   corner and shadow along the same path. Going up is the same, backwards. Both are live DOM: no text is scaled. */
function carry() {
  const heroSec = document.querySelector('main > .hero'), sec = document.getElementById('lich');
  const art = heroSec && heroSec.querySelector('.hero__art'), win = art && art.querySelector('.ly-piece--main'), note = art && art.querySelector('.ly-piece--note');
  const app = sec && sec.querySelector('.app'), head = sec && sec.querySelector('.grid--top');
  const text = heroSec && heroSec.querySelector('.hero__text');
  if (!win || !app || !head || !text || !SC || calm()) return;
  const IO = 'cubic-bezier(.6, 0, .16, 1)', OPEN = 'inset(0 0 0 0 round 20px)';
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const frame = () => [art.querySelector('canvas'), art.querySelector('.loop-pause')].filter(Boolean);
  // the app laid over the window: moved so its list pane lies on it, cut to the part of the window on show
  const geo = () => {
    const w = win.getBoundingClientRect(), f = art.getBoundingClientRect(), p = app.getBoundingClientRect();
    // the first row's avatar is the same mark in both: lay one on the other
    const k1 = win.querySelector('.ui-win__row .ui-avatar')?.getBoundingClientRect(), k2 = app.querySelector('.ui-win__row .ui-avatar')?.getBoundingClientRect();
    const dx = k1?.width && k2?.width ? k1.left - k2.left : w.left - p.left, dy = k1?.width && k2?.width ? k1.top - k2.top : w.top - p.top;
    const l = Math.max(0, w.left - p.left - dx), t = Math.max(0, w.top - p.top - dy);
    const r = Math.max(0, p.right + dx - Math.min(w.right, f.right)), b = Math.max(0, p.bottom + dy - Math.min(w.bottom, f.bottom));
    return {
      at: `translate(${dx}px, ${dy}px)`, cut: `inset(${t}px ${r}px ${b}px ${l}px round 20px)`,
      // the same cut as a move and a stretch of the app's whole box (for the halo)
      box: `translate(${dx + l}px, ${dy + t}px) scale(${(p.width - l - r) / p.width}, ${(p.height - t - b) / p.height})`,
    };
  };
  const halo = () => {
    const h = document.createElement('i'), cs = getComputedStyle(app);
    h.className = 'a-halo';
    h.setAttribute('aria-hidden', 'true');
    Object.assign(h.style, { left: app.offsetLeft + 'px', top: app.offsetTop + 'px', width: app.offsetWidth + 'px', height: app.offsetHeight + 'px', borderRadius: cs.borderRadius, boxShadow: cs.boxShadow });
    app.after(h);
    return h;
  };

  SC.morph['top>lich'] = async ({ enter }) => {
    const g = geo(), bg = getComputedStyle(art).backgroundColor, list = [], h = halo();
    const a = (el, kf, o) => { if (el) list.push(el.animate(kf, { fill: 'both', easing: E, ...o })); return list[list.length - 1]; };
    const D = 1150;
    sec.dataset.from = 'hero';
    // #lich goes over the hero it is leaving: its app covers the window from the first frame
    sec.classList.add('a-over');
    a(win, [{ opacity: 1 }, { opacity: 0 }], { duration: 1, delay: 140, easing: 'linear' });
    a(text, [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateX(-40px)' }], { duration: 400, easing: 'cubic-bezier(.5, 0, .75, 0)' });
    a(note, [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(16px) scale(.97)' }], { duration: 300 });
    a(art, [{ backgroundColor: bg }, { backgroundColor: 'transparent' }], { duration: 520 });
    frame().forEach(el => a(el, [{ opacity: 1 }, { opacity: 0 }], { duration: 420 }));
    a(app, [{ opacity: 0 }, { opacity: 1 }], { duration: 120, easing: 'linear' });
    a(h, [{ opacity: 0 }, { opacity: 1 }], { duration: 120, easing: 'linear' });
    a(h, [{ transform: g.box }, { transform: 'translate(0px, 0px) scale(1, 1)' }], { duration: D, delay: 120, easing: IO });
    const travel = a(app, [{ transform: g.at, clipPath: g.cut }, { transform: 'none', clipPath: OPEN }], { duration: D, delay: 120, easing: IO });
    a(head, [{ opacity: 0, transform: 'translateY(18px)' }, { opacity: 1, transform: 'none' }], { duration: 700, delay: 820 });
    enter();
    await travel.finished.catch(() => {});
    // the app's own corner and shadow are where the halo's are: one takes over from the other unseen
    travel.cancel();
    h.remove();
    await sleep(300);
    list.forEach(x => x.cancel());
    sec.classList.remove('a-over');
    delete sec.dataset.from;
  };

  SC.morph['lich>top'] = async ({ enter }) => {
    const g = geo(), bg = getComputedStyle(art).backgroundColor, list = [], h = halo();
    const a = (el, kf, o) => { if (el) list.push(el.animate(kf, { fill: 'both', easing: E, ...o })); return list[list.length - 1]; };
    const D = 950;
    a(head, [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(18px)' }], { duration: 280, easing: 'cubic-bezier(.5, 0, .75, 0)' });
    a(h, [{ transform: 'translate(0px, 0px) scale(1, 1)' }, { transform: g.box }], { duration: D, easing: IO });
    const travel = a(app, [{ transform: 'none', clipPath: OPEN }, { transform: g.at, clipPath: g.cut }], { duration: D, easing: IO });
    // the window is whole under the app before the app goes: nothing is ever half there
    a(win, [{ opacity: 0 }, { opacity: 1 }], { duration: 1, delay: D - 60, easing: 'linear' });
    a(app, [{ opacity: 1 }, { opacity: 0 }], { duration: 160, delay: D, easing: 'linear' });
    a(h, [{ opacity: 1 }, { opacity: 0 }], { duration: 160, delay: D, easing: 'linear' });
    a(art, [{ backgroundColor: 'transparent' }, { backgroundColor: bg }], { duration: 560, delay: 480 });
    frame().forEach(el => a(el, [{ opacity: 0 }, { opacity: 1 }], { duration: 500, delay: 560 }));
    a(text, [{ opacity: 0, transform: 'translateX(-40px)' }, { opacity: 1, transform: 'none' }], { duration: 760, delay: 480 });
    a(note, [{ opacity: 0, transform: 'translateY(16px) scale(.97)' }, { opacity: 1, transform: 'none' }], { duration: 560, delay: 900 });
    await sleep(520);
    enter();
    await travel.finished.catch(() => {});
    await sleep(560);
    list.forEach(x => x.cancel());
    h.remove();
  };
}

hero();
lich();
carry();
