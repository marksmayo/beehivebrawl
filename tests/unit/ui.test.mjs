import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as U from '../../src/ui.js';
import { ROSTER } from '../../src/roster.js';

const by = id => ROSTER.find(d => d.id === id);

// ---- 81: VS splash, tale of the tape -------------------------------------------
test('tale of the tape lists party, stats as 0..1 bars, moves and a catchphrase', () => {
  for (const d of ROSTER) {
    const rows = U.taleOfTheTape(d), labels = rows.map(r => r.label);
    for (const l of ['PARTY', 'SPEED', 'POWER', 'DEFENCE', 'SPECIALS', 'SUPER', 'CATCHPHRASE']) assert.ok(labels.includes(l), `${d.id} missing ${l}`);
    for (const r of rows.filter(r => 'bar' in r)) assert.ok(r.bar > 0 && r.bar <= 1, `${d.id} ${r.label} bar ${r.bar}`);
    assert.equal(rows.find(r => r.label === 'SUPER').value, d.moves.s.name);
  }
});

test('stat bars rank fighters the same way as their stats', () => {
  const sp = id => U.taleOfTheTape(by(id)).find(r => r.label === 'SPEED').bar;
  assert.ok(sp('seymour') > sp('brownlee'), 'Seymour is quicker than the Speaker');
});

test('the matchup says who has the edge on each stat', () => {
  const e = U.matchupEdges(by('seymour'), by('brownlee'));
  assert.equal(e.SPEED, 'seymour'); assert.equal(e.POWER, 'brownlee'); assert.equal(e.DEFENCE, 'brownlee');
  assert.equal(U.matchupEdges(by('luxon'), by('luxon')).SPEED, null, 'mirror matches are even');
});

// ---- 83 + 84: polling bars and ballot-count timer --------------------------------
test('health reads as a poll percentage, rounded and clamped', () => {
  assert.equal(U.pollPct(87.4), '87%'); assert.equal(U.pollPct(-5), '0%'); assert.equal(U.pollPct(100), '100%');
});

test('the poll ticker drains toward the real value rather than jumping', () => {
  let shown = 100;
  shown = U.tickPoll(shown, 60, 1 / 60);
  assert.ok(shown < 100 && shown > 60);
  for (let i = 0; i < 600; i++) shown = U.tickPoll(shown, 60, 1 / 60);
  assert.equal(Math.round(shown), 60);
});

test('the ballot clock says how the count is going', () => {
  assert.equal(U.ballotLabel(55), 'COUNTING');
  assert.equal(U.ballotLabel(9), 'FINAL COUNT');
  assert.equal(U.ballotLabel(0), 'POLLS CLOSED');
});

// ---- 85: results as a newspaper front page ------------------------------------------
test('headlines name the winner and change with the margin', () => {
  const w = by('luxon'), l = by('hipkins');
  const flawless = U.headline(w, l, { roundsWon:2, roundsLost:0, hpLeft:95 });
  const close = U.headline(w, l, { roundsWon:2, roundsLost:1, hpLeft:4 });
  for (const h of [flawless, close]) {
    assert.equal(h.masthead, 'THE DAILY BEEHIVE');
    assert.ok(h.headline.includes('LUXON'), h.headline);
    assert.equal(h.headline, h.headline.toUpperCase());
    assert.ok(h.sub.length > 10);
  }
  assert.match(flawless.headline, /LANDSLIDE/);
  assert.match(close.headline, /RECOUNT|SQUEAK|NARROW|KNIFE/);
  assert.notEqual(flawless.headline, close.headline);
});

// ---- 88: gallery unlocks ------------------------------------------------------------------
test('winning a match with a fighter unlocks their concept art, and arenas unlock by winning there', () => {
  let s = U.emptyUnlocks();
  assert.ok(!U.isUnlocked(s, 'fighter:luxon'));
  s = U.recordWin(s, { fighter:'luxon', arena:'beehive' });
  assert.ok(U.isUnlocked(s, 'fighter:luxon') && U.isUnlocked(s, 'arena:beehive'));
  assert.ok(!U.isUnlocked(s, 'fighter:hipkins'));
  const items = U.galleryItems(ROSTER, [{ id:'beehive', name:'The Beehive' }, { id:'viaduct', name:'The Viaduct' }]);
  assert.equal(items.length, ROSTER.length + 2);
  assert.deepEqual(U.recordWin(U.recordWin(U.emptyUnlocks(), { fighter:'luxon' }), { fighter:'luxon' }).wins.luxon, 2);
});

test('unlock data survives a round trip through JSON and ignores junk', () => {
  const s = U.recordWin(U.emptyUnlocks(), { fighter:'peters', arena:'waitangi' });
  assert.deepEqual(U.parseUnlocks(JSON.stringify(s)), s);
  assert.deepEqual(U.parseUnlocks('not json'), U.emptyUnlocks());
  assert.deepEqual(U.parseUnlocks(null), U.emptyUnlocks());
});

// ---- 89: pause as an order paper -------------------------------------------------------
test('the pause screen reads like an order paper', () => {
  const items = U.orderPaper({ round:2, timer:42.3, a:by('luxon'), b:by('peters'), venue:'The Beehive, Wellington' });
  assert.ok(items.length >= 3);
  assert.ok(items.some(i => /LUXON/.test(i) && /PETERS/.test(i)));
  assert.ok(items.some(i => /Round 2/.test(i)));
  assert.ok(items.some(i => /0:42/.test(i)));
});
