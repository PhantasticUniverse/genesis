/**
 * Multi-Kernel Lenia CLI Commands
 * Command-line interface for multi-kernel Lenia simulations
 */

import { Command } from "commander";
import * as fs from "fs";
import {
  randomMultiKernelGenome,
  mutateMultiKernelGenome,
  crossoverMultiKernelGenomes,
  multiKernelGenomeToConfig,
  encodeMultiKernelGenome,
  decodeMultiKernelGenome,
  type MultiKernelGenome,
} from "../../discovery/genome";
import type { MultiKernelConfig } from "../../core/types";
import {
  MULTIKERNEL_PRESETS,
  validateConfig,
  serializeConfig,
  deserializeConfig,
} from "../../core/multi-kernel";
import {
  calculateSymmetry,
  calculateEntropy,
  calculateMass,
  calculateCentroid,
  calculateSurvivalFitness,
  calculateStabilityFitness,
} from "../../discovery/fitness";
import {
  report,
  printHeader,
  printSection,
  formatTiming,
  type OutputFormat,
} from "../utils/reporters";
import { setSeed, getSeed, random, randomBool } from "../../core/random";
import { createExperimentTracker } from "../experiment-tracker";

// ============================================================================
// CPU-Based Multi-Kernel Lenia Simulation
// ============================================================================

interface CPUMultiKernelContext {
  config: MultiKernelConfig;
  width: number;
  height: number;
  state: Float32Array;
  kernels: Float32Array[]; // Precomputed kernel weights
  kernelSizes: number[]; // Sizes per kernel
}

/**
 * Generate kernel weights for a single kernel (CPU version)
 */
function generateKernelWeightsCPU(
  shape: string,
  radius: number,
  peaks: number[],
): Float32Array {
  const size = 2 * radius + 1;
  const weights = new Float32Array(size * size);
  let sum = 0;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - radius;
      const dy = y - radius;
      const r = Math.sqrt(dx * dx + dy * dy) / radius; // Normalized distance

      let weight = 0;

      switch (shape) {
        case "gaussian":
          weight = Math.exp(-0.5 * Math.pow((r - 0.5) / 0.15, 2));
          break;

        case "ring":
          const ringWidth = 0.5;
          if (r >= 1 - ringWidth && r <= 1) {
            const mid = 1 - ringWidth / 2;
            const d = Math.abs(r - mid) / (ringWidth / 2);
            if (d < 1) {
              const t = 1 - d * d;
              weight = t * t;
            }
          }
          break;

        case "polynomial":
        default:
          for (const peak of peaks) {
            const d = Math.abs(r - peak);
            if (d < 1) {
              const t = 1 - d * d;
              weight += t * t * t * t;
            }
          }
          break;
      }

      // Zero center
      if (r < 0.01) weight = 0;

      weights[y * size + x] = weight;
      sum += weight;
    }
  }

  // Normalize
  if (sum > 0) {
    for (let i = 0; i < weights.length; i++) {
      weights[i] /= sum;
    }
  }

  return weights;
}

/**
 * Polynomial growth function
 */
function growthPolynomial(n: number, mu: number, sigma: number): number {
  const x = (n - mu) / (3 * sigma);
  if (Math.abs(x) >= 1) return -1;
  const t = 1 - x * x;
  return 2 * t * t * t * t - 1;
}

/**
 * Gaussian growth function
 */
function growthGaussian(n: number, mu: number, sigma: number): number {
  const d = (n - mu) / sigma;
  return 2 * Math.exp(-0.5 * d * d) - 1;
}

/**
 * Create CPU multi-kernel Lenia context
 */
function createCPUMultiKernel(
  config: MultiKernelConfig,
  width: number,
  height: number,
): CPUMultiKernelContext {
  // Generate all kernel weights
  const kernels: Float32Array[] = [];
  const kernelSizes: number[] = [];

  for (const k of config.kernels) {
    const weights = generateKernelWeightsCPU(k.shape, k.radius, k.peaks);
    kernels.push(weights);
    kernelSizes.push(2 * k.radius + 1);
  }

  return {
    config,
    width,
    height,
    state: new Float32Array(width * height),
    kernels,
    kernelSizes,
  };
}

