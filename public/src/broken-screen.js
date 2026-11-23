// ─── Broken screen ────────────────────────────────────────────────────────────
// The end of `sudo rm -rf /`: a still image of a laptop LCD that took a hit,
// modelled on a photo of a broken MacBook Pro. Drawn once, laid out at random
// each time: the light zone lands in a random corner and the impact at a
// random point inside the dark zone.
//   - part of the panel still shows a light image (white up top, an orange
//     band, blue below), crossed by thin horizontal blue lines and a few
//     bright vertical ones
//   - the rest went black, ending in a near-vertical edge that drops into a
//     wavy mound
//   - dead pixel columns in groups across the black, with fully black gaps
//     between them; the groups sit closest from the impact to the edge and
//     over the mound. No line is one solid colour: each changes
//     colour and brightness along its length, sometimes abruptly, sometimes
//     blending, sometimes fading almost out
//   - a corrupted strip of pink, white and lavender rows from the impact to
//     the top or bottom edge
//   - the cracks: a crushed white burst at the impact, long cracks fanning out
//     to the edges and a closed loop off to one side, each changing direction
//     in places
// Every line is 1 px wide, on whole pixels so it stays sharp; in the photo
// they look wider only from camera blur.

const COLUMN_COLORS = [
  '#ff3b3b', '#ef4444', '#22c55e', '#4ade80', '#22d3ee', '#38bdf8', '#3b82f6',
  '#60a5fa', '#ffffff', '#e5e7eb', '#a855f7', '#c084fc', '#f472b6', '#facc15',
];
const ROW_COLORS   = ['#1e40af', '#2f5fd0', '#3b82f6', '#5b8def', '#86b4ff', '#22d3ee'];
const STRIP_COLORS = ['#f5d0fe', '#ffffff', '#e9d5ff', '#f0abfc', '#c4b5fd', '#fbcfe8', '#93c5fd'];

const TAU  = Math.PI * 2;
const rand = (min, max) => min + Math.random() * (max - min);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

function rgba(hex, alpha) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

// A gradient along a line made of segments in different colours and
// brightness. Between segments the colour either jumps or blends, and now and
// then a segment fades almost out, so the line never reads as one solid colour.
function streak(ctx, x0, y0, x1, y1, palette) {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  let t = 0;
  while (t < 1) {
    const color = rgba(pick(palette), Math.random() < 0.08 ? rand(0.1, 0.3) : rand(0.7, 1));
    const end = Math.min(t + rand(0.03, 0.25), 1);
    g.addColorStop(t, color);
    g.addColorStop(end, color);
    t = Math.random() < 0.5 ? end : Math.min(end + rand(0.01, 0.06), 1);
    if (end >= 1) break;
  }
  return g;
}

// A crack from (x0, y0) to (x1, y1) roughly following the cubic through the
// two control points, but drawn as a chain of 3–6 slightly curved pieces that
// meet at an angle: real cracks change direction abruptly instead of bending
// in one smooth sweep. `jolt` is how far the joints stray from the curve.
function crack(ctx, x0, y0, c1x, c1y, c2x, c2y, x1, y1, alpha, jolt) {
  const at = (t) => {
    const u = 1 - t;
    return [
      u * u * u * x0 + 3 * u * u * t * c1x + 3 * u * t * t * c2x + t * t * t * x1,
      u * u * u * y0 + 3 * u * u * t * c1y + 3 * u * t * t * c2y + t * t * t * y1,
    ];
  };
  const n = 3 + Math.floor(Math.random() * 4);
  const ts = [0, ...Array.from({ length: n - 1 }, () => Math.random()).sort((a, b) => a - b), 1];
  const joints = ts.map((t, i) => {
    const [x, y] = at(t);
    if (i === 0 || i === ts.length - 1) return [x, y];
    const a = rand(0, TAU), d = rand(0.4, 1) * jolt;
    return [x + Math.cos(a) * d, y + Math.sin(a) * d];
  });
  ctx.beginPath();
  ctx.moveTo(...joints[0]);
  for (let i = 1; i < joints.length; i++) {
    const [ax, ay] = joints[i - 1], [bx, by] = joints[i];
    const len = Math.hypot(bx - ax, by - ay) || 1, bulge = len * rand(-0.18, 0.18);
    ctx.quadraticCurveTo((ax + bx) / 2 - (by - ay) / len * bulge, (ay + by) / 2 + (bx - ax) / len * bulge, bx, by);
  }
  ctx.lineWidth = 1;
  ctx.strokeStyle = `rgba(235, 240, 250, ${alpha})`;
  ctx.stroke();
}

// How far from (x, y) along angle `a` to the edge of the W × H screen
function toEdge(x, y, a, W, H) {
  const dx = Math.cos(a), dy = Math.sin(a);
  const tx = dx > 0 ? (W - x) / dx : dx < 0 ? -x / dx : Infinity;
  const ty = dy > 0 ? (H - y) / dy : dy < 0 ? -y / dy : Infinity;
  return Math.min(tx, ty);
}

