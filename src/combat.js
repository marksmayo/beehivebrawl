import { say, sfx } from './audio.js';
import { banner, bubble, floater, screenFlash, sfxWord } from './dom.js';
import { impactStar, sparks } from './effects.js';
import { game } from './game.js';

// Combat resolution

function applyHit(att, tgt, o) {
  if (tgt.state === 'ko' || !(game.phase === 'fight' || game.phase === 'title')) return 'miss';
  const dir = Math.sign(tgt.x - att.x) || att.facing;
  const blocking = !o.unblockable && tgt.state === 'block' && tgt.y <= 0 && tgt.facing === -dir;
  let dmg = o.dmg * att.def.stats.power / tgt.def.stats.defense;
  const hx = tgt.x - dir * .35, hy = tgt.y + (o.hy ?? 1.8);
  if (blocking) {
    dmg *= o.chip ?? .12; tgt.vx = dir * (o.knock ?? 3) * .5; tgt.blockstun = .2;
    sparks(hx, hy, 0x8fd3ff, 8, 4); sfx.block(); att.meter = Math.min(100, att.meter + 3);
    if (!o.quiet) sfxWord(hx, hy, false, true);
  } else {
    const comboing = tgt.state === 'hit' || tgt.state === 'stunned';
    tgt.combo = comboing ? tgt.combo + 1 : 1;
    if (tgt.combo >= 3 && !o.quiet) floater(`${tgt.combo} HIT COMBO!`, att.x, 3.4, { color:'#ffd23f', size:26, life:.8 });
    if (tgt.state === 'special' || tgt.state === 'attack') tgt.cleanupSpecial();
    tgt.state = o.stunned ? 'stunned' : 'hit'; tgt.stateT = 0; tgt.stunDur = o.stun ?? .35; tgt.atk = null; tgt.sp = null;
    tgt.vx = dir * (o.knock ?? 3);
    if (o.launch) tgt.vy = o.launch; else if (tgt.y > 0) tgt.vy = Math.max(tgt.vy, 3);
    tgt.flash = .08; tgt.squash = o.heavy ? -.18 : -.1;
    sparks(hx, hy, o.heavy ? 0xffd23f : 0xffffff, o.heavy ? 16 : 9, o.heavy ? 8 : 6);
    if (!o.quiet) {
      impactStar(hx, hy, o.heavy ? 0xffd23f : 0xffffff, o.heavy ? 1.1 : .7);
      if (o.word) floater(o.word, hx, hy + .4, { cls:'sfx', size:34, life:.6, rise:.5 }).pop = true;
      else if (o.heavy || Math.random() < .45) sfxWord(hx, hy, o.heavy);
    }
    sfx.hit(o.heavy); game.hitstop(o.super ? .14 : o.heavy ? .085 : .045);
    if (o.heavy) game.shake(o.super ? .45 : .22);
    if (o.super) screenFlash();
    att.meter = Math.min(100, att.meter + (o.meter ?? 9)); tgt.meter = Math.min(100, tgt.meter + 5);
    if (!o.quiet && Math.random() < .14) { bubble(tgt, tgt.def.hurt, { dur:1.1 }); }
  }
  tgt.hp -= dmg;
  if (game.demo) tgt.hp = Math.max(tgt.hp, 40);
  if (tgt.hp <= 0) {
    if (tgt.def.comeback && !tgt.comebackUsed && game.phase === 'fight') {
      tgt.comebackUsed = true; tgt.hp = 20;
      banner('THE COMEBACK!', 'Never, ever write off Winston.', 1300);
      bubble(tgt, "I'm back. I always come back.", { dur:2 }); say("I'm back.", { pitch:tgt.def.pitch });
      sparks(tgt.x, 1.5, 0xffd23f, 24, 8, .8);
    } else { tgt.hp = 0; if (game.phase === 'fight') game.ko(tgt, att, dir); }
  }
  return blocking ? 'block' : 'hit';
}

// =====================================================================

export { applyHit };
