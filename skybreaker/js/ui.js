/* SKYBREAKER — boxes, menus, the HUD, and the verbs cutscenes are written in.

   Everything here draws in screen space on top of the world.  A "modal" is
   anything that owns the buttons while it is open — a dialogue box, the pause
   menu, a shop.  SCRIPT is the cutscene vocabulary: each helper returns a
   waiter whose update() reports when it is finished, and story.js strings
   them together in generator functions. */
'use strict';

const SPEAKERS = {
  juno: { name: 'Juno', look: 'juno', color: '#ff9a7a' },
  brask: { name: 'Brask', look: 'brask', color: '#c8a8ff' },
  mags: { name: 'Mags', look: 'mags', color: '#9ad4f0' },
  pell: { name: 'Pell', look: 'pell', color: '#f2d06a' },
  sable: { name: 'Auditor Sable', look: 'sable', color: '#d8c8ff' },
  rook: { name: 'Captain Rook', look: 'rook', color: '#ff8a5a' },
  velvet: { name: 'Velvet', look: 'velvet', color: '#e05a8a' },
  grub: { name: 'GRB-9', creature: ['robot'], color: '#3ad0ff' },
  warden: { name: 'Hollow Warden', creature: ['warden'], color: '#ffb85a' },
  null: { name: 'Null', look: 'null', color: '#8a6aff' },
  furnace: { name: 'Old Furnace', look: 'furnace', color: '#ffb07a' },
  tam: { name: 'Tam', look: 'tam', color: '#9ad4f0' },
  odo: { name: 'Farmer Odo', look: 'odo', color: '#c8e07a' },
  rena: { name: 'Rena', look: 'rena', color: '#ffb07a' },
  boro: { name: 'Boro', look: 'boro', color: '#9ae0b0' },
  lia: { name: 'Lia', look: 'lia', color: '#e0c8ff' },
  elder: { name: 'Elder Quill', look: 'elder', color: '#d8d0f0' },
  sir: { name: 'Sir Dunmore', look: 'sir', color: '#b0c8ff' },
  cactus: { name: 'Prickles', look: 'cactus', color: '#9ae07a' },
  grunt: { name: 'Rustback', look: 'grunt', color: '#d8b08a' },
  kid2: { name: 'Nim', look: 'kid2', color: '#ffb07a' },
  clerk: { name: 'Clerk', look: 'clerk', color: '#c8c8f0' },
  biscuit: { name: 'Biscuit', creature: ['chick', '#f5a04a'], color: '#ffd08a' },
  sign: { name: '', color: '#ffffff' },
};

