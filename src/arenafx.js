// Living arenas: the 3D dressing added to every stage. Centrepiece decal (61), breakable
// props (62), hazards (63), water glints (64), birds (65), crowds with cameos and a press
// pack (58, 66, 79), weather (60), billboards (67) and the DC-3's smoke (46).
import * as THREE from 'three';
import { ARENA_META, CAMEOS, Crowd, HAZARDS, Prop, billboardFor, hazardAt, hazardHits } from './arenadata.js';
import { debris, plume } from './comicfx.js';
import { toon } from './kit.js';
import { $, rand } from './util.js';

const canvasTex = (w, h, draw) => { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; };
const INK = '#2a201c';

// ---- 61: painted floor centrepiece
function centrepieceTex(kind) {
  return canvasTex(512, 512, (g, W) => {
    const c = W / 2, ring = (r, fill, lw = 8) => { g.beginPath(); g.arc(c, c, r, 0, 7); if (fill) { g.fillStyle = fill; g.fill(); } g.lineWidth = lw; g.strokeStyle = INK; g.stroke(); };
    g.lineJoin = g.lineCap = 'round';
    if (kind === 'octagon') {
      g.beginPath(); for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2 + Math.PI / 8; g.lineTo(c + Math.cos(a) * 240, c + Math.sin(a) * 240); }
      g.closePath(); g.fillStyle = '#b9a48a'; g.fill(); g.lineWidth = 10; g.strokeStyle = INK; g.stroke();
      g.beginPath(); for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2, r = i % 2 ? 80 : 200; g.lineTo(c + Math.cos(a) * r, c + Math.sin(a) * r); } g.closePath(); g.fillStyle = '#7a1f1f'; g.fill(); g.stroke();
    } else if (kind === 'koru') {
      ring(240, '#3f7a3a'); g.lineWidth = 26; g.strokeStyle = '#f4efe2'; g.beginPath();
      for (let t = 0; t < 14; t += .05) { const r = 200 * Math.exp(-t * .17); g.lineTo(c + Math.cos(t) * r, c + Math.sin(t) * r); } g.stroke();
    } else if (kind === 'fern') {
      ring(240, '#1f3a2a'); g.strokeStyle = '#d8dde0'; g.lineWidth = 10; g.beginPath(); g.moveTo(c, c + 200); g.quadraticCurveTo(c + 40, c, c - 10, c - 210); g.stroke();
      for (let i = 1; i < 18; i++) { const u = i / 18, y = c + 200 - u * 410, x = c + 40 * Math.sin(u * 3) - 10 * u, l = 120 * Math.sin(u * Math.PI) + 20;
        g.lineWidth = 7; g.beginPath(); g.moveTo(x, y); g.lineTo(x - l, y - 25); g.moveTo(x, y); g.lineTo(x + l, y - 25); g.stroke(); }
    } else if (kind === 'rose') {
      ring(240, '#2d3f6e'); for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; g.beginPath(); g.arc(c + Math.cos(a) * 140, c + Math.sin(a) * 140, 60, 0, 7); g.fillStyle = ['#d8232f', '#f5c400', '#3a8a3a', '#3f8fe0'][i % 4]; g.fill(); g.lineWidth = 6; g.strokeStyle = INK; g.stroke(); }
      ring(70, '#f5c400');
    } else if (kind === 'mosaic' || kind === 'tiles') {
      ring(240, '#f4efe2'); const s = kind === 'mosaic' ? 40 : 64;
      g.save(); g.beginPath(); g.arc(c, c, 230, 0, 7); g.clip();
      for (let x = 0; x < W; x += s) for (let y = 0; y < W; y += s) { g.fillStyle = (kind === 'mosaic' ? ['#e8603c', '#3f8fe0', '#f5c400', '#2d9b3a', '#f4efe2'] : ['#1a1a1a', '#f4efe2'])[((x + y) / s + (kind === 'mosaic' ? x * 7 % 5 : 0)) % (kind === 'mosaic' ? 5 : 2) | 0]; g.fillRect(x + 2, y + 2, s - 4, s - 4); }
      g.restore(); ring(234, null, 12);
    } else if (kind === 'crest' || kind === 'mat') {
      g.fillStyle = kind === 'mat' ? '#2f6a3c' : '#b9a48a'; g.beginPath(); g.ellipse(c, c, 240, 240, 0, 0, 7); g.fill(); g.lineWidth = 10; g.strokeStyle = INK; g.stroke();
      g.strokeStyle = '#d9b44a'; g.lineWidth = 8; g.beginPath(); g.ellipse(c, c, 200, 200, 0, 0, 7); g.stroke();
      g.beginPath(); g.moveTo(c - 90, c - 110); g.lineTo(c + 90, c - 110); g.lineTo(c + 90, c + 20); g.quadraticCurveTo(c + 80, c + 110, c, c + 140); g.quadraticCurveTo(c - 80, c + 110, c - 90, c + 20); g.closePath();
      g.fillStyle = kind === 'mat' ? '#1f4a2a' : '#7a1f1f'; g.fill(); g.strokeStyle = INK; g.stroke();
      for (let i = 0; i < 4; i++) { g.fillStyle = '#f4efe2'; g.beginPath(); g.arc(c - 40 + (i % 2) * 80, c - 60 + (i >> 1) * 80, 16, 0, 7); g.fill(); }
    } else { // compass
      ring(240, '#cfc6b0');
      for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2, r = i % 2 ? 120 : 220; g.beginPath(); g.moveTo(c, c); g.lineTo(c + Math.cos(a - .18) * 50, c + Math.sin(a - .18) * 50); g.lineTo(c + Math.cos(a) * r, c + Math.sin(a) * r); g.lineTo(c + Math.cos(a + .18) * 50, c + Math.sin(a + .18) * 50); g.closePath(); g.fillStyle = i % 2 ? '#7a8590' : '#1b3f8f'; g.fill(); g.lineWidth = 6; g.strokeStyle = INK; g.stroke(); }
    }
  });
}
function centrepiece(g, kind) {
  const m = new THREE.Mesh(new THREE.CircleGeometry(3.2, kind === 'octagon' ? 8 : 64), toon(0xffffff, { halftone:false, opacity:.92 }));
  m.material.map = centrepieceTex(kind); m.material.alphaTest = .02;
  m.rotation.x = -Math.PI / 2; if (kind === 'octagon') m.rotation.z = Math.PI / 8; m.position.set(0, .015, .4); m.receiveShadow = true;
  m.scale.y = .55; m.userData.centrepiece = kind; g.add(m);
}

