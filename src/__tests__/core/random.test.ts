/**
 * Seeded Random Number Generator Tests
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  setSeed,
  getSeed,
  random,
  randomInt,
  randomFloat,
  randomBool,
  randomChoice,
  randomSample,
  shuffle,
  randomGaussian,
  SeededRNG,
} from "../../core/random";

describe("Seeded RNG", () => {
  describe("setSeed / getSeed", () => {
    it("should set and get the seed", () => {
      const seed = setSeed(12345);
      expect(seed).toBe(12345);
      expect(getSeed()).toBe(12345);
    });

    it("should generate a random seed if none provided", () => {
      const seed1 = setSeed();
      const seed2 = setSeed();
      // Seeds should be different (very high probability)
      expect(typeof seed1).toBe("number");
      expect(typeof seed2).toBe("number");
    });
  });

  describe("reproducibility", () => {
    it("should produce identical sequences with same seed", () => {
      setSeed(42);
      const seq1 = [random(), random(), random(), random(), random()];

      setSeed(42);
      const seq2 = [random(), random(), random(), random(), random()];

      expect(seq1).toEqual(seq2);
    });

    it("should produce different sequences with different seeds", () => {
      setSeed(42);
      const seq1 = [random(), random(), random()];

      setSeed(123);
      const seq2 = [random(), random(), random()];

      expect(seq1).not.toEqual(seq2);
    });
  });

  describe("random()", () => {
    beforeEach(() => {
      setSeed(12345);
    });

    it("should return values in [0, 1)", () => {
      for (let i = 0; i < 1000; i++) {
        const value = random();
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThan(1);
      }
    });

    it("should have roughly uniform distribution", () => {
      const buckets = new Array(10).fill(0);
      const samples = 10000;

      for (let i = 0; i < samples; i++) {
        const bucket = Math.floor(random() * 10);
        buckets[bucket]++;
      }

      // Each bucket should have roughly 10% of samples
      const expected = samples / 10;
      for (const count of buckets) {
        expect(count).toBeGreaterThan(expected * 0.8);
        expect(count).toBeLessThan(expected * 1.2);
      }
    });
  });

  describe("randomInt()", () => {
    beforeEach(() => {
      setSeed(12345);
    });

    it("should return integers in [min, max] inclusive", () => {
      for (let i = 0; i < 100; i++) {
        const value = randomInt(5, 10);
        expect(Number.isInteger(value)).toBe(true);
        expect(value).toBeGreaterThanOrEqual(5);
        expect(value).toBeLessThanOrEqual(10);
      }
    });

    it("should cover all values in range", () => {
      const seen = new Set<number>();
      for (let i = 0; i < 1000; i++) {
        seen.add(randomInt(1, 5));
      }
      expect(seen.size).toBe(5);
      expect(seen.has(1)).toBe(true);
      expect(seen.has(5)).toBe(true);
    });
  });

  describe("randomFloat()", () => {
    beforeEach(() => {
      setSeed(12345);
    });

    it("should return values in [min, max]", () => {
      for (let i = 0; i < 100; i++) {
        const value = randomFloat(2.5, 7.5);
        expect(value).toBeGreaterThanOrEqual(2.5);
        expect(value).toBeLessThanOrEqual(7.5);
      }
    });
  });

  describe("randomBool()", () => {
    beforeEach(() => {
      setSeed(12345);
    });

    it("should return roughly expected probability", () => {
      let trueCount = 0;
      const samples = 10000;

      for (let i = 0; i < samples; i++) {
        if (randomBool(0.3)) trueCount++;
      }

      const observed = trueCount / samples;
      expect(observed).toBeCloseTo(0.3, 1);
    });

    it("should default to 0.5 probability", () => {
      let trueCount = 0;
      const samples = 10000;

      for (let i = 0; i < samples; i++) {
        if (randomBool()) trueCount++;
      }

      const observed = trueCount / samples;
      expect(observed).toBeCloseTo(0.5, 1);
    });
  });

  describe("randomChoice()", () => {
    beforeEach(() => {
      setSeed(12345);
    });

    it("should return element from array", () => {
      const arr = ["a", "b", "c", "d"];
      for (let i = 0; i < 100; i++) {
        const choice = randomChoice(arr);
        expect(arr).toContain(choice);
      }
    });
  });

  describe("randomSample()", () => {
    beforeEach(() => {
      setSeed(12345);
    });

    it("should return n unique elements", () => {
      const arr = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const sample = randomSample(arr, 5);

      expect(sample.length).toBe(5);
      expect(new Set(sample).size).toBe(5);
      for (const item of sample) {
        expect(arr).toContain(item);
      }
    });

    it("should not modify original array", () => {
      const arr = [1, 2, 3, 4, 5];
      const original = [...arr];
      randomSample(arr, 3);
      expect(arr).toEqual(original);
    });
  });

  describe("shuffle()", () => {
    beforeEach(() => {
      setSeed(12345);
    });

    it("should shuffle array in place", () => {
      const arr = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const original = [...arr];
      const result = shuffle(arr);

      expect(result).toBe(arr); // Same reference
      expect(arr).not.toEqual(original); // Order changed
      expect(arr.sort((a, b) => a - b)).toEqual(
        original.sort((a, b) => a - b),
      ); // Same elements
    });

    it("should be reproducible", () => {
      setSeed(42);
      const arr1 = [1, 2, 3, 4, 5];
      shuffle(arr1);

      setSeed(42);
      const arr2 = [1, 2, 3, 4, 5];
      shuffle(arr2);

      expect(arr1).toEqual(arr2);
    });
  });

  describe("randomGaussian()", () => {
    beforeEach(() => {
      setSeed(12345);
    });

    it("should have approximately correct mean and stdDev", () => {
      const samples: number[] = [];
      const targetMean = 5;
      const targetStdDev = 2;

      for (let i = 0; i < 10000; i++) {
        samples.push(randomGaussian(targetMean, targetStdDev));
      }

      const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
      const variance =
        samples.reduce((a, b) => a + (b - mean) ** 2, 0) / samples.length;
      const stdDev = Math.sqrt(variance);

      expect(mean).toBeCloseTo(targetMean, 0);
      expect(stdDev).toBeCloseTo(targetStdDev, 0);
    });
  });

  describe("SeededRNG class", () => {
    it("should create independent RNG instances", () => {
      const rng1 = new SeededRNG(42);
      const rng2 = new SeededRNG(42);
      const rng3 = new SeededRNG(123);

      const seq1 = [rng1.random(), rng1.random(), rng1.random()];
      const seq2 = [rng2.random(), rng2.random(), rng2.random()];
      const seq3 = [rng3.random(), rng3.random(), rng3.random()];

      expect(seq1).toEqual(seq2);
      expect(seq1).not.toEqual(seq3);
    });

    it("should not affect global RNG", () => {
      setSeed(100);
      const globalBefore = random();

      const rng = new SeededRNG(42);
      rng.random();
      rng.random();

      setSeed(100);
      const globalAfter = random();

      expect(globalBefore).toBe(globalAfter);
    });

    it("should have all utility methods", () => {
      const rng = new SeededRNG(42);

      expect(rng.random()).toBeLessThan(1);
      expect(rng.randomInt(1, 10)).toBeGreaterThanOrEqual(1);
      expect(rng.randomFloat(0, 1)).toBeLessThan(1);
      expect(typeof rng.randomBool()).toBe("boolean");
      expect(["a", "b", "c"]).toContain(rng.randomChoice(["a", "b", "c"]));
      expect(typeof rng.randomGaussian()).toBe("number");
    });
  });
});
