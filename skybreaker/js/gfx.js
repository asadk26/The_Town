/* SKYBREAKER — pixels.

   There are no image files.  Every sprite, tile and prop is drawn here, in
   code, a pixel at a time, at the handheld's own resolution: characters are
   built from a few key points per pose (shoulders, hands, hips, feet) so a
   new pose is a handful of numbers, and every shape gets the same dark,
   colour-matched outline at the end.  Terrain is baked per map into one
   canvas, with noise-ragged borders between ground types, so the world reads
   as painted rather than gridded. */
'use strict';

const GFX = (() => {

  /* ── colour ─────────────────────────────────────────────── */
  const rgbCache = {};
  function rgb(h) {
    if (rgbCache[h]) return rgbCache[h];
    const s = h.replace('#', '');
    return (rgbCache[h] = [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)]);
  }
  const hex2 = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  function hex(r, g, b) { return '#' + hex2(r) + hex2(g) + hex2(b); }
  function mix(a, b, t) {
    const A = rgb(a), B = rgb(b);
    return hex(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t);
  }
  /* f > 0 lightens toward a warm white, f < 0 darkens toward a cool ink —
     the way hand-picked shading ramps tend to drift in hue. */
  function shade(h, f) { return f >= 0 ? mix(h, '#fff8e8', f) : mix(h, '#1c1030', -f); }

  /* ── noise ──────────────────────────────────────────────── */
  function hash(x, y, s = 0) {
    let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0;
    h = (h ^ (h >>> 13)) * 1274126177 | 0;
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }
  function smooth(x, y, s = 0) {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const a = hash(xi, yi, s), b = hash(xi + 1, yi, s), c = hash(xi, yi + 1, s), d = hash(xi + 1, yi + 1, s);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }

  function canvas(w, h) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    return c;
  }

  /* ── the pixel buffer ───────────────────────────────────── */
  class Buf {
    constructor(w, h) { this.w = w; this.h = h; this.d = new Array(w * h).fill(null); this.raw = new Uint8Array(w * h); }
    set(x, y, c, raw) {
      x = Math.round(x); y = Math.round(y);
      if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
      this.d[y * this.w + x] = c;
      this.raw[y * this.w + x] = raw ? 1 : 0;
    }
    get(x, y) { return (x < 0 || y < 0 || x >= this.w || y >= this.h) ? null : this.d[y * this.w + x]; }
    clear(x, y) { if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.d[y * this.w + x] = null; }
    rect(x, y, w, h, c, raw) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c, raw); }
    disc(cx, cy, r, c, raw) {
      for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++)
        for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++)
          if ((x - cx) * (x - cx) + (y - cy) * (y - cy) <= r * r + 0.3) this.set(x, y, c, raw);
    }
    ellipse(cx, cy, rx, ry, c, raw) {
      for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
        for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
          const dx = (x - cx) / rx, dy = (y - cy) / ry;
          if (dx * dx + dy * dy <= 1.05) this.set(x, y, c, raw);
        }
    }
    /* a limb: a thick line from (x0,y0) to (x1,y1), w pixels wide to the right */
    limb(x0, y0, x1, y1, c, w = 2, c2 = null, split = 0.5) {
      const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        const x = Math.round(x0 + (x1 - x0) * t), y = Math.round(y0 + (y1 - y0) * t);
        this.rect(x, y, w, 1, (c2 && t > split) ? c2 : c);
      }
    }
    mirror() {
      const b = new Buf(this.w, this.h);
      for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
        b.d[y * this.w + x] = this.d[y * this.w + (this.w - 1 - x)];
        b.raw[y * this.w + x] = this.raw[y * this.w + (this.w - 1 - x)];
      }
      return b;
    }
    toCanvas(outline = true) {
      const c = canvas(this.w, this.h);
      const ctx = c.getContext('2d');
      const img = ctx.createImageData(this.w, this.h);
      const out = this.d.slice();
      if (outline) {
        for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
          if (this.d[y * this.w + x]) continue;
          let best = null;
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const nx = x + dx, ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= this.w || ny >= this.h) continue;
            const i = ny * this.w + nx;
            if (this.d[i] && !this.raw[i]) { best = this.d[i]; break; }
          }
          if (best) out[y * this.w + x] = mix(best, '#160c22', 0.72);
        }
      }
      for (let i = 0; i < out.length; i++) {
        if (!out[i]) continue;
        const [r, g, b] = rgb(out[i]);
        img.data[i * 4] = r; img.data[i * 4 + 1] = g; img.data[i * 4 + 2] = b; img.data[i * 4 + 3] = 255;
      }
      ctx.putImageData(img, 0, 0);
      return c;
    }
  }

  /* White silhouette of any canvas, for hit flashes.  Cached on the canvas. */
  function flash(src) {
    if (src._flash) return src._flash;
    const c = canvas(src.width, src.height), x = c.getContext('2d');
    x.drawImage(src, 0, 0);
    x.globalCompositeOperation = 'source-in';
    x.fillStyle = '#fff';
    x.fillRect(0, 0, c.width, c.height);
    return (src._flash = c);
  }
  function tint(src, color) {
    src._tint = src._tint || {};
    if (src._tint[color]) return src._tint[color];
    const c = canvas(src.width, src.height), x = c.getContext('2d');
    x.drawImage(src, 0, 0);
    x.globalCompositeOperation = 'source-in';
    x.fillStyle = color;
    x.fillRect(0, 0, c.width, c.height);
    return (src._tint[color] = c);
  }

  /* ════════════════════════════════════════════════════════
     PEOPLE
     ════════════════════════════════════════════════════════ */

  const FW = 24, FH = 32;
  const BUILDS = {
    normal: { tw: 8, th: 6, legH: 5, stw: 5, legL: 8, legR: 13, legW: 3 },
    big:    { tw: 10, th: 7, legH: 6, stw: 7, legL: 8, legR: 13, legW: 3 },
    kid:    { tw: 6, th: 4, legH: 3, stw: 4, legL: 9, legR: 13, legW: 2 },
    tall:   { tw: 8, th: 7, legH: 8, stw: 5, legL: 8, legR: 13, legW: 3 },
  };
  const INK = '#1a1028';

  /* Hair, per style, per facing.  (hx, hy) is the head's top-left; the head
     is 8x8 face-on and 7 wide in profile, starting one pixel right. */
  const HAIR = {
    ponytail(b, s, dir, hx, hy, f) {
      const H = s.hair, D = shade(H, -0.28), L = shade(H, 0.3), tie = s.accent || '#e8483a';
      const sway = f === 1 ? 1 : f === 2 ? -1 : 0;
      if (dir === 'down') {
        b.rect(hx + 1, hy - 2, 6, 1, H); b.rect(hx, hy - 1, 8, 3, H);
        b.rect(hx + 2, hy - 1, 2, 1, L);
        for (const x of [0, 1, 3, 4, 6, 7]) b.set(hx + x, hy + 2, H);
        b.set(hx + 2, hy + 2, D); b.set(hx + 5, hy + 2, D);
        b.rect(hx, hy + 3, 1, 3, H); b.rect(hx + 7, hy + 3, 1, 3, D);
        b.rect(hx + 8, hy - 1, 2, 2, tie);
        b.rect(hx + 9 + (sway > 0 ? 1 : 0), hy + 1, 2, 4, H); b.set(hx + 10 + (sway > 0 ? 1 : 0), hy + 4, D);
      } else if (dir === 'up') {
        b.rect(hx + 1, hy - 2, 6, 1, H); b.rect(hx, hy - 1, 8, 8, H);
        b.rect(hx + 2, hy - 1, 3, 1, L); b.rect(hx + 7, hy, 1, 6, D);
        b.rect(hx + 3, hy + 2, 2, 1, tie);
        b.rect(hx + 3 + sway, hy + 3, 2, 3, H); b.rect(hx + 3 + sway * 2, hy + 6, 2, 4, H);
        b.set(hx + 4 + sway * 2, hy + 9, D);
      } else {
        b.rect(hx + 2, hy - 2, 5, 1, H); b.rect(hx + 1, hy - 1, 7, 3, H);
        b.rect(hx + 3, hy - 1, 2, 1, L);
        b.set(hx + 1, hy + 2, H); b.set(hx + 2, hy + 2, H);
        b.rect(hx + 4, hy + 2, 4, 4, H); b.rect(hx + 7, hy + 2, 1, 4, D);
        b.rect(hx + 7, hy, 2, 2, tie);
        b.rect(hx + 8, hy + 1, 3, 2, H); b.rect(hx + 9 + sway, hy + 3, 2, 3, H);
        b.set(hx + 10 + sway, hy + 5, D); b.rect(hx + 9 + sway * 2, hy + 6, 2, 2, D);
      }
    },
    mohawk(b, s, dir, hx, hy) {
      const H = s.hair, D = shade(H, -0.3), L = shade(H, 0.4), stub = shade(s.skin, -0.32);
      if (dir === 'down' || dir === 'up') {
        b.rect(hx + 2, hy - 5, 4, 6, H); b.rect(hx + 3, hy - 6, 2, 1, H);
        b.rect(hx + 2, hy - 5, 1, 5, L); b.rect(hx + 5, hy - 5, 1, 6, D);
        b.rect(hx, hy, 2, 3, stub); b.rect(hx + 6, hy, 2, 3, stub);
        if (dir === 'up') { b.rect(hx + 2, hy + 1, 4, 3, H); b.rect(hx, hy + 1, 8, 4, stub); b.rect(hx + 2, hy, 4, 4, H); }
      } else {
        b.rect(hx + 1, hy - 3, 2, 3, H); b.rect(hx + 3, hy - 5, 3, 5, H); b.rect(hx + 6, hy - 4, 2, 5, H);
        b.rect(hx + 3, hy - 5, 2, 1, L); b.rect(hx + 7, hy - 3, 1, 5, D);
        b.rect(hx + 3, hy, 5, 3, stub);
      }
    },
    bun(b, s, dir, hx, hy) {
      const H = s.hair, D = shade(H, -0.25), L = shade(H, 0.3);
      const o = dir === 'down' || dir === 'up' ? 0 : 1;
      b.disc(hx + 4 + o, hy - 2.5, 2.2, H); b.set(hx + 3 + o, hy - 4, L);
      b.rect(hx + o, hy - 1, 8 - o, 3, H); b.rect(hx + 1 + o, hy - 1, 3, 1, L);
      if (dir === 'down') { b.rect(hx, hy + 2, 1, 3, D); b.rect(hx + 7, hy + 2, 1, 3, D); }
      else if (dir === 'up') b.rect(hx, hy + 2, 8, 4, H);
      else b.rect(hx + 4, hy + 2, 4, 3, H);
    },
    tallbun(b, s, dir, hx, hy) {
      const H = s.hair, D = shade(H, -0.2), band = s.accent || '#3a3a8c';
      const o = dir === 'down' || dir === 'up' ? 0 : 1;
      b.rect(hx + 2 + o, hy - 6, 4, 5, H); b.rect(hx + 3 + o, hy - 7, 2, 1, H);
      b.rect(hx + 2 + o, hy - 2, 4, 1, band);
      b.rect(hx + o, hy - 1, 8 - o, 2, H); b.rect(hx + 5 + o, hy - 6, 1, 4, D);
      if (dir === 'down') { b.rect(hx, hy + 1, 1, 2, H); b.rect(hx + 7, hy + 1, 1, 2, D); }
      else if (dir === 'up') b.rect(hx, hy + 1, 8, 5, H);
      else b.rect(hx + 4, hy + 1, 4, 4, H);
    },
    short(b, s, dir, hx, hy) {
      const H = s.hair, D = shade(H, -0.28), L = shade(H, 0.3);
      if (dir === 'down') {
        b.rect(hx + 1, hy - 2, 6, 1, H); b.rect(hx, hy - 1, 8, 3, H); b.rect(hx + 1, hy - 1, 3, 1, L);
        b.set(hx, hy + 2, H); b.set(hx + 7, hy + 2, D); b.set(hx + 3, hy + 2, H);
      } else if (dir === 'up') {
        b.rect(hx + 1, hy - 2, 6, 1, H); b.rect(hx, hy - 1, 8, 6, H); b.rect(hx + 6, hy, 2, 5, D);
      } else {
        b.rect(hx + 2, hy - 2, 5, 1, H); b.rect(hx + 1, hy - 1, 7, 3, H); b.rect(hx + 4, hy + 2, 4, 3, H);
        b.rect(hx + 2, hy - 1, 3, 1, L); b.rect(hx + 7, hy, 1, 5, D);
      }
    },
    long(b, s, dir, hx, hy) {
      const H = s.hair, D = shade(H, -0.28), L = shade(H, 0.3);
      if (dir === 'down') {
        b.rect(hx + 1, hy - 2, 6, 1, H); b.rect(hx, hy - 1, 8, 3, H); b.rect(hx + 2, hy - 1, 2, 1, L);
        b.rect(hx - 1, hy + 1, 2, 9, H); b.rect(hx + 7, hy + 1, 2, 9, D);
      } else if (dir === 'up') {
        b.rect(hx + 1, hy - 2, 6, 1, H); b.rect(hx - 1, hy - 1, 10, 11, H); b.rect(hx + 6, hy, 3, 10, D);
      } else {
        b.rect(hx + 2, hy - 2, 5, 1, H); b.rect(hx + 1, hy - 1, 7, 3, H);
        b.rect(hx + 4, hy + 2, 5, 8, H); b.rect(hx + 8, hy + 2, 1, 8, D); b.rect(hx + 2, hy - 1, 3, 1, L);
      }
    },
    neat(b, s, dir, hx, hy) {
      const H = s.hair, L = shade(H, 0.35);
      if (dir === 'down') {
        b.rect(hx + 1, hy - 1, 7, 1, H); b.rect(hx, hy, 8, 2, H); b.rect(hx + 4, hy - 1, 3, 1, L); b.set(hx + 2, hy + 1, shade(s.skin, 0));
      } else if (dir === 'up') b.rect(hx, hy - 1, 8, 6, H);
      else { b.rect(hx + 1, hy - 1, 7, 3, H); b.rect(hx + 4, hy + 2, 4, 2, H); b.rect(hx + 2, hy - 1, 2, 1, L); }
    },
    cap(b, s, dir, hx, hy) {
      const C = s.accent || '#3f6fd0', D = shade(C, -0.3), H = s.hair;
      if (dir === 'down') { b.rect(hx, hy - 2, 8, 3, C); b.rect(hx - 1, hy + 1, 10, 1, D); b.rect(hx + 3, hy - 1, 2, 1, shade(C, 0.4)); b.set(hx, hy + 2, H); b.set(hx + 7, hy + 2, H); }
      else if (dir === 'up') { b.rect(hx, hy - 2, 8, 3, C); b.rect(hx, hy + 1, 8, 4, H); }
      else { b.rect(hx + 1, hy - 2, 7, 3, C); b.rect(hx - 2, hy + 1, 5, 1, D); b.rect(hx + 5, hy + 1, 3, 3, H); }
    },
    bandana(b, s, dir, hx, hy) {
      const C = s.accent || '#c0392b', D = shade(C, -0.3), H = s.hair;
      if (dir === 'down') { b.rect(hx, hy - 1, 8, 3, C); b.rect(hx, hy + 1, 8, 1, D); b.set(hx, hy + 2, H); b.set(hx + 7, hy + 2, H); }
      else if (dir === 'up') { b.rect(hx, hy - 1, 8, 4, C); b.rect(hx + 3, hy + 3, 2, 3, D); b.rect(hx, hy + 3, 8, 2, H); b.rect(hx + 3, hy + 3, 2, 3, D); }
      else { b.rect(hx + 1, hy - 1, 7, 3, C); b.rect(hx + 8, hy + 1, 2, 3, D); b.rect(hx + 5, hy + 2, 3, 2, H); }
    },
    bald(b, s, dir, hx, hy) {
      b.set(hx + (dir === 'down' ? 2 : 3), hy + 1, shade(s.skin, 0.45));
      if (s.hair && dir !== 'down') b.rect(hx + 4, hy + 3, 4, 2, s.hair);
      if (s.hair && dir === 'down') { b.set(hx, hy + 3, s.hair); b.set(hx + 7, hy + 3, s.hair); }
    },
    hat(b, s, dir, hx, hy) {
      const C = s.accent || '#5b2a86', D = shade(C, -0.3), F = '#f2c94c';
      const o = dir === 'down' || dir === 'up' ? 0 : 1;
      b.rect(hx + 1 + o, hy - 4, 6, 4, C); b.rect(hx + 1 + o, hy - 1, 6, 1, F);
      b.rect(hx - 3 + o, hy, 14 - o, 1, D); b.rect(hx - 2 + o, hy + 1, 12 - o, 1, C);
      b.rect(hx + 6 + o, hy - 6, 1, 3, '#e05a8a'); b.set(hx + 7 + o, hy - 7, '#e05a8a');
      if (s.hair) { if (dir === 'up') b.rect(hx, hy + 2, 8, 4, s.hair); else if (dir !== 'down') b.rect(hx + 5, hy + 2, 3, 3, s.hair); }
    },
    crown(b, s, dir, hx, hy) { // Null: a jagged absence where hair should be
      const H = s.hair, L = shade(H, 0.25);
      const o = dir === 'down' || dir === 'up' ? 0 : 1;
      for (let i = 0; i < 8 - o; i += 2) { b.rect(hx + i + o, hy - 3 + (i % 4 ? 1 : 0), 2, 4, H); }
      b.rect(hx + o, hy, 8 - o, 2, H); b.set(hx + 2 + o, hy - 2, L);
      if (dir === 'up') b.rect(hx, hy + 2, 8, 4, H);
    },
  };

  /* Key points for every facing and pose.  Arms are 2px wide (x is the left
     edge), hands land on the given point; legs are rects or limbs. */
  function humanoidBuf(s, dir, pose) {
    const b = new Buf(FW, FH);
    const B = BUILDS[s.build || 'normal'];
    const cx = 12;
    const skin = s.skin, skinS = shade(skin, -0.2), skinL = shade(skin, 0.2);
    const top = s.top, topS = shade(top, -0.25), topL = shade(top, 0.18);
    const pants = s.pants, pantsS = shade(pants, -0.22);
    const shoes = s.shoes || '#3a2a20', shoesL = shade(shoes, 0.25);
    const sleeve = s.sleeve === 'skin' ? skin : (s.sleeve || top);
    const sleeveRows = s.sleeveLen === undefined ? 99 : s.sleeveLen;
    const crouch = pose === 'charge' ? 1 : 0;
    const legTop = 30 - B.legH;
    const beltY = legTop - 1 + crouch;
    const torsoTop = beltY - B.th;
    const neckY = torsoTop - 1;
    const headTop = neckY - 8;
    const lean = pose === 'hurt' ? (dir === 'left' ? 1 : dir === 'right' ? -1 : 0) : 0;
    const walkF = pose === 'walk1' ? 1 : pose === 'walk2' ? 2 : 0;
    const hairF = walkF || (pose === 'hurt' ? 1 : 0);

    const arm = (sx, sy, hx, hy, far, fist) => {
      const c1 = far ? shade(sleeve, -0.25) : sleeve, c2 = far ? skinS : skin;
      const len = Math.max(Math.abs(hx - sx), Math.abs(hy - sy), 1);
      const split = Math.min(1, sleeveRows / len);
      b.limb(sx, sy, hx, hy, c1, 2, sleeveRows >= 99 ? null : c2, split);
      if (s.wrist) b.rect(hx, hy - (hy >= sy ? 1 : -1), 2, 1, s.wrist);
      const fz = fist ? 3 : 2;
      b.rect(hx - (fist ? (hx < sx ? 1 : 0) : 0), hy - (fist ? 1 : 0), fz, fz, far ? skinS : skin);
      if (s.gun && !far && !fist) b.rect(hx - 1, hy, 4, 2, '#6b7280');
    };

    if (s.cape && dir !== 'down') {
      const C = s.cape, D = shade(C, -0.3);
      if (dir === 'up') { b.rect(cx - B.tw / 2 - 1, torsoTop, B.tw + 2, B.th + 6, C); b.rect(cx - B.tw / 2 - 1, torsoTop + B.th + 5, B.tw + 2, 1, D); }
      else { const sw = walkF ? 1 : 0; b.rect(cx + 1, torsoTop, 4, B.th + 5, C); b.rect(cx + 4 + sw, torsoTop + 3, 2, B.th + 3, D); }
    }

    if (dir === 'down' || dir === 'up') {
      const tl = cx - B.tw / 2, tr = tl + B.tw - 1;
      // legs
      const liftL = walkF === 2 ? 1 : 0, liftR = walkF === 1 ? 1 : 0;
      if (pose === 'kick') {
        b.rect(B.legL, beltY + 1, B.legW, 29 - beltY, pants); b.rect(B.legL, 30, B.legW, 2, shoes);
        b.limb(B.legR, beltY + 1, B.legR + 5, beltY + 4, pants, B.legW);
        b.rect(B.legR + 5, beltY + 4, 3, 2, shoes);
      } else {
        const spread = crouch ? 1 : 0;
        b.rect(B.legL - spread, beltY + 1, B.legW, 30 - beltY - 1 - liftL, pants);
        b.rect(B.legR + spread, beltY + 1, B.legW, 30 - beltY - 1 - liftR, pants);
        b.rect(B.legL + B.legW - 1 - spread, beltY + 1, 1, 29 - beltY - liftL, pantsS);
        b.rect(B.legR + B.legW - 1 + spread, beltY + 1, 1, 29 - beltY - liftR, pantsS);
        b.rect(B.legL - spread, 30 - liftL, B.legW, 2, shoes); b.set(B.legL - spread, 30 - liftL, shoesL);
        b.rect(B.legR + spread, 30 - liftR, B.legW, 2, shoes); b.set(B.legR + spread, 30 - liftR, shoesL);
      }
      // coat tails
      if (s.coat) { b.rect(tl, beltY, 2, 4, top); b.rect(tr - 1, beltY, 2, 4, topS); if (dir === 'up') b.rect(tl, beltY, B.tw, 4, top); }
      if (s.robe) { b.rect(tl - 1, beltY, B.tw + 2, 29 - beltY, top); b.rect(tr, beltY, 2, 29 - beltY, topS); }
      // torso
      b.rect(tl, torsoTop, B.tw, B.th, top);
      b.rect(tr, torsoTop, 1, B.th, topS); b.rect(tl, torsoTop, 1, B.th, topL);
      if (dir === 'down' && s.under) { b.rect(cx - 1, torsoTop, 2, B.th - 1, s.under); if (s.coat) b.rect(cx - 2, torsoTop + 1, 4, B.th - 1, s.under); }
      if (dir === 'down' && s.apron) b.rect(tl + 1, torsoTop + 2, B.tw - 2, B.th + 2, s.apron);
      if (dir === 'down' && s.tie) b.rect(cx - 1, torsoTop, 1, B.th - 1, s.tie);
      b.rect(tl, beltY, B.tw, 1, s.belt || pantsS);
      if (s.belt && dir === 'down') b.set(cx - 1, beltY, shade(s.belt, 0.4));
      b.rect(cx - 1, neckY, 2, 1, skinS);
      // arms
      const sL = tl - 2, sR = tr + 1, sy = torsoTop;
      let hL = [sL, beltY + 1], hR = [sR, beltY + 1], fL = false, fR = false;
      if (walkF === 1) { hL = [sL, beltY]; hR = [sR, beltY + 2]; }
      if (walkF === 2) { hL = [sL, beltY + 2]; hR = [sR, beltY]; }
      if (dir === 'down') {
        if (pose === 'punch1') { hR = [cx + 1, beltY + 4]; fR = true; }
        if (pose === 'punch2') { hL = [cx - 3, beltY + 4]; fL = true; }
        if (pose === 'blast') { hL = [cx - 3, beltY + 2]; hR = [cx + 1, beltY + 2]; }
      } else {
        if (pose === 'punch1') { hR = [sR, headTop - 3]; fR = true; }
        if (pose === 'punch2') { hL = [sL, headTop - 3]; fL = true; }
        if (pose === 'blast') { hL = [cx - 3, headTop - 2]; hR = [cx + 1, headTop - 2]; }
      }
      if (pose === 'charge') { hL = [sL - 1, beltY - 1]; hR = [sR + 1, beltY - 1]; }
      if (pose === 'hurt') { hL = [sL - 2, torsoTop - 2]; hR = [sR + 2, torsoTop - 2]; }
      if (pose === 'kick') { hL = [sL - 1, torsoTop + 1]; hR = [sR + 1, torsoTop + 1]; }
      const armsAfterHead = dir === 'up' && (pose === 'punch1' || pose === 'punch2' || pose === 'blast');
      const drawArms = () => { arm(sL, sy, hL[0], hL[1], false, fL); arm(sR, sy, hR[0], hR[1], false, fR); };
      if (!armsAfterHead) drawArms();
      // head
      const hx = 8 + lean, hy = headTop;
      b.rect(hx, hy, 8, 8, skin);
      b.clear(hx, hy); b.clear(hx + 7, hy); b.clear(hx, hy + 7); b.clear(hx + 7, hy + 7);
      b.rect(hx + 7, hy + 1, 1, 6, skinS);
      b.set(hx - 1, hy + 4, skin); b.set(hx + 8, hy + 4, skinS);
      if (dir === 'down') {
        const ey = hy + 4;
        if (pose === 'hurt' || pose === 'ko') { b.rect(hx + 1, ey + 1, 2, 1, INK); b.rect(hx + 5, ey + 1, 2, 1, INK); }
        else {
          const ec = s.eyes || INK;
          b.rect(hx + 2, ey, 1, 2, ec); b.rect(hx + 5, ey, 1, 2, ec);
          if (s.glowEyes) { b.set(hx + 2, ey, '#ffffff'); b.set(hx + 5, ey, '#ffffff'); }
        }
        if (s.brows) { b.rect(hx + 1, ey - 1, 2, 1, s.brows); b.rect(hx + 5, ey - 1, 2, 1, s.brows); }
        if (s.blush) { b.set(hx + 1, ey + 2, s.blush); b.set(hx + 6, ey + 2, s.blush); }
        if (s.beard) { b.rect(hx + 1, hy + 6, 6, 2, s.beard); b.rect(hx + 2, hy + 8, 4, 1, s.beard); }
        if (s.glasses) { b.rect(hx + 1, ey - 1, 3, 3, s.glasses, true); b.rect(hx + 4, ey - 1, 3, 3, s.glasses, true); b.set(hx + 2, ey, INK); b.set(hx + 5, ey, INK); b.set(hx + 2, ey + 1, '#dfefff'); b.set(hx + 5, ey + 1, '#dfefff'); }
        if (s.monocle) { b.rect(hx + 4, ey - 1, 3, 3, s.monocle, true); b.set(hx + 5, ey, INK); b.set(hx + 5, ey + 1, '#dfefff'); b.set(hx + 7, ey + 2, s.monocle); }
        if (s.patch) { b.rect(hx + 1, ey - 1, 3, 3, INK); b.rect(hx, ey - 2, 8, 1, INK); }
        if (s.mask) { b.rect(hx, ey - 1, 8, 3, s.mask); b.set(hx + 2, ey, '#fff'); b.set(hx + 5, ey, '#fff'); }
      }
      if (s.hairStyle) HAIR[s.hairStyle](b, s, dir, hx, hy, hairF);
      if (armsAfterHead) drawArms();
    } else {
      // profile, drawn facing left
      const tl = cx - Math.floor(B.stw / 2);
      const hipX = cx - 1;
      const farC = shade(pants, -0.3);
      const shoe = (x, y, c) => { b.rect(x - 1, y, 4, 2, c); };
      if (pose === 'kick') {
        b.rect(hipX + 1, beltY + 1, 3, 29 - beltY, farC); shoe(hipX + 1, 30, shade(shoes, -0.2));
        b.limb(hipX, beltY + 1, hipX - 7, beltY + 2, pants, 3);
        b.rect(hipX - 10, beltY + 1, 3, 3, shoes);
      } else if (walkF) {
        const a = walkF === 1 ? -3 : 3;
        b.limb(hipX, beltY + 1, hipX - a, 29, farC, 3); shoe(hipX - a, 30, shade(shoes, -0.2));
        b.limb(hipX, beltY + 1, hipX + a, 29, pants, 3); shoe(hipX + a, 30, shoes);
      } else {
        const sp = crouch ? 2 : 0;
        b.rect(hipX + sp, beltY + 1, 3, 29 - beltY, farC); shoe(hipX + sp, 30, shade(shoes, -0.2));
        b.rect(hipX - sp, beltY + 1, 3, 29 - beltY, pants); shoe(hipX - sp, 30, shoes);
      }
      // far arm
      let far = [cx + 1, beltY + 1], near = [cx - 1, beltY + 1], fFar = false, fNear = false;
      if (walkF === 1) { far = [cx + 3, beltY]; near = [cx - 3, beltY]; }
      if (walkF === 2) { far = [cx - 3, beltY]; near = [cx + 3, beltY]; }
      if (pose === 'punch1') { near = [cx - 9, torsoTop + 2]; fNear = true; far = [cx + 2, torsoTop + 3]; }
      if (pose === 'punch2') { far = [cx - 8, torsoTop + 2]; fFar = true; near = [cx + 1, torsoTop + 3]; }
      if (pose === 'blast') { near = [cx - 8, torsoTop + 2]; far = [cx - 7, torsoTop + 1]; }
      if (pose === 'charge') { near = [cx + 2, beltY - 1]; far = [cx + 3, beltY - 2]; }
      if (pose === 'hurt') { near = [cx + 4, torsoTop - 1]; far = [cx + 5, torsoTop]; }
      if (pose === 'kick') { near = [cx + 3, torsoTop + 1]; far = [cx - 4, torsoTop]; }
      arm(cx, torsoTop, far[0], far[1], true, fFar);
      if (s.coat) { b.rect(tl, beltY, B.stw, 4, top); b.rect(tl + B.stw - 1, beltY, 1, 4, topS); }
      if (s.robe) b.rect(tl - 1, beltY, B.stw + 2, 29 - beltY, top);
      b.rect(tl + lean, torsoTop, B.stw, B.th, top);
      b.rect(tl + lean + B.stw - 1, torsoTop, 1, B.th, topS);
      if (s.under) b.rect(tl + lean, torsoTop, 1, B.th - 2, s.under);
      if (s.apron) b.rect(tl + lean - 1, torsoTop + 2, 2, B.th + 2, s.apron);
      b.rect(tl, beltY, B.stw, 1, s.belt || pantsS);
      b.rect(cx - 1 + lean, neckY, 2, 1, skinS);
      arm(cx - 1 + lean, torsoTop, near[0], near[1], false, fNear);
      // head
      const hx = 8 + lean, hy = headTop;
      b.rect(hx + 1, hy, 7, 8, skin);
      b.clear(hx + 1, hy); b.clear(hx + 7, hy); b.clear(hx + 1, hy + 7); b.clear(hx + 7, hy + 7);
      b.set(hx, hy + 4, skin); b.set(hx, hy + 5, skinS);
      b.set(hx + 5, hy + 4, skinS);
      const ey = hy + 4;
      if (pose === 'hurt') b.rect(hx + 1, ey + 1, 2, 1, INK);
      else { b.rect(hx + 2, ey, 1, 2, s.eyes || INK); if (s.glowEyes) b.set(hx + 2, ey, '#fff'); }
      if (s.brows) b.rect(hx + 1, ey - 1, 3, 1, s.brows);
      if (s.blush) b.set(hx + 2, ey + 2, s.blush);
      if (s.beard) { b.rect(hx + 1, hy + 6, 4, 2, s.beard); }
      if (s.glasses) { b.rect(hx + 1, ey - 1, 3, 3, s.glasses, true); b.set(hx + 2, ey, INK); b.set(hx + 2, ey + 1, '#dfefff'); b.rect(hx + 4, ey, 3, 1, s.glasses, true); }
      if (s.monocle) { b.rect(hx + 1, ey - 1, 3, 3, s.monocle, true); b.set(hx + 2, ey, INK); b.set(hx + 2, ey + 1, '#dfefff'); }
      if (s.patch) { b.rect(hx + 1, ey - 2, 7, 1, INK); }
      if (s.mask) { b.rect(hx + 1, ey - 1, 4, 3, s.mask); b.set(hx + 2, ey, '#fff'); }
      if (s.hairStyle) HAIR[s.hairStyle](b, s, 'left', hx, hy, hairF);
      if (s.cape) { b.rect(tl + lean + B.stw - 1, torsoTop, 2, 2, s.cape); }
    }
    return dir === 'right' ? null : b;
  }

  const POSES = ['idle', 'walk1', 'walk2', 'punch1', 'punch2', 'kick', 'blast', 'charge', 'hurt'];
  const DIRS = ['down', 'up', 'left', 'right'];

  /* A full sheet: sheet[dir][pose] = canvas, plus sheet.ko and sheet.face. */
  function person(spec, poses = POSES) {
    const sheet = { w: FW, h: FH, down: {}, up: {}, left: {}, right: {} };
    for (const pose of poses) {
      for (const dir of ['down', 'up', 'left']) {
        const b = humanoidBuf(spec, dir, pose);
        sheet[dir][pose] = b.toCanvas();
        if (dir === 'left') sheet.right[pose] = b.mirror().toCanvas();
      }
    }
    // knocked down: the front view, laid on its side
    const ko = canvas(FH, FW), kx = ko.getContext('2d');
    kx.translate(FH / 2, FW / 2); kx.rotate(-Math.PI / 2);
    kx.drawImage(humanoidBuf(spec, 'down', 'hurt').toCanvas(), -FW / 2, -FH / 2);
    sheet.ko = ko;
    // portrait: the head, cropped, scaled 2x for dialogue
    const B = BUILDS[spec.build || 'normal'];
    const headTop = (30 - B.legH - 1) - B.th - 9;
    const src = sheet.down.idle;
    const top = Math.max(0, headTop - 7);
    const face = canvas(16, 16), fx = face.getContext('2d');
    fx.drawImage(src, 4, top, 16, 16, 0, 0, 16, 16);
    sheet.face = face;
    sheet.headTop = top;
    return sheet;
  }

  /* ════════════════════════════════════════════════════════
     CREATURES
     ════════════════════════════════════════════════════════ */

  /* Each returns { w, h, frames: [canvas...], left: [...], right: [...] }.
     Side-on creatures are drawn facing left and mirrored. */
  function creature(w, h, draw, n = 2, sideOn = true) {
    const left = [], right = [];
    for (let f = 0; f < n; f++) {
      const b = new Buf(w, h);
      draw(b, f);
      left.push(b.toCanvas());
      right.push(sideOn ? b.mirror().toCanvas() : left[f]);
    }
    return { w, h, left, right, frames: left };
  }

  const CREATURES = {
    puddlet: (body = '#5fc98a') => creature(16, 14, (b, f) => {
      const D = shade(body, -0.3), L = shade(body, 0.35);
      const sq = f ? 1 : 0;
      b.ellipse(8, 9 + sq * 0.5, 6.5 + sq, 4.5 - sq * 0.5, body);
      b.rect(2 - sq, 11, 12 + sq * 2, 2, D);
      b.disc(5, 6 + sq, 1.4, L);
      b.rect(5, 8 + sq, 2, 2, '#ffffff'); b.rect(9, 8 + sq, 2, 2, '#ffffff');
      b.set(5, 9 + sq, INK); b.set(9, 9 + sq, INK);
    }),
    hare: (fur = '#d9b48a') => creature(16, 14, (b, f) => {
      const D = shade(fur, -0.3), L = shade(fur, 0.3);
      const y = f ? -1 : 0;
      b.ellipse(9, 9 + y, 5, 3.5, fur); b.rect(9, 12 + y, 5, 1, D);
      b.disc(4, 6 + y, 2.6, fur);
      b.rect(4, 0 + y, 2, 4, fur); b.rect(6, 1 + y, 2, 3, D); b.set(4, 1 + y, '#f2a0a8');
      b.set(3, 6 + y, INK); b.set(1, 7 + y, '#f2a0a8');
      b.disc(14, 8 + y, 1.5, '#ffffff');
      if (f) { b.rect(3, 12, 3, 1, D); b.rect(11, 12, 4, 1, D); } else { b.rect(5, 12, 2, 2, D); b.rect(11, 12, 2, 2, D); }
      b.rect(7, 7 + y, 3, 1, L);
    }),
    beetle: (shell = '#5a6ab0') => creature(18, 14, (b, f) => {
      const D = shade(shell, -0.35), L = shade(shell, 0.4);
      for (let i = 0; i < 3; i++) { const o = (i + f) % 2; b.rect(4 + i * 4, 10 + o, 1, 3, INK); b.rect(5 + i * 4, 1 - o, 1, 3, INK); }
      b.ellipse(10, 7, 6.5, 5, shell); b.rect(10, 2, 1, 10, D);
      b.disc(3.5, 7, 2.5, '#3a3048'); b.set(2, 6, '#ffd84a');
      b.rect(7, 4, 2, 1, L); b.rect(12, 4, 2, 1, L);
    }),
    imp: (body = '#e0503c') => creature(18, 18, (b, f) => {
      const D = shade(body, -0.3), W = '#5a2a48';
      if (f) { b.rect(1, 4, 5, 3, W); b.rect(12, 4, 5, 3, W); } else { b.rect(2, 7, 4, 4, W); b.rect(12, 7, 4, 4, W); }
      b.disc(9, 9, 4.5, body); b.rect(5, 12, 8, 1, D);
      b.rect(6, 3, 1, 3, '#f5e6c8'); b.rect(11, 3, 1, 3, '#f5e6c8');
      b.rect(7, 8, 1, 2, '#ffe14a'); b.rect(10, 8, 1, 2, '#ffe14a');
      b.rect(8, 11, 2, 1, INK);
      b.limb(9, 13, 13, 16, D, 1); b.set(14, 16, '#ffe14a');
    }, 2, false),
    hound: (body = '#7a2e2a') => creature(24, 16, (b, f) => {
      const D = shade(body, -0.35), M = '#ff8a3a', L = '#ffd04a';
      b.ellipse(13, 8, 7, 3.5, body);
      b.disc(5, 6, 3, body); b.rect(1, 6, 3, 2, body); b.set(1, 7, INK);
      b.set(5, 5, L);
      b.rect(6, 1, 2, 3, D);
      for (let i = 0; i < 5; i++) b.rect(7 + i * 2, 3 + ((i + f) % 2), 2, 2, i % 2 ? L : M);
      b.rect(19, 5 + f, 4, 2, M);
      const l = f ? 2 : 0;
      b.rect(8 - l, 11, 2, 4, D); b.rect(11 + l, 11, 2, 4, D); b.rect(15 - l, 11, 2, 4, D); b.rect(18 + l, 11, 2, 4, D);
    }),
    golemite: (stone = '#7d6a5c') => creature(18, 18, (b, f) => {
      const D = shade(stone, -0.3), L = shade(stone, 0.25);
      b.ellipse(9, 10 + f * 0.5, 7, 6 - f * 0.5, stone);
      b.rect(3, 6, 4, 3, L); b.rect(11, 13, 4, 2, D);
      b.rect(5, 9, 2, 2, '#ff9a3a'); b.rect(11, 9, 2, 2, '#ff9a3a');
      b.rect(0, 9 + f, 3, 4, stone); b.rect(15, 9 + f, 3, 4, stone);
    }, 2, false),
    wraith: (paper = '#ece6d4') => creature(16, 20, (b, f) => {
      const D = shade(paper, -0.2);
      b.rect(3, 2, 10, 14, paper); b.rect(4, 1, 8, 1, paper);
      for (let x = 3; x < 13; x++) b.set(x, 16 + ((x + f) % 2), paper);
      b.rect(11, 3, 2, 13, D);
      for (let y = 9; y < 15; y += 2) b.rect(5, y, 6, 1, '#9aa0b8');
      b.rect(5, 5, 2, 2, '#e8304a'); b.rect(9, 5, 2, 2, '#e8304a');
      b.rect(1, 6 + f, 2, 4, paper); b.rect(13, 6 - f, 2, 4, D);
    }, 2, false),
    chick: (c = '#f5d04a') => creature(10, 10, (b, f) => {  // Biscuit the kitten, in fact
      b.ellipse(5, 6, 3.5, 3, c); b.disc(3, 3.5, 2.2, c);
      b.set(1, 1, c); b.set(4, 1, c); b.set(2, 3, INK); b.set(4, 3, INK);
      b.rect(8, 3 + f, 1, 3, c);
      b.rect(5, 6, 2, 1, shade(c, -0.2));
    }),
  };

  /* Bosses that aren't people */
  function warden() {
    return creature(40, 44, (b, f) => {
      const S = '#8a8070', D = shade(S, -0.35), L = shade(S, 0.25), E = f === 2 ? '#ffffff' : '#ff8a2a';
      const up = f === 2 ? -8 : 0;
      b.rect(10, 38, 8, 6, D); b.rect(22, 38, 8, 6, D);
      b.rect(8, 16, 24, 23, S); b.rect(8, 16, 3, 23, L); b.rect(29, 16, 3, 23, D);
      b.rect(12, 26, 16, 2, '#ff8a2a'); b.rect(19, 18, 2, 14, D);
      b.rect(12, 4, 16, 13, S); b.rect(12, 4, 16, 2, L); b.rect(26, 6, 2, 11, D);
      b.rect(15, 9, 3, 2, E); b.rect(22, 9, 3, 2, E);
      b.rect(15, 13, 10, 1, D);
      b.rect(0, 14 + up, 8, 12, S); b.rect(32, 14 + up, 8, 12, S);
      b.rect(0, 26 + up, 8, 6, D); b.rect(32, 26 + up, 8, 6, D);
      b.rect(1, 15 + up, 2, 10, L);
      if (f === 1) { b.rect(14, 2, 2, 2, '#ffb85a'); b.rect(24, 1, 2, 2, '#ffb85a'); }
    }, 3, false);
  }
  function robot() {
    return creature(30, 30, (b, f) => {
      const M = '#c8ccd8', D = shade(M, -0.35), A = '#f5c242', V = '#3ad0ff';
      b.rect(2, 22, 26, 7, '#4a4e5c'); for (let i = 0; i < 6; i++) b.rect(3 + i * 4 + (f ? 2 : 0), 24, 2, 3, '#2a2c36');
      b.rect(5, 10, 20, 13, M); b.rect(5, 10, 20, 2, shade(M, 0.3)); b.rect(23, 10, 2, 13, D);
      b.rect(9, 14, 12, 5, '#2a2c36'); b.rect(10, 15, 3, 1, A); b.rect(14, 16, 3, 1, '#ff5a5a'); b.rect(18, 15, 2, 2, V);
      b.ellipse(15, 7, 7, 5, M); b.rect(10, 6, 10, 3, '#1a1a2a'); b.rect(11 + f * 4, 7, 4, 1, V);
      b.rect(14, 0, 2, 3, D); b.disc(15, 0.5, 1.3, f ? '#ff5a5a' : A);
      b.rect(0, 12, 5, 4, D); b.rect(25, 12, 5, 4, D); b.rect(0, 16, 3, 5, A); b.rect(27, 16, 3, 5, A);
    }, 2, false);
  }
  function stamp() {
    const b = new Buf(20, 22);
    b.rect(8, 0, 4, 8, '#6a3a20'); b.rect(7, 0, 6, 2, '#8a5a30');
    b.rect(3, 8, 14, 4, '#c0303a'); b.rect(3, 8, 14, 1, '#e05a5a');
    b.rect(2, 12, 16, 8, '#3a2a40'); b.rect(2, 19, 16, 2, '#e0303a');
    return b.toCanvas();
  }

  /* ════════════════════════════════════════════════════════
     PROPS
     ════════════════════════════════════════════════════════ */

  function tree(seed, leaf = '#3f9a45', kind = 'round') {
    const b = new Buf(32, 40);
    const L = shade(leaf, 0.25), D = shade(leaf, -0.32), DD = shade(leaf, -0.5);
    const trunk = '#7a4f2e', trunkD = shade(trunk, -0.3);
    if (kind === 'dead') {
      b.rect(14, 18, 4, 21, '#5a4a44'); b.rect(17, 18, 1, 21, '#3a2e2c');
      b.limb(15, 22, 7, 12, '#5a4a44', 2); b.limb(16, 20, 25, 9, '#5a4a44', 2); b.limb(15, 18, 13, 5, '#5a4a44', 2);
      b.limb(8, 13, 4, 10, '#5a4a44', 1); b.limb(24, 10, 28, 6, '#5a4a44', 1);
      return b.toCanvas();
    }
    if (kind === 'pine') {
      b.rect(14, 32, 4, 7, trunk); b.rect(17, 32, 1, 7, trunkD);
      for (let i = 0; i < 4; i++) { const w = 6 + i * 3; b.rect(16 - w, 4 + i * 7, w * 2, 6, i % 2 ? leaf : D); b.rect(16 - w + 2, 4 + i * 7, w - 2, 1, L); }
      b.rect(15, 1, 2, 4, leaf);
      return b.toCanvas();
    }
    b.rect(13, 28, 6, 11, trunk); b.rect(17, 28, 2, 11, trunkD); b.rect(12, 37, 8, 2, trunkD);
    const blobs = [[16, 16, 11], [9, 19, 7], [23, 19, 7], [12, 9, 7], [20, 9, 7], [16, 22, 8]];
    for (const [x, y, r] of blobs) b.disc(x, y, r, D);
    for (const [x, y, r] of blobs) b.disc(x - 1, y - 1, r - 1.5, leaf);
    for (let i = 0; i < 18; i++) {
      const x = 6 + Math.floor(hash(i, seed, 3) * 20), y = 4 + Math.floor(hash(seed, i, 7) * 18);
      if (b.get(x, y) === leaf) { b.set(x, y, L); if (hash(x, y, 1) > 0.5) b.set(x + 1, y, L); }
    }
    for (let x = 0; x < 32; x++) for (let y = 22; y < 31; y++) if (b.get(x, y) === leaf && hash(x, y, seed) > 0.55) b.set(x, y, D);
    for (let x = 0; x < 32; x++) { for (let y = 39; y > 20; y--) if (b.get(x, y) === D) { if (hash(x, y) > 0.4) b.set(x, y, DD); break; } }
    return b.toCanvas();
  }

  function house(wt, ht, roof = '#c4513f', wall = '#efe0c0') {
    const W = wt * 16, H = ht * 16 + 8;
    const b = new Buf(W, H);
    const R = roof, RD = shade(roof, -0.3), RL = shade(roof, 0.25);
    const WD = shade(wall, -0.18);
    const roofH = Math.floor(H * 0.52);
    // walls
    b.rect(2, roofH - 2, W - 4, H - roofH + 2, wall);
    b.rect(W - 6, roofH - 2, 4, H - roofH + 2, WD);
    b.rect(2, H - 3, W - 4, 3, shade(wall, -0.35));
    for (let x = 4; x < W - 4; x += 8) b.rect(x, roofH, 1, H - roofH - 3, WD);
    // roof: tiles in rows
    for (let y = 0; y < roofH; y++) {
      const inset = Math.max(0, 6 - y);
      for (let x = inset; x < W - inset; x++) {
        let c = (y % 4 === 3) ? RD : R;
        if (y % 4 !== 3 && ((x + (Math.floor(y / 4) % 2) * 4) % 8 === 0)) c = RD;
        if (y < 2) c = RL;
        b.set(x, y, c);
      }
    }
    b.rect(0, roofH - 2, W, 2, RD);
    // door and windows
    const dx = Math.floor(W / 2) - 5;
    b.rect(dx, H - 17, 10, 14, '#6a4028'); b.rect(dx + 1, H - 16, 8, 13, '#8a5634'); b.set(dx + 7, H - 10, '#f2c94c');
    b.rect(dx - 1, H - 18, 12, 1, shade(wall, -0.4));
    const win = (x) => { b.rect(x, roofH + 3, 10, 8, '#5a4030'); b.rect(x + 1, roofH + 4, 8, 6, '#9ad4f0'); b.rect(x + 1, roofH + 4, 3, 2, '#e4f6ff'); b.rect(x + 5, roofH + 4, 1, 6, '#5a4030'); b.rect(x, roofH + 11, 10, 1, '#7a5a3a'); };
    if (W >= 64) { win(8); win(W - 20); } else win(6);
    // chimney
    b.rect(W - 18, -0, 6, 8, '#8a7a72'); b.rect(W - 18, 0, 6, 2, '#a8988e');
    return b.toCanvas(false);
  }

  function propCanvases() {
    const P = {};
    const mk = (w, h, fn, outline = true) => { const b = new Buf(w, h); fn(b); return b.toCanvas(outline); };
    P.bush = mk(16, 13, (b) => { b.ellipse(8, 7, 7, 5.5, '#2f7a38'); b.ellipse(7, 6, 5, 4, '#3f9a45'); b.set(5, 4, '#6cc060'); b.set(9, 5, '#6cc060'); b.set(11, 7, '#6cc060'); });
    P.rock = mk(16, 13, (b) => { b.ellipse(8, 7, 7, 5, '#8a8790'); b.ellipse(7, 6, 5, 3.5, '#a6a3ad'); b.rect(10, 9, 4, 2, '#6a6772'); b.set(5, 5, '#c8c6ce'); });
    P.boulder = mk(16, 16, (b) => {
      b.ellipse(8, 9, 7.5, 6.5, '#9a8a7a'); b.ellipse(7, 8, 6, 5, '#b4a492'); b.rect(9, 12, 5, 2, '#7a6a5a');
      b.limb(5, 4, 8, 9, '#4a3a30', 1); b.limb(8, 9, 6, 13, '#4a3a30', 1); b.limb(8, 9, 12, 7, '#4a3a30', 1); b.set(5, 6, '#dcd0c0');
    });
    P.brambles = mk(16, 16, (b) => {
      for (let i = 0; i < 14; i++) { const a = i * 2.4, r = 3 + (i % 3) * 2; b.limb(8, 10, 8 + Math.cos(a) * r, 9 + Math.sin(a) * r * 0.8, i % 2 ? '#6a3a5a' : '#4a2a40', 1); }
      b.ellipse(8, 10, 5, 4, '#5a2f4c');
      for (let i = 0; i < 8; i++) b.set(3 + (i * 5) % 11, 4 + (i * 3) % 10, '#e8d0e0');
      b.set(6, 8, '#9a4a7a'); b.set(10, 11, '#9a4a7a');
    });
    P.sign = mk(14, 16, (b) => { b.rect(6, 8, 2, 8, '#6a4a2a'); b.rect(1, 2, 12, 8, '#a8743e'); b.rect(1, 2, 12, 1, '#c89458'); b.rect(3, 4, 8, 1, '#5a3a20'); b.rect(3, 6, 6, 1, '#5a3a20'); });
    P.chest = mk(14, 12, (b) => { b.rect(1, 3, 12, 8, '#a8642e'); b.rect(1, 1, 12, 4, '#c47a3a'); b.rect(1, 5, 12, 1, '#6a3a1a'); b.rect(6, 4, 2, 3, '#f2c94c'); b.rect(1, 1, 1, 10, '#f2c94c'); b.rect(12, 1, 1, 10, '#f2c94c'); });
    P.chestOpen = mk(14, 12, (b) => { b.rect(1, 5, 12, 6, '#a8642e'); b.rect(1, 0, 12, 4, '#6a3a1a'); b.rect(2, 5, 10, 2, '#2a1a10'); b.rect(1, 5, 1, 6, '#f2c94c'); b.rect(12, 5, 1, 6, '#f2c94c'); });
    P.fenceH = mk(16, 12, (b) => { b.rect(1, 2, 3, 10, '#a8743e'); b.rect(12, 2, 3, 10, '#a8743e'); b.rect(0, 4, 16, 2, '#c89458'); b.rect(0, 8, 16, 2, '#a8743e'); });
    P.fenceV = mk(8, 16, (b) => { b.rect(2, 0, 4, 16, '#a8743e'); b.rect(2, 0, 1, 16, '#c89458'); });
    P.dummy = mk(14, 22, (b) => { b.rect(6, 12, 2, 10, '#6a4a2a'); b.rect(2, 9, 10, 2, '#8a5a30'); b.ellipse(7, 12, 4, 5, '#e0c070'); b.disc(7, 5, 3.5, '#e0c070'); b.rect(5, 4, 1, 1, INK); b.rect(8, 4, 1, 1, INK); b.rect(3, 12, 8, 1, '#c03a30'); });
    P.crate = mk(14, 14, (b) => { b.rect(1, 1, 12, 12, '#b07a40'); b.rect(1, 1, 12, 1, '#d09a58'); b.limb(2, 2, 11, 11, '#7a5228', 1); b.limb(11, 2, 2, 11, '#7a5228', 1); b.rect(1, 12, 12, 1, '#7a5228'); });
    P.board = mk(26, 22, (b) => { b.rect(3, 12, 2, 10, '#6a4a2a'); b.rect(21, 12, 2, 10, '#6a4a2a'); b.rect(1, 1, 24, 14, '#8a5a30'); b.rect(2, 2, 22, 12, '#c8a070'); for (let i = 0; i < 4; i++) { b.rect(3 + i * 5, 3 + (i % 2), 4, 5, '#f4ecd8'); b.rect(4 + i * 5, 5 + (i % 2), 2, 1, '#8a8a8a'); } b.rect(3, 10, 6, 3, '#f4ecd8'); b.rect(15, 10, 7, 3, '#f4ecd8'); b.set(5, 3, '#e0303a'); });
    P.tent = mk(34, 26, (b) => { for (let y = 0; y < 22; y++) { const w = Math.floor(y * 0.75) + 2; b.rect(17 - w, y + 2, w * 2, 1, y % 5 === 0 ? '#8a6a3a' : '#c8a060'); } b.rect(17, 2, 1, 22, '#8a6a3a'); b.rect(13, 12, 8, 12, '#3a2a1a'); b.rect(16, 0, 2, 4, '#6a4a2a'); b.rect(18, 0, 6, 3, '#c0392b'); });
    P.pillar = mk(16, 36, (b) => { b.rect(2, 0, 12, 4, '#f4f0e6'); b.rect(3, 4, 10, 28, '#e6e0d2'); for (let x = 4; x < 13; x += 3) b.rect(x, 5, 1, 26, '#c8c0b0'); b.rect(2, 32, 12, 4, '#f4f0e6'); b.rect(12, 4, 1, 28, '#b8b0a0'); }, true);
    P.statue = mk(16, 30, (b) => { b.rect(2, 22, 12, 8, '#8a8a92'); b.rect(2, 22, 12, 2, '#a8a8b0'); b.rect(5, 10, 6, 12, '#a0a0aa'); b.disc(8, 7, 3.5, '#a0a0aa'); b.limb(5, 11, 1, 4, '#a0a0aa', 2); b.rect(0, 2, 3, 3, '#a0a0aa'); b.rect(10, 10, 1, 12, '#7a7a84'); });
    P.basalt = mk(16, 26, (b) => { b.rect(2, 6, 5, 20, '#3a3238'); b.rect(7, 2, 5, 24, '#4a4048'); b.rect(12, 9, 3, 17, '#2e282e'); b.rect(7, 2, 5, 2, '#6a5a64'); b.rect(2, 6, 5, 1, '#5a4a54'); b.rect(9, 10, 1, 6, '#ff7a2a'); });
    P.crystal = mk(14, 18, (b) => { b.limb(6, 17, 5, 3, '#9a5aff', 3); b.limb(8, 17, 11, 7, '#7a3adf', 2); b.limb(4, 17, 2, 9, '#7a3adf', 2); b.rect(6, 4, 1, 8, '#e0c8ff'); });
    P.bed = mk(18, 28, (b) => { b.rect(1, 0, 16, 28, '#8a5634'); b.rect(2, 2, 14, 6, '#f4f0e6'); b.rect(2, 8, 14, 18, '#4a7ac8'); b.rect(2, 8, 14, 2, '#6a9ae0'); b.rect(2, 26, 14, 1, '#6a4028'); });
    P.table = mk(26, 18, (b) => { b.rect(1, 2, 24, 10, '#a8743e'); b.rect(1, 2, 24, 2, '#c89458'); b.rect(3, 12, 2, 6, '#6a4a2a'); b.rect(21, 12, 2, 6, '#6a4a2a'); b.rect(6, 4, 5, 3, '#f4f0e6'); b.rect(15, 3, 4, 4, '#e0503c'); });
    P.plant = mk(12, 18, (b) => { b.rect(3, 11, 6, 6, '#b05a3a'); b.rect(3, 11, 6, 1, '#d07a5a'); b.disc(6, 7, 4, '#3f9a45'); b.disc(3, 5, 2, '#5cb85c'); b.disc(9, 4, 2, '#5cb85c'); });
    P.shelf = mk(24, 26, (b) => { b.rect(0, 0, 24, 26, '#7a4f2e'); for (let i = 0; i < 3; i++) { b.rect(2, 2 + i * 8, 20, 6, '#3a2418'); for (let j = 0; j < 6; j++) b.rect(3 + j * 3, 3 + i * 8, 2, 5, ['#c0392b', '#3a7ac8', '#e0a030', '#5ab05a'][(i + j) % 4]); } });
    P.stump = mk(16, 12, (b) => { b.ellipse(8, 7, 6, 4, '#7a4f2e'); b.ellipse(8, 5, 6, 3, '#c89a68'); b.ellipse(8, 5, 3, 1.5, '#a87a48'); });
    P.counter = mk(48, 22, (b) => { b.rect(0, 6, 48, 16, '#8a5634'); b.rect(0, 4, 48, 4, '#c89458'); for (let x = 2; x < 48; x += 8) b.rect(x, 9, 6, 11, '#6a4028'); b.rect(6, 0, 6, 5, '#f4f0e6'); b.rect(7, 1, 4, 2, '#e8c070'); b.rect(30, 1, 7, 4, '#e0503c'); b.rect(31, 0, 5, 1, '#f4f0e6'); });
    P.awning = mk(52, 18, (b) => { for (let x = 0; x < 52; x++) { const st = Math.floor(x / 6) % 2; b.rect(x, 0, 1, 12, st ? '#f4f0e6' : '#d8403a'); b.rect(x, 12, 1, 2 + (x % 6 < 3 ? 1 : 0), st ? '#e0d8c8' : '#a83028'); } b.rect(2, 13, 2, 5, '#6a4a2a'); b.rect(48, 13, 2, 5, '#6a4a2a'); b.disc(8, 16, 1.6, '#ffcc4a'); b.disc(44, 16, 1.6, '#ffcc4a'); }, true);
    P.gate = mk(16, 20, (b) => { b.rect(0, 0, 16, 20, '#5a4a3a'); for (let x = 1; x < 16; x += 3) b.rect(x, 0, 2, 20, '#8a6a4a'); b.rect(0, 4, 16, 2, '#3a2a1a'); b.rect(0, 14, 16, 2, '#3a2a1a'); });
    P.scallion = mk(10, 14, (b) => { b.rect(4, 0, 1, 9, '#5cc05a'); b.rect(6, 1, 1, 8, '#3fa04a'); b.rect(2, 2, 1, 7, '#7ad06a'); b.rect(2, 9, 6, 4, '#f4f0e6'); b.rect(3, 13, 4, 1, '#c8b890'); });
    P.cauldron = mk(18, 16, (b) => { b.ellipse(9, 10, 8, 5.5, '#3a3a44'); b.ellipse(9, 6, 7, 2.5, '#5a5a66'); b.ellipse(9, 6, 5.5, 1.6, '#e8c070'); b.rect(3, 14, 2, 2, '#2a2a30'); b.rect(13, 14, 2, 2, '#2a2a30'); });
    P.vending = mk(18, 30, (b) => { b.rect(1, 0, 16, 30, '#3a6ad0'); b.rect(1, 0, 16, 2, '#6a9af0'); b.rect(3, 3, 9, 18, '#1a2a4a'); for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) b.rect(4 + j * 4, 4 + i * 4, 3, 3, ['#e0503c', '#f2c94c', '#5ac05a', '#e0e0f0'][(i + j) % 4]); b.rect(13, 4, 3, 2, '#3ad0ff'); b.rect(13, 8, 3, 6, '#2a3a6a'); b.rect(3, 23, 12, 4, '#1a2a4a'); });
    P.bench = mk(28, 14, (b) => { b.rect(0, 2, 28, 3, '#a8743e'); b.rect(0, 6, 28, 4, '#c89458'); b.rect(2, 10, 2, 4, '#6a4a2a'); b.rect(24, 10, 2, 4, '#6a4a2a'); });
    P.lamp = mk(10, 30, (b) => { b.rect(4, 6, 2, 24, '#3a3a44'); b.rect(2, 28, 6, 2, '#2a2a30'); b.rect(1, 0, 8, 7, '#3a3a44'); b.rect(2, 1, 6, 5, '#ffe28a', true); });
    P.flag = mk(20, 30, (b) => { b.rect(2, 0, 2, 30, '#8a8a92'); b.rect(4, 1, 14, 9, '#3a5ad0'); b.rect(4, 1, 14, 2, '#6a8af0'); b.disc(11, 6, 2, '#f2c94c'); });
    return P;
  }

  /* Animated props: arrays of frames */
  function animatedProps() {
    const A = {};
    const frames = (n, w, h, fn, outline = true) => { const out = []; for (let f = 0; f < n; f++) { const b = new Buf(w, h); fn(b, f); out.push(b.toCanvas(outline)); } return out; };
    A.brazier = frames(3, 14, 22, (b, f) => {
      b.rect(5, 12, 4, 10, '#4a4048'); b.rect(3, 20, 8, 2, '#3a3238');
      b.rect(1, 8, 12, 5, '#6a5a64'); b.rect(1, 8, 12, 1, '#8a7a84'); b.rect(2, 12, 10, 1, '#3a3238');
      if (f > 0) { const g = f === 1 ? 0 : 1; b.disc(7, 5 - g, 3.5, '#ff7a2a', true); b.disc(7, 5 - g, 2, '#ffd84a', true); b.rect(6 + g, 0, 2, 2, '#ffd84a', true); b.set(4 - g, 3, '#ff7a2a', true); b.set(10, 2 + g, '#ff7a2a', true); }
    });
    A.campfire = frames(3, 16, 14, (b, f) => {
      b.limb(2, 12, 13, 9, '#6a4a2a', 2); b.limb(2, 9, 13, 12, '#7a5a3a', 2);
      b.disc(8, 7 - (f % 2), 3.5, '#ff7a2a', true); b.disc(8, 7 - (f % 2), 2, '#ffd84a', true); b.rect(7 + (f === 2 ? 1 : 0), 1, 2, 3, '#ff7a2a', true);
    });
    A.fountain = frames(3, 34, 30, (b, f) => {
      b.ellipse(17, 21, 16, 8, '#9a9aa8'); b.ellipse(17, 20, 13.5, 6, '#4a8ad8'); b.ellipse(17, 19, 12, 5, '#5c9be0');
      for (let i = 0; i < 6; i++) b.set(8 + i * 4, 19 + ((i + f) % 3) - 1, '#c8e8ff');
      b.rect(15, 6, 4, 14, '#b8b8c4'); b.rect(15, 6, 1, 14, '#d8d8e0'); b.ellipse(17, 6, 5, 2, '#b8b8c4');
      b.rect(16, 0 + f, 2, 5, '#a8d8ff', true); b.set(13 - f, 4 + f, '#a8d8ff', true); b.set(21 + f, 4 + f, '#a8d8ff', true);
    });
    A.barrier = frames(4, 16, 26, (b, f) => {
      b.rect(0, 20, 3, 6, '#5a5a6a'); b.rect(13, 20, 3, 6, '#5a5a6a'); b.rect(0, 0, 3, 3, '#5a5a6a'); b.rect(13, 0, 3, 3, '#5a5a6a');
      for (let y = 3; y < 20; y++) for (let x = 1; x < 15; x++) {
        const v = Math.sin((y + f * 2) * 0.9 + x * 0.3);
        if (v > 0.55) b.set(x, y, '#9af0ff', true); else if (v > 0.1 && (x + y + f) % 3 === 0) b.set(x, y, '#3ab0e0', true);
      }
    }, false);
    A.portal = frames(4, 32, 40, (b, f) => {
      b.ellipse(16, 36, 14, 4, '#3a2a5a');
      for (let r = 14; r > 0; r -= 2) { const c = ['#2a1050', '#5a2ad0', '#9a6aff', '#e0c8ff'][((r / 2) + f) % 4]; b.ellipse(16, 18, r * 0.75, r * 1.25, c, true); }
      b.disc(16, 18, 2, '#ffffff', true);
    }, false);
    A.shrineDoor = frames(2, 32, 34, (b, f) => {
      b.rect(0, 0, 32, 34, '#4a3a3a'); b.rect(0, 0, 32, 3, '#6a5454'); b.rect(2, 4, 28, 30, '#2a1e20');
      if (!f) { b.rect(4, 6, 24, 28, '#6a4a3a'); b.rect(15, 6, 2, 28, '#3a2a20'); b.disc(16, 16, 5, '#ff7a2a'); b.disc(16, 16, 3, '#3a2a20'); for (let i = 0; i < 3; i++) b.rect(6 + i * 9, 26, 3, 3, '#ffd84a'); }
    });
    return A;
  }

  /* ════════════════════════════════════════════════════════
     TERRAIN
     ════════════════════════════════════════════════════════ */

  /* Ground codes, one character per tile, used by maps.js:
       g grass   x deep grass   t flowers   d dirt     s sand
       w water   b bridge       f wood floor  r rock   a ash
       l lava    m marble       v void      c cliff    p plaza
       k wall (interior)       n carpet */
  const SOLID_GROUND = { w: 1, l: 1, v: 1, c: 1, k: 1, j: 1 };
  const SPREAD = { j: 0, g: 5, x: 6, t: 5, d: 2, s: 1, p: 3, r: 4, a: 2, m: 0, f: 0, n: 0, b: 0, w: 0, l: 0, v: 0, c: 0, k: 0 };

  function groundColor(t, px, py, ctxInfo) {
    const n = hash(px, py), m = smooth(px / 7, py / 7);
    switch (t) {
      case 'g': case 't': case 'x': {
        const dark = t === 'x';
        const base = dark ? ['#356f34', '#3c7a3a', '#2f6430'] : ['#58a443', '#4f9a3e', '#64b14c'];
        let c = m > 0.62 ? base[2] : m < 0.35 ? base[1] : base[0];
        if (n < 0.035) c = dark ? '#4f9446' : '#86cc62';
        else if (n > 0.975) c = dark ? '#28562a' : '#3f8534';
        if (t === 't') {
          const fx = Math.floor(px / 5), fy = Math.floor(py / 5);
          if (hash(fx, fy, 9) < 0.28) {
            const ox = Math.floor(hash(fx, fy, 2) * 3), oy = Math.floor(hash(fx, fy, 4) * 3);
            const lx = px - fx * 5 - ox, ly = py - fy * 5 - oy;
            const col = ['#f4f0e6', '#ffd84a', '#f07a9a', '#9ac8ff'][Math.floor(hash(fx, fy, 6) * 4)];
            if ((lx === 1 && ly >= 0 && ly <= 2) || (ly === 1 && lx >= 0 && lx <= 2)) c = lx === 1 && ly === 1 ? '#ffb02a' : col;
          }
        }
        return c;
      }
      case 'd': { let c = m > 0.6 ? '#d0aa70' : m < 0.35 ? '#bb9358' : '#c69f64'; if (n < 0.04) c = '#9c7a4a'; else if (n > 0.97) c = '#e2c48e'; return c; }
      case 's': { let c = m > 0.55 ? '#ecd9a0' : '#e2cc8e'; if (n < 0.03) c = '#c8b078'; return c; }
      case 'p': {
        const sx = px + (Math.floor(py / 6) % 2) * 4, bx = sx % 8, by = py % 6;
        if (bx === 0 || by === 0) return '#8a8580';
        const v = hash(Math.floor(sx / 8), Math.floor(py / 6), 5);
        return v > 0.66 ? '#b8b2a8' : v > 0.33 ? '#aaa49a' : '#c4beb4';
      }
      case 'w': {
        const deep = ctxInfo.waterDepth > 2;
        let c = deep ? '#2f66b8' : '#3a7ac8';
        const wv = (py + Math.round(Math.sin(px * 0.35 + py * 0.1) * 1.5));
        if (wv % 7 === 0 && hash(Math.floor(px / 4), py, 3) > 0.35) c = '#5c9be0';
        return c;
      }
      case 'b': {
        const vert = ctxInfo.bridgeVertical;
        const a = vert ? py : px, o = vert ? px : py;
        const lx = o % 16;
        if (lx < 2 || lx > 13) return '#6a4428';
        if (a % 5 === 0) return '#7a5232';
        return hash(Math.floor(a / 5), 0, 11) > 0.5 ? '#b07a44' : '#a06e3c';
      }
      case 'f': {
        const row = Math.floor(py / 4), off = (row % 2) * 7;
        if (py % 4 === 0) return '#7a4f2e';
        if ((px + off) % 14 === 0) return '#8a5a34';
        return hash(Math.floor((px + off) / 14), row, 2) > 0.5 ? '#c08a52' : '#b47e48';
      }
      case 'n': { const lx = px % 16, ly = py % 16; if (lx < 2 || ly < 2 || lx > 13 || ly > 13) return '#8a2a3a'; return (lx + ly) % 4 === 0 ? '#c84a5a' : '#b03a4a'; }
      case 'r': { let c = m > 0.6 ? '#5a4848' : m < 0.35 ? '#4a3a3c' : '#524244'; if (n < 0.05) c = '#3a2c2e'; else if (n > 0.975) c = '#7a6464'; return c; }
      case 'a': { let c = m > 0.55 ? '#6e6262' : '#665a5a'; if (n < 0.04) c = '#544848'; return c; }
      case 'l': {
        const v = smooth(px / 5, py / 5, 4);
        if (v > 0.68) return '#ffe14a';
        if (v > 0.52) return '#ff9a2a';
        return v > 0.3 ? '#e0502a' : '#c03a22';
      }
      case 'm': {
        const lx = px % 16, ly = py % 16;
        if (lx === 0 || ly === 0) return '#c8c0b4';
        const vein = Math.abs(Math.sin(px * 0.21 + py * 0.13 + smooth(px / 9, py / 9) * 4)) < 0.05;
        return vein ? '#d8d0c4' : (hash(Math.floor(px / 16), Math.floor(py / 16), 3) > 0.5 ? '#f2eee6' : '#ece6dc');
      }
      case 'v': {
        if (hash(px, py, 21) < 0.006) return '#e8e0ff';
        if (hash(px, py, 22) < 0.004) return '#9a8ae0';
        const v = smooth(px / 24, py / 24, 8);
        return v > 0.6 ? '#1e1640' : v < 0.3 ? '#110c24' : '#171030';
      }
      case 'c': {
        if (ctxInfo.face) {
          const fy = ctxInfo.ly;
          if (fy < 2) return '#8a7276';
          const strata = (px + Math.floor(smooth(px / 3, py / 9) * 4)) % 5;
          if (strata === 0) return '#2a1e22';
          return fy > 12 ? '#3a2c30' : '#4e3c40';
        }
        let c = m > 0.55 ? '#6e5a5c' : '#665254';
        if (n < 0.05) c = '#584648';
        return c;
      }
      case 'j': {
        const v = smooth(px / 6, py / 6, 31);
        return v > 0.6 ? '#1a1220' : v < 0.3 ? '#0c0810' : '#140e18';
      }
      case 'k': {
        if (ctxInfo.face) {
          const fy = ctxInfo.ly;
          if (fy >= 13) return '#6a4028';
          if (fy === 12) return '#8a5634';
          return (px % 8 === 0) ? '#c8a888' : (Math.floor(px / 4) % 2 ? '#e6d2b0' : '#dcc6a2');
        }
        return '#4a3028';
      }
    }
    return '#ff00ff';
  }

  /* Bake a ground layer.  Borders between ground types are ragged with noise
     where the higher-SPREAD type creeps over; water and void get banks. */
  function bakeGround(rows) {
    const H = rows.length, W = rows[0].length;
    const c = canvas(W * 16, H * 16), ctx = c.getContext('2d');
    const img = ctx.createImageData(W * 16, H * 16);
    const at = (x, y) => (x < 0 || y < 0 || x >= W || y >= H) ? rows[Math.max(0, Math.min(H - 1, y))][Math.max(0, Math.min(W - 1, x))] : rows[y][x];
    // water depth: distance to shore in tiles (capped), for shading
    const depth = [];
    for (let y = 0; y < H; y++) { depth.push([]); for (let x = 0; x < W; x++) {
      let d = 0;
      if (at(x, y) === 'w') { d = 4; for (let r = 1; r < 4; r++) { let shore = false; for (let j = -r; j <= r && !shore; j++) for (let i = -r; i <= r; i++) { const t = at(x + i, y + j); if (t !== 'w') { shore = true; break; } } if (shore) { d = r; break; } } }
      depth[y].push(d);
    } }
    const info = {};
    for (let py = 0; py < H * 16; py++) {
      const ty = py >> 4, ly = py & 15;
      for (let px = 0; px < W * 16; px++) {
        const tx = px >> 4, lx = px & 15;
        let t = rows[ty][tx];
        let ut = t; // the type actually drawn here
        // ragged borders
        if (lx < 4 || lx > 11 || ly < 4 || ly > 11) {
          const nb = [];
          if (lx < 4) nb.push([at(tx - 1, ty), lx]);
          if (lx > 11) nb.push([at(tx + 1, ty), 15 - lx]);
          if (ly < 4) nb.push([at(tx, ty - 1), ly]);
          if (ly > 11) nb.push([at(tx, ty + 1), 15 - ly]);
          for (const [o, d] of nb) {
            if (o !== t && SPREAD[o] > SPREAD[t] && !SOLID_GROUND[o] && !SOLID_GROUND[t] && t !== 'b' && t !== 'f' && t !== 'm' && t !== 'n') {
              const thr = (d + 0.5) / 4.2;
              if (smooth(px / 2.3, py / 2.3, 17) * 0.7 + hash(px, py, 5) * 0.3 > thr + 0.15) { ut = o; break; }
            }
          }
        }
        info.waterDepth = depth[ty][tx];
        info.bridgeVertical = t === 'b' && (at(tx - 1, ty) === 'w' || at(tx + 1, ty) === 'w' || at(tx - 1, ty) === 'l' || at(tx + 1, ty) === 'l' || at(tx - 1, ty) === 'v');
        info.face = (t === 'c' || t === 'k') && at(tx, ty + 1) !== t;
        info.ly = ly;
        let col = groundColor(ut, px, py, info);
        // banks: land next to water / lava / void
        const solidish = (q) => q === 'w' || q === 'l' || q === 'v';
        if (!solidish(t) && t !== 'b' && t !== 'c' && t !== 'k') {
          const nearS = (ly === 15 && solidish(at(tx, ty + 1)));
          if (nearS && at(tx, ty + 1) === 'v') col = '#2a2238';
        }
        if (t === 'w') {
          const land = (dx, dy) => { const q = at(tx + dx, ty + dy); return q !== 'w'; };
          if ((ly < 2 && land(0, -1)) || (lx < 1 && land(-1, 0)) || (lx > 14 && land(1, 0))) col = '#a8d8f0';
          else if ((ly < 4 && land(0, -1))) col = '#2a5aa0';
          if (ly > 13 && land(0, 1)) col = '#a8d8f0';
        }
        if (t === 'l') {
          const land = (dx, dy) => at(tx + dx, ty + dy) !== 'l';
          if ((ly < 2 && land(0, -1)) || (lx < 2 && land(-1, 0)) || (lx > 13 && land(1, 0)) || (ly > 13 && land(0, 1))) col = '#5a2a22';
        }
        if (t === 'v' && ly < 5 && at(tx, ty - 1) !== 'v') col = ly < 4 ? (at(tx, ty - 1) === 'm' ? '#9a92a0' : '#3a2e40') : '#110c24';
        if (t === 'm' && ctxEdge(at, tx, ty, lx, ly)) col = '#b4aca0';
        const i = (py * W * 16 + px) * 4;
        const [r, g, b] = rgb(col);
        img.data[i] = r; img.data[i + 1] = g; img.data[i + 2] = b; img.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }
  function ctxEdge(at, tx, ty, lx, ly) {
    return (lx === 0 && at(tx - 1, ty) === 'v') || (lx === 15 && at(tx + 1, ty) === 'v') || (ly === 0 && at(tx, ty - 1) === 'v');
  }

  /* ── small shared bits ──────────────────────────────────── */
  function shadow(w) {
    const h = Math.max(3, Math.round(w * 0.36));
    const c = canvas(w, h), x = c.getContext('2d');
    const b = new Buf(w, h);
    b.ellipse((w - 1) / 2, (h - 1) / 2, w / 2, h / 2, '#000000');
    x.globalAlpha = 0.3;
    x.drawImage(b.toCanvas(false), 0, 0);
    return c;
  }

  return {
    Buf, canvas, shade, mix, hash, smooth, flash, tint,
    person, CREATURES, warden, robot, stamp, tree, house, propCanvases, animatedProps,
    bakeGround, shadow, SOLID_GROUND, FW, FH, POSES,
  };
})();
