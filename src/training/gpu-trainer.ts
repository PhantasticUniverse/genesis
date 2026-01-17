/**
 * GPU-Accelerated Neural CA Trainer
 * Uses WebGPU compute shaders for fast gradient computation
 */

import {
  createGPUTrainingPipeline,
  type GPUTrainingPipeline,
  type TrainingParams,
  type TrainingGradients,
} from "../compute/webgpu/training-pipeline";
import { type AdamState, createAdamState } from "./optimizer";

// Simple scalar gradient clipping
function clipGradientNormScalar(
  gradients: number[],
  maxNorm: number,
): number[] {
  let norm = 0;
  for (const g of gradients) {
    norm += g * g;
  }
  norm = Math.sqrt(norm);

  if (norm > maxNorm) {
    const scale = maxNorm / norm;
    return gradients.map((g) => g * scale);
  }
  return gradients;
}

// Simple scalar Adam step
function adamStepScalar(
  state: AdamState,
  params: Array<{ value: number; gradient: number; name: string }>,
  lr: number,
  beta1 = 0.9,
  beta2 = 0.999,
  epsilon = 1e-8,
): Record<string, number> {
  state.t++;

  const biasCorrection1 = 1 - Math.pow(beta1, state.t);
  const biasCorrection2 = 1 - Math.pow(beta2, state.t);

  const result: Record<string, number> = {};

  for (const param of params) {
    // Ensure state exists for this parameter
    if (!state.m.has(param.name)) {
      state.m.set(param.name, new Float32Array(1));
      state.v.set(param.name, new Float32Array(1));
    }

    const m = state.m.get(param.name)!;
    const v = state.v.get(param.name)!;

    // Update biased first moment estimate
    m[0] = beta1 * m[0] + (1 - beta1) * param.gradient;

    // Update biased second moment estimate
    v[0] = beta2 * v[0] + (1 - beta2) * param.gradient * param.gradient;

    // Compute bias-corrected estimates
    const mHat = m[0] / biasCorrection1;
    const vHat = v[0] / biasCorrection2;

    // Compute update
    const update = (lr * mHat) / (Math.sqrt(vHat) + epsilon);

    // Return updated value
    result[param.name] = param.value - update;
  }

  return result;
}

// Simple learning rate schedulers
function warmupLR(baseLR: number, step: number, warmupSteps: number): number {
  return (baseLR * (step + 1)) / warmupSteps;
}

function cosineLR(
  baseLR: number,
  step: number,
  totalSteps: number,
  minLR = 0,
): number {
  const progress = Math.min(step / totalSteps, 1);
  return minLR + 0.5 * (baseLR - minLR) * (1 + Math.cos(Math.PI * progress));
}

export interface GPUTrainingConfig {
  // Grid size
  width: number;
  height: number;

  // Training parameters
  stepsPerEpisode: number;
  learningRate: number;
  warmupSteps: number;
  totalSteps: number;
  maxGradientNorm: number;

  // Curriculum
  initialDifficulty: number;
  maxDifficulty: number;
  successThreshold: number;
  successRateTarget: number;
  difficultyIncrement: number;
}

const DEFAULT_CONFIG: GPUTrainingConfig = {
  width: 128,
  height: 128,
  stepsPerEpisode: 30,
  learningRate: 0.001,
  warmupSteps: 100,
  totalSteps: 10000,
  maxGradientNorm: 1.0,
  initialDifficulty: 0.1,
  maxDifficulty: 0.8,
  successThreshold: 0.02,
  successRateTarget: 0.7,
  difficultyIncrement: 0.05,
};

export interface TrainingError {
  step: number;
  message: string;
  timestamp: number;
}

export interface GPUTrainerState {
  config: GPUTrainingConfig;
  params: TrainingParams;
  currentStep: number;
  currentDifficulty: number;
  recentLosses: number[];
  recentSuccesses: boolean[];
  averageLoss: number;
  successRate: number;
  isTraining: boolean;
  // Error tracking
  consecutiveErrors: number;
  errorHistory: TrainingError[];
  lastError: TrainingError | null;
}

export interface GPUTrainer {
  // Get current state
  getState(): GPUTrainerState;

  // Run one training step
  step(): Promise<{
    loss: number;
    gradients: TrainingGradients;
    success: boolean;
  }>;

  // Start/stop training loop
  startTraining(): void;
  stopTraining(): void;

  // Set callback for training updates
  onUpdate(callback: (state: GPUTrainerState) => void): void;

  // Set callback for training errors
  onError(
    callback: (error: TrainingError, state: GPUTrainerState) => void,
  ): void;

  // Clear error state (allows resuming after fixing issues)
  clearErrors(): void;

  // Cleanup
  destroy(): void;
}

/**
 * Create GPU-accelerated trainer
 */
