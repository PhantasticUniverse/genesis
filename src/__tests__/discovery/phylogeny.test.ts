/**
 * Phylogenetic Tree Tests
 * Tests for evolutionary lineage tracking
 */

import { describe, it, expect } from "vitest";
import {
  createPhyloTree,
  addPhyloNode,
  updatePhyloNode,
  markNodesDead,
  markNodeArchived,
  getAncestors,
  getDescendants,
  getLineage,
  layoutTree,
  getTreeStats,
  exportTree,
  importTree,
  type PhyloTree,
  type PhyloNode,
} from "../../discovery/phylogeny";
import type { LeniaGenome } from "../../discovery/genome";

// Helper to create mock genome
function mockGenome(): LeniaGenome {
  return {
    R: 15,
    T: 10,
    b: [0.5],
    m: 0.12,
    s: 0.04,
    kn: 1,
    gn: 2,
  };
}

describe("phylogeny", () => {
  describe("createPhyloTree", () => {
    it("creates empty tree", () => {
      const tree = createPhyloTree();

      expect(tree.nodes.size).toBe(0);
      expect(tree.edges.length).toBe(0);
      expect(tree.rootIds.length).toBe(0);
      expect(tree.generations).toBe(0);
      expect(tree.maxFitness).toBe(0);
      expect(tree.totalNodes).toBe(0);
    });
  });

  describe("addPhyloNode", () => {
    it("adds root node (generation 0)", () => {
      const tree = createPhyloTree();
      const node = addPhyloNode(tree, "root1", mockGenome(), 0, [], "mutation");

      expect(tree.nodes.size).toBe(1);
      expect(tree.nodes.get("root1")).toBe(node);
      expect(tree.rootIds).toContain("root1");
      expect(tree.totalNodes).toBe(1);
      expect(node.generation).toBe(0);
      expect(node.parentIds).toEqual([]);
      expect(node.parentId).toBeNull();
      expect(node.isAlive).toBe(true);
    });

    it("adds child node with parent reference", () => {
      const tree = createPhyloTree();
      addPhyloNode(tree, "parent", mockGenome(), 0, [], "mutation");
      const child = addPhyloNode(
        tree,
        "child",
        mockGenome(),
        1,
        ["parent"],
        "mutation",
      );

      expect(child.parentId).toBe("parent");
      expect(child.parentIds).toEqual(["parent"]);

      const parent = tree.nodes.get("parent")!;
      expect(parent.childIds).toContain("child");
    });

    it("adds edges for parent-child relationships", () => {
      const tree = createPhyloTree();
      addPhyloNode(tree, "parent", mockGenome(), 0, [], "mutation");
      addPhyloNode(tree, "child", mockGenome(), 1, ["parent"], "mutation");

      expect(tree.edges.length).toBe(1);
      expect(tree.edges[0]).toEqual({
        sourceId: "parent",
        targetId: "child",
        type: "mutation",
      });
    });

    it("handles crossover with two parents", () => {
      const tree = createPhyloTree();
      addPhyloNode(tree, "parent1", mockGenome(), 0, [], "mutation");
      addPhyloNode(tree, "parent2", mockGenome(), 0, [], "mutation");
      const child = addPhyloNode(
        tree,
        "child",
        mockGenome(),
        1,
        ["parent1", "parent2"],
        "crossover",
      );

      expect(child.parentIds).toEqual(["parent1", "parent2"]);
      expect(child.parentId).toBe("parent1"); // First parent

      // Both parents should have child reference
      expect(tree.nodes.get("parent1")!.childIds).toContain("child");
      expect(tree.nodes.get("parent2")!.childIds).toContain("child");

      // Two edges for crossover
      expect(tree.edges.length).toBe(2);
    });

    it("updates max generation", () => {
      const tree = createPhyloTree();
      addPhyloNode(tree, "gen0", mockGenome(), 0, [], "mutation");
      expect(tree.generations).toBe(0);

      addPhyloNode(tree, "gen1", mockGenome(), 1, ["gen0"], "mutation");
      expect(tree.generations).toBe(1);

      addPhyloNode(tree, "gen5", mockGenome(), 5, ["gen1"], "mutation");
      expect(tree.generations).toBe(5);
    });

    it("does not add to rootIds for non-zero generation", () => {
      const tree = createPhyloTree();
      addPhyloNode(tree, "root", mockGenome(), 0, [], "mutation");
      addPhyloNode(tree, "child", mockGenome(), 1, ["root"], "mutation");

      expect(tree.rootIds).toEqual(["root"]);
      expect(tree.rootIds).not.toContain("child");
    });
  });

  describe("updatePhyloNode", () => {
    it("updates node fitness and behavior", () => {
      const tree = createPhyloTree();
      addPhyloNode(tree, "node1", mockGenome(), 0, [], "mutation");

      const behavior = {
        avgMass: 100,
        massVariance: 10,
        avgSpeed: 1,
        avgEntropy: 0.5,
        boundingSize: 50,
        lifespan: 0.8,
      };

      updatePhyloNode(tree, "node1", 0.75, behavior, 0.5);

      const node = tree.nodes.get("node1")!;
      expect(node.fitness).toBe(0.75);
      expect(node.behavior).toEqual(behavior);
      expect(node.novelty).toBe(0.5);
    });

    it("updates tree maxFitness", () => {
      const tree = createPhyloTree();
      addPhyloNode(tree, "node1", mockGenome(), 0, [], "mutation");
      addPhyloNode(tree, "node2", mockGenome(), 0, [], "mutation");

      updatePhyloNode(tree, "node1", 0.5, null, 0);
      expect(tree.maxFitness).toBe(0.5);

      updatePhyloNode(tree, "node2", 0.8, null, 0);
      expect(tree.maxFitness).toBe(0.8);

      // Lower fitness shouldn't reduce max
      updatePhyloNode(tree, "node1", 0.3, null, 0);
      expect(tree.maxFitness).toBe(0.8);
    });

    it("handles non-existent node gracefully", () => {
      const tree = createPhyloTree();
      // Should not throw
      updatePhyloNode(tree, "nonexistent", 0.5, null, 0);
      expect(tree.maxFitness).toBe(0);
    });
  });

  describe("markNodesDead", () => {
    it("marks nodes not in alive set as dead", () => {
      const tree = createPhyloTree();
      addPhyloNode(tree, "node1", mockGenome(), 0, [], "mutation");
      addPhyloNode(tree, "node2", mockGenome(), 0, [], "mutation");
      addPhyloNode(tree, "node3", mockGenome(), 0, [], "mutation");

      const aliveIds = new Set(["node1", "node3"]);
      markNodesDead(tree, aliveIds);

      expect(tree.nodes.get("node1")!.isAlive).toBe(true);
      expect(tree.nodes.get("node2")!.isAlive).toBe(false);
      expect(tree.nodes.get("node3")!.isAlive).toBe(true);
    });
  });

  describe("markNodeArchived", () => {
    it("marks node as archived", () => {
      const tree = createPhyloTree();
      addPhyloNode(tree, "node1", mockGenome(), 0, [], "mutation");

      expect(tree.nodes.get("node1")!.isArchived).toBe(false);

      markNodeArchived(tree, "node1");

      expect(tree.nodes.get("node1")!.isArchived).toBe(true);
    });

    it("handles non-existent node gracefully", () => {
      const tree = createPhyloTree();
      // Should not throw
      markNodeArchived(tree, "nonexistent");
    });
  });

  describe("getAncestors", () => {
    it("returns empty array for root node", () => {
      const tree = createPhyloTree();
      addPhyloNode(tree, "root", mockGenome(), 0, [], "mutation");

      const ancestors = getAncestors(tree, "root");
      expect(ancestors).toEqual([]);
    });

    it("returns all ancestors in chain", () => {
      const tree = createPhyloTree();
      addPhyloNode(tree, "grandparent", mockGenome(), 0, [], "mutation");
      addPhyloNode(
        tree,
        "parent",
        mockGenome(),
        1,
        ["grandparent"],
        "mutation",
      );
      addPhyloNode(tree, "child", mockGenome(), 2, ["parent"], "mutation");

      const ancestors = getAncestors(tree, "child");

      expect(ancestors.length).toBe(2);
      expect(ancestors.map((n) => n.id)).toContain("parent");
      expect(ancestors.map((n) => n.id)).toContain("grandparent");
    });

    it("handles crossover ancestors", () => {
      const tree = createPhyloTree();
      addPhyloNode(tree, "parent1", mockGenome(), 0, [], "mutation");
      addPhyloNode(tree, "parent2", mockGenome(), 0, [], "mutation");
      addPhyloNode(
        tree,
        "child",
        mockGenome(),
        1,
        ["parent1", "parent2"],
        "crossover",
      );

      const ancestors = getAncestors(tree, "child");

      expect(ancestors.length).toBe(2);
      expect(ancestors.map((n) => n.id)).toContain("parent1");
      expect(ancestors.map((n) => n.id)).toContain("parent2");
    });
  });

  describe("getDescendants", () => {
    it("returns empty array for leaf node", () => {
      const tree = createPhyloTree();
      addPhyloNode(tree, "leaf", mockGenome(), 0, [], "mutation");

      const descendants = getDescendants(tree, "leaf");
      expect(descendants).toEqual([]);
    });

    it("returns all descendants", () => {
      const tree = createPhyloTree();
      addPhyloNode(tree, "root", mockGenome(), 0, [], "mutation");
      addPhyloNode(tree, "child1", mockGenome(), 1, ["root"], "mutation");
      addPhyloNode(tree, "child2", mockGenome(), 1, ["root"], "mutation");
      addPhyloNode(tree, "grandchild", mockGenome(), 2, ["child1"], "mutation");

      const descendants = getDescendants(tree, "root");

      expect(descendants.length).toBe(3);
      expect(descendants.map((n) => n.id)).toContain("child1");
      expect(descendants.map((n) => n.id)).toContain("child2");
      expect(descendants.map((n) => n.id)).toContain("grandchild");
    });
  });

  describe("getLineage", () => {
    it("returns node itself for root", () => {
      const tree = createPhyloTree();
      addPhyloNode(tree, "root", mockGenome(), 0, [], "mutation");

      const lineage = getLineage(tree, "root");

      expect(lineage.length).toBe(1);
      expect(lineage[0].id).toBe("root");
    });

    it("returns path from root to node", () => {
      const tree = createPhyloTree();
      addPhyloNode(tree, "root", mockGenome(), 0, [], "mutation");
      addPhyloNode(tree, "child", mockGenome(), 1, ["root"], "mutation");
      addPhyloNode(tree, "grandchild", mockGenome(), 2, ["child"], "mutation");

      const lineage = getLineage(tree, "grandchild");

      expect(lineage.length).toBe(3);
      expect(lineage[0].id).toBe("root");
      expect(lineage[1].id).toBe("child");
      expect(lineage[2].id).toBe("grandchild");
    });
  });

  describe("layoutTree", () => {
    it("assigns x and y positions to nodes", () => {
      const tree = createPhyloTree();
      addPhyloNode(tree, "root", mockGenome(), 0, [], "mutation");
      addPhyloNode(tree, "child", mockGenome(), 1, ["root"], "mutation");

      layoutTree(tree);

      const root = tree.nodes.get("root")!;
      const child = tree.nodes.get("child")!;

      expect(root.x).toBeDefined();
      expect(root.y).toBeDefined();
      expect(child.x).toBeDefined();
      expect(child.y).toBeDefined();
    });

    it("positions generations at different y levels", () => {
      const tree = createPhyloTree();
      addPhyloNode(tree, "gen0", mockGenome(), 0, [], "mutation");
      addPhyloNode(tree, "gen1", mockGenome(), 1, ["gen0"], "mutation");
      addPhyloNode(tree, "gen2", mockGenome(), 2, ["gen1"], "mutation");

      layoutTree(tree);

      const gen0 = tree.nodes.get("gen0")!;
      const gen1 = tree.nodes.get("gen1")!;
      const gen2 = tree.nodes.get("gen2")!;

      expect(gen0.y).toBeLessThan(gen1.y!);
      expect(gen1.y).toBeLessThan(gen2.y!);
    });

    it("handles empty tree", () => {
      const tree = createPhyloTree();
      // Should not throw
      layoutTree(tree);
    });
  });

  describe("getTreeStats", () => {
    it("returns correct stats for empty tree", () => {
      const tree = createPhyloTree();
      const stats = getTreeStats(tree);

      expect(stats.totalNodes).toBe(0);
      expect(stats.generations).toBe(0);
      expect(stats.maxFitness).toBe(0);
      expect(stats.aliveCount).toBe(0);
      expect(stats.archivedCount).toBe(0);
      expect(stats.avgBranchingFactor).toBe(0);
    });

    it("counts alive and archived nodes", () => {
      const tree = createPhyloTree();
      addPhyloNode(tree, "alive", mockGenome(), 0, [], "mutation");
      addPhyloNode(tree, "dead", mockGenome(), 0, [], "mutation");
      addPhyloNode(tree, "archived", mockGenome(), 0, [], "mutation");

      markNodesDead(tree, new Set(["alive", "archived"]));
      markNodeArchived(tree, "archived");

      const stats = getTreeStats(tree);

      expect(stats.totalNodes).toBe(3);
      expect(stats.aliveCount).toBe(2);
      expect(stats.archivedCount).toBe(1);
    });

    it("calculates branching factor", () => {
      const tree = createPhyloTree();
      addPhyloNode(tree, "root", mockGenome(), 0, [], "mutation");
      addPhyloNode(tree, "child1", mockGenome(), 1, ["root"], "mutation");
      addPhyloNode(tree, "child2", mockGenome(), 1, ["root"], "mutation");

      const stats = getTreeStats(tree);

      // Root has 2 children, others have 0
      // Only root has children, so avg = 2
      expect(stats.avgBranchingFactor).toBe(2);
    });
  });

  describe("exportTree / importTree", () => {
    it("round-trips tree data", () => {
      const tree = createPhyloTree();
      addPhyloNode(tree, "root", mockGenome(), 0, [], "mutation");
      addPhyloNode(tree, "child", mockGenome(), 1, ["root"], "mutation");
      updatePhyloNode(tree, "root", 0.5, null, 0.3);
      markNodesDead(tree, new Set(["child"]));
      markNodeArchived(tree, "root");

      const json = exportTree(tree);
      const imported = importTree(json);

      expect(imported.nodes.size).toBe(2);
      expect(imported.edges.length).toBe(1);
      expect(imported.rootIds).toEqual(["root"]);
      expect(imported.generations).toBe(1);
      expect(imported.maxFitness).toBe(0.5);
      expect(imported.totalNodes).toBe(2);

      const importedRoot = imported.nodes.get("root")!;
      expect(importedRoot.fitness).toBe(0.5);
      expect(importedRoot.isArchived).toBe(true);
    });

    it("produces valid JSON", () => {
      const tree = createPhyloTree();
      addPhyloNode(tree, "node", mockGenome(), 0, [], "mutation");

      const json = exportTree(tree);
      expect(() => JSON.parse(json)).not.toThrow();
    });
  });
});
