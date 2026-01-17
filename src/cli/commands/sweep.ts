/**
 * Parameter Sweep CLI Command
 * Automated parameter exploration with parallel execution
 */

import { Command } from "commander";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, resolve } from "path";
import {
  executeSweep,
  formatSweepSummary,
  generateParameterCombinations,
  parseSweepConfig,
  validateSweepConfig,
  type SweepConfig,
  type SweepResults,
} from "../sweep-executor";

export const sweepCommand = new Command("sweep").description(
  "Run automated parameter sweeps with parallel execution",
);

sweepCommand
  .command("run")
  .description("Execute a parameter sweep from a config file")
  .requiredOption(
    "-c, --config <file>",
    "Path to sweep configuration JSON file",
  )
  .option("-p, --parallel <n>", "Number of parallel processes", "1")
  .option("-o, --output <dir>", "Output directory for results")
  .option("--timeout <ms>", "Timeout per run in milliseconds", "300000")
  .option("--seed <n>", "Base seed for reproducibility")
  .option("--dry-run", "Show what would be run without executing")
  .action(async (options) => {
    const {
      config: configPath,
      parallel,
      output,
      timeout,
      seed,
      dryRun,
    } = options;

    // Load config file
    if (!existsSync(configPath)) {
      console.error(`Error: Config file not found: ${configPath}`);
      process.exit(1);
    }

    let configJson: Record<string, unknown>;
    try {
      const content = readFileSync(configPath, "utf-8");
      configJson = JSON.parse(content);
    } catch (error) {
      console.error(`Error: Failed to parse config file: ${error}`);
      process.exit(1);
    }

    // Validate config
    const validation = validateSweepConfig(configJson);
    if (!validation.valid) {
      console.error("Config validation failed:");
      for (const error of validation.errors) {
        console.error(`  - ${error}`);
      }
      process.exit(1);
    }

    // Parse config
    const config: SweepConfig = parseSweepConfig(configJson);

    // Override output directory if provided
    if (output) {
      config.outputDir = output;
    }

    // Create output directory if needed
    if (config.outputDir && !existsSync(config.outputDir)) {
      mkdirSync(config.outputDir, { recursive: true });
    }

    // Generate combinations for preview
    const combinations = generateParameterCombinations(config.parameters);
    const totalRuns = combinations.length * config.repeats;

    console.log("=== Parameter Sweep Configuration ===");
    console.log(`Command: ${config.command}`);
    console.log(`Parameters: ${Object.keys(config.parameters).join(", ")}`);
    console.log(`Unique combinations: ${combinations.length}`);
    console.log(`Repeats per combination: ${config.repeats}`);
    console.log(`Total runs: ${totalRuns}`);
    console.log(`Parallel processes: ${parallel}`);
    console.log(`Metrics to collect: ${config.metrics.join(", ")}`);
    console.log("");

    if (dryRun) {
      console.log("=== Dry Run - Combinations ===");
      for (let i = 0; i < Math.min(10, combinations.length); i++) {
        console.log(`  ${i + 1}. ${JSON.stringify(combinations[i])}`);
      }
      if (combinations.length > 10) {
        console.log(`  ... and ${combinations.length - 10} more`);
      }
      console.log("");
      console.log("Dry run complete. Use without --dry-run to execute.");
      return;
    }

    // Execute sweep
    console.log("=== Starting Sweep ===");
    const startTime = Date.now();

    const results = await executeSweep(config, process.cwd(), {
      parallel: parseInt(parallel, 10),
      timeout: parseInt(timeout, 10),
      baseSeed: seed ? parseInt(seed, 10) : Date.now(),
      onProgress: (completed, total, current) => {
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        const status = current?.success ? "OK" : "FAIL";
        const configStr = current
          ? Object.entries(current.config)
              .map(([k, v]) => `${k}=${v}`)
              .join(" ")
          : "";
        console.log(
          `[${completed}/${total}] (${elapsed}s) ${status} ${configStr}`,
        );
      },
    });

    // Print summary
    console.log("");
    console.log(formatSweepSummary(results));

    // Save results
    const resultsPath = config.outputDir
      ? resolve(config.outputDir, "sweep_results.json")
      : "sweep_results.json";

    writeFileSync(resultsPath, JSON.stringify(results, null, 2));
    console.log("");
    console.log(`Results saved to: ${resultsPath}`);
  });

