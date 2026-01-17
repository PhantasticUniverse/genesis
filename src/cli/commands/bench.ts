/**
 * Benchmark Commands
 * Performance testing for analysis, fitness, and spatial algorithms
 */

import { Command } from "commander";
import {
  analyzeSymmetry,
  quickSymmetryScore,
  calculateCenterOfMass,
} from "../../analysis/symmetry";
import { calculateLyapunovExponent } from "../../analysis/chaos";
import { detectPeriod, PeriodTracker } from "../../analysis/periodicity";
import {
  calculateSymmetry,
  calculateEntropy,
  calculateMass,
  calculateCentroid,
  calculateBoundingBox,
  calculateOverallFitness,
  calculateBehaviorVector,
  behaviorDistance,
  type BehaviorVector,
} from "../../discovery/fitness";
import {
  BehaviorKDTree,
  createBehaviorIndex,
  weightedDistance,
} from "../../discovery/spatial-index";
import {
  createCPULenia,
  initializeRandom,
  initializeBlob,
  step,
  stepN,
  runSimulation,
  createStepFunction,
  generateRandomState,
  generateBlobState,
} from "../utils/cpu-step";
import {
  report,
  printHeader,
  printSection,
  formatTiming,
  progressBar,
  type OutputFormat,
} from "../utils/reporters";

/**
 * Timer utility
 */
function benchmark<T>(
  fn: () => T,
  iterations: number = 1,
): { result: T; avgMs: number; totalMs: number } {
  const start = performance.now();
  let result!: T;
  for (let i = 0; i < iterations; i++) {
    result = fn();
  }
  const totalMs = performance.now() - start;
  return { result, avgMs: totalMs / iterations, totalMs };
}

/**
 * Register all benchmark commands
 */
