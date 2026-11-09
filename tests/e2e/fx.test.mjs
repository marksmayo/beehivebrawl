// The comic effects layer, in the real game.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { serve, browser, sleep } from './harness.mjs';

let srv, page;
const P = expr => page.eval(`(() => { const g = __bb.game, a = g.p[0], b = g.p[1], sc = __bb.scene; return ${expr}; })()`);
const free = () => page.waitFor(`['idle', 'walk'].includes(__bb.game.p[0].state)`, 20000);
const record = expr => page.eval(`(() => { const r = __bb.rec = []; (function w() { if (__bb.rec !== r) return; r.push(${expr}); if (r.length < 4000) requestAnimationFrame(w); })(); })()`);
const sceneHas = tag => `(() => { let n = 0; __bb.scene.traverse(o => { if (o.userData?.fx === '${tag}') n++; }); return n; })()`;

before(async () => {
  srv = await serve(); page = await browser();
  await page.goto(srv.url + '?test');
  assert.ok(await page.waitFor(`window.__bb?.game.phase === 'title'`));
  await page.key('Enter'); await sleep(800); await page.key('KeyJ');
  assert.ok(await page.waitFor(`__bb.game.phase === 'intro'`, 60000));
});
after(() => { page?.close(); srv?.close(); });

test('rounds open on comic panel borders (50)', async () => {
  assert.ok(await page.waitFor(`document.querySelector('#panels').classList.contains('on')`, 15000), 'no panel borders');
  assert.ok(await page.waitFor(`__bb.game.phase === 'fight'`, 60000));
  await page.eval(`__bb.game.ai.think = () => ({})`);
});

test('halftone lives in the shadows now, and the print pass is on (47, 49)', async () => {
  assert.equal(await page.eval(`getComputedStyle(document.querySelector('#halftone')).display`), 'none', 'the full-screen dot overlay should be gone');
  assert.ok(await P(`(() => { let n = 0; sc.traverse(o => { if (o.material?.customProgramCacheKey?.() === 'halftone') n++; }); return n; })()`) > 20, 'toon materials lack halftone');
  assert.ok(await page.eval(`__bb.post?.enabled === true`), 'print pass not running');
});

test('a landed hit pops a 3D sound-effect word and an ink splat (42, 44)', async () => {
  await free(); await P(`(a.x = -.6, b.x = .5, b.state = 'idle', 1)`);
  await record(`[${sceneHas('word')}, ${sceneHas('splat')}]`);
  await page.key('KeyJ', 100);
  assert.ok(await page.waitFor(`__bb.rec.some(r => r[0] > 0)`, 12000), 'no 3D word');
  assert.ok(await page.eval(`__bb.rec.some(r => r[1] > 0)`), 'no ink splat');
});

test('a kick that lands scatters paperwork (45), and three hits make a growing combo counter (53)', async () => {
  await free(); await P(`(a.x = -.7, b.x = .6, b.state = 'idle', 1)`);
  await record(`${sceneHas('paper')}`);
  await page.key('KeyK', 100);
  assert.ok(await page.waitFor(`__bb.rec.some(n => n > 0)`, 12000), 'no flying papers');
  await P(`(b.combo = 4, b.state = 'hit', b.stateT = 0, b.stunDur = 2, __bb.showCombo?.(b), 1)`);
  assert.ok(await page.waitFor(`document.querySelector('.combo.on')`, 6000), 'no combo counter');
  assert.match(await page.eval(`document.querySelector('.combo.on').textContent`), /4 HIT/);
  await P(`(b.combo = 0, b.state = 'idle', 1)`);
});

test('dashing runs speed lines (43)', async () => {
  await free(); await P(`(a.x = -6, b.x = 5, 1)`);
  await record(`document.querySelector('#speedlines').classList.contains('on')`);
  await page.key('KeyD', 60); await sleep(450); await page.key('KeyD', 60);
  assert.ok(await page.waitFor(`__bb.rec.includes(true)`, 8000), 'no speed lines during the dash');
});

test('a full meter sparkles (54) and a super flashes an impact frame (41)', async () => {
  await free(); await P(`(a.meter = 100, 1)`);
  assert.ok(await page.waitFor(`document.querySelector('#m0').classList.contains('full') && getComputedStyle(document.querySelector('#m0 .spark')).display !== 'none'`, 5000), 'no sparkle');
  await P(`(a.x = -1, b.x = .8, 1)`);
  await record(`document.querySelector('#impact').className`);
  await page.key('KeyO', 120);
  assert.ok(await page.waitFor(`__bb.rec.some(c => /invert/.test(c))`, 20000), 'no inverted impact frame');
  await page.waitFor(`!__bb.game.cine`, 20000);
});

test('HUD portraits react to the fight (55)', async () => {
  await free(); await P(`(b.hp = 100, b.state = 'idle', 1)`); await sleep(800); // healthy and calm first
  const calm = await page.eval(`document.querySelector('#hp1 .pimg').src`);
  await P(`(b.state = 'hit', b.stateT = 0, b.stunDur = 2, 1)`);
  assert.ok(await page.waitFor(`document.querySelector('#hp1 .pimg').src !== ${JSON.stringify(calm)}`, 6000), 'portrait did not change when hit');
  await P(`(b.state = 'idle', 1)`);
});

test('speech bubbles have tails that point at the speaker (51)', async () => {
  await P(`(__bb.bubble?.(a, 'Testing, testing', { dur:3 }), 1)`);
  assert.ok(await page.waitFor(`[...document.querySelectorAll('.bubble')].some(b => b.style.getPropertyValue('--tail') !== '')`, 6000), 'bubble has no tail offset');
});

test('a KO slams a stamp across the screen (52)', async () => {
  await P(`(b.hp = 0, g.ko(b, a, 1), 1)`);
  assert.ok(await page.waitFor(`document.querySelector('#kostamp').classList.contains('on')`, 6000), 'no KO stamp');
  assert.ok((await page.eval(`document.querySelector('#kostamp').textContent`)).length > 4);
  assert.deepEqual(page.errors, []);
});
