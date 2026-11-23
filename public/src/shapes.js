// A shape is { positions, fade?, advance? }. `positions` is where each
// particle sits when the shape forms; `fade`, if given, is each particle's
// brightness there (1 when omitted). `advance(t, out, fade, eye)`, when present,
// makes the shape move while it's on screen: it writes where its moving
// particles are `t` seconds after it formed into `out` (xyz per particle) and
// how visible each one is into `fade` (0..1). Particles that loop — back to a
// galaxy's rim, say — sit at fade 0 where they wrap so they never pop in or
// out. Particles advance() doesn't write keep their `positions` place. `eye`
// is the camera's position in the same frame, for shapes that shade their
// surface by which way it faces.
//
// Generators take (count, { yaw, viewer }): shapes with a front of their own
// turn by `yaw` so it faces the camera when they form, with the camera at
// `viewer`; the rest ignore both.

import { isLand } from "./earth-land.js";

function gaussian() {
  const u = 1 - Math.random();
  const v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

const DEG = Math.PI / 180;

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

// Solar system: the Sun, the eight planets on their orbits, the asteroid
// belt and faint orbit paths. Distances are squeezed so all fit, and sizes
// kept close together so the giants don't dominate.
// Planets and asteroids orbit counter-clockwise seen from above, at
// Kepler-like speeds: ω = ORBIT_SPEED / r^1.5, so inner planets lap faster.
const ORBIT_SPEED = 0.08;
const PLANETS = [
  // orbit radius, body radius, share of particles, angle at forming
  // (degrees; 0° is to the right of the Sun, 270° toward the camera)
  { orbit: 0.62, radius: 0.045, share: 0.008, angle: 320 }, // Mercury
  { orbit: 0.88, radius: 0.075, share: 0.014, angle: 170 }, // Venus
  { orbit: 1.18, radius: 0.08, share: 0.015, angle: 100 },  // Earth
  { orbit: 1.5, radius: 0.06, share: 0.011, angle: 35 },    // Mars
  { orbit: 2.35, radius: 0.15, share: 0.035, angle: 320, bands: true }, // Jupiter
  { orbit: 3.05, radius: 0.13, share: 0.025, angle: 215, rings: { inner: 0.175, outer: 0.29, gap: [0.237, 0.25], share: 0.022, tilt: 15 } }, // Saturn
  { orbit: 3.75, radius: 0.1, share: 0.016, angle: 150 }, // Uranus
  { orbit: 4.4, radius: 0.1, share: 0.016, angle: 55 },   // Neptune
];
const BELT = { inner: 1.75, outer: 2.05, share: 0.06 };
const PLANET_TONE = 1.3;
const ORBIT_PATH_TONE = 0.28;

export function solarSystem(count, { yaw = 0 } = {}) {
  const positions = new Float32Array(count * 3);
  const fade = new Float32Array(count).fill(1);
  let idx = 0;

  // Dense sun at center — bright stellar core
  const sunCount = Math.floor(count * 0.18);
  for (let i = 0; i < sunCount; i++, idx++) {
    const r = Math.pow(Math.random(), 2.0) * 0.38;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    positions[idx * 3 + 0] = r * Math.sin(phi) * Math.cos(theta);
    positions[idx * 3 + 1] = r * Math.cos(phi);
    positions[idx * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
  }

  // Planets — each particle keeps its offset from its planet's centre
  // (turned by `yaw`, so Saturn's rings open toward the camera on forming).
  const offset = new Float32Array(count * 3);
  const cosYaw = Math.cos(yaw);
  const sinYaw = Math.sin(yaw);
  function placeOffset(i, x, y, z) {
    offset[i * 3 + 0] = x * cosYaw + z * sinYaw;
    offset[i * 3 + 1] = y;
    offset[i * 3 + 2] = -x * sinYaw + z * cosYaw;
  }
  const bodies = PLANETS.map((planet) => {
    const first = idx;
    const n = Math.floor(count * planet.share);
    for (let i = 0; i < n; i++, idx++) {
      const rr = planet.radius * (1 + gaussian() * 0.06);
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      placeOffset(idx, rr * Math.sin(phi) * Math.cos(theta), rr * Math.cos(phi), rr * Math.sin(phi) * Math.sin(theta));
      // Banded planets alternate bright and dim belts by latitude.
      const dark = planet.bands && Math.sin((Math.PI / 2 - phi) * 7) < 0;
      fade[idx] = dark ? PLANET_TONE * 0.55 : PLANET_TONE;
    }
    const rings = planet.rings;
    if (rings) {
      const tilt = rings.tilt * DEG;
      const ringEnd = idx + Math.floor(count * rings.share);
      while (idx < ringEnd) {
        // uniform over the ring's area, skipping the Cassini division
        const r = Math.sqrt(rings.inner ** 2 + Math.random() * (rings.outer ** 2 - rings.inner ** 2));
        if (r > rings.gap[0] && r < rings.gap[1]) continue;
        const theta = Math.random() * Math.PI * 2;
        const x = r * Math.cos(theta);
        const z = r * Math.sin(theta);
        placeOffset(idx, x, -z * Math.sin(tilt) + gaussian() * 0.003, z * Math.cos(tilt));
        fade[idx] = PLANET_TONE * 0.8;
        idx++;
      }
    }
    return { ...planet, first, end: idx, spin: ORBIT_SPEED / Math.pow(planet.orbit, 1.5) };
  });

  // Asteroid belt between Mars and Jupiter
  const beltFirst = idx;
  const beltCount = Math.floor(count * BELT.share);
  const beltR = new Float32Array(beltCount);
  const beltAngle = new Float32Array(beltCount);
  const beltY = new Float32Array(beltCount);
  for (let j = 0; j < beltCount; j++, idx++) {
    beltR[j] = BELT.inner + Math.random() * (BELT.outer - BELT.inner);
    beltAngle[j] = Math.random() * Math.PI * 2;
    beltY[j] = gaussian() * 0.03;
    fade[idx] = 0.7;
  }

  // Background stars
  const starEnd = idx + Math.floor(count * 0.15);
  for (; idx < starEnd; idx++) {
    const r = 5.5 + Math.random() * 2.5;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    positions[idx * 3 + 0] = r * Math.sin(phi) * Math.cos(theta);
    positions[idx * 3 + 1] = r * Math.cos(phi);
    positions[idx * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
  }

  // Faint orbit paths with the rest, spread evenly along their length
  const totalOrbit = PLANETS.reduce((sum, planet) => sum + planet.orbit, 0);
  for (; idx < count; idx++) {
    let pick = Math.random() * totalOrbit;
    const orbit = PLANETS.find((planet) => (pick -= planet.orbit) <= 0)?.orbit ?? PLANETS[0].orbit;
    const r = orbit + gaussian() * 0.012;
    const theta = Math.random() * Math.PI * 2;
    positions[idx * 3 + 0] = Math.cos(theta) * r;
    positions[idx * 3 + 1] = gaussian() * 0.006;
    positions[idx * 3 + 2] = Math.sin(theta) * r;
    fade[idx] = ORBIT_PATH_TONE;
  }

  function advance(t, out) {
    for (const body of bodies) {
      const angle = body.angle * DEG + yaw + body.spin * t;
      const cx = body.orbit * Math.cos(angle);
      const cz = -body.orbit * Math.sin(angle);
      for (let i = body.first; i < body.end; i++) {
        out[i * 3 + 0] = cx + offset[i * 3 + 0];
        out[i * 3 + 1] = offset[i * 3 + 1];
        out[i * 3 + 2] = cz + offset[i * 3 + 2];
      }
    }
    for (let j = 0; j < beltCount; j++) {
      const angle = beltAngle[j] + (ORBIT_SPEED / Math.pow(beltR[j], 1.5)) * t;
      const i = beltFirst + j;
      out[i * 3 + 0] = beltR[j] * Math.cos(angle);
      out[i * 3 + 1] = beltY[j];
      out[i * 3 + 2] = -beltR[j] * Math.sin(angle);
    }
  }

  advance(0, positions);
  return { positions, fade, advance };
}

// Earth spins on its axis (atmosphere a touch slower) and the moon orbits
// it, in radians per second about the vertical axis through the Earth.
const EARTH_SPIN = 0.033;
const ATMOSPHERE_SPIN = 0.025;
const MOON_ORBIT = 0.012;

// Longitude facing the camera when the Earth forms (Africa and Europe); the
// spin then carries the view slowly west, toward the Atlantic.
const EARTH_FACING_LON = 0;

// How likely a surface spot is to get a particle (keep) and how bright that
// particle is (tone): land dense and bright, sea sparse and dim, so the
// continents read as shapes; the moon's maria are its dark "seas" and young
// craters glow.
const LAND = { keep: 1, tone: 1.4 };
const SEA = { keep: 0.08, tone: 0.45 };
const HIGHLAND = { keep: 1, tone: 1.3 };
const MARE = { keep: 0.12, tone: 0.35 };
const CRATER = { keep: 1, tone: 2 };

// The cloud is see-through, so each sphere's far side is dimmed to this
// fraction to keep it from muddling the outlines on the near side. Toward
// the rim a sphere's surface crowds together on screen; scaling brightness by
// how squarely a spot faces the camera evens that out, so the disc reads
// evenly lit and its features — not a bright ring — stand out.
const FAR_SIDE = 0.1;

// The Moon's near side as [latitude, longitude, radius] in degrees
// (selenographic, east positive): the maria that make its face, and the
// bright craters Tycho, Copernicus and Aristarchus.
const MOON_MARIA = [
  [28, -50, 12], [12, -58, 14], [-3, -50, 11], [20, -68, 9], // Oceanus Procellarum
  [8, -28, 8],   // Mare Insularum
  [33, -16, 16], // Mare Imbrium
  [56, -30, 5], [58, -10, 5], [58, 10, 5], [56, 28, 5], // Mare Frigoris
  [28, 17, 10],  // Mare Serenitatis
  [8, 30, 12],   // Mare Tranquillitatis
  [17, 59, 8],   // Mare Crisium
  [-8, 52, 10],  // Mare Fecunditatis
  [-15, 35, 5],  // Mare Nectaris
  [13, 4, 4],    // Mare Vaporum
  [2, 2, 3],     // Sinus Medii
  [-21, -17, 10], // Mare Nubium
  [-10, -23, 5], // Mare Cognitum
  [-24, -39, 6], // Mare Humorum
];
const MOON_CRATERS = [
  [-43, -11, 4],  // Tycho
  [10, -20, 3],   // Copernicus
  [24, -47, 2.5], // Aristarchus
];

function within(features, lat, lon) {
  for (const [fLat, fLon, radius] of features) {
    const cosDistance =
      Math.sin(lat * DEG) * Math.sin(fLat * DEG) +
      Math.cos(lat * DEG) * Math.cos(fLat * DEG) * Math.cos((lon - fLon) * DEG);
    if (cosDistance >= Math.cos(radius * DEG)) return true;
  }
  return false;
}

function earthSurface(lat, lon) {
  return isLand(lat, lon + EARTH_FACING_LON) ? LAND : SEA;
}

function moonSurface(lat, lon) {
  if (within(MOON_CRATERS, lat, lon)) return CRATER;
  return within(MOON_MARIA, lat, lon) ? MARE : HIGHLAND;
}

// `yaw` turns the scene so its front (+z) faces the camera when it forms and
// `viewer` is where the camera is then; main.js passes both.
export function earthAndMoon(count, { yaw = 0, viewer = { x: 0, y: 1.5, z: 8 } } = {}) {
  const base = new Float32Array(count * 3);
  const tone = new Float32Array(count).fill(1);
  let idx = 0;

  function sphere(cx, cy, cz, r, n, spread = 0.03) {
    const first = idx;
    for (let i = 0; i < n; i++, idx++) {
      const rr    = r + gaussian() * spread;
      const theta = Math.random() * Math.PI * 2;
      const phi   = Math.acos(2 * Math.random() - 1);
      base[idx * 3 + 0] = cx + rr * Math.sin(phi) * Math.cos(theta);
      base[idx * 3 + 1] = cy + rr * Math.cos(phi);
      base[idx * 3 + 2] = cz + rr * Math.sin(phi) * Math.sin(theta);
    }
    return { first, end: idx };
  }

  // A sphere whose surface has features: spots are drawn uniformly and kept
  // with their surface's odds. `front`, `right` and `up` orient its map —
  // latitude 0, longitude 0 faces `front`, east is toward `right`.
  function globe(center, r, n, { front, right, up }, surfaceAt) {
    const first = idx;
    while (idx < first + n) {
      const lat = Math.asin(2 * Math.random() - 1);
      const lon = (Math.random() * 2 - 1) * Math.PI;
      const surface = surfaceAt(lat / DEG, lon / DEG);
      if (Math.random() >= surface.keep) continue;
      const rr = r + gaussian() * 0.02;
      const f = Math.cos(lat) * Math.cos(lon);
      const e = Math.cos(lat) * Math.sin(lon);
      const u = Math.sin(lat);
      for (let k = 0; k < 3; k++) {
        base[idx * 3 + k] = center[k] + rr * (f * front[k] + e * right[k] + u * up[k]);
      }
      tone[idx] = surface.tone;
      idx++;
    }
    return { first, end: idx, center };
  }

  const moonDist  = 3.6;
  const moonAngle = Math.PI * 0.25;
  const moonCenter = [Math.cos(moonAngle) * moonDist, 0, Math.sin(moonAngle) * moonDist];

  // Earth — continents on a sphere whose axis is vertical, so its spin turns
  // them about the poles.
  const earth = globe([0, 0, 0], 1.55, Math.floor(count * 0.54),
    { front: [0, 0, 1], right: [1, 0, 0], up: [0, 1, 0] }, earthSurface);

  // Atmosphere — sparse haze shell outside Earth
  const atmosphere = sphere(0, 0, 0, 1.72, Math.floor(count * 0.05), 0.14);

  // Moon — its near side turned toward the camera.
  const toViewer = normalize([viewer.x - moonCenter[0], viewer.y - moonCenter[1], viewer.z - moonCenter[2]]);
  const moonUp = normalize([-toViewer[1] * toViewer[0], 1 - toViewer[1] * toViewer[1], -toViewer[1] * toViewer[2]]);
  const moon = globe(moonCenter, 0.42, Math.floor(count * 0.23),
    { front: toViewer, right: cross(moonUp, toViewer), up: moonUp }, moonSurface);

  // Background stars
  for (; idx < count; idx++) {
    const r     = 6.5 + Math.random() * 4.0;
    const theta = Math.random() * Math.PI * 2;
    const phi   = Math.acos(2 * Math.random() - 1);
    base[idx * 3 + 0] = r * Math.sin(phi) * Math.cos(theta);
    base[idx * 3 + 1] = r * Math.cos(phi);
    base[idx * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
  }

  // Each group turns rigidly about the Earth's vertical axis — for the moon
  // that's its orbit, keeping the same face to the Earth.
  function turn({ first, end }, angle, out) {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    for (let i = first; i < end; i++) {
      const x = base[i * 3 + 0];
      const z = base[i * 3 + 2];
      out[i * 3 + 0] = x * cos + z * sin;
      out[i * 3 + 1] = base[i * 3 + 1];
      out[i * 3 + 2] = -x * sin + z * cos;
    }
  }

  // Brightness = surface tone × how squarely the spot faces the camera.
  function shade({ first, end }, cx, cz, out, fade, eye) {
    for (let i = first; i < end; i++) {
      const px = out[i * 3 + 0];
      const py = out[i * 3 + 1];
      const pz = out[i * 3 + 2];
      const nx = px - cx, ny = py, nz = pz - cz;
      const vx = eye.x - px, vy = eye.y - py, vz = eye.z - pz;
      const facing = (nx * vx + ny * vy + nz * vz) /
        Math.sqrt((nx * nx + ny * ny + nz * nz) * (vx * vx + vy * vy + vz * vz));
      fade[i] = tone[i] * Math.max(FAR_SIDE, Math.pow(Math.max(facing, 0), 0.8));
    }
  }

  const positions = new Float32Array(base);
  turn(earth, yaw, positions);
  turn(atmosphere, yaw, positions);
  turn(moon, yaw, positions);

  function advance(t, out, fade, eye) {
    const moonTurn = yaw + MOON_ORBIT * t;
    turn(earth, yaw + EARTH_SPIN * t, out);
    turn(atmosphere, yaw + ATMOSPHERE_SPIN * t, out);
    turn(moon, moonTurn, out);
    shade(earth, 0, 0, out, fade, eye);
    shade(moon,
      moonCenter[0] * Math.cos(moonTurn) + moonCenter[2] * Math.sin(moonTurn),
      -moonCenter[0] * Math.sin(moonTurn) + moonCenter[2] * Math.cos(moonTurn),
      out, fade, eye);
  }

  return { positions, advance };
}

function normalize([x, y, z]) {
  const length = Math.hypot(x, y, z);
  return [x / length, y / length, z / length];
}

function cross([ax, ay, az], [bx, by, bz]) {
  return [ay * bz - az * by, az * bx - ax * bz, ax * by - ay * bx];
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