export async function createGPUTrainer(
  device: GPUDevice,
  config: Partial<GPUTrainingConfig> = {},
): Promise<GPUTrainer> {
  const cfg: GPUTrainingConfig = { ...DEFAULT_CONFIG, ...config };

  // Create GPU training pipeline
  const pipeline = createGPUTrainingPipeline(device, cfg.width, cfg.height, {
    kernelRadius: 13,
    growthCenter: 0.15,
    growthWidth: 0.015,
    dt: 0.1,
  });

  // Create initial state texture
  const initialStateTexture = device.createTexture({
    label: "initial-state",
    size: [cfg.width, cfg.height],
    format: "r32float",
    usage:
      GPUTextureUsage.TEXTURE_BINDING |
      GPUTextureUsage.COPY_DST |
      GPUTextureUsage.COPY_SRC,
  });

  // Create target state texture
  const targetStateTexture = device.createTexture({
    label: "target-state",
    size: [cfg.width, cfg.height],
    format: "r32float",
    usage:
      GPUTextureUsage.TEXTURE_BINDING |
      GPUTextureUsage.COPY_DST |
      GPUTextureUsage.COPY_SRC |
      GPUTextureUsage.STORAGE_BINDING,
  });

  // Initialize with a blob in the center
  const initialData = new Float32Array(cfg.width * cfg.height);
  const centerX = cfg.width / 2;
  const centerY = cfg.height / 2;
  const radius = 20;
  for (let y = 0; y < cfg.height; y++) {
    for (let x = 0; x < cfg.width; x++) {
      const dx = x - centerX;
      const dy = y - centerY;
      const r = Math.sqrt(dx * dx + dy * dy);
      if (r < radius) {
        initialData[y * cfg.width + x] = Math.exp(
          -(r * r) / (radius * radius * 0.5),
        );
      }
    }
  }
  device.queue.writeTexture(
    { texture: initialStateTexture },
    initialData,
    { bytesPerRow: cfg.width * 4 },
    { width: cfg.width, height: cfg.height },
  );

  // Maximum consecutive errors before stopping
  const MAX_CONSECUTIVE_ERRORS = 3;

  // Training state
  let state: GPUTrainerState = {
    config: cfg,
    params: pipeline.getParams(),
    currentStep: 0,
    currentDifficulty: cfg.initialDifficulty,
    recentLosses: [],
    recentSuccesses: [],
    averageLoss: 0,
    successRate: 0,
    isTraining: false,
    consecutiveErrors: 0,
    errorHistory: [],
    lastError: null,
  };

  // Optimizer state
  const optimizerState = createAdamState();

  // Update callback
  let updateCallback: ((state: GPUTrainerState) => void) | null = null;

  // Error callback
  let errorCallback:
    | ((error: TrainingError, state: GPUTrainerState) => void)
    | null = null;

  // Training loop handle
  let trainingFrameId: number | null = null;

  /**
   * Sample a target based on current difficulty
   */
  function sampleTarget(): { x: number; y: number } {
    const maxDist =
      state.currentDifficulty * Math.min(cfg.width, cfg.height) * 0.4;
    const angle = Math.random() * 2 * Math.PI;
    const dist = maxDist * (0.5 + 0.5 * Math.random());

    return {
      x: centerX + dist * Math.cos(angle),
      y: centerY + dist * Math.sin(angle),
    };
  }

  /**
   * Create target state (shifted initial state)
   */
  function createTarget(targetX: number, targetY: number): Float32Array {
    const target = new Float32Array(cfg.width * cfg.height);
    const shiftX = Math.round(targetX - centerX);
    const shiftY = Math.round(targetY - centerY);

    for (let y = 0; y < cfg.height; y++) {
      for (let x = 0; x < cfg.width; x++) {
        const srcX = (((x - shiftX) % cfg.width) + cfg.width) % cfg.width;
        const srcY = (((y - shiftY) % cfg.height) + cfg.height) % cfg.height;
        target[y * cfg.width + x] = initialData[srcY * cfg.width + srcX];
      }
    }

    return target;
  }

  /**
   * Update curriculum difficulty
   */
  function updateCurriculum(success: boolean) {
    state.recentSuccesses.push(success);
    if (state.recentSuccesses.length > 20) {
      state.recentSuccesses.shift();
    }

    state.successRate =
      state.recentSuccesses.filter((s) => s).length /
      state.recentSuccesses.length;

    if (
      state.successRate >= cfg.successRateTarget &&
      state.currentDifficulty < cfg.maxDifficulty
    ) {
      state.currentDifficulty = Math.min(
        cfg.maxDifficulty,
        state.currentDifficulty + cfg.difficultyIncrement,
      );
    }
  }

  /**
   * Run one training step
   */
  async function runStep(): Promise<{
    loss: number;
    gradients: TrainingGradients;
    success: boolean;
  }> {
    // Sample target
    const target = sampleTarget();
    const targetData = createTarget(target.x, target.y);

    // Write target to texture
    device.queue.writeTexture(
      { texture: targetStateTexture },
      targetData,
      { bytesPerRow: cfg.width * 4 },
      { width: cfg.width, height: cfg.height },
    );

    // Forward pass
    const { finalState, cache } = await pipeline.forward(
      initialStateTexture,
      cfg.stepsPerEpisode,
    );

    // Compute loss
    const loss = await pipeline.computeLoss(finalState, targetStateTexture);

    // Backward pass
    const gradients = await pipeline.backward(targetStateTexture, cache);

    // Clip gradients
    const gradArray = [
      gradients.growthCenter,
      gradients.growthWidth,
      gradients.dt,
    ];
    const clippedGradArray = clipGradientNormScalar(
      gradArray,
      cfg.maxGradientNorm,
    );

    // Compute learning rate with warmup and cosine decay
    let lr = cfg.learningRate;
    if (state.currentStep < cfg.warmupSteps) {
      lr = warmupLR(cfg.learningRate, state.currentStep, cfg.warmupSteps);
    } else {
      lr = cosineLR(
        cfg.learningRate,
        state.currentStep - cfg.warmupSteps,
        cfg.totalSteps - cfg.warmupSteps,
      );
    }

    // Update parameters with Adam
    const currentParams = pipeline.getParams();
    const paramGroups: Array<{
      value: number;
      gradient: number;
      name: string;
    }> = [
      {
        value: currentParams.growthCenter,
        gradient: clippedGradArray[0],
        name: "growthCenter",
      },
      {
        value: currentParams.growthWidth,
        gradient: clippedGradArray[1],
        name: "growthWidth",
      },
      { value: currentParams.dt, gradient: clippedGradArray[2], name: "dt" },
    ];

    const updatedValues = adamStepScalar(optimizerState, paramGroups, lr);

    // Apply updates with constraints
    pipeline.setParams({
      growthCenter: Math.max(0.05, Math.min(0.4, updatedValues.growthCenter)),
      growthWidth: Math.max(0.005, Math.min(0.08, updatedValues.growthWidth)),
      dt: Math.max(0.01, Math.min(0.3, updatedValues.dt)),
    });

    // Update state
    state.currentStep++;
    state.params = pipeline.getParams();
    state.recentLosses.push(loss);
    if (state.recentLosses.length > 50) {
      state.recentLosses.shift();
    }
    state.averageLoss =
      state.recentLosses.reduce((a, b) => a + b, 0) / state.recentLosses.length;

    const success = loss < cfg.successThreshold;
    updateCurriculum(success);

    return { loss, gradients, success };
  }

  /**
   * Record an error and check if training should stop
   */
  function recordError(error: unknown): boolean {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const trainingError: TrainingError = {
      step: state.currentStep,
      message: errorMessage,
      timestamp: Date.now(),
    };

    state.consecutiveErrors++;
    state.lastError = trainingError;
    state.errorHistory.push(trainingError);

    // Keep error history bounded
    if (state.errorHistory.length > 100) {
      state.errorHistory.shift();
    }

    // Notify error callback
    errorCallback?.(trainingError, state);

    // Stop training after too many consecutive errors
    if (state.consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
      console.error(
        `Training stopped after ${MAX_CONSECUTIVE_ERRORS} consecutive errors`,
      );
      state.isTraining = false;
      return true; // Should stop
    }

    return false; // Can continue
  }

  /**
   * Training loop
   */
  async function trainingLoop() {
    if (!state.isTraining) return;

    try {
      await runStep();
      // Reset consecutive errors on success
      state.consecutiveErrors = 0;
      updateCallback?.(state);
    } catch (e) {
      console.error("Training step failed:", e);
      const shouldStop = recordError(e);
      if (shouldStop) {
        updateCallback?.(state);
        return; // Stop the loop
      }
    }

    if (state.isTraining) {
      trainingFrameId = requestAnimationFrame(trainingLoop);
    }
  }

  return {
    getState() {
      return { ...state };
    },

    async step() {
      return runStep();
    },

    startTraining() {
      if (!state.isTraining) {
        state.isTraining = true;
        trainingLoop();
      }
    },

    stopTraining() {
      state.isTraining = false;
      if (trainingFrameId !== null) {
        cancelAnimationFrame(trainingFrameId);
        trainingFrameId = null;
      }
    },

    onUpdate(callback: (state: GPUTrainerState) => void) {
      updateCallback = callback;
    },

    onError(callback: (error: TrainingError, state: GPUTrainerState) => void) {
      errorCallback = callback;
    },

    clearErrors() {
      state.consecutiveErrors = 0;
      state.lastError = null;
      // Don't clear errorHistory - keep it for debugging
    },

    destroy() {
      this.stopTraining();
      pipeline.destroy();
      initialStateTexture.destroy();
      targetStateTexture.destroy();
    },
  };
}
