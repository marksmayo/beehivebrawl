import * as THREE from 'three';
import { game } from './game.js';
import { BOX, CONE, CYL, SPH, disposeObj, gradTex, sign, skyTex, toon, wavingFlag } from './kit.js';
import { renderer, scene, sun } from './renderer.js';
import { pick, rand } from './util.js';

// Painted arenas: an illustrated panorama on a curved backdrop, a painted
// floor, and a few 3D props in front (the look of a comic-book set)

const INK = '#2a201c';
const shade = (c, k) => { const x = new THREE.Color(c); if (k > 0) x.lerp(new THREE.Color(0xffffff), k); else x.multiplyScalar(1 + k); return '#' + x.getHexString(); };

class Pn { // canvas painter with ink outlines and cel-shaded blobs
  constructor(W, H, seed = 7) {
    this.c = document.createElement('canvas'); this.c.width = this.W = W; this.c.height = this.H = H;
    this.g = this.c.getContext('2d'); this.g.lineJoin = this.g.lineCap = 'round'; this.s = seed;
  }
  r(a = 0, b = 1) { this.s = this.s * 16807 % 2147483647; return a + (b - a) * (this.s - 1) / 2147483646; }
  path(pts, close = true) { const g = this.g; g.beginPath(); g.moveTo(...pts[0]); for (let i = 1; i < pts.length; i++) g.lineTo(...pts[i]); if (close) g.closePath(); }
  fs(fill, lw = 4) { const g = this.g; if (fill) { g.fillStyle = fill; g.fill(); } if (lw) { g.lineWidth = lw; g.strokeStyle = INK; g.stroke(); } }
  poly(pts, fill, lw = 4) { this.path(pts); this.fs(fill, lw); }
  line(pts, w = 3, c = INK) { this.path(pts, false); this.g.lineWidth = w; this.g.strokeStyle = c; this.g.stroke(); }
  rect(x, y, w, h, fill, lw = 4) { this.g.beginPath(); this.g.rect(x, y, w, h); this.fs(fill, lw); }
  rrect(x, y, w, h, rad, fill, lw = 4) { this.g.beginPath(); this.g.roundRect(x, y, w, h, rad); this.fs(fill, lw); }
  ell(x, y, rx, ry, fill, lw = 4) { this.g.beginPath(); this.g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); this.fs(fill, lw); }
  arch(x, base, w, h, fill, lw = 4) { // round-topped opening, base = bottom edge
    const g = this.g, q = w / 2; g.beginPath(); g.moveTo(x, base); g.lineTo(x, base - h + q); g.arc(x + q, base - h + q, q, Math.PI, 0); g.lineTo(x + w, base); g.closePath(); this.fs(fill, lw);
  }
  gothic(x, base, w, h, fill, lw = 4) { // pointed arch
    const g = this.g; g.beginPath(); g.moveTo(x, base); g.lineTo(x, base - h + w * .6); g.quadraticCurveTo(x, base - h + w * .1, x + w / 2, base - h);
    g.quadraticCurveTo(x + w, base - h + w * .1, x + w, base - h + w * .6); g.lineTo(x + w, base); g.closePath(); this.fs(fill, lw);
  }
  grad(x0, y0, x1, y1, stops) { const gr = this.g.createLinearGradient(x0, y0, x1, y1); stops.forEach(([o, c]) => gr.addColorStop(o, c)); return gr; }
  sky(stops, h = this.H) { this.g.fillStyle = this.grad(0, 0, 0, h, stops); this.g.fillRect(0, 0, this.W, this.H); }
  blobs(circ, fill, lw = 5, dark = shade(fill, -.22), hi = shade(fill, .22)) {
    const g = this.g, dot = (x, y, r) => { g.beginPath(); g.arc(x, y, Math.max(1, r), 0, 7); g.fill(); };
    g.fillStyle = INK; for (const [x, y, r] of circ) dot(x, y, r + lw);
    g.fillStyle = dark; for (const [x, y, r] of circ) dot(x, y, r);
    g.fillStyle = fill; for (const [x, y, r] of circ) dot(x - r * .1, y - r * .14, r * .86);
    if (hi) { g.fillStyle = hi; for (const [x, y, r] of circ) dot(x - r * .32, y - r * .36, r * .3); }
  }
  cloud(x, y, s, fill = '#ffffff', dark = '#cfdcec') {
    const c = [];
    for (let i = 0; i < 6; i++) c.push([x + (i - 2.5) * s * .5, y - Math.sin(i / 5 * Math.PI) * s * .3, s * (.32 + .12 * Math.sin(i * 2.3 + x))]);
    c.push([x - s * .2, y - s * .42, s * .42], [x + s * .35, y - s * .3, s * .34]);
    this.blobs(c, fill, 4, dark, null);
    this.g.fillStyle = dark; this.g.fillRect(x - s * 1.6, y + s * .05, s * 3.2, 0);
  }
  streak(x, y, w, h, fill = '#ffffff') { this.rrect(x, y, w, h, h / 2, fill, 3); this.rrect(x + w * .1, y + h * .55, w * .8, h * .3, h * .15, shade(fill, -.1), 0); }
  tree(x, y, s, fill = '#3f8a3a') { // y = ground
    this.poly([[x - s * .07, y], [x - s * .04, y - s * .65], [x + s * .04, y - s * .65], [x + s * .07, y]], '#6b4a2e', 4);
    const c = [[x, y - s * 1.05, s * .36]];
    for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2; c.push([x + Math.cos(a) * s * .34, y - s * .95 + Math.sin(a) * s * .26, s * (.24 + .06 * Math.sin(i * 3.1))]); }
    this.blobs(c, fill, 5);
  }
  pine(x, y, s, fill = '#2c5a35') {
    this.rect(x - s * .04, y - s * .35, s * .08, s * .35, '#5a3d26', 3);
    for (let i = 0; i < 4; i++) { const w = s * (.4 - i * .08), yy = y - s * (.25 + i * .28); this.poly([[x - w, yy], [x, yy - s * .45], [x + w, yy]], i % 2 ? fill : shade(fill, .1), 4); }
  }
  pohutukawa(x, y, s) {
    this.poly([[x - s * .05, y], [x - s * .14, y - s * .55], [x - s * .1, y - s * .58], [x, y - s * .45], [x + s * .08, y - s * .62], [x + s * .12, y - s * .6], [x + s * .05, y]], '#6a4a32', 4);
    const c = []; for (let i = 0; i < 11; i++) c.push([x + (i - 5) * s * .13, y - s * .75 - Math.sin(i / 10 * Math.PI) * s * .35 + this.r(-1, 1) * s * .06, s * this.r(.18, .26)]);
    this.blobs(c, '#2f6a2c', 5);
    this.g.fillStyle = '#d8232f'; for (let i = 0; i < 60; i++) { const a = this.r(0, Math.PI), d = this.r(.2, 1); this.g.beginPath(); this.g.arc(x + Math.cos(a) * s * .75 * d, y - s * .78 - Math.sin(a) * s * .45 * d, s * .035, 0, 7); this.g.fill(); }
  }
  win(x, y, w, h, o = {}) { // window: frame, glass glint, optional shutters / sill / flower box
    const glass = o.glass ?? '#56789a';
    if (o.shutter) { this.rect(x - w * .44, y, w * .4, h, o.shutter, 3); this.rect(x + w * 1.04, y, w * .4, h, o.shutter, 3);
      for (let k = 1; k < 6; k++) { this.line([[x - w * .4, y + h * k / 6], [x - w * .08, y + h * k / 6]], 1.5); this.line([[x + w * 1.08, y + h * k / 6], [x + w * 1.4, y + h * k / 6]], 1.5); } }
    if (o.arch) this.arch(x, y + h, w, h, glass, 3); else if (o.gothic) this.gothic(x, y + h, w, h, glass, 3); else this.rect(x, y, w, h, glass, 3);
    const g = this.g; g.save(); g.globalAlpha = .3; g.fillStyle = '#fff'; g.beginPath();
    g.moveTo(x + w * .12, y + h * .9); g.lineTo(x + w * .5, y + h * .2); g.lineTo(x + w * .68, y + h * .2); g.lineTo(x + w * .3, y + h * .9); g.fill(); g.restore();
    if (o.lit) { g.save(); g.globalAlpha = .85; g.fillStyle = o.lit; g.fillRect(x + 2, y + 2, w - 4, h - 4); g.restore(); }
    if (o.bars !== false) { this.line([[x + w / 2, y + (o.arch ? w / 2 : 0)], [x + w / 2, y + h]], 2.5); this.line([[x, y + h * .45], [x + w, y + h * .45]], 2.5); }
    if (o.sill) this.rect(x - w * .12, y + h, w * 1.24, Math.max(6, h * .08), o.sill, 3);
    if (o.box) { this.rect(x - w * .05, y + h - h * .02, w * 1.1, h * .16, '#9a4a2a', 3);
      this.blobs([[x + w * .2, y + h - h * .06, w * .14], [x + w * .5, y + h - h * .1, w * .16], [x + w * .8, y + h - h * .06, w * .14]], '#3f8a3a', 3, undefined, null);
      g.fillStyle = o.flower ?? '#e0302a'; for (let k = 0; k < 5; k++) { g.beginPath(); g.arc(x + w * (.1 + k * .2), y + h - h * .14 + (k % 2) * 5, w * .055, 0, 7); g.fill(); } }
  }
  facade(x, base, w, h, o = {}) { // a townhouse / shop block
    const c = o.col ?? '#e8d9b0';
    this.rect(x, base - h, w, h, c, 5);
    this.g.fillStyle = shade(c, -.12); this.g.fillRect(x + w * .93, base - h, w * .07, h);
    if (o.hatch !== false) this.hatch(x + w * .8, base - h, w * .2, h, .1);
    if (o.cornice !== false) this.rect(x - 8, base - h - 16, w + 16, 20, shade(c, -.06), 4);
    const shopH = o.shop ? 150 : 0;
    const cols = o.cols ?? Math.max(2, Math.round(w / 120)), rows = o.rows ?? Math.max(1, Math.round((h - shopH) / 140) - 1);
    const ww = o.ww ?? Math.min(60, w / cols * .4), wh = o.wh ?? Math.min(100, (h - shopH - 60) / rows * .6);
    for (let r = 0; r < rows; r++) for (let k = 0; k < cols; k++) {
      const cx = x + w * (k + .5) / cols - ww / 2, cy = base - h + 40 + r * (h - shopH - 60) / rows;
      this.win(cx, cy, ww, wh, { shutter:o.shutter, sill:shade(c, -.18), arch:o.arch, box:o.box && this.r() < .45, lit:o.lit && this.r() < .5 ? o.lit : null });
    }
    if (o.shop) { this.rect(x + 12, base - 120, w - 24, 120, shade(o.shop, -.45), 4); this.awning(x + 6, base - 150, w - 12, o.shop); if (o.goods) this.goods(x + 24, base, w - 48); }
    else if (o.door !== false) this.arch(x + w / 2 - 32, base, 64, 110, '#6b4a2e', 4);
    this.rect(x, base - h, w, h, null, 5);
  }
  awning(x, y, w, c) {
    const n = Math.max(3, Math.round(w / 42)), sw = w / n;
    for (let i = 0; i < n; i++) this.poly([[x + i * sw, y], [x + (i + 1) * sw, y], [x + (i + 1) * sw + 6, y + 40], [x + i * sw + 6, y + 40]], i % 2 ? '#fffaf0' : c, 3);
    for (let i = 0; i < n; i++) { this.g.beginPath(); this.g.arc(x + (i + .5) * sw + 6, y + 40, sw / 2, 0, Math.PI); this.fs(i % 2 ? '#fffaf0' : c, 3); }
  }
  goods(x, base, w) { // fruit & veg crates
    const n = Math.floor(w / 70);
    for (let i = 0; i < n; i++) {
      const cx = x + i * 70; this.rect(cx, base - 46, 62, 46, '#b07a42', 3); this.line([[cx, base - 23], [cx + 62, base - 23]], 2);
      const f = ['#f08a1c', '#f5d020', '#d8232f', '#7ab83a'][i % 4]; const c = [];
      for (let k = 0; k < 5; k++) c.push([cx + 8 + k * 12, base - 50 - (k % 2) * 6, 9]);
      this.blobs(c, f, 2);
    }
  }
  range(base, peaks, fill, snow = 0, lw = 5) { // mountain range from [x, y] peaks
    const pts = [[peaks[0][0] - 300, base], ...peaks, [peaks.at(-1)[0] + 300, base]];
    const xs = pts.map(p => p[0]), x0 = Math.min(...xs), x1 = Math.max(...xs);
    this.poly(pts, this.grad(x0, 0, x1, 0, [[0, shade(fill, .12)], [.5, fill], [1, shade(fill, -.15)]]), lw);
    const g = this.g; g.save(); this.path(pts); g.clip();
    for (const [px, py] of peaks) { // shadowed right faces
      g.fillStyle = shade(fill, -.2); g.beginPath(); g.moveTo(px, py); g.lineTo(px + (base - py) * .55, base); g.lineTo(px + (base - py) * .15, base); g.closePath(); g.fill();
    }
    if (snow) {
      const top = Math.min(...peaks.map(p => p[1])), sl = top + (base - top) * snow;
      g.fillStyle = '#f4f8ff'; g.beginPath(); g.moveTo(x0, sl);
      for (let x = x0; x <= x1; x += 30) g.lineTo(x, sl + Math.sin(x * .04) * 14 + this.r(-1, 1) * 22);
      g.lineTo(x1, 0); g.lineTo(x0, 0); g.closePath(); g.fill();
      g.fillStyle = '#cbd7ea'; for (const [px, py] of peaks) { g.beginPath(); g.moveTo(px, py); g.lineTo(px + (sl - py) * .5, sl + 20); g.lineTo(px + (sl - py) * .1, sl + 20); g.fill(); }
    }
    g.restore(); this.path(pts); this.fs(null, lw);
  }
  sea(y0, y1, c0, c1, glint = '#ffffff') {
    this.g.fillStyle = this.grad(0, y0, 0, y1, [[0, c0], [1, c1]]); this.g.fillRect(0, y0, this.W, y1 - y0);
    this.g.save(); this.g.globalAlpha = .55;
    for (let i = 0; i < 260; i++) { const y = this.r(y0 + 6, y1), x = this.r(0, this.W), l = 10 + (y - y0) * .25; this.line([[x, y], [x + l, y]], 2 + (y - y0) / (y1 - y0) * 2, glint); }
    this.g.restore(); this.line([[0, y0], [this.W, y0]], 3);
  }
  hatch(x, y, w, h, a = .14, step = 9) {
    const g = this.g; g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip(); g.globalAlpha = a; g.strokeStyle = INK; g.lineWidth = 1.6;
    for (let k = -h; k < w; k += step) { g.beginPath(); g.moveTo(x + k, y + h); g.lineTo(x + k + h, y); g.stroke(); }
    g.restore();
  }
  text(t, x, y, size, fill = '#fff', o = {}) {
    const g = this.g; g.font = `${size}px Bangers, Impact, sans-serif`; g.textAlign = o.align ?? 'center'; g.textBaseline = 'middle';
    g.lineWidth = size * .16; g.strokeStyle = INK; g.strokeText(t, x, y); g.fillStyle = fill; g.fillText(t, x, y);
  }
  signboard(t, x, y, w, h, bg, fg = '#fff') { this.rrect(x - w / 2, y - h / 2, w, h, 10, bg, 5); this.text(t, x, y + 2, h * .62, fg); }
  grain() { // paper texture + faint print dots so it reads as an illustration
    const n = document.createElement('canvas'); n.width = n.height = 128; const q = n.getContext('2d'), d = q.createImageData(128, 128);
    for (let i = 0; i < d.data.length; i += 4) { const v = 128 + (this.r() - .5) * 60; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; }
    q.putImageData(d, 0, 0);
    const g = this.g; g.save(); g.globalCompositeOperation = 'overlay'; g.globalAlpha = .18; g.fillStyle = g.createPattern(n, 'repeat'); g.fillRect(0, 0, this.W, this.H); g.restore();
  }
  tex(rep) {
    const t = new THREE.CanvasTexture(this.c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = renderer.capabilities.getMaxAnisotropy();
    if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep, rep); }
    return t;
  }
}

