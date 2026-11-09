import * as THREE from 'three';

// Renderer / scene

const renderer = new THREE.WebGLRenderer({ antialias:true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.prepend(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(40, innerWidth / innerHeight, .1, 600);
camera.position.set(0, 3.2, 10);
addEventListener('resize', () => {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
});

const hemi = new THREE.HemisphereLight(0xffffff, 0x445533, 1.4); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffffff, 2.4);
sun.position.set(6, 16, 10); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left:-16, right:16, top:14, bottom:-6, near:1, far:60 });
sun.shadow.bias = -.0006; scene.add(sun);

export { renderer, scene, camera, hemi, sun };
