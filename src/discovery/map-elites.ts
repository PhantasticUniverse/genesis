/**
 * MAP-Elites Quality-Diversity Archive
 * Modern quality-diversity algorithm for discovering diverse morphologies
 *
 * Key concepts:
 * - Behavioral space: Grid of behavioral descriptors (e.g., mass × speed)
 * - Archive: Each cell contains the highest-quality individual with that behavior
 * - QD-score: Sum of all elite fitnesses (measures quality AND diversity)
 * - Coverage: Fraction of cells occupied
 */

import type { Genome, GeneticConfig } from "./genetic-algorithm";
import type { BehaviorVector } from "../agency/behavior";

/**
 * Behavioral descriptor for MAP-Elites
 * Defines which aspects of behavior to use for cell mapping
 */
export interface BehavioralDescriptor {
  /** Name of this descriptor */
  name: string;

  /** Minimum value for this dimension */
  min: number;

  /** Maximum value for this dimension */
  max: number;

  /** Number of bins for this dimension */
  bins: number;

  /** Extract value from behavior vector */
  extract: (behavior: BehaviorVector) => number;
}

/**
 * Archive cell containing an elite individual
 */
export interface ArchiveCell {
  /** The elite genome in this cell */
  genome: Genome;

  /** Fitness (quality) of this elite */
  fitness: number;

  /** Behavioral descriptor values */
  behavior: number[];

  /** Cell coordinates */
  coords: number[];

  /** Generation when added/updated */
  generation: number;

  /** Number of times this cell has been updated */
  updateCount: number;
}

/**
 * MAP-Elites archive configuration
 */
export interface MAPElitesConfig {
  /** Behavioral descriptors defining the grid */
  descriptors: BehavioralDescriptor[];

  /** Whether higher fitness is better */
  higherIsBetter: boolean;

  /** Minimum improvement required to replace elite */
  replacementThreshold: number;
}

/**
 * Archive statistics
 */
export interface ArchiveStats {
  /** Number of occupied cells */
  filledCells: number;

  /** Total number of cells */
  totalCells: number;

  /** Coverage (filledCells / totalCells) */
  coverage: number;

  /** QD-score (sum of all elite fitnesses) */
  qdScore: number;

  /** Best fitness in archive */
  bestFitness: number;

  /** Mean fitness of elites */
  meanFitness: number;

  /** Minimum fitness of elites */
  minFitness: number;

  /** Fitness per dimension bin (for visualization) */
  fitnessGrid: (number | null)[][];
}

/**
 * MAP-Elites Archive
 */
export interface MAPElitesArchive {
  /** Get configuration */
  getConfig(): MAPElitesConfig;

  /** Get archive statistics */
  getStats(): ArchiveStats;

  /** Get all elites */
  getElites(): ArchiveCell[];

  /** Get elite at specific coordinates */
  getCell(coords: number[]): ArchiveCell | null;

  /** Get best elite */
  getBest(): ArchiveCell | null;

  /** Try to add a genome to the archive */
  tryAdd(genome: Genome, fitness: number, behavior: BehaviorVector, generation: number): boolean;

  /** Select a random elite for reproduction */
  selectRandom(): ArchiveCell | null;

  /** Select elite using tournament selection */
  selectTournament(tournamentSize: number): ArchiveCell | null;

  /** Select elite biased toward curiosity (less explored regions) */
  selectCuriosity(): ArchiveCell | null;

  /** Clear the archive */
  clear(): void;

  /** Export archive state */
  export(): {
    config: MAPElitesConfig;
    cells: Array<{
      genome: Genome;
      fitness: number;
      behavior: number[];
      coords: number[];
      generation: number;
    }>;
  };

  /** Import archive state */
  import(state: {
    cells: Array<{
      genome: Genome;
      fitness: number;
      behavior: number[];
      coords: number[];
      generation: number;
    }>;
  }): void;
}

/**
 * Default behavioral descriptors for Lenia organisms
 */
export const DEFAULT_DESCRIPTORS: BehavioralDescriptor[] = [
  {
    name: "mass",
    min: 0,
    max: 1000,
    bins: 50,
    extract: (b) => b.totalMass ?? 0,
  },
  {
    name: "speed",
    min: 0,
    max: 10,
    bins: 50,
    extract: (b) => b.meanSpeed ?? 0,
  },
];

/**
 * Alternative descriptor sets
 */
