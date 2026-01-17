/**
 * Behavior Extraction
 * Extracts behavior vectors from creature trajectories for novelty search and fitness evaluation
 */

import type { TrackerState } from "./creature-tracker";

/**
 * Behavior vector representing key features of creature behavior
 * Used for novelty search and fitness evaluation
 */
export interface BehaviorVector {
  // Position features (normalized 0-1)
  finalX: number;
  finalY: number;
  avgX: number;
  avgY: number;

  // Movement features
  totalDistance: number; // Total path length
  displacement: number; // Start-to-end distance
  avgSpeed: number; // Average velocity magnitude
  maxSpeed: number; // Peak velocity
  pathEfficiency: number; // displacement / totalDistance

  // Shape features
  avgMass: number;
  massVariance: number;
  survivalTime: number; // Frames creature survived

  // Direction features
  avgHeading: number; // Average movement direction
  headingVariance: number; // How much direction changes
}

/**
 * Trajectory entry for tracking creature over time
 */
export interface TrajectoryPoint {
  frame: number;
  x: number;
  y: number;
  mass: number;
  velocityX: number;
  velocityY: number;
}

/**
 * Full trajectory of a creature
 */
export interface CreatureTrajectory {
  creatureId: number;
  points: TrajectoryPoint[];
  startFrame: number;
  endFrame: number;
}

/**
 * Trajectory collector for accumulating creature positions over time
 */
export interface TrajectoryCollector {
  trajectories: Map<number, TrajectoryPoint[]>;
  maxLength: number;
  gridWidth: number;
  gridHeight: number;
}

/**
 * Create a new trajectory collector
 */
export function createTrajectoryCollector(
  gridWidth: number,
  gridHeight: number,
  maxLength: number = 1000,
): TrajectoryCollector {
  return {
    trajectories: new Map(),
    maxLength,
    gridWidth,
    gridHeight,
  };
}

/**
 * Update trajectory collector with new tracker state
 */
export function updateTrajectories(
  collector: TrajectoryCollector,
  tracker: TrackerState,
): void {
  const frame = tracker.frame;

  for (const creature of tracker.creatures.values()) {
    let trajectory = collector.trajectories.get(creature.id);

    if (!trajectory) {
      trajectory = [];
      collector.trajectories.set(creature.id, trajectory);
    }

    trajectory.push({
      frame,
      x: creature.centroidX,
      y: creature.centroidY,
      mass: creature.mass,
      velocityX: creature.velocityX,
      velocityY: creature.velocityY,
    });

    // Trim if too long
    if (trajectory.length > collector.maxLength) {
      trajectory.shift();
    }
  }

  // Remove trajectories for creatures that no longer exist
  for (const id of collector.trajectories.keys()) {
    if (!tracker.creatures.has(id)) {
      // Keep trajectory for analysis but mark as ended
      const traj = collector.trajectories.get(id)!;
      if (traj.length > 0 && traj[traj.length - 1].frame === frame - 1) {
        // Creature just died - keep trajectory
      } else if (traj.length > 0 && frame - traj[traj.length - 1].frame > 100) {
        // Old trajectory - remove
        collector.trajectories.delete(id);
      }
    }
  }
}

/**
 * Extract behavior vector from a trajectory
 */
export function extractBehaviorVector(
  trajectory: TrajectoryPoint[],
  gridWidth: number,
  gridHeight: number,
): BehaviorVector | null {
  if (trajectory.length < 2) {
    return null;
  }

  const first = trajectory[0];
  const last = trajectory[trajectory.length - 1];

  // Position features
  let sumX = 0,
    sumY = 0;
  for (const p of trajectory) {
    sumX += p.x;
    sumY += p.y;
  }
  const avgX = sumX / trajectory.length / gridWidth;
  const avgY = sumY / trajectory.length / gridHeight;

  // Movement features
  let totalDistance = 0;
  let maxSpeed = 0;
  let sumSpeed = 0;
  let sumHeadingX = 0,
    sumHeadingY = 0;
  const headings: number[] = [];

  for (let i = 1; i < trajectory.length; i++) {
    const prev = trajectory[i - 1];
    const curr = trajectory[i];

    const dx = curr.x - prev.x;
    const dy = curr.y - prev.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const speed = Math.sqrt(curr.velocityX ** 2 + curr.velocityY ** 2);

    totalDistance += dist;
    sumSpeed += speed;
    maxSpeed = Math.max(maxSpeed, speed);

    if (dist > 0.1) {
      const heading = Math.atan2(dy, dx);
      headings.push(heading);
      sumHeadingX += Math.cos(heading);
      sumHeadingY += Math.sin(heading);
    }
  }

  const displacement = Math.sqrt(
    (last.x - first.x) ** 2 + (last.y - first.y) ** 2,
  );
  const avgSpeed = sumSpeed / (trajectory.length - 1);
  const pathEfficiency = totalDistance > 0 ? displacement / totalDistance : 0;

  // Mass features
  let sumMass = 0,
    sumMass2 = 0;
  for (const p of trajectory) {
    sumMass += p.mass;
    sumMass2 += p.mass * p.mass;
  }
  const avgMass = sumMass / trajectory.length;
  const massVariance = sumMass2 / trajectory.length - avgMass * avgMass;

  // Heading features
  let avgHeading = 0;
  let headingVariance = 0;
  if (headings.length > 0) {
    avgHeading = Math.atan2(sumHeadingY, sumHeadingX);

    // Circular variance
    const R = Math.sqrt(sumHeadingX ** 2 + sumHeadingY ** 2) / headings.length;
    headingVariance = 1 - R; // 0 = consistent direction, 1 = random
  }

  return {
    finalX: last.x / gridWidth,
    finalY: last.y / gridHeight,
    avgX,
    avgY,
    totalDistance: totalDistance / Math.max(gridWidth, gridHeight),
    displacement: displacement / Math.max(gridWidth, gridHeight),
    avgSpeed: avgSpeed / 10, // Normalize
    maxSpeed: maxSpeed / 10,
    pathEfficiency,
    avgMass: avgMass / 1000, // Normalize
    massVariance: massVariance / 10000,
    survivalTime: trajectory.length,
    avgHeading: (avgHeading + Math.PI) / (2 * Math.PI), // Normalize to 0-1
    headingVariance,
  };
}

