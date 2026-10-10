import * as THREE from 'three';
import { createGlitchMaterial } from './shaders/glitch.js';
import { createSmokeBackground } from './shaders/smoke_v2.js';
import { createFX } from './fx.js';

const $ = s => document.querySelector(s);
const canvas = $('#gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: devicePixelRatio < 1.5, alpha: false, powerPreference: 'high-performance' });
renderer.outputColorSpace = THREE.SRGBColorSpace;
const scene = new THREE.Scene(); scene.background = null;
const camera = new THREE.PerspectiveCamera(62, 1, 0.5, 60);
camera.position.set(0, 0, 10);
const smoke = createSmokeBackground(renderer, scene);

// ---------- background double helix (infinite, scroll-driven, recycled) ----------
// Each slot k shows global segment g = k + floor(off); its position depends only on g and `off`,
// so a segment never jumps: when it leaves one end the slot is recycled at the other end, already faded to 0.
const HX_SEG = 120, HX_DY = 0.24, HX_DA = 0.33, HX_R = 1.7, RUNG_EVERY = 4, RUNG_N = 5;
const HX_RUNGS = Math.ceil(HX_SEG / RUNG_EVERY) * RUNG_N, HX_TOTAL = HX_SEG * 2 + HX_RUNGS;
const cubeGeo = new THREE.BoxGeometry(0.11, 0.11, 0.11);
const cubeMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
const cubes = new THREE.InstancedMesh(cubeGeo, cubeMat, HX_TOTAL);
cubes.instanceMatrix.setUsage(THREE.DynamicDrawUsage); cubes.frustumCulled = false;
cubes.setColorAt(0, new THREE.Color()); cubes.instanceColor.setUsage(THREE.DynamicDrawUsage);
// glow sprites on the strand cubes
const glowCan = document.createElement('canvas'); glowCan.width = glowCan.height = 64;
{ const g = glowCan.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); }
const glowGeo = new THREE.BufferGeometry();
const gPos = new Float32Array(HX_SEG * 2 * 3), gCol = new Float32Array(HX_SEG * 2 * 3);
glowGeo.setAttribute('position', new THREE.BufferAttribute(gPos, 3).setUsage(THREE.DynamicDrawUsage));
glowGeo.setAttribute('color', new THREE.BufferAttribute(gCol, 3).setUsage(THREE.DynamicDrawUsage));
const glows = new THREE.Points(glowGeo, new THREE.PointsMaterial({ size: 0.9, map: new THREE.CanvasTexture(glowCan), vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true }));
glows.frustumCulled = false;
const helixBG = new THREE.Group(); helixBG.add(cubes, glows); helixBG.position.set(0.5, 0, -16); helixBG.rotation.z = 0.22;
scene.add(helixBG);
const PINK = new THREE.Color(0xff2a8a), CYAN = new THREE.Color(0x16f4ff), VIOLET = new THREE.Color(0xb45cff);
const dummy = new THREE.Object3D(), col = new THREE.Color(), col2 = new THREE.Color();
let hxOff = 0, hxVel = 0, hxSpin = 0;
function updateHelixBG(t, dt, cardVel) {
  // velocity: gentle idle drift + scroll velocity, damped so it eases in/out with no jumps
  const want = 0.9 + THREE.MathUtils.clamp(cardVel, -14, 14) * 1.6;
  hxVel += (want - hxVel) * (1 - Math.exp(-3 * dt));
  hxOff += hxVel * dt; hxSpin += (0.25 + Math.abs(hxVel) * 0.04) * dt;
  const base = Math.floor(hxOff), fr = hxOff - base, half = HX_SEG / 2;
  let n = 0, gi = 0;
  for (let k = 0; k < HX_SEG; k++) {
    const g = base + k, y = (k - fr - half) * HX_DY;
    const edge = Math.min(k - fr, HX_SEG - 1 - (k - fr)) / 18;                     // fade both ends to 0
    const fade = THREE.MathUtils.clamp(edge, 0, 1); const f2 = fade * fade * (3 - 2 * fade);
    const pulse = 0.75 + 0.25 * Math.sin(t * 3 - g * 0.35);
    const ang = g * HX_DA + hxSpin, grad = 0.5 + 0.5 * Math.sin(g * 0.06);         // pink<->cyan gradient along the strand
    for (let s = 0; s < 2; s++) {
      const a = ang + s * Math.PI, x = Math.cos(a) * HX_R, z = Math.sin(a) * HX_R;
      dummy.position.set(x, y, z); dummy.rotation.set(a, g * 0.2, 0); dummy.scale.setScalar(0.8 + 0.4 * pulse); dummy.updateMatrix();
      cubes.setMatrixAt(n, dummy.matrix);
      col.copy(PINK).lerp(CYAN, s ? 1 - grad : grad).multiplyScalar(f2 * pulse * (0.75 + 0.25 * Math.sign(z + 0.001)));
      cubes.setColorAt(n++, col);
      gPos[gi] = x; gPos[gi + 1] = y; gPos[gi + 2] = z; gCol[gi] = col.r * 0.55; gCol[gi + 1] = col.g * 0.55; gCol[gi + 2] = col.b * 0.55; gi += 3;
    }
    if (((g % RUNG_EVERY) + RUNG_EVERY) % RUNG_EVERY === 0) { // rung between strands
      for (let r = 1; r <= RUNG_N; r++) {
        const u = r / (RUNG_N + 1), x = Math.cos(ang) * HX_R * (1 - 2 * u), z = Math.sin(ang) * HX_R * (1 - 2 * u);
        dummy.position.set(x, y, z); dummy.rotation.set(0, ang, 0); dummy.scale.setScalar(0.45); dummy.updateMatrix();
        cubes.setMatrixAt(n, dummy.matrix); cubes.setColorAt(n++, col2.copy(VIOLET).multiplyScalar(f2 * 0.6 * pulse));
      }
    }
  }
  cubes.count = n;
  cubes.instanceMatrix.needsUpdate = true; cubes.instanceColor.needsUpdate = true;
  glowGeo.attributes.position.needsUpdate = true; glowGeo.attributes.color.needsUpdate = true;
}

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
// LRU texture cache: Map keeps insertion order; re-insert on use, evict oldest unused beyond TEX_MAX
const TEX_MAX = 30;
const ph = document.createElement('canvas'); ph.width = 64; ph.height = 88;
{ const g = ph.getContext('2d'); g.fillStyle = '#12021f'; g.fillRect(0, 0, 64, 88); g.strokeStyle = '#ff2a8a'; g.lineWidth = 3; g.strokeRect(2, 2, 60, 84); g.fillStyle = '#2a0646'; g.fillRect(6, 6, 52, 52); }
const placeholder = new THREE.CanvasTexture(ph); placeholder.colorSpace = THREE.SRGBColorSpace; placeholder.magFilter = THREE.NearestFilter; placeholder.minFilter = THREE.NearestFilter; placeholder.generateMipmaps = false;
function pixelTex(tex) { tex.colorSpace = THREE.SRGBColorSpace; tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter; tex.generateMipmaps = false; return tex; }
function getTexture(item, deck) {
  const key = deck + '|' + item.name;
  if (texCache.has(key)) { const t = texCache.get(key); texCache.delete(key); texCache.set(key, t); return t; }
  const tex = pixelTex(new THREE.CanvasTexture(cardCanvas(item, null, deck)));
  texCache.set(key, tex);
  loadImg(item.img).then(img => { if (img && texCache.get(key) === tex) { tex.image = cardCanvas(item, img, deck); tex.needsUpdate = true; } });
  evict();
  return tex;
}
function evict() {
  if (texCache.size <= TEX_MAX) return;
  const inUse = new Set(pool.map(m => m.material.uniforms.uTex.value));
  for (const [k, t] of texCache) { if (texCache.size <= TEX_MAX) break; if (!inUse.has(t)) { texCache.delete(k); t.dispose(); } }
}

