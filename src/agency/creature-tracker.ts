/**
 * Creature Tracker
 * Connected component detection and tracking for organisms
 */

export interface Creature {
  id: number;
  centroidX: number;
  centroidY: number;
  mass: number;
  boundingBox: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
  };
  velocityX: number;
  velocityY: number;
  age: number;
}

export interface TrackerState {
  creatures: Map<number, Creature>;
  nextId: number;
  frame: number;
}

/**
 * Create initial tracker state
 */
export function createTrackerState(): TrackerState {
  return {
    creatures: new Map(),
    nextId: 1,
    frame: 0,
  };
}

/**
 * Find connected components using flood fill
 * Returns labeled image and component stats
 */
export function findConnectedComponents(
  state: Float32Array,
  width: number,
  height: number,
  threshold: number = 0.1,
  minMass: number = 50,
): { labels: Int32Array; components: ComponentStats[] } {
  const labels = new Int32Array(width * height);
  const components: ComponentStats[] = [];
  let currentLabel = 0;

  // Queue for flood fill
  const queue: number[] = [];

  for (let startY = 0; startY < height; startY++) {
    for (let startX = 0; startX < width; startX++) {
      const startIdx = startY * width + startX;

      // Skip if already labeled or below threshold
      if (labels[startIdx] !== 0 || state[startIdx] < threshold) {
        continue;
      }

      // Start new component
      currentLabel++;
      let mass = 0;
      let sumX = 0;
      let sumY = 0;
      let minX = width,
        maxX = 0,
        minY = height,
        maxY = 0;

      // Flood fill
      queue.push(startIdx);
      labels[startIdx] = currentLabel;

      while (queue.length > 0) {
        const idx = queue.pop()!;
        const x = idx % width;
        const y = Math.floor(idx / width);
        const value = state[idx];

        mass += value;
        sumX += x * value;
        sumY += y * value;
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);

        // Check 4-connected neighbors
        const neighbors = [
          { dx: -1, dy: 0 },
          { dx: 1, dy: 0 },
          { dx: 0, dy: -1 },
          { dx: 0, dy: 1 },
        ];

        for (const { dx, dy } of neighbors) {
          const nx = x + dx;
          const ny = y + dy;

          if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
            const nidx = ny * width + nx;
            if (labels[nidx] === 0 && state[nidx] >= threshold) {
              labels[nidx] = currentLabel;
              queue.push(nidx);
            }
          }
        }
      }

      // Only keep components above minimum mass
      if (mass >= minMass) {
        components.push({
          label: currentLabel,
          mass,
          centroidX: sumX / mass,
          centroidY: sumY / mass,
          boundingBox: { minX, maxX, minY, maxY },
        });
      }
    }
  }

  return { labels, components };
}

interface ComponentStats {
  label: number;
  mass: number;
  centroidX: number;
  centroidY: number;
  boundingBox: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
  };
}

/**
 * Match components to existing creatures using Hungarian algorithm (simplified)
 * Uses distance between centroids for matching
 */
export function matchCreatures(
  previousCreatures: Map<number, Creature>,
  newComponents: ComponentStats[],
  maxMatchDistance: number = 50,
): Map<number, number> {
  // Map from component label to creature ID
  const matches = new Map<number, number>();

  if (previousCreatures.size === 0) {
    return matches;
  }

  // Calculate distance matrix
  const prevList = Array.from(previousCreatures.values());
  const distances: { prevId: number; compLabel: number; dist: number }[] = [];

  for (const prev of prevList) {
    for (const comp of newComponents) {
      const dx = comp.centroidX - prev.centroidX;
      const dy = comp.centroidY - prev.centroidY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < maxMatchDistance) {
        distances.push({ prevId: prev.id, compLabel: comp.label, dist });
      }
    }
  }

  // Greedy matching (simple approach - could use Hungarian for optimal)
  distances.sort((a, b) => a.dist - b.dist);

  const usedPrevIds = new Set<number>();
  const usedCompLabels = new Set<number>();

  for (const { prevId, compLabel, dist } of distances) {
    if (!usedPrevIds.has(prevId) && !usedCompLabels.has(compLabel)) {
      matches.set(compLabel, prevId);
      usedPrevIds.add(prevId);
      usedCompLabels.add(compLabel);
    }
  }

  return matches;
}

/**
 * Update tracker with new frame data
 */
export function updateTracker(
  tracker: TrackerState,
  state: Float32Array,
  width: number,
  height: number,
  threshold: number = 0.1,
  minMass: number = 50,
): TrackerState {
  const { labels, components } = findConnectedComponents(
    state,
    width,
    height,
    threshold,
    minMass,
  );

  // Match to existing creatures
  const matches = matchCreatures(tracker.creatures, components);

  // Create new creature map
  const newCreatures = new Map<number, Creature>();

  for (const comp of components) {
    const matchedId = matches.get(comp.label);

    if (matchedId !== undefined) {
      // Update existing creature
      const prev = tracker.creatures.get(matchedId)!;
      newCreatures.set(matchedId, {
        id: matchedId,
        centroidX: comp.centroidX,
        centroidY: comp.centroidY,
        mass: comp.mass,
        boundingBox: comp.boundingBox,
        velocityX: comp.centroidX - prev.centroidX,
        velocityY: comp.centroidY - prev.centroidY,
        age: prev.age + 1,
      });
    } else {
      // Create new creature
      const newId = tracker.nextId;
      newCreatures.set(newId, {
        id: newId,
        centroidX: comp.centroidX,
        centroidY: comp.centroidY,
        mass: comp.mass,
        boundingBox: comp.boundingBox,
        velocityX: 0,
        velocityY: 0,
        age: 0,
      });
    }
  }

  return {
    creatures: newCreatures,
    nextId: Math.max(tracker.nextId, ...Array.from(newCreatures.keys())) + 1,
    frame: tracker.frame + 1,
  };
}

/**
 * Get the largest creature (by mass)
 */
export function getLargestCreature(tracker: TrackerState): Creature | null {
  let largest: Creature | null = null;
  let maxMass = 0;

  for (const creature of tracker.creatures.values()) {
    if (creature.mass > maxMass) {
      maxMass = creature.mass;
      largest = creature;
    }
  }

  return largest;
}

/**
 * Get creature nearest to a point
 */
export function getNearestCreature(
  tracker: TrackerState,
  x: number,
  y: number,
): Creature | null {
  let nearest: Creature | null = null;
  let minDist = Infinity;

  for (const creature of tracker.creatures.values()) {
    const dx = creature.centroidX - x;
    const dy = creature.centroidY - y;
    const dist = dx * dx + dy * dy;

    if (dist < minDist) {
      minDist = dist;
      nearest = creature;
    }
  }

  return nearest;
}
