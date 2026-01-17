/**
 * Self-Replication Detection
 * Detects when organisms split into similar daughter organisms
 */

/** Bounding box for an organism */
export interface BoundingBox {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  width: number;
  height: number;
}

/** Connected component (organism) in the field */
export interface Component {
  id: number;
  /** Pixels belonging to this component */
  pixels: Array<{ x: number; y: number; value: number }>;
  /** Center of mass */
  centroid: { x: number; y: number };
  /** Total mass */
  mass: number;
  /** Bounding box */
  bounds: BoundingBox;
  /** Extracted pattern (normalized to bounds) */
  pattern: Float32Array;
  /** Pattern dimensions */
  patternWidth: number;
  patternHeight: number;
}

/** Replication event */
export interface ReplicationEvent {
  /** Step when replication occurred */
  step: number;
  /** Parent component before split */
  parent: Component;
  /** Daughter components after split */
  daughters: [Component, Component];
  /** Similarity between daughters (0-1) */
  similarity: number;
  /** Similarity of daughters to parent (0-1) */
  parentSimilarity: number;
}

/** Configuration for replication detection */
export interface ReplicationConfig {
  /** Minimum mass for a component to be considered an organism */
  minMass: number;
  /** Threshold for pixel to be considered active (0-1) */
  activationThreshold: number;
  /** Minimum similarity for daughters to be considered replicants */
  minSimilarity: number;
  /** Maximum mass ratio change to consider as splitting (vs. death/birth) */
  maxMassRatioChange: number;
  /** How many steps to track history */
  historyLength: number;
}

/** Replication detector state */
export interface ReplicationDetector {
  /** Process a new frame and detect replication events */
  update(state: Float32Array, step: number): ReplicationEvent[];
  /** Get current components */
  getComponents(): Component[];
  /** Get replication events history */
  getEvents(): ReplicationEvent[];
  /** Reset detector state */
  reset(): void;
  /** Get configuration */
  getConfig(): ReplicationConfig;
  /** Update configuration */
  setConfig(config: Partial<ReplicationConfig>): void;
}

export const DEFAULT_REPLICATION_CONFIG: ReplicationConfig = {
  minMass: 10,
  activationThreshold: 0.1,
  minSimilarity: 0.6,
  maxMassRatioChange: 0.5,
  historyLength: 100,
};

/**
 * Find connected components in a 2D state array
 * Uses flood-fill algorithm with 8-connectivity
 */
export function findConnectedComponents(
  state: Float32Array,
  width: number,
  height: number,
  threshold: number,
): Component[] {
  const visited = new Uint8Array(width * height);
  const components: Component[] = [];
  let componentId = 0;

  // Get 8-connected neighbors
  const getNeighbors = (
    x: number,
    y: number,
  ): Array<{ x: number; y: number }> => {
    const neighbors: Array<{ x: number; y: number }> = [];
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const nx = x + dx;
        const ny = y + dy;
        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
          neighbors.push({ x: nx, y: ny });
        }
      }
    }
    return neighbors;
  };

  // Flood fill from a starting point
  const floodFill = (startX: number, startY: number): Component | null => {
    const pixels: Array<{ x: number; y: number; value: number }> = [];
    const stack: Array<{ x: number; y: number }> = [{ x: startX, y: startY }];

    let minX = startX,
      maxX = startX,
      minY = startY,
      maxY = startY;
    let totalMass = 0;
    let centroidX = 0,
      centroidY = 0;

    while (stack.length > 0) {
      const { x, y } = stack.pop()!;
      const idx = y * width + x;

      if (visited[idx]) continue;
      const value = state[idx];
      if (value < threshold) continue;

      visited[idx] = 1;
      pixels.push({ x, y, value });

      totalMass += value;
      centroidX += x * value;
      centroidY += y * value;

      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);

      for (const neighbor of getNeighbors(x, y)) {
        const nIdx = neighbor.y * width + neighbor.x;
        if (!visited[nIdx] && state[nIdx] >= threshold) {
          stack.push(neighbor);
        }
      }
    }

    if (pixels.length === 0) return null;

    centroidX /= totalMass;
    centroidY /= totalMass;

    const bounds: BoundingBox = {
      minX,
      maxX,
      minY,
      maxY,
      width: maxX - minX + 1,
      height: maxY - minY + 1,
    };

    // Extract pattern
    const patternWidth = bounds.width;
    const patternHeight = bounds.height;
    const pattern = new Float32Array(patternWidth * patternHeight);

    for (const pixel of pixels) {
      const px = pixel.x - minX;
      const py = pixel.y - minY;
      pattern[py * patternWidth + px] = pixel.value;
    }

    return {
      id: componentId++,
      pixels,
      centroid: { x: centroidX, y: centroidY },
      mass: totalMass,
      bounds,
      pattern,
      patternWidth,
      patternHeight,
    };
  };

  // Find all components
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (!visited[idx] && state[idx] >= threshold) {
        const component = floodFill(x, y);
        if (component) {
          components.push(component);
        }
      }
    }
  }

  return components;
}

