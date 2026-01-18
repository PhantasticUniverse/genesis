/**
 * Unified Preset Type Definitions
 * Type-safe preset definitions for all simulation modes
 */

import type {
  KernelShape,
  GrowthFunction,
  DiscreteRule,
} from "../../core/types";
import type { LeniaGenome } from "../../discovery/genome";

// ============================================================================
// Preset Mode Types
// ============================================================================

export type PresetMode =
  | "discrete" // Game of Life and other discrete CAs
  | "continuous" // Single-kernel Lenia
  | "multikernel" // Multi-kernel Lenia
  | "3d" // 3D Lenia
  | "particle" // Particle-Lenia hybrid
  | "ecology"; // Multi-channel ecosystem

export type PresetCategory =
  | "glider" // Moving patterns
  | "oscillator" // Periodic patterns
  | "still" // Static patterns
  | "chaotic" // Unpredictable patterns
  | "replicator" // Self-replicating patterns
  | "ecosystem" // Multi-species patterns
  | "gun" // Pattern-generating patterns
  | "spaceship" // Fast-moving patterns
  | "classic" // Historical/famous patterns
  | "experimental"; // User-created or experimental

export type DifficultyLevel = 1 | 2 | 3 | 4 | 5;

// ============================================================================
// Preset Metadata
// ============================================================================

/**
 * Common metadata for all presets
 */
export interface PresetMetadata {
  id: string; // Unique identifier
  name: string; // Display name
  description: string; // What it does
  author: string; // Creator
  version: string; // Preset version
  createdAt: number; // Timestamp
  updatedAt: number; // Last modified

  // Classification
  mode: PresetMode; // Simulation mode
  category: PresetCategory; // Pattern category
  tags: string[]; // Searchable tags
  difficulty: DifficultyLevel; // Complexity rating (1-5)

  // Behavior descriptors
  behavior: BehaviorDescriptors;

  // Visual
  thumbnail?: string; // Base64 preview image
  previewGif?: string; // Animated preview
  colorScheme?: string; // Recommended colormap

  // Stats (computed)
  popularity: number; // Usage count
  rating: number; // User rating (1-5)
  verified: boolean; // Staff-verified
}

/**
 * Behavior descriptors for classification
 */
export interface BehaviorDescriptors {
  mobile: boolean; // Does it move?
  oscillating: boolean; // Does it oscillate?
  replicating: boolean; // Does it replicate?
  growing: boolean; // Does it grow?
  chaotic: boolean; // Is it chaotic?
  symmetric: boolean; // Has symmetry?
  interacting: boolean; // Multi-species interaction?
}

// ============================================================================
// Mode-Specific Preset Configurations
// ============================================================================

/**
 * Discrete CA preset (Game of Life, etc.)
 */
export interface DiscretePresetConfig {
  type: "discrete";
  rule: DiscreteRule;
  ruleString?: string; // e.g., "B3/S23"
  wolfram?: number; // Wolfram code if applicable
}

/**
 * Continuous CA preset (Single-kernel Lenia)
 */
export interface ContinuousPresetConfig {
  type: "continuous";
  kernel: {
    shape: KernelShape;
    radius: number;
    peaks: number[];
    customFunction?: string; // WGSL snippet for custom
  };
  growth: {
    type: GrowthFunction;
    mu: number;
    sigma: number;
  };
  dt: number;
  boundaryMode: "periodic" | "clamped" | "reflected" | "zero";
}

/**
 * Multi-kernel preset
 */
export interface MultiKernelPresetConfig {
  type: "multikernel";
  kernels: Array<{
    shape: KernelShape;
    radius: number;
    peaks: number[];
    weight: number;
  }>;
  growthParams: Array<{
    type: GrowthFunction;
    mu: number;
    sigma: number;
  }>;
  combinationMode: "sum" | "average" | "weighted";
  dt: number;
}

/**
 * 3D Lenia preset
 */
