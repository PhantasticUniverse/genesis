/**
 * MCP Tool Definitions for Genesis
 * Defines the tools exposed by the MCP server
 */

/**
 * Tool parameter schemas
 */
export interface SimulationConfig {
  width?: number;
  height?: number;
  paradigm?: "discrete" | "continuous";
  preset?: string;
  seed?: number;
}

export interface StepParams {
  count?: number;
}

export interface ParameterUpdate {
  kernelRadius?: number;
  growthCenter?: number;
  growthWidth?: number;
  dt?: number;
  growthType?: number;
  boundaryMode?: "periodic" | "clamped" | "reflected" | "zero";
}

export interface EvolutionConfig {
  populationSize?: number;
  generations?: number;
  mutationRate?: number;
  noveltyWeight?: number;
  seed?: number;
}

export interface ExportConfig {
  format?: "json" | "image" | "raw";
  includeState?: boolean;
  includeMetrics?: boolean;
}

/**
 * Tool result types
 */
export interface SimulationState {
  step: number;
  running: boolean;
  width: number;
  height: number;
  paradigm: string;
  mass?: number;
  activeCreatures?: number;
}

export interface AnalysisResult {
  type: string;
  value: number | boolean | string;
  details?: Record<string, unknown>;
}

export interface EvolutionStats {
  generation: number;
  bestFitness: number;
  meanFitness: number;
  diversity: number;
  populationSize: number;
}

/**
 * MCP Tool definitions following MCP SDK format
 */
