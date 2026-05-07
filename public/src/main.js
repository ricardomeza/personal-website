import {
  Clock,
  PerspectiveCamera,
  Scene,
  WebGLRenderer,
} from "three";
import { createParticles } from "./particles.js";
import { shapeGenerators, grid, textShape } from "./shapes.js";
import {
  PHASE,
  createStateMachine,
  morphProgress,
} from "./state.js";
import { Terminal } from "./terminal.js";

const PARTICLE_COUNT = 20000;
const BG = 0x0d0d0d;

const canvas = document.getElementById("scene");
const renderer = new WebGLRenderer({ canvas, antialias: false, alpha: false });
const pixelRatio = Math.min(window.devicePixelRatio, 2);
renderer.setPixelRatio(pixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(BG, 1);

const scene = new Scene();
const camera = new PerspectiveCamera(
  55,
  window.innerWidth / window.innerHeight,
  0.1,
  100
);
camera.position.set(0, 1.5, 8);
camera.lookAt(0, 0, 0);

// Mouse parallax — camera drifts slightly toward cursor, always looking at origin
const CAMERA_BASE = { x: 0, y: 1.5 };
const PAR_SCALE = { x: 0.35, y: 0.18 };
const PAR_EASE = 0.04;
const mouseNorm = { x: 0, y: 0 };
const par = { x: 0, y: 0 };

window.addEventListener("mousemove", (e) => {
  mouseNorm.x = (e.clientX / window.innerWidth) * 2 - 1;
  mouseNorm.y = -((e.clientY / window.innerHeight) * 2 - 1);
});

const cameraTilt = Math.atan2(camera.position.y, camera.position.z);
const cameraDist = Math.hypot(camera.position.y, camera.position.z);

function viewportGridSize() {
  const halfFov = (camera.fov * Math.PI) / 360;
  const height = 2 * cameraDist * Math.tan(halfFov);
  const width = height * camera.aspect;
  return { width, height };
}

// Start with full-screen grid; will morph into black hole immediately
const initialPositions = grid(PARTICLE_COUNT, { tilt: cameraTilt, ...viewportGridSize() });
const particles = createParticles({
  count: PARTICLE_COUNT,
  initialPositions,
  pixelRatio,
});
scene.add(particles.points);

let currentTarget = initialPositions;

function applyTarget(positions) {
  particles.setTarget(positions);
  currentTarget = positions;
}

// First morph target is black hole (index 1)
applyTarget(shapeGenerators[1](PARTICLE_COUNT));

const machine = createStateMachine({
  initialPhase: PHASE.MORPH_TO_NEXT,
  initialShapeIndex: 1,
  shapeCount: shapeGenerators.length,
  onPhaseEnter(state) {
    if (state.phase === PHASE.DISSOLVE_TO_GRID) {
      particles.bakeYRotation(particles.points.rotation.y);
      particles.points.rotation.y = 0;
      applyTarget(grid(PARTICLE_COUNT, { tilt: cameraTilt, ...viewportGridSize() }));
    } else if (state.phase === PHASE.MORPH_TO_NEXT) {
      applyTarget(shapeGenerators[state.shapeIndex](PARTICLE_COUNT));
    } else {
      applyTarget(currentTarget);
    }
  },
});

const clock = new Clock();

// ─── Text-morph state ─────────────────────────────────────────────────────────
// textShape is NEVER added to shapeGenerators — it only appears when the user
// explicitly types "Ricardo Meza" in the terminal.
let textMorphActive  = false;
let textMorphT       = 0;    // 0 → 1 over ~1.5 s
let textMorphPending = null; // holds the positions array until bake is done

function triggerTextMorph() {
  const positions = textShape('Ricardo Meza', PARTICLE_COUNT);
  particles.bakeYRotation(particles.points.rotation.y);
  particles.points.rotation.y = 0;
  particles.setTarget(positions);
  textMorphPending = positions;
  textMorphActive  = true;
  textMorphT       = 0;
}

function animate() {
  const dt = Math.min(clock.getDelta(), 0.05);

  if (textMorphActive) {
    textMorphT = Math.min(textMorphT + dt / 1.5, 1.0);
    particles.setMorph(textMorphT);

    if (textMorphT >= 1.0) {
      // Morph-in complete — bake text positions into the position buffer so
      // the GPU shader reads them at uMorph=0 (SHAPE_HOLD returns 0).
      // setTarget swaps: position ← old aTarget (= textMorphPending), aTarget ← textMorphPending
      particles.setTarget(textMorphPending);
      currentTarget    = textMorphPending;
      textMorphPending = null;
      textMorphActive  = false;
      // Hand control back to the state machine at SHAPE_HOLD so the normal
      // hold (7 s) → dissolve to grid → next shape cycle runs from here.
      machine.forceShapeHold();
    }
  } else {
    const state = machine.tick(dt);
    if (state.phase === PHASE.SHAPE_HOLD) {
      particles.points.rotation.y += dt * 0.06;
    }
    particles.setMorph(morphProgress(state));
  }

  // Smooth parallax — lerp camera toward mouse-driven offset, keep looking at origin
  par.x += (-mouseNorm.x * PAR_SCALE.x - par.x) * PAR_EASE;
  par.y += (mouseNorm.y * PAR_SCALE.y - par.y) * PAR_EASE;
  camera.position.x = CAMERA_BASE.x + par.x;
  camera.position.y = CAMERA_BASE.y + par.y;
  camera.lookAt(0, 0, 0);

  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

window.addEventListener("resize", () => {
  const w = window.innerWidth;
  const h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  const ratio = Math.min(window.devicePixelRatio, 2);
  renderer.setPixelRatio(ratio);
  renderer.setSize(w, h);
  particles.setPixelRatio(ratio);
});

animate();

new Terminal({
  links: [
    { label: 'github',   href: 'https://github.com/ricardomeza' },
    { label: 'x',        href: 'https://x.com/ricardo_meza' },
    { label: 'linkedin', href: 'https://www.linkedin.com/in/ricardomeza/' },
  ],
  apps: [
    { label: 'lightguard', href: 'https://ricardomeza.com/lightguard', desc: 'monitors room lighting to protect your sleep' },
    { label: 'scribugo',   href: 'https://scribugo.com',               desc: 'AI creative assistant — express yourself through a story' },
  ],
  onNameSubmit: triggerTextMorph,  // Enter on "Ricardo Meza" → particles spell the name
});
