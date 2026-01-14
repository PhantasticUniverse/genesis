/**
 * Chaos Analysis: Lyapunov Exponent Calculation
 * Measures sensitivity to initial conditions for cellular automata patterns
 *
 * Based on techniques from:
 * - Wolf et al. (1985) "Determining Lyapunov exponents from a time series"
 * - Kaneko (1989) "Lyapunov analysis and information flow in coupled map lattices"
 */

/** Result of Lyapunov exponent calculation */
export interface LyapunovResult {
  /** Estimated Lyapunov exponent (λ) */
  exponent: number;
  /** Classification based on exponent value */
  classification: 'stable' | 'periodic' | 'chaotic' | 'hyperchaotic';
  /** Divergence measurements over time */
  divergenceHistory: number[];
  /** Confidence score (0-1) based on measurement quality */
  confidence: number;
  /** Initial perturbation magnitude */
  initialPerturbation: number;
  /** Number of steps used for calculation */
  steps: number;
}

/** Configuration for Lyapunov calculation */
export interface LyapunovConfig {
  /** Number of evolution steps for measurement (default: 100) */
  steps: number;
  /** Perturbation magnitude (default: 0.001) */
  perturbationMagnitude: number;
  /** Number of cells to perturb (default: 1) */
  perturbationCount: number;
  /** Whether to renormalize perturbation periodically (default: true) */
  renormalize: boolean;
  /** Steps between renormalization (default: 10) */
  renormalizePeriod: number;
  /** Threshold for exponent classification (default: 0.01) */
  stabilityThreshold: number;
}

export const DEFAULT_LYAPUNOV_CONFIG: LyapunovConfig = {
  steps: 100,
  perturbationMagnitude: 0.001,
  perturbationCount: 1,
  renormalize: true,
  renormalizePeriod: 10,
  stabilityThreshold: 0.01,
};

/**
 * Calculate L2 distance between two states
 */
export function stateDistance(state1: Float32Array, state2: Float32Array): number {
  if (state1.length !== state2.length) {
    throw new Error('State arrays must have the same length');
  }

  let sumSquared = 0;
  for (let i = 0; i < state1.length; i++) {
    const diff = state1[i] - state2[i];
    sumSquared += diff * diff;
  }

  return Math.sqrt(sumSquared);
}

/**
 * Calculate L1 (Manhattan) distance between two states
 */
export function stateDistanceL1(state1: Float32Array, state2: Float32Array): number {
  if (state1.length !== state2.length) {
    throw new Error('State arrays must have the same length');
  }

  let sum = 0;
  for (let i = 0; i < state1.length; i++) {
    sum += Math.abs(state1[i] - state2[i]);
  }

  return sum;
}

/**
 * Create a perturbed copy of a state
 */
export function createPerturbedState(
  state: Float32Array,
  config: LyapunovConfig = DEFAULT_LYAPUNOV_CONFIG
): Float32Array {
  const perturbed = new Float32Array(state);
  const { perturbationMagnitude, perturbationCount } = config;

  // Find non-zero cells to perturb (or random cells if all zero)
  const nonZeroIndices: number[] = [];
  for (let i = 0; i < state.length; i++) {
    if (state[i] > 0.01) {
      nonZeroIndices.push(i);
    }
  }

  // If no non-zero cells, perturb random cells
  const indicesToPerturb: number[] = [];
  if (nonZeroIndices.length === 0) {
    for (let i = 0; i < perturbationCount; i++) {
      indicesToPerturb.push(Math.floor(Math.random() * state.length));
    }
  } else {
    // Perturb random non-zero cells
    const shuffled = [...nonZeroIndices].sort(() => Math.random() - 0.5);
    for (let i = 0; i < Math.min(perturbationCount, shuffled.length); i++) {
      indicesToPerturb.push(shuffled[i]);
    }
  }

  // Apply perturbation
  for (const idx of indicesToPerturb) {
    // Add or subtract based on random direction, but ensure non-zero result
    let direction = Math.random() > 0.5 ? 1 : -1;
    // If value is near 0 and we're subtracting, force addition
    if (perturbed[idx] < perturbationMagnitude && direction < 0) {
      direction = 1;
    }
    // If value is near 1 and we're adding, force subtraction
    if (perturbed[idx] > 1 - perturbationMagnitude && direction > 0) {
      direction = -1;
    }
    perturbed[idx] = Math.max(0, Math.min(1, perturbed[idx] + direction * perturbationMagnitude));
  }

  return perturbed;
}

