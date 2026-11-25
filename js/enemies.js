'use strict';
// =====================================================================
//  enemies.js · Die Häscher des Sheriffs und zwei Endgegner
// =====================================================================

class Enemy {
  constructor(type, fx, fy, w, h) {
    this.type = type;
    this.w = w; this.h = h;
    this.x = fx - w / 2; this.y = fy - h;
    this.vx = 0; this.vy = 0;
    this.facing = -1;
    this.hp = 1; this.maxHp = 1;
    this.state = 'patrol'; this.t = 0;
    this.anim = 0;
    this.flash = 0; this.inv = 0; this.stunT = 0; this.alertT = 0;
    this.ko = false; this.koRot = 0; this.koDir = 1;
    this.dead = false;
    this.onGround = false;
    this.stompable = true; this.contact = true;
    this.score = 100; this.drop = 0.4;
    this.lost = 0;
    this.isBoss = false; this.heavy = false;
  }
  get cx() { return this.x + this.w / 2; }
  get cy() { return this.y + this.h / 2; }
  get feet() { return this.y + this.h; }

  update(dt, g) {
    this.anim += dt * (Math.abs(this.vx) > 5 ? Math.abs(this.vx) / 11 : 0);
    if (this.flash > 0) this.flash -= dt;
    if (this.inv > 0) this.inv -= dt;
    if (this.alertT > 0) this.alertT -= dt;
    if (this.ko) {
      this.vy += 1300 * dt;
      this.x += this.vx * dt; this.y += this.vy * dt;
      this.koRot += dt * 9 * this.koDir;
      if (this.y > g.cam.y + VIEW_H + 60) this.dead = true;
      return;
    }
    if (this.stunT > 0) { this.stunT -= dt; this.vx = approach(this.vx, 0, 600 * dt); }
    else this.think(dt, g);
    this.vy = Math.min(this.vy + 1500 * dt, 500);
    moveX(this, this.vx * dt, g.level, this.isBoss ? g.bounds : null);
    moveY(this, this.vy * dt, g.level, false, null);
    if (this.y > g.level.ph + 20) { this.dead = true; g.onEnemyDefeated(this, true); }
  }

  think() {}

  look(g, front, back, vert) {
    const p = g.player;
    if (p.dead) return false;
    const dx = p.cx - this.cx, dy = (p.y + p.h) - this.feet;
    if (Math.abs(dy) > (vert || 48)) return false;
    const ahead = Math.sign(dx) === this.facing;
    return Math.abs(dx) < (ahead ? front : back);
  }

  alert(g, dx, t) {
    this.state = 'alert';
    this.t = t || 0.35;
    if (dx) this.facing = Math.sign(dx);
    this.alertT = 0.7;
    Sound.play('alert');
    g.shout(this);
  }

  attackBox(g, ox, oy, w, h) {
    const box = { x: this.facing > 0 ? this.cx + ox : this.cx - ox - w, y: this.feet + oy, w, h };
    if (overlap(box, g.player)) g.player.hurt(1, this.facing, g);
    return box;
  }

  blocks() { return false; }

  hurt(dmg, dir, g, kind) {
    if (this.ko || this.inv > 0) return 'none';
    if (kind !== 'stomp' && this.blocks(dir, kind, g)) return 'block';
    this.hp -= dmg;
    this.flash = 0.12;
    this.inv = this.isBoss ? 0.22 : 0.06;
    if (!this.isBoss) {
      this.vx = dir * (this.heavy ? 40 : 90);
      this.stunT = this.heavy ? 0.12 : 0.22;
      if (this.state === 'patrol' || this.state === 'sit' || this.state === 'idle') this.alert(g, -dir * 10, 0.2);
    }
    if (this.onHurt) this.onHurt(g, kind);
    if (this.hp <= 0) { this.defeat(dir, g); return 'kill'; }
    Sound.play('hit');
    return 'hit';
  }

  defeat(dir, g) {
    this.ko = true;
    this.koDir = dir || 1;
    this.vy = -280; this.vx = (dir || 1) * 70;
    Sound.play('ko');
    g.onEnemyDefeated(this, false);
  }

