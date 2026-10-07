/* SKYBREAKER — places.

   Every map is built by code rather than typed out tile by tile: lay down
   ground, carve roads (which also keeps trees off them), drop buildings and
   props, then scatter trees into whatever is left.  Each builder returns the
   same shape — ground rows, props, people, spawn zones, exits and triggers —
   and loadMap() in engine.js does the rest. */
'use strict';

class MapBuilder {
  constructor(w, h, fill) {
    this.w = w; this.h = h;
    this.rows = Array.from({ length: h }, () => Array(w).fill(fill));
    this.res = new Uint8Array(w * h);
    this.occ = new Uint8Array(w * h);
    this.props = []; this.npcs = []; this.zones = []; this.exits = []; this.triggers = [];
  }
  in(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h; }
  set(x, y, t) { if (this.in(x, y)) this.rows[y][x] = t; }
  get(x, y) { return this.in(x, y) ? this.rows[y][x] : null; }
  fill(x, y, w, h, t) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, t); return this; }
  ellipse(cx, cy, rx, ry, t, onlyOn) {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const dx = (x - cx) / rx, dy = (y - cy) / ry;
      if (dx * dx + dy * dy <= 1 && (!onlyOn || onlyOn.includes(this.get(x, y)))) this.set(x, y, t);
    }
    return this;
  }
  reserve(x, y, w, h) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if (this.in(x + i, y + j)) this.res[(y + j) * this.w + x + i] = 1; return this; }
  /* a road through points, `wid` tiles wide; reserves a margin either side */
  path(pts, wid, t, margin = 1) {
    for (let k = 0; k < pts.length - 1; k++) {
      const [x0, y0] = pts[k], [x1, y1] = pts[k + 1];
      const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
      for (let i = 0; i <= n; i++) {
        const x = Math.round(x0 + (x1 - x0) * i / n), y = Math.round(y0 + (y1 - y0) * i / n);
        this.fill(x, y, wid, wid, t);
        this.reserve(x - margin, y - margin, wid + margin * 2, wid + margin * 2);
      }
    }
    return this;
  }
  free(x, y) {
    if (!this.in(x, y)) return false;
    const i = y * this.w + x;
    return !this.res[i] && !this.occ[i] && !GFX.SOLID_GROUND[this.rows[y][x]];
  }
  add(p, tiles) {
    for (const [x, y] of tiles || [[p.tx, p.ty]]) if (this.in(x, y)) this.occ[y * this.w + x] = 1;
    this.props.push(p);
    return p;
  }
  prop(type, tx, ty, extra = {}) {
    const p = Object.assign({ kind: 'prop', type, tx, ty, img: SPR.props[type] || null }, extra);
    if (SPR.anim[type] && !p.frames) p.frames = SPR.anim[type];
    return this.add(p, p.solid === false ? [] : p.solidTiles);
  }
  tree(tx, ty, kind = 'round', leaf = '#3f9a45') {
    const key = kind + leaf + ((tx * 7 + ty * 13) % 5);
    if (!SPR.trees[key]) SPR.trees[key] = GFX.tree((tx * 7 + ty * 13) % 5 + 1, leaf, kind);
    return this.add({ kind: 'prop', type: 'tree', tx, ty, img: SPR.trees[key], oy: 2 });
  }
  scatter(x, y, w, h, density, seed, fn) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const tx = x + i, ty = y + j;
      if (this.free(tx, ty) && GFX.hash(tx, ty, seed) < density) fn(tx, ty);
    }
    return this;
  }
  forest(x, y, w, h, density, seed, kind, leaf, onGround = 'gtx') {
    return this.scatter(x, y, w, h, density, seed, (tx, ty) => { if (onGround.includes(this.rows[ty][tx])) this.tree(tx, ty, kind, leaf); });
  }
  /* a wall of trees around the edge, except where `gaps` (rects) say */
  border(th, gaps = [], kind = 'round', leaf = '#3f9a45') {
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      if (x >= th && y >= th && x < this.w - th && y < this.h - th) continue;
      if (gaps.some(([gx, gy, gw, gh]) => x >= gx && y >= gy && x < gx + gw && y < gy + gh)) continue;
      if (!this.occ[y * this.w + x]) this.tree(x, y, kind, leaf);
    }
    return this;
  }
  house(tx, ty, wt, ht, roof, wall, door) {
    const key = [wt, ht, roof, wall].join();
    if (!SPR.houses[key]) SPR.houses[key] = GFX.house(wt, ht, roof, wall);
    const dx = tx + Math.floor(wt / 2);
    const tiles = [];
    for (let j = 0; j < ht; j++) for (let i = 0; i < wt; i++) if (!(door && door.exit && tx + i === dx && j === ht - 1)) tiles.push([tx + i, ty + j]);
    this.add({ kind: 'prop', type: 'house', tx, ty, img: SPR.houses[key], x: (tx + wt / 2) * TS, y: (ty + ht) * TS, solidTiles: tiles }, tiles);
    if (door && door.exit) this.exit(dx, ty + ht - 1, 1, 1, door.exit[0], door.exit[1], door.exit[2], 'up');
    else if (door && door.text) this.add({ kind: 'prop', type: 'door', tx: dx, ty: ty + ht - 1, img: null, reach: 12, interact: () => STORY.say('sign', door.text), solidTiles: [[dx, ty + ht - 1]] }, []);
    this.reserve(tx - 1, ty + ht, wt + 2, 2);
    return this;
  }
  npc(id, look, tx, ty, dir, extra = {}) { this.npcs.push(Object.assign({ id, look, tx, ty, dir, talk: id }, extra)); this.reserve(tx, ty, 1, 1); return this; }
  zone(x, y, w, h, types, n, when) { this.zones.push({ x, y, w, h, types, n, when }); return this; }
  exit(x, y, w, h, to, tx, ty, dir, cond, deny) { this.exits.push({ x, y, w, h, to, tx, ty, dir, cond, deny }); this.reserve(x, y, w, h); return this; }
  trigger(x, y, w, h, flag, fn, when) { this.triggers.push({ x, y, w, h, flag, fn, when }); return this; }
  sign(tx, ty, text) { return this.prop('sign', tx, ty, { interact: () => STORY.say('sign', text) }); }
  chest(id, tx, ty, contents, hidden) {
    const flag = 'chest_' + id;
    return this.prop('chest', tx, ty, {
      hidden, flag, goneWhenFlag: false, scanNote: hidden ? 'HIDDEN' : null,
      frameFn: () => (G.flags[flag] ? 1 : 0), frames: [SPR.props.chest, SPR.props.chestOpen],
      interact: (p) => {
        if (G.flags[flag]) return STORY.say('sign', 'Empty.');
        G.flags[flag] = true; p.revealed = true;
        for (const [k, n] of contents) { if (k === 'coins') { G.coins += n; UI.toast('Found ' + n + ' coins!', '#ffd84a'); AUDIO.sfx('coin'); } else giveItem(k, n); }
      },
    });
  }
  boulder(tx, ty, flag) {
    return this.prop('boulder', tx, ty, { flag, scanNote: 'CRACKED',
      onHit: (p, how) => {
        if (how.heavy) { G.flags[flag] = true; removeProp(p); AUDIO.sfx('crack'); G.shake = 0.25; burst(p.x, p.y - 8, '#b4a492', 16, 70); burst(p.x, p.y - 8, '#7a6a5a', 10, 40); }
        else if (G.bumpCool <= 0) { G.bumpCool = 1.5; p.wobble = 0.15; UI.toast(G.party.oren && G.party.oren.joined ? (G.active === 'oren' ? 'Cracked rock. Hit it harder: third punch, Quake or Giant Swing.' : 'Cracked rock. Oren could smash it.') : 'Cracked rock. You need someone much heavier.', '#c8c8f0'); }
      },
      onBump: () => UI.toast(G.party.oren && G.party.oren.joined ? "Cracked rock. Oren's heavy hits break these." : 'A cracked boulder blocks the way.', '#c8c8f0') });
  }
  brambles(tx, ty, flag) {
    return this.prop('brambles', tx, ty, { flag, scanNote: 'DRY',
      onHit: (p, how) => {
        if (how.burn) { G.flags[flag] = true; removeProp(p); AUDIO.sfx('burn'); burst(p.x, p.y - 8, '#ff8a2a', 14, 50); burst(p.x, p.y - 8, '#ffd84a', 8, 30); burst(p.x, p.y - 6, '#4a3a3a', 8, 20); }
        else if (G.bumpCool <= 0) { G.bumpCool = 1.5; p.wobble = 0.15; UI.toast(G.active === 'juno' ? 'Dry brambles. A ki blast would set them alight.' : "Dry brambles. Juno's fire would burn them.", '#c8c8f0'); }
      },
      onBump: () => UI.toast('Thorny, bone-dry brambles.', '#c8c8f0') });
  }
  barrier(tx, ty, req, flag, cond, denyText) {
    return this.prop('barrier', tx, ty, { flag, req, fps: 8,
      onBump: (p) => {
        if (cond && !cond()) { STORY.say('sign', denyText || 'The barrier hums. Not yet.'); return; }
        if (hero().lv >= req) {
          G.flags[flag] = true;
          for (const q of G.props.filter((q) => q.flag === flag)) { burst(q.x, q.y - 12, '#9af0ff', 14, 60); removeProp(q); }
          AUDIO.sfx('light'); UI.toast('The barrier yields to your power.', '#9af0ff');
        } else { AUDIO.sfx('deny'); UI.toast('Power Barrier: LV ' + req + ' needed. (You: LV ' + hero().lv + ')', '#ff8a8a'); }
      } });
  }
  done(meta) {
    return Object.assign({ w: this.w, h: this.h, rows: this.rows, props: this.props, npcs: this.npcs, zones: this.zones, exits: this.exits, triggers: this.triggers }, meta);
  }
}

