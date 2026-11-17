/*
  SCB page motion, shared layer.
  - Marks each section .is-in the first time it takes the screen (the one-time builds in a/b/c/d key on it)
    and .is-active while it is the section on screen.
  - Full-page mode (from 1024px wide and 640px tall, no reduced motion): one wheel, swipe or key press moves one
    section. There is no visible scroll and no edge between sections: the section left is held in place and let go
    (its content fades and drifts off), the page jumps under it, the next section's content comes in, and the ground
    behind both (ground.js: one drawing sheet, one colour) travels to the next section's region.
    Two neighbours carry a screen across instead (SC.morph, set by a.js and b.js): the hero's window grows into the
    #lich app, the #lich court grid grows into the #dat stage.
  - window.SC for the section files:
      SC.onEnter(el, fn)  run fn(el) once when el (a section or footer) first takes the screen; at once if it already has
      SC.reduced()        true under prefers-reduced-motion
      SC.wait(ms)         promise timer, resolves at once under reduced motion
      SC.visible(el, fn)  fn(true|false) as el enters and leaves the screen (stop loops when false)
      SC.morph[key]       'top>lich': async ({ from, next, dir, enter }) => {}  a carried transition between two neighbours
      SC.intercept        (dir) => true when a section uses the step itself (b.js: a step ends the #dat intro)
      SC.go(dir), SC.to(el)
*/
import { mountGround } from './ground.js';

const html = document.documentElement;
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const calm = () => reduced() || html.dataset.motion === 'off';
// full-page mode answers a person: it waits for a real wheel, key, touch or pointer before it takes over the scroll
let human = false;
['wheel', 'keydown', 'touchstart', 'pointerdown'].forEach(t => addEventListener(t, e => { if (e.isTrusted) human = true; }, { capture: true, passive: true }));
const waiters = new Map();
const sleep = ms => new Promise(r => setTimeout(r, ms));

function enter(el) {
  if (el.classList.contains('is-in')) return;
  el.classList.add('is-in');
  (waiters.get(el) || []).forEach(fn => fn(el));
  waiters.delete(el);
  el.dispatchEvent(new CustomEvent('sc:enter'));
}

const SC = window.SC = {
  reduced,
  wait: ms => new Promise(r => setTimeout(r, reduced() ? 0 : ms)),
  onEnter(el, fn) {
    if (!el) return;
    if (el.classList.contains('is-in')) fn(el);
    else (waiters.get(el) || waiters.set(el, []).get(el)).push(fn);
  },
  visible(el, fn) {
    if (!el) return;
    new IntersectionObserver(es => es.forEach(e => fn(e.isIntersecting))).observe(el);
  },
  morph: {},
  intercept: null,
};

function split(h) {
  if (h.classList.contains('sc-split')) return;
  let i = 0;
  const walk = node => {
    [...node.childNodes].forEach(n => {
      if (n.nodeType === 3) {
        const parts = n.textContent.split(/(\s+)/);
        const frag = document.createDocumentFragment();
        parts.forEach(p => {
          if (!p) return;
          if (/^\s+$/.test(p)) { frag.append(p); return; }
          const w = document.createElement('span'); w.className = 'sc-w';
          const wi = document.createElement('span'); wi.className = 'sc-wi'; wi.style.setProperty('--i', i++); wi.textContent = p;
          w.append(wi); frag.append(w);
        });
        n.replaceWith(frag);
      } else if (n.nodeType === 1) walk(n);
    });
  };
  // the words stay readable as one heading to assistive tech
  h.setAttribute('aria-label', h.textContent.trim());
  walk(h);
  h.classList.add('sc-split');
}

const hero = document.querySelector('main > .hero');
const sections = [...document.querySelectorAll('main > .section, footer.closing')];
const all = [hero, ...sections].filter(Boolean);
const key = s => s.id || 'top';
const isDark = s => !!s?.matches('.ground-inverse, .sc-dark');
sections.forEach(s => {
  const h = s.querySelector('h2');
  if (h) split(h);
  const lead = s.querySelector('.grid--top > p, .section-head > p, .section-head--split .t-lead');
  if (lead) lead.classList.add('sc-lead');
});

