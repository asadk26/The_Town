'use strict';

/* ==========================================================================
   ORDER UP — take the order, walk to the pass, rebuild it from memory.

   1. CONTENT — the menu, drawn as small inline SVGs
   2. CONFIG  — every tunable number
   3. STATE   — the run
   4. LOGIC   — rules
   5. RENDER  — the diner
   6. AUDIO + INPUT
   ========================================================================== */


/* ==========================================================================
   1. CONTENT
   ========================================================================== */

/* Each item is a small flat illustration: a few shapes, readable at 24px.
   `said` is how a customer names it out loud. */
const MENU = [
  { id: 'burger', name: 'Burger', said: 'a burger', many: 'burgers', kind: 'food', art:
    '<svg viewBox="0 0 40 40"><path d="M6 15c0-6 6-9 14-9s14 3 14 9z" fill="#d99a4e"/>' +
    '<circle cx="15" cy="11" r="1" fill="#f6e3c0"/><circle cx="22" cy="9" r="1" fill="#f6e3c0"/>' +
    '<circle cx="27" cy="12" r="1" fill="#f6e3c0"/>' +
    '<rect x="5" y="15" width="30" height="4" rx="2" fill="#7bb661"/>' +
    '<rect x="5" y="19" width="30" height="5" rx="2" fill="#8a5a34"/>' +
    '<rect x="6" y="24" width="28" height="4" rx="2" fill="#efb034"/>' +
    '<path d="M6 28h28c0 4-6 6-14 6S6 32 6 28z" fill="#c98b42"/></svg>' },

  { id: 'fries', name: 'Fries', said: 'fries', many: 'orders of fries', kind: 'food', art:
    '<svg viewBox="0 0 40 40"><rect x="13" y="6" width="4" height="17" rx="1.6" fill="#f2c65c"/>' +
    '<rect x="19" y="3" width="4" height="20" rx="1.6" fill="#f7d477"/>' +
    '<rect x="25" y="8" width="4" height="15" rx="1.6" fill="#f2c65c"/>' +
    '<path d="M9 20h22l-2.5 15a2 2 0 0 1-2 1.7H13.5a2 2 0 0 1-2-1.7z" fill="#d9483f"/>' +
    '<rect x="14" y="24" width="12" height="3" rx="1.5" fill="#f7ead1" opacity=".85"/></svg>' },

  { id: 'pizza', name: 'Pizza', said: 'a slice of pizza', many: 'slices of pizza', kind: 'food', art:
    '<svg viewBox="0 0 40 40"><path d="M20 4 35 33a2 2 0 0 1-1.8 3H6.8A2 2 0 0 1 5 33z" fill="#f2c65c"/>' +
    '<path d="M20 9 31.5 32h-23z" fill="#e2574c"/>' +
    '<circle cx="20" cy="20" r="2.6" fill="#a8332c"/><circle cx="14.5" cy="27" r="2.2" fill="#a8332c"/>' +
    '<circle cx="25.5" cy="27" r="2.2" fill="#a8332c"/></svg>' },

  { id: 'salad', name: 'Salad', said: 'a salad', many: 'salads', kind: 'food', art:
    '<svg viewBox="0 0 40 40"><circle cx="14" cy="18" r="6" fill="#7bb661"/>' +
    '<circle cx="24" cy="16" r="6.5" fill="#8ec973"/><circle cx="20" cy="21" r="5.5" fill="#69a552"/>' +
    '<circle cx="27" cy="22" r="3" fill="#d9483f"/>' +
    '<path d="M5 21h30c0 8-6.5 13-15 13S5 29 5 21z" fill="#e6d5b6"/>' +
    '<path d="M5 21h30c0 2-.4 3.6-1 5H6c-.6-1.4-1-3-1-5z" fill="#cfd9db"/></svg>' },

  { id: 'hotdog', name: 'Hot Dog', said: 'a hot dog', many: 'hot dogs', kind: 'food', art:
    '<svg viewBox="0 0 40 40"><rect x="3" y="16" width="34" height="12" rx="6" fill="#d99a4e"/>' +
    '<rect x="6" y="14" width="28" height="9" rx="4.5" fill="#b5563d"/>' +
    '<path d="M9 18c3 3 5-1 8 2s5-1 8 2 4 0 6-1" stroke="#efb034" stroke-width="2.4" fill="none" stroke-linecap="round"/>' +
    '<rect x="3" y="23" width="34" height="6" rx="3" fill="#c98b42"/></svg>' },

  { id: 'chicken', name: 'Chicken', said: 'fried chicken', many: 'baskets of fried chicken', kind: 'food', art:
    '<svg viewBox="0 0 40 40"><rect x="6" y="24" width="17" height="6" rx="3" transform="rotate(-45 14.5 27)" fill="#f7ead1"/>' +
    '<circle cx="8.5" cy="32" r="3.7" fill="#f7ead1"/><circle cx="12" cy="35.5" r="3.3" fill="#f7ead1"/>' +
    '<path d="M33.5 7.5c4.5 4.5 3.5 12-1.5 17s-12.5 6-16.5 2-1.5-8.5 3-13 10.5-10.5 15-6z" fill="#b8722a"/>' +
    '<path d="M31 10c3 3 2 8.5-2 12.5s-9.5 5-12.5 2z" fill="#dda053"/>' +
    '<circle cx="24" cy="12.5" r="1.6" fill="#8a5119"/><circle cx="28.5" cy="18.5" r="1.4" fill="#8a5119"/>' +
    '<circle cx="20" cy="19.5" r="1.3" fill="#8a5119"/></svg>' },

  { id: 'cola', name: 'Cola', said: 'a cola', many: 'colas', kind: 'drink', art:
    '<svg viewBox="0 0 40 40"><path d="M25 4l-3 5" stroke="#cfd9db" stroke-width="2.6" stroke-linecap="round"/>' +
    '<path d="M11 12h18l-2.4 22a2 2 0 0 1-2 1.8h-9.2a2 2 0 0 1-2-1.8z" fill="#8a5a34"/>' +
    '<path d="M11 12h18l-.6 5.5H11.6z" fill="#d9483f"/>' +
    '<rect x="10" y="9" width="20" height="4" rx="2" fill="#cfd9db"/></svg>' },

  { id: 'water', name: 'Water', said: 'a water', many: 'waters', kind: 'drink', art:
    '<svg viewBox="0 0 40 40"><path d="M11 8h18l-2.2 26a2 2 0 0 1-2 1.8h-9.6a2 2 0 0 1-2-1.8z" fill="#cfe6ea" opacity=".55"/>' +
    '<path d="M12.4 18h15.2l-1.6 16a2 2 0 0 1-2 1.8h-8a2 2 0 0 1-2-1.8z" fill="#7fc2d4"/>' +
    '<path d="M12.2 18h15.6l-.2 2.4c-3 1.6-5 .2-7.6.2s-4.4 1.2-7.6-.4z" fill="#a6d8e4"/>' +
    '<rect x="10" y="6" width="20" height="3" rx="1.5" fill="#e9f4f6"/></svg>' },

  { id: 'lemonade', name: 'Lemonade', said: 'a lemonade', many: 'lemonades', kind: 'drink', art:
    '<svg viewBox="0 0 40 40"><path d="M11 8h18l-2.2 26a2 2 0 0 1-2 1.8h-9.6a2 2 0 0 1-2-1.8z" fill="#fdf0c0" opacity=".6"/>' +
    '<path d="M12.4 16h15.2l-1.6 18a2 2 0 0 1-2 1.8h-8a2 2 0 0 1-2-1.8z" fill="#f2d95c"/>' +
    '<circle cx="28" cy="13" r="6" fill="#f7e27a"/><path d="M28 7a6 6 0 0 1 0 12z" fill="#efb034"/>' +
    '<rect x="10" y="6" width="20" height="3" rx="1.5" fill="#fff8e2"/></svg>' },

  { id: 'coffee', name: 'Coffee', said: 'a coffee', many: 'coffees', kind: 'drink', art:
    '<svg viewBox="0 0 40 40"><path d="M17 4c-2 2 1 3-1 5M23 5c-2 2 1 3-1 5" stroke="#cfd9db" stroke-width="1.8" fill="none" stroke-linecap="round" opacity=".8"/>' +
    '<path d="M8 14h20v11a8 8 0 0 1-8 8h-4a8 8 0 0 1-8-8z" fill="#f7ead1"/>' +
    '<path d="M9.5 15.5h17v3h-17z" fill="#6b4327"/>' +
    '<path d="M28 17h3a4.5 4.5 0 0 1 0 9h-3" stroke="#e6d5b6" stroke-width="3" fill="none"/>' +
    '<rect x="6" y="33" width="24" height="3" rx="1.5" fill="#cfd9db"/></svg>' },

  { id: 'cookie', name: 'Cookie', said: 'a cookie', many: 'cookies', kind: 'sweet', art:
    '<svg viewBox="0 0 40 40"><circle cx="20" cy="21" r="14" fill="#d99a4e"/>' +
    '<circle cx="20" cy="21" r="14" fill="none" stroke="#c1863d" stroke-width="1.5"/>' +
    '<circle cx="15" cy="16" r="2.4" fill="#5a3a22"/><circle cx="25" cy="18" r="2.1" fill="#5a3a22"/>' +
    '<circle cx="18" cy="26" r="2.2" fill="#5a3a22"/><circle cx="26" cy="26" r="1.8" fill="#5a3a22"/></svg>' },

  { id: 'icecream', name: 'Ice Cream', said: 'an ice cream', many: 'ice creams', kind: 'sweet', art:
    '<svg viewBox="0 0 40 40"><circle cx="15" cy="13" r="7" fill="#f4a9c0"/>' +
    '<circle cx="25" cy="13" r="7" fill="#f7ead1"/><circle cx="20" cy="9" r="7" fill="#a8d5c2"/>' +
    '<path d="M11 19h18l-7.4 16a1.8 1.8 0 0 1-3.2 0z" fill="#d99a4e"/>' +
    '<path d="M13 22l14 0M15 26l10 0M17 30l6 0" stroke="#c1863d" stroke-width="1.3"/></svg>' },
];


