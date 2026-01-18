/**
 * Builtin Preset Collections
 * Curated presets for all simulation modes
 */

import type {
  PresetData,
  PresetMetadata,
  BehaviorDescriptors,
  DiscretePresetConfig,
  ContinuousPresetConfig,
  MultiKernelPresetConfig,
} from "./preset-types";
import { SENSORIMOTOR_PRESETS } from "./sensorimotor-presets";

// ============================================================================
// Helper Functions
// ============================================================================

function createMetadata(
  id: string,
  name: string,
  description: string,
  mode: PresetMetadata["mode"],
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
    mode,
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
// Discrete CA Presets (Game of Life and variants)
// ============================================================================

export const DISCRETE_PRESETS: PresetData[] = [
  // Classic Game of Life
  {
    metadata: createMetadata(
      "gol-classic",
      "Game of Life",
      "Conway's classic Game of Life - the most famous cellular automaton",
      "discrete",
      "classic",
      { chaotic: true },
      {
        tags: ["conway", "classic", "b3s23"],
        difficulty: 1,
        popularity: 1000,
        rating: 5.0,
      },
    ),
    config: {
      type: "discrete",
      rule: { birth: [3], survival: [2, 3], neighborhood: "moore", states: 2 },
      ruleString: "B3/S23",
    } as DiscretePresetConfig,
  },
  {
    metadata: createMetadata(
      "gol-highlife",
      "HighLife",
      "Life variant with replicators - features the famous Replicator pattern",
      "discrete",
      "replicator",
      { replicating: true, chaotic: true },
      {
        tags: ["replicator", "variant", "b36s23"],
        difficulty: 2,
        popularity: 500,
        rating: 4.5,
      },
    ),
    config: {
      type: "discrete",
      rule: {
        birth: [3, 6],
        survival: [2, 3],
        neighborhood: "moore",
        states: 2,
      },
      ruleString: "B36/S23",
    } as DiscretePresetConfig,
  },
  {
    metadata: createMetadata(
      "gol-seeds",
      "Seeds",
      "Explosive rule where all cells die - creates intricate patterns",
      "discrete",
      "chaotic",
      { chaotic: true, growing: true },
      { tags: ["explosive", "simple", "b2s"], difficulty: 1, popularity: 300 },
    ),
    config: {
      type: "discrete",
      rule: { birth: [2], survival: [], neighborhood: "moore", states: 2 },
      ruleString: "B2/S",
    } as DiscretePresetConfig,
  },
  {
    metadata: createMetadata(
      "gol-daynight",
      "Day & Night",
      "Symmetric rule where patterns and their complements behave identically",
      "discrete",
      "chaotic",
      { symmetric: true, chaotic: true },
      {
        tags: ["symmetric", "inverse", "b3678s34678"],
        difficulty: 2,
        popularity: 400,
      },
    ),
    config: {
      type: "discrete",
      rule: {
        birth: [3, 6, 7, 8],
        survival: [3, 4, 6, 7, 8],
        neighborhood: "moore",
        states: 2,
      },
      ruleString: "B3678/S34678",
    } as DiscretePresetConfig,
  },
  {
    metadata: createMetadata(
      "gol-maze",
      "Maze",
      "Creates beautiful maze-like structures from random initial conditions",
      "discrete",
      "still",
      { growing: true },
      {
        tags: ["maze", "structure", "b3s12345"],
        difficulty: 1,
        popularity: 350,
      },
    ),
    config: {
      type: "discrete",
      rule: {
        birth: [3],
        survival: [1, 2, 3, 4, 5],
        neighborhood: "moore",
        states: 2,
      },
      ruleString: "B3/S12345",
    } as DiscretePresetConfig,
  },
  {
    metadata: createMetadata(
      "gol-diamoeba",
      "Diamoeba",
      "Creates diamond-shaped growing structures",
      "discrete",
      "chaotic",
      { growing: true, chaotic: true },
      {
        tags: ["diamond", "amoeba", "b35678s5678"],
        difficulty: 2,
        popularity: 250,
      },
    ),
    config: {
      type: "discrete",
      rule: {
        birth: [3, 5, 6, 7, 8],
        survival: [5, 6, 7, 8],
        neighborhood: "moore",
        states: 2,
      },
      ruleString: "B35678/S5678",
    } as DiscretePresetConfig,
  },
  {
    metadata: createMetadata(
      "gol-replicator",
      "Replicator",
      "Every pattern replicates - creates complex fractal-like structures",
      "discrete",
      "replicator",
      { replicating: true, growing: true },
      {
        tags: ["replicator", "fractal", "b1357s1357"],
        difficulty: 3,
        popularity: 450,
      },
    ),
    config: {
      type: "discrete",
      rule: {
        birth: [1, 3, 5, 7],
        survival: [1, 3, 5, 7],
        neighborhood: "moore",
        states: 2,
      },
      ruleString: "B1357/S1357",
    } as DiscretePresetConfig,
  },
  {
    metadata: createMetadata(
      "gol-coral",
      "Coral",
      "Grows coral-like branching structures",
      "discrete",
      "still",
      { growing: true },
      {
        tags: ["coral", "organic", "b3s45678"],
        difficulty: 1,
        popularity: 200,
      },
    ),
    config: {
      type: "discrete",
      rule: {
        birth: [3],
        survival: [4, 5, 6, 7, 8],
        neighborhood: "moore",
        states: 2,
      },
      ruleString: "B3/S45678",
    } as DiscretePresetConfig,
  },
  {
    metadata: createMetadata(
      "gol-anneal",
      "Anneal",
      "Simulates crystallization and annealing processes",
      "discrete",
      "chaotic",
      { chaotic: true },
      {
        tags: ["crystal", "anneal", "b4678s35678"],
        difficulty: 2,
        popularity: 180,
      },
    ),
    config: {
      type: "discrete",
      rule: {
        birth: [4, 6, 7, 8],
        survival: [3, 5, 6, 7, 8],
        neighborhood: "moore",
        states: 2,
      },
      ruleString: "B4678/S35678",
    } as DiscretePresetConfig,
  },
  {
    metadata: createMetadata(
      "gol-morley",
      "Morley",
      "Complex rule with interesting emergent behavior",
      "discrete",
      "chaotic",
      { chaotic: true },
      {
        tags: ["morley", "complex", "b368s245"],
        difficulty: 3,
        popularity: 150,
      },
    ),
    config: {
      type: "discrete",
      rule: {
        birth: [3, 6, 8],
        survival: [2, 4, 5],
        neighborhood: "moore",
        states: 2,
      },
      ruleString: "B368/S245",
    } as DiscretePresetConfig,
  },
];

// ============================================================================
// Continuous (Single-Kernel Lenia) Presets
// ============================================================================

export const CONTINUOUS_PRESETS: PresetData[] = [
  // Orbium - The classic spherical glider
  {
    metadata: createMetadata(
      "lenia-orbium",
      "Orbium",
      "Classic spherical Lenia creature - stable glider with smooth motion",
      "continuous",
      "glider",
      { mobile: true, symmetric: true },
      {
        author: "Bert Chan",
        tags: ["classic", "glider", "sphere", "stable"],
        difficulty: 2,
        popularity: 800,
        rating: 5.0,
      },
    ),
    config: {
      type: "continuous",
      kernel: { shape: "polynomial", radius: 13, peaks: [0.5] },
      growth: { type: "gaussian", mu: 0.15, sigma: 0.015 },
      dt: 0.1,
      boundaryMode: "periodic",
    } as ContinuousPresetConfig,
  },
  {
    metadata: createMetadata(
      "lenia-geminium",
      "Geminium",
      "Twin-lobed organism that oscillates while moving",
      "continuous",
      "glider",
      { mobile: true, oscillating: true },
      {
        author: "Bert Chan",
        tags: ["twin", "oscillating", "glider"],
        difficulty: 3,
        popularity: 600,
        rating: 4.8,
      },
    ),
    config: {
      type: "continuous",
      kernel: { shape: "polynomial", radius: 13, peaks: [0.5] },
      growth: { type: "gaussian", mu: 0.14, sigma: 0.014 },
      dt: 0.1,
      boundaryMode: "periodic",
    } as ContinuousPresetConfig,
  },
  {
    metadata: createMetadata(
      "lenia-scutium",
      "Scutium",
      "Shield-shaped oscillator with stable periodic behavior",
      "continuous",
      "oscillator",
      { oscillating: true, symmetric: true },
      {
        author: "Bert Chan",
        tags: ["oscillator", "shield", "stable"],
        difficulty: 2,
        popularity: 400,
        rating: 4.5,
      },
    ),
    config: {
      type: "continuous",
      kernel: { shape: "polynomial", radius: 13, peaks: [0.5] },
      growth: { type: "gaussian", mu: 0.12, sigma: 0.012 },
      dt: 0.1,
      boundaryMode: "periodic",
    } as ContinuousPresetConfig,
  },
  {
    metadata: createMetadata(
      "lenia-hydrogeminium",
      "Hydrogeminium",
      "Water-like flowing organism with complex dynamics",
      "continuous",
      "chaotic",
      { chaotic: true, mobile: true },
      {
        author: "Bert Chan",
        tags: ["water", "flowing", "complex"],
        difficulty: 4,
        popularity: 350,
        rating: 4.6,
      },
    ),
    config: {
      type: "continuous",
      kernel: { shape: "gaussian", radius: 15, peaks: [0.5] },
      growth: { type: "gaussian", mu: 0.11, sigma: 0.013 },
      dt: 0.1,
      boundaryMode: "periodic",
    } as ContinuousPresetConfig,
  },
  {
    metadata: createMetadata(
      "lenia-paraptera",
      "Paraptera",
      "Wing-shaped fast-moving glider",
      "continuous",
      "spaceship",
      { mobile: true },
      {
        author: "Bert Chan",
        tags: ["wing", "fast", "spaceship"],
        difficulty: 3,
        popularity: 300,
        rating: 4.4,
      },
    ),
    config: {
      type: "continuous",
      kernel: { shape: "polynomial", radius: 11, peaks: [0.4] },
      growth: { type: "gaussian", mu: 0.16, sigma: 0.016 },
      dt: 0.1,
      boundaryMode: "periodic",
    } as ContinuousPresetConfig,
  },
  {
    metadata: createMetadata(
      "lenia-synorbium",
      "Synorbium",
      "Synchronized pair of orbium-like creatures",
      "continuous",
      "glider",
      { mobile: true, symmetric: true, interacting: true },
      {
        tags: ["pair", "synchronized", "glider"],
        difficulty: 4,
        popularity: 280,
        rating: 4.3,
      },
    ),
    config: {
      type: "continuous",
      kernel: { shape: "polynomial", radius: 12, peaks: [0.45, 0.8] },
      growth: { type: "gaussian", mu: 0.135, sigma: 0.014 },
      dt: 0.1,
      boundaryMode: "periodic",
    } as ContinuousPresetConfig,
  },
  {
    metadata: createMetadata(
      "smoothlife",
      "SmoothLife",
      "Smooth version of Game of Life with continuous states",
      "continuous",
      "chaotic",
      { chaotic: true },
      {
        tags: ["smoothlife", "continuous", "life"],
        difficulty: 2,
        popularity: 450,
        rating: 4.2,
      },
    ),
    config: {
      type: "continuous",
      kernel: { shape: "step", radius: 10, peaks: [0.5] },
      growth: { type: "gaussian", mu: 0.5, sigma: 0.15 },
      dt: 0.1,
      boundaryMode: "periodic",
    } as ContinuousPresetConfig,
  },
  {
    metadata: createMetadata(
      "lenia-ring",
      "Ring Life",
      "Ring-kernel creates expanding ring patterns",
      "continuous",
      "chaotic",
      { growing: true },
      {
        tags: ["ring", "expansion", "waves"],
        difficulty: 2,
        popularity: 200,
        rating: 4.0,
      },
    ),
    config: {
      type: "continuous",
      kernel: { shape: "ring", radius: 15, peaks: [0.5] },
      growth: { type: "gaussian", mu: 0.2, sigma: 0.05 },
      dt: 0.1,
      boundaryMode: "periodic",
    } as ContinuousPresetConfig,
  },
];

// ============================================================================
// Multi-Kernel Lenia Presets
// ============================================================================

export const MULTIKERNEL_PRESETS: PresetData[] = [
  {
    metadata: createMetadata(
      "mk-dualkernelglider",
      "Dual-Kernel Glider",
      "Glider using two complementary kernels for stability",
      "multikernel",
      "glider",
      { mobile: true, symmetric: true },
      {
        tags: ["dual", "glider", "stable"],
        difficulty: 3,
        popularity: 300,
        rating: 4.5,
      },
    ),
    config: {
      type: "multikernel",
      kernels: [
        { shape: "polynomial", radius: 13, peaks: [0.5], weight: 0.6 },
        { shape: "gaussian", radius: 10, peaks: [0.5], weight: 0.4 },
      ],
      growthParams: [
        { type: "gaussian", mu: 0.15, sigma: 0.015 },
        { type: "gaussian", mu: 0.12, sigma: 0.012 },
      ],
      combinationMode: "weighted",
      dt: 0.1,
    } as MultiKernelPresetConfig,
  },
  {
    metadata: createMetadata(
      "mk-tripleoscillator",
      "Triple Oscillator",
      "Complex oscillator using three interacting kernels",
      "multikernel",
      "oscillator",
      { oscillating: true },
      {
        tags: ["triple", "oscillator", "complex"],
        difficulty: 4,
        popularity: 200,
        rating: 4.3,
      },
    ),
    config: {
      type: "multikernel",
      kernels: [
        { shape: "polynomial", radius: 12, peaks: [0.5], weight: 0.4 },
        { shape: "ring", radius: 15, peaks: [0.5], weight: 0.3 },
        { shape: "gaussian", radius: 8, peaks: [0.5], weight: 0.3 },
      ],
      growthParams: [
        { type: "gaussian", mu: 0.14, sigma: 0.014 },
        { type: "gaussian", mu: 0.18, sigma: 0.018 },
        { type: "gaussian", mu: 0.1, sigma: 0.01 },
      ],
      combinationMode: "weighted",
      dt: 0.1,
    } as MultiKernelPresetConfig,
  },
  {
    metadata: createMetadata(
      "mk-quadcomplex",
      "Quad Complex",
      "Four-kernel configuration for emergent complexity",
      "multikernel",
      "chaotic",
      { chaotic: true },
      {
        tags: ["quad", "complex", "emergent"],
        difficulty: 5,
        popularity: 150,
        rating: 4.6,
      },
    ),
    config: {
      type: "multikernel",
      kernels: [
        { shape: "polynomial", radius: 13, peaks: [0.5], weight: 0.3 },
        { shape: "gaussian", radius: 10, peaks: [0.4], weight: 0.25 },
        { shape: "ring", radius: 18, peaks: [0.6], weight: 0.25 },
        { shape: "polynomial", radius: 8, peaks: [0.3, 0.7], weight: 0.2 },
      ],
      growthParams: [
        { type: "gaussian", mu: 0.15, sigma: 0.015 },
        { type: "gaussian", mu: 0.12, sigma: 0.012 },
        { type: "gaussian", mu: 0.2, sigma: 0.02 },
        { type: "gaussian", mu: 0.08, sigma: 0.008 },
      ],
      combinationMode: "weighted",
      dt: 0.08,
    } as MultiKernelPresetConfig,
  },
  {
    metadata: createMetadata(
      "mk-softrobust",
      "Soft Robust",
      "Dual-kernel design optimized for robust, soft-edged organisms",
      "multikernel",
      "glider",
      { mobile: true },
      {
        tags: ["soft", "robust", "dual"],
        difficulty: 3,
        popularity: 180,
        rating: 4.2,
      },
    ),
    config: {
      type: "multikernel",
      kernels: [
        { shape: "gaussian", radius: 14, peaks: [0.5], weight: 0.5 },
        { shape: "gaussian", radius: 9, peaks: [0.5], weight: 0.5 },
      ],
      growthParams: [
        { type: "gaussian", mu: 0.13, sigma: 0.013 },
        { type: "gaussian", mu: 0.11, sigma: 0.011 },
      ],
      combinationMode: "average",
      dt: 0.1,
    } as MultiKernelPresetConfig,
  },
];

// ============================================================================
// All Builtin Presets
// ============================================================================

export const ALL_BUILTIN_PRESETS: PresetData[] = [
  ...DISCRETE_PRESETS,
  ...CONTINUOUS_PRESETS,
  ...MULTIKERNEL_PRESETS,
  ...SENSORIMOTOR_PRESETS,
];

/**
 * Get all builtin presets
 */
export function getBuiltinPresets(): PresetData[] {
  return ALL_BUILTIN_PRESETS;
}

/**
 * Get presets by mode
 */
export function getPresetsByMode(
  mode: PresetData["metadata"]["mode"],
): PresetData[] {
  return ALL_BUILTIN_PRESETS.filter((p) => p.metadata.mode === mode);
}

/**
 * Get preset by ID
 */
export function getPresetById(id: string): PresetData | undefined {
  return ALL_BUILTIN_PRESETS.find((p) => p.metadata.id === id);
}