/**
 * Normalize perturbation to maintain constant magnitude
 * This is important for accurate Lyapunov exponent estimation
 */
export function renormalizePerturbation(
  reference: Float32Array,
  perturbed: Float32Array,
  targetMagnitude: number
): Float32Array {
  const currentDistance = stateDistance(reference, perturbed);

  if (currentDistance < 1e-10) {
    // Perturbation has died out, return copy with fresh perturbation
    return createPerturbedState(reference, {
      ...DEFAULT_LYAPUNOV_CONFIG,
      perturbationMagnitude: targetMagnitude,
    });
  }

  const scale = targetMagnitude / currentDistance;
  const result = new Float32Array(perturbed.length);

  for (let i = 0; i < perturbed.length; i++) {
    // Scale perturbation from reference state
    const diff = perturbed[i] - reference[i];
    result[i] = Math.max(0, Math.min(1, reference[i] + diff * scale));
  }

  return result;
}

/**
 * Step function type for evolving the cellular automaton
 */
export type EvolutionStep = (state: Float32Array) => Float32Array;

/**
 * Calculate Lyapunov exponent for a cellular automaton
 *
 * @param initialState - Starting state of the CA
 * @param stepFunction - Function that evolves the state by one step
 * @param config - Configuration options
 * @returns Lyapunov analysis result
 */
export function calculateLyapunovExponent(
  initialState: Float32Array,
  stepFunction: EvolutionStep,
  config: Partial<LyapunovConfig> = {}
): LyapunovResult {
  const fullConfig = { ...DEFAULT_LYAPUNOV_CONFIG, ...config };
  const {
    steps,
    perturbationMagnitude,
    renormalize,
    renormalizePeriod,
    stabilityThreshold,
  } = fullConfig;

  // Create perturbed state
  let referenceState = new Float32Array(initialState);
  let perturbedState = createPerturbedState(initialState, fullConfig);

  const initialDistance = stateDistance(referenceState, perturbedState);
  const divergenceHistory: number[] = [initialDistance];

  let sumLogRatios = 0;
  let validMeasurements = 0;

  for (let step = 0; step < steps; step++) {
    // Evolve both states
    referenceState = stepFunction(referenceState);
    perturbedState = stepFunction(perturbedState);

    const currentDistance = stateDistance(referenceState, perturbedState);
    divergenceHistory.push(currentDistance);

    // Calculate contribution to Lyapunov exponent
    if (currentDistance > 1e-10 && divergenceHistory[step] > 1e-10) {
      const logRatio = Math.log(currentDistance / divergenceHistory[step]);
      sumLogRatios += logRatio;
      validMeasurements++;
    }

    // Renormalize if enabled
    if (renormalize && (step + 1) % renormalizePeriod === 0) {
      perturbedState = renormalizePerturbation(
        referenceState,
        perturbedState,
        perturbationMagnitude
      );
    }
  }

  // Calculate average Lyapunov exponent
  const exponent = validMeasurements > 0 ? sumLogRatios / validMeasurements : 0;

  // Calculate confidence based on measurement consistency
  const confidence = calculateConfidence(divergenceHistory, exponent);

  // Classify the system
  const classification = classifyDynamics(exponent, stabilityThreshold);

  return {
    exponent,
    classification,
    divergenceHistory,
    confidence,
    initialPerturbation: initialDistance,
    steps,
  };
}

/**
 * Calculate confidence score for the Lyapunov measurement
 */
function calculateConfidence(divergenceHistory: number[], exponent: number): number {
  if (divergenceHistory.length < 10) return 0;

  // Calculate variance of local Lyapunov estimates
  const localExponents: number[] = [];
  for (let i = 1; i < divergenceHistory.length; i++) {
    if (divergenceHistory[i] > 1e-10 && divergenceHistory[i - 1] > 1e-10) {
      localExponents.push(Math.log(divergenceHistory[i] / divergenceHistory[i - 1]));
    }
  }

  if (localExponents.length < 5) return 0;

  const mean = localExponents.reduce((a, b) => a + b, 0) / localExponents.length;
  const variance = localExponents.reduce((acc, val) => acc + (val - mean) ** 2, 0) / localExponents.length;
  const stdDev = Math.sqrt(variance);

  // Confidence is high when variance is low relative to the exponent magnitude
  const relativeVariation = stdDev / (Math.abs(mean) + 0.01);
  return Math.max(0, Math.min(1, 1 - relativeVariation));
}

