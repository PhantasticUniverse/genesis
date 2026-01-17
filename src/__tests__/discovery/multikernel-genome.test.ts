/**
 * Multi-Kernel Genome Tests
 * Tests for multi-kernel genome encoding, mutation, crossover
 */

import { describe, it, expect } from "vitest";
import {
  randomMultiKernelGenome,
  cloneMultiKernelGenome,
  mutateMultiKernelGenome,
  crossoverMultiKernelGenomes,
  multiKernelGenomeToConfig,
  encodeMultiKernelGenome,
  decodeMultiKernelGenome,
  MULTIKERNEL_GENOME_RANGES,
  type MultiKernelGenome,
} from "../../discovery/genome";

describe("multikernel-genome", () => {
  describe("randomMultiKernelGenome", () => {
    it("generates genome with valid kernel count", () => {
      const genome = randomMultiKernelGenome();

      expect(genome.kernelCount).toBeGreaterThanOrEqual(
        MULTIKERNEL_GENOME_RANGES.kernelCount.min,
      );
      expect(genome.kernelCount).toBeLessThanOrEqual(
        MULTIKERNEL_GENOME_RANGES.kernelCount.max,
      );
    });

    it("respects specified kernel count", () => {
      const genome = randomMultiKernelGenome(3);

      expect(genome.kernelCount).toBe(3);
      expect(genome.R.length).toBe(3);
      expect(genome.b.length).toBe(3);
      expect(genome.h.length).toBe(3);
      expect(genome.m.length).toBe(3);
      expect(genome.s.length).toBe(3);
      expect(genome.kn.length).toBe(3);
      expect(genome.gn.length).toBe(3);
    });

    it("generates valid parameter values", () => {
      const genome = randomMultiKernelGenome(2);

      // Check time resolution
      expect(genome.T).toBeGreaterThanOrEqual(MULTIKERNEL_GENOME_RANGES.T.min);
      expect(genome.T).toBeLessThanOrEqual(MULTIKERNEL_GENOME_RANGES.T.max);

      // Check combination mode
      expect(genome.combinationMode).toBeGreaterThanOrEqual(0);
      expect(genome.combinationMode).toBeLessThanOrEqual(2);

      // Check radii
      for (const r of genome.R) {
        expect(r).toBeGreaterThanOrEqual(MULTIKERNEL_GENOME_RANGES.R.min);
        expect(r).toBeLessThanOrEqual(MULTIKERNEL_GENOME_RANGES.R.max);
      }

      // Check weights
      for (const h of genome.h) {
        expect(h).toBeGreaterThanOrEqual(MULTIKERNEL_GENOME_RANGES.h.min);
        expect(h).toBeLessThanOrEqual(MULTIKERNEL_GENOME_RANGES.h.max);
      }

      // Check growth centers
      for (const mu of genome.m) {
        expect(mu).toBeGreaterThanOrEqual(MULTIKERNEL_GENOME_RANGES.m.min);
        expect(mu).toBeLessThanOrEqual(MULTIKERNEL_GENOME_RANGES.m.max);
      }

      // Check growth widths
      for (const sigma of genome.s) {
        expect(sigma).toBeGreaterThanOrEqual(MULTIKERNEL_GENOME_RANGES.s.min);
        expect(sigma).toBeLessThanOrEqual(MULTIKERNEL_GENOME_RANGES.s.max);
      }
    });

    it("generates peaks in sorted order", () => {
      const genome = randomMultiKernelGenome(2);

      for (const peaks of genome.b) {
        for (let i = 1; i < peaks.length; i++) {
          expect(peaks[i]).toBeGreaterThanOrEqual(peaks[i - 1]);
        }
      }
    });
  });

  describe("cloneMultiKernelGenome", () => {
    it("creates deep copy", () => {
      const original = randomMultiKernelGenome(2);
      const clone = cloneMultiKernelGenome(original);

      // Modify clone
      clone.T = original.T + 1;
      clone.R[0] = original.R[0] + 1;
      clone.b[0][0] = original.b[0][0] + 0.1;

      // Original should be unchanged
      expect(original.T).not.toBe(clone.T);
      expect(original.R[0]).not.toBe(clone.R[0]);
      expect(original.b[0][0]).not.toBe(clone.b[0][0]);
    });

    it("preserves all values", () => {
      const original = randomMultiKernelGenome(3);
      const clone = cloneMultiKernelGenome(original);

      expect(clone.T).toBe(original.T);
      expect(clone.kernelCount).toBe(original.kernelCount);
      expect(clone.combinationMode).toBe(original.combinationMode);
      expect(clone.R).toEqual(original.R);
      expect(clone.h).toEqual(original.h);
      expect(clone.m).toEqual(original.m);
      expect(clone.s).toEqual(original.s);
      expect(clone.kn).toEqual(original.kn);
      expect(clone.gn).toEqual(original.gn);

      for (let i = 0; i < original.b.length; i++) {
        expect(clone.b[i]).toEqual(original.b[i]);
      }
    });
  });

  describe("mutateMultiKernelGenome", () => {
    it("returns genome with same structure at low mutation rate", () => {
      const original = randomMultiKernelGenome(2);
      const mutated = mutateMultiKernelGenome(original, 0);

      expect(mutated.kernelCount).toBe(original.kernelCount);
      expect(mutated.R.length).toBe(original.R.length);
    });

    it("can modify values at high mutation rate", () => {
      const original = randomMultiKernelGenome(2);

      // Run multiple mutations to ensure some change happens
      let anyChange = false;
      for (let i = 0; i < 10; i++) {
        const mutated = mutateMultiKernelGenome(original, 1.0);
        if (
          mutated.T !== original.T ||
          mutated.R[0] !== original.R[0] ||
          mutated.m[0] !== original.m[0]
        ) {
          anyChange = true;
          break;
        }
      }

      expect(anyChange).toBe(true);
    });

    it("keeps values within valid ranges", () => {
      const original = randomMultiKernelGenome(2);
      const mutated = mutateMultiKernelGenome(original, 0.5);

      expect(mutated.T).toBeGreaterThanOrEqual(MULTIKERNEL_GENOME_RANGES.T.min);
      expect(mutated.T).toBeLessThanOrEqual(MULTIKERNEL_GENOME_RANGES.T.max);

      for (let i = 0; i < mutated.kernelCount; i++) {
        expect(mutated.R[i]).toBeGreaterThanOrEqual(
          MULTIKERNEL_GENOME_RANGES.R.min,
        );
        expect(mutated.R[i]).toBeLessThanOrEqual(
          MULTIKERNEL_GENOME_RANGES.R.max,
        );
        expect(mutated.h[i]).toBeGreaterThanOrEqual(
          MULTIKERNEL_GENOME_RANGES.h.min,
        );
        expect(mutated.h[i]).toBeLessThanOrEqual(
          MULTIKERNEL_GENOME_RANGES.h.max,
        );
        expect(mutated.m[i]).toBeGreaterThanOrEqual(
          MULTIKERNEL_GENOME_RANGES.m.min,
        );
        expect(mutated.m[i]).toBeLessThanOrEqual(
          MULTIKERNEL_GENOME_RANGES.m.max,
        );
        expect(mutated.s[i]).toBeGreaterThanOrEqual(
          MULTIKERNEL_GENOME_RANGES.s.min,
        );
        expect(mutated.s[i]).toBeLessThanOrEqual(
          MULTIKERNEL_GENOME_RANGES.s.max,
        );
      }
    });

    it("keeps peaks sorted", () => {
      const original = randomMultiKernelGenome(2);
      const mutated = mutateMultiKernelGenome(original, 0.5);

      for (const peaks of mutated.b) {
        for (let i = 1; i < peaks.length; i++) {
          expect(peaks[i]).toBeGreaterThanOrEqual(peaks[i - 1]);
        }
      }
    });

    it("can add or remove kernels at high mutation rate", () => {
      // Run multiple trials to detect structural changes
      let kernelCountChanged = false;

      for (let trial = 0; trial < 50; trial++) {
        const original = randomMultiKernelGenome(2);
        const mutated = mutateMultiKernelGenome(original, 1.0);

        if (mutated.kernelCount !== original.kernelCount) {
          kernelCountChanged = true;
          expect(mutated.R.length).toBe(mutated.kernelCount);
          expect(mutated.b.length).toBe(mutated.kernelCount);
          expect(mutated.h.length).toBe(mutated.kernelCount);
          expect(mutated.m.length).toBe(mutated.kernelCount);
          expect(mutated.s.length).toBe(mutated.kernelCount);
          expect(mutated.kn.length).toBe(mutated.kernelCount);
          expect(mutated.gn.length).toBe(mutated.kernelCount);
          break;
        }
      }

      expect(kernelCountChanged).toBe(true);
    });
  });

  describe("crossoverMultiKernelGenomes", () => {
    it("produces child with valid structure", () => {
      const parent1 = randomMultiKernelGenome(2);
      const parent2 = randomMultiKernelGenome(3);
      const child = crossoverMultiKernelGenomes(parent1, parent2);

      expect(child.R.length).toBe(child.kernelCount);
      expect(child.b.length).toBe(child.kernelCount);
      expect(child.h.length).toBe(child.kernelCount);
      expect(child.m.length).toBe(child.kernelCount);
      expect(child.s.length).toBe(child.kernelCount);
      expect(child.kn.length).toBe(child.kernelCount);
      expect(child.gn.length).toBe(child.kernelCount);
    });

    it("averages kernel count", () => {
      const parent1 = randomMultiKernelGenome(2);
      const parent2 = randomMultiKernelGenome(4);
      const child = crossoverMultiKernelGenomes(parent1, parent2);

      // Average of 2 and 4 is 3
      expect(child.kernelCount).toBe(3);
    });

    it("produces values within valid ranges", () => {
      const parent1 = randomMultiKernelGenome(2);
      const parent2 = randomMultiKernelGenome(3);
      const child = crossoverMultiKernelGenomes(parent1, parent2);

      expect(child.T).toBeGreaterThanOrEqual(MULTIKERNEL_GENOME_RANGES.T.min);
      expect(child.T).toBeLessThanOrEqual(MULTIKERNEL_GENOME_RANGES.T.max);

      for (let i = 0; i < child.kernelCount; i++) {
        expect(child.R[i]).toBeGreaterThanOrEqual(
          MULTIKERNEL_GENOME_RANGES.R.min,
        );
        expect(child.R[i]).toBeLessThanOrEqual(MULTIKERNEL_GENOME_RANGES.R.max);
      }
    });

    it("blends continuous parameters", () => {
      // Create parents with known distinct values
      const parent1: MultiKernelGenome = {
        T: 10,
        kernelCount: 1,
        combinationMode: 0,
        R: [10],
        b: [[0.5]],
        h: [0.5],
        m: [0.1],
        s: [0.03],
        kn: [1],
        gn: [1],
      };

      const parent2: MultiKernelGenome = {
        T: 20,
        kernelCount: 1,
        combinationMode: 2,
        R: [20],
        b: [[0.8]],
        h: [1.0],
        m: [0.3],
        s: [0.06],
        kn: [3],
        gn: [2],
      };

      const child = crossoverMultiKernelGenomes(parent1, parent2);

      // BLX-alpha blend with alpha=0.5 extends 50% beyond parent range
      // For T: parents 10-20, range=10, extension=5, so [5, 25] but clamped to MULTIKERNEL_GENOME_RANGES
      // For R: parents 10-20, range=10, extension=5, so [5, 25] but clamped to valid range
      expect(child.T).toBeGreaterThanOrEqual(5);
      expect(child.T).toBeLessThanOrEqual(25);
      expect(child.R[0]).toBeGreaterThanOrEqual(5);
      expect(child.R[0]).toBeLessThanOrEqual(30); // Max radius in MULTIKERNEL_GENOME_RANGES
    });
  });

  describe("multiKernelGenomeToConfig", () => {
    it("converts genome to valid config", () => {
      const genome = randomMultiKernelGenome(2);
      const config = multiKernelGenomeToConfig(genome);

      expect(config.kernels.length).toBe(genome.kernelCount);
      expect(config.growthParams.length).toBe(genome.kernelCount);
      expect(config.dt).toBeCloseTo(1 / genome.T, 6);
    });

    it("maps kernel types correctly", () => {
      const genome: MultiKernelGenome = {
        T: 10,
        kernelCount: 2,
        combinationMode: 0,
        R: [13, 10],
        b: [[0.5], [0.3, 0.7]],
        h: [0.6, 0.4],
        m: [0.12, 0.15],
        s: [0.04, 0.05],
        kn: [1, 4], // 1=polynomial, 4=gaussian
        gn: [1, 2], // 1=polynomial, 2=gaussian
      };

      const config = multiKernelGenomeToConfig(genome);

      expect(config.kernels[0].shape).toBe("polynomial");
      expect(config.kernels[1].shape).toBe("gaussian");
      expect(config.growthParams[0].type).toBe("polynomial");
      expect(config.growthParams[1].type).toBe("gaussian");
    });

    it("maps combination modes correctly", () => {
      for (let mode = 0; mode <= 2; mode++) {
        const genome = randomMultiKernelGenome(1);
        genome.combinationMode = mode;

        const config = multiKernelGenomeToConfig(genome);
        const expected = ["sum", "average", "weighted"][mode];

        expect(config.combinationMode).toBe(expected);
      }
    });

    it("preserves kernel parameters", () => {
      const genome = randomMultiKernelGenome(2);
      const config = multiKernelGenomeToConfig(genome);

      for (let i = 0; i < genome.kernelCount; i++) {
        expect(config.kernels[i].radius).toBe(genome.R[i]);
        expect(config.kernels[i].peaks).toEqual(genome.b[i]);
        expect(config.kernels[i].weight).toBe(genome.h[i]);
        expect(config.growthParams[i].mu).toBe(genome.m[i]);
        expect(config.growthParams[i].sigma).toBe(genome.s[i]);
      }
    });
  });

  describe("encodeMultiKernelGenome / decodeMultiKernelGenome", () => {
    it("round-trips genome correctly", () => {
      const original = randomMultiKernelGenome(3);
      const encoded = encodeMultiKernelGenome(original);
      const decoded = decodeMultiKernelGenome(encoded);

      expect(decoded.T).toBe(original.T);
      expect(decoded.kernelCount).toBe(original.kernelCount);
      expect(decoded.combinationMode).toBe(original.combinationMode);
      expect(decoded.R).toEqual(original.R);
      expect(decoded.kn).toEqual(original.kn);
      expect(decoded.gn).toEqual(original.gn);

      // Floating point values should be close (3-4 decimal precision)
      for (let i = 0; i < original.kernelCount; i++) {
        expect(decoded.h[i]).toBeCloseTo(original.h[i], 2);
        expect(decoded.m[i]).toBeCloseTo(original.m[i], 3);
        expect(decoded.s[i]).toBeCloseTo(original.s[i], 3);

        for (let j = 0; j < original.b[i].length; j++) {
          expect(decoded.b[i][j]).toBeCloseTo(original.b[i][j], 2);
        }
      }
    });

    it("produces compact encoded string", () => {
      const genome = randomMultiKernelGenome(2);
      const encoded = encodeMultiKernelGenome(genome);

      // Should be base64 encoded and reasonably compact
      expect(typeof encoded).toBe("string");
      expect(encoded.length).toBeLessThan(500);
    });

    it("handles single kernel genome", () => {
      const original = randomMultiKernelGenome(1);
      const encoded = encodeMultiKernelGenome(original);
      const decoded = decodeMultiKernelGenome(encoded);

      expect(decoded.kernelCount).toBe(1);
      expect(decoded.R.length).toBe(1);
    });

    it("handles max kernels genome", () => {
      const original = randomMultiKernelGenome(4);
      const encoded = encodeMultiKernelGenome(original);
      const decoded = decodeMultiKernelGenome(encoded);

      expect(decoded.kernelCount).toBe(4);
      expect(decoded.R.length).toBe(4);
    });
  });
});
