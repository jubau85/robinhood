'use strict';
// =====================================================================
//  entities.js · Robin, Pfeile, Geschosse, Schätze, Requisiten
// =====================================================================

const CHARGE_T = 0.55;
const PHYS = {
  run: 140, accG: 1150, decG: 1400, accA: 850, decA: 450,
  grav: 1500, gravFall: 1900, jumpV: 455, maxFall: 480,
  coyote: 0.09, buffer: 0.12, cut: 0.45, spring: 770,
};

class Player {
  constructor(fx, fy) {
    this.w = 10; this.h = 24;
    this.x = fx - this.w / 2; this.y = fy - this.h;
    this.vx = 0; this.vy = 0; this.facing = 1;
    this.onGround = false; this.platform = null; this.groundCode = 0;
    this.hp = 3; this.maxHp = 3;
    this.inv = 0; this.hurtT = 0;
    this.coyote = 0; this.jbuf = 0; this.jumping = false; this.dropT = 0;
    this.charging = false; this.charge = 0; this.chargedSfx = false;
    this.cool = 0; this.aimT = 0; this.aimUp = false;
    this.triple = 0;
    this.animT = 0; this.runPhase = 0; this.stepT = 0;
    this.dead = false; this.deadT = 0; this.deadRot = 0;
    this.safe = { x: this.x, y: this.y };
    this.prevY = this.y;
    this.combo = 0;
  }
  get cx() { return this.x + this.w / 2; }
  get cy() { return this.y + this.h / 2; }

