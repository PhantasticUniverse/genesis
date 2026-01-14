/**
 * Genetic Algorithm Controller
 * Orchestrates the search for novel Lenia organisms
 */

import {
  type LeniaGenome,
  randomGenome,
  mutateGenome,
  crossoverGenomes,
  cloneGenome,
  encodeGenome,
} from './genome';
import {
  type FitnessMetrics,
  type BehaviorVector,
  behaviorDistance,
} from './fitness';
import {
  type PhyloTree,
  createPhyloTree,
  addPhyloNode,
  updatePhyloNode,
  markNodesDead,
  markNodeArchived,
  layoutTree,
  getTreeStats,
} from './phylogeny';

export interface Individual {
  genome: LeniaGenome;
  fitness: FitnessMetrics | null;
  behavior: BehaviorVector | null;
  novelty: number;
  id: string;
  generation: number;
  parentIds: string[];           // Parent IDs for lineage tracking
  birthType: 'random' | 'elite' | 'mutation' | 'crossover';
}

/**
 * Type guard for evaluated individuals (have both fitness and behavior)
 */
export function isEvaluated(ind: Individual): ind is Individual & {
  fitness: FitnessMetrics;
  behavior: BehaviorVector;
} {
  return ind.fitness !== null && ind.behavior !== null;
}

/**
 * Type guard for individuals with behavior (for novelty calculation)
 */
export function hasBehavior(ind: Individual): ind is Individual & { behavior: BehaviorVector } {
  return ind.behavior !== null;
}

export interface GAConfig {
  populationSize: number;
  eliteCount: number;
  mutationRate: number;
  crossoverRate: number;
  tournamentSize: number;
  noveltyWeight: number;  // Balance between fitness and novelty (0-1)
  noveltyK: number;       // K nearest neighbors for novelty
}

export interface GAState {
  population: Individual[];
  archive: Individual[];  // Novelty archive
  generation: number;
  bestFitness: number;
  bestIndividual: Individual | null;
  phyloTree: PhyloTree;   // Evolutionary lineage
}

const DEFAULT_CONFIG: GAConfig = {
  populationSize: 30,
  eliteCount: 3,
  mutationRate: 0.15,
  crossoverRate: 0.7,
  tournamentSize: 3,
  noveltyWeight: 0.3,
  noveltyK: 5,
};

/**
 * Create initial population
 */
export function createPopulation(size: number): Individual[] {
  const population: Individual[] = [];

  for (let i = 0; i < size; i++) {
    population.push({
      genome: randomGenome(),
      fitness: null,
      behavior: null,
      novelty: 0,
      id: `gen0-ind${i}`,
      generation: 0,
      parentIds: [],
      birthType: 'random',
    });
  }

  return population;
}

/**
 * Calculate novelty score for an individual
 */
export function calculateNovelty(
  individual: Individual,
  population: Individual[],
  archive: Individual[],
  k: number
): number {
  if (!hasBehavior(individual)) return 0;

  // Combine population and archive for comparison, filtering to those with behavior
  const others = [...population, ...archive]
    .filter((ind): ind is Individual & { behavior: BehaviorVector } =>
      hasBehavior(ind) && ind.id !== individual.id
    );

  if (others.length === 0) return 1;

  // Calculate distances to all others (types are now narrowed, no assertions needed)
  const distances = others.map(other =>
    behaviorDistance(individual.behavior, other.behavior)
  );

  // Sort and take k nearest
  distances.sort((a, b) => a - b);
  const kNearest = distances.slice(0, Math.min(k, distances.length));

  // Average distance to k nearest neighbors
  return kNearest.reduce((a, b) => a + b, 0) / kNearest.length;
}

/**
 * Tournament selection
 */
export function tournamentSelect(
  population: Individual[],
  tournamentSize: number,
  noveltyWeight: number
): Individual {
  const tournament: Individual[] = [];

  for (let i = 0; i < tournamentSize; i++) {
    const idx = Math.floor(Math.random() * population.length);
    tournament.push(population[idx]);
  }

  // Select best based on combined score
  return tournament.reduce((best, current) => {
    const bestScore = getScore(best, noveltyWeight);
    const currentScore = getScore(current, noveltyWeight);
    return currentScore > bestScore ? current : best;
  });
}

function getScore(individual: Individual, noveltyWeight: number): number {
  const fitnessScore = individual.fitness?.overall ?? 0;
  const noveltyScore = individual.novelty;
  return (1 - noveltyWeight) * fitnessScore + noveltyWeight * noveltyScore;
}

/**
 * Create next generation
 */
export function evolvePopulation(
  state: GAState,
  config: GAConfig = DEFAULT_CONFIG
): Individual[] {
  const { population, archive } = state;
  const newPopulation: Individual[] = [];

  // Calculate novelty for all individuals
  for (const individual of population) {
    individual.novelty = calculateNovelty(
      individual,
      population,
      archive,
      config.noveltyK
    );
  }

  // Sort by combined score
  const sorted = [...population].sort((a, b) => {
    return getScore(b, config.noveltyWeight) - getScore(a, config.noveltyWeight);
  });

  // Elitism - keep best individuals
  for (let i = 0; i < config.eliteCount && i < sorted.length; i++) {
    const elite = cloneGenome(sorted[i].genome);
    newPopulation.push({
      genome: elite,
      fitness: null,
      behavior: null,
      novelty: 0,
      id: `gen${state.generation + 1}-elite${i}`,
      generation: state.generation + 1,
      parentIds: [sorted[i].id],
      birthType: 'elite',
    });
  }

  // Fill rest with offspring
  while (newPopulation.length < config.populationSize) {
    const parent1 = tournamentSelect(population, config.tournamentSize, config.noveltyWeight);
    const parent2 = tournamentSelect(population, config.tournamentSize, config.noveltyWeight);

    let childGenome: LeniaGenome;
    let parentIds: string[];
    let birthType: 'mutation' | 'crossover';

    // Crossover
    if (Math.random() < config.crossoverRate) {
      childGenome = crossoverGenomes(parent1.genome, parent2.genome);
      parentIds = [parent1.id, parent2.id];
      birthType = 'crossover';
    } else {
      childGenome = cloneGenome(parent1.genome);
      parentIds = [parent1.id];
      birthType = 'mutation';
    }

    // Mutation
    childGenome = mutateGenome(childGenome, config.mutationRate);

    newPopulation.push({
      genome: childGenome,
      fitness: null,
      behavior: null,
      novelty: 0,
      id: `gen${state.generation + 1}-ind${newPopulation.length}`,
      generation: state.generation + 1,
      parentIds,
      birthType,
    });
  }

  return newPopulation;
}

