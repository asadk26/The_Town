'use strict';

/* ==========================================================================
   MAIL RUN — drive the round, pull up at the curb, drop the mail.

   1. CONFIG — every handling and scoring number, in one place
   2. ROUTE  — the one authored round: road, stops, and the town around it
   3. WORLD  — geometry helpers (what surface is here, what am I hitting)
   4. STATE
   5. DRIVING — the truck
   6. DELIVERY — stopping at the curb
   7. RENDER — the town, from above
   8. AUDIO + INPUT + LOOP
   ========================================================================== */


/* ==========================================================================
   1. CONFIG
   ========================================================================== */

const CONFIG = {
  /* ── the truck ──────────────────────────────────────────────────────────
     Units are world units per second. The truck is 54 long, so a top speed
     of 330 is about six body lengths a second: brisk, still readable. */
  maxSpeed:      205,
  maxReverse:     88,
  accel:         225,   // throttle
  brakeDecel:    430,   // brake, while moving forward
  reverseAccel:  145,   // once stopped, the brake becomes reverse
  coast:         1.30,  // drag per second when off the throttle
  rollingDrag:   0.55,  // always-on drag, keeps the top speed honest

  /* Steering is a rate, not a position: how fast the truck can rotate at
     speed. It scales with how fast you are actually going, so the truck
     will not pirouette on the spot, and it eases off at the top end so a
     full-speed twitch does not spin you. */
  turnRate:      2.5,   // radians/sec at full steering authority
  steerRate:     7.0,   // how fast the wheel itself moves to the input
  fullSteerAt:   60,    // speed at which steering reaches full authority
  highSpeedEase: 0.34,  // fraction of turn rate traded away at top speed

  /* ── surfaces ─────────────────────────────────────────────────────────
     Off-road is a slowdown, never a wall. */
  surface: {
    road: { top: 1.00, drag: 0.0 },
    walk: { top: 0.62, drag: 2.2 },   // kerb and pavement
    grass:{ top: 0.44, drag: 3.6 },
  },

  /* ── collisions ──────────────────────────────────────────────────────── */
  bodyRadius:    13,    // two of these, front and back, approximate the truck
  bodyOffset:    14,
  bounce:        0.28,  // how much speed comes back the other way
  bumpLoss:      0.55,  // and how much is simply gone

  /* ── delivering ──────────────────────────────────────────────────────── */
  stopSpeed:     22,    // "stopped enough" for the hold to count
  holdTime:      0.7,   // seconds parked before the mail goes in
  perfectOffset: 0.36,  // share of the zone's half-size, for a PERFECT
  perfectSpeed:  7,
  perfectAngle:  0.42,  // radians off the kerb line
  messyOffset:   0.74,
  messyAngle:    0.80,

  /* ── camera ──────────────────────────────────────────────────────────── */
  viewHeight:    440,   // world units shown top to bottom
  camEase:       5.5,   // how quickly the camera catches up
  camLookAhead:  0.78,  // how far ahead of the truck it sits, per unit speed

  /* ── scoring ─────────────────────────────────────────────────────────── */
  points:        { perfect: 220, good: 140, messy: 70 },
  parTime:       62,    // a clean, competent round
  timeBonus:     14,    // points per second under par
};

const SAVE_KEY = 'mailrun.best.v1';


/* ==========================================================================
   2. ROUTE — one round, authored

   The road is a centreline. Each node carries the width there, so the road
   can narrow as the round goes on without any extra machinery. Stops sit
   beside a node, on the kerb, angled to the road.
   ========================================================================== */

const ROAD = [
  { x:  300, y: 3400, w: 132 },   // the depot end: wide, straight, forgiving
  { x:  300, y: 2900, w: 132 },
  { x:  300, y: 2400, w: 130 },   // ① straight approach, generous bay
  { x:  300, y: 1900, w: 128 },
  { x:  320, y: 1520, w: 126 },
  { x:  430, y: 1230, w: 124 },   // a gentle bend right
  { x:  660, y: 1030, w: 122 },
  { x:  980,  y: 950, w: 120 },   // ② just past the bend
  { x: 1420,  y: 940, w: 118 },
  { x: 1780,  y: 980, w: 114 },
  { x: 2000, y: 1130, w: 110 },   // a sharper corner
  { x: 2090, y: 1400, w: 106 },   // ③ tight in behind it
  { x: 2100, y: 1780, w: 102 },
  { x: 2060, y: 2140, w:  96 },
  { x: 1920, y: 2420, w:  92 },
  { x: 1660, y: 2600, w:  88 },   // the lanes narrow from here on
  { x: 1330, y: 2660, w:  86 },   // ④ shortly after the turn
  { x:  980, y: 2640, w:  84 },
  { x:  740, y: 2520, w:  82 },
  { x:  600, y: 2280, w:  80 },   // the last approach, tightest of the round
  { x:  590, y: 1950, w:  78 },   // ⑤
  { x:  610, y: 1800, w:  78 },   // a little run-out past the last box
];

/* Each stop names the node it sits at, which side of the road the kerb is
   on, and how much room the apron gives. They get tighter as the round
   goes on — that, and the road narrowing, is the whole difficulty curve. */
const STOPS = [
  // `w` is the bay's length along the kerb, `h` its depth across the road.
  // Both tighten as the round goes on; so does the road they sit in.
  { at:  2, side: -1, w: 150, h: 62, house: 'coral',   name: '2 Larch Way' },
  { at:  7, side: -1, w: 130, h: 58, house: 'mustard', name: '14 Elm Row' },
  { at: 11, side:  1, w: 114, h: 54, house: 'teal',    name: '31 Kiln Hill' },
  { at: 16, side:  1, w: 102, h: 50, house: 'cream',   name: '5 Poplar Close' },
  { at: 20, side: -1, w:  94, h: 46, house: 'plum',    name: '40 Sorrel Lane' },
];

