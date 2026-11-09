// On-screen touch controls: layout, a floating thumbstick and buffered buttons.
// Pure logic (no DOM): touchui.js draws it and feeds pointer events in.

const ACTIONS = ['punch', 'kick', 'spA', 'spB', 'sup'];
const LABELS = { punch:'PUNCH', kick:'KICK', spA:'A', spB:'B', sup:'SUPER', pause:'II' };
const clampN = (v, a, b) => Math.max(a, Math.min(b, v));

// Buttons cluster in the bottom-right under the right thumb, punch nearest the corner.
// Landscape: two rows of three-ish; portrait: two columns, three rows (narrow screens).
function touchLayout(w, h) {
  const s = Math.min(w, h), r = clampN(s * .105, 24, 46), rp = r * 1.15, gap = Math.max(8, r * .28);
  const m = Math.max(10, s * .035);
  const px = w - m - rp, py = h - m - rp, step = r + rp + gap, step2 = 2 * r + gap;
  const B = (id, x, y, rr = r) => ({ id, x, y, r:rr, label:LABELS[id] });
  const buttons = [B('punch', px, py, rp)];
  if (w >= h) {
    buttons.push(B('kick', px - step, py + (rp - r)), B('spA', px + (rp - r), py - step),
      B('spB', px - step, py - step + (rp - r)), B('sup', px - step - step2, py - step + (rp - r)));
  } else {
    buttons.push(B('kick', px - step, py + (rp - r)), B('spA', px + (rp - r), py - step),
      B('spB', px - step, py - step + (rp - r)), B('sup', px + (rp - r), py - step - step2));
  }
  const left = Math.min(...buttons.map(b => b.x - b.r));
  return {
    w, h, buttons,
    // landscape: bottom centre between the thumbs; portrait: top centre under the HUD, clear of the buttons
    pause:{ id:'pause', x:w / 2, y:w >= h ? h - m - 22 : Math.min(h * .18, 150), r:22, label:LABELS.pause },
    stickR:r * 1.4,
    stickZone:{ x0:0, x1:Math.min(w * .45, left - gap), y0:0, y1:h },
    stickHome:{ x:m + r * 1.9, y:h - m - r * 1.9 },
  };
}

// Stick offset -> held directions. Diagonals count, but a mostly-sideways push
// doesn't jump (up) and a mostly-vertical one doesn't walk.
function stickDir(dx, dy, dead) {
  const none = { left:false, right:false, up:false, down:false };
  if (Math.hypot(dx, dy) < dead) return none;
  const ax = Math.abs(dx), ay = Math.abs(dy);
  return {
    left:dx < -dead * .7 && ax > ay * .4, right:dx > dead * .7 && ax > ay * .4,
    up:dy < -dead * .7 && ay > ax * .5, down:dy > dead * .7 && ay > ax * .5,
  };
}

class TouchPad {
  constructor(layoutFn) { this.layoutFn = layoutFn; this.reset(); }
  reset() { this.stick = null; this.btns = new Map(); this.buf = {}; }
  // returns what the touch landed on: an action id, 'pause', 'stick' or null
  down(id, x, y) {
    const L = this.layoutFn();
    let best = null, bd = Infinity;
    for (const b of [L.pause, ...L.buttons]) { const d = Math.hypot(x - b.x, y - b.y) / b.r; if (d <= 1.25 && d < bd) { best = b; bd = d; } }
    if (best) { this.btns.set(id, best.id); this.buf[best.id] = 1; return best.id; }
    const z = L.stickZone;
    if (!this.stick && x >= z.x0 && x <= z.x1 && y >= z.y0 && y <= z.y1) { this.stick = { id, ox:x, oy:y, x, y }; return 'stick'; }
    return null;
  }
  move(id, x, y) { if (this.stick?.id === id) { this.stick.x = x; this.stick.y = y; } }
  up(id) { if (this.stick?.id === id) this.stick = null; this.btns.delete(id); }
  held() {
    if (!this.stick) return stickDir(0, 0, 1);
    return stickDir(this.stick.x - this.stick.ox, this.stick.y - this.stick.oy, this.layoutFn().stickR * .3);
  }
  // knob position for drawing: the finger, clamped to the stick's radius
  knob() {
    if (!this.stick) return null;
    const R = this.layoutFn().stickR, dx = this.stick.x - this.stick.ox, dy = this.stick.y - this.stick.oy, d = Math.hypot(dx, dy), k = d > R ? R / d : 1;
    return { x:this.stick.ox + dx * k, y:this.stick.oy + dy * k };
  }
  pressing(action) { return [...this.btns.values()].includes(action); }
  consume() { const b = this.buf; this.buf = {}; return b; }
}

export { ACTIONS, LABELS, touchLayout, stickDir, TouchPad };
