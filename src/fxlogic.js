// Decisions behind the comic effects (pure): impact frames, sound-effect lettering,
// speed lines, ink splats, debris, flame colours, bubble tails, combo counter, HUD moods.
const clamp01 = v => Math.max(0, Math.min(1, v));
// small deterministic PRNG so shapes/words repeat from a seed
const rng = seed => { let s = (seed * 2654435761) >>> 0 || 1; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; };

// ---- 41: a two-frame impact: negative flash, then black-and-white ink
const IMPACT = { super:[.05, .13], ko:[.06, .16], throw:[.03, .07] };
function impactFrameAt(t, kind) {
  const w = IMPACT[kind]; if (!w) return null;
  return t < w[0] ? 'invert' : t < w[1] ? 'ink' : null;
}

// ---- 42: hand-lettered sound effects, coloured by the hit
const WORDS = {
  punch:['POW!', 'BIFF!', 'BAM!', 'SMACK!', 'WHAP!'],
  kick:['WHAM!', 'THWACK!', 'KRUNCH!', 'BOFF!', 'KAPOW!', 'THUD!'],
  super:['KA-BOOOM!', 'KRAKA-THOOM!', 'SHAZZAM!', 'KAPOW!!'],
  special:['ZAP!', 'SPLAT!', 'FWOOSH!', 'ZOK!'],
  throw:['WHUMP!', 'SLAM!', 'CRUNCH!'],
};
const FILLS = { punch:'#ffffff', kick:'#ffd23f', super:'#ff5a1f', special:'#7fe0ff', throw:'#ff7ab8' };
function sfxStyle(kind, heavy, seed) {
  const r = rng(seed + kind.length * 31), list = WORDS[kind] ?? WORDS.punch;
  return { word:list[Math.floor(r() * list.length)], fill:FILLS[kind] ?? FILLS.punch, stroke:'#111111',
    rot:(r() - .5) * .6, scale:(kind === 'super' ? 1.8 : heavy ? 1.3 : 1) * (.9 + r() * .2) };
}

// ---- 43: speed lines while something is going fast
const speedLinesOn = (fighters, cine) => !!cine || fighters.some(f => f.state === 'dash' || (f.state === 'special' && ['rush', 'dash', 'divekick'].includes(f.sp?.kind)));

// ---- 44: jagged ink splat outline in a unit circle
function splatShape(seed, n = 22) {
  const r = rng(seed), pts = [];
  for (let i = 0; i < n; i++) {
    const a = i / n * Math.PI * 2, spike = i % 2 ? .38 + r() * .2 : .75 + r() * .25;
    pts.push([Math.cos(a) * spike, Math.sin(a) * spike]);
  }
  return pts;
}

// ---- 45: flying policy papers and chunks on heavy hits
const DEBRIS = { punch:{ papers:0, chunks:0 }, special:{ papers:2, chunks:1 }, kick:{ papers:3, chunks:2 }, throw:{ papers:5, chunks:3 }, super:{ papers:9, chunks:5 } };
const debrisFor = kind => DEBRIS[kind] ?? DEBRIS.punch;

// ---- 46: flame colour over a particle's life (0 = fresh, 1 = smoke)
const STOPS = [[0, [1, .98, .75]], [.35, [1, .72, .15]], [.65, [.92, .3, .08]], [1, [.32, .26, .24]]];
function flameColor(t) {
  t = clamp01(t);
  for (let i = 1; i < STOPS.length; i++) if (t <= STOPS[i][0]) {
    const [t0, c0] = STOPS[i - 1], [t1, c1] = STOPS[i], u = (t - t0) / (t1 - t0);
    return c0.map((v, k) => v + (c1[k] - v) * u);
  }
  return STOPS.at(-1)[1].slice();
}

// ---- 51: bubble tail offset (px from the bubble centre), kept on the bubble
const bubbleTail = (speakerX, bubbleX, bubbleW) => Math.max(-(bubbleW / 2 - 20), Math.min(bubbleW / 2 - 20, speakerX - bubbleX));

// ---- 53: combo counter lettering
const comboStyle = n => ({ label:`${n} HIT COMBO!`, size:Math.min(70, 22 + (n - 3) * 5), wobble:Math.min(.4, .05 + (n - 3) * .04) });

// ---- 55: which expression the HUD portrait wears
function portraitMood(f) {
  if (['hit', 'stunned', 'ko', 'down', 'thrown', 'hole', 'lose'].includes(f.state)) return 'hurt';
  if (['special', 'victory', 'taunt'].includes(f.state)) return 'open';
  return (f.hp ?? 100) < 20 ? 'hurt' : 'n';
}

export { impactFrameAt, sfxStyle, speedLinesOn, splatShape, debrisFor, flameColor, bubbleTail, comboStyle, portraitMood };
