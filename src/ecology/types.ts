/**
 * Ecology Types
 * Type definitions for ecosystem simulation
 */

/**
 * Species role in the ecosystem
 */
export type SpeciesRole =
  | "producer" // Plants/autotrophs - create resources
  | "herbivore" // Primary consumers - eat producers
  | "predator" // Secondary consumers - eat herbivores
  | "decomposer" // Break down dead matter
  | "omnivore"; // Eat multiple trophic levels

/**
 * Interaction type between species
 */
export type InteractionType =
  | "predation" // One species consumes another
  | "competition" // Species compete for resources
  | "mutualism" // Both species benefit
  | "parasitism" // One benefits, other harmed
  | "commensalism"; // One benefits, other unaffected

/**
 * Functional response type (how consumption rate changes with prey density)
 */
export type FunctionalResponseType =
  | "linear" // Type I: consumption proportional to prey density
  | "holling-ii" // Type II: saturating response (most common)
  | "holling-iii"; // Type III: sigmoidal (prey switching)

/**
 * Environmental gradient type
 */
export type GradientType =
  | "none" // Uniform environment
  | "radial" // Circular gradient from center
  | "vertical" // Top-to-bottom gradient
  | "horizontal" // Left-to-right gradient
  | "patchy"; // Random patches of high/low productivity

/**
 * Species definition
 */
export interface Species {
  id: string;
  name: string;
  role: SpeciesRole;
  color: [number, number, number];

  // Demographics
  birthRate: number; // Intrinsic growth rate (r)
  deathRate: number; // Natural mortality rate
  carryingCapacity: number; // Maximum population (K)

  // Movement
  diffusionRate: number; // Spatial spread

  // Resource requirements
  metabolicRate: number; // Energy consumption per timestep
  starvationThreshold: number; // Below this resource, start dying
}

/**
 * Interaction between two species
 */
export interface SpeciesInteraction {
  predatorId: string;
  preyId: string;
  interactionType: InteractionType;

  // Attack parameters
  attackRate: number; // Base predation rate (a)
  handlingTime: number; // Time to process prey (h)
  conversionEfficiency: number; // Energy conversion (e)

  // Functional response
  functionalResponse: FunctionalResponseType;
  halfSaturation?: number; // For Holling responses
}

/**
 * Resource (abiotic) definition
 */
export interface Resource {
  id: string;
  name: string;
  color: [number, number, number];

  // Dynamics
  growthRate: number; // Regeneration rate
  carryingCapacity: number; // Maximum density
  diffusionRate: number; // Spatial spread
  baseProduction: number; // Constant input rate

  // Decay
  decayRate: number; // Natural decay
}

/**
 * Environment configuration
 */
export interface EnvironmentConfig {
  gradientType: GradientType;
  gradientStrength: number; // 0-1
  gradientCenterX: number; // 0-1
  gradientCenterY: number; // 0-1

  // Seasonal variation (optional)
  seasonalAmplitude: number; // 0-1
  seasonalPeriod: number; // Steps per cycle
}

/**
 * Complete ecosystem configuration
 */
export interface EcosystemConfig {
  species: Species[];
  interactions: SpeciesInteraction[];
  resources: Resource[];
  environment: EnvironmentConfig;

  // Simulation parameters
  dt: number;
  gridWidth: number;
  gridHeight: number;
}

/**
 * Population statistics for a single species
 */
export interface PopulationStats {
  speciesId: string;
  totalMass: number;
  meanDensity: number;
  maxDensity: number;
  occupiedCells: number;
  centroidX: number;
  centroidY: number;
  spreadRadius: number;
}

/**
 * Ecosystem state at a point in time
 */
export interface EcosystemState {
  step: number;
  timestamp: number;
  populations: PopulationStats[];
  totalBiomass: number;
  diversity: number; // Shannon diversity index
  stability: number; // Coefficient of variation
}

/**
 * Time series data for plotting
 */
export interface PopulationTimeSeries {
  speciesId: string;
  steps: number[];
  populations: number[];
  means: number[]; // Rolling average
}

/**
 * Phase space point for predator-prey plots
 */
export interface PhasePoint {
  step: number;
  preyDensity: number;
  predatorDensity: number;
}

/**
 * Lotka-Volterra parameters (classic model)
 */
export interface LotkaVolterraParams {
  // Prey parameters
  preyGrowthRate: number; // α: intrinsic growth
  preyCapacity: number; // K: carrying capacity (0 for unlimited)

  // Predator parameters
  predatorDeathRate: number; // γ: natural death rate
  predatorEfficiency: number; // δ: conversion efficiency

  // Interaction
  predationRate: number; // β: attack rate

  // Extensions
  handlingTime: number; // For Holling Type II
  mutualInterference: number; // Beddington-DeAngelis
}

/**
 * Rosenzweig-MacArthur parameters (more realistic)
 */
export interface RosenzweigMacArthurParams extends LotkaVolterraParams {
  halfSaturation: number; // Holling Type II half-saturation
  predatorIntracompetition: number;
}

/**
 * Food web node
 */
export interface FoodWebNode {
  speciesId: string;
  trophicLevel: number; // 1 = producer, 2 = herbivore, etc.
  preyIds: string[];
  predatorIds: string[];
}

/**
 * Food web analysis
 */
export interface FoodWebAnalysis {
  nodes: FoodWebNode[];
  connectance: number; // Links / possible links
  meanPathLength: number; // Average chain length
  maxTrophicLevel: number;
  basalSpecies: string[]; // No prey
  topPredators: string[]; // No predators
}

/**
 * Ecosystem health metrics
 */
export interface EcosystemHealth {
  biodiversity: number; // Species richness
  evenness: number; // Population evenness
  productivity: number; // Total biomass production
  resilience: number; // Recovery from perturbation
  stability: number; // Temporal variability
}

// ============================================================================
// Default configurations
// ============================================================================

export const DEFAULT_ENVIRONMENT: EnvironmentConfig = {
  gradientType: "none",
  gradientStrength: 0.5,
  gradientCenterX: 0.5,
  gradientCenterY: 0.5,
  seasonalAmplitude: 0,
  seasonalPeriod: 1000,
};

export const DEFAULT_LOTKA_VOLTERRA: LotkaVolterraParams = {
  preyGrowthRate: 0.1,
  preyCapacity: 1.0,
  predatorDeathRate: 0.05,
  predatorEfficiency: 0.4,
  predationRate: 0.3,
  handlingTime: 0.1,
  mutualInterference: 0,
};

export const DEFAULT_RESOURCE: Resource = {
  id: "resource-0",
  name: "Nutrients",
  color: [100, 200, 50],
  growthRate: 0.05,
  carryingCapacity: 1.0,
  diffusionRate: 0.02,
  baseProduction: 0.01,
  decayRate: 0.001,
};

export const DEFAULT_SPECIES: Species = {
  id: "species-0",
  name: "Organism",
  role: "herbivore",
  color: [50, 200, 255],
  birthRate: 0.1,
  deathRate: 0.02,
  carryingCapacity: 1.0,
  diffusionRate: 0.01,
  metabolicRate: 0.01,
  starvationThreshold: 0.05,
};
