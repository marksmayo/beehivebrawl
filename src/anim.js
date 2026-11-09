// Pose library for the fighters: pure functions, no three.js.
// A pose is a flat set of joint angles (radians) the rig applies:
//   aFs/aFe, aBs/aBe  front/back arm: shoulder swing (0 = down, PI/2 = forward), elbow bend
//   lFh/lFk, lBh/lBk  front/back leg: hip swing (+ = forward), knee bend (>= 0)
//   lean (+ = back), py (body bob), head (+ = chin down), twist (torso yaw)

const JOINTS = ['aFs', 'aFe', 'aBs', 'aBe', 'lFh', 'lFk', 'lBh', 'lBk', 'lean', 'py', 'head', 'twist'];
const PI = Math.PI, clamp01 = v => Math.max(0, Math.min(1, v));
const GUARD = Object.freeze({ aFs:.95, aFe:1.5, aBs:.55, aBe:1.7, lFh:.28, lFk:.25, lBh:-.22, lBk:.18, lean:-.06, py:-.04, head:0, twist:0 });

const ease = {
  lin:t => t,
  in:t => t * t,
  out:t => 1 - (1 - t) * (1 - t),
  inOut:t => t * t * (3 - 2 * t),
  outBack:t => { const c = 1.9; return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2; },
};

const pose = (over = {}, base = GUARD) => ({ ...base, ...over });
function blend(a, b, t) { const o = {}; for (const k of JOINTS) o[k] = a[k] + (b[k] - a[k]) * t; return o; }
// add b's offsets from GUARD onto a, scaled by w
function layer(a, b, w) { const o = { ...a }; for (const k of JOINTS) o[k] += (b[k] - GUARD[k]) * w; return o; }

// keys: [{ t, p, e? }] where p is a (partial) pose; e eases the segment ending at that key
function sampleKeys(keys, t, e = ease.inOut) {
  if (t <= keys[0].t) return { ...keys[0].p };
  for (let i = 1; i < keys.length; i++) {
    const k0 = keys[i - 1], k1 = keys[i];
    if (t <= k1.t) {
      const u = (k1.e ?? e)(clamp01((t - k0.t) / Math.max(1e-9, k1.t - k0.t))), o = {};
      for (const k in k1.p) o[k] = (k0.p[k] ?? k1.p[k]) + (k1.p[k] - (k0.p[k] ?? k1.p[k])) * u;
      return o;
    }
  }
  return { ...keys.at(-1).p };
}

// ---- attacks: anticipation -> strike (overshoot) -> follow-through -> settle (22)
function attackPose(type, t, d) {
  const s = d.s, a = d.a, r = d.r;
  const keys = type === 'punch' ? [
    { t:0, p:GUARD },
    { t:s, p:pose({ aFs:.35, aFe:2.1, lean:.1, twist:-.3, aBs:.7 }) },
    { t:s + a * .6, p:pose({ aFs:PI / 2 + .25, aFe:.05, lean:-.32, twist:.35, aBs:.3, lFh:.45, lBh:-.4 }), e:ease.out },
    { t:s + a, p:pose({ aFs:PI / 2 + .05, aFe:.1, lean:-.28, twist:.3, aBs:.3, lFh:.45, lBh:-.4 }) },
    { t:s + a + r * .4, p:pose({ aFs:PI / 2 - .1, aFe:.4, lean:-.15, twist:.15 }) },
    { t:s + a + r, p:GUARD },
  ] : [
    { t:0, p:GUARD },
    { t:s, p:pose({ lFh:.95, lFk:1.7, lean:.05, aFs:.7, aBs:.2, py:.04 }) },
    { t:s + a * .6, p:pose({ lFh:1.75, lFk:.05, lean:.35, aFs:.5, aBs:-.2, lBk:.05 }), e:ease.out },
    { t:s + a, p:pose({ lFh:1.6, lFk:.1, lean:.3, aFs:.5, aBs:-.2 }) },
    { t:s + a + r * .5, p:pose({ lFh:.8, lFk:.9, lean:.12 }) },
    { t:s + a + r, p:GUARD },
  ];
  return pose(sampleKeys(keys, t));
}