// ---------- deck + card pool ----------
const POOL = 17, cardGeo = new THREE.PlaneGeometry(1.6, 2.2, 8, 8);
const pool = [];
for (let i = 0; i < POOL; i++) {
  const m = new THREE.Mesh(cardGeo, createGlitchMaterial(placeholder)); m.visible = false; m.userData.idx = -1; m.userData.real = false; scene.add(m); pool.push(m);
}
let lastDir = 0, wheelAcc = 0;
let D, deckName = 'characters', deck = [], cur = 0, target = 0, vel = 0, smVel = 0, lastInput = 0, dragging = false;
let jump = null, fade = 1, lastBase = -99;

function setDeck(name) {
  deckName = name;
  deck = name === 'dead' ? D.characters.map((x, i) => ({ x, i, k: 'characters' })).filter(o => o.x.status.startsWith('DEAD'))
    : D[name].map((x, i) => ({ x, i, k: name }));
  cur = target = 0; smVel = 0; jump = null; lastBase = -99;
  document.querySelectorAll('#decks button').forEach(b => b.classList.toggle('on', b.dataset.deck === name));
  $('#ch').textContent = 'CH 0' + (['characters', 'masks', 'weapons', 'dead'].indexOf(name) + 1);
  pool.forEach(m => { m.userData.idx = -1; m.userData.real = false; m.material.uniforms.uTex.value = placeholder; m.visible = false; });
  updateInfo(0, true);
}
let shownIdx = -1;
function updateInfo(i, force) {
  if (!deck.length || (i === shownIdx && !force)) return; shownIdx = i;
  const o = deck[i], x = o.x;
  $('#hxIdx').textContent = `${String(i + 1).padStart(2, '0')} / ${String(deck.length).padStart(2, '0')} ${deckName === 'dead' ? 'BODIES' : deckName.toUpperCase()}`;
  $('#hxName').textContent = x.name;
  const gl = $('#toGrid'); if (gl) gl.href = `index.html?deck=${deckName}&at=${encodeURIComponent(window.HM.slug(x))}`;
  const st = x.status ? `<span class="tag ${x.status.startsWith('DEAD') ? 'dead' : x.status === 'ALIVE' ? 'alive' : 'unk'}">${x.status}</span>` : '';
  $('#hxTags').innerHTML = st + (x.games || (x.entries || []).map(e => e.game).filter((g, j, a) => a.indexOf(g) === j)).map(g => `<span class="tag">${g}</span>`).join('') + (x.type ? `<span class="tag">${x.type.toUpperCase()}</span>` : '');
}
const openActive = () => { const o = deck[Math.round(cur)]; if (o) window.HM.open(o.k, o.i); };

