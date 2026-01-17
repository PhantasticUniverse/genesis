/**
 * Fitness Functions
 * Evaluate organisms for survival, stability, complexity, and novelty
 */

export interface FitnessMetrics {
  survival: number; // How long the organism lives (0-1)
  stability: number; // Mass variance over time (0-1, higher = more stable)
  complexity: number; // Spatial entropy (0-1)
  symmetry: number; // Rotational/reflective symmetry (0-1)
  movement: number; // Speed and consistency (0-1)
  replication: number; // Self-replication success (0-1)
  overall: number; // Weighted combination
}

export interface OrganismSnapshot {
  mass: number; // Total mass (sum of all cell values)
  centroidX: number; // Center of mass X
  centroidY: number; // Center of mass Y
  boundingSize: number; // Size of bounding box
  entropy: number; // Spatial entropy
}

/**
 * Calculate mass (sum of all cell values)
 */
export function calculateMass(state: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < state.length; i++) {
    sum += state[i];
  }
  return sum;
}

/**
 * Calculate center of mass
 */
export function calculateCentroid(
  state: Float32Array,
  width: number,
  height: number,
): { x: number; y: number } {
  let sumX = 0,
    sumY = 0,
    total = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const value = state[y * width + x];
      sumX += x * value;
      sumY += y * value;
      total += value;
    }
  }

  if (total === 0) return { x: width / 2, y: height / 2 };
  return { x: sumX / total, y: sumY / total };
}

/**
 * Calculate spatial entropy (measure of complexity)
 */
export function calculateEntropy(
  state: Float32Array,
  bins: number = 10,
): number {
  // Histogram of cell values
  const histogram = new Array(bins).fill(0);
  const total = state.length;

  for (let i = 0; i < state.length; i++) {
    const bin = Math.min(bins - 1, Math.floor(state[i] * bins));
    histogram[bin]++;
  }

  // Calculate entropy
  let entropy = 0;
  for (let i = 0; i < bins; i++) {
    const p = histogram[i] / total;
    if (p > 0) {
      entropy -= p * Math.log2(p);
    }
  }

  // Normalize to 0-1
  return entropy / Math.log2(bins);
}

/**
 * Calculate symmetry score for an organism
 * Combines horizontal, vertical, and 180° rotational symmetry
 *
 * @param state - Grid state as Float32Array
 * @param width - Grid width
 * @param height - Grid height
 * @returns Symmetry score from 0 to 1
 */
