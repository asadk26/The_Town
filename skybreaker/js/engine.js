/* SKYBREAKER — the world and everything that moves in it.

   One global state, G.  Maps are loaded from MAPS (maps.js); story beats and
   conversations come from STORY (story.js); boxes, menus and the HUD live in
   UI (ui.js).  This file is the simulation: moving, colliding, punching,
   throwing ki, taking hits, and the effects that sell all of it. */
'use strict';

let VW = 240, VH = 160;
const TS = 16;

/* ── input ──────────────────────────────────────────────── */
const I = (() => {
  const KEYS = {
    ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
    z: 'A', Z: 'A', x: 'B', X: 'B', a: 'L', A: 'L', s: 'R', S: 'R',
    Enter: 'START', c: 'SWAP', C: 'SWAP', m: 'MUTE', M: 'MUTE',
  };
  const held = {}, pressed = {}, released = {};
  addEventListener('keydown', (e) => {
    const k = KEYS[e.key];
    if (!k) return;
    e.preventDefault();
    if (typeof AUDIO !== 'undefined') AUDIO.init();
    if (!held[k]) pressed[k] = true;
    held[k] = true;
  });
  addEventListener('keyup', (e) => {
    const k = KEYS[e.key];
    if (!k) return;
    e.preventDefault();
    if (held[k]) released[k] = true;
    held[k] = false;
  });
  addEventListener('blur', () => { for (const k in held) held[k] = false; });
  function endFrame() { for (const k in pressed) delete pressed[k]; for (const k in released) delete released[k]; }
  /* consume a press so two systems don't both act on it */
  function take(k) { if (pressed[k]) { delete pressed[k]; return true; } return false; }
  return { held, pressed, released, endFrame, take };
})();

/* ── state ──────────────────────────────────────────────── */
const G = {
  scene: 'boot', t: 0,
  map: null, mapId: null,
  player: null, enemies: [], npcs: [], props: [], shots: [], hazards: [], parts: [], texts: [], drops: [],
  party: {}, active: 'juno', items: {}, coins: 0, flags: {},
  cam: { x: 0, y: 0 }, shake: 0, hitstop: 0, fade: 0, fadeTarget: 0, scouter: false,
  script: null, lock: null, boss: null, playTime: 0, lastEntry: null, bumpCool: 0,
};

const rand = (a, b) => a + Math.random() * (b - a);
const randi = (a, b) => Math.floor(rand(a, b + 1));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const DIRV = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
function dirFrom(dx, dy) { return Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : (dy < 0 ? 'up' : 'down'); }

/* ── sprites, built once at boot ────────────────────────── */
const SPR = { people: {}, creatures: {}, props: null, anim: null, trees: {}, houses: {}, orbs: {}, shadows: {} };
function personSheet(look) {
  if (look === 'null') look = nullLook();
  if (!SPR.people[look]) SPR.people[look] = GFX.person(DATA.LOOKS[look]);
  return SPR.people[look];
}
function creatureSheet(art) {
  const key = art.join(':');
  if (!SPR.creatures[key]) {
    if (art[0] === 'warden') SPR.creatures[key] = GFX.warden();
    else if (art[0] === 'robot') SPR.creatures[key] = GFX.robot();
    else SPR.creatures[key] = GFX.CREATURES[art[0]](art[1]);
  }
  return SPR.creatures[key];
}
function orb(r, color, core) {
  const key = r + color + core;
  if (SPR.orbs[key]) return SPR.orbs[key];
  const s = Math.ceil(r) * 2 + 3;
  const b = new GFX.Buf(s, s), c = (s - 1) / 2;
  b.disc(c, c, r + 1, GFX.mix(color, '#000000', 0.15));
  b.disc(c, c, r, color);
  b.disc(c - r * 0.2, c - r * 0.2, Math.max(0.6, r * 0.55), core);
  return (SPR.orbs[key] = b.toCanvas(false));
}
function shadowOf(w) { w = Math.max(6, Math.round(w)); return SPR.shadows[w] || (SPR.shadows[w] = GFX.shadow(w)); }

/* ── heroes ─────────────────────────────────────────────── */
function newHero(id, lv = 1) {
  const H = DATA.HEROES[id];
  const h = { id, lv: 1, xp: 0, maxHp: H.base.hp, maxKi: H.base.ki, str: H.base.str, pow: H.base.pow, def: H.base.def, pts: 0, sel: 0, joined: id === 'juno' };
  while (h.lv < lv) levelUp(h, true);
  h.hp = h.maxHp; h.ki = h.maxKi;
  return h;
}
function levelUp(h, quiet) {
  const g = DATA.HEROES[h.id].grow;
  h.lv++; h.maxHp += g.hp; h.maxKi += g.ki; h.str += g.str; h.pow += g.pow; h.def += g.def; h.pts += 3;
  h.hp = h.maxHp; h.ki = h.maxKi;
  if (!quiet) {
    UI.toast(DATA.HEROES[h.id].name + ' reached LV ' + h.lv + '!', '#ffd84a');
    AUDIO.sfx('level');
    const newSp = specialsFor(h).filter((k) => DATA.SPECIALS[k].lv === h.lv);
    for (const k of newSp) UI.toast('New special: ' + DATA.SPECIALS[k].name + '!', '#9af0ff');
    if (G.player && h.id === G.active) burst(G.player.x, G.player.y - 12, '#ffd84a', 16, 60);
  }
}
const hero = () => G.party[G.active];
const partner = () => { const o = G.active === 'juno' ? 'brask' : 'juno'; const h = G.party[o]; return h && h.joined ? h : null; };
function specialsFor(h) {
  return DATA.HEROES[h.id].specials.filter((k) => {
    const s = DATA.SPECIALS[k];
    return s.flag ? !!G.flags[s.flag] : h.lv >= s.lv;
  });
}
function curSpecial(h = hero()) {
  const list = specialsFor(h);
  if (!list.length) return null;
  h.sel = ((h.sel % list.length) + list.length) % list.length;
  return list[h.sel];
}
function gainXp(n) {
  for (const id of ['juno', 'brask']) {
    const h = G.party[id];
    if (!h || !h.joined) continue;
    h.xp += id === G.active ? n : Math.round(n * 0.6);
    while (h.xp >= DATA.xpTo(h.lv)) { h.xp -= DATA.xpTo(h.lv); levelUp(h); }
  }
}
function giveItem(k, n = 1, quiet) {
  G.items[k] = (G.items[k] || 0) + n;
  if (!quiet) { UI.toast('Got ' + DATA.ITEMS[k].name + (n > 1 ? ' x' + n : '') + '!', '#ffffff'); AUDIO.sfx('item'); }
}
function takeItem(k, n = 1) { G.items[k] = Math.max(0, (G.items[k] || 0) - n); if (!G.items[k]) delete G.items[k]; }
function heroLook(h) { return G.player && G.player.od && h.id === G.active ? DATA.HEROES[h.id].od : DATA.HEROES[h.id].look; }

/* ════════════════════════════════════════════════════════
   MAPS
   ════════════════════════════════════════════════════════ */
const GROUND_LOW = { w: 1, l: 1, v: 1 }, GROUND_HIGH = { c: 1, k: 1 };
const groundCache = {};

function loadMap(id, sx, sy, dir) {
  const def = MAPS[id];
  const m = def.build();
  m.id = id;
  if (!groundCache[id]) groundCache[id] = GFX.bakeGround(m.rows);
  m.ground = groundCache[id];
  m.W = m.w * TS; m.H = m.h * TS;
  m.solid = new Uint8Array(m.w * m.h);
  for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
    const t = m.rows[y][x];
    m.solid[y * m.w + x] = GROUND_HIGH[t] ? 2 : GROUND_LOW[t] ? 1 : 0;
  }
  m.propAt = new Array(m.w * m.h).fill(null);
  G.map = m; G.mapId = id;
  G.props = []; G.npcs = []; G.enemies = []; G.shots = []; G.hazards = []; G.parts = []; G.texts = []; G.drops = [];
  G.lock = null; G.boss = null;
  for (const p of m.props) addProp(p);
  for (const n of m.npcs) addNpc(n);
  for (const z of m.zones) spawnZone(z);
  if (!G.player) G.player = makePlayer();
  const p = G.player;
  p.x = sx * TS + 8; p.y = sy * TS + 12; p.dir = dir || p.dir || 'down';
  p.state = 'move'; p.t = 0; p.kbx = p.kby = 0; p.invuln = 0.5;
  G.lastEntry = { map: id, x: sx, y: sy, dir: p.dir };
  snapCamera();
  m.mood = def.mood || (typeof m.mood === 'string' ? m.mood : 'day');
  R3.buildMap(m);
  AUDIO.play(typeof m.music === 'function' ? m.music() : m.music);
  UI.areaName(m.name);
  if (m.onEnter) m.onEnter();
}

function addProp(p) {
  const m = G.map;
  if (p.flag && G.flags[p.flag] && p.goneWhenFlag !== false) return; // broken, burned, collected
  if (p.when && !p.when()) return;
  p.solidTiles = p.solidTiles || (p.solid === false ? [] : [[p.tx, p.ty]]);
  for (const [x, y] of p.solidTiles) {
    if (x < 0 || y < 0 || x >= m.w || y >= m.h) continue;
    m.solid[y * m.w + x] = 3;
    m.propAt[y * m.w + x] = p;
  }
  if (p.x === undefined) { p.x = p.tx * TS + 8; p.y = p.ty * TS + 15; }
  p.anim = p.anim || 0;
  G.props.push(p);
}
function removeProp(p) {
  const m = G.map;
  for (const [x, y] of p.solidTiles) {
    if (m.propAt[y * m.w + x] === p) { m.propAt[y * m.w + x] = null; m.solid[y * m.w + x] = GROUND_HIGH[m.rows[y][x]] ? 2 : GROUND_LOW[m.rows[y][x]] ? 1 : 0; }
  }
  G.props = G.props.filter((q) => q !== p);
}
function propAtTile(tx, ty) { const m = G.map; if (tx < 0 || ty < 0 || tx >= m.w || ty >= m.h) return null; return m.propAt[ty * m.w + tx]; }