const HOUSE_COLORS = {
  coral:   { wall: '#e8735e', roof: '#b8482f' },
  mustard: { wall: '#f2b447', roof: '#c07f16' },
  teal:    { wall: '#6fc0c4', roof: '#3d8e93' },
  cream:   { wall: '#f3e6cd', roof: '#c1a878' },
  plum:    { wall: '#b98ad1', roof: '#845a9c' },
  sage:    { wall: '#a8c98a', roof: '#6e9152' },
  sky:     { wall: '#8fb8e8', roof: '#5b83b5' },
};


/* ==========================================================================
   3. WORLD — geometry, and the town dressing generated once around the road
   ========================================================================== */

const clamp = (v, lo, hi) => v < lo ? lo : v > hi ? hi : v;
const lerp  = (a, b, t) => a + (b - a) * t;
const TAU   = Math.PI * 2;

/* Signed shortest angle between two headings. */
function angleDiff(a, b) {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}

/* Closest point on segment AB to P, as {x, y, t, d2}. */
function nearestOnSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const t = len2 ? clamp(((px - ax) * dx + (py - ay) * dy) / len2, 0, 1) : 0;
  const x = ax + dx * t, y = ay + dy * t;
  const ex = px - x, ey = py - y;
  return { x: x, y: y, t: t, d2: ex * ex + ey * ey };
}

/* Nearest point on the whole centreline, with the road's width there. */
function nearestOnRoad(px, py) {
  let best = null;
  for (let i = 0; i < ROAD.length - 1; i++) {
    const a = ROAD[i], b = ROAD[i + 1];
    const n = nearestOnSegment(px, py, a.x, a.y, b.x, b.y);
    if (!best || n.d2 < best.d2) {
      best = n;
      best.i = i;
      best.w = lerp(a.w, b.w, n.t);
      best.angle = Math.atan2(b.y - a.y, b.x - a.x);
    }
  }
  return best;
}

/* Road, kerb, or grass. A stop's apron counts as road, so pulling in to
   deliver never drags the truck down as if it had hit a verge. */
const WALK_WIDTH = 26;
function surfaceAt(px, py) {
  for (let i = 0; i < S.stops.length; i++) if (inZone(S.stops[i], px, py, 1)) return 'road';
  const n = nearestOnRoad(px, py);
  const d = Math.sqrt(n.d2);
  if (d <= n.w / 2) return 'road';
  if (d <= n.w / 2 + WALK_WIDTH) return 'walk';
  return 'grass';
}

/* Where a stop's apron sits: beside its node, squared to the road. */
function zoneFor(stop) {
  const i = stop.at;
  const a = ROAD[Math.max(0, i - 1)], b = ROAD[Math.min(ROAD.length - 1, i + 1)];
  const angle = Math.atan2(b.y - a.y, b.x - a.x);
  const node = ROAD[i];
  const off = node.w / 2 - stop.h / 2 + 5;      // tucked against the kerb, inside the road
  return {
    x: node.x + Math.cos(angle + Math.PI / 2) * off * stop.side,
    y: node.y + Math.sin(angle + Math.PI / 2) * off * stop.side,
    angle: angle,
    w: stop.w, h: stop.h,
    side: stop.side,
    house: stop.house,
    name: stop.name,
    node: i,
  };
}

/* Truck position in a zone's own frame, as a share of its half-size. */
function zoneLocal(zone, px, py) {
  const dx = px - zone.x, dy = py - zone.y;
  const c = Math.cos(-zone.angle), s = Math.sin(-zone.angle);
  return { u: (dx * c - dy * s) / (zone.w / 2), v: (dx * s + dy * c) / (zone.h / 2) };
}
function inZone(zone, px, py, slack) {
  const l = zoneLocal(zone, px, py);
  const k = slack || 1;
  return Math.abs(l.u) <= k && Math.abs(l.v) <= k;
}

/* ── the town ────────────────────────────────────────────────────────────
   Houses, trees, hedges and the odd park bench, scattered along the road
   once at boot. Deterministic, so the town is the same town every run. */

let seed = 20260831;
function rnd() { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; }

const PROPS = [];   // drawn behind the truck
const SOLIDS = [];  // and these stop it

function addHouse(x, y, angle, colorName, w, h) {
  const c = HOUSE_COLORS[colorName] || HOUSE_COLORS.cream;
  PROPS.push({ kind: 'house', x: x, y: y, a: angle, w: w, h: h, wall: c.wall, roof: c.roof });
  SOLIDS.push({ kind: 'rect', x: x, y: y, a: angle, w: w, h: h });
}
function addTree(x, y, r) {
  PROPS.push({ kind: 'tree', x: x, y: y, r: r, tone: rnd() });
  SOLIDS.push({ kind: 'circle', x: x, y: y, r: r * 0.55 });
}

function buildTown() {
  const stopNodes = STOPS.map((s) => s.at);

  for (let i = 0; i < ROAD.length - 1; i++) {
    const a = ROAD[i], b = ROAD[i + 1];
    const segLen = Math.hypot(b.x - a.x, b.y - a.y);
    const angle = Math.atan2(b.y - a.y, b.x - a.x);
    const nx = Math.cos(angle + Math.PI / 2), ny = Math.sin(angle + Math.PI / 2);

    for (let side = -1; side <= 1; side += 2) {
      let along = 40;
      while (along < segLen - 40) {
        const t = along / segLen;
        const cx = lerp(a.x, b.x, t), cy = lerp(a.y, b.y, t);
        const w = lerp(a.w, b.w, t);
        const roll = rnd();

        // keep the kerb clear where a stop's apron will be
        const nearStop = stopNodes.some((n) => {
          const d = Math.hypot(cx - ROAD[n].x, cy - ROAD[n].y);
          return d < 150;
        });

        if (nearStop) { along += 90; continue; }

        if (roll < 0.42) {
          const off = w / 2 + WALK_WIDTH + 78 + rnd() * 40;
          const names = ['coral', 'mustard', 'teal', 'cream', 'plum', 'sage', 'sky'];
          addHouse(cx + nx * off * side, cy + ny * off * side, angle,
                   names[Math.floor(rnd() * names.length)],
                   86 + rnd() * 46, 74 + rnd() * 30);
          along += 150 + rnd() * 70;
        } else if (roll < 0.78) {
          const off = w / 2 + WALK_WIDTH + 24 + rnd() * 18;
          addTree(cx + nx * off * side, cy + ny * off * side, 17 + rnd() * 9);
          along += 78 + rnd() * 54;
        } else {
          // a patch of park: flowers, no collision
          const off = w / 2 + WALK_WIDTH + 40 + rnd() * 90;
          PROPS.push({ kind: 'park', x: cx + nx * off * side, y: cy + ny * off * side,
                       r: 40 + rnd() * 46, tone: rnd() });
          along += 120 + rnd() * 60;
        }
      }
    }
  }
}
buildTown();