/* ---------------------------------------------------------------- first-visit builds
   Each block settles in from its own side the first time its section takes the screen:
   l / r from the left or right, dl / dr diagonally up from the lower left or right, u from below. */
const K = {
  lich: [['.grid--top > h2', 'l'], ['.grid--top > p', 'r']],
  vi: [['.grid--top > h2', 'l'], ['.grid--top > p', 'r'], ['.tb', 'u']],
  mon: [['.grid--top > h2', 'l'], ['.grid--top > p', 'r']],
  coc: [['.section-head', 'l'], ['.tiers > li', 'l'], ['.coc-calc', 'u'], ['.cx', 'dr']],
  'chu-san': [['.section-head', 'l'], ['.cs', 'u']],
  'hoi-dap': [['.grid--top > .span-5 > :not(.fq)', 'l'], ['.fq', 'dl'], ['.faq > details', 'r']],
  contact: [['.section-head--split', 'l'], ['.closing__links', 'u']],
};
const kinetic = !calm();
if (kinetic) {
  for (const id in K) {
    const s = document.getElementById(id);
    if (!s) continue;
    s.classList.add('sc-k-host');
    K[id].forEach(([sel, dir]) => s.querySelectorAll(sel).forEach((el, i) => { el.dataset.kin = dir; el.style.setProperty('--k', i); }));
  }
}
html.classList.add('sc-ready');
if (kinetic) html.classList.add('sc-kin');

/* ---------------------------------------------------------------- the rail: a segment per section, the one on show named */
const NAMES = { top: 'Mở đầu', lich: 'Lịch trống', dat: 'Bốn bước đặt sân', vi: 'Ví hệ thống', mon: 'Ba môn', coc: 'Hoàn cọc', 'chu-san': 'Người chơi và chủ sân', 'hoi-dap': 'Câu hỏi', contact: 'Tìm sân' };
const two = n => String(n).padStart(2, '0');
const rail = (() => {
  const nav = document.createElement('nav');
  nav.className = 'sc-rail';
  nav.setAttribute('aria-label', 'Các phần của trang');
  const now = document.createElement('p');
  now.className = 'sc-rail__now';
  now.setAttribute('aria-hidden', 'true');
  now.innerHTML = `<b>01</b><i>/ ${two(all.length)}</i><span></span>`;
  const segs = document.createElement('div');
  segs.className = 'sc-rail__segs';
  const links = all.map(s => {
    const a = document.createElement('a');
    a.className = 'sc-rail__seg';
    a.href = '#' + key(s);
    a.setAttribute('aria-label', NAMES[key(s)] || key(s));
    a.innerHTML = `<span class="sc-rail__t" aria-hidden="true">${NAMES[key(s)] || key(s)}</span>`;
    segs.append(a);
    return a;
  });
  nav.append(now, segs);
  document.body.append(nav);
  let shown = -1;
  return {
    set(i) {
      if (i === shown) return;
      shown = i;
      links.forEach((d, j) => { d.classList.toggle('is-on', j === i); d.classList.toggle('is-past', j < i); if (j === i) d.setAttribute('aria-current', 'true'); else d.removeAttribute('aria-current'); });
      now.firstChild.textContent = two(i + 1);
      const name = now.lastChild;
      name.textContent = NAMES[key(all[i])] || '';
      if (!calm()) name.animate([{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }], { duration: 500, easing: 'cubic-bezier(.16,1,.3,1)' });
      html.dataset.scDark = isDark(all[i]) ? '1' : '0';
    },
  };
})();

/* ---------------------------------------------------------------- which section is on show */
const wideQ = matchMedia('(min-width: 1024px) and (min-height: 640px)');
const fpMode = () => wideQ.matches && !calm();
const fp = () => fpMode() && human;
const ground = mountGround(all.map(key));
const sync = () => html.classList.toggle('sc-fp', fpMode());
sync();
wideQ.addEventListener('change', () => { sync(); if (fpMode()) jump(all[idx]); });

