/**
 * Ecosystem Presets
 *
 * Pre-configured ecosystem scenarios demonstrating different
 * ecological dynamics and patterns.
 */

import type { EcosystemConfig, LotkaVolterraParams } from "./types";

/**
 * Classic two-species predator-prey
 * Demonstrates oscillating population dynamics
 */
export const PREDATOR_PREY_CLASSIC: EcosystemConfig = {
  species: [
    {
      id: "prey",
      name: "Prey",
      role: "herbivore",
      color: [100, 255, 100],
      birthRate: 0.15,
      deathRate: 0.02,
      carryingCapacity: 1.0,
      diffusionRate: 0.02,
      metabolicRate: 0.01,
      starvationThreshold: 0.05,
    },
    {
      id: "predator",
      name: "Predator",
      role: "predator",
      color: [255, 80, 80],
      birthRate: 0.0, // Only gains from predation
      deathRate: 0.05,
      carryingCapacity: 0.5,
      diffusionRate: 0.03,
      metabolicRate: 0.02,
      starvationThreshold: 0.02,
    },
  ],
  interactions: [
    {
      predatorId: "predator",
      preyId: "prey",
      interactionType: "predation",
      attackRate: 0.3,
      handlingTime: 0.1,
      conversionEfficiency: 0.4,
      functionalResponse: "holling-ii",
      halfSaturation: 0.2,
    },
  ],
  resources: [
    {
      id: "grass",
      name: "Vegetation",
      color: [50, 150, 50],
      growthRate: 0.1,
      carryingCapacity: 1.0,
      diffusionRate: 0.02,
      baseProduction: 0.02,
      decayRate: 0.001,
    },
  ],
  environment: {
    gradientType: "none",
    gradientStrength: 0,
    gradientCenterX: 0.5,
    gradientCenterY: 0.5,
    seasonalAmplitude: 0,
    seasonalPeriod: 1000,
  },
  dt: 0.1,
  gridWidth: 512,
  gridHeight: 512,
};

/**
 * Three-level food chain
 * Plant → Herbivore → Predator
 */
export const THREE_LEVEL_CHAIN: EcosystemConfig = {
  species: [
    {
      id: "plant",
      name: "Plants",
      role: "producer",
      color: [50, 200, 50],
      birthRate: 0.2,
      deathRate: 0.01,
      carryingCapacity: 1.0,
      diffusionRate: 0.005,
      metabolicRate: 0,
      starvationThreshold: 0,
    },
    {
      id: "herbivore",
      name: "Herbivore",
      role: "herbivore",
      color: [100, 150, 255],
      birthRate: 0.1,
      deathRate: 0.03,
      carryingCapacity: 0.8,
      diffusionRate: 0.02,
      metabolicRate: 0.01,
      starvationThreshold: 0.03,
    },
    {
      id: "predator",
      name: "Apex Predator",
      role: "predator",
      color: [255, 80, 80],
      birthRate: 0,
      deathRate: 0.04,
      carryingCapacity: 0.4,
      diffusionRate: 0.03,
      metabolicRate: 0.02,
      starvationThreshold: 0.02,
    },
  ],
  interactions: [
    {
      predatorId: "herbivore",
      preyId: "plant",
      interactionType: "predation",
      attackRate: 0.25,
      handlingTime: 0.05,
      conversionEfficiency: 0.5,
      functionalResponse: "holling-ii",
    },
    {
      predatorId: "predator",
      preyId: "herbivore",
      interactionType: "predation",
      attackRate: 0.3,
      handlingTime: 0.1,
      conversionEfficiency: 0.35,
      functionalResponse: "holling-ii",
    },
  ],
  resources: [],
  environment: {
    gradientType: "patchy",
    gradientStrength: 0.4,
    gradientCenterX: 0.5,
    gradientCenterY: 0.5,
    seasonalAmplitude: 0,
    seasonalPeriod: 1000,
  },
  dt: 0.1,
  gridWidth: 512,
  gridHeight: 512,
};

/**
 * Competitive exclusion
 * Two species competing for the same resource
 */
