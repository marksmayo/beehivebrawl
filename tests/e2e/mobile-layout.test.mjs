// Layout on phones: nothing important off screen or under the thumbs, in either orientation.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { serve, browser, sleep } from './harness.mjs';

const rectOf = (page, sel) => page.eval(`[...document.querySelectorAll(${JSON.stringify(sel)})].map(e => { const r = e.getBoundingClientRect(), s = getComputedStyle(e);
  return { l:r.left, t:r.top, r:r.right, b:r.bottom, vis:s.display !== 'none' && s.visibility !== 'hidden' && +s.opacity > 0 && r.width > 0 }; })`);
const inside = (r, W, H) => r.l >= -1 && r.t >= -1 && r.r <= W + 1 && r.b <= H + 1;
const hit = (a, b) => a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b;

async function reachFight(page, url) {
  await page.goto(url + '?test');
  assert.ok(await page.waitFor(`window.__bb?.game.phase === 'title'`));
  await page.eval(`document.querySelector('[data-mode="cpu"]').click()`); await sleep(1200);
}

for (const [W, H] of [[844, 390], [667, 375]]) test(`landscape ${W}x${H}: select screen, HUD and touch controls all fit`, async () => {
  const srv = await serve(), page = await browser({ width:W, height:H, mobile:true });
  try {
    await reachFight(page, srv.url);
    for (const sel of ['#grid > *', '#vPrev', '#vNext'])
      for (const r of await rectOf(page, sel)) assert.ok(r.vis && inside(r, W, H), `${sel} off screen on the select screen: ${JSON.stringify(r)}`);
    const hint = await page.eval(`document.querySelector('#selHint').textContent`);
    assert.match(hint, /tap/i, 'select hint should explain tapping'); assert.doesNotMatch(hint, /Enter|Esc|Tab/, 'select hint mentions keys on a phone');
    await page.eval(`document.querySelector('#grid > *').click()`);
    assert.ok(await page.waitFor(`__bb.game.phase === 'fight'`, 150000));
    await sleep(500);
    const btns = await rectOf(page, '#touch .tbtn');
    for (const sel of ['#hp0', '#hp1', '#m0', '#m1']) for (const r of await rectOf(page, sel)) {
      assert.ok(inside(r, W, H), `${sel} off screen: ${JSON.stringify(r)}`);
      for (const b of btns) assert.ok(!hit(r, b), `${sel} sits under a touch button`);
    }
    for (const r of await rectOf(page, '#soundHint')) assert.ok(!r.vis, 'keyboard help should be hidden on touch screens');
    assert.deepEqual(page.errors, []);
  } finally { page.close(); srv.close(); }
});

test('portrait 390x844: both fighters are in view and the HUD fits', async () => {
  const W = 390, H = 844, srv = await serve(), page = await browser({ width:W, height:H, mobile:true });
  try {
    await reachFight(page, srv.url);
    await page.eval(`document.querySelector('#grid > *').click()`);
    assert.ok(await page.waitFor(`__bb.game.phase === 'fight'`, 150000));
    await sleep(1500);
    const pts = await page.eval(`__bb.game.p.flatMap(f => [[f.x, 0], [f.x, 3]]).map(([x, y]) => {
      const v = new (__bb.camera.position.constructor)(x, y, 0).project(__bb.camera); return [v.x, v.y]; })`);
    for (const [x, y] of pts) assert.ok(Math.abs(x) <= 1 && Math.abs(y) <= 1, `a fighter is off screen (ndc ${x.toFixed(2)}, ${y.toFixed(2)})`);
    for (const sel of ['#hp0', '#hp1']) for (const r of await rectOf(page, sel)) assert.ok(inside(r, W, H), `${sel} off screen: ${JSON.stringify(r)}`);
    assert.deepEqual(page.errors, []);
  } finally { page.close(); srv.close(); }
});
