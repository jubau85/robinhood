'use strict';
// =====================================================================
//  game.js · Spielablauf, Menüs, Kamera, Darstellung
// =====================================================================

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const params = new URLSearchParams(location.search);
const ROMAN = ['I', 'II', 'III', 'IV'];

const Game = {
  state: 'boot', stateT: 0, t: 0,
  scale: 1,
  level: null, levelIdx: 0, art: null, backdrop: null,
  player: null,
  enemies: [], arrows: [], eprojs: [], pickups: [], particles: [], platforms: [],
  floaters: [], bubbles: [],
  checkpoints: [], signs: [], springs: [], targets: [], torches: [], peasants: [], doors: [], crates: [], crumbleCells: [], windows: [],
  exit: null, arena: null, boss: null, bossSpawn: null, bounds: null,
  cam: { x: 0, y: 0 }, camFeet: 0,
  shakeT: 0, shakeMag: 0, freezeT: 0, fade: 0, trans: null,
  score: 0, gold: 0, lives: 3, goldTotal: 0, chapterScore: 0,
  stats: { kills: 0, gold: 0, donated: 0, shots: 0, falls: 0 },
  menuSel: 0, menuRects: [],
  god: params.has('god'), debug: params.has('debug'),
  cutscene: false, clearing: false, clearT: 0, bossDown: null,
  banner: 0, shoutCool: 0, activeSign: null,
  levelTime: 0, tally: null,
  title: null,

  // -------------------------------------------------------------------
  init() {
    Save.load();
    Sound.setMuted(!!Save.data.muted);
    this.resize();
    window.addEventListener('resize', () => this.resize());
    Input.bindTouch(document.getElementById('touch'));
    canvas.addEventListener('pointerdown', (e) => this.onPointer(e));
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.state === 'play' && !this.trans) this.pause();
    });
    window.addEventListener('touchstart', () => document.body.classList.add('touch'), { passive: true, once: true });
    const [lc, lg] = makeCanvas(VIEW_W, VIEW_H);
    this.lightC = lc; this.lightG = lg;
    this.makeTitleScene();
    const start = () => {
      const lvl = parseInt(params.get('level'), 10);
      if (lvl >= 1 && lvl <= LEVELS.length) {
        this.newGame(lvl - 1, true);
        const x = parseInt(params.get('x'), 10);
        if (x > 0) this.warp(x);
        this.setState('play');
      } else this.setState('title');
      let last = performance.now(), acc = 0;
      const frame = (now) => {
        let dt = (now - last) / 1000;
        last = now;
        if (dt > 0.25) dt = 0.25;
        acc += dt;
        let steps = 0;
        while (acc >= STEP && steps < 8) { Input.poll(); this.update(STEP); acc -= STEP; steps++; }
        if (steps === 8) acc = 0;
        this.render();
        requestAnimationFrame(frame);
      };
      requestAnimationFrame(frame);
    };
    const fonts = document.fonts && document.fonts.load
      ? Promise.all([document.fonts.load(`16px ${FONT_BODY}`), document.fonts.load(`32px ${FONT_TITLE}`)])
      : Promise.resolve();
    Promise.race([fonts, new Promise((r) => setTimeout(r, 2500))]).catch(() => {}).then(start);
  },

  resize() {
    const ww = window.innerWidth, wh = window.innerHeight;
    const dpr = window.devicePixelRatio || 1;
    const fit = Math.min(ww / VIEW_W, wh / VIEW_H);
    const S = Math.max(1, Math.round(fit * dpr));
    this.scale = S;
    canvas.width = VIEW_W * S; canvas.height = VIEW_H * S;
    canvas.style.width = Math.floor(VIEW_W * fit) + 'px';
    canvas.style.height = Math.floor(VIEW_H * fit) + 'px';
    ctx.imageSmoothingEnabled = false;
  },

  onPointer(e) {
    Sound.init();
    const r = canvas.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * VIEW_W, y = ((e.clientY - r.top) / r.height) * VIEW_H;
    for (const m of this.menuRects) {
      if (x >= m.x && x <= m.x + m.w && y >= m.y && y <= m.y + m.h) {
        if (this.menuSel !== m.i) this.menuSel = m.i;
        this.pointerConfirm = true;
        return;
      }
    }
    if (['intro', 'clear', 'victory', 'controls'].includes(this.state)) Input.virtualPress('confirm');
  },

  setState(s) {
    this.state = s; this.stateT = 0; this.menuSel = 0;
    document.body.classList.toggle('playing', s === 'play');
    if (s === 'title' || s === 'chapters' || s === 'controls') Sound.playSong('title');
    if (s === 'play') Sound.playSong(this.arena && this.arena.active ? 'boss' : this.level.def.music);
    if (s === 'gameover' || s === 'clear' || s === 'victory') Sound.playSong(s === 'victory' ? 'village' : null);
    if (s === 'paused') Sound.duck(true); else Sound.duck(false);
  },

  go(fn) {
    if (this.trans) return;
    this.trans = { t: 0, phase: 'out', fn };
  },

  // -------------------------------------------------------------------
  newGame(idx, quick) {
    this.score = 0; this.lives = 3; this.gold = 0; this.goldTotal = 0;
    this.loadLevel(idx);
    if (!quick) this.setState('intro');
  },

  loadLevel(i) {
    const def = LEVELS[i];
    const lv = new Level(def, i);
    this.level = lv; this.levelIdx = i;
    this.art = renderLevelArt(lv);
    this.backdrop = makeBackdrop(def.theme);
    this.enemies = []; this.arrows = []; this.eprojs = []; this.pickups = []; this.particles = [];
    this.platforms = []; this.floaters = []; this.bubbles = [];
    this.checkpoints = []; this.signs = []; this.springs = []; this.targets = []; this.torches = [];
    this.peasants = []; this.doors = []; this.crates = []; this.crumbleCells = []; this.windows = [];
    this.exit = null; this.arena = null; this.boss = null; this.bossSpawn = null; this.bounds = null; this.bossDown = null;
    this.cutscene = false; this.clearing = false; this.clearT = 0;
    this.chapterScore = this.score;
    this.gold = 0;
    let start = { x: 40, y: 256 };
    let signIdx = 0, peasantIdx = 0;
    const spawns = lv.spawns.slice().sort((a, b) => a.cx - b.cx || a.cy - b.cy);
    for (const s of spawns) {
      const fx = s.cx * TILE + 8, fy = (s.cy + 1) * TILE, my = s.cy * TILE + 8;
      switch (s.ch) {
        case 'P': start = { x: fx, y: fy }; break;
        case 'C': this.checkpoints.push({ x: fx, y: fy, active: false, rise: 0 }); break;
        case 'E': this.exit = { x: fx, y: fy }; break;
        case 'i': this.signs.push({ x: fx, y: fy, text: def.signs[signIdx++] || '', near: false }); break;
        case 'o': this.pickups.push(new Pickup('coin', fx, my)); break;
        case '$': this.pickups.push(new Pickup('bag', fx, my)); break;
        case 'v': this.pickups.push(new Pickup('heart', fx, my)); break;
        case 'q': this.pickups.push(new Pickup('triple', fx, my)); break;
        case 'O': this.targets.push({ x: fx, y: my, hit: false, spin: 0, groundY: lv.groundBelow(s.cx, s.cy + 1) }); break;
        case 'T': this.springs.push({ x: fx, y: fy, squash: 0 }); break;
        case 't': this.torches.push({ x: fx, y: fy, seed: Math.random() * 10, onWall: lv.ch(s.cx, s.cy) === ':' }); break;
        case 'm': this.platforms.push(new MovingPlatform(s.cx * TILE, s.cy * TILE + 8, 1, 0)); break;
        case 'M': this.platforms.push(new MovingPlatform(s.cx * TILE, s.cy * TILE + 8, -1, 0)); break;
        case 'n': this.platforms.push(new MovingPlatform(s.cx * TILE, s.cy * TILE + 8, 0, -1)); break;
        case 'F': this.peasants.push(new Peasant(fx, fy, peasantIdx++)); break;
        case 'A': this.arena = { x0: s.cx, active: false, done: false }; break;
        default: {
          const C = ENEMY_TYPES[s.ch];
          if (C) {
            const e = new C(fx, fy);
            this.enemies.push(e);
            if (e.isBoss) { this.boss = e; this.bossSpawn = { C, fx, fy }; }
          }
        }
      }
    }
    for (let y = 0; y < lv.h; y++) for (let x = 0; x < lv.w; x++) {
      const ch = lv.chars[y][x];
      if (ch === 'X') this.crates.push({ cx: x, cy: y });
      else if (ch === '-') this.crumbleCells.push({ cx: x, cy: y });
      else if (ch === 'u' && THEMES[lv.theme].lights) this.windows.push({ x: x * TILE + 8, y: y * TILE + 8 });
      else if (ch === 'D' && lv.ch(x, y - 1) !== 'D') {
        let y1 = y;
        while (lv.ch(x, y1 + 1) === 'D') y1++;
        this.doors.push({ cx: x, cy0: y, cy1: y1, open: 0, opening: false });
      }
    }
    this.start = start;
    this.respawn = { x: start.x, y: start.y };
    this.player = new Player(start.x, start.y);
    this.levelTime = 0;
    this.stats = { kills: 0, gold: 0, donated: 0, shots: 0, falls: 0 };
    this.banner = 3.2;
    this.camFeet = start.y;
    this.snapCamera();
  },

  warp(col) {
    const lv = this.level;
    const fy = lv.groundBelow(col, 0);
    if (fy === null) return;
    const p = this.player;
    p.x = col * TILE + 3; p.y = fy - p.h;
    p.safe = { x: p.x, y: p.y };
    this.respawn = { x: col * TILE + 8, y: fy };
    this.camFeet = fy;
    this.snapCamera();
  },

  // -------------------------------------------------------------------
  //  Effekte
  // -------------------------------------------------------------------
  shake(m) { this.shakeMag = Math.max(this.shakeMag, m); this.shakeT = 0.25; },
  freeze(t) { this.freezeT = Math.max(this.freezeT, t); },
  dustColor() { return { forest: '#c9b896', village: '#dcc8a2', city: '#b4ac9c', castle: '#8a8fa8' }[this.level.theme]; },
  dust(x, y, n) {
    const c = this.dustColor();
    for (let i = 0; i < n; i++) this.particles.push({ x: x + rand(-4, 4), y: y - rand(0, 2), vx: rand(-30, 30), vy: rand(-40, -8), life: rand(0.25, 0.45), max: 0.45, c, s: randi(1, 2), gr: 50 });
  },
  sparkle(x, y, n, c) {
    for (let i = 0; i < n; i++) { const a = rand(0, Math.PI * 2), s = rand(20, 70); this.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rand(0.2, 0.45), max: 0.45, c: c || '#fff6b0', s: 1, gr: 0 }); }
  },
  burst(x, y, n, cols) {
    for (let i = 0; i < n; i++) { const a = rand(0, Math.PI * 2), s = rand(40, 130); this.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 40, life: rand(0.25, 0.5), max: 0.5, c: pick(cols), s: randi(1, 2), gr: 300 }); }
  },
  chips(x, y) {
    const c = this.level.theme === 'castle' || this.level.theme === 'city' ? '#9a9488' : '#8a6038';
    for (let i = 0; i < 3; i++) this.particles.push({ x, y, vx: rand(-60, 60), vy: rand(-90, -20), life: 0.35, max: 0.35, c, s: 1, gr: 500 });
  },
  sparks(x, y) {
    for (let i = 0; i < 6; i++) { const a = rand(0, Math.PI * 2), s = rand(60, 160); this.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rand(0.12, 0.25), max: 0.25, c: i % 2 ? '#ffffff' : '#ffd24a', s: 1, gr: 200 }); }
  },
  splash(x, y) {
    for (let i = 0; i < 14; i++) this.particles.push({ x: x + rand(-6, 6), y, vx: rand(-60, 60), vy: rand(-220, -80), life: rand(0.4, 0.7), max: 0.7, c: i % 3 ? '#9fd8ff' : '#ffffff', s: randi(1, 2), gr: 700 });
  },
  crumbleFx(cx, cy) {
    Sound.play('crumble');
    for (let i = 0; i < 7; i++) this.particles.push({ x: cx * TILE + rand(0, 16), y: cy * TILE + rand(0, 5), vx: rand(-30, 30), vy: rand(-40, 20), life: rand(0.5, 0.9), max: 0.9, c: pick(['#a06b36', '#7c5028', '#c4925a']), s: randi(1, 3), gr: 600 });
  },
  respawnFx(cx, cy) { this.sparkle(cx * TILE + 8, cy * TILE + 2, 4, '#ffffff'); },
  floatText(x, y, text, c) { this.floaters.push({ x, y, text, c: c || '#ffffff', life: 1.1 }); },

  say(owner, text, life) {
    this.bubbles = this.bubbles.filter((b) => b.owner !== owner);
    this.bubbles.push({ owner, text, life: life || 2, max: life || 2 });
  },
  shout(e) {
    if (this.shoutCool > 0 || Math.random() < 0.45) return;
    this.shoutCool = 3.5;
    this.say(e, pick(GUARD_SHOUTS), 1.6);
  },

  // -------------------------------------------------------------------
  //  Spiellogik
  // -------------------------------------------------------------------
  addScore(n) { this.score += n; },
  addGold(n, x, y) {
    const before = Math.floor(this.goldTotal / 50);
    this.gold += n; this.goldTotal += n; this.stats.gold += n;
    if (Math.floor(this.goldTotal / 50) > before) {
      this.lives++;
      Sound.play('oneup');
      this.floatText(x, y - 14, 'Extraleben!', '#8cff7a');
    }
  },
  collect(pk) {
    const p = this.player;
    if (pk.kind === 'coin') {
      this.addGold(1, pk.x, pk.y); this.addScore(10);
      Sound.play('coin'); this.sparkle(pk.x, pk.y, 4, '#fff3a0');
    } else if (pk.kind === 'bag') {
      this.addGold(10, pk.x, pk.y); this.addScore(100);
      Sound.play('bag'); this.sparkle(pk.x, pk.y, 10, '#fff3a0');
      this.floatText(pk.x, pk.y - 8, '+10 Gold', '#ffe27a');
    } else if (pk.kind === 'heart') {
      if (p.hp < p.maxHp) { p.hp++; this.floatText(pk.x, pk.y - 8, '+1 Herz', '#ff9a9a'); }
      else { this.addScore(250); this.floatText(pk.x, pk.y - 8, '+250', '#ff9a9a'); }
      Sound.play('heart'); this.sparkle(pk.x, pk.y, 8, '#ffb0b0');
    } else if (pk.kind === 'triple') {
      p.triple = 15;
      Sound.play('powerup'); this.sparkle(pk.x, pk.y, 12, '#ffe27a');
      this.floatText(pk.x, pk.y - 8, 'Dreifachpfeil!', '#ffe27a');
    }
  },
  donate(n) {
    const amt = this.gold;
    this.gold = 0;
    this.stats.donated += amt;
    const pts = amt * 20;
    this.addScore(pts);
    this.floatText(n.x, n.y - 34, `+${pts} Ruhm`, '#ffe27a');
    this.say(n, pick(THANK_LINES), 2.2);
    Sound.play('donate');
    const p = this.player;
    for (let i = 0; i < Math.min(14, 3 + amt); i++) {
      this.particles.push({ x: p.cx + rand(-4, 4), y: p.y + rand(0, 8), vx: rand(-40, 40), vy: rand(-120, -40), life: 0.7, max: 0.7, c: '#f6c945', s: 2, gr: 0, tx: n.x, ty: n.y - 14 });
    }
    if (p.hp < p.maxHp) { p.hp++; this.floatText(p.cx, p.y - 10, '+1 Herz', '#ff9a9a'); }
  },
  breakCrate(cx, cy) {
    if (this.level.get(cx, cy) !== T_CRATE) return;
    this.level.set(cx, cy, T_EMPTY);
    Sound.play('crate');
    for (let i = 0; i < 10; i++) this.particles.push({ x: cx * TILE + rand(2, 14), y: cy * TILE + rand(2, 14), vx: rand(-90, 90), vy: rand(-180, -40), life: rand(0.5, 0.9), max: 0.9, c: pick(['#8a5a2b', '#b07a40', '#5e3b19']), s: randi(2, 3), gr: 700 });
    const n = randi(2, 3);
    for (let i = 0; i < n; i++) {
      const pk = new Pickup(i === 0 && Math.random() < 0.18 ? 'heart' : 'coin', cx * TILE + 8, cy * TILE + 8, true);
      pk.vx = rand(-60, 60); pk.vy = rand(-220, -140);
      this.pickups.push(pk);
    }
    this.addScore(20);
  },
  hitTarget(o) {
    o.hit = true; o.spin = 0;
    Sound.play('target');
    this.addScore(200);
    this.floatText(o.x, o.y - 12, 'Treffer!', '#ffe27a');
    let any = false;
    for (const d of this.doors) {
      if (d.cx * TILE > o.x - 6 * TILE && d.cx * TILE < o.x + 30 * TILE && !d.opening) { d.opening = true; any = true; }
    }
    if (any) { setTimeout(() => Sound.play('door'), 150); this.shake(3); }
  },
  activateCheckpoint(c) {
    for (const o of this.checkpoints) if (o !== c && o.x < c.x) o.active = true;
    c.active = true; c.rise = 0;
    this.respawn = { x: c.x, y: c.y };
    const p = this.player;
    p.hp = p.maxHp;
    Sound.play('checkpoint');
    this.sparkle(c.x + 6, c.y - 28, 14, '#a8ff8a');
    this.floatText(c.x, c.y - 44, 'Rastplatz!', '#a8ff8a');
  },
  onEnemyDefeated(e, fell) {
    if (e.summoned && this.bossDown) return;
    this.stats.kills++;
    this.addScore(e.score);
    this.floatText(e.cx, e.y - 4, '+' + e.score, '#ffffff');
    if (!fell) {
      this.sparkle(e.cx, e.y + 4, 8, '#ffe27a');
      const n = e.type === 'knight' ? 3 : Math.random() < e.drop ? 1 : 0;
      for (let i = 0; i < n; i++) {
        const pk = new Pickup('coin', e.cx, e.y + 8, true);
        pk.vx = rand(-50, 50); pk.vy = rand(-230, -150);
        this.pickups.push(pk);
      }
    }
    if (e.isBoss) this.bossDefeated(e);
  },
  bossDefeated(e) {
    this.bossDown = { t: 0, e };
    this.arena.done = true;
    this.freeze(0.35);
    this.shake(8);
    Sound.playSong(null);
    for (const o of this.enemies) if (o !== e && !o.ko) { o.summoned = true; o.defeat(Math.sign(o.cx - e.cx) || 1, this); }
    this.eprojs = [];
    if (e.type === 'sheriff') {
      this.say(this.player, 'Das Gold gehört dem Volk!', 2.6);
      for (let i = 0; i < 24; i++) {
        const pk = new Pickup(i % 6 === 0 ? 'bag' : 'coin', e.cx + rand(-20, 20), e.y, true);
        pk.vx = rand(-140, 140); pk.vy = rand(-380, -160); pk.delay = 0.6; pk.life = 30;
        this.pickups.push(pk);
      }
    } else {
      this.say(this.player, 'Grüß den Sheriff von mir!', 2.4);
      for (let i = 0; i < 3; i++) {
        const pk = new Pickup('bag', e.cx, e.y, true);
        pk.vx = rand(-90, 90); pk.vy = rand(-300, -200); pk.delay = 0.6; pk.life = 30;
        this.pickups.push(pk);
      }
    }
  },

  playerFell(kind) {
    const p = this.player;
    if (p.dead) return;
    if (kind === 'water') {
      Sound.play('splash');
      this.splash(p.cx, p.y + p.h - 6);
    }
    this.stats.falls++;
    if (!this.god) p.hp -= 1;
    p.charging = false;
    if (p.hp <= 0) {
      p.die(this);
      p.deadT = 0.5;
      p.y = this.level.ph + 60;
      return;
    }
    Sound.play('hurt');
    this.fade = 1;
    p.x = p.safe.x; p.y = p.safe.y; p.vx = 0; p.vy = 0;
    p.inv = 1.6; p.hurtT = 0; p.platform = null; p.onGround = false;
    this.camFeet = p.y + p.h;
    this.snapCamera();
  },

  respawnAtCheckpoint() {
    const r = this.respawn;
    const p = new Player(r.x, r.y);
    p.inv = 1.6;
    this.player = p;
    this.arrows = []; this.eprojs = [];
    if (this.arena && this.arena.active && !this.arena.done) {
      this.arena.active = false; this.bounds = null;
      this.enemies = this.enemies.filter((e) => !e.isBoss && !e.summoned);
      const b = new this.bossSpawn.C(this.bossSpawn.fx, this.bossSpawn.fy);
      this.boss = b; this.enemies.push(b);
    }
    this.camFeet = r.y;
    this.snapCamera();
    this.fade = 1;
    this.setState('play');
  },

  pause() {
    if (this.state !== 'play') return;
    this.player.charging = false;
    this.setState('paused');
    Sound.play('select');
  },

  levelComplete() {
    if (this.clearing) return;
    this.clearing = true; this.clearT = 0; this.cutscene = true;
    Sound.playSong(null);
    Sound.play('fanfare');
    this.sparkle(this.player.cx, this.player.y, 20, '#ffe27a');
  },

  enterClear() {
    const def = this.level.def;
    const goldLeft = this.gold;
    const goldPts = goldLeft * 10;
    const timeBonus = Math.max(0, Math.round((def.par - this.levelTime) * 10));
    this.stats.donated += goldLeft;
    this.score += goldPts + timeBonus;
    this.gold = 0;
    const tm = Math.floor(this.levelTime);
    this.tally = {
      lines: [
        ['Wachen überlistet', String(this.stats.kills)],
        ['Gold gesammelt', String(this.stats.gold)],
        ['Restgold verteilt', `${goldLeft} × 10 = +${goldPts}`],
        ['Zeit', `${Math.floor(tm / 60)}:${String(tm % 60).padStart(2, '0')}  ·  Bonus +${timeBonus}`],
        ['Den Armen gegeben', `${this.stats.donated} Gold`],
      ],
      total: this.score,
    };
    Save.data.unlocked = Math.max(Save.data.unlocked || 1, Math.min(LEVELS.length, this.levelIdx + 2));
    Save.data.best = Math.max(Save.data.best || 0, this.score);
    Save.store();
    this.setState('clear');
  },

  // -------------------------------------------------------------------
  update(dt) {
    this.t += dt;
    this.stateT += dt;
    if (Input.pressed.mute) { Sound.setMuted(!Sound.muted); Save.data.muted = Sound.muted; Save.store(); }
    if (Input.pressed.fullscreen) this.toggleFullscreen();
    if (this.fade > 0) this.fade = Math.max(0, this.fade - dt * 3);
    if (this.trans) {
      const tr = this.trans;
      tr.t += dt;
      if (tr.phase === 'out' && tr.t >= 0.3) { tr.fn(); tr.phase = 'in'; tr.t = 0; }
      else if (tr.phase === 'in' && tr.t >= 0.3) this.trans = null;
      if (this.state === 'play' && tr.phase === 'out') this.updateFx(dt);
      return;
    }
    switch (this.state) {
      case 'title': this.updateTitle(dt); break;
      case 'chapters': this.updateChapters(); break;
      case 'controls': if (this.stateT > 0.2 && (Input.pressed.confirm || Input.pressed.back)) { Sound.play('select'); this.setState(this.controlsBack || 'title'); } break;
      case 'intro':
        if (this.stateT > 0.5 && Input.pressed.confirm) { Sound.play('confirm'); this.go(() => this.setState('play')); }
        break;
      case 'play': this.updatePlay(dt); break;
      case 'paused': this.updatePaused(); break;
      case 'clear':
        if (this.stateT > 2.4 && Input.pressed.confirm) {
          Sound.play('confirm');
          if (this.levelIdx < LEVELS.length - 1) this.go(() => { this.loadLevel(this.levelIdx + 1); this.setState('intro'); });
          else this.go(() => this.setState('victory'));
        } else if (this.stateT < 2.4) {
          const n = Math.floor(this.stateT / 0.4);
          if (n !== this.tallyTick && n <= 6) { this.tallyTick = n; Sound.play('tick'); }
        }
        break;
      case 'gameover': this.updateMenu(this.gameoverItems()); break;
      case 'victory':
        if (this.stateT > 3 && Input.pressed.confirm) { Sound.play('confirm'); this.go(() => this.setState('title')); }
        if (Math.random() < 0.3) this.titleLeaf();
        this.updateFx(dt);
        break;
      default: break;
    }
  },

  toggleFullscreen() {
    try {
      if (document.fullscreenElement) document.exitFullscreen();
      else document.documentElement.requestFullscreen();
    } catch (e) { /* nicht unterstützt */ }
  },

  titleItems() {
    const items = [
      { label: 'Neues Spiel', act: () => { Sound.play('confirm'); this.go(() => this.newGame(0)); } },
    ];
    if ((Save.data.unlocked || 1) > 1) items.push({ label: 'Kapitel wählen', act: () => { Sound.play('confirm'); this.setState('chapters'); } });
    items.push({ label: 'Steuerung', act: () => { Sound.play('confirm'); this.controlsBack = 'title'; this.setState('controls'); } });
    items.push({ label: () => 'Ton: ' + (Sound.muted ? 'aus' : 'an'), act: () => { Sound.setMuted(!Sound.muted); Save.data.muted = Sound.muted; Save.store(); Sound.play('select'); } });
    return items;
  },
  pauseItems() {
    return [
      { label: 'Weiter', act: () => { Sound.play('confirm'); this.setState('play'); } },
      { label: 'Kapitel neu starten', act: () => { Sound.play('confirm'); this.go(() => { this.score = this.chapterScore; this.loadLevel(this.levelIdx); this.setState('play'); }); } },
      { label: 'Steuerung', act: () => { Sound.play('confirm'); this.controlsBack = 'paused'; this.setState('controls'); } },
      { label: () => 'Ton: ' + (Sound.muted ? 'aus' : 'an'), act: () => { Sound.setMuted(!Sound.muted); Save.data.muted = Sound.muted; Save.store(); Sound.play('select'); } },
      { label: 'Zum Titelbild', act: () => { Sound.play('confirm'); this.go(() => this.setState('title')); } },
    ];
  },
  gameoverItems() {
    return [
      { label: 'Kapitel neu starten', act: () => { Sound.play('confirm'); this.go(() => { this.score = this.chapterScore; this.lives = 3; this.loadLevel(this.levelIdx); this.setState('intro'); }); } },
      { label: 'Zum Titelbild', act: () => { Sound.play('confirm'); this.go(() => this.setState('title')); } },
    ];
  },

  updateMenu(items) {
    if (Input.pressed.up) { this.menuSel = (this.menuSel + items.length - 1) % items.length; Sound.play('select'); }
    if (Input.pressed.down) { this.menuSel = (this.menuSel + 1) % items.length; Sound.play('select'); }
    if ((Input.pressed.confirm || this.pointerConfirm) && this.stateT > 0.15) {
      this.pointerConfirm = false;
      const it = items[this.menuSel];
      if (it) it.act();
    }
    this.pointerConfirm = false;
  },

  updateTitle(dt) {
    this.updateMenu(this.titleItems());
    const T = this.title;
    T.shotT -= dt;
    if (T.shotT <= 0) {
      if (!T.robin.charging) { T.robin.charging = true; T.robin.charge = 0; }
      T.robin.charge += dt;
      if (T.robin.charge > 0.9) {
        T.robin.charging = false; T.robin.aimT = 0.4; T.shotT = rand(2.5, 4);
        T.arrows.push({ x: T.robin.cx + 8, y: T.robin.y + 7, vx: 420, vy: -40 });
      }
    }
    if (T.robin.aimT > 0) T.robin.aimT -= dt;
    T.robin.animT += dt;
    for (const a of T.arrows) { a.vy += 60 * dt; a.x += a.vx * dt; a.y += a.vy * dt; }
    T.arrows = T.arrows.filter((a) => a.x < VIEW_W + 20);
    if (Math.random() < 0.08) this.titleLeaf();
    this.updateFx(dt);
  },

  titleLeaf() {
    this.particles.push({ x: rand(0, VIEW_W + 60), y: -4, vx: rand(-30, -10), vy: rand(14, 28), life: 9, max: 9, c: pick(['#5fae3e', '#86d25a', '#d8a838', '#c86a2a']), s: 2, gr: 0, leaf: rand(0, 6), screen: true });
  },

  updateChapters() {
    const n = LEVELS.length;
    const un = Save.data.unlocked || 1;
    if (Input.pressed.up) { this.menuSel = (this.menuSel + n - 1) % n; Sound.play('select'); }
    if (Input.pressed.down) { this.menuSel = (this.menuSel + 1) % n; Sound.play('select'); }
    if (Input.pressed.back && this.stateT > 0.15) { Sound.play('select'); this.setState('title'); return; }
    if ((Input.pressed.confirm || this.pointerConfirm) && this.stateT > 0.15) {
      this.pointerConfirm = false;
      if (this.menuSel < un) { Sound.play('confirm'); const i = this.menuSel; this.go(() => this.newGame(i)); }
      else Sound.play('hurt');
    }
    this.pointerConfirm = false;
  },

  updatePaused() {
    if (Input.pressed.pause && this.stateT > 0.1) { Sound.play('select'); this.setState('play'); return; }
    this.updateMenu(this.pauseItems());
  },

  updatePlay(dt) {
    if (this.freezeT > 0) { this.freezeT -= dt; this.updateCameraShake(dt); return; }
    if (Input.pressed.pause && !this.clearing) { this.pause(); return; }
    const lv = this.level;
    this.levelTime += dt;
    if (this.banner > 0) this.banner -= dt;
    if (this.shoutCool > 0) this.shoutCool -= dt;
    for (const p of this.platforms) p.update(dt);
    lv.updateCrumbles(dt, this);
    this.player.update(dt, this);
    this.updateArena();
    for (const e of this.enemies) e.update(dt, this);
    this.collidePlayerEnemies();
    for (const a of this.arrows) a.update(dt, this);
    this.collideArrows();
    for (const p of this.eprojs) p.update(dt, this);
    this.collideEProjs();
    for (const p of this.pickups) p.update(dt, this);
    this.updateProps(dt);
    this.updateFx(dt);
    this.enemies = this.enemies.filter((e) => !e.dead);
    this.arrows = this.arrows.filter((a) => !a.dead);
    this.eprojs = this.eprojs.filter((p) => !p.dead);
    this.pickups = this.pickups.filter((p) => !p.dead);
    this.updateCamera(dt);
    this.updateCameraShake(dt);
    const p = this.player;
    if (p.dead && p.deadT > 1.9 && !p.handled) {
      p.handled = true;
      this.lives--;
      if (this.lives <= 0) this.go(() => this.setState('gameover'));
      else this.go(() => this.respawnAtCheckpoint());
    }
    if (this.clearing) {
      this.clearT += dt;
      p.vx = 0;
      if (this.clearT > 1.5) this.go(() => this.enterClear());
    }
    if (this.bossDown) {
      this.bossDown.t += dt;
      if (this.bossDown.t > 4.2 && !this.clearing) this.levelComplete();
    }
  },

  updateArena() {
    const A = this.arena;
    if (!A || A.done || A.active) return;
    const p = this.player;
    if (!p.dead && p.x > A.x0 * TILE + 44) {
      A.active = true;
      this.bounds = { x0: A.x0 * TILE, x1: A.x0 * TILE + VIEW_W };
      if (this.boss) this.boss.activate(this);
      Sound.playSong('boss');
      this.shake(3);
    }
  },

  collidePlayerEnemies() {
    const p = this.player;
    if (p.dead) return;
    for (const e of this.enemies) {
      if (e.ko || e.dead || !overlap(p, e)) continue;
      const prevBottom = p.prevY + p.h;
      if (e.stompable && p.vy > 30 && prevBottom <= e.y + 9) {
        const dmg = e.isBoss || e.heavy ? 1 : 2;
        const res = e.hurt(dmg, p.facing, this, 'stomp');
        p.y = e.y - p.h;
        p.vy = Input.down.jump ? -470 : -320;
        p.jumping = Input.down.jump;
        if (res !== 'none') {
          p.combo++;
          Sound.play('stomp');
          this.burst(p.cx, p.y + p.h, 6, ['#ffffff', '#ffe27a']);
          if (p.combo > 1) {
            const bonus = Math.min(800, 50 * Math.pow(2, p.combo - 1));
            this.addScore(bonus);
            this.floatText(p.cx, p.y - 6, `Kombo +${bonus}`, '#ffe27a');
          }
        }
      } else if (e.contact) {
        p.hurt(1, Math.sign(p.cx - e.cx) || -e.facing, this);
      }
    }
  },

  collideArrows() {
    for (const a of this.arrows) {
      if (a.dead || a.stuck || a.harmless) continue;
      for (const o of this.targets) {
        if (!o.hit && Math.abs(a.x - o.x) < 7 && Math.abs(a.y - o.y) < 8) {
          this.hitTarget(o);
          a.stuck = true; a.life = 1.5; a.vx = a.vy = 0;
        }
      }
      if (a.stuck) continue;
      for (const p of this.eprojs) {
        if (p.dead || p.kind === 'wave' || p.stuck > 0) continue;
        if (Math.abs(a.x - p.x) < 7 && Math.abs(a.y - p.y) < 7) {
          p.dead = true;
          if (!a.power) a.dead = true;
          this.sparks(p.x, p.y);
          Sound.play('clang');
          this.addScore(10);
        }
      }
      if (a.dead) continue;
      for (const e of this.enemies) {
        if (e.ko || e.dead || a.hits.has(e)) continue;
        if (a.x >= e.x - 2 && a.x <= e.x + e.w + 2 && a.y >= e.y - 4 && a.y <= e.y + e.h) {
          const dir = Math.sign(a.vx) || 1;
          const res = e.hurt(a.dmg, dir, this, a.power ? 'power' : 'arrow');
          if (res === 'none') continue;
          if (res === 'block') {
            a.harmless = true; a.vx = -a.vx * 0.25; a.vy = -170; a.grav = 900; a.life = 0.8;
            break;
          }
          a.hits.add(e);
          this.burst(a.x, a.y, 5, ['#ffffff', '#ffd0a0']);
          if (a.power) { this.freeze(0.04); this.shake(2); }
          if (a.pierce > 0) a.pierce--; else { a.dead = true; break; }
        }
      }
    }
  },

  collideEProjs() {
    const p = this.player;
    if (p.dead) return;
    for (const e of this.eprojs) {
      if (e.dead || e.stuck > 0) continue;
      if (overlap(e.box, p) && p.hurt(1, Math.sign(e.vx) || 1, this) && e.kind !== 'wave') e.dead = true;
    }
  },

  updateProps(dt) {
    const p = this.player;
    const feet = p.y + p.h;
    for (const c of this.checkpoints) {
      if (c.active) c.rise += dt * 2.5;
      else if (!p.dead && Math.abs(p.cx - c.x) < 12 && feet > c.y - 40 && feet <= c.y + 2) this.activateCheckpoint(c);
    }
    this.activeSign = null;
    for (const s of this.signs) {
      s.near = !p.dead && Math.abs(p.cx - s.x) < 18 && Math.abs(feet - s.y) < 28;
      if (s.near) this.activeSign = s;
    }
    for (const s of this.springs) {
      s.squash = Math.max(0, s.squash - dt * 5);
      if (!p.dead && p.vy > 0 && Math.abs(p.cx - s.x) < 12 && feet >= s.y - 12 && p.prevY + p.h <= s.y - 7) {
        p.vy = -(Input.down.jump ? PHYS.spring + 70 : PHYS.spring);
        p.jumping = false; p.onGround = false; p.platform = null;
        p.y = s.y - 12 - p.h;
        s.squash = 1;
        Sound.play('spring');
        this.dust(s.x, s.y - 8, 6);
      }
    }
    for (const n of this.peasants) n.update(dt, this);
    for (const d of this.doors) {
      if (!d.opening || d.open >= 1) continue;
      d.open = Math.min(1, d.open + dt / 1.3);
      if (d.open > 0.55 && !d.cleared) {
        d.cleared = true;
        for (let y = d.cy0; y <= d.cy1; y++) this.level.set(d.cx, y, T_EMPTY);
      }
    }
    for (const o of this.targets) if (o.hit) o.spin += dt;
    if (this.exit && !p.dead && !this.clearing) {
      const ex = this.exit;
      if (Math.abs(p.cx - ex.x) < 14 && feet > ex.y - 50 && feet <= ex.y + 2) this.levelComplete();
    }
    for (const t of this.torches) {
      if (Math.random() < 0.06 && Math.abs(t.x - this.cam.x - VIEW_W / 2) < VIEW_W) {
        this.particles.push({ x: t.x + rand(-2, 2), y: t.y - 26, vx: rand(-8, 8), vy: rand(-40, -20), life: rand(0.5, 1), max: 1, c: pick(['#ffa63a', '#ffd06a', '#e2581e']), s: 1, gr: -10 });
      }
    }
    const th = this.level.theme;
    if (th === 'forest' && Math.random() < 0.05) this.particles.push({ x: this.cam.x + rand(0, VIEW_W + 80), y: this.cam.y - 4, vx: rand(-25, -8), vy: rand(12, 24), life: 10, max: 10, c: pick(['#5fae3e', '#86d25a', '#d8a838']), s: 2, gr: 0, leaf: rand(0, 6) });
    else if (th === 'village' && Math.random() < 0.03) this.particles.push({ x: this.cam.x + rand(0, VIEW_W + 80), y: this.cam.y + rand(20, 160), vx: rand(-20, -8), vy: rand(-6, 6), life: 8, max: 8, c: '#fff8e8', s: 1, gr: 0, leaf: rand(0, 6) });
    else if (th === 'castle' && Math.random() < 0.02) this.particles.push({ x: this.cam.x + rand(0, VIEW_W), y: this.cam.y + VIEW_H + 4, vx: rand(-6, 6), vy: rand(-20, -10), life: 9, max: 9, c: '#6a7aff', s: 1, gr: 0, leaf: rand(0, 6), glow: true });
  },

  updateFx(dt) {
    for (const q of this.particles) {
      q.life -= dt;
      if (q.tx !== undefined) {
        const k = 1 - q.life / q.max;
        q.x += (q.tx - q.x) * Math.min(1, dt * (3 + k * 10));
        q.y += (q.ty - q.y) * Math.min(1, dt * (3 + k * 10)) + q.vy * dt * (1 - k);
        continue;
      }
      q.vy += q.gr * dt;
      if (q.leaf !== undefined) { q.leaf += dt * 2.5; q.x += (q.vx + Math.sin(q.leaf) * 18) * dt; } else q.x += q.vx * dt;
      q.y += q.vy * dt;
    }
    this.particles = this.particles.filter((q) => q.life > 0 && (q.screen ? q.y < VIEW_H + 10 : true));
    if (this.particles.length > 600) this.particles.splice(0, this.particles.length - 600);
    for (const f of this.floaters) { f.life -= dt; f.y -= dt * 22; }
    this.floaters = this.floaters.filter((f) => f.life > 0);
    for (const b of this.bubbles) b.life -= dt;
    this.bubbles = this.bubbles.filter((b) => b.life > 0 && !(b.owner.ko && !b.owner.isBoss) && !b.owner.dead);
  },

  snapCamera() { this.updateCamera(0, true); },

  updateCamera(dt, snap) {
    const p = this.player, lv = this.level;
    if (!p) return;
    if (!p.dead && (p.onGround || p.y + p.h > this.camFeet)) this.camFeet = p.y + p.h;
    let tx = p.cx - VIEW_W / 2 + p.facing * 34;
    let ty = this.camFeet - VIEW_H * 0.64;
    if (p.y - 40 < ty) ty = p.y - 40;
    let minX = 0, maxX = lv.pw - VIEW_W;
    if (this.arena && this.arena.active) minX = maxX = this.arena.x0 * TILE;
    tx = clamp(tx, minX, maxX);
    ty = clamp(ty, 0, lv.ph - VIEW_H);
    if (snap) { this.cam.x = tx; this.cam.y = ty; return; }
    this.cam.x += (tx - this.cam.x) * Math.min(1, dt * 6);
    this.cam.y += (ty - this.cam.y) * Math.min(1, dt * 5);
    if (p.cx - this.cam.x > VIEW_W - 60) this.cam.x = Math.min(maxX, p.cx - (VIEW_W - 60));
    if (p.cx - this.cam.x < 60) this.cam.x = Math.max(minX, p.cx - 60);
  },

  updateCameraShake(dt) {
    if (this.shakeT > 0) { this.shakeT -= dt; if (this.shakeT <= 0) this.shakeMag = 0; }
  },

  // -------------------------------------------------------------------
  //  Darstellung
  // -------------------------------------------------------------------
  render() {
    const g = ctx;
    g.setTransform(this.scale, 0, 0, this.scale, 0, 0);
    g.imageSmoothingEnabled = false;
    this.menuRects = [];
    switch (this.state) {
      case 'boot': fr(g, '#0d0b08', 0, 0, VIEW_W, VIEW_H); break;
      case 'title': this.renderTitle(g); break;
      case 'chapters': this.renderTitleBg(g, true); this.renderChapters(g); break;
      case 'controls':
        if (this.controlsBack === 'paused' && this.level) this.renderWorld(g); else this.renderTitleBg(g, true);
        this.renderControls(g);
        break;
      case 'intro': this.renderWorld(g); this.renderIntro(g); break;
      case 'play': this.renderWorld(g); this.renderHUD(g); break;
      case 'paused': this.renderWorld(g); this.renderHUD(g); this.renderPause(g); break;
      case 'clear': this.renderWorld(g); this.renderClear(g); break;
      case 'gameover': this.renderWorld(g); this.renderGameOver(g); break;
      case 'victory': this.renderVictory(g); break;
      default: break;
    }
    if (this.fade > 0) { g.globalAlpha = this.fade; fr(g, '#000', 0, 0, VIEW_W, VIEW_H); g.globalAlpha = 1; }
    if (this.trans) {
      const tr = this.trans;
      const a = tr.phase === 'out' ? tr.t / 0.3 : 1 - tr.t / 0.3;
      g.globalAlpha = clamp(a, 0, 1); fr(g, '#0b0806', 0, 0, VIEW_W, VIEW_H); g.globalAlpha = 1;
    }
  },

  camView() {
    let sx = 0, sy = 0;
    if (this.shakeMag > 0) { sx = rand(-1, 1) * this.shakeMag; sy = rand(-1, 1) * this.shakeMag; }
    return { x: Math.round(this.cam.x + sx), y: Math.round(this.cam.y + sy) };
  },

  renderWorld(g) {
    const lv = this.level;
    const cam = this.camView();
    const t = this.t;
    drawBackdrop(g, this.backdrop, cam.x, cam.y, t);
    const sx = clamp(cam.x, 0, this.art.width - 1), sy = clamp(cam.y, 0, this.art.height - 1);
    const w = Math.min(VIEW_W - (sx - cam.x), this.art.width - sx), h = Math.min(VIEW_H - (sy - cam.y), this.art.height - sy);
    if (w > 0 && h > 0) g.drawImage(this.art, sx, sy, w, h, sx - cam.x, sy - cam.y, w, h);
    const vis = (x, m) => x > cam.x - (m || 40) && x < cam.x + VIEW_W + (m || 40);
    const T = THEMES[lv.theme];
    for (const o of this.torches) if (vis(o.x)) drawTorch(g, o.x - cam.x, o.y - cam.y, t, o.seed, o.onWall);
    for (const c of this.checkpoints) if (vis(c.x)) drawCheckpoint(g, c, c.x - cam.x, c.y - cam.y, t);
    for (const s of this.signs) if (vis(s.x)) drawSignPost(g, s.x - cam.x, s.y - cam.y, s.near);
    if (this.exit && vis(this.exit.x, 60)) drawExitFlag(g, this.exit.x - cam.x, this.exit.y - cam.y, t);
    for (const o of this.targets) if (vis(o.x)) drawTarget(g, o, o.x - cam.x, o.y - cam.y, cam.y);
    for (const d of this.doors) if (vis(d.cx * TILE) && d.open < 1) drawDoor(g, lv.theme, d.cx * TILE - cam.x, d.cy0 * TILE - cam.y, (d.cy1 - d.cy0 + 1) * TILE, d.open);
    for (const c of this.crates) if (lv.get(c.cx, c.cy) === T_CRATE && vis(c.cx * TILE)) drawCrate(g, c.cx * TILE - cam.x, c.cy * TILE - cam.y);
    for (const c of this.crumbleCells) {
      if (lv.get(c.cx, c.cy) !== T_CRUMBLE || !vis(c.cx * TILE)) continue;
      const cr = lv.crumbles.get(c.cy * lv.w + c.cx);
      drawCrumble(g, T, c.cx * TILE - cam.x, c.cy * TILE - cam.y, cr && !cr.broken);
    }
    for (const s of this.springs) if (vis(s.x)) drawSpring(g, lv.theme, s.x - cam.x, s.y - cam.y, s.squash);
    for (const p of this.platforms) if (vis(p.x, 80)) drawPlatform(g, lv.theme, p, p.x - cam.x, p.y - cam.y, t);
    for (const p of this.pickups) if (vis(p.x)) p.draw(g, cam, t);
    for (const n of this.peasants) if (vis(n.x)) n.draw(g, cam);
    for (const e of this.enemies) if (vis(e.x, 60)) e.draw(g, cam);
    this.player.draw(g, cam);
    for (const a of this.arrows) a.draw(g, cam);
    for (const p of this.eprojs) p.draw(g, cam);
    drawWaterTiles(g, lv, cam, t);
    for (const q of this.particles) {
      const x = q.screen ? q.x : q.x - cam.x, y = q.screen ? q.y : q.y - cam.y;
      if (x < -4 || x > VIEW_W + 4 || y < -4 || y > VIEW_H + 4) continue;
      g.globalAlpha = q.leaf !== undefined ? Math.min(1, q.life) : clamp((q.life / q.max) * 1.6, 0, 1);
      g.fillStyle = q.c;
      g.fillRect(Math.round(x), Math.round(y), q.s, q.leaf !== undefined && q.s > 1 ? 1 : q.s);
      if (q.leaf !== undefined && q.s > 1) g.fillRect(Math.round(x) + (Math.sin(q.leaf) > 0 ? 1 : 0), Math.round(y) + 1, 1, 1);
    }
    g.globalAlpha = 1;
    this.renderLighting(g, cam);
    if (this.arena && this.arena.active && !this.arena.done) {
      const gx = this.arena.x0 * TILE - cam.x;
      const fy = lv.groundBelow(this.arena.x0, 8);
      if (fy !== null) drawDoor(g, lv.theme, gx, fy - 48 - cam.y, 48, 0);
    }
    for (const f of this.floaters) {
      g.globalAlpha = clamp(f.life * 2, 0, 1);
      txt(g, f.text, Math.round(f.x - cam.x), Math.round(f.y - cam.y), { size: 8, align: 'center', color: f.c, outline: OUTLINE, weight: 600 });
    }
    g.globalAlpha = 1;
    for (const b of this.bubbles) this.renderBubble(g, b, cam);
    if (this.debug) {
      g.strokeStyle = '#ff00ff'; g.lineWidth = 1;
      const p = this.player;
      g.strokeRect(p.x - cam.x + 0.5, p.y - cam.y + 0.5, p.w, p.h);
      for (const e of this.enemies) g.strokeRect(e.x - cam.x + 0.5, e.y - cam.y + 0.5, e.w, e.h);
    }
  },

  renderLighting(g, cam) {
    const T = THEMES[this.level.theme];
    if (!T.darkness) return;
    const L = this.lightG;
    L.globalCompositeOperation = 'source-over';
    L.clearRect(0, 0, VIEW_W, VIEW_H);
    L.globalAlpha = T.darkness;
    L.fillStyle = T.darkColor;
    L.fillRect(0, 0, VIEW_W, VIEW_H);
    L.globalAlpha = 1;
    L.globalCompositeOperation = 'destination-out';
    const lights = [];
    const p = this.player;
    lights.push([p.cx - cam.x, p.cy - cam.y, 110, 0.9]);
    for (const o of this.torches) {
      const x = o.x - cam.x, y = o.y - 24 - cam.y;
      if (x > -100 && x < VIEW_W + 100) lights.push([x, y, 78 + Math.sin(this.t * 9 + o.seed) * 4, 1]);
    }
    for (const w of this.windows) {
      const x = w.x - cam.x, y = w.y - cam.y;
      if (x > -60 && x < VIEW_W + 60) lights.push([x, y, 34, 0.7]);
    }
    for (const a of this.arrows) if (a.power && !a.stuck) lights.push([a.x - cam.x, a.y - cam.y, 30, 0.6]);
    for (const e of this.enemies) {
      const x = e.cx - cam.x, y = e.cy - cam.y;
      if (!e.ko && x > -40 && x < VIEW_W + 40) lights.push([x, y, e.isBoss ? 56 : 38, e.isBoss ? 0.7 : 0.5]);
    }
    for (const n of this.peasants) lights.push([n.x - cam.x, n.y - 12 - cam.y, 30, 0.4]);
    if (this.exit) lights.push([this.exit.x - cam.x + 10, this.exit.y - 30 - cam.y, 60, 0.7]);
    for (const c of this.checkpoints) if (c.active) lights.push([c.x - cam.x + 6, c.y - 30 - cam.y, 40, 0.5]);
    for (const [x, y, r, a] of lights) {
      const grd = L.createRadialGradient(x, y, 0, x, y, r);
      grd.addColorStop(0, `rgba(0,0,0,${a})`);
      grd.addColorStop(0.55, `rgba(0,0,0,${a * 0.6})`);
      grd.addColorStop(1, 'rgba(0,0,0,0)');
      L.fillStyle = grd;
      L.fillRect(x - r, y - r, r * 2, r * 2);
    }
    L.globalCompositeOperation = 'source-over';
    g.drawImage(this.lightC, 0, 0);
    g.globalCompositeOperation = 'lighter';
    for (const o of this.torches) {
      const x = o.x - cam.x, y = o.y - 24 - cam.y;
      if (x < -80 || x > VIEW_W + 80) continue;
      const r = 46 + Math.sin(this.t * 11 + o.seed) * 3;
      const grd = g.createRadialGradient(x, y, 0, x, y, r);
      grd.addColorStop(0, 'rgba(255,150,60,0.28)');
      grd.addColorStop(1, 'rgba(255,120,40,0)');
      g.fillStyle = grd;
      g.fillRect(x - r, y - r, r * 2, r * 2);
    }
    g.globalCompositeOperation = 'source-over';
  },

  renderBubble(g, b, cam) {
    const o = b.owner;
    let x, y;
    if (o instanceof Peasant) { x = o.x; y = o.y - 30; }
    else if (o instanceof Player) { x = o.cx; y = o.y - 12; }
    else { x = o.cx; y = o.y - 10; }
    x -= cam.x; y -= cam.y;
    const lines = wrapText(g, b.text, 130, 8);
    g.font = `400 8px ${FONT_BODY}`;
    let w = 0;
    for (const l of lines) w = Math.max(w, g.measureText(l).width);
    w = Math.ceil(w) + 10;
    const h = lines.length * 10 + 6;
    let bx = Math.round(clamp(x - w / 2, 4, VIEW_W - w - 4));
    let by = Math.round(clamp(y - h - 6, 4, VIEW_H - h - 10));
    g.globalAlpha = Math.min(1, b.life * 4);
    fr(g, OUTLINE, bx - 1, by, w + 2, h); fr(g, OUTLINE, bx, by - 1, w, h + 2);
    fr(g, '#fffaf0', bx, by, w, h);
    const tx = Math.round(clamp(x, bx + 4, bx + w - 4));
    fr(g, OUTLINE, tx - 3, by + h, 7, 2); fr(g, OUTLINE, tx - 2, by + h + 2, 5, 2); fr(g, OUTLINE, tx - 1, by + h + 4, 3, 1);
    fr(g, '#fffaf0', tx - 2, by + h - 1, 5, 2); fr(g, '#fffaf0', tx - 1, by + h + 1, 3, 2);
    lines.forEach((l, i) => txt(g, l, bx + 5, by + 3 + i * 10, { size: 8, color: '#2a1a10', shadow: false }));
    g.globalAlpha = 1;
  },

  renderHUD(g) {
    const p = this.player;
    for (let i = 0; i < p.maxHp; i++) drawHeartIcon(g, 9 + i * 11, 9, i < p.hp);
    drawRobinHead(g, 13, 22);
    txt(g, '× ' + this.lives, 22, 22, { size: 8, outline: OUTLINE, weight: 600 });
    drawCoinAt(g, VIEW_W - 70, 14, this.t * 0.6);
    txt(g, String(this.gold), VIEW_W - 62, 8, { size: 10, outline: OUTLINE, weight: 600, color: '#ffe27a' });
    txt(g, 'Ruhm ' + String(this.score).padStart(6, '0'), VIEW_W - 8, 22, { size: 8, align: 'right', outline: OUTLINE });
    if (p.triple > 0) {
      drawQuiverPickup(g, 46, 24, this.t);
      fr(g, OUTLINE, 54, 18, 32, 5); fr(g, '#ffd24a', 55, 19, Math.round(30 * p.triple / 15), 3);
    }
    if (this.banner > 0) {
      const a = clamp(this.banner, 0, 1) * clamp((3.2 - this.banner) * 3, 0, 1);
      g.globalAlpha = a;
      const def = this.level.def;
      txt(g, def.chapter, VIEW_W / 2, 34, { size: 10, align: 'center', outline: OUTLINE, color: '#f0c24a' });
      txt(g, def.name, VIEW_W / 2, 46, { size: 26, align: 'center', font: FONT_TITLE, outline: OUTLINE, color: '#fff6e0' });
      g.globalAlpha = 1;
    }
    if (this.activeSign && this.activeSign.text) {
      const lines = wrapText(g, this.activeSign.text, 300, 8);
      const h = lines.length * 11 + 10, w = 320;
      const x = (VIEW_W - w) / 2, y = 38;
      panel(g, x, y, w, h, 'parchment');
      lines.forEach((l, i) => txt(g, l, VIEW_W / 2, y + 6 + i * 11, { size: 8, align: 'center', color: '#3a2414', shadow: false }));
    }
    const b = this.boss;
    if (b && this.arena && this.arena.active && !this.arena.done) {
      const w = 200, x = (VIEW_W - w) / 2, y = 22;
      txt(g, b.name, VIEW_W / 2, y - 13, { size: 8, align: 'center', outline: OUTLINE, color: '#ffd0c0', weight: 600 });
      fr(g, OUTLINE, x - 2, y - 2, w + 4, 9);
      fr(g, '#3a1a1a', x, y, w, 5);
      const k = clamp(b.hp / b.maxHp, 0, 1);
      fr(g, '#c8343a', x, y, Math.round(w * k), 5);
      fr(g, '#ff7a6a', x, y, Math.round(w * k), 1);
    }
  },

  // ------------------------------- Menüs -----------------------------
  renderMenu(g, items, x, y, gap, size) {
    items.forEach((it, i) => {
      const label = typeof it.label === 'function' ? it.label() : it.label;
      const sel = i === this.menuSel;
      g.font = `600 ${size}px ${FONT_BODY}`;
      const w = g.measureText(label).width;
      const yy = y + i * gap;
      if (sel) {
        const ax = Math.round(x - w / 2 - 14 + Math.sin(this.t * 6) * 1.5);
        drawArrowIcon(g, ax, yy + size / 2);
        drawArrowIcon(g, Math.round(x + w / 2 + 14 - Math.sin(this.t * 6) * 1.5), yy + size / 2, true);
      }
      txt(g, label, x, yy, { size, align: 'center', weight: 600, color: sel ? '#ffe27a' : '#efe4cc', outline: OUTLINE });
      this.menuRects.push({ x: x - w / 2 - 20, y: yy - 3, w: w + 40, h: size + 6, i });
    });
  },

  makeTitleScene() {
    const def = {
      id: 'title', theme: 'forest',
      chunks: [`
.....yyyyyyyy...................
...yyyyyyyyyyyy.................
..yyyyyyyyyyyyyy................
...yyyyyyyyyyyy.................
......YY........................
......YY........................
......YY........................
......YY........................
......YY........................
################################
################################
################################
`],
    };
    const lv = new Level(def, -1);
    const robin = new Player(150, 222);
    robin.onGround = true;
    this.title = { lv, art: renderLevelArt(lv), bd: makeBackdrop('forest'), robin, shotT: 2, arrows: [] };
  },

  renderTitleBg(g, dim) {
    const T = this.title;
    const camX = this.t * 14;
    drawBackdrop(g, T.bd, camX, 40, this.t);
    g.drawImage(T.art, 0, 50, VIEW_W, VIEW_H, 0, 0, VIEW_W, VIEW_H);
    if (dim) { g.globalAlpha = 0.55; fr(g, '#0d0a07', 0, 0, VIEW_W, VIEW_H); g.globalAlpha = 1; }
  },

  renderTitle(g) {
    const T = this.title;
    this.renderTitleBg(g, false);
    const r = T.robin;
    drawRobin(g, r, Math.round(r.cx), r.y + r.h, null);
    for (const a of T.arrows) {
      const ang = Math.atan2(a.vy, a.vx);
      for (let i = 0; i < 12; i++) { fr(g, i < 2 ? '#d6dde4' : '#e2c088', Math.round(a.x - Math.cos(ang) * i), Math.round(a.y - Math.sin(ang) * i), 1, 1); }
    }
    for (const q of this.particles) {
      if (!q.screen) continue;
      g.globalAlpha = Math.min(1, q.life);
      fr(g, q.c, Math.round(q.x), Math.round(q.y), 2, 1);
    }
    g.globalAlpha = 1;
    const grd = g.createLinearGradient(0, 0, 0, 120);
    grd.addColorStop(0, 'rgba(10,8,6,0.65)'); grd.addColorStop(1, 'rgba(10,8,6,0)');
    g.fillStyle = grd; g.fillRect(0, 0, VIEW_W, 120);
    const bob = Math.round(Math.sin(this.t * 1.5) * 1.5);
    txt(g, 'Robin Hood', VIEW_W / 2 + 40, 14 + bob, { size: 54, align: 'center', font: FONT_TITLE, color: '#f0c24a', outline: '#2a1608' });
    txt(g, 'Die Legende von Sherwood', VIEW_W / 2 + 40, 74, { size: 10, align: 'center', color: '#f6ead0', outline: OUTLINE, weight: 600 });
    const items = this.titleItems();
    panel(g, VIEW_W / 2 - 20, 96, 160, items.length * 20 + 16, 'dark');
    this.renderMenu(g, items, VIEW_W / 2 + 60, 108, 20, 10);
    if (Save.data.best) txt(g, 'Bester Ruhm: ' + Save.data.best, VIEW_W - 8, VIEW_H - 12, { size: 8, align: 'right', outline: OUTLINE, color: '#ffe27a' });
    txt(g, Input.device === 'touch' ? 'Tippen zum Auswählen' : '↑ ↓ wählen  ·  Enter/Leertaste bestätigen  ·  M Ton  ·  F Vollbild', 8, VIEW_H - 12, { size: 8, outline: OUTLINE, color: '#d8ccb0' });
  },

  renderChapters(g) {
    txt(g, 'Kapitel wählen', VIEW_W / 2, 18, { size: 30, align: 'center', font: FONT_TITLE, color: '#f0c24a', outline: '#2a1608' });
    const un = Save.data.unlocked || 1;
    LEVELS.forEach((L, i) => {
      const y = 70 + i * 40, x = VIEW_W / 2 - 150, w = 300, h = 32;
      const sel = i === this.menuSel, open = i < un;
      panel(g, x, y, w, h, 'dark');
      if (sel) { fr(g, '#f0c24a', x, y, w, 1); fr(g, '#f0c24a', x, y + h - 1, w, 1); }
      txt(g, `Kapitel ${ROMAN[i]}`, x + 12, y + 5, { size: 8, color: open ? '#f0c24a' : '#7a6a5a' });
      txt(g, open ? L.name : '– verschlossen –', x + 12, y + 15, { size: 12, weight: 600, color: open ? (sel ? '#ffe27a' : '#efe4cc') : '#7a6a5a' });
      if (!open) drawLockIcon(g, x + w - 22, y + 10);
      this.menuRects.push({ x, y, w, h, i });
    });
    txt(g, 'Esc: zurück', VIEW_W / 2, VIEW_H - 14, { size: 8, align: 'center', color: '#d8ccb0', outline: OUTLINE });
  },

  renderControls(g) {
    if (this.controlsBack === 'paused') { g.globalAlpha = 0.7; fr(g, '#0b0806', 0, 0, VIEW_W, VIEW_H); g.globalAlpha = 1; }
    panel(g, 40, 22, VIEW_W - 80, VIEW_H - 44, 'parchment');
    txt(g, 'Steuerung', VIEW_W / 2, 28, { size: 26, align: 'center', font: FONT_TITLE, color: '#3a2414', shadow: false });
    const rows = [
      ['Laufen', '← →  oder  A D', 'Stick / Steuerkreuz'],
      ['Springen', 'Leertaste · Z · K', 'A'],
      ['Schießen', 'X · J  (halten = Kraftschuss)', 'X / B / R'],
      ['Schräg zielen', '↑ halten · ↓ im Sprung', 'Stick hoch / runter'],
      ['Durch Äste fallen', '↓ + Springen', '↓ + A'],
      ['Pause', 'Esc · P', 'Start'],
      ['Ton / Vollbild', 'M · F', '–'],
    ];
    txt(g, 'Tastatur', 210, 64, { size: 8, weight: 600, color: '#6b4a2a', shadow: false });
    txt(g, 'Gamepad', 360, 64, { size: 8, weight: 600, color: '#6b4a2a', shadow: false });
    rows.forEach((r, i) => {
      const y = 78 + i * 18;
      txt(g, r[0], 60, y, { size: 8, weight: 600, color: '#3a2414', shadow: false });
      txt(g, r[1], 210, y, { size: 8, color: '#3a2414', shadow: false });
      txt(g, r[2], 360, y, { size: 8, color: '#3a2414', shadow: false });
    });
    txt(g, 'Auf dem Handy erscheinen Knöpfe am Bildschirmrand.', VIEW_W / 2, 210, { size: 8, align: 'center', color: '#6b4a2a', shadow: false });
    if (Math.floor(this.t * 2) % 2 === 0) txt(g, 'Weiter mit Enter', VIEW_W / 2, 228, { size: 8, align: 'center', color: '#3a2414', shadow: false, weight: 600 });
  },

  renderIntro(g) {
    g.globalAlpha = 0.6; fr(g, '#0b0806', 0, 0, VIEW_W, VIEW_H); g.globalAlpha = 1;
    const def = this.level.def;
    const w = 360, h = 150, x = (VIEW_W - w) / 2, y = 52;
    panel(g, x, y, w, h, 'parchment');
    txt(g, def.chapter, VIEW_W / 2, y + 10, { size: 10, align: 'center', color: '#8a3a1a', shadow: false, weight: 600 });
    txt(g, def.name, VIEW_W / 2, y + 22, { size: 30, align: 'center', font: FONT_TITLE, color: '#3a2414', shadow: false });
    const k = clamp(this.stateT * 1.2, 0, 1);
    g.globalAlpha = k;
    def.intro.forEach((l, i) => {
      const lines = wrapText(g, l, w - 30, 8);
      lines.forEach((s, j) => txt(g, s, VIEW_W / 2, y + 66 + (i + j) * 13, { size: 8, align: 'center', color: '#3a2414', shadow: false }));
    });
    g.globalAlpha = 1;
    if (this.stateT > 0.5 && Math.floor(this.t * 2) % 2 === 0) {
      txt(g, Input.device === 'touch' ? 'Tippen zum Losziehen' : 'Springen oder Enter zum Losziehen', VIEW_W / 2, y + h - 18, { size: 8, align: 'center', color: '#6b4a2a', shadow: false, weight: 600 });
    }
    txt(g, `Leben × ${this.lives}   ·   Ruhm ${this.score}`, VIEW_W / 2, y + h + 10, { size: 8, align: 'center', outline: OUTLINE, color: '#ffe27a' });
  },

  renderPause(g) {
    g.globalAlpha = 0.6; fr(g, '#0b0806', 0, 0, VIEW_W, VIEW_H); g.globalAlpha = 1;
    txt(g, 'Pause', VIEW_W / 2, 40, { size: 36, align: 'center', font: FONT_TITLE, color: '#f0c24a', outline: '#2a1608' });
    panel(g, VIEW_W / 2 - 90, 92, 180, 118, 'dark');
    this.renderMenu(g, this.pauseItems(), VIEW_W / 2, 104, 20, 10);
  },

  renderClear(g) {
    g.globalAlpha = 0.55; fr(g, '#0b0806', 0, 0, VIEW_W, VIEW_H); g.globalAlpha = 1;
    const w = 340, h = 190, x = (VIEW_W - w) / 2, y = 40;
    panel(g, x, y, w, h, 'parchment');
    txt(g, 'Kapitel geschafft!', VIEW_W / 2, y + 8, { size: 28, align: 'center', font: FONT_TITLE, color: '#3a2414', shadow: false });
    const n = Math.floor(this.stateT / 0.4);
    this.tally.lines.forEach((l, i) => {
      if (i >= n) return;
      const yy = y + 52 + i * 16;
      txt(g, l[0], x + 24, yy, { size: 8, color: '#5a3a22', shadow: false, weight: 600 });
      txt(g, l[1], x + w - 24, yy, { size: 8, color: '#3a2414', shadow: false, align: 'right' });
    });
    if (n > this.tally.lines.length) {
      fr(g, '#c9ae7a', x + 20, y + 140, w - 40, 1);
      txt(g, 'Ruhm', x + 24, y + 148, { size: 12, color: '#8a3a1a', shadow: false, weight: 600 });
      txt(g, String(this.tally.total), x + w - 24, y + 148, { size: 12, color: '#8a3a1a', shadow: false, weight: 600, align: 'right' });
    }
    if (this.stateT > 2.4 && Math.floor(this.t * 2) % 2 === 0) {
      txt(g, this.levelIdx < LEVELS.length - 1 ? 'Weiter mit Springen / Enter' : 'Weiter zum Finale', VIEW_W / 2, y + h - 16, { size: 8, align: 'center', color: '#6b4a2a', shadow: false, weight: 600 });
    }
  },

  renderGameOver(g) {
    g.globalAlpha = 0.72; fr(g, '#120606', 0, 0, VIEW_W, VIEW_H); g.globalAlpha = 1;
    txt(g, 'Gefangen!', VIEW_W / 2, 46, { size: 44, align: 'center', font: FONT_TITLE, color: '#e0503a', outline: '#1a0806' });
    txt(g, 'Die Häscher des Sheriffs haben dich erwischt.', VIEW_W / 2, 106, { size: 8, align: 'center', color: '#efe4cc', outline: OUTLINE });
    txt(g, 'Doch Little John befreit dich aus dem Kerker …', VIEW_W / 2, 118, { size: 8, align: 'center', color: '#efe4cc', outline: OUTLINE });
    panel(g, VIEW_W / 2 - 90, 140, 180, 56, 'dark');
    this.renderMenu(g, this.gameoverItems(), VIEW_W / 2, 152, 20, 10);
  },

  renderVictory(g) {
    const T = this.title;
    drawBackdrop(g, T.bd, this.t * 10, 40, this.t);
    g.drawImage(T.art, 0, 50, VIEW_W, VIEW_H, 0, 0, VIEW_W, VIEW_H);
    const r = T.robin;
    r.animT += 0.016;
    drawRobin(g, r, 150, 222, null);
    for (let i = 0; i < 3; i++) {
      const n = { variant: i, anim: this.t + i, happy: 1, facing: -1 };
      drawPeasant(g, n, 200 + i * 22, 222 + (Math.sin(this.t * 6 + i) > 0.7 ? -3 : 0));
    }
    for (const q of this.particles) {
      if (!q.screen) continue;
      g.globalAlpha = Math.min(1, q.life); fr(g, q.c, Math.round(q.x), Math.round(q.y), 2, 1);
    }
    g.globalAlpha = 0.55; fr(g, '#0b0806', 0, 0, VIEW_W, 150); g.globalAlpha = 1;
    txt(g, 'Sieg für Sherwood!', VIEW_W / 2, 12, { size: 40, align: 'center', font: FONT_TITLE, color: '#f0c24a', outline: '#2a1608' });
    const lines = [
      'Der Sheriff von Nottingham ist geschlagen.',
      'Das gehortete Gold kehrt zurück zu denen, denen es gehört –',
      'und in Sherwood feiern die Leute bis tief in die Nacht.',
    ];
    const k = clamp(this.stateT / 1.5, 0, 1);
    g.globalAlpha = k;
    lines.forEach((l, i) => txt(g, l, VIEW_W / 2, 66 + i * 13, { size: 8, align: 'center', color: '#f6ead0', outline: OUTLINE }));
    txt(g, `Dein Ruhm: ${this.score}`, VIEW_W / 2, 112, { size: 12, align: 'center', color: '#ffe27a', outline: OUTLINE, weight: 600 });
    g.globalAlpha = 1;
    if (this.stateT > 3 && Math.floor(this.t * 2) % 2 === 0) txt(g, 'Danke fürs Spielen!  ·  Enter: Zum Titelbild', VIEW_W / 2, 132, { size: 8, align: 'center', color: '#efe4cc', outline: OUTLINE });
  },
};

function drawArrowIcon(g, x, y, flip) {
  const d = flip ? -1 : 1;
  for (let i = 0; i < 8; i++) { fr(g, OUTLINE, x - d * i - 1, y - 1, 3, 3); }
  for (let i = 0; i < 8; i++) fr(g, i < 2 ? '#d6dde4' : '#e2c088', x - d * i, y, 1, 1);
  fr(g, '#d6402f', x - d * 7, y - 1, 1, 1); fr(g, '#f2ece0', x - d * 7, y + 1, 1, 1);
}

function drawLockIcon(g, x, y) {
  fr(g, OUTLINE, x - 1, y + 4, 12, 10); fr(g, '#8a7a5a', x, y + 5, 10, 8);
  fr(g, OUTLINE, x + 1, y - 1, 8, 6); fr(g, '#0b0806', x + 3, y + 1, 4, 4);
  fr(g, '#8a7a5a', x + 2, y, 1, 5); fr(g, '#8a7a5a', x + 7, y, 1, 5); fr(g, '#8a7a5a', x + 2, y, 6, 1);
  fr(g, OUTLINE, x + 4, y + 7, 2, 3);
}

window.RH = Game;
Game.init();
