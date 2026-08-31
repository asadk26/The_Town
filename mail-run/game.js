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

  /* ── the steering stick ──────────────────────────────────────────────
     Travel is read from the element, so the stick can be sized in CSS; the
     feel of it lives here. */
  stick: {
    deadZone:   0.10,   // share of travel around centre that reads as straight
    curve:      1.45,   // >1 puts finer control near the middle
    returnMs:   130,    // how long the knob takes to ease home on release
    grabPad:    1.6,    // how far outside the base a thumb can land and still grab
  },

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

/* ── The segment vocabulary ───────────────────────────────────────────────
   A route is authored as a start pose and a list of pieces, not as a list of
   coordinates. Each piece is one of:

     { go: 420 }              a straight run
     { turn: -55, r: 210 }    an arc: degrees to swing, and the radius of it
     { w: 92 }                on either, the width to have reached by the end

   Expanding a route walks the pieces and samples nodes along them, so the
   road is smooth by construction: no kinks, no guessing at coordinates, and
   a sharper corner is just a smaller radius. Adding a route is a dozen lines.  */

const NODE_STEP = 26;               // world units between sampled nodes on a straight
const ARC_STEP  = 5 * Math.PI / 180; // and radians between them on an arc

function expandRoute(def) {
  const nodes = [];
  let x = def.start.x, y = def.start.y, h = def.start.a * Math.PI / 180, w = def.start.w;
  nodes.push({ x: x, y: y, w: w });

  for (const piece of def.pieces) {
    const wEnd = piece.w != null ? piece.w : w;
    const wStart = w;

    if (piece.go) {
      const steps = Math.max(1, Math.round(piece.go / NODE_STEP));
      for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        nodes.push({ x: x + Math.cos(h) * piece.go * t,
                     y: y + Math.sin(h) * piece.go * t,
                     w: lerp(wStart, wEnd, t) });
      }
      x += Math.cos(h) * piece.go;
      y += Math.sin(h) * piece.go;

    } else if (piece.turn) {
      const sweep = piece.turn * Math.PI / 180;
      const r = piece.r;
      const dir = Math.sign(sweep);
      // centre of the arc, one radius off to the side we are turning towards
      const cx = x + Math.cos(h + dir * Math.PI / 2) * r;
      const cy = y + Math.sin(h + dir * Math.PI / 2) * r;
      let a0 = Math.atan2(y - cy, x - cx);
      const steps = Math.max(2, Math.round(Math.abs(sweep) / ARC_STEP));
      for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        const a = a0 + sweep * t;
        nodes.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r,
                     w: lerp(wStart, wEnd, t) });
      }
      const aEnd = a0 + sweep;
      x = cx + Math.cos(aEnd) * r;
      y = cy + Math.sin(aEnd) * r;
      h += sweep;
    }
    w = wEnd;
  }
  return nodes;
}

/* Total length, and the cumulative length at each node — the currency the
   bay pool and the guidance both work in. */
function measure(nodes) {
  const cum = [0];
  for (let i = 1; i < nodes.length; i++) {
    cum.push(cum[i - 1] + Math.hypot(nodes[i].x - nodes[i - 1].x, nodes[i].y - nodes[i - 1].y));
  }
  return { cum: cum, total: cum[cum.length - 1] };
}

/* The point a given distance along the route, with the road's width and
   heading there. Nodes are dense, so walking by arc length is the only sane
   way to place anything along the road. */
function pointAt(dist) {
  const { cum } = ROAD_M;
  let i = 1;
  while (i < cum.length - 1 && cum[i] < dist) i++;
  const a = ROAD[i - 1], b = ROAD[i];
  const seg = cum[i] - cum[i - 1] || 1;
  const t = clamp((dist - cum[i - 1]) / seg, 0, 1);
  return {
    x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t), w: lerp(a.w, b.w, t),
    angle: Math.atan2(b.y - a.y, b.x - a.x), i: i,
  };
}

/* How much the road bends over the `span` before a node: the number that
   makes an approach demanding rather than merely narrow. */
function curvatureBefore(nodes, cum, i, span) {
  const target = cum[i] - span;
  let j = i;
  while (j > 0 && cum[j] > target) j--;
  if (j >= i - 1) return 0;
  const a0 = Math.atan2(nodes[j + 1].y - nodes[j].y, nodes[j + 1].x - nodes[j].x);
  const a1 = Math.atan2(nodes[i].y - nodes[i - 1].y, nodes[i].x - nodes[i - 1].x);
  return Math.abs(angleDiff(a0, a1));
}


