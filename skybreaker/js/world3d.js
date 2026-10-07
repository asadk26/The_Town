/* SKYBREAKER — the diorama.

   The simulation is still a flat, top-down world measured in pixels (16 to a
   tile); this file only draws it.  Every map becomes a small lit model: the
   baked terrain is laid on tiles, cliffs and walls are extruded, water and
   lava sit a step lower, houses get walls and roofs, and every person, tree
   and prop stands in it as a pixel-art cut-out leaning back toward the
   camera.  A last pass adds the tilt-shift blur, bloom and grade that make
   it read like a model on a table.

   1 tile = 1 world unit.  World X = pixel x / 16, world Z = pixel y / 16. */
'use strict';

const R3 = (() => {
  const PITCH = 0.84;          // camera tilt below the horizon, radians
  const DIST = 19;           // camera distance from the hero
  const FOV = 31;
  const LEAN = PITCH;          // sprites lean back by exactly the camera's tilt
  const COS = Math.cos(LEAN), SIN = Math.sin(LEAN);

  let renderer, scene, cam, rt, postScene, postCam, postMat, canvas;
  let world = null;            // per-map group and bookkeeping
  let quality = 'high';
  let W = 0, H = 0;
  const target = new THREE.Vector3(), camPos = new THREE.Vector3();
  let time = 0;

  /* ── textures ─────────────────────────────────────────── */
  const texCache = new WeakMap();
  function texOf(c, repeat) {
    let t = texCache.get(c);
    if (!t) {
      t = new THREE.CanvasTexture(c);
      t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.generateMipmaps = false;
      t.colorSpace = THREE.SRGBColorSpace;
      if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
      texCache.set(c, t);
    }
    return t;
  }

  /* A unit quad anchored at its bottom-centre, leaning back toward the camera. */
  const billboardGeo = (() => {
    const g = new THREE.PlaneGeometry(1, 1);
    g.translate(0, 0.5, 0);
    g.rotateX(-LEAN);
    return g;
  })();
  const sizedGeo = {};
  function geoFor(w, h) {
    const k = w + 'x' + h;
    if (!sizedGeo[k]) { const g = new THREE.PlaneGeometry(w / 16, h / 16); g.translate(0, h / 32, 0); g.rotateX(-LEAN); sizedGeo[k] = g; }
    return sizedGeo[k];
  }
  function spriteMat(tex, glow = 0.32) {
    const m = new THREE.MeshStandardMaterial({ map: tex, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.92, metalness: 0,
      emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: glow });
    return m;
  }
  function depthMat(tex) { return new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: tex, alphaTest: 0.5, side: THREE.DoubleSide }); }

  /* place a leaning sprite so that canvas pixel (ax, ay) stands on (wx, wz) */
  function placeLeaning(obj, wx, wz, w, h, ax, ay, lift = 0) {
    const lx = (w / 2 - ax) / 16, ly = (ay + 1 - h) / 16;
    obj.position.set(wx + lx, lift + ly * COS, wz - ly * SIN);
  }

  /* ── setup ────────────────────────────────────────────── */
  function init(el, q) {
    canvas = el;
    quality = q || 'high';
    renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: !!window.SKY_TEST });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = quality === 'low' ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;
    scene = new THREE.Scene();
    cam = new THREE.PerspectiveCamera(FOV, 16 / 9, 0.5, 120);
    postScene = new THREE.Scene();
    postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    postMat = new THREE.ShaderMaterial({
      uniforms: { tex: { value: null }, res: { value: new THREE.Vector2(1, 1) }, focus: { value: 0.42 }, blur: { value: 4.5 },
        bloom: { value: 1.4 }, grade: { value: new THREE.Vector3(1.04, 1.0, 0.94) }, vign: { value: 0.6 }, hi: { value: quality === 'low' ? 0 : 1 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }',
      fragmentShader: `
        uniform sampler2D tex; uniform vec2 res; uniform float focus, blur, bloom, vign, hi; uniform vec3 grade; varying vec2 vUv;
        vec3 tap(vec2 uv){ return texture2D(tex, uv).rgb; }
        void main(){
          float d = smoothstep(0.16, 0.52, abs(vUv.y - focus));
          float r = d * blur * (res.y / 640.);
          vec3 c = vec3(0.);
          int N = hi > 0.5 ? 20 : 8;
          for (int i = 0; i < 20; i++) {
            if (i >= N) break;
            float a = float(i) * 2.39996; float rr = sqrt(float(i) / float(N)) * r;
            c += tap(vUv + vec2(cos(a), sin(a)) * rr / res);
          }
          c /= float(N);
          vec3 b = vec3(0.);
          int M = hi > 0.5 ? 12 : 6;
          for (int i = 0; i < 12; i++) {
            if (i >= M) break;
            float a = float(i) * 2.39996 + 0.5; float rr = sqrt(float(i) / float(M)) * 12. * (res.y / 640.);
            b += max(tap(vUv + vec2(cos(a), sin(a)) * rr / res) - 0.74, 0.);
          }
          c += b / float(M) * bloom;
          c *= grade;
          float lum = dot(c, vec3(0.299, 0.587, 0.114));
          c = mix(vec3(lum), c, 0.9) * 0.97 + 0.02;
          float v = smoothstep(0.98, 0.32, length((vUv - 0.5) * vec2(1.05, 1.3)));
          c *= mix(1. - vign * 0.6, 1.0, v);
          gl_FragColor = vec4(c, 1.);
        }`,
      depthTest: false, depthWrite: false,
    });
    postScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), postMat));
    resize();
  }

  function resize() {
    if (!renderer) return;
    const dpr = Math.min(window.devicePixelRatio || 1, quality === 'low' ? 1 : 1.5);
    const scale = quality === 'low' ? 0.7 : 1;
    W = Math.max(2, Math.round(innerWidth * dpr * scale));
    H = Math.max(2, Math.round(innerHeight * dpr * scale));
    renderer.setPixelRatio(1);
    renderer.setSize(W, H, false);
    canvas.style.width = innerWidth + 'px';
    canvas.style.height = innerHeight + 'px';
    cam.aspect = W / H;
    cam.updateProjectionMatrix();
    if (rt) rt.dispose();
    rt = new THREE.WebGLRenderTarget(W, H, { samples: quality === 'low' ? 0 : 4 });
    rt.texture.colorSpace = THREE.SRGBColorSpace;
    postMat.uniforms.tex.value = rt.texture;
    postMat.uniforms.res.value.set(W, H);
  }

  /* ── per-map lighting moods ───────────────────────────── */
  const MOODS = {
    day:     { bg: '#e6d6b8', fog: [30, 60], sky: '#fff2dc', ground: '#6a7a5a', hemi: 1.45, sun: '#ffe2b4', sunI: 2.9, sunDir: [-0.5, 1.1, 0.9], exp: 1.42, lamp: 0, focus: 0.42, grade: [1.04, 1.0, 0.94] },
    golden:  { bg: '#e9cfa6', fog: [26, 56], sky: '#ffe6c4', ground: '#5a5a48', hemi: 1.3, sun: '#ffc888', sunI: 3.0, sunDir: [-0.9, 0.9, 0.7], exp: 1.4, lamp: 4, focus: 0.42, grade: [1.08, 0.99, 0.88] },
    fields:  { bg: '#d8e6c8', fog: [34, 70], sky: '#f4fbff', ground: '#6a8a5a', hemi: 1.5, sun: '#fff0d0', sunI: 3.1, sunDir: [-0.4, 1.2, 0.8], exp: 1.4, lamp: 0, focus: 0.42, grade: [1.02, 1.02, 0.97] },
    indoor:  { bg: '#1a1028', fog: [40, 80], sky: '#ffe2c4', ground: '#3a2a20', hemi: 1.1, sun: '#ffd8a8', sunI: 1.6, sunDir: [-0.3, 1.4, 0.6], exp: 1.5, lamp: 3, focus: 0.45, grade: [1.06, 1.0, 0.9] },
    volcano: { bg: '#3a1a18', fog: [24, 54], sky: '#ffc8a8', ground: '#5a2a20', hemi: 1.45, sun: '#ffb08a', sunI: 2.5, sunDir: [-0.6, 1.0, 0.8], exp: 1.75, lamp: 5, focus: 0.42, grade: [1.1, 0.95, 0.88] },
    shrine:  { bg: '#1a0e10', fog: [22, 48], sky: '#ffc8a0', ground: '#4a2418', hemi: 1.2, sun: '#ffb070', sunI: 1.8, sunDir: [-0.2, 1.4, 0.6], exp: 1.8, lamp: 6, focus: 0.45, grade: [1.1, 0.96, 0.86] },
    cosmic:  { bg: '#140e2a', fog: [26, 70], sky: '#d8ccff', ground: '#2a2050', hemi: 1.2, sun: '#e8e0ff', sunI: 2.2, sunDir: [-0.4, 1.2, 0.7], exp: 1.45, lamp: 3, focus: 0.43, grade: [0.98, 0.98, 1.06], stars: true },
  };

  /* ── map building ─────────────────────────────────────── */
  const SOLID_TALL = { c: 1.25, k: 1.7 };
  const SUNK = { w: -0.16, l: -0.12 };

  function faceCanvas(kind) {
    const c = GFX.canvas(16, 32), x = c.getContext('2d');
    const img = x.createImageData(16, 32);
    for (let py = 0; py < 32; py++) for (let px = 0; px < 16; px++) {
      let col;
      if (kind === 'k') {
        col = py >= 28 ? '#6a4028' : py === 27 ? '#8a5634' : (px % 8 === 0 ? '#c8a888' : (Math.floor(px / 4) % 2 ? '#e6d2b0' : '#dcc6a2'));
      } else if (kind === 'c') {
        const strata = (px + Math.floor(GFX.smooth(px / 3, py / 7) * 4)) % 5;
        col = py < 2 ? '#8a7276' : strata === 0 ? '#2a1e22' : (py > 24 ? '#3a2c30' : (GFX.hash(px, py) > 0.8 ? '#5a4648' : '#4e3c40'));
      } else if (kind === 'bank') {
        col = py < 3 ? '#6a5a3a' : (GFX.hash(px, py, 3) > 0.7 ? '#4a3a26' : '#5a4630');
      } else if (kind === 'void') {
        col = py < 3 ? '#b4aca0' : (py < 10 ? '#5a5268' : '#2a2238');
      } else {
        col = py < 2 ? '#7a5a3a' : (GFX.hash(px, py, 9) > 0.75 ? '#4a3020' : '#5e3e28');
      }
      const r = parseInt(col.slice(1, 3), 16), g = parseInt(col.slice(3, 5), 16), b = parseInt(col.slice(5, 7), 16);
      const i = (py * 16 + px) * 4; img.data[i] = r; img.data[i + 1] = g; img.data[i + 2] = b; img.data[i + 3] = 255;
    }
    x.putImageData(img, 0, 0);
    return c;
  }
  const faceTex = {};
  function faceMaterial(kind) {
    if (!faceTex[kind]) { const t = texOf(faceCanvas(kind), true); faceTex[kind] = new THREE.MeshStandardMaterial({ map: t, roughness: 0.95 }); }
    return faceTex[kind];
  }

  /* A little quad soup → BufferGeometry. */
  function Soup() { this.p = []; this.uv = []; this.n = []; this.i = []; }
  Soup.prototype.quad = function (a, b, c, d, uva, uvb, uvc, uvd, n) {
    const base = this.p.length / 3;
    for (const v of [a, b, c, d]) this.p.push(v[0], v[1], v[2]);
    for (const t of [uva, uvb, uvc, uvd]) this.uv.push(t[0], t[1]);
    for (let k = 0; k < 4; k++) this.n.push(n[0], n[1], n[2]);
    this.i.push(base, base + 1, base + 2, base, base + 2, base + 3);
  };
  Soup.prototype.geo = function () {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setIndex(this.i);
    return g;
  };

  function buildMap(m) {
    if (world) disposeWorld();
    const mood = MOODS[m.mood || 'day'];
    const group = new THREE.Group();
    world = { m, mood, group, props: new Map(), actors: new Map(), lights: [], statics: [], water: null, lavaMat: null, pool: [], ghosts: [] };
    scene.add(group);
    scene.background = new THREE.Color(mood.bg);
    scene.fog = new THREE.Fog(mood.bg, mood.fog[0], mood.fog[1]);
    renderer.toneMappingExposure = mood.exp;
    postMat.uniforms.focus.value = mood.focus;
    postMat.uniforms.grade.value.set(...mood.grade);

    // terrain
    const gt = texOf(m.ground);
    const top = new Soup(), sides = { c: new Soup(), k: new Soup(), bank: new Soup(), void: new Soup(), edge: new Soup() };
    const water = new Soup(), lava = new Soup();
    const at = (x, y) => (x < 0 || y < 0 || x >= m.w || y >= m.h) ? null : m.rows[y][x];
    const hOf = (t) => t === null ? -0.7 : t === 'v' ? -0.9 : SOLID_TALL[t] || SUNK[t] || 0;
    for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
      const t = m.rows[y][x];
      if (t === 'v') continue;
      const h = hOf(t);
      const u0 = x / m.w, u1 = (x + 1) / m.w, v0 = 1 - y / m.h, v1 = 1 - (y + 1) / m.h;
      const dst = t === 'w' ? water : t === 'l' ? lava : top;
      dst.quad([x, h, y], [x, h, y + 1], [x + 1, h, y + 1], [x + 1, h, y], [u0, v0], [u0, v1], [u1, v1], [u1, v0], [0, 1, 0]);
      // vertical faces wherever a neighbour sits lower
      for (const [dx, dy, nx, nz] of [[0, 1, 0, 1], [0, -1, 0, -1], [1, 0, 1, 0], [-1, 0, -1, 0]]) {
        const o = at(x + dx, y + dy);
        const oh = hOf(o);
        if (oh >= h - 0.001) continue;
        let kind = SOLID_TALL[t] ? t : (o === 'w' || o === 'l') ? 'bank' : (o === 'v') ? 'void' : 'edge';
        const s = sides[kind];
        const hh = h - oh;
        // the edge segment, in world space
        let a, b;
        if (dy === 1) { a = [x, y + 1]; b = [x + 1, y + 1]; }
        else if (dy === -1) { a = [x + 1, y]; b = [x, y]; }
        else if (dx === 1) { a = [x + 1, y + 1]; b = [x + 1, y]; }
        else { a = [x, y]; b = [x, y + 1]; }
        const vt = kind === 'k' ? 1 : hh / 2;
        s.quad([a[0], h, a[1]], [a[0], oh, a[1]], [b[0], oh, b[1]], [b[0], h, b[1]], [0, 1], [0, 1 - vt], [1, 1 - vt], [1, 1], [nx, 0, nz]);
      }
    }
    const groundMat = new THREE.MeshStandardMaterial({ map: gt, roughness: 1 });
    const addMesh = (geo, mat, cast = false) => { const me = new THREE.Mesh(geo, mat); me.receiveShadow = true; me.castShadow = cast; group.add(me); return me; };
    addMesh(top.geo(), groundMat);
    for (const k in sides) if (sides[k].p.length) addMesh(sides[k].geo(), faceMaterial(k), k === 'c' || k === 'k');
    if (water.p.length) {
      addMesh(water.geo(), new THREE.MeshStandardMaterial({ map: gt, roughness: 0.25, metalness: 0.05 }));
      const wm = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, uniforms: { t: { value: 0 } },
        vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position + vec3(0., 0.04, 0.), 1.); }',
        fragmentShader: `uniform float t; varying vec3 vP;
          void main(){
            float w = sin(vP.x * 3.1 + t * 1.3) * sin(vP.z * 2.3 - t * 1.1) + sin((vP.x + vP.z) * 5.0 + t * 2.0) * 0.4;
            float s = smoothstep(0.82, 1.15, w);
            gl_FragColor = vec4(vec3(0.85, 0.95, 1.0), 0.10 + s * 0.45);
          }` });
      world.water = wm;
      group.add(new THREE.Mesh(water.geo(), wm));
    }
    if (lava.p.length) {
      const lm = new THREE.MeshStandardMaterial({ map: gt, emissive: 0xff7a2a, emissiveMap: gt, emissiveIntensity: 1.2, roughness: 0.6 });
      world.lavaMat = lm;
      addMesh(lava.geo(), lm);
    }
    // the table the model sits on
    if (!m.rows.some((r) => r.includes('v'))) {
      const slab = new THREE.Mesh(new THREE.BoxGeometry(m.w + 0.6, 0.5, m.h + 0.6), new THREE.MeshStandardMaterial({ color: '#3a2618', roughness: 0.9 }));
      slab.position.set(m.w / 2, -0.96, m.h / 2); slab.receiveShadow = true; group.add(slab);
    }
    if (mood.stars) {
      const pts = [];
      for (let i = 0; i < 700; i++) pts.push(Math.random() * (m.w + 40) - 20, -3 - Math.random() * 14, Math.random() * (m.h + 40) - 20);
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
      group.add(new THREE.Points(g, new THREE.PointsMaterial({ color: '#e8e0ff', size: 0.09, sizeAttenuation: true, fog: false })));
    }

    // lights
    const hemi = new THREE.HemisphereLight(mood.sky, mood.ground, mood.hemi);
    group.add(hemi);
    const sun = new THREE.DirectionalLight(mood.sun, mood.sunI);
    sun.castShadow = true;
    const sm = quality === 'low' ? 1024 : 2048;
    sun.shadow.mapSize.set(sm, sm);
    Object.assign(sun.shadow.camera, { left: -15, right: 15, top: 15, bottom: -15, near: 1, far: 60 });
    sun.shadow.bias = -0.0009; sun.shadow.normalBias = 0.02; sun.shadow.radius = 3;
    group.add(sun, sun.target);
    world.sun = sun;

    // static props: instanced; everything else gets its own mesh in sync()
    const buckets = new Map();
    for (const p of G.props) {
      if (!isStatic(p)) continue;
      const img = p.img;
      if (!buckets.has(img)) buckets.set(img, []);
      buckets.get(img).push(p);
      world.statics.push(p);
    }
    const mtx = new THREE.Matrix4();
    for (const [img, list] of buckets) {
      const tex = texOf(img);
      const mesh = new THREE.InstancedMesh(geoFor(img.width, img.height), spriteMat(tex, 0.28), list.length);
      mesh.customDepthMaterial = depthMat(tex);
      mesh.castShadow = true; mesh.receiveShadow = true;
      list.forEach((p, i) => {
        const o = new THREE.Object3D();
        placeLeaning(o, (p.x + (p.ox || 0)) / 16, (p.y) / 16, img.width, img.height, img.width / 2, img.height - 1 - (p.oy || 0));
        o.updateMatrix(); mtx.copy(o.matrix);
        mesh.setMatrixAt(i, mtx);
      });
      mesh.frustumCulled = false;
      group.add(mesh);
    }
    // point lights we know about in advance: lamps, fires, braziers, portals, lava
    const want = [];
    for (const p of G.props) {
      if (p.type === 'lamp') want.push({ x: p.x / 16, z: p.y / 16 - 0.1, y: 1.8, color: '#ffb04a', i: 3.2, d: 6, p, halo: true });
      if (p.type === 'campfire') want.push({ x: p.x / 16, z: p.y / 16 - 0.2, y: 0.6, color: '#ff8a3a', i: 4, d: 6, p, flicker: true });
      if (p.type === 'brazier') want.push({ x: p.x / 16, z: p.y / 16 - 0.2, y: 1.3, color: '#ff9a4a', i: 4, d: 6.5, p, flicker: true, when: () => (p.frameFn ? p.frameFn(p) > 0 : true) });
      if (p.type === 'portal') want.push({ x: p.x / 16, z: p.y / 16 - 0.3, y: 1.2, color: '#a87aff', i: 5, d: 7, p, when: () => G.props.includes(p) });
    }
    if (world.lavaMat) {
      let n = 0;
      for (let y = 2; y < m.h && n < 6; y += 7) for (let x = 2; x < m.w && n < 6; x += 9) if (m.rows[y][x] === 'l') { want.push({ x: x + 0.5, z: y + 0.5, y: 0.8, color: '#ff6a2a', i: 5, d: 9, flicker: true }); n++; }
    }
    for (const L of want.slice(0, 12)) {
      const l = new THREE.PointLight(L.color, L.i, L.d, 1.6);
      l.position.set(L.x, L.y, L.z);
      group.add(l);
      world.lights.push({ l, L });
      if (L.halo) {
        const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex(), color: L.color, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
        s.scale.set(1.7, 1.7, 1); s.position.set(L.x, L.y - 0.05, L.z + 0.05); group.add(s);
      }
    }
    // a small pool of moving lights for ki
    for (let i = 0; i < 3; i++) { const l = new THREE.PointLight('#ffffff', 0, 4.5, 1.8); group.add(l); world.pool.push(l); }

    // effects layers
    world.fx = new THREE.Group(); group.add(world.fx);
    world.parts = makeParticles(); group.add(world.parts.points);
    snap();
  }

  let _halo = null;
  function haloTex() {
    if (_halo) return _halo;
    const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
    const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.4, 'rgba(255,255,255,0.35)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, 64, 64);
    return (_halo = new THREE.CanvasTexture(c));
  }

  const STATIC_TYPES = { tree: 1, bush: 1, rock: 1, stump: 1, basalt: 1, crystal: 1, fenceH: 1, fenceV: 1, lamp: 1, flag: 1, statue: 1, crate: 1, tent: 1,
    bench: 1, board: 1, sign: 1, cauldron: 1, counter: 1, awning: 1, bed: 1, table: 1, plant: 1, shelf: 1, gate: 1, vending: 1, scallion: 0 };
  function isStatic(p) { return p.img && !p.frames && !p.flag && !p.onHit && !p.hidden && !p.when && STATIC_TYPES[p.type]; }

  function disposeWorld() {
    scene.remove(world.group);
    world.group.traverse((o) => { if (o.geometry && !Object.values(sizedGeo).includes(o.geometry) && o.geometry !== billboardGeo) o.geometry.dispose(); });
    world = null;
  }

  /* ── 3D pieces for a few props ────────────────────────── */
  function houseMesh(p) {
    const img = p.img, wt = img.width / 16, ht = (img.height - 8) / 16;
    const roofH = Math.floor(img.height * 0.52);
    const wallH = 1.75, rise = 1.3;
    const g = new THREE.Group();
    const cx = p.tx + wt / 2, cz = p.ty + ht / 2 + 0.35, depth = ht - 0.5;
    const crop = (x, y, w, h) => { const c = GFX.canvas(w, h); c.getContext('2d').drawImage(img, x, y, w, h, 0, 0, w, h); return c; };
    const front = texOf(crop(0, roofH - 2, img.width, img.height - roofH + 2));
    const wall = texOf(crop(4, roofH + 14, 4, 4));
    const wm = new THREE.MeshStandardMaterial({ map: wall, roughness: 0.95 });
    const mats = [wm, wm, wm, wm, new THREE.MeshStandardMaterial({ map: front, roughness: 0.9 }), wm];
    const box = new THREE.Mesh(new THREE.BoxGeometry(wt - 0.2, wallH, depth), mats);
    box.position.set(cx, wallH / 2, cz); box.castShadow = box.receiveShadow = true; g.add(box);
    const roofT = texOf(crop(8, 2, img.width - 16, Math.max(4, roofH - 6)), true);
    const shape = new THREE.Shape(); const hw = depth / 2 + 0.35;
    shape.moveTo(-hw, 0); shape.lineTo(0, rise); shape.lineTo(hw, 0); shape.lineTo(-hw, 0);
    const geo = new THREE.ExtrudeGeometry(shape, { depth: wt + 0.2, bevelEnabled: false });
    geo.rotateY(Math.PI / 2); geo.translate(-(wt + 0.2) / 2, 0, 0);
    const uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 0.35, uv.getY(i) * 0.35);
    const roof = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: roofT, roughness: 0.8 }));
    roof.position.set(cx, wallH, cz); roof.castShadow = roof.receiveShadow = true; g.add(roof);
    const ch = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.9, 0.4), new THREE.MeshStandardMaterial({ color: '#8a7a72', roughness: 0.9 }));
    ch.position.set(cx + wt / 2 - 0.9, wallH + rise * 0.7, cz - 0.3); ch.castShadow = true; g.add(ch);
    return g;
  }
  function fountainMesh(p) {
    const g = new THREE.Group(), x = p.x / 16, z = p.y / 16 - 0.95;
    const stone = new THREE.MeshStandardMaterial({ color: '#b2aebc', roughness: 0.85 });
    const add = (geo, mat, y) => { const me = new THREE.Mesh(geo, mat); me.position.set(x, y, z); me.castShadow = me.receiveShadow = true; g.add(me); return me; };
    add(new THREE.CylinderGeometry(1.25, 1.35, 0.45, 24), stone, 0.22);
    add(new THREE.CylinderGeometry(1.08, 1.08, 0.05, 24), new THREE.MeshStandardMaterial({ color: '#4a9ae8', roughness: 0.15, emissive: '#1a3a70', emissiveIntensity: 0.4 }), 0.42).castShadow = false;
    add(new THREE.CylinderGeometry(0.16, 0.22, 1.3, 12), stone, 0.85);
    add(new THREE.CylinderGeometry(0.45, 0.2, 0.22, 16), stone, 1.5);
    const jet = add(new THREE.ConeGeometry(0.12, 0.6, 8), new THREE.MeshStandardMaterial({ color: '#c8ecff', emissive: '#8acfff', emissiveIntensity: 0.6, transparent: true, opacity: 0.8 }), 1.85);
    jet.castShadow = false;
    g.userData.jet = jet;
    return g;
  }
  function pillarMesh(p) {
    const g = new THREE.Group(), x = p.x / 16, z = p.y / 16 - 0.5;
    const mat = new THREE.MeshStandardMaterial({ color: '#efe9de', roughness: 0.55 });
    const add = (geo, y) => { const me = new THREE.Mesh(geo, mat); me.position.set(x, y, z); me.castShadow = me.receiveShadow = true; g.add(me); };
    add(new THREE.BoxGeometry(0.9, 0.25, 0.9), 0.12);
    add(new THREE.CylinderGeometry(0.32, 0.36, 2.2, 16), 1.35);
    add(new THREE.BoxGeometry(0.9, 0.25, 0.9), 2.55);
    return g;
  }
  function barrierMesh(p) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(1, 1.6, 0.25), new THREE.MeshStandardMaterial({ color: '#7ae8ff', emissive: '#3ab8ff', emissiveIntensity: 1.6, transparent: true, opacity: 0.45, depthWrite: false }));
    m.position.set(p.x / 16, 0.8, p.y / 16 - 0.5);
    m.userData.pulse = true;
    return m;
  }

  /* ── keeping the scene in step with the simulation ────── */
  function propMesh(p) {
    if (p.type === 'house') return houseMesh(p);
    if (p.type === 'fountain') return fountainMesh(p);
    if (p.type === 'pillar') return pillarMesh(p);
    if (p.type === 'barrier') return barrierMesh(p);
    const img = p.img || (p.frames && p.frames[0]);
    if (!img) return null;
    const tex = texOf(img);
    const me = new THREE.Mesh(billboardGeo, spriteMat(tex, p.type === 'portal' ? 0.9 : 0.3));
    me.customDepthMaterial = depthMat(tex);
    me.castShadow = p.type !== 'portal'; me.receiveShadow = true;
    me.userData.sprite = true;
    return me;
  }
  function syncProps() {
    const seen = new Set();
    for (const p of G.props) {
      if (world.statics.includes(p)) continue;
      seen.add(p);
      let me = world.props.get(p);
      if (me === undefined) { me = propMesh(p); world.props.set(p, me); if (me) world.group.add(me); }
      if (!me) continue;
      if (me.userData.sprite) {
        let img = p.img;
        if (p.frames) img = p.frames[p.frameFn ? p.frameFn(p) : Math.floor(G.t * (p.fps || 6)) % p.frames.length];
        if (!img) { me.visible = false; continue; }
        const hidden = p.hidden && !p.revealed;
        me.visible = !hidden || Math.floor(G.t * 3) % 2 === 0;
        const src = p.flash > 0 ? GFX.flash(img) : img;
        const tex = texOf(src);
        if (me.material.map !== tex) { me.material.map = tex; me.material.emissiveMap = tex; me.customDepthMaterial.map = tex; }
        me.scale.set(img.width / 16, img.height / 16, 1);
        let wob = 0;
        if (p.wobble > 0) { wob = Math.sin(G.t * 50) * 0.08; }
        placeLeaning(me, (p.x + (p.ox || 0)) / 16 + wob, p.y / 16, img.width, img.height, img.width / 2, img.height - 1 - (p.oy || 0));
        if (hidden) me.material.opacity = 0.6;
      } else if (me.userData.pulse) {
        me.material.opacity = 0.32 + 0.18 * Math.sin(G.t * 6 + p.x);
      }
      if (me.userData.jet) me.userData.jet.scale.y = 0.85 + 0.2 * Math.sin(G.t * 9);
    }
    for (const [p, me] of world.props) if (!seen.has(p)) { if (me) world.group.remove(me); world.props.delete(p); }
  }

  function actorMesh() {
    const tex = texOf(GFX.canvas(1, 1));
    const me = new THREE.Mesh(billboardGeo, spriteMat(tex, 0.42));
    me.customDepthMaterial = depthMat(tex);
    me.castShadow = true; me.receiveShadow = false;
    const blob = new THREE.Mesh(new THREE.CircleGeometry(0.5, 16), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28, depthWrite: false }));
    blob.rotation.x = -Math.PI / 2;
    me.userData.blob = blob;
    return me;
  }
  function syncActors() {
    const list = [G.player, ...G.npcs, ...G.enemies];
    const seen = new Set();
    for (const e of list) {
      if (!e || (e === G.player && G.titleMode)) continue;
      seen.add(e);
      let me = world.actors.get(e);
      if (!me) { me = actorMesh(); world.actors.set(e, me); world.group.add(me); world.group.add(me.userData.blob); }
      const img = actorFrame(e);
      if (!img) { me.visible = false; me.userData.blob.visible = false; continue; }
      const src = (e.flash > 0 || e.flashT > 0) ? GFX.flash(img) : img;
      const tex = texOf(src);
      if (me.material.map !== tex) { me.material.map = tex; me.material.emissiveMap = tex; me.customDepthMaterial.map = tex; }
      me.scale.set(img.width / 16, img.height / 16, 1);
      let lift = 0;
      if (e.fly) lift = 0.4 + Math.sin(G.t * 5 + (e.bob || 0)) * 0.12;
      if (e.float) lift = 0.25 + Math.sin(G.t * 3) * 0.08;
      let jx = 0;
      if (e.kind === 'enemy' && e.state === 'wind' && !e.boss) jx = Math.sin(G.t * 60) * 0.05;
      placeLeaning(me, e.x / 16 + jx, e.y / 16, img.width, img.height, e._ox, e._oy, lift);
      let vis = true;
      if (e.kind === 'player' && e.invuln > 0 && e.state !== 'hurt' && e.state !== 'ko' && Math.floor(G.t * 16) % 2) vis = false;
      me.visible = vis;
      const a = e.alpha !== undefined ? e.alpha : 1;
      const dying = e.boss && e.state === 'dying' && Math.floor(G.t * 20) % 2;
      const op = dying ? 0.4 : a;
      me.material.transparent = op < 1; me.material.opacity = op; me.material.alphaTest = op < 1 ? 0.05 : 0.5;
      me.material.emissiveIntensity = e.kind === 'player' && G.player.od ? 0.75 : 0.42;
      const blob = me.userData.blob;
      const bw = (e.boss && e.d.big ? 30 : e.w + 6) / 16;
      blob.scale.set(bw, bw * 0.55, 1);
      blob.position.set(e.x / 16, 0.015, e.y / 16 - 0.05);
      blob.visible = a > 0.5 && !(e.kind === 'player' && e.state === 'ko');
      blob.material.opacity = e.fly ? 0.16 : 0.28;
    }
    for (const [e, me] of world.actors) if (!seen.has(e)) { world.group.remove(me); world.group.remove(me.userData.blob); world.actors.delete(e); }
  }

  /* ── effects: rebuilt every frame from the simulation ─── */
  function makeParticles() {
    const N = 700;
    const g = new THREE.BufferGeometry();
    const pos = new Float32Array(N * 3), col = new Float32Array(N * 3);
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const mat = new THREE.PointsMaterial({ size: 0.13, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true });
    const points = new THREE.Points(g, mat);
    points.frustumCulled = false;
    return { points, pos, col, N };
  }
  const tmpC = new THREE.Color();
  function syncParticles() {
    const P = world.parts;
    let n = 0;
    for (const q of G.parts) {
      if (q.ghost || n >= P.N) continue;
      if (q.y0 === undefined) q.y0 = q.y;
      const k = Math.min(1, q.life / q.max * 1.5);
      tmpC.set(q.color).multiplyScalar(k * 1.4);
      // a 2D particle moving "up the screen" is rising; down the screen is falling
      const h = Math.max(0.05, 0.75 + (q.y0 - q.y) / 16);
      P.pos[n * 3] = q.x / 16; P.pos[n * 3 + 1] = h; P.pos[n * 3 + 2] = q.y0 / 16 + 0.05;
      P.col[n * 3] = tmpC.r; P.col[n * 3 + 1] = tmpC.g; P.col[n * 3 + 2] = tmpC.b;
      n++;
    }
    for (let i = n; i < P.N; i++) { P.pos[i * 3 + 1] = -100; }
    P.points.geometry.attributes.position.needsUpdate = true;
    P.points.geometry.attributes.color.needsUpdate = true;
    P.points.geometry.setDrawRange(0, Math.max(n, 1));
  }

  /* things that don't need to persist: shots, rings, beams, telegraphs, ghosts */
  const fxPool = { sprites: [], rings: [], planes: [], billboards: [] };
  let fxUsed = { sprites: 0, rings: 0, planes: 0, billboards: 0 };
  function take(kind, make) {
    const arr = fxPool[kind];
    if (fxUsed[kind] >= arr.length) { const o = make(); arr.push(o); world.fx.add(o); }
    const o = arr[fxUsed[kind]++];
    if (o.parent !== world.fx) world.fx.add(o);
    o.visible = true;
    return o;
  }
  function orbSprite(r, color, core, opacity = 1, scaleK = 1) {
    const s = take('sprites', () => new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })));
    const c = orb(r, color, core);
    s.material.map = texOf(c); s.material.opacity = opacity; s.material.color.set('#ffffff');
    s.scale.set(c.width / 16 * scaleK, c.height / 16 * scaleK, 1);
    return s;
  }
  function groundRing(x, z, rx, rz, color, opacity, width = 0.12) {
    const m = take('rings', () => { const me = new THREE.Mesh(new THREE.RingGeometry(0.88, 1, 48), new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide })); me.rotation.x = -Math.PI / 2; return me; });
    m.material.color.set(color); m.material.opacity = opacity;
    m.scale.set(rx, rz, 1);
    m.position.set(x, 0.04, z);
    return m;
  }
  function groundDisc(x, z, rx, rz, color, opacity) {
    const m = take('planes', () => { const me = new THREE.Mesh(new THREE.CircleGeometry(1, 32), new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide })); me.rotation.x = -Math.PI / 2; return me; });
    m.material.color.set(color); m.material.opacity = opacity; m.material.blending = THREE.NormalBlending;
    m.scale.set(rx, rz, 1); m.rotation.z = 0;
    m.position.set(x, 0.03, z);
    return m;
  }
  function beam(x, y, z, ang, len, width, color, opacity) {
    const m = take('planes', () => { const me = new THREE.Mesh(new THREE.CircleGeometry(1, 32), new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide })); me.rotation.x = -Math.PI / 2; return me; });
    // reuse the disc as a stretched quad-ish beam: wide ellipse along the angle
    m.material.color.set(color); m.material.opacity = opacity; m.material.blending = THREE.AdditiveBlending;
    m.scale.set(len / 2, width / 2, 1);
    m.rotation.z = -ang;
    m.position.set(x + Math.cos(ang) * len / 2, y, z + Math.sin(ang) * len / 2);
    return m;
  }
  function ghost(img, x, z, ax, ay, opacity, color) {
    const me = take('billboards', () => { const tex = texOf(GFX.canvas(1, 1)); const b = new THREE.Mesh(billboardGeo, new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide })); return b; });
    const t = texOf(GFX.tint(img, color));
    me.material.map = t; me.material.opacity = opacity;
    me.scale.set(img.width / 16, img.height / 16, 1);
    placeLeaning(me, x, z, img.width, img.height, ax, ay);
    return me;
  }

  function syncFx() {
    fxUsed = { sprites: 0, rings: 0, planes: 0, billboards: 0 };
    const H0 = DATA.HEROES[G.active] || { kiColor: '#ffffff', kiCore: '#ffffff' };
    // shots, with a few of them carrying real light
    let li = 0;
    const lights = world.pool;
    for (const s of G.shots) {
      const x = s.x / 16, z = (s.y + s.h) / 16, y = s.h / 16 + 0.25;
      const halo = orbSprite(s.r + 2, s.color, s.color, 0.45, 1.25); halo.position.set(x, y, z);
      const core = orbSprite(s.r, s.color, s.core || '#ffffff', 1); core.position.set(x, y, z + 0.01);
      groundDisc(x, z, s.r / 16 + 0.1, (s.r / 16 + 0.1) * 0.6, '#000000', 0.22);
      if (li < lights.length) { const l = lights[li++]; l.color.set(s.color); l.intensity = s.big ? 4 : 2.2; l.position.set(x, y + 0.2, z); }
    }
    const p = G.player;
    // charge and overdrive glows also borrow a light
    if (p && (p.state === 'charge' && p.t > 0.18 || p.od) && li < lights.length) {
      const l = lights[li++]; l.color.set(H0.kiColor); l.intensity = p.od ? 3 : 2 + Math.sin(G.t * 30); l.position.set(p.x / 16, 1.1, p.y / 16);
      const o = orbSprite(11, H0.kiColor, p.od ? '#ffffff' : H0.kiColor, p.od ? 0.22 : 0.3, 1.3); o.position.set(p.x / 16, 0.95, p.y / 16 + 0.05);
    }
    for (let i = li; i < lights.length; i++) lights[i].intensity = 0;
    if (p && p.guard > 0) groundRing(p.x / 16, p.y / 16, 0.9, 0.7, '#5ad8ff', 0.55 + 0.25 * Math.sin(G.t * 25));
    if (p && p.state === 'beam') {
      const v = DIRV[p.dir], ang = Math.atan2(v[1], v[0]);
      const len = beamLength(p.x, p.y - 12, p.dir) / 16;
      beam(p.x / 16 + v[0] * 0.3, 0.75, p.y / 16 + v[1] * 0.3, ang, len, 0.75, H0.kiColor, 0.85);
      beam(p.x / 16 + v[0] * 0.3, 0.76, p.y / 16 + v[1] * 0.3, ang, len, 0.28, '#ffffff', 0.9);
    }
    for (const hz of G.hazards) {
      if (hz.kind === 'shock') {
        const op = Math.max(0, 0.85 - (hz.fade || 0) * 5);
        groundRing(hz.x / 16, hz.y / 16, hz.r / 16, hz.r / 16 * 0.75, hz.color, op);
        groundRing(hz.x / 16, hz.y / 16, Math.max(0.01, (hz.r - 3) / 16), Math.max(0.01, (hz.r - 3) / 16) * 0.75, '#ffffff', op * 0.7);
      } else if (hz.kind === 'stamp') {
        const k = Math.min(1, hz.t / hz.delay);
        if (!hz.fired) groundDisc(hz.x / 16, hz.y / 16, hz.r / 16 * (0.4 + 0.6 * k), hz.r / 16 * 0.7 * (0.4 + 0.6 * k), Math.floor(G.t * 12) % 2 ? '#e0303a' : '#701a28', 0.25 + 0.35 * k);
        if (hz.fired || k > 0.35) {
          const drop = hz.fired ? 0 : (1 - k * k) * 5;
          const img = SPR.stamp;
          const me = take('billboards', () => new THREE.Mesh(billboardGeo, new THREE.MeshBasicMaterial({ transparent: true, side: THREE.DoubleSide })));
          me.material.map = texOf(img); me.material.opacity = 1; me.material.blending = THREE.NormalBlending; me.material.depthWrite = true; me.material.alphaTest = 0.5;
          me.scale.set(img.width / 16, img.height / 16, 1);
          placeLeaning(me, hz.x / 16, hz.y / 16, img.width, img.height, img.width / 2, img.height - 1, drop);
        }
      }
    }
    for (const e of G.enemies) {
      if (!e.boss || !e.atk_) continue;
      const A = e.atk_;
      const isCharge = A.k === 'charge' || (A.k === 'mimic' && A.sub === 'charge');
      const isBeam = A.k === 'beam' || (A.k === 'mimic' && A.sub === 'beam');
      if (isCharge && A.s === 0 && A.ang !== undefined) {
        beam(e.x / 16, 0.05, e.y / 16, A.ang, 7, 0.18, Math.floor(G.t * 14) % 2 ? '#ff5a5a' : '#ffd84a', 0.8);
      }
      if (isBeam && A.ang !== undefined) {
        if (A.s === 0) beam(e.x / 16, 0.9, e.y / 16 - 0.2, A.ang, 26, 0.1, '#ff5a5a', 0.5 + 0.5 * Math.sin(G.t * 40));
        else if (A.s === 1) {
          beam(e.x / 16, 0.9, e.y / 16 - 0.2, A.ang, 26, 1.0, A.color || '#c8a8ff', 0.9);
          beam(e.x / 16, 0.91, e.y / 16 - 0.2, A.ang, 26, 0.38, '#ffffff', 0.95);
        }
      }
    }
    for (const q of G.parts) if (q.ghost) ghost(q.img, q.x / 16, q.y / 16, q.ox, q.oy, q.life / q.max * 0.5, H0.kiColor);
    for (const d of G.drops) {
      if (d.t > 11 && Math.floor(d.t * 8) % 2) continue;
      if (d.kind === 'coin') {
        const s = orbSprite(2, '#ffd84a', '#fff2a0', 1, 1);
        s.position.set(d.x / 16, 0.25 + d.z / 16, d.y / 16);
        s.scale.x *= 0.4 + 0.6 * Math.abs(Math.cos(d.t * 6));
      } else {
        const c = itemCanvas(d.item);
        const me = take('billboards', () => new THREE.Mesh(billboardGeo, new THREE.MeshBasicMaterial({ transparent: true, side: THREE.DoubleSide })));
        me.material.map = texOf(c); me.material.opacity = 1; me.material.blending = THREE.NormalBlending; me.material.alphaTest = 0.5; me.material.depthWrite = true;
        me.scale.set(c.width / 16, c.height / 16, 1);
        placeLeaning(me, d.x / 16, d.y / 16, c.width, c.height, c.width / 2, c.height - 1, d.z / 16);
      }
    }
    for (const kind in fxPool) for (let i = fxUsed[kind]; i < fxPool[kind].length; i++) fxPool[kind][i].visible = false;
  }
  const itemCanvases = {};
  function itemCanvas(k) {
    if (!itemCanvases[k]) { const c = GFX.canvas(10, 10); UI.itemIcon(c.getContext('2d'), k, 0, 0); itemCanvases[k] = c; }
    return itemCanvases[k];
  }

  /* ── camera ───────────────────────────────────────────── */
  function camTarget() {
    const m = world.m, p = G.player;
    if (G.camOverride) return G.camOverride;
    if (!p) return { x: m.w / 2, z: m.h / 2 };
    const v = DIRV[p.dir] || [0, 0];
    let x = p.x / 16 + v[0] * 0.8, z = p.y / 16 + v[1] * 0.5;
    // keep the edge of the model from swinging too far into view
    const vw = 2 * DIST * Math.tan(FOV * Math.PI / 360) * cam.aspect;
    const mx = Math.min(m.w / 2, Math.max(0, vw / 2 - 2.5)), mz = Math.min(m.h / 2, 4);
    x = m.w > vw - 3 ? Math.max(mx, Math.min(m.w - mx, x)) : m.w / 2;
    z = Math.max(mz, Math.min(m.h - 2, z));
    return { x, z };
  }
  function snap() {
    const t = camTarget();
    target.set(t.x, 0.6, t.z);
    placeCam();
  }
  function placeCam() {
    camPos.set(target.x, target.y + Math.sin(PITCH) * DIST, target.z + Math.cos(PITCH) * DIST);
    cam.position.copy(camPos);
    if (G.shake > 0) { const k = Math.min(1, G.shake * 4) * 0.12; cam.position.x += (Math.random() - 0.5) * k; cam.position.y += (Math.random() - 0.5) * k; }
    cam.lookAt(target);
    const s = world.sun, d = world.mood.sunDir;
    s.position.set(target.x + d[0] * 18, d[1] * 18, target.z + d[2] * 18);
    s.target.position.set(target.x, 0, target.z);
  }

  /* ── the frame ────────────────────────────────────────── */
  function render(dt) {
    if (!world) return;
    time += dt;
    const t = camTarget();
    const k = 1 - Math.pow(0.002, dt);
    target.x += (t.x - target.x) * k; target.z += (t.z - target.z) * k;
    if (Math.abs(t.x - target.x) > 12 || Math.abs(t.z - target.z) > 12) { target.x = t.x; target.z = t.z; }
    placeCam();
    syncProps(); syncActors(); syncParticles(); syncFx();
    if (world.water) world.water.uniforms.t.value = time;
    if (world.lavaMat) world.lavaMat.emissiveIntensity = 1.0 + 0.3 * Math.sin(time * 2.2);
    for (const { l, L } of world.lights) {
      let on = L.when ? L.when() : true;
      l.intensity = on ? L.i * (L.flicker ? 0.85 + 0.15 * Math.sin(time * 13 + L.x) * Math.sin(time * 7.3) : 1) : 0;
    }
    renderer.setRenderTarget(rt);
    renderer.render(scene, cam);
    renderer.setRenderTarget(null);
    renderer.render(postScene, postCam);
  }

  /* world pixel position + height (tiles) → UI canvas coordinates */
  const v3 = new THREE.Vector3();
  function toScreen(px, py, h = 0) {
    if (!world) return { x: -99, y: -99 };
    v3.set(px / 16, h, py / 16).project(cam);
    return { x: (v3.x + 1) / 2 * VW, y: (1 - v3.y) / 2 * VH };
  }

  return { init, resize, buildMap, render, toScreen, snap, setQuality: (q) => { quality = q; }, get quality() { return quality; }, get ready() { return !!world; } };
})();
