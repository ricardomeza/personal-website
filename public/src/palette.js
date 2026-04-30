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
