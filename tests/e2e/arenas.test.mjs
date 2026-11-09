// Arenas in the real game: every venue builds and renders, with parallax layers,
// centrepieces, time of day, weather, props, hazards, crowds, billboards and ambience.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { serve, browser, sleep } from './harness.mjs';

let srv, page;
const P = expr => page.eval(`(() => { const g = __bb.game, a = g.p[0], b = g.p[1], sc = __bb.scene, ar = __bb.arena; return ${expr}; })()`);
const count = tag => `(() => { let n = 0; __bb.scene.traverse(o => { if (o.userData?.${tag}) n++; }); return n; })()`;

before(async () => {
  srv = await serve(); page = await browser();
  await page.goto(srv.url + '?test');
  assert.ok(await page.waitFor(`window.__bb?.game.phase === 'title'`));
});
after(() => { page?.close(); srv?.close(); });

test('all thirteen venues build and render without errors, each with layers and a centrepiece', async () => {
  const ids = await P(`ar.STAGES.map(s => s.id)`);
  assert.equal(ids.length, 13);
  for (const id of ids) {
    await P(`(ar.build(ar.STAGES.find(s => s.id === '${id}'), { tod:'day' }), 1)`);
    await sleep(700);
    assert.ok(await page.eval(count(`layer === 'scene'`)) === 1, `${id}: no scene layer`);
    assert.ok(await page.eval(count(`centrepiece`)) === 1, `${id}: no centrepiece`);
    assert.ok((await page.variety()) > 40, `${id} looks blank`);
  }
  assert.ok(await page.eval(count(`layer === 'sky'`)) === 0, 'the indoor committee room should have no sky layer');
  await P(`(ar.build(ar.STAGES.find(s => s.id === 'beehive'), { tod:'day' }), 1)`); await sleep(500);
  assert.equal(await page.eval(count(`layer === 'sky'`)), 1, 'outdoor venues have a sky layer');
  assert.equal(await page.eval(count(`layer === 'clouds'`)), 1, 'and a drifting cloud layer');
  assert.deepEqual(page.errors, []);
});

test('night dims the sun and lights the windows', async () => {
  const day = await P(`(ar.build(ar.STAGES.find(s => s.id === 'cuba'), { tod:'day' }), __bb.sun.intensity)`);
  const night = await P(`(ar.build(ar.STAGES.find(s => s.id === 'cuba'), { tod:'night' }), __bb.sun.intensity)`);
  assert.ok(night < day);
  assert.equal(await P(`ar.current().userData.tod`), 'night');
});

test('weather: drizzle leaves puddles in Dunedin, snow falls on Aoraki, umbrellas blow about in Wellington', async () => {
  await P(`(ar.build(ar.STAGES.find(s => s.id === 'octagon'), { tod:'day' }), 1)`);
  assert.ok(await page.eval(count(`puddle`)) >= 3, 'no puddles');
  await P(`(ar.build(ar.STAGES.find(s => s.id === 'aoraki'), { tod:'day' }), 1)`);
  assert.ok(await page.eval(count(`snow`)) >= 1, 'no snow');
  await P(`(ar.build(ar.STAGES.find(s => s.id === 'beehive'), { tod:'day' }), g.windDir = 1, g.wind = 2.6, 1)`);
  assert.ok(await page.waitFor(`(__bb.game.wind = 2.6, ${count(`umbrella`)}) > 0`, 30000), 'no umbrellas in the wind');
});

test('a match: crowd and press react, billboards change by round, props break, the intro flies in', async () => {
  await page.eval(`localStorage.setItem('bb-venue', 'cathedral')`);
  await page.key('Enter'); await sleep(800);
  for (let i = 0; i < 14 && (await P(`ar.STAGES[g.stageIdx].id`)) !== 'cathedral'; i++) await page.key('Tab');
  await page.key('KeyJ');
  assert.ok(await page.waitFor(`__bb.game.phase === 'intro'`, 60000));
  assert.ok(await page.waitFor(`__bb.game.phaseT < 1 && __bb.camera.position.y > 5`, 8000), 'no fly-through at the start of the round');
  assert.ok(await page.waitFor(`__bb.game.phase === 'fight'`, 60000));
  await page.eval(`__bb.game.ai.think = () => ({})`);
  assert.ok(await page.eval(count(`crowd`)) >= 6, 'no crowd');
  assert.ok(await page.eval(count(`press`)) >= 1, 'no press pack');
  const c0 = await P(`ar.crowd.level`);
  await P(`(ar.crowd.react('super'), 1)`);
  assert.ok(await P(`ar.crowd.level`) > c0);
  const bb1 = await P(`ar.billboardText()`);
  assert.ok(bb1 && bb1.length > 4, 'no billboard');
  // props: knock a fighter into one until it breaks
  const px = await P(`ar.props()[0]?.x`);
  assert.ok(px != null, 'no breakable props');
  for (let i = 0; i < 20 && !(await P(`ar.props()[0].broken`)); i++) { // headless runs ~3 fps, so give it time between knocks
    await P(`(b.x = ${px} - .3 * Math.sign(${px}), b.state = 'hit', b.stateT = 0, b.stunDur = .5, b.vx = 7 * Math.sign(${px}), 1)`); await sleep(900);
  }
  assert.ok(await P(`ar.props()[0].broken`), 'prop never broke');
  // next round: a new slogan
  await P(`(b.hp = 0, g.ko(b, a, 1), 1)`); await page.waitFor(`__bb.game.phase === 'ko'`, 5000); await P(`(g.phaseT = 99, 1)`);
  assert.ok(await page.waitFor(`__bb.game.round === 2 && __bb.game.phase === 'fight'`, 60000));
  assert.notEqual(await P(`ar.billboardText()`), bb1, 'billboard did not change between rounds');
});

test('the tram warns, then crosses the square and flattens anyone on the tracks', async () => {
  await page.eval(`__bb.game.ai.think = () => ({})`);
  await P(`(a.x = -6, b.x = 0, b.hp = 100, b.state = 'idle', ar.skipHazardTo(-.8), 1)`);
  assert.ok(await page.waitFor(`document.querySelector('#hazard').classList.contains('on')`, 8000), 'no warning');
  const hp = await P(`b.hp`);
  assert.ok(await page.waitFor(`__bb.game.p[1].hp < ${hp}`, 90000), 'the tram missed someone standing on the tracks');
});

test('each venue plays its own ambient sound bed', async () => {
  assert.deepEqual((await P(`ar.ambience()`)).sort(), ['birdsong', 'traffic', 'tram'].sort());
  assert.deepEqual(page.errors, []);
});
