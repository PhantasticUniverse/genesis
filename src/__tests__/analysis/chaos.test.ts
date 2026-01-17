/**
 * Tests for Chaos Analysis (Lyapunov Exponent)
 */

import { describe, it, expect } from "vitest";
import {
  stateDistance,
  stateDistanceL1,
  createPerturbedState,
  renormalizePerturbation,
  calculateLyapunovExponent,
  classifyDynamics,
  calculateLocalLyapunov,
  wolfLyapunovEstimate,
  quickStabilityCheck,
  DEFAULT_LYAPUNOV_CONFIG,
  type EvolutionStep,
} from "../../analysis/chaos";

describe("Chaos Analysis", () => {
  describe("stateDistance", () => {
    it("returns 0 for identical states", () => {
      const state = new Float32Array([0.1, 0.2, 0.3, 0.4]);
      expect(stateDistance(state, state)).toBe(0);
    });

    it("calculates L2 distance correctly", () => {
      const state1 = new Float32Array([0, 0, 0, 0]);
      const state2 = new Float32Array([3, 4, 0, 0]); // 3-4-5 triangle
      expect(stateDistance(state1, state2)).toBe(5);
    });

    it("is symmetric", () => {
      const state1 = new Float32Array([0.1, 0.2, 0.3]);
      const state2 = new Float32Array([0.4, 0.5, 0.6]);
      expect(stateDistance(state1, state2)).toBe(stateDistance(state2, state1));
    });

    it("throws for mismatched lengths", () => {
      const state1 = new Float32Array([1, 2, 3]);
      const state2 = new Float32Array([1, 2]);
      expect(() => stateDistance(state1, state2)).toThrow("same length");
    });
  });

  describe("stateDistanceL1", () => {
    it("returns 0 for identical states", () => {
      const state = new Float32Array([0.1, 0.2, 0.3]);
      expect(stateDistanceL1(state, state)).toBe(0);
    });

    it("calculates L1 distance correctly", () => {
      const state1 = new Float32Array([0, 0, 0]);
      const state2 = new Float32Array([1, 2, 3]);
      expect(stateDistanceL1(state1, state2)).toBe(6);
    });

    it("throws for mismatched lengths", () => {
      const state1 = new Float32Array([1, 2]);
      const state2 = new Float32Array([1, 2, 3]);
      expect(() => stateDistanceL1(state1, state2)).toThrow("same length");
    });
  });

  describe("createPerturbedState", () => {
    it("creates a state different from original", () => {
      const state = new Float32Array([0.5, 0.5, 0.5, 0.5]);
      const perturbed = createPerturbedState(state);
      expect(stateDistance(state, perturbed)).toBeGreaterThan(0);
    });

    it("creates small perturbation by default", () => {
      const state = new Float32Array([0.5, 0.5, 0.5, 0.5]);
      const perturbed = createPerturbedState(state);
      expect(stateDistance(state, perturbed)).toBeLessThan(0.01);
    });

    it("respects perturbation magnitude", () => {
      const state = new Float32Array([0.5, 0.5, 0.5, 0.5]);
      const perturbed = createPerturbedState(state, {
        ...DEFAULT_LYAPUNOV_CONFIG,
        perturbationMagnitude: 0.1,
        perturbationCount: 1,
      });
      // Perturbation should be approximately 0.1
      const dist = stateDistance(state, perturbed);
      expect(dist).toBeGreaterThan(0.05);
      expect(dist).toBeLessThan(0.15);
    });

    it("keeps values in [0, 1] range", () => {
      const state = new Float32Array([0.99, 0.99, 0.01, 0.01]);
      const perturbed = createPerturbedState(state, {
        ...DEFAULT_LYAPUNOV_CONFIG,
        perturbationMagnitude: 0.1,
        perturbationCount: 4,
      });
      for (let i = 0; i < perturbed.length; i++) {
        expect(perturbed[i]).toBeGreaterThanOrEqual(0);
        expect(perturbed[i]).toBeLessThanOrEqual(1);
      }
    });

    it("handles all-zero state", () => {
      const state = new Float32Array(100);
      const perturbed = createPerturbedState(state);
      expect(stateDistance(state, perturbed)).toBeGreaterThan(0);
    });
  });

  describe("renormalizePerturbation", () => {
    it("maintains target magnitude", () => {
      const reference = new Float32Array([0.5, 0.5, 0.5, 0.5]);
      const perturbed = new Float32Array([0.6, 0.5, 0.5, 0.5]);
      const targetMag = 0.05;

      const renormalized = renormalizePerturbation(
        reference,
        perturbed,
        targetMag,
      );
      const newDist = stateDistance(reference, renormalized);

      expect(newDist).toBeCloseTo(targetMag, 3);
    });

    it("preserves perturbation direction", () => {
      const reference = new Float32Array([0.5, 0.5, 0.5, 0.5]);
      const perturbed = new Float32Array([0.6, 0.4, 0.5, 0.5]); // +0.1, -0.1, 0, 0
      const targetMag = 0.05;

      const renormalized = renormalizePerturbation(
        reference,
        perturbed,
        targetMag,
      );

      // Direction should be preserved (first > reference, second < reference)
      expect(renormalized[0]).toBeGreaterThan(reference[0]);
      expect(renormalized[1]).toBeLessThan(reference[1]);
    });

    it("handles near-zero perturbation", () => {
      const reference = new Float32Array([0.5, 0.5, 0.5, 0.5]);
      const perturbed = new Float32Array([0.5, 0.5, 0.5, 0.5]); // Same as reference
      const targetMag = 0.01;

      const renormalized = renormalizePerturbation(
        reference,
        perturbed,
        targetMag,
      );

      // Should create fresh perturbation
      expect(stateDistance(reference, renormalized)).toBeGreaterThan(0);
    });
  });

  describe("classifyDynamics", () => {
    it("classifies negative exponent as stable", () => {
      expect(classifyDynamics(-0.5)).toBe("stable");
      expect(classifyDynamics(-0.1)).toBe("stable");
    });

    it("classifies near-zero exponent as periodic", () => {
      expect(classifyDynamics(0)).toBe("periodic");
      expect(classifyDynamics(0.005)).toBe("periodic");
      expect(classifyDynamics(-0.005)).toBe("periodic");
    });

    it("classifies positive exponent as chaotic", () => {
      expect(classifyDynamics(0.5)).toBe("chaotic");
      expect(classifyDynamics(0.1)).toBe("chaotic");
    });

    it("classifies very large exponent as hyperchaotic", () => {
      expect(classifyDynamics(1.5)).toBe("hyperchaotic");
      expect(classifyDynamics(2.0)).toBe("hyperchaotic");
    });

    it("respects custom threshold", () => {
      expect(classifyDynamics(0.05, 0.1)).toBe("periodic");
      expect(classifyDynamics(0.05, 0.01)).toBe("chaotic");
    });
  });

  describe("calculateLocalLyapunov", () => {
    it("returns empty for short history", () => {
      const history = [1, 2, 3];
      const local = calculateLocalLyapunov(history, 5);
      expect(local).toHaveLength(0);
    });

    it("calculates local exponents", () => {
      // Exponential growth: 1, e, e^2, e^3, ...
      const history = [1, Math.E, Math.E ** 2, Math.E ** 3, Math.E ** 4];
      const local = calculateLocalLyapunov(history, 2);

      // Each local exponent should be ~1 (ln(e^n / e^(n-2)) / 2 = 2/2 = 1)
      expect(local.length).toBeGreaterThan(0);
      for (const exp of local) {
        expect(exp).toBeCloseTo(1, 1);
      }
    });

    it("handles constant distance (periodic)", () => {
      const history = [0.1, 0.1, 0.1, 0.1, 0.1, 0.1];
      const local = calculateLocalLyapunov(history, 2);

      for (const exp of local) {
        expect(exp).toBeCloseTo(0, 5);
      }
    });
  });

  describe("calculateLyapunovExponent", () => {
    // Stable system: perturbations decay
    const stableStep: EvolutionStep = (state: Float32Array) => {
      const result = new Float32Array(state.length);
      for (let i = 0; i < state.length; i++) {
        result[i] = state[i] * 0.9; // Decay
      }
      return result;
    };

    // Chaotic system: perturbations grow
    const chaoticStep: EvolutionStep = (state: Float32Array) => {
      const result = new Float32Array(state.length);
      for (let i = 0; i < state.length; i++) {
        // Logistic map in chaotic regime
        result[i] = Math.max(0, Math.min(1, 3.9 * state[i] * (1 - state[i])));
      }
      return result;
    };

    // Periodic system: oscillates
    const periodicStep: EvolutionStep = (state: Float32Array) => {
      const result = new Float32Array(state.length);
      for (let i = 0; i < state.length; i++) {
        // Flip values
        result[i] = 1 - state[i];
      }
      return result;
    };

    it("detects stable system", () => {
      const state = new Float32Array([0.5, 0.5, 0.5, 0.5]);
      const result = calculateLyapunovExponent(state, stableStep, {
        steps: 50,
      });

      expect(result.exponent).toBeLessThan(0);
      expect(result.classification).toBe("stable");
    });

    it("detects chaotic system", () => {
      const state = new Float32Array([0.4, 0.5, 0.6, 0.7]);
      const result = calculateLyapunovExponent(state, chaoticStep, {
        steps: 100,
        renormalize: true,
        renormalizePeriod: 10,
      });

      // Logistic map at r=3.9 has positive Lyapunov exponent
      expect(result.exponent).toBeGreaterThan(0);
      expect(["chaotic", "hyperchaotic"]).toContain(result.classification);
    });

    it("returns divergence history", () => {
      const state = new Float32Array([0.5, 0.5, 0.5, 0.5]);
      const result = calculateLyapunovExponent(state, stableStep, {
        steps: 20,
      });

      expect(result.divergenceHistory.length).toBe(21); // Initial + 20 steps
      expect(result.divergenceHistory[0]).toBeGreaterThan(0);
    });

    it("returns confidence score", () => {
      const state = new Float32Array([0.5, 0.5, 0.5, 0.5]);
      const result = calculateLyapunovExponent(state, stableStep, {
        steps: 50,
      });

      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });

    it("records steps and initial perturbation", () => {
      const state = new Float32Array([0.5, 0.5]);
      const result = calculateLyapunovExponent(state, stableStep, {
        steps: 30,
      });

      expect(result.steps).toBe(30);
      expect(result.initialPerturbation).toBeGreaterThan(0);
    });
  });

  describe("wolfLyapunovEstimate", () => {
    const chaoticStep: EvolutionStep = (state: Float32Array) => {
      const result = new Float32Array(state.length);
      for (let i = 0; i < state.length; i++) {
        result[i] = Math.max(0, Math.min(1, 3.9 * state[i] * (1 - state[i])));
      }
      return result;
    };

    it("provides similar result to standard method", () => {
      const state = new Float32Array([0.4, 0.5, 0.6, 0.7]);

      const standard = calculateLyapunovExponent(state, chaoticStep, {
        steps: 100,
      });
      const wolf = wolfLyapunovEstimate(state, chaoticStep, { steps: 100 });

      // Both should detect chaos
      expect(["chaotic", "hyperchaotic"]).toContain(standard.classification);
      expect(["chaotic", "hyperchaotic"]).toContain(wolf.classification);
    });

    it("returns valid result structure", () => {
      const state = new Float32Array([0.5, 0.5, 0.5, 0.5]);
      const result = wolfLyapunovEstimate(state, (s) => s, { steps: 20 });

      expect(typeof result.exponent).toBe("number");
      expect(result.divergenceHistory.length).toBeGreaterThan(0);
      expect(result.confidence).toBeGreaterThanOrEqual(0);
    });
  });

  describe("quickStabilityCheck", () => {
    it("detects stable system quickly", () => {
      const state = new Float32Array([0.5, 0.5, 0.5, 0.5]);
      const stableStep: EvolutionStep = (s) => {
        const result = new Float32Array(s.length);
        for (let i = 0; i < s.length; i++) {
          result[i] = s[i] * 0.8;
        }
        return result;
      };

      const result = quickStabilityCheck(state, stableStep, 10);
      expect(result).toBe("stable");
    });

    it("detects unstable system quickly", () => {
      const state = new Float32Array([0.3, 0.4, 0.5, 0.6]);
      // Logistic map in chaotic regime - perturbations grow exponentially
      const unstableStep: EvolutionStep = (s) => {
        const result = new Float32Array(s.length);
        for (let i = 0; i < s.length; i++) {
          // Chaotic logistic map: r=4 gives maximum chaos
          result[i] = Math.max(0, Math.min(1, 4 * s[i] * (1 - s[i])));
        }
        return result;
      };

      const result = quickStabilityCheck(state, unstableStep, 20);
      expect(result).toBe("unstable");
    });

    it("returns unknown for marginal cases", () => {
      const state = new Float32Array([0.5, 0.5, 0.5, 0.5]);
      const identityStep: EvolutionStep = (s) => new Float32Array(s);

      const result = quickStabilityCheck(state, identityStep, 10);
      expect(["stable", "unknown"]).toContain(result);
    });
  });

  describe("DEFAULT_LYAPUNOV_CONFIG", () => {
    it("has valid defaults", () => {
      expect(DEFAULT_LYAPUNOV_CONFIG.steps).toBeGreaterThan(0);
      expect(DEFAULT_LYAPUNOV_CONFIG.perturbationMagnitude).toBeGreaterThan(0);
      expect(DEFAULT_LYAPUNOV_CONFIG.perturbationMagnitude).toBeLessThan(1);
      expect(DEFAULT_LYAPUNOV_CONFIG.perturbationCount).toBeGreaterThan(0);
      expect(DEFAULT_LYAPUNOV_CONFIG.renormalizePeriod).toBeGreaterThan(0);
      expect(DEFAULT_LYAPUNOV_CONFIG.stabilityThreshold).toBeGreaterThan(0);
    });

    it("renormalize is enabled by default", () => {
      expect(DEFAULT_LYAPUNOV_CONFIG.renormalize).toBe(true);
    });
  });
});
