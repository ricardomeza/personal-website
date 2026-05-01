import {
  Clock,
  PerspectiveCamera,
  Scene,
  WebGLRenderer,
} from "three";
import { createParticles } from "./particles.js";
import { shapeGenerators, grid } from "./shapes.js";
import {
  PHASE,
  createStateMachine,
  morphProgress,
} from "./state.js";

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

function animate() {
  const dt = Math.min(clock.getDelta(), 0.05);
  const state = machine.tick(dt);

  if (state.phase === PHASE.SHAPE_HOLD) {
    particles.points.rotation.y += dt * 0.06;
  }

  particles.setMorph(morphProgress(state));

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
