// A phone player can get from the title screen into a fight and play it with touch alone.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { serve, browser, sleep } from './harness.mjs';

const W = 844, H = 390;
let srv, page;
before(async () => { srv = await serve(); page = await browser({ width:W, height:H, mobile:true }); });
after(() => { page?.close(); srv?.close(); });

const rect = sel => page.eval(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return null;
  const r = e.getBoundingClientRect(), s = getComputedStyle(e); return { x:r.x + r.width / 2, y:r.y + r.height / 2, l:r.left, t:r.top, r:r.right, b:r.bottom, vis:s.display !== 'none' && s.visibility !== 'hidden' && r.width > 0 }; })()`);
const onScreen = r => r && r.vis && r.l >= 0 && r.t >= 0 && r.r <= W && r.b <= H;

test('title screen fits a landscape phone and starts a CPU match by tap', async () => {
  await page.goto(srv.url + '?test');
  assert.ok(await page.waitFor(`window.__bb?.game.phase === 'title'`), 'no title screen');
  const start = await rect('[data-mode="cpu"]');
  assert.ok(onScreen(start), `start button off screen: ${JSON.stringify(start)}`);
  await page.tap(start.x, start.y);
  assert.ok(await page.waitFor(`__bb.game.phase === 'select'`, 5000), 'tap did not open character select');
});

test('picking a candidate by tap starts the fight', async () => {
  const card = await rect('#grid > *');
  assert.ok(onScreen(card), `first card off screen: ${JSON.stringify(card)}`);
  await page.tap(card.x, card.y);
  assert.ok(await page.waitFor(`__bb.game.phase === 'fight'`, 150000), 'fight never started');
});

test('touch controls are shown in the fight, on screen', async () => {
  for (const sel of ['#touch', '#touch [data-act="punch"]', '#touch [data-act="kick"]', '#touch [data-act="spA"]', '#touch [data-act="spB"]', '#touch [data-act="sup"]', '#touch [data-act="pause"]'])
    assert.ok(onScreen(await rect(sel)), `${sel} not visible on screen`);
});

test('dragging the thumbstick walks the fighter', async () => {
  const x0 = await page.eval(`__bb.game.p[0].x`);
  await page.touch('touchStart', [{ x:150, y:300, id:1 }]);
  for (let i = 1; i <= 6; i++) { await page.touch('touchMove', [{ x:150 + i * 14, y:300, id:1 }]); await sleep(30); }
  await sleep(900);
  await page.touch('touchEnd', []);
  const x1 = await page.eval(`__bb.game.p[0].x`);
  assert.ok(x1 > x0 + .5, `fighter did not walk right (${x0} -> ${x1})`);
});

test('tapping PUNCH throws a punch', async () => {
  const b = await rect('#touch [data-act="punch"]');
  await page.eval(`__bb.punches = 0; (function watch() { const f = __bb.game.p[0]; if (f.atk?.type === 'punch') __bb.punches++; else requestAnimationFrame(watch); })()`);
  // headless software rendering runs at a few fps: wait until the fighter is free, retry if the CPU interrupts
  for (let i = 0; i < 4 && !(await page.eval(`__bb.punches > 0`)); i++) {
    await page.waitFor(`['idle', 'walk'].includes(__bb.game.p[0].state)`, 15000);
    await page.touch('touchStart', [{ x:b.x, y:b.y, id:2 }]); await sleep(60);
    await page.touch('touchEnd', []);
    await page.waitFor(`__bb.punches > 0`, 4000);
  }
  assert.ok(await page.eval(`__bb.punches > 0`), 'no punch thrown');
});

test('the pause button pauses, and Resume (tapped) carries on', async () => {
  await sleep(600);
  const p = await rect('#touch [data-act="pause"]');
  await page.tap(p.x, p.y);
  assert.ok(await page.waitFor(`__bb.game.phase === 'paused'`, 3000), 'did not pause');
  assert.ok(await page.waitFor(`getComputedStyle(document.querySelector('#touch')).display === 'none'`, 3000), 'touch controls should hide while paused');
  const r = await rect('#bResume');
  await page.tap(r.x, r.y);
  assert.ok(await page.waitFor(`__bb.game.phase === 'fight'`, 3000), 'did not resume');
  assert.deepEqual(page.errors, []);
});
