import { test } from 'node:test';
import assert from 'node:assert/strict';
import { touchLayout, stickDir, TouchPad, ACTIONS } from '../../src/touch.js';

const PHONES = [[844, 390], [390, 844], [667, 375], [1024, 768], [360, 640]];
const overlaps = (a, b) => Math.hypot(a.x - b.x, a.y - b.y) < a.r + b.r;

test('layout puts every action button on screen, finger-sized, without overlaps', () => {
  for (const [w, h] of PHONES) {
    const L = touchLayout(w, h);
    assert.deepEqual(L.buttons.map(b => b.id).sort(), [...ACTIONS].sort());
    for (const b of [...L.buttons, L.pause]) {
      assert.ok(b.r >= 22, `${b.id} too small on ${w}x${h}`);
      assert.ok(b.x - b.r >= 0 && b.x + b.r <= w && b.y - b.r >= 0 && b.y + b.r <= h, `${b.id} off screen on ${w}x${h}`);
    }
    for (let i = 0; i < L.buttons.length; i++) for (let j = i + 1; j < L.buttons.length; j++)
      assert.ok(!overlaps(L.buttons[i], L.buttons[j]), `${L.buttons[i].id}/${L.buttons[j].id} overlap on ${w}x${h}`);
  }
});

test('layout keeps the stick zone (left) and the buttons (right) apart', () => {
  for (const [w, h] of PHONES) {
    const L = touchLayout(w, h);
    for (const b of L.buttons) assert.ok(b.x - b.r > L.stickZone.x1, `${b.id} intrudes on the stick zone on ${w}x${h}`);
  }
});

test('the punch button is the biggest and nearest the thumb', () => {
  const L = touchLayout(844, 390), punch = L.buttons.find(b => b.id === 'punch');
  for (const b of L.buttons) assert.ok(punch.r >= b.r);
  const corner = { x:844, y:390 }, d = b => Math.hypot(b.x - corner.x, b.y - corner.y);
  assert.ok(L.buttons.every(b => d(punch) <= d(b)));
});

test('stickDir respects the dead zone and reads 8 directions', () => {
  assert.deepEqual(stickDir(3, -2, 10), { left:false, right:false, up:false, down:false });
  assert.deepEqual(stickDir(30, 0, 10), { left:false, right:true, up:false, down:false });
  assert.deepEqual(stickDir(-30, 0, 10), { left:true, right:false, up:false, down:false });
  assert.deepEqual(stickDir(0, -30, 10), { left:false, right:false, up:true, down:false });
  assert.deepEqual(stickDir(0, 30, 10), { left:false, right:false, up:false, down:true });
  assert.deepEqual(stickDir(25, -25, 10), { left:false, right:true, up:true, down:false }); // jump forward
  // a mostly-sideways push doesn't trigger jump by accident
  assert.equal(stickDir(40, -12, 10).up, false);
});

test('a touch on the left half becomes a floating stick anchored where it landed', () => {
  const pad = new TouchPad(() => touchLayout(844, 390));
  pad.down(1, 150, 250);
  assert.deepEqual(pad.stick, { id:1, ox:150, oy:250, x:150, y:250 });
  pad.move(1, 210, 250);
  assert.equal(pad.held().right, true);
  pad.move(1, 90, 250);
  assert.equal(pad.held().left, true);
  pad.up(1);
  assert.equal(pad.stick, null);
  assert.deepEqual(pad.held(), { left:false, right:false, up:false, down:false });
});

test('the stick knob is clamped to the stick radius', () => {
  const pad = new TouchPad(() => touchLayout(844, 390)), L = touchLayout(844, 390);
  pad.down(1, 150, 250); pad.move(1, 600, 250);
  assert.ok(Math.hypot(pad.knob().x - 150, pad.knob().y - 250) <= L.stickR + 1e-9);
});

test('tapping a button buffers one press until consumed, even if released before the frame', () => {
  const L = touchLayout(844, 390), pad = new TouchPad(() => L), kick = L.buttons.find(b => b.id === 'kick');
  pad.down(7, kick.x, kick.y); pad.up(7);
  assert.deepEqual(pad.consume(), { kick:1 });
  assert.deepEqual(pad.consume(), {}, 'a press is only delivered once');
});

test('buttons have a little slop around the edge', () => {
  const L = touchLayout(844, 390), pad = new TouchPad(() => L), b = L.buttons.find(x => x.id === 'sup');
  pad.down(2, b.x + b.r * 1.1, b.y);
  assert.deepEqual(pad.consume(), { sup:1 });
});

test('stick and buttons work at the same time (multi-touch)', () => {
  const L = touchLayout(844, 390), pad = new TouchPad(() => L), punch = L.buttons.find(b => b.id === 'punch');
  pad.down(1, 150, 250); pad.move(1, 220, 250);
  pad.down(2, punch.x, punch.y);
  assert.equal(pad.held().right, true);
  assert.deepEqual(pad.consume(), { punch:1 });
  pad.up(2);
  assert.equal(pad.held().right, true, 'releasing a button leaves the stick alone');
});

test('a touch on the right side that misses every button does nothing', () => {
  const pad = new TouchPad(() => touchLayout(844, 390));
  pad.down(3, 600, 40);
  assert.equal(pad.stick, null);
  assert.deepEqual(pad.consume(), {});
});

test('the pause button reports a pause press', () => {
  const L = touchLayout(844, 390), pad = new TouchPad(() => L);
  pad.down(4, L.pause.x, L.pause.y);
  assert.deepEqual(pad.consume(), { pause:1 });
});

test('reset drops all touches', () => {
  const L = touchLayout(844, 390), pad = new TouchPad(() => L);
  pad.down(1, 150, 250); pad.move(1, 220, 250); pad.down(2, L.buttons[0].x, L.buttons[0].y);
  pad.reset();
  assert.equal(pad.stick, null);
  assert.deepEqual(pad.consume(), {});
  assert.equal(pad.held().right, false);
});

test('the pause button never overlaps an action button or the stick home', () => {
  for (const [w, h] of PHONES) {
    const L = touchLayout(w, h);
    for (const b of L.buttons) assert.ok(!overlaps(L.pause, b), `pause overlaps ${b.id} on ${w}x${h}`);
    assert.ok(!overlaps(L.pause, { x:L.stickHome.x, y:L.stickHome.y, r:L.stickR }), `pause overlaps the stick on ${w}x${h}`);
  }
});
