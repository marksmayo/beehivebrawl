

// Roster

const ROSTER = [
  { id:'luxon', name:'Christopher Luxon', short:'LUXON', nick:'The CEO', party:'National', pcol:0x00529f,
    color:0x1b3f8f, suit:0x1c2a4a, tie:0x3f8fe0, skin:0xf0c2a2, eyes:0x5a7fa0, hair:{ style:'bald', color:0xc9a48c }, build:{ h:1.06, w:1.05 }, pitch:.9,
    stats:{ speed:1, power:1.05, defense:1 },
    bio:'Ex-airline CEO. Has been told seven houses is a lot. Delivers deliverables, at pace.',
    moves:{ a:{ name:'KPI DASHBOARD', kind:'projectile', proj:'chart', dmg:8, speed:10, call:'Look at the metrics!' },
            b:{ name:'FLYING START', kind:'divekick', dmg:11, call:'Cabin crew, seats for take-off!' },
            s:{ name:'BACK ON TRACK', kind:'rush', dmg:26, call:'We are getting this fight back on track!' } },
    intro:['Absolutely.', 'Let me be very clear: I will win this.', 'I am the CEO of this fight.'],
    quips:['Get it done.', 'Deliverables, delivered.', 'Absolutely.', 'Very, very, very bad.'],
    hurt:'That is not a good outcome.', win:'Absolutely. Back on track.', ending:'Celebrates by buying an eighth house.' },

  { id:'hipkins', name:'Chris Hipkins', short:'HIPKINS', nick:'Chippy', party:'Labour', pcol:0xd82a20,
    color:0xc8102e, suit:0x1f2a44, tie:0xc8102e, skin:0xf0bc9c, eyes:0x6a5a40, hair:{ style:'short', color:0xb87d4b }, build:{ h:1, w:1 }, pitch:1.05,
    stats:{ speed:1.05, power:1, defense:1 },
    bio:'Former COVID Response Minister. Will see you at 1pm. Considers the sausage roll a food group.',
    moves:{ a:{ name:'SAUSAGE ROLL', kind:'projectile', proj:'sausage', dmg:8, speed:11, call:'Sausage roll, mate?' },
            b:{ name:'DIET COKE FIZZ', kind:'blast', fx:'fizz', dmg:9, call:'Shaken, not stirred!' },
            s:{ name:'1PM BRIEFING', kind:'drop', dmg:22, call:'See you all at 1pm.' } },
    intro:["Right, let's get on with it.", 'Back to basics.', 'Bread and butter, mate.'],
    quips:['Mate.', 'Bread and butter issues!', 'Pass the tomato sauce.', 'Hold my Diet Coke.'],
    hurt:'Yeah, nah.', win:'Bread and butter, baby!', ending:'Celebrates with a sausage roll and a Diet Coke. Possibly two.' },

  { id:'seymour', name:'David Seymour', short:'SEYMOUR', nick:'The Deregulator', party:'ACT', pcol:0xfdc82f,
    color:0xf5c400, suit:0x2a3552, tie:0xf5b400, skin:0xeebf9e, eyes:0x5a86b0, hair:{ style:'short', color:0x3a2a1e }, build:{ h:.93, w:.9 }, pitch:1.2,
    stats:{ speed:1.22, power:.88, defense:.9 },
    bio:'Minister for Regulation. Danced on national television. Will cut your red tape, and your hit points.',
    moves:{ a:{ name:'DANCING WITH THE STARS', kind:'dash', dmg:10, call:'Cha-cha-cha!' },
            b:{ name:'RED TAPE', kind:'projectile', proj:'tape', dmg:7, speed:12, stun:.5, call:'Wrap it in red tape!' },
            s:{ name:'REGULATORY BONFIRE', kind:'eruption', dmg:24, call:'Burn the red tape!' } },
    intro:['Freedom!', "Let's deregulate this.", 'Personal responsibility, mate.'],
    quips:['Freedom!', 'Cut the red tape!', 'Regulate THIS.', 'Personal responsibility!'],
    hurt:'Over-regulated!', win:'Freedom! Woo!', ending:'Repeals the referee, then dances on the result.' },

  { id:'peters', name:'Winston Peters', short:'PETERS', nick:'The Kingmaker', party:'NZ First', pcol:0x222222,
    color:0x141414, suit:0x1a1a1f, tie:0xa01020, skin:0xc98f6a, eyes:0x6a7a80, hair:{ style:'swept', color:0xd6d6d6 }, build:{ h:1, w:1 }, pitch:.8, comeback:true,
    stats:{ speed:.9, power:1.12, defense:1.05 },
    bio:'In Parliament since before you were born. Written off more times than anyone can count. Passive: THE COMEBACK.',
    moves:{ a:{ name:'FAKE NEWS!', kind:'blast', fx:'ring', dmg:10, call:'Fake news!' },
            b:{ name:'THE WINK', kind:'projectile', proj:'wink', dmg:5, speed:9, stun:1.0, call:'*wink*' },
            s:{ name:'KINGMAKER', kind:'heal', dmg:10, call:'I decide who governs.' } },
    intro:['Read my lips.', 'I will decide after the fight.', 'Next question.'],
    quips:['No.', 'Fake news!', 'Read my lips.', 'Next question.'],
    hurt:"I'll be back.", win:'Never, ever write me off.', ending:'Forms a coalition with Winston Peters. Again.' },

  { id:'swarbrick', name:'Chlöe Swarbrick', short:'SWARBRICK', nick:'OK Boomer', party:'Green', pcol:0x098137,
    color:0x2d9b3a, suit:0x2a7a3a, tie:null, skin:0xf4d0b8, eyes:0x5a86b0, hair:{ style:'long', color:0x5a3b28 }, build:{ h:.95, w:.88 }, pitch:1.25,
    stats:{ speed:1.15, power:.92, defense:.9 },
    bio:'Green co-leader. Once silenced a heckler with two words. Will ride a bike lane straight through your guard.',
    moves:{ a:{ name:'OK BOOMER', kind:'projectile', proj:'wave', dmg:9, speed:12, call:'OK boomer.' },
            b:{ name:'BIKE LANE', kind:'dash', bike:true, dmg:11, call:'Coming through on the bike lane!' },
            s:{ name:'GREEN WAVE', kind:'bigwave', dmg:24, call:'Ride the green wave!' } },
    intro:['Climate emergency, people.', "Let's go.", 'Science says hi.'],
    quips:['OK boomer.', 'Tax the rich!', 'Science says hi.', 'Cool story.'],
    hurt:'This is a climate emergency!', win:'OK, boomer.', ending:'Posts about it. Forty thousand likes before the dust settles.' },

  { id:'willis', name:'Nicola Willis', short:'WILLIS', nick:'The Accountant', party:'National', pcol:0x00529f,
    color:0x3a7fd0, suit:0x3a6fc0, tie:null, skin:0xf2c8ae, eyes:0x5a86b0, hair:{ style:'bob', color:0x3a2218 }, build:{ h:.95, w:.9 }, pitch:1.15,
    stats:{ speed:1.05, power:1.02, defense:.95 },
    bio:'Minister of Finance. Has found a fiscal hole, and is not afraid to use it.',
    moves:{ a:{ name:'BUDGET CUTS', kind:'projectile', proj:'scissors', dmg:8, speed:12, call:'Cuts!' },
            b:{ name:'TIGHTEN THE BELT', kind:'pull', dmg:12, call:'Time to tighten our belts!' },
            s:{ name:'THE FISCAL HOLE', kind:'hole', dmg:26, call:'Mind the fiscal hole!' } },
    intro:["Let's balance the books.", 'No new spending on you.', 'Line by line.'],
    quips:['Cuts!', 'Living within our means.', 'Line by line.', 'Zero-dollar budget!'],
    hurt:'Over budget!', win:'Books: balanced.', ending:"Balances the books. On the opponent's head." },

  { id:'waititi', name:'Rawiri Waititi', short:'WAITITI', nick:'The Tie-Breaker', party:'Te Pāti Māori', pcol:0xb5121b,
    color:0x262626, suit:0x8a1c1c, shirt:0x161616, tie:null, skin:0x9a6a4c, eyes:0x2a1a10, lens:0x7a3a5a, hair:{ style:'short', color:0x1a1a1a }, beardColor:0x8a8580, beard:true, hat:true, build:{ h:1.06, w:1.1 }, pitch:.85,
    stats:{ speed:.95, power:1.15, defense:1.05 },
    bio:'Te Pāti Māori co-leader. Refused the tie, got ejected, changed the rules. Wears the hat with conviction.',
    moves:{ a:{ name:'TIE TOSS', kind:'projectile', proj:'tie', dmg:8, speed:12, call:'Take your colonial noose back!' },
            b:{ name:'THE WALKOUT', kind:'teleport', dmg:12, call:"I'm out. See ya!" },
            s:{ name:'NO TIE, NO PROBLEM', kind:'rain', dmg:24, call:'Ties for everyone!' } },
    intro:['Kia ora.', 'No tie today, e hoa.', 'Ka pai. Let us begin.'],
    quips:['Not wearing that.', 'Kia kaha!', 'Rules are made to be changed.', 'Ka pai.'],
    hurt:'Ejected again!', win:'Ka pai. No tie required.', ending:'Walks out of the arena, on principle.' },

  { id:'brownlee', name:'Gerry Brownlee', short:'BROWNLEE', nick:'Mr Speaker', party:'The Speaker', pcol:0x6b4a12,
    color:0x1a1a1a, suit:0x18181c, tie:0x3a3a48, skin:0xefbc9c, eyes:0x5a7fa0, hair:{ style:'bald', color:0xd0d0d0 }, glasses:true, prop:'gavel', build:{ h:1.05, w:1.25 }, pitch:.7,
    stats:{ speed:.85, power:1.2, defense:1.15 },
    bio:'Speaker of the House. Keeps order with a gavel and a voice that can stop traffic.',
    moves:{ a:{ name:'ORDER! ORDER!', kind:'slam', dmg:11, call:'ORDER! ORDER!' },
            b:{ name:'RESUME YOUR SEAT', kind:'projectile', proj:'bench', dmg:12, speed:7, call:'Resume your seat!' },
            s:{ name:'NAME & EJECT', kind:'launch', dmg:26, call:'The member will leave the House!' } },
    intro:['Order.', 'The House will come to order.', 'Members will be brief.'],
    quips:['ORDER!', 'Withdraw and apologise!', 'Resume your seat!', 'Point of order denied.'],
    hurt:'Disorderly conduct!', win:'Order restored.', ending:'Rules the entire match out of order and goes to lunch.' },
];

const KO_SUBS = ['Vote of no confidence!', 'Ejected from the House!', 'Lost the electorate!', 'Back to the list!',
  'Resigned to spend more time with family!', 'Lost the deposit!', 'Demoted to the back bench!', 'Sent to select committee!'];
const SFX_WORDS = ['POW!', 'WHAM!', 'BIFF!', 'THWACK!', 'KAPOW!', 'BAM!', 'SMACK!', 'ZOK!', 'KRUNCH!', 'BOFF!'];

// =====================================================================

export { ROSTER, KO_SUBS, SFX_WORDS };