  update(dt, g) {
    const I = Input, lv = g.level;
    this.prevY = this.y;
    this.animT += dt;
    if (this.dead) {
      this.deadT += dt;
      if (this.deadT > 0.35) {
        this.vy = Math.min(this.vy + 1100 * dt, 600);
        this.y += this.vy * dt;
        this.deadRot += dt * 5 * this.facing;
      }
      return;
    }
    if (this.inv > 0) this.inv -= dt;
    if (this.cool > 0) this.cool -= dt;
    if (this.aimT > 0) this.aimT -= dt;
    if (this.triple > 0) this.triple -= dt;
    if (this.dropT > 0) this.dropT -= dt;
    const ctl = !g.cutscene;

    if (this.platform) {
      const p = this.platform;
      if (this.x + this.w > p.x && this.x < p.x + p.w) { this.x += p.dx; this.y = p.y - this.h; }
    }

    const stunned = this.hurtT > 0;
    if (stunned) this.hurtT -= dt;
    let dir = 0;
    if (ctl && !stunned) dir = (I.down.right ? 1 : 0) - (I.down.left ? 1 : 0);
    this.aimUp = ctl && I.down.up;
    this.aimDown = ctl && !this.aimUp && I.down.down && !this.onGround;
    const max = this.charging && this.onGround ? 55 : PHYS.run;
    if (!stunned) {
      let a = this.onGround ? (dir ? PHYS.accG : PHYS.decG) : (dir ? PHYS.accA : PHYS.decA);
      if (dir && Math.sign(this.vx) === -dir) a *= 1.8;
      this.vx = approach(this.vx, dir * max, a * dt);
    }
    if (dir) this.facing = dir;

    // Springen (mit Koyotenzeit und Sprungpuffer)
    if (this.onGround) this.coyote = PHYS.coyote; else this.coyote -= dt;
    if (ctl && I.pressed.jump) this.jbuf = PHYS.buffer; else this.jbuf -= dt;
    if (this.jbuf > 0 && this.coyote > 0 && !stunned) {
      const onPlat = this.platform || this.groundCode === T_ONEWAY || this.groundCode === T_CRUMBLE;
      if (I.down.down && this.onGround && onPlat) {
        this.dropT = 0.22; this.onGround = false; this.platform = null; this.y += 1;
      } else {
        this.vy = -PHYS.jumpV; this.jumping = true; this.onGround = false; this.platform = null;
        Sound.play('jump');
        g.dust(this.cx, this.y + this.h, 4);
      }
      this.jbuf = 0; this.coyote = 0;
    }
    if (this.jumping && this.vy < 0 && !I.down.jump) { this.vy *= PHYS.cut; this.jumping = false; }
    if (this.vy >= 0) this.jumping = false;
    this.vy = Math.min(this.vy + (this.vy < 0 ? PHYS.grav : PHYS.gravFall) * dt, PHYS.maxFall);

    // Bogen spannen und schießen
    if (ctl && !stunned) {
      if (I.pressed.shoot && this.cool <= 0 && !this.charging) {
        this.charging = true; this.charge = 0; this.chargedSfx = false;
        Sound.play('draw');
      }
      if (this.charging) {
        this.charge += dt;
        if (this.charge >= CHARGE_T && !this.chargedSfx) {
          this.chargedSfx = true;
          Sound.play('charged');
          g.sparkle(this.cx + this.facing * 8, this.y + 7, 6, '#ffe27a');
        }
        if (!I.down.shoot) this.fire(g);
      }
    } else if (this.charging && !I.down.shoot) this.charging = false;

    const wasGround = this.onGround, vyBefore = this.vy;
    moveX(this, this.vx * dt, lv, g.bounds);
    moveY(this, this.vy * dt, lv, this.dropT > 0, g.platforms);

    if (this.onGround) {
      if (!wasGround) {
        this.combo = 0;
        if (vyBefore > 240) { Sound.play('land'); g.dust(this.cx, this.y + this.h, 5); }
      }
      if (Math.abs(this.vx) > 15) {
        this.runPhase += dt * Math.abs(this.vx) / 11;
        this.stepT -= dt;
        if (this.stepT <= 0) { this.stepT = 0.26; g.dust(this.cx - this.facing * 3, this.y + this.h, 1); }
      } else this.runPhase = 0;
      if (!this.platform && (this.groundCode === T_SOLID || this.groundCode === T_ONEWAY)) {
        const lc = Math.floor((this.x - 2) / TILE), rc = Math.floor((this.x + this.w + 2) / TILE);
        const cy = Math.floor((this.y + this.h + 1) / TILE);
        let ok = true;
        for (let c = lc - 1; c <= rc + 1; c++) {
          const a = lv.get(c, cy - 1), b = lv.get(c, cy);
          if (a === T_SPIKE || b === T_WATER || b === T_CRUMBLE) ok = false;
        }
        if (!lv.isGround(lc, cy) || !lv.isGround(rc, cy)) ok = false;
        if (ok) { this.safe.x = this.x; this.safe.y = this.y; }
      }
    }
    this.checkHazards(g);
    if (this.y > lv.ph + 24) g.playerFell('pit');
  }