/* ==========================================================================
   2. CONFIG — everything worth turning
   ========================================================================== */

const CONFIG = {
  startItems: 2,        // the first order
  perLevel: 5,          // orders served at a size before it grows by one
  maxItems: 9,          // the prototype cap; the run is won on completing it
  strikes: 3,           // wrong tickets allowed
  viewBase: 1500,       // how long the order stays up: base…
  viewPerItem: 650,     // …plus this per item
  panMs: 520,           // camera move between counter and pass
  askAfterMs: 780,      // beat between a wrong ticket and going back to ask

  /* Doubles ("can I get two burgers?") are a spice, not the dish. */
  doubleChance: 0.22,   // of an order carrying a repeated item at all
  minDoubleSize: 3,     // …never on the two-item warm-up
  tripleChance: 0.28,   // of that repeat being three rather than two
  minTripleSize: 6,
};

/* Orders 1-5 are two items, 6-10 are three, and so on up to the cap. */
function sizeForRound(round) {
  const grown = CONFIG.startItems + Math.floor((round - 1) / CONFIG.perLevel);
  return Math.min(CONFIG.maxItems, grown);
}

const SAVE_KEY = 'orderup.best.v1';


/* ==========================================================================
   3. STATE
   ========================================================================== */

let S = null;
let best = loadBest();

