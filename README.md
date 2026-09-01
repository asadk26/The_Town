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

Finish the ladder and **Endless** opens: the whole route set on one road, four
drops at a time, no reverse. A bay you drive past is gone, three gone ends the
shift, and the truck picks up speed with every drop while the brake stays
exactly as strong as it was.

Endless does not cut between places. The next round's shape is laid onto the
end of the road already there, from wherever the last one finished and
pointing the same way, so the country changes around a truck that never stops
driving — the ground cross-fades across the border and the new drops start
well past it. With no reverse, a truck nosed into a parked car would have no
way out, so after half a second of going nowhere against something it shunts
itself back a little: enough to free a wedge, far too little to recover a bay.

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
shared/
  play-surface.css             the gameplay surface: no selecting, no callouts
  play-surface.js              the two events CSS cannot cover
  test/play-surface.mjs        checks it holds, on every game
.github/workflows/pages.yml    publishes the whole repo on every push to main
```

## The play surface

A game is something you tap, hold and drag at speed. A web page is something
you select, magnify and drag pictures out of. Left alone, a browser gives you
the second: repeated tapping turns the HUD blue, a long press on a control
offers to copy it, and a drag on the road highlights the score.

`shared/play-surface.css` and `shared/play-surface.js` settle that once for
the whole collection, over the part of the page you are actually playing and
nowhere else. A new game opts in with two lines in the head and three classes:

```html
<link rel="stylesheet" href="../shared/play-surface.css">
<script src="../shared/play-surface.js"></script>
```

| class | put it on | what it does |
|---|---|---|
| `play-surface` | the gameplay area — the cabinet, not `<body>` | nothing inside selects, highlights, shows the iOS long-press callout or drags out as artwork; taps stop waiting to see if they are double-taps, and a fast double tap does not zoom the page; the game keeps clear of the notch, the Dynamic Island and the home bar |
| `play-drag` | anything the game reads gestures on itself — a canvas, a joystick, a hold-to-steer pad | the browser stops scrolling and zooming with the gesture and hands it over |
| `play-inset` | a card or overlay fixed to the viewport, which misses the surface's own padding | takes the safe-area insets itself, never going below its own `--play-pad` |
| `play-text` | the rare run of text meant to be read and copied | behaves like the web again |

Two notes on the zoom. `touch-action` does not inherit, so it goes on every
element inside the surface and not just the surface itself — the browser reads
it from whatever is actually under the thumb. And a second tap in quick
succession on the scenery has its default suppressed, while controls keep both
of their taps: cancelling a tap cancels its click, and tapping the same button
twice quickly is a move in these games. Pinch zoom is deliberately untouched —
it is how anyone gets back out of a zoom, or makes the game bigger on purpose.

Text fields keep working inside a surface, buttons still click and still take
focus, keyboard controls are untouched, and anything outside a `play-surface`
— this page, the launcher, prose — is deliberately left alone.

## Tests

Quiet Stacks and Mail Run each have a suite that drives the real page in a headless browser —
the shift and its objectives, wrong-shelf handling, the patron loop, saved
bests, and, at three portrait and four landscape sizes, that nothing scrolls
or clips, that shelved titles are never cut off, and that type both clears a
readable floor *and* actually grows with the screen.

`shared/test/play-surface.mjs` covers all three games at once, since the rules
are shared: it drags across each one mid-round and checks that nothing
highlights, that a burst of fast tapping leaves no selection behind, that every
element inside a surface refuses double-tap zoom while controls keep both taps,
that the escape hatches and text fields still work, and that ordinary page text
outside the game still selects normally.

It also checks that everything fits the screen it is played on. A phone is not
as tall as it says it is — Safari's bars take a third of a landscape screen, so
a 852x393 handset plays in about 852x320 — and a card that overflows there
hides its own Start button behind a scroll nobody expects in a game. Every card
each game can show is measured at five real sizes, down to 667x280 in landscape
and 360x520 in portrait. And because the surface reads its safe-area insets
through custom properties, the suite can pose an iPhone's sensor housing
without an iPhone: it stands up a 59px island and a 34px home bar and checks
that no part of any game, or any card, ends up underneath.

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
node shared/test/play-surface.mjs
```

It uses Playwright's own Chromium by default; set `CHROME=/path/to/chrome`
to point it at a browser you already have.