export function calculateSymmetry(
  state: Float32Array,
  width: number,
  height: number,
): number {
  // First, find the bounding box of the organism
  const bbox = calculateBoundingBox(state, width, height);

  // If no organism detected, return 0
  if (bbox.size === 0 && bbox.minX > bbox.maxX) {
    return 0;
  }

  // Single point is perfectly symmetric
  if (bbox.minX === bbox.maxX && bbox.minY === bbox.maxY) {
    return 1;
  }

  // Extract the organism region and center it
  const orgWidth = bbox.maxX - bbox.minX + 1;
  const orgHeight = bbox.maxY - bbox.minY + 1;

  // Calculate center of mass within the organism region
  let sumX = 0,
    sumY = 0,
    totalMass = 0;
  for (let y = bbox.minY; y <= bbox.maxY; y++) {
    for (let x = bbox.minX; x <= bbox.maxX; x++) {
      const val = state[y * width + x];
      sumX += (x - bbox.minX) * val;
      sumY += (y - bbox.minY) * val;
      totalMass += val;
    }
  }

  if (totalMass === 0) return 0;

  const centerX = sumX / totalMass;
  const centerY = sumY / totalMass;

  // Calculate horizontal symmetry (left-right reflection)
  let horizontalError = 0;
  let horizontalCount = 0;
  for (let y = bbox.minY; y <= bbox.maxY; y++) {
    for (let x = bbox.minX; x <= bbox.maxX; x++) {
      const localX = x - bbox.minX;
      const mirrorX = Math.round(2 * centerX - localX);

      if (mirrorX >= 0 && mirrorX < orgWidth) {
        const val1 = state[y * width + x];
        const mirrorGlobalX = bbox.minX + mirrorX;
        const val2 = state[y * width + mirrorGlobalX];
        horizontalError += Math.abs(val1 - val2);
        horizontalCount++;
      }
    }
  }
  const horizontalSymmetry =
    horizontalCount > 0 ? 1 - horizontalError / (horizontalCount * 2) : 0;

  // Calculate vertical symmetry (top-bottom reflection)
  let verticalError = 0;
  let verticalCount = 0;
  for (let y = bbox.minY; y <= bbox.maxY; y++) {
    for (let x = bbox.minX; x <= bbox.maxX; x++) {
      const localY = y - bbox.minY;
      const mirrorY = Math.round(2 * centerY - localY);

      if (mirrorY >= 0 && mirrorY < orgHeight) {
        const val1 = state[y * width + x];
        const mirrorGlobalY = bbox.minY + mirrorY;
        const val2 = state[mirrorGlobalY * width + x];
        verticalError += Math.abs(val1 - val2);
        verticalCount++;
      }
    }
  }
  const verticalSymmetry =
    verticalCount > 0 ? 1 - verticalError / (verticalCount * 2) : 0;

  // Calculate 180° rotational symmetry (point symmetry)
  let rotationalError = 0;
  let rotationalCount = 0;
  for (let y = bbox.minY; y <= bbox.maxY; y++) {
    for (let x = bbox.minX; x <= bbox.maxX; x++) {
      const localX = x - bbox.minX;
      const localY = y - bbox.minY;
      const mirrorX = Math.round(2 * centerX - localX);
      const mirrorY = Math.round(2 * centerY - localY);

      if (
        mirrorX >= 0 &&
        mirrorX < orgWidth &&
        mirrorY >= 0 &&
        mirrorY < orgHeight
      ) {
        const val1 = state[y * width + x];
        const mirrorGlobalX = bbox.minX + mirrorX;
        const mirrorGlobalY = bbox.minY + mirrorY;
        const val2 = state[mirrorGlobalY * width + mirrorGlobalX];
        rotationalError += Math.abs(val1 - val2);
        rotationalCount++;
      }
    }
  }
  const rotationalSymmetry =
    rotationalCount > 0 ? 1 - rotationalError / (rotationalCount * 2) : 0;

  // Weighted combination: 30% horizontal + 30% vertical + 40% rotational
  const combinedSymmetry =
    0.3 * Math.max(0, horizontalSymmetry) +
    0.3 * Math.max(0, verticalSymmetry) +
    0.4 * Math.max(0, rotationalSymmetry);

  return Math.max(0, Math.min(1, combinedSymmetry));
}

/**
 * Calculate bounding box size
 */
export function calculateBoundingBox(
  state: Float32Array,
  width: number,
  height: number,
): { minX: number; maxX: number; minY: number; maxY: number; size: number } {
  let minX = width,
    maxX = 0,
    minY = height,
    maxY = 0;
  const threshold = 0.01;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (state[y * width + x] > threshold) {
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
      }
    }
  }

  const size = Math.max(maxX - minX, maxY - minY);
  return { minX, maxX, minY, maxY, size };
}

/**
 * Calculate survival fitness from mass history
 */
export function calculateSurvivalFitness(
  massHistory: number[],
  initialMass: number,
  minSteps: number = 100,
): number {
  if (massHistory.length < minSteps) return 0;

  // Check how long the organism maintained significant mass
  const threshold = initialMass * 0.1;
  let survivalSteps = 0;

  for (let i = 0; i < massHistory.length; i++) {
    if (massHistory[i] > threshold) {
      survivalSteps++;
    }
  }

  return Math.min(1, survivalSteps / massHistory.length);
}

/**
 * Calculate stability fitness from mass variance
 */
export function calculateStabilityFitness(massHistory: number[]): number {
  if (massHistory.length < 10) return 0;

  // Calculate mean
  const mean = massHistory.reduce((a, b) => a + b, 0) / massHistory.length;
  if (mean === 0) return 0;

  // Calculate coefficient of variation (CV)
  const variance =
    massHistory.reduce((sum, m) => sum + (m - mean) ** 2, 0) /
    massHistory.length;
  const cv = Math.sqrt(variance) / mean;

  // Convert to fitness (lower variance = higher fitness)
  return Math.exp(-cv * 2);
}

/**
 * Calculate movement fitness from centroid history
 */
