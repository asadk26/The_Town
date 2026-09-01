/* THE TOWN — the play surface, the part CSS cannot do.

   Browsers still fire a selection or a drag from a press inside the game even
   where user-select says no: Firefox ignores -webkit-user-drag, and a drag
   that starts on a canvas can run away with the text beside it.  Two guards,
   scoped to .play-surface, and both step aside for anything meant to be read,
   copied or typed into. */
(function () {
  var FREE = 'input, textarea, select, [contenteditable="true"], .play-text';

  function inPlay(node) {
    var el = node && node.nodeType === 1 ? node : node && node.parentElement;
    if (!el || !el.closest) return false;
    return !!el.closest('.play-surface') && !el.closest(FREE);
  }

  function block(e) { if (inPlay(e.target)) e.preventDefault(); }

  document.addEventListener('selectstart', block);
  document.addEventListener('dragstart', block);

  /* Double-tap zoom.  touch-action: manipulation is meant to settle this and
     mostly does, but a fast double tap on the scenery can still zoom the page
     in — and once a game has no scrollbars and no visible text to tap, zooming
     back out is a fight.  So a second tap in quick succession on a part of the
     game that is not a control has its default suppressed.

     Controls are deliberately left alone: preventing a tap's default also
     cancels its click, and tapping the same button twice quickly is a move in
     these games (two burgers, please).  Those already carry touch-action, so
     the browser will not zoom on them anyway. */
  var CONTROLS = 'button, a, input, select, textarea, label, summary, ' +
                 '[role="button"], [role="slider"], [tabindex]';
  var lastTap = 0;

  document.addEventListener('touchend', function (e) {
    var el = e.target && e.target.nodeType === 1 ? e.target : null;
    if (!el || !inPlay(el)) { lastTap = 0; return; }
    var now = Date.now();
    if (now - lastTap < 350 && e.cancelable && !el.closest(CONTROLS)) e.preventDefault();
    lastTap = now;
  }, { passive: false });

  // and the mouse-side equivalent, which some browsers still zoom on
  document.addEventListener('dblclick', block);
}());