/* ==========================================================================
   4. STATE
   ========================================================================== */

let S = null;
let best = loadBest();

function createRun() {
  const start = ROAD[0], next = ROAD[1];
  return {
    phase: 'title',                 // 'title' | 'driving' | 'over'
    t: 0,                           // seconds elapsed on the round
    truck: {
      x: start.x, y: start.y,
      angle: Math.atan2(next.y - start.y, next.x - start.x),
      speed: 0,
      steer: 0,
      lean: 0, dip: 0, bob: 0,      // presentation only
    },
    cam: { x: start.x, y: start.y },
    stops: STOPS.map(zoneFor),
    at: 0,                          // which stop is live
    hold: 0,                        // seconds parked in the live zone
    ratings: [],                    // 'perfect' | 'good' | 'messy'
    score: 0,
    streak: 0, bestStreak: 0,
    bumps: 0,
    offRoad: 0,                     // seconds spent off the tarmac
  };
}

function loadBest() {
  const blank = { time: 0, score: 0 };
  try {
    const raw = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
    if (raw && typeof raw === 'object') {
      return { time: Number(raw.time) || 0, score: Number(raw.score) || 0 };
    }
  } catch (e) { /* no memory is fine */ }
  return blank;
}
function saveBest() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(best)); } catch (e) { /* fine */ }
}


/* ==========================================================================
   5. DRIVING
   ========================================================================== */

const input = { left: false, right: false, gas: false, brake: false };

function driveStep(dt) {
  const t = S.truck;
  const surf = CONFIG.surface[surfaceAt(t.x, t.y)];

  /* ── along the truck ── */
  if (input.gas) {
    t.speed += CONFIG.accel * dt;
  } else if (input.brake) {
    if (t.speed > 6) t.speed -= CONFIG.brakeDecel * dt;          // brake…
    else t.speed -= CONFIG.reverseAccel * dt;                    // …then reverse
  } else {
    t.speed -= t.speed * CONFIG.coast * dt;                      // coasting
  }
  t.speed -= t.speed * (CONFIG.rollingDrag + surf.drag) * dt;

  const top = CONFIG.maxSpeed * surf.top;
  t.speed = clamp(t.speed, -CONFIG.maxReverse * surf.top, top);
  if (!input.gas && !input.brake && Math.abs(t.speed) < 2) t.speed = 0;

  /* ── steering ──
     Authority comes from actually moving, and eases off near the top end so
     the truck turns like a van rather than a spinning top. */
  const want = (input.left ? -1 : 0) + (input.right ? 1 : 0);
  t.steer += clamp(want - t.steer, -1, 1) * CONFIG.steerRate * dt;
  t.steer = clamp(t.steer, -1, 1);

  const v = Math.abs(t.speed);
  const authority = Math.min(1, v / CONFIG.fullSteerAt);
  const ease = 1 - CONFIG.highSpeedEase * (v / CONFIG.maxSpeed);
  const dir = t.speed < 0 ? -1 : 1;              // reversing swings the nose the other way
  t.angle += t.steer * CONFIG.turnRate * authority * ease * dir * dt;

  t.x += Math.cos(t.angle) * t.speed * dt;
  t.y += Math.sin(t.angle) * t.speed * dt;

  resolveCollisions();

  /* ── body ──
     Lean into the turn, dip under the brakes, and bounce once on settling. */
  const leanTarget = t.steer * authority * 0.16;
  t.lean += (leanTarget - t.lean) * Math.min(1, dt * 9);
  const dipTarget = input.brake && t.speed > 20 ? 1 : 0;
  t.dip += (dipTarget - t.dip) * Math.min(1, dt * 11);
  t.bob *= Math.max(0, 1 - dt * 6);

  if (surfaceAt(t.x, t.y) !== 'road') S.offRoad += dt;
}

/* Two circles, front and rear, pushed out of anything solid. */
function bodyCircles() {
  const t = S.truck;
  const cx = Math.cos(t.angle) * CONFIG.bodyOffset, cy = Math.sin(t.angle) * CONFIG.bodyOffset;
  return [{ x: t.x + cx, y: t.y + cy }, { x: t.x - cx, y: t.y - cy }];
}

