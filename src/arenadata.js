// Arena metadata and rules (pure): venues, weather, ambience, hazards, props, crowds,
// time of day, parallax layers, billboards, backdrop resolution.

const AMBIENCES = ['wind', 'gulls', 'tram', 'drizzle', 'cicadas', 'murmur', 'traffic', 'cafe', 'water', 'birdsong', 'sheep', 'alpine'];
const CENTREPIECES = ['koru', 'compass', 'octagon', 'fern', 'mosaic', 'crest', 'tiles', 'rose', 'mat'];

const ARENA_META = {
  beehive:{ name:'The Beehive, Wellington', desc:'Windy Welly. Watch for the southerly gusts.', weather:'wind', ambience:['wind', 'traffic', 'gulls'], centre:'crest', water:null, birds:'gulls', hazard:null },
  viaduct:{ name:'The Viaduct, Auckland', desc:'Superyachts, sunsets and a suspicious number of road cones.', weather:'clear', ambience:['gulls', 'water', 'traffic'], centre:'compass', water:[740, 950], birds:'gulls', hazard:null },
  cathedral:{ name:'Cathedral Square, Christchurch', desc:'The cathedral is still being fixed. The tram is still running.', weather:'clear', ambience:['tram', 'traffic', 'birdsong'], centre:'rose', water:null, birds:'birdsong', hazard:'tram' },
  octagon:{ name:'The Octagon, Dunedin', desc:'Scotland, but further south. Bring a jersey. Baldwin St looms.', weather:'drizzle', ambience:['drizzle', 'traffic'], centre:'octagon', water:null, birds:null, hazard:null },
  queenstown:{ name:'Queenstown Waterfront', desc:'Lake Wakatipu, The Remarkables, and a $28 burger on the line.', weather:'clear', ambience:['water', 'gulls', 'cafe'], centre:'compass', water:[690, 880], birds:'gulls', hazard:null },
  waitangi:{ name:'Waitangi Treaty Grounds', desc:'Where every politician gets told what the people think of them. Annually.', weather:'clear', ambience:['cicadas', 'birdsong', 'water'], centre:'fern', water:[600, 820], birds:'tui', hazard:null },
  taupo:{ name:'Lake Taupō', desc:'Volcanoes on the horizon. A DC-3 you can eat lunch in. Try not to erupt.', weather:'haze', ambience:['cicadas', 'water'], centre:'koru', water:[650, 860], birds:'kereru', hazard:null },
  mauao:{ name:'Summit of Mauao, Mt Maunganui', desc:'252 metres up. Panoramic views. Sheep with opinions.', weather:'wind', ambience:['wind', 'sheep', 'gulls'], centre:'compass', water:[500, 900], birds:'gulls', hazard:'sheep' },
  chamber:{ name:'The Debating Chamber', desc:'Green leather, wood panels and four hundred points of order.', weather:'none', ambience:['murmur'], centre:'mat', water:null, birds:null, hazard:null, indoor:true },
  aoraki:{ name:'Aoraki / Mount Cook', desc:'The tallest venue in the country. The view is breathtaking. So is the cold.', weather:'snow', ambience:['alpine', 'wind'], centre:'koru', water:null, birds:'kereru', hazard:null },
  cuba:{ name:'Cuba Street, Wellington', desc:'Buskers, bucket fountains and a flat white every three metres.', weather:'wind', ambience:['cafe', 'traffic', 'water'], centre:'mosaic', water:null, birds:'gulls', hazard:null },
  ponsonby:{ name:'Ponsonby Road, Auckland', desc:'Brunch is $34 and the property values are personal.', weather:'clear', ambience:['cafe', 'traffic'], centre:'tiles', water:null, birds:null, hazard:null },
  committee:{ name:'Select Committee Room 3', desc:'Submissions close in five minutes. So does the patience of the chair.', weather:'none', ambience:['murmur'], centre:'mat', water:null, birds:null, hazard:null, indoor:true },
};

// ---- 56 + 80: paint big on desktop, smaller on phones, never past the GPU limit
function backdropRes({ mobile, maxTex = 8192 }) {
  const W = Math.min(mobile ? 4096 : 8192, maxTex, 16384);
  return { W, H:W / 4, scale:W / 4096 };
}

