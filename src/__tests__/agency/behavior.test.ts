/**
 * Behavior Extraction Tests
 * Tests for trajectory collection and behavior vector extraction
 */

import { describe, it, expect } from 'vitest';
import {
  createTrajectoryCollector,
  updateTrajectories,
  extractBehaviorVector,
  behaviorDistance,
  evaluateGoalFitness,
  calculateFitnessScore,
  type TrajectoryPoint,
  type TrajectoryCollector,
  type BehaviorVector,
} from '../../agency/behavior';
import type { TrackerState } from '../../agency/creature-tracker';

// Helper to create mock tracker state
function mockTrackerState(
  creatures: Array<{
    id: number;
    centroidX: number;
    centroidY: number;
    mass: number;
    velocityX: number;
    velocityY: number;
  }>,
  frame: number
): TrackerState {
  const creaturesMap = new Map();
  for (const c of creatures) {
    creaturesMap.set(c.id, {
      id: c.id,
      centroidX: c.centroidX,
      centroidY: c.centroidY,
      mass: c.mass,
      velocityX: c.velocityX,
      velocityY: c.velocityY,
      boundingBox: { minX: 0, maxX: 10, minY: 0, maxY: 10 },
    });
  }

  return {
    creatures: creaturesMap,
    totalMass: creatures.reduce((sum, c) => sum + c.mass, 0),
    frame,
  } as TrackerState;
}

// Helper to create a simple trajectory
function createTrajectory(
  points: Array<{ x: number; y: number; mass?: number; vx?: number; vy?: number }>
): TrajectoryPoint[] {
  return points.map((p, i) => ({
    frame: i,
    x: p.x,
    y: p.y,
    mass: p.mass ?? 100,
    velocityX: p.vx ?? 0,
    velocityY: p.vy ?? 0,
  }));
}

