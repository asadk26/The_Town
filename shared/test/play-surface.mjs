/* THE TOWN — the play surface, checked on every game in the collection.

   One script for all of them: the safeguard is shared, so the checks are too,
   and a new minigame joins by adding a line to GAMES below.  Run:

     CHROME=/path/to/chrome node shared/test/play-surface.mjs

   What it is looking for is the difference between a game and a web page:
   nothing selects, highlights or drags out under the thumb while you play,
   and everything that is not the game — the launcher, prose, a text field —
   still behaves like the web. */

import { chromium } from 'playwright-core';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';

const HERE = resolve(fileURLToPath(import.meta.url), '..');
const page_ = (rel) => pathToFileURL(resolve(HERE, '../..', rel)).href;

/* name, page, the gameplay surface, viewport, and the button that starts a
   round — the checks matter most once a game is actually being played. */
const GAMES = [
  ['Quiet Stacks',           page_('quiet-stacks/index.html'),           '.room',  [360, 640], '#beginBtn'],
  ['Quiet Stacks landscape', page_('quiet-stacks/landscape/index.html'), '.room',  [844, 390], '#beginBtn'],
  ['Order Up',               page_('order-up/index.html'),               '.diner', [844, 390], '#playBtn'],
  ['Mail Run',               page_('mail-run/index.html'),               '.game',  [844, 390], '#goBtn'],
];

/* ── Fit ────────────────────────────────────────────────────────────────
   A phone is not as tall as it says it is: Safari's bars take a third of a
   landscape screen, so a 852x393 handset plays in about 852x320. A card that
   overflows there hides its own Start button behind a scroll nobody expects in
   a game — which is exactly what a player finds. Each game is checked in the
   states its cards actually appear in, at the sizes real phones actually give.

   The setups run in the page and use the game's own globals. */
const LANDSCAPE = [[852, 393], [852, 330], [844, 320], [740, 300], [667, 280]];
const PORTRAIT   = [[393, 852], [393, 660], [375, 600], [360, 540], [360, 520]];

const CARDS = [
  { name: 'Quiet Stacks', page: page_('quiet-stacks/index.html'), card: '#overlayCard',
    sizes: PORTRAIT, states: {
      'the title, every tier open': () => {
        progress.unlocked = 5; progress.best = { 3: { score: 900, grade: 'S', time: 64 } };
        saveProgress(); showTitle(); },
      'the shift results': () => {
        CONFIG.splashMs = 0; startShift(3);
        S.shelved = 8; S.helped = 6; S.attempts = 15; S.correct = 14;
        S.bestStreak = 9; S.score = 640; S.elapsed = 66; endShift(); },
    } },
  { name: 'Quiet Stacks landscape', page: page_('quiet-stacks/landscape/index.html'),
    card: '#overlayCard', sizes: LANDSCAPE, states: {
      'the title, every tier open': () => {
        progress.unlocked = 5;
        progress.best = { 3: { score: 900, grade: 'S', time: 64 },
                          4: { score: 800, grade: 'A', time: 88 },
                          5: { score: 700, grade: 'B', time: 99 } };
        saveProgress(); showTitle(); },
      'the shift results': () => {
        CONFIG.splashMs = 0; startShift(3);
        S.shelved = 8; S.helped = 6; S.attempts = 15; S.correct = 14;
        S.bestStreak = 9; S.score = 640; S.elapsed = 66; endShift(); },
      'are you sure': () => showConfirmReset(),
    } },
  { name: 'Order Up', page: page_('order-up/index.html'), card: '#card',
    sizes: LANDSCAPE, states: {
      'the door': () => { best = { order: 7, correct: 22, streak: 9 }; saveBest(); showTitle(); },
      'the rush is over': () => {
        startRun(); S.highest = 7; S.correct = 18; S.bestStreak = 9; S.mistakes = 3;
        endRun(false); },
    } },
  { name: 'Mail Run', page: page_('mail-run/index.html'), card: '#card',
    sizes: LANDSCAPE, states: {
      'the depot, every round open': () => {
        best.unlocked = ROUTES.length;
        ROUTES.forEach((r, i) => { best.records[r.id] = { time: 61.2 + i, score: 900 + i, grade: 'A' }; });
        best.endless = { payout: 4321, delivered: 17, top: 268 };
        best.random = { time: 70, score: 800 };
        saveBest(); showTitle(); },
      'a round driven': () => {
        best.unlocked = ROUTES.length; chosenRoute = ROUTES[0].id; startRun();
        S.t = 78.4; S.ratings = ['messy', 'good', 'messy', 'good', 'messy'];
        S.score = 565; S.at = 5; endRun(); },
      'a round that unlocks the next': () => {
        best.unlocked = 1; saveBest(); chosenRoute = ROUTES[0].id; startRun();
        S.t = 61; S.ratings = ['perfect', 'perfect', 'perfect', 'perfect', 'perfect'];
        S.score = 1100; S.at = 5; endRun(); },
    } },
];

