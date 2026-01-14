/**
 * Genome Tests
 * Tests for Lenia genome generation, mutation, crossover, and encoding
 */

import { describe, it, expect, vi } from 'vitest';
import {
  randomGenome,
  cloneGenome,
  mutateGenome,
  crossoverGenomes,
  genomeToParams,
  encodeGenome,
  decodeGenome,
  GENOME_RANGES,
  type LeniaGenome,
} from '../../discovery/genome';

describe('genome functions', () => {
  describe('randomGenome', () => {
    it('generates genome within valid ranges', () => {
      // Test multiple times for randomness
      for (let i = 0; i < 10; i++) {
        const genome = randomGenome();

        expect(genome.R).toBeGreaterThanOrEqual(GENOME_RANGES.R.min);
        expect(genome.R).toBeLessThanOrEqual(GENOME_RANGES.R.max);

        expect(genome.T).toBeGreaterThanOrEqual(GENOME_RANGES.T.min);
        expect(genome.T).toBeLessThanOrEqual(GENOME_RANGES.T.max);

        expect(genome.m).toBeGreaterThanOrEqual(GENOME_RANGES.m.min);
        expect(genome.m).toBeLessThanOrEqual(GENOME_RANGES.m.max);

        expect(genome.s).toBeGreaterThanOrEqual(GENOME_RANGES.s.min);
        expect(genome.s).toBeLessThanOrEqual(GENOME_RANGES.s.max);

        expect(genome.kn).toBeGreaterThanOrEqual(1);
        expect(genome.kn).toBeLessThanOrEqual(4);

        expect(genome.gn).toBeGreaterThanOrEqual(1);
        expect(genome.gn).toBeLessThanOrEqual(3);
      }
    });

    it('generates 1-3 peaks', () => {
      const peakCounts = new Set<number>();

      // Generate many genomes to check peak count variety
      for (let i = 0; i < 50; i++) {
        const genome = randomGenome();
        expect(genome.b.length).toBeGreaterThanOrEqual(1);
        expect(genome.b.length).toBeLessThanOrEqual(3);
        peakCounts.add(genome.b.length);
      }

      // Should eventually see different peak counts
      expect(peakCounts.size).toBeGreaterThanOrEqual(2);
    });

    it('sorts peaks in ascending order', () => {
      for (let i = 0; i < 10; i++) {
        const genome = randomGenome();
        for (let j = 1; j < genome.b.length; j++) {
          expect(genome.b[j]).toBeGreaterThanOrEqual(genome.b[j - 1]);
        }
      }
    });

    it('generates peaks within valid range', () => {
      for (let i = 0; i < 10; i++) {
        const genome = randomGenome();
        for (const peak of genome.b) {
          expect(peak).toBeGreaterThanOrEqual(GENOME_RANGES.b.min);
          expect(peak).toBeLessThanOrEqual(GENOME_RANGES.b.max);
        }
      }
    });

    it('generates integer values for R and T', () => {
      for (let i = 0; i < 10; i++) {
        const genome = randomGenome();
        expect(Number.isInteger(genome.R)).toBe(true);
        expect(Number.isInteger(genome.T)).toBe(true);
      }
    });
  });

  describe('cloneGenome', () => {
    it('creates deep copy', () => {
      const original: LeniaGenome = {
        R: 15,
        T: 10,
        b: [0.3, 0.6],
        m: 0.12,
        s: 0.04,
        kn: 1,
        gn: 2,
      };

      const clone = cloneGenome(original);

      // Values should be equal
      expect(clone).toEqual(original);

      // But not the same object
      expect(clone).not.toBe(original);
      expect(clone.b).not.toBe(original.b);
    });

    it('modifications to clone do not affect original', () => {
      const original: LeniaGenome = {
        R: 15,
        T: 10,
        b: [0.3, 0.6],
        m: 0.12,
        s: 0.04,
        kn: 1,
        gn: 2,
      };

      const clone = cloneGenome(original);
      clone.R = 20;
      clone.b.push(0.9);

      expect(original.R).toBe(15);
      expect(original.b.length).toBe(2);
    });
  });

  describe('mutateGenome', () => {
    it('returns genome within valid ranges', () => {
      const genome: LeniaGenome = {
        R: 15,
        T: 10,
        b: [0.5],
        m: 0.12,
        s: 0.04,
        kn: 1,
        gn: 2,
      };

      // Run many mutations to test bounds
      for (let i = 0; i < 50; i++) {
        const mutated = mutateGenome(genome, 1.0); // High mutation rate

        expect(mutated.R).toBeGreaterThanOrEqual(GENOME_RANGES.R.min);
        expect(mutated.R).toBeLessThanOrEqual(GENOME_RANGES.R.max);

        expect(mutated.T).toBeGreaterThanOrEqual(GENOME_RANGES.T.min);
        expect(mutated.T).toBeLessThanOrEqual(GENOME_RANGES.T.max);

        expect(mutated.m).toBeGreaterThanOrEqual(GENOME_RANGES.m.min);
        expect(mutated.m).toBeLessThanOrEqual(GENOME_RANGES.m.max);

        expect(mutated.s).toBeGreaterThanOrEqual(GENOME_RANGES.s.min);
        expect(mutated.s).toBeLessThanOrEqual(GENOME_RANGES.s.max);
      }
    });

    it('does not mutate original genome', () => {
      const original: LeniaGenome = {
        R: 15,
        T: 10,
        b: [0.5],
        m: 0.12,
        s: 0.04,
        kn: 1,
        gn: 2,
      };

      mutateGenome(original, 1.0);

      expect(original.R).toBe(15);
      expect(original.T).toBe(10);
      expect(original.m).toBe(0.12);
    });

    it('keeps peaks sorted after mutation', () => {
      const genome: LeniaGenome = {
        R: 15,
        T: 10,
        b: [0.3, 0.5, 0.7],
        m: 0.12,
        s: 0.04,
        kn: 1,
        gn: 2,
      };

      for (let i = 0; i < 20; i++) {
        const mutated = mutateGenome(genome, 1.0);
        for (let j = 1; j < mutated.b.length; j++) {
          expect(mutated.b[j]).toBeGreaterThanOrEqual(mutated.b[j - 1]);
        }
      }
    });

    it('maintains at least one peak', () => {
      const genome: LeniaGenome = {
        R: 15,
        T: 10,
        b: [0.5],
        m: 0.12,
        s: 0.04,
        kn: 1,
        gn: 2,
      };

      for (let i = 0; i < 50; i++) {
        const mutated = mutateGenome(genome, 1.0);
        expect(mutated.b.length).toBeGreaterThanOrEqual(1);
      }
    });

    it('respects mutation rate of 0', () => {
      const genome: LeniaGenome = {
        R: 15,
        T: 10,
        b: [0.5],
        m: 0.12,
        s: 0.04,
        kn: 1,
        gn: 2,
      };

      const mutated = mutateGenome(genome, 0);

      // With 0 mutation rate, values should be identical
      expect(mutated.R).toBe(15);
      expect(mutated.T).toBe(10);
      expect(mutated.m).toBe(0.12);
      expect(mutated.s).toBe(0.04);
      expect(mutated.kn).toBe(1);
      expect(mutated.gn).toBe(2);
    });
  });

  describe('crossoverGenomes', () => {
    it('produces child within valid ranges', () => {
      const parent1: LeniaGenome = {
        R: 10,
        T: 8,
        b: [0.2],
        m: 0.1,
        s: 0.02,
        kn: 1,
        gn: 1,
      };

      const parent2: LeniaGenome = {
        R: 25,
        T: 15,
        b: [0.8],
        m: 0.3,
        s: 0.06,
        kn: 4,
        gn: 3,
      };

      for (let i = 0; i < 20; i++) {
        const child = crossoverGenomes(parent1, parent2);

        expect(child.R).toBeGreaterThanOrEqual(GENOME_RANGES.R.min);
        expect(child.R).toBeLessThanOrEqual(GENOME_RANGES.R.max);

        expect(child.T).toBeGreaterThanOrEqual(GENOME_RANGES.T.min);
        expect(child.T).toBeLessThanOrEqual(GENOME_RANGES.T.max);

        expect(child.m).toBeGreaterThanOrEqual(GENOME_RANGES.m.min);
        expect(child.m).toBeLessThanOrEqual(GENOME_RANGES.m.max);

        expect(child.s).toBeGreaterThanOrEqual(GENOME_RANGES.s.min);
        expect(child.s).toBeLessThanOrEqual(GENOME_RANGES.s.max);
      }
    });

    it('inherits kn and gn from one parent', () => {
      const parent1: LeniaGenome = {
        R: 15,
        T: 10,
        b: [0.5],
        m: 0.12,
        s: 0.04,
        kn: 1,
        gn: 1,
      };

      const parent2: LeniaGenome = {
        R: 15,
        T: 10,
        b: [0.5],
        m: 0.12,
        s: 0.04,
        kn: 4,
        gn: 3,
      };

      for (let i = 0; i < 20; i++) {
        const child = crossoverGenomes(parent1, parent2);
        expect([1, 4]).toContain(child.kn);
        expect([1, 3]).toContain(child.gn);
      }
    });

    it('averages number of peaks', () => {
      const parent1: LeniaGenome = {
        R: 15,
        T: 10,
        b: [0.3],
        m: 0.12,
        s: 0.04,
        kn: 1,
        gn: 2,
      };

      const parent2: LeniaGenome = {
        R: 15,
        T: 10,
        b: [0.3, 0.5, 0.7],
        m: 0.12,
        s: 0.04,
        kn: 1,
        gn: 2,
      };

      // Average of 1 and 3 = 2
      const child = crossoverGenomes(parent1, parent2);
      expect(child.b.length).toBe(2);
    });

    it('keeps child peaks sorted', () => {
      const parent1: LeniaGenome = {
        R: 15,
        T: 10,
        b: [0.2, 0.4],
        m: 0.12,
        s: 0.04,
        kn: 1,
        gn: 2,
      };

      const parent2: LeniaGenome = {
        R: 15,
        T: 10,
        b: [0.6, 0.8],
        m: 0.12,
        s: 0.04,
        kn: 1,
        gn: 2,
      };

      for (let i = 0; i < 10; i++) {
        const child = crossoverGenomes(parent1, parent2);
        for (let j = 1; j < child.b.length; j++) {
          expect(child.b[j]).toBeGreaterThanOrEqual(child.b[j - 1]);
        }
      }
    });
  });

  describe('genomeToParams', () => {
    it('converts genome to engine parameters correctly', () => {
      const genome: LeniaGenome = {
        R: 13,
        T: 10,
        b: [0.3, 0.6],
        m: 0.12,
        s: 0.04,
        kn: 1,
        gn: 2,
      };

      const params = genomeToParams(genome);

      expect(params.kernelRadius).toBe(13);
      expect(params.growthCenter).toBe(0.12);
      expect(params.growthWidth).toBe(0.04);
      expect(params.dt).toBeCloseTo(0.1, 5); // 1/10
      expect(params.growthType).toBe(1); // gn - 1
      expect(params.peaks).toEqual([0.3, 0.6]);
    });

    it('calculates dt correctly for different T values', () => {
      const genome1: LeniaGenome = {
        R: 13,
        T: 5,
        b: [0.5],
        m: 0.12,
        s: 0.04,
        kn: 1,
        gn: 1,
      };

      const genome2: LeniaGenome = {
        R: 13,
        T: 20,
        b: [0.5],
        m: 0.12,
        s: 0.04,
        kn: 1,
        gn: 1,
      };

      expect(genomeToParams(genome1).dt).toBeCloseTo(0.2, 5); // 1/5
      expect(genomeToParams(genome2).dt).toBeCloseTo(0.05, 5); // 1/20
    });
  });

  describe('encodeGenome / decodeGenome', () => {
    it('round-trips genome correctly', () => {
      const original: LeniaGenome = {
        R: 15,
        T: 10,
        b: [0.3, 0.6],
        m: 0.12,
        s: 0.04,
        kn: 2,
        gn: 3,
      };

      const encoded = encodeGenome(original);
      const decoded = decodeGenome(encoded);

      expect(decoded.R).toBe(original.R);
      expect(decoded.T).toBe(original.T);
      expect(decoded.kn).toBe(original.kn);
      expect(decoded.gn).toBe(original.gn);

      // Floating point values may have small precision differences
      expect(decoded.m).toBeCloseTo(original.m, 3);
      expect(decoded.s).toBeCloseTo(original.s, 3);
      expect(decoded.b.length).toBe(original.b.length);
      for (let i = 0; i < original.b.length; i++) {
        expect(decoded.b[i]).toBeCloseTo(original.b[i], 3);
      }
    });

    it('produces valid base64 string', () => {
      const genome = randomGenome();
      const encoded = encodeGenome(genome);

      // Should be valid base64
      expect(() => atob(encoded)).not.toThrow();
    });

    it('handles single peak', () => {
      const genome: LeniaGenome = {
        R: 13,
        T: 10,
        b: [0.5],
        m: 0.12,
        s: 0.04,
        kn: 1,
        gn: 1,
      };

      const decoded = decodeGenome(encodeGenome(genome));
      expect(decoded.b.length).toBe(1);
      expect(decoded.b[0]).toBeCloseTo(0.5, 3);
    });

    it('handles multiple peaks', () => {
      const genome: LeniaGenome = {
        R: 13,
        T: 10,
        b: [0.2, 0.4, 0.6, 0.8],
        m: 0.12,
        s: 0.04,
        kn: 1,
        gn: 1,
      };

      const decoded = decodeGenome(encodeGenome(genome));
      expect(decoded.b.length).toBe(4);
    });

    it('handles edge case values', () => {
      const genome: LeniaGenome = {
        R: GENOME_RANGES.R.min,
        T: GENOME_RANGES.T.max,
        b: [GENOME_RANGES.b.min, GENOME_RANGES.b.max],
        m: GENOME_RANGES.m.min,
        s: GENOME_RANGES.s.max,
        kn: 4,
        gn: 3,
      };

      const decoded = decodeGenome(encodeGenome(genome));
      expect(decoded.R).toBe(GENOME_RANGES.R.min);
      expect(decoded.T).toBe(GENOME_RANGES.T.max);
      expect(decoded.kn).toBe(4);
      expect(decoded.gn).toBe(3);
    });
  });
});
