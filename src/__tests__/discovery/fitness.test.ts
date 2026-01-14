/**
 * Fitness Functions Tests
 * Tests core fitness calculations for organism evaluation
 */

import { describe, it, expect } from 'vitest';
import {
  calculateMass,
  calculateCentroid,
  calculateEntropy,
  calculateBoundingBox,
  calculateSymmetry,
  calculateSurvivalFitness,
  calculateStabilityFitness,
  calculateMovementFitness,
  calculateOverallFitness,
  behaviorDistance,
  type BehaviorVector,
} from '../../discovery/fitness';

describe('fitness functions', () => {
  describe('calculateMass', () => {
    it('returns 0 for empty grid', () => {
      const state = new Float32Array(100);
      expect(calculateMass(state)).toBe(0);
    });

    it('sums all values correctly', () => {
      const state = new Float32Array([0.5, 0.5, 1.0, 0]);
      expect(calculateMass(state)).toBe(2.0);
    });

    it('handles single cell with value', () => {
      const state = new Float32Array(100);
      state[50] = 0.75;
      expect(calculateMass(state)).toBe(0.75);
    });

    it('handles full grid', () => {
      const state = new Float32Array(100);
      state.fill(0.1);
      expect(calculateMass(state)).toBeCloseTo(10, 5);
    });
  });

  describe('calculateCentroid', () => {
    it('returns center for empty grid', () => {
      const state = new Float32Array(100);
      const centroid = calculateCentroid(state, 10, 10);
      expect(centroid.x).toBe(5);
      expect(centroid.y).toBe(5);
    });

    it('returns correct position for single point', () => {
      // 5x5 grid with single point at (2, 3)
      const state = new Float32Array(25);
      state[3 * 5 + 2] = 1; // y=3, x=2
      const centroid = calculateCentroid(state, 5, 5);
      expect(centroid.x).toBe(2);
      expect(centroid.y).toBe(3);
    });

    it('returns mass-weighted center for multiple points', () => {
      // 4x4 grid with two points
      const state = new Float32Array(16);
      state[0] = 1; // (0, 0)
      state[15] = 1; // (3, 3)
      const centroid = calculateCentroid(state, 4, 4);
      expect(centroid.x).toBe(1.5);
      expect(centroid.y).toBe(1.5);
    });

    it('weights by value correctly', () => {
      // 4x4 grid with weighted points
      const state = new Float32Array(16);
      state[0] = 3; // (0, 0) weight 3
      state[3] = 1; // (3, 0) weight 1
      const centroid = calculateCentroid(state, 4, 4);
      expect(centroid.x).toBe(0.75); // (3*0 + 1*3) / 4
      expect(centroid.y).toBe(0);
    });
  });

  describe('calculateEntropy', () => {
    it('returns 0 for uniform grid (all zeros)', () => {
      const state = new Float32Array(100);
      const entropy = calculateEntropy(state, 10);
      expect(entropy).toBe(0);
    });

    it('returns 0 for uniform grid (all ones)', () => {
      const state = new Float32Array(100);
      state.fill(1);
      const entropy = calculateEntropy(state, 10);
      // All values in same bin -> entropy = 0
      expect(entropy).toBe(0);
    });

    it('returns high entropy for varied distribution', () => {
      const state = new Float32Array(100);
      // Create varied distribution across bins
      for (let i = 0; i < 100; i++) {
        state[i] = (i % 10) / 10;
      }
      const entropy = calculateEntropy(state, 10);
      expect(entropy).toBeGreaterThan(0.5);
    });

    it('returns maximum entropy for uniform distribution', () => {
      const state = new Float32Array(100);
      // 10 values in each of 10 bins
      for (let i = 0; i < 100; i++) {
        state[i] = (i % 10) / 9.99; // Spread across bins
      }
      const entropy = calculateEntropy(state, 10);
      // Should be close to 1 (maximum normalized entropy)
      expect(entropy).toBeGreaterThan(0.8);
    });
  });

  describe('calculateBoundingBox', () => {
    it('returns correct bounds for single point', () => {
      const state = new Float32Array(100);
      state[55] = 0.5; // (5, 5) in 10x10 grid
      const bbox = calculateBoundingBox(state, 10, 10);
      expect(bbox.minX).toBe(5);
      expect(bbox.maxX).toBe(5);
      expect(bbox.minY).toBe(5);
      expect(bbox.maxY).toBe(5);
      expect(bbox.size).toBe(0);
    });

    it('returns correct bounds for rectangular region', () => {
      const state = new Float32Array(100);
      // Fill 3x2 region starting at (2, 3)
      state[3 * 10 + 2] = 0.5;
      state[3 * 10 + 3] = 0.5;
      state[3 * 10 + 4] = 0.5;
      state[4 * 10 + 2] = 0.5;
      state[4 * 10 + 3] = 0.5;
      state[4 * 10 + 4] = 0.5;

      const bbox = calculateBoundingBox(state, 10, 10);
      expect(bbox.minX).toBe(2);
      expect(bbox.maxX).toBe(4);
      expect(bbox.minY).toBe(3);
      expect(bbox.maxY).toBe(4);
      expect(bbox.size).toBe(2); // max(4-2, 4-3) = 2
    });

    it('ignores values below threshold', () => {
      const state = new Float32Array(100);
      state[0] = 0.005; // Below default threshold of 0.01
      state[99] = 0.5;
      const bbox = calculateBoundingBox(state, 10, 10);
      expect(bbox.minX).toBe(9);
      expect(bbox.maxX).toBe(9);
      expect(bbox.minY).toBe(9);
      expect(bbox.maxY).toBe(9);
    });
  });

  describe('calculateSymmetry', () => {
    it('returns 0 for empty grid', () => {
      const state = new Float32Array(100);
      expect(calculateSymmetry(state, 10, 10)).toBe(0);
    });

    it('returns high score for horizontally symmetric pattern', () => {
      // Create a horizontally symmetric pattern in a 10x10 grid
      // Pattern: vertical line in the center
      const state = new Float32Array(100);
      const centerX = 5;
      for (let y = 2; y < 8; y++) {
        state[y * 10 + centerX] = 1;
        state[y * 10 + (centerX - 1)] = 0.5;
        state[y * 10 + (centerX + 1)] = 0.5;
      }
      const symmetry = calculateSymmetry(state, 10, 10);
      expect(symmetry).toBeGreaterThan(0.6);
    });

    it('returns high score for vertically symmetric pattern', () => {
      // Create a vertically symmetric pattern: horizontal line in the center
      const state = new Float32Array(100);
      const centerY = 5;
      for (let x = 2; x < 8; x++) {
        state[centerY * 10 + x] = 1;
        state[(centerY - 1) * 10 + x] = 0.5;
        state[(centerY + 1) * 10 + x] = 0.5;
      }
      const symmetry = calculateSymmetry(state, 10, 10);
      expect(symmetry).toBeGreaterThan(0.6);
    });

    it('returns high score for rotationally symmetric pattern', () => {
      // Create a 180° rotationally symmetric pattern: diagonal
      const state = new Float32Array(100);
      // Diagonal from (2,2) to (7,7)
      for (let i = 2; i <= 7; i++) {
        state[i * 10 + i] = 1;
      }
      const symmetry = calculateSymmetry(state, 10, 10);
      expect(symmetry).toBeGreaterThan(0.5);
    });

    it('returns high score for perfectly symmetric circle', () => {
      // Create a circular pattern (symmetric in all directions)
      const state = new Float32Array(400); // 20x20 grid
      const centerX = 10;
      const centerY = 10;
      const radius = 4;

      for (let y = 0; y < 20; y++) {
        for (let x = 0; x < 20; x++) {
          const dx = x - centerX;
          const dy = y - centerY;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist <= radius) {
            state[y * 20 + x] = Math.exp(-(dist * dist) / (radius * 2));
          }
        }
      }

      const symmetry = calculateSymmetry(state, 20, 20);
      expect(symmetry).toBeGreaterThan(0.8);
    });

    it('returns lower score for asymmetric pattern', () => {
      // Create an asymmetric L-shaped pattern
      const state = new Float32Array(100);
      // Vertical part of L
      for (let y = 2; y < 8; y++) {
        state[y * 10 + 2] = 1;
      }
      // Horizontal part of L (bottom only)
      for (let x = 2; x < 6; x++) {
        state[7 * 10 + x] = 1;
      }

      const symmetry = calculateSymmetry(state, 10, 10);
      // L shape is less symmetric than circles or crosses
      expect(symmetry).toBeLessThan(0.7);
    });

    it('handles single point', () => {
      const state = new Float32Array(100);
      state[55] = 1; // Single point at (5, 5)
      // Single point has perfect symmetry
      const symmetry = calculateSymmetry(state, 10, 10);
      expect(symmetry).toBe(1);
    });

    it('returns score between 0 and 1', () => {
      // Random pattern
      const state = new Float32Array(100);
      for (let i = 0; i < 100; i++) {
        state[i] = Math.random() > 0.7 ? Math.random() : 0;
      }

      const symmetry = calculateSymmetry(state, 10, 10);
      expect(symmetry).toBeGreaterThanOrEqual(0);
      expect(symmetry).toBeLessThanOrEqual(1);
    });

    it('handles cross pattern with high symmetry', () => {
      // Cross is symmetric horizontally, vertically, and rotationally
      const state = new Float32Array(225); // 15x15 grid
      const center = 7;

      // Vertical bar
      for (let y = 3; y <= 11; y++) {
        state[y * 15 + center] = 1;
      }
      // Horizontal bar
      for (let x = 3; x <= 11; x++) {
        state[center * 15 + x] = 1;
      }

      const symmetry = calculateSymmetry(state, 15, 15);
      expect(symmetry).toBeGreaterThan(0.9);
    });
  });

  describe('calculateSurvivalFitness', () => {
    it('returns 0 for short history', () => {
      const history = [100, 100, 100];
      expect(calculateSurvivalFitness(history, 100, 100)).toBe(0);
    });

    it('returns 1 for perfect survival', () => {
      const history = Array(100).fill(100);
      expect(calculateSurvivalFitness(history, 100)).toBe(1);
    });

    it('returns 0.5 for half survival', () => {
      const history = [
        ...Array(50).fill(100),
        ...Array(50).fill(5), // Below threshold
      ];
      expect(calculateSurvivalFitness(history, 100)).toBe(0.5);
    });

    it('uses threshold of 10% initial mass', () => {
      const history = [
        ...Array(80).fill(15), // Above 10% of 100
        ...Array(20).fill(5),  // Below 10% of 100
      ];
      expect(calculateSurvivalFitness(history, 100)).toBe(0.8);
    });
  });

  describe('calculateStabilityFitness', () => {
    it('returns 0 for short history', () => {
      expect(calculateStabilityFitness([1, 2, 3])).toBe(0);
    });

    it('returns 1 for perfectly stable mass', () => {
      const history = Array(20).fill(100);
      expect(calculateStabilityFitness(history)).toBe(1);
    });

    it('returns low value for high variance', () => {
      const history = [10, 90, 10, 90, 10, 90, 10, 90, 10, 90];
      const fitness = calculateStabilityFitness(history);
      expect(fitness).toBeLessThan(0.3);
    });

    it('returns 0 for zero mean', () => {
      const history = Array(20).fill(0);
      expect(calculateStabilityFitness(history)).toBe(0);
    });
  });

  describe('calculateMovementFitness', () => {
    it('returns 0 for short history', () => {
      const history = [{ x: 0, y: 0 }, { x: 1, y: 1 }];
      expect(calculateMovementFitness(history, 100, 100)).toBe(0);
    });

    it('returns 0 for stationary organism', () => {
      const history = Array(30).fill({ x: 50, y: 50 });
      expect(calculateMovementFitness(history, 100, 100)).toBe(0);
    });

    it('rewards consistent movement', () => {
      // Moving 1 pixel per step consistently
      const history = [];
      for (let i = 0; i < 30; i++) {
        history.push({ x: i, y: 50 });
      }
      const fitness = calculateMovementFitness(history, 100, 100);
      expect(fitness).toBeGreaterThan(0.3);
    });

    it('handles toroidal wrapping', () => {
      // Movement that wraps around
      const history = [
        { x: 98, y: 50 },
        { x: 99, y: 50 },
        { x: 0, y: 50 }, // Wrapped
        { x: 1, y: 50 },
      ];
      // Need 20 points for movement fitness
      while (history.length < 25) {
        history.push({ x: history.length - 3, y: 50 });
      }
      const fitness = calculateMovementFitness(history, 100, 100);
      // Should still calculate reasonable fitness despite wrap
      expect(fitness).toBeGreaterThanOrEqual(0);
    });
  });

  describe('calculateOverallFitness', () => {
    it('combines all metrics with correct weights', () => {
      const metrics = {
        survival: 1,
        stability: 1,
        complexity: 1,
        symmetry: 1,
        movement: 1,
      };

      const result = calculateOverallFitness(metrics);

      // All 1s should give overall of 1
      expect(result.overall).toBe(1);
    });

    it('weights survival highest', () => {
      const highSurvival = calculateOverallFitness({
        survival: 1,
        stability: 0,
        complexity: 0,
        symmetry: 0,
        movement: 0,
      });

      const highSymmetry = calculateOverallFitness({
        survival: 0,
        stability: 0,
        complexity: 0,
        symmetry: 1,
        movement: 0,
      });

      // Survival weight (0.3) > Symmetry weight (0.1)
      expect(highSurvival.overall).toBeGreaterThan(highSymmetry.overall);
    });

    it('preserves original metrics', () => {
      const metrics = {
        survival: 0.8,
        stability: 0.7,
        complexity: 0.6,
        symmetry: 0.5,
        movement: 0.4,
      };

      const result = calculateOverallFitness(metrics);

      expect(result.survival).toBe(0.8);
      expect(result.stability).toBe(0.7);
      expect(result.complexity).toBe(0.6);
      expect(result.symmetry).toBe(0.5);
      expect(result.movement).toBe(0.4);
    });
  });

  describe('behaviorDistance', () => {
    it('returns 0 for identical vectors', () => {
      const v: BehaviorVector = {
        avgMass: 100,
        massVariance: 10,
        avgSpeed: 1,
        avgEntropy: 0.5,
        boundingSize: 50,
        lifespan: 0.8,
      };

      expect(behaviorDistance(v, v)).toBe(0);
    });

    it('calculates weighted Euclidean distance', () => {
      const v1: BehaviorVector = {
        avgMass: 0,
        massVariance: 0,
        avgSpeed: 0,
        avgEntropy: 0,
        boundingSize: 0,
        lifespan: 0,
      };

      const v2: BehaviorVector = {
        avgMass: 1,
        massVariance: 0,
        avgSpeed: 0,
        avgEntropy: 0,
        boundingSize: 0,
        lifespan: 0,
      };

      // Only avgMass differs by 1, weight = 1
      // sqrt(1 * 1^2) = 1
      expect(behaviorDistance(v1, v2)).toBe(1);
    });

    it('applies lifespan weight correctly', () => {
      const v1: BehaviorVector = {
        avgMass: 0,
        massVariance: 0,
        avgSpeed: 0,
        avgEntropy: 0,
        boundingSize: 0,
        lifespan: 0,
      };

      const v2: BehaviorVector = {
        avgMass: 0,
        massVariance: 0,
        avgSpeed: 0,
        avgEntropy: 0,
        boundingSize: 0,
        lifespan: 1,
      };

      // Lifespan weight = 2, diff = 1
      // sqrt(2 * 1^2) = sqrt(2) ≈ 1.414
      expect(behaviorDistance(v1, v2)).toBeCloseTo(Math.sqrt(2), 5);
    });

    it('is symmetric', () => {
      const v1: BehaviorVector = {
        avgMass: 100,
        massVariance: 10,
        avgSpeed: 2,
        avgEntropy: 0.6,
        boundingSize: 30,
        lifespan: 0.9,
      };

      const v2: BehaviorVector = {
        avgMass: 150,
        massVariance: 20,
        avgSpeed: 1,
        avgEntropy: 0.4,
        boundingSize: 40,
        lifespan: 0.7,
      };

      expect(behaviorDistance(v1, v2)).toBe(behaviorDistance(v2, v1));
    });
  });
});