export interface Preset3DConfig {
  type: "3d";
  params: {
    resolution: number;
    R: number;
    T: number;
    mu: number;
    sigma: number;
    dt: number;
    kernelType: "gaussian" | "polynomial" | "ring";
  };
  initialShape: "sphere" | "ellipsoid" | "torus" | "custom";
  shapeParams?: Record<string, number>;
}

/**
 * Particle preset
 */
export interface ParticlePresetConfig {
  type: "particle";
  config: {
    maxParticles: number;
    numTypes: number;
    friction: number;
    dt: number;
    wrapBoundaries: boolean;
  };
  interactionMatrix: number[][];
  fieldCoupling: {
    depositEnabled: boolean;
    depositAmount: number;
    depositRadius: number;
    gradientResponseEnabled: boolean;
    gradientStrength: number;
  };
  spawnPattern: "random" | "grid" | "clusters" | "ring";
  spawnCount: number;
}

/**
 * Ecology preset (multi-channel)
 */
export interface EcologyPresetConfig {
  type: "ecology";
  channels: Array<{
    name: string;
    color: [number, number, number];
    kernel: {
      shape: KernelShape;
      radius: number;
      peaks: number[];
    };
    growth: {
      mu: number;
      sigma: number;
    };
  }>;
  interactions: Array<{
    source: number;
    target: number;
    type: "predation" | "competition" | "symbiosis" | "neutral";
    strength: number;
  }>;
  resources?: {
    diffusionRate: number;
    decayRate: number;
    productionRate: number;
  };
  initialDistribution: "random" | "separated" | "mixed" | "custom";
}

/**
 * Union type for all preset configs
 */
export type PresetConfig =
  | DiscretePresetConfig
  | ContinuousPresetConfig
  | MultiKernelPresetConfig
  | Preset3DConfig
  | ParticlePresetConfig
  | EcologyPresetConfig;

// ============================================================================
// Pattern Encoding
// ============================================================================

/**
 * Pattern data format
 */
export interface PatternData {
  format: "rle" | "cells" | "base64" | "generator";
  width: number;
  height: number;
  depth?: number; // For 3D patterns

  // RLE format (compact, classic)
  rle?: string; // e.g., "3o$o2bo$3o!"

  // Cell list (sparse)
  cells?: Array<{ x: number; y: number; z?: number; value: number }>;

  // Base64 (dense, compressed)
  base64?: string; // Compressed Float32Array
  compression?: "none" | "gzip" | "lz4";

  // Generator function (procedural)
  generator?: {
    type: "gaussian-blob" | "ring" | "noise" | "custom";
    params: Record<string, number>;
    seed?: number;
  };
}

// ============================================================================
// Complete Preset Data
// ============================================================================

/**
 * Complete preset data combining metadata and configuration
 */
export interface PresetData {
  metadata: PresetMetadata;
  config: PresetConfig;
  initialPattern?: PatternData; // Optional initial state
  genome?: LeniaGenome; // Optional genome representation
}

// ============================================================================
// User Preset Management
// ============================================================================

/**
 * User preset collection
 */
export interface PresetCollection {
  id: string;
  name: string;
  description: string;
  presetIds: string[];
  isPublic: boolean;
  createdAt: number;
  updatedAt: number;
}

/**
 * User preset storage interface
 */
export interface UserPresetStore {
  userPresets: PresetData[]; // User-created
  favorites: string[]; // Preset IDs
  recent: string[]; // Recently used
  collections: PresetCollection[];
}

// ============================================================================
// Import/Export Format
// ============================================================================

/**
 * Genesis Preset File format (.gpreset)
 */
export interface GenesisPresetFile {
  version: "1.0";
  type: "preset" | "collection" | "organism-zoo";
  presets: PresetData[];
  metadata: {
    exportedAt: number;
    exportedBy: string;
    genesisVersion: string;
  };
}

/**
 * Import result
 */
export interface ImportResult {
  success: boolean;
  imported: number;
  skipped: number;
  errors: string[];
  presetIds: string[];
}

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