describe('behavior', () => {
  describe('createTrajectoryCollector', () => {
    it('creates empty collector with correct dimensions', () => {
      const collector = createTrajectoryCollector(256, 256, 500);

      expect(collector.gridWidth).toBe(256);
      expect(collector.gridHeight).toBe(256);
      expect(collector.maxLength).toBe(500);
      expect(collector.trajectories.size).toBe(0);
    });

    it('uses default maxLength when not specified', () => {
      const collector = createTrajectoryCollector(128, 128);

      expect(collector.maxLength).toBe(1000);
    });
  });

  describe('updateTrajectories', () => {
    it('adds trajectory points for new creatures', () => {
      const collector = createTrajectoryCollector(256, 256);
      const tracker = mockTrackerState([
        { id: 1, centroidX: 100, centroidY: 100, mass: 50, velocityX: 1, velocityY: 0 },
      ], 0);

      updateTrajectories(collector, tracker);

      expect(collector.trajectories.size).toBe(1);
      expect(collector.trajectories.get(1)!.length).toBe(1);
    });

    it('appends to existing trajectories', () => {
      const collector = createTrajectoryCollector(256, 256);

      for (let frame = 0; frame < 5; frame++) {
        const tracker = mockTrackerState([
          { id: 1, centroidX: 100 + frame, centroidY: 100, mass: 50, velocityX: 1, velocityY: 0 },
        ], frame);
        updateTrajectories(collector, tracker);
      }

      expect(collector.trajectories.get(1)!.length).toBe(5);
    });

    it('trims trajectories exceeding maxLength', () => {
      const collector = createTrajectoryCollector(256, 256, 3);

      for (let frame = 0; frame < 5; frame++) {
        const tracker = mockTrackerState([
          { id: 1, centroidX: 100 + frame, centroidY: 100, mass: 50, velocityX: 1, velocityY: 0 },
        ], frame);
        updateTrajectories(collector, tracker);
      }

      expect(collector.trajectories.get(1)!.length).toBe(3);
    });

    it('keeps trajectory for recently dead creatures', () => {
      const collector = createTrajectoryCollector(256, 256);

      // Add creature for several frames
      for (let frame = 0; frame < 5; frame++) {
        const tracker = mockTrackerState([
          { id: 1, centroidX: 100, centroidY: 100, mass: 50, velocityX: 0, velocityY: 0 },
        ], frame);
        updateTrajectories(collector, tracker);
      }

      // Creature dies
      const emptyTracker = mockTrackerState([], 5);
      updateTrajectories(collector, emptyTracker);

      // Trajectory should be kept
      expect(collector.trajectories.has(1)).toBe(true);
    });

    it('removes old dead creature trajectories', () => {
      const collector = createTrajectoryCollector(256, 256);

      // Add creature
      const tracker1 = mockTrackerState([
        { id: 1, centroidX: 100, centroidY: 100, mass: 50, velocityX: 0, velocityY: 0 },
      ], 0);
      updateTrajectories(collector, tracker1);

      // Many frames pass with creature gone
      const emptyTracker = mockTrackerState([], 200);
      updateTrajectories(collector, emptyTracker);

      // Trajectory should be removed
      expect(collector.trajectories.has(1)).toBe(false);
    });
  });

  describe('extractBehaviorVector', () => {
    it('returns null for trajectory with less than 2 points', () => {
      const singlePoint = createTrajectory([{ x: 100, y: 100 }]);
      expect(extractBehaviorVector(singlePoint, 256, 256)).toBeNull();

      const empty: TrajectoryPoint[] = [];
      expect(extractBehaviorVector(empty, 256, 256)).toBeNull();
    });

    it('calculates normalized final position', () => {
      const trajectory = createTrajectory([
        { x: 0, y: 0 },
        { x: 128, y: 128 },
      ]);

      const behavior = extractBehaviorVector(trajectory, 256, 256)!;

      expect(behavior.finalX).toBeCloseTo(0.5, 3); // 128/256
      expect(behavior.finalY).toBeCloseTo(0.5, 3);
    });

    it('calculates average position', () => {
      const trajectory = createTrajectory([
        { x: 0, y: 0 },
        { x: 64, y: 64 },
        { x: 128, y: 128 },
      ]);

      const behavior = extractBehaviorVector(trajectory, 256, 256)!;

      // avg = (0 + 64 + 128) / 3 / 256 = 64 / 256 = 0.25
      expect(behavior.avgX).toBeCloseTo(0.25, 3);
      expect(behavior.avgY).toBeCloseTo(0.25, 3);
    });

    it('calculates total distance and displacement', () => {
      const trajectory = createTrajectory([
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 100 },
      ]);

      const behavior = extractBehaviorVector(trajectory, 256, 256)!;

      // Total distance: 100 + 100 = 200
      // Displacement: sqrt(100^2 + 100^2) = 141.42
      expect(behavior.totalDistance).toBeGreaterThan(0);
      expect(behavior.displacement).toBeGreaterThan(0);
      expect(behavior.totalDistance).toBeGreaterThan(behavior.displacement);
    });

    it('calculates path efficiency', () => {
      // Straight line should have efficiency near 1
      const straightLine = createTrajectory([
        { x: 0, y: 0 },
        { x: 50, y: 0 },
        { x: 100, y: 0 },
      ]);

      const straightBehavior = extractBehaviorVector(straightLine, 256, 256)!;
      expect(straightBehavior.pathEfficiency).toBeCloseTo(1, 1);

      // Backtracking should have lower efficiency
      const backtrack = createTrajectory([
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 50, y: 0 },
      ]);

      const backtrackBehavior = extractBehaviorVector(backtrack, 256, 256)!;
      expect(backtrackBehavior.pathEfficiency).toBeLessThan(0.5);
    });

    it('calculates speed metrics', () => {
      const trajectory = createTrajectory([
        { x: 0, y: 0, vx: 1, vy: 0 },
        { x: 10, y: 0, vx: 2, vy: 0 },
        { x: 30, y: 0, vx: 5, vy: 0 },
      ]);

      const behavior = extractBehaviorVector(trajectory, 256, 256)!;

      expect(behavior.avgSpeed).toBeGreaterThan(0);
      expect(behavior.maxSpeed).toBeGreaterThan(behavior.avgSpeed);
    });

    it('calculates mass metrics', () => {
      const trajectory = createTrajectory([
        { x: 0, y: 0, mass: 100 },
        { x: 10, y: 0, mass: 120 },
        { x: 20, y: 0, mass: 80 },
      ]);

      const behavior = extractBehaviorVector(trajectory, 256, 256)!;

      expect(behavior.avgMass).toBeCloseTo(0.1, 3); // 100 / 1000 normalized
      expect(behavior.massVariance).toBeGreaterThan(0);
    });

    it('calculates survival time', () => {
      const trajectory = createTrajectory(
        Array.from({ length: 50 }, (_, i) => ({ x: i, y: 0 }))
      );

      const behavior = extractBehaviorVector(trajectory, 256, 256)!;

      expect(behavior.survivalTime).toBe(50);
    });

    it('calculates heading for moving creatures', () => {
      // Moving right
      const rightward = createTrajectory([
        { x: 0, y: 128 },
        { x: 50, y: 128 },
        { x: 100, y: 128 },
      ]);

      const rightBehavior = extractBehaviorVector(rightward, 256, 256)!;
      // Heading 0 = right, normalized to ~0.5
      expect(rightBehavior.avgHeading).toBeCloseTo(0.5, 1);

      // Moving down
      const downward = createTrajectory([
        { x: 128, y: 0 },
        { x: 128, y: 50 },
        { x: 128, y: 100 },
      ]);

      const downBehavior = extractBehaviorVector(downward, 256, 256)!;
      // Heading PI/2 = down, normalized to ~0.75
      expect(downBehavior.avgHeading).toBeCloseTo(0.75, 1);
    });

    it('calculates heading variance', () => {
      // Consistent direction should have low variance
      const consistent = createTrajectory([
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 20, y: 0 },
        { x: 30, y: 0 },
      ]);

      const consistentBehavior = extractBehaviorVector(consistent, 256, 256)!;
      expect(consistentBehavior.headingVariance).toBeLessThan(0.1);

      // Random directions should have higher variance
      const zigzag = createTrajectory([
        { x: 0, y: 0 },
        { x: 10, y: 10 },
        { x: 0, y: 20 },
        { x: 10, y: 30 },
      ]);

      const zigzagBehavior = extractBehaviorVector(zigzag, 256, 256)!;
      expect(zigzagBehavior.headingVariance).toBeGreaterThan(consistentBehavior.headingVariance);
    });
  });

  describe('behaviorDistance', () => {
    it('returns 0 for identical behaviors', () => {
      const behavior: BehaviorVector = {
        finalX: 0.5,
        finalY: 0.5,
        avgX: 0.3,
        avgY: 0.3,
        totalDistance: 0.1,
        displacement: 0.08,
        avgSpeed: 0.05,
        maxSpeed: 0.1,
        pathEfficiency: 0.8,
        avgMass: 0.1,
        massVariance: 0.01,
        survivalTime: 100,
        avgHeading: 0.5,
        headingVariance: 0.2,
      };

      expect(behaviorDistance(behavior, behavior)).toBe(0);
    });

    it('returns positive distance for different behaviors', () => {
      const a: BehaviorVector = {
        finalX: 0,
        finalY: 0,
        avgX: 0,
        avgY: 0,
        totalDistance: 0,
        displacement: 0,
        avgSpeed: 0,
        maxSpeed: 0,
        pathEfficiency: 0,
        avgMass: 0,
        massVariance: 0,
        survivalTime: 0,
        avgHeading: 0,
        headingVariance: 0,
      };

      const b: BehaviorVector = {
        finalX: 1,
        finalY: 1,
        avgX: 1,
        avgY: 1,
        totalDistance: 1,
        displacement: 1,
        avgSpeed: 1,
        maxSpeed: 1,
        pathEfficiency: 1,
        avgMass: 1,
        massVariance: 1,
        survivalTime: 1000,
        avgHeading: 1,
        headingVariance: 1,
      };

      expect(behaviorDistance(a, b)).toBeGreaterThan(0);
    });

    it('is symmetric', () => {
      const a: BehaviorVector = {
        finalX: 0.2,
        finalY: 0.3,
        avgX: 0.4,
        avgY: 0.5,
        totalDistance: 0.1,
        displacement: 0.05,
        avgSpeed: 0.02,
        maxSpeed: 0.05,
        pathEfficiency: 0.5,
        avgMass: 0.1,
        massVariance: 0.01,
        survivalTime: 100,
        avgHeading: 0.25,
        headingVariance: 0.3,
      };

      const b: BehaviorVector = {
        finalX: 0.8,
        finalY: 0.7,
        avgX: 0.6,
        avgY: 0.5,
        totalDistance: 0.3,
        displacement: 0.25,
        avgSpeed: 0.1,
        maxSpeed: 0.15,
        pathEfficiency: 0.8,
        avgMass: 0.2,
        massVariance: 0.02,
        survivalTime: 200,
        avgHeading: 0.75,
        headingVariance: 0.1,
      };

      expect(behaviorDistance(a, b)).toBeCloseTo(behaviorDistance(b, a), 10);
    });

    it('weights position features heavily', () => {
      // Two behaviors differing only in position
      const base: BehaviorVector = {
        finalX: 0,
        finalY: 0,
        avgX: 0,
        avgY: 0,
        totalDistance: 0.5,
        displacement: 0.5,
        avgSpeed: 0.5,
        maxSpeed: 0.5,
        pathEfficiency: 0.5,
        avgMass: 0.5,
        massVariance: 0.5,
        survivalTime: 500,
        avgHeading: 0.5,
        headingVariance: 0.5,
      };

      const diffPosition = { ...base, finalX: 1, finalY: 1 };
      const diffMass = { ...base, avgMass: 1, massVariance: 1 };

      // Position difference should create larger distance (higher weight)
      expect(behaviorDistance(base, diffPosition)).toBeGreaterThan(
        behaviorDistance(base, diffMass)
      );
    });
  });

  describe('evaluateGoalFitness', () => {
    it('returns infinity distance for empty trajectory', () => {
      const result = evaluateGoalFitness([], 100, 100, 10);

      expect(result.goalReached).toBe(false);
      expect(result.distanceToGoal).toBe(Infinity);
      expect(result.timeToGoal).toBeNull();
    });

    it('detects goal reached', () => {
      const trajectory = createTrajectory([
        { x: 0, y: 0 },
        { x: 50, y: 50 },
        { x: 100, y: 100 }, // Within goal
      ]);

      const result = evaluateGoalFitness(trajectory, 100, 100, 15);

      expect(result.goalReached).toBe(true);
      expect(result.timeToGoal).toBe(2); // Frame index when goal reached
    });

    it('calculates distance to goal', () => {
      const trajectory = createTrajectory([
        { x: 0, y: 0 },
        { x: 50, y: 0 },
      ]);

      const result = evaluateGoalFitness(trajectory, 100, 0, 10);

      expect(result.distanceToGoal).toBeCloseTo(50, 1);
    });

    it('counts obstacle collisions', () => {
      const trajectory = createTrajectory([
        { x: 5, y: 5 },
        { x: 15, y: 5 },
        { x: 25, y: 5 },
      ]);

      const obstacleField = new Float32Array(100 * 100);
      // Place obstacle at (15, 5)
      obstacleField[5 * 100 + 15] = 1;

      const result = evaluateGoalFitness(
        trajectory,
        100,
        100,
        10,
        obstacleField,
        100,
        100
      );

      expect(result.obstacleCollisions).toBe(1);
    });

    it('calculates path efficiency', () => {
      // Direct path
      const direct = createTrajectory([
        { x: 0, y: 0 },
        { x: 50, y: 50 },
        { x: 100, y: 100 },
      ]);

      const directResult = evaluateGoalFitness(direct, 100, 100, 10);
      expect(directResult.pathEfficiency).toBeGreaterThan(0.9);

      // Indirect path
      const indirect = createTrajectory([
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 100 },
      ]);

      const indirectResult = evaluateGoalFitness(indirect, 100, 100, 10);
      expect(indirectResult.pathEfficiency).toBeLessThan(directResult.pathEfficiency);
    });
  });

  describe('calculateFitnessScore', () => {
    it('gives high score for reaching goal', () => {
      const goalReached = {
        goalReached: true,
        distanceToGoal: 0,
        timeToGoal: 50,
        pathEfficiency: 0.9,
        obstacleCollisions: 0,
      };

      const score = calculateFitnessScore(goalReached, null);

      expect(score).toBeGreaterThan(10); // Base goal weight is 10
    });

    it('gives partial credit for getting close', () => {
      const closeToGoal = {
        goalReached: false,
        distanceToGoal: 50,
        timeToGoal: null,
        pathEfficiency: 0.5,
        obstacleCollisions: 0,
      };

      const farFromGoal = {
        goalReached: false,
        distanceToGoal: 400,
        timeToGoal: null,
        pathEfficiency: 0.5,
        obstacleCollisions: 0,
      };

      expect(calculateFitnessScore(closeToGoal, null)).toBeGreaterThan(
        calculateFitnessScore(farFromGoal, null)
      );
    });

    it('penalizes obstacle collisions', () => {
      const noCollisions = {
        goalReached: false,
        distanceToGoal: 100,
        timeToGoal: null,
        pathEfficiency: 0.5,
        obstacleCollisions: 0,
      };

      const manyCollisions = {
        goalReached: false,
        distanceToGoal: 100,
        timeToGoal: null,
        pathEfficiency: 0.5,
        obstacleCollisions: 50,
      };

      expect(calculateFitnessScore(noCollisions, null)).toBeGreaterThan(
        calculateFitnessScore(manyCollisions, null)
      );
    });

    it('rewards survival time', () => {
      const shortSurvival: BehaviorVector = {
        finalX: 0,
        finalY: 0,
        avgX: 0,
        avgY: 0,
        totalDistance: 0,
        displacement: 0,
        avgSpeed: 0,
        maxSpeed: 0,
        pathEfficiency: 0,
        avgMass: 0,
        massVariance: 0,
        survivalTime: 10,
        avgHeading: 0,
        headingVariance: 0,
      };

      const longSurvival = { ...shortSurvival, survivalTime: 500 };

      const goalFitness = {
        goalReached: false,
        distanceToGoal: 100,
        timeToGoal: null,
        pathEfficiency: 0.5,
        obstacleCollisions: 0,
      };

      expect(calculateFitnessScore(goalFitness, longSurvival)).toBeGreaterThan(
        calculateFitnessScore(goalFitness, shortSurvival)
      );
    });

    it('respects custom weights', () => {
      const goalFitness = {
        goalReached: true,
        distanceToGoal: 0,
        timeToGoal: 50,
        pathEfficiency: 0.5,
        obstacleCollisions: 0,
      };

      const highGoalWeight = calculateFitnessScore(goalFitness, null, {
        goalWeight: 100,
        survivalWeight: 0,
        efficiencyWeight: 0,
        collisionPenalty: 0,
      });

      const lowGoalWeight = calculateFitnessScore(goalFitness, null, {
        goalWeight: 1,
        survivalWeight: 0,
        efficiencyWeight: 0,
        collisionPenalty: 0,
      });

      expect(highGoalWeight).toBeGreaterThan(lowGoalWeight);
    });

    it('never returns negative score', () => {
      const worstCase = {
        goalReached: false,
        distanceToGoal: 1000,
        timeToGoal: null,
        pathEfficiency: 0,
        obstacleCollisions: 1000,
      };

      const score = calculateFitnessScore(worstCase, null);

      expect(score).toBeGreaterThanOrEqual(0);
    });
  });
});
