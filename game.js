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
const SPAWN_TILES = [];
const FLOOR = []; for (let y = 0; y < MAP.length; y++) for (let x = 0; x < MAP[0].length; x++) if (MAP[y][x] !== '#') FLOOR.push([x, y]);
const wall = (tx, ty) => tx < 0 || ty < 0 || tx >= MW || ty >= MH || MAP[ty][tx] === '#';
const solidAt = (x, y) => wall(Math.floor(x / TS), Math.floor(y / TS));
const T = (tx, ty) => ({ x: tx * TS + TS / 2, y: ty * TS + TS / 2 });
const CAR = T(4, 15.5), BOX = { x: CAR.x - 24, y: CAR.y };
const MASKS = [
  { id: 'richard', name: 'RICHARD', perk: 'NO PERK. +25% SCORE', img: 'img/m/richard.png', mult: 1.25 },
  { id: 'tony', name: 'TONY', perk: 'FISTS ARE LETHAL', img: 'img/m/tony.png', mult: 1 },
  { id: 'rasmus', name: 'RASMUS', perk: 'MOVE 25% FASTER', img: 'img/m/rasmus.png', mult: 1 },
];
const imgs = {}; for (const m of MASKS) { const i = new Image(); i.src = m.img; imgs[m.id] = i; }
for (const w of ['baseball-bat', 'm16', 'shotgun', 'crowbar']) { const i = new Image(); i.src = 'img/w/' + w + '.png'; imgs[w] = i; }
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
let resAt = 0, resBoxes = []; const resReady = () => performance.now() - resAt > 1000;
const keys = new Set(), mouse = { x: 0, y: 0, down: false };
const touch = { on: false, move: null, aim: null, mv: { x: 0, y: 0 }, av: { x: 0, y: 0 }, fire: false };
const QS = new URLSearchParams(location.search), DBG_PW = QS.get('pw') === '1';
let gameMode = QS.get('mode') === 'waves' || QS.get('wave') ? 'waves' : 'story', dbgWave = Math.max(0, Math.min(6, +QS.get('wave') || 0)); // ?wave=N (6 = boss) test jump, used once
const WAVES = 5, BOSS_WAVE = 6;
let waveBest = +localStorage.getItem('hm_nightcall_wave_best') || 0, waveBestGrade = localStorage.getItem('hm_nightcall_wave_grade') || '';
const SPAWNS = []; // doors + corridor ends
const WAVE_DBG_TEST = !!QS.get('wave');
{ const seen = new Set(), add = (x, y) => { const k = x + ',' + y; if (seen.has(k) || MAP[y]?.[x] !== '.') return; for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) if (MAP[y + dy]?.[x + dx] !== '.') return; seen.add(k); SPAWNS.push(T(x, y)); };
  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) if (MAP[y][x] === 'D') for (const [dx, dy] of [[2, 0], [-2, 0], [0, 2], [0, -2], [3, 0], [-3, 0], [0, 3], [0, -3]]) add(x + dx, y + dy);
  add(2, 15); add(37, 15); add(2, 16); add(37, 16); } // test-only: start with a full meter
const PW_DUR = 15, PW_PER_COMBO = 1 / 15; // 1+2+3+4+5 = 15 combo-steps fills it
const _g = {}; const gapOK = (k, ms) => { const n = performance.now(); if (n - (_g[k] || 0) < ms) return false; _g[k] = n; return true; };
const au = (n, ...a) => window.NCA && NCA.sfx(n, ...a);
// melee weapons: cd = swing cooldown, reach in px, boss = damage per hit
const WPN = { bat: { cd: 0.32, reach: 44, boss: 2, name: 'BAT' }, crowbar: { cd: 0.24, reach: 42, boss: 2, name: 'CROWBAR' }, saber: { cd: 0.27, reach: 53, boss: 3, name: 'LIGHTSABER', deflect: 0.25 } };
const WNAME = w => w ? (WPN[w] ? WPN[w].name : w.toUpperCase()) : 'FISTS';
const BOX_POOL = ['crowbar', 'bat', 'saber'];
const reach = () => (WPN[S.p.wpn] ? WPN[S.p.wpn].reach : S.p.wpn ? 44 : 33) * (S.pwOn > 0 ? 1.3 : 1);   // ~+10% base melee reach, +30% powered
const pspeed = () => (S.mask.id === 'rasmus' ? 215 : 172) * (S.pwOn > 0 ? 1.25 : 1);
function activatePower() {
  if (!S || mode !== 'play' || S.p.dead || S.won || S.pwOn > 0 || S.pw < 1) return;
  S.pwOn = PW_DUR; S.hp = 2; S.dil = 0.6; S.shake = 16; au('power'); pop(S.p.x, S.p.y - 34, 'POWER UP!', '#fff', true);
}
function newRun() {
  const m = MASKS[maskSel];
  S = {
    mask: m, t: 0, p: { x: CAR.x + 40, y: CAR.y - 4, a: -Math.PI / 2, wpn: m.id === 'tony' ? null : 'bat', ammo: 0, dead: false, swing: 0, cd: 0, r: 10 },
    en: gameMode === 'story' ? ENEMY_DEFS.map(([tx, ty, w, path]) => mkEnemy(T(tx, ty), w, path.map(([a, b]) => T(a, b)))) : [],
    grace: 3, start: { x: CAR.x + 40, y: CAR.y - 4 }, gm: gameMode, box: { st: 'closed', t: 0, k: 0, show: 'bat', res: null, next: 0, landT: 0 }, wave: 0, waveT: 0, boss: null, wkills: 0, adds: 0,
    items: [], bullets: [], decals: [], pops: [], parts: [],
    pw: DBG_PW ? 1 : 0, embA: 0, smears: [], lastSm: null, pwOn: 0, hp: 0, inv: 0, dil: 0, trail: [], aura: [], score: 0, kills: 0, combo: 0, comboT: 0, maxCombo: 0, shake: 0, clear: false, won: false, endT: 0, cam: { x: CAR.x, y: CAR.y },
  };
  mode = 'play'; setModeClass(); rArm = -1e9; if (window.NCA) { NCA.track(gameMode === 'waves' ? 'play' : 'play', gameMode === 'waves' ? 0.45 : 0.6); NCA.duck(1); }
  if (gameMode === 'waves') { const w0 = dbgWave || 1; dbgWave = 0; S.dbg = WAVE_DBG_TEST; startWave(w0); }
}
function mkEnemy(pos, w, path, o = {}) { return { x: pos.x, y: pos.y, a: Math.random() * 6.28, w, path: path || [pos], pi: 0, st: 'patrol', stun: 0, seen: 0, cd: 0, last: null, r: 10, dead: false, swing: 0, vx: 0, vy: 0, stall: 0, inT: 0, spd: 1, react: 0.45, smart: 0, nav: null, navT: 0, ...o }; }
function fits(x, y, r) { r -= 1; return !(solidAt(x - r, y - r) || solidAt(x + r, y - r) || solidAt(x - r, y + r) || solidAt(x + r, y + r)); }
function validSpot(at, r = 10) { for (let k = 0; k < 12; k++) { const x = at.x + (k ? (Math.random() - .5) * 16 : 0), y = at.y + (k ? (Math.random() - .5) * 16 : 0); if (fits(x, y, r)) return { x, y }; } return { x: at.x, y: at.y }; }
// shared flow field (BFS distance from the player's tile), rebuilt every 0.3s; enemies step down the gradient
const FF = new Int16Array(MW * MH); let ffT = 0, ffTile = -1;
function buildFlow(px, py) { FF.fill(-1); const sx = Math.floor(px / TS), sy = Math.floor(py / TS); if (wall(sx, sy)) return; const q = [sy * MW + sx]; FF[q[0]] = 0;
  for (let h = 0; h < q.length; h++) { const c = q[h], cx = c % MW, cy = (c / MW) | 0; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = cx + dx, ny = cy + dy; if (wall(nx, ny)) continue; const n = ny * MW + nx; if (FF[n] !== -1) continue; FF[n] = FF[c] + 1; q.push(n); } } }
function flowTarget(e) { // look ahead along the field and string-pull to the farthest tile still in clear sight
  let cx = Math.floor(e.x / TS), cy = Math.floor(e.y / TS); if (FF[cy * MW + cx] < 0) return null; let best = null;
  for (let step = 0; step < 4; step++) { let nb = null, nd = FF[cy * MW + cx];
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) { const nx = cx + dx, ny = cy + dy; if (wall(nx, ny) || (dx && dy && (wall(cx + dx, cy) || wall(cx, cy + dy)))) continue; const d = FF[ny * MW + nx]; if (d >= 0 && d < nd) { nd = d; nb = [nx, ny]; } }
    if (!nb) break; cx = nb[0]; cy = nb[1]; const c = T(cx, cy); if (step === 0 || clearPath(e, c, e.r)) best = c; else break; }
  return best; }
