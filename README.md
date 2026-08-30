# Quiet Stacks

A cozy librarian game for one short shift. Returns pile into a cart and
patrons queue at the desk; both are answered the same way — by tapping a
shelf — so you can only ever attend to one of them at a time.

Plain HTML, CSS and JavaScript. No frameworks, no build step, no backend.

- **[Play (portrait)](https://asadk26.github.io/quiet-stacks/)** — V0, built for holding a phone upright.
- **[Play (landscape)](https://asadk26.github.io/quiet-stacks/landscape/)** — the same game with every shelf, the cart and the queue on one screen.

Both builds share `game.js` and `style.css`; the landscape build adds only
`landscape/layout.css` on top, so the two differ in layout and nothing else.

```
index.html          portrait markup
style.css           the whole visual identity
game.js             data, state, logic, rendering — shared by both builds
landscape/
  index.html        the same markup, plus a rotate card
  layout.css        layout overrides only
```

Shift length (2, 4 or 6 minutes) is chosen on the title card and the
objectives scale with it. The catalog mixes 30 real published books with 30
invented for the game; the invented titles are the deliberately ambiguous
ones, so the description is sometimes the only tell.
