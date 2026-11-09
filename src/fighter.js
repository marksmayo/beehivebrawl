import * as THREE from 'three';
import { INK, Pn, stage } from './arenas.js';
import { say, sfx } from './audio.js';
import { applyHit } from './combat.js';
import { bubble, bubbles, floater } from './dom.js';
import { bikeMesh, dust, effects, trail, fxDrop, fxEruption, fxHeal, fxHole, fxPillar, fxRain, ringFx, rm, sparks, spawnProjectile, trainMesh } from './effects.js';
import { game } from './game.js';
import { disposeObj, ink, inkMaterial, outline, toon } from './kit.js';
import { PARTS } from './parts.js';
import { scene } from './renderer.js';
import { BOUND, GRAV, JUMP, SPEED, clamp, damp, hex, pick } from './util.js';
import {
  GUARD, JOINTS, pose as mkPose, layer, attackPose, idlePose, walkPose, walkPhase, WALK, hitPose, koBody, koStep, wakeup, DOWN_TIME,
  DashDetector, DASH_TIME, dashSpeed, approachSpeed, flipAngle, isThrow, THROWS, THROW_DMG, throwPose, TAUNT_TIME, tauntReward, tauntPose,
  INTROS, VICTORY, loserPose, smearStretch, Spring, TURN_TIME, turnAngle, wantsGuard, guardPose, ATTACK_HEIGHT,
} from './anim.js';
import { skinnedLimb } from './rig.js';

// Fighter

const ATK = {
  punch:{ s:.07, a:.09, r:.16, dmg:6, range:1.35, knock:3, stun:.3 },
  kick: { s:.14, a:.11, r:.26, dmg:9, range:1.75, knock:5.5, stun:.42 },
};
const COOL = { a:2.1, b:2.9 };
const FLIP_Y = 1.3; // somersault pivot height (hips)
const G_CAP = (r, l) => new THREE.CapsuleGeometry(r, l, 6, 14);

