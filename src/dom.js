import * as THREE from 'three';
import { _c } from './kit.js';
import { camera } from './renderer.js';
import { SFX_WORDS } from './roster.js';
import { $, clamp, pick, rand } from './util.js';
import { bubbleTail } from './fxlogic.js';

// DOM effects: floaters, comic SFX bursts, speech bubbles, banners

const floatLayer = $('#floaters');
const floaters = [];
const _v = new THREE.Vector3();
function toScreen(p) { _v.copy(p).project(camera); return [(_v.x + 1) / 2 * innerWidth, (1 - _v.y) / 2 * innerHeight, _v.z < 1]; }
function floater(text, x, y, { color = '#fff', size = 30, life = 1.1, rise = 1.4, follow = null, cls = 'floater', rot = 0 } = {}) {
  const el = document.createElement('div'); el.className = cls; el.textContent = text;
  el.style.color = color; el.style.fontSize = size + 'px'; floatLayer.appendChild(el);
  const f = { el, p:new THREE.Vector3(x, y, 0), life, max:life, rise, follow, rot }; floaters.push(f); return f;
}
function sfxWord(x, y, heavy, blue = false) {
  const f = floater(blue ? pick(['BLOCK!', 'NOPE!', 'DENIED!']) : pick(SFX_WORDS), x, y + .3,
    { cls:'sfx' + (blue ? ' blue' : ''), size:heavy ? 44 : 30, life:heavy ? .6 : .45, rise:.6, rot:rand(-18, 18) });
  f.pop = true;
}
const bubbles = new Map();
function bubble(f, text, { dur = 1.8, shout = false } = {}) {
  if (!text) return;
  let b = bubbles.get(f);
  if (!b) { b = { el:document.createElement('div') }; floatLayer.appendChild(b.el); bubbles.set(f, b); }
  b.el.className = 'bubble' + (shout ? ' shout' : ''); b.el.textContent = text; b.life = dur; b.el.style.display = 'block';
  void b.el.offsetWidth; b.el.classList.add('pop');
}
function clearBubbles() { bubbles.forEach(b => b.el.remove()); bubbles.clear(); }
function updateFloaters(dt) {
  for (let i = floaters.length - 1; i >= 0; i--) {
    const f = floaters[i]; f.life -= dt;
    if (f.follow) { f.p.copy(f.follow.position); f.p.y += .9; } else f.p.y += f.rise * dt;
    const [x, y, vis] = toScreen(f.p);
    const age = f.max - f.life, sc = f.pop ? Math.min(1, age * 14) * (1 + Math.max(0, .15 - age) * 3) : 1;
    f.el.style.left = x + 'px'; f.el.style.top = y + 'px';
    f.el.style.transform = `translate(-50%,-50%) rotate(${f.rot}deg) scale(${sc})`;
    f.el.style.opacity = vis ? clamp(f.life / .25, 0, 1) : 0;
    if (f.life <= 0) { f.el.remove(); floaters.splice(i, 1); }
  }
  bubbles.forEach((b, f) => {
    b.life -= dt;
    if (b.life <= 0 || !f.root.parent) { b.el.style.display = 'none'; return; }
    _c.set(f.x, f.y + 3.35 * f.def.build.h, 0);
    const [x, y] = toScreen(_c), w = b.el.offsetWidth || 200, bx = clamp(x, w / 2 + 8, innerWidth - w / 2 - 8);
    b.el.style.left = bx + 'px'; b.el.style.top = y + 'px'; b.el.style.setProperty('--tail', `${bubbleTail(x, bx, w).toFixed(0)}px`);
    b.el.style.opacity = clamp(b.life / .25, 0, 1);
  });
}
function clearFloaters() { floaters.forEach(f => f.el.remove()); floaters.length = 0; clearBubbles(); }

let bannerTimer = 0;
function banner(big, sub = '', ms = 1400) {
  const b = $('#banner .big'), s = $('#banner .sub');
  b.textContent = big; s.textContent = sub;
  b.classList.remove('show'); s.classList.remove('show'); void b.offsetWidth;
  b.classList.add('show'); if (sub) s.classList.add('show');
  clearTimeout(bannerTimer);
  if (ms) bannerTimer = setTimeout(hideBanner, ms);
}
function hideBanner() { $('#banner .big').classList.remove('show'); $('#banner .sub').classList.remove('show'); }
function screenFlash() { const f = $('#flash'); f.classList.remove('go'); void f.offsetWidth; f.classList.add('go'); }

// =====================================================================

export { floatLayer, floaters, _v, toScreen, floater, sfxWord, bubbles, bubble, clearBubbles, updateFloaters, clearFloaters, bannerTimer, banner, hideBanner, screenFlash };
