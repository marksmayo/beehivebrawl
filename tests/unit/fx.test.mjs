import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as F from '../../src/fxlogic.js';

// ---- 41: impact frames ------------------------------------------------------------------
test('supers and KOs flash an inverted impact frame, then an ink frame, then clear', () => {
  assert.equal(F.impactFrameAt(.01, 'super'), 'invert');
  assert.equal(F.impactFrameAt(.07, 'super'), 'ink');
  assert.equal(F.impactFrameAt(.3, 'super'), null);
  assert.equal(F.impactFrameAt(.01, 'punch'), null, 'ordinary hits do not get one');
});

// ---- 42: onomatopoeia ----------------------------------------------------------------------
test('sound-effect words are coloured by the kind of hit and get bigger for heavy ones', () => {
  const p = F.sfxStyle('punch', false, 1), k = F.sfxStyle('kick', true, 1), s = F.sfxStyle('super', true, 1);
  for (const w of [p, k, s]) { assert.ok(/!$/.test(w.word)); assert.match(w.fill, /^#[0-9a-f]{6}$/i); assert.ok(Math.abs(w.rot) <= .35); }
  assert.ok(k.scale > p.scale && s.scale > k.scale);
  assert.notEqual(F.sfxStyle('punch', false, 1).fill, F.sfxStyle('super', true, 1).fill);
  const words = new Set([...Array(30)].map((_, i) => F.sfxStyle('kick', true, i).word));
  assert.ok(words.size >= 4, 'some variety');
});

// ---- 43: speed lines -----------------------------------------------------------------------
test('speed lines run during dashes, rushes and super cinematics only', () => {
  assert.ok(F.speedLinesOn([{ state:'dash' }, { state:'idle' }], false));
  assert.ok(F.speedLinesOn([{ state:'special', sp:{ kind:'rush' } }, { state:'idle' }], false));
  assert.ok(F.speedLinesOn([{ state:'idle' }, { state:'idle' }], true));
  assert.ok(!F.speedLinesOn([{ state:'walk' }, { state:'attack' }], false));
});

// ---- 44: ink splats ---------------------------------------------------------------------------
test('ink splats are jagged closed blobs, repeatable from a seed', () => {
  const a = F.splatShape(7), b = F.splatShape(7), c = F.splatShape(8);
  assert.deepEqual(a, b); assert.notDeepEqual(a, c);
  assert.ok(a.length >= 16);
  const r = a.map(([x, y]) => Math.hypot(x, y));
  assert.ok(Math.max(...r) / Math.min(...r) > 1.5, 'spiky, not round');
  assert.ok(r.every(v => v <= 1.0001), 'fits in a unit circle');
});

// ---- 45: debris ----------------------------------------------------------------------------------
test('heavier hits throw more paperwork about', () => {
  const p = F.debrisFor('punch'), k = F.debrisFor('kick'), s = F.debrisFor('super');
  assert.equal(p.papers, 0);
  assert.ok(k.papers > 0 && s.papers > k.papers && s.chunks >= k.chunks);
});

// ---- 46: stylised fire and smoke ----------------------------------------------------------------
test('flames cool from white-yellow through orange to smoky red as they age', () => {
  const c = t => F.flameColor(t), lum = ([r, g, b]) => .3 * r + .59 * g + .11 * b;
  assert.ok(lum(c(0)) > lum(c(.5)) && lum(c(.5)) > lum(c(1)));
  assert.ok(c(.5)[0] > c(.5)[2], 'orange in the middle');
  for (const t of [0, .3, .7, 1]) assert.ok(c(t).every(v => v >= 0 && v <= 1));
});

// ---- 51: speech bubble tails ------------------------------------------------------------------------
test('speech bubble tails point at the speaker but stay on the bubble', () => {
  assert.equal(F.bubbleTail(500, 500, 200), 0);
  assert.ok(F.bubbleTail(560, 500, 200) > 0);
  assert.equal(F.bubbleTail(5000, 500, 200), 80, 'clamped inside the bubble');
  assert.equal(F.bubbleTail(-5000, 500, 200), -80);
});

// ---- 53: combo counter ------------------------------------------------------------------------------
test('the combo counter grows and wobbles more as the combo climbs', () => {
  const s3 = F.comboStyle(3), s6 = F.comboStyle(6), s20 = F.comboStyle(20);
  assert.ok(s6.size > s3.size && s6.wobble > s3.wobble);
  assert.ok(s20.size <= 70, 'capped');
  assert.match(F.comboStyle(10).label, /10 HIT/);
});

// ---- 55: HUD portrait expressions ----------------------------------------------------------------------
test('HUD portraits react: hurt when hit, shouting on specials, beaming in victory', () => {
  assert.equal(F.portraitMood({ state:'hit' }), 'hurt');
  assert.equal(F.portraitMood({ state:'ko' }), 'hurt');
  assert.equal(F.portraitMood({ state:'special' }), 'open');
  assert.equal(F.portraitMood({ state:'victory' }), 'open');
  assert.equal(F.portraitMood({ state:'idle', hp:12 }), 'hurt', 'looks worried when nearly out');
  assert.equal(F.portraitMood({ state:'idle', hp:80 }), 'n');
});
