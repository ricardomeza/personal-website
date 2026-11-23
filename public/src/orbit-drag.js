// Drag to turn the scene — the camera orbits the origin the way the visitor
// drags: up to look down on it from above, down to look up at it from below,
// left or right to see it from that side. Think of grabbing the far side of
// the stage and tipping it toward you. The further the drag, the further the
// turn, easing into the limits (top-down, bottom-up, side-on) instead of
// stopping at them.
//
// It's a peek, not a new resting place: on release the view settles back, so
// the grid, the name and the Earth face the visitor again.
//
//   • Mouse / trackpad: press and drag. A press on the terminal's text still
//     selects it; links and inputs keep working.
//   • Touch: press and hold, then slide. A quick swipe still scrolls the
//     terminal and a tap still opens the keyboard: holding first is what
//     tells them apart. Once the hold takes, the camera leans in a little so
//     the visitor knows the scene is in hand.
//
// The output is a turn away from the camera's resting place — `azimuth` and
// `elevation` in radians, `zoom` as a distance factor — eased every update().

const HOLD_MS   = 280; // touch: how long to hold still before the scene is grabbed
const HOLD_SLOP = 8;   // px a waiting finger may wander before it counts as a scroll

// px of drag per DRAG_TURN radians of turn (before the limits ease it in): a
// share of the screen's shorter side, so a phone needs no more than its width.
const DRAG_SPAN = { share: 0.45, min: 180, max: 480 };
const DRAG_TURN = 1.7;

const MAX_ELEVATION = (85 * Math.PI) / 180; // from the horizon, up or down
const MAX_AZIMUTH   = Math.PI / 2;          // side-on

const FOLLOW_TAU = 0.06; // s — how closely the view trails the drag
const RETURN_TAU = 0.5;  // s — how gently it settles back on release
const ZOOM_TAU   = 0.15; // s
const GRAB_ZOOM  = 0.96;

// Mouse events browsers synthesise after a touch aren't a mouse drag.
const TOUCH_MOUSE_MS = 800;

// Presses here keep their own meaning.
const INTERACTIVE = 'a, button, input, textarea, select, #ai-agent, .profile';

// Approaches ±max without reaching it, with slope 1 at 0; `under` and `over`
// are the limits below and above 0.
function ease(x, under, over) {
  return x >= 0 ? over * Math.tanh(x / over) : -under * Math.tanh(-x / under);
}

function unease(x, under, over) {
  const atanh = (v) => Math.atanh(Math.min(v, 0.999));
  return x >= 0 ? over * atanh(x / over) : -under * atanh(-x / under);
}

function radiansPerPx() {
  const side = Math.min(window.innerWidth, window.innerHeight);
  const span = Math.max(DRAG_SPAN.min, Math.min(DRAG_SPAN.max, side * DRAG_SPAN.share));
  return DRAG_TURN / span;
}

// Whether (x, y) is on the glyphs of a terminal line rather than the empty
// rest of its row: lines are full-width blocks, their text often isn't.
function overText(target, x, y) {
  const line = target.closest('.term-line, #terminal__input-row');
  if (!line) return false;
  const range = document.createRange();
  range.selectNodeContents(line);
  for (const r of range.getClientRects()) {
    if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return true;
  }
  return false;
}

