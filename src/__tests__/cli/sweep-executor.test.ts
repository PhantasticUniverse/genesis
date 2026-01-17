/**
 * Parameter Sweep Executor Tests
 */

import { describe, it, expect } from "vitest";
import {
  generateParameterCombinations,
  buildCliArgs,
  parseMetrics,
  computeStats,
  aggregateResults,
  validateSweepConfig,
  parseSweepConfig,
  type SweepParameter,
  type SweepRunResult,
} from "../../cli/sweep-executor";

describe("generateParameterCombinations", () => {
  it("should return single empty config for no parameters", () => {
    const combinations = generateParameterCombinations({});
    expect(combinations).toHaveLength(1);
    expect(combinations[0]).toEqual({});
  });

  it("should generate combinations from value arrays", () => {
    const parameters: Record<string, SweepParameter> = {
      a: { type: "values", values: [1, 2] },
      b: { type: "values", values: ["x", "y"] },
    };

    const combinations = generateParameterCombinations(parameters);

    expect(combinations).toHaveLength(4);
    expect(combinations).toContainEqual({ a: 1, b: "x" });
    expect(combinations).toContainEqual({ a: 1, b: "y" });
    expect(combinations).toContainEqual({ a: 2, b: "x" });
    expect(combinations).toContainEqual({ a: 2, b: "y" });
  });

  it("should generate combinations from range parameters", () => {
    const parameters: Record<string, SweepParameter> = {
      rate: { type: "range", min: 0.1, max: 0.3, steps: 3 },
    };

    const combinations = generateParameterCombinations(parameters);

    expect(combinations).toHaveLength(3);
    expect(combinations[0].rate).toBeCloseTo(0.1);
    expect(combinations[1].rate).toBeCloseTo(0.2);
    expect(combinations[2].rate).toBeCloseTo(0.3);
  });

  it("should generate cartesian product of mixed parameters", () => {
    const parameters: Record<string, SweepParameter> = {
      a: { type: "values", values: [1, 2] },
      b: { type: "range", min: 0, max: 1, steps: 2 },
    };

    const combinations = generateParameterCombinations(parameters);

    expect(combinations).toHaveLength(4);
  });

  it("should handle single-value parameters", () => {
    const parameters: Record<string, SweepParameter> = {
      a: { type: "values", values: [42] },
      b: { type: "values", values: ["test"] },
    };

    const combinations = generateParameterCombinations(parameters);

    expect(combinations).toHaveLength(1);
    expect(combinations[0]).toEqual({ a: 42, b: "test" });
  });
});

describe("buildCliArgs", () => {
  it("should split command into args", () => {
    const args = buildCliArgs("evolve run", {});
    expect(args).toEqual(["evolve", "run"]);
  });

  it("should add config parameters", () => {
    const args = buildCliArgs("evolve run", {
      population: 50,
      mutation_rate: 0.1,
    });

    expect(args).toContain("--population");
    expect(args).toContain("50");
    expect(args).toContain("--mutation_rate");
    expect(args).toContain("0.1");
  });

  it("should add fixed args", () => {
    const args = buildCliArgs(
      "evolve run",
      {},
      { generations: 100, size: 128 },
    );

    expect(args).toContain("--generations");
    expect(args).toContain("100");
    expect(args).toContain("--size");
    expect(args).toContain("128");
  });

  it("should add output file", () => {
    const args = buildCliArgs("evolve run", {}, {}, "results.json");
    expect(args).toContain("-o");
    expect(args).toContain("results.json");
  });

  it("should add seed", () => {
    const args = buildCliArgs("evolve run", {}, {}, undefined, 12345);
    expect(args).toContain("--seed");
    expect(args).toContain("12345");
  });
});

