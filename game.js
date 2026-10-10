// NIGHT CALL - a tiny original fan mini-game inspired by Hotline Miami. Plain Canvas 2D.
'use strict';
(() => {
const cv = document.getElementById('c'), g = cv.getContext('2d');
const TS = 32, PAL = { pink: '#ff2a8a', cyan: '#16f4ff', yel: '#ffe14d', vio: '#7a2cff', blood: '#b3001b' };
const MAP = [
  '########################################',
  '#..........#.................#.........#',
  '#..........#.................#.........#',
  '#..........D.................D.........#',
  '#..........D.................D.........#',
  '#..........#.................#.........#',
  '#..........#.......###.......#.........#',
  '####DD######.......###.......####DD#####',
  '#..........#.................#.........#',
  '#..........#.................#.........#',
  '#..........DD#######DD########.........#',
  '#..........#.................#.........#',
  '#..........#.................D.........#',
  '#..........#.................D.........#',
  '#####DD#######DD##################DD####',
  '#......................................#',
  '#......................................#',
  '########################################',
];
const MW = MAP[0].length, MH = MAP.length;
const wall = (tx, ty) => tx < 0 || ty < 0 || tx >= MW || ty >= MH || MAP[ty][tx] === '#';
const solidAt = (x, y) => wall(Math.floor(x / TS), Math.floor(y / TS));
const T = (tx, ty) => ({ x: tx * TS + TS / 2, y: ty * TS + TS / 2 });
const CAR = T(4, 15.5);
const MASKS = [
  { id: 'richard', name: 'RICHARD', perk: 'NO PERK. +25% SCORE', img: 'img/m/richard.png', mult: 1.25 },
  { id: 'tony', name: 'TONY', perk: 'FISTS ARE LETHAL', img: 'img/m/tony.png', mult: 1 },
  { id: 'rasmus', name: 'RASMUS', perk: 'MOVE 25% FASTER', img: 'img/m/rasmus.png', mult: 1 },
];
const imgs = {}; for (const m of MASKS) { const i = new Image(); i.src = m.img; imgs[m.id] = i; }
for (const w of ['baseball-bat', 'm16', 'shotgun']) { const i = new Image(); i.src = 'img/w/' + w + '.png'; imgs[w] = i; }
const ENEMY_DEFS = [ // spawn tile, weapon, patrol path (tiles)
  [5, 3, 'bat', [[2, 2], [9, 2], [9, 5], [2, 5]]],
  [16, 3, 'gun', [[14, 2], [26, 2]]],
  [24, 5, 'bat', [[24, 5], [14, 5]]],
  [35, 3, 'gun', [[32, 2], [38, 2], [38, 5]]],
  [5, 11, 'bat', [[2, 9], [9, 9], [9, 12], [2, 12]]],
  [20, 9, 'gun', [[14, 8], [27, 8]]],
  [22, 12, 'bat', [[14, 12], [27, 12]]],
  [35, 10, 'bat', [[32, 9], [38, 9], [38, 12], [32, 12]]],
];
// ---------- state ----------
let W = 0, H = 0, DPR = 1, zoom = 1;
let S = null, mode = 'select', maskSel = 0, best = +localStorage.getItem('hm_nightcall_best') || 0, bestGrade = localStorage.getItem('hm_nightcall_grade') || '';
const keys = new Set(), mouse = { x: 0, y: 0, down: false };
const touch = { on: false, move: null, aim: null, mv: { x: 0, y: 0 }, av: { x: 0, y: 0 }, fire: false };
const QS = new URLSearchParams(location.search), DBG_PW = QS.get('pw') === '1'; // test-only: start with a full meter
const PW_DUR = 15, PW_PER_COMBO = 1 / 15; // 1+2+3+4+5 = 15 combo-steps fills it
const reach = () => (S.p.wpn ? 44 : 33) * (S.pwOn > 0 ? 1.3 : 1);   // ~+10% base melee reach, +30% powered
const pspeed = () => (S.mask.id === 'rasmus' ? 215 : 172) * (S.pwOn > 0 ? 1.25 : 1);
function activatePower() {
  if (!S || mode !== 'play' || S.p.dead || S.won || S.pwOn > 0 || S.pw < 1) return;
  S.pwOn = PW_DUR; S.hp = 2; S.dil = 0.6; S.shake = 16; pop(S.p.x, S.p.y - 34, 'POWER UP!', '#fff', true);
}
function newRun() {
  const m = MASKS[maskSel];
  S = {
    mask: m, t: 0, p: { x: CAR.x + 40, y: CAR.y - 4, a: -Math.PI / 2, wpn: m.id === 'tony' ? null : 'bat', ammo: 0, dead: false, swing: 0, cd: 0, r: 10 },
    en: ENEMY_DEFS.map(([tx, ty, w, path]) => ({ ...T(tx, ty), a: 0, w, path: path.map(([a, b]) => T(a, b)), pi: 0, st: 'patrol', stun: 0, seen: 0, cd: 0, last: null, r: 10, dead: false, swing: 0 })),
    items: [], bullets: [], decals: [], pops: [], parts: [],
    pw: DBG_PW ? 1 : 0, embA: 0, smears: [], lastSm: null, pwOn: 0, hp: 0, inv: 0, dil: 0, trail: [], aura: [], score: 0, kills: 0, combo: 0, comboT: 0, maxCombo: 0, shake: 0, clear: false, won: false, endT: 0, cam: { x: CAR.x, y: CAR.y },
  };
  mode = 'play'; setModeClass(); rArm = -1e9;
}
// ---------- input ----------
addEventListener('keydown', e => {
  const k = e.key.toLowerCase(); keys.add(k);
  if ((k === 'q' || k === 'shift') && mode === 'play') { activatePower(); e.preventDefault(); return; }
  if (mode === 'select') { if (['1', '2', '3'].includes(k)) maskSel = +k - 1; if (k === 'arrowleft' || k === 'a') maskSel = (maskSel + 2) % 3; if (k === 'arrowright' || k === 'd') maskSel = (maskSel + 1) % 3; if (k === 'enter' || k === ' ') { newRun(); e.preventDefault(); } return; }
  if (mode === 'paused') { if (k === 'escape' || k === 'p' || k === 'enter') resume(); else if (k === 'r') newRun(); else if (k === 'q' || k === 'm') quitToSelect(); return; }
  if (k === 'escape' || k === 'p') { if (mode === 'play') pause(); return; }
  if (k === 'r') { newRun(); }
  if (k === 'm' && mode === 'results') { quitToSelect(); }
  if (k === ' ' || k === 'e') { if (mode === 'play') throwOrPick(); e.preventDefault(); }
  if (mode === 'results' && k === 'enter') newRun();
});
addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));
addEventListener('blur', () => { keys.clear(); mouse.down = false; if (mode === 'play' && S && !S.p.dead && !S.won) pause(); });
function pause() { if (mode !== 'play') return; mode = 'paused'; keys.clear(); mouse.down = false; touch.move = touch.aim = null; setModeClass(); }
function resume() { mode = 'play'; last = performance.now(); setModeClass(); }
function quitToSelect() { mode = 'select'; setModeClass(); }
cv.addEventListener('mousemove', e => { mouse.x = e.clientX; mouse.y = e.clientY; });
cv.addEventListener('mousedown', e => {
  mouse.x = e.clientX; mouse.y = e.clientY;
  if (mode !== 'play') return; // menus are handled by the pointerdown handler below
  if (e.button === 2) { throwOrPick(); return; }
  mouse.down = true;
});
addEventListener('mouseup', () => { mouse.down = false; });
cv.addEventListener('contextmenu', e => e.preventDefault());
// twin-stick touch
const tl = document.getElementById('touch');
// input mode follows the last real input: touch shows the twin-stick overlay, mouse/pen hides it (touch laptops, 2-in-1s)
let isTouch = false;
function setTouchMode(on) { if (on === isTouch) return; isTouch = on; document.body.classList.toggle('is-touch', on); if (!on) { touch.move = touch.aim = null; } }
addEventListener('pointerdown', e => setTouchMode(e.pointerType === 'touch'), true);
addEventListener('pointermove', e => { if (e.pointerType === 'mouse' && (e.movementX || e.movementY)) setTouchMode(false); }, true);
addEventListener('touchstart', () => setTouchMode(true), { capture: true, passive: true });
// menu taps/clicks (any pointer type), wherever the event lands except real buttons/links
addEventListener('pointerdown', e => {
  if (e.target.closest && e.target.closest('.tbtn,a')) return;
  if (mode === 'select') { const i = selectHit(e.clientX, e.clientY); if (i >= 0) { if (i === maskSel) newRun(); else maskSel = i; } }
  else if (mode === 'paused') pauseHit(e.clientX, e.clientY);
  else if (mode === 'results') newRun();
  else return;
  e.preventDefault();
});
function setModeClass() { document.body.dataset.mode = mode; }
tl.addEventListener('touchstart', e => {
  if (e.target.closest('.tbtn')) return; e.preventDefault();
  for (const t of e.changedTouches) {
    if (mode !== 'play') return;
    if (t.clientX < innerWidth / 2 && !touch.move) touch.move = { id: t.identifier, x: t.clientX, y: t.clientY, cx: t.clientX, cy: t.clientY };
    else if (!touch.aim) touch.aim = { id: t.identifier, x: t.clientX, y: t.clientY, cx: t.clientX, cy: t.clientY };
  }
}, { passive: false });
tl.addEventListener('touchmove', e => {
  e.preventDefault();
  for (const t of e.changedTouches) for (const s of [touch.move, touch.aim]) if (s && s.id === t.identifier) { s.cx = t.clientX; s.cy = t.clientY; }
}, { passive: false });
const tend = e => { for (const t of e.changedTouches) { if (touch.move && touch.move.id === t.identifier) touch.move = null; if (touch.aim && touch.aim.id === t.identifier) touch.aim = null; } };
tl.addEventListener('touchend', tend); tl.addEventListener('touchcancel', tend);
document.getElementById('tPow').addEventListener('touchstart', e => { e.preventDefault(); activatePower(); }, { passive: false });
document.getElementById('tThrow').addEventListener('touchstart', e => { e.preventDefault(); if (mode === 'play') throwOrPick(); }, { passive: false });
const tRb = document.getElementById('tR'); let rArm = -1e9;
tRb.addEventListener('touchstart', e => { e.preventDefault(); const now = performance.now();
  if (S && (S.p.dead || S.won) || now - rArm < 2000) { rArm = -1e9; tRb.classList.remove('arm'); tRb.textContent = 'R'; newRun(); return; }
  rArm = now; tRb.classList.add('arm'); tRb.textContent = 'R?'; setTimeout(() => { if (performance.now() - rArm >= 1990) { tRb.classList.remove('arm'); tRb.textContent = 'R'; } }, 2000); }, { passive: false });
