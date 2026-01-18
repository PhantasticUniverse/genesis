/**
 * Lenia Pattern Library
 * Preset organisms from Lenia research and discovery
 *
 * Based on organisms discovered by:
 * - Bert Chan (original Lenia)
 * - GENESIS discovery engine
 */

import type { LeniaGenome } from "../discovery/genome";

export interface LeniaOrganism {
  name: string;
  description: string;
  category:
    | "glider"
    | "oscillator"
    | "static"
    | "chaotic"
    | "swimmer"
    | "other";
  genome: LeniaGenome;
  speed?: number; // Approximate cells per step (for gliders)
  period?: number; // Oscillation period (for oscillators)
}

/**
 * Classic Lenia organisms discovered by Bert Chan
 */
export const CLASSIC_ORGANISMS: LeniaOrganism[] = [
  {
    name: "Orbium",
    description:
      "The iconic Lenia glider - a smooth oval shape that moves steadily",
    category: "glider",
    genome: {
      R: 13,
      T: 10,
      m: 0.15,
      s: 0.015,
      b: [1],
      kn: 1,
      gn: 1,
    },
    speed: 0.3,
  },
  {
    name: "Orbium Ring",
    description: "A ring-shaped variant of Orbium with stable movement",
    category: "glider",
    genome: {
      R: 15,
      T: 12,
      m: 0.14,
      s: 0.018,
      b: [1, 0.5],
      kn: 1,
      gn: 1,
    },
    speed: 0.25,
  },
  {
    name: "Geminium",
    description: "A twin-lobed organism that tumbles as it moves",
    category: "glider",
    genome: {
      R: 12,
      T: 10,
      m: 0.12,
      s: 0.012,
      b: [1, 0.6, 0.3],
      kn: 1,
      gn: 1,
    },
    speed: 0.15,
  },
  {
    name: "Scintillum",
    description: "A sparkling, rapidly oscillating pattern",
    category: "oscillator",
    genome: {
      R: 10,
      T: 8,
      m: 0.18,
      s: 0.022,
      b: [1],
      kn: 1,
      gn: 1,
    },
    period: 12,
  },
  {
    name: "Paterson",
    description: "A static, stable pattern with beautiful structure",
    category: "static",
    genome: {
      R: 20,
      T: 15,
      m: 0.135,
      s: 0.008,
      b: [1],
      kn: 2,
      gn: 1,
    },
  },
];

/**
 * SmoothLife-style organisms
 * Derived from SmoothLife birth/survival thresholds
 */
export const SMOOTHLIFE_ORGANISMS: LeniaOrganism[] = [
  {
    name: "SmoothGlider",
    description: "Classic SmoothLife glider pattern",
    category: "glider",
    genome: {
      R: 21,
      T: 10,
      m: 0.278,
      s: 0.064,
      b: [1, 0],
      kn: 2,
      gn: 1,
    },
    speed: 0.4,
  },
  {
    name: "SmoothBlob",
    description: "A stable, smooth blob that breathes",
    category: "oscillator",
    genome: {
      R: 17,
      T: 8,
      m: 0.32,
      s: 0.08,
      b: [1],
      kn: 2,
      gn: 1,
    },
    period: 24,
  },
];

/**
 * Novel organisms discovered by genetic algorithms
 */
export const DISCOVERED_ORGANISMS: LeniaOrganism[] = [
  {
    name: "Nova",
    description: "A rapidly spinning star shape",
    category: "oscillator",
    genome: {
      R: 14,
      T: 12,
      m: 0.16,
      s: 0.014,
      b: [0.8, 1, 0.6],
      kn: 1,
      gn: 1,
    },
    period: 8,
  },
  {
    name: "Cruiser",
    description: "A fast-moving elongated shape",
    category: "glider",
    genome: {
      R: 16,
      T: 14,
      m: 0.13,
      s: 0.011,
      b: [1, 0.8],
      kn: 1,
      gn: 1,
    },
    speed: 0.5,
  },
  {
    name: "Pulsar",
    description: "A pulsating circular pattern",
    category: "oscillator",
    genome: {
      R: 11,
      T: 6,
      m: 0.19,
      s: 0.025,
      b: [1, 0.3],
      kn: 1,
      gn: 1,
    },
    period: 16,
  },
  {
    name: "Drifter",
    description: "A slow, meandering pattern",
    category: "swimmer",
    genome: {
      R: 18,
      T: 10,
      m: 0.17,
      s: 0.02,
      b: [1, 0.9, 0.4],
      kn: 1,
      gn: 2,
    },
    speed: 0.1,
  },
  {
    name: "Helix",
    description: "A spiral pattern that rotates as it moves",
    category: "glider",
    genome: {
      R: 15,
      T: 11,
      m: 0.145,
      s: 0.016,
      b: [0.7, 1, 0.5],
      kn: 1,
      gn: 1,
    },
    speed: 0.2,
  },
];