export const DESCRIPTOR_PRESETS = {
  "mass-speed": DEFAULT_DESCRIPTORS,

  "mass-rotation": [
    {
      name: "mass",
      min: 0,
      max: 1000,
      bins: 50,
      extract: (b: BehaviorVector) => b.totalMass ?? 0,
    },
    {
      name: "rotation",
      min: -3.14,
      max: 3.14,
      bins: 50,
      extract: (b: BehaviorVector) => b.rotationalVelocity ?? 0,
    },
  ],

  "speed-stability": [
    {
      name: "speed",
      min: 0,
      max: 10,
      bins: 50,
      extract: (b: BehaviorVector) => b.meanSpeed ?? 0,
    },
    {
      name: "stability",
      min: 0,
      max: 1,
      bins: 50,
      extract: (b: BehaviorVector) => b.velocityVariance ?? 0,
    },
  ],

  "mass-age": [
    {
      name: "mass",
      min: 0,
      max: 1000,
      bins: 50,
      extract: (b: BehaviorVector) => b.totalMass ?? 0,
    },
    {
      name: "age",
      min: 0,
      max: 500,
      bins: 50,
      extract: (b: BehaviorVector) => b.lifetime ?? 0,
    },
  ],
} as const;

/**
 * Create a MAP-Elites archive
 */