  checkHazards(g) {
    const lv = g.level;
    const x0 = Math.floor((this.x + 1) / TILE), x1 = Math.floor((this.x + this.w - 1) / TILE);
    const y0 = Math.floor(this.y / TILE), y1 = Math.floor((this.y + this.h - 1) / TILE);
    for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) {
      const c = lv.get(cx, cy);
      if (c === T_SPIKE) {
        if (this.y + this.h > cy * TILE + 8 && this.x + this.w > cx * TILE + 2 && this.x < cx * TILE + 14) {
          if (this.hurt(1, -this.facing, g)) this.vy = -390;
        }
      } else if (c === T_WATER) {
        const surface = lv.ch(cx, cy - 1) !== '~' ? cy * TILE + 4 : cy * TILE;
        if (this.y + this.h > surface + 8) { g.playerFell('water'); return; }
      }
    }
  }

  fire(g) {
    const power = this.charge >= CHARGE_T;
    this.charging = false;
    const ang = this.aimUp ? -0.78 : this.aimDown ? 0.7 : 0;
    const ox = this.cx + this.facing * 6;
    const oy = this.y + 7 + (this.aimUp ? -2 : this.aimDown ? 3 : 0);
    const spread = this.triple > 0 ? [-0.15, 0, 0.15] : [0];
    for (const s of spread) g.arrows.push(new Arrow(ox, oy, this.facing, ang + s, power));
    this.cool = power ? 0.3 : 0.18;
    this.aimT = 0.28;
    Sound.play(power ? 'power' : 'shoot');
    if (power) { this.vx -= this.facing * 50; g.shake(2); }
    g.stats.shots++;
  }

  hurt(dmg, dir, g) {
    if (this.inv > 0 || this.dead || g.god) return false;
    this.hp -= dmg;
    this.inv = 1.4; this.hurtT = 0.22;
    this.vx = (dir || 1) * 150; this.vy = -250;
    this.onGround = false; this.platform = null;
    this.charging = false; this.jumping = false;
    Sound.play('hurt');
    g.shake(4); g.freeze(0.05);
    g.burst(this.cx, this.cy, 8, ['#ffffff', '#ff8a8a']);
    if (this.hp <= 0) this.die(g);
    return true;
  }

  die(g) {
    this.hp = 0; this.dead = true; this.deadT = 0;
    this.vy = -360; this.vx = 0; this.deadRot = 0;
    Sound.play('death');
    Sound.playSong(null);
  }

  draw(g, cam) {
    if (!this.dead && this.inv > 0 && Math.floor(this.inv * 14) % 2 === 0) return;
    const flash = this.hurtT > 0 ? '#ffffff' : null;
    drawRobin(g, this, this.cx - cam.x, this.y + this.h - cam.y, flash);
    if (this.charging && !this.dead) {
      const k = Math.min(1, this.charge / CHARGE_T);
      const bx = Math.round(this.cx - cam.x - 8), by = Math.round(this.y - cam.y - 14);
      g.fillStyle = OUTLINE; g.fillRect(bx - 1, by - 1, 18, 4);
      g.fillStyle = '#3a2a1a'; g.fillRect(bx, by, 16, 2);
      g.fillStyle = k >= 1 ? (Math.floor(this.animT * 12) % 2 ? '#fff6b0' : '#ffd24a') : '#d8a040';
      g.fillRect(bx, by, Math.round(16 * k), 2);
    }
  }
}

// ---------------------------------------------------------------------
class Arrow {
  constructor(x, y, facing, ang, power) {
    this.x = x; this.y = y;
    const sp = power ? 600 : 390;
    this.vx = Math.cos(ang) * sp * facing;
    this.vy = Math.sin(ang) * sp;
    this.power = power;
    this.grav = power ? 140 : 430;
    this.life = 2.2;
    this.stuck = false; this.dead = false; this.harmless = false;
    this.dmg = power ? 2 : 1;
    this.pierce = power ? 2 : 0;
    this.hits = new Set();
    this.angle = Math.atan2(this.vy, this.vx);
  }

  update(dt, g) {
    if (this.stuck) { this.life -= dt; if (this.life <= 0) this.dead = true; return; }
    this.vy += this.grav * dt;
    const n = 3, lv = g.level;
    for (let i = 0; i < n && !this.dead && !this.stuck; i++) {
      this.x += (this.vx * dt) / n;
      this.y += (this.vy * dt) / n;
      if (this.harmless) continue;
      const cx = Math.floor(this.x / TILE), cy = Math.floor(this.y / TILE);
      const c = lv.get(cx, cy);
      if (c === T_SOLID) { this.stick(g); break; }
      if (c === T_CRATE) {
        g.breakCrate(cx, cy);
        if (this.pierce > 0) this.pierce--; else { this.dead = true; break; }
      }
      if (c === T_DOOR) { this.deflect(g); break; }
    }
    if (!this.stuck) this.angle = Math.atan2(this.vy, this.vx);
    this.life -= dt;
    if (this.life <= 0 || this.y > lv.ph + 40 || this.x < -30 || this.x > lv.pw + 30) this.dead = true;
    if (this.power && !this.stuck && !this.harmless && Math.random() < 0.7) {
      g.particles.push({ x: this.x - this.vx * 0.02, y: this.y - this.vy * 0.02, vx: 0, vy: 0, life: 0.25, max: 0.25, c: '#ffe27a', s: 1, gr: 0 });
    }
  }

