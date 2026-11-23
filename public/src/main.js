import {
  Clock,
  PerspectiveCamera,
  Scene,
  WebGLRenderer,
} from "three";
import { createParticles } from "./particles.js";
import { createParallaxInput } from "./parallax-input.js";
import { shapeGenerators, grid, textShape } from "./shapes.js";
import {
  GRID_KNOT,
  PHASE,
  PHASE_DURATIONS,
  createStateMachine,
  journeyProgress,
} from "./state.js";
import { Terminal } from "./terminal.js";
import { AgentPanel } from "./agent.js";

const PARTICLE_COUNT = 20000;
const BG = 0x0d0d0d;

// Speed at which particles cross the grid, relative to their average speed
// on the way in and out: low enough that the grid reads, never zero.
const GRID_THROUGH = 0.45;

// The cloud spins without pause — through holds and transitions alike — so
// particles leave a shape and settle into the next one already moving.
const SPIN_SPEED = 0.06;

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

// Parallax — camera drifts slightly toward the input (mouse, touch drag or
// device tilt — see parallax-input.js), always looking at origin
const CAMERA_BASE = { x: 0, y: 1.5 };
const PAR_SCALE = { x: 0.35, y: 0.18 };
const PAR_EASE = 0.04;
const parallaxInput = createParallaxInput();
const par = { x: 0, y: 0 };

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

const clock = new Clock();
let time = 0;

// The shape the current journey is heading to and the one it left, each with
// the time it formed, so moving shapes keep moving on arrival, through their
// hold and as particles peel away from them (see shape.advance in shapes.js).
let arriving = { shape: { positions: initialPositions }, born: 0 };
let departing = null;

function journeyTo(shape, options) {
  departing = arriving;
  arriving = { shape, born: time };
  particles.travel(shape.positions, options);
}

function journeyViaGrid(shape, via) {
  journeyTo(shape, { via, knot: GRID_KNOT, through: GRID_THROUGH });
}

// Journeys run in the spinning cloud's local space. Screen-aligned layouts
// (the grid, the name) are counter-rotated by the angle the cloud will have
// reached `seconds` from now, so they face the camera at that moment.
function facingCameraIn(seconds, positions) {
  const angle = -(particles.points.rotation.y + SPIN_SPEED * seconds);
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const out = new Float32Array(positions.length);
  for (let i = 0; i < positions.length; i += 3) {
    const x = positions[i];
    const z = positions[i + 2];
    out[i] = x * cos + z * sin;
    out[i + 1] = positions[i + 1];
    out[i + 2] = -x * sin + z * cos;
  }
  return out;
}

// The page opens mid-journey, already on the grid and flowing into the
// black hole (index 1) — the state machine starts at MORPH_TO_NEXT.
journeyViaGrid(shapeGenerators[1](PARTICLE_COUNT), initialPositions);

const isMobile    = window.matchMedia('(max-width: 540px)').matches || navigator.maxTouchPoints > 1;
const isCellular  = navigator.connection?.type === 'cellular';
const isSaveData  = navigator.connection?.saveData === true;
const agent = (isMobile || isCellular || isSaveData) ? null : new AgentPanel();

const machine = createStateMachine({
  initialPhase: PHASE.MORPH_TO_NEXT,
  initialShapeIndex: 1,
  shapeCount: shapeGenerators.length,
  onPhaseEnter(state) {
    agent?.onSceneEvent(state);
    // One journey covers dissolve → grid → next shape, so it's planned in
    // full here; the following phases only advance its progress.
    if (state.phase === PHASE.DISSOLVE_TO_GRID) {
      journeyViaGrid(
        shapeGenerators[state.shapeIndex](PARTICLE_COUNT),
        facingCameraIn(
          PHASE_DURATIONS[PHASE.DISSOLVE_TO_GRID],
          grid(PARTICLE_COUNT, { tilt: cameraTilt, ...viewportGridSize() }),
        ),
      );
    }
  },
});

// ─── Text-morph state ─────────────────────────────────────────────────────────
// textShape is NEVER added to shapeGenerators — it only appears when the user
// explicitly types "Ricardo Meza" in the terminal.
let textMorphActive  = false;
let textMorphT       = 0;    // 0 → 1 over TEXT_MORPH_SECONDS
const TEXT_MORPH_SECONDS = 1.5;

