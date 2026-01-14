/**
 * 3D Lenia Pattern Library
 * Preset 3D organisms for volumetric cellular automata
 *
 * Based on research from:
 * - Bert Chan's LeniaNDK (3D/4D Lenia extensions)
 * - 3D artificial life experiments
 */

import type { Organism3D, Grid3DConfig, Lenia3DParams, Kernel3DConfig } from '../core/types-3d';
import { DEFAULT_GRID_3D_CONFIG } from '../core/types-3d';

export type Organism3DCategory = 'sphere' | 'glider' | 'oscillator' | 'static' | 'chaotic' | 'experimental';

export interface Organism3DPreset {
  name: string;
  description: string;
  category: Organism3DCategory;
  params: Lenia3DParams;
  kernel: Kernel3DConfig;
  /** Function to generate initial state */
  generateState: (config: Grid3DConfig) => Float32Array;
}

/**
 * Generate a spherical blob with Gaussian falloff
 */
function generateSphericalBlob(
  config: Grid3DConfig,
  options: {
    centerX?: number;
    centerY?: number;
    centerZ?: number;
    radius?: number;
    peak?: number;
  } = {}
): Float32Array {
  const { width, height, depth } = config;
  const state = new Float32Array(width * height * depth);

  const cx = options.centerX ?? width / 2;
  const cy = options.centerY ?? height / 2;
  const cz = options.centerZ ?? depth / 2;
  const r = options.radius ?? Math.min(width, height, depth) / 6;
  const peak = options.peak ?? 1.0;
  const sigma = r / 2;

  for (let z = 0; z < depth; z++) {
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const dx = x - cx;
        const dy = y - cy;
        const dz = z - cz;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

        // Gaussian falloff
        const value = peak * Math.exp(-(dist * dist) / (2 * sigma * sigma));
        const index = z * width * height + y * width + x;
        state[index] = Math.min(1, Math.max(0, value));
      }
    }
  }

  return state;
}

/**
 * Generate an elongated blob (ellipsoid)
 */
function generateEllipsoid(
  config: Grid3DConfig,
  options: {
    radiusX?: number;
    radiusY?: number;
    radiusZ?: number;
    peak?: number;
  } = {}
): Float32Array {
  const { width, height, depth } = config;
  const state = new Float32Array(width * height * depth);

  const cx = width / 2;
  const cy = height / 2;
  const cz = depth / 2;
  const rx = options.radiusX ?? width / 6;
  const ry = options.radiusY ?? height / 6;
  const rz = options.radiusZ ?? depth / 6;
  const peak = options.peak ?? 1.0;

  for (let z = 0; z < depth; z++) {
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const dx = (x - cx) / rx;
        const dy = (y - cy) / ry;
        const dz = (z - cz) / rz;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

        // Gaussian falloff
        const sigma = 0.5;
        const value = peak * Math.exp(-(dist * dist) / (2 * sigma * sigma));
        const index = z * width * height + y * width + x;
        state[index] = Math.min(1, Math.max(0, value));
      }
    }
  }

  return state;
}

/**
 * Generate dual spheres (for potential interaction)
 */
function generateDualSpheres(
  config: Grid3DConfig,
  separation?: number
): Float32Array {
  const { width, height, depth } = config;
  const state = new Float32Array(width * height * depth);
  const sep = separation ?? width / 4;
  const radius = Math.min(width, height, depth) / 10;
  const sigma = radius / 2;

  // Sphere 1 (left)
  const cx1 = width / 2 - sep / 2;
  const cy1 = height / 2;
  const cz1 = depth / 2;

  // Sphere 2 (right)
  const cx2 = width / 2 + sep / 2;
  const cy2 = height / 2;
  const cz2 = depth / 2;

  for (let z = 0; z < depth; z++) {
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const dx1 = x - cx1;
        const dy1 = y - cy1;
        const dz1 = z - cz1;
        const dist1 = Math.sqrt(dx1 * dx1 + dy1 * dy1 + dz1 * dz1);
        const val1 = Math.exp(-(dist1 * dist1) / (2 * sigma * sigma));

        const dx2 = x - cx2;
        const dy2 = y - cy2;
        const dz2 = z - cz2;
        const dist2 = Math.sqrt(dx2 * dx2 + dy2 * dy2 + dz2 * dz2);
        const val2 = Math.exp(-(dist2 * dist2) / (2 * sigma * sigma));

        const index = z * width * height + y * width + x;
        state[index] = Math.min(1, val1 + val2);
      }
    }
  }

  return state;
}

