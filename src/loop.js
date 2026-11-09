import * as THREE from 'three';
import { stage } from './arenas.js';
import { noise, say, sfx } from './audio.js';
import { banner, bubble, floater, updateFloaters } from './dom.js';
import { updateFx } from './effects.js';
import { game, nextRoundOrResult, timeUp, toTitle } from './game.js';
import { EMPTY, ctrlFor, padBuf, pollPads, pressed } from './input.js';
import { camera, renderer, scene } from './renderer.js';
import { touchFrame, updateTouchUI } from './touchui.js';
import { $, BOUND, MAXSEP, clamp, damp, pick, rand } from './util.js';

// Camera / HUD / main loop

const camPos = new THREE.Vector3(0, 3.2, 10), camLook = new THREE.Vector3(0, 1.8, 0);
function updateCamera(dt) {
  const [a, b] = game.p; if (!a) return;
  let mx = (a.x + b.x) / 2, dist = Math.abs(a.x - b.x);
  let tx = mx, ty = 3.1, tz = 9.6 + Math.max(0, dist - 3.5) * .62, lx = mx, ly = 1.8;
  if (game.phase === 'title') { const t = performance.now() / 6000; tx = mx + Math.sin(t) * 3.5; tz = 11 + Math.cos(t) * 1.5; ty = 3.6; }
  if (game.phase === 'select') { tx = 0; lx = 0; tz = 8.2; ty = 2.4; ly = 1.9; }
  if (game.phase === 'result') { const w = a.wins > b.wins ? a : b.wins > a.wins ? b : null; if (w) { tx = w.x + 1.2; lx = w.x + 1.2; tz = 6.5; ty = 2.6; ly = 2.2; } }
  if (game.cine) { const f = game.cine.f; tx = f.x + f.facing * .8; lx = tx; tz = 5.2; ty = 2.6; ly = f.y + 2.1; }
  tx = clamp(tx, -7, 7); lx = clamp(lx, -7, 7);
  const k = game.cine ? 10 : 4;
  camPos.set(damp(camPos.x, tx, k, dt), damp(camPos.y, ty, k, dt), damp(camPos.z, tz, k, dt));
  camLook.set(damp(camLook.x, lx, k, dt), damp(camLook.y, ly, k, dt), 0);
  game.shakeT = Math.max(0, game.shakeT - dt);
  const sh = game.shakeT * .7;
  camera.position.set(camPos.x + rand(-sh, sh), camPos.y + rand(-sh, sh), camPos.z);
  camera.lookAt(camLook);
}
const hudEls = [0, 1].map(i => ({ fill:$(`#hp${i} .fill`), lag:$(`#hp${i} .lag`), pips:[...document.querySelectorAll(`#hp${i} .pip`)], meter:$(`#m${i} .mbar i`), mbox:$(`#m${i}`), mlabel:$(`#m${i} .mlabel`) }));
function updateHUD(dt) {
  const ps = game.p; if (!ps[0] || game.demo) return;
  ps.forEach((f, i) => {
    const el = hudEls[i], pct = clamp(f.hp, 0, 100);
    el.fill.style.width = pct + '%';
    f.lag = f.lag > pct ? damp(f.lag, pct, 2.5, dt) : pct;
    el.lag.style.width = f.lag + '%';
    el.fill.classList.toggle('low', pct < 30);
    el.meter.style.width = f.meter + '%';
    const full = f.meter >= 100; el.mbox.classList.toggle('full', full);
    el.mlabel.textContent = full ? `SUPER READY: ${f.def.moves.s.name}` : 'MANDATE';
    el.pips.forEach((p, k) => p.classList.toggle('won', f.wins > k));
  });
  $('#timer').textContent = Math.ceil(game.timer);
}
function separate(a, b) {
  const dx = b.x - a.x, ad = Math.abs(dx), minD = .48 * (a.def.build.w * a.def.build.h + b.def.build.w * b.def.build.h);
  const solid = f => f.state !== 'ko' && f.state !== 'hole' && f.vanish < .5;
  if (ad < minD && Math.abs(a.y - b.y) < 1.8 && solid(a) && solid(b)) {
    const push = (minD - ad) / 2, s = dx === 0 ? a.facing : Math.sign(dx);
    a.x -= push * s; b.x += push * s;
  }
  for (const f of [a, b]) f.x = clamp(f.x, -BOUND, BOUND);
  if (Math.abs(b.x - a.x) > MAXSEP) {
    const m = (a.x + b.x) / 2, s = Math.sign(b.x - a.x);
    a.x = m - s * MAXSEP / 2; b.x = m + s * MAXSEP / 2;
  }
}
function windTick(dt) {
  if (!stage?.wind || game.phase !== 'fight') { game.wind = damp(game.wind, 0, 2, dt); return; }
  game.windT -= dt;
  if (game.windT <= 0) {
    if (game.windDir) { game.windDir = 0; game.windT = rand(5, 9); }
    else { game.windDir = Math.random() < .5 ? -1 : 1; game.windT = 2.4; floater(game.windDir > 0 ? "NOR'WESTER! →" : '← SOUTHERLY!', camPos.x, 4.6, { color:'#bfe3ff', size:34, life:1.6, rise:.2 }); noise(2, 400, .25, 'bandpass', 900); }
  }
  game.wind = damp(game.wind, game.windDir * 2.6, 3, dt);
}