/**
 * Initialize with centered blob
 */
function initializeBlobMultiKernel(
  ctx: CPUMultiKernelContext,
  radius: number,
  intensity: number,
): void {
  const cx = ctx.width / 2;
  const cy = ctx.height / 2;

  for (let y = 0; y < ctx.height; y++) {
    for (let x = 0; x < ctx.width; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < radius) {
        const value = intensity * Math.exp((-dist * dist) / (radius * radius));
        ctx.state[y * ctx.width + x] = value;
      }
    }
  }
}

/**
 * Perform convolution for a single kernel
 */
function convolveKernel(
  ctx: CPUMultiKernelContext,
  x: number,
  y: number,
  kernelIndex: number,
): number {
  const kernel = ctx.kernels[kernelIndex];
  const size = ctx.kernelSizes[kernelIndex];
  const radius = (size - 1) / 2;

  let sum = 0;
  let kernelSum = 0;

  for (let ky = 0; ky < size; ky++) {
    for (let kx = 0; kx < size; kx++) {
      let nx = x + kx - radius;
      let ny = y + ky - radius;

      // Toroidal wrap
      if (nx < 0) nx += ctx.width;
      if (ny < 0) ny += ctx.height;
      if (nx >= ctx.width) nx -= ctx.width;
      if (ny >= ctx.height) ny -= ctx.height;

      const weight = kernel[ky * size + kx];
      sum += ctx.state[ny * ctx.width + nx] * weight;
      kernelSum += weight;
    }
  }

  return kernelSum > 0 ? sum / kernelSum : 0;
}

/**
 * Step the multi-kernel simulation
 */
function stepMultiKernel(ctx: CPUMultiKernelContext): void {
  const newState = new Float32Array(ctx.width * ctx.height);
  const { config } = ctx;

  for (let y = 0; y < ctx.height; y++) {
    for (let x = 0; x < ctx.width; x++) {
      const idx = y * ctx.width + x;
      const current = ctx.state[idx];

      let totalGrowth = 0;
      let totalWeight = 0;

      for (let i = 0; i < config.kernels.length; i++) {
        const n = convolveKernel(ctx, x, y, i);
        const gp = config.growthParams[i];
        const kWeight = config.kernels[i].weight;

        // Calculate growth
        let growth: number;
        if (gp.type === "gaussian") {
          growth = growthGaussian(n, gp.mu, gp.sigma);
        } else {
          growth = growthPolynomial(n, gp.mu, gp.sigma);
        }

        // Accumulate based on combination mode
        switch (config.combinationMode) {
          case "sum":
            totalGrowth += kWeight * growth;
            break;
          case "average":
            totalGrowth += growth;
            totalWeight += 1;
            break;
          case "weighted":
            totalGrowth += kWeight * growth;
            totalWeight += kWeight;
            break;
        }
      }

      // Finalize growth
      let finalGrowth: number;
      if (config.combinationMode === "sum") {
        finalGrowth = totalGrowth;
      } else if (totalWeight > 0) {
        finalGrowth = totalGrowth / totalWeight;
      } else {
        finalGrowth = 0;
      }

      // Apply growth
      newState[idx] = Math.max(
        0,
        Math.min(1, current + config.dt * finalGrowth),
      );
    }
  }

  ctx.state = newState;
}

/**
 * Run multi-kernel simulation and return metrics
 */