sweepCommand
  .command("validate")
  .description("Validate a sweep configuration file")
  .requiredOption(
    "-c, --config <file>",
    "Path to sweep configuration JSON file",
  )
  .action((options) => {
    const { config: configPath } = options;

    if (!existsSync(configPath)) {
      console.error(`Error: Config file not found: ${configPath}`);
      process.exit(1);
    }

    let configJson: Record<string, unknown>;
    try {
      const content = readFileSync(configPath, "utf-8");
      configJson = JSON.parse(content);
    } catch (error) {
      console.error(`Error: Failed to parse config file: ${error}`);
      process.exit(1);
    }

    const validation = validateSweepConfig(configJson);

    if (validation.valid) {
      console.log("Configuration is valid!");

      const config = parseSweepConfig(configJson);
      const combinations = generateParameterCombinations(config.parameters);
      const totalRuns = combinations.length * config.repeats;

      console.log("");
      console.log(`Command: ${config.command}`);
      console.log(`Unique combinations: ${combinations.length}`);
      console.log(`Total runs: ${totalRuns}`);
    } else {
      console.error("Configuration is invalid:");
      for (const error of validation.errors) {
        console.error(`  - ${error}`);
      }
      process.exit(1);
    }
  });

sweepCommand
  .command("analyze")
  .description("Analyze results from a completed sweep")
  .requiredOption("-i, --input <file>", "Path to sweep results JSON file")
  .option("--metric <name>", "Focus on a specific metric")
  .option("--sort <metric>", "Sort results by metric")
  .option("--top <n>", "Show top N configurations", "10")
  .action((options) => {
    const { input, metric: focusMetric, sort: sortMetric, top } = options;

    if (!existsSync(input)) {
      console.error(`Error: Results file not found: ${input}`);
      process.exit(1);
    }

    let results: SweepResults;
    try {
      const content = readFileSync(input, "utf-8");
      results = JSON.parse(content);
    } catch (error) {
      console.error(`Error: Failed to parse results file: ${error}`);
      process.exit(1);
    }

    console.log("=== Sweep Analysis ===");
    console.log(`Command: ${results.config.command}`);
    console.log(`Total runs: ${results.runs.length}`);
    console.log(`Successful: ${results.runs.filter((r) => r.success).length}`);
    console.log(`Duration: ${(results.totalDuration / 1000).toFixed(1)}s`);
    console.log("");

    // Sort aggregated results if requested
    let aggregated = [...results.aggregated];

    if (sortMetric) {
      aggregated.sort((a, b) => {
        const aVal = a.metrics[sortMetric]?.mean ?? -Infinity;
        const bVal = b.metrics[sortMetric]?.mean ?? -Infinity;
        return bVal - aVal; // Descending
      });
    }

    // Limit to top N
    const topN = parseInt(top, 10);
    aggregated = aggregated.slice(0, topN);

    console.log(
      `=== Top ${topN} Configurations ${sortMetric ? `(by ${sortMetric})` : ""} ===`,
    );
    console.log("");

    for (let i = 0; i < aggregated.length; i++) {
      const agg = aggregated[i];
      console.log(`#${i + 1}. ${JSON.stringify(agg.config)}`);
      console.log(
        `    Success rate: ${agg.successCount}/${results.config.repeats}`,
      );

      const metricsToShow = focusMetric
        ? [focusMetric]
        : Object.keys(agg.metrics);

      for (const metricName of metricsToShow) {
        const stats = agg.metrics[metricName];
        if (stats) {
          console.log(
            `    ${metricName}: mean=${stats.mean.toFixed(4)} (std=${stats.std.toFixed(4)}, range=[${stats.min.toFixed(4)}, ${stats.max.toFixed(4)}])`,
          );
        }
      }
      console.log("");
    }

    // Find best configuration for each metric
    console.log("=== Best Configuration Per Metric ===");
    console.log("");

    for (const metricName of results.config.metrics) {
      const sorted = [...results.aggregated].sort((a, b) => {
        const aVal = a.metrics[metricName]?.mean ?? -Infinity;
        const bVal = b.metrics[metricName]?.mean ?? -Infinity;
        return bVal - aVal;
      });

      const best = sorted[0];
      if (best && best.metrics[metricName]) {
        console.log(
          `${metricName}: ${best.metrics[metricName].mean.toFixed(4)}`,
        );
        console.log(`  Config: ${JSON.stringify(best.config)}`);
      }
    }
  });

sweepCommand
  .command("generate-config")
  .description("Generate a sample sweep configuration file")
  .option("-o, --output <file>", "Output file path", "sweep_config.json")
  .action((options) => {
    const sampleConfig = {
      command: "evolve run",
      parameters: {
        population: { values: [20, 50, 100] },
        mutation_rate: { min: 0.01, max: 0.2, steps: 5 },
        novelty_weight: { values: [0.0, 0.3, 0.5, 1.0] },
      },
      repeats: 3,
      metrics: ["best_fitness", "coverage", "diversity"],
      outputDir: "./sweep_results",
      fixedArgs: {
        generations: 50,
        size: 128,
        steps: 200,
      },
    };

    // Create directory if needed
    const dir = dirname(options.output);
    if (dir && !existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    writeFileSync(options.output, JSON.stringify(sampleConfig, null, 2));
    console.log(`Sample configuration written to: ${options.output}`);
    console.log("");
    console.log("Edit this file to customize your parameter sweep, then run:");
    console.log(`  bun run cli sweep run -c ${options.output}`);
  });

export default sweepCommand;
