/**
 * IMGEP Trainer
 * Intrinsically Motivated Goal Exploration Process for Neural CA
 *
 * Key concepts:
 * - Goal sampling: Select targets in increasing difficulty
 * - Prior selection: Use history to initialize parameters
 * - Adaptive curriculum: Progress based on success rate
 */

import {
  type CAParameters,
  type CAGradients,
  forwardPass,
  backwardPass,
  mseLoss,
  createTargetState,
} from './differentiable-ca';
import {
  type AdamState,
  type ParameterGroup,
  createAdamState,
  adamStep,
  clipGradientNorm,
  warmupLR,
  cosineLR,
} from './optimizer';

export interface TrainingConfig {
  // Simulation parameters
  width: number;
  height: number;
  stepsPerEpisode: number;

  // Training parameters
  learningRate: number;
  gradientsPerEpisode: number;
  maxGradientNorm: number;

  // Curriculum parameters
  initialDifficulty: number;   // Starting distance (0-1)
  maxDifficulty: number;       // Max distance (0-1)
  successThreshold: number;    // Loss threshold for success
  successRateTarget: number;   // Target success rate to increase difficulty
  difficultyIncrement: number; // How much to increase difficulty

  // History
  maxHistorySize: number;
}

const DEFAULT_CONFIG: TrainingConfig = {
  width: 64,
  height: 64,
  stepsPerEpisode: 50,

  learningRate: 0.001,
  gradientsPerEpisode: 100,
  maxGradientNorm: 1.0,

  initialDifficulty: 0.1,
  maxDifficulty: 0.8,
  successThreshold: 0.01,
  successRateTarget: 0.7,
  difficultyIncrement: 0.05,

  maxHistorySize: 1000,
};

export interface TrainingHistory {
  params: CAParameters;
  startState: Float32Array;
  targetDistance: number;
  finalLoss: number;
  success: boolean;
}

export interface TrainerState {
  config: TrainingConfig;
  currentDifficulty: number;
  history: TrainingHistory[];
  recentSuccesses: boolean[];
  totalEpisodes: number;
  optimizerState: AdamState;
}

/**
 * Create initial training state
 */
export function createTrainerState(config: Partial<TrainingConfig> = {}): TrainerState {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  return {
    config: cfg,
    currentDifficulty: cfg.initialDifficulty,
    history: [],
    recentSuccesses: [],
    totalEpisodes: 0,
    optimizerState: createAdamState(),
  };
}

/**
 * Sample a goal based on current difficulty
 */
export function sampleGoal(
  state: TrainerState,
  currentCentroid: { x: number; y: number }
): { x: number; y: number } {
  const { config, currentDifficulty } = state;

  // Maximum distance based on difficulty
  const maxDist = currentDifficulty * Math.min(config.width, config.height) * 0.5;

  // Random angle
  const angle = Math.random() * 2 * Math.PI;

  // Random distance within current difficulty
  const dist = maxDist * (0.5 + 0.5 * Math.random());

  return {
    x: (currentCentroid.x + dist * Math.cos(angle) + config.width) % config.width,
    y: (currentCentroid.y + dist * Math.sin(angle) + config.height) % config.height,
  };
}

/**
 * Select prior parameters from history
 * Uses similarity to current goal to find relevant past experience
 */
export function selectPrior(
  state: TrainerState,
  targetDistance: number
): CAParameters | null {
  if (state.history.length === 0) {
    return null;
  }

  // Find successful episodes with similar difficulty
  const candidates = state.history.filter(h =>
    h.success && Math.abs(h.targetDistance - targetDistance) < 0.2
  );

  if (candidates.length === 0) {
    // Fall back to any successful episode
    const successful = state.history.filter(h => h.success);
    if (successful.length === 0) {
      return null;
    }
    return successful[Math.floor(Math.random() * successful.length)].params;
  }

  // Return random candidate from similar difficulty
  return candidates[Math.floor(Math.random() * candidates.length)].params;
}

/**
 * Create initial CA parameters
 */
export function createInitialParams(kernelRadius: number = 5): CAParameters {
  const kernelSize = kernelRadius * 2 + 1;
  const kernelWeights = new Float32Array(kernelSize * kernelSize);

  // Initialize with Gaussian-like kernel
  for (let y = 0; y < kernelSize; y++) {
    for (let x = 0; x < kernelSize; x++) {
      const dx = x - kernelRadius;
      const dy = y - kernelRadius;
      const r = Math.sqrt(dx * dx + dy * dy) / kernelRadius;
      kernelWeights[y * kernelSize + x] = Math.exp(-r * r * 2);
    }
  }

  return {
    kernelWeights,
    kernelRadius,
    growthCenter: 0.15,
    growthWidth: 0.03,
    dt: 0.1,
  };
}

/**
 * Clone CA parameters
 */
function cloneParams(params: CAParameters): CAParameters {
  return {
    kernelWeights: new Float32Array(params.kernelWeights),
    kernelRadius: params.kernelRadius,
    growthCenter: params.growthCenter,
    growthWidth: params.growthWidth,
    dt: params.dt,
  };
}

