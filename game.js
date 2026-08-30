'use strict';

/* ==========================================================================
   QUIET STACKS — one short shift at a very small library.

   Layout of this file:
     1. CONTENT   — books, requests, names, objectives, shelves  (edit freely)
     2. CONFIG    — pacing and tuning numbers
     3. STATE     — the whole game in one plain object
     4. LOGIC     — rules that change state
     5. RENDER    — everything that touches the DOM
     6. INPUT     — wiring
   Logic never reads the DOM; render never changes state.
   ========================================================================== */


/* ==========================================================================
   1. CONTENT
   ========================================================================== */

/* Shelves are data, so a fourth section is a one-line addition. */
const SHELVES = [
  { id: 'fantasy',   name: 'Fantasy',   tag: 'wonder & wilds', color: '#6f6cb0' },
  { id: 'mystery',   name: 'Mystery',   tag: 'clues & culprits', color: '#4e7f8c' },
  { id: 'biography', name: 'Biography', tag: 'real lives',     color: '#a9714a' },
];

/* Invented for this game — 30 titles, several deliberately slippery, so the
   description is sometimes the only tell. */
const INVENTED_BOOKS = [
  // ── Fantasy ──────────────────────────────────────────────────────────────
  { title: 'The Salt Lantern',          genre: 'fantasy',   desc: 'A lighthouse keeper realises the flame in her tower is the last dragon’s breath, and it is going out.', isRealBook: false },
  { title: 'Copper for the Crow King',  genre: 'fantasy',   desc: 'A blacksmith’s apprentice bargains with a court of talking crows for one more winter of warmth.', isRealBook: false },
  { title: 'Ninefold Morning',          genre: 'fantasy',   desc: 'The same sunrise repeats nine times until a village girl remembers the name the sun forgot.', isRealBook: false },
  { title: 'The Quiet Between Bells',   genre: 'fantasy',   desc: 'Two apprentice mages discover the silence in their tower is a god having a very long nap.', isRealBook: false },
  { title: 'Wolfwater',                 genre: 'fantasy',   desc: 'The river that once granted wishes to the valley has begun, politely, to ask for them back.', isRealBook: false },
  { title: 'The Cartographer’s Third Hand', genre: 'fantasy', desc: 'Every road this wandering mapmaker draws quietly appears in the world the following morning.', isRealBook: false },
  { title: 'Bone Orchard Hymn',         genre: 'fantasy',   desc: 'An orchard grown from a sleeping giant’s ribs must be sung to every dusk, or it wakes.', isRealBook: false },
  { title: 'Harrow & Thimble',          genre: 'fantasy',   desc: 'A village tailor stitches armour out of moonlight for a knight who would rather stop fighting.', isRealBook: false },
  { title: 'The Last Cinder Fair',      genre: 'fantasy',   desc: 'A runaway trades her shadow for a paper crown at a fair that visits the moor once a century.', isRealBook: false },
  { title: 'Glasswing Rebellion',       genre: 'fantasy',   desc: 'A colony of moth-riders wages an exceedingly gentle war against a mountain full of clockwork.', isRealBook: false },

  // ── Mystery ──────────────────────────────────────────────────────────────
  { title: 'The Wrong Piano',           genre: 'mystery',   desc: 'A concert-hall tuner finds a dead man’s fingerprint on middle C, and the hall was locked all week.', isRealBook: false },
  { title: 'Six Empty Chairs',          genre: 'mystery',   desc: 'A dinner party’s place cards list one more name than there are guests, and one fewer by morning.', isRealBook: false },
  { title: 'The Marmalade Alibi',       genre: 'mystery',   desc: 'A village baker’s flawless breakfast timeline is the only thing wrong with an otherwise perfect confession.', isRealBook: false },
  { title: 'Low Tide, No Witnesses',    genre: 'mystery',   desc: 'A seaside inspector has six hours to read a crime scene before the water politely erases it.', isRealBook: false },
  { title: 'The Understudy Knows',      genre: 'mystery',   desc: 'The whole company saw the accident on stage; only the understudy saw it happen twice.', isRealBook: false },
  { title: 'A Ledger of Small Lies',    genre: 'mystery',   desc: 'An accountant’s immaculate books turn out to be hiding a decade of missing persons.', isRealBook: false },
  { title: 'The Blue Hour Case',        genre: 'mystery',   desc: 'Every photograph taken at dusk on the promenade contains a woman who was never standing there.', isRealBook: false },
  { title: 'Nobody Rings Twice at Elmsleigh', genre: 'mystery', desc: 'A hotel bell sounds at three each morning, and guests vanish in the exact order they checked in.', isRealBook: false },
  { title: 'The Botanist’s Mistake', genre: 'mystery', desc: 'A rare poison in a locked greenhouse points to the one gardener who could not possibly have grown it.', isRealBook: false },
  { title: 'Return Address Unknown',    genre: 'mystery',   desc: 'Letters from a man dead eleven years keep arriving with this week’s postmark on them.', isRealBook: false },

  // ── Biography ────────────────────────────────────────────────────────────
  { title: 'Salt in the Mortar',        genre: 'biography', desc: 'The life of a nineteenth-century apothecary who mapped an epidemic house by house, on foot.', isRealBook: false },
  { title: 'The Woman Who Counted Birds', genre: 'biography', desc: 'Sixty years of one ornithologist’s notebooks, recording every migration through a single valley.', isRealBook: false },
  { title: 'Bricklayer, Poet, Mayor',   genre: 'biography', desc: 'How a self-taught mason talked his way into becoming the most quoted mayor a mill town ever had.', isRealBook: false },
  { title: 'Letters to a Younger Engineer', genre: 'biography', desc: 'Six decades of a bridge-builder’s correspondence, equal parts steel calculations and doubt.', isRealBook: false },
  { title: 'Hands Like That',           genre: 'biography', desc: 'A surgeon’s memoir of twenty years abroad and the village clinic she came home to run.', isRealBook: false },
  { title: 'The Cartwright of Vesey Street', genre: 'biography', desc: 'A wheelwright whose order books became the fullest surviving record of a neighbourhood now gone.', isRealBook: false },
  { title: 'Second Violin',             genre: 'biography', desc: 'Forty years in an orchestra, told by the player who sat one seat away from the spotlight.', isRealBook: false },
  { title: 'A Life in Nine Kitchens',   genre: 'biography', desc: 'A chef recounts her life through the nine kitchens that fed, bruised and finally made her.', isRealBook: false },
  { title: 'Field Notes for My Daughter', genre: 'biography', desc: 'An Arctic researcher’s journals, every entry written as a letter home to a child growing up without him.', isRealBook: false },
  { title: 'The Man Who Fixed Clocks',  genre: 'biography', desc: 'A portrait of the horologist who kept an entire city running on time for half a century.', isRealBook: false },
];

/* Real published books. Descriptions are written for this game, not copied.
   An `author` is what marks a shelf card as a real one. */
