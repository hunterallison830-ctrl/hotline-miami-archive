// Scroll-reactive Hotline Miami FX overlay (DOM + Web Animations, pooled and rate-limited).
// Down-scroll launches things AT the camera / across; up-scroll lets them drift away upward.
const rnd = (a, b) => a + Math.random() * (b - a), pick = a => a[(Math.random() * a.length) | 0];
const PHONE = `<svg viewBox="0 0 16 12" width="96" height="72" shape-rendering="crispEdges" aria-hidden="true"><path fill="#ff2a8a" d="M1 2h14v3h-3V4H4v1H1z"/><path fill="#16f4ff" d="M3 5h10v6H3z"/><path fill="#000" d="M6 6h1v1H6zM9 6h1v1H9zM6 8h1v1H6zM9 8h1v1H9zM7.5 7h1v1h-1z"/></svg>`;
export function createFX(root, getData) {
  const off = !root || matchMedia('(prefers-reduced-motion: reduce)').matches;
  const noop = { update() {}, burst() {}, count: () => 0 };
  if (off) return noop;
  const MAX = 6, MIN_GAP = 380;
  const mk = (cls, tag = 'div') => { const e = document.createElement(tag); e.className = 'fx-el ' + cls; e.hidden = true; root.appendChild(e); return e; };
  const sprites = Array.from({ length: 8 }, () => mk('fx-sprite', 'img'));
  const texts = Array.from({ length: 5 }, () => mk('fx-text'));
  const phone = mk('fx-phone'); phone.innerHTML = PHONE + '<p>Do you like hurting<br>other people?</p>';
  const glitch = mk('fx-glitch');
  let active = 0, acc = 0, prev = null, lastSpawn = 0, combo = 0, comboT = 0, lastCombo = 0, dist = 0, lastPhone = performance.now(), lastBurst = 0;
  const free = arr => arr.find(e => e.hidden && !e._busy);
  function run(el, frames, opts) {
    el.hidden = false; el._busy = true; active++;
    const a = el.animate(frames, { fill: 'both', ...opts });
    let done = false; a.onfinish = a.oncancel = () => { if (done) return; done = true; el.hidden = true; el._busy = false; active--; a.cancel(); };
  }
  function sprite(kind, dir) {
    const D = getData(); if (!D) return;
    const list = (kind === 'mask' ? D.masks : D.weapons).filter(x => x.img); if (!list.length) return;
    const el = free(sprites); if (!el) return;
    const it = pick(list); el.src = it.img; el.alt = ''; el.className = 'fx-el fx-sprite ' + kind;
    const W = innerWidth, H = innerHeight;
    if (kind === 'mask') {
      const x = rnd(-0.25, 0.25) * W, y = rnd(-0.2, 0.2) * H, r = rnd(-25, 25);
      run(el, dir > 0
        ? [{ transform: `translate(${x * 0.2}px,${y * 0.2}px) scale(.15) rotate(${r}deg)`, opacity: 0 }, { opacity: 0.95, offset: 0.25 }, { transform: `translate(${x * 2.6}px,${y * 2.6}px) scale(5) rotate(${r * 2}deg)`, opacity: 0 }]
        : [{ transform: `translate(${x}px,${H * 0.45}px) scale(1.4) rotate(${r}deg)`, opacity: 0 }, { opacity: 0.85, offset: 0.2 }, { transform: `translate(${x * 0.4}px,${-H * 0.5}px) scale(.25) rotate(${-r}deg)`, opacity: 0 }],
        { duration: dir > 0 ? 950 : 1700, easing: dir > 0 ? 'cubic-bezier(.5,0,.9,.6)' : 'cubic-bezier(.2,.6,.4,1)' });
    } else {
      const y = rnd(-0.35, 0.3) * H, spin = rnd(540, 900);
      run(el, dir > 0
        ? [{ transform: `translate(${-W * 0.65}px,${y}px) rotate(0deg) scale(1.8)`, opacity: 0 }, { opacity: 1, offset: 0.12 }, { opacity: 1, offset: 0.85 }, { transform: `translate(${W * 0.65}px,${y - rnd(40, 140)}px) rotate(${spin}deg) scale(2.2)`, opacity: 0 }]
        : [{ transform: `translate(${W * 0.55}px,${y + H * 0.2}px) rotate(0deg) scale(1.6)`, opacity: 0 }, { opacity: 0.8, offset: 0.2 }, { transform: `translate(${-W * 0.2}px,${y - H * 0.55}px) rotate(${-spin * 0.5}deg) scale(.5)`, opacity: 0 }],
        { duration: dir > 0 ? 1100 : 1900, easing: dir > 0 ? 'linear' : 'ease-out' });
    }
  }
  function text(str, cls, dir, big) {
    const el = free(texts); if (!el) return;
    el.textContent = str; el.className = 'fx-el fx-text ' + cls;
    const x = rnd(-0.32, 0.32) * innerWidth, y = rnd(-0.3, 0.15) * innerHeight, r = rnd(-12, 12), s = big ? 1.4 : 1;
    run(el, dir > 0
      ? [{ transform: `translate(${x}px,${y}px) scale(0) rotate(${r}deg)`, opacity: 1 }, { transform: `translate(${x}px,${y}px) scale(${1.45 * s}) rotate(${-r}deg)`, offset: 0.18 }, { transform: `translate(${x}px,${y - 10}px) scale(${s}) rotate(${r * 0.5}deg)`, opacity: 1, offset: 0.7 }, { transform: `translate(${x}px,${y - 40}px) scale(${s})`, opacity: 0 }]
      : [{ transform: `translate(${x}px,${y + 80}px) scale(${0.9 * s})`, opacity: 0 }, { opacity: 1, offset: 0.2 }, { transform: `translate(${x}px,${y - innerHeight * 0.35}px) scale(${0.6 * s})`, opacity: 0 }],
      { duration: dir > 0 ? 1100 : 1600, easing: 'ease-out' });
  }
  function burst() {
    const now = performance.now(); if (now - lastBurst < 1200) return; lastBurst = now;
    glitch.style.setProperty('--y', rnd(10, 70) + '%');
    glitch.hidden = false; const a = glitch.animate([{ opacity: 0, transform: 'translateX(0)' }, { opacity: 1, transform: 'translateX(-14px)', offset: 0.2 }, { opacity: 0.6, transform: 'translateX(18px)', offset: 0.5 }, { opacity: 1, transform: 'translateX(-6px)', offset: 0.7 }, { opacity: 0, transform: 'translateX(0)' }], { duration: 380, easing: 'steps(6)' });
    a.onfinish = () => { glitch.hidden = true; };
    document.body.classList.add('fx-shake'); setTimeout(() => document.body.classList.remove('fx-shake'), 380);
  }
  function callPhone(dir) {
    if (phone._busy) return;
    run(phone, dir > 0
      ? [{ transform: 'translate(-50%,-50%) scale(.2) rotate(-8deg)', opacity: 0 }, { transform: 'translate(-50%,-50%) scale(1.1) rotate(4deg)', opacity: 1, offset: 0.15 }, { transform: 'translate(-50%,-50%) scale(1) rotate(-3deg)', offset: 0.3 }, { transform: 'translate(-50%,-50%) scale(1) rotate(3deg)', opacity: 1, offset: 0.8 }, { transform: 'translate(-50%,-50%) scale(1.6)', opacity: 0 }]
      : [{ transform: 'translate(-50%,0%) scale(1)', opacity: 0 }, { opacity: 1, offset: 0.2 }, { transform: 'translate(-50%,-140%) scale(.7)', opacity: 0 }],
      { duration: 2200, easing: 'ease-out' });
  }
  function spawn(dir, speed) {
    const now = performance.now();
    combo = now - comboT < 1800 ? combo + 1 : 1; comboT = now;
    const r = Math.random();
    if (r < 0.4) sprite('mask', dir); else if (r < 0.75) sprite('weapon', dir);
    else if (Math.random() < 0.35) text('KILL!', 'kill', dir);
    else text('+' + pick([100, 200, 300, 400, 500, 800, 1000]) + 'pts', 'pts', dir);
    if (combo >= 3 && now - lastCombo > 1500 && active < MAX) { lastCombo = now; text('COMBO x' + combo, 'combo', dir, true); }
    if (speed > 9) burst();
  }
  return {
    burst,
    count: () => active,
    debug: () => ({ acc, active, lastSpawn, dist }),
    update(t, dt, cur, vel) {
      if (prev === null) { prev = cur; return; }
      let d = cur - prev; prev = cur; if (Math.abs(d) > 3) d = 0; /* deck switch / crossfade cut */ acc += d; dist += Math.abs(d);
      if (document.hidden) return;
      const now = performance.now(), sp = Math.abs(vel);
      if (sp > 9) burst();
      if (dist > 14 && now - lastPhone > 12000 && sp > 1) { dist = 0; lastPhone = now; callPhone(Math.sign(d) || 1); }
      if (Math.abs(acc) >= 0.9 && now - lastSpawn > MIN_GAP && active < MAX) { lastSpawn = now; spawn(Math.sign(acc), sp); acc = 0; }
      if (Math.abs(acc) > 3) acc = Math.sign(acc) * 3; // don't bank a backlog while throttled
    },
  };
}
