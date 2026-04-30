import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Points,
  ShaderMaterial,
} from "three";
import { generateColors } from "./palette.js";

const vertexShader = /* glsl */ `
  attribute vec3 aTarget;
  attribute vec3 aColor;
  attribute float aDelay;

  uniform float uMorph;
  uniform float uSize;
  uniform float uPixelRatio;

  varying vec3 vColor;

  void main() {
    float local = clamp((uMorph - aDelay) / 0.7, 0.0, 1.0);
    float t = smoothstep(0.0, 1.0, local);
    vec3 morphed = mix(position, aTarget, t);

    vec4 mvPosition = modelViewMatrix * vec4(morphed, 1.0);
    gl_Position = projectionMatrix * mvPosition;

    float dist = -mvPosition.z;
    gl_PointSize = uSize * uPixelRatio * (1.0 / max(dist, 0.0001));

    vColor = aColor;
  }
`;

const fragmentShader = /* glsl */ `
  varying vec3 vColor;

  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float d = length(uv);
    if (d > 0.5) discard;
    float alpha = smoothstep(0.5, 0.0, d);
    gl_FragColor = vec4(vColor, alpha * 0.85);
  }
`;

export function createParticles({ count, initialPositions, pixelRatio }) {
  const geometry = new BufferGeometry();

  const positions = new Float32Array(initialPositions);
  const targets = new Float32Array(initialPositions);
  const colors = generateColors(count);
  const delays = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    delays[i] = Math.random() * 0.3;
  }

  geometry.setAttribute("position", new BufferAttribute(positions, 3));
  geometry.setAttribute("aTarget", new BufferAttribute(targets, 3));
  geometry.setAttribute("aColor", new BufferAttribute(colors, 3));
  geometry.setAttribute("aDelay", new BufferAttribute(delays, 1));

  const material = new ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: {
      uMorph: { value: 0 },
      uSize: { value: 14 },
      uPixelRatio: { value: pixelRatio },
    },
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
  });

  const points = new Points(geometry, material);
  points.frustumCulled = false;

  function setTarget(nextPositions) {
    const posAttr = geometry.attributes.position;
    const tgtAttr = geometry.attributes.aTarget;
    posAttr.array.set(tgtAttr.array);
    tgtAttr.array.set(nextPositions);
    posAttr.needsUpdate = true;
    tgtAttr.needsUpdate = true;
    material.uniforms.uMorph.value = 0;
  }

  function bakeYRotation(angle) {
    if (angle === 0) return;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const posAttr = geometry.attributes.position;
    const tgtAttr = geometry.attributes.aTarget;
    const pos = posAttr.array;
    const tgt = tgtAttr.array;
    for (let i = 0; i < count; i++) {
      const ix = i * 3;
      const px = pos[ix];
      const pz = pos[ix + 2];
      pos[ix] = px * cos + pz * sin;
      pos[ix + 2] = -px * sin + pz * cos;
      const tx = tgt[ix];
      const tz = tgt[ix + 2];
      tgt[ix] = tx * cos + tz * sin;
      tgt[ix + 2] = -tx * sin + tz * cos;
    }
    posAttr.needsUpdate = true;
    tgtAttr.needsUpdate = true;
  }

  function setMorph(value) {
    material.uniforms.uMorph.value = value;
  }

  function setPixelRatio(ratio) {
    material.uniforms.uPixelRatio.value = ratio;
  }

  return {
    points,
    geometry,
    material,
    setTarget,
    setMorph,
    setPixelRatio,
    bakeYRotation,
  };
}
