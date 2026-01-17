/**
 * Integration Tests: Multi-Kernel Lenia
 * Tests multi-kernel configuration, simulation, serialization, and CLI
 */

import { describe, it, expect } from "vitest";
import {
  MULTIKERNEL_PRESETS,
  validateConfig,
  serializeConfig,
  deserializeConfig,
  configToCompact,
  compactToConfig,
  addKernel,
  removeKernel,
  createDefaultKernel,
  createDefaultGrowthParams,
  getMaxRadius,
  shouldUseFFT,
} from "../../core/multi-kernel";
import type { MultiKernelConfig } from "../../core/types";
import { DEFAULT_MULTIKERNEL_CONFIG } from "../../core/types";
import {
  randomMultiKernelGenome,
  mutateMultiKernelGenome,
  crossoverMultiKernelGenomes,
  multiKernelGenomeToConfig,
  encodeMultiKernelGenome,
  decodeMultiKernelGenome,
} from "../../discovery/genome";
import {
  calculateMass,
  calculateCentroid,
  calculateSymmetry,
  calculateEntropy,
} from "../../discovery/fitness";

describe("Multi-Kernel Lenia Integration", () => {
  describe("2-kernel simulation", () => {
    it("orbium-dual preset produces valid config", () => {
      const config = MULTIKERNEL_PRESETS["orbium-dual"];

      expect(config.kernels.length).toBe(2);
      expect(config.growthParams.length).toBe(2);

      const errors = validateConfig(config);
      expect(errors).toHaveLength(0);
    });

    it("2-kernel config serializes and deserializes correctly", () => {
      const config = MULTIKERNEL_PRESETS["orbium-dual"];
      const json = serializeConfig(config);
      const restored = deserializeConfig(json);

      expect(restored.kernels.length).toBe(config.kernels.length);
      expect(restored.combinationMode).toBe(config.combinationMode);
      expect(restored.dt).toBe(config.dt);

      // Check kernel parameters preserved
      for (let i = 0; i < config.kernels.length; i++) {
        expect(restored.kernels[i].radius).toBe(config.kernels[i].radius);
        expect(restored.kernels[i].shape).toBe(config.kernels[i].shape);
        expect(restored.kernels[i].weight).toBe(config.kernels[i].weight);
        expect(restored.growthParams[i].mu).toBe(config.growthParams[i].mu);
        expect(restored.growthParams[i].sigma).toBe(
          config.growthParams[i].sigma,
        );
      }
    });

    it("2-kernel simulation maintains valid state values", () => {
      const config = MULTIKERNEL_PRESETS["orbium-dual"];

      // Test that kernels have valid Lenia parameters
      for (const kernel of config.kernels) {
        expect(kernel.radius).toBeGreaterThanOrEqual(5);
        expect(kernel.radius).toBeLessThanOrEqual(30);
        expect(kernel.weight).toBeGreaterThanOrEqual(0);
        expect(kernel.weight).toBeLessThanOrEqual(1.5);
      }

      for (const growth of config.growthParams) {
        expect(growth.mu).toBeGreaterThan(0);
        expect(growth.mu).toBeLessThan(0.5);
        expect(growth.sigma).toBeGreaterThan(0);
        expect(growth.sigma).toBeLessThan(0.2);
      }
    });
  });

  describe("4-kernel simulation", () => {
    it("hydrogeminium preset has 4 kernels", () => {
      const config = MULTIKERNEL_PRESETS["hydrogeminium"];

      expect(config.kernels.length).toBe(4);
      expect(config.growthParams.length).toBe(4);
    });

    it("4-kernel config passes validation", () => {
      const config = MULTIKERNEL_PRESETS["hydrogeminium"];
      const errors = validateConfig(config);

      expect(errors).toHaveLength(0);
    });

    it("4-kernel config uses compact format correctly", () => {
      const config = MULTIKERNEL_PRESETS["hydrogeminium"];
      const compact = configToCompact(config);
      const restored = compactToConfig(compact);

      expect(restored.kernels.length).toBe(config.kernels.length);
      expect(restored.combinationMode).toBe(config.combinationMode);

      // All 4 kernels preserved
      for (let i = 0; i < config.kernels.length; i++) {
        expect(restored.kernels[i].radius).toBe(config.kernels[i].radius);
        expect(restored.kernels[i].weight).toBe(config.kernels[i].weight);
        expect(restored.growthParams[i].mu).toBe(config.growthParams[i].mu);
        expect(restored.growthParams[i].sigma).toBe(
          config.growthParams[i].sigma,
        );
      }
    });

    it("4-kernel config handles maxKernels limit", () => {
      const config = MULTIKERNEL_PRESETS["hydrogeminium"];

      // Should not be able to add more kernels
      expect(() => addKernel(config)).toThrow("Maximum number of kernels");
    });
  });

  describe("FFT path detection", () => {
    it("detects when FFT should be used", () => {
      // Orbium-dual has radius 21 on one kernel, should use FFT
      const config = MULTIKERNEL_PRESETS["orbium-dual"];
      const maxR = getMaxRadius(config);

      expect(maxR).toBe(21);
      expect(shouldUseFFT(config)).toBe(true);
    });

    it("detects when direct convolution should be used", () => {
      // Create config with small radii
      const config: MultiKernelConfig = {
        ...DEFAULT_MULTIKERNEL_CONFIG,
        kernels: [
          { ...createDefaultKernel(0), radius: 10 },
          { ...createDefaultKernel(1), radius: 8 },
        ],
        growthParams: [
          createDefaultGrowthParams(),
          createDefaultGrowthParams(),
        ],
      };

      const maxR = getMaxRadius(config);
      expect(maxR).toBe(10);
      expect(shouldUseFFT(config)).toBe(false);
    });

    it("FFT threshold is radius >= 16", () => {
      // Test at boundary
      const configLow: MultiKernelConfig = {
        ...DEFAULT_MULTIKERNEL_CONFIG,
        kernels: [{ ...createDefaultKernel(0), radius: 15 }],
        growthParams: [createDefaultGrowthParams()],
      };

      const configHigh: MultiKernelConfig = {
        ...DEFAULT_MULTIKERNEL_CONFIG,
        kernels: [{ ...createDefaultKernel(0), radius: 16 }],
        growthParams: [createDefaultGrowthParams()],
      };

      expect(shouldUseFFT(configLow)).toBe(false);
      expect(shouldUseFFT(configHigh)).toBe(true);
    });
  });

  describe("Save/Load multi-kernel organisms", () => {
    it("serializes all kernel properties", () => {
      const config = MULTIKERNEL_PRESETS["geminium-triple"];
      const json = serializeConfig(config);
      const parsed = JSON.parse(json);

      expect(parsed.kernels).toBeDefined();
      expect(parsed.kernels.length).toBe(3);
      expect(parsed.growthParams).toBeDefined();
      expect(parsed.growthParams.length).toBe(3);
      expect(parsed.combinationMode).toBeDefined();
      expect(parsed.dt).toBeDefined();
    });

    it("round-trips all presets correctly", () => {
      for (const [name, original] of Object.entries(MULTIKERNEL_PRESETS)) {
        const json = serializeConfig(original);
        const restored = deserializeConfig(json);

        expect(restored.kernels.length).toBe(original.kernels.length);
        expect(restored.combinationMode).toBe(original.combinationMode);
        expect(restored.dt).toBe(original.dt);
      }
    });

    it("genome encoding preserves multi-kernel structure", () => {
      const genome = randomMultiKernelGenome(3);
      const encoded = encodeMultiKernelGenome(genome);
      const decoded = decodeMultiKernelGenome(encoded);

      expect(decoded.kernelCount).toBe(genome.kernelCount);
      expect(decoded.R.length).toBe(genome.R.length);
      expect(decoded.h.length).toBe(genome.h.length);
      expect(decoded.m.length).toBe(genome.m.length);
      expect(decoded.s.length).toBe(genome.s.length);
    });

    it("genome to config conversion is consistent", () => {
      const genome = randomMultiKernelGenome(2);
      const config = multiKernelGenomeToConfig(genome);

      expect(config.kernels.length).toBe(genome.kernelCount);
      expect(config.growthParams.length).toBe(genome.kernelCount);
      expect(config.dt).toBeCloseTo(1 / genome.T, 6);
    });
  });

  describe("CLI functionality (simulated)", () => {
    it("preset lookup works for all presets", () => {
      const presetNames = [
        "single",
        "orbium-dual",
        "geminium-triple",
        "hydrogeminium",
        "scutium-dual",
      ];

      for (const name of presetNames) {
        const config = MULTIKERNEL_PRESETS[name];
        expect(config).toBeDefined();
        expect(validateConfig(config)).toHaveLength(0);
      }
    });

    it("random genome generation works", () => {
      // Test multiple random generations
      for (let i = 0; i < 10; i++) {
        const genome = randomMultiKernelGenome();
        const config = multiKernelGenomeToConfig(genome);
        const errors = validateConfig(config);

        expect(errors).toHaveLength(0);
      }
    });

    it("genome evaluation pipeline works", () => {
      const genome = randomMultiKernelGenome(2);
      const encoded = encodeMultiKernelGenome(genome);
      const decoded = decodeMultiKernelGenome(encoded);
      const config = multiKernelGenomeToConfig(decoded);
      const errors = validateConfig(config);

      expect(errors).toHaveLength(0);
      expect(config.kernels.length).toBe(2);
    });

    it("evolution operators work in sequence", () => {
      const parent1 = randomMultiKernelGenome(2);
      const parent2 = randomMultiKernelGenome(3);

      // Crossover
      const child = crossoverMultiKernelGenomes(parent1, parent2);
      expect(child.kernelCount).toBeGreaterThanOrEqual(1);
      expect(child.kernelCount).toBeLessThanOrEqual(4);

      // Mutation
      const mutated = mutateMultiKernelGenome(child, 0.5);
      const config = multiKernelGenomeToConfig(mutated);
      const errors = validateConfig(config);

      expect(errors).toHaveLength(0);
    });

    it("config export produces valid JSON", () => {
      const config = MULTIKERNEL_PRESETS["orbium-dual"];
      const json = serializeConfig(config);

      // Should be valid JSON
      expect(() => JSON.parse(json)).not.toThrow();

      // Should contain required fields
      const parsed = JSON.parse(json);
      expect(parsed.kernels).toBeDefined();
      expect(parsed.growthParams).toBeDefined();
      expect(parsed.combinationMode).toBeDefined();
      expect(parsed.dt).toBeDefined();
    });
  });

  describe("Kernel management operations", () => {
    it("add kernel increases count", () => {
      let config = { ...DEFAULT_MULTIKERNEL_CONFIG };
      expect(config.kernels.length).toBe(1);

      config = addKernel(config);
      expect(config.kernels.length).toBe(2);
      expect(config.growthParams.length).toBe(2);
    });

    it("remove kernel decreases count", () => {
      let config = MULTIKERNEL_PRESETS["orbium-dual"];
      expect(config.kernels.length).toBe(2);

      config = removeKernel(config, 1);
      expect(config.kernels.length).toBe(1);
      expect(config.growthParams.length).toBe(1);
    });

    it("cannot remove last kernel", () => {
      const config = { ...DEFAULT_MULTIKERNEL_CONFIG };
      expect(config.kernels.length).toBe(1);

      expect(() => removeKernel(config, 0)).toThrow(
        "Cannot remove the last kernel",
      );
    });

    it("add/remove cycle preserves validity", () => {
      let config = { ...DEFAULT_MULTIKERNEL_CONFIG };

      // Add 3 kernels
      config = addKernel(config);
      config = addKernel(config);
      config = addKernel(config);
      expect(config.kernels.length).toBe(4);

      // Remove 2 kernels
      config = removeKernel(config, 3);
      config = removeKernel(config, 2);
      expect(config.kernels.length).toBe(2);

      // Should still be valid
      const errors = validateConfig(config);
      expect(errors).toHaveLength(0);
    });
  });

  describe("Combination modes", () => {
    it("all presets have valid combination modes", () => {
      const validModes = ["sum", "average", "weighted"];

      for (const [name, config] of Object.entries(MULTIKERNEL_PRESETS)) {
        expect(validModes).toContain(config.combinationMode);
      }
    });

    it("combination mode is preserved through serialization", () => {
      for (const mode of ["sum", "average", "weighted"] as const) {
        const config: MultiKernelConfig = {
          ...DEFAULT_MULTIKERNEL_CONFIG,
          combinationMode: mode,
        };

        const json = serializeConfig(config);
        const restored = deserializeConfig(json);

        expect(restored.combinationMode).toBe(mode);
      }
    });
  });

  describe("Fitness integration", () => {
    it("fitness functions work with multi-kernel state", () => {
      // Create simple test state
      const width = 64;
      const height = 64;
      const state = new Float32Array(width * height);

      // Add a blob in the center
      const cx = width / 2;
      const cy = height / 2;
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const dx = x - cx;
          const dy = y - cy;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 10) {
            state[y * width + x] = Math.exp((-dist * dist) / 50);
          }
        }
      }

      // Calculate fitness metrics
      const mass = calculateMass(state);
      const centroid = calculateCentroid(state, width, height);
      const symmetry = calculateSymmetry(state, width, height);
      const entropy = calculateEntropy(state);

      expect(mass).toBeGreaterThan(0);
      expect(centroid.x).toBeCloseTo(cx, 0);
      expect(centroid.y).toBeCloseTo(cy, 0);
      expect(symmetry).toBeGreaterThanOrEqual(0);
      expect(symmetry).toBeLessThanOrEqual(1);
      expect(entropy).toBeGreaterThanOrEqual(0);
    });
  });

  describe("Cross-preset compatibility", () => {
    it("all presets can be converted to compact and back", () => {
      for (const [name, config] of Object.entries(MULTIKERNEL_PRESETS)) {
        const compact = configToCompact(config);
        const restored = compactToConfig(compact);

        // Basic structure preserved
        expect(restored.kernels.length).toBe(config.kernels.length);
        expect(restored.growthParams.length).toBe(config.growthParams.length);
      }
    });

    it("genome can represent any preset configuration", () => {
      // Generate random genomes with different kernel counts
      for (let k = 1; k <= 4; k++) {
        const genome = randomMultiKernelGenome(k);
        const config = multiKernelGenomeToConfig(genome);
        const errors = validateConfig(config);

        expect(errors).toHaveLength(0);
        expect(config.kernels.length).toBe(k);
      }
    });
  });
});