/* Collision against tiles.  fly: ignores water/lava/void.  Map edges block. */
function tileBlocks(tx, ty, fly) {
  const m = G.map;
  if (tx < 0 || ty < 0 || tx >= m.w || ty >= m.h) return true;
  const s = m.solid[ty * m.w + tx];
  return s === 0 ? false : s === 1 ? !fly : true;
}
function boxBlocked(x, y, w, h, fly, who) {
  const x0 = Math.floor((x - w / 2) / TS), x1 = Math.floor((x + w / 2 - 0.01) / TS);
  const y0 = Math.floor((y - h) / TS), y1 = Math.floor((y - 0.01) / TS);
  for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) if (tileBlocks(tx, ty, fly)) return { tx, ty };
  if (who === G.player) {
    if (G.lock && (x - w / 2 < G.lock.x || x + w / 2 > G.lock.x + G.lock.w || y - h < G.lock.y || y > G.lock.y + G.lock.h)) return { lock: true };
    for (const n of G.npcs) {
      if (n.ghost) continue;
      if (Math.abs(n.x - x) < (w + 10) / 2 && Math.abs(n.y - 3 - (y - h / 2)) < (h + 6) / 2) return { npc: n };
    }
  }
  return null;
}
/* Move with sub-steps and corner sliding.  Returns what it bumped into. */
function moveBody(e, dx, dy) {
  let bumped = null;
  const steps = Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / 2) || 1;
  const sx = dx / steps, sy = dy / steps;
  for (let i = 0; i < steps; i++) {
    if (sx) {
      const hit = boxBlocked(e.x + sx, e.y, e.w, e.h, e.fly, e);
      if (!hit) e.x += sx;
      else {
        bumped = hit;
        if (!sy && e === G.player) for (const n of [1, -1, 2, -2, 3, -3, 4, -4, 5, -5]) {
          if (!boxBlocked(e.x + sx, e.y + n, e.w, e.h, e.fly, e) && !boxBlocked(e.x, e.y + n, e.w, e.h, e.fly, e)) { e.y += Math.sign(n) * 0.75; break; }
        }
      }
    }
    if (sy) {
      const hit = boxBlocked(e.x, e.y + sy, e.w, e.h, e.fly, e);
      if (!hit) e.y += sy;
      else {
        bumped = hit;
        if (!sx && e === G.player) for (const n of [1, -1, 2, -2, 3, -3, 4, -4, 5, -5]) {
          if (!boxBlocked(e.x + n, e.y + sy, e.w, e.h, e.fly, e) && !boxBlocked(e.x + n, e.y, e.w, e.h, e.fly, e)) { e.x += Math.sign(n) * 0.75; break; }
        }
      }
    }
  }
  return bumped;
}
/* Is there a clear straight line between two points (for ki and sight)? */
function lineClear(x0, y0, x1, y1) {
  const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 6);
  for (let i = 1; i < n; i++) {
    const x = x0 + (x1 - x0) * i / n, y = y0 + (y1 - y0) * i / n;
    const tx = Math.floor(x / TS), ty = Math.floor(y / TS);
    const m = G.map;
    if (tx < 0 || ty < 0 || tx >= m.w || ty >= m.h) return false;
    const s = m.solid[ty * m.w + tx];
    if (s === 2 || s === 3) return false;
  }
  return true;
}
function freeSpotNear(x, y, r, w = 12, h = 8, fly = false) {
  for (let i = 0; i < 30; i++) {
    const a = Math.random() * Math.PI * 2, d = r * (0.5 + Math.random() * 0.5);
    const nx = x + Math.cos(a) * d, ny = y + Math.sin(a) * d;
    if (!boxBlocked(nx, ny, w, h, fly) && (!G.lock || (nx > G.lock.x + 8 && nx < G.lock.x + G.lock.w - 8 && ny > G.lock.y + 12 && ny < G.lock.y + G.lock.h - 4))) return { x: nx, y: ny };
  }
  return { x, y };
}

/* ════════════════════════════════════════════════════════
   ACTORS
   ════════════════════════════════════════════════════════ */
function makePlayer() {
  return { kind: 'player', x: 0, y: 0, w: 10, h: 6, dir: 'down', state: 'move', t: 0, walkT: 0, invuln: 0, kbx: 0, kby: 0,
    combo: 0, queued: false, bHeld: -1, blastCool: 0, od: false, guard: 0, flashT: 0, readySounded: false, hitSet: null };
}

function addNpc(n) {
  if (n.when && !n.when()) return;
  const npc = Object.assign({ kind: 'npc', w: 10, h: 6, dir: n.dir || 'down', walkT: 0, state: 'idle', t: 0 }, n);
  npc.x = n.tx * TS + 8; npc.y = n.ty * TS + 12;
  npc.home = { x: npc.x, y: npc.y };
  G.npcs.push(npc);
  return npc;
}
function npc(id) { return G.npcs.find((n) => n.id === id); }

function spawnZone(z) {
  if (z.when && !z.when()) return;
  for (let i = 0; i < z.n; i++) {
    const [type, lo, hi] = z.types[Math.floor(Math.random() * z.types.length)];
    for (let tries = 0; tries < 20; tries++) {
      const x = (z.x + Math.random() * z.w) * TS, y = (z.y + Math.random() * z.h) * TS;
      const d = DATA.ENEMIES[type];
      if (!boxBlocked(x, y, d.w, d.h, d.fly) && Math.hypot(x - G.player?.x, y - G.player?.y) > 60) { spawnEnemy(type, randi(lo, hi), x, y); break; }
    }
  }
}
function spawnEnemy(type, lv, x, y) {
  const d = DATA.ENEMIES[type];
  const e = {
    kind: 'enemy', type, d, lv, name: d.name, x, y, w: d.w, h: d.h, fly: !!d.fly,
    maxHp: Math.round(d.hp * (1 + 0.22 * (lv - 1))), atk: d.atk * (1 + 0.12 * (lv - 1)), def: d.def + (lv - 1) * 0.6,
    spd: d.spd, dir: 'down', state: 'wander', t: rand(0, 1.5), kbx: 0, kby: 0, stun: 0, flash: 0, aggro: false, anim: Math.random() * 2,
    vx: 0, vy: 0, art: d.art, bob: Math.random() * 6,
  };
  e.hp = e.maxHp;
  G.enemies.push(e);
  return e;
}
function spawnBoss(id, x, y, opts = {}) {
  const d = DATA.BOSSES[id];
  const b = {
    kind: 'enemy', boss: true, id, d, lv: d.lv, name: d.name, x, y, w: d.w, h: d.h, fly: false,
    maxHp: d.hp, hp: d.hp, atk: d.atk, def: d.def, spd: d.spd, dir: 'down', state: 'intro', t: 0.6,
    kbx: 0, kby: 0, stun: 0, flash: 0, aggro: true, anim: 0, vx: 0, vy: 0, art: d.art,
    phase: 0, qi: 0, atk_: null, minions: [], opts, invulnerable: !!d.invulnerable, alpha: 1,
  };
  G.enemies.push(b);
  G.boss = b;
  return b;
}

/* ════════════════════════════════════════════════════════
   THE PLAYER
   ════════════════════════════════════════════════════════ */
function canControl() { return !UI.modal() && (!G.script || (G.script.waiter && G.script.waiter.control)); }

function updatePlayer(dt) {
  const p = G.player, h = hero(), H = DATA.HEROES[h.id];
  p.invuln = Math.max(0, p.invuln - dt);
  p.blastCool = Math.max(0, p.blastCool - dt);
  p.flashT = Math.max(0, p.flashT - dt);
  if (p.state === 'ko') { p.t += dt; return; }
  const ctrl = canControl();
  // knockback slides
  if (p.kbx || p.kby) {
    moveBody(p, p.kbx * dt, p.kby * dt);
    p.kbx *= Math.pow(0.0015, dt); p.kby *= Math.pow(0.0015, dt);
    if (Math.abs(p.kbx) < 4) p.kbx = 0; if (Math.abs(p.kby) < 4) p.kby = 0;
  }
  // ki: regenerates; Overdrive burns it
  if (p.od) {
    h.ki -= 2.4 * dt;
    if (G.t % 0.06 < dt) flame(p, H.kiColor);
    if (h.ki <= 0) { h.ki = 0; endOverdrive(); }
  } else if (p.state !== 'charge') h.ki = Math.min(h.maxKi, h.ki + 1.4 * dt);
  if (p.guard > 0) { p.guard -= dt; if (p.guard <= 0) UI.toast('Guard down', '#9aa0b8'); }
  const speed = H.speed * (p.od ? 1.22 : 1);

  const readMove = () => {
    let mx = 0, my = 0;
    if (ctrl) { if (I.held.left) mx--; if (I.held.right) mx++; if (I.held.up) my--; if (I.held.down) my++; }
    return [mx, my];
  };
  const face = (mx, my) => {
    if (!mx && !my) return;
    const cur = DIRV[p.dir];
    if ((mx && cur[0] === mx) || (my && cur[1] === my)) return; // keep facing while strafing diagonally
    p.dir = mx ? (mx < 0 ? 'left' : 'right') : (my < 0 ? 'up' : 'down');
  };

  p.t += dt;
  switch (p.state) {
    case 'move': {
      const [mx, my] = readMove();
      if (mx || my) {
        const l = Math.hypot(mx, my);
        face(mx, my);
        const bump = moveBody(p, mx / l * speed * dt, my / l * speed * dt);
        p.walkT += dt;
        if (bump && bump.tx !== undefined) onBump(bump.tx, bump.ty);
      } else p.walkT = 0;
      if (ctrl && I.take('A')) { if (!tryInteract()) startPunch(0); }
      else if (ctrl && I.pressed.B) { p.state = 'charge'; p.t = 0; p.readySounded = false; }
      break;
    }
    case 'punch': {
      const dur = p.combo === 2 ? 0.3 : 0.2;
      const active = p.combo === 2 ? [0.08, 0.18] : [0.04, 0.12];
      if (p.t < 0.06) moveBody(p, DIRV[p.dir][0] * 50 * dt, DIRV[p.dir][1] * 50 * dt);
      if (p.t >= active[0] && p.t <= active[1]) meleeHit(p, h, p.combo);
      if (ctrl && I.take('A')) p.queued = true;
      if (p.t >= dur) {
        if (p.queued && p.combo < 2) startPunch(p.combo + 1);
        else { p.state = 'move'; p.t = 0; p.combo = 0; }
      }
      break;
    }
    case 'charge': {
      const [mx, my] = readMove(); face(mx, my);
      const sp = curSpecial(h), S = sp && DATA.SPECIALS[sp];
      if (p.t > 0.18) { h.ki = Math.min(h.maxKi, h.ki + 2.5 * dt); if (G.t % 0.07 < dt) chargeSpark(p, H.kiColor); }
      if (S && p.t >= Math.max(0.2, S.charge) && !p.readySounded) { p.readySounded = true; AUDIO.sfx(h.ki >= S.cost ? 'ready' : 'deny'); }
      if (!I.held.B || !ctrl) {
        const charged = S && p.t >= Math.max(0.2, S.charge);
        if (charged && h.ki >= S.cost && ctrl) doSpecial(sp, h);
        else if (p.t < 0.2 || !charged) { fireBlast(p, h); p.state = 'blast'; p.t = 0; }
        else { UI.toast('Not enough ki!', '#ff8a8a'); p.state = 'move'; p.t = 0; }
      }
      break;
    }
    case 'blast': if (p.t > 0.16) { p.state = 'move'; p.t = 0; } break;
    case 'hurt': if (p.t > 0.32) { p.state = 'move'; p.t = 0; } break;
    case 'dash': {
      const v = DIRV[p.dir];
      moveBody(p, v[0] * 330 * dt, v[1] * 330 * dt);
      if (G.t % 0.03 < dt) afterimage(p);
      for (const e of G.enemies) if (!p.hitSet.has(e) && overlapBody(p, e, 8)) { p.hitSet.add(e); hitEnemy(e, (h.str * 1.5 + h.pow * 0.9) * odMul(), v[0] * 160, v[1] * 160, { heavy: true }); }
      for (const pr of propsNear(p.x, p.y - 4, 14)) hitProp(pr, { melee: true, heavy: false, burn: false });
      if (p.t > 0.3) { p.state = 'move'; p.t = 0; }
      break;
    }
    case 'beam': {
      if (p.t < 0.75) {
        if ((p.beamTick -= dt) <= 0) {
          p.beamTick = 0.1;
          const r = beamRect(p.x, p.y - 12, p.dir, 9, 200);
          for (const e of G.enemies) if (rectHitsBody(r, e)) hitEnemy(e, h.pow * 0.8 * odMul(), DIRV[p.dir][0] * 40, DIRV[p.dir][1] * 40, { quiet: true });
          for (const pr of propsInRect(r)) hitProp(pr, { ki: true, burn: !!H.burns, heavy: !!H.breaks });
          G.shake = Math.max(G.shake, 0.08);
        }
      } else { p.state = 'move'; p.t = 0; }
      break;
    }
    case 'pose': if (p.t > (p.poseT || 0.3)) { p.state = 'move'; p.t = 0; } break;
    case 'guard': {
      const [mx, my] = readMove();
      if (mx || my) { face(mx, my); const l = Math.hypot(mx, my); moveBody(p, mx / l * speed * 0.45 * dt, my / l * speed * 0.45 * dt); }
      if (p.guard <= 0) { p.state = 'move'; p.t = 0; }
      break;
    }
  }

  // L cycles the special, R the scouter, SWAP tags the partner in
  if (ctrl && I.take('L')) {
    const list = specialsFor(h);
    if (list.length > 1) { h.sel = (h.sel + 1) % list.length; AUDIO.sfx('blip'); UI.specialFlash(); }
  }
  if (ctrl && I.take('R')) {
    if (!G.flags.lens) { AUDIO.sfx('deny'); UI.toast("You don't have a Lens yet.", '#c8c8f0'); }
    else { G.scouter = !G.scouter; AUDIO.sfx('scouter'); if (G.scouter) revealHidden(); }
  }
  if (ctrl && I.take('SWAP')) trySwap();
  if (G.scouter && G.t % 0.5 < dt) revealHidden();
}
const odMul = () => (G.player.od ? 1.5 : 1);

