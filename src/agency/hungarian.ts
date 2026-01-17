/**
 * Hungarian Algorithm (Kuhn-Munkres) for optimal bipartite matching
 *
 * Finds the minimum cost assignment in a bipartite weighted graph.
 * Used for creature tracking to optimally match detected components
 * to existing creatures across frames.
 *
 * Time complexity: O(n³)
 * Space complexity: O(n²)
 */

/**
 * Result of Hungarian algorithm assignment
 */
export interface AssignmentResult {
  /** Assignments: assignment[i] = j means row i is assigned to column j, -1 if unassigned */
  assignment: number[];
  /** Total cost of the optimal assignment */
  totalCost: number;
  /** Number of valid assignments made */
  assignmentCount: number;
}

/**
 * Solve the assignment problem using the Hungarian algorithm
 *
 * Given an n×m cost matrix, finds the optimal assignment of rows to columns
 * that minimizes total cost. Handles non-square matrices.
 *
 * @param costMatrix - 2D array where costMatrix[i][j] is the cost of assigning row i to column j
 * @param maxCost - Maximum cost threshold; assignments above this are treated as invalid
 * @returns AssignmentResult with optimal assignments
 */
export function hungarianAlgorithm(
  costMatrix: number[][],
  maxCost: number = Infinity,
): AssignmentResult {
  const n = costMatrix.length;
  if (n === 0) {
    return { assignment: [], totalCost: 0, assignmentCount: 0 };
  }

  const m = costMatrix[0]?.length ?? 0;
  if (m === 0) {
    return { assignment: new Array(n).fill(-1), totalCost: 0, assignmentCount: 0 };
  }

  // Pad to square matrix if necessary
  const size = Math.max(n, m);
  const paddedMatrix = createPaddedMatrix(costMatrix, size, maxCost);

  // Run Hungarian algorithm on square matrix
  const result = hungarianSquare(paddedMatrix);

  // Extract valid assignments (within original dimensions and below maxCost)
  const assignment = new Array(n).fill(-1);
  let totalCost = 0;
  let assignmentCount = 0;

  for (let i = 0; i < n; i++) {
    const j = result[i];
    if (j < m && costMatrix[i][j] < maxCost) {
      assignment[i] = j;
      totalCost += costMatrix[i][j];
      assignmentCount++;
    }
  }

  return { assignment, totalCost, assignmentCount };
}

/**
 * Create a padded square matrix for the Hungarian algorithm
 * Uses a large finite value to avoid issues with Infinity in the algorithm
 */
function createPaddedMatrix(
  matrix: number[][],
  size: number,
  fillValue: number,
): number[][] {
  const padded: number[][] = [];

  // Find max value in matrix for scaling the padding
  let maxVal = 0;
  for (let i = 0; i < matrix.length; i++) {
    for (let j = 0; j < (matrix[i]?.length ?? 0); j++) {
      const val = Math.abs(matrix[i][j]);
      if (isFinite(val) && val > maxVal) {
        maxVal = val;
      }
    }
  }

  // Use a large but finite padding value
  // This ensures the algorithm converges while making padding assignments unfavorable
  const safePadding = isFinite(fillValue) ? fillValue : Math.max(maxVal * size * 100, 1e9);

  for (let i = 0; i < size; i++) {
    padded[i] = [];
    for (let j = 0; j < size; j++) {
      if (i < matrix.length && j < (matrix[i]?.length ?? 0)) {
        const val = matrix[i][j];
        padded[i][j] = isFinite(val) ? val : safePadding;
      } else {
        padded[i][j] = safePadding;
      }
    }
  }

  return padded;
}

/**
 * Hungarian algorithm for square cost matrices
 * Uses the classic Kuhn-Munkres implementation
 */
function hungarianSquare(cost: number[][]): number[] {
  const n = cost.length;

  if (n === 0) {
    return [];
  }

  // Use a large finite value instead of Infinity for algorithm stability
  const LARGE_VAL = 1e15;

  // u[i] and v[j] are the dual variables (potentials)
  const u = new Array(n + 1).fill(0);
  const v = new Array(n + 1).fill(0);

  // p[j] = row matched to column j (1-indexed, 0 = unmatched)
  const p = new Array(n + 1).fill(0);

  // way[j] = the column that led to the augmenting path reaching column j
  const way = new Array(n + 1).fill(0);

  for (let i = 1; i <= n; i++) {
    // Start augmenting path from row i
    p[0] = i;
    let j0 = 0; // Virtual column 0 is where we start

    const minv = new Array(n + 1).fill(LARGE_VAL);
    const used = new Array(n + 1).fill(false);

    // Find augmenting path
    do {
      used[j0] = true;
      const i0 = p[j0];
      let delta = LARGE_VAL;
      let j1 = 0;

      for (let j = 1; j <= n; j++) {
        if (!used[j]) {
          // Reduced cost
          const cur = cost[i0 - 1][j - 1] - u[i0] - v[j];
          if (cur < minv[j]) {
            minv[j] = cur;
            way[j] = j0;
          }
          if (minv[j] < delta) {
            delta = minv[j];
            j1 = j;
          }
        }
      }

      // If delta is still LARGE_VAL, all remaining columns have prohibitive costs
      // Break to avoid potential issues (this shouldn't happen with proper padding)
      if (j1 === 0 && delta >= LARGE_VAL) {
        break;
      }

      // Update potentials
      for (let j = 0; j <= n; j++) {
        if (used[j]) {
          u[p[j]] += delta;
          v[j] -= delta;
        } else {
          minv[j] -= delta;
        }
      }

      j0 = j1;
    } while (p[j0] !== 0);

    // Trace back the augmenting path and update matching
    if (j0 !== 0) {
      do {
        const j1 = way[j0];
        p[j0] = p[j1];
        j0 = j1;
      } while (j0 !== 0);
    }
  }

  // Convert from 1-indexed to 0-indexed
  const result = new Array(n).fill(-1);
  for (let j = 1; j <= n; j++) {
    if (p[j] !== 0) {
      result[p[j] - 1] = j - 1;
    }
  }

  return result;
}

