// The fighters' finishing touches: painted hair, face decals (irises that track, animated
// brows, a lip-sync mouth, sweat / vein / blush), signature props, rosettes, costume extras,
// warm skin shadows, contact shadows and glow sprites.
import * as THREE from 'three';
import { SIGNATURE, browPose, eyeLook, moodDecals, visemes } from './charlogic.js';
import { toon } from './kit.js';

const canvasTex = (w, h, draw) => { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; };
const INK = '#2a201c';

// ---- 2: painted hair: ink strands and highlight streaks, projected round the head
function hairTexture(seed = 1) {
  let s = seed * 9301 + 49297; const r = () => (s = (s * 9301 + 49297) % 233280) / 233280;
  return canvasTex(512, 256, (g, W, H) => {
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, W, H); g.lineCap = 'round';
    for (let i = 0; i < 260; i++) { // clumps of strands flowing down and back
      const x = r() * W, y = r() * H * .7, l = 40 + r() * 120, c = r();
      g.strokeStyle = c < .7 ? `rgba(40,25,20,${.25 + r() * .35})` : `rgba(255,255,255,${.4 + r() * .4})`; g.lineWidth = c < .7 ? 2 + r() * 3 : 3 + r() * 4;
      g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + (r() - .5) * 30, y + l * .5, x + (r() - .5) * 50, y + l); g.stroke();
    }
    g.strokeStyle = 'rgba(30,20,15,.55)'; g.lineWidth = 6; for (let i = 0; i < 18; i++) { const x = r() * W; g.beginPath(); g.moveTo(x, 0); g.quadraticCurveTo(x + 20, H * .5, x - 10, H); g.stroke(); }
  });
}
function projectSphereUV(geo) { // cylindrical-ish projection round the head
  if (geo.userData.hairUV) return; const P = geo.attributes.position, uv = new Float32Array(P.count * 2);
  for (let i = 0; i < P.count; i++) { uv[i * 2] = Math.atan2(P.getZ(i), P.getX(i)) / (Math.PI * 2) + .5; uv[i * 2 + 1] = .5 + P.getY(i) / 1.6; }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); geo.userData.hairUV = true;
}

// ---- 12: per-fighter warm skin shadow
function withSkinShadow(m, rgb) {
  const prev = m.onBeforeCompile, tint = { value:new THREE.Color(...rgb) };
  m.userData.skinShadow = rgb;
  m.onBeforeCompile = sh => { prev?.call(m, sh); sh.uniforms.uShadowTint = tint; };
  return m;
}

// ---- face decals placed on the sculpted head by raycasting from the front
const ray = new THREE.Raycaster(), _o = new THREE.Vector3(), _d = new THREE.Vector3(-1, 0, 0);
function surface(skinMesh, y, z) {
  ray.set(_o.set(2, y, z), _d); const h = ray.intersectObject(skinMesh, false)[0];
  return h ? { p:h.point.clone(), n:h.face.normal.clone() } : { p:new THREE.Vector3(.55, y, z), n:new THREE.Vector3(1, 0, 0) };
}
function onSurface(obj, at, lift = .006) { obj.position.copy(at.p).addScaledVector(at.n, lift); obj.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), at.n); return obj; }
const flat = (geo, color, o = {}) => { const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, transparent:o.t, opacity:o.op ?? 1, depthWrite:false, polygonOffset:true, polygonOffsetFactor:-2 })); m.renderOrder = 3; return m; };
const sprite = (tex, s) => { const m = new THREE.Sprite(new THREE.SpriteMaterial({ map:tex, transparent:true, depthWrite:false })); m.scale.setScalar(s); return m; };

