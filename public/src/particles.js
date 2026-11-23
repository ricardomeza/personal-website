import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Points,
  ShaderMaterial,
} from "three";
import { generateColors, generateSparkles } from "./palette.js";

// Every transition is a "journey": position → aVia → aTarget, driven by a
// single uProgress in [0, 1]. Each leg is a cubic Hermite curve; both legs
// share the same velocity at aVia, so particles ease off as they approach the
// waypoint and pick speed back up as they leave it — they never stop there.
// They only come to rest at the journey's two ends.
const vertexShader = /* glsl */ `
  attribute vec3 aVia;
  attribute vec3 aTarget;
  attribute vec3 aColor;
  attribute float aDelay;
  attribute vec4 aSpark; // x: base brightness, y: flash strength, z: phase, w: rate

  uniform float uProgress;
  uniform float uKnot;    // progress at which every particle crosses aVia
  uniform float uThrough; // speed at aVia, relative to the legs' average speed
  uniform float uStagger;
  uniform float uTime;
  uniform float uSize;
  uniform float uPixelRatio;

  varying vec3 vColor;
  varying float vFlash;

  vec3 hermite(vec3 p0, vec3 m0, vec3 p1, vec3 m1, float u) {
    float u2 = u * u;
    float u3 = u2 * u;
    return (2.0 * u3 - 3.0 * u2 + 1.0) * p0
         + (u3 - 2.0 * u2 + u) * m0
         + (3.0 * u2 - 2.0 * u3) * p1
         + (u3 - u2) * m1;
  }

  void main() {
    // Late leavers arrive late, but everyone crosses aVia together at uKnot,
    // so the waypoint shape (the grid) still reads cleanly as they flow through.
    float leave  = aDelay * uStagger * uKnot;
    float arrive = 1.0 - (1.0 - aDelay) * uStagger * (1.0 - uKnot);
    float dur1 = uKnot - leave;
    float dur2 = arrive - uKnot;
    vec3 through = uThrough * 0.5 * ((aVia - position) / dur1 + (aTarget - aVia) / dur2);

    vec3 p;
    if (uProgress < uKnot) {
      float u = clamp((uProgress - leave) / dur1, 0.0, 1.0);
      p = hermite(position, vec3(0.0), aVia, through * dur1, u);
    } else {
      float u = clamp((uProgress - uKnot) / dur2, 0.0, 1.0);
      p = hermite(aVia, through * dur2, aTarget, vec3(0.0), u);
    }

    vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mvPosition;

    // Sparkle only shows on a formed shape: it fades out as a journey sets off
    // and back in as particles land, so in transit (and on the grid) every
    // particle is back to its base size and colour.
    float sparkle = max(1.0 - smoothstep(0.0, 0.15, uProgress), smoothstep(0.8, 1.0, uProgress));

    // A sine raised to a high power is near zero most of the cycle and
    // spikes briefly at its crest — a short flash, then a long rest.
    float wave = 0.5 + 0.5 * sin(uTime * aSpark.w + aSpark.z);
    float flash = aSpark.y * pow(wave, 28.0) * sparkle;
    float brightness = mix(1.0, aSpark.x, sparkle);
    vFlash = flash;

    float dist = -mvPosition.z;
    gl_PointSize = uSize * uPixelRatio * (1.0 + flash * 3.0) / max(dist, 0.0001);

    // Flash in the particle's own hue: saturate it as it brightens so the
    // glint reads as its colour instead of washing out to white.
    float luma = dot(aColor, vec3(0.299, 0.587, 0.114));
    vec3 vivid = clamp(mix(vec3(luma), aColor, 3.2), 0.0, 1.0);
    vColor = mix(aColor, vivid, min(flash * 1.5, 1.0)) * (brightness + flash * 1.4);
  }
`;

const fragmentShader = /* glsl */ `
  varying vec3 vColor;
  varying float vFlash;

  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float d = length(uv);
    if (d > 0.5) discard;
    float glow = smoothstep(0.5, 0.0, d);

    // While flashing: a hot core plus faint four-point spikes.
    float core = exp(-d * d * 60.0);
    float spikes = (exp(-abs(uv.x) * 36.0) + exp(-abs(uv.y) * 36.0)) * (1.0 - 2.0 * d);
    float shape = mix(glow, core + spikes * 0.55 + glow * 0.25, clamp(vFlash, 0.0, 1.0));

    gl_FragColor = vec4(vColor, shape * 0.85);
  }
`;

export function createParticles({ count, initialPositions, pixelRatio }) {
  const geometry = new BufferGeometry();

  const delays = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    delays[i] = Math.random();
  }

  geometry.setAttribute("position", new BufferAttribute(new Float32Array(initialPositions), 3));
  geometry.setAttribute("aVia", new BufferAttribute(new Float32Array(initialPositions), 3));
  geometry.setAttribute("aTarget", new BufferAttribute(new Float32Array(initialPositions), 3));
  geometry.setAttribute("aColor", new BufferAttribute(generateColors(count), 3));
  geometry.setAttribute("aDelay", new BufferAttribute(delays, 1));
  geometry.setAttribute("aSpark", new BufferAttribute(generateSparkles(count), 4));

  const material = new ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: {
      uProgress: { value: 1 },
      uKnot: { value: 0.5 },
      uThrough: { value: 1.5 },
      uStagger: { value: 0.4 },
      uTime: { value: 0 },
      uSize: { value: 14 },
      uPixelRatio: { value: pixelRatio },
    },
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
  });

  const points = new Points(geometry, material);
  points.frustumCulled = false;

  const { position: startAttr, aVia: viaAttr, aTarget: targetAttr } = geometry.attributes;

  // Begin a new journey from where the last one ended (aTarget) to `to`,
  // crossing `via` at progress `knot` at `through` × the legs' average speed.
  // Without `via` it's a direct morph: with via at the midpoint, knot 0.5 and
  // through 1.5 the Hermite legs reduce exactly to a smoothstep from → to.
  function travel(to, { via = null, knot = 0.5, through = 1.5 } = {}) {
    const from = startAttr.array;
    from.set(targetAttr.array);
    if (via) {
      viaAttr.array.set(via);
    } else {
      const mid = viaAttr.array;
      for (let i = 0; i < mid.length; i++) mid[i] = (from[i] + to[i]) * 0.5;
    }
    targetAttr.array.set(to);
    startAttr.needsUpdate = true;
    viaAttr.needsUpdate = true;
    targetAttr.needsUpdate = true;
    material.uniforms.uKnot.value = knot;
    material.uniforms.uThrough.value = through;
    material.uniforms.uProgress.value = 0;
  }

  function setProgress(value) {
    material.uniforms.uProgress.value = value;
  }

  function setTime(seconds) {
    material.uniforms.uTime.value = seconds;
  }

  function setPixelRatio(ratio) {
    material.uniforms.uPixelRatio.value = ratio;
  }

  return {
    points,
    geometry,
    material,
    travel,
    setProgress,
    setTime,
    setPixelRatio,
  };
}
