export const PHASE = {
  SHAPE_HOLD: "SHAPE_HOLD",
  DISSOLVE_TO_GRID: "DISSOLVE_TO_GRID",
  GRID_HOLD: "GRID_HOLD",
  MORPH_TO_NEXT: "MORPH_TO_NEXT",
};

export const PHASE_DURATIONS = {
  [PHASE.SHAPE_HOLD]: 7.0,
  [PHASE.DISSOLVE_TO_GRID]: 3.0,
  [PHASE.GRID_HOLD]: 0,
  [PHASE.MORPH_TO_NEXT]: 2.0,
};

const PHASE_ORDER = [
  PHASE.SHAPE_HOLD,
  PHASE.DISSOLVE_TO_GRID,
  PHASE.GRID_HOLD,
  PHASE.MORPH_TO_NEXT,
];

export function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export function easeOutQuart(t) {
  return 1 - Math.pow(1 - t, 4);
}

export function easeFor(phase) {
  if (phase === PHASE.DISSOLVE_TO_GRID) return easeInOutCubic;
  if (phase === PHASE.MORPH_TO_NEXT) return easeOutQuart;
  return (t) => t;
}

export function createStateMachine({ onPhaseEnter }) {
  const state = {
    phase: PHASE.SHAPE_HOLD,
    elapsed: 0,
    shapeIndex: 0,
  };

  function advancePhase() {
    const idx = PHASE_ORDER.indexOf(state.phase);
    const next = PHASE_ORDER[(idx + 1) % PHASE_ORDER.length];
    state.phase = next;
    state.elapsed = 0;
    if (next === PHASE.SHAPE_HOLD) {
      state.shapeIndex = (state.shapeIndex + 1) % 3;
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

  return { state, tick };
}

export function morphProgress(state) {
  if (
    state.phase !== PHASE.DISSOLVE_TO_GRID &&
    state.phase !== PHASE.MORPH_TO_NEXT
  ) {
    return 0;
  }
  const duration = PHASE_DURATIONS[state.phase];
  const raw = Math.min(1, state.elapsed / duration);
  return easeFor(state.phase)(raw);
}
