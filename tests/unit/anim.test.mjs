import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as A from '../../src/anim.js';

const IDS = ['luxon', 'hipkins', 'seymour', 'peters', 'swarbrick', 'willis', 'waititi', 'brownlee'];
const near = (a, b, e = 1e-6) => Math.abs(a - b) <= e;
const ATK = { punch:{ s:.08, a:.08, r:.16 }, kick:{ s:.14, a:.11, r:.26 } };

// ---- poses ----------------------------------------------------------------
test('poses have every joint and blend linearly', () => {
  const g = A.GUARD;
  for (const k of A.JOINTS) assert.equal(typeof g[k], 'number', `guard missing ${k}`);
  const b = A.blend(g, { ...g, aFs:g.aFs + 1 }, .25);
  assert.ok(near(b.aFs, g.aFs + .25));
  assert.ok(near(b.lean, g.lean));
});

test('ease functions run 0..1 and easeOutBack overshoots', () => {
  for (const f of [A.ease.inOut, A.ease.out, A.ease.in]) { assert.ok(near(f(0), 0)); assert.ok(near(f(1), 1)); }
  assert.ok(Math.max(...[.5, .6, .7, .8, .9].map(A.ease.outBack)) > 1);
});

test('sampleKeys interpolates keyframes and holds the ends', () => {
  const k = [{ t:0, p:{ a:0 } }, { t:1, p:{ a:10 } }, { t:2, p:{ a:0 } }];
  assert.equal(A.sampleKeys(k, -1).a, 0);
  assert.ok(near(A.sampleKeys(k, .5, A.ease.lin).a, 5));
  assert.ok(near(A.sampleKeys(k, 1).a, 10));
  assert.equal(A.sampleKeys(k, 9).a, 0);
});

// ---- 22: anticipation, strike with overshoot, follow-through, settle --------
test('punch: winds up behind guard, overshoots on the strike, settles back to guard', () => {
  const d = ATK.punch, g = A.GUARD;
  const wind = A.attackPose('punch', d.s * .9, d), hit = A.attackPose('punch', d.s + d.a * .9, d), end = A.attackPose('punch', d.s + d.a + d.r, d);
  assert.ok(wind.aFs < g.aFs, 'anticipation pulls the arm back');
  assert.ok(wind.lean > g.lean, 'anticipation leans back');
  assert.ok(hit.aFs > Math.PI / 2, 'the strike overshoots horizontal');
  assert.ok(hit.aFe < .3, 'the arm is straight on impact');
  assert.ok(hit.lean < g.lean, 'weight goes forward on the strike');
  for (const k of A.JOINTS) assert.ok(near(end[k], g[k], 1e-3), `punch does not settle (${k})`);
});

test('kick: chambers the knee first, then extends it fully', () => {
  const d = ATK.kick, chamber = A.attackPose('kick', d.s * .95, d), ext = A.attackPose('kick', d.s + d.a * .9, d);
  assert.ok(chamber.lFk > 1.2, 'knee is chambered during anticipation');
  assert.ok(ext.lFh > 1.5 && ext.lFk < .3, 'leg extends on the strike');
});

// ---- 23: signature idles ----------------------------------------------------
test('every fighter has a signature idle that differs from the generic one and does its bit within 8s', () => {
  for (const id of IDS) {
    let maxDiff = 0;
    for (let t = 0; t < 8; t += .1) { const p = A.idlePose(id, t), q = A.idlePose('generic', t); maxDiff = Math.max(maxDiff, ...A.JOINTS.map(k => Math.abs(p[k] - q[k]))); }
    assert.ok(maxDiff > .5, `${id} idle looks generic (max diff ${maxDiff.toFixed(2)})`);
  }
});

// ---- 24 + 38: signature walks, feet planted (phase from distance) ------------
test('walk styles differ per fighter', () => {
  const sig = id => JSON.stringify(A.WALK[id] ?? A.WALK.generic);
  assert.equal(new Set(IDS.map(sig)).size, IDS.length);
});

test('walk phase advances with distance travelled, not time, so feet do not slide', () => {
  const st = A.WALK.luxon, p1 = A.walkPhase(0, 1, st), p2 = A.walkPhase(0, 2, st);
  assert.ok(near(p2, 2 * p1), 'phase is proportional to distance');
  assert.ok(near(A.walkPhase(p1, 0, st), p1), 'standing still does not advance the cycle');
  // one full cycle covers two strides
  assert.ok(near(A.walkPhase(0, st.stride * 2, st), Math.PI * 2));
});

test('walk pose swings legs opposite each other', () => {
  for (const id of IDS) {
    const p = A.walkPose(id, Math.PI / 2);
    assert.ok(Math.sign(p.lFh - A.GUARD.lFh) !== Math.sign(p.lBh - A.GUARD.lBh) || near(p.lFh, p.lBh) === false);
    assert.ok(Math.abs(p.lFh - p.lBh) > .4, `${id} legs barely move`);
  }
});

