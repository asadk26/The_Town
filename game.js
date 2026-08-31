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

/* Shelves are data, so another section is one line here plus its books.
   `short` is what fits on the bay label; `name` is what the librarian says. */
const SHELVES = [
  { id: 'fantasy',   name: 'Fantasy',         tag: 'wonder & wilds',   color: '#6f6cb0' },
  { id: 'mystery',   name: 'Mystery',         tag: 'clues & culprits', color: '#4e7f8c' },
  { id: 'biography', name: 'Biography',       tag: 'real lives',       color: '#a9714a' },
  // Unlocked in this order; a shift uses the first `shelfCount` of them.
  { id: 'scifi',     name: 'Science Fiction', tag: 'futures & ships',  color: '#4a6fa5', short: 'Sci-Fi' },
  { id: 'history',   name: 'History',         tag: 'what happened',    color: '#6f8659' },
];

const MODES = [
  { id: 'normal', name: 'Normal',       blurb: 'Returns as they come.' },
  { id: 'coffee', name: 'Coffee Spill', blurb: 'Some returns come back stained.' },
];

const SHELF_TIERS = [3, 4, 5];

/* Invented for this game — 30 titles, several deliberately slippery, so the
   description is sometimes the only tell. */
const INVENTED_BOOKS = [
  // ── Fantasy ──────────────────────────────────────────────────────────────
  { title: 'The Salt Lantern',          genre: 'fantasy',   desc: 'A lighthouse flame is a dragon’s last breath.', isRealBook: false },
  { title: 'Copper for the Crow King',  genre: 'fantasy',   desc: 'An apprentice bargains with a court of talking crows.', isRealBook: false },
  { title: 'Ninefold Morning',          genre: 'fantasy',   desc: 'One sunrise repeats until a girl recalls a forgotten name.', isRealBook: false },
  { title: 'The Quiet Between Bells',   genre: 'fantasy',   desc: 'Two apprentice mages find a sleeping god upstairs.', isRealBook: false },
  { title: 'Wolfwater',                 genre: 'fantasy',   desc: 'A wish-granting river starts asking for the wishes back.', isRealBook: false },
  { title: 'The Cartographer’s Third Hand', genre: 'fantasy', desc: 'Roads this mapmaker draws appear by morning.', isRealBook: false },
  { title: 'Bone Orchard Hymn',         genre: 'fantasy',   desc: 'An orchard grown from a giant’s ribs must be sung to sleep.', isRealBook: false },
  { title: 'Harrow & Thimble',          genre: 'fantasy',   desc: 'A village tailor stitches armour out of moonlight.', isRealBook: false },
  { title: 'The Last Cinder Fair',      genre: 'fantasy',   desc: 'A runaway trades her shadow for a paper crown.', isRealBook: false },
  { title: 'Glasswing Rebellion',       genre: 'fantasy',   desc: 'Moth-riders wage a gentle war on a clockwork mountain.', isRealBook: false },

  // ── Mystery ──────────────────────────────────────────────────────────────
  { title: 'The Wrong Piano',           genre: 'mystery',   desc: 'A dead man’s fingerprint on a locked hall’s piano.', isRealBook: false },
  { title: 'Six Empty Chairs',          genre: 'mystery',   desc: 'The place cards list one guest too many.', isRealBook: false },
  { title: 'The Marmalade Alibi',       genre: 'mystery',   desc: 'A baker’s flawless breakfast timeline breaks a confession.', isRealBook: false },
  { title: 'Low Tide, No Witnesses',    genre: 'mystery',   desc: 'A seaside inspector investigates a disappearing crime scene.', isRealBook: false },
  { title: 'The Understudy Knows',      genre: 'mystery',   desc: 'Everyone saw the accident; the understudy saw it twice.', isRealBook: false },
  { title: 'A Ledger of Small Lies',    genre: 'mystery',   desc: 'Tidy accounts hide a decade of missing persons.', isRealBook: false },
  { title: 'The Blue Hour Case',        genre: 'mystery',   desc: 'Dusk photographs keep showing a woman who wasn’t there.', isRealBook: false },
  { title: 'Nobody Rings Twice at Elmsleigh', genre: 'mystery', desc: 'Hotel guests vanish in the order they checked in.', isRealBook: false },
  { title: 'The Botanist’s Mistake', genre: 'mystery', desc: 'A locked greenhouse poison accuses the wrong gardener.', isRealBook: false },
  { title: 'Return Address Unknown',    genre: 'mystery',   desc: 'Letters from a dead man arrive with fresh postmarks.', isRealBook: false },

  // ── Biography ────────────────────────────────────────────────────────────
  { title: 'Salt in the Mortar',        genre: 'biography', desc: 'The apothecary who mapped an epidemic house by house.', isRealBook: false },
  { title: 'The Woman Who Counted Birds', genre: 'biography', desc: 'Sixty years of one ornithologist’s migration notebooks.', isRealBook: false },
  { title: 'Bricklayer, Poet, Mayor',   genre: 'biography', desc: 'A self-taught mason talks his way into office.', isRealBook: false },
  { title: 'Letters to a Younger Engineer', genre: 'biography', desc: 'Six decades of a bridge-builder’s correspondence.', isRealBook: false },
  { title: 'Hands Like That',           genre: 'biography', desc: 'A surgeon returns from abroad to her village clinic.', isRealBook: false },
  { title: 'The Cartwright of Vesey Street', genre: 'biography', desc: 'A wheelwright whose order books recorded a lost neighbourhood.', isRealBook: false },
  { title: 'Second Violin',             genre: 'biography', desc: 'Forty years seated one place from the spotlight.', isRealBook: false },
  { title: 'A Life in Nine Kitchens',   genre: 'biography', desc: 'A chef’s life told through nine kitchens.', isRealBook: false },
  { title: 'Field Notes for My Daughter', genre: 'biography', desc: 'An Arctic researcher’s journals, written as letters home.', isRealBook: false },
  { title: 'The Man Who Fixed Clocks',  genre: 'biography', desc: 'The horologist who kept a whole city on time.', isRealBook: false },

  // ── Science Fiction ──────────────────────────────────────────────────────
  { title: 'The Lantern of Enceladus', genre: 'scifi', desc: 'A crew on Saturn’s moon finds the ice transmitting.', isRealBook: false },
  { title: 'Slow Light',            genre: 'scifi', desc: 'A generation ship hears from its destination far too early.', isRealBook: false },
  { title: 'Salvage Rites',         genre: 'scifi', desc: 'Scavengers board a derelict whose crew still breathes.', isRealBook: false },
  { title: 'The Tenth Colony',      genre: 'scifi', desc: 'Nine colonies went silent; the tenth ship investigates.', isRealBook: false },
  { title: 'Grain of the Sky',      genre: 'scifi', desc: 'Terraformers argue over a world that may be occupied.', isRealBook: false },
  { title: 'The Quiet Engine',      genre: 'scifi', desc: 'A starship’s drive makes course changes nobody ordered.', isRealBook: false },
  { title: 'Ninety Days of Rain',   genre: 'scifi', desc: 'Two keepers run the last weather station on a drowned Earth.', isRealBook: false },
  { title: 'Copperhead Station',    genre: 'scifi', desc: 'An orbital refinery votes to leave its company.', isRealBook: false },
  { title: 'Europa, Standing',      genre: 'scifi', desc: 'A city under Europa’s ice was not built by people.', isRealBook: false },
  { title: 'The Patience of Machines', genre: 'scifi', desc: 'A caretaker robot outlives the colony it served.', isRealBook: false },

  // ── History ──────────────────────────────────────────────────────────────
  { title: 'The Bread Riots of Marrow Street', genre: 'history', desc: 'Three weeks a city’s bakers stopped work.', isRealBook: false },
  { title: 'Charter and Chain',     genre: 'history', desc: 'How a market town bought its charter, and the debt after.', isRealBook: false },
  { title: 'The Long Winter Count', genre: 'history', desc: 'A century of one community’s winter records.', isRealBook: false },
  { title: 'Ledgers of the Salt Road', genre: 'history', desc: 'Caravan trade reconstructed from surviving account books.', isRealBook: false },
  { title: 'What the Tannery Knew', genre: 'history', desc: 'A trade and a city quarter, told through one street.', isRealBook: false },
  { title: 'The Cholera Summer',    genre: 'history', desc: 'How a river city organised itself through an outbreak.', isRealBook: false },
  { title: 'Six Harvests',          genre: 'history', desc: 'Six failed harvests and the roads out of the region.', isRealBook: false },
  { title: 'The Weavers’ Strike',   genre: 'history', desc: 'A mill town’s stoppage, from company and union records.', isRealBook: false },
  { title: 'Empire of Tin',         genre: 'history', desc: 'How one dull metal decided three centuries of trade.', isRealBook: false },
  { title: 'The Ash Year',          genre: 'history', desc: 'A volcanic winter, failed crops, fallen governments.', isRealBook: false },
];

