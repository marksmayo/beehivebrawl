// Skinned two-bone limbs (sleeves and trouser legs) so elbows and knees bend
// smoothly instead of rigid capsules pivoting. three.js only, no DOM.
import * as THREE from 'three';

// A tapered tube from the root joint (y = 0) down to y = -len, skinned to two bones:
// `upper` at the root and `lower` at the middle joint. Weights blend over `blend` either
// side of the joint. `end` (wrist/ankle) is a mount on the lower bone for hands and feet.
function skinnedLimb({ r0, r1, len, mat, ink = null, blend = .09, radial = 16, rows = 14 }) {
  const geo = new THREE.CylinderGeometry(r0, r1, len, radial, rows, true);
  geo.translate(0, -len / 2, 0);
  const P = geo.attributes.position, n = P.count, idx = new Uint16Array(n * 4), wts = new Float32Array(n * 4), j = -len / 2;
  for (let i = 0; i < n; i++) {
    const t = Math.min(1, Math.max(0, (j + blend - P.getY(i)) / (2 * blend))); // 0 above the joint band, 1 below
    const w = t * t * (3 - 2 * t);
    idx[i * 4] = 0; idx[i * 4 + 1] = 1; wts[i * 4] = 1 - w; wts[i * 4 + 1] = w;
  }
  geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(idx, 4));
  geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(wts, 4));

  const root = new THREE.Group(), upper = new THREE.Bone(), lower = new THREE.Bone(), end = new THREE.Group();
  lower.position.y = j; upper.add(lower); end.position.y = j; lower.add(end);
  // rounded joint caps so a sharp bend never shows a gap
  const capGeo = new THREE.SphereGeometry((r0 + r1) / 2, 14, 10);
  const cap = new THREE.Mesh(capGeo, mat); cap.castShadow = true; lower.add(cap);
  const skeleton = new THREE.Skeleton([upper, lower]);
  const mesh = new THREE.SkinnedMesh(geo, mat); mesh.castShadow = true; mesh.receiveShadow = true;
  root.add(upper, mesh); mesh.bind(skeleton);
  if (ink) {
    const o = new THREE.SkinnedMesh(geo, ink); root.add(o); o.bind(skeleton, mesh.bindMatrix);
    const capInk = new THREE.Mesh(capGeo, ink); lower.add(capInk);
  }
  return { root, mesh, upper, lower, end, len };
}

export { skinnedLimb };