  draw(g, cam) {
    const flash = this.flash > 0 ? '#ffffff' : null;
    const sx = this.cx - cam.x, sy = this.feet - cam.y;
    this.drawBody(g, sx, sy, flash);
    if (this.alertT > 0 && !this.ko) {
      const ax = Math.round(sx), ay = Math.round(this.y - cam.y - 16 - (this.alertT > 0.55 ? (0.7 - this.alertT) * 20 : 3));
      g.fillStyle = OUTLINE; g.fillRect(ax - 2, ay - 1, 5, 11);
      g.fillStyle = '#ffd23a'; g.fillRect(ax - 1, ay, 3, 6); g.fillRect(ax - 1, ay + 7, 3, 2);
    }
  }
}

// ---------------------------------------------------------------------
class Soldier extends Enemy {
  constructor(fx, fy) {
    super('soldier', fx, fy, 10, 24);
    this.hp = this.maxHp = 2; this.score = 100; this.speed = 30; this.drop = 0.5;
  }
  think(dt, g) {
    const p = g.player, lv = g.level;
    const dx = p.cx - this.cx, adx = Math.abs(dx), dy = (p.y + p.h) - this.feet;
    this.t -= dt;
    switch (this.state) {
      case 'patrol':
        this.vx = this.facing * this.speed;
        if (!groundAhead(this, lv, this.facing) || wallAhead(this, lv, this.facing)) { this.facing *= -1; this.vx = 0; }
        if (this.look(g, 150, 60)) this.alert(g, dx);
        break;
      case 'alert':
        this.vx = 0;
        if (this.t <= 0) this.state = 'chase';
        break;
      case 'chase':
        if (adx > 6) this.facing = Math.sign(dx);
        this.vx = this.facing * 72;
        if (!groundAhead(this, lv, this.facing) || wallAhead(this, lv, this.facing)) this.vx = 0;
        if (adx < 24 && Math.abs(dy) < 22 && !p.dead) { this.state = 'windup'; this.t = 0.36; this.vx = 0; }
        if (!this.look(g, 220, 160, 70)) { this.lost += dt; if (this.lost > 2.5) { this.state = 'patrol'; this.lost = 0; } }
        else this.lost = 0;
        break;
      case 'windup':
        this.vx = 0;
        if (this.t <= 0) { this.state = 'slash'; this.t = 0.18; Sound.play('swing'); }
        break;
      case 'slash':
        this.vx = 0;
        this.attackBox(g, 2, -22, 20, 16);
        if (this.t <= 0) { this.state = 'recover'; this.t = 0.5; }
        break;
      case 'recover':
        this.vx = 0;
        if (this.t <= 0) this.state = 'chase';
        break;
      default: this.state = 'patrol';
    }
  }
  drawBody(g, sx, sy, flash) { drawGuard(g, this, sx, sy, flash); }
}

class Spearman extends Enemy {
  constructor(fx, fy) {
    super('spear', fx, fy, 10, 24);
    this.hp = this.maxHp = 3; this.score = 150; this.speed = 24; this.drop = 0.5;
  }
  think(dt, g) {
    const p = g.player, lv = g.level;
    const dx = p.cx - this.cx, adx = Math.abs(dx), dy = (p.y + p.h) - this.feet;
    this.t -= dt;
    switch (this.state) {
      case 'patrol':
        this.vx = this.facing * this.speed;
        if (!groundAhead(this, lv, this.facing) || wallAhead(this, lv, this.facing)) { this.facing *= -1; this.vx = 0; }
        if (this.look(g, 160, 60)) this.alert(g, dx);
        break;
      case 'alert':
        this.vx = 0;
        if (this.t <= 0) this.state = 'chase';
        break;
      case 'chase':
        if (adx > 6) this.facing = Math.sign(dx);
        this.vx = this.facing * 52;
        if (!groundAhead(this, lv, this.facing) || wallAhead(this, lv, this.facing)) this.vx = 0;
        if (adx < 42 && Math.abs(dy) < 22 && !p.dead) { this.state = 'windup'; this.t = 0.44; this.vx = 0; }
        if (!this.look(g, 220, 160, 70)) { this.lost += dt; if (this.lost > 2.5) { this.state = 'patrol'; this.lost = 0; } }
        else this.lost = 0;
        break;
      case 'windup':
        this.vx = -this.facing * 10;
        if (this.t <= 0) { this.state = 'thrust'; this.t = 0.24; Sound.play('swing'); }
        break;
      case 'thrust':
        this.vx = this.facing * 30;
        this.attackBox(g, 4, -19, 26, 8);
        if (this.t <= 0) { this.state = 'recover'; this.t = 0.6; }
        break;
      case 'recover':
        this.vx = 0;
        if (this.t <= 0) this.state = 'chase';
        break;
      default: this.state = 'patrol';
    }
  }
  drawBody(g, sx, sy, flash) { drawGuard(g, this, sx, sy, flash); }
}

