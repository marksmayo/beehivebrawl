// Presentation logic for the screens (pure, no DOM): VS tale of the tape, poll bars,
// ballot clock, newspaper headlines, order paper, gallery unlocks.

const STATS = [['SPEED', 'speed'], ['POWER', 'power'], ['DEFENCE', 'defense']];
// fighter stats sit roughly in .8..1.3; show them as 0..1 bars
const statBar = v => Math.max(.08, Math.min(1, (v - .7) / .6));

// ---- VS splash (81)
function taleOfTheTape(d) {
  return [
    { label:'PARTY', value:d.party },
    { label:'ALIAS', value:d.nick },
    ...STATS.map(([label, k]) => ({ label, bar:statBar(d.stats[k]) })),
    { label:'SPECIALS', value:`${d.moves.a.name} / ${d.moves.b.name}` },
    { label:'SUPER', value:d.moves.s.name },
    { label:'CATCHPHRASE', value:`“${d.quips[0]}”` },
  ];
}
function matchupEdges(a, b) {
  const out = {};
  for (const [label, k] of STATS) { const x = a.stats[k], y = b.stats[k]; out[label] = Math.abs(x - y) < 1e-9 ? null : x > y ? a.id : b.id; }
  return out;
}

// ---- HUD: polls and the ballot count (83, 84)
const pollPct = hp => `${Math.round(Math.max(0, Math.min(100, hp)))}%`;
const tickPoll = (shown, real, dt) => shown + (real - shown) * (1 - Math.exp(-6 * dt));
const ballotLabel = t => t <= 0 ? 'POLLS CLOSED' : t < 10 ? 'FINAL COUNT' : 'COUNTING';

// ---- results as a front page (85)
function headline(w, l, { roundsWon = 2, roundsLost = 0, hpLeft = 50 } = {}) {
  const W = w.short, L = l.short;
  const flawless = roundsLost === 0 && hpLeft > 70, close = roundsLost > 0 && hpLeft < 25;
  let h, sub;
  if (flawless) { h = `${W} WINS IN A LANDSLIDE`; sub = `${l.name} concedes before the specials votes are even counted.`; }
  else if (close) { h = `${W} SQUEAKS IN: ${L} DEMANDS RECOUNT`; sub = `A knife-edge result after ${roundsWon + roundsLost} bruising rounds. Coalition talks expected to be awkward.`; }
  else if (roundsLost === 0) { h = `${W} ROLLS ${L} IN STRAIGHT ROUNDS`; sub = `${w.name} claims a clear mandate. ${l.name} "reflecting on the result".`; }
  else { h = `${W} TAKES IT IN THE DECIDER`; sub = `${l.name} wins one round but loses the House. Commentators call it "a proper scrap".`; }
  return { masthead:'THE DAILY BEEHIVE', headline:h, sub };
}

// ---- pause as an order paper (89)
function orderPaper({ round, timer, a, b, venue }) {
  const s = Math.max(0, Math.floor(timer)), clock = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  return [
    `Questions for Oral Answer: ${a.short} v ${b.short}`,
    `Round ${round} of 3, sitting at ${venue}`,
    `Time remaining in the debate: ${clock}`,
    'Members are reminded that the Speaker’s ruling is final, and also heavy.',
  ];
}

// ---- gallery unlocks (88)
const emptyUnlocks = () => ({ wins:{}, arenas:{} });
function recordWin(s, { fighter, arena }) {
  const n = { wins:{ ...s.wins }, arenas:{ ...s.arenas } };
  if (fighter) n.wins[fighter] = (n.wins[fighter] ?? 0) + 1;
  if (arena) n.arenas[arena] = true;
  return n;
}
function isUnlocked(s, key) {
  const [kind, id] = key.split(':');
  return kind === 'fighter' ? (s.wins[id] ?? 0) > 0 : kind === 'arena' ? !!s.arenas[id] : false;
}
const galleryItems = (roster, stages) => [
  ...roster.map(d => ({ key:`fighter:${d.id}`, title:d.name, hint:`Win a match as ${d.short}` })),
  ...stages.map(s => ({ key:`arena:${s.id}`, title:s.name, hint:`Win a match at ${s.name}` })),
];
function parseUnlocks(json) {
  try { const v = JSON.parse(json); if (v && typeof v.wins === 'object' && typeof v.arenas === 'object') return { wins:{ ...v.wins }, arenas:{ ...v.arenas } }; } catch {}
  return emptyUnlocks();
}

export { statBar, taleOfTheTape, matchupEdges, pollPct, tickPoll, ballotLabel, headline, orderPaper, emptyUnlocks, recordWin, isUnlocked, galleryItems, parseUnlocks };