// ---- 62: breakable props by the edges of the arena
const PROP_KINDS = {
  cone:g => { const c = new THREE.Mesh(new THREE.ConeGeometry(.35, .9, 16), toon(0xff6a00)); c.position.y = .45; g.add(c); },
  lectern:g => { const b = new THREE.Mesh(new THREE.BoxGeometry(.7, 1.1, .5), toon(0x6b3e1e)); b.position.y = .55; g.add(b); const t = new THREE.Mesh(new THREE.BoxGeometry(.9, .08, .6), toon(0x8a5a2e)); t.position.y = 1.15; t.rotation.z = -.15; g.add(t); },
  table:g => { const t = new THREE.Mesh(new THREE.CylinderGeometry(.5, .5, .06, 20), toon(0xf4efe2)); t.position.y = .8; g.add(t); const l = new THREE.Mesh(new THREE.CylinderGeometry(.05, .08, .8, 8), toon(0x333333)); l.position.y = .4; g.add(l);
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(.08, .06, .14, 10), toon(0xffffff)); cup.position.set(.15, .9, 0); g.add(cup); },
  flowerbox:g => { const b = new THREE.Mesh(new THREE.BoxGeometry(1, .45, .45), toon(0x9a4a2a)); b.position.y = .22; g.add(b);
    for (let i = 0; i < 5; i++) { const f = new THREE.Mesh(new THREE.SphereGeometry(.14, 8, 6), toon([0xe0302a, 0xf5c400, 0xffffff][i % 3])); f.position.set(-.4 + i * .2, .55, 0); g.add(f); } },
};
const PROPS_FOR = { viaduct:'cone', beehive:'lectern', cathedral:'table', octagon:'flowerbox', queenstown:'table', waitangi:'flowerbox', taupo:'table', mauao:'cone', chamber:'lectern', aoraki:'cone', cuba:'table', ponsonby:'table', committee:'lectern' };
function makeProps(g, id) {
  const kind = PROPS_FOR[id] ?? 'cone';
  return [-8.6, 8.6].map(x => {
    const grp = new THREE.Group(); PROP_KINDS[kind](grp); grp.position.set(x, 0, -.7);
    grp.traverse(o => { if (o.isMesh) { o.castShadow = true; o.material = o.material; } });
    grp.userData.prop = kind; g.add(grp);
    return Object.assign(new Prop(10), { x, group:grp, wob:0, wobV:0, cool:0 });
  });
}