function resolveCollisions() {
  const t = S.truck;
  const r = CONFIG.bodyRadius;
  let hit = false;

  for (const circle of bodyCircles()) {
    for (const o of SOLIDS) {
      let nx, ny, depth;

      if (o.kind === 'circle') {
        const dx = circle.x - o.x, dy = circle.y - o.y;
        const d = Math.hypot(dx, dy) || 0.001;
        depth = o.r + r - d;
        if (depth <= 0) continue;
        nx = dx / d; ny = dy / d;
      } else {
        // circle against a rotated rectangle: work in the box's own frame
        const c = Math.cos(-o.a), s = Math.sin(-o.a);
        const dx = circle.x - o.x, dy = circle.y - o.y;
        const lx = dx * c - dy * s, ly = dx * s + dy * c;
        const hx = o.w / 2, hy = o.h / 2;
        const qx = clamp(lx, -hx, hx), qy = clamp(ly, -hy, hy);
        const ex = lx - qx, ey = ly - qy;
        const d = Math.hypot(ex, ey);
        if (d > r) continue;
        let lnx, lny;
        if (d > 0.001) { lnx = ex / d; lny = ey / d; depth = r - d; }
        else {
          // centre is inside the box: leave by the nearest face
          const gx = hx - Math.abs(lx), gy = hy - Math.abs(ly);
          if (gx < gy) { lnx = Math.sign(lx) || 1; lny = 0; depth = gx + r; }
          else         { lnx = 0; lny = Math.sign(ly) || 1; depth = gy + r; }
        }
        const cc = Math.cos(o.a), ss = Math.sin(o.a);
        nx = lnx * cc - lny * ss; ny = lnx * ss + lny * cc;
      }

      t.x += nx * depth;
      t.y += ny * depth;

      // only the part of the motion going into the obstacle is lost
      const into = Math.cos(t.angle) * nx + Math.sin(t.angle) * ny;
      if (into * t.speed < 0) {
        t.speed = -t.speed * CONFIG.bounce * CONFIG.bumpLoss;
        hit = true;
      }
      circle.x += nx * depth; circle.y += ny * depth;
    }
  }

  if (hit && !resolveCollisions.cool) {
    S.bumps++;
    S.truck.bob = 1;
    playCue('bump');
    resolveCollisions.cool = true;
    setTimeout(() => { resolveCollisions.cool = false; }, 260);
  }
}


/* ==========================================================================
   6. DELIVERY
   ========================================================================== */

function liveZone() { return S.at < S.stops.length ? S.stops[S.at] : null; }

function deliveryStep(dt) {
  const zone = liveZone();
  if (!zone) return;
  const t = S.truck;

  const inside = inZone(zone, t.x, t.y, 1);
  const slow = Math.abs(t.speed) < CONFIG.stopSpeed;

  if (inside && slow) {
    S.hold += dt;
    if (S.hold >= CONFIG.holdTime) deliver(zone);
  } else {
    S.hold = Math.max(0, S.hold - dt * 2.2);   // drift off, do not snap
  }
}

/* Centred and square at a crawl is a PERFECT; anywhere in the apron is a
   GOOD; scraping the edge or parked across it is MESSY. */
function rate(zone) {
  const t = S.truck;
  const l = zoneLocal(zone, t.x, t.y);
  const off = Math.max(Math.abs(l.u), Math.abs(l.v));
  const skew = Math.abs(angleDiff(zone.angle, t.angle));
  const askew = Math.min(skew, Math.PI - skew);          // parked either way round is fine

  if (off <= CONFIG.perfectOffset && Math.abs(t.speed) <= CONFIG.perfectSpeed &&
      askew <= CONFIG.perfectAngle) return 'perfect';
  if (off >= CONFIG.messyOffset || askew >= CONFIG.messyAngle) return 'messy';
  return 'good';
}

function deliver(zone) {
  const grade = rate(zone);
  S.ratings.push(grade);
  S.score += CONFIG.points[grade];
  S.hold = 0;
  zone.done = grade;
  zone.pop = 0;

  if (grade === 'perfect') {
    S.streak++;
    if (S.streak > S.bestStreak) S.bestStreak = S.streak;
  } else S.streak = 0;

  popRating(grade, zone);
  playCue(grade === 'perfect' ? 'perfect' : 'drop');
  renderStops();

  S.at++;
  if (S.at >= S.stops.length) setTimeout(() => endRun(), 620);
}

function popRating(grade, zone) {
  const p = worldToScreen(zone.x, zone.y);
  const el = document.createElement('div');
  el.className = 'pop ' + grade;
  el.innerHTML = grade.toUpperCase() + '<small>+' + CONFIG.points[grade] + '</small>';
  el.style.left = p.x + 'px';
  el.style.top = p.y + 'px';
  elFx.appendChild(el);
  setTimeout(() => el.remove(), 950);
}


/* ==========================================================================
   7. RENDER
   ========================================================================== */

const $ = (id) => document.getElementById(id);
const cv = $('view');
const ctx = cv.getContext('2d');
const elFx = $('fx');
const elPointer = $('pointer');
const elOverlay = $('overlay');
const elCard = $('card');

let VIEW = { w: 0, h: 0, scale: 1 };

function resize() {
  const box = $('road').getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  cv.width = Math.max(1, Math.round(box.width * dpr));
  cv.height = Math.max(1, Math.round(box.height * dpr));
  VIEW.w = box.width; VIEW.h = box.height;
  VIEW.scale = box.height / CONFIG.viewHeight;   // the view always shows the same height of town
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 120));

function worldToScreen(wx, wy) {
  return {
    x: (wx - S.cam.x) * VIEW.scale + VIEW.w / 2,
    y: (wy - S.cam.y) * VIEW.scale + VIEW.h / 2,
  };
}

/* The camera sits a little ahead of the truck, so a corner shows up before
   you are in it, and eases rather than snapping. */
function cameraStep(dt) {
  const t = S.truck;
  const lead = Math.min(CONFIG.viewHeight * 0.3, Math.abs(t.speed) * CONFIG.camLookAhead);
  const dir = t.speed < 0 ? -1 : 1;
  const tx = t.x + Math.cos(t.angle) * lead * dir;
  const ty = t.y + Math.sin(t.angle) * lead * dir;
  const k = Math.min(1, dt * CONFIG.camEase);
  S.cam.x += (tx - S.cam.x) * k;
  S.cam.y += (ty - S.cam.y) * k;
}

function draw() {
  const s = VIEW.scale;
  ctx.save();
  ctx.clearRect(0, 0, VIEW.w, VIEW.h);

  // grass, with a soft mown pattern so the ground is not a flat field
  ctx.fillStyle = '#86c06c';
  ctx.fillRect(0, 0, VIEW.w, VIEW.h);
  drawMowing();

  ctx.translate(VIEW.w / 2, VIEW.h / 2);
  ctx.scale(s, s);
  ctx.translate(-S.cam.x, -S.cam.y);

  drawParks();
  drawRoad();
  drawZones();
  drawProps();
  drawTruck();

  ctx.restore();
  drawPointer();
}