export const COMPETITIVE_EXCLUSION: EcosystemConfig = {
  species: [
    {
      id: "species-a",
      name: "Species A",
      role: "herbivore",
      color: [50, 200, 255],
      birthRate: 0.12,
      deathRate: 0.02,
      carryingCapacity: 1.0,
      diffusionRate: 0.02,
      metabolicRate: 0.01,
      starvationThreshold: 0.05,
    },
    {
      id: "species-b",
      name: "Species B",
      role: "herbivore",
      color: [255, 200, 50],
      birthRate: 0.1,
      deathRate: 0.02,
      carryingCapacity: 1.0,
      diffusionRate: 0.02,
      metabolicRate: 0.01,
      starvationThreshold: 0.05,
    },
  ],
  interactions: [
    {
      predatorId: "species-a",
      preyId: "species-b",
      interactionType: "competition",
      attackRate: 0.1,
      handlingTime: 0,
      conversionEfficiency: 0,
      functionalResponse: "linear",
    },
    {
      predatorId: "species-b",
      preyId: "species-a",
      interactionType: "competition",
      attackRate: 0.1,
      handlingTime: 0,
      conversionEfficiency: 0,
      functionalResponse: "linear",
    },
  ],
  resources: [
    {
      id: "shared-resource",
      name: "Shared Resource",
      color: [100, 200, 100],
      growthRate: 0.15,
      carryingCapacity: 1.0,
      diffusionRate: 0.03,
      baseProduction: 0.03,
      decayRate: 0.002,
    },
  ],
  environment: {
    gradientType: "vertical",
    gradientStrength: 0.3,
    gradientCenterX: 0.5,
    gradientCenterY: 0.5,
    seasonalAmplitude: 0,
    seasonalPeriod: 1000,
  },
  dt: 0.1,
  gridWidth: 512,
  gridHeight: 512,
};

/**
 * Mutualistic symbiosis
 * Two species that benefit each other
 */
export const MUTUALISM: EcosystemConfig = {
  species: [
    {
      id: "host",
      name: "Host",
      role: "producer",
      color: [100, 200, 255],
      birthRate: 0.08,
      deathRate: 0.03,
      carryingCapacity: 0.8,
      diffusionRate: 0.01,
      metabolicRate: 0.01,
      starvationThreshold: 0.05,
    },
    {
      id: "symbiont",
      name: "Symbiont",
      role: "herbivore",
      color: [255, 200, 100],
      birthRate: 0.08,
      deathRate: 0.03,
      carryingCapacity: 0.8,
      diffusionRate: 0.01,
      metabolicRate: 0.01,
      starvationThreshold: 0.05,
    },
  ],
  interactions: [
    {
      predatorId: "host",
      preyId: "symbiont",
      interactionType: "mutualism",
      attackRate: 0.2,
      handlingTime: 0,
      conversionEfficiency: 0.3,
      functionalResponse: "linear",
    },
    {
      predatorId: "symbiont",
      preyId: "host",
      interactionType: "mutualism",
      attackRate: 0.2,
      handlingTime: 0,
      conversionEfficiency: 0.3,
      functionalResponse: "linear",
    },
  ],
  resources: [],
  environment: {
    gradientType: "radial",
    gradientStrength: 0.5,
    gradientCenterX: 0.5,
    gradientCenterY: 0.5,
    seasonalAmplitude: 0,
    seasonalPeriod: 1000,
  },
  dt: 0.1,
  gridWidth: 512,
  gridHeight: 512,
};

/**
 * Resource gradient ecosystem
 * Species distribution follows resource availability
 */
export const RESOURCE_GRADIENT: EcosystemConfig = {
  species: [
    {
      id: "grazer",
      name: "Grazer",
      role: "herbivore",
      color: [100, 255, 150],
      birthRate: 0.1,
      deathRate: 0.02,
      carryingCapacity: 1.0,
      diffusionRate: 0.03,
      metabolicRate: 0.015,
      starvationThreshold: 0.04,
    },
  ],
  interactions: [],
  resources: [
    {
      id: "nutrient",
      name: "Nutrients",
      color: [200, 200, 50],
      growthRate: 0.1,
      carryingCapacity: 1.0,
      diffusionRate: 0.02,
      baseProduction: 0.05,
      decayRate: 0.005,
    },
  ],
  environment: {
    gradientType: "horizontal",
    gradientStrength: 0.8,
    gradientCenterX: 0.5,
    gradientCenterY: 0.5,
    seasonalAmplitude: 0,
    seasonalPeriod: 1000,
  },
  dt: 0.1,
  gridWidth: 512,
  gridHeight: 512,
};

