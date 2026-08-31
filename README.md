# The Town

A small collection of browser games. One town, a few places in it, and
something to do in each one. No shared save, no map, no meta-game — the
collection is just a shelf the games sit on.

**[Play → asadk26.github.io/The_Town](https://asadk26.github.io/The_Town/)**

| | | |
|---|---|---|
| **Quiet Stacks** | The library | [landscape](https://asadk26.github.io/The_Town/quiet-stacks/landscape/) · [portrait](https://asadk26.github.io/The_Town/quiet-stacks/) |
| **Order Up** | The lunch counter | [landscape](https://asadk26.github.io/The_Town/order-up/) |

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
.github/workflows/pages.yml    publishes the whole repo on every push to main
```

## Tests

Quiet Stacks has a suite that drives the real page in a headless browser —
the shift and its objectives, wrong-shelf handling, the patron loop, saved
bests, and, at three portrait and four landscape sizes, that nothing scrolls
or clips, that shelved titles are never cut off, and that type both clears a
readable floor *and* actually grows with the screen.

```sh
npm i playwright-core            # or use an existing install
node quiet-stacks/test/quietstacks.mjs
```

It uses Playwright's own Chromium by default; set `CHROME=/path/to/chrome`
to point it at a browser you already have.
