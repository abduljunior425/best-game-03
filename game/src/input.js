// Input for Emberhold: keyboard state and mouse clicks, translated into the
// game's logical coordinates. The world never reads the DOM; main.js asks
// this module what happened and turns it into world actions.
import { toLogical } from './render.js';

export function createInput(canvas) {
  const keys = new Set();
  const pressed = [];
  const clicks = [];
  let mouse = { x: 0, y: 0, inside: false };

  window.addEventListener('keydown', (event) => {
    if (event.repeat) return;
    keys.add(event.key.toLowerCase());
    pressed.push(event.key.toLowerCase());
    if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(event.key.toLowerCase())) {
      event.preventDefault();
    }
  });
  window.addEventListener('keyup', (event) => {
    keys.delete(event.key.toLowerCase());
  });
  canvas.addEventListener('mousemove', (event) => {
    mouse = { ...toLogical(canvas, event.clientX, event.clientY), inside: true };
  });
  canvas.addEventListener('mouseleave', () => {
    mouse.inside = false;
  });
  canvas.addEventListener('click', (event) => {
    clicks.push(toLogical(canvas, event.clientX, event.clientY));
  });
  canvas.addEventListener('contextmenu', (event) => {
    event.preventDefault();
    clicks.push({ ...toLogical(canvas, event.clientX, event.clientY), right: true });
  });

  return {
    /** True while the key is held down. */
    down(key) {
      return keys.has(key.toLowerCase());
    },
    /** Keys pressed since the last drain, in order. */
    drainPressed() {
      const out = pressed.splice(0, pressed.length);
      return out;
    },
    /** Click positions since the last drain, in order. */
    drainClicks() {
      const out = clicks.splice(0, clicks.length);
      return out;
    },
    mouse() {
      return mouse;
    },
  };
}
