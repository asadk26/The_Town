/* SKYBREAKER — people, at diorama scale.

   Every person is a 40x52 sprite built from a skeleton: shoulders, elbows,
   hands, hips and feet move per pose and facing, limbs are drawn with a
   lit-from-the-left shading ramp, clothes are layered on by outfit type, and
   the whole figure gets a colour-matched outline.  The five leads — Juno,
   Rei, Oren, Brask and Isla — wear hand-drawn heads in all three facings;
   everyone else gets a procedural head from a handful of hair styles. */
'use strict';

const PEOPLE = (() => {
  const FW = 40, FH = 52, CX = 19.5, GROUND = 51;
  const INK = '#1a1226';
  const { Buf, shade, mix } = GFX;
  const ramp = (c) => ({ hi: shade(c, 0.2), b: c, m: shade(c, -0.12), s: shade(c, -0.3) });

  /* ── hand-drawn heads ─────────────────────────────────── */
  /* rows of palette letters; `cx` is the column of the face's centre line,
     `chin` the row that sits on the neck.  Side views face left. */
  const HEADS = {
    juno: {
      pal: { o: INK, H: '#c8562c', h: '#923a1c', d: '#5e2412', g: '#f08a54', W: '#f4f0e6', V: '#c4bcb4', S: '#f4cba6', s: '#d99e7a', t: '#b47a5c', e: '#1e1630', w: '#ffffff', m: '#c0646a' },
      front: { cx: 8.5, chin: 13, rows: [
        '....oooooooooo....',
        '..ooHHHHHHHHHHoo..',
        '.oHHgHHHHHHHHgHHo.',
        '.oWWWWWWWWWWWWWWo.',
        'oHVWWWWWWWWWWWWVHo',
        'oHHhHHhHHHHhHHhHHo',
        'ohHHSHHSHHSHHSHHho',
        'ohhSSSSSSSSSSSShho',
        'ohSSSSSSSSSSSSSSho',
        'ohSSddSSSSSSddSSho',
        'ohSSewSSSSSSweSSho',
        'ohhSSSSSSSSSSSShho',
        '.oHsSSSSttSSSSsHo.',
        '..ooosSSmmSSsooo..'] },
      side: { cx: 8, chin: 13, rows: [
        '.....ooooooo.....',
        '...ooHHgHHHHoo...',
        '..oHHgHHHHHHHHo..',
        '.oWWWWWWWWWWWWWo.',
        '.oVWWWWWWWWWWWWVo',
        'oHHhHHhHHHHHhHHo.',
        'oSHHSHHhHHhHHHHho',
        'oSSSSSShHHhHHhHho',
        '.oSddSSShHHhHHho.',
        '.oSewSSSsHHHhho..',
        'oSSSSSSSshHHho...',
        '.osSSSSSSohho....',
        '..omSSSSso.o.....',
        '...oossoo........'] },
      back: { cx: 8.5, chin: 13, rows: [
        '....oooooooooo....',
        '..ooHHgHHHHHHHoo..',
        '.oHHHHHHHHHHHgHHo.',
        '.oWWWWWWWWWWWWWWo.',
        'oHWWWWWWWWWWWWWWHo',
        'oHHhHHHhHHHhHHHVVo',
        'ohHHhHHHhHHHhHhVWo',
        'ohhHHhHHHhHHhHhoVo',
        'ohhhHHhHHHhHHhho..',
        'ohhhhHhhHhhHhhhho.',
        '.ohhhhhhhhhhhhho..',
        '..ohhhhhhhhhhho...',
        '...oosshhhhsoo....',
        '.....oossssoo.....'] },
    },
    rei: {
      pal: { o: INK, H: '#ced2de', h: '#9ca0b8', d: '#5e6280', g: '#f4f6fc', S: '#f2cfae', s: '#d6a482', t: '#ad7a5c', e: '#1e1630', w: '#ffffff', m: '#b0705e' },
      front: { cx: 8.5, chin: 13, rows: [
        '....oooooooooo....',
        '..ooHHHHHHHHHHoo..',
        '.oHHggHHHHHHggHHo.',
        '.oHgHHHHHHHHHHgHo.',
        'oHHHHHhHHHHhHHHHHo',
        'oHHHhHhHHHHhSHHhHo',
        'oHHHHhSSSSSSSSSho.',
        'oHHHhhSSSSSSSSSho.',
        '.oHHhddSSSSSddSo..',
        '.oHhhSeSSSSSweSo..',
        '.osHSSSSSSSSSSso..',
        '..osSSSSttSSSso...',
        '...osSSSmmSSso....',
        '....oosSSSSoo.....'] },
      side: { cx: 8, chin: 13, rows: [
        '.....ooooooo.....',
        '...ooHHgHHHHoo...',
        '..oHgHHHHHHHHHo..',
        '.oHHHHHHHhHHHHHo.',
        'oHHHHHhHHHHhHHHHo',
        'oHHhHHSHhHHHhHHHo',
        '.oHHSSSShHHhHHHo.',
        '.oHSSSSShHHhHHo..',
        '.oSddSSSShHHho...',
        '.oSewSSSshHho....',
        'oSSSSSSSsoho.....',
        '.osSSSSSSo.......',
        '..omSSSSo........',
        '...oossoo........'] },
      back: { cx: 8.5, chin: 13, rows: [
        '....oooooooooo....',
        '..ooHHgHHHHHHHoo..',
        '.oHHHHHHHHHHHgHHo.',
        '.oHgHHhHHHHhHHHHo.',
        'oHHHhHHHHhHHHhHHHo',
        'oHHhHHHhHHHHhHHHHo',
        'ohHHHhHHHhHHHhHHho',
        'ohhHHHhHHHhHHhHhho',
        '.ohhHhhHhhHHhhhho.',
        '.ohhhhhhhhhhhhhho.',
        '..ohhhhhhhhhhhho..',
        '...oshhhhhhhhso...',
        '....oosssssoo.....',
        '......oooo........'] },
    },
    isla: {
      pal: { o: INK, H: '#262432', h: '#3e3c54', d: '#14121c', X: '#ecebf4', S: '#f6d6bc', s: '#dcaa8c', t: '#b6826a', e: '#1e1630', w: '#ffffff', m: '#c0646a', Y: '#f2c94c' },
      front: { cx: 9.5, chin: 13, rows: [
        '.....oooooooooo.....',
        '...ooHXHHHHHHHHoo...',
        '..oHHXhHHHHHHhHHHo..',
        '.oHHXHHHHHHHHHHhHHo.',
        '.oHHXHHHHHHHHHHHHHo.',
        '.oHXhHHHhHHhHHHhHHo.',
        '.oHXhSSSSSSSSSShhHo.',
        '.oXhSSSSSSSSSSSShHo.',
        '.oHhSddSSSSSSddShHo.',
        '.oHhSewSSSSSSweShHo.',
        '.oHhSSSSSSSSSSSShHo.',
        '.oHhsSSSSttSSSSshHY.',
        '.oHHosSSSmmSSSsoHHY.',
        '.oHHHoosSSSSsooHHHo.',
        'oHHHhho......ohhHHHo',
        'oHHHho........ohHHHo',
        'oHHoo..........ooHHo'] },
      side: { cx: 8, chin: 13, rows: [
        '.....ooooooo......',
        '...ooHHHHHHHoo....',
        '..oHHXHHHHHHHHo...',
        '.oHHXHHHHHHHhHHo..',
        'oHHXHHHHhHHHHHHHo.',
        'oHXhHHSHHHhHHHhHo.',
        'oXHSSSSShHHHhHHHHo',
        '.oSSSSSSShHHHhHHHo',
        '.oSddSSSShHHhHHHHo',
        '.oSewSSSshHHHhHHHo',
        'oSSSSSSSsoHHhHHHHo',
        '.osSSSSSSoHHHhHHHo',
        '..omSSSSsoHhHHhHHo',
        '...oossooHHHhHHHHo',
        '........oHHhHHHHHo',
        '........ohHHhHHHo.',
        '.........ooooooo..'] },
      back: { cx: 9.5, chin: 13, rows: [
        '.....oooooooooo.....',
        '...ooHHHHHHHHHHoo...',
        '..oHHHHHHHHHHHHHHo..',
        '.oHHhHHHHHHHHHHhHHo.',
        '.oHHHHhHHHHHHhHHHHo.',
        '.oHhHHHHhHHhHHHHhHo.',
        '.oHHhHHHHHHHHHHhHHo.',
        '.oHhHHhHHHHHHhHHhHo.',
        '.oHHHHHhHHHHhHHHHHo.',
        '.oHhHHHHHHHHHHHHhHo.',
        '.oHHhHHHhHHhHHHhHHo.',
        '.oHhHHHHHHHHHHHHhHo.',
        '.oHHHhHHHHHHHHhHHHo.',
        '.oHhHHHHhHHhHHHHhHo.',
        'oHHHhHHHHHHHHHHhHHHo',
        'oHHhHHHhHHHHhHHHhHHo',
        '.oHHHhHHHHHHHHhHHHo.',
        '..ooHHHhHHHHhHHHoo..',
        '....ooooooooooooo...'] },
    },
    brask: {
      pal: { o: INK, H: '#eeeef4', g: '#ffffff', h: '#c4c4d2', d: '#5a3624', S: '#9a6040', s: '#7a4a30', t: '#5a3220', e: '#1e1630', w: '#ffffff', m: '#5a2a24' },
      front: { cx: 7.5, chin: 14, rows: [
        '......oooo......',
        '.....oHHHHo.....',
        '.....ogHHgo.....',
        '.....oHHHHo.....',
        '..oooHHHHHHooo..',
        '.odddoHHHHodddo.',
        '.odSSSSSSSSSSdo.',
        '.oSSSSSSSSSSSSo.',
        '.oSddSSSSSSddSo.',
        '.oSewSSSSSSweSo.',
        'osSSSSSSSSSSSSso',
        '.oSSSSSttSSSSSo.',
        '.osSSSSmmSSSSso.',
        '..osSSSSSSSSso..',
        '...oosSSSSsoo...'] },
      side: { cx: 8, chin: 14, rows: [
        '........ooooo...',
        '.......oHHHHHo..',
        '......oHgHHHHHo.',
        '.....oHHHHHHHHo.',
        '...oooHHHHHHHo..',
        '..oddddoooooddo.',
        '.oSSSSSdddddddo.',
        '.oSSSSSSSddddo..',
        '.oSddSSSSsddo...',
        '.oSewSSSSssdo...',
        'oSSSSSSSSsso....',
        '.oSSSSSSSso.....',
        '..omSSSSSo......',
        '...osSSSo.......',
        '....oooo........'] },
      back: { cx: 7.5, chin: 14, rows: [
        '......oooo......',
        '.....oHHHHo.....',
        '.....oHgHHo.....',
        '.....oHHHHo.....',
        '..oooHHHHHHooo..',
        '.odddoHHHHodddo.',
        '.oddddHHHHddddo.',
        '.odddddHHddddo..',
        '.oddddddddddddo.',
        '.odddddddddddddo',
        'osdddddddddddso.',
        '.osddddddddddso.',
        '..osSSSSSSSSso..',
        '...osSSSSSSso...',
        '....oosSSsoo....'] },
    },
    oren: {
      pal: { o: INK, H: '#2e2220', h: '#4a3830', S: '#e0ae86', s: '#bd8660', t: '#94603e', L: '#f6d2b0', e: '#1e1630', w: '#ffffff', m: '#7a3a32' },
      front: { cx: 9.5, chin: 10, rows: [
        '......oooooooo......',
        '.....oSLSSSSLSo.....',
        '....oSLSSSSSSLSo....',
        '....oSSSSSSSSSSo....',
        '....oHHHSSSSHHHo....',
        '....oSewSSSSweSo....',
        '...osSSSSttSSSSso...',
        '....oHSSSSSSSSHo....',
        '....oHhHmmmmHhHo....',
        '....oHHHHHHHHHHo....',
        '.....oHHHHHHHHo.....'] },
      side: { cx: 8, chin: 10, rows: [
        '....ooooooo.....',
        '...oSLSSSSSoo...',
        '..oSLSSSSSSSSo..',
        '..oSSSSSSSSSSo..',
        '..oHHSSSSSsSSo..',
        '.oSewSSSSssSo...',
        'oSSSSSSSSsSso...',
        '.oHSSSSSHHso....',
        '.oHHmHHHHHo.....',
        '..oHHHHHHo......',
        '...oHHHHo.......'] },
      back: { cx: 9.5, chin: 10, rows: [
        '......oooooooo......',
        '.....oSSSSLSSSo.....',
        '....oSSSSLSSSSSo....',
        '....oSSSSSSSSSSo....',
        '....oSSSSSSSSSSo....',
        '...osSSSSSSSSSSso...',
        '...osSSSSSSSSSSso...',
        '....osSSSSSSSSso....',
        '....ossSSSSSSsso....',
        '.....osssssssso.....',
        '......oooooooo......'] },
    },
  };

  /* ── procedural heads for everyone else ───────────────── */
  function procHead(s, dir) {
    const b = new Buf(18, 18);
    const S = s.skin, Ss = shade(S, -0.18), Sl = shade(S, 0.18);
    const H = s.hair || '#3a2a20', Hs = shade(H, -0.3), Hl = shade(H, 0.3);
    const ox = 4, oy = 4;           // face box: 10 wide, 11 tall
    const rowsW = [6, 8, 10, 10, 10, 10, 10, 10, 8, 8, 6];
    const side = dir === 'left';
    rowsW.forEach((w, j) => {
      const x0 = ox + (10 - w) / 2 + (side ? -1 : 0);
      for (let i = 0; i < w; i++) b.set(x0 + i, oy + j, i >= w - 2 ? Ss : (i === 0 && !side ? Sl : S));
    });
    if (side) { b.set(ox - 2, oy + 6, S); b.set(ox - 2, oy + 7, Ss); b.set(ox + 6, oy + 5, Ss); b.set(ox + 6, oy + 6, Ss); }
    else if (dir === 'down') { b.set(ox - 1, oy + 5, S); b.set(ox - 1, oy + 6, Ss); b.set(ox + 10, oy + 5, Ss); b.set(ox + 10, oy + 6, Ss); }
    const ey = oy + 5;
    if (dir === 'down') {
      const ec = s.eyes || INK;
      for (const ex of [ox + 2, ox + 7]) { b.set(ex, ey, ec); b.set(ex, ey + 1, ec); b.set(ex + (ex < ox + 5 ? 1 : -1), ey, ec); }
      b.set(ox + 3, ey, s.glowEyes ? '#ffffff' : '#ffffff'); b.set(ox + 6, ey, '#ffffff');
      if (s.brows) { b.rect(ox + 2, ey - 2, 2, 1, s.brows); b.rect(ox + 6, ey - 2, 2, 1, s.brows); }
      b.set(ox + 5, oy + 7, Ss);
      b.rect(ox + 4, oy + 9, 2, 1, s.mouth || shade(S, -0.38));
      if (s.blush) { b.set(ox + 1, oy + 7, s.blush); b.set(ox + 8, oy + 7, s.blush); }
      if (s.beard) { b.rect(ox + 1, oy + 7, 8, 3, s.beard); b.rect(ox + 2, oy + 10, 6, 1, s.beard); b.rect(ox + 4, oy + 9, 2, 1, shade(s.beard, 0.3)); }
      if (s.glasses) { for (const ex of [ox + 1, ox + 6]) { b.rect(ex, ey - 1, 4, 1, s.glasses, true); b.rect(ex, ey + 2, 4, 1, s.glasses, true); b.set(ex, ey, s.glasses, true); b.set(ex, ey + 1, s.glasses, true); b.set(ex + 3, ey, s.glasses, true); b.set(ex + 3, ey + 1, s.glasses, true); } }
      if (s.monocle) { b.rect(ox + 6, ey - 1, 4, 1, s.monocle, true); b.rect(ox + 6, ey + 2, 4, 1, s.monocle, true); b.set(ox + 6, ey, s.monocle, true); b.set(ox + 9, ey, s.monocle, true); b.set(ox + 6, ey + 1, s.monocle, true); b.set(ox + 9, ey + 1, s.monocle, true); b.set(ox + 9, ey + 3, s.monocle); }
      if (s.patch) { b.rect(ox + 1, ey - 1, 4, 3, INK); b.rect(ox, ey - 2, 10, 1, INK); }
      if (s.mask) { b.rect(ox, ey - 1, 10, 3, s.mask); b.set(ox + 3, ey, '#ffffff'); b.set(ox + 6, ey, '#ffffff'); }
    } else if (side) {
      const ec = s.eyes || INK;
      b.set(ox + 1, ey, ec); b.set(ox + 1, ey + 1, ec); b.set(ox + 2, ey, '#ffffff');
      if (s.brows) b.rect(ox, ey - 2, 3, 1, s.brows);
      b.rect(ox, oy + 9, 2, 1, s.mouth || shade(S, -0.38));
      if (s.beard) { b.rect(ox - 1, oy + 7, 7, 3, s.beard); b.rect(ox, oy + 10, 5, 1, s.beard); }
      if (s.glasses) { b.rect(ox - 1, ey - 1, 4, 4, s.glasses, true); b.set(ox + 1, ey, ec); b.set(ox, ey, '#dfefff'); b.set(ox + 1, ey + 1, '#dfefff'); b.rect(ox + 3, ey, 4, 1, s.glasses, true); }
      if (s.monocle) { b.rect(ox - 1, ey - 1, 4, 4, s.monocle, true); b.set(ox + 1, ey, ec); b.set(ox, ey + 1, '#dfefff'); b.set(ox + 1, ey + 1, ec); }
      if (s.patch) b.rect(ox - 1, ey - 2, 9, 1, INK);
      if (s.mask) { b.rect(ox - 1, ey - 1, 5, 3, s.mask); b.set(ox + 1, ey, '#ffffff'); }
    }
    const st = s.hairStyle || 'short';
    const X = ox, Y = oy;
    const top = (x0, w, y0, h, c) => b.rect(x0, y0, w, h, c);
    if (st === 'short' || st === 'neat' || st === 'long') {
      if (dir === 'down') { top(X, 10, Y - 2, 1, H); top(X - 1, 12, Y - 1, 3, H); top(X + 1, 4, Y - 2, 1, Hl); b.rect(X - 1, Y + 2, 1, 3, H); b.rect(X + 10, Y + 2, 1, 3, Hs); if (st !== 'neat') { b.set(X + 3, Y + 2, H); b.set(X + 6, Y + 2, H); } }
      else if (dir === 'up') { top(X, 10, Y - 2, 1, H); top(X - 1, 12, Y - 1, 10, H); top(X + 7, 3, Y, 8, Hs); top(X + 1, 3, Y - 2, 1, Hl); }
      else { top(X, 9, Y - 2, 1, H); top(X - 1, 10, Y - 1, 3, H); top(X + 3, 6, Y + 2, 5, H); top(X + 8, 1, Y, 7, Hs); top(X + 1, 3, Y - 2, 1, Hl); }
      if (st === 'long') {
        if (dir === 'down') { top(X - 2, 2, Y + 1, 12, H); top(X + 10, 2, Y + 1, 12, Hs); }
        else if (dir === 'up') top(X - 2, 14, Y + 1, 12, H);
        else top(X + 4, 6, Y + 2, 11, H);
      }
    } else if (st === 'bun' || st === 'tallbun') {
      const tall = st === 'tallbun', o = side ? 1 : 0;
      if (tall) { top(X + 3 + o, 4, Y - 8, 6, H); top(X + 3 + o, 4, Y - 3, 1, s.accent || '#3a3a8c'); top(X + 6 + o, 1, Y - 7, 4, Hs); }
      else { b.disc(X + 5 + o, Y - 3, 2.6, H); b.set(X + 4 + o, Y - 4, Hl); }
      top(X - 1 + o, 12 - o, Y - 1, 3, H); top(X + 1, 4, Y - 1, 1, Hl);
      if (dir === 'down') { top(X - 1, 1, Y + 2, 3, Hs); top(X + 10, 1, Y + 2, 3, Hs); }
      else if (dir === 'up') top(X - 1, 12, Y + 2, 6, H);
      else top(X + 4, 6, Y + 2, 4, H);
    } else if (st === 'bandana' || st === 'cap') {
      const C = s.accent || (st === 'cap' ? '#3f6fd0' : '#c0392b'), D = shade(C, -0.3);
      if (dir === 'down') { top(X - 1, 12, Y - 2, 4, C); top(X - 1, 12, Y + 1, 1, D); if (st === 'cap') top(X - 2, 14, Y + 2, 1, D); b.set(X - 1, Y + 3, H); b.set(X + 10, Y + 3, H); }
      else if (dir === 'up') { top(X - 1, 12, Y - 2, 5, C); top(X - 1, 12, Y + 3, 4, H); if (st === 'bandana') top(X + 4, 2, Y + 3, 4, D); }
      else { top(X - 1, 11, Y - 2, 4, C); top(X + 4, 6, Y + 2, 4, H); if (st === 'cap') top(X - 4, 6, Y + 1, 1, D); else top(X + 9, 2, Y + 2, 4, D); }
    } else if (st === 'bald') {
      b.set(X + (side ? 3 : 2), Y + 1, shade(S, 0.45)); b.set(X + (side ? 4 : 3), Y, shade(S, 0.45));
      if (s.hair && dir !== 'down') top(X + 4, 6, Y + 4, 2, H);
      if (s.hair && dir === 'down') { b.rect(X - 1, Y + 3, 1, 2, H); b.rect(X + 10, Y + 3, 1, 2, H); }
    } else if (st === 'hat') {
      const C = s.accent || '#5b2a86', D = shade(C, -0.3), o = side ? 1 : 0;
      top(X + 1 + o, 8, Y - 5, 5, C); top(X + 1 + o, 8, Y - 1, 1, '#f2c94c');
      top(X - 4 + o, 18 - o, Y, 1, D); top(X - 3 + o, 16 - o, Y + 1, 1, C);
      top(X + 8 + o, 1, Y - 8, 4, '#e05a8a'); b.set(X + 9 + o, Y - 9, '#e05a8a');
      if (dir === 'up') top(X - 1, 12, Y + 2, 6, H);
    } else if (st === 'crown') {
      const o = side ? 1 : 0;
      for (let i = 0; i < 10 - o; i += 2) top(X + i + o - 1, 2, Y - 4 + (i % 4 ? 1 : 0), 5, H);
      top(X - 1 + o, 12 - o, Y, 2, H); b.set(X + 2 + o, Y - 3, Hl);
      if (dir === 'up') top(X - 1, 12, Y + 2, 6, H);
    }
    return { buf: b, cx: 8.5 + (side ? -1 : 0), chin: oy + 10 };
  }

  /* ── outfits & builds ─────────────────────────────────── */
  const BUILDS = {
    slim:   { sh: 12, wa: 8, hip: 10, torso: 11, leg: 15, armW: 3, legW: 4, gap: 2, neck: 2 },
    lean:   { sh: 14, wa: 10, hip: 10, torso: 11, leg: 15, armW: 3, legW: 4, gap: 2, neck: 2 },
    broad:  { sh: 18, wa: 13, hip: 12, torso: 12, leg: 14, armW: 4, legW: 5, gap: 2, neck: 4 },
    giant:  { sh: 24, wa: 15, hip: 14, torso: 15, leg: 15, armW: 6, legW: 6, gap: 2, neck: 6 },
    normal: { sh: 12, wa: 10, hip: 10, torso: 10, leg: 13, armW: 3, legW: 4, gap: 2, neck: 2 },
    stout:  { sh: 14, wa: 14, hip: 13, torso: 10, leg: 12, armW: 4, legW: 4, gap: 2, neck: 3 },
    kid:    { sh: 9, wa: 8, hip: 8, torso: 7, leg: 8, armW: 2, legW: 3, gap: 1, neck: 2 },
    tall:   { sh: 12, wa: 8, hip: 10, torso: 12, leg: 17, armW: 3, legW: 4, gap: 2, neck: 2 },
  };

  const LOOKS = {
    juno:  { head: 'juno', build: 'slim', skin: '#f4cba6', top: { type: 'open', color: '#de4438', inner: '#2c2a40', sleeves: 'none', collar: '#ff7a66' }, belt: '#3a2a24', buckle: '#ffd84a', pants: '#3c3c5a', shoes: '#f2eee2', sole: '#8a7a7c', wraps: '#f4f0e6', ki: '#ff8a2a' },
    rei:   { head: 'rei', build: 'lean', skin: '#f2cfae', top: { type: 'collar', color: '#24232e', sleeves: 'none' }, sash: '#cc3240', pants: '#2e3444', shoes: '#3a2e2a', sole: '#1a1418', boots: true, wraps: '#e8e2d6' },
    oren:  { head: 'oren', build: 'giant', skin: '#e0ae86', top: { type: 'singlet', color: '#8e2c3e', sleeves: 'none' }, belt: '#d8b04a', pants: '#3a2e2e', shoes: '#2e2a30', sole: '#121016', tattoo: '#3a62b8' },
    brask: { head: 'brask', build: 'broad', skin: '#9a6040', top: { type: 'open', color: '#5a3a8c', inner: '#e8c050', sleeves: 'long', cuff: '#e8c050', tails: 8 }, belt: '#c8a040', pants: '#4a3828', shoes: '#2a2028', sole: '#140e14', boots: true },
    isla:  { head: 'isla', build: 'slim', skin: '#f6d6bc', top: { type: 'open', color: '#33508e', inner: '#1c1a24', sleeves: 'long', rolledR: true, cuff: '#223a6c', hem: 1, turtleneck: true }, belt: '#3a2a2a', buckle: '#f2c94c', pants: '#4a4a5c', shoes: '#2a2028', sole: '#140e14', boots: true, gloves: '#3c3244' },
    // townsfolk and friends
    mags:   { build: 'normal', skin: '#e8b890', hair: '#c8c4cc', hairStyle: 'bun', top: { type: 'apron', color: '#3a6a8a', apron: '#f4f0e6', sleeves: 'long' }, pants: '#3a3a4a', shoes: '#5a3a2a', blush: '#f0a090' },
    pell:   { build: 'kid', skin: '#f6dcc0', hair: '#6a4a3a', hairStyle: 'neat', glasses: '#e8e8f0', top: { type: 'suit', color: '#d8c8a0', inner: '#f4f0e6', tie: '#c0303a', sleeves: 'long' }, pants: '#8a7a5a', shoes: '#3a2a20' },
    sable:  { build: 'tall', skin: '#d8c8e8', hair: '#f4f4ff', hairStyle: 'tallbun', accent: '#2a2a6a', monocle: '#f2c94c', eyes: '#6a2a8a', top: { type: 'suit', color: '#2a2a5a', inner: '#f4f0e6', tie: '#c0303a', sleeves: 'long' }, pants: '#22224a', shoes: '#141428' },
    rook:   { build: 'broad', skin: '#c8906a', hair: '#3a2a20', hairStyle: 'bandana', accent: '#c0392b', patch: true, beard: '#3a2a20', top: { type: 'tee', color: '#7a6a5a', sleeves: 'short' }, belt: '#3a2a20', pants: '#5a4a3a', shoes: '#2a2020', boots: true },
    velvet: { build: 'slim', skin: '#f0d0c0', hair: '#2a1a3a', hairStyle: 'hat', accent: '#5b2a86', mask: '#1a1020', top: { type: 'coat', color: '#7a3aa0', sleeves: 'long', tails: 10, cape: '#3a1a5a' }, pants: '#2a1a3a', shoes: '#1a1020', boots: true },
    grunt:  { build: 'normal', skin: '#d8a07a', hair: '#4a3020', hairStyle: 'bandana', accent: '#8a5a2a', top: { type: 'tee', color: '#8a6a3a', sleeves: 'short' }, belt: '#3a2a1a', pants: '#5a4a3a', shoes: '#2a2020' },
    gunner: { build: 'normal', skin: '#c08060', hair: '#2a2020', hairStyle: 'cap', accent: '#5a6a3a', top: { type: 'tee', color: '#6a7a4a', sleeves: 'long' }, pants: '#4a4a3a', shoes: '#2a2020', gun: true },
    furnace:{ build: 'stout', skin: '#c89070', hair: '#e8e0d8', hairStyle: 'bald', beard: '#e8e0d8', top: { type: 'robe', color: '#8a3a2a', sleeves: 'long' }, pants: '#5a2a1a', shoes: '#2a1a14' },
    tam:    { build: 'kid', skin: '#f0c8a0', hair: '#8a4a2a', hairStyle: 'short', top: { type: 'tee', color: '#4a9ad8', sleeves: 'short' }, pants: '#3a4a6a', shoes: '#c03a30' },
    odo:    { build: 'stout', skin: '#d8a880', hair: '#6a5a3a', hairStyle: 'cap', accent: '#e0b040', beard: '#6a5a3a', top: { type: 'tee', color: '#6a8a4a', sleeves: 'short' }, pants: '#5a4a8a', shoes: '#3a2a20', boots: true },
    rena:   { build: 'slim', skin: '#f4d0b0', hair: '#c8402a', hairStyle: 'long', top: { type: 'tee', color: '#e8a040', sleeves: 'short' }, pants: '#5a3a5a', shoes: '#3a2a20' },
    boro:   { build: 'stout', skin: '#b07850', hair: '#2a2020', hairStyle: 'short', top: { type: 'apron', color: '#4a8a6a', apron: '#d8c8a0', sleeves: 'short' }, pants: '#3a3a3a', shoes: '#2a2020' },
    lia:    { build: 'slim', skin: '#f6dcc4', hair: '#f2d06a', hairStyle: 'long', top: { type: 'tee', color: '#9a6ad0', sleeves: 'long' }, pants: '#4a3a6a', shoes: '#e8e0d0' },
    elder:  { build: 'normal', skin: '#e0b090', hair: '#e8e8ec', hairStyle: 'bald', beard: '#e8e8ec', top: { type: 'robe', color: '#7a6a9a', sleeves: 'long' }, pants: '#4a3a5a', shoes: '#3a2a20' },
    sir:    { build: 'broad', skin: '#e8c0a0', hair: '#a8a8b4', hairStyle: 'short', top: { type: 'armor', color: '#a8b0c0', inner: '#3a5ad0', sleeves: 'long' }, pants: '#7a8090', shoes: '#4a4a58', boots: true },
    cactus: { build: 'normal', skin: '#5aa04a', hair: '#ff7aa0', hairStyle: 'bald', top: { type: 'tee', color: '#4a8a3a', sleeves: 'none' }, pants: '#3a7a2a', shoes: '#c8a060' },
    clerk:  { build: 'normal', skin: '#e8d8f0', hair: '#4a4a7a', hairStyle: 'neat', glasses: '#e8e8f0', top: { type: 'suit', color: '#3a3a6a', inner: '#f4f0e6', tie: '#c0303a', sleeves: 'long' }, pants: '#2a2a4a', shoes: '#141428' },
    kid2:   { build: 'kid', skin: '#c89070', hair: '#1a1a2a', hairStyle: 'short', top: { type: 'tee', color: '#e0503c', sleeves: 'short' }, pants: '#3a3a5a', shoes: '#f4f0e6' },
  };
  // Overdrive: the ki burns through the clothes' colours
  LOOKS.junoOD = Object.assign({}, LOOKS.juno, { headTint: { H: '#ffb24a', h: '#e0702a', d: '#a03a12', g: '#fff2a0' } });
  LOOKS.reiOD = Object.assign({}, LOOKS.rei, { headTint: { H: '#bff4ff', h: '#6ad8ff', d: '#2a8ad8', g: '#ffffff' } });
  LOOKS.orenOD = Object.assign({}, LOOKS.oren, { tattoo: '#ff5a3a', headTint: { H: '#7a1a10', h: '#a83a20' } });
  LOOKS.braskOD = Object.assign({}, LOOKS.brask, { headTint: { H: '#d8b8ff', g: '#ffffff', h: '#a888e0' } });
  LOOKS.islaOD = Object.assign({}, LOOKS.isla, { headTint: { X: '#9af0ff' } });

  /* ── the body ─────────────────────────────────────────── */
  function limb(b, x0, y0, x1, y1, w, R, far) {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    const steep = Math.abs(y1 - y0) >= Math.abs(x1 - x0);
    const col = (i) => { const c = i === 0 ? R.hi : i === w - 1 ? R.s : (i === w - 2 && w > 3) ? R.m : R.b; return far ? shade(c, -0.22) : c; };
    for (let k = 0; k <= n; k++) {
      const t = k / n, cx = x0 + (x1 - x0) * t, cy = y0 + (y1 - y0) * t;
      for (let i = 0; i < w; i++) {
        if (steep) b.set(Math.round(cx - w / 2 + i), Math.round(cy), col(i));
        else b.set(Math.round(cx), Math.round(cy - w / 2 + i), col(i));
      }
    }
  }
  function fist(b, x, y, sz, R, far) {
    for (let j = 0; j < sz; j++) for (let i = 0; i < sz; i++) {
      const c = j === 0 && i === 0 ? R.hi : (i === sz - 1 || j === sz - 1) ? R.s : R.b;
      b.set(Math.round(x - sz / 2 + i), Math.round(y - sz / 2 + j), far ? shade(c, -0.22) : c);
    }
  }

  function bodyBuf(L, dir, pose) {
    const b = new Buf(FW, FH);
    const B = BUILDS[L.build || 'normal'];
    const skin = ramp(L.skin), topR = ramp(L.top.color), pants = ramp(L.pants || '#3a3a4a');
    const shoes = ramp(L.shoes || '#3a2a20');
    const inner = L.top.inner ? ramp(L.top.inner) : null;
    const crouch = pose === 'charge' || pose === 'guard' ? 1 : 0;
    const hipY = GROUND - 1 - B.leg - (L.boots ? 0 : 0);
    const beltY = hipY - 1 + crouch;
    const shY = beltY - B.torso;
    const walk = pose === 'walk1' ? 1 : pose === 'walk2' ? 2 : 0;
    const lean = pose === 'hurt' ? (dir === 'left' ? 1 : dir === 'right' ? -1 : 0) : 0;
    const sleeve = (side) => {
      if (L.top.sleeves === 'long') return side === 'R' && L.top.rolledR ? 'rolled' : 'long';
      return L.top.sleeves || 'none';
    };
    // an arm: shoulder → elbow → hand, clothed per sleeve type
    const arm = (sx, sy, ex, ey, hx, hy, side, far, bigFist) => {
      const sl = sleeve(side);
      const upper = sl === 'none' ? skin : topR;
      const lower = (sl === 'long') ? topR : skin;
      const w = B.armW;
      limb(b, sx, sy, ex, ey, w, upper, far);
      if (sl === 'short') limb(b, sx, sy, sx + (ex - sx) * 0.5, sy + (ey - sy) * 0.5, w + (w > 2 ? 0 : 0), topR, far);
      limb(b, ex, ey, hx, hy, w, lower, far);
      if (L.tattoo && sl === 'none') { const mx = (sx + ex) / 2, my = (sy + ey) / 2; b.set(Math.round(mx), Math.round(my), L.tattoo); b.set(Math.round(mx) + 1, Math.round(my) + 1, L.tattoo); b.set(Math.round(mx), Math.round(my) + 2, L.tattoo); b.set(Math.round(mx) - 1, Math.round(my) - 2, L.tattoo); }
      if ((sl === 'long') && L.top.cuff) { const cx = ex + (hx - ex) * 0.8, cy = ey + (hy - ey) * 0.8; limb(b, cx, cy, ex + (hx - ex) * 0.9, ey + (hy - ey) * 0.9, w, ramp(L.top.cuff), far); }
      if (L.wraps && sl !== 'long') { limb(b, ex + (hx - ex) * 0.55, ey + (hy - ey) * 0.55, ex + (hx - ex) * 0.85, ey + (hy - ey) * 0.85, w, ramp(L.wraps), far); }
      fist(b, hx, hy, bigFist ? w + 2 : w + 1, L.gloves ? ramp(L.gloves) : skin, far);
      if (L.gun && side === 'R' && !bigFist) b.rect(Math.round(hx) - 2, Math.round(hy), 6, 2, '#6b7280');
    };
    const cape = L.top.cape ? ramp(L.top.cape) : null;

    if (dir === 'down' || dir === 'up') {
      const front = dir === 'down';
      const half = B.sh / 2;
      const lsx = CX - half - B.armW / 2 + 1.5, rsx = CX + half + B.armW / 2 - 1.5;   // shoulder centres
      if (cape && !front) b.rect(Math.round(CX - half - 1), shY + 1, B.sh + 2, B.torso + 10, cape.b);
      // legs
      const lx = CX - B.gap / 2 - B.legW / 2, rx = CX + B.gap / 2 + B.legW / 2;
      const liftL = walk === 2 ? 2 : 0, liftR = walk === 1 ? 2 : 0;
      const legDown = (x, lift, far) => {
        const top = beltY + 1, bot = GROUND - 2 - lift;
        limb(b, x, top, x, bot, B.legW, pants, far);
        const sw = B.legW + 1;
        for (let j = 0; j < 2 + (L.boots ? 2 : 0); j++) for (let i = 0; i < sw; i++) b.set(Math.round(x - sw / 2 + i + (front ? 0 : 0)), bot - (L.boots ? 2 : 0) + j + (j >= 2 + (L.boots ? 2 : 0) - 2 ? 0 : 0), i === 0 && j === 0 ? shoes.hi : j === (L.boots ? 3 : 1) ? (L.sole || shoes.s) : shoes.b);
      };
      if (pose === 'kick') {
        legDown(lx, 0);
        limb(b, rx, beltY + 1, rx + 7, beltY + 6, B.legW, pants);
        fist(b, rx + 8, beltY + 6, B.legW + 1, shoes);
      } else { legDown(lx - crouch, liftL); legDown(rx + crouch, liftR); }
      // torso
      for (let y = shY; y < beltY; y++) {
        const t = (y - shY) / Math.max(1, B.torso - 1);
        let w = B.sh + (B.wa - B.sh) * Math.min(1, t * 1.25);
        if (t > 0.85) w = B.wa + (B.hip - B.wa) * ((t - 0.85) / 0.15);
        if (y === shY) w -= 2;
        w = Math.max(4, Math.round(w / 2) * 2);
        const x0 = Math.round(CX - w / 2 + 0.5) + lean, x1 = x0 + w - 1;
        for (let x = x0; x <= x1; x++) {
          const edge = x === x0 ? 'hi' : x >= x1 - 1 ? 's' : 'b';
          let c = topR[edge];
          const fromC = Math.abs(x + 0.5 - (CX + 0.5 + lean));
          const ty = L.top.type;
          if (front && ty === 'open' && inner && fromC < (L.top.turtleneck ? 3 : 2.5) - t * 0.6) c = inner[edge === 's' ? 'm' : 'b'];
          if (front && ty === 'open' && inner && Math.abs(fromC - (2.5 - t * 0.6)) < 0.6 && t < 0.5 && L.top.collar) c = L.top.collar;
          if (front && ty === 'collar' && Math.abs(fromC) < 0.6) c = topR.m;
          if (ty === 'singlet') {
            const strapX = Math.abs(fromC - B.sh * 0.2) < 1.2 && t < 0.25;
            const body = fromC < B.wa * 0.42 + (t > 0.3 ? 2 : 0) && t >= 0.22;
            c = body || strapX ? topR[edge] : skin[edge];
            if (front && !body && !strapX && t < 0.3 && fromC < 3) c = skin.hi;
          }
          if (front && ty === 'suit' && inner) { if (fromC < 2 - t * 2 && t < 0.7) c = inner.b; if (L.top.tie && fromC < 0.6 && t < 0.85) c = L.top.tie; }
          if (front && ty === 'apron' && fromC < B.wa / 2 - 0.5 && t > 0.25) c = L.top.apron;
          if (front && ty === 'armor' && (y - shY) % 4 === 3) c = topR.s;
          if (front && ty === 'armor' && inner && fromC < 1) c = inner.b;
          b.set(x, y, c);
        }
      }
      // turtleneck/collar rising into the neck
      if (L.top.type === 'collar' || L.top.turtleneck) { const nc = L.top.turtleneck ? inner : topR; b.rect(Math.round(CX - 2.5), shY - 2, 6, 2, nc.b); b.set(Math.round(CX + 2.5), shY - 2, nc.s); }
      // coat tails & hem
      if (L.top.tails) {
        const tl = L.top.tails;
        for (let j = 0; j < tl; j++) {
          const w = Math.round(B.hip / 2) + 1;
          for (let i = 0; i < w; i++) {
            const gapIn = front ? 1 : 0;
            b.set(Math.round(CX - B.hip / 2 - 1 + i - (front ? 0 : 0)), beltY + j, i === 0 ? topR.hi : topR.b);
            b.set(Math.round(CX + B.hip / 2 + 1 - i), beltY + j, i === 0 ? topR.s : topR.m);
            if (!front && i === 0) b.set(Math.round(CX), beltY + j, topR.s);
            void gapIn;
          }
        }
      }
      if (L.top.type === 'robe') { for (let y = beltY; y < GROUND - 2; y++) { const w = B.hip + 2 + Math.round((y - beltY) * 0.25); const x0 = Math.round(CX - w / 2 + 0.5); for (let x = x0; x < x0 + w; x++) b.set(x, y, x === x0 ? topR.hi : x >= x0 + w - 2 ? topR.s : topR.b); } }
      if (L.top.hem) { const w = B.hip + 2; b.rect(Math.round(CX - w / 2 + 0.5), beltY, w, 2, topR.m); if (front && inner) b.rect(Math.round(CX - 1.5), beltY, 4, 2, ramp(L.pants).b); }
      // belt / sash
      const bw = Math.round(B.hip / 2) * 2;
      if (L.belt) { b.rect(Math.round(CX - bw / 2 + 0.5), beltY, bw, 1, L.belt); if (front && L.buckle) b.rect(Math.round(CX - 0.5), beltY, 2, 1, L.buckle); }
      if (L.sash) { const R = ramp(L.sash); b.rect(Math.round(CX - bw / 2 + 0.5), beltY - 1, bw, 2, R.b); b.rect(Math.round(CX - bw / 2 + 0.5), beltY, bw, 1, R.s); const tx = front ? Math.round(CX + bw / 2 - 2) : Math.round(CX - bw / 2 + 1); limb(b, tx, beltY + 1, tx + (front ? 1 : -1), beltY + 6, 2, R); }
      // arms
      const sy = shY + 1;
      let le = [lsx, shY + B.torso * 0.5], lh = [lsx + 0.5, beltY + 2], re = [rsx, shY + B.torso * 0.5], rh = [rsx - 0.5, beltY + 2];
      let fl = false, fr = false;
      if (walk === 1) { lh = [lsx + 0.5, beltY]; rh = [rsx - 0.5, beltY + 3]; }
      if (walk === 2) { lh = [lsx + 0.5, beltY + 3]; rh = [rsx - 0.5, beltY]; }
      if (front) {
        if (pose === 'punch1') { re = [rsx - 1, shY + 6]; rh = [CX + 3, beltY + 6]; fr = true; }
        if (pose === 'punch2') { le = [lsx + 1, shY + 6]; lh = [CX - 3, beltY + 6]; fl = true; }
        if (pose === 'blast') { le = [lsx + 1, shY + 6]; lh = [CX - 2, beltY + 2]; re = [rsx - 1, shY + 6]; rh = [CX + 2, beltY + 2]; }
      } else {
        if (pose === 'punch1') { re = [rsx + 1, shY - 3]; rh = [rsx, shY - 11]; fr = true; }
        if (pose === 'punch2') { le = [lsx - 1, shY - 3]; lh = [lsx, shY - 11]; fl = true; }
        if (pose === 'blast') { le = [lsx, shY - 4]; lh = [CX - 2, shY - 10]; re = [rsx, shY - 4]; rh = [CX + 2, shY - 10]; }
      }
      if (pose === 'charge') { le = [lsx - 2, shY + 5]; lh = [lsx + 1, beltY]; re = [rsx + 2, shY + 5]; rh = [rsx - 1, beltY]; fl = fr = true; }
      if (pose === 'hurt') { le = [lsx - 3, shY - 1]; lh = [lsx - 4, shY - 5]; re = [rsx + 3, shY - 1]; rh = [rsx + 4, shY - 5]; }
      if (pose === 'kick') { le = [lsx - 2, shY + 4]; lh = [lsx, shY + 1]; re = [rsx + 2, shY + 4]; rh = [rsx, shY + 1]; fl = fr = true; }
      if (pose === 'guard') { le = [lsx - 2, shY + 6]; lh = [CX + 1, shY + 2]; re = [rsx + 2, shY + 6]; rh = [CX - 1, shY + 1]; fl = fr = true; }
      const handsHigh = !front && (pose === 'punch1' || pose === 'punch2' || pose === 'blast');
      const drawArms = () => { arm(lsx, sy, le[0], le[1], lh[0], lh[1], 'L', false, fl); arm(rsx, sy, re[0], re[1], rh[0], rh[1], 'R', false, fr); };
      if (!handsHigh) drawArms();
      // neck
      b.rect(Math.round(CX - B.neck / 2 + 0.5) + lean, shY - 2, B.neck, 2, skin.s);
      stampHead(b, L, front ? 'front' : 'back', shY - 2, lean, pose);
      if (handsHigh) drawArms();
      if (cape && front) { b.rect(Math.round(CX - half - 2), shY, 2, B.torso, cape.s); b.rect(Math.round(CX + half), shY, 2, B.torso, cape.s); }
    } else {
      // profile, facing left
      const d = Math.max(6, Math.round(B.sh * 0.62) + 1);
      const x0 = Math.round(CX - d / 2 + 0.5);
      const hipX = CX;
      if (cape) b.rect(x0 + d - 2, shY, 4, B.torso + 10, cape.b);
      // far leg, far arm first
      const shoe = (x, y, far) => {
        const R = far ? { b: shade(shoes.b, -0.22), hi: shade(shoes.hi, -0.22), s: shade(shoes.s, -0.22) } : shoes;
        const L2 = B.legW + 3, h2 = L.boots ? 4 : 2;
        for (let j = 0; j < h2; j++) for (let i = 0; i < L2; i++) b.set(Math.round(x - B.legW / 2 - 2 + i), y - h2 + 1 + j, j === h2 - 1 ? (L.sole || R.s) : (i === 0 ? R.hi : R.b));
      };
      if (pose === 'kick') {
        limb(b, hipX + 1, beltY + 1, hipX + 1, GROUND - 2, B.legW, pants, true); shoe(hipX + 1, GROUND, true);
        limb(b, hipX, beltY + 1, hipX - 10, beltY + 3, B.legW, pants);
        fist(b, hipX - 12, beltY + 3, B.legW + 2, shoes);
      } else if (walk) {
        const a = walk === 1 ? -4 : 4;
        limb(b, hipX, beltY + 1, hipX - a, GROUND - 2, B.legW, pants, true); shoe(hipX - a, GROUND, true);
        limb(b, hipX, beltY + 1, hipX + a, GROUND - 2, B.legW, pants); shoe(hipX + a, GROUND);
      } else {
        const sp = crouch ? 2 : 0;
        limb(b, hipX + 1 + sp, beltY + 1, hipX + 1 + sp, GROUND - 2, B.legW, pants, true); shoe(hipX + 1 + sp, GROUND, true);
        limb(b, hipX - 1 - sp, beltY + 1, hipX - 1 - sp, GROUND - 2, B.legW, pants); shoe(hipX - 1 - sp, GROUND);
      }
      const sx = CX, sy = shY + 1;
      let fe = [sx + 1, shY + B.torso * 0.5], fh = [sx + 1, beltY + 2], ne = [sx - 1, shY + B.torso * 0.5], nh = [sx - 1, beltY + 2];
      let ffist = false, nfist = false;
      if (walk === 1) { fh = [sx + 4, beltY + 1]; nh = [sx - 4, beltY + 1]; fe = [sx + 2, shY + 5]; ne = [sx - 2, shY + 5]; }
      if (walk === 2) { fh = [sx - 4, beltY + 1]; nh = [sx + 4, beltY + 1]; fe = [sx - 2, shY + 5]; ne = [sx + 2, shY + 5]; }
      if (pose === 'punch1') { ne = [sx - 6, shY + 3]; nh = [sx - 13, shY + 3]; nfist = true; fe = [sx + 3, shY + 5]; fh = [sx + 2, shY + 2]; }
      if (pose === 'punch2') { fe = [sx - 6, shY + 3]; fh = [sx - 12, shY + 2]; ffist = true; ne = [sx + 2, shY + 5]; nh = [sx + 1, shY + 2]; }
      if (pose === 'blast') { ne = [sx - 5, shY + 3]; nh = [sx - 11, shY + 3]; fe = [sx - 4, shY + 2]; fh = [sx - 10, shY + 2]; }
      if (pose === 'charge') { ne = [sx + 2, shY + 5]; nh = [sx + 3, beltY - 1]; fe = [sx + 3, shY + 4]; fh = [sx + 4, beltY - 2]; nfist = ffist = true; }
      if (pose === 'hurt') { ne = [sx + 4, shY + 1]; nh = [sx + 7, shY - 2]; fe = [sx + 5, shY + 2]; fh = [sx + 8, shY]; }
      if (pose === 'kick') { ne = [sx + 3, shY + 4]; nh = [sx + 1, shY]; fe = [sx - 3, shY + 3]; fh = [sx - 4, shY]; nfist = ffist = true; }
      if (pose === 'guard') { ne = [sx - 3, shY + 6]; nh = [sx - 4, shY - 1]; fe = [sx - 2, shY + 7]; fh = [sx - 3, shY]; nfist = ffist = true; }
      arm(sx + 1, sy, fe[0], fe[1], fh[0], fh[1], 'R', true, ffist);
      // torso
      for (let y = shY; y < beltY; y++) {
        const t = (y - shY) / Math.max(1, B.torso - 1);
        const dd = Math.round(d - (B.sh - B.wa) * 0.25 * Math.min(1, t * 1.2));
        const xx = Math.round(CX - dd / 2 + 0.5) + lean;
        for (let x = xx; x < xx + dd; x++) {
          let c = x >= xx + dd - 1 ? topR.s : x === xx ? topR.hi : topR.b;
          if (L.top.type === 'open' && inner && x <= xx + 1) c = inner.b;
          if (L.top.type === 'singlet') c = (t >= 0.22 && x <= xx + dd - 2) || (t < 0.25 && x === xx + Math.round(dd / 2)) ? topR.b : skin.b;
          if (L.top.type === 'apron' && x <= xx && t > 0.25) c = L.top.apron;
          if (L.top.type === 'suit' && x === xx && t < 0.8) c = L.top.tie || inner.b;
          b.set(x, y, c);
        }
      }
      if (L.top.type === 'collar' || L.top.turtleneck) b.rect(Math.round(CX - 2), shY - 2, 4, 2, (L.top.turtleneck ? inner : topR).b);
      if (L.top.tails) for (let j = 0; j < L.top.tails; j++) b.rect(x0 + 1 + Math.round(j * 0.15), beltY + j, d - 1, 1, j % 3 === 2 ? topR.m : topR.b);
      if (L.top.type === 'robe') for (let y = beltY; y < GROUND - 2; y++) b.rect(x0 - 1, y, d + 2 + Math.round((y - beltY) * 0.2), 1, topR.b);
      if (L.top.hem) b.rect(x0, beltY, d + 1, 2, topR.m);
      if (L.belt) b.rect(x0, beltY, d, 1, L.belt);
      if (L.sash) { const R = ramp(L.sash); b.rect(x0, beltY - 1, d, 2, R.b); limb(b, x0 + d - 1, beltY + 1, x0 + d + 1, beltY + 6, 2, R); }
      b.rect(Math.round(CX - B.neck / 2 + 0.5) + lean, shY - 2, Math.max(2, B.neck - 1), 2, skin.s);
      arm(sx - 1 + lean, sy, ne[0], ne[1], nh[0], nh[1], 'L', false, nfist);
      stampHead(b, L, 'side', shY - 2, lean, pose);
    }
    return b;
  }

  /* put the head on: chin row lands on `chinY` */
  function stampHead(b, L, view, chinY, lean, pose) {
    if (L.head && HEADS[L.head]) {
      const H = HEADS[L.head], art = H[view], pal = Object.assign({}, H.pal, L.headTint || {});
      const ox = Math.round(CX - art.cx) + lean, oy = chinY - art.chin;
      const shut = pose === 'hurt';
      art.rows.forEach((r, j) => {
        for (let i = 0; i < r.length; i++) {
          let ch = r[i];
          if (ch === '.') continue;
          if (shut && (ch === 'e' || ch === 'w')) ch = ch === 'e' ? 'e' : 'S';
          const c = pal[ch];
          if (c) b.set(ox + i, oy + j, c);
        }
      });
      return;
    }
    const dirName = view === 'front' ? 'down' : view === 'back' ? 'up' : 'left';
    const h = procHead(L, dirName);
    const ox = Math.round(CX - h.cx) + lean, oy = chinY - h.chin;
    for (let y = 0; y < h.buf.h; y++) for (let x = 0; x < h.buf.w; x++) {
      const c = h.buf.get(x, y);
      if (c) b.set(ox + x, oy + y, c, h.buf.raw[y * h.buf.w + x] === 1);
    }
  }

  const POSES = ['idle', 'walk1', 'walk2', 'punch1', 'punch2', 'kick', 'blast', 'charge', 'hurt', 'guard'];
  function sheet(look) {
    const L = LOOKS[look];
    const out = { w: FW, h: FH, down: {}, up: {}, left: {}, right: {} };
    for (const pose of POSES) {
      for (const dir of ['down', 'up', 'left']) {
        const b = bodyBuf(L, dir, pose);
        out[dir][pose] = b.toCanvas();
        if (dir === 'left') out.right[pose] = b.mirror().toCanvas();
      }
    }
    const ko = GFX.canvas(FH, FW), kx = ko.getContext('2d');
    kx.translate(FH / 2, FW / 2); kx.rotate(-Math.PI / 2);
    kx.drawImage(out.down.hurt, -FW / 2, -FH / 2);
    out.ko = ko;
    // portrait: the head, cropped to 16x16
    const B = BUILDS[L.build || 'normal'];
    const shY = (GROUND - 1 - B.leg - 1) - B.torso;
    const chin = shY - 2;
    const face = GFX.canvas(16, 16), fx = face.getContext('2d');
    fx.drawImage(out.down.idle, Math.round(CX - 8), Math.max(0, chin - 13), 16, 16, 0, 0, 16, 16);
    out.face = face;
    return out;
  }

  return { sheet, LOOKS, HEADS, FW, FH, has: (k) => !!LOOKS[k] };
})();
