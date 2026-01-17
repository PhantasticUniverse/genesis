/**
 * Statistical Analysis Module Tests
 */

import { describe, it, expect } from "vitest";
import {
  mean,
  std,
  variance,
  sem,
  median,
  percentile,
  iqr,
  skewness,
  kurtosis,
  bootstrapCI,
  bootstrapBCaCI,
  cohensD,
  hedgesG,
  cliffsDelta,
  mannWhitneyU,
  kruskalWallis,
  bonferroniCorrection,
  holmCorrection,
  benjaminiHochbergCorrection,
  normalCDF,
  normalQuantile,
  summarize,
} from "../../analysis/statistics";

describe("Basic Statistics", () => {
  describe("mean", () => {
    it("should compute mean of array", () => {
      expect(mean([1, 2, 3, 4, 5])).toBe(3);
    });

    it("should handle single value", () => {
      expect(mean([42])).toBe(42);
    });

    it("should return NaN for empty array", () => {
      expect(mean([])).toBeNaN();
    });

    it("should handle negative numbers", () => {
      expect(mean([-2, -1, 0, 1, 2])).toBe(0);
    });
  });

  describe("variance", () => {
    it("should compute sample variance (ddof=1)", () => {
      const values = [2, 4, 4, 4, 5, 5, 7, 9];
      // Sample variance = 4.571...
      expect(variance(values)).toBeCloseTo(4.571, 2);
    });

    it("should compute population variance (ddof=0)", () => {
      const values = [2, 4, 4, 4, 5, 5, 7, 9];
      // Population variance = 4
      expect(variance(values, 0)).toBe(4);
    });

    it("should return NaN for insufficient data", () => {
      expect(variance([1])).toBeNaN();
    });
  });

  describe("std", () => {
    it("should compute standard deviation", () => {
      const values = [2, 4, 4, 4, 5, 5, 7, 9];
      expect(std(values, 0)).toBe(2); // Population std
    });
  });

  describe("sem", () => {
    it("should compute standard error of mean", () => {
      const values = [1, 2, 3, 4, 5];
      const s = std(values);
      const expected = s / Math.sqrt(5);
      expect(sem(values)).toBeCloseTo(expected, 10);
    });
  });

  describe("median", () => {
    it("should compute median of odd-length array", () => {
      expect(median([1, 3, 5, 7, 9])).toBe(5);
    });

    it("should compute median of even-length array", () => {
      expect(median([1, 2, 3, 4])).toBe(2.5);
    });

    it("should handle unsorted array", () => {
      expect(median([9, 1, 5, 3, 7])).toBe(5);
    });

    it("should return NaN for empty array", () => {
      expect(median([])).toBeNaN();
    });
  });

  describe("percentile", () => {
    it("should compute 25th percentile (Q1)", () => {
      const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      expect(percentile(values, 25)).toBeCloseTo(3.25, 2);
    });

    it("should compute 50th percentile (median)", () => {
      const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      expect(percentile(values, 50)).toBe(5.5);
    });

    it("should compute 75th percentile (Q3)", () => {
      const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      expect(percentile(values, 75)).toBeCloseTo(7.75, 2);
    });
  });

  describe("iqr", () => {
    it("should compute interquartile range", () => {
      const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const q1 = percentile(values, 25);
      const q3 = percentile(values, 75);
      expect(iqr(values)).toBeCloseTo(q3 - q1, 5);
    });
  });

  describe("skewness", () => {
    it("should return 0 for symmetric distribution", () => {
      const values = [1, 2, 3, 4, 5, 5, 4, 3, 2, 1];
      expect(skewness(values)).toBeCloseTo(0, 1);
    });

    it("should return positive for right-skewed distribution", () => {
      const values = [1, 1, 1, 2, 2, 3, 5, 10, 20];
      expect(skewness(values)).toBeGreaterThan(0);
    });

    it("should return negative for left-skewed distribution", () => {
      const values = [1, 10, 18, 19, 19, 20, 20, 20, 20];
      expect(skewness(values)).toBeLessThan(0);
    });
  });

  describe("kurtosis", () => {
    it("should return near 0 for normal-like distribution", () => {
      // Large sample from approximately normal distribution
      const values = [];
      for (let i = 0; i < 1000; i++) {
        // Box-Muller transform for normal samples
        const u1 = Math.random();
        const u2 = Math.random();
        values.push(Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2));
      }
      // Excess kurtosis of normal is 0
      expect(Math.abs(kurtosis(values))).toBeLessThan(0.5);
    });
  });
});