class Crossbowman extends Enemy {
  constructor(fx, fy) {
    super('crossbow', fx, fy, 10, 24);
    this.hp = this.maxHp = 2; this.score = 150; this.state = 'idle'; this.drop = 0.6;
    this.seen = false;
  }
  think(dt, g) {
    const p = g.player;
    const dx = p.cx - this.cx, dy = p.cy - (this.y + 7);
    this.t -= dt;
    this.vx = 0;
    const sees = !p.dead && Math.abs(dx) < 250 && Math.abs(dy) < 150 && Math.abs(dx) > 8;
    switch (this.state) {
      case 'idle':
        if (sees) {
          this.facing = Math.sign(dx) || this.facing;
          if (!this.seen) { this.seen = true; this.alert(g, dx, 0.1); this.state = 'aim'; this.t = 1.0; }
          else { this.state = 'aim'; this.t = 0.75; }
        }
        break;
      case 'alert': this.state = 'aim'; this.t = 0.9; break;
      case 'aim':
        if (Math.abs(dx) > 8) this.facing = Math.sign(dx);
        if (this.t <= 0) {
          if (!sees) { this.state = 'idle'; break; }
          let a = Math.atan2(dy, Math.abs(dx));
          a = clamp(a, -0.65, 0.65);
          const sp = 235;
          g.eprojs.push(new EProj('bolt', this.cx + this.facing * 12, this.y + 8, Math.cos(a) * sp * this.facing, Math.sin(a) * sp));
          Sound.play('bolt');
          this.state = 'reload'; this.t = 1.7;
        }
        break;
      case 'reload':
        if (this.t <= 0) this.state = 'idle';
        break;
      default: this.state = 'idle';
    }
  }
  drawBody(g, sx, sy, flash) { drawGuard(g, this, sx, sy, flash); }
}

class Knight extends Enemy {
  constructor(fx, fy) {
    super('knight', fx, fy, 12, 26);
    this.hp = this.maxHp = 5; this.score = 300; this.heavy = true; this.drop = 1;
    this.stagger = 0;
  }
  blocks(dir, kind, g) {
    if (this.stagger > 0) return false;
    if (dir !== -this.facing) return false;
    if (kind === 'power') {
      this.stagger = 1.6;
      Sound.play('clang');
      g.sparks(this.cx + this.facing * 8, this.y + 12);
      g.say(this, 'Mein Schild!', 1.2);
      return false;
    }
    Sound.play('clang');
    g.sparks(this.cx + this.facing * 8, this.y + 12);
    return true;
  }
  think(dt, g) {
    const p = g.player, lv = g.level;
    const dx = p.cx - this.cx, adx = Math.abs(dx), dy = (p.y + p.h) - this.feet;
    this.t -= dt;
    if (this.stagger > 0) { this.stagger -= dt; this.vx = 0; return; }
    switch (this.state) {
      case 'patrol':
        this.vx = this.facing * 22;
        if (!groundAhead(this, lv, this.facing) || wallAhead(this, lv, this.facing)) { this.facing *= -1; this.vx = 0; }
        if (this.look(g, 170, 80)) this.alert(g, dx, 0.5);
        break;
      case 'alert':
        this.vx = 0;
        if (this.t <= 0) this.state = 'chase';
        break;
      case 'chase':
        if (adx > 8) this.facing = Math.sign(dx);
        this.vx = this.facing * 40;
        if (!groundAhead(this, lv, this.facing) || wallAhead(this, lv, this.facing)) this.vx = 0;
        if (adx < 28 && Math.abs(dy) < 24 && !p.dead) { this.state = 'windup'; this.t = 0.5; this.vx = 0; }
        if (!this.look(g, 240, 180, 70)) { this.lost += dt; if (this.lost > 3) { this.state = 'patrol'; this.lost = 0; } }
        else this.lost = 0;
        break;
      case 'windup':
        this.vx = 0;
        if (this.t <= 0) { this.state = 'swing'; this.t = 0.22; Sound.play('swing'); }
        break;
      case 'swing':
        this.vx = 0;
        this.attackBox(g, 2, -24, 22, 18);
        if (this.t <= 0) { this.state = 'recover'; this.t = 0.7; }
        break;
      case 'recover':
        this.vx = 0;
        if (this.t <= 0) this.state = 'chase';
        break;
      default: this.state = 'patrol';
    }
  }
  drawBody(g, sx, sy, flash) { drawKnight(g, this, sx, sy, flash); }
}

