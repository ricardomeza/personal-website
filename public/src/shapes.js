// A shape is { positions, advance? }. `positions` is where each particle
// sits when the shape forms. `advance(t, out, fade)`, when present, makes the
// shape move while it's on screen: it writes where its moving particles are
// `t` seconds after it formed into `out` (xyz per particle) and how visible
// each one is into `fade` (0..1). Particles that loop — back to a galaxy's
// rim, say — sit at fade 0 where they wrap so they never pop in or out.
// Particles advance() doesn't write keep their `positions` place.

function gaussian() {
  const u = 1 - Math.random();
  const v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function smoothstep(edge0, edge1, x) {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function wrap(value, period) {
  return ((value % period) + period) % period;
}

// Galaxy arm particles drift inward along their arm at this many units² of
// r² per second. Stepping r² (not r) at a constant rate keeps their density
// across the disc unchanged and gives a near-constant speed along the arm.
const GALAXY_INFLOW = 0.075;
const GALAXY_RIM_FADE = 0.35;
// Vertical spread of the arms, as a fraction of radius: thin, so the disc
// reads flat rather than as tall arcs.
const GALAXY_ARM_THICKNESS = 0.012;

export function galaxy(count) {
  const positions = new Float32Array(count * 3);
  let idx = 0;
  const ARMS = 4;
  const TWIST = 2.4;
  const R = 4.2;

  // Dense central bulge — bright nucleus packed tight at the core
  const coreCount = Math.floor(count * 0.15);
  for (let i = 0; i < coreCount; i++, idx++) {
    const r = Math.pow(Math.random(), 2.0) * 0.75;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    positions[idx * 3 + 0] = r * Math.sin(phi) * Math.cos(theta);
    positions[idx * 3 + 1] = r * Math.cos(phi) * 0.45;
    positions[idx * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
  }

  // Spiral arms — each particle remembers its arm angle (θ at r = 0), r² and
  // vertical lift so advance() can slide it along the same curve.
  const armFirst = idx;
  const armCount = count - idx;
  const armAngle = new Float32Array(armCount);
  const armR2 = new Float32Array(armCount);
  const armLift = new Float32Array(armCount);
  for (let arm = 0, j = 0; idx < count; arm = (arm + 1) % ARMS, idx++, j++) {
    const r = Math.sqrt(Math.random()) * R;
    const jitter = (Math.random() - 0.5) * 0.35;
    armAngle[j] = (arm * Math.PI * 2) / ARMS + jitter;
    armR2[j] = r * r;
    armLift[j] = gaussian() * GALAXY_ARM_THICKNESS;
    const theta = armAngle[j] + r * TWIST;
    positions[idx * 3 + 0] = Math.cos(theta) * r;
    positions[idx * 3 + 1] = armLift[j] * r;
    positions[idx * 3 + 2] = Math.sin(theta) * r;
  }

  // Arms stream into the bulge; a particle fades out as it sinks into the
  // centre, loops back to the rim and fades in over the outer GALAXY_RIM_FADE.
  function advance(t, out, fade) {
    for (let j = 0; j < armCount; j++) {
      const r = Math.sqrt(wrap(armR2[j] - GALAXY_INFLOW * t, R * R));
      const theta = armAngle[j] + r * TWIST;
      const i = armFirst + j;
      out[i * 3 + 0] = Math.cos(theta) * r;
      out[i * 3 + 1] = armLift[j] * r;
      out[i * 3 + 2] = Math.sin(theta) * r;
      fade[i] = smoothstep(R, R - GALAXY_RIM_FADE, r) * smoothstep(0, 0.25, r * r);
    }
  }

  return { positions, advance };
}

// Black hole: the tidal stream flows from the disrupted star into the core
// (fraction of the stream per second), the inner ring orbits faster the
// tighter it is, and jet particles are expelled up and down (units/s).
const STREAM_SPEED = 0.0075;
const RING_SPIN = 0.025;
const JET_SPEED = 0.17;
const JET_LENGTH = 5.0;

export function blackHole(count) {
  const positions = new Float32Array(count * 3);
  let idx = 0;

  // Extremely dense compact core — appears white via additive blending saturation
  const coreCount = Math.floor(count * 0.32);
  for (let i = 0; i < coreCount; i++, idx++) {
    const r = Math.pow(Math.random(), 3.5) * 0.24;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    positions[idx * 3 + 0] = r * Math.sin(phi) * Math.cos(theta);
    positions[idx * 3 + 1] = r * Math.cos(phi) * 0.85;
    positions[idx * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
  }

  // Tidal stream — logarithmic spiral arcing from lower-left around the core.
  // t=0 is the far narrow tip, t=1 wraps tight around the core.
  const streamCount = Math.floor(count * 0.38);
  const outerR = 4.2;
  const kSpiral = 2.3;
  const startAngle = Math.PI * 1.15;  // ~207° — lower-left in XZ plane
  const sweepAngle = -Math.PI * 1.6;  // 288° clockwise sweep

  // Star being disrupted — small dense cluster at the outer tip of the stream
  const starX = Math.cos(startAngle) * outerR;
  const starZ = Math.sin(startAngle) * outerR;
  const starCount = Math.floor(count * 0.07);
  for (let i = 0; i < starCount; i++, idx++) {
    const r = Math.pow(Math.random(), 2.5) * 0.18;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    positions[idx * 3 + 0] = starX + r * Math.sin(phi) * Math.cos(theta);
    positions[idx * 3 + 1] = r * Math.cos(phi);
    positions[idx * 3 + 2] = starZ + r * Math.sin(phi) * Math.sin(theta);
  }

  // Loose debris orbiting the disrupted star
  const starDebrisCount = Math.floor(count * 0.05);
  for (let i = 0; i < starDebrisCount; i++, idx++) {
    const r = 0.25 + Math.pow(Math.random(), 1.2) * 1.8;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    positions[idx * 3 + 0] = starX + r * Math.sin(phi) * Math.cos(theta);
    positions[idx * 3 + 1] = r * Math.cos(phi) * 0.4;
    positions[idx * 3 + 2] = starZ + r * Math.sin(phi) * Math.sin(theta);
  }

  // Each stream particle keeps its place along the stream and its offsets
  // across it (as a fraction of the local width) and above it.
  const streamFirst = idx;
  const streamT = new Float32Array(streamCount);
  const streamSide = new Float32Array(streamCount);
  const streamLift = new Float32Array(streamCount);
  function placeOnStream(i, t, side, lift, out) {
    const r = outerR * Math.exp(-kSpiral * t);
    const angle = startAngle + sweepAngle * t;
    const width = 0.03 + t * 0.2;
    out[i * 3 + 0] = Math.cos(angle) * r - Math.sin(angle) * side * width;
    out[i * 3 + 1] = lift * (0.3 + t);
    out[i * 3 + 2] = Math.sin(angle) * r + Math.cos(angle) * side * width;
  }
  for (let j = 0; j < streamCount; j++, idx++) {
    streamT[j] = Math.random();
    streamSide[j] = (Math.random() - 0.5) * 2;
    streamLift[j] = gaussian() * 0.025;
    placeOnStream(idx, streamT[j], streamSide[j], streamLift[j], positions);
  }

  // Circularized inner ring — matter that has completed its first orbit
  const ringFirst = idx;
  const ringCount = Math.floor(count * 0.06);
  const ringR = new Float32Array(ringCount);
  const ringAngle = new Float32Array(ringCount);
  for (let j = 0; j < ringCount; j++, idx++) {
    ringR[j] = 0.18 + Math.pow(Math.random(), 1.5) * 0.45;
    ringAngle[j] = Math.random() * Math.PI * 2;
    positions[idx * 3 + 0] = Math.cos(ringAngle[j]) * ringR[j];
    positions[idx * 3 + 1] = gaussian() * 0.014;
    positions[idx * 3 + 2] = Math.sin(ringAngle[j]) * ringR[j];
  }

  // Relativistic jets — two narrow columns expelled perpendicular to the disk.
  // Each particle keeps its height and a sideways offset that widens with it.
  const jetFirst = idx;
  const jetCount = Math.floor(count * 0.08);
  const jetHeight = new Float32Array(jetCount);
  const jetSideX = new Float32Array(jetCount);
  const jetSideZ = new Float32Array(jetCount);
  function placeOnJet(i, j, h, out) {
    const sign = j < jetCount / 2 ? 1 : -1;
    const spread = h * 0.045 + 0.02;
    out[i * 3 + 0] = jetSideX[j] * spread;
    out[i * 3 + 1] = h * sign;
    out[i * 3 + 2] = jetSideZ[j] * spread;
  }
  for (let j = 0; j < jetCount; j++, idx++) {
    // Uniform heights: with a steady outflow that keeps the jets' density
    // constant instead of pulsing as the particles loop.
    jetHeight[j] = Math.random() * JET_LENGTH;
    jetSideX[j] = gaussian();
    jetSideZ[j] = gaussian();
    placeOnJet(idx, j, jetHeight[j], positions);
  }

  // Remaining particles pad to count (rounding slack)
  for (; idx < count; idx++) {
    positions[idx * 3 + 0] = (Math.random() - 0.5) * 0.1;
    positions[idx * 3 + 1] = (Math.random() - 0.5) * 0.1;
    positions[idx * 3 + 2] = (Math.random() - 0.5) * 0.1;
  }

  // Stream particles fade in as they peel off the star and out as they reach
  // the ring; jet particles start inside the bright core and fade out at the
  // jets' tips before looping back.
  function advance(t, out, fade) {
    for (let j = 0; j < streamCount; j++) {
      const s = wrap(streamT[j] + STREAM_SPEED * t, 1);
      const i = streamFirst + j;
      placeOnStream(i, s, streamSide[j], streamLift[j], out);
      fade[i] = smoothstep(0, 0.05, s) * smoothstep(1, 0.93, s);
    }
    for (let j = 0; j < ringCount; j++) {
      const angle = ringAngle[j] - (RING_SPIN * t) / Math.pow(ringR[j], 1.5);
      const i = ringFirst + j;
      out[i * 3 + 0] = Math.cos(angle) * ringR[j];
      out[i * 3 + 2] = Math.sin(angle) * ringR[j];
    }
    for (let j = 0; j < jetCount; j++) {
      const h = wrap(jetHeight[j] + JET_SPEED * t, JET_LENGTH);
      const i = jetFirst + j;
      placeOnJet(i, j, h, out);
      fade[i] = smoothstep(JET_LENGTH, JET_LENGTH * 0.7, h);
    }
  }

  return { positions, advance };
}

export function solarSystem(count) {
  const positions = new Float32Array(count * 3);
  let idx = 0;

  // Dense sun at center — bright stellar core
  const sunCount = Math.floor(count * 0.13);
  for (let i = 0; i < sunCount; i++, idx++) {
    const r = Math.pow(Math.random(), 2.0) * 0.38;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    positions[idx * 3 + 0] = r * Math.sin(phi) * Math.cos(theta);
    positions[idx * 3 + 1] = r * Math.cos(phi);
    positions[idx * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
  }

  // Planetary orbital rings
  const orbits = [0.5, 0.95, 1.5, 2.1, 2.9, 3.7, 4.5];
  const weights = [0.6, 0.9, 1.0, 1.0, 1.2, 1.3, 1.4];
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  const starShare = 0.04;
  for (; idx < count; idx++) {
    if (Math.random() < starShare) {
      const r = 5.5 + Math.random() * 2.5;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      positions[idx * 3 + 0] = r * Math.sin(phi) * Math.cos(theta);
      positions[idx * 3 + 1] = r * Math.cos(phi);
      positions[idx * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
      continue;
    }
    let pick = Math.random() * totalWeight;
    let bucket = 0;
    for (let b = 0; b < weights.length; b++) {
      pick -= weights[b];
      if (pick <= 0) { bucket = b; break; }
    }
    const r = orbits[bucket] + gaussian() * 0.06;
    const theta = Math.random() * Math.PI * 2;
    const tilt = (Math.random() - 0.5) * 0.08;
    positions[idx * 3 + 0] = Math.cos(theta) * r;
    positions[idx * 3 + 1] = Math.sin(theta) * tilt + gaussian() * 0.02;
    positions[idx * 3 + 2] = Math.sin(theta) * r;
  }

  return { positions };
}

// Earth spins on its axis (atmosphere a touch slower) and the moon orbits
// it, in radians per second about the vertical axis through the Earth.
const EARTH_SPIN = 0.033;
const ATMOSPHERE_SPIN = 0.025;
const MOON_ORBIT = 0.012;

export function earthAndMoon(count) {
  const positions = new Float32Array(count * 3);
  let idx = 0;

  function sphere(cx, cy, cz, r, n, spread = 0.03) {
    const first = idx;
    for (let i = 0; i < n; i++, idx++) {
      const rr    = r + gaussian() * spread;
      const theta = Math.random() * Math.PI * 2;
      const phi   = Math.acos(2 * Math.random() - 1);
      positions[idx * 3 + 0] = cx + rr * Math.sin(phi) * Math.cos(theta);
      positions[idx * 3 + 1] = cy + rr * Math.cos(phi);
      positions[idx * 3 + 2] = cz + rr * Math.sin(phi) * Math.sin(theta);
    }
    return { first, end: idx };
  }

  const moonDist  = 3.6;
  const moonAngle = Math.PI * 0.25;
  const moonX = Math.cos(moonAngle) * moonDist;
  const moonZ = Math.sin(moonAngle) * moonDist;

  // Earth — dense spherical surface
  const earth = sphere(0, 0, 0, 1.55, Math.floor(count * 0.46));

  // Atmosphere — sparse haze shell outside Earth
  const atmosphere = sphere(0, 0, 0, 1.72, Math.floor(count * 0.08), 0.14);

  // Moon — smaller sphere at orbital position
  const moon = sphere(moonX, 0, moonZ, 0.42, Math.floor(count * 0.20));

  // Background stars
  for (; idx < count; idx++) {
    const r     = 6.5 + Math.random() * 4.0;
    const theta = Math.random() * Math.PI * 2;
    const phi   = Math.acos(2 * Math.random() - 1);
    positions[idx * 3 + 0] = r * Math.sin(phi) * Math.cos(theta);
    positions[idx * 3 + 1] = r * Math.cos(phi);
    positions[idx * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
  }

  // Each group turns rigidly about the Earth's vertical axis — for the moon
  // that's its orbit, keeping the same face to the Earth.
  function turn({ first, end }, angle, out) {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    for (let i = first; i < end; i++) {
      const x = positions[i * 3 + 0];
      const z = positions[i * 3 + 2];
      out[i * 3 + 0] = x * cos + z * sin;
      out[i * 3 + 1] = positions[i * 3 + 1];
      out[i * 3 + 2] = -x * sin + z * cos;
    }
  }

  function advance(t, out) {
    turn(earth, EARTH_SPIN * t, out);
    turn(atmosphere, ATMOSPHERE_SPIN * t, out);
    turn(moon, MOON_ORBIT * t, out);
  }

  return { positions, advance };
}

export function grid(count, { tilt = 0, width = 9, height = 9 } = {}) {
  const positions = new Float32Array(count * 3);
  const aspect = width / height;
  const cols = Math.max(1, Math.ceil(Math.sqrt(count * aspect)));
  const rows = Math.max(1, Math.ceil(count / cols));
  const spacingX = width / cols;
  const spacingY = height / rows;
  const halfX = (cols - 1) * spacingX * 0.5;
  const halfY = (rows - 1) * spacingY * 0.5;
  const cosT = Math.cos(tilt);
  const sinT = Math.sin(tilt);
  for (let i = 0; i < count; i++) {
    const ix = i % cols;
    const iy = Math.floor(i / cols);
    const x = ix * spacingX - halfX;
    const y = iy * spacingY - halfY;
    positions[i * 3 + 0] = x;
    positions[i * 3 + 1] = y * cosT;
    positions[i * 3 + 2] = -y * sinT;
  }
  return positions;
}

export const shapeGenerators = [galaxy, blackHole, solarSystem, earthAndMoon];

// ─── Text shape ───────────────────────────────────────────────────────────────
// Rasterises `text` onto an off-screen canvas and samples particle positions
// from lit pixels.  Never added to shapeGenerators — only triggered explicitly.

export function textShape(text, count) {
  const W = 1024, H = 128;
  const canvas = Object.assign(document.createElement('canvas'), { width: W, height: H });
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 96px "VT323", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, W / 2, H / 2);

  // Collect lit pixel coordinates as flat [x0, y0, x1, y1, ...] array
  const { data } = ctx.getImageData(0, 0, W, H);
  const litPixels = [];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (data[(y * W + x) * 4] > 128) litPixels.push(x, y);
    }
  }

  const positions = new Float32Array(count * 3);

  // Fallback: if the font isn't ready yet, scatter along a thin horizontal line
  if (litPixels.length === 0) {
    for (let i = 0; i < count; i++) {
      positions[i * 3]     = (Math.random() - 0.5) * 6.4;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 0.1;
      positions[i * 3 + 2] = 0;
    }
    return positions;
  }

  // Map pixel coords → world space.
  // Camera: z=8, FOV 55° → horizontal extent at z=0 ≈ ±4.4 units.
  // Use worldW=6.4 so text fills ~72% of the visible width with margin.
  const worldW = 6.4;
  const worldH = worldW * (H / W);   // ≈ 0.8 units tall
  const pixelCount = litPixels.length / 2;

  // 62% of particles form the letters; more Z-scatter so rotation reads as 3-D
  const textCount = Math.floor(count * 0.62);
  for (let i = 0; i < textCount; i++) {
    const pick = Math.floor(Math.random() * pixelCount) * 2;
    const px = litPixels[pick];
    const py = litPixels[pick + 1];
    positions[i * 3]     =  (px / W - 0.5) * worldW;
    positions[i * 3 + 1] = -(py / H - 0.5) * worldH;
    positions[i * 3 + 2] =  (Math.random() - 0.5) * 0.5;
  }

  // Remaining 38% fill a sphere around the text.
  // cbrt-distributed radius gives uniform volume density; minR avoids crowding
  // the letter pixels that already occupy the core.
  const sphereR = 4.5;
  const minR    = 0.8;
  for (let i = textCount; i < count; i++) {
    const t     = Math.random();
    const r     = minR + (sphereR - minR) * Math.cbrt(t);
    const theta = Math.random() * Math.PI * 2;
    const phi   = Math.acos(2 * Math.random() - 1);
    positions[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = r * Math.cos(phi);
    positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
  }

  return positions;
}
