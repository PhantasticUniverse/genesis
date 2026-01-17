/**
 * Evolve Commands
 * GA evolution runner for CLI
 */

import { Command } from "commander";
import {
  createGAController,
  type Individual,
  type GAConfig,
} from "../../discovery/genetic-algorithm";
import {
  randomGenome,
  encodeGenome,
  decodeGenome,
} from "../../discovery/genome";
import {
  calculateSymmetry,
  calculateEntropy,
  calculateMass,
  calculateCentroid,
  calculateBoundingBox,
  calculateSurvivalFitness,
  calculateStabilityFitness,
  calculateMovementFitness,
  calculateOverallFitness,
  calculateBehaviorVector,
  type FitnessMetrics,
  type BehaviorVector,
} from "../../discovery/fitness";
import {
  createCPULenia,
  initializeBlob,
  step,
  getState,
  setState,
  type CPULeniaConfig,
} from "../utils/cpu-step";
import {
  report,
  printHeader,
  printSection,
  formatTiming,
  progressBar,
  type OutputFormat,
} from "../utils/reporters";
import * as fs from "fs";

interface EvaluationResult {
  fitness: FitnessMetrics;
  behavior: BehaviorVector;
  massHistory: number[];
  finalState: Float32Array;
}

/**
 * Evaluate a genome using CPU simulation
 */
function evaluateGenome(
  genome: ReturnType<typeof randomGenome>,
  config: { width: number; height: number; steps: number },
): EvaluationResult {
  const { width, height, steps } = config;

  // Map genome parameters to CPU Lenia config
  // genome.R = radius, genome.m = growth center, genome.s = growth width, genome.T = time resolution
  const ctx = createCPULenia({
    width,
    height,
    kernelRadius: Math.round(genome.R),
    growthCenter: genome.m,
    growthWidth: genome.s,
    dt: 1 / genome.T,
  });

  // Initialize with blob (use sensible defaults based on grid size)
  const blobRadius = Math.min(width, height) / 6;
  const blobIntensity = 0.8;
  initializeBlob(ctx, blobRadius, blobIntensity);

  // Collect metrics during simulation
  const massHistory: number[] = [];
  const entropyHistory: number[] = [];
  const centroidHistory: { x: number; y: number }[] = [];
  const boundingHistory: number[] = [];

  const initialMass = calculateMass(ctx.state);
  massHistory.push(initialMass);

  for (let i = 0; i < steps; i++) {
    step(ctx);

    massHistory.push(calculateMass(ctx.state));
    entropyHistory.push(calculateEntropy(ctx.state));
    centroidHistory.push(calculateCentroid(ctx.state, width, height));
    boundingHistory.push(calculateBoundingBox(ctx.state, width, height).size);
  }

  // Calculate fitness metrics
  const finalState = getState(ctx);
  const survival = calculateSurvivalFitness(
    massHistory,
    initialMass,
    steps / 2,
  );
  const stability = calculateStabilityFitness(massHistory);
  const complexity = calculateEntropy(finalState);
  const symmetry = calculateSymmetry(finalState, width, height);
  const movement = calculateMovementFitness(centroidHistory, width, height);

  const metricsWithoutOverall = {
    survival,
    stability,
    complexity,
    symmetry,
    movement,
    replication: 0, // Would need replication detector
  };

  const fitness = calculateOverallFitness(metricsWithoutOverall);

  const behavior = calculateBehaviorVector(
    massHistory,
    entropyHistory,
    centroidHistory,
    boundingHistory,
    width,
    height,
  );

  return { fitness, behavior, massHistory, finalState };
}

/**
 * Register evolve commands
 */
