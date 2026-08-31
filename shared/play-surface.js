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
}());