function createRun() {
  return {
    phase: 'title',      // 'title' | 'reading' | 'building' | 'asking' | 'over'
    size: sizeForRound(1),
    order: [],
    ticket: [],
    seen: new Set(),     // order signatures used this run
    round: 1,
    correct: 0,
    mistakes: 0,
    streak: 0,
    bestStreak: 0,
    highest: 0,          // longest order actually served
    won: false,
  };
}

function loadBest() {
  const blank = { order: 0, correct: 0, streak: 0 };
  try {
    const raw = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
    if (raw && typeof raw === 'object') {
      return {
        order: Number(raw.order) || 0,
        correct: Number(raw.correct) || 0,
        streak: Number(raw.streak) || 0,
      };
    }
  } catch (e) { /* no memory is fine */ }
  return blank;
}

function saveBest() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(best)); } catch (e) { /* fine */ }
}


/* ==========================================================================
   4. LOGIC
   ========================================================================== */

const $ = (id) => document.getElementById(id);
const pick = (a) => a[Math.floor(Math.random() * a.length)];

function itemById(id) { return MENU.find((m) => m.id === id); }

/* [{ id, n }] in the order the items were first seen. */
function countItems(ids) {
  const out = [];
  ids.forEach((id) => {
    const row = out.find((r) => r.id === id);
    if (row) row.n++; else out.push({ id: id, n: 1 });
  });
  return out;
}