/**
 * Calculate similarity between two patterns using normalized cross-correlation
 */
export function calculatePatternSimilarity(
  pattern1: Float32Array,
  width1: number,
  height1: number,
  pattern2: Float32Array,
  width2: number,
  height2: number,
): number {
  // Resize patterns to same size (use the smaller dimensions)
  const targetWidth = Math.min(width1, width2);
  const targetHeight = Math.min(height1, height2);

  if (targetWidth < 2 || targetHeight < 2) {
    return 0;
  }

  // Simple resize using nearest neighbor
  const resized1 = resizePattern(
    pattern1,
    width1,
    height1,
    targetWidth,
    targetHeight,
  );
  const resized2 = resizePattern(
    pattern2,
    width2,
    height2,
    targetWidth,
    targetHeight,
  );

  // Calculate normalized cross-correlation
  let sum1 = 0,
    sum2 = 0;
  let sumSq1 = 0,
    sumSq2 = 0;
  let sumProd = 0;
  const n = targetWidth * targetHeight;

  for (let i = 0; i < n; i++) {
    const v1 = resized1[i];
    const v2 = resized2[i];
    sum1 += v1;
    sum2 += v2;
    sumSq1 += v1 * v1;
    sumSq2 += v2 * v2;
    sumProd += v1 * v2;
  }

  const mean1 = sum1 / n;
  const mean2 = sum2 / n;
  const var1 = sumSq1 / n - mean1 * mean1;
  const var2 = sumSq2 / n - mean2 * mean2;
  const std1 = Math.sqrt(Math.max(0, var1));
  const std2 = Math.sqrt(Math.max(0, var2));

  if (std1 < 1e-6 || std2 < 1e-6) {
    return mean1 > 0.1 && mean2 > 0.1 ? 1 : 0;
  }

  const covariance = sumProd / n - mean1 * mean2;
  const correlation = covariance / (std1 * std2);

  return Math.max(0, Math.min(1, (correlation + 1) / 2));
}

/**
 * Resize a pattern using bilinear interpolation
 */
function resizePattern(
  pattern: Float32Array,
  srcWidth: number,
  srcHeight: number,
  dstWidth: number,
  dstHeight: number,
): Float32Array {
  const result = new Float32Array(dstWidth * dstHeight);

  const xRatio = srcWidth / dstWidth;
  const yRatio = srcHeight / dstHeight;

  for (let y = 0; y < dstHeight; y++) {
    for (let x = 0; x < dstWidth; x++) {
      const srcX = x * xRatio;
      const srcY = y * yRatio;

      const x0 = Math.floor(srcX);
      const y0 = Math.floor(srcY);
      const x1 = Math.min(x0 + 1, srcWidth - 1);
      const y1 = Math.min(y0 + 1, srcHeight - 1);

      const xFrac = srcX - x0;
      const yFrac = srcY - y0;

      const v00 = pattern[y0 * srcWidth + x0];
      const v10 = pattern[y0 * srcWidth + x1];
      const v01 = pattern[y1 * srcWidth + x0];
      const v11 = pattern[y1 * srcWidth + x1];

      const v0 = v00 * (1 - xFrac) + v10 * xFrac;
      const v1 = v01 * (1 - xFrac) + v11 * xFrac;

      result[y * dstWidth + x] = v0 * (1 - yFrac) + v1 * yFrac;
    }
  }

  return result;
}

/**
 * Match components between frames to track identity
 */
export function matchComponents(
  prevComponents: Component[],
  currComponents: Component[],
  maxDistance: number,
): Map<number, number[]> {
  const matches = new Map<number, number[]>();

  // For each previous component, find matching current components
  for (const prev of prevComponents) {
    const matchedIds: number[] = [];

    for (const curr of currComponents) {
      // Check if centroids are close enough
      const dx = curr.centroid.x - prev.centroid.x;
      const dy = curr.centroid.y - prev.centroid.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < maxDistance) {
        matchedIds.push(curr.id);
      }
    }

    matches.set(prev.id, matchedIds);
  }

  return matches;
}

/**
 * Detect if a split event (one component becoming two) is a replication
 */