/* ── The routes ──────────────────────────────────────────────────────────
   Five rounds, in the order they unlock. Each is a different kind of driving
   rather than the same driving with different scenery: what changes is the
   width of the street, the radius of the corners, and how much room the bays
   give you. `bay` scales every kerbside bay on that route.  */

const ROUTES = [
  {
    id: 'rookie',
    name: 'Rookie Round',
    where: 'The suburbs',
    blurb: 'Wide streets, easy bends, and bays you could park a bus in.',
    bay: { w: 1.00, h: 1.00 },
    // An open loop: three square-ish corners and out again, so the return
    // leg never runs alongside the one it started on.
    start: { x: 300, y: 3400, a: -90, w: 132 },
    pieces: [
      { go: 1400 },
      { turn: 90, r: 300, w: 128 },
      { go: 1150 },
      { turn: 90, r: 280, w: 122 },
      { go: 1500, w: 116 },
      { turn: 90, r: 260, w: 110 },
      { go: 1050, w: 102 },
      { turn: -46, r: 260, w: 96 },
      { go: 600, w: 92 },
    ],
  },
  {
    id: 'winding',
    name: 'Winding Neighbourhood',
    where: 'Off the main road',
    blurb: 'Bend after bend. The straights are short and the kerbs come quickly.',
    bay: { w: 0.90, h: 0.94 },
    start: { x: 420, y: 3200, a: -90, w: 116 },
    pieces: [
      { go: 660 },
      { turn: -46, r: 205 }, { go: 340 }, { turn: 52, r: 195, w: 110 },
      { go: 420 },
      { turn: 58, r: 190 }, { go: 300 }, { turn: -54, r: 180, w: 104 },
      { go: 460 },
      { turn: -50, r: 200 }, { go: 340 }, { turn: 56, r: 180, w: 100 },
      { go: 400 },
      { turn: 62, r: 175 }, { go: 320 }, { turn: -58, r: 170, w: 96 },
      { go: 440 },
      { turn: -52, r: 190 }, { go: 360 }, { turn: 48, r: 180, w: 92 },
      { go: 420 },
      { turn: 54, r: 175 }, { go: 320 }, { turn: -50, r: 185, w: 88 },
      { go: 480 },
    ],
  },
  {
    id: 'downtown',
    name: 'Town Centre',
    where: 'Narrow streets',
    blurb: 'Tight lanes, square corners, and a kerb waiting just past each one.',
    bay: { w: 0.80, h: 0.88 },
    // Square corners, but never so tight that a clean line has to leave the
    // tarmac: the radii sit just above what the truck can hold at pace.
    start: { x: 500, y: 2900, a: -90, w: 100 },
    pieces: [
      { go: 560 },
      { turn: 84, r: 150, w: 96 }, { go: 500 },
      { turn: -86, r: 142 }, { go: 420, w: 92 },
      { turn: -88, r: 140 }, { go: 560 },
      { turn: 90, r: 134, w: 88 }, { go: 460 },
      { turn: 86, r: 138 }, { go: 500, w: 86 },
      { turn: -84, r: 132 }, { go: 440 },
      { turn: -90, r: 130, w: 84 }, { go: 520 },
      { turn: 88, r: 134 }, { go: 460, w: 82 },
      { turn: 84, r: 130 }, { go: 420 },
      { turn: -86, r: 132, w: 80 }, { go: 440 },
    ],
  },
  {
    id: 'longhaul',
    name: 'Long Haul',
    where: 'The edge of town',
    blurb: 'Open road and real speed, so every bay is a braking decision.',
    bay: { w: 0.92, h: 0.92 },
    start: { x: 400, y: 3800, a: -90, w: 124 },
    pieces: [
      { go: 1500 },
      { turn: 36, r: 420 },
      { go: 1400, w: 118 },
      { turn: 54, r: 380 },
      { go: 1200, w: 110 },
      { turn: 62, r: 320 },
      { go: 1300, w: 102 },
      { turn: 48, r: 300 },
      { go: 900, w: 94 },
      { turn: -40, r: 280 },
      { go: 700 },
    ],
  },
  {
    id: 'technical',
    name: 'The Technical',
    where: 'The old quarter',
    blurb: 'Short streets, constant direction changes, and the tightest bays on the round.',
    bay: { w: 0.74, h: 0.84 },
    start: { x: 520, y: 2600, a: -90, w: 92 },
    pieces: [
      { go: 380 },
      { turn: -74, r: 126 }, { go: 280 }, { turn: 80, r: 120, w: 88 },
      { go: 260 }, { turn: 76, r: 122 }, { go: 300 }, { turn: -82, r: 118, w: 86 },
      { go: 280 }, { turn: -78, r: 124 }, { go: 340 }, { turn: 84, r: 116, w: 84 },
      { go: 300 }, { turn: 80, r: 120 }, { go: 280 }, { turn: -76, r: 122, w: 82 },
      { go: 340 }, { turn: -84, r: 118 }, { go: 300 }, { turn: 78, r: 124, w: 80 },
      { go: 360 }, { turn: 74, r: 128 }, { go: 300 }, { turn: -80, r: 120, w: 78 },
      { go: 320 }, { turn: -76, r: 124 }, { go: 420, w: 76 },
    ],
  },
];