// ---------- layout ----------
let mobile = false, short = false;
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const L = { active: V(0, 0, 0), hx: V(0, 0, 0), exit: V(0, 0, 0) };
function layout() {
  const w = innerWidth, h = innerHeight; mobile = w / h < 0.95 || (w < 700 && h >= 500); short = !mobile && h < 500; // short = phone landscape
  renderer.setPixelRatio(Math.min(devicePixelRatio, mobile ? 1.5 : 2)); // re-applied on every resize (DPR changes across monitors)
  renderer.setSize(w, h, false); camera.aspect = w / h;
  camera.fov = mobile ? 70 : 62; camera.updateProjectionMatrix();
  const halfW = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * 10 * camera.aspect;
  if (mobile) { L.active.set(0, 0.9, 3.6); Object.assign(L, { activeS: 1.55, activeRY: 0.08, R: 2.6, step: 0.62, drop: 0.55, recede: 0.35, hs: 0.8, helixRY: 0 }); L.hx.set(0, -1.2, -4.5); L.exit.set(-halfW * 1.9, 2.5, 1); }
  else if (short) { const hh = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * 10; L.active.set(-halfW * 0.02, -0.05, 2.6); Object.assign(L, { activeS: Math.min(1.75, hh * 0.62), activeRY: 0.18, R: 2.4, step: 0.6, drop: 0.7, recede: 0.45, hs: 0.95, helixRY: -0.35 }); L.hx.set(halfW * 0.55, 2.2, -1.6); L.exit.set(-halfW * 1.6, -0.6, 0.5); }
  else { L.active.set(-halfW * 0.2, -0.1, 2.2); Object.assign(L, { activeS: 1.75, activeRY: 0.22, R: 2.8, step: 0.6, drop: 0.9, recede: 0.45, hs: 1.05, helixRY: -0.35 }); L.hx.set(halfW * 0.42, 2.9, -1.6); L.exit.set(-halfW * 1.6, -0.6, 0.5); }
  helixBG.position.x = mobile ? 0 : short ? 1.5 : 0.8;
}
let rzPending = false;
addEventListener('resize', () => { if (rzPending) return; rzPending = true; requestAnimationFrame(() => { rzPending = false; layout(); }); });

