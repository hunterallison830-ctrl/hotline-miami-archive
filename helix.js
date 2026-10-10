import * as THREE from 'three';
import { createGlitchMaterial } from './shaders/glitch.js';
import { createSmokeBackground } from './shaders/smoke.js';

const $ = s => document.querySelector(s);
const canvas = $('#gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
const scene = new THREE.Scene(); scene.background = null;
const camera = new THREE.PerspectiveCamera(62, 1, 0.1, 100);
camera.position.set(0, 0, 10);
const smoke = createSmokeBackground(renderer, scene);

// ---------- particle double helix of cubes ----------
const N = 360, cubeGeo = new THREE.BoxGeometry(0.07, 0.07, 0.07);
const cubeMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, depthWrite: false });
const cubes = new THREE.InstancedMesh(cubeGeo, cubeMat, N);
const dummy = new THREE.Object3D(), col = new THREE.Color();
const PAL = [0xff2a8a, 0x16f4ff, 0xb45cff, 0xffe14d];
for (let i = 0; i < N; i++) {
  const strand = i % 2, k = Math.floor(i / 2), t = k / (N / 2);
  const a = t * Math.PI * 8 + strand * Math.PI, y = (t - 0.5) * 18;
  dummy.position.set(Math.cos(a) * 1.6, y, Math.sin(a) * 1.6);
  dummy.rotation.set(a, a * 0.5, 0); dummy.updateMatrix(); cubes.setMatrixAt(i, dummy.matrix);
  cubes.setColorAt(i, col.set(PAL[(strand * 2 + (k % 7 === 0 ? 1 : 0)) % 4]));
}
const helixBG = new THREE.Group(); helixBG.add(cubes); helixBG.position.set(0.5, 0, -14); helixBG.rotation.z = 0.25;
scene.add(helixBG);

// ---------- card textures (lazy) ----------
const CW = 512, CH = 704, imgCache = new Map(), texCache = new Map();
const loadImg = src => {
  if (!src) return Promise.resolve(null);
  if (!imgCache.has(src)) imgCache.set(src, new Promise(r => { const i = new Image(); i.onload = () => r(i); i.onerror = () => r(null); i.src = src; }));
  return imgCache.get(src);
};
function cardCanvas(item, img, deck) {
  const c = document.createElement('canvas'); c.width = CW; c.height = CH; const g = c.getContext('2d');
  const grd = g.createLinearGradient(0, 0, 0, CH); grd.addColorStop(0, '#2a0646'); grd.addColorStop(1, '#0b0216');
  g.fillStyle = grd; g.fillRect(0, 0, CW, CH);
  g.globalAlpha = .18; g.fillStyle = '#ff2a8a'; for (let y = 0; y < CH; y += 6) g.fillRect(0, y, CW, 2); g.globalAlpha = 1;
  // portrait area
  const px = 36, py = 36, pw = CW - 72, ph = 440;
  const rg = g.createRadialGradient(CW / 2, py + ph / 2, 20, CW / 2, py + ph / 2, 320); rg.addColorStop(0, '#5a0b6e'); rg.addColorStop(1, '#000');
  g.fillStyle = rg; g.fillRect(px, py, pw, ph);
  if (img) {
    g.imageSmoothingEnabled = false; // pixel art: nearest-neighbour
    const s = Math.min(pw / img.naturalWidth, ph / img.naturalHeight) * (img.naturalWidth < 200 ? 0.8 : 1);
    const w = img.naturalWidth * s, h = img.naturalHeight * s;
    g.drawImage(img, px + (pw - w) / 2, py + (ph - h) / 2, w, h);
  } else {
    g.font = '96px "Press Start 2P"'; g.textAlign = 'center'; g.fillStyle = '#ff2a8a';
    g.fillText(item.name.split(/\s+/).map(w => w[0]).join('').slice(0, 3), CW / 2, py + ph / 2 + 40);
  }
  // borders
  g.lineWidth = 8; g.strokeStyle = '#16f4ff'; g.strokeRect(px, py, pw, ph);
  g.lineWidth = 10; g.strokeStyle = '#ff2a8a'; g.strokeRect(6, 6, CW - 12, CH - 12);
  // name
  g.textAlign = 'center'; g.fillStyle = '#fff';
  let name = item.name.toUpperCase(), fs = 30; g.font = `${fs}px "Press Start 2P"`;
  while (g.measureText(name).width > CW - 60 && fs > 14) { fs -= 2; g.font = `${fs}px "Press Start 2P"`; }
  const lines = [];
  if (g.measureText(name).width > CW - 60) { const ws = name.split(' '); let l = ''; for (const w of ws) { if (g.measureText(l + ' ' + w).width > CW - 60 && l) { lines.push(l); l = w; } else l = l ? l + ' ' + w : w; } lines.push(l); } else lines.push(name);
  lines.slice(0, 2).forEach((l, i) => {
    const y = 540 + i * (fs + 12);
    g.fillStyle = '#16f4ff'; g.fillText(l, CW / 2 - 3, y); g.fillStyle = '#ff2a8a'; g.fillText(l, CW / 2 + 3, y); g.fillStyle = '#fff'; g.fillText(l, CW / 2, y);
  });
  // tag line
  let tag = deck === 'masks' ? (item.animal || '').toUpperCase() : deck === 'weapons' ? `${item.type} · ${item.games.join('/')}`.toUpperCase() : `${item.status} · ${item.games.join('/')}`;
  g.font = '18px "Press Start 2P"'; g.fillStyle = /DEAD/.test(tag) ? '#ff3b3b' : '#ffe14d'; g.fillText(tag.slice(0, 26), CW / 2, 650);
  return c;
}
function getTexture(item, deck) {
  const key = deck + '|' + item.name;
  if (texCache.has(key)) return texCache.get(key);
  const blank = document.createElement('canvas'); blank.width = 4; blank.height = 4;
  const tex = new THREE.CanvasTexture(cardCanvas(item, null, deck)); tex.colorSpace = THREE.SRGBColorSpace; tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter; tex.generateMipmaps = false;
  texCache.set(key, tex);
  loadImg(item.img).then(img => { if (img) { tex.image = cardCanvas(item, img, deck); tex.needsUpdate = true; } });
  return tex;
}