/**
 * Calculate distance between two behavior vectors
 * Used for novelty search
 */
export function behaviorDistance(a: BehaviorVector, b: BehaviorVector): number {
  const weights = {
    finalX: 2.0,
    finalY: 2.0,
    avgX: 1.0,
    avgY: 1.0,
    totalDistance: 1.5,
    displacement: 1.5,
    avgSpeed: 1.0,
    maxSpeed: 0.5,
    pathEfficiency: 1.0,
    avgMass: 0.5,
    massVariance: 0.3,
    survivalTime: 0.1,
    avgHeading: 0.5,
    headingVariance: 0.5,
  };

  let sum = 0;
  let totalWeight = 0;

  for (const [key, weight] of Object.entries(weights)) {
    const va = a[key as keyof BehaviorVector] as number;
    const vb = b[key as keyof BehaviorVector] as number;
    sum += weight * (va - vb) ** 2;
    totalWeight += weight;
  }

  return Math.sqrt(sum / totalWeight);
}

/**
 * Fitness based on goal-directed behavior
 */
export interface GoalFitness {
  goalReached: boolean;
  distanceToGoal: number;
  timeToGoal: number | null;
  pathEfficiency: number;
  obstacleCollisions: number;
}

/**
 * Evaluate fitness for goal-directed task
 */
export function evaluateGoalFitness(
  trajectory: TrajectoryPoint[],
  goalX: number,
  goalY: number,
  goalRadius: number,
  obstacleField?: Float32Array,
  gridWidth?: number,
  gridHeight?: number,
): GoalFitness {
  if (trajectory.length === 0) {
    return {
      goalReached: false,
      distanceToGoal: Infinity,
      timeToGoal: null,
      pathEfficiency: 0,
      obstacleCollisions: 0,
    };
  }

  let goalReached = false;
  let timeToGoal: number | null = null;
  let obstacleCollisions = 0;

  // Check each point for goal and obstacles
  for (let i = 0; i < trajectory.length; i++) {
    const p = trajectory[i];

    // Check goal
    const distToGoal = Math.sqrt((p.x - goalX) ** 2 + (p.y - goalY) ** 2);
    if (distToGoal < goalRadius && !goalReached) {
      goalReached = true;
      timeToGoal = i;
    }

    // Check obstacles
    if (obstacleField && gridWidth && gridHeight) {
      const ix = Math.floor(p.x);
      const iy = Math.floor(p.y);
      if (ix >= 0 && ix < gridWidth && iy >= 0 && iy < gridHeight) {
        if (obstacleField[iy * gridWidth + ix] > 0.5) {
          obstacleCollisions++;
        }
      }
    }
  }

  const last = trajectory[trajectory.length - 1];
  const first = trajectory[0];
  const distanceToGoal = Math.sqrt(
    (last.x - goalX) ** 2 + (last.y - goalY) ** 2,
  );

  // Calculate path efficiency
  let totalDistance = 0;
  for (let i = 1; i < trajectory.length; i++) {
    const prev = trajectory[i - 1];
    const curr = trajectory[i];
    totalDistance += Math.sqrt((curr.x - prev.x) ** 2 + (curr.y - prev.y) ** 2);
  }

  const directDistance = Math.sqrt(
    (first.x - goalX) ** 2 + (first.y - goalY) ** 2,
  );
  const pathEfficiency = totalDistance > 0 ? directDistance / totalDistance : 0;

  return {
    goalReached,
    distanceToGoal,
    timeToGoal,
    pathEfficiency,
    obstacleCollisions,
  };
}

/**
 * Calculate composite fitness score
 */
export function calculateFitnessScore(
  goalFitness: GoalFitness,
  behavior: BehaviorVector | null,
  weights: {
    goalWeight: number;
    survivalWeight: number;
    efficiencyWeight: number;
    collisionPenalty: number;
  } = {
    goalWeight: 10.0,
    survivalWeight: 1.0,
    efficiencyWeight: 2.0,
    collisionPenalty: 5.0,
  },
): number {
  let score = 0;

  // Goal achievement
  if (goalFitness.goalReached) {
    score += weights.goalWeight;
    // Bonus for reaching quickly
    if (goalFitness.timeToGoal !== null) {
      score +=
        weights.goalWeight * 0.5 * Math.exp(-goalFitness.timeToGoal / 100);
    }
  } else {
    // Partial credit for getting close
    const normalizedDist = goalFitness.distanceToGoal / 500; // Assume 500 is max
    score += weights.goalWeight * 0.3 * Math.exp(-normalizedDist);
  }

  // Path efficiency
  score += weights.efficiencyWeight * goalFitness.pathEfficiency;

  // Survival
  if (behavior) {
    score += weights.survivalWeight * Math.min(1, behavior.survivalTime / 500);
  }

  // Collision penalty
  score -= weights.collisionPenalty * goalFitness.obstacleCollisions * 0.01;

  return Math.max(0, score);
}