const REAL_BOOKS = [
  // ── Fantasy ──────────────────────────────────────────────────────────────
  { title: 'The Hobbit', author: 'J.R.R. Tolkien', genre: 'fantasy', desc: 'A comfortable hobbit is bustled out of his door and into a quest to win back a dwarf kingdom from a dragon.', isRealBook: true },
  { title: 'A Wizard of Earthsea', author: 'Ursula K. Le Guin', genre: 'fantasy', desc: 'A gifted young wizard looses a shadow upon the world and sails to the edge of the map to face it.', isRealBook: true },
  { title: 'Howl’s Moving Castle', author: 'Diana Wynne Jones', genre: 'fantasy', desc: 'A hatmaker cursed into old age keeps house for a vain wizard in a castle that walks about the hills.', isRealBook: true },
  { title: 'The Lion, the Witch and the Wardrobe', author: 'C.S. Lewis', genre: 'fantasy', desc: 'Four children step through a wardrobe into a country held in endless winter by a white witch.', isRealBook: true },
  { title: 'The Name of the Wind', author: 'Patrick Rothfuss', genre: 'fantasy', desc: 'An innkeeper with a hidden past recounts how he became the most notorious magician of his age.', isRealBook: true },
  { title: 'Piranesi', author: 'Susanna Clarke', genre: 'fantasy', desc: 'A man living in an endless house of statues and tides begins to suspect he is not its only inhabitant.', isRealBook: true },
  { title: 'The Fifth Season', author: 'N.K. Jemisin', genre: 'fantasy', desc: 'On a continent shaken by regular apocalypses, a woman with earth-moving power hunts for her stolen daughter.', isRealBook: true },
  { title: 'Uprooted', author: 'Naomi Novik', genre: 'fantasy', desc: 'A village girl is taken as tribute by the wizard who guards her valley against a malevolent wood.', isRealBook: true },
  { title: 'The Last Unicorn', author: 'Peter S. Beagle', genre: 'fantasy', desc: 'The last unicorn leaves her forest to discover what became of all the others.', isRealBook: true },
  { title: 'Sabriel', author: 'Garth Nix', genre: 'fantasy', desc: 'A necromancer’s daughter crosses into the Old Kingdom to look for her father among the dead.', isRealBook: true },

  // ── Mystery ──────────────────────────────────────────────────────────────
  { title: 'The Hound of the Baskervilles', author: 'Arthur Conan Doyle', genre: 'mystery', desc: 'Sherlock Holmes investigates the spectral hound said to hunt one family across the moors.', isRealBook: true },
  { title: 'Murder on the Orient Express', author: 'Agatha Christie', genre: 'mystery', desc: 'Hercule Poirot is snowbound on a train with twelve suspects and one much-stabbed passenger.', isRealBook: true },
  { title: 'The Maltese Falcon', author: 'Dashiell Hammett', genre: 'mystery', desc: 'A San Francisco detective is drawn into the hunt for a jewelled statuette worth killing over.', isRealBook: true },
  { title: 'The Big Sleep', author: 'Raymond Chandler', genre: 'mystery', desc: 'Philip Marlowe takes a simple blackmail case for a dying general and finds a great deal more.', isRealBook: true },
  { title: 'Gaudy Night', author: 'Dorothy L. Sayers', genre: 'mystery', desc: 'Harriet Vane returns to her Oxford college to trace a poison-pen writer among the dons.', isRealBook: true },
  { title: 'The Moonstone', author: 'Wilkie Collins', genre: 'mystery', desc: 'A cursed Indian diamond disappears from an English country house on the night it is given away.', isRealBook: true },
  { title: 'The Girl with the Dragon Tattoo', author: 'Stieg Larsson', genre: 'mystery', desc: 'A disgraced journalist and a ferocious hacker reopen a disappearance that has been cold for forty years.', isRealBook: true },
  { title: 'In the Woods', author: 'Tana French', genre: 'mystery', desc: 'A Dublin detective works a child’s murder in the same wood where he himself vanished as a boy.', isRealBook: true },
  { title: 'The No. 1 Ladies’ Detective Agency', author: 'Alexander McCall Smith', genre: 'mystery', desc: 'Botswana’s first female private detective opens for business and takes on her neighbours’ troubles.', isRealBook: true },
  { title: 'The Thursday Murder Club', author: 'Richard Osman', genre: 'mystery', desc: 'Four residents of a retirement village meet weekly over cold cases, then land a very fresh one.', isRealBook: true },

  // ── Biography ────────────────────────────────────────────────────────────
  { title: 'The Diary of a Young Girl', author: 'Anne Frank', genre: 'biography', desc: 'The diary a Jewish teenager kept through two years hidden in a concealed annexe in Amsterdam.', isRealBook: true },
  { title: 'Long Walk to Freedom', author: 'Nelson Mandela', genre: 'biography', desc: 'Mandela’s own account of the road from a Transkei village through twenty-seven years in prison to the presidency.', isRealBook: true },
  { title: 'I Know Why the Caged Bird Sings', author: 'Maya Angelou', genre: 'biography', desc: 'Angelou’s account of growing up in the segregated American South, and the years she chose not to speak.', isRealBook: true },
  { title: 'The Immortal Life of Henrietta Lacks', author: 'Rebecca Skloot', genre: 'biography', desc: 'The story of the woman whose cells were taken without her consent and never stopped dividing.', isRealBook: true },
  { title: 'Educated', author: 'Tara Westover', genre: 'biography', desc: 'A woman raised by survivalist parents with no schooling at all makes her way to a Cambridge doctorate.', isRealBook: true },
  { title: 'Steve Jobs', author: 'Walter Isaacson', genre: 'biography', desc: 'An authorised portrait of Apple’s founder, built from dozens of interviews with the man himself.', isRealBook: true },
  { title: 'Alexander Hamilton', author: 'Ron Chernow', genre: 'biography', desc: 'The life of the orphaned immigrant who built the financial machinery of the United States.', isRealBook: true },
  { title: 'The Wright Brothers', author: 'David McCullough', genre: 'biography', desc: 'Two Ohio bicycle makers teach themselves the physics of flight and get a machine into the air.', isRealBook: true },
  { title: 'A Beautiful Mind', author: 'Sylvia Nasar', genre: 'biography', desc: 'The mathematician John Nash’s descent into schizophrenia and his improbable return to his work.', isRealBook: true },
  { title: 'Becoming', author: 'Michelle Obama', genre: 'biography', desc: 'The former First Lady’s account of the South Side, the law, and the years that followed.', isRealBook: true },

  // ── Added in v0.2: a mix of recognisable and deliberately misleading ──
  { title: 'The Princess Bride', author: 'William Goldman', genre: 'fantasy', desc: 'A farmhand turned pirate crosses a kingdom of swordsmen and giants to reach the woman he loves.', isRealBook: true },
  { title: 'Good Omens', author: 'Terry Pratchett and Neil Gaiman', genre: 'fantasy', desc: 'An angel and a demon who have grown fond of England conspire to misplace the Antichrist.', isRealBook: true },
  { title: 'The Golden Compass', author: 'Philip Pullman', genre: 'fantasy', desc: 'A girl and her animal-shaped soul travel north to find children stolen for an experiment.', isRealBook: true },
  { title: 'Stardust', author: 'Neil Gaiman', genre: 'fantasy', desc: 'A young man crosses the wall at the edge of his village to fetch a fallen star, which turns out to be a woman.', isRealBook: true },
  { title: 'And Then There Were None', author: 'Agatha Christie', genre: 'mystery', desc: 'Ten strangers are lured to an island and accused by a voice, then killed one by one.', isRealBook: true },
  { title: 'The Cuckoo’s Calling', author: 'Robert Galbraith', genre: 'mystery', desc: 'A private detective reopens a supermodel’s fall from a balcony that everyone else has filed as suicide.', isRealBook: true },
  { title: 'Devil in a Blue Dress', author: 'Walter Mosley', genre: 'mystery', desc: 'A laid-off aircraft worker in 1940s Los Angeles is paid to find a missing woman and becomes a detective by accident.', isRealBook: true },
  { title: 'Still Life', author: 'Louise Penny', genre: 'mystery', desc: 'A Quebec village painter is found dead in the woods, and the arrow through her was not an accident.', isRealBook: true },
  { title: 'Hidden Figures', author: 'Margot Lee Shetterly', genre: 'biography', desc: 'The lives of the Black women mathematicians whose calculations put American astronauts into orbit.', isRealBook: true },
  { title: 'Unbroken', author: 'Laura Hillenbrand', genre: 'biography', desc: 'The life of an Olympic runner who survived a plane crash, weeks adrift, and years as a prisoner of war.', isRealBook: true },
  { title: 'Born a Crime', author: 'Trevor Noah', genre: 'biography', desc: 'A comedian’s account of a childhood in South Africa where his parents’ relationship was itself illegal.', isRealBook: true },
  { title: 'The Glass Castle', author: 'Jeannette Walls', genre: 'biography', desc: 'A journalist recalls the brilliant, chaotic parents who raised her mostly without a home.', isRealBook: true },
];

