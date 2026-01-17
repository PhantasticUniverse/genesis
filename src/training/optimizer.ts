/**
 * Adam Optimizer
 * Adaptive learning rate optimization for neural CA training
 */

export interface AdamConfig {
  learningRate: number;
  beta1: number; // Momentum decay
  beta2: number; // RMSprop decay
  epsilon: number; // Numerical stability
  weightDecay: number; // L2 regularization
}

const DEFAULT_CONFIG: AdamConfig = {
  learningRate: 0.001,
  beta1: 0.9,
  beta2: 0.999,
  epsilon: 1e-8,
  weightDecay: 0,
};

export interface AdamState {
  m: Map<string, Float32Array>; // First moment (momentum)
  v: Map<string, Float32Array>; // Second moment (velocity)
  t: number; // Time step
}

export interface ParameterGroup {
  name: string;
  values: Float32Array;
  gradients: Float32Array;
}

/**
 * Create Adam optimizer state
 */
export function createAdamState(): AdamState {
  return {
    m: new Map(),
    v: new Map(),
    t: 0,
  };
}

/**
 * Initialize optimizer state for a parameter
 */
function ensureState(state: AdamState, name: string, size: number): void {
  if (!state.m.has(name)) {
    state.m.set(name, new Float32Array(size));
    state.v.set(name, new Float32Array(size));
  }
}

/**
 * Adam optimizer step
 * Updates parameters in-place
 */
export function adamStep(
  params: ParameterGroup[],
  state: AdamState,
  config: Partial<AdamConfig> = {},
): void {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  state.t++;

  const biasCorrection1 = 1 - Math.pow(cfg.beta1, state.t);
  const biasCorrection2 = 1 - Math.pow(cfg.beta2, state.t);

  for (const param of params) {
    ensureState(state, param.name, param.values.length);

    const m = state.m.get(param.name)!;
    const v = state.v.get(param.name)!;

    for (let i = 0; i < param.values.length; i++) {
      const g = param.gradients[i];

      // Update biased first moment estimate
      m[i] = cfg.beta1 * m[i] + (1 - cfg.beta1) * g;

      // Update biased second moment estimate
      v[i] = cfg.beta2 * v[i] + (1 - cfg.beta2) * g * g;

      // Compute bias-corrected estimates
      const mHat = m[i] / biasCorrection1;
      const vHat = v[i] / biasCorrection2;

      // Update parameters
      const update =
        (cfg.learningRate * mHat) / (Math.sqrt(vHat) + cfg.epsilon);
      param.values[i] -= update;

      // Weight decay (L2 regularization)
      if (cfg.weightDecay > 0) {
        param.values[i] -= cfg.learningRate * cfg.weightDecay * param.values[i];
      }
    }
  }
}

/**
 * SGD with momentum (simpler alternative to Adam)
 */
export function sgdStep(
  params: ParameterGroup[],
  velocity: Map<string, Float32Array>,
  learningRate: number,
  momentum: number = 0.9,
): void {
  for (const param of params) {
    if (!velocity.has(param.name)) {
      velocity.set(param.name, new Float32Array(param.values.length));
    }

    const v = velocity.get(param.name)!;

    for (let i = 0; i < param.values.length; i++) {
      // Update velocity
      v[i] = momentum * v[i] - learningRate * param.gradients[i];

      // Update parameters
      param.values[i] += v[i];
    }
  }
}

/**
 * Gradient clipping by norm
 * Prevents exploding gradients
 */
export function clipGradientNorm(
  gradients: Float32Array,
  maxNorm: number,
): void {
  let norm = 0;
  for (let i = 0; i < gradients.length; i++) {
    norm += gradients[i] * gradients[i];
  }
  norm = Math.sqrt(norm);

  if (norm > maxNorm) {
    const scale = maxNorm / norm;
    for (let i = 0; i < gradients.length; i++) {
      gradients[i] *= scale;
    }
  }
}

/**
 * Learning rate schedulers
 */
export type LRScheduler = (step: number) => number;

export function constantLR(baseLR: number): LRScheduler {
  return () => baseLR;
}

export function stepLR(
  baseLR: number,
  stepSize: number,
  gamma: number = 0.1,
): LRScheduler {
  return (step: number) =>
    baseLR * Math.pow(gamma, Math.floor(step / stepSize));
}

export function exponentialLR(
  baseLR: number,
  gamma: number = 0.99,
): LRScheduler {
  return (step: number) => baseLR * Math.pow(gamma, step);
}

export function cosineLR(
  baseLR: number,
  totalSteps: number,
  minLR: number = 0,
): LRScheduler {
  return (step: number) => {
    const progress = Math.min(step / totalSteps, 1);
    return minLR + 0.5 * (baseLR - minLR) * (1 + Math.cos(Math.PI * progress));
  };
}

export function warmupLR(
  baseLR: number,
  warmupSteps: number,
  scheduler: LRScheduler,
): LRScheduler {
  return (step: number) => {
    if (step < warmupSteps) {
      return (baseLR * (step + 1)) / warmupSteps;
    }
    return scheduler(step - warmupSteps);
  };
}
