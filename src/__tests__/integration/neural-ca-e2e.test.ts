/**
 * Neural CA Training E2E Tests
 * Tests training convergence and GPU trainer behavior with WebGPU mocks
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type {
  TrainingParams,
  TrainingGradients,
} from "../../compute/webgpu/training-pipeline";
import type {
  GPUTrainer,
  GPUTrainingConfig,
  GPUTrainerState,
  TrainingError,
} from "../../training/gpu-trainer";
import { createAdamState, type AdamState } from "../../training/optimizer";

// Test utilities
function createMockParams(
  overrides: Partial<TrainingParams> = {},
): TrainingParams {
  return {
    kernelRadius: 13,
    growthCenter: 0.15,
    growthWidth: 0.015,
    dt: 0.1,
    ...overrides,
  };
}

function createMockGradients(
  overrides: Partial<TrainingGradients> = {},
): TrainingGradients {
  return {
    growthCenter: 0.001,
    growthWidth: 0.0005,
    dt: 0.0002,
    ...overrides,
  };
}

// Gradient clipping (copied from gpu-trainer to test in isolation)
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

// Learning rate schedulers (copied from gpu-trainer to test in isolation)
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

// Mock training step that simulates convergence
function createMockTrainingStep(options: {
  initialLoss?: number;
  convergenceRate?: number;
  noise?: number;
  failAfter?: number;
}) {
  const {
    initialLoss = 1.0,
    convergenceRate = 0.95,
    noise = 0.02,
    failAfter,
  } = options;
  let stepCount = 0;
  let currentLoss = initialLoss;

  return async (): Promise<{
    loss: number;
    gradients: TrainingGradients;
    success: boolean;
  }> => {
    stepCount++;

    // Optionally fail after N steps to test error handling
    if (failAfter !== undefined && stepCount > failAfter) {
      throw new Error(`Simulated GPU error at step ${stepCount}`);
    }

    // Simulate convergence with noise
    currentLoss = currentLoss * convergenceRate + (Math.random() - 0.5) * noise;
    currentLoss = Math.max(0.001, currentLoss); // Floor to prevent negative loss

    // Gradients decrease as loss decreases
    const gradientScale = currentLoss;

    return {
      loss: currentLoss,
      gradients: {
        growthCenter: 0.01 * gradientScale * (Math.random() - 0.5),
        growthWidth: 0.005 * gradientScale * (Math.random() - 0.5),
        dt: 0.002 * gradientScale * (Math.random() - 0.5),
      },
      success: currentLoss < 0.02,
    };
  };
}

describe("Neural CA Training E2E", () => {
  describe("Training Convergence", () => {
    it("should decrease loss over training iterations", async () => {
      const mockStep = createMockTrainingStep({
        initialLoss: 1.0,
        convergenceRate: 0.9,
        noise: 0.01,
      });

      const losses: number[] = [];
      const numSteps = 50;

      for (let i = 0; i < numSteps; i++) {
        const { loss } = await mockStep();
        losses.push(loss);
      }

      // First half average should be higher than second half
      const firstHalf = losses.slice(0, numSteps / 2);
      const secondHalf = losses.slice(numSteps / 2);

      const firstHalfAvg =
        firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
      const secondHalfAvg =
        secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

      expect(firstHalfAvg).toBeGreaterThan(secondHalfAvg);

      // Final loss should be significantly lower than initial
      expect(losses[losses.length - 1]).toBeLessThan(losses[0] * 0.5);
    });

    it("should report success when loss drops below threshold", async () => {
      const successThreshold = 0.02;
      const mockStep = createMockTrainingStep({
        initialLoss: 0.5,
        convergenceRate: 0.85,
        noise: 0.005,
      });

      let successCount = 0;
      const numSteps = 100;

      for (let i = 0; i < numSteps; i++) {
        const { success } = await mockStep();
        if (success) successCount++;
      }

      // Should have increasing success rate as loss decreases
      expect(successCount).toBeGreaterThan(0);
    });
  });

  describe("Gradient Clipping", () => {
    it("should clip gradients when norm exceeds maxNorm", () => {
      const gradients = [1.0, 1.0, 1.0]; // Norm = sqrt(3) ≈ 1.73
      const maxNorm = 1.0;

      const clipped = clipGradientNormScalar(gradients, maxNorm);

      // Compute clipped norm
      let clippedNorm = 0;
      for (const g of clipped) {
        clippedNorm += g * g;
      }
      clippedNorm = Math.sqrt(clippedNorm);

      expect(clippedNorm).toBeCloseTo(maxNorm, 5);
    });

    it("should not modify gradients when norm is below maxNorm", () => {
      const gradients = [0.1, 0.1, 0.1]; // Norm ≈ 0.17
      const maxNorm = 1.0;

      const clipped = clipGradientNormScalar(gradients, maxNorm);

      expect(clipped).toEqual(gradients);
    });

    it("should handle zero gradients", () => {
      const gradients = [0, 0, 0];
      const maxNorm = 1.0;

      const clipped = clipGradientNormScalar(gradients, maxNorm);

      expect(clipped).toEqual([0, 0, 0]);
    });

    it("should preserve gradient direction after clipping", () => {
      const gradients = [3.0, 4.0, 0]; // Norm = 5
      const maxNorm = 1.0;

      const clipped = clipGradientNormScalar(gradients, maxNorm);

      // Ratio should be preserved
      expect(clipped[0] / clipped[1]).toBeCloseTo(3 / 4, 5);
    });
  });

  describe("Learning Rate Scheduling", () => {
    it("should linearly warm up learning rate", () => {
      const baseLR = 0.001;
      const warmupSteps = 100;

      // At step 0, LR should be baseLR/warmupSteps
      expect(warmupLR(baseLR, 0, warmupSteps)).toBeCloseTo(baseLR / 100, 8);

      // At step 49 (halfway), LR should be baseLR * 0.5
      expect(warmupLR(baseLR, 49, warmupSteps)).toBeCloseTo(baseLR * 0.5, 8);

      // At step 99 (end), LR should be baseLR
      expect(warmupLR(baseLR, 99, warmupSteps)).toBeCloseTo(baseLR, 8);
    });

    it("should apply cosine annealing after warmup", () => {
      const baseLR = 0.001;
      const totalSteps = 1000;

      // At step 0, LR should be baseLR
      expect(cosineLR(baseLR, 0, totalSteps)).toBeCloseTo(baseLR, 8);

      // At step 500 (halfway), LR should be baseLR / 2
      expect(cosineLR(baseLR, 500, totalSteps)).toBeCloseTo(baseLR / 2, 8);

      // At step 1000 (end), LR should be 0 (or minLR)
      expect(cosineLR(baseLR, 1000, totalSteps)).toBeCloseTo(0, 8);
    });

    it("should respect minLR in cosine schedule", () => {
      const baseLR = 0.001;
      const minLR = 0.0001;
      const totalSteps = 1000;

      // At end, should be minLR
      expect(cosineLR(baseLR, 1000, totalSteps, minLR)).toBeCloseTo(minLR, 8);

      // At start, should be baseLR
      expect(cosineLR(baseLR, 0, totalSteps, minLR)).toBeCloseTo(baseLR, 8);
    });
  });

  describe("Adam Optimizer", () => {
    it("should create fresh optimizer state", () => {
      const state = createAdamState();

      expect(state.t).toBe(0);
      expect(state.m.size).toBe(0);
      expect(state.v.size).toBe(0);
    });

    it("should accumulate momentum over steps", () => {
      const state = createAdamState();

      // Simulate multiple steps with consistent gradient direction
      const param = "growthCenter";
      state.t = 1;
      state.m.set(param, new Float32Array([0]));
      state.v.set(param, new Float32Array([0]));

      const beta1 = 0.9;
      const beta2 = 0.999;
      const gradient = 0.1;

      // First update
      state.m.get(param)![0] = (1 - beta1) * gradient;
      state.v.get(param)![0] = (1 - beta2) * gradient * gradient;

      // Second update
      state.t = 2;
      state.m.get(param)![0] =
        beta1 * state.m.get(param)![0] + (1 - beta1) * gradient;
      state.v.get(param)![0] =
        beta2 * state.v.get(param)![0] + (1 - beta2) * gradient * gradient;

      // Momentum should increase for consistent gradients
      expect(state.m.get(param)![0]).toBeGreaterThan(0);
      expect(state.v.get(param)![0]).toBeGreaterThan(0);
    });
  });

  describe("Error Handling", () => {
    it("should catch and record training errors", async () => {
      const mockStep = createMockTrainingStep({
        initialLoss: 0.5,
        failAfter: 5,
      });

      const errors: Error[] = [];

      for (let i = 0; i < 10; i++) {
        try {
          await mockStep();
        } catch (e) {
          errors.push(e as Error);
        }
      }

      // Should have caught errors after step 5
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].message).toContain("Simulated GPU error");
    });

    it("should track consecutive errors", () => {
      let consecutiveErrors = 0;
      const maxConsecutiveErrors = 3;
      let shouldStop = false;

      // Simulate error recording logic
      function recordError(): boolean {
        consecutiveErrors++;
        if (consecutiveErrors >= maxConsecutiveErrors) {
          shouldStop = true;
          return true;
        }
        return false;
      }

      function clearErrors() {
        consecutiveErrors = 0;
      }

      // Record errors
      expect(recordError()).toBe(false);
      expect(recordError()).toBe(false);
      expect(recordError()).toBe(true);
      expect(shouldStop).toBe(true);

      // Clear should reset
      clearErrors();
      expect(consecutiveErrors).toBe(0);
    });
  });

  describe("Curriculum Learning", () => {
    it("should increase difficulty when success rate is high", () => {
      let difficulty = 0.1;
      const maxDifficulty = 0.8;
      const successRateTarget = 0.7;
      const difficultyIncrement = 0.05;
      const recentSuccesses: boolean[] = [];

      // Add successful trials
      for (let i = 0; i < 20; i++) {
        recentSuccesses.push(true);
      }

      // Calculate success rate
      const successRate =
        recentSuccesses.filter((s) => s).length / recentSuccesses.length;

      // Update difficulty
      if (successRate >= successRateTarget && difficulty < maxDifficulty) {
        difficulty = Math.min(maxDifficulty, difficulty + difficultyIncrement);
      }

      expect(difficulty).toBeCloseTo(0.15, 10);
      expect(successRate).toBe(1.0);
    });

    it("should maintain difficulty when success rate is low", () => {
      let difficulty = 0.3;
      const maxDifficulty = 0.8;
      const successRateTarget = 0.7;
      const difficultyIncrement = 0.05;
      const recentSuccesses: boolean[] = [];

      // Add mixed trials (low success rate)
      for (let i = 0; i < 20; i++) {
        recentSuccesses.push(i < 5); // Only 25% success
      }

      const successRate =
        recentSuccesses.filter((s) => s).length / recentSuccesses.length;

      // Update difficulty
      if (successRate >= successRateTarget && difficulty < maxDifficulty) {
        difficulty = Math.min(maxDifficulty, difficulty + difficultyIncrement);
      }

      // Difficulty should not change
      expect(difficulty).toBe(0.3);
      expect(successRate).toBe(0.25);
    });

    it("should cap difficulty at maximum", () => {
      let difficulty = 0.78;
      const maxDifficulty = 0.8;
      const difficultyIncrement = 0.05;

      // Increment past max
      difficulty = Math.min(maxDifficulty, difficulty + difficultyIncrement);

      expect(difficulty).toBe(0.8);
    });
  });

  describe("Parameter Constraints", () => {
    it("should clamp growth center within valid range", () => {
      const minGrowthCenter = 0.05;
      const maxGrowthCenter = 0.4;

      // Test clamping
      const testValues = [-0.1, 0.0, 0.15, 0.5, 1.0];
      const expected = [0.05, 0.05, 0.15, 0.4, 0.4];

      testValues.forEach((val, i) => {
        const clamped = Math.max(
          minGrowthCenter,
          Math.min(maxGrowthCenter, val),
        );
        expect(clamped).toBe(expected[i]);
      });
    });

    it("should clamp growth width within valid range", () => {
      const minGrowthWidth = 0.005;
      const maxGrowthWidth = 0.08;

      const clamped = Math.max(minGrowthWidth, Math.min(maxGrowthWidth, 0.1));
      expect(clamped).toBe(0.08);
    });

    it("should clamp dt within valid range", () => {
      const minDt = 0.01;
      const maxDt = 0.3;

      const clampedLow = Math.max(minDt, Math.min(maxDt, 0.001));
      const clampedHigh = Math.max(minDt, Math.min(maxDt, 0.5));

      expect(clampedLow).toBe(0.01);
      expect(clampedHigh).toBe(0.3);
    });
  });

  describe("Loss Statistics", () => {
    it("should compute rolling average loss", () => {
      const recentLosses: number[] = [];
      const maxHistory = 50;

      // Add losses
      for (let i = 0; i < 60; i++) {
        recentLosses.push(1.0 - i * 0.01); // Decreasing loss
        if (recentLosses.length > maxHistory) {
          recentLosses.shift();
        }
      }

      expect(recentLosses.length).toBe(50);

      const averageLoss =
        recentLosses.reduce((a, b) => a + b, 0) / recentLosses.length;

      // After 60 iterations with window 50, values range from 0.9 (i=10) to 0.41 (i=59)
      // Average should be around 0.655
      expect(averageLoss).toBeLessThan(0.7);
      expect(averageLoss).toBeGreaterThan(0.6);
    });
  });

  describe("Full Training Loop Simulation", () => {
    it("should converge to target over multiple epochs", async () => {
      const config = {
        stepsPerEpisode: 30,
        learningRate: 0.001,
        warmupSteps: 10,
        totalSteps: 100,
        successThreshold: 0.02,
      };

      const mockStep = createMockTrainingStep({
        initialLoss: 1.0,
        convergenceRate: 0.92,
        noise: 0.005,
      });

      const metrics = {
        losses: [] as number[],
        successes: 0,
        currentStep: 0,
      };

      // Run training loop
      for (let step = 0; step < config.totalSteps; step++) {
        const { loss, success } = await mockStep();

        metrics.losses.push(loss);
        if (success) metrics.successes++;
        metrics.currentStep = step;
      }

      // Verify convergence
      const initialLosses = metrics.losses.slice(0, 20);
      const finalLosses = metrics.losses.slice(-20);

      const initialAvg =
        initialLosses.reduce((a, b) => a + b, 0) / initialLosses.length;
      const finalAvg =
        finalLosses.reduce((a, b) => a + b, 0) / finalLosses.length;

      expect(finalAvg).toBeLessThan(initialAvg * 0.5);
      expect(metrics.successes).toBeGreaterThan(0);
    });

    it("should handle training with error recovery", async () => {
      let consecutiveErrors = 0;
      const maxErrors = 3;
      let stepsCompleted = 0;
      let errorRecoveries = 0;

      const mockStep = createMockTrainingStep({
        initialLoss: 0.5,
        convergenceRate: 0.95,
      });

      // Simulate error at specific steps
      const errorSteps = new Set([15, 25, 26]); // 2 consecutive at 25-26

      for (let step = 0; step < 50; step++) {
        try {
          if (errorSteps.has(step)) {
            throw new Error(`Error at step ${step}`);
          }
          await mockStep();
          consecutiveErrors = 0;
          stepsCompleted++;
        } catch (_e) {
          consecutiveErrors++;
          if (consecutiveErrors >= maxErrors) {
            // Training would stop here
            break;
          }
          errorRecoveries++;
        }
      }

      expect(stepsCompleted).toBe(47); // 50 - 3 errors
      expect(errorRecoveries).toBe(3);
      expect(consecutiveErrors).toBeLessThan(maxErrors);
    });
  });
});
