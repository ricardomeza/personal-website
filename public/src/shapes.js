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
  const coreCount = Math.floor(count * 0.36);
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
  const streamCount = Math.floor(count * 0.52);
  const outerR = 4.2;
  const kSpiral = 2.3;
  const startAngle = Math.PI * 1.15;  // ~207° — lower-left in XZ plane
  const sweepAngle = -Math.PI * 1.6;  // 288° clockwise sweep

  for (let i = 0; i < streamCount; i++, idx++) {
    const t = Math.random();
    const r = outerR * Math.exp(-kSpiral * t);
    const angle = startAngle + sweepAngle * t;

    const cx = Math.cos(angle) * r;
    const cz = Math.sin(angle) * r;
    const perpX = -Math.sin(angle);
    const perpZ = Math.cos(angle);

    // Narrow at the outer tip, slightly wider as it wraps in
    const width = 0.03 + t * 0.2;
    const scatter = (Math.random() - 0.5) * 2 * width;
    const yScatter = gaussian() * 0.025 * (0.3 + t);

    positions[idx * 3 + 0] = cx + perpX * scatter;
    positions[idx * 3 + 1] = yScatter;
    positions[idx * 3 + 2] = cz + perpZ * scatter;
  }

  // Circularized inner ring — matter that has completed its first orbit
  const ringCount = Math.floor(count * 0.08);
  for (let i = 0; i < ringCount; i++, idx++) {
    const r = 0.18 + Math.pow(Math.random(), 1.5) * 0.45;
    const theta = Math.random() * Math.PI * 2;
    positions[idx * 3 + 0] = Math.cos(theta) * r;
    positions[idx * 3 + 1] = gaussian() * 0.014;
    positions[idx * 3 + 2] = Math.sin(theta) * r;
  }

  // Sparse outer debris (remaining ~4%)
  for (; idx < count; idx++) {
    const r = 1.6 + Math.pow(Math.random(), 2.0) * 2.0;
    const theta = Math.random() * Math.PI * 2;
    positions[idx * 3 + 0] = Math.cos(theta) * r;
    positions[idx * 3 + 1] = gaussian() * 0.05;
    positions[idx * 3 + 2] = Math.sin(theta) * r;
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
