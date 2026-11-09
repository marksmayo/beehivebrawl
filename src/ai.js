import { effects } from './effects.js';
import { EMPTY } from './input.js';
import { rand } from './util.js';
import { guardFor } from './anim.js';

// AI

class AI {
  constructor(f, lvl) { this.f = f; this.lvl = [.3, .6, .88][lvl]; this.t = 0; this.hold = {}; this.holdT = 0; }
  think(dt) {
    const f = this.f, o = f.opp, c = { ...EMPTY }, L = this.lvl;
    this.t -= dt; this.holdT -= dt;
    if (this.holdT > 0) Object.assign(c, this.hold);
    if (this.t > 0 || f.busy()) return c;
    this.t = rand(.08, .22) * (1.7 - L); this.hold = {}; this.holdT = 0;
    const dx = o.x - f.x, dist = Math.abs(dx), to = dx > 0 ? 'right' : 'left', away = dx > 0 ? 'left' : 'right';
    const hold = (h, t) => { this.hold = h; this.holdT = t; Object.assign(c, h); return c; };
    const threat = effects.some(e => e.isProj && e.owner !== f && Math.abs(e.mesh.position.x - f.x) < 4.5 && Math.sign(f.x - e.mesh.position.x) === e.dir);
    if (threat && Math.random() < L) return Math.random() < .5 && !effects.some(e => e.big) ? (c.up = 1, c[to] = 1, c) : hold({ down:1 }, .45);
    const mk = effects.find(e => e.marker && Math.abs(e.x - f.x) < 2);
    if (mk && Math.random() < L) return hold({ [f.x > mk.x ? 'right' : 'left']:1 }, .4);
    // guard the right way: high (hold back) against punches, low (down) against kicks (40)
    if ((o.state === 'attack' || o.state === 'special') && dist < 3 && Math.random() < L * .7) return hold(guardFor(o.atk?.type ?? 'special') === 'low' ? { down:1 } : { [away]:1 }, .35);
    if (f.meter >= 100 && Math.random() < .5) { c.sup = 1; return c; }
    const kA = f.def.moves.a.kind, kB = f.def.moves.b.kind, ranged = k => k === 'projectile', mid = k => ['dash', 'blast', 'slam', 'pull', 'teleport', 'divekick'].includes(k);
    if (dist > 4.5) {
      if (f.cool.a <= 0 && ranged(kA) && Math.random() < .3 * L + .08) { c.spA = 1; return c; }
      if (f.cool.b <= 0 && (ranged(kB) || kB === 'teleport' || kB === 'pull' && dist < 6) && Math.random() < .25 * L + .05) { c.spB = 1; return c; }
      if (Math.random() < .06) c.up = 1;
      return hold({ [to]:1 }, rand(.2, .5));
    }
    if (dist > 1.9) {
      if (f.cool.a <= 0 && (mid(kA) || ranged(kA)) && dist < 3.4 && Math.random() < .3 * L) { c.spA = 1; return c; }
      if (f.cool.b <= 0 && (mid(kB) || ranged(kB)) && Math.random() < .25 * L) { c.spB = 1; return c; }
      if (Math.random() < .07) { c.up = 1; c[to] = 1; return c; }
      return hold({ [to]:1 }, rand(.1, .3));
    }
    if (o.state === 'hit' && Math.random() < L) { c[Math.random() < .6 ? 'punch' : 'kick'] = 1; return c; }
    const r = Math.random();
    if (r < .34) c.punch = 1;
    else if (r < .58) c.kick = 1;
    else if (r < .68) { if (f.cool.a <= 0) c.spA = 1; else c.punch = 1; }
    else if (r < .84) return hold({ [away]:1 }, rand(.15, .35));
    else return hold({ down:1 }, .3);
    return c;
  }
}

// =====================================================================

export { AI };
