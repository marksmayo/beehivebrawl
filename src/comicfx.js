// Comic effects that render: 3D lettered sound effects, ink splats, flying paperwork,
// stylised flames and smoke, impact frames, the KO stamp and the combo counter.
import * as THREE from 'three';
import { addFx } from './effects.js';
import { camera, scene } from './renderer.js';
import { comboStyle, debrisFor, flameColor, impactFrameAt, sfxStyle, splatShape } from './fxlogic.js';
import { toon } from './kit.js';
import { $, rand } from './util.js';

const INKC = '#111111';
let seed = 1;

// ---- 42: hand-lettered words with a burst behind, as camera-facing sprites in the scene
const wordTex = new Map();
function letteredTexture({ word, fill }) {
  const key = word + fill;
  if (wordTex.has(key)) return wordTex.get(key);
  const c = document.createElement('canvas'); c.width = 512; c.height = 256; const g = c.getContext('2d');
  // burst
  g.beginPath();
  for (let i = 0; i < 26; i++) { const a = i / 26 * Math.PI * 2, r = i % 2 ? 70 : 118; g.lineTo(256 + Math.cos(a) * r * 1.9, 128 + Math.sin(a) * r * .95); }
  g.closePath(); g.fillStyle = fill === '#ffffff' ? '#ffd23f' : '#ffffff'; g.fill(); g.lineWidth = 8; g.strokeStyle = INKC; g.stroke();
  // lettering: a dark extruded copy, thick ink, then the fill with a highlight band
  g.font = `${word.length > 7 ? 74 : 96}px Bangers, Impact, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
  for (let k = 8; k > 0; k -= 2) { g.fillStyle = '#5a1a0a'; g.fillText(word, 256 + k, 136 + k); }
  g.lineWidth = 16; g.strokeStyle = INKC; g.strokeText(word, 256, 132);
  const grd = g.createLinearGradient(0, 90, 0, 170); grd.addColorStop(0, '#ffffff'); grd.addColorStop(.45, fill); grd.addColorStop(1, fill);
  g.fillStyle = grd; g.fillText(word, 256, 132);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; wordTex.set(key, t); return t;
}
function word3d(x, y, kind, heavy) {
  const st = sfxStyle(kind, heavy, seed++);
  const m = new THREE.Sprite(new THREE.SpriteMaterial({ map:letteredTexture(st), transparent:true, depthTest:false, rotation:st.rot }));
  m.position.set(x, y + .4, 1.2); m.renderOrder = 12; m.userData.fx = 'word'; scene.add(m);
  let t = 0; const s0 = 1.7 * st.scale;
  addFx({ update(dt) {
    t += dt; const pop = t < .08 ? t / .08 * 1.35 : 1.35 - Math.min(.35, (t - .08) * 3);
    m.scale.set(s0 * pop, s0 * pop * .5, 1); m.position.y += dt * .5; m.material.opacity = t < .45 ? 1 : 1 - (t - .45) / .2; return t < .65;
  }, dispose() { scene.remove(m); m.material.dispose(); } });
}

// ---- 44: ink splat (jagged blob + highlight), facing the camera
function splat(x, y, color = 0xffffff, size = .7) {
  const shape = new THREE.Shape(splatShape(seed++).map(([a, b]) => new THREE.Vector2(a, b)));
  const geo = new THREE.ShapeGeometry(shape), g = new THREE.Group();
  const ink = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color:0x111111, transparent:true, depthTest:false }));
  const fill = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, transparent:true, depthTest:false }));
  ink.scale.setScalar(1.16); fill.position.z = .01; ink.renderOrder = 10; fill.renderOrder = 11; g.add(ink, fill);
  g.position.set(x, y, 1); g.lookAt(camera.position); g.rotation.z = rand(0, 6); g.userData.fx = 'splat'; scene.add(g);
  let t = 0;
  addFx({ update(dt) { t += dt; g.scale.setScalar(size * Math.min(1, .3 + t * 9)); const o = 1 - Math.max(0, t - .12) / .18; ink.material.opacity = fill.material.opacity = o; return t < .3; },
    dispose() { scene.remove(g); geo.dispose(); ink.material.dispose(); fill.material.dispose(); } });
}

// ---- 45: policy papers and chunks fly off heavy hits
let paperTex = null;
function paperTexture() {
  if (paperTex) return paperTex;
  const c = document.createElement('canvas'); c.width = 64; c.height = 84; const g = c.getContext('2d');
  g.fillStyle = '#fbfaf2'; g.fillRect(0, 0, 64, 84); g.strokeStyle = '#111'; g.lineWidth = 4; g.strokeRect(2, 2, 60, 80);
  g.fillStyle = '#c8102e'; g.fillRect(10, 10, 30, 6); g.fillStyle = '#9a9a9a'; for (let i = 0; i < 6; i++) g.fillRect(10, 24 + i * 9, 44 - (i % 3) * 8, 3);
  paperTex = new THREE.CanvasTexture(c); paperTex.colorSpace = THREE.SRGBColorSpace; return paperTex;
}
const paperGeo = new THREE.PlaneGeometry(.3, .4), chunkGeo = new THREE.BoxGeometry(.14, .14, .14);
function debris(x, y, kind, dir = 1) {
  const { papers, chunks } = debrisFor(kind); if (!papers && !chunks) return;
  const pm = new THREE.MeshBasicMaterial({ map:paperTexture(), side:THREE.DoubleSide, transparent:true }), cm = toon(0x8a8478, { halftone:false });
  const bits = [];
  for (let i = 0; i < papers + chunks; i++) {
    const paper = i < papers, m = new THREE.Mesh(paper ? paperGeo : chunkGeo, paper ? pm : cm);
    m.position.set(x, y, rand(-.2, .4)); m.userData.fx = paper ? 'paper' : 'chunk'; scene.add(m);
    bits.push({ m, paper, v:new THREE.Vector3(dir * rand(1, 4.5), rand(2, 6), rand(-1, 1.5)), w:new THREE.Vector3(rand(-9, 9), rand(-9, 9), rand(-9, 9)) });
  }
  let t = 0;
  addFx({ update(dt) {
    t += dt;
    for (const b of bits) {
      b.v.y -= (b.paper ? 5 : 16) * dt; if (b.paper) { b.v.multiplyScalar(1 - dt * 1.6); b.m.position.x += Math.sin(t * 6 + b.w.x) * dt * .8; } // paper flutters down
      b.m.position.addScaledVector(b.v, dt); b.m.rotation.x += b.w.x * dt; b.m.rotation.y += b.w.y * dt;
      if (b.m.position.y < .05) { b.m.position.y = .05; b.v.set(0, 0, 0); b.w.multiplyScalar(.9); }
    }
    pm.opacity = Math.min(1, (2.4 - t) / .5); return t < 2.4;
  }, dispose() { bits.forEach(b => scene.remove(b.m)); pm.dispose(); cm.dispose(); } });
}

// ---- 46: stylised flame/smoke puffs: toon blobs that cool from white-yellow to smoke
const puffGeo = new THREE.IcosahedronGeometry(.5, 1);
function flames(x, y, z, { n = 3, size = 1, rise = 2.4, life = 1.1, spread = .5 } = {}) {
  for (let i = 0; i < n; i++) {
    const m = new THREE.Mesh(puffGeo, new THREE.MeshBasicMaterial({ transparent:true, depthWrite:false }));
    const ink = new THREE.Mesh(puffGeo, new THREE.MeshBasicMaterial({ color:0x111111, side:THREE.BackSide, transparent:true, depthWrite:false }));
    ink.scale.setScalar(1.12); m.add(ink); m.position.set(x + rand(-spread, spread), y, z + rand(-.3, .3)); m.userData.fx = 'flame'; scene.add(m);
    const vx = rand(-.3, .3), s = size * rand(.6, 1.1); let t = 0;
    addFx({ update(dt) {
      t += dt; const u = t / life, [r, g, b] = flameColor(u);
      m.material.color.setRGB(r, g, b); m.position.y += rise * dt * (1 - u * .5); m.position.x += vx * dt;
      m.scale.setScalar(s * (.5 + u * 1.3)); m.material.opacity = ink.material.opacity = Math.min(1, (1 - u) * 2.5); return t < life;
    }, dispose() { scene.remove(m); m.material.dispose(); ink.material.dispose(); } });
  }
}
// a steady plume (volcano, chimney): call emit(dt) each frame
function plume(x, y, z, opts = {}) { let acc = 0; const rate = opts.rate ?? .18; return dt => { acc += dt; while (acc > rate) { acc -= rate; flames(x, y, z, { n:1, ...opts }); } }; }

// ---- 41: impact frames (DOM overlay: negative, then black-and-white ink)
let impact = null;
const impactFrame = kind => { impact = { kind, t:0 }; };
function updateImpact(dt) {
  const el = $('#impact'); if (!el) return;
  let cls = '';
  if (impact) { cls = impactFrameAt(impact.t, impact.kind) ?? ''; impact.t += dt; if (!cls) impact = null; } // the first frame is always the negative
  if (el.className !== cls) el.className = cls;
}

// ---- 52: the KO stamp
let stampTimer = 0;
function koStamp(text) {
  const el = $('#kostamp'); el.textContent = text; el.style.setProperty('--r', `${rand(-14, -6)}deg`);
  el.classList.remove('on'); void el.offsetWidth; el.classList.add('on');
  clearTimeout(stampTimer); stampTimer = setTimeout(() => el.classList.remove('on'), 2600);
}

// ---- 53: combo counters, one per side, driven each frame from the fighters
function updateCombos(fighters) {
  fighters.forEach((f, i) => {
    const el = $(`#combo${1 - i}`), n = ['hit', 'stunned'].includes(f.state) ? f.combo : 0; // the attacker's side shows it
    if (n >= 3) {
      const st = comboStyle(n);
      if (el.textContent !== st.label) { el.textContent = st.label; el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); }
      el.style.fontSize = `${st.size}px`; el.style.setProperty('--wob', `${(st.wobble * 30).toFixed(1)}deg`);
      el.classList.add('on');
    } else el.classList.remove('on');
  });
}

