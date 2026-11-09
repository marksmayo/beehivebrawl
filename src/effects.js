import * as THREE from 'three';
import { sfx } from './audio.js';
import { applyHit } from './combat.js';
import { bubble, floater } from './dom.js';
import { game } from './game.js';
import { BOX, CYL, disposeObj, outline, sign, toon } from './kit.js';
import { scene } from './renderer.js';
import { pick, rand } from './util.js';

// Effects system (projectiles, particles, supers)

const effects = [];
const addFx = e => (effects.push(e), e);
function updateFx(dt) { for (let i = effects.length - 1; i >= 0; i--) if (!effects[i].update(dt)) { effects[i].dispose?.(); effects.splice(i, 1); } }
function clearFx() { effects.forEach(e => e.dispose?.()); effects.length = 0; }
function rm(o) { scene.remove(o); disposeObj(o); }

const sparkGeo = new THREE.BoxGeometry(.13, .13, .13);
function sparks(x, y, color, n = 12, speed = 6, life = .45) {
  const mat = new THREE.MeshBasicMaterial({ color, transparent:true }), parts = [];
  for (let i = 0; i < n; i++) {
    const m = new THREE.Mesh(sparkGeo, mat); m.position.set(x, y, rand(-.3, .3) + .4); scene.add(m);
    parts.push({ m, v:new THREE.Vector3(rand(-1, 1), rand(-.2, 1.3), rand(-.5, .5)).normalize().multiplyScalar(speed * rand(.5, 1.2)) });
  }
  let t = life;
  addFx({ update(dt) { t -= dt; for (const p of parts) { p.v.y -= 16 * dt; p.m.position.addScaledVector(p.v, dt); p.m.rotation.x += dt * 12; p.m.rotation.y += dt * 9; } mat.opacity = t / life; return t > 0; },
    dispose() { parts.forEach(p => scene.remove(p.m)); mat.dispose(); } });
}
function impactStar(x, y, color = 0xffffff, size = 1) { // flat comic impact star facing camera
  const s = new THREE.Shape();
  for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2, r = i % 2 ? .35 : 1; i ? s.lineTo(Math.cos(a) * r, Math.sin(a) * r) : s.moveTo(r, 0); }
  const m = new THREE.Mesh(new THREE.ShapeGeometry(s), new THREE.MeshBasicMaterial({ color, transparent:true, depthTest:false }));
  m.position.set(x, y, .9); m.renderOrder = 10; m.rotation.z = rand(0, 6); scene.add(m);
  const ol = new THREE.Mesh(m.geometry, new THREE.MeshBasicMaterial({ color:0x000000, transparent:true, depthTest:false }));
  ol.scale.setScalar(1.18); ol.position.z = -.01; ol.renderOrder = 9; m.add(ol);
  let t = 0;
  addFx({ update(dt) { t += dt; const k = size * (.4 + t * 5); m.scale.setScalar(k); m.material.opacity = ol.material.opacity = 1 - t / .2; return t < .2; },
    dispose() { scene.remove(m); m.geometry.dispose(); m.material.dispose(); ol.material.dispose(); } });
}
const dustGeo = new THREE.SphereGeometry(.3, 8, 6);
function dust(x, size = .5, n = 5) { // cartoon dust puffs at the feet (landings, dashes, KOs)
  const mat = toon(0xe8dcc4, { opacity:.9 }), puffs = [];
  for (let i = 0; i < n; i++) {
    const m = new THREE.Mesh(dustGeo, mat); m.position.set(x + rand(-.4, .4) * size * 2, .15, rand(-.4, .4)); m.scale.setScalar(size * rand(.6, 1.1)); scene.add(m);
    puffs.push({ m, vx:rand(-1.4, 1.4), s:m.scale.x });
  }
  let t = 0;
  addFx({ update(dt) { t += dt; for (const p of puffs) { p.m.position.x += p.vx * dt; p.m.position.y += dt * .5; p.m.scale.setScalar(p.s * (1 + t * 2.5)); } mat.opacity = Math.max(0, .9 - t * 1.6); return t < .55; },
    dispose() { puffs.forEach(p => scene.remove(p.m)); mat.dispose(); } });
}
// motion trail for a fast limb: a fading arc swept around the joint (smear, item 35)
function trail(f, part, from, to) {
  const g = new THREE.RingGeometry(.35, .8, 20, 1, Math.min(from, to), Math.abs(to - from));
  const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color:0xffffff, transparent:true, opacity:.55, side:THREE.DoubleSide, depthWrite:false }));
  part.getWorldPosition(m.position); m.position.z += .35; m.scale.x = f.facing; m.rotation.z = -Math.PI / 2 * f.facing; scene.add(m);
  let t = 0;
  addFx({ update(dt) { t += dt; m.material.opacity = .55 * (1 - t / .18); return t < .18; }, dispose() { rm(m); } });
}
function ringFx(x, y, color, flat = false, max = 9, life = .4) {
  const m = new THREE.Mesh(new THREE.TorusGeometry(.5, .09, 8, 36), new THREE.MeshBasicMaterial({ color, transparent:true }));
  m.position.set(x, y, 0); if (flat) m.rotation.x = Math.PI / 2; scene.add(m);
  let t = 0;
  addFx({ update(dt) { t += dt; m.scale.setScalar(1 + t * max); m.material.opacity = 1 - t / life; return t < life; }, dispose() { rm(m); } });
}
function marker(tx, color = 0xff2a2a) {
  const m = new THREE.Mesh(new THREE.RingGeometry(1, 1.35, 36), new THREE.MeshBasicMaterial({ color, transparent:true, side:THREE.DoubleSide }));
  m.rotation.x = -Math.PI / 2; m.position.set(tx, .04, 0); scene.add(m); return m;
}

