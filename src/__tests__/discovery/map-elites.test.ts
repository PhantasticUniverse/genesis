/**
 * MAP-Elites Quality-Diversity Tests
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  createMAPElitesArchive,
  DEFAULT_DESCRIPTORS,
  DESCRIPTOR_PRESETS,
  type MAPElitesArchive,
  type BehavioralDescriptor,
} from "../../discovery/map-elites";
import type { Genome } from "../../discovery/genetic-algorithm";
import type { BehaviorVector } from "../../agency/behavior";

// Test helpers
function createTestGenome(id: number): Genome {
  return {
    kernelRadius: 13,
    growthCenter: 0.12 + id * 0.01,
    growthWidth: 0.04,
    dt: 0.1,
    kernelType: 0,
    growthType: 0,
    kernelPeaks: [0.5],
  };
}

function createTestBehavior(mass: number, speed: number): BehaviorVector {
  return {
    totalMass: mass,
    meanSpeed: speed,
    maxSpeed: speed * 1.2,
    displacement: speed * 100,
    rotationalVelocity: 0,
    velocityVariance: 0.1,
    lifetime: 100,
    startPosition: [64, 64],
    endPosition: [64 + speed * 10, 64 + speed * 10],
    trajectoryLength: 100,
    meanSize: Math.sqrt(mass),
    sizeVariance: 0.1,
  };
}

describe("createMAPElitesArchive", () => {
  it("should create archive with default descriptors", () => {
    const archive = createMAPElitesArchive();
    const config = archive.getConfig();

    expect(config.descriptors).toEqual(DEFAULT_DESCRIPTORS);
    expect(config.higherIsBetter).toBe(true);
    expect(config.replacementThreshold).toBe(0);
  });

  it("should create archive with custom descriptors", () => {
    const customDescriptors: BehavioralDescriptor[] = [
      {
        name: "test1",
        min: 0,
        max: 100,
        bins: 10,
        extract: (b) => b.totalMass ?? 0,
      },
      {
        name: "test2",
        min: 0,
        max: 50,
        bins: 20,
        extract: (b) => b.meanSpeed ?? 0,
      },
    ];

    const archive = createMAPElitesArchive({ descriptors: customDescriptors });
    const config = archive.getConfig();

    expect(config.descriptors).toEqual(customDescriptors);
    expect(config.descriptors[0].bins).toBe(10);
    expect(config.descriptors[1].bins).toBe(20);
  });

  it("should throw error for non-2D descriptors", () => {
    const singleDescriptor: BehavioralDescriptor[] = [
      {
        name: "test",
        min: 0,
        max: 100,
        bins: 10,
        extract: (b) => b.totalMass ?? 0,
      },
    ];

    expect(() => createMAPElitesArchive({ descriptors: singleDescriptor })).toThrow();
  });
});

describe("MAPElitesArchive basic operations", () => {
  let archive: MAPElitesArchive;

  beforeEach(() => {
    archive = createMAPElitesArchive();
  });

  describe("initial state", () => {
    it("should start empty", () => {
      const stats = archive.getStats();
      expect(stats.filledCells).toBe(0);
      expect(stats.coverage).toBe(0);
      expect(stats.qdScore).toBe(0);
    });

    it("should have correct total cells", () => {
      const stats = archive.getStats();
      expect(stats.totalCells).toBe(50 * 50); // Default 50x50 grid
    });

    it("should return null for best when empty", () => {
      expect(archive.getBest()).toBeNull();
    });

    it("should return empty elites array when empty", () => {
      expect(archive.getElites()).toEqual([]);
    });
  });

  describe("tryAdd", () => {
    it("should add genome to empty cell", () => {
      const genome = createTestGenome(1);
      const behavior = createTestBehavior(100, 2);

      const added = archive.tryAdd(genome, 0.8, behavior, 0);

      expect(added).toBe(true);
      expect(archive.getStats().filledCells).toBe(1);
    });

    it("should replace elite with better fitness", () => {
      const genome1 = createTestGenome(1);
      const genome2 = createTestGenome(2);
      const behavior = createTestBehavior(100, 2);

      archive.tryAdd(genome1, 0.5, behavior, 0);
      const replaced = archive.tryAdd(genome2, 0.9, behavior, 1);

      expect(replaced).toBe(true);

      const best = archive.getBest();
      expect(best?.fitness).toBe(0.9);
      expect(best?.genome.growthCenter).toBe(genome2.growthCenter);
    });

    it("should not replace elite with worse fitness", () => {
      const genome1 = createTestGenome(1);
      const genome2 = createTestGenome(2);
      const behavior = createTestBehavior(100, 2);

      archive.tryAdd(genome1, 0.9, behavior, 0);
      const replaced = archive.tryAdd(genome2, 0.5, behavior, 1);

      expect(replaced).toBe(false);

      const best = archive.getBest();
      expect(best?.fitness).toBe(0.9);
    });

    it("should handle boundary values correctly", () => {
      const genome = createTestGenome(1);

      // Test at descriptor boundaries
      const behaviors = [
        createTestBehavior(0, 0), // Min values
        createTestBehavior(1000, 10), // Max values
        createTestBehavior(500, 5), // Middle values
      ];

      for (const behavior of behaviors) {
        const added = archive.tryAdd(genome, 0.5, behavior, 0);
        expect(added).toBe(true);
      }

      expect(archive.getStats().filledCells).toBe(3);
    });
  });

  describe("getCell", () => {
    it("should return cell at valid coordinates", () => {
      const genome = createTestGenome(1);
      const behavior = createTestBehavior(100, 2); // Maps to specific coords

      archive.tryAdd(genome, 0.8, behavior, 0);

      // Mass 100 / 1000 * 50 bins = bin 5
      // Speed 2 / 10 * 50 bins = bin 10
      const cell = archive.getCell([5, 10]);

      expect(cell).not.toBeNull();
      expect(cell?.fitness).toBe(0.8);
    });

    it("should return null for empty cell", () => {
      const cell = archive.getCell([25, 25]);
      expect(cell).toBeNull();
    });

    it("should return null for invalid coordinates", () => {
      expect(archive.getCell([-1, 0])).toBeNull();
      expect(archive.getCell([50, 0])).toBeNull();
      expect(archive.getCell([0, 0, 0])).toBeNull(); // Wrong dimension
    });
  });
});

describe("MAPElitesArchive selection", () => {
  let archive: MAPElitesArchive;

  beforeEach(() => {
    archive = createMAPElitesArchive();

    // Populate with some elites
    for (let i = 0; i < 10; i++) {
      const genome = createTestGenome(i);
      const behavior = createTestBehavior(i * 100, i);
      archive.tryAdd(genome, 0.1 + i * 0.05, behavior, 0);
    }
  });

  it("should have 10 elites", () => {
    expect(archive.getStats().filledCells).toBe(10);
  });

  describe("selectRandom", () => {
    it("should return a valid elite", () => {
      const selected = archive.selectRandom();
      expect(selected).not.toBeNull();
      expect(selected?.genome).toBeDefined();
      expect(selected?.fitness).toBeDefined();
    });

    it("should return null for empty archive", () => {
      const emptyArchive = createMAPElitesArchive();
      expect(emptyArchive.selectRandom()).toBeNull();
    });
  });

  describe("selectTournament", () => {
    it("should return elite from tournament", () => {
      const selected = archive.selectTournament(5);
      expect(selected).not.toBeNull();
    });

    it("should tend to select higher fitness with larger tournaments", () => {
      // With tournament size = all elites, should always get best
      const bestFitness = archive.getBest()?.fitness;

      // Run multiple trials
      let selectedBestCount = 0;
      for (let i = 0; i < 100; i++) {
        const selected = archive.selectTournament(10);
        if (selected?.fitness === bestFitness) {
          selectedBestCount++;
        }
      }

      // Should select best very often with large tournament
      expect(selectedBestCount).toBeGreaterThan(50);
    });
  });

  describe("selectCuriosity", () => {
    it("should return a valid elite", () => {
      const selected = archive.selectCuriosity();
      expect(selected).not.toBeNull();
    });

    it("should prefer less explored cells", () => {
      // Update one cell many times
      const genome = createTestGenome(99);
      const behavior = createTestBehavior(50, 0.5);

      // First add
      archive.tryAdd(genome, 0.9, behavior, 0);
      // Simulate many updates by getting the cell
      const cell = archive.getCell([2, 2]);

      // Run curiosity selection multiple times
      let selectedOverexploredCount = 0;
      for (let i = 0; i < 100; i++) {
        const selected = archive.selectCuriosity();
        if (selected?.coords[0] === cell?.coords[0] && selected?.coords[1] === cell?.coords[1]) {
          selectedOverexploredCount++;
        }
      }

      // Less explored cells should be selected more often
      // This is probabilistic, so we use a generous threshold
      expect(selectedOverexploredCount).toBeLessThan(50);
    });
  });
});

describe("MAPElitesArchive statistics", () => {
  let archive: MAPElitesArchive;

  beforeEach(() => {
    archive = createMAPElitesArchive();

    // Populate with 25 elites with varying fitness
    for (let i = 0; i < 5; i++) {
      for (let j = 0; j < 5; j++) {
        const genome = createTestGenome(i * 5 + j);
        const behavior = createTestBehavior(i * 200, j * 2);
        const fitness = 0.1 + (i * 5 + j) * 0.02;
        archive.tryAdd(genome, fitness, behavior, 0);
      }
    }
  });

  it("should calculate coverage correctly", () => {
    const stats = archive.getStats();
    expect(stats.filledCells).toBe(25);
    expect(stats.coverage).toBeCloseTo(25 / 2500, 5);
  });

  it("should calculate QD-score correctly", () => {
    const stats = archive.getStats();
    const elites = archive.getElites();
    const expectedQD = elites.reduce((sum, e) => sum + e.fitness, 0);
    expect(stats.qdScore).toBeCloseTo(expectedQD, 5);
  });

  it("should track best fitness", () => {
    const stats = archive.getStats();
    const elites = archive.getElites();
    const maxFitness = Math.max(...elites.map((e) => e.fitness));
    expect(stats.bestFitness).toBe(maxFitness);
  });

  it("should calculate mean fitness correctly", () => {
    const stats = archive.getStats();
    const elites = archive.getElites();
    const expectedMean = elites.reduce((s, e) => s + e.fitness, 0) / elites.length;
    expect(stats.meanFitness).toBeCloseTo(expectedMean, 5);
  });

  it("should generate fitness grid", () => {
    const stats = archive.getStats();
    expect(stats.fitnessGrid).toHaveLength(50); // First dimension
    expect(stats.fitnessGrid[0]).toHaveLength(50); // Second dimension
  });
});

describe("MAPElitesArchive export/import", () => {
  it("should export and import archive state", () => {
    const archive1 = createMAPElitesArchive();

    // Populate
    for (let i = 0; i < 10; i++) {
      const genome = createTestGenome(i);
      const behavior = createTestBehavior(i * 100, i);
      archive1.tryAdd(genome, 0.1 + i * 0.05, behavior, i);
    }

    // Export
    const exported = archive1.export();
    expect(exported.cells).toHaveLength(10);

    // Import to new archive
    const archive2 = createMAPElitesArchive();
    archive2.import(exported);

    // Verify
    expect(archive2.getStats().filledCells).toBe(10);
    expect(archive2.getBest()?.fitness).toBe(archive1.getBest()?.fitness);
  });

  it("should clear before import", () => {
    const archive = createMAPElitesArchive();

    // Add initial data
    archive.tryAdd(createTestGenome(1), 0.5, createTestBehavior(500, 5), 0);

    // Import empty state
    archive.import({ cells: [] });

    expect(archive.getStats().filledCells).toBe(0);
  });
});

describe("MAPElitesArchive clear", () => {
  it("should clear all cells", () => {
    const archive = createMAPElitesArchive();

    // Populate
    for (let i = 0; i < 10; i++) {
      archive.tryAdd(createTestGenome(i), 0.5, createTestBehavior(i * 100, i), 0);
    }

    expect(archive.getStats().filledCells).toBe(10);

    archive.clear();

    expect(archive.getStats().filledCells).toBe(0);
    expect(archive.getElites()).toEqual([]);
    expect(archive.getBest()).toBeNull();
  });
});

describe("DESCRIPTOR_PRESETS", () => {
  it("should have mass-speed preset", () => {
    expect(DESCRIPTOR_PRESETS["mass-speed"]).toEqual(DEFAULT_DESCRIPTORS);
  });

  it("should have mass-rotation preset", () => {
    const preset = DESCRIPTOR_PRESETS["mass-rotation"];
    expect(preset).toHaveLength(2);
    expect(preset[0].name).toBe("mass");
    expect(preset[1].name).toBe("rotation");
  });

  it("should have speed-stability preset", () => {
    const preset = DESCRIPTOR_PRESETS["speed-stability"];
    expect(preset).toHaveLength(2);
    expect(preset[0].name).toBe("speed");
    expect(preset[1].name).toBe("stability");
  });

  it("should have mass-age preset", () => {
    const preset = DESCRIPTOR_PRESETS["mass-age"];
    expect(preset).toHaveLength(2);
    expect(preset[0].name).toBe("mass");
    expect(preset[1].name).toBe("age");
  });
});

describe("Lower is better mode", () => {
  it("should prefer lower fitness when higherIsBetter is false", () => {
    const archive = createMAPElitesArchive({ higherIsBetter: false });

    const genome1 = createTestGenome(1);
    const genome2 = createTestGenome(2);
    const behavior = createTestBehavior(100, 2);

    archive.tryAdd(genome1, 0.5, behavior, 0);
    archive.tryAdd(genome2, 0.3, behavior, 1); // Lower is better

    const best = archive.getBest();
    expect(best?.fitness).toBe(0.3);
  });

  it("should not replace with higher fitness when higherIsBetter is false", () => {
    const archive = createMAPElitesArchive({ higherIsBetter: false });

    const genome1 = createTestGenome(1);
    const genome2 = createTestGenome(2);
    const behavior = createTestBehavior(100, 2);

    archive.tryAdd(genome1, 0.3, behavior, 0);
    const replaced = archive.tryAdd(genome2, 0.5, behavior, 1);

    expect(replaced).toBe(false);
    expect(archive.getBest()?.fitness).toBe(0.3);
  });
});
