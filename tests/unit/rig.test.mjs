import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { skinnedLimb } from '../../src/rig.js';

const mat = () => new THREE.MeshBasicMaterial();

test('a skinned limb has two bones, a mesh bound to them, and an end mount at the far joint', () => {
  const L = skinnedLimb({ r0:.13, r1:.11, len:.6, mat:mat() });
  assert.ok(L.mesh.isSkinnedMesh);
  assert.equal(L.mesh.skeleton.bones.length, 2);
  assert.deepEqual([L.upper.isBone, L.lower.isBone], [true, true]);
  assert.equal(L.lower.parent, L.upper);
  assert.ok(Math.abs(L.lower.position.y + .3) < 1e-9, 'joint sits half way down');
  assert.equal(L.end.parent, L.lower);
  assert.ok(Math.abs(L.end.position.y + .3) < 1e-9, 'end mount at the far end');
});

test('skin weights sum to one and blend smoothly across the joint', () => {
  const L = skinnedLimb({ r0:.13, r1:.11, len:.6, mat:mat() });
  const g = L.mesh.geometry, P = g.attributes.position, W = g.attributes.skinWeight, I = g.attributes.skinIndex;
  let blended = 0;
  for (let i = 0; i < P.count; i++) {
    const w = [W.getX(i), W.getY(i), W.getZ(i), W.getW(i)];
    assert.ok(Math.abs(w.reduce((a, b) => a + b) - 1) < 1e-6, 'weights sum to 1');
    const lowerW = I.getX(i) === 1 ? w[0] : I.getY(i) === 1 ? w[1] : 0, y = P.getY(i);
    if (y > -.05) assert.ok(lowerW < 1e-6, 'top follows the upper bone only');
    if (y < -.55) assert.ok(lowerW > 1 - 1e-6, 'bottom follows the lower bone only');
    if (lowerW > .05 && lowerW < .95) blended++;
  }
  assert.ok(blended > 0, 'some vertices blend across the joint');
});

test('bending the lower bone moves the end mount and the skinned vertices', () => {
  const L = skinnedLimb({ r0:.13, r1:.11, len:.6, mat:mat() });
  L.root.updateMatrixWorld(true);
  const before = new THREE.Vector3().setFromMatrixPosition(L.end.matrixWorld);
  L.lower.rotation.z = Math.PI / 2; L.root.updateMatrixWorld(true);
  const after = new THREE.Vector3().setFromMatrixPosition(L.end.matrixWorld);
  assert.ok(after.distanceTo(before) > .3, 'end moved with the bend');
  // a vertex at the bottom should move once skinned
  const g = L.mesh.geometry, P = g.attributes.position;
  let idx = 0; for (let i = 0; i < P.count; i++) if (P.getY(i) < P.getY(idx)) idx = i;
  const v = new THREE.Vector3(); L.mesh.skeleton.update(); L.mesh.getVertexPosition(idx, v);
  assert.ok(v.y > -.5, `bottom vertex should swing up when bent (y=${v.y.toFixed(2)})`);
});

test('the ink outline is a second skinned mesh on the same skeleton', () => {
  const L = skinnedLimb({ r0:.13, r1:.11, len:.6, mat:mat(), ink:new THREE.MeshBasicMaterial({ side:THREE.BackSide }) });
  const outline = L.root.children.find(c => c !== L.mesh && c.isSkinnedMesh);
  assert.ok(outline, 'no skinned outline');
  assert.equal(outline.skeleton, L.mesh.skeleton);
});
