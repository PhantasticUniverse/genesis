/**
 * Tests for Period Detection
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  autocorrelation,
  crossCorrelation,
  findAutocorrelationPeaks,
  hashState,
  extractFeatures,
  detectExactPeriod,
  detectPeriodFromFeatures,
  detectPeriod,
  PeriodTracker,
  classifyPeriodBehavior,
  DEFAULT_PERIOD_CONFIG,
  type StateFeatures,
  type PeriodResult,
} from "../../analysis/periodicity";

describe("Period Detection", () => {
  describe("autocorrelation", () => {
    it("returns empty for short series", () => {
      expect(autocorrelation([], 10)).toEqual([]);
      expect(autocorrelation([1], 10)).toEqual([]);
    });

    it("returns 1 for constant series", () => {
      const series = [5, 5, 5, 5, 5, 5];
      const acf = autocorrelation(series, 3);
      expect(acf[0]).toBe(1);
      expect(acf[1]).toBe(1);
    });

    it("detects period-2 oscillation", () => {
      // Alternating: 0, 1, 0, 1, 0, 1, 0, 1
      const series = [0, 1, 0, 1, 0, 1, 0, 1];
      const acf = autocorrelation(series, 4);

      // Lag 1 should be negative (anti-correlated)
      expect(acf[0]).toBeLessThan(0);
      // Lag 2 should be positive (back to original phase)
      expect(acf[1]).toBeGreaterThan(0.5);
    });

    it("detects period-3 pattern", () => {
      // Pattern: 0, 1, 2, 0, 1, 2, 0, 1, 2
      const series = [0, 1, 2, 0, 1, 2, 0, 1, 2];
      const acf = autocorrelation(series, 6);

      // Lag 3 should be highest positive
      expect(acf[2]).toBeGreaterThan(0.9);
    });

    it("respects maxLag parameter", () => {
      const series = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const acf = autocorrelation(series, 5);
      expect(acf).toHaveLength(5);
    });
  });

  describe("crossCorrelation", () => {
    it("returns 0 for empty series", () => {
      expect(crossCorrelation([], [])).toBe(0);
    });

    it("returns 1 for identical series", () => {
      const series = [1, 2, 3, 4, 5];
      expect(crossCorrelation(series, series)).toBeCloseTo(1, 5);
    });

    it("returns -1 for anti-correlated series", () => {
      const series1 = [1, 2, 3, 4, 5];
      const series2 = [5, 4, 3, 2, 1];
      expect(crossCorrelation(series1, series2)).toBeCloseTo(-1, 5);
    });

    it("returns 0 for mismatched lengths", () => {
      expect(crossCorrelation([1, 2, 3], [1, 2])).toBe(0);
    });

    it("returns low correlation for weakly related series", () => {
      // Series with weak linear relationship
      const series1 = [1, 2, 3, 4, 5, 6, 7, 8];
      const series2 = [2, 1, 4, 3, 6, 5, 8, 7]; // Shuffled pairs
      const corr = crossCorrelation(series1, series2);
      // Should be positive but not perfect
      expect(corr).toBeGreaterThan(0);
      expect(corr).toBeLessThan(1);
    });
  });

  describe("findAutocorrelationPeaks", () => {
    it("returns empty for flat ACF", () => {
      const acf = [0.1, 0.1, 0.1, 0.1];
      const peaks = findAutocorrelationPeaks(acf, 0.5);
      expect(peaks).toHaveLength(0);
    });

    it("finds peaks above threshold", () => {
      const acf = [0.2, 0.8, 0.3, 0.9, 0.4];
      const peaks = findAutocorrelationPeaks(acf, 0.5);

      expect(peaks).toHaveLength(2);
      // Sorted by value (highest first)
      expect(peaks[0].value).toBe(0.9);
      expect(peaks[0].lag).toBe(4); // index 3 + 1
    });

    it("respects threshold", () => {
      const acf = [0.4, 0.6, 0.4, 0.55, 0.4];
      const peaksLow = findAutocorrelationPeaks(acf, 0.3);
      const peaksHigh = findAutocorrelationPeaks(acf, 0.7);

      expect(peaksLow.length).toBeGreaterThan(0);
      expect(peaksHigh).toHaveLength(0);
    });
  });

  describe("hashState", () => {
    it("returns same hash for identical states", () => {
      const state = new Float32Array([0.1, 0.2, 0.3, 0.4, 0.5]);
      expect(hashState(state)).toBe(hashState(state));
    });

    it("returns different hash for different states", () => {
      const state1 = new Float32Array([0.1, 0.2, 0.3]);
      const state2 = new Float32Array([0.1, 0.2, 0.4]);
      expect(hashState(state1)).not.toBe(hashState(state2));
    });

    it("handles small floating point differences", () => {
      // Differences smaller than 0.0005 should hash the same (rounds to same integer)
      const state1 = new Float32Array([0.1002, 0.2002, 0.3002]);
      const state2 = new Float32Array([0.1004, 0.2004, 0.3004]);
      expect(hashState(state1)).toBe(hashState(state2));
    });

    it("handles large arrays with sampling", () => {
      const state = new Float32Array(10000);
      state.fill(0.5);
      const hash = hashState(state, 100);
      expect(hash.length).toBeLessThan(1000);
    });
  });

  describe("extractFeatures", () => {
    it("extracts mass correctly", () => {
      const state = new Float32Array([0.5, 0.5, 0, 0]);
      const features = extractFeatures(state, 2, 2);
      expect(features.mass).toBe(1);
    });

    it("calculates centroid correctly", () => {
      const state = new Float32Array(9);
      state[4] = 1; // Center pixel of 3x3
      const features = extractFeatures(state, 3, 3);
      expect(features.centroidX).toBe(1);
      expect(features.centroidY).toBe(1);
    });

    it("handles empty state", () => {
      const state = new Float32Array(9);
      const features = extractFeatures(state, 3, 3);
      expect(features.mass).toBe(0);
      expect(features.centroidX).toBe(1.5);
      expect(features.centroidY).toBe(1.5);
      expect(features.spread).toBe(0);
    });

    it("calculates spread correctly", () => {
      const state = new Float32Array(9);
      state[0] = 1; // Top-left
      state[8] = 1; // Bottom-right
      const features = extractFeatures(state, 3, 3);
      expect(features.spread).toBeGreaterThan(0);
    });
  });

  describe("detectExactPeriod", () => {
    it("returns 0 for too short history", () => {
      const history = [new Float32Array([1])];
      expect(detectExactPeriod(history, 10)).toBe(0);
    });

    it("detects period-1 (static)", () => {
      const state = new Float32Array([0.5, 0.5, 0.5]);
      const history = [state, state, state, state];
      expect(detectExactPeriod(history, 10)).toBe(1);
    });

    it("detects period-2 oscillation", () => {
      const state1 = new Float32Array([0.1, 0.2, 0.3]);
      const state2 = new Float32Array([0.3, 0.2, 0.1]);
      const history = [state1, state2, state1, state2, state1, state2];
      expect(detectExactPeriod(history, 10)).toBe(2);
    });

    it("detects period-3 cycle", () => {
      const state1 = new Float32Array([0.1, 0.0, 0.0]);
      const state2 = new Float32Array([0.0, 0.1, 0.0]);
      const state3 = new Float32Array([0.0, 0.0, 0.1]);
      const history = [state1, state2, state3, state1, state2, state3];
      expect(detectExactPeriod(history, 10)).toBe(3);
    });

    it("returns 0 for non-periodic sequence", () => {
      const history = [
        new Float32Array([0.1, 0.2, 0.3]),
        new Float32Array([0.2, 0.3, 0.4]),
        new Float32Array([0.3, 0.4, 0.5]),
        new Float32Array([0.4, 0.5, 0.6]),
      ];
      expect(detectExactPeriod(history, 10)).toBe(0);
    });

    it("respects maxPeriod", () => {
      const state1 = new Float32Array([0.1]);
      const state2 = new Float32Array([0.2]);
      const state3 = new Float32Array([0.3]);
      const history = [state1, state2, state3, state1, state2, state3];
      // Max period 2 won't find period-3
      expect(detectExactPeriod(history, 2)).toBe(0);
    });
  });

  describe("detectPeriodFromFeatures", () => {
    it("detects static behavior", () => {
      const features: StateFeatures[] = Array(10).fill({
        mass: 100,
        centroidX: 50,
        centroidY: 50,
        spread: 10,
      });

      const result = detectPeriodFromFeatures(features);
      expect(result.behavior).toBe("static");
    });

    it("detects periodic behavior", () => {
      // Create oscillating mass with period-4
      const features: StateFeatures[] = [];
      for (let i = 0; i < 40; i++) {
        features.push({
          mass: 100 + 50 * Math.sin((i * Math.PI) / 2), // Period-4
          centroidX: 50,
          centroidY: 50,
          spread: 10,
        });
      }

      const result = detectPeriodFromFeatures(features);
      expect(result.period).toBe(4);
      // Sinusoidal patterns can show harmonics, accept periodic or quasi-periodic
      expect(["periodic", "quasi-periodic"]).toContain(result.behavior);
    });

    it("returns empty for short history", () => {
      const features: StateFeatures[] = [
        {
          mass: 100,
          centroidX: 50,
          centroidY: 50,
          spread: 10,
        },
      ];

      const result = detectPeriodFromFeatures(features);
      expect(result.period).toBe(0);
      expect(result.behavior).toBe("static");
    });

    it("includes candidates list", () => {
      const features: StateFeatures[] = [];
      for (let i = 0; i < 50; i++) {
        features.push({
          mass: 100 + 30 * Math.sin((i * Math.PI) / 4), // Period-8
          centroidX: 50,
          centroidY: 50,
          spread: 10,
        });
      }

      const result = detectPeriodFromFeatures(features);
      expect(result.candidates.length).toBeGreaterThan(0);
    });
  });

  describe("detectPeriod", () => {
    it("combines exact and correlation detection", () => {
      const state = new Float32Array([0.5, 0.5, 0.5]);
      const history = [state, state, state, state, state];

      const result = detectPeriod(history, 3, 1);
      expect(result.isExactPeriod).toBe(true);
      expect(result.period).toBe(1);
    });

    it("returns exact period when found", () => {
      const state1 = new Float32Array([0.1, 0.2]);
      const state2 = new Float32Array([0.2, 0.1]);
      const history = [state1, state2, state1, state2, state1];

      const result = detectPeriod(history, 2, 1);
      expect(result.isExactPeriod).toBe(true);
      expect(result.period).toBe(2);
      expect(result.confidence).toBe(1);
    });

    it("handles empty history", () => {
      const result = detectPeriod([], 10, 10);
      expect(result.period).toBe(0);
      expect(result.behavior).toBe("static");
    });
  });

  describe("PeriodTracker", () => {
    let tracker: PeriodTracker;

    beforeEach(() => {
      tracker = new PeriodTracker(3, 3);
    });

    it("starts with empty history", () => {
      expect(tracker.historyLength).toBe(0);
    });

    it("tracks states incrementally", () => {
      tracker.push(new Float32Array(9));
      tracker.push(new Float32Array(9));
      expect(tracker.historyLength).toBe(2);
    });

    it("limits history to maxHistory", () => {
      const smallTracker = new PeriodTracker(3, 3, {}, 5);
      for (let i = 0; i < 10; i++) {
        smallTracker.push(new Float32Array(9));
      }
      expect(smallTracker.historyLength).toBe(5);
    });

    it("clears history", () => {
      tracker.push(new Float32Array(9));
      tracker.push(new Float32Array(9));
      tracker.clear();
      expect(tracker.historyLength).toBe(0);
    });

    it("analyzes periodic pattern", () => {
      const state1 = new Float32Array(9);
      state1[0] = 1;
      const state2 = new Float32Array(9);
      state2[8] = 1;

      for (let i = 0; i < 10; i++) {
        tracker.push(i % 2 === 0 ? state1 : state2);
      }

      const result = tracker.analyze();
      expect(result.period).toBe(2);
    });
  });

  describe("classifyPeriodBehavior", () => {
    it("classifies static behavior", () => {
      const result: PeriodResult = {
        period: 0,
        confidence: 1,
        isExactPeriod: false,
        candidates: [],
        behavior: "static",
        autocorrelation: [],
      };
      expect(classifyPeriodBehavior(result)).toContain("Fixed point");
    });

    it("classifies exact period-2", () => {
      const result: PeriodResult = {
        period: 2,
        confidence: 1,
        isExactPeriod: true,
        candidates: [],
        behavior: "periodic",
        autocorrelation: [],
      };
      expect(classifyPeriodBehavior(result)).toContain("Period-2");
    });

    it("classifies approximate period", () => {
      const result: PeriodResult = {
        period: 5,
        confidence: 0.85,
        isExactPeriod: false,
        candidates: [],
        behavior: "periodic",
        autocorrelation: [],
      };
      const classification = classifyPeriodBehavior(result);
      expect(classification).toContain("period-5");
      expect(classification).toContain("85%");
    });

    it("classifies quasi-periodic", () => {
      const result: PeriodResult = {
        period: 5,
        confidence: 0.7,
        isExactPeriod: false,
        candidates: [],
        behavior: "quasi-periodic",
        autocorrelation: [],
      };
      expect(classifyPeriodBehavior(result)).toContain("Quasi-periodic");
    });

    it("classifies chaotic", () => {
      const result: PeriodResult = {
        period: 0,
        confidence: 0,
        isExactPeriod: false,
        candidates: [],
        behavior: "chaotic",
        autocorrelation: [],
      };
      expect(classifyPeriodBehavior(result).toLowerCase()).toContain("chaotic");
    });
  });

  describe("DEFAULT_PERIOD_CONFIG", () => {
    it("has valid defaults", () => {
      expect(DEFAULT_PERIOD_CONFIG.maxPeriod).toBeGreaterThan(0);
      expect(DEFAULT_PERIOD_CONFIG.correlationThreshold).toBeGreaterThan(0);
      expect(DEFAULT_PERIOD_CONFIG.correlationThreshold).toBeLessThanOrEqual(1);
      expect(DEFAULT_PERIOD_CONFIG.staticThreshold).toBeGreaterThan(0);
    });

    it("has exact match enabled by default", () => {
      expect(DEFAULT_PERIOD_CONFIG.checkExactMatch).toBe(true);
    });
  });
});