function shuffled(a) {
  const out = a.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = out[i]; out[i] = out[j]; out[j] = t;
  }
  return out;
}

/* `size` counts items, not kinds: a double eats two of the slots. Most orders
   are all-distinct; now and then one item is asked for twice (or three times).
   Avoids repeating an order this run has already served, where it can. */
function rollOrder(size) {
  for (let attempt = 0; attempt < 14; attempt++) {
    let extra = 0;
    if (size >= CONFIG.minDoubleSize && Math.random() < CONFIG.doubleChance) {
      extra = (size >= CONFIG.minTripleSize && Math.random() < CONFIG.tripleChance) ? 2 : 1;
    }
    const bag = MENU.slice();
    const out = [];
    while (out.length < size - extra && bag.length) {
      out.push(bag.splice(Math.floor(Math.random() * bag.length), 1)[0].id);
    }
    const dup = out[Math.floor(Math.random() * out.length)];
    for (let i = 0; i < extra; i++) out.push(dup);

    const sig = out.slice().sort().join(',');
    if (!S.seen.has(sig) || attempt === 13) { S.seen.add(sig); return shuffled(out); }
  }
  return [];
}

/* "two burgers, fries and a lemonade" */
const SPOKEN_N = ['', '', 'two', 'three', 'four'];
function spoken(ids) {
  const said = countItems(ids).map((r) => {
    const m = itemById(r.id);
    return r.n > 1 ? SPOKEN_N[r.n] + ' ' + m.many : m.said;
  });
  if (said.length === 1) return said[0];
  return said.slice(0, -1).join(', ') + ' and ' + said[said.length - 1];
}

function viewMs(size) { return CONFIG.viewBase + CONFIG.viewPerItem * size; }

function startRun() {
  S = createRun();
  hideOverlay();
  renderRail();
  nextCustomer();
}

function nextCustomer() {
  S.phase = 'reading';
  S.order = rollOrder(S.size);
  S.ticket = [];
  panTo('counter');
  renderGuest();
  renderRail();
  renderTicket();
  renderMenu();
  playCue('arrive');

  showBubble();
  clearTimeout(nextCustomer.timer);
  nextCustomer.timer = setTimeout(goToPass, viewMs(S.size));
}

/* "Sorry, what did you need again?" — the same order, said a second time. */
function recapOrder() {
  if (!S || S.phase !== 'asking') return;
  S.phase = 'reading';
  panTo('counter');
  playCue('arrive');
  showBubble(true);
  clearTimeout(nextCustomer.timer);
  nextCustomer.timer = setTimeout(goToPass, viewMs(S.order.length));
}

function goToPass() {
  if (!S || S.phase !== 'reading') return;
  hideBubble();
  S.phase = 'building';
  panTo('kitchen');
  renderTicket();
}