export function calculateMovementFitness(
  centroidHistory: Array<{ x: number; y: number }>,
  width: number,
  height: number,
): number {
  if (centroidHistory.length < 20) return 0;

  // Calculate velocities
  const velocities: number[] = [];
  for (let i = 1; i < centroidHistory.length; i++) {
    const dx = centroidHistory[i].x - centroidHistory[i - 1].x;
    const dy = centroidHistory[i].y - centroidHistory[i - 1].y;
    // Handle toroidal wrapping
    const wrappedDx =
      Math.abs(dx) > width / 2 ? (dx > 0 ? dx - width : dx + width) : dx;
    const wrappedDy =
      Math.abs(dy) > height / 2 ? (dy > 0 ? dy - height : dy + height) : dy;
    velocities.push(Math.sqrt(wrappedDx ** 2 + wrappedDy ** 2));
  }

  // Mean and variance of velocity
  const meanVel = velocities.reduce((a, b) => a + b, 0) / velocities.length;
  const varVel =
    velocities.reduce((sum, v) => sum + (v - meanVel) ** 2, 0) /
    velocities.length;

  // Want consistent, moderate movement
  const speedScore = Math.min(1, meanVel / 2); // Reward up to 2 pixels/step
  const consistencyScore = meanVel > 0.1 ? Math.exp(-varVel / meanVel ** 2) : 0;

  return (speedScore + consistencyScore) / 2;
}

/**
 * Calculate overall fitness from all metrics
 */
export function calculateOverallFitness(
  metrics: Omit<FitnessMetrics, "overall">,
): FitnessMetrics {
  // Weighted combination (weights sum to 1.0)
  const weights = {
    survival: 0.25,
    stability: 0.2,
    complexity: 0.15,
    symmetry: 0.1,
    movement: 0.1,
    replication: 0.2, // Replication is a significant achievement
  };

  const overall =
    metrics.survival * weights.survival +
    metrics.stability * weights.stability +
    metrics.complexity * weights.complexity +
    metrics.symmetry * weights.symmetry +
    metrics.movement * weights.movement +
    (metrics.replication ?? 0) * weights.replication;

  return { ...metrics, overall };
}

/**
 * Behavior vector for novelty search
 * Used to compare organisms based on their behavior rather than genome
 */
export interface BehaviorVector {
  avgMass: number;
  massVariance: number;
  avgSpeed: number;
  avgEntropy: number;
  boundingSize: number;
  lifespan: number;
}

export function calculateBehaviorVector(
  massHistory: number[],
  entropyHistory: number[],
  centroidHistory: Array<{ x: number; y: number }>,
  boundingHistory: number[],
  _width: number,
  _height: number,
): BehaviorVector {
  // Average mass
  const avgMass = massHistory.reduce((a, b) => a + b, 0) / massHistory.length;

  // Mass variance
  const massVariance =
    massHistory.reduce((sum, m) => sum + (m - avgMass) ** 2, 0) /
    massHistory.length;

  // Average speed
  let totalSpeed = 0;
  for (let i = 1; i < centroidHistory.length; i++) {
    const dx = centroidHistory[i].x - centroidHistory[i - 1].x;
    const dy = centroidHistory[i].y - centroidHistory[i - 1].y;
    totalSpeed += Math.sqrt(dx * dx + dy * dy);
  }
  const avgSpeed = totalSpeed / (centroidHistory.length - 1);

  // Average entropy
  const avgEntropy =
    entropyHistory.reduce((a, b) => a + b, 0) / entropyHistory.length;

  // Average bounding size
  const boundingSize =
    boundingHistory.reduce((a, b) => a + b, 0) / boundingHistory.length;

  // Lifespan (normalized)
  const lifespan =
    massHistory.filter((m) => m > avgMass * 0.1).length / massHistory.length;

  return {
    avgMass,
    massVariance,
    avgSpeed,
    avgEntropy,
    boundingSize,
    lifespan,
  };
}

/**
 * Calculate distance between behavior vectors
 */
export function behaviorDistance(
  v1: BehaviorVector,
  v2: BehaviorVector,
): number {
  const weights = {
    avgMass: 1,
    massVariance: 0.5,
    avgSpeed: 1.5,
    avgEntropy: 1,
    boundingSize: 0.5,
    lifespan: 2,
  };

  let sum = 0;
  sum += weights.avgMass * (v1.avgMass - v2.avgMass) ** 2;
  sum += weights.massVariance * (v1.massVariance - v2.massVariance) ** 2;
  sum += weights.avgSpeed * (v1.avgSpeed - v2.avgSpeed) ** 2;
  sum += weights.avgEntropy * (v1.avgEntropy - v2.avgEntropy) ** 2;
  sum += weights.boundingSize * (v1.boundingSize - v2.boundingSize) ** 2;
  sum += weights.lifespan * (v1.lifespan - v2.lifespan) ** 2;

  return Math.sqrt(sum);
}

