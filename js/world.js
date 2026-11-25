'use strict';
// =====================================================================
//  world.js · Levelraster, Kachelcodes, Kollision
// =====================================================================

const T_EMPTY = 0, T_SOLID = 1, T_ONEWAY = 2, T_CRUMBLE = 3, T_SPIKE = 4, T_WATER = 5, T_CRATE = 6, T_DOOR = 7;

const TILE_CODE = {
  '#': T_SOLID, B: T_SOLID, W: T_SOLID,
  R: T_ONEWAY, '=': T_ONEWAY,
  '-': T_CRUMBLE, '^': T_SPIKE, '~': T_WATER, X: T_CRATE, D: T_DOOR,
};
const BG_CHARS = 'wudYyf:';
const ENTITY_CHARS = 'PCEio$vqOTtmMnFspxkhGSA';

class Level {
  constructor(def, index) {
    this.def = def;
    this.index = index;
    this.theme = def.theme;
    const rows = buildLevelRows(def);
    this.h = rows.length;
    this.w = rows[0].length;
    this.pw = this.w * TILE;
    this.ph = this.h * TILE;
    this.chars = rows.map((r) => r.split(''));
    this.code = new Uint8Array(this.w * this.h);
    this.spawns = [];
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        const ch = this.chars[y][x];
        if (ENTITY_CHARS.includes(ch)) {
          this.spawns.push({ ch, cx: x, cy: y });
          this.chars[y][x] = this.fillFor(x, y);
        }
      }
    }
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        const c = TILE_CODE[this.chars[y][x]];
        this.code[y * this.w + x] = c || T_EMPTY;
      }
    }
    this.crumbles = new Map(); // Index -> {t, broken, back}
  }

  // Was liegt "hinter" einem Objekt? (damit Kulissen keine Löcher bekommen)
  fillFor(x, y) {
    const norm = (c) => (c === 'u' || c === 'd' ? 'w' : c);
    const l = norm(this.chars[y][x - 1] || '.');
    const r = norm(this.chars[y][x + 1] || '.');
    if (BG_CHARS.includes(l) && l !== 'f') return l;
    if (BG_CHARS.includes(r) && r !== 'f') return r;
    return '.';
  }

  ch(x, y) {
    if (x < 0 || x >= this.w || y < 0 || y >= this.h) return '.';
    return this.chars[y][x];
  }

  get(x, y) {
    if (x < 0 || x >= this.w) return T_SOLID;
    if (y < 0 || y >= this.h) return T_EMPTY;
    return this.code[y * this.w + x];
  }

  set(x, y, v) {
    if (x < 0 || x >= this.w || y < 0 || y >= this.h) return;
    this.code[y * this.w + x] = v;
  }

  isSolid(x, y) {
    const c = this.get(x, y);
    return c === T_SOLID || c === T_CRATE || c === T_DOOR;
  }

  isPlatform(x, y) {
    const c = this.get(x, y);
    return c === T_ONEWAY || c === T_CRUMBLE;
  }

  isGround(x, y) {
    const c = this.get(x, y);
    return c === T_SOLID || c === T_CRATE || c === T_DOOR || c === T_ONEWAY || c === T_CRUMBLE;
  }

  // Bodenhöhe (Pixel) unter Spalte cx ab Zeile cy suchen
  groundBelow(cx, cy) {
    for (let y = Math.max(0, cy); y < this.h; y++) if (this.isGround(cx, y)) return y * TILE;
    return null;
  }

  touchCrumble(cx, cy) {
    const i = cy * this.w + cx;
    if (this.code[i] !== T_CRUMBLE) return;
    if (!this.crumbles.has(i)) this.crumbles.set(i, { cx, cy, t: 0, broken: false, back: 0 });
  }

  updateCrumbles(dt, game) {
    for (const [i, c] of this.crumbles) {
      if (!c.broken) {
        c.t += dt;
        if (c.t > 0.42) {
          c.broken = true;
          c.back = 3.2;
          this.code[i] = T_EMPTY;
          game.crumbleFx(c.cx, c.cy);
        }
      } else {
        c.back -= dt;
        if (c.back <= 0) {
          const p = game.player;
          const box = { x: c.cx * TILE, y: c.cy * TILE - 2, w: TILE, h: TILE };
          if (p && overlap(p, box)) { c.back = 0.3; continue; }
          this.code[i] = T_CRUMBLE;
          this.crumbles.delete(i);
          game.respawnFx(c.cx, c.cy);
        }
      }
    }
  }
}