/* The shelf draws from both. Drop either list to run on one alone. */
const BOOKS = INVENTED_BOOKS.concat(REAL_BOOKS);

/* Patron request type A: "where do I find books about X?" — 15 phrasings. */
const TOPIC_ASKS = [
  { genre: 'fantasy',   text: 'Where would I find books about dragons? Proper ones, with hoards.' },
  { genre: 'fantasy',   text: 'My nephew has decided he loves wizards. Which section, please?' },
  { genre: 'fantasy',   text: 'Do you keep the enchanted-forest sort of story anywhere near here?' },
  { genre: 'fantasy',   text: 'I’m after something with knights and an impossible quest in it.' },
  { genre: 'fantasy',   text: 'Anything with faeries who make bad bargains? That’s my whole personality lately.' },
  { genre: 'mystery',   text: 'Where do you shelve the detective novels? The tea’s already on.' },
  { genre: 'mystery',   text: 'I want a locked-room puzzle, the fussier the better. Which way?' },
  { genre: 'mystery',   text: 'Something with a small village and one very suspicious vicar, please.' },
  { genre: 'mystery',   text: 'Do you have books about stolen paintings and the people who chase them?' },
  { genre: 'mystery',   text: 'I’m looking for a missing-persons case that actually gets solved.' },
  { genre: 'biography', text: 'Where are the life stories of scientists kept?' },
  { genre: 'biography', text: 'I’d love a chef’s memoir — real kitchens, real disasters.' },
  { genre: 'biography', text: 'Which section has accounts by explorers who genuinely went there?' },
  { genre: 'biography', text: 'A musician’s life story would be perfect for the train home.' },
  { genre: 'biography', text: 'Something true, about somebody who quietly changed their own town?' },
];

/* Patron request type B: locating a specific book the player has handled. */
const BOOK_ASKS = [
  'I’m after “{title}” — which section is it in?',
  'My book club chose “{title}”. Where do I find it?',
  'A friend swears by “{title}”. Which shelf, do you think?',
  'Could you point me to “{title}”? I’ve been circling for ages.',
  'I returned “{title}” last week and now I want it again. Where’s it live?',
];

/* Type C: remembering a real book from earlier in the shift. Only ever asked
   about real titles, which are recognisable enough to recall once seen. */
const MEMORY_ASKS = [
  'I liked “{title}”. Where should I look for something similar?',
  'I finished “{title}” on the bus. What else is in that part of the library?',
  'Someone lent me “{title}” — where do you keep the rest of those?',
  'If I enjoyed “{title}”, which section should I be browsing?',
  'My last one was “{title}”. Point me back to that shelf?',
];

const PATRON_NAMES = [
  'Wren', 'Otis', 'Priya', 'Halim', 'Marta', 'June', 'Desmond', 'Nkechi',
  'Ivo', 'Sadie', 'Theo', 'Bao', 'Ana', 'Felix', 'Rosa', 'Yusuf',
  'Nell', 'Kit', 'Ida', 'Milo', 'Esme', 'Rafa',
];

const FACE_COLORS = ['#8a6a4a', '#7a6b93', '#5d7a7f', '#96694f', '#6d7f5d', '#9a6470', '#5f6f8c'];

/* Returns waiting on the cart are unsorted, so they must look unsorted: one
   worn library binding, varied only by position in the stack. Nothing here
   correlates with genre — that is what the description is for. */
const UNSORTED_BOOK_COLOR = '#8a7c6a';

/* Said when patience runs out — always kind. */
const LEAVING_LINES = [
  'No trouble at all, I’ll pop back tomorrow.',
  'You’ve got your hands full — another time.',
  'I’ll have a browse on my own. Thank you anyway!',
  'Not to worry. Lovely library, by the way.',
  'I’ll come by when it’s quieter. Take care!',
];

const THANK_LINES = [
  'Perfect, thank you!',
  'Ah, that’s the one.',
  'You’re a marvel.',
  'Exactly what I wanted.',
  'Wonderful — thank you kindly.',
];

/* Objectives are a list so new ones can be appended without touching the loop.
   Targets are per-minute rates, scaled to whatever shift length is chosen. */
const OBJECTIVES = [
  { id: 'books',   label: 'Books shelved',  perMinute: 4, read: (s) => s.shelved },
  { id: 'patrons', label: 'Patrons helped', perMinute: 3, read: (s) => s.helped },
];


/* ==========================================================================
   2. CONFIG
   ========================================================================== */

const CONFIG = {
  shiftChoices: [2, 4, 6],       // minutes, offered on the title card
  defaultMinutes: 2,
  cartMax: 8,                    // the cart quietly stops accepting past this
  queueMax: 4,

  startingBooks: 2,
  firstBookDelay: 4,
  firstPatronDelay: 6,

  // Nobody should stand at an empty desk. When less than this is waiting,
  // the next arrivals are pulled forward — so a fast player is met rather
  // than left tapping an empty cart, and a slow one never triggers it.
  // Shelves show only the most recent arrivals; the rest stay in game state.
  shelfDisplayMax: 7,
  memoryAskChance: 0.5,          // of book requests, how many are recall rather than locate

  minOnHand: 2,
  dryBookDelay: 1.2,
  dryPatronDelay: 2.5,

  satisfactionStart: 78,
  calmRecoveryPerSec: 0.55,      // a tidy desk and an empty queue settle the room again
  crowdDrainPerSec: 0.08,        // per patron waiting beyond the first — a busy room is a tense one
  bookRequestChance: 0.45,      // once enough books have been seen
  minSeenForBookRequest: 3,

  // Pacing. Boundaries are fractions of the shift, so a 2-minute and a
  // 6-minute shift both open calm and end noticeably busy.
  phases: [
    { untilFraction: 0.20, label: 'Opening',     bookEvery: 12.0, patronEvery: 16.0, patience: 50 },
    { untilFraction: 0.50, label: 'Mid-morning', bookEvery: 10.0, patronEvery: 13.0, patience: 45 },
    { untilFraction: 0.80, label: 'Afternoon',   bookEvery:  8.0, patronEvery: 11.0, patience: 40 },
    { untilFraction: 1.01, label: 'Last call',   bookEvery:  6.0, patronEvery:  8.5, patience: 34 },
  ],

  points: {
    shelfCorrect: 10,
    patronBase: 15,
    patronSpeedBonus: 10,       // scaled by remaining patience
    streakStep: 2,
    streakCap: 10,
  },

  satisfaction: {
    helped: 3.5,
    wrongAnswer: -2,
    wrongShelf: -2,
    patronLeft: -5,
  },

  wrongAnswerPatiencePenalty: 8, // seconds lost for a wrong genre guess
};


