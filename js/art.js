'use strict';
// =====================================================================
//  art.js · Pixelkunst – alles wird zur Laufzeit gezeichnet
//  Figuren bestehen aus Rechtecken; ein zweiter Durchgang legt
//  automatisch eine dunkle Kontur um alles ("Rig").
// =====================================================================

const OUTLINE = '#1a120c';

const Rig = {
  r: [],
  n: 0,
  reset() { this.n = 0; return this; },
  rect(x, y, w, h, c, o = 1) {
    if (w <= 0 || h <= 0) return;
    const i = this.n * 6, r = this.r;
    r[i] = Math.round(x); r[i + 1] = Math.round(y); r[i + 2] = w | 0; r[i + 3] = h | 0; r[i + 4] = c; r[i + 5] = o;
    this.n++;
  },
  px(x, y, c, o = 1) { this.rect(x, y, 1, 1, c, o); },
  line(x0, y0, x1, y1, c, o = 1) {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (let k = 0; k < 256; k++) {
      this.rect(x0, y0, 1, 1, c, o);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  },
  draw(g, ox, oy, flip, flash, outline) {
    ox = Math.round(ox); oy = Math.round(oy);
    const r = this.r, n = this.n;
    g.fillStyle = outline || OUTLINE;
    for (let k = 0; k < n; k++) {
      const i = k * 6;
      if (!r[i + 5]) continue;
      const x = flip ? -r[i] - r[i + 2] : r[i];
      g.fillRect(ox + x - 1, oy + r[i + 1] - 1, r[i + 2] + 2, r[i + 3] + 2);
    }
    let last = null;
    for (let k = 0; k < n; k++) {
      const i = k * 6;
      const c = flash || r[i + 4];
      if (c !== last) { g.fillStyle = c; last = c; }
      const x = flip ? -r[i] - r[i + 2] : r[i];
      g.fillRect(ox + x, oy + r[i + 1], r[i + 2], r[i + 3]);
    }
  },
};

// Zeichnet eine Figur optional gedreht (für k.o.-Purzelbäume)
function drawRigRotated(g, sx, sy, flip, flash, rot, cy) {
  if (!rot) { Rig.draw(g, sx, sy, flip, flash); return; }
  g.save();
  g.translate(Math.round(sx), Math.round(sy - cy));
  g.rotate(rot);
  Rig.draw(g, 0, cy, flip, flash);
  g.restore();
}

function hexRgb(h) {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function mix(a, b, t) {
  const A = hexRgb(a), B = hexRgb(b);
  return `rgb(${Math.round(A[0] + (B[0] - A[0]) * t)},${Math.round(A[1] + (B[1] - A[1]) * t)},${Math.round(A[2] + (B[2] - A[2]) * t)})`;
}

// ---------------------------------------------------------------------
//  Themen
// ---------------------------------------------------------------------
const THEMES = {
  forest: {
    ground: 'grass',
    grass: ['#2c6a2b', '#4d9636', '#7cc84b'],
    dirt: ['#38230f', '#563820', '#71502e'],
    brick: ['#34372f', '#62665a', '#858a7a'],
    wood: ['#3e2512', '#6e4521', '#93622f'],
    roof: ['#7a5a2c', '#a8823f', '#d1ab5c'], roofStyle: 'thatch',
    plat: 'branch', spike: 'thorn', spring: 'mushroom',
    wall: ['#ddd0ae', '#c9b993', '#5b3a22'],
    water: ['#1f5f93', '#3f8fcc', '#bfe9ff'],
    darkness: 0, decor: 'forest', lights: false,
  },
  village: {
    ground: 'grass',
    grass: ['#4a7c27', '#6fa538', '#a2cf58'],
    dirt: ['#46301a', '#6a4a29', '#8a6538'],
    brick: ['#554c41', '#837766', '#a69983'],
    wood: ['#4a2c14', '#7c5028', '#a06b36'],
    roof: ['#7f5c22', '#bb9443', '#e5c46d'], roofStyle: 'thatch',
    plat: 'plank', spike: 'thorn', spring: 'hay',
    wall: ['#ecdfbb', '#d5c49b', '#5a3820'],
    water: ['#245f86', '#4790bf', '#c4ecff'],
    darkness: 0, decor: 'village', lights: false,
  },
  city: {
    ground: 'cobble',
    cobble: ['#3a332e', '#7b7268', '#91877b', '#b4aa9c'],
    brick: ['#463b33', '#8b785f', '#ab977a'],
    wood: ['#3f2612', '#704522', '#93622f'],
    roof: ['#5a281e', '#984831', '#c26a48'], roofStyle: 'tile',
    plat: 'plank', spike: 'iron', spring: 'hay',
    wall: ['#bfae93', '#a8967b', '#4c3a28'],
    water: ['#24486b', '#3b6f99', '#a9d3f0'],
    darkness: 0.3, darkColor: '#1a1030', decor: 'city', lights: true,
  },
  castle: {
    ground: 'stone',
    stone: ['#1c1f2a', '#3f4458', '#525a74', '#737c9c'],
    brick: ['#1b1e29', '#41475d', '#5c6484'],
    wood: ['#32200f', '#5e3b1d', '#7f5429'],
    roof: ['#1b1f30', '#363c55', '#50587a'], roofStyle: 'slate',
    plat: 'ledge', spike: 'iron', spring: 'hay',
    wall: ['#3a3f52', '#30354a', '#1c1f2a'],
    bgwall: ['#15171f', '#232634', '#2d3142'],
    water: ['#1a2c4a', '#2b4a75', '#8fb8e0'],
    darkness: 0.66, darkColor: '#05061a', decor: 'castle', lights: true,
  },
};

const isSolidCh = (c) => c === '#' || c === 'B' || c === 'W';

function fr(g, c, x, y, w, h) { g.fillStyle = c; g.fillRect(x, y, w, h); }

// ---------------------------------------------------------------------
//  Statische Levelgrafik
// ---------------------------------------------------------------------
function renderLevelArt(lv) {
  const T = THEMES[lv.theme];
  const [c, g] = makeCanvas(lv.pw, lv.ph);
  for (let y = 0; y < lv.h; y++) for (let x = 0; x < lv.w; x++) {
    const ch = lv.chars[y][x];
    if (BG_CHARS.includes(ch)) drawBgTile(g, lv, T, ch, x, y);
  }
  for (let y = 0; y < lv.h; y++) for (let x = 0; x < lv.w; x++) {
    const ch = lv.chars[y][x];
    if (ch === '#') drawGround(g, lv, T, x, y);
    else if (ch === 'B') drawBrick(g, lv, T, x, y);
    else if (ch === 'W') drawWood(g, lv, T, x, y);
    else if (ch === 'R') drawRoof(g, lv, T, x, y);
    else if (ch === '=') drawOneWay(g, lv, T, x, y);
    else if (ch === '^') drawSpikes(g, lv, T, x, y);
  }
  if (T.decor) for (let y = 1; y < lv.h; y++) for (let x = 0; x < lv.w; x++) {
    if (lv.chars[y][x] === '#' && lv.chars[y - 1][x] === '.') drawDecor(g, lv, T, x, y - 1);
  }
  return c;
}

function drawGround(g, lv, T, x, y) {
  const px = x * TILE, py = y * TILE;
  const top = !isSolidCh(lv.ch(x, y - 1)) && lv.ch(x, y - 1) !== '~';
  const left = x > 0 && !isSolidCh(lv.ch(x - 1, y));
  const right = x < lv.w - 1 && !isSolidCh(lv.ch(x + 1, y));
  const bottom = y < lv.h - 1 && !isSolidCh(lv.ch(x, y + 1));
  if (T.ground === 'grass') {
    fr(g, T.dirt[1], px, py, 16, 16);
    const depth = Math.min(4, (() => { let d = 0; while (d < 4 && isSolidCh(lv.ch(x, y - d - 1))) d++; return d; })());
    if (depth >= 2) { g.globalAlpha = 0.25 + depth * 0.08; fr(g, T.dirt[0], px, py, 16, 16); g.globalAlpha = 1; }
    for (let i = 0; i < 9; i++) {
      const h = hash2(x * 31 + i, y * 17 + i * 7), h2 = hash2(x * 13 + i * 3, y * 29 + i);
      fr(g, i < 5 ? T.dirt[0] : T.dirt[2], px + ((h * 15) | 0), py + ((h2 * 15) | 0), i % 3 === 0 ? 2 : 1, 1);
    }
    if (hash2(x * 7, y * 3) < 0.35) {
      const sx = px + 2 + ((hash2(x, y * 9) * 10) | 0), sy = py + 6 + ((hash2(x * 5, y) * 7) | 0);
      fr(g, '#6f6658', sx, sy, 4, 2); fr(g, '#958b7a', sx, sy, 3, 1); fr(g, '#4a4238', sx, sy + 2, 4, 1);
    }
    if (left) fr(g, T.dirt[0], px, py, 1, 16);
    if (right) fr(g, T.dirt[0], px + 15, py, 1, 16);
    if (bottom) {
      fr(g, T.dirt[0], px, py + 14, 16, 2);
      for (let i = 0; i < 16; i += 3) if (hash2(x * 16 + i, y + 5) < 0.4) fr(g, T.dirt[0], px + i, py + 16, 1, 2 + ((hash2(i, x) * 3) | 0));
    }
    if (top) {
      fr(g, T.grass[1], px, py, 16, 4);
      fr(g, T.grass[2], px, py, 16, 1);
      fr(g, T.grass[0], px, py + 4, 16, 1);
      for (let i = 0; i < 16; i++) {
        const h = hash2(x * 16 + i, y * 3 + 1);
        if (h < 0.42) { fr(g, T.grass[1], px + i, py + 4, 1, 1 + ((h * 7) | 0)); fr(g, T.grass[0], px + i, py + 5 + ((h * 7) | 0), 1, 1); }
        if (h > 0.72) fr(g, T.grass[2], px + i, py - 1, 1, 1);
        if (h > 0.9) fr(g, T.grass[1], px + i, py - 2, 1, 1);
      }
      if (left) { fr(g, T.grass[1], px, py, 2, 6); fr(g, T.grass[0], px, py + 6, 1, 2); }
      if (right) { fr(g, T.grass[1], px + 14, py, 2, 6); fr(g, T.grass[0], px + 15, py + 6, 1, 2); }
    }
  } else if (T.ground === 'cobble') {
    const C = T.cobble;
    fr(g, C[0], px, py, 16, 16);
    for (let r = 0; r < 4; r++) {
      const yy = py + r * 4;
      const off = ((y * 4 + r) % 2) * 3;
      let xx = px - off;
      let k = 0;
      while (xx < px + 16) {
        const w = 4 + ((hash2(x * 8 + k, y * 4 + r) * 3) | 0);
        const x0 = Math.max(px, xx + 1), x1 = Math.min(px + 16, xx + w);
        if (x1 > x0) {
          const col = hash2(x * 5 + k, y * 7 + r) < 0.5 ? C[1] : C[2];
          fr(g, col, x0, yy + 1, x1 - x0, 3);
          fr(g, C[3], x0, yy + 1, Math.max(1, x1 - x0 - 1), 1);
        }
        xx += w; k++;
      }
    }
    if (top) { fr(g, C[3], px, py, 16, 3); fr(g, '#d4cbbd', px, py, 16, 1); fr(g, C[0], px, py + 3, 16, 1); }
    else shadeDepth(g, lv, x, y, px, py, '#120e0c');
    if (left) fr(g, C[0], px, py, 1, 16);
    if (right) fr(g, C[0], px + 15, py, 1, 16);
    if (bottom) fr(g, C[0], px, py + 15, 16, 1);
  } else {
    const C = T.stone;
    fr(g, C[0], px, py, 16, 16);
    for (let r = 0; r < 2; r++) {
      const off = ((y * 2 + r) % 2) * 8;
      for (let k = -1; k < 2; k++) {
        const bx = px + k * 16 + off;
        const x0 = Math.max(px, bx + 1), x1 = Math.min(px + 16, bx + 16);
        if (x1 <= x0) continue;
        const v = hash2(x * 3 + k, y * 5 + r);
        fr(g, v < 0.5 ? C[1] : C[2], x0, py + r * 8 + 1, x1 - x0, 7);
        fr(g, C[3], x0, py + r * 8 + 1, x1 - x0, 1);
        if (v > 0.8) fr(g, C[0], x0 + 3, py + r * 8 + 4, 3, 1);
      }
    }
    if (top) {
      fr(g, C[3], px, py, 16, 2);
      for (let i = 0; i < 16; i++) if (hash2(x * 16 + i, y) < 0.3) fr(g, '#3c5a3c', px + i, py, 1, 1 + ((hash2(i, y * x) * 3) | 0));
    } else shadeDepth(g, lv, x, y, px, py, '#05060c');
    if (left) fr(g, C[0], px, py, 1, 16);
    if (right) fr(g, C[0], px + 15, py, 1, 16);
  }
}

function shadeDepth(g, lv, x, y, px, py, col) {
  let d = 0;
  while (d < 4 && isSolidCh(lv.ch(x, y - d - 1))) d++;
  g.globalAlpha = Math.min(0.62, 0.2 + d * 0.13);
  fr(g, col, px, py, 16, 16);
  g.globalAlpha = 1;
}

function drawBrick(g, lv, T, x, y) {
  const px = x * TILE, py = y * TILE, C = T.brick;
  fr(g, C[0], px, py, 16, 16);
  for (let r = 0; r < 4; r++) {
    const yy = py + r * 4;
    const off = ((y * 4 + r) % 2) * 4;
    for (let k = -1; k < 3; k++) {
      const bx = px + k * 8 + off;
      const x0 = Math.max(px, bx + 1), x1 = Math.min(px + 16, bx + 8);
      if (x1 <= x0) continue;
      const v = hash2(x * 4 + k, y * 4 + r);
      fr(g, v < 0.6 ? C[1] : mix(C[1], C[2], 0.5), x0, yy + 1, x1 - x0, 3);
      fr(g, C[2], x0, yy + 1, x1 - x0, 1);
    }
  }
  const top = !isSolidCh(lv.ch(x, y - 1));
  if (top) {
    fr(g, C[2], px, py, 16, 1);
    if (T.ground === 'grass') for (let i = 0; i < 16; i++) {
      const h = hash2(x * 16 + i, y + 3);
      if (h < 0.55) fr(g, h < 0.25 ? '#4f8a35' : '#3a6b2b', px + i, py, 1, 1 + ((h * 8) | 0));
    }
  }
  if (!isSolidCh(lv.ch(x - 1, y))) fr(g, C[0], px, py, 1, 16);
  if (!isSolidCh(lv.ch(x + 1, y))) fr(g, C[0], px + 15, py, 1, 16);
}

function drawWood(g, lv, T, x, y) {
  const px = x * TILE, py = y * TILE, C = T.wood;
  fr(g, C[1], px, py, 16, 16);
  for (let r = 0; r < 4; r++) {
    fr(g, C[0], px, py + r * 4 + 3, 16, 1);
    for (let i = 0; i < 3; i++) {
      const h = hash2(x * 9 + i, y * 4 + r);
      fr(g, C[0], px + ((h * 14) | 0), py + r * 4 + 1, 2, 1);
    }
    fr(g, C[2], px, py + r * 4, 16, 1);
  }
  fr(g, '#2a2a2a', px + 2, py + 1, 1, 1); fr(g, '#2a2a2a', px + 13, py + 1, 1, 1);
  if (!isSolidCh(lv.ch(x - 1, y))) fr(g, C[0], px, py, 1, 16);
  if (!isSolidCh(lv.ch(x + 1, y))) fr(g, C[0], px + 15, py, 1, 16);
}

function drawRoof(g, lv, T, x, y) {
  const px = x * TILE, py = y * TILE, C = T.roof;
  const lE = lv.ch(x - 1, y) !== 'R', rE = lv.ch(x + 1, y) !== 'R';
  const below = lv.ch(x, y + 1) !== 'R';
  fr(g, C[1], px, py, 16, 16);
  if (T.roofStyle === 'thatch') {
    for (let i = -16; i < 16; i += 3) {
      for (let j = 0; j < 16; j++) {
        const xx = i + j;
        if (xx >= 0 && xx < 16 && hash2(x * 40 + i, y * 16 + j) < 0.7) fr(g, C[0], px + xx, py + j, 1, 1);
      }
    }
    for (let k = 0; k < 10; k++) fr(g, C[2], px + ((hash2(x * 3 + k, y) * 16) | 0), py + ((hash2(x, y * 3 + k) * 15) | 0), 1, 2);
    if (below) for (let i = 0; i < 16; i++) fr(g, C[0], px + i, py + 14, 1, 2 + (hash2(x * 16 + i, y) < 0.5 ? 1 : 0));
  } else if (T.roofStyle === 'tile') {
    for (let r = 0; r < 4; r++) {
      const off = (r % 2) * 2;
      for (let i = -2; i < 16; i += 4) {
        const xx = px + i + off;
        fr(g, C[0], Math.max(px, xx), py + r * 4 + 3, Math.min(4, px + 16 - Math.max(px, xx)), 1);
        if (xx >= px && xx < px + 16) fr(g, C[0], xx, py + r * 4, 1, 3);
        if (xx + 1 >= px && xx + 1 < px + 16) fr(g, C[2], xx + 1, py + r * 4, 1, 1);
      }
    }
  } else {
    for (let r = 0; r < 4; r++) {
      fr(g, C[0], px, py + r * 4 + 3, 16, 1);
      const off = (r % 2) * 3;
      for (let i = off; i < 16; i += 6) fr(g, C[0], px + i, py + r * 4, 1, 3);
      fr(g, C[2], px, py + r * 4, 16, 1);
    }
  }
  fr(g, C[2], px, py, 16, 1);
  // schräge Kanten
  for (let j = 0; j < 16; j++) {
    if (lE) { g.clearRect(px, py + j, 15 - j, 1); fr(g, OUTLINE, px + 15 - j, py + j, 1, 1); }
    if (rE) { g.clearRect(px + j + 1, py + j, 15 - j, 1); fr(g, OUTLINE, px + j, py + j, 1, 1); }
  }
}

function drawOneWay(g, lv, T, x, y) {
  const px = x * TILE, py = y * TILE, W = T.wood;
  const lE = lv.ch(x - 1, y) !== '=', rE = lv.ch(x + 1, y) !== '=';
  if (T.plat === 'branch') {
    fr(g, OUTLINE, px, py - 1, 16, 8);
    fr(g, W[1], px, py, 16, 5);
    fr(g, W[2], px, py, 16, 1);
    fr(g, W[0], px, py + 5, 16, 1);
    for (let i = 0; i < 4; i++) fr(g, W[0], px + ((hash2(x * 4 + i, y) * 13) | 0), py + 2, 3, 1);
    if (lE) { g.clearRect(px, py - 1, 1, 8); fr(g, OUTLINE, px, py, 1, 6); fr(g, W[2], px + 2, py + 1, 2, 3); fr(g, W[0], px + 3, py + 2, 1, 1); }
    if (rE) { g.clearRect(px + 15, py - 1, 1, 8); fr(g, OUTLINE, px + 15, py, 1, 6); fr(g, W[2], px + 12, py + 1, 2, 3); fr(g, W[0], px + 12, py + 2, 1, 1); }
    if (hash2(x, y * 7) < 0.6) {
      const lx = px + 3 + ((hash2(x * 3, y) * 9) | 0);
      fr(g, '#2f6e2c', lx, py - 3, 5, 3); fr(g, '#4f9a37', lx + 1, py - 4, 3, 2); fr(g, '#7cc84b', lx + 1, py - 4, 1, 1);
    }
  } else if (T.plat === 'plank') {
    fr(g, OUTLINE, px, py - 1, 16, 7);
    fr(g, W[1], px, py, 16, 4);
    fr(g, W[2], px, py, 16, 1);
    fr(g, W[0], px, py + 3, 16, 1);
    fr(g, W[0], px + 7, py, 1, 4);
    fr(g, '#2a2a2a', px + 2, py + 1, 1, 1); fr(g, '#2a2a2a', px + 12, py + 1, 1, 1);
    if (lE || rE || x % 3 === 0) {
      const bx = rE && !lE ? px + 11 : px + 3;
      for (let k = 0; k < 5; k++) { fr(g, OUTLINE, bx + k - 1, py + 4 + k, 3, 2); }
      for (let k = 0; k < 5; k++) fr(g, W[0], bx + k, py + 4 + k, 1, 1);
    }
  } else {
    const C = T.stone || T.brick;
    fr(g, OUTLINE, px, py - 1, 16, 8);
    fr(g, C[1] || C[0], px, py, 16, 6);
    fr(g, C[3] || C[2], px, py, 16, 1);
    fr(g, C[0], px + ((x % 2) ? 4 : 11), py + 1, 1, 5);
    fr(g, C[0], px, py + 5, 16, 1);
    if (lE) fr(g, OUTLINE, px, py, 1, 6);
    if (rE) fr(g, OUTLINE, px + 15, py, 1, 6);
  }
}

function drawSpikes(g, lv, T, x, y) {
  const px = x * TILE, py = y * TILE;
  if (T.spike === 'thorn') {
    for (let i = 0; i < 16; i++) {
      const h = 5 + ((hash2(x * 16 + i, y) * 5) | 0) + (Math.sin(i * 0.9 + x) > 0 ? 2 : 0);
      fr(g, OUTLINE, px + i, py + 16 - h - 1, 1, h + 1);
    }
    for (let i = 0; i < 16; i++) {
      const h = 4 + ((hash2(x * 16 + i, y) * 5) | 0) + (Math.sin(i * 0.9 + x) > 0 ? 2 : 0);
      fr(g, i % 3 ? '#2d4a26' : '#3d5e2e', px + i, py + 16 - h, 1, h);
    }
    for (let k = 0; k < 6; k++) {
      const tx = px + 1 + ((hash2(x * 6 + k, y * 3) * 14) | 0), ty = py + 6 + ((hash2(x, y * 6 + k) * 7) | 0);
      fr(g, '#d8ccb0', tx, ty, 1, 1); fr(g, '#d8ccb0', tx + (k % 2 ? 1 : -1), ty - 1, 1, 1);
    }
    if (hash2(x * 2, y) < 0.6) { const bx = px + 4 + ((hash2(x, y * 2) * 8) | 0); fr(g, '#c3303a', bx, py + 9, 2, 2); fr(g, '#ff7a80', bx, py + 9, 1, 1); }
  } else {
    fr(g, OUTLINE, px, py + 13, 16, 3);
    fr(g, '#3b3d46', px, py + 14, 16, 2);
    for (let k = 0; k < 4; k++) {
      const sx = px + k * 4;
      for (let j = 0; j < 8; j++) {
        const w = Math.max(1, Math.round((j + 1) / 8 * 3));
        const xx = sx + 2 - Math.ceil(w / 2);
        fr(g, OUTLINE, xx - (j === 7 ? 0 : 0), py + 6 + j, w + 1, 1);
        fr(g, '#a2a8b2', xx, py + 6 + j, Math.max(1, w - 1), 1);
        if (j > 1) fr(g, '#e2e6ea', xx, py + 6 + j, 1, 1);
      }
    }
  }
}

function drawBgTile(g, lv, T, ch, x, y) {
  const px = x * TILE, py = y * TILE;
  if (ch === 'w' || ch === 'u' || ch === 'd') {
    const W = T.wall;
    const same = (c) => c === 'w' || c === 'u' || c === 'd';
    if (lv.theme === 'castle') {
      fr(g, W[1], px, py, 16, 16);
      for (let r = 0; r < 2; r++) { fr(g, W[2], px, py + r * 8 + 7, 16, 1); fr(g, W[2], px + ((r + y) % 2) * 8, py + r * 8, 1, 7); }
    } else {
      fr(g, W[0], px, py, 16, 16);
      for (let k = 0; k < 6; k++) fr(g, W[1], px + ((hash2(x * 6 + k, y) * 15) | 0), py + ((hash2(x, y * 6 + k) * 15) | 0), 2, 1);
      if (!same(lv.ch(x, y - 1))) fr(g, W[2], px, py, 16, 2);
      if (!same(lv.ch(x - 1, y))) fr(g, W[2], px, py, 2, 16);
      if (!same(lv.ch(x + 1, y))) fr(g, W[2], px + 14, py, 2, 16);
      if (lv.theme === 'village' && ch === 'w') {
        if (x % 3 === 0) fr(g, W[2], px + 7, py, 2, 16);
        if (hash2(x, y) < 0.35) for (let k = 0; k < 14; k++) fr(g, W[2], px + 1 + k, py + 14 - k, 2, 1);
      } else if (lv.theme === 'city' && ch === 'w') {
        fr(g, W[1], px, py + 7, 16, 1);
        fr(g, W[1], px + ((y % 2) ? 4 : 11), py, 1, 7);
        fr(g, W[1], px + ((y % 2) ? 11 : 4), py + 8, 1, 8);
      }
      if (lv.ch(x, y + 1) === '#') { fr(g, '#7e7466', px, py + 12, 16, 4); fr(g, '#9a907f', px, py + 12, 16, 1); fr(g, '#5a5246', px + 5, py + 13, 1, 3); fr(g, '#5a5246', px + 11, py + 13, 1, 3); }
    }
    if (ch === 'u') {
      const lit = THEMES[lv.theme].lights;
      fr(g, '#3a2414', px + 3, py + 3, 10, 10);
      fr(g, lit ? '#ffcf6e' : '#7fa6c4', px + 4, py + 4, 8, 8);
      if (lit) { fr(g, '#fff0b8', px + 4, py + 4, 3, 3); fr(g, '#e39b3c', px + 9, py + 9, 3, 3); }
      else { fr(g, '#c5dff0', px + 5, py + 5, 2, 2); }
      fr(g, '#3a2414', px + 7, py + 4, 2, 8); fr(g, '#3a2414', px + 4, py + 7, 8, 2);
      if (lv.theme === 'village') { fr(g, '#4e7a3a', px + 1, py + 3, 2, 10); fr(g, '#4e7a3a', px + 13, py + 3, 2, 10); }
      fr(g, '#5a3a22', px + 2, py + 13, 12, 1);
    } else if (ch === 'd') {
      const ground = lv.ch(x, y + 1) === '#';
      const top = py + 2, h = ground ? 14 : 14;
      fr(g, '#2a1a0e', px + 2, top, 12, h);
      fr(g, '#7a4a24', px + 3, top + 2, 10, h - 2);
      fr(g, '#7a4a24', px + 4, top + 1, 8, 1);
      fr(g, '#5a3418', px + 6, top + 2, 1, h - 2); fr(g, '#5a3418', px + 9, top + 2, 1, h - 2);
      fr(g, '#9a6a3a', px + 3, top + 2, 1, h - 2);
      fr(g, '#d9b04a', px + 11, top + 8, 1, 2);
    }
    return;
  }
  if (ch === ':') {
    const W = T.bgwall || T.wall;
    fr(g, W[0], px, py, 16, 16);
    for (let r = 0; r < 4; r++) {
      const off = ((y * 4 + r) % 2) * 4;
      for (let k = -1; k < 3; k++) {
        const bx = px + k * 8 + off;
        const x0 = Math.max(px, bx + 1), x1 = Math.min(px + 16, bx + 8);
        if (x1 <= x0) continue;
        fr(g, hash2(x * 4 + k, y * 4 + r) < 0.7 ? W[1] : W[2], x0, py + r * 4 + 1, x1 - x0, 3);
      }
    }
    if (lv.ch(x, y - 1) !== ':') { fr(g, '#0c0d13', px, py, 16, 3); }
    return;
  }
  if (ch === 'Y') {
    const lE = lv.ch(x - 1, y) !== 'Y', rE = lv.ch(x + 1, y) !== 'Y';
    fr(g, '#4b321c', px, py, 16, 16);
    if (lE) fr(g, '#6b4a2a', px + 1, py, 3, 16);
    if (rE) fr(g, '#33210f', px + 12, py, 3, 16);
    for (let k = 0; k < 5; k++) fr(g, '#33210f', px + 4 + ((hash2(x * 5 + k, y) * 8) | 0), py + ((hash2(x, y * 5 + k) * 12) | 0), 1, 3 + ((hash2(k, y) * 4) | 0));
    if (hash2(x * 3, y * 3) < 0.25) { fr(g, '#2a1a0c', px + 6, py + 6, 4, 3); fr(g, '#6b4a2a', px + 7, py + 7, 2, 1); }
    if (lE) fr(g, OUTLINE, px, py, 1, 16);
    if (rE) fr(g, OUTLINE, px + 15, py, 1, 16);
    if (isSolidCh(lv.ch(x, y + 1))) {
      const left = lv.ch(x - 1, y) !== 'Y';
      if (left) { fr(g, '#4b321c', px - 3, py + 12, 4, 4); fr(g, '#4b321c', px - 5, py + 14, 3, 2); }
      else { fr(g, '#4b321c', px + 15, py + 12, 4, 4); fr(g, '#4b321c', px + 18, py + 14, 3, 2); }
    }
    return;
  }
  if (ch === 'y') {
    const cols = ['#24562a', '#2f6a30', '#3d823a', '#56a447'];
    const n = (dx, dy) => lv.ch(x + dx, y + dy) === 'y';
    for (let by = 0; by < 8; by++) for (let bx = 0; bx < 8; bx++) {
      const h = hash2(x * 8 + bx, y * 8 + by);
      const edgeL = !n(-1, 0) && bx < 2, edgeR = !n(1, 0) && bx > 5, edgeT = !n(0, -1) && by < 2, edgeB = !n(0, 1) && by > 5;
      if ((edgeL || edgeR || edgeT || edgeB) && h < 0.55) continue;
      let ci = h < 0.3 ? 0 : h < 0.65 ? 1 : h < 0.92 ? 2 : 3;
      if (!n(0, -1) && by < 3 && ci < 2) ci++;
      fr(g, cols[ci], px + bx * 2, py + by * 2, 2, 2);
    }
    return;
  }
  if (ch === 'f') {
    const W = THEMES[lv.theme].wood;
    fr(g, OUTLINE, px + 1, py + 5, 4, 11); fr(g, OUTLINE, px + 11, py + 5, 4, 11);
    fr(g, OUTLINE, px, py + 7, 16, 4); fr(g, OUTLINE, px, py + 12, 16, 3);
    fr(g, W[2], px + 2, py + 6, 2, 10); fr(g, W[2], px + 12, py + 6, 2, 10);
    fr(g, W[1], px, py + 8, 16, 2); fr(g, W[1], px, py + 13, 16, 1);
    fr(g, W[2], px, py + 8, 16, 1);
  }
}

function drawDecor(g, lv, T, x, y) {
  const px = x * TILE, py = y * TILE;
  const h = hash2(x * 11, y * 5);
  const bx = px + 2 + ((hash2(x * 3, y * 7) * 11) | 0);
  const by = py + 16;
  if (T.decor === 'forest' || T.decor === 'village') {
    if (h < 0.2) {
      for (let k = 0; k < 4; k++) {
        const hh = 2 + ((hash2(x * 4 + k, y) * 4) | 0);
        fr(g, k % 2 ? T.grass[1] : T.grass[2], bx + k, by - hh, 1, hh);
      }
    } else if (h < 0.3) {
      const cols = ['#f4e04d', '#e8638f', '#ffffff', '#86b8ff', '#ff8f3a'];
      const c = cols[(hash2(x, y) * cols.length) | 0];
      fr(g, T.grass[0], bx, by - 3, 1, 3);
      fr(g, OUTLINE, bx - 1, by - 5, 3, 3);
      fr(g, c, bx, by - 4, 1, 1);
      fr(g, c, bx - 1, by - 4, 1, 1); fr(g, c, bx + 1, by - 4, 1, 1); fr(g, c, bx, by - 5, 1, 1);
      fr(g, '#f6d34a', bx, by - 4, 1, 1);
    } else if (h < 0.34 && T.decor === 'forest') {
      fr(g, OUTLINE, bx - 1, by - 6, 7, 4); fr(g, OUTLINE, bx + 1, by - 3, 3, 3);
      fr(g, '#d23a2e', bx, by - 5, 5, 2); fr(g, '#f2e6d6', bx + 2, by - 3, 1, 3);
      fr(g, '#ffffff', bx + 1, by - 5, 1, 1); fr(g, '#ffffff', bx + 3, by - 4, 1, 1);
    } else if (h < 0.4) {
      fr(g, OUTLINE, bx - 1, by - 3, 6, 3); fr(g, '#8b8478', bx, by - 2, 4, 2); fr(g, '#aaa395', bx, by - 2, 2, 1);
    }
  } else if (T.decor === 'city') {
    if (h < 0.08) { fr(g, '#5a524a', bx, by - 1, 2, 1); fr(g, '#5a524a', bx + 4, by - 1, 1, 1); }
    else if (h < 0.13) { fr(g, OUTLINE, bx - 1, by - 3, 6, 3); fr(g, '#8b8478', bx, by - 2, 4, 2); }
  } else if (T.decor === 'castle') {
    if (h < 0.1) { fr(g, '#3c5a3c', bx, by - 2, 3, 2); fr(g, '#4f7a4a', bx + 1, by - 3, 1, 1); }
  }
}

// ---------------------------------------------------------------------
//  Bewegliche Kacheln
// ---------------------------------------------------------------------
function drawWaterTiles(g, lv, cam, t) {
  const T = THEMES[lv.theme];
  const x0 = Math.max(0, Math.floor(cam.x / TILE)), x1 = Math.min(lv.w - 1, Math.floor((cam.x + VIEW_W) / TILE));
  const y0 = Math.max(0, Math.floor(cam.y / TILE)), y1 = Math.min(lv.h - 1, Math.floor((cam.y + VIEW_H) / TILE));
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    if (lv.chars[y][x] !== '~') continue;
    const sx = x * TILE - cam.x, sy = y * TILE - cam.y;
    const surface = lv.ch(x, y - 1) !== '~';
    if (surface) {
      for (let i = 0; i < 16; i++) {
        const wx = x * TILE + i;
        const wv = Math.round(Math.sin(wx * 0.22 + t * 2.6) * 1.2 + Math.sin(wx * 0.09 - t * 1.7));
        const top = sy + 4 + wv;
        g.fillStyle = T.water[1]; g.fillRect(sx + i, top, 1, sy + 16 - top);
        g.fillStyle = T.water[2]; g.fillRect(sx + i, top, 1, 1);
        if (((wx + Math.floor(t * 8)) % 23) === 0) g.fillRect(sx + i, top + 3, 2, 1);
      }
    } else {
      g.fillStyle = T.water[0]; g.fillRect(sx, sy, 16, 16);
      if (((x * 7 + y * 3 + Math.floor(t * 2)) % 11) === 0) { g.fillStyle = T.water[1]; g.fillRect(sx + 4, sy + 6, 3, 1); }
    }
  }
}

function drawCrumble(g, T, sx, sy, shake) {
  const W = T.wood;
  const ox = shake ? Math.round(rand(-1, 1)) : 0;
  sx += ox;
  fr(g, OUTLINE, sx, sy - 1, 16, 7);
  fr(g, W[2], sx, sy, 16, 4);
  fr(g, '#c4925a', sx, sy, 16, 1);
  fr(g, W[0], sx, sy + 4, 16, 1);
  fr(g, W[0], sx + 5, sy, 1, 2); fr(g, W[0], sx + 6, sy + 2, 1, 2);
  fr(g, W[0], sx + 11, sy + 1, 1, 3);
  fr(g, '#2a2a2a', sx + 2, sy + 1, 1, 1); fr(g, '#2a2a2a', sx + 13, sy + 2, 1, 1);
}

function drawCrate(g, sx, sy) {
  fr(g, OUTLINE, sx, sy, 16, 16);
  fr(g, '#8a5a2b', sx + 1, sy + 1, 14, 14);
  fr(g, '#b07a40', sx + 1, sy + 1, 14, 2);
  fr(g, '#b07a40', sx + 1, sy + 13, 14, 2);
  fr(g, '#5e3b19', sx + 1, sy + 3, 14, 1);
  for (let k = 0; k < 10; k++) { fr(g, '#5e3b19', sx + 3 + k, sy + 3 + k, 2, 1); }
  fr(g, '#c99a5a', sx + 1, sy + 1, 14, 1);
  fr(g, '#3a3a3a', sx + 2, sy + 2, 1, 1); fr(g, '#3a3a3a', sx + 13, sy + 2, 1, 1);
  fr(g, '#3a3a3a', sx + 2, sy + 13, 1, 1); fr(g, '#3a3a3a', sx + 13, sy + 13, 1, 1);
}

function drawDoor(g, theme, sx, sy, h, open) {
  const off = Math.round(open * (h - 4));
  g.save();
  g.beginPath(); g.rect(sx - 2, sy - 2, 20, h + 2); g.clip();
  const y0 = sy - off;
  fr(g, OUTLINE, sx + 1, y0, 14, h);
  for (let i = 0; i < 4; i++) { fr(g, '#4a4e58', sx + 2 + i * 4, y0, 2, h); fr(g, '#8a909c', sx + 2 + i * 4, y0, 1, h); }
  for (let j = 4; j < h; j += 6) { fr(g, '#4a4e58', sx + 1, y0 + j, 14, 2); fr(g, '#8a909c', sx + 1, y0 + j, 14, 1); }
  for (let i = 0; i < 4; i++) { fr(g, OUTLINE, sx + 2 + i * 4, y0 + h, 2, 3); fr(g, '#8a909c', sx + 2 + i * 4, y0 + h, 1, 2); }
  g.restore();
  fr(g, OUTLINE, sx, sy - 3, 16, 3);
  fr(g, '#3a3d45', sx + 1, sy - 2, 14, 1);
}

// ---------------------------------------------------------------------
//  Hintergründe (Parallax)
// ---------------------------------------------------------------------
function skyBands(g, y0, y1, cols) {
  const H = y1 - y0, n = cols.length - 1;
  for (let y = y0; y < y1; y += 3) {
    const t = clamp((y - y0) / H, 0, 0.9999) * n;
    const i = Math.floor(t);
    g.fillStyle = mix(cols[i], cols[i + 1], Math.round((t - i) * 6) / 6);
    g.fillRect(0, y, VIEW_W, 3);
  }
}

function disc(g, cx, cy, r) {
  cx = Math.round(cx); cy = Math.round(cy);
  for (let dy = -r; dy <= r; dy++) {
    const w = Math.floor(Math.sqrt(r * r - dy * dy));
    g.fillRect(cx - w, cy + dy, w * 2 + 1, 1);
  }
}

function wrapDraw(W, x, fn) { fn(x); fn(x - W); fn(x + W); }

function ridge(g, W, H, base, waves, color, top) {
  g.fillStyle = color;
  for (let x = 0; x < W; x++) {
    let y = base;
    for (const [a, k, p] of waves) y -= a * Math.sin((Math.PI * 2 * k * x) / W + p);
    y = Math.round(y);
    g.fillRect(x, y, 1, H - y);
    if (top) { g.fillStyle = top; g.fillRect(x, y, 1, 1); g.fillStyle = color; }
  }
}

function pine(g, x, base, h, col) {
  g.fillStyle = col;
  for (let r = 0; r < h; r++) {
    const step = r % 7;
    const w = Math.floor((r / h) * h * 0.32) + 1 - (step < 2 ? 1 : 0);
    g.fillRect(Math.round(x - w), base - h + r, w * 2 + 1, 1);
  }
  g.fillRect(Math.round(x), base - 2, 1, 4);
}

function makeBackdrop(theme) {
  const R = rng(theme.length * 977 + 13);
  const bd = { sky: null, layers: [], theme, stars: [] };
  const [sky, sg] = makeCanvas(VIEW_W, VIEW_H);
  bd.sky = sky;
  const LW = 640, LH = VIEW_H + 60;
  const layer = (f, yf, draw, auto) => {
    const [c, g] = makeCanvas(LW, LH);
    draw(g);
    bd.layers.push({ c, f, yf, w: LW, auto: auto || 0 });
  };
  const clouds = (g, col, shade, n, yMin, yMax) => {
    for (let i = 0; i < n; i++) {
      const x = R() * LW, y = yMin + R() * (yMax - yMin), s = 6 + R() * 8;
      wrapDraw(LW, x, (xx) => {
        g.fillStyle = shade;
        disc(g, xx, y + 2, s); disc(g, xx + s, y + 3, s * 0.8); disc(g, xx - s, y + 3, s * 0.7);
        g.fillStyle = col;
        disc(g, xx, y, s); disc(g, xx + s, y + 1, s * 0.8); disc(g, xx - s, y + 2, s * 0.7); disc(g, xx + s * 0.4, y - s * 0.5, s * 0.7);
      });
    }
  };

  if (theme === 'forest') {
    skyBands(sg, 0, VIEW_H, ['#6fb3e6', '#9ad2ec', '#cfeedd', '#e9f6d2']);
    layer(0.03, 0.05, (g) => clouds(g, '#ffffff', '#d7ecf4', 7, 20, 90), 5);
    layer(0.08, 0.1, (g) => ridge(g, LW, LH, 170, [[12, 2, 0.3], [7, 5, 1.2], [3, 11, 2]], '#9cc6ae', '#b5d6c2'));
    layer(0.18, 0.2, (g) => {
      g.fillStyle = '#79a88c'; g.fillRect(0, 196, LW, LH);
      for (let i = 0; i < 60; i++) { const x = R() * LW, h = 26 + R() * 36; wrapDraw(LW, x, (xx) => pine(g, xx, 200, h, '#79a88c')); }
      for (let i = 0; i < 40; i++) { const x = R() * LW, h = 18 + R() * 20; wrapDraw(LW, x, (xx) => pine(g, xx, 204, h, '#6c9c80')); }
    });
    layer(0.35, 0.32, (g) => {
      for (let i = 0; i < 14; i++) {
        const x = (i / 14) * LW + R() * 20, w = 6 + R() * 6;
        wrapDraw(LW, x, (xx) => { g.fillStyle = '#4a4a36'; g.fillRect(Math.round(xx), 60, Math.round(w), LH); g.fillStyle = '#5d5a42'; g.fillRect(Math.round(xx), 60, 2, LH); });
      }
      for (let i = 0; i < 70; i++) {
        const x = R() * LW, y = 30 + R() * 70, r = 10 + R() * 18;
        wrapDraw(LW, x, (xx) => { g.fillStyle = '#3e7449'; disc(g, xx, y, r); g.fillStyle = '#4c8655'; disc(g, xx - r * 0.3, y - r * 0.3, r * 0.6); });
      }
      g.fillStyle = '#3e7449'; g.fillRect(0, 0, LW, 34);
      g.fillStyle = '#3a6a45'; g.fillRect(0, 222, LW, LH);
      g.globalAlpha = 0.09; g.fillStyle = '#fff6c8';
      for (let i = 0; i < 5; i++) {
        const x = R() * LW;
        wrapDraw(LW, x, (xx) => { g.beginPath(); g.moveTo(xx, 40); g.lineTo(xx + 18, 40); g.lineTo(xx + 90, LH); g.lineTo(xx + 50, LH); g.fill(); });
      }
      g.globalAlpha = 1;
    });
    layer(0.6, 0.48, (g) => {
      for (let i = 0; i < 40; i++) {
        const x = R() * LW, r = 8 + R() * 14;
        wrapDraw(LW, x, (xx) => { g.fillStyle = '#2b5633'; disc(g, xx, 246, r); g.fillStyle = '#356640'; disc(g, xx - 3, 243, r * 0.6); });
      }
      g.fillStyle = '#2b5633'; g.fillRect(0, 246, LW, LH);
    });
  } else if (theme === 'village') {
    skyBands(sg, 0, VIEW_H, ['#5b93cf', '#94bde0', '#f0cd9c', '#fbe1b0']);
    sg.globalAlpha = 0.18; sg.fillStyle = '#fff2c2'; disc(sg, 360, 150, 56); sg.globalAlpha = 0.35; disc(sg, 360, 150, 34); sg.globalAlpha = 1;
    sg.fillStyle = '#fff6d6'; disc(sg, 360, 150, 20);
    layer(0.03, 0.05, (g) => clouds(g, '#fff4e2', '#f2cfae', 6, 25, 100), 4);
    layer(0.07, 0.1, (g) => {
      ridge(g, LW, LH, 178, [[10, 2, 0.5], [6, 4, 2], [2, 9, 1]], '#a7b67c');
      const im = g.getImageData(0, 0, LW, LH);
      g.fillStyle = '#b9c382';
      for (let x = 0; x < LW; x++) for (let y = 150; y < LH; y++) {
        if (im.data[(y * LW + x) * 4 + 3] > 0 && (((x + y * 3) >> 4) % 3 === 0)) g.fillRect(x, y, 1, 1);
      }
      const wx = 470;
      wrapDraw(LW, wx, (xx) => {
        g.fillStyle = '#7d8468';
        g.beginPath(); g.moveTo(xx - 7, 172); g.lineTo(xx + 7, 172); g.lineTo(xx + 4, 140); g.lineTo(xx - 4, 140); g.fill();
        g.fillRect(xx - 5, 136, 10, 5);
        g.fillStyle = '#6a7158';
        for (let a = 0; a < 4; a++) {
          const an = a * Math.PI / 2 + 0.4;
          for (let r = 0; r < 20; r++) g.fillRect(Math.round(xx + Math.cos(an) * r), Math.round(138 + Math.sin(an) * r), 2, 2);
        }
      });
    });
    layer(0.2, 0.22, (g) => {
      g.fillStyle = '#93a868'; g.fillRect(0, 206, LW, LH);
      for (let i = 0; i < 16; i++) {
        const x = R() * LW, w = 18 + R() * 16, h = 10 + R() * 8;
        wrapDraw(LW, x, (xx) => {
          xx = Math.round(xx);
          g.fillStyle = '#c8b291'; g.fillRect(xx, 206 - h, w, h);
          g.fillStyle = '#8f6c4c';
          for (let r = 0; r < 10; r++) g.fillRect(xx - 2 + r, 206 - h - 10 + r, w + 4 - r * 2, 1);
          g.fillStyle = '#6e5844'; g.fillRect(xx + 3, 206 - h + 3, 3, 3);
        });
      }
      wrapDraw(LW, 200, (xx) => { g.fillStyle = '#b8a689'; g.fillRect(xx, 160, 12, 46); g.fillStyle = '#7f6650'; for (let r = 0; r < 18; r++) g.fillRect(xx + 6 - Math.floor(r / 3), 142 + r, 1 + Math.floor(r / 3) * 2, 1); });
      for (let i = 0; i < 18; i++) { const x = R() * LW, r = 6 + R() * 7; wrapDraw(LW, x, (xx) => { g.fillStyle = '#7e9a58'; disc(g, xx, 204, r); }); }
    });
    layer(0.42, 0.38, (g) => {
      for (let i = 0; i < 26; i++) { const x = R() * LW, r = 8 + R() * 12; wrapDraw(LW, x, (xx) => { g.fillStyle = '#5b8a3c'; disc(g, xx, 236, r); g.fillStyle = '#6c9c48'; disc(g, xx - 3, 232, r * 0.55); }); }
      g.fillStyle = '#5b8a3c'; g.fillRect(0, 236, LW, LH);
      g.fillStyle = '#7a5a36';
      for (let x = 0; x < LW; x += 14) { g.fillRect(x, 226, 3, 16); }
      g.fillRect(0, 230, LW, 2); g.fillRect(0, 236, LW, 2);
    });
  } else if (theme === 'city') {
    skyBands(sg, 0, VIEW_H, ['#221c47', '#4f2f63', '#a24f6b', '#e5855c', '#f6b468']);
    for (let i = 0; i < 40; i++) { sg.fillStyle = i % 3 ? '#e8d8ff' : '#ffffff'; sg.globalAlpha = 0.4 + R() * 0.6; sg.fillRect((R() * VIEW_W) | 0, (R() * 70) | 0, 1, 1); }
    sg.globalAlpha = 0.2; sg.fillStyle = '#ffc982'; disc(sg, 120, 200, 50); sg.globalAlpha = 0.45; disc(sg, 120, 200, 32); sg.globalAlpha = 1;
    sg.fillStyle = '#ffd59a'; disc(sg, 120, 200, 20);
    layer(0.025, 0.05, (g) => clouds(g, '#c46a7a', '#8e4a6a', 5, 60, 120), 3);
    layer(0.05, 0.1, (g) => {
      ridge(g, LW, LH, 192, [[8, 1, 0.2], [5, 3, 1]], '#34284d');
      const cx = 360;
      g.fillStyle = '#2d2244';
      g.fillRect(cx - 40, 120, 80, 80); g.fillRect(cx - 56, 140, 20, 60); g.fillRect(cx + 36, 140, 20, 60);
      g.fillRect(cx - 12, 92, 24, 30);
      for (let k = 0; k < 10; k++) g.fillRect(cx - 40 + k * 8, 114, 5, 6);
      for (const tx of [cx - 46, cx + 46]) { for (let r = 0; r < 16; r++) g.fillRect(tx - Math.floor(r / 2), 124 + r, 1 + Math.floor(r / 2) * 2, 1); }
      for (let r = 0; r < 14; r++) g.fillRect(cx - Math.floor(r / 2), 78 + r, 1 + Math.floor(r / 2) * 2, 1);
      g.fillRect(cx, 66, 1, 12); g.fillStyle = '#a2303a'; g.fillRect(cx + 1, 66, 7, 4);
      g.fillStyle = '#ffcf70';
      for (let k = 0; k < 12; k++) g.fillRect(cx - 34 + ((R() * 64) | 0), 128 + ((R() * 60) | 0), 2, 3);
      g.fillRect(cx - 2, 100, 3, 4);
    });
    layer(0.18, 0.2, (g) => {
      g.fillStyle = '#3c2c4f'; g.fillRect(0, 212, LW, LH);
      let x = 0;
      while (x < LW) {
        const w = 18 + R() * 18, h = 20 + R() * 26;
        const xx = Math.round(x);
        g.fillStyle = '#3c2c4f'; g.fillRect(xx, 212 - h, Math.round(w), h);
        for (let r = 0; r < w / 2; r++) g.fillRect(xx + r, Math.round(212 - h - w / 2 + r), Math.max(1, Math.round(w - r * 2)), 1);
        g.fillStyle = '#f2b45e';
        for (let k = 0; k < 3; k++) if (R() < 0.6) g.fillRect(xx + 3 + ((R() * (w - 6)) | 0), Math.round(212 - h + 4 + R() * (h - 8)), 2, 3);
        x += w + 2;
      }
    });
    layer(0.38, 0.36, (g) => {
      g.fillStyle = '#4b3858'; g.fillRect(0, 206, LW, LH);
      for (let x = 0; x < LW; x += 10) g.fillRect(x, 200, 6, 6);
      for (let tx = 80; tx < LW; tx += 220) {
        g.fillRect(tx, 170, 34, 40);
        for (let k = 0; k < 4; k++) g.fillRect(tx - 2 + k * 10, 164, 6, 7);
        g.fillStyle = '#2a1e36'; g.fillRect(tx + 15, 182, 3, 8); g.fillStyle = '#4b3858';
      }
      g.fillStyle = '#3e2e4a'; for (let x = 0; x < LW; x += 24) g.fillRect(x + ((x / 24) % 2) * 6, 214, 12, 1);
    });
  } else {
    skyBands(sg, 0, VIEW_H, ['#03051a', '#0a1031', '#141d48', '#212d62']);
    for (let i = 0; i < 120; i++) {
      const x = (R() * VIEW_W) | 0, y = (R() * 200) | 0;
      sg.globalAlpha = 0.3 + R() * 0.7; sg.fillStyle = R() < 0.3 ? '#9fb3ff' : '#ffffff'; sg.fillRect(x, y, 1, 1);
      if (R() < 0.15) bd.stars.push([x, y, R() * 6]);
    }
    sg.globalAlpha = 0.08; sg.fillStyle = '#e8f0ff'; disc(sg, 390, 52, 44); sg.globalAlpha = 0.16; disc(sg, 390, 52, 28); sg.globalAlpha = 1;
    sg.fillStyle = '#f1ecd2'; disc(sg, 390, 52, 16);
    sg.fillStyle = '#d6cfb0'; disc(sg, 385, 48, 3); disc(sg, 395, 58, 2); disc(sg, 396, 46, 2);
    layer(0.02, 0.04, (g) => clouds(g, '#1a2350', '#141b40', 4, 70, 130), 2);
    layer(0.04, 0.08, (g) => ridge(g, LW, LH, 182, [[14, 2, 0.8], [8, 5, 0.1], [3, 13, 0]], '#0f1536'));
    layer(0.16, 0.2, (g) => {
      g.fillStyle = '#161c42'; g.fillRect(0, 204, LW, LH);
      for (let i = 0; i < 6; i++) {
        const x = 40 + i * 105 + R() * 30, w = 16 + R() * 12, h = 50 + R() * 50;
        wrapDraw(LW, x, (xx) => {
          xx = Math.round(xx);
          g.fillStyle = '#161c42'; g.fillRect(xx, 204 - h, w, h);
          for (let r = 0; r < w * 0.9; r++) g.fillRect(xx + Math.floor(w / 2) - Math.floor(r / 1.8), Math.round(204 - h - w * 0.9 + r), Math.floor(r / 1.8) * 2 + 1, 1);
          g.fillStyle = '#ffb75a';
          for (let k = 0; k < 3; k++) if (R() < 0.7) g.fillRect(xx + 4 + ((R() * (w - 8)) | 0), Math.round(204 - h + 8 + R() * (h - 20)), 2, 3);
        });
      }
    });
    layer(0.36, 0.34, (g) => {
      g.fillStyle = '#1e2550'; g.fillRect(0, 196, LW, LH);
      for (let x = 0; x < LW; x += 12) g.fillRect(x, 188, 7, 8);
      g.fillStyle = '#161b3c';
      for (let x = 6; x < LW; x += 48) g.fillRect(x, 204, 3, 10);
      g.fillStyle = '#252d5c'; for (let y = 200; y < LH; y += 8) for (let x = ((y / 8) % 2) * 8; x < LW; x += 16) g.fillRect(x, y, 15, 1);
    });
  }
  return bd;
}

function drawBackdrop(g, bd, camX, camY, t) {
  g.drawImage(bd.sky, 0, 0);
  if (bd.stars.length) {
    for (const [x, y, p] of bd.stars) {
      const a = 0.5 + 0.5 * Math.sin(t * 2 + p);
      g.globalAlpha = a; g.fillStyle = '#ffffff'; g.fillRect(x, y, 1, 1);
      if (a > 0.85) { g.fillRect(x - 1, y, 3, 1); g.fillRect(x, y - 1, 1, 3); }
    }
    g.globalAlpha = 1;
  }
  for (const L of bd.layers) {
    let off = -((camX * L.f + t * L.auto) % L.w);
    if (off > 0) off -= L.w;
    off = Math.round(off);
    const oy = Math.round(-camY * L.yf);
    for (let x = off; x < VIEW_W; x += L.w) g.drawImage(L.c, x, oy);
  }
}

// ---------------------------------------------------------------------
//  Figuren
// ---------------------------------------------------------------------
const RUN_X = [3, 1, -1, -3, -1, 1];
const RUN_L = [0, 0, 0, 1, 2, 1];

const RC = {
  skin: '#f0c18e', skinS: '#cf9566', hair: '#7a4520', eye: '#2a1a10',
  green: '#3f9140', greenD: '#2b6a2f', greenL: '#68bb56',
  hose: '#5b4026', hoseD: '#45301b', boot: '#4a2c15', bootL: '#6b4423',
  belt: '#3a2312', buckle: '#f0c24a', quiver: '#8b5a2b', quiverD: '#5e3b19',
  bow: '#a86b2d', string: '#f2ead2', shaft: '#d8b070', tip: '#d6dde4', fletch: '#f2ece0', feather: '#d6402f',
};

function legs(R, f, moving, air, vy, hose, hoseD, boot, bootB) {
  let fx = 0, fl = 0, bx = 0, bl = 0;
  if (air) { if (vy < 0) { fx = 2; fl = 3; bx = -2; bl = 1; } else { fx = 1; fl = 1; bx = -2; bl = 2; } }
  else if (moving) { fx = RUN_X[f]; fl = RUN_L[f]; bx = RUN_X[(f + 3) % 6]; bl = RUN_L[(f + 3) % 6]; }
  R.rect(-3 + bx, -7 - bl, 3, 5, hoseD);
  R.rect(-3 + bx, -3 - bl, 4, 3, bootB || boot);
  R.rect(0 + fx, -7 - fl, 3, 5, hose);
  R.rect(0 + fx, -3 - fl, 4, 3, boot);
}

function drawBow(R, S, a, pull, withArrow, glow) {
  const d = [Math.cos(a), Math.sin(a)], n = [-Math.sin(a), Math.cos(a)];
  const G = [S[0] + d[0] * 7, S[1] + d[1] * 7];
  R.line(S[0], S[1], G[0], G[1], RC.green);
  R.line(S[0], S[1] + 1, G[0], G[1] + 1, RC.green);
  const bow = glow ? '#ffd76a' : RC.bow;
  let prev = null;
  for (let t = -9; t <= 9; t++) {
    const k = 2.6 * (t / 9) * (t / 9);
    const P = [G[0] + n[0] * t - d[0] * k, G[1] + n[1] * t - d[1] * k];
    if (prev) R.line(prev[0], prev[1], P[0], P[1], bow);
    prev = P;
  }
  const E1 = [G[0] - n[0] * 9 - d[0] * 2.6, G[1] - n[1] * 9 - d[1] * 2.6];
  const E2 = [G[0] + n[0] * 9 - d[0] * 2.6, G[1] + n[1] * 9 - d[1] * 2.6];
  const N = [G[0] - d[0] * (2.6 + pull), G[1] - d[1] * (2.6 + pull)];
  R.line(E1[0], E1[1], N[0], N[1], RC.string, 0);
  R.line(N[0], N[1], E2[0], E2[1], RC.string, 0);
  R.rect(G[0] - 1, G[1] - 1, 2, 2, RC.skin);
  if (withArrow) {
    const T = [N[0] + d[0] * 13, N[1] + d[1] * 13];
    R.line(N[0], N[1], T[0], T[1], RC.shaft, 0);
    R.px(T[0], T[1], RC.tip); R.px(T[0] + d[0], T[1] + d[1], RC.tip);
    R.px(N[0] + d[0] + n[0], N[1] + d[1] + n[1], RC.feather, 0);
    R.px(N[0] + d[0] - n[0], N[1] + d[1] - n[1], RC.fletch, 0);
  }
  return N;
}

function drawRobin(g, p, sx, sy, flash) {
  const R = Rig.reset();
  const moving = p.onGround && Math.abs(p.vx) > 15;
  const f = Math.floor(p.runPhase) % 6;
  const b = moving && (f === 1 || f === 4) ? -1 : 0;
  const by = b + (p.charging && p.onGround ? 1 : 0);
  legs(R, f, moving, !p.onGround, p.vy, RC.hose, RC.hoseD, RC.boot, RC.boot);
  // Köcher
  R.rect(-7, -21 + by, 3, 10, RC.quiver); R.rect(-7, -21 + by, 1, 10, RC.quiverD);
  R.px(-7, -23 + by, RC.fletch); R.px(-6, -24 + by, RC.feather); R.px(-5, -23 + by, RC.fletch);
  const aiming = p.charging || p.aimT > 0 || p.aimUp || p.aimDown;
  const swing = moving ? Math.round(Math.sin(p.runPhase * Math.PI / 3) * 1.5) : 0;
  if (!aiming) { R.rect(-5 - swing, -18 + by, 2, 6, RC.greenD); R.rect(-5 - swing, -12 + by, 2, 2, RC.skinS); }
  // Rock & Körper
  R.rect(-5, -11 + by, 10, 3, RC.green);
  for (let i = -5; i < 5; i += 2) R.px(i, -8 + by, RC.greenD);
  R.rect(-4, -19 + by, 8, 8, RC.green);
  R.rect(-4, -19 + by, 2, 8, RC.greenD);
  R.rect(2, -18 + by, 1, 5, RC.greenL);
  R.rect(-4, -12 + by, 8, 1, RC.belt); R.px(1, -12 + by, RC.buckle);
  R.rect(-5, -20 + by, 9, 2, RC.greenD);
  for (let i = -5; i < 4; i += 2) R.px(i, -18 + by, RC.greenD);
  // Kopf
  R.rect(-3, -26 + by, 7, 6, RC.skin);
  R.rect(-3, -26 + by, 2, 5, RC.hair);
  R.px(-1, -23 + by, RC.skinS);
  R.px(2, -24 + by, RC.eye);
  R.px(4, -23 + by, RC.skin);
  R.rect(2, -21 + by, 2, 1, RC.hair);
  // Mütze mit Feder
  R.rect(-4, -29 + by, 8, 3, RC.green);
  R.rect(-1, -30 + by, 4, 1, RC.green);
  R.rect(-5, -27 + by, 10, 1, RC.greenD);
  R.px(5, -27 + by, RC.greenD);
  R.rect(-6, -28 + by, 2, 1, RC.green);
  R.line(-3, -29 + by, -7, -33 + by, RC.feather);
  // Arme & Bogen
  if (aiming) {
    const a = p.aimUp ? -0.78 : p.aimDown ? 0.7 : 0;
    const pull = p.charging ? 1 + 5 * Math.min(1, p.charge / CHARGE_T) : 0;
    const glow = p.charging && p.charge >= CHARGE_T && Math.floor(p.animT * 12) % 2 === 0;
    const N = drawBow(R, [1, -17 + by], a, pull, p.charging, glow);
    R.line(-2, -17 + by, N[0], N[1], RC.greenD);
    R.rect(N[0] - 1, N[1], 2, 2, RC.skin);
  } else {
    R.rect(swing, -19 + by, 2, 6, RC.green);
    R.rect(swing, -13 + by, 2, 2, RC.skin);
    for (let t = -8; t <= 8; t++) R.px(swing + 2 + Math.round(2 * (1 - (t / 8) * (t / 8))), -12 + t + by, RC.bow);
    R.line(swing + 2, -20 + by, swing + 2, -4 + by, RC.string, 0);
  }
  if (p.dead) drawRigRotated(g, sx, sy, p.facing < 0, flash, p.deadRot, 14);
  else Rig.draw(g, sx, sy, p.facing < 0, flash);
}

// --- Wachen des Sheriffs ------------------------------------------------
const GC = {
  mail: '#9aa3ab', mailD: '#6f7880', steel: '#a9b1b9', steelL: '#e3e8ec', steelD: '#6c747c',
  red: '#ad2a2e', redD: '#7a1b20', black: '#2a2326', gold: '#e8b93c',
  skin: '#e9b98a', skinS: '#c08a5e', hose: '#5c5450', boot: '#3a2a1c', mustache: '#5a3518',
  wood: '#7f5229', woodD: '#553417', leather: '#7a5233', leatherD: '#5a3a22',
};

function guardBody(R, e, f, moving) {
  legs(R, f, moving, !e.onGround && !e.ko, e.vy, GC.hose, '#46403c', GC.boot, GC.boot);
  R.rect(-4, -18, 8, 8, GC.mail);
  R.rect(-3, -18, 6, 10, GC.red);
  R.rect(-3, -18, 1, 10, GC.redD);
  R.rect(-1, -16, 2, 3, GC.gold);
  R.px(-2, -15, GC.gold, 0); R.px(1, -15, GC.gold, 0);
  R.rect(-4, -12, 8, 1, GC.black);
  R.rect(-4, -11, 1, 3, GC.mail); R.rect(3, -11, 1, 3, GC.mail);
  R.rect(-3, -24, 6, 5, GC.skin);
  R.rect(-4, -24, 2, 6, GC.mail);
  R.rect(-3, -19, 6, 1, GC.mail);
  R.px(1, -22, '#1a1010');
  R.px(3, -21, GC.skin);
  R.rect(1, -20, 3, 1, GC.mustache);
}

function guardHelm(R, kind) {
  if (kind === 'kettle') {
    R.rect(-3, -27, 6, 3, GC.steel);
    R.rect(-2, -27, 3, 1, GC.steelL);
    R.rect(-6, -25, 11, 1, GC.steelD);
  } else if (kind === 'nasal') {
    R.rect(-3, -27, 6, 3, GC.steel);
    R.rect(-2, -28, 4, 1, GC.steel);
    R.px(0, -29, GC.steel);
    R.rect(-2, -27, 2, 1, GC.steelL);
    R.rect(2, -25, 1, 3, GC.steelD);
  } else {
    R.rect(-4, -27, 7, 3, GC.leather);
    R.rect(-4, -25, 8, 1, GC.leatherD);
    R.line(-3, -27, -6, -30, GC.red);
  }
}

function drawGuard(g, e, sx, sy, flash) {
  const R = Rig.reset();
  const moving = Math.abs(e.vx) > 5 && e.onGround;
  const f = Math.floor(e.anim) % 6;
  const st = e.state;
  if (e.type === 'soldier') {
    // Schwertarm hinten
    guardBody(R, e, f, moving);
    guardHelm(R, 'kettle');
    if (st === 'windup') {
      R.line(0, -17, 0, -23, GC.mail); R.rect(-1, -25, 2, 2, GC.skin);
      R.rect(-2, -26, 4, 1, GC.gold); R.line(0, -27, -5, -36, GC.steelL);
    } else if (st === 'slash') {
      R.line(1, -16, 5, -15, GC.mail); R.rect(5, -16, 2, 2, GC.skin);
      R.rect(7, -18, 1, 5, GC.gold); R.line(8, -15, 19, -15, GC.steelL); R.line(8, -16, 18, -16, GC.steel, 0);
    } else if (st === 'recover') {
      R.rect(1, -18, 2, 6, GC.mail); R.rect(1, -12, 2, 2, GC.skin);
      R.rect(2, -11, 3, 1, GC.gold); R.line(4, -10, 10, -4, GC.steelL);
    } else {
      R.rect(1, -18, 2, 5, GC.mail); R.rect(1, -13, 2, 2, GC.skin);
      R.rect(3, -15, 1, 4, GC.gold); R.line(4, -14, 11, -20, GC.steelL);
    }
  } else if (e.type === 'spear') {
    guardBody(R, e, f, moving);
    guardHelm(R, 'nasal');
    if (st === 'windup') {
      R.line(-13, -15, 8, -15, GC.wood); R.rect(9, -16, 3, 3, GC.steelL); R.px(12, -15, GC.steelL);
      R.rect(-3, -16, 2, 2, GC.skin); R.rect(3, -16, 2, 2, GC.skin);
    } else if (st === 'thrust') {
      R.line(-3, -15, 21, -15, GC.wood); R.rect(22, -16, 3, 3, GC.steelL); R.px(25, -15, GC.steelL);
      R.rect(4, -16, 2, 2, GC.skin); R.rect(10, -16, 2, 2, GC.skin);
    } else {
      R.line(4, -31, 4, -1, GC.wood); R.rect(3, -34, 3, 3, GC.steelL); R.px(4, -35, GC.steelL);
      R.rect(2, -15, 2, 2, GC.skin);
    }
  } else {
    guardBody(R, e, f, moving);
    guardHelm(R, 'cap');
    const down = st === 'reload';
    const yy = down ? -10 : -15;
    R.rect(0, yy - 1, 10, 2, GC.wood);
    R.line(9, yy - 5, 9, yy + 4, GC.woodD);
    R.line(8, yy - 4, 7, yy, GC.string || '#ddd', 0);
    R.line(8, yy + 3, 7, yy, '#ddd', 0);
    if (!down) { R.line(3, yy - 2, 11, yy - 2, '#d8b070', 0); R.px(12, yy - 2, GC.steelL); }
    R.rect(1, yy, 2, 2, GC.skin); R.rect(6, yy, 2, 2, GC.skin);
  }
  drawRigRotated(g, sx, sy, e.facing < 0, flash, e.koRot, 12);
  if (st === 'slash' && e.type === 'soldier' && !e.ko) slashArc(g, sx, sy - 15, e.facing, e.t / 0.18);
  if (e.type === 'crossbow' && st === 'aim' && Math.floor(e.t * 10) % 2 === 0) {
    g.fillStyle = '#ff4a3a'; g.fillRect(Math.round(sx + e.facing * 13), Math.round(sy - 18), 2, 2);
  }
}

function slashArc(g, sx, sy, dir, k) {
  g.globalAlpha = 0.75 * clamp(k, 0, 1);
  g.fillStyle = '#ffffff';
  for (let a = -1.1; a <= 1.1; a += 0.12) {
    const r = 16 + Math.cos(a) * 2;
    g.fillRect(Math.round(sx + dir * (4 + Math.cos(a) * r)), Math.round(sy + Math.sin(a) * r), 2, 2);
  }
  g.globalAlpha = 1;
}

const KC = { plate: '#aab1ba', plateD: '#737b85', plateL: '#e2e7ec', red: '#ad2a2e', black: '#262027', gold: '#e8b93c', plume: '#c63a3a' };

function drawKnight(g, e, sx, sy, flash) {
  const R = Rig.reset();
  const moving = Math.abs(e.vx) > 5 && e.onGround;
  const f = Math.floor(e.anim) % 6;
  legs(R, f, moving, !e.onGround && !e.ko, e.vy, KC.plate, KC.plateD, KC.plateD, KC.plateD);
  const st = e.state;
  if (st === 'windup') { R.line(-2, -22, -6, -32, GC.woodD); R.rect(-9, -37, 5, 5, KC.plateD); R.px(-10, -35, KC.plateL); R.px(-6, -38, KC.plateL); }
  R.rect(-5, -21, 10, 12, KC.plate);
  R.rect(-4, -20, 8, 12, KC.black);
  R.rect(-4, -20, 4, 6, KC.red); R.rect(0, -14, 4, 6, KC.red);
  R.rect(-4, -10, 8, 1, KC.gold);
  R.rect(-6, -22, 4, 3, KC.plateD);
  R.rect(-4, -30, 8, 8, KC.plate);
  R.rect(-4, -30, 8, 1, KC.plateL);
  R.rect(-4, -30, 1, 8, KC.plateD);
  R.rect(0, -27, 4, 1, '#101014');
  R.px(2, -25, '#101014', 0); R.px(2, -24, '#101014', 0);
  R.rect(-3, -32, 5, 2, KC.plume); R.px(-4, -31, KC.plume);
  if (st === 'swing') { R.line(3, -20, 12, -15, GC.woodD); R.rect(12, -18, 5, 5, KC.plateD); R.px(17, -16, KC.plateL); R.px(14, -19, KC.plateL); }
  if (e.stagger > 0) {
    R.rect(-11, -25, 6, 13, KC.red); R.rect(-11, -25, 6, 1, KC.gold); R.rect(-9, -20, 2, 3, KC.gold);
  } else {
    R.rect(5, -23, 6, 13, KC.red);
    R.rect(5, -23, 6, 1, KC.gold); R.rect(5, -23, 1, 13, KC.gold); R.rect(10, -23, 1, 13, KC.gold);
    R.rect(6, -10, 4, 1, KC.red); R.rect(7, -9, 2, 1, KC.red);
    R.rect(7, -19, 2, 4, KC.gold); R.px(8, -20, KC.gold); R.px(6, -17, KC.gold, 0); R.px(9, -16, KC.gold, 0);
  }
  drawRigRotated(g, sx, sy, e.facing < 0, flash, e.koRot, 14);
}

const HC = { fur: '#7a5636', furD: '#573a20', furL: '#a07a52', nose: '#1a1010', collar: '#ad2a2e', eye: '#f2d25a' };

function drawHound(g, e, sx, sy, flash) {
  const R = Rig.reset();
  const run = Math.abs(e.vx) > 20;
  const ph = e.anim * (run ? 2 : 0.6);
  const l = (k) => (run ? Math.round(Math.sin(ph * Math.PI / 3 + k) * 2) : 0);
  const lift = (k) => (run ? Math.max(0, Math.round(Math.cos(ph * Math.PI / 3 + k) * 2)) : 0);
  R.rect(-7 + l(0), -5 - lift(0), 2, 5, HC.furD);
  R.rect(4 + l(1.6), -5 - lift(1.6), 2, 5, HC.furD);
  R.line(-8, -9, -12, -13 + (run ? 0 : Math.round(Math.sin(e.anim * 2))), HC.fur);
  R.rect(-8, -11, 15, 6, HC.fur);
  R.rect(-8, -11, 15, 2, HC.furD);
  R.rect(-6, -5, 11, 1, HC.furL);
  const hy = run ? -1 : 0;
  R.rect(5, -14 + hy, 6, 6, HC.fur);
  R.rect(10, -12 + hy, 4, 3, HC.fur);
  R.px(13, -12 + hy, HC.nose);
  R.rect(5, -16 + hy, 2, 3, HC.furD);
  R.px(9, -13 + hy, HC.eye);
  if (e.state === 'bark' || run) R.rect(10, -9 + hy, 4, 1, '#6a1a1a');
  R.rect(5, -10, 2, 3, HC.collar);
  R.rect(-6 + l(3.1), -5 - lift(3.1), 2, 5, HC.fur);
  R.rect(6 + l(4.7), -5 - lift(4.7), 2, 5, HC.fur);
  drawRigRotated(g, sx, sy, e.facing < 0, flash, e.koRot, 8);
}

const PEASANT = [
  { tunic: '#8a6a4a', tunicD: '#6a4e34', hair: '#5a3a20', hat: 'straw', skirt: false },
  { tunic: '#6c7a96', tunicD: '#535f78', hair: '#7a4a2a', hat: 'scarf', skirt: true },
  { tunic: '#c2aa82', tunicD: '#9e8866', hair: '#dedede', hat: 'bald', skirt: false },
  { tunic: '#9a5446', tunicD: '#7a4034', hair: '#3a2416', hat: 'bun', skirt: true },
];

function drawPeasant(g, n, sx, sy) {
  const R = Rig.reset();
  const P = PEASANT[n.variant % PEASANT.length];
  const bob = Math.round(Math.sin(n.anim * 2) * 0.6);
  if (P.skirt) {
    R.rect(-5, -14, 10, 13, P.tunic); R.rect(-5, -14, 2, 13, P.tunicD);
    R.rect(-3, -1, 2, 1, '#3a2a1c'); R.rect(1, -1, 2, 1, '#3a2a1c');
  } else {
    R.rect(-3, -6, 2, 5, '#5a4a3a'); R.rect(1, -6, 2, 5, '#5a4a3a');
    R.rect(-3, -2, 3, 2, '#3a2a1c'); R.rect(1, -2, 3, 2, '#3a2a1c');
    R.rect(-4, -13, 8, 7, P.tunic);
  }
  R.rect(-4, -18 + bob, 8, 7, P.tunic);
  R.rect(-4, -18 + bob, 2, 7, P.tunicD);
  R.rect(-4, -12 + bob, 8, 1, '#a08050');
  R.rect(-3, -24 + bob, 6, 6, '#e6b48a');
  R.px(1, -22 + bob, '#2a1a10');
  R.px(3, -21 + bob, '#e6b48a');
  if (n.happy > 0) R.rect(0, -19 + bob, 3, 1, '#8a3a2a', 0);
  if (P.hat === 'straw') { R.rect(-6, -25 + bob, 12, 1, '#d9b866'); R.rect(-3, -27 + bob, 6, 2, '#d9b866'); R.rect(-3, -25 + bob, 6, 1, '#a8853c', 0); }
  else if (P.hat === 'scarf') { R.rect(-4, -26 + bob, 7, 3, '#ece4d4'); R.rect(-5, -24 + bob, 2, 6, '#ece4d4'); }
  else if (P.hat === 'bald') { R.rect(-3, -25 + bob, 6, 1, '#e6b48a'); R.rect(-4, -23 + bob, 1, 3, P.hair); R.rect(0, -19 + bob, 4, 3, P.hair); }
  else { R.rect(-4, -26 + bob, 7, 2, P.hair); R.rect(-6, -26 + bob, 3, 3, P.hair); R.rect(-4, -24 + bob, 1, 4, P.hair); }
  const arm = n.happy > 0 ? -6 : 0;
  R.rect(1, -17 + bob + arm, 2, 5, P.tunicD);
  R.rect(1, -12 + bob + arm, 2, 2, '#e6b48a');
  Rig.draw(g, sx, sy, n.facing < 0);
}

const GBC = { leather: '#2c2b33', leatherL: '#4a4854', stud: '#b5bcc6', hair: '#17110e', skin: '#e1ad86', cape: '#4a1c26', capeL: '#6a2a36', steel: '#e3e8ec', gold: '#e8b93c' };

function drawGisborne(g, e, sx, sy, flash) {
  const R = Rig.reset();
  const st = e.state;
  const moving = Math.abs(e.vx) > 5 && e.onGround;
  const f = Math.floor(e.anim) % 6;
  const lean = st === 'dash' ? 2 : st === 'dashprep' ? -1 : 0;
  R.rect(-8 - (moving || st === 'dash' ? 2 : 0), -22, 4, 17, GBC.cape);
  R.rect(-8 - (moving || st === 'dash' ? 2 : 0), -22, 1, 17, GBC.capeL);
  legs(R, f, moving || st === 'dash', !e.onGround, e.vy, '#24232a', '#1a191f', '#121115', '#121115');
  R.rect(-5 + lean, -21, 10, 11, GBC.leather);
  R.rect(-5 + lean, -21, 2, 11, GBC.leatherL);
  for (let yy = -19; yy < -11; yy += 3) for (let xx = -3; xx < 4; xx += 3) R.px(xx + lean, yy, GBC.stud, 0);
  R.rect(-5 + lean, -12, 10, 1, '#5a3a22'); R.px(lean, -12, GBC.gold);
  R.rect(-5 + lean, -11, 10, 3, GBC.leather);
  R.rect(-3 + lean, -28, 7, 6, GBC.skin);
  R.rect(-4 + lean, -30, 7, 3, GBC.hair);
  R.rect(-5 + lean, -28, 3, 9, GBC.hair);
  R.px(2 + lean, -26, '#1a1010');
  R.rect(1 + lean, -27, 3, 1, GBC.hair);
  R.px(4 + lean, -25, GBC.skin);
  R.rect(1 + lean, -23, 3, 1, '#7a6a60', 0);
  const L = lean;
  if (st === 'windup' || st === 'leap' || st === 'leapprep') {
    R.line(1 + L, -19, 1 + L, -26, GBC.leather); R.rect(0 + L, -28, 2, 2, GBC.skin);
    R.rect(-1 + L, -29, 4, 1, GBC.gold); R.line(1 + L, -30, -5 + L, -42, GBC.steel);
  } else if (st === 'slash') {
    R.line(2 + L, -18, 6 + L, -17, GBC.leather); R.rect(6 + L, -18, 2, 2, GBC.skin);
    R.rect(8 + L, -20, 1, 5, GBC.gold); R.line(9 + L, -17, 23 + L, -17, GBC.steel);
  } else if (st === 'dash') {
    R.line(2 + L, -17, 7 + L, -16, GBC.leather); R.rect(7 + L, -17, 2, 2, GBC.skin);
    R.rect(9 + L, -19, 1, 5, GBC.gold); R.line(10 + L, -16, 22 + L, -16, GBC.steel);
  } else if (st === 'stunned') {
    R.rect(2, -19, 2, 7, GBC.leather); R.rect(2, -12, 2, 2, GBC.skin);
    R.line(4, -10, 12, -1, GBC.steel);
  } else {
    R.rect(2 + L, -19, 2, 6, GBC.leather); R.rect(2 + L, -13, 2, 2, GBC.skin);
    R.rect(4 + L, -16, 1, 5, GBC.gold); R.line(5 + L, -14, 15 + L, -22, GBC.steel);
  }
  drawRigRotated(g, sx, sy, e.facing < 0, flash, e.koRot, 15);
  if (st === 'slash' && !e.ko) slashArc(g, sx, sy - 17, e.facing, e.t / 0.2);
}

const SC = { robe: '#6e1a2b', robeD: '#4c1120', robeL: '#93304a', black: '#1d1a1f', fur: '#4a3426', furL: '#6a4c36', gold: '#f0c24a', skin: '#ecc49c', beard: '#17110e' };

function drawSheriff(g, e, sx, sy, flash) {
  const R = Rig.reset();
  const st = e.state;
  const moving = Math.abs(e.vx) > 5 && e.onGround;
  const f = Math.floor(e.anim) % 6;
  R.rect(-8, -22, 4, 20, SC.black);
  R.rect(-8, -22, 1, 20, '#3a2a3a');
  legs(R, f, moving, !e.onGround, e.vy, SC.black, SC.black, SC.black, SC.black);
  R.rect(-5, -21, 10, 16, SC.robe);
  R.rect(-5, -21, 2, 16, SC.robeD);
  R.rect(3, -20, 1, 14, SC.robeL);
  R.rect(-5, -6, 10, 2, SC.black);
  R.rect(0, -20, 1, 14, SC.black);
  R.rect(-5, -12, 10, 1, SC.gold);
  R.rect(-6, -22, 12, 2, SC.fur); R.rect(-6, -22, 12, 1, SC.furL);
  for (let k = 0; k < 4; k++) { R.px(-3 + k, -19 + k, SC.gold, 0); R.px(3 - k, -19 + k, SC.gold, 0); }
  R.rect(-1, -15, 3, 2, SC.gold);
  R.rect(-3, -28, 7, 6, SC.skin);
  R.rect(-3, -28, 1, 6, '#c9a07a');
  R.px(2, -26, '#1a1010');
  R.rect(1, -27, 3, 1, SC.beard);
  R.px(4, -25, SC.skin);
  R.rect(1, -24, 4, 1, SC.beard);
  R.rect(1, -23, 3, 2, SC.beard); R.px(2, -21, SC.beard);
  R.rect(-4, -33, 8, 5, SC.black);
  R.rect(-6, -29, 12, 1, SC.black);
  R.rect(-4, -30, 8, 1, SC.gold);
  R.line(-3, -32, -7, -37, '#c63a3a');
  if (st === 'throwprep' || st === 'rainprep') {
    R.line(0, -18, -3, -24, SC.robe); R.rect(-4, -26, 2, 2, SC.skin);
    R.line(-4, -27, -6, -31, GC.steelL);
  } else if (st === 'throw' || st === 'rain') {
    R.line(1, -18, 7, -19, SC.robe); R.rect(7, -20, 2, 2, SC.skin);
  } else {
    R.rect(2, -19, 2, 6, SC.robe); R.rect(2, -13, 2, 2, SC.skin);
    R.rect(4, -13, 1, 1, SC.gold); R.line(5, -13, 9, -13, GC.steelL);
  }
  drawRigRotated(g, sx, sy, e.facing < 0, flash, e.koRot, 15);
}

// ---------------------------------------------------------------------
//  Gegenstände & Requisiten
// ---------------------------------------------------------------------
function drawCoinAt(g, sx, sy, t, big) {
  const f = Math.floor(t * 8) % 4;
  const w = [6, 4, 2, 4][f];
  sx = Math.round(sx); sy = Math.round(sy);
  const x = sx - (w >> 1);
  fr(g, OUTLINE, x - 1, sy - 4, w + 2, 9);
  fr(g, OUTLINE, x, sy - 5, w, 11);
  fr(g, '#d99a1e', x, sy - 4, w, 9);
  fr(g, '#f6c945', x, sy - 4, Math.max(1, w - 1), 8);
  if (w > 2) { fr(g, '#fff3a8', x + 1, sy - 3, 1, 3); fr(g, '#d99a1e', x + (w >> 1), sy - 2, 1, 4); }
}

function drawBag(g, sx, sy, t) {
  sx = Math.round(sx); sy = Math.round(sy + Math.sin(t * 3) * 1);
  fr(g, OUTLINE, sx - 6, sy - 7, 12, 10); fr(g, OUTLINE, sx - 3, sy - 10, 6, 4);
  fr(g, '#8a5a2b', sx - 5, sy - 6, 10, 8);
  fr(g, '#a8763c', sx - 5, sy - 6, 3, 6);
  fr(g, '#6a4220', sx - 5, sy + 1, 10, 1);
  fr(g, '#8a5a2b', sx - 2, sy - 9, 4, 3);
  fr(g, '#d4402f', sx - 3, sy - 7, 6, 1);
  fr(g, '#f6c945', sx - 1, sy - 4, 3, 3); fr(g, '#fff3a8', sx - 1, sy - 4, 1, 1);
  if (Math.floor(t * 4) % 3 === 0) { fr(g, '#fffbe0', sx + 4, sy - 11, 1, 3); fr(g, '#fffbe0', sx + 3, sy - 10, 3, 1); }
}

const HEART_MAP = ['.##.##.', '#######', '#######', '.#####.', '..###..', '...#...'];

function drawHeartIcon(g, x, y, full, half) {
  x = Math.round(x); y = Math.round(y);
  for (let j = 0; j < HEART_MAP.length; j++) for (let i = 0; i < 7; i++) {
    if (HEART_MAP[j][i] !== '#') continue;
    fr(g, OUTLINE, x + i - 1, y + j - 1, 3, 3);
  }
  for (let j = 0; j < HEART_MAP.length; j++) for (let i = 0; i < 7; i++) {
    if (HEART_MAP[j][i] !== '#') continue;
    let c = full ? '#e0303a' : '#4a2a2a';
    if (full && (j === 1 && (i === 1 || i === 2))) c = '#ff9a9a';
    if (full && j >= 3) c = '#b81f2a';
    fr(g, c, x + i, y + j, 1, 1);
  }
}

function drawQuiverPickup(g, sx, sy, t) {
  sx = Math.round(sx); sy = Math.round(sy + Math.sin(t * 3) * 1.5);
  g.globalAlpha = 0.35 + 0.2 * Math.sin(t * 6); g.fillStyle = '#ffe48a'; disc(g, sx, sy - 5, 9); g.globalAlpha = 1;
  fr(g, OUTLINE, sx - 3, sy - 8, 6, 11);
  fr(g, '#8b5a2b', sx - 2, sy - 7, 4, 9); fr(g, '#5e3b19', sx - 2, sy - 7, 1, 9);
  for (let k = -1; k <= 1; k++) {
    fr(g, OUTLINE, sx + k * 2 - 1, sy - 13, 3, 6);
    fr(g, '#d8b070', sx + k * 2, sy - 12, 1, 5);
    fr(g, '#ffd76a', sx + k * 2, sy - 13, 1, 2);
  }
}

function drawCheckpoint(g, c, sx, sy, t) {
  sx = Math.round(sx); sy = Math.round(sy);
  fr(g, OUTLINE, sx - 5, sy - 3, 10, 3); fr(g, '#8b8478', sx - 4, sy - 2, 8, 2);
  fr(g, OUTLINE, sx - 2, sy - 34, 3, 32); fr(g, '#7a5232', sx - 1, sy - 33, 1, 31);
  fr(g, OUTLINE, sx - 2, sy - 37, 4, 4); fr(g, '#f0c24a', sx - 1, sy - 36, 2, 2);
  if (c.active) {
    const rise = Math.min(1, c.rise);
    const top = Math.round(sy - 33 + (1 - rise) * 18);
    for (let i = 0; i < 14; i++) {
      const yo = Math.round(Math.sin(t * 6 - i * 0.55) * (i / 14) * 2);
      fr(g, OUTLINE, sx + 1 + i, top + yo - 1, 1, 12);
      fr(g, i < 2 ? '#2b6a2f' : '#3f9140', sx + 1 + i, top + yo, 1, 10);
      if (i > 3 && i < 11) {
        if (i === 7) fr(g, '#f0c24a', sx + 1 + i, top + yo + 2, 1, 6);
        if (i === 6 || i === 8) fr(g, '#f0c24a', sx + 1 + i, top + yo + 3, 1, 1);
        if (i === 5 || i === 9) fr(g, '#f0c24a', sx + 1 + i, top + yo + 4, 1, 1);
      }
    }
  } else {
    fr(g, OUTLINE, sx + 1, sy - 32, 5, 14);
    fr(g, '#7d746a', sx + 1, sy - 31, 4, 12);
    fr(g, '#5f574e', sx + 1, sy - 31, 1, 12);
  }
}

function drawSignPost(g, sx, sy, near) {
  sx = Math.round(sx); sy = Math.round(sy);
  fr(g, OUTLINE, sx - 2, sy - 14, 4, 14); fr(g, '#6e4521', sx - 1, sy - 13, 2, 13);
  fr(g, OUTLINE, sx - 8, sy - 22, 16, 11);
  fr(g, near ? '#c9935a' : '#a8743f', sx - 7, sy - 21, 14, 9);
  fr(g, '#d8a868', sx - 7, sy - 21, 14, 1);
  fr(g, '#5a3418', sx - 5, sy - 18, 8, 1); fr(g, '#5a3418', sx - 5, sy - 16, 10, 1); fr(g, '#5a3418', sx - 5, sy - 14, 6, 1);
  if (near) { fr(g, '#fff3c0', sx + 7, sy - 26, 1, 3); }
}

function drawExitFlag(g, sx, sy, t) {
  sx = Math.round(sx); sy = Math.round(sy);
  g.globalAlpha = 0.25 + 0.15 * Math.sin(t * 4); g.fillStyle = '#fff1a0'; disc(g, sx + 8, sy - 30, 20); g.globalAlpha = 1;
  fr(g, OUTLINE, sx - 6, sy - 4, 12, 4); fr(g, '#8b8478', sx - 5, sy - 3, 10, 3);
  fr(g, OUTLINE, sx - 2, sy - 50, 3, 47); fr(g, '#8a5a32', sx - 1, sy - 49, 1, 46);
  fr(g, OUTLINE, sx - 3, sy - 54, 5, 5); fr(g, '#f0c24a', sx - 2, sy - 53, 3, 3);
  for (let i = 0; i < 22; i++) {
    const yo = Math.round(Math.sin(t * 5 - i * 0.45) * (i / 22) * 3);
    fr(g, OUTLINE, sx + 1 + i, sy - 50 + yo, 1, 18);
    fr(g, i % 7 === 0 ? '#2b6a2f' : '#3f9140', sx + 1 + i, sy - 49 + yo, 1, 16);
    fr(g, '#f0c24a', sx + 1 + i, sy - 49 + yo, 1, 1);
    fr(g, '#f0c24a', sx + 1 + i, sy - 34 + yo, 1, 1);
    if (i >= 5 && i <= 17) fr(g, '#f6e7c0', sx + 1 + i, sy - 42 + yo, 1, 1);
    if (i === 16 || i === 15) { fr(g, '#d6402f', sx + 1 + i, sy - 44 + yo, 1, 1); fr(g, '#d6402f', sx + 1 + i, sy - 40 + yo, 1, 1); }
    if (i === 17) fr(g, '#d6402f', sx + 1 + i, sy - 43 + yo, 1, 3);
  }
}

function drawSpring(g, theme, sx, sy, squash) {
  sx = Math.round(sx); sy = Math.round(sy);
  const s = Math.round(squash * 4);
  if (THEMES[theme].spring === 'mushroom') {
    fr(g, OUTLINE, sx - 3, sy - 7, 6, 7); fr(g, '#efe0c8', sx - 2, sy - 6, 4, 6);
    const top = sy - 14 + s;
    fr(g, OUTLINE, sx - 9, top - 1, 18, 8 - Math.floor(s / 2)); fr(g, OUTLINE, sx - 6, top - 3, 12, 3);
    fr(g, '#d23a2e', sx - 8, top, 16, 6 - Math.floor(s / 2)); fr(g, '#d23a2e', sx - 5, top - 2, 10, 2);
    fr(g, '#ff6a5a', sx - 5, top - 2, 4, 1);
    fr(g, '#ffffff', sx - 5, top, 2, 2); fr(g, '#ffffff', sx + 2, top - 1, 2, 2); fr(g, '#ffffff', sx + 5, top + 2, 2, 1); fr(g, '#ffffff', sx - 1, top + 3, 2, 1);
  } else {
    const top = sy - 11 + s;
    fr(g, OUTLINE, sx - 9, top + 2, 18, sy - top - 2); fr(g, OUTLINE, sx - 6, top - 1, 12, 4);
    fr(g, '#d6b04c', sx - 8, top + 3, 16, sy - top - 3); fr(g, '#d6b04c', sx - 5, top, 10, 3);
    fr(g, '#f0d47a', sx - 5, top, 6, 1);
    for (let k = 0; k < 8; k++) fr(g, '#a8823a', sx - 7 + ((k * 5) % 14), top + 3 + ((k * 3) % Math.max(1, sy - top - 4)), 1, 2);
    fr(g, '#f0d47a', sx - 9, top + 4, 1, 1); fr(g, '#f0d47a', sx + 9, top + 6, 1, 1);
  }
}

function drawTarget(g, o, sx, sy, camY) {
  sx = Math.round(sx); sy = Math.round(sy);
  const ground = o.groundY !== null ? Math.round(o.groundY - camY) : sy + 8;
  fr(g, OUTLINE, sx - 2, sy, 3, ground - sy); fr(g, '#6e4521', sx - 1, sy, 1, ground - sy);
  const sc = o.hit ? Math.abs(Math.cos(o.spin * 8)) : 1;
  const r = 7;
  const ring = (rr, c) => { g.fillStyle = c; for (let dy = -rr; dy <= rr; dy++) { const w = Math.floor(Math.sqrt(rr * rr - dy * dy) * sc); g.fillRect(sx - w, sy + dy, w * 2 + 1, 1); } };
  ring(r + 1, OUTLINE);
  ring(r, o.hit ? '#a89e8c' : '#f2ecdc');
  ring(r - 2, o.hit ? '#7d746a' : '#c8343a');
  ring(r - 4, o.hit ? '#a89e8c' : '#f2ecdc');
  ring(r - 6, o.hit ? '#7d746a' : '#f0c24a');
}

function drawTorch(g, sx, sy, t, seed, onWall) {
  sx = Math.round(sx); sy = Math.round(sy);
  if (!onWall) { fr(g, OUTLINE, sx - 2, sy - 14, 4, 14); fr(g, '#4a3220', sx - 1, sy - 13, 2, 13); }
  fr(g, OUTLINE, sx - 3, sy - 20, 6, 7); fr(g, '#3a3d45', sx - 2, sy - 19, 4, 5);
  const fl = Math.sin(t * 13 + seed) + Math.sin(t * 7.3 + seed * 2);
  const h = 6 + Math.round(fl);
  fr(g, '#e2581e', sx - 2, sy - 20 - h + 2, 4, h);
  fr(g, '#ffa63a', sx - 1, sy - 20 - h + 3, 2, h - 2);
  fr(g, '#fff0a0', sx - 1, sy - 21, 1, 2);
  if (fl > 1) fr(g, '#ffa63a', sx + 1, sy - 22 - h, 1, 1);
}

function drawPlatform(g, theme, p, sx, sy, t) {
  sx = Math.round(sx); sy = Math.round(sy);
  const W = p.w;
  if (p.vertical) {
    g.fillStyle = '#5a5e66';
    for (let y = sy - 4; y > -10; y -= 4) { g.fillRect(sx + 4, y, 2, 3); g.fillRect(sx + W - 6, y, 2, 3); }
  }
  if (theme === 'forest') {
    fr(g, OUTLINE, sx, sy - 1, W, 9);
    fr(g, '#7a4d26', sx + 1, sy, W - 2, 7);
    fr(g, '#9c6a38', sx + 1, sy, W - 2, 2);
    fr(g, '#5a3618', sx + 1, sy + 6, W - 2, 1);
    for (let i = 6; i < W - 6; i += 9) fr(g, '#5a3618', sx + i, sy + 3, 4, 1);
    fr(g, '#c49a62', sx + 1, sy + 1, 3, 5); fr(g, '#8a5a2b', sx + 2, sy + 3, 1, 1);
    fr(g, '#c49a62', sx + W - 4, sy + 1, 3, 5); fr(g, '#8a5a2b', sx + W - 3, sy + 3, 1, 1);
  } else if (theme === 'castle' || theme === 'city') {
    fr(g, OUTLINE, sx, sy - 1, W, 9);
    fr(g, '#525a74', sx + 1, sy, W - 2, 7);
    fr(g, '#737c9c', sx + 1, sy, W - 2, 1);
    for (let i = 12; i < W - 2; i += 16) fr(g, '#2a2e3e', sx + i, sy + 1, 1, 6);
    fr(g, '#2a2e3e', sx + 1, sy + 6, W - 2, 1);
  } else {
    fr(g, OUTLINE, sx, sy - 1, W, 8);
    fr(g, '#7c5028', sx + 1, sy, W - 2, 6);
    fr(g, '#a06b36', sx + 1, sy, W - 2, 1);
    for (let i = 8; i < W; i += 8) fr(g, '#4a2c14', sx + i, sy, 1, 6);
  }
}

function drawRobinHead(g, x, y) {
  x = Math.round(x); y = Math.round(y);
  const R = Rig.reset();
  R.rect(-3, 3, 7, 6, RC.skin); R.rect(-3, 3, 2, 5, RC.hair); R.px(2, 5, RC.eye); R.rect(2, 8, 2, 1, RC.hair);
  R.rect(-4, 0, 8, 3, RC.green); R.rect(-1, -1, 4, 1, RC.green); R.rect(-5, 2, 10, 1, RC.greenD); R.rect(-6, 1, 2, 1, RC.green);
  R.line(-3, 0, -6, -3, RC.feather);
  Rig.draw(g, x, y, false);
}

// ---------------------------------------------------------------------
//  Text
// ---------------------------------------------------------------------
function txt(g, s, x, y, o) {
  o = o || {};
  const size = o.size || 8;
  g.font = `${o.weight || 400} ${size}px ${o.font || FONT_BODY}`;
  g.textAlign = o.align || 'left';
  g.textBaseline = o.base || 'top';
  if (o.outline) {
    g.fillStyle = o.outline;
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [1, 1], [-1, 1], [1, -1], [-1, -1]]) g.fillText(s, x + dx, y + dy);
  } else if (o.shadow !== false) {
    g.fillStyle = o.shadowColor || 'rgba(0,0,0,0.55)';
    g.fillText(s, x + 1, y + 1);
  }
  g.fillStyle = o.color || '#ffffff';
  g.fillText(s, x, y);
}

