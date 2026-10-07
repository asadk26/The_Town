/* SKYBREAKER — the story.

   An original tale in three chapters and an epilogue.  A world called Hearth
   gets a Notice of Audit from the Office of Cosmic Audit: its "Vigor Index"
   is 3 out of 1000, and low-scoring worlds get archived.  Juno and Brask,
   two rivals from Brindle Village who have been tied for years, decide to
   raise the score the only way they know how.

   Cutscenes are generator functions built from SCRIPT verbs; flags in G.flags
   carry every decision.  goal() always says what to do next. */
'use strict';

const STORY = (() => {
  const S = SCRIPT;
  const f = () => G.flags;

  /* ── the runner ─────────────────────────────────────── */
  function run(fn) {
    if (G.script) { (G.queue = G.queue || []).push(fn); return; }
    G.script = { gen: fn(), waiter: null };
  }
  function update(dt) {
    for (let guard = 0; guard < 24; guard++) {
      const s = G.script;
      if (!s) { if (G.queue && G.queue.length && !UI.modal()) { run(G.queue.shift()); continue; } return; }
      if (s.waiter && !s.waiter.update(dt)) return;
      dt = 0;
      const r = s.gen.next(s.waiter ? s.waiter.result : undefined);
      if (r.done) { G.script = null; continue; }
      s.waiter = r.value || null;
    }
  }
  const say = (who, text) => run(function* () { yield S.say(who, text); });

  function heal(all = true) {
    for (const id of ['juno', 'brask']) { const h = G.party[id]; if (h && (all || h.joined)) { h.hp = h.maxHp; h.ki = h.maxKi; } }
  }
  function joinBrask() {
    const j = G.party.juno;
    const b = G.party.brask = G.party.brask || newHero('brask', Math.max(1, j.lv));
    b.joined = true; b.hp = b.maxHp; b.ki = b.maxKi;
  }
  function* rest(text) {
    const c = yield S.ask('sign', text, ['Rest', 'Not now']);
    if (c !== 0) return;
    yield S.fade(1, 0.4);
    heal(); AUDIO.sfx('heal');
    yield S.wait(0.4);
    yield S.fade(0, 0.4);
    UI.toast('Everyone is rested.', '#7affb0');
  }

  /* ── what to do now ─────────────────────────────────── */
  function goal() {
    const F = f();
    if (F.ending) return 'Free play. Find every chest. Fight everything.';
    if (F.finalStarted) return 'Climb the Ledger Vault. Contest Auditor Sable.';
    if (F.portalOpen) {
      if (G.mapId === 'lobby' || G.mapId === 'arena') return !F.match1 ? 'Talk to Pell to start Match 1.' : !F.match2 ? 'Talk to Pell for Match 2.' : 'Talk to Pell for the final match.';
      return "Enter the portal in Brindle's plaza.";
    }
    if (F.overdrive) return 'Return to Brindle.';
    if (F.act2) {
      if (F.shrineOpen) return 'Enter the Ember Shrine at the summit.';
      if (G.mapId === 'peaks') return 'Light the three braziers to open the shrine.';
      return hero().lv >= 8 || F.barrier_peaks ? 'Climb Cinder Peaks (north of Brindle).' : 'Reach LV 8, then head north to Cinder Peaks.';
    }
    if (F.rookBeaten) return 'Something is happening...';
    if (F.act1) return hero().lv >= 5 || F.barrier_camp ? "Storm the Rustback camp (east Greenreach)." : 'Reach LV 5 to pass the barrier to the Rustback camp.';
    if (F.metMags) return 'Beat Brask at the training ground (west).';
    if (F.intro) return "Visit Mags' noodle stall, north of the plaza.";
    return '...';
  }
  function sideQuests() {
    const F = f(), out = [];
    if (F.scallionQuest) out.push({ text: 'Scallions for Mags (' + (F.scallionsDone ? 3 : Math.min(3, G.items.scallion || 0)) + '/3)', done: !!F.scallionsDone });
    if (F.kittenQuest) out.push({ text: F.kittenFound && !F.kittenDone ? 'Bring Biscuit home to Tam' : 'Find Biscuit in Greenreach', done: !!F.kittenDone });
    if (F.bountyQuest) out.push({ text: 'Bounty: Greenreach monsters (' + Math.min(20, F.bounty || 0) + '/20)', done: !!F.bountyDone });
    if (F.autoQuest) out.push({ text: 'Autographs for Sir Dunmore (' + Math.min(3, G.items.autograph || 0) + '/3)', done: !!F.autoDone });
    if (!out.length) out.push({ text: 'Talk to people. Somebody always needs something.', done: false });
    return out;
  }

  /* ── map arrivals ───────────────────────────────────── */
  function enter(id) {
    const F = f();
    if (id === 'home' && !F.intro) run(intro);
    if (id === 'lobby' && !F.lobbyIntro) run(lobbyIntro);
  }

  /* ════════════════════════════════════════════════════
     CHAPTER ONE — The Notice
     ════════════════════════════════════════════════════ */
  function* intro() {
    G.flags.intro = true;
    G.fade = 1; G.hideHud = true;
    AUDIO.play('audit');
    yield S.wait(0.5);
    yield S.say('sign', 'Somewhere above the clouds, in an office with no walls, a very tired official opened a very large file.');
    yield S.say('sign', 'WORLD 4417. Local name: "Hearth." Vigor Index: 3 out of 1000.');
    yield S.say('sign', 'She sighed, picked up a red stamp, and wrote one word in the margin...');
    yield S.sfx('stamp'); yield S.shake(0.3);
    yield S.say('sign', '"REVIEW."');
    yield S.music('village');
    yield S.fade(0, 0.8);
    G.hideHud = false;
    yield S.banner('CHAPTER ONE', 'The Notice');
    yield S.say('juno', 'Match one hundred. Today. Forty-nine wins each, plus one "draw" that Brask still brings up at dinner.');
    yield S.say('juno', 'Today the tie breaks. In my favour, obviously.');
    yield S.say('juno', "But Mags says nobody fights on an empty stomach. Noodle stall first. It's just north of the plaza.");
  }

  function* mags() {
    const F = f();
    if (!F.metMags) {
      F.metMags = true;
      yield S.say('mags', "There's my champion. Sit. Eat. You're all elbows today, I can tell.");
      yield S.say('juno', 'I have to beat Brask, Mags. Today. Match one hundred.');
      yield S.say('mags', 'Then remember what I taught you. Z to punch, and keep tapping it for a combo. The last hit sends them flying.');
      yield S.say('mags', 'X throws ki. Hold X and you charge your special. Your Comet Rush goes straight through anybody dumb enough to stand in front of you.');
      yield S.say('mags', 'Hitting things with your fists puts ki back in you. Charging does too, slowly. Use both.');
      yield S.say('mags', 'And take this. It was mine, back when I fought.');
      giveItem('bun', 2, true);
      F.lens = true;
      AUDIO.sfx('item');
      yield S.say('sign', 'Juno got the VIGOR LENS and 2 Peach Buns!');
      yield S.say('mags', "It's a Vigor Lens. Press S to look through it. It shows how strong things are, and finds things that don't want to be found.");
      yield S.say('mags', "Brask is waiting at the training ground on the west side. Go on. And Juno? Don't hold back. He won't.");
      return;
    }
    const opts = F.act1 ? ['Shop', 'Rest', 'Talk', 'Bye'] : ['Talk', 'Bye'];
    const c = yield S.ask('mags', F.act2 && !F.overdrive ? "You look tired, both of you. Eat something." : 'What can I get you?', opts);
    const pick = opts[c];
    if (pick === 'Shop') { const s = UI.shop('mags'); yield { update: () => s.done }; return; }
    if (pick === 'Rest') { yield* rest('Mags pulls out two stools. "Sit down before you fall down." Rest?'); return; }
    if (pick !== 'Talk') return;
    if (F.act1 && !F.scallionQuest) {
      F.scallionQuest = true;
      yield S.say('mags', "A favour. My Champion Bowl needs Wild Scallions, and only the Greenreach ones are spicy enough.");
      yield S.say('mags', 'Bring me three and I will make it worth your while. They grow wild in the fields. Keep your eyes open.');
      return;
    }
    if (F.scallionQuest && !F.scallionsDone && (G.items.scallion || 0) >= 3) {
      takeItem('scallion', 3); F.scallionsDone = true;
      yield S.say('mags', 'Oh, look at these. They make my eyes water just smelling them. Perfect.');
      giveItem('starfruit', 2);
      yield S.say('mags', "Starfruit. Eat one and you're good as new. Don't waste them on a stubbed toe.");
      return;
    }
    if (F.ending) { yield S.say('mags', "Fifty years ago I stood where you stood. You did it better. Don't tell anyone I said that."); return; }
    if (F.portalOpen) { yield S.say('mags', "I fought Sable once. She's never lost a stare. But she's never had the two of you staring back."); return; }
    if (F.overdrive) { yield S.say('mags', 'I can see it on you. The burn. Good. Go show her.'); return; }
    if (F.act2) { yield S.say('mags', "Overdrive isn't a trick, it's a temper. The Ember Shrine shows you yours. Get to LV 8, then climb."); return; }
    if (F.act1) { yield S.say('mags', 'Rook used to steal my lanterns. Smack him once for me.'); return; }
    yield S.say('mags', "Brask is at the training ground. Go on, the noodles aren't going anywhere.");
  }

  /* the spar */
  function* brask() {
    const F = f();
    if (!F.metMags) { yield S.say('brask', "Not yet. Mags will have my head if you fight me hungry. Go eat."); return; }
    yield S.say('brask', "You're late. I've been warming up for an hour.");
    yield S.say('juno', "I've been warming up my whole life.");
    yield S.say('brask', "That doesn't mean anything.");
    yield S.say('juno', 'It means I am VERY warm.');
    yield S.say('brask', '...Match one hundred. Ready when you are.');
    const n = npc('brask'); const bx = Math.round((n.x - 8) / TS), by = Math.round((n.y - 12) / TS);
    yield S.remove('brask');
    yield S.fight('brask_spar', bx, by, { lock: [3, 6, 8, 8], music: 'battle' });
    G.player.state = 'move';
    yield S.spawn('brask', 'brask', bx, by, 'left');
    yield S.music('village');
    yield S.say('brask', 'Hah... not bad... but I was just about to—');
    // a letter from the sky
    const b = npc('brask');
    const env = { kind: 'prop', type: 'env', x: b.x, y: b.y - 90, img: SPR.props.sign, solidTiles: [] };
    G.props.push(env);
    yield { update: (dt) => { env.y += 160 * dt; return env.y >= b.y - 18; } };
    G.props = G.props.filter((q) => q !== env);
    AUDIO.sfx('hit'); burst(b.x, b.y - 24, '#f4f0e6', 10, 40);
    b.pose = 'hurt';
    yield S.say('brask', 'OW.');
    b.pose = null;
    yield S.say('brask', '...Is this a parking ticket?');
    yield S.say('juno', 'Give it here. "NOTICE OF AUDIT. World 4417, Hearth. Vigor Index: 3 out of 1000. Status: UNDER REVIEW. Have a pleasant day."');
    yield S.sfx('warp');
    burst(G.player.x + 20, G.player.y - 30, '#c8a8ff', 16, 50);
    yield S.spawn('pell', 'pell', Math.round((G.player.x + 20 - 8) / TS), Math.round((G.player.y - 12) / TS) - 1, 'down', { float: true });
    yield S.say('pell', "Oh! Oh no. You OPENED it. You're not supposed to open it. It's addressed to the planet!");
    yield S.say('juno', 'Who are you?');
    yield S.say('pell', "Pell! Junior Clerk, Office of Cosmic Audit, third floor. I deliver the notices. Nobody's ever read one before. They usually burn up on the way down.");
    yield S.say('brask', "What's a Vigor Index?");
    yield S.say('pell', "It's how the Office decides which worlds are worth the paperwork. It mostly measures how hard your strongest people can punch. It's an old system. I didn't design it.");
    yield S.say('juno', 'And we got a THREE?');
    yield S.say('pell', 'Out of a thousand. The average is six hundred. There is a world made entirely of moss that scored forty.');
    yield S.say('brask', "What happens to worlds that score low?");
    yield S.say('pell', '...They get archived.');
    yield S.say('juno', 'Archived, like... put on a shelf?');
    yield S.say('pell', 'Archived like deleted! But in a very organised way.');
    yield S.say('pell', 'The Auditor arrives in three business days to review your case. If your score goes up before then, she might let it slide. Maybe. Probably not.');
    yield S.say('juno', 'Then we raise it. How?');
    yield S.say('pell', 'Beat something strong. The index notices big fights. There\'s a gang east of here, the Rustback Raiders? Their captain would count for a lot.');
    yield S.say('brask', "Rook. I've wanted to punch Rook for years.");
    yield S.say('juno', 'Then we go together.');
    yield S.say('brask', "...Fine. But this isn't a team-up. And for the record, the match was a draw.");
    yield S.say('juno', 'It was NOT a draw, I was WINNING.');
    yield S.say('brask', "Forty-nine, forty-nine, two draws. I'm writing it down.");
    yield S.say('pell', "I'll be watching! Not in a creepy way. In an official way. Bye!");
    yield S.sfx('warp');
    const pl = npc('pell'); if (pl) burst(pl.x, pl.y - 14, '#c8a8ff', 16, 50);
    yield S.remove('pell');
    yield S.remove('brask');
    burst(b.x, b.y - 12, '#5ad8ff', 14, 50);
    joinBrask();
    F.sparDone = true; F.act1 = true;
    AUDIO.sfx('level');
    yield S.say('sign', 'Brask joined! Press C to tag between Juno and Brask. If one of you goes down, the other tags in automatically.');
    yield S.say('sign', "Juno's ki burns: her blasts set dry things on fire. Brask hits like a rockslide: his kicks, Thunder Stomp and Storm Cannon break cracked stone.");
    yield S.banner('GOAL', 'Take down Captain Rook', 2.4);
  }

  function* rook() {
    G.player.state = 'move';
    yield S.spawn('rook', 'rook', 66, 24, 'left');
    yield S.walk('player', 60, 24, 70);
    yield S.face('player', 'right');
    yield S.say('rook', "Well, well. Brindle's two loudest children, trespassing in MY camp.");
    yield S.say('brask', 'Your camp is stolen fences and one sad campfire.');
    yield S.say('rook', 'It is a LOVELY campfire.');
    yield S.say('juno', 'Rook, we need to beat you up. It\'s for the planet.');
    yield S.say('rook', '...What?');
    yield S.say('juno', "It's a long story with a lot of paperwork.");
    yield S.say('rook', 'RUSTBACKS! Nobody leaves this camp without paying the toll! And the toll is... GETTING BEATEN UP!');
    yield S.say('brask', 'That\'s not a toll. That\'s just a fight.');
    yield S.say('rook', "...IT'S A TOLL FIGHT.");
    yield S.remove('rook');
    yield S.fight('rook', 66, 24, { lock: [57, 15, 15, 19] });
    G.flags.rookBeaten = true;
    AUDIO.jingle('victory');
    yield S.spawn('rook', 'rook', Math.max(58, Math.min(70, Math.round((G.player.x - 8) / TS) + 3)), Math.round((G.player.y - 12) / TS), 'left', { ko: true });
    yield S.wait(1.2);
    gainXp(140); G.coins += 120; UI.toast('Got 120 coins!', '#ffd84a');
    yield S.say('rook', "Ow. Okay. Okay. You win. Take whatever you want. Not the campfire.");
    yield S.sfx('warp');
    yield S.spawn('pell', 'pell', Math.round((G.player.x - 8) / TS), Math.round((G.player.y - 12) / TS) - 2, 'down', { float: true });
    yield S.say('pell', 'You did it! The index moved! Hearth is up to... FORTY-ONE!');
    yield S.say('juno', "Forty-one! We're beating the moss!");
    yield S.say('pell', '...Oh. Oh no.');
    yield S.say('brask', 'What "oh no"?');
    yield S.say('pell', "She saw the spike. She's coming early. She HATES it when numbers change without a form.");
    yield S.music('audit'); yield S.shake(0.8); yield S.sfx('boom');
    yield S.fade(1, 0.6);
    yield* sableArrives();
  }

  /* ════════════════════════════════════════════════════
     CHAPTER TWO — The Ember Shrine
     ════════════════════════════════════════════════════ */
  function* sableArrives() {
    loadMap('village', 24, 22, 'up');
    G.enemies = [];
    for (const n of G.npcs) { if (['rena', 'boro', 'lia', 'kid2', 'tam', 'elder'].includes(n.id)) { n.wander = false; } }
    const place = (id, x, y, d) => { const n = npc(id); if (n) { n.x = x * TS + 8; n.y = y * TS + 12; n.dir = d; n.wander = false; } };
    place('rena', 19, 20, 'right'); place('lia', 29, 20, 'left'); place('boro', 21, 23, 'up'); place('elder', 27, 23, 'up'); place('tam', 18, 22, 'right');
    yield S.spawn('brask', 'brask', 25, 22, 'up');
    yield S.spawn('pell', 'pell', 23, 22, 'up', { float: true });
    yield S.fade(0, 0.5);
    yield S.wait(0.4);
    yield S.sfx('stamp'); yield S.shake(0.5);
    burst(24 * TS + 8, 15 * TS, '#c8a8ff', 24, 70);
    yield S.spawn('sable', 'sable', 24, 15, 'down');
    yield S.say('sable', 'World 4417. "Hearth."');
    yield S.sfx('stamp');
    yield S.say('sable', 'I moved the meeting up.');
    yield S.say('pell', 'Auditor Sable! The notice said three business days—');
    yield S.say('sable', 'Today is a business day. So is tomorrow. I have decided that both of them happened just now.');
    yield S.say('juno', "So you're the one who wants to delete our world.");
    yield S.say('sable', "I don't want anything. Wanting is inefficient. I review. Your index jumped thirty-eight points in one afternoon. Numbers don't jump. Numbers are earned, filed and approved.");
    yield S.say('brask', 'We earned it. We punched a guy.');
    yield S.say('sable', 'Show me.');
    yield S.sfx('stamp');
    yield S.say('sable', 'Your strongest attacks. Both of you. Take your time. I have all of it.');
    yield S.remove('sable'); yield S.remove('brask'); yield S.remove('pell');
    G.flags.noAuto = true;
    yield S.fight('sable_test', 24, 15, { lock: [18, 13, 14, 11], music: 'audit', noKO: true, until: (t) => t > 24 || hero().hp <= hero().maxHp * 0.3 });
    G.flags.noAuto = false;
    G.player.state = 'ko';
    AUDIO.sfx('boom'); G.shake = 0.6;
    yield S.flash('#c8a8ff');
    yield S.spawn('sable', 'sable', 24, 15, 'down');
    yield S.spawn('brask', 'brask', 26, 21, 'up', { ko: true });
    yield S.spawn('pell', 'pell', 22, 21, 'up', { float: true });
    yield S.wait(0.8);
    yield S.say('sable', 'Hm.');
    yield S.say('sable', 'Vigor: adequate, for a world that still uses doors.');
    yield S.say('sable', 'Here is my finding. In seven days the Interworld Cup convenes in my office. Four worlds under review each send a champion. The winning world\'s file is closed. The others are archived.');
    yield S.say('juno', 'Archived... means deleted.');
    yield S.say('pell', '(whispering) It means deleted.');
    yield S.say('sable', 'You have seven days. I suggest you spend them becoming less disappointing.');
    yield S.sfx('warp'); burst(24 * TS + 8, 15 * TS, '#c8a8ff', 24, 70);
    yield S.remove('sable');
    yield S.remove('pell');
    G.player.state = 'move';
    const b = npc('brask'); if (b) b.ko = false;
    yield S.music('ember');
    yield S.spawn('mags2', 'mags', 24, 25, 'up');
    yield S.walk('mags2', 24, 23, 40);
    yield S.face('player', 'down');
    yield S.say('mags', '...So. The Auditor.');
    yield S.say('juno', 'You KNOW her?');
    yield S.say('mags', 'Fifty years ago she audited this world too. I was its champion. I won, just barely, because of something called Overdrive.');
    yield S.say('mags', 'When your ki burns hotter than your body can hold, and you hold it anyway. I learned it at the Ember Shrine, at the top of Cinder Peaks.');
    yield S.say('mags', 'The barrier on the north road only opens for fighters at LV 8 or higher. Get strong. Then climb the mountain.');
    yield S.say('brask', "We'll be ready.");
    yield S.say('juno', 'We will. Both of us.');
    yield S.remove('mags2'); yield S.remove('brask');
    heal();
    G.flags.act2 = true;
    for (const n of G.npcs) if (['rena', 'boro', 'lia', 'kid2', 'tam', 'elder'].includes(n.id)) { n.wander = true; n.home = { x: n.x, y: n.y }; }
    SAVE.auto();
    yield S.banner('CHAPTER TWO', 'The Ember Shrine');
  }

  function brazierLit() {
    const n = [1, 2, 3].filter((i) => G.flags['brazier_' + i]).length;
    if (n < 3) { UI.toast(n + ' of 3 braziers lit.', '#ffd84a'); return; }
    G.flags.shrineOpen = true;
    G.shake = 0.6; AUDIO.sfx('crack');
    UI.toast('Far above, a great stone door grinds open.', '#ffd84a');
  }

  function* shrineBoss() {
    G.flags.wardenIntro = true;
    yield S.wait(0.4);
    yield S.say('warden', '...WHO CLIMBS.');
    yield S.say('juno', 'Juno and Brask, from Brindle. We came for Overdrive.');
    yield S.say('warden', 'MANY HAVE COME. FEW LEFT WITH IT. MOST LEFT WITH BRUISES.');
    yield S.say('brask', 'We brought our own bruises.');
    yield S.say('warden', 'THEN SHOW ME HOW YOU BURN.');
    yield S.fight('warden', 9, 5, { lock: [3, 3, 14, 11] });
    G.flags.wardenBeaten = true;
    AUDIO.jingle('victory');
    gainXp(420); G.coins += 300; UI.toast('Got 300 coins!', '#ffd84a');
    yield S.wait(1.0);
    yield S.spawn('wardenNpc', null, 9, 5, 'down', { creature: ['warden'], state: 'fixed' });
    yield S.say('warden', '...ENOUGH.');
    yield S.say('warden', 'THE FLAME WAS ALWAYS IN YOU. I ONLY HAD TO MAKE YOU ANGRY.');
    yield S.flash('#ffd84a');
    yield S.sfx('transform'); yield S.shake(0.6);
    G.flags.overdrive = true;
    for (const id of ['juno', 'brask']) burst(G.player.x, G.player.y - 12, DATA.HEROES[id].kiColor, 20, 80);
    yield S.say('sign', 'Juno and Brask learned OVERDRIVE! Select it with A, then hold X to ignite. It drains ki while it lasts; charge it again to stop.');
    yield S.say('juno', 'It feels like my hair is on fire.');
    yield S.say('warden', 'IT IS. A LITTLE.');
    yield S.say('brask', 'Mine too?');
    yield S.say('warden', 'YOURS IS ON LIGHTNING. IT IS DIFFERENT.');
    yield S.sfx('warp');
    yield S.spawn('pell', 'pell', 11, 9, 'up', { float: true });
    yield S.say('pell', 'The seven days are up! Well, it\'s been about three hours. She rounded.');
    yield S.say('pell', "I've opened a portal in your village plaza. Go home, get ready, and step through when you're set. The Interworld Cup is waiting.");
    yield S.say('pell', 'Oh! And the lobby vending machine only takes cosmic currency. Which is coins. Same thing.');
    G.flags.portalOpen = true;
    yield S.say('pell', "Here, I'll take you home.");
    yield* S.warp('village', 21, 17, 'down');
    yield S.banner('CHAPTER THREE', 'The Interworld Cup');
  }

  /* ════════════════════════════════════════════════════
     CHAPTER THREE — The Interworld Cup
     ════════════════════════════════════════════════════ */
  function* lobbyIntro() {
    G.flags.lobbyIntro = true;
    yield S.wait(0.3);
    yield S.say('pell', 'Welcome to the Interworld Lobby! Four worlds, three matches, one very large office.');
    yield S.say('pell', "Talk to me when you're ready for each match. Rest on the bench, shop at the machine. And please don't stare at the one in the corner. He makes me nervous.");
  }

  function* pell() {
    const F = f();
    if (G.mapId !== 'lobby') { yield S.say('pell', 'Forms, forms, forms.'); return; }
    if (!F.match1) {
      const c = yield S.ask('pell', 'Match One: Velvet, the Masked Blade of World 9. Teleports, throws daggers, very dramatic. Ready? (LV 12+ recommended.)', ['Fight!', 'Not yet']);
      if (c === 0) yield* match(1);
    } else if (!F.match2) {
      const c = yield S.ask('pell', 'Match Two: GRB-9 of World 31. A big robot with beam weapons. Ready? (LV 13+ recommended.)', ['Fight!', 'Not yet']);
      if (c === 0) yield* match(2);
    } else if (!F.match3) {
      const c = yield S.ask('pell', 'The final match: Null, of... World 0. There\'s no World 0 in my files. Ready? (LV 14+ recommended.)', ['Fight!', 'Not yet']);
      if (c === 0) yield* match(3);
    } else yield S.say('pell', 'The Vault is through the gate. Go!');
  }

  function* match(n) {
    yield S.fade(1, 0.3);
    loadMap('arena', 10, 13, 'up');
    SAVE.auto();
    yield S.fade(0, 0.3);
    const who = ['velvet', 'grub', 'null'][n - 1];
    if (who === 'grub') yield S.spawn('opp', null, 10, 4, 'down', { creature: ['robot'] });
    else yield S.spawn('opp', who === 'null' ? 'null' : who, 10, 4, 'down');
    yield S.banner('MATCH ' + n, ['Velvet', 'GRB-9', 'Null'][n - 1], 2);
    if (n === 1) {
      yield S.say('velvet', 'Ah, the little world with the big score jump. I am Velvet. On World 9 we settle everything with duels. Breakfast. Taxes. Names.');
      yield S.say('juno', 'How did you get the name Velvet?');
      yield S.say('velvet', 'I won it from a man called Corduroy.');
      yield S.say('brask', '...Who did Corduroy win it from?');
      yield S.say('velvet', 'En garde!');
    } else if (n === 2) {
      yield S.say('grub', 'GREETINGS. I AM GRB-9. I WAS ENTERED IN THIS TOURNAMENT BY ACCIDENT. MY WORLD SENT ITS STRONGEST UNIT.');
      yield S.say('grub', 'I AM A VACUUM CLEANER.');
      yield S.say('brask', '...Then why do you have beam weapons?');
      yield S.say('grub', 'FOR STUBBORN STAINS. PLEASE STEP ASIDE. I AM REQUIRED TO VACUUM YOU.');
    } else {
      yield S.say('null', '...');
      yield S.say('juno', "Hey. You're the one from the corner.");
      yield S.say('null', 'I have no world. It was archived, ten thousand cycles ago. I am what was left over.');
      yield S.say('null', 'She promised me: if I win, my world comes back. So I will win.');
      yield S.say('brask', "That's... actually really sad.");
      yield S.say('null', 'Do not pity me. Fight me. I learned to fight by watching. I have been watching you.');
    }
    yield S.remove('opp');
    yield S.fight(['velvet', 'grub', 'null'][n - 1], 10, 4, { lock: [2, 2, 18, 13], music: n === 3 ? 'final' : 'battle' });
    G.flags['match' + n] = true;
    AUDIO.jingle('victory');
    const B = DATA.BOSSES[who === 'grub' ? 'grub' : who];
    gainXp(B.xp); G.coins += B.coins; UI.toast('Got ' + B.coins + ' coins!', '#ffd84a');
    yield S.wait(1.0);
    if (who === 'grub') yield S.spawn('opp', null, 10, 5, 'down', { creature: ['robot'] });
    else yield S.spawn('opp', who, 10, 5, 'down', { ko: who === 'null' });
    if (n === 1) {
      yield S.say('velvet', 'Magnifique... I have lost a duel. Now I must change my name.');
      yield S.say('velvet', 'From now on, I am "Juno\'s Friend Velvet." It is long, but it is honest.');
    } else if (n === 2) {
      yield S.say('grub', "DEFEAT ACKNOWLEDGED. THANK YOU. I DID NOT WANT TO VACUUM YOU. YOU SEEM NICE.");
      yield S.say('grub', 'I WILL RETURN TO MY WORLD AND CLEAN IT VERY THOROUGHLY.');
    } else { yield* finale(); return; }
    yield S.fade(1, 0.3);
    heal();
    loadMap('lobby', 15, 7, 'up');
    SAVE.auto();
    yield S.fade(0, 0.3);
    yield S.say('pell', 'Wonderful! Complimentary healing between rounds. ' + (n === 1 ? 'Match Two whenever you\'re ready.' : 'One more match. The last one.'));
  }

  function* finale() {
    yield S.say('null', '...I have lost. My world stays gone.');
    yield S.say('juno', "No. Hey. That's not fair. That was never fair.");
    yield S.sfx('stamp'); yield S.shake(0.4);
    yield S.spawn('sable', 'sable', 14, 4, 'left');
    yield S.music('audit');
    yield S.say('sable', 'Congratulations, World 4417. Your file is closed.');
    yield S.say('juno', "And Null's world?");
    yield S.say('sable', 'Archived worlds stay archived. That is what "archived" means.');
    yield S.spawn('pell', 'pell', 7, 9, 'right', { float: true });
    yield S.say('pell', "Um. Auditor? I've been reading the rulebook. Section Nine, the quota. It says the Office must archive a set amount of Vigor every cycle, and... it doesn't say only the losers.");
    yield S.say('sable', 'I see Pell has learned to read.');
    yield S.say('sable', 'The Cup was never about sparing anyone. Every fight here makes Vigor. Vigor fuels the Ledger. And the Ledger is very hungry this cycle. Every world in this tournament gets archived when it ends.');
    yield S.say('brask', 'You set us up.');
    yield S.say('sable', 'I set everyone up. It is called a system.');
    yield S.say('juno', 'Then we break the system.');
    yield S.say('pell', 'There\'s a form! Form 77-B: "Appeal of Audit Finding, by Combat." If the Auditor is beaten by a contested party, every finding this cycle is void!');
    yield S.say('sable', 'Nobody has filed a 77-B in nine thousand cycles.');
    yield S.say('juno', 'Give me the pen.');
    giveItem('form77b');
    yield S.say('sable', '...Very well. The Ledger Vault. Come and contest me, if you can climb that far.');
    yield S.sfx('warp');
    yield S.remove('sable');
    yield S.say('null', 'I would fight beside you... but I have nothing left. Win. For every world that never got to argue.');
    G.flags.finalStarted = true;
    heal();
    yield S.say('pell', "I'll open the way. Good luck. I mean it. Officially AND personally.");
    yield* S.warp('vault', 11, 43, 'up');
    yield S.banner('FINAL CHAPTER', 'The Ledger Vault');
  }

  function* finalBoss() {
    yield S.spawn('sable', 'sable', 11, 6, 'down');
    yield S.walk('player', 11, 11, 60);
    yield S.say('sable', "You filed it. I'll admit I'm curious. Nobody ever reads the fine print.");
    yield S.say('juno', 'We read it. Then we underlined it.');
    yield S.say('brask', 'Twice.');
    yield S.say('sable', 'Very well. Contest the finding.');
    yield S.remove('sable');
    yield S.fight('sable', 11, 6, { lock: [3, 3, 18, 10], music: 'final' });
    G.flags.sableBeaten = true;
    AUDIO.jingle('victory');
    yield S.wait(1.2);
    yield S.spawn('sable', 'sable', 11, 6, 'down', { ko: true });
    yield S.spawn('pell', 'pell', 14, 9, 'left', { float: true });
    yield S.say('sable', '...Appeal... granted.');
    yield S.say('pell', 'EVERY finding void! All four worlds are safe! And contested findings get re-reviewed, which means archived worlds come back out for review, which means Null\'s world—');
    yield S.say('sable', '...comes back out of the archive. Yes. I can read too, Pell.');
    const s = npc('sable'); if (s) s.ko = false;
    yield S.say('sable', 'Hearth. Your Vigor Index is now nine hundred and ninety-one.');
    yield S.say('brask', 'Out of a thousand? Who has the other nine?');
    yield S.say('sable', 'The moss.');
    yield S.say('sable', "I'll be back next cycle for a re-audit. Try not to get any weaker.");
    yield S.say('sign', '...For a moment, Auditor Sable almost smiled.');
    yield* epilogue();
  }

  function* epilogue() {
    yield S.fade(1, 0.8);
    loadMap('village', 9, 10, 'left');
    G.enemies = [];
    G.flags.ending = true; G.flags.finalStarted = false;
    yield S.spawn('brask', 'brask', 6, 10, 'right');
    yield S.spawn('magsE', 'mags', 9, 7, 'down');
    yield S.spawn('pellE', 'pell', 4, 7, 'down', { float: true });
    yield S.spawn('velvetE', 'velvet', 12, 8, 'left');
    yield S.spawn('nullE', 'null', 12, 12, 'left');
    G.player.dir = 'left';
    yield S.music('title');
    yield S.fade(0, 0.8);
    yield S.banner('EPILOGUE', 'Match One Hundred', 2.2);
    yield S.say('mags', "Well? Everybody came all this way. Velvet brought a chair. Null brought... himself, I suppose.");
    yield S.say('null', "My world is back. It's small. It's very loud. I didn't know I missed loud.");
    yield S.say('velvet', 'I am only here to watch the duel. And to be "Juno\'s Friend Velvet." I had cards printed.');
    yield S.say('brask', 'Match one hundred. Again.');
    yield S.say('juno', "Forty-nine, forty-nine. Winner takes it all.");
    yield S.say('brask', 'Forty-nine, forty-nine, two draws.');
    yield S.say('juno', "DRAWS DON'T COUNT!");
    yield S.say('pell', '(writing) "The two of them went at it until sundown. Final result: inconclusive. Vigor Index: off the charts."');
    yield S.fade(1, 1.2);
    G.flags.noAuto = false;
    heal();
    SAVE.save();
    SCENES.credits();
  }

  /* ── people ─────────────────────────────────────────── */
  const TALK = {
    mags, brask, pell,
    *tam() {
      const F = f();
      if (F.kittenDone) { yield S.say('tam', "Biscuit hasn't left my side since. She smells a bit like smoke. I like it."); return; }
      if (F.kittenFound) {
        takeItem('biscuit'); F.kittenDone = true;
        yield S.say('tam', 'BISCUIT! You found her! She smells like a campfire!');
        yield S.say('juno', "Long story. There were brambles. And fire. She's fine.");
        yield S.say('tam', 'Here, you can have this. My grandpa says it makes punches heavier.');
        giveItem('wristband');
        yield S.say('sign', 'Use the Iron Wristband from the Items menu. It permanently raises the STR of whoever is out.');
        return;
      }
      if (!F.act1) { yield S.say('tam', 'Are you fighting Brask today? I bet on you. I bet my whole lunch.'); return; }
      if (!F.kittenQuest) {
        F.kittenQuest = true;
        yield S.say('tam', "Juno! My kitten Biscuit chased a butterfly into the Greenreach brambles and now she can't get out!");
        yield S.say('tam', "They're the thorny purple ones up in the northwest corner of the fields. Please get her out!");
        return;
      }
      yield S.say('tam', "Biscuit's in the brambles, northwest of the fields. The purple, thorny, very-dry ones.");
    },
    *biscuit() {
      const F = f();
      if (G.mapId === 'village') { yield S.say('biscuit', 'Mrrp.'); return; }
      yield S.say('biscuit', 'Mew! Mew mew!');
      F.kittenFound = true;
      G.npcs = G.npcs.filter((n) => n.id !== 'biscuit');
      giveItem('biscuit');
      yield S.say('juno', "Got you. Let's get you home to Tam.");
    },
    *rena() {
      const F = f();
      if (F.ending) yield S.say('rena', 'Nine hundred and ninety-one! I always said this town had vigor. I said it about my lemons, but still.');
      else if (F.portalOpen) yield S.say('rena', "There's a hole in the plaza that goes to space. Nobody asked me about the hole.");
      else if (F.act2) yield S.say('rena', "That auditor stamped my lemon tree. It says REVIEWED on it now. The lemons don't seem to mind.");
      else yield S.say('rena', "Juno! If you're fighting today, don't do it near my lemon tree. Last time a ki blast made lemonade out of half of them.");
    },
    *boro() {
      const F = f();
      if (F.act2) yield S.say('boro', 'I slept through the Auditor. Was she scary? She sounds scary. I am going back to sleep, just in case.');
      else yield S.say('boro', "*yawn*... Greenreach's Shellbacks are armoured. Fists bounce right off unless you hit like Brask. Ki blasts go through, though...");
    },
    *lia() {
      const F = f();
      if (F.act1 && !F.rookBeaten) yield S.say('lia', 'The barrier on the way to the Rustback camp only opens for LV 5 and up. Fight the critters in the fields first!');
      else if (F.act2 && !F.overdrive) yield S.say('lia', 'The Cinder Peaks shrine has three braziers. My dad says only real fire lights them. Juno, that sounds like you.');
      else yield S.say('lia', "Did you know you can spend stat points in the menu? Press Enter. I spend all of mine on VIT. I can't fight, but I'm really, really healthy.");
    },
    *elder() {
      const F = f();
      if (F.portalOpen && !F.ending) yield S.say('elder', 'The Interworld Cup... In my youth I watched Mags fight there. Remember: the Lens shows a foe\'s level. Red means it outclasses you. Train, child.');
      else if (F.act2) yield S.say('elder', 'Overdrive burns ki the whole time it lasts. Ignite it when it counts, not when it feels good.');
      else yield S.say('elder', 'Hmm? Ah, Juno. Your Lens (press S) shows red text for foes far above you. Gold for a fair fight. Green for... a warm-up.');
    },
    *kid2() {
      const F = f();
      if (F.act1) yield S.say('kid2', "If you get knocked out, the other one tags in. That's SO cool. I want a tag partner. Biscuit won't do it.");
      else yield S.say('kid2', "I'm Nim! I'm gonna be a fighter too! I've been practising punching the pond. The pond is winning.");
    },
    *odo() {
      const F = f();
      if (F.rookBeaten) yield S.say('odo', 'With Rook beaten my scallions are finally safe. Well, from Rook. Not from Mags.');
      else yield S.say('odo', "Rustbacks put a power barrier on the road to their camp, LV 5 to pass. And they've piled cracked boulders behind it. You'll want a heavy hitter.");
    },
    *furnace() {
      const F = f();
      if (!F.metFurnace) {
        F.metFurnace = true;
        yield S.say('furnace', "Visitors! Rare. Most people turn back at the first sign. Or the second. There are a lot of signs.");
        yield S.say('furnace', 'The shrine door wants three braziers lit. Real fire only. Your big friend\'s sparks won\'t do. No offence.');
        yield S.say('brask', 'Some taken.');
        yield S.say('furnace', 'Rest by my fire whenever you like.');
      }
      yield* rest('Old Furnace pokes the fire. "Sit. Rest a while?"');
    },
    *sir() {
      const F = f();
      if (F.autoDone) { yield S.say('sir', 'My collection! Complete! I shall have it framed. Then laminated. Then framed again.'); return; }
      if (!F.autoQuest) {
        F.autoQuest = true;
        yield S.say('sir', "I am Sir Dunmore of World 88! I didn't qualify. I'm here as a FAN. Would you be a darling and fetch me some autographs?");
        yield S.say('sir', 'Velvet, GRB-9 and that charming cactus fellow. They might not sign for just anyone, but for a fellow champion...');
        return;
      }
      if ((G.items.autograph || 0) >= 3) {
        takeItem('autograph', 3); F.autoDone = true;
        yield S.say('sir', 'Oh! OH! All three! Here, take these. A knight always pays his debts. Mostly in fruit.');
        giveItem('starfruit', 2); giveItem('heartroot', 1);
        return;
      }
      yield S.say('sir', 'Autographs: Velvet, GRB-9 and Prickles the cactus. ' + (G.items.autograph || 0) + ' of 3 so far!');
    },
    *cactus() {
      const F = f();
      if (F.autoQuest && !F.auto_cactus) { F.auto_cactus = true; yield S.say('cactus', 'An autograph? For Dunmore? Fine. Hold still. ...Sorry about the needles.'); giveItem('autograph'); return; }
      yield S.say('cactus', "I'm Prickles, from World 12. Everyone there is a cactus. We were eliminated in the qualifiers. We could not hold the controllers.");
    },
    *clerk() {
      yield S.say('clerk', 'I process forms for the Office. Between us? Nobody has read Section Nine in centuries. The print is very, very small.');
    },
    *velvet() { yield S.say('velvet', 'Our match will be exquisite. I have already chosen my victory pose. It is very tall.'); },
    *velvetAfter() {
      const F = f();
      if (F.autoQuest && !F.auto_velvet) { F.auto_velvet = true; yield S.say('velvet', 'An autograph? Of course. I shall sign my new name. It takes a while. ...There.'); giveItem('autograph'); return; }
      yield S.say('velvet', 'Juno\'s Friend Velvet, at your service. I am getting used to it.');
    },
    *grub() { yield S.say('grub', 'BEEP. THIS FLOOR IS EXCEPTIONALLY CLEAN. I APPROVE OF THIS OFFICE.'); },
    *grubAfter() {
      const F = f();
      if (F.autoQuest && !F.auto_grub) { F.auto_grub = true; yield S.say('grub', 'AUTOGRAPH REQUEST RECEIVED. PRINTING. ...I HAVE ALSO VACUUMED IT.'); giveItem('autograph'); return; }
      yield S.say('grub', 'I HAVE CANCELLED MY REQUIREMENT TO VACUUM YOU. PERMANENTLY.');
    },
    *null() { yield S.say('null', '...'); },
    *rook() { yield S.say('rook', '...Not the campfire.'); },
  };
  function talk(n) {
    const fn = TALK[n.talk];
    if (fn) run(fn);
  }

  /* ── bits of the world ──────────────────────────────── */
  let dummyHits = 0;
  function dummy() {
    dummyHits++;
    if (dummyHits === 1) UI.toast('Thwack!', '#ffffff');
    if (dummyHits === 12) UI.toast('The dummy has seen enough.', '#c8c8f0');
  }
  function* board() {
    const F = f();
    if (!F.act1) { yield S.say('sign', 'BOUNTY BOARD. "LOST: one lemon. Answers to nothing. It is a lemon." -Rena'); return; }
    if (!F.bountyQuest) {
      F.bountyQuest = true; F.bounty = F.bounty || 0;
      yield S.say('sign', 'BOUNTY: The wildlife in Greenreach Fields is getting bold. Thin out 20 of them. Reward: 150 coins and a Ki Crystal. (Signed, the Village Council.)');
      return;
    }
    if (!F.bountyDone && (F.bounty || 0) >= 20) {
      F.bountyDone = true; G.coins += 150;
      UI.toast('Got 150 coins!', '#ffd84a'); giveItem('kicrystal');
      yield S.say('sign', 'BOUNTY COMPLETE. A pouch and a glowing crystal are pinned to the board with a note: "Thanks. -The Council (Boro)"');
      return;
    }
    yield S.say('sign', F.bountyDone ? 'The bounty board has a new note: "STILL LOST: one lemon."' : 'BOUNTY: Greenreach wildlife, ' + Math.min(20, F.bounty || 0) + ' of 20.');
  }
  function onKill(e) {
    if (G.mapId === 'fields' && f().bountyQuest && !f().bountyDone) {
      f().bounty = (f().bounty || 0) + 1;
      if (f().bounty === 20) UI.toast('Bounty complete! Report to the board in Brindle.', '#7affb0');
    }
  }
  function vending() {
    run(function* () {
      yield S.say('sign', 'INTERWORLD SNACKS. "Accepts all currencies. Mostly coins."');
      const s = UI.shop('vending'); yield { update: () => s.done };
    });
  }

  /* shrine and arena arrivals are triggered by enter(); keep them here */
  const _enter = enter;
  function enterAll(id) {
    _enter(id);
    if (id === 'shrine' && !f().wardenBeaten) run(shrineBoss);
  }

  return {
    run, update, say, talk, enter: enterAll, goal, sideQuests, dummy, board: () => run(board), onKill, brazierLit,
    rook: () => rook(), finalBoss: () => finalBoss(), vending, rest: (t) => run(function* () { yield* rest(t); }), heal, joinBrask,
  };
})();