// ---- projectile meshes ----
function projMesh(kind, f) {
  const g = new THREE.Group();
  const add = (geo, c, x = 0, y = 0, z = 0, o = {}) => { const m = new THREE.Mesh(geo, toon(c, o)); m.position.set(x, y, z); m.castShadow = true; if (o.ol !== false) outline(m, .03); g.add(m); return m; };
  switch (kind) {
    case 'chart':
      add(new THREE.BoxGeometry(1, .8, .06), 0xffffff);
      [[.25, 0xe0141e], [.45, 0xffb300], [.68, 0x2bb673]].forEach(([h, c], i) => add(new THREE.BoxGeometry(.2, h, .1), c, -.28 + i * .28, -.32 + h / 2, .07, { ol:false }));
      break;
    case 'sausage': {
      const s = add(new THREE.CapsuleGeometry(.17, .55, 6, 12), 0xd08a3a); s.rotation.z = Math.PI / 2;
      for (const x of [-.2, 0, .2]) { const r = add(new THREE.TorusGeometry(.17, .025, 6, 16), 0xf0c070, x, 0, 0, { ol:false }); r.rotation.y = Math.PI / 2; }
      break; }
    case 'tape': add(new THREE.TorusGeometry(.3, .12, 10, 24), 0xd0101e); add(new THREE.BoxGeometry(.7, .05, .2), 0xd0101e, -.4, -.3, 0); break;
    case 'wink': {
      const s = new THREE.Shape();
      for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? .18 : .45; i ? s.lineTo(Math.cos(a) * r, Math.sin(a) * r) : s.moveTo(Math.cos(a) * r, Math.sin(a) * r); }
      add(new THREE.ExtrudeGeometry(s, { depth:.1, bevelEnabled:false }), 0xffe14a, 0, 0, 0, { emissive:0x806000 });
      break; }
    case 'wave':
      for (let i = 0; i < 3; i++) { const r = add(new THREE.TorusGeometry(.25 + i * .18, .05, 8, 28), 0x45e08a, -i * .25, 0, 0, { emissive:0x0f6a2a, ol:false }); r.rotation.y = Math.PI / 2 * .6; }
      break;
    case 'scissors':
      for (const s of [-1, 1]) {
        const b = add(new THREE.BoxGeometry(.9, .09, .04), 0xd6d6d6); b.rotation.z = s * .35;
        const h = add(new THREE.TorusGeometry(.13, .04, 6, 14), 0x3a7fd0, -.45, s * .18, 0); h.rotation.z = s * .35;
      }
      break;
    case 'tie':
      add(new THREE.BoxGeometry(.16, .7, .05), 0xa01c2c); add(new THREE.BoxGeometry(.2, .14, .08), 0x7a1020, 0, .4, 0);
      add(new THREE.BoxGeometry(.12, .12, .05), 0xa01c2c, 0, -.38, 0).rotation.z = Math.PI / 4;
      break;
    case 'bench':
      add(new THREE.BoxGeometry(1.8, .3, .6), 0x2d6b3d); add(new THREE.BoxGeometry(1.8, .7, .15), 0x2d6b3d, 0, .4, -.25);
      for (const x of [-.75, .75]) add(new THREE.BoxGeometry(.12, .4, .5), 0x4a3020, x, -.3, 0);
      break;
    case 'bigwave': {
      const w = add(new THREE.SphereGeometry(1, 24, 16), 0x2fd07a, 0, 0, 0, { opacity:.75, emissive:0x0a5a2a });
      w.scale.set(.9, 2.3, 1.4);
      const foam = add(new THREE.TorusGeometry(.9, .18, 8, 24), 0xffffff, .2, 1.9, 0); foam.rotation.x = Math.PI / 2;
      break; }
  }
  return g;
}