function addItem(id) {
  if (S.phase !== 'building') return;
  S.ticket.push(id);
  playCue('tap');
  bumpItem(id);
  renderTicket();
  renderMenu();
}

function removeItem(id) {
  if (S.phase !== 'building') return;
  const at = S.ticket.lastIndexOf(id);
  if (at < 0) return;
  S.ticket.splice(at, 1);
  playCue('untap');
  renderTicket();
  renderMenu();
}

/* Strike a whole line off the ticket. */
function removeAll(id) {
  if (S.phase !== 'building') return;
  if (!S.ticket.includes(id)) return;
  S.ticket = S.ticket.filter((x) => x !== id);
  playCue('untap');
  renderTicket();
  renderMenu();
}

/* Tear the ticket up and start it again. */
function clearTicket() {
  if (S.phase !== 'building' || !S.ticket.length) return;
  S.ticket = [];
  playCue('untap');
  renderTicket();
  renderMenu();
}

function sameOrder() {
  if (S.ticket.length !== S.order.length) return false;
  const a = S.ticket.slice().sort().join(',');
  const b = S.order.slice().sort().join(',');
  return a === b;
}

function submit() {
  if (S.phase !== 'building' || !S.ticket.length) return;

  if (!sameOrder()) {
    S.mistakes++;
    S.streak = 0;
    shakeTicket();
    renderRail();
    playCue('nope');
    if (S.mistakes >= CONFIG.strikes) { endRun(false); return; }
    /* Rather than leave you guessing, go back and ask. The ticket keeps
       what you had, so you can fix it against what you just heard. */
    S.phase = 'asking';
    setTimeout(recapOrder, CONFIG.askAfterMs);
    return;
  }

  S.correct++;
  S.streak++;
  S.highest = Math.max(S.highest, S.order.length);
  if (S.streak > S.bestStreak) S.bestStreak = S.streak;

  stampTicket();
  popScore('+' + S.order.length);
  playCue('served');
  renderRail();

  const wasCap = S.order.length >= CONFIG.maxItems;
  S.phase = 'reading';                       // lock input during the handover
  setTimeout(() => {
    if (wasCap) { endRun(true); return; }
    S.round++;
    const grown = sizeForRound(S.round);
    const levelled = grown > S.size;
    S.size = grown;
    renderRail();
    leaveGuest();
    if (levelled) { showLevelUp(grown); setTimeout(nextCustomer, 1150); }
    else setTimeout(nextCustomer, 240);
  }, 620);
}

function endRun(won) {
  S.phase = 'over';
  S.won = won;
  clearTimeout(nextCustomer.timer);

  const records = {
    order:  S.highest > best.order,
    correct: S.correct > best.correct,
    streak: S.bestStreak > best.streak,
  };
  best = {
    order: Math.max(best.order, S.highest),
    correct: Math.max(best.correct, S.correct),
    streak: Math.max(best.streak, S.bestStreak),
  };
  saveBest();
  showResults(records);
  playCue(won ? 'served' : 'closing');
}


/* ==========================================================================
   5. RENDER
   ========================================================================== */

const elRooms = $('rooms');
const elBubble = $('bubble');
const elGuest = $('guest');
const elMenu = $('menu');
const elLines = $('ticketLines');
const elFx = $('fx');
const elOverlay = $('overlay');
const elCard = $('card');
const elTicket = $('ticket');
const elStamp = $('stamp');

function panTo(room) { elRooms.classList.toggle('at-kitchen', room === 'kitchen'); }

function renderRail() {
  $('statRound').textContent = S.round;
  $('statSize').textContent = S.size;
  $('statStreak').textContent = S.streak;
  const dots = [];
  for (let i = 0; i < CONFIG.strikes; i++) dots.push('<i class="' + (i < S.mistakes ? 'spent' : '') + '"></i>');
  $('strikes').innerHTML = dots.join('');
}

