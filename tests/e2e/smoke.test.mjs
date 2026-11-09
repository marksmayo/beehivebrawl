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
  assert.ok(await page.waitFor(`__bb.game.phase === 'fight'`, 15000));
  await page.key('KeyD', 1400); // walk in
  for (let i = 0; i < 12; i++) await page.key(['KeyJ', 'KeyK'][i % 2]);
  const st = await page.eval(`__bb.game.p.map(f => f.hp + f.meter)`);
  assert.ok(st.some(x => x !== 100), 'nothing happened in the fight');
  assert.deepEqual(page.errors, []);
});
