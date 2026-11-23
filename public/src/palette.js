import { Color } from "three";

const tmp = new Color();

export function generateColors(count) {
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const hue = Math.random();
    const saturation = 0.15 + Math.random() * 0.15;
    const lightness = 0.45 + Math.random() * 0.15;
    tmp.setHSL(hue, saturation, lightness);
    colors[i * 3 + 0] = tmp.r;
    colors[i * 3 + 1] = tmp.g;
    colors[i * 3 + 2] = tmp.b;
  }
  return colors;
}

// Per-particle [brightness, flash strength, phase, rate]. Everyone gets a
// little brightness variation; a sparse subset burns brighter and flashes.
const SPARKLE_SHARE = 0.06;

export function generateSparkles(count) {
  const sparkles = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) {
    const isSparkle = Math.random() < SPARKLE_SHARE;
    sparkles[i * 4 + 0] = isSparkle ? 1.3 + Math.random() * 0.7 : 0.7 + Math.random() * 0.5;
    sparkles[i * 4 + 1] = isSparkle ? 0.6 + Math.random() * 0.4 : 0;
    sparkles[i * 4 + 2] = Math.random() * Math.PI * 2;
    sparkles[i * 4 + 3] = 0.8 + Math.random() * 1.6;
  }
  return sparkles;
}