// ---- 58 + 66: crowd of generic cameo figures (never real people) and a press pack
function figureTex(kind, hue) {
  return canvasTex(128, 192, (g) => {
    g.lineJoin = 'round'; g.lineWidth = 5; g.strokeStyle = INK;
    g.fillStyle = hue; g.beginPath(); g.roundRect(34, 80, 60, 110, 22); g.fill(); g.stroke();
    g.fillStyle = ['#f0c8a8', '#c99070', '#9a6a4c', '#f4d8c0'][(hue.charCodeAt(2) + kind.length) % 4]; g.beginPath(); g.arc(64, 58, 26, 0, 7); g.fill(); g.stroke();
    g.fillStyle = INK; g.fillRect(52, 54, 6, 6); g.fillRect(70, 54, 6, 6);
    if (kind === 'press') { g.fillStyle = '#222'; g.fillRect(70, 92, 44, 30); g.strokeRect(70, 92, 44, 30); g.fillStyle = '#8fd3ff'; g.beginPath(); g.arc(92, 107, 9, 0, 7); g.fill(); }
    if (kind === 'protester' || kind === 'student') { g.fillStyle = '#fff'; g.fillRect(4, 6, 120, 34); g.strokeRect(4, 6, 120, 34); g.fillStyle = INK; g.font = '20px Bangers, Impact'; g.textAlign = 'center'; g.fillText(kind === 'student' ? 'FREE FEES!' : 'NOT MY MP', 64, 31); }
    if (kind === 'tourist') { g.beginPath(); g.moveTo(90, 90); g.lineTo(122, 30); g.stroke(); g.fillStyle = '#222'; g.fillRect(114, 18, 14, 18); }
    if (kind === 'pensioner') { g.fillStyle = '#c8102e'; g.fillRect(84, 120, 16, 34); g.strokeRect(84, 120, 16, 34); }
    if (kind === 'lobbyist') { g.fillStyle = '#222'; g.fillRect(84, 40, 10, 26); }
  });
}
function makeCrowd(g, indoor) {
  const fig = [], cols = ['#c8102e', '#1b3f8f', '#f5c400', '#2d9b3a', '#444', '#e0e0e0', '#7a4a9a', '#e8603c'];
  const n = 14, R = indoor ? 22 : 25.5, y0 = indoor ? 4.2 : .7;
  for (let i = 0; i < n; i++) {
    const cam = i % 5 === 2 ? CAMEOS[0] : CAMEOS[1 + (i % (CAMEOS.length - 1))], a = Math.PI + (i / (n - 1) - .5) * 1.9;
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map:figureTex(cam.kind, cols[i % cols.length]) }));
    s.scale.set(.95, 1.42, 1); s.position.set(Math.sin(a) * R, y0 + .7, 8 + Math.cos(a) * R); s.userData.crowd = cam.kind; if (cam.kind === 'press') s.userData.press = true;
    g.add(s); fig.push({ s, y:s.position.y, ph:rand(0, 6), press:cam.kind === 'press' });
  }
  return fig;
}
function flash(g, at) { // a press camera flash (79)
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ color:0xffffff, transparent:true, opacity:1, depthWrite:false }));
  s.position.copy(at).add(new THREE.Vector3(.2, .1, .2)); s.scale.setScalar(1.2); g.add(s);
  return { s, t:0 };
}

// ---- 65: birds crossing the sky
const BIRD_COL = { gulls:['#f4f4f4', '#9aa2ac'], tui:['#1a2a2a', '#f4f4f4'], kereru:['#3f7a3a', '#f4f4f4'], birdsong:['#7a5a3a', '#d8c8a0'] };
function birdTex(kind) {
  const [body, mark] = BIRD_COL[kind] ?? BIRD_COL.gulls;
  return canvasTex(96, 48, (g) => { g.lineJoin = 'round'; g.lineWidth = 4; g.strokeStyle = INK; g.fillStyle = body;
    g.beginPath(); g.moveTo(4, 18); g.quadraticCurveTo(28, 2, 48, 26); g.quadraticCurveTo(68, 2, 92, 18); g.quadraticCurveTo(66, 16, 48, 36); g.quadraticCurveTo(30, 16, 4, 18); g.fill(); g.stroke();
    g.fillStyle = mark; g.beginPath(); g.arc(48, 30, 5, 0, 7); g.fill(); });
}

