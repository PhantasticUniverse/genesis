/**
 * Tests for Self-Replication Detection
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  findConnectedComponents,
  calculatePatternSimilarity,
  matchComponents,
  detectReplication,
  createReplicationDetector,
  calculateReplicationFitness,
  type Component,
  type ReplicationConfig,
  DEFAULT_REPLICATION_CONFIG,
} from '../../discovery/replication';

describe('Replication Detection', () => {
  describe('findConnectedComponents', () => {
    it('finds single component', () => {
      const width = 10;
      const height = 10;
      const state = new Float32Array(width * height);

      // Create a 3x3 blob in the center
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          state[(5 + dy) * width + (5 + dx)] = 0.5;
        }
      }

      const components = findConnectedComponents(state, width, height, 0.1);
      expect(components).toHaveLength(1);
      expect(components[0].pixels).toHaveLength(9);
    });

    it('finds multiple separate components', () => {
      const width = 20;
      const height = 10;
      const state = new Float32Array(width * height);

      // Component 1 at (3, 5)
      state[5 * width + 3] = 0.5;
      state[5 * width + 4] = 0.5;

      // Component 2 at (15, 5) - far from first
      state[5 * width + 15] = 0.5;
      state[5 * width + 16] = 0.5;

      const components = findConnectedComponents(state, width, height, 0.1);
      expect(components).toHaveLength(2);
    });

    it('connects diagonally adjacent pixels (8-connectivity)', () => {
      const width = 10;
      const height = 10;
      const state = new Float32Array(width * height);

      // Diagonal line
      state[3 * width + 3] = 0.5;
      state[4 * width + 4] = 0.5;
      state[5 * width + 5] = 0.5;

      const components = findConnectedComponents(state, width, height, 0.1);
      expect(components).toHaveLength(1);
      expect(components[0].pixels).toHaveLength(3);
    });

    it('calculates centroid correctly', () => {
      const width = 10;
      const height = 10;
      const state = new Float32Array(width * height);

      // Symmetric pattern centered at (5, 5)
      state[5 * width + 4] = 1.0;
      state[5 * width + 5] = 1.0;
      state[5 * width + 6] = 1.0;

      const components = findConnectedComponents(state, width, height, 0.1);
      expect(components[0].centroid.x).toBeCloseTo(5, 1);
      expect(components[0].centroid.y).toBe(5);
    });

    it('calculates mass correctly', () => {
      const width = 10;
      const height = 10;
      const state = new Float32Array(width * height);

      state[5 * width + 5] = 0.3;
      state[5 * width + 6] = 0.7;

      const components = findConnectedComponents(state, width, height, 0.1);
      expect(components[0].mass).toBeCloseTo(1.0, 5);
    });

    it('calculates bounding box correctly', () => {
      const width = 20;
      const height = 20;
      const state = new Float32Array(width * height);

      // L-shaped pattern
      state[5 * width + 3] = 0.5;
      state[5 * width + 4] = 0.5;
      state[5 * width + 5] = 0.5;
      state[6 * width + 3] = 0.5;
      state[7 * width + 3] = 0.5;

      const components = findConnectedComponents(state, width, height, 0.1);
      expect(components[0].bounds.minX).toBe(3);
      expect(components[0].bounds.maxX).toBe(5);
      expect(components[0].bounds.minY).toBe(5);
      expect(components[0].bounds.maxY).toBe(7);
      expect(components[0].bounds.width).toBe(3);
      expect(components[0].bounds.height).toBe(3);
    });

    it('extracts pattern correctly', () => {
      const width = 10;
      const height = 10;
      const state = new Float32Array(width * height);

      // 2x2 pattern
      state[3 * width + 4] = 0.8;
      state[3 * width + 5] = 0.6;
      state[4 * width + 4] = 0.4;
      state[4 * width + 5] = 0.2;

      const components = findConnectedComponents(state, width, height, 0.1);
      expect(components[0].patternWidth).toBe(2);
      expect(components[0].patternHeight).toBe(2);
      expect(components[0].pattern[0]).toBeCloseTo(0.8);
      expect(components[0].pattern[1]).toBeCloseTo(0.6);
    });

    it('respects activation threshold', () => {
      const width = 10;
      const height = 10;
      const state = new Float32Array(width * height);

      state[5 * width + 5] = 0.3;
      state[5 * width + 6] = 0.05; // Below threshold

      const components = findConnectedComponents(state, width, height, 0.1);
      expect(components[0].pixels).toHaveLength(1);
    });

    it('returns empty array for empty state', () => {
      const state = new Float32Array(100);
      const components = findConnectedComponents(state, 10, 10, 0.1);
      expect(components).toHaveLength(0);
    });
  });

  describe('calculatePatternSimilarity', () => {
    it('returns 1 for identical patterns', () => {
      const pattern = new Float32Array([0.5, 0.5, 0.5, 0.5]);
      const similarity = calculatePatternSimilarity(pattern, 2, 2, pattern, 2, 2);
      expect(similarity).toBeGreaterThan(0.95);
    });

    it('returns high similarity for similar patterns', () => {
      const pattern1 = new Float32Array([0.5, 0.5, 0.5, 0.5]);
      const pattern2 = new Float32Array([0.6, 0.5, 0.5, 0.4]);
      const similarity = calculatePatternSimilarity(pattern1, 2, 2, pattern2, 2, 2);
      expect(similarity).toBeGreaterThan(0.7);
    });

    it('returns low similarity for different patterns', () => {
      const pattern1 = new Float32Array([1, 0, 0, 0]);
      const pattern2 = new Float32Array([0, 0, 0, 1]);
      const similarity = calculatePatternSimilarity(pattern1, 2, 2, pattern2, 2, 2);
      expect(similarity).toBeLessThan(0.5);
    });

    it('handles different sized patterns', () => {
      const pattern1 = new Float32Array([0.5, 0.5, 0.5, 0.5]);
      const pattern2 = new Float32Array([0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5]);
      const similarity = calculatePatternSimilarity(pattern1, 2, 2, pattern2, 3, 3);
      expect(similarity).toBeGreaterThan(0.7);
    });

    it('returns 0 for very small patterns', () => {
      const pattern1 = new Float32Array([0.5]);
      const pattern2 = new Float32Array([0.5]);
      const similarity = calculatePatternSimilarity(pattern1, 1, 1, pattern2, 1, 1);
      expect(similarity).toBe(0);
    });
  });

  describe('matchComponents', () => {
    it('matches components by proximity', () => {
      const prev: Component[] = [
        createMockComponent(0, 50, 50, 10),
      ];
      const curr: Component[] = [
        createMockComponent(0, 55, 52, 10), // Close to prev
      ];

      const matches = matchComponents(prev, curr, 20);
      expect(matches.get(0)).toEqual([0]);
    });

    it('detects split (one -> two)', () => {
      const prev: Component[] = [
        createMockComponent(0, 50, 50, 20),
      ];
      const curr: Component[] = [
        createMockComponent(0, 40, 50, 10), // Split left
        createMockComponent(1, 60, 50, 10), // Split right
      ];

      const matches = matchComponents(prev, curr, 30);
      expect(matches.get(0)?.length).toBe(2);
    });

    it('returns empty match for distant components', () => {
      const prev: Component[] = [
        createMockComponent(0, 10, 10, 10),
      ];
      const curr: Component[] = [
        createMockComponent(0, 90, 90, 10), // Far away
      ];

      const matches = matchComponents(prev, curr, 20);
      expect(matches.get(0)).toEqual([]);
    });
  });

  describe('detectReplication', () => {
    it('detects valid replication', () => {
      const parent = createMockComponentWithPattern(0, 50, 50, 20);
      const daughter1 = createMockComponentWithPattern(1, 40, 50, 10);
      const daughter2 = createMockComponentWithPattern(2, 60, 50, 10);

      // Make patterns similar (same pattern for all)
      const pattern = new Float32Array([0.5, 0.5, 0.5, 0.5]);
      parent.pattern = pattern;
      parent.patternWidth = 2;
      parent.patternHeight = 2;
      daughter1.pattern = pattern;
      daughter1.patternWidth = 2;
      daughter1.patternHeight = 2;
      daughter2.pattern = pattern;
      daughter2.patternWidth = 2;
      daughter2.patternHeight = 2;

      const result = detectReplication(parent, [daughter1, daughter2], DEFAULT_REPLICATION_CONFIG);
      expect(result.similarity).toBeGreaterThan(0.9);
      expect(result.parentSimilarity).toBeGreaterThan(0.9);
      expect(result.isReplication).toBe(true);
    });

    it('rejects replication with dissimilar daughters', () => {
      const parent = createMockComponentWithPattern(0, 50, 50, 20);
      const daughter1 = createMockComponentWithPattern(1, 40, 50, 10);
      const daughter2 = createMockComponentWithPattern(2, 60, 50, 10);

      // Different patterns
      daughter1.pattern = new Float32Array([1, 0, 0, 0]);
      daughter2.pattern = new Float32Array([0, 0, 0, 1]);

      const result = detectReplication(parent, [daughter1, daughter2], DEFAULT_REPLICATION_CONFIG);
      expect(result.isReplication).toBe(false);
    });

    it('rejects replication with large mass change', () => {
      const parent = createMockComponentWithPattern(0, 50, 50, 100);
      const daughter1 = createMockComponentWithPattern(1, 40, 50, 10); // Very small
      const daughter2 = createMockComponentWithPattern(2, 60, 50, 10);

      // Same patterns
      const pattern = new Float32Array([0.5, 0.5, 0.5, 0.5]);
      parent.pattern = pattern;
      daughter1.pattern = pattern;
      daughter2.pattern = pattern;

      const config: ReplicationConfig = {
        ...DEFAULT_REPLICATION_CONFIG,
        maxMassRatioChange: 0.2,
      };

      const result = detectReplication(parent, [daughter1, daughter2], config);
      expect(result.isReplication).toBe(false);
    });
  });

  describe('createReplicationDetector', () => {
    let detector: ReturnType<typeof createReplicationDetector>;

    beforeEach(() => {
      detector = createReplicationDetector(100, 100);
    });

    it('tracks components over time', () => {
      // Set lower minMass for this test
      detector.setConfig({ minMass: 1 });

      const state = new Float32Array(100 * 100);

      // Frame 1: Single blob with enough mass
      state[50 * 100 + 50] = 0.5;
      state[50 * 100 + 51] = 0.5;
      state[51 * 100 + 50] = 0.5;
      state[51 * 100 + 51] = 0.5;

      detector.update(state, 0);
      expect(detector.getComponents()).toHaveLength(1);
    });

    it('starts with no events', () => {
      expect(detector.getEvents()).toHaveLength(0);
    });

    it('resets correctly', () => {
      const state = new Float32Array(100 * 100);
      state[50 * 100 + 50] = 0.5;

      detector.update(state, 0);
      detector.reset();

      expect(detector.getComponents()).toHaveLength(0);
      expect(detector.getEvents()).toHaveLength(0);
    });

    it('allows config updates', () => {
      detector.setConfig({ minMass: 5 });
      expect(detector.getConfig().minMass).toBe(5);
    });
  });

  describe('calculateReplicationFitness', () => {
    it('returns 0 for no events', () => {
      expect(calculateReplicationFitness([])).toBe(0);
    });

    it('returns positive score for replication events', () => {
      const events = [
        createMockReplicationEvent(100, 0.8),
      ];
      const fitness = calculateReplicationFitness(events);
      expect(fitness).toBeGreaterThan(0);
    });

    it('increases score for multiple events', () => {
      const oneEvent = [createMockReplicationEvent(100, 0.8)];
      const twoEvents = [
        createMockReplicationEvent(100, 0.8),
        createMockReplicationEvent(200, 0.8),
      ];

      expect(calculateReplicationFitness(twoEvents))
        .toBeGreaterThan(calculateReplicationFitness(oneEvent));
    });

    it('rewards higher similarity', () => {
      const lowSim = [createMockReplicationEvent(100, 0.6)];
      const highSim = [createMockReplicationEvent(100, 0.95)];

      expect(calculateReplicationFitness(highSim))
        .toBeGreaterThan(calculateReplicationFitness(lowSim));
    });

    it('rewards consistent replication intervals', () => {
      // Regular intervals
      const regular = [
        createMockReplicationEvent(100, 0.8),
        createMockReplicationEvent(200, 0.8),
        createMockReplicationEvent(300, 0.8),
      ];

      // Irregular intervals
      const irregular = [
        createMockReplicationEvent(100, 0.8),
        createMockReplicationEvent(150, 0.8),
        createMockReplicationEvent(400, 0.8),
      ];

      expect(calculateReplicationFitness(regular))
        .toBeGreaterThan(calculateReplicationFitness(irregular));
    });

    it('caps fitness at 1', () => {
      const manyEvents = Array.from({ length: 20 }, (_, i) =>
        createMockReplicationEvent(i * 100, 0.99)
      );
      expect(calculateReplicationFitness(manyEvents)).toBeLessThanOrEqual(1);
    });
  });
});

// Helper functions

function createMockComponent(id: number, cx: number, cy: number, mass: number): Component {
  return {
    id,
    pixels: [],
    centroid: { x: cx, y: cy },
    mass,
    bounds: { minX: cx - 5, maxX: cx + 5, minY: cy - 5, maxY: cy + 5, width: 11, height: 11 },
    pattern: new Float32Array(4),
    patternWidth: 2,
    patternHeight: 2,
  };
}

function createMockComponentWithPattern(id: number, cx: number, cy: number, mass: number): Component {
  const component = createMockComponent(id, cx, cy, mass);
  component.pattern = new Float32Array([0.5, 0.5, 0.5, 0.5]);
  return component;
}

function createMockReplicationEvent(step: number, similarity: number) {
  return {
    step,
    parent: createMockComponentWithPattern(0, 50, 50, 20),
    daughters: [
      createMockComponentWithPattern(1, 40, 50, 10),
      createMockComponentWithPattern(2, 60, 50, 10),
    ] as [Component, Component],
    similarity,
    parentSimilarity: similarity * 0.9,
  };
}