describe("parseMetrics", () => {
  it("should parse metrics from JSON output", () => {
    const output = `
      Running evolution...
      {"best_fitness": 0.85, "coverage": 0.32, "diversity": 0.67}
      Done!
    `;

    const metrics = parseMetrics(output, [
      "best_fitness",
      "coverage",
      "diversity",
    ]);

    expect(metrics.best_fitness).toBeCloseTo(0.85);
    expect(metrics.coverage).toBeCloseTo(0.32);
    expect(metrics.diversity).toBeCloseTo(0.67);
  });

  it("should parse metrics from nested JSON", () => {
    const output = `{"results": {"fitness": 0.75, "coverage": 0.5}}`;

    const metrics = parseMetrics(output, ["fitness", "coverage"]);

    expect(metrics.fitness).toBeCloseTo(0.75);
    expect(metrics.coverage).toBeCloseTo(0.5);
  });

  it("should parse metrics from plain text format", () => {
    const output = `
      best_fitness: 0.85
      coverage = 0.32
      diversity: 0.67
    `;

    const metrics = parseMetrics(output, [
      "best_fitness",
      "coverage",
      "diversity",
    ]);

    expect(metrics.best_fitness).toBeCloseTo(0.85);
    expect(metrics.coverage).toBeCloseTo(0.32);
    expect(metrics.diversity).toBeCloseTo(0.67);
  });

  it("should handle scientific notation", () => {
    const output = `loss: 1.5e-4, accuracy: 9.8e1`;

    const metrics = parseMetrics(output, ["loss", "accuracy"]);

    expect(metrics.loss).toBeCloseTo(0.00015);
    expect(metrics.accuracy).toBeCloseTo(98);
  });

  it("should return empty object for unmatched metrics", () => {
    const output = "No metrics here";

    const metrics = parseMetrics(output, ["foo", "bar"]);

    expect(Object.keys(metrics)).toHaveLength(0);
  });
});

describe("computeStats", () => {
  it("should compute statistics for array of numbers", () => {
    const values = [1, 2, 3, 4, 5];
    const stats = computeStats(values);

    expect(stats.mean).toBe(3);
    expect(stats.min).toBe(1);
    expect(stats.max).toBe(5);
    expect(stats.std).toBeCloseTo(Math.sqrt(2)); // sqrt(var([1,2,3,4,5]))
  });

  it("should handle single value", () => {
    const values = [42];
    const stats = computeStats(values);

    expect(stats.mean).toBe(42);
    expect(stats.min).toBe(42);
    expect(stats.max).toBe(42);
    expect(stats.std).toBe(0);
  });

  it("should handle empty array", () => {
    const values: number[] = [];
    const stats = computeStats(values);

    expect(stats.mean).toBeNaN();
    expect(stats.min).toBeNaN();
    expect(stats.max).toBeNaN();
    expect(stats.std).toBeNaN();
  });

  it("should compute correct variance for known values", () => {
    // Population variance of [2, 4, 4, 4, 5, 5, 7, 9] is 4
    // Population std is 2
    const values = [2, 4, 4, 4, 5, 5, 7, 9];
    const stats = computeStats(values);

    expect(stats.mean).toBe(5);
    expect(stats.std).toBe(2);
  });
});

describe("aggregateResults", () => {
  it("should group results by config", () => {
    const runs: SweepRunResult[] = [
      {
        config: { a: 1 },
        repeat: 0,
        seed: 1,
        metrics: { fitness: 0.8 },
        success: true,
        duration: 100,
      },
      {
        config: { a: 1 },
        repeat: 1,
        seed: 2,
        metrics: { fitness: 0.9 },
        success: true,
        duration: 100,
      },
      {
        config: { a: 2 },
        repeat: 0,
        seed: 3,
        metrics: { fitness: 0.7 },
        success: true,
        duration: 100,
      },
    ];

    const aggregated = aggregateResults(runs, ["fitness"]);

    expect(aggregated).toHaveLength(2);

    const config1 = aggregated.find((a) => a.config.a === 1);
    const config2 = aggregated.find((a) => a.config.a === 2);

    expect(config1?.successCount).toBe(2);
    expect(config1?.metrics.fitness.mean).toBeCloseTo(0.85);

    expect(config2?.successCount).toBe(1);
    expect(config2?.metrics.fitness.mean).toBe(0.7);
  });

  it("should only count successful runs", () => {
    const runs: SweepRunResult[] = [
      {
        config: { a: 1 },
        repeat: 0,
        seed: 1,
        metrics: { fitness: 0.8 },
        success: true,
        duration: 100,
      },
      {
        config: { a: 1 },
        repeat: 1,
        seed: 2,
        metrics: {},
        success: false,
        error: "Failed",
        duration: 100,
      },
    ];

    const aggregated = aggregateResults(runs, ["fitness"]);

    expect(aggregated[0].successCount).toBe(1);
    expect(aggregated[0].metrics.fitness.values).toHaveLength(1);
  });
});

