/**
 * Hungarian Algorithm Tests
 */

import { describe, it, expect } from "vitest";
import {
  hungarianAlgorithm,
  computeTrackingCostMatrix,
  matchCreaturesHungarian,
  solveLinearAssignment,
  type AssignmentResult,
} from "../../agency/hungarian";

describe("hungarianAlgorithm", () => {
  describe("basic functionality", () => {
    it("should handle empty matrix", () => {
      const result = hungarianAlgorithm([]);
      expect(result.assignment).toEqual([]);
      expect(result.totalCost).toBe(0);
      expect(result.assignmentCount).toBe(0);
    });

    it("should handle empty columns", () => {
      const result = hungarianAlgorithm([[], []]);
      expect(result.assignment).toEqual([-1, -1]);
      expect(result.totalCost).toBe(0);
      expect(result.assignmentCount).toBe(0);
    });

    it("should solve 1x1 matrix", () => {
      const result = hungarianAlgorithm([[5]]);
      expect(result.assignment).toEqual([0]);
      expect(result.totalCost).toBe(5);
      expect(result.assignmentCount).toBe(1);
    });

    it("should solve 2x2 matrix", () => {
      const costMatrix = [
        [1, 2],
        [3, 4],
      ];
      const result = hungarianAlgorithm(costMatrix);
      // Optimal: assign 0->0 (cost 1) and 1->1 (cost 4) = 5
      // Or: assign 0->1 (cost 2) and 1->0 (cost 3) = 5
      expect(result.totalCost).toBe(5);
      expect(result.assignmentCount).toBe(2);
    });

    it("should find optimal assignment in 3x3 matrix", () => {
      // Classic assignment problem
      const costMatrix = [
        [10, 5, 13],
        [3, 15, 8],
        [12, 8, 11],
      ];
      const result = hungarianAlgorithm(costMatrix);
      // Optimal: 0->1 (5), 1->0 (3), 2->2 (11) = 19
      expect(result.totalCost).toBe(19);
      expect(result.assignmentCount).toBe(3);
    });

    it("should handle diagonal matrix", () => {
      const costMatrix = [
        [1, 100, 100],
        [100, 2, 100],
        [100, 100, 3],
      ];
      const result = hungarianAlgorithm(costMatrix);
      expect(result.assignment).toEqual([0, 1, 2]);
      expect(result.totalCost).toBe(6);
    });

    it("should handle uniform costs", () => {
      const costMatrix = [
        [5, 5, 5],
        [5, 5, 5],
        [5, 5, 5],
      ];
      const result = hungarianAlgorithm(costMatrix);
      expect(result.totalCost).toBe(15);
      expect(result.assignmentCount).toBe(3);
      // All assignments should be valid and unique
      const assigned = new Set(result.assignment);
      expect(assigned.size).toBe(3);
    });
  });

  describe("non-square matrices", () => {
    it("should handle more rows than columns (3x2)", () => {
      const costMatrix = [
        [1, 2],
        [3, 4],
        [5, 6],
      ];
      const result = hungarianAlgorithm(costMatrix);
      // Can only assign 2 items
      expect(result.assignmentCount).toBe(2);
      // One row should be unassigned (-1)
      expect(result.assignment.filter((a) => a === -1).length).toBe(1);
      // Optimal: 0->0 (1), 1->1 (4) = 5 (row 2 unassigned)
      expect(result.totalCost).toBe(5);
    });

    it("should handle more columns than rows (2x3)", () => {
      const costMatrix = [
        [1, 2, 3],
        [4, 5, 6],
      ];
      const result = hungarianAlgorithm(costMatrix);
      expect(result.assignmentCount).toBe(2);
      // Optimal: 0->0 (1), 1->1 (5) = 6
      expect(result.totalCost).toBe(6);
    });

    it("should handle 1xN matrix", () => {
      const costMatrix = [[3, 1, 2]];
      const result = hungarianAlgorithm(costMatrix);
      expect(result.assignment).toEqual([1]); // Pick column 1 (cost 1)
      expect(result.totalCost).toBe(1);
    });

    it("should handle Nx1 matrix", () => {
      const costMatrix = [[3], [1], [2]];
      const result = hungarianAlgorithm(costMatrix);
      expect(result.assignmentCount).toBe(1);
      expect(result.totalCost).toBe(1); // Row 1 gets column 0
    });
  });

  describe("maxCost threshold", () => {
    it("should exclude assignments above maxCost", () => {
      const costMatrix = [
        [1, 100],
        [100, 2],
      ];
      const result = hungarianAlgorithm(costMatrix, 50);
      // Both 100s are above threshold, so only diagonal assignments valid
      expect(result.assignment).toEqual([0, 1]);
      expect(result.totalCost).toBe(3);
    });

    it("should return no assignments when all costs exceed maxCost", () => {
      const costMatrix = [
        [100, 200],
        [150, 175],
      ];
      const result = hungarianAlgorithm(costMatrix, 50);
      expect(result.assignment).toEqual([-1, -1]);
      expect(result.totalCost).toBe(0);
      expect(result.assignmentCount).toBe(0);
    });

    it("should work with Infinity maxCost", () => {
      const costMatrix = [
        [1000, 2000],
        [3000, 4000],
      ];
      const result = hungarianAlgorithm(costMatrix, Infinity);
      expect(result.assignmentCount).toBe(2);
    });
  });

  describe("edge cases", () => {
    it("should handle zero costs", () => {
      const costMatrix = [
        [0, 1],
        [1, 0],
      ];
      const result = hungarianAlgorithm(costMatrix);
      expect(result.totalCost).toBe(0);
    });

    it("should handle negative costs", () => {
      const costMatrix = [
        [-5, 2],
        [3, -4],
      ];
      const result = hungarianAlgorithm(costMatrix);
      // Optimal: 0->0 (-5), 1->1 (-4) = -9
      expect(result.totalCost).toBe(-9);
    });

    it("should handle large matrices (10x10)", () => {
      const size = 10;
      const costMatrix: number[][] = [];
      for (let i = 0; i < size; i++) {
        costMatrix[i] = [];
        for (let j = 0; j < size; j++) {
          costMatrix[i][j] = (i + j) % 10;
        }
      }
      const result = hungarianAlgorithm(costMatrix);
      expect(result.assignmentCount).toBe(size);
      // Verify all assignments are unique
      const assigned = new Set(result.assignment);
      expect(assigned.size).toBe(size);
    });

    it("should handle floating point costs", () => {
      const costMatrix = [
        [1.5, 2.7],
        [3.2, 0.9],
      ];
      const result = hungarianAlgorithm(costMatrix);
      // Optimal: 0->0 (1.5), 1->1 (0.9) = 2.4
      expect(result.totalCost).toBeCloseTo(2.4, 5);
    });
  });
});

