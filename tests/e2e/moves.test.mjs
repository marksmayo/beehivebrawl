// The animation/moves layer works in the real game: dash, throw + knockdown + get-up,
// taunt, low guard, forward flips and bending elbows. The CPU is frozen so it's deterministic.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { serve, browser, sleep } from './harness.mjs';

let srv, page;
const P = expr => page.eval(`(() => { const g = __bb.game, a = g.p[0], b = g.p[1]; return ${expr}; })()`);
// record every state player 1 (or 2) passes through, frame by frame
const watch = (i = 0) => page.eval(`__bb.seen${i} = new Set(); (function w() { const f = __bb.game.p[${i}]; __bb.seen${i}.add(f.state); requestAnimationFrame(w); })()`);
const seen = (s, i = 0) => page.eval(`__bb.seen${i}.has('${s}')`);
const free = () => page.waitFor(`['idle', 'walk'].includes(__bb.game.p[0].state) && ['idle', 'walk'].includes(__bb.game.p[1].state)`, 20000);
const place = (ax, bx) => P(`(a.x = ${ax}, b.x = ${bx}, a.vx = b.vx = 0, 1)`);

before(async () => {
  srv = await serve(); page = await browser();
  await page.goto(srv.url + '?test');
  assert.ok(await page.waitFor(`window.__bb?.game.phase === 'title'`));
  await page.key('Enter'); await sleep(800); await page.key('KeyJ');
  assert.ok(await page.waitFor(`__bb.game.phase === 'fight'`, 60000), 'no fight');
  await page.eval(`__bb.game.ai.think = () => ({ left:0, right:0, up:0, down:0, punch:0, kick:0, spA:0, spB:0, sup:0 })`); // freeze the CPU
});
after(() => { page?.close(); srv?.close(); });

test('the guard pose bends the elbows (skinned two-bone arms)', async () => {
  await free();
  const el = await P(`[a.armF.elbow?.rotation.z, a.armB.elbow?.rotation.z]`);
  assert.ok(el.every(v => v > .8), `elbows not bent: ${el}`);
  assert.ok(await P(`a.armF.mesh?.isSkinnedMesh === true`), 'arms are not skinned meshes');
});

test('double-tapping forward dashes', async () => {
  await free(); await place(-6, 4); await watch();
  await page.key('KeyD', 60); await sleep(450); await page.key('KeyD', 60); // a frame apart (headless runs ~3 fps)
  assert.ok(await page.waitFor(`__bb.seen0.has('dash')`, 6000), 'no dash');
});

test('forward + punch up close throws, the victim is knocked down and gets back up', async () => {
  await free(); await place(-.5, .4); await watch(0); await watch(1);
  await page.eval(`dispatchEvent(new KeyboardEvent('keydown', { code:'KeyD', bubbles:true }))`);
  await page.key('KeyJ', 120);
  await page.eval(`dispatchEvent(new KeyboardEvent('keyup', { code:'KeyD', bubbles:true }))`);
  assert.ok(await page.waitFor(`__bb.seen0.has('throw')`, 6000), 'no throw');
  assert.ok(await page.waitFor(`__bb.seen1.has('down')`, 20000), 'victim never went down');
  assert.ok(await page.waitFor(`['idle', 'walk'].includes(__bb.game.p[1].state)`, 30000), 'victim never got up');
  assert.ok(await P(`b.hp < 100`), 'throw did no damage');
});

test('U taunts and a completed taunt builds meter', async () => {
  await free(); await place(-5, 5);
  const m0 = await P(`a.meter`); await watch();
  await page.key('KeyU', 100);
  assert.ok(await page.waitFor(`__bb.seen0.has('taunt')`, 6000), 'no taunt');
  assert.ok(await page.waitFor(`__bb.game.p[0].state !== 'taunt' && __bb.game.p[0].meter > ${m0}`, 30000), 'taunt gave no meter');
});

test('holding down is a low guard', async () => {
  await free();
  await page.eval(`dispatchEvent(new KeyboardEvent('keydown', { code:'KeyS', bubbles:true }))`);
  assert.ok(await page.waitFor(`__bb.game.p[0].state === 'block' && __bb.game.p[0].guard === 'low'`, 6000), 'no low guard');
  await page.eval(`dispatchEvent(new KeyboardEvent('keyup', { code:'KeyS', bubbles:true }))`);
});

test('jumping forward flips', async () => {
  await free(); await place(-6, 5);
  await page.eval(`__bb.flip = 0; (function w() { __bb.flip = Math.max(__bb.flip, Math.abs(__bb.game.p[0].flipG.rotation.z)); requestAnimationFrame(w); })()`);
  await page.eval(`dispatchEvent(new KeyboardEvent('keydown', { code:'KeyD', bubbles:true }))`);
  await page.key('KeyW', 120);
  await page.eval(`dispatchEvent(new KeyboardEvent('keyup', { code:'KeyD', bubbles:true }))`);
  assert.ok(await page.waitFor(`__bb.flip > 2`, 15000), 'no flip');
  assert.deepEqual(page.errors, []);
});
