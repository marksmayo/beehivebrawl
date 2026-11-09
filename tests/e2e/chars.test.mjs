// Characters and rendering in the real game: proportions, hands, props, rosettes, fabrics,
// costumes, eyes, brows, lip-sync, mood decals, wear and tear, victory outfits, painted
// hair, warm skin shadows, rim light, contact shadows, glow, depth of field, grading, MSAA.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { serve, browser, sleep } from './harness.mjs';

let srv, page;
const P = expr => page.eval(`(() => { const g = __bb.game, a = g.p[0], b = g.p[1], sc = __bb.scene, mk = __bb.makeFighter; return ${expr}; })()`);
const find = (root, test) => `(() => { let out = null; ${root}.traverse(o => { if (!out && (${test})) out = o; }); return out; })()`;

before(async () => {
  srv = await serve(); page = await browser();
  await page.goto(srv.url + '?test');
  assert.ok(await page.waitFor(`window.__bb?.game.phase === 'title'`));
});
after(() => { page?.close(); srv?.close(); });

test('built fighters: big heads, distinct silhouettes, rosettes, signature props, fabrics (3, 6, 7, 8, 10)', async () => {
  const info = await P(`['luxon', 'hipkins', 'peters', 'brownlee'].map(id => { const f = mk(id); const r = f.root;
    return { id, head:f.head.scale.x, torso:f.torso.scale.toArray(), rosette:!!${find('r', 'o.userData.rosette')}, sig:${find('r', 'o.userData.signature')}?.userData.signature,
      jacket:${find('r', "o.userData.role === 'jacket'")}?.material.userData.pattern }; })`);
  for (const f of info) { assert.ok(f.head > 1, `${f.id} head not enlarged`); assert.ok(f.rosette, `${f.id} has no rosette`); assert.ok(f.sig, `${f.id} has no signature prop`); }
  assert.equal(info.find(f => f.id === 'hipkins').sig, 'can');
  assert.match(info.find(f => f.id === 'peters').jacket, /pinstripe/);
  assert.ok(info.find(f => f.id === 'brownlee').torso[0] > info.find(f => f.id === 'luxon').torso[0], 'Brownlee is broader');
});

test('hands switch shape with the pose (5)', async () => {
  const r = await P(`(() => { const f = mk('luxon'); f.state = 'taunt'; f.stateT = .3; f.animate(.016); const t = f.handShape;
    f.state = 'idle'; f.animate(.016); return [t, f.handShape, Object.keys(f.hands ?? {}).sort()]; })()`);
  assert.deepEqual(r[2], ['fist', 'palm', 'point', 'thumb']);
  assert.equal(r[0], 'thumb'); assert.equal(r[1], 'fist');
});

test('eyes track the opponent and brows move with the mood (14, 15)', async () => {
  const r = await P(`(() => { const f = mk('seymour'), o = mk('peters'); f.opp = o; f.x = 0;
    o.x = 5; f.animate(.016); const right = f.irises[0].position.clone();
    o.x = -5; f.animate(.016); f.animate(.016); const left = f.irises[0].position.clone();
    f.state = 'idle'; f.animate(.1); const calm = f.brows[0].rotation.z;
    f.state = 'attack'; f.atk = { type:'punch', t:.05, d:{ s:.07, a:.09, r:.16 } }; f.animate(.1); const angry = f.brows[0].rotation.z;
    return [right.distanceTo(left), calm, angry]; })()`);
  assert.ok(r[0] > .005, 'irises did not move');
  assert.ok(Math.abs(r[2] - r[1]) > .1, 'brows did not change');
});

test('talking animates the mouth (16) and moods show decals (17)', async () => {
  const r = await P(`(() => { const f = mk('willis'); f.speak('Bread and butter'); const shapes = new Set();
    for (let i = 0; i < 20; i++) { f.animate(.05); shapes.add(f.mouthShape); }
    f.hp = 15; f.state = 'idle'; f.animate(.016); const sweat = f.decals.sweat.visible;
    f.state = 'special'; f.sp = { kind:'blast', t:.1 }; f.animate(.016); const vein = f.decals.vein.visible;
    return [[...shapes], f.mouthDecal.visible, sweat, vein]; })()`);
  assert.ok(r[0].length >= 3, `mouth barely moved: ${r[0]}`);
  assert.ok(r[2], 'no sweat when nearly out'); assert.ok(r[3], 'no anger vein on a special');
});

