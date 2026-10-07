/* SKYBREAKER — the numbers.

   Who everyone is, what they wear, how hard they hit.  Tuning lives here and
   nowhere else: a fighter's growth, every special's cost and charge, every
   enemy's stats at level 1 (they scale with level), and every boss's attack
   patterns, phase by phase. */
'use strict';

const DATA = (() => {

  /* ── looks ──────────────────────────────────────────── */
  const LOOKS = {
    juno:   { skin: '#f2c49a', hair: '#2ec4b6', hairStyle: 'ponytail', accent: '#ffd84a', top: '#d8403a', under: '#2a2a3a', sleeve: 'skin', sleeveLen: 0, pants: '#3a3a52', shoes: '#e8e0d0', wrist: '#f4f0e6', belt: '#2a2a3a' },
    brask:  { skin: '#9a6040', hair: '#f0f0f4', hairStyle: 'mohawk', top: '#5a3a8c', under: '#e8c050', coat: true, pants: '#4a3828', shoes: '#2a2028', build: 'big', brows: '#2a1a14', belt: '#e8c050' },
    mags:   { skin: '#e8b890', hair: '#c8c4cc', hairStyle: 'bun', top: '#3a6a8a', apron: '#f4f0e6', pants: '#3a3a4a', shoes: '#5a3a2a' },
    pell:   { skin: '#f6dcc0', hair: '#6a4a3a', hairStyle: 'neat', top: '#d8c8a0', tie: '#c0303a', pants: '#8a7a5a', shoes: '#3a2a20', build: 'kid', glasses: '#e8e8f0' },
    sable:  { skin: '#d8c8e8', hair: '#f4f4ff', hairStyle: 'tallbun', accent: '#2a2a6a', top: '#2a2a5a', under: '#f4f0e6', tie: '#c0303a', pants: '#22224a', shoes: '#141428', build: 'tall', monocle: '#f2c94c', eyes: '#6a2a8a' },
    rook:   { skin: '#c8906a', hair: '#3a2a20', hairStyle: 'bandana', accent: '#c0392b', top: '#7a6a5a', under: '#4a3a2a', pants: '#5a4a3a', shoes: '#2a2020', build: 'big', patch: true, beard: '#3a2a20', belt: '#3a2a20' },
    velvet: { skin: '#f0d0c0', hair: '#2a1a3a', hairStyle: 'hat', accent: '#5b2a86', top: '#7a3aa0', cape: '#3a1a5a', pants: '#2a1a3a', shoes: '#1a1020', mask: '#1a1020' },
    grunt:  { skin: '#d8a07a', hair: '#4a3020', hairStyle: 'bandana', accent: '#8a5a2a', top: '#8a6a3a', pants: '#5a4a3a', shoes: '#2a2020' },
    gunner: { skin: '#c08060', hair: '#2a2020', hairStyle: 'cap', accent: '#5a6a3a', top: '#6a7a4a', pants: '#4a4a3a', shoes: '#2a2020', gun: true },
    furnace:{ skin: '#c89070', hair: '#e8e0d8', hairStyle: 'bald', top: '#8a3a2a', robe: true, pants: '#5a2a1a', shoes: '#2a1a14', beard: '#e8e0d8' },
    tam:    { skin: '#f0c8a0', hair: '#8a4a2a', hairStyle: 'short', top: '#4a9ad8', pants: '#3a4a6a', shoes: '#c03a30', build: 'kid' },
    odo:    { skin: '#d8a880', hair: '#6a5a3a', hairStyle: 'cap', accent: '#e0b040', top: '#6a8a4a', pants: '#5a4a8a', shoes: '#3a2a20', beard: '#6a5a3a' },
    rena:   { skin: '#f4d0b0', hair: '#c8402a', hairStyle: 'long', top: '#e8a040', pants: '#5a3a5a', shoes: '#3a2a20' },
    boro:   { skin: '#b07850', hair: '#2a2020', hairStyle: 'short', top: '#4a8a6a', apron: '#d8c8a0', pants: '#3a3a3a', shoes: '#2a2020', build: 'big' },
    lia:    { skin: '#f6dcc4', hair: '#f2d06a', hairStyle: 'long', top: '#9a6ad0', pants: '#4a3a6a', shoes: '#e8e0d0' },
    elder:  { skin: '#e0b090', hair: '#e8e8ec', hairStyle: 'bald', top: '#7a6a9a', robe: true, pants: '#4a3a5a', shoes: '#3a2a20', beard: '#e8e8ec' },
    sir:    { skin: '#e8c0a0', hair: '#a8a8b4', hairStyle: 'short', top: '#a8b0c0', under: '#3a5ad0', pants: '#7a8090', shoes: '#4a4a58', build: 'big' },
    cactus: { skin: '#5aa04a', hair: '#ff7aa0', hairStyle: 'bald', top: '#4a8a3a', pants: '#3a7a2a', shoes: '#c8a060', eyes: '#1a1028' },
    clerk:  { skin: '#e8d8f0', hair: '#4a4a7a', hairStyle: 'neat', top: '#3a3a6a', tie: '#c0303a', pants: '#2a2a4a', shoes: '#141428', glasses: '#e8e8f0' },
    kid2:   { skin: '#c89070', hair: '#1a1a2a', hairStyle: 'short', top: '#e0503c', pants: '#3a3a5a', shoes: '#f4f0e6', build: 'kid' },
  };
  // Overdrive: the ki burns through — hair catches, eyes go white-hot
  LOOKS.junoOD  = Object.assign({}, LOOKS.juno, { hair: '#ff9a3a', accent: '#fff2a0', eyes: '#ff5a2a' });
  LOOKS.braskOD = Object.assign({}, LOOKS.brask, { hair: '#c8a8ff', under: '#9af0ff', belt: '#9af0ff', eyes: '#5a3ae0' });

  /* ── the two of them ────────────────────────────────── */
  const HEROES = {
    juno: {
      name: 'Juno', look: 'juno', od: 'junoOD',
      base: { hp: 62, ki: 42, str: 6, pow: 8, def: 4 },
      grow: { hp: 7, ki: 4, str: 1, pow: 1.1, def: 0.5 },
      speed: 84, kiColor: '#ff8a2a', kiCore: '#fff2a0', burns: true,
      specials: ['comet', 'lance', 'nova', 'overdrive'],
      field: 'Her ki burns: blasts light braziers and clear dry brambles.',
    },
    rei: {
      name: 'Rei', look: 'rei', od: 'reiOD',
      base: { hp: 60, ki: 44, str: 7, pow: 7, def: 4 },
      grow: { hp: 6, ki: 4, str: 1.1, pow: 0.9, def: 0.5 },
      speed: 92, kiColor: '#7ae0ff', kiCore: '#ffffff', dashes: true,
      specials: ['gale', 'crescent', 'flurry', 'overdrive'],
      field: 'Gale Step carries him across chasms and through enemies.',
    },
    oren: {
      name: 'Oren', look: 'oren', od: 'orenOD',
      base: { hp: 110, ki: 30, str: 11, pow: 5, def: 8 },
      grow: { hp: 11, ki: 2.5, str: 1.3, pow: 0.5, def: 1 },
      speed: 66, kiColor: '#ffb04a', kiCore: '#fff4d0', breaks: true,
      specials: ['quake', 'swing', 'guard', 'overdrive'],
      field: 'Hits like a rockslide: heavy blows shatter cracked stone. Armour means nothing to him.',
    },
  };
  const PARTY_ORDER = ['juno', 'rei', 'oren'];

  /* name, ki cost, charge time (s), level needed (or a story flag) */
  const SPECIALS = {
    comet:     { name: 'Comet Rush',    cost: 8,  charge: 0.35, lv: 1, desc: 'Dash through everything in your path.' },
    lance:     { name: 'Solar Lance',   cost: 14, charge: 0.6,  lv: 4, desc: 'A held beam. Pierces.' },
    nova:      { name: 'Nova Ring',     cost: 18, charge: 0.75, lv: 9, desc: 'A burst of flame all around you.' },
    stomp:     { name: 'Thunder Stomp', cost: 8,  charge: 0.4,  lv: 1, desc: 'Shockwave. Stuns. Breaks rock.' },
    cannon:    { name: 'Storm Cannon',  cost: 14, charge: 0.6,  lv: 4, desc: 'A slow orb that tears through a crowd.' },
    guard:     { name: 'Iron Guard',    cost: 10, charge: 0.3,  lv: 9, desc: 'Shrug off everything. Reflect shots.' },
    gale:      { name: 'Gale Step',     cost: 7,  charge: 0.3,  lv: 1, desc: 'A blink-fast dash. Crosses chasms. Cuts through foes.' },
    crescent:  { name: 'Crescent Wave', cost: 12, charge: 0.55, lv: 4, desc: 'A wide blade of ki that cuts through a line.' },
    flurry:    { name: 'Thousand Edge', cost: 16, charge: 0.6,  lv: 9, desc: 'A storm of strikes in front of you.' },
    quake:     { name: 'Quake',         cost: 9,  charge: 0.4,  lv: 1, desc: 'Shake the ground. Stuns. Shatters rock.' },
    swing:     { name: 'Giant Swing',   cost: 14, charge: 0.5,  lv: 4, desc: 'Spin and sweep everything around you away.' },
    overdrive: { name: 'Overdrive',     cost: 10, charge: 0.8,  flag: 'overdrive', desc: 'Burn hotter. Drains ki until you stop.' },
  };

  /* XP needed to go from level L to L+1 */
  const xpTo = (L) => Math.floor(18 * Math.pow(L, 1.55));

  /* ── enemies: stats at level 1; +22% hp and +12% atk per level ── */
  const ENEMIES = {
    puddlet:  { name: 'Puddlet',     art: ['puddlet', '#5fc98a'], hp: 16, atk: 4, def: 0, spd: 26, ai: 'hop', xp: 5, coins: [1, 3], w: 12, h: 8 },
    bluelet:  { name: 'Bluelet',     art: ['puddlet', '#5a8ae8'], hp: 20, atk: 5, def: 1, spd: 30, ai: 'hop', xp: 6, coins: [1, 4], w: 12, h: 8 },
    hare:     { name: 'Bolt Hare',   art: ['hare'], hp: 13, atk: 5, def: 0, spd: 40, ai: 'charger', xp: 6, coins: [1, 4], w: 12, h: 8 },
    beetle:   { name: 'Shellback',   art: ['beetle'], hp: 34, atk: 6, def: 3, spd: 22, ai: 'tank', armored: true, xp: 9, coins: [2, 6], w: 14, h: 9 },
    grunt:    { name: 'Rustback',    art: ['person', 'grunt'], hp: 26, atk: 7, def: 2, spd: 44, ai: 'melee', xp: 10, coins: [3, 8], w: 10, h: 6 },
    gunner:   { name: 'Rust Gunner', art: ['person', 'gunner'], hp: 20, atk: 6, def: 1, spd: 40, ai: 'shooter', xp: 11, coins: [3, 9], w: 10, h: 6, shot: '#ffb03a' },
    imp:      { name: 'Cinder Imp',  art: ['imp'], hp: 26, atk: 8, def: 2, spd: 38, ai: 'flyer', fly: true, xp: 12, coins: [3, 9], w: 12, h: 8, shot: '#ff6a2a' },
    hound:    { name: 'Magma Hound', art: ['hound'], hp: 36, atk: 9, def: 3, spd: 46, ai: 'charger', xp: 14, coins: [4, 10], w: 16, h: 8 },
    golemite: { name: 'Golemite',    art: ['golemite'], hp: 58, atk: 10, def: 6, spd: 18, ai: 'tank', armored: true, xp: 18, coins: [5, 12], w: 14, h: 10 },
    lavabeetle: { name: 'Ember Shell', art: ['beetle', '#c0503a'], hp: 40, atk: 8, def: 4, spd: 24, ai: 'tank', armored: true, xp: 13, coins: [3, 9], w: 14, h: 9 },
    wraith:   { name: 'Paper Wraith', art: ['wraith'], hp: 44, atk: 11, def: 4, spd: 36, ai: 'blinker', fly: true, xp: 22, coins: [6, 14], w: 12, h: 8, shot: '#e8304a' },
    clerkbot: { name: 'Audit Clerk', art: ['person', 'clerk'], hp: 40, atk: 11, def: 4, spd: 42, ai: 'shooter', xp: 20, coins: [6, 14], w: 10, h: 6, shot: '#c8a8ff' },
  };

  /* ── bosses ─────────────────────────────────────────── */
  /* Each phase is a list of attacks the boss cycles through.  Attack kinds
     are implemented in engine.js: chase, charge, aimed, ring, spiral, stamp,
     teleport, summon, beam, slam, mimic. */
  const BOSSES = {
    brask_spar: { name: 'Brask', art: ['person', 'brask'], lv: 2, hp: 110, atk: 6, def: 3, spd: 52, w: 12, h: 7, endAt: 0.4,
      phases: [[{ k: 'chase', t: 2.2 }, { k: 'slam', r: 34 }, { k: 'chase', t: 1.6 }, { k: 'charge' }]] },
    // Brask and Isla, the other contenders: three meetings, each harder
    brask_a: { name: 'Brask', art: ['person', 'brask'], lv: 7, hp: 360, atk: 11, def: 5, spd: 52, w: 12, h: 7, xp: 150, coins: 80,
      phases: [[{ k: 'chase', t: 2 }, { k: 'slam', r: 40 }, { k: 'charge' }, { k: 'aimed', n: 3, spread: 0.25, speed: 120, color: '#c8a8ff' }]] },
    isla_a: { name: 'Isla', art: ['person', 'isla'], lv: 7, hp: 280, atk: 10, def: 3, spd: 66, w: 10, h: 6, xp: 150, coins: 80,
      phases: [[{ k: 'aimed', n: 3, spread: 0.4, speed: 140, color: '#7ab8ff' }, { k: 'teleport' }, { k: 'aimed', n: 5, spread: 0.7, speed: 130, color: '#7ab8ff' }, { k: 'chase', t: 1.2 }]] },
    brask_b: { name: 'Brask', art: ['person', 'brask'], lv: 11, hp: 620, atk: 14, def: 7, spd: 56, w: 12, h: 7, xp: 260, coins: 140,
      phases: [[{ k: 'chase', t: 2 }, { k: 'slam', r: 50 }, { k: 'charge' }], [{ k: 'charge' }, { k: 'slam', r: 56 }, { k: 'aimed', n: 5, spread: 0.5, speed: 130, color: '#c8a8ff' }, { k: 'charge' }]] },
    isla_b: { name: 'Isla', art: ['person', 'isla'], lv: 11, hp: 500, atk: 13, def: 5, spd: 70, w: 10, h: 6, xp: 260, coins: 140,
      phases: [[{ k: 'aimed', n: 5, spread: 0.6, speed: 145, color: '#7ab8ff' }, { k: 'teleport', strike: true }, { k: 'ring', n: 12, speed: 100, color: '#7ab8ff' }],
               [{ k: 'beam', t: 0.8 }, { k: 'teleport', strike: true }, { k: 'spiral', t: 2, color: '#7ab8ff' }, { k: 'aimed', n: 7, spread: 0.9, speed: 150, color: '#7ab8ff' }]] },
    rook: { name: 'Captain Rook', art: ['person', 'rook'], lv: 6, hp: 340, atk: 10, def: 4, spd: 50, w: 12, h: 7, xp: 140, coins: 120,
      phases: [
        [{ k: 'chase', t: 2 }, { k: 'aimed', n: 3, spread: 0.3, speed: 110, color: '#ffb03a' }, { k: 'charge' }, { k: 'chase', t: 1.5 }, { k: 'summon', what: 'grunt', n: 2, max: 3 }],
        [{ k: 'charge' }, { k: 'aimed', n: 5, spread: 0.6, speed: 120, color: '#ffb03a' }, { k: 'charge' }, { k: 'slam', r: 40 }, { k: 'summon', what: 'gunner', n: 2, max: 3 }],
      ] },
    sable_test: { name: 'Auditor Sable', art: ['person', 'sable'], lv: 99, hp: 99999, atk: 18, def: 999, spd: 40, w: 10, h: 6, invulnerable: true,
      phases: [[{ k: 'teleport' }, { k: 'aimed', n: 3, spread: 0.25, speed: 140, color: '#c8a8ff' }, { k: 'stamp', n: 3 }, { k: 'teleport' }, { k: 'ring', n: 12, speed: 90, color: '#c8a8ff' }]] },
    warden: { name: 'Hollow Warden', art: ['warden'], lv: 11, hp: 760, atk: 14, def: 7, spd: 34, w: 26, h: 10, xp: 420, coins: 300, big: true,
      phases: [
        [{ k: 'chase', t: 2 }, { k: 'slam', r: 52 }, { k: 'aimed', n: 3, spread: 0.4, speed: 100, color: '#ff8a2a', size: 5 }, { k: 'charge' }],
        [{ k: 'slam', r: 60 }, { k: 'ring', n: 16, speed: 85, color: '#ff8a2a' }, { k: 'charge' }, { k: 'spiral', t: 2.4, color: '#ffd84a' }, { k: 'summon', what: 'golemite', n: 1, max: 2 }],
      ] },
    velvet: { name: 'Velvet', art: ['person', 'velvet'], lv: 13, hp: 640, atk: 15, def: 6, spd: 70, w: 10, h: 6, xp: 380, coins: 250,
      phases: [
        [{ k: 'teleport', strike: true }, { k: 'aimed', n: 5, spread: 0.7, speed: 150, color: '#e05a8a' }, { k: 'chase', t: 1.2 }, { k: 'teleport', strike: true }, { k: 'charge' }],
        [{ k: 'teleport', strike: true }, { k: 'teleport', strike: true }, { k: 'ring', n: 14, speed: 120, color: '#e05a8a' }, { k: 'aimed', n: 7, spread: 0.9, speed: 150, color: '#e05a8a' }],
      ] },
    grub: { name: 'GRB-9 "Grub"', art: ['robot'], lv: 14, hp: 880, atk: 16, def: 9, spd: 30, w: 22, h: 10, xp: 450, coins: 280, big: true,
      phases: [
        [{ k: 'chase', t: 2.4 }, { k: 'beam', t: 0.9 }, { k: 'aimed', n: 4, spread: 0.5, speed: 110, color: '#3ad0ff' }, { k: 'charge' }],
        [{ k: 'beam', t: 0.9 }, { k: 'spiral', t: 2.6, color: '#3ad0ff' }, { k: 'beam', t: 0.9 }, { k: 'charge' }, { k: 'ring', n: 18, speed: 95, color: '#f5c242' }],
      ] },
    null: { name: 'Null', art: ['null'], lv: 15, hp: 960, atk: 17, def: 8, spd: 74, w: 10, h: 6, xp: 520, coins: 320,
      phases: [
        [{ k: 'mimic' }, { k: 'chase', t: 1.4 }, { k: 'mimic' }, { k: 'aimed', n: 3, spread: 0.3, speed: 150, color: '#8a6aff' }],
        [{ k: 'mimic' }, { k: 'teleport', strike: true }, { k: 'mimic' }, { k: 'spiral', t: 2, color: '#8a6aff' }, { k: 'mimic' }],
      ] },
    sable: { name: 'Auditor Sable', art: ['person', 'sable'], lv: 17, hp: 1800, atk: 18, def: 9, spd: 56, w: 10, h: 6, xp: 0, coins: 0,
      phases: [
        [{ k: 'stamp', n: 3 }, { k: 'aimed', n: 5, spread: 0.6, speed: 130, color: '#c8a8ff' }, { k: 'teleport' }, { k: 'stamp', n: 4 }, { k: 'ring', n: 16, speed: 95, color: '#f4f0e6' }, { k: 'summon', what: 'wraith', n: 2, max: 3 }],
        [{ k: 'spiral', t: 3, color: '#c8a8ff' }, { k: 'stamp', n: 6 }, { k: 'teleport', strike: true }, { k: 'beam', t: 1 }, { k: 'ring', n: 22, speed: 110, color: '#f4f0e6' }, { k: 'stamp', n: 5, chase: true }],
      ] },
  };

  /* ── things in your pockets ─────────────────────────── */
  const ITEMS = {
    bun:       { name: 'Peach Bun', desc: 'Restores 60 HP.', price: 20, use: { hp: 60 } },
    tonic:     { name: 'Ki Tonic', desc: 'Restores 30 Ki.', price: 25, use: { ki: 30 } },
    starfruit: { name: 'Starfruit', desc: 'Fully restores HP and Ki.', price: 120, use: { hp: 9999, ki: 9999 } },
    // permanent boosts, used on whoever is out
    wristband: { name: 'Iron Wristband', desc: 'STR +2, for whoever is out.', use: { str: 2 }, perm: true },
    kicrystal: { name: 'Ki Crystal', desc: 'Max Ki +10, for whoever is out.', use: { maxKi: 10 }, perm: true },
    heartroot: { name: 'Heartroot', desc: 'Max HP +20, for whoever is out.', use: { maxHp: 20 }, perm: true },
    // key items
    scallion:  { name: 'Wild Scallion', desc: 'Mags needs three.', key: true },
    biscuit:   { name: 'Biscuit', desc: 'A kitten. Purring. Slightly singed.', key: true },
    autograph: { name: 'Autograph', desc: 'For Sir Dunmore. He is very excited.', key: true },
    form77b:   { name: 'Form 77-B', desc: 'Appeal of Audit Finding (Combat).', key: true },
  };

  const SHOPS = {
    mags:    ['bun', 'tonic', 'starfruit'],
    vending: ['bun', 'tonic', 'starfruit'],
  };

  return { LOOKS, HEROES, PARTY_ORDER, SPECIALS, xpTo, ENEMIES, BOSSES, ITEMS, SHOPS };
})();