const ROUTE_BY_ID = {};
ROUTES.forEach((r) => { ROUTE_BY_ID[r.id] = r; });

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

/* Where a bay sits: beside its node, squared to the road, tucked against the
   kerb from the inside. */
function bayAt(i, side, w, h) {
  const a = ROAD[Math.max(0, i - 1)], b = ROAD[Math.min(ROAD.length - 1, i + 1)];
  const angle = Math.atan2(b.y - a.y, b.x - a.x);
  const node = ROAD[i];
  const off = node.w / 2 - h / 2 + 5;
  return {
    x: node.x + Math.cos(angle + Math.PI / 2) * off * side,
    y: node.y + Math.sin(angle + Math.PI / 2) * off * side,
    angle: angle, w: w, h: h, side: side, node: i,
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

/* ── Dealing a round ─────────────────────────────────────────────────────
   Every candidate kerb on the route is checked before it can be used, and
   five are drawn from the survivors: one per fifth of the route, so they are
   spaced; never all on the same side; and weighted so the demanding ones
   fall late. That is what makes replaying the same route worth doing.  */

const STOPS_PER_ROUND = 5;
const BAY_RULES = {
  firstAt: 0.10,     // no bay before this much of the route is behind you
  lastAt:  0.94,
  everyAt: 0.035,    // how finely the route is sampled for candidates
  minGap:  0.11,     // of route length, between chosen bays
};

/* A bay is only offered if the truck can actually get into it and there is
   nothing solid in the way. */
function bayIsValid(bay) {
  const n = nearestOnRoad(bay.x, bay.y);
  if (Math.sqrt(n.d2) > n.w / 2) return false;           // its middle is off the tarmac
  const reach = Math.hypot(bay.w, bay.h) / 2;
  for (const o of SOLIDS) {
    const d = Math.hypot(o.x - bay.x, o.y - bay.y);
    const size = o.kind === 'circle' ? o.r : Math.hypot(o.w, o.h) / 2;
    if (d < reach + size) return false;                  // something is standing in it
  }
  return true;
}

/* Every kerb on the route worth considering, with how demanding it is. */
function bayPool(route) {
  const { cum, total } = ROAD_M;
  const out = [];
  for (let f = BAY_RULES.firstAt; f <= BAY_RULES.lastAt; f += BAY_RULES.everyAt) {
    const target = f * total;
    let i = 1;
    while (i < cum.length - 1 && cum[i] < target) i++;
    const node = ROAD[i];
    const bend = curvatureBefore(ROAD, cum, i, 230);
    for (const side of [-1, 1]) {
      // the bay scales with the street it is on, and with the route's own factor
      const w = clamp(node.w * 1.16, 84, 156) * route.bay.w;
      const h = clamp(node.w * 0.50, 42, 64) * route.bay.h;
      const bay = bayAt(i, side, w, h);
      bay.at = f;
      // narrow street, tight bay, and a bend just before it all make it harder
      bay.demand = (1 - clamp(node.w / 140, 0.3, 1)) * 1.2 +
                   Math.min(1, bend / 1.1) * 1.6 +
                   (1 - clamp(h / 60, 0.4, 1)) * 0.8;
      out.push(bay);
    }
  }
  return out;
}

/* Draw five, spaced along the route, with the demanding ones late. */
function chooseBays(route) {
  const pool = bayPool(route).filter(bayIsValid);
  if (pool.length < STOPS_PER_ROUND) return null;

  for (let attempt = 0; attempt < 40; attempt++) {
    const picked = [];
    for (let k = 0; k < STOPS_PER_ROUND; k++) {
      const lo = BAY_RULES.firstAt + (BAY_RULES.lastAt - BAY_RULES.firstAt) * (k / STOPS_PER_ROUND);
      const hi = BAY_RULES.firstAt + (BAY_RULES.lastAt - BAY_RULES.firstAt) * ((k + 1) / STOPS_PER_ROUND);
      let window = pool.filter((b) => b.at >= lo && b.at < hi &&
        picked.every((q) => Math.abs(q.at - b.at) >= BAY_RULES.minGap));
      if (!window.length) { window = pool.filter((b) => b.at >= lo && b.at < hi); }
      if (!window.length) break;

      // late windows lean towards the demanding end of what is available
      const bias = k / (STOPS_PER_ROUND - 1);
      window = window.slice().sort((a, b) => a.demand - b.demand);
      const idx = Math.floor(Math.pow(rnd(), 1 + bias * 1.6) * window.length);
      picked.push(window[Math.min(window.length - 1, bias > 0.5 ? window.length - 1 - idx : idx)]);
    }
    if (picked.length !== STOPS_PER_ROUND) continue;

    // never a whole round down one kerb, and never two on top of each other
    const sides = new Set(picked.map((b) => b.side));
    if (sides.size < 2) continue;
    let tooClose = false;
    for (let a = 0; a < picked.length && !tooClose; a++) {
      for (let b = a + 1; b < picked.length; b++) {
        if (Math.hypot(picked[a].x - picked[b].x, picked[a].y - picked[b].y) < 200) tooClose = true;
      }
    }
    if (tooClose) continue;

    picked.sort((a, b) => a.at - b.at);
    picked.forEach((b, i) => { b.index = i; });
    return picked;
  }
  return null;
}

/* Load a route and deal a round on it. */
function loadRound(routeId, runSeed) {
  const route = ROUTE_BY_ID[routeId] || ROUTES[0];
  reseed(runSeed);
  ROAD = expandRoute(route);
  ROAD_M = measure(ROAD);
  PROPS = [];
  SOLIDS = [];

  // dress the town first so bay validation can see what is standing where,
  // then dress it again with the chosen bays kept clear
  buildTown([]);
  let bays = chooseBays(route);
  if (!bays) { reseed(runSeed + 7); buildTown([]); bays = chooseBays(route); }
  if (!bays) bays = bayPool(route).filter(bayIsValid).slice(0, STOPS_PER_ROUND);
  buildTown(bays);

  return { route: route, bays: bays };
}

/* ── the town ────────────────────────────────────────────────────────────
   Houses, trees, hedges and the odd park bench, scattered along the road
   once at boot. Deterministic, so the town is the same town every run. */

/* One stream per run, seeded when the round is dealt, so a round is
   reproducible and the town it draws is the same town all the way through. */
let seed = 20260831;
function reseed(n) { seed = (n >>> 0) % 2147483647 || 12345; }
function rnd() { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; }
const pickFrom = (list) => list[Math.floor(rnd() * list.length)];

let ROAD = [];      // the centreline of the round currently loaded
let ROAD_M = { cum: [0], total: 0 };
let PROPS = [];     // drawn behind the truck
let SOLIDS = [];    // and these stop it

function addHouse(x, y, angle, colorName, w, h) {
  const c = HOUSE_COLORS[colorName] || HOUSE_COLORS.cream;
  PROPS.push({ kind: 'house', x: x, y: y, a: angle, w: w, h: h, wall: c.wall, roof: c.roof });
  SOLIDS.push({ kind: 'rect', x: x, y: y, a: angle, w: w, h: h });
}
function addTree(x, y, r) {
  PROPS.push({ kind: 'tree', x: x, y: y, r: r, tone: rnd() });
  SOLIDS.push({ kind: 'circle', x: x, y: y, r: r * 0.55 });
}

/* Is this spot clear of every part of the road, not just the stretch it was
   measured from? A route that doubles back would otherwise drop a house on a
   street it passes later. */
function clearOfRoad(x, y, margin) {
  const n = nearestOnRoad(x, y);
  return Math.sqrt(n.d2) > n.w / 2 + WALK_WIDTH + margin;
}

/* Nothing may stand in a bay. Measured from where the prop actually ends up:
   a tight corner can swing a kerbside prop right round it, so far along the
   road from a bay and yet a few units from its middle. */
function clearOfBays(bays, x, y, size) {
  for (const b of bays) {
    if (Math.hypot(b.x - x, b.y - y) < Math.hypot(b.w, b.h) / 2 + size + 14) return false;
  }
  return true;
}

function buildTown(bays) {
  PROPS = [];
  SOLIDS = [];
  const total = ROAD_M.total;
  const names = ['coral', 'mustard', 'teal', 'cream', 'plum', 'sage', 'sky'];

  for (let side = -1; side <= 1; side += 2) {
    let along = 70;
    while (along < total - 70) {
      const at = pointAt(along);
      const nx = Math.cos(at.angle + Math.PI / 2), ny = Math.sin(at.angle + Math.PI / 2);
      const roll = rnd();

      // keep the kerb clear where a bay and its mailbox will be
      const nearBay = bays.some((b) => Math.hypot(at.x - b.x, at.y - b.y) < b.w / 2 + 120);
      if (nearBay) { along += 70; continue; }

      if (roll < 0.42) {
        const hw = 86 + rnd() * 46, hh = 74 + rnd() * 30;
        const off = at.w / 2 + WALK_WIDTH + 26 + Math.max(hw, hh) / 2 + rnd() * 34;
        const px = at.x + nx * off * side, py = at.y + ny * off * side;
        if (clearOfRoad(px, py, Math.max(hw, hh) / 2 + 10) &&
            clearOfBays(bays, px, py, Math.hypot(hw, hh) / 2)) {
          addHouse(px, py, at.angle, names[Math.floor(rnd() * names.length)], hw, hh);
        }
        along += 150 + rnd() * 80;
      } else if (roll < 0.78) {
        const r = 17 + rnd() * 9;
        const off = at.w / 2 + WALK_WIDTH + 20 + r + rnd() * 18;
        const px = at.x + nx * off * side, py = at.y + ny * off * side;
        if (clearOfRoad(px, py, r + 5) && clearOfBays(bays, px, py, r)) addTree(px, py, r);
        along += 80 + rnd() * 60;
      } else {
        // a patch of park: flowers, no collision
        const r = 40 + rnd() * 46;
        const off = at.w / 2 + WALK_WIDTH + 30 + r * 0.6 + rnd() * 70;
        const px = at.x + nx * off * side, py = at.y + ny * off * side;
        if (clearOfRoad(px, py, 6)) PROPS.push({ kind: 'park', x: px, y: py, r: r, tone: rnd() });
        along += 120 + rnd() * 70;
      }
    }
  }
}


/* ==========================================================================
   4. STATE
   ========================================================================== */

let S = null;
let best = loadBest();

let chosenRoute = null;     // route id the player has selected, or 'random'

function createRun(routeId, runSeed) {
  const dealt = loadRound(routeId, runSeed);
  const start = ROAD[0], next = ROAD[1];
  return {
    phase: 'title',                 // 'title' | 'driving' | 'over'
    route: dealt.route,
    seed: runSeed,
    t: 0,                           // seconds elapsed on the round
    truck: {
      x: start.x, y: start.y,
      angle: Math.atan2(next.y - start.y, next.x - start.x),
      speed: 0,
      steer: 0,
      lean: 0, dip: 0, bob: 0,      // presentation only
    },
    cam: { x: start.x, y: start.y },
    stops: dealt.bays,
    at: 0,                          // which stop is live
    hold: 0,                        // seconds parked in the live zone
    ratings: [],                    // 'perfect' | 'good' | 'messy'
    score: 0,
    streak: 0, bestStreak: 0,
    bumps: 0,
    offRoad: 0,                     // seconds spent off the tarmac
  };
}

/* ── What carries between runs ────────────────────────────────────────────
   Which routes are open, and the best round on each. Nothing else: no
   currency, no levels, no connection to anything outside Mail Run. */

function blankSave() {
  return { unlocked: 1, records: {}, random: null };
}

function loadBest() {
  const blank = blankSave();
  try {
    const raw = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
    if (raw && typeof raw === 'object') {
      const n = parseInt(raw.unlocked, 10);
      blank.unlocked = clamp(Number.isFinite(n) ? n : 1, 1, ROUTES.length);
      if (raw.records && typeof raw.records === 'object') {
        for (const id of Object.keys(raw.records)) {
          if (!ROUTE_BY_ID[id]) continue;                 // a route that no longer exists
          const r = raw.records[id] || {};
          blank.records[id] = {
            time: Number(r.time) || 0,
            score: Number(r.score) || 0,
            perfects: Number(r.perfects) || 0,
            grade: typeof r.grade === 'string' ? r.grade : '',
          };
        }
      }
      if (raw.random && typeof raw.random === 'object') {
        blank.random = { score: Number(raw.random.score) || 0, time: Number(raw.random.time) || 0 };
      }
    }
  } catch (e) { /* no memory is fine */ }
  return blank;
}
function saveBest() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(best)); } catch (e) { /* fine */ }
}