const MAPS = {
  /* ── Juno's house ─────────────────────────────────────── */
  home: { mood: 'indoor', build() {
    const m = new MapBuilder(12, 9, 'f');
    m.fill(0, 0, 12, 2, 'k').fill(0, 0, 1, 9, 'k').fill(11, 0, 1, 9, 'k');
    m.fill(0, 8, 12, 1, 'k').fill(5, 8, 2, 1, 'f');
    m.fill(4, 4, 4, 3, 'n');
    m.prop('bed', 2, 3, { solidTiles: [[2, 3], [2, 2]], x: 2 * TS + 8, y: 4 * TS - 1 });
    m.prop('table', 8, 4, { solidTiles: [[8, 4], [9, 4]], x: 9 * TS, y: 5 * TS - 1 });
    m.prop('shelf', 6, 2, { solidTiles: [[5, 2], [6, 2]], x: 6 * TS, y: 3 * TS - 1, interact: () => STORY.say('sign', 'Training manuals. "Punching: A Beginner\'s Guide." "Punching II: Punch Harder." "Ki and You."') });
    m.prop('plant', 10, 2, { solidTiles: [[10, 2]] });
    m.prop('plant', 1, 6, { solidTiles: [[1, 6]] });
    m.exit(5, 8, 2, 1, 'village', 10, 29, 'down');
    return m.done({ name: "Juno's House", music: 'village', bg: '#1a1028', onEnter: () => STORY.enter('home') });
  } },

  /* ── Brindle Village ──────────────────────────────────── */
  village: { mood: 'golden', build() {
    const m = new MapBuilder(50, 38, 'g');
    // ground
    m.ellipse(14, 33, 9, 3, 't').ellipse(36, 9, 5, 2, 't').ellipse(5, 24, 3, 6, 't').ellipse(44, 15, 3, 2, 't');
    m.ellipse(40, 32, 6, 3.6, 's').ellipse(40, 32, 4.6, 2.6, 'w');
    m.path([[48, 18], [26, 18]], 2, 'd');
    m.path([[24, 0], [24, 15]], 2, 'd');
    m.path([[24, 21], [24, 30], [10, 30]], 2, 'd');
    m.path([[25, 30], [38, 30]], 2, 'd');
    m.path([[10, 29], [10, 30]], 1, 'd');
    m.path([[12, 10], [22, 17]], 2, 'd');
    m.path([[39, 27], [39, 29]], 1, 'd');
    m.ellipse(24.5, 18.5, 5.6, 4.2, 'p');
    m.reserve(18, 13, 14, 12);
    // training ground
    m.fill(3, 6, 8, 8, 'd');
    for (let x = 3; x <= 11; x++) { m.prop('fenceH', x, 5); m.prop('fenceH', x, 14); }
    for (let y = 6; y <= 13; y++) { m.prop('fenceV', 2, y); if (y < 9 || y > 10) m.prop('fenceV', 11, y); }
    m.reserve(3, 6, 8, 8).reserve(11, 8, 3, 4);
    m.prop('dummy', 5, 8, { onHit: (p) => { p.wobble = 0.25; p.flash = 0.08; STORY.dummy(); } });
    m.prop('dummy', 8, 8, { onHit: (p) => { p.wobble = 0.25; p.flash = 0.08; STORY.dummy(); } });
    m.prop('dummy', 5, 12, { onHit: (p) => { p.wobble = 0.25; p.flash = 0.08; STORY.dummy(); } });
    m.sign(12, 11, 'BRINDLE TRAINING GROUND. Z: punch (tap again to combo). X: ki blast. Hold X to charge your special. A: change special.');
    // buildings
    m.house(8, 25, 5, 4, '#c4513f', '#efe0c0', { exit: ['home', 5, 7] });
    m.house(13, 6, 5, 4, '#3f6fc4', '#f0e6d0', { text: "Rena's house. Locked. A note on the door: 'At the plaza. Don't touch my lemons.'" });
    m.house(37, 22, 5, 4, '#4f9a4f', '#e8dcc0', { text: "Boro's place. You can hear snoring through the door. It's two in the afternoon." });
    m.house(39, 5, 4, 3, '#8a4fb0', '#e8e0d8', { text: "Elder Quill's study. A sign: 'Thinking. Do not knock. Knocking interrupts thinking.'" });
    // the noodle stall
    m.add({ kind: 'prop', type: 'counter', tx: 30, ty: 11, img: SPR.props.counter, x: 30 * TS + 8, y: 12 * TS - 1, solidTiles: [[29, 11], [30, 11], [31, 11]] }, [[29, 11], [30, 11], [31, 11]]);
    m.add({ kind: 'prop', type: 'awning', tx: 30, ty: 10, img: SPR.props.awning, x: 30 * TS + 8, y: 10 * TS + 8, oy: -16, sortOff: 20, solidTiles: [] }, []);
    m.prop('cauldron', 33, 10, { solidTiles: [[33, 10]] });
    m.sign(28, 12, "MAGS' NOODLES. Open when Mags says so.");
    m.reserve(27, 9, 8, 5);
    // plaza
    m.add({ kind: 'prop', type: 'fountain', tx: 24, ty: 18, frames: SPR.anim.fountain, x: 24 * TS, y: 19 * TS, solidTiles: [[23, 17], [24, 17], [23, 18], [24, 18]], fps: 5 }, [[23, 17], [24, 17], [23, 18], [24, 18]]);
    m.prop('lamp', 19, 15); m.prop('lamp', 29, 15); m.prop('lamp', 19, 22); m.prop('lamp', 29, 22);
    m.prop('board', 28, 23, { solidTiles: [[28, 23]], interact: () => STORY.board() });
    m.prop('bench', 21, 22, { solidTiles: [[21, 22], [22, 22]], x: 22 * TS, y: 23 * TS - 1 });
    // portal (act three)
    m.prop('portal', 20, 15, { solid: false, fps: 10, when: () => G.flags.portalOpen });
    m.exit(20, 15, 1, 1, 'lobby', 14, 17, 'up', () => G.flags.portalOpen);
    // north road: the peaks
    m.barrier(24, 2, 8, 'barrier_peaks', () => G.flags.act2, "Cinder Peaks lie beyond. The barrier won't even flicker for you yet.");
    m.barrier(25, 2, 8, 'barrier_peaks', () => G.flags.act2, "Cinder Peaks lie beyond. The barrier won't even flicker for you yet.");
    m.sign(22, 3, 'NORTH: CINDER PEAKS. Volcanic. Hot. Bring water. Bring a stronger body.');
    m.sign(46, 16, 'EAST: GREENREACH FIELDS. Mind the Rustback Raiders.');
    m.exit(23, 0, 4, 1, 'peaks', 27, 57, 'up');
    m.exit(49, 16, 1, 5, 'fields', 1, 24, 'right');
    m.reserve(44, 16, 6, 5).reserve(22, 0, 6, 5);
    // decoration, then trees in what's left
    m.prop('stump', 33, 34); m.prop('rock', 45, 26); m.prop('bush', 17, 24); m.prop('bush', 31, 26); m.prop('crate', 35, 12, { solidTiles: [[35, 12]] });
    m.prop('rock', 6, 18); m.prop('bush', 44, 10);
    m.border(2, [[48, 16, 2, 5], [23, 0, 4, 2]]);
    m.forest(2, 2, 46, 34, 0.11, 3);
    // people
    m.npc('mags', 'mags', 30, 10, 'down', { state: 'fixed', reach: 28 });
    m.npc('tam', 'tam', 14, 30, 'left', { wander: true, when: () => !G.flags.kittenDone || true });
    m.npc('rena', 'rena', 20, 20, 'right', { wander: true });
    m.npc('boro', 'boro', 42, 27, 'left', { wander: true });
    m.npc('lia', 'lia', 28, 19, 'left', { wander: true });
    m.npc('elder', 'elder', 41, 9, 'down', { wander: true });
    m.npc('kid2', 'kid2', 34, 31, 'right', { wander: true });
    m.npc('biscuit', null, 15, 31, 'right', { creature: ['chick', '#f5a04a'], when: () => G.flags.kittenDone, wander: true });
    m.npc('oren', 'oren', 8, 10, 'left', { when: () => !G.flags.orenJoined || G.flags.ending });
    return m.done({ name: 'Brindle Village', music: () => (G.flags.act2 && !G.flags.overdrive ? 'ember' : 'village'), onEnter: () => STORY.enter('village') });
  } },

  /* ── Greenreach Fields ────────────────────────────────── */
  fields: { mood: 'fields', build() {
    const m = new MapBuilder(76, 50, 'g');
    m.ellipse(18, 14, 8, 5, 't').ellipse(44, 40, 7, 4, 't').ellipse(64, 8, 5, 3, 't').ellipse(8, 40, 5, 4, 'x').ellipse(48, 10, 6, 5, 'x');
    m.fill(30, 0, 5, 50, 's');
    for (let y = 0; y < 50; y++) { const o = Math.round(Math.sin(y * 0.25) * 1.2); m.fill(31 + o, y, 3, 1, 'w'); }
    m.ellipse(16, 42, 4.5, 3, 's').ellipse(16, 42, 3.4, 2, 'w');
    m.path([[0, 24], [29, 24]], 2, 'd');
    m.fill(29, 24, 7, 2, 'b').reserve(28, 23, 9, 4);
    m.path([[36, 24], [56, 24]], 2, 'd');
    m.path([[18, 24], [18, 36], [22, 38]], 2, 'd');
    m.path([[40, 24], [42, 10]], 2, 'd');
    m.path([[44, 25], [46, 41]], 2, 'd');
    // the corridor to the camp: trees either side, a barrier, then cracked rock
    for (let x = 44; x <= 55; x++) { for (const y of [20, 21, 28, 29]) { if (!m.occ[y * m.w + x]) m.tree(x, y); } }
    for (let y = 22; y <= 27; y++) m.barrier(48, y, 5, 'barrier_camp');
    m.fill(51, 22, 2, 6, 'j');
    m.reserve(44, 22, 12, 6);
    // the camp
    m.fill(57, 15, 15, 19, 'd');
    for (let x = 56; x <= 72; x++) { m.prop('fenceH', x, 14); m.prop('fenceH', x, 34); }
    for (let y = 15; y <= 33; y++) { if (y < 22 || y > 27) m.prop('fenceV', 56, y); m.prop('fenceV', 72, y); }
    m.reserve(57, 15, 15, 19);
    m.prop('tent', 60, 17, { solidTiles: [[59, 17], [60, 17], [61, 17]], x: 60 * TS + 8, y: 18 * TS - 1 });
    m.prop('tent', 68, 17, { solidTiles: [[67, 17], [68, 17], [69, 17]], x: 68 * TS + 8, y: 18 * TS - 1 });
    m.prop('tent', 60, 31, { solidTiles: [[59, 31], [60, 31], [61, 31]], x: 60 * TS + 8, y: 32 * TS - 1 });
    m.prop('tent', 68, 31, { solidTiles: [[67, 31], [68, 31], [69, 31]], x: 68 * TS + 8, y: 32 * TS - 1 });
    m.prop('campfire', 64, 24, { fps: 8 });
    m.prop('crate', 58, 21); m.prop('crate', 58, 28); m.prop('crate', 70, 21); m.prop('crate', 70, 22); m.prop('flag', 64, 16, { solidTiles: [[64, 16]] });
    // kitten in the brambles
    m.fill(10, 5, 5, 5, 'x');
    for (let y = 4; y <= 10; y++) for (let x = 9; x <= 15; x++) if (x === 9 || x === 15 || y === 4 || y === 10) m.brambles(x, y, 'bramble_' + x + '_' + y);
    m.reserve(10, 5, 5, 5);
    m.chest('fields_bramble', 13, 6, [['heartroot', 1]]);
    m.npc('biscuit', null, 11, 7, 'right', { creature: ['chick', '#f5a04a'], when: () => !G.flags.kittenFound });
    // scallions
    for (const [i, x, y] of [[1, 20, 38], [2, 42, 7], [3, 49, 43]]) {
      m.prop('scallion', x, y, { solid: false, flag: 'scallion' + i, reach: 12, when: () => G.flags.scallionQuest && !G.flags.scallionsDone, interact: (p) => { G.flags['scallion' + i] = true; removeProp(p); giveItem('scallion'); } });
      m.reserve(x, y, 1, 1);
    }
    // chests
    m.chest('fields_nw', 24, 6, [['bun', 2]]);
    m.chest('fields_se', 62, 44, [['coins', 90], ['heartroot', 1]]);
    for (const [x, y] of [[61, 43], [62, 43], [63, 43], [61, 44], [63, 44], [61, 45], [62, 45], [63, 45]]) m.boulder(x, y, 'boulder_se_' + x + '_' + y);
    m.chest('fields_hidden1', 4, 45, [['kicrystal', 1]], true);
    m.chest('fields_hidden2', 70, 4, [['starfruit', 1]], true);
    m.reserve(23, 5, 3, 3).reserve(61, 43, 3, 3).reserve(3, 44, 3, 3).reserve(69, 3, 3, 3);
    // a little farm
    m.fill(22, 27, 6, 4, 'd');
    for (let x = 22; x < 28; x += 2) for (let y = 27; y < 31; y++) m.prop('scallion', x, y, { solid: false, img: SPR.props.bush, scale: 1 });
    m.reserve(21, 26, 8, 6);
    m.sign(3, 22, 'GREENREACH FIELDS. Wild Puddlets are harmless. Bolt Hares are not.');
    m.sign(43, 22, 'RUSTBACK CAMP. KEEP OUT. (This means you.) (Yes, you.) (We dug a chasm.)');
    m.prop('rock', 26, 12); m.prop('rock', 52, 16); m.prop('rock', 38, 44); m.prop('bush', 8, 30); m.prop('bush', 50, 34); m.prop('stump', 12, 20);
    m.exit(0, 22, 1, 5, 'village', 47, 18, 'left');
    m.reserve(0, 21, 4, 7);
    m.border(2, [[0, 22, 2, 5]]);
    m.forest(2, 2, 72, 46, 0.1, 7);
    m.npc('odo', 'odo', 25, 26, 'down', { wander: false });
    m.zone(4, 12, 24, 28, [['puddlet', 1, 2], ['puddlet', 1, 2], ['hare', 2, 2]], 9);
    m.zone(36, 3, 18, 15, [['hare', 3, 3], ['beetle', 3, 4], ['bluelet', 3, 4]], 7);
    m.zone(36, 30, 18, 16, [['beetle', 4, 4], ['bluelet', 4, 4], ['hare', 4, 4]], 7);
    m.zone(58, 16, 13, 17, [['grunt', 5, 6], ['grunt', 5, 6], ['gunner', 5, 5]], 6, () => !G.flags.rookBeaten);
    m.zone(58, 3, 14, 9, [['grunt', 5, 5], ['gunner', 5, 5]], 3);
    m.zone(58, 37, 14, 10, [['grunt', 5, 5], ['gunner', 5, 5], ['beetle', 5, 5]], 4);
    m.trigger(24, 21, 4, 7, 'reiIntro', () => STORY.reiMeets(), () => G.flags.notice && !G.flags.reiJoined);
    m.trigger(53, 21, 2, 8, 'rivals1Intro', () => STORY.rivals1(), () => G.flags.reiJoined && !G.flags.rivals1);
    m.trigger(58, 20, 3, 10, 'rookIntro', () => STORY.rook(), () => !G.flags.rookBeaten);
    return m.done({ name: 'Greenreach Fields', music: 'fields', onEnter: () => STORY.enter('fields') });
  } },

  /* ── Cinder Peaks ─────────────────────────────────────── */
  peaks: { mood: 'volcano', build() {
    const m = new MapBuilder(56, 60, 'r');
    m.fill(0, 0, 56, 5, 'c').fill(0, 0, 2, 60, 'c').fill(54, 0, 2, 60, 'c').fill(0, 58, 26, 2, 'c').fill(30, 58, 26, 2, 'c');
    // lava
    for (let x = 2; x < 54; x++) { const o = Math.round(Math.sin(x * 0.3) * 1.2); m.fill(x, 38 + o, 1, 2, 'l'); }
    m.ellipse(41, 47, 6, 2.6, 'l').ellipse(9, 19, 4, 3, 'l').ellipse(46, 31, 3.5, 2, 'l').ellipse(19, 52, 3, 1.6, 'l');
    // outcrops
    m.fill(20, 18, 7, 6, 'c').fill(33, 30, 5, 5, 'c').fill(4, 44, 6, 4, 'c').fill(46, 12, 4, 6, 'c');
    // pockets behind cracked rock
    m.fill(3, 7, 7, 1, 'c').fill(3, 13, 7, 1, 'c').fill(9, 7, 1, 7, 'c').fill(3, 8, 6, 5, 'a');
    m.set(9, 10, 'a');
    m.fill(45, 49, 8, 1, 'c').fill(45, 56, 8, 1, 'c').fill(45, 49, 1, 8, 'c').fill(46, 50, 7, 6, 'a');
    m.set(45, 52, 'a');
    // the path
    m.path([[27, 59], [27, 50], [16, 44], [16, 33], [28, 29], [40, 24], [40, 16], [28, 12], [27, 6]], 2, 'a');
    m.path([[16, 37], [16, 41]], 2, 'a');
    m.path([[10, 10], [14, 12], [20, 13]], 1, 'a');
    m.path([[44, 52], [36, 51], [29, 51]], 1, 'a');
    m.path([[16, 33], [10, 30]], 1, 'a');
    m.path([[40, 20], [46, 21]], 1, 'a');
    m.path([[28, 12], [22, 14]], 1, 'a');
    m.fill(24, 5, 8, 4, 'a');
    m.reserve(22, 5, 12, 6);
    m.fill(10, 36, 13, 2, 'j');
    m.fill(20, 10, 16, 1, 'c');
    for (let x = 26; x <= 29; x++) { m.set(x, 10, 'a'); m.boulder(x, 10, 'boulder_summit_' + x); }
    m.fill(22, 11, 13, 5, 'a');
    m.reserve(21, 10, 14, 8);
    m.trigger(23, 12, 12, 4, 'summitIntro', () => STORY.summit(), () => G.flags.act2 && !G.flags.orenJoined);
    m.boulder(9, 10, 'boulder_peak_a');
    m.boulder(45, 52, 'boulder_peak_b');
    m.chest('peak_pocket_a', 5, 10, [['starfruit', 1], ['coins', 80]]);
    m.chest('peak_pocket_b', 50, 52, [['heartroot', 1]]);
    m.chest('peak_hidden', 50, 8, [['kicrystal', 1]], true);
    m.chest('peak_mid', 6, 34, [['tonic', 2]]);
    m.reserve(3, 8, 7, 5).reserve(46, 50, 7, 6).reserve(49, 7, 3, 3).reserve(5, 33, 3, 3);
    // braziers
    const brazier = (id, x, y) => m.prop('brazier', x, y, { scanNote: G.flags['brazier_' + id] ? null : 'UNLIT', frameFn: () => (G.flags['brazier_' + id] ? 1 + Math.floor(G.t * 8) % 2 : 0),
      onHit: (p, how) => {
        if (G.flags['brazier_' + id]) return;
        if (how.burn) { G.flags['brazier_' + id] = true; p.scanNote = null; AUDIO.sfx('light'); burst(p.x, p.y - 16, '#ffd84a', 14, 50); STORY.brazierLit(); }
        else if (G.bumpCool <= 0) { G.bumpCool = 1.5; UI.toast('A cold brazier. It wants fire.', '#c8c8f0'); }
      },
      interact: () => STORY.say('sign', G.flags['brazier_' + id] ? 'The brazier roars.' : 'A cold iron brazier. Carved underneath: "Feed the flame."') });
    m.reserve(8, 28, 5, 6).reserve(44, 19, 5, 6).reserve(19, 13, 5, 6);
    brazier(1, 10, 29); brazier(2, 46, 20); brazier(3, 21, 14);
    m.add({ kind: 'prop', type: 'shrineDoor', tx: 27, ty: 4, frames: SPR.anim.shrineDoor, x: 28 * TS, y: 5 * TS + 15, frameFn: () => (G.flags.shrineOpen ? 1 : 0), solidTiles: [] }, []);
    m.exit(27, 5, 2, 1, 'shrine', 9, 13, 'up', () => G.flags.shrineOpen, function* () { yield SCRIPT.say('sign', 'A sealed stone door. Three carved flames above it are dark. Below: "Feed the flame, and enter."'); });
    m.prop('campfire', 31, 8, { fps: 8, interact: () => STORY.rest('The fire is warm. Rest here?') });
    m.prop('campfire', 30, 55, { fps: 8 });
    m.prop('cauldron', 32, 55, { solidTiles: [[32, 55]] });
    m.npc('furnace', 'furnace', 31, 54, 'left', { state: 'fixed' });
    m.sign(25, 55, 'CINDER PEAKS. Turn back now. This is your last sign. (There are more signs.)');
    m.sign(18, 42, 'The lava is hot. This sign is required by law.');
    // decoration
    m.scatter(2, 5, 52, 53, 0.045, 11, (x, y) => m.rows[y][x] === 'r' && m.prop(GFX.hash(x, y, 2) < 0.5 ? 'basalt' : 'crystal', x, y));
    m.scatter(2, 5, 52, 53, 0.03, 12, (x, y) => m.rows[y][x] === 'r' && m.tree(x, y, 'dead'));
    m.exit(26, 59, 4, 1, 'village', 24, 3, 'down');
    m.zone(4, 41, 48, 15, [['imp', 7, 7], ['hound', 7, 8], ['lavabeetle', 7, 7]], 7);
    m.zone(4, 22, 48, 15, [['imp', 8, 9], ['hound', 8, 9], ['golemite', 9, 9]], 8);
    m.zone(4, 6, 48, 15, [['imp', 9, 10], ['golemite', 10, 10], ['hound', 10, 10]], 8);
    return m.done({ name: 'Cinder Peaks', music: 'peaks', bg: '#1a0e10', onEnter: () => STORY.enter('peaks') });
  } },

  /* ── the shrine at the top ────────────────────────────── */
  shrine: { mood: 'shrine', build() {
    const m = new MapBuilder(20, 16, 'a');
    m.fill(0, 0, 20, 3, 'c').fill(0, 0, 2, 16, 'c').fill(18, 0, 2, 16, 'c').fill(0, 15, 9, 1, 'c').fill(11, 15, 9, 1, 'c');
    m.ellipse(9.5, 8, 6, 4, 'r');
    for (const [x, y] of [[3, 4], [16, 4], [3, 13], [16, 13]]) m.prop('brazier', x, y, { frameFn: () => 1 + Math.floor(G.t * 8 + x) % 2 });
    m.prop('statue', 6, 3, { solidTiles: [[6, 3]] }); m.prop('statue', 13, 3, { solidTiles: [[13, 3]] });
    m.exit(9, 15, 2, 1, 'peaks', 27, 7, 'down', () => !G.boss);
    return m.done({ name: 'The Ember Shrine', music: 'shrine', bg: '#1a0e10', onEnter: () => STORY.enter('shrine') });
  } },

  /* ── the Interworld lobby ─────────────────────────────── */
  lobby: { mood: 'cosmic', build() {
    const m = new MapBuilder(30, 22, 'v');
    m.fill(2, 3, 26, 17, 'm');
    m.fill(13, 1, 4, 2, 'm');
    for (const x of [3, 9, 20, 26]) { m.prop('pillar', x, 4, { solidTiles: [[x, 4]] }); m.prop('pillar', x, 18, { solidTiles: [[x, 18]] }); }
    m.prop('flag', 6, 4, { solidTiles: [[6, 4]] }); m.prop('flag', 23, 4, { solidTiles: [[23, 4]] });
    m.prop('vending', 4, 13, { solidTiles: [[4, 13]], interact: () => STORY.vending() });
    m.prop('bench', 25, 13, { solidTiles: [[25, 13], [26, 13]], x: 26 * TS, y: 14 * TS - 1, interact: () => STORY.rest('A Recovery Bench. "Complimentary for registered fighters." Rest?') });
    m.prop('portal', 14, 19, { solid: false, fps: 10 });
    m.exit(14, 19, 1, 1, 'village', 20, 16, 'down', () => !G.flags.finalStarted);
    m.prop('gate', 14, 2, { solidTiles: [[14, 2]], x: 15 * TS, y: 3 * TS - 1 });
    m.add({ kind: 'prop', type: 'gate2', tx: 15, ty: 2, img: null, solidTiles: [[15, 2], [13, 2], [16, 2]] }, []);
    m.npc('pell', 'pell', 15, 5, 'down', { float: true, state: 'fixed' });
    m.npc('brask', 'brask', 25, 10, 'left', { talk: 'brask' });
    m.npc('isla', 'isla', 23, 10, 'right', { talk: 'isla' });
    m.npc('sir', 'sir', 7, 8, 'right', { wander: true });
    m.npc('cactus', 'cactus', 22, 8, 'left', { wander: true });
    m.npc('clerk', 'clerk', 22, 15, 'left', { wander: true });
    m.npc('velvet', 'velvet', 8, 15, 'right', { when: () => !G.flags.match1 });
    m.npc('grub', null, 18, 12, 'left', { creature: ['robot'], wander: true, when: () => !G.flags.match2 });
    m.npc('null', 'null', 26, 7, 'left', { state: 'fixed', when: () => !G.flags.match3 });
    m.npc('velvetAfter', 'velvet', 10, 10, 'right', { talk: 'velvetAfter', wander: true, when: () => G.flags.match1 });
    m.npc('grubAfter', null, 18, 12, 'left', { creature: ['robot'], talk: 'grubAfter', wander: true, when: () => G.flags.match2 });
    return m.done({ name: 'Interworld Lobby', music: 'arena', bg: '#110c24', onEnter: () => STORY.enter('lobby') });
  } },

  /* ── the ring ─────────────────────────────────────────── */
  arena: { mood: 'cosmic', build() {
    const m = new MapBuilder(22, 17, 'v');
    m.ellipse(10.5, 8.5, 9.2, 6.8, 'm');
    for (const [x, y] of [[3, 3], [18, 3], [3, 14], [18, 14]]) m.prop('pillar', x, y, { solidTiles: [[x, y]] });
    return m.done({ name: 'The Interworld Ring', music: 'arena', bg: '#110c24', onEnter: () => STORY.enter('arena') });
  } },

  /* ── the Ledger Vault ─────────────────────────────────── */
  vault: { mood: 'cosmic', build() {
    const m = new MapBuilder(24, 46, 'v');
    m.path([[10, 45], [10, 14]], 4, 'm', 0);
    m.ellipse(11.5, 8, 9.5, 5.6, 'm');
    m.fill(10, 31, 4, 2, 'v');
    m.fill(10, 21, 4, 2, 'v');
    m.ellipse(5, 34, 3.4, 2.6, 'm').ellipse(18, 26, 3.4, 2.6, 'm').ellipse(5, 20, 3, 2.2, 'm');
    m.fill(6, 33, 4, 2, 'm').fill(14, 25, 4, 2, 'm').fill(6, 19, 4, 2, 'm');
    for (const [x, y] of [[4, 4], [19, 4], [3, 11], [20, 11]]) m.prop('pillar', x, y, { solidTiles: [[x, y]] });
    m.chest('vault_a', 4, 34, [['starfruit', 1]]);
    m.chest('vault_b', 19, 26, [['bun', 3], ['tonic', 2]]);
    m.zone(6, 28, 12, 14, [['wraith', 15, 16], ['clerkbot', 15, 15]], 5, () => !G.flags.sableBeaten);
    m.zone(6, 15, 12, 10, [['wraith', 16, 16], ['clerkbot', 16, 16]], 4, () => !G.flags.sableBeaten);
    m.trigger(6, 12, 12, 2, 'sableFinal', () => STORY.finalBoss(), () => !G.flags.sableBeaten);
    return m.done({ name: 'The Ledger Vault', music: 'final', bg: '#110c24', onEnter: () => STORY.enter('vault') });
  } },
};