/* An iPhone's sensor housing, posed without an iPhone: the shared surface reads
   its insets through these custom properties, so a stylesheet can stand in for
   the notch and the checks can see whether anything sits under it. */
const ISLAND = (t, r, b, l) => `.play-surface {
  --play-safe-top: ${t}px; --play-safe-right: ${r}px;
  --play-safe-bottom: ${b}px; --play-safe-left: ${l}px; }`;

const fails = [];
let checks = 0;
const ck = (name, ok, extra = '') => {
  checks++;
  console.log((ok ? '  ok  ' : '  FAIL') + '  ' + name + (extra ? '  ' + extra : ''));
  if (!ok) fails.push(name);
};

const browser = await chromium.launch(
  process.env.CHROME ? { executablePath: process.env.CHROME } : {});

/* Drag the mouse across a box and report what the browser decided to select. */
async function dragOver(page, box) {
  await page.evaluate(() => getSelection().removeAllRanges());
  await page.mouse.move(box.x + 4, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width - 4, box.y + box.height / 2, { steps: 12 });
  await page.mouse.up();
  return page.evaluate(() => getSelection().toString().trim());
}

/* Two of the rules cannot be seen from a headless Chromium: -webkit-touch-callout
   is Safari's alone, and it is the one that stops the iOS copy/share card on a
   long press.  Check the source ships it, then check everything else live. */
console.log('\n── the shared rules ──');
{
  const css = readFileSync(resolve(HERE, '../play-surface.css'), 'utf8');
  const has = (re) => re.test(css);
  ck('the iOS long-press callout is turned off', has(/-webkit-touch-callout:\s*none/));
  ck('and turned back on for text and fields',
     (css.match(/-webkit-touch-callout:\s*default/g) || []).length >= 2);
  ck('selection is refused in every dialect',
     has(/-webkit-user-select:\s*none/) && has(/-moz-user-select:\s*none/) &&
     has(/-ms-user-select:\s*none/) && has(/\buser-select:\s*none/));
  ck('artwork cannot be dragged out', has(/-webkit-user-drag:\s*none/));
}