let idx = 0, active = null, busy = false, lastEnd = 0;
function activate(s) {
  if (s === active) return;
  active?.classList.remove('is-active');
  active = s;
  if (!s) return;
  s.classList.add('is-active');
  enter(s);
  rail.set(all.indexOf(s));
}
// layout positions (offsetTop, not rects), so a transform never moves a stop
const pageY = el => { let y = 0; for (let n = el; n; n = n.offsetParent) y += n.offsetTop; return y; };
const holder = y => all.find(s => { const t = pageY(s) - y; return t <= innerHeight / 2 && t + s.offsetHeight > innerHeight / 2; });
const jump = s => scrollTo({ top: Math.round(pageY(s)), behavior: 'instant' });
SC.pageY = pageY;

// a scroll the page did not make (a scrollbar drag, Tab to a far link, an anchor on load): follow it, no travel
let rq = 0;
const track = () => {
  if (rq) return;
  rq = requestAnimationFrame(() => {
    rq = 0;
    if (busy) return;
    const s = holder(scrollY) || all[0], i = all.indexOf(s);
    if (i !== idx || s !== active) { idx = i; ground.aim(i, true); activate(s); }
  });
};
addEventListener('scroll', track, { passive: true });
addEventListener('resize', track);

/* ---------------------------------------------------------------- one step, one section */
const LEAVE = 420, ENTER = 880;
const carriedPairs = new Set();
async function to(i) {
  i = Math.max(0, Math.min(all.length - 1, i));
  if (busy || i === idx) return;
  const from = all[idx], next = all[i], dir = i > idx ? 1 : -1;
  if (!fp()) { next.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'start' }); return; }
  busy = true;
  html.dataset.scDir = dir > 0 ? 'down' : 'up';
  html.classList.add('sc-busy');
  // into or out of a dark section the night sheet travels (ground.js): the words coming in wait for it
  const night = isDark(from) !== isDark(next);
  if (night) html.dataset.scNight = '1';
  // a carried transition plays once per page load for each pair of neighbours (either way); later passes are plain cuts
  const pair = [key(from), key(next)].sort().join('|');
  const morph = Math.abs(i - idx) === 1 && !carriedPairs.has(pair) ? SC.morph[`${key(from)}>${key(next)}`] : null;
  if (morph) carriedPairs.add(pair);
  idx = i;
  ground.aim(i);
  rail.set(i);
  // the section left stays where it is on the screen (fixed) while the page jumps to the next one under it
  from.style.setProperty('--pin-top', `${Math.round(pageY(from) - scrollY)}px`);
  from.classList.add('is-pinned');
  jump(next);
  try {
    if (morph) await morph({ from, next, dir, enter: () => activate(next) });
    else {
      from.classList.add('is-leaving');
      next.classList.add('is-entering');
      await sleep(200);
      activate(next);
      await sleep(ENTER - 200 + (night ? 260 : 0));
    }
  } finally {
    delete html.dataset.scNight;
    from.classList.remove('is-leaving', 'is-pinned');
    next.classList.remove('is-entering');
    html.classList.remove('sc-busy');
    jump(next);
    activate(next);
    busy = false;
    lastEnd = performance.now();
  }
}
function go(dir) {
  if (busy) return;
  if (SC.intercept?.(dir)) return;
  // a section taller than the screen (a narrow laptop) scrolls to its own end first
  const s = all[idx], top = pageY(s), bottom = top + s.offsetHeight, y = scrollY, vh = innerHeight;
  if (dir > 0 && bottom > y + vh + 8) { scrollTo({ top: Math.min(bottom - vh, y + vh * 0.85), behavior: 'smooth' }); return; }
  if (dir < 0 && y > top + 8) { scrollTo({ top: Math.max(top, y - vh * 0.85), behavior: 'smooth' }); return; }
  to(idx + dir);
}
SC.go = go;
SC.to = el => to(all.indexOf(all.find(x => x === el || x.contains(el)) || el));
SC.busy = () => busy;
console.assert(LEAVE < ENTER, 'a section leaves before the next has settled');

