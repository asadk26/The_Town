/* SKYBREAKER — boot, scenes, and the loop.

   The game runs at the handheld's 240x160 and is scaled up by whole pixels
   to fit the window.  The simulation steps at a fixed 60 per second however
   fast the display refreshes. */
'use strict';

const screen = document.getElementById('screen');
const ctx = screen.getContext('2d');
const IS_TOUCH = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;

/* The pixel UI is drawn at a small logical size (about 180 tall) and scaled up
   by a whole number, so text and boxes stay crisp at any screen shape.  The 3D
   world underneath renders at the screen's own resolution. */
function fit() {
  const k = Math.max(1, Math.round(innerHeight / 184));
  VH = Math.ceil(innerHeight / k);
  VW = Math.max(240, Math.ceil(innerWidth / k));
  screen.width = VW; screen.height = VH;
  screen.style.width = VW * k + 'px';
  screen.style.height = VH * k + 'px';
  ctx.imageSmoothingEnabled = false;
  R3.resize();
}
addEventListener('resize', fit);
addEventListener('orientationchange', () => setTimeout(fit, 200));

/* ── scenes ─────────────────────────────────────────────── */
const SCENES = (() => {
  let title = null, over = null, credits = null;

  function newGame() {
    UI.reset();
    G.titleMode = false; G.camOverride = null;
    Object.assign(G, { party: { juno: newHero('juno', 1) }, active: 'juno', items: {}, coins: 0, flags: {}, player: null, playTime: 0, script: null, queue: [], scouter: false, fade: 1, hideHud: false });
    G.scene = 'play';
    loadMap('home', 3, 4, 'down');
  }
  function cont() {
    const s = SAVE.latest();
    if (!s) return newGame();
    UI.reset();
    G.titleMode = false; G.camOverride = null;
    Object.assign(G, { script: null, queue: [], scouter: false, fade: 0, hideHud: false });
    G.scene = 'play';
    SAVE.apply(s, false);
    UI.toast('Welcome back.', '#7affb0');
  }

  /* title */
  function toTitle() {
    UI.reset();
    G.scene = 'title'; G.script = null; G.fade = 0;
    // the village stands behind the title, with nobody in control
    Object.assign(G, { party: { juno: newHero('juno', 1) }, active: 'juno', flags: { act1: true }, player: null, titleMode: true });
    loadMap('village', 24, 21, 'down');
    UI.reset();
    title = { t: 0, sel: SAVE.has() ? 1 : 0 };
    AUDIO.play('title');
  }
  function titleItems() { return SAVE.has() ? ['New Game', 'Continue', 'Music'] : ['New Game', 'Music']; }
  function titleUpdate(dt) {
    title.t += dt;
    const items = titleItems();
    if (I.take('up')) { title.sel = (title.sel + items.length - 1) % items.length; AUDIO.sfx('blip'); }
    if (I.take('down')) { title.sel = (title.sel + 1) % items.length; AUDIO.sfx('blip'); }
    if (I.take('A') || I.take('START')) {
      const k = items[title.sel];
      if (k === 'Music') { AUDIO.toggleMusic(); AUDIO.sfx('select'); return; }
      AUDIO.sfx('select');
      if (k === 'New Game') newGame(); else cont();
    }
  }
  function titleDraw(c) {
    const t = title.t;
    // a slow drift over the village, behind the menu
    G.camOverride = { x: 24.5 + Math.sin(t * 0.08) * 6, z: 20 + Math.cos(t * 0.06) * 3 };
    const g = c.createLinearGradient(0, 0, 0, VH);
    g.addColorStop(0, 'rgba(12,6,28,0.72)'); g.addColorStop(0.45, 'rgba(12,6,28,0.15)'); g.addColorStop(1, 'rgba(12,6,28,0.55)');
    c.fillStyle = g; c.fillRect(0, 0, VW, VH);
    const lx = Math.round(VW / 2), ly = Math.round(VH * 0.16);
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [2, 2], [1, 2], [2, 1]]) FONT.draw(c, 'SKYBREAKER', lx + dx, ly + dy, '#2a0e30', { align: 'center', scale: 3, shadow: false });
    FONT.draw(c, 'SKYBREAKER', lx, ly, '#ffd84a', { align: 'center', scale: 3, shadow: false });
    FONT.draw(c, 'The Interworld Cup', lx, ly + 32, '#ffe0c8', { align: 'center' });
    const items = titleItems();
    const bw = 110, bh = items.length * 13 + 10, bx = Math.round(lx - bw / 2), by = Math.round(VH * 0.56);
    UI.box(c, bx, by, bw, bh, 'dark');
    items.forEach((k, i) => {
      const label = k === 'Music' ? 'Music: ' + (AUDIO.musicOn ? 'On' : 'Off') : k;
      const sel = i === title.sel;
      FONT.draw(c, label, bx + 18, by + 6 + i * 13, sel ? '#ffd84a' : '#ffffff');
      if (sel) FONT.draw(c, '>', bx + 9 + (Math.floor(t * 4) % 2), by + 6 + i * 13, '#ffd84a');
    });
    FONT.draw(c, IS_TOUCH ? 'Tap A to choose' : 'Z or Enter to choose', lx, VH - 14, '#e8b8c8', { align: 'center' });
  }

  /* game over */
  function gameOver() {
    G.scene = 'over';
    over = { t: 0, sel: 0 };
    AUDIO.stop(); AUDIO.jingle('gameover');
  }
  function overUpdate(dt) {
    over.t += dt;
    if (over.t < 0.8) return;
    if (I.take('up') || I.take('down')) { over.sel = 1 - over.sel; AUDIO.sfx('blip'); }
    if (I.take('A') || I.take('START')) {
      AUDIO.sfx('select');
      if (over.sel === 1) { toTitle(); return; }
      const s = (() => { try { return JSON.parse(localStorage.getItem('skybreaker.auto.v1')); } catch (e) { return null; } })() || SAVE.latest();
      UI.reset();
      Object.assign(G, { script: null, queue: [], scouter: false, fade: 0, titleMode: false, camOverride: null });
      G.scene = 'play';
      if (s) { SAVE.apply(s, true); G.coins = Math.floor(G.coins * 0.9); UI.toast('Back on your feet. (Lost a few coins.)', '#ffd84a'); }
      else newGame();
    }
  }
  function overDraw(c) {
    c.fillStyle = 'rgba(10,0,16,' + Math.min(0.8, over.t) + ')'; c.fillRect(0, 0, VW, VH);
    if (over.t < 0.5) return;
    FONT.draw(c, 'DOWN FOR', VW / 2, 34, '#ff6a6a', { align: 'center', scale: 2 });
    FONT.draw(c, 'THE COUNT', VW / 2, 56, '#ff6a6a', { align: 'center', scale: 2 });
    ['Get back up', 'Back to title'].forEach((k, i) => {
      FONT.draw(c, k, VW / 2, 98 + i * 14, i === over.sel ? '#ffd84a' : '#ffffff', { align: 'center' });
      if (i === over.sel) FONT.draw(c, '>', VW / 2 - FONT.width(k) / 2 - 9, 98 + i * 14, '#ffd84a');
    });
    FONT.draw(c, 'You restart where you last entered this area.', VW / 2, 136, '#c8a8c8', { align: 'center' });
  }

  /* credits */
  const CREDITS = [
    ['', 0], ['SKYBREAKER', 2], ['The Interworld Cup', 1], ['', 0], ['', 0],
    ['Hearth was spared.', 1], ['So was everyone else.', 1], ['', 0],
    ['Velvet changed her name back.', 1], ['Then changed it again.', 1], ['', 0],
    ['GRB-9 cleaned World 31', 1], ['until it sparkled.', 1], ['', 0],
    ['Null went home.', 1], ['It was loud.', 1], ['', 0],
    ['Pell got promoted', 1], ['to the second floor.', 1], ['', 0],
    ['The moss is still at nine.', 1], ['', 0], ['', 0],
    ['Juno vs. Brask', 1], ['Match one hundred:', 1], ['still inconclusive.', 1], ['', 0], ['', 0],
    ['An original game for The Town.', 1], ['Code, pixels, music & story', 1], ['made from scratch in a browser.', 1], ['', 0], ['', 0],
    ['THANK YOU FOR PLAYING', 1], ['', 0], ['', 0], ['Your save is kept. Continue to', 1], ['wander, train, and find every chest.', 1],
  ];
  function rollCredits() { G.camOverride = null; G.scene = 'credits'; credits = { y: VH + 10, t: 0 }; AUDIO.play('title'); G.fade = 0; }
  function creditsUpdate(dt) {
    credits.t += dt;
    credits.y -= dt * (I.held.A || I.held.START ? 60 : 16);
    const end = credits.y + CREDITS.length * 14;
    if (end < 40 && (I.take('A') || I.take('START') || end < -20)) toTitle();
  }
  function creditsDraw(c) {
    c.fillStyle = '#0a0618'; c.fillRect(0, 0, VW, VH);
    for (let i = 0; i < 60; i++) { c.fillStyle = i % 7 ? '#5a4a9a' : '#ffffff'; c.fillRect(Math.round(GFX.hash(i, 3) * VW), Math.round((GFX.hash(i, 4) * VH + credits.t * (4 + i % 5)) % VH), 1, 1); }
    CREDITS.forEach(([text, kind], i) => {
      const y = Math.round(credits.y + i * 14);
      if (y < -20 || y > VH) return;
      FONT.draw(c, text, VW / 2, y, kind === 2 ? '#ffd84a' : '#ffffff', { align: 'center', scale: kind === 2 ? 2 : 1 });
    });
  }

  return { newGame, cont, toTitle, titleUpdate, titleDraw, gameOver, overUpdate, overDraw, credits: rollCredits, creditsUpdate, creditsDraw };
})();