export function registerBenchCommands(program: Command): void {
  const bench = program
    .command("bench")
    .description("Benchmark commands for performance testing");

  // KD-tree benchmark
  bench
    .command("kdtree")
    .description("Benchmark KD-tree novelty search performance")
    .option(
      "--sizes <sizes>",
      "Population sizes to test (comma-separated)",
      "100,500,1000,2000",
    )
    .option("--k <k>", "K for k-nearest neighbors", "5")
    .option("--iterations <n>", "Iterations per benchmark", "10")
    .option("-f, --format <format>", "Output format (json|table|csv)", "table")
    .action(async (options) => {
      const sizes = options.sizes.split(",").map(Number);
      const k = parseInt(options.k);
      const iterations = parseInt(options.iterations);
      const format = options.format as OutputFormat;

      printHeader("KD-Tree Benchmark");

      const results: Array<{
        size: number;
        buildMs: number;
        queryMs: number;
        bruteForceMs: number;
        speedup: number;
      }> = [];

      for (const size of sizes) {
        console.log(`Testing population size: ${size}`);

        // Generate random behavior vectors
        const behaviors: BehaviorVector[] = [];
        for (let i = 0; i < size; i++) {
          behaviors.push({
            avgMass: Math.random() * 1000,
            massVariance: Math.random() * 100,
            avgSpeed: Math.random() * 5,
            avgEntropy: Math.random(),
            boundingSize: Math.random() * 100,
            lifespan: Math.random(),
          });
        }

        const items = behaviors.map((b, i) => ({
          behavior: b,
          data: { id: `ind-${i}` },
        }));

        // Benchmark KD-tree build
        const buildResult = benchmark(
          () => createBehaviorIndex(items),
          iterations,
        );

        // Benchmark KD-tree query
        const kdTree = buildResult.result;
        const queryBehavior = behaviors[0];
        const queryResult = benchmark(
          () => kdTree.noveltyScore(queryBehavior, k),
          iterations * 10,
        );

        // Benchmark brute force for comparison
        const bruteForceResult = benchmark(() => {
          const distances = behaviors
            .slice(1)
            .map((b) => weightedDistance(queryBehavior, b));
          distances.sort((a, b) => a - b);
          const kNearest = distances.slice(0, k);
          return kNearest.reduce((a, b) => a + b, 0) / kNearest.length;
        }, iterations * 10);

        results.push({
          size,
          buildMs: buildResult.avgMs,
          queryMs: queryResult.avgMs,
          bruteForceMs: bruteForceResult.avgMs,
          speedup: bruteForceResult.avgMs / queryResult.avgMs,
        });
      }

      printSection("Results");
      report(results, { format });

      printSection("Summary");
      console.log(
        `KD-tree provides ${results[results.length - 1].speedup.toFixed(1)}x speedup at size ${sizes[sizes.length - 1]}`,
      );
    });

  // Symmetry benchmark
  bench
    .command("symmetry")
    .description("Benchmark symmetry analysis performance")
    .option(
      "--sizes <sizes>",
      "Grid sizes to test (comma-separated)",
      "64,128,256,512",
    )
    .option("--iterations <n>", "Iterations per benchmark", "10")
    .option("-f, --format <format>", "Output format (json|table|csv)", "table")
    .action(async (options) => {
      const sizes = options.sizes.split(",").map(Number);
      const iterations = parseInt(options.iterations);
      const format = options.format as OutputFormat;

      printHeader("Symmetry Analysis Benchmark");

      const results: Array<{
        size: number;
        cells: number;
        quickMs: number;
        fullMs: number;
        discoveryMs: number;
      }> = [];

      for (const size of sizes) {
        console.log(`Testing grid size: ${size}x${size}`);

        // Generate test state
        const state = generateBlobState(size, size);

        // Quick symmetry score
        const quickResult = benchmark(
          () => quickSymmetryScore(state, size, size),
          iterations,
        );

        // Full analysis
        const fullResult = benchmark(
          () => analyzeSymmetry(state, size, size),
          iterations,
        );

        // Discovery module symmetry
        const discoveryResult = benchmark(
          () => calculateSymmetry(state, size, size),
          iterations,
        );

        results.push({
          size,
          cells: size * size,
          quickMs: quickResult.avgMs,
          fullMs: fullResult.avgMs,
          discoveryMs: discoveryResult.avgMs,
        });
      }

      printSection("Results");
      report(results, { format });
    });

  // Fitness benchmark
  bench
    .command("fitness")
    .description("Benchmark fitness evaluation throughput")
    .option("--population <n>", "Population size", "100")
    .option("--size <n>", "Grid size", "64")
    .option("--steps <n>", "Simulation steps per individual", "50")
    .option("--iterations <n>", "Number of iterations", "3")
    .option("-f, --format <format>", "Output format (json|table|csv)", "table")
    .action(async (options) => {
      const population = parseInt(options.population);
      const size = parseInt(options.size);
      const steps = parseInt(options.steps);
      const iterations = parseInt(options.iterations);
      const format = options.format as OutputFormat;

      printHeader("Fitness Evaluation Benchmark");

      console.log(
        `Population: ${population}, Grid: ${size}x${size}, Steps: ${steps}`,
      );

      const results: Array<{
        iteration: number;
        totalMs: number;
        avgPerIndividualMs: number;
        throughput: number;
      }> = [];

      for (let iter = 0; iter < iterations; iter++) {
        console.log(`\nIteration ${iter + 1}/${iterations}`);

        const start = performance.now();

        for (let i = 0; i < population; i++) {
          // Create and run simulation
          const ctx = createCPULenia({ width: size, height: size });
          initializeRandom(ctx, 0.3);

          // Collect metrics over simulation
          const massHistory: number[] = [];
          const entropyHistory: number[] = [];
          const centroidHistory: { x: number; y: number }[] = [];
          const boundingHistory: number[] = [];

          for (let s = 0; s < steps; s++) {
            step(ctx);

            massHistory.push(calculateMass(ctx.state));
            entropyHistory.push(calculateEntropy(ctx.state));
            centroidHistory.push(calculateCentroid(ctx.state, size, size));
            boundingHistory.push(
              calculateBoundingBox(ctx.state, size, size).size,
            );
          }

          // Calculate fitness
          const symmetry = calculateSymmetry(ctx.state, size, size);
          const behaviorVector = calculateBehaviorVector(
            massHistory,
            entropyHistory,
            centroidHistory,
            boundingHistory,
            size,
            size,
          );

          if ((i + 1) % 20 === 0) {
            process.stdout.write(`\r${progressBar(i + 1, population)}`);
          }
        }

        const totalMs = performance.now() - start;
        const avgMs = totalMs / population;

        results.push({
          iteration: iter + 1,
          totalMs,
          avgPerIndividualMs: avgMs,
          throughput: (population / totalMs) * 1000,
        });

        console.log(
          `\nTotal: ${formatTiming(totalMs)}, Avg: ${formatTiming(avgMs)}/individual`,
        );
      }

      printSection("Results");
      report(results, { format });

      const avgThroughput =
        results.reduce((a, b) => a + b.throughput, 0) / results.length;
      console.log(
        `\nAverage throughput: ${avgThroughput.toFixed(1)} evaluations/second`,
      );
    });

  // CPU step benchmark
  bench
    .command("cpu-step")
    .description("Benchmark CPU Lenia step function")
    .option("--sizes <sizes>", "Grid sizes to test", "32,64,128,256")
    .option("--steps <n>", "Steps per benchmark", "100")
    .option("-f, --format <format>", "Output format (json|table|csv)", "table")
    .action(async (options) => {
      const sizes = options.sizes.split(",").map(Number);
      const stepCount = parseInt(options.steps);
      const format = options.format as OutputFormat;

      printHeader("CPU Step Function Benchmark");

      const results: Array<{
        size: number;
        cells: number;
        totalMs: number;
        avgStepMs: number;
        stepsPerSecond: number;
      }> = [];

      for (const size of sizes) {
        console.log(`Testing grid size: ${size}x${size}`);

        const ctx = createCPULenia({ width: size, height: size });
        initializeBlob(ctx);

        const start = performance.now();
        stepN(ctx, stepCount);
        const totalMs = performance.now() - start;

        results.push({
          size,
          cells: size * size,
          totalMs,
          avgStepMs: totalMs / stepCount,
          stepsPerSecond: (stepCount / totalMs) * 1000,
        });
      }

      printSection("Results");
      report(results, { format });
    });

  // Lyapunov benchmark
  bench
    .command("lyapunov")
    .description("Benchmark Lyapunov exponent calculation")
    .option("--sizes <sizes>", "Grid sizes to test", "32,64,128")
    .option("--steps <n>", "Steps for calculation", "50")
    .option("--iterations <n>", "Iterations per benchmark", "3")
    .option("-f, --format <format>", "Output format (json|table|csv)", "table")
    .action(async (options) => {
      const sizes = options.sizes.split(",").map(Number);
      const steps = parseInt(options.steps);
      const iterations = parseInt(options.iterations);
      const format = options.format as OutputFormat;

      printHeader("Lyapunov Exponent Benchmark");

      const results: Array<{
        size: number;
        avgMs: number;
        exponent: number;
        classification: string;
      }> = [];

      for (const size of sizes) {
        console.log(`Testing grid size: ${size}x${size}`);

        const stepFunction = createStepFunction({ width: size, height: size });
        const initialState = generateRandomState(size, size, 0.3);

        let totalMs = 0;
        let lastResult: ReturnType<typeof calculateLyapunovExponent> | null =
          null;

        for (let i = 0; i < iterations; i++) {
          const start = performance.now();
          lastResult = calculateLyapunovExponent(initialState, stepFunction, {
            steps,
          });
          totalMs += performance.now() - start;
        }

        results.push({
          size,
          avgMs: totalMs / iterations,
          exponent: lastResult!.exponent,
          classification: lastResult!.classification,
        });
      }

      printSection("Results");
      report(results, { format });
    });

  // Period detection benchmark
  bench
    .command("period")
    .description("Benchmark period detection performance")
    .option("--sizes <sizes>", "Grid sizes to test", "32,64,128")
    .option("--history <n>", "History length", "200")
    .option("--iterations <n>", "Iterations per benchmark", "3")
    .option("-f, --format <format>", "Output format (json|table|csv)", "table")
    .action(async (options) => {
      const sizes = options.sizes.split(",").map(Number);
      const historyLength = parseInt(options.history);
      const iterations = parseInt(options.iterations);
      const format = options.format as OutputFormat;

      printHeader("Period Detection Benchmark");

      const results: Array<{
        size: number;
        simulationMs: number;
        detectionMs: number;
        totalMs: number;
        period: number;
        behavior: string;
      }> = [];

      for (const size of sizes) {
        console.log(`Testing grid size: ${size}x${size}`);

        let totalSimMs = 0;
        let totalDetMs = 0;
        let lastResult: ReturnType<typeof detectPeriod> | null = null;

        for (let i = 0; i < iterations; i++) {
          const ctx = createCPULenia({ width: size, height: size });
          initializeRandom(ctx, 0.3);

          // Simulate
          const simStart = performance.now();
          const history = runSimulation(ctx, historyLength, 1);
          totalSimMs += performance.now() - simStart;

          // Detect period
          const detStart = performance.now();
          lastResult = detectPeriod(history, size, size);
          totalDetMs += performance.now() - detStart;
        }

        results.push({
          size,
          simulationMs: totalSimMs / iterations,
          detectionMs: totalDetMs / iterations,
          totalMs: (totalSimMs + totalDetMs) / iterations,
          period: lastResult!.period,
          behavior: lastResult!.behavior,
        });
      }

      printSection("Results");
      report(results, { format });
    });

  // Full benchmark suite
  bench
    .command("all")
    .description("Run all benchmarks")
    .option("-f, --format <format>", "Output format (json|table|csv)", "table")
    .action(async (options) => {
      const format = options.format as OutputFormat;

      printHeader("Complete Benchmark Suite");

      // Run each benchmark with default settings
      const summary: Record<string, unknown> = {};

      // CPU step
      printSection("CPU Step");
      const ctx = createCPULenia({ width: 128, height: 128 });
      initializeBlob(ctx);
      const stepBench = benchmark(() => stepN(ctx, 100), 1);
      summary.cpuStepMs = stepBench.avgMs;
      console.log(`100 steps @ 128x128: ${formatTiming(stepBench.avgMs)}`);

      // Symmetry
      printSection("Symmetry");
      const state = generateBlobState(128, 128);
      const symBench = benchmark(() => analyzeSymmetry(state, 128, 128), 10);
      summary.symmetryMs = symBench.avgMs;
      console.log(`Full analysis @ 128x128: ${formatTiming(symBench.avgMs)}`);

      // KD-tree
      printSection("KD-Tree");
      const behaviors: BehaviorVector[] = [];
      for (let i = 0; i < 1000; i++) {
        behaviors.push({
          avgMass: Math.random() * 1000,
          massVariance: Math.random() * 100,
          avgSpeed: Math.random() * 5,
          avgEntropy: Math.random(),
          boundingSize: Math.random() * 100,
          lifespan: Math.random(),
        });
      }
      const items = behaviors.map((b, i) => ({
        behavior: b,
        data: { id: `ind-${i}` },
      }));
      const kdBuildBench = benchmark(() => createBehaviorIndex(items), 10);
      const kdTree = kdBuildBench.result;
      const kdQueryBench = benchmark(
        () => kdTree.noveltyScore(behaviors[0], 5),
        100,
      );
      summary.kdTreeBuildMs = kdBuildBench.avgMs;
      summary.kdTreeQueryMs = kdQueryBench.avgMs;
      console.log(`Build (1000 items): ${formatTiming(kdBuildBench.avgMs)}`);
      console.log(`Query (k=5): ${formatTiming(kdQueryBench.avgMs)}`);

      // Period detection
      printSection("Period Detection");
      const periodCtx = createCPULenia({ width: 64, height: 64 });
      initializeRandom(periodCtx, 0.3);
      const history = runSimulation(periodCtx, 100, 1);
      const periodBench = benchmark(() => detectPeriod(history, 64, 64), 10);
      summary.periodDetectionMs = periodBench.avgMs;
      console.log(
        `Detection (100 states @ 64x64): ${formatTiming(periodBench.avgMs)}`,
      );

      printSection("Summary");
      report(summary, { format });
    });
}
