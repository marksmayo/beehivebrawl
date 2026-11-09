import { audioInit } from './audio.js';
import { touchPad, touchPresses } from './touchui.js';
import { game, menuKey, rematch, selBack, selConfirm, selNav, toSelect, togglePause } from './game.js';

// Input (keyboard + gamepad)

const keys = new Set(), pressed = new Set();
const BIND_2P = [
  { left:['KeyA'], right:['KeyD'], up:['KeyW'], down:['KeyS'], punch:['KeyF'], kick:['KeyG'], spA:['KeyH'], spB:['KeyR'], sup:['KeyT'] },
  { left:['ArrowLeft'], right:['ArrowRight'], up:['ArrowUp'], down:['ArrowDown'], punch:['Numpad1', 'Comma'], kick:['Numpad2', 'Period'], spA:['Numpad3', 'Slash'], spB:['Numpad4', 'Semicolon'], sup:['Numpad5', 'Quote'] },
];
const BIND_1P = {
  left:['KeyA', 'ArrowLeft'], right:['KeyD', 'ArrowRight'], up:['KeyW', 'ArrowUp', 'Space'], down:['KeyS', 'ArrowDown'],
  punch:['KeyJ', 'KeyF', 'Numpad1', 'Comma'], kick:['KeyK', 'KeyG', 'Numpad2', 'Period'], spA:['KeyL', 'KeyH', 'Numpad3', 'Slash'],
  spB:['KeyI', 'KeyR', 'Numpad4', 'Semicolon'], sup:['KeyO', 'KeyT', 'Numpad5', 'Quote'],
};
const EMPTY = { left:0, right:0, up:0, down:0, punch:0, kick:0, spA:0, spB:0, sup:0 };
const HELD = ['left', 'right', 'up', 'down'];
const padState = [null, null], padPrev = [[], []], padBuf = [{}, {}], padAx = [{ x:0, y:0 }, { x:0, y:0 }];
function ctrlFor(i) {
  const b = game.mode === 'cpu' ? BIND_1P : BIND_2P[i], c = {};
  for (const k in b) c[k] = HELD.includes(k) ? b[k].some(x => keys.has(x)) : b[k].some(x => pressed.has(x));
  const pi = game.mode === 'cpu' ? 0 : i, p = padState[pi];
  if (p) { for (const k of HELD) c[k] = c[k] || p[k]; for (const k of ['punch', 'kick', 'spA', 'spB', 'sup']) c[k] = c[k] || padBuf[pi][k]; }
  if (i === 0) { // on-screen touch controls drive player 1
    const t = touchPad.held(), tp = touchPresses();
    for (const k of HELD) c[k] = c[k] || t[k];
    for (const k of ['punch', 'kick', 'spA', 'spB', 'sup']) c[k] = c[k] || !!tp[k];
  }
  return c;
}
addEventListener('keydown', e => {
  audioInit();
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Tab', 'Slash', 'Quote'].includes(e.code)) e.preventDefault();
  if (e.repeat) return;
  keys.add(e.code); pressed.add(e.code); menuKey(e.code);
});
addEventListener('keyup', e => keys.delete(e.code));
addEventListener('blur', () => keys.clear());
addEventListener('pointerdown', audioInit);
function pollPads() {
  const list = [...(navigator.getGamepads ? navigator.getGamepads() : [])].filter(Boolean);
  for (let i = 0; i < 2; i++) {
    const p = list[i]; if (!p) { padState[i] = null; continue; }
    const b = k => !!p.buttons[k]?.pressed, prev = padPrev[i], jp = k => b(k) && !prev[k];
    const ax = p.axes[0] || 0, ay = p.axes[1] || 0;
    padState[i] = { left:b(14) || ax < -.5, right:b(15) || ax > .5, up:b(12) || ay < -.6, down:b(13) || ay > .6 };
    const buf = padBuf[i];
    if (jp(2)) buf.punch = 1; if (jp(0)) buf.kick = 1; if (jp(1)) buf.spA = 1; if (jp(3)) buf.spB = 1; if (jp(5) || jp(7) || jp(4)) buf.sup = 1;
    const dx = padState[i].left ? -1 : padState[i].right ? 1 : 0, dy = padState[i].up ? -1 : padState[i].down ? 1 : 0;
    if (game.phase === 'select') {
      const sp = game.mode === 'cpu' ? 0 : i;
      if (dx && dx !== padAx[i].x) selNav(sp, dx, 0); if (dy && dy !== padAx[i].y) selNav(sp, 0, dy);
      if (jp(0)) selConfirm(sp); if (jp(1)) selBack();
    } else if (game.phase === 'title' && (jp(0) || jp(9))) toSelect('cpu');
    else if (game.phase === 'result' && jp(0)) rematch();
    else if (jp(9)) togglePause();
    padAx[i] = { x:dx, y:dy };
    padPrev[i] = p.buttons.map(x => x.pressed);
  }
}

// =====================================================================

export { keys, pressed, BIND_2P, BIND_1P, EMPTY, HELD, padState, padPrev, padBuf, padAx, ctrlFor, pollPads };