export function createMAPElitesArchive(
  config: Partial<MAPElitesConfig> = {},
): MAPElitesArchive {
  const fullConfig: MAPElitesConfig = {
    descriptors: config.descriptors ?? DEFAULT_DESCRIPTORS,
    higherIsBetter: config.higherIsBetter ?? true,
    replacementThreshold: config.replacementThreshold ?? 0,
  };

  // Validate descriptors (only support 2D for now)
  if (fullConfig.descriptors.length !== 2) {
    throw new Error("MAP-Elites currently supports exactly 2 behavioral descriptors");
  }

  // Create 2D grid storage
  const dims = fullConfig.descriptors.map((d) => d.bins);
  const grid: (ArchiveCell | null)[][] = [];
  for (let i = 0; i < dims[0]; i++) {
    grid.push(new Array(dims[1]).fill(null));
  }

  // Extract behavior values and map to cell coordinates
  function behaviorToCoords(behavior: BehaviorVector): {
    values: number[];
    coords: number[];
  } {
    const values: number[] = [];
    const coords: number[] = [];

    for (const desc of fullConfig.descriptors) {
      const value = desc.extract(behavior);
      values.push(value);

      // Map to bin index
      const normalized = (value - desc.min) / (desc.max - desc.min);
      const bin = Math.floor(Math.max(0, Math.min(desc.bins - 1, normalized * desc.bins)));
      coords.push(bin);
    }

    return { values, coords };
  }

  // Check if new fitness beats existing
  function shouldReplace(newFitness: number, oldFitness: number): boolean {
    const diff = newFitness - oldFitness;
    if (fullConfig.higherIsBetter) {
      return diff > fullConfig.replacementThreshold;
    }
    return -diff > fullConfig.replacementThreshold;
  }

  return {
    getConfig() {
      return fullConfig;
    },

    getStats(): ArchiveStats {
      const elites: ArchiveCell[] = [];
      const fitnessGrid: (number | null)[][] = [];

      for (let i = 0; i < dims[0]; i++) {
        const row: (number | null)[] = [];
        for (let j = 0; j < dims[1]; j++) {
          const cell = grid[i][j];
          if (cell) {
            elites.push(cell);
            row.push(cell.fitness);
          } else {
            row.push(null);
          }
        }
        fitnessGrid.push(row);
      }

      const totalCells = dims[0] * dims[1];
      const filledCells = elites.length;
      const fitnesses = elites.map((e) => e.fitness);

      return {
        filledCells,
        totalCells,
        coverage: filledCells / totalCells,
        qdScore: fitnesses.reduce((a, b) => a + b, 0),
        bestFitness:
          fitnesses.length > 0
            ? fullConfig.higherIsBetter
              ? Math.max(...fitnesses)
              : Math.min(...fitnesses)
            : 0,
        meanFitness:
          fitnesses.length > 0
            ? fitnesses.reduce((a, b) => a + b, 0) / fitnesses.length
            : 0,
        minFitness:
          fitnesses.length > 0
            ? fullConfig.higherIsBetter
              ? Math.min(...fitnesses)
              : Math.max(...fitnesses)
            : 0,
        fitnessGrid,
      };
    },

    getElites(): ArchiveCell[] {
      const elites: ArchiveCell[] = [];
      for (const row of grid) {
        for (const cell of row) {
          if (cell) elites.push(cell);
        }
      }
      return elites;
    },

    getCell(coords: number[]): ArchiveCell | null {
      if (coords.length !== 2) return null;
      const [i, j] = coords;
      if (i < 0 || i >= dims[0] || j < 0 || j >= dims[1]) return null;
      return grid[i][j];
    },

    getBest(): ArchiveCell | null {
      let best: ArchiveCell | null = null;

      for (const row of grid) {
        for (const cell of row) {
          if (!cell) continue;
          if (!best || shouldReplace(cell.fitness, best.fitness)) {
            best = cell;
          }
        }
      }

      return best;
    },

    tryAdd(
      genome: Genome,
      fitness: number,
      behavior: BehaviorVector,
      generation: number,
    ): boolean {
      const { values, coords } = behaviorToCoords(behavior);
      const [i, j] = coords;

      // Check bounds
      if (i < 0 || i >= dims[0] || j < 0 || j >= dims[1]) {
        return false;
      }

      const existing = grid[i][j];

      // Add to empty cell
      if (!existing) {
        grid[i][j] = {
          genome: { ...genome },
          fitness,
          behavior: values,
          coords,
          generation,
          updateCount: 1,
        };
        return true;
      }

      // Replace if better
      if (shouldReplace(fitness, existing.fitness)) {
        grid[i][j] = {
          genome: { ...genome },
          fitness,
          behavior: values,
          coords,
          generation,
          updateCount: existing.updateCount + 1,
        };
        return true;
      }

      return false;
    },

    selectRandom(): ArchiveCell | null {
      const elites = this.getElites();
      if (elites.length === 0) return null;
      return elites[Math.floor(Math.random() * elites.length)];
    },

    selectTournament(tournamentSize: number): ArchiveCell | null {
      const elites = this.getElites();
      if (elites.length === 0) return null;

      let best: ArchiveCell | null = null;

      for (let i = 0; i < tournamentSize; i++) {
        const candidate = elites[Math.floor(Math.random() * elites.length)];
        if (!best || shouldReplace(candidate.fitness, best.fitness)) {
          best = candidate;
        }
      }

      return best;
    },

    selectCuriosity(): ArchiveCell | null {
      const elites = this.getElites();
      if (elites.length === 0) return null;

      // Prioritize cells that have been updated fewer times (less explored)
      const weights = elites.map((e) => 1 / (e.updateCount + 1));
      const totalWeight = weights.reduce((a, b) => a + b, 0);

      let r = Math.random() * totalWeight;
      for (let i = 0; i < elites.length; i++) {
        r -= weights[i];
        if (r <= 0) return elites[i];
      }

      return elites[elites.length - 1];
    },

    clear() {
      for (let i = 0; i < dims[0]; i++) {
        for (let j = 0; j < dims[1]; j++) {
          grid[i][j] = null;
        }
      }
    },

    export() {
      const cells: Array<{
        genome: Genome;
        fitness: number;
        behavior: number[];
        coords: number[];
        generation: number;
      }> = [];

      for (const row of grid) {
        for (const cell of row) {
          if (cell) {
            cells.push({
              genome: cell.genome,
              fitness: cell.fitness,
              behavior: cell.behavior,
              coords: cell.coords,
              generation: cell.generation,
            });
          }
        }
      }

      return { config: fullConfig, cells };
    },

    import(state) {
      // Clear existing
      this.clear();

      // Import cells
      for (const cell of state.cells) {
        const [i, j] = cell.coords;
        if (i >= 0 && i < dims[0] && j >= 0 && j < dims[1]) {
          grid[i][j] = {
            genome: cell.genome,
            fitness: cell.fitness,
            behavior: cell.behavior,
            coords: cell.coords,
            generation: cell.generation,
            updateCount: 1,
          };
        }
      }
    },
  };
}

/**
 * MAP-Elites evolution parameters
 */
export interface MAPElitesParams {
  /** Archive configuration */
  archiveConfig: Partial<MAPElitesConfig>;

  /** Batch size per generation */
  batchSize: number;

  /** Proportion of new random genomes vs mutations */
  explorationRate: number;

  /** Selection method: random, tournament, or curiosity */
  selectionMethod: "random" | "tournament" | "curiosity";

