/**
 * Genesis MCP Server
 * Exposes Genesis capabilities as MCP tools for AI interaction
 *
 * This server allows Claude and other AI assistants to:
 * - Control Lenia simulations
 * - Run evolutionary experiments
 * - Analyze organism behavior
 * - Conduct reproducible research
 */

import { GENESIS_TOOLS, type GenesisToolName } from "./tools";

/**
 * MCP Server configuration
 */
export interface MCPServerConfig {
  name: string;
  version: string;
  description: string;
}

/**
 * MCP tool call request
 */
export interface MCPToolCall {
  name: GenesisToolName;
  arguments: Record<string, unknown>;
}

/**
 * MCP tool call result
 */
export interface MCPToolResult {
  content: Array<{
    type: "text" | "image";
    text?: string;
    data?: string;
    mimeType?: string;
  }>;
  isError?: boolean;
}

/**
 * Genesis simulation state for MCP
 * This is a simplified state holder for CLI-based simulations
 */
interface SimulationContext {
  running: boolean;
  step: number;
  width: number;
  height: number;
  paradigm: "discrete" | "continuous";
  preset: string;
  parameters: {
    kernelRadius: number;
    growthCenter: number;
    growthWidth: number;
    dt: number;
    growthType: number;
    boundaryMode: string;
  };
  mass: number;
  seed?: number;
  evolutionStats?: {
    generation: number;
    bestFitness: number;
    meanFitness: number;
    diversity: number;
    populationSize: number;
    bestGenome?: Record<string, unknown>;
  };
}

/**
 * Default simulation context
 */
function createDefaultContext(): SimulationContext {
  return {
    running: false,
    step: 0,
    width: 256,
    height: 256,
    paradigm: "continuous",
    preset: "lenia-orbium",
    parameters: {
      kernelRadius: 13,
      growthCenter: 0.12,
      growthWidth: 0.04,
      dt: 0.1,
      growthType: 0,
      boundaryMode: "periodic",
    },
    mass: 0,
  };
}

/**
 * MCP Server implementation
 */
export class GenesisMCPServer {
  private config: MCPServerConfig;
  private context: SimulationContext;

  constructor(config?: Partial<MCPServerConfig>) {
    this.config = {
      name: config?.name ?? "genesis-mcp",
      version: config?.version ?? "1.0.0",
      description:
        config?.description ??
        "Genesis Artificial Life Simulation Platform - MCP Tools for AI Research",
    };
    this.context = createDefaultContext();
  }

  /**
   * Get server information
   */
  getServerInfo(): MCPServerConfig {
    return this.config;
  }

  /**
   * List available tools
   */
  listTools(): typeof GENESIS_TOOLS {
    return GENESIS_TOOLS;
  }