// =====================================================================
// Hand-drawn faces: inked features painted onto the sculpted heads by front
// projection, one texture per expression (n = neutral, open = shouting, hurt)
// =====================================================================
const FACES = {
  luxon:     { brow:'#6a5444', bw:9,  tilt:.05,  arch:10, eye:'#4f7fa8', lid:.35, mouth:'grin',  mw:64, lines:['smile', 'dome'] },
  hipkins:   { brow:'#a8784a', bw:8,  tilt:-.05, arch:8,  eye:'#6a5a40', lid:.3,  mouth:'grin',  mw:54, lines:['smile', 'blush'] },
  seymour:   { brow:'#2a1e16', bw:11, tilt:.12,  arch:3,  eye:'#4a7aa8', lid:.5,  mouth:'smirk', mw:48, lines:['smile', 'jaw'] },
  peters:    { brow:'#8e8e8e', bw:14, tilt:.28,  arch:6,  eye:'#6a7a80', lid:.55, mouth:'smirk', mw:56, lines:['smile', 'forehead', 'crows', 'bags'] },
  swarbrick: { brow:'#4a3020', bw:7,  tilt:-.08, arch:12, eye:'#4a7aa8', lid:.22, mouth:'grin',  mw:50, lips:'#cf5a5a', lash:true, lines:['blush'] },
  willis:    { brow:'#3a2218', bw:7,  tilt:-.06, arch:13, eye:'#4a7aa8', lid:.22, mouth:'grin',  mw:58, lips:'#c8303a', lash:true, lines:['smile'] },
  waititi:   { brow:'#1a1a1a', bw:12, tilt:.15,  arch:6,  eye:'#2a1a10', lid:.4,  mouth:'grin',  mw:58, lines:['smile'] },
  brownlee:  { brow:'#bdbdbd', bw:10, tilt:0,    arch:8,  eye:'#4a7aa8', lid:.45, mouth:'grin',  mw:56, lines:['smile', 'bags', 'chin'] },
};
const faceCache = {};
function faceSet(d) { return faceCache[d.id] ??= { n:paintFace(d, 'n'), open:paintFace(d, 'open'), hurt:paintFace(d, 'hurt') }; }
function paintFace(d, mode) {
  const F = FACES[d.id] ?? FACES.luxon, S = 512, U = S / 1.3, p = new Pn(S, S, 11), g = p.g;
  const cx = S / 2, Y = y => S / 2 - y * U;            // head-local height -> canvas row
  g.fillStyle = hex(d.skin); g.fillRect(0, 0, S, S);
  const q = (x0, y0, kx, ky, x1, y1, w, a = 1, c = INK) => { g.save(); g.globalAlpha = a; g.beginPath(); g.moveTo(x0, y0); g.quadraticCurveTo(kx, ky, x1, y1); g.lineWidth = w; g.strokeStyle = c; g.stroke(); g.restore(); };
  const ey = Y(.05), my = Y(-.3), angry = mode === 'open' ? .25 : 0, lid = mode === 'open' ? F.lid * .4 : F.lid;
  const L = F.lines;
  if (L.includes('blush')) for (const s of [-1, 1]) { g.save(); g.globalAlpha = .22; g.fillStyle = '#e8604f'; g.beginPath(); g.ellipse(cx + s * 100, Y(-.12), 38, 24, 0, 0, 7); g.fill(); g.restore(); }
  for (const s of [-1, 1]) {
    const ex = cx + s * 79;
    // brow: a tapered, inked wedge, inner end (toward the nose) heavier
    const ix = ex - s * 38, ox = ex + s * 48, iy = ey - 56 + (F.tilt + angry) * 44, oy = ey - 54 - (F.tilt + angry) * 12, ky = ey - 62 - F.arch;
    g.beginPath(); g.moveTo(ix, iy); g.quadraticCurveTo(ex, ky, ox, oy); g.quadraticCurveTo(ex, ky + F.bw * 1.3, ix, iy + F.bw * 1.8); g.closePath();
    g.fillStyle = F.brow; g.fill(); g.lineWidth = 4; g.strokeStyle = INK; g.stroke();
    if (mode === 'hurt') { // screwed shut
      q(ex - s * 28, ey - 10, ex, ey + 4, ex + s * 26, ey + 2, 6); q(ex - s * 28, ey + 10, ex, ey + 2, ex + s * 26, ey + 2, 4);
      continue;
    }
    const hu = 26 * (1 - lid * .75), hl = 13;
    const almond = () => { g.beginPath(); g.moveTo(ex - 36, ey); g.quadraticCurveTo(ex, ey - hu * 2.1, ex + 36, ey); g.quadraticCurveTo(ex, ey + hl * 1.8, ex - 36, ey); g.closePath(); };
    almond(); g.fillStyle = '#f7f3ea'; g.fill();
    g.save(); almond(); g.clip();
    g.fillStyle = F.eye; g.beginPath(); g.arc(ex, ey + 1, 17, 0, 7); g.fill(); g.lineWidth = 2.5; g.strokeStyle = INK; g.stroke();
    g.fillStyle = '#0d0a08'; g.beginPath(); g.arc(ex, ey + 1, 9, 0, 7); g.fill();
    g.fillStyle = 'rgba(60,40,30,.35)'; g.fillRect(ex - 34, ey - 30, 68, 30 - hu * .85); // upper-lid shadow
    g.restore();
    g.fillStyle = '#fff'; g.beginPath(); g.arc(ex - 5, ey - 5, 4, 0, 7); g.fill();
    // lid lines: heavy upper with a flick, light lower, crease above
    g.beginPath(); g.moveTo(ex - 36, ey + 1); g.quadraticCurveTo(ex, ey - hu * 2.1, ex + 36, ey); g.lineWidth = 8.5; g.strokeStyle = INK; g.stroke();
    q(ex + s * 34, ey, ex + s * 42, ey - 6, ex + s * 48, ey - 9, 5.5);
    q(ex - 30, ey + 4, ex, ey + hl * 1.8, ex + 30, ey + 4, 3.5, .7);
    q(ex - 30, ey - hu - 6, ex, ey - hu * 2.2 - 8, ex + 32, ey - hu - 4, 3.5, .55);
    if (F.lash) for (let k = 0; k < 3; k++) q(ex + s * (20 + k * 5), ey - 12 + k * 4, ex + s * (28 + k * 5), ey - 18 + k * 4, ex + s * (34 + k * 6), ey - 20 + k * 5, 3);
    if (L.includes('bags')) { q(ex - 24, ey + 20, ex, ey + 34, ex + 26, ey + 18, 2.5, .45); q(ex - 16, ey + 30, ex + 2, ey + 40, ex + 20, ey + 28, 2, .3); }
    if (L.includes('crows')) for (let k = -1; k <= 1; k++) q(ex + s * 40, ey + k * 9, ex + s * 50, ey + k * 12, ex + s * 58, ey + k * 16, 2.5, .45);
  }
  // nose: nostril wings and one shaded side of the bridge
  for (const s of [-1, 1]) q(cx + s * 12, Y(-.1) + 4, cx + s * 30, Y(-.1) + 2, cx + s * 30, Y(-.1) - 14, 4.5, .8);
  q(cx - 2, Y(-.1) + 8, cx + 6, Y(-.1) + 12, cx + 12, Y(-.1) + 8, 2.5, .6);
  q(cx + 12, Y(.12), cx + 18, Y(0), cx + 22, Y(-.07), 3, .3);
  if (L.includes('smile')) for (const s of [-1, 1]) q(cx + s * 42, Y(-.1) + 6, cx + s * (F.mw + 18), my - 22, cx + s * (F.mw + 10), my + 16, 4.5, .6);
  if (L.includes('forehead')) for (let k = 0; k < 3; k++) q(cx - 80, Y(.42) + k * 18, cx, Y(.45) + k * 18, cx + 80, Y(.42) + k * 18, 2.5, .35);
  if (L.includes('dome')) { q(cx - 60, Y(.55), cx, Y(.6), cx + 60, Y(.55), 2.5, .25); g.save(); g.globalAlpha = .35; g.fillStyle = '#fff'; g.beginPath(); g.ellipse(cx - 40, Y(.6), 50, 18, -.3, 0, 7); g.fill(); g.restore(); }
  if (L.includes('chin')) q(cx - 70, Y(-.53), cx, Y(-.6), cx + 70, Y(-.53), 3, .4);
  if (L.includes('jaw')) for (const s of [-1, 1]) q(cx + s * 120, Y(-.22), cx + s * 108, Y(-.42), cx + s * 60, Y(-.5), 2.5, .35);
  // mouth
  const mw = F.mw;
  const lips = (path, open = true) => {
    if (F.lips) { path(); g.lineWidth = 11; g.strokeStyle = F.lips; g.stroke(); }
    if (open) { path(); g.fillStyle = '#4a1414'; g.fill(); g.save(); path(); g.clip();
      g.fillStyle = '#fbf8f0'; g.fillRect(cx - mw - 10, my - 40, mw * 2 + 20, 50); g.lineWidth = 1.5; g.strokeStyle = 'rgba(80,60,50,.5)';
      for (let k = -3; k <= 3; k++) { g.beginPath(); g.moveTo(cx + k * mw / 4, my - 30); g.lineTo(cx + k * mw / 4, my + 8); g.stroke(); }
      g.fillStyle = '#d0606a'; g.beginPath(); g.ellipse(cx, my + 44, mw * .55, 22, 0, 0, 7); g.fill(); g.restore(); }
    path(); g.lineWidth = 6; g.strokeStyle = INK; g.stroke();
  };
  if (mode === 'open') lips(() => { g.beginPath(); g.ellipse(cx, my + 10, mw * .78, 40, 0, 0, 7); });
  else if (mode === 'hurt') {
    lips(() => { g.beginPath(); g.roundRect(cx - mw * .8, my - 10, mw * 1.6, 30, 10); });
    for (let k = -2; k <= 2; k++) q(cx + k * mw * .3, my - 10, cx + k * mw * .3, my + 5, cx + k * mw * .3, my + 20, 2, .7);
    q(cx - mw * .8, my + 5, cx, my + 2, cx + mw * .8, my + 5, 2, .7);
  } else if (F.mouth === 'grin') {
    lips(() => { g.beginPath(); g.moveTo(cx - mw, my - 8); g.quadraticCurveTo(cx, my + 4, cx + mw, my - 8); g.quadraticCurveTo(cx, my + 44, cx - mw, my - 8); g.closePath(); });
    for (const s of [-1, 1]) q(cx + s * (mw - 2), my - 14, cx + s * (mw + 8), my - 8, cx + s * (mw + 4), my + 2, 3.5);
  } else { // smirk
    if (F.lips) q(cx - mw, my + 2, cx, my + 12, cx + mw, my - 12, 9, 1, F.lips);
    q(cx - mw, my + 2, cx, my + 12, cx + mw, my - 12, 7);
    q(cx + mw - 6, my - 18, cx + mw + 6, my - 12, cx + mw + 2, my - 2, 3.5);
    q(cx - 20, my + 22, cx, my + 27, cx + 20, my + 21, 3, .4);
  }
  return p.tex();
}