/* A different face every time, from a small set of parts. */
const SKIN = ['#e8b98d', '#c98d5f', '#8d5a3a', '#f0cfae', '#6f4429'];
const HAIR = ['#2b1f1a', '#6b4327', '#c1863d', '#8a8f96', '#a8332c'];
const SHIRT = ['#d9483f', '#efb034', '#7bb661', '#7fc2d4', '#b07fc2', '#e8825c'];

function renderGuest() {
  const skin = pick(SKIN), hair = pick(HAIR), shirt = pick(SHIRT);
  elGuest.classList.remove('leaving');
  elGuest.innerHTML =
    '<svg viewBox="0 0 100 100">' +
      '<path d="M18 100c0-17 14-26 32-26s32 9 32 26z" fill="' + shirt + '"/>' +
      '<rect x="44" y="58" width="12" height="14" rx="5" fill="' + skin + '"/>' +
      '<circle cx="50" cy="42" r="22" fill="' + skin + '"/>' +
      '<path d="M28 40a22 22 0 0 1 44 0c0-6-6-16-22-16S28 34 28 40z" fill="' + hair + '"/>' +
      '<circle cx="42" cy="43" r="2.6" fill="#241a15"/><circle cx="58" cy="43" r="2.6" fill="#241a15"/>' +
      '<path d="M44 52c3 3 9 3 12 0" stroke="#241a15" stroke-width="2.4" fill="none" stroke-linecap="round"/>' +
    '</svg>';
}

function leaveGuest() { elGuest.classList.add('leaving'); }

const AGAIN = [
  'Of course &mdash; ', 'No problem &mdash; ', 'Sure thing &mdash; ', 'Ha, no worries &mdash; ',
];

function showBubble(recap) {
  elBubble.className = 'bubble show' + (recap ? ' recap' : '');
  elBubble.innerHTML =
    (recap ? '<div class="bubble-ask">You: &ldquo;Sorry, what did you need again?&rdquo;</div>' : '') +
    '<div class="bubble-said">&ldquo;' +
      (recap ? pick(AGAIN) + spoken(S.order) + '.' : 'Can I get ' + spoken(S.order) + '?') +
    '&rdquo;</div>' +
    '<div class="bubble-items">' +
      countItems(S.order).map((r, i) => {
        const m = itemById(r.id);
        return '<span class="chip" style="animation-delay:' + (60 + i * 55) + 'ms">' +
               m.art + m.name +
               (r.n > 1 ? '<b>&times;' + r.n + '</b>' : '') + '</span>';
      }).join('') +
    '</div>';
}

function hideBubble() { elBubble.className = 'bubble hide'; }

function renderMenu() {
  if (!elMenu.children.length) {
    elMenu.innerHTML = MENU.map((m) =>
      '<div class="slot" data-id="' + m.id + '">' +
        '<button class="item" type="button" data-id="' + m.id + '">' +
          m.art + '<span>' + m.name + '</span></button>' +
        '<button class="less" type="button" data-id="' + m.id + '" tabindex="-1"' +
          ' aria-label="One less ' + m.name + '">&minus;</button>' +
      '</div>').join('');
    elMenu.querySelectorAll('.item').forEach((b) =>
      b.addEventListener('click', () => addItem(b.dataset.id)));
    elMenu.querySelectorAll('.less').forEach((b) =>
      b.addEventListener('click', () => removeItem(b.dataset.id)));
  }
  elMenu.querySelectorAll('.slot').forEach((slot) => {
    const n = S.ticket.filter((x) => x === slot.dataset.id).length;
    slot.classList.toggle('has', n > 0);
    slot.querySelector('.item').classList.toggle('picked', n > 0);
    slot.querySelector('.item').dataset.n = n;
  });
}

function bumpItem(id) {
  const el = elMenu.querySelector('.item[data-id="' + id + '"]');
  if (!el) return;
  el.classList.remove('bump');
  void el.offsetWidth;
  el.classList.add('bump');
}