// scratch objects: no per-frame allocation
const _p = new THREE.Vector3(), _h = new THREE.Vector3(), _c = new THREE.Vector3();
const slot = { ry: 0, s: 1, op: 1, blur: 0 };
function helixSlot(out, k) { // k>=0 depth index; writes position into out, other props into `slot`
  const a = k * L.step;
  out.set(L.hx.x + Math.sin(a) * L.R, L.hx.y - k * L.drop, L.hx.z + (Math.cos(a) - 1) * L.R - k * L.recede);
  slot.ry = a + L.helixRY; slot.s = Math.max(0.32, L.hs - k * 0.035); slot.op = k > 9 ? Math.max(0, 1 - (k - 9) / 4) : 1; slot.blur = Math.min(1, k * 0.12);
  return out;
}
function bezInto(out, a, b, c, t) { const u = 1 - t; return out.copy(a).multiplyScalar(u * u).addScaledVector(b, 2 * u * t).addScaledVector(c, t * t); }
const ease = t => t < .5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
function place(m, d) {
  let ry, s, op = 1, blur = 0, rz = 0;
  if (d >= 1) { helixSlot(_p, d - 1); ry = slot.ry; s = slot.s; op = slot.op; blur = slot.blur; }
  else if (d >= 0) { // helix top -> active along bezier
    helixSlot(_h, 0); const t = ease(1 - d);
    _c.set((_h.x + L.active.x) / 2, Math.max(_h.y, L.active.y) + (mobile ? 1.2 : 2.2), L.active.z + 1.5);
    bezInto(_p, _h, _c, L.active, t); ry = THREE.MathUtils.lerp(slot.ry, L.activeRY, t); s = THREE.MathUtils.lerp(slot.s, L.activeS, t);
    rz = Math.sin(t * Math.PI) * 0.18;
  } else { // active -> exit left
    const t = Math.min(1, -d), te = t * t;
    _p.copy(L.active).lerp(L.exit, te); ry = L.activeRY + te * 0.9; s = THREE.MathUtils.lerp(L.activeS, 0.6, te); op = 1 - t; rz = te * 0.3;
  }
  op *= fade;
  m.position.copy(_p); m.rotation.set(0, ry, rz); m.scale.setScalar(s);
  const u = m.material.uniforms; u.uOpacity.value = op; if (u.uBlur) u.uBlur.value = blur;
  m.renderOrder = Math.round(100 - d * 4);
  m.visible = op > 0.01;
}