/* ==========================================================================
   3. STATE
   ========================================================================== */

let S = null;          // the whole game
let lastFrame = 0;
let rafId = 0;

function createState(minutes) {
  const shiftSeconds = minutes * 60;
  return {
    phase: 'title',          // 'title' | 'playing' | 'paused' | 'over'
    minutes: minutes,
    shiftSeconds: shiftSeconds,
    targets: targetsFor(minutes),
    elapsed: 0,
    timeLeft: shiftSeconds,
    phaseIndex: 0,

    cart: [],                // books waiting, oldest first; the "top" is the last one in
    patrons: [],
    hand: null,              // null | {kind:'book', book} | {kind:'patron', id}

    bookTimer: CONFIG.firstBookDelay,
    patronTimer: CONFIG.firstPatronDelay,
    bookBag: [],
    nextPatronId: 1,
    nameCursor: Math.floor(Math.random() * PATRON_NAMES.length),

    seen: [],                // books the player has actually handled
    shelfHistory: shelfHistoryStore(),   // every book put away, per shelf, in order
    score: 0,
    streak: 0,
    bestStreak: 0,
    satisfaction: CONFIG.satisfactionStart,

    shelved: 0,
    shelvedCorrect: 0,
    helped: 0,
    left: 0,

  };
}

/* One bucket per shelf, so a new section needs no new code here. */
function shelfHistoryStore() {
  const store = {};
  SHELVES.forEach((sh) => { store[sh.id] = []; });
  return store;
}

/* Scaled once at the start of a shift, so every readout agrees on the target. */
function targetsFor(minutes) {
  const t = {};
  OBJECTIVES.forEach((o) => { t[o.id] = Math.round(o.perMinute * minutes); });
  return t;
}


/* ==========================================================================
   4. LOGIC
   ========================================================================== */

function rand(min, max) { return min + Math.random() * (max - min); }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

function currentPhase() {
  return CONFIG.phases[S.phaseIndex];
}

function shelfById(id) {
  return SHELVES.find((s) => s.id === id);
}

/* Books are drawn from a shuffled bag so the same title doesn't repeat quickly. */
function drawBook() {
  if (S.bookBag.length === 0) {
    S.bookBag = BOOKS.slice();
    for (let i = S.bookBag.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [S.bookBag[i], S.bookBag[j]] = [S.bookBag[j], S.bookBag[i]];
    }
  }
  // Prefer a title that isn't already sitting in the cart or in hand.
  const busy = S.cart.slice();
  if (S.hand && S.hand.kind === 'book') busy.push(S.hand.book);
  for (let i = S.bookBag.length - 1; i >= 0; i--) {
    if (!busy.includes(S.bookBag[i])) return S.bookBag.splice(i, 1)[0];
  }
  return S.bookBag.pop();
}

function addBookToCart() {
  if (S.cart.length >= CONFIG.cartMax) return false;
  S.cart.push(drawBook());
  return true;
}

/* Is this book still among the spines actually on show? */
function visibleOnShelf(book) {
  const shelf = S.shelfHistory[book.genre];
  return !!shelf && shelf.slice(-CONFIG.shelfDisplayMax).includes(book);
}

/* Who may be asked about, and how.
   A real book is fair game once the player has shelved it: the title is
   recognisable and they handled it. An invented one is only fair while its
   spine is still visible, since nobody can be expected to recall a title that
   exists solely in this library and has scrolled off the shelf. */
function recallCandidates() {
  return S.seen.filter((b) => b.isRealBook || visibleOnShelf(b));
}

function makeRequest() {
  const pool = recallCandidates();
  const canAskForBook =
    pool.length >= CONFIG.minSeenForBookRequest &&
    Math.random() < CONFIG.bookRequestChance;

  if (canAskForBook) {
    const book = pick(pool);
    // Recall-style asks are for real titles only; invented ones are located.
    const remembering = book.isRealBook && Math.random() < CONFIG.memoryAskChance;
    let text;
    if (remembering) {
      text = pick(MEMORY_ASKS).replace('{title}', book.title) +
             (book.author ? ' The ' + book.author + ' one.' : '');
    } else {
      text = pick(BOOK_ASKS).replace('{title}', book.title) +
             (book.author ? ' It’s the ' + book.author + ' one.' : '');
    }
    return { kind: 'book', answer: book.genre, book: book, text: text };
  }
  const ask = pick(TOPIC_ASKS);
  return { kind: 'topic', answer: ask.genre, book: null, text: ask.text };
}

/* A patron can be waiting while the shelf moves on beneath them. If the
   invented title they meant to ask about has since scrolled out of sight, give
   them a different question rather than an unanswerable one.

   The patron currently in hand is skipped, so an open card never rewrites
   itself — and it cannot go stale anyway, since holding a patron means no book
   can be shelved and the shelf cannot move. */
function refreshStaleRequests() {
  S.patrons.forEach((p) => {
    if (S.hand && S.hand.kind === 'patron' && S.hand.id === p.id) return;
    const book = p.request.book;
    if (book && !book.isRealBook && !visibleOnShelf(book)) p.request = makeRequest();
  });
}

function addPatron() {
  if (S.patrons.length >= CONFIG.queueMax) return false;
  const patience = currentPhase().patience * rand(0.9, 1.1);
  S.nameCursor = (S.nameCursor + 1 + Math.floor(Math.random() * 3)) % PATRON_NAMES.length;
  S.patrons.push({
    id: S.nextPatronId++,
    name: PATRON_NAMES[S.nameCursor],
    color: pick(FACE_COLORS),
    request: makeRequest(),
    patience: patience,
    maxPatience: patience,
    misses: 0,
  });
  return true;
}

function startShift(minutes) {
  S = createState(minutes || (S && S.minutes) || CONFIG.defaultMinutes);
  S.phase = 'playing';
  for (let i = 0; i < CONFIG.startingBooks; i++) addBookToCart();

  clearBoard();
  buildShelves();
  renderAll();
  hideOverlay();
  lastFrame = performance.now();
}

/* Elements that outlive game state (queue, effects) have to go too. */
function clearBoard() {
  patronEls.clear();
  elQueue.innerHTML = '';
  elCartStack.innerHTML = '';
  elFx.innerHTML = '';
  elToast.className = 'toast';
}