class Fighter {
  constructor(def, side) {
    this.def = def; this.side = side; this.mats = [];
    // root (position) > yaw (facing) > flipG (somersaults, pivots at the hips) > pose (lean, pivots at the feet)
    this.root = new THREE.Group(); this.yaw = new THREE.Group(); this.flipG = new THREE.Group(); this.pose = new THREE.Group();
    this.root.add(this.yaw); this.yaw.add(this.flipG); this.flipG.add(this.pose);
    this.flipG.position.y = FLIP_Y;
    this.build();
    this.wins = 0; this.meter = 0; this.comebackUsed = false; this.opp = null; this.vehicle = null; this.belt = null;
    this.dash = new DashDetector(); this.cp = { ...GUARD }; this.hairSpring = new Spring(70, 7); this.tieSpring = new Spring(55, 5);
    this.resetRound(side ? 3 : -3);
  }
  M(color, o = {}) { const m = toon(color, o); this.mats.push(m); return m; }
  mesh(geo, m, olw = .035) { const o = new THREE.Mesh(geo, m); o.castShadow = true; if (olw) outline(o, olw); return o; }
  limb(y, z, r, len, m, endGeo, endMat, endPos) {
    const piv = new THREE.Group(); piv.position.set(0, y, z);
    const seg = this.mesh(G_CAP(r, len), m); seg.position.y = -(len / 2 + r * .6); piv.add(seg);
    const end = this.mesh(endGeo, endMat); end.position.copy(endPos); piv.add(end);
    this.pose.add(piv); piv.seg = seg; return piv;
  }
  build() {
    if (PARTS?.[this.def.id] && PARTS.common) return this.buildSculpted(PARTS[this.def.id]);
    const d = this.def, w = d.build.w, P = this.pose;
    const suit = this.M(d.color), pants = this.M(new THREE.Color(d.color).multiplyScalar(.6)), skin = this.M(d.skin);
    const shoe = this.M(0x161616), white = this.M(0xf4f4f4), hairM = this.M(d.hair.color), dark = this.M(0x111111), mouthM = this.M(0x5a1414);
    const torso = this.mesh(G_CAP(.42, .55), suit); torso.position.y = 1.42; torso.scale.set(w, 1, w * .82); P.add(torso);
    const shirt = this.mesh(new THREE.BoxGeometry(.06, .36, .26), white, 0); shirt.position.set(.4 * w, 1.72, 0); shirt.rotation.z = -.15; P.add(shirt);
    if (d.tie) { const tie = this.mesh(new THREE.BoxGeometry(.06, .48, .11), this.M(d.tie), .02); tie.position.set(.43 * w, 1.58, 0); tie.rotation.z = -.1; P.add(tie); }
    if (d.id === 'waititi') { // tino rangatiratanga-coloured lapel stripe instead of a tie
      const s = this.mesh(new THREE.BoxGeometry(.05, .5, .06), this.M(0xb5121b), .015); s.position.set(.39 * w, 1.55, .17); P.add(s);
    }
    const neck = this.mesh(new THREE.CylinderGeometry(.15, .17, .3, 12), skin, 0); neck.position.y = 1.98; P.add(neck);

    const H = this.head = new THREE.Group(); H.position.y = 2.5; P.add(H);
    H.add(this.mesh(new THREE.SphereGeometry(.6, 28, 20), skin, .04));
    const eyeW = this.M(0xffffff);
    for (const s of [-1, 1]) {
      const e = this.mesh(new THREE.SphereGeometry(.12, 14, 10), eyeW, .02); e.position.set(.52, .08, s * .21); e.scale.set(.6, 1.1, 1); H.add(e);
      const p = this.mesh(new THREE.SphereGeometry(.06, 10, 8), dark, 0); p.position.set(.6, .07, s * .2); H.add(p);
      const b = this.mesh(new THREE.BoxGeometry(.06, .06, .24), d.hair.style === 'bald' ? this.M(new THREE.Color(d.hair.color).multiplyScalar(.7)) : hairM, 0);
      b.position.set(.55, .28, s * .21); b.rotation.x = s * (d.id === 'peters' ? -.25 : .12); H.add(b);
      const ear = this.mesh(new THREE.SphereGeometry(.13, 10, 8), skin, .02); ear.position.set(-.02, 0, s * .58); ear.scale.set(.6, 1, .5); H.add(ear);
      if (d.glasses) {
        const ring = this.mesh(new THREE.TorusGeometry(.15, .025, 8, 20), dark, 0); ring.position.set(.63, .08, s * .21); ring.rotation.y = Math.PI / 2; H.add(ring);
        const arm = this.mesh(new THREE.BoxGeometry(.5, .03, .03), dark, 0); arm.position.set(.36, .1, s * .5); H.add(arm);
      }
    }
    if (d.glasses) { const br = this.mesh(new THREE.BoxGeometry(.03, .03, .14), dark, 0); br.position.set(.65, .1, 0); H.add(br); }
    const nose = this.mesh(new THREE.SphereGeometry(.11, 12, 10), skin, .02); nose.position.set(.6, -.06, 0); H.add(nose);
    this.mouth = this.mesh(new THREE.BoxGeometry(.06, .06, .24), mouthM, .015); this.mouth.position.set(.58, -.27, 0); H.add(this.mouth);

    const cap = (r = .62, tilt = .25, len = .42) => { const c = this.mesh(new THREE.SphereGeometry(r, 24, 12, 0, Math.PI * 2, 0, Math.PI * len), hairM, .03); c.rotation.z = tilt; H.add(c); return c; };
    switch (d.hair.style) {
      case 'bald': { const b = this.mesh(new THREE.SphereGeometry(.625, 20, 8, -Math.PI / 2, Math.PI, Math.PI * .3, Math.PI * .24), hairM, .02); H.add(b); break; }
      case 'short': cap(.63, .28, .4); break;
      case 'swept': { cap(.64, .2, .42); const q = this.mesh(new THREE.SphereGeometry(.32, 14, 10), hairM, .03); q.position.set(.3, .45, .05); q.scale.set(1, .55, 1.4); H.add(q); break; }
      case 'long': {
        cap(.64, .3, .45);
        const back = this.mesh(new THREE.BoxGeometry(.3, 1.0, 1.05), hairM, .03); back.position.set(-.38, -.35, 0); H.add(back);
        for (const s of [-1, 1]) { const st = this.mesh(new THREE.BoxGeometry(.3, .85, .12), hairM, .02); st.position.set(.12, -.38, s * .6); H.add(st); }
        break; }
      case 'bob': {
        cap(.645, .25, .45);
        const b = this.mesh(new THREE.SphereGeometry(.66, 20, 10, -Math.PI * .72, Math.PI * 1.44, Math.PI * .3, Math.PI * .42), hairM, .03); H.add(b);
        break; }
    }
    if (d.beard) { const bd = this.mesh(new THREE.SphereGeometry(.62, 20, 10, Math.PI / 2, Math.PI, Math.PI * .58, Math.PI * .36), hairM, .03); H.add(bd); }
    if (d.hat) {
      const hm = this.M(0x1a1a1a);
      const brim = this.mesh(new THREE.CylinderGeometry(.85, .85, .05, 28), hm, .025); brim.position.y = .42; H.add(brim);
      const crown = this.mesh(new THREE.CylinderGeometry(.5, .58, .45, 24), hm, .03); crown.position.y = .66; H.add(crown);
      const band = this.mesh(new THREE.CylinderGeometry(.585, .585, .1, 24), this.M(0xb5121b), 0); band.position.y = .5; H.add(band);
      H.children.slice(-3).forEach(c => (c.rotation.z = .08));
    }
    this.addExtras(H);
    const z = .42 * w + .13;
    this.armF = this.limb(1.82, z, .13, .42, suit, new THREE.SphereGeometry(.15, 12, 10), skin, new THREE.Vector3(0, -.74, 0));
    this.armB = this.limb(1.82, -z, .13, .42, suit, new THREE.SphereGeometry(.15, 12, 10), skin, new THREE.Vector3(0, -.74, 0));
    const shoeGeo = new THREE.BoxGeometry(.42, .16, .25);
    this.legF = this.limb(.95, .21 * w, .17, .48, pants, shoeGeo, shoe, new THREE.Vector3(.09, -.84, 0));
    this.legB = this.limb(.95, -.21 * w, .17, .48, pants, shoeGeo, shoe, new THREE.Vector3(.09, -.84, 0));
    this.addProp();
  }
  // Sculpted Blender parts (models/fighters.js) on the same pivot rig as the procedural build.
  buildSculpted(K) {
    const d = this.def, w = d.build.w, P = this.pose, C = PARTS.common;
    const mat = (color, o = {}) => this.M(color, o);
    const suitC = d.suit ?? d.color;
    // the face is drawn, not modelled: skin carries the painted features (front-projected UVs)
    const faces = this.faces = faceSet(d), skin = this.faceMat = mat(0xffffff, { vc:true }); skin.map = faces.n;
    const skinP = mat(d.skin);
    const sg = K.skin.geo;
    if (!sg.attributes.uv) {
      const P = sg.attributes.position, uv = new Float32Array(P.count * 2);
      for (let i = 0; i < P.count; i++) {
        const back = P.getX(i) < -.05; // back of the head samples a plain corner
        uv[i * 2] = back ? .02 : .5 - P.getZ(i) / 1.3; uv[i * 2 + 1] = back ? .98 : .5 + P.getY(i) / 1.3;
      }
      sg.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    }
    const hair = mat(d.hair.color, { rough:.6 }), shirt = mat(d.shirt ?? 0xf2f2f2, { rough:.7 });
    const suit = mat(suitC, { rough:.78 }), lapel = mat(new THREE.Color(suitC).multiplyScalar(.82), { rough:.6 });
    const pants = mat(new THREE.Color(suitC).multiplyScalar(.85), { rough:.8 });
    const roles = {
      skin, hair,
      beard:mat(d.beardColor ?? d.hair.color, { rough:.8 }),
      glass:mat(0x111111, { rough:.25 }), lens:mat(d.lens ?? 0xaaccee, { opacity:d.lens ? .55 : .18, rough:.05, metal:.3 }),
      hat:mat(0x1c1c1c, { rough:.9 }), band:mat(0x5a4a32, { rough:.8 }),
      jacket:suit, lapel, shirt, tie:mat(d.tie ?? 0x222222, { rough:.5 }), button:mat(0x111111, { rough:.4 }),
    };
    const ol = .022, noInk = new Set(['lens', 'button', 'band']);
    const part = (parent, src, m, t = ol) => {
      const o = new THREE.Mesh(src.geo, m); o.position.copy(src.pos); o.castShadow = true; o.receiveShadow = true;
      if (t) ink(o, t); parent.add(o); return o;
    };
    const torso = new THREE.Group(); torso.position.y = 1.42; torso.scale.set(w, 1, w); P.add(torso);
    const neck = this.mesh(new THREE.CylinderGeometry(.15, .17, .3, 16), skinP, 0); neck.position.y = 1.98; P.add(neck);
    const H = this.head = new THREE.Group(); H.position.y = 2.5; P.add(H);
    // hair and tie hang off springy pivots (secondary motion): at the crown, and at the knot
    this.hairPivot = new THREE.Group(); this.hairPivot.position.set(-.05, .5, 0); H.add(this.hairPivot);
    this.tiePivot = new THREE.Group(); this.tiePivot.position.set(.3, .5, 0); torso.add(this.tiePivot);
    for (const [role, src] of Object.entries(K)) {
      if (!roles[role]) continue;
      const body = ['jacket', 'lapel', 'shirt', 'tie', 'button'].includes(role);
      const parent = role === 'hair' ? this.hairPivot : role === 'tie' ? this.tiePivot : body ? torso : H;
      const o = part(parent, src, roles[role], noInk.has(role) ? 0 : ol);
      if (parent === this.hairPivot || parent === this.tiePivot) o.position.sub(parent.position);
    }
    this.mouth = new THREE.Group(); H.add(this.mouth); // expressions are texture swaps, see animate()
    this.addExtras(H);

    // skinned two-bone limbs: shoulder/elbow and hip/knee bend smoothly (see rig.js)
    const limb = (y, z, r0, r1, len, m) => {
      const L = skinnedLimb({ r0, r1, len, mat:m, ink:inkMaterial(ol) });
      L.root.position.set(0, y, z); this.pose.add(L.root);
      Object.assign(L.root, { elbow:L.lower, mesh:L.mesh, seg:L.mesh, end:L.end });
      return L.root;
    };
    const sleeve = (y, z) => {
      const piv = limb(y, z, .13, .11, .6, suit);
      const hand = new THREE.Group(); hand.scale.setScalar(1.25); piv.end.add(hand);
      part(hand, C.cuff, shirt, 0); part(hand, C.hand, skinP, ol / 1.25);
      return piv;
    };
    const leg = z => {
      const piv = limb(.95, z, .17, .14, .8, pants);
      const foot = piv.foot = new THREE.Group(); foot.position.x = .03; foot.scale.setScalar(1.15); piv.end.add(foot);
      part(foot, C.shoe, mat(0x141414, { rough:.28, metal:.1 }), ol); part(foot, C.sole, mat(0x2a2420, { rough:.9 }), 0);
      return piv;
    };
    const az = .5 * w + .03;
    this.armF = sleeve(1.84, az); this.armB = sleeve(1.84, -az);
    this.legF = leg(.21 * w); this.legB = leg(-.21 * w);
    this.addProp();
  }
  addExtras(H) {
    const d = this.def;
    this.crown = new THREE.Group(); this.crown.position.y = d.hat ? 1.0 : .62; H.add(this.crown);
    const gold = this.M(0xffd23f, { emissive:0x553300 });
    this.crown.add(this.mesh(new THREE.CylinderGeometry(.4, .38, .22, 16, 1, true), gold, .02));
    for (let i = 0; i < 6; i++) { const c = this.mesh(new THREE.ConeGeometry(.08, .25, 6), gold, .015); const a = i / 6 * Math.PI * 2; c.position.set(Math.cos(a) * .38, .22, Math.sin(a) * .38); this.crown.add(c); }
    this.stars = new THREE.Group(); this.stars.position.y = .9; H.add(this.stars);
    for (let i = 0; i < 3; i++) { const s = this.mesh(new THREE.OctahedronGeometry(.12), this.M(0xffe14a, { emissive:0x806000 }), .02); const a = i / 3 * Math.PI * 2; s.position.set(Math.cos(a) * .55, 0, Math.sin(a) * .55); this.stars.add(s); }
  }
  addProp() {
    if (this.def.prop === 'gavel') {
      const gv = new THREE.Group(); if (this.armF.end) { gv.position.y = -.14; this.armF.end.add(gv); } else { gv.position.set(0, -.74, 0); this.armF.add(gv); }
      const wood = this.M(0x6b3e1e);
      const hd = this.mesh(new THREE.CylinderGeometry(.04, .04, .7, 8), wood, .02); hd.rotation.z = Math.PI / 2; hd.position.x = .3; gv.add(hd);
      const gh = this.mesh(new THREE.CylinderGeometry(.13, .13, .42, 14), wood, .025); gh.position.x = .65; gv.add(gh);
    }
  }
  resetRound(x) {
    Object.assign(this, { x, y:0, vx:0, vy:0, hp:100, lag:100, facing:this.side ? -1 : 1, state:'idle', stateT:0, t:Math.random() * 5,
      atk:null, sp:null, cool:{ a:0, b:0 }, flash:0, blockstun:0, stunDur:0, spin:0, combo:0, airAtk:false, squash:0, vanish:0,
      guard:null, dashDir:0, walkPh:0, turnT:9, flipDir:0, airT:1, koB:null, launched:false, hitH:'high', hitDir:1, vIdx:0, introX:x, introT:0 });
    this.crown.visible = false; this.cleanupSpecial();
    this.pose.rotation.set(0, 0, 0); this.pose.position.y = 0; this.animate(1);
  }
  busy() { return !['idle', 'walk', 'block', 'jump'].includes(this.state); }
  cleanupSpecial() {
    if (this.vehicle) { this.root.remove(this.vehicle); disposeObj(this.vehicle); this.vehicle = null; }
    if (this.belt) { rm(this.belt); this.belt = null; }
    this.spin = 0; this.vanish = 0;
  }
  dispose() { this.cleanupSpecial(); scene.remove(this.root); disposeObj(this.root); const b = bubbles.get(this); if (b) { b.el.remove(); bubbles.delete(this); } }