describe("validateSweepConfig", () => {
  it("should accept valid config", () => {
    const config = {
      command: "evolve run",
      parameters: {
        population: { values: [20, 50, 100] },
      },
      repeats: 3,
      metrics: ["fitness"],
    };

    const result = validateSweepConfig(config);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("should reject non-object config", () => {
    const result = validateSweepConfig(null);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Config must be an object");
  });

  it("should reject empty command", () => {
    const config = {
      command: "",
      parameters: {},
      repeats: 1,
      metrics: ["fitness"],
    };

    const result = validateSweepConfig(config);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("command"))).toBe(true);
  });

  it("should reject invalid parameter format", () => {
    const config = {
      command: "test",
      parameters: {
        bad: { invalid: true },
      },
      repeats: 1,
      metrics: ["fitness"],
    };

    const result = validateSweepConfig(config);
    expect(result.valid).toBe(false);
    expect(
      result.errors.some((e) => e.includes("bad") && e.includes("values")),
    ).toBe(true);
  });

  it("should reject range with min > max", () => {
    const config = {
      command: "test",
      parameters: {
        rate: { min: 1, max: 0, steps: 3 },
      },
      repeats: 1,
      metrics: ["fitness"],
    };

    const result = validateSweepConfig(config);
    expect(result.valid).toBe(false);
    expect(
      result.errors.some((e) => e.includes("min") && e.includes("max")),
    ).toBe(true);
  });

  it("should reject non-positive repeats", () => {
    const config = {
      command: "test",
      parameters: {},
      repeats: 0,
      metrics: ["fitness"],
    };

    const result = validateSweepConfig(config);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("repeats"))).toBe(true);
  });

  it("should reject empty metrics array", () => {
    const config = {
      command: "test",
      parameters: {},
      repeats: 1,
      metrics: [],
    };

    const result = validateSweepConfig(config);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("metrics"))).toBe(true);
  });
});

describe("parseSweepConfig", () => {
  it("should parse values parameters", () => {
    const json = {
      command: "evolve run",
      parameters: {
        population: { values: [20, 50, 100] },
      },
      repeats: 3,
      metrics: ["fitness"],
    };

    const config = parseSweepConfig(json);

    expect(config.command).toBe("evolve run");
    expect(config.parameters.population).toEqual({
      type: "values",
      values: [20, 50, 100],
    });
    expect(config.repeats).toBe(3);
    expect(config.metrics).toEqual(["fitness"]);
  });

  it("should parse range parameters", () => {
    const json = {
      command: "test",
      parameters: {
        rate: { min: 0.1, max: 0.5, steps: 5 },
      },
      repeats: 1,
      metrics: ["accuracy"],
    };

    const config = parseSweepConfig(json);

    expect(config.parameters.rate).toEqual({
      type: "range",
      min: 0.1,
      max: 0.5,
      steps: 5,
    });
  });

  it("should preserve optional fields", () => {
    const json = {
      command: "test",
      parameters: {},
      repeats: 1,
      metrics: ["fitness"],
      outputDir: "./results",
      fixedArgs: { size: 128 },
    };

    const config = parseSweepConfig(json);

    expect(config.outputDir).toBe("./results");
    expect(config.fixedArgs).toEqual({ size: 128 });
  });
});