function clearPath(a, b, r) { const d = dist(a, b), n = Math.ceil(d / 6); for (let i = 1; i <= n; i++) { const t = i / n; if (!fits(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, r + 1)) return false; } return true; }
// steering: smoothed velocity + separation + wall sliding (moveC is per-axis) + damped heading
function steer(e, tgt, sp, face, dt) {
  let dx = 0, dy = 0;
  if (tgt) { const d = dist(e, tgt); if (d > 2) { const k = Math.min(1, d / 18); dx = (tgt.x - e.x) / d * sp * k; dy = (tgt.y - e.y) / d * sp * k; } }
  for (const o of S.en) { if (o === e || o.dead || o.inT > 0) continue; const ox = e.x - o.x, oy = e.y - o.y, d = Math.hypot(ox, oy); if (d < 24 && d > 0.01) { const f = (24 - d) / 24 * 140; dx += ox / d * f; dy += oy / d * f; } }
  const l = Math.hypot(dx, dy), cap = sp * 1.1; if (l > cap) { dx *= cap / l; dy *= cap / l; }
  const k = 1 - Math.exp(-10 * dt); e.vx += (dx - e.vx) * k; e.vy += (dy - e.vy) * k;
  const ox = e.x, oy = e.y; moveC(e, e.vx * dt, e.vy * dt);
  // wall slide: if an axis was blocked, kill that velocity component so we don't keep pushing into it
  if (Math.abs(e.x - ox) < Math.abs(e.vx * dt) * 0.5) e.vx *= 0.2; if (Math.abs(e.y - oy) < Math.abs(e.vy * dt) * 0.5) e.vy *= 0.2;
  // stall detector -> force a fresh route
  e.stall = Math.hypot(e.x - ox, e.y - oy) < sp * dt * 0.15 && tgt ? (e.stall || 0) + dt : 0; if (e.stall > 0.6) { e.nav = null; e.navT = 0; e.stall = 0; if (!fits(e.x, e.y, e.r)) Object.assign(e, validSpot(SPAWNS[0])); }
  const want = face != null ? face : Math.hypot(e.vx, e.vy) > 12 ? Math.atan2(e.vy, e.vx) : e.a;
  e.a += angDiff(want, e.a) * (1 - Math.exp(-(face != null ? 16 : 9) * dt));
}
function farSpawns(minD) { const p = S.p; const c = SPAWNS.filter(q => Math.hypot(q.x - p.x, q.y - p.y) > minD); return c.length ? c : SPAWNS; }
function startWave(n) {
  S.wave = n; S.waveT = 0; S.wkills = 0;
  if (n >= BOSS_WAVE) { spawnBoss(); pop(S.p.x, S.p.y - 40, 'BOSS!', PAL.pink, true); S.shake = 20; return; }
  const count = 4 + n * 2, guns = 0.15 + n * 0.1, spd = 1 + n * 0.08, react = Math.max(0.2, 0.5 - n * 0.06), smart = Math.min(0.9, 0.1 + n * 0.18);
  const sp = farSpawns(260);
  for (let i = 0; i < count; i++) {
    const at = sp[i % sp.length], pos = validSpot(at);
    const tgt = FLOOR[(Math.random() * FLOOR.length) | 0];
    const e = mkEnemy(pos, Math.random() < guns ? 'gun' : 'bat', [pos, T(tgt[0], tgt[1])], { spd, react, smart, inT: 0.35 * Math.floor(i / sp.length) + Math.random() * 0.2 });
    if (Math.random() < smart && S.grace <= 0) { e.st = 'chase'; e.last = { x: S.p.x, y: S.p.y }; }
    S.en.push(e);
  }
  pop(S.p.x, S.p.y - 40, 'WAVE ' + n, PAL.yel, true); S.shake = 10; au('wave'); if (window.NCA) { NCA.track('play', 0.35 + n * 0.13); NCA.duck(1); }
}
// tile BFS for hunters that can't see the player (cheap: 40x18 grid, refreshed every ~0.35s per enemy)
function navNext(e, to) {
  const k = (x, y) => y * MW + x, sx = Math.floor(e.x / TS), sy = Math.floor(e.y / TS), gx = Math.floor(to.x / TS), gy = Math.floor(to.y / TS);
  if (sx === gx && sy === gy) return to;
  const prev = new Int16Array(MW * MH).fill(-1), q = [k(sx, sy)]; prev[k(sx, sy)] = k(sx, sy);
  for (let h = 0; h < q.length; h++) { const c = q[h], cx = c % MW, cy = (c / MW) | 0; if (cx === gx && cy === gy) break;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = cx + dx, ny = cy + dy; if (wall(nx, ny)) continue; const n = k(nx, ny); if (prev[n] !== -1) continue; prev[n] = c; q.push(n); } }
  let c = k(gx, gy); if (prev[c] === -1) return to;
  let guard = 0; while (prev[c] !== k(sx, sy) && guard++ < 999) c = prev[c];
  return T(c % MW, (c / MW) | 0);
}
// ---------- input ----------
addEventListener('keydown', e => {
  const k = e.key.toLowerCase(); keys.add(k);
  if (window.NCA && (k === 'n' || k === '-' || k === '=' || k === '+')) { if (k === 'n') NCA.toggleMute(); else NCA.setVol(NCA.vol + (k === '-' ? -0.1 : 0.1)); updMute(); return; }
  if ((k === 'q' || k === 'shift') && mode === 'play') { activatePower(); e.preventDefault(); return; }
  if (mode === 'select') { if (['1', '2', '3'].includes(k)) maskSel = +k - 1; if (k === 'arrowleft' || k === 'a') maskSel = (maskSel + 2) % 3; if (k === 'arrowright' || k === 'd') maskSel = (maskSel + 1) % 3; if (k === 'enter' || k === ' ') { newRun(); e.preventDefault(); } if (k === 'tab' || k === 'arrowup' || k === 'arrowdown' || k === 'w' || k === 's') { gameMode = gameMode === 'story' ? 'waves' : 'story'; e.preventDefault(); } return; }
  if (mode === 'paused') { if (k === 'escape' || k === 'p' || k === 'enter') resume(); else if (k === 'r') newRun(); else if (k === 'q' || k === 'm') quitToSelect(); return; }
  if (k === 'escape' || k === 'p') { if (mode === 'play') pause(); return; }
  if (k === 'r') { if (mode !== 'results' || resReady()) newRun(); return; }
  if (k === 'e' && mode === 'play' && S && nearBox()) { spinBox(); e.preventDefault(); return; }
  if (k === 'm' && mode === 'results' && resReady()) { quitToSelect(); }
  if (k === ' ' || k === 'e') { if (mode === 'play') throwOrPick(); e.preventDefault(); }
  if (mode === 'results' && (k === 'enter' || k === ' ') && resReady()) newRun();
});
addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));
addEventListener('blur', () => { keys.clear(); mouse.down = false; if (mode === 'play' && S && !S.p.dead && !S.won) pause(); });
function pause() { if (mode !== 'play') return; mode = 'paused'; keys.clear(); mouse.down = false; touch.move = touch.aim = null; setModeClass(); if (window.NCA) { NCA.duck(0.4); NCA.hum(false); } }
function resume() { mode = 'play'; last = performance.now(); setModeClass(); if (window.NCA) NCA.duck(1); }
function quitToSelect() { mode = 'select'; setModeClass(); if (window.NCA) { NCA.track('menu'); NCA.duck(1); NCA.hum(false); } }
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
  if (e.target.closest && e.target.closest('.tbtn,a,button')) return;
  if (mode === 'select') { const i = selectHit(e.clientX, e.clientY); if (i >= 10) gameMode = i === 10 ? 'story' : 'waves'; else if (i >= 0) { if (i === maskSel) newRun(); else maskSel = i; } }
  else if (mode === 'paused') pauseHit(e.clientX, e.clientY);
  else if (mode === 'results') { if (resReady()) { const b = resBoxes.find(b => e.clientX >= b.x && e.clientX <= b.x + b.w && e.clientY >= b.y && e.clientY <= b.y + b.h); if (b) b.fn(); } }
  else return;
  e.preventDefault();
});
const tMute = document.getElementById('tMute');
function updMute() { if (!tMute || !window.NCA) return; tMute.textContent = NCA.muted || NCA.vol === 0 ? '🔇' : '🔊'; tMute.setAttribute('aria-pressed', String(NCA.muted)); }
if (tMute) { tMute.addEventListener('click', e => { e.stopPropagation(); if (window.NCA) { NCA.toggleMute(); updMute(); } }); tMute.addEventListener('pointerdown', e => e.stopPropagation()); setTimeout(updMute, 0); }
function setModeClass() { document.body.dataset.mode = mode; }
tl.addEventListener('touchstart', e => {
  if (e.target.closest('.tbtn')) return; e.preventDefault();
  for (const t of e.changedTouches) {
    if (mode !== 'play') return;
    const sx = Math.max(50, Math.min(innerWidth - 50, t.clientX)), sy = Math.max(50, Math.min(innerHeight - 50, t.clientY)); // stick centre >= 50px from edges
    if (t.clientX < innerWidth / 2) { if (!touch.move) touch.move = { id: t.identifier, x: sx, y: sy, cx: t.clientX, cy: t.clientY }; }
    else if (!touch.aim) touch.aim = { id: t.identifier, x: sx, y: sy, cx: t.clientX, cy: t.clientY };
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
tRb.addEventListener('touchstart', e => { e.preventDefault(); const now = performance.now(); if (mode === 'results' && !resReady()) return;
  if (S && (S.p.dead || S.won) || now - rArm < 2000) { rArm = -1e9; tRb.classList.remove('arm'); tRb.textContent = 'R'; newRun(); return; }
  rArm = now; tRb.classList.add('arm'); tRb.textContent = 'R?'; setTimeout(() => { if (performance.now() - rArm >= 1990) { tRb.classList.remove('arm'); tRb.textContent = 'R'; } }, 2000); }, { passive: false });
document.getElementById('tP').addEventListener('touchstart', e => { e.preventDefault(); if (mode === 'play') pause(); else if (mode === 'paused') resume(); }, { passive: false });
// ---------- helpers ----------
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const angDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
function los(a, b) { const d = dist(a, b), n = Math.ceil(d / 8); for (let i = 1; i < n; i++) { const t = i / n; if (solidAt(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t)) return false; } return true; }
function moveC(o, dx, dy) {
  const r = (o.cr || o.r) - 1;
  const hit = (x, y) => solidAt(x - r, y - r) || solidAt(x + r, y - r) || solidAt(x - r, y + r) || solidAt(x + r, y + r);
  if (!hit(o.x + dx, o.y)) o.x += dx; if (!hit(o.x, o.y + dy)) o.y += dy;
}
function auraP(p, sp) { const a = Math.random() * 6.283, r = 10 + Math.random() * 8; return { x: p.x + Math.cos(a) * r, y: p.y + Math.sin(a) * r, vx: Math.cos(a) * sp * (0.3 + Math.random()), vy: Math.sin(a) * sp * (0.3 + Math.random()) - 30, t: 0, life: 0.35 + Math.random() * 0.4, h: Math.random() * 360 }; }
function pop(x, y, txt, col, big) { S.pops.push({ x, y, txt, col, t: 0, big }); }
function splat(x, y, a) { for (let i = 0; i < 14; i++) { const s = 2 + Math.random() * 5, d = Math.random() * 26; S.decals.push({ x: x + Math.cos(a + (Math.random() - .5)) * d, y: y + Math.sin(a + (Math.random() - .5)) * d, s }); } for (let i = 0; i < 10; i++) S.parts.push({ x, y, vx: Math.cos(a + (Math.random() - .5) * 1.5) * (80 + Math.random() * 160), vy: Math.sin(a + (Math.random() - .5) * 1.5) * (80 + Math.random() * 160), t: 0 }); }
function killEnemy(e, a, how) {
  if (e.dead) return; e.dead = true; e.a = a; S.kills++; S.lastKillT = S.t;
  if (e.w) S.items.push({ x: e.x, y: e.y, type: e.w, ammo: e.w === 'gun' ? 8 : 0, vx: 0, vy: 0, fly: 0, spin: Math.random() * 6 });
  e.w = null; splat(e.x, e.y, a); S.shake = Math.min(14, S.shake + 7);
  S.combo = S.t - S.comboT < 2.6 ? S.combo + 1 : 1; S.comboT = S.t; S.maxCombo = Math.max(S.maxCombo, S.combo);
  au('death'); if (S.combo >= 2) au('combo', S.combo);
  if (S.pwOn <= 0 && S.pw < 1) { S.pw = Math.min(1, S.pw + PW_PER_COMBO * S.combo); S.pwPop = 1; S.pwGain = (S.pwGain || 0) + 1; au(S.pw >= 1 ? 'ready' : 'charge', S.pw); }
  const pts = Math.round((how === 'gun' ? 300 : how === 'exec' ? 600 : 500) * S.combo * S.mask.mult);
  S.score += pts; pop(e.x, e.y - 18, '+' + pts + 'pts', PAL.yel);
  if (S.combo >= 2) pop(e.x, e.y - 40, 'COMBO x' + S.combo, PAL.cyan, true);
  if (S.gm === 'waves') { S.wkills++; if (S.wave < BOSS_WAVE && S.en.every(x => x.dead) && S.waveT <= 0) { S.waveT = 10; S.shake = 14; if (window.NCA) NCA.duck(0.55); pop(S.p.x, S.p.y - 40, S.wave >= WAVES ? 'WAVE ' + S.wave + ' CLEAR - BOSS NEXT' : 'WAVE ' + S.wave + ' CLEAR', PAL.cyan, true); S.score += Math.round(1000 * S.wave * S.mask.mult); } return; }
  if (S.en.every(x => x.dead) && !S.clear) { S.clear = true; S.clearT = S.t; S.shake = 18; }
}
// ---------- boss: THE ENFORCER (original chainsaw brute) ----------
function spawnBoss() {
  const at = farSpawns(300)[0];
  au('roar'); if (window.NCA) NCA.track('boss', 0.75);
  S.boss = { x: at.x, y: at.y, a: 0, r: 22, cr: 13, hp: 46, max: 46, phase: 1, st: 'walk', t: 1.2, hitT: 0, stun: 0, ang: 0, cool: 0, swing: 0, dead: false, deadT: 0, next: 0 };
}
function bossHit(dmg, a, how) {
  const b = S.boss; if (!b || b.dead || b.hitT > 0) return false;
  if (b.stun > 0) dmg *= 2;                                       // punish the wall-stun
  else if (b.st === 'walk' || b.st === 'roar') { dmg = Math.max(1, Math.floor(dmg / 2)); if (gapOK('armor', 400)) pop(b.x + 20, b.y - 30, 'ARMOR', '#aaa'); } // armoured between attacks
  b.hp -= dmg; b.hitT = 0.18; au('bossHit'); S.shake = Math.min(16, S.shake + 6); splat(b.x, b.y, a); b.x += Math.cos(a) * 6; b.y += Math.sin(a) * 6;
  S.score += Math.round(150 * dmg * S.mask.mult); pop(b.x, b.y - 34, '-' + dmg, PAL.yel);
  if (S.pwOn <= 0) S.pw = Math.min(1, S.pw + 0.03 * dmg);
  if (b.phase === 1 && b.hp <= b.max / 2) { b.phase = 2; b.st = 'roar'; b.t = 1.1; au('roar'); if (window.NCA) NCA.intensity(1); S.dil = 0.5; S.shake = 22; pop(b.x, b.y - 50, 'ENRAGED!', PAL.pink, true); }
  if (b.hp <= 0) {
    b.dead = true; b.deadT = 0; S.dil = 1.6; S.shake = 30; S.kills++; S.bullets.length = 0; S.inv = 99; S.locked = true; au('bossDie'); if (window.NCA) NCA.duck(0.3);
    for (let i = 0; i < 6; i++) splat(b.x + (Math.random() - .5) * 30, b.y + (Math.random() - .5) * 30, Math.random() * 6.28);
    for (const e of S.en) if (!e.dead) killEnemy(e, Math.atan2(e.y - b.y, e.x - b.x), 'melee');
    S.score += Math.round(10000 * S.mask.mult); pop(b.x, b.y - 50, '+10000', PAL.yel, true);
    S.wavesCleared = true; S.endT = S.t; setTimeout(() => { if (S && S.boss === b && !S.p.dead) { S.won = true; finish(); } }, 2200);
  }
  return true;
}
function updateBoss(dt) {
  const b = S.boss, p = S.p; if (!b || b.dead) { if (b) b.deadT += dt; return; }
  b.hitT -= dt; b.cool -= dt; if (b.stun > 0) { b.stun -= dt; return; }
  const toP = Math.atan2(p.y - b.y, p.x - b.x), dP = dist(b, p), p2 = b.phase === 2;
  b.t -= dt;
  switch (b.st) {
    case 'roar': if (b.t <= 0) { b.st = 'walk'; b.t = 0.6; } break;
    case 'walk': {
      b.a = toP; const sp = p2 ? 105 : 78; const n = los(b, p) ? p : navNext(b, p); const a = Math.atan2(n.y - b.y, n.x - b.x); moveC(b, Math.cos(a) * sp * dt, Math.sin(a) * sp * dt);
      if (dP < 54 && b.cool <= 0) { b.st = 'swingTele'; b.t = p2 ? 0.3 : 0.42; break; }
      if (b.t <= 0) { const opts = ['charge', 'spray', 'summon'].filter(o => o !== 'summon' || S.en.filter(e => !e.dead).length < (p2 ? 4 : 2)); const ROT = ['charge', 'spray', 'charge', 'summon'], want = ROT[b.next++ % ROT.length], pick = opts.includes(want) ? want : 'charge';
        b.st = pick + 'Tele'; b.t = pick === 'charge' ? (p2 ? 0.6 : 0.85) : pick === 'spray' ? (p2 ? 0.5 : 0.7) : 0.8; b.ang = toP; }
      break; }
    case 'swingTele': b.a = toP; if (b.t <= 0) { b.swing = 0.25; au('chainsaw', 0.3, true); b.cool = 0.9; if (dP < 62 && Math.abs(angDiff(toP, b.a)) < 1.3) killPlayer(toP); b.st = 'walk'; b.t = 0.8; } break;
    case 'chargeTele': if (!b.sawT) { b.sawT = 1; au('chainsaw', b.t, false); } if (b.t > 0.25) b.ang = toP; b.a = b.ang; if (b.t <= 0) { b.st = 'charge'; b.t = 1.2; b.sawT = 0; au('chainsaw', 1.0, true); } break;
    case 'charge': { const sp = p2 ? 640 : 520, ox = b.x, oy = b.y; moveC(b, Math.cos(b.ang) * sp * dt, Math.sin(b.ang) * sp * dt);
      if (dP < b.r + 10) killPlayer(b.ang);
      for (const e of S.en) if (!e.dead && dist(e, b) < b.r + 10) killEnemy(e, b.ang, 'melee');
      if (Math.hypot(b.x - ox, b.y - oy) < sp * dt * 0.5) { b.stun = p2 ? 0.9 : 1.4; S.shake = 18; pop(b.x, b.y - 36, 'STUNNED!', PAL.cyan, true); b.st = 'walk'; b.t = 1.5; }
      else if (b.t <= 0) { b.st = 'walk'; b.t = 1.4; } break; }
    case 'sprayTele': b.a = toP; b.ang = toP; if (b.t <= 0) { const n = p2 ? 11 : 7, spread = p2 ? 1.3 : 0.9;
        for (let i = 0; i < n; i++) { const a = b.ang - spread / 2 + spread * i / (n - 1); S.bullets.push({ x: b.x + Math.cos(a) * 26, y: b.y + Math.sin(a) * 26, vx: Math.cos(a) * 420, vy: Math.sin(a) * 420, from: 'e' }); }
        S.shake += 6; au('spray'); if (p2 && !b.second) { b.second = true; b.st = 'sprayTele'; b.t = 0.35; } else { b.second = false; b.st = 'walk'; b.t = p2 ? 1.2 : 1.8; } } break;
    case 'summonTele': if (b.t <= 0) { const sp = farSpawns(200); for (let i = 0; i < (p2 ? 3 : 2); i++) { const at = sp[(Math.random() * sp.length) | 0]; const e = mkEnemy(at, Math.random() < (p2 ? .5 : .3) ? 'gun' : 'bat', [at], { spd: 1.3, react: 0.3, smart: 1 }); e.st = 'chase'; e.last = { x: p.x, y: p.y }; S.en.push(e); }
        pop(b.x, b.y - 40, 'GET HIM!', PAL.pink, true); au('summon'); b.st = 'walk'; b.t = 1.6; } break;
  }
}
function killPlayer(a) { if (S.p.dead || S.won || GOD || S.locked) return;
  if (S.inv > 0) return;
  if (S.pwOn > 0 && S.hp > 0) { S.hp--; S.inv = 1.2; S.shake = 14; pop(S.p.x, S.p.y - 26, 'BLOCKED! ' + S.hp + ' LEFT', '#16f4ff', true); for (let i = 0; i < 16; i++) S.aura.push(auraP(S.p, 260)); return; } S.p.dead = true; S.p.a = a; splat(S.p.x, S.p.y, a); S.shake = 18; S.endT = S.t; au('playerDie'); if (window.NCA) NCA.duck(0.35); }
function nearBox() { return S.box.st === 'closed' && !S.p.dead && dist(S.p, BOX) < 52; }
function spinBox() {
  const b = S.box; if (b.st !== 'closed') return false;
  b.st = 'spin'; b.t = 0; b.k = 0; b.next = 0.05; b.iv = 0.05; b.res = BOX_POOL[(Math.random() * BOX_POOL.length) | 0]; au('boxOpen'); pop(BOX.x, BOX.y - 30, 'MYSTERY BOX!', PAL.yel, true); return true;
}
function updateBox(dt) {
  const b = S.box; if (b.st === 'spin') { b.t += dt; b.next -= dt;
    if (b.next <= 0) { b.k++; b.iv *= 1.13; b.next = b.iv; b.show = BOX_POOL[b.k % 3]; au('spinTick', b.k);
      if (b.iv > 0.32) { b.show = b.res; b.st = 'spent'; b.landT = S.t; const p = S.p;
        if (p.wpn && !p.dead) S.items.push({ x: p.x - 10, y: p.y + 14, type: p.wpn, ammo: p.ammo, vx: 0, vy: 0, fly: 0, spin: 1 });
        if (!p.dead) { p.wpn = b.res; p.ammo = 0; } au('spinLand', b.res); S.shake = 10; pop(BOX.x, BOX.y - 44, WNAME(b.res) + '!', b.res === 'saber' ? PAL.cyan : PAL.yel, true);
        for (let i = 0; i < 24; i++) S.parts.push({ x: BOX.x, y: BOX.y, vx: (Math.random() - .5) * 300, vy: (Math.random() - .5) * 300, t: 0, spark: 1 }); } } }
}
function throwOrPick() {
  const p = S.p; if (p.dead || S.won) return;
  if (nearBox() && spinBox()) return;
  if (p.wpn) { // throw
    S.items.push({ x: p.x + Math.cos(p.a) * 14, y: p.y + Math.sin(p.a) * 14, type: p.wpn, ammo: p.ammo, vx: Math.cos(p.a) * 560, vy: Math.sin(p.a) * 560, fly: 0.7, spin: 0 });
    p.wpn = null; p.ammo = 0; au('throw'); return;
  }
  let bestI = null, bd = 30; for (const it of S.items) { if (it.fly > 0) continue; const d = dist(it, p); if (d < bd) { bd = d; bestI = it; } }
  if (bestI) { p.wpn = bestI.type; p.ammo = bestI.ammo; S.items.splice(S.items.indexOf(bestI), 1); au('pickup'); }
}
function attack() {
  const p = S.p; if (p.cd > 0 || p.dead || S.won) return;
  if (p.wpn === 'gun') {
    if (p.ammo <= 0) { pop(p.x, p.y - 20, 'EMPTY', PAL.pink); p.cd = 0.4; au('empty'); return; }
    p.ammo--; p.cd = 0.16; S.bullets.push({ x: p.x + Math.cos(p.a) * 14, y: p.y + Math.sin(p.a) * 14, vx: Math.cos(p.a) * 900, vy: Math.sin(p.a) * 900, from: 'p' }); S.shake += 3; au('gun'); return;
  }
  p.cd = WPN[p.wpn] ? WPN[p.wpn].cd : p.wpn ? 0.32 : 0.26; p.swing = 0.16; au('swing', p.wpn || 'fists'); let hitAny = false;
  if (S.boss && !S.boss.dead) { const b = S.boss, d = dist(b, p), a = Math.atan2(b.y - p.y, b.x - p.x);
    if (d < reach() + b.r - 8 && (Math.abs(angDiff(a, p.a)) < 1.2 || d < b.r + 12)) { bossHit((WPN[p.wpn] ? WPN[p.wpn].boss : S.mask.id === 'tony' ? 2 : 1) * (S.pwOn > 0 ? 2 : 1), a, 'melee'); hitAny = true; } }
  for (const e of S.en) {
    if (e.dead || e.inT > 0) continue; const d = dist(e, p); if (d > reach()) continue;
    if (Math.abs(angDiff(Math.atan2(e.y - p.y, e.x - p.x), p.a)) > 1.1 && d > 16) continue;
    const a = Math.atan2(e.y - p.y, e.x - p.x);
    hitAny = true;
    if (e.stun > 0) killEnemy(e, a, 'exec');
    else if (WPN[p.wpn] || S.mask.id === 'tony') killEnemy(e, a, 'melee');
    else { e.stun = 1.6; if (e.w) { S.items.push({ x: e.x, y: e.y, type: e.w, ammo: e.w === 'gun' ? 8 : 0, vx: Math.cos(a) * 160, vy: Math.sin(a) * 160, fly: .2, spin: 0 }); e.w = null; } S.shake += 4; pop(e.x, e.y - 18, 'KNOCKED!', PAL.cyan); }
  }
  if (hitAny) { au('hit', p.wpn || 'fists'); if (p.wpn === 'saber') { SABER.flash = 0.06; const q = saberPts(p, 0.08); for (let i = 0; i < 3; i++) S.parts.push({ x: q[2], y: q[3], vx: (Math.random() - .5) * 260, vy: (Math.random() - .5) * 260, t: 0, spark: 1 }); } }
}
// ---------- update ----------
function update(dt) {
  S.t += dt; const p = S.p;
  // power-up timers
  if (S.inv > 0) S.inv -= dt;
  if (S.pwOn > 0) { S.pwOn -= dt; S.pw = Math.max(0, S.pwOn / PW_DUR); if (S.pwOn <= 0) { S.pwOn = 0; S.hp = 0; S.pw = 0; pop(p.x, p.y - 26, 'POWER DOWN', '#ff2a8a'); au('powerDown'); } }
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
    if (touch.aim) { const dx = touch.aim.cx - touch.aim.x, dy = touch.aim.cy - touch.aim.y; const l = Math.hypot(dx, dy); if (l > 10) p.a = Math.atan2(dy, dx); if (l > 18) attack(); }
    else if (!isTouch || mouse.x) { const w = toWorld(mouse.x, mouse.y); if (!touch.move || !isTouch) p.a = Math.atan2(w.y - p.y, w.x - p.x); }
    if (isTouch && !touch.aim && ml > 0.2) p.a = Math.atan2(my, mx);
    if (mouse.down) attack();
  }
  p.cd -= dt; p.swing -= dt;
  // enemies
  ffT -= dt; const pt = Math.floor(p.y / TS) * MW + Math.floor(p.x / TS); if (ffT <= 0 || pt !== ffTile) { if (ffT <= 0 || pt !== ffTile) buildFlow(p.x, p.y); ffT = 0.3; ffTile = pt; }
  for (const e of S.en) {
    if (e.dead) continue;
    if (e.inT > 0) { e.inT -= dt; continue; }
    if (e.stun > 0) { e.stun -= dt; continue; }
    e.cd -= dt; e.swing -= dt;
    const toP = Math.atan2(p.y - e.y, p.x - e.x), dP = dist(e, p);
    const sees = S.grace <= 0 && !p.dead && dP < 360 && (Math.abs(angDiff(toP, e.a)) < 1.25 || dP < 70 || e.st === 'chase') && los(e, p);
    if (sees) { if (e.st !== 'chase') { e.st = 'chase'; e.seen = 0; pop(e.x, e.y - 22, '!', PAL.pink); } e.seen += dt; e.last = { x: p.x, y: p.y }; }
    else if (S.grace <= 0 && e.smart && !p.dead && Math.random() < e.smart * dt * 0.5) { e.st = 'chase'; e.last = { x: p.x, y: p.y }; } // hunters 'hear' you
    let tgt = null, sp = 62 * e.spd, face = null;
    if (e.st === 'chase') {
      sp = 132 * e.spd; tgt = e.last;
      if (sees) {
        face = toP;
        if (e.w === 'gun') { if (dP < 330 && e.seen > e.react && e.cd <= 0 && Math.abs(angDiff(toP, e.a)) < 0.35) { e.cd = 0.75; const sa = e.a + (Math.random() - .5) * 0.12; S.bullets.push({ x: e.x + Math.cos(sa) * 14, y: e.y + Math.sin(sa) * 14, vx: Math.cos(sa) * 650, vy: Math.sin(sa) * 650, from: 'e' }); au('gun', true); } if (dP < 140) tgt = null; }
        else if (dP < 24 && e.cd <= 0) { e.cd = 0.5; e.swing = 0.16; if (e.seen > 0.25) killPlayer(toP); }
        if (tgt && !clearPath(e, tgt, e.r)) tgt = flowTarget(e) || tgt;   // visible but a corner is in the way
      } else if (e.smart || (e.last && !clearPath(e, e.last, e.r))) { tgt = flowTarget(e) || e.last; if (!e.smart && e.last && dist(e, e.last) < 14) { e.st = 'patrol'; e.last = null; } }
      else if (!e.last || dist(e, e.last) < 14) { e.st = 'patrol'; e.last = null; }
    } else { tgt = e.path[e.pi]; if (dist(e, tgt) < 8) e.pi = (e.pi + 1) % e.path.length;
      if (!clearPath(e, tgt, e.r)) { e.navT -= dt; if (e.navT <= 0 || !e.nav || dist(e, e.nav) < 8) { e.nav = navNext(e, tgt); e.navT = 0.3; } tgt = e.nav; } }
    steer(e, tgt, sp, face, dt);
  }
  // wave failsafes: countdown always starts once everything is dead; enemies with no route (walled in / out of map) get re-spawned at a door
  if (S.gm === 'waves' && !p.dead) {
    const alive = S.en.filter(e => !e.dead);
    if (S.wave < BOSS_WAVE && S.waveT <= 0 && S.wave > 0 && !alive.length) { S.waveT = 10; pop(p.x, p.y - 40, 'WAVE ' + S.wave + ' CLEAR', PAL.cyan, true); }
    S.lastKillT = S.lastKillT || S.t;
    for (const e of alive) { if (e.inT > 0) continue; const ti = Math.floor(e.y / TS) * MW + Math.floor(e.x / TS);
      const lost = !fits(e.x, e.y, e.r) || e.x < 0 || e.y < 0 || e.x > MW * TS || e.y > MH * TS || FF[ti] < 0;
      if (lost || (S.t - S.lastKillT > 25 && alive.length <= 3 && !los(e, p))) { const at = validSpot(farSpawns(160)[(Math.random() * SPAWNS.length) % farSpawns(160).length | 0]); e.x = at.x; e.y = at.y; e.vx = e.vy = 0; e.st = 'chase'; e.last = { x: p.x, y: p.y }; e.smart = Math.max(e.smart, 1); }
    }
    if (S.t - S.lastKillT > 25) S.lastKillT = S.t - 10;
  }
  if (S.gm === 'waves') { updateBoss(dt); if (S.waveT > 0 && !p.dead) { const before = Math.ceil(S.waveT); S.waveT -= dt; if (Math.ceil(S.waveT) !== before && S.waveT > 0) { S.tick = 1; au('beep', Math.ceil(S.waveT)); } if (S.waveT <= 0) { S.waveT = 0; startWave(S.wave + 1); } } if (S.tick > 0) S.tick -= dt * 3; }
  S.pwPop = Math.max(0, (S.pwPop || 0) - dt * 3);
  updateBox(dt);
  if (S.grace > 0) { S.grace -= dt; if (dist(p, S.start) > 70 && S.box.st !== 'spin') S.grace = Math.min(S.grace, 0); }
  if (p.wpn === 'saber' && !p.dead) { const q = saberPts(p, p.swing); pushTrail(q[0], q[1], q[2], q[3], S.t); } else trCount = 0;
  if (SABER.flash > 0) SABER.flash -= dt;
  if (window.NCA) NCA.hum(p.wpn === 'saber' && !p.dead && mode === 'play', p.swing > 0 ? 1 : 0);
  // bullets
  for (const b of S.bullets) {
    const n = 4; for (let i = 0; i < n && !b.gone; i++) {
      b.x += b.vx * dt / n; b.y += b.vy * dt / n;
      if (solidAt(b.x, b.y)) { b.gone = true; for (let k = 0; k < 4; k++) S.parts.push({ x: b.x, y: b.y, vx: (Math.random() - .5) * 200, vy: (Math.random() - .5) * 200, t: 0, spark: 1 }); break; }
      if (b.from === 'p' && S.boss && !S.boss.dead && dist(S.boss, b) < S.boss.r) { bossHit(1, Math.atan2(b.vy, b.vx), 'gun'); b.gone = true; break; }
      if (b.from === 'p') { for (const e of S.en) if (!e.dead && !(e.inT > 0) && dist(e, b) < 12) { killEnemy(e, Math.atan2(b.vy, b.vx), 'gun'); b.gone = true; break; } }
      else if (!p.dead && dist(p, b) < 12 && p.wpn === 'saber' && !b.tried) { b.tried = true; if (Math.random() < WPN.saber.deflect) { const a = Math.atan2(-b.vy, -b.vx) + (Math.random() - .5) * 0.3, v = Math.hypot(b.vx, b.vy); b.vx = Math.cos(a) * v; b.vy = Math.sin(a) * v; b.from = 'p'; b.x = p.x + Math.cos(a) * 14; b.y = p.y + Math.sin(a) * 14; p.swing = 0.16; pop(p.x, p.y - 26, 'DEFLECT!', PAL.cyan, true); au('deflect'); S.shake += 4; break; } }
      if (b.from === 'e' && S.locked) { b.gone = true; break; }
      if (b.from === 'e' && !p.dead && dist(p, b) < 10) { killPlayer(Math.atan2(b.vy, b.vx)); b.gone = true; }
    }
  }
  S.bullets = S.bullets.filter(b => !b.gone);
  // thrown items
  for (const it of S.items) {
    if (it.fly <= 0) continue; it.fly -= dt; it.spin += dt * 20;
    const nx = it.x + it.vx * dt, ny = it.y + it.vy * dt;
    if (solidAt(nx, it.y)) it.vx *= -0.3; else it.x = nx; if (solidAt(it.x, ny)) it.vy *= -0.3; else it.y = ny;
    it.vx *= 0.97; it.vy *= 0.97;
    if (Math.hypot(it.vx, it.vy) > 200 && S.boss && !S.boss.dead && dist(S.boss, it) < S.boss.r + 6) { if (bossHit(1, Math.atan2(it.vy, it.vx), 'throw')) { S.boss.stun = Math.max(S.boss.stun, 0.6); pop(S.boss.x, S.boss.y - 30, 'DAZED', PAL.cyan); } it.vx *= -0.25; it.vy *= -0.25; }
    if (Math.hypot(it.vx, it.vy) > 200) for (const e of S.en) if (!e.dead && e.stun <= 0 && dist(e, it) < 16) {
      e.stun = 2.2; it.vx *= -0.25; it.vy *= -0.25; S.shake += 5; au('stun'); pop(e.x, e.y - 18, 'STUNNED', PAL.cyan);
      if (e.w) { S.items.push({ x: e.x, y: e.y, type: e.w, ammo: e.w === 'gun' ? 8 : 0, vx: 0, vy: 0, fly: 0, spin: 1 }); e.w = null; }
    }
  }
  for (const it of S.items) it.age = (it.age || 0) + dt;
  if (S.items.length > 14 || S.items.some(it => it.age > 25 && it.fly <= 0)) { S.items = S.items.filter(it => !(it.age > 25 && it.fly <= 0)); while (S.items.length > 14) { const i = S.items.findIndex(it => it.fly <= 0); if (i < 0) break; S.items.splice(i, 1); } }
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
  if (S.gm === 'waves') {
    const time = S.endT; S.timeBonus = Math.max(0, Math.round((300 - time) * 40)); S.final = S.score + S.timeBonus;
    S.grade = S.final > 60000 ? 'A+' : S.final > 45000 ? 'A' : S.final > 34000 ? 'B' : S.final > 25000 ? 'C' : S.final > 16000 ? 'D' : 'F';
    S.test = GOD || TSCALE !== 1 || DBG_PW || S.dbg;
    S.newBest = !S.test && S.final > waveBest; if (S.newBest) { waveBest = S.final; waveBestGrade = S.grade; try { localStorage.setItem('hm_nightcall_wave_best', waveBest); localStorage.setItem('hm_nightcall_wave_grade', waveBestGrade); } catch (e) {} }
    setTimeout(() => { if (S.won) { mode = 'results'; resAt = performance.now(); setModeClass(); au('results'); if (window.NCA) NCA.track('results'); } }, 600); return;
  }
  const time = S.endT; S.timeBonus = Math.max(0, Math.round((90 - time) * 50)); S.final = S.score + S.timeBonus; S.grade = grade(S.final, time);
  S.test = GOD || TSCALE !== 1 || DBG_PW;
  S.newBest = !S.test && S.final > best; if (S.newBest) { best = S.final; bestGrade = S.grade; try { localStorage.setItem('hm_nightcall_best', best); localStorage.setItem('hm_nightcall_grade', bestGrade); } catch (e) {} }
  setTimeout(() => { if (S.won) { mode = 'results'; resAt = performance.now(); setModeClass(); au('results'); if (window.NCA) NCA.track('results'); } }, 900);
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
const hudSparks = [];
function drawPowerHUD(hs) {
  const t = S.t, v = S.pw, on = S.pwOn > 0, ready = v >= 1 && !on, pop = S.pwPop || 0;
  // bottom-centre; on phones it sits between the move stick (left) and THROW/POWER (right)
  const safeL = isTouch ? (W < 380 ? 120 : 150) : 0, safeR = isTouch ? 120 : 0;
  const w = Math.max(120, Math.min(isTouch ? 300 : 380, W - safeL - safeR - 20)), h = Math.round(Math.max(18, hs * 1.6));
  const x = isTouch ? safeL + (W - safeL - safeR - w) / 2 : W / 2 - w / 2, y = H - h - (isTouch ? 22 : 30) - SAB;
  const hue = v < 0.5 ? 330 - v * 2 * 145 : 185, light = v < 0.5 ? 55 + v * 10 : 60 + (v - 0.5) * 2 * 38;
  const col = on ? `hsl(${(t * 240) % 360},100%,65%)` : `hsl(${hue},100%,${light}%)`;
  const sc = 1 + pop * 0.18 + (ready ? 0.06 * Math.sin(t * 12) : 0);
  g.save(); g.translate(x + w / 2, y + h / 2); g.scale(sc, sc + pop * 0.12); g.translate(-w / 2, -h / 2);
  // glass
  g.fillStyle = '#05010acc'; g.fillRect(-4, -4, w + 8, h + 8);
  g.save(); g.beginPath(); g.rect(0, 0, w, h); g.clip();
  // liquid with a sloshing wave on its leading edge
  const fx = w * v, amp = Math.min(6, 2 + v * 4) * (1 + pop * 2);
  if (fx > 0.5) {
    g.beginPath(); g.moveTo(0, 0);
    for (let yy = 0; yy <= h; yy += 2) g.lineTo(Math.max(0, fx + Math.sin(yy * 0.45 + t * 9) * amp * (v < 1 ? 1 : 0.4)), yy);
    g.lineTo(0, h); g.closePath();
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, `hsl(${on ? (t * 240) % 360 : hue},100%,${Math.min(95, light + 25)}%)`); gr.addColorStop(1, col);
    g.shadowColor = col; g.shadowBlur = 6 + v * 24; g.fillStyle = gr; g.fill(); g.shadowBlur = 0;
    // bubbles in the liquid
    g.fillStyle = 'rgba(255,255,255,.5)'; for (let i = 0; i < 6; i++) { const bx = ((i * 53 + t * (30 + i * 9)) % Math.max(1, fx)), by = h - ((t * 20 + i * 17) % h); g.fillRect(bx, by, 2, 2); }
    // shimmer sweep
    const sx = ((t * 0.55) % 1.4 - 0.2) * w; const sg = g.createLinearGradient(sx - 30, 0, sx + 30, 0); sg.addColorStop(0, 'rgba(255,255,255,0)'); sg.addColorStop(0.5, `rgba(255,255,255,${0.25 + v * 0.35})`); sg.addColorStop(1, 'rgba(255,255,255,0)');
    g.globalCompositeOperation = 'lighter'; g.fillStyle = sg; g.fillRect(0, 0, Math.min(fx, w), h); g.globalCompositeOperation = 'source-over';
  }
  g.restore();
  // segment ticks that light up
  const SEG = 10; for (let i = 1; i < SEG; i++) { const tx = w * i / SEG, lit = v * SEG >= i; g.fillStyle = lit ? '#fff' : '#ffffff33'; if (lit) { g.shadowColor = col; g.shadowBlur = 8; } g.fillRect(tx - 1, lit ? -5 : -2, 2, lit ? 5 : 3); g.fillRect(tx - 1, h, 2, lit ? 5 : 3); g.shadowBlur = 0; }
  // frame
  g.strokeStyle = on ? '#fff' : col; g.lineWidth = 2 + v * 1.5; g.shadowColor = col; g.shadowBlur = 4 + v * 18 * (Math.random() < (v > 0.6 ? (v - 0.6) * 0.4 : 0) ? 0.3 : 1); g.strokeRect(0, 0, w, h); g.shadowBlur = 0;
  // electric arcs near full
  if (v > 0.85 && !on) { g.globalCompositeOperation = 'lighter'; g.strokeStyle = Math.random() < .5 ? '#fff' : PAL.cyan; g.lineWidth = 1.5;
    for (let k = 0; k < (ready ? 3 : 1); k++) if (Math.random() < (ready ? 0.9 : (v - 0.85) * 5)) { let ax = Math.random() * w, ay = Math.random() < .5 ? 0 : h; const dir = ay ? 1 : -1; g.beginPath(); g.moveTo(ax, ay); for (let j = 0; j < 5; j++) { ax += (Math.random() - .5) * 18; ay += dir * (4 + Math.random() * 6); g.lineTo(ax, ay); } g.stroke(); }
    g.globalCompositeOperation = 'source-over'; }
  // inner label
  if (on) txt(S.pwOn.toFixed(1) + 's', w / 2, h / 2 + 1, Math.max(8, h * 0.5), '#fff', 'center', '#000');
  g.restore();
  // sparks scale with fill (screen space, pooled)
  const want = on ? 0.6 : v * v * 1.2 + pop * 3; if (hudSparks.length < 40 && Math.random() < want) hudSparks.push({ x: x + Math.random() * w * Math.max(v, 0.05), y: y + Math.random() * h, vx: (Math.random() - .5) * 60, vy: -40 - Math.random() * 90, t: 0 });
  g.globalCompositeOperation = 'lighter';
  for (let i = hudSparks.length - 1; i >= 0; i--) { const q = hudSparks[i]; q.t += 1 / 60; q.x += q.vx / 60; q.y += q.vy / 60; q.vy += 90 / 60; if (q.t > 0.7) { hudSparks.splice(i, 1); continue; } g.globalAlpha = 1 - q.t / 0.7; g.fillStyle = Math.random() < .3 ? '#fff' : col; g.fillRect(q.x, q.y, 2, 2); }
  g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
  // label above
  const label = on ? 'POWER' : ready ? (isTouch ? 'READY! TAP POWER' : 'READY!  [Q] / [SHIFT]') : 'POWER ' + Math.floor(v * 100) + '%';
  const ls = Math.max(10, hs * 0.75) * (ready ? 1.15 + 0.1 * Math.sin(t * 10) : 1);
  txt(label, x + w / 2, y - h * 0.55 - 6, ls, ready ? (Math.floor(t * 6) % 2 ? '#fff' : PAL.cyan) : col, 'center');
  if (on) for (let i = 0; i < 2; i++) { const px = x + w / 2 + (i ? 30 : -42) + (i ? 0 : 0), py = y - h * 0.55 - 6 - ls * 1.6; g.fillStyle = i < S.hp ? PAL.cyan : '#333'; g.shadowColor = PAL.cyan; g.shadowBlur = i < S.hp ? 10 : 0; g.fillRect(px, py - 6, 12, 12); g.shadowBlur = 0; }
  if (tPow) { const st = on ? 'on' : ready ? 'ready' : ''; if (tPow.dataset.st !== st) { tPow.dataset.st = st; } tPow.style.setProperty('--p', (v * 100).toFixed(0) + '%'); }
}
const sabEl = document.getElementById('sab'); let SAB = 0;
const tPow = document.getElementById('tPow'), tThrowB = document.getElementById('tThrow');
function drawBoss(b, t) {
  if (b.dead) { g.save(); g.translate(b.x, b.y); g.rotate(b.a); g.fillStyle = '#2a2a2a'; g.fillRect(-30, -18, 52, 36); g.fillStyle = '#7a0f2a'; g.fillRect(14, -14, 20, 28); g.restore(); return; }
  // telegraphs
  if (b.st === 'chargeTele' || b.st === 'charge') { g.save(); g.globalAlpha = b.st === 'charge' ? 0.25 : 0.35 + 0.35 * Math.sin(t * 30); g.strokeStyle = '#ff2030'; g.lineWidth = 2 * b.r; g.lineCap = 'round';
    g.beginPath(); g.moveTo(b.x, b.y); g.lineTo(b.x + Math.cos(b.ang) * 520, b.y + Math.sin(b.ang) * 520); g.stroke(); g.restore(); }
  if (b.st === 'sprayTele') { g.save(); const sp = b.phase === 2 ? 1.3 : 0.9; g.globalAlpha = 0.3 + 0.3 * Math.sin(t * 28); g.fillStyle = PAL.yel; g.beginPath(); g.moveTo(b.x, b.y); g.arc(b.x, b.y, 300, b.ang - sp / 2, b.ang + sp / 2); g.closePath(); g.fill(); g.restore(); }
  if (b.st === 'summonTele') { g.save(); g.strokeStyle = PAL.pink; g.globalAlpha = 0.8; g.lineWidth = 3; g.beginPath(); g.arc(b.x, b.y, b.r + 14 + (0.8 - b.t) * 40, 0, 6.283); g.stroke(); g.restore(); txt('!!', b.x, b.y - 46, 14, PAL.pink); }
  if (b.st === 'swingTele') { g.save(); g.globalAlpha = 0.45; g.fillStyle = '#ff2030'; g.beginPath(); g.moveTo(b.x, b.y); g.arc(b.x, b.y, 62, b.a - 1.3, b.a + 1.3); g.closePath(); g.fill(); g.restore(); }
  // body (2x brute with a chainsaw)
  const flash = b.hitT > 0 && Math.floor(t * 40) % 2, rage = b.phase === 2;
  g.save(); g.translate(b.x, b.y); g.rotate(b.a + (b.st === 'roar' ? Math.sin(t * 40) * 0.15 : 0)); g.scale(2, 2);
  g.fillStyle = '#000'; g.fillRect(-11, -13, 22, 26);
  g.fillStyle = flash ? '#fff' : rage ? '#5a0a14' : '#2b2b33'; g.fillRect(-10, -12, 20, 24);
  g.fillStyle = '#c99a72'; g.fillRect(4, -13, 8, 6); g.fillRect(4, 7, 8, 6);
  const rev = b.st === 'charge' || b.swing > 0 ? Math.random() * 2 : 0;
  g.fillStyle = '#d9a300'; g.fillRect(10, 3, 8, 8); g.fillStyle = '#bbb'; g.fillRect(16, 4 + rev * 0.5, 22, 6); g.fillStyle = '#555'; for (let i = 0; i < 7; i++) g.fillRect(17 + i * 3, 3 + ((i + Math.floor(t * 30)) % 2) * 6, 2, 2);
  g.fillStyle = '#c99a72'; g.fillRect(-6, -7, 13, 14); g.fillStyle = rage ? '#ff2030' : '#111'; g.fillRect(-6, -7, 6, 14); g.fillStyle = rage ? '#ffe14d' : '#ff2030'; g.fillRect(3, -4, 2, 2); g.fillRect(3, 2, 2, 2);
  g.restore();
  if (b.stun > 0) txt('@', b.x, b.y - 46, 12, PAL.cyan);
}
// static map baked once into two offscreen layers (floor under decals, walls+neon edge over them): no per-frame shadowBlur
const MAPC = (() => {
  const K = 2, mk = () => { const c = document.createElement('canvas'); c.width = MW * TS * K; c.height = MH * TS * K; const x = c.getContext('2d'); x.scale(K, K); return [c, x]; };
  const [floor, f] = mk(), [walls, w] = mk();
  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) { const c = MAP[y][x], X = x * TS, Y = y * TS; if (c === '#') continue;
    const outside = y >= 15; f.fillStyle = outside ? ((x + y) % 2 ? '#1a2238' : '#161d34') : ((x + y) % 2 ? '#330e49' : '#2b0c40'); f.fillRect(X, Y, TS, TS);
    if (c === 'D') { f.fillStyle = '#5a3a1a'; f.fillRect(X + 2, Y + 2, TS - 4, TS - 4); } }
  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) if (MAP[y][x] === '#') { w.fillStyle = '#05010a'; w.fillRect(x * TS, y * TS, TS, TS); }
  w.strokeStyle = PAL.pink; w.lineWidth = 2; w.shadowColor = PAL.pink; w.shadowBlur = 10; w.beginPath();
  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) if (MAP[y][x] === '#') { const X = x * TS, Y = y * TS;
    if (!wall(x, y - 1)) { w.moveTo(X, Y); w.lineTo(X + TS, Y); } if (!wall(x, y + 1)) { w.moveTo(X, Y + TS); w.lineTo(X + TS, Y + TS); }
    if (!wall(x - 1, y)) { w.moveTo(X, Y); w.lineTo(X, Y + TS); } if (!wall(x + 1, y)) { w.moveTo(X + TS, Y); w.lineTo(X + TS, Y + TS); } }
  w.stroke(); w.stroke(); w.shadowBlur = 0;
  return { floor, walls };
})();
// ---------- render ----------
function toWorld(x, y) { return { x: (x - W / 2) / zoom + S.cam.x, y: (y - H / 2) / zoom + S.cam.y }; }
function txt(s, x, y, size, col, align = 'center', shadow = '#000') {
  g.font = `${size}px "Press Start 2P"`; g.textAlign = align; g.textBaseline = 'middle';
  g.fillStyle = shadow; g.fillText(s, x + size * 0.15, y + size * 0.15); g.fillStyle = col; g.fillText(s, x, y);
}
// energy blade (Hatch's method): pre-rendered glow sprite + 'lighter', 10-sample ring-buffer trail, white core, flicker, no shadowBlur
function glowSprite(col, r = 32) { const c = document.createElement('canvas'); c.width = c.height = r * 2; const x = c.getContext('2d'); const gr = x.createRadialGradient(r, r, 0, r, r, r);
  gr.addColorStop(0, col); gr.addColorStop(0.35, col + '66'); gr.addColorStop(1, col + '00'); x.fillStyle = gr; x.fillRect(0, 0, r * 2, r * 2); return c; }
