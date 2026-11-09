// On-screen controls for phones and tablets: draws the touch layout and feeds
// pointer events into a TouchPad. Shown only on touch devices, during a fight.
import { game, togglePause } from './game.js';
import { TouchPad, touchLayout } from './touch.js';

// Touch-first devices start in touch mode; otherwise the last input wins (a touchscreen
// laptop shows the controls once you touch it, and hides them when you use the keyboard).
let touchMode = matchMedia('(hover: none) and (pointer: coarse)').matches;
addEventListener('touchstart', () => { touchMode = true; }, { capture:true, passive:true });
addEventListener('keydown', () => { touchMode = false; }, { capture:true });
const isTouch = () => touchMode;
let layout = touchLayout(innerWidth, innerHeight);
const touchPad = new TouchPad(() => layout);

const root = document.createElement('div');
root.id = 'touch';
root.innerHTML = '<div class="stick"><div class="knob"></div></div>';
document.body.append(root);
const stickEl = root.querySelector('.stick'), knobEl = root.querySelector('.knob');
const btnEls = {};

function place() {
  layout = touchLayout(innerWidth, innerHeight);
  for (const b of [...layout.buttons, layout.pause]) {
    const el = btnEls[b.id] ??= Object.assign(document.createElement('div'), { className:`tbtn t-${b.id}` });
    el.dataset.act = b.id; el.textContent = b.label;
    Object.assign(el.style, { left:`${b.x - b.r}px`, top:`${b.y - b.r}px`, width:`${b.r * 2}px`, height:`${b.r * 2}px`, fontSize:`${Math.round(b.r * (b.label.length > 2 ? .42 : .8))}px` });
    root.append(el);
  }
  const R = layout.stickR;
  Object.assign(stickEl.style, { width:`${R * 2}px`, height:`${R * 2}px` });
  Object.assign(knobEl.style, { width:`${R * .9}px`, height:`${R * .9}px` });
}
place();
addEventListener('resize', () => { place(); touchPad.reset(); });

root.addEventListener('pointerdown', e => {
  if (!root.classList.contains('on')) return;
  e.preventDefault(); root.setPointerCapture?.(e.pointerId);
  touchPad.down(e.pointerId, e.clientX, e.clientY);
});
root.addEventListener('pointermove', e => { if (touchPad.stick?.id === e.pointerId) { e.preventDefault(); touchPad.move(e.pointerId, e.clientX, e.clientY); } });
for (const t of ['pointerup', 'pointercancel', 'lostpointercapture']) root.addEventListener(t, e => touchPad.up(e.pointerId));
root.addEventListener('contextmenu', e => e.preventDefault());

// Called once per frame before the game reads its controls: returns this frame's
// button presses for player 1 (and handles pause).
let presses = {};
function touchFrame() {
  presses = touchPad.consume();
  if (presses.pause) { delete presses.pause; if (['fight', 'intro', 'ko'].includes(game.phase)) togglePause(); }
  return presses;
}
const touchPresses = () => presses;

// show/hide and draw the stick + pressed buttons
function updateTouchUI() {
  const touch = isTouch();
  if (touch !== document.body.classList.contains('touchdev')) document.body.classList.toggle('touchdev', touch); // layout hook for CSS
  const on = touch && ['fight', 'intro', 'ko'].includes(game.phase);
  if (on !== root.classList.contains('on')) { root.classList.toggle('on', on); if (!on) touchPad.reset(); }
  if (!on) return;
  const s = touchPad.stick, home = layout.stickHome, k = touchPad.knob();
  const ox = s ? s.ox : home.x, oy = s ? s.oy : home.y, R = layout.stickR;
  stickEl.style.transform = `translate(${ox - R}px, ${oy - R}px)`;
  stickEl.classList.toggle('active', !!s);
  knobEl.style.transform = `translate(${(k ? k.x - ox : 0)}px, ${(k ? k.y - oy : 0)}px)`;
  for (const id in btnEls) btnEls[id].classList.toggle('down', touchPad.pressing(id));
}

export { touchPad, touchFrame, touchPresses, updateTouchUI, isTouch };
