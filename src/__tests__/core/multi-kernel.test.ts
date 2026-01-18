/**
 * Multi-Kernel Lenia Tests
 * Tests for multi-kernel state management, presets, and utilities
 */

import { describe, it, expect } from "vitest";
import {
  createMultiKernelState,
  createDefaultKernel,
  createDefaultGrowthParams,
  MULTIKERNEL_PRESETS,
  addKernel,
  removeKernel,
  updateKernel,
  updateGrowthParams,
  setCombinationMode,
  normalizeWeights,
  getMaxRadius,
  shouldUseFFT,
  validateConfig,
  serializeConfig,
  deserializeConfig,
  configToCompact,
  compactToConfig,
} from "../../core/multi-kernel";
import type { MultiKernelConfig } from "../../core/types";
import { DEFAULT_MULTIKERNEL_CONFIG } from "../../core/types";

describe("multi-kernel", () => {
  describe("createMultiKernelState", () => {
    it("creates state with default config", () => {
      const state = createMultiKernelState();

      expect(state.enabled).toBe(false);
      expect(state.config.kernels.length).toBe(1);
      expect(state.config.combinationMode).toBe("sum");
    });

    it("creates state with custom config", () => {
      const state = createMultiKernelState({ combinationMode: "weighted" });

      expect(state.config.combinationMode).toBe("weighted");
    });
  });

  describe("createDefaultKernel", () => {
    it("creates kernel with correct id", () => {
      const kernel = createDefaultKernel(2);

      expect(kernel.id).toBe("kernel-2");
      expect(kernel.shape).toBe("polynomial");
      expect(kernel.radius).toBe(12); // Optimized default value
      expect(kernel.weight).toBe(1.0);
    });
  });

  describe("createDefaultGrowthParams", () => {
    it("creates growth params with Lenia defaults", () => {
      const growth = createDefaultGrowthParams();

      expect(growth.type).toBe("gaussian");
      expect(growth.mu).toBe(0.12);
      expect(growth.sigma).toBe(0.04);
    });
  });

  describe("MULTIKERNEL_PRESETS", () => {
    it("has orbium-dual preset", () => {
      const preset = MULTIKERNEL_PRESETS["orbium-dual"];

      expect(preset).toBeDefined();
      expect(preset.kernels.length).toBe(2);
      expect(preset.combinationMode).toBe("weighted");
    });

    it("has geminium-triple preset", () => {
      const preset = MULTIKERNEL_PRESETS["geminium-triple"];

      expect(preset).toBeDefined();
      expect(preset.kernels.length).toBe(3);
    });

    it("has hydrogeminium preset with 4 kernels", () => {
      const preset = MULTIKERNEL_PRESETS["hydrogeminium"];

      expect(preset).toBeDefined();
      expect(preset.kernels.length).toBe(4);
    });

    it("has scutium-dual preset", () => {
      const preset = MULTIKERNEL_PRESETS["scutium-dual"];

      expect(preset).toBeDefined();
      expect(preset.kernels.length).toBe(2);
    });

    it("has single kernel preset for backward compatibility", () => {
      const preset = MULTIKERNEL_PRESETS["single"];

      expect(preset).toBeDefined();
      expect(preset.kernels.length).toBe(1);
    });

    it("all presets have matching kernel and growth param counts", () => {
      for (const [name, preset] of Object.entries(MULTIKERNEL_PRESETS)) {
        expect(preset.kernels.length).toBe(preset.growthParams.length);
      }
    });

    it("all presets pass validation", () => {
      for (const [name, preset] of Object.entries(MULTIKERNEL_PRESETS)) {
        const errors = validateConfig(preset);
        expect(errors).toHaveLength(0);
      }
    });
  });

  describe("addKernel", () => {
    it("adds a kernel with defaults", () => {
      const config = { ...DEFAULT_MULTIKERNEL_CONFIG };
      const updated = addKernel(config);

      expect(updated.kernels.length).toBe(2);
      expect(updated.growthParams.length).toBe(2);
    });

    it("adds a kernel with custom params", () => {
      const config = { ...DEFAULT_MULTIKERNEL_CONFIG };
      const kernel = { ...createDefaultKernel(1), radius: 20 };
      const growth = { ...createDefaultGrowthParams(), mu: 0.15 };

      const updated = addKernel(config, kernel, growth);

      expect(updated.kernels[1].radius).toBe(20);
      expect(updated.growthParams[1].mu).toBe(0.15);
    });

    it("throws when max kernels reached", () => {
      const config = MULTIKERNEL_PRESETS["hydrogeminium"]; // 4 kernels

      expect(() => addKernel(config)).toThrow("Maximum number of kernels");
    });
  });

  describe("removeKernel", () => {
    it("removes kernel at index", () => {
      const config = MULTIKERNEL_PRESETS["orbium-dual"];
      const updated = removeKernel(config, 1);

      expect(updated.kernels.length).toBe(1);
      expect(updated.growthParams.length).toBe(1);
    });

    it("throws when trying to remove last kernel", () => {
      const config = { ...DEFAULT_MULTIKERNEL_CONFIG };

      expect(() => removeKernel(config, 0)).toThrow(
        "Cannot remove the last kernel",
      );
    });

    it("throws for invalid index", () => {
      const config = MULTIKERNEL_PRESETS["orbium-dual"];

      expect(() => removeKernel(config, 5)).toThrow("Invalid kernel index");
    });
  });

  describe("updateKernel", () => {
    it("updates kernel params", () => {
      const config = { ...DEFAULT_MULTIKERNEL_CONFIG };
      const updated = updateKernel(config, 0, { radius: 20, weight: 0.8 });

      expect(updated.kernels[0].radius).toBe(20);
      expect(updated.kernels[0].weight).toBe(0.8);
    });

    it("preserves other kernel params", () => {
      const config = { ...DEFAULT_MULTIKERNEL_CONFIG };
      const originalShape = config.kernels[0].shape;
      const updated = updateKernel(config, 0, { radius: 20 });

      expect(updated.kernels[0].shape).toBe(originalShape);
    });

    it("throws for invalid index", () => {
      const config = { ...DEFAULT_MULTIKERNEL_CONFIG };

      expect(() => updateKernel(config, 5, { radius: 20 })).toThrow(
        "Invalid kernel index",
      );
    });
  });

  describe("updateGrowthParams", () => {
    it("updates growth params", () => {
      const config = { ...DEFAULT_MULTIKERNEL_CONFIG };
      const updated = updateGrowthParams(config, 0, { mu: 0.15, sigma: 0.05 });

      expect(updated.growthParams[0].mu).toBe(0.15);
      expect(updated.growthParams[0].sigma).toBe(0.05);
    });

    it("preserves other growth params", () => {
      const config = { ...DEFAULT_MULTIKERNEL_CONFIG };
      const originalType = config.growthParams[0].type;
      const updated = updateGrowthParams(config, 0, { mu: 0.15 });

      expect(updated.growthParams[0].type).toBe(originalType);
    });

    it("throws for invalid index", () => {
      const config = { ...DEFAULT_MULTIKERNEL_CONFIG };

      expect(() => updateGrowthParams(config, 5, { mu: 0.15 })).toThrow(
        "Invalid growth params index",
      );
    });
  });

  describe("setCombinationMode", () => {
    it("sets combination mode", () => {
      const config = { ...DEFAULT_MULTIKERNEL_CONFIG };
      const updated = setCombinationMode(config, "weighted");

      expect(updated.combinationMode).toBe("weighted");
    });
  });

  describe("normalizeWeights", () => {
    it("normalizes weights to sum to 1", () => {
      const config: MultiKernelConfig = {
        kernels: [
          {
            id: "k0",
            shape: "polynomial",
            radius: 13,
            peaks: [0.5],
            weight: 0.6,
          },
          {
            id: "k1",
            shape: "polynomial",
            radius: 10,
            peaks: [0.5],
            weight: 0.4,
          },
        ],
        growthParams: [
          { type: "gaussian", mu: 0.12, sigma: 0.04 },
          { type: "gaussian", mu: 0.12, sigma: 0.04 },
        ],
        combinationMode: "weighted",
        dt: 0.1,
        maxKernels: 4,
      };

      const normalized = normalizeWeights(config);
      const totalWeight = normalized.kernels.reduce(
        (sum, k) => sum + k.weight,
        0,
      );

      expect(totalWeight).toBeCloseTo(1, 6);
    });

    it("handles zero total weight", () => {
      const config: MultiKernelConfig = {
        kernels: [
          {
            id: "k0",
            shape: "polynomial",
            radius: 13,
            peaks: [0.5],
            weight: 0,
          },
        ],
        growthParams: [{ type: "gaussian", mu: 0.12, sigma: 0.04 }],
        combinationMode: "weighted",
        dt: 0.1,
        maxKernels: 4,
      };

      const normalized = normalizeWeights(config);

      expect(normalized.kernels[0].weight).toBe(0);
    });
  });

  describe("getMaxRadius", () => {
    it("returns max radius from all kernels", () => {
      const config = MULTIKERNEL_PRESETS["orbium-dual"];
      const maxRadius = getMaxRadius(config);

      expect(maxRadius).toBe(21); // orbium-dual has radii 13 and 21
    });
  });

  describe("shouldUseFFT", () => {
    it("returns true when max radius >= 16", () => {
      const config = MULTIKERNEL_PRESETS["orbium-dual"]; // Has radius 21

      expect(shouldUseFFT(config)).toBe(true);
    });

    it("returns false when max radius < 16", () => {
      const config = { ...DEFAULT_MULTIKERNEL_CONFIG };
      config.kernels[0].radius = 10;

      expect(shouldUseFFT(config)).toBe(false);
    });
  });

  describe("validateConfig", () => {
    it("returns no errors for valid config", () => {
      const config = MULTIKERNEL_PRESETS["orbium-dual"];
      const errors = validateConfig(config);

      expect(errors).toHaveLength(0);
    });

    it("returns error for empty kernels", () => {
      const config: MultiKernelConfig = {
        kernels: [],
        growthParams: [],
        combinationMode: "sum",
        dt: 0.1,
        maxKernels: 4,
      };
      const errors = validateConfig(config);

      expect(errors).toContain("At least one kernel is required");
    });

    it("returns error for too many kernels", () => {
      const config: MultiKernelConfig = {
        ...DEFAULT_MULTIKERNEL_CONFIG,
        maxKernels: 1,
      };
      config.kernels = [createDefaultKernel(0), createDefaultKernel(1)];
      config.growthParams = [
        createDefaultGrowthParams(),
        createDefaultGrowthParams(),
      ];

      const errors = validateConfig(config);

      expect(errors.some((e) => e.includes("Too many kernels"))).toBe(true);
    });

    it("returns error for mismatched kernel/growth counts", () => {
      const config: MultiKernelConfig = {
        ...DEFAULT_MULTIKERNEL_CONFIG,
        growthParams: [],
      };
      const errors = validateConfig(config);

      expect(errors.some((e) => e.includes("must match"))).toBe(true);
    });

    it("returns error for invalid radius", () => {
      const config: MultiKernelConfig = {
        ...DEFAULT_MULTIKERNEL_CONFIG,
      };
      config.kernels[0].radius = 100; // Too large

      const errors = validateConfig(config);

      expect(errors.some((e) => e.includes("radius"))).toBe(true);
    });

    it("returns error for invalid dt", () => {
      const config: MultiKernelConfig = {
        ...DEFAULT_MULTIKERNEL_CONFIG,
        dt: 0,
      };
      const errors = validateConfig(config);

      expect(errors.some((e) => e.includes("dt"))).toBe(true);
    });
  });

  describe("serialization", () => {
    it("serializes and deserializes config", () => {
      const config = MULTIKERNEL_PRESETS["orbium-dual"];
      const json = serializeConfig(config);
      const restored = deserializeConfig(json);

      expect(restored.kernels.length).toBe(config.kernels.length);
      expect(restored.combinationMode).toBe(config.combinationMode);
      expect(restored.dt).toBe(config.dt);
    });

    it("throws on invalid JSON", () => {
      expect(() => deserializeConfig("invalid json")).toThrow();
    });

    it("throws on invalid config structure", () => {
      const invalidJson = JSON.stringify({ kernels: [] });

      expect(() => deserializeConfig(invalidJson)).toThrow();
    });
  });

  describe("compact format", () => {
    it("converts to and from compact format", () => {
      const config = MULTIKERNEL_PRESETS["orbium-dual"];
      const compact = configToCompact(config);
      const restored = compactToConfig(compact);

      expect(restored.kernels.length).toBe(config.kernels.length);
      expect(restored.combinationMode).toBe(config.combinationMode);
      expect(restored.dt).toBe(config.dt);

      for (let i = 0; i < config.kernels.length; i++) {
        expect(restored.kernels[i].radius).toBe(config.kernels[i].radius);
        expect(restored.kernels[i].weight).toBe(config.kernels[i].weight);
        expect(restored.growthParams[i].mu).toBe(config.growthParams[i].mu);
      }
    });
  });
});