function startPunch(step) {
  const p = G.player;
  p.state = 'punch'; p.t = 0; p.combo = step; p.queued = false; p.hitSet = new Set();
  AUDIO.sfx('whiff');
}
function meleeBox(p, step) {
  const reach = step === 2 ? 18 : 15;
  switch (p.dir) {
    case 'down': return { x: p.x - 9, y: p.y - 6, w: 18, h: reach };
    case 'up': return { x: p.x - 9, y: p.y - 18 - reach, w: 18, h: reach + 4 };
    case 'left': return { x: p.x - 5 - reach, y: p.y - 20, w: reach, h: 18 };
    default: return { x: p.x + 5, y: p.y - 20, w: reach, h: 18 };
  }
}
function meleeHit(p, h, step) {
  const r = meleeBox(p, step);
  const H = DATA.HEROES[h.id];
  const mult = [1, 1.05, 1.7][step];
  for (const e of G.enemies) {
    if (p.hitSet.has(e) || !rectHitsBody(r, e)) continue;
    p.hitSet.add(e);
    let dmg = h.str * mult * odMul();
    if (e.d.armored && !H.breaks) dmg *= 0.5;
    const kb = step === 2 ? 190 : 70;
    const v = DIRV[p.dir];
    if (hitEnemy(e, dmg, v[0] * kb, v[1] * kb, { heavy: step === 2, melee: true })) {
      h.ki = Math.min(h.maxKi, h.ki + 1.2);
    }
  }
  for (const pr of propsInRect(r)) if (!p.hitSet.has(pr)) { p.hitSet.add(pr); hitProp(pr, { melee: true, heavy: step === 2 && !!H.breaks }); }
}
function fireBlast(p, h) {
  if (p.blastCool > 0) return;
  const cost = 3;
  if (h.ki < cost) { AUDIO.sfx('deny'); UI.toast('Out of ki!', '#ff8a8a'); return; }
  h.ki -= cost; p.blastCool = 0.16;
  const H = DATA.HEROES[h.id], v = DIRV[p.dir];
  spawnShot({ x: p.x + v[0] * 8, y: p.y - 12 + v[1] * 6, vx: v[0] * 210, vy: v[1] * 210, r: 3, dmg: h.pow * 1.1 * odMul(), team: 'p',
    color: H.kiColor, core: H.kiCore, burn: !!H.burns, life: 0.9 });
  AUDIO.sfx('blast');
}
function doSpecial(k, h) {
  const p = G.player, S = DATA.SPECIALS[k], H = DATA.HEROES[h.id], v = DIRV[p.dir];
  h.ki -= S.cost;
  p.t = 0;
  switch (k) {
    case 'comet': p.state = 'dash'; p.hitSet = new Set(); p.invuln = Math.max(p.invuln, 0.4); AUDIO.sfx('special'); break;
    case 'lance': p.state = 'beam'; p.beamTick = 0; AUDIO.sfx('beam'); break;
    case 'nova':
      p.state = 'pose'; p.poseT = 0.35; AUDIO.sfx('boom'); G.shake = 0.3;
      addHazard({ kind: 'shock', x: p.x, y: p.y - 6, r: 0, maxR: 56, speed: 260, team: 'p', dmg: h.pow * 2.6 * odMul(), color: H.kiColor, burn: true, kb: 220 });
      break;
    case 'stomp':
      p.state = 'pose'; p.poseT = 0.3; AUDIO.sfx('crack'); G.shake = 0.3;
      addHazard({ kind: 'shock', x: p.x, y: p.y - 4, r: 0, maxR: 40, speed: 200, team: 'p', dmg: (h.str * 1.4) * odMul(), color: H.kiColor, stun: 1.2, heavy: true, kb: 120 });
      break;
    case 'cannon':
      p.state = 'pose'; p.poseT = 0.3; AUDIO.sfx('special');
      spawnShot({ x: p.x + v[0] * 10, y: p.y - 12 + v[1] * 8, vx: v[0] * 95, vy: v[1] * 95, r: 7, dmg: h.pow * 2.8 * odMul(), team: 'p',
        color: H.kiColor, core: H.kiCore, pierce: true, heavy: true, life: 2.2, big: true });
      break;
    case 'guard': p.state = 'guard'; p.guard = 2.2; AUDIO.sfx('reflect'); UI.toast('Iron Guard!', '#9af0ff'); break;
    case 'overdrive':
      if (p.od) { endOverdrive(); h.ki += S.cost; p.state = 'move'; break; }
      p.od = true; p.state = 'pose'; p.poseT = 0.6; p.invuln = 0.8;
      AUDIO.sfx('transform'); G.shake = 0.5; burst(p.x, p.y - 12, H.kiColor, 30, 90); burst(p.x, p.y - 12, '#ffffff', 12, 50);
      UI.toast('OVERDRIVE!', H.kiColor);
      break;
  }
}
function endOverdrive() {
  const p = G.player;
  if (!p.od) return;
  p.od = false;
  burst(p.x, p.y - 12, '#ffffff', 10, 40);
  UI.toast('Overdrive faded', '#9aa0b8');
}

function trySwap(forced) {
  const o = partner();
  const p = G.player;
  if (!o) { if (!forced) { AUDIO.sfx('deny'); } return false; }
  if (o.hp <= 0) { if (!forced) { UI.toast(DATA.HEROES[o.id].name + ' is down. Heal them first.', '#ff8a8a'); AUDIO.sfx('deny'); } return false; }
  if (!forced && p.state !== 'move') return false;
  if (p.od) endOverdrive();
  G.active = o.id;
  p.state = 'move'; p.t = 0;
  burst(p.x, p.y - 12, DATA.HEROES[o.id].kiColor, 14, 50);
  AUDIO.sfx('warp');
  UI.specialFlash();
  return true;
}

function damagePlayer(amount, fx, fy, opts = {}) {
  const p = G.player, h = hero();
  if (p.state === 'ko' || p.invuln > 0 || (G.script && !G.script.waiter?.control)) return false;
  if (p.guard > 0) { floatText(p.x, p.y - 26, 'GUARD', '#9af0ff'); AUDIO.sfx('reflect'); p.invuln = 0.2; return false; }
  let dmg = Math.max(1, Math.round(amount * rand(0.9, 1.1) - h.def * 0.5));
  if (p.od) dmg = Math.max(1, Math.round(dmg * 0.7));
  h.hp -= dmg;
  floatText(p.x, p.y - 26, String(dmg), '#ff5a5a');
  AUDIO.sfx('hurt');
  const a = Math.atan2(p.y - fy, p.x - fx);
  p.kbx = Math.cos(a) * 160; p.kby = Math.sin(a) * 160;
  p.state = 'hurt'; p.t = 0; p.invuln = 1.0; p.flashT = 0.15;
  G.shake = Math.max(G.shake, 0.15);
  if (G.noKO && h.hp < 1) h.hp = 1;
  if (h.hp <= 0) {
    h.hp = 0;
    if (p.od) endOverdrive();
    if (trySwap(true)) {
      UI.toast(DATA.HEROES[h.id].name + ' is down! ' + DATA.HEROES[G.active].name + ' tags in!', '#ffd84a');
      p.invuln = 1.6;
    } else {
      p.state = 'ko'; p.t = 0;
      AUDIO.sfx('die');
      UI.gameOverSoon();
    }
  }
  return true;
}

/* ── interaction & the world's reactions ────────────────── */
function tryInteract() {
  const p = G.player, v = DIRV[p.dir];
  const px = p.x + v[0] * 12, py = p.y - 4 + v[1] * 12;
  for (const n of G.npcs) {
    if (!n.talk) continue;
    if (Math.abs(n.x - px) < 13 && Math.abs((n.y - 4) - py) < (n.reach || 14)) {
      if (n.state !== 'fixed') n.dir = dirFrom(p.x - n.x, p.y - n.y);
      STORY.talk(n);
      return true;
    }
  }
  for (const pr of G.props) {
    if (!pr.interact || (pr.hidden && !pr.revealed)) continue;
    const r = pr.reach || 12;
    const cy = pr.y - 6;
    if (Math.abs(pr.x - px) < r && Math.abs(cy - py) < r + 2) { pr.interact(pr); return true; }
  }
  return false;
}
function onBump(tx, ty) {
  const pr = propAtTile(tx, ty);
  if (pr && pr.onBump && G.bumpCool <= 0) { G.bumpCool = 1.2; pr.onBump(pr); }
}
function propsNear(x, y, r) { return G.props.filter((p) => Math.abs(p.x - x) < r && Math.abs(p.y - 6 - y) < r); }
function propsInRect(r) {
  return G.props.filter((p) => p.onHit && p.x + 6 > r.x && p.x - 6 < r.x + r.w && p.y > r.y && p.y - 14 < r.y + r.h);
}
function hitProp(pr, how) { if (pr.onHit) pr.onHit(pr, how); }
function revealHidden() {
  for (const pr of G.props) if (pr.hidden && !pr.revealed && Math.abs(pr.x - G.player.x) < 130 && Math.abs(pr.y - G.player.y) < 90) {
    pr.revealed = true; burst(pr.x, pr.y - 6, '#7affb0', 10, 30); AUDIO.sfx('scouter');
  }
}

/* ════════════════════════════════════════════════════════
   ENEMIES
   ════════════════════════════════════════════════════════ */
