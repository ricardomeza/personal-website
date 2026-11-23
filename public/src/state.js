export const PHASE = {
  SHAPE_HOLD: "SHAPE_HOLD",
  DISSOLVE_TO_GRID: "DISSOLVE_TO_GRID",
  GRID_HOLD: "GRID_HOLD",
  MORPH_TO_NEXT: "MORPH_TO_NEXT",
};

export const PHASE_DURATIONS = {
  [PHASE.SHAPE_HOLD]: 7.0,
  [PHASE.DISSOLVE_TO_GRID]: 1.5,
  [PHASE.GRID_HOLD]: 0,
  [PHASE.MORPH_TO_NEXT]: 1.0,
};

const PHASE_ORDER = [
  PHASE.SHAPE_HOLD,
  PHASE.DISSOLVE_TO_GRID,
  PHASE.GRID_HOLD,
  PHASE.MORPH_TO_NEXT,
];

export function createStateMachine({ onPhaseEnter, initialPhase = PHASE.SHAPE_HOLD, initialShapeIndex = 0, shapeCount = 3 }) {
  const state = {
    phase: initialPhase,
    elapsed: 0,
    shapeIndex: initialShapeIndex,
  };

  function advancePhase() {
    const idx = PHASE_ORDER.indexOf(state.phase);
    const next = PHASE_ORDER[(idx + 1) % PHASE_ORDER.length];
    state.phase = next;
    state.elapsed = 0;
    if (next === PHASE.SHAPE_HOLD) {
      state.shapeIndex = (state.shapeIndex + 1) % shapeCount;
    }
    onPhaseEnter(state);
  }

  function tick(dt) {
    state.elapsed += dt;
    const duration = PHASE_DURATIONS[state.phase];
    if (state.elapsed >= duration) {
      const overflow = state.elapsed - duration;
      advancePhase();
      state.elapsed = Math.min(overflow, PHASE_DURATIONS[state.phase]);
    }
    return state;
  }

  // Reset to SHAPE_HOLD without triggering onPhaseEnter.
  // Used after an externally-driven morph (e.g. text shape) so the normal
  // hold → dissolve → next cycle runs from here.
  function forceShapeHold() {
    state.phase   = PHASE.SHAPE_HOLD;
    state.elapsed = 0;
  }

  return { state, tick, forceShapeHold };
}

// Dissolve → grid hold → morph is one continuous journey (shape → grid →
// next shape); this maps the current phase onto its linear 0..1 progress.
// Easing happens per particle in the shader. Outside the journey the
// particles rest at its end.
const DISSOLVE_SECONDS = PHASE_DURATIONS[PHASE.DISSOLVE_TO_GRID];
const JOURNEY_SECONDS = DISSOLVE_SECONDS + PHASE_DURATIONS[PHASE.MORPH_TO_NEXT];

// Progress at which the journey passes through the grid.
export const GRID_KNOT = DISSOLVE_SECONDS / JOURNEY_SECONDS;

export function journeyProgress(state) {
  switch (state.phase) {
    case PHASE.DISSOLVE_TO_GRID:
      return state.elapsed / JOURNEY_SECONDS;
    case PHASE.GRID_HOLD:
      return GRID_KNOT;
    case PHASE.MORPH_TO_NEXT:
      return Math.min(1, (DISSOLVE_SECONDS + state.elapsed) / JOURNEY_SECONDS);
    default:
      return 1;
  }
}
