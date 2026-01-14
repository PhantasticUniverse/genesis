/**
 * Spatial Index Tests
 * Tests for KD-tree implementation for novelty search
 */

import { describe, it, expect } from 'vitest';
import {
  BehaviorKDTree,
  createBehaviorIndex,
  weightedDistance,
  weightedSquaredDistance,
  BEHAVIOR_WEIGHTS,
} from '../../discovery/spatial-index';
import type { BehaviorVector } from '../../discovery/fitness';

// Helper to create a behavior vector
function createBehavior(values: Partial<BehaviorVector> = {}): BehaviorVector {
  return {
    avgMass: values.avgMass ?? 0,
    massVariance: values.massVariance ?? 0,
    avgSpeed: values.avgSpeed ?? 0,
    avgEntropy: values.avgEntropy ?? 0,
    boundingSize: values.boundingSize ?? 0,
    lifespan: values.lifespan ?? 0,
  };
}

describe('spatial-index', () => {
  describe('BEHAVIOR_WEIGHTS', () => {
    it('has correct weight values', () => {
      expect(BEHAVIOR_WEIGHTS.avgMass).toBe(1);
      expect(BEHAVIOR_WEIGHTS.massVariance).toBe(0.5);
      expect(BEHAVIOR_WEIGHTS.avgSpeed).toBe(1.5);
      expect(BEHAVIOR_WEIGHTS.avgEntropy).toBe(1);
      expect(BEHAVIOR_WEIGHTS.boundingSize).toBe(0.5);
      expect(BEHAVIOR_WEIGHTS.lifespan).toBe(2);
    });
  });

  describe('weightedSquaredDistance', () => {
    it('returns 0 for identical vectors', () => {
      const v = createBehavior({ avgMass: 100, lifespan: 0.5 });
      expect(weightedSquaredDistance(v, v)).toBe(0);
    });

    it('calculates weighted squared distance correctly', () => {
      const v1 = createBehavior({ avgMass: 0 });
      const v2 = createBehavior({ avgMass: 1 });

      // avgMass weight = 1, diff = 1
      // Expected: 1 * 1^2 = 1
      expect(weightedSquaredDistance(v1, v2)).toBe(1);
    });

    it('applies lifespan weight correctly', () => {
      const v1 = createBehavior({ lifespan: 0 });
      const v2 = createBehavior({ lifespan: 1 });

      // lifespan weight = 2, diff = 1
      // Expected: 2 * 1^2 = 2
      expect(weightedSquaredDistance(v1, v2)).toBe(2);
    });

    it('combines multiple dimensions', () => {
      const v1 = createBehavior({ avgMass: 0, avgSpeed: 0 });
      const v2 = createBehavior({ avgMass: 1, avgSpeed: 1 });

      // avgMass: 1 * 1^2 = 1
      // avgSpeed: 1.5 * 1^2 = 1.5
      // Total: 2.5
      expect(weightedSquaredDistance(v1, v2)).toBe(2.5);
    });
  });

  describe('weightedDistance', () => {
    it('returns 0 for identical vectors', () => {
      const v = createBehavior({ avgMass: 100 });
      expect(weightedDistance(v, v)).toBe(0);
    });

    it('returns sqrt of weighted squared distance', () => {
      const v1 = createBehavior({ lifespan: 0 });
      const v2 = createBehavior({ lifespan: 1 });

      // Squared distance = 2, so distance = sqrt(2)
      expect(weightedDistance(v1, v2)).toBeCloseTo(Math.sqrt(2), 10);
    });
  });

  describe('BehaviorKDTree', () => {
    describe('build', () => {
      it('creates empty tree from empty array', () => {
        const tree = BehaviorKDTree.build<{ id: string }>([]);
        expect(tree.isEmpty()).toBe(true);
        expect(tree.getSize()).toBe(0);
      });

      it('creates tree from single item', () => {
        const behavior = createBehavior({ avgMass: 100 });
        const tree = BehaviorKDTree.build([
          { behavior, data: { id: '1' } },
        ]);

        expect(tree.isEmpty()).toBe(false);
        expect(tree.getSize()).toBe(1);
      });

      it('creates balanced tree from multiple items', () => {
        const items = Array.from({ length: 10 }, (_, i) => ({
          behavior: createBehavior({ avgMass: i * 10 }),
          data: { id: String(i) },
        }));

        const tree = BehaviorKDTree.build(items);
        expect(tree.getSize()).toBe(10);
      });
    });

    describe('kNearest', () => {
      it('returns empty array for empty tree', () => {
        const tree = BehaviorKDTree.build<{ id: string }>([]);
        const query = createBehavior();
        const result = tree.kNearest(query, 5);

        expect(result).toEqual([]);
      });

      it('returns k=0 as empty array', () => {
        const tree = BehaviorKDTree.build([
          { behavior: createBehavior(), data: { id: '1' } },
        ]);
        const result = tree.kNearest(createBehavior(), 0);

        expect(result).toEqual([]);
      });

      it('finds single nearest neighbor', () => {
        const items = [
          { behavior: createBehavior({ avgMass: 0 }), data: { id: 'a' } },
          { behavior: createBehavior({ avgMass: 100 }), data: { id: 'b' } },
          { behavior: createBehavior({ avgMass: 50 }), data: { id: 'c' } },
        ];
        const tree = BehaviorKDTree.build(items);

        const query = createBehavior({ avgMass: 45 });
        const result = tree.kNearest(query, 1);

        expect(result).toHaveLength(1);
        expect(result[0].data.id).toBe('c'); // 50 is closest to 45
      });

      it('finds k nearest neighbors in correct order', () => {
        const items = [
          { behavior: createBehavior({ avgMass: 0 }), data: { id: 'a' } },
          { behavior: createBehavior({ avgMass: 100 }), data: { id: 'b' } },
          { behavior: createBehavior({ avgMass: 50 }), data: { id: 'c' } },
          { behavior: createBehavior({ avgMass: 25 }), data: { id: 'd' } },
        ];
        const tree = BehaviorKDTree.build(items);

        const query = createBehavior({ avgMass: 30 });
        const result = tree.kNearest(query, 2);

        expect(result).toHaveLength(2);
        // 25 is closest (diff=5), then 50 (diff=20)
        expect(result[0].data.id).toBe('d');
        expect(result[1].data.id).toBe('c');
      });

      it('returns all items when k > size', () => {
        const items = [
          { behavior: createBehavior({ avgMass: 0 }), data: { id: 'a' } },
          { behavior: createBehavior({ avgMass: 100 }), data: { id: 'b' } },
        ];
        const tree = BehaviorKDTree.build(items);

        const result = tree.kNearest(createBehavior({ avgMass: 50 }), 10);

        expect(result).toHaveLength(2);
      });

      it('excludes items matching predicate', () => {
        const items = [
          { behavior: createBehavior({ avgMass: 0 }), data: { id: 'a' } },
          { behavior: createBehavior({ avgMass: 50 }), data: { id: 'b' } },
          { behavior: createBehavior({ avgMass: 100 }), data: { id: 'c' } },
        ];
        const tree = BehaviorKDTree.build(items);

        const query = createBehavior({ avgMass: 50 });
        // Exclude the exact match
        const result = tree.kNearest(query, 1, (data) => data.id === 'b');

        expect(result).toHaveLength(1);
        expect(result[0].data.id).not.toBe('b');
      });
    });

    describe('noveltyScore', () => {
      it('returns 1 for empty tree', () => {
        const tree = BehaviorKDTree.build<{ id: string }>([]);
        const score = tree.noveltyScore(createBehavior(), 5);

        expect(score).toBe(1);
      });

      it('calculates average distance to k neighbors', () => {
        // Create points at known distances
        const items = [
          { behavior: createBehavior({ avgMass: 10 }), data: { id: 'a' } },
          { behavior: createBehavior({ avgMass: 20 }), data: { id: 'b' } },
          { behavior: createBehavior({ avgMass: 30 }), data: { id: 'c' } },
        ];
        const tree = BehaviorKDTree.build(items);

        const query = createBehavior({ avgMass: 0 });
        const score = tree.noveltyScore(query, 2);

        // k=2 nearest are 10 (dist=10) and 20 (dist=20)
        // Average = (10 + 20) / 2 = 15
        expect(score).toBeCloseTo(15, 5);
      });

      it('excludes self when calculating novelty', () => {
        const items = [
          { behavior: createBehavior({ avgMass: 0 }), data: { id: 'self' } },
          { behavior: createBehavior({ avgMass: 100 }), data: { id: 'other' } },
        ];
        const tree = BehaviorKDTree.build(items);

        const query = createBehavior({ avgMass: 0 });
        const score = tree.noveltyScore(query, 1, (data) => data.id === 'self');

        // Should only find 'other' at distance 100
        expect(score).toBeCloseTo(100, 5);
      });
    });
  });

  describe('createBehaviorIndex', () => {
    it('filters out null behaviors', () => {
      const items = [
        { behavior: createBehavior({ avgMass: 10 }), data: { id: 'a' } },
        { behavior: null, data: { id: 'b' } },
        { behavior: createBehavior({ avgMass: 20 }), data: { id: 'c' } },
      ];

      const tree = createBehaviorIndex(items);

      expect(tree.getSize()).toBe(2);
    });

    it('creates empty tree from all nulls', () => {
      const items = [
        { behavior: null, data: { id: 'a' } },
        { behavior: null, data: { id: 'b' } },
      ];

      const tree = createBehaviorIndex(items);

      expect(tree.isEmpty()).toBe(true);
    });
  });

  describe('performance characteristics', () => {
    it('handles large datasets', () => {
      // Create 1000 random behavior vectors
      const items = Array.from({ length: 1000 }, (_, i) => ({
        behavior: createBehavior({
          avgMass: Math.random() * 1000,
          massVariance: Math.random() * 100,
          avgSpeed: Math.random() * 10,
          avgEntropy: Math.random(),
          boundingSize: Math.random() * 100,
          lifespan: Math.random(),
        }),
        data: { id: String(i) },
      }));

      const tree = BehaviorKDTree.build(items);
      expect(tree.getSize()).toBe(1000);

      // Query should still work
      const query = createBehavior({ avgMass: 500 });
      const result = tree.kNearest(query, 10);

      expect(result).toHaveLength(10);
      // Results should be sorted by distance
      for (let i = 1; i < result.length; i++) {
        expect(result[i].distance).toBeGreaterThanOrEqual(result[i - 1].distance);
      }
    });

    it('produces consistent results with brute force', () => {
      // Create test data
      const items = Array.from({ length: 50 }, (_, i) => ({
        behavior: createBehavior({
          avgMass: i * 20,
          lifespan: i / 50,
        }),
        data: { id: String(i) },
      }));

      const tree = BehaviorKDTree.build(items);
      const query = createBehavior({ avgMass: 500, lifespan: 0.5 });

      // KD-tree result
      const kdResult = tree.kNearest(query, 5);

      // Brute force result
      const bruteForce = items
        .map(item => ({
          ...item,
          distance: weightedDistance(query, item.behavior),
        }))
        .sort((a, b) => a.distance - b.distance)
        .slice(0, 5);

      // Should match
      expect(kdResult.map(r => r.data.id)).toEqual(bruteForce.map(r => r.data.id));
    });
  });
});