function spawnProjectile(owner, mv) {
  const big = mv.kind === 'bigwave';
  const kind = big ? 'bigwave' : mv.proj;
  const m = projMesh(kind, owner);
  const dir = owner.facing, h = owner.def.build.h;
  const y0 = big ? 2.0 : 1.3;
  m.position.set(owner.x + dir * .9 * h, owner.y + y0, 0);
  m.scale.x = dir; scene.add(m);
  let life = 3.2, t = 0;
  const label = big ? floater('GREEN WAVE!', 0, 0, { follow:m, life:3, color:'#7dff9e', size:38 })
              : kind === 'wave' ? floater('OK BOOMER!', 0, 0, { follow:m, life:3, color:'#7dff9e', size:28 }) : null;
  const fx = addFx({ isProj:true, owner, dir, big, mesh:m,
    update(dt) {
      t += dt; life -= dt;
      m.position.x += dir * mv.speed * dt;
      if (kind === 'chart') m.rotation.y += dt * 5;
      if (kind === 'sausage') m.rotation.z -= dir * dt * 14;
      if (kind === 'tape' || kind === 'scissors' || kind === 'tie') m.rotation.z -= dir * dt * 16;
      if (kind === 'wink') { m.rotation.z += dt * 8; m.position.y += Math.sin(t * 12) * .02; }
      if (kind === 'wave') m.scale.set(dir * (1 + t * .6), 1 + t * .6, 1 + t * .6);
      if (kind === 'bench') m.rotation.z = -dir * Math.sin(t * 6) * .2;
      if (big) m.scale.y = 1 + Math.sin(t * 8) * .06;
      for (const e of effects) {
        if (e === fx || !e.isProj || e.owner === owner || e.dead) continue;
        if (Math.abs(e.mesh.position.x - m.position.x) < .8 && Math.abs(e.mesh.position.y - m.position.y) < (big || e.big ? 3 : .8)) {
          if (big && !e.big) { e.dead = true; continue; }
          if (e.big && !big) { fx.dead = true; break; }
          e.dead = fx.dead = true;
          sparks(m.position.x, m.position.y, 0xffffff, 14, 6); impactStar(m.position.x, m.position.y, 0xffffff, 1.2);
          floater('CROSS-PARTY CONSENSUS!', m.position.x, m.position.y + .8, { color:'#ffd23f', size:24 });
          sfx.block();
        }
      }
      if (fx.dead) return false;
      const o = owner.opp, hh = big ? 2.3 : .35, py = m.position.y;
      if (o.state !== 'ko' && Math.abs(o.x - m.position.x) < (big ? 1.1 : .65) && py + hh > o.y && py - hh < o.y + 3 * o.def.build.h) {
        const r = applyHit(owner, o, { dmg:mv.dmg, knock:big ? 9 : kind === 'bench' ? 7 : 4, stun:mv.stun ?? (big ? .7 : .4), stunned:kind === 'wink' || kind === 'tape',
          launch:big ? 7 : 0, heavy:big || kind === 'bench', chip:big ? .3 : .15, hy:py - o.y, word:kind === 'wink' ? '*WINK*' : null });
        if (r !== 'miss') { sparks(m.position.x, py, kind === 'wink' ? 0xffe14a : 0xffffff, 10, 5); return false; }
      }
      return life > 0 && Math.abs(m.position.x) < 16;
    },
    dispose() { rm(m); if (label) label.life = Math.min(label.life, .15); } });
}