// ---------- input ----------
const clampT = v => Math.max(0, Math.min(deck.length - 1, v));
const JUMP_MS = 750, FADE_JUMP = 20;
function jumpTo(i) {
  i = clampT(Math.round(i)); lastInput = performance.now(); lastDir = 0;
  if (Math.abs(i - cur) < 3) { jump = null; target = i; return; }   // short hops keep the damped feel
  jump = { from: cur, to: i, t0: performance.now(), dur: JUMP_MS, xfade: Math.abs(i - cur) > FADE_JUMP };
  target = i;
}
// wheel: mouse notches (|delta|>=50) move exactly 1 card; trackpads accumulate small deltas into whole cards
addEventListener('wheel', e => {
  if (window.HM.isOpen()) return; e.preventDefault(); if (jump) return;
  let d = (e.deltaY + e.deltaX) * (e.deltaMode === 1 ? 33 : e.deltaMode === 2 ? 400 : 1);
  if (Math.abs(d) >= 50) { const s = Math.sign(d); target = clampT(Math.round(target) + s); lastDir = s; wheelAcc = 0; }
  else { wheelAcc += d * 0.012; const step = Math.max(-1, Math.min(1, wheelAcc)); target = clampT(target + step); wheelAcc -= step; lastDir = Math.sign(step) || lastDir; }
  lastInput = performance.now();
}, { passive: false });
let ty = 0, tx = 0, tStart = 0, moved = 0;
canvas.addEventListener('pointerdown', e => { dragging = true; jump = null; ty = e.clientY; tx = e.clientX; tStart = target = cur; moved = 0; canvas.setPointerCapture(e.pointerId); });
canvas.addEventListener('pointermove', e => {
  if (!dragging) return; const dy = ty - e.clientY, dx = tx - e.clientX; moved = Math.max(moved, Math.hypot(dx, dy));
  const nt = clampT(tStart + (mobile ? (dy + dx * 0.6) : dy) * (mobile ? 0.012 : 0.008)); lastDir = Math.sign(nt - target) || lastDir; target = nt; lastInput = performance.now();
});
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
canvas.addEventListener('pointerup', () => { dragging = false; lastInput = performance.now(); });
canvas.addEventListener('pointercancel', () => { dragging = false; });
// click (fires after pointerup) so the synthetic click can't land on the freshly opened modal backdrop
canvas.addEventListener('click', e => {
  if (moved >= 8) return;
  ndc.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); ray.setFromCamera(ndc, camera);
  const hits = ray.intersectObjects(pool.filter(m => m.visible && m.material.uniforms.uOpacity.value > 0.3));
  if (hits.length) { const idx = hits[0].object.userData.idx; if (idx === Math.round(cur)) openActive(); else jumpTo(idx); }
});
addEventListener('keydown', e => {
  if (window.HM.isOpen()) return;
  if (e.target instanceof Element && e.target.closest('button,a,input,textarea,select,[contenteditable]')) return; // let focused controls handle their own keys
  const base = jump ? jump.to : Math.round(target);
  if (['ArrowDown', 'ArrowRight', 'PageDown', 'j'].includes(e.key)) { jumpTo(base + (e.key === 'PageDown' ? 5 : 1)); e.preventDefault(); }
  else if (['ArrowUp', 'ArrowLeft', 'PageUp', 'k'].includes(e.key)) { jumpTo(base - (e.key === 'PageUp' ? 5 : 1)); e.preventDefault(); }
  else if (e.key === 'Home') jumpTo(0); else if (e.key === 'End') jumpTo(deck.length - 1);
  else if (e.key === 'Enter' || e.key === ' ') { openActive(); e.preventDefault(); }
});
$('#decks').addEventListener('click', e => { const b = e.target.closest('[data-deck]'); if (b) setDeck(b.dataset.deck); });
$('#hxOpen').addEventListener('click', openActive);
window.HX = {
  pick: (x, y) => { ndc.set(x / innerWidth * 2 - 1, -(y / innerHeight) * 2 + 1); ray.setFromCamera(ndc, camera); return ray.intersectObjects(pool.filter(m => m.visible)).map(h => [h.object.userData.idx, +h.distance.toFixed(2)]); },
  go: jumpTo, scrollBy: d => { target = clampT(target + d); lastInput = performance.now(); },
  state: () => ({ cur, target, vel: smVel, n: deck.length, jumping: !!jump, textures: texCache.size, dpr: renderer.getPixelRatio() })
};

