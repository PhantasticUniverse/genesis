/**
 * Genetic Algorithm Tests
 * Tests for GA controller, population evolution, and novelty search
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createPopulation,
  calculateNovelty,
  tournamentSelect,
  evolvePopulation,
  updateArchive,
  createGAController,
  isEvaluated,
  hasBehavior,
  type Individual,
  type GAState,
  type GAConfig,
} from "../../discovery/genetic-algorithm";
import type { FitnessMetrics, BehaviorVector } from "../../discovery/fitness";

// Helper to create a mock individual with behavior
function createMockIndividual(overrides: Partial<Individual> = {}): Individual {
  return {
    genome: {
      R: 15,
      T: 10,
      b: [0.5],
      m: 0.12,
      s: 0.04,
      kn: 1,
      gn: 2,
    },
    fitness: null,
    behavior: null,
    novelty: 0,
    id: `ind-${Math.random().toString(36).substr(2, 9)}`,
    generation: 0,
    parentIds: [],
    birthType: "random",
    ...overrides,
  };
}

// Helper to create mock fitness metrics
function createMockFitness(overall: number = 0.5): FitnessMetrics {
  return {
    survival: overall,
    stability: overall,
    complexity: overall,
    symmetry: overall,
    movement: overall,
    overall,
  };
}

// Helper to create mock behavior vector
function createMockBehavior(seed: number = 0): BehaviorVector {
  return {
    avgMass: 100 + seed * 10,
    massVariance: 10 + seed,
    avgSpeed: 1 + seed * 0.1,
    avgEntropy: 0.5 + seed * 0.05,
    boundingSize: 50 + seed * 5,
    lifespan: 0.5 + seed * 0.1,
  };
}

describe("genetic algorithm", () => {
  describe("createPopulation", () => {
    it("creates population of correct size", () => {
      const pop = createPopulation(10);
      expect(pop.length).toBe(10);
    });

    it("creates population with null fitness initially", () => {
      const pop = createPopulation(5);
      pop.forEach((ind) => {
        expect(ind.fitness).toBeNull();
        expect(ind.behavior).toBeNull();
      });
    });

    it("creates population with unique IDs", () => {
      const pop = createPopulation(10);
      const ids = new Set(pop.map((ind) => ind.id));
      expect(ids.size).toBe(10);
    });

    it("creates population at generation 0", () => {
      const pop = createPopulation(5);
      pop.forEach((ind) => {
        expect(ind.generation).toBe(0);
      });
    });

    it("creates population with random birth type", () => {
      const pop = createPopulation(5);
      pop.forEach((ind) => {
        expect(ind.birthType).toBe("random");
      });
    });

    it("creates population with empty parent IDs", () => {
      const pop = createPopulation(5);
      pop.forEach((ind) => {
        expect(ind.parentIds).toEqual([]);
      });
    });

    it("handles zero size", () => {
      const pop = createPopulation(0);
      expect(pop.length).toBe(0);
    });
  });

  describe("calculateNovelty", () => {
    it("returns 0 for individual without behavior", () => {
      const ind = createMockIndividual({ behavior: null });
      const novelty = calculateNovelty(ind, [], [], 5);
      expect(novelty).toBe(0);
    });

    it("returns 1 for only individual with behavior", () => {
      const ind = createMockIndividual({ behavior: createMockBehavior() });
      const novelty = calculateNovelty(ind, [], [], 5);
      expect(novelty).toBe(1);
    });

    it("returns 1 when no other individuals have behavior", () => {
      const ind = createMockIndividual({ behavior: createMockBehavior() });
      const others = [
        createMockIndividual({ behavior: null }),
        createMockIndividual({ behavior: null }),
      ];
      const novelty = calculateNovelty(ind, others, [], 5);
      expect(novelty).toBe(1);
    });

    it("calculates distance to nearest neighbors", () => {
      const ind = createMockIndividual({
        id: "test",
        behavior: createMockBehavior(0),
      });

      const similar = createMockIndividual({
        id: "similar",
        behavior: createMockBehavior(0.1), // Very similar
      });

      const different = createMockIndividual({
        id: "different",
        behavior: createMockBehavior(10), // Very different
      });

      const noveltyWithSimilar = calculateNovelty(ind, [similar], [], 5);
      const noveltyWithDifferent = calculateNovelty(ind, [different], [], 5);

      expect(noveltyWithSimilar).toBeLessThan(noveltyWithDifferent);
    });

    it("excludes self from comparison", () => {
      const ind = createMockIndividual({
        id: "self",
        behavior: createMockBehavior(),
      });

      // Include self in population
      const novelty = calculateNovelty(ind, [ind], [], 5);
      expect(novelty).toBe(1); // Should treat as if no others
    });

    it("uses k nearest neighbors", () => {
      const ind = createMockIndividual({ behavior: createMockBehavior(0) });

      // Create neighbors at different distances
      const neighbors = [
        createMockIndividual({ behavior: createMockBehavior(1) }),
        createMockIndividual({ behavior: createMockBehavior(2) }),
        createMockIndividual({ behavior: createMockBehavior(10) }), // Far away
      ];

      const noveltyK2 = calculateNovelty(ind, neighbors, [], 2);
      const noveltyK3 = calculateNovelty(ind, neighbors, [], 3);

      // k=3 should include the far neighbor, increasing average distance
      expect(noveltyK3).toBeGreaterThan(noveltyK2);
    });

    it("combines population and archive", () => {
      const ind = createMockIndividual({ behavior: createMockBehavior(0) });

      const popNeighbor = createMockIndividual({
        behavior: createMockBehavior(1),
      });
      const archiveNeighbor = createMockIndividual({
        behavior: createMockBehavior(2),
      });

      const noveltyPopOnly = calculateNovelty(ind, [popNeighbor], [], 5);
      const noveltyBoth = calculateNovelty(
        ind,
        [popNeighbor],
        [archiveNeighbor],
        5,
      );

      // With archive neighbor closer in behavior space, novelty changes
      expect(noveltyPopOnly).not.toBe(noveltyBoth);
    });
  });

  describe("tournamentSelect", () => {
    it("selects from population", () => {
      const population = [
        createMockIndividual({ id: "a", fitness: createMockFitness(0.8) }),
        createMockIndividual({ id: "b", fitness: createMockFitness(0.5) }),
        createMockIndividual({ id: "c", fitness: createMockFitness(0.3) }),
      ];

      const selected = tournamentSelect(population, 2, 0);
      expect(population.some((ind) => ind.id === selected.id)).toBe(true);
    });

    it("tends to select fitter individuals", () => {
      const highFit = createMockIndividual({
        id: "high",
        fitness: createMockFitness(1.0),
        novelty: 0,
      });
      const lowFit = createMockIndividual({
        id: "low",
        fitness: createMockFitness(0.0),
        novelty: 0,
      });
      const population = [highFit, lowFit];

      let highCount = 0;
      for (let i = 0; i < 100; i++) {
        const selected = tournamentSelect(population, 2, 0); // No novelty weight
        if (selected.id === "high") highCount++;
      }

      // High fitness should be selected more often
      expect(highCount).toBeGreaterThan(50);
    });

    it("considers novelty with weight", () => {
      const highFitLowNovelty = createMockIndividual({
        id: "fit",
        fitness: createMockFitness(1.0),
        novelty: 0,
      });
      const lowFitHighNovelty = createMockIndividual({
        id: "novel",
        fitness: createMockFitness(0.0),
        novelty: 1.0,
      });
      const population = [highFitLowNovelty, lowFitHighNovelty];

      // With novelty weight = 1, novelty dominates
      let novelCount = 0;
      for (let i = 0; i < 100; i++) {
        const selected = tournamentSelect(population, 2, 1.0);
        if (selected.id === "novel") novelCount++;
      }

      expect(novelCount).toBeGreaterThan(50);
    });
  });

  describe("evolvePopulation", () => {
    it("creates new generation with correct size", () => {
      const state: GAState = {
        population: createPopulation(30).map((ind, i) => ({
          ...ind,
          fitness: createMockFitness(i / 30),
          behavior: createMockBehavior(i),
        })),
        archive: [],
        generation: 0,
        bestFitness: 0,
        bestIndividual: null,
        phyloTree: { nodes: new Map(), edges: [] },
      };

      const config: GAConfig = {
        populationSize: 30,
        eliteCount: 3,
        mutationRate: 0.15,
        crossoverRate: 0.7,
        tournamentSize: 3,
        noveltyWeight: 0.3,
        noveltyK: 5,
      };

      const newPop = evolvePopulation(state, config);
      expect(newPop.length).toBe(30);
    });

    it("increments generation", () => {
      const state: GAState = {
        population: createPopulation(10).map((ind, i) => ({
          ...ind,
          fitness: createMockFitness(i / 10),
          behavior: createMockBehavior(i),
        })),
        archive: [],
        generation: 5,
        bestFitness: 0,
        bestIndividual: null,
        phyloTree: { nodes: new Map(), edges: [] },
      };

      const newPop = evolvePopulation(state);
      expect(newPop[0].generation).toBe(6);
    });

    it("preserves elites", () => {
      const state: GAState = {
        population: createPopulation(10).map((ind, i) => ({
          ...ind,
          fitness: createMockFitness(i / 10),
          behavior: createMockBehavior(i),
          novelty: 0,
        })),
        archive: [],
        generation: 0,
        bestFitness: 0,
        bestIndividual: null,
        phyloTree: { nodes: new Map(), edges: [] },
      };

      const config: GAConfig = {
        populationSize: 10,
        eliteCount: 2,
        mutationRate: 0.15,
        crossoverRate: 0.7,
        tournamentSize: 3,
        noveltyWeight: 0,
        noveltyK: 5,
      };

      const newPop = evolvePopulation(state, config);
      const elites = newPop.filter((ind) => ind.birthType === "elite");

      expect(elites.length).toBe(2);
    });

    it("resets fitness and behavior for new individuals", () => {
      const state: GAState = {
        population: createPopulation(10).map((ind, i) => ({
          ...ind,
          fitness: createMockFitness(0.5),
          behavior: createMockBehavior(i),
        })),
        archive: [],
        generation: 0,
        bestFitness: 0,
        bestIndividual: null,
        phyloTree: { nodes: new Map(), edges: [] },
      };

      const newPop = evolvePopulation(state);

      // All new individuals should have null fitness/behavior
      newPop.forEach((ind) => {
        expect(ind.fitness).toBeNull();
        expect(ind.behavior).toBeNull();
      });
    });

    it("tracks parent IDs for offspring", () => {
      const state: GAState = {
        population: createPopulation(10).map((ind, i) => ({
          ...ind,
          fitness: createMockFitness(i / 10),
          behavior: createMockBehavior(i),
        })),
        archive: [],
        generation: 0,
        bestFitness: 0,
        bestIndividual: null,
        phyloTree: { nodes: new Map(), edges: [] },
      };

      const newPop = evolvePopulation(state);

      // Non-elite individuals should have parent IDs
      const nonElites = newPop.filter((ind) => ind.birthType !== "elite");
      nonElites.forEach((ind) => {
        expect(ind.parentIds.length).toBeGreaterThan(0);
      });
    });
  });

  describe("updateArchive", () => {
    it("adds novel individuals to archive", () => {
      const archive: Individual[] = [];
      const population = [
        createMockIndividual({
          novelty: 0.5,
          behavior: createMockBehavior(),
        }),
      ];

      const newArchive = updateArchive(archive, population, 100, 0.3);
      expect(newArchive.length).toBe(1);
    });

    it("does not add individuals below novelty threshold", () => {
      const archive: Individual[] = [];
      const population = [
        createMockIndividual({
          novelty: 0.2,
          behavior: createMockBehavior(),
        }),
      ];

      const newArchive = updateArchive(archive, population, 100, 0.3);
      expect(newArchive.length).toBe(0);
    });

    it("does not add individuals without behavior", () => {
      const archive: Individual[] = [];
      const population = [
        createMockIndividual({
          novelty: 0.5,
          behavior: null,
        }),
      ];

      const newArchive = updateArchive(archive, population, 100, 0.3);
      expect(newArchive.length).toBe(0);
    });

    it("trims archive to max size", () => {
      const archive: Individual[] = [];
      const population = Array(20)
        .fill(null)
        .map((_, i) =>
          createMockIndividual({
            novelty: 0.5 + i * 0.01,
            behavior: createMockBehavior(i),
          }),
        );

      const newArchive = updateArchive(archive, population, 10, 0.3);
      expect(newArchive.length).toBe(10);
    });

    it("keeps most novel when trimming", () => {
      const archive: Individual[] = [];
      const population = Array(20)
        .fill(null)
        .map((_, i) =>
          createMockIndividual({
            id: `ind-${i}`,
            novelty: i * 0.05 + 0.3, // Higher i = higher novelty
            behavior: createMockBehavior(i),
          }),
        );

      const newArchive = updateArchive(archive, population, 10, 0.3);

      // Should keep the 10 most novel (indices 10-19)
      const avgNovelty =
        newArchive.reduce((sum, ind) => sum + ind.novelty, 0) / 10;
      expect(avgNovelty).toBeGreaterThan(0.6);
    });

    it("clones genomes when archiving", () => {
      const archive: Individual[] = [];
      const original = createMockIndividual({
        novelty: 0.5,
        behavior: createMockBehavior(),
      });

      const newArchive = updateArchive(archive, [original], 100, 0.3);

      // Modify original
      original.genome.R = 999;

      // Archive should not be affected
      expect(newArchive[0].genome.R).not.toBe(999);
    });
  });

  describe("createGAController", () => {
    it("creates controller with default config", () => {
      const controller = createGAController();
      const config = controller.getConfig();

      expect(config.populationSize).toBe(30);
      expect(config.eliteCount).toBe(3);
    });

    it("creates controller with custom config", () => {
      const controller = createGAController({
        populationSize: 50,
        eliteCount: 5,
      });

      const config = controller.getConfig();
      expect(config.populationSize).toBe(50);
      expect(config.eliteCount).toBe(5);
    });

    it("initializes population", () => {
      const controller = createGAController({ populationSize: 10 });
      const population = controller.getPopulation();
      expect(population.length).toBe(10);
    });

    it("getNextToEvaluate returns individual without fitness", () => {
      const controller = createGAController({ populationSize: 5 });
      const next = controller.getNextToEvaluate();

      expect(next).not.toBeNull();
      expect(next!.fitness).toBeNull();
    });

    it("getNextToEvaluate returns null when all evaluated", () => {
      const controller = createGAController({ populationSize: 2 });
      const state = controller.getState();

      // Manually set fitness for all
      state.population.forEach((ind) => {
        ind.fitness = createMockFitness();
        ind.behavior = createMockBehavior();
      });

      expect(controller.getNextToEvaluate()).toBeNull();
    });

    it("setFitness updates individual", () => {
      const controller = createGAController({ populationSize: 5 });
      const ind = controller.getPopulation()[0];
      const fitness = createMockFitness(0.8);
      const behavior = createMockBehavior();

      controller.setFitness(ind.id, fitness, behavior);

      const updated = controller.getPopulation().find((i) => i.id === ind.id);
      expect(updated!.fitness).toBe(fitness);
      expect(updated!.behavior).toBe(behavior);
    });

    it("setFitness updates best individual", () => {
      const controller = createGAController({ populationSize: 2 });
      const pop = controller.getPopulation();

      controller.setFitness(
        pop[0].id,
        createMockFitness(0.3),
        createMockBehavior(),
      );
      expect(controller.getState().bestFitness).toBe(0.3);

      controller.setFitness(
        pop[1].id,
        createMockFitness(0.8),
        createMockBehavior(1),
      );
      expect(controller.getState().bestFitness).toBe(0.8);
      expect(controller.getState().bestIndividual!.id).toBe(pop[1].id);
    });

    it("isGenerationComplete returns false when not all evaluated", () => {
      const controller = createGAController({ populationSize: 5 });
      expect(controller.isGenerationComplete()).toBe(false);
    });

    it("isGenerationComplete returns true when all evaluated", () => {
      const controller = createGAController({ populationSize: 2 });
      const pop = controller.getPopulation();

      controller.setFitness(
        pop[0].id,
        createMockFitness(),
        createMockBehavior(),
      );
      expect(controller.isGenerationComplete()).toBe(false);

      controller.setFitness(
        pop[1].id,
        createMockFitness(),
        createMockBehavior(1),
      );
      expect(controller.isGenerationComplete()).toBe(true);
    });

    it("evolve only works when generation complete", () => {
      const controller = createGAController({ populationSize: 2 });

      // Not complete yet
      controller.evolve();
      expect(controller.getState().generation).toBe(0);

      // Complete generation
      const pop = controller.getPopulation();
      controller.setFitness(
        pop[0].id,
        createMockFitness(),
        createMockBehavior(),
      );
      controller.setFitness(
        pop[1].id,
        createMockFitness(),
        createMockBehavior(1),
      );

      controller.evolve();
      expect(controller.getState().generation).toBe(1);
    });

    it("reset creates new population", () => {
      const controller = createGAController({ populationSize: 5 });

      // Evaluate some individuals and evolve
      const pop = controller.getPopulation();
      pop.forEach((ind, i) => {
        controller.setFitness(
          ind.id,
          createMockFitness(i / 5),
          createMockBehavior(i),
        );
      });
      controller.evolve();

      expect(controller.getState().generation).toBe(1);

      controller.reset();

      // After reset, generation should be 0 and archive cleared
      expect(controller.getState().generation).toBe(0);
      expect(controller.getArchive()).toEqual([]);
      expect(controller.getState().bestFitness).toBe(0);
      expect(controller.getState().bestIndividual).toBeNull();
    });

    it("getArchive returns archive", () => {
      const controller = createGAController({ populationSize: 2 });
      expect(controller.getArchive()).toEqual([]);
    });

    it("getPhyloTree returns tree", () => {
      const controller = createGAController({ populationSize: 2 });
      const tree = controller.getPhyloTree();
      expect(tree).toBeDefined();
      expect(tree.nodes).toBeDefined();
    });
  });

  describe("isEvaluated", () => {
    it("returns true when individual has fitness and behavior", () => {
      const ind = createMockIndividual({
        fitness: createMockFitness(),
        behavior: createMockBehavior(),
      });
      expect(isEvaluated(ind)).toBe(true);
    });

    it("returns false when individual has no fitness", () => {
      const ind = createMockIndividual({
        fitness: null,
        behavior: createMockBehavior(),
      });
      expect(isEvaluated(ind)).toBe(false);
    });

    it("returns false when individual has no behavior", () => {
      const ind = createMockIndividual({
        fitness: createMockFitness(),
        behavior: null,
      });
      expect(isEvaluated(ind)).toBe(false);
    });

    it("returns false when individual has neither", () => {
      const ind = createMockIndividual();
      expect(isEvaluated(ind)).toBe(false);
    });
  });

  describe("hasBehavior", () => {
    it("returns true when individual has behavior", () => {
      const ind = createMockIndividual({ behavior: createMockBehavior() });
      expect(hasBehavior(ind)).toBe(true);
    });

    it("returns false when individual has no behavior", () => {
      const ind = createMockIndividual({ behavior: null });
      expect(hasBehavior(ind)).toBe(false);
    });
  });
});