const UI = (() => {
  const stack = [];
  const toasts = [];
  let area = null, banner = null, specialPulse = 0, gameOverAt = 0;

  const modal = () => stack[stack.length - 1] || null;
  function push(m) { stack.push(m); return m; }
  function pop(m) { const i = stack.indexOf(m); if (i >= 0) stack.splice(i, 1); }

  function toast(text, color = '#ffffff') { toasts.push({ text, color, t: 0 }); if (toasts.length > 4) toasts.shift(); }
  function areaName(name) { if (name) area = { name, t: 0 }; }
  function specialFlash() { specialPulse = 0.6; }
  function gameOverSoon() { gameOverAt = 1.6; }

  /* ── drawing kit ──────────────────────────────────────── */
  function box(ctx, x, y, w, h, style = 'blue') {
    const P = style === 'dark' ? ['#0e0a1c', '#2a2050', '#1a1236', '#140e2a'] : ['#101830', '#e8f0ff', '#2a4a9a', '#1a3070'];
    ctx.fillStyle = P[0]; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = P[1]; ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
    ctx.fillStyle = P[0]; ctx.fillRect(x + 2, y + 2, w - 4, h - 4);
    // a soft vertical gradient in four bands
    const bands = style === 'dark' ? ['#1a1236', '#181032', '#160e2e', '#140c2a'] : ['#2f56b0', '#2a4ea4', '#264698', '#223e8c'];
    const bh = Math.ceil((h - 6) / 4);
    for (let i = 0; i < 4; i++) { ctx.fillStyle = bands[i]; ctx.fillRect(x + 3, y + 3 + i * bh, w - 6, Math.min(bh, h - 6 - i * bh)); }
  }
  function bar(ctx, x, y, w, h, v, max, col, back = '#1a1028') {
    ctx.fillStyle = '#0a0612'; ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
    ctx.fillStyle = back; ctx.fillRect(x, y, w, h);
    const f = Math.max(0, Math.min(1, v / max));
    ctx.fillStyle = col; ctx.fillRect(x, y, Math.round(w * f), h);
    ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(x, y, Math.round(w * f), 1);
  }
  function portrait(who) {
    const S = SPEAKERS[who];
    if (!S) return null;
    if (S.look === 'null') return personSheet(nullLook()).face;
    if (S.look) return personSheet(S.look).face;
    if (S.creature) {
      const c = creatureSheet(S.creature);
      S._face = S._face || (() => { const f = GFX.canvas(16, 16), x = f.getContext('2d'); x.drawImage(c.left[0], Math.floor(c.w / 2) - 8, 0, 16, 16, 0, 0, 16, 16); return f; })();
      return S._face;
    }
    return null;
  }
  function itemIcon(ctx, k, x, y) {
    const C = { bun: ['#ffb0a0', '#e07a6a'], tonic: ['#7ad0ff', '#3a8ad0'], starfruit: ['#ffe14a', '#e0a020'], wristband: ['#c8c8d8', '#7a7a90'], kicrystal: ['#c8a8ff', '#7a4ae0'], heartroot: ['#ff7a8a', '#c03a4a'], scallion: ['#7ad06a', '#f4f0e6'], biscuit: ['#f5a04a', '#c07a2a'], autograph: ['#f4f0e6', '#a09080'], form77b: ['#f4f0e6', '#c0303a'] }[k] || ['#ffffff', '#888888'];
    ctx.fillStyle = '#1a1028'; ctx.fillRect(x, y + 1, 10, 8); ctx.fillRect(x + 1, y, 8, 10);
    ctx.fillStyle = C[1]; ctx.fillRect(x + 1, y + 1, 8, 8);
    ctx.fillStyle = C[0]; ctx.fillRect(x + 2, y + 2, 5, 5);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(x + 3, y + 2, 1, 1);
  }

  /* ── dialogue ─────────────────────────────────────────── */
  const TW = 180;
  function dialogue(who, text, opts = {}) {
    const S = SPEAKERS[who] || { name: who || '', color: '#ffffff' };
    const lines = FONT.wrap(text, who && who !== 'sign' ? TW : 218);
    const pages = [];
    for (let i = 0; i < lines.length; i += 3) pages.push(lines.slice(i, i + 3));
    const d = { kind: 'dialogue', who, S, pages, page: 0, chars: 0, done: false, options: opts.options || null, choice: 0, result: null, t: 0 };
    d.update = (dt) => {
      d.t += dt;
      const total = d.pages[d.page].join('\n').length;
      if (d.chars < total) {
        const before = Math.floor(d.chars);
        d.chars = Math.min(total, d.chars + dt * 55);
        if (Math.floor(d.chars) !== before && before % 3 === 0) AUDIO.sfx('text');
        if (d.t > 0.1 && (I.take('A') || I.take('B'))) d.chars = total;
        return;
      }
      const last = d.page === d.pages.length - 1;
      if (last && d.options) {
        if (I.take('up')) { d.choice = (d.choice + d.options.length - 1) % d.options.length; AUDIO.sfx('blip'); }
        if (I.take('down')) { d.choice = (d.choice + 1) % d.options.length; AUDIO.sfx('blip'); }
        if (I.take('A')) { d.result = d.choice; AUDIO.sfx('select'); close(); }
        if (I.take('B')) { d.result = d.options.length - 1; AUDIO.sfx('back'); close(); }
        return;
      }
      if (I.take('A') || I.take('B')) {
        if (last) close();
        else { d.page++; d.chars = 0; AUDIO.sfx('blip'); }
      }
    };
    const close = () => { d.done = true; pop(d); };
    d.draw = (ctx) => {
      const x = 4, y = VH - 50, w = VW - 8, h = 46;
      box(ctx, x, y, w, h);
      const face = who && who !== 'sign' ? portrait(who) : null;
      let tx = x + 8;
      if (face) {
        ctx.fillStyle = '#0a0612'; ctx.fillRect(x + 5, y + 5, 36, 36);
        ctx.fillStyle = '#6a8ae0'; ctx.fillRect(x + 6, y + 6, 34, 34);
        ctx.fillStyle = '#a8c8ff'; ctx.fillRect(x + 7, y + 7, 32, 32);
        ctx.drawImage(face, 0, 0, 16, 16, x + 7, y + 7, 32, 32);
        tx = x + 46;
      }
      if (d.S.name) {
        const nw = FONT.width(d.S.name) + 10;
        box(ctx, x + 4, y - 11, nw, 13, 'dark');
        FONT.draw(ctx, d.S.name, x + 9, y - 8, d.S.color);
      }
      let left = Math.floor(d.chars);
      d.pages[d.page].forEach((ln, i) => {
        const show = ln.slice(0, Math.max(0, left));
        left -= ln.length + 1;
        FONT.draw(ctx, show, tx, y + 7 + i * 12, '#ffffff');
      });
      const total = d.pages[d.page].join('\n').length;
      if (d.chars >= total) {
        if (d.options && d.page === d.pages.length - 1) {
          const ow = Math.max(...d.options.map((o) => FONT.width(o))) + 22, oh = d.options.length * 11 + 8;
          box(ctx, VW - ow - 6, y - oh - 2, ow, oh);
          d.options.forEach((o, i) => {
            FONT.draw(ctx, o, VW - ow + 8, y - oh + 3 + i * 11, i === d.choice ? '#ffd84a' : '#ffffff');
            if (i === d.choice) FONT.draw(ctx, '>', VW - ow + 1 + (Math.floor(d.t * 4) % 2), y - oh + 3 + i * 11, '#ffd84a');
          });
        } else if (Math.floor(d.t * 3) % 2) {
          ctx.fillStyle = '#ffd84a'; ctx.fillRect(x + w - 12, y + h - 9, 5, 1); ctx.fillRect(x + w - 11, y + h - 8, 3, 1); ctx.fillRect(x + w - 10, y + h - 7, 1, 1);
        }
      }
    };
    return push(d);
  }

  /* ── pause menu ───────────────────────────────────────── */
  const MENU = ['Status', 'Specials', 'Items', 'Quests', 'Save', 'Music', 'Close'];
  function pauseMenu() {
    const m = { kind: 'menu', sel: 0, sub: null, subSel: 0, heroView: G.active, t: 0 };
    m.update = (dt) => {
      m.t += dt;
      const heroes = ['juno', 'brask'].filter((id) => G.party[id] && G.party[id].joined);
      if (!m.sub) {
        if (I.take('START') || I.take('B')) { AUDIO.sfx('back'); pop(m); return; }
        if (I.take('up')) { m.sel = (m.sel + MENU.length - 1) % MENU.length; AUDIO.sfx('blip'); }
        if (I.take('down')) { m.sel = (m.sel + 1) % MENU.length; AUDIO.sfx('blip'); }
        if ((I.take('left') || I.take('right')) && heroes.length > 1) { m.heroView = m.heroView === 'juno' ? 'brask' : 'juno'; AUDIO.sfx('blip'); }
        if (I.take('A')) {
          const k = MENU[m.sel];
          if (k === 'Close') { AUDIO.sfx('back'); pop(m); }
          else if (k === 'Save') { const ok = SAVE.save(); toast(ok ? 'Game saved.' : 'Could not save in this browser.', ok ? '#7affb0' : '#ff8a8a'); AUDIO.sfx(ok ? 'select' : 'deny'); }
          else if (k === 'Music') { AUDIO.toggleMusic(); AUDIO.sfx('select'); }
          else if (k === 'Status' || k === 'Items') { m.sub = k; m.subSel = 0; AUDIO.sfx('select'); }
        }
        return;
      }
      if (I.take('B') || I.take('START')) { m.sub = null; AUDIO.sfx('back'); return; }
      if (m.sub === 'Status') {
        const h = G.party[m.heroView];
        if (I.take('up')) { m.subSel = (m.subSel + 4) % 5; AUDIO.sfx('blip'); }
        if (I.take('down')) { m.subSel = (m.subSel + 1) % 5; AUDIO.sfx('blip'); }
        if ((I.take('left') || I.take('right')) && heroes.length > 1) { m.heroView = m.heroView === 'juno' ? 'brask' : 'juno'; AUDIO.sfx('blip'); }
        if (I.take('A')) {
          if (h.pts <= 0) { AUDIO.sfx('deny'); return; }
          h.pts--;
          if (m.subSel === 0) h.str += 1; else if (m.subSel === 1) h.pow += 1; else if (m.subSel === 2) h.def += 1;
          else if (m.subSel === 3) { h.maxHp += 8; h.hp += 8; } else { h.maxKi += 5; h.ki += 5; }
          AUDIO.sfx('select');
        }
      } else if (m.sub === 'Items') {
        const list = itemList();
        if (!list.length) { m.sub = null; return; }
        m.subSel = Math.min(m.subSel, list.length - 1);
        if (I.take('up')) { m.subSel = (m.subSel + list.length - 1) % list.length; AUDIO.sfx('blip'); }
        if (I.take('down')) { m.subSel = (m.subSel + 1) % list.length; AUDIO.sfx('blip'); }
        if ((I.take('left') || I.take('right')) && heroes.length > 1) { m.heroView = m.heroView === 'juno' ? 'brask' : 'juno'; AUDIO.sfx('blip'); }
        if (I.take('A')) useItem(list[m.subSel], G.party[m.heroView]);
      }
    };
    m.draw = (ctx) => drawMenu(ctx, m);
    return push(m);
  }
  function itemList() {
    const order = Object.keys(DATA.ITEMS);
    return order.filter((k) => G.items[k] > 0).sort((a, b) => (DATA.ITEMS[a].key ? 1 : 0) - (DATA.ITEMS[b].key ? 1 : 0));
  }
  function useItem(k, h) {
    const it = DATA.ITEMS[k];
    if (it.key) { AUDIO.sfx('deny'); toast(it.desc, '#c8c8f0'); return; }
    const u = it.use;
    if (!it.perm) {
      const needs = (u.hp && h.hp < h.maxHp) || (u.ki && h.ki < h.maxKi);
      if (!needs) { AUDIO.sfx('deny'); toast(DATA.HEROES[h.id].name + " doesn't need that.", '#c8c8f0'); return; }
    }
    if (u.hp) h.hp = Math.min(h.maxHp, h.hp + u.hp);
    if (u.ki) h.ki = Math.min(h.maxKi, h.ki + u.ki);
    if (u.str) h.str += u.str;
    if (u.maxKi) { h.maxKi += u.maxKi; h.ki += u.maxKi; }
    if (u.maxHp) { h.maxHp += u.maxHp; h.hp += u.maxHp; }
    takeItem(k);
    AUDIO.sfx('heal');
    toast(DATA.HEROES[h.id].name + ' used ' + it.name + '.', '#7affb0');
  }
  function drawMenu(ctx, m) {
    ctx.fillStyle = 'rgba(8,6,20,0.72)'; ctx.fillRect(0, 0, VW, VH);
    box(ctx, 4, 4, 62, 104);
    MENU.forEach((k, i) => {
      let label = k;
      if (k === 'Music') label = 'Music ' + (AUDIO.musicOn ? 'On' : 'Off');
      const sel = i === m.sel;
      FONT.draw(ctx, label, 16, 11 + i * 13, sel ? (m.sub ? '#c8b070' : '#ffd84a') : '#ffffff');
      if (sel && !m.sub) FONT.draw(ctx, '>', 9 + (Math.floor(m.t * 4) % 2), 11 + i * 13, '#ffd84a');
    });
    box(ctx, 4, 112, 62, 44, 'dark');
    FONT.draw(ctx, '@ ' + G.coins, 10, 118, '#ffd84a');
    const pt = Math.floor(G.playTime);
    FONT.draw(ctx, Math.floor(pt / 3600) + ':' + String(Math.floor(pt / 60) % 60).padStart(2, '0') + ':' + String(pt % 60).padStart(2, '0'), 10, 130, '#c8c8f0');
    FONT.draw(ctx, 'Enter: back', 10, 142, '#8a86b0');
    box(ctx, 70, 4, 166, 152);
    const k = m.sub || MENU[m.sel];
    const h = G.party[m.heroView];
    const heroes = ['juno', 'brask'].filter((id) => G.party[id] && G.party[id].joined);
    const heroHeader = () => {
      ctx.drawImage(personSheet(DATA.HEROES[h.id].look).face, 78, 10);
      FONT.draw(ctx, DATA.HEROES[h.id].name, 98, 10, '#ffd84a');
      FONT.draw(ctx, 'LV ' + h.lv + (h.hp <= 0 ? '  (down)' : ''), 98, 20, h.hp <= 0 ? '#ff8a8a' : '#ffffff');
      if (heroes.length > 1) FONT.draw(ctx, '< >', 226, 10, '#8a86b0', { align: 'right' });
    };
    if (k === 'Status') {
      heroHeader();
      FONT.draw(ctx, 'HP', 78, 36, '#c8c8f0'); bar(ctx, 96, 38, 70, 4, h.hp, h.maxHp, '#5ae07a'); FONT.draw(ctx, Math.ceil(h.hp) + '/' + h.maxHp, 230, 36, '#ffffff', { align: 'right' });
      FONT.draw(ctx, 'KI', 78, 47, '#c8c8f0'); bar(ctx, 96, 49, 70, 4, h.ki, h.maxKi, '#5ab8ff'); FONT.draw(ctx, Math.floor(h.ki) + '/' + h.maxKi, 230, 47, '#ffffff', { align: 'right' });
      FONT.draw(ctx, 'EXP', 78, 58, '#c8c8f0'); bar(ctx, 96, 60, 70, 4, h.xp, DATA.xpTo(h.lv), '#ffd84a'); FONT.draw(ctx, h.xp + '/' + DATA.xpTo(h.lv), 230, 58, '#ffffff', { align: 'right' });
      const rows = [['STR', Math.floor(h.str), 'Punch power'], ['POW', Math.floor(h.pow), 'Ki power'], ['DEF', Math.floor(h.def), 'Toughness'], ['VIT', h.maxHp, '+8 max HP'], ['SPI', h.maxKi, '+5 max Ki']];
      rows.forEach(([n, v, d], i) => {
        const y = 74 + i * 12, sel = m.sub === 'Status' && m.subSel === i;
        FONT.draw(ctx, n, 86, y, sel ? '#ffd84a' : '#c8c8f0');
        FONT.draw(ctx, String(v), 128, y, '#ffffff', { align: 'right' });
        FONT.draw(ctx, d, 138, y, '#8a86b0');
        if (sel) FONT.draw(ctx, '+', 78, y, '#ffd84a');
      });
      FONT.draw(ctx, 'Points to spend: ' + h.pts, 78, 136, h.pts ? '#7affb0' : '#8a86b0');
      FONT.draw(ctx, m.sub ? 'Z: spend a point' : 'Z: spend points', 78, 146, '#8a86b0');
    } else if (k === 'Specials') {
      heroHeader();
      const all = DATA.HEROES[h.id].specials;
      const have = specialsFor(h);
      all.forEach((sk, i) => {
        const S = DATA.SPECIALS[sk], ok = have.includes(sk), y = 36 + i * 28;
        FONT.draw(ctx, ok ? S.name : '???', 78, y, ok ? '#ffd84a' : '#6a6690');
        FONT.draw(ctx, ok ? S.cost + ' KI' : (S.flag ? 'Story' : 'LV ' + S.lv), 230, y, ok ? '#5ab8ff' : '#6a6690', { align: 'right' });
        FONT.wrap(ok ? S.desc : 'Not learned yet.', 150).slice(0, 2).forEach((ln, j) => FONT.draw(ctx, ln, 82, y + 10 + j * 9, '#c8c8f0'));
      });
      FONT.draw(ctx, 'A: cycle   Hold X: charge', 78, 146, '#8a86b0');
    } else if (k === 'Items') {
      const list = itemList();
      FONT.draw(ctx, 'Use on: ' + DATA.HEROES[h.id].name + ' (' + Math.ceil(h.hp) + '/' + h.maxHp + ')', 78, 10, '#ffd84a');
      if (heroes.length > 1) FONT.draw(ctx, '< >', 226, 10, '#8a86b0', { align: 'right' });
      if (!list.length) FONT.draw(ctx, 'Nothing in your pockets.', 78, 30, '#8a86b0');
      const start = Math.max(0, Math.min(list.length - 8, (m.sub ? m.subSel : 0) - 4));
      list.slice(start, start + 8).forEach((ik, j) => {
        const i = start + j, it = DATA.ITEMS[ik], y = 26 + j * 12, sel = m.sub === 'Items' && m.subSel === i;
        itemIcon(ctx, ik, 80, y - 1);
        FONT.draw(ctx, it.name, 94, y, sel ? '#ffd84a' : it.key ? '#c8b0ff' : '#ffffff');
        FONT.draw(ctx, 'x' + G.items[ik], 230, y, '#c8c8f0', { align: 'right' });
      });
      if (m.sub && list[m.subSel]) FONT.wrap(DATA.ITEMS[list[m.subSel]].desc, 150).slice(0, 2).forEach((ln, j) => FONT.draw(ctx, ln, 78, 126 + j * 10, '#c8c8f0'));
      else FONT.draw(ctx, 'Z: choose an item', 78, 146, '#8a86b0');
    } else if (k === 'Quests') {
      FONT.draw(ctx, 'NOW', 78, 10, '#ffd84a');
      FONT.wrap(STORY.goal(), 150).slice(0, 4).forEach((ln, j) => FONT.draw(ctx, ln, 78, 22 + j * 10, '#ffffff'));
      FONT.draw(ctx, 'ERRANDS', 78, 66, '#ffd84a');
      STORY.sideQuests().slice(0, 7).forEach((q, j) => {
        FONT.draw(ctx, q.done ? '*' : '-', 78, 78 + j * 11, q.done ? '#7affb0' : '#c8c8f0');
        FONT.draw(ctx, q.text, 86, 78 + j * 11, q.done ? '#7a9a8a' : '#ffffff');
      });
    } else if (k === 'Save') {
      FONT.draw(ctx, 'Save your progress', 78, 12, '#ffd84a');
      FONT.wrap('The game also saves itself every time you move between areas. Saves live in this browser only.', 150).forEach((ln, j) => FONT.draw(ctx, ln, 78, 28 + j * 10, '#c8c8f0'));
      FONT.draw(ctx, 'Z: save now', 78, 146, '#8a86b0');
    } else if (k === 'Music') {
      FONT.draw(ctx, 'Music is ' + (AUDIO.musicOn ? 'on' : 'off'), 78, 12, '#ffd84a');
      FONT.draw(ctx, 'Z or M to toggle', 78, 28, '#c8c8f0');
    } else {
      FONT.draw(ctx, 'CONTROLS', 78, 12, '#ffd84a');
      [['Arrows', 'Move'], ['Z', 'Punch / talk'], ['X', 'Ki blast'], ['Hold X', 'Charge special'], ['A', 'Cycle special'], ['S', 'Lens (scouter)'], ['C', 'Tag partner'], ['Enter', 'Menu'], ['M', 'Music']].forEach(([a, b], j) => {
        FONT.draw(ctx, a, 80, 28 + j * 12, '#ffffff'); FONT.draw(ctx, b, 140, 28 + j * 12, '#c8c8f0');
      });
    }
  }

  /* ── shop ─────────────────────────────────────────────── */
  function shop(id, keeper) {
    const s = { kind: 'shop', sel: 0, list: DATA.SHOPS[id], t: 0, done: false };
    s.update = (dt) => {
      s.t += dt;
      const n = s.list.length + 1;
      if (I.take('up')) { s.sel = (s.sel + n - 1) % n; AUDIO.sfx('blip'); }
      if (I.take('down')) { s.sel = (s.sel + 1) % n; AUDIO.sfx('blip'); }
      if (I.take('B') || I.take('START')) { s.done = true; pop(s); AUDIO.sfx('back'); return; }
      if (I.take('A')) {
        if (s.sel === s.list.length) { s.done = true; pop(s); AUDIO.sfx('back'); return; }
        const k = s.list[s.sel], it = DATA.ITEMS[k];
        if (G.coins < it.price) { AUDIO.sfx('deny'); toast('Not enough coins.', '#ff8a8a'); return; }
        G.coins -= it.price; giveItem(k, 1, true); AUDIO.sfx('coin'); toast('Bought ' + it.name + '.', '#ffffff');
      }
    };
    s.draw = (ctx) => {
      box(ctx, 120, 8, 116, s.list.length * 12 + 34);
      FONT.draw(ctx, 'SHOP', 128, 13, '#ffd84a'); FONT.draw(ctx, '@ ' + G.coins, 230, 13, '#ffd84a', { align: 'right' });
      s.list.forEach((k, i) => {
        const it = DATA.ITEMS[k], y = 26 + i * 12, sel = s.sel === i;
        itemIcon(ctx, k, 128, y - 1);
        FONT.draw(ctx, it.name, 142, y, sel ? '#ffd84a' : '#ffffff');
        FONT.draw(ctx, String(it.price), 230, y, G.coins >= it.price ? '#ffffff' : '#8a6a6a', { align: 'right' });
      });
      const y = 26 + s.list.length * 12;
      FONT.draw(ctx, 'Done', 142, y, s.sel === s.list.length ? '#ffd84a' : '#ffffff');
      FONT.draw(ctx, '>', 121 + (Math.floor(s.t * 4) % 2), 26 + s.sel * 12, '#ffd84a');
      const k = s.list[s.sel];
      box(ctx, 4, VH - 30, VW - 8, 26, 'dark');
      FONT.draw(ctx, k ? DATA.ITEMS[k].desc + '  (have ' + (G.items[k] || 0) + ')' : 'Come back any time.', 10, VH - 22, '#ffffff');
    };
    return push(s);
  }

  /* ── HUD ──────────────────────────────────────────────── */
  function drawHUD(ctx) {
    const h = hero(), H = DATA.HEROES[h.id], p = G.player;
    box(ctx, 2, 2, 82, 25, 'dark');
    ctx.drawImage(personSheet(heroLook(h)).face, 5, 6);
    FONT.draw(ctx, 'LV' + h.lv, 24, 4, '#ffd84a');
    const lowHp = h.hp < h.maxHp * 0.25 && Math.floor(G.t * 4) % 2;
    bar(ctx, 24, 14, 56, 4, h.hp, h.maxHp, lowHp ? '#ff5a5a' : h.hp < h.maxHp * 0.5 ? '#f0d040' : '#5ae07a');
    bar(ctx, 24, 21, 56, 3, h.ki, h.maxKi, p.od ? (Math.floor(G.t * 8) % 2 ? H.kiColor : '#ffffff') : '#5ab8ff');
    const o = partner();
    if (o) {
      box(ctx, 2, 28, 40, 16, 'dark');
      ctx.globalAlpha = o.hp <= 0 ? 0.45 : 1;
      ctx.drawImage(personSheet(DATA.HEROES[o.id].look).face, 0, 2, 16, 11, 4, 31, 16, 11);
      ctx.globalAlpha = 1;
      bar(ctx, 22, 35, 16, 3, o.hp, o.maxHp, o.hp <= 0 ? '#ff5a5a' : '#5ae07a');
      FONT.draw(ctx, 'C', 34, 29, '#8a86b0', { shadow: false });
    }
    // special
    const sp = curSpecial(h);
    if (sp) {
      const S = DATA.SPECIALS[sp], can = h.ki >= S.cost;
      const w = FONT.width(S.name) + 30;
      box(ctx, VW - w - 2, 2, w, 15, 'dark');
      if (specialPulse > 0) { ctx.globalAlpha = specialPulse; ctx.fillStyle = '#ffffff'; ctx.fillRect(VW - w - 1, 3, w - 2, 13); ctx.globalAlpha = 1; specialPulse -= 1 / 60; }
      const ob = orb(3, can ? H.kiColor : '#6a6690', can ? H.kiCore : '#a8a4c8');
      ctx.drawImage(ob, VW - w + 2, 4);
      FONT.draw(ctx, S.name, VW - w + 12, 5, can ? '#ffffff' : '#8a86b0');
      FONT.draw(ctx, String(S.cost), VW - 6, 5, can ? '#5ab8ff' : '#ff8a8a', { align: 'right' });
    }
    // charge meter over the hero's head
    if (p.state === 'charge' && p.t > 0.12 && sp) {
      const S = DATA.SPECIALS[sp];
      const f = Math.min(1, p.t / Math.max(0.2, S.charge));
      const x = Math.round(p.x - G.cam.x - 10), y = Math.round(p.y - G.cam.y - 38);
      bar(ctx, x, y, 20, 2, f, 1, f >= 1 ? (h.ki >= S.cost ? (Math.floor(G.t * 12) % 2 ? '#ffffff' : H.kiColor) : '#ff5a5a') : H.kiColor);
    }
    // boss
    const b = G.boss;
    if (b && !b.gone && b.state !== 'intro') {
      box(ctx, 20, VH - 18, VW - 40, 15, 'dark');
      FONT.draw(ctx, b.name, 26, VH - 15, '#ff8a8a');
      const nx = 30 + FONT.width(b.name);
      bar(ctx, nx, VH - 12, VW - 40 - (nx - 20) - 8, 4, b.invulnerable ? b.maxHp : b.hp, b.maxHp, b.invulnerable ? (Math.floor(G.t * 3) % 2 ? '#c8a8ff' : '#8a6ad0') : '#ff5a5a');
    }
    if (G.scouter) drawScouter(ctx);
    // area name
    if (area) {
      area.t += 1 / 60;
      const a = area.t < 0.3 ? area.t / 0.3 : area.t > 2.2 ? Math.max(0, 1 - (area.t - 2.2) / 0.4) : 1;
      if (a <= 0) area = null;
      else {
        ctx.globalAlpha = a;
        const w = FONT.width(area.name) + 20;
        box(ctx, (VW - w) / 2, 30, w, 15, 'dark');
        FONT.draw(ctx, area.name, VW / 2, 33, '#ffffff', { align: 'center' });
        ctx.globalAlpha = 1;
      }
    }
  }
  function drawScouter(ctx) {
    const h = hero();
    ctx.fillStyle = 'rgba(80,255,150,0.07)'; ctx.fillRect(0, 0, VW, VH);
    ctx.fillStyle = '#7affb0';
    for (const [x, y, dx, dy] of [[2, 30, 1, 1], [VW - 3, 30, -1, 1], [2, VH - 3, 1, -1], [VW - 3, VH - 3, -1, -1]]) { ctx.fillRect(Math.min(x, x + dx * 10), y, 10, 1); ctx.fillRect(x, Math.min(y, y + dy * 10), 1, 10); }
    for (let y = (Math.floor(G.t * 40) % 4); y < VH; y += 4) { ctx.fillStyle = 'rgba(122,255,176,0.05)'; ctx.fillRect(0, y, VW, 1); }
    const cx = G.cam.x, cy = G.cam.y;
    for (const e of G.enemies) {
      const x = Math.round(e.x - cx), y = Math.round(e.y - cy - (e.boss && e.d.big ? 50 : 32));
      if (x < -20 || x > VW + 20 || y < -10 || y > VH) continue;
      const diff = e.lv - h.lv;
      const col = e.lv >= 90 ? '#ff4a8a' : diff > 2 ? '#ff6a6a' : diff >= -1 ? '#ffd84a' : '#7affb0';
      FONT.draw(ctx, e.lv >= 90 ? 'LV ???' : 'LV' + e.lv, x, y - 5, col, { align: 'center' });
      if (!e.boss) bar(ctx, x - 8, y + 5, 16, 1, e.hp, e.maxHp, col);
    }
    for (const pr of G.props) {
      if (pr.req) FONT.draw(ctx, 'LV' + pr.req, pr.x - cx, pr.y - cy - 34, h.lv >= pr.req ? '#7affb0' : '#ff6a6a', { align: 'center' });
      if (pr.scanNote) FONT.draw(ctx, pr.scanNote, pr.x - cx, pr.y - cy - 26, '#7affb0', { align: 'center' });
    }
    box(ctx, 2, VH - 15, Math.min(VW - 4, FONT.width(STORY.goal()) + 12), 13, 'dark');
    FONT.draw(ctx, STORY.goal(), 8, VH - 12, '#7affb0');
  }

  function drawToasts(ctx) {
    let y = 50;
    for (const t of toasts) {
      t.t += 1 / 60;
      const a = t.t > 2.2 ? Math.max(0, 1 - (t.t - 2.2) / 0.4) : 1;
      ctx.globalAlpha = a;
      FONT.draw(ctx, t.text, VW / 2, y, t.color, { align: 'center', shadow: '#000000' });
      y += 11;
    }
    ctx.globalAlpha = 1;
    while (toasts.length && toasts[0].t > 2.6) toasts.shift();
  }

  /* big centred text for chapter cards */
  function drawBanner(ctx) {
    if (!banner) return;
    banner.t += 1 / 60;
    const a = banner.t < 0.4 ? banner.t / 0.4 : banner.t > banner.dur - 0.5 ? Math.max(0, (banner.dur - banner.t) / 0.5) : 1;
    ctx.globalAlpha = a;
    ctx.fillStyle = 'rgba(6,4,16,0.75)'; ctx.fillRect(0, 56, VW, 44);
    ctx.fillStyle = '#ffd84a'; ctx.fillRect(0, 56, VW, 1); ctx.fillRect(0, 99, VW, 1);
    FONT.draw(ctx, banner.top, VW / 2, 63, '#c8b0ff', { align: 'center' });
    FONT.draw(ctx, banner.text, VW / 2, 77, '#ffffff', { align: 'center', scale: 2 });
    ctx.globalAlpha = 1;
    if (banner.t > banner.dur) banner = null;
  }

  function update(dt) {
    const m = modal();
    if (m) m.update(dt);
    else if (G.scene === 'play' && !G.script && I.take('START') && G.player.state !== 'ko') { pauseMenu(); AUDIO.sfx('select'); }
    if (gameOverAt > 0) { gameOverAt -= dt; if (gameOverAt <= 0) SCENES.gameOver(); }
  }
  function draw(ctx) {
    if (G.scene === 'play' && !G.hideHud) drawHUD(ctx);
    drawToasts(ctx);
    drawBanner(ctx);
    for (const m of stack) m.draw(ctx);
  }

  return { modal, push, pop, toast, areaName, specialFlash, gameOverSoon, dialogue, pauseMenu, shop, update, draw, box, bar, itemIcon, portrait,
    setBanner: (top, text, dur = 2.6) => { banner = { top, text, dur, t: 0 }; }, bannerUp: () => !!banner, reset: () => { stack.length = 0; toasts.length = 0; area = null; banner = null; gameOverAt = 0; } };
})();