/* Real published books. Descriptions are written for this game, not copied.
   An `author` is what marks a shelf card as a real one. */
const REAL_BOOKS = [
  // ── Fantasy ──────────────────────────────────────────────────────────────
  { title: 'The Hobbit', author: 'J.R.R. Tolkien', genre: 'fantasy', desc: 'A comfortable hobbit joins a quest against a dragon.', isRealBook: true },
  { title: 'A Wizard of Earthsea', author: 'Ursula K. Le Guin', genre: 'fantasy', desc: 'A young wizard sails to face the shadow he loosed.', isRealBook: true },
  { title: 'Howl’s Moving Castle', author: 'Diana Wynne Jones', genre: 'fantasy', desc: 'A cursed hatmaker keeps house in a walking castle.', isRealBook: true },
  { title: 'The Lion, the Witch and the Wardrobe', author: 'C.S. Lewis', genre: 'fantasy', desc: 'Four children find a country locked in winter.', isRealBook: true },
  { title: 'The Name of the Wind', author: 'Patrick Rothfuss', genre: 'fantasy', desc: 'An innkeeper recounts becoming a notorious magician.', isRealBook: true },
  { title: 'Piranesi', author: 'Susanna Clarke', genre: 'fantasy', desc: 'A man lives in an endless house of statues and tides.', isRealBook: true },
  { title: 'The Fifth Season', author: 'N.K. Jemisin', genre: 'fantasy', desc: 'A woman with earth-moving power hunts her stolen daughter.', isRealBook: true },
  { title: 'Uprooted', author: 'Naomi Novik', genre: 'fantasy', desc: 'A village girl is taken by the wizard guarding her valley.', isRealBook: true },
  { title: 'The Last Unicorn', author: 'Peter S. Beagle', genre: 'fantasy', desc: 'The last unicorn goes looking for the others.', isRealBook: true },
  { title: 'Sabriel', author: 'Garth Nix', genre: 'fantasy', desc: 'A necromancer’s daughter seeks her father among the dead.', isRealBook: true },

  // ── Mystery ──────────────────────────────────────────────────────────────
  { title: 'The Hound of the Baskervilles', author: 'Arthur Conan Doyle', genre: 'mystery', desc: 'Holmes investigates a spectral hound on the moors.', isRealBook: true },
  { title: 'Murder on the Orient Express', author: 'Agatha Christie', genre: 'mystery', desc: 'A snowbound train, twelve suspects, one stabbed passenger.', isRealBook: true },
  { title: 'The Maltese Falcon', author: 'Dashiell Hammett', genre: 'mystery', desc: 'A detective hunts a jewelled statuette worth killing for.', isRealBook: true },
  { title: 'The Big Sleep', author: 'Raymond Chandler', genre: 'mystery', desc: 'A blackmail case for a dying general turns worse.', isRealBook: true },
  { title: 'Gaudy Night', author: 'Dorothy L. Sayers', genre: 'mystery', desc: 'An Oxford college hides a poison-pen writer.', isRealBook: true },
  { title: 'The Moonstone', author: 'Wilkie Collins', genre: 'mystery', desc: 'A cursed diamond vanishes from a country house.', isRealBook: true },
  { title: 'The Girl with the Dragon Tattoo', author: 'Stieg Larsson', genre: 'mystery', desc: 'A journalist and a hacker reopen a cold disappearance.', isRealBook: true },
  { title: 'In the Woods', author: 'Tana French', genre: 'mystery', desc: 'A detective works a murder in the wood where he vanished.', isRealBook: true },
  { title: 'The No. 1 Ladies’ Detective Agency', author: 'Alexander McCall Smith', genre: 'mystery', desc: 'Botswana’s first female private detective opens for business.', isRealBook: true },
  { title: 'The Thursday Murder Club', author: 'Richard Osman', genre: 'mystery', desc: 'Retirement-village friends take on a very fresh case.', isRealBook: true },

  // ── Biography ────────────────────────────────────────────────────────────
  { title: 'The Diary of a Young Girl', author: 'Anne Frank', genre: 'biography', desc: 'A teenager’s diary from two years in hiding.', isRealBook: true },
  { title: 'Long Walk to Freedom', author: 'Nelson Mandela', genre: 'biography', desc: 'From a Transkei village, through prison, to the presidency.', isRealBook: true },
  { title: 'I Know Why the Caged Bird Sings', author: 'Maya Angelou', genre: 'biography', desc: 'Growing up in the segregated South, and years of silence.', isRealBook: true },
  { title: 'The Immortal Life of Henrietta Lacks', author: 'Rebecca Skloot', genre: 'biography', desc: 'The woman whose cells were taken and never stopped dividing.', isRealBook: true },
  { title: 'Educated', author: 'Tara Westover', genre: 'biography', desc: 'Raised without schooling, she reaches a Cambridge doctorate.', isRealBook: true },
  { title: 'Steve Jobs', author: 'Walter Isaacson', genre: 'biography', desc: 'An authorised portrait of Apple’s founder.', isRealBook: true },
  { title: 'Alexander Hamilton', author: 'Ron Chernow', genre: 'biography', desc: 'The orphaned immigrant who built America’s financial system.', isRealBook: true },
  { title: 'The Wright Brothers', author: 'David McCullough', genre: 'biography', desc: 'Two bicycle makers teach themselves to fly.', isRealBook: true },
  { title: 'A Beautiful Mind', author: 'Sylvia Nasar', genre: 'biography', desc: 'A mathematician’s illness and improbable return to work.', isRealBook: true },
  { title: 'Becoming', author: 'Michelle Obama', genre: 'biography', desc: 'A former First Lady on the South Side and after.', isRealBook: true },

  // ── Added in v0.2: a mix of recognisable and deliberately misleading ──
  { title: 'The Princess Bride', author: 'William Goldman', genre: 'fantasy', desc: 'A farmhand turned pirate crosses a kingdom of swordsmen.', isRealBook: true },
  { title: 'Good Omens', author: 'Terry Pratchett and Neil Gaiman', genre: 'fantasy', desc: 'An angel and a demon misplace the Antichrist.', isRealBook: true },
  { title: 'The Golden Compass', author: 'Philip Pullman', genre: 'fantasy', desc: 'A girl and her animal-shaped soul travel north.', isRealBook: true },
  { title: 'Stardust', author: 'Neil Gaiman', genre: 'fantasy', desc: 'A young man crosses a wall to fetch a fallen star.', isRealBook: true },
  { title: 'And Then There Were None', author: 'Agatha Christie', genre: 'mystery', desc: 'Ten strangers on an island, killed one by one.', isRealBook: true },
  { title: 'The Cuckoo’s Calling', author: 'Robert Galbraith', genre: 'mystery', desc: 'A detective reopens a supermodel’s fall from a balcony.', isRealBook: true },
  { title: 'Devil in a Blue Dress', author: 'Walter Mosley', genre: 'mystery', desc: 'A laid-off worker becomes a detective by accident.', isRealBook: true },
  { title: 'Still Life', author: 'Louise Penny', genre: 'mystery', desc: 'A village painter is found dead in the woods.', isRealBook: true },
  { title: 'Hidden Figures', author: 'Margot Lee Shetterly', genre: 'biography', desc: 'The Black women mathematicians behind American spaceflight.', isRealBook: true },
  { title: 'Unbroken', author: 'Laura Hillenbrand', genre: 'biography', desc: 'An Olympic runner survives a crash, the sea and captivity.', isRealBook: true },
  { title: 'Born a Crime', author: 'Trevor Noah', genre: 'biography', desc: 'A comedian’s childhood, when his parents’ love was illegal.', isRealBook: true },
  { title: 'The Glass Castle', author: 'Jeannette Walls', genre: 'biography', desc: 'A journalist recalls her brilliant, chaotic, homeless parents.', isRealBook: true },

  // ── Science Fiction ──────────────────────────────────────────────────────
  { title: 'Dune', author: 'Frank Herbert', genre: 'scifi', desc: 'A ducal heir, a desert planet, and the spice beneath.', isRealBook: true },
  { title: 'The Left Hand of Darkness', author: 'Ursula K. Le Guin', genre: 'scifi', desc: 'An envoy on a frozen world with no fixed sex.', isRealBook: true },
  { title: 'Neuromancer', author: 'William Gibson', genre: 'scifi', desc: 'A burnt-out hacker takes one last run through cyberspace.', isRealBook: true },
  { title: 'The Martian', author: 'Andy Weir', genre: 'scifi', desc: 'An astronaut left on Mars survives on botany and arithmetic.', isRealBook: true },
  { title: 'Ender’s Game', author: 'Orson Scott Card', genre: 'scifi', desc: 'A gifted child is trained in an orbital battle school.', isRealBook: true },
  { title: 'Snow Crash', author: 'Neal Stephenson', genre: 'scifi', desc: 'A pizza courier chases a drug that infects computers.', isRealBook: true },
  { title: 'Kindred', author: 'Octavia E. Butler', genre: 'scifi', desc: 'A woman in 1976 is pulled back to a plantation.', isRealBook: true },
  { title: 'Project Hail Mary', author: 'Andy Weir', genre: 'scifi', desc: 'A man wakes far from Earth with no memory.', isRealBook: true },
  { title: 'Klara and the Sun', author: 'Kazuo Ishiguro', genre: 'scifi', desc: 'An artificial friend waits in a shop window.', isRealBook: true },
  { title: 'The Three-Body Problem', author: 'Cixin Liu', genre: 'scifi', desc: 'A signal from a radio observatory is answered.', isRealBook: true },
  { title: 'Station Eleven', author: 'Emily St. John Mandel', genre: 'scifi', desc: 'A troupe performs Shakespeare twenty years after a pandemic.', isRealBook: true },
  { title: 'The War of the Worlds', author: 'H.G. Wells', genre: 'scifi', desc: 'Martian machines land in the English countryside.', isRealBook: true },
  { title: 'Do Androids Dream of Electric Sheep?', author: 'Philip K. Dick', genre: 'scifi', desc: 'A bounty hunter retires androids he can barely identify.', isRealBook: true },
  { title: 'Fahrenheit 451', author: 'Ray Bradbury', genre: 'scifi', desc: 'A fireman who burns books begins keeping one.', isRealBook: true },

  // ── History ──────────────────────────────────────────────────────────────
  { title: 'SPQR', author: 'Mary Beard', genre: 'history', desc: 'A thousand years of Rome, village to empire.', isRealBook: true },
  { title: 'Guns, Germs, and Steel', author: 'Jared Diamond', genre: 'history', desc: 'Geography and crops, not people, decided who conquered.', isRealBook: true },
  { title: 'The Guns of August', author: 'Barbara W. Tuchman', genre: 'history', desc: 'The first month of the First World War.', isRealBook: true },
  { title: '1491', author: 'Charles C. Mann', genre: 'history', desc: 'The Americas before Columbus, and how Europe misread them.', isRealBook: true },
  { title: 'Sapiens', author: 'Yuval Noah Harari', genre: 'history', desc: 'The whole human past, foraging bands to empires.', isRealBook: true },
  { title: 'The Silk Roads', author: 'Peter Frankopan', genre: 'history', desc: 'World history with central Asia at the centre.', isRealBook: true },
  { title: 'A People’s History of the United States', author: 'Howard Zinn', genre: 'history', desc: 'America told from workers, strikers and the conquered.', isRealBook: true },
  { title: 'The Rise and Fall of the Third Reich', author: 'William L. Shirer', genre: 'history', desc: 'Twelve years of Nazi Germany, from its own records.', isRealBook: true },
  { title: 'Team of Rivals', author: 'Doris Kearns Goodwin', genre: 'history', desc: 'The Civil War cabinet built from Lincoln’s opponents.', isRealBook: true },
  { title: 'Salt: A World History', author: 'Mark Kurlansky', genre: 'history', desc: 'Wars, taxes and towns traced through one mineral.', isRealBook: true },
  { title: 'Bury My Heart at Wounded Knee', author: 'Dee Brown', genre: 'history', desc: 'The conquest of the West, recorded by the dispossessed.', isRealBook: true },
  { title: 'The Warmth of Other Suns', author: 'Isabel Wilkerson', genre: 'history', desc: 'Six million people leaving the American South.', isRealBook: true },
  { title: 'Genghis Khan and the Making of the Modern World', author: 'Jack Weatherford', genre: 'history', desc: 'How Mongol conquest rewired trade and law.', isRealBook: true },
  { title: 'A Distant Mirror', author: 'Barbara W. Tuchman', genre: 'history', desc: 'Plague, war and schism in fourteenth-century Europe.', isRealBook: true },
];