/**
 * Generate a torus (donut) shape
 */
function generateTorus(
  config: Grid3DConfig,
  majorRadius?: number,
  minorRadius?: number
): Float32Array {
  const { width, height, depth } = config;
  const state = new Float32Array(width * height * depth);

  const cx = width / 2;
  const cy = height / 2;
  const cz = depth / 2;
  const R = majorRadius ?? Math.min(width, height, depth) / 5;  // Major radius
  const r = minorRadius ?? R / 3;  // Minor radius
  const sigma = r / 2;

  for (let z = 0; z < depth; z++) {
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const dx = x - cx;
        const dy = y - cy;
        const dz = z - cz;

        // Distance to the ring (torus tube center)
        const distToAxis = Math.sqrt(dx * dx + dy * dy);
        const distToRing = distToAxis - R;
        const distToTube = Math.sqrt(distToRing * distToRing + dz * dz);

        // Gaussian falloff from tube center
        const value = Math.exp(-(distToTube * distToTube) / (2 * sigma * sigma));
        const index = z * width * height + y * width + x;
        state[index] = Math.min(1, Math.max(0, value));
      }
    }
  }

  return state;
}

/**
 * Generate random sparse noise
 */
function generateRandomNoise(
  config: Grid3DConfig,
  density: number = 0.05
): Float32Array {
  const { width, height, depth } = config;
  const state = new Float32Array(width * height * depth);

  for (let i = 0; i < state.length; i++) {
    state[i] = Math.random() < density ? Math.random() * 0.8 + 0.2 : 0;
  }

  return state;
}

/**
 * 3D Lenia Organism Presets
 */