describe("Bootstrap Confidence Intervals", () => {
  describe("bootstrapCI", () => {
    it("should contain the true mean with high probability", () => {
      const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const ci = bootstrapCI(values, mean, {
        nBootstrap: 1000,
        confidenceLevel: 0.95,
        seed: 42,
      });

      expect(ci.point).toBe(5.5);
      expect(ci.lower).toBeLessThan(ci.point);
      expect(ci.upper).toBeGreaterThan(ci.point);
      expect(ci.confidenceLevel).toBe(0.95);
    });

    it("should produce reproducible results with seed", () => {
      const values = [1, 2, 3, 4, 5];

      const ci1 = bootstrapCI(values, mean, { nBootstrap: 1000, seed: 123 });
      const ci2 = bootstrapCI(values, mean, { nBootstrap: 1000, seed: 123 });

      expect(ci1.lower).toBe(ci2.lower);
      expect(ci1.upper).toBe(ci2.upper);
    });

    it("should narrow with larger sample size", () => {
      const small = [1, 2, 3, 4, 5];
      const large = Array.from({ length: 100 }, (_, i) => (i % 5) + 1);

      const ciSmall = bootstrapCI(small, mean, { nBootstrap: 1000, seed: 42 });
      const ciLarge = bootstrapCI(large, mean, { nBootstrap: 1000, seed: 42 });

      const widthSmall = ciSmall.upper - ciSmall.lower;
      const widthLarge = ciLarge.upper - ciLarge.lower;

      expect(widthLarge).toBeLessThan(widthSmall);
    });
  });

  describe("bootstrapBCaCI", () => {
    it("should produce BCa confidence interval", () => {
      const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const ci = bootstrapBCaCI(values, mean, {
        nBootstrap: 1000,
        confidenceLevel: 0.95,
        seed: 42,
      });

      expect(ci.point).toBe(5.5);
      expect(ci.lower).toBeLessThan(ci.point);
      expect(ci.upper).toBeGreaterThan(ci.point);
    });
  });
});

describe("Effect Sizes", () => {
  describe("cohensD", () => {
    it("should return 0 for identical groups", () => {
      const group1 = [1, 2, 3, 4, 5];
      const group2 = [1, 2, 3, 4, 5];

      const effect = cohensD(group1, group2);
      expect(effect.value).toBeCloseTo(0, 5);
      expect(effect.interpretation).toBe("negligible");
    });

    it("should detect large effect for very different groups", () => {
      const group1 = [1, 2, 3, 4, 5];
      const group2 = [10, 11, 12, 13, 14];

      const effect = cohensD(group1, group2);
      expect(Math.abs(effect.value)).toBeGreaterThan(0.8);
      expect(effect.interpretation).toBe("large");
    });

    it("should return positive when group1 > group2", () => {
      const group1 = [6, 7, 8, 9, 10];
      const group2 = [1, 2, 3, 4, 5];

      const effect = cohensD(group1, group2);
      expect(effect.value).toBeGreaterThan(0);
    });
  });

  describe("hedgesG", () => {
    it("should be similar to Cohen's d for large samples", () => {
      const group1 = Array.from({ length: 100 }, (_, i) => i);
      const group2 = Array.from({ length: 100 }, (_, i) => i + 10);

      const d = cohensD(group1, group2);
      const g = hedgesG(group1, group2);

      // Hedges' g should be slightly smaller (bias correction)
      expect(g.value).toBeCloseTo(d.value, 1);
    });

    it("should differ more from Cohen's d for small samples", () => {
      const group1 = [1, 2, 3, 4, 5];
      const group2 = [6, 7, 8, 9, 10];

      const d = cohensD(group1, group2);
      const g = hedgesG(group1, group2);

      expect(Math.abs(g.value)).toBeLessThan(Math.abs(d.value));
    });
  });

  describe("cliffsDelta", () => {
    it("should return 1 when all group1 > all group2", () => {
      const group1 = [6, 7, 8, 9, 10];
      const group2 = [1, 2, 3, 4, 5];

      const effect = cliffsDelta(group1, group2);
      expect(effect.value).toBe(1);
      expect(effect.interpretation).toBe("large");
    });

    it("should return -1 when all group1 < all group2", () => {
      const group1 = [1, 2, 3, 4, 5];
      const group2 = [6, 7, 8, 9, 10];

      const effect = cliffsDelta(group1, group2);
      expect(effect.value).toBe(-1);
    });

    it("should return 0 for identical groups", () => {
      const group1 = [1, 2, 3, 4, 5];
      const group2 = [1, 2, 3, 4, 5];

      const effect = cliffsDelta(group1, group2);
      expect(effect.value).toBe(0);
      expect(effect.interpretation).toBe("negligible");
    });
  });
});