function update(dt) {
  S.elapsed += dt;
  S.timeLeft = Math.max(0, S.shiftSeconds - S.elapsed);

  // Phase ramp
  while (S.phaseIndex < CONFIG.phases.length - 1 &&
         S.elapsed >= CONFIG.phases[S.phaseIndex].untilFraction * S.shiftSeconds) {
    S.phaseIndex++;
    renderPhase();
  }

  // Keep the desk from running dry on a player who is outpacing the schedule.
  if (S.cart.length + S.patrons.length < CONFIG.minOnHand) {
    S.bookTimer = Math.min(S.bookTimer, CONFIG.dryBookDelay);
    S.patronTimer = Math.min(S.patronTimer, CONFIG.dryPatronDelay);
  }

  // Returns arriving
  S.bookTimer -= dt;
  if (S.bookTimer <= 0) {
    if (addBookToCart()) {
      S.bookTimer = currentPhase().bookEvery * rand(0.85, 1.15);
      renderCart();
    } else {
      S.bookTimer = 1.5;               // cart is full: wait, don't pile up forever
    }
  }

  // Patrons arriving
  S.patronTimer -= dt;
  if (S.patronTimer <= 0) {
    if (addPatron()) {
      S.patronTimer = currentPhase().patronEvery * rand(0.85, 1.15);
      renderQueue();
    } else {
      S.patronTimer = 2;
    }
  }

  refreshStaleRequests();

  // Patience
  for (let i = S.patrons.length - 1; i >= 0; i--) {
    const p = S.patrons[i];
    p.patience -= dt;
    if (p.patience <= 0) patronLeaves(p);
  }

  // A room full of people waiting is a slightly less calm room — and a caught-up
  // desk quietly settles it again, so nobody can slide somewhere unrecoverable.
  const crowd = Math.max(0, S.patrons.length - 1);
  if (crowd > 0) {
    S.satisfaction = clamp(S.satisfaction - crowd * CONFIG.crowdDrainPerSec * dt, 0, 100);
  } else if (S.cart.length <= CONFIG.cartMax / 2) {
    S.satisfaction = clamp(S.satisfaction + CONFIG.calmRecoveryPerSec * dt, 0, 100);
  }

  if (S.timeLeft <= 0) endShift();
}

function streakBonus() {
  return Math.min(CONFIG.points.streakCap, S.streak * CONFIG.points.streakStep);
}

function bumpStreak() {
  S.streak++;
  if (S.streak > S.bestStreak) S.bestStreak = S.streak;
  if (S.streak > 0 && S.streak % 5 === 0) showMilestone(S.streak);
}

function breakStreak() {
  S.streak = 0;
}

/* ── Picking things up ──────────────────────────────────────────────────── */

function takeTopBook() {
  if (S.phase !== 'playing') return;
  if (S.hand) { say('One thing at a time — finish what’s in hand.', 'warn'); return; }
  if (S.cart.length === 0) { nudgeCart(); say('The cart is empty. A rare and peaceful moment.'); return; }

  S.hand = { kind: 'book', book: S.cart.pop() };
  playCue('pickup');
  renderCart();
  renderSlip();
  renderArmed();
}

function selectPatron(id) {
  if (S.phase !== 'playing') return;
  if (S.hand && S.hand.kind === 'book') { say('Shelve that book first — or put it back.', 'warn'); return; }
  const p = S.patrons.find((x) => x.id === id);
  if (!p) return;

  S.hand = { kind: 'patron', id: id };
  playCue('pickup');
  renderSlip();
  renderArmed();
}

function putBack() {
  if (!S.hand) return;
  if (S.hand.kind === 'book') {
    S.cart.push(S.hand.book);
    renderCart();
  }
  S.hand = null;
  renderSlip();
  renderArmed();
}

/* ── Resolving on a shelf ───────────────────────────────────────────────── */

function chooseShelf(genreId) {
  if (S.phase !== 'playing' || !S.hand) return;
  if (S.hand.kind === 'book') resolveBook(genreId);
  else resolvePatron(genreId);
}

function resolveBook(genreId) {
  const book = S.hand.book;
  const right = book.genre === genreId;

  S.hand = null;
  S.shelved++;
  if (!S.seen.includes(book)) S.seen.push(book);

  S.shelfHistory[book.genre].push(book);   // history is kept in full…
  flyBook(elCart, shelfEls[book.genre].root, book.genre);
  addSpine(book.genre, book);              // …the shelf only shows the recent few

  if (right) {
    S.shelvedCorrect++;
    const gained = CONFIG.points.shelfCorrect + streakBonus();
    S.score += gained;
    bumpStreak();
    flashShelf(genreId, 'good');
    floatScore(shelfEls[genreId].root, '+' + gained, false);
    say('Right where it belongs.', 'good');
    playCue('right');
  } else {
    const home = shelfById(book.genre);
    S.satisfaction = clamp(S.satisfaction + CONFIG.satisfaction.wrongShelf, 0, 100);
    breakStreak();
    flashShelf(genreId, 'bad');
    say('Close — “' + book.title + '” lives in ' + home.name + '. Popped it over.', 'warn');
    playCue('wrong');
  }

  renderSlip();
  renderArmed();
  renderHud();
}

function resolvePatron(genreId) {
  const p = S.patrons.find((x) => x.id === S.hand.id);
  if (!p) { S.hand = null; renderSlip(); renderArmed(); return; }

  if (genreId === p.request.answer) {
    const speed = Math.round(CONFIG.points.patronSpeedBonus * (p.patience / p.maxPatience));
    const gained = CONFIG.points.patronBase + speed + streakBonus();
    S.score += gained;
    S.helped++;
    S.satisfaction = clamp(S.satisfaction + CONFIG.satisfaction.helped, 0, 100);
    bumpStreak();

    S.hand = null;
    flashShelf(genreId, 'good');
    floatScore(shelfEls[genreId].root, '+' + gained, false);
    say(p.name + ': “' + pick(THANK_LINES) + '”', 'good');
    playCue('helped');
    removePatron(p, 'helped');
    renderSlip();      // hand was already cleared above, so clear the desk too
    renderArmed();
  } else {
    p.misses++;
    p.patience = Math.max(2, p.patience - CONFIG.wrongAnswerPatiencePenalty);
    S.satisfaction = clamp(S.satisfaction + CONFIG.satisfaction.wrongAnswer, 0, 100);
    breakStreak();
    flashShelf(genreId, 'bad');
    playCue('wrong');

    // A gentle hand, not a scolding.
    if (p.request.kind === 'book' && p.misses >= 1) {
      say('Not there. Hint: ' + p.request.book.desc, 'warn');
    } else {
      say('Hmm, not that section. Have another think.', 'warn');
    }
    renderSlip();
  }

  renderHud();
}

function patronLeaves(p) {
  S.left++;
  S.satisfaction = clamp(S.satisfaction + CONFIG.satisfaction.patronLeft, 0, 100);
  say(p.name + ': “' + pick(LEAVING_LINES) + '”');
  removePatron(p, 'left');
  renderHud();
}

function removePatron(p, how) {
  const i = S.patrons.indexOf(p);
  if (i >= 0) S.patrons.splice(i, 1);
  if (S.hand && S.hand.kind === 'patron' && S.hand.id === p.id) {
    S.hand = null;
    renderSlip();
    renderArmed();
  }
  dismissPatronEl(p.id, how);
}

/* ── Personal best ──────────────────────────────────────────────────────
   Kept per shift length, so a 2-minute run is never measured against a
   6-minute one. Storage can be unavailable (private windows, blocked site
   data), and a missing best is simply no best. */

function bestKey(minutes) { return 'quietstacks.best.' + minutes; }

function readBest(minutes) {
  try {
    const v = parseInt(localStorage.getItem(bestKey(minutes)), 10);
    return Number.isFinite(v) ? v : 0;
  } catch (e) { return 0; }
}