export function createOrbitDrag({ baseElevation = 0 } = {}) {
  // Elevation is limited from the horizon, so its room above and below the
  // resting place differs by the camera's resting tilt.
  const room = {
    az: { under: MAX_AZIMUTH, over: MAX_AZIMUTH },
    el: { under: MAX_ELEVATION + baseElevation, over: MAX_ELEVATION - baseElevation },
  };
  const view   = { az: 0, el: 0, zoom: 1 }; // what the camera uses
  const target = { az: 0, el: 0, zoom: 1 };
  const root   = document.documentElement;

  // The drag in progress: where it started and the un-eased turn there, so
  // grabbing the view again mid-return carries on from where it is.
  let drag = null;

  function begin(kind, x, y) {
    drag = {
      kind, x, y,
      az: unease(view.az, room.az.under, room.az.over),
      el: unease(view.el, room.el.under, room.el.over),
    };
    target.az = view.az;
    target.el = view.el;
    root.classList.add('is-orbiting');
  }

  function move(x, y) {
    if (!drag) return;
    const k = radiansPerPx();
    target.az = ease(drag.az + (x - drag.x) * k, room.az.under, room.az.over);
    target.el = ease(drag.el - (y - drag.y) * k, room.el.under, room.el.over);
  }

  function end() {
    if (!drag) return;
    drag = null;
    target.az = target.el = 0;
    target.zoom = 1;
    root.classList.remove('is-orbiting');
  }

  // ─── Mouse / trackpad ─────────────────────────────────────────────────────
  let lastTouch = -Infinity;

  window.addEventListener('mousedown', (e) => {
    if (e.button !== 0 || drag) return;
    if (performance.now() - lastTouch < TOUCH_MOUSE_MS) return;
    if (!(e.target instanceof Element)) return;
    if (e.target.closest(INTERACTIVE) || overText(e.target, e.clientX, e.clientY)) return;
    // No text selection or focus change while turning — the terminal keeps
    // the keyboard. A press elsewhere still clears an old selection.
    e.preventDefault();
    window.getSelection()?.removeAllRanges();
    begin('mouse', e.clientX, e.clientY);
  });

  window.addEventListener('mousemove', (e) => {
    if (drag?.kind !== 'mouse') return;
    // Released outside the window, where the mouseup went elsewhere.
    if (!(e.buttons & 1)) return end();
    move(e.clientX, e.clientY);
  });

  window.addEventListener('mouseup', (e) => {
    if (drag?.kind === 'mouse' && e.button === 0) end();
  });

  window.addEventListener('blur', end);

  // ─── Touch: hold, then slide ──────────────────────────────────────────────
  let hold = null; // { id, x, y, start, timer, taken, moves, blocked }

  // How the last touch went, for the terminal's `env` on the device itself.
  let touchLog = 'no touch yet';

  // By index: TouchList isn't iterable in every browser.
  function find(touches) {
    for (let i = 0; i < touches.length; i++) {
      if (touches[i].identifier === hold.id) return touches[i];
    }
    return null;
  }

  function letGo(why) {
    if (!hold) return;
    const ms = Math.round(performance.now() - hold.start);
    touchLog = hold.taken
      ? `held, ${hold.moves} moves (${hold.blocked} kept from scrolling), ${why} at ${ms}ms`
      : `let go before the hold: ${why} at ${ms}ms`;
    clearTimeout(hold.timer);
    hold = null;
    end();
  }

  window.addEventListener('touchstart', (e) => {
    lastTouch = performance.now();
    // A second finger is a pinch, not a turn.
    if (e.touches.length > 1) return letGo('second finger');
    letGo('touchend never came');
    const t = e.changedTouches[0];
    if (!t) return;
    if (e.target instanceof Element && e.target.closest(INTERACTIVE)) {
      touchLog = 'started on a link or input';
      return;
    }
    hold = {
      id: t.identifier, x: t.clientX, y: t.clientY, start: performance.now(),
      taken: false, moves: 0, blocked: 0,
    };
    hold.timer = setTimeout(() => {
      hold.taken = true;
      begin('touch', hold.x, hold.y);
      target.zoom = GRAB_ZOOM;
    }, HOLD_MS);
  }, { passive: true });

  // Not passive: once the hold takes, the finger turns the scene instead of
  // scrolling the terminal.
  window.addEventListener('touchmove', (e) => {
    if (!hold) return;
    const t = find(e.changedTouches);
    if (!t) return;
    if (hold.taken) {
      hold.moves++;
      if (e.cancelable) {
        e.preventDefault();
        hold.blocked++;
      }
      move(t.clientX, t.clientY);
    } else if (Math.hypot(t.clientX - hold.x, t.clientY - hold.y) > HOLD_SLOP) {
      letGo('moved'); // before the hold took: a scroll
    } else {
      hold.x = t.clientX; // the drag starts wherever the finger is when it takes
      hold.y = t.clientY;
    }
  }, { passive: false });

  const release = (e) => {
    lastTouch = performance.now();
    if (!hold || !find(e.changedTouches)) return;
    // After a hold, lifting the finger isn't a tap: no click, so no keyboard.
    if (hold.taken && e.cancelable) e.preventDefault();
    letGo(e.type);
  };
  window.addEventListener('touchend', release, { passive: false });
  window.addEventListener('touchcancel', release);

  // A long press would open the browser's menu or start selecting text.
  window.addEventListener('contextmenu', (e) => {
    if (hold?.taken) e.preventDefault();
  });

  // ─── Output ───────────────────────────────────────────────────────────────
  return {
    update(dt) {
      const step = (tau) => 1 - Math.exp(-dt / tau);
      const k = step(drag ? FOLLOW_TAU : RETURN_TAU);
      view.az += (target.az - view.az) * k;
      view.el += (target.el - view.el) * k;
      view.zoom += (target.zoom - view.zoom) * step(ZOOM_TAU);
    },
    get azimuth()   { return view.az; },
    get elevation() { return view.el; },
    get zoom()      { return view.zoom; },
    get status() {
      if (!hold) return touchLog;
      return hold.taken ? `holding, ${hold.moves} moves (${hold.blocked} kept from scrolling)` : 'waiting for the hold';
    },
  };
}
