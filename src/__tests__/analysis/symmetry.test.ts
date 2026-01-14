/**
 * Tests for Advanced Symmetry Analysis
 */

import { describe, it, expect } from 'vitest';
import {
  calculateCenterOfMass,
  createPolarRepresentation,
  calculateKFoldSymmetry,
  calculateReflectionSymmetry,
  calculateRotationalSymmetry,
  analyzeSymmetry,
  quickSymmetryScore,
  detectSymmetryType,
  DEFAULT_SYMMETRY_CONFIG,
} from '../../analysis/symmetry';

describe('Symmetry Analysis', () => {
  describe('calculateCenterOfMass', () => {
    it('returns center for empty grid', () => {
      const state = new Float32Array(100);
      const { x, y, mass } = calculateCenterOfMass(state, 10, 10);
      expect(x).toBe(5);
      expect(y).toBe(5);
      expect(mass).toBe(0);
    });

    it('finds center for single pixel', () => {
      const state = new Float32Array(100);
      state[35] = 1; // (5, 3)
      const { x, y } = calculateCenterOfMass(state, 10, 10);
      expect(x).toBe(5);
      expect(y).toBe(3);
    });

    it('finds weighted center', () => {
      const state = new Float32Array(100);
      state[0] = 1; // (0, 0) weight 1
      state[99] = 1; // (9, 9) weight 1
      const { x, y } = calculateCenterOfMass(state, 10, 10);
      expect(x).toBeCloseTo(4.5, 1);
      expect(y).toBeCloseTo(4.5, 1);
    });

    it('weights by value', () => {
      const state = new Float32Array(100);
      state[0] = 1; // (0, 0) weight 1
      state[99] = 3; // (9, 9) weight 3
      const { x, y, mass } = calculateCenterOfMass(state, 10, 10);
      expect(x).toBeCloseTo(6.75, 1); // (0*1 + 9*3) / 4 = 6.75
      expect(y).toBeCloseTo(6.75, 1);
      expect(mass).toBe(4);
    });
  });

  describe('createPolarRepresentation', () => {
    it('creates array of correct dimensions', () => {
      const state = new Float32Array(100);
      state[55] = 1;
      const polar = createPolarRepresentation(
        state, 10, 10,
        { x: 5, y: 5 },
        DEFAULT_SYMMETRY_CONFIG
      );

      expect(polar).toHaveLength(DEFAULT_SYMMETRY_CONFIG.radialBins);
      expect(polar[0]).toHaveLength(DEFAULT_SYMMETRY_CONFIG.angularBins);
    });

    it('captures symmetric pattern', () => {
      const width = 20;
      const height = 20;
      const state = new Float32Array(width * height);
      const center = { x: 10, y: 10 };

      // Create 4-fold symmetric cross
      for (let i = -3; i <= 3; i++) {
        state[(center.y) * width + (center.x + i)] = 1;
        state[(center.y + i) * width + center.x] = 1;
      }

      const polar = createPolarRepresentation(state, width, height, center, DEFAULT_SYMMETRY_CONFIG);

      // Should have non-zero values in polar representation
      const hasValues = polar.some(ring => ring.some(v => v > 0));
      expect(hasValues).toBe(true);
    });
  });

  describe('calculateKFoldSymmetry', () => {
    it('detects no symmetry for random pattern', () => {
      const angularBins = 360;
      const radialBins = 10;
      const polar: Float32Array[] = [];

      // Create random pattern
      for (let r = 0; r < radialBins; r++) {
        const ring = new Float32Array(angularBins);
        for (let t = 0; t < angularBins; t++) {
          ring[t] = Math.random();
        }
        polar.push(ring);
      }

      // k=1 should be low for random
      const sym1 = calculateKFoldSymmetry(polar, 1);
      expect(sym1).toBeLessThan(0.5);
    });

    it('detects 4-fold symmetry', () => {
      const angularBins = 360;
      const radialBins = 10;
      const polar: Float32Array[] = [];

      // Create 4-fold symmetric pattern
      for (let r = 0; r < radialBins; r++) {
        const ring = new Float32Array(angularBins);
        for (let t = 0; t < angularBins; t++) {
          // Value peaks every 90 degrees
          const angle = (t / angularBins) * 2 * Math.PI;
          ring[t] = Math.cos(4 * angle) * 0.5 + 0.5;
        }
        polar.push(ring);
      }

      const sym4 = calculateKFoldSymmetry(polar, 4);
      expect(sym4).toBeGreaterThan(0.5);
    });

    it('distinguishes different symmetry orders', () => {
      const angularBins = 360;
      const radialBins = 10;
      const polar: Float32Array[] = [];

      // Create 6-fold symmetric pattern
      for (let r = 0; r < radialBins; r++) {
        const ring = new Float32Array(angularBins);
        for (let t = 0; t < angularBins; t++) {
          const angle = (t / angularBins) * 2 * Math.PI;
          ring[t] = Math.cos(6 * angle) * 0.5 + 0.5;
        }
        polar.push(ring);
      }

      const sym6 = calculateKFoldSymmetry(polar, 6);
      const sym4 = calculateKFoldSymmetry(polar, 4);

      expect(sym6).toBeGreaterThan(sym4);
    });
  });

  describe('calculateReflectionSymmetry', () => {
    it('detects horizontal symmetry', () => {
      const width = 10;
      const height = 10;
      const state = new Float32Array(width * height);
      const center = { x: 5, y: 5 };

      // Horizontally symmetric pattern (vertical line)
      for (let y = 2; y < 8; y++) {
        state[y * width + 5] = 1;
      }

      const horizontalSym = calculateReflectionSymmetry(state, width, height, center, Math.PI / 2);
      expect(horizontalSym).toBeGreaterThan(0.8);
    });

    it('detects vertical symmetry', () => {
      const width = 10;
      const height = 10;
      const state = new Float32Array(width * height);
      const center = { x: 5, y: 5 };

      // Vertically symmetric pattern (horizontal line)
      for (let x = 2; x < 8; x++) {
        state[5 * width + x] = 1;
      }

      const verticalSym = calculateReflectionSymmetry(state, width, height, center, 0);
      expect(verticalSym).toBeGreaterThan(0.8);
    });

    it('rejects asymmetric pattern', () => {
      const width = 10;
      const height = 10;
      const state = new Float32Array(width * height);
      const center = { x: 5, y: 5 };

      // Asymmetric L shape in one corner
      state[1 * width + 1] = 1;
      state[1 * width + 2] = 1;
      state[2 * width + 1] = 1;

      const horizontalSym = calculateReflectionSymmetry(state, width, height, center, Math.PI / 2);
      expect(horizontalSym).toBeLessThan(0.5);
    });
  });

  describe('calculateRotationalSymmetry', () => {
    it('detects 180° rotational symmetry', () => {
      const width = 10;
      const height = 10;
      const state = new Float32Array(width * height);
      const center = { x: 5, y: 5 };

      // Point symmetric pattern (S shape)
      state[3 * width + 3] = 1;
      state[3 * width + 4] = 1;
      state[5 * width + 5] = 1;
      state[7 * width + 6] = 1;
      state[7 * width + 7] = 1;

      const rotSym = calculateRotationalSymmetry(state, width, height, center);
      expect(rotSym).toBeGreaterThan(0.7);
    });

    it('rejects non-rotationally symmetric pattern', () => {
      const width = 10;
      const height = 10;
      const state = new Float32Array(width * height);
      const center = { x: 5, y: 5 };

      // Asymmetric blob in one corner
      state[1 * width + 1] = 1;
      state[1 * width + 2] = 1;
      state[2 * width + 1] = 1;
      state[2 * width + 2] = 1;

      const rotSym = calculateRotationalSymmetry(state, width, height, center);
      expect(rotSym).toBeLessThan(0.3);
    });
  });

  describe('analyzeSymmetry', () => {
    it('returns complete analysis for symmetric pattern', () => {
      const width = 20;
      const height = 20;
      const state = new Float32Array(width * height);

      // Create symmetric cross
      for (let i = -3; i <= 3; i++) {
        state[(10) * width + (10 + i)] = 1;
        state[(10 + i) * width + 10] = 1;
      }

      const result = analyzeSymmetry(state, width, height);

      expect(result.order).toBeGreaterThanOrEqual(2);
      expect(result.strength).toBeGreaterThan(0);
      expect(result.orderStrengths.size).toBe(DEFAULT_SYMMETRY_CONFIG.maxOrder);
      expect(result.horizontal).toBeGreaterThan(0);
      expect(result.vertical).toBeGreaterThan(0);
      expect(result.rotational180).toBeGreaterThan(0);
    });

    it('handles empty pattern', () => {
      const state = new Float32Array(100);
      const result = analyzeSymmetry(state, 10, 10);

      expect(result.order).toBe(1);
      expect(result.strength).toBe(0);
    });

    it('uses custom config', () => {
      const state = new Float32Array(100);
      state[55] = 1;

      const result = analyzeSymmetry(state, 10, 10, { maxOrder: 4 });
      expect(result.orderStrengths.size).toBe(4);
    });
  });

  describe('quickSymmetryScore', () => {
    it('returns 0 for empty pattern', () => {
      const state = new Float32Array(100);
      const score = quickSymmetryScore(state, 10, 10);
      expect(score).toBe(0);
    });

    it('returns high score for symmetric pattern', () => {
      const width = 20;
      const height = 20;
      const state = new Float32Array(width * height);

      // Cross pattern (highly symmetric)
      for (let i = -4; i <= 4; i++) {
        state[(10) * width + (10 + i)] = 1;
        state[(10 + i) * width + 10] = 1;
      }

      const score = quickSymmetryScore(state, width, height);
      expect(score).toBeGreaterThan(0.7);
    });

    it('returns low score for asymmetric pattern', () => {
      const width = 20;
      const height = 20;
      const state = new Float32Array(width * height);

      // L shape in corner (asymmetric)
      state[2 * width + 2] = 1;
      state[2 * width + 3] = 1;
      state[2 * width + 4] = 1;
      state[3 * width + 2] = 1;
      state[4 * width + 2] = 1;

      const score = quickSymmetryScore(state, width, height);
      expect(score).toBeLessThan(0.5);
    });
  });

  describe('detectSymmetryType', () => {
    it('detects bilateral-horizontal', () => {
      const result = {
        order: 2,
        strength: 0.5,
        orderStrengths: new Map(),
        horizontal: 0.9,
        vertical: 0.3,
        rotational180: 0.5,
        center: { x: 5, y: 5 },
      };

      const types = detectSymmetryType(result);
      expect(types).toContain('bilateral-horizontal');
    });

    it('detects k-fold rotational', () => {
      const result = {
        order: 6,
        strength: 0.8,
        orderStrengths: new Map(),
        horizontal: 0.5,
        vertical: 0.5,
        rotational180: 0.7,
        center: { x: 5, y: 5 },
      };

      const types = detectSymmetryType(result);
      expect(types).toContain('6-fold-rotational');
    });

    it('detects radial symmetry', () => {
      const result = {
        order: 8,
        strength: 0.9,
        orderStrengths: new Map(),
        horizontal: 0.8,
        vertical: 0.8,
        rotational180: 0.9,
        center: { x: 5, y: 5 },
      };

      const types = detectSymmetryType(result);
      expect(types).toContain('radial');
    });

    it('labels asymmetric patterns', () => {
      const result = {
        order: 1,
        strength: 0.1,
        orderStrengths: new Map(),
        horizontal: 0.2,
        vertical: 0.2,
        rotational180: 0.1,
        center: { x: 5, y: 5 },
      };

      const types = detectSymmetryType(result);
      expect(types).toContain('asymmetric');
    });
  });

  describe('DEFAULT_SYMMETRY_CONFIG', () => {
    it('has valid defaults', () => {
      expect(DEFAULT_SYMMETRY_CONFIG.maxOrder).toBeGreaterThan(0);
      expect(DEFAULT_SYMMETRY_CONFIG.angularBins).toBeGreaterThan(0);
      expect(DEFAULT_SYMMETRY_CONFIG.radialBins).toBeGreaterThan(0);
      expect(DEFAULT_SYMMETRY_CONFIG.massThreshold).toBeGreaterThanOrEqual(0);
    });

    it('angular bins divide evenly into circle', () => {
      // 360 bins = 1 degree resolution
      expect(360 % DEFAULT_SYMMETRY_CONFIG.angularBins).toBe(0);
    });
  });
});