// A crack from (x0, y0) to (x1, y1) bowed sideways by `bend` (a fraction of
// its length), in an S now and then
function bowedCrack(ctx, x0, y0, x1, y1, bend, alpha, jolt) {
  const L = Math.hypot(x1 - x0, y1 - y0) || 1;
  const nx = -(y1 - y0) / L * L * bend, ny = (x1 - x0) / L * L * bend;
  const s2 = Math.random() < 0.3 ? -0.6 : 1;
  crack(ctx, x0, y0,
        x0 + (x1 - x0) / 3 + nx, y0 + (y1 - y0) / 3 + ny,
        x0 + (x1 - x0) * 2 / 3 + nx * s2, y0 + (y1 - y0) * 2 / 3 + ny * s2,
        x1, y1, alpha, jolt);
}

// Draws the broken panel on `ctx`, `W` × `H` CSS pixels. Every call is a new
// layout: the light zone lands on a random side and corner, and the impact
// at a random point inside the dark zone.
export function drawBrokenPanel(ctx, W, H) {
  const s = Math.min(W, H) / 700;
  const diag = Math.hypot(W, H);

  // ── The light image, upright across the whole screen; the dark zone covers
  // most of it ──
  const band = rand(-0.12, 0.12);                 // moves the orange band up or down
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0,                '#f3f6fb');
  sky.addColorStop(0.45 + band,      '#e6edf7');
  sky.addColorStop(0.5 + band,       '#ecdad6');
  sky.addColorStop(0.6 + band,       '#bed7f0');
  sky.addColorStop(Math.min(0.78 + band, 0.95), '#8dbbe8');
  sky.addColorStop(1,                '#2f6fc0');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);

  for (let i = 0, n = Math.round(rand(150, 210)); i < n; i++) {
    const x0 = Math.random() < 0.7 ? 0 : rand(0, W * 0.85);
    const x1 = Math.random() < 0.8 ? W : rand(x0 + W * 0.1, W);
    ctx.fillStyle = streak(ctx, x0, 0, x1, 0, ROW_COLORS);
    ctx.globalAlpha = rand(0.25, 0.85);
    ctx.fillRect(Math.round(x0), Math.round(rand(0, H)), Math.round(x1 - x0), 1);
  }
  for (let i = 0, n = Math.round(rand(6, 10)); i < n; i++) {
    ctx.fillStyle = streak(ctx, 0, 0, 0, H, ['#22d3ee', '#67e8f9', '#38bdf8', '#ffffff', '#3b82f6']);
    ctx.globalAlpha = rand(0.5, 0.9);
    ctx.fillRect(Math.round(rand(0, W)), 0, 1, H);
  }
  ctx.globalAlpha = 1;

  // ── The dark zone. Laid out with the light zone at the top right, then
  // mirrored at random so the light zone can land in any corner ──
  const flipX = Math.random() < 0.5, flipY = Math.random() < 0.5;
  ctx.save();
  if (flipX) { ctx.translate(W, 0); ctx.scale(-1, 1); }
  if (flipY) { ctx.translate(0, H); ctx.scale(1, -1); }

  const xs = W * rand(0.42, 0.62);                // the dark zone's near-vertical edge
  const yb = H * rand(0.45, 0.7);                 // where that edge turns into the mound
  const xr = W * rand(0.72, 0.95);                // where the mound meets the far edge
  const dark = new Path2D();
  dark.moveTo(0, 0);
  dark.lineTo(xs, 0);
  dark.lineTo(xs + rand(-4, 4), yb * 0.5);
  dark.lineTo(xs, yb);
  dark.bezierCurveTo(xs + W * 0.04, yb - H * 0.02, xs + W * 0.07, yb + H * 0.05, xs + W * 0.1, yb + H * 0.04);
  dark.bezierCurveTo(xs + W * 0.2, yb + H * 0.06, xr - W * 0.06, H - H * 0.14, xr, H);
  dark.lineTo(0, H);
  dark.closePath();

  // The impact: a random point inside the dark zone, clear of its edge
  const inDark = (x, y) =>
    x < xs - W * 0.06 ||
    (x < xr - W * 0.05 && y > yb + (H - yb) * (x - xs) / (xr - xs) + H * 0.08);
  let ix = xs * 0.5, iy = H * 0.5;
  for (let tries = 0; tries < 60; tries++) {
    const x = rand(0.06, 0.94) * W, y = rand(0.08, 0.92) * H;
    if (inDark(x, y)) { ix = x; iy = y; break; }
  }

  ctx.save();
  ctx.clip(dark);
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);

  // The corrupted strip: rows of pink, white and lavender from the impact to
  // the edge
  const strip = new Path2D();
  strip.moveTo(ix - W * 0.05, 0);
  strip.lineTo(ix + W * 0.13, 0);
  strip.lineTo(ix + W * 0.1, iy * 0.55);
  strip.lineTo(ix + W * 0.02, iy);
  strip.lineTo(ix - W * 0.04, iy * 0.7);
  strip.closePath();
  ctx.save();
  ctx.clip(strip);
  for (let y = 0; y < iy; y += rand(2, 4)) {
    ctx.globalAlpha = rand(0.45, 0.9);
    ctx.fillStyle = pick(STRIP_COLORS);
    ctx.fillRect(ix - W * 0.06, Math.round(y), W * 0.2, 1);
  }
  ctx.globalAlpha = 1;
  ctx.restore();

  // Dead columns in groups, with fully black gaps between them: the groups
  // sit closer together from the impact to the edge and over the mound, and
  // far apart away from the impact
  const sparseUntil = Math.min(ix - W * 0.08, W * 0.18);
  const sx = Math.max(W / 1000, 0.6);
  for (let x = rand(0, 40) * sx; x < xr;) {
    const far = x < sparseUntil, near = !far && x < xs;
    const width = (far ? rand(8, 40) : rand(15, 90)) * sx;
    const fill  = far ? rand(0.3, 0.5) : rand(0.45, 0.8);
    for (const end = x + width; x < end && x < xr;) {
      if (Math.random() < fill) {
        const y0 = Math.random() < 0.8 ? 0 : rand(0, 0.3) * H;
        const y1 = Math.random() < 0.85 ? H : rand(0.6, 1) * H;
        ctx.fillStyle = streak(ctx, 0, y0, 0, y1, COLUMN_COLORS);
        ctx.fillRect(Math.round(x), y0, 1, y1 - y0);
        x += 1;
      }
      x += rand(1, 4);
    }
    x += (far ? rand(60, 220) : near ? rand(15, 90) : rand(20, 120)) * sx;
  }
  ctx.restore();

  // ── The cracks, all from the impact ──
  ctx.lineCap = 'round';
  const jolt = 12 * s;
  // Long cracks fanning out in every direction, most to the edge
  for (let i = 0, n = 7 + Math.floor(Math.random() * 4); i < n; i++) {
    const a = (i / n) * TAU + rand(-0.3, 0.3);
    const L = toEdge(ix, iy, a, W, H) * (Math.random() < 0.6 ? 1 : rand(0.35, 0.8));
    bowedCrack(ctx, ix, iy, ix + Math.cos(a) * L, iy + Math.sin(a) * L, rand(-0.25, 0.25), rand(0.55, 0.8), jolt);
  }
  // A closed loop off to one side, like the one in the photo
  {
    const a = rand(0, TAU), dx = Math.cos(a), dy = Math.sin(a), px = -dy, py = dx;
    const d = Math.min(diag * rand(0.12, 0.2), toEdge(ix, iy, a, W, H) * 0.5);
    const ax = ix + dx * d, ay = iy + dy * d;
    const len = Math.min(diag * rand(0.12, 0.2), toEdge(ax, ay, a, W, H) * 0.8);
    const bx = ax + dx * len + px * diag * 0.04, by = ay + dy * len + py * diag * 0.04;
    bowedCrack(ctx, ix, iy, ax, ay, rand(-0.15, 0.15), 0.75, jolt);
    bowedCrack(ctx, ax, ay, bx, by, 0.35, 0.7, jolt);
    bowedCrack(ctx, bx, by, ax + px * diag * 0.02, ay + py * diag * 0.02, 0.35, 0.6, jolt);
  }

  // The crushed point: a burst of short cracks around a white core
  for (let i = 0; i < 45; i++) {
    const a = rand(0, TAU), L = rand(4, 45) * s;
    ctx.beginPath();
    ctx.moveTo(ix, iy);
    ctx.lineTo(ix + Math.cos(a) * L, iy + Math.sin(a) * L);
    ctx.lineWidth = 1;
    ctx.strokeStyle = `rgba(255, 255, 255, ${rand(0.5, 0.95)})`;
    ctx.stroke();
  }
  const core = ctx.createRadialGradient(ix, iy, 0, ix, iy, 10 * s);
  core.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
  core.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = core;
  ctx.fillRect(ix - 10 * s, iy - 10 * s, 20 * s, 20 * s);
  ctx.restore();
}

// Draws the broken panel on `canvas` (a fixed, full-screen overlay), holds it
// for `duration` ms, then clears it and resolves.
export function breakScreen(canvas, duration) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const W = window.innerWidth, H = window.innerHeight;
  canvas.width  = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  drawBrokenPanel(ctx, W, H);

  return new Promise((resolve) => {
    setTimeout(() => {
      ctx.clearRect(0, 0, W, H);
      resolve();
    }, duration);
  });
}
