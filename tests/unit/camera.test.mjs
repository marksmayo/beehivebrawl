import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fovForAspect, hfov } from '../../src/camerafit.js';

test('landscape screens keep the authored 40 degree vertical field of view', () => {
  for (const a of [16 / 9, 2.16, 4 / 3, 21 / 9]) assert.equal(fovForAspect(a), 40);
});

test('narrower screens widen the vertical FOV so the horizontal view never shrinks below 4:3', () => {
  const minH = hfov(40, 4 / 3);
  for (const a of [1, 9 / 16, 390 / 844, .4]) {
    const f = fovForAspect(a);
    assert.ok(f > 40 && f < 120, `fov ${f} for aspect ${a}`);
    assert.ok(Math.abs(hfov(f, a) - minH) < .01, `horizontal fov ${hfov(f, a)} != ${minH} at aspect ${a}`);
  }
});

test('fov grows monotonically as the screen narrows', () => {
  let prev = 0;
  for (const a of [2, 1.5, 1.2, 1, .8, .6, .46]) { const f = fovForAspect(a); assert.ok(f >= prev); prev = f; }
});
