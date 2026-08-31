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

let ROUTE_COUNT = 5;
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
/* Hold a set of controls for a while. `steer` is the analog axis the stick
   and the keys both write to, so a test drives exactly what a player does. */
const hold = (page, keys, ms, steer = 0) =>
  page.evaluate(([keys, ms, steer]) => new Promise((done) => {
    input.gas = input.brake = false;
    keys.forEach((k) => { input[k] = true; });
    input.steer = steer;
    setTimeout(() => {
      input.gas = input.brake = false; input.steer = 0;
      done();
    }, ms);
  }), [keys, ms, steer]);

/* Open every route, for the tests that need to reach past the first one. */
const unlockAll = (page) => page.evaluate(() => {
  best.unlocked = ROUTES.length; saveBest();
});

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
  const straight = await p.evaluate(() => ({ x: ROAD[0].x, y: ROAD[0].y }));

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
  await hold(p, [], 800, -1);
  const spun = await p.evaluate(() => S.truck.angle);
  ck('it will not turn on the spot', Math.abs(spun + Math.PI / 2) < 0.02,
     'turned ' + r1((spun + Math.PI / 2) * 57) + '°');

  await place(p, straight.x, straight.y, -Math.PI / 2, 170);
  await hold(p, ['gas'], 700, -1);
  const turned = await p.evaluate(() => S.truck.angle);
  ck('it turns when it is moving', Math.abs(turned + Math.PI / 2) > 0.35,
     'turned ' + r1((turned + Math.PI / 2) * 57) + '°');

  // and the nose swings the other way in reverse, as a real one does
  await place(p, straight.x, straight.y, -Math.PI / 2, -70);
  await hold(p, [], 700, -1);
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
    // walk out from the kerb until the ground is grass and nothing is standing
    // on it — the town is dealt fresh each run, so a fixed offset is a lottery
    for (let along = 200; along < ROAD_M.total * 0.6; along += 120) {
      const at = pointAt(along);
      for (const side of [-1, 1]) {
        const nx = Math.cos(at.angle + Math.PI / 2) * side;
        const ny = Math.sin(at.angle + Math.PI / 2) * side;
        const x = at.x + nx * (at.w / 2 + 110), y = at.y + ny * (at.w / 2 + 110);
        if (surfaceAt(x, y) !== 'grass') continue;
        if (SOLIDS.some((o) => Math.hypot(o.x - x, o.y - y) < 150)) continue;
        return { x: x, y: y, a: at.angle };
      }
    }
    return null;
  });
  ck('there is open grass to test on', !!grass);
  await place(p, grass.x, grass.y, grass.a);
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
    if (!S || S.phase !== 'driving') { input.gas=input.brake=false; input.steer=0; return; }
    const t = S.truck, z = S.stops[S.at];
    const n = nearestOnRoad(t.x, t.y);
    const here = ROAD_M.cum[n.i];
    const la = lookAhead(Math.max(60, Math.abs(t.speed) * 0.75));
    let tx = la.x, ty = la.y, stopping = false, dz = 1e9;
    if (z) {
      const ax = z.x + Math.cos(z.angle) * (z.w/2) * SLOP;
      const ay = z.y + Math.sin(z.angle) * (z.w/2) * SLOP;
      dz = Math.hypot(ax - t.x, ay - t.y);
      // arc distance, not node index: nodes are 26 units apart
      if (ROAD_M.cum[z.node] - here > -90 && dz < 430) {
        const k = Math.max(0, Math.min(1, 1 - (dz - 70) / 340));
        tx = la.x * (1 - k) + ax * k;
        ty = la.y * (1 - k) + ay * k;
        stopping = dz < 230;
      }
    }
    const err = angleDiff(t.angle, Math.atan2(ty - t.y, tx - t.x));
    input.steer = Math.max(-1, Math.min(1, err * 3.2));    // analog, like the stick
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

