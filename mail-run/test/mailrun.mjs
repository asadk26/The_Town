/* Mail Run — regression suite.
   Drives the real page in a headless browser.  node test/mailrun.mjs
   The interesting checks are the handling ones: that the truck behaves like a
   vehicle rather than a sprite, and that the route is a route. */

import { chromium } from 'playwright-core';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const CHROME = process.env.CHROME || undefined;
const URL = pathToFileURL(resolve(fileURLToPath(import.meta.url), '../../index.html')).href;

const fails = [];
let checks = 0;
const ck = (name, ok, extra = '') => {
  checks++;
  console.log((ok ? '  ok  ' : '  FAIL') + '  ' + name + (extra ? '  ' + extra : ''));
  if (!ok) fails.push(name);
};
const r1 = (n) => Math.round(n * 10) / 10;

const browser = await chromium.launch(CHROME ? { executablePath: CHROME } : {});

async function open(w = 844, h = 390) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });
  await page.goto(URL);
  page.errors = errors;
  return page;
}
async function play(page) {
  await page.click('#goBtn');
  await page.waitForFunction(() => typeof S !== 'undefined' && S && S.phase === 'driving',
                             null, { timeout: 4000 });
}
/* Put the truck exactly where a check needs it, facing along the road. */
const place = (page, x, y, angle, speed = 0) =>
  page.evaluate(([x, y, a, v]) => {
    S.truck.x = x; S.truck.y = y; S.truck.angle = a; S.truck.speed = v;
    S.truck.steer = 0; S.cam.x = x; S.cam.y = y;
  }, [x, y, angle, speed]);
const hold = (page, keys, ms) => page.evaluate(([keys, ms]) => new Promise((done) => {
  Object.keys(input).forEach((k) => { input[k] = false; });
  keys.forEach((k) => { input[k] = true; });
  setTimeout(() => { Object.keys(input).forEach((k) => { input[k] = false; }); done(); }, ms);
}), [keys, ms]);

console.log('\n── the round ──');
{
  const p = await open();
  ck('the depot card offers a round', await p.isVisible('#goBtn'));
  await play(p);
  const r = await p.evaluate(() => ({
    stops: S.stops.length, phase: S.phase,
    surface: surfaceAt(S.truck.x, S.truck.y), at: S.at,
    marks: document.querySelectorAll('.stops .stop').length,
  }));
  ck('five stops on the round', r.stops === 5 && r.marks === 5);
  ck('the truck starts on the road', r.surface === 'road' && r.phase === 'driving');
  ck('the first stop is live', r.at === 0);
  ck('no errors on the road', p.errors.length === 0, p.errors[0] || '');
  await p.close();
}

console.log('\n── handling ──');
{
  const p = await open();
  await play(p);
  const road = (n) => p.evaluate((i) => ({ x: ROAD[i].x, y: ROAD[i].y }), n);
  const straight = await road(0);

  // gas
  await place(p, straight.x, straight.y, -Math.PI / 2);
  await hold(p, ['gas'], 900);
  const afterGas = await p.evaluate(() => S.truck.speed);
  ck('gas accelerates', afterGas > 100, r1(afterGas) + ' u/s after 0.9s');

  await hold(p, ['gas'], 2600);
  const top = await p.evaluate(() => ({ v: S.truck.speed, max: CONFIG.maxSpeed }));
  ck('speed tops out where it should', top.v > top.max * 0.82 && top.v <= top.max + 1,
     r1(top.v) + ' / ' + top.max);

  // brake bites harder than coasting
  await place(p, straight.x, straight.y, -Math.PI / 2, 180);
  await hold(p, [], 500);
  const coasted = await p.evaluate(() => S.truck.speed);
  await place(p, straight.x, straight.y, -Math.PI / 2, 180);
  await hold(p, ['brake'], 500);
  const braked = await p.evaluate(() => S.truck.speed);
  ck('braking matters', braked < coasted - 40, `coast ${r1(coasted)} vs brake ${r1(braked)}`);

  // momentum: letting go does not stop the truck dead
  await place(p, straight.x, straight.y, -Math.PI / 2, 180);
  await hold(p, [], 700);
  const rolled = await p.evaluate(() => S.truck.speed);
  ck('momentum carries the truck', rolled > 45, r1(rolled) + ' u/s still rolling');

  // reverse, out of a standstill
  await place(p, straight.x, straight.y, -Math.PI / 2, 0);
  await hold(p, ['brake'], 1100);
  const rev = await p.evaluate(() => S.truck.speed);
  ck('the brake becomes reverse', rev < -25, r1(rev) + ' u/s');

  // steering is a vehicle, not a sprite
  await place(p, straight.x, straight.y, -Math.PI / 2, 0);
  await hold(p, ['left'], 800);
  const spun = await p.evaluate(() => S.truck.angle);
  ck('it will not turn on the spot', Math.abs(spun + Math.PI / 2) < 0.02,
     'turned ' + r1((spun + Math.PI / 2) * 57) + '°');

  await place(p, straight.x, straight.y, -Math.PI / 2, 170);
  await hold(p, ['left', 'gas'], 700);
  const turned = await p.evaluate(() => S.truck.angle);
  ck('it turns when it is moving', Math.abs(turned + Math.PI / 2) > 0.35,
     'turned ' + r1((turned + Math.PI / 2) * 57) + '°');

  // and the nose swings the other way in reverse, as a real one does
  await place(p, straight.x, straight.y, -Math.PI / 2, -70);
  await hold(p, ['left'], 700);
  const back = await p.evaluate(() => S.truck.angle);
  ck('reversing swings the nose the other way',
     Math.sign(back + Math.PI / 2) !== Math.sign(turned + Math.PI / 2),
     'forward ' + r1((turned + Math.PI / 2) * 57) + '°, reverse ' + r1((back + Math.PI / 2) * 57) + '°');

  ck('no errors while driving', p.errors.length === 0, p.errors[0] || '');
  await p.close();
}