class Hound extends Enemy {
  constructor(fx, fy) {
    super('hound', fx, fy, 16, 11);
    this.hp = this.maxHp = 1; this.score = 80; this.state = 'sit'; this.drop = 0.3;
  }
  think(dt, g) {
    const p = g.player, lv = g.level;
    const dx = p.cx - this.cx;
    this.t -= dt;
    this.anim += dt * 0.5;
    switch (this.state) {
      case 'sit':
        this.vx = 0;
        if (this.look(g, 180, 120, 40)) { this.state = 'bark'; this.t = 0.45; this.facing = Math.sign(dx) || this.facing; this.alertT = 0.6; Sound.play('bark'); }
        break;
      case 'bark':
        this.vx = 0;
        if (this.t <= 0) this.state = 'run';
        break;
      case 'run':
        this.vx = this.facing * 190;
        if (!groundAhead(this, lv, this.facing) || wallAhead(this, lv, this.facing)) { this.state = 'skid'; this.t = 0.4; }
        else if (dx * this.facing < -60) { this.state = 'skid'; this.t = 0.4; }
        if (Math.random() < 0.3) g.dust(this.cx - this.facing * 6, this.feet, 1);
        break;
      case 'skid':
        this.vx = approach(this.vx, 0, 700 * dt);
        if (this.t <= 0) {
          this.facing = Math.sign(dx) || -this.facing;
          if (!groundAhead(this, lv, this.facing)) { this.state = 'sit'; break; }
          this.state = this.look(g, 200, 200, 40) ? 'bark' : 'sit';
          this.t = 0.25;
        }
        break;
      case 'alert': this.state = 'bark'; this.t = 0.3; break;
      default: this.state = 'sit';
    }
  }
  drawBody(g, sx, sy, flash) { drawHound(g, this, sx, sy, flash); }
}