// a target that can scroll on its own in that direction keeps the wheel
const ownScroll = (el, dy) => {
  for (; el && el !== document.body; el = el.parentElement) {
    const cs = getComputedStyle(el);
    if (/(auto|scroll)/.test(cs.overflowY) && el.scrollHeight > el.clientHeight + 1) {
      if (dy > 0 ? el.scrollTop + el.clientHeight < el.scrollHeight - 1 : el.scrollTop > 0) return true;
    }
  }
  return false;
};

// one gesture, one section: the tail of a trackpad fling (events under 160 ms apart) is swallowed
let lastWheel = 0, quiet = false;
addEventListener('wheel', e => {
  if (!fp() || e.ctrlKey || ownScroll(e.target, e.deltaY)) return;
  e.preventDefault();
  const now = performance.now(), gap = now - lastWheel;
  lastWheel = now;
  if (busy) { quiet = true; return; }
  if (quiet && gap < 160) return;
  quiet = false;
  const d = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
  if (Math.abs(d) < 4) return;
  quiet = true;
  go(Math.sign(d));
}, { passive: false });

let touchY = null;
addEventListener('touchstart', e => { touchY = fp() && e.touches.length === 1 && !ownScroll(e.target, 1) && !ownScroll(e.target, -1) ? e.touches[0].clientY : null; }, { passive: true });
addEventListener('touchmove', e => { if (touchY !== null) e.preventDefault(); }, { passive: false });
addEventListener('touchend', e => {
  if (touchY === null) return;
  const dy = touchY - e.changedTouches[0].clientY;
  touchY = null;
  if (Math.abs(dy) > 40 && !busy) go(Math.sign(dy));
});

const typing = el => el && (el.isContentEditable || /^(input|textarea|select)$/i.test(el.tagName));
addEventListener('keydown', e => {
  if (!fp() || e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || typing(e.target)) return;
  const k = e.key;
  let dir = 0;
  if (k === 'PageDown' || k === 'ArrowDown' || (k === ' ' && !e.shiftKey)) dir = 1;
  else if (k === 'PageUp' || k === 'ArrowUp' || (k === ' ' && e.shiftKey)) dir = -1;
  else if (k === 'Home') { e.preventDefault(); to(0); return; }
  else if (k === 'End') { e.preventDefault(); to(all.length - 1); return; }
  // space on a button or summary presses it; arrows inside a tab list or a slider belong to it
  if (!dir || (k === ' ' && e.target.closest?.('button, summary, a, [role="button"]')) || e.target.closest?.('[role="tablist"], [role="radiogroup"]')) return;
  e.preventDefault();
  go(dir);
});

// in-page links and the rail go the same way
document.addEventListener('click', e => {
  const a = e.target.closest?.('a[href^="#"]');
  if (!a || !fp() || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;
  const id = a.getAttribute('href').slice(1);
  const t = id === 'top' || id === '' ? all[0] : document.getElementById(id);
  if (!t) return;
  const s = all.find(x => x === t || x.contains(t));
  if (!s) return;
  e.preventDefault();
  to(all.indexOf(s));
  history.replaceState(null, '', '#' + id);
});

// a native scroll that ends between two sections (a scrollbar drag) settles on the one holding the screen
let settle = 0;
addEventListener('scroll', () => {
  if (!fp() || busy) return;
  clearTimeout(settle);
  settle = setTimeout(() => {
    if (busy || performance.now() - lastEnd < 250) return;
    const s = all[idx], top = pageY(s);
    if (s.offsetHeight <= innerHeight + 8 && Math.abs(top - scrollY) > 2) scrollTo({ top, behavior: 'smooth' });
  }, 240);
}, { passive: true });

idx = Math.max(0, all.indexOf(holder(scrollY) || all[0]));
ground.aim(idx, true);
activate(all[idx]);
if (hero) enter(hero);
