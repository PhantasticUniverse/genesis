---
name: discovery
description: Genetic algorithm, fitness evaluation, novelty search, and self-replication detection. Use when implementing evolutionary search, evaluating organism fitness, or detecting emergent behaviors.
---

# Discovery APIs

## Genetic Algorithm

```typescript
import {
  createGeneticAlgorithm,
  GAConfig,
  Individual,
} from "./discovery/genetic-algorithm";

const ga = createGeneticAlgorithm({
  populationSize: 50,
  mutationRate: 0.1,
  crossoverRate: 0.7,
  eliteCount: 5,
  tournamentSize: 3,
});

// Evolution loop
ga.initialize();
for (let gen = 0; gen < 100; gen++) {
  await ga.evaluatePopulation(fitnessFunction);
  ga.evolve();
}

const best = ga.getBest();
```

## Fitness Metrics

```typescript
import {
  calculateSymmetry,
  calculateComplexity,
  evaluateFitness,
  FITNESS_WEIGHTS,
} from "./discovery/fitness";

// Individual metrics
const symmetry = calculateSymmetry(state, width, height);
const complexity = calculateComplexity(state, width, height);

// Combined fitness evaluation
const fitness = evaluateFitness(state, width, height, {
  survival: 1.0,
  stability: 0.5,
  complexity: 0.3,
  symmetry: 0.2,
  movement: 0.1,
  replication: 2.0,
});
```

### Available Fitness Metrics

| Metric        | Description                           |
| ------------- | ------------------------------------- |
| `survival`    | How long the organism persists        |
| `stability`   | Resistance to perturbation            |
| `complexity`  | Structural complexity (entropy-based) |
| `symmetry`    | Bilateral and rotational symmetry     |
| `movement`    | Center-of-mass displacement           |
| `replication` | Self-replication events detected      |

## Novelty Search

```typescript
import { NoveltySearch, createNoveltyArchive } from "./discovery/novelty";

const novelty = new NoveltySearch({
  k: 15, // K-nearest neighbors
  archiveThreshold: 0.3,
  maxArchiveSize: 1000,
});

// Add behavior to archive
novelty.addToArchive(behaviorVector);

// Calculate novelty score
const score = novelty.calculateNovelty(behaviorVector);

// Sparse novelty (faster)
const sparseScore = novelty.sparseNovelty(behaviorVector, 10);
```

## Self-Replication Detection

```typescript
import {
  createReplicationDetector,
  findConnectedComponents,
  calculateReplicationFitness,
} from "./discovery/replication";

// Create detector
const detector = createReplicationDetector(width, height, {
  minMass: 10,
  activationThreshold: 0.1,
  minSimilarity: 0.6,
});

// Process each frame
const events = detector.update(stateArray, stepNumber);

// Check for replication events
for (const event of events) {
  console.log(`Replication at step ${event.step}`);
  console.log(`Similarity: ${event.similarity}`);
}

// Use in fitness evaluation
const replicationFitness = calculateReplicationFitness(detector.getEvents());
```

## Phylogeny Tracking

```typescript
import { createPhylogenyTree, PhylogenyNode } from "./discovery/phylogeny";

const tree = createPhylogenyTree();

// Track lineages
const parent = tree.addNode(genome, fitness);
const child = tree.addChild(parent.id, mutatedGenome, childFitness);

// Query lineage
const ancestors = tree.getAncestors(child.id);
const descendants = tree.getDescendants(parent.id);
```

## MAP-Elites Quality-Diversity

```typescript
import {
  createMAPElitesArchive,
  DESCRIPTOR_PRESETS,
  type MAPElitesArchive,
} from "./discovery/map-elites";

// Create archive with preset behavioral descriptors
const archive = createMAPElitesArchive({
  descriptors: DESCRIPTOR_PRESETS["mass-speed"], // 50x50 grid
  higherIsBetter: true,
});

// Try to add individual to archive
const added = archive.tryAdd(genome, fitness, behaviorVector, generation);

// Selection methods
const elite = archive.selectRandom();
const best = archive.selectTournament(5);
const unexplored = archive.selectCuriosity();

// Statistics
const stats = archive.getStats();
console.log(`Coverage: ${stats.coverage}`);
console.log(`QD-Score: ${stats.qdScore}`);
console.log(`Filled cells: ${stats.filledCells}`);

// Export/Import
const state = archive.export();
archive.import(state);
```

### Descriptor Presets

| Preset            | Axes                    | Use Case            |
| ----------------- | ----------------------- | ------------------- |
| `mass-speed`      | Total mass × Mean speed | General exploration |
| `mass-rotation`   | Total mass × Rotation   | Spinning organisms  |
| `speed-stability` | Mean speed × Stability  | Movement patterns   |
| `mass-age`        | Total mass × Lifetime   | Survival strategies |

## Statistical Analysis

```typescript
import {
  bootstrapCI,
  bootstrapBCaCI,
  cohensD,
  hedgesG,
  cliffsD,
  mannWhitneyU,
  kruskalWallis,
  holmCorrection,
  benjaminiHochberg,
} from "./analysis/statistics";

// Bootstrap confidence intervals
const ci = bootstrapCI(data, mean, { confidence: 0.95, iterations: 10000 });
const bcaCI = bootstrapBCaCI(data, mean, { confidence: 0.95 });

// Effect sizes
const d = cohensD(group1, group2); // Cohen's d
const g = hedgesG(group1, group2); // Hedges' g (small samples)
const delta = cliffsD(group1, group2); // Non-parametric

// Statistical tests
const uTest = mannWhitneyU(group1, group2);
const hTest = kruskalWallis([group1, group2, group3]);

// Multiple comparison correction
const corrected = holmCorrection(pValues);
const fdrCorrected = benjaminiHochberg(pValues);
```

### Experiment Comparison

```typescript
import {
  compareConditions,
  compareAB,
  formatComparisonReport,
} from "./analysis/experiment";

// Compare multiple conditions
const comparison = compareConditions([
  { name: "Control", values: controlData },
  { name: "Treatment A", values: treatmentA },
  { name: "Treatment B", values: treatmentB },
]);

// Simple A/B comparison
const ab = compareAB(groupA, groupB, { alpha: 0.05 });

// Generate markdown report
const report = formatComparisonReport(comparison, "Fitness");
```

## Core Files

| File                             | Purpose                        |
| -------------------------------- | ------------------------------ |
| `discovery/genetic-algorithm.ts` | GA implementation              |
| `discovery/fitness.ts`           | Fitness evaluation functions   |
| `discovery/novelty.ts`           | Novelty search algorithm       |
| `discovery/map-elites.ts`        | MAP-Elites quality-diversity   |
| `discovery/replication.ts`       | Self-replication detection     |
| `discovery/phylogeny.ts`         | Lineage tracking               |
| `discovery/genome.ts`            | Genome encoding/decoding       |
| `analysis/statistics.ts`         | Statistical analysis functions |
| `analysis/experiment.ts`         | Experiment comparison          |
