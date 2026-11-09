import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// Sculpted fighter parts from models/fighters.js (base64 GLB). Missing file -> procedural fallback.
// Loaded by main.js before anything is built. Not a top-level await: one inside this
// module graph's import cycles deadlocks module evaluation.
let PARTS = null;

async function loadParts(b64 = globalThis.NZF_GLB) {
  if (!b64) return PARTS = null;
  try {
    const bin = Uint8Array.from(atob(b64), c => c.charCodeAt(0)).buffer;
    const gltf = await new Promise((res, rej) => new GLTFLoader().parse(bin, '', res, rej));
    const out = {};
    gltf.scene.traverse(n => {
      if (!n.isMesh) return;
      const [id, role] = n.name.split('__'); if (!role) return;
      n.geometry.userData.shared = true;
      (out[id] ??= {})[role.replace(/_?\d+$/, '')] = { geo:n.geometry, pos:n.position.clone(), vc:!!n.geometry.attributes.color };
    });
    return PARTS = out;
  } catch (e) { console.warn('fighter models failed to load', e); return PARTS = null; }
}

export { PARTS, loadParts };