/* ════════════════════════════════════════════════════════
   SCRIPT — the verbs of a cutscene
   ════════════════════════════════════════════════════════ */
const SCRIPT = (() => {
  const W = (update, extra = {}) => Object.assign({ update }, extra);
  function say(who, text) {
    let d = null;
    return W(() => { if (!d) d = UI.dialogue(who, text); return d.done; });
  }
  function ask(who, text, options) {
    const w = W(() => { if (!w.d) w.d = UI.dialogue(who, text, { options }); if (w.d.done) { w.result = w.d.result; return true; } return false; });
    return w;
  }
  function wait(s) { let t = 0; return W((dt) => (t += dt) >= s); }
  function actor(id) { return id === 'player' ? G.player : npc(id); }
  function walk(id, tx, ty, speed = 50) {
    const px = tx * TS + 8, py = ty * TS + 12;
    let started = false;
    return W((dt) => {
      const a = actor(id);
      if (!a) return true;
      if (a === G.player) {
        const dx = px - a.x, dy = py - a.y, d = Math.hypot(dx, dy), step = speed * dt;
        if (d <= step) { a.x = px; a.y = py; a.walkT = 0; return true; }
        a.x += dx / d * step; a.y += dy / d * step; a.dir = dirFrom(dx, dy); a.walkT += dt; a.state = 'move';
        return false;
      }
      if (!started) { a.path = [px, py]; a.speed = speed; started = true; }
      return !a.path;
    });
  }
  function face(id, dir) { return W(() => { const a = actor(id); if (a) { a.dir = dir; if (a === G.player) { a.walkT = 0; } } return true; }); }
  function fade(to, time = 0.3) {
    let from = null, t = 0;
    return W((dt) => { if (from === null) from = G.fade; t += dt; G.fade = from + (to - from) * Math.min(1, t / time); return t >= time; });
  }
  function* warp(map, tx, ty, dir) {
    AUDIO.sfx('door');
    yield fade(1, 0.25);
    loadMap(map, tx, ty, dir);
    SAVE.auto();
    yield fade(0, 0.25);
  }
  function fight(id, tx, ty, opts = {}) {
    let b = null;
    const w = W((dt) => {
      if (!b) {
        b = spawnBoss(id, tx * TS + 8, ty * TS + 12, opts);
        if (opts.lock) G.lock = { x: opts.lock[0] * TS, y: opts.lock[1] * TS, w: opts.lock[2] * TS, h: opts.lock[3] * TS };
        AUDIO.play(opts.music || 'battle');
        G.noKO = !!opts.noKO;
        w.t = 0;
      }
      w.t += dt;
      if (G.player.state === 'ko') return false;
      const over = b.gone || b.ended || (opts.until && opts.until(w.t, b));
      if (over) {
        G.lock = null; G.noKO = false;
        for (const m of b.minions || []) { m.dead = true; burst(m.x, m.y - 8, '#ffffff', 8, 40); }
        G.enemies = G.enemies.filter((e) => !(b.minions || []).includes(e) && (e !== b || !b.ended && !opts.until));
        G.shots = []; G.hazards = [];
        w.result = b;
        if (!b.gone) { b.gone = true; G.enemies = G.enemies.filter((e) => e !== b); }
        G.boss = null;
        G.player.state = 'move'; G.player.kbx = G.player.kby = 0;
        if (G.player.od) endOverdrive();
        return true;
      }
      return false;
    }, { control: true });
    return w;
  }
  function spawn(id, look, tx, ty, dir = 'down', extra = {}) { return W(() => { addNpc(Object.assign({ id, look, tx, ty, dir }, extra)); return true; }); }
  function remove(id) { return W(() => { G.npcs = G.npcs.filter((n) => n.id !== id); return true; }); }
  function music(name) { return W(() => { AUDIO.play(name); return true; }); }
  function sfx(name) { return W(() => { AUDIO.sfx(name); return true; }); }
  function shake(t = 0.4) { return W(() => { G.shake = t; return true; }); }
  function banner(top, text, dur = 2.6) { let s = false; return W(() => { if (!s) { UI.setBanner(top, text, dur); s = true; } return !UI.bannerUp(); }); }
  function flash(color = '#ffffff') { let t = 0; return W((dt) => { G.flashColor = color; G.flashA = Math.max(0, 1 - (t += dt) / 0.4); return t > 0.4; }); }
  function run(fn) { return W(() => { fn(); return true; }); }
  return { say, ask, wait, walk, face, fade, warp, fight, spawn, remove, music, sfx, shake, banner, flash, run };
})();