// =============================================================================
// Sensorimotor-Integrated Fitness Functions
// =============================================================================

import type {
  BehaviorVector as TrajectoryBehavior,
  GoalFitness,
} from "../agency/behavior";

/**
 * Extended fitness metrics including sensorimotor components
 */
export interface ExtendedFitnessMetrics extends FitnessMetrics {
  // Sensorimotor metrics
  goalDirected: number; // How well the creature moves toward goals
  obstacleAvoidance: number; // How well it avoids obstacles
  pathEfficiency: number; // Direct vs actual path
  responsiveness: number; // How quickly it responds to stimuli
}

/**
 * Convert trajectory-based behavior to fitness metrics
 */
export function trajectoryToFitness(
  trajectoryBehavior: TrajectoryBehavior | null,
  goalFitness?: GoalFitness,
): Partial<ExtendedFitnessMetrics> {
  if (!trajectoryBehavior) {
    return {};
  }

  const metrics: Partial<ExtendedFitnessMetrics> = {
    survival: Math.min(1, trajectoryBehavior.survivalTime / 500),
    stability: 1 - Math.min(1, trajectoryBehavior.massVariance * 10),
    movement: Math.min(1, trajectoryBehavior.avgSpeed * 5),
  };

  if (goalFitness) {
    metrics.goalDirected = goalFitness.goalReached
      ? 1
      : Math.exp(-goalFitness.distanceToGoal / 100);
    metrics.obstacleAvoidance = Math.exp(-goalFitness.obstacleCollisions * 0.1);
    metrics.pathEfficiency = goalFitness.pathEfficiency;
  }

  return metrics;
}

/**
 * Calculate sensorimotor-aware overall fitness
 */
export function calculateSensorimotorFitness(
  baseMetrics: FitnessMetrics,
  trajectoryBehavior: TrajectoryBehavior | null,
  goalFitness?: GoalFitness,
): ExtendedFitnessMetrics {
  const trajectoryMetrics = trajectoryToFitness(
    trajectoryBehavior,
    goalFitness,
  );

  // Merge with trajectory metrics taking priority for overlapping fields
  const extended: ExtendedFitnessMetrics = {
    ...baseMetrics,
    goalDirected: trajectoryMetrics.goalDirected ?? 0,
    obstacleAvoidance: trajectoryMetrics.obstacleAvoidance ?? 1,
    pathEfficiency: trajectoryMetrics.pathEfficiency ?? 0,
    responsiveness: 0, // Would need sensor data to calculate
  };

  // Recalculate overall with sensorimotor components
  if (goalFitness) {
    const weights = {
      survival: 0.2,
      stability: 0.15,
      complexity: 0.1,
      symmetry: 0.05,
      movement: 0.1,
      goalDirected: 0.2,
      obstacleAvoidance: 0.1,
      pathEfficiency: 0.1,
    };

    extended.overall =
      extended.survival * weights.survival +
      extended.stability * weights.stability +
      extended.complexity * weights.complexity +
      extended.symmetry * weights.symmetry +
      extended.movement * weights.movement +
      extended.goalDirected * weights.goalDirected +
      extended.obstacleAvoidance * weights.obstacleAvoidance +
      extended.pathEfficiency * weights.pathEfficiency;
  }

  return extended;
}

/**
 * Convert trajectory behavior to discovery behavior vector
 * Bridges the agency and discovery systems
 */
export function trajectoryToBehaviorVector(
  trajectoryBehavior: TrajectoryBehavior,
): BehaviorVector {
  return {
    avgMass: trajectoryBehavior.avgMass * 1000, // Scale to match existing system
    massVariance: trajectoryBehavior.massVariance * 10000,
    avgSpeed: trajectoryBehavior.avgSpeed * 10,
    avgEntropy: 0.5, // Would need entropy history
    boundingSize: 50, // Would need bounding data
    lifespan: Math.min(1, trajectoryBehavior.survivalTime / 500),
  };
}