test('wear and tear builds up and dishevels the fighter (18, 19)', async () => {
  const r = await P(`(() => { const f = mk('hipkins'); const fresh = f.faceMat.map; f.hp = 100; f.animate(.1); const tie0 = f.tiePivot.scale.y;
    f.setWear(2); const worn = f.faceMat.map; f.hp = 8; for (let i = 0; i < 10; i++) f.animate(.1);
    return [fresh !== worn, f.tiePivot.scale.y !== tie0 || Math.abs(f.tiePivot.rotation.x) > .05]; })()`);
  assert.ok(r[0], 'face did not show wear'); assert.ok(r[1], 'not dishevelled at low health');
});

test('painted hair and faces, warm skin shadows and a party rim light (1, 2, 12, 13)', async () => {
  const r = await P(`(() => { const f = mk('swarbrick'), hair = ${find('f.root', "o.userData.role === 'hair'")}, skin = f.faceMat;
    const c = skin.map.image, d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data, cols = new Set();
    for (let i = 0; i < d.length; i += 4 * 97) cols.add((d[i] >> 4) + ',' + (d[i + 1] >> 4) + ',' + (d[i + 2] >> 4));
    return [!!hair?.material.map, cols.size, !!skin.userData.skinShadow, !!skin.userData.rim]; })()`);
  assert.ok(r[0], 'hair has no painted strand texture');
  assert.ok(r[1] > 40, `face painting looks flat (${r[1]} tones)`);
  assert.ok(r[2], 'skin has no warm shadow ramp'); assert.ok(r[3], 'no rim light');
});

test('a match: contact shadows, costume choice, grading per arena, MSAA (9, 72, 77, 78)', async () => {
  await page.key('Enter'); await sleep(800);
  await page.key('KeyC'); // cycle P1 costume
  assert.equal(await P(`g.costume[0]`), 'campaign');
  await page.key('KeyJ');
  assert.ok(await page.waitFor(`__bb.game.phase === 'fight'`, 90000));
  await page.eval(`__bb.game.ai.think = () => ({})`);
  assert.ok(await P(`${find('a.root.parent', "o.userData.contact === a")} !== null`), 'no contact shadow under P1');
  const jacket = await P(`${find('a.root', "o.userData.role === 'jacket'")}.material.color.getHex()`);
  assert.ok((jacket >> 16 & 255) > 200 && (jacket >> 8 & 255) > 180 && (jacket & 255) < 120, `campaign hi-vis not applied (#${jacket.toString(16)})`);
  const gr = await P(`__bb.post.mat.uniforms.uGain.value.toArray()`);
  assert.ok(gr.some(v => Math.abs(v - 1) > 1e-6), 'no arena colour grade');
  assert.ok(await P(`__bb.post.rt.samples >= 4`), 'post target not multisampled');
});

test('supers glow and blur the backdrop; winners get a victory outfit (20, 75, 76)', async () => {
  await P(`(a.meter = 100, a.x = -1, b.x = 1, 1)`);
  await page.eval(`(() => { const r = __bb.rec = []; (function w() { if (__bb.rec !== r) return; let glow = 0, blur = false;
    __bb.scene.traverse(o => { if (o.userData?.glow) glow++; if (o.userData?.layer === 'scene' && o.material.map === o.userData.blurMap) blur = true; }); r.push([!!__bb.game.cine, glow, blur]); requestAnimationFrame(w); })(); })()`);
  await page.key('KeyO', 120);
  assert.ok(await page.waitFor(`__bb.rec.some(r => r[0] && r[1] > 0)`, 20000), 'no glow during the super');
  assert.ok(await page.eval(`__bb.rec.some(r => r[0] && r[2])`), 'backdrop not blurred during the super');
  await page.waitFor(`!__bb.game.cine`, 20000);
  await P(`(b.hp = 0, g.ko(b, a, 1), 1)`);
  assert.ok(await page.waitFor(`__bb.game.p[0].state === 'victory'`, 30000));
  assert.ok(await page.waitFor(`(() => { let n = 0; __bb.scene.traverse(o => { if (['confetti', 'champagne'].includes(o.userData?.fx)) n++; }); return n > 0 || __bb.game.p[0].crown.visible; })()`, 15000), 'no victory outfit');
  assert.deepEqual(page.errors, []);
});