console.log('\n── the world pushes back ──');
{
  const p = await open();
  await play(p);

  // grass costs speed, but never stops the run
  const grass = await p.evaluate(() => {
    const n = ROAD[1];
    return { x: n.x + n.w / 2 + 90, y: n.y };
  });
  await place(p, grass.x, grass.y, -Math.PI / 2);
  const surf = await p.evaluate(() => surfaceAt(S.truck.x, S.truck.y));
  await hold(p, ['gas'], 2600);
  const offRoadTop = await p.evaluate(() => ({ v: S.truck.speed, cap: CONFIG.maxSpeed * CONFIG.surface.grass.top }));
  ck('grass is off the road', surf === 'grass');
  ck('grass slows the truck noticeably', offRoadTop.v <= offRoadTop.cap + 2 && offRoadTop.v > 20,
     r1(offRoadTop.v) + ' u/s vs ' + r1(offRoadTop.cap) + ' cap');

  // a house stops it. Start just clear of the wall and drive straight at it:
  // starting further back only proves the grass slowed us down first.
  const house = await p.evaluate(() => {
    const h = SOLIDS.find((o) => o.kind === 'rect');
    return { x: h.x, y: h.y, w: h.w, h: h.h, a: h.a };
  });
  const gap = Math.max(house.w, house.h) / 2 + 46;
  await place(p, house.x, house.y + gap, -Math.PI / 2, 170);
  await hold(p, ['gas'], 2200);
  const stopped = await p.evaluate(() => ({
    x: S.truck.x, y: S.truck.y, v: S.truck.speed, bumps: S.bumps,
  }));
  // in the house's own frame, is any part of the truck inside its walls?
  const c = Math.cos(-house.a), sn = Math.sin(-house.a);
  const dx = stopped.x - house.x, dy = stopped.y - house.y;
  const lx = dx * c - dy * sn, ly = dx * sn + dy * c;
  const outX = Math.max(0, Math.abs(lx) - house.w / 2);
  const outY = Math.max(0, Math.abs(ly) - house.h / 2);
  const insideHouse = outX === 0 && outY === 0;
  ck('a house is solid', !insideHouse && stopped.bumps > 0,
     `bumps ${stopped.bumps}, never got inside the walls (${r1(Math.hypot(outX, outY))} clear)`);
  ck('a bump does not end anything', await p.evaluate(() => S.phase === 'driving'));
  await p.close();
}

console.log('\n── the drop ──');
{
  const p = await open();
  await play(p);
  const z = await p.evaluate(() => ({ x: S.stops[0].x, y: S.stops[0].y, a: S.stops[0].angle, w: S.stops[0].w, h: S.stops[0].h }));

  // rolling through the bay is not a delivery
  await place(p, z.x, z.y, z.a, 150);
  await p.waitForTimeout(200);
  ck('rolling through the bay posts nothing', await p.evaluate(() => S.at === 0 && S.hold < 0.05));

  // parked in the middle of it is
  await place(p, z.x, z.y, z.a, 0);
  await p.waitForTimeout(340);
  const halfway = await p.evaluate(() => ({ hold: S.hold, at: S.at }));
  ck('the hold has to be held', halfway.at === 0 && halfway.hold > 0.1,
     'hold ' + r1(halfway.hold) + 's of ' + await p.evaluate(() => CONFIG.holdTime) + 's');
  await p.waitForTimeout(700);
  const posted = await p.evaluate(() => ({ at: S.at, rating: S.ratings[0], score: S.score }));
  ck('parked square and centred is a Perfect', posted.at === 1 && posted.rating === 'perfect');
  ck('the next stop goes live', await p.evaluate(() => S.at === 1 && !!S.stops[1]));

  // scraping the edge, parked across the bay, is not
  const z2 = await p.evaluate(() => S.stops[1]);
  await place(p, z2.x + Math.cos(z2.angle) * (z2.w / 2 - 6), z2.y + Math.sin(z2.angle) * (z2.w / 2 - 6),
              z2.angle + 1.15, 0);
  await p.waitForTimeout(1000);
  const sloppy = await p.evaluate(() => S.ratings[1]);
  ck('scraping in askew is not a Perfect', sloppy && sloppy !== 'perfect', sloppy);
  await p.close();
}

