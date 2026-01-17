/**
 * Multi-Channel System
 * Enables multiple interacting species/fields
 */

export type ChannelRole =
  | "creature" // Primary organism body
  | "food" // Resource/food source
  | "obstacle" // Barriers (fixed)
  | "pheromone" // Chemical signaling
  | "gradient"; // Environmental gradient

export interface ChannelConfig {
  id: string;
  name: string;
  role: ChannelRole;
  color: [number, number, number]; // RGB display color

  // Dynamics
  decayRate: number; // How fast the channel decays (0 = no decay)
  diffusionRate: number; // How fast values spread to neighbors

  // Interaction parameters
  selfInteraction: boolean; // Does this channel interact with itself?
}

export type InteractionType = "lenia" | "predation" | "symbiosis";

export interface ChannelInteraction {
  sourceChannel: number;
  targetChannel: number;
  kernelRadius: number;
  growthCenter: number;
  growthWidth: number;
  weight: number; // Contribution weight (can be negative for inhibition)
  interactionType?: InteractionType; // 0=lenia (default), 1=predation, 2=symbiosis
}

export interface MultiChannelConfig {
  channels: ChannelConfig[];
  interactions: ChannelInteraction[];
}

// Preset multi-channel configurations
export const MULTICHANNEL_PRESETS: Record<string, MultiChannelConfig> = {
  // Two-species ecosystem (competitive)
  "two-species": {
    channels: [
      {
        id: "species-a",
        name: "Species A",
        role: "creature",
        color: [50, 255, 150],
        decayRate: 0,
        diffusionRate: 0,
        selfInteraction: true,
      },
      {
        id: "species-b",
        name: "Species B",
        role: "creature",
        color: [255, 150, 50],
        decayRate: 0,
        diffusionRate: 0,
        selfInteraction: true,
      },
    ],
    interactions: [
      // Species A self-interaction (survival) - tuned for stable Lenia organisms
      {
        sourceChannel: 0,
        targetChannel: 0,
        kernelRadius: 13,
        growthCenter: 0.12,
        growthWidth: 0.04,
        weight: 1.0,
        interactionType: "lenia",
      },
      // Species B self-interaction (survival)
      {
        sourceChannel: 1,
        targetChannel: 1,
        kernelRadius: 13,
        growthCenter: 0.12,
        growthWidth: 0.04,
        weight: 1.0,
        interactionType: "lenia",
      },
      // A inhibits B (competition)
      {
        sourceChannel: 0,
        targetChannel: 1,
        kernelRadius: 8,
        growthCenter: 0.15,
        growthWidth: 0.05,
        weight: -0.2,
        interactionType: "lenia",
      },
      // B inhibits A (competition)
      {
        sourceChannel: 1,
        targetChannel: 0,
        kernelRadius: 8,
        growthCenter: 0.15,
        growthWidth: 0.05,
        weight: -0.2,
        interactionType: "lenia",
      },
    ],
  },

  // Predator-prey dynamics
  "predator-prey": {
    channels: [
      {
        id: "prey",
        name: "Prey",
        role: "creature",
        color: [100, 255, 100],
        decayRate: 0,
        diffusionRate: 0,
        selfInteraction: true,
      },
      {
        id: "predator",
        name: "Predator",
        role: "creature",
        color: [255, 80, 80],
        decayRate: 0.001,
        diffusionRate: 0,
        selfInteraction: true,
      },
    ],
    interactions: [
      // Prey reproduces (stable Lenia parameters)
      {
        sourceChannel: 0,
        targetChannel: 0,
        kernelRadius: 13,
        growthCenter: 0.12,
        growthWidth: 0.04,
        weight: 1.0,
        interactionType: "lenia",
      },
      // Predator survives near prey
      {
        sourceChannel: 0,
        targetChannel: 1,
        kernelRadius: 13,
        growthCenter: 0.12,
        growthWidth: 0.04,
        weight: 0.8,
        interactionType: "lenia",
      },
      // Predator self-interaction (needs prey to survive fully)
      {
        sourceChannel: 1,
        targetChannel: 1,
        kernelRadius: 13,
        growthCenter: 0.12,
        growthWidth: 0.04,
        weight: 0.3,
        interactionType: "lenia",
      },
      // Predator reduces prey (predation)
      {
        sourceChannel: 1,
        targetChannel: 0,
        kernelRadius: 8,
        growthCenter: 0.15,
        growthWidth: 0.05,
        weight: -0.3,
        interactionType: "predation",
      },
    ],
  },

  // Three-level food chain
  "food-chain": {
    channels: [
      {
        id: "plant",
        name: "Plants",
        role: "food",
        color: [50, 200, 50],
        decayRate: 0,
        diffusionRate: 0.005,
        selfInteraction: true,
      },
      {
        id: "herbivore",
        name: "Herbivore",
        role: "creature",
        color: [100, 150, 255],
        decayRate: 0.0005,
        diffusionRate: 0,
        selfInteraction: true,
      },
      {
        id: "predator",
        name: "Predator",
        role: "creature",
        color: [255, 80, 80],
        decayRate: 0.001,
        diffusionRate: 0,
        selfInteraction: true,
      },
    ],
    interactions: [
      // Plants grow autonomously - stable self-interaction
      {
        sourceChannel: 0,
        targetChannel: 0,
        kernelRadius: 13,
        growthCenter: 0.12,
        growthWidth: 0.04,
        weight: 0.6,
        interactionType: "lenia",
      },
      // Herbivore self-interaction (survival) - stable Lenia parameters
      {
        sourceChannel: 1,
        targetChannel: 1,
        kernelRadius: 13,
        growthCenter: 0.12,
        growthWidth: 0.04,
        weight: 0.8,
        interactionType: "lenia",
      },
      // Herbivore gains from plants
      {
        sourceChannel: 0,
        targetChannel: 1,
        kernelRadius: 10,
        growthCenter: 0.12,
        growthWidth: 0.04,
        weight: 0.4,
        interactionType: "lenia",
      },
      // Plants consumed by herbivores
      {
        sourceChannel: 1,
        targetChannel: 0,
        kernelRadius: 8,
        growthCenter: 0.15,
        growthWidth: 0.05,
        weight: -0.25,
        interactionType: "predation",
      },
      // Predator self-interaction (survival) - stable Lenia parameters
      {
        sourceChannel: 2,
        targetChannel: 2,
        kernelRadius: 13,
        growthCenter: 0.12,
        growthWidth: 0.04,
        weight: 0.5,
        interactionType: "lenia",
      },
      // Predator gains from herbivore
      {
        sourceChannel: 1,
        targetChannel: 2,
        kernelRadius: 12,
        growthCenter: 0.12,
        growthWidth: 0.04,
        weight: 0.6,
        interactionType: "predation",
      },
      // Herbivore consumed by predator
      {
        sourceChannel: 2,
        targetChannel: 1,
        kernelRadius: 8,
        growthCenter: 0.15,
        growthWidth: 0.05,
        weight: -0.3,
        interactionType: "predation",
      },
    ],
  },

  // Symbiotic species
  symbiosis: {
    channels: [
      {
        id: "species-a",
        name: "Host",
        role: "creature",
        color: [100, 200, 255],
        decayRate: 0,
        diffusionRate: 0,
        selfInteraction: true,
      },
      {
        id: "species-b",
        name: "Symbiont",
        role: "creature",
        color: [255, 200, 100],
        decayRate: 0,
        diffusionRate: 0,
        selfInteraction: true,
      },
    ],
    interactions: [
      // Host survival - stable Lenia parameters
      {
        sourceChannel: 0,
        targetChannel: 0,
        kernelRadius: 13,
        growthCenter: 0.12,
        growthWidth: 0.04,
        weight: 0.9,
        interactionType: "lenia",
      },
      // Symbiont survival - stable Lenia parameters
      {
        sourceChannel: 1,
        targetChannel: 1,
        kernelRadius: 13,
        growthCenter: 0.12,
        growthWidth: 0.04,
        weight: 0.9,
        interactionType: "lenia",
      },
      // Symbiont helps host (mutual benefit)
      {
        sourceChannel: 1,
        targetChannel: 0,
        kernelRadius: 15,
        growthCenter: 0.12,
        growthWidth: 0.04,
        weight: 0.3,
        interactionType: "symbiosis",
      },
      // Host helps symbiont (mutual benefit)
      {
        sourceChannel: 0,
        targetChannel: 1,
        kernelRadius: 15,
        growthCenter: 0.12,
        growthWidth: 0.04,
        weight: 0.3,
        interactionType: "symbiosis",
      },
    ],
  },

  // Creature with food source
  "creature-food": {
    channels: [
      {
        id: "creature",
        name: "Creature",
        role: "creature",
        color: [0, 200, 255],
        decayRate: 0,
        diffusionRate: 0,
        selfInteraction: true,
      },
      {
        id: "food",
        name: "Food",
        role: "food",
        color: [255, 200, 0],
        decayRate: 0,
        diffusionRate: 0.01,
        selfInteraction: true,
      },
    ],
    interactions: [
      // Creature self-interaction (survival) - stable Lenia parameters
      {
        sourceChannel: 0,
        targetChannel: 0,
        kernelRadius: 13,
        growthCenter: 0.12,
        growthWidth: 0.04,
        weight: 0.8,
        interactionType: "lenia",
      },
      // Food self-replenishes slowly
      {
        sourceChannel: 1,
        targetChannel: 1,
        kernelRadius: 13,
        growthCenter: 0.12,
        growthWidth: 0.04,
        weight: 0.3,
        interactionType: "lenia",
      },
      // Creature gains from food
      {
        sourceChannel: 1,
        targetChannel: 0,
        kernelRadius: 13,
        growthCenter: 0.12,
        growthWidth: 0.04,
        weight: 0.4,
        interactionType: "lenia",
      },
      // Creature consumes food
      {
        sourceChannel: 0,
        targetChannel: 1,
        kernelRadius: 10,
        growthCenter: 0.15,
        growthWidth: 0.05,
        weight: -0.25,
        interactionType: "predation",
      },
    ],
  },

  // Creature with pheromone trail
  pheromone: {
    channels: [
      {
        id: "creature",
        name: "Creature",
        role: "creature",
        color: [50, 200, 255],
        decayRate: 0,
        diffusionRate: 0,
        selfInteraction: true,
      },
      {
        id: "food",
        name: "Food",
        role: "food",
        color: [255, 200, 50],
        decayRate: 0,
        diffusionRate: 0.01,
        selfInteraction: true,
      },
      {
        id: "trail",
        name: "Trail",
        role: "pheromone",
        color: [150, 50, 255],
        decayRate: 0.01,
        diffusionRate: 0.03,
        selfInteraction: false,
      },
    ],
    interactions: [
      // Creature Lenia dynamics - stable parameters
      {
        sourceChannel: 0,
        targetChannel: 0,
        kernelRadius: 13,
        growthCenter: 0.12,
        growthWidth: 0.04,
        weight: 1.0,
        interactionType: "lenia",
      },
      // Food self-replenishes
      {
        sourceChannel: 1,
        targetChannel: 1,
        kernelRadius: 13,
        growthCenter: 0.12,
        growthWidth: 0.04,
        weight: 0.3,
        interactionType: "lenia",
      },
      // Creature gains from food
      {
        sourceChannel: 1,
        targetChannel: 0,
        kernelRadius: 15,
        growthCenter: 0.12,
        growthWidth: 0.04,
        weight: 0.2,
        interactionType: "symbiosis",
      },
      // Creature leaves trail (pheromone deposit)
      {
        sourceChannel: 0,
        targetChannel: 2,
        kernelRadius: 8,
        growthCenter: 0.15,
        growthWidth: 0.05,
        weight: 0.3,
        interactionType: "lenia",
      },
    ],
  },

  // Single channel (default Lenia)
  single: {
    channels: [
      {
        id: "main",
        name: "Main",
        role: "creature",
        color: [0, 255, 128],
        decayRate: 0,
        diffusionRate: 0,
        selfInteraction: true,
      },
    ],
    interactions: [
      // Stable Lenia parameters for blob initialization
      {
        sourceChannel: 0,
        targetChannel: 0,
        kernelRadius: 13,
        growthCenter: 0.12,
        growthWidth: 0.04,
        weight: 1.0,
        interactionType: "lenia",
      },
    ],
  },
};

/**
 * Generate colors for multi-channel display
 * Maps multiple channels to RGB based on their values
 */
export function channelsToRGB(
  channels: Float32Array[],
  configs: ChannelConfig[],
  width: number,
  height: number,
): Uint8ClampedArray {
  const rgba = new Uint8ClampedArray(width * height * 4);

  for (let i = 0; i < width * height; i++) {
    let r = 0,
      g = 0,
      b = 0;

    for (let c = 0; c < channels.length && c < configs.length; c++) {
      const value = channels[c][i];
      const color = configs[c].color;

      r += value * color[0];
      g += value * color[1];
      b += value * color[2];
    }

    rgba[i * 4 + 0] = Math.min(255, r);
    rgba[i * 4 + 1] = Math.min(255, g);
    rgba[i * 4 + 2] = Math.min(255, b);
    rgba[i * 4 + 3] = 255;
  }

  return rgba;
}