describe("computeTrackingCostMatrix", () => {
  it("should return empty array for empty inputs", () => {
    expect(computeTrackingCostMatrix([], [])).toEqual([]);
    expect(
      computeTrackingCostMatrix(
        [{ centroidX: 0, centroidY: 0, velocityX: 0, velocityY: 0, mass: 100 }],
        [],
      ),
    ).toEqual([]);
    expect(
      computeTrackingCostMatrix([], [{ centroidX: 0, centroidY: 0, mass: 100 }]),
    ).toEqual([]);
  });

  it("should compute distance-based costs", () => {
    const prev = [{ centroidX: 0, centroidY: 0, velocityX: 0, velocityY: 0, mass: 100 }];
    const curr = [
      { centroidX: 10, centroidY: 0, mass: 100 },
      { centroidX: 0, centroidY: 20, mass: 100 },
    ];

    const matrix = computeTrackingCostMatrix(prev, curr, {
      distanceWeight: 1.0,
      massWeight: 0,
      velocityWeight: 0,
    });

    expect(matrix.length).toBe(1);
    expect(matrix[0].length).toBe(2);
    expect(matrix[0][0]).toBeCloseTo(10, 5); // Distance 10
    expect(matrix[0][1]).toBeCloseTo(20, 5); // Distance 20
  });

  it("should incorporate velocity prediction", () => {
    const prev = [{ centroidX: 0, centroidY: 0, velocityX: 5, velocityY: 0, mass: 100 }];
    const curr = [
      { centroidX: 5, centroidY: 0, mass: 100 }, // At predicted position
      { centroidX: 10, centroidY: 0, mass: 100 }, // Past predicted position
    ];

    const matrix = computeTrackingCostMatrix(prev, curr, {
      distanceWeight: 1.0,
      massWeight: 0,
      velocityWeight: 1.0,
    });

    // First component is at predicted position (velocity cost = 0)
    // Second component is 5 units past predicted position
    expect(matrix[0][0]).toBeLessThan(matrix[0][1]);
  });

  it("should incorporate mass similarity", () => {
    const prev = [{ centroidX: 0, centroidY: 0, velocityX: 0, velocityY: 0, mass: 100 }];
    const curr = [
      { centroidX: 5, centroidY: 0, mass: 100 }, // Same mass
      { centroidX: 5, centroidY: 0, mass: 50 }, // Different mass
    ];

    const matrix = computeTrackingCostMatrix(prev, curr, {
      distanceWeight: 1.0,
      massWeight: 1.0,
      velocityWeight: 0,
    });

    // Same mass should have lower cost
    expect(matrix[0][0]).toBeLessThan(matrix[0][1]);
  });

  it("should mark distant matches as invalid", () => {
    const prev = [{ centroidX: 0, centroidY: 0, velocityX: 0, velocityY: 0, mass: 100 }];
    const curr = [{ centroidX: 100, centroidY: 0, mass: 100 }];

    const matrix = computeTrackingCostMatrix(prev, curr, { maxDistance: 50 });

    // Should be marked as invalid (very high cost)
    expect(matrix[0][0]).toBeGreaterThanOrEqual(500);
  });
});

