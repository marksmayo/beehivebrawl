import * as THREE from 'three';
import { stage } from './arenas.js';
import { noise, say, sfx } from './audio.js';
import { banner, bubble, floater, updateFloaters } from './dom.js';
import { updateFx } from './effects.js';
import { game, nextRoundOrResult, timeUp, toTitle } from './game.js';
import { EMPTY, ctrlFor, padBuf, pollPads, pressed } from './input.js';
import { camera, renderer, scene } from './renderer.js';
import { touchFrame, updateTouchUI } from './touchui.js';
import { shakeOffset } from './anim.js';
import { cinePath, framing, koSlowmo, replayCamera, vignettePulse } from './camerafx.js';
import { updateCombos, updateImpact } from './comicfx.js';
import { portraitMood, speedLinesOn } from './fxlogic.js';
import { portraits } from './portraits.js';
import { PrintPost } from './post.js';

const post = new PrintPost(renderer); // paper grain + plate misregistration (49)
post.enabled = !new URLSearchParams(location.search).has('nopost');
addEventListener('resize', () => post.resize());
import { hideNameCards, showNameCards, updatePolls } from './screens.js';
import { $, BOUND, MAXSEP, clamp, damp, pick, rand } from './util.js';

// Camera / HUD / main loop

const camPos = new THREE.Vector3(0, 3.2, 10), camLook = new THREE.Vector3(0, 1.8, 0);
function updateCamera(dt) {
  const [a, b] = game.p; if (!a) return;
  // frame both fighters; combos push in and tilt (91)
  const combo = Math.max(...[a, b].map(f => ['hit', 'stunned'].includes(f.state) ? f.combo : 0));
  const fr = framing({ ax:a.x, bx:b.x, combo });
  let tx = fr.cx, ty = 3.1, tz = fr.dist + .4, lx = fr.cx, ly = 1.8, roll = game.phase === 'fight' ? fr.roll : 0, k = 4;
  if (game.phase === 'title') { const t = performance.now() / 6000; tx = fr.cx + Math.sin(t) * 3.5; tz = 11 + Math.cos(t) * 1.5; ty = 3.6; }
  if (game.phase === 'select') { tx = 0; lx = 0; tz = 8.2; ty = 2.4; ly = 1.9; }
  if (game.phase === 'result') { const w = a.wins > b.wins ? a : b.wins > a.wins ? b : null; if (w) { tx = w.x + 1.2; lx = w.x + 1.2; tz = 6.5; ty = 2.6; ly = 2.2; } }
  tx = clamp(tx, -7, 7); lx = clamp(lx, -7, 7);
  let lz = 0;
  if (game.cine) { // super: cut to a side close-up and push in (31, 95)
    const c = cinePath(game.cine.T - game.cine.t, game.cine.T, game.cine.f);
    ({ x:tx, y:ty, z:tz } = c.pos); ({ x:lx, y:ly, z:lz } = c.look); roll = c.roll; k = c.cut ? 60 : 14;
  }
  if (game.phase === 'replay') { // instant replay: swing round from the side (94)
    const w = game.roundWinner ?? a, c = replayCamera(game.replayT, game.replayDur, { x:(a.x + b.x) / 2, y:0 });
    tx = c.x; ty = c.y; tz = c.z; lx = c.look.x; ly = c.look.y; k = 8;
  }
  camPos.set(damp(camPos.x, tx, k, dt), damp(camPos.y, ty, k, dt), damp(camPos.z, tz, k, dt));
  camLook.set(damp(camLook.x, lx, k, dt), damp(camLook.y, ly, k, dt), damp(camLook.z, lz, k, dt));
  game.shakeT = Math.max(0, game.shakeT - dt); game.shakeAge += dt;
  const so = shakeOffset(game.shakeAge, game.shakeDir, game.shakeMag * 1.4); // shake along the hit (92)
  game.zoom = damp(game.zoom, 0, 7, dt);
  const zf = 1 - game.zoom * 2.5; // punch-in: pull toward what we look at (37)
  camera.position.set(camLook.x + (camPos.x - camLook.x) * zf + so.x, camLook.y + (camPos.y - camLook.y) * zf + so.y, camLook.z + (camPos.z - camLook.z) * zf);
  camera.lookAt(camLook);
  game.camRoll = damp(game.camRoll, roll, 6, dt);
  if (Math.abs(game.camRoll) > 1e-4) camera.rotateZ(game.camRoll); // Dutch tilt
}
const hudEls = [0, 1].map(i => ({ fill:$(`#hp${i} .fill`), lag:$(`#hp${i} .lag`), pips:[...document.querySelectorAll(`#hp${i} .pip`)], meter:$(`#m${i} .mbar i`), mbox:$(`#m${i}`), mlabel:$(`#m${i} .mlabel`), img:$(`#hp${i} .pimg`) }));
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
    const mood = portraitMood(f), src = portraits[mood === 'n' ? f.def.id : `${f.def.id}:${mood}`] ?? portraits[f.def.id]; // (55)
    if (el.img.src !== src) el.img.src = src;
  });
  $('#timer').textContent = Math.ceil(game.timer);
  updatePolls(ps, game.timer, dt); // poll % ticker and ballot count (83, 84)
  const human = game.mode === 'cpu' ? ps[0].hp : Math.min(ps[0].hp, ps[1].hp);
  $('#lowhp').style.opacity = game.phase === 'fight' ? vignettePulse(human, clock).toFixed(3) : 0; // (96)
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
  updateCamera(dt); updateFloaters(dt); updateTouchUI(); updateImpact(dt); updateCombos(game.p);
  $('#speedlines').classList.toggle('on', speedLinesOn(game.p, game.cine)); // (43)
  if (post.enabled) post.render(scene, camera, clock); else renderer.render(scene, camera); // print pass (49)
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
  if (a && b && sdt > 0 && game.phase !== 'replay') {
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
    if (game.phase === 'fight' || (game.phase === 'ko' && game.phaseT < 1.4)) game.replay.push([a.snap(), b.snap()], clock);
    pressed.clear(); padBuf[0] = {}; padBuf[1] = {};
  }
  if (game.phase === 'intro') {
    if (game.introStep === 0 && game.phaseT > .25) {
      game.introStep = 1;
      const fin = a.wins === 1 && b.wins === 1;
      banner(fin ? 'FINAL ROUND' : `ROUND ${game.round}`, stage.name, 1200);
      say(fin ? 'Final round' : `Round ${game.round}`, { pitch:.6, rate:.95 });
      bubble(a, pick(a.def.intro), { dur:1.6 });
      showNameCards(a.def, b.def); // big comic name cards (82)
      $('#panels').classList.add('on'); // comic panel borders (50)
    }
    if (game.introStep === 1 && game.phaseT > 1.1) { game.introStep = 2; bubble(b, pick(b.def.intro), { dur:1.4 }); }
    if (game.introStep === 2 && game.phaseT > 1.75) { game.introStep = 3; hideNameCards(); $('#panels').classList.remove('on'); banner('FIGHT!', '', 700); say('Fight!', { pitch:.6 }); sfx.bell(); }
    if (game.phaseT > 2.2) { game.phase = 'fight'; for (const f of game.p) if (f.state === 'intro') { f.state = 'idle'; f.x = f.introX; } }
  } else if (game.phase === 'fight') {
    game.timer -= sdt;
    if (game.timer <= 0) { game.timer = 0; timeUp(); }
  } else if (game.phase === 'ko') {
    if (game.final) { // the deciding blow: slow motion, drained of colour (93)
      game.slowT += dt; const sm = koSlowmo(game.slowT);
      game.timeScale = sm.timeScale; renderer.domElement.style.filter = sm.saturation < 1 ? `saturate(${sm.saturation.toFixed(2)})` : 'none';
    } else if (game.phaseT > 1.1) game.timeScale = 1;
    if (!game.victoryShown && game.phaseT > 1.8) {
      game.victoryShown = true;
      const w = game.roundWinner;
      if (w) { w.state = 'victory'; w.stateT = 0; w.vIdx = (Math.random() * 2) | 0; const q = pick(w.def.quips); bubble(w, q, { dur:2 }); say(q, { pitch:w.def.pitch }); }
    }
    if (game.final && game.phaseT > 2.8 && game.replay.frames().length > 10) startReplay();
    else if (game.phaseT > 4.4) nextRoundOrResult();
  } else if (game.phase === 'replay') {
    game.replayT += dt; playReplay();
  }
  updateHUD(dt);
}

