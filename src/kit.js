import * as THREE from 'three';

// Cel-shading: 3-step gradient + ink outlines
const gradTex = (() => {
  const t = new THREE.DataTexture(new Uint8Array([105, 160, 215, 255]), 4, 1, THREE.RedFormat);
  t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true; return t;
})();
function toon(color, o = {}) {
  const m = new THREE.MeshToonMaterial({ color, gradientMap:gradTex, emissive:o.emissive ?? 0, emissiveIntensity:o.ei ?? 1, vertexColors:!!o.vc,
    transparent:o.opacity != null, opacity:o.opacity ?? 1, side:o.side ?? THREE.FrontSide, depthWrite:o.opacity == null || o.opacity > .9 });
  return o.halftone === false ? m : halftone(m);
}
// one look shared by every toon material: warm shadows, cool highlights (71), tinted per arena (74)
const LOOK = {
  uShadowTint:{ value:new THREE.Color().setHex(0xffb08a, THREE.LinearSRGBColorSpace) },
  uHighTint:{ value:new THREE.Color().setHex(0xe4eeff, THREE.LinearSRGBColorSpace) },
};
const setShadowTint = hex => LOOK.uShadowTint.value.setHex(hex, THREE.LinearSRGBColorSpace);
// print-style halftone dots, in screen space, only where the lighting puts the surface in shadow (47)
const HALFTONE = /* glsl */`
  { // halftone
    float htShade = dot(outgoingLight, vec3(.299, .587, .114)) / max(.002, dot(diffuseColor.rgb, vec3(.299, .587, .114)));
    outgoingLight *= mix(uShadowTint, vec3(1.), smoothstep(.3, .85, htShade)); // warm shadows
    outgoingLight = mix(outgoingLight, outgoingLight * uHighTint, smoothstep(.9, 1.2, htShade) * .6); // cool highlights
    vec2 htP = mat2(.707, -.707, .707, .707) * gl_FragCoord.xy / uDot;
    float htD = length(fract(htP) - .5), htR = clamp((.66 - htShade) * 1.1, 0., .48);
    outgoingLight *= 1. - .38 * (1. - smoothstep(htR - .07, htR, htD)) * step(htShade, .66);
  }
  #include <opaque_fragment>`;