function writeBest(minutes, score) {
  try { localStorage.setItem(bestKey(minutes), String(score)); } catch (e) { /* fine */ }
}

/* ── End of shift ───────────────────────────────────────────────────────── */

function accuracy() {
  return S.shelved === 0 ? 1 : S.shelvedCorrect / S.shelved;
}

function objectivesMet() {
  return OBJECTIVES.every((o) => o.read(S) >= S.targets[o.id]);
}

function computeGrade() {
  const acc = accuracy();
  const streakGate = Math.max(8, Math.round(2.4 * S.minutes));
  if (objectivesMet() && acc >= 0.95 && S.satisfaction >= 90 && S.bestStreak >= streakGate) return 'S';
  if (objectivesMet()) return 'A';
  const partial = OBJECTIVES.every((o) => o.read(S) >= S.targets[o.id] * 0.6);
  if (partial && acc >= 0.7) return 'B';
  return 'C';
}

const GRADE_NOTES = {
  S: 'The stacks have never been tidier. Someone should give you a key.',
  A: 'A full shift, well kept. The evening librarian will notice.',
  B: 'A good, honest shift. A few things left leaning, but nothing lost.',
  C: 'Busy out there. The books are safe, and that is the main thing.',
};

function endShift() {
  S.phase = 'over';
  S.hand = null;
  S.timeLeft = 0;
  S.previousBest = readBest(S.minutes);
  S.newRecord = S.score > S.previousBest;
  if (S.newRecord) writeBest(S.minutes, S.score);
  renderSlip();
  renderArmed();
  renderHud();
  showResults();
  playCue('closing');
}


/* ==========================================================================
   5. RENDER
   ========================================================================== */

const $ = (id) => document.getElementById(id);

const elShelves   = $('shelves');
const elCart      = $('cart');
const elCartStack = $('cartStack');
const elCartCount = $('cartCount');
const elQueue     = $('queue');
const elQueueEmpty= $('queueEmpty');
const elSlip      = $('slip');
const elToast     = $('toast');
const elOverlay   = $('overlay');
const elCard      = $('overlayCard');
const elFx        = $('fx');

const shelfEls = {};       // genre id -> { root, spines }
const patronEls = new Map(); // patron id -> { root, fill }

function buildShelves() {
  elShelves.innerHTML = '';
  SHELVES.forEach((sh) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'shelf';
    btn.dataset.genre = sh.id;
    btn.style.setProperty('--sp', sh.color);
    btn.setAttribute('aria-label', sh.name + ' shelf');
    btn.innerHTML =
      '<span class="shelf-name">' + sh.name + '<span class="shelf-tag">' + sh.tag + '</span></span>' +
      '<span class="shelf-spines"></span>' +
      '<span class="shelf-plank"></span>';
    btn.addEventListener('click', () => chooseShelf(sh.id));
    elShelves.appendChild(btn);
    shelfEls[sh.id] = { root: btn, spines: btn.querySelector('.shelf-spines') };
  });
}

function shadeOf(base, i) {
  // Small deterministic variation so a shelf of spines doesn't look printed.
  const tweak = [0, 14, -12, 8, -6, 18, -16][i % 7];
  const n = parseInt(base.slice(1), 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255]
    .map((v) => clamp(v + tweak, 24, 235));
  return 'rgb(' + c.join(',') + ')';
}

/* One spine per recently shelved book, newest at the right. The label is the
   title; CSS truncates it to whatever the bay can fit, and the full title stays
   on the element (and in S.shelfHistory) regardless of what is shown. */
function addSpine(genreId, book) {
  const bay = shelfEls[genreId];
  const count = bay.spines.children.length;
  while (bay.spines.children.length >= CONFIG.shelfDisplayMax) {
    bay.spines.removeChild(bay.spines.firstChild);      // oldest slides out of view
  }
  const el = document.createElement('span');
  el.className = 'spine';
  el.style.setProperty('--sp', shadeOf(shelfById(genreId).color, count));
  el.style.height = (72 + ((count * 37) % 22)) + '%';   // slight variation, like real spines
  if (book) {
    el.title = book.author ? book.title + ' — ' + book.author : book.title;
    const label = document.createElement('span');
    label.className = 'spine-label';
    label.textContent = book.title;
    el.appendChild(label);
  }
  bay.spines.appendChild(el);
}

function flashShelf(genreId, kind) {
  const el = shelfEls[genreId].root;
  el.classList.remove('good', 'bad');
  void el.offsetWidth;                 // restart the animation
  el.classList.add(kind);
  setTimeout(() => el.classList.remove(kind), 600);
}

function renderAll() {
  renderCart();
  renderQueue();
  renderSlip();
  renderArmed();
  renderHud();
  renderPhase();
}

/* ── HUD (cheap, runs every frame) ──────────────────────────────────────── */

function renderHud() {
  const t = Math.ceil(S.timeLeft);
  $('clockTime').textContent = Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0');

  const pct = (S.elapsed / S.shiftSeconds) * 100;
  $('shiftFill').style.width = clamp(pct, 0, 100) + '%';
  $('shiftBar').setAttribute('aria-valuenow', Math.round(pct));
  $('shiftBar').classList.toggle('rush', S.phaseIndex >= CONFIG.phases.length - 1);

  $('scoreValue').textContent = S.score;
  $('streakValue').textContent = S.streak;
  $('streakBox').classList.toggle('hot', S.streak >= 3);

  $('goalBooksValue').textContent = S.shelved;
  $('goalPatronsValue').textContent = S.helped;
  $('goalBooksTarget').textContent = S.targets.books;
  $('goalPatronsTarget').textContent = S.targets.patrons;
  $('goalBooks').classList.toggle('done', S.shelved >= S.targets.books);
  $('goalPatrons').classList.toggle('done', S.helped >= S.targets.patrons);

  const mood = $('moodFill');
  mood.style.width = S.satisfaction + '%';
  mood.classList.toggle('low', S.satisfaction < 40);
  $('moodLabel').textContent =
    S.satisfaction >= 70 ? 'Calm' : S.satisfaction >= 40 ? 'Busy' : 'Frayed';

  // Patience bars live here so they move smoothly.
  S.patrons.forEach((p) => {
    const els = patronEls.get(p.id);
    if (!els) return;
    const frac = clamp(p.patience / p.maxPatience, 0, 1);
    els.fill.style.width = (frac * 100) + '%';
    els.fill.classList.toggle('mid', frac <= 0.6 && frac > 0.3);
    els.fill.classList.toggle('low', frac <= 0.3);
  });
}

function renderPhase() {
  $('clockPhase').textContent = currentPhase().label;
}

/* ── Cart ───────────────────────────────────────────────────────────────── */

function renderCart() {
  elCartCount.textContent = S.cart.length;

  // Rebuild only when the count changed, so drop animations don't restart.
  const stack = elCartStack;
  while (stack.children.length > S.cart.length) stack.removeChild(stack.lastChild);
  while (stack.children.length < S.cart.length) {
    const b = document.createElement('span');
    b.className = 'flat-book';
    stack.appendChild(b);
  }
  Array.from(stack.children).forEach((el, i) => {
    el.style.setProperty('--sp', shadeOf(UNSORTED_BOOK_COLOR, i + 3));
    el.classList.toggle('top', i === S.cart.length - 1);
  });
}