console.log('\n── the steering stick ──');
{
  const p = await open();
  await play(p);
  const box = await p.locator('#stick').boundingBox();
  const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
  const travel = await p.evaluate(() => stickTravel());
  ck('the stick has room for a thumb', travel >= 60, Math.round(travel) + 'px of travel each way');

  await p.mouse.move(cx, cy);
  await p.mouse.down();
  const read = async (frac) => {
    await p.mouse.move(cx + travel * frac, cy);
    return p.evaluate(() => input.steer);
  };
  const centre = await read(0);
  const nudge = await read(0.06);
  const part = await read(0.5);
  const lockR = await read(1.2);        // past the end still means full lock
  const lockL = await read(-1.2);
  const partL = await read(-0.5);
  ck('centred reads as straight', centre === 0);
  ck('inside the dead zone still reads straight', nudge === 0, 'at 6% of travel');
  ck('part way is part steering', part > 0.1 && part < 0.95, part.toFixed(3));
  ck('full travel is full lock', Math.abs(lockR - 1) < 1e-6 && Math.abs(lockL + 1) < 1e-6);
  ck('left and right are mirrors', Math.abs(part + partL) < 1e-6, `${part.toFixed(3)} / ${partL.toFixed(3)}`);
  ck('small moves steer less than large ones', part < 0.5 * 1.0, 'half travel gives ' + part.toFixed(2));

  // and it actually turns the truck, proportionally
  const turnBy = async (steer) => {
    await place(p, ROAD0.x, ROAD0.y, -Math.PI / 2, 170);
    await hold(p, ['gas'], 600, steer);
    return Math.abs((await p.evaluate(() => S.truck.angle)) + Math.PI / 2);
  };
  const ROAD0 = await p.evaluate(() => ({ x: ROAD[0].x, y: ROAD[0].y }));
  await p.mouse.up();
  const gentle = await turnBy(0.35), hard = await turnBy(1);
  ck('a small input is a gentle turn', gentle > 0.02 && gentle < hard * 0.65,
     `${r1(gentle * 57)}° vs ${r1(hard * 57)}° at full lock`);

  // release returns it to neutral, knob and axis alike
  await p.mouse.move(cx, cy); await p.mouse.down(); await p.mouse.move(cx + travel, cy);
  const held = await p.evaluate(() => input.steer);
  await p.mouse.up();
  await p.waitForTimeout(320);
  const let_go = await p.evaluate(() => ({
    steer: input.steer,
    knob: document.getElementById('stickKnob').style.transform,
    held: document.getElementById('stick').classList.contains('held'),
  }));
  ck('releasing returns the stick to centre',
     held === 1 && let_go.steer === 0 && !let_go.held && /translateX\(0px\)/.test(let_go.knob),
     let_go.knob);

  // the keys still drive the same axis
  await p.keyboard.down('ArrowLeft');
  const keyed = await p.evaluate(() => input.steer);
  await p.keyboard.up('ArrowLeft');
  const released = await p.evaluate(() => input.steer);
  ck('the keyboard still steers', keyed === -1 && released === 0);
  ck('no errors from the stick', p.errors.length === 0, p.errors[0] || '');
  await p.close();
}

console.log('\n── the routes ──');
{
  const p = await open();
  const routes = await p.evaluate(() => {
    const out = [];
    for (const route of ROUTES) {
      loadRound(route.id, 991);
      const m = ROAD_M;
      // the corridor must never run back alongside itself
      let overlaps = 0;
      for (let i = 0; i < ROAD.length - 1; i++) {
        for (let j = i + 2; j < ROAD.length - 1; j++) {
          if (m.cum[j] - m.cum[i] < 420) continue;
          const a = ROAD[i], c = ROAD[j];
          if (Math.hypot(a.x - c.x, a.y - c.y) <
              a.w / 2 + c.w / 2 + WALK_WIDTH * 2 + 10) overlaps++;
        }
      }
      // and ten different deals must all be legal
      let bad = 0, sameSide = 0, tooClose = 0, unreachable = 0, blocked = 0;
      for (let k = 0; k < 10; k++) {
        const dealt = loadRound(route.id, 700 + k * 613);
        if (!dealt.bays || dealt.bays.length !== 5) { bad++; continue; }
        if (new Set(dealt.bays.map((b) => b.side)).size < 2) sameSide++;
        for (const z of dealt.bays) {
          const n = nearestOnRoad(z.x, z.y);
          if (Math.sqrt(n.d2) > n.w / 2) unreachable++;
          const reach = Math.hypot(z.w, z.h) / 2;
          for (const o of SOLIDS) {
            const size = o.kind === 'circle' ? o.r : Math.hypot(o.w, o.h) / 2;
            if (Math.hypot(o.x - z.x, o.y - z.y) < reach + size) blocked++;
          }
        }
        for (let a = 0; a < 5; a++) for (let c = a + 1; c < 5; c++) {
          if (Math.hypot(dealt.bays[a].x - dealt.bays[c].x,
                         dealt.bays[a].y - dealt.bays[c].y) < 200) tooClose++;
        }
      }
      out.push({ id: route.id, len: Math.round(m.total), overlaps, bad,
                 sameSide, tooClose, unreachable, blocked });
    }
    return out;
  });
  for (const r of routes) {
    ck(`${r.id}: the road never runs into itself`, r.overlaps === 0, r.len + ' units');
    ck(`${r.id}: every deal produces five bays`, r.bad === 0);
    ck(`${r.id}: every bay is on the tarmac`, r.unreachable === 0);
    ck(`${r.id}: no bay has something standing in it`, r.blocked === 0);
    ck(`${r.id}: bays are spaced and not all one side`, r.tooClose === 0 && r.sameSide === 0);
  }

  // the same route, dealt twice, should not be the same round
  const varies = await p.evaluate(() => {
    const key = (s) => s.bays.map((b) => b.node + ':' + b.side).join('|');
    const seen = new Set();
    for (let k = 0; k < 8; k++) seen.add(key(loadRound('rookie', 4000 + k * 331)));
    return seen.size;
  });
  ck('the same route deals different rounds', varies >= 6, varies + ' of 8 deals were distinct');
  await p.close();
}