function buildFaceRig(f, skinMesh, head, F) {
  skinMesh.updateMatrixWorld(true);
  const rig = { base:[], irises:[], brows:[], decals:{} };
  // irises (14): coloured disc + pupil + catch-light, moved in the plane of the face
  for (const z of [.2, -.2]) {
    const at = surface(skinMesh, .05, z), g = onSurface(new THREE.Group(), at, .008);
    const iris = flat(new THREE.CircleGeometry(.04, 20), new THREE.Color(F.eye)); g.add(iris);
    const pupil = flat(new THREE.CircleGeometry(.021, 16), 0x0d0a08); pupil.position.z = .001; g.add(pupil);
    const glint = flat(new THREE.CircleGeometry(.009, 10), 0xffffff); glint.position.set(-.012, .012, .002); g.add(glint);
    head.add(g); rig.irises.push(g); rig.base.push(g.position.clone());
  }
  // brows (15): an inked tapered wedge you can raise and furrow
  for (const [z, side] of [[.2, 1], [-.2, -1]]) {
    const sh = new THREE.Shape(); sh.moveTo(-.1, 0); sh.quadraticCurveTo(0, .045, .1, .01); sh.quadraticCurveTo(0, .02, -.1, -.03); sh.closePath();
    const at = surface(skinMesh, .21, z), g = onSurface(new THREE.Group(), at, .01);
    const ink = flat(new THREE.ShapeGeometry(sh), 0x111111); ink.scale.setScalar(1.18);
    const fill = flat(new THREE.ShapeGeometry(sh), new THREE.Color(F.brow)); fill.position.z = .001;
    const b = new THREE.Group(); b.add(ink, fill); b.scale.x = side * (F.bw / 9); b.userData.side = side; g.add(b);
    head.add(g); rig.brows.push(b); g.userData.baseY = g.position.y;
  }
  // talking mouth (16): a skin patch over the painted mouth with a mouth shape on top
  { const at = surface(skinMesh, -.3, 0), g = onSurface(new THREE.Group(), at, .009);
    const patch = flat(new THREE.CircleGeometry(.1, 24), new THREE.Color(f.def.skin)); patch.scale.set(1.5, .7, 1);
    const mouth = flat(new THREE.CircleGeometry(.06, 24), 0x4a1414); mouth.position.z = .001;
    const teeth = flat(new THREE.PlaneGeometry(.1, .025), 0xfbf8f0); teeth.position.set(0, .03, .002);
    g.add(patch, mouth, teeth); g.visible = false; head.add(g); rig.mouth = { g, mouth, teeth }; }
  // mood decals (17)
  const dropT = canvasTex(64, 96, (q) => { q.fillStyle = '#8fd3ff'; q.strokeStyle = INK; q.lineWidth = 5; q.beginPath(); q.moveTo(32, 6); q.quadraticCurveTo(60, 60, 32, 88); q.quadraticCurveTo(4, 60, 32, 6); q.fill(); q.stroke(); q.fillStyle = '#fff'; q.beginPath(); q.arc(24, 56, 7, 0, 7); q.fill(); });
  const veinT = canvasTex(96, 96, (q) => { q.strokeStyle = '#d0101e'; q.lineWidth = 10; q.lineCap = 'round'; for (const [a, b, c, d] of [[18, 30, 42, 44], [78, 30, 54, 44], [18, 66, 42, 52], [78, 66, 54, 52]]) { q.beginPath(); q.moveTo(a, b); q.quadraticCurveTo(48, 48, c, d); q.stroke(); } });
  rig.decals.sweat = sprite(dropT, .22); rig.decals.sweat.position.set(.15, .42, .55);
  rig.decals.vein = sprite(veinT, .26); rig.decals.vein.position.set(.3, .52, .3);
  rig.decals.blush = new THREE.Group();
  for (const z of [.27, -.27]) { const b = onSurface(flat(new THREE.CircleGeometry(.07, 18), 0xff6a6a, { t:true, op:.45 }), surface(skinMesh, -.12, z), .009); b.scale.set(1.4, .7, 1); rig.decals.blush.add(b); }
  for (const d of Object.values(rig.decals)) { d.visible = false; head.add(d); }
  return rig;
}
// per frame: eyes, brows, mouth, decals
const MOUTHS = { A:[1, 1.1], E:[1.25, .45], O:[.7, .9], U:[.5, .6], F:[1, .3], M:[1.1, .06], rest:[.8, .1] };
function updateFaceRig(f, rig, dt, face) {
  const shut = face === 'hurt';
  // eyes toward the opponent's head (in head space)
  let look = { x:0, y:0 };
  if (f.opp) { const v = f.head.worldToLocal(new THREE.Vector3(f.opp.x, f.opp.y + 2.5, 0)); look = eyeLook(-v.z * .8, (v.y) * 1.2); }
  rig.irises.forEach((g, i) => { g.visible = !shut; g.position.copy(rig.base[i]); g.position.z += -look.x; g.position.y += look.y * .6; });
  // brows
  const bp = browPose(f.state);
  for (const b of rig.brows) { const side = b.userData.side; b.rotation.z = (bp.furrow * -.45 + bp.raise * .2) * side; b.parent.position.y = b.parent.userData.baseY + bp.raise * .05 - bp.furrow * .02; }
  // lip-sync
  const m = rig.mouth;
  if (f.talk) {
    f.talk.t += dt; const step = f.talk.vis.find((v, i) => f.talk.t >= v.t && (i === f.talk.vis.length - 1 || f.talk.t < f.talk.vis[i + 1].t)) ?? f.talk.vis.at(-1);
    f.mouthShape = f.talk.t > f.talk.dur ? 'rest' : step.shape;
    const [sx, sy] = MOUTHS[f.mouthShape] ?? MOUTHS.rest; m.mouth.scale.set(sx, sy, 1); m.teeth.visible = sy > .3; m.g.visible = !shut && f.talk.t <= f.talk.dur;
    if (f.talk.t > f.talk.dur) f.talk = null;
  } else m.g.visible = false;
  // mood decals
  const on = moodDecals(f);
  for (const k in rig.decals) rig.decals[k].visible = on.includes(k);
  if (rig.decals.sweat.visible) rig.decals.sweat.position.y = .42 - ((f.t * .6) % .35);
}
function speak(f, text) { const vis = visemes(text); f.talk = { vis, t:0, dur:(vis.at(-1)?.t ?? 0) + .25 }; }

