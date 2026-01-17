/**
 * Spatial Index for Novelty Search
 * Implements a KD-Tree for efficient k-nearest neighbor queries in behavior space
 *
 * Reduces novelty calculation from O(n²) to O(n log n) for large populations
 */

import type { BehaviorVector } from "./fitness";

/**
 * Weights for behavior distance calculation
 * Must match behaviorDistance() in fitness.ts
 */
export const BEHAVIOR_WEIGHTS = {
  avgMass: 1,
  massVariance: 0.5,
  avgSpeed: 1.5,
  avgEntropy: 1,
  boundingSize: 0.5,
  lifespan: 2,
} as const;

/**
 * Dimension names in order for KD-tree traversal
 */
const DIMENSIONS: (keyof BehaviorVector)[] = [
  "avgMass",
  "massVariance",
  "avgSpeed",
  "avgEntropy",
  "boundingSize",
  "lifespan",
];

/**
 * KD-Tree node
 */
interface KDNode<T> {
  point: BehaviorVector;
  data: T;
  left: KDNode<T> | null;
  right: KDNode<T> | null;
  splitDimension: number;
}

/**
 * Priority queue item for k-nearest search
 */
interface NearestCandidate<T> {
  distance: number;
  data: T;
  point: BehaviorVector;
}

/**
 * Calculate weighted squared distance between two behavior vectors
 */
export function weightedSquaredDistance(
  a: BehaviorVector,
  b: BehaviorVector,
): number {
  let sum = 0;
  for (const dim of DIMENSIONS) {
    const diff = a[dim] - b[dim];
    sum += BEHAVIOR_WEIGHTS[dim] * diff * diff;
  }
  return sum;
}

/**
 * Calculate weighted distance (with sqrt)
 */
export function weightedDistance(a: BehaviorVector, b: BehaviorVector): number {
  return Math.sqrt(weightedSquaredDistance(a, b));
}

/**
 * KD-Tree for efficient nearest neighbor search in behavior space
 */
export class BehaviorKDTree<T> {
  private root: KDNode<T> | null = null;
  private size = 0;

  /**
   * Build a KD-tree from an array of items
   */
  static build<T>(
    items: Array<{ behavior: BehaviorVector; data: T }>,
  ): BehaviorKDTree<T> {
    const tree = new BehaviorKDTree<T>();

    if (items.length === 0) {
      return tree;
    }

    // Build recursively using median selection for balance
    tree.root = tree.buildRecursive(items, 0);
    tree.size = items.length;

    return tree;
  }

  /**
   * Build tree recursively
   */
  private buildRecursive(
    items: Array<{ behavior: BehaviorVector; data: T }>,
    depth: number,
  ): KDNode<T> | null {
    if (items.length === 0) return null;

    const dimension = depth % DIMENSIONS.length;
    const dimKey = DIMENSIONS[dimension];

    // Sort by current dimension and select median
    items.sort((a, b) => a.behavior[dimKey] - b.behavior[dimKey]);
    const medianIndex = Math.floor(items.length / 2);

    const node: KDNode<T> = {
      point: items[medianIndex].behavior,
      data: items[medianIndex].data,
      splitDimension: dimension,
      left: this.buildRecursive(items.slice(0, medianIndex), depth + 1),
      right: this.buildRecursive(items.slice(medianIndex + 1), depth + 1),
    };

    return node;
  }

  /**
   * Get number of items in the tree
   */
  getSize(): number {
    return this.size;
  }

  /**
   * Check if tree is empty
   */
  isEmpty(): boolean {
    return this.size === 0;
  }

  /**
   * Find k nearest neighbors to a query point
   * Optionally exclude items matching a predicate
   */
  kNearest(
    query: BehaviorVector,
    k: number,
    excludeFn?: (data: T) => boolean,
  ): Array<{ distance: number; data: T; point: BehaviorVector }> {
    if (this.root === null || k <= 0) {
      return [];
    }

    // Use a max-heap to track k nearest (we want to replace the farthest)
    const candidates: NearestCandidate<T>[] = [];

    this.searchRecursive(this.root, query, k, candidates, excludeFn);

    // Sort by distance ascending
    candidates.sort((a, b) => a.distance - b.distance);

    return candidates;
  }

  /**
   * Recursive k-nearest search
   */
  private searchRecursive(
    node: KDNode<T> | null,
    query: BehaviorVector,
    k: number,
    candidates: NearestCandidate<T>[],
    excludeFn?: (data: T) => boolean,
  ): void {
    if (node === null) return;

    // Check if this node should be excluded
    const shouldExclude = excludeFn ? excludeFn(node.data) : false;

    if (!shouldExclude) {
      const dist = weightedDistance(query, node.point);

      if (candidates.length < k) {
        // Still have room, add this candidate
        candidates.push({ distance: dist, data: node.data, point: node.point });
        // Keep sorted by distance descending (max at front for easy comparison)
        candidates.sort((a, b) => b.distance - a.distance);
      } else if (dist < candidates[0].distance) {
        // Better than worst candidate, replace it
        candidates[0] = { distance: dist, data: node.data, point: node.point };
        candidates.sort((a, b) => b.distance - a.distance);
      }
    }

    // Determine which subtree to search first
    const dimKey = DIMENSIONS[node.splitDimension];
    const queryValue = query[dimKey];
    const nodeValue = node.point[dimKey];
    const weight = BEHAVIOR_WEIGHTS[dimKey];

    const goLeft = queryValue < nodeValue;
    const firstChild = goLeft ? node.left : node.right;
    const secondChild = goLeft ? node.right : node.left;

    // Search the closer subtree first
    this.searchRecursive(firstChild, query, k, candidates, excludeFn);

    // Check if we need to search the other subtree
    // Only if the splitting plane could contain closer points
    const splitDistance = Math.sqrt(weight) * Math.abs(queryValue - nodeValue);

    if (candidates.length < k || splitDistance < candidates[0].distance) {
      this.searchRecursive(secondChild, query, k, candidates, excludeFn);
    }
  }

  /**
   * Calculate average distance to k nearest neighbors (novelty score)
   */
  noveltyScore(
    query: BehaviorVector,
    k: number,
    excludeFn?: (data: T) => boolean,
  ): number {
    const neighbors = this.kNearest(query, k, excludeFn);

    if (neighbors.length === 0) {
      return 1; // Maximum novelty if no neighbors
    }

    const totalDistance = neighbors.reduce((sum, n) => sum + n.distance, 0);
    return totalDistance / neighbors.length;
  }
}

/**
 * Create a behavior KD-tree from individuals with behavior vectors
 */
export function createBehaviorIndex<T extends { id: string }>(
  items: Array<{ behavior: BehaviorVector | null; data: T }>,
): BehaviorKDTree<T> {
  // Filter to items with behavior vectors
  const validItems = items.filter(
    (item): item is { behavior: BehaviorVector; data: T } =>
      item.behavior !== null,
  );

  return BehaviorKDTree.build(validItems);
}
