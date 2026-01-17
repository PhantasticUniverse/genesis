/**
 * Phylogenetic Tree Data Structure
 * Tracks evolutionary lineage of organisms
 */

import type { LeniaGenome } from "./genome";
import type { FitnessMetrics, BehaviorVector } from "./fitness";

export interface PhyloNode {
  id: string;
  genome: LeniaGenome;
  generation: number;
  parentId: string | null;
  parentIds: string[]; // For crossover, both parents
  childIds: string[];
  fitness: number;
  behavior: BehaviorVector | null;
  novelty: number;
  birthTime: number; // When this node was created
  isAlive: boolean; // Still in current population
  isArchived: boolean; // In novelty archive
  x?: number; // Layout position
  y?: number; // Layout position
}

export interface PhyloEdge {
  sourceId: string;
  targetId: string;
  type: "mutation" | "crossover" | "elite";
}

export interface PhyloTree {
  nodes: Map<string, PhyloNode>;
  edges: PhyloEdge[];
  rootIds: string[]; // Generation 0 nodes
  generations: number;
  maxFitness: number;
  totalNodes: number;
}

/**
 * Create empty phylogenetic tree
 */
export function createPhyloTree(): PhyloTree {
  return {
    nodes: new Map(),
    edges: [],
    rootIds: [],
    generations: 0,
    maxFitness: 0,
    totalNodes: 0,
  };
}

/**
 * Add a node to the tree
 */
export function addPhyloNode(
  tree: PhyloTree,
  id: string,
  genome: LeniaGenome,
  generation: number,
  parentIds: string[],
  edgeType: "mutation" | "crossover" | "elite",
): PhyloNode {
  const node: PhyloNode = {
    id,
    genome: { ...genome },
    generation,
    parentId: parentIds[0] ?? null,
    parentIds,
    childIds: [],
    fitness: 0,
    behavior: null,
    novelty: 0,
    birthTime: Date.now(),
    isAlive: true,
    isArchived: false,
  };

  tree.nodes.set(id, node);
  tree.totalNodes++;

  // Update parent references
  for (const parentId of parentIds) {
    const parent = tree.nodes.get(parentId);
    if (parent && !parent.childIds.includes(id)) {
      parent.childIds.push(id);
    }

    // Add edge
    tree.edges.push({
      sourceId: parentId,
      targetId: id,
      type: edgeType,
    });
  }

  // Track root nodes (generation 0)
  if (generation === 0) {
    tree.rootIds.push(id);
  }

  // Update max generation
  if (generation > tree.generations) {
    tree.generations = generation;
  }

  return node;
}

/**
 * Update node fitness and behavior
 */
export function updatePhyloNode(
  tree: PhyloTree,
  id: string,
  fitness: number,
  behavior: BehaviorVector | null,
  novelty: number,
): void {
  const node = tree.nodes.get(id);
  if (node) {
    node.fitness = fitness;
    node.behavior = behavior;
    node.novelty = novelty;

    if (fitness > tree.maxFitness) {
      tree.maxFitness = fitness;
    }
  }
}

/**
 * Mark nodes as dead (no longer in population)
 */
export function markNodesDead(tree: PhyloTree, aliveIds: Set<string>): void {
  for (const node of tree.nodes.values()) {
    node.isAlive = aliveIds.has(node.id);
  }
}

/**
 * Mark node as archived
 */
export function markNodeArchived(tree: PhyloTree, id: string): void {
  const node = tree.nodes.get(id);
  if (node) {
    node.isArchived = true;
  }
}

/**
 * Get all ancestors of a node
 */
export function getAncestors(tree: PhyloTree, id: string): PhyloNode[] {
  const ancestors: PhyloNode[] = [];
  const visited = new Set<string>();
  const queue = [id];

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    if (visited.has(currentId)) continue;
    visited.add(currentId);

    const node = tree.nodes.get(currentId);
    if (!node) continue;

    for (const parentId of node.parentIds) {
      const parent = tree.nodes.get(parentId);
      if (parent && !visited.has(parentId)) {
        ancestors.push(parent);
        queue.push(parentId);
      }
    }
  }

  return ancestors;
}

/**
 * Get all descendants of a node
 */
