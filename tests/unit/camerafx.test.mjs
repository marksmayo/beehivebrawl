import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as C from '../../src/camerafx.js';

// ---- 91: dynamic framing ------------------------------------------------------------
test('the camera moves in when the fighters are close and pulls back when they separate', () => {
  const close = C.framing({ ax:-.8, bx:.8 }), far = C.framing({ ax:-5, bx:5 });
  assert.ok(close.dist < far.dist, 'closer when close');
  assert.ok(Math.abs(close.cx) < 1e-9 && Math.abs(far.cx) < 1e-9, 'centred between them');
  assert.ok(C.framing({ ax:2, bx:4 }).cx > 2.9 && C.framing({ ax:2, bx:4 }).cx < 3.1);
});

test('combos and supers tilt the camera (Dutch angle); calm play stays level', () => {
  assert.equal(C.framing({ ax:-1, bx:1, combo:0 }).roll, 0);
  assert.ok(Math.abs(C.framing({ ax:-1, bx:1, combo:4 }).roll) > .03);
  assert.ok(Math.abs(C.framing({ ax:-1, bx:1, combo:4 }).roll) < .2, 'tasteful');
  assert.ok(C.framing({ ax:-1, bx:1, combo:4 }).dist < C.framing({ ax:-1, bx:1, combo:0 }).dist, 'combos push in a little');
});

// ---- 93: slow-motion final KO ---------------------------------------------------------
test('the final KO starts in deep slow motion, desaturated, and recovers', () => {
  const s0 = C.koSlowmo(0), s1 = C.koSlowmo(.8), s2 = C.koSlowmo(3);
  assert.ok(s0.timeScale <= .2 && s0.saturation <= .35);
  assert.ok(s1.timeScale > s0.timeScale && s1.saturation > s0.saturation);
  assert.equal(s2.timeScale, 1); assert.equal(s2.saturation, 1);
});

// ---- 94: replay ------------------------------------------------------------------------------
test('the replay buffer keeps only the last few seconds, in order', () => {
  const r = new C.ReplayBuffer(2, 10); // 2 s at 10 snapshots/s
  for (let i = 0; i < 50; i++) r.push({ i }, i / 10);
  const f = r.frames();
  assert.equal(f.length, 20); assert.equal(f[0].snap.i, 30); assert.equal(f.at(-1).snap.i, 49);
  r.clear(); assert.equal(r.frames().length, 0);
});

test('the replay camera orbits the action from a new angle', () => {
  const a = C.replayCamera(0, 1.5, { x:0, y:1 }), b = C.replayCamera(1.5, 1.5, { x:0, y:1 });
  assert.ok(Math.hypot(a.x - b.x, a.z - b.z) > 1, 'it moves');
  assert.ok(Math.abs(a.x) > .5, 'it starts off to the side, not the usual front-on view');
  for (const p of [a, b]) assert.ok(Math.hypot(p.x, p.z - 0) > 3 && Math.hypot(p.x, p.z) < 12, 'keeps a sensible distance');
});

// ---- 31 + 95: super cinematics -------------------------------------------------------------
test('a super move cuts to a side close-up, then pushes in on the fighter', () => {
  const f = { x:2, y:0, facing:1 };
  const shots = [0, .2, .4, .6, .85].map(t => C.cinePath(t, .85, f));
  assert.ok(shots[0].cut, 'starts with a cut');
  for (const s of shots) assert.ok(Math.hypot(s.look.x - f.x, s.look.y - 2) < 1.5, 'always looks at the fighter');
  const d = s => Math.hypot(s.pos.x - s.look.x, s.pos.z - s.look.z);
  assert.ok(d(shots.at(-1)) < d(shots[1]), 'pushes in');
  assert.ok(shots.some(s => Math.abs(s.pos.x - f.x) > 1.5), 'swings round to the side');
});

// ---- 96: low-health vignette pulse ------------------------------------------------------------
test('the vignette only pulses when health is low, faster as it drops', () => {
  assert.equal(C.vignettePulse(80, 1), 0);
  const v = [...Array(40)].map((_, i) => C.vignettePulse(15, i / 20));
  assert.ok(Math.max(...v) > .5 && Math.min(...v) < Math.max(...v) - .2, 'pulses');
  assert.ok(C.pulseRate(5) > C.pulseRate(25));
});

// ---- 98: buffering and cancels -------------------------------------------------------------------
test('a press during recovery is buffered briefly and comes out when the fighter is free', () => {
  const b = new C.InputBuffer(.15);
  b.press('punch', 0);
  assert.equal(b.take(['punch', 'kick'], .1), 'punch');
  assert.equal(b.take(['punch'], .12), null, 'used once');
  b.press('kick', 1); assert.equal(b.take(['kick'], 1.3), null, 'too old');
});

test('normals cancel into specials only on a connecting strike or early recovery', () => {
  assert.ok(C.canCancel({ hit:true, phase:'recover', t:.05 }, 'special'));
  assert.ok(!C.canCancel({ hit:false, phase:'recover', t:.05 }, 'special'), 'whiffs do not cancel');
  assert.ok(!C.canCancel({ hit:true, phase:'recover', t:.3 }, 'special'), 'too late');
  assert.ok(C.canCancel({ hit:true, phase:'strike', t:0 }, 'super'));
  assert.ok(!C.canCancel({ hit:true, phase:'strike', t:0 }, 'punch'), 'normals do not chain into normals');
});