  update(dt, c) {
    const o = this.opp, id = this.def.id, spd = SPEED * this.def.stats.speed;
    this.t += dt; this.stateT += dt; this.flash -= dt; this.turnT += dt;
    this.cool.a = Math.max(0, this.cool.a - dt); this.cool.b = Math.max(0, this.cool.b - dt);
    this.blockstun = Math.max(0, this.blockstun - dt);
    const grounded = this.y <= 0 && this.vy <= 0, dashDir = this.dash.feed(c, this.t);
    switch (this.state) {
      case 'idle': case 'walk': case 'block': {
        if (grounded) this.face(o.x >= this.x ? 1 : -1);
        const near = Math.abs(o.x - this.x) < 4.5, threat = near && ['attack', 'special', 'throw'].includes(o.state) || this.projectileThreat();
        const g = grounded ? wantsGuard(c, this.facing, threat) : null;
        if (g) { this.state = 'block'; this.guard = g; this.vx = 0; break; }
        if (this.state === 'block') { if (this.blockstun > 0) break; this.state = 'idle'; this.guard = null; }
        if (c.sup && this.meter >= 100) { this.startMove('s'); break; }
        if (c.spA && this.cool.a <= 0) { this.startMove('a'); break; }
        if (c.spB && this.cool.b <= 0) { this.startMove('b'); break; }
        if (grounded && isThrow(c, o.x - this.x, this.facing) && o.y <= .05 && ['idle', 'walk', 'block', 'attack', 'taunt'].includes(o.state)) { this.startThrow(); break; }
        if (c.punch) { this.startAttack('punch'); break; }
        if (c.kick) { this.startAttack('kick'); break; }
        if (c.taunt && grounded) { this.state = 'taunt'; this.stateT = 0; this.vx = 0; const q = pick(this.def.quips); bubble(this, q, { dur:1.1 }); say(q, { pitch:this.def.pitch }); break; }
        if (dashDir && grounded) { this.state = 'dash'; this.stateT = 0; this.dashDir = dashDir; sfx.whoosh(); break; }
        const mv = (c.right ? 1 : 0) - (c.left ? 1 : 0);
        if (c.up && grounded) {
          this.vy = JUMP; this.vx = mv * spd * .9; this.state = 'jump'; this.stateT = 0; this.squash = -.15;
          this.flipDir = mv * this.facing; this.airT = 2 * JUMP / GRAV; sfx.jump(); break;
        }
        this.vx = approachSpeed(this.vx, mv * spd * (mv === -this.facing ? .78 : 1), dt); // ramp up and down (99)
        this.state = mv || Math.abs(this.vx) > .4 ? 'walk' : 'idle';
        break;
      }
      case 'dash':
        this.vx = this.dashDir * dashSpeed(this.stateT) * this.def.stats.speed * (this.dashDir === this.facing ? 1 : .8);
        if (Math.random() < dt * 30) dust(this.x - this.dashDir * .4, .4);
        if (this.stateT >= DASH_TIME) this.state = 'idle';
        break;
      case 'jump':
        if (!this.airAtk && (c.punch || c.kick)) { this.airAtk = true; this.flipDir = 0; this.startAttack(c.kick ? 'kick' : 'punch'); }
        break;
      case 'attack': this.updateAttack(dt); break;
      case 'special': this.updateSpecial(dt); break;
      case 'hit': case 'stunned':
        if (this.launched && grounded && this.stateT > .1) { this.launched = false; this.state = 'down'; this.stateT = 0; this.rollDir = 0; dust(this.x, .5); sfx.thud(); break; }
        if (this.stateT >= this.stunDur && grounded) this.state = 'idle';
        break;
      case 'down': { // knocked down: lie there, then get up, or roll if a direction is held
        if (this.stateT < DOWN_TIME) this.rollDir = (c.right ? 1 : 0) - (c.left ? 1 : 0);
        const w = wakeup(this.stateT, this.rollDir);
        this.vx = w.phase === 'roll' ? w.dx / .45 : 0;
        if (w.phase === 'done') { this.state = 'idle'; this.vx = 0; }
        break;
      }
      case 'throw': this.updateThrow(); break;
      case 'taunt':
        this.vx = 0;
        if (this.stateT >= TAUNT_TIME) { this.meter = Math.min(100, this.meter + tauntReward(false)); this.state = 'idle'; floater('+MANDATE', this.x, 3.4, { color:'#ffd23f', size:22 }); }
        break;
      case 'intro': {
        const it = INTROS[id];
        this.x = damp(this.x, this.introX, it?.entry === 'slide' ? 3 : 4, dt);
        break;
      }
      case 'hole':
        this.vx = 0; this.vy = 0;
        if (this.stateT < .6) this.y = -3.4 * (this.stateT / .6);
        else if (this.stateT > 1.25) { this.vy = 16; this.state = 'hit'; this.stunDur = .35; this.stateT = 0; }
        break;
    }
    if (this.state !== 'hole' && this.state !== 'thrown') {
      this.vy -= GRAV * dt; this.y += this.vy * dt;
      if (this.y <= 0 && this.vy <= 0) {
        if (this.y < 0 || this.vy < -1) {
          if (this.vy < -6) this.squash = .22;
          if (this.vy < -16) { game.shake(.2); sfx.thud(); dust(this.x, .6); }
          if (this.state === 'jump') this.state = 'idle';
          this.airAtk = false; this.flipDir = 0;
        }
        this.y = 0; this.vy = 0;
      }
    }
    if (this.y <= 0 && ['hit', 'stunned', 'block', 'ko', 'victory', 'attack', 'taunt', 'throw', 'lose'].includes(this.state)) this.vx = damp(this.vx, 0, 8, dt);
    const dx = this.vx * dt;
    this.x += dx;
    if (stage?.wind && !['ko', 'thrown', 'intro'].includes(this.state)) this.x += game.wind * dt;
    // the walk cycle advances with distance travelled (forwards or backwards), so feet stay planted
    if (this.state === 'walk') this.walkPh += Math.sign(dx * this.facing) * walkPhase(0, dx, WALK[id] ?? WALK.generic);
    this.animate(dt);
  }
  face(f) { if (f !== this.facing) { this.facing = f; this.turnT = 0; } }
  projectileThreat() {
    return effects.some(e => e.isProj && e.owner !== this && Math.abs(e.mesh.position.x - this.x) < 4.5 && Math.sign(this.x - e.mesh.position.x) === e.dir);
  }
  startThrow() {
    const o = this.opp;
    this.state = 'throw'; this.stateT = 0; this.vx = 0; this.thrownDone = false;
    o.cleanupSpecial(); Object.assign(o, { state:'thrown', stateT:0, atk:null, sp:null, vx:0, vy:0, guard:null });
    floater(THROWS[this.def.id]?.name ?? 'THROW!', this.x, 3.7, { color:'#ffd23f', size:30, life:1.1 });
    sfx.whoosh();
  }
  updateThrow() {
    const o = this.opp, F = this.facing, t = this.stateT;
    if (!this.thrownDone && o.state === 'thrown') { // lift them over our head and toss them behind us
      const u = clamp((t - .12) / .33, 0, 1);
      o.x = this.x + F * (.9 - 1.9 * u); o.y = Math.sin(u * Math.PI) * 1.9; o.spin = u * Math.PI * F;
      if (u >= 1) {
        this.thrownDone = true; o.y = .5; o.spin = 0; o.state = 'hit';
        applyHit(this, o, { dmg:THROW_DMG, knock:5, launch:6, stun:.5, heavy:true, unblockable:true, kind:'throw', hy:1.3 });
      }
    }
    if (t >= .75) this.state = 'idle';
  }