function wrapText(g, s, maxW, size, font) {
  g.font = `400 ${size}px ${font || FONT_BODY}`;
  const words = s.split(' ');
  const lines = [];
  let cur = '';
  for (const w of words) {
    const test = cur ? cur + ' ' + w : w;
    if (g.measureText(test).width > maxW && cur) { lines.push(cur); cur = w; } else cur = test;
  }
  if (cur) lines.push(cur);
  return lines;
}

function panel(g, x, y, w, h, kind) {
  x = Math.round(x); y = Math.round(y); w = Math.round(w); h = Math.round(h);
  if (kind === 'parchment') {
    fr(g, OUTLINE, x - 1, y, w + 2, h); fr(g, OUTLINE, x, y - 1, w, h + 2);
    fr(g, '#e9d6a8', x, y, w, h);
    fr(g, '#f6e8c4', x, y, w, 2);
    fr(g, '#c9ae7a', x, y + h - 2, w, 2);
    fr(g, '#d6bf8e', x, y, 2, h); fr(g, '#d6bf8e', x + w - 2, y, 2, h);
  } else {
    g.globalAlpha = 0.82; fr(g, '#120d0a', x, y, w, h); g.globalAlpha = 1;
    fr(g, '#6b4a2a', x, y, w, 1); fr(g, '#6b4a2a', x, y + h - 1, w, 1);
    fr(g, '#6b4a2a', x, y, 1, h); fr(g, '#6b4a2a', x + w - 1, y, 1, h);
    fr(g, '#f0c24a', x + 2, y + 2, 2, 2); fr(g, '#f0c24a', x + w - 4, y + 2, 2, 2);
    fr(g, '#f0c24a', x + 2, y + h - 4, 2, 2); fr(g, '#f0c24a', x + w - 4, y + h - 4, 2, 2);
  }
}