export const ORGANISM_3D_PRESETS: Record<string, Organism3DPreset> = {
  'orbium-3d': {
    name: '3D Orbium',
    description: 'Classic Orbium extended to 3D - a smooth spherical glider',
    category: 'sphere',
    params: {
      kernelRadius: 13,
      growthCenter: 0.15,
      growthWidth: 0.015,
      dt: 0.1,
    },
    kernel: {
      radius: 13,
      peakPositions: [0.5],
      peakWidths: [0.23],
      peakWeights: [1],
    },
    generateState: (config) => generateSphericalBlob(config, { radius: 10 }),
  },

  'stable-sphere': {
    name: 'Stable Sphere',
    description: 'A stable, pulsating 3D sphere with wider growth parameters',
    category: 'oscillator',
    params: {
      kernelRadius: 10,
      growthCenter: 0.12,
      growthWidth: 0.04,
      dt: 0.1,
    },
    kernel: {
      radius: 10,
      peakPositions: [0.5],
      peakWidths: [0.3],
      peakWeights: [1],
    },
    generateState: (config) => generateSphericalBlob(config, { radius: 12 }),
  },

  'ellipsoid-glider': {
    name: 'Ellipsoid Glider',
    description: 'An elongated 3D organism that may exhibit directional motion',
    category: 'glider',
    params: {
      kernelRadius: 12,
      growthCenter: 0.14,
      growthWidth: 0.018,
      dt: 0.1,
    },
    kernel: {
      radius: 12,
      peakPositions: [0.5],
      peakWidths: [0.22],
      peakWeights: [1],
    },
    generateState: (config) => generateEllipsoid(config, {
      radiusX: 8,
      radiusY: 12,
      radiusZ: 8,
    }),
  },

  'dual-orbium': {
    name: 'Dual Orbium',
    description: 'Two interacting 3D organisms - may merge, orbit, or repel',
    category: 'experimental',
    params: {
      kernelRadius: 10,
      growthCenter: 0.13,
      growthWidth: 0.025,
      dt: 0.1,
    },
    kernel: {
      radius: 10,
      peakPositions: [0.5],
      peakWidths: [0.25],
      peakWeights: [1],
    },
    generateState: (config) => generateDualSpheres(config, config.width / 3),
  },

  'torus-3d': {
    name: '3D Torus',
    description: 'A donut-shaped organism - may rotate or pulse',
    category: 'experimental',
    params: {
      kernelRadius: 8,
      growthCenter: 0.16,
      growthWidth: 0.02,
      dt: 0.1,
    },
    kernel: {
      radius: 8,
      peakPositions: [0.5],
      peakWidths: [0.25],
      peakWeights: [1],
    },
    generateState: (config) => generateTorus(config),
  },

  'dual-ring-blob': {
    name: 'Dual-Ring Blob',
    description: 'A blob with dual-ring kernel for complex internal dynamics',
    category: 'experimental',
    params: {
      kernelRadius: 15,
      growthCenter: 0.13,
      growthWidth: 0.022,
      dt: 0.08,
    },
    kernel: {
      radius: 15,
      peakPositions: [0.3, 0.7],
      peakWidths: [0.15, 0.15],
      peakWeights: [0.6, 0.4],
    },
    generateState: (config) => generateSphericalBlob(config, { radius: 15 }),
  },

  'primordial-soup-3d': {
    name: '3D Primordial Soup',
    description: 'Random noise - see what emerges in 3D Lenia',
    category: 'chaotic',
    params: {
      kernelRadius: 8,
      growthCenter: 0.18,
      growthWidth: 0.03,
      dt: 0.1,
    },
    kernel: {
      radius: 8,
      peakPositions: [0.5],
      peakWidths: [0.3],
      peakWeights: [1],
    },
    generateState: (config) => generateRandomNoise(config, 0.05),
  },

  'small-orbium': {
    name: 'Small Orbium',
    description: 'Compact 3D organism for smaller grids',
    category: 'sphere',
    params: {
      kernelRadius: 6,
      growthCenter: 0.15,
      growthWidth: 0.02,
      dt: 0.1,
    },
    kernel: {
      radius: 6,
      peakPositions: [0.5],
      peakWidths: [0.25],
      peakWeights: [1],
    },
    generateState: (config) => generateSphericalBlob(config, { radius: 5 }),
  },
};

/**
 * Get all preset names
 */
export function getPresetNames(): string[] {
  return Object.keys(ORGANISM_3D_PRESETS);
}

/**
 * Get preset by name
 */
export function getPreset(name: string): Organism3DPreset | undefined {
  return ORGANISM_3D_PRESETS[name];
}

/**
 * Get presets by category
 */
export function getPresetsByCategory(category: Organism3DCategory): Organism3DPreset[] {
  return Object.values(ORGANISM_3D_PRESETS).filter(p => p.category === category);
}

/**
 * Create an Organism3D from a preset
 */
export function createOrganism3D(
  presetName: string,
  gridConfig: Grid3DConfig = DEFAULT_GRID_3D_CONFIG
): Organism3D | undefined {
  const preset = ORGANISM_3D_PRESETS[presetName];
  if (!preset) return undefined;

  return {
    name: preset.name,
    params: preset.params,
    kernel: preset.kernel,
    initialState: preset.generateState(gridConfig),
    gridSize: gridConfig,
  };
}

/**
 * Generate initial state helpers for custom use
 */
export const StateGenerators = {
  sphericalBlob: generateSphericalBlob,
  ellipsoid: generateEllipsoid,
  dualSpheres: generateDualSpheres,
  torus: generateTorus,
  randomNoise: generateRandomNoise,
};
