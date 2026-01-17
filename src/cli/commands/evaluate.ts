/**
 * Evaluate Commands
 * Fitness evaluation for individual genomes
 */

import { Command } from "commander";
import {
  randomGenome,
  encodeGenome,
  decodeGenome,
  type LeniaGenome,
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
import { analyzeSymmetry, detectSymmetryType } from "../../analysis/symmetry";
import {
  detectPeriod,
  classifyPeriodBehavior,
} from "../../analysis/periodicity";
import {
  createCPULenia,
  initializeBlob,
  step,
  getState,
  runSimulation,
} from "../utils/cpu-step";
import {
  report,
  printHeader,
  printSection,
  formatTiming,
  type OutputFormat,
} from "../utils/reporters";
import * as fs from "fs";

/**
 * Full evaluation result
 */
interface EvaluationReport {
  genome: {
    kernelRadius: number;
    growthCenter: number;
    growthWidth: number;
    blobRadius: number;
    blobIntensity: number;
    encoded: string;
  };
  fitness: FitnessMetrics;
  behavior: BehaviorVector;
  symmetry: {
    order: number;
    strength: number;
    types: string[];
  };
  period: {
    period: number;
    behavior: string;
    classification: string;
  };
  simulation: {
    steps: number;
    initialMass: number;
    finalMass: number;
    massChangePercent: number;
  };
}

/**
 * Run full evaluation
 */
function runFullEvaluation(
  genome: LeniaGenome,
  config: { width: number; height: number; steps: number },
): EvaluationReport {
  const { width, height, steps } = config;

  // Create Lenia context (genome.R = radius, genome.m = growth center, genome.s = growth width)
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
  const stateHistory: Float32Array[] = [];

  const initialMass = calculateMass(ctx.state);
  massHistory.push(initialMass);
  stateHistory.push(getState(ctx));

  for (let i = 0; i < steps; i++) {
    step(ctx);

    massHistory.push(calculateMass(ctx.state));
    entropyHistory.push(calculateEntropy(ctx.state));
    centroidHistory.push(calculateCentroid(ctx.state, width, height));
    boundingHistory.push(calculateBoundingBox(ctx.state, width, height).size);

    // Record state periodically for period detection
    if (i % 5 === 0) {
      stateHistory.push(getState(ctx));
    }
  }

  // Calculate fitness metrics
  const finalState = getState(ctx);
  const finalMass = calculateMass(finalState);
  const survival = calculateSurvivalFitness(
    massHistory,
    initialMass,
    steps / 2,
  );
  const stability = calculateStabilityFitness(massHistory);
  const complexity = calculateEntropy(finalState);
  const symmetryScore = calculateSymmetry(finalState, width, height);
  const movement = calculateMovementFitness(centroidHistory, width, height);

  const metricsWithoutOverall = {
    survival,
    stability,
    complexity,
    symmetry: symmetryScore,
    movement,
    replication: 0,
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

  // Advanced symmetry analysis
  const advancedSymmetry = analyzeSymmetry(finalState, width, height);
  const symmetryTypes = detectSymmetryType(advancedSymmetry);

  // Period detection
  const periodResult = detectPeriod(stateHistory, width, height);

  return {
    genome: {
      kernelRadius: genome.R,
      growthCenter: genome.m,
      growthWidth: genome.s,
      timeResolution: genome.T,
      peaks: genome.b,
      encoded: encodeGenome(genome),
    },
    fitness,
    behavior,
    symmetry: {
      order: advancedSymmetry.order,
      strength: advancedSymmetry.strength,
      types: symmetryTypes,
    },
    period: {
      period: periodResult.period,
      behavior: periodResult.behavior,
      classification: classifyPeriodBehavior(periodResult),
    },
    simulation: {
      steps,
      initialMass,
      finalMass,
      massChangePercent: ((finalMass - initialMass) / initialMass) * 100,
    },
  };
}

/**
 * Register evaluate commands
 */
export function registerEvaluateCommands(program: Command): void {
  const evaluate = program
    .command("evaluate")
    .description("Evaluate fitness of genomes");

  // Evaluate a single genome
  evaluate
    .command("genome")
    .description("Evaluate a genome from encoded string or JSON file")
    .option("-g, --genome <encoded>", "Encoded genome string")
    .option("-i, --input <file>", "JSON file containing genome")
    .option("--size <n>", "Grid size", "64")
    .option("--steps <n>", "Simulation steps", "100")
    .option("-f, --format <format>", "Output format (json|table|csv)", "json")
    .option("-o, --output <file>", "Output file for results")
    .action(async (options) => {
      const size = parseInt(options.size);
      const steps = parseInt(options.steps);
      const format = options.format as OutputFormat;

      printHeader("Genome Evaluation");

      let genome: LeniaGenome;

      if (options.genome) {
        // Decode from string
        genome = decodeGenome(options.genome);
        console.log("Decoded genome from string");
      } else if (options.input) {
        // Load from file
        const data = JSON.parse(fs.readFileSync(options.input, "utf-8"));
        if (data.encoded) {
          genome = decodeGenome(data.encoded);
        } else {
          genome = data as LeniaGenome;
        }
        console.log(`Loaded genome from ${options.input}`);
      } else {
        // Generate random
        genome = randomGenome();
        console.log("Generated random genome");
      }

      console.log(`Grid: ${size}x${size}, Steps: ${steps}`);
      console.log(`Kernel radius: ${genome.R}`);
      console.log(`Growth center: ${genome.m.toFixed(4)}`);
      console.log(`Growth width: ${genome.s.toFixed(4)}`);

      printSection("Running Evaluation");
      const start = performance.now();
      const result = runFullEvaluation(genome, {
        width: size,
        height: size,
        steps,
      });
      const elapsed = performance.now() - start;

      console.log(`Completed in ${formatTiming(elapsed)}`);

      printSection("Results");

      // Output results
      if (options.output) {
        fs.writeFileSync(options.output, JSON.stringify(result, null, 2));
        console.log(`Results saved to ${options.output}`);
      }

      report(result, { format });
    });

  // Batch evaluate multiple genomes
  evaluate
    .command("batch")
    .description("Evaluate multiple genomes")
    .option("-i, --input <file>", "JSON file containing array of genomes")
    .option("-n, --count <n>", "Number of random genomes to evaluate", "10")
    .option("--size <n>", "Grid size", "64")
    .option("--steps <n>", "Simulation steps", "100")
    .option("-f, --format <format>", "Output format (json|table|csv)", "table")
    .option("-o, --output <file>", "Output file for results")
    .action(async (options) => {
      const count = parseInt(options.count);
      const size = parseInt(options.size);
      const steps = parseInt(options.steps);
      const format = options.format as OutputFormat;

      printHeader("Batch Genome Evaluation");

      let genomes: LeniaGenome[];

      if (options.input) {
        const data = JSON.parse(fs.readFileSync(options.input, "utf-8"));
        genomes = Array.isArray(data)
          ? data.map((d) => (d.encoded ? decodeGenome(d.encoded) : d))
          : [data.encoded ? decodeGenome(data.encoded) : data];
        console.log(`Loaded ${genomes.length} genomes from ${options.input}`);
      } else {
        genomes = Array.from({ length: count }, () => randomGenome());
        console.log(`Generated ${count} random genomes`);
      }

      console.log(`Grid: ${size}x${size}, Steps: ${steps}\n`);

      const results: Array<{
        index: number;
        fitness: number;
        survival: number;
        stability: number;
        symmetry: number;
        complexity: number;
        movement: number;
        massChange: number;
        period: string;
      }> = [];

      for (let i = 0; i < genomes.length; i++) {
        const genome = genomes[i];
        process.stdout.write(`\rEvaluating ${i + 1}/${genomes.length}...`);

        const result = runFullEvaluation(genome, {
          width: size,
          height: size,
          steps,
        });

        results.push({
          index: i + 1,
          fitness: result.fitness.overall,
          survival: result.fitness.survival,
          stability: result.fitness.stability,
          symmetry: result.fitness.symmetry,
          complexity: result.fitness.complexity,
          movement: result.fitness.movement,
          massChange: result.simulation.massChangePercent,
          period: result.period.behavior,
        });
      }

      console.log("\n");

      // Sort by fitness
      results.sort((a, b) => b.fitness - a.fitness);

      printSection("Results (sorted by fitness)");

      // Output results
      if (options.output) {
        fs.writeFileSync(options.output, JSON.stringify(results, null, 2));
        console.log(`Results saved to ${options.output}`);
      }

      report(results, { format });

      // Summary statistics
      printSection("Summary");
      const avgFitness =
        results.reduce((a, b) => a + b.fitness, 0) / results.length;
      const maxFitness = Math.max(...results.map((r) => r.fitness));
      const minFitness = Math.min(...results.map((r) => r.fitness));

      console.log(`Average fitness: ${avgFitness.toFixed(4)}`);
      console.log(`Best fitness: ${maxFitness.toFixed(4)}`);
      console.log(`Worst fitness: ${minFitness.toFixed(4)}`);
    });

  // Compare two genomes
  evaluate
    .command("compare")
    .description("Compare two genomes side by side")
    .requiredOption("-a, --genome-a <encoded>", "First genome (encoded)")
    .requiredOption("-b, --genome-b <encoded>", "Second genome (encoded)")
    .option("--size <n>", "Grid size", "64")
    .option("--steps <n>", "Simulation steps", "100")
    .option("-f, --format <format>", "Output format (json|table|csv)", "table")
    .action(async (options) => {
      const size = parseInt(options.size);
      const steps = parseInt(options.steps);
      const format = options.format as OutputFormat;

      printHeader("Genome Comparison");

      const genomeA = decodeGenome(options.genomeA);
      const genomeB = decodeGenome(options.genomeB);

      console.log("Evaluating genome A...");
      const resultA = runFullEvaluation(genomeA, {
        width: size,
        height: size,
        steps,
      });

      console.log("Evaluating genome B...");
      const resultB = runFullEvaluation(genomeB, {
        width: size,
        height: size,
        steps,
      });

      printSection("Comparison");

      const comparison = [
        {
          metric: "Overall Fitness",
          genomeA: resultA.fitness.overall,
          genomeB: resultB.fitness.overall,
          winner: resultA.fitness.overall > resultB.fitness.overall ? "A" : "B",
        },
        {
          metric: "Survival",
          genomeA: resultA.fitness.survival,
          genomeB: resultB.fitness.survival,
          winner:
            resultA.fitness.survival > resultB.fitness.survival ? "A" : "B",
        },
        {
          metric: "Stability",
          genomeA: resultA.fitness.stability,
          genomeB: resultB.fitness.stability,
          winner:
            resultA.fitness.stability > resultB.fitness.stability ? "A" : "B",
        },
        {
          metric: "Symmetry",
          genomeA: resultA.fitness.symmetry,
          genomeB: resultB.fitness.symmetry,
          winner:
            resultA.fitness.symmetry > resultB.fitness.symmetry ? "A" : "B",
        },
        {
          metric: "Complexity",
          genomeA: resultA.fitness.complexity,
          genomeB: resultB.fitness.complexity,
          winner:
            resultA.fitness.complexity > resultB.fitness.complexity ? "A" : "B",
        },
        {
          metric: "Movement",
          genomeA: resultA.fitness.movement,
          genomeB: resultB.fitness.movement,
          winner:
            resultA.fitness.movement > resultB.fitness.movement ? "A" : "B",
        },
      ];

      report(comparison, { format });

      // Overall winner
      const winsA = comparison.filter((c) => c.winner === "A").length;
      const winsB = comparison.filter((c) => c.winner === "B").length;
      console.log(
        `\nOverall: Genome ${winsA > winsB ? "A" : "B"} wins (${Math.max(winsA, winsB)} of ${comparison.length} metrics)`,
      );
    });

  // Quick fitness check
  evaluate
    .command("quick")
    .description("Quick fitness estimate (fewer steps)")
    .option("-g, --genome <encoded>", "Encoded genome string")
    .option("-r, --random", "Use random genome")
    .option("--size <n>", "Grid size", "64")
    .option("-f, --format <format>", "Output format (json|table|csv)", "json")
    .action(async (options) => {
      const size = parseInt(options.size);
      const format = options.format as OutputFormat;

      printHeader("Quick Fitness Check");

      let genome: LeniaGenome;

      if (options.genome) {
        genome = decodeGenome(options.genome);
      } else {
        genome = randomGenome();
        console.log("Using random genome");
      }

      // Quick evaluation with fewer steps
      const ctx = createCPULenia({
        width: size,
        height: size,
        kernelRadius: Math.round(genome.R),
        growthCenter: genome.m,
        growthWidth: genome.s,
        dt: 1 / genome.T,
      });

      const blobRadius = Math.min(size, size) / 6;
      initializeBlob(ctx, blobRadius, 0.8);

      const initialMass = calculateMass(ctx.state);
      const massHistory: number[] = [initialMass];

      // Run 50 steps
      for (let i = 0; i < 50; i++) {
        step(ctx);
        massHistory.push(calculateMass(ctx.state));
      }

      const finalState = getState(ctx);
      const finalMass = calculateMass(finalState);

      const result = {
        genome: {
          kernelRadius: genome.R,
          growthCenter: genome.m.toFixed(4),
          growthWidth: genome.s.toFixed(4),
          timeResolution: genome.T,
          encoded: encodeGenome(genome),
        },
        quickMetrics: {
          survived: finalMass > initialMass * 0.1,
          massRetained: (finalMass / initialMass) * 100,
          symmetry: calculateSymmetry(finalState, size, size),
          entropy: calculateEntropy(finalState),
        },
      };

      report(result, { format });
    });
}