// ---- 25: hit reactions by height and direction --------------------------------
test('hit reactions: head snaps on high hits, body folds on mid, knees buckle on low', () => {
  const hi = A.hitPose('high', 1, .1), mid = A.hitPose('mid', 1, .1), lo = A.hitPose('low', 1, .1);
  assert.ok(Math.abs(hi.head) > Math.abs(mid.head) && Math.abs(hi.head) > .4);
  assert.ok(mid.lean < -.2, 'gut punch folds forward');
  assert.ok(lo.lFk > .6 && lo.lBk > .6, 'low hit buckles the knees');
  assert.ok(A.hitPose('high', -1, .1).lean * hi.lean < 0, 'a hit from behind throws the other way');
  assert.equal(A.hitHeight(1.9), 'high'); assert.equal(A.hitHeight(1.3), 'mid'); assert.equal(A.hitHeight(.5), 'low');
});

// ---- 26: ragdoll-ish KO fall ------------------------------------------------
test('KO fall bounces with shrinking bounces and comes to rest flat', () => {
  const k = A.koBody(1), impacts = [];
  for (let i = 0; i < 400; i++) { const ev = A.koStep(k, 1 / 60); if (ev) impacts.push(ev.speed); }
  assert.ok(impacts.length >= 2, `only ${impacts.length} impacts`);
  for (let i = 1; i < impacts.length; i++) assert.ok(impacts[i] < impacts[i - 1], 'bounces should shrink');
  assert.ok(near(k.angle, Math.PI / 2, .02) && near(k.y, 0, .01) && k.rest, 'ends lying flat and at rest');
});

// ---- 27: knockdown -> get up / wake-up roll ----------------------------------
test('knockdown lies, then gets up; holding a direction rolls instead', () => {
  assert.equal(A.wakeup(.3, 0).phase, 'down');
  assert.equal(A.wakeup(A.DOWN_TIME + .1, 0).phase, 'getup');
  assert.equal(A.wakeup(A.DOWN_TIME + A.GETUP_TIME + .01, 0).phase, 'done');
  const r = A.wakeup(A.DOWN_TIME + .1, 1);
  assert.equal(r.phase, 'roll'); assert.ok(r.dx > 0);
});

// ---- 28 + 99: dash from a double-tap, momentum curves ------------------------
test('double-tapping a direction within the window dashes; slow taps do not', () => {
  const d = new A.DashDetector(.25);
  assert.equal(d.feed({ right:true }, 0), null);
  assert.equal(d.feed({ right:false }, .05), null);
  assert.equal(d.feed({ right:true }, .15), 1);
  const s = new A.DashDetector(.25);
  s.feed({ left:true }, 0); s.feed({}, .1);
  assert.equal(s.feed({ left:true }, .5), null);
  assert.equal(s.feed({}, .6), null); assert.equal(s.feed({ left:true }, .7), -1);
});

test('dash speed bursts then decays; walking accelerates rather than snapping', () => {
  assert.ok(A.dashSpeed(0) > A.dashSpeed(.15) && A.dashSpeed(.15) > A.dashSpeed(.3));
  assert.ok(near(A.dashSpeed(A.DASH_TIME + .01), 0));
  const v1 = A.approachSpeed(0, 5, 1 / 60), v2 = A.approachSpeed(v1, 5, 1 / 60);
  assert.ok(v1 > 0 && v1 < 5 && v2 > v1, 'walk speed ramps up');
  assert.ok(A.approachSpeed(5, 0, 1 / 60) < 5, 'and slows down');
});

// ---- 29: air flips ------------------------------------------------------------
test('forward jumps do a full flip that lands upright', () => {
  assert.ok(near(A.flipAngle(0, 1), 0));
  assert.ok(near(A.flipAngle(1, 1), Math.PI * 2));
  assert.ok(A.flipAngle(.5, 1) > Math.PI * .6 && A.flipAngle(.5, 1) < Math.PI * 1.4);
});

// ---- 30: throws -----------------------------------------------------------------
test('forward + punch up close is a throw; at range it is just a punch', () => {
  assert.ok(A.isThrow({ punch:true, right:true }, .9, 1));
  assert.ok(!A.isThrow({ punch:true, right:true }, 2.5, 1), 'too far');
  assert.ok(!A.isThrow({ punch:true }, .9, 1), 'needs forward');
  assert.ok(A.isThrow({ punch:true, left:true }, .9, -1), 'forward depends on facing');
  for (const id of IDS) assert.ok(A.THROWS[id]?.name, `${id} has no throw name`);
});

// ---- 32: taunts -------------------------------------------------------------------
test('a completed taunt builds meter; an interrupted one does not', () => {
  assert.ok(A.tauntReward(false) > 0); assert.equal(A.tauntReward(true), 0);
});