const unlockedRoutes = () => ROUTES.slice(0, best.unlocked);
const isUnlocked = (id) => unlockedRoutes().some((r) => r.id === id);

/* An A or an S opens the next round along. */
function creditUnlock(routeId, grade) {
  const i = ROUTES.findIndex((r) => r.id === routeId);
  if (i < 0 || (grade !== 'A' && grade !== 'S')) return null;
  if (i !== best.unlocked - 1 || best.unlocked >= ROUTES.length) return null;
  best.unlocked++;
  return ROUTES[best.unlocked - 1];
}

/* Records are per route, each metric on its own: a run can beat the clock
   without beating the score. */
function creditRecords(routeId, run) {
  const r = best.records[routeId] || (best.records[routeId] = { time: 0, score: 0, perfects: 0, grade: '' });
  const GRADES = ['', 'C', 'B', 'A', 'S'];
  const won = {
    time: !r.time || run.time < r.time,
    score: run.score > r.score,
    perfects: run.perfects > r.perfects,
    grade: GRADES.indexOf(run.grade) > GRADES.indexOf(r.grade),
  };
  if (won.time) r.time = run.time;
  if (won.score) r.score = run.score;
  if (won.perfects) r.perfects = run.perfects;
  if (won.grade) r.grade = run.grade;
  return won;
}