// ---- 7 + 10: signature props and rosettes
const PROP_STATES = { can:['idle', 'intro', 'victory'], phone:['idle', 'intro', 'taunt'], calculator:['idle', 'intro'] };
function signatureProp(f, M) {
  const kind = SIGNATURE[f.def.id], g = new THREE.Group(); g.userData.signature = kind;
  const add = (geo, c, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, M(c)); m.position.set(x, y, z); m.castShadow = true; g.add(m); return m; };
  switch (kind) {
    case 'watch': add(new THREE.CylinderGeometry(.075, .075, .035, 16), 0x222222); add(new THREE.CylinderGeometry(.045, .045, .04, 16), 0xd9b44a, .02).rotation.z = Math.PI / 2; return { g, mount:'wristB' };
    case 'can': add(new THREE.CylinderGeometry(.06, .06, .2, 16), 0xd8d8dc, .06, -.14); add(new THREE.CylinderGeometry(.061, .061, .06, 16), 0xc8102e, .06, -.14); return { g, mount:'handF' };
    case 'phone': add(new THREE.BoxGeometry(.03, .19, .1), 0x111111, .06, -.15); return { g, mount:'handB' };
    case 'calculator': add(new THREE.BoxGeometry(.03, .16, .12), 0x3a3a3a, .06, -.15); add(new THREE.BoxGeometry(.032, .05, .1), 0x9fd0a0, .06, -.1); return { g, mount:'handB' };
    case 'pocketsquare': { const s = new THREE.Shape(); s.moveTo(-.06, 0); s.lineTo(.06, 0); s.lineTo(.02, .06); s.lineTo(-.02, .08); s.closePath();
      const m = add(new THREE.ShapeGeometry(s), 0xffffff); m.material.side = THREE.DoubleSide; m.rotation.y = Math.PI / 2; return { g, mount:'chest' }; }
    case 'glitterpin': add(new THREE.OctahedronGeometry(.045), 0xffe14a); return { g, mount:'lapel' };
    default: return null; // hatband and gavel are already part of the model
  }
}
function rosette(color, M) {
  const g = new THREE.Group(); g.userData.rosette = true;
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(.055, .055, .012, 16), M(color)); disc.rotation.z = Math.PI / 2; g.add(disc);
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(.025, .025, .016, 12), M(0xffffff)); hub.rotation.z = Math.PI / 2; hub.position.x = .004; g.add(hub);
  for (const s of [-1, 1]) { const r = new THREE.Mesh(new THREE.BoxGeometry(.01, .09, .025), M(color)); r.position.set(0, -.07, s * .018); r.rotation.x = s * .25; g.add(r); }
  return g;
}

// ---- 72: soft contact shadow under each fighter
const blobTex = canvasTex(128, 128, (g) => { const gr = g.createRadialGradient(64, 64, 4, 64, 64, 62); gr.addColorStop(0, 'rgba(0,0,0,.55)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); });
function contactShadow() {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 1.8), new THREE.MeshBasicMaterial({ map:blobTex, transparent:true, depthWrite:false }));
  m.rotation.x = -Math.PI / 2; m.renderOrder = 1; return m;
}
// ---- 75: additive glow (cheap selective bloom for supers)
const glowTex = canvasTex(128, 128, (g) => { const gr = g.createRadialGradient(64, 64, 2, 64, 64, 62); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.35, 'rgba(255,255,255,.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); });
function glowSprite(color, size) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map:glowTex, color, transparent:true, blending:THREE.AdditiveBlending, depthWrite:false })); s.scale.setScalar(size); s.userData.glow = true; return s;
}

export { hairTexture, projectSphereUV, withSkinShadow, buildFaceRig, updateFaceRig, speak, PROP_STATES, signatureProp, rosette, contactShadow, glowSprite };
