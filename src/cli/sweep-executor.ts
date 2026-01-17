/**
 * Parameter Sweep Executor
 * Handles parallel execution of parameter sweep configurations
 */

import { spawn } from "child_process";

/**
 * Parameter definition for sweep
 */
export type SweepParameter =
  | { type: "values"; values: (string | number | boolean)[] }
  | { type: "range"; min: number; max: number; steps: number };

/**
 * Sweep configuration
 */
export interface SweepConfig {
  /** Base command to run (e.g., "evolve run") */
  command: string;

  /** Parameters to sweep over */
  parameters: Record<string, SweepParameter>;

  /** Number of repeats for each configuration */
  repeats: number;

  /** Metrics to collect from output */
  metrics: string[];

  /** Base output directory */
  outputDir?: string;

  /** Fixed arguments to pass to every run */
  fixedArgs?: Record<string, string | number | boolean>;
}

/**
 * Result of a single sweep run
 */
export interface SweepRunResult {
  /** Configuration used for this run */
  config: Record<string, string | number | boolean>;

  /** Repeat index (0-based) */
  repeat: number;

  /** Seed used for this run */
  seed: number;

  /** Metrics collected */
  metrics: Record<string, number>;

  /** Whether the run succeeded */
  success: boolean;

  /** Error message if failed */
  error?: string;

  /** Output file path */
  outputFile?: string;

  /** Duration in milliseconds */
  duration: number;
}

/**
 * Aggregated results for a parameter configuration
 */
export interface AggregatedResult {
  /** Configuration */
  config: Record<string, string | number | boolean>;

  /** Number of successful runs */
  successCount: number;

  /** Metric statistics */
  metrics: Record<
    string,
    {
      mean: number;
      std: number;
      min: number;
      max: number;
      values: number[];
    }
  >;
}

/**
 * Overall sweep results
 */
export interface SweepResults {
  /** Sweep configuration used */
  config: SweepConfig;

  /** Individual run results */
  runs: SweepRunResult[];

  /** Aggregated results by configuration */
  aggregated: AggregatedResult[];

  /** Total duration in milliseconds */
  totalDuration: number;

  /** Start timestamp */
  startTime: string;

  /** End timestamp */
  endTime: string;
}

/**
 * Progress callback for sweep execution
 */
export type SweepProgressCallback = (
  completed: number,
  total: number,
  current: SweepRunResult | null,
) => void;

/**
 * Generate all parameter combinations from sweep config
 */
export function generateParameterCombinations(
  parameters: Record<string, SweepParameter>,
): Record<string, string | number | boolean>[] {
  const paramNames = Object.keys(parameters);
  if (paramNames.length === 0) return [{}];

  // Generate values for each parameter
  const paramValues: Record<string, (string | number | boolean)[]> = {};
  for (const [name, param] of Object.entries(parameters)) {
    if (param.type === "values") {
      paramValues[name] = param.values;
    } else {
      // Range parameter
      const values: number[] = [];
      const step = (param.max - param.min) / Math.max(1, param.steps - 1);
      for (let i = 0; i < param.steps; i++) {
        values.push(param.min + step * i);
      }
      paramValues[name] = values;
    }
  }

  // Generate cartesian product
  function cartesian(
    names: string[],
  ): Record<string, string | number | boolean>[] {
    if (names.length === 0) return [{}];

    const [first, ...rest] = names;
    const restCombinations = cartesian(rest);

    const combinations: Record<string, string | number | boolean>[] = [];
    for (const value of paramValues[first]) {
      for (const restCombo of restCombinations) {
        combinations.push({ [first]: value, ...restCombo });
      }
    }
    return combinations;
  }

  return cartesian(paramNames);
}

/**
 * Build CLI arguments from configuration
 */
export function buildCliArgs(
  command: string,
  config: Record<string, string | number | boolean>,
  fixedArgs: Record<string, string | number | boolean> = {},
  outputFile?: string,
  seed?: number,
): string[] {
  const args = command.split(" ");

  // Add fixed args
  for (const [key, value] of Object.entries(fixedArgs)) {
    args.push(`--${key}`, String(value));
  }

  // Add sweep config args
  for (const [key, value] of Object.entries(config)) {
    args.push(`--${key}`, String(value));
  }

  // Add output file
  if (outputFile) {
    args.push("-o", outputFile);
  }

  // Add seed
  if (seed !== undefined) {
    args.push("--seed", String(seed));
  }

  return args;
}

/**
 * Parse metrics from command output
 */
