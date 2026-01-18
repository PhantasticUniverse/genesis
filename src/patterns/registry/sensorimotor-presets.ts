/**
 * Sensorimotor Preset Collections
 * Presets for agency-enabled Lenia organisms
 */

import type {
  PresetData,
  PresetMetadata,
  BehaviorDescriptors,
  SensorimotorPresetConfig,
} from "./preset-types";

// ============================================================================
// Helper Functions
// ============================================================================

function createMetadata(
  id: string,
  name: string,
  description: string,
  category: PresetMetadata["category"],
  behavior: Partial<BehaviorDescriptors>,
  options: Partial<PresetMetadata> = {},
): PresetMetadata {
  const now = Date.now();
  return {
    id,
    name,
    description,
    author: options.author ?? "Genesis Team",
    version: "1.0",
    createdAt: now,
    updatedAt: now,
    mode: "sensorimotor",
    category,
    tags: options.tags ?? [],
    difficulty: options.difficulty ?? 3,
    behavior: {
      mobile: false,
      oscillating: false,
      replicating: false,
      growing: false,
      chaotic: false,
      symmetric: false,
      interacting: false,
      ...behavior,
    },
    thumbnail: options.thumbnail,
    previewGif: options.previewGif,
    colorScheme: options.colorScheme ?? "viridis",
    popularity: options.popularity ?? 0,
    rating: options.rating ?? 4.0,
    verified: options.verified ?? true,
  };
}

// ============================================================================
// Sensorimotor Presets
// ============================================================================

