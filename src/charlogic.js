// Character presentation rules (pure): proportions and silhouettes, hand shapes, fabrics,
// signature props, costumes, warm shadows and rim light, eyes, brows, lip-sync,
// mood decals, wear and tear, victory outfits.
const clamp01 = v => Math.max(0, Math.min(1, v));
const rgb = hex => [(hex >> 16 & 255) / 255, (hex >> 8 & 255) / 255, (hex & 255) / 255];

// ---- 3 + 8: silhouettes. head = head scale; height scales the body; belly/shoulders shape the torso
const SILHOUETTE = {
  luxon:{ height:1.06, shoulders:1.04, belly:0, head:1.06 },
  hipkins:{ height:1, shoulders:1, belly:.08, head:1.1 },
  seymour:{ height:.92, shoulders:.9, belly:0, head:1 },
  peters:{ height:1, shoulders:1, belly:.02, head:1.04 },
  swarbrick:{ height:.95, shoulders:.86, belly:0, head:1.02 },
  willis:{ height:.96, shoulders:.88, belly:.01, head:1.06 },
  waititi:{ height:1.05, shoulders:1.12, belly:.12, head:1.05 },
  brownlee:{ height:1.04, shoulders:1.18, belly:.5, head:1.12 },
};
const sil = id => SILHOUETTE[id] ?? { height:1, shoulders:1, belly:0, head:1 };
// head diameter over standing height (head centre sits at 2.5, radius .6)
const headRatio = id => { const s = sil(id); return 1.2 * s.head / (2.5 * s.height + .6 * s.head); };

// ---- 5: hand shapes per pose
const HANDS = ['fist', 'palm', 'point', 'thumb'];
const VICTORY_HANDS = { luxon:['thumb', 'point'], hipkins:['fist', 'thumb'], seymour:['palm', 'fist'], peters:['palm', 'point'], swarbrick:['fist', 'point'],
  willis:['fist', 'thumb'], waititi:['palm', 'fist'], brownlee:['fist', 'fist'] };
function handFor(f) {
  switch (f.state) {
    case 'taunt': return 'thumb';
    case 'intro': return f.def?.id === 'peters' ? 'palm' : 'fist';
    case 'victory': return (VICTORY_HANDS[f.def?.id] ?? ['fist', 'fist'])[(f.vIdx ?? 0) % 2];
    case 'ko': case 'lose': case 'down': case 'hit': case 'stunned': case 'thrown': case 'hole': return 'palm';
    default: return 'fist';
  }
}

// ---- 6 + 7: fabrics and signature props
const suitPattern = id => ({ peters:'pinstripe', hipkins:'check', waititi:'check' })[id] ?? 'twill';
const SIGNATURE = { luxon:'watch', hipkins:'can', seymour:'glitterpin', peters:'pocketsquare', swarbrick:'phone', willis:'calculator', waititi:'hatband', brownlee:'gavel' };

// ---- 9 + 10: costumes, each with a party rosette
const COSTUMES = ['parliament', 'campaign', 'beach', 'election'];
function costume(d, name) {
  const base = { suit:d.suit ?? d.color, shirt:d.shirt ?? 0xf2f2f2, tie:d.tie ?? null, rosette:d.pcol, sash:false, hivis:false, floral:false };
  if (name === 'campaign') return { ...base, suit:0xf5e000, hivis:true };
  if (name === 'beach') return { ...base, suit:0xeadcc0, shirt:0xff7ab8, tie:null, floral:true };
  if (name === 'election') return { ...base, sash:true };
  return base;
}

// ---- 12 + 13: warm skin shadows; rim light from party colour and the arena sky
const skinShadow = skinHex => { const [r, g, b] = rgb(skinHex); return [r * .86, g * .62, b * .52]; };
const rimColor = (party, sky) => { const a = rgb(party), b = rgb(sky); return a.map((v, i) => v * .6 + b[i] * .4); };

// ---- 14 + 15: eyes and brows
const EYE_RANGE = .035;
const eyeLook = (dx, dy) => ({ x:Math.max(-EYE_RANGE, Math.min(EYE_RANGE, dx * .01)), y:Math.max(-EYE_RANGE, Math.min(EYE_RANGE, dy * .01)) });
function browPose(state) {
  if (['attack', 'special', 'throw'].includes(state)) return { raise:0, furrow:.8 };
  if (['hit', 'stunned', 'thrown', 'down', 'ko', 'hole'].includes(state)) return { raise:.9, furrow:0 };
  if (state === 'taunt' || state === 'victory') return { raise:.6, furrow:.2 };
  return { raise:0, furrow:0 };
}

// ---- 16: lip-sync from text
const VISEMES = ['M', 'A', 'E', 'O', 'U', 'F', 'rest'];
const VMAP = { b:'M', m:'M', p:'M', a:'A', e:'E', i:'E', y:'E', o:'O', u:'U', w:'U', q:'U', f:'F', v:'F', ' ':'rest' };
function visemes(text, step = .07) {
  const out = [];
  for (const ch of text.toLowerCase()) {
    if (!/[a-z ]/.test(ch)) continue;
    const shape = VMAP[ch] ?? 'E';
    if (out.at(-1)?.shape !== shape) out.push({ t:out.length ? out.at(-1).t + step : 0, shape });
    else out.at(-1).hold = (out.at(-1).hold ?? 1) + 1;
  }
  return out;
}

// ---- 17: face decals by mood
function moodDecals(f) {
  const out = [];
  if ((f.hp ?? 100) < 30) out.push('sweat');
  if (['attack', 'special', 'throw'].includes(f.state)) out.push('vein');
  if (['taunt', 'victory'].includes(f.state)) out.push('blush');
  return out;
}

// ---- 18 + 19: wear and tear
const wearLevel = (roundsLost, hp) => Math.min(3, roundsLost + (hp < 50 ? 1 : 0));
const dishevel = hp => { const k = clamp01((60 - hp) / 60); return { tie:k, hair:k * .8, collar:k * .6 }; };

// ---- 20: victory outfits
const OUTFITS = ['confetti', 'champagne', 'crown'];
const victoryOutfit = (id, v) => OUTFITS[(Object.keys(SILHOUETTE).indexOf(id) + v) % OUTFITS.length];

export { SILHOUETTE, headRatio, HANDS, handFor, suitPattern, SIGNATURE, COSTUMES, costume, skinShadow, rimColor, EYE_RANGE, eyeLook, browPose, VISEMES, visemes, moodDecals, wearLevel, dishevel, OUTFITS, victoryOutfit };