/* Stripes of slightly lighter grass, drawn in screen space and offset by the
   camera so they scroll with the world without costing a path per blade. */
function drawMowing() {
  const s = VIEW.scale, band = 54 * s, period = band * 2;
  let off = (VIEW.h / 2 - S.cam.y * s) % period;
  if (off < 0) off += period;
  ctx.fillStyle = 'rgba(255,255,255,.05)';
  for (let y = off - period; y < VIEW.h + period; y += period) {
    ctx.fillRect(0, y, VIEW.w, band);
  }
}

function drawParks() {
  for (const p of PROPS) {
    if (p.kind !== 'park') continue;
    if (!onScreen(p.x, p.y, p.r + 40)) continue;
    ctx.fillStyle = p.tone > 0.5 ? '#93cc78' : '#7ab362';
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, p.r, p.r * 0.78, p.tone * 3, 0, TAU);
    ctx.fill();
    // a few flowers
    ctx.fillStyle = p.tone > 0.66 ? '#ffd98a' : (p.tone > 0.33 ? '#f6a8bd' : '#fdf3d0');
    for (let i = 0; i < 5; i++) {
      const a = p.tone * 9 + i * 1.7, rr = p.r * (0.25 + (i % 3) * 0.2);
      ctx.beginPath();
      ctx.arc(p.x + Math.cos(a) * rr, p.y + Math.sin(a) * rr * 0.78, 3.4, 0, TAU);
      ctx.fill();
    }
  }
}

/* The road is one stroked centreline, laid down three times: pavement,
   tarmac, then the dashes. Round caps make the joins for free. */
function strokeRoad(pad, style, dash) {
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.strokeStyle = style;
  ctx.setLineDash(dash || []);
  for (let i = 0; i < ROAD.length - 1; i++) {
    const a = ROAD[i], b = ROAD[i + 1];
    if (!segOnScreen(a, b, a.w)) continue;
    ctx.lineWidth = (a.w + b.w) / 2 + pad;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  ctx.setLineDash([]);
}

function drawRoad() {
  strokeRoad(WALK_WIDTH * 2 + 6, '#cfc7b2');      // kerbstone edge
  strokeRoad(WALK_WIDTH * 2, '#e3dccb');          // pavement
  strokeRoad(6, '#5c5c68');                       // the kerb's dark lip
  strokeRoad(0, '#6b6b78');                       // tarmac

  ctx.lineWidth = 4;
  strokeRoad(-1000, 'rgba(0,0,0,0)');             // reset widths harmlessly
  ctx.lineJoin = 'round'; ctx.lineCap = 'butt';
  ctx.strokeStyle = 'rgba(253,247,224,.5)';
  ctx.lineWidth = 4;
  ctx.setLineDash([26, 30]);
  ctx.beginPath();
  ctx.moveTo(ROAD[0].x, ROAD[0].y);
  for (let i = 1; i < ROAD.length; i++) ctx.lineTo(ROAD[i].x, ROAD[i].y);
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawZones() {
  for (let i = 0; i < S.stops.length; i++) {
    const z = S.stops[i];
    if (!onScreen(z.x, z.y, 160)) continue;
    const live = i === S.at;
    const done = !!z.done;

    ctx.save();
    ctx.translate(z.x, z.y);
    ctx.rotate(z.angle);

    if (live) {
      // A marked loading bay: painted hatching, and a border that breathes
      // while it is the one you want. It turns green as the hold builds.
      const pulse = 0.5 + 0.5 * Math.sin(S.t * 3.4);
      const holding = S.hold > 0;
      const p = holding ? S.hold / CONFIG.holdTime : 0;
      roundRect(-z.w / 2, -z.h / 2, z.w, z.h, 10);
      ctx.fillStyle = holding ? 'rgba(104,222,150,' + (0.42 + 0.3 * p) + ')'
                              : 'rgba(255,205,124,' + (0.44 + 0.12 * pulse) + ')';
      ctx.fill();

      ctx.save();
      ctx.clip();
      ctx.strokeStyle = holding ? 'rgba(255,255,255,.34)' : 'rgba(255,246,224,.42)';
      ctx.lineWidth = 7;
      for (let d = -z.h; d < z.w + z.h; d += 26) {
        ctx.beginPath();
        ctx.moveTo(-z.w / 2 + d, -z.h / 2);
        ctx.lineTo(-z.w / 2 + d - z.h, z.h / 2);
        ctx.stroke();
      }
      ctx.restore();

      roundRect(-z.w / 2, -z.h / 2, z.w, z.h, 10);
      ctx.setLineDash([13, 10]);
      ctx.lineDashOffset = -S.t * 26;
      ctx.lineWidth = 5;
      ctx.strokeStyle = holding ? '#2f9d61' : '#ffb547';
      ctx.stroke();
      ctx.setLineDash([]);
    } else if (done) {
      roundRect(-z.w / 2, -z.h / 2, z.w, z.h, 10);
      ctx.fillStyle = 'rgba(47,111,176,.16)';
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(47,111,176,.4)';
      ctx.stroke();
    } else {
      roundRect(-z.w / 2, -z.h / 2, z.w, z.h, 10);
      ctx.fillStyle = 'rgba(255,255,255,.1)';
      ctx.fill();
    }
    ctx.restore();

    drawMailbox(z, live, done);

    // the hold, as a ring closing over the apron
    if (live && S.hold > 0) {
      const p = Math.min(1, S.hold / CONFIG.holdTime);
      ctx.save();
      ctx.translate(z.x, z.y);
      ctx.lineWidth = 7;
      ctx.lineCap = 'round';
      ctx.strokeStyle = 'rgba(255,255,255,.35)';
      ctx.beginPath(); ctx.arc(0, 0, 30, 0, TAU); ctx.stroke();
      ctx.strokeStyle = '#37a86a';
      ctx.beginPath(); ctx.arc(0, 0, 30, -Math.PI / 2, -Math.PI / 2 + TAU * p); ctx.stroke();
      ctx.restore();
    }
  }
}

/* A box on a post at the kerb, with a flag that goes up when the mail lands. */
function drawMailbox(z, live, done) {
  const out = z.h / 2 + 16;
  const bx = z.x + Math.cos(z.angle + Math.PI / 2) * out * z.side;
  const by = z.y + Math.sin(z.angle + Math.PI / 2) * out * z.side;
  const wiggle = live && S.hold > 0 ? Math.sin(S.t * 34) * 0.16 : 0;

  ctx.save();
  ctx.translate(bx, by);
  ctx.rotate(z.angle + wiggle);
  ctx.fillStyle = 'rgba(0,0,0,.2)';
  ctx.beginPath(); ctx.ellipse(3, 6, 20, 12, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = '#8a6a4a';                                  // post
  ctx.fillRect(-4, -3, 8, 20);
  ctx.fillStyle = done ? '#2f6fb0' : '#59636e';               // the box
  roundRect(-18, -20, 36, 22, 10); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.22)';                    // its lid, catching the sun
  roundRect(-18, -20, 36, 8, 7); ctx.fill();
  ctx.fillStyle = done ? '#e05c4a' : '#b9c0c7';              // the flag
  if (done) { ctx.fillRect(15, -34, 4, 17); ctx.fillRect(15, -34, 13, 9); }
  else      { ctx.fillRect(15, -20, 4, 14); }
  ctx.restore();
}

function drawProps() {
  for (const p of PROPS) {
    if (p.kind === 'park') continue;
    if (!onScreen(p.x, p.y, 120)) continue;

    if (p.kind === 'house') {
      const w = p.w, h = p.h;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.a);
      ctx.fillStyle = 'rgba(0,0,0,.16)';
      roundRect(-w / 2 + 5, -h / 2 + 7, w, h, 7); ctx.fill();

      // walls show as a rim; the roof is what you actually see from up here
      ctx.fillStyle = p.wall;
      roundRect(-w / 2, -h / 2, w, h, 7); ctx.fill();
      ctx.fillStyle = p.roof;
      roundRect(-w / 2 + 5, -h / 2 + 5, w - 10, h - 10, 5); ctx.fill();

      // the near slope catches the light, and the ridge runs down the middle
      ctx.fillStyle = 'rgba(255,255,255,.16)';
      roundRect(-w / 2 + 5, -h / 2 + 5, w - 10, (h - 10) / 2, 5); ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,.2)';
      ctx.fillRect(-w / 2 + 7, -1.5, w - 14, 3);

      // a chimney, which is most of the charm for three lines of code
      ctx.fillStyle = p.roof;
      ctx.beginPath(); ctx.arc(w / 2 - 17, -h / 2 + 15, 6.5, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,.28)';
      ctx.beginPath(); ctx.arc(w / 2 - 17, -h / 2 + 15, 3, 0, TAU); ctx.fill();
      ctx.restore();
    } else {
      ctx.fillStyle = 'rgba(0,0,0,.17)';
      ctx.beginPath(); ctx.ellipse(p.x + 4, p.y + 6, p.r, p.r * 0.8, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = p.tone > 0.5 ? '#4f9553' : '#5fa85c';
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TAU); ctx.fill();
      ctx.fillStyle = p.tone > 0.5 ? '#6cb46a' : '#7cc275';    // the lit side of the canopy
      ctx.beginPath(); ctx.arc(p.x - p.r * 0.22, p.y - p.r * 0.24, p.r * 0.66, 0, TAU); ctx.fill();
    }
  }
}

