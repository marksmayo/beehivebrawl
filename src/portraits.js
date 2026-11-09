import * as THREE from 'three';
import { Fighter } from './fighter.js';
import { disposeObj } from './kit.js';
import { renderer } from './renderer.js';
import { ROSTER } from './roster.js';

// Portraits (rendered once with an offscreen renderer)

const portraits = {};
function makePortraits() {
  const S = 256, rt = new THREE.WebGLRenderTarget(S, S, { samples:4, colorSpace:THREE.SRGBColorSpace }), px = new Uint8Array(S * S * 4);
  const cv = document.createElement('canvas'); cv.width = cv.height = S; const cx = cv.getContext('2d'), img = cx.createImageData(S, S);
  const sc = new THREE.Scene();
  sc.add(new THREE.HemisphereLight(0xffffff, 0x666666, 1.6));
  const dl = new THREE.DirectionalLight(0xffffff, 2.2); dl.position.set(4, 6, 6); sc.add(dl);
  const cam = new THREE.PerspectiveCamera(30, 1, .1, 50);
  for (const d of ROSTER) {
    const f = new Fighter(d, 0); f.x = 0; f.facing = 1; f.animate(1);
    sc.add(f.root);
    const h = d.build.h, hy = 2.55 * h;
    cam.position.set(1.4, hy + .35, 3.4); cam.lookAt(.15, hy - .05, 0);
    for (const mood of f.faces ? ['n', 'open', 'hurt'] : ['n']) { // one per expression, for the HUD (55)
      if (f.faces) f.faceMat.map = f.faces[mood];
      renderer.setRenderTarget(rt); renderer.setClearColor(0x000000, 0); renderer.clear(); renderer.render(sc, cam);
      renderer.readRenderTargetPixels(rt, 0, 0, S, S, px);
      for (let y = 0; y < S; y++) img.data.set(px.subarray((S - 1 - y) * S * 4, (S - y) * S * 4), y * S * 4); // flip Y
      cx.putImageData(img, 0, 0);
      portraits[mood === 'n' ? d.id : `${d.id}:${mood}`] = cv.toDataURL();
    }
    sc.remove(f.root); disposeObj(f.root);
  }
  renderer.setRenderTarget(null); renderer.setClearColor(0x000000, 1); rt.dispose();
}

// =====================================================================

export { portraits, makePortraits };