export function detectReplication(
  parent: Component,
  daughters: [Component, Component],
  config: ReplicationConfig,
): { isReplication: boolean; similarity: number; parentSimilarity: number } {
  // Calculate similarity between daughters
  const similarity = calculatePatternSimilarity(
    daughters[0].pattern,
    daughters[0].patternWidth,
    daughters[0].patternHeight,
    daughters[1].pattern,
    daughters[1].patternWidth,
    daughters[1].patternHeight,
  );

  // Calculate similarity of daughters to parent
  const sim0 = calculatePatternSimilarity(
    parent.pattern,
    parent.patternWidth,
    parent.patternHeight,
    daughters[0].pattern,
    daughters[0].patternWidth,
    daughters[0].patternHeight,
  );

  const sim1 = calculatePatternSimilarity(
    parent.pattern,
    parent.patternWidth,
    parent.patternHeight,
    daughters[1].pattern,
    daughters[1].patternWidth,
    daughters[1].patternHeight,
  );

  const parentSimilarity = (sim0 + sim1) / 2;

  // Check mass conservation (daughters should have similar combined mass to parent)
  const combinedMass = daughters[0].mass + daughters[1].mass;
  const massRatio = combinedMass / parent.mass;
  const massConserved =
    massRatio > 1 - config.maxMassRatioChange &&
    massRatio < 1 + config.maxMassRatioChange;

  // Replication if daughters are similar to each other and to parent
  const isReplication =
    similarity >= config.minSimilarity &&
    parentSimilarity >= config.minSimilarity * 0.8 &&
    massConserved;

  return { isReplication, similarity, parentSimilarity };
}

/**
 * Create a replication detector
 */
export function createReplicationDetector(
  width: number,
  height: number,
  config: Partial<ReplicationConfig> = {},
): ReplicationDetector {
  const fullConfig: ReplicationConfig = {
    ...DEFAULT_REPLICATION_CONFIG,
    ...config,
  };
  const events: ReplicationEvent[] = [];
  let prevComponents: Component[] = [];
  let currentComponents: Component[] = [];

  // Maximum distance for component matching (based on grid size)
  const maxMatchDistance = Math.max(width, height) / 4;

  return {
    update(state: Float32Array, step: number): ReplicationEvent[] {
      const newEvents: ReplicationEvent[] = [];

      // Find connected components
      currentComponents = findConnectedComponents(
        state,
        width,
        height,
        fullConfig.activationThreshold,
      ).filter((c) => c.mass >= fullConfig.minMass);

      if (prevComponents.length === 0) {
        prevComponents = currentComponents;
        return newEvents;
      }

      // Match components between frames
      const matches = matchComponents(
        prevComponents,
        currentComponents,
        maxMatchDistance,
      );

      // Look for split events (one -> two)
      for (const [prevId, currIds] of matches) {
        if (currIds.length === 2) {
          const parent = prevComponents.find((c) => c.id === prevId)!;
          const daughters: [Component, Component] = [
            currentComponents.find((c) => c.id === currIds[0])!,
            currentComponents.find((c) => c.id === currIds[1])!,
          ];

          const { isReplication, similarity, parentSimilarity } =
            detectReplication(parent, daughters, fullConfig);

          if (isReplication) {
            const event: ReplicationEvent = {
              step,
              parent,
              daughters,
              similarity,
              parentSimilarity,
            };
            newEvents.push(event);
            events.push(event);

            // Trim history if needed
            while (events.length > fullConfig.historyLength) {
              events.shift();
            }
          }
        }
      }

      prevComponents = currentComponents;
      return newEvents;
    },

    getComponents(): Component[] {
      return currentComponents;
    },

    getEvents(): ReplicationEvent[] {
      return events;
    },

    reset(): void {
      events.length = 0;
      prevComponents = [];
      currentComponents = [];
    },

    getConfig(): ReplicationConfig {
      return { ...fullConfig };
    },

    setConfig(newConfig: Partial<ReplicationConfig>): void {
      Object.assign(fullConfig, newConfig);
    },
  };
}

/**
 * Calculate replication fitness score
 * Higher scores for organisms that replicate successfully
 */
export function calculateReplicationFitness(
  events: ReplicationEvent[],
): number {
  if (events.length === 0) return 0;

  // Base score for having any replication events
  let score = Math.min(events.length * 0.2, 0.4);

  // Bonus for high-quality replications
  const avgSimilarity =
    events.reduce((sum, e) => sum + e.similarity, 0) / events.length;
  score += avgSimilarity * 0.3;

  // Bonus for consistent replication (similar time between events)
  if (events.length >= 2) {
    const intervals: number[] = [];
    for (let i = 1; i < events.length; i++) {
      intervals.push(events[i].step - events[i - 1].step);
    }
    const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const variance =
      intervals.reduce((sum, i) => sum + (i - avgInterval) ** 2, 0) /
      intervals.length;
    const consistency = 1 / (1 + Math.sqrt(variance) / avgInterval);
    score += consistency * 0.3;
  }

  return Math.min(1, score);
}
