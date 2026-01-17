/**
 * Integration Tests: Discovery → Persistence Workflow
 * Tests the full workflow of discovering organisms, evaluating fitness,
 * and saving/loading them from storage.
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  createPopulation,
  evolvePopulation,
  tournamentSelect,
  updateArchive,
  type Individual,
  type GAState,
} from "../../discovery/genetic-algorithm";
import {
  calculateMass,
  calculateSymmetry,
  calculateEntropy,
  type FitnessMetrics,
  type BehaviorVector,
} from "../../discovery/fitness";
import {
  saveOrganism,
  getSavedOrganisms,
  getOrganism,
  deleteOrganism,
  exportOrganismJSON,
  importOrganismJSON,
  saveGAArchive,
  getGAArchive,
} from "../../persistence/storage";
import type { LeniaGenome } from "../../discovery/genome";
import { createPhyloTree } from "../../discovery/phylogeny";

// Mock state generator for testing
function createMockState(width: number, height: number): Float32Array {
  const state = new Float32Array(width * height);
  // Create a simple pattern (blob in center)
  const centerX = width / 2;
  const centerY = height / 2;
  const radius = Math.min(width, height) / 8;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const dx = x - centerX;
      const dy = y - centerY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < radius) {
        state[y * width + x] = 1 - dist / radius;
      }
    }
  }
  return state;
}

// Create mock behavior vector
function createMockBehavior(individual: Individual): BehaviorVector {
  return {
    avgMass: individual.genome.R * 10,
    massVariance: individual.genome.s * 100,
    avgSpeed: individual.genome.m * 0.5,
    avgEntropy: 0.5,
    boundingSize: individual.genome.R * 3,
    lifespan: 0.8,
  };
}

// Create mock fitness metrics from state
function createMockFitness(
  state: Float32Array,
  width: number,
  height: number,
): FitnessMetrics {
  const mass = calculateMass(state);
  const symmetry = calculateSymmetry(state, width, height);
  const entropy = calculateEntropy(state);

  return {
    survival: mass > 10 ? 0.8 : 0.2,
    stability: 0.7,
    complexity: entropy,
    symmetry,
    movement: 0.3,
    replication: 0,
    overall:
      (mass > 10 ? 0.8 : 0.2) * 0.3 +
      0.7 * 0.2 +
      entropy * 0.2 +
      symmetry * 0.2 +
      0.3 * 0.1,
  };
}

// Create mock fitness for an individual
function evaluateIndividual(individual: Individual): Individual {
  const state = createMockState(64, 64);
  const fitness = createMockFitness(state, 64, 64);
  const behavior = createMockBehavior(individual);

  return {
    ...individual,
    fitness,
    behavior,
    novelty: 0.5, // Above threshold (0.3) so it can be archived
  };
}

describe("Discovery → Persistence Integration", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe("Population evolution and saving", () => {
    it("should create population, evolve, and save best individuals", () => {
      // Create initial population
      const population = createPopulation(10);
      expect(population.length).toBe(10);

      // Evaluate all individuals
      const evaluatedPop = population.map(evaluateIndividual);

      // All should now have fitness
      evaluatedPop.forEach((ind) => {
        expect(ind.fitness).not.toBeNull();
        expect(ind.behavior).not.toBeNull();
      });

      // Find best individual by overall fitness
      const best = evaluatedPop.reduce((a, b) =>
        (a.fitness?.overall ?? 0) > (b.fitness?.overall ?? 0) ? a : b,
      );

      // Save best organism
      const saved = saveOrganism(
        best.genome,
        "Best from GA",
        "Auto-discovered",
      );
      expect(saved.id).toBeDefined();
      expect(saved.genome).toEqual(best.genome);

      // Retrieve and verify
      const retrieved = getOrganism(saved.id);
      expect(retrieved).not.toBeNull();
      expect(retrieved!.genome.R).toBe(best.genome.R);
    });

    it("should evolve population and maintain archive", () => {
      // Initial state
      const initialPop = createPopulation(10).map(evaluateIndividual);
      let archive: Individual[] = [];

      // Run evolution
      archive = updateArchive(archive, initialPop, 15);

      // Archive should have top individuals
      expect(archive.length).toBeLessThanOrEqual(15);
      expect(archive.length).toBeGreaterThan(0);

      // Archive individuals should have behavior
      archive.forEach((ind) => {
        expect(ind.behavior).not.toBeNull();
      });

      // Save archive
      saveGAArchive(archive.map((ind) => ind.genome));

      // Retrieve archive
      const loadedGenomes = getGAArchive();
      expect(loadedGenomes.length).toBe(archive.length);
    });

    it("should tournament select and create valid offspring", () => {
      const evaluated = createPopulation(20).map(evaluateIndividual);

      // Tournament selection
      const parent1 = tournamentSelect(evaluated, 3);
      const parent2 = tournamentSelect(evaluated, 3);

      expect(parent1.fitness).not.toBeNull();
      expect(parent2.fitness).not.toBeNull();

      // Create GAState for evolvePopulation
      const gaState: GAState = {
        population: evaluated,
        archive: [],
        generation: 0,
        bestFitness: 0,
        bestIndividual: null,
        phyloTree: createPhyloTree(),
      };

      // Evolve with selection
      const nextGen = evolvePopulation(gaState, {
        populationSize: 20,
        mutationRate: 0.1,
        crossoverRate: 0.5,
        eliteCount: 2,
        tournamentSize: 3,
        noveltyWeight: 0.3,
        noveltyK: 5,
      });

      expect(nextGen.length).toBe(evaluated.length);

      // New generation has valid genomes
      nextGen.forEach((ind) => {
        expect(ind.genome.R).toBeGreaterThan(0);
        expect(ind.genome.m).toBeGreaterThan(0);
        expect(ind.genome.s).toBeGreaterThan(0);
      });
    });
  });

  describe("Export/Import workflow", () => {
    it("should export and re-import organisms", () => {
      // Create and save
      const genome: LeniaGenome = {
        R: 15,
        T: 12,
        m: 0.14,
        s: 0.02,
        b: [1, 0.5],
        kn: 1,
        gn: 1,
      };

      const saved = saveOrganism(genome, "Export Test", "Will be exported");

      // Export
      const json = exportOrganismJSON(saved);
      expect(json).toBeDefined();

      // Parse and verify structure
      const parsed = JSON.parse(json);
      expect(parsed.name).toBe("Export Test");
      expect(parsed.genome.R).toBe(15);

      // Clear and reimport
      localStorage.clear();
      const imported = importOrganismJSON(json);

      expect(imported).not.toBeNull();
      expect(imported!.genome.R).toBe(15);
      expect(imported!.genome.b).toEqual([1, 0.5]);
    });

    it("should handle batch save and load", () => {
      // Save multiple organisms
      const genomes = [
        { R: 10, T: 8, m: 0.12, s: 0.03, b: [1], kn: 1, gn: 1 },
        { R: 15, T: 10, m: 0.15, s: 0.02, b: [1, 0.5], kn: 1, gn: 1 },
        { R: 20, T: 12, m: 0.18, s: 0.025, b: [1], kn: 2, gn: 1 },
      ];

      genomes.forEach((g, i) => saveOrganism(g, `Organism ${i}`));

      // Load all
      const all = getSavedOrganisms();
      expect(all.length).toBe(3);

      // Verify each
      expect(all.map((o) => o.genome.R).sort()).toEqual([10, 15, 20]);
    });

    it("should delete organism and verify removal", () => {
      const saved = saveOrganism(
        { R: 13, T: 10, m: 0.12, s: 0.04, b: [1], kn: 1, gn: 1 },
        "To Delete",
      );

      // Verify exists
      expect(getOrganism(saved.id)).not.toBeNull();

      // Delete
      const deleted = deleteOrganism(saved.id);
      expect(deleted).toBe(true);

      // Verify gone
      expect(getOrganism(saved.id)).toBeNull();
    });
  });

  describe("Fitness calculation integration", () => {
    it("should calculate fitness metrics consistently", () => {
      const state = createMockState(64, 64);

      // Calculate multiple times
      const fitness1 = createMockFitness(state, 64, 64);
      const fitness2 = createMockFitness(state, 64, 64);

      // Should be deterministic
      expect(fitness1.overall).toBe(fitness2.overall);
      expect(fitness1.symmetry).toBe(fitness2.symmetry);
    });

    it("should calculate symmetry correctly", () => {
      const width = 64;
      const height = 64;

      // Create symmetric pattern
      const symmetric = new Float32Array(width * height);
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width / 2; x++) {
          const val = Math.random();
          symmetric[y * width + x] = val;
          symmetric[y * width + (width - 1 - x)] = val; // Mirror
        }
      }

      const symmetryScore = calculateSymmetry(symmetric, width, height);
      // Horizontally symmetric pattern should have good vertical symmetry
      expect(symmetryScore).toBeGreaterThan(0.3);
    });
  });
});
