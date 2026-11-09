// The game boots, reaches a fight, renders a real frame, and logs no errors.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { serve, browser, sleep } from './harness.mjs';

let srv, page;
before(async () => { srv = await serve(); page = await browser(); });
after(() => { page?.close(); srv?.close(); });

test('title screen boots without errors', async () => {
  await page.goto(srv.url + '?test');
  assert.ok(await page.waitFor(`window.__bb?.game.phase === 'title'`), 'never reached the title screen');
  assert.deepEqual(page.errors, []);
});

test('a CPU match starts and renders the arena and fighters', async () => {
  await page.key('Enter'); await sleep(800);
  assert.equal(await page.eval(`__bb.game.phase`), 'select');
  await page.key('KeyJ');
  assert.ok(await page.waitFor(`['intro', 'fight'].includes(__bb.game.phase)`), 'match did not start');
  await sleep(3000);
  const v = await page.variety();
  assert.ok(v > 60, `frame looks blank (${v} colours)`);
  const cam = await page.eval(`__bb.camera.position.toArray()`);
  assert.ok(cam.every(c => Math.abs(c) < 40), `camera wandered off: ${cam}`);
  assert.deepEqual(page.errors, []);
});

test('fighters can attack during the fight', async () => {
  assert.ok(await page.waitFor(`__bb.game.phase === 'fight'`, 30000), `not fighting: ${await page.eval('__bb.game.phase')}`);
  const x0 = await page.eval(`__bb.game.p[0].x`);
  await page.key('KeyD', 1400); // walk in
  assert.ok(await page.eval(`__bb.game.p[0].x`) > x0, 'D did not walk right');
  await page.eval(`__bb.seen = new Set(); (function watch() { const f = __bb.game.p[0]; if (f.atk) __bb.seen.add(f.atk.type); requestAnimationFrame(watch); })()`);
  await page.key('KeyJ', 120);
  assert.ok(await page.waitFor(`__bb.seen.has('punch')`, 4000), 'J did not punch');
  // headless software rendering runs at a few fps, so wait until the punch (or any hit-stun) is over
  for (let i = 0; i < 4 && !(await page.eval(`__bb.seen.has('kick')`)); i++) {
    await page.waitFor(`['idle', 'walk'].includes(__bb.game.p[0].state)`, 15000);
    await page.key('KeyK', 150);
    await page.waitFor(`__bb.seen.has('kick')`, 4000);
  }
  assert.ok(await page.eval(`__bb.seen.has('kick')`), 'K did not kick');
  assert.equal(await page.eval(`getComputedStyle(document.querySelector('#touch')).display`), 'none', 'touch controls showing on desktop');
  assert.deepEqual(page.errors, []);
});