  stick(g) {
    const lv = g.level;
    for (let k = 0; k < 6; k++) {
      const cx = Math.floor((this.x - Math.cos(this.angle) * 3) / TILE), cy = Math.floor((this.y - Math.sin(this.angle) * 3) / TILE);
      if (!lv.isSolid(cx, cy)) break;
      this.x -= Math.cos(this.angle); this.y -= Math.sin(this.angle);
    }
    this.stuck = true; this.life = 1.3;
    this.vx = this.vy = 0;
    Sound.play('thunk');
    g.chips(this.x, this.y);
  }

  deflect(g) {
    this.harmless = true;
    this.vx = -this.vx * 0.25; this.vy = -170;
    this.grav = 900; this.life = 0.8;
    Sound.play('clang');
    g.sparks(this.x, this.y);
  }

  draw(g, cam) {
    const a = this.stuck || this.harmless ? this.angle : Math.atan2(this.vy, this.vx);
    const ca = Math.cos(a), sa = Math.sin(a);
    const tx = this.x - cam.x, ty = this.y - cam.y;
    const alpha = this.stuck && this.life < 0.4 ? this.life / 0.4 : 1;
    g.globalAlpha = alpha;
    const L = this.stuck ? 9 : 12;
    const shaft = this.power ? '#ffe7a0' : '#e2c088';
    for (let i = 0; i <= L; i++) {
      const x = Math.round(tx - ca * i), y = Math.round(ty - sa * i);
      g.fillStyle = OUTLINE; g.fillRect(x, y + 1, 1, 1);
      g.fillStyle = i < 2 ? '#d6dde4' : i > L - 3 ? (i % 2 ? '#f2ece0' : '#d6402f') : shaft;
      g.fillRect(x, y, 1, 1);
    }
    const bx = Math.round(tx - ca * L), by = Math.round(ty - sa * L);
    g.fillStyle = '#d6402f'; g.fillRect(bx + Math.round(sa), by - Math.round(ca) - 1, 1, 1);
    g.fillStyle = '#f2ece0'; g.fillRect(bx - Math.round(sa), by + Math.round(ca) + 1, 1, 1);
    if (this.power && !this.stuck && !this.harmless) {
      g.globalAlpha = 0.5; g.fillStyle = '#fff3b0';
      g.fillRect(Math.round(tx) - 1, Math.round(ty) - 1, 3, 3);
    }
    g.globalAlpha = 1;
  }
}