function renderTicket() {
  $('ticketNo').textContent = '#' + S.round;
  const counted = countItems(S.ticket);

  elLines.innerHTML = counted.length
    ? counted.map((r) => {
        const m = itemById(r.id);
        return '<li>' + m.art + m.name +
               '<b>' + (r.n > 1 ? '&times;' + r.n : '') + '</b>' +
               '<button type="button" data-id="' + r.id +
               '" aria-label="Take ' + m.name + ' off the ticket">&times;</button></li>';
      }).join('')
    : '<li class="ticket-empty">Nothing on the ticket yet.</li>';

  elLines.querySelectorAll('button').forEach((b) =>
    b.addEventListener('click', () => removeAll(b.dataset.id)));

  $('ticketCount').textContent = S.ticket.length + (S.ticket.length === 1 ? ' item' : ' items');
  $('clearBtn').disabled = S.ticket.length === 0;
  $('sendBtn').disabled = S.ticket.length === 0;
}

function shakeTicket() {
  elTicket.classList.remove('shake');
  void elTicket.offsetWidth;
  elTicket.classList.add('shake');
}

function stampTicket() {
  elStamp.innerHTML = '<span>Served</span>';
  elStamp.classList.remove('hit');
  void elStamp.offsetWidth;
  elStamp.classList.add('hit');
}

function showLevelUp(size) {
  const el = document.createElement('div');
  el.className = 'levelup';
  el.innerHTML = '<b>Level up</b><span>Orders are now ' + size + ' items</span>';
  elFx.appendChild(el);
  setTimeout(() => el.remove(), 1300);
  $('statSize').parentElement.classList.remove('flash');
  void $('statSize').offsetWidth;
  $('statSize').parentElement.classList.add('flash');
  playCue('levelup');
}

function popScore(text) {
  const r = elTicket.getBoundingClientRect();
  const el = document.createElement('div');
  el.className = 'pop';
  el.textContent = text;
  el.style.left = (r.left + r.width / 2) + 'px';
  el.style.top = (r.top + 18) + 'px';
  elFx.appendChild(el);
  setTimeout(() => el.remove(), 820);
}

/* ── cards ─────────────────────────────────────────────── */

function hideOverlay() { elOverlay.classList.add('hidden'); }

function showTitle() {
  elOverlay.classList.remove('hidden');
  elCard.innerHTML =
    '<h1>Order <b>Up</b></h1>' +
    '<p class="sub">A lunch-counter memory game</p>' +
    '<ul class="how">' +
      '<li><i>1</i><span>A customer orders. You get a few seconds to take it in.</span></li>' +
      '<li><i>2</i><span>The counter slides away and you are at the pass.</span></li>' +
      '<li><i>3</i><span>Build the ticket from memory, then send it.</span></li>' +
      '<li><i>4</i><span>Wrong ticket? Ask again &mdash; it still costs a strike.</span></li>' +
      '<li><i>5</i><span>Every five tickets, orders grow by one item.</span></li>' +
    '</ul>' +
    (best.order ? '<p class="best-note">Best ticket so far: ' + best.order + ' items</p>' : '') +
    '<button class="btn" type="button" id="playBtn">Start the shift</button>';
  $('playBtn').addEventListener('click', startRun);
}

function showResults(records) {
  elOverlay.classList.remove('hidden');
  const cells = [
    ['Best ticket', S.highest, true, records.order],
    ['Served', S.correct, false, records.correct],
    ['Streak', S.bestStreak, false, records.streak],
    ['Mistakes', S.mistakes, false, false],
  ];
  elCard.innerHTML =
    '<h2>' + (S.won ? 'Kitchen closed' : 'That&rsquo;s the rush') + '</h2>' +
    '<p class="sub">' + (S.won ? 'You cleared every ticket' : 'Three wrong tickets') + '</p>' +
    '<div class="scores">' +
      cells.map(([label, value, hero, rec]) =>
        '<div class="score-cell' + (hero ? ' hero' : '') + (rec ? ' record' : '') + '">' +
          '<span>' + label + '</span><b>' + value + '</b></div>').join('') +
    '</div>' +
    '<button class="btn" type="button" id="againBtn">Play again</button>' +
    '<button class="btn ghost" type="button" id="menuBtn">Back to the door</button>';
  $('againBtn').addEventListener('click', startRun);
  $('menuBtn').addEventListener('click', showTitle);
}