document.getElementById('tP').addEventListener('touchstart', e => { e.preventDefault(); if (mode === 'play') pause(); else if (mode === 'paused') resume(); }, { passive: false });
// ---------- helpers ----------
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const angDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
function los(a, b) { const d = dist(a, b), n = Math.ceil(d / 8); for (let i = 1; i < n; i++) { const t = i / n; if (solidAt(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t)) return false; } return true; }
function moveC(o, dx, dy) {
  const r = o.r - 1;
  const hit = (x, y) => solidAt(x - r, y - r) || solidAt(x + r, y - r) || solidAt(x - r, y + r) || solidAt(x + r, y + r);
  if (!hit(o.x + dx, o.y)) o.x += dx; if (!hit(o.x, o.y + dy)) o.y += dy;
}
function auraP(p, sp) { const a = Math.random() * 6.283, r = 10 + Math.random() * 8; return { x: p.x + Math.cos(a) * r, y: p.y + Math.sin(a) * r, vx: Math.cos(a) * sp * (0.3 + Math.random()), vy: Math.sin(a) * sp * (0.3 + Math.random()) - 30, t: 0, life: 0.35 + Math.random() * 0.4, h: Math.random() * 360 }; }
function pop(x, y, txt, col, big) { S.pops.push({ x, y, txt, col, t: 0, big }); }
function splat(x, y, a) { for (let i = 0; i < 14; i++) { const s = 2 + Math.random() * 5, d = Math.random() * 26; S.decals.push({ x: x + Math.cos(a + (Math.random() - .5)) * d, y: y + Math.sin(a + (Math.random() - .5)) * d, s }); } for (let i = 0; i < 10; i++) S.parts.push({ x, y, vx: Math.cos(a + (Math.random() - .5) * 1.5) * (80 + Math.random() * 160), vy: Math.sin(a + (Math.random() - .5) * 1.5) * (80 + Math.random() * 160), t: 0 }); }
function killEnemy(e, a, how) {
  if (e.dead) return; e.dead = true; e.a = a; S.kills++;
  if (e.w) S.items.push({ x: e.x, y: e.y, type: e.w, ammo: e.w === 'gun' ? 8 : 0, vx: 0, vy: 0, fly: 0, spin: Math.random() * 6 });
  e.w = null; splat(e.x, e.y, a); S.shake = Math.min(14, S.shake + 7);
  S.combo = S.t - S.comboT < 2.6 ? S.combo + 1 : 1; S.comboT = S.t; S.maxCombo = Math.max(S.maxCombo, S.combo);
  if (S.pwOn <= 0) S.pw = Math.min(1, S.pw + PW_PER_COMBO * S.combo);
  const pts = Math.round((how === 'gun' ? 300 : how === 'exec' ? 600 : 500) * S.combo * S.mask.mult);
  S.score += pts; pop(e.x, e.y - 18, '+' + pts + 'pts', PAL.yel);
  if (S.combo >= 2) pop(e.x, e.y - 40, 'COMBO x' + S.combo, PAL.cyan, true);
  if (S.en.every(x => x.dead) && !S.clear) { S.clear = true; S.clearT = S.t; S.shake = 18; }
}
function killPlayer(a) { if (S.p.dead || S.won || GOD) return;
  if (S.inv > 0) return;
  if (S.pwOn > 0 && S.hp > 0) { S.hp--; S.inv = 1.2; S.shake = 14; pop(S.p.x, S.p.y - 26, 'BLOCKED! ' + S.hp + ' LEFT', '#16f4ff', true); for (let i = 0; i < 16; i++) S.aura.push(auraP(S.p, 260)); return; } S.p.dead = true; S.p.a = a; splat(S.p.x, S.p.y, a); S.shake = 18; S.endT = S.t; }
