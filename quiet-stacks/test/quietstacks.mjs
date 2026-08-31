/* Quiet Stacks — regression suite.
   Drives the real page in a headless browser. Run:  node quiet-stacks/test/quietstacks.mjs
   Covers the two things that kept breaking by hand: type that quietly stops
   scaling, and layouts that clip on a short screen. */

import { chromium } from 'playwright-core';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

/* Paths come from the environment so the suite runs wherever the repo sits:
     CHROME=/path/to/chrome node quiet-stacks/test/quietstacks.mjs           */
const CHROME = process.env.CHROME || undefined;   // undefined = Playwright's own
const HERE   = pathToFileURL(resolve(fileURLToPath(import.meta.url), '../..')).href;
const BUILDS = {
  portrait:  HERE + '/index.html',
  landscape: HERE + '/landscape/index.html',
};

/* Sizes that matter: the smallest phone we support, two real handsets in each
   orientation, and a desktop window. */
const SIZES = {
  portrait:  [[360, 640], [390, 844], [428, 926]],
  landscape: [[640, 360], [844, 390], [926, 428], [1280, 720]],
};

/* Floors, in px. Anything below these was unreadable at arm's length on a
   phone — the whole point of the type scale is that none of them regress. */
const FLOOR = { spine: 10.5, shelf: 11, title: 16, desc: 13, ask: 14, goal: 10 };

const fails = [];
let checks = 0;
const ck = (name, ok, extra = '') => {
  checks++;
  console.log((ok ? '  ok  ' : '  FAIL') + '  ' + name + (extra ? '  ' + extra : ''));
  if (!ok) fails.push(name);
};

const browser = await chromium.launch(CHROME ? { executablePath: CHROME } : {});

/* ── helpers ──────────────────────────────────────────────────────────── */

async function open(build, w, h) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });
  await page.goto(BUILDS[build]);
  page.errors = errors;
  return page;
}

/* Start a shift and wait out the condition splash, so tests never race it. */
async function play(page) {
  await page.evaluate(() => { CONFIG.splashMs = 0; });
  await page.click('#beginBtn');
  // `let S` at top level is a global binding but not a window property.
  await page.waitForFunction(() => typeof S !== 'undefined' && S && S.phase === 'playing',
                             null, { timeout: 4000 });
}

/* Shelve the longest title on the menu, not whichever book the shuffle happens
   to deal. A random title makes the truncation check pass or fail by luck; the
   worst case is the only one worth pinning. */
async function shelveWorstCase(page) {
  const done = await page.evaluate(() => {
    const ids = S.shelves.map((s) => s.id);
    const worst = BOOKS.filter((b) => ids.includes(b.genre))
      .sort((a, b) => b.title.length - a.title.length)[0];
    if (!worst) return null;
    S.hand = { kind: 'book', book: worst };
    renderSlip();
    chooseShelf(worst.genre);
    return worst.title;
  });
  if (done) await page.waitForTimeout(700);
  return done;
}

const px = (s) => Math.round(parseFloat(s) * 10) / 10;

/* ── rules ────────────────────────────────────────────────────────────── */

