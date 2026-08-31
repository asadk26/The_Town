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

await browser.close();
console.log(`\n${checks} checks`);
console.log(fails.length ? ('FAILURES: ' + fails.join(', ')) : 'All checks passed.');
process.exit(fails.length ? 1 : 0);