console.log('\n── progression ──');
{
  const p = await open();
  await p.evaluate(() => { localStorage.clear(); });
  await p.reload();
  let r = await p.evaluate(() => ({ unlocked: best.unlocked, chips: document.querySelectorAll('.chip').length,
    locked: document.querySelectorAll('.chip.locked').length,
    random: !!document.querySelector('.chip.wild') }));
  ck('a new player has one round open', r.unlocked === 1 && r.locked === ROUTE_COUNT - 1);
  ck('Random Run is hidden until a second round opens', !r.random);

  // a C does not open anything; a B does, and so does anything above it
  r = await p.evaluate(() => {
    creditUnlock('rookie', 'C');
    const afterC = best.unlocked;
    const opened = creditUnlock('rookie', 'B');
    return { afterC, after: best.unlocked, opened: opened && opened.id, bar: CONFIG.unlockAt };
  });
  ck('a C opens nothing', r.afterC === 1);
  ck('a B opens the next round', r.after === 2 && r.opened === 'winding', 'bar is ' + r.bar);

  // and the bar is what the game says it is, whatever it is set to
  const ladder = await p.evaluate(() => {
    const out = {};
    for (const g of ['C', 'B', 'A', 'S']) {
      best.unlocked = 1;
      out[g] = !!creditUnlock('rookie', g);
    }
    best.unlocked = 2;
    return out;
  });
  ck('every grade at or above the bar opens the next round',
     !ladder.C && ladder.B && ladder.A && ladder.S,
     Object.entries(ladder).map(([g, o]) => g + (o ? '✓' : '✗')).join(' '));

  /* Parking inside every bay — no Perfects at all — has to be enough to move
     on. That is the whole point of the bar being a B. */
  const tidyButPlain = await p.evaluate(() => {
    chosenRoute = 'rookie'; startRun();
    S.ratings = ['good', 'good', 'good', 'good', 'good'];
    S.score = CONFIG.points.good * 5;
    S.t = parOf(S.route) + 4;                 // a little over par, so no bonus
    return { score: S.score, grade: gradeOf(S.score, S.t), par: parOf(S.route) };
  });
  ck('five plain Good stops is a B', tidyButPlain.grade === 'B',
     tidyButPlain.score + ' pts against a par of ' + tidyButPlain.par + 's');
  const allMessy = await p.evaluate(() => {
    S.ratings = ['messy', 'messy', 'messy', 'messy', 'messy'];
    S.score = CONFIG.points.messy * 5;
    S.t = parOf(S.route) + 10;
    return gradeOf(S.score, S.t);
  });
  ck('five scraped stops is still a C', allMessy === 'C', allMessy);

  r = await p.evaluate(() => {
    // finishing an already-passed round does not skip ahead
    creditUnlock('rookie', 'S');
    return best.unlocked;
  });
  ck('re-running an old round does not skip ahead', r === 2);

  await p.evaluate(() => {
    creditRecords('rookie', { time: 44.2, score: 1180, perfects: 5, grade: 'A' });
    creditRecords('rookie', { time: 51.0, score: 1500, perfects: 3, grade: 'S' });
    saveBest();
  });
  await p.reload();
  r = await p.evaluate(() => ({ unlocked: best.unlocked, rec: best.records.rookie,
    random: !!document.querySelector('.chip.wild') }));
  ck('unlocks survive a reload', r.unlocked === 2);
  ck('each record is kept on its own merit',
     r.rec.time === 44.2 && r.rec.score === 1500 && r.rec.perfects === 5 && r.rec.grade === 'S',
     JSON.stringify(r.rec));
  ck('Random Run appears once two rounds are open', r.random);

  // Random Run may only ever deal an open round
  const dealt = await p.evaluate(() => {
    chosenRoute = 'random';
    const seen = new Set();
    for (let k = 0; k < 30; k++) { startRun(); seen.add(S.route.id); }
    return [...seen];
  });
  ck('Random Run only deals open rounds',
     dealt.every((id) => ['rookie', 'winding'].includes(id)) && dealt.length === 2,
     dealt.join(', '));

  // a corrupted save must not take the game down with it
  await p.evaluate(() => localStorage.setItem('mailrun.best.v1', '{"unlocked":"lots","records":7}'));
  await p.reload();
  r = await p.evaluate(() => ({ unlocked: best.unlocked, ok: !!document.querySelector('#goBtn') }));
  ck('a broken save falls back cleanly', r.unlocked === 1 && r.ok);
  ck('no errors from progression', p.errors.length === 0, p.errors[0] || '');
  await p.close();
}