// ---- instant replay of the deciding blow (94)
function startReplay() {
  const fr = game.replay.frames(), [a, b] = game.p;
  Object.assign(game, { phase:'replay', replayT:0, replayFrames:fr, replayDur:Math.min(3.2, (fr.at(-1).t - fr[0].t) * 1.4), replaySave:[a.snap(), b.snap()] });
  renderer.domElement.style.filter = 'none'; game.timeScale = 1;
  document.body.classList.add('replay'); $('#hud').classList.remove('on'); $('#meters').classList.remove('on');
  banner('REPLAY', 'The moment it was decided', 900);
}
function playReplay() {
  const fr = game.replayFrames, [a, b] = game.p, u = Math.min(1, game.replayT / game.replayDur);
  const f = fr[Math.min(fr.length - 1, Math.floor(u * (fr.length - 1)))];
  a.restore(f.snap[0]); b.restore(f.snap[1]);
  if (u >= 1) {
    a.restore(game.replaySave[0]); b.restore(game.replaySave[1]);
    document.body.classList.remove('replay'); game.replay.clear(); game.final = false;
    nextRoundOrResult();
  }
}

export { post, startReplay, playReplay, camPos, camLook, updateCamera, hudEls, updateHUD, separate, windTick, last, clock, frame, tick };