/* ==========================================================================
   5. DRIVING
   ========================================================================== */

/* `steer` is the analog axis, -1 (full left) to +1 (full right). The stick
   writes it directly; the keys and the fallback buttons peg it to full lock.
   Everything downstream only ever reads `steer`, so the vehicle model is the
   same one whichever control is driving it. */
const input = { steer: 0, left: false, right: false, gas: false, brake: false };

/* Buttons and keys are digital, so they set their own axis and the stick
   sets its. Whichever moved last wins, which is what a player expects when
   they put a thumb down mid-keypress. */
let keySteer = 0, stickSteer = 0;
function pushSteer() {
  input.steer = clamp(stickSteer !== 0 ? stickSteer : keySteer, -1, 1);
}

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
  const want = input.steer;
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
  const open = unlockedRoutes();
  if (!chosenRoute || (chosenRoute !== 'random' && !isUnlocked(chosenRoute))) {
    chosenRoute = open[open.length - 1].id;
  }
  if (chosenRoute === 'random' && open.length < 2) chosenRoute = open[0].id;

  const chips = ROUTES.map((r, i) => {
    const isOpen = i < best.unlocked;
    const rec = best.records[r.id];
    return '<button class="chip' + (isOpen ? '' : ' locked') +
           (chosenRoute === r.id ? ' on' : '') + '" type="button" data-route="' + r.id + '"' +
           (isOpen ? '' : ' disabled') + '>' +
           '<b>' + r.name + '</b><span>' + (isOpen ? r.where : 'Locked') + '</span>' +
           (isOpen && rec && rec.grade ? '<em>' + rec.grade + '</em>' : '') +
           '</button>';
  }).join('') +
  (open.length >= 2
    ? '<button class="chip wild' + (chosenRoute === 'random' ? ' on' : '') +
      '" type="button" data-route="random"><b>Random Run</b>' +
      '<span>Any open round</span>' +
      (best.random && best.random.score ? '<em>' + best.random.score + '</em>' : '') + '</button>'
    : '');

  /* Two columns on a landscape screen: the round to drive has to be reachable
     without scrolling past the instructions every single time. */
  elCard.className = 'card depot';
  elCard.innerHTML =
    '<div class="depot-cols">' +
      '<div>' +
        '<h1>Mail <b>Run</b></h1>' +
        '<p class="sub">One round, five boxes</p>' +
        '<ul class="how">' +
          '<li><i>1</i><span>Steer with the stick; gas and brake on the right.</span></li>' +
          '<li><i>2</i><span>The next kerb glows, and an arrow points off screen.</span></li>' +
          '<li><i>3</i><span>Pull in and hold still for a moment to post it.</span></li>' +
          '<li><i>4</i><span>Square and centred is a <b>Perfect</b>. Overshoot? Reverse.</span></li>' +
        '</ul>' +
      '</div>' +
      '<div class="depot-pick">' +
        '<p class="sub">Choose a round</p>' +
        '<div class="chips" id="routeChips">' + chips + '</div>' +
        '<p class="route-note" id="routeNote"></p>' +
        '<button class="btn" type="button" id="goBtn">Start the round</button>' +
      '</div>' +
    '</div>';

  elCard.querySelectorAll('.chip').forEach((b) => b.addEventListener('click', () => {
    chosenRoute = b.dataset.route;
    showTitle();
  }));
  $('goBtn').addEventListener('click', () => startRun());
  renderRouteNote();
}

