/* SKYBREAKER — sound.

   A four-voice chip in WebAudio: two pulse leads, a triangle bass and a noise
   drum.  Songs are a chord progression plus a hand-written melody, one token
   per eighth note; the bass line and the drums are derived from the chords
   and a pattern, so a new song is a few lines.  Nothing plays until the
   first keypress, as browsers require. */
'use strict';

const AUDIO = (() => {
  let ac = null, master, musicBus, sfxBus, pulse25, pulse12, noiseBuf;
  let musicOn = true;
  try { musicOn = localStorage.getItem('skybreaker.music') !== 'off'; } catch (e) { /* storage blocked */ }

  function init() {
    if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ac = new AC();
    master = ac.createGain(); master.gain.value = 0.55; master.connect(ac.destination);
    musicBus = ac.createGain(); musicBus.gain.value = musicOn ? 0.32 : 0; musicBus.connect(master);
    sfxBus = ac.createGain(); sfxBus.gain.value = 0.6; sfxBus.connect(master);
    pulse25 = pulseWave(0.25); pulse12 = pulseWave(0.125);
    noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    if (pending) { const p = pending; pending = null; play(p); }
  }
  function pulseWave(duty) {
    const n = 40, re = new Float32Array(n), im = new Float32Array(n);
    for (let k = 1; k < n; k++) im[k] = (2 / (k * Math.PI)) * Math.sin(k * Math.PI * duty);
    return ac.createPeriodicWave(re, im);
  }

  const NOTE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  function midi(tok) {
    const m = /^([A-G])([#b]?)(\d)$/.exec(tok);
    if (!m) return null;
    return 12 * (+m[3] + 1) + NOTE[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
  }
  const freq = (n) => 440 * Math.pow(2, (n - 69) / 12);

  function voice(type, f, t, dur, vol, bus, opts = {}) {
    const o = ac.createOscillator(), g = ac.createGain();
    if (type === 'p25') o.setPeriodicWave(pulse25);
    else if (type === 'p12') o.setPeriodicWave(pulse12);
    else o.type = type;
    o.frequency.setValueAtTime(f, t);
    if (opts.f1) o.frequency.exponentialRampToValueAtTime(Math.max(20, opts.f1), t + dur);
    if (opts.vib) { const l = ac.createOscillator(), lg = ac.createGain(); l.frequency.value = 5.5; lg.gain.value = f * 0.012; l.connect(lg); lg.connect(o.frequency); l.start(t + 0.12); l.stop(t + dur + 0.05); }
    const a = opts.attack || 0.005;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + a);
    if (opts.sustain) g.gain.setValueAtTime(vol * 0.8, t + dur * 0.7);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(bus);
    o.start(t); o.stop(t + dur + 0.02);
  }
  function noise(t, dur, vol, bus, hp = 1000, f1 = null) {
    const s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    s.buffer = noiseBuf;
    f.type = 'bandpass'; f.frequency.setValueAtTime(hp, t); f.Q.value = 0.8;
    if (f1) f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(bus);
    s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
  }

  /* ── effects ─────────────────────────────────────────── */
  const SFX = {
    punch: (t) => { noise(t, 0.06, 0.5, sfxBus, 1800); voice('square', 180, t, 0.05, 0.12, sfxBus, { f1: 90 }); },
    hit: (t) => { noise(t, 0.1, 0.6, sfxBus, 900, 300); voice('square', 140, t, 0.09, 0.2, sfxBus, { f1: 50 }); },
    heavy: (t) => { noise(t, 0.22, 0.8, sfxBus, 700, 120); voice('square', 110, t, 0.2, 0.25, sfxBus, { f1: 35 }); },
    whiff: (t) => noise(t, 0.05, 0.18, sfxBus, 3000, 1200),
    blast: (t) => { voice('p25', 900, t, 0.14, 0.14, sfxBus, { f1: 220 }); noise(t, 0.08, 0.2, sfxBus, 2500); },
    special: (t) => { voice('p25', 300, t, 0.4, 0.16, sfxBus, { f1: 1200 }); voice('square', 150, t, 0.4, 0.1, sfxBus, { f1: 600 }); noise(t, 0.4, 0.35, sfxBus, 600, 3000); },
    beam: (t) => { voice('sawtooth', 120, t, 0.6, 0.12, sfxBus, { f1: 160 }); noise(t, 0.6, 0.3, sfxBus, 1500, 800); },
    charge: (t) => voice('p12', 200, t, 0.5, 0.08, sfxBus, { f1: 900 }),
    ready: (t) => { voice('p25', 1200, t, 0.06, 0.1, sfxBus); voice('p25', 1600, t + 0.06, 0.08, 0.1, sfxBus); },
    boom: (t) => { noise(t, 0.5, 0.9, sfxBus, 500, 60); voice('square', 90, t, 0.45, 0.25, sfxBus, { f1: 30 }); },
    hurt: (t) => { voice('square', 420, t, 0.16, 0.18, sfxBus, { f1: 120 }); noise(t, 0.1, 0.3, sfxBus, 1200); },
    die: (t) => { noise(t, 0.3, 0.4, sfxBus, 1500, 200); voice('p25', 600, t, 0.3, 0.12, sfxBus, { f1: 80 }); },
    coin: (t) => { voice('p25', 1320, t, 0.06, 0.1, sfxBus); voice('p25', 1760, t + 0.06, 0.12, 0.1, sfxBus); },
    item: (t) => { [523, 659, 784, 1047].forEach((f, i) => voice('p25', f, t + i * 0.07, 0.12, 0.1, sfxBus)); },
    level: (t) => { [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => voice('p25', f, t + i * 0.08, 0.14, 0.12, sfxBus)); voice('triangle', 131, t, 0.6, 0.2, sfxBus); },
    blip: (t) => voice('p25', 880, t, 0.04, 0.08, sfxBus),
    select: (t) => { voice('p25', 660, t, 0.05, 0.1, sfxBus); voice('p25', 990, t + 0.05, 0.07, 0.1, sfxBus); },
    back: (t) => voice('p25', 440, t, 0.07, 0.08, sfxBus, { f1: 300 }),
    deny: (t) => { voice('square', 160, t, 0.12, 0.12, sfxBus); voice('square', 120, t + 0.1, 0.16, 0.12, sfxBus); },
    text: (t) => voice('p12', 600 + Math.random() * 60, t, 0.025, 0.04, sfxBus),
    burn: (t) => noise(t, 0.4, 0.4, sfxBus, 3000, 500),
    crack: (t) => { noise(t, 0.3, 0.8, sfxBus, 400, 100); voice('square', 70, t, 0.2, 0.2, sfxBus, { f1: 40 }); },
    light: (t) => { noise(t, 0.3, 0.3, sfxBus, 2000, 4000); voice('p25', 500, t, 0.3, 0.08, sfxBus, { f1: 1000 }); },
    stamp: (t) => { noise(t, 0.12, 0.9, sfxBus, 300, 80); voice('square', 60, t, 0.15, 0.3, sfxBus); },
    warp: (t) => { voice('sine', 200, t, 0.5, 0.2, sfxBus, { f1: 1600 }); voice('p12', 400, t, 0.5, 0.06, sfxBus, { f1: 3200 }); },
    door: (t) => { noise(t, 0.12, 0.3, sfxBus, 500); voice('triangle', 200, t, 0.1, 0.2, sfxBus, { f1: 120 }); },
    heal: (t) => { [784, 988, 1175, 1568].forEach((f, i) => voice('sine', f, t + i * 0.06, 0.2, 0.12, sfxBus)); },
    transform: (t) => { voice('sawtooth', 80, t, 1.2, 0.15, sfxBus, { f1: 400 }); noise(t, 1.2, 0.5, sfxBus, 300, 4000); [523, 659, 784, 1047].forEach((f, i) => voice('p25', f, t + 0.6 + i * 0.08, 0.3, 0.1, sfxBus)); },
    scouter: (t) => { voice('p12', 1800, t, 0.04, 0.06, sfxBus); voice('p12', 2400, t + 0.05, 0.04, 0.06, sfxBus); voice('p12', 3000, t + 0.1, 0.06, 0.05, sfxBus); },
    step: (t) => noise(t, 0.03, 0.06, sfxBus, 600),
    reflect: (t) => voice('p25', 1800, t, 0.12, 0.12, sfxBus, { f1: 600 }),
  };
  function sfx(name) {
    if (!ac) return;
    const f = SFX[name];
    if (f) f(ac.currentTime + 0.005);
  }

  /* ── music ───────────────────────────────────────────── */
  const SONGS = {
    title: { bpm: 96, drums: 'k...s...k.k.s...', chords: 'C Am F G C Am F G', lead: 'p25',
      mel: 'G4 . C5 . E5 - D5 C5 | E5 - - . A4 - C5 . | F5 . E5 . D5 . C5 . | D5 - - - G4 - - - | G4 . C5 . E5 - G5 E5 | A5 - - . G5 - E5 . | F5 . A5 . G5 . F5 . | G5 - - - - - - -' },
    village: { bpm: 112, drums: 'k.h.s.h.k.hks.h.', chords: 'C G Am F C G F G', lead: 'p25',
      mel: 'E5 . G5 . C6 - B5 A5 | G5 - - . D5 . G5 . | A5 . C6 . E6 - D6 C6 | C6 - A5 . F5 . A5 . | G5 . E5 . G5 . C6 . | B5 - A5 . G5 . D5 . | F5 . A5 . C6 . A5 . | G5 - - - . . . .' },
    fields: { bpm: 132, drums: 'k.hhs.hhk.hks.hh', chords: 'G D Em C G D C D', lead: 'p25',
      mel: 'D5 . G5 . A5 . B5 . | A5 - F#5 . D5 . A5 . | B5 . G5 . E5 . B5 . | C6 - B5 . A5 . G5 . | D6 . B5 . G5 . B5 . | A5 . F#5 . A5 . D6 . | E6 - D6 . C6 . B5 . | A5 - - - D5 . F#5 .' },
    peaks: { bpm: 100, drums: 'k...s..kk...s.h.', chords: 'Dm Bb C A Dm Bb Gm A', lead: 'p12',
      mel: 'D5 - - F5 E5 - D5 . | F5 - - D5 Bb4 - . . | C5 - E5 - G5 - E5 . | C#5 - - - A4 - . . | D5 . F5 . A5 - G5 F5 | Bb5 - A5 . F5 . D5 . | G5 - F5 . E5 . D5 . | E5 - - - C#5 - . .' },
    battle: { bpm: 150, drums: 'k.hks.hkk.hks.hs', chords: 'Am F G E Am F G E', lead: 'p25',
      mel: 'A5 . A5 C6 . A5 E6 . | F5 . F5 A5 . C6 A5 . | G5 . G5 B5 . D6 B5 G5 | G#5 - B5 - E6 - D6 B5 | C6 . B5 A5 . E5 A5 . | C6 . D6 C6 . A5 F5 . | D6 . E6 D6 . B5 G5 . | E6 - - - G#5 - B5 -' },
    arena: { bpm: 140, drums: 'k.h.s.hkk.h.s.hh', chords: 'F C Dm Bb F C Bb C', lead: 'p25',
      mel: 'C5 . F5 . A5 . C6 . | E5 . G5 . C6 - G5 . | D5 . F5 . A5 . D6 . | Bb5 - A5 . F5 . D5 . | F5 . A5 . C6 . F6 . | E6 - D6 . C6 . G5 . | D6 . C6 . Bb5 . A5 . | G5 - - - C6 - - -' },
    final: { bpm: 160, drums: 'kkhks.hkkkhks.ss', chords: 'Em C D B Em C Am B', lead: 'p25',
      mel: 'E5 . G5 . B5 . E6 D6 | C6 . G5 . E5 . G5 . | D6 . A5 . F#5 . A5 . | B5 - D#6 - F#6 - D#6 - | E6 . B5 . G5 . E6 . | E6 . C6 . G5 . C6 . | C6 . A5 . E5 . A5 . | B5 - - - F#5 - D#5 -' },
    audit: { bpm: 120, drums: 'k..ks...k..ks.k.', chords: 'Gm Eb F D', lead: 'p12',
      mel: 'G5 . . D5 G5 . A5 Bb5 | G5 . . Eb5 G5 . Bb5 . | A5 . . F5 A5 . C6 . | F#5 - - - D5 - - -' },
    ember: { bpm: 80, drums: '', chords: 'Am F C G', lead: 'p12',
      mel: 'E5 - - - A5 - - . | F5 - - - C5 - - . | E5 - G5 - C6 - B5 . | D5 - - - - - . .' },
    shrine: { bpm: 90, drums: 'k.......k...s...', chords: 'Em Em C D', lead: 'p12',
      mel: 'B4 - - - E5 - G5 - | F#5 - - - D5 - - - | E5 - G5 - C6 - B5 - | A5 - - - F#5 - - -' },
  };
  const CH = { '': [0, 4, 7], m: [0, 3, 7], 7: [0, 4, 7, 10], dim: [0, 3, 6] };
  function chord(name) {
    const m = /^([A-G][#b]?)(m|7|dim)?$/.exec(name);
    const root = midi(m[1] + '2');
    return { root, tones: CH[m[2] || ''].map((i) => root + i) };
  }
  for (const k in SONGS) {
    const s = SONGS[k];
    s.steps = s.mel.replace(/\|/g, ' ').split(/\s+/).filter(Boolean);
    s.prog = s.chords.split(' ').map(chord);
  }

  let song = null, songName = null, step = 0, nextT = 0, timer = null, pending = null;
  function play(name) {
    if (songName === name) return;
    stop();
    songName = name;
    if (!ac) { pending = name; return; }
    song = SONGS[name];
    if (!song) return;
    step = 0; nextT = ac.currentTime + 0.08;
    timer = setInterval(tick, 25);
  }
  function stop() {
    if (timer) clearInterval(timer);
    timer = null; song = null; songName = null;
  }
  function tick() {
    if (!song || !ac) return;
    const dt = 60 / song.bpm / 2;
    while (nextT < ac.currentTime + 0.12) {
      const n = song.steps.length;
      const i = step % n;
      const bar = Math.floor(i / 8) % song.prog.length;
      const c = song.prog[bar];
      const tok = song.steps[i];
      // melody: length = this step plus any '-' that follow
      const m = midi(tok);
      if (m) {
        let len = 1;
        while (song.steps[(i + len) % n] === '-' && len < 8) len++;
        voice(song.lead, freq(m), nextT, dt * len * 0.95, 0.16, musicBus, { vib: len > 2, sustain: true });
        voice('p12', freq(m) * 1.004, nextT + 0.012, dt * len * 0.9, 0.04, musicBus);
      }
      // bass
      const bp = i % 8;
      const bassN = [c.root, null, c.root + 12, null, c.tones[2] - 12 + 12, null, c.root + 12, c.root][bp];
      if (bassN) voice('triangle', freq(bassN), nextT, dt * 0.9, 0.34, musicBus);
      // arpeggio, quietly
      if (song.drums && bp % 2 === 1) voice('p12', freq(c.tones[(bp >> 1) % c.tones.length] + 24), nextT, dt * 0.6, 0.035, musicBus);
      // drums
      if (song.drums) {
        const d = song.drums[(i * 2) % song.drums.length] || '.';
        const d2 = song.drums[(i * 2 + 1) % song.drums.length] || '.';
        hitDrum(d, nextT); hitDrum(d2, nextT + dt / 2);
      }
      nextT += dt; step++;
    }
  }
  function hitDrum(d, t) {
    if (d === 'k') { voice('sine', 150, t, 0.12, 0.5, musicBus, { f1: 40 }); }
    else if (d === 's') noise(t, 0.12, 0.35, musicBus, 1800);
    else if (d === 'h') noise(t, 0.03, 0.12, musicBus, 7000);
  }

  function jingle(kind) {
    if (!ac) return;
    const t = ac.currentTime + 0.02;
    const seqs = {
      victory: [[523, 0, 0.12], [659, 0.12, 0.12], [784, 0.24, 0.12], [1047, 0.36, 0.5], [784, 0.9, 0.12], [1047, 1.02, 0.7]],
      gameover: [[392, 0, 0.3], [349, 0.3, 0.3], [311, 0.6, 0.3], [262, 0.9, 0.9]],
    };
    for (const [f, o, d] of seqs[kind]) { voice('p25', f, t + o, d, 0.16, sfxBus, { sustain: true }); voice('triangle', f / 2, t + o, d, 0.25, sfxBus); }
  }

  function toggleMusic() {
    musicOn = !musicOn;
    try { localStorage.setItem('skybreaker.music', musicOn ? 'on' : 'off'); } catch (e) { /* storage blocked */ }
    if (musicBus) musicBus.gain.value = musicOn ? 0.32 : 0;
    return musicOn;
  }

  return { init, sfx, play, stop, jingle, toggleMusic, get musicOn() { return musicOn; }, get current() { return songName; } };
})();