// Backdrop: an arc of cylinder behind the fight, unlit, with a stone kerb at its foot.
// Canvas is 4096x1024 over ~66 x 16 world units; x = 2048 sits behind the centre of the arena,
// the ground line where buildings stand is y ~ 950 (the bottom strip is hidden by the floor).
const BD = { W:4096, H:1024, GY:950 };
function backdrop(g, paint, { kerb = 0xe8e2d4, R = 27, cz = 8, arc = 2.45, h = 16, y0 = -1.2 } = {}) {
  const p = new Pn(BD.W, BD.H); paint(p, BD.W, BD.H, BD.GY); p.grain();
  const geo = new THREE.CylinderGeometry(R, R, h, 120, 1, true, Math.PI - arc / 2, arc);
  const uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setX(i, 1 - uv.getX(i));
  const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map:p.tex(), side:THREE.BackSide, fog:false }));
  m.position.set(0, y0 + h / 2, cz); g.add(m);
  if (kerb != null) {
    const kr = R - .6, wall = new THREE.Mesh(new THREE.CylinderGeometry(kr, kr, .7, 120, 1, true, Math.PI - arc / 2, arc), toon(kerb, { side:THREE.DoubleSide }));
    wall.position.set(0, .35, cz); wall.receiveShadow = true; g.add(wall);
    const top = new THREE.Mesh(new THREE.RingGeometry(kr, R - .02, 120, 1, Math.PI / 2 - arc / 2, arc), toon(shade(kerb, .3)));
    top.rotation.x = -Math.PI / 2; top.position.set(0, .7, cz); g.add(top);
    const lip = new THREE.Mesh(new THREE.CylinderGeometry(kr - .02, kr - .02, .06, 120, 1, true, Math.PI - arc / 2, arc), new THREE.MeshBasicMaterial({ color:INK, side:THREE.DoubleSide }));
    lip.position.set(0, .7, cz); g.add(lip);
  }
  return m;
}