console.log('\n── the shift ──');
{
  const p = await open('landscape', 844, 390);
  ck('the title card offers a shift', await p.isVisible('#beginBtn'));
  await play(p);
  let r = await p.evaluate(() => ({ phase: S.phase, cart: S.cart.length,
    shelves: S.shelves.length, books: S.targets.books, patrons: S.targets.patrons }));
  ck('a shift starts with returns waiting', r.phase === 'playing' && r.cart > 0, `${r.cart} on the cart`);
  ck('it opens on three sections', r.shelves === 3, r.shelves + ' shelves');
  ck('the objectives are books and patrons', r.books > 0 && r.patrons > 0, `${r.books} books, ${r.patrons} patrons`);

  console.log('\n── shelving ──');
  r = await p.evaluate(async () => {
    takeTopBook();
    const held = S.hand.book;
    const wrong = S.shelves.map((s) => s.id).find((id) => id !== held.genre);
    const before = { streak: S.streak, shelved: S.shelved };
    chooseShelf(wrong);
    await new Promise((res) => setTimeout(res, 200));
    const body = document.body.textContent;
    return { before, stillHeld: S.hand && S.hand.book === held,
             shelved: S.shelved, streak: S.streak, attempts: S.attempts,
             leaks: S.shelves.some((s) => s.id === held.genre &&
               document.querySelector('.shelf[data-genre="' + s.id + '"]').classList.contains('good')),
             genre: held.genre };
  });
  ck('a wrong shelf keeps the book in hand', r.stillHeld);
  ck('it costs the attempt and the streak', r.attempts === 1 && r.streak === 0 && r.shelved === 0);
  ck('the right shelf is never given away', !r.leaks);

  r = await p.evaluate(async () => {
    chooseShelf(S.hand.book.genre);
    await new Promise((res) => setTimeout(res, 800));
    return { hand: S.hand, shelved: S.shelved, streak: S.streak,
             spines: document.querySelectorAll('.spine-label').length };
  });
  ck('the right shelf takes it', !r.hand && r.shelved === 1 && r.streak === 1);
  ck('the book appears on the shelf', r.spines >= 1, r.spines + ' titled spine(s)');

  console.log('\n── patrons ──');
  r = await p.evaluate(async () => {
    while (!S.patrons.length) { addPatron(); }
    const pat = S.patrons[0];
    S.hand = { kind: 'patron', id: pat.id };
    renderSlip();
    const askShown = (document.querySelector('.slip') || {}).textContent || '';
    const wrong = S.shelves.map((s) => s.id).find((id) => id !== pat.request.answer);
    chooseShelf(wrong);
    await new Promise((res) => setTimeout(res, 150));
    const stillThere = S.patrons.some((x) => x.id === pat.id);
    chooseShelf(pat.request.answer);
    await new Promise((res) => setTimeout(res, 150));
    return { askShown: askShown.length > 10, stillThere, helped: S.helped,
             gone: !S.patrons.some((x) => x.id === pat.id) };
  });
  ck('the ask stays on the desk while you decide', r.askShown);
  ck('a wrong answer keeps them at the desk', r.stillThere);
  ck('the right answer helps them', r.helped === 1 && r.gone);

  ck('no errors during play', p.errors.length === 0, p.errors[0] || '');
  await p.close();
}

console.log('\n── memory ──');
{
  const p = await open('landscape', 844, 390);
  await p.evaluate(() => localStorage.clear());
  await p.reload();
  await play(p);
  await p.evaluate(() => { S.score = 4321; S.shelved = S.targets.books; S.helped = S.targets.patrons; endShift('done'); });
  await p.waitForTimeout(400);
  const shown = await p.evaluate(() => document.querySelector('.card').textContent);
  ck('finishing the objectives ends the shift', /4321|Shift|shelved/i.test(shown));
  await p.reload();
  const remembered = await p.evaluate(() => document.querySelector('.card').textContent);
  ck('a best is remembered across reloads', /4321/.test(remembered), remembered.match(/Best[^]{0,24}/)?.[0] || '');
  await p.close();
}

/* ── legibility and fit, every build at every size ────────────────────── */

