import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { toon, inkMaterial } from '../../src/kit.js';
import { makePrintMaterial } from '../../src/post.js';

const compile = (m, lib) => { const sh = { vertexShader:lib.vertexShader, fragmentShader:lib.fragmentShader, uniforms:{} }; m.onBeforeCompile(sh); return sh; };

// ---- 47: halftone only where it's dark ----------------------------------------------------
test('toon materials add halftone dots in the shadows, in screen space', () => {
  const sh = compile(toon(0xff0000), THREE.ShaderLib.toon);
  assert.match(sh.fragmentShader, /halftone/i);
  assert.match(sh.fragmentShader, /gl_FragCoord/, 'dots are in screen space');
  assert.match(sh.fragmentShader, /irradiance|outgoingLight/, 'driven by the lighting, so only shadows get dots');
  assert.ok('uDot' in sh.uniforms, 'dot size uniform');
  assert.match(toon(0xff0000).customProgramCacheKey(), /halftone/);
});

test('materials can opt out of halftone (e.g. glowing effects)', () => {
  const m = toon(0xffffff, { halftone:false });
  assert.ok(!m.onBeforeCompile || !/halftone/i.test(compile(m, THREE.ShaderLib.toon).fragmentShader));
});

// ---- 48: brushy ink outlines -----------------------------------------------------------------
test('ink outlines vary their width along the surface like a brush stroke', () => {
  const sh = compile(inkMaterial(.02), THREE.ShaderLib.basic);
  assert.match(sh.vertexShader, /normal/);
  assert.match(sh.vertexShader, /brush/i, 'width varies along the stroke');
  assert.match(sh.vertexShader, /sin\(|fract\(/, 'a procedural variation term');
});

// ---- 49: print misregistration ------------------------------------------------------------------
test('the print pass offsets the colour plates and adds paper grain', () => {
  const m = makePrintMaterial();
  assert.ok(m.isShaderMaterial);
  for (const u of ['tDiffuse', 'uOffset', 'uGrain', 'uTime', 'uSaturation']) assert.ok(u in m.uniforms, `missing ${u}`);
  assert.ok(m.uniforms.uOffset.value > 0 && m.uniforms.uOffset.value < .004, 'subtle');
  assert.match(m.fragmentShader, /texture2D\(tDiffuse, vUv \+/, 'samples a shifted plate');
});

test('the print pass can shimmer with heat haze (60), off by default', () => {
  const m = makePrintMaterial();
  assert.ok('uHaze' in m.uniforms); assert.equal(m.uniforms.uHaze.value, 0);
  assert.match(m.fragmentShader, /uHaze/);
});

// ---- 71 + 74: warm shadows, cool highlights, tinted per arena -------------------------------------
test('the toon shader warms its shadows and cools its highlights, with an arena-wide shadow tint', async () => {
  const kit = await import('../../src/kit.js');
  const sh = compile(toon(0x808080), THREE.ShaderLib.toon);
  assert.match(sh.fragmentShader, /uShadowTint/); assert.match(sh.fragmentShader, /uHighTint/);
  assert.equal(sh.uniforms.uShadowTint, kit.LOOK.uShadowTint, 'all materials share one tint uniform');
  kit.setShadowTint(0x6040a0); assert.ok(Math.abs(kit.LOOK.uShadowTint.value.b - 0x6040a0 % 256 / 255) < .05, 'tint updates');
  kit.setShadowTint(0xffb08a);
});

// ---- 73: rim light ------------------------------------------------------------------------------------
test('characters can carry a fresnel rim light in a chosen colour', async () => {
  const { withRim } = await import('../../src/kit.js');
  const m = withRim(toon(0xffffff), [1, .2, .2]), sh = compile(m, THREE.ShaderLib.toon);
  assert.match(sh.fragmentShader, /uRim/); assert.match(sh.fragmentShader, /vViewPosition|viewDir|geometryViewDir/);
  assert.match(m.customProgramCacheKey(), /rim/);
});

// ---- 77: colour grading ----------------------------------------------------------------------------------
test('the print pass grades colour (lift / gamma / gain), with a grade per arena', async () => {
  const m = makePrintMaterial();
  for (const u of ['uLift', 'uGamma', 'uGain']) assert.ok(u in m.uniforms, `missing ${u}`);
  const { GRADES, ARENA_META } = await import('../../src/arenadata.js');
  for (const id of Object.keys(ARENA_META)) { const g = GRADES[id]; assert.ok(g && g.lift.length === 3 && g.gamma.length === 3 && g.gain.length === 3, `${id} grade`); }
  assert.notDeepEqual(GRADES.octagon, GRADES.viaduct, 'Dunedin and the Viaduct feel different');
});

// ---- 6: woven suit fabrics ---------------------------------------------------------------------------
test('suit fabrics are drawn in the shader: pinstripe, check, twill, hi-vis bands, floral', async () => {
  const { withPattern, PATTERN_IDS } = await import('../../src/kit.js');
  for (const k of ['pinstripe', 'check', 'twill', 'hivis', 'floral', 'crease']) {
    const m = withPattern(toon(0x334455), k), sh = compile(m, THREE.ShaderLib.toon);
    assert.match(sh.vertexShader, /vPat/, `${k}: object-space position varying`);
    assert.match(sh.fragmentShader, new RegExp(`pattern: ${k}`), `${k}: pattern code`);
    assert.equal(sh.uniforms.uPat.value, PATTERN_IDS.indexOf(k), `${k}: selected by uniform`);
  }
  // every fabric shares one shader program (no per-pattern compiles at boot)
  const keys = new Set(['pinstripe', 'check', 'twill', 'hivis', 'floral'].map(k => withPattern(toon(0x334455), k).customProgramCacheKey()));
  assert.equal(keys.size, 1);
});
