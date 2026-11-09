import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readControls } from '../../src/controls.js';

const BIND = { left:['KeyA'], right:['KeyD'], up:['KeyW'], down:['KeyS'], punch:['KeyJ'], kick:['KeyK'], taunt:['KeyU'] };

test('held keys read as held, presses read once', () => {
  const c = readControls(BIND, new Set(['KeyD']), new Set(['KeyJ']));
  assert.equal(c.right, true); assert.equal(c.punch, true); assert.equal(c.kick, false); assert.equal(c.left, false);
});

test('a direction tapped and released between two frames still counts as held for that frame', () => {
  const c = readControls(BIND, new Set(), new Set(['KeyW', 'KeyD']));
  assert.equal(c.up, true, 'a quick jump tap is not lost'); assert.equal(c.right, true, 'a quick dash tap is not lost');
});

test('a press of a key that is not bound changes nothing', () => {
  const c = readControls(BIND, new Set(), new Set(['KeyZ']));
  assert.ok(Object.values(c).every(v => v === false));
});

test('directions report a fresh press as a tap flag', () => {
  const c = readControls(BIND, new Set(['KeyD']), new Set(['KeyD']));
  assert.equal(c.rightTap, true);
  assert.equal(readControls(BIND, new Set(['KeyD']), new Set()).rightTap, false, 'holding is not a tap');
});