  startAttack(type) {
    this.state = 'attack'; this.stateT = 0; this.atk = { type, t:0, d:ATK[type], done:false };
    if (this.y <= 0) this.vx = 0;
    sfx.whoosh();
  }
  updateAttack(dt) {
    const a = this.atk; a.t += dt; const d = a.d, o = this.opp;
    if (!a.done && a.t >= d.s && a.t < d.s + d.a) {
      const dx = (o.x - this.x) * this.facing;
      if (dx > -.2 && dx < d.range * this.def.build.h + .35 && Math.abs(o.y - this.y) < 1.7) {
        a.done = true;
        applyHit(this, o, { dmg:d.dmg, knock:d.knock, stun:d.stun, heavy:a.type === 'kick', hy:a.type === 'kick' ? 1.3 : 1.9, kind:a.type, height:this.y > .05 ? 'high' : ATTACK_HEIGHT[a.type] });
      }
    }
    if (a.t >= d.s + d.a + d.r) this.state = this.y > 0 ? 'jump' : 'idle';
  }

  startMove(slot) {
    const mv = this.def.moves[slot], sup = slot === 's';
    this.state = 'special'; this.stateT = 0; this.vx = 0;
    this.sp = { ...mv, slot, t:0, fired:false, hit:false, sup };
    if (sup) { this.meter = 0; game.superFlash(this, mv); }
    else {
      this.cool[slot] = COOL[slot];
      bubble(this, mv.call, { dur:1.3, shout:true });
      say(mv.call, { pitch:this.def.pitch });
      floater(mv.name, this.x, 3.6 * this.def.build.h + .5, { color:hex(this.def.pcol === 0x222222 ? 0xdddddd : this.def.pcol), size:24, life:.9, rise:.8 });
    }
    sfx.whoosh();
  }
  endSpecial() { this.cleanupSpecial(); this.state = this.y > 0 ? 'jump' : 'idle'; this.vx = 0; this.sp = null; }
  updateSpecial(dt) {
    const s = this.sp, o = this.opp, F = this.facing; s.t += dt;
    const dx = (o.x - this.x) * F, close = (r, yr = 1.7) => Math.abs(o.x - this.x) < r && Math.abs(o.y - this.y) < yr;
    switch (s.kind) {
      case 'projectile': case 'bigwave':
        if (!s.fired && s.t >= (s.sup ? .2 : .22)) { s.fired = true; spawnProjectile(this, s.sup ? { ...s, speed:8 } : s); sfx.whoosh(); }
        if (s.t >= (s.sup ? .6 : .48)) this.endSpecial();
        break;
      case 'dash':
        if (s.bike && !this.vehicle) { this.vehicle = bikeMesh(); this.vehicle.scale.x = F; this.root.add(this.vehicle); }
        if (s.t > .1 && s.t < .55) {
          this.vx = F * (s.bike ? 15 : 13); if (!s.bike) this.spin += dt * 28;
          if (!s.hit && close(1.25)) { s.hit = true; applyHit(this, o, { dmg:s.dmg, knock:7, stun:.5, heavy:true, launch:5 }); }
        } else this.vx = 0;
        if (s.t >= .65) this.endSpecial();
        break;
      case 'divekick':
        if (!s.fired) { s.fired = true; this.vy = 13; this.vx = F * 2; }
        if (!s.dived && s.t > .36) { s.dived = true; this.vy = -15; this.vx = F * 13; floater('NYOOOM!', this.x, this.y + 2, { color:'#fff', size:28 }); }
        if (s.dived && !s.hit && close(1.3, 2)) { s.hit = true; applyHit(this, o, { dmg:s.dmg, knock:6, stun:.5, heavy:true, hy:1.5 }); }
        if ((s.dived && this.y <= 0 && s.t > .45) || s.t > 1.6) { this.squash = .25; this.endSpecial(); }
        break;
      case 'blast':
        if (!s.fired && s.t >= .2) {
          s.fired = true; game.shake(.15);
          const bx = this.x + F * 1.3, by = this.y + 1.8;
          if (s.fx === 'fizz') { sparks(bx, by, 0x5a3418, 18, 9, .6); sparks(bx, by, 0xf4efe4, 12, 7, .5); floater('FSSSSHHH!', bx, by + .6, { color:'#d8b48a', size:30 }); }
          else { ringFx(bx, by, 0xff4d4d, false, 7); floater('FAKE NEWS!', bx, by + .6, { color:'#ff6b6b', size:34 }); }
          if (dx > -.2 && dx < 3 && Math.abs(o.y - this.y) < 2) applyHit(this, o, { dmg:s.dmg, knock:12, stun:.55, heavy:true });
        }
        if (s.t >= .55) this.endSpecial();
        break;
      case 'slam':
        if (!s.fired && s.t >= .32) {
          s.fired = true; game.shake(.3); sfx.thud();
          ringFx(this.x + F * 1.3, .1, 0xffd23f, true, 8);
          floater('ORDER!', this.x + F * 1.5, 2.6, { color:'#ffd23f', size:40 });
          if (dx > -.4 && dx < 3.4 && o.y < .5) applyHit(this, o, { dmg:s.dmg, knock:6, launch:8, stun:.6, heavy:true });
        }
        if (s.t >= .7) this.endSpecial();
        break;
      case 'pull':
        if (!this.belt) { this.belt = new THREE.Mesh(new THREE.BoxGeometry(1, .09, .09), toon(0x5a3418)); outline(this.belt, .02); scene.add(this.belt); }
        {
          const reach = s.t < .3 ? s.t / .3 * 6 : s.caught ? Math.abs(o.x - this.x) - .3 : Math.max(0, 6 - (s.t - .3) * 20);
          if (!s.caught && s.t >= .1 && s.t < .3 && dx > 0 && dx < reach && Math.abs(o.y - this.y) < 1.5 && o.state !== 'ko') {
            if (o.state === 'block') { s.t = .3; floater('NO DEAL!', o.x, 3, { color:'#8fd3ff' }); sfx.block(); }
            else { s.caught = true; s.ct = s.t; o.state = 'hit'; o.stateT = 0; o.stunDur = .6; floater('YOINK!', o.x, 3, { color:'#ffd23f', size:32 }); }
          }
          if (s.caught) {
            o.x = damp(o.x, this.x + F * 1.1, 14, dt);
            if (!s.hit && s.t - s.ct > .25) { s.hit = true; applyHit(this, o, { dmg:s.dmg, knock:4, launch:7, stun:.6, heavy:true, unblockable:true }); }
          }
          const len = Math.max(.01, reach);
          this.belt.scale.x = len; this.belt.position.set(this.x + F * (.5 + len / 2), this.y + 1.6, .3);
        }
        if ((!s.caught && s.t > .6) || (s.hit && s.t - s.ct > .45)) this.endSpecial();
        break;
      case 'teleport':
        if (s.t < .25) { this.vanish = s.t / .25; this.vx = -F * 4; }
        else if (!s.fired) {
          s.fired = true; sparks(this.x, 1.5, 0xffffff, 10, 3);
          floater('SEE YA!', this.x, 3, { color:'#fff', size:30 });
          const side = o.x >= this.x ? 1 : -1;
          this.x = clamp(o.x + side * 1.1, -BOUND, BOUND); this.facing = o.x >= this.x ? 1 : -1; this.vx = 0;
        } else this.vanish = Math.max(0, 1 - (s.t - .25) / .12);
        if (s.t > .42 && !s.hit) { s.hit = true; if (close(1.7)) applyHit(this, o, { dmg:s.dmg, knock:8, stun:.5, heavy:true }); }
        if (s.t >= .75) this.endSpecial();
        break;
      case 'rush':
        if (!this.vehicle) { this.vehicle = trainMesh(this.def.color); this.vehicle.position.set(F * .6, 0, 0); this.vehicle.scale.x = F; this.root.add(this.vehicle); floater('CHOO CHOO!', this.x, 3.4, { color:'#fff', size:34 }); }
        if (!s.hit && s.t < 1.1) {
          this.vx = F * 17;
          if (close(1.9, 2)) { s.hit = true; s.ht = s.t; applyHit(this, o, { dmg:s.dmg, knock:15, launch:9, stun:1, heavy:true, chip:.3, super:true }); }
          if (Math.abs(this.x) >= BOUND - .05) s.t = 1.1;
        } else this.vx = damp(this.vx, 0, 10, dt);
        if ((s.hit && s.t - s.ht > .35) || s.t > 1.4) this.endSpecial();
        break;
      case 'drop': case 'eruption': case 'hole': case 'rain': case 'launch': case 'heal':
        if (!s.fired && s.t >= .15) {
          s.fired = true;
          ({ drop:() => fxDrop(this, o.x), eruption:() => fxEruption(this, o.x), hole:() => fxHole(this, o.x), rain:() => fxRain(this),
             launch:() => { sfx.thud(); game.shake(.2); fxPillar(this, o.x); }, heal:() => fxHeal(this) })[s.kind]();
        }
        if (s.t >= .65) this.endSpecial();
        break;
    }
  }