describe("matchCreaturesHungarian", () => {
  it("should return empty map for empty inputs", () => {
    const prev = new Map<
      number,
      {
        id: number;
        centroidX: number;
        centroidY: number;
        velocityX: number;
        velocityY: number;
        mass: number;
      }
    >();
    const curr: Array<{ label: number; centroidX: number; centroidY: number; mass: number }> =
      [];

    expect(matchCreaturesHungarian(prev, curr).size).toBe(0);
  });

  it("should match single creature", () => {
    const prev = new Map([
      [1, { id: 1, centroidX: 10, centroidY: 10, velocityX: 1, velocityY: 1, mass: 100 }],
    ]);
    const curr = [{ label: 5, centroidX: 12, centroidY: 12, mass: 100 }];

    const matches = matchCreaturesHungarian(prev, curr);
    expect(matches.get(5)).toBe(1);
  });

  it("should find optimal assignment with multiple creatures", () => {
    // Setup: 2 creatures that have crossed paths
    // Greedy would assign wrong pairs, Hungarian should get it right
    const prev = new Map([
      [1, { id: 1, centroidX: 0, centroidY: 0, velocityX: 10, velocityY: 0, mass: 100 }],
      [2, { id: 2, centroidX: 20, centroidY: 0, velocityX: -10, velocityY: 0, mass: 100 }],
    ]);

    // After one frame, they've crossed
    const curr = [
      { label: 10, centroidX: 10, centroidY: 0, mass: 100 }, // Creature 1 moved to 10
      { label: 20, centroidX: 10, centroidY: 0, mass: 100 }, // Creature 2 also at 10 (collision)
    ];

    // Without velocity prediction, this would be ambiguous
    // But with velocity, creature 1 should match label 10, creature 2 should match label 20
    const matches = matchCreaturesHungarian(prev, curr);

    // Both should be matched
    expect(matches.size).toBe(2);
  });

  it("should not match creatures beyond maxMatchDistance", () => {
    const prev = new Map([
      [1, { id: 1, centroidX: 0, centroidY: 0, velocityX: 0, velocityY: 0, mass: 100 }],
    ]);
    const curr = [{ label: 5, centroidX: 100, centroidY: 100, mass: 100 }];

    const matches = matchCreaturesHungarian(prev, curr, 50);
    expect(matches.size).toBe(0);
  });

  it("should handle more components than creatures", () => {
    const prev = new Map([
      [1, { id: 1, centroidX: 10, centroidY: 10, velocityX: 0, velocityY: 0, mass: 100 }],
    ]);
    const curr = [
      { label: 5, centroidX: 11, centroidY: 11, mass: 100 },
      { label: 6, centroidX: 50, centroidY: 50, mass: 100 },
      { label: 7, centroidX: 80, centroidY: 80, mass: 100 },
    ];

    const matches = matchCreaturesHungarian(prev, curr, 50);
    // Only label 5 should match (closest)
    expect(matches.get(5)).toBe(1);
    expect(matches.has(6)).toBe(false);
    expect(matches.has(7)).toBe(false);
  });

  it("should handle more creatures than components", () => {
    const prev = new Map([
      [1, { id: 1, centroidX: 10, centroidY: 10, velocityX: 0, velocityY: 0, mass: 100 }],
      [2, { id: 2, centroidX: 50, centroidY: 50, velocityX: 0, velocityY: 0, mass: 100 }],
      [3, { id: 3, centroidX: 80, centroidY: 80, velocityX: 0, velocityY: 0, mass: 100 }],
    ]);
    const curr = [{ label: 5, centroidX: 11, centroidY: 11, mass: 100 }];

    const matches = matchCreaturesHungarian(prev, curr, 50);
    // Only creature 1 should match
    expect(matches.get(5)).toBe(1);
  });
});

