// Archive sound effects: all synthesised with WebAudio (no audio files). The AudioContext is only created on the first user gesture.
(() => {
  const KEY = 'hm_sfx';
  let ac = null, out = null, nb = null, on = localStorage.getItem(KEY) !== '0';
  const last = {};
  const gap = (k, ms) => { const n = performance.now(); if (n - (last[k] || 0) < ms) return false; last[k] = n; return true; };
  function unlock() {
    if (!ac) { const C = window.AudioContext || window.webkitAudioContext; if (!C) return; ac = new C(); out = ac.createGain(); out.gain.value = 0.55; const comp = ac.createDynamicsCompressor(); out.connect(comp).connect(ac.destination);
      nb = ac.createBuffer(1, ac.sampleRate, ac.sampleRate); const d = nb.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
    if (ac.state === 'suspended') ac.resume();
  }
  for (const ev of ['pointerdown', 'keydown', 'touchend']) addEventListener(ev, unlock, { capture: true, passive: true });
  const ready = () => on && ac && ac.state === 'running';
  function tone(type, f0, f1, dur, vol, dl = 0, dest) {
    const t = ac.currentTime + dl, o = ac.createOscillator(), g = ac.createGain(); o.type = type;
    o.frequency.setValueAtTime(f0, t); if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + Math.min(0.01, dur / 4)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(dest || out); o.start(t); o.stop(t + dur + 0.02);
  }
  function noise(dur, vol, ft, f0, f1, q = 1, dl = 0) {
    const t = ac.currentTime + dl, s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    s.buffer = nb; s.loop = true; f.type = ft; f.Q.value = q; f.frequency.setValueAtTime(f0, t); if (f1 !== f0) f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(out); s.start(t, Math.random()); s.stop(t + dur + 0.02);
  }
  const S = {
    hover: () => gap('hover', 60) && tone('square', 1900, 1500, 0.035, 0.035),
    tap: () => gap('tap', 50) && (tone('square', 880, 520, 0.07, 0.07), noise(0.03, 0.08, 'highpass', 3000, 3000)),
    open: () => { // tape whir + VHS clunk
      tone('sawtooth', 70, 340, 0.32, 0.05); noise(0.32, 0.12, 'bandpass', 400, 2400, 2);
      tone('sine', 140, 40, 0.16, 0.5, 0.3); noise(0.08, 0.3, 'lowpass', 900, 200, 1, 0.3); tone('square', 2400, 2400, 0.015, 0.05, 0.36); },
    close: () => { tone('sine', 120, 45, 0.12, 0.45); noise(0.06, 0.25, 'lowpass', 800, 200); tone('sawtooth', 320, 60, 0.26, 0.04, 0.05); noise(0.25, 0.08, 'bandpass', 2000, 300, 2, 0.05); },
    tab: () => gap('tab', 80) && (tone('square', 660, 660, 0.05, 0.06), tone('square', 990, 990, 0.07, 0.06, 0.05)),
    tick: () => gap('tick', 25) && noise(0.018, 0.14, 'highpass', 3500 + Math.random() * 2500, 3000),
    filter: () => gap('filter', 50) && (tone('triangle', 1250, 1100, 0.05, 0.09), noise(0.02, 0.1, 'highpass', 5000, 5000)),
    thud: () => { tone('sine', 95, 32, 0.32, 0.9); noise(0.14, 0.5, 'lowpass', 500, 120); tone('square', 60, 40, 0.08, 0.08); },
    // spiral
    whoosh: (sp, dir) => { if (!gap('whoosh', 160)) return; const v = Math.min(1, sp / 14), up = dir > 0; noise(0.22 + v * 0.2, 0.05 + v * 0.16, 'bandpass', up ? 350 : 2600, up ? 2600 + v * 1500 : 300, 3); },
    card: (sp) => gap('card', 38) && tone('square', 1700 + Math.min(sp, 20) * 40, 1500, 0.015, 0.035),
    snap: () => gap('snap', 220) && (tone('sine', 85, 38, 0.2, 0.55), noise(0.08, 0.2, 'lowpass', 1200, 150), tone('square', 1800, 900, 0.03, 0.03, 0.01)),
    zap: () => gap('zap', 300) && (tone('sawtooth', 1400, 60, 0.28, 0.12), tone('square', 90, 45, 0.22, 0.25), noise(0.2, 0.18, 'highpass', 6000, 800, 1)),
    fx: (k) => { if (!gap('fx' + k, 260)) return;
      if (k === 'kill') { noise(0.09, 0.2, 'lowpass', 1400, 200); tone('square', 220, 110, 0.08, 0.05); }
      else if (k === 'pts') { tone('square', 988, 988, 0.05, 0.04); tone('square', 1319, 1319, 0.09, 0.04, 0.05); }
      else if (k === 'combo') [523, 659, 784, 1047].forEach((f, i) => tone('square', f, f, 0.06, 0.04, i * 0.045));
      else if (k === 'phone') for (let i = 0; i < 6; i++) tone('square', i % 2 ? 1180 : 940, i % 2 ? 1180 : 940, 0.05, 0.035, i * 0.055);
      else if (k === 'burst') { noise(0.16, 0.12, 'bandpass', 3000, 400, 4); tone('sawtooth', 600, 1800, 0.08, 0.03); }
      else tone('triangle', 700, 1400, 0.08, 0.04); },
  };
  let prevIdx = null, prevSp = 0, settled = true;
  window.SFX = {
    get on() { return on; },
    play(name, ...a) { if (ready() && S[name]) try { S[name](...a); } catch (e) {} },
    // called once per frame by helix.js
    spiral(cur, vel, jumping) { if (!ready()) { prevIdx = Math.round(cur); return; } const i = Math.round(cur), sp = Math.abs(vel);
      if (prevIdx !== null && i !== prevIdx && !jumping) S.card(sp);
      prevIdx = i;
      if (sp > 3.5 && !jumping) S.whoosh(sp, Math.sign(vel));
      if (sp > 1.2) settled = false; else if (!settled && sp < 0.08) { settled = true; S.snap(); }
      prevSp = sp; },
    setOn(v, quiet) { on = v; localStorage.setItem(KEY, v ? '1' : '0'); document.querySelectorAll('.sfx-toggle').forEach(b => { b.textContent = 'SFX: ' + (v ? 'ON' : 'OFF'); b.setAttribute('aria-pressed', String(v)); }); if (v && !quiet) { unlock(); setTimeout(() => S.tab(), 30); } },
    state: () => ({ ctx: ac ? ac.state : 'none', on }),
  };
  // toggle next to MUSIC (grid) or in the spiral menu
  function mount() {
    const mk = cls => { const b = document.createElement('button'); b.type = 'button'; b.className = 'sfx-toggle ' + cls; b.id = 'sfxToggle'; b.onclick = e => { e.stopPropagation(); SFX.setOn(!on); }; return b; };
    const mus = document.getElementById('music');
    if (mus) mus.after(mk(''));
    else { const pl = document.querySelector('.hx-play'); if (pl) pl.after(mk('hx-grid')); }
    SFX.setOn(on, true);
  }
  document.readyState === 'loading' ? addEventListener('DOMContentLoaded', mount) : mount();
  // delegated archive hooks
  addEventListener('mouseover', e => { const c = e.target.closest && e.target.closest('.card'); if (c && !(e.relatedTarget && c.contains(e.relatedTarget))) SFX.play('hover'); });
  addEventListener('click', e => { const t = e.target.closest ? e.target : null; if (!t) return;
    if (t.closest('.sfx-toggle')) return;
    if (t.closest('[data-tab],[data-deck]')) SFX.play('tab');
    else if (t.closest('#gamef button,#subf button')) SFX.play('filter');
    else if (t.closest('.card,.spiral-btn,.play-btn,.hx-grid,.hx-open,#gl,.mask')) SFX.play('tap'); }, true);
  addEventListener('input', e => { if (e.target && e.target.id === 'q') SFX.play('tick'); });
  addEventListener('DOMContentLoaded', () => { const m = document.getElementById('modal'); if (!m) return; let was = m.hidden;
    new MutationObserver(() => { if (m.hidden === was) return; was = m.hidden; if (!m.hidden) { SFX.play('open'); const st = m.querySelector('.stamp'); if (st && /dead/.test(st.className)) setTimeout(() => SFX.play('thud'), 420); } else SFX.play('close'); }).observe(m, { attributes: true, attributeFilter: ['hidden'] }); });
})();