// ---------------------------------------------------------------------
//  Geschosse der Gegner: Bolzen, Dolche, Schockwellen
// ---------------------------------------------------------------------
class EProj {
  constructor(kind, x, y, vx, vy) {
    this.kind = kind;
    this.x = x; this.y = y; this.vx = vx; this.vy = vy;
    this.dead = false; this.stuck = 0; this.t = 0;
    if (kind === 'bolt') { this.w = 8; this.h = 4; this.grav = 0; this.life = 2.5; }
    else if (kind === 'dagger') { this.w = 7; this.h = 7; this.grav = 520; this.life = 3; }
    else { this.w = 12; this.h = 12; this.grav = 0; this.life = 1.6; }
  }
  get box() { return { x: this.x - this.w / 2, y: this.y - this.h / 2, w: this.w, h: this.h }; }
  update(dt, g) {
    this.t += dt;
    const lv = g.level;
    if (this.stuck > 0) { this.stuck -= dt; if (this.stuck <= 0) this.dead = true; return; }
    this.vy += this.grav * dt;
    this.x += this.vx * dt; this.y += this.vy * dt;
    this.life -= dt;
    if (this.life <= 0) this.dead = true;
    const cx = Math.floor(this.x / TILE), cy = Math.floor(this.y / TILE);
    if (this.kind === 'wave') {
      const below = Math.floor((this.y + this.h / 2 + 2) / TILE);
      if (lv.isSolid(cx, cy) || !lv.isGround(cx, below) || (g.bounds && (this.x < g.bounds.x0 || this.x > g.bounds.x1))) this.dead = true;
      if (Math.random() < 0.5) g.dust(this.x, this.y + this.h / 2, 1);
      return;
    }
    if (lv.isSolid(cx, cy)) {
      if (this.kind === 'dagger') { this.stuck = 0.6; Sound.play('thunk'); }
      else { this.dead = true; g.sparks(this.x, this.y); }
    }
    if (this.y > lv.ph + 30) this.dead = true;
  }
  draw(g, cam) {
    const x = Math.round(this.x - cam.x), y = Math.round(this.y - cam.y);
    if (this.kind === 'bolt') {
      const d = Math.sign(this.vx) || 1;
      const a = Math.atan2(this.vy, this.vx);
      for (let i = 0; i < 9; i++) {
        const px = Math.round(x - Math.cos(a) * i), py = Math.round(y - Math.sin(a) * i);
        g.fillStyle = OUTLINE; g.fillRect(px - 1, py - 1, 3, 3);
      }
      for (let i = 0; i < 9; i++) {
        const px = Math.round(x - Math.cos(a) * i), py = Math.round(y - Math.sin(a) * i);
        g.fillStyle = i < 2 ? '#e3e8ec' : i > 6 ? '#3a3a3a' : '#5a3a22';
        g.fillRect(px, py, 1, 1);
      }
      void d;
    } else if (this.kind === 'dagger') {
      const a = this.stuck > 0 ? this.lastA : this.t * 18;
      this.lastA = a;
      const ca = Math.cos(a), sa = Math.sin(a);
      for (let i = -4; i <= 4; i++) { g.fillStyle = OUTLINE; g.fillRect(Math.round(x + ca * i) - 1, Math.round(y + sa * i) - 1, 3, 3); }
      for (let i = -4; i <= 4; i++) {
        g.fillStyle = i < -1 ? '#5a3a22' : i === -1 ? '#f0c24a' : '#e3e8ec';
        g.fillRect(Math.round(x + ca * i), Math.round(y + sa * i), 1, 1);
      }
    } else {
      const k = Math.sin(this.t * 30) > 0 ? 1 : 0;
      g.globalAlpha = 0.85;
      g.fillStyle = '#fff2c0';
      g.fillRect(x - 5, y - 2 - k, 10, 8 + k);
      g.fillStyle = '#ffb04a';
      g.fillRect(x - 6, y + 2, 12, 4);
      g.fillStyle = '#ffffff';
      g.fillRect(x - 2, y - 5 - k, 4, 4);
      g.globalAlpha = 1;
    }
  }
}