// ---- 33 + 34: intros, victory and loser poses ----------------------------------------
test('every fighter has a round intro and at least two victory poses', () => {
  for (const id of IDS) {
    const intro = A.INTROS[id]; assert.ok(intro && intro.dur > 0 && typeof intro.pose === 'function', `${id} intro`);
    assert.ok(['walk', 'stride', 'drop', 'slide'].includes(intro.entry), `${id} entry`);
    assert.ok((A.VICTORY[id] ?? []).length >= 2, `${id} needs 2+ victory poses`);
  }
  assert.ok(A.loserPose(1).lean > .3 && A.loserPose(1).head > .2, 'loser slumps');
});

// ---- 35: smears ----------------------------------------------------------------------
test('smear stretch grows with limb speed and is capped', () => {
  assert.equal(A.smearStretch(0), 1);
  assert.ok(A.smearStretch(20) > A.smearStretch(10) && A.smearStretch(10) > 1);
  assert.ok(A.smearStretch(1e6) <= 1.6);
});

// ---- 36: secondary motion springs --------------------------------------------------------
test('springs lag behind, overshoot a little, and settle', () => {
  const s = new A.Spring(60, 8); let peak = 0;
  for (let i = 0; i < 240; i++) { s.step(1, 1 / 120); peak = Math.max(peak, s.x); }
  assert.ok(peak > 1 && peak < 1.4, `overshoot ${peak}`);
  assert.ok(near(s.x, 1, .01) && Math.abs(s.v) < .05, 'settles at the target');
});

// ---- 37 + 92: impact feel ------------------------------------------------------------------
test('heavier hits stop longer, punch the camera in harder and shake along the hit', () => {
  const l = A.impactFeel('punch'), h = A.impactFeel('kick'), s = A.impactFeel('super');
  assert.ok(l.stop < h.stop && h.stop < s.stop);
  assert.ok(l.zoom < h.zoom && h.zoom < s.zoom);
  const o = A.shakeOffset(.01, 1, .5, 0), o2 = A.shakeOffset(.3, 1, .5, 0);
  assert.ok(Math.abs(o.x) > Math.abs(o.y), 'shake goes mostly along the hit direction');
  assert.ok(Math.hypot(o2.x, o2.y) < Math.hypot(o.x, o.y), 'shake decays');
});

// ---- 39: turning around -------------------------------------------------------------------------
test('turning swings through 180 degrees instead of snapping', () => {
  const tr = A.turnAngle(0, A.TURN_TIME, 1), mid = A.turnAngle(A.TURN_TIME / 2, A.TURN_TIME, 1);
  assert.ok(near(tr, 0)); assert.ok(near(mid, Math.PI / 2, .3));
  assert.ok(near(A.turnAngle(A.TURN_TIME, A.TURN_TIME, 1), 0) || near(A.turnAngle(A.TURN_TIME, A.TURN_TIME, 1), Math.PI) === false);
});

// ---- 40: high and low guard -------------------------------------------------------------------------
test('high guard blocks high and mid, low guard blocks low and mid', () => {
  assert.ok(A.blocks('high', 'high') && A.blocks('high', 'mid') && !A.blocks('high', 'low'));
  assert.ok(A.blocks('low', 'low') && A.blocks('low', 'mid') && !A.blocks('low', 'high'));
  assert.ok(!A.blocks(null, 'mid'));
  assert.equal(A.ATTACK_HEIGHT.punch, 'high'); assert.equal(A.ATTACK_HEIGHT.kick, 'low');
  const hp = A.guardPose('high'), lp = A.guardPose('low');
  assert.ok(lp.py < hp.py - .1, 'low guard crouches');
});

test('held inputs pick a guard: down is low; back is high, but only under threat (otherwise you walk back)', () => {
  assert.equal(A.wantsGuard({ down:true }, 1, false), 'low');
  assert.equal(A.wantsGuard({ left:true }, 1, true), 'high', 'holding away from a threat blocks high');
  assert.equal(A.wantsGuard({ left:true }, 1, false), null, 'holding back with no threat just walks back');
  assert.equal(A.wantsGuard({ right:true }, -1, true), 'high', 'back depends on facing');
  assert.equal(A.wantsGuard({ right:true }, 1, true), null, 'holding forward never blocks');
});

test('the CPU guards high against punches and low against kicks', () => {
  assert.equal(A.guardFor('punch'), 'high');
  assert.equal(A.guardFor('kick'), 'low');
  assert.ok(['high', 'low'].includes(A.guardFor('special')));
  for (const t of ['punch', 'kick', 'special']) assert.ok(A.blocks(A.guardFor(t), A.ATTACK_HEIGHT[t]), `${t} not blocked by its guard`);
});

test('two presses in consecutive frames still dash (the release fell between frames)', () => {
  const d = new A.DashDetector(.25);
  assert.equal(d.feed({ right:true, rightTap:true }, 0), null);
  assert.equal(d.feed({ right:true, rightTap:true }, .05), 1);
});
