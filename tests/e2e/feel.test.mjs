// Camera and game feel in the real game: Dutch tilt on combos, super close-ups,
// slow-mo final KO with a replay, low-health pulse, buffering and cancels.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { serve, browser, sleep } from './harness.mjs';

let srv, page;
const P = expr => page.eval(`(() => { const g = __bb.game, a = g.p[0], b = g.p[1], cam = __bb.camera; return ${expr}; })()`);
const free = () => page.waitFor(`['idle', 'walk'].includes(__bb.game.p[0].state)`, 20000);
const camRoll = `(() => { const c = __bb.camera, e = c.matrixWorld.elements; return Math.abs(e[1]); })()`; // camera's right vector tilting up/down
// each recorder owns its array and stops when a newer one replaces it
const record = expr => page.eval(`(() => { const r = __bb.rec = []; (function w() { if (__bb.rec !== r) return; r.push(${expr}); if (r.length < 4000) requestAnimationFrame(w); })(); })()`);

before(async () => {
  srv = await serve(); page = await browser();
  await page.goto(srv.url + '?test');
  assert.ok(await page.waitFor(`window.__bb?.game.phase === 'title'`));
  await page.key('Enter'); await sleep(800); await page.key('KeyJ');
  assert.ok(await page.waitFor(`__bb.game.phase === 'fight'`, 60000));
  await page.eval(`__bb.game.ai.think = () => ({})`);
});
after(() => { page?.close(); srv?.close(); });

test('a combo tilts the camera; normal play keeps it level', async () => {
  await free();
  assert.ok(await page.eval(camRoll) < .01, 'camera should start level');
  await P(`(b.combo = 4, b.state = 'hit', b.stateT = 0, b.stunDur = 3, 1)`);
  assert.ok(await page.waitFor(`${camRoll} > .03`, 8000), 'no Dutch tilt during the combo');
  await P(`(b.combo = 0, b.state = 'idle', 1)`);
});

test('a super cuts to a side-on close-up of the fighter', async () => {
  await free(); await P(`(a.meter = 100, 1)`);
  await record(`[__bb.game.cine ? 1 : 0, __bb.camera.position.x - __bb.game.p[0].x, __bb.camera.position.z]`);
  await page.key('KeyO', 120);
  assert.ok(await page.waitFor(`__bb.rec.some(r => r[0] && Math.abs(r[1]) > 1.5 && r[2] < 6)`, 15000), 'no side-on close-up during the super');
  await page.waitFor(`!__bb.game.cine`, 20000);
});

test('the input buffer holds a press made during recovery', async () => {
  await free(); await P(`(a.x = -5, b.x = 5, 1)`);
  await record(`__bb.game.p[0].atk?.type ?? '-'`);
  await page.key('KeyJ', 100);
  // press kick in the punch's last moments (inside the 0.15 s buffer): it comes out as soon as the punch ends
  await page.waitFor(`__bb.game.p[0].atk?.t > .22`, 15000);
  await page.key('KeyK', 60);
  assert.ok(await page.waitFor(`__bb.rec.includes('kick')`, 15000), 'buffered kick never came out');
});

test('a punch that connects cancels straight into a special', async () => {
  await free(); await P(`(a.x = -.7, b.x = .5, a.cool.a = 0, b.state = 'idle', 1)`);
  await record(`__bb.game.p[0].state`);
  await page.key('KeyJ', 100);
  await page.waitFor(`__bb.game.p[0].atk?.hit`, 8000);
  await page.key('KeyL', 60);
  assert.ok(await page.waitFor(`__bb.rec.join(' ').includes('attack special')`, 15000), `no cancel: ${await page.eval(`[...new Set(__bb.rec)].join(' ')`)}`);
});

test('low health pulses a red vignette', async () => {
  await page.waitFor(`__bb.game.phase === 'fight'`, 30000);
  await P(`(a.hp = 8, 1)`);
  assert.ok(await page.waitFor(`+getComputedStyle(document.querySelector('#lowhp')).opacity > .2`, 8000), 'no low-health pulse');
  await P(`(a.hp = 100, 1)`);
});

test('the deciding KO plays in slow motion and desaturated, then an instant replay, then the results', async () => {
  await page.waitFor(`__bb.game.phase === 'fight'`, 30000);
  await record(`[__bb.game.phase, __bb.game.timeScale, getComputedStyle(document.querySelector('canvas')).filter]`);
  await P(`(a.wins = 1, b.hp = 0, g.ko(b, a, 1), 1)`);
  assert.ok(await page.waitFor(`__bb.rec.some(r => r[0] === 'ko' && r[1] <= .2 && /saturate/.test(r[2]))`, 8000), 'no slow-mo / desaturation');
  assert.ok(await page.waitFor(`__bb.game.phase === 'replay'`, 60000), 'no replay');
  assert.ok(await page.waitFor(`__bb.game.phase === 'result'`, 60000), 'no result after the replay');
  assert.equal(await page.eval(`getComputedStyle(document.querySelector('canvas')).filter`), 'none', 'colour restored');
  assert.deepEqual(page.errors, []);
});
