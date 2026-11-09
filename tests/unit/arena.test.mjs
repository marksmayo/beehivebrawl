import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as A from '../../src/arenadata.js';
import { flyThrough } from '../../src/camerafx.js';

const ORIGINAL = ['beehive', 'viaduct', 'cathedral', 'octagon', 'queenstown', 'waitangi', 'taupo', 'mauao'];

// ---- 68: more venues ------------------------------------------------------------------------
test('there are new venues on top of the original eight', () => {
  for (const id of ORIGINAL) assert.ok(A.ARENA_META[id], `${id} missing`);
  for (const id of ['chamber', 'aoraki', 'cuba', 'ponsonby', 'committee']) assert.ok(A.ARENA_META[id], `new venue ${id} missing`);
  for (const [id, m] of Object.entries(A.ARENA_META)) assert.ok(m.name && m.desc, `${id} needs a name and description`);
});

// ---- 56 + 80: resolution by device ---------------------------------------------------------------
test('backdrops paint at high resolution on desktop and lower on phones, within the GPU limit', () => {
  const d = A.backdropRes({ mobile:false, maxTex:16384 }), m = A.backdropRes({ mobile:true, maxTex:8192 });
  assert.equal(d.W / d.H, 4); assert.equal(m.W / m.H, 4);
  assert.ok(d.W > m.W && d.W >= 8192 && m.W <= 4096);
  assert.ok(A.backdropRes({ mobile:false, maxTex:4096 }).W <= 4096, 'respects the GPU texture limit');
  assert.equal(d.scale, d.W / 4096, 'painting coordinates stay in 4096-wide units');
});

// ---- 57: parallax ---------------------------------------------------------------------------
test('outdoor arenas have a far sky layer behind the painted scene, for parallax', () => {
  const L = A.parallaxLayers('beehive');
  assert.deepEqual(L.map(l => l.name), ['sky', 'clouds', 'scene']);
  assert.ok(L[0].R > L[1].R && L[1].R > L[2].R, 'farther layers sit further back');
  assert.deepEqual(A.parallaxLayers('chamber').map(l => l.name), ['scene'], 'indoors there is no sky');
});

// ---- 58: crowds ---------------------------------------------------------------------------------
test('the crowd gets excited by big hits and calms down again', () => {
  const c = new A.Crowd();
  assert.equal(c.level, 0);
  c.react('punch'); const small = c.level; c.react('super');
  assert.ok(c.level > small && c.level <= 1);
  for (let i = 0; i < 600; i++) c.step(1 / 60);
  assert.ok(c.level < .05, 'they settle');
});

// ---- 59: time of day ---------------------------------------------------------------------------------
test('each time of day has its own light and sky tint; night lights the windows', () => {
  const day = A.timeOfDay('day'), sun = A.timeOfDay('sunset'), night = A.timeOfDay('night');
  assert.ok(day.sunIntensity > sun.sunIntensity && sun.sunIntensity > night.sunIntensity);
  assert.equal(day.litWindows, 0); assert.ok(night.litWindows > .5);
  assert.notEqual(day.tint, night.tint);
  assert.deepEqual(A.TIMES, ['day', 'sunset', 'night']);
});

// ---- 60: weather ------------------------------------------------------------------------------------
test('weather suits the place', () => {
  assert.equal(A.ARENA_META.beehive.weather, 'wind');
  assert.equal(A.ARENA_META.octagon.weather, 'drizzle');
  assert.equal(A.ARENA_META.taupo.weather, 'haze');
  assert.equal(A.ARENA_META.aoraki.weather, 'snow');
  assert.equal(A.ARENA_META.chamber.weather, 'none');
});

// ---- 61: floor centrepieces ---------------------------------------------------------------------------
test('every arena has a painted floor centrepiece', () => {
  for (const [id, m] of Object.entries(A.ARENA_META)) assert.ok(A.CENTREPIECES.includes(m.centre), `${id} centrepiece ${m.centre}`);
  assert.equal(A.ARENA_META.octagon.centre, 'octagon');
});

