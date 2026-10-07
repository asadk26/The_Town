/* SKYBREAKER — boot, scenes, and the loop.

   The game runs at the handheld's 240x160 and is scaled up by whole pixels
   to fit the window.  The simulation steps at a fixed 60 per second however
   fast the display refreshes. */
'use strict';

const screen = document.getElementById('screen');
const ctx = screen.getContext('2d');
ctx.imageSmoothingEnabled = false;

function fit() {
  const legend = document.querySelector('.keys');
  const lh = legend && getComputedStyle(legend).display !== 'none' ? legend.offsetHeight + 12 : 0;
  const k = Math.max(1, Math.floor(Math.min((innerWidth - 16) / VW, (innerHeight - 16 - lh) / VH)));
  screen.style.width = VW * k + 'px';
  screen.style.height = VH * k + 'px';
}
addEventListener('resize', fit);

/* ── scenes ─────────────────────────────────────────────── */
const SCENES = (() => {
  let title = null, over = null, credits = null;

  function newGame() {
    UI.reset();
    Object.assign(G, { party: { juno: newHero('juno', 1) }, active: 'juno', items: {}, coins: 0, flags: {}, player: null, playTime: 0, script: null, queue: [], scouter: false, fade: 1, hideHud: false });
    G.scene = 'play';
    loadMap('home', 3, 4, 'down');
  }
  function cont() {
    const s = SAVE.latest();
    if (!s) return newGame();
    UI.reset();
    Object.assign(G, { script: null, queue: [], scouter: false, fade: 0, hideHud: false });
    G.scene = 'play';
    SAVE.apply(s, false);
    UI.toast('Welcome back.', '#7affb0');
  }

  /* title */
  function toTitle() {
    UI.reset();
    G.scene = 'title'; G.script = null; G.fade = 0;
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
    // sky
    const bands = ['#120a2a', '#1a1040', '#28165a', '#3a1c6a', '#5a2470', '#8a3070', '#c04a5a', '#e8784a', '#f8a850'];
    for (let i = 0; i < bands.length; i++) { c.fillStyle = bands[i]; c.fillRect(0, i * 12, VW, 12); }
    for (let i = 0; i < 40; i++) {
      const x = GFX.hash(i, 1) * VW, y = GFX.hash(i, 2) * 60;
      if (Math.sin(t * 2 + i) > -0.3) { c.fillStyle = i % 5 ? '#c8c0ff' : '#ffffff'; c.fillRect(Math.round(x), Math.round(y), 1, 1); }
    }
    // a streak across the sky
    const sx = ((t * 40) % 400) - 80;
    c.fillStyle = '#fff2c0'; c.fillRect(Math.round(sx), 28, 3, 1); c.fillStyle = '#ffb06a'; c.fillRect(Math.round(sx) - 8, 28, 8, 1);
    // mountains
    for (let x = 0; x < VW; x++) {
      const h = 88 + Math.round(GFX.smooth(x / 30, 1) * 30 + GFX.smooth(x / 9, 2) * 6);
      c.fillStyle = '#4a2050'; c.fillRect(x, h, 1, VH - h);
      const h2 = 110 + Math.round(GFX.smooth(x / 22 + 9, 3) * 20);
      c.fillStyle = '#2a1238'; c.fillRect(x, h2, 1, VH - h2);
    }
    // the cliff they stand on
    c.fillStyle = '#1a0c22'; c.fillRect(120, 128, 120, 32);
    for (let x = 120; x < VW; x++) { const h = 124 + Math.round(GFX.smooth(x / 6, 7) * 5); c.fillRect(x, h, 1, 8); }
    c.fillStyle = '#3a1c40'; for (let x = 124; x < VW; x += 2) c.fillRect(x, 126 + Math.round(GFX.smooth(x / 6, 7) * 5) - 2, 1, 1);
    // heroes, at 2x, hair moving in the wind
    const f = Math.floor(t * 3) % 2 ? 'walk1' : 'idle';
    const ju = personSheet('juno'), br = personSheet('brask');
    c.drawImage(br.left.idle, 0, 0, 24, 32, 168, 64, 48, 64);
    c.drawImage(ju.left[Math.floor(t * 2) % 4 === 0 ? 'charge' : 'idle'], 0, 0, 24, 32, 140, 66, 48, 64);
    if (Math.floor(t * 2) % 4 === 0) {
      c.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 6; i++) { c.fillStyle = i % 2 ? '#ff8a2a' : '#fff2a0'; c.fillRect(150 + Math.round(GFX.hash(i, Math.floor(t * 10)) * 30), 70 + Math.round(GFX.hash(i, Math.floor(t * 10) + 5) * 50), 2, 2); }
      c.globalCompositeOperation = 'source-over';
    }
    void f;
    // logo
    const lx = 66, ly = 18;
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [2, 2], [1, 2], [2, 1]]) FONT.draw(c, 'SKYBREAKER', lx + dx, ly + dy, '#2a0e30', { align: 'center', scale: 2, shadow: false });
    FONT.draw(c, 'SKYBREAKER', lx, ly, '#ffd84a', { align: 'center', scale: 2, shadow: false });
    c.fillStyle = '#fff2a0'; c.fillRect(lx - 60, ly + 2, 120, 1);
    FONT.draw(c, 'The Interworld Cup', lx, ly + 24, '#ffe0c8', { align: 'center' });
    // menu
    const items = titleItems();
    UI.box(c, 14, 74, 104, items.length * 13 + 10, 'dark');
    items.forEach((k, i) => {
      const label = k === 'Music' ? 'Music: ' + (AUDIO.musicOn ? 'On' : 'Off') : k;
      const sel = i === title.sel;
      FONT.draw(c, label, 30, 80 + i * 13, sel ? '#ffd84a' : '#ffffff');
      if (sel) FONT.draw(c, '>', 21 + (Math.floor(t * 4) % 2), 80 + i * 13, '#ffd84a');
    });
    FONT.draw(c, 'Z or Enter to choose', 14, 148, '#e8b8c8');
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
      Object.assign(G, { script: null, queue: [], scouter: false, fade: 0 });
      G.scene = 'play';
      if (s) { SAVE.apply(s, true); G.coins = Math.floor(G.coins * 0.9); UI.toast('Back on your feet. (Lost a few coins.)', '#ffd84a'); }
      else newGame();
    }
  }
  function overDraw(c) {
    drawWorld(c);
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
  function rollCredits() { G.scene = 'credits'; credits = { y: VH + 10, t: 0 }; AUDIO.play('title'); G.fade = 0; }
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
  if (I.take('MUTE')) { const on = AUDIO.toggleMusic(); if (G.scene === 'play') UI.toast('Music ' + (on ? 'on' : 'off'), '#c8c8f0'); }
  switch (G.scene) {
    case 'title': SCENES.titleUpdate(dt); break;
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
function draw() {
  switch (G.scene) {
    case 'title': SCENES.titleDraw(ctx); UI.draw(ctx); break;
    case 'over': SCENES.overDraw(ctx); break;
    case 'credits': SCENES.creditsDraw(ctx); break;
    case 'play':
      drawWorld(ctx);
      UI.draw(ctx);
      break;
  }
  if (G.flashA > 0) { ctx.globalAlpha = G.flashA; ctx.fillStyle = G.flashColor || '#ffffff'; ctx.fillRect(0, 0, VW, VH); ctx.globalAlpha = 1; }
  if (G.fade > 0) {
    ctx.globalAlpha = Math.min(1, G.fade); ctx.fillStyle = '#000000'; ctx.fillRect(0, 0, VW, VH); ctx.globalAlpha = 1;
    // dialogue over a black screen still needs to be read
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
    draw();
  } catch (e) {
    // one bad frame should never freeze the cabinet
    console.error(e);
  }
  requestAnimationFrame(frame);
}

function boot() {
  SPR.props = GFX.propCanvases();
  SPR.anim = GFX.animatedProps();
  SPR.stamp = GFX.stamp();
  fit();
  SCENES.toTitle();
  requestAnimationFrame(frame);
}
boot();

/* A handle for the test suite, and for anyone curious in the console. */
window.SKY = { G, SCENES, STORY, SAVE, loadMap, newHero, levelUp, giveItem, hero, I, step, draw, MAPS, DATA };