// ---- 57: parallax layers (far to near); indoors there's only the room
function parallaxLayers(id) {
  if (ARENA_META[id]?.indoor) return [{ name:'scene', R:27 }];
  return [{ name:'sky', R:60 }, { name:'clouds', R:44 }, { name:'scene', R:27 }];
}

// ---- 58: the crowd's excitement
const CHEER = { punch:.12, kick:.22, special:.3, throw:.4, super:.75, ko:1 };
class Crowd {
  constructor() { this.level = 0; }
  react(kind) { this.level = Math.min(1, this.level + (CHEER[kind] ?? .1)); }
  step(dt) { this.level *= Math.exp(-dt * 1.2); if (this.level < 1e-3) this.level = 0; return this.level; }
}

// ---- 59: time of day
const TIMES = ['day', 'sunset', 'night'];
const TOD = {
  day:{ tint:'#ffffff', tintAlpha:0, sun:0xffffff, sunIntensity:2.4, hemi:1.4, litWindows:0 },
  sunset:{ tint:'#ff8a4a', tintAlpha:.45, sun:0xffb070, sunIntensity:1.7, hemi:1.05, litWindows:.25 },
  night:{ tint:'#1a2a6a', tintAlpha:.82, sun:0x9fb4ff, sunIntensity:.8, hemi:.65, litWindows:.75 },
};
const timeOfDay = name => TOD[name] ?? TOD.day;

// ---- 62: breakable props
class Prop {
  constructor(hp = 10) { this.hp = hp; this.broken = false; }
  hit(dmg) { if (this.broken) return null; this.hp -= dmg; if (this.hp <= 0) { this.broken = true; return 'break'; } return 'wobble'; }
}

// ---- 63: hazards: a schedule (warning, then a crossing) and what they hit
const HAZARDS = {
  tram:{ period:22, warn:2.5, cross:3, width:2.6, height:2.2, dmg:12, speed:12 },
  sheep:{ period:26, warn:2, cross:3.5, width:3, height:1.1, dmg:8, speed:9 },
};
function hazardAt(kind, t) {
  const h = HAZARDS[kind], u = ((t % h.period) + h.period) % h.period, toArrive = h.period - u;
  if (toArrive <= h.warn) return { warn:true, active:false, x:null };
  if (u <= h.cross) { const k = u / h.cross; return { warn:false, active:true, x:-13 + k * 26 }; }
  return { warn:false, active:false, x:null };
}
const hazardHits = (state, fx, fy, kind = 'tram') => !!state.active && Math.abs(state.x - fx) < HAZARDS[kind].width / 2 && fy < HAZARDS[kind].height * .6;

// ---- 66: background cameo types (never real people)
const CAMEOS = [
  { kind:'press', label:'Press gallery' }, { kind:'protester', label:'Protester with a sign' }, { kind:'tourist', label:'Tourist with a selfie stick' },
  { kind:'pensioner', label:'Pensioner with a thermos' }, { kind:'student', label:'Student with a placard' }, { kind:'lobbyist', label:'Lobbyist on the phone' },
];

// ---- 67: billboards, a new slogan each round
const SLOGANS = {
  default:['VOTE EARLY, VOTE OFTEN (ONCE)', 'NOW WITH 20% MORE MANDATE', 'POLLS CLOSE AT 7', 'THIS BILLBOARD WAS FUNDED BY THE TAXPAYER', 'COALITION TALKS: DAY 41'],
  viaduct:['CONES: AUCKLAND\'S NATIONAL TREE', 'HOUSES FROM $2.8M (A SHED)', 'ROAD CONES 4 SALE', 'SUPERYACHT PARKING ONLY'],
  beehive:['SOUTHERLY ADVISORY IN EFFECT', 'CAPITAL GAINS? NEVER HEARD OF HER', 'BRING A JACKET. AND ANOTHER.'],
};
function billboardFor(id, round) { const l = SLOGANS[id] ?? SLOGANS.default; return l[(round - 1) % l.length]; }

export { AMBIENCES, CENTREPIECES, ARENA_META, backdropRes, parallaxLayers, CHEER, Crowd, TIMES, timeOfDay, Prop, HAZARDS, hazardAt, hazardHits, CAMEOS, SLOGANS, billboardFor };