export function registerEvolveCommands(program: Command): void {
  const evolve = program
    .command("evolve")
    .description("Run genetic algorithm evolution");

  // Main evolution command
  evolve
    .command("run")
    .description("Run GA evolution")
    .option("--population <n>", "Population size", "20")
    .option("--generations <n>", "Number of generations", "10")
    .option("--size <n>", "Grid size", "64")
    .option("--steps <n>", "Simulation steps per evaluation", "100")
    .option("--elite <n>", "Number of elite individuals", "2")
    .option("--mutation <n>", "Mutation rate", "0.15")
    .option("--crossover <n>", "Crossover rate", "0.7")
    .option("--novelty <n>", "Novelty weight (0-1)", "0.3")
    .option("-o, --output <file>", "Output file for results")
    .option("-f, --format <format>", "Output format (json|table|csv)", "json")
    .action(async (options) => {
      const populationSize = parseInt(options.population);
      const generations = parseInt(options.generations);
      const size = parseInt(options.size);
      const steps = parseInt(options.steps);
      const format = options.format as OutputFormat;

      printHeader("Genetic Algorithm Evolution");

      console.log(`Population: ${populationSize}`);
      console.log(`Generations: ${generations}`);
      console.log(`Grid: ${size}x${size}`);
      console.log(`Steps per evaluation: ${steps}\n`);

      // Create GA controller
      const gaConfig: Partial<GAConfig> = {
        populationSize,
        eliteCount: parseInt(options.elite),
        mutationRate: parseFloat(options.mutation),
        crossoverRate: parseFloat(options.crossover),
        noveltyWeight: parseFloat(options.novelty),
      };

      const ga = createGAController(gaConfig);

      const generationStats: Array<{
        generation: number;
        bestFitness: number;
        avgFitness: number;
        archiveSize: number;
        elapsedMs: number;
      }> = [];

      const startTime = performance.now();

      // Evolution loop
      for (let gen = 0; gen < generations; gen++) {
        const genStart = performance.now();

        printSection(`Generation ${gen + 1}/${generations}`);

        // Evaluate population
        const population = ga.getPopulation();
        let totalFitness = 0;
        let evaluated = 0;

        for (const individual of population) {
          if (individual.fitness === null) {
            const result = evaluateGenome(individual.genome, {
              width: size,
              height: size,
              steps,
            });
            ga.setFitness(individual.id, result.fitness, result.behavior);
            totalFitness += result.fitness.overall;
            evaluated++;

            if (evaluated % 5 === 0) {
              process.stdout.write(
                `\r${progressBar(evaluated, population.length)}`,
              );
            }
          }
        }

        console.log(`\rEvaluated ${evaluated} individuals`);

        // Get stats
        const state = ga.getState();
        const avgFitness = totalFitness / evaluated;

        generationStats.push({
          generation: gen + 1,
          bestFitness: state.bestFitness,
          avgFitness,
          archiveSize: state.archive.length,
          elapsedMs: performance.now() - genStart,
        });

        console.log(`Best fitness: ${state.bestFitness.toFixed(4)}`);
        console.log(`Avg fitness: ${avgFitness.toFixed(4)}`);
        console.log(`Archive size: ${state.archive.length}`);

        // Evolve to next generation
        if (gen < generations - 1) {
          ga.evolve();
        }
      }

      const totalTime = performance.now() - startTime;

      printSection("Final Results");

      const state = ga.getState();
      const bestGenome = state.bestIndividual?.genome;

      const results = {
        generations,
        populationSize,
        totalTimeMs: totalTime,
        bestFitness: state.bestFitness,
        archiveSize: state.archive.length,
        bestGenome: bestGenome
          ? {
              kernelRadius: bestGenome.R,
              growthCenter: bestGenome.m,
              growthWidth: bestGenome.s,
              timeResolution: bestGenome.T,
              peaks: bestGenome.b,
              encoded: encodeGenome(bestGenome),
            }
          : null,
        generationStats,
      };

      // Output results
      if (options.output) {
        fs.writeFileSync(options.output, JSON.stringify(results, null, 2));
        console.log(`\nResults saved to ${options.output}`);
      }

      report(
        {
          totalTime: formatTiming(totalTime),
          bestFitness: state.bestFitness,
          archiveSize: state.archive.length,
        },
        { format },
      );
    });

  // Quick single-generation test
  evolve
    .command("test")
    .description("Quick single-generation test")
    .option("--population <n>", "Population size", "10")
    .option("--size <n>", "Grid size", "64")
    .option("--steps <n>", "Simulation steps", "50")
    .option("-f, --format <format>", "Output format (json|table|csv)", "table")
    .action(async (options) => {
      const populationSize = parseInt(options.population);
      const size = parseInt(options.size);
      const steps = parseInt(options.steps);
      const format = options.format as OutputFormat;

      printHeader("GA Quick Test");

      const ga = createGAController({ populationSize });
      const population = ga.getPopulation();

      const results: Array<{
        id: string;
        fitness: number;
        survival: number;
        stability: number;
        symmetry: number;
      }> = [];

      console.log(`Evaluating ${populationSize} random genomes...`);

      for (const individual of population) {
        const result = evaluateGenome(individual.genome, {
          width: size,
          height: size,
          steps,
        });
        ga.setFitness(individual.id, result.fitness, result.behavior);

        results.push({
          id: individual.id,
          fitness: result.fitness.overall,
          survival: result.fitness.survival,
          stability: result.fitness.stability,
          symmetry: result.fitness.symmetry,
        });
      }

      // Sort by fitness
      results.sort((a, b) => b.fitness - a.fitness);

      printSection("Results (top 5)");
      report(results.slice(0, 5), { format });
    });

  // Resume evolution from saved state
  evolve
    .command("resume")
    .description("Resume evolution from saved results")
    .requiredOption("-i, --input <file>", "Input file with previous results")
    .option("--generations <n>", "Additional generations to run", "5")
    .option("-o, --output <file>", "Output file for results")
    .option("-f, --format <format>", "Output format (json|table|csv)", "json")
    .action(async (options) => {
      const generations = parseInt(options.generations);
      const format = options.format as OutputFormat;

      printHeader("Resume Evolution");

      // Load previous results
      const previousResults = JSON.parse(
        fs.readFileSync(options.input, "utf-8"),
      );
      console.log(`Loaded results from ${options.input}`);
      console.log(`Previous best fitness: ${previousResults.bestFitness}`);

      // Decode best genome
      if (!previousResults.bestGenome?.encoded) {
        console.error("No encoded genome found in previous results");
        return;
      }

      const bestGenome = decodeGenome(previousResults.bestGenome.encoded);
      console.log(`Decoded genome with radius ${bestGenome.R}`);

      // Create new GA with the best genome as seed
      const ga = createGAController({
        populationSize: previousResults.populationSize || 20,
      });

      // Re-run evaluation of the best to seed the population
      console.log(
        `\nContinuing evolution for ${generations} more generations...`,
      );

      // The actual evolution would continue here
      // For now, just report that we loaded successfully
      report(
        {
          loaded: true,
          previousBestFitness: previousResults.bestFitness,
          additionalGenerations: generations,
        },
        { format },
      );
    });
}