// Painted floor tiles (1024px = 4 world units), repeated.
function floor(g, kind, c) {
  const p = new Pn(1024, 1024, 3), q = p.g;
  q.fillStyle = c; q.fillRect(0, 0, 1024, 1024);
  if (kind === 'paving' || kind === 'bricks') {
    const bw = kind === 'bricks' ? 128 : 256, bh = kind === 'bricks' ? 64 : 128;
    for (let r = 0; r < 1024 / bh; r++) for (let k = -1; k < 1024 / bw + 1; k++) {
      const x = k * bw + (r % 2) * bw / 2, y = r * bh;
      p.rrect(x + 4, y + 4, bw - 8, bh - 8, 10, shade(c, p.r(-.1, .08)), 0);
      q.globalAlpha = .5; p.line([[x + 10, y + 8], [x + bw - 12, y + 8]], 3, shade(c, .25)); q.globalAlpha = 1;
      q.globalAlpha = .55; p.rrect(x + 4, y + 4, bw - 8, bh - 8, 10, null, 4); q.globalAlpha = 1;
    }
  } else if (kind === 'planks') {
    for (let r = 0; r < 8; r++) {
      let x = -p.r(0, 300);
      while (x < 1024) { const l = p.r(300, 600); p.rect(x + 3, r * 128 + 3, l - 6, 122, shade(c, p.r(-.12, .08)), 0);
        q.globalAlpha = .25; for (let k = 0; k < 4; k++) p.line([[x + 20, r * 128 + 25 + k * 25], [x + l - 30, r * 128 + 25 + k * 25 + p.r(-6, 6)]], 2, INK); q.globalAlpha = 1;
        q.globalAlpha = .6; p.rect(x + 3, r * 128 + 3, l - 6, 122, null, 4); q.globalAlpha = 1;
        p.ell(x + 20, r * 128 + 64, 5, 5, '#3a2a1a', 0); p.ell(x + l - 20, r * 128 + 64, 5, 5, '#3a2a1a', 0); x += l; }
    }
  } else { // grass
    for (let i = 0; i < 90; i++) { q.globalAlpha = .35; p.ell(p.r(0, 1024), p.r(0, 1024), p.r(40, 120), p.r(30, 80), shade(c, p.r(-.15, .1)), 0); }
    q.globalAlpha = 1;
    for (let i = 0; i < 900; i++) { const x = p.r(0, 1024), y = p.r(0, 1024), l = p.r(10, 24); p.line([[x, y], [x + p.r(-6, 6), y - l]], 3, shade(c, p.r(-.35, .25))); }
  }
  const m = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), new THREE.MeshToonMaterial({ map:p.tex(30), gradientMap:gradTex }));
  m.rotation.x = -Math.PI / 2; m.receiveShadow = true; g.add(m); return m;
}