for (const build of ['landscape', 'portrait']) {
  console.log(`\n── ${build}: reading and fit ──`);
  for (const [w, h] of SIZES[build]) {
    const p = await open(build, w, h);
    await play(p);
    const worst = await shelveWorstCase(p);
    // put a book back in hand so the desk shows a real title and clue
    await p.evaluate(() => { if (!S.hand) takeTopBook(); });
    await p.waitForTimeout(250);

    const m = await p.evaluate(() => {
      const size = (sel) => { const e = document.querySelector(sel); return e ? parseFloat(getComputedStyle(e).fontSize) : null; };
      const inView = (e) => { const r = e.getBoundingClientRect();
        return r.top >= -1 && r.bottom <= innerHeight + 1 && r.left >= -1 && r.right <= innerWidth + 1; };
      const shelves = [...document.querySelectorAll('.shelf')];
      const clipped = [...document.querySelectorAll('.spine-label')]
        .filter((e) => e.scrollHeight > e.clientHeight + 1 || e.scrollWidth > e.clientWidth + 1);
      const slip = document.querySelector('.slip');
      // The library's stamp is absolutely positioned; make sure it never lands
      // on the kicker or on the button in the card's foot.
      const stampHits = (() => {
        if (!slip) return null;
        const cs = getComputedStyle(slip, '::after');
        if (!cs.content || cs.content === 'none') return null;
        const box = slip.getBoundingClientRect();
        const top = box.top + parseFloat(cs.top || 0);
        const bottom = top + parseFloat(cs.height || 0) + 6;
        const left = box.right - parseFloat(cs.right || 0) - parseFloat(cs.width || 0) - 6;
        const hit = (sel) => { const e = document.querySelector(sel); if (!e) return false;
          const r = e.getBoundingClientRect();
          return r.bottom > top && r.top < bottom && r.right > left; };
        const textHit = (sel) => { const e = document.querySelector(sel); if (!e || !e.firstChild) return false;
          const rg = document.createRange(); rg.selectNodeContents(e);
          const r = rg.getBoundingClientRect();
          return r.bottom > top && r.top < bottom && r.right > left; };
        return hit('.slip-back') || textHit('.slip-kicker') || textHit('.slip-title') ||
               textHit('.slip-nudge');
      })();
      return { stampHits,
        spine: size('.spine-label'), shelf: size('.shelf-name'), title: size('.slip-title'),
        desc: size('.slip-desc'), goal: size('.goal'),
        scrollY: document.documentElement.scrollHeight - innerHeight,
        scrollX: document.documentElement.scrollWidth - innerWidth,
        shelves: shelves.length, shelvesIn: shelves.every(inView),
        slipIn: slip && inView(slip),
        cartIn: inView(document.querySelector('.cart')),
        queueIn: inView(document.querySelector('.queue-wrap')),
        clipped: clipped.length,
        slipOverflows: slip ? slip.scrollHeight > slip.clientHeight + 1 : false,
      };
    });

    const tag = `${w}x${h}`;
    ck(`${tag}: nothing scrolls off screen`, m.scrollY <= 0 && m.scrollX <= 0, `y${m.scrollY} x${m.scrollX}`);
    ck(`${tag}: shelves, desk, cart and queue all fit`,
       m.shelvesIn && m.slipIn && m.cartIn && m.queueIn);
    ck(`${tag}: the clue is never clipped`, !m.slipOverflows);
    ck(`${tag}: the stamp sits clear of the text`, m.stampHits === false || m.stampHits === null,
       m.stampHits ? 'OVERLAPS' : 'clear');
    ck(`${tag}: the longest title is never cut off`, m.clipped === 0,
       m.clipped ? m.clipped + ' clipped: ' + worst : '"' + worst + '"');
    ck(`${tag}: type clears its floor`,
       m.spine >= FLOOR.spine && m.shelf >= FLOOR.shelf && m.title >= FLOOR.title &&
       m.desc >= FLOOR.desc && m.goal >= FLOOR.goal,
       `spine ${px(m.spine)} shelf ${px(m.shelf)} title ${px(m.title)} clue ${px(m.desc)}`);
    ck(`${tag}: no errors`, p.errors.length === 0, p.errors[0] || '');
    await p.close();
  }
}

/* Type must actually grow with the screen — a fixed size passes a floor test
   at every width, which is exactly the bug this suite exists to catch. */
console.log('\n── the scale actually scales ──');
{
  const read = async (build, w, h) => {
    const p = await open(build, w, h);
    await play(p);
    await shelveWorstCase(p);
    await p.evaluate(() => { if (!S.hand) takeTopBook(); });
    await p.waitForTimeout(200);
    const m = await p.evaluate(() => ({
      spine: parseFloat(getComputedStyle(document.querySelector('.spine-label')).fontSize),
      title: parseFloat(getComputedStyle(document.querySelector('.slip-title')).fontSize),
      desc:  parseFloat(getComputedStyle(document.querySelector('.slip-desc')).fontSize),
    }));
    await p.close();
    return m;
  };
  const small = await read('landscape', 640, 360);
  const big   = await read('landscape', 926, 428);
  ck('a bigger screen gets bigger type',
     big.spine > small.spine && big.title > small.title && big.desc > small.desc,
     `spine ${px(small.spine)}→${px(big.spine)}  title ${px(small.title)}→${px(big.title)}  clue ${px(small.desc)}→${px(big.desc)}`);
}

await browser.close();
console.log(`\n${checks} checks`);
console.log(fails.length ? ('FAILURES: ' + fails.join(', ')) : 'All checks passed.');
process.exit(fails.length ? 1 : 0);