function halftone(m) {
  m.onBeforeCompile = sh => {
    sh.uniforms.uDot = { value:4.5 * (globalThis.devicePixelRatio ?? 1) }; sh.uniforms.uShadowTint = LOOK.uShadowTint; sh.uniforms.uHighTint = LOOK.uHighTint;
    sh.fragmentShader = sh.fragmentShader.replace('void main() {', 'uniform float uDot;\nuniform vec3 uShadowTint, uHighTint;\nvoid main() {').replace('#include <opaque_fragment>', HALFTONE);
  };
  m.customProgramCacheKey = () => 'halftone';
  return m;
}
// woven fabrics drawn in object space (6): pinstripe, check, twill, hi-vis bands, floral, trouser crease
const PATTERNS = {
  pinstripe:'diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb + .45, step(.93, fract(vPat.z * 16.)) * .7);',
  check:'{ vec2 q = fract(vPat.zy * 6.); float l = max(step(.88, q.x), step(.88, q.y)); diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 1.35 + .04, l * .55); diffuseColor.rgb *= 1. - .08 * step(.5, fract(vPat.z * 3.)) * step(.5, fract(vPat.y * 3.)); }',
  twill:'diffuseColor.rgb *= 1. - .06 * step(.5, fract((vPat.y + vPat.z) * 40.));',
  hivis:'{ float b = step(.85, fract(vPat.y * 2.2 + .1)); diffuseColor.rgb = mix(diffuseColor.rgb, vec3(.85, .88, .9), b); }',
  floral:'{ vec2 q = fract(vPat.zy * 5.) - .5; float pet = smoothstep(.2, .15, length(q) * (1. + .5 * sin(atan(q.y, q.x) * 5.))); diffuseColor.rgb = mix(diffuseColor.rgb, vec3(1., .9, .3), pet * .8); }',
  crease:'diffuseColor.rgb *= 1. - .25 * (1. - smoothstep(.0, .03, abs(fract(vUvPat.x * 2. + .25) - .5) - .0));',
};
// All woven fabrics share one shader program, picked per material by uPat, so they don't each
// compile at boot. The trouser crease needs UVs (sculpted parts have none), so it's its own program.
const PATTERN_IDS = ['pinstripe', 'check', 'twill', 'hivis', 'floral', 'crease'];
const FABRIC = PATTERN_IDS.slice(0, 5).map((k, i) => `${i ? 'else ' : ''}if (uPat == ${i}) { // pattern: ${k}\n  ${PATTERNS[k]}\n  }`).join('\n  ');
function withPattern(m, kind) {
  if (!kind || !PATTERNS[kind]) return m;
  const prev = m.onBeforeCompile, key = m.customProgramCacheKey?.() ?? '', uvs = kind === 'crease';
  const uPat = { value:PATTERN_IDS.indexOf(kind) }; m.userData.pattern = kind;
  m.onBeforeCompile = sh => {
    prev?.call(m, sh); sh.uniforms.uPat = uPat;
    const vary = `varying vec3 vPat;\n${uvs ? 'varying vec2 vUvPat;\n' : ''}`;
    sh.vertexShader = sh.vertexShader.replace('void main() {', `${vary}void main() {\n  vPat = position;${uvs ? ' vUvPat = uv;' : ''}`);
    sh.fragmentShader = sh.fragmentShader.replace('void main() {', `${vary}uniform int uPat;\nvoid main() {`)
      .replace('#include <color_fragment>', `#include <color_fragment>\n  ${uvs ? `// pattern: crease\n  ${PATTERNS.crease}` : FABRIC}`);
  };
  m.customProgramCacheKey = () => key + (uvs ? '-crease' : '-fabric');
  return m;
}
// fresnel rim light in a given colour (73: arena sky, 13: party colour); m.userData.rim updates it
function withRim(m, rgb) {
  const prev = m.onBeforeCompile, key = m.customProgramCacheKey?.() ?? '';
  const rim = m.userData.rim = { value:new THREE.Vector3(...rgb) };
  m.onBeforeCompile = sh => {
    prev?.call(m, sh); sh.uniforms.uRim = rim;
    sh.fragmentShader = sh.fragmentShader.replace('void main() {', 'uniform vec3 uRim;\nvoid main() {').replace('#include <opaque_fragment>',
      '{ float rimK = pow(1. - abs(dot(normalize(normal), normalize(vViewPosition))), 3.); outgoingLight += uRim * rimK * .5; }\n#include <opaque_fragment>');
  };
  m.customProgramCacheKey = () => key + '-rim';
  return m;
}
const OL = new THREE.MeshBasicMaterial({ color:0x000000, side:THREE.BackSide });
const _s = new THREE.Vector3(), _c = new THREE.Vector3();
function outline(m, t = .035) {
  const g = m.geometry; if (!g.boundingBox) g.computeBoundingBox();
  g.boundingBox.getSize(_s); g.boundingBox.getCenter(_c);
  const f = v => v < 1e-3 ? 1 : (v + 2 * t) / v;
  const o = new THREE.Mesh(g, OL);
  o.scale.set(f(_s.x), f(_s.y), f(_s.z));
  o.position.set(_c.x * (1 - o.scale.x), _c.y * (1 - o.scale.y), _c.z * (1 - o.scale.z));
  m.add(o); return m;
}
const inkMats = {};
// black back-face hull pushed out along the normals (shared per thickness; works on skinned meshes too)
function inkMaterial(t) {
  return inkMats[t] ??= (() => {
    const k = new THREE.MeshBasicMaterial({ color:0x000000, side:THREE.BackSide });
    // brush: the stroke swells and thins smoothly along the surface rather than a constant width (48)
    k.onBeforeCompile = sh => { sh.vertexShader = sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
float brush = .7 + .5 * (.5 + .5 * sin(position.x * 9. + position.y * 7. + position.z * 11.));
transformed += normalize(normal) * ${t.toFixed(4)} * brush;`); };
    k.customProgramCacheKey = () => 'ink' + t; return k;
  })();
}
function ink(m, t) { m.add(new THREE.Mesh(m.geometry, inkMaterial(t))); return m; }
function disposeObj(o) {
  o.traverse(n => {
    if (!n.isMesh && !n.isPoints) return;
    if (!n.geometry?.userData.shared) n.geometry?.dispose();
    (Array.isArray(n.material) ? n.material : [n.material]).forEach(m => {
      if (m && m !== OL && !Object.values(inkMats).includes(m)) { m.map?.dispose(); m.dispose(); }
    });
  });
}

// prop helpers: (parent, ...dims, color, x, y, z, opts)
function place(p, m, x, y, z, o) {
  m.position.set(x, y, z); m.castShadow = o.cast !== false; m.receiveShadow = true;
  if (o.ry) m.rotation.y = o.ry; if (o.rx) m.rotation.x = o.rx; if (o.rz) m.rotation.z = o.rz;
  if (o.ol !== false) outline(m, o.olw ?? .06);
  p.add(m); return m;
}
const BOX = (p, w, h, d, c, x, y, z, o = {}) => place(p, new THREE.Mesh(new THREE.BoxGeometry(w, h, d), o.mat ?? toon(c, o)), x, y, z, o);
const CYL = (p, rt, rb, h, c, x, y, z, o = {}) => place(p, new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, o.seg ?? 24, 1, o.open ?? false), toon(c, o)), x, y, z, o);
const SPH = (p, r, c, x, y, z, o = {}) => place(p, new THREE.Mesh(new THREE.SphereGeometry(r, o.seg ?? 18, o.seg2 ?? 12), toon(c, o)), x, y, z, o);
const CONE = (p, r, h, c, x, y, z, o = {}) => place(p, new THREE.Mesh(new THREE.ConeGeometry(r, h, o.seg ?? 20), toon(c, o)), x, y, z, o);
function PRISM(p, w, h, d, c, x, y, z, o = {}) { // gable roof: triangle (w x h) extruded d along z
  const s = new THREE.Shape(); s.moveTo(-w / 2, 0); s.lineTo(w / 2, 0); s.lineTo(0, h); s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth:d, bevelEnabled:false }); g.translate(0, 0, -d / 2);
  return place(p, new THREE.Mesh(g, toon(c, o)), x, y, z, o);
}
function ground(p, c, size = 400) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), toon(c)); m.rotation.x = -Math.PI / 2; m.receiveShadow = true; p.add(m); return m;
}
function water(p, c, y = -.5, size = 600) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size, 1, 1), new THREE.MeshToonMaterial({ color:c, gradientMap:gradTex }));
  m.rotation.x = -Math.PI / 2; m.position.y = y; m.receiveShadow = true; p.add(m); return m;
}
function mountain(p, x, z, r, h, c, snow = 0, seg = 7) {
  const m = CONE(p, r, h, c, x, h / 2 - 1, z, { seg, ol:true, olw:.25, cast:false });
  if (snow) CONE(p, r * snow * 1.02, h * snow, 0xffffff, x, h - 1 - h * snow / 2 + .02, z, { seg, ol:false, cast:false });
  return m;
}
function tree(p, x, z, s = 1, c = 0x2f7a32, kind = 'round') {
  CYL(p, .15 * s, .22 * s, 1.6 * s, 0x6b4a2b, x, .8 * s, z, { olw:.04 });
  if (kind === 'pine') { CONE(p, 1.1 * s, 2.6 * s, c, x, 2.6 * s, z, { seg:8 }); CONE(p, .8 * s, 2 * s, c, x, 3.6 * s, z, { seg:8 }); }
  else SPH(p, 1.2 * s, c, x, 2.3 * s, z, { seg:10, seg2:8 });
}
function textTex(text, { w = 512, h = 128, bg = '#000', fg = '#fff', font = '64px Bangers, Impact', stroke = null } = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d');
  g.fillStyle = bg; g.fillRect(0, 0, w, h); g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle';
  if (stroke) { g.lineWidth = 6; g.strokeStyle = stroke; g.strokeText(text, w / 2, h / 2 + 4); }
  g.fillStyle = fg; g.fillText(text, w / 2, h / 2 + 4);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function sign(p, text, w, h, x, y, z, opts = {}) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map:textTex(text, opts) }));
  m.position.set(x, y, z); if (opts.ry) m.rotation.y = opts.ry; p.add(m);
  const back = new THREE.Mesh(new THREE.PlaneGeometry(w + .2, h + .2), new THREE.MeshBasicMaterial({ color:0x000000 }));
  back.position.z = -.01; m.add(back); return m;
}
function skyTex(top, bottom) {
  const c = document.createElement('canvas'); c.width = 4; c.height = 256; const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, top); gr.addColorStop(1, bottom);
  g.fillStyle = gr; g.fillRect(0, 0, 4, 256);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function flagTex() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 128; const g = c.getContext('2d');
  g.fillStyle = '#00247d'; g.fillRect(0, 0, 256, 128);
  g.save(); g.beginPath(); g.rect(0, 0, 128, 64); g.clip();
  g.strokeStyle = '#fff'; g.lineWidth = 13; g.beginPath(); g.moveTo(0, 0); g.lineTo(128, 64); g.moveTo(128, 0); g.lineTo(0, 64); g.stroke();
  g.strokeStyle = '#cf142b'; g.lineWidth = 5; g.stroke();
  g.fillStyle = '#fff'; g.fillRect(52, 0, 24, 64); g.fillRect(0, 22, 128, 20);
  g.fillStyle = '#cf142b'; g.fillRect(57, 0, 14, 64); g.fillRect(0, 27, 128, 10);
  g.restore();
  const star = (x, y, r) => {
    for (const [rr, col] of [[r, '#fff'], [r * .7, '#cf142b']]) {
      g.beginPath();
      for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, q = i % 2 ? rr * .42 : rr; g.lineTo(x + Math.cos(a) * q, y + Math.sin(a) * q); }
      g.closePath(); g.fillStyle = col; g.fill();
    }
  };
  star(192, 104, 11); star(168, 58, 10); star(216, 50, 9); star(192, 22, 9);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function wavingFlag(p, x, y, z, w = 2.4, h = 1.2, tex = flagTex()) {
  const geo = new THREE.PlaneGeometry(w, h, 14, 4); geo.translate(w / 2, 0, 0);
  const m = new THREE.Mesh(geo, new THREE.MeshToonMaterial({ map:tex, gradientMap:gradTex, side:THREE.DoubleSide }));
  m.position.set(x, y, z); m.castShadow = true; p.add(m);
  const base = geo.attributes.position.array.slice();
  return (t, amp = 1) => {
    const a = geo.attributes.position.array;
    for (let i = 0; i < a.length; i += 3) { const px = base[i]; a[i + 2] = Math.sin(px * 2.6 - t * 7) * .14 * px * amp; }
    geo.attributes.position.needsUpdate = true;
  };
}
function smokeStack(p, x, y, z, { scale = 1, color = 0xeeeeee, rate = .35, rise = 1.4 } = {}) {
  const puffs = []; let acc = 0;
  return dt => {
    acc += dt;
    if (acc > rate) {
      acc = 0;
      const m = new THREE.Mesh(new THREE.SphereGeometry(.6 * scale, 8, 6), toon(color, { opacity:.9 }));
      m.position.set(x, y, z); p.add(m); puffs.push({ m, t:0 });
    }
    for (let i = puffs.length - 1; i >= 0; i--) {
      const q = puffs[i]; q.t += dt;
      q.m.position.y += dt * rise * scale; q.m.position.x += dt * .6 * scale;
      q.m.scale.setScalar(1 + q.t * 1.2); q.m.material.opacity = Math.max(0, .9 - q.t * .3);
      if (q.t > 3) { p.remove(q.m); q.m.geometry.dispose(); q.m.material.dispose(); puffs.splice(i, 1); }
    }
  };
}

export { PATTERNS, PATTERN_IDS, withPattern, LOOK, setShadowTint, withRim, gradTex, toon, halftone, OL, _s, _c, outline, inkMats, inkMaterial, ink, disposeObj, place, BOX, CYL, SPH, CONE, PRISM, ground, water, mountain, tree, textTex, sign, skyTex, flagTex, wavingFlag, smokeStack };