// ---------------------------------------------------------------------
//  Bewegung mit Kachelkollision (achsenweise)
//  e braucht: x, y, w, h, vx, vy
// ---------------------------------------------------------------------
function moveX(e, dx, lv, bounds) {
  e.hitWall = false;
  if (!dx) return;
  e.x += dx;
  const top = Math.floor(e.y / TILE);
  const bot = Math.floor((e.y + e.h - 0.01) / TILE);
  if (dx > 0) {
    const cx = Math.floor((e.x + e.w - 0.01) / TILE);
    for (let cy = top; cy <= bot; cy++) {
      if (lv.isSolid(cx, cy)) { e.x = cx * TILE - e.w; e.vx = 0; e.hitWall = true; break; }
    }
  } else {
    const cx = Math.floor(e.x / TILE);
    for (let cy = top; cy <= bot; cy++) {
      if (lv.isSolid(cx, cy)) { e.x = (cx + 1) * TILE; e.vx = 0; e.hitWall = true; break; }
    }
  }
  if (bounds) {
    if (e.x < bounds.x0) { e.x = bounds.x0; e.vx = 0; e.hitWall = true; }
    if (e.x + e.w > bounds.x1) { e.x = bounds.x1 - e.w; e.vx = 0; e.hitWall = true; }
  }
}

function moveY(e, dy, lv, dropThrough, platforms) {
  const prevBottom = e.y + e.h;
  e.onGround = false;
  e.groundCode = T_EMPTY;
  e.hitHead = false;
  e.y += dy;
  const left = Math.floor((e.x + 0.5) / TILE);
  const right = Math.floor((e.x + e.w - 0.5) / TILE);
  if (dy > 0) {
    const cy = Math.floor((e.y + e.h - 0.01) / TILE);
    for (let cx = left; cx <= right; cx++) {
      const c = lv.get(cx, cy);
      const solid = c === T_SOLID || c === T_CRATE || c === T_DOOR;
      const plat = (c === T_ONEWAY || c === T_CRUMBLE) && !dropThrough && prevBottom <= cy * TILE + 0.5;
      if (solid || plat) {
        e.y = cy * TILE - e.h;
        e.vy = 0;
        e.onGround = true;
        e.groundCode = c;
        e.groundCx = cx;
        e.groundCy = cy;
        if (c === T_CRUMBLE) lv.touchCrumble(cx, cy);
        break;
      }
    }
  } else if (dy < 0) {
    const cy = Math.floor(e.y / TILE);
    for (let cx = left; cx <= right; cx++) {
      if (lv.isSolid(cx, cy)) { e.y = (cy + 1) * TILE; e.vy = 0; e.hitHead = true; break; }
    }
  }
  e.platform = null;
  if (platforms && dy >= 0 && !e.onGround && !dropThrough) {
    for (const p of platforms) {
      if (e.x + e.w <= p.x + 1 || e.x >= p.x + p.w - 1) continue;
      const tol = 0.5 + Math.max(0, -p.dy) + Math.max(0, p.dy);
      if (prevBottom <= p.y + tol && e.y + e.h >= p.y) {
        e.y = p.y - e.h;
        e.vy = 0;
        e.onGround = true;
        e.platform = p;
        break;
      }
    }
  }
}

// Steht die Figur am Rand? (für Patrouillen)
function groundAhead(e, lv, dir) {
  const fx = dir > 0 ? e.x + e.w + 2 : e.x - 2;
  const cx = Math.floor(fx / TILE);
  const cy = Math.floor((e.y + e.h + 2) / TILE);
  return lv.isGround(cx, cy);
}

function wallAhead(e, lv, dir) {
  const fx = dir > 0 ? e.x + e.w + 1 : e.x - 1;
  const cx = Math.floor(fx / TILE);
  const cy = Math.floor((e.y + e.h - 4) / TILE);
  const cy2 = Math.floor((e.y + 2) / TILE);
  return lv.isSolid(cx, cy) || lv.isSolid(cx, cy2);
}

if (typeof module !== 'undefined') module.exports = { Level, T_EMPTY, T_SOLID, T_ONEWAY, T_CRUMBLE, T_SPIKE, T_WATER, T_CRATE, T_DOOR };