for (const [name, url, root, [w, h], beginSel] of GAMES) {
  console.log(`\n── ${name} ──`);
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });
  await page.goto(url);

  // it is wired to the shared file, not to a copy that has drifted
  const wired = await page.evaluate(() => ({
    css: !!document.querySelector('link[href$="shared/play-surface.css"]'),
    js: !!document.querySelector('script[src$="shared/play-surface.js"]'),
  }));
  ck('uses the shared play surface', wired.css && wired.js,
     (wired.css ? '' : 'no stylesheet ') + (wired.js ? '' : 'no script'));

  // the gameplay surface itself
  const surf = await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const cs = getComputedStyle(el);
    // something deep inside it, to prove the rule reaches the whole cabinet
    const deep = [...el.querySelectorAll('*')]
      .find((n) => n.children.length === 0 && (n.textContent || '').trim().length > 2);
    const ds = deep ? getComputedStyle(deep) : null;
    return {
      hasClass: el.classList.contains('play-surface'),
      select: cs.userSelect || cs.webkitUserSelect,
      touch: cs.touchAction,
      tap: cs.getPropertyValue('-webkit-tap-highlight-color'),
      overscroll: cs.overscrollBehaviorY,
      deepTag: deep ? deep.tagName.toLowerCase() : null,
      deepSelect: ds ? (ds.userSelect || ds.webkitUserSelect) : null,
      // whatever this build draws with: artwork must not peel off under a drag
      art: [...el.querySelectorAll('canvas, svg, img')]
        .map((n) => getComputedStyle(n).getPropertyValue('-webkit-user-drag'))
        .filter((v, i, a) => a.indexOf(v) === i),
    };
  }, root);
  ck('the gameplay area is a play surface', !!surf && surf.hasClass, root);
  ck('nothing on it selects', surf.select === 'none' && surf.deepSelect === 'none',
     `surface ${surf.select}, ${surf.deepTag} ${surf.deepSelect}`);
  ck('no grey flash on a fast tap', /rgba\(0, 0, 0, 0\)|transparent/.test(surf.tap), surf.tap);
  ck('artwork stays put under a drag',
     surf.art.length === 0 || surf.art.every((v) => v === 'none'),
     surf.art.length ? surf.art.join(', ') : 'nothing drawn yet');
  ck('a tap is a tap, not a maybe-double-tap-zoom', surf.touch === 'manipulation', surf.touch);
  ck('pull-to-refresh stops at the edge of the game',
     surf.overscroll === 'contain' || surf.overscroll === 'none', surf.overscroll);

  // the two events the browser fires whatever the CSS says
  const guarded = await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    const fire = (type) => {
      const e = new Event(type, { bubbles: true, cancelable: true });
      el.dispatchEvent(e);
      return e.defaultPrevented;
    };
    return { select: fire('selectstart'), drag: fire('dragstart') };
  }, root);
  ck('a drag on the game starts no selection', guarded.select);
  ck('and drags no artwork out of it', guarded.drag);

  // dragging across the game really does select nothing — with a control on
  // the same page, so a passing check cannot just mean the drag missed
  const box = await page.locator(root).boundingBox();
  const inGame = await dragOver(page, { x: box.x + 6, y: box.y + 6,
                                        width: Math.min(box.width - 12, 360), height: 24 });
  const control = await page.evaluate(() => {
    const p = document.createElement('p');
    p.textContent = 'ordinary page text that should still select';
    p.style.cssText = 'position:fixed;left:8px;bottom:4px;z-index:99999;margin:0;font-size:13px';
    document.body.appendChild(p);          // outside the surface, on purpose
    const r = p.getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height };
  });
  const outside = await dragOver(page, control);
  ck('a drag across the game highlights nothing', inGame === '', JSON.stringify(inGame.slice(0, 40)));
  ck('but the rest of the page still selects normally', outside.length > 0,
     JSON.stringify(outside.slice(0, 40)));
  await page.evaluate(() => { document.body.lastElementChild.remove();
                              getSelection().removeAllRanges(); });

  // the escape hatches: text meant to be read, and anything typed into
  const hatch = await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    const wrap = document.createElement('div');
    wrap.innerHTML = '<span class="play-text">seed 4821</span><input value="x">';
    el.appendChild(wrap);
    const cs = (n) => getComputedStyle(n);
    const text = cs(wrap.firstElementChild);
    const field = cs(wrap.lastElementChild);
    const out = {
      text: text.userSelect || text.webkitUserSelect,
      field: field.userSelect || field.webkitUserSelect,
    };
    wrap.remove();
    return out;
  }, root);
  ck('.play-text still selects, for anything worth copying', hatch.text === 'text', hatch.text);
  ck('and a text field is still a text field',
     hatch.field === 'auto' || hatch.field === 'text', hatch.field);

  /* touch-action does not inherit, so what matters is the value on the element
     under the thumb — the scenery and the HUD, not just the cabinet. */
  const taps = await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    const kids = [...el.querySelectorAll('*')].filter((n) => !n.closest('.play-drag'));
    const bad = kids.filter((n) => {
      const t = getComputedStyle(n).touchAction;
      return t !== 'manipulation' && t !== 'none';
    });
    return { of: kids.length, bad: bad.length,
             first: bad[0] ? bad[0].tagName.toLowerCase() + '.' + (bad[0].className || '') : '' };
  }, root);
  ck('every part of the game refuses double-tap zoom, not just the cabinet',
     taps.bad === 0, taps.bad ? taps.bad + ' of ' + taps.of + ' still auto, e.g. ' + taps.first
                              : 'all ' + taps.of + ' of them');

  /* And the belt to that brace: a second tap in quick succession on the scenery
     has its default suppressed, while a control keeps its click — tapping the
     same button twice fast is a move, not a zoom. */
  const dbl = await page.evaluate((sel) => {
    const tap = (el) => {
      const r = el.getBoundingClientRect();
      const t = new Touch({ identifier: 1, target: el,
                            clientX: r.x + r.width / 2, clientY: r.y + r.height / 2 });
      const e = new TouchEvent('touchend', { bubbles: true, cancelable: true,
                                             changedTouches: [t], touches: [] });
      el.dispatchEvent(e);
      return e.defaultPrevented;
    };
    const surface = document.querySelector(sel);
    const scenery = [...surface.querySelectorAll('*')]
      .find((n) => !n.closest('button, a, [role="button"], [tabindex]') &&
                   n.getBoundingClientRect().width > 40);
    const control = surface.querySelector('button');
    const out = {};
    tap(scenery); out.scenery = tap(scenery);        // the second of two, quickly
    tap(control); out.control = tap(control);
    return out;
  }, root);
  ck('a fast double tap on the game does not zoom the page', dbl.scenery);
  ck('but a control keeps both its taps', dbl.control === false);

  // the surfaces the game reads gestures on itself
  const drags = await page.evaluate(() => [...document.querySelectorAll('.play-drag')]
    .map((el) => ({ what: el.id || el.className, touch: getComputedStyle(el).touchAction })));
  if (drags.length) {
    ck('the controls take the gesture off the browser',
       drags.every((d) => d.touch === 'none'),
       drags.map((d) => `${(d.what || '').split(' ')[0]} ${d.touch}`).join(', '));
  }

  /* And again mid-round, which is when it actually matters: a shift under way,
     the thumb dragging across the live game. */
  await page.click(beginSel);
  await page.waitForTimeout(500);
  const playing = await dragOver(page, { x: box.x + 6, y: box.y + box.height * 0.35,
                                         width: Math.min(box.width - 12, 360), height: 24 });
  const rapid = await page.evaluate(async (sel) => {
    // twenty fast taps on the surface, the way a game gets played
    const el = document.querySelector(sel);
    const r = el.getBoundingClientRect();
    const x = r.x + r.width / 2, y = r.y + r.height / 2;
    for (let i = 0; i < 20; i++) {
      for (const type of ['pointerdown', 'mousedown', 'mouseup', 'pointerup', 'click']) {
        el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true,
                                                clientX: x, clientY: y }));
      }
      await new Promise((r2) => setTimeout(r2, 8));
    }
    return getSelection().toString().trim();
  }, root);
  ck('mid-round, a drag across the game still highlights nothing',
     playing === '', JSON.stringify(playing.slice(0, 40)));
  ck('and neither does a burst of fast tapping', rapid === '', JSON.stringify(rapid.slice(0, 40)));

  // and none of it broke the ordinary furniture
  const ui = await page.evaluate(async () => {
    const btn = document.getElementById('soundBtn');
    if (!btn) return { ok: null };
    const was = btn.getAttribute('aria-pressed');
    btn.focus();
    const focused = document.activeElement === btn;
    btn.click();
    await new Promise((r) => setTimeout(r, 60));
    const now = btn.getAttribute('aria-pressed');
    btn.click();                                   // put it back
    return { ok: was !== now, focused };
  });
  ck('buttons still click and still take focus', ui.ok && ui.focused,
     ui.ok === null ? 'no sound button on this build' : '');
  ck('no errors', errors.length === 0, errors[0] || '');
  await page.close();
}

