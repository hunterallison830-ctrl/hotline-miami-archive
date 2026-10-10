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
  { id: 'richard', name: 'RICHARD', perk: 'NO PERK. PURE SKILL.', img: 'img/m/richard.png', mult: 1.25 },
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
function newRun() {
  const m = MASKS[maskSel];
  S = {
    mask: m, t: 0, p: { x: CAR.x + 40, y: CAR.y - 4, a: -Math.PI / 2, wpn: m.id === 'tony' ? null : 'bat', ammo: 0, dead: false, swing: 0, cd: 0, r: 10 },
    en: ENEMY_DEFS.map(([tx, ty, w, path]) => ({ ...T(tx, ty), a: 0, w, path: path.map(([a, b]) => T(a, b)), pi: 0, st: 'patrol', stun: 0, seen: 0, cd: 0, last: null, r: 10, dead: false, swing: 0 })),
    items: [], bullets: [], decals: [], pops: [], parts: [],
    score: 0, kills: 0, combo: 0, comboT: 0, maxCombo: 0, shake: 0, clear: false, won: false, endT: 0, cam: { x: CAR.x, y: CAR.y },
  };
  mode = 'play';
}
// ---------- input ----------
addEventListener('keydown', e => {
  const k = e.key.toLowerCase(); keys.add(k);
  if (mode === 'select') { if (['1', '2', '3'].includes(k)) maskSel = +k - 1; if (k === 'arrowleft' || k === 'a') maskSel = (maskSel + 2) % 3; if (k === 'arrowright' || k === 'd') maskSel = (maskSel + 1) % 3; if (k === 'enter' || k === ' ') { newRun(); e.preventDefault(); } return; }
  if (k === 'r') { newRun(); }
  if (k === 'escape' || k === 'm') { mode = 'select'; }
  if (k === ' ' || k === 'e') { if (mode === 'play') throwOrPick(); e.preventDefault(); }
  if (mode === 'results' && k === 'enter') newRun();
});
addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));
addEventListener('blur', () => { keys.clear(); mouse.down = false; });
cv.addEventListener('mousemove', e => { mouse.x = e.clientX; mouse.y = e.clientY; });
cv.addEventListener('mousedown', e => {
  mouse.x = e.clientX; mouse.y = e.clientY;
  if (mode === 'select') { const i = selectHit(e.clientX, e.clientY); if (i >= 0) { if (i === maskSel) newRun(); else maskSel = i; } return; }
  if (mode === 'results') { newRun(); return; }
  if (e.button === 2) { throwOrPick(); return; }
  mouse.down = true;
});
addEventListener('mouseup', () => { mouse.down = false; });
cv.addEventListener('contextmenu', e => e.preventDefault());
// twin-stick touch
const tl = document.getElementById('touch');
const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
if (isTouch) document.body.classList.add('is-touch');
tl.addEventListener('touchstart', e => {
  if (e.target.closest('.tbtn')) return; e.preventDefault();
  for (const t of e.changedTouches) {
    if (mode === 'select') { const i = selectHit(t.clientX, t.clientY); if (i >= 0) { if (i === maskSel) newRun(); else maskSel = i; } return; }
    if (mode === 'results') { newRun(); return; }
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
document.getElementById('tThrow').addEventListener('touchstart', e => { e.preventDefault(); if (mode === 'play') throwOrPick(); }, { passive: false });
document.getElementById('tR').addEventListener('touchstart', e => { e.preventDefault(); if (mode === 'select') newRun(); else newRun(); }, { passive: false });
// ---------- helpers ----------
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const angDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
function los(a, b) { const d = dist(a, b), n = Math.ceil(d / 8); for (let i = 1; i < n; i++) { const t = i / n; if (solidAt(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t)) return false; } return true; }
function moveC(o, dx, dy) {
  const r = o.r - 1;
  const hit = (x, y) => solidAt(x - r, y - r) || solidAt(x + r, y - r) || solidAt(x - r, y + r) || solidAt(x + r, y + r);
  if (!hit(o.x + dx, o.y)) o.x += dx; if (!hit(o.x, o.y + dy)) o.y += dy;
}
function pop(x, y, txt, col, big) { S.pops.push({ x, y, txt, col, t: 0, big }); }
function splat(x, y, a) { for (let i = 0; i < 14; i++) { const s = 2 + Math.random() * 5, d = Math.random() * 26; S.decals.push({ x: x + Math.cos(a + (Math.random() - .5)) * d, y: y + Math.sin(a + (Math.random() - .5)) * d, s }); } for (let i = 0; i < 10; i++) S.parts.push({ x, y, vx: Math.cos(a + (Math.random() - .5) * 1.5) * (80 + Math.random() * 160), vy: Math.sin(a + (Math.random() - .5) * 1.5) * (80 + Math.random() * 160), t: 0 }); }
function killEnemy(e, a, how) {
  if (e.dead) return; e.dead = true; e.a = a; S.kills++;
  if (e.w) S.items.push({ x: e.x, y: e.y, type: e.w, ammo: e.w === 'gun' ? 8 : 0, vx: 0, vy: 0, fly: 0, spin: Math.random() * 6 });
  e.w = null; splat(e.x, e.y, a); S.shake = Math.min(14, S.shake + 7);
  S.combo = S.t - S.comboT < 2.6 ? S.combo + 1 : 1; S.comboT = S.t; S.maxCombo = Math.max(S.maxCombo, S.combo);
  const pts = Math.round((how === 'gun' ? 300 : how === 'exec' ? 600 : 500) * S.combo * S.mask.mult);
  S.score += pts; pop(e.x, e.y - 18, '+' + pts + 'pts', PAL.yel);
  if (S.combo >= 2) pop(e.x, e.y - 40, 'COMBO x' + S.combo, PAL.cyan, true);
  if (S.en.every(x => x.dead) && !S.clear) { S.clear = true; S.clearT = S.t; S.shake = 18; }
}
function killPlayer(a) { if (S.p.dead || S.won || GOD) return; S.p.dead = true; S.p.a = a; splat(S.p.x, S.p.y, a); S.shake = 18; S.endT = S.t; }
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
    if (e.dead) continue; const d = dist(e, p); if (d > (p.wpn ? 40 : 30)) continue;
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
  // input -> movement & aim
  let mx = (keys.has('d') || keys.has('arrowright') ? 1 : 0) - (keys.has('a') || keys.has('arrowleft') ? 1 : 0);
  let my = (keys.has('s') || keys.has('arrowdown') ? 1 : 0) - (keys.has('w') || keys.has('arrowup') ? 1 : 0);
  if (touch.move) { const dx = touch.move.cx - touch.move.x, dy = touch.move.cy - touch.move.y, l = Math.hypot(dx, dy); if (l > 8) { mx = dx / Math.max(l, 50); my = dy / Math.max(l, 50); } }
  const ml = Math.hypot(mx, my); if (ml > 1) { mx /= ml; my /= ml; }
  if (!p.dead && !S.won) {
    const sp = S.mask.id === 'rasmus' ? 215 : 172; moveC(p, mx * sp * dt, my * sp * dt);
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
  S.newBest = S.final > best; if (S.newBest) { best = S.final; bestGrade = S.grade; try { localStorage.setItem('hm_nightcall_best', best); localStorage.setItem('hm_nightcall_grade', bestGrade); } catch (e) {} }
  setTimeout(() => { if (S.won) mode = 'results'; }, 900);
}
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
  if (!S.p.dead) drawGuy(S.p, '#ff4fa3', '#e0b48a', false, imgs[S.mask.id], S.p.wpn, S.p.swing);
  g.fillStyle = PAL.yel; for (const b of S.bullets) g.fillRect(b.x - 2, b.y - 2, 4, 4);
  for (const q of S.parts) { g.fillStyle = q.spark ? PAL.yel : PAL.blood; g.fillRect(q.x, q.y, 3, 3); }
  for (const q of S.pops) { const a = 1 - q.t / 1.2; g.globalAlpha = a; txt(q.txt, q.x, q.y - q.t * 30, q.big ? 12 : 9, q.col); g.globalAlpha = 1; }
  // car arrow
  if (S.clear && !S.won && dist(S.p, CAR) > 120) { const a = Math.atan2(CAR.y - S.p.y, CAR.x - S.p.x); g.save(); g.translate(S.p.x + Math.cos(a) * 40, S.p.y + Math.sin(a) * 40); g.rotate(a); g.fillStyle = PAL.yel; g.beginPath(); g.moveTo(10, 0); g.lineTo(-6, -7); g.lineTo(-6, 7); g.fill(); g.restore(); }
  g.restore();
  // HUD
  const hs = Math.max(10, Math.min(16, W / 60));
  txt(String(S.score).padStart(6, '0') + 'pts', W - 16, 54, hs * 1.4, PAL.yel, 'right', PAL.pink);
  if (S.combo >= 2 && S.t - S.comboT < 2.6) txt('COMBO x' + S.combo, W - 16, 54 + hs * 2.2, hs, PAL.cyan, 'right');
  txt(`${S.mask.name}  ${S.p.wpn ? S.p.wpn.toUpperCase() + (S.p.wpn === 'gun' ? ' ' + S.p.ammo : '') : 'FISTS'}`, 16, H - 24, hs * 0.8, '#fff', 'left', PAL.vio);
  txt(`ENEMIES ${S.en.filter(e => !e.dead).length}`, 16, 56, hs * 0.8, PAL.pink, 'left');
  if (S.clear && !S.won) { const s = 1 + 0.08 * Math.sin(S.t * 10); g.save(); g.translate(W / 2, H * 0.22); g.scale(s, s); g.rotate(-0.05); txt('GO TO CAR', 0, 0, Math.min(40, W / 14), PAL.yel, 'center', PAL.pink); g.restore(); }
  if (S.p.dead) { g.fillStyle = 'rgba(80,0,20,.35)'; g.fillRect(0, 0, W, H); const s = 1 + 0.05 * Math.sin(S.t * 8); g.save(); g.translate(W / 2, H / 2); g.scale(s, s); txt("YOU'RE DEAD", 0, -30, Math.min(34, W / 16), PAL.pink, 'center', '#000'); txt(isTouch ? 'TAP R TO RESTART' : 'PRESS R TO RESTART', 0, 24, Math.min(18, W / 30), PAL.yel); g.restore(); }
  if (mode === 'results') renderResults();
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
  txt(isTouch ? 'LEFT: MOVE  RIGHT: AIM+ATTACK  THROW BTN' : 'WASD MOVE - MOUSE AIM - CLICK ATTACK - RMB/SPACE THROW/PICK UP - R RESTART', W / 2, y0 + ch + 58, Math.min(9, W / 80), PAL.vio, 'center');
  if (best) txt(`BEST ${best}pts  ${bestGrade}`, W / 2, H - 30, Math.min(11, W / 50), PAL.yel);
}
function renderResults() {
  g.fillStyle = 'rgba(11,2,22,.86)'; g.fillRect(0, 0, W, H);
  const s = Math.min(1, W / 700), cx = W / 2; let y = H * 0.16;
  txt('LEVEL COMPLETE', cx, y, 30 * s + 8, PAL.pink, 'center', PAL.cyan); y += 60 * s + 10;
  const rows = [['KILLS', S.kills], ['MAX COMBO', 'x' + S.maxCombo], ['TIME', S.endT.toFixed(1) + 's'], ['SCORE', S.score], ['TIME BONUS', '+' + S.timeBonus], ['TOTAL', S.final + 'pts']];
  for (const [k, v] of rows) { txt(k, cx - 20, y, 12 * s + 4, '#fff', 'right'); txt(String(v), cx + 20, y, 12 * s + 4, PAL.yel, 'left'); y += 26 * s + 8; }
  const gs = 1 + 0.06 * Math.sin(performance.now() / 120); g.save(); g.translate(cx, y + 40 * s); g.scale(gs, gs); g.rotate(-0.1); txt(S.grade, 0, 0, 64 * s + 16, PAL.yel, 'center', PAL.pink); g.restore();
  y += 100 * s + 20; txt(S.newBest ? 'NEW BEST!' : `BEST ${best}pts ${bestGrade}`, cx, y, 12 * s + 4, S.newBest ? PAL.cyan : '#fff');
  txt(isTouch ? 'TAP TO PLAY AGAIN' : 'PRESS R / CLICK TO PLAY AGAIN - M FOR MASKS', cx, y + 34, 9 * s + 3, PAL.vio);
}
function resize() { DPR = Math.min(devicePixelRatio || 1, 2); W = innerWidth; H = innerHeight; cv.width = W * DPR; cv.height = H * DPR; zoom = Math.max(1, Math.min(2.2, Math.min(W, H) / 400)); }
addEventListener('resize', resize); resize();
let last = performance.now();
const GOD = new URLSearchParams(location.search).get('god') === '1'; // test-only invulnerability
const TSCALE = Math.max(0.05, Math.min(1, +new URLSearchParams(location.search).get('ts') || 1)); // ?ts=0.25 slow-mo (used by automated tests)
function loop(now) {
  const dt = Math.min(0.033, (now - last) / 1000); last = now;
  if (mode !== 'select' && S) update(dt * TSCALE);
  render(); requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
// test hook (read-only state + dt override for headless verification)
window.NC = { state: () => S && ({ mode, p: { x: S.p.x, y: S.p.y, a: S.p.a, dead: S.p.dead, wpn: S.p.wpn, ammo: S.p.ammo }, en: S.en.map(e => ({ x: e.x, y: e.y, dead: e.dead, stun: e.stun, st: e.st, w: e.w })), items: S.items.map(i => ({ x: i.x, y: i.y, type: i.type })), score: S.score, kills: S.kills, clear: S.clear, won: S.won, grade: S.grade, final: S.final, maxCombo: S.maxCombo, car: CAR, zoom, cam: S.cam }), mode: () => mode, best: () => best };
})();