export function parseMetrics(
  output: string,
  metricNames: string[],
): Record<string, number> {
  const metrics: Record<string, number> = {};

  // Try to parse JSON output first
  try {
    const jsonMatch = output.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const json = JSON.parse(jsonMatch[0]);
      for (const name of metricNames) {
        if (typeof json[name] === "number") {
          metrics[name] = json[name];
        } else if (json.results && typeof json.results[name] === "number") {
          metrics[name] = json.results[name];
        } else if (json.stats && typeof json.stats[name] === "number") {
          metrics[name] = json.stats[name];
        }
      }
    }
  } catch {
    // Not JSON, try regex patterns
  }

  // Fall back to regex patterns
  for (const name of metricNames) {
    if (metrics[name] === undefined) {
      // Look for patterns like "name: value" or "name = value"
      const patterns = [
        new RegExp(`${name}[:\\s]+=?\\s*([\\d.eE+-]+)`, "i"),
        new RegExp(`"${name}"[:\\s]+([\\d.eE+-]+)`, "i"),
        new RegExp(`${name.replace(/_/g, "\\s*")}[:\\s]+=?\\s*([\\d.eE+-]+)`, "i"),
      ];

      for (const pattern of patterns) {
        const match = output.match(pattern);
        if (match) {
          metrics[name] = parseFloat(match[1]);
          break;
        }
      }
    }
  }

  return metrics;
}

/**
 * Compute statistics for an array of numbers
 */
export function computeStats(values: number[]): {
  mean: number;
  std: number;
  min: number;
  max: number;
} {
  if (values.length === 0) {
    return { mean: NaN, std: NaN, min: NaN, max: NaN };
  }

  const sum = values.reduce((a, b) => a + b, 0);
  const mean = sum / values.length;

  const squaredDiffs = values.map((v) => (v - mean) ** 2);
  const variance = squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
  const std = Math.sqrt(variance);

  return {
    mean,
    std,
    min: Math.min(...values),
    max: Math.max(...values),
  };
}

/**
 * Aggregate results by configuration
 */
export function aggregateResults(
  runs: SweepRunResult[],
  metricNames: string[],
): AggregatedResult[] {
  // Group by config
  const groups = new Map<string, SweepRunResult[]>();

  for (const run of runs) {
    const key = JSON.stringify(run.config);
    const group = groups.get(key) ?? [];
    group.push(run);
    groups.set(key, group);
  }

  // Aggregate each group
  const aggregated: AggregatedResult[] = [];

  for (const [key, groupRuns] of groups) {
    const config = JSON.parse(key);
    const successfulRuns = groupRuns.filter((r) => r.success);

    const metricStats: AggregatedResult["metrics"] = {};

    for (const metricName of metricNames) {
      const values = successfulRuns
        .map((r) => r.metrics[metricName])
        .filter((v) => v !== undefined && !isNaN(v));

      const stats = computeStats(values);
      metricStats[metricName] = { ...stats, values };
    }

    aggregated.push({
      config,
      successCount: successfulRuns.length,
      metrics: metricStats,
    });
  }

  return aggregated;
}

/**
 * Execute a single sweep run
 */
export async function executeSingleRun(
  args: string[],
  cwd: string,
  timeout: number = 300000,
): Promise<{ success: boolean; output: string; error?: string }> {
  return new Promise((resolve) => {
    const process = spawn("bun", ["run", "cli", ...args], {
      cwd,
      timeout,
    });

    let stdout = "";
    let stderr = "";

    process.stdout?.on("data", (data: Buffer) => {
      stdout += data.toString();
    });

    process.stderr?.on("data", (data: Buffer) => {
      stderr += data.toString();
    });

    process.on("error", (error) => {
      resolve({
        success: false,
        output: stdout + stderr,
        error: error.message,
      });
    });

    process.on("close", (code) => {
      resolve({
        success: code === 0,
        output: stdout + stderr,
        error: code !== 0 ? `Process exited with code ${code}` : undefined,
      });
    });
  });
}

/**
 * Execute a parameter sweep
 */
export async function executeSweep(
  config: SweepConfig,
  cwd: string,
  options: {
    parallel?: number;
    timeout?: number;
    onProgress?: SweepProgressCallback;
    baseSeed?: number;
  } = {},
): Promise<SweepResults> {
  const {
    parallel = 1,
    timeout = 300000,
    onProgress,
    baseSeed = Date.now(),
  } = options;

  const startTime = new Date().toISOString();
  const startMs = Date.now();

  // Generate all parameter combinations
  const combinations = generateParameterCombinations(config.parameters);

  // Generate all runs (combinations × repeats)
  interface RunTask {
    config: Record<string, string | number | boolean>;
    repeat: number;
    seed: number;
    outputFile: string;
  }

  const tasks: RunTask[] = [];
  let taskIndex = 0;

  for (const combo of combinations) {
    for (let repeat = 0; repeat < config.repeats; repeat++) {
      const seed = baseSeed + taskIndex;
      const configHash = Object.values(combo)
        .map((v) => String(v).slice(0, 4))
        .join("_");
      const outputFile = config.outputDir
        ? `${config.outputDir}/run_${configHash}_r${repeat}_s${seed}.json`
        : `sweep_run_${taskIndex}.json`;

      tasks.push({ config: combo, repeat, seed, outputFile });
      taskIndex++;
    }
  }

  const totalTasks = tasks.length;
  const runs: SweepRunResult[] = [];
  let completed = 0;

  // Execute tasks with parallel limit
  const executeTask = async (task: RunTask): Promise<SweepRunResult> => {
    const args = buildCliArgs(
      config.command,
      task.config,
      config.fixedArgs ?? {},
      task.outputFile,
      task.seed,
    );

    const startTaskMs = Date.now();
    const result = await executeSingleRun(args, cwd, timeout);
    const duration = Date.now() - startTaskMs;

    const metrics = parseMetrics(result.output, config.metrics);

    const runResult: SweepRunResult = {
      config: task.config,
      repeat: task.repeat,
      seed: task.seed,
      metrics,
      success: result.success,
      error: result.error,
      outputFile: task.outputFile,
      duration,
    };

    completed++;
    onProgress?.(completed, totalTasks, runResult);

    return runResult;
  };

  // Batch execution with parallelism
  for (let i = 0; i < tasks.length; i += parallel) {
    const batch = tasks.slice(i, i + parallel);
    const batchResults = await Promise.all(batch.map(executeTask));
    runs.push(...batchResults);
  }

  const endTime = new Date().toISOString();
  const totalDuration = Date.now() - startMs;

  // Aggregate results
  const aggregated = aggregateResults(runs, config.metrics);

  return {
    config,
    runs,
    aggregated,
    totalDuration,
    startTime,
    endTime,
  };
}