// ---------- deck + card pool ----------
const POOL = 17, cardGeo = new THREE.PlaneGeometry(1.6, 2.2, 8, 8);
const pool = [];
for (let i = 0; i < POOL; i++) {
  const m = new THREE.Mesh(cardGeo, createGlitchMaterial(null)); m.visible = false; m.userData.idx = -1; scene.add(m); pool.push(m);
}
let lastDir = 0;
let D, deckName = 'characters', deck = [], cur = 0, target = 0, vel = 0, smVel = 0, lastInput = 0, dragging = false;

function setDeck(name) {
  deckName = name;
  const src = name === 'dead' ? D.characters.map((x, i) => ({ x, i, k: 'characters' })).filter(o => o.x.status.startsWith('DEAD'))
    : D[name].map((x, i) => ({ x, i, k: name }));
  deck = src; cur = target = 0; smVel = 0;
  document.querySelectorAll('#decks button').forEach(b => b.classList.toggle('on', b.dataset.deck === name));
  $('#ch').textContent = 'CH 0' + (['characters', 'masks', 'weapons', 'dead'].indexOf(name) + 1);
  pool.forEach(m => { m.userData.idx = -1; m.visible = false; });
  updateInfo(0, true);
}
let shownIdx = -1;
function updateInfo(i, force) {
  if (!deck.length || (i === shownIdx && !force)) return; shownIdx = i;
  const o = deck[i], x = o.x;
  $('#hxIdx').textContent = `${String(i + 1).padStart(2, '0')} / ${String(deck.length).padStart(2, '0')} ${deckName === 'dead' ? 'BODIES' : deckName.toUpperCase()}`;
  $('#hxName').textContent = x.name;
  const st = x.status ? `<span class="tag ${x.status.startsWith('DEAD') ? 'dead' : x.status === 'ALIVE' ? 'alive' : 'unk'}">${x.status}</span>` : '';
  $('#hxTags').innerHTML = st + (x.games || (x.entries || []).map(e => e.game).filter((g, j, a) => a.indexOf(g) === j)).map(g => `<span class="tag">${g}</span>`).join('') + (x.type ? `<span class="tag">${x.type.toUpperCase()}</span>` : '');
}
const openActive = () => { const o = deck[Math.round(cur)]; if (o) window.HM.open(o.k, o.i); };