// ============================================================================
// Preset Query Options
// ============================================================================

/**
 * Options for querying presets
 */
export interface PresetQueryOptions {
  mode?: PresetMode;
  category?: PresetCategory;
  tags?: string[];
  minDifficulty?: DifficultyLevel;
  maxDifficulty?: DifficultyLevel;
  behavior?: Partial<BehaviorDescriptors>;
  verified?: boolean;
  limit?: number;
  offset?: number;
  sortBy?: "name" | "popularity" | "rating" | "createdAt" | "updatedAt";
  sortOrder?: "asc" | "desc";
  search?: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create default metadata for a new preset
 */
export function createDefaultMetadata(
  name: string,
  mode: PresetMode,
  category: PresetCategory,
  author = "User",
): PresetMetadata {
  const now = Date.now();
  return {
    id: `preset_${now}_${Math.random().toString(36).slice(2, 9)}`,
    name,
    description: "",
    author,
    version: "1.0",
    createdAt: now,
    updatedAt: now,
    mode,
    category,
    tags: [],
    difficulty: 3,
    behavior: {
      mobile: false,
      oscillating: false,
      replicating: false,
      growing: false,
      chaotic: false,
      symmetric: false,
      interacting: false,
    },
    popularity: 0,
    rating: 0,
    verified: false,
  };
}

/**
 * Create default behavior descriptors
 */
export function createDefaultBehavior(): BehaviorDescriptors {
  return {
    mobile: false,
    oscillating: false,
    replicating: false,
    growing: false,
    chaotic: false,
    symmetric: false,
    interacting: false,
  };
}

/**
 * Validate a preset configuration
 */
export function validatePresetConfig(config: PresetConfig): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  switch (config.type) {
    case "discrete":
      if (!config.rule) {
        errors.push("Discrete preset missing rule");
      }
      break;

    case "continuous":
      if (!config.kernel) {
        errors.push("Continuous preset missing kernel");
      }
      if (config.kernel?.radius < 3 || config.kernel?.radius > 50) {
        warnings.push("Kernel radius outside recommended range (3-50)");
      }
      if (!config.growth) {
        errors.push("Continuous preset missing growth parameters");
      }
      break;

    case "multikernel":
      if (!config.kernels || config.kernels.length === 0) {
        errors.push("Multi-kernel preset must have at least one kernel");
      }
      if (config.kernels?.length > 4) {
        errors.push("Multi-kernel preset cannot exceed 4 kernels");
      }
      break;

    case "3d":
      if (!config.params) {
        errors.push("3D preset missing parameters");
      }
      break;

    case "particle":
      if (!config.config) {
        errors.push("Particle preset missing config");
      }
      break;

    case "ecology":
      if (!config.channels || config.channels.length === 0) {
        errors.push("Ecology preset must have at least one channel");
      }
      if (config.channels?.length > 4) {
        errors.push("Ecology preset cannot exceed 4 channels");
      }
      break;

    default:
      errors.push(`Unknown preset type: ${(config as PresetConfig).type}`);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Get display name for preset mode
 */
export function getModeDisplayName(mode: PresetMode): string {
  const names: Record<PresetMode, string> = {
    discrete: "Discrete CA",
    continuous: "Lenia",
    multikernel: "Multi-Kernel Lenia",
    "3d": "3D Lenia",
    particle: "Particle-Lenia",
    ecology: "Ecosystem",
  };
  return names[mode];
}

/**
 * Get display name for category
 */
export function getCategoryDisplayName(category: PresetCategory): string {
  const names: Record<PresetCategory, string> = {
    glider: "Gliders",
    oscillator: "Oscillators",
    still: "Still Life",
    chaotic: "Chaotic",
    replicator: "Replicators",
    ecosystem: "Ecosystems",
    gun: "Guns",
    spaceship: "Spaceships",
    classic: "Classic",
    experimental: "Experimental",
  };
  return names[category];
}
