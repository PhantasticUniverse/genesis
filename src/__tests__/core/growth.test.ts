/**
 * Growth Function Tests
 * Tests for continuous CA growth functions
 */

import { describe, it, expect } from "vitest";
import {
  polynomialGrowth,
  gaussianGrowth,
  stepGrowth,
  smoothStepGrowth,
  applyGrowth,
  calculateGrowth,
  GROWTH_PRESETS,
  type GrowthConfig,
} from "../../core/growth";

describe("growth functions", () => {
  describe("polynomialGrowth", () => {
    it("returns 1 at center (mu)", () => {
      const result = polynomialGrowth(0.15, 0.15, 0.015);
      expect(result).toBeCloseTo(1, 5);
    });

    it("returns -1 far from center", () => {
      const result = polynomialGrowth(0, 0.15, 0.015);
      expect(result).toBe(-1);
    });

    it("returns -1 when |x| >= 1", () => {
      const mu = 0.15;
      const sigma = 0.015;
      // At distance 3*sigma from center, function returns -1
      expect(polynomialGrowth(mu + 3 * sigma, mu, sigma)).toBe(-1);
      expect(polynomialGrowth(mu - 3 * sigma, mu, sigma)).toBe(-1);
    });

    it("is symmetric around center", () => {
      const mu = 0.15;
      const sigma = 0.015;
      const offset = 0.02;

      const left = polynomialGrowth(mu - offset, mu, sigma);
      const right = polynomialGrowth(mu + offset, mu, sigma);

      expect(left).toBeCloseTo(right, 10);
    });

    it("returns values in [-1, 1] range", () => {
      for (let n = 0; n <= 1; n += 0.1) {
        const result = polynomialGrowth(n, 0.15, 0.015);
        expect(result).toBeGreaterThanOrEqual(-1);
        expect(result).toBeLessThanOrEqual(1);
      }
    });

    it("has smooth transition from positive to negative", () => {
      const mu = 0.15;
      const sigma = 0.015;
      const values: number[] = [];

      for (let n = 0.1; n <= 0.2; n += 0.01) {
        values.push(polynomialGrowth(n, mu, sigma));
      }

      // Check monotonicity from center outward
      const centerIndex = Math.floor(values.length / 2);
      for (let i = centerIndex; i < values.length - 1; i++) {
        expect(values[i]).toBeGreaterThanOrEqual(values[i + 1]);
      }
    });
  });

  describe("gaussianGrowth", () => {
    it("returns 1 at center (mu)", () => {
      const result = gaussianGrowth(0.15, 0.15, 0.017);
      expect(result).toBeCloseTo(1, 5);
    });

    it("approaches -1 far from center", () => {
      const result = gaussianGrowth(0, 0.15, 0.017);
      expect(result).toBeCloseTo(-1, 1);
    });

    it("is symmetric around center", () => {
      const mu = 0.15;
      const sigma = 0.017;
      const offset = 0.05;

      const left = gaussianGrowth(mu - offset, mu, sigma);
      const right = gaussianGrowth(mu + offset, mu, sigma);

      expect(left).toBeCloseTo(right, 10);
    });

    it("returns values in [-1, 1] range", () => {
      for (let n = 0; n <= 1; n += 0.1) {
        const result = gaussianGrowth(n, 0.15, 0.017);
        expect(result).toBeGreaterThanOrEqual(-1);
        expect(result).toBeLessThanOrEqual(1);
      }
    });

    it("has wider spread with larger sigma", () => {
      const mu = 0.15;
      const narrowSigma = 0.01;
      const wideSigma = 0.05;
      const testPoint = 0.18;

      const narrow = gaussianGrowth(testPoint, mu, narrowSigma);
      const wide = gaussianGrowth(testPoint, mu, wideSigma);

      // Wide sigma should have higher value away from center
      expect(wide).toBeGreaterThan(narrow);
    });
  });

  describe("stepGrowth", () => {
    const birthLow = 0.15;
    const birthHigh = 0.25;
    const deathLow = 0.12;
    const deathHigh = 0.42;

    it("returns 1 (birth) for dead cell in birth range", () => {
      const result = stepGrowth(
        0.2,
        0,
        birthLow,
        birthHigh,
        deathLow,
        deathHigh,
      );
      expect(result).toBe(1);
    });

    it("returns -1 (stay dead) for dead cell outside birth range", () => {
      const result = stepGrowth(
        0.1,
        0,
        birthLow,
        birthHigh,
        deathLow,
        deathHigh,
      );
      expect(result).toBe(-1);
    });

    it("returns 1 (survive) for alive cell in survival range", () => {
      const result = stepGrowth(
        0.3,
        1,
        birthLow,
        birthHigh,
        deathLow,
        deathHigh,
      );
      expect(result).toBe(1);
    });

    it("returns -1 (die) for alive cell outside survival range", () => {
      const result = stepGrowth(
        0.5,
        1,
        birthLow,
        birthHigh,
        deathLow,
        deathHigh,
      );
      expect(result).toBe(-1);
    });

    it("uses current state threshold of 0.5", () => {
      // Barely alive (0.6) should use survival rules
      expect(
        stepGrowth(0.3, 0.6, birthLow, birthHigh, deathLow, deathHigh),
      ).toBe(1);
      // Barely dead (0.4) should use birth rules
      expect(
        stepGrowth(0.2, 0.4, birthLow, birthHigh, deathLow, deathHigh),
      ).toBe(1);
    });

    it("handles boundary values", () => {
      // At exact boundaries
      expect(
        stepGrowth(birthLow, 0, birthLow, birthHigh, deathLow, deathHigh),
      ).toBe(1);
      expect(
        stepGrowth(birthHigh, 0, birthLow, birthHigh, deathLow, deathHigh),
      ).toBe(1);
      expect(
        stepGrowth(deathLow, 1, birthLow, birthHigh, deathLow, deathHigh),
      ).toBe(1);
      expect(
        stepGrowth(deathHigh, 1, birthLow, birthHigh, deathLow, deathHigh),
      ).toBe(1);
    });
  });

  describe("smoothStepGrowth", () => {
    const birthLow = 0.15;
    const birthHigh = 0.25;
    const deathLow = 0.12;
    const deathHigh = 0.42;

    it("returns positive value for dead cell in birth range", () => {
      const result = smoothStepGrowth(
        0.2,
        0,
        birthLow,
        birthHigh,
        deathLow,
        deathHigh,
      );
      expect(result).toBeGreaterThan(0);
    });

    it("returns positive value for alive cell in survival range", () => {
      const result = smoothStepGrowth(
        0.3,
        1,
        birthLow,
        birthHigh,
        deathLow,
        deathHigh,
      );
      expect(result).toBeGreaterThan(0);
    });

    it("returns values in [-1, 1] range", () => {
      for (let n = 0; n <= 0.6; n += 0.1) {
        for (const state of [0, 0.5, 1]) {
          const result = smoothStepGrowth(
            n,
            state,
            birthLow,
            birthHigh,
            deathLow,
            deathHigh,
          );
          expect(result).toBeGreaterThanOrEqual(-1);
          expect(result).toBeLessThanOrEqual(1);
        }
      }
    });

    it("has smooth transitions (not hard steps)", () => {
      // Values should change gradually
      const values: number[] = [];
      for (let n = 0.1; n <= 0.3; n += 0.01) {
        values.push(
          smoothStepGrowth(n, 0, birthLow, birthHigh, deathLow, deathHigh),
        );
      }

      // Check that consecutive values don't jump too much
      for (let i = 1; i < values.length; i++) {
        expect(Math.abs(values[i] - values[i - 1])).toBeLessThan(0.5);
      }
    });

    it("interpolates between birth and survival based on state", () => {
      const n = 0.2;
      const dead = smoothStepGrowth(
        n,
        0,
        birthLow,
        birthHigh,
        deathLow,
        deathHigh,
      );
      const alive = smoothStepGrowth(
        n,
        1,
        birthLow,
        birthHigh,
        deathLow,
        deathHigh,
      );
      const partial = smoothStepGrowth(
        n,
        0.5,
        birthLow,
        birthHigh,
        deathLow,
        deathHigh,
      );

      // Partial should be between dead and alive values
      const min = Math.min(dead, alive);
      const max = Math.max(dead, alive);
      expect(partial).toBeGreaterThanOrEqual(min - 0.01);
      expect(partial).toBeLessThanOrEqual(max + 0.01);
    });
  });

  describe("applyGrowth", () => {
    it("increases state with positive growth", () => {
      const result = applyGrowth(0.5, 1, 0.1);
      expect(result).toBeCloseTo(0.6, 5);
    });

    it("decreases state with negative growth", () => {
      const result = applyGrowth(0.5, -1, 0.1);
      expect(result).toBeCloseTo(0.4, 5);
    });

    it("clamps to minimum of 0", () => {
      const result = applyGrowth(0.1, -1, 0.5);
      expect(result).toBe(0);
    });

    it("clamps to maximum of 1", () => {
      const result = applyGrowth(0.9, 1, 0.5);
      expect(result).toBe(1);
    });

    it("respects dt (time step)", () => {
      const smallDt = applyGrowth(0.5, 1, 0.01);
      const largeDt = applyGrowth(0.5, 1, 0.1);

      expect(smallDt).toBeLessThan(largeDt);
    });

    it("handles zero growth", () => {
      const result = applyGrowth(0.5, 0, 0.1);
      expect(result).toBe(0.5);
    });
  });

  describe("calculateGrowth", () => {
    it("uses polynomial growth function", () => {
      const config: GrowthConfig = {
        function: "polynomial",
        center: 0.15,
        width: 0.015,
      };

      const result = calculateGrowth(0.15, 0.5, config);
      expect(result).toBeCloseTo(1, 5);
    });

    it("uses gaussian growth function", () => {
      const config: GrowthConfig = {
        function: "gaussian",
        center: 0.15,
        width: 0.017,
      };

      const result = calculateGrowth(0.15, 0.5, config);
      expect(result).toBeCloseTo(1, 5);
    });

    it("uses step growth function", () => {
      const config: GrowthConfig = {
        function: "step",
        center: 0.15,
        width: 0.015,
        birthLow: 0.15,
        birthHigh: 0.25,
        deathLow: 0.12,
        deathHigh: 0.42,
      };

      // Dead cell in birth range
      expect(calculateGrowth(0.2, 0, config)).toBe(1);
    });

    it("uses smooth-step growth function", () => {
      const config: GrowthConfig = {
        function: "smooth-step",
        center: 0.15,
        width: 0.015,
        birthLow: 0.15,
        birthHigh: 0.25,
        deathLow: 0.12,
        deathHigh: 0.42,
      };

      const result = calculateGrowth(0.2, 0, config);
      expect(result).toBeGreaterThan(0);
    });

    it("uses default values for step functions", () => {
      const config: GrowthConfig = {
        function: "step",
        center: 0.15,
        width: 0.015,
      };

      // Should use default birthLow: 0.15, birthHigh: 0.25
      expect(calculateGrowth(0.2, 0, config)).toBe(1);
    });

    it("returns 0 for unknown function type", () => {
      const config = {
        function: "unknown" as never,
        center: 0.15,
        width: 0.015,
      };

      const result = calculateGrowth(0.15, 0.5, config);
      expect(result).toBe(0);
    });
  });

  describe("GROWTH_PRESETS", () => {
    it("has lenia-default preset", () => {
      expect(GROWTH_PRESETS["lenia-default"]).toBeDefined();
      expect(GROWTH_PRESETS["lenia-default"].function).toBe("gaussian");
      expect(GROWTH_PRESETS["lenia-default"].center).toBe(0.12);
      expect(GROWTH_PRESETS["lenia-default"].width).toBe(0.04);
    });

    it("has lenia-wide preset", () => {
      expect(GROWTH_PRESETS["lenia-wide"]).toBeDefined();
      // lenia-wide has center 0.2 which is different from lenia-default's 0.12
      expect(GROWTH_PRESETS["lenia-wide"].center).toBeGreaterThan(
        GROWTH_PRESETS["lenia-default"].center,
      );
    });

    it("has smoothlife preset", () => {
      expect(GROWTH_PRESETS["smoothlife"]).toBeDefined();
      expect(GROWTH_PRESETS["smoothlife"].function).toBe("smooth-step");
      expect(GROWTH_PRESETS["smoothlife"].birthLow).toBeDefined();
    });

    it("has gaussian-stable preset", () => {
      expect(GROWTH_PRESETS["gaussian-stable"]).toBeDefined();
      expect(GROWTH_PRESETS["gaussian-stable"].function).toBe("gaussian");
    });

    it("all presets produce valid growth values", () => {
      for (const [name, preset] of Object.entries(GROWTH_PRESETS)) {
        const result = calculateGrowth(preset.center, 0.5, preset);
        expect(result).toBeGreaterThanOrEqual(-1);
        expect(result).toBeLessThanOrEqual(1);
      }
    });
  });
});