function bodyRect(e) {
  const bh = e.boss && e.d.big ? 36 : e.art && e.art[0] === 'person' ? 22 : 14;
  return { x: e.x - e.w / 2 - 2, y: e.y - bh - (e.fly ? 6 : 0), w: e.w + 4, h: bh + 2 };
}
function rectHitsBody(r, e) {
  const b = bodyRect(e);
  return r.x < b.x + b.w && r.x + r.w > b.x && r.y < b.y + b.h && r.y + r.h > b.y;
}
function overlapBody(p, e, pad = 0) {
  const b = bodyRect(e);
  return p.x + 6 + pad > b.x && p.x - 6 - pad < b.x + b.w && p.y + pad > b.y && p.y - 20 - pad < b.y + b.h;
}
function playerBody() { const p = G.player; return { x: p.x - 5, y: p.y - 20, w: 10, h: 20 }; }
function rectsOverlap(a, b) { return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y; }

/* returns true if the hit landed */
function hitEnemy(e, dmg, kbx, kby, opts = {}) {
  if (e.dead || e.state === 'intro' || e.alpha < 0.5) return false;
  if (e.invulnerable) {
    floatText(e.x, e.y - 30, 'NO EFFECT', '#c8a8ff');
    AUDIO.sfx('reflect');
    e.flash = 0.06;
    return true;
  }
  const n = Math.max(1, Math.round(dmg * rand(0.9, 1.1) - e.def * 0.6));
  e.hp -= n; e.flash = 0.12; e.aggro = true;
  const res = e.boss ? (e.d.big ? 0.08 : 0.22) : 1;
  e.kbx += kbx * res; e.kby += kby * res;
  if (!e.boss) e.stun = Math.max(e.stun, opts.stun || (opts.heavy ? 0.45 : 0.25));
  else if (opts.stun) e.stun = Math.max(e.stun, 0.25);
  floatText(e.x + rand(-4, 4), e.y - (e.boss && e.d.big ? 42 : 26), String(n), opts.heavy ? '#ffd84a' : '#ffffff');
  if (!opts.quiet) AUDIO.sfx(opts.heavy ? 'heavy' : 'hit');
  if (opts.melee) G.hitstop = opts.heavy ? 5 : 3;
  if (opts.heavy) G.shake = Math.max(G.shake, 0.12);
  sparks(e.x, e.y - 12, opts.heavy ? '#ffd84a' : '#ffffff', opts.heavy ? 8 : 5);
  if (e.boss && e.d.endAt && e.hp <= e.maxHp * e.d.endAt) { e.hp = Math.ceil(e.maxHp * e.d.endAt); e.ended = true; }
  if (e.hp <= 0) killEnemy(e);
  return true;
}
function killEnemy(e) {
  e.hp = 0;
  if (e.boss) { e.dead = true; e.state = 'dying'; e.t = 0; AUDIO.sfx('boom'); G.shake = 0.6; return; }
  e.dead = true;
  G.enemies = G.enemies.filter((q) => q !== e);
  burst(e.x, e.y - 8, '#ffffff', 10, 50);
  burst(e.x, e.y - 8, '#c8b8ff', 6, 30);
  AUDIO.sfx('die');
  gainXp(Math.round(e.d.xp * (1 + 0.25 * (e.lv - 1))));
  const [c0, c1] = e.d.coins;
  const coins = randi(c0, c1) + Math.floor(e.lv / 2);
  for (let i = 0; i < Math.min(4, Math.ceil(coins / 4)); i++) dropCoin(e.x + rand(-6, 6), e.y + rand(-4, 4), Math.ceil(coins / Math.min(4, Math.ceil(coins / 4))));
  const r = Math.random();
  if (r < 0.07) dropItem(e.x, e.y, 'bun'); else if (r < 0.11) dropItem(e.x, e.y, 'tonic');
  STORY.onKill(e);
}
function dropCoin(x, y, v) { G.drops.push({ kind: 'coin', x, y, v, t: 0, vz: rand(60, 90), z: 0, vx: rand(-20, 20), vy: rand(-12, 12) }); }
function dropItem(x, y, item) { G.drops.push({ kind: 'item', item, x, y, t: 0, vz: 80, z: 0, vx: 0, vy: 0 }); }

function updateEnemies(dt) {
  const p = G.player;
  for (const e of G.enemies.slice()) {
    e.anim += dt; e.flash = Math.max(0, e.flash - dt);
    if (e.boss) { updateBoss(e, dt); continue; }
    if (e.kbx || e.kby) {
      moveBody(e, e.kbx * dt, e.kby * dt);
      e.kbx *= Math.pow(0.002, dt); e.kby *= Math.pow(0.002, dt);
      if (Math.abs(e.kbx) < 3) e.kbx = 0; if (Math.abs(e.kby) < 3) e.kby = 0;
    }
    if (e.stun > 0) { e.stun -= dt; continue; }
    const d = dist(e, p);
    if (!e.aggro && d < 84 && p.state !== 'ko' && lineClear(e.x, e.y - 6, p.x, p.y - 6)) { e.aggro = true; floatText(e.x, e.y - 24, '!', '#ffd84a'); }
    if (e.aggro && (d > 170 || p.state === 'ko')) e.aggro = false;
    AI[e.d.ai](e, dt, d);
    // touching hurts
    if (e.state !== 'wind' && e.stun <= 0 && rectsOverlap(playerBody(), bodyRect(e))) damagePlayer(e.atk * 0.8, e.x, e.y);
  }
  // soft separation so packs don't stack
  for (let i = 0; i < G.enemies.length; i++) for (let j = i + 1; j < G.enemies.length; j++) {
    const a = G.enemies[i], b = G.enemies[j];
    const dx = b.x - a.x, dy = b.y - a.y, dd = Math.hypot(dx, dy);
    if (dd > 0 && dd < 12) { const push = (12 - dd) * 0.5; if (!b.boss) moveBody(b, dx / dd * push, dy / dd * push); if (!a.boss) moveBody(a, -dx / dd * push, -dy / dd * push); }
  }
}
function toward(e, tx, ty, spd, dt) {
  const dx = tx - e.x, dy = ty - e.y, l = Math.hypot(dx, dy) || 1;
  e.dir = dirFrom(dx, dy);
  return moveBody(e, dx / l * spd * dt, dy / l * spd * dt);
}
function wander(e, dt) {
  e.t -= dt;
  if (e.t <= 0) {
    if (e.state === 'walk') { e.state = 'wander'; e.t = rand(0.8, 2); e.vx = e.vy = 0; }
    else { e.state = 'walk'; e.t = rand(0.6, 1.4); const a = Math.random() * Math.PI * 2; e.vx = Math.cos(a); e.vy = Math.sin(a); e.dir = dirFrom(e.vx, e.vy); }
  }
  if (e.state === 'walk') { if (moveBody(e, e.vx * e.spd * 0.5 * dt, e.vy * e.spd * 0.5 * dt)) e.t = 0; }
}
function enemyShot(e, angle, speed, color, r = 3, dmgMul = 1) {
  spawnShot({ x: e.x, y: e.y - (e.fly ? 16 : 12), vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, r, dmg: e.atk * dmgMul, team: 'e', color, core: '#ffffff', life: 2.5 });
}
const AI = {
  hop(e, dt, d) {
    e.t -= dt;
    if (e.state === 'hop') { if (moveBody(e, e.vx * dt, e.vy * dt)) e.t = 0; if (e.t <= 0) { e.state = 'rest'; e.t = rand(0.4, 0.8); } return; }
    if (e.t > 0) return;
    const p = G.player;
    let a = e.aggro ? Math.atan2(p.y - e.y, p.x - e.x) + rand(-0.4, 0.4) : Math.random() * Math.PI * 2;
    const s = e.spd * (e.aggro ? 2.4 : 1.4);
    e.vx = Math.cos(a) * s; e.vy = Math.sin(a) * s; e.dir = dirFrom(e.vx, e.vy);
    e.state = 'hop'; e.t = 0.35;
  },
  charger(e, dt, d) {
    const p = G.player;
    if (e.state === 'wind') { e.t -= dt; if (e.t <= 0) { e.state = 'dash'; e.t = 0.5; AUDIO.sfx('whiff'); } return; }
    if (e.state === 'dash') { e.t -= dt; if (moveBody(e, e.vx * dt, e.vy * dt) || e.t <= 0) { e.state = 'rest'; e.t = 0.8; } return; }
    if (e.state === 'rest') { e.t -= dt; if (e.t <= 0) e.state = 'wander'; return; }
    if (e.aggro && d < 80) {
      const a = Math.atan2(p.y - e.y, p.x - e.x);
      e.vx = Math.cos(a) * e.spd * 4.2; e.vy = Math.sin(a) * e.spd * 4.2; e.dir = dirFrom(e.vx, e.vy);
      e.state = 'wind'; e.t = 0.45;
      return;
    }
    if (e.aggro) toward(e, p.x, p.y, e.spd, dt); else wander(e, dt);
  },
  melee(e, dt, d) {
    const p = G.player;
    if (e.state === 'wind') { e.t -= dt; if (e.t <= 0) { e.state = 'swing'; e.t = 0.15; AUDIO.sfx('whiff'); } return; }
    if (e.state === 'swing') {
      e.t -= dt;
      const v = DIRV[e.dir];
      const r = { x: e.x - 9 + v[0] * 12, y: e.y - 20 + v[1] * 12, w: 18, h: 20 };
      if (rectsOverlap(r, playerBody())) damagePlayer(e.atk * 1.2, e.x, e.y);
      if (e.t <= 0) { e.state = 'rest'; e.t = 0.5; }
      return;
    }
    if (e.state === 'rest') { e.t -= dt; if (e.t <= 0) e.state = 'wander'; return; }
    if (e.aggro) { if (d < 20) { e.state = 'wind'; e.t = 0.32; e.dir = dirFrom(p.x - e.x, p.y - e.y); } else toward(e, p.x, p.y, e.spd, dt); }
    else wander(e, dt);
  },
  shooter(e, dt, d) {
    const p = G.player;
    e.cool = (e.cool || rand(0.5, 1.5)) - dt;
    if (e.state === 'wind') { e.t -= dt; if (e.t <= 0) { enemyShot(e, Math.atan2(p.y - 8 - (e.y - 12), p.x - e.x), 115, e.d.shot); AUDIO.sfx('blast'); e.state = 'wander'; e.cool = rand(1.5, 2.2); } return; }
    if (!e.aggro) { wander(e, dt); return; }
    e.dir = dirFrom(p.x - e.x, p.y - e.y);
    if (d < 56) toward(e, e.x * 2 - p.x, e.y * 2 - p.y, e.spd, dt);
    else if (d > 100) toward(e, p.x, p.y, e.spd, dt);
    else { const a = Math.atan2(p.y - e.y, p.x - e.x) + Math.PI / 2; moveBody(e, Math.cos(a) * e.spd * 0.5 * dt * (e.side || 1), Math.sin(a) * e.spd * 0.5 * dt * (e.side || 1)); if (Math.random() < dt * 0.5) e.side = -(e.side || 1); }
    if (e.cool <= 0 && d < 130 && lineClear(e.x, e.y - 10, p.x, p.y - 10)) { e.state = 'wind'; e.t = 0.32; }
  },
  flyer(e, dt, d) {
    const p = G.player;
    e.cool = (e.cool || rand(1, 2)) - dt;
    if (!e.aggro) { wander(e, dt); return; }
    e.orbit = (e.orbit || Math.random() * 6) + dt * 0.9;
    const tx = p.x + Math.cos(e.orbit) * 58, ty = p.y + Math.sin(e.orbit) * 40;
    toward(e, tx, ty, e.spd, dt);
    e.dir = p.x < e.x ? 'left' : 'right';
    if (e.cool <= 0) { enemyShot(e, Math.atan2(p.y - 8 - (e.y - 16), p.x - e.x), 100, e.d.shot, 3); AUDIO.sfx('blast'); e.cool = rand(1.8, 2.6); }
  },
  tank(e, dt, d) {
    const p = G.player;
    if (e.state === 'wind') { e.t -= dt; if (e.t <= 0) { addHazard({ kind: 'shock', x: e.x, y: e.y - 4, r: 0, maxR: 28, speed: 140, team: 'e', dmg: e.atk * 1.2, color: '#d8c8a8' }); AUDIO.sfx('crack'); G.shake = 0.15; e.state = 'rest'; e.t = 0.9; } return; }
    if (e.state === 'rest') { e.t -= dt; if (e.t <= 0) e.state = 'wander'; return; }
    if (e.aggro) { if (d < 24) { e.state = 'wind'; e.t = 0.55; } else toward(e, p.x, p.y, e.spd, dt); }
    else wander(e, dt);
  },
  blinker(e, dt, d) {
    const p = G.player;
    e.cool = (e.cool || rand(1, 2)) - dt;
    if (!e.aggro) { wander(e, dt); return; }
    toward(e, p.x, p.y, e.spd * 0.4, dt);
    if (e.cool <= 0) {
      const s = freeSpotNear(p.x, p.y, 70, e.w, e.h, true);
      burst(e.x, e.y - 10, '#e8304a', 6, 30); e.x = s.x; e.y = s.y; burst(e.x, e.y - 10, '#ffffff', 6, 30);
      const a = Math.atan2(p.y - e.y, p.x - e.x);
      for (const o of [-0.25, 0, 0.25]) enemyShot(e, a + o, 110, e.d.shot);
      AUDIO.sfx('warp'); e.cool = rand(2.2, 3);
    }
  },
};