function nudgeCart() {
  elCart.classList.remove('nudge');
  void elCart.offsetWidth;
  elCart.classList.add('nudge');
}

/* ── Queue (reconciled so arrivals/departures can animate) ──────────────── */

function renderQueue() {
  const alive = new Set(S.patrons.map((p) => p.id));

  patronEls.forEach((els, id) => {
    if (!alive.has(id)) dismissPatronEl(id, 'left');
  });

  S.patrons.forEach((p) => {
    if (patronEls.has(p.id)) return;
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'patron';
    el.setAttribute('aria-label', p.name + ' is waiting');
    el.innerHTML =
      '<span class="bubble" aria-hidden="true">?</span>' +
      '<span class="face" style="--fc:' + p.color + '">' + p.name.charAt(0) + '</span>' +
      '<span class="patron-name">' + p.name + '</span>' +
      '<span class="patience"><span class="patience-fill"></span></span>';
    el.addEventListener('click', () => selectPatron(p.id));
    elQueue.appendChild(el);
    patronEls.set(p.id, { root: el, fill: el.querySelector('.patience-fill') });
  });

  elQueueEmpty.classList.toggle('hidden', S.patrons.length > 0);
}

function dismissPatronEl(id, how) {
  const els = patronEls.get(id);
  if (!els) return;
  patronEls.delete(id);
  const el = els.root;
  if (how === 'helped') el.classList.add('helped');
  setTimeout(() => {
    el.classList.add('leaving');
    setTimeout(() => el.remove(), 520);
  }, how === 'helped' ? 260 : 0);
  elQueueEmpty.classList.toggle('hidden', S.patrons.length > 0);
}

/* ── Desk slip (what's in hand) ─────────────────────────────────────────── */

function renderSlip() {
  const h = S.hand;
  elSlip.classList.remove('enter');
  void elSlip.offsetWidth;
  elSlip.classList.add('enter');

  if (!h) {
    elSlip.classList.add('idle');
    elSlip.innerHTML =
      '<p class="slip-hint">Tap the <b>return cart</b> to pick up the top book, ' +
      'or tap a <b>patron</b> to hear what they need.<br>Then tap a shelf.</p>';
    return;
  }

  elSlip.classList.remove('idle');

  if (h.kind === 'book') {
    elSlip.innerHTML =
      '<span class="slip-kicker">Returned book</span>' +
      '<div class="slip-title">' + esc(h.book.title) + '</div>' +
      (h.book.author ? '<div class="slip-author">' + esc(h.book.author) + '</div>' : '') +
      '<div class="slip-desc">' + esc(h.book.desc) + '</div>' +
      '<div class="slip-foot"><span class="slip-nudge">Which shelf?</span>' +
      '<button class="slip-back" type="button" id="backBtn">Back on the cart</button></div>';
    $('backBtn').addEventListener('click', putBack);
    return;
  }

  const p = S.patrons.find((x) => x.id === h.id);
  if (!p) { S.hand = null; renderSlip(); return; }
  elSlip.innerHTML =
    '<span class="slip-kicker">' + esc(p.name) + ' asks</span>' +
    '<div class="slip-ask">“' + esc(p.request.text) + '”</div>' +
    '<div class="slip-foot"><span class="slip-nudge">Point to a section.</span>' +
    '<button class="slip-back" type="button" id="backBtn">Just a moment</button></div>';
  $('backBtn').addEventListener('click', putBack);
}

function renderArmed() {
  const armed = !!S.hand;
  SHELVES.forEach((sh) => shelfEls[sh.id].root.classList.toggle('armed', armed));
  elCart.classList.toggle('armed', !armed && S.cart.length > 0 && S.phase === 'playing');
  patronEls.forEach((els, id) => {
    els.root.classList.toggle('armed', !!S.hand && S.hand.kind === 'patron' && S.hand.id === id);
  });
}

function esc(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

/* ── Toast + effects ────────────────────────────────────────────────────── */

let toastTimer = 0;
function say(text, tone) {
  elToast.textContent = text;
  elToast.className = 'toast';
  void elToast.offsetWidth;
  elToast.classList.add('show');
  if (tone) elToast.classList.add(tone);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => elToast.classList.remove('show'), 2200);
}

function flyBook(fromEl, toEl, genreId) {
  const a = fromEl.getBoundingClientRect();
  const b = toEl.getBoundingClientRect();
  const el = document.createElement('div');
  el.className = 'fly';
  el.style.setProperty('--sp', shelfById(genreId).color);
  el.style.left = (a.left + a.width / 2 - 17) + 'px';
  el.style.top = (a.top + 18) + 'px';
  elFx.appendChild(el);

  const dx = (b.left + b.width / 2) - (a.left + a.width / 2);
  const dy = (b.top + b.height * 0.6) - (a.top + 18);
  requestAnimationFrame(() => {
    el.style.transform = 'translate(' + dx + 'px,' + dy + 'px) rotate(' + (dx > 0 ? 14 : -14) + 'deg) scale(.7)';
    el.style.opacity = '0.15';
  });
  setTimeout(() => el.remove(), 560);
}

function floatScore(anchorEl, text, warn) {
  const r = anchorEl.getBoundingClientRect();
  const el = document.createElement('div');
  el.className = 'float-score' + (warn ? ' warn' : '');
  el.textContent = text;
  el.style.left = (r.left + r.width / 2) + 'px';
  el.style.top = (r.top + 8) + 'px';
  elFx.appendChild(el);
  setTimeout(() => el.remove(), 1000);
}

const MILESTONE_WORDS = ['the shelves approve', 'quietly magnificent', 'not a single wobble', 'the stacks are humming'];
function showMilestone(n) {
  const el = document.createElement('div');
  el.className = 'milestone';
  el.textContent = '✦ Streak ' + n + ' — ' + pick(MILESTONE_WORDS);
  elFx.appendChild(el);
  setTimeout(() => el.remove(), 1550);
  playCue('streak');
}

/* ── Overlays ───────────────────────────────────────────────────────────── */

function hideOverlay() { elOverlay.classList.add('hidden'); }

let chosenMinutes = CONFIG.defaultMinutes;

function showTitle() {
  elOverlay.classList.remove('hidden');
  elCard.innerHTML =
    '<h1>Quiet Stacks</h1>' +
    '<p class="sub">One short shift</p>' +
    '<p>The reading room is yours for <b id="tMins"></b>. Returns keep arriving; ' +
    'so do people with questions. Nothing here is urgent, exactly.</p>' +
    '<ul class="rules">' +
      '<li><i>1</i><span>Tap the <b>return cart</b> for the top book, read it, then tap the shelf it belongs on.</span></li>' +
      '<li><i>2</i><span>Tap a <b>patron</b> to hear their request, then tap the section that answers it.</span></li>' +
      '<li><i>3</i><span>Everyone waiting is a little less calm. Patience runs out gently, and politely.</span></li>' +
      '<li><i>4</i><span>Goal: shelve <b id="tBooks"></b> books and help <b id="tPatrons"></b> patrons before closing.</span></li>' +
    '</ul>' +
    '<span class="slip-kicker">Shift length</span>' +
    '<div class="lengths">' +
      CONFIG.shiftChoices.map((m) =>
        '<button class="len" type="button" data-min="' + m + '">' + m + ' min</button>').join('') +
    '</div>' +
    '<p class="best-line" id="bestLine"></p>' +
    '<button class="btn" type="button" id="beginBtn">Begin the shift</button>';

  const showTargets = () => {
    const t = targetsFor(chosenMinutes);
    $('tBooks').textContent = t.books;
    $('tPatrons').textContent = t.patrons;
    $('tMins').textContent = chosenMinutes + ' minutes';
    const best = readBest(chosenMinutes);
    $('bestLine').textContent = best ? 'Your best ' + chosenMinutes + '-minute shift: ' + best : '';
    elCard.querySelectorAll('.len').forEach((b) =>
      b.classList.toggle('on', Number(b.dataset.min) === chosenMinutes));
  };
  elCard.querySelectorAll('.len').forEach((b) => b.addEventListener('click', () => {
    chosenMinutes = Number(b.dataset.min);
    showTargets();
    playCue('pickup');
  }));
  showTargets();
  $('beginBtn').addEventListener('click', () => startShift(chosenMinutes));
}

