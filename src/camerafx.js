// Camera direction and game feel (pure): dynamic framing with Dutch tilts, super-move
// shot paths, slow-motion final KO, replay buffer and orbit, low-health pulse,
// input buffering and cancel rules.
const clamp01 = v => Math.max(0, Math.min(1, v));
const smooth = t => t * t * (3 - 2 * t);

// ---- 91: frame both fighters; push in and tilt a touch during combos
function framing({ ax, bx, combo = 0, sup = false }) {
  const cx = (ax + bx) / 2, sep = Math.abs(bx - ax);
  let dist = Math.min(17, Math.max(7, 7.6 + Math.max(0, sep - 1.6) * .72));
  let roll = 0;
  if (combo >= 3) { dist *= .9; roll = .06 * (combo % 2 ? 1 : -1); }
  if (sup) roll = .08;
  return { cx, dist, roll };
}

// ---- 93: the match-deciding KO plays out in slow motion, drained of colour
function koSlowmo(t) {
  return {
    timeScale:t < .6 ? .15 : Math.min(1, .15 + (t - .6) / 1.4 * .85),
    saturation:Math.min(1, .3 + Math.max(0, t - .4) / 1.6 * .7),
  };
}

// ---- 94: keep the last few seconds of snapshots for an instant replay
class ReplayBuffer {
  constructor(seconds = 2, rate = 30) { this.seconds = seconds; this.step = 1 / rate; this.buf = []; this.last = -Infinity; }
  push(snap, t) {
    if (t - this.last < this.step - 1e-9) return;
    this.last = t; this.buf.push({ t, snap });
    while (this.buf.length && !(this.buf[0].t > t - this.seconds)) this.buf.shift();
  }
  frames() { return this.buf.slice(); }
  clear() { this.buf.length = 0; this.last = -Infinity; }
}
// the replay swings round from the side toward the front
function replayCamera(t, T, target) {
  const u = smooth(clamp01(t / T)), ang = -1.1 + u * .9, R = 7.2 - u * 1.2;
  return { x:target.x + Math.sin(ang) * R, y:2.4 - u * .3, z:Math.cos(ang) * R, look:{ x:target.x, y:target.y + 1.4, z:0 } };
}

// ---- 31 + 95: super moves cut to a side close-up and push in
function cinePath(t, T, f) {
  const u = clamp01(t / T), look = { x:f.x + f.facing * .3, y:f.y + 2.05, z:0 };
  const ang = (1.25 - smooth(u) * .75) * f.facing, R = 4.6 - smooth(u) * 2;
  return { cut:t < .02, look, pos:{ x:look.x + Math.sin(ang) * R, y:look.y + .25 - u * .2, z:Math.cos(ang) * R }, roll:.08 * f.facing * (1 - u) };
}

// ---- 96: heartbeat vignette when you're nearly out
const pulseRate = hp => 1 + (30 - Math.max(0, hp)) / 30 * 1.8;
function vignettePulse(hp, t) {
  if (hp > 30) return 0;
  const amp = .45 + .35 * (1 - Math.max(0, hp) / 30);
  return amp * (.5 + .5 * Math.sin(2 * Math.PI * pulseRate(hp) * t));
}

// ---- 98: buffer presses through recovery; cancel normals into specials on hit
class InputBuffer {
  constructor(window = .15) { this.window = window; this.at = {}; }
  press(action, t) { this.at[action] = t; }
  take(allowed, now) {
    let best = null;
    for (const a of allowed) { const t = this.at[a]; if (t != null && now - t <= this.window && (best == null || t > this.at[best])) best = a; }
    if (best) delete this.at[best];
    return best;
  }
  clear() { this.at = {}; }
}
const CANCEL_WINDOW = .12;
function canCancel({ hit, phase, t }, into) {
  if (into === 'punch' || into === 'kick' || !hit) return false;
  return phase === 'strike' || (phase === 'recover' && t <= CANCEL_WINDOW);
}

export { framing, koSlowmo, ReplayBuffer, replayCamera, cinePath, pulseRate, vignettePulse, InputBuffer, CANCEL_WINDOW, canCancel };

// ---- 69: the round intro flies in from high and wide, landing on the fight framing
const FLY_FROM = { x:-9, y:9, z:20 }, FLY_TO = { x:0, y:3.1, z:11.2 };
function flyThrough(u) {
  const k = smooth(clamp01(u)), arc = Math.sin(k * Math.PI) * 2.5;
  return { x:FLY_FROM.x + (FLY_TO.x - FLY_FROM.x) * k + arc, y:FLY_FROM.y + (FLY_TO.y - FLY_FROM.y) * k, z:FLY_FROM.z + (FLY_TO.z - FLY_FROM.z) * k };
}
export { flyThrough };