/**
 * Update novelty archive
 */
export function updateArchive(
  archive: Individual[],
  population: Individual[],
  maxArchiveSize: number = 100,
  noveltyThreshold: number = 0.3
): Individual[] {
  const newArchive = [...archive];

  for (const individual of population) {
    if (individual.novelty > noveltyThreshold && individual.behavior) {
      // Add to archive if novel enough (preserve all fields including lineage)
      newArchive.push({
        ...individual,
        genome: cloneGenome(individual.genome),
        parentIds: [...individual.parentIds],
      });
    }
  }

  // Trim archive if too large (keep most novel)
  if (newArchive.length > maxArchiveSize) {
    newArchive.sort((a, b) => b.novelty - a.novelty);
    return newArchive.slice(0, maxArchiveSize);
  }

  return newArchive;
}

/**
 * Create GA controller
 */
export function createGAController(config: Partial<GAConfig> = {}) {
  const fullConfig: GAConfig = { ...DEFAULT_CONFIG, ...config };

  // Initialize phylogenetic tree
  const phyloTree = createPhyloTree();

  // Create initial population and add to tree
  const initialPopulation = createPopulation(fullConfig.populationSize);
  for (const ind of initialPopulation) {
    addPhyloNode(phyloTree, ind.id, ind.genome, ind.generation, [], 'mutation');
  }

  let state: GAState = {
    population: initialPopulation,
    archive: [],
    generation: 0,
    bestFitness: 0,
    bestIndividual: null,
    phyloTree,
  };

  return {
    getState(): GAState {
      return state;
    },

    getConfig(): GAConfig {
      return fullConfig;
    },

    getPopulation(): Individual[] {
      return state.population;
    },

    getNextToEvaluate(): Individual | null {
      return state.population.find(ind => ind.fitness === null) ?? null;
    },

    setFitness(
      individualId: string,
      fitness: FitnessMetrics,
      behavior: BehaviorVector
    ): void {
      const individual = state.population.find(ind => ind.id === individualId);
      if (individual) {
        individual.fitness = fitness;
        individual.behavior = behavior;

        // Update phylogenetic tree
        updatePhyloNode(
          state.phyloTree,
          individualId,
          fitness.overall,
          behavior,
          individual.novelty
        );

        // Update best
        if (fitness.overall > state.bestFitness) {
          state.bestFitness = fitness.overall;
          state.bestIndividual = individual;
        }
      }
    },

    isGenerationComplete(): boolean {
      return state.population.every(ind => ind.fitness !== null);
    },

    evolve(): void {
      if (!this.isGenerationComplete()) return;

      // Update archive and mark archived nodes in tree
      const oldArchiveIds = new Set(state.archive.map(a => a.id));
      state.archive = updateArchive(state.archive, state.population);

      // Mark newly archived nodes
      for (const archived of state.archive) {
        if (!oldArchiveIds.has(archived.id)) {
          markNodeArchived(state.phyloTree, archived.id);
        }
      }

      // Create new generation
      state.population = evolvePopulation(state, fullConfig);
      state.generation++;

      // Add new individuals to phylogenetic tree
      const aliveIds = new Set<string>();
      for (const ind of state.population) {
        aliveIds.add(ind.id);

        // Add to tree if not already present
        if (!state.phyloTree.nodes.has(ind.id)) {
          addPhyloNode(
            state.phyloTree,
            ind.id,
            ind.genome,
            ind.generation,
            ind.parentIds,
            ind.birthType === 'elite' ? 'elite' :
            ind.birthType === 'crossover' ? 'crossover' : 'mutation'
          );
        }
      }

      // Mark dead nodes
      markNodesDead(state.phyloTree, aliveIds);

      // Update layout
      layoutTree(state.phyloTree);
    },

    reset(): void {
      // Create new phylogenetic tree
      const newPhyloTree = createPhyloTree();

      // Create initial population and add to tree
      const newPopulation = createPopulation(fullConfig.populationSize);
      for (const ind of newPopulation) {
        addPhyloNode(newPhyloTree, ind.id, ind.genome, ind.generation, [], 'mutation');
      }

      state = {
        population: newPopulation,
        archive: [],
        generation: 0,
        bestFitness: 0,
        bestIndividual: null,
        phyloTree: newPhyloTree,
      };
    },

    exportBest(): string | null {
      if (!state.bestIndividual) return null;
      return encodeGenome(state.bestIndividual.genome);
    },

    getArchive(): Individual[] {
      return state.archive;
    },

    getPhyloTree(): PhyloTree {
      return state.phyloTree;
    },

    getPhyloStats() {
      return getTreeStats(state.phyloTree);
    },

    getNodeById(id: string) {
      return state.phyloTree.nodes.get(id);
    },
  };
}

export type GAController = ReturnType<typeof createGAController>;