/* ── bosses: a queue of attacks, per phase ──────────────── */
function updateBoss(b, dt) {
  const p = G.player;
  if (b.kbx || b.kby) {
    moveBody(b, b.kbx * dt, b.kby * dt);
    b.kbx *= Math.pow(0.002, dt); b.kby *= Math.pow(0.002, dt);
    if (Math.abs(b.kbx) < 3) b.kbx = 0; if (Math.abs(b.kby) < 3) b.kby = 0;
  }
  if (b.state === 'dying') {
    b.t += dt;
    if (G.t % 0.12 < dt) { burst(b.x + rand(-12, 12), b.y - rand(4, 30), '#ffffff', 6, 40); AUDIO.sfx('hit'); }
    if (b.t > 1.4) { b.gone = true; G.enemies = G.enemies.filter((q) => q !== b); burst(b.x, b.y - 14, '#ffd84a', 30, 90); AUDIO.sfx('boom'); }
    return;
  }
  if (b.ended) return;
  if (b.state === 'intro') { b.t -= dt; if (b.t <= 0) { b.state = 'fight'; b.atk_ = null; } return; }
  if (b.stun > 0) { b.stun -= dt; return; }
  const phases = b.d.phases;
  const want = phases.length > 1 && b.hp < b.maxHp * 0.5 ? 1 : 0;
  if (want !== b.phase) { b.phase = want; b.qi = 0; b.atk_ = null; UI.toast(b.name + ' is getting serious!', '#ff8a8a'); burst(b.x, b.y - 16, '#ff5a5a', 20, 70); AUDIO.sfx('transform'); b.stun = 0.6; return; }
  if (!b.atk_) {
    const q = phases[b.phase];
    const def = q[b.qi % q.length];
    b.atk_ = Object.assign({}, def, { s: 0, time: 0, dur: def.t || 0 });
    b.qi++;
  }
  const A = b.atk_;
  A.time += dt;
  const done = BOSS_ATK[A.k](b, A, dt, p);
  if (done) b.atk_ = null;
  b.minions = b.minions.filter((m) => !m.dead);
  // contact
  if (b.alpha > 0.5 && A.k !== 'teleport' && rectsOverlap(playerBody(), bodyRect(b))) damagePlayer(b.atk * (A.k === 'charge' && A.s === 1 ? 1.3 : 0.8), b.x, b.y);
}
const BOSS_ATK = {
  chase(b, A, dt, p) {
    b.pose = null;
    if (A.s === 0) {
      toward(b, p.x, p.y, b.spd, dt);
      if (dist(b, p) < (b.d.big ? 32 : 22)) { A.s = 1; A.w = 0; A.hit = false; b.dir = dirFrom(p.x - b.x, p.y - b.y); }
    } else {
      A.w += dt;
      b.pose = A.w > 0.25 && A.w < 0.45 ? 'punch1' : 'charge';
      if (A.w > 0.25 && !A.hit) { A.hit = true; AUDIO.sfx('whiff'); }
      if (A.w > 0.25 && A.w < 0.4) {
        const v = DIRV[b.dir], big = b.d.big ? 1.6 : 1;
        const r = { x: b.x - 10 * big + v[0] * 14 * big, y: b.y - 22 * big + v[1] * 12 * big, w: 20 * big, h: 22 * big };
        if (rectsOverlap(r, playerBody())) damagePlayer(b.atk * 1.2, b.x, b.y);
      }
      if (A.w > 0.7) A.s = 0;
    }
    return A.time > (A.dur || 2) && A.s === 0;
  },
  charge(b, A, dt, p) {
    if (A.s === 0) {
      b.pose = 'charge';
      if (A.time < 0.42) { A.ang = Math.atan2(p.y - b.y, p.x - b.x); b.dir = dirFrom(Math.cos(A.ang), Math.sin(A.ang)); }
      if (A.time > (A.tele || 0.62)) { A.s = 1; A.st = A.time; AUDIO.sfx('special'); }
    } else if (A.s === 1) {
      b.pose = 'punch1';
      const s = b.spd * 5.2;
      const hit = moveBody(b, Math.cos(A.ang) * s * dt, Math.sin(A.ang) * s * dt);
      if (G.t % 0.04 < dt) afterimage(b);
      if (hit || A.time - A.st > 0.65) {
        if (hit) { G.shake = 0.3; AUDIO.sfx('crack'); b.stun = 0.55; sparks(b.x, b.y - 8, '#d8c8a8', 10); }
        A.s = 2; A.st = A.time;
      }
    } else { b.pose = null; if (A.time - A.st > 0.4) return true; }
    return false;
  },
  aimed(b, A, dt, p) {
    b.pose = 'blast'; b.dir = dirFrom(p.x - b.x, p.y - b.y);
    if (A.s === 0 && A.time > 0.42) {
      A.s = 1;
      const a = Math.atan2(p.y - 8 - (b.y - 14), p.x - b.x), n = A.n || 3, sp = A.spread || 0.3;
      for (let i = 0; i < n; i++) enemyShot(b, a + (n > 1 ? (i / (n - 1) - 0.5) * sp * 2 : 0), A.speed || 120, A.color, A.size || 3.5);
      AUDIO.sfx('blast');
    }
    if (A.time > 0.95) { b.pose = null; return true; }
    return false;
  },
  ring(b, A, dt, p) {
    b.pose = 'charge';
    if (A.s === 0 && A.time > 0.5) {
      A.s = 1; b.pose = 'blast';
      const o = Math.random() * Math.PI;
      for (let i = 0; i < A.n; i++) enemyShot(b, o + i / A.n * Math.PI * 2, A.speed || 90, A.color, 3.5);
      AUDIO.sfx('special');
    }
    if (A.time > 1.15) { b.pose = null; return true; }
    return false;
  },
  spiral(b, A, dt, p) {
    b.pose = 'blast';
    A.ang = (A.ang || 0) + dt * 3.4;
    A.acc = (A.acc || 0) + dt;
    if (A.time > 0.3 && A.time < 0.3 + A.dur && A.acc > 0.11) {
      A.acc = 0;
      for (let k = 0; k < 3; k++) enemyShot(b, A.ang + k * Math.PI * 2 / 3, 85, A.color, 3);
      if (Math.random() < 0.35) AUDIO.sfx('blast');
    }
    if (A.time > A.dur + 0.8) { b.pose = null; return true; }
    return false;
  },
  stamp(b, A, dt, p) {
    b.pose = 'blast';
    const n = A.n || 3;
    A.made = A.made || 0;
    const mk = (x, y) => addHazard({ kind: 'stamp', x, y, t: 0, delay: 0.95, r: 17, team: 'e', dmg: b.atk * 1.3 });
    if (A.chase) {
      A.acc = (A.acc || 0.3) + dt;
      if (A.made < n && A.acc > 0.42) { A.acc = 0; A.made++; mk(p.x, p.y - 2); }
    } else if (A.made === 0) {
      for (let i = 0; i < n; i++) {
        const s = i === 0 ? { x: p.x, y: p.y - 2 } : freeSpotNear(p.x, p.y, 54, 4, 4, true);
        mk(s.x, s.y); A.made++;
      }
    }
    if (A.made >= n && A.time > (A.chase ? n * 0.42 + 1.4 : 1.6)) { b.pose = null; return true; }
    return false;
  },
  teleport(b, A, dt, p) {
    if (A.s === 0) {
      b.alpha = Math.max(0, 1 - A.time / 0.3);
      if (A.time > 0.3) {
        const v = DIRV[p.dir];
        let tx = p.x - v[0] * 28, ty = p.y - v[1] * 28;
        if (boxBlocked(tx, ty, b.w, b.h, false) || (G.lock && (tx < G.lock.x + 10 || tx > G.lock.x + G.lock.w - 10 || ty < G.lock.y + 14 || ty > G.lock.y + G.lock.h - 4))) {
          const s = freeSpotNear(p.x, p.y, 40, b.w, b.h); tx = s.x; ty = s.y;
        }
        b.x = tx; b.y = ty; b.dir = dirFrom(p.x - b.x, p.y - b.y);
        AUDIO.sfx('warp'); burst(b.x, b.y - 14, '#c8a8ff', 10, 40);
        A.s = 1; A.st = A.time;
      }
    } else if (A.s === 1) {
      b.alpha = Math.min(1, (A.time - A.st) / 0.18);
      if (A.time - A.st > 0.22) { if (!A.strike) { b.alpha = 1; return true; } A.s = 2; A.st = A.time; }
    } else {
      const w = A.time - A.st;
      b.pose = w < 0.22 ? 'charge' : 'punch1';
      if (w > 0.22 && w < 0.36) {
        const v = DIRV[b.dir];
        const r = { x: b.x - 11 + v[0] * 14, y: b.y - 22 + v[1] * 12, w: 22, h: 22 };
        if (rectsOverlap(r, playerBody())) damagePlayer(b.atk * 1.3, b.x, b.y);
        if (!A.sw) { A.sw = true; AUDIO.sfx('whiff'); }
      }
      if (w > 0.75) { b.pose = null; return true; }
    }
    return false;
  },
  summon(b, A, dt, p) {
    b.pose = 'blast';
    if (A.s === 0 && A.time > 0.55) {
      A.s = 1;
      const room = (A.max || 3) - b.minions.length;
      for (let i = 0; i < Math.min(A.n, room); i++) {
        const s = freeSpotNear(b.x, b.y, 40, 12, 8);
        const e = spawnEnemy(A.what, Math.max(1, b.lv - 2), s.x, s.y);
        e.aggro = true; b.minions.push(e);
        burst(s.x, s.y - 8, '#ffffff', 10, 40);
      }
      if (room > 0) AUDIO.sfx('warp');
    }
    if (A.time > 1.0) { b.pose = null; return true; }
    return false;
  },
  beam(b, A, dt, p) {
    b.pose = 'blast';
    if (A.s === 0) {
      if (A.time < 0.45) { A.ang = Math.atan2(p.y - 10 - (b.y - 14), p.x - b.x); b.dir = dirFrom(Math.cos(A.ang), Math.sin(A.ang)); }
      if (A.time > 0.8) { A.s = 1; A.st = A.time; AUDIO.sfx('beam'); G.shake = 0.3; }
    } else if (A.s === 1) {
      const ox = b.x, oy = b.y - 14, dx = Math.cos(A.ang), dy = Math.sin(A.ang);
      const px = p.x - ox, py = p.y - 10 - oy, along = px * dx + py * dy, perp = Math.abs(px * dy - py * dx);
      if (along > 0 && perp < 9) damagePlayer(b.atk * 1.4, p.x - dx * 10, p.y - dy * 10);
      G.shake = Math.max(G.shake, 0.05);
      if (A.time - A.st > (A.dur || 0.9)) { A.s = 2; A.st = A.time; }
    } else if (A.time - A.st > 0.35) { b.pose = null; return true; }
    return false;
  },
  slam(b, A, dt, p) {
    b.pose = A.time < 0.6 ? 'charge' : 'kick';
    if (A.s === 0 && A.time > 0.6) {
      A.s = 1;
      addHazard({ kind: 'shock', x: b.x, y: b.y - 4, r: 0, maxR: A.r || 40, speed: 170, team: 'e', dmg: b.atk * 1.3, color: b.d.big ? '#ff8a2a' : '#d8c8a8' });
      AUDIO.sfx('crack'); G.shake = 0.35;
    }
    if (A.time > 1.2) { b.pose = null; return true; }
    return false;
  },
  mimic(b, A, dt, p) {
    if (!A.sub) {
      A.sub = ['charge', 'ring', 'beam'][Math.floor(Math.random() * 3)];
      A.color = DATA.HEROES[G.active].kiColor; A.n = 12; A.speed = 110; A.dur = 0.7; A.tele = 0.45;
      floatText(b.x, b.y - 30, ['COMET RUSH?', 'NOVA RING?', 'SOLAR LANCE?'][['charge', 'ring', 'beam'].indexOf(A.sub)], '#8a6aff');
    }
    return BOSS_ATK[A.sub](b, A, dt, p);
  },
};