function renderRouteNote() {
  const el = $('routeNote');
  if (!el) return;
  if (chosenRoute === 'random') {
    const r = best.random;
    el.innerHTML = 'One of your open rounds, with the kerbs drawn fresh.' +
      (r && r.score ? ' <b>Best ' + r.score + ' pts in ' + r.time.toFixed(1) + 's</b>' : '');
    return;
  }
  const route = ROUTE_BY_ID[chosenRoute];
  const rec = best.records[chosenRoute];
  const next = ROUTES[best.unlocked];
  el.innerHTML = route.blurb +
    (rec && rec.time
      ? ' <b>Best ' + rec.time.toFixed(1) + 's &middot; ' + rec.score + ' pts &middot; ' +
        rec.perfects + ' perfect</b>'
      : '') +
    (next && ROUTES[best.unlocked - 1].id === chosenRoute
      ? '<br><span class="unlock-hint">An A on this round opens ' + next.name + '.</span>'
      : '');
}

function startRun() {
  const open = unlockedRoutes();
  // Random Run only ever deals a round the player has actually opened.
  const wasRandom = chosenRoute === 'random';
  const id = wasRandom
    ? open[Math.floor(Math.random() * open.length)].id
    : (isUnlocked(chosenRoute) ? chosenRoute : open[0].id);
  S = createRun(id, (Math.random() * 2147483647) | 0);
  S.wasRandom = wasRandom;
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
  const perfects = S.ratings.filter((x) => x === 'perfect').length;

  const won = creditRecords(S.route.id, { time: time, score: score, perfects: perfects, grade: grade });
  const opened = creditUnlock(S.route.id, grade);
  let randomWon = false;
  if (S.wasRandom && (!best.random || score > best.random.score)) {
    best.random = { score: score, time: time };
    randomWon = true;
  }
  saveBest();

  const count = (r) => S.ratings.filter((x) => x === r).length;
  elOverlay.classList.remove('hidden');
  elCard.className = 'card';
  elCard.innerHTML =
    '<h2>Round complete</h2>' +
    '<p class="sub">' + S.route.name + (S.wasRandom ? ' &middot; Random Run' : '') + '</p>' +
    '<div class="result">' +
      '<div class="grade ' + grade.toLowerCase() + '">' + grade + '</div>' +
      '<div class="tally">' +
        row('Time', time.toFixed(1) + 's', won.time) +
        row('Perfect', perfects, won.perfects) +
        row('Good', count('good')) +
        row('Messy', count('messy')) +
        row('Score', score, won.score || randomWon) +
      '</div>' +
    '</div>' +
    (opened
      ? '<p class="opened"><b>' + opened.name + '</b> is open &mdash; ' + opened.blurb + '</p>'
      : '') +
    '<button class="btn" type="button" id="againBtn">Run again</button>' +
    '<button class="btn ghost" type="button" id="menuBtn">Back to the depot</button>';
  $('againBtn').addEventListener('click', () => startRun());
  $('menuBtn').addEventListener('click', showTitle);
  playCue(opened ? 'unlock' : 'finish');
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
  unlock:  [{ f: 523, at: 0,    d: 0.11, g: 0.040, t: 'sine' },
            { f: 659, at: 0.10, d: 0.11, g: 0.040, t: 'sine' },
            { f: 784, at: 0.20, d: 0.11, g: 0.042, t: 'sine' },
            { f: 1047, at: 0.30, d: 0.40, g: 0.046, t: 'sine' }],
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
    if (prop === 'left' || prop === 'right') syncKeyLights();
  };
  el.addEventListener('pointerdown', (e) => { el.setPointerCapture(e.pointerId); set(true)(e); });
  el.addEventListener('pointerup', set(false));
  el.addEventListener('pointercancel', set(false));
  el.addEventListener('lostpointercapture', set(false));
  el.addEventListener('contextmenu', (e) => e.preventDefault());
}
/* The left/right buttons are kept as a fallback and for tests; the shipped
   mobile UI uses the stick, and they are simply absent from the markup. */