function runMultiKernelSimulation(
  config: MultiKernelConfig,
  width: number,
  height: number,
  steps: number,
): {
  ctx: CPUMultiKernelContext;
  massHistory: number[];
  finalMass: number;
  initialMass: number;
  survival: number;
  stability: number;
  symmetry: number;
  entropy: number;
} {
  const ctx = createCPUMultiKernel(config, width, height);
  const blobRadius = Math.min(width, height) / 6;
  initializeBlobMultiKernel(ctx, blobRadius, 0.8);

  const initialMass = calculateMass(ctx.state);
  const massHistory: number[] = [initialMass];

  for (let i = 0; i < steps; i++) {
    stepMultiKernel(ctx);
    massHistory.push(calculateMass(ctx.state));
  }

  const finalMass = calculateMass(ctx.state);
  const survival = calculateSurvivalFitness(
    massHistory,
    initialMass,
    steps / 2,
  );
  const stability = calculateStabilityFitness(massHistory);
  const symmetry = calculateSymmetry(ctx.state, width, height);
  const entropy = calculateEntropy(ctx.state);

  return {
    ctx,
    massHistory,
    finalMass,
    initialMass,
    survival,
    stability,
    symmetry,
    entropy,
  };
}

// ============================================================================
// CLI Commands
// ============================================================================