export const GENESIS_TOOLS = [
  {
    name: "genesis_start_simulation",
    description: "Start a new Lenia/CA simulation with specified configuration",
    inputSchema: {
      type: "object" as const,
      properties: {
        width: {
          type: "number",
          description: "Grid width (default: 256)",
        },
        height: {
          type: "number",
          description: "Grid height (default: 256)",
        },
        paradigm: {
          type: "string",
          enum: ["discrete", "continuous"],
          description: "CA type (default: continuous)",
        },
        preset: {
          type: "string",
          description:
            "Preset name (e.g., 'lenia-orbium', 'smoothlife', 'gaussian-smooth')",
        },
        seed: {
          type: "number",
          description: "Random seed for reproducibility",
        },
      },
    },
  },
  {
    name: "genesis_stop_simulation",
    description: "Stop the running simulation",
    inputSchema: {
      type: "object" as const,
      properties: {},
    },
  },
  {
    name: "genesis_step",
    description: "Advance simulation by specified number of steps",
    inputSchema: {
      type: "object" as const,
      properties: {
        count: {
          type: "number",
          description: "Number of steps to advance (default: 1)",
        },
      },
    },
  },
  {
    name: "genesis_get_state",
    description: "Get current simulation state and metrics",
    inputSchema: {
      type: "object" as const,
      properties: {},
    },
  },
  {
    name: "genesis_set_parameters",
    description: "Update Lenia simulation parameters",
    inputSchema: {
      type: "object" as const,
      properties: {
        kernelRadius: {
          type: "number",
          description: "Kernel radius (typically 10-20)",
        },
        growthCenter: {
          type: "number",
          description: "Growth function center (mu, typically 0.1-0.3)",
        },
        growthWidth: {
          type: "number",
          description: "Growth function width (sigma, typically 0.01-0.1)",
        },
        dt: {
          type: "number",
          description: "Time step (typically 0.1)",
        },
        growthType: {
          type: "number",
          description: "Growth function type: 0=polynomial, 1=gaussian, 2=step",
        },
        boundaryMode: {
          type: "string",
          enum: ["periodic", "clamped", "reflected", "zero"],
          description: "Boundary condition mode",
        },
      },
    },
  },
  {
    name: "genesis_reset",
    description: "Reset simulation with a new pattern",
    inputSchema: {
      type: "object" as const,
      properties: {
        pattern: {
          type: "string",
          enum: ["random", "center-blob", "lenia-seed", "glider", "blinker"],
          description: "Initial pattern type",
        },
      },
    },
  },
  {
    name: "genesis_analyze_symmetry",
    description: "Analyze rotational and reflectional symmetry of current state",
    inputSchema: {
      type: "object" as const,
      properties: {},
    },
  },
  {
    name: "genesis_analyze_chaos",
    description: "Estimate Lyapunov exponent (chaos measure) of current dynamics",
    inputSchema: {
      type: "object" as const,
      properties: {
        steps: {
          type: "number",
          description: "Number of steps for analysis (default: 100)",
        },
        perturbation: {
          type: "number",
          description: "Initial perturbation size (default: 0.001)",
        },
      },
    },
  },
  {
    name: "genesis_calculate_fitness",
    description: "Calculate fitness score of current organism",
    inputSchema: {
      type: "object" as const,
      properties: {
        weights: {
          type: "object",
          description: "Custom fitness weights",
          properties: {
            survival: { type: "number" },
            mass: { type: "number" },
            mobility: { type: "number" },
            stability: { type: "number" },
          },
        },
      },
    },
  },
  {
    name: "genesis_start_evolution",
    description: "Start evolutionary search for novel organisms",
    inputSchema: {
      type: "object" as const,
      properties: {
        populationSize: {
          type: "number",
          description: "Population size (default: 50)",
        },
        generations: {
          type: "number",
          description: "Number of generations (default: 100)",
        },
        mutationRate: {
          type: "number",
          description: "Mutation rate (default: 0.1)",
        },
        noveltyWeight: {
          type: "number",
          description: "Weight for novelty vs fitness (0-1, default: 0.5)",
        },
        seed: {
          type: "number",
          description: "Random seed for reproducibility",
        },
      },
    },
  },
  {
    name: "genesis_get_generation_stats",
    description: "Get statistics from current/last evolutionary run",
    inputSchema: {
      type: "object" as const,
      properties: {},
    },
  },
  {
    name: "genesis_get_best_genome",
    description: "Get the best genome from evolution",
    inputSchema: {
      type: "object" as const,
      properties: {
        criterion: {
          type: "string",
          enum: ["fitness", "novelty", "combined"],
          description: "Selection criterion (default: fitness)",
        },
      },
    },
  },
  {
    name: "genesis_load_genome",
    description: "Load a genome into the simulation",
    inputSchema: {
      type: "object" as const,
      properties: {
        genome: {
          type: "string",
          description: "Base64-encoded genome or genome JSON",
        },
      },
      required: ["genome"],
    },
  },
  {
    name: "genesis_export_state",
    description: "Export current simulation state",
    inputSchema: {
      type: "object" as const,
      properties: {
        format: {
          type: "string",
          enum: ["json", "image", "raw"],
          description: "Export format (default: json)",
        },
        includeState: {
          type: "boolean",
          description: "Include full grid state (default: false)",
        },
        includeMetrics: {
          type: "boolean",
          description: "Include analysis metrics (default: true)",
        },
      },
    },
  },
  {
    name: "genesis_take_snapshot",
    description: "Take a visual snapshot of current state",
    inputSchema: {
      type: "object" as const,
      properties: {
        filename: {
          type: "string",
          description: "Output filename (default: auto-generated)",
        },
        colormap: {
          type: "string",
          enum: [
            "grayscale",
            "viridis",
            "plasma",
            "inferno",
            "fire",
            "ocean",
            "rainbow",
          ],
          description: "Colormap to use (default: viridis)",
        },
      },
    },
  },
  {
    name: "genesis_run_experiment",
    description:
      "Run a complete experiment with multiple trials and statistical analysis",
    inputSchema: {
      type: "object" as const,
      properties: {
        name: {
          type: "string",
          description: "Experiment name",
        },
        config: {
          type: "object",
          description: "Simulation configuration",
        },
        trials: {
          type: "number",
          description: "Number of trials (default: 5)",
        },
        stepsPerTrial: {
          type: "number",
          description: "Steps per trial (default: 500)",
        },
        metrics: {
          type: "array",
          items: { type: "string" },
          description: "Metrics to collect",
        },
      },
    },
  },
];

/**
 * Tool name type
 */
export type GenesisToolName = (typeof GENESIS_TOOLS)[number]["name"];