/* The shelf draws from both. Drop either list to run on one alone. */
const BOOKS = INVENTED_BOOKS.concat(REAL_BOOKS);

/* Patron request type A: "where do I find books about X?" — 15 phrasings. */
const TOPIC_ASKS = [
  // Fantasy
  { genre: 'fantasy',   text: 'Where do you keep the fantasy novels?' },
  { genre: 'fantasy',   text: 'Where would I find books about dragons?' },
  { genre: 'fantasy',   text: 'My nephew has decided he loves wizards. Which way?' },
  { genre: 'fantasy',   text: 'I want to get lost somewhere that doesn’t exist.' },
  { genre: 'fantasy',   text: 'It’s raining. Something with a quest in it?' },
  { genre: 'fantasy',   text: 'Anything with faeries who make bad bargains?' },
  { genre: 'fantasy',   text: 'Enchanted forests. That’s the whole request, sorry.' },
  { genre: 'fantasy',   text: 'Something with magic, for a long train ride.' },
  { genre: 'fantasy',   text: 'Knights, but the impossible kind. Where do I look?' },
  { genre: 'fantasy',   text: 'My book club wants swords and prophecies this month.' },
  { genre: 'fantasy',   text: 'I’d like a world with its own maps and languages.' },
  { genre: 'fantasy',   text: 'Do you shelve the talking-animal kingdoms anywhere?' },

  // Mystery
  { genre: 'mystery',   text: 'Where do you shelve the detective novels?' },
  { genre: 'mystery',   text: 'I’m in the mood for a good whodunit.' },
  { genre: 'mystery',   text: 'A locked-room puzzle, the fussier the better.' },
  { genre: 'mystery',   text: 'A small village and one very suspicious vicar?' },
  { genre: 'mystery',   text: 'Books about stolen paintings and the people chasing them?' },
  { genre: 'mystery',   text: 'A missing-persons case that actually gets solved, please.' },
  { genre: 'mystery',   text: 'I want to guess the culprit and be wrong.' },
  { genre: 'mystery',   text: 'Something with a detective who drinks too much coffee.' },
  { genre: 'mystery',   text: 'My train is an hour. Give me a puzzle.' },
  { genre: 'mystery',   text: 'Anything where the alibi turns out to be the clue?' },
  { genre: 'mystery',   text: 'I like a courtroom twist. Which way?' },
  { genre: 'mystery',   text: 'Where would I find the cosy crime shelf?' },

  // Biography
  { genre: 'biography', text: 'Where are the life stories kept?' },
  { genre: 'biography', text: 'A chef’s memoir — real kitchens, real disasters.' },
  { genre: 'biography', text: 'Something about a real person who changed science?' },
  { genre: 'biography', text: 'Accounts by explorers who genuinely went there?' },
  { genre: 'biography', text: 'A musician’s life story for the train home.' },
  { genre: 'biography', text: 'Somebody who quietly changed their own town.' },
  { genre: 'biography', text: 'I want one person’s whole life, start to finish.' },
  { genre: 'biography', text: 'Something true, told by the person who lived it.' },
  { genre: 'biography', text: 'A memoir about a difficult childhood, if you have one.' },
  { genre: 'biography', text: 'Where do the letters-and-diaries books live?' },
  { genre: 'biography', text: 'An artist’s life, warts and all?' },
  { genre: 'biography', text: 'I’d like a portrait of one stubborn individual.' },

  // Science Fiction
  { genre: 'scifi',     text: 'Where is the science fiction shelved?' },
  { genre: 'scifi',     text: 'Something about people living on another planet.' },
  { genre: 'scifi',     text: 'Stories where the robots start thinking for themselves?' },
  { genre: 'scifi',     text: 'Anything with spaceships, but not too technical?' },
  { genre: 'scifi',     text: 'A future that went badly wrong, please.' },
  { genre: 'scifi',     text: 'My son wants engines that break in deep space.' },
  { genre: 'scifi',     text: 'I’m in the mood for something set centuries ahead.' },
  { genre: 'scifi',     text: 'Where would I find the time-travel books?' },
  { genre: 'scifi',     text: 'First contact, but not a war story?' },
  { genre: 'scifi',     text: 'Anything where the science is the puzzle?' },
  { genre: 'scifi',     text: 'I’d like a colony that stops answering.' },
  { genre: 'scifi',     text: 'Books about cities under ice or on the sea floor?' },

  // History
  { genre: 'history',   text: 'Where’s the history section?' },
  { genre: 'history',   text: 'I want something about ancient wars and empires.' },
  { genre: 'history',   text: 'How ordinary people lived a few centuries ago.' },
  { genre: 'history',   text: 'Proper accounts of the world wars?' },
  { genre: 'history',   text: 'Old trade routes and the cities they made rich?' },
  { genre: 'history',   text: 'I want what actually happened, not a novel about it.' },
  { genre: 'history',   text: 'Something about a plague, and how a city coped.' },
  { genre: 'history',   text: 'How one industry shaped a whole town?' },
  { genre: 'history',   text: 'I’d like a book with a lot of footnotes, honestly.' },
  { genre: 'history',   text: 'Where do you keep the books about revolutions?' },
  { genre: 'history',   text: 'Something about a century, not a person.' },
  { genre: 'history',   text: 'Trade, taxes and empires. That sort of thing.' },
];