/* ── the loop ───────────────────────────────────────────── */
function step(dt) {
  G.t += dt;
  TOUCH.update();
  if (I.take('MUTE')) { const on = AUDIO.toggleMusic(); if (G.scene === 'play') UI.toast('Music ' + (on ? 'on' : 'off'), '#c8c8f0'); }
  switch (G.scene) {
    case 'title': SCENES.titleUpdate(dt); updateNpcs(dt); break;
    case 'over': SCENES.overUpdate(dt); break;
    case 'credits': SCENES.creditsUpdate(dt); break;
    case 'play': {
      UI.update(dt);
      if (G.scene !== 'play') break;
      STORY.update(dt);
      if (!UI.modal()) updateWorld(dt);
      else { updateEffects(0); }
      break;
    }
  }
  I.endFrame();
}
function draw(dt) {
  if (G.scene === 'play' || G.scene === 'over' || G.scene === 'title') R3.render(dt);
  ctx.clearRect(0, 0, VW, VH);
  switch (G.scene) {
    case 'title': SCENES.titleDraw(ctx); UI.draw(ctx); break;
    case 'over': SCENES.overDraw(ctx); UI.draw(ctx); break;
    case 'credits': SCENES.creditsDraw(ctx); break;
    case 'play': UI.draw(ctx); break;
  }
  if (G.flashA > 0) { ctx.globalAlpha = G.flashA; ctx.fillStyle = G.flashColor || '#ffffff'; ctx.fillRect(0, 0, VW, VH); ctx.globalAlpha = 1; }
  if (G.fade > 0) {
    ctx.globalAlpha = Math.min(1, G.fade); ctx.fillStyle = '#000000'; ctx.fillRect(0, 0, VW, VH); ctx.globalAlpha = 1;
    if (G.scene === 'play' && UI.modal()) UI.modal().draw(ctx);
  }
}

let last = performance.now(), acc = 0;
function frame(now) {
  acc += Math.min(0.25, (now - last) / 1000);
  last = now;
  const DT = 1 / 60;
  let n = 0;
  try {
    while (acc >= DT && n < 5) { step(DT); acc -= DT; n++; }
    if (n === 5) acc = 0;
    draw(Math.max(DT, n * DT));
  } catch (e) {
    // one bad frame should never freeze the cabinet
    console.error(e);
  }
  requestAnimationFrame(frame);
}

function boot() {
  R3.init(document.getElementById('view'), /[?&]test\b/.test(location.search) ? 'test' : IS_TOUCH || innerWidth * innerHeight < 600000 ? 'low' : 'high');
  SPR.props = GFX.propCanvases();
  SPR.anim = GFX.animatedProps();
  SPR.stamp = GFX.stamp();
  fit();
  SCENES.toTitle();
  requestAnimationFrame(frame);
}
boot();

/* A handle for the test suite, and for anyone curious in the console. */
window.SKY = { G, SCENES, STORY, SAVE, loadMap, newHero, levelUp, giveItem, hero, I, step, draw, MAPS, DATA, R3 };