// ---------------------------------------------------------------------
//  Sir Guy von Gisborne
// ---------------------------------------------------------------------
class Gisborne extends Enemy {
  constructor(fx, fy) {
    super('gisborne', fx, fy, 12, 28);
    this.hp = this.maxHp = 16; this.score = 3000;
    this.isBoss = true; this.heavy = true;
    this.name = 'Sir Guy von Gisborne';
    this.state = 'wait';
    this.last = '';
    this.dashes = 0;
  }
  activate(g) {
    this.state = 'intro'; this.t = 1.8;
    g.say(this, 'Diesmal entkommst du nicht, Locksley!', 2.4);
    Sound.play('boss');
  }
  next() {
    const r = Math.random();
    if (this.last !== 'dash' && r < 0.4) { this.state = 'dashprep'; this.t = 0.6; this.last = 'dash'; }
    else if (this.last !== 'leap' && r < 0.75) { this.state = 'leapprep'; this.t = 0.35; this.last = 'leap'; }
    else { this.state = 'walk'; this.t = 1.4; this.last = 'walk'; }
  }
  think(dt, g) {
    const p = g.player;
    const dx = p.cx - this.cx, adx = Math.abs(dx);
    const rage = this.hp <= this.maxHp / 2 ? 1.3 : 1;
    this.t -= dt;
    switch (this.state) {
      case 'wait': this.vx = 0; break;
      case 'intro': this.vx = 0; this.facing = Math.sign(dx) || -1; if (this.t <= 0) this.next(); break;
      case 'walk':
        this.facing = Math.sign(dx) || this.facing;
        this.vx = this.facing * 75 * rage;
        if (adx < 34) { this.state = 'windup'; this.t = 0.3 / rage; this.vx = 0; }
        else if (this.t <= 0) this.next();
        break;
      case 'windup':
        this.vx = 0;
        if (this.t <= 0) { this.state = 'slash'; this.t = 0.2; Sound.play('swing'); }
        break;
      case 'slash':
        this.vx = this.facing * 40;
        this.attackBox(g, 2, -26, 26, 20);
        if (this.t <= 0) { this.state = 'recover'; this.t = 0.45 / rage; }
        break;
      case 'recover':
        this.vx = 0;
        if (this.t <= 0) this.next();
        break;
      case 'dashprep':
        this.vx = 0;
        this.facing = Math.sign(dx) || this.facing;
        this.flash = Math.floor(this.t * 16) % 2 ? 0.02 : 0;
        if (this.t <= 0) { this.state = 'dash'; this.t = 1.6; Sound.play('swing'); this.dashes = rage > 1 ? 2 : 1; }
        break;
      case 'dash':
        this.vx = this.facing * 330 * Math.min(rage, 1.15);
        if (Math.random() < 0.7) g.dust(this.cx - this.facing * 6, this.feet, 1);
        if (this.hitWall) {
          this.dashes--;
          g.shake(6); Sound.play('quake');
          if (this.dashes > 0) { this.facing *= -1; this.state = 'dashprep'; this.t = 0.4; }
          else { this.state = 'stunned'; this.t = 1.4; g.say(this, 'Argh!', 0.8); }
        } else if (this.t <= 0) { this.state = 'recover'; this.t = 0.4; }
        break;
      case 'stunned':
        this.vx = 0;
        if (Math.random() < 0.15) g.particles.push({ x: this.cx + rand(-6, 6), y: this.y - 4, vx: rand(-20, 20), vy: -30, life: 0.5, max: 0.5, c: '#ffe27a', s: 2, gr: 0 });
        if (this.t <= 0) this.next();
        break;
      case 'leapprep':
        this.vx = 0;
        this.facing = Math.sign(dx) || this.facing;
        if (this.t <= 0) {
          this.state = 'leap';
          this.vy = -520;
          this.vx = clamp(dx / 0.7, -280, 280);
          this.onGround = false;
          Sound.play('jump');
        }
        break;
      case 'leap':
        if (this.onGround && this.vy >= 0) {
          this.vx = 0;
          g.shake(5); Sound.play('quake');
          g.dust(this.cx, this.feet, 10);
          for (const d of [-1, 1]) g.eprojs.push(new EProj('wave', this.cx + d * 10, this.feet - 6, d * 210, 0));
          this.state = 'recover'; this.t = 0.55 / rage;
        }
        break;
      default: this.state = 'walk';
    }
  }
  onHurt(g) {
    if (this.hp === Math.ceil(this.maxHp / 2)) g.say(this, 'Das wirst du büßen!', 1.6);
  }
  drawBody(g, sx, sy, flash) { drawGisborne(g, this, sx, sy, flash); }
}