/* ════════════════════════════════════════════════════════
   SHOTS, HAZARDS, EFFECTS
   ════════════════════════════════════════════════════════ */
function spawnShot(o) { o.t = 0; o.hit = new Set(); o.h = o.h || 12; G.shots.push(o); return o; }
function circleRect(s, r) {
  const cx = clamp(s.x, r.x, r.x + r.w), cy = clamp(s.y, r.y, r.y + r.h);
  return (s.x - cx) ** 2 + (s.y - cy) ** 2 < s.r * s.r + 4;
}
function updateShots(dt) {
  const m = G.map;
  for (const s of G.shots.slice()) {
    s.t += dt; s.x += s.vx * dt; s.y += s.vy * dt;
    let dead = s.t > s.life;
    const tx = Math.floor(s.x / TS), ty = Math.floor((s.y + s.h - 2) / TS);
    const sol = (tx < 0 || ty < 0 || tx >= m.w || ty >= m.h) ? 2 : m.solid[ty * m.w + tx];
    if (!dead && sol >= 2) {
      if (sol === 3 && s.team === 'p') hitProp(propAtTile(tx, ty), { ki: true, burn: s.burn, heavy: s.heavy });
      sparks(s.x, s.y, s.color, 5);
      dead = true;
    }
    if (!dead && s.team === 'p') {
      for (const e of G.enemies) {
        if (s.hit.has(e) || !circleRect(s, bodyRect(e))) continue;
        s.hit.add(e);
        hitEnemy(e, s.dmg, s.vx * 0.5, s.vy * 0.5, { heavy: s.heavy });
        if (!s.pierce) { dead = true; break; }
      }
    } else if (!dead && circleRect(s, playerBody()) && G.player.state !== 'ko') {
      if (G.player.guard > 0) {
        s.team = 'p'; s.vx *= -1.4; s.vy *= -1.4; s.dmg = hero().pow * 2; s.hit = new Set(); s.color = DATA.HEROES[G.active].kiColor;
        AUDIO.sfx('reflect'); sparks(s.x, s.y, '#9af0ff', 6);
      } else if (damagePlayer(s.dmg, s.x - s.vx * 0.1, s.y - s.vy * 0.1)) dead = true;
    }
    if (s.big && G.t % 0.03 < dt) G.parts.push({ x: s.x + rand(-3, 3), y: s.y + rand(-3, 3), vx: 0, vy: 0, life: 0.25, max: 0.25, color: s.color, size: 2, glow: true });
    if (dead) G.shots = G.shots.filter((q) => q !== s);
  }
}

function addHazard(h) { h.t = h.t || 0; h.hitSet = new Set(); G.hazards.push(h); return h; }
function updateHazards(dt) {
  const p = G.player;
  for (const h of G.hazards.slice()) {
    h.t += dt;
    if (h.kind === 'shock') {
      h.r = Math.min(h.maxR, h.r + h.speed * dt);
      const band = (x, y) => { const d = Math.hypot(x - h.x, (y - h.y) * 1.4); return d < h.r + 4 && d > h.r - 12; };
      if (h.team === 'p') {
        for (const e of G.enemies) if (!h.hitSet.has(e) && band(e.x, e.y)) {
          h.hitSet.add(e);
          const a = Math.atan2(e.y - h.y, e.x - h.x), kb = h.kb || 100;
          hitEnemy(e, h.dmg, Math.cos(a) * kb, Math.sin(a) * kb, { heavy: true, stun: h.stun });
        }
        for (const pr of G.props) if (pr.onHit && !h.hitSet.has(pr) && band(pr.x, pr.y)) { h.hitSet.add(pr); hitProp(pr, { ki: true, burn: !!h.burn, heavy: !!h.heavy }); }
      } else if (!h.hitSet.has(p) && band(p.x, p.y)) { h.hitSet.add(p); damagePlayer(h.dmg, h.x, h.y); }
      if (h.r >= h.maxR) { h.fade = (h.fade || 0) + dt; if (h.fade > 0.15) G.hazards = G.hazards.filter((q) => q !== h); }
    } else if (h.kind === 'stamp') {
      if (!h.fired && h.t >= h.delay) {
        h.fired = true;
        AUDIO.sfx('stamp'); G.shake = Math.max(G.shake, 0.2);
        burst(h.x, h.y, '#c0303a', 8, 50); burst(h.x, h.y, '#f4f0e6', 6, 40);
        if (Math.hypot(p.x - h.x, (p.y - h.y) * 1.3) < h.r + 4) damagePlayer(h.dmg, h.x, h.y - 10);
      }
      if (h.t > h.delay + 0.5) G.hazards = G.hazards.filter((q) => q !== h);
    }
  }
}

function burst(x, y, color, n, spd) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, s = rand(0.3, 1) * spd;
    G.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rand(0.25, 0.55), max: 0.55, color, size: Math.random() < 0.3 ? 2 : 1, drag: 3 });
  }
}
function sparks(x, y, color, n) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, s = rand(40, 110);
    G.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rand(0.1, 0.25), max: 0.25, color, size: 1, drag: 6, glow: true });
  }
}
function flame(e, color) {
  G.parts.push({ x: e.x + rand(-6, 6), y: e.y - rand(2, 22), vx: rand(-6, 6), vy: rand(-50, -30), life: rand(0.25, 0.45), max: 0.45, color: Math.random() < 0.4 ? '#ffffff' : color, size: Math.random() < 0.5 ? 2 : 1, glow: true });
}
function chargeSpark(e, color) {
  const a = Math.random() * Math.PI * 2, r = rand(14, 20);
  G.parts.push({ x: e.x + Math.cos(a) * r, y: e.y - 12 + Math.sin(a) * r, vx: -Math.cos(a) * r * 3, vy: -Math.sin(a) * r * 3, life: 0.3, max: 0.3, color, size: 1, glow: true });
}
function afterimage(e) {
  const img = actorFrame(e);
  if (img) G.parts.push({ img, x: e.x, y: e.y, life: 0.2, max: 0.2, ghost: true, ox: e._ox || 12, oy: e._oy || 31 });
}
function floatText(x, y, text, color) { G.texts.push({ x, y, text, color, life: 0.8 }); }
function updateEffects(dt) {
  for (const q of G.parts) {
    q.life -= dt;
    if (q.ghost) continue;
    q.x += q.vx * dt; q.y += q.vy * dt;
    if (q.drag) { q.vx *= Math.pow(0.5, dt * q.drag); q.vy *= Math.pow(0.5, dt * q.drag); }
    if (q.grav) q.vy += q.grav * dt;
  }
  G.parts = G.parts.filter((q) => q.life > 0);
  if (G.parts.length > 400) G.parts.splice(0, G.parts.length - 400);
  for (const t of G.texts) { t.life -= dt; t.y -= 22 * dt; }
  G.texts = G.texts.filter((t) => t.life > 0);
  // pickups
  const p = G.player;
  for (const d of G.drops) {
    d.t += dt;
    d.vz -= 260 * dt; d.z = Math.max(0, d.z + d.vz * dt);
    if (d.z === 0) { d.vz = d.vz < -40 ? -d.vz * 0.4 : 0; d.vx *= 0.8; d.vy *= 0.8; }
    d.x += d.vx * dt; d.y += d.vy * dt;
    const dd = Math.hypot(p.x - d.x, p.y - d.y);
    if (d.t > 0.35 && dd < 30 && p.state !== 'ko') { d.x += (p.x - d.x) * dt * 10; d.y += (p.y - d.y) * dt * 10; }
    if (d.t > 0.35 && dd < 8 && p.state !== 'ko') {
      d.got = true;
      if (d.kind === 'coin') { G.coins += d.v; AUDIO.sfx('coin'); }
      else giveItem(d.item);
    }
  }
  G.drops = G.drops.filter((d) => !d.got && d.t < 14);
}

/* ════════════════════════════════════════════════════════
   CAMERA & DRAWING
   ════════════════════════════════════════════════════════ */
function snapCamera() {
  const m = G.map, p = G.player;
  G.cam.x = m.W <= VW ? (m.W - VW) / 2 : clamp(p.x - VW / 2, 0, m.W - VW);
  G.cam.y = m.H <= VH ? (m.H - VH) / 2 : clamp(p.y - 10 - VH / 2, 0, m.H - VH);
}
function updateCamera(dt) {
  const m = G.map, p = G.player;
  const v = DIRV[p.dir];
  const tx = m.W <= VW ? (m.W - VW) / 2 : clamp(p.x + v[0] * 12 - VW / 2, 0, m.W - VW);
  const ty = m.H <= VH ? (m.H - VH) / 2 : clamp(p.y - 10 + v[1] * 8 - VH / 2, 0, m.H - VH);
  const k = 1 - Math.pow(0.0005, dt);
  G.cam.x += (tx - G.cam.x) * k; G.cam.y += (ty - G.cam.y) * k;
  if (Math.abs(tx - G.cam.x) > 160 || Math.abs(ty - G.cam.y) > 120) { G.cam.x = tx; G.cam.y = ty; }
}