describe("Statistical Tests", () => {
  describe("mannWhitneyU", () => {
    it("should detect significant difference between very different groups", () => {
      const group1 = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const group2 = [11, 12, 13, 14, 15, 16, 17, 18, 19, 20];

      const result = mannWhitneyU(group1, group2);

      expect(result.pValue).toBeLessThan(0.05);
      expect(result.significant).toBe(true);
    });

    it("should not detect difference for similar groups", () => {
      const group1 = [1, 2, 3, 4, 5];
      const group2 = [2, 3, 4, 5, 6];

      const result = mannWhitneyU(group1, group2);

      expect(result.pValue).toBeGreaterThan(0.05);
      expect(result.significant).toBe(false);
    });

    it("should include effect size in result", () => {
      const group1 = [1, 2, 3, 4, 5];
      const group2 = [6, 7, 8, 9, 10];

      const result = mannWhitneyU(group1, group2);

      expect(result.effectSize).toBeDefined();
      expect(Math.abs(result.effectSize!.value)).toBeGreaterThan(0);
    });
  });

  describe("kruskalWallis", () => {
    it("should detect difference between multiple very different groups", () => {
      const groups = [
        [1, 2, 3, 4, 5],
        [11, 12, 13, 14, 15],
        [21, 22, 23, 24, 25],
      ];

      const result = kruskalWallis(groups);

      expect(result.pValue).toBeLessThan(0.05);
      expect(result.significant).toBe(true);
    });

    it("should not detect difference for similar groups", () => {
      const groups = [
        [1, 2, 3, 4, 5],
        [2, 3, 4, 5, 6],
        [1, 3, 4, 5, 6],
      ];

      const result = kruskalWallis(groups);

      expect(result.pValue).toBeGreaterThan(0.05);
      expect(result.significant).toBe(false);
    });
  });
});

describe("Multiple Comparison Corrections", () => {
  describe("bonferroniCorrection", () => {
    it("should multiply p-values by number of comparisons", () => {
      const pValues = [0.01, 0.02, 0.03, 0.04, 0.05];

      const result = bonferroniCorrection(pValues);

      expect(result.corrected[0]).toBe(0.05); // 0.01 * 5
      expect(result.corrected[1]).toBe(0.1); // 0.02 * 5
    });

    it("should cap corrected values at 1", () => {
      const pValues = [0.1, 0.2, 0.3];

      const result = bonferroniCorrection(pValues);

      expect(result.corrected.every((p) => p <= 1)).toBe(true);
    });
  });

  describe("holmCorrection", () => {
    it("should be less conservative than Bonferroni", () => {
      const pValues = [0.01, 0.02, 0.03, 0.04, 0.05];

      const bonf = bonferroniCorrection(pValues);
      const holm = holmCorrection(pValues);

      // At least some Holm p-values should be smaller
      const holmSmaller = holm.corrected.some(
        (p, i) => p < bonf.corrected[i],
      );
      expect(holmSmaller).toBe(true);
    });

    it("should maintain monotonicity", () => {
      const pValues = [0.001, 0.01, 0.02, 0.05];

      const result = holmCorrection(pValues);

      // Sort corrected p-values and verify order matches original sort
      const sorted = [...result.corrected].sort((a, b) => a - b);
      // Smallest original p should have smallest corrected p
      expect(result.corrected[0]).toBe(sorted[0]);
    });
  });

  describe("benjaminiHochbergCorrection", () => {
    it("should control FDR less conservatively than FWER methods", () => {
      const pValues = [0.01, 0.02, 0.03, 0.04, 0.05];

      const bonf = bonferroniCorrection(pValues);
      const bh = benjaminiHochbergCorrection(pValues);

      // BH should reject more often (less conservative)
      const bonfRejects = bonf.significant.filter(Boolean).length;
      const bhRejects = bh.significant.filter(Boolean).length;

      expect(bhRejects).toBeGreaterThanOrEqual(bonfRejects);
    });
  });
});

describe("Distribution Functions", () => {
  describe("normalCDF", () => {
    it("should return 0.5 at z=0", () => {
      expect(normalCDF(0)).toBeCloseTo(0.5, 5);
    });

    it("should return ~0.84 at z=1", () => {
      expect(normalCDF(1)).toBeCloseTo(0.8413, 2);
    });

    it("should return ~0.975 at z=1.96", () => {
      expect(normalCDF(1.96)).toBeCloseTo(0.975, 2);
    });

    it("should return ~0.999 at z=3", () => {
      expect(normalCDF(3)).toBeCloseTo(0.9987, 2);
    });
  });

  describe("normalQuantile", () => {
    it("should return 0 at p=0.5", () => {
      expect(normalQuantile(0.5)).toBeCloseTo(0, 5);
    });

    it("should return ~1.96 at p=0.975", () => {
      expect(normalQuantile(0.975)).toBeCloseTo(1.96, 2);
    });

    it("should return ~-1.96 at p=0.025", () => {
      expect(normalQuantile(0.025)).toBeCloseTo(-1.96, 2);
    });

    it("should be inverse of normalCDF", () => {
      const z = 1.5;
      const p = normalCDF(z);
      expect(normalQuantile(p)).toBeCloseTo(z, 4);
    });
  });
});

describe("summarize", () => {
  it("should compute all summary statistics", () => {
    const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const summary = summarize(values);

    expect(summary.n).toBe(10);
    expect(summary.mean).toBe(5.5);
    expect(summary.median).toBe(5.5);
    expect(summary.min).toBe(1);
    expect(summary.max).toBe(10);
    expect(summary.ci95).toBeDefined();
    expect(summary.ci95.lower).toBeLessThan(summary.ci95.upper);
  });
});
