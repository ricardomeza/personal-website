function gaussian() {
  const u = 1 - Math.random();
  const v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export function galaxy(count) {
  const positions = new Float32Array(count * 3);
  const ARMS = 4;
  const TWIST = 2.4;
  const R = 4.2;
  for (let i = 0; i < count; i++) {
    const arm = i % ARMS;
    const r = Math.sqrt(Math.random()) * R;
    const baseAngle = (arm * Math.PI * 2) / ARMS;
    const jitter = (Math.random() - 0.5) * 0.35;
    const theta = baseAngle + r * TWIST + jitter;
    const x = Math.cos(theta) * r;
    const z = Math.sin(theta) * r;
    const bulge = Math.exp(-r * 0.6) * 0.8;
    const y = gaussian() * (0.04 * r + bulge * 0.4);
    positions[i * 3 + 0] = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z;
  }
  return positions;
}

export function blackHole(count) {
  const positions = new Float32Array(count * 3);
  let idx = 0;

  // Dense singularity core — particles pile up toward center, representing
  // the extreme mass concentration. Slightly flattened by the spin.
  const coreCount = Math.floor(count * 0.18);
  for (let i = 0; i < coreCount; i++, idx++) {
    const r = Math.pow(Math.random(), 2.5) * 0.55;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    positions[idx * 3 + 0] = r * Math.sin(phi) * Math.cos(theta);
    positions[idx * 3 + 1] = r * Math.cos(phi) * 0.35;
    positions[idx * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
  }

  // Accretion disk — flat ring feeding into the core, denser near center
  const diskCount = Math.floor(count * 0.48);
  for (let i = 0; i < diskCount; i++, idx++) {
    const t = Math.pow(Math.random(), 2.0);
    const r = 0.6 + t * 3.4;
    const theta = Math.random() * Math.PI * 2;
    positions[idx * 3 + 0] = Math.cos(theta) * r;
    positions[idx * 3 + 1] = gaussian() * 0.022 * (1 + r * 0.07);
    positions[idx * 3 + 2] = Math.sin(theta) * r;
  }

  // Gravitational lensing halo — high-inclination orbits arching above/below
  const haloCount = Math.floor(count * 0.27);
  for (let i = 0; i < haloCount; i++, idx++) {
    const r = 0.8 + Math.random() * 0.9;
    const theta = Math.random() * Math.PI * 2;
    const incl = (0.35 + Math.random() * 0.65) * Math.PI * (Math.random() < 0.5 ? 1 : -1);
    const sinI = Math.sin(incl);
    const cosI = Math.cos(incl);
    positions[idx * 3 + 0] = Math.cos(theta) * r;
    positions[idx * 3 + 1] = Math.sin(theta) * r * sinI + gaussian() * 0.06;
    positions[idx * 3 + 2] = Math.sin(theta) * r * cosI;
  }

  // Sparse outer dust
  for (; idx < count; idx++) {
    const r = 1.5 + Math.pow(Math.random(), 1.5) * 3.2;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    positions[idx * 3 + 0] = r * Math.sin(phi) * Math.cos(theta);
    positions[idx * 3 + 1] = r * Math.cos(phi) * 0.12;
    positions[idx * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
  }

  return positions;
}

export function solarSystem(count) {
  const positions = new Float32Array(count * 3);
  const orbits = [0.5, 0.95, 1.5, 2.1, 2.9, 3.7, 4.5];
  const weights = [0.6, 0.9, 1.0, 1.0, 1.2, 1.3, 1.4];
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  const starShare = 0.04;
  for (let i = 0; i < count; i++) {
    if (Math.random() < starShare) {
      const r = 5.5 + Math.random() * 2.5;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      positions[i * 3 + 0] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.cos(phi);
      positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
      continue;
    }
    let pick = Math.random() * totalWeight;
    let bucket = 0;
    for (let b = 0; b < weights.length; b++) {
      pick -= weights[b];
      if (pick <= 0) {
        bucket = b;
        break;
      }
    }
    const r = orbits[bucket] + gaussian() * 0.06;
    const theta = Math.random() * Math.PI * 2;
    const tilt = (Math.random() - 0.5) * 0.08;
    const x = Math.cos(theta) * r;
    const z = Math.sin(theta) * r;
    const y = Math.sin(theta) * tilt + gaussian() * 0.02;
    positions[i * 3 + 0] = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z;
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
    const x = ix * spacingX - halfX + (Math.random() - 0.5) * spacingX * 0.4;
    const y = iy * spacingY - halfY + (Math.random() - 0.5) * spacingY * 0.4;
    positions[i * 3 + 0] = x;
    positions[i * 3 + 1] = y * cosT;
    positions[i * 3 + 2] = -y * sinT;
  }
  return positions;
}

export const shapeGenerators = [galaxy, blackHole, solarSystem, earthAndMoon];
