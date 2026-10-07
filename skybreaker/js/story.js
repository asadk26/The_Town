/* SKYBREAKER — the story.

   An original tale in three chapters and an epilogue.  A world called Hearth
   gets a Notice of Audit from the Office of Cosmic Audit: its "Vigor Index"
   is 3 out of 1000, and low-scoring worlds get archived.  Juno, a brawler
   from Brindle Village, sets out to raise the score.  Rei, a wanderer
   looking for the teacher the Office took thirty years ago, walks with her.
   Oren — Brindle's gentle giant, who swore off fighting six years ago —
   packs their lunch, until the day he can't stand by any longer.  Brask and
   Isla, the famous pair from Ashford, want to be Hearth's champions instead.

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
    for (const id of DATA.PARTY_ORDER) { const h = G.party[id]; if (h && (all || h.joined)) { h.hp = h.maxHp; h.ki = h.maxKi; } }
  }
  function joinHero(id, lv) {
    const top = Math.max(...Object.values(G.party).map((h) => h.lv));
    const h = G.party[id] = G.party[id] || newHero(id, Math.max(1, lv || top));
    h.joined = true; h.hp = h.maxHp; h.ki = h.maxKi;
    return h;
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
  const tile = (e) => [Math.round((e.x - 8) / TS), Math.round((e.y - 12) / TS)];

  /* ── what to do now ─────────────────────────────────── */
  function goal() {
    const F = f();
    if (F.ending) return 'Free play. Find every chest. Fight everything.';
    if (F.finalStarted) return 'Climb the Ledger Vault. Contest Auditor Sable.';
    if (F.portalOpen) {
      if (G.mapId === 'lobby' || G.mapId === 'arena') return !F.qualifier ? 'Talk to Pell: settle things with Ashford.' : !F.match1 ? 'Talk to Pell to start Match 1.' : !F.match2 ? 'Talk to Pell for Match 2.' : 'Talk to Pell for the final match.';
      return "Enter the portal in Brindle's plaza.";
    }
    if (F.overdrive) return 'Return to Brindle.';
    if (F.orenJoined) return 'Break through to the Ember Shrine at the summit.';
    if (F.act2) {
      if (G.mapId === 'peaks') return F.shrineOpen ? 'Climb to the summit.' : 'Light the three braziers. Climb to the summit.';
      return hero().lv >= 8 || F.barrier_peaks ? 'Climb Cinder Peaks (north of Brindle).' : 'Reach LV 8, then head north to Cinder Peaks.';
    }
    if (F.rookBeaten) return 'Something is happening...';
    if (F.reiJoined) return hero().lv >= 5 || F.barrier_camp ? 'Cross into the Rustback camp (east Greenreach).' : 'Reach LV 5 to pass the barrier to the Rustback camp.';
    if (F.notice) return 'Head east to Greenreach Fields. Find the Rustback camp.';
    if (F.metMags) return F.metOren ? 'Hit the dummies, then talk to Oren.' : 'Find Oren at the training ground (west).';
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
    if (id === 'shrine' && !F.wardenBeaten) run(shrineBoss);
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
    yield S.say('juno', "Morning. Training day. Oren's holding pads, and I'm going to knock him clean off his feet.");
    yield S.say('juno', "...Okay, nobody has ever knocked Oren off his feet. But a girl can dream.");
    yield S.say('juno', 'Mags says nobody trains on an empty stomach, though. Noodle stall first. North of the plaza.');
  }

  function* mags() {
    const F = f();
    if (!F.metMags) {
      F.metMags = true;
      yield S.say('mags', "There's my brawler. Sit. Eat. You're all elbows today, I can tell.");
      yield S.say('juno', "I'm training with Oren this morning. I'm going to land a clean hit on him.");
      yield S.say('mags', 'Then remember what I taught you. Z to punch, and keep tapping for a combo. The last hit sends them flying.');
      yield S.say('mags', 'X throws ki. Hold X to charge your special. A picks which special you charge.');
      yield S.say('mags', 'And S, Juno. Hold S to guard. Tap it just as a hit lands and you parry: they stagger, and shots go right back where they came from.');
      yield S.say('mags', "Hitting things with your fists puts ki back in you. Charging does too, slowly. Use both.");
      giveItem('bun', 2, true); AUDIO.sfx('item');
      yield S.say('sign', 'Juno got 2 Peach Buns!');
      yield S.say('mags', "Oren's at the training ground on the west side. Go hit something that isn't my stall.");
      return;
    }
    const opts = F.notice ? ['Shop', 'Rest', 'Talk', 'Bye'] : ['Talk', 'Bye'];
    const c = yield S.ask('mags', F.act2 && !F.overdrive ? 'You look tired, all of you. Eat something.' : 'What can I get you?', opts);
    const pick = opts[c];
    if (pick === 'Shop') { const s = UI.shop('mags'); yield { update: () => s.done }; return; }
    if (pick === 'Rest') { yield* rest('Mags pulls out stools. "Sit down before you fall down." Rest?'); return; }
    if (pick !== 'Talk') return;
    if (F.notice && !F.scallionQuest) {
      F.scallionQuest = true;
      yield S.say('mags', 'A favour. My Champion Bowl needs Wild Scallions, and only the Greenreach ones are spicy enough.');
      yield S.say('mags', 'Bring me three and I will make it worth your while. They grow wild in the fields.');
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
    if (F.portalOpen) { yield S.say('mags', "I fought Sable once. She's never lost a stare. But she's never had three of you staring back."); return; }
    if (F.orenJoined) { yield S.say('mags', "He fought? Oren fought? ...Good. Six years is long enough to carry anything."); return; }
    if (F.act2) { yield S.say('mags', "Overdrive isn't a trick, it's a temper. The Ember Shrine shows you yours. Get to LV 8, then climb."); return; }
    if (F.notice) { yield S.say('mags', 'Brask and Isla? Ashford kids. Brask trained here once, with Oren, under me. That ended badly. Ask Oren, if you dare.'); return; }
    yield S.say('mags', "Oren's at the training ground. Go on, the noodles aren't going anywhere.");
  }

  /* Oren at the training ground; the notice falls on his head */
  function* oren() {
    const F = f();
    if (F.notice) {
      if (F.act2) yield S.say('oren', "Brask looked at me like I owed him something. I do. ...Go on. I'll keep the lunches warm.");
      else yield S.say('oren', "Guard, Juno. Always guard. And eat the second sandwich. It's the good one.");
      return;
    }
    if (!F.metMags) { yield S.say('oren', 'Breakfast first, Juno. Mags\' rules. I don\'t make them, I just get yelled at under them.'); return; }
    if (!F.metOren) {
      F.metOren = true;
      yield S.say('oren', "Morning, Juno! Pads are up. Well — the dummies are up. I've had a lot of coffee, I'm not getting hit by you before noon.");
      yield S.say('oren', 'Show me that combo on the dummies. Tap Z three times. Then come tell me how it felt.');
      return;
    }
    if (dummyHits < 6) { yield S.say('oren', "Few more on the dummies. Don't be shy, they've been through worse. Mostly from me."); return; }
    yield* notice();
  }

  function* notice() {
    yield S.say('oren', 'Look at that form! Your third hit is getting really—');
    const o = npc('oren');
    const env = { kind: 'prop', type: 'env', x: o.x, y: o.y - 120, img: SPR.props.sign, solidTiles: [] };
    G.props.push(env);
    yield { update: (dt) => { env.y += 200 * dt; return env.y >= o.y - 26; } };
    G.props = G.props.filter((q) => q !== env);
    AUDIO.sfx('hit'); burst(o.x, o.y - 40, '#f4f0e6', 10, 40);
    yield S.wait(0.6);
    yield S.say('oren', '...Huh. Mail.');
    yield S.say('juno', 'Oren, that fell out of the SKY.');
    yield S.say('oren', 'Then it\'s probably for you. Things from the sky usually are.');
    yield S.say('juno', '"NOTICE OF AUDIT. World 4417, Hearth. Vigor Index: 3 out of 1000. Status: UNDER REVIEW. Have a pleasant day."');
    yield S.sfx('warp');
    burst(G.player.x + 20, G.player.y - 40, '#c8a8ff', 16, 50);
    yield S.spawn('pell', 'pell', tile(G.player)[0] + 1, tile(G.player)[1] - 1, 'down', { float: true });
    yield S.say('pell', "Oh! Oh no. You OPENED it. You're not supposed to open it. It's addressed to the planet!");
    yield S.say('juno', 'Who are you?');
    yield S.say('pell', "Pell! Junior Clerk, Office of Cosmic Audit, third floor. I deliver the notices. Nobody's ever read one. They usually burn up on the way down.");
    yield S.say('oren', 'It bounced off my head.');
    yield S.say('pell', "...That's never happened either.");
    yield S.say('juno', "What's a Vigor Index?");
    yield S.say('pell', "It's how the Office decides which worlds are worth the paperwork. Mostly it measures how hard your strongest people can punch. It's an old system. I didn't design it.");
    yield S.say('juno', 'And we got a THREE?');
    yield S.say('pell', 'Out of a thousand. The average is six hundred. A world made entirely of moss scored forty.');
    yield S.say('oren', 'What happens to worlds that score low?');
    yield S.say('pell', '...They get archived.');
    yield S.say('oren', "Archived. Like Mags' old recipe cards?");
    yield S.say('pell', 'Archived like deleted! But in a very organised way.');
    yield S.say('pell', 'The Auditor arrives in three business days to review your case. If the score goes up before then, she might let it slide. Probably not. But maybe.');
    yield S.say('juno', 'Then we raise it. How?');
    yield S.say('pell', 'Beat something strong. The index notices big fights. There\'s a gang east of here — the Rustback Raiders? Their captain would count for a lot.');
    yield S.say('pell', "I'll be watching! Not in a creepy way. In an official way. Bye!");
    yield S.sfx('warp');
    const pl = npc('pell'); if (pl) burst(pl.x, pl.y - 20, '#c8a8ff', 16, 50);
    yield S.remove('pell');
    yield S.face('player', 'right');
    yield S.say('juno', "Oren. Come with me. You're the strongest person in Brindle. Everybody knows it.");
    yield S.music('ember');
    yield S.say('oren', "...I don't fight anymore, Juno. You know that.");
    yield S.say('juno', '...I know. I had to ask.');
    yield S.say('oren', "But I'll pack you lunch. Three sandwiches and a bun. And Juno? Guard. Always guard.");
    giveItem('bun', 3);
    G.flags.notice = true; G.flags.act1 = true;
    yield S.music('village');
    yield S.banner('GOAL', 'East, to the Rustback camp', 2.4);
  }

  /* Greenreach: Rei on the bridge */
  function* reiMeets() {
    G.flags.reiJoined = true;
    G.player.state = 'move';
    yield S.spawn('reiN', 'rei', 31, 24, 'left');
    yield S.spawn('ko1', 'grunt', 33, 23, 'down', { ko: true });
    yield S.spawn('ko2', 'grunt', 34, 26, 'down', { ko: true });
    yield S.walk('player', 27, 24, 70);
    yield S.face('player', 'right');
    yield S.say('rei', "...You're in my way.");
    yield S.say('juno', "You're on MY bridge.");
    yield S.say('rei', "It's a public bridge.");
    yield S.say('juno', "It's Brindle's public bridge. Who are you? And why are those Rustbacks having a nap?");
    yield S.say('rei', 'Rei. They asked for a toll. I paid them in a different currency.');
    yield S.say('rei', "I'm looking for something called the Office of Cosmic Audit. Thirty years ago my teacher went to their Interworld Cup. He never came back.");
    yield S.say('juno', '...Did his invitation fall out of the sky?');
    yield S.say('rei', 'It did.');
    yield S.say('juno', 'Then this is going to sound weird, but — snap.');
    yield S.say('sign', 'Juno shows him the Notice. Rei reads it twice.');
    yield S.say('rei', "Then I'll walk with you. For now. Wherever that envelope goes, the answers are at the other end.");
    yield S.say('juno', "Great. I'm Juno. I punch things.");
    yield S.say('rei', 'I noticed. You telegraph your third hit.');
    yield S.say('juno', "That is a SIGNATURE MOVE.");
    yield S.remove('reiN');
    burst(31 * TS + 8, 24 * TS, '#7ae0ff', 14, 50);
    joinHero('rei');
    AUDIO.sfx('level');
    yield S.say('sign', 'Rei joined! Press C to tag between fighters. If one goes down, the next tags in automatically.');
    yield S.say('sign', "Rei's Gale Step (his first special) carries him across chasms. Juno's ki sets dry things alight.");
    yield S.remove('ko1'); yield S.remove('ko2');
  }

  /* Ashford arrives at the camp gate */
  function* rivals1() {
    G.player.state = 'move';
    yield S.spawn('braskN', 'brask', 58, 24, 'left');
    yield S.spawn('islaN', 'isla', 58, 26, 'left');
    yield S.say('isla', 'Oh, look, Brask. Brindle sent someone.');
    yield S.say('brask', 'Two someones.');
    yield S.say('juno', 'And who are YOU?');
    yield S.say('isla', 'Isla Morrow. That\'s Brask Kade. Of Ashford? The Ashford Pair? You will have heard of us.');
    yield S.say('rei', 'No.');
    yield S.say('isla', '...Everyone has heard of us.');
    yield S.say('brask', "We got an envelope too. Rook is ours. When the Auditor comes, Hearth's champions will be people somebody has heard of — not a noodle town.");
    yield S.say('juno', 'Brindle is NOT a noodle town.');
    yield S.say('juno', "...It's MOSTLY a noodle town. Fight me.");
    yield S.remove('braskN'); yield S.remove('islaN');
    yield S.fight('brask_a', 58, 24, { lock: [50, 20, 8, 10], with: ['isla_a', 58, 26],
      until: () => G.enemies.filter((e) => e.boss).every((e) => e.hp < e.maxHp * 0.45) });
    G.flags.rivals1 = true;
    gainXp(120); AUDIO.jingle('victory');
    yield S.spawn('braskN', 'brask', 58, 24, 'left');
    yield S.spawn('islaN', 'isla', 58, 26, 'left');
    yield S.say('isla', 'Hm. Not bad, for noodle people. Brask, we are leaving. This is beneath our schedule.');
    yield S.say('brask', '...Is that a lunchbox? Square sandwiches, crusts off.');
    yield S.say('juno', "Oren made it. You know Oren?");
    yield S.say('brask', "...Tell him nothing. Tell him I said nothing.");
    yield S.walk('braskN', 58, 18, 70);
    yield S.remove('braskN'); yield S.remove('islaN');
    yield S.say('rei', 'Friends of yours?');
    yield S.say('juno', 'Apparently Oren has history. Oren has never had history. Oren has BREAD.');
  }

  function* rook() {
    G.player.state = 'move';
    yield S.spawn('rook', 'rook', 66, 24, 'left');
    yield S.walk('player', 61, 24, 70);
    yield S.face('player', 'right');
    yield S.say('rook', "Well, well. First the Ashford brats, now Brindle. MY camp is very popular today.");
    yield S.say('rei', 'Your camp is stolen fences and one sad campfire.');
    yield S.say('rook', 'It is a LOVELY campfire.');
    yield S.say('juno', "Rook, we need to beat you up. It's for the planet.");
    yield S.say('rook', '...What?');
    yield S.say('juno', "It's a long story with a lot of paperwork.");
    yield S.say('rook', 'RUSTBACKS! Nobody leaves this camp without paying the toll! And the toll is... GETTING BEATEN UP!');
    yield S.say('rei', "That isn't a toll. That's just a fight.");
    yield S.say('rook', "...IT'S A TOLL FIGHT.");
    yield S.remove('rook');
    yield S.fight('rook', 66, 24, { lock: [57, 15, 15, 19] });
    G.flags.rookBeaten = true;
    AUDIO.jingle('victory');
    yield S.spawn('rook', 'rook', Math.max(58, Math.min(70, tile(G.player)[0] + 3)), tile(G.player)[1], 'left', { ko: true });
    yield S.wait(1.2);
    gainXp(140); G.coins += 120; UI.toast('Got 120 coins!', '#ffd84a');
    yield S.say('rook', 'Ow. Okay. Okay. You win. Take whatever you want. Not the campfire.');
    yield S.sfx('warp');
    yield S.spawn('pell', 'pell', tile(G.player)[0], tile(G.player)[1] - 2, 'down', { float: true });
    yield S.say('pell', 'You did it! The index moved! Hearth is up to... FORTY-ONE!');
    yield S.say('juno', "Forty-one! We're beating the moss!");
    yield S.say('pell', '...Oh. Oh no.');
    yield S.say('rei', 'What "oh no"?');
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
    const crowd = ['rena', 'boro', 'lia', 'kid2', 'tam', 'elder'];
    for (const n of G.npcs) if (crowd.includes(n.id)) n.wander = false;
    const place = (id, x, y, d) => { const n = npc(id); if (n) { n.x = x * TS + 8; n.y = y * TS + 12; n.dir = d; n.wander = false; } };
    place('rena', 19, 20, 'right'); place('lia', 29, 20, 'left'); place('boro', 20, 24, 'up'); place('elder', 28, 24, 'up'); place('tam', 18, 22, 'right');
    G.npcs = G.npcs.filter((n) => n.id !== 'oren');
    yield S.spawn('reiN', 'rei', 26, 22, 'up');
    yield S.spawn('orenN', 'oren', 22, 23, 'up');
    yield S.spawn('pell', 'pell', 23, 21, 'up', { float: true });
    yield S.spawn('braskN', 'brask', 30, 18, 'left');
    yield S.spawn('islaN', 'isla', 30, 17, 'left');
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
    yield S.say('sable', "I don't want anything. Wanting is inefficient. I review. Your index jumped thirty-eight points in an afternoon. Numbers don't jump. Numbers are earned, filed and approved.");
    yield S.say('rei', "My teacher's number went to your office thirty years ago. Where is he?");
    yield S.say('sable', 'Filed.');
    yield S.say('sable', 'Now. Your strongest attacks. Show me. I have all the time there is.');
    yield S.remove('sable'); yield S.remove('reiN'); yield S.remove('pell');
    G.flags.noAuto = true;
    yield S.fight('sable_test', 24, 15, { lock: [18, 13, 14, 11], music: 'audit', noKO: true, until: (t) => t > 24 || hero().hp <= hero().maxHp * 0.3 });
    G.flags.noAuto = false;
    G.player.state = 'ko';
    AUDIO.sfx('boom'); G.shake = 0.6;
    yield S.flash('#c8a8ff');
    yield S.spawn('sable', 'sable', 24, 15, 'down');
    yield S.spawn('reiN', 'rei', 26, 21, 'up', { ko: true });
    yield S.spawn('pell', 'pell', 22, 21, 'up', { float: true });
    yield S.wait(0.8);
    yield S.say('sable', 'Hm.');
    yield S.say('sable', 'Vigor: adequate, for a world that still uses doors.');
    yield S.say('sable', "Here is my finding. In seven days the Interworld Cup convenes in my office. Four worlds under review each send one team. The winning world's file is closed. The others are archived.");
    yield S.say('isla', 'Ashford has already filed a petition to be that team.');
    yield S.say('sable', 'So I see. One world, one entry. Settle it between yourselves. Quickly. I dislike duplicates.');
    yield S.sfx('warp'); burst(24 * TS + 8, 15 * TS, '#c8a8ff', 24, 70);
    yield S.remove('sable'); yield S.remove('pell');
    G.player.state = 'move';
    const r = npc('reiN'); if (r) r.ko = false;
    yield S.music('ember');
    yield S.walk('braskN', 26, 19, 50);
    yield S.say('brask', 'Still not fighting, big man? Not even with the planet on the line?');
    yield S.say('oren', '...');
    yield S.say('brask', "Didn't think so. Come on, Isla.");
    yield S.walk('braskN', 30, 16, 60);
    yield S.remove('braskN'); yield S.remove('islaN');
    yield S.face('player', 'down');
    yield S.say('juno', 'Oren. What was that?');
    yield S.say('oren', 'Old business. ...Mags wants you.');
    yield S.spawn('mags2', 'mags', 24, 26, 'up');
    yield S.walk('mags2', 24, 24, 40);
    yield S.say('mags', 'So. The Auditor. Fifty years ago she audited this world too. I was its champion. I won, just barely, because of something called Overdrive.');
    yield S.say('mags', 'When your ki burns hotter than your body can hold, and you hold it anyway. I learned it at the Ember Shrine, at the top of Cinder Peaks.');
    yield S.say('mags', "The barrier on the north road only opens for fighters at LV 8 or higher. Get strong. Then climb.");
    yield S.say('rei', "We'll be ready.");
    yield S.say('juno', 'We will. ...Oren?');
    yield S.say('oren', "I'll be here. I'll pack the lunches.");
    yield S.remove('mags2'); yield S.remove('reiN'); yield S.remove('orenN');
    addNpc({ id: 'oren', look: 'oren', tx: 8, ty: 10, dir: 'left', talk: 'oren' });
    heal();
    G.flags.act2 = true;
    for (const n of G.npcs) if (crowd.includes(n.id)) { n.wander = true; n.home = { x: n.x, y: n.y }; }
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

  /* the summit: Ashford waits, and Oren keeps his promise a different way */
  function* summit() {
    G.player.state = 'move';
    yield S.spawn('braskN', 'brask', 27, 11, 'down');
    yield S.spawn('islaN', 'isla', 29, 11, 'down');
    yield S.say('isla', 'Took you long enough. The shrine is ours. Brask needs Overdrive more than you do.');
    yield S.say('brask', "Turn around, Brindle. This doesn't have to hurt.");
    yield S.say('juno', 'It always has to hurt a little. That\'s how you know it\'s working.');
    yield S.remove('braskN'); yield S.remove('islaN');
    G.flags.noAuto = true;
    yield S.fight('brask_b', 27, 11, { lock: [21, 11, 14, 6], with: ['isla_b', 29, 11], noKO: true,
      until: (t) => hero().hp <= hero().maxHp * 0.3 || t > 40 });
    G.player.state = 'ko';
    for (const id of ['juno', 'rei']) if (G.party[id]) G.party[id].hp = 1;
    yield S.flash('#8ab8ff');
    yield S.spawn('braskN', 'brask', 27, 11, 'down');
    yield S.spawn('islaN', 'isla', 29, 11, 'down');
    yield S.spawn('reiN', 'rei', tile(G.player)[0] + 2, tile(G.player)[1], 'up', { ko: true });
    yield S.music('ember');
    yield S.say('brask', "Stay down. Both of you. This isn't your fight anymore.");
    yield S.wait(0.6);
    yield S.sfx('step'); yield S.wait(0.35); yield S.sfx('step'); yield S.wait(0.35); yield S.sfx('step');
    yield S.spawn('orenN', 'oren', 28, 20, 'up');
    yield S.walk('orenN', 28, 16, 30);
    yield S.say('oren', '...I brought lunch.');
    yield S.say('isla', 'Brask. That is the biggest man I have ever seen.');
    yield S.say('brask', 'I know. Turn around, Oren. Go home.');
    yield S.say('sign', 'Oren sets the lunchbox down very carefully on a rock.');
    yield S.say('oren', 'You hurt my friends.');
    yield S.say('brask', "You broke my arm. In the final. In front of everyone. Then you quit, like that made it even. You don't get to—");
    yield S.say('oren', "I know. I've been sorry for six years, Brask. Every day.");
    yield S.say('oren', "But I'm not sorry about this.");
    yield S.shake(0.6); yield S.sfx('transform');
    yield S.remove('orenN'); yield S.remove('reiN');
    const p = G.player;
    p.x = 28 * TS + 8; p.y = 16 * TS + 12; p.dir = 'up'; p.state = 'move'; p.invuln = 1;
    const o = joinHero('oren', Math.max(11, G.party.juno.lv + 1));
    o.hp = o.maxHp;
    G.active = 'oren';
    G.flags.locked = ['juno', 'rei'];
    yield S.banner('OREN', 'breaks his vow', 2.2);
    yield S.say('sign', "You are playing as Oren. Juno and Rei can't tag in. Quake shakes the ground; Oren's fists ignore armour.");
    yield S.remove('braskN'); yield S.remove('islaN');
    yield S.fight('brask_b', 27, 11, { lock: [21, 11, 14, 6], with: ['isla_b', 29, 11], music: 'battle' });
    G.flags.locked = null; G.flags.noAuto = false;
    G.flags.orenJoined = true;
    AUDIO.jingle('victory');
    gainXp(300); G.coins += 200; UI.toast('Got 200 coins!', '#ffd84a');
    yield S.spawn('braskN', 'brask', 27, 11, 'down', { ko: true });
    yield S.spawn('islaN', 'isla', 29, 11, 'down');
    yield S.wait(0.8);
    yield S.say('isla', "Brask. ...Brask. We're done here.");
    const bk = npc('braskN'); if (bk) bk.ko = false;
    yield S.say('brask', 'You still hit like a falling house.');
    yield S.say('oren', 'You still drop your left.');
    yield S.say('brask', '...Yeah. I do.');
    yield S.walk('braskN', 27, 19, 50);
    yield S.remove('braskN'); yield S.remove('islaN');
    yield S.fade(1, 0.4);
    heal();
    yield S.fade(0, 0.4);
    yield S.say('juno', 'OREN. You fought. You FOUGHT.');
    yield S.say('oren', "Someone had to carry the lunch up here. Seemed a shame to waste the trip.");
    yield S.say('rei', "That wall of rock in front of the shrine. Can you—");
    yield S.say('oren', "I'm coming with you. All the way. ...And yes. I can.");
    AUDIO.sfx('level');
    yield S.say('sign', 'Oren joined! His heavy blows (the third punch in a combo, Quake and Giant Swing) shatter cracked stone. Press C to cycle through all three fighters.');
    yield S.banner('GOAL', 'Into the Ember Shrine', 2.2);
  }

  function* shrineBoss() {
    G.flags.wardenIntro = true;
    yield S.wait(0.4);
    yield S.say('warden', '...WHO CLIMBS.');
    yield S.say('juno', 'Juno, Rei and Oren, from Brindle. Mostly from Brindle. We came for Overdrive.');
    yield S.say('warden', 'MANY HAVE COME. FEW LEFT WITH IT. MOST LEFT WITH BRUISES.');
    yield S.say('oren', 'We brought our own bruises. And sandwiches.');
    yield S.say('warden', 'THEN SHOW ME HOW YOU BURN.');
    yield S.fight('warden', 9, 5, { lock: [3, 3, 14, 11] });
    G.flags.wardenBeaten = true;
    AUDIO.jingle('victory');
    gainXp(420); G.coins += 300; UI.toast('Got 300 coins!', '#ffd84a');
    yield S.wait(1.0);
    yield S.spawn('wardenNpc', null, 9, 5, 'down', { creature: ['warden'], state: 'fixed', scale: 1.6 });
    yield S.say('warden', '...ENOUGH.');
    yield S.say('warden', 'THE FLAME WAS ALWAYS IN YOU. I ONLY HAD TO MAKE YOU ANGRY.');
    yield S.flash('#ffd84a');
    yield S.sfx('transform'); yield S.shake(0.6);
    G.flags.overdrive = true;
    for (const id of DATA.PARTY_ORDER) burst(G.player.x, G.player.y - 20, DATA.HEROES[id].kiColor, 20, 80);
    yield S.say('sign', 'All three learned OVERDRIVE! Select it with A, then hold X to ignite. It drains ki while it lasts; charge it again to stop.');
    yield S.say('juno', 'It feels like my hair is on fire.');
    yield S.say('warden', 'IT IS. A LITTLE.');
    yield S.say('rei', 'Mine feels like frost.');
    yield S.say('warden', 'YOURS IS ON FROST. IT IS DIFFERENT.');
    yield S.say('oren', 'I feel... warm. Like an oven.');
    yield S.say('warden', 'YES. THAT TRACKS.');
    yield S.sfx('warp');
    yield S.spawn('pell', 'pell', 11, 9, 'up', { float: true });
    yield S.say('pell', "The seven days are up! Well, it's been about three hours. She rounded.");
    yield S.say('pell', "I've opened a portal in your village plaza. Go home, get ready, and step through. The Interworld Cup is waiting. So is Ashford — they still think the entry is theirs.");
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
    yield S.say('pell', "But first: Hearth has two entries, and the rules say one. Ashford is by the far pillar, looking smug. Talk to me when you're ready to settle it.");
  }

  function* pell() {
    const F = f();
    if (G.mapId !== 'lobby') { yield S.say('pell', 'Forms, forms, forms.'); return; }
    if (!F.qualifier) {
      const c = yield S.ask('pell', 'The qualifier: you versus Ashford. Winner is Hearth\'s team. Ready? (LV 12+ recommended.)', ['Fight!', 'Not yet']);
      if (c === 0) yield* match(0);
    } else if (!F.match1) {
      const c = yield S.ask('pell', 'Match One: Velvet, the Masked Blade of World 9. Teleports, throws daggers, very dramatic. Ready? (LV 13+ recommended.)', ['Fight!', 'Not yet']);
      if (c === 0) yield* match(1);
    } else if (!F.match2) {
      const c = yield S.ask('pell', 'Match Two: GRB-9 of World 31. A big robot with beam weapons. Ready? (LV 14+ recommended.)', ['Fight!', 'Not yet']);
      if (c === 0) yield* match(2);
    } else if (!F.match3) {
      const c = yield S.ask('pell', "The final match: Null, of... World 0. There's no World 0 in my files. Ready? (LV 15+ recommended.)", ['Fight!', 'Not yet']);
      if (c === 0) yield* match(3);
    } else yield S.say('pell', 'The Vault is through the gate. Go!');
  }

  function* match(n) {
    yield S.fade(1, 0.3);
    loadMap('arena', 10, 13, 'up');
    SAVE.auto();
    yield S.fade(0, 0.3);
    if (n === 0) {
      yield S.spawn('braskN', 'brask', 9, 4, 'down');
      yield S.spawn('islaN', 'isla', 12, 4, 'down');
      yield S.banner('QUALIFIER', 'Brindle vs Ashford', 2);
      yield S.say('isla', 'In front of an audience of cosmic bureaucrats. How flattering.');
      yield S.say('brask', "This one's clean, Oren. No crowd from home. Just us.");
      yield S.say('oren', 'Just us. Like the old days.');
      yield S.say('juno', 'Can we skip the old days and get to the part where I win?');
      yield S.remove('braskN'); yield S.remove('islaN');
      yield S.fight('brask_c', 9, 4, { lock: [2, 2, 18, 13], with: ['isla_c', 12, 4] });
      G.flags.qualifier = true;
      AUDIO.jingle('victory');
      gainXp(380); G.coins += 220; UI.toast('Got 220 coins!', '#ffd84a');
      yield S.wait(0.8);
      yield S.spawn('braskN', 'brask', 9, 5, 'down');
      yield S.spawn('islaN', 'isla', 12, 5, 'down');
      yield S.say('isla', 'Fine. FINE. Hearth is yours. We will be in the stands. Loudly.');
      yield S.say('brask', "...Don't lose to some robot, big man.");
      yield S.say('oren', "Wouldn't dream of it. Want a sandwich?");
      yield S.say('brask', '...Crusts off?');
      yield S.say('oren', 'Always.');
      yield* backToLobby('Hearth is officially entered! Match One whenever you\'re ready.');
      return;
    }
    const who = ['velvet', 'grub', 'null'][n - 1];
    if (who === 'grub') yield S.spawn('opp', null, 10, 4, 'down', { creature: ['robot'], scale: 1.4 });
    else yield S.spawn('opp', who, 10, 4, 'down');
    yield S.banner('MATCH ' + n, ['Velvet', 'GRB-9', 'Null'][n - 1], 2);
    if (n === 1) {
      yield S.say('velvet', 'Ah, the little world with the big score jump. I am Velvet. On World 9 we settle everything with duels. Breakfast. Taxes. Names.');
      yield S.say('juno', 'How did you get the name Velvet?');
      yield S.say('velvet', 'I won it from a man called Corduroy.');
      yield S.say('rei', '...Who did Corduroy win it from?');
      yield S.say('velvet', 'En garde!');
    } else if (n === 2) {
      yield S.say('grub', 'GREETINGS. I AM GRB-9. I WAS ENTERED IN THIS TOURNAMENT BY ACCIDENT. MY WORLD SENT ITS STRONGEST UNIT.');
      yield S.say('grub', 'I AM A VACUUM CLEANER.');
      yield S.say('oren', '...Then why do you have beam weapons?');
      yield S.say('grub', 'FOR STUBBORN STAINS. PLEASE STEP ASIDE. I AM REQUIRED TO VACUUM YOU.');
    } else {
      yield S.say('null', '...');
      yield S.say('juno', "Hey. You're the one from the corner.");
      yield S.say('null', 'I have no world. It was archived, ten thousand cycles ago. I am what was left over.');
      yield S.say('null', 'She promised me: if I win, my world comes back. So I will win.');
      yield S.say('null', 'I learned to fight by watching. Thirty years ago a man with silver hair fought me here. When he lost, he would not let me be archived alone. He stayed.');
      yield S.say('rei', '...My teacher.');
      yield S.say('null', 'Fight me, his student. Show me what he taught.');
    }
    yield S.remove('opp');
    yield S.fight(['velvet', 'grub', 'null'][n - 1], 10, 4, { lock: [2, 2, 18, 13], music: n === 3 ? 'final' : 'battle' });
    G.flags['match' + n] = true;
    AUDIO.jingle('victory');
    const B = DATA.BOSSES[who];
    gainXp(B.xp); G.coins += B.coins; UI.toast('Got ' + B.coins + ' coins!', '#ffd84a');
    yield S.wait(1.0);
    if (who === 'grub') yield S.spawn('opp', null, 10, 5, 'down', { creature: ['robot'], scale: 1.4 });
    else yield S.spawn('opp', who, 10, 5, 'down', { ko: who === 'null' });
    if (n === 1) {
      yield S.say('velvet', 'Magnifique... I have lost a duel. Now I must change my name.');
      yield S.say('velvet', 'From now on, I am "Juno\'s Friend Velvet." It is long, but it is honest.');
    } else if (n === 2) {
      yield S.say('grub', 'DEFEAT ACKNOWLEDGED. THANK YOU. I DID NOT WANT TO VACUUM YOU. YOU SEEM NICE.');
      yield S.say('grub', 'I WILL RETURN TO MY WORLD AND CLEAN IT VERY THOROUGHLY.');
    } else { yield* finale(); return; }
    yield* backToLobby(n === 1 ? "Match Two whenever you're ready." : 'One more match. The last one.');
  }
  function* backToLobby(line) {
    yield S.fade(1, 0.3);
    heal();
    loadMap('lobby', 15, 7, 'up');
    SAVE.auto();
    yield S.fade(0, 0.3);
    yield S.say('pell', 'Wonderful! Complimentary healing between rounds. ' + line);
  }

  function* finale() {
    yield S.say('null', '...I have lost. My world stays gone. And so does he.');
    yield S.say('rei', "No. He stayed so you wouldn't be alone. I'm not leaving either of you in a drawer.");
    yield S.sfx('stamp'); yield S.shake(0.4);
    yield S.spawn('sable', 'sable', 14, 4, 'left');
    yield S.music('audit');
    yield S.say('sable', 'Congratulations, World 4417. Your file is closed.');
    yield S.say('juno', "And Null's world? Rei's teacher?");
    yield S.say('sable', 'Archived worlds stay archived. That is what "archived" means.');
    yield S.spawn('pell', 'pell', 7, 9, 'right', { float: true });
    yield S.say('pell', "Um. Auditor? I've been reading the rulebook. Section Nine, the quota. It says the Office must archive a set amount of Vigor every cycle, and... it doesn't say only the losers.");
    yield S.say('sable', 'I see Pell has learned to read.');
    yield S.say('sable', 'The Cup was never about sparing anyone. Every fight here makes Vigor. Vigor fuels the Ledger. The Ledger is very hungry this cycle. Every world in this tournament is archived when it ends.');
    yield S.say('oren', 'You set us up.');
    yield S.say('sable', 'I set everyone up. It is called a system.');
    yield S.say('juno', 'Then we break the system.');
    yield S.say('pell', 'There\'s a form! Form 77-B: "Appeal of Audit Finding, by Combat." If the Auditor is beaten by a contested party, every finding this cycle is void — and archived cases are reopened!');
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
    yield S.say('rei', 'Twice.');
    yield S.sfx('warp');
    yield S.spawn('braskA', 'brask', 6, 10, 'right');
    yield S.spawn('islaA', 'isla', 16, 10, 'left');
    yield S.say('isla', 'Did you think the stands were going to stay in the stands?');
    yield S.say('brask', "Hearth's team doesn't fight alone. We'll keep her paperwork busy. You hit her.");
    yield S.say('sable', 'Duplicates. I did say I disliked them. Very well. Contest the finding.');
    yield S.remove('sable');
    G.assist = { t: 6 };
    yield S.fight('sable', 11, 6, { lock: [3, 3, 18, 10], music: 'final' });
    G.assist = null;
    G.flags.sableBeaten = true;
    AUDIO.jingle('victory');
    yield S.wait(1.2);
    yield S.spawn('sable', 'sable', 11, 6, 'down', { ko: true });
    yield S.spawn('pell', 'pell', 14, 9, 'left', { float: true });
    yield S.say('sable', '...Appeal... granted.');
    yield S.say('pell', "EVERY finding void! All four worlds are safe! And reopened cases mean archived worlds come back out for review, which means Null's world—");
    yield S.say('sable', '...comes back out of the archive. With everyone filed inside it. Yes. I can read too, Pell.');
    const s = npc('sable'); if (s) s.ko = false;
    yield S.say('sable', 'Hearth. Your Vigor Index is now nine hundred and ninety-one.');
    yield S.say('oren', 'Out of a thousand? Who has the other nine?');
    yield S.say('sable', 'The moss.');
    yield S.say('sable', "I'll be back next cycle for a re-audit. Try not to get any weaker.");
    yield S.say('sign', '...For a moment, Auditor Sable almost smiled.');
    yield* epilogue();
  }

  function* epilogue() {
    yield S.fade(1, 0.8);
    loadMap('village', 9, 10, 'left');
    G.enemies = [];
    G.npcs = G.npcs.filter((n) => n.id !== 'oren');
    G.flags.ending = true; G.flags.finalStarted = false;
    yield S.spawn('islaE', 'isla', 6, 10, 'right');
    yield S.spawn('orenE', 'oren', 7, 8, 'down');
    yield S.spawn('braskE', 'brask', 6, 8, 'down');
    yield S.spawn('reiE', 'rei', 11, 12, 'left');
    yield S.spawn('magsE', 'mags', 9, 7, 'down');
    yield S.spawn('pellE', 'pell', 4, 7, 'down', { float: true });
    yield S.spawn('velvetE', 'velvet', 12, 8, 'left');
    G.player.dir = 'left';
    yield S.music('title');
    yield S.fade(0, 0.8);
    yield S.banner('EPILOGUE', 'A Rematch in Brindle', 2.2);
    yield S.say('mags', "Well. Everybody came all this way. Velvet brought a chair. Ashford brought opinions.");
    yield S.say('rei', 'Null sent word. His world is back. Loud, he says. And a silver-haired old man walked out of it complaining about the food.');
    yield S.say('juno', 'Your teacher!');
    yield S.say('rei', "I'm going to see him. Then I'm coming back. Somebody has to fix your third hit.");
    yield S.say('brask', 'Oren. Arm-wrestle. Best of one hundred.');
    yield S.say('oren', "Only if you stay for dinner after.");
    yield S.say('brask', '...Crusts off?');
    yield S.say('isla', 'And you, noodle girl. You and me. Today.');
    yield S.say('juno', "Match one, Ashford. Don't cry when you lose.");
    yield S.say('isla', 'I never cry. I am simply very elegant about losing.');
    yield S.say('pell', '(writing) "The rematch went on until sundown. Final result: inconclusive. Vigor Index: off the charts."');
    yield S.fade(1, 1.2);
    G.flags.noAuto = false;
    heal();
    SAVE.save();
    SCENES.credits();
  }

  /* ── people ─────────────────────────────────────────── */
  const TALK = {
    mags, oren, pell,
    *tam() {
      const F = f();
      if (F.kittenDone) { yield S.say('tam', "Biscuit hasn't left my side since. She smells a bit like smoke. I like it."); return; }
      if (F.kittenFound) {
        takeItem('biscuit'); F.kittenDone = true;
        yield S.say('tam', 'BISCUIT! You found her! She smells like a campfire!');
        yield S.say('juno', "Long story. There were brambles. And fire. She's fine.");
        yield S.say('tam', 'Here, you can have this. My grandpa says it makes punches heavier.');
        giveItem('wristband');
        yield S.say('sign', 'Use the Iron Wristband from the Items menu. It permanently raises the STR of whoever you choose.');
        return;
      }
      if (!F.notice) { yield S.say('tam', 'Are you training with Oren? He made me a cake shaped like a fist once. It was the best day of my life.'); return; }
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
      else yield S.say('rena', "Juno! If you're training today, don't do it near my lemon tree. Last time a ki blast made lemonade out of half of them.");
    },
    *boro() {
      const F = f();
      if (F.orenJoined) yield S.say('boro', 'Oren fought? Our Oren? The one who apologises to doors? ...I need to sit down. More.');
      else if (F.act2) yield S.say('boro', 'I slept through the Auditor. Was she scary? I am going back to sleep, just in case.');
      else yield S.say('boro', "*yawn*... Greenreach's Shellbacks are armoured. Fists bounce right off unless you hit like Oren. Ki blasts go through, though...");
    },
    *lia() {
      const F = f();
      if (F.notice && !F.rookBeaten) yield S.say('lia', "The barrier to the Rustback camp only opens for LV 5 and up. And there's a chasm behind it. You'll want someone light on their feet.");
      else if (F.act2 && !F.overdrive) yield S.say('lia', 'The Cinder Peaks shrine has three braziers. My dad says only real fire lights them. Juno, that sounds like you.');
      else yield S.say('lia', "Did you know you can spend stat points in the menu? I spend all of mine on VIT. I can't fight, but I'm really, really healthy.");
    },
    *elder() {
      const F = f();
      if (F.portalOpen && !F.ending) yield S.say('elder', 'The Interworld Cup... In my youth I watched Mags fight there. Remember: parry the beams. Yes, you can parry beams. Probably.');
      else if (F.act2) yield S.say('elder', 'Overdrive burns ki the whole time it lasts. Ignite it when it counts, not when it feels good.');
      else yield S.say('elder', 'Hmm? Ah, Juno. A good guard is worth ten good punches. A perfect guard — the parry — is worth all of them.');
    },
    *kid2() {
      const F = f();
      if (F.orenJoined) yield S.say('kid2', 'THREE fighters! When one gets knocked out, the next tags in. I want a tag team. Biscuit still won\'t do it.');
      else yield S.say('kid2', "I'm Nim! I'm gonna be a fighter too! I've been practising punching the pond. The pond is winning.");
    },
    *odo() {
      const F = f();
      if (F.rookBeaten) yield S.say('odo', 'With Rook beaten my scallions are finally safe. Well, from Rook. Not from Mags.');
      else yield S.say('odo', "Rustbacks put a power barrier on the road to their camp, LV 5 to pass, and the ground drops into a chasm right behind it. And there's cracked rock all over these fields. Somebody strong could clear it, one day.");
    },
    *furnace() {
      const F = f();
      if (!F.metFurnace) {
        F.metFurnace = true;
        yield S.say('furnace', 'Visitors! Rare. Most people turn back at the first sign. Or the second. There are a lot of signs.');
        yield S.say('furnace', "The shrine door wants three braziers lit. Real fire only. And the old paths are broken by chasms — you'll need quick feet.");
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
    *clerk() { yield S.say('clerk', 'I process forms for the Office. Between us? Nobody has read Section Nine in centuries. The print is very, very small.'); },
    *velvet() { yield S.say('velvet', 'Our match will be exquisite. I have already chosen my victory pose. It is very tall.'); },
    *velvetAfter() {
      const F = f();
      if (F.autoQuest && !F.auto_velvet) { F.auto_velvet = true; yield S.say('velvet', 'An autograph? Of course. I shall sign my new name. It takes a while. ...There.'); giveItem('autograph'); return; }
      yield S.say('velvet', "Juno's Friend Velvet, at your service. I am getting used to it.");
    },
    *grub() { yield S.say('grub', 'BEEP. THIS FLOOR IS EXCEPTIONALLY CLEAN. I APPROVE OF THIS OFFICE.'); },
    *grubAfter() {
      const F = f();
      if (F.autoQuest && !F.auto_grub) { F.auto_grub = true; yield S.say('grub', 'AUTOGRAPH REQUEST RECEIVED. PRINTING. ...I HAVE ALSO VACUUMED IT.'); giveItem('autograph'); return; }
      yield S.say('grub', 'I HAVE CANCELLED MY REQUIREMENT TO VACUUM YOU. PERMANENTLY.');
    },
    *null() { yield S.say('null', '...'); },
    *rook() { yield S.say('rook', '...Not the campfire.'); },
    *brask() {
      const F = f();
      if (F.qualifier) yield S.say('brask', "Front row seats. Isla brought a banner. It says ASHFORD on it, but in a supportive font.");
      else yield S.say('brask', "Talk to the clerk when you're ready to lose properly, Brindle.");
    },
    *isla() {
      const F = f();
      if (F.qualifier) yield S.say('isla', 'If you lose to that robot I will never let Brask hear the end of it. Which means you will never hear the end of it.');
      else yield S.say('isla', 'We filed first. In triplicate. With a cover letter. You cannot out-paperwork Ashford.');
    },
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
    if (dummyHits === 6 && f().metOren && !f().notice) UI.toast('Oren is watching. Go talk to him.', '#ffd84a');
    if (dummyHits === 20) UI.toast('The dummy has seen enough.', '#c8c8f0');
  }
  function* board() {
    const F = f();
    if (!F.notice) { yield S.say('sign', 'BOUNTY BOARD. "LOST: one lemon. Answers to nothing. It is a lemon." -Rena'); return; }
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
  function onKill() {
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

  return {
    run, update, say, talk, enter, goal, sideQuests, dummy, board: () => run(board), onKill, brazierLit,
    rook: () => rook(), reiMeets: () => reiMeets(), rivals1: () => rivals1(), summit: () => summit(), finalBoss: () => finalBoss(),
    vending, rest: (t) => run(function* () { yield* rest(t); }), heal, joinHero,
  };
})();
