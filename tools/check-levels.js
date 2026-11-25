#!/usr/bin/env node
// Prüft die Level-Karten: gleiche Breiten, Pflichtobjekte und ob Ziel,
// Banner und Schätze mit Robins Sprungweite erreichbar sind.
// Aufruf: node tools/check-levels.js [--print]
'use strict';
const path = require('path');
const { LEVELS, buildLevelRows } = require(path.join(__dirname, '..', 'js', 'levels.js'));

const SOLID = new Set(['#', 'B', 'W', 'X']);
const PLATFORM = new Set(['R', '=', '-']);
const HAZARD = new Set(['^', '~']);
const print = process.argv.includes('--print');
let failed = false;

for (const def of LEVELS) {
  let rows;
  try { rows = buildLevelRows(def); } catch (e) { console.error('✗', e.message); failed = true; continue; }
  const H = rows.length, W = rows[0].length;
  const at = (x, y) => (x < 0 || x >= W ? '#' : y < 0 || y >= H ? '.' : rows[y][x]);
  const solid = (x, y) => SOLID.has(at(x, y));
  const support = (x, y) => SOLID.has(at(x, y)) || PLATFORM.has(at(x, y));

  const find = (ch) => { const r = []; rows.forEach((row, y) => [...row].forEach((c, x) => { if (c === ch) r.push([x, y]); })); return r; };
  const starts = find('P');
  if (starts.length !== 1) { console.error(`✗ ${def.id}: ${starts.length} Startpunkte`); failed = true; continue; }
  const signs = find('i').length;
  if (signs !== def.signs.length) console.warn(`! ${def.id}: ${signs} Schilder, aber ${def.signs.length} Texte`);

  // begehbare Zellen
  const stand = new Set();
  const key = (x, y) => x + ',' + y;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (solid(x, y) || HAZARD.has(at(x, y)) || solid(x, y - 1)) continue;
    if (support(x, y + 1)) stand.add(key(x, y));
  }
  // bewegliche Plattformen
  for (const [x, y] of find('m')) for (let c = x; c <= x + 6; c++) stand.add(key(c, y));
  for (const [x, y] of find('M')) for (let c = x - 4; c <= x + 2; c++) stand.add(key(c, y));
  for (const [x, y] of find('n')) for (let r = y - 4; r <= y; r++) for (let c = x; c <= x + 2; c++) stand.add(key(c, r));
  const springs = new Set(find('T').map(([x, y]) => key(x, y)));

  const cells = [...stand].map((k) => k.split(',').map(Number));
  const [sx, sy] = starts[0];
  const seen = new Set([key(sx, sy)]);
  const queue = [[sx, sy]];
  while (queue.length) {
    const [x, y] = queue.shift();
    const spring = springs.has(key(x, y));
    for (const [x2, y2] of cells) {
      const k = key(x2, y2);
      if (seen.has(k)) continue;
      const up = y - y2, dx = Math.abs(x2 - x);
      let ok;
      if (spring) ok = up <= 11 && dx <= 5;
      else if (up > 3) ok = false;
      else if (up === 3) ok = dx <= 3;
      else if (up >= 0) ok = dx <= 4;
      else ok = dx <= 4 + Math.min(3, Math.floor(-up / 2));
      if (ok) { seen.add(k); queue.push([x2, y2]); }
    }
  }
  const reach = (x, y) => seen.has(key(x, y)) || seen.has(key(x, y + 1)) || seen.has(key(x, y - 1)) || seen.has(key(x, y - 2)) || seen.has(key(x - 1, y)) || seen.has(key(x + 1, y));

  const goals = [...find('E'), ...find('A')];
  if (!goals.length) { console.error(`✗ ${def.id}: kein Ziel (E) und keine Arena (A)`); failed = true; }
  for (const [x, y] of goals) if (!reach(x, y)) { console.error(`✗ ${def.id}: Ziel bei Spalte ${x} unerreichbar`); failed = true; }
  for (const [x, y] of find('C')) if (!reach(x, y)) { console.error(`✗ ${def.id}: Banner bei Spalte ${x} unerreichbar`); failed = true; }
  const loot = [...find('o'), ...find('$'), ...find('v'), ...find('q')];
  // Schätze dürfen auch in der Luft hängen – erreichbar, wenn sie in Sprungweite liegen
  const inArc = (x, y) => [...seen].some((k) => { const [sx, sy] = k.split(',').map(Number); return Math.abs(sx - x) <= 3 && sy - y >= -1 && sy - y <= 4; });
  const lost = loot.filter(([x, y]) => !reach(x, y) && !inArc(x, y));
  for (const [x, y] of lost) console.warn(`! ${def.id}: Schatz bei ${x},${y} vermutlich unerreichbar`);
  console.log(`✓ ${def.id}: ${W}×${H}, ${loot.length} Schätze, ${find('C').length} Banner`);
  if (print) {
    for (let x0 = 0; x0 < W; x0 += 100) {
      console.log(`  Spalten ${x0}–${Math.min(W, x0 + 100) - 1}`);
      rows.forEach((r) => console.log('  ' + r.slice(x0, x0 + 100)));
    }
  }
}
process.exit(failed ? 1 : 0);