  animate(dt) {
    const s = this.state, t = this.t, d = this.def, id = d.id;
    let p, mouth = .25, k = 22, flip = 0, ko = 0;
    switch (s) {
      case 'idle': p = idlePose(id, t); break;
      case 'walk': p = walkPose(id, this.walkPh); break;
      case 'dash': p = mkPose({ lean:-.38 * (this.dashDir === this.facing ? 1 : -1), aFs:.3, aFe:1.2, aBs:-.4, aBe:1, lFh:.8, lFk:.7, lBh:-.6, lBk:.4, py:-.06 }); k = 30; break;
      case 'jump':
        p = mkPose({ lFh:1.1, lFk:1.5, lBh:.4, lBk:1.4, aFs:1.7, aFe:1.4, aBs:1.3, aBe:1.6, lean:-.12 });
        if (this.flipDir) flip = flipAngle(this.stateT, this.airT) * this.flipDir;
        break;
      case 'block': p = guardPose(this.guard); k = 30; break;
      case 'hit': p = hitPose(this.hitH, this.hitDir, this.stateT); mouth = 1; k = 30; break;
      case 'stunned': p = layer(hitPose('mid', 1, .4), mkPose({ lean:.15 + Math.sin(t * 6) * .12, head:Math.sin(t * 5) * .3 }), 1); mouth = .8; break;
      case 'hole': p = mkPose({ aFs:2.9, aBs:2.9, aFe:.2, aBe:.2 }); mouth = 1; break;
      case 'thrown': p = hitPose('high', -1, 0); mouth = 1; k = 30; break;
      case 'ko': { // ragdoll-ish fall: tips over, bounces, settles (26)
        this.koB ??= koBody(1);
        const ev = koStep(this.koB, dt);
        if (ev && ev.speed > .8) { dust(this.x, .4 + ev.speed * .06, 6); sfx.thud(); game.shake(.06 + ev.speed * .02); }
        ko = this.koB.angle; p = mkPose({ aFs:2.2, aFe:.4, aBs:2.6, aBe:.3, lFh:.3, lFk:.2, lBh:-.1, lBk:.1, head:-.2 }); mouth = 1; k = 30;
        break;
      }
      case 'down': { // knocked down: lie flat, then get up, or roll (27)
        const w = wakeup(this.stateT, this.rollDir);
        ko = w.phase === 'down' ? Math.PI / 2 : w.phase === 'getup' ? Math.PI / 2 * (1 - w.k) : 0;
        if (w.phase === 'roll') flip = -w.k * Math.PI * 2 * Math.sign(this.rollDir * this.facing);
        p = w.phase === 'roll' ? mkPose({ lFh:1.6, lFk:2, lBh:1.4, lBk:2, aFs:2, aBs:2, aFe:2, aBe:2, py:.3 }) : mkPose({ aFs:1.2, aBs:.8, lFk:.4, lBk:.3 });
        mouth = .6; k = 30;
        break;
      }
      case 'victory': p = (VICTORY[id] ?? VICTORY.luxon)[this.vIdx % 2](t); mouth = .9; break;
      case 'lose': p = loserPose(t); break;
      case 'taunt': p = tauntPose(this.stateT); mouth = .9; break;
      case 'throw': p = throwPose(this.stateT); mouth = .9; k = 30; break;
      case 'intro': p = INTROS[id] ? INTROS[id].pose(this.stateT) : idlePose(id, t); break;
      case 'attack': { // anticipation, strike, follow-through (22) with a motion trail (35)
        const a = this.atk; p = attackPose(a.type, a.t, a.d); mouth = .8; k = 40;
        if (this.y > .05) { p.lBh = .7; p.lBk = 1.2; if (a.type === 'punch') { p.lFh = 1; p.lFk = 1.3; } }
        if (!a.trail && a.t >= a.d.s) { a.trail = true; trail(this, a.type === 'kick' ? this.legF : this.armF, a.type === 'kick' ? .3 : .4, a.type === 'kick' ? 1.8 : 1.7); }
        break;
      }
      case 'special': {
        const sp = this.sp, w = sp.t < .2;
        let aF = Math.PI / 2 + .4, aB = .3, lF = GUARD.lFh, lB = GUARD.lBh, lean = -.1, py = GUARD.py, aFe = .35, aBe = .5;
        switch (sp.kind) {
          case 'projectile': case 'bigwave': aF = w ? 2.7 : Math.PI / 2; aB = w ? .2 : 1; lean = w ? .2 : -.25; aFe = w ? 1.2 : .05; break;
          case 'dash': aF = 1.6; aB = 1.6; lF = sp.bike ? Math.sin(t * 30) * .6 + .6 : .4; lB = sp.bike ? -Math.sin(t * 30) * .6 + .6 : -.4; lean = -.2; break;
          case 'divekick': aF = Math.PI / 2; aB = Math.PI / 2; lF = sp.dived ? 1.3 : .4; lB = .2; lean = sp.dived ? .5 : -.1; break;
          case 'blast': aF = w ? 2.2 : Math.PI / 2; aB = w ? 2 : Math.PI / 2; lean = w ? .15 : -.3; aFe = w ? 1.6 : .05; aBe = w ? 1.6 : .1; break;
          case 'slam': aF = sp.t < .3 ? 3.1 : .8; aB = .3; lean = sp.t < .3 ? .25 : -.4; py = sp.t < .3 ? .1 : -.1; aFe = sp.t < .3 ? .8 : .1; break;
          case 'pull': aF = Math.PI / 2; aB = sp.caught ? 1.8 : .8; lean = sp.caught ? .25 : -.15; aFe = sp.caught ? 1.6 : .05; break;
          case 'teleport': aF = .2; aB = .2; lean = -.1; break;
          case 'rush': { const ph = Math.sin(t * 22); lF = ph * .8; lB = -ph * .8; aF = 1.5; aB = -.8; lean = -.45; break; }
          case 'heal': aF = Math.PI; aB = Math.PI; py = .15; aFe = .2; aBe = .2; break;
        }
        p = mkPose({ aFs:aF, aFe, aBs:aB, aBe, lFh:lF, lBh:lB, lean, py }); mouth = 1; k = 30;
        break;
      }
      default: p = { ...GUARD };
    }
    if (mouth < .5 && Math.sin(t * 1.7) > .97) mouth = .6;

    // ease every joint toward the target pose, then drive the rig
    const cp = this.cp, prevA = cp.aFs, prevL = cp.lFh;
    for (const j of JOINTS) cp[j] = damp(cp[j], p[j], k, dt);
    this.armF.rotation.z = cp.aFs; this.armB.rotation.z = cp.aBs;
    this.legF.rotation.z = cp.lFh; this.legB.rotation.z = cp.lBh;
    if (this.armF.elbow) {
      this.armF.elbow.rotation.z = cp.aFe; this.armB.elbow.rotation.z = cp.aBe;
      this.legF.elbow.rotation.z = -cp.lFk; this.legB.elbow.rotation.z = -cp.lBk;
      // keep the shoes level with the ground; the toe flexes on push-off (11)
      const flat = this.y <= .05 ? 1 : .5;
      this.legF.foot.rotation.z = -(cp.lFh - cp.lFk) * flat + Math.max(0, -cp.lFh) * .5;
      this.legB.foot.rotation.z = -(cp.lBh - cp.lBk) * flat + Math.max(0, -cp.lBh) * .5;
    }
    // smears: a fast-moving limb stretches (35)
    const atkLeg = s === 'attack' && this.atk.type === 'kick', w = ((atkLeg ? cp.lFh - prevL : cp.aFs - prevA) / Math.max(dt, 1e-3));
    const st = atkLeg ? this.legF : this.armF, other = atkLeg ? this.armF : this.legF;
    st.scale.y = damp(st.scale.y, s === 'attack' ? smearStretch(w) : 1, 30, dt);
    other.scale.y = damp(other.scale.y, 1, 30, dt);
    this.pose.rotation.z = cp.lean + ko;
    this.pose.rotation.y = cp.twist * .6;
    this.pose.position.y = -FLIP_Y + cp.py + .38 * ko / (Math.PI / 2);
    this.flipG.rotation.z = -flip;
    this.head.rotation.z = -cp.head;
    // secondary motion: hair and tie lag behind the body (36)
    if (this.hairPivot) this.hairPivot.rotation.z = this.hairSpring.step(clamp(-this.vx * .02 + this.vy * .012, -.25, .25), dt);
    if (this.tiePivot) this.tiePivot.rotation.z = this.tieSpring.step(clamp(-this.vx * .05 - cp.lean * .8 + this.vy * .02, -.7, .7), dt);
    this.mouth.scale.y = damp(this.mouth.scale.y, .5 + mouth * 2.4, 20, dt);
    if (this.faces) {
      const tx = this.faces[['hit', 'stunned', 'ko', 'hole', 'thrown', 'down'].includes(s) ? 'hurt' : mouth > .7 ? 'open' : 'n'];
      if (this.faceMat.map !== tx) this.faceMat.map = tx;
    }
    this.stars.visible = s === 'stunned'; this.stars.rotation.y += dt * 6;
    if (this.crown.visible) this.crown.rotation.y += dt * 1.5;
    this.yaw.scale.x = this.facing;
    // turning round swings through 180 degrees instead of snapping (39)
    this.yaw.rotation.y = -.55 * this.facing + this.spin + (this.turnT < TURN_TIME ? Math.PI - turnAngle(this.turnT) : 0);
    const fl = this.flash > 0 ? .8 : 0;
    for (const m of this.mats) m.emissive.setScalar(fl);
    this.squash = damp(this.squash, 0, 9, dt);
    const h = d.build.h, sq = this.squash, vs = 1 - this.vanish;
    const v = Math.max(.01, vs);
    this.root.scale.set(h * (1 + sq) * v, h * (1 - sq) * v, h * (1 + sq) * v);
    this.root.position.set(this.x, this.y, 0);
  }
}

// =====================================================================

export { ATK, COOL, G_CAP, FACES, faceCache, faceSet, paintFace, Fighter };