// ---- 60: weather props
const umbrellaTex = () => canvasTex(128, 128, (g) => { g.lineWidth = 5; g.strokeStyle = INK; g.fillStyle = ['#c8102e', '#1b3f8f', '#f5c400'][(Math.random() * 3) | 0];
  g.beginPath(); g.moveTo(8, 60); g.quadraticCurveTo(64, -10, 120, 60); g.quadraticCurveTo(100, 52, 86, 62); g.quadraticCurveTo(64, 50, 42, 62); g.quadraticCurveTo(28, 52, 8, 60); g.fill(); g.stroke();
  g.beginPath(); g.moveTo(64, 56); g.lineTo(64, 116); g.quadraticCurveTo(64, 124, 54, 120); g.stroke(); });

// ---- the controller: built per stage, ticked per frame
function dressStage(g, st, { round = 1, game, onHazardHit }) {
  const meta = ARENA_META[st.id] ?? {}, fx = { st, meta, crowd:new Crowd(), props:[], figures:[], flashes:[], birds:[], umbrellas:[], t:0, birdT:rand(2, 5), hazardT:0, hazardHit:new Set(), haze:0 };
  centrepiece(g, meta.centre ?? 'compass');
  fx.props = makeProps(g, st.id);
  fx.figures = makeCrowd(g, meta.indoor);
  // billboard (67)
  const bbCanvas = document.createElement('canvas'); bbCanvas.width = 1024; bbCanvas.height = 192;
  const bbTex = new THREE.CanvasTexture(bbCanvas); bbTex.colorSpace = THREE.SRGBColorSpace;
  const bb = new THREE.Mesh(new THREE.PlaneGeometry(7, 1.3), new THREE.MeshBasicMaterial({ map:bbTex }));
  const ink = new THREE.Mesh(new THREE.PlaneGeometry(7.3, 1.6), new THREE.MeshBasicMaterial({ color:0x111111 })); ink.position.z = -.02; bb.add(ink);
  bb.position.set(-11, meta.indoor ? 6.2 : 4.4, -12); bb.rotation.y = .5; bb.userData.billboard = true; g.add(bb);
  fx.setRound = r => {
    fx.billboard = billboardFor(st.id, r);
    const c = bbCanvas.getContext('2d'); c.fillStyle = '#ffd23f'; c.fillRect(0, 0, 1024, 192); c.lineWidth = 14; c.strokeStyle = INK; c.strokeRect(7, 7, 1010, 178);
    c.font = '78px Bangers, Impact'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = INK; c.fillText(fx.billboard, 512, 100, 960); bbTex.needsUpdate = true;
  };
  fx.setRound(round);
  // water glints (64)
  if (meta.water) {
    const [p0, p1] = meta.water, y0 = 14.8 - p1 / 64, y1 = 14.8 - p0 / 64, h = y1 - y0;
    const tex = canvasTex(2048, 128, (q, W, H) => { q.strokeStyle = 'rgba(255,255,255,.75)'; q.lineCap = 'round';
      for (let i = 0; i < 260; i++) { const y = Math.random() * H, x = Math.random() * W, l = 8 + y * .3; q.lineWidth = 2 + y / H * 3; q.beginPath(); q.moveTo(x, y); q.lineTo(x + l, y); q.stroke(); } });
    tex.wrapS = THREE.RepeatWrapping; tex.repeat.x = 2;
    const geo = new THREE.CylinderGeometry(26.85, 26.85, h, 120, 1, true, Math.PI - 1.225, 2.45);
    const w = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map:tex, transparent:true, opacity:.55, side:THREE.BackSide, depthWrite:false, fog:false }));
    w.position.set(0, y0 + h / 2, 8); w.userData.water = true; g.add(w); fx.water = { w, tex, y:w.position.y };
  }
  // weather (60)
  if (meta.weather === 'drizzle') for (let i = 0; i < 5; i++) {
    const p = new THREE.Mesh(new THREE.CircleGeometry(rand(.6, 1.2), 24), new THREE.MeshBasicMaterial({ color:0x4a5a7a, transparent:true, opacity:.35, depthWrite:false }));
    p.rotation.x = -Math.PI / 2; p.scale.y = .5; p.position.set(rand(-9, 9), .02, rand(-3, 2)); p.userData.puddle = true; g.add(p);
    const ring = new THREE.Mesh(new THREE.RingGeometry(.9, 1, 32), new THREE.MeshBasicMaterial({ color:0xdde8f5, transparent:true, opacity:.5, depthWrite:false }));
    ring.position.z = .01; p.add(ring); (fx.puddles ??= []).push({ ring, t:rand(0, 1) });
  }
  if (meta.weather === 'snow') {
    const N = 700, pos = new Float32Array(N * 3); for (let i = 0; i < N; i++) { pos[i * 3] = rand(-18, 18); pos[i * 3 + 1] = rand(0, 14); pos[i * 3 + 2] = rand(-12, 8); }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    fx.snow = new THREE.Points(geo, new THREE.PointsMaterial({ color:0xffffff, size:.12, transparent:true, opacity:.9 })); fx.snow.userData.snow = true; g.add(fx.snow);
  }
  if (meta.weather === 'haze') fx.haze = 1;
  if (st.id === 'taupo') fx.smoke = plume(12.6, 5.3, -14.6, { rate:.5, size:.7, rise:.8, life:2.4, spread:.15 }); // the DC-3 on its pole (46)
  // hazards (63)
  if (meta.hazard) {
    const h = new THREE.Group(); h.visible = false; h.position.z = .2; g.add(h);
    if (meta.hazard === 'tram') {
      const add = (w, hh, d, c, x, y) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, hh, d), toon(c)); m.position.set(x, y, 0); m.castShadow = true; h.add(m); };
      add(6, 2.4, 2.2, 0x7a1f1f, 0, 1.6); add(6.2, .3, 2.4, 0xe8dcc0, 0, 2.95); add(6, .5, 2.25, 0x2a4a2a, 0, .55);
      for (let i = 0; i < 5; i++) add(.8, .8, 2.25, 0xfaf3d6, -2.2 + i * 1.1, 2);
    } else for (let i = 0; i < 7; i++) { // a stampede of sheep
      const s = new THREE.Mesh(new THREE.SphereGeometry(.6, 10, 8), toon(0xfafafa)); s.scale.set(1.3, .9, 1); s.position.set(rand(-1.5, 1.5), .7, rand(-1, 1)); s.castShadow = true; h.add(s);
      const hd = new THREE.Mesh(new THREE.SphereGeometry(.28, 8, 6), toon(0x1a1a1a)); hd.position.set(s.position.x + .8, .9, s.position.z); h.add(hd);
    }
    fx.hazard = { kind:meta.hazard, g:h };
  }
  fx.skipHazardTo = s => { fx.hazardT = HAZARDS[fx.hazard.kind].period - Math.abs(s); };
  fx.props = fx.props; fx.billboardText = () => fx.billboard;

  fx.react = kind => {
    fx.crowd.react(kind);
    if (['special', 'kick', 'throw', 'super', 'ko'].includes(kind)) for (const f of fx.figures) if (f.press && Math.random() < .8) fx.flashes.push(flash(g, f.s.position));
  };

  fx.tick = (dt, fighters) => {
    fx.t += dt; const lvl = fx.crowd.step(dt);
    for (const f of fx.figures) { f.s.position.y = f.y + Math.abs(Math.sin(fx.t * (3 + lvl * 9) + f.ph)) * (.04 + lvl * .4); }
    for (let i = fx.flashes.length - 1; i >= 0; i--) { const fl = fx.flashes[i]; fl.t += dt; fl.s.material.opacity = 1 - fl.t / .12; if (fl.t > .12) { g.remove(fl.s); fl.s.material.dispose(); fx.flashes.splice(i, 1); } }
    // props: fighters knocked into them
    for (const p of fx.props) {
      p.cool -= dt; p.wobV += (-p.wob * 60 - p.wobV * 6) * dt; p.wob += p.wobV * dt; p.group.rotation.z = p.wob;
      if (p.broken || p.cool > 0) continue;
      for (const f of fighters) if (['hit', 'stunned', 'thrown', 'down'].includes(f.state) && Math.abs(f.vx) > 2.5 && Math.abs(f.x - p.x) < .95 && f.y < 1.5) {
        const r = p.hit(4); p.cool = .15; f.vx *= -.3;
        if (r === 'wobble') p.wobV = 6 * Math.sign(f.vx || 1);
        if (r === 'break') { p.group.visible = false; debris(p.x, .8, 'throw', Math.sign(p.x)); }
      }
    }
    // birds (65)
    if (fx.meta.birds && (fx.birdT -= dt) <= 0) {
      fx.birdT = rand(6, 12); const dir = Math.random() < .5 ? 1 : -1, tex = birdTex(fx.meta.birds), y = rand(8.5, 11.5);
      for (let i = 0; i < 4; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map:tex, transparent:true, fog:false })); s.scale.set(.9, .45, 1); s.position.set(-22 * dir - i * 1.4 * dir, y + (i % 2) * .6, -16 - i * .3); g.add(s); fx.birds.push({ s, dir, ph:rand(0, 6) }); }
    }
    for (let i = fx.birds.length - 1; i >= 0; i--) { const b = fx.birds[i]; b.s.position.x += b.dir * dt * 3.2; b.s.scale.y = .45 * (.35 + .65 * Math.abs(Math.sin(fx.t * 9 + b.ph))); if (Math.abs(b.s.position.x) > 26) { g.remove(b.s); b.s.material.dispose(); fx.birds.splice(i, 1); } }
    if (fx.water) { fx.water.tex.offset.x = (fx.t * .006) % 1; fx.water.w.position.y = fx.water.y + Math.sin(fx.t * 1.3) * .04; }
    if (fx.puddles) for (const p of fx.puddles) { p.t = (p.t + dt * .8) % 1; p.ring.scale.setScalar(.2 + p.t); p.ring.material.opacity = .5 * (1 - p.t); }
    if (fx.snow) { const a = fx.snow.geometry.attributes.position.array; for (let i = 1; i < a.length; i += 3) { a[i] -= dt * 1.2; a[i - 1] += Math.sin(fx.t + i) * dt * .3; if (a[i] < 0) a[i] = 14; } fx.snow.geometry.attributes.position.needsUpdate = true; }
    // umbrellas in a strong wind
    const gust = fx.meta.weather === 'wind' ? Math.max(.35, Math.abs(game.wind) / 2.6) : 0; // windy places always have the odd umbrella loose
    if (gust && Math.random() < dt * 1.2 * gust && fx.umbrellas.length < 4) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map:umbrellaTex(), transparent:true })); s.scale.setScalar(1.1);
      const d = Math.sign(game.wind) || 1; s.position.set(-16 * d, rand(1.5, 6), rand(-6, -2)); s.userData.umbrella = true; g.add(s); fx.umbrellas.push({ s, d, spin:rand(-4, 4) });
    }
    for (let i = fx.umbrellas.length - 1; i >= 0; i--) { const u = fx.umbrellas[i]; u.s.position.x += u.d * dt * 7; u.s.position.y += Math.sin(fx.t * 4 + i) * dt; u.s.material.rotation += u.spin * dt; if (Math.abs(u.s.position.x) > 18) { g.remove(u.s); u.s.material.map.dispose(); u.s.material.dispose(); fx.umbrellas.splice(i, 1); } }
    fx.smoke?.(dt);
    // hazards: warn, then cross the fight line (63)
    if (fx.hazard && game.phase === 'fight') {
      fx.hazardT += dt; const hs = hazardAt(fx.hazard.kind, fx.hazardT), el = $('#hazard');
      el.classList.toggle('on', hs.warn); if (hs.warn) el.textContent = fx.hazard.kind === 'tram' ? 'DING DING! TRAM COMING!' : 'STAMPEDE! BAAAA!';
      fx.hazard.g.visible = hs.active;
      if (hs.active) {
        fx.hazard.g.position.x = hs.x;
        for (const f of fighters) if (!fx.hazardHit.has(f) && hazardHits(hs, f.x, f.y, fx.hazard.kind)) { fx.hazardHit.add(f); onHazardHit?.(f, hs.x, HAZARDS[fx.hazard.kind]); }
      } else fx.hazardHit.clear();
    } else if (fx.hazard) { fx.hazard.g.visible = false; $('#hazard')?.classList.remove('on'); }
  };
  return fx;
}

export { dressStage, centrepieceTex, PROPS_FOR };