// ---------- layout ----------
let mobile = false;
const V = (x, y, z) => new THREE.Vector3(x, y, z);
let L = {};
function layout() {
  const w = innerWidth, h = innerHeight; mobile = w / h < 0.8 || w < 700;
  renderer.setSize(w, h, false); camera.aspect = w / h;
  camera.fov = mobile ? 70 : 62; camera.updateProjectionMatrix();
  const halfW = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * 10 * camera.aspect;
  if (mobile) L = { active: V(0, 0.9, 3.6), activeS: 1.55, activeRY: 0.08, hx: V(0, -1.2, -4.5), R: 2.6, step: 0.62, drop: 0.55, recede: 0.35, hs: 0.8, exit: V(-halfW * 1.9, 2.5, 1), helixRY: 0 };
  else L = { active: V(-halfW * 0.2, -0.1, 2.2), activeS: 1.75, activeRY: 0.22, hx: V(halfW * 0.42, 2.9, -1.6), R: 2.8, step: 0.6, drop: 0.9, recede: 0.45, hs: 1.05, exit: V(-halfW * 1.6, -0.6, 0.5), helixRY: -0.35 };
  helixBG.position.x = mobile ? 0 : 0.8;
}
addEventListener('resize', layout);

function helixSlot(k, spin) { // k>=0 depth index
  const a = k * L.step + spin;
  const p = V(L.hx.x + Math.sin(a) * L.R, L.hx.y - k * L.drop, L.hx.z + (Math.cos(a) - 1) * L.R - k * L.recede);
  return { p, ry: a + L.helixRY, s: Math.max(0.32, L.hs - k * 0.035), op: k > 9 ? Math.max(0, 1 - (k - 9) / 4) : 1, blur: Math.min(1, k * 0.12) };
}
const bez = (a, b, c, t) => a.clone().multiplyScalar((1 - t) ** 2).add(b.clone().multiplyScalar(2 * (1 - t) * t)).add(c.clone().multiplyScalar(t * t));
const ease = t => t < .5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
function place(m, d, spin) {
  let p, ry, s, op = 1, blur = 0, rz = 0;
  if (d >= 1) { const h = helixSlot(d - 1, spin); p = h.p; ry = h.ry; s = h.s; op = h.op; blur = h.blur; }
  else if (d >= 0) { // helix top -> active along bezier
    const h = helixSlot(0, spin), t = ease(1 - d);
    const ctrl = V((h.p.x + L.active.x) / 2, Math.max(h.p.y, L.active.y) + (mobile ? 1.2 : 2.2), L.active.z + 1.5);
    p = bez(h.p, ctrl, L.active, t); ry = THREE.MathUtils.lerp(h.ry, L.activeRY, t); s = THREE.MathUtils.lerp(h.s, L.activeS, t);
    rz = Math.sin(t * Math.PI) * 0.18;
  } else { // active -> exit left
    const t = Math.min(1, -d), te = t * t;
    p = L.active.clone().lerp(L.exit, te); ry = L.activeRY + te * 0.9; s = THREE.MathUtils.lerp(L.activeS, 0.6, te); op = 1 - t; rz = te * 0.3;
  }
  m.position.copy(p); m.rotation.set(0, ry, rz); m.scale.setScalar(s);
  const u = m.material.uniforms; u.uOpacity.value = op; if (u.uBlur) u.uBlur.value = blur;
  m.renderOrder = Math.round(100 - d * 4);
  m.visible = op > 0.01;
}

// ---------- input ----------
const clampT = v => Math.max(0, Math.min(deck.length - 1, v));
addEventListener('wheel', e => { if (window.HM.isOpen()) return; e.preventDefault(); const dd = (e.deltaY + e.deltaX) * (e.deltaMode ? 0.12 : 0.0035); lastDir = Math.sign(dd); target = clampT(target + dd); lastInput = performance.now(); }, { passive: false });
let ty = 0, tx = 0, tStart = 0, moved = 0;
canvas.addEventListener('pointerdown', e => { dragging = true; ty = e.clientY; tx = e.clientX; tStart = target; moved = 0; canvas.setPointerCapture(e.pointerId); });
canvas.addEventListener('pointermove', e => {
  if (!dragging) return; const dy = ty - e.clientY, dx = tx - e.clientX; moved = Math.max(moved, Math.hypot(dx, dy));
  const nt = clampT(tStart + (mobile ? (dy + dx * 0.6) : dy) * (mobile ? 0.012 : 0.008)); lastDir = Math.sign(nt - target) || lastDir; target = nt; lastInput = performance.now();
});
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
canvas.addEventListener('pointerup', () => { dragging = false; lastInput = performance.now(); });
canvas.addEventListener('pointercancel', () => { dragging = false; });
// use click (fires after pointerup) so the synthetic click can't land on the freshly opened modal backdrop
canvas.addEventListener('click', e => {
  if (moved >= 8) return;
  ndc.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); ray.setFromCamera(ndc, camera);
  const hits = ray.intersectObjects(pool.filter(m => m.visible && m.material.uniforms.uOpacity.value > 0.3));
  if (hits.length) { const idx = hits[0].object.userData.idx; if (idx === Math.round(cur)) openActive(); else { target = idx; lastInput = performance.now(); } }
});
addEventListener('keydown', e => {
  if (window.HM.isOpen()) return;
  if (['ArrowDown', 'ArrowRight', 'PageDown', 'j'].includes(e.key)) { target = clampT(Math.round(target) + 1); e.preventDefault(); }
  else if (['ArrowUp', 'ArrowLeft', 'PageUp', 'k'].includes(e.key)) { target = clampT(Math.round(target) - 1); e.preventDefault(); }
  else if (e.key === 'Home') target = 0; else if (e.key === 'End') target = deck.length - 1;
  else if (e.key === 'Enter' || e.key === ' ') { openActive(); e.preventDefault(); }
  lastInput = performance.now();
});
$('#decks').addEventListener('click', e => { const b = e.target.closest('[data-deck]'); if (b) setDeck(b.dataset.deck); });
$('#hxOpen').addEventListener('click', openActive);
window.HX = { pick: (x, y) => { ndc.set(x / innerWidth * 2 - 1, -(y / innerHeight) * 2 + 1); ray.setFromCamera(ndc, camera); return ray.intersectObjects(pool.filter(m => m.visible)).map(h => [h.object.userData.idx, +h.distance.toFixed(2), +h.object.material.uniforms.uOpacity.value.toFixed(2)]); }, go: i => { target = clampT(i); }, scrollBy: d => { target = clampT(target + d); lastInput = performance.now(); }, state: () => ({ cur, target, vel: smVel, n: deck.length }) };

