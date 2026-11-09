// Turn key state into a control snapshot for one frame. Held directions also count
// when the key was pressed this frame but released before it ran, so quick taps
// (jumps, dash double-taps) are never lost on slow frames.
const HELD = ['left', 'right', 'up', 'down'];

function readControls(bind, keys, pressed) {
  const c = {};
  for (const k in bind) {
    const down = bind[k].some(x => pressed.has(x));
    if (HELD.includes(k)) { c[k] = down || bind[k].some(x => keys.has(x)); c[k + 'Tap'] = down; } // fresh press, e.g. for dash double-taps
    else c[k] = down;
  }
  return c;
}

export { HELD, readControls };