// ---- signature idles (23): breathing plus a recurring bit of business
const bump = (t, period, from = .55, len = .3) => { const ph = (t % period) / period; return Math.sin(PI * clamp01((ph - from) / len)); };
const IDLE_BITS = {
  luxon:{ period:5.5, p:pose({ aBs:1.6, aBe:2.3, head:.38, twist:-.2 }) },           // checks his watch
  hipkins:{ period:5, p:pose({ aFs:1.9, aFe:2.6, head:-.18 }) },                      // sips a Diet Coke
  seymour:{ period:3, p:pose({ aFs:2.4, aBs:2.2, aFe:.8, aBe:.8, twist:.6, py:.08 }) }, // little dance
  peters:{ period:6, p:pose({ aFs:1.5, aFe:2.55, head:.22, twist:.2 }) },             // straightens his tie
  swarbrick:{ period:5, p:pose({ aFs:1.2, aFe:2.4, aBs:1.2, aBe:2.4, lean:.06 }) },    // arms folded
  willis:{ period:5.5, p:pose({ aFs:.15, aFe:2.0, aBs:.15, aBe:2.0, head:-.12, lean:.04 }) }, // hands on hips
  waititi:{ period:6, p:pose({ aFs:2.8, aFe:2.2, head:.15 }) },                       // tips his hat
  brownlee:{ period:4, p:pose({ aFs:1.9, aFe:.7, lean:-.08 }) },                     // gavel at the ready
};
function idlePose(id, t) {
  const p = pose({ py:GUARD.py + Math.sin(t * 2.2) * .03, aFs:GUARD.aFs + Math.sin(t * 2.2) * .04, head:Math.sin(t * .9) * .03 });
  const bit = IDLE_BITS[id];
  if (!bit) return p;
  let w = bump(t, bit.period);
  if (id === 'brownlee') w *= .6 + .4 * Math.abs(Math.sin(t * 9)); // tap tap tap
  if (id === 'seymour') p.py += Math.abs(Math.sin(t * 6)) * .05;
  return layer(p, bit.p, w);
}

// ---- signature walks (24); the cycle is driven by distance so feet stay planted (38)
const WALK = {
  generic:{ stride:.55, swing:.5, arm:.35, bounce:.06, lean:-.06, knee:.6 },
  luxon:{ stride:.62, swing:.52, arm:.3, bounce:.05, lean:-.1, knee:.55 },     // purposeful CEO stride
  hipkins:{ stride:.5, swing:.48, arm:.42, bounce:.07, lean:-.04, knee:.6 },   // easy amble
  seymour:{ stride:.45, swing:.6, arm:.6, bounce:.12, lean:-.02, knee:.8, hop:true }, // dance-step
  peters:{ stride:.58, swing:.42, arm:.25, bounce:.04, lean:.04, knee:.45 },   // unhurried, chin up
  swarbrick:{ stride:.48, swing:.55, arm:.45, bounce:.07, lean:-.12, knee:.65 }, // brisk
  willis:{ stride:.5, swing:.5, arm:.38, bounce:.06, lean:-.08, knee:.6 },
  waititi:{ stride:.6, swing:.46, arm:.32, bounce:.05, lean:-.03, knee:.5 },
  brownlee:{ stride:.66, swing:.38, arm:.28, bounce:.11, lean:.06, knee:.4, stomp:true }, // stomp
};
const walkPhase = (phase, dist, st) => phase + Math.abs(dist) / st.stride * PI;
function walkPose(id, ph) {
  const st = WALK[id] ?? WALK.generic, s = Math.sin(ph), c = Math.cos(ph);
  const p = pose({
    lFh:s * st.swing, lBh:-s * st.swing,
    lFk:.15 + Math.max(0, -c) * st.knee, lBk:.15 + Math.max(0, c) * st.knee,
    aFs:GUARD.aFs - s * st.arm, aBs:GUARD.aBs + s * st.arm,
    py:Math.abs(s) * st.bounce * (st.stomp ? 1.4 : 1) - .02, lean:st.lean, twist:s * .12,
  });
  if (st.hop) p.py += Math.max(0, Math.sin(ph * 2)) * .06;
  return p;
}