function throwOrPick() {
  const p = S.p; if (p.dead || S.won) return;
  if (p.wpn) { // throw
    S.items.push({ x: p.x + Math.cos(p.a) * 14, y: p.y + Math.sin(p.a) * 14, type: p.wpn, ammo: p.ammo, vx: Math.cos(p.a) * 560, vy: Math.sin(p.a) * 560, fly: 0.7, spin: 0 });
    p.wpn = null; p.ammo = 0; return;
  }
  let bestI = null, bd = 30; for (const it of S.items) { if (it.fly > 0) continue; const d = dist(it, p); if (d < bd) { bd = d; bestI = it; } }
  if (bestI) { p.wpn = bestI.type; p.ammo = bestI.ammo; S.items.splice(S.items.indexOf(bestI), 1); }
}
function attack() {
  const p = S.p; if (p.cd > 0 || p.dead || S.won) return;
  if (p.wpn === 'gun') {
    if (p.ammo <= 0) { pop(p.x, p.y - 20, 'EMPTY', PAL.pink); p.cd = 0.4; return; }
    p.ammo--; p.cd = 0.16; S.bullets.push({ x: p.x + Math.cos(p.a) * 14, y: p.y + Math.sin(p.a) * 14, vx: Math.cos(p.a) * 900, vy: Math.sin(p.a) * 900, from: 'p' }); S.shake += 3; return;
  }
  p.cd = p.wpn ? 0.32 : 0.26; p.swing = 0.16;
  for (const e of S.en) {
    if (e.dead) continue; const d = dist(e, p); if (d > reach()) continue;
    if (Math.abs(angDiff(Math.atan2(e.y - p.y, e.x - p.x), p.a)) > 1.1 && d > 16) continue;
    const a = Math.atan2(e.y - p.y, e.x - p.x);
    if (e.stun > 0) killEnemy(e, a, 'exec');
    else if (p.wpn === 'bat' || S.mask.id === 'tony') killEnemy(e, a, 'melee');
    else { e.stun = 1.6; if (e.w) { S.items.push({ x: e.x, y: e.y, type: e.w, ammo: e.w === 'gun' ? 8 : 0, vx: Math.cos(a) * 160, vy: Math.sin(a) * 160, fly: .2, spin: 0 }); e.w = null; } S.shake += 4; pop(e.x, e.y - 18, 'KNOCKED!', PAL.cyan); }
  }
}
// ---------- update ----------
function update(dt) {
  S.t += dt; const p = S.p;
  // power-up timers
  if (S.inv > 0) S.inv -= dt;
  if (S.pwOn > 0) { S.pwOn -= dt; S.pw = Math.max(0, S.pwOn / PW_DUR); if (S.pwOn <= 0) { S.pwOn = 0; S.hp = 0; S.pw = 0; pop(p.x, p.y - 26, 'POWER DOWN', '#ff2a8a'); } }
  if (S.pwOn > 0 && !p.dead) { S.trail.push({ x: p.x, y: p.y, a: p.a, t: S.t }); if (S.trail.length > 7) S.trail.shift(); if (S.aura.length < 48) S.aura.push(auraP(p, 60)); } else S.trail.length = 0;
  S.embA += ((S.pwOn > 0 ? 1 : 0) - S.embA) * (1 - Math.exp(-(S.pwOn > 0 ? 5 : 2.5) * dt));
  if (S.pwOn > 0 && !p.dead) { if (!S.lastSm || dist(S.lastSm, p) > 26) { S.lastSm = { x: p.x, y: p.y }; S.smears.push({ x: p.x, y: p.y, t: 0, rot: (Math.random() - .5) * 0.5, sx: 1 + Math.random() * 0.25 }); if (S.smears.length > 18) S.smears.shift(); } }
  for (const q of S.smears) q.t += dt; S.smears = S.smears.filter(q => q.t < 1.6);
  for (const q of S.aura) { q.t += dt; q.x += q.vx * dt; q.y += q.vy * dt; q.vy -= 40 * dt; }
  S.aura = S.aura.filter(q => q.t < q.life);
  // input -> movement & aim
  let mx = (keys.has('d') || keys.has('arrowright') ? 1 : 0) - (keys.has('a') || keys.has('arrowleft') ? 1 : 0);
  let my = (keys.has('s') || keys.has('arrowdown') ? 1 : 0) - (keys.has('w') || keys.has('arrowup') ? 1 : 0);
  if (touch.move) { const dx = touch.move.cx - touch.move.x, dy = touch.move.cy - touch.move.y, l = Math.hypot(dx, dy); if (l > 8) { mx = dx / Math.max(l, 50); my = dy / Math.max(l, 50); } }
  const ml = Math.hypot(mx, my); if (ml > 1) { mx /= ml; my /= ml; }
  if (!p.dead && !S.won) {
    const sp = pspeed(); moveC(p, mx * sp * dt, my * sp * dt);
    if (touch.aim) { const dx = touch.aim.cx - touch.aim.x, dy = touch.aim.cy - touch.aim.y; if (Math.hypot(dx, dy) > 10) p.a = Math.atan2(dy, dx); attack(); }
    else if (!isTouch || mouse.x) { const w = toWorld(mouse.x, mouse.y); if (!touch.move || !isTouch) p.a = Math.atan2(w.y - p.y, w.x - p.x); }
    if (isTouch && !touch.aim && ml > 0.2) p.a = Math.atan2(my, mx);
    if (mouse.down) attack();
  }
  p.cd -= dt; p.swing -= dt;
  // enemies
  for (const e of S.en) {
    if (e.dead) continue;
    if (e.stun > 0) { e.stun -= dt; continue; }
    e.cd -= dt; e.swing -= dt;
    const toP = Math.atan2(p.y - e.y, p.x - e.x), dP = dist(e, p);
    const sees = !p.dead && dP < 360 && (Math.abs(angDiff(toP, e.a)) < 1.25 || dP < 70 || e.st === 'chase') && los(e, p);
    if (sees) { if (e.st !== 'chase') { e.st = 'chase'; e.seen = 0; pop(e.x, e.y - 22, '!', PAL.pink); } e.seen += dt; e.last = { x: p.x, y: p.y }; }
    let tgt = null, sp = 62;
    if (e.st === 'chase') {
      sp = 132; tgt = e.last;
      if (sees) {
        e.a = toP;
        if (e.w === 'gun') { if (dP < 330 && e.seen > 0.45 && e.cd <= 0) { e.cd = 0.75; const sa = toP + (Math.random() - .5) * 0.12; S.bullets.push({ x: e.x + Math.cos(sa) * 14, y: e.y + Math.sin(sa) * 14, vx: Math.cos(sa) * 650, vy: Math.sin(sa) * 650, from: 'e' }); } if (dP < 140) tgt = null; }
        else if (dP < 24 && e.cd <= 0) { e.cd = 0.5; e.swing = 0.16; if (e.seen > 0.25) killPlayer(toP); }
      } else if (!e.last || dist(e, e.last) < 10) { e.st = 'patrol'; e.last = null; }
    } else { tgt = e.path[e.pi]; if (dist(e, tgt) < 6) e.pi = (e.pi + 1) % e.path.length; }
    if (tgt) { const a = Math.atan2(tgt.y - e.y, tgt.x - e.x); if (e.st !== 'chase' || !sees) e.a = a; const ox = e.x, oy = e.y; moveC(e, Math.cos(a) * sp * dt, Math.sin(a) * sp * dt);
      if (Math.hypot(e.x - ox, e.y - oy) < sp * dt * 0.3) { moveC(e, Math.cos(a + 1.2) * sp * dt, Math.sin(a + 1.2) * sp * dt); } }
  }
  // bullets
  for (const b of S.bullets) {
    const n = 4; for (let i = 0; i < n && !b.gone; i++) {
      b.x += b.vx * dt / n; b.y += b.vy * dt / n;
      if (solidAt(b.x, b.y)) { b.gone = true; for (let k = 0; k < 4; k++) S.parts.push({ x: b.x, y: b.y, vx: (Math.random() - .5) * 200, vy: (Math.random() - .5) * 200, t: 0, spark: 1 }); break; }
      if (b.from === 'p') { for (const e of S.en) if (!e.dead && dist(e, b) < 12) { killEnemy(e, Math.atan2(b.vy, b.vx), 'gun'); b.gone = true; break; } }
      else if (!p.dead && dist(p, b) < 10) { killPlayer(Math.atan2(b.vy, b.vx)); b.gone = true; }
    }
  }
  S.bullets = S.bullets.filter(b => !b.gone);
  // thrown items
  for (const it of S.items) {
    if (it.fly <= 0) continue; it.fly -= dt; it.spin += dt * 20;
    const nx = it.x + it.vx * dt, ny = it.y + it.vy * dt;
    if (solidAt(nx, it.y)) it.vx *= -0.3; else it.x = nx; if (solidAt(it.x, ny)) it.vy *= -0.3; else it.y = ny;
    it.vx *= 0.97; it.vy *= 0.97;
    if (Math.hypot(it.vx, it.vy) > 200) for (const e of S.en) if (!e.dead && e.stun <= 0 && dist(e, it) < 16) {
      e.stun = 2.2; it.vx *= -0.25; it.vy *= -0.25; S.shake += 5; pop(e.x, e.y - 18, 'STUNNED', PAL.cyan);
      if (e.w) { S.items.push({ x: e.x, y: e.y, type: e.w, ammo: e.w === 'gun' ? 8 : 0, vx: 0, vy: 0, fly: 0, spin: 1 }); e.w = null; }
    }
  }
  for (const q of S.parts) { q.t += dt; q.x += q.vx * dt; q.y += q.vy * dt; q.vx *= .9; q.vy *= .9; }
  S.parts = S.parts.filter(q => q.t < 0.6);
  for (const q of S.pops) q.t += dt; S.pops = S.pops.filter(q => q.t < 1.2);
  S.shake *= Math.exp(-8 * dt);
  // level clear -> go to car
  if (S.clear && !S.won && !p.dead && dist(p, CAR) < 40) { S.won = true; S.endT = S.t; finish(); }
  // camera leans toward aim
  const lean = isTouch ? 70 : Math.min(160, Math.hypot(mouse.x - W / 2, mouse.y - H / 2) / zoom * 0.35);
  const tx = p.x + Math.cos(p.a) * lean, ty = p.y + Math.sin(p.a) * lean;
  S.cam.x += (tx - S.cam.x) * (1 - Math.exp(-6 * dt)); S.cam.y += (ty - S.cam.y) * (1 - Math.exp(-6 * dt));
}
function grade(score, time) {
  const s = score - Math.max(0, time - 40) * 40;
  return s > 11000 ? 'A+' : s > 8000 ? 'A' : s > 6000 ? 'B' : s > 4000 ? 'C' : s > 2500 ? 'D' : 'F';
}
function finish() {
  const time = S.endT; S.timeBonus = Math.max(0, Math.round((90 - time) * 50)); S.final = S.score + S.timeBonus; S.grade = grade(S.final, time);
  S.test = GOD || TSCALE !== 1 || DBG_PW;
  S.newBest = !S.test && S.final > best; if (S.newBest) { best = S.final; bestGrade = S.grade; try { localStorage.setItem('hm_nightcall_best', best); localStorage.setItem('hm_nightcall_grade', bestGrade); } catch (e) {} }
  setTimeout(() => { if (S.won) mode = 'results'; }, 900);
}
// ---------- 50 Blessings-style blood emblem ----------
// Pixel-painted like the in-game/wiki symbol (chunky bright-red ring, bars running past the rim, drips and spatter),
// with the three bars vertical as requested. Built once into a small offscreen canvas, then scaled up unsmoothed: cheap on mobile.
const EMB = (() => {
  const N = 34, c = document.createElement('canvas'); c.width = c.height = N; const x = c.getContext('2d');
  let sd = 50; const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
  const px = (i, j, col) => { if (i >= 0 && j >= 0 && i < N && j < N) { x.fillStyle = col; x.fillRect(i, j, 1, 1); } };
  const C = N / 2, R = 11.5;
  const col = () => rnd() < 0.18 ? '#a3000c' : rnd() < 0.1 ? '#ff2a2a' : '#e00010';
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const d = Math.hypot(i + .5 - C, j + .5 - C), a = Math.atan2(j - C, i - C);
    const w = 1.6 + 0.9 * Math.sin(a * 3 + 1) + rnd() * 0.6; if (Math.abs(d - R) < w) px(i, j, col()); }
  for (const bx of [C - 6, C - 1, C + 4]) { const top = 3 + Math.floor(rnd() * 3), bot = N - 6 - Math.floor(rnd() * 3), w = 2 + (rnd() < .5 ? 1 : 0);
    for (let j = top; j <= bot; j++) for (let k = 0; k < w; k++) if (rnd() > 0.05) px(Math.round(bx + k + (rnd() < .12 ? (rnd() < .5 ? -1 : 1) : 0)), j, col());
    const drip = 2 + Math.floor(rnd() * 4); for (let j = 1; j <= drip; j++) px(Math.round(bx + (w > 2 ? 1 : 0)), bot + j, '#c0000e'); }
  for (let k = 0; k < 6; k++) { const a = Math.PI * (0.15 + rnd() * 0.7), i = Math.round(C + Math.cos(a) * R), j0 = Math.round(C + Math.sin(a) * R) + 1, L = 1 + Math.floor(rnd() * 4); for (let j = 0; j < L; j++) px(i, j0 + j, '#c0000e'); }
  for (let k = 0; k < 18; k++) { const a = rnd() * 6.283, r = R + 3 + rnd() * 4; px(Math.round(C + Math.cos(a) * r), Math.round(C + Math.sin(a) * r), col()); }
  return c;
})();
function drawEmblem(x0, y0, R, alpha, rot) {
  if (alpha <= 0.01) return;
  g.save(); g.translate(x0, y0); g.rotate(rot); g.globalAlpha = alpha; g.imageSmoothingEnabled = false;
  const s = R * 2 * 34 / 23; g.drawImage(EMB, -s / 2, -s / 2, s, s); g.restore();
}
// ---------- power-up visuals ----------
function pwFade() { return S.pwOn < 3 ? (Math.floor(S.t * (6 + (3 - S.pwOn) * 4)) % 2 ? 0.25 : 1) * Math.max(0.3, S.pwOn / 3) : 1; } // warning flicker in the last 3s
function drawAura() {
  const p = S.p, t = S.t, f = pwFade(), hue = (t * 240) % 360;
  g.save(); g.globalCompositeOperation = 'lighter';
  // chromatic afterimages
  S.trail.forEach((q, i) => { const a = (i + 1) / S.trail.length * 0.35 * f; g.globalAlpha = a;
    g.fillStyle = '#ff2a8a'; g.fillRect(q.x - 11 - 2, q.y - 11, 22, 22); g.fillStyle = '#16f4ff'; g.fillRect(q.x - 11 + 2, q.y - 11, 22, 22); });
  // layered neon rings
  for (let i = 0; i < 3; i++) { const r = 20 + i * 7 + Math.sin(t * 8 + i) * 2.5; g.globalAlpha = (0.55 - i * 0.15) * f; g.strokeStyle = `hsl(${(hue + i * 60) % 360},100%,${60 + i * 10}%)`; g.lineWidth = 3 - i * 0.7; g.beginPath(); g.arc(p.x, p.y, r, 0, 6.283); g.stroke(); }
  // rotating sigils
  g.globalAlpha = 0.7 * f; g.strokeStyle = `hsl(${(hue + 180) % 360},100%,70%)`; g.lineWidth = 1.5;
  for (let k = 0; k < 2; k++) { const R = 34 + k * 8, rot = t * (k ? -1.6 : 2.2); g.beginPath(); for (let i = 0; i <= 3; i++) { const a = rot + i * 2.094; i ? g.lineTo(p.x + Math.cos(a) * R, p.y + Math.sin(a) * R) : g.moveTo(p.x + Math.cos(a) * R, p.y + Math.sin(a) * R); } g.stroke();
    for (let i = 0; i < 6; i++) { const a = rot * 1.3 + i * 1.047; g.fillStyle = g.strokeStyle; g.fillRect(p.x + Math.cos(a) * (R + 6) - 1.5, p.y + Math.sin(a) * (R + 6) - 1.5, 3, 3); } }
  // flame particles
  for (const q of S.aura) { const k = 1 - q.t / q.life; g.globalAlpha = k * 0.9 * f; g.fillStyle = `hsl(${(hue + q.h * 0.3) % 360},100%,${55 + k * 35}%)`; const s = 2 + k * 4; g.fillRect(q.x - s / 2, q.y - s / 2, s, s); }
  g.restore();
}
function drawPowerHUD(hs) {
  const t = S.t, v = S.pw, on = S.pwOn > 0, ready = v >= 1 && !on;
  const w = Math.min(220, W * 0.3), h = Math.max(12, hs), x = isTouch ? 16 : W - 16 - w, y = isTouch ? 96 : H - 30 - h;
  // colour: pink -> cyan -> white-hot
  const col = v < 0.5 ? `hsl(${330 - v * 2 * 145},100%,${55 + v * 10}%)` : `hsl(185,100%,${60 + (v - 0.5) * 2 * 38}%)`;
  const pulse = 1 + (ready ? 0.12 : v * 0.05) * Math.sin(t * (ready ? 12 : 6));
  const flick = v > 0.6 && Math.random() < (v - 0.6) * 0.25 ? 0.55 : 1;
  g.save(); g.translate(x + w / 2, y + h / 2); g.scale(pulse, pulse); g.translate(-w / 2, -h / 2);
  g.fillStyle = '#000a'; g.fillRect(-3, -3, w + 6, h + 6);
  g.shadowColor = col; g.shadowBlur = 4 + v * 26 * flick; g.globalAlpha = flick;
  g.fillStyle = col; g.fillRect(0, 0, w * v, h); g.shadowBlur = 0; g.globalAlpha = 1;
  g.strokeStyle = on ? '#fff' : col; g.lineWidth = 2; g.strokeRect(0, 0, w, h);
  if (v > 0.4) { g.globalCompositeOperation = 'lighter'; for (let i = 0; i < Math.floor(v * 8); i++) { g.fillStyle = Math.random() < .5 ? '#fff' : col; g.fillRect(w * v * Math.random(), -6 - Math.random() * 10 * v, 2, 2); } g.globalCompositeOperation = 'source-over'; }
  g.restore();
  const label = on ? `POWER ${S.pwOn.toFixed(1)}s` : ready ? (isTouch ? 'READY! TAP POWER' : 'READY! [Q]/[SHIFT]') : 'POWER';
  txt(label, x + (isTouch ? 0 : w), y - h * 0.9, Math.max(7, hs * 0.65), ready ? (Math.floor(t * 6) % 2 ? '#fff' : PAL.cyan) : col, isTouch ? 'left' : 'right');
  if (on) for (let i = 0; i < 2; i++) { const px = x + (isTouch ? i * 18 : w - 14 - i * 18), py = y - h * 2.2; g.fillStyle = i < S.hp ? PAL.cyan : '#333'; g.shadowColor = PAL.cyan; g.shadowBlur = i < S.hp ? 10 : 0; g.fillRect(px, py - 6, 12, 12); g.shadowBlur = 0; }
  // touch button state
  if (tPow) { const st = on ? 'on' : ready ? 'ready' : ''; if (tPow.dataset.st !== st) { tPow.dataset.st = st; } tPow.style.setProperty('--p', (v * 100).toFixed(0) + '%'); }
}
const tPow = document.getElementById('tPow');
// ---------- render ----------
function toWorld(x, y) { return { x: (x - W / 2) / zoom + S.cam.x, y: (y - H / 2) / zoom + S.cam.y }; }
function txt(s, x, y, size, col, align = 'center', shadow = '#000') {
  g.font = `${size}px "Press Start 2P"`; g.textAlign = align; g.textBaseline = 'middle';
  g.fillStyle = shadow; g.fillText(s, x + size * 0.15, y + size * 0.15); g.fillStyle = col; g.fillText(s, x, y);
}
function drawGuy(o, body, head, dead, maskImg, wpn, swing) {
  g.save(); g.translate(o.x, o.y); g.rotate(o.a);
  if (dead) { g.fillStyle = body; g.fillRect(-14, -8, 24, 16); g.fillStyle = head; g.fillRect(8, -6, 10, 12); g.restore(); return; }
  g.fillStyle = '#000'; g.fillRect(-9, -11, 18, 22);
  g.fillStyle = body; g.fillRect(-8, -10, 16, 20); // shoulders
  // arms + weapon
  g.fillStyle = head; g.fillRect(4, -11, 8, 5); g.fillRect(4, 6, 8, 5);
  if (wpn === 'bat') { g.save(); g.translate(10, 8); g.rotate(swing > 0 ? -1.6 + (0.16 - swing) * 14 : -0.4); g.fillStyle = '#c8955a'; g.fillRect(0, -2, 24, 4); g.fillStyle = '#8a5a2b'; g.fillRect(0, -2, 7, 4); g.restore(); }
  if (wpn === 'gun') { g.fillStyle = '#ddd'; g.fillRect(10, -2, 18, 4); g.fillStyle = '#333'; g.fillRect(10, -2, 6, 4); }
  if (!wpn && swing > 0) { g.fillStyle = head; g.fillRect(12, -3, 10, 6); }
  if (maskImg && maskImg.complete && maskImg.naturalWidth) { g.rotate(Math.PI / 2); g.imageSmoothingEnabled = false; g.drawImage(maskImg, -11, -11, 22, 22); }
  else { g.fillStyle = head; g.fillRect(-6, -6, 12, 12); g.fillStyle = '#3a1c0a'; g.fillRect(-6, -6, 6, 12); }
  g.restore();
}
function render() {
  g.setTransform(DPR, 0, 0, DPR, 0, 0); g.fillStyle = '#0b0216'; g.fillRect(0, 0, W, H);
  if (mode === 'select') return renderSelect();
  const sh = S.shake, ox = (Math.random() - .5) * sh, oy = (Math.random() - .5) * sh;
  g.save(); g.translate(W / 2 + ox, H / 2 + oy); g.scale(zoom, zoom); g.translate(-S.cam.x, -S.cam.y);
  // floor
  const t = S.t;
  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
    const c = MAP[y][x], X = x * TS, Y = y * TS;
    if (c === '#') continue;
    const outside = y >= 15; g.fillStyle = outside ? ((x + y) % 2 ? '#141a2c' : '#11162a') : ((x + y) % 2 ? '#2a0b3d' : '#230934'); g.fillRect(X, Y, TS, TS);
    if (c === 'D') { g.fillStyle = '#5a3a1a'; g.fillRect(X + 2, Y + 2, TS - 4, TS - 4); }
  }
  g.fillStyle = PAL.blood; for (const d of S.decals) g.fillRect(d.x, d.y, d.s, d.s);
  // walls with neon edge
  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) if (MAP[y][x] === '#') { const X = x * TS, Y = y * TS; g.fillStyle = '#05010a'; g.fillRect(X, Y, TS, TS); }
  g.strokeStyle = PAL.pink; g.lineWidth = 2; g.shadowColor = PAL.pink; g.shadowBlur = 10; g.beginPath();
  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) if (MAP[y][x] === '#') { const X = x * TS, Y = y * TS;
    if (!wall(x, y - 1)) { g.moveTo(X, Y); g.lineTo(X + TS, Y); } if (!wall(x, y + 1)) { g.moveTo(X, Y + TS); g.lineTo(X + TS, Y + TS); }
    if (!wall(x - 1, y)) { g.moveTo(X, Y); g.lineTo(X, Y + TS); } if (!wall(x + 1, y)) { g.moveTo(X + TS, Y); g.lineTo(X + TS, Y + TS); } }
  g.stroke(); g.shadowBlur = 0;
  // car
  g.save(); g.translate(CAR.x, CAR.y); g.fillStyle = '#7a0f2a'; g.fillRect(-36, -16, 72, 32); g.fillStyle = '#16f4ff55'; g.fillRect(-10, -13, 22, 26); g.fillStyle = '#ff2a8a'; g.fillRect(-36, -16, 72, 3); g.restore();
  if (S.clear && !S.won) { const b = 0.5 + 0.5 * Math.sin(t * 8); g.strokeStyle = `rgba(255,225,77,${b})`; g.lineWidth = 3; g.strokeRect(CAR.x - 42, CAR.y - 22, 84, 44); }
  // items
  for (const it of S.items) { g.save(); g.translate(it.x, it.y); g.rotate(it.spin); g.imageSmoothingEnabled = false; const im = imgs[it.type === 'gun' ? 'm16' : 'baseball-bat'];
    if (im.complete && im.naturalWidth) g.drawImage(im, -14, -14, 28, 28); else { g.fillStyle = it.type === 'gun' ? '#ddd' : '#c8955a'; g.fillRect(-12, -2, 24, 4); }
    if (it.fly <= 0) { g.strokeStyle = PAL.yel; g.globalAlpha = 0.4 + 0.3 * Math.sin(t * 6); g.strokeRect(-15, -15, 30, 30); } g.restore(); }
  for (const e of S.en) if (e.dead) drawGuy(e, '#e8e8e8', '#e0b48a', true);
  if (S.p.dead) drawGuy(S.p, '#2a6cff', '#e0b48a', true);
  for (const e of S.en) if (!e.dead) { drawGuy(e, e.stun > 0 ? '#9a9a9a' : '#f2f2f2', '#e0b48a', false, null, e.w, e.swing); if (e.stun > 0) txt('Z', e.x + 10, e.y - 16, 8, PAL.cyan); }
  for (const q of S.smears) { g.save(); g.translate(q.x, q.y); g.scale(q.sx, 1); drawEmblem(0, 0, 30, 0.3 * (1 - q.t / 1.6) * Math.max(S.embA, 0.3), q.rot); g.restore(); }
  if (!S.p.dead && S.embA > 0.01) drawEmblem(S.p.x, S.p.y, 34 * (1 + 0.05 * Math.sin(S.t * 5)), S.embA * (S.pwOn > 0 ? pwFade() * 0.35 + 0.6 : 0.95), 0);
  if (S.pwOn > 0 && !S.p.dead) drawAura();
  if (!S.p.dead && !(S.inv > 0 && Math.floor(S.t * 20) % 2)) drawGuy(S.p, S.pwOn > 0 ? `hsl(${(S.t * 240) % 360},100%,65%)` : '#ff4fa3', '#e0b48a', false, imgs[S.mask.id], S.p.wpn, S.p.swing);
  g.fillStyle = PAL.yel; for (const b of S.bullets) g.fillRect(b.x - 2, b.y - 2, 4, 4);
  for (const q of S.parts) { g.fillStyle = q.spark ? PAL.yel : PAL.blood; g.fillRect(q.x, q.y, 3, 3); }
  for (const q of S.pops) { const a = 1 - q.t / 1.2; g.globalAlpha = a; txt(q.txt, q.x, q.y - q.t * 30, q.big ? 12 : 9, q.col); g.globalAlpha = 1; }
  // car arrow
  if (S.clear && !S.won && dist(S.p, CAR) > 120) { const a = Math.atan2(CAR.y - S.p.y, CAR.x - S.p.x); g.save(); g.translate(S.p.x + Math.cos(a) * 40, S.p.y + Math.sin(a) * 40); g.rotate(a); g.fillStyle = PAL.yel; g.beginPath(); g.moveTo(10, 0); g.lineTo(-6, -7); g.lineTo(-6, 7); g.fill(); g.restore(); }
  g.restore();
  // HUD
  const hs = Math.max(10, Math.min(16, W / 60));
  const sx = isTouch ? W / 2 : W - 16, sa = isTouch ? 'center' : 'right', sy = isTouch ? 36 : 54, ss = isTouch ? Math.min(hs * 1.4, (W - 250) / 10) : hs * 1.4;
  txt(String(S.score).padStart(6, '0') + 'pts', sx, sy, ss, PAL.yel, sa, PAL.pink);
  if (S.combo >= 2 && S.t - S.comboT < 2.6) txt('COMBO x' + S.combo, sx, sy + hs * 2.2, hs, PAL.cyan, sa);
  txt(`${S.mask.name}  ${S.p.wpn ? S.p.wpn.toUpperCase() + (S.p.wpn === 'gun' ? ' ' + S.p.ammo : '') : 'FISTS'}`, 16, H - 24, hs * 0.8, '#fff', 'left', PAL.vio);
  txt(`ENEMIES ${S.en.filter(e => !e.dead).length}`, 16, 56, hs * 0.8, PAL.pink, 'left');
  if (S.pwOn > 0) { const f = pwFade(), hue = (S.t * 240) % 360, gr = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
    gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, `hsla(${hue},100%,55%,${0.32 * f})`); g.fillStyle = gr; g.fillRect(0, 0, W, H);
    g.fillStyle = `hsla(${hue},100%,65%,${f})`; g.fillRect(0, 0, W * S.pwOn / PW_DUR, 5); }
  if (S.dil > 0) { g.fillStyle = `rgba(255,255,255,${S.dil * 0.5})`; g.fillRect(0, 0, W, H); }
  drawPowerHUD(hs);
  if (S.clear && !S.won) { const s = 1 + 0.08 * Math.sin(S.t * 10); g.save(); g.translate(W / 2, H * 0.22); g.scale(s, s); g.rotate(-0.05); txt('GO TO CAR', 0, 0, Math.min(40, W / 14), PAL.yel, 'center', PAL.pink); g.restore(); }
  if (S.p.dead) { g.fillStyle = 'rgba(80,0,20,.35)'; g.fillRect(0, 0, W, H); const s = 1 + 0.05 * Math.sin(S.t * 8); g.save(); g.translate(W / 2, H / 2); g.scale(s, s); txt("YOU'RE DEAD", 0, -30, Math.min(34, W / 16), PAL.pink, 'center', '#000'); txt(isTouch ? 'TAP R TO RESTART' : 'PRESS R TO RESTART', 0, 24, Math.min(18, W / 30), PAL.yel); g.restore(); }
  if (mode === 'results') renderResults();
  if (mode === 'paused') renderPause();
}
let pauseBoxes = [];
function pauseHit(x, y) { const b = pauseBoxes.find(b => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h); if (b) b.fn(); }
function renderPause() {
  g.fillStyle = 'rgba(11,2,22,.82)'; g.fillRect(0, 0, W, H);
  const fs = Math.min(34, W / 12); txt('PAUSED', W / 2, H * 0.22, fs, PAL.pink, 'center', PAL.cyan);
  const items = [['RESUME', resume, isTouch ? '' : ' [ESC]'], ['RESTART', newRun, isTouch ? '' : ' [R]'], ['QUIT TO MASKS', quitToSelect, isTouch ? '' : ' [Q]']];
  const bw = Math.min(320, W - 40), bh = Math.max(46, Math.min(58, H / 9)); pauseBoxes = [];
  items.forEach(([label, fn, key], i) => { const x = W / 2 - bw / 2, y = H * 0.34 + i * (bh + 14); pauseBoxes.push({ x, y, w: bw, h: bh, fn });
    g.fillStyle = i ? '#1a0330' : '#2a0646'; g.fillRect(x, y, bw, bh); g.strokeStyle = i ? PAL.vio : PAL.yel; g.lineWidth = 3; g.strokeRect(x, y, bw, bh);
    txt(label + key, W / 2, y + bh / 2, Math.min(14, bw / 20), i ? '#fff' : PAL.yel); });
}
let selBoxes = [];
function selectHit(x, y) { return selBoxes.findIndex(b => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h); }
function renderSelect() {
  const t = performance.now() / 1000, sz = Math.min(W, H);
  txt('NIGHT CALL', W / 2, H * 0.12, Math.min(42, W / 12), PAL.pink, 'center', PAL.cyan);
  txt('CHOOSE YOUR MASK', W / 2, H * 0.12 + Math.min(42, W / 12) + 8, Math.min(14, W / 32), PAL.yel);
  const n = 3, cw = Math.min(200, (W - 60) / 3), ch = Math.min(cw * 1.35, H * 0.55), gap = 14, x0 = W / 2 - (n * cw + (n - 1) * gap) / 2, y0 = H * 0.27;
  selBoxes = [];
  MASKS.forEach((m, i) => {
    const x = x0 + i * (cw + gap), y = y0 + (i === maskSel ? -8 + Math.sin(t * 4) * 3 : 0); selBoxes.push({ x, y, w: cw, h: ch });
    g.fillStyle = i === maskSel ? '#2a0646' : '#140322'; g.fillRect(x, y, cw, ch);
    g.strokeStyle = i === maskSel ? PAL.yel : PAL.vio; g.lineWidth = i === maskSel ? 4 : 2; g.shadowColor = g.strokeStyle; g.shadowBlur = i === maskSel ? 16 : 0; g.strokeRect(x, y, cw, ch); g.shadowBlur = 0;
    const im = imgs[m.id], s = Math.min(cw * 0.8, ch * 0.55); g.imageSmoothingEnabled = false;
    if (im.complete && im.naturalWidth) g.drawImage(im, x + cw / 2 - s / 2, y + 8, s, s);
    txt(m.name, x + cw / 2, y + ch * 0.72, Math.max(8, cw / 14), i === maskSel ? PAL.yel : '#fff');
    g.font = `${Math.max(6, cw / 26)}px "Press Start 2P"`; g.fillStyle = PAL.cyan; g.textAlign = 'center'; g.fillText(m.perk, x + cw / 2, y + ch * 0.86, cw - 10);
  });
  txt(isTouch ? 'TAP A MASK, TAP AGAIN TO START' : '1-3 / CLICK TO PICK - ENTER TO START', W / 2, y0 + ch + 34, Math.min(11, W / 50), '#fff');
  txt(isTouch ? 'LEFT: MOVE  RIGHT: AIM+ATTACK  THROW BTN' : 'WASD MOVE - MOUSE AIM - CLICK ATTACK - RMB/SPACE THROW/PICK UP - Q POWER - P PAUSE - R RESTART', W / 2, y0 + ch + 58, Math.min(9, W / 80), PAL.vio, 'center');
  if (best) txt(`BEST ${best}pts  ${bestGrade}`, W / 2, H - 30, Math.min(11, W / 50), PAL.yel);
}
function renderResults() {
  g.fillStyle = 'rgba(11,2,22,.86)'; g.fillRect(0, 0, W, H);
  const s = Math.min(1, W / 700), cx = W / 2; let y = H * 0.16;
  txt('LEVEL COMPLETE', cx, y, 30 * s + 8, PAL.pink, 'center', PAL.cyan); y += 60 * s + 10;
  const rows = [['KILLS', S.kills], ['MAX COMBO', 'x' + S.maxCombo], ['TIME', S.endT.toFixed(1) + 's'], ['SCORE', S.score], ['TIME BONUS', '+' + S.timeBonus], ['TOTAL', S.final + 'pts']];
  for (const [k, v] of rows) { txt(k, cx - 20, y, 12 * s + 4, '#fff', 'right'); txt(String(v), cx + 20, y, 12 * s + 4, PAL.yel, 'left'); y += 26 * s + 8; }
  const gs = 1 + 0.06 * Math.sin(performance.now() / 120); g.save(); g.translate(cx, y + 40 * s); g.scale(gs, gs); g.rotate(-0.1); txt(S.grade, 0, 0, 64 * s + 16, PAL.yel, 'center', PAL.pink); g.restore();
  y += 100 * s + 20; txt(S.test ? 'TEST MODE - SCORE NOT SAVED' : S.newBest ? 'NEW BEST!' : `BEST ${best}pts ${bestGrade}`, cx, y, 12 * s + 4, S.newBest ? PAL.cyan : '#fff');
  txt(isTouch ? 'TAP TO PLAY AGAIN' : 'PRESS R / CLICK TO PLAY AGAIN - M FOR MASKS', cx, y + 34, 9 * s + 3, PAL.vio);
}
function resize() { DPR = Math.min(devicePixelRatio || 1, 2); W = innerWidth; H = innerHeight; cv.width = W * DPR; cv.height = H * DPR; zoom = Math.min(W, H) < 520 ? Math.max(1.35, Math.min(1.9, Math.max(W, H) / 560)) : Math.max(1, Math.min(2.2, Math.min(W, H) / 400)); }
setModeClass();
addEventListener('resize', resize); resize();
let last = performance.now();
const GOD = new URLSearchParams(location.search).get('god') === '1'; // test-only invulnerability
const TSCALE = Math.max(0.05, Math.min(1, +new URLSearchParams(location.search).get('ts') || 1)); // ?ts=0.25 slow-mo (used by automated tests)
function loop(now) {
  const dt = Math.min(0.033, (now - last) / 1000); last = now;
  if ((mode === 'play' || mode === 'results') && S) { let d = dt * TSCALE; if (S.dil > 0) { S.dil -= dt; d *= 0.3; } update(d); }
  render(); requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
// test hook (read-only state + dt override for headless verification)
window.NC = { touchMode: () => isTouch, state: () => S && ({ mode, test: S.test, pw: S.pw, pwOn: S.pwOn, hp: S.hp, inv: S.inv, reach: reach(), speed: pspeed(), p: { x: S.p.x, y: S.p.y, a: S.p.a, dead: S.p.dead, wpn: S.p.wpn, ammo: S.p.ammo }, en: S.en.map(e => ({ x: e.x, y: e.y, dead: e.dead, stun: e.stun, st: e.st, w: e.w })), items: S.items.map(i => ({ x: i.x, y: i.y, type: i.type })), score: S.score, kills: S.kills, clear: S.clear, won: S.won, grade: S.grade, final: S.final, maxCombo: S.maxCombo, car: CAR, zoom, cam: S.cam }), mode: () => mode, best: () => best };
})();