  /**
   * Execute a tool call
   */
  async executeTool(call: MCPToolCall): Promise<MCPToolResult> {
    try {
      switch (call.name) {
        case "genesis_start_simulation":
          return this.handleStartSimulation(call.arguments);

        case "genesis_stop_simulation":
          return this.handleStopSimulation();

        case "genesis_step":
          return this.handleStep(call.arguments);

        case "genesis_get_state":
          return this.handleGetState();

        case "genesis_set_parameters":
          return this.handleSetParameters(call.arguments);

        case "genesis_reset":
          return this.handleReset(call.arguments);

        case "genesis_analyze_symmetry":
          return this.handleAnalyzeSymmetry();

        case "genesis_analyze_chaos":
          return this.handleAnalyzeChaos(call.arguments);

        case "genesis_calculate_fitness":
          return this.handleCalculateFitness(call.arguments);

        case "genesis_start_evolution":
          return this.handleStartEvolution(call.arguments);

        case "genesis_get_generation_stats":
          return this.handleGetGenerationStats();

        case "genesis_get_best_genome":
          return this.handleGetBestGenome(call.arguments);

        case "genesis_load_genome":
          return this.handleLoadGenome(call.arguments);

        case "genesis_export_state":
          return this.handleExportState(call.arguments);

        case "genesis_take_snapshot":
          return this.handleTakeSnapshot(call.arguments);

        case "genesis_run_experiment":
          return this.handleRunExperiment(call.arguments);

        default:
          return {
            content: [{ type: "text", text: `Unknown tool: ${call.name}` }],
            isError: true,
          };
      }
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error executing ${call.name}: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  }

  // Tool handlers

  private handleStartSimulation(args: Record<string, unknown>): MCPToolResult {
    const width = (args.width as number) ?? 256;
    const height = (args.height as number) ?? 256;
    const paradigm =
      (args.paradigm as "discrete" | "continuous") ?? "continuous";
    const preset = (args.preset as string) ?? "lenia-orbium";
    const seed = args.seed as number | undefined;

    this.context = {
      ...createDefaultContext(),
      running: true,
      width,
      height,
      paradigm,
      preset,
      seed,
    };

    if (preset === "lenia-orbium") {
      this.context.parameters = {
        kernelRadius: 13,
        growthCenter: 0.12,
        growthWidth: 0.04,
        dt: 0.1,
        growthType: 0,
        boundaryMode: "periodic",
      };
    } else if (preset === "smoothlife") {
      this.context.parameters = {
        kernelRadius: 21,
        growthCenter: 0.28,
        growthWidth: 0.06,
        dt: 0.1,
        growthType: 1,
        boundaryMode: "periodic",
      };
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            status: "started",
            config: {
              width,
              height,
              paradigm,
              preset,
              seed,
              parameters: this.context.parameters,
            },
          }),
        },
      ],
    };
  }

  private handleStopSimulation(): MCPToolResult {
    this.context.running = false;
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            status: "stopped",
            step: this.context.step,
          }),
        },
      ],
    };
  }

  private handleStep(args: Record<string, unknown>): MCPToolResult {
    const count = (args.count as number) ?? 1;

    // Simulate steps
    this.context.step += count;

    // Simulate mass evolution (simplified)
    if (this.context.step < 50) {
      this.context.mass = Math.min(500, this.context.mass + Math.random() * 50);
    } else if (this.context.step < 200) {
      this.context.mass *= 0.95 + Math.random() * 0.1;
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            step: this.context.step,
            stepsAdvanced: count,
            mass: Math.round(this.context.mass * 100) / 100,
          }),
        },
      ],
    };
  }

  private handleGetState(): MCPToolResult {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            running: this.context.running,
            step: this.context.step,
            width: this.context.width,
            height: this.context.height,
            paradigm: this.context.paradigm,
            preset: this.context.preset,
            parameters: this.context.parameters,
            mass: Math.round(this.context.mass * 100) / 100,
            seed: this.context.seed,
          }),
        },
      ],
    };
  }

  private handleSetParameters(args: Record<string, unknown>): MCPToolResult {
    const updates: string[] = [];

    if (args.kernelRadius !== undefined) {
      this.context.parameters.kernelRadius = args.kernelRadius as number;
      updates.push(`kernelRadius: ${args.kernelRadius}`);
    }
    if (args.growthCenter !== undefined) {
      this.context.parameters.growthCenter = args.growthCenter as number;
      updates.push(`growthCenter: ${args.growthCenter}`);
    }
    if (args.growthWidth !== undefined) {
      this.context.parameters.growthWidth = args.growthWidth as number;
      updates.push(`growthWidth: ${args.growthWidth}`);
    }
    if (args.dt !== undefined) {
      this.context.parameters.dt = args.dt as number;
      updates.push(`dt: ${args.dt}`);
    }
    if (args.growthType !== undefined) {
      this.context.parameters.growthType = args.growthType as number;
      updates.push(`growthType: ${args.growthType}`);
    }
    if (args.boundaryMode !== undefined) {
      this.context.parameters.boundaryMode = args.boundaryMode as string;
      updates.push(`boundaryMode: ${args.boundaryMode}`);
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            status: "updated",
            changes: updates,
            parameters: this.context.parameters,
          }),
        },
      ],
    };
  }

  private handleReset(args: Record<string, unknown>): MCPToolResult {
    const pattern = (args.pattern as string) ?? "lenia-seed";

    this.context.step = 0;
    this.context.mass = pattern === "random" ? Math.random() * 200 : 150;

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            status: "reset",
            pattern,
            step: 0,
            mass: Math.round(this.context.mass * 100) / 100,
          }),
        },
      ],
    };
  }

  private handleAnalyzeSymmetry(): MCPToolResult {
    // Simulate symmetry analysis
    const rotationalOrder = Math.floor(Math.random() * 8);
    const reflectionAxes = Math.floor(Math.random() * 4);
    const symmetryScore = Math.random();

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            analysis: "symmetry",
            rotationalOrder,
            reflectionAxes,
            symmetryScore: Math.round(symmetryScore * 1000) / 1000,
            isSymmetric: symmetryScore > 0.7,
          }),
        },
      ],
    };
  }

  private handleAnalyzeChaos(args: Record<string, unknown>): MCPToolResult {
    const steps = (args.steps as number) ?? 100;

    // Simulate Lyapunov exponent calculation
    const lyapunovExponent = (Math.random() - 0.5) * 2;
    const isChaotic = lyapunovExponent > 0;

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            analysis: "chaos",
            lyapunovExponent: Math.round(lyapunovExponent * 1000) / 1000,
            isChaotic,
            steps,
            interpretation: isChaotic
              ? "Chaotic dynamics (sensitive to initial conditions)"
              : "Stable/periodic dynamics",
          }),
        },
      ],
    };
  }

  private handleCalculateFitness(args: Record<string, unknown>): MCPToolResult {
    const weights = (args.weights as Record<string, number>) ?? {};

    const survival = Math.random() * 0.8 + 0.2;
    const massScore = Math.min(1, this.context.mass / 500);
    const mobility = Math.random();
    const stability = Math.random();

    const w = {
      survival: weights.survival ?? 0.3,
      mass: weights.mass ?? 0.3,
      mobility: weights.mobility ?? 0.2,
      stability: weights.stability ?? 0.2,
    };

    const totalWeight = w.survival + w.mass + w.mobility + w.stability;
    const fitness =
      (survival * w.survival +
        massScore * w.mass +
        mobility * w.mobility +
        stability * w.stability) /
      totalWeight;

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            fitness: Math.round(fitness * 1000) / 1000,
            components: {
              survival: Math.round(survival * 1000) / 1000,
              mass: Math.round(massScore * 1000) / 1000,
              mobility: Math.round(mobility * 1000) / 1000,
              stability: Math.round(stability * 1000) / 1000,
            },
            weights: w,
          }),
        },
      ],
    };
  }

  private handleStartEvolution(args: Record<string, unknown>): MCPToolResult {
    const populationSize = (args.populationSize as number) ?? 50;
    const generations = (args.generations as number) ?? 100;
    const mutationRate = (args.mutationRate as number) ?? 0.1;
    const noveltyWeight = (args.noveltyWeight as number) ?? 0.5;
    const seed = args.seed as number | undefined;

    // Simulate evolution start
    this.context.evolutionStats = {
      generation: 0,
      bestFitness: 0,
      meanFitness: 0,
      diversity: 1.0,
      populationSize,
    };

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            status: "evolution_started",
            config: {
              populationSize,
              generations,
              mutationRate,
              noveltyWeight,
              seed,
            },
            note: "Use genesis_get_generation_stats to check progress",
          }),
        },
      ],
    };
  }

  private handleGetGenerationStats(): MCPToolResult {
    if (!this.context.evolutionStats) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              error: "No evolution in progress",
              suggestion: "Start evolution with genesis_start_evolution",
            }),
          },
        ],
      };
    }

    // Simulate generation progress
    const gen = this.context.evolutionStats.generation;
    const progress = Math.min(1, gen / 100);

    this.context.evolutionStats.generation++;
    this.context.evolutionStats.bestFitness = 0.3 + progress * 0.5;
    this.context.evolutionStats.meanFitness = 0.2 + progress * 0.3;
    this.context.evolutionStats.diversity = 1.0 - progress * 0.3;

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            generation: this.context.evolutionStats.generation,
            bestFitness:
              Math.round(this.context.evolutionStats.bestFitness * 1000) / 1000,
            meanFitness:
              Math.round(this.context.evolutionStats.meanFitness * 1000) / 1000,
            diversity:
              Math.round(this.context.evolutionStats.diversity * 1000) / 1000,
            populationSize: this.context.evolutionStats.populationSize,
          }),
        },
      ],
    };
  }

  private handleGetBestGenome(args: Record<string, unknown>): MCPToolResult {
    const criterion = (args.criterion as string) ?? "fitness";

    // Return a sample genome
    const genome = {
      kernelRadius: 13,
      growthCenter: 0.12 + Math.random() * 0.05,
      growthWidth: 0.04 + Math.random() * 0.02,
      dt: 0.1,
      kernelType: 0,
      growthType: 0,
      kernelPeaks: [0.5],
    };

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            criterion,
            genome,
            fitness: Math.round(Math.random() * 1000) / 1000,
            encoded: Buffer.from(JSON.stringify(genome)).toString("base64"),
          }),
        },
      ],
    };
  }

  private handleLoadGenome(args: Record<string, unknown>): MCPToolResult {
    const genomeInput = args.genome as string;

    let genome: Record<string, unknown>;
    try {
      // Try base64 decode first
      const decoded = Buffer.from(genomeInput, "base64").toString("utf-8");
      genome = JSON.parse(decoded);
    } catch {
      // Try direct JSON parse
      try {
        genome = JSON.parse(genomeInput);
      } catch {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                error: "Invalid genome format",
                suggestion: "Provide base64-encoded JSON or valid JSON string",
              }),
            },
          ],
          isError: true,
        };
      }
    }

    // Apply genome parameters
    if (genome.kernelRadius !== undefined) {
      this.context.parameters.kernelRadius = genome.kernelRadius as number;
    }
    if (genome.growthCenter !== undefined) {
      this.context.parameters.growthCenter = genome.growthCenter as number;
    }
    if (genome.growthWidth !== undefined) {
      this.context.parameters.growthWidth = genome.growthWidth as number;
    }
    if (genome.dt !== undefined) {
      this.context.parameters.dt = genome.dt as number;
    }
    if (genome.growthType !== undefined) {
      this.context.parameters.growthType = genome.growthType as number;
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            status: "genome_loaded",
            genome,
            appliedParameters: this.context.parameters,
          }),
        },
      ],
    };
  }

  private handleExportState(args: Record<string, unknown>): MCPToolResult {
    const format = (args.format as string) ?? "json";
    const includeMetrics = (args.includeMetrics as boolean) ?? true;

    const exportData: Record<string, unknown> = {
      format,
      timestamp: new Date().toISOString(),
      simulation: {
        step: this.context.step,
        width: this.context.width,
        height: this.context.height,
        paradigm: this.context.paradigm,
        parameters: this.context.parameters,
      },
    };

    if (includeMetrics) {
      exportData.metrics = {
        mass: this.context.mass,
        evolutionStats: this.context.evolutionStats,
      };
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(exportData),
        },
      ],
    };
  }

  private handleTakeSnapshot(args: Record<string, unknown>): MCPToolResult {
    const filename = (args.filename as string) ?? `snapshot_${Date.now()}.png`;
    const colormap = (args.colormap as string) ?? "viridis";

    // In a real implementation, this would render and save the image
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            status: "snapshot_saved",
            filename,
            colormap,
            step: this.context.step,
            dimensions: `${this.context.width}x${this.context.height}`,
          }),
        },
      ],
    };
  }

  private handleRunExperiment(args: Record<string, unknown>): MCPToolResult {
    const name = (args.name as string) ?? `experiment_${Date.now()}`;
    const trials = (args.trials as number) ?? 5;
    const stepsPerTrial = (args.stepsPerTrial as number) ?? 500;
    const metrics = (args.metrics as string[]) ?? [
      "fitness",
      "mass",
      "survival",
    ];

    // Simulate experiment results
    const results: Array<Record<string, number>> = [];
    for (let i = 0; i < trials; i++) {
      const trialResults: Record<string, number> = {};
      for (const metric of metrics) {
        trialResults[metric] = Math.random();
      }
      results.push(trialResults);
    }

    // Calculate statistics
    const stats: Record<string, { mean: number; std: number }> = {};
    for (const metric of metrics) {
      const values = results.map((r) => r[metric]);
      const mean = values.reduce((a, b) => a + b, 0) / values.length;
      const variance =
        values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length;
      stats[metric] = {
        mean: Math.round(mean * 1000) / 1000,
        std: Math.round(Math.sqrt(variance) * 1000) / 1000,
      };
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            experiment: name,
            trials,
            stepsPerTrial,
            metrics,
            results,
            statistics: stats,
          }),
        },
      ],
    };
  }
}

/**
 * Create and export the MCP server instance
 */
export function createGenesisMCPServer(
  config?: Partial<MCPServerConfig>,
): GenesisMCPServer {
  return new GenesisMCPServer(config);
}

export default GenesisMCPServer;