// ---- hit reactions by height and direction (25)
const hitHeight = hy => hy > 1.7 ? 'high' : hy > 1.0 ? 'mid' : 'low';
function hitPose(height, dir, t) {
  const k = Math.max(0, 1 - t / .4), d = dir >= 0 ? 1 : -1;
  const shapes = {
    high:pose({ head:-.6 * d, lean:.35 * d, aFs:-.3, aBs:-.5, aFe:.4, aBe:.4 }),
    mid:pose({ lean:-.45, head:.3, aFs:.3, aBs:.2, aFe:1.9, aBe:1.9, lFk:.4, lBk:.4, py:-.08 }),
    low:pose({ lFk:.9, lBk:.9, lFh:.5, lBh:.2, py:-.3, lean:.1 * d, head:.15, aFs:1.4, aBs:1.2 }),
  };
  return blend(GUARD, shapes[height], .35 + .65 * k);
}

// ---- KO fall: tips over under "gravity", bounces with losing energy, rests flat (26)
const koBody = dir => ({ dir, angle:0, av:.5, y:0, rest:false });
function koStep(k, dt) {
  if (k.rest) return null;
  k.av += 14 * dt; k.angle += k.av * dt;
  if (k.angle >= PI / 2) {
    k.angle = PI / 2;
    const speed = k.av;
    if (speed < .8) { k.av = 0; k.rest = true; return { speed }; }
    k.av = -speed * .35;
    return { speed };
  }
  return null;
}

// ---- knockdown: lie there, then get up, or roll if a direction is held (27)
const DOWN_TIME = .7, GETUP_TIME = .45, ROLL_TIME = .45;
function wakeup(t, dir) {
  if (t < DOWN_TIME) return { phase:'down', k:t / DOWN_TIME };
  const u = t - DOWN_TIME;
  if (dir && u < ROLL_TIME) return { phase:'roll', k:u / ROLL_TIME, dx:dir * 2.4 };
  if (!dir && u < GETUP_TIME) return { phase:'getup', k:u / GETUP_TIME };
  return { phase:'done', k:1 };
}

// ---- dash from a double tap (28); momentum curves (99)
class DashDetector {
  constructor(window = .25) { this.window = window; this.prev = {}; this.last = {}; }
  feed(c, now) {
    let out = null;
    for (const [k, d] of [['left', -1], ['right', 1]]) {
      const on = !!c[k], edge = (on && !this.prev[k]) || !!c[k + 'Tap']; // a fresh press counts even if the release fell between frames
      if (edge) {
        if (this.last[k] != null && now - this.last[k] <= this.window) { out = d; this.last[k] = null; }
        else this.last[k] = now;
      }
      this.prev[k] = on;
    }
    return out;
  }
}
const DASH_TIME = .32, DASH_SPEED = 13;
const dashSpeed = t => t >= DASH_TIME ? 0 : DASH_SPEED * (1 - t / DASH_TIME) ** 2;
const approachSpeed = (v, target, dt, accel = 40, decel = 55) => {
  const rate = Math.abs(target) > Math.abs(v) ? accel : decel, dv = target - v, step = rate * dt;
  return Math.abs(dv) <= step ? target : v + Math.sign(dv) * step;
};

// ---- forward-jump flips (29)
const flipAngle = (t, T) => PI * 2 * ease.inOut(clamp01(t / T));