if ($('keyLeft')) bindKey($('keyLeft'), 'left');
if ($('keyRight')) bindKey($('keyRight'), 'right');
bindKey($('keyGas'), 'gas');
bindKey($('keyBrake'), 'brake');

/* ── the stick ────────────────────────────────────────────────────────
   One axis. Where the thumb is, relative to the base's middle, becomes the
   steering value; a dead zone keeps "roughly straight" actually straight, and
   the curve gives finer control near the centre than at the lock. */

const elStick = $('stick');
const elKnob = $('stickKnob');
const elZone = $('stickZone');
let stickPointer = null;

function stickTravel() {
  if (!elStick || !elKnob) return 1;
  return Math.max(1, (elStick.getBoundingClientRect().width -
                      elKnob.getBoundingClientRect().width) / 2);
}

/* Move the knob and report the axis. `v` is -1..1 already shaped. */
function setKnob(v) {
  if (!elKnob) return;
  elKnob.style.transform = 'translateX(' + (v * stickTravel()) + 'px)';
  elKnob.setAttribute('aria-valuenow', v.toFixed(2));
}

function stickAxisFrom(clientX) {
  const box = elStick.getBoundingClientRect();
  const travel = stickTravel();
  const raw = clamp((clientX - (box.left + box.width / 2)) / travel, -1, 1);
  const dz = CONFIG.stick.deadZone;
  const mag = Math.abs(raw);
  if (mag <= dz) return 0;
  const shaped = Math.pow((mag - dz) / (1 - dz), CONFIG.stick.curve);
  return Math.sign(raw) * shaped;
}