/**
 * Compute cost matrix for creature tracking
 * Cost is based on distance between centroids, with additional factors
 * for mass similarity and predicted position
 *
 * @param prevCreatures - Array of previous frame creatures with positions and velocities
 * @param newComponents - Array of detected components in current frame
 * @param options - Configuration options for cost computation
 * @returns Cost matrix where [i][j] is cost of assigning prev[i] to new[j]
 */
export function computeTrackingCostMatrix(
  prevCreatures: Array<{
    centroidX: number;
    centroidY: number;
    velocityX: number;
    velocityY: number;
    mass: number;
  }>,
  newComponents: Array<{
    centroidX: number;
    centroidY: number;
    mass: number;
  }>,
  options: {
    /** Weight for distance cost (default: 1.0) */
    distanceWeight?: number;
    /** Weight for mass similarity cost (default: 0.3) */
    massWeight?: number;
    /** Weight for velocity prediction cost (default: 0.5) */
    velocityWeight?: number;
    /** Maximum distance for valid match (default: 50) */
    maxDistance?: number;
  } = {},
): number[][] {
  const {
    distanceWeight = 1.0,
    massWeight = 0.3,
    velocityWeight = 0.5,
    maxDistance = 50,
  } = options;

  const n = prevCreatures.length;
  const m = newComponents.length;

  if (n === 0 || m === 0) {
    return [];
  }

  const costMatrix: number[][] = [];
  const INVALID_COST = maxDistance * 10; // High cost for invalid matches

  for (let i = 0; i < n; i++) {
    costMatrix[i] = [];
    const prev = prevCreatures[i];

    // Predicted position based on velocity
    const predictedX = prev.centroidX + prev.velocityX;
    const predictedY = prev.centroidY + prev.velocityY;

    for (let j = 0; j < m; j++) {
      const curr = newComponents[j];

      // Distance from previous position
      const dx = curr.centroidX - prev.centroidX;
      const dy = curr.centroidY - prev.centroidY;
      const directDist = Math.sqrt(dx * dx + dy * dy);

      // Distance from predicted position (using velocity)
      const pdx = curr.centroidX - predictedX;
      const pdy = curr.centroidY - predictedY;
      const predictedDist = Math.sqrt(pdx * pdx + pdy * pdy);

      // Mass similarity (normalized difference)
      const maxMass = Math.max(prev.mass, curr.mass, 1);
      const massDiff = Math.abs(prev.mass - curr.mass) / maxMass;

      // Combined cost
      if (directDist > maxDistance) {
        // Too far apart - invalid match
        costMatrix[i][j] = INVALID_COST;
      } else {
        costMatrix[i][j] =
          distanceWeight * directDist +
          velocityWeight * predictedDist +
          massWeight * massDiff * maxDistance; // Scale mass cost to distance units
      }
    }
  }

  return costMatrix;
}

/**
 * Match creatures using Hungarian algorithm with velocity prediction
 *
 * @param prevCreatures - Map of previous frame creatures
 * @param newComponents - Array of detected components in current frame
 * @param maxMatchDistance - Maximum distance for valid matches
 * @returns Map from component label to creature ID
 */
export function matchCreaturesHungarian(
  prevCreatures: Map<
    number,
    {
      id: number;
      centroidX: number;
      centroidY: number;
      velocityX: number;
      velocityY: number;
      mass: number;
    }
  >,
  newComponents: Array<{
    label: number;
    centroidX: number;
    centroidY: number;
    mass: number;
  }>,
  maxMatchDistance: number = 50,
): Map<number, number> {
  const matches = new Map<number, number>();

  if (prevCreatures.size === 0 || newComponents.length === 0) {
    return matches;
  }

  // Convert map to array for indexing
  const prevList = Array.from(prevCreatures.values());

  // Compute cost matrix
  const costMatrix = computeTrackingCostMatrix(prevList, newComponents, {
    maxDistance: maxMatchDistance,
  });

  // Run Hungarian algorithm
  const result = hungarianAlgorithm(costMatrix, maxMatchDistance * 10);

  // Build matches map
  for (let i = 0; i < result.assignment.length; i++) {
    const j = result.assignment[i];
    if (j >= 0 && j < newComponents.length) {
      const creatureId = prevList[i].id;
      const componentLabel = newComponents[j].label;
      matches.set(componentLabel, creatureId);
    }
  }

  return matches;
}

/**
 * Solve a simple linear assignment problem (LAP)
 * Wrapper around Hungarian algorithm for common use cases
 *
 * @param costs - Array of { row, col, cost } entries
 * @param numRows - Total number of rows
 * @param numCols - Total number of columns
 * @param maxCost - Maximum cost threshold
 * @returns Optimal assignment
 */
export function solveLinearAssignment(
  costs: Array<{ row: number; col: number; cost: number }>,
  numRows: number,
  numCols: number,
  maxCost: number = Infinity,
): AssignmentResult {
  // Build dense cost matrix
  const matrix: number[][] = [];
  for (let i = 0; i < numRows; i++) {
    matrix[i] = new Array(numCols).fill(maxCost);
  }

  for (const { row, col, cost } of costs) {
    if (row >= 0 && row < numRows && col >= 0 && col < numCols) {
      matrix[row][col] = cost;
    }
  }

  return hungarianAlgorithm(matrix, maxCost);
}