const SABER = { col: '#16f4ff', glow: glowSprite('#16f4ff'), len: 34, flash: 0 };
const TR_N = 10, trail = new Float32Array(TR_N * 5); let trHead = 0, trCount = 0;
function pushTrail(hx, hy, tx, ty, t) { const i = trHead * 5; trail[i] = hx; trail[i + 1] = hy; trail[i + 2] = tx; trail[i + 3] = ty; trail[i + 4] = t; trHead = (trHead + 1) % TR_N; trCount = Math.min(TR_N, trCount + 1); }
function saberPts(o, swing) { const r = swing > 0 ? -1.6 + (0.16 - swing) * 14 : -0.4, c = Math.cos(o.a), s = Math.sin(o.a), hx0 = o.x + c * 10 - s * 8, hy0 = o.y + s * 10 + c * 8, ba = o.a + r;
  const hx = hx0 + Math.cos(ba) * 7, hy = hy0 + Math.sin(ba) * 7; return [hx, hy, hx + Math.cos(ba) * SABER.len, hy + Math.sin(ba) * SABER.len]; }
function drawSaber(hx, hy, tx, ty, t) {
  g.save(); g.globalCompositeOperation = 'lighter';
  for (let k = 1; k < trCount; k++) { const a = ((trHead - k) + TR_N) % TR_N * 5, b = ((trHead - k - 1) + TR_N) % TR_N * 5; if (t - trail[b + 4] > 0.12) break;
    g.globalAlpha = 0.35 * (1 - k / trCount); g.fillStyle = SABER.col; g.beginPath(); g.moveTo(trail[a], trail[a + 1]); g.lineTo(trail[a + 2], trail[a + 3]); g.lineTo(trail[b + 2], trail[b + 3]); g.lineTo(trail[b], trail[b + 1]); g.closePath(); g.fill(); }
  const fl = 0.9 + 0.1 * Math.sin(t * 60) + (Math.random() - 0.5) * 0.06, fx = SABER.flash > 0 ? 2 : 1;
  g.globalAlpha = 0.55 * fl; const sz = 26 * fl * fx;
  for (let i = 0; i <= 3; i++) { const u = i / 3, x = hx + (tx - hx) * u, y = hy + (ty - hy) * u; g.drawImage(SABER.glow, x - sz, y - sz, sz * 2, sz * 2); }
  g.globalAlpha = 1; g.lineCap = 'round'; g.strokeStyle = SABER.col; g.lineWidth = 6; g.beginPath(); g.moveTo(hx, hy); g.lineTo(tx, ty); g.stroke(); g.strokeStyle = '#fff'; g.lineWidth = 2.5; g.stroke();
  g.restore();
}
function drawBlade(L) { // icon version (slot reel / dropped item): hilt + same sprite glow
  g.fillStyle = '#9aa3ad'; g.fillRect(-2, -2.5, 9, 5); g.fillStyle = '#333'; g.fillRect(1, -2.5, 2, 5);
  g.save(); g.globalCompositeOperation = 'lighter'; for (let i = 0; i <= 2; i++) g.drawImage(SABER.glow, 7 + L * i / 2 - 14, -14, 28, 28);
  g.lineCap = 'round'; g.strokeStyle = SABER.col; g.lineWidth = 5; g.beginPath(); g.moveTo(8, 0); g.lineTo(7 + L, 0); g.stroke(); g.strokeStyle = '#fff'; g.lineWidth = 2; g.stroke(); g.restore();
}
function drawBox(t) {
  const b = S.box; g.save(); g.translate(BOX.x, BOX.y);
  const glow = b.st === 'closed' ? 0.6 + 0.4 * Math.sin(t * 5) : b.st === 'spin' ? 1 : 0.15;
  if (b.st !== 'spent') { g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = glow; g.drawImage(SABER.glow, -30, -30, 60, 60); g.restore(); }
  g.fillStyle = b.st === 'spent' ? '#2a2233' : '#3a1a5a'; g.fillRect(-11, -11, 22, 22);
  g.strokeStyle = b.st === 'spent' ? '#555' : PAL.yel; g.lineWidth = 2; g.strokeRect(-11, -11, 22, 22);
  if (b.st !== 'spent') { g.fillStyle = PAL.yel; g.font = "12px 'Press Start 2P'"; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('?', 0, 1); }
  else { g.strokeStyle = '#666'; g.beginPath(); g.moveTo(-8, -8); g.lineTo(8, 8); g.moveTo(8, -8); g.lineTo(-8, 8); g.stroke(); }
  g.restore();
  // slot reel above the trunk
  if (b.st === 'spin' || (b.st === 'spent' && S.t - b.landT < 1.6)) {
    const y = BOX.y - 52, w = 70, h = 40, land = b.st === 'spent', pulse = land ? 1 + 0.12 * Math.sin((S.t - b.landT) * 20) * Math.max(0, 1 - (S.t - b.landT)) : 1;
    g.save(); g.translate(BOX.x, y); g.scale(pulse, pulse); g.fillStyle = '#0b0216ee'; g.fillRect(-w / 2, -h / 2, w, h); g.strokeStyle = land ? PAL.yel : PAL.pink; g.lineWidth = 3; g.shadowColor = g.strokeStyle; g.shadowBlur = 14; g.strokeRect(-w / 2, -h / 2, w, h); g.shadowBlur = 0;
    const off = land ? 0 : (b.next / b.iv) * 14; g.beginPath(); g.rect(-w / 2 + 3, -h / 2 + 3, w - 6, h - 6); g.clip();
    for (const [dy, wpn] of [[off, b.show], [off - 28, BOX_POOL[(b.k + 1) % 3]]]) { g.save(); g.translate(0, dy - 4); drawWeaponIcon(wpn); g.restore(); }
    g.restore(); txt(WNAME(b.show), BOX.x, y + h / 2 + 8, 7, land ? PAL.yel : '#fff');
  }
}
function drawWeaponIcon(w) {
  if (w === 'saber') { g.rotate(-0.5); g.translate(-18, 0); drawBlade(30); return; }
  const im = imgs[w === 'crowbar' ? 'crowbar' : w === 'gun' ? 'm16' : 'baseball-bat']; g.imageSmoothingEnabled = false;
  if (im && im.complete && im.naturalWidth) g.drawImage(im, -14, -14, 28, 28); else { g.fillStyle = '#c8955a'; g.fillRect(-12, -2, 24, 4); }
}
function drawGuy(o, body, head, dead, maskImg, wpn, swing) {
  g.save(); g.translate(o.x, o.y); g.rotate(o.a);
  if (dead) { g.fillStyle = body; g.fillRect(-14, -8, 24, 16); g.fillStyle = head; g.fillRect(8, -6, 10, 12); g.restore(); return; }
  g.fillStyle = '#000'; g.fillRect(-9, -11, 18, 22);
  g.fillStyle = body; g.fillRect(-8, -10, 16, 20); // shoulders
  // arms + weapon
  g.fillStyle = head; g.fillRect(4, -11, 8, 5); g.fillRect(4, 6, 8, 5);
  if (wpn === 'bat') { g.save(); g.translate(10, 8); g.rotate(swing > 0 ? -1.6 + (0.16 - swing) * 14 : -0.4); g.fillStyle = '#c8955a'; g.fillRect(0, -2, 24, 4); g.fillStyle = '#8a5a2b'; g.fillRect(0, -2, 7, 4); g.restore(); }
  if (wpn === 'crowbar') { g.save(); g.translate(10, 8); g.rotate(swing > 0 ? -1.7 + (0.16 - swing) * 15 : -0.4); g.fillStyle = '#b8c4d6'; g.fillRect(0, -1.5, 22, 3); g.fillRect(19, -1.5, 3, -5); g.fillStyle = '#c0392b'; g.fillRect(0, -1.5, 6, 3); g.restore(); }
  if (wpn === 'saber') { g.save(); g.translate(10, 8); g.rotate(swing > 0 ? -1.6 + (0.16 - swing) * 14 : -0.4); g.fillStyle = '#9aa3ad'; g.fillRect(-2, -2.5, 9, 5); g.fillStyle = '#333'; g.fillRect(1, -2.5, 2, 5); g.restore(); }
  if (wpn === 'gun') { g.fillStyle = '#ddd'; g.fillRect(10, -2, 18, 4); g.fillStyle = '#333'; g.fillRect(10, -2, 6, 4); }
  if (!wpn && swing > 0) { g.fillStyle = head; g.fillRect(12, -3, 10, 6); }
  if (maskImg && maskImg.complete && maskImg.naturalWidth) { g.rotate(Math.PI / 2); g.imageSmoothingEnabled = false; g.drawImage(maskImg, -11, -11, 22, 22); }
  else { g.fillStyle = head; g.fillRect(-6, -6, 12, 12); g.fillStyle = '#3a1c0a'; g.fillRect(-6, -6, 6, 12); }
  g.restore();
}
function render() {
  g.setTransform(DPR, 0, 0, DPR, 0, 0); g.fillStyle = '#150530'; g.fillRect(0, 0, W, H);
  if (mode === 'select') return renderSelect();
  const sh = S.shake, ox = (Math.random() - .5) * sh, oy = (Math.random() - .5) * sh;
  g.save(); g.translate(W / 2 + ox, H / 2 + oy); g.scale(zoom, zoom); g.translate(-S.cam.x, -S.cam.y);
  // floor
  const t = S.t;
  const MWp = MW * TS, MHp = MH * TS; g.imageSmoothingEnabled = true;
  g.drawImage(MAPC.floor, 0, 0, MWp, MHp);
  g.fillStyle = PAL.blood; for (const d of S.decals) g.fillRect(d.x, d.y, d.s, d.s);
  g.drawImage(MAPC.walls, 0, 0, MWp, MHp);
  // car
  g.save(); g.translate(CAR.x, CAR.y); g.fillStyle = '#7a0f2a'; g.fillRect(-36, -16, 72, 32); g.fillStyle = '#16f4ff55'; g.fillRect(-10, -13, 22, 26); g.fillStyle = '#ff2a8a'; g.fillRect(-36, -16, 72, 3); g.restore();
  if (S.clear && !S.won) { const b = 0.5 + 0.5 * Math.sin(t * 8); g.strokeStyle = `rgba(255,225,77,${b})`; g.lineWidth = 3; g.strokeRect(CAR.x - 42, CAR.y - 22, 84, 44); }
  // items
  drawBox(t);
  for (const it of S.items) { if (it.age > 21 && Math.floor(S.t * 8) % 2) continue; g.save(); g.translate(it.x, it.y); g.rotate(it.spin); drawWeaponIcon(it.type);
    if (it.fly <= 0) { g.strokeStyle = PAL.yel; g.globalAlpha = 0.4 + 0.3 * Math.sin(t * 6); g.strokeRect(-15, -15, 30, 30); } g.restore(); }
  for (const e of S.en) if (e.dead) drawGuy(e, '#e8e8e8', '#e0b48a', true);
  if (S.p.dead) drawGuy(S.p, '#2a6cff', '#e0b48a', true);
  for (const e of S.en) if (!e.dead && !(e.inT > 0)) { drawGuy(e, e.stun > 0 ? '#9a9a9a' : '#f2f2f2', '#e0b48a', false, null, e.w, e.swing); if (e.stun > 0) txt('Z', e.x + 10, e.y - 16, 8, PAL.cyan); }
  if (S.boss) drawBoss(S.boss, t);
  for (const q of S.smears) { g.save(); g.translate(q.x, q.y); g.scale(q.sx, 1); drawEmblem(0, 0, 30, 0.3 * (1 - q.t / 1.6) * Math.max(S.embA, 0.3), q.rot); g.restore(); }
  if (!S.p.dead && S.embA > 0.01) drawEmblem(S.p.x, S.p.y, 34 * (1 + 0.05 * Math.sin(S.t * 5)), S.embA * (S.pwOn > 0 ? pwFade() * 0.35 + 0.6 : 0.95), 0);
  if (S.pwOn > 0 && !S.p.dead) drawAura();
  if (!S.p.dead && !(S.inv > 0 && Math.floor(S.t * 20) % 2)) drawGuy(S.p, S.pwOn > 0 ? `hsl(${(S.t * 240) % 360},100%,65%)` : '#ff4fa3', '#e0b48a', false, imgs[S.mask.id], S.p.wpn, S.p.swing);
  if (!S.p.dead && S.p.wpn === 'saber') { const q = saberPts(S.p, S.p.swing); drawSaber(q[0], q[1], q[2], q[3], S.t); }
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
  txt(`${S.mask.name}  ${WNAME(S.p.wpn) + (S.p.wpn === 'gun' ? ' ' + S.p.ammo : '')}`, 16, H - 24, hs * 0.8, '#fff', 'left', PAL.vio);
  txt(`ENEMIES ${S.en.filter(e => !e.dead).length + (S.boss && !S.boss.dead ? 1 : 0)}`, 16, 56, hs * 0.8, PAL.pink, 'left');
  if (S.gm === 'waves') {
    const wl = S.wave >= BOSS_WAVE ? 'BOSS' : `WAVE ${S.wave}/${WAVES}`; txt(wl, 16, 56 + hs * 1.6, hs * 0.95, S.wave >= BOSS_WAVE ? PAL.pink : PAL.yel, 'left', PAL.vio);
    if (S.waveT > 0 && !S.p.dead) { const n = Math.ceil(S.waveT), k = 1 + (S.tick || 0) * 0.35; g.save(); g.translate(W / 2, H * 0.24); g.scale(k, k); g.rotate(-0.04);
      txt(S.wave >= WAVES ? 'BOSS IN ' + n + '...' : 'NEXT WAVE IN ' + n + '...', 0, 0, Math.min(30, W / 16), n <= 3 ? PAL.pink : PAL.yel, 'center', n <= 3 ? PAL.cyan : PAL.pink); g.restore(); }
    const b = S.boss; if (b && (!b.dead || b.deadT < 2)) { const bw = isTouch ? Math.min(460, W - 190) : Math.min(460, W * 0.62), bh = 12, bx = W / 2 - bw / 2, by = isTouch ? 84 : 84, f = Math.max(0, b.hp / b.max);
      txt('THE ENFORCER', W / 2, by - 12, Math.max(8, hs * 0.75), b.phase === 2 ? PAL.pink : '#fff', 'center');
      g.fillStyle = '#000c'; g.fillRect(bx - 3, by - 3, bw + 6, bh + 6); g.fillStyle = b.phase === 2 ? '#ff2030' : '#d4142a'; g.shadowColor = '#ff2030'; g.shadowBlur = b.hitT > 0 ? 20 : 8; g.fillRect(bx, by, bw * f, bh); g.shadowBlur = 0;
      g.strokeStyle = '#fff'; g.lineWidth = 2; g.strokeRect(bx, by, bw, bh); g.fillStyle = PAL.yel; g.fillRect(bx + bw / 2 - 1, by - 3, 2, bh + 6); }
    if (S.boss && S.boss.dead && mode !== 'results') { const k = Math.min(1, S.boss.deadT * 1.5); g.save(); g.globalAlpha = k; g.translate(W / 2, H * 0.3); g.rotate(-0.05); g.scale(1 + (1 - k) * 2, 1 + (1 - k) * 2); txt('WAVES CLEARED', 0, 0, Math.min(40, W / 13), PAL.yel, 'center', PAL.pink); g.restore(); }
  }
  if (S.pwOn > 0) { const f = pwFade(), hue = (S.t * 240) % 360, gr = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
    gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, `hsla(${hue},100%,55%,${0.32 * f})`); g.fillStyle = gr; g.fillRect(0, 0, W, H);
    g.fillStyle = `hsla(${hue},100%,65%,${f})`; g.fillRect(0, 0, W * S.pwOn / PW_DUR, 5); }
  if (S.dil > 0) { g.fillStyle = `rgba(255,255,255,${S.dil * 0.5})`; g.fillRect(0, 0, W, H); }
  drawPowerHUD(hs);
  if (isTouch) for (const s of [touch.move, touch.aim]) if (s) { const dx = s.cx - s.x, dy = s.cy - s.y, d = Math.hypot(dx, dy), l = Math.min(50, d), kx = s.x + (d ? dx / d * l : 0), ky = s.y + (d ? dy / d * l : 0), aim = s === touch.aim;
    g.save(); g.lineWidth = 3; g.strokeStyle = (aim ? PAL.pink : PAL.cyan) + '88'; g.beginPath(); g.arc(s.x, s.y, 50, 0, 6.283); g.stroke();
    if (aim) { g.strokeStyle = PAL.pink + '44'; g.lineWidth = 1; g.beginPath(); g.arc(s.x, s.y, 18, 0, 6.283); g.stroke(); }
    g.fillStyle = (aim ? (d > 18 ? PAL.pink : '#ff2a8a66') : PAL.cyan) + (aim && d <= 18 ? '' : 'aa'); g.beginPath(); g.arc(kx, ky, 18, 0, 6.283); g.fill(); g.restore(); }
  if (nearBox()) { const k = 1 + 0.06 * Math.sin(S.t * 8); g.save(); g.translate(W / 2, H * 0.68); g.scale(k, k); txt(isTouch ? 'TAP OPEN: MYSTERY BOX' : 'PRESS E: SPIN THE MYSTERY BOX', 0, 0, Math.min(14, W / 34), PAL.yel, 'center', PAL.pink); g.restore(); }
  if (tThrowB) { const lbl = nearBox() ? 'OPEN' : 'THROW'; if (tThrowB.textContent !== lbl) tThrowB.textContent = lbl; }
  if (S.clear && !S.won) { const s = 1 + 0.08 * Math.sin(S.t * 10); g.save(); g.translate(W / 2, H * 0.22); g.scale(s, s); g.rotate(-0.05); txt('GO TO CAR', 0, 0, Math.min(40, W / 14), PAL.yel, 'center', PAL.pink); g.restore(); }
  if (S.p.dead) { g.fillStyle = 'rgba(80,0,20,.35)'; g.fillRect(0, 0, W, H); const s = 1 + 0.05 * Math.sin(S.t * 8); g.save(); g.translate(W / 2, H / 2); g.scale(s, s); txt("YOU'RE DEAD", 0, -30, Math.min(34, W / 16), PAL.pink, 'center', '#000'); txt(isTouch ? 'TAP R TO RESTART' : 'PRESS R TO RESTART', 0, 24, Math.min(18, W / 30), PAL.yel);
    if (S.gm === 'waves') txt((S.wave >= BOSS_WAVE ? 'REACHED THE BOSS' : 'REACHED WAVE ' + S.wave + '/' + WAVES) + '  -  ' + S.score + 'pts', 0, 64, Math.min(14, W / 34), PAL.cyan); g.restore(); }
  if (mode === 'results') renderResults();
  if (mode === 'paused') renderPause();
}
let pauseBoxes = [];
function pauseHit(x, y) { const b = pauseBoxes.find(b => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h); if (b) b.fn(x, b.x, b.w); }
function renderPause() {
  g.fillStyle = 'rgba(11,2,22,.82)'; g.fillRect(0, 0, W, H);
  const fs = Math.min(34, W / 12, H / 12); txt('PAUSED', W / 2, H * 0.14, fs, PAL.pink, 'center', PAL.cyan);
  const A = window.NCA, vol = A ? Math.round(A.vol * 100) : 0, mute = A ? A.muted : true;
  const items = [['RESUME', resume, isTouch ? '' : ' [ESC]'], ['RESTART', newRun, isTouch ? '' : ' [R]'], ['SOUND: ' + (mute ? 'OFF' : 'ON'), () => A && A.toggleMute(), isTouch ? '' : ' [N]'],
    ['VOL', (x, bx, bw) => A && A.setVol(A.vol + (x < bx + bw / 2 ? -0.1 : 0.1)), ''], ['QUIT TO MASKS', quitToSelect, isTouch ? '' : ' [Q]']];
  const bw = Math.min(320, W - 40), gapY = 10, bh = Math.max(36, Math.min(54, (H * 0.78) / items.length - gapY)), y0 = H * 0.2; pauseBoxes = [];
  items.forEach(([label, fn, key], i) => { const x = W / 2 - bw / 2, y = y0 + i * (bh + gapY); pauseBoxes.push({ x, y, w: bw, h: bh, fn });
    g.fillStyle = i ? '#1a0330' : '#2a0646'; g.fillRect(x, y, bw, bh); g.strokeStyle = i ? PAL.vio : PAL.yel; g.lineWidth = 3; g.strokeRect(x, y, bw, bh);
    if (label === 'VOL') { txt('-', x + 22, y + bh / 2, 16, PAL.cyan); txt('+', x + bw - 22, y + bh / 2, 16, PAL.cyan); g.fillStyle = '#000'; g.fillRect(x + 44, y + bh / 2 - 6, bw - 88, 12); g.fillStyle = mute ? '#555' : PAL.cyan; g.fillRect(x + 44, y + bh / 2 - 6, (bw - 88) * vol / 100, 12);
      txt('VOLUME ' + vol + '%' + (isTouch ? '' : ' [-/+]'), W / 2, y + bh / 2 - 15 + (bh < 44 ? 6 : 0), 8, '#fff'); return; }
    txt(label + key, W / 2, y + bh / 2, Math.min(14, bw / 20), i ? '#fff' : PAL.yel); });
}
let selBoxes = [];
function selectHit(x, y) { return selBoxes.findIndex(b => b && x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h); }
function renderSelect() {
  const t = performance.now() / 1000, sz = Math.min(W, H);
  txt('NIGHT CALL', W / 2, H * 0.12, Math.min(42, W / 12), PAL.pink, 'center', PAL.cyan);
  txt('CHOOSE YOUR MASK', W / 2, H * 0.12 + Math.min(42, W / 12) + 8, Math.min(14, W / 32), PAL.yel);
  const n = 3, cw = Math.min(200, (W - 60) / 3), ch = Math.min(cw * 1.35, H * 0.46), gap = 14, x0 = W / 2 - (n * cw + (n - 1) * gap) / 2, y0 = H * 0.27;
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
  // mode select: STORY / WAVES
  const mw = Math.min(170, (W - 50) / 2), mh = 44, my0 = y0 + ch + 14;
  ['story', 'waves'].forEach((m, i) => { const x = W / 2 - mw - 6 + i * (mw + 12), on = gameMode === m; selBoxes[10 + i] = { x, y: my0, w: mw, h: mh };
    g.fillStyle = on ? (m === 'waves' ? '#3a0a1a' : '#2a0646') : '#100219'; g.fillRect(x, my0, mw, mh); g.strokeStyle = on ? PAL.cyan : PAL.vio; g.lineWidth = on ? 3 : 1.5; g.shadowColor = PAL.cyan; g.shadowBlur = on ? 12 : 0; g.strokeRect(x, my0, mw, mh); g.shadowBlur = 0;
    txt(m === 'story' ? 'STORY' : `WAVES (${WAVES}+BOSS)`, x + mw / 2, my0 + mh / 2, Math.min(11, mw / 14), on ? '#fff' : '#aaa'); });
  if (gameMode === 'waves' && waveBest) txt(`WAVE BEST ${waveBest}pts ${waveBestGrade}`, W / 2, H - 50, Math.min(10, W / 55), PAL.cyan);
  txt(isTouch ? 'TAP A MASK, TAP AGAIN TO START' : '1-3 / CLICK TO PICK - TAB: MODE - ENTER TO START', W / 2, y0 + ch + 34 + 44, Math.min(11, W / 50), '#fff');
  txt(isTouch ? 'LEFT: MOVE  RIGHT: AIM+ATTACK  THROW BTN' : 'WASD MOVE - MOUSE AIM - CLICK ATTACK - RMB/SPACE THROW/PICK UP - Q POWER - P PAUSE - R RESTART', W / 2, y0 + ch + 58 + 44, Math.min(9, W / 80), PAL.vio, 'center');
  if (best && gameMode === 'story') txt(`BEST ${best}pts  ${bestGrade}`, W / 2, H - 30, Math.min(11, W / 50), PAL.yel);
}
function renderResults() {
  g.fillStyle = 'rgba(11,2,22,.86)'; g.fillRect(0, 0, W, H);
  const s = Math.min(1, W / 700), cx = W / 2; let y = H * 0.16;
  const wv = S.gm === 'waves';
  txt(wv ? 'WAVES CLEARED' : 'LEVEL COMPLETE', cx, y, 30 * s + 8, PAL.pink, 'center', PAL.cyan); y += 60 * s + 10;
  const rows = wv ? [['WAVES', WAVES + ' + BOSS'], ['KILLS', S.kills], ['MAX COMBO', 'x' + S.maxCombo], ['TIME', S.endT.toFixed(1) + 's'], ['WAVE SCORE', S.score], ['TIME BONUS', '+' + S.timeBonus], ['TOTAL', S.final + 'pts']] : [['KILLS', S.kills], ['MAX COMBO', 'x' + S.maxCombo], ['TIME', S.endT.toFixed(1) + 's'], ['SCORE', S.score], ['TIME BONUS', '+' + S.timeBonus], ['TOTAL', S.final + 'pts']];
  for (const [k, v] of rows) { txt(k, cx - 20, y, 12 * s + 4, '#fff', 'right'); txt(String(v), cx + 20, y, 12 * s + 4, PAL.yel, 'left'); y += 26 * s + 8; }
  const gs = 1 + 0.06 * Math.sin(performance.now() / 120); g.save(); g.translate(cx, y + 40 * s); g.scale(gs, gs); g.rotate(-0.1); txt(S.grade, 0, 0, 64 * s + 16, PAL.yel, 'center', PAL.pink); g.restore();
  y += 100 * s + 20; txt(S.test ? 'TEST MODE - SCORE NOT SAVED' : S.newBest ? (wv ? 'NEW WAVE BEST!' : 'NEW BEST!') : wv ? `WAVE BEST ${waveBest}pts ${waveBestGrade}` : `BEST ${best}pts ${bestGrade}`, cx, y, 12 * s + 4, S.newBest ? PAL.cyan : '#fff');
  const ready = resReady(), bw = Math.min(200, W / 2 - 24), bh = 44, by = Math.min(H - bh - 10, y + 22); resBoxes = [];
  [['PLAY AGAIN' + (isTouch ? '' : ' [R]'), newRun], ['MASKS' + (isTouch ? '' : ' [M]'), quitToSelect]].forEach(([l, fn], i) => { const bx = cx - bw - 8 + i * (bw + 16); resBoxes.push({ x: bx, y: by, w: bw, h: bh, fn });
    g.globalAlpha = ready ? 1 : 0.35; g.fillStyle = i ? '#1a0330' : '#2a0646'; g.fillRect(bx, by, bw, bh); g.strokeStyle = i ? PAL.vio : PAL.yel; g.lineWidth = 3; g.strokeRect(bx, by, bw, bh); txt(l, bx + bw / 2, by + bh / 2, Math.min(11, bw / 14), i ? '#fff' : PAL.yel); g.globalAlpha = 1; });
}
function resize() { touch.move = touch.aim = null; SAB = sabEl ? sabEl.offsetHeight : 0; DPR = Math.min(devicePixelRatio || 1, 2); W = innerWidth; H = innerHeight; cv.width = W * DPR; cv.height = H * DPR; zoom = Math.min(W, H) < 520 ? Math.max(1.35, Math.min(1.9, Math.max(W, H) / 560)) : Math.max(1, Math.min(2.2, Math.min(W, H) / 400)); }
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
window.NC = { touchMode: () => isTouch, audio: () => window.NCA && NCA.state(), state: () => S && ({ box: { st: S.box.st, res: S.box.res, show: S.box.show, x: BOX.x, y: BOX.y }, near: nearBox(), mode, gm: S.gm, wave: S.wave, waveT: S.waveT, boss: S.boss && { hp: S.boss.hp, max: S.boss.max, phase: S.boss.phase, st: S.boss.st, dead: S.boss.dead, x: S.boss.x, y: S.boss.y, stun: S.boss.stun }, enemyParams: S.en.filter(e => !e.dead).map(e => [e.w, +e.spd.toFixed(2), +e.react.toFixed(2), +e.smart.toFixed(2)]), wavesCleared: !!S.wavesCleared, test: S.test, pw: S.pw, pwOn: S.pwOn, hp: S.hp, inv: S.inv, reach: reach(), speed: pspeed(), p: { x: S.p.x, y: S.p.y, a: S.p.a, dead: S.p.dead, wpn: S.p.wpn, ammo: S.p.ammo }, en: S.en.map(e => ({ x: e.x, y: e.y, dead: e.dead, stun: e.stun, st: e.st, w: e.w })), items: S.items.map(i => ({ x: i.x, y: i.y, type: i.type })), score: S.score, kills: S.kills, clear: S.clear, won: S.won, grade: S.grade, final: S.final, maxCombo: S.maxCombo, car: CAR, zoom, cam: S.cam }), mode: () => mode, best: () => best };
})();
