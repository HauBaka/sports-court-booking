// section motion, part d:
//   #chu-san  one booking seen from both sides: two screens joined by a line. Four steps; in each, one side acts,
//             a dot crosses the line, the other side shows it. One short sentence says who did what.
//   #hoi-dap  one answer open at a time; the stage beside the list acts the open answer out.
//   footer    the name set across the screen as an outline; a ball bounces along it, fills it in and lands as
//             its full stop.
const SC = window.SC;
const R = SC.reduced();
document.documentElement.classList.add('sc-d');

const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const sleep = ms => new Promise(r => setTimeout(r, ms));
const vnd = n => Math.round(n).toLocaleString('vi-VN') + 'đ';
const two = n => String(n).padStart(2, '0');
// fn(0..1) every frame for dur ms; under reduced motion fn(1) at once
const tween = (dur, fn) => new Promise(done => {
  if (R) { fn(1); return done(); }
  const t0 = performance.now();
  const step = now => { const k = Math.min(1, Math.max(0, (now - t0) / dur)); fn(k); if (k < 1) requestAnimationFrame(step); else done(); };
  requestAnimationFrame(step);
});
const CURSOR = (cls = '', name = '') => `<span class="dat-cursor fq-cur ${cls}"><svg viewBox="0 0 22 22"><path d="M4 2.5v15.6l4.1-3.9 2.8 6.3 2.7-1.2-2.8-6.2 5.7-.4z" fill="#1d1d1b" stroke="#fff" stroke-width="1.4" stroke-linejoin="round"/></svg>${name && `<em>${name}</em>`}</span>`;

