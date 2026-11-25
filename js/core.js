'use strict';
// =====================================================================
//  Robin Hood – Die Legende von Sherwood
//  core.js · Konstanten, Helfer, Speicherstand, Eingabe, Klang & Musik
// =====================================================================

const VIEW_W = 480;
const VIEW_H = 270;
const TILE = 16;
const STEP = 1 / 60;

const FONT_BODY = '"Pixelify Sans", "Trebuchet MS", Verdana, sans-serif';
const FONT_TITLE = '"Jacquarda Bastarda 9", "Old English Text MT", Georgia, serif';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a, b) => a + Math.random() * (b - a);
const randi = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const approach = (v, t, amt) => (v < t ? Math.min(v + amt, t) : Math.max(v - amt, t));

function hash2(x, y) {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function overlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, w | 0);
  c.height = Math.max(1, h | 0);
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  return [c, g];
}

// ---------------------------------------------------------------------
//  Speicherstand (localStorage kann fehlen – dann eben ohne)
// ---------------------------------------------------------------------
const Save = {
  key: 'robinhood-sherwood-v1',
  data: { unlocked: 1, best: 0, muted: false },
  load() {
    try {
      const s = JSON.parse(localStorage.getItem(this.key) || 'null');
      if (s && typeof s === 'object') Object.assign(this.data, s);
    } catch (e) { /* ohne Speicher spielen */ }
  },
  store() {
    try { localStorage.setItem(this.key, JSON.stringify(this.data)); } catch (e) { /* egal */ }
  },
};

// ---------------------------------------------------------------------
//  Eingabe: Tastatur, Gamepad, Touch
// ---------------------------------------------------------------------
const Input = (() => {
  const binds = {
    left: ['ArrowLeft', 'KeyA'],
    right: ['ArrowRight', 'KeyD'],
    up: ['ArrowUp', 'KeyW'],
    down: ['ArrowDown', 'KeyS'],
    jump: ['Space', 'KeyZ', 'KeyK', 'KeyC', 'KeyY'],
    shoot: ['KeyX', 'KeyJ', 'KeyL'],
    pause: ['Escape', 'KeyP'],
    confirm: ['Enter', 'NumpadEnter', 'Space', 'KeyZ', 'KeyK', 'KeyX', 'KeyJ', 'KeyY'],
    back: ['Escape', 'Backspace'],
    mute: ['KeyM'],
    fullscreen: ['KeyF'],
  };
  const actions = Object.keys(binds);
  const held = new Set();
  const tapped = new Set();
  const touchHeld = {};
  const touchTapped = new Set();
  const prev = {};
  for (const a of actions) prev[a] = false;

  const api = {
    down: {}, pressed: {}, released: {},
    anyPressed: false,
    device: 'keyboard',
    script: null, // für automatische Tests: { right: true, jump: false, ... }
    onFirstInput: null,
    _first: false,
  };

  function first() {
    if (!api._first) { api._first = true; if (api.onFirstInput) api.onFirstInput(); }
    Sound.init();
  }

  const block = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space', 'Backspace']);
  window.addEventListener('keydown', (e) => {
    if (block.has(e.code)) e.preventDefault();
    if (!e.repeat) tapped.add(e.code);
    held.add(e.code);
    api.device = 'keyboard';
    first();
  });
  window.addEventListener('keyup', (e) => held.delete(e.code));
  window.addEventListener('blur', () => held.clear());

  function readPad() {
    const r = {};
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const p of pads) {
      if (!p || !p.connected) continue;
      const b = (i) => !!(p.buttons[i] && p.buttons[i].pressed);
      const ax = p.axes[0] || 0, ay = p.axes[1] || 0;
      if (b(14) || ax < -0.45) r.left = true;
      if (b(15) || ax > 0.45) r.right = true;
      if (b(12) || ay < -0.55) r.up = true;
      if (b(13) || ay > 0.55) r.down = true;
      if (b(0)) { r.jump = true; r.confirm = true; }
      if (b(2) || b(1) || b(5) || b(7)) r.shoot = true;
      if (b(1)) r.back = true;
      if (b(9)) r.pause = true;
      let any = false;
      for (const k in r) if (r[k]) any = true;
      if (any) { api.device = 'gamepad'; first(); }
    }
    return r;
  }

  api.poll = () => {
    const pad = readPad();
    api.anyPressed = false;
    for (const a of actions) {
      let d = false;
      const codes = binds[a];
      for (let i = 0; i < codes.length; i++) {
        if (held.has(codes[i]) || tapped.has(codes[i])) { d = true; break; }
      }
      if (pad[a] || touchHeld[a] > 0 || touchTapped.has(a) || (api.script && api.script[a])) d = true;
      api.pressed[a] = d && !prev[a];
      api.released[a] = !d && prev[a];
      api.down[a] = d;
      prev[a] = d;
      if (api.pressed[a]) api.anyPressed = true;
    }
    tapped.clear();
    touchTapped.clear();
  };

  // Ein Tipp auf dem Bildschirm zählt wie ein Druck auf "confirm" (für Menüs)
  api.virtualPress = (a) => { touchTapped.add(a); first(); };

  api.bindTouch = (root) => {
    const ptr = new Map();
    const els = {};
    root.querySelectorAll('[data-act]').forEach((el) => { els[el.dataset.act] = el; });
    const setPtr = (id, act) => {
      const old = ptr.get(id);
      if (old === act) return;
      if (old) {
        touchHeld[old] = Math.max(0, (touchHeld[old] || 0) - 1);
        if (!touchHeld[old] && els[old]) els[old].classList.remove('on');
      }
      if (act) {
        touchHeld[act] = (touchHeld[act] || 0) + 1;
        touchTapped.add(act);
        if (els[act]) els[act].classList.add('on');
        ptr.set(id, act);
      } else ptr.delete(id);
    };
    const actAt = (x, y) => {
      const t = document.elementFromPoint(x, y);
      const el = t && t.closest ? t.closest('[data-act]') : null;
      return el ? el.dataset.act : null;
    };
    root.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse') return;
      const act = actAt(e.clientX, e.clientY);
      if (!act) return;
      e.preventDefault();
      api.device = 'touch';
      first();
      setPtr(e.pointerId, act);
    });
    window.addEventListener('pointermove', (e) => {
      if (!ptr.has(e.pointerId)) return;
      setPtr(e.pointerId, actAt(e.clientX, e.clientY));
    });
    const end = (e) => { if (ptr.has(e.pointerId)) setPtr(e.pointerId, null); };
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
  };

  return api;
})();