  /** Tournament size (if using tournament selection) */
  tournamentSize: number;
}

/**
 * Default MAP-Elites parameters
 */
export const DEFAULT_MAP_ELITES_PARAMS: MAPElitesParams = {
  archiveConfig: {},
  batchSize: 100,
  explorationRate: 0.1,
  selectionMethod: "curiosity",
  tournamentSize: 5,
};

/**
 * Run one generation of MAP-Elites
 */
export function mapElitesGeneration(
  archive: MAPElitesArchive,
  evaluateBatch: (
    genomes: Genome[],
  ) => Promise<Array<{ fitness: number; behavior: BehaviorVector }>>,
  generateRandom: () => Genome,
  mutate: (genome: Genome) => Genome,
  params: Partial<MAPElitesParams> = {},
  generation: number = 0,
): Promise<{
  added: number;
  evaluated: number;
  stats: ArchiveStats;
}> {
  const fullParams: MAPElitesParams = { ...DEFAULT_MAP_ELITES_PARAMS, ...params };

  return new Promise(async (resolve) => {
    const batch: Genome[] = [];

    // Generate batch
    for (let i = 0; i < fullParams.batchSize; i++) {
      if (Math.random() < fullParams.explorationRate || archive.getStats().filledCells === 0) {
        // Exploration: generate random genome
        batch.push(generateRandom());
      } else {
        // Exploitation: mutate existing elite
        let parent: ArchiveCell | null;

        switch (fullParams.selectionMethod) {
          case "tournament":
            parent = archive.selectTournament(fullParams.tournamentSize);
            break;
          case "curiosity":
            parent = archive.selectCuriosity();
            break;
          default:
            parent = archive.selectRandom();
        }

        if (parent) {
          batch.push(mutate(parent.genome));
        } else {
          batch.push(generateRandom());
        }
      }
    }

    // Evaluate batch
    const results = await evaluateBatch(batch);

    // Try to add to archive
    let added = 0;
    for (let i = 0; i < batch.length; i++) {
      const genome = batch[i];
      const result = results[i];

      if (archive.tryAdd(genome, result.fitness, result.behavior, generation)) {
        added++;
      }
    }

    resolve({
      added,
      evaluated: batch.length,
      stats: archive.getStats(),
    });
  });
}

/**
 * Visualization helpers
 */

/**
 * Generate SVG for archive heatmap
 */
export function generateArchiveHeatmapSVG(
  archive: MAPElitesArchive,
  width: number = 400,
  height: number = 400,
): string {
  const stats = archive.getStats();
  const config = archive.getConfig();
  const grid = stats.fitnessGrid;

  const cellWidth = width / grid.length;
  const cellHeight = height / grid[0].length;

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`;

  // Background
  svg += `<rect width="${width}" height="${height}" fill="#1a1a2e"/>`;

  // Cells
  const maxFitness = stats.bestFitness || 1;
  const minFitness = stats.minFitness || 0;
  const range = maxFitness - minFitness || 1;

  for (let i = 0; i < grid.length; i++) {
    for (let j = 0; j < grid[i].length; j++) {
      const x = i * cellWidth;
      const y = (grid[i].length - 1 - j) * cellHeight; // Flip Y for standard coordinate system
      const fitness = grid[i][j];

      if (fitness !== null) {
        const normalized = (fitness - minFitness) / range;
        // Viridis-like color scale
        const r = Math.round(68 + normalized * (253 - 68));
        const g = Math.round(1 + normalized * (231 - 1));
        const b = Math.round(84 + normalized * (37 - 84));

        svg += `<rect x="${x}" y="${y}" width="${cellWidth}" height="${cellHeight}" fill="rgb(${r},${g},${b})" stroke="#333" stroke-width="0.5"/>`;
      } else {
        svg += `<rect x="${x}" y="${y}" width="${cellWidth}" height="${cellHeight}" fill="#2a2a3e" stroke="#333" stroke-width="0.5"/>`;
      }
    }
  }

  // Axis labels
  const d0 = config.descriptors[0];
  const d1 = config.descriptors[1];

  svg += `<text x="${width / 2}" y="${height - 5}" text-anchor="middle" fill="white" font-size="12">${d0.name}</text>`;
  svg += `<text x="10" y="${height / 2}" text-anchor="middle" fill="white" font-size="12" transform="rotate(-90 10 ${height / 2})">${d1.name}</text>`;

  svg += "</svg>";

  return svg;
}