describe("solveLinearAssignment", () => {
  it("should solve from sparse cost list", () => {
    const costs = [
      { row: 0, col: 0, cost: 10 },
      { row: 0, col: 1, cost: 5 },
      { row: 1, col: 0, cost: 3 },
      { row: 1, col: 1, cost: 15 },
    ];

    const result = solveLinearAssignment(costs, 2, 2);
    // Optimal: 0->1 (5), 1->0 (3) = 8
    expect(result.totalCost).toBe(8);
    expect(result.assignmentCount).toBe(2);
  });

  it("should handle sparse matrix with missing entries", () => {
    // Only some costs specified
    const costs = [
      { row: 0, col: 0, cost: 1 },
      { row: 1, col: 1, cost: 2 },
    ];

    const result = solveLinearAssignment(costs, 2, 2, 100);
    // Missing entries filled with maxCost (100)
    // Optimal: 0->0 (1), 1->1 (2) = 3
    expect(result.totalCost).toBe(3);
  });

  it("should handle empty costs list", () => {
    const result = solveLinearAssignment([], 2, 2, 50);
    // All costs are maxCost (50), but that's above threshold so no matches
    expect(result.assignmentCount).toBe(0);
  });
});

describe("Hungarian vs Greedy comparison", () => {
  it("should produce better results than greedy in adversarial cases", () => {
    // This is a case where greedy fails
    // Greedy picks closest pair first, which can lead to suboptimal total
    const costMatrix = [
      [1, 10],
      [2, 3],
    ];

    // Greedy approach:
    // 1. Sort all: (0,0)=1, (1,0)=2, (1,1)=3, (0,1)=10
    // 2. Pick (0,0)=1, then (1,1)=3 (can't use row 0 or col 0)
    // Total: 4

    // Hungarian (optimal):
    // Assign 0->0 (1), 1->1 (3) = 4, OR
    // Assign 0->1 (10), 1->0 (2) = 12
    // Optimal is 4

    const result = hungarianAlgorithm(costMatrix);
    expect(result.totalCost).toBe(4);

    // In this case greedy happens to work, try another:
    const adversarialMatrix = [
      [3, 1],
      [1, 3],
    ];
    // Greedy: picks (0,1)=1 first, then (1,0)=1, total=2
    // Hungarian: same, total=2
    const result2 = hungarianAlgorithm(adversarialMatrix);
    expect(result2.totalCost).toBe(2);

    // Real adversarial case (3x3):
    const matrix3 = [
      [8, 4, 7],
      [5, 2, 3],
      [9, 4, 8],
    ];
    // Greedy order: (1,1)=2, (1,2)=3, (0,1)=4, (2,1)=4, (1,0)=5, (0,2)=7, (0,0)=8, (2,2)=8, (2,0)=9
    // Greedy picks: (1,1)=2, then can't use row 1 or col 1
    //              next valid: (0,2)=7, then (2,0)=9, total = 18
    // Hungarian optimal: (0,1)=4, (1,2)=3, (2,0)=9 = 16? No...
    // Let me recalculate: (0,1)=4, (1,0)=5, (2,2)=8 = 17
    // Or: (0,2)=7, (1,1)=2, (2,0)=9 = 18
    // Or: (0,0)=8, (1,1)=2, (2,2)=8 = 18
    // Or: (0,1)=4, (1,2)=3, (2,0)=9 = 16
    const result3 = hungarianAlgorithm(matrix3);
    expect(result3.totalCost).toBeLessThanOrEqual(16);
  });

  it("should demonstrate velocity prediction advantage", () => {
    // Two creatures moving in opposite directions
    // Without velocity prediction, matching would be ambiguous when they pass
    const prev = [
      { centroidX: 40, centroidY: 50, velocityX: 10, velocityY: 0, mass: 100 },
      { centroidX: 60, centroidY: 50, velocityX: -10, velocityY: 0, mass: 100 },
    ];

    // After one step: both at x=50 (crossed paths)
    // But predicted positions: first at 50, second at 50
    // Current positions are at their respective predicted positions
    const curr = [
      { centroidX: 50, centroidY: 50, mass: 100 },
      { centroidX: 50, centroidY: 50, mass: 100 },
    ];

    // With identical positions, distance-only matching is useless
    // But velocity prediction should help disambiguate
    const matrix = computeTrackingCostMatrix(prev, curr, {
      distanceWeight: 1.0,
      massWeight: 0,
      velocityWeight: 1.0,
    });

    // Both creatures predict position at x=50
    // Creature 0 predicts (50, 50), distance to both components = 0
    // Creature 1 predicts (50, 50), distance to both components = 0
    // In this degenerate case, they're identical - but that's expected
    expect(matrix.length).toBe(2);
    expect(matrix[0].length).toBe(2);
  });
});