/* The truck: a little cream van with a postal stripe, leaning into its turns
   and dipping on the brakes. */
function drawTruck() {
  const t = S.truck;
  const L = 54, W = 28;

  ctx.save();
  ctx.translate(t.x, t.y);

  // shadow stays put while the body leans over it
  ctx.fillStyle = 'rgba(0,0,0,.22)';
  ctx.save();
  ctx.rotate(t.angle);
  roundRect(-L / 2 + 3, -W / 2 + 4, L, W, 8); ctx.fill();
  ctx.restore();

  ctx.rotate(t.angle);
  const squash = 1 - t.dip * 0.05 + t.bob * 0.05;
  ctx.scale(1 + t.dip * 0.03, squash);
  ctx.rotate(t.lean * 0.14);

  // wheels, turned with the steering
  ctx.fillStyle = '#2c2a33';
  const wheel = (dx, dy, turn) => {
    ctx.save(); ctx.translate(dx, dy); ctx.rotate(turn);
    roundRect(-8, -4.5, 16, 9, 3.5); ctx.fill(); ctx.restore();
  };
  const steerAngle = t.steer * 0.42;
  wheel(-15,  W / 2 - 1, 0); wheel(-15, -W / 2 + 1, 0);
  wheel( 16,  W / 2 - 1, steerAngle); wheel(16, -W / 2 + 1, steerAngle);

  // body
  ctx.fillStyle = '#fbf6e9';
  roundRect(-L / 2, -W / 2, L, W, 8); ctx.fill();
  ctx.fillStyle = '#e6dfcc';                       // the box on the back
  roundRect(-L / 2 + 2, -W / 2 + 2, 22, W - 4, 6); ctx.fill();
  ctx.fillStyle = '#2f6fb0';                       // postal stripe
  ctx.fillRect(-L / 2 + 2, -3.5, L - 12, 7);
  ctx.fillStyle = '#e05c4a';
  ctx.fillRect(-L / 2 + 2, -3.5, 9, 7);
  ctx.fillStyle = '#bcd7ee';                       // windscreen
  roundRect(L / 2 - 18, -W / 2 + 4, 12, W - 8, 4); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.55)';
  roundRect(L / 2 - 18, -W / 2 + 4, 12, 5, 3); ctx.fill();
  ctx.fillStyle = '#ffe7a8';                       // lamps
  ctx.beginPath(); ctx.arc(L / 2 - 3, -W / 2 + 6, 3, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.arc(L / 2 - 3,  W / 2 - 6, 3, 0, TAU); ctx.fill();
  if (input.brake) {
    ctx.fillStyle = '#ff5a44';
    ctx.beginPath(); ctx.arc(-L / 2 + 3, -W / 2 + 6, 3, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(-L / 2 + 3,  W / 2 - 6, 3, 0, TAU); ctx.fill();
  }
  ctx.restore();
}

function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function onScreen(wx, wy, pad) {
  const halfW = VIEW.w / 2 / VIEW.scale + (pad || 0);
  const halfH = VIEW.h / 2 / VIEW.scale + (pad || 0);
  return Math.abs(wx - S.cam.x) < halfW && Math.abs(wy - S.cam.y) < halfH;
}
function segOnScreen(a, b, pad) {
  return onScreen((a.x + b.x) / 2, (a.y + b.y) / 2,
                  (pad || 0) + Math.hypot(b.x - a.x, b.y - a.y) / 2);
}

/* When the next apron is off the edge, an arrow rides the border pointing
   at it — enough to never be lost, without a minimap. */
function drawPointer() {
  const z = liveZone();
  if (!z || S.phase !== 'driving') { elPointer.classList.remove('on'); return; }
  const p = worldToScreen(z.x, z.y);
  const m = 34;
  const mBottom = Math.max(m, VIEW.h * 0.3);   // the thumb pads own the bottom strip
  if (p.x > m && p.x < VIEW.w - m && p.y > m && p.y < VIEW.h - mBottom) {
    elPointer.classList.remove('on');
    return;
  }
  const cx = VIEW.w / 2, cy = VIEW.h / 2;
  const dx = p.x - cx, dy = p.y - cy;
  const limY = dy > 0 ? VIEW.h / 2 - mBottom : VIEW.h / 2 - m;
  const scale = Math.min((VIEW.w / 2 - m) / Math.abs(dx || 0.001),
                         Math.max(10, limY) / Math.abs(dy || 0.001));
  elPointer.classList.add('on');
  elPointer.style.transform = 'translate(' + (cx + dx * scale) + 'px,' + (cy + dy * scale) + 'px)' +
                              ' rotate(' + Math.atan2(dy, dx) + 'rad)';
}

/* ── the board ── */
function renderStops() {
  const out = [];
  for (let i = 0; i < S.stops.length; i++) {
    const z = S.stops[i];
    const cls = z.done ? ('stop done ' + (z.done === 'perfect' ? 'perfect' : ''))
                       : (i === S.at && S.phase === 'driving' ? 'stop now' : 'stop');
    out.push('<span class="' + cls.trim() + '"></span>');
  }
  $('stops').innerHTML = out.join('');
}


/* ==========================================================================
   8. CARDS, AUDIO, INPUT, LOOP
   ========================================================================== */

function hideOverlay() { elOverlay.classList.add('hidden'); }

function showTitle() {
  elOverlay.classList.remove('hidden');
  elCard.innerHTML =
    '<h1>Mail <b>Run</b></h1>' +
    '<p class="sub">One round, five boxes</p>' +
    '<ul class="how">' +
      '<li><i>1</i><span>Drive the route. Gas on the right, steering on the left.</span></li>' +
      '<li><i>2</i><span>The next kerb glows. An arrow points the way if it is off screen.</span></li>' +
      '<li><i>3</i><span>Pull into the apron and hold still for a moment to post it.</span></li>' +
      '<li><i>4</i><span>Stop square and centred for a <b>Perfect</b>. Overshoot? Reverse and try again.</span></li>' +
    '</ul>' +
    (best.time ? '<p class="best-note">Best round: ' + best.time.toFixed(1) + 's &middot; ' + best.score + ' pts</p>' : '') +
    '<button class="btn" type="button" id="goBtn">Start the round</button>';
  $('goBtn').addEventListener('click', startRun);
}

function startRun() {
  S = createRun();
  hideOverlay();
  renderStops();
  resize();
  S.phase = 'driving';
  last = performance.now();
  playCue('start');
}

function gradeOf(score, time) {
  const perfects = S.ratings.filter((r) => r === 'perfect').length;
  if (perfects === S.stops.length && time <= CONFIG.parTime) return 'S';
  if (score >= 900) return 'A';
  if (score >= 620) return 'B';
  return 'C';
}

function endRun() {
  S.phase = 'over';
  const time = S.t;
  const bonus = Math.max(0, Math.round((CONFIG.parTime - time) * CONFIG.timeBonus));
  const score = S.score + bonus;
  const grade = gradeOf(score, time);

  const bestTime = !best.time || time < best.time;
  const bestScore = score > best.score;
  if (bestTime) best.time = time;
  if (bestScore) best.score = score;
  if (bestTime || bestScore) saveBest();

  const count = (r) => S.ratings.filter((x) => x === r).length;
  elOverlay.classList.remove('hidden');
  elCard.innerHTML =
    '<h2>Round complete</h2>' +
    '<p class="sub">Every box on the list</p>' +
    '<div class="result">' +
      '<div class="grade ' + grade.toLowerCase() + '">' + grade + '</div>' +
      '<div class="tally">' +
        row('Time', time.toFixed(1) + 's', bestTime) +
        row('Perfect', count('perfect')) +
        row('Good', count('good')) +
        row('Messy', count('messy')) +
        row('Score', score, bestScore) +
      '</div>' +
    '</div>' +
    '<button class="btn" type="button" id="againBtn">Run again</button>' +
    '<button class="btn ghost" type="button" id="menuBtn">Back to the depot</button>';
  $('againBtn').addEventListener('click', startRun);
  $('menuBtn').addEventListener('click', showTitle);
  playCue('finish');
  renderStops();
}

function row(label, value, isBest) {
  return '<div><span>' + label + '</span>' +
         (isBest ? '<em class="best">Best</em>' : '') +
         '<b>' + value + '</b></div>';
}


/* ── audio: a small engine and a few cues, kept quiet ─────────────────── */

let audioCtx = null, soundOn = true, engine = null;

const CUES = {
  start:   [{ f: 392, at: 0,    d: 0.10, g: 0.035, t: 'triangle' },
            { f: 587, at: 0.09, d: 0.20, g: 0.032, t: 'triangle' }],
  drop:    [{ f: 660, at: 0,    d: 0.08, g: 0.040, t: 'sine' },
            { f: 880, at: 0.07, d: 0.20, g: 0.034, t: 'sine' }],
  perfect: [{ f: 784, at: 0,    d: 0.09, g: 0.042, t: 'sine' },
            { f: 1047, at: 0.08, d: 0.09, g: 0.040, t: 'sine' },
            { f: 1319, at: 0.16, d: 0.30, g: 0.044, t: 'sine' }],
  bump:    [{ f: 96,  at: 0,    d: 0.13, g: 0.055, t: 'triangle' }],
  finish:  [{ f: 523, at: 0,    d: 0.12, g: 0.040, t: 'sine' },
            { f: 659, at: 0.11, d: 0.12, g: 0.040, t: 'sine' },
            { f: 784, at: 0.22, d: 0.34, g: 0.046, t: 'sine' }],
};

function playCue(name) {
  const cue = CUES[name];
  if (!soundOn || !cue) return;
  try {
    wakeAudio();
    const t0 = audioCtx.currentTime;
    cue.forEach((n) => {
      const osc = audioCtx.createOscillator(), amp = audioCtx.createGain();
      osc.type = n.t; osc.frequency.value = n.f;
      osc.connect(amp).connect(audioCtx.destination);
      const at = t0 + n.at;
      amp.gain.setValueAtTime(0.0001, at);
      amp.gain.linearRampToValueAtTime(n.g, at + 0.012);
      amp.gain.exponentialRampToValueAtTime(0.0001, at + n.d);
      osc.start(at); osc.stop(at + n.d + 0.02);
    });
  } catch (e) { /* sound is a nicety */ }
}

/* The engine is one oscillator whose pitch rides the speed; it only ever
   murmurs, and it is silent when the truck is stopped. */
function engineStep() {
  if (!soundOn || !audioCtx) return;
  try {
    if (!engine) {
      const osc = audioCtx.createOscillator(), amp = audioCtx.createGain();
      const lp = audioCtx.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = 420;
      osc.type = 'sawtooth'; osc.frequency.value = 60;
      amp.gain.value = 0;
      osc.connect(lp).connect(amp).connect(audioCtx.destination);
      osc.start();
      engine = { osc: osc, amp: amp };
    }
    const v = Math.abs(S.truck.speed) / CONFIG.maxSpeed;
    const target = S.phase === 'driving' ? 0.006 + v * 0.017 : 0;
    engine.amp.gain.setTargetAtTime(target, audioCtx.currentTime, 0.08);
    engine.osc.frequency.setTargetAtTime(52 + v * 78, audioCtx.currentTime, 0.06);
  } catch (e) { /* fine */ }
}

function wakeAudio() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === 'suspended') audioCtx.resume();
}
window.addEventListener('pointerdown', () => { try { wakeAudio(); } catch (e) {} });
window.addEventListener('keydown', () => { try { wakeAudio(); } catch (e) {} });