/**
 * Run one training episode
 */
export function runEpisode(
  state: TrainerState,
  initialState: Float32Array,
  params: CAParameters
): { finalLoss: number; success: boolean; updatedParams: CAParameters } {
  const { config } = state;
  const workingParams = cloneParams(params);

  // Calculate current centroid
  let cx = 0, cy = 0, total = 0;
  for (let y = 0; y < config.height; y++) {
    for (let x = 0; x < config.width; x++) {
      const val = initialState[y * config.width + x];
      cx += x * val;
      cy += y * val;
      total += val;
    }
  }
  if (total > 0) {
    cx /= total;
    cy /= total;
  }

  // Sample target goal
  const goal = sampleGoal(state, { x: cx, y: cy });
  const targetDistance = Math.sqrt(
    Math.pow(goal.x - cx, 2) + Math.pow(goal.y - cy, 2)
  ) / Math.min(config.width, config.height);

  // Create target state
  const targetState = createTargetState(
    initialState,
    config.width,
    config.height,
    goal.x,
    goal.y
  );

  // Learning rate scheduler
  const lrScheduler = warmupLR(
    config.learningRate,
    10,
    cosineLR(config.learningRate, config.gradientsPerEpisode, config.learningRate * 0.1)
  );

  // Training loop
  let finalLoss = Infinity;
  for (let gradStep = 0; gradStep < config.gradientsPerEpisode; gradStep++) {
    // Forward pass
    const { finalState, cache } = forwardPass(
      initialState,
      workingParams,
      config.width,
      config.height,
      config.stepsPerEpisode
    );

    // Compute loss
    finalLoss = mseLoss(finalState, targetState);

    // Early stopping if successful
    if (finalLoss < config.successThreshold) {
      break;
    }

    // Backward pass
    const gradients = backwardPass(
      cache,
      workingParams,
      targetState,
      config.width,
      config.height
    );

    // Clip gradients
    clipGradientNorm(gradients.kernelWeights, config.maxGradientNorm);

    // Update learning rate
    const lr = lrScheduler(gradStep);

    // Create parameter groups for optimizer
    const paramGroups: ParameterGroup[] = [
      {
        name: 'kernelWeights',
        values: workingParams.kernelWeights,
        gradients: gradients.kernelWeights,
      },
      {
        name: 'growthCenter',
        values: new Float32Array([workingParams.growthCenter]),
        gradients: new Float32Array([gradients.growthCenter]),
      },
      {
        name: 'growthWidth',
        values: new Float32Array([workingParams.growthWidth]),
        gradients: new Float32Array([gradients.growthWidth]),
      },
    ];

    // Optimizer step
    adamStep(paramGroups, state.optimizerState, { learningRate: lr });

    // Update scalar parameters
    workingParams.growthCenter = paramGroups[1].values[0];
    workingParams.growthWidth = Math.max(0.001, paramGroups[2].values[0]); // Ensure positive
  }

  const success = finalLoss < config.successThreshold;

  return {
    finalLoss,
    success,
    updatedParams: workingParams,
  };
}

/**
 * Update trainer state after episode
 */
export function updateTrainerState(
  state: TrainerState,
  episode: {
    params: CAParameters;
    startState: Float32Array;
    targetDistance: number;
    finalLoss: number;
    success: boolean;
  }
): void {
  // Add to history
  state.history.push({
    params: cloneParams(episode.params),
    startState: new Float32Array(episode.startState),
    targetDistance: episode.targetDistance,
    finalLoss: episode.finalLoss,
    success: episode.success,
  });

  // Trim history if needed
  if (state.history.length > state.config.maxHistorySize) {
    state.history.shift();
  }

  // Track recent successes for curriculum
  state.recentSuccesses.push(episode.success);
  if (state.recentSuccesses.length > 20) {
    state.recentSuccesses.shift();
  }

  // Update difficulty based on success rate
  if (state.recentSuccesses.length >= 10) {
    const successRate = state.recentSuccesses.filter(s => s).length / state.recentSuccesses.length;

    if (successRate >= state.config.successRateTarget) {
      state.currentDifficulty = Math.min(
        state.config.maxDifficulty,
        state.currentDifficulty + state.config.difficultyIncrement
      );
      state.recentSuccesses = []; // Reset after difficulty change
    }
  }

  state.totalEpisodes++;
}

/**
 * Get training statistics
 */
export function getTrainingStats(state: TrainerState): {
  totalEpisodes: number;
  currentDifficulty: number;
  recentSuccessRate: number;
  avgRecentLoss: number;
} {
  const recentHistory = state.history.slice(-20);
  const avgRecentLoss = recentHistory.length > 0
    ? recentHistory.reduce((sum, h) => sum + h.finalLoss, 0) / recentHistory.length
    : 0;

  const recentSuccessRate = state.recentSuccesses.length > 0
    ? state.recentSuccesses.filter(s => s).length / state.recentSuccesses.length
    : 0;

  return {
    totalEpisodes: state.totalEpisodes,
    currentDifficulty: state.currentDifficulty,
    recentSuccessRate,
    avgRecentLoss,
  };
}