// ---------------------------------------------------------------------
class Pickup {
  constructor(kind, cx, cy, phys) {
    this.kind = kind;
    this.x = cx; this.y = cy;
    this.w = 8; this.h = 8;
    this.vx = 0; this.vy = 0;
    this.phys = !!phys;
    this.t = Math.random() * 6;
    this.delay = phys ? 0.35 : 0;
    this.life = phys ? 9 : Infinity;
    this.dead = false;
  }
  update(dt, g) {
    this.t += dt;
    if (this.delay > 0) this.delay -= dt;
    if (this.phys) {
      this.vy = Math.min(this.vy + 900 * dt, 400);
      const box = { x: this.x - 4, y: this.y - 4, w: 8, h: 8, vx: this.vx, vy: this.vy };
      const vyB = this.vy;
      moveX(box, this.vx * dt, g.level, g.bounds);
      moveY(box, this.vy * dt, g.level, false, g.platforms);
      this.vx = box.vx;
      if (box.onGround) { this.vy = vyB > 80 ? -vyB * 0.42 : 0; this.vx *= 0.82; } else this.vy = box.vy;
      this.x = box.x + 4; this.y = box.y + 4;
      this.life -= dt;
      if (this.life <= 0 || this.y > g.level.ph + 20) this.dead = true;
    }
    const p = g.player;
    if (p.dead || this.delay > 0) return;
    const dx = p.cx - this.x, dy = p.cy - this.y;
    const d = Math.hypot(dx, dy) || 1;
    if (this.kind === 'coin' && d < 34) { this.x += (dx / d) * 190 * dt; this.y += (dy / d) * 190 * dt; }
    if (Math.abs(dx) < 10 && Math.abs(dy) < 16) { this.dead = true; g.collect(this); }
  }
  draw(g, cam, t) {
    if (this.phys && this.life < 2 && Math.floor(this.life * 10) % 2 === 0) return;
    const x = this.x - cam.x, y = this.y - cam.y + (this.phys ? 0 : Math.sin(this.t * 3) * 1.5);
    if (this.kind === 'coin') drawCoinAt(g, x, y, this.t);
    else if (this.kind === 'bag') drawBag(g, x, y + 3, this.t);
    else if (this.kind === 'heart') {
      g.globalAlpha = 0.3 + 0.2 * Math.sin(this.t * 5); g.fillStyle = '#ff9a9a'; disc(g, x, y, 8); g.globalAlpha = 1;
      drawHeartIcon(g, x - 3, y - 3, true);
    } else if (this.kind === 'triple') drawQuiverPickup(g, x, y + 4, this.t);
    void t;
  }
}

// ---------------------------------------------------------------------
class MovingPlatform {
  constructor(x, y, dirX, dirY) {
    this.x0 = x; this.y0 = y; this.x = x; this.y = y;
    this.w = 48; this.h = 8;
    this.dirX = dirX; this.dirY = dirY;
    this.vertical = !!dirY;
    this.range = 64;
    this.period = dirY ? 4.4 : 4;
    this.t = 0; this.dx = 0; this.dy = 0;
  }
  update(dt) {
    this.t += dt;
    const k = (1 - Math.cos((this.t / this.period) * Math.PI * 2)) / 2;
    const nx = this.x0 + this.dirX * this.range * k;
    const ny = this.y0 + this.dirY * this.range * k;
    this.dx = nx - this.x; this.dy = ny - this.y;
    this.x = nx; this.y = ny;
  }
}

// ---------------------------------------------------------------------
const SAD_LINES = [
  'Der Sheriff nahm uns alles …',
  'Hast du etwas Gold, Robin?',
  'Die Steuern erdrücken uns.',
  'Meine Kinder hungern …',
];
const THANK_LINES = [
  'Danke, Robin!',
  'Gott segne dich!',
  'Endlich Brot für die Kinder!',
  'Du bist ein Held!',
  'Der Sheriff soll sich hüten!',
  'Hoch lebe Robin Hood!',
];
const GUARD_SHOUTS = [
  'Halt! Im Namen des Sheriffs!',
  'Da ist der Gesetzlose!',
  'Ergreift ihn!',
  'Robin Hood!',
  'Stehen bleiben!',
  'Für den Sheriff!',
];

class Peasant {
  constructor(fx, fy, variant) {
    this.x = fx; this.y = fy; this.variant = variant;
    this.facing = -1; this.anim = Math.random() * 6;
    this.talked = false; this.happy = 0; this.cool = 0;
    this.w = 10; this.h = 24;
  }
  update(dt, g) {
    this.anim += dt;
    if (this.happy > 0) this.happy -= dt;
    if (this.cool > 0) this.cool -= dt;
    const p = g.player;
    this.facing = p.cx < this.x ? -1 : 1;
    const near = !p.dead && Math.abs(p.cx - this.x) < 18 && Math.abs(p.y + p.h - this.y) < 22;
    if (near && this.cool <= 0) {
      if (g.gold > 0) { g.donate(this); this.happy = 1.6; this.cool = 1.2; }
      else if (!this.talked) { g.say(this, pick(SAD_LINES), 2.4); this.talked = true; this.cool = 4; }
    }
  }
  draw(g, cam) { drawPeasant(g, this, this.x - cam.x, this.y - cam.y); }
}