// ---- throws (30): forward + punch at close range
const THROWS = {
  luxon:{ name:'THE HOSTILE TAKEOVER' }, hipkins:{ name:'SAUSAGE SIZZLE SUPLEX' }, seymour:{ name:'DEREGULATION DROP' },
  peters:{ name:'COALITION CLINCH' }, swarbrick:{ name:'THE OK BOOMERANG' }, willis:{ name:'THE FISCAL HUG' },
  waititi:{ name:'NO-TIE TOSS' }, brownlee:{ name:'POINT OF ORDER' },
};
const THROW_RANGE = 1.3, THROW_DMG = 12;
const isThrow = (c, dx, facing) => !!c.punch && !!(facing > 0 ? c.right : c.left) && Math.abs(dx) < THROW_RANGE;
const throwPose = t => sampleKeys([
  { t:0, p:GUARD }, { t:.15, p:pose({ aFs:1.6, aFe:.6, aBs:1.5, aBe:.7, lean:-.2 }) },
  { t:.45, p:pose({ aFs:2.6, aFe:.4, aBs:2.4, aBe:.5, lean:.35, twist:-.8 }) }, { t:.7, p:GUARD },
], t);

// ---- taunts (32)
const TAUNT_TIME = 1.1;
const tauntReward = interrupted => interrupted ? 0 : 15;
const tauntPose = t => layer(GUARD, pose({ aFs:2.7, aFe:.5, aBs:.1, aBe:2.1, head:-.2, lean:.12 }), Math.sin(PI * clamp01(t / TAUNT_TIME)));

// ---- round intros (33), victory poses (34), losing (34)
const wave = (t, sp = 9) => pose({ aFs:2.8 + Math.sin(t * sp) * .25, aFe:.6, head:-.1 });
const INTROS = {
  luxon:{ entry:'stride', dur:1.4, pose:t => layer(walkPose('luxon', t * 9), pose({ aFs:2.2, aFe:.9 }), clamp01(t - .8)) }, // thumbs up after striding in
  hipkins:{ entry:'walk', dur:1.4, pose:t => layer(walkPose('hipkins', t * 8), IDLE_BITS.hipkins.p, clamp01(t - .7)) },
  seymour:{ entry:'slide', dur:1.3, pose:t => layer(GUARD, IDLE_BITS.seymour.p, Math.abs(Math.sin(t * 5))) },
  peters:{ entry:'stride', dur:1.4, pose:t => layer(walkPose('peters', t * 7), wave(t), clamp01(t - .4)) },
  swarbrick:{ entry:'walk', dur:1.3, pose:t => layer(walkPose('swarbrick', t * 10), IDLE_BITS.swarbrick.p, clamp01(t - .8)) },
  willis:{ entry:'walk', dur:1.3, pose:t => layer(walkPose('willis', t * 9), IDLE_BITS.willis.p, clamp01(t - .8)) },
  waititi:{ entry:'stride', dur:1.4, pose:t => layer(walkPose('waititi', t * 8), IDLE_BITS.waititi.p, clamp01(t - .8)) },
  brownlee:{ entry:'drop', dur:1.2, pose:t => layer(GUARD, IDLE_BITS.brownlee.p, clamp01(t * 2)) },
};
const cheer = t => pose({ aFs:PI - .2 + Math.sin(t * 8) * .25, aBs:PI - .3 + Math.sin(t * 8 + 1) * .25, aFe:.2, aBe:.2, py:Math.abs(Math.sin(t * 5)) * .25 });
const flex = t => pose({ aFs:1.6, aFe:2.4 + Math.sin(t * 6) * .2, aBs:1.6, aBe:2.4 + Math.sin(t * 6 + PI) * .2, lean:.1, py:.02 });
const point = t => pose({ aFs:PI / 2 + .1, aFe:.05, aBs:.3, head:-.15 + Math.sin(t * 3) * .05, lean:-.1 });
const VICTORY = {
  luxon:[cheer, t => pose({ aFs:2.2, aFe:.9, aBs:1.6, aBe:2.3, head:.3 })], // thumbs up, then a quick watch check
  hipkins:[cheer, t => layer(GUARD, IDLE_BITS.hipkins.p, 1)],
  seymour:[t => layer(cheer(t), IDLE_BITS.seymour.p, Math.abs(Math.sin(t * 6))), flex],
  peters:[t => wave(t), point],
  swarbrick:[t => layer(GUARD, IDLE_BITS.swarbrick.p, 1), point],
  willis:[cheer, t => layer(GUARD, IDLE_BITS.willis.p, 1)],
  waititi:[t => layer(GUARD, IDLE_BITS.waititi.p, 1), cheer],
  brownlee:[t => layer(GUARD, IDLE_BITS.brownlee.p, .6 + .4 * Math.abs(Math.sin(t * 9))), flex],
};
const loserPose = t => pose({ lean:.45 + Math.sin(t * 1.5) * .03, head:.45, aFs:.1, aBs:.05, aFe:.2, aBe:.2, lFk:.3, lBk:.3, py:-.1 });