function celebrate(f, outfit) {
  if (outfit === 'crown') { f.crown.visible = true; return; }
  const colors = outfit === 'champagne' ? [0xfff3b0, 0xffffff, 0xffe27a] : [0xc8102e, 0xffd23f, 0x3f8fe0, 0x2d9b3a, 0xffffff];
  const geo = outfit === 'champagne' ? new THREE.SphereGeometry(.05, 6, 4) : new THREE.PlaneGeometry(.12, .07), bits = [];
  for (let i = 0; i < 70; i++) {
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color:colors[i % colors.length], side:THREE.DoubleSide, transparent:true }));
    m.position.set(f.x + (outfit === 'champagne' ? f.facing * .5 : rand(-1.5, 1.5)), outfit === 'champagne' ? 2.2 : rand(4, 6), rand(-.5, .5)); m.userData.fx = outfit; scene.add(m);
    bits.push({ m, v:outfit === 'champagne' ? new THREE.Vector3(f.facing * rand(1, 3), rand(4, 8), rand(-1, 1)) : new THREE.Vector3(rand(-.5, .5), rand(-1, 0), rand(-.3, .3)), w:rand(-8, 8) });
  }
  let t = 0;
  addFx({ update(dt) { t += dt; for (const b of bits) { b.v.y -= (outfit === 'champagne' ? 9 : 1.5) * dt; b.m.position.addScaledVector(b.v, dt); b.m.rotation.x += b.w * dt; b.m.rotation.y += b.w * .7 * dt; b.m.position.x += Math.sin(t * 4 + b.w) * dt * .4; if (b.m.position.y < .05) b.v.set(0, 0, 0); }
    for (const b of bits) b.m.material.opacity = Math.min(1, (4 - t) / .6); return t < 4; },
    dispose() { bits.forEach(b => { scene.remove(b.m); b.m.material.dispose(); }); geo.dispose(); } });
  if (outfit === 'champagne') word3d(f.x + f.facing * .6, 2.6, 'special', true);
}

export { celebrate, word3d, splat, debris, flames, plume, impactFrame, updateImpact, koStamp, updateCombos };
