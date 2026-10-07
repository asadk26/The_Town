/* SKYBREAKER — thumbs.

   On a touch screen the cabinet grows a floating stick on the left half and
   a cluster of buttons on the right.  They feed the same input state as the
   keyboard, so nothing else in the game knows the difference.  Portrait gets
   a card asking for the long edge. */
'use strict';

const TOUCH = (() => {
  const on = matchMedia('(pointer: coarse)').matches || /[?&]touch\b/.test(location.search);
  if (!on) return { on: false, update() {} };
  const cab = document.getElementById('cabinet');
  document.body.classList.add('touch');

  const el = (tag, cls, parent = cab, html = '') => { const e = document.createElement(tag); e.className = cls; e.innerHTML = html; parent.appendChild(e); return e; };
  const pad = el('div', 'tpad play-drag');
  const base = el('div', 'tstick', pad), knob = el('div', 'tknob', base);
  const right = el('div', 'tbuttons');
  const BTN = [
    ['A', 'tbtn ta', 'A'], ['B', 'tbtn tb', 'KI'], ['L', 'tbtn tl', 'SP'], ['R', 'tbtn tr', 'GD'], ['SWAP', 'tbtn tc', 'TAG'],
  ];
  const btns = {};
  for (const [k, cls, label] of BTN) btns[k] = el('button', cls, right, '<span>' + label + '</span>');
  const start = el('button', 'tbtn tstart', cab, '<span>MENU</span>');
  btns.START = start;
  const turn = el('div', 'tturn play-inset', cab, '<i></i><h2>Turn your phone</h2><p>Skybreaker plays on the long edge.</p>');

  // buttons: held while a finger is on them
  for (const [k, b] of Object.entries(btns)) {
    const press = (e) => { e.preventDefault(); try { b.setPointerCapture(e.pointerId); } catch (_) { /* synthetic or stale pointer */ } b.classList.add('on'); I.down(k); };
    const release = (e) => { e.preventDefault(); b.classList.remove('on'); I.up(k); };
    b.addEventListener('pointerdown', press);
    b.addEventListener('pointerup', release);
    b.addEventListener('pointercancel', release);
    b.addEventListener('lostpointercapture', release);
    b.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  // the stick floats to wherever the thumb lands on the left half
  let sid = null, ox = 0, oy = 0;
  const DIRS = ['left', 'right', 'up', 'down'];
  const setDirs = (want) => { for (const d of DIRS) { if (want[d] && !I.held[d]) I.down(d); else if (!want[d] && I.held[d]) I.up(d); } };
  pad.addEventListener('pointerdown', (e) => {
    if (sid !== null) return;
    e.preventDefault();
    sid = e.pointerId; try { pad.setPointerCapture(e.pointerId); } catch (_) { /* synthetic or stale pointer */ }
    const r = pad.getBoundingClientRect();
    ox = e.clientX; oy = e.clientY;
    base.style.left = (ox - r.left) + 'px'; base.style.top = (oy - r.top) + 'px';
    base.classList.add('on'); knob.style.transform = 'translate(-50%,-50%)';
    AUDIO.init();
  });
  pad.addEventListener('pointermove', (e) => {
    if (e.pointerId !== sid) return;
    const R = base.offsetWidth / 2;
    let dx = e.clientX - ox, dy = e.clientY - oy;
    const d = Math.hypot(dx, dy);
    if (d > R) { dx = dx / d * R; dy = dy / d * R; }
    knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
    const dead = R * 0.28;
    const a = Math.atan2(dy, dx);
    const want = {};
    if (d > dead) {
      // eight ways: each axis counts once the stick is more than ~22° toward it
      if (Math.cos(a) > 0.38) want.right = true; else if (Math.cos(a) < -0.38) want.left = true;
      if (Math.sin(a) > 0.38) want.down = true; else if (Math.sin(a) < -0.38) want.up = true;
    }
    setDirs(want);
  });
  const end = (e) => { if (e.pointerId !== sid) return; sid = null; base.classList.remove('on'); setDirs({}); };
  pad.addEventListener('pointerup', end);
  pad.addEventListener('pointercancel', end);

  // while a box is open, the cluster steps back so the text stays readable
  function update() {
    const busy = !!(typeof UI !== 'undefined' && UI.modal());
    right.classList.toggle('quiet', busy);
    const portrait = innerHeight > innerWidth;
    turn.classList.toggle('show', portrait);
  }
  return { on: true, update };
})();