// ---- smears (35) and secondary motion (36)
const smearStretch = w => Math.min(1.6, 1 + Math.max(0, Math.abs(w) - 4) * .025);
class Spring {
  constructor(k = 60, c = 8) { this.k = k; this.c = c; this.x = 0; this.v = 0; }
  step(target, dt) { this.v += (this.k * (target - this.x) - this.c * this.v) * dt; this.x += this.v * dt; return this.x; }
}

// ---- impact feel: hit-stop, camera punch-in, directional shake (37, 92)
const FEEL = { punch:{ stop:.045, zoom:.04, shake:.06 }, special:{ stop:.07, zoom:.06, shake:.12 }, kick:{ stop:.085, zoom:.09, shake:.18 }, throw:{ stop:.1, zoom:.1, shake:.25 }, super:{ stop:.14, zoom:.2, shake:.45 } };
const impactFeel = kind => FEEL[kind] ?? FEEL.punch;
function shakeOffset(t, dir, mag, seed = 0) {
  const k = mag * Math.exp(-t * 9);
  return { x:dir * k * Math.cos(t * 90 + seed), y:k * .35 * Math.sin(t * 110 + seed) };
}

// ---- turning round (39): swing the body through 180 degrees, flip at the end
const TURN_TIME = .16;
const turnAngle = (t, T = TURN_TIME) => t >= T ? 0 : PI * ease.inOut(clamp01(t / T));

// ---- high/low guard (40)
const ATTACK_HEIGHT = { punch:'high', kick:'low', special:'mid', throw:'throw' };
const blocks = (guard, height) => !!guard && height !== 'throw' && (height === 'mid' || guard === height);
// down = low guard; holding back = high guard, but only when something is coming (else it's a walk back)
function wantsGuard(c, facing, threat) {
  if (c.down) return 'low';
  return threat && (facing > 0 ? c.left : c.right) ? 'high' : null;
}
const guardFor = type => ATTACK_HEIGHT[type] === 'low' ? 'low' : 'high';
const guardPose = g => g === 'low'
  ? pose({ aFs:2.0, aFe:2.4, aBs:1.8, aBe:2.5, lFh:.7, lFk:1.4, lBh:.1, lBk:1.2, py:-.38, lean:.08, head:.15 })
  : pose({ aFs:2.5, aFe:2.3, aBs:2.3, aBe:2.5, lean:.14, py:-.06, head:.15, lFh:.35, lBh:-.35 });

export {
  JOINTS, GUARD, ease, pose, blend, layer, sampleKeys, attackPose, idlePose, IDLE_BITS, WALK, walkPhase, walkPose,
  hitHeight, hitPose, koBody, koStep, DOWN_TIME, GETUP_TIME, ROLL_TIME, wakeup, DashDetector, DASH_TIME, dashSpeed, approachSpeed,
  flipAngle, THROWS, THROW_RANGE, THROW_DMG, isThrow, throwPose, TAUNT_TIME, tauntReward, tauntPose, INTROS, VICTORY, loserPose,
  smearStretch, Spring, impactFeel, shakeOffset, TURN_TIME, turnAngle, ATTACK_HEIGHT, blocks, wantsGuard, guardFor, guardPose,
};