/**
 * Optimized organisms from evolution experiments
 * These were discovered through genetic algorithm optimization
 */
export const OPTIMIZED_ORGANISMS: LeniaOrganism[] = [
  {
    name: "Evolved Alpha",
    description: "Single-kernel optimal configuration (fitness 0.5648)",
    category: "glider",
    genome: {
      R: 12,
      T: 11,
      m: 0.1055,
      s: 0.0257,
      b: [0.148, 0.335, 0.81],
      kn: 3, // staircase kernel
      gn: 1, // polynomial growth
    },
    speed: 0.25,
  },
  {
    name: "Evolved Stable",
    description: "Optimized stable pattern with gaussian growth",
    category: "static",
    genome: {
      R: 12,
      T: 10,
      m: 0.12,
      s: 0.04,
      b: [0.148, 0.335, 0.81],
      kn: 1, // polynomial kernel
      gn: 1, // gaussian growth
    },
  },
  {
    name: "Evolved Swimmer",
    description: "Fast-moving optimized organism",
    category: "swimmer",
    genome: {
      R: 14,
      T: 12,
      m: 0.11,
      s: 0.035,
      b: [0.2, 0.5, 0.8],
      kn: 1,
      gn: 1,
    },
    speed: 0.35,
  },
];

/**
 * Chaotic and complex patterns
 */
export const CHAOTIC_ORGANISMS: LeniaOrganism[] = [
  {
    name: "Primordial Soup",
    description: "Chaotic, ever-changing patterns with local stability",
    category: "chaotic",
    genome: {
      R: 8,
      T: 5,
      m: 0.22,
      s: 0.035,
      b: [1],
      kn: 1,
      gn: 1,
    },
  },
  {
    name: "Galaxy",
    description: "Large-scale swirling patterns",
    category: "chaotic",
    genome: {
      R: 25,
      T: 20,
      m: 0.125,
      s: 0.006,
      b: [1, 0.7, 0.3],
      kn: 2,
      gn: 1,
    },
  },
  {
    name: "Mitosis",
    description: "Patterns that split and recombine",
    category: "chaotic",
    genome: {
      R: 12,
      T: 8,
      m: 0.14,
      s: 0.019,
      b: [1, 0.9],
      kn: 1,
      gn: 1,
    },
  },
];

/**
 * All organisms combined
 */
export const ALL_ORGANISMS: LeniaOrganism[] = [
  ...CLASSIC_ORGANISMS,
  ...SMOOTHLIFE_ORGANISMS,
  ...DISCOVERED_ORGANISMS,
  ...OPTIMIZED_ORGANISMS,
  ...CHAOTIC_ORGANISMS,
];

/**
 * Get organism by name
 */
export function getOrganism(name: string): LeniaOrganism | undefined {
  return ALL_ORGANISMS.find(
    (org) => org.name.toLowerCase() === name.toLowerCase(),
  );
}

/**
 * Get organisms by category
 */
export function getOrganismsByCategory(
  category: LeniaOrganism["category"],
): LeniaOrganism[] {
  return ALL_ORGANISMS.filter((org) => org.category === category);
}

/**
 * Search organisms by description
 */
export function searchOrganisms(query: string): LeniaOrganism[] {
  const lowerQuery = query.toLowerCase();
  return ALL_ORGANISMS.filter(
    (org) =>
      org.name.toLowerCase().includes(lowerQuery) ||
      org.description.toLowerCase().includes(lowerQuery),
  );
}

/**
 * Convert organism to continuous CA params for the engine
 */
export function organismToParams(organism: LeniaOrganism) {
  return {
    kernelRadius: organism.genome.R,
    growthCenter: organism.genome.m,
    growthWidth: organism.genome.s,
    dt: 1 / organism.genome.T,
    growthType:
      organism.genome.gn === 1
        ? ("polynomial" as const)
        : ("exponential" as const),
  };
}

// Re-export reference organism utilities
export {
  REFERENCE_ORGANISMS,
  getOrganismByCode,
  getOrganismsByFamily,
  ORGANISM_FAMILIES,
} from "./reference-organisms";
export {
  importReferenceOrganism,
  decodeReferenceRLE,
} from "./organism-importer";
export type { ReferenceOrganism } from "./organism-importer";
