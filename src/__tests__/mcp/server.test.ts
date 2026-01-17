/**
 * Genesis MCP Server Tests
 */

import { describe, it, expect, beforeEach } from "vitest";
import { GenesisMCPServer, createGenesisMCPServer } from "../../mcp/server";
import { GENESIS_TOOLS } from "../../mcp/tools";

describe("GenesisMCPServer", () => {
  let server: GenesisMCPServer;

  beforeEach(() => {
    server = createGenesisMCPServer();
  });

  describe("initialization", () => {
    it("should create server with default config", () => {
      const info = server.getServerInfo();
      expect(info.name).toBe("genesis-mcp");
      expect(info.version).toBe("1.0.0");
      expect(info.description).toContain("Genesis");
    });

    it("should create server with custom config", () => {
      const customServer = createGenesisMCPServer({
        name: "custom-server",
        version: "2.0.0",
      });
      const info = customServer.getServerInfo();
      expect(info.name).toBe("custom-server");
      expect(info.version).toBe("2.0.0");
    });
  });

  describe("listTools", () => {
    it("should return all available tools", () => {
      const tools = server.listTools();
      expect(tools).toEqual(GENESIS_TOOLS);
      expect(tools.length).toBeGreaterThan(10);
    });

    it("should have required tools", () => {
      const tools = server.listTools();
      const toolNames = tools.map((t) => t.name);

      expect(toolNames).toContain("genesis_start_simulation");
      expect(toolNames).toContain("genesis_step");
      expect(toolNames).toContain("genesis_get_state");
      expect(toolNames).toContain("genesis_set_parameters");
      expect(toolNames).toContain("genesis_analyze_symmetry");
      expect(toolNames).toContain("genesis_start_evolution");
    });
  });

  describe("genesis_start_simulation", () => {
    it("should start simulation with defaults", async () => {
      const result = await server.executeTool({
        name: "genesis_start_simulation",
        arguments: {},
      });

      expect(result.isError).toBeFalsy();
      const content = JSON.parse(result.content[0].text!);
      expect(content.status).toBe("started");
      expect(content.config.width).toBe(256);
      expect(content.config.height).toBe(256);
      expect(content.config.paradigm).toBe("continuous");
    });

    it("should start simulation with custom config", async () => {
      const result = await server.executeTool({
        name: "genesis_start_simulation",
        arguments: {
          width: 128,
          height: 128,
          paradigm: "discrete",
          preset: "smoothlife",
          seed: 42,
        },
      });

      const content = JSON.parse(result.content[0].text!);
      expect(content.config.width).toBe(128);
      expect(content.config.height).toBe(128);
      expect(content.config.paradigm).toBe("discrete");
      expect(content.config.preset).toBe("smoothlife");
      expect(content.config.seed).toBe(42);
    });
  });

  describe("genesis_stop_simulation", () => {
    it("should stop the simulation", async () => {
      await server.executeTool({
        name: "genesis_start_simulation",
        arguments: {},
      });

      const result = await server.executeTool({
        name: "genesis_stop_simulation",
        arguments: {},
      });

      const content = JSON.parse(result.content[0].text!);
      expect(content.status).toBe("stopped");
    });
  });

  describe("genesis_step", () => {
    it("should advance simulation by default 1 step", async () => {
      await server.executeTool({
        name: "genesis_start_simulation",
        arguments: {},
      });

      const result = await server.executeTool({
        name: "genesis_step",
        arguments: {},
      });

      const content = JSON.parse(result.content[0].text!);
      expect(content.step).toBe(1);
      expect(content.stepsAdvanced).toBe(1);
    });

    it("should advance simulation by specified steps", async () => {
      await server.executeTool({
        name: "genesis_start_simulation",
        arguments: {},
      });

      const result = await server.executeTool({
        name: "genesis_step",
        arguments: { count: 100 },
      });

      const content = JSON.parse(result.content[0].text!);
      expect(content.step).toBe(100);
      expect(content.stepsAdvanced).toBe(100);
    });
  });

  describe("genesis_get_state", () => {
    it("should return current simulation state", async () => {
      await server.executeTool({
        name: "genesis_start_simulation",
        arguments: { width: 512, height: 512 },
      });

      const result = await server.executeTool({
        name: "genesis_get_state",
        arguments: {},
      });

      const content = JSON.parse(result.content[0].text!);
      expect(content.width).toBe(512);
      expect(content.height).toBe(512);
      expect(content.running).toBe(true);
      expect(content.parameters).toBeDefined();
    });
  });

  describe("genesis_set_parameters", () => {
    it("should update simulation parameters", async () => {
      await server.executeTool({
        name: "genesis_start_simulation",
        arguments: {},
      });

      const result = await server.executeTool({
        name: "genesis_set_parameters",
        arguments: {
          kernelRadius: 15,
          growthCenter: 0.15,
          boundaryMode: "reflected",
        },
      });

      const content = JSON.parse(result.content[0].text!);
      expect(content.status).toBe("updated");
      expect(content.parameters.kernelRadius).toBe(15);
      expect(content.parameters.growthCenter).toBe(0.15);
      expect(content.parameters.boundaryMode).toBe("reflected");
    });
  });

  describe("genesis_reset", () => {
    it("should reset simulation with pattern", async () => {
      await server.executeTool({
        name: "genesis_start_simulation",
        arguments: {},
      });

      await server.executeTool({
        name: "genesis_step",
        arguments: { count: 50 },
      });

      const result = await server.executeTool({
        name: "genesis_reset",
        arguments: { pattern: "center-blob" },
      });

      const content = JSON.parse(result.content[0].text!);
      expect(content.status).toBe("reset");
      expect(content.pattern).toBe("center-blob");
      expect(content.step).toBe(0);
    });
  });

  describe("genesis_analyze_symmetry", () => {
    it("should return symmetry analysis", async () => {
      await server.executeTool({
        name: "genesis_start_simulation",
        arguments: {},
      });

      const result = await server.executeTool({
        name: "genesis_analyze_symmetry",
        arguments: {},
      });

      const content = JSON.parse(result.content[0].text!);
      expect(content.analysis).toBe("symmetry");
      expect(typeof content.rotationalOrder).toBe("number");
      expect(typeof content.reflectionAxes).toBe("number");
      expect(typeof content.symmetryScore).toBe("number");
      expect(typeof content.isSymmetric).toBe("boolean");
    });
  });

  describe("genesis_analyze_chaos", () => {
    it("should return chaos analysis", async () => {
      await server.executeTool({
        name: "genesis_start_simulation",
        arguments: {},
      });

      const result = await server.executeTool({
        name: "genesis_analyze_chaos",
        arguments: { steps: 200 },
      });

      const content = JSON.parse(result.content[0].text!);
      expect(content.analysis).toBe("chaos");
      expect(typeof content.lyapunovExponent).toBe("number");
      expect(typeof content.isChaotic).toBe("boolean");
      expect(content.steps).toBe(200);
    });
  });

  describe("genesis_calculate_fitness", () => {
    it("should calculate fitness with default weights", async () => {
      await server.executeTool({
        name: "genesis_start_simulation",
        arguments: {},
      });

      const result = await server.executeTool({
        name: "genesis_calculate_fitness",
        arguments: {},
      });

      const content = JSON.parse(result.content[0].text!);
      expect(typeof content.fitness).toBe("number");
      expect(content.fitness).toBeGreaterThanOrEqual(0);
      expect(content.fitness).toBeLessThanOrEqual(1);
      expect(content.components).toBeDefined();
    });

    it("should calculate fitness with custom weights", async () => {
      await server.executeTool({
        name: "genesis_start_simulation",
        arguments: {},
      });

      const result = await server.executeTool({
        name: "genesis_calculate_fitness",
        arguments: {
          weights: {
            survival: 0.5,
            mass: 0.5,
            mobility: 0,
            stability: 0,
          },
        },
      });

      const content = JSON.parse(result.content[0].text!);
      expect(content.weights.survival).toBe(0.5);
      expect(content.weights.mass).toBe(0.5);
    });
  });

  describe("genesis_start_evolution", () => {
    it("should start evolutionary search", async () => {
      const result = await server.executeTool({
        name: "genesis_start_evolution",
        arguments: {
          populationSize: 30,
          generations: 50,
          mutationRate: 0.15,
        },
      });

      const content = JSON.parse(result.content[0].text!);
      expect(content.status).toBe("evolution_started");
      expect(content.config.populationSize).toBe(30);
      expect(content.config.generations).toBe(50);
      expect(content.config.mutationRate).toBe(0.15);
    });
  });

  describe("genesis_get_generation_stats", () => {
    it("should return error when no evolution running", async () => {
      const newServer = createGenesisMCPServer();
      const result = await newServer.executeTool({
        name: "genesis_get_generation_stats",
        arguments: {},
      });

      const content = JSON.parse(result.content[0].text!);
      expect(content.error).toBeDefined();
    });

    it("should return stats when evolution is running", async () => {
      await server.executeTool({
        name: "genesis_start_evolution",
        arguments: {},
      });

      const result = await server.executeTool({
        name: "genesis_get_generation_stats",
        arguments: {},
      });

      const content = JSON.parse(result.content[0].text!);
      expect(typeof content.generation).toBe("number");
      expect(typeof content.bestFitness).toBe("number");
      expect(typeof content.meanFitness).toBe("number");
      expect(typeof content.diversity).toBe("number");
    });
  });

  describe("genesis_get_best_genome", () => {
    it("should return best genome", async () => {
      await server.executeTool({
        name: "genesis_start_evolution",
        arguments: {},
      });

      const result = await server.executeTool({
        name: "genesis_get_best_genome",
        arguments: { criterion: "fitness" },
      });

      const content = JSON.parse(result.content[0].text!);
      expect(content.criterion).toBe("fitness");
      expect(content.genome).toBeDefined();
      expect(content.encoded).toBeDefined();
    });
  });

  describe("genesis_load_genome", () => {
    it("should load genome from JSON string", async () => {
      await server.executeTool({
        name: "genesis_start_simulation",
        arguments: {},
      });

      const genome = {
        kernelRadius: 15,
        growthCenter: 0.18,
        growthWidth: 0.05,
      };

      const result = await server.executeTool({
        name: "genesis_load_genome",
        arguments: { genome: JSON.stringify(genome) },
      });

      const content = JSON.parse(result.content[0].text!);
      expect(content.status).toBe("genome_loaded");
      expect(content.appliedParameters.kernelRadius).toBe(15);
      expect(content.appliedParameters.growthCenter).toBe(0.18);
    });

    it("should load genome from base64", async () => {
      await server.executeTool({
        name: "genesis_start_simulation",
        arguments: {},
      });

      const genome = { kernelRadius: 20 };
      const encoded = Buffer.from(JSON.stringify(genome)).toString("base64");

      const result = await server.executeTool({
        name: "genesis_load_genome",
        arguments: { genome: encoded },
      });

      const content = JSON.parse(result.content[0].text!);
      expect(content.status).toBe("genome_loaded");
    });

    it("should return error for invalid genome", async () => {
      const result = await server.executeTool({
        name: "genesis_load_genome",
        arguments: { genome: "not-valid-json-or-base64!" },
      });

      expect(result.isError).toBe(true);
    });
  });

  describe("genesis_export_state", () => {
    it("should export simulation state", async () => {
      await server.executeTool({
        name: "genesis_start_simulation",
        arguments: { width: 128, height: 128 },
      });

      const result = await server.executeTool({
        name: "genesis_export_state",
        arguments: { format: "json", includeMetrics: true },
      });

      const content = JSON.parse(result.content[0].text!);
      expect(content.format).toBe("json");
      expect(content.simulation).toBeDefined();
      expect(content.simulation.width).toBe(128);
      expect(content.metrics).toBeDefined();
    });
  });

  describe("genesis_take_snapshot", () => {
    it("should take a snapshot", async () => {
      await server.executeTool({
        name: "genesis_start_simulation",
        arguments: {},
      });

      const result = await server.executeTool({
        name: "genesis_take_snapshot",
        arguments: { filename: "test.png", colormap: "plasma" },
      });

      const content = JSON.parse(result.content[0].text!);
      expect(content.status).toBe("snapshot_saved");
      expect(content.filename).toBe("test.png");
      expect(content.colormap).toBe("plasma");
    });
  });

  describe("genesis_run_experiment", () => {
    it("should run experiment with statistics", async () => {
      const result = await server.executeTool({
        name: "genesis_run_experiment",
        arguments: {
          name: "test_experiment",
          trials: 3,
          stepsPerTrial: 100,
          metrics: ["fitness", "mass"],
        },
      });

      const content = JSON.parse(result.content[0].text!);
      expect(content.experiment).toBe("test_experiment");
      expect(content.trials).toBe(3);
      expect(content.results).toHaveLength(3);
      expect(content.statistics.fitness).toBeDefined();
      expect(content.statistics.mass).toBeDefined();
      expect(typeof content.statistics.fitness.mean).toBe("number");
      expect(typeof content.statistics.fitness.std).toBe("number");
    });
  });

  describe("error handling", () => {
    it("should handle unknown tool gracefully", async () => {
      const result = await server.executeTool({
        name: "unknown_tool" as any,
        arguments: {},
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Unknown tool");
    });
  });
});

describe("GENESIS_TOOLS", () => {
  it("should have valid tool definitions", () => {
    for (const tool of GENESIS_TOOLS) {
      expect(tool.name).toBeDefined();
      expect(tool.name.startsWith("genesis_")).toBe(true);
      expect(tool.description).toBeDefined();
      expect(tool.inputSchema).toBeDefined();
      expect(tool.inputSchema.type).toBe("object");
    }
  });

  it("should have unique tool names", () => {
    const names = GENESIS_TOOLS.map((t) => t.name);
    const uniqueNames = new Set(names);
    expect(uniqueNames.size).toBe(names.length);
  });
});