let last = performance.now(), clock = 0;
function frame(now) {
  requestAnimationFrame(frame);
  const dt = clamp((now - last) / 1000, 0, .05); last = now; clock += dt; // never negative: damp() would diverge
  pollPads(); touchFrame();
  if (game.phase !== 'paused') tick(dt);
  updateCamera(dt); updateFloaters(dt); updateTouchUI();
  renderer.render(scene, camera);
}
function tick(dt) {
  if (game.cine) {
    game.cine.t -= dt;
    if (game.cine.t <= 0) { game.cine = null; $('#superPanel').classList.remove('on'); $('#speedlines').classList.remove('on'); }
  }
  let sdt = dt * game.timeScale;
  if (game.freezeT > 0) { game.freezeT -= dt; sdt = 0; }
  if (game.cine) sdt = 0;
  game.phaseT += dt;
  const [a, b] = game.p;
  if (a && b && sdt > 0) {
    let c0 = EMPTY, c1 = EMPTY;
    if (game.phase === 'fight') { c0 = ctrlFor(0); c1 = game.mode === 'cpu' ? game.ai.think(sdt) : ctrlFor(1); }
    else if (game.phase === 'title') { c0 = game.aiA.think(sdt); c1 = game.aiB.think(sdt); }
    if (game.phase === 'select') { a.facing = 1; b.facing = -1; }
    a.update(sdt, c0); b.update(sdt, c1);
    if (game.phase !== 'select') separate(a, b);
    else { a.x = -2.2; b.x = 2.2; if (a.state === 'victory' && !game.conf[0]) a.state = 'idle'; }
    updateFx(sdt);
    stage?.tick?.(sdt, clock);
    windTick(sdt);
    if (game.demo) { a.meter = b.meter = 0; }
    pressed.clear(); padBuf[0] = {}; padBuf[1] = {};
  }
  if (game.phase === 'intro') {
    if (game.introStep === 0 && game.phaseT > .25) {
      game.introStep = 1;
      const fin = a.wins === 1 && b.wins === 1;
      banner(fin ? 'FINAL ROUND' : `ROUND ${game.round}`, stage.name, 1200);
      say(fin ? 'Final round' : `Round ${game.round}`, { pitch:.6, rate:.95 });
      bubble(a, pick(a.def.intro), { dur:1.6 });
    }
    if (game.introStep === 1 && game.phaseT > 1.1) { game.introStep = 2; bubble(b, pick(b.def.intro), { dur:1.4 }); }
    if (game.introStep === 2 && game.phaseT > 1.75) { game.introStep = 3; banner('FIGHT!', '', 700); say('Fight!', { pitch:.6 }); sfx.bell(); }
    if (game.phaseT > 2.2) game.phase = 'fight';
  } else if (game.phase === 'fight') {
    game.timer -= sdt;
    if (game.timer <= 0) { game.timer = 0; timeUp(); }
  } else if (game.phase === 'ko') {
    if (game.phaseT > 1.1) game.timeScale = 1;
    if (!game.victoryShown && game.phaseT > 1.8) {
      game.victoryShown = true;
      const w = game.roundWinner;
      if (w) { w.state = 'victory'; w.stateT = 0; const q = pick(w.def.quips); bubble(w, q, { dur:2 }); say(q, { pitch:w.def.pitch }); }
    }
    if (game.phaseT > 4.4) nextRoundOrResult();
  }
  updateHUD(dt);
}

export { camPos, camLook, updateCamera, hudEls, updateHUD, separate, windTick, last, clock, frame, tick };
