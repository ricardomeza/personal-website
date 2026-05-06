function gaussian() {
  const u = 1 - Math.random();
  const v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

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

  // Spiral arms
  for (let arm = 0; idx < count; arm = (arm + 1) % ARMS, idx++) {
    const r = Math.sqrt(Math.random()) * R;
    const baseAngle = (arm * Math.PI * 2) / ARMS;
    const jitter = (Math.random() - 0.5) * 0.35;
    const theta = baseAngle + r * TWIST + jitter;
    positions[idx * 3 + 0] = Math.cos(theta) * r;
    positions[idx * 3 + 1] = gaussian() * 0.04 * r;
    positions[idx * 3 + 2] = Math.sin(theta) * r;
  }

  return positions;
}

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

  for (let i = 0; i < streamCount; i++, idx++) {
    const t = Math.random();
    const r = outerR * Math.exp(-kSpiral * t);
    const angle = startAngle + sweepAngle * t;

    const cx = Math.cos(angle) * r;
    const cz = Math.sin(angle) * r;
    const perpX = -Math.sin(angle);
    const perpZ = Math.cos(angle);

    const width = 0.03 + t * 0.2;
    const scatter = (Math.random() - 0.5) * 2 * width;
    const yScatter = gaussian() * 0.025 * (0.3 + t);

    positions[idx * 3 + 0] = cx + perpX * scatter;
    positions[idx * 3 + 1] = yScatter;
    positions[idx * 3 + 2] = cz + perpZ * scatter;
  }

  // Circularized inner ring — matter that has completed its first orbit
  const ringCount = Math.floor(count * 0.06);
  for (let i = 0; i < ringCount; i++, idx++) {
    const r = 0.18 + Math.pow(Math.random(), 1.5) * 0.45;
    const theta = Math.random() * Math.PI * 2;
    positions[idx * 3 + 0] = Math.cos(theta) * r;
    positions[idx * 3 + 1] = gaussian() * 0.014;
    positions[idx * 3 + 2] = Math.sin(theta) * r;
  }

  // Relativistic jets — two narrow columns expelled perpendicular to the disk
  const jetCount = Math.floor(count * 0.08);
  for (let i = 0; i < jetCount; i++, idx++) {
    const sign = i < jetCount / 2 ? 1 : -1;
    const y = Math.pow(Math.random(), 1.2) * 5.0 * sign;
    const spread = Math.abs(y) * 0.045 + 0.02;
    positions[idx * 3 + 0] = gaussian() * spread;
    positions[idx * 3 + 1] = y;
    positions[idx * 3 + 2] = gaussian() * spread;
  }

  // Remaining particles pad to count (rounding slack)
  for (; idx < count; idx++) {
    positions[idx * 3 + 0] = (Math.random() - 0.5) * 0.1;
    positions[idx * 3 + 1] = (Math.random() - 0.5) * 0.1;
    positions[idx * 3 + 2] = (Math.random() - 0.5) * 0.1;
  }

  return positions;
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

  return positions;
}

export function earthAndMoon(count) {
  const positions = new Float32Array(count * 3);
  let idx = 0;

  function sphere(cx, cy, cz, r, n, spread = 0.03) {
    for (let i = 0; i < n; i++, idx++) {
      const rr    = r + gaussian() * spread;
      const theta = Math.random() * Math.PI * 2;
      const phi   = Math.acos(2 * Math.random() - 1);
      positions[idx * 3 + 0] = cx + rr * Math.sin(phi) * Math.cos(theta);
      positions[idx * 3 + 1] = cy + rr * Math.cos(phi);
      positions[idx * 3 + 2] = cz + rr * Math.sin(phi) * Math.sin(theta);
    }
  }

  const moonDist  = 3.6;
  const moonAngle = Math.PI * 0.25;
  const moonX = Math.cos(moonAngle) * moonDist;
  const moonZ = Math.sin(moonAngle) * moonDist;

  // Earth — dense spherical surface
  sphere(0, 0, 0, 1.55, Math.floor(count * 0.46));

  // Atmosphere — sparse haze shell outside Earth
  sphere(0, 0, 0, 1.72, Math.floor(count * 0.08), 0.14);

  // Moon — smaller sphere at orbital position
  sphere(moonX, 0, moonZ, 0.42, Math.floor(count * 0.20));

  // Background stars
  for (; idx < count; idx++) {
    const r     = 6.5 + Math.random() * 4.0;
    const theta = Math.random() * Math.PI * 2;
    const phi   = Math.acos(2 * Math.random() - 1);
    positions[idx * 3 + 0] = r * Math.sin(phi) * Math.cos(theta);
    positions[idx * 3 + 1] = r * Math.cos(phi);
    positions[idx * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
  }

  return positions;
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