// ---- 62: breakable props -------------------------------------------------------------------------------
test('props wobble when knocked, and break after enough punishment', () => {
  const p = new A.Prop(10);
  assert.equal(p.hit(4), 'wobble'); assert.equal(p.hit(4), 'wobble'); assert.equal(p.hit(4), 'break');
  assert.equal(p.hit(4), null, 'broken props stay broken');
});

// ---- 63: hazards -------------------------------------------------------------------------------------------
test('hazards give a warning before they arrive, then cross the arena', () => {
  const h = A.HAZARDS.tram;
  const warn = A.hazardAt('tram', h.period - h.warn / 2), on = A.hazardAt('tram', h.period + h.cross / 2), off = A.hazardAt('tram', h.period / 2);
  assert.ok(warn.warn && !warn.active); assert.ok(on.active && Math.abs(on.x) < 12); assert.ok(!off.warn && !off.active);
  assert.ok(A.hazardHits({ active:true, x:0 }, 0, 0) && !A.hazardHits({ active:true, x:5 }, 0, 0), 'only hits what it touches');
  assert.ok(!A.hazardHits({ active:true, x:0 }, 0, 3), 'jump over it');
  assert.equal(A.ARENA_META.cathedral.hazard, 'tram'); assert.equal(A.ARENA_META.mauao.hazard, 'sheep');
});

// ---- 64 + 65: water, clouds and birds ------------------------------------------------------------------------
test('water arenas know where their water is; birds suit the place', () => {
  assert.ok(A.ARENA_META.viaduct.water && A.ARENA_META.viaduct.water[0] < A.ARENA_META.viaduct.water[1]);
  assert.equal(A.ARENA_META.chamber.water, null);
  assert.equal(A.ARENA_META.viaduct.birds, 'gulls'); assert.ok(['tui', 'kereru'].includes(A.ARENA_META.waitangi.birds));
});

// ---- 66: cameos -----------------------------------------------------------------------------------------------
test('background cameos are generic types, not real people, and include the press pack', () => {
  const kinds = A.CAMEOS.map(c => c.kind);
  assert.ok(kinds.includes('press'));
  assert.ok(A.CAMEOS.every(c => c.label && !/[A-Z][a-z]+ [A-Z][a-z]+/.test(c.label)), 'no named individuals');
});

// ---- 67: billboards -----------------------------------------------------------------------------------------------
test('billboards change slogan each round', () => {
  const r1 = A.billboardFor('viaduct', 1), r2 = A.billboardFor('viaduct', 2), r3 = A.billboardFor('viaduct', 3);
  assert.ok(r1 && r2 && r3); assert.notEqual(r1, r2); assert.notEqual(r2, r3);
});

// ---- 69: stage fly-through ------------------------------------------------------------------------------------
test('the round intro flies in from high and wide and lands on the fight camera', () => {
  const start = flyThrough(0), end = flyThrough(1), mid = flyThrough(.5);
  assert.ok(start.y > end.y + 2 && Math.hypot(start.x, start.z) > Math.hypot(end.x, end.z));
  assert.ok(Math.abs(end.x) < .01 && Math.abs(end.y - 3.1) < .01 && Math.abs(end.z - 11.2) < .01, 'ends on the fight framing');
  assert.ok(mid.y < start.y && mid.y > end.y);
});

// ---- 70: ambience -------------------------------------------------------------------------------------------------
test('each arena has its own ambient sound bed', () => {
  assert.ok(A.ARENA_META.viaduct.ambience.includes('gulls'));
  assert.ok(A.ARENA_META.cathedral.ambience.includes('tram'));
  assert.ok(A.ARENA_META.beehive.ambience.includes('wind'));
  assert.ok(A.ARENA_META.taupo.ambience.includes('cicadas'));
  assert.ok(A.ARENA_META.chamber.ambience.includes('murmur'));
  for (const m of Object.values(A.ARENA_META)) for (const a of m.ambience) assert.ok(A.AMBIENCES.includes(a), `unknown ambience ${a}`);
});