/* ------------------------------------------------------------ #chu-san */
{
  const sec = $('#chu-san'), cs = sec && $('.cs', sec);
  if (cs) {
    const DEP = 94800, WALLET = 500000;
    // t counts half-steps: 2b-1 once the sender of step b has acted, 2b once the other side shows it
    const S = b => 2 * b - 1, V = b => 2 * b;
    const P_CELL = [[0, '|Trống'], [S(2), 'is-held|Đang giữ'], [S(3), 'is-mine|Của bạn']];
    const O_CELL = [[0, '|Trống'], [V(2), 'is-held|Đang giữ'], [V(3), 'is-new|Đã cọc']];
    const F = {
      mult: [[0, '× 1,0'], [S(1), '× 1,3']], rule: [[0, ''], [S(1), 'is-on']],
      price19: [[0, '120.000đ'], [V(1), '156.000đ']],
      p19: P_CELL, p20: P_CELL, o19: O_CELL, o20: O_CELL,
      pw: [[0, vnd(WALLET)], [S(3), vnd(WALLET - DEP)]], ow: [[0, '0đ'], [V(4), vnd(DEP)]],
      pst: [[0, 'Chưa đặt'], [V(1), 'Giá 19:00 tăng'], [S(2), 'Đang giữ 10:00'], [S(3), 'Đã cọc 94.800đ'], [V(4), 'Đơn hoàn tất']],
      ost: [[0, 'Chưa có đơn'], [S(1), 'Đã lưu giá'], [V(2), 'Có người giữ'], [V(3), 'Đơn mới đã cọc'], [S(4), 'Đã xác nhận'], [V(4), '+94.800đ vào ví']],
    };
    // per step: who acts, what they do, who sees it, what they see
    const SAY = [
      ['Chủ sân', 'đặt giờ cao điểm × 1,3', 'Người chơi', 'thấy giá 19:00 tăng'],
      ['Người chơi', 'giữ 19:00–21:00', 'Chủ sân', 'thấy hai ô Đang giữ'],
      ['Người chơi', 'cọc 94.800đ', 'Chủ sân', 'thấy hai ô Đã cọc'],
      ['Chủ sân', 'xác nhận đã chơi xong', 'Người chơi', 'thấy đơn hoàn tất'],
    ];
    const FROM = ['o', 'p', 'p', 'o'];
    const f = Object.fromEntries($$('[data-cs]', cs).map(e => [e.dataset.cs, e]));
    const court = $('.cs-court', cs), ball = $('.cs-ball', cs), say = $('.cs-say', cs);
    const steps = $$('.cs-steps button', cs);
    const side = { p: $('.cs-side--p .cs-app', cs), o: $('.cs-side--o .cs-app', cs) };

    const paint = (t, flash) => {
      for (const k in F) {
        const v = F[k].findLast(r => r[0] <= t)[1], e = f[k];
        if (!e || e._v === v) continue;
        const first = e._v === undefined;
        e._v = v;
        if (k === 'rule') e.classList.toggle('is-on', !!v);
        else if (v.includes('|')) { const [c, txt] = v.split('|'); e.className = 'cs-cell ' + c; e.textContent = txt; }
        else e.textContent = v;
        if (flash && !first && !R) e.animate([{ backgroundColor: '#bfe9c9', offset: 0 }], { duration: 1100, easing: 'ease-out' });
      }
    };
    // b is 0-based from here on
    const mark = b => steps.forEach((s, i) => { s.classList.toggle('is-done', i < b); i === b ? s.setAttribute('aria-current', 'step') : s.removeAttribute('aria-current'); });
    const tell = (b, part) => {
      say.firstElementChild.textContent = SAY[b][part * 2]; say.lastElementChild.textContent = SAY[b][part * 2 + 1];
      if (!R) say.animate([{ opacity: 0.2, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }], { duration: 500, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' });
    };
    // the step crosses from the sender's screen to the other one: a dot along the line between them
    // (side by side on a wide screen, one above the other on a narrow one)
    const fly = from => {
      const c = court.getBoundingClientRect(), a = side[from].getBoundingClientRect(), b = side[from === 'p' ? 'o' : 'p'].getBoundingClientRect();
      const row = a.right <= b.left || b.right <= a.left, fwd = row ? a.left < b.left : a.top < b.top;
      const p0 = row ? [(fwd ? a.right : a.left) - c.left, a.top + a.height / 2 - c.top] : [a.left + a.width / 2 - c.left, (fwd ? a.bottom : a.top) - c.top];
      const p1 = row ? [(fwd ? b.left : b.right) - c.left, p0[1]] : [p0[0], (fwd ? b.top : b.bottom) - c.top];
      const at = p => `translate(${p[0]}px, ${p[1]}px)`;
      return ball.animate([{ transform: at(p0), opacity: 0 }, { transform: at(p0), opacity: 1, offset: 0.08 }, { transform: at(p1), opacity: 1, offset: 0.92 }, { transform: at(p1), opacity: 0 }],
        { duration: 1100, easing: 'cubic-bezier(0.45, 0, 0.3, 1)' }).finished.catch(() => {});
    };

    let run = 0;
    async function play(b0 = 0) {
      const id = ++run, live = () => id === run;
      paint(2 * b0);
      if (R) { paint(2 * b0 + 2); mark(b0); tell(b0, 1); return; }
      for (let b = b0; b < 4; b++) {
        const from = FROM[b];
        mark(b); tell(b, 0); court.dataset.on = from;
        await sleep(800); if (!live()) return;
        paint(2 * b + 1, true);
        await sleep(900); if (!live()) return;
        await fly(from); if (!live()) return;
        court.dataset.on = from === 'p' ? 'o' : 'p'; tell(b, 1); paint(2 * b + 2, true);
        await sleep(2600); if (!live()) return;
      }
      delete court.dataset.on; mark(4);
    }
    steps.forEach((s, i) => s.addEventListener('click', () => play(i)));
    if (R) { paint(8); mark(4); tell(3, 1); }
    else { paint(0); tell(0, 0); SC.onEnter(sec, () => setTimeout(() => play(0), 1000)); }
  }
}

/* ------------------------------------------------------------ #hoi-dap */
{
  const sec = $('#hoi-dap'), faq = sec && $('.faq', sec), stage = sec && $('[data-fq]', sec);
  if (faq && stage) {
    const items = $$(':scope > details', faq);
    const cells = list => `<div class="fq-cells">${list.map(([h, txt, cls = '', k = '']) => `<i class="fq-c ${cls}"${k && ` data-k="${k}"`}><u>${h}</u><span>${txt}</span></i>`).join('')}</div>`;
    const bar = (title, chip, cls = '') => `<div class="fq-bar"><b>${title}</b><span class="fq-chip ${cls}" data-k="st">${chip}</span></div>`;
    const set = (el, cls, txt) => { el.className = el.className.split(' ')[0] + (cls ? ' ' + cls : ''); (el.querySelector('span') || el).textContent = txt; };
    // move a cursor to the middle of a part of the scene
    const aim = (r, cur, target, dx = 0, dy = 0) => {
      const a = r.getBoundingClientRect(), b = target.getBoundingClientRect(), k = a.width / r.offsetWidth || 1;   // the scene may be drawn larger than it is laid out
      cur.classList.add('is-on'); cur.style.transform = `translate(${(b.left - a.left + b.width / 2) / k + dx}px, ${(b.top - a.top + b.height / 2) / k + dy}px)`;
    };
    const park = (cur, x, y) => { cur.style.transition = 'none'; cur.style.transform = `translate(${x}px, ${y}px)`; cur.offsetWidth; cur.style.transition = ''; };
    // a scene: its markup and its beats [ms after the one before, what changes]. Reduced motion runs every beat at once.
    const SCENES = [
      { html: `<div class="fq-app">${bar('Sân 1 · T5 19/11', 'Chưa đăng nhập', 'is-mute')}${cells([['18:00', 'Đã cọc', 'is-taken'], ['19:00', 'Trống', '', 'c'], ['20:00', 'Trống'], ['21:00', 'Trống']])}<p class="fq-line">Lịch trống ai cũng xem được</p><div class="fq-sheet" data-in>Đăng nhập để đặt và cọc<span>Đăng nhập</span></div>${CURSOR()}</div>`,
        beats: [
          [0, (r, q) => park(q('.fq-cur'), r.clientWidth * 0.8, r.clientHeight * 0.9)],
          [700, (r, q) => aim(r, q('.fq-cur'), q('[data-k=c]'))],
          [800, (r, q) => set(q('[data-k=c]'), 'is-pick', 'Chọn')],
          [450, (r, q) => { q('.fq-sheet').classList.add('is-in'); q('.fq-cur').classList.remove('is-on'); }],
        ] },
      { html: `<div class="fq-app">${bar('Giữ chỗ Sân 1', 'Đang giữ')}<div class="fq-hold"><svg class="fq-ring" viewBox="0 0 80 80" aria-hidden="true"><circle cx="40" cy="40" r="34"/><circle class="fq-ring__v" cx="40" cy="40" r="34" pathLength="1"/></svg><b data-k="t">10:00</b></div>${cells([['19:00', 'Đang giữ', 'is-held', 'c1'], ['20:00', 'Đang giữ', 'is-held', 'c2']])}<p class="fq-line" data-k="msg">Chưa cọc trong 10 phút thì đơn tự hủy</p></div>`,
        beats: [
          [600, (r, q) => tween(2600, k => { const s = Math.round(600 * (1 - k)); q('[data-k=t]').textContent = `${two(Math.floor(s / 60))}:${two(s % 60)}`; q('.fq-ring__v').style.strokeDashoffset = k; })],
          [2800, (r, q) => { set(q('[data-k=st]'), 'is-mute', 'Đã tự hủy'); set(q('[data-k=c1]'), '', 'Trống'); set(q('[data-k=c2]'), '', 'Trống'); set(q('[data-k=msg]'), 'is-strong', 'Hai khung giờ trả lại cho người khác'); }],
        ] },
      { html: `<div class="fq-app">${bar('Sân 1 · T5 19/11', '2 người đang xem', 'is-mute')}${cells([['18:00', 'Đã cọc', 'is-taken'], ['19:00', 'Trống', '', 'c'], ['20:00', 'Trống']])}<p class="fq-line" data-k="msg">An và Bình cùng bấm ô 19:00</p><span class="fq-bubble" data-in>Ô đã có người đặt</span>${CURSOR('', 'An')}${CURSOR('fq-cur--b', 'Bình')}</div>`,
        beats: [
          [0, (r, q) => { const [a, b] = r.querySelectorAll('.fq-cur'); park(a, 10, r.clientHeight * 0.86); park(b, r.clientWidth * 0.78, r.clientHeight * 0.1); }],
          [600, (r, q) => { const [a, b] = r.querySelectorAll('.fq-cur'); aim(r, a, q('[data-k=c]'), -24, -12); setTimeout(() => aim(r, b, q('[data-k=c]'), 18, -12), 140); }],
          [800, (r, q) => { set(q('[data-k=c]'), 'is-held', 'An giữ'); set(q('[data-k=msg]'), 'is-strong', 'An bấm trước'); }],
          [500, (r, q) => q('.fq-bubble').classList.add('is-in')],
        ] },
      { html: `<div class="fq-app">${bar('Ví của bạn', 'Tiền thử', 'is-mute')}<b class="fq-big" data-k="w">0đ</b><div class="fq-tx" data-in><span class="fq-role">Admin</span>cấp tiền vào ví<b>+500.000đ</b></div><p class="fq-line">Bản này chưa nhận tiền thật</p></div>`,
        beats: [
          [600, (r, q) => q('.fq-tx').classList.add('is-in')],
          [600, (r, q) => tween(1100, k => { q('[data-k=w]').textContent = vnd(500000 * (1 - (1 - k) ** 3)); })],
        ] },
      { html: `<div class="fq-app">${bar('Sân 1 · 19:00–21:00', 'Đã cọc')}<p class="fq-line" data-k="msg">Buổi chơi kết thúc lúc 21:00</p><div class="fq-btn" data-k="btn"><span class="fq-role">Chủ cơ sở</span><span>Xác nhận hoàn tất</span></div>${CURSOR()}</div>`,
        beats: [
          [0, (r, q) => park(q('.fq-cur'), r.clientWidth * 0.84, 8)],
          [700, (r, q) => aim(r, q('.fq-cur'), q('[data-k=btn]'), 40)],
          [800, (r, q) => q('[data-k=btn]').classList.add('is-press')],
          [220, (r, q) => { q('[data-k=btn]').className = 'fq-btn is-off'; q('[data-k=btn] span:last-child').textContent = 'Đã xác nhận'; set(q('[data-k=st]'), 'is-solid', 'Hoàn tất'); set(q('[data-k=msg]'), 'is-strong', 'Tiền cọc về ví chủ sân'); q('.fq-cur').classList.remove('is-on'); }],
        ] },
    ];
    let tok = 0;
    // still: the scene's first frame only (what the stage holds before the section is reached)
    const show = async (i, still) => {
      const id = ++tok;
      items.forEach((d, k) => { d.open = k === i; });
      stage.innerHTML = `<div class="fq-scene">${SCENES[i].html}</div>`;
      const r = stage.querySelector('.fq-app'), q = s => r.querySelector(s);
      for (const [ms, fn] of SCENES[i].beats) {
        if (still && ms) return;
        if (!R && ms) await sleep(ms);
        if (id !== tok) return;
        fn(r, q);
      }
    };
    // the kit re-opens a closed answer and blocks the click; stop both before they reach its listeners
    faq.addEventListener('toggle', e => e.stopPropagation(), true);
    faq.addEventListener('click', e => {
      const s = e.target.closest('summary'); if (!s) return;
      e.stopPropagation(); e.preventDefault();
      show(items.indexOf(s.parentElement));
    }, true);
    if (R) show(0); else { show(0, true); SC.onEnter(sec, () => setTimeout(() => show(0), 700)); }
  }
}

/* ------------------------------------------------------------ the closing footer */
{
  const foot = $('footer.closing'), word = foot && $('.close__word', foot);
  if (word) {
    const txt = word.textContent.trim();
    word.innerHTML = `<span class="cw"><span class="cw__o">${txt}</span><span class="cw__f">${txt}</span><i class="cw__dot"></i></span>`;
    const cw = word.firstChild, fill = cw.children[1], dot = cw.children[2];
    const tall = matchMedia('(min-width: 1280px)');
    // as wide as the row; on a screen-high footer also no taller than the row the links leave
    const fit = () => {
      cw.style.fontSize = '10px';   // measured small, so the word itself never widens the row it is fitted to
      const w = cw.getBoundingClientRect().width, W = word.clientWidth, H = tall.matches ? word.clientHeight : Infinity;
      cw.style.fontSize = `${Math.max(40, Math.floor(Math.min(W / w * 9.85, H / 1.04, 320)))}px`;
    };
    fit(); new ResizeObserver(fit).observe(word); document.fonts?.ready.then(fit);   // the display face is wider than its fallback
    let busy = false;
    const play = async () => {
      if (R || busy) return;
      busy = true;
      const W = fill.offsetWidth, h = cw.offsetHeight * 0.62, x0 = -(W + dot.offsetWidth * 2);
      dot.style.opacity = 1;
      await tween(1900, k => {
        const e = 1 - (1 - k) ** 1.6, x = x0 * (1 - e), y = -Math.abs(Math.sin(e * Math.PI * 3)) * h * (1 - e * 0.8);
        dot.style.transform = `translate(${x}px, ${y}px)`;
        fill.style.clipPath = `inset(-20% ${Math.max(0, Math.min(100, -x / W * 100))}% -20% -5%)`;
      });
      dot.style.transform = fill.style.clipPath = dot.style.opacity = '';
      busy = false;
    };
    // held empty from the moment the footer takes the screen until the ball starts
    SC.onEnter(foot, () => { if (R) return; fill.style.clipPath = 'inset(-20% 100% -20% -5%)'; dot.style.opacity = 0; setTimeout(play, 900); });
    cw.addEventListener('pointerenter', play);
  }
}