function grabStick(e) {
  if (!elStick || stickPointer !== null) return;
  stickPointer = e.pointerId;
  elStick.classList.add('held');
  try { elZone.setPointerCapture(e.pointerId); } catch (err) { /* mouse is fine without */ }
  moveStick(e);
  if (e.cancelable) e.preventDefault();
}
function moveStick(e) {
  if (stickPointer !== e.pointerId) return;
  stickSteer = stickAxisFrom(e.clientX);
  setKnob(stickSteer);
  pushSteer();
  if (e.cancelable) e.preventDefault();
}
function dropStick(e) {
  if (e && stickPointer !== e.pointerId) return;
  releaseStick();
}
function releaseStick() {
  stickPointer = null;
  stickSteer = 0;
  pushSteer();
  if (elStick) elStick.classList.remove('held');
  setKnob(keySteer);          // if a key is held, the knob rests there instead
}

if (elZone) {
  elZone.style.setProperty('--stick-return', CONFIG.stick.returnMs + 'ms');
  elZone.addEventListener('pointerdown', grabStick);
  elZone.addEventListener('pointermove', moveStick);
  elZone.addEventListener('pointerup', dropStick);
  elZone.addEventListener('pointercancel', dropStick);
  elZone.addEventListener('lostpointercapture', dropStick);
  elZone.addEventListener('contextmenu', (e) => e.preventDefault());
}

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
  keySteer = stickSteer = 0;
  releaseStick();
  pushSteer();
  syncKeyLights();
});

function syncKeyLights() {
  keySteer = (input.left ? -1 : 0) + (input.right ? 1 : 0);
  pushSteer();
  const l = $('keyLeft'), r = $('keyRight');
  if (l) l.classList.toggle('down', input.left);
  if (r) r.classList.toggle('down', input.right);
  $('keyGas').classList.toggle('down', input.gas);
  $('keyBrake').classList.toggle('down', input.brake);
  // the knob mirrors the keys, so the desk and the thumb agree
  if (stickSteer === 0) setKnob(keySteer);
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

S = createRun(unlockedRoutes()[0].id, (Math.random() * 2147483647) | 0);
resize();
renderStops();
setKnob(0);
showTitle();
requestAnimationFrame(frame);