// ---------- loop ----------
const clock = new THREE.Clock();
function frame() {
  const t = clock.getElapsedTime(), dt = Math.min(clock.getDelta() || 0.016, 0.05);
  if (!dragging && performance.now() - lastInput > 140) { // snap, biased in the direction of travel so small flicks still advance
    const snapTo = clampT(lastDir > 0 ? Math.ceil(target - 0.2) : lastDir < 0 ? Math.floor(target + 0.2) : Math.round(target));
    target += (snapTo - target) * 0.18; if (Math.abs(snapTo - target) < 0.001) { target = snapTo; lastDir = 0; } }
  const prev = cur; cur += (target - cur) * (1 - Math.pow(0.0009, dt)); // damped
  if (Math.abs(target - cur) < 0.0005) cur = target;
  vel = (cur - prev) / Math.max(dt, 0.008); smVel += (Math.min(Math.abs(vel) * 0.35, 1.2) - smVel) * 0.15;
  const base = Math.floor(cur), spin = -cur * L.step * 0.0; // helix spin is per-slot; whole helix rotates via d
  // assign pool window: idx from base-1 .. base+POOL-2
  const want = new Set(); for (let j = -1; j < POOL - 1; j++) { const i = base + j; if (i >= 0 && i < deck.length) want.add(i); }
  const free = pool.filter(m => !want.has(m.userData.idx)); const have = new Set(pool.map(m => m.userData.idx));
  for (const i of want) if (!have.has(i)) { const m = free.pop(); if (!m) break; m.userData.idx = i; m.material.uniforms.uTex.value = getTexture(deck[i].x, deckName); }
  for (const m of pool) {
    const i = m.userData.idx; if (i < 0 || !want.has(i)) { m.visible = false; continue; }
    const d = i - cur; place(m, d, (d >= 1 ? 0 : 0) - (cur % 1) * 0); // helix rotates as d decreases
    m.material.uniforms.uTime.value = t; m.material.uniforms.uVelocity.value = smVel;
  }
  updateInfo(Math.round(cur));
  helixBG.rotation.y = t * 0.25 + cur * 0.35; helixBG.position.y = Math.sin(t * 0.3) * 0.4 + ((cur * 0.6) % 6) - 3;
  smoke.update(t);
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
async function start(d) {
  D = d; layout();
  const sp = [...document.querySelectorAll('#title span')].find(x => x.innerHTML === '&nbsp;'); if (sp) sp.outerHTML = '<br>';
  try { await Promise.race([document.fonts.load('30px "Press Start 2P"'), new Promise(r => setTimeout(r, 2500))]); } catch (e) {}
  const h = location.hash.slice(1); setDeck(['characters', 'masks', 'weapons', 'dead'].includes(h) ? h : 'characters');
  $('#loading').classList.add('done'); requestAnimationFrame(frame);
}
if (window.HM && window.HM.D) start(window.HM.D); else addEventListener('hmdata', () => start(window.HM.D), { once: true });
