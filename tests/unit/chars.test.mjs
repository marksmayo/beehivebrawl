import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as C from '../../src/charlogic.js';
import { ROSTER } from '../../src/roster.js';

const IDS = ROSTER.map(d => d.id), by = id => ROSTER.find(d => d.id === id);

test('caricature proportions: heads are a third of the height (3)', () => {
  for (const id of IDS) { const r = C.headRatio(id); assert.ok(r >= .3 && r <= .42, `${id} head ratio ${r.toFixed(2)}`); }
});

test('distinct silhouettes per fighter (8)', () => {
  const sig = id => JSON.stringify(C.SILHOUETTE[id]);
  assert.equal(new Set(IDS.map(sig)).size, IDS.length);
  assert.ok(IDS.every(id => C.SILHOUETTE.brownlee.belly >= C.SILHOUETTE[id].belly), 'the Speaker has the biggest belly');
  assert.ok(IDS.every(id => C.SILHOUETTE.seymour.height <= C.SILHOUETTE[id].height), 'Seymour is the shortest');
});

test('hands change shape with the pose (5)', () => {
  for (const s of ['idle', 'block', 'attack']) assert.equal(C.handFor({ state:s }), 'fist');
  assert.equal(C.handFor({ state:'taunt' }), 'thumb');
  assert.equal(C.handFor({ state:'intro', def:{ id:'peters' } }), 'palm', 'waves on the way in');
  assert.ok(['point', 'thumb', 'palm'].includes(C.handFor({ state:'victory', vIdx:1, def:{ id:'luxon' } })));
  assert.equal(C.handFor({ state:'ko' }), 'palm');
  for (const h of ['fist', 'palm', 'point', 'thumb']) assert.ok(C.HANDS.includes(h));
});

test('suit fabrics: pinstripe for Peters, check for Hipkins and Waititi (6)', () => {
  assert.equal(C.suitPattern('peters'), 'pinstripe');
  assert.equal(C.suitPattern('hipkins'), 'check'); assert.equal(C.suitPattern('waititi'), 'check');
  assert.equal(C.suitPattern('luxon'), 'twill');
});

test('everyone carries a signature prop (7); the Speaker keeps his gavel', () => {
  for (const id of IDS) assert.ok(C.SIGNATURE[id], `${id} has no prop`);
  assert.equal(C.SIGNATURE.brownlee, 'gavel'); assert.equal(C.SIGNATURE.hipkins, 'can'); assert.equal(C.SIGNATURE.luxon, 'watch');
});

test('alternate costumes recolour the outfit (9) and every look wears a party rosette (10)', () => {
  assert.deepEqual(C.COSTUMES, ['parliament', 'campaign', 'beach', 'election']);
  const d = by('luxon');
  assert.equal(C.costume(d, 'parliament').suit, d.suit);
  assert.equal(C.costume(d, 'campaign').suit, 0xf5e000, 'hi-vis');
  assert.equal(C.costume(d, 'beach').tie, null, 'no tie at the beach');
  assert.ok(C.costume(d, 'election').sash);
  for (const c of C.COSTUMES) assert.equal(C.costume(d, c).rosette, d.pcol);
});

test('skin shadows are warm, not grey (12); rim light mixes party colour with the sky (13)', () => {
  for (const d of ROSTER) { const [r, , b] = C.skinShadow(d.skin); assert.ok(r > b, `${d.id} shadow not warm`); }
  const rim = C.rimColor(0xff0000, 0x0000ff); assert.ok(rim[0] > .3 && rim[2] > .1);
});

test('eyes look toward the opponent, within the eye (14)', () => {
  assert.ok(C.eyeLook(5, 0).x > 0 && C.eyeLook(-5, 0).x < 0);
  assert.ok(Math.abs(C.eyeLook(500, 0).x) <= C.EYE_RANGE + 1e-9);
  assert.ok(C.eyeLook(0, 3).y > 0);
});

test('brows furrow when attacking, shoot up when hit, relax at rest (15)', () => {
  assert.ok(C.browPose('attack').furrow > .5); assert.ok(C.browPose('hit').raise > .5);
  assert.deepEqual(C.browPose('idle'), { raise:0, furrow:0 });
});

test('lip-sync: catchphrases become a sequence of mouth shapes (16)', () => {
  const v = C.visemes('Bread and butter');
  assert.ok(v.length >= 6); assert.ok(v.every(s => C.VISEMES.includes(s.shape)));
  assert.equal(v[0].shape, 'M', 'b closes the lips');
  assert.ok(v.some(s => s.shape === 'A'));
  assert.ok(v.at(-1).t > v[0].t);
});

test('face decals: sweat when nearly out, a vein when angry, a blush when cocky (17)', () => {
  assert.ok(C.moodDecals({ state:'idle', hp:20 }).includes('sweat'));
  assert.ok(C.moodDecals({ state:'special', hp:90 }).includes('vein'));
  assert.ok(C.moodDecals({ state:'taunt', hp:90 }).includes('blush'));
  assert.deepEqual(C.moodDecals({ state:'idle', hp:90 }), []);
});

test('wear and tear builds up over the match (18) and dishevels the fighter (19)', () => {
  assert.equal(C.wearLevel(0, 100), 0);
  assert.ok(C.wearLevel(1, 40) > C.wearLevel(0, 40)); assert.ok(C.wearLevel(2, 5) <= 3);
  const fresh = C.dishevel(100), beaten = C.dishevel(10);
  for (const k of ['tie', 'hair', 'collar']) assert.ok(beaten[k] > fresh[k], k);
  assert.equal(fresh.tie, 0);
});

test('victory outfits vary (20)', () => {
  const kinds = new Set(IDS.flatMap(id => [0, 1].map(v => C.victoryOutfit(id, v))));
  assert.ok(kinds.has('confetti') && kinds.has('champagne') && kinds.has('crown'));
});