// ---- vehicles & props attached to fighters ----
function trainMesh(color) {
  const g = new THREE.Group(); const T = c => toon(c);
  const add = (geo, c, x, y, z, rz = 0, rx = 0) => { const m = new THREE.Mesh(geo, T(c)); m.position.set(x, y, z); m.rotation.z = rz; m.rotation.x = rx; m.castShadow = true; outline(m, .04); g.add(m); return m; };
  add(new THREE.CylinderGeometry(.55, .55, 2, 18), color, .2, .9, 0, Math.PI / 2);
  add(new THREE.BoxGeometry(1, 1.5, 1.2), color, -1.1, 1.1, 0);
  add(new THREE.BoxGeometry(1.2, .15, 1.4), 0x111111, -1.1, 1.9, 0);
  add(new THREE.CylinderGeometry(.18, .26, .7, 10), 0x222222, .8, 1.7, 0);
  add(new THREE.ConeGeometry(.6, .6, 4), 0xc8102e, 1.4, .35, 0, -Math.PI / 2);
  for (const x of [-1, -.1, .7]) for (const z of [-.6, .6]) add(new THREE.CylinderGeometry(.32, .32, .1, 16), 0x222222, x, .32, z, 0, Math.PI / 2);
  return g;
}
function bikeMesh() {
  const g = new THREE.Group();
  for (const x of [-.6, .6]) { const w = new THREE.Mesh(new THREE.TorusGeometry(.38, .05, 8, 24), toon(0x111111)); w.position.set(x, .38, .45); g.add(w); }
  const f = new THREE.Mesh(new THREE.BoxGeometry(1.2, .07, .07), toon(0x2fd07a)); f.position.set(0, .7, .45); f.rotation.z = .1; outline(f, .02); g.add(f);
  const s = new THREE.Mesh(new THREE.BoxGeometry(.07, .6, .07), toon(0x2fd07a)); s.position.set(.55, .7, .45); outline(s, .02); g.add(s);
  return g;
}