/**
 * Format sweep results as a summary table
 */
export function formatSweepSummary(results: SweepResults): string {
  const lines: string[] = [];

  lines.push("=== Sweep Summary ===");
  lines.push(`Command: ${results.config.command}`);
  lines.push(`Total runs: ${results.runs.length}`);
  lines.push(
    `Successful: ${results.runs.filter((r) => r.success).length}/${results.runs.length}`,
  );
  lines.push(`Duration: ${(results.totalDuration / 1000).toFixed(1)}s`);
  lines.push("");

  lines.push("=== Aggregated Results ===");

  for (const agg of results.aggregated) {
    lines.push("");
    lines.push(`Config: ${JSON.stringify(agg.config)}`);
    lines.push(`  Successful runs: ${agg.successCount}/${results.config.repeats}`);

    for (const [metric, stats] of Object.entries(agg.metrics)) {
      lines.push(
        `  ${metric}: mean=${stats.mean.toFixed(4)}, std=${stats.std.toFixed(4)}, min=${stats.min.toFixed(4)}, max=${stats.max.toFixed(4)}`,
      );
    }
  }

  return lines.join("\n");
}

/**
 * Validate sweep configuration
 */
export function validateSweepConfig(config: unknown): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!config || typeof config !== "object") {
    return { valid: false, errors: ["Config must be an object"] };
  }

  const cfg = config as Record<string, unknown>;

  if (typeof cfg.command !== "string" || cfg.command.trim() === "") {
    errors.push("command must be a non-empty string");
  }

  if (!cfg.parameters || typeof cfg.parameters !== "object") {
    errors.push("parameters must be an object");
  } else {
    for (const [name, param] of Object.entries(
      cfg.parameters as Record<string, unknown>,
    )) {
      if (!param || typeof param !== "object") {
        errors.push(`Parameter ${name} must be an object`);
        continue;
      }

      const p = param as Record<string, unknown>;

      if ("values" in p) {
        if (!Array.isArray(p.values) || p.values.length === 0) {
          errors.push(`Parameter ${name}.values must be a non-empty array`);
        }
      } else if ("min" in p && "max" in p && "steps" in p) {
        if (typeof p.min !== "number") {
          errors.push(`Parameter ${name}.min must be a number`);
        }
        if (typeof p.max !== "number") {
          errors.push(`Parameter ${name}.max must be a number`);
        }
        if (typeof p.steps !== "number" || p.steps < 1) {
          errors.push(`Parameter ${name}.steps must be a positive integer`);
        }
        if (
          typeof p.min === "number" &&
          typeof p.max === "number" &&
          p.min > p.max
        ) {
          errors.push(`Parameter ${name}.min must be <= max`);
        }
      } else {
        errors.push(
          `Parameter ${name} must have either 'values' or 'min/max/steps'`,
        );
      }
    }
  }

  if (typeof cfg.repeats !== "number" || cfg.repeats < 1) {
    errors.push("repeats must be a positive integer");
  }

  if (!Array.isArray(cfg.metrics) || cfg.metrics.length === 0) {
    errors.push("metrics must be a non-empty array");
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Parse sweep config from JSON, normalizing parameter format
 */
export function parseSweepConfig(json: Record<string, unknown>): SweepConfig {
  const parameters: Record<string, SweepParameter> = {};

  const rawParams = json.parameters as Record<string, unknown>;
  for (const [name, param] of Object.entries(rawParams)) {
    const p = param as Record<string, unknown>;

    if ("values" in p) {
      parameters[name] = {
        type: "values",
        values: p.values as (string | number | boolean)[],
      };
    } else {
      parameters[name] = {
        type: "range",
        min: p.min as number,
        max: p.max as number,
        steps: p.steps as number,
      };
    }
  }

  return {
    command: json.command as string,
    parameters,
    repeats: json.repeats as number,
    metrics: json.metrics as string[],
    outputDir: json.outputDir as string | undefined,
    fixedArgs: json.fixedArgs as Record<string, string | number | boolean> | undefined,
  };
}