// ---------------------------------------------------------------------
//  Klang: alles synthetisch per WebAudio – keine Audiodateien nötig
// ---------------------------------------------------------------------
const Sound = (() => {
  let ctx = null, master = null, sfxBus = null, musicBus = null, noiseBuf = null;
  let muted = false;
  let songName = null, pendingSong = null, song = null, stepIdx = 0, nextT = 0, timer = null;

  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try { ctx = new AC(); } catch (e) { ctx = null; return; }
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.9;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16; comp.knee.value = 10; comp.ratio.value = 4;
    comp.attack.value = 0.004; comp.release.value = 0.2;
    comp.connect(master);
    master.connect(ctx.destination);
    sfxBus = ctx.createGain(); sfxBus.gain.value = 0.6; sfxBus.connect(comp);
    musicBus = ctx.createGain(); musicBus.gain.value = 0.3; musicBus.connect(comp);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    if (pendingSong) { const s = pendingSong; pendingSong = null; songName = null; playSong(s); }
  }

  function tone(o) {
    if (!ctx) return;
    const t = (o.at !== undefined ? o.at : ctx.currentTime) + (o.delay || 0);
    const osc = ctx.createOscillator();
    osc.type = o.type || 'square';
    osc.frequency.setValueAtTime(o.f, t);
    if (o.f2) osc.frequency.exponentialRampToValueAtTime(o.f2, t + o.dur);
    if (o.detune) osc.detune.value = o.detune;
    const g = ctx.createGain();
    const v = o.vol !== undefined ? o.vol : 0.15;
    const a = o.a || 0.004;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(v, t + a);
    if (o.sus) g.gain.setValueAtTime(v * o.sus, t + o.dur * 0.6);
    g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
    osc.connect(g);
    g.connect(o.bus || sfxBus);
    osc.start(t);
    osc.stop(t + o.dur + 0.03);
  }

  function noise(o) {
    if (!ctx) return;
    const t = (o.at !== undefined ? o.at : ctx.currentTime) + (o.delay || 0);
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = o.ft || 'bandpass';
    f.frequency.setValueAtTime(o.f || 1000, t);
    if (o.f2) f.frequency.exponentialRampToValueAtTime(o.f2, t + o.dur);
    f.Q.value = o.q !== undefined ? o.q : 1;
    const g = ctx.createGain();
    const v = o.vol !== undefined ? o.vol : 0.15;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(v, t + (o.a || 0.003));
    g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
    src.connect(f); f.connect(g); g.connect(o.bus || sfxBus);
    src.start(t, Math.random() * 0.5);
    src.stop(t + o.dur + 0.03);
  }

  const arp = (notes, gap, o) => notes.forEach((f, i) => tone(Object.assign({ f, delay: i * gap }, o)));

  const fx = {
    jump: () => tone({ type: 'square', f: 260, f2: 540, dur: 0.12, vol: 0.06 }),
    land: () => noise({ f: 320, ft: 'lowpass', dur: 0.07, vol: 0.16 }),
    draw: () => noise({ f: 700, f2: 2200, q: 5, dur: 0.3, vol: 0.05 }),
    charged: () => { tone({ type: 'sine', f: 1320, dur: 0.08, vol: 0.1 }); tone({ type: 'sine', f: 1760, dur: 0.14, vol: 0.09, delay: 0.07 }); },
    shoot: () => { noise({ f: 2600, f2: 500, q: 1.4, dur: 0.16, vol: 0.2 }); tone({ type: 'triangle', f: 330, f2: 130, dur: 0.12, vol: 0.16 }); },
    power: () => { noise({ f: 3600, f2: 380, q: 1, dur: 0.3, vol: 0.28 }); tone({ type: 'sawtooth', f: 230, f2: 70, dur: 0.22, vol: 0.09 }); tone({ type: 'sine', f: 880, f2: 1760, dur: 0.16, vol: 0.07 }); },
    thunk: () => { noise({ f: 700, ft: 'lowpass', dur: 0.06, vol: 0.18 }); tone({ type: 'sine', f: 190, f2: 90, dur: 0.07, vol: 0.15 }); },
    hit: () => { tone({ type: 'square', f: 240, f2: 70, dur: 0.12, vol: 0.12 }); noise({ f: 1500, dur: 0.06, vol: 0.16 }); },
    ko: () => tone({ type: 'triangle', f: 720, f2: 120, dur: 0.36, vol: 0.15 }),
    stomp: () => { tone({ type: 'square', f: 170, f2: 430, dur: 0.1, vol: 0.1 }); noise({ f: 500, ft: 'lowpass', dur: 0.08, vol: 0.2 }); },
    clang: () => { tone({ type: 'square', f: 1250, dur: 0.18, vol: 0.05 }); tone({ type: 'square', f: 1873, dur: 0.14, vol: 0.04 }); noise({ f: 5000, ft: 'highpass', dur: 0.08, vol: 0.1 }); },
    coin: () => { tone({ type: 'square', f: 988, dur: 0.06, vol: 0.06 }); tone({ type: 'square', f: 1319, dur: 0.16, vol: 0.06, delay: 0.055 }); },
    bag: () => arp([784, 988, 1175, 1568], 0.05, { type: 'square', dur: 0.1, vol: 0.06 }),
    heart: () => arp([523, 784, 1047], 0.07, { type: 'triangle', dur: 0.16, vol: 0.14 }),
    powerup: () => arp([392, 523, 659, 784, 1047, 1319], 0.045, { type: 'square', dur: 0.09, vol: 0.05 }),
    hurt: () => { tone({ type: 'sawtooth', f: 260, f2: 80, dur: 0.28, vol: 0.12 }); noise({ f: 800, dur: 0.12, vol: 0.1 }); },
    splash: () => { noise({ f: 1800, f2: 250, ft: 'lowpass', dur: 0.45, vol: 0.3 }); noise({ f: 3000, ft: 'highpass', dur: 0.2, vol: 0.06, delay: 0.05 }); },
    spring: () => tone({ type: 'sine', f: 170, f2: 780, dur: 0.24, vol: 0.18 }),
    checkpoint: () => arp([523, 659, 784, 1047], 0.08, { type: 'triangle', dur: 0.2, vol: 0.13 }),
    oneup: () => arp([659, 784, 1319, 1047, 1175, 1568], 0.07, { type: 'square', dur: 0.09, vol: 0.05 }),
    swing: () => noise({ f: 700, f2: 2400, q: 2, dur: 0.14, vol: 0.1 }),
    bolt: () => { noise({ f: 1800, f2: 900, q: 3, dur: 0.12, vol: 0.1 }); tone({ type: 'triangle', f: 420, f2: 260, dur: 0.08, vol: 0.09 }); },
    crate: () => { noise({ f: 1100, ft: 'lowpass', dur: 0.22, vol: 0.28 }); tone({ type: 'square', f: 140, f2: 60, dur: 0.12, vol: 0.08 }); },
    door: () => { noise({ f: 220, ft: 'lowpass', dur: 1.1, vol: 0.22 }); for (let i = 0; i < 5; i++) tone({ type: 'square', f: 90 + i * 6, dur: 0.05, vol: 0.05, delay: i * 0.18 }); },
    target: () => { tone({ type: 'sine', f: 620, dur: 0.06, vol: 0.18 }); tone({ type: 'sine', f: 930, dur: 0.14, vol: 0.14, delay: 0.06 }); },
    bark: () => { tone({ type: 'square', f: 380, f2: 230, dur: 0.07, vol: 0.07 }); tone({ type: 'square', f: 360, f2: 210, dur: 0.08, vol: 0.07, delay: 0.12 }); },
    alert: () => tone({ type: 'square', f: 880, f2: 1250, dur: 0.08, vol: 0.05 }),
    crumble: () => noise({ f: 600, ft: 'lowpass', dur: 0.3, vol: 0.18 }),
    boss: () => { tone({ type: 'sawtooth', f: 92, f2: 58, dur: 0.9, vol: 0.14 }); noise({ f: 400, ft: 'lowpass', dur: 0.8, vol: 0.18 }); },
    quake: () => { noise({ f: 160, ft: 'lowpass', dur: 0.5, vol: 0.32 }); tone({ type: 'sine', f: 62, f2: 30, dur: 0.4, vol: 0.25 }); },
    dagger: () => noise({ f: 3200, f2: 1500, q: 4, dur: 0.1, vol: 0.09 }),
    death: () => arp([523, 494, 440, 392, 349, 330, 294], 0.11, { type: 'triangle', dur: 0.16, vol: 0.13 }),
    donate: () => arp([1047, 1319, 1568, 2093], 0.06, { type: 'triangle', dur: 0.12, vol: 0.09 }),
    select: () => tone({ type: 'square', f: 660, dur: 0.05, vol: 0.05 }),
    confirm: () => { tone({ type: 'square', f: 784, dur: 0.06, vol: 0.06 }); tone({ type: 'square', f: 1175, dur: 0.1, vol: 0.06, delay: 0.05 }); },
    tick: () => tone({ type: 'square', f: 1400, dur: 0.03, vol: 0.04 }),
    fanfare: () => {
      const n = [523, 659, 784, 1047, 784, 1047, 1319];
      const d = [0.12, 0.12, 0.12, 0.3, 0.12, 0.12, 0.6];
      let t = 0;
      n.forEach((f, i) => {
        tone({ type: 'square', f, dur: d[i] + 0.06, vol: 0.06, delay: t });
        tone({ type: 'triangle', f: f / 2, dur: d[i] + 0.06, vol: 0.12, delay: t });
        t += d[i];
      });
    },
  };

  function play(name) {
    if (!ctx || muted) return;
    const f = fx[name];
    if (f) { try { f(); } catch (e) { /* Klang ist nicht kritisch */ } }
  }

  // ------------------------- Musik --------------------------------
  const NOTE = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 };
  function freq(n) {
    const m = /^([A-G][#b]?)(-?\d)$/.exec(n);
    if (!m) return 0;
    const midi = NOTE[m[1]] + (parseInt(m[2], 10) + 1) * 12;
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  const SONGS = {
    forest: {
      step: 0.165, bar: 6, inst: 'pluck', vol: 0.1,
      lead: 'A4 D5 D5 F5 E5 D5 | C5 A4 A4 C5 - - | A4 D5 D5 F5 E5 F5 | G5 F5 E5 D5 - - | F5 A5 A5 G5 F5 E5 | D5 E5 F5 E5 C5 A4 | B4 C5 D5 E5 C5 A4 | D5 - - D5 - .',
      bass: 'D3 C3 D3 G2 F3 C3 G2 D3', bassAt: [0, 3], drums: 'K.hT.h',
    },
    village: {
      step: 0.14, bar: 8, inst: 'pluck', vol: 0.09,
      lead: 'G4 B4 D5 B4 G4 B4 D5 G5 | F#5 E5 D5 E5 F#5 - D5 - | E5 F#5 G5 E5 D5 B4 G4 B4 | A4 - - - A4 B4 C5 A4 | G4 B4 D5 B4 G4 B4 D5 G5 | A5 G5 F#5 E5 D5 - B4 - | C5 E5 D5 B4 A4 F#4 A4 - | G4 - - - G4 - . .',
      bass: 'G2 D3 C3 D3 G2 D3 C3 G2', bassAt: [0, 4], drums: 'K.h.T.h.',
    },
    city: {
      step: 0.15, bar: 8, inst: 'pluck', vol: 0.09,
      lead: 'A4 - A4 C5 B4 - A4 - | G4 - E4 - G4 A4 B4 - | C5 - B4 A4 B4 - G4 - | A4 - - - E4 - - - | A4 C5 E5 - D5 C5 B4 - | C5 B4 A4 - G4 A4 B4 - | C5 - D5 - E5 D5 C5 B4 | A4 - - - - - . .',
      bass: 'A2 G2 F2 E2 A2 F2 G2 A2', bassAt: [0, 4], drums: 'K.T.K.TT',
    },
    castle: {
      step: 0.2, bar: 8, inst: 'soft', vol: 0.1,
      lead: 'D4 - - F4 E4 - D4 - | C#4 - D4 - E4 - - - | D4 - - F4 G4 - A4 - | Bb4 - A4 - G4 - A4 - | D5 - - C5 Bb4 - A4 - | G4 - Bb4 - A4 - G4 - | F4 - E4 - D4 - C#4 - | D4 - - - - - . .',
      bass: 'D2 A2 D2 G2 Bb2 G2 A2 D2', bassAt: [0], hold: true, drums: 'K...T...',
    },
    boss: {
      step: 0.115, bar: 8, inst: 'pluck', vol: 0.085,
      lead: 'D5 . D5 . F5 . E5 . | D5 . C5 . A4 - - . | D5 . D5 . F5 . G5 . | A5 . G5 . F5 . E5 . | F5 . F5 . A5 . G5 . | F5 . E5 . C#5 - - . | D5 . F5 . A5 . D6 . | C#6 - A5 - D6 - - .',
      bassSeq: 'D3 D3 F3 D3 G3 D3 F3 E3', drums: 'KhTKKhTh',
    },
    title: {
      step: 0.21, bar: 6, inst: 'soft', vol: 0.1,
      lead: 'A4 D5 D5 F5 E5 D5 | C5 A4 A4 C5 - - | A4 D5 D5 F5 E5 F5 | G5 F5 E5 D5 - - | F5 A5 A5 G5 F5 E5 | D5 E5 F5 E5 C5 A4 | B4 C5 D5 E5 C5 A4 | D5 - - - - .',
      bass: 'D3 C3 D3 G2 F3 C3 G2 D3', bassAt: [0], hold: true, drums: '',
    },
  };

  function parseSong(s) {
    const toks = s.lead.split(/\s+/).filter((t) => t && t !== '|');
    const bars = s.bass ? s.bass.split(/\s+/).length : Math.ceil(toks.length / s.bar);
    const total = Math.max(bars * s.bar, toks.length);
    const lead = [];
    for (let i = 0; i < total; i++) {
      const t = toks[i] || '.';
      if (t === '.' || t === '-') { lead.push(null); continue; }
      let len = 1;
      while (toks[i + len] === '-') len++;
      lead.push({ f: freq(t), len });
    }
    s.p = {
      total, lead,
      bass: s.bass ? s.bass.split(/\s+/).map(freq) : null,
      bassSeq: s.bassSeq ? s.bassSeq.split(/\s+/).map(freq) : null,
    };
  }

  function voice(kind, f, t, dur, vol) {
    if (kind === 'pluck') {
      const o1 = ctx.createOscillator(), o2 = ctx.createOscillator();
      const g1 = ctx.createGain(), flt = ctx.createBiquadFilter(), g = ctx.createGain();
      o1.type = 'square'; o2.type = 'triangle';
      o1.frequency.value = f; o2.frequency.value = f; o2.detune.value = 6;
      g1.gain.value = 0.32;
      flt.type = 'lowpass';
      flt.frequency.setValueAtTime(3400, t);
      flt.frequency.exponentialRampToValueAtTime(800, t + 0.28);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(vol, t + 0.006);
      g.gain.exponentialRampToValueAtTime(vol * 0.35, t + 0.14);
      g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(0.22, dur * 1.05));
      o1.connect(g1); g1.connect(flt); o2.connect(flt); flt.connect(g); g.connect(musicBus);
      o1.start(t); o2.start(t);
      o1.stop(t + dur + 0.3); o2.stop(t + dur + 0.3);
    } else {
      tone({ type: 'triangle', f, dur: Math.max(0.25, dur * 1.1), vol, a: 0.03, sus: 0.7, at: t, bus: musicBus });
      tone({ type: 'sine', f: f * 2, dur: Math.max(0.2, dur), vol: vol * 0.25, a: 0.04, at: t, bus: musicBus });
    }
  }

  function schedule(i, t) {
    const s = song, p = s.p;
    const n = p.lead[i];
    if (n && n.f) voice(s.inst, n.f, t, n.len * s.step, s.vol);
    const barIdx = Math.floor(i / s.bar), inBar = i % s.bar;
    if (p.bass) {
      const root = p.bass[barIdx % p.bass.length];
      const at = s.bassAt || [0];
      const k = at.indexOf(inBar);
      if (k >= 0 && root) {
        const f = k === 0 ? root : root * 1.5;
        const dur = s.hold ? s.bar * s.step : (s.bar / at.length) * s.step;
        tone({ type: 'triangle', f, dur: dur * 0.95, vol: 0.16, a: 0.01, sus: 0.6, at: t, bus: musicBus });
      }
    }
    if (p.bassSeq) {
      const f = p.bassSeq[inBar % p.bassSeq.length];
      tone({ type: 'sawtooth', f, dur: s.step * 0.9, vol: 0.06, at: t, bus: musicBus });
      tone({ type: 'triangle', f, dur: s.step * 0.9, vol: 0.12, at: t, bus: musicBus });
    }
    const d = s.drums ? s.drums[inBar % s.drums.length] : '.';
    if (d === 'K') tone({ type: 'sine', f: 130, f2: 42, dur: 0.14, vol: 0.32, at: t, bus: musicBus });
    else if (d === 'T') noise({ f: 1500, q: 1.1, dur: 0.1, vol: 0.13, at: t, bus: musicBus });
    else if (d === 'h') noise({ f: 7000, ft: 'highpass', dur: 0.03, vol: 0.04, at: t, bus: musicBus });
  }

  function tick() {
    if (!ctx || !song) return;
    if (nextT < ctx.currentTime - 0.25) nextT = ctx.currentTime + 0.05;
    while (nextT < ctx.currentTime + 0.14) {
      try { schedule(stepIdx, nextT); } catch (e) { /* weiter */ }
      nextT += song.step;
      stepIdx = (stepIdx + 1) % song.p.total;
    }
  }

  function playSong(name) {
    if (songName === name) return;
    songName = name;
    if (timer) { clearInterval(timer); timer = null; }
    song = null;
    if (!name) return;
    if (!ctx) { pendingSong = name; return; }
    const s = SONGS[name];
    if (!s) return;
    if (!s.p) parseSong(s);
    song = s;
    stepIdx = 0;
    nextT = ctx.currentTime + 0.08;
    timer = setInterval(tick, 25);
  }

  function setMuted(m) {
    muted = m;
    if (master && ctx) master.gain.setTargetAtTime(m ? 0 : 0.9, ctx.currentTime, 0.03);
  }

  function duck(on) {
    if (musicBus && ctx) musicBus.gain.setTargetAtTime(on ? 0.1 : 0.3, ctx.currentTime, 0.08);
  }

  return {
    init, play, playSong, setMuted, duck,
    get muted() { return muted; },
    get song() { return songName; },
  };
})();