// ---- super effects ----
function fxDrop(owner, tx) {
  const mk = marker(tx), pod = new THREE.Group();
  BOX(pod, 1.3, 1.5, .9, 0x6b4423, 0, .75, 0, { olw:.04 });
  BOX(pod, 1.5, .12, 1, 0x4a2e18, 0, 1.55, 0, { olw:.03 });
  for (const x of [-.2, .2]) CYL(pod, .03, .03, .5, 0x222222, x, 1.8, .2, { ol:false });
  sign(pod, '1:00 PM', 1, .4, 0, .9, .46, { bg:'#c8102e', fg:'#fff', font:'70px Bangers' });
  pod.position.set(tx, 9, 0); scene.add(pod);
  let t = 0, vy = 0, landed = false;
  floater('SEE YOU AT 1PM!', tx, 4, { color:'#ff6b6b', size:30, life:1.4, rise:.4 });
  addFx({ marker:true, x:tx,
    update(dt) {
      t += dt; mk.material.opacity = .5 + .5 * Math.sin(t * 30);
      if (t > .35 && !landed) {
        vy -= 90 * dt; pod.position.y += vy * dt;
        if (pod.position.y <= 0) {
          pod.position.y = 0; landed = true; mk.visible = false; this.marker = false;
          game.shake(.4); sfx.thud(); sparks(tx, .3, 0xdddddd, 16, 7);
          const o = owner.opp;
          if (Math.abs(o.x - tx) < 1.5 && o.y < 2.4) applyHit(owner, o, { dmg:22, knock:2, stun:1.5, stunned:true, unblockable:true, heavy:true, super:true });
        }
      }
      if (landed && t > 2.2) pod.position.y -= dt * 3;
      return t < 2.8;
    },
    dispose() { rm(pod); rm(mk); } });
}
function fxEruption(owner, tx) {
  const mk = marker(tx, 0xff6a00), flames = new THREE.Group(); flames.position.set(tx, 0, 0); scene.add(flames);
  const cones = [];
  for (let i = 0; i < 9; i++) {
    const c = new THREE.Mesh(new THREE.ConeGeometry(rand(.25, .45), rand(1.2, 2.4), 8), toon(pick([0xff6a00, 0xffc400, 0xe0141e]), { emissive:0x802000 }));
    c.position.set(rand(-1.1, 1.1), 0, rand(-.5, .5)); c.scale.y = .01; outline(c, .03); flames.add(c); cones.push(c);
  }
  let t = 0, fired = false;
  addFx({ marker:true, x:tx,
    update(dt) {
      t += dt; mk.material.opacity = .5 + .5 * Math.sin(t * 30);
      if (t > .55 && !fired) {
        fired = true; mk.visible = false; this.marker = false; game.shake(.35); sfx.thud(); sfx.zap();
        sparks(tx, .8, 0xd0101e, 24, 9, .8);
        floater('RED TAPE: BURNED!', tx, 3.4, { color:'#ffb000', size:30 });
        const o = owner.opp;
        if (Math.abs(o.x - tx) < 1.6 && o.y < 2) applyHit(owner, o, { dmg:24, knock:2, launch:12, stun:.9, chip:.3, heavy:true, super:true });
      }
      if (fired) cones.forEach((c, i) => { const k = t < 1.3 ? 1 : Math.max(0, 1 - (t - 1.3) * 3); c.scale.y = k * (.8 + Math.sin(t * 30 + i) * .25); c.position.y = c.scale.y * .9; });
      return t < 1.7;
    },
    dispose() { rm(flames); rm(mk); } });
}
function fxHole(owner, tx) {
  const mk = marker(tx, 0x111111);
  const hole = new THREE.Mesh(new THREE.CircleGeometry(1.6, 32), new THREE.MeshBasicMaterial({ color:0x000000 }));
  hole.rotation.x = -Math.PI / 2; hole.position.set(tx, .05, 0); hole.scale.setScalar(.01); scene.add(hole);
  const lbl = sign(scene, '$ FISCAL HOLE $', 2.4, .5, tx, 3.2, 0, { bg:'#ffd23f', fg:'#000', font:'64px Bangers' }); lbl.visible = false;
  let t = 0, fired = false;
  addFx({ marker:true, x:tx,
    update(dt) {
      t += dt; mk.material.opacity = .5 + .5 * Math.sin(t * 30);
      if (t > .4 && !fired) {
        fired = true; mk.visible = false; this.marker = false; lbl.visible = true; sfx.zap();
        const o = owner.opp;
        if (Math.abs(o.x - tx) < 1.7 && o.y < .8 && o.state !== 'ko') {
          applyHit(owner, o, { dmg:26, knock:0, stun:0, unblockable:true, heavy:true, super:true });
          if (o.state !== 'ko') { o.state = 'hole'; o.stateT = 0; o.x = tx; o.vx = 0; bubble(o, 'AAAAAAA!', { dur:1, shout:true }); }
        }
      }
      hole.scale.setScalar(t < .5 ? Math.max(.01, t * 2) : t > 2 ? Math.max(.01, 1 - (t - 2) * 3) : 1);
      lbl.position.y = 3.2 + Math.sin(t * 6) * .1;
      return t < 2.4;
    },
    dispose() { rm(hole); rm(mk); scene.remove(lbl); disposeObj(lbl); } });
}
function fxRain(owner) {
  const ties = []; let t = 0, acc = 0;
  floater('TIES FOR EVERYONE!', owner.opp.x, 4.5, { color:'#ff6b6b', size:32, life:1.4, rise:.3 });
  addFx({
    update(dt) {
      t += dt; acc += dt; const o = owner.opp;
      if (t < 1.5 && acc > .08) {
        acc = 0; const m = projMesh('tie'); m.position.set(o.x + rand(-1.3, 1.3), 8 + rand(0, 2), rand(-.2, .2)); m.rotation.z = rand(0, 6); scene.add(m); ties.push(m);
      }
      for (let i = ties.length - 1; i >= 0; i--) {
        const m = ties[i]; m.position.y -= dt * 15; m.rotation.z += dt * 10;
        if (o.state !== 'ko' && Math.abs(m.position.x - o.x) < .6 && m.position.y < o.y + 3 && m.position.y > o.y) {
          applyHit(owner, o, { dmg:2.6, knock:.6, stun:.3, chip:.25, meter:1, hy:m.position.y - o.y, quiet:true });
          sparks(m.position.x, m.position.y, 0xa01c2c, 5, 4); rm(m); ties.splice(i, 1);
        } else if (m.position.y < 0) { rm(m); ties.splice(i, 1); }
      }
      return t < 1.5 || ties.length > 0;
    },
    dispose() { ties.forEach(rm); } });
}
function fxPillar(owner, tx) {
  const mk = marker(tx, 0xffd23f);
  const p = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.3, 30, 24, 1, true), new THREE.MeshBasicMaterial({ color:0xffe27a, transparent:true, opacity:0, side:THREE.DoubleSide }));
  p.position.set(tx, 15, 0); scene.add(p);
  let t = 0, fired = false;
  addFx({ marker:true, x:tx,
    update(dt) {
      t += dt; mk.material.opacity = .5 + .5 * Math.sin(t * 30);
      if (t > .55 && !fired) {
        fired = true; mk.visible = false; this.marker = false; game.shake(.4); sfx.zap(); sfx.thud();
        floater('NAMED & EJECTED!', tx, 4, { color:'#ffd23f', size:36 });
        const o = owner.opp;
        if (Math.abs(o.x - tx) < 1.6) applyHit(owner, o, { dmg:26, knock:1, launch:23, stun:1.3, unblockable:true, heavy:true, super:true });
      }
      if (fired) p.material.opacity = Math.max(0, .7 - (t - .55) * 1.2);
      return t < 1.3;
    },
    dispose() { rm(p); rm(mk); } });
}
function fxHeal(owner) {
  owner.crown.visible = true;
  owner.hp = Math.min(100, owner.hp + 22);
  const o = owner.opp; o.meter = 0;
  floater('+22 COALITION DEAL', owner.x, 3.6, { color:'#7dff9e', size:28 });
  floater('MANDATE STOLEN!', o.x, 3.6, { color:'#ff6b6b', size:26 });
  for (let i = 0; i < 4; i++) setTimeout(() => sparks(owner.x, 1.5 + i * .4, 0xffd23f, 10, 4, .7), i * 90);
  applyHit(owner, o, { dmg:10, knock:5, stun:.6, unblockable:true, super:true });
}

// =====================================================================

export { effects, addFx, updateFx, clearFx, rm, sparkGeo, sparks, dust, trail, impactStar, ringFx, marker, projMesh, spawnProjectile, trainMesh, bikeMesh, fxDrop, fxEruption, fxHole, fxRain, fxPillar, fxHeal };