/**
 * Seasonal dynamics
 * Population fluctuates with seasonal resource availability
 */
export const SEASONAL_DYNAMICS: EcosystemConfig = {
  species: [
    {
      id: "seasonal-prey",
      name: "Prey",
      role: "herbivore",
      color: [100, 255, 100],
      birthRate: 0.15,
      deathRate: 0.02,
      carryingCapacity: 1.0,
      diffusionRate: 0.02,
      metabolicRate: 0.01,
      starvationThreshold: 0.05,
    },
    {
      id: "seasonal-predator",
      name: "Predator",
      role: "predator",
      color: [255, 100, 100],
      birthRate: 0,
      deathRate: 0.04,
      carryingCapacity: 0.5,
      diffusionRate: 0.03,
      metabolicRate: 0.02,
      starvationThreshold: 0.02,
    },
  ],
  interactions: [
    {
      predatorId: "seasonal-predator",
      preyId: "seasonal-prey",
      interactionType: "predation",
      attackRate: 0.25,
      handlingTime: 0.1,
      conversionEfficiency: 0.4,
      functionalResponse: "holling-ii",
    },
  ],
  resources: [
    {
      id: "seasonal-resource",
      name: "Food",
      color: [150, 200, 50],
      growthRate: 0.1,
      carryingCapacity: 1.0,
      diffusionRate: 0.02,
      baseProduction: 0.03,
      decayRate: 0.002,
    },
  ],
  environment: {
    gradientType: "none",
    gradientStrength: 0,
    gradientCenterX: 0.5,
    gradientCenterY: 0.5,
    seasonalAmplitude: 0.5,
    seasonalPeriod: 500,
  },
  dt: 0.1,
  gridWidth: 512,
  gridHeight: 512,
};

/**
 * All ecosystem presets
 */
export const ECOSYSTEM_PRESETS: Record<string, EcosystemConfig> = {
  "predator-prey": PREDATOR_PREY_CLASSIC,
  "food-chain": THREE_LEVEL_CHAIN,
  competition: COMPETITIVE_EXCLUSION,
  mutualism: MUTUALISM,
  "resource-gradient": RESOURCE_GRADIENT,
  seasonal: SEASONAL_DYNAMICS,
};

/**
 * Preset names for UI
 */
export const ECOSYSTEM_PRESET_NAMES: Record<string, string> = {
  "predator-prey": "Predator-Prey Oscillations",
  "food-chain": "Three-Level Food Chain",
  competition: "Competitive Exclusion",
  mutualism: "Mutualistic Symbiosis",
  "resource-gradient": "Resource Gradient",
  seasonal: "Seasonal Dynamics",
};

/**
 * Lotka-Volterra parameter presets for theoretical exploration
 */
export const LOTKA_VOLTERRA_PRESETS: Record<string, LotkaVolterraParams> = {
  // Classic oscillating dynamics
  classic: {
    preyGrowthRate: 0.1,
    preyCapacity: 0, // No carrying capacity (pure LV)
    predatorDeathRate: 0.05,
    predatorEfficiency: 0.4,
    predationRate: 0.3,
    handlingTime: 0,
    mutualInterference: 0,
  },

  // Stable coexistence with logistic prey
  stable: {
    preyGrowthRate: 0.1,
    preyCapacity: 1.0,
    predatorDeathRate: 0.05,
    predatorEfficiency: 0.4,
    predationRate: 0.3,
    handlingTime: 0.1,
    mutualInterference: 0,
  },

  // Limit cycles (paradox of enrichment)
  "limit-cycle": {
    preyGrowthRate: 0.15,
    preyCapacity: 2.0, // High carrying capacity
    predatorDeathRate: 0.03,
    predatorEfficiency: 0.5,
    predationRate: 0.4,
    handlingTime: 0.2,
    mutualInterference: 0,
  },

  // Stable with mutual interference
  "beddington-deangelis": {
    preyGrowthRate: 0.1,
    preyCapacity: 1.0,
    predatorDeathRate: 0.05,
    predatorEfficiency: 0.4,
    predationRate: 0.3,
    handlingTime: 0.1,
    mutualInterference: 0.5,
  },
};