// --- landmarks, drawn into the panoramas ------------------------------
function paintBeehive(p, x, base, s = 1) { // the Beehive: stacked round tiers on a podium, copper crown
  p.rect(x - 380 * s, base - 110 * s, 760 * s, 110 * s, '#8c9094', 5);
  for (let k = 0; k < 9; k++) p.rect(x - 360 * s + k * 82 * s, base - 95 * s, 40 * s, 70 * s, '#39434f', 3);
  let y = base - 110 * s;
  for (let i = 0; i < 10; i++) {
    const w = (690 - i * 34) * s, th = 46 * s;
    p.rrect(x - w / 2, y - th, w, th, 14 * s, '#2b3440', 4);
    for (let k = 1; k < 16; k++) p.line([[x - w / 2 + k * w / 16, y - th + 4], [x - w / 2 + k * w / 16, y - 6]], 2, '#4d5d70');
    p.g.save(); p.g.globalAlpha = .2; p.g.fillStyle = '#9fc3e6'; p.g.fillRect(x - w / 2 + 6, y - th + 6, w * .35, th - 14); p.g.restore();
    p.rrect(x - w / 2 - 14 * s, y - th - 12 * s, w + 28 * s, 16 * s, 8 * s, '#efe9da', 4);
    y -= th + 12 * s;
  }
  p.poly([[x - 220 * s, y], [x - 160 * s, y - 70 * s], [x + 160 * s, y - 70 * s], [x + 220 * s, y]], '#8a6542', 5);
  p.poly([[x - 160 * s, y - 70 * s], [x - 90 * s, y - 100 * s], [x + 90 * s, y - 100 * s], [x + 160 * s, y - 70 * s]], '#6e7f74', 5);
  p.rect(x - 30 * s, y - 135 * s, 60 * s, 35 * s, '#efe9da', 4);
  p.hatch(x + 120 * s, y, 230 * s, base - y, .12);
}
function paintParliament(p, x, base, w = 900, h = 400) { // neoclassical Parliament House
  p.rect(x, base - h, w, h, '#ddd3bc', 5);
  p.rect(x - 15, base - h - 30, w + 30, 34, '#cfc4aa', 5);
  for (let k = 0; k < 24; k++) p.rect(x + 10 + k * (w - 20) / 24, base - h - 62, 12, 32, '#e6dcc6', 2);
  p.rect(x - 15, base - h - 70, w + 30, 12, '#cfc4aa', 4);
  for (let r = 0; r < 2; r++) for (let k = 0; k < 10; k++) p.win(x + 40 + k * (w - 80) / 10, base - h + 60 + r * 140, 40, 80, { sill:'#c3b79c' });
  const cw = w * .5, cx = x + w * .25;
  p.rect(cx, base - h - 10, cw, 30, '#cfc4aa', 4);
  for (let k = 0; k < 9; k++) { const qx = cx + 12 + k * (cw - 24) / 8 - 14; p.rect(qx, base - h + 20, 28, h - 70, '#f3ecdb', 4); p.rect(qx - 6, base - h + 16, 40, 12, '#e6dcc6', 3); }
  for (let k = 0; k < 5; k++) p.rect(cx - 40 - k * 14, base - 50 + k * 10, cw + 80 + k * 28, 10, '#bdb39b', 3);
  p.hatch(x + w * .82, base - h, w * .18, h, .1);
}
function paintSkyTower(p, x, base, s = 1) {
  const top = base - 860 * s;
  p.poly([[x - 26 * s, base], [x - 16 * s, top + 200 * s], [x + 16 * s, top + 200 * s], [x + 26 * s, base]], '#d8d8d8', 4);
  p.g.fillStyle = '#b8b8b8'; p.g.fillRect(x + 4 * s, top + 200 * s, 12 * s, base - top - 200 * s);
  p.rrect(x - 90 * s, top + 160 * s, 180 * s, 50 * s, 20 * s, '#c9cdd2', 4);
  p.rrect(x - 75 * s, top + 120 * s, 150 * s, 45 * s, 18 * s, '#8fa4ba', 4);
  p.rrect(x - 55 * s, top + 90 * s, 110 * s, 32 * s, 14 * s, '#c9cdd2', 4);
  p.poly([[x - 12 * s, top + 92 * s], [x - 4 * s, top], [x + 4 * s, top], [x + 12 * s, top + 92 * s]], '#eeeeee', 3);
  p.ell(x, top - 4 * s, 6 * s, 6 * s, '#ff3030', 2);
}
function paintCathedral(p, x, base) { // ChristChurch Cathedral, mid-restoration
  const stone = '#c6b48f', slate = '#5f636c';
  p.rect(x, base - 340, 700, 340, stone, 5);
  p.poly([[x - 10, base - 340], [x + 350, base - 520], [x + 710, base - 340]], slate, 5);
  for (let k = 0; k < 5; k++) p.win(x + 90 + k * 120, base - 280, 50, 170, { gothic:true, glass:'#4a5f8a' });
  // west front with rose window
  p.rect(x + 700, base - 420, 320, 420, shade(stone, .05), 5);
  p.poly([[x + 690, base - 420], [x + 860, base - 560], [x + 1030, base - 420]], shade(stone, .05), 5);
  p.ell(x + 860, base - 300, 90, 90, '#2d3f6e', 5);
  for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2; p.line([[x + 860, base - 300], [x + 860 + Math.cos(a) * 88, base - 300 + Math.sin(a) * 88]], 3); }
  ['#d8232f', '#f5c400', '#3a8a3a', '#3f8fe0'].forEach((c, k) => { const a = k * 1.6; p.ell(x + 860 + Math.cos(a) * 50, base - 300 + Math.sin(a) * 50, 18, 18, c, 2); });
  p.gothic(x + 815, base, 90, 150, '#5a3d26', 5);
  // the tower stump, braced in steel, and a tower crane
  p.rect(x - 220, base - 480, 230, 480, stone, 5);
  p.poly([[x - 220, base - 480], [x - 180, base - 530], [x - 110, base - 500], [x - 40, base - 545], [x + 10, base - 480]], stone, 5);
  for (let k = 0; k < 3; k++) p.win(x - 170 + k * 60, base - 400, 34, 120, { gothic:true, glass:'#3a4a6a' });
  for (let i = 0; i <= 7; i++) p.line([[x - 250 + i * 40, base], [x - 250 + i * 40, base - 560]], 4, '#8a8a8a');
  for (let j = 0; j <= 9; j++) p.line([[x - 260, base - j * 62], [x + 40, base - j * 62]], 4, '#8a8a8a');
  for (let j = 0; j < 9; j++) p.line([[x - 250, base - j * 62], [x + 30, base - (j + 1) * 62]], 2, '#9a9a9a');
  const cx = x + 1200;
  for (let j = 0; j < 14; j++) { p.rect(cx, base - 60 - j * 55, 40, 55, '#f5c400', 3); p.line([[cx, base - 60 - j * 55], [cx + 40, base - 115 - j * 55]], 2); }
  p.rect(cx - 520, base - 840, 760, 30, '#f5c400', 4); p.rect(cx - 20, base - 880, 80, 70, '#f5c400', 4);
  p.line([[cx - 420, base - 810], [cx - 420, base - 600]], 2); p.rect(cx - 440, base - 600, 40, 30, '#555', 3);
  p.signboard('RESTORATION: ANY DECADE NOW', x + 300, base - 120, 440, 56, '#ffd23f', '#111');
}
function paintSteamer(p, x, y, s = 1) { // TSS Earnslaw-ish twin-funnel lake steamer
  p.poly([[x - 300 * s, y - 40 * s], [x + 320 * s, y - 40 * s], [x + 270 * s, y + 20 * s], [x - 270 * s, y + 20 * s]], '#1c1c1c', 4);
  p.rect(x - 290 * s, y - 80 * s, 590 * s, 42 * s, '#fafafa', 4);
  p.rect(x - 200 * s, y - 120 * s, 380 * s, 42 * s, '#fafafa', 4);
  for (let k = 0; k < 12; k++) p.rect(x - 270 * s + k * 46 * s, y - 70 * s, 22 * s, 18 * s, '#3a4a5a', 2);
  p.rect(x - 30 * s, y - 230 * s, 50 * s, 112 * s, '#c8102e', 4); p.rect(x - 30 * s, y - 230 * s, 50 * s, 18 * s, '#111', 3);
  p.blobs([[x, y - 270 * s, 30 * s], [x + 40 * s, y - 310 * s, 38 * s], [x + 100 * s, y - 340 * s, 44 * s]], '#7a7a80', 4, undefined, null);
}
function paintTreatyHouse(p, x, base, s = 1) {
  const w = 620 * s, h = 220 * s;
  p.rect(x, base - h, w, h, '#f6f4ec', 5);
  for (let k = 1; k < 10; k++) p.line([[x, base - h + k * h / 10], [x + w, base - h + k * h / 10]], 1.5, '#cfcabb');
  p.poly([[x - 40 * s, base - h], [x + 90 * s, base - h - 150 * s], [x + w - 90 * s, base - h - 150 * s], [x + w + 40 * s, base - h]], '#8a8f96', 5);
  p.rect(x + w * .7, base - h - 210 * s, 40 * s, 90 * s, '#b0a090', 4);
  p.poly([[x - 30 * s, base - h * .72], [x + w + 30 * s, base - h * .72], [x + w + 50 * s, base - h * .6], [x - 50 * s, base - h * .6]], '#8a8f96', 4);
  for (let k = 0; k <= 8; k++) p.rect(x - 30 * s + k * (w + 60 * s) / 8 - 5 * s, base - h * .6, 10 * s, h * .6, '#ffffff', 3);
  for (let k = 0; k < 4; k++) p.win(x + 60 * s + k * 140 * s, base - h * .55, 60 * s, 100 * s, { glass:'#4a6080', sill:'#ddd' });
  p.rect(x - 60 * s, base - 14 * s, w + 120 * s, 14 * s, '#d8d2c2', 4);
}
function paintVolcano(p, x, base, w, h, snow, steam) {
  p.range(base, [[x - w * .08, base - h], [x + w * .08, base - h * .98]], '#5a5560', snow);
  if (steam) p.blobs([[x, base - h - 40, 50], [x + 50, base - h - 110, 70], [x + 140, base - h - 180, 90], [x + 260, base - h - 230, 100]], '#eef0f3', 4, '#c8ccd4', null);
}
function paintDC3(p, x, y, s = 1) {
  p.rect(x - 8 * s, y, 16 * s, 230 * s, '#666', 4);
  p.poly([[x - 330 * s, y - 20 * s], [x + 250 * s, y - 40 * s], [x + 320 * s, y - 10 * s], [x + 250 * s, y + 30 * s], [x - 300 * s, y + 10 * s]], '#d8dde2', 5);
  p.poly([[x - 300 * s, y - 16 * s], [x - 360 * s, y - 110 * s], [x - 300 * s, y - 110 * s], [x - 230 * s, y - 24 * s]], '#c8ced4', 4);
  p.poly([[x - 80 * s, y + 4 * s], [x + 120 * s, y], [x + 90 * s, y + 60 * s], [x - 120 * s, y + 64 * s]], '#bcc3ca', 4);
  for (let k = 0; k < 8; k++) p.rect(x - 200 * s + k * 50 * s, y - 24 * s, 22 * s, 18 * s, '#2a3a4a', 2);
  p.ell(x + 40 * s, y + 20 * s, 30 * s, 22 * s, '#666', 4);
  p.line([[x - 250 * s, y + 4 * s], [x + 280 * s, y - 10 * s]], 5, '#c8102e');
}
function hills(p, base, amp, col, n = 5, houses = 0, seedOff = 0) {
  const pts = [[0, base + 200]];
  for (let x = 0; x <= p.W; x += 64) pts.push([x, base - amp * (.6 + .4 * Math.sin(x / 700 * n / 5 + seedOff) * Math.sin(x / 260 + seedOff * 2))]);
  pts.push([p.W, base + 200]); p.poly(pts, col, 5);
  for (let i = 0; i < houses; i++) {
    const x = p.r(0, p.W), k = Math.floor(x / 64), y = pts[Math.min(pts.length - 2, k + 1)][1] + p.r(20, 120);
    if (y > base + 150) continue;
    p.rect(x, y - 22, 34, 22, pick(['#f4efe2', '#e8c87a', '#c8d8e8', '#e8a090', '#ffffff']), 2);
    p.poly([[x - 4, y - 22], [x + 17, y - 36], [x + 38, y - 22]], pick(['#b03a2e', '#3a4a5a', '#5a6a3a']), 2);
  }
}