export const SENSORIMOTOR_PRESETS: PresetData[] = [
  // Chemotaxis Basic - Creature follows gradient to target
  {
    metadata: createMetadata(
      "sm-chemotaxis-basic",
      "Chemotaxis Basic",
      "A Lenia creature that follows chemical gradients toward a target - click to set destination",
      "glider",
      { mobile: true },
      {
        tags: ["chemotaxis", "gradient", "navigation", "agency"],
        difficulty: 2,
        popularity: 500,
        rating: 4.5,
      },
    ),
    config: {
      type: "sensorimotor",
      params: {
        kernelRadius: 15,
        dt: 0.1,
        growthCenter: 0.15,
        growthWidth: 0.03,
        obstacleRepulsion: 2.0,
        motorInfluence: 0.3,
        gradientDiffusion: 0.1,
        gradientDecay: 0.01,
        proximityRadius: 20,
        pheromoneEmission: 0.02,
        pheromoneDiffusion: 0.1,
        pheromoneDecay: 0.02,
      },
      obstacles: {
        type: "none",
      },
      gradient: {
        enabled: true,
      },
    } as SensorimotorPresetConfig,
  },

  // Maze Navigation - Navigate obstacles to reach goal
  {
    metadata: createMetadata(
      "sm-maze-navigation",
      "Maze Navigation",
      "Creature navigates around scattered obstacles using gradient sensing and obstacle avoidance",
      "glider",
      { mobile: true },
      {
        tags: ["maze", "obstacles", "navigation", "avoidance"],
        difficulty: 3,
        popularity: 400,
        rating: 4.3,
      },
    ),
    config: {
      type: "sensorimotor",
      params: {
        kernelRadius: 13,
        dt: 0.1,
        growthCenter: 0.14,
        growthWidth: 0.028,
        obstacleRepulsion: 3.0, // Higher repulsion for better avoidance
        motorInfluence: 0.4,
        gradientDiffusion: 0.15,
        gradientDecay: 0.008,
        proximityRadius: 25,
        pheromoneEmission: 0.03,
        pheromoneDiffusion: 0.12,
        pheromoneDecay: 0.015,
      },
      obstacles: {
        type: "scattered",
        density: 0.1,
      },
      gradient: {
        enabled: true,
      },
    } as SensorimotorPresetConfig,
  },

  // Swarm Following - Creatures follow pheromone trails
  {
    metadata: createMetadata(
      "sm-swarm-following",
      "Swarm Following",
      "Multiple creatures leave pheromone trails that others can follow - emergent swarm behavior",
      "ecosystem",
      { mobile: true, interacting: true },
      {
        tags: ["swarm", "pheromone", "collective", "emergence"],
        difficulty: 4,
        popularity: 350,
        rating: 4.6,
      },
    ),
    config: {
      type: "sensorimotor",
      params: {
        kernelRadius: 12,
        dt: 0.1,
        growthCenter: 0.13,
        growthWidth: 0.025,
        obstacleRepulsion: 2.0,
        motorInfluence: 0.2,
        gradientDiffusion: 0.08,
        gradientDecay: 0.02,
        proximityRadius: 30,
        pheromoneEmission: 0.1, // High pheromone emission
        pheromoneDiffusion: 0.2, // Faster diffusion for trails
        pheromoneDecay: 0.01, // Slow decay for persistent trails
      },
      obstacles: {
        type: "none",
      },
      gradient: {
        enabled: false, // Rely on pheromones instead
      },
    } as SensorimotorPresetConfig,
  },

  // Wall Bouncer - Creature bounces off walls
  {
    metadata: createMetadata(
      "sm-wall-bouncer",
      "Wall Bouncer",
      "Creature explores the space by bouncing off wall obstacles - demonstrates obstacle repulsion",
      "glider",
      { mobile: true },
      {
        tags: ["walls", "bouncing", "exploration", "obstacles"],
        difficulty: 2,
        popularity: 300,
        rating: 4.2,
      },
    ),
    config: {
      type: "sensorimotor",
      params: {
        kernelRadius: 14,
        dt: 0.1,
        growthCenter: 0.16,
        growthWidth: 0.032,
        obstacleRepulsion: 4.0, // Very high for strong bouncing
        motorInfluence: 0.25,
        gradientDiffusion: 0.05,
        gradientDecay: 0.03,
        proximityRadius: 18,
        pheromoneEmission: 0.01,
        pheromoneDiffusion: 0.08,
        pheromoneDecay: 0.03,
      },
      obstacles: {
        type: "walls",
      },
      gradient: {
        enabled: false,
      },
    } as SensorimotorPresetConfig,
  },

  // Predator Evasion - Fast-moving creature avoiding threats
  {
    metadata: createMetadata(
      "sm-predator-evasion",
      "Predator Evasion",
      "Fast creature with high motor influence - use obstacles as 'predators' to avoid",
      "spaceship",
      { mobile: true },
      {
        tags: ["fast", "evasion", "survival", "predator"],
        difficulty: 4,
        popularity: 280,
        rating: 4.4,
      },
    ),
    config: {
      type: "sensorimotor",
      params: {
        kernelRadius: 10,
        dt: 0.12, // Faster time step
        growthCenter: 0.18,
        growthWidth: 0.035,
        obstacleRepulsion: 5.0, // Maximum repulsion
        motorInfluence: 0.5, // High motor for fast turns
        gradientDiffusion: 0.2,
        gradientDecay: 0.005,
        proximityRadius: 35, // Long-range detection
        pheromoneEmission: 0.0, // No trails
        pheromoneDiffusion: 0.0,
        pheromoneDecay: 0.1,
      },
      obstacles: {
        type: "scattered",
        density: 0.05,
      },
      gradient: {
        enabled: true,
      },
    } as SensorimotorPresetConfig,
  },

  // Gentle Explorer - Slow, stable creature for observation
  {
    metadata: createMetadata(
      "sm-gentle-explorer",
      "Gentle Explorer",
      "Slow-moving stable creature ideal for observing sensorimotor dynamics",
      "glider",
      { mobile: true, symmetric: true },
      {
        tags: ["slow", "stable", "observation", "beginner"],
        difficulty: 1,
        popularity: 450,
        rating: 4.0,
      },
    ),
    config: {
      type: "sensorimotor",
      params: {
        kernelRadius: 18,
        dt: 0.08, // Slower time step
        growthCenter: 0.12,
        growthWidth: 0.024,
        obstacleRepulsion: 1.5,
        motorInfluence: 0.15, // Low motor for stability
        gradientDiffusion: 0.05,
        gradientDecay: 0.015,
        proximityRadius: 15,
        pheromoneEmission: 0.04,
        pheromoneDiffusion: 0.1,
        pheromoneDecay: 0.02,
      },
      obstacles: {
        type: "none",
      },
      gradient: {
        enabled: true,
      },
    } as SensorimotorPresetConfig,
  },
];

/**
 * Get all sensorimotor presets
 */
export function getSensorimotorPresets(): PresetData[] {
  return SENSORIMOTOR_PRESETS;
}

/**
 * Get sensorimotor preset by ID
 */
export function getSensorimotorPresetById(id: string): PresetData | undefined {
  return SENSORIMOTOR_PRESETS.find((p) => p.metadata.id === id);
}
