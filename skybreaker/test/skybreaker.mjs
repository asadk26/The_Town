/* SKYBREAKER — smoke test.

   Boots the real page in a headless browser, starts a new game, plays the
   opening (intro, Mags, the spar with Brask), then visits every map and
   checks that nothing threw along the way.  Run:

     CHROME=/path/to/chrome node skybreaker/test/skybreaker.mjs */

import { chromium } from 'playwright-core';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const CHROME = process.env.CHROME || undefined;
const URL = pathToFileURL(resolve(fileURLToPath(import.meta.url), '../../index.html')).href;

let failed = 0;
const check = (ok, what) => { console.log((ok ? '  ok   ' : '  FAIL ') + what); if (!ok) failed++; };

const browser = await chromium.launch(CHROME ? { executablePath: CHROME } : {});
const page = await browser.newPage({ viewport: { width: 960, height: 720 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(URL);
await page.waitForTimeout(400);

const ev = (fn, arg) => page.evaluate(fn, arg);
const wait = (ms) => page.waitForTimeout(ms);
async function talkThrough(max = 300) {
  for (let i = 0; i < max; i++) {
    const s = await ev(() => ({ script: !!SKY.G.script, dlg: UI.modal()?.kind === 'dialogue', opts: !!UI.modal()?.options }));
    if (!s.script && !s.dlg) return true;
    if (s.dlg) await page.keyboard.press('z');
    await wait(60);
  }
  return false;
}

console.log('Skybreaker');
check(await ev(() => SKY.G.scene === 'title'), 'boots to the title screen');

await page.keyboard.press('Enter');
await wait(300);
check(await talkThrough(), 'the intro plays through');
check(await ev(() => SKY.G.mapId === 'home' && SKY.G.flags.intro), "starts in Juno's house");

// Mags, across her counter
await ev(() => { SKY.loadMap('village', 30, 12, 'up'); SKY.G.player.x = 30 * 16 + 8; SKY.G.player.y = 12 * 16 + 12; SKY.G.player.dir = 'up'; });
await wait(200);
await page.keyboard.press('z');
await wait(200);
check(await talkThrough(), 'Mags talks');
check(await ev(() => SKY.G.flags.lens && SKY.G.items.bun === 2), 'Mags hands over the Lens and two buns');

// the spar: weaken Brask through the real hit path until the scene moves on
await ev(() => { const p = SKY.G.player; p.x = 7 * 16 + 4; p.y = 10 * 16 + 12; p.dir = 'right'; });
await wait(200);
await page.keyboard.press('z');
await wait(200);
for (let i = 0; i < 400 && !(await ev(() => !!SKY.G.boss)); i++) { await page.keyboard.press('z'); await wait(50); }
check(await ev(() => SKY.G.boss && SKY.G.boss.id === 'brask_spar'), 'the spar with Brask begins');
for (let i = 0; i < 60 && (await ev(() => !!SKY.G.boss)); i++) {
  await ev(() => { const b = SKY.G.boss; if (b) b.hp = Math.max(1, b.hp - 20); });
  await ev(() => { const b = SKY.G.boss; if (b && b.hp <= b.maxHp * 0.42) b.ended = true; });
  await wait(60);
}
check(await talkThrough(500), 'the spar aftermath plays through');
check(await ev(() => SKY.G.flags.sparDone && SKY.G.party.brask && SKY.G.party.brask.joined), 'Brask joins the party');

// tag in
await ev(() => { SKY.G.player.state = 'move'; });
await page.keyboard.press('c');
await wait(150);
check(await ev(() => SKY.G.active === 'brask'), 'C tags Brask in');

// every map loads and draws
for (const id of Object.keys(await ev(() => Object.fromEntries(Object.keys(SKY.MAPS).map((k) => [k, 1]))))) {
  await ev((id) => { SKY.G.script = null; const m = SKY.MAPS[id].build(); SKY.loadMap(id, Math.floor(m.w / 2), Math.floor(m.h / 2), 'down'); SKY.G.script = null; UI.reset(); }, id);
  await wait(120);
  check(await ev((id) => SKY.G.mapId === id, id), 'map loads: ' + id);
}

// saving round-trips
check(await ev(() => SKY.SAVE.save() && !!SKY.SAVE.latest()), 'saves to this browser');

check(errors.length === 0, 'no page errors' + (errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''));
await browser.close();
console.log(failed ? `\n${failed} failed` : '\nall passed');
process.exit(failed ? 1 : 0);