function showConfirmRestart() {
  S.phase = 'paused';
  elOverlay.classList.remove('hidden');
  elCard.innerHTML =
    '<h2>Start over?</h2>' +
    '<p class="sub">The shift so far</p>' +
    '<p>You are ' + Math.round((S.elapsed / S.shiftSeconds) * 100) + '% through, with ' +
    S.shelved + ' shelved and ' + S.helped + ' helped. Beginning again clears all of it.</p>' +
    '<button class="btn" type="button" id="confirmBtn">Yes, fresh shift</button>' +
    '<button class="btn ghost" type="button" id="cancelBtn">No, back to work</button>';
  $('confirmBtn').addEventListener('click', () => startShift(S.minutes));
  $('cancelBtn').addEventListener('click', () => {
    S.phase = 'playing';
    lastFrame = performance.now();
    hideOverlay();
  });
}

function showResults() {
  const acc = Math.round(accuracy() * 100);
  const grade = computeGrade();
  const rows = [
    ['Books shelved', S.shelved + ' / ' + S.targets.books, S.shelved >= S.targets.books],
    ['Shelving accuracy', S.shelved ? acc + '%' : '—', S.shelved > 0 && acc >= 95],
    ['Patrons helped', S.helped + ' / ' + S.targets.patrons, S.helped >= S.targets.patrons],
    ['Satisfaction', Math.round(S.satisfaction) + '%', S.satisfaction >= 90],
    ['Best streak', String(S.bestStreak), S.bestStreak >= Math.max(8, Math.round(2.4 * S.minutes))],
    ['Final score', String(S.score), false],
    [S.newRecord ? 'Previous best' : 'Your best (' + S.minutes + ' min)',
     String(S.previousBest || '—'), false],
  ];

  elOverlay.classList.remove('hidden');
  elCard.innerHTML =
    '<h2>Closing time</h2>' +
    '<p class="sub">' + (S.newRecord && S.previousBest ? 'New personal best' : 'Shift complete') + '</p>' +
    '<div class="grade">' + grade + '</div>' +
    '<div class="results">' +
      rows.map(([label, value, met]) =>
        '<div class="result-row' + (met ? ' met' : '') + '"><span>' + label + '</span><b>' + value + '</b></div>'
      ).join('') +
    '</div>' +
    '<p class="verdict">' + GRADE_NOTES[grade] + '</p>' +
    '<button class="btn" type="button" id="againBtn">Take another shift</button>';
  $('againBtn').addEventListener('click', () => startShift(S.minutes));
}


/* ==========================================================================
   6. INPUT, SOUND, LOOP
   ========================================================================== */

let audioCtx = null;
let soundOn = true;

/* Cues are two-note figures rather than single beeps, so right and wrong differ
   in direction and timbre and not only in pitch: anything good rises on a clear
   sine, anything wrong falls on a duller triangle. Still quiet enough to live
   in a library. */
const CUES = {
  pickup:  [{ f: 523, at: 0,     d: 0.07, g: 0.030, t: 'sine' }],
  right:   [{ f: 659, at: 0,     d: 0.10, g: 0.050, t: 'sine' },
            { f: 988, at: 0.070, d: 0.20, g: 0.045, t: 'sine' }],
  helped:  [{ f: 587, at: 0,     d: 0.10, g: 0.048, t: 'sine' },
            { f: 880, at: 0.070, d: 0.13, g: 0.044, t: 'sine' },
            { f: 1175, at: 0.140, d: 0.22, g: 0.038, t: 'sine' }],
  wrong:   [{ f: 311, at: 0,     d: 0.16, g: 0.055, t: 'triangle' },
            { f: 233, at: 0.105, d: 0.30, g: 0.050, t: 'triangle' }],
  streak:  [{ f: 784, at: 0,     d: 0.12, g: 0.040, t: 'sine' },
            { f: 1047, at: 0.090, d: 0.14, g: 0.036, t: 'sine' },
            { f: 1568, at: 0.180, d: 0.28, g: 0.030, t: 'sine' }],
  closing: [{ f: 440, at: 0,     d: 0.45, g: 0.040, t: 'sine' },
            { f: 330, at: 0.220, d: 0.60, g: 0.036, t: 'sine' }],
};

function playCue(name) {
  const cue = CUES[name];
  if (!soundOn || !cue) return;
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const start = audioCtx.currentTime;
    cue.forEach((n) => {
      const osc = audioCtx.createOscillator();
      const amp = audioCtx.createGain();
      osc.type = n.t;
      osc.frequency.value = n.f;
      osc.connect(amp).connect(audioCtx.destination);
      const t0 = start + n.at;
      amp.gain.setValueAtTime(0.0001, t0);
      amp.gain.linearRampToValueAtTime(n.g, t0 + 0.015);
      amp.gain.exponentialRampToValueAtTime(0.0001, t0 + n.d);
      osc.start(t0);
      osc.stop(t0 + n.d + 0.02);
    });
  } catch (e) { /* audio is a nicety, never a requirement */ }
}

$('restartBtn').addEventListener('click', () => {
  if (S.phase !== 'playing') { startShift(chosenMinutes); return; }
  showConfirmRestart();
});

$('soundBtn').addEventListener('click', () => {
  soundOn = !soundOn;
  $('soundBtn').setAttribute('aria-pressed', String(soundOn));
  $('soundIcon').textContent = soundOn ? '♪' : '×';
  if (soundOn) playCue('pickup');
});

elCart.addEventListener('click', takeTopBook);

document.addEventListener('keydown', (e) => {
  if (S && S.phase !== 'playing') return;
  if (e.key === 'Escape') putBack();
  else if (e.key === '1' || e.key === '2' || e.key === '3') {
    const sh = SHELVES[Number(e.key) - 1];
    if (sh) chooseShelf(sh.id);
  } else if (e.key === ' ') { e.preventDefault(); takeTopBook(); }
});

function loop(now) {
  rafId = requestAnimationFrame(loop);
  const dt = Math.min(0.1, (now - lastFrame) / 1000);   // also covers backgrounded tabs
  lastFrame = now;
  if (S && S.phase === 'playing') {
    update(dt);
    renderHud();
  }
}

/* Boot */
S = createState(CONFIG.defaultMinutes);
buildShelves();
renderAll();
showTitle();
lastFrame = performance.now();
rafId = requestAnimationFrame(loop);