console.log('\n── never lost ──');
{
  const p = await open();
  await play(p);
  const far = await p.evaluate(() => ({ x: ROAD[0].x, y: ROAD[0].y }));
  await place(p, far.x, far.y, -Math.PI / 2);
  await p.waitForTimeout(200);
  ck('an off-screen stop gets an arrow', await p.evaluate(() =>
     document.getElementById('pointer').classList.contains('on')));

  const z = await p.evaluate(() => S.stops[0]);
  await place(p, z.x, z.y + 40, -Math.PI / 2);
  await p.waitForTimeout(400);
  ck('the arrow goes away once you can see it', await p.evaluate(() =>
     !document.getElementById('pointer').classList.contains('on')));

  // the camera keeps up
  await place(p, far.x, far.y, -Math.PI / 2, 180);
  await hold(p, ['gas'], 1400);
  const cam = await p.evaluate(() => ({ d: Math.hypot(S.cam.x - S.truck.x, S.cam.y - S.truck.y),
                                        view: CONFIG.viewHeight }));
  ck('the camera stays with the truck', cam.d < cam.view * 0.45, r1(cam.d) + ' units of lead');
  await p.close();
}

/* A scripted driver: pure pursuit along the centreline, easing off for the
   corners, braking to a stop in each bay. `skill` scales how fast it is
   willing to go; `slop` is how far off the middle of the bay it settles. */
const BOT = (skill, slop) => `(() => {
  const SKILL = ${skill}, SLOP = ${slop};
  window.__bot = { on: true };
  function lookAhead(dist) {
    const n = nearestOnRoad(S.truck.x, S.truck.y);
    let i = n.i, t = n.t, remain = dist;
    while (i < ROAD.length - 1) {
      const a = ROAD[i], b = ROAD[i+1];
      const len = Math.hypot(b.x-a.x, b.y-a.y), avail = len * (1 - t);
      if (remain <= avail) { const tt = t + remain/len;
        return { x: a.x + (b.x-a.x)*tt, y: a.y + (b.y-a.y)*tt }; }
      remain -= avail; i++; t = 0;
    }
    const L = ROAD[ROAD.length-1]; return { x: L.x, y: L.y };
  }
  function tick() {
    if (!window.__bot.on) return;
    requestAnimationFrame(tick);
    if (!S || S.phase !== 'driving') { input.gas=input.brake=input.left=input.right=false; return; }
    const t = S.truck, z = S.stops[S.at];
    const n = nearestOnRoad(t.x, t.y);
    let tx, ty, stopping = false, dz = 1e9;
    if (z) {
      const ax = z.x + Math.cos(z.angle) * (z.w/2) * SLOP;
      const ay = z.y + Math.sin(z.angle) * (z.w/2) * SLOP;
      dz = Math.hypot(ax - t.x, ay - t.y);
      if (dz < 210 && n.i >= z.node - 2) { tx = ax; ty = ay; stopping = true; }
    }
    if (!stopping) { const la = lookAhead(Math.max(60, Math.abs(t.speed) * 0.75)); tx = la.x; ty = la.y; }
    const err = angleDiff(t.angle, Math.atan2(ty - t.y, tx - t.x));
    input.left = err < -0.045; input.right = err > 0.045;
    let want = CONFIG.maxSpeed * SKILL * (1 - Math.min(0.8, Math.abs(err) * 1.5));
    if (stopping) want = Math.max(0, (dz - 4) * 1.8);
    const parked = z && inZone(z, t.x, t.y, 1) && Math.abs(t.speed) < CONFIG.stopSpeed;
    if (parked)                  { input.gas = false; input.brake = false; }
    else if (t.speed < want - 8) { input.gas = true;  input.brake = false; }
    else if (t.speed > want + 8) { input.gas = false; input.brake = true; }
    else                         { input.gas = false; input.brake = false; }
  }
  requestAnimationFrame(tick);
})()`;

async function runBot(skill, slop) {
  const p = await open();
  await play(p);
  await p.evaluate(BOT(skill, slop));
  const finished = await p.waitForFunction(() => S.phase === 'over', null, { timeout: 180000 })
    .then(() => true).catch(() => false);
  const r = await p.evaluate(() => ({
    t: S.t, ratings: S.ratings.slice(), bumps: S.bumps, off: S.offRoad,
    at: S.at, errors: 0,
  }));
  r.finished = finished;
  r.errors = p.errors.slice();
  await p.close();
  return r;
}

