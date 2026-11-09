// Full-screen "print" pass: the colour plates slightly out of register, paper grain,
// and a saturation control (49). Renders the scene to a target, then this on top.
import * as THREE from 'three';

function makePrintMaterial() {
  return new THREE.ShaderMaterial({
    uniforms:{ tDiffuse:{ value:null }, uOffset:{ value:.0011 }, uGrain:{ value:.055 }, uTime:{ value:0 }, uSaturation:{ value:1 } },
    vertexShader:/* glsl */`varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }`,
    fragmentShader:/* glsl */`
      uniform sampler2D tDiffuse; uniform float uOffset, uGrain, uTime, uSaturation; varying vec2 vUv;
      void main() {
        vec4 c = texture2D(tDiffuse, vUv);
        float r = texture2D(tDiffuse, vUv + vec2(uOffset, uOffset * .4)).r; // misregistered plates
        float b = texture2D(tDiffuse, vUv + vec2(-uOffset * .6, -uOffset)).b;
        vec3 col = vec3(r, c.g, b);
        col = mix(vec3(dot(col, vec3(.299, .587, .114))), col, uSaturation);
        float n = fract(sin(dot(floor(gl_FragCoord.xy * .5) + uTime, vec2(12.9898, 78.233))) * 43758.5453);
        col *= 1. - uGrain * (n - .5);
        gl_FragColor = vec4(col, 1.);
        #include <colorspace_fragment>
      }`,
    depthTest:false, depthWrite:false,
  });
}

class PrintPost {
  constructor(renderer) {
    this.renderer = renderer; this.enabled = true;
    this.mat = makePrintMaterial();
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.mat); this.quad.frustumCulled = false;
    this.scene = new THREE.Scene(); this.scene.add(this.quad); this.cam = new THREE.Camera();
    this.rt = new THREE.WebGLRenderTarget(1, 1, { samples:4 });
    this.resize();
  }
  resize() { const v = this.renderer.getDrawingBufferSize(new THREE.Vector2()); this.rt.setSize(v.x, v.y); }
  render(scene, camera, t = 0) {
    const r = this.renderer;
    r.setRenderTarget(this.rt); r.render(scene, camera); r.setRenderTarget(null);
    this.mat.uniforms.tDiffuse.value = this.rt.texture; this.mat.uniforms.uTime.value = Math.floor(t * 12) % 97;
    r.render(this.scene, this.cam);
  }
}

export { makePrintMaterial, PrintPost };