$('soundBtn').addEventListener('click', () => {
  soundOn = !soundOn;
  $('soundBtn').setAttribute('aria-pressed', String(soundOn));
  $('soundBtn').textContent = soundOn ? '♪' : '×';
  if (engine) { try { engine.amp.gain.value = 0; } catch (e) {} }
  if (soundOn) playCue('drop');
});


/* ── input: thumbs first, keys for the desk ───────────────────────────── */

function bindKey(el, prop) {
  const set = (on) => (ev) => {
    if (ev.cancelable) ev.preventDefault();
    input[prop] = on;
    el.classList.toggle('down', on);
  };
  el.addEventListener('pointerdown', (e) => { el.setPointerCapture(e.pointerId); set(true)(e); });
  el.addEventListener('pointerup', set(false));
  el.addEventListener('pointercancel', set(false));
  el.addEventListener('lostpointercapture', set(false));
  el.addEventListener('contextmenu', (e) => e.preventDefault());
}
bindKey($('keyLeft'), 'left');
bindKey($('keyRight'), 'right');
bindKey($('keyGas'), 'gas');
bindKey($('keyBrake'), 'brake');

const KEYS = {
  ArrowLeft: 'left', a: 'left', A: 'left',
  ArrowRight: 'right', d: 'right', D: 'right',
  ArrowUp: 'gas', w: 'gas', W: 'gas',
  ArrowDown: 'brake', s: 'brake', S: 'brake',
};
document.addEventListener('keydown', (e) => {
  const k = KEYS[e.key];
  if (k) { input[k] = true; e.preventDefault(); syncKeyLights(); }
  if (e.key === 'Enter' && S && S.phase !== 'driving') {
    const btn = $('goBtn') || $('againBtn');
    if (btn) btn.click();
  }
});
document.addEventListener('keyup', (e) => {
  const k = KEYS[e.key];
  if (k) { input[k] = false; syncKeyLights(); }
});
window.addEventListener('blur', () => {
  input.left = input.right = input.gas = input.brake = false;
  syncKeyLights();
});

function syncKeyLights() {
  $('keyLeft').classList.toggle('down', input.left);
  $('keyRight').classList.toggle('down', input.right);
  $('keyGas').classList.toggle('down', input.gas);
  $('keyBrake').classList.toggle('down', input.brake);
}


/* ── the loop ─────────────────────────────────────────────────────────── */

let last = performance.now();

function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);   // a long stall never teleports the truck
  last = now;

  if (S && S.phase === 'driving') {
    S.t += dt;
    driveStep(dt);
    deliveryStep(dt);
    $('clockValue').textContent = S.t.toFixed(1);
  }
  if (S) {
    cameraStep(dt);
    draw();
    engineStep();
  }
  requestAnimationFrame(frame);
}


/* ── boot ─────────────────────────────────────────────────────────────── */

S = createRun();
resize();
renderStops();
showTitle();
requestAnimationFrame(frame);