console.log('\n── a whole round ──');
{
  const tidy = await runBot(1.0, 0);
  ck('a round can be finished', tidy.finished && tidy.at === 5, tidy.at + '/5 stops');
  /* The 45-90s window is what a competent player should take, so it is the
     careful driver below that has to sit inside it. This one drives a near
     optimal line — it only has to show the round is not trivially short. */
  ck('the best possible line is not a sprint', tidy.t >= 38, r1(tidy.t) + 's flat out');
  ck('driving the middle keeps it off the verge', tidy.off < 2 && tidy.bumps === 0,
     `${r1(tidy.off)}s off-road, ${tidy.bumps} bumps`);
  ck('no errors over a whole round', tidy.errors.length === 0, tidy.errors[0] || '');

  const careful = await runBot(0.72, 0);
  ck('a competent round lands in the 45-90s window',
     careful.finished && careful.t >= 45 && careful.t <= 90, r1(careful.t) + 's');

  // the same driver, parking badly: the rating has to notice. The bays are
  // dealt fresh every run, so what matters is the gap between the two, not a
  // fixed count — an absolute would just be measuring the deal.
  const sloppy = await runBot(1.0, 0.82);
  const clean = tidy.ratings.filter((x) => x === 'perfect').length;
  const scruffy = sloppy.ratings.filter((x) => x === 'perfect').length;
  ck('a clean driver earns Perfects', clean >= 3, tidy.ratings.join(','));
  ck('sloppy parking is not rewarded', sloppy.finished && scruffy <= 1, sloppy.ratings.join(','));
  ck('the rating tells the two apart', clean > scruffy, `${clean} perfect vs ${scruffy}`);
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
  const remembered = await p.evaluate(() => {
    chosenRoute = 'rookie'; showTitle();
    return document.querySelector('.route-note').textContent;
  });
  ck('the depot remembers the round you just drove', /Best\s+\d+\.\d+s/.test(remembered),
     (remembered.match(/Best[^]{0,34}/) || [''])[0]);
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
  // both cards have to fit: a clipped Run Again is a dead end
  const cards = await p.evaluate(async () => {
    const fits = () => {
      const c = document.getElementById('card').getBoundingClientRect();
      return c.top >= -1 && c.bottom <= innerHeight + 1;
    };
    const btnIn = (id) => { const e = document.getElementById(id); if (!e) return false;
      const r = e.getBoundingClientRect();
      return r.top >= -1 && r.bottom <= innerHeight + 1; };
    showTitle();
    const depot = fits() && btnIn('goBtn');
    chosenRoute = ROUTES[0].id; startRun();
    S.t = 78.4; S.ratings = ['messy', 'good', 'messy', 'good', 'messy'];
    S.score = 565; S.at = 5; endRun();
    const short = fits() && btnIn('againBtn') && btnIn('menuBtn');
    best.unlocked = 1; saveBest();
    startRun();
    S.t = 61; S.ratings = ['perfect', 'perfect', 'perfect', 'perfect', 'perfect'];
    S.score = 1100; S.at = 5; endRun();
    const won = fits() && btnIn('againBtn') && btnIn('menuBtn');
    hideOverlay();
    return { depot, short, won };
  });
  const tag = `${w}x${h}`;
  ck(`${tag}: both cards fit, buttons and all`,
     cards.depot && cards.short && cards.won,
     `depot ${cards.depot ? 'ok' : 'CLIPPED'}, short round ${cards.short ? 'ok' : 'CLIPPED'}, unlock ${cards.won ? 'ok' : 'CLIPPED'}`);
  await p.reload();
  await play(p);
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