/* ════════════════════════════════════════════════════════
   SAVING — in this browser only
   ════════════════════════════════════════════════════════ */
const SAVE = (() => {
  const KEY = 'skybreaker.save.v1', AUTO = 'skybreaker.auto.v1';
  function snapshot(atEntry) {
    const p = G.player, e = G.lastEntry;
    const at = atEntry || !p ? e : { map: G.mapId, x: Math.floor(p.x / TS), y: Math.floor((p.y - 4) / TS), dir: p.dir };
    return { v: 1, at, party: G.party, active: G.active, items: G.items, coins: G.coins, flags: G.flags, playTime: G.playTime, sel: {} };
  }
  function write(key, data) { try { localStorage.setItem(key, JSON.stringify(data)); return true; } catch (e) { return false; } }
  function read(key) { try { const s = localStorage.getItem(key); return s ? JSON.parse(s) : null; } catch (e) { return null; } }
  function save() { const s = snapshot(false); return write(KEY, s) && write(AUTO, s); }
  function auto() { if (G.flags.noAuto) return; write(AUTO, snapshot(true)); }
  function latest() {
    const a = read(AUTO), b = read(KEY);
    if (!a) return b; if (!b) return a;
    return a.playTime >= b.playTime ? a : b;
  }
  function apply(s, heal) {
    G.party = s.party; G.active = s.active; G.items = s.items; G.coins = s.coins; G.flags = s.flags; G.playTime = s.playTime || 0;
    for (const id in G.party) { const h = G.party[id]; if (heal || h.hp <= 0 && heal !== false) { h.hp = h.maxHp; h.ki = h.maxKi; } }
    if (G.party[G.active].hp <= 0) { const o = G.active === 'juno' ? 'brask' : 'juno'; if (G.party[o] && G.party[o].joined && G.party[o].hp > 0) G.active = o; else G.party[G.active].hp = G.party[G.active].maxHp; }
    G.player = null;
    loadMap(s.at.map, s.at.x, s.at.y, s.at.dir);
  }
  return { save, auto, latest, apply, has: () => !!latest() };
})();