export function getDescendants(tree: PhyloTree, id: string): PhyloNode[] {
  const descendants: PhyloNode[] = [];
  const visited = new Set<string>();
  const queue = [id];

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    if (visited.has(currentId)) continue;
    visited.add(currentId);

    const node = tree.nodes.get(currentId);
    if (!node) continue;

    for (const childId of node.childIds) {
      const child = tree.nodes.get(childId);
      if (child && !visited.has(childId)) {
        descendants.push(child);
        queue.push(childId);
      }
    }
  }

  return descendants;
}

/**
 * Get lineage from root to node
 */
export function getLineage(tree: PhyloTree, id: string): PhyloNode[] {
  const lineage: PhyloNode[] = [];
  let currentId: string | null = id;

  while (currentId) {
    const node = tree.nodes.get(currentId);
    if (!node) break;
    lineage.unshift(node);
    currentId = node.parentId;
  }

  return lineage;
}

/**
 * Calculate tree layout using simple force-directed positioning
 */
export function layoutTree(tree: PhyloTree): void {
  // Position nodes by generation (y) and spread within generation (x)
  const nodesByGen = new Map<number, PhyloNode[]>();

  for (const node of tree.nodes.values()) {
    const gen = node.generation;
    if (!nodesByGen.has(gen)) {
      nodesByGen.set(gen, []);
    }
    nodesByGen.get(gen)!.push(node);
  }

  // Layout each generation
  for (const [gen, nodes] of nodesByGen) {
    const y = gen * 60; // Vertical spacing between generations

    // Sort nodes by parent position for better visual flow
    nodes.sort((a, b) => {
      const aParent = a.parentId ? tree.nodes.get(a.parentId) : null;
      const bParent = b.parentId ? tree.nodes.get(b.parentId) : null;
      const aX = aParent?.x ?? 0;
      const bX = bParent?.x ?? 0;
      return aX - bX;
    });

    // Spread horizontally
    const width = nodes.length * 40;
    const startX = -width / 2;

    nodes.forEach((node, idx) => {
      node.x = startX + idx * 40 + 20;
      node.y = y;
    });
  }

  // Simple force-directed refinement (few iterations)
  for (let iter = 0; iter < 10; iter++) {
    for (const node of tree.nodes.values()) {
      if (node.generation === 0) continue;

      // Pull toward parent average
      let targetX = 0;
      for (const parentId of node.parentIds) {
        const parent = tree.nodes.get(parentId);
        if (parent?.x !== undefined) {
          targetX += parent.x;
        }
      }
      if (node.parentIds.length > 0) {
        targetX /= node.parentIds.length;
        node.x = node.x! * 0.7 + targetX * 0.3;
      }
    }
  }
}

/**
 * Get tree statistics
 */
export function getTreeStats(tree: PhyloTree): {
  totalNodes: number;
  generations: number;
  maxFitness: number;
  aliveCount: number;
  archivedCount: number;
  avgBranchingFactor: number;
} {
  let aliveCount = 0;
  let archivedCount = 0;
  let totalChildren = 0;
  let nodesWithChildren = 0;

  for (const node of tree.nodes.values()) {
    if (node.isAlive) aliveCount++;
    if (node.isArchived) archivedCount++;
    if (node.childIds.length > 0) {
      totalChildren += node.childIds.length;
      nodesWithChildren++;
    }
  }

  return {
    totalNodes: tree.totalNodes,
    generations: tree.generations,
    maxFitness: tree.maxFitness,
    aliveCount,
    archivedCount,
    avgBranchingFactor:
      nodesWithChildren > 0 ? totalChildren / nodesWithChildren : 0,
  };
}

/**
 * Export tree to JSON for persistence
 */
export function exportTree(tree: PhyloTree): string {
  return JSON.stringify({
    nodes: Array.from(tree.nodes.entries()),
    edges: tree.edges,
    rootIds: tree.rootIds,
    generations: tree.generations,
    maxFitness: tree.maxFitness,
    totalNodes: tree.totalNodes,
  });
}

/**
 * Import tree from JSON
 */
export function importTree(json: string): PhyloTree {
  const data = JSON.parse(json);
  return {
    nodes: new Map(data.nodes),
    edges: data.edges,
    rootIds: data.rootIds,
    generations: data.generations,
    maxFitness: data.maxFitness,
    totalNodes: data.totalNodes,
  };
}