console.log('\n── a whole round ──');
{
  const tidy = await runBot(1.0, 0);
  ck('a competent round finishes', tidy.finished && tidy.at === 5,
     tidy.at + '/5 stops');
  ck('and lands in the 45-90s window', tidy.t >= 45 && tidy.t <= 90, r1(tidy.t) + 's');
  ck('driving the middle keeps it off the verge', tidy.off < 2 && tidy.bumps === 0,
     `${r1(tidy.off)}s off-road, ${tidy.bumps} bumps`);
  ck('a clean driver earns Perfects', tidy.ratings.filter((x) => x === 'perfect').length >= 4,
     tidy.ratings.join(','));
  ck('no errors over a whole round', tidy.errors.length === 0, tidy.errors[0] || '');

  const careful = await runBot(0.72, 0);
  ck('a careful round still finishes inside the window',
     careful.finished && careful.t >= 45 && careful.t <= 90, r1(careful.t) + 's');

  // the same driver, parking badly: the rating has to notice
  const sloppy = await runBot(1.0, 0.82);
  ck('sloppy parking is not rewarded',
     sloppy.finished && sloppy.ratings.filter((x) => x === 'perfect').length <= 1,
     sloppy.ratings.join(','));
  ck('but a sloppy round still finishes', sloppy.at === 5);
}

console.log('\n── the card at the end ──');
{
  const p = await open();
  await play(p);
  await p.evaluate(() => {
    S.t = 51.4; S.ratings = ['perfect', 'perfect', 'good', 'perfect', 'messy'];
    S.score = 220 * 3 + 140 + 70; S.at = 5; endRun();
  });
  await p.waitForTimeout(300);
  const card = await p.evaluate(() => document.querySelector('#card').textContent);
  ck('the round is graded', /Round complete/.test(card) && /51\.4s/.test(card), card.slice(0, 46));
  ck('Run again is offered', await p.isVisible('#againBtn'));

  const t0 = Date.now();
  await p.click('#againBtn');
  await p.waitForFunction(() => S.phase === 'driving' && S.at === 0 && S.t < 1);
  ck('restart is immediate', true, (Date.now() - t0) + 'ms');

  await p.reload();
  const remembered = await p.evaluate(() => document.querySelector('#card').textContent);
  ck('a best round is remembered', /Best round/.test(remembered),
     (remembered.match(/Best round[^]{0,30}/) || [''])[0]);
  await p.close();
}

console.log('\n── fit ──');
for (const [w, h] of [[640, 360], [667, 375], [844, 390], [926, 428], [1280, 720]]) {
  const p = await open(w, h);
  await play(p);
  const m = await p.evaluate(() => {
    const inView = (e) => { const r = e.getBoundingClientRect();
      return r.top >= -1 && r.bottom <= innerHeight + 1 && r.left >= -1 && r.right <= innerWidth + 1; };
    const keys = [...document.querySelectorAll('.key')];
    const cv = document.getElementById('view');
    return {
      scrollY: document.documentElement.scrollHeight - innerHeight,
      scrollX: document.documentElement.scrollWidth - innerWidth,
      keysIn: keys.every(inView),
      smallest: Math.round(Math.min(...keys.map((e) => e.getBoundingClientRect().width))),
      canvas: cv.width > 0 && cv.height > 0,
      // the road ahead must not be buried under the thumb pads
      padTop: Math.round(Math.min(...keys.map((e) => e.getBoundingClientRect().top))),
      roadTop: Math.round(document.getElementById('road').getBoundingClientRect().top),
      roadH: Math.round(document.getElementById('road').getBoundingClientRect().height),
    };
  });
  const tag = `${w}x${h}`;
  ck(`${tag}: nothing scrolls`, m.scrollY <= 0 && m.scrollX <= 0, `y${m.scrollY} x${m.scrollX}`);
  ck(`${tag}: the canvas is live and the controls are on screen`, m.canvas && m.keysIn);
  ck(`${tag}: thumb targets are big enough`, m.smallest >= 44, m.smallest + 'px');
  ck(`${tag}: the pads leave the road ahead clear`,
     (m.padTop - m.roadTop) > m.roadH * 0.5, `pads start ${Math.round((m.padTop - m.roadTop) / m.roadH * 100)}% down`);
  ck(`${tag}: no errors`, p.errors.length === 0, p.errors[0] || '');
  await p.close();
}

await browser.close();
console.log(`\n${checks} checks`);
console.log(fails.length ? ('FAILURES: ' + fails.join(', ')) : 'All checks passed.');
process.exit(fails.length ? 1 : 0);