/* Patron request type B: locating a specific book the player has handled. */
const BOOK_ASKS = [
  'I’m after “{title}” — which section?',
  'My book club chose “{title}”. Where is it?',
  'A friend swears by “{title}”. Which shelf?',
  'Could you point me to “{title}”?',
  'I returned “{title}” last week and want it again.',
  'Someone reserved “{title}” for me. Where do I collect it?',
  'Is “{title}” back on the shelf yet? Which one?',
  'I’ve been circling for ages looking for “{title}”.',
];

/* Type C: remembering a real book from earlier in the shift. Only ever asked
   about real titles, which are recognisable enough to recall once seen. */
const MEMORY_ASKS = [
  'I liked “{title}”. Where should I look for something similar?',
  'I loved “{title}”. Where should I browse for something like it?',
  'I finished “{title}” on the bus. What else is in that part?',
  'Someone lent me “{title}” — where are the rest of those?',
  'If I enjoyed “{title}”, which section should I be browsing?',
  'My last one was “{title}”. Point me back to that shelf?',
  'More like “{title}”, please. Which way?',
  '“{title}” was a good one. Where are its neighbours?',
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

/* The shift IS this list: it ends the moment every objective is met. Targets
   live here and nowhere else. */
const OBJECTIVES = [
  { id: 'books',   label: 'Books shelved',  target: 8, read: (s) => s.shelved },
  { id: 'patrons', label: 'Patrons helped', target: 6, read: (s) => s.helped },
];


/* ==========================================================================
   2. CONFIG
   ========================================================================== */

const CONFIG = {
  // A brisk, accurate shift should land near this; it is the bar for an S.
  parSeconds: 70,

  // Coffee Spill: roughly this share of returns come back with a stain over
  // part of their title or description. Easy to tune.
  coffeeChance: 0.3,
  cartMax: 8,                    // the cart quietly stops accepting past this
  queueMax: 4,

  startingBooks: 3,
  firstBookDelay: 2,
  firstPatronDelay: 3,

  // Nobody should stand at an empty desk. When less than this is waiting,
  // the next arrivals are pulled forward — so a fast player is met rather
  // than left tapping an empty cart, and a slow one never triggers it.
  // Shelves show only the most recent arrivals; the rest stay in game state.
  // With five sections the bays are narrower, so fewer books are kept on show
  // and each one gets the room to be read.
  shelfDisplayMax: 5,
  // How deep a patron may reach when asking about an invented book. Kept at or
  // below the fewest spines any layout actually shows, so the answer is always
  // still on the shelf in front of the player — never a memory test.
  fairRecallDepth: 3,
  memoryAskChance: 0.5,          // of book requests, how many are recall rather than locate

  minOnHand: 2,
  dryBookDelay: 1.2,
  dryPatronDelay: 2.5,

  satisfactionStart: 78,
  calmRecoveryPerSec: 0.55,      // a tidy desk and an empty queue settle the room again
  crowdDrainPerSec: 0.08,        // per patron waiting beyond the first — a busy room is a tense one
  bookRequestChance: 0.45,      // once enough books have been seen
  minSeenForBookRequest: 3,

  // Pacing by seconds elapsed. A shift has no fixed length any more, so the
  // ramp is absolute: calm to open, busier the longer you take.
  phases: [
    { until: 15,   label: 'Opening',  bookEvery: 5.0, patronEvery: 7.5, patience: 46 },
    { until: 35,   label: 'Steady',   bookEvery: 4.2, patronEvery: 6.2, patience: 42 },
    { until: 70,   label: 'Busy',     bookEvery: 3.6, patronEvery: 5.4, patience: 38 },
    { until: 1e9,  label: 'Backlog',  bookEvery: 3.0, patronEvery: 4.6, patience: 34 },
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

function createState(mode, shelfCount) {
  const shelves = SHELVES.slice(0, shelfCount);
  const ids = shelves.map((sh) => sh.id);
  return {
    phase: 'title',          // 'title' | 'playing' | 'paused' | 'over'
    mode: mode,
    shelfCount: shelfCount,
    shelves: shelves,                              // the sections in play
    pool: BOOKS.filter((b) => ids.includes(b.genre)),   // locked sections never spawn
    stains: new Map(),                             // book -> coffee damage, Coffee Spill only
    usedAsks: new Set(),                           // wording already heard this shift
    lastAskGenre: null,
    targets: targetsFor(),
    elapsed: 0,
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
    shelfHistory: shelfHistoryStore(shelves),  // every book put away, per shelf, in order
    score: 0,
    streak: 0,
    bestStreak: 0,
    satisfaction: CONFIG.satisfactionStart,

    shelved: 0,
    attempts: 0,             // every shelf tap
    correct: 0,              // …and the ones that were right
    helped: 0,
    left: 0,

  };
}

/* One bucket per shelf, so a new section needs no new code here. */
function shelfHistoryStore(shelves) {
  const store = {};
  shelves.forEach((sh) => { store[sh.id] = []; });
  return store;
}

/* Copied once at the start of a shift, so every readout agrees on the target. */
function targetsFor() {
  const t = {};
  OBJECTIVES.forEach((o) => { t[o.id] = o.target; });
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
    S.bookBag = S.pool.slice();
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
  const book = drawBook();
  maybeStain(book);
  S.cart.push(book);
  return true;
}

/* Is this book still among the spines actually on show? */
function visibleOnShelf(book) {
  const shelf = S.shelfHistory[book.genre];
  return !!shelf && shelf.slice(-CONFIG.fairRecallDepth).includes(book);
}

/* Who may be asked about, and how.
   A real book is fair game once the player has shelved it: the title is
   recognisable and they handled it. An invented one is only fair while its
   spine is still visible, since nobody can be expected to recall a title that
   exists solely in this library and has scrolled off the shelf. */
function recallCandidates() {
  return S.seen.filter((b) => b.isRealBook || visibleOnShelf(b));
}

/* Prefers wording this shift has not used yet, and steers away from repeating
   the previous request's section back to back. Falls back to the whole list
   once it is genuinely exhausted. */
function pickFresh(list, keyOf) {
  const unused = list.filter((x) => !S.usedAsks.has(keyOf(x)));
  const chosen = pick(unused.length ? unused : list);
  S.usedAsks.add(keyOf(chosen));
  return chosen;
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
    const template = remembering ? pickFresh(MEMORY_ASKS, (t) => t)
                                 : pickFresh(BOOK_ASKS, (t) => t);
    const text = template.replace('{title}', book.title) +
      (book.author ? (remembering ? ' The ' : ' It’s the ') + book.author + ' one.' : '');
    S.lastAskGenre = book.genre;
    return { kind: 'book', answer: book.genre, book: book, text: text };
  }

  let asks = TOPIC_ASKS.filter((t) => S.shelfHistory.hasOwnProperty(t.genre));
  const varied = asks.filter((t) => t.genre !== S.lastAskGenre);
  if (varied.length) asks = varied;                 // not the same section twice running
  const ask = pickFresh(asks, (t) => t.text);
  S.lastAskGenre = ask.genre;
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

function startShift(mode, shelfCount) {
  S = createState(mode || (S && S.mode) || 'normal',
                  shelfCount || (S && S.shelfCount) || SHELF_TIERS[0]);
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

  // Phase ramp
  while (S.phaseIndex < CONFIG.phases.length - 1 &&
         S.elapsed >= CONFIG.phases[S.phaseIndex].until) {
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

  // The shift is over the moment the whole workload is done.
  if (objectivesMet()) endShift();
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

/* A wrong shelf costs the attempt and the streak, but the book stays in hand and
   the right answer is never given away — working it out is the game. */
function resolveBook(genreId) {
  const book = S.hand.book;
  S.attempts++;

  if (book.genre !== genreId) {
    S.satisfaction = clamp(S.satisfaction + CONFIG.satisfaction.wrongShelf, 0, 100);
    breakStreak();
    flashShelf(genreId, 'bad');
    playCue('wrong');
    renderHud();
    return;                                // still in hand: try another shelf
  }

  S.hand = null;
  S.correct++;
  S.shelved++;                             // only a correct placement is shelved
  if (!S.seen.includes(book)) S.seen.push(book);
  clearStain(book);

  S.shelfHistory[book.genre].push(book);   // history is kept in full…
  flyBook(elCart, shelfEls[book.genre].root, book.genre);
  addSpine(book.genre, book);              // …the shelf only shows the recent few

  const gained = CONFIG.points.shelfCorrect + streakBonus();
  S.score += gained;
  bumpStreak();
  flashShelf(genreId, 'good');
  floatScore(shelfEls[genreId].root, '+' + gained, false);
  say('Right where it belongs.', 'good');
  playCue('right');

  renderSlip();
  renderArmed();
  renderHud();
}

function resolvePatron(genreId) {
  const p = S.patrons.find((x) => x.id === S.hand.id);
  if (!p) { S.hand = null; renderSlip(); renderArmed(); return; }

  S.attempts++;

  if (genreId === p.request.answer) {
    S.correct++;
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
    // Costs the attempt, the streak and some of their patience — but they stay
    // at the desk and the answer is not given away.
    p.misses++;
    p.patience = Math.max(2, p.patience - CONFIG.wrongAnswerPatiencePenalty);
    S.satisfaction = clamp(S.satisfaction + CONFIG.satisfaction.wrongAnswer, 0, 100);
    breakStreak();
    flashShelf(genreId, 'bad');
    playCue('wrong');
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

/* ── Coffee Spill ───────────────────────────────────────────────────────
   A stain hides part of a returned book's title or description. It must leave
   enough to classify by: the title never loses more than about a third of its
   letters, the description never loses more than a quarter of its words, and
   the two are never heavily damaged at once. Segments are worked out when the
   book reaches the cart, so what the player sees never shifts under them. */

const STAIN_LIMITS = { titleChars: 0.34, descWords: 0.3 };

/* Splits text into [visible, hidden, visible, …] segments. */
function segments(text, hide) {
  const out = [];
  let at = 0;
  hide.sort((a, b) => a.from - b.from).forEach((h) => {
    if (h.from > at) out.push({ t: text.slice(at, h.from), on: false });
    out.push({ t: text.slice(h.from, h.to), on: true });
    at = h.to;
  });
  if (at < text.length) out.push({ t: text.slice(at), on: false });
  return out;
}

/* Word spans of a string, as {from, to}. */
function wordSpans(text) {
  const spans = [];
  const re = /\S+/g;
  let m;
  while ((m = re.exec(text))) spans.push({ from: m.index, to: m.index + m[0].length });
  return spans;
}

function stainTitle(title, heavy) {
  const spans = wordSpans(title);
  const budget = Math.floor(title.length * STAIN_LIMITS.titleChars);
  // Prefer blotting the tail of one long word — recognisable, but not readable.
  const longs = spans.filter((sp, i) => i > 0 && sp.to - sp.from >= 5);
  if (longs.length) {
    const sp = pick(longs);
    const keep = Math.ceil((sp.to - sp.from) * (heavy ? 0.4 : 0.5));
    const from = sp.from + keep;
    if (sp.to - from <= budget) return [{ from: from, to: sp.to }];
  }
  const later = spans.filter((sp, i) => i > 0 && sp.to - sp.from <= budget);
  return later.length ? [pick(later)] : [];
}

/* Clues are only a handful of words now, so this blots a keyword or two rather
   than a stretch of sentence: the opening always survives, and short joining
   words are passed over in favour of one that carries meaning. */
function stainDesc(desc, share) {
  const all = wordSpans(desc);
  if (all.length < 5) return [];
  const cap = Math.max(1, Math.floor(all.length * STAIN_LIMITS.descWords));
  const rest = all.slice(2);
  const meaty = rest.filter((sp) => sp.to - sp.from >= 4);
  const bag = (meaty.length ? meaty : rest).slice();
  const want = Math.max(1, Math.min(cap, Math.round(bag.length * share)));
  const chosen = [];
  while (chosen.length < want && bag.length) {
    chosen.push(bag.splice(Math.floor(Math.random() * bag.length), 1)[0]);
  }
  return chosen;
}

function makeStain(book) {
  const roll = Math.random();
  let title = [], desc = [];
  if (roll < 0.4)      { title = stainTitle(book.title, false); }
  else if (roll < 0.8) { desc = stainDesc(book.desc, 0.2); }
  else                 { title = stainTitle(book.title, true); desc = stainDesc(book.desc, 0.1); }
  // A stain that hid nothing is not a stain, and one that hid the title alone
  // still needs the description intact — which it is, by construction.
  if (!title.length && !desc.length) desc = stainDesc(book.desc, 0.2);
  if (!title.length && !desc.length) return null;
  return { title: segments(book.title, title), desc: segments(book.desc, desc) };
}

function maybeStain(book) {
  if (S.mode !== 'coffee' || S.stains.has(book)) return;
  if (Math.random() >= CONFIG.coffeeChance) return;
  const stain = makeStain(book);
  if (stain) S.stains.set(book, stain);
}

function clearStain(book) { S.stains.delete(book); }

/* ── Progression ────────────────────────────────────────────────────────
   Each mode unlocks its own shelf tiers, and every unlocked tier stays
   playable. Storage can be unavailable, in which case the game simply runs
   without memory rather than breaking. */

const SAVE_KEY = 'quietstacks.save.v2';

function blankProgress() {
  const p = {};
  MODES.forEach((m) => { p[m.id] = { unlocked: SHELF_TIERS[0], best: {} }; });
  return p;
}

function loadProgress() {
  const fresh = blankProgress();
  try {
    const raw = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
    if (!raw) return fresh;
    MODES.forEach((m) => {
      const got = raw[m.id];
      if (!got) return;
      const n = parseInt(got.unlocked, 10);
      fresh[m.id].unlocked = clamp(Number.isFinite(n) ? n : 3, SHELF_TIERS[0], 5);
      if (got.best && typeof got.best === 'object') fresh[m.id].best = got.best;
    });
  } catch (e) { /* no memory is fine */ }
  return fresh;
}

function saveProgress() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(progress)); } catch (e) { /* fine */ }
}

function resetProgress() {
  progress = blankProgress();
  try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* fine */ }
}

let progress = loadProgress();

function bestFor(mode, shelfCount) {
  const b = progress[mode].best[shelfCount];
  return b && Number.isFinite(b.score) ? b : null;
}

function tierUnlocked(mode, shelfCount) { return shelfCount <= progress[mode].unlocked; }

/* ── Personal best ──────────────────────────────────────────────────────
   Kept per shift length, so a 2-minute run is never measured against a
   6-minute one. Storage can be unavailable (private windows, blocked site
   data), and a missing best is simply no best. */

/* ── End of shift ───────────────────────────────────────────────────────── */

/* Every shelf tap counts, whether it was a return or a patron's question. */
function formatTime(seconds) {
  const t = Math.floor(seconds);
  return Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0');
}

function accuracy() {
  return S.attempts === 0 ? 1 : S.correct / S.attempts;
}

function objectivesMet() {
  return OBJECTIVES.every((o) => o.read(S) >= S.targets[o.id]);
}

/* Finishing is no longer the achievement — the shift only ends when the work is
   done — so the grade is about how cleanly and how quickly you got there. */
function computeGrade() {
  const acc = accuracy();
  const time = S.finishedIn || S.elapsed;
  if (acc >= 0.94 && S.satisfaction >= 85 && time <= CONFIG.parSeconds && S.bestStreak >= 8) return 'S';
  if (acc >= 0.82 && S.satisfaction >= 60 && time <= CONFIG.parSeconds * 2) return 'A';
  if (acc >= 0.68) return 'B';
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
  S.finishedIn = S.elapsed;
  const grade = computeGrade();
  const prev = bestFor(S.mode, S.shelfCount);
  S.previousBest = prev ? prev.score : 0;
  S.newRecord = S.score > S.previousBest;

  // An A or S at the mode's current top tier opens the next one, once.
  S.unlockedShelf = null;
  if ((grade === 'A' || grade === 'S') &&
      S.shelfCount === progress[S.mode].unlocked && S.shelfCount < 5) {
    progress[S.mode].unlocked = S.shelfCount + 1;
    S.unlockedShelf = SHELVES[S.shelfCount];      // the section just opened
  }
  if (S.newRecord) progress[S.mode].best[S.shelfCount] =
    { score: S.score, grade: grade, time: Math.round(S.finishedIn) };
  if (S.newRecord || S.unlockedShelf) saveProgress();
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
  Object.keys(shelfEls).forEach((id) => delete shelfEls[id]);  // no stale bays from a wider shift
  elShelves.dataset.count = String(S.shelves.length);   // the layout adapts to it
  S.shelves.forEach((sh) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'shelf';
    btn.dataset.genre = sh.id;
    btn.style.setProperty('--sp', sh.color);
    btn.setAttribute('aria-label', sh.name + ' shelf');
    btn.innerHTML =
      '<span class="shelf-name">' + (sh.short || sh.name) +
        '<span class="shelf-tag">' + sh.tag + '</span></span>' +
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
  el.style.setProperty('--spine-h', (90 + ((count * 37) % 11)) + '%');  // books in a pile vary a little
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
  $('clockTime').textContent = formatTime(S.elapsed);

  // The bar is progress through the workload, not through a countdown.
  const done = OBJECTIVES.reduce((a, ob) => a + Math.min(ob.read(S), S.targets[ob.id]), 0);
  const total = OBJECTIVES.reduce((a, ob) => a + S.targets[ob.id], 0);
  const pct = (done / total) * 100;
  $('shiftFill').style.width = clamp(pct, 0, 100) + '%';
  $('shiftBar').setAttribute('aria-valuenow', Math.round(pct));
  $('shiftBar').classList.toggle('rush', pct >= 75);

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
  if (h.kind !== 'book') elSlip.classList.remove('stained');

  if (h.kind === 'book') {
    const stain = S.stains.get(h.book);
    elSlip.classList.toggle('stained', !!stain);
    elSlip.innerHTML =
      '<span class="slip-kicker">' + (stain ? 'Returned book — coffee damage' : 'Returned book') + '</span>' +
      '<div class="slip-title">' + (stain ? segsHTML(stain.title) : esc(h.book.title)) + '</div>' +
      (h.book.author ? '<div class="slip-author">' + esc(h.book.author) + '</div>' : '') +
      '<div class="slip-desc">' + (stain ? segsHTML(stain.desc) : esc(h.book.desc)) + '</div>' +
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
  S.shelves.forEach((sh) => shelfEls[sh.id].root.classList.toggle('armed', armed));
  elCart.classList.toggle('armed', !armed && S.cart.length > 0 && S.phase === 'playing');
  patronEls.forEach((els, id) => {
    els.root.classList.toggle('armed', !!S.hand && S.hand.kind === 'patron' && S.hand.id === id);
  });
}

/* Hidden runs become blots rather than placeholder characters. */
function segsHTML(segs) {
  return segs.map((g) => g.on
    ? '<span class="stain" aria-label="obscured by coffee">' + esc(g.t) + '</span>'
    : esc(g.t)).join('');
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

let chosenMode = MODES[0].id;
let chosenShelves = SHELF_TIERS[0];

function hideOverlay() { elOverlay.classList.add('hidden'); }

function showTitle() {
  elOverlay.classList.remove('hidden');
  const modeChips = MODES.map((m) =>
    '<button class="chip" type="button" data-mode="' + m.id + '">' + m.name + '</button>').join('');
  const tierChips = SHELF_TIERS.map((n) =>
    '<button class="chip" type="button" data-tier="' + n + '">' + n + ' shelves</button>').join('');

  elCard.innerHTML =
    '<h1>Quiet Stacks</h1>' +
    '<p class="sub">One short shift</p>' +
    '<ul class="rules">' +
      '<li><i>1</i><span>Tap the <b>return cart</b> for the top book, read it, then tap the shelf it belongs on.</span></li>' +
      '<li><i>2</i><span>Tap a <b>patron</b> to hear their request, then tap the section that answers it.</span></li>' +
      '<li><i>3</i><span>A wrong shelf costs you the streak. The book stays in hand — try again.</span></li>' +
      '<li><i>4</i><span>The shift ends the moment the whole list is done. Quick and clean scores best.</span></li>' +
    '</ul>' +
    '<div class="choices">' +
      '<div class="choice"><span class="slip-kicker">Mode</span>' +
        '<div class="chips">' + modeChips + '</div>' +
        '<p class="chip-note" id="modeNote"></p></div>' +
      '<div class="choice"><span class="slip-kicker">Shelves</span>' +
        '<div class="chips">' + tierChips + '</div>' +
        '<p class="chip-note" id="tierNote"></p></div>' +
    '</div>' +
    '<p class="best-line" id="bestLine"></p>' +
    '<button class="btn" type="button" id="beginBtn">Begin the shift</button>' +
    '<button class="btn ghost" type="button" id="resetBtn">Reset progress</button>';

  const refresh = () => {
    const open = progress[chosenMode].unlocked;
    if (chosenShelves > open) chosenShelves = open;

    elCard.querySelectorAll('[data-mode]').forEach((b) =>
      b.classList.toggle('on', b.dataset.mode === chosenMode));
    $('modeNote').textContent = MODES.find((m) => m.id === chosenMode).blurb;

    elCard.querySelectorAll('[data-tier]').forEach((b) => {
      const n = Number(b.dataset.tier);
      const locked = !tierUnlocked(chosenMode, n);
      b.classList.toggle('on', n === chosenShelves);
      b.classList.toggle('locked', locked);
      b.disabled = locked;
      b.textContent = (locked ? '🔒 ' : '') + n + ' shelves';
    });
    const nextLock = SHELF_TIERS.find((n) => !tierUnlocked(chosenMode, n));
    $('tierNote').textContent = nextLock
      ? 'Earn an A on ' + (nextLock - 1) + ' shelves to unlock ' + nextLock + '.'
      : SHELVES.slice(0, chosenShelves).map((sh) => sh.short || sh.name).join(' · ');

    const t = targetsFor();
    const best = bestFor(chosenMode, chosenShelves);
    $('bestLine').textContent = 'Shelve ' + t.books + ' · help ' + t.patrons +
      (best ? ' · best ' + best.score + ' (' + best.grade + ', ' + formatTime(best.time || 0) + ')' : '');
  };

  elCard.querySelectorAll('[data-mode]').forEach((b) => b.addEventListener('click', () => {
    chosenMode = b.dataset.mode; refresh(); playCue('pickup');
  }));
  elCard.querySelectorAll('[data-tier]').forEach((b) => b.addEventListener('click', () => {
    chosenShelves = Number(b.dataset.tier); refresh(); playCue('pickup');
  }));
  $('beginBtn').addEventListener('click', () => startShift(chosenMode, chosenShelves));
  $('resetBtn').addEventListener('click', showConfirmReset);
  refresh();
}

function showConfirmReset() {
  elOverlay.classList.remove('hidden');
  elCard.innerHTML =
    '<h2>Reset progress?</h2>' +
    '<p class="sub">Unlocks and best scores</p>' +
    '<p>Both modes go back to three shelves, and every best score is cleared. ' +
    'Nothing else about the game changes.</p>' +
    '<button class="btn" type="button" id="doResetBtn">Yes, clear it</button>' +
    '<button class="btn ghost" type="button" id="keepBtn">Keep my progress</button>';
  $('doResetBtn').addEventListener('click', () => {
    resetProgress();
    chosenShelves = SHELF_TIERS[0];
    showTitle();
  });
  $('keepBtn').addEventListener('click', showTitle);
}

function showConfirmRestart() {
  S.phase = 'paused';
  elOverlay.classList.remove('hidden');
  elCard.innerHTML =
    '<h2>Start over?</h2>' +
    '<p class="sub">The shift so far</p>' +
    '<p>' + S.shelved + ' of ' + S.targets.books + ' shelved and ' + S.helped + ' of ' +
    S.targets.patrons + ' helped, in ' + formatTime(S.elapsed) + '. Beginning again clears it.</p>' +
    '<button class="btn" type="button" id="confirmBtn">Yes, fresh shift</button>' +
    '<button class="btn ghost" type="button" id="cancelBtn">No, back to work</button>';
  $('confirmBtn').addEventListener('click', () => startShift(S.mode, S.shelfCount));
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
    ['Time', formatTime(S.finishedIn), S.finishedIn <= CONFIG.parSeconds],
    ['Accuracy', S.attempts ? acc + '%' : '—', S.attempts > 0 && acc >= 94],
    ['Best streak', String(S.bestStreak), S.bestStreak >= 8],
    ['Books shelved', S.shelved + ' / ' + S.targets.books, S.shelved >= S.targets.books],
    ['Patrons helped', S.helped + ' / ' + S.targets.patrons, S.helped >= S.targets.patrons],
    ['Score', String(S.score), false],
  ];

  elOverlay.classList.remove('hidden');
  elCard.innerHTML =
    '<h2>Closing time</h2>' +
    '<p class="sub">' + MODES.find((m) => m.id === S.mode).name + ' · ' + S.shelfCount + ' shelves' +
      (S.newRecord && S.previousBest ? ' · new best' : '') + '</p>' +
    '<div class="grade">' + grade + '</div>' +
    '<div class="results">' +
      rows.map(([label, value, met]) =>
        '<div class="result-row' + (met ? ' met' : '') + '"><span>' + label + '</span><b>' + value + '</b></div>'
      ).join('') +
    '</div>' +
    '<p class="verdict">' + GRADE_NOTES[grade] +
      (S.previousBest ? ' Best here: ' + S.previousBest + '.' : '') + '</p>' +
    (S.unlockedShelf
      ? '<div class="unlock">' +
          '<span class="unlock-kicker">New shelf unlocked</span>' +
          '<span class="unlock-name">' + esc(S.unlockedShelf.name) + '</span>' +
          '<span class="unlock-note">' + (S.shelfCount + 1) + '-shelf shifts are now available.</span>' +
        '</div>'
      : '') +
    '<button class="btn" type="button" id="againBtn">Take another shift</button>' +
    '<button class="btn ghost" type="button" id="menuBtn">Change mode or shelves</button>';
  $('againBtn').addEventListener('click', () => startShift(S.mode, S.shelfCount));
  $('menuBtn').addEventListener('click', showTitle);
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
  if (S.phase !== 'playing') { startShift(chosenMode, chosenShelves); return; }
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
  else if (e.key >= '1' && e.key <= '5') {
    const sh = S.shelves[Number(e.key) - 1];
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
S = createState('normal', SHELF_TIERS[0]);
buildShelves();
renderAll();
showTitle();
lastFrame = performance.now();
rafId = requestAnimationFrame(loop);
