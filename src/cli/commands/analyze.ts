/**
 * Analyze Commands
 * Symmetry, chaos (Lyapunov), and periodicity analysis
 */

import { Command } from "commander";
import {
  analyzeSymmetry,
  quickSymmetryScore,
  detectSymmetryType,
  calculateKFoldSymmetry,
  createPolarRepresentation,
  calculateCenterOfMass,
  DEFAULT_SYMMETRY_CONFIG,
} from "../../analysis/symmetry";
import {
  calculateLyapunovExponent,
  wolfLyapunovEstimate,
  quickStabilityCheck,
  classifyDynamics,
  DEFAULT_LYAPUNOV_CONFIG,
} from "../../analysis/chaos";
import {
  detectPeriod,
  PeriodTracker,
  classifyPeriodBehavior,
  DEFAULT_PERIOD_CONFIG,
} from "../../analysis/periodicity";
import {
  createCPULenia,
  initializeBlob,
  initializeRandom,
  createStepFunction,
  getState,
  runSimulation,
  generateRandomState,
  generateBlobState,
} from "../utils/cpu-step";
import {
  report,
  printHeader,
  printSection,
  type OutputFormat,
} from "../utils/reporters";
import * as fs from "fs";

/**
 * Register all analyze commands
 */
export function registerAnalyzeCommands(program: Command): void {
  const analyze = program
    .command("analyze")
    .description("Analysis commands for symmetry, chaos, and periodicity");

  // Symmetry analysis
  analyze
    .command("symmetry")
    .description("Analyze k-fold symmetry of a state")
    .option("-s, --state <file>", "JSON file containing state data")
    .option("-r, --random", "Generate random state for analysis")
    .option("-b, --blob", "Generate blob state for analysis")
    .option("--size <n>", "Grid size (width=height)", "128")
    .option("--max-order <n>", "Maximum symmetry order to test", "8")
    .option("-f, --format <format>", "Output format (json|table|csv)", "json")
    .option("-q, --quick", "Quick symmetry score only")
    .action(async (options) => {
      const size = parseInt(options.size);
      const maxOrder = parseInt(options.maxOrder);
      const format = options.format as OutputFormat;

      printHeader("Symmetry Analysis");

      // Get state
      let state: Float32Array;
      if (options.state) {
        const data = JSON.parse(fs.readFileSync(options.state, "utf-8"));
        state = new Float32Array(data.state || data);
      } else if (options.blob) {
        state = generateBlobState(size, size);
        console.log(`Generated blob state: ${size}x${size}`);
      } else {
        state = generateRandomState(size, size, 0.3);
        console.log(`Generated random state: ${size}x${size}`);
      }

      if (options.quick) {
        // Quick symmetry score
        const score = quickSymmetryScore(state, size, size);
        report({ quickSymmetryScore: score }, { format });
        return;
      }

      // Full analysis
      const result = analyzeSymmetry(state, size, size, { maxOrder });
      const types = detectSymmetryType(result);

      const output = {
        order: result.order,
        strength: result.strength,
        horizontal: result.horizontal,
        vertical: result.vertical,
        rotational180: result.rotational180,
        center: result.center,
        types,
        orderStrengths: Object.fromEntries(result.orderStrengths),
      };

      report(output, { format });
    });

  // Chaos analysis (Lyapunov exponent)
  analyze
    .command("chaos")
    .description("Calculate Lyapunov exponent (chaos measure)")
    .option("-s, --state <file>", "JSON file containing initial state")
    .option("-r, --random", "Use random initial state")
    .option("-b, --blob", "Use blob initial state")
    .option("--size <n>", "Grid size", "64")
    .option("--steps <n>", "Number of evolution steps", "100")
    .option("--perturbation <n>", "Perturbation magnitude", "0.001")
    .option("--wolf", "Use Wolf algorithm (more robust)")
    .option("-q, --quick", "Quick stability check only")
    .option("-f, --format <format>", "Output format (json|table|csv)", "json")
    .action(async (options) => {
      const size = parseInt(options.size);
      const steps = parseInt(options.steps);
      const perturbation = parseFloat(options.perturbation);
      const format = options.format as OutputFormat;

      printHeader("Chaos Analysis (Lyapunov Exponent)");

      // Get initial state
      let initialState: Float32Array;
      if (options.state) {
        const data = JSON.parse(fs.readFileSync(options.state, "utf-8"));
        initialState = new Float32Array(data.state || data);
      } else if (options.blob) {
        initialState = generateBlobState(size, size);
        console.log(`Generated blob state: ${size}x${size}`);
      } else {
        initialState = generateRandomState(size, size, 0.3);
        console.log(`Generated random state: ${size}x${size}`);
      }

      // Create step function
      const stepFunction = createStepFunction({ width: size, height: size });

      if (options.quick) {
        // Quick stability check
        const stability = quickStabilityCheck(initialState, stepFunction, 20);
        report({ stability }, { format });
        return;
      }

      // Full Lyapunov calculation
      const config = {
        steps,
        perturbationMagnitude: perturbation,
      };

      let result;
      if (options.wolf) {
        console.log("Using Wolf algorithm...");
        result = wolfLyapunovEstimate(initialState, stepFunction, config);
      } else {
        console.log("Using standard algorithm...");
        result = calculateLyapunovExponent(initialState, stepFunction, config);
      }

      const output = {
        exponent: result.exponent,
        classification: result.classification,
        confidence: result.confidence,
        steps: result.steps,
        initialPerturbation: result.initialPerturbation,
        divergenceHistoryLength: result.divergenceHistory.length,
      };

      report(output, { format });

      printSection("Interpretation");
      console.log(`Classification: ${result.classification}`);
      console.log(`λ < -0.01: stable (perturbations decay)`);
      console.log(`|λ| ≤ 0.01: periodic (marginally stable)`);
      console.log(`λ > 0.01: chaotic (perturbations grow)`);
      console.log(`λ > 1: hyperchaotic (rapid divergence)`);
    });

  // Periodicity analysis
  analyze
    .command("period")
    .description("Detect oscillation period in simulation")
    .option("-s, --state <file>", "JSON file containing initial state")
    .option("-r, --random", "Use random initial state")
    .option("-b, --blob", "Use blob initial state")
    .option("--size <n>", "Grid size", "64")
    .option("--steps <n>", "Number of evolution steps", "200")
    .option("--max-period <n>", "Maximum period to search for", "100")
    .option("--threshold <n>", "Correlation threshold", "0.8")
    .option("-f, --format <format>", "Output format (json|table|csv)", "json")
    .action(async (options) => {
      const size = parseInt(options.size);
      const steps = parseInt(options.steps);
      const maxPeriod = parseInt(options.maxPeriod);
      const threshold = parseFloat(options.threshold);
      const format = options.format as OutputFormat;

      printHeader("Periodicity Analysis");

      // Create simulation context
      const ctx = createCPULenia({ width: size, height: size });

      // Initialize state
      if (options.state) {
        const data = JSON.parse(fs.readFileSync(options.state, "utf-8"));
        const state = new Float32Array(data.state || data);
        ctx.state.set(state);
        console.log(`Loaded state from ${options.state}`);
      } else if (options.blob) {
        initializeBlob(ctx);
        console.log(`Generated blob state: ${size}x${size}`);
      } else {
        initializeRandom(ctx, 0.3);
        console.log(`Generated random state: ${size}x${size}`);
      }

      // Run simulation and collect history
      console.log(`Running ${steps} steps...`);
      const history = runSimulation(ctx, steps, 1);
      console.log(`Collected ${history.length} states`);

      // Detect period
      const result = detectPeriod(history, size, size, {
        maxPeriod,
        correlationThreshold: threshold,
      });

      const output = {
        period: result.period,
        confidence: result.confidence,
        isExactPeriod: result.isExactPeriod,
        behavior: result.behavior,
        classification: classifyPeriodBehavior(result),
        candidates: result.candidates.slice(0, 5),
      };

      report(output, { format });
    });

  // Combined analysis
  analyze
    .command("full")
    .description("Run full analysis (symmetry, chaos, period)")
    .option("-r, --random", "Use random initial state")
    .option("-b, --blob", "Use blob initial state")
    .option("--size <n>", "Grid size", "64")
    .option("--steps <n>", "Steps for chaos/period analysis", "100")
    .option("-f, --format <format>", "Output format (json|table|csv)", "json")
    .action(async (options) => {
      const size = parseInt(options.size);
      const steps = parseInt(options.steps);
      const format = options.format as OutputFormat;

      printHeader("Full Analysis");

      // Create simulation context
      const ctx = createCPULenia({ width: size, height: size });

      // Initialize state
      if (options.blob) {
        initializeBlob(ctx);
        console.log(`Generated blob state: ${size}x${size}`);
      } else {
        initializeRandom(ctx, 0.3);
        console.log(`Generated random state: ${size}x${size}`);
      }

      // Initial symmetry
      printSection("Initial Symmetry");
      const initialState = getState(ctx);
      const symmetryResult = analyzeSymmetry(initialState, size, size);
      console.log(
        `Order: ${symmetryResult.order}, Strength: ${symmetryResult.strength.toFixed(4)}`,
      );

      // Run simulation for period/chaos analysis
      console.log(`\nRunning ${steps} steps...`);
      const history = runSimulation(ctx, steps, 1);

      // Chaos analysis
      printSection("Chaos Analysis");
      const stepFunction = createStepFunction({ width: size, height: size });
      const chaosResult = quickStabilityCheck(initialState, stepFunction, 20);
      console.log(`Quick stability: ${chaosResult}`);

      // Period analysis
      printSection("Period Analysis");
      const periodResult = detectPeriod(history, size, size);
      console.log(`Behavior: ${periodResult.behavior}`);
      console.log(`Classification: ${classifyPeriodBehavior(periodResult)}`);

      // Final symmetry
      printSection("Final Symmetry");
      const finalState = history[history.length - 1];
      const finalSymmetry = analyzeSymmetry(finalState, size, size);
      console.log(
        `Order: ${finalSymmetry.order}, Strength: ${finalSymmetry.strength.toFixed(4)}`,
      );

      // Summary
      const summary = {
        gridSize: size,
        steps,
        initialSymmetry: {
          order: symmetryResult.order,
          strength: symmetryResult.strength,
          types: detectSymmetryType(symmetryResult),
        },
        finalSymmetry: {
          order: finalSymmetry.order,
          strength: finalSymmetry.strength,
          types: detectSymmetryType(finalSymmetry),
        },
        chaos: {
          quickStability: chaosResult,
        },
        period: {
          period: periodResult.period,
          behavior: periodResult.behavior,
          confidence: periodResult.confidence,
          classification: classifyPeriodBehavior(periodResult),
        },
      };

      printSection("Summary");
      report(summary, { format });
    });
}