/* ── Everything fits the screen it is played on ─────────────────────────── */

for (const g of CARDS) {
  console.log(`\n── ${g.name}: fit ──`);
  for (const [state, setup] of Object.entries(g.states)) {
    const tight = [];
    for (const [w, h] of g.sizes) {
      const page = await browser.newPage({ viewport: { width: w, height: h } });
      await page.goto(g.page);
      await page.evaluate(setup);
      await page.waitForTimeout(140);
      const over = await page.evaluate((sel) => {
        const c = document.querySelector(sel);
        if (!c) return 9999;
        const ov = c.closest('.overlay');
        return Math.round(Math.max(ov.scrollHeight - ov.clientHeight,
                                   c.getBoundingClientRect().bottom - innerHeight));
      }, g.card);
      if (over > 0) tight.push(`${w}x${h} over by ${over}`);
      await page.close();
    }
    ck(`${state} fits every screen it can be read on`, tight.length === 0,
       tight.length ? tight.join(', ') : g.sizes.length + ' sizes, down to ' +
         g.sizes[g.sizes.length - 1].join('x'));
  }
}

/* ── The sensor housing ─────────────────────────────────────────────────── */

console.log('\n── the notch ──');
{
  const POSES = [
    ['Quiet Stacks in portrait', page_('quiet-stacks/index.html'), [393, 660], [59, 0, 34, 0],
     '#beginBtn', ['.hud', '.bookcase', '.desk', '.floor'], '#overlayCard'],
    ['Quiet Stacks on its side', page_('quiet-stacks/landscape/index.html'), [852, 330], [0, 59, 21, 59],
     '#beginBtn', ['.hud', '.bookcase', '.desk', '.cart', '.queue-wrap'], '#overlayCard'],
    ['Order Up', page_('order-up/index.html'), [852, 330], [0, 59, 21, 59],
     '#playBtn', ['.rail', '.stage'], '#card'],
    ['Mail Run', page_('mail-run/index.html'), [852, 330], [0, 59, 21, 59],
     '#goBtn', ['.board', '.road', '.pad-drive', '.stick-zone'], '#card'],
  ];
  for (const [name, url, [w, h], ins, begin, parts, card] of POSES) {
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    await page.goto(url);
    await page.addStyleTag({ content: ISLAND(...ins) });
    await page.waitForTimeout(120);

    // the card first, which is fixed to the viewport and misses the surface's own padding
    const cardClear = await page.evaluate(([sel, ins]) => {
      const r = document.querySelector(sel).getBoundingClientRect();
      return r.top >= ins[0] - 0.5 && r.right <= innerWidth - ins[1] + 0.5 &&
             r.bottom <= innerHeight - ins[2] + 0.5 && r.left >= ins[3] - 0.5;
    }, [card, ins]);

    await page.evaluate(() => { if (typeof CONFIG !== 'undefined' && 'splashMs' in CONFIG) CONFIG.splashMs = 0; });
    await page.click(begin);
    await page.waitForTimeout(420);
    const under = await page.evaluate(([sel, ins]) => {
      const bad = [];
      sel.forEach((s) => {
        const e = document.querySelector(s);
        if (!e) return;
        const r = e.getBoundingClientRect();
        if (r.top < ins[0] - 0.5 || r.right > innerWidth - ins[1] + 0.5 ||
            r.bottom > innerHeight - ins[2] + 0.5 || r.left < ins[3] - 0.5) bad.push(s);
      });
      return bad;
    }, [parts, ins]);
    ck(`${name}: the game clears the island and the home bar`,
       under.length === 0, under.length ? 'under it: ' + under.join(', ') : ins.join('/') + ' insets');
    ck(`${name}: and so does the card`, cardClear);
    await page.close();
  }
}

await browser.close();
console.log(`\n${checks} checks`);
console.log(fails.length ? ('FAILURES: ' + fails.join(', ')) : 'All checks passed.');
process.exit(fails.length ? 1 : 0);