function triggerTextMorph() {
  agent?.onTextMorph();
  journeyTo({ positions: facingCameraIn(TEXT_MORPH_SECONDS, textShape('Ricardo Meza', PARTICLE_COUNT)) });
  textMorphActive  = true;
  textMorphT       = 0;
}

function animate() {
  const dt = Math.min(clock.getDelta(), 0.05);
  time += dt;
  particles.setTime(time);
  particles.points.rotation.y = (particles.points.rotation.y + dt * SPIN_SPEED) % (Math.PI * 2);

  let progress;
  if (textMorphActive) {
    textMorphT = Math.min(textMorphT + dt / TEXT_MORPH_SECONDS, 1.0);
    progress = textMorphT;

    if (textMorphT >= 1.0) {
      // Morph-in complete: the particles now rest on the text. Hand control
      // back to the state machine at SHAPE_HOLD so the normal hold (5.5 s) →
      // dissolve to grid → next shape cycle runs from here.
      textMorphActive = false;
      machine.forceShapeHold();
    }
  } else {
    progress = journeyProgress(machine.tick(dt));
  }
  particles.setProgress(progress);

  if (arriving.shape.advance) {
    particles.advanceTarget(arriving.shape.advance, time - arriving.born);
  }
  if (departing && progress >= 1) departing = null;
  if (departing?.shape.advance) {
    particles.advanceStart(departing.shape.advance, time - departing.born);
  }

  // Smooth parallax — lerp camera toward input-driven offset, keep looking at origin
  par.x += (-parallaxInput.x * PAR_SCALE.x - par.x) * PAR_EASE;
  par.y += (parallaxInput.y * PAR_SCALE.y - par.y) * PAR_EASE;
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

const terminal = new Terminal({
  links: [
    { label: 'github',   href: 'https://github.com/ricardomeza' },
    { label: 'x',        href: 'https://x.com/ricardo_meza' },
    { label: 'linkedin', href: 'https://www.linkedin.com/in/ricardomeza/' },
  ],
  apps: [
    { label: 'lightguard', href: 'https://ricardomeza.com/lightguard', desc: 'monitors room lighting to protect your sleep' },
    { label: 'scribugo',   href: 'https://scribugo.com',               desc: 'AI creative assistant — express yourself through a story' },
  ],
  // `about <topic>` — each key is a topic; `desc` shows in the `about` index.
  // contact, plus a few hidden ones, are built into terminal.js.
  about: {
    me: {
      desc: 'who I am',
      summary: 'AI Product Engineer and Product Lead. I use AI to solve problems, improve user experiences and automate workflows.',
      facts: [
        { label: 'based in',   text: 'Mexico City' },
        { label: 'now',        text: 'Labs Team @ Clara — designing and shipping full-stack AI tools from 0 to 1' },
        { label: 'experience', text: 'many years across frontend architecture, full-stack development and team leadership — Clara · Conekta · Rappi · MetaMap · Mozilla Foundation and Mozilla México' },
      ],
    },
    work: {
      desc: "where I've worked",
      facts: [
        { label: 'clara',   text: "Labs Team, now — full-stack AI tools from 0 to 1 at Latin America's leading corporate payments platform" },
        { label: 'conekta', text: 'Frontend Architect' },
        { label: 'rappi',   text: 'senior engineer' },
        { label: 'metamap', text: 'senior engineer' },
        { label: 'mozilla', text: '4 years as Main Manager for Mozilla México — localized Firefox into Mexican Spanish and indigenous languages' },
      ],
    },
    site: {
      desc: 'how this site works',
      facts: [
        { label: 'particles', text: '20,000 points morphing between a galaxy, a black hole, the solar system and the earth & moon — Three.js + custom shaders' },
        { label: 'terminal',  text: "vanilla JS, no framework — you're using it right now" },
        { label: 'ai panel',  text: 'Llama 3.2 1B running locally in your browser via WebLLM (desktop only)' },
        { label: 'hosting',   text: 'static assets on Cloudflare Workers' },
      ],
    },
  },
  onNameSubmit: triggerTextMorph,  // Enter on "Ricardo Meza" → particles spell the name
  extraEnv: () => [`MOTION_SENSOR=${parallaxInput.status}`],  // tilt diagnostics via `env`
});
terminal.onCommand = (cmd, args) => agent?.onTerminalCommand(cmd, args);