const STAGES = [
  { id:'beehive', name:'The Beehive, Wellington', desc:'Windy Welly. Watch for the southerly gusts.', sky:['#6f8fb8', '#dfe7ef'], fog:0xc8d0da, sun:0xffffff, wind:true,
    build(g) {
      floor(g, 'paving', '#a8a49c');
      backdrop(g, (p, W, H, GY) => {
        p.sky([[0, '#5f86bd'], [.7, '#c8d8ea'], [1, '#e8eef2']]);
        for (let i = 0; i < 14; i++) p.streak(p.r(0, W), p.r(60, 420), p.r(240, 520), p.r(26, 40), '#f4f7fb');
        hills(p, 560, 140, '#5f8a4a', 6, 120, 1.3);
        hills(p, 700, 80, '#4f7f3e', 4, 60, 3.1);
        for (let x = 60; x < 1150; x += 150) p.facade(x, GY - 40, 140, p.r(260, 420), { col:pick(['#d9cdb4', '#c8d2dc', '#e6dfd0']), shop:p.r() < .5 ? pick(['#c8102e', '#1b3f8f']) : null });
        paintBeehive(p, 1720, GY - 40, .95);
        paintParliament(p, 2260, GY - 40, 940, 400);
        p.signboard('PARLIAMENT', 2730, GY - 500, 360, 70, '#ddd3bc', '#3a352c');
        for (let x = 3300; x < W; x += 150) p.facade(x, GY - 40, 140, p.r(260, 420), { col:pick(['#d9cdb4', '#c8d2dc', '#e6dfd0']) });
        p.rect(0, GY - 40, W, 200, '#5f9a48', 0);
        for (const x of [1150, 1290, 2150, 3230, 3400, 900]) p.tree(x, GY - 20, p.r(190, 240), pick(['#3f7f35', '#4a8a3a']));
        p.rect(0, GY - 6, W, 100, '#a8a49c', 0);
      });
      for (let i = 0; i < 3; i++) BOX(g, 30, .3, .8, 0xd3cdbf, 0, .15 + i * .3, -8.5 - i * .8, { olw:.03 });
      CYL(g, .07, .09, 10, 0xdddddd, 14, 5, -12, { olw:.03 });
      this.flag = wavingFlag(g, 14.07, 9.3, -12);
    },
    tick(dt, t) { this.flag(t, 1 + Math.abs(game.wind) * .6); } },

  { id:'viaduct', name:'The Viaduct, Auckland', desc:'Superyachts, sunsets and a suspicious number of road cones.', sky:['#4b2e7a', '#ffb36b'], fog:0xf0a878, sun:0xffc58a,
    build(g) {
      floor(g, 'planks', '#9a7048');
      backdrop(g, (p, W, H, GY) => {
        p.sky([[0, '#3d2a6e'], [.45, '#b8507a'], [.75, '#ff9a5a'], [.9, '#ffd28a']], 760);
        p.g.save(); p.g.globalAlpha = .9; p.g.fillStyle = p.grad(0, 520, 0, 780, [[0, '#ffe7a0'], [1, '#ff9a4a']]); p.g.beginPath(); p.g.arc(2900, 700, 120, 0, 7); p.g.fill(); p.g.restore();
        for (let i = 0; i < 9; i++) p.streak(p.r(0, W), p.r(100, 480), p.r(260, 600), p.r(20, 34), pick(['#ffc8a0', '#f0a0b0', '#d88aa8']));
        for (let i = 0; i < 40; i++) { const w = p.r(80, 200), h = p.r(120, 420), x = 1200 + i * 60 + p.r(-30, 30);
          p.rect(x, 740 - h, w, h, pick(['#3b3f6a', '#4a4a7a', '#2c3050', '#5a5288']), 4);
          for (let r = 0; r < h / 40 - 1; r++) for (let k = 0; k < w / 34 - 1; k++) if (p.r() < .4) p.rect(x + 12 + k * 34, 740 - h + 16 + r * 40, 14, 18, '#ffd88a', 0); }
        paintSkyTower(p, 2300, 740, .95);
        // harbour bridge
        p.poly([[0, 640], [1300, 640], [1300, 664], [0, 664]], '#7a8590', 4);
        for (let k = 0; k < 7; k++) p.rect(80 + k * 190, 664, 30, 100, '#6b737c', 3);
        for (let k = 0; k <= 12; k++) { const x = 500 + k * 50, hh = Math.sin(k / 12 * Math.PI) * 110; p.line([[x, 640], [x, 640 - hh]], 4, '#5f6f7f'); }
        p.line([[500, 640], ...Array.from({ length:13 }, (_, k) => [500 + k * 50, 640 - Math.sin(k / 12 * Math.PI) * 110])], 6, '#5f6f7f');
        p.sea(740, GY, '#c86a6a', '#2a3a6a', '#ffd0a0');
        for (let i = 0; i < 7; i++) { const x = 300 + i * 560 + p.r(-80, 80), y = 860 + (i % 2) * 40, s = p.r(.8, 1.2);
          p.line([[x + 40 * s, y - 20], [x + 40 * s, y - 470 * s]], 5);
          p.poly([[x + 44 * s, y - 460 * s], [x + 44 * s, y - 60], [x + 220 * s, y - 60]], pick(['#f6f2e8', '#f6f2e8', '#222']), 4);
          p.poly([[x - 160 * s, y - 50], [x + 260 * s, y - 50], [x + 210 * s, y], [x - 130 * s, y]], '#ffffff', 4);
          p.rect(x - 60 * s, y - 80, 160 * s, 30, '#223344', 3); }
        p.signboard('CITY OF SAILS (AND CONES)', 1500, 560, 560, 70, '#ff6a00');
        p.rect(0, GY - 10, W, 100, '#8a6440', 4);
      }, { kerb:0x7a5838 });
      for (const [x, z] of [[-11, 3], [-9.8, 3.2], [10.5, 3], [11.6, 2.8], [-12.5, -2.5], [12.8, -2.8]]) {
        CONE(g, .35, .9, 0xff6a00, x, .45, z, { olw:.03 }); CYL(g, .22, .27, .12, 0xffffff, x, .5, z, { ol:false });
        BOX(g, .8, .06, .8, 0xff6a00, x, .03, z, { ol:false });
      }
      for (let i = -12; i <= 12; i += 4) CYL(g, .25, .3, .6, 0x333333, i, .3, -6, { olw:.03 });
    } },

  { id:'cathedral', name:'Cathedral Square, Christchurch', desc:'The cathedral is still being fixed. The tram is still running.', sky:['#4f9de0', '#d9efff'], fog:0xd2e6f7, sun:0xfff3dc,
    build(g) {
      floor(g, 'paving', '#9c968c');
      backdrop(g, (p, W, H, GY) => {
        p.sky([[0, '#3f8fd8'], [1, '#d9efff']]);
        for (let i = 0; i < 7; i++) p.cloud(p.r(0, W), p.r(120, 380), p.r(70, 120));
        for (let x = 0; x < W; x += 220) p.rect(x, GY - p.r(500, 720), 200, 800, pick(['#9fb8cc', '#c0ccd4', '#8aa4b8']), 4);
        for (let x = 0; x < 1250; x += 170) p.facade(x, GY - 30, 160, p.r(280, 400), { col:pick(['#e8dcc0', '#d0c8b8', '#f0e8d8']), shop:p.r() < .6 ? pick(['#2d9b3a', '#c8102e', '#3f8fe0']) : null, box:true });
        paintCathedral(p, 1650, GY - 30);
        for (let x = 3050; x < W; x += 170) p.facade(x, GY - 30, 160, p.r(280, 400), { col:pick(['#e8dcc0', '#d0c8b8', '#f0e8d8']), shop:p.r() < .6 ? pick(['#f5c400', '#c8102e']) : null, goods:true });
        // the Chalice
        p.poly([[2900, GY - 30], [2880, GY - 140], [2720, GY - 520], [3100, GY - 520], [2940, GY - 140], [2920, GY - 30]], '#5f7f6a', 5);
        for (let k = 0; k < 8; k++) p.line([[2900 + (k - 3.5) * 8, GY - 140], [2730 + k * 52, GY - 515]], 2.5);
        for (const x of [1300, 1450, 3020, 3200]) p.tree(x, GY - 10, p.r(180, 230));
        p.rect(0, GY - 10, W, 100, '#9c968c', 0);
      });
      BOX(g, 80, .04, .12, 0x555555, 0, .02, -7.6, { ol:false, cast:false }); BOX(g, 80, .04, .12, 0x555555, 0, .02, -8.6, { ol:false, cast:false });
      this.tram = new THREE.Group(); this.tram.position.set(-30, 0, -8.1); g.add(this.tram);
      BOX(this.tram, 6, 2.4, 2.2, 0x7a1f1f, 0, 1.6, 0);
      BOX(this.tram, 6.2, .3, 2.4, 0xe8dcc0, 0, 2.95, 0);
      for (let i = 0; i < 5; i++) BOX(this.tram, .8, .8, 2.25, 0xfaf3d6, -2.2 + i * 1.1, 2, 0, { ol:false });
      BOX(this.tram, 6, .5, 2.25, 0x2a4a2a, 0, .55, 0, { olw:.03 });
    },
    tick(dt) { this.tram.position.x += dt * 3; if (this.tram.position.x > 35) this.tram.position.x = -35; } },

  { id:'octagon', name:'The Octagon, Dunedin', desc:'Scotland, but further south. Bring a jersey. Baldwin St looms.', sky:['#7c8792', '#c7ccd1'], fog:0xb7bcc2, sun:0xe0e4ea,
    build(g) {
      floor(g, 'bricks', '#9a5a48');
      backdrop(g, (p, W, H, GY) => {
        p.sky([[0, '#6e7884'], [1, '#c9ced3']]);
        for (let i = 0; i < 10; i++) p.cloud(p.r(0, W), p.r(80, 300), p.r(110, 170), '#b8bec6', '#9aa2ac');
        hills(p, 520, 120, '#4f6a48', 5, 150, .7);
        // Baldwin St, on the hill
        p.poly([[600, 680], [1000, 420], [1040, 440], [640, 700]], '#555', 3);
        for (let k = 0; k < 6; k++) { const x = 620 + k * 66, y = 660 - k * 44; p.rect(x, y - 40, 40, 34, pick(['#e8d8b0', '#b05050', '#5a7aa0']), 2); p.poly([[x - 4, y - 40], [x + 20, y - 58], [x + 44, y - 40]], '#7a2a2a', 2); }
        p.signboard("WORLD'S STEEPEST STREET", 820, 380, 420, 52, '#ffd23f', '#111');
        for (let x = 0; x < W; x += 180) if (x < 1300 || x > 3000) p.facade(x, GY - 30, 170, p.r(300, 450), { col:pick(['#cfc2a3', '#b8a890', '#d8d0bc', '#a8887a']), arch:true, shop:p.r() < .6 ? pick(['#1b3f8f', '#2d6a3a', '#7a1f1f']) : null });
        // St Paul's: twin towers
        const sx = 1400; p.rect(sx, GY - 420, 560, 390, '#d6cfbe', 5);
        p.poly([[sx - 10, GY - 420], [sx + 280, GY - 560], [sx + 570, GY - 420]], '#5a6068', 5);
        for (const tx of [sx - 60, sx + 520]) { p.rect(tx, GY - 700, 100, 670, '#ddd6c5', 5); p.poly([[tx - 8, GY - 700], [tx + 50, GY - 790], [tx + 108, GY - 700]], '#5a6068', 4); p.win(tx + 30, GY - 640, 40, 120, { gothic:true }); }
        p.gothic(sx + 230, GY - 30, 120, 190, '#5a3d26', 5); p.ell(sx + 290, GY - 330, 60, 60, '#3a4a7a', 4);
        // Municipal Chambers with clock tower
        const mx = 2350; p.rect(mx, GY - 380, 640, 350, '#cfc2a3', 5);
        for (let r = 0; r < 2; r++) for (let k = 0; k < 7; k++) p.win(mx + 40 + k * 86, GY - 340 + r * 130, 40, 84, { arch:true, sill:'#b0a488' });
        p.rect(mx + 250, GY - 880, 140, 520, '#d3c7a9', 5);
        p.poly([[mx + 240, GY - 880], [mx + 320, GY - 1010], [mx + 400, GY - 880]], '#4a5a6a', 5);
        p.ell(mx + 320, GY - 780, 46, 46, '#ffffff', 5); p.line([[mx + 320, GY - 780], [mx + 320, GY - 812]], 4); p.line([[mx + 320, GY - 780], [mx + 342, GY - 780]], 4);
        // Rabbie Burns, ever-unimpressed
        const bx = 2100; p.rect(bx - 70, GY - 220, 140, 190, '#8e8a82', 5);
        p.rrect(bx - 50, GY - 330, 100, 120, 30, '#3b4a3a', 4); p.ell(bx, GY - 350, 30, 34, '#3b4a3a', 4);
        p.text('BURNS', bx, GY - 130, 34, '#ddd');
        for (const x of [1250, 2050, 3050, 3150]) p.tree(x, GY - 10, p.r(170, 210), '#3a6a35');
        p.g.save(); p.g.globalAlpha = .25; for (let i = 0; i < 500; i++) { const x = p.r(0, W), y = p.r(0, H); p.line([[x, y], [x - 8, y + 30]], 2, '#e8eef5'); } p.g.restore();
        p.rect(0, GY - 10, W, 100, '#9a5a48', 0);
      });
      const N = 900, pos = new Float32Array(N * 3);
      for (let i = 0; i < N; i++) { pos[i * 3] = rand(-18, 18); pos[i * 3 + 1] = rand(0, 14); pos[i * 3 + 2] = rand(-12, 8); }
      const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      this.rain = new THREE.Points(geo, new THREE.PointsMaterial({ color:0xdde8f5, size:.06, transparent:true, opacity:.7 })); g.add(this.rain);
    },
    tick(dt) {
      const a = this.rain.geometry.attributes.position.array;
      for (let i = 1; i < a.length; i += 3) { a[i] -= dt * 9; a[i - 1] += dt * 1.2; if (a[i] < 0) { a[i] = 14; a[i - 1] = rand(-18, 18); } }
      this.rain.geometry.attributes.position.needsUpdate = true;
    } },

  { id:'queenstown', name:'Queenstown Waterfront', desc:'Lake Wakatipu, The Remarkables, and a $28 burger on the line.', sky:['#2f7fd6', '#c4e4ff'], fog:0xbfdcf3, sun:0xffffff,
    build(g) {
      floor(g, 'paving', '#b8a990');
      backdrop(g, (p, W, H, GY) => {
        p.sky([[0, '#2a78d0'], [1, '#cde8ff']]);
        for (let i = 0; i < 6; i++) p.cloud(p.r(0, W), p.r(80, 260), p.r(70, 110));
        p.range(660, [[300, 300], [520, 360], [760, 220], [980, 320], [1200, 180], [1420, 300], [1600, 240], [1850, 340], [2100, 200], [2350, 290], [2600, 170], [2820, 300], [3050, 230], [3300, 330], [3550, 210], [3800, 300]], '#6a6488', .32);
        p.range(700, [[100, 560], [700, 520], [1500, 590], [2400, 540], [3300, 580], [4000, 530]], '#3f6a45', 0, 4);
        p.sea(690, 880, '#3a8ac0', '#1d5f8f');
        paintSteamer(p, 2650, 820, .9);
        for (let x = 0; x < 1300; x += 190) p.facade(x, GY - 30, 180, p.r(240, 340), { col:pick(['#e8dcc0', '#b88a5a', '#d8e0e8', '#8a6a4a']), shop:pick(['#2d6a3a', '#c8102e', '#1b3f8f']), goods:p.r() < .4 });
        p.signboard('$28 BURGERS', 760, GY - 420, 300, 60, '#c8102e');
        // jetty
        p.rect(1500, 850, 800, 24, '#8a6a48', 4); for (let k = 0; k < 9; k++) p.rect(1510 + k * 95, 874, 14, 60, '#6a4a30', 3);
        for (let x = 3200; x < W; x += 140) p.pine(x, GY - 10, p.r(260, 360));
        for (const x of [1350, 1440, 2400]) p.pine(x, GY - 10, p.r(260, 330));
        p.signboard('ADVENTURE CAPITAL OF THE WORLD', 2050, 610, 640, 60, '#1d5f8f');
        p.rect(0, GY - 10, W, 100, '#b8a990', 0);
      });
    } },

  { id:'waitangi', name:'Waitangi Treaty Grounds', desc:'Where every politician gets told what the people think of them. Annually.', sky:['#3a8fe0', '#e3f4ff'], fog:0xd7ecfa, sun:0xfff2cf,
    build(g) {
      floor(g, 'grass', '#5f9a3e');
      backdrop(g, (p, W, H, GY) => {
        p.sky([[0, '#3486dc'], [1, '#e3f4ff']], 620);
        for (let i = 0; i < 6; i++) p.cloud(p.r(0, W), p.r(100, 300), p.r(70, 120));
        p.sea(600, 820, '#4ab0d0', '#2a7fb0');
        for (const [x, w, h] of [[300, 500, 70], [1100, 300, 50], [2700, 700, 90], [3600, 420, 60]]) { p.g.beginPath(); p.g.ellipse(x, 610, w / 2, h, 0, Math.PI, 0); p.fs('#3f7a35', 4); }
        hills(p, 760, 60, '#6aa84a', 3, 0, 2.2);
        paintTreatyHouse(p, 1500, GY - 60, 1.15);
        for (const x of [500, 950, 2500, 2950, 3450]) p.pohutukawa(x, GY - 40, p.r(380, 460));
        p.rect(0, GY - 50, W, 120, '#5f9a3e', 0);
      }, { kerb:0xd8d2c2 });
      CYL(g, .18, .3, 22, 0xf2f2f2, 13, 11, -14, { olw:.05 });
      BOX(g, 6, .15, .15, 0xf2f2f2, 13, 18, -14, { olw:.03 });
      this.flags = [wavingFlag(g, 13.2, 20.5, -14, 3, 1.5), wavingFlag(g, 10.2, 17.3, -14, 2, 1), wavingFlag(g, 15.8, 17.3, -14, 2, 1)];
    },
    tick(dt, t) { this.flags.forEach((f, i) => f(t + i, 1)); } },

  { id:'taupo', name:'Lake Taupō', desc:'Volcanoes on the horizon. A DC-3 you can eat lunch in. Try not to erupt.', sky:['#4a86c8', '#f5e3c4'], fog:0xe6dccb, sun:0xfff0d0,
    build(g) {
      floor(g, 'grass', '#6f9a48');
      backdrop(g, (p, W, H, GY) => {
        p.sky([[0, '#3f7fc8'], [1, '#f5e3c4']], 700);
        for (let i = 0; i < 6; i++) p.cloud(p.r(0, W), p.r(80, 280), p.r(70, 110));
        paintVolcano(p, 900, 660, 1100, 230, .3, false);       // Tongariro
        paintVolcano(p, 2000, 660, 700, 390, .22, true);       // Ngauruhoe, steaming
        paintVolcano(p, 3100, 660, 1300, 300, .55, false);     // Ruapehu
        p.sea(650, 860, '#5a9ac8', '#2a6f9a');
        p.rect(0, 860, W, 140, '#d8c8a0', 4);
        paintDC3(p, 2900, GY - 330, .95);
        p.signboard('LUNCH IN A DC-3', 2900, GY - 420, 340, 56, '#ffd23f', '#111');
        for (const x of [200, 380, 600, 1300, 1500, 3500, 3700, 3900]) p.pine(x, GY - 10, p.r(260, 360));
        p.rect(0, GY - 10, W, 100, '#6f9a48', 0);
      }, { kerb:0xd8c8a0 });
    } },

  { id:'mauao', name:'Summit of Mauao, Mt Maunganui', desc:'252 metres up. Panoramic views. Sheep with opinions.', sky:['#2a8ae6', '#e8f6ff'], fog:0xd8eefb, sun:0xffffff,
    build(g) {
      floor(g, 'grass', '#6aa84f');
      backdrop(g, (p, W, H, GY) => {
        p.sky([[0, '#2484e0'], [1, '#e8f6ff']], 520);
        for (let i = 0; i < 8; i++) p.cloud(p.r(0, W), p.r(100, 360), p.r(60, 100));
        p.sea(500, 900, '#4aa8e0', '#1d6aa8');
        // the town and the port, far below
        p.poly([[1000, 900], [1300, 720], [2200, 690], [3100, 720], [3500, 900]], '#e8d6a0', 4);
        for (let i = 0; i < 90; i++) { const x = p.r(1350, 3050), y = p.r(700, 800); p.rect(x, y - 14, 14, 14, pick(['#f4f4f4', '#e8d0a0', '#c8d8e8']), 1.5); }
        for (let k = 0; k < 6; k++) { const x = 1500 + k * 120; p.line([[x, 690], [x, 620], [x + 60, 620]], 4, '#d83a2a'); }
        for (let k = 0; k < 3; k++) { const x = 2600 + k * 320, y = 600 + k * 30; p.rect(x, y, 220, 26, '#223a5a', 3); for (let j = 0; j < 5; j++) p.rect(x + 20 + j * 36, y - 18, 32, 18, pick(['#c8102e', '#ffa500', '#2e7d32', '#3f8fe0']), 2); }
        p.g.beginPath(); p.g.ellipse(700, 520, 520, 40, 0, Math.PI, 0); p.fs('#4f8a3a', 4);
        // summit slopes framing the view
        p.poly([[0, 560], [500, 640], [900, 800], [1100, 1024], [0, 1024]], '#5f9a45', 5);
        p.poly([[W, 600], [3600, 680], [3200, 820], [3000, 1024], [W, 1024]], '#5f9a45', 5);
        for (let i = 0; i < 120; i++) { const x = p.r(0, W), y = p.r(820, 960); p.line([[x, y], [x + 4, y - 16]], 3, '#3f7a30'); }
        p.rect(0, GY - 60, W, 140, '#6aa84f', 0);
      }, { kerb:null });
      CYL(g, .45, .55, 1.6, 0xffffff, -5, .8, -6, { seg:4, olw:.04 });
      sign(g, 'TRIG STATION · 252m', 2.2, .4, -5, 1.95, -5.5, { bg:'#ffffff', fg:'#111', font:'54px Bangers' });
      this.sheep = [];
      for (let i = 0; i < 6; i++) {
        const s = new THREE.Group(); s.position.set(rand(-12, 12), 0, rand(-10, -4.5)); g.add(s);
        SPH(s, .7, 0xfafafa, 0, .9, 0, { seg:10, seg2:8 }).scale.set(1.3, 1, 1);
        SPH(s, .32, 0x1a1a1a, .9, 1.1, 0, { seg:8, seg2:6 });
        for (const [x, z] of [[.5, .3], [.5, -.3], [-.5, .3], [-.5, -.3]]) CYL(s, .07, .07, .6, 0x1a1a1a, x, .3, z, { olw:.02 });
        this.sheep.push({ g:s, tx:s.position.x, tz:s.position.z, t:rand(0, 4) });
      }
    },
    tick(dt) {
      for (const s of this.sheep) {
        s.t -= dt;
        if (s.t < 0) { s.t = rand(2, 6); s.tx = rand(-13, 13); s.tz = rand(-11, -4.5); }
        const dx = s.tx - s.g.position.x, dz = s.tz - s.g.position.z, d = Math.hypot(dx, dz);
        if (d > .2) { s.g.position.x += dx / d * dt * .8; s.g.position.z += dz / d * dt * .8; s.g.rotation.y = Math.atan2(-dz, dx); s.g.position.y = Math.abs(Math.sin(performance.now() / 120)) * .08; }
      }
    } },
];

let stageGroup = null, stage = null;
function buildStage(st) {
  if (stageGroup) { scene.remove(stageGroup); disposeObj(stageGroup); }
  stageGroup = new THREE.Group(); scene.add(stageGroup); stage = st;
  if (scene.background) scene.background.dispose();
  scene.background = skyTex(st.sky[0], st.sky[1]);
  scene.fog = new THREE.Fog(st.fog, 45, 160);
  sun.color.set(st.sun);
  st.build(stageGroup);
}

// =====================================================================

export { INK, shade, Pn, BD, backdrop, floor, paintBeehive, paintParliament, paintSkyTower, paintCathedral, paintSteamer, paintTreatyHouse, paintVolcano, paintDC3, hills, STAGES, stageGroup, stage, buildStage };