function playerPose(p) {
  switch (p.state) {
    case 'move': return p.walkT > 0 ? ['walk1', 'idle', 'walk2', 'idle'][Math.floor(p.walkT * 8) % 4] : 'idle';
    case 'punch': return ['punch1', 'punch2', 'kick'][p.combo];
    case 'charge': return p.t > 0.18 ? 'charge' : 'blast';
    case 'blast': case 'beam': return 'blast';
    case 'dash': return 'punch1';
    case 'pose': return p.poseName || 'charge';
    case 'guard': return 'charge';
    case 'hurt': return 'hurt';
  }
  return 'idle';
}
function nullLook() {
  const base = DATA.LOOKS[DATA.HEROES[G.active].look];
  const key = 'null_' + G.active;
  if (!DATA.LOOKS[key]) DATA.LOOKS[key] = Object.assign({}, base, { skin: '#2a2440', hair: '#141022', top: '#1a1430', under: '#2a2440', pants: '#100c1c', shoes: '#08060e', eyes: '#ffffff', glowEyes: true, accent: '#8a6aff', belt: '#8a6aff', wrist: '#8a6aff', sleeve: '#2a2440', brows: null, blush: null });
  return key;
}
/* The canvas an actor shows right now (also used for afterimages). */
function actorFrame(e) {
  e._ox = 12; e._oy = 31;
  if (e.kind === 'player') {
    const sh = personSheet(heroLook(hero()));
    if (e.state === 'ko') { e._ox = 16; e._oy = 20; return sh.ko; }
    return sh[e.dir][playerPose(e)];
  }
  if (e.kind === 'npc') {
    if (e.creature) { const c = creatureSheet(e.creature); e._ox = c.w / 2; e._oy = c.h - 1; const f = Math.floor(G.t * 3) % c.left.length; return (e.dir === 'right' ? c.right : c.left)[f]; }
    const sh = personSheet(e.look);
    if (e.ko) { e._ox = 16; e._oy = 20; return sh.ko; }
    const pose = e.pose || (e.walkT > 0 ? ['walk1', 'idle', 'walk2', 'idle'][Math.floor(e.walkT * 7) % 4] : 'idle');
    return sh[e.dir][pose];
  }
  // enemies and bosses
  if (e.art[0] === 'person' || e.art[0] === 'null') {
    const look = e.art[0] === 'null' ? nullLook() : e.art[1];
    const sh = personSheet(look);
    let pose = e.pose;
    if (!pose) {
      if (e.state === 'wind') pose = 'charge';
      else if (e.state === 'swing') pose = 'punch1';
      else if (e.stun > 0 && !e.boss) pose = 'hurt';
      else pose = ['walk1', 'idle', 'walk2', 'idle'][Math.floor(e.anim * 7) % 4];
    }
    return sh[e.dir][pose] || sh[e.dir].idle;
  }
  const c = creatureSheet(e.art);
  e._ox = Math.floor(c.w / 2); e._oy = c.h - 1;
  if (e.dir === 'left' || e.dir === 'right') e.face = e.dir;
  const n = c.left.length;
  let f = Math.floor(e.anim * (e.state === 'dash' || e.state === 'hop' ? 10 : 4)) % Math.min(n, 2);
  if (e.boss && n > 2 && (e.pose === 'charge' || e.pose === 'kick')) f = 2;
  return (e.face === 'right' ? c.right : c.left)[f];
}

function drawActor(ctx, e, cx, cy) {
  const img = actorFrame(e);
  if (!img) return;
  let x = Math.round(e.x - cx - e._ox), y = Math.round(e.y - cy - e._oy);
  if (e.fly) y -= 6 + Math.round(Math.sin(G.t * 5 + (e.bob || 0)) * 2);
  if (e.float) y -= 4 + Math.round(Math.sin(G.t * 3) * 1.5);
  if (e.kind === 'enemy' && e.state === 'wind' && !e.boss) x += Math.round(Math.sin(G.t * 60));
  if (e.kind === 'player' && e.invuln > 0 && e.state !== 'hurt' && Math.floor(G.t * 16) % 2) return;
  if (e.alpha !== undefined && e.alpha < 1) ctx.globalAlpha = Math.max(0, e.alpha);
  if (e.boss && e.state === 'dying' && Math.floor(G.t * 20) % 2) ctx.globalAlpha = 0.4;
  ctx.drawImage((e.flash > 0 || e.flashT > 0) ? GFX.flash(img) : img, x, y);
  ctx.globalAlpha = 1;
}

