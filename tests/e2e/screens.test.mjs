// The presentation layer: comic-cover title, bio panels, VS splash with stats, round name
// cards, poll/ballot HUD, order-paper pause, newspaper results and the gallery.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { serve, browser, sleep } from './harness.mjs';

let srv, page;
const vis = sel => page.eval(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return false; const s = getComputedStyle(e), r = e.getBoundingClientRect();
  return s.display !== 'none' && s.visibility !== 'hidden' && +s.opacity > .05 && r.width > 0; })()`);
const text = sel => page.eval(`document.querySelector(${JSON.stringify(sel)})?.textContent ?? ''`);
const count = sel => page.eval(`document.querySelectorAll(${JSON.stringify(sel)}).length`);

before(async () => {
  srv = await serve(); page = await browser();
  await page.goto(srv.url + '?test');
  assert.ok(await page.waitFor(`window.__bb?.game.phase === 'title'`));
  await page.eval(`localStorage.clear()`);
});
after(() => { page?.close(); srv?.close(); });

test('title is a comic cover with the cast on it', async () => {
  assert.ok(await vis('#title .cover'), 'no comic cover');
  assert.match(await text('#title .cover'), /#\d+/, 'cover has an issue number');
  assert.ok(await count('#title .cast img') >= 8, 'cast portraits missing');
});

test('select screen bios are comic panels with a quote', async () => {
  await page.key('Enter'); await sleep(800);
  assert.ok((await text('#info0 .quote')).length > 3, 'no quote bubble in the bio');
});

test('confirming shows a VS splash with both fighters and their stats', async () => {
  await page.key('KeyJ');
  assert.ok(await page.waitFor(`getComputedStyle(document.querySelector('#vs')).display !== 'none'`, 10000), 'no VS splash');
  assert.equal(await count('#vs .vsName'), 2);
  assert.ok(await count('#vs .bar i') >= 6, 'stat bars missing');
  assert.match(await text('#vs'), /SPEED/); assert.match(await text('#vs'), /SUPER/);
});

test('each round opens with big name cards', async () => {
  assert.ok(await page.waitFor(`__bb.game.phase === 'intro'`, 60000));
  assert.ok(await page.waitFor(`document.querySelectorAll('#namecards .ncard.on').length === 2`, 15000), 'no name cards');
});

test('the HUD shows polls and a ballot count', async () => {
  assert.ok(await page.waitFor(`__bb.game.phase === 'fight'`, 60000));
  assert.match(await text('#hp0 .poll'), /^\d+%$/);
  assert.equal(await text('#ballot .bl'), 'COUNTING');
});

test('pause is an order paper', async () => {
  await page.key('Escape');
  assert.ok(await page.waitFor(`__bb.game.phase === 'paused'`, 5000));
  assert.match(await text('#pause'), /ORDER PAPER/);
  assert.ok(await count('#pause .op li') >= 3);
  await page.key('Escape');
});

test('the result is a newspaper front page, and winning unlocks gallery art', async () => {
  assert.ok(await page.waitFor(`__bb.game.phase === 'fight'`, 10000));
  const win = async () => {
    await page.eval(`(() => { const [a, b] = __bb.game.p; b.hp = 0; __bb.game.ko(b, a, 1); })()`);
    await page.waitFor(`__bb.game.phase === 'ko'`, 5000); await page.eval(`__bb.game.phaseT = 99`);
  };
  await win();
  assert.ok(await page.waitFor(`__bb.game.phase === 'fight'`, 60000), 'round 2 never started');
  await win();
  assert.ok(await page.waitFor(`__bb.game.phase === 'result'`, 20000), 'no result screen');
  assert.equal(await text('#result .masthead'), 'THE DAILY BEEHIVE');
  const p1 = await page.eval(`__bb.game.p[0].def.short`);
  assert.ok((await text('#rHead')).includes(p1), 'headline should name the winner');
  const id = await page.eval(`__bb.game.p[0].def.id`); // read before the title screen swaps in demo fighters
  await page.eval(`document.querySelector('#bMenu').click()`);
  assert.ok(await page.waitFor(`__bb.game.phase === 'title'`, 5000));
  await page.eval(`document.querySelector('#bGallery').click()`);
  assert.ok(await vis('#gallery'), 'no gallery');
  assert.ok(await page.eval(`document.querySelector('#gallery [data-key="fighter:${id}"]')?.classList.contains('unlocked')`), 'winner not unlocked');
  assert.ok(await count('#gallery .gi:not(.unlocked)') > 0, 'everything unlocked already?');
  assert.deepEqual(page.errors, []);
});
