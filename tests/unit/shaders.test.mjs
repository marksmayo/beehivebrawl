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