function drawWorld(ctx) {
  const m = G.map;
  let cx = Math.round(G.cam.x), cy = Math.round(G.cam.y);
  if (G.shake > 0) { cx += Math.round(rand(-2, 2) * Math.min(1, G.shake * 4)); cy += Math.round(rand(-2, 2) * Math.min(1, G.shake * 4)); }
  ctx.fillStyle = m.bg || '#000000';
  ctx.fillRect(0, 0, VW, VH);
  // ground (the part of the baked canvas under the camera)
  const sx = Math.max(0, cx), sy = Math.max(0, cy);
  const dx = sx - cx, dy = sy - cy;
  const w = Math.min(VW - dx, m.W - sx), h = Math.min(VH - dy, m.H - sy);
  if (w > 0 && h > 0) ctx.drawImage(m.ground, sx, sy, w, h, dx, dy, w, h);
  drawGroundLife(ctx, cx, cy);
  // telegraphs on the ground
  for (const hz of G.hazards) {
    if (hz.kind === 'stamp' && !hz.fired) {
      const k = Math.min(1, hz.t / hz.delay);
      ctx.globalAlpha = 0.25 + 0.35 * k;
      ellipse(ctx, hz.x - cx, hz.y - cy, hz.r * (0.4 + 0.6 * k), hz.r * 0.65 * (0.4 + 0.6 * k), Math.floor(G.t * 12) % 2 ? '#e0303a' : '#701a28');
      ctx.globalAlpha = 1;
    }
  }
  for (const e of G.enemies) if (e.boss && e.atk_) drawTelegraph(ctx, e, cx, cy);
  // shadows
  const P = G.player;
  for (const e of [...G.enemies, ...G.npcs, P]) {
    if (e.kind === 'player' && e.state === 'ko') continue;
    if (e.alpha !== undefined && e.alpha < 0.5) continue;
    const sw = e.boss && e.d.big ? 30 : e.w + 4;
    const s = shadowOf(sw);
    ctx.drawImage(s, Math.round(e.x - cx - s.width / 2), Math.round(e.y - cy - s.height / 2));
  }
  // y-sorted world
  const list = [];
  for (const pr of G.props) if (pr.x > cx - 60 && pr.x < cx + VW + 60 && pr.y > cy - 10 && pr.y < cy + VH + 80) list.push(pr);
  for (const n of G.npcs) list.push(n);
  for (const e of G.enemies) list.push(e);
  for (const d of G.drops) list.push(d);
  list.push(P);
  list.sort((a, b) => (a.y + (a.sortOff || 0)) - (b.y + (b.sortOff || 0)));
  for (const o of list) {
    if (o.kind === 'prop' || o.solidTiles) drawProp(ctx, o, cx, cy);
    else if (o.kind === 'coin' || o.kind === 'item') drawDrop(ctx, o, cx, cy);
    else drawActor(ctx, o, cx, cy);
  }
  // auras behind nothing in particular: drawn over, additively, so they glow
  ctx.globalCompositeOperation = 'lighter';
  if (P.state === 'charge' && P.t > 0.18) {
    const H = DATA.HEROES[G.active];
    ctx.globalAlpha = 0.25 + 0.15 * Math.sin(G.t * 30);
    const o = orb(11, H.kiColor, H.kiColor);
    ctx.drawImage(o, Math.round(P.x - cx - o.width / 2), Math.round(P.y - cy - 14 - o.height / 2));
    ctx.globalAlpha = 1;
  }
  if (P.od) {
    const H = DATA.HEROES[G.active];
    ctx.globalAlpha = 0.18 + 0.08 * Math.sin(G.t * 20);
    const o = orb(12, H.kiColor, '#ffffff');
    ctx.drawImage(o, Math.round(P.x - cx - o.width / 2), Math.round(P.y - cy - 14 - o.height / 2));
    ctx.globalAlpha = 1;
  }
  if (P.guard > 0) {
    ctx.globalAlpha = 0.3 + 0.2 * Math.sin(G.t * 25);
    ellipse(ctx, P.x - cx, P.y - cy - 12, 13, 16, '#5ad8ff');
    ctx.globalAlpha = 1;
  }
  if (P.state === 'beam') drawPlayerBeam(ctx, P, cx, cy);
  for (const s of G.shots) {
    const shadowY = s.y + s.h;
    ctx.globalCompositeOperation = 'source-over';
    const sh = shadowOf(s.r * 2 + 2);
    ctx.drawImage(sh, Math.round(s.x - cx - sh.width / 2), Math.round(shadowY - cy - sh.height / 2));
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.35;
    const halo = orb(s.r + 2, s.color, s.color);
    ctx.drawImage(halo, Math.round(s.x - cx - halo.width / 2), Math.round(s.y - cy - halo.height / 2));
    ctx.globalAlpha = 1;
    const o = orb(s.r, s.color, s.core || '#ffffff');
    ctx.drawImage(o, Math.round(s.x - cx - o.width / 2), Math.round(s.y - cy - o.height / 2));
  }
  for (const hz of G.hazards) {
    if (hz.kind === 'shock') {
      ctx.globalAlpha = Math.max(0, 0.8 - (hz.fade || 0) * 5);
      ring(ctx, hz.x - cx, hz.y - cy, hz.r, hz.r * 0.7, hz.color);
      ring(ctx, hz.x - cx, hz.y - cy, Math.max(0, hz.r - 3), Math.max(0, hz.r - 3) * 0.7, '#ffffff');
      ctx.globalAlpha = 1;
    }
  }
  for (const q of G.parts) {
    if (q.ghost) continue;
    ctx.globalAlpha = Math.min(1, q.life / q.max * 1.5);
    ctx.fillStyle = q.color;
    ctx.fillRect(Math.round(q.x - cx), Math.round(q.y - cy), q.size, q.size);
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  for (const q of G.parts) {
    if (!q.ghost) continue;
    ctx.globalAlpha = q.life / q.max * 0.5;
    ctx.drawImage(GFX.tint(q.img, DATA.HEROES[G.active].kiColor), Math.round(q.x - cx - q.ox), Math.round(q.y - cy - q.oy));
  }
  ctx.globalAlpha = 1;
  // stamps falling from the sky
  for (const hz of G.hazards) if (hz.kind === 'stamp') {
    const img = SPR.stamp;
    const k = Math.min(1, hz.t / hz.delay);
    const drop = hz.fired ? 0 : (1 - k * k) * 90;
    if (!hz.fired && k < 0.35) continue;
    ctx.drawImage(img, Math.round(hz.x - cx - 10), Math.round(hz.y - cy - 20 - drop));
  }
  // numbers
  for (const t of G.texts) FONT.draw(ctx, t.text, t.x - cx, t.y - cy, t.color, { align: 'center' });
}

function drawTelegraph(ctx, b, cx, cy) {
  const A = b.atk_;
  if ((A.k === 'charge' || (A.k === 'mimic' && A.sub === 'charge')) && A.s === 0 && A.ang !== undefined) {
    ctx.fillStyle = Math.floor(G.t * 14) % 2 ? '#ff5a5a' : '#ffd84a';
    for (let d = 14; d < 110; d += 6) ctx.fillRect(Math.round(b.x - cx + Math.cos(A.ang) * d), Math.round(b.y - cy - 4 + Math.sin(A.ang) * d), 2, 2);
  }
  if ((A.k === 'beam' || (A.k === 'mimic' && A.sub === 'beam')) && A.ang !== undefined) {
    const ox = b.x - cx, oy = b.y - cy - 14;
    ctx.save();
    ctx.translate(Math.round(ox), Math.round(oy));
    ctx.rotate(A.ang);
    if (A.s === 0) { ctx.globalAlpha = 0.5 + 0.5 * Math.sin(G.t * 40); ctx.fillStyle = '#ff5a5a'; ctx.fillRect(8, -1, 400, 2); }
    else if (A.s === 1) {
      const col = A.color || '#c8a8ff';
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = col; ctx.fillRect(6, -8 - Math.sin(G.t * 50), 400, 16 + 2 * Math.sin(G.t * 50));
      ctx.fillStyle = '#ffffff'; ctx.fillRect(6, -3, 400, 6);
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }
}
function beamLength(x, y, dir) {
  const v = DIRV[dir];
  for (let d = 0; d < 220; d += 4) {
    const tx = Math.floor((x + v[0] * d) / TS), ty = Math.floor((y + 12 + v[1] * d) / TS);
    const m = G.map;
    if (tx < 0 || ty < 0 || tx >= m.w || ty >= m.h) return d;
    const s = m.solid[ty * m.w + tx];
    if (s === 2) return d;
  }
  return 220;
}
function beamRect(x, y, dir, w, len) {
  len = Math.min(len, beamLength(x, y, dir));
  switch (dir) {
    case 'up': return { x: x - w / 2, y: y - len, w, h: len };
    case 'down': return { x: x - w / 2, y: y + 4, w, h: len };
    case 'left': return { x: x - len, y: y - w / 2, w: len, h: w };
    default: return { x: x + 4, y: y - w / 2, w: len, h: w };
  }
}
function drawPlayerBeam(ctx, p, cx, cy) {
  const H = DATA.HEROES[G.active];
  const wob = Math.sin(G.t * 60) > 0 ? 1 : 0;
  const r = beamRect(p.x, p.y - 12, p.dir, 10 + wob * 2, 200);
  const core = beamRect(p.x, p.y - 12, p.dir, 4, 200);
  ctx.globalAlpha = 0.9;
  ctx.fillStyle = H.kiColor; ctx.fillRect(Math.round(r.x - cx), Math.round(r.y - cy), Math.round(r.w), Math.round(r.h));
  ctx.fillStyle = '#ffffff'; ctx.fillRect(Math.round(core.x - cx), Math.round(core.y - cy), Math.round(core.w), Math.round(core.h));
  ctx.globalAlpha = 1;
}
function ellipse(ctx, x, y, rx, ry, color) {
  ctx.fillStyle = color;
  ry = Math.max(1, ry);
  for (let j = -Math.ceil(ry); j <= Math.ceil(ry); j++) {
    const w = Math.round(rx * Math.sqrt(Math.max(0, 1 - (j * j) / (ry * ry))));
    if (w > 0) ctx.fillRect(Math.round(x - w), Math.round(y + j), w * 2, 1);
  }
}
function ring(ctx, x, y, rx, ry, color) {
  ctx.fillStyle = color;
  const n = Math.max(12, Math.round(rx * 1.6));
  for (let i = 0; i < n; i++) {
    const a = i / n * Math.PI * 2;
    ctx.fillRect(Math.round(x + Math.cos(a) * rx), Math.round(y + Math.sin(a) * ry), 2, 2);
  }
}

function drawProp(ctx, pr, cx, cy) {
  if (pr.hidden && !pr.revealed) return;
  let img = pr.img;
  if (pr.frames) img = pr.frames[pr.frameFn ? pr.frameFn(pr) : Math.floor(G.t * (pr.fps || 6)) % pr.frames.length];
  if (!img) return;
  let x = Math.round(pr.x - cx - img.width / 2 + (pr.ox || 0)), y = Math.round(pr.y - cy - img.height + 1 + (pr.oy || 0));
  if (pr.wobble > 0) { x += Math.round(Math.sin(G.t * 50) * 1.5); pr.wobble -= 1 / 60; }
  if (pr.hidden && Math.floor(G.t * 4) % 2) ctx.globalAlpha = 0.75;
  ctx.drawImage(pr.flash > 0 ? GFX.flash(img) : img, x, y);
  if (pr.flash > 0) pr.flash -= 1 / 60;
  ctx.globalAlpha = 1;
}
function drawDrop(ctx, d, cx, cy) {
  if (d.t > 11 && Math.floor(d.t * 8) % 2) return;
  const x = Math.round(d.x - cx), y = Math.round(d.y - cy - d.z);
  if (d.kind === 'coin') {
    const f = Math.floor(d.t * 8) % 4, w = [4, 3, 1, 3][f];
    ctx.fillStyle = '#7a5a10'; ctx.fillRect(x - w / 2 - 1, y - 6, w + 2, 6);
    ctx.fillStyle = '#ffd84a'; ctx.fillRect(x - w / 2, y - 5, w, 4);
    ctx.fillStyle = '#fff2a0'; if (w > 2) ctx.fillRect(x - w / 2, y - 5, 1, 2);
  } else UI.itemIcon(ctx, d.item, x - 5, y - 10);
}

/* Moving water, breathing lava, twinkling void — over the baked ground. */
function drawGroundLife(ctx, cx, cy) {
  const m = G.map;
  const x0 = Math.max(0, Math.floor(cx / TS)), x1 = Math.min(m.w - 1, Math.floor((cx + VW) / TS));
  const y0 = Math.max(0, Math.floor(cy / TS)), y1 = Math.min(m.h - 1, Math.floor((cy + VH) / TS));
  const t = G.t;
  for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
    const k = m.rows[ty][tx];
    if (k === 'w') {
      for (let i = 0; i < 2; i++) {
        const ph = GFX.hash(tx, ty, i) * 10;
        const px = tx * TS + ((GFX.hash(tx, ty, i + 5) * 14 + t * 6) % 14) + 1, py = ty * TS + 3 + Math.floor(GFX.hash(tx, ty, i + 9) * 11);
        if (Math.sin(t * 2 + ph) > 0.2) { ctx.fillStyle = '#c8e8ff'; ctx.fillRect(Math.round(px - cx), Math.round(py - cy), 2, 1); }
      }
    } else if (k === 'l') {
      const a = 0.12 + 0.1 * Math.sin(t * 2.5 + GFX.hash(tx, ty) * 6);
      ctx.globalAlpha = a; ctx.fillStyle = '#ffe14a';
      ctx.fillRect(tx * TS - cx, ty * TS - cy, TS, TS);
      ctx.globalAlpha = 1;
      if (GFX.hash(tx, ty, Math.floor(t * 1.5)) < 0.08) { ctx.fillStyle = '#fff2a0'; ctx.fillRect(Math.round(tx * TS + 6 - cx), Math.round(ty * TS + 7 - cy), 3, 2); }
    } else if (k === 'v') {
      if (GFX.hash(tx, ty, 3) < 0.25) {
        const tw = Math.sin(t * 3 + GFX.hash(tx, ty) * 20);
        if (tw > 0.6) { ctx.fillStyle = '#ffffff'; ctx.fillRect(Math.round(tx * TS + GFX.hash(tx, ty, 4) * 14 - cx), Math.round(ty * TS + GFX.hash(tx, ty, 6) * 14 - cy), 1, 1); }
      }
    }
  }
}

/* ════════════════════════════════════════════════════════
   THE FRAME
   ════════════════════════════════════════════════════════ */
function updateWorld(dt) {
  G.shake = Math.max(0, G.shake - dt);
  G.bumpCool = Math.max(0, G.bumpCool - dt);
  if (G.hitstop > 0) { G.hitstop--; updateEffects(dt * 0.2); return; }
  G.playTime += dt;
  updatePlayer(dt);
  updateNpcs(dt);
  updateEnemies(dt);
  updateShots(dt);
  updateHazards(dt);
  updateEffects(dt);
  updateCamera(dt);
  if (!G.script && !UI.modal()) checkExits();
}
function updateNpcs(dt) {
  for (const n of G.npcs) {
    if (n.path) {
      const [tx, ty] = n.path;
      const dx = tx - n.x, dy = ty - n.y, d = Math.hypot(dx, dy);
      const step = (n.speed || 50) * dt;
      if (d <= step) { n.x = tx; n.y = ty; n.path = null; n.walkT = 0; }
      else { n.x += dx / d * step; n.y += dy / d * step; n.dir = dirFrom(dx, dy); n.walkT += dt; }
    } else if (n.wander && !G.script) {
      n.t -= dt;
      if (n.t <= 0) {
        n.t = rand(1.5, 3.5);
        if (Math.random() < 0.5) { const a = Math.random() * 6.28; n.wv = [Math.cos(a), Math.sin(a)]; n.wt = rand(0.4, 1); }
      }
      if (n.wt > 0) {
        n.wt -= dt; n.walkT += dt; n.dir = dirFrom(n.wv[0], n.wv[1]);
        const nx = n.x + n.wv[0] * 22 * dt, ny = n.y + n.wv[1] * 22 * dt;
        if (Math.hypot(nx - n.home.x, ny - n.home.y) < 24 && !boxBlocked(nx, ny, n.w, n.h) && Math.hypot(nx - G.player.x, ny - G.player.y) > 14) { n.x = nx; n.y = ny; }
        else n.wt = 0;
      } else n.walkT = 0;
    }
  }
}
function checkExits() {
  const p = G.player, m = G.map;
  for (const ex of m.exits) {
    if (p.x >= ex.x * TS && p.x < (ex.x + ex.w) * TS && p.y - 2 >= ex.y * TS && p.y - 2 < (ex.y + ex.h) * TS) {
      if (ex.cond && !ex.cond()) { if (G.bumpCool <= 0) { G.bumpCool = 2; if (ex.deny) STORY.run(ex.deny); } return; }
      STORY.run(function* () { yield* SCRIPT.warp(ex.to, ex.tx, ex.ty, ex.dir); });
      return;
    }
  }
  for (const tr of m.triggers) {
    if (tr.flag && G.flags[tr.flag]) continue;
    if (tr.when && !tr.when()) continue;
    if (p.x >= tr.x * TS && p.x < (tr.x + tr.w) * TS && p.y >= tr.y * TS && p.y < (tr.y + tr.h) * TS) {
      if (tr.flag) G.flags[tr.flag] = true;
      STORY.run(tr.fn);
      return;
    }
  }
}
