// Unified parallax input — produces a normalised {x, y} in [-1, 1] from:
//   • mouse position   (desktop, unchanged behaviour)
//   • touch drag       (finger position maps exactly like the cursor would)
//   • device tilt      (gyroscope / accelerometer via `deviceorientation`)
//
// Pointer (mouse or touch) is an absolute position; tilt is an offset relative
// to a baseline captured when the sensor first reports, so whatever angle the
// visitor is already holding the phone at is the "neutral" position. The two
// are summed and clamped. On desktop the tilt term is always 0.

const TILT_RANGE_DEG = 18;    // degrees of tilt for full deflection
const TILT_RECENTER  = 0.003; // baseline drifts toward current pose (per event)

const clamp = (v) => Math.max(-1, Math.min(1, v));

export function createParallaxInput() {
  const pointer = { x: 0, y: 0 };
  const tilt    = { x: 0, y: 0 };

  // ─── Mouse / touch — both map screen position to [-1, 1] ─────────────────
  function setPointer(clientX, clientY) {
    pointer.x = (clientX / window.innerWidth) * 2 - 1;
    pointer.y = -((clientY / window.innerHeight) * 2 - 1);
  }

  window.addEventListener('mousemove', (e) => setPointer(e.clientX, e.clientY));

  // Passive listeners: never block scrolling inside the terminal output, and
  // fire even while the browser is handling a native scroll gesture.
  const onTouch = (e) => {
    const t = e.touches[0];
    if (t) setPointer(t.clientX, t.clientY);
  };
  window.addEventListener('touchstart', onTouch, { passive: true });
  window.addEventListener('touchmove',  onTouch, { passive: true });

  // ─── Device tilt ──────────────────────────────────────────────────────────
  const hasTouch      = navigator.maxTouchPoints > 0;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (hasTouch && !reducedMotion && 'DeviceOrientationEvent' in window) {
    let baseline = null; // { beta, gamma } in screen-oriented axes

    // Rotate beta/gamma into the current screen orientation so "tilt right"
    // means the same thing in portrait and landscape.
    function screenAxes(beta, gamma) {
      const angle = screen.orientation?.angle ?? window.orientation ?? 0;
      switch (((angle % 360) + 360) % 360) {
        case 90:  return { beta: -gamma, gamma:  beta };
        case 180: return { beta: -beta,  gamma: -gamma };
        case 270: return { beta:  gamma, gamma: -beta };
        default:  return { beta, gamma };
      }
    }

    function onOrientation(e) {
      // Desktop browsers with no sensor fire one event with null values.
      if (e.beta == null || e.gamma == null) return;
      const cur = screenAxes(e.beta, e.gamma);

      if (!baseline) { baseline = cur; return; }

      // Slow re-centre: if the visitor settles into a new posture, the neutral
      // point follows so the scene doesn't stay permanently offset.
      baseline.beta  += (cur.beta  - baseline.beta)  * TILT_RECENTER;
      baseline.gamma += (cur.gamma - baseline.gamma) * TILT_RECENTER;

      // "Window" metaphor: tilting the right edge away moves the viewer's eye
      // to the left relative to the screen, so the camera drifts left too.
      tilt.x = clamp(-(cur.gamma - baseline.gamma) / TILT_RANGE_DEG);
      tilt.y = clamp( (cur.beta  - baseline.beta)  / TILT_RANGE_DEG);
    }

    function resetBaseline() {
      baseline = null;
      tilt.x = tilt.y = 0;
    }

    function startListening() {
      window.addEventListener('deviceorientation', onOrientation);
      screen.orientation?.addEventListener('change', resetBaseline);
      window.addEventListener('orientationchange', resetBaseline);
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') resetBaseline();
      });
    }

    if (typeof DeviceOrientationEvent.requestPermission === 'function') {
      // iOS 13+: sensor access must be requested from a user gesture. Ask on
      // the first tap; if denied (or the promise rejects on http) we silently
      // fall back to touch drag only.
      const request = () => {
        document.removeEventListener('touchend', request);
        document.removeEventListener('click',    request);
        DeviceOrientationEvent.requestPermission()
          .then((state) => { if (state === 'granted') startListening(); })
          .catch(() => {});
      };
      document.addEventListener('touchend', request, { passive: true });
      document.addEventListener('click',    request);
    } else {
      // Android / other: no permission prompt needed.
      startListening();
    }
  }

  // ─── Combined output ──────────────────────────────────────────────────────
  return {
    get x() { return clamp(pointer.x + tilt.x); },
    get y() { return clamp(pointer.y + tilt.y); },
  };
}