// ---------------------------------------------------------------------
//  Der Sheriff von Nottingham
// ---------------------------------------------------------------------
class Sheriff extends Enemy {
  constructor(fx, fy) {
    super('sheriff', fx, fy, 12, 28);
    this.hp = this.maxHp = 18; this.score = 6000;
    this.isBoss = true; this.heavy = true;
    this.name = 'Der Sheriff von Nottingham';
    this.state = 'wait';
    this.volleys = 0; this.summons = 0;
    this.spots = null;
  }
  activate(g) {
    this.state = 'intro'; this.t = 2.0;
    g.say(this, 'Hood! Dein Kopf wird über meinem Tor hängen!', 2.6);
    Sound.play('boss');
    const x0 = g.arena.x0 * TILE;
    const lv = g.level;
    const groundY = lv.groundBelow(g.arena.x0 + 2, 10);
    this.spots = [
      { x: x0 + 5 * TILE, y: groundY }, { x: x0 + 25 * TILE, y: groundY },
      { x: x0 + 7 * TILE, y: 11 * TILE }, { x: x0 + 23 * TILE, y: 11 * TILE },
      { x: x0 + 15 * TILE, y: 13 * TILE },
    ];
  }
  hop(g, avoidNear) {
    const p = g.player;
    let opts = this.spots.filter((s) => Math.abs(s.x - this.cx) > 40);
    if (avoidNear) opts = opts.filter((s) => Math.abs(s.x - p.cx) > 70);
    if (!opts.length) opts = this.spots;
    const s = pick(opts);
    const G = 1500;
    const apex = Math.min(this.feet, s.y) - 46;
    const vy0 = -Math.sqrt(2 * G * (this.feet - apex));
    const tUp = -vy0 / G, tDown = Math.sqrt((2 * (s.y - apex)) / G);
    this.vy = vy0;
    this.vx = (s.x - this.cx) / (tUp + tDown);
    this.onGround = false;
    this.state = 'hop';
    this.hopT = 0;
    this.t = tUp + tDown + 0.6;
    Sound.play('jump');
  }
  throwVolley(g, n, spread, down) {
    const p = g.player;
    const bx = this.cx + this.facing * 6, by = this.y + 8;
    const dx = p.cx - bx, dy = p.cy - by;
    const base = down ? Math.atan2(dy, dx) : Math.atan2(dy - Math.abs(dx) * 0.35, dx);
    for (let i = 0; i < n; i++) {
      const a = base + (i - (n - 1) / 2) * spread;
      const sp = 250;
      g.eprojs.push(new EProj('dagger', bx, by, Math.cos(a) * sp, Math.sin(a) * sp));
    }
    Sound.play('dagger');
  }
  think(dt, g) {
    const p = g.player;
    const dx = p.cx - this.cx;
    const rage = this.hp <= this.maxHp / 2;
    this.t -= dt;
    this.sinceHop = (this.sinceHop || 0) + dt;
    if (this.state !== 'hop' && this.state !== 'wait' && this.onGround) this.vx = 0;
    switch (this.state) {
      case 'wait': this.vx = 0; break;
      case 'intro': this.facing = Math.sign(dx) || -1; if (this.t <= 0) { this.state = 'idle'; this.t = 0.5; } break;
      case 'idle':
        this.facing = Math.sign(dx) || this.facing;
        if (this.t <= 0) {
          const ratio = this.hp / this.maxHp;
          if ((this.summons === 0 && ratio <= 0.66) || (this.summons === 1 && ratio <= 0.33)) { this.state = 'summon'; this.t = 1.0; this.summons++; break; }
          const r = Math.random();
          if (Math.abs(dx) < 48 || this.cycles >= 2 || (r < 0.15 && this.sinceHop > 2.5)) { this.hop(g, true); this.sinceHop = 0; this.cycles = 0; }
          else if (rage && r < 0.6) { this.state = 'rainprep'; this.t = 0.5; }
          else { this.state = 'throwprep'; this.t = 0.45; this.volleys = rage ? 3 : 2; }
        }
        break;
      case 'throwprep':
        this.facing = Math.sign(dx) || this.facing;
        if (this.t <= 0) { this.throwVolley(g, 3, 0.22, false); this.state = 'throw'; this.t = 0.3; }
        break;
      case 'throw':
        if (this.t <= 0) {
          this.volleys--;
          if (this.volleys > 0) { this.state = 'throwprep'; this.t = 0.35; }
          else { this.state = 'idle'; this.t = rage ? 0.8 : 1.2; this.cycles = (this.cycles || 0) + 1; }
        }
        break;
      case 'rainprep':
        this.facing = Math.sign(dx) || this.facing;
        if (this.t <= 0) { this.throwVolley(g, 5, 0.26, true); this.state = 'rain'; this.t = 0.5; }
        break;
      case 'rain':
        if (this.t <= 0) { this.state = 'idle'; this.t = 0.8; this.cycles = (this.cycles || 0) + 1; }
        break;
      case 'hop':
        this.hopT += dt;
        if ((this.onGround && this.vy >= 0 && this.hopT > 0.2) || this.t <= 0) { this.state = 'idle'; this.t = rage ? 0.3 : 0.6; this.vx = 0; g.dust(this.cx, this.feet, 5); }
        break;
      case 'summon':
        if (this.t > 0.95) g.say(this, rage ? 'Wachen! Alle Mann zu mir!' : 'Wachen! Ergreift ihn!', 1.6);
        if (this.t <= 0) {
          const x0 = g.arena.x0 * TILE;
          for (const sx of [x0 + 2.5 * TILE, x0 + 27.5 * TILE]) {
            const s = new Soldier(sx, 4 * TILE);
            s.state = 'chase'; s.facing = sx < this.cx ? 1 : -1; s.alertT = 0.7; s.drop = 1;
            g.enemies.push(s);
          }
          Sound.play('alert');
          this.state = 'idle'; this.t = 0.8;
        }
        break;
      default: this.state = 'idle';
    }
  }
  onHurt(g) {
    if (this.hp === Math.ceil(this.maxHp / 2)) g.say(this, 'Genug gespielt, Hood!', 1.6);
  }
  drawBody(g, sx, sy, flash) { drawSheriff(g, this, sx, sy, flash); }
}

const ENEMY_TYPES = { s: Soldier, p: Spearman, x: Crossbowman, k: Knight, h: Hound, G: Gisborne, S: Sheriff };