const fx = createFX($('#fx'), () => D);
// ---------- loop ----------
const clock = new THREE.Clock();
const VCAP = 0.75, CARDS_PER_SEC_MAX = 12;
function assignPool(base) {
  for (const m of pool) { const i = m.userData.idx; if (i < base - 1 || i > base + POOL - 2) { m.userData.idx = -1; m.visible = false; } }
  for (let j = -1; j < POOL - 1; j++) {
    const i = base + j; if (i < 0 || i >= deck.length) continue;
    let has = false; for (const m of pool) if (m.userData.idx === i) { has = true; break; }
    if (has) continue;
    for (const m of pool) if (m.userData.idx === -1) { m.userData.idx = i; m.userData.real = false; m.material.uniforms.uTex.value = placeholder; break; }
  }
}
function frame() {
  const dt = Math.min(clock.getDelta(), 0.05), t = clock.elapsedTime;
  const prev = cur;
  if (jump) {
    const k = Math.min(1, (performance.now() - jump.t0) / jump.dur);
    if (jump.xfade) { // long jump: fade out, cut, fade in
      fade = k < 0.4 ? 1 - k / 0.4 : k > 0.6 ? (k - 0.6) / 0.4 : 0;
      cur = k < 0.5 ? jump.from : jump.to;
    } else cur = jump.from + (jump.to - jump.from) * ease(k);
    if (k >= 1) { cur = target = jump.to; jump = null; fade = 1; }
  } else {
    if (!dragging && performance.now() - lastInput > 140) { // snap, biased in the direction of travel
      const snapTo = clampT(lastDir > 0 ? Math.ceil(target - 0.2) : lastDir < 0 ? Math.floor(target + 0.2) : Math.round(target));
      target += (snapTo - target) * (1 - Math.exp(-12 * dt)); if (Math.abs(snapTo - target) < 0.001) { target = snapTo; lastDir = 0; }
    }
    cur += (target - cur) * (1 - Math.exp(-7 * dt));
    if (Math.abs(target - cur) < 0.0005) cur = target;
  }
  vel = (cur - prev) / Math.max(dt, 1e-3);                                  // cards per second
  const vT = (jump && jump.xfade) ? 0.35 : Math.min(Math.abs(vel) / CARDS_PER_SEC_MAX, VCAP);
  smVel += (vT - smVel) * (1 - Math.exp(-10 * dt));
  const base = Math.floor(cur);
  if (base !== lastBase) { lastBase = base; assignPool(base); }
  // textures: none while jumping; afterwards build at most one per frame, nearest-to-active first
  if (!jump && Math.abs(vel) < 2) {
    let best = null, bd = 1e9;
    for (const m of pool) { if (m.userData.idx < 0 || m.userData.real) continue; const d = Math.abs(m.userData.idx - cur); if (d < bd) { bd = d; best = m; } }
    if (best) { best.material.uniforms.uTex.value = getTexture(deck[best.userData.idx].x, deckName); best.userData.real = true; }
  }
  for (const m of pool) {
    const i = m.userData.idx; if (i < 0) { m.visible = false; continue; }
    place(m, i - cur);
    m.material.uniforms.uTime.value = t; m.material.uniforms.uVelocity.value = smVel;
  }
  updateInfo(Math.round(cur));
  updateHelixBG(t, dt, jump && jump.xfade ? 0 : vel);
  fx.update(t, dt, cur, jump && jump.xfade ? 0 : vel);
  smoke.update(t);
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
async function start(d) {
  D = d; layout();
  const sp = [...document.querySelectorAll('#title span')].find(x => x.innerHTML === '&nbsp;'); if (sp) sp.outerHTML = '<br>';
  try { await Promise.race([document.fonts.load('30px "Press Start 2P"'), new Promise(r => setTimeout(r, 2500))]); } catch (e) {}
  // #deck, #item-id (opens its dossier) or ?deck=&at= (from grid: restore place, don't open)
  const P = new URLSearchParams(location.search), h = decodeURIComponent(location.hash.slice(1));
  const decks = ['characters', 'masks', 'weapons', 'dead'];
  const hit = decks.includes(h) ? null : window.HM.find(h), at = window.HM.find(P.get('at'));
  const pd = P.get('deck');
  const dk = hit ? hit.k : decks.includes(h) ? h : decks.includes(pd) ? pd : at ? at.k : 'characters';
  setDeck(dk);
  const want = hit || at;
  if (want) { const j = deck.findIndex(o => o.k === want.k && o.i === want.i); if (j >= 0) { cur = target = j; updateInfo(j, true); } }
  $('#loading').classList.add('done');
  if (hit) window.HM.open(hit.k, hit.i); clock.getDelta(); requestAnimationFrame(frame);
}
if (window.HM && window.HM.D) start(window.HM.D); else addEventListener('hmdata', () => start(window.HM.D), { once: true });