export function registerMultiKernelCommands(program: Command): void {
  const multikernel = program
    .command("multikernel")
    .description("Multi-Kernel Lenia simulation and evolution");

  // Run simulation with preset
  multikernel
    .command("run")
    .description("Run multi-kernel simulation")
    .option(
      "-p, --preset <name>",
      "Preset name (orbium-dual, geminium-triple, etc)",
    )
    .option("-c, --config <file>", "Config JSON file")
    .option("--inline <json>", "Inline JSON config")
    .option("--size <n>", "Grid size", "64")
    .option("--steps <n>", "Simulation steps", "100")
    .option("--seed <n>", "Random seed for reproducibility")
    .option("-f, --format <format>", "Output format (json|table)", "json")
    .option("-o, --output <file>", "Output file for results")
    .action(async (options) => {
      const size = parseInt(options.size);
      const steps = parseInt(options.steps);
      const format = options.format as OutputFormat;

      // Initialize seeded RNG
      if (options.seed) {
        setSeed(parseInt(options.seed));
      }

      printHeader("Multi-Kernel Lenia Simulation");
      console.log(`Seed: ${getSeed()}`);

      // Determine config source
      let config: MultiKernelConfig;

      if (options.preset) {
        config = MULTIKERNEL_PRESETS[options.preset];
        if (!config) {
          console.error(`Unknown preset: ${options.preset}`);
          console.log(
            "Available presets:",
            Object.keys(MULTIKERNEL_PRESETS).join(", "),
          );
          process.exit(1);
        }
        console.log(`Using preset: ${options.preset}`);
      } else if (options.config) {
        const jsonStr = fs.readFileSync(options.config, "utf-8");
        config = deserializeConfig(jsonStr);
        console.log(`Loaded config from ${options.config}`);
      } else if (options.inline) {
        config = deserializeConfig(options.inline);
        console.log("Using inline config");
      } else {
        // Default to single kernel
        config = MULTIKERNEL_PRESETS["single"];
        console.log("Using default single-kernel config");
      }

      // Validate config
      const errors = validateConfig(config);
      if (errors.length > 0) {
        console.error("Config validation errors:", errors);
        process.exit(1);
      }

      console.log(`Kernels: ${config.kernels.length}`);
      console.log(`Combination mode: ${config.combinationMode}`);
      console.log(`Grid: ${size}x${size}, Steps: ${steps}`);

      printSection("Running Simulation");
      const start = performance.now();
      const result = runMultiKernelSimulation(config, size, size, steps);
      const elapsed = performance.now() - start;

      console.log(`Completed in ${formatTiming(elapsed)}`);

      const output = {
        config: {
          kernelCount: config.kernels.length,
          combinationMode: config.combinationMode,
          dt: config.dt,
          kernels: config.kernels.map((k, i) => ({
            radius: k.radius,
            shape: k.shape,
            weight: k.weight,
            growthMu: config.growthParams[i].mu,
            growthSigma: config.growthParams[i].sigma,
          })),
        },
        finalState: {
          mass: result.finalMass,
          massRetained:
            ((result.finalMass / result.initialMass) * 100).toFixed(1) + "%",
          survived: result.finalMass > result.initialMass * 0.1,
        },
        metrics: {
          survival: result.survival,
          stability: result.stability,
          symmetry: result.symmetry,
          entropy: result.entropy,
          totalSteps: steps,
          avgFPS: (steps / (elapsed / 1000)).toFixed(1),
        },
      };

      if (options.output) {
        fs.writeFileSync(options.output, JSON.stringify(output, null, 2));
        console.log(`Results saved to ${options.output}`);
      }

      report(output, { format });
    });

  // List available presets
  multikernel
    .command("presets")
    .description("List available multi-kernel presets")
    .option("-f, --format <format>", "Output format (json|table)", "table")
    .action(async (options) => {
      const format = options.format as OutputFormat;

      printHeader("Multi-Kernel Presets");

      const presets = Object.entries(MULTIKERNEL_PRESETS).map(
        ([name, config]) => ({
          name,
          kernels: config.kernels.length,
          mode: config.combinationMode,
          dt: config.dt,
          radii: config.kernels.map((k) => k.radius).join(", "),
        }),
      );

      report(presets, { format });
    });

  // Generate random genome
  multikernel
    .command("random")
    .description("Generate random multi-kernel genome")
    .option("-k, --kernels <n>", "Number of kernels (1-4)")
    .option("--seed <n>", "Random seed for reproducibility")
    .option("-f, --format <format>", "Output format (json|table)", "json")
    .option("-o, --output <file>", "Output file")
    .action(async (options) => {
      const format = options.format as OutputFormat;
      const kernelCount = options.kernels
        ? parseInt(options.kernels)
        : undefined;

      // Initialize seeded RNG
      if (options.seed) {
        setSeed(parseInt(options.seed));
      }

      printHeader("Random Multi-Kernel Genome");
      console.log(`Seed: ${getSeed()}`);

      const genome = randomMultiKernelGenome(kernelCount);
      const encoded = encodeMultiKernelGenome(genome);

      const output = {
        genome,
        encoded,
        config: multiKernelGenomeToConfig(genome),
      };

      if (options.output) {
        fs.writeFileSync(options.output, JSON.stringify(output, null, 2));
        console.log(`Saved to ${options.output}`);
      }

      report(output, { format });
    });

  // Evaluate genome
  multikernel
    .command("evaluate")
    .description("Evaluate a multi-kernel genome")
    .option("-g, --genome <encoded>", "Encoded genome string")
    .option("-i, --input <file>", "JSON file containing genome")
    .option("--size <n>", "Grid size", "64")
    .option("--steps <n>", "Simulation steps", "100")
    .option("--seed <n>", "Random seed for reproducibility")
    .option("-f, --format <format>", "Output format (json|table)", "json")
    .option("-o, --output <file>", "Output file")
    .action(async (options) => {
      const size = parseInt(options.size);
      const steps = parseInt(options.steps);
      const format = options.format as OutputFormat;

      // Initialize seeded RNG
      if (options.seed) {
        setSeed(parseInt(options.seed));
      }

      printHeader("Multi-Kernel Genome Evaluation");

      let genome: MultiKernelGenome;

      if (options.genome) {
        genome = decodeMultiKernelGenome(options.genome);
        console.log("Decoded genome from string");
      } else if (options.input) {
        const data = JSON.parse(fs.readFileSync(options.input, "utf-8"));
        if (data.encoded) {
          genome = decodeMultiKernelGenome(data.encoded);
        } else if (data.genome) {
          genome = data.genome;
        } else {
          genome = data as MultiKernelGenome;
        }
        console.log(`Loaded genome from ${options.input}`);
      } else {
        console.log(`Seed: ${getSeed()}`);
        genome = randomMultiKernelGenome();
        console.log("Generated random genome");
      }

      const config = multiKernelGenomeToConfig(genome);
      console.log(
        `Kernels: ${config.kernels.length}, Mode: ${config.combinationMode}`,
      );
      console.log(`Grid: ${size}x${size}, Steps: ${steps}`);

      printSection("Running Evaluation");
      const start = performance.now();
      const result = runMultiKernelSimulation(config, size, size, steps);
      const elapsed = performance.now() - start;

      console.log(`Completed in ${formatTiming(elapsed)}`);

      const output = {
        genome: {
          kernelCount: genome.kernelCount,
          combinationMode: genome.combinationMode,
          T: genome.T,
          encoded: encodeMultiKernelGenome(genome),
        },
        fitness: {
          survival: result.survival,
          stability: result.stability,
          symmetry: result.symmetry,
          entropy: result.entropy,
        },
        simulation: {
          initialMass: result.initialMass,
          finalMass: result.finalMass,
          massRetained:
            ((result.finalMass / result.initialMass) * 100).toFixed(1) + "%",
          survived: result.finalMass > result.initialMass * 0.1,
        },
      };

      if (options.output) {
        fs.writeFileSync(options.output, JSON.stringify(output, null, 2));
        console.log(`Results saved to ${options.output}`);
      }

      report(output, { format });
    });

  // Evolve multi-kernel organisms
  multikernel
    .command("evolve")
    .description("Evolve multi-kernel organisms with genetic algorithm")
    .option("-g, --generations <n>", "Number of generations", "10")
    .option("-p, --population <n>", "Population size", "20")
    .option("-k, --kernels <n>", "Number of kernels (1-4)")
    .option("--size <n>", "Grid size", "64")
    .option("--steps <n>", "Simulation steps per evaluation", "50")
    .option("-m, --mutation-rate <r>", "Mutation rate", "0.15")
    .option("--seed <n>", "Random seed for reproducibility")
    .option("-f, --format <format>", "Output format (json|table)", "table")
    .option("-o, --output <file>", "Output file for best genomes")
    .action(async (options) => {
      const generations = parseInt(options.generations);
      const popSize = parseInt(options.population);
      const size = parseInt(options.size);
      const steps = parseInt(options.steps);
      const mutationRate = parseFloat(options.mutationRate);
      const kernelCount = options.kernels
        ? parseInt(options.kernels)
        : undefined;
      const format = options.format as OutputFormat;

      // Initialize seeded RNG
      if (options.seed) {
        setSeed(parseInt(options.seed));
      }

      // Create experiment tracker
      const tracker = createExperimentTracker("multikernel", "evolve", {
        generations,
        population: popSize,
        kernels: kernelCount,
        size,
        steps,
        mutationRate,
        seed: getSeed(),
        output: options.output,
        format,
      });

      printHeader("Multi-Kernel Evolution");
      console.log(`Experiment ID: ${tracker.getId()}`);
      console.log(`Seed: ${getSeed()}`);
      console.log(`Generations: ${generations}, Population: ${popSize}`);
      console.log(`Grid: ${size}x${size}, Steps: ${steps}`);
      console.log(`Mutation rate: ${mutationRate}`);
      if (kernelCount) console.log(`Fixed kernel count: ${kernelCount}`);

      // Initialize population
      let population = Array.from({ length: popSize }, () =>
        randomMultiKernelGenome(kernelCount),
      );

      const eliteCount = Math.max(2, Math.floor(popSize * 0.1));
      const bestGenomes: { genome: MultiKernelGenome; fitness: number }[] = [];

      for (let gen = 0; gen < generations; gen++) {
        process.stdout.write(`\rGeneration ${gen + 1}/${generations}...`);

        // Evaluate population
        const evaluated = population.map((genome) => {
          const config = multiKernelGenomeToConfig(genome);
          const result = runMultiKernelSimulation(config, size, size, steps);

          // Simple fitness combining survival, stability, and complexity
          const fitness =
            result.survival * 0.4 +
            result.stability * 0.3 +
            result.symmetry * 0.15 +
            (result.entropy > 0.1 ? 0.15 : result.entropy * 1.5);

          return { genome, fitness };
        });

        // Sort by fitness
        evaluated.sort((a, b) => b.fitness - a.fitness);

        // Track best
        if (evaluated[0].fitness > (bestGenomes[0]?.fitness ?? 0)) {
          bestGenomes.unshift(evaluated[0]);
          bestGenomes.splice(10); // Keep top 10 ever
        }

        // Create next generation
        const nextGen: MultiKernelGenome[] = [];

        // Elite selection
        for (let i = 0; i < eliteCount; i++) {
          nextGen.push(evaluated[i].genome);
        }

        // Tournament selection and reproduction
        while (nextGen.length < popSize) {
          // Tournament select two parents
          const tournament = (k: number) => {
            let best = evaluated[Math.floor(random() * evaluated.length)];
            for (let i = 1; i < k; i++) {
              const challenger =
                evaluated[Math.floor(random() * evaluated.length)];
              if (challenger.fitness > best.fitness) {
                best = challenger;
              }
            }
            return best.genome;
          };

          const parent1 = tournament(3);
          const parent2 = tournament(3);

          // Crossover or mutation
          let child: MultiKernelGenome;
          if (randomBool(0.7)) {
            child = crossoverMultiKernelGenomes(parent1, parent2);
          } else {
            child = mutateMultiKernelGenome(parent1, mutationRate);
          }

          // Always mutate
          child = mutateMultiKernelGenome(child, mutationRate);
          nextGen.push(child);
        }

        population = nextGen;
      }

      console.log("\n");
      printSection("Best Genomes Found");

      const results = bestGenomes.slice(0, 5).map((bg, i) => ({
        rank: i + 1,
        fitness: bg.fitness.toFixed(4),
        kernels: bg.genome.kernelCount,
        mode: ["sum", "avg", "weighted"][bg.genome.combinationMode],
        encoded: encodeMultiKernelGenome(bg.genome),
      }));

      if (options.output) {
        fs.writeFileSync(
          options.output,
          JSON.stringify(
            bestGenomes.map((bg) => ({
              fitness: bg.fitness,
              genome: bg.genome,
              encoded: encodeMultiKernelGenome(bg.genome),
              config: multiKernelGenomeToConfig(bg.genome),
            })),
            null,
            2,
          ),
        );
        console.log(`Best genomes saved to ${options.output}`);
      }

      report(results, { format });

      // Summary
      printSection("Evolution Summary");
      console.log(
        `Best fitness achieved: ${bestGenomes[0]?.fitness.toFixed(4)}`,
      );
      console.log(
        `Best genome: ${bestGenomes[0]?.genome.kernelCount} kernels, ${["sum", "avg", "weighted"][bestGenomes[0]?.genome.combinationMode]} mode`,
      );

      // Complete and save experiment manifest
      tracker.complete(options.output);
      const manifestPath = tracker.save();
      console.log(`\nExperiment manifest saved to ${manifestPath}`);
    });

  // Export config
  multikernel
    .command("export")
    .description("Export preset or genome as JSON config")
    .option("-p, --preset <name>", "Preset name")
    .option("-g, --genome <encoded>", "Encoded genome string")
    .option("-o, --output <file>", "Output file")
    .action(async (options) => {
      let config: MultiKernelConfig;

      if (options.preset) {
        config = MULTIKERNEL_PRESETS[options.preset];
        if (!config) {
          console.error(`Unknown preset: ${options.preset}`);
          process.exit(1);
        }
      } else if (options.genome) {
        const genome = decodeMultiKernelGenome(options.genome);
        config = multiKernelGenomeToConfig(genome);
      } else {
        console.error("Provide either --preset or --genome");
        process.exit(1);
      }

      const json = serializeConfig(config);

      if (options.output) {
        fs.writeFileSync(options.output, json);
        console.log(`Config exported to ${options.output}`);
      } else {
        console.log(json);
      }
    });
}
