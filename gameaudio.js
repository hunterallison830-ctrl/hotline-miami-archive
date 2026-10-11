// NIGHT CALL audio: original synthwave/darksynth music sequenced live with WebAudio + synthesised SFX. No audio files.
// The AudioContext is created on the first user gesture only. Settings (volume, mute) persist in localStorage.
(() => {
  const KEY = 'hm_nc_audio';
  let cfg = { vol: 0.7, mute: false }; try { Object.assign(cfg, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) {}
  let ac = null, master, music, sfx, delay, fb, dist, nb, rec = null;
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(cfg)); } catch (e) {} };
  const applyVol = () => { if (master) master.gain.setTargetAtTime(cfg.mute ? 0 : cfg.vol, ac.currentTime, 0.03); };
  function init() {
    if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
    const C = window.AudioContext || window.webkitAudioContext; if (!C) return;
    ac = new C(); master = ac.createGain(); const comp = ac.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4;
    master.connect(comp).connect(ac.destination);
    music = ac.createGain(); music.gain.value = 0.42; music.connect(master);
    sfx = ac.createGain(); sfx.gain.value = 0.8; sfx.connect(master);
    delay = ac.createDelay(1); delay.delayTime.value = 0.375; fb = ac.createGain(); fb.gain.value = 0.35; const dl = ac.createBiquadFilter(); dl.type = 'lowpass'; dl.frequency.value = 2400;
    delay.connect(dl).connect(fb).connect(delay); dl.connect(music);
    dist = ac.createWaveShaper(); const cv = new Float32Array(1024); for (let i = 0; i < 1024; i++) { const x = i / 512 - 1; cv[i] = Math.tanh(x * 3.2); } dist.curve = cv;
    nb = ac.createBuffer(1, ac.sampleRate, ac.sampleRate); const d = nb.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    applyVol(); startSeq();
  }
  for (const ev of ['pointerdown', 'keydown', 'touchend']) addEventListener(ev, init, { capture: true, passive: true });
  const ok = () => ac && ac.state === 'running';
  const mtof = m => 440 * 2 ** ((m - 69) / 12);
  // ---------- voices ----------
  function env(g, t, a, peak, dur) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); }
  function osc(type, f0, f1, t, dur, vol, dest, a = 0.005, det = 0) { const o = ac.createOscillator(), g = ac.createGain(); o.type = type; o.detune.value = det; o.frequency.setValueAtTime(f0, t); if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur); env(g, t, a, vol, dur); o.connect(g).connect(dest); o.start(t); o.stop(t + dur + 0.03); return o; }
  function nz(t, dur, vol, ft, f0, f1, q, dest, a = 0.002) { const s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain(); s.buffer = nb; s.loop = true; f.type = ft; f.Q.value = q || 1; f.frequency.setValueAtTime(f0, t); if (f1 !== f0) f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur); env(g, t, a, vol, dur); s.connect(f).connect(g).connect(dest); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.03); }
  const kick = (t, v = 1) => { osc('sine', 155, 42, t, 0.22, 0.95 * v, music, 0.002); nz(t, 0.02, 0.25 * v, 'highpass', 3000, 3000, 1, music); };
  const snare = (t, v = 1) => { nz(t, 0.18, 0.4 * v, 'bandpass', 1900, 1200, 0.8, music); osc('triangle', 200, 140, t, 0.09, 0.25 * v, music); };
  const hat = (t, v = 1, open) => nz(t, open ? 0.14 : 0.035, 0.12 * v, 'highpass', 7500, 7500, 1, music);
  function bass(t, m, dur, cut, gnr, v = 1) { const f = ac.createBiquadFilter(), g = ac.createGain(); f.type = 'lowpass'; f.Q.value = 7; f.frequency.setValueAtTime(cut * 2.4, t); f.frequency.exponentialRampToValueAtTime(cut, t + dur * 0.8); env(g, t, 0.004, 0.32 * v, dur);
    const dst = gnr ? dist : null; for (const det of [-9, 9]) { const o = ac.createOscillator(); o.type = 'sawtooth'; o.frequency.value = mtof(m); o.detune.value = det; o.connect(f); o.start(t); o.stop(t + dur + 0.03); }
    if (dst) { const ws = ac.createWaveShaper(); ws.curve = dist.curve; const dg = ac.createGain(); dg.gain.value = 0.6; f.connect(ws).connect(dg).connect(g); } else f.connect(g); g.connect(music); }
  function lead(t, m, dur, v = 1, cut = 2600) { const f = ac.createBiquadFilter(), g = ac.createGain(), s = ac.createGain(); f.type = 'lowpass'; f.frequency.value = cut; f.Q.value = 3; env(g, t, 0.01, 0.11 * v, dur); s.gain.value = 0.5;
    for (const [ty, det] of [['square', -6], ['sawtooth', 7]]) { const o = ac.createOscillator(); o.type = ty; o.frequency.value = mtof(m); o.detune.value = det; o.connect(f); o.start(t); o.stop(t + dur + 0.03); }
    f.connect(g); g.connect(music); g.connect(s).connect(delay); }
  function pad(t, ms, dur, v = 1, cut = 900) { const f = ac.createBiquadFilter(), g = ac.createGain(); f.type = 'lowpass'; f.frequency.value = cut; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.06 * v, t + dur * 0.35); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    for (const m of ms) for (const det of [-12, 12]) { const o = ac.createOscillator(); o.type = 'sawtooth'; o.frequency.value = mtof(m); o.detune.value = det; o.connect(f); o.start(t); o.stop(t + dur + 0.05); }
    f.connect(g).connect(music); const s = ac.createGain(); s.gain.value = 0.3; g.connect(s).connect(delay); }
  // ---------- tracks ----------
  // chords as [root, third, fifth] midi; progressions are original
  const TR = {
    menu: { bpm: 84, prog: [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]], drums: 0 },
    play: { bpm: 116, prog: [[45, 48, 52], [41, 45, 48], [48, 52, 55], [43, 47, 50]], drums: 1 },
    boss: { bpm: 132, prog: [[45, 48, 52], [46, 50, 53], [45, 48, 52], [44, 47, 51]], drums: 2 },
    results: { bpm: 96, prog: [[48, 52, 55], [45, 48, 52], [41, 45, 48], [43, 47, 50]], drums: 0 },
  };
  let track = 'menu', inten = 0.5, step = 0, nextT = 0, duck = 1, timer = null, want = 'menu';
  const BASS = [0, 0, 12, 0, 0, 12, 0, 7, 0, 0, 12, 0, 7, 0, 12, 10];
  const ARP = [0, 1, 2, 1, 2, 0, 2, 1];
  function schedStep(t, s) {
    const T = TR[track], bar = Math.floor(s / 16) % 4, i = s % 16, ch = T.prog[bar], sp = 60 / T.bpm / 4, I = inten * duck;
    if (track === 'menu' || track === 'results') {
      if (i === 0) pad(t, ch.map(m => m + 12), sp * 16 * 1.05, 1, 700 + 300 * Math.sin(s / 40));
      if (i % 4 === 0) bass(t, ch[0] - 12, sp * 3.5, 260, false, 0.6);
      if (i % 2 === 0) lead(t, ch[ARP[(i / 2) % 8]] + 24, sp * 1.6, 0.35, 1400);
      if (track === 'results' && i % 4 === 2) hat(t, 0.5);
      return;
    }
    const boss = track === 'boss';
    if (i % 4 === 0) kick(t); if (boss && (i === 6 || i === 14) && I > 0.6) kick(t, 0.7);
    if (i === 4 || i === 12) snare(t); if (boss && i === 15 && I > 0.8) snare(t, 0.5);
    if (I > 0.25) hat(t, i % 4 === 2 ? 1 : 0.55, i % 8 === 6); if (boss && I > 0.5 && i % 2) hat(t, 0.35);
    bass(t, ch[0] - 12 + (boss ? (i % 2 ? 12 : 0) : BASS[i]), sp * 0.9, 300 + I * 1300, boss, 1);
    if (i === 0) pad(t, ch.map(m => m + 12), sp * 16, 0.6 + I * 0.5, 600 + I * 1600);
    if (I > 0.45) { const pat = boss ? [0, 2, 1, 2, 0, 2, 1, 0] : ARP; if (i % 2 === 0 || I > 0.85) lead(t, ch[pat[i % 8]] + (boss ? 24 : 24) + (I > 0.9 && i % 8 === 7 ? 12 : 0), sp * 0.8, 0.5 + I * 0.4, 1500 + I * 2600); }
  }
  function startSeq() { nextT = ac.currentTime + 0.1; timer = setInterval(tick, 25); }
  function tick() {
    if (!ac || ac.state !== 'running') return;
    if (want !== track && step % 16 === 0) { track = want; }
    const sp = 60 / TR[track].bpm / 4;
    while (nextT < ac.currentTime + 0.12) { schedStep(nextT, step); nextT += sp; step++; }
  }
  // ---------- SFX ----------
  const last = {}; const gap = (k, ms) => { const n = performance.now(); if (n - (last[k] || 0) < ms) return false; last[k] = n; return true; };
  let hum = null, saw = null;
  const FX = {
    swing(w) { const t = ac.currentTime;
      if (w === 'saber') { osc('sawtooth', 120, 260, t, 0.22, 0.12, sfx); nz(t, 0.2, 0.16, 'bandpass', 600, 2400, 4, sfx); }
      else if (w === 'crowbar') nz(t, 0.09, 0.3, 'bandpass', 900, 2600, 3, sfx);
      else if (w === 'fists') nz(t, 0.07, 0.2, 'bandpass', 500, 1300, 2, sfx);
      else nz(t, 0.13, 0.32, 'bandpass', 500, 1700, 2.5, sfx); },
    hit(w) { const t = ac.currentTime;
      if (w === 'saber') { osc('sawtooth', 900, 90, t, 0.18, 0.2, sfx); nz(t, 0.14, 0.25, 'highpass', 5000, 1500, 1, sfx); }
      else if (w === 'crowbar') { osc('triangle', 1250, 1150, t, 0.25, 0.16, sfx); osc('triangle', 1720, 1650, t, 0.2, 0.1, sfx); osc('sine', 150, 60, t, 0.09, 0.5, sfx); }
      else { osc('sine', 170, 55, t, 0.12, 0.7, sfx); nz(t, 0.07, 0.35, 'lowpass', 1500, 300, 1, sfx); } },
    gun(enemy) { const t = ac.currentTime; nz(t, 0.14, enemy ? 0.4 : 0.6, 'lowpass', 5000, 280, 1, sfx); osc('sine', enemy ? 110 : 140, 45, t, 0.1, enemy ? 0.4 : 0.6, sfx); osc('square', 900, 200, t, 0.03, 0.08, sfx); },
    empty() { const t = ac.currentTime; osc('square', 2300, 2300, t, 0.012, 0.12, sfx); osc('square', 1500, 1500, t + 0.05, 0.015, 0.1, sfx); },
    throw() { nz(ac.currentTime, 0.2, 0.25, 'bandpass', 300, 1400, 3, sfx); },
    pickup() { const t = ac.currentTime; osc('square', 600, 600, t, 0.04, 0.08, sfx); osc('square', 900, 900, t + 0.04, 0.05, 0.08, sfx); },
    stun() { const t = ac.currentTime; osc('sine', 300, 90, t, 0.12, 0.4, sfx); for (let i = 0; i < 3; i++) osc('square', 1500 + i * 300, 1500 + i * 300, t + 0.08 + i * 0.05, 0.03, 0.05, sfx); },
    death() { const t = ac.currentTime; nz(t, 0.28, 0.45, 'lowpass', 900, 120, 1, sfx); osc('sine', 110, 38, t, 0.22, 0.6, sfx); nz(t + 0.05, 0.18, 0.3, 'bandpass', 380, 200, 6, sfx); },
    combo(n) { const t = ac.currentTime, base = 60 + Math.min(n, 8) * 2; [0, 4, 7, 12].forEach((d, i) => osc('square', mtof(base + d + 12), mtof(base + d + 12), t + i * 0.045, 0.07, 0.07, sfx)); },
    charge(v) { if (gap('charge', 90)) osc('triangle', 300 + v * 900, 500 + v * 1300, ac.currentTime, 0.12, 0.12, sfx); },
    ready() { const t = ac.currentTime; [72, 76, 79, 84].forEach((m, i) => osc('square', mtof(m), mtof(m), t + i * 0.07, 0.12, 0.1, sfx)); nz(t + 0.28, 0.3, 0.1, 'highpass', 8000, 8000, 1, sfx); },
    power() { const t = ac.currentTime; osc('sawtooth', 90, 2200, t, 0.6, 0.22, sfx, 0.05); osc('sine', 70, 30, t + 0.45, 0.5, 0.9, sfx); nz(t + 0.45, 0.6, 0.35, 'lowpass', 3000, 200, 1, sfx); },
    powerDown() { osc('sawtooth', 900, 80, ac.currentTime, 0.5, 0.12, sfx); },
    beep(n) { const f = n <= 3 ? 1320 : 880; osc('square', f, f, ac.currentTime, n === 0 ? 0.35 : 0.09, 0.12, sfx); },
    wave() { const t = ac.currentTime; osc('sawtooth', 110, 55, t, 0.6, 0.25, sfx); nz(t, 0.5, 0.2, 'bandpass', 300, 1500, 2, sfx); [57, 60, 64].forEach((m, i) => osc('square', mtof(m), mtof(m), t + i * 0.08, 0.15, 0.08, sfx)); },
    roar() { const t = ac.currentTime; const o = osc('sawtooth', 75, 38, t, 1.1, 0.45, sfx, 0.08); const l = ac.createOscillator(), lg = ac.createGain(); l.frequency.value = 18; lg.gain.value = 18; l.connect(lg).connect(o.frequency); l.start(t); l.stop(t + 1.1); nz(t, 1.1, 0.4, 'lowpass', 700, 150, 2, sfx, 0.08); },
    chainsaw(dur, loud) { const t = ac.currentTime, o = ac.createOscillator(), g = ac.createGain(), l = ac.createOscillator(), lg = ac.createGain(), f = ac.createBiquadFilter();
      o.type = 'sawtooth'; o.frequency.setValueAtTime(loud ? 95 : 70, t); o.frequency.linearRampToValueAtTime(loud ? 130 : 85, t + dur); l.type = 'square'; l.frequency.value = 32; lg.gain.value = 0.5; f.type = 'lowpass'; f.frequency.value = 1800;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(loud ? 0.3 : 0.18, t + 0.05); g.gain.setValueAtTime(loud ? 0.3 : 0.18, t + dur - 0.05); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      const am = ac.createGain(); am.gain.value = 0.6; l.connect(lg).connect(am.gain); o.connect(f).connect(am).connect(g).connect(sfx); o.start(t); o.stop(t + dur + 0.05); l.start(t); l.stop(t + dur + 0.05); },
    spray() { const t = ac.currentTime; for (let i = 0; i < 5; i++) { nz(t + i * 0.03, 0.08, 0.3, 'lowpass', 4000, 300, 1, sfx); } osc('sine', 120, 40, t, 0.15, 0.6, sfx); },
    summon() { const t = ac.currentTime; for (let i = 0; i < 4; i++) osc('square', i % 2 ? 520 : 390, i % 2 ? 520 : 390, t + i * 0.12, 0.1, 0.1, sfx); },
    bossHit() { const t = ac.currentTime; osc('sine', 120, 40, t, 0.18, 0.8, sfx); nz(t, 0.12, 0.4, 'lowpass', 2000, 200, 1, sfx); },
    bossDie() { const t = ac.currentTime; osc('sawtooth', 200, 25, t, 2.2, 0.35, sfx, 0.02); nz(t, 2, 0.5, 'lowpass', 2500, 80, 1, sfx); for (let i = 0; i < 6; i++) osc('sine', 90, 30, t + i * 0.25, 0.3, 0.5, sfx); },
    playerDie() { const t = ac.currentTime; osc('sawtooth', 420, 45, t, 0.9, 0.25, sfx); nz(t, 0.4, 0.4, 'lowpass', 1200, 100, 1, sfx); osc('square', 220, 55, t + 0.1, 0.8, 0.08, sfx); },
    results() { const t = ac.currentTime; [60, 64, 67, 72, 76, 79, 84].forEach((m, i) => osc('square', mtof(m), mtof(m), t + i * 0.09, 0.22, 0.09, sfx)); osc('sine', 48, 48, t + 0.6, 1.0, 0.0001 + 0.3, sfx); },
    spinTick(k) { osc('square', 1300 + k * 40, 1300 + k * 40, ac.currentTime, 0.03, 0.09, sfx); },
    spinLand(w) { const t = ac.currentTime; const ms = w === 'saber' ? [72, 79, 84, 91] : [67, 72, 76, 79]; ms.forEach((m, i) => osc('square', mtof(m), mtof(m), t + i * 0.08, 0.18, 0.1, sfx)); nz(t, 0.4, 0.15, 'highpass', 6000, 6000, 1, sfx); },
    boxOpen() { const t = ac.currentTime; osc('triangle', 200, 600, t, 0.25, 0.15, sfx); nz(t, 0.15, 0.2, 'bandpass', 800, 3000, 2, sfx); },
    deflect() { const t = ac.currentTime; osc('square', 2600, 1900, t, 0.08, 0.12, sfx); osc('sawtooth', 1200, 300, t, 0.12, 0.1, sfx); },
    click() { osc('square', 1000, 700, ac.currentTime, 0.04, 0.08, sfx); },
  };
  window.NCA = {
    sfx(name, ...a) { if (!ok() || cfg.mute) return; const f = FX[name]; if (f) try { f(...a); } catch (e) {} },
    track(name, intensity) { want = name; if (intensity != null) inten = intensity; if (!ok() || track === name) return; /* switch on next bar */ },
    intensity(v) { inten = v; }, duck(v) { duck = v; },
    // lightsaber idle hum: on while equipped
    hum(onState, swing) { if (!ok()) return; if (onState && !hum) { const o1 = ac.createOscillator(), o2 = ac.createOscillator(), f = ac.createBiquadFilter(), g = ac.createGain(); o1.type = o2.type = 'sawtooth'; o1.frequency.value = 88; o2.frequency.value = 89.3; f.type = 'lowpass'; f.frequency.value = 420; g.gain.value = 0; o1.connect(f); o2.connect(f); f.connect(g).connect(sfx); o1.start(); o2.start(); hum = { o1, o2, f, g }; }
      if (!onState && hum) { const h = hum; hum = null; h.g.gain.setTargetAtTime(0, ac.currentTime, 0.03); setTimeout(() => { try { h.o1.stop(); h.o2.stop(); } catch (e) {} }, 200); return; }
      if (hum) { hum.g.gain.setTargetAtTime(cfg.mute ? 0 : 0.05 + swing * 0.12, ac.currentTime, 0.04); hum.f.frequency.setTargetAtTime(420 + swing * 900, ac.currentTime, 0.04); } },
    get vol() { return cfg.vol; }, get muted() { return cfg.mute; },
    setVol(v) { cfg.vol = Math.max(0, Math.min(1, Math.round(v * 10) / 10)); if (cfg.vol > 0) cfg.mute = false; save(); applyVol(); },
    toggleMute() { cfg.mute = !cfg.mute; save(); applyVol(); return cfg.mute; },
    state: () => ({ ctx: ac ? ac.state : 'none', track, want, vol: cfg.vol, mute: cfg.mute }),
    // test helper: record the mix (for the demo video)
    record() { if (!ac) return false; const d = ac.createMediaStreamDestination(); master.connect(d); const ch = []; rec = new MediaRecorder(d.stream); rec.ondataavailable = e => ch.push(e.data); rec.start(); rec.chunks = ch; return true; },
    stopRecord() { return new Promise(r => { if (!rec) return r(null); rec.onstop = async () => { const b = new Blob(rec.chunks, { type: 'audio/webm' }); const buf = await b.arrayBuffer(); let s = ''; const u = new Uint8Array(buf); for (let i = 0; i < u.length; i += 32768) s += String.fromCharCode.apply(null, u.subarray(i, i + 32768)); r(btoa(s)); }; rec.stop(); }); },
  };
})();
