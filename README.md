# The Town

A small collection of browser games. One town, a few places in it, and
something to do in each one. No shared save, no map, no meta-game — the
collection is just a shelf the games sit on.

**[Play → asadk26.github.io/The_Town](https://asadk26.github.io/The_Town/)**

| | | |
|---|---|---|
| **Quiet Stacks** | The library | [landscape](https://asadk26.github.io/The_Town/quiet-stacks/landscape/) · [portrait](https://asadk26.github.io/The_Town/quiet-stacks/) |
| **Order Up** | The lunch counter | [landscape](https://asadk26.github.io/The_Town/order-up/) |
| **Mail Run** | The postal round | [landscape](https://asadk26.github.io/The_Town/mail-run/) |

Everything here is plain HTML, CSS and JavaScript. No frameworks, no build
step, no backend, no dependencies. Open any `index.html` and it runs.

## Quiet Stacks

One short shift on the desk. Returns pile into a cart and patrons queue up,
and both are answered the same way — by tapping a shelf — so you can only
ever attend to one of them at a time. A wrong shelf costs the attempt and
the streak but never gives the answer away; the book stays in your hands.

Two builds share `game.js` and `style.css`. The landscape build adds only
`landscape/layout.css` on top, so the two differ in layout and nothing else.

## Order Up

A customer orders, the counter slides away, and you rebuild the ticket at
the pass from memory. Orders hold at one size for five tickets and then grow
by an item, up to nine. Send a wrong ticket and you walk back to ask — the
customer repeats the order, and it costs you a strike either way.

## Mail Run

Five kerbside bays on one of five rounds. Drive up, pull in, and hold the
truck still for a moment to post the mail — centred and square at a crawl is
a Perfect. Nothing here can be failed: overshoot and the brake becomes
reverse, grass slows you rather than stopping you, and sloppy driving costs
time and rating instead of a life.

Steering is one horizontal stick: where your thumb sits is how hard the
truck turns. Handling is arcade but behaves like a vehicle — authority comes
from actually moving, so it will not pivot on the spot, and the nose swings
the other way in reverse. Every constant is in `CONFIG`.

Each round is a place, not just a shape: the suburbs, country fields, a
downtown of storefronts and parked cars, a red colony road, and black rock
lit from underneath. The delivery bay keeps its amber-to-green everywhere and
every theme's road is held to a contrast ratio against its own ground, so the
things you steer by never get subtle.

Finish the ladder and **Endless** opens: the whole route set, four drops at a
time, no reverse. A bay you drive past is gone, three gone ends the shift,
and the truck picks up speed with every drop while the brake stays exactly as
strong as it was.

A round is authored as a start pose and a list of pieces — a straight, or an
arc with a radius — which expand into the road, so a new route is a dozen
lines and is smooth by construction. The bays are dealt fresh each run from
every valid kerb on the route, spaced along it and weighted so the demanding
ones fall late, which means the same round is worth driving twice. An A
opens the next round; once two are open, Random Run deals one of them.

## Layout

```
index.html                     the door onto the collection
quiet-stacks/
  index.html                   portrait markup
  style.css                    the whole visual identity, and the type scale
  game.js                      data, state, logic, rendering — shared by both builds
  landscape/
    index.html                 the same markup, plus a rotate card
    layout.css                 the landscape layout, on top of style.css
  test/quietstacks.mjs         regression suite (see below)
order-up/
  index.html  style.css  game.js
mail-run/
  index.html  style.css  game.js
  test/mailrun.mjs             regression suite (see below)
.github/workflows/pages.yml    publishes the whole repo on every push to main
```

## Tests

Quiet Stacks and Mail Run each have a suite that drives the real page in a headless browser —
the shift and its objectives, wrong-shelf handling, the patron loop, saved
bests, and, at three portrait and four landscape sizes, that nothing scrolls
or clips, that shelved titles are never cut off, and that type both clears a
readable floor *and* actually grows with the screen.

Mail Run's is driven by a scripted pure-pursuit driver that runs the whole
route, which is how the handling and the route length were tuned: it checks
that a competent round lands in the 45-90s window, that a clean line earns
Perfects and a sloppy one does not, and that the truck behaves like a
vehicle — no pivoting on the spot, and the nose swinging the other way in
reverse.

```sh
npm i playwright-core            # or use an existing install
node quiet-stacks/test/quietstacks.mjs
node mail-run/test/mailrun.mjs
```

It uses Playwright's own Chromium by default; set `CHROME=/path/to/chrome`
to point it at a browser you already have.