/**
 * Classify dynamical behavior based on Lyapunov exponent
 */
export function classifyDynamics(
  exponent: number,
  threshold: number = 0.01
): 'stable' | 'periodic' | 'chaotic' | 'hyperchaotic' {
  if (exponent < -threshold) {
    return 'stable';
  } else if (Math.abs(exponent) <= threshold) {
    return 'periodic';
  } else if (exponent > 1) {
    return 'hyperchaotic';
  } else {
    return 'chaotic';
  }
}

/**
 * Calculate local Lyapunov exponents over time
 * Useful for detecting transient behavior
 */
export function calculateLocalLyapunov(
  divergenceHistory: number[],
  windowSize: number = 10
): number[] {
  const localExponents: number[] = [];

  for (let i = windowSize; i < divergenceHistory.length; i++) {
    const startDist = divergenceHistory[i - windowSize];
    const endDist = divergenceHistory[i];

    if (startDist > 1e-10 && endDist > 1e-10) {
      const localExp = Math.log(endDist / startDist) / windowSize;
      localExponents.push(localExp);
    } else {
      localExponents.push(0);
    }
  }

  return localExponents;
}

/**
 * Estimate the largest Lyapunov exponent using the Wolf algorithm
 * This is more robust for noisy systems
 */
export function wolfLyapunovEstimate(
  initialState: Float32Array,
  stepFunction: EvolutionStep,
  config: Partial<LyapunovConfig> = {}
): LyapunovResult {
  const fullConfig = {
    ...DEFAULT_LYAPUNOV_CONFIG,
    renormalize: true,
    renormalizePeriod: 5,
    ...config,
  };

  const { steps, perturbationMagnitude, renormalizePeriod } = fullConfig;

  let referenceState = new Float32Array(initialState);
  let perturbedState = createPerturbedState(initialState, fullConfig);

  const initialDistance = stateDistance(referenceState, perturbedState);
  const divergenceHistory: number[] = [initialDistance];

  let sumLogGrowth = 0;
  let renormCount = 0;

  for (let step = 0; step < steps; step++) {
    // Evolve both states
    referenceState = stepFunction(referenceState);
    perturbedState = stepFunction(perturbedState);

    const currentDistance = stateDistance(referenceState, perturbedState);
    divergenceHistory.push(currentDistance);

    // At renormalization points, record growth and reset
    if ((step + 1) % renormalizePeriod === 0) {
      if (currentDistance > 1e-10) {
        sumLogGrowth += Math.log(currentDistance / perturbationMagnitude);
        renormCount++;
      }

      // Renormalize perturbation
      perturbedState = renormalizePerturbation(
        referenceState,
        perturbedState,
        perturbationMagnitude
      );
    }
  }

  // Calculate average exponent
  const exponent = renormCount > 0
    ? sumLogGrowth / (renormCount * renormalizePeriod)
    : 0;

  const confidence = calculateConfidence(divergenceHistory, exponent);
  const classification = classifyDynamics(exponent, fullConfig.stabilityThreshold);

  return {
    exponent,
    classification,
    divergenceHistory,
    confidence,
    initialPerturbation: initialDistance,
    steps,
  };
}

/**
 * Quick stability check - faster but less accurate
 */
export function quickStabilityCheck(
  initialState: Float32Array,
  stepFunction: EvolutionStep,
  steps: number = 20
): 'stable' | 'unstable' | 'unknown' {
  const perturbed = createPerturbedState(initialState, {
    ...DEFAULT_LYAPUNOV_CONFIG,
    perturbationMagnitude: 0.01,
    perturbationCount: 3,
  });

  let refState = new Float32Array(initialState);
  let pertState = new Float32Array(perturbed);
  const initialDist = stateDistance(refState, pertState);

  for (let i = 0; i < steps; i++) {
    refState = stepFunction(refState);
    pertState = stepFunction(pertState);
  }

  const finalDist = stateDistance(refState, pertState);

  if (finalDist < initialDist * 0.5) {
    return 'stable';
  } else if (finalDist > initialDist * 2) {
    return 'unstable';
  } else {
    return 'unknown';
  }
}