/* ==========================================================================
   6. AUDIO + INPUT
   ========================================================================== */

let audioCtx = null;
let soundOn = true;

/* Small, warm, restrained — a diner, not a slot machine. */
const CUES = {
  arrive:  [{ f: 523, at: 0,    d: 0.10, g: 0.038, t: 'sine' },
            { f: 784, at: 0.08, d: 0.18, g: 0.034, t: 'sine' }],
  tap:     [{ f: 620, at: 0,    d: 0.05, g: 0.028, t: 'square' }],
  untap:   [{ f: 300, at: 0,    d: 0.06, g: 0.026, t: 'square' }],
  served:  [{ f: 880, at: 0,    d: 0.11, g: 0.046, t: 'sine' },
            { f: 1319, at: 0.08, d: 0.30, g: 0.040, t: 'sine' },
            { f: 180, at: 0.02, d: 0.10, g: 0.040, t: 'triangle' }],
  nope:    [{ f: 196, at: 0,    d: 0.14, g: 0.050, t: 'triangle' },
            { f: 147, at: 0.09, d: 0.24, g: 0.044, t: 'triangle' }],
  levelup: [{ f: 587, at: 0,    d: 0.10, g: 0.040, t: 'sine' },
            { f: 740, at: 0.09, d: 0.10, g: 0.040, t: 'sine' },
            { f: 988, at: 0.18, d: 0.34, g: 0.046, t: 'sine' }],
  closing: [{ f: 392, at: 0,    d: 0.30, g: 0.040, t: 'sine' },
            { f: 262, at: 0.18, d: 0.45, g: 0.036, t: 'sine' }],
};

function playCue(name) {
  const cue = CUES[name];
  if (!soundOn || !cue) return;
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const t0 = audioCtx.currentTime;
    cue.forEach((n) => {
      const osc = audioCtx.createOscillator();
      const amp = audioCtx.createGain();
      osc.type = n.t;
      osc.frequency.value = n.f;
      osc.connect(amp).connect(audioCtx.destination);
      const at = t0 + n.at;
      amp.gain.setValueAtTime(0.0001, at);
      amp.gain.linearRampToValueAtTime(n.g, at + 0.012);
      amp.gain.exponentialRampToValueAtTime(0.0001, at + n.d);
      osc.start(at);
      osc.stop(at + n.d + 0.02);
    });
  } catch (e) { /* sound is a nicety */ }
}

/* Mobile browsers only start audio inside a gesture. */
function wakeAudio() {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
  } catch (e) { /* fine */ }
}
window.addEventListener('pointerdown', wakeAudio);
window.addEventListener('touchstart', wakeAudio);
window.addEventListener('keydown', wakeAudio);

$('soundBtn').addEventListener('click', () => {
  soundOn = !soundOn;
  $('soundBtn').setAttribute('aria-pressed', String(soundOn));
  $('soundBtn').textContent = soundOn ? '♪' : '×';
  if (soundOn) playCue('tap');
});

$('sendBtn').addEventListener('click', submit);
$('clearBtn').addEventListener('click', clearTicket);

document.addEventListener('keydown', (e) => {
  if (!S || S.phase !== 'building') return;
  if (e.key === 'Enter') submit();
  else if (e.key === 'Backspace' && S.ticket.length) {
    e.preventDefault();
    removeItem(S.ticket[S.ticket.length - 1]);
  }
});

/* Boot */
S = createRun();
renderRail();
renderMenu();
renderTicket();
showTitle();
