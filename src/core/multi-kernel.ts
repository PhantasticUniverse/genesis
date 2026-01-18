/**
 * Multi-Kernel Lenia
 * State management, presets, and utilities for Multi-Kernel Lenia simulations
 */

import type {
  MultiKernelConfig,
  SingleKernelParams,
  GrowthParams,
  KernelCombinationMode,
  KernelShape,
  GrowthFunction,
} from "./types";
import { DEFAULT_MULTIKERNEL_CONFIG } from "./types";

// ============================================================================
// Multi-Kernel State
// ============================================================================

export interface MultiKernelState {
  enabled: boolean;
  config: MultiKernelConfig;
}

/**
 * Create initial multi-kernel state
 */
export function createMultiKernelState(
  config?: Partial<MultiKernelConfig>,
): MultiKernelState {
  return {
    enabled: false,
    config: config
      ? { ...DEFAULT_MULTIKERNEL_CONFIG, ...config }
      : { ...DEFAULT_MULTIKERNEL_CONFIG },
  };
}

/**
 * Create a new single kernel with default parameters
 */
export function createDefaultKernel(index: number): SingleKernelParams {
  return {
    id: `kernel-${index}`,
    shape: "polynomial" as KernelShape,
    radius: 12,
    peaks: [0.148, 0.335, 0.81],
    weight: 1.0,
  };
}

/**
 * Create default growth parameters
 */
export function createDefaultGrowthParams(): GrowthParams {
  return {
    type: "gaussian" as GrowthFunction,
    mu: 0.12,
    sigma: 0.04,
  };
}

// ============================================================================
// Multi-Kernel Presets
// ============================================================================

export const MULTIKERNEL_PRESETS: Record<string, MultiKernelConfig> = {
  /** Classic Orbium with short+long range sensing */
  "orbium-dual": {
    kernels: [
      {
        id: "kernel-0",
        shape: "polynomial",
        radius: 13,
        peaks: [0.5],
        weight: 0.6,
      },
      {
        id: "kernel-1",
        shape: "polynomial",
        radius: 21,
        peaks: [0.5],
        weight: 0.4,
      },
    ],
    growthParams: [
      { type: "gaussian", mu: 0.12, sigma: 0.04 },
      { type: "gaussian", mu: 0.15, sigma: 0.05 },
    ],
    combinationMode: "weighted",
    dt: 0.1,
    maxKernels: 4,
  },

  /** Three-kernel self-replicating pattern */
  "geminium-triple": {
    kernels: [
      {
        id: "kernel-0",
        shape: "polynomial",
        radius: 10,
        peaks: [0.25, 0.75],
        weight: 0.5,
      },
      {
        id: "kernel-1",
        shape: "polynomial",
        radius: 15,
        peaks: [0.5],
        weight: 0.3,
      },
      {
        id: "kernel-2",
        shape: "gaussian",
        radius: 8,
        peaks: [0.5],
        weight: 0.2,
      },
    ],
    growthParams: [
      { type: "gaussian", mu: 0.14, sigma: 0.03 },
      { type: "gaussian", mu: 0.12, sigma: 0.04 },
      { type: "polynomial", mu: 0.1, sigma: 0.035 },
    ],
    combinationMode: "weighted",
    dt: 0.1,
    maxKernels: 4,
  },

  /** Complex 4-kernel organism */
  hydrogeminium: {
    kernels: [
      {
        id: "kernel-0",
        shape: "polynomial",
        radius: 12,
        peaks: [0.3, 0.7],
        weight: 0.35,
      },
      {
        id: "kernel-1",
        shape: "polynomial",
        radius: 18,
        peaks: [0.5],
        weight: 0.25,
      },
      {
        id: "kernel-2",
        shape: "ring",
        radius: 9,
        peaks: [0.6],
        weight: 0.25,
      },
      {
        id: "kernel-3",
        shape: "gaussian",
        radius: 6,
        peaks: [0.5],
        weight: 0.15,
      },
    ],
    growthParams: [
      { type: "gaussian", mu: 0.13, sigma: 0.04 },
      { type: "gaussian", mu: 0.11, sigma: 0.05 },
      { type: "polynomial", mu: 0.15, sigma: 0.03 },
      { type: "gaussian", mu: 0.1, sigma: 0.03 },
    ],
    combinationMode: "weighted",
    dt: 0.1,
    maxKernels: 4,
  },

  /** Fast-moving dual-kernel variant */
  "scutium-dual": {
    kernels: [
      {
        id: "kernel-0",
        shape: "polynomial",
        radius: 11,
        peaks: [0.4],
        weight: 0.7,
      },
      {
        id: "kernel-1",
        shape: "polynomial",
        radius: 16,
        peaks: [0.3, 0.6],
        weight: 0.3,
      },
    ],
    growthParams: [
      { type: "gaussian", mu: 0.13, sigma: 0.035 },
      { type: "gaussian", mu: 0.11, sigma: 0.045 },
    ],
    combinationMode: "weighted",
    dt: 0.12,
    maxKernels: 4,
  },

  /** Single kernel (backward compatible) */
  single: {
    kernels: [
      {
        id: "kernel-0",
        shape: "polynomial",
        radius: 12,
        peaks: [0.148, 0.335, 0.81],
        weight: 1.0,
      },
    ],
    growthParams: [{ type: "gaussian", mu: 0.12, sigma: 0.04 }],
    combinationMode: "sum",
    dt: 0.1,
    maxKernels: 4,
  },

  /** Optimized dual-kernel from evolution experiments (fitness 0.9999) */
  "optimized-dual": {
    kernels: [
      {
        id: "kernel-0",
        shape: "step",
        radius: 30,
        peaks: [0.865],
        weight: 0.379,
      },
      {
        id: "kernel-1",
        shape: "polynomial",
        radius: 28,
        peaks: [0.114, 0.373, 0.64],
        weight: 1.386,
      },
    ],
    growthParams: [
      { type: "gaussian", mu: 0.235, sigma: 0.048 },
      { type: "gaussian", mu: 0.092, sigma: 0.07 },
    ],
    combinationMode: "average",
    dt: 1 / 18, // T=18
    maxKernels: 4,
  },
};

// ============================================================================
// Multi-Kernel Operations
// ============================================================================

/**
 * Add a new kernel to the configuration
 */
export function addKernel(
  config: MultiKernelConfig,
  kernel?: SingleKernelParams,
  growth?: GrowthParams,
): MultiKernelConfig {
  if (config.kernels.length >= config.maxKernels) {
    throw new Error(`Maximum number of kernels (${config.maxKernels}) reached`);
  }

  const newIndex = config.kernels.length;
  const newKernel = kernel ?? createDefaultKernel(newIndex);
  const newGrowth = growth ?? createDefaultGrowthParams();

  return {
    ...config,
    kernels: [...config.kernels, newKernel],
    growthParams: [...config.growthParams, newGrowth],
  };
}

/**
 * Remove a kernel from the configuration
 */
export function removeKernel(
  config: MultiKernelConfig,
  index: number,
): MultiKernelConfig {
  if (config.kernels.length <= 1) {
    throw new Error("Cannot remove the last kernel");
  }
  if (index < 0 || index >= config.kernels.length) {
    throw new Error(`Invalid kernel index: ${index}`);
  }

  return {
    ...config,
    kernels: config.kernels.filter((_, i) => i !== index),
    growthParams: config.growthParams.filter((_, i) => i !== index),
  };
}

/**
 * Update a single kernel's parameters
 */
export function updateKernel(
  config: MultiKernelConfig,
  index: number,
  params: Partial<SingleKernelParams>,
): MultiKernelConfig {
  if (index < 0 || index >= config.kernels.length) {
    throw new Error(`Invalid kernel index: ${index}`);
  }

  const updatedKernels = [...config.kernels];
  updatedKernels[index] = { ...updatedKernels[index], ...params };

  return {
    ...config,
    kernels: updatedKernels,
  };
}

/**
 * Update a kernel's growth parameters
 */
export function updateGrowthParams(
  config: MultiKernelConfig,
  index: number,
  params: Partial<GrowthParams>,
): MultiKernelConfig {
  if (index < 0 || index >= config.growthParams.length) {
    throw new Error(`Invalid growth params index: ${index}`);
  }

  const updatedGrowthParams = [...config.growthParams];
  updatedGrowthParams[index] = { ...updatedGrowthParams[index], ...params };

  return {
    ...config,
    growthParams: updatedGrowthParams,
  };
}

/**
 * Set the combination mode
 */
export function setCombinationMode(
  config: MultiKernelConfig,
  mode: KernelCombinationMode,
): MultiKernelConfig {
  return {
    ...config,
    combinationMode: mode,
  };
}

/**
 * Normalize kernel weights to sum to 1.0
 */
export function normalizeWeights(config: MultiKernelConfig): MultiKernelConfig {
  const totalWeight = config.kernels.reduce((sum, k) => sum + k.weight, 0);
  if (totalWeight === 0) return config;

  return {
    ...config,
    kernels: config.kernels.map((k) => ({
      ...k,
      weight: k.weight / totalWeight,
    })),
  };
}

/**
 * Get the maximum kernel radius in the configuration
 * Used to determine if FFT path should be used
 */
export function getMaxRadius(config: MultiKernelConfig): number {
  return Math.max(...config.kernels.map((k) => k.radius));
}

/**
 * Check if FFT should be used based on kernel radii
 */
export function shouldUseFFT(config: MultiKernelConfig): boolean {
  return getMaxRadius(config) >= 16;
}

// ============================================================================
// Validation
// ============================================================================

/**
 * Validate a multi-kernel configuration
 */
export function validateConfig(config: MultiKernelConfig): string[] {
  const errors: string[] = [];

  if (config.kernels.length === 0) {
    errors.push("At least one kernel is required");
  }

  if (config.kernels.length > config.maxKernels) {
    errors.push(
      `Too many kernels: ${config.kernels.length} > ${config.maxKernels}`,
    );
  }

  if (config.kernels.length !== config.growthParams.length) {
    errors.push(
      `Kernel count (${config.kernels.length}) must match growth params count (${config.growthParams.length})`,
    );
  }

  for (let i = 0; i < config.kernels.length; i++) {
    const kernel = config.kernels[i];

    if (kernel.radius < 3 || kernel.radius > 50) {
      errors.push(`Kernel ${i}: radius must be between 3 and 50`);
    }

    if (kernel.weight < 0 || kernel.weight > 2) {
      errors.push(`Kernel ${i}: weight must be between 0 and 2`);
    }

    if (kernel.peaks.length === 0) {
      errors.push(`Kernel ${i}: at least one peak is required`);
    }

    for (const peak of kernel.peaks) {
      if (peak < 0 || peak > 1) {
        errors.push(`Kernel ${i}: peaks must be between 0 and 1`);
        break;
      }
    }
  }

  for (let i = 0; i < config.growthParams.length; i++) {
    const growth = config.growthParams[i];

    if (growth.mu < 0 || growth.mu > 1) {
      errors.push(`Growth ${i}: mu must be between 0 and 1`);
    }

    if (growth.sigma < 0.001 || growth.sigma > 0.5) {
      errors.push(`Growth ${i}: sigma must be between 0.001 and 0.5`);
    }
  }

  if (config.dt <= 0 || config.dt > 1) {
    errors.push("dt must be between 0 (exclusive) and 1");
  }

  return errors;
}

// ============================================================================
// Serialization
// ============================================================================

/**
 * Serialize multi-kernel config to JSON
 */
export function serializeConfig(config: MultiKernelConfig): string {
  return JSON.stringify(config, null, 2);
}

/**
 * Deserialize multi-kernel config from JSON
 */
export function deserializeConfig(json: string): MultiKernelConfig {
  const parsed = JSON.parse(json);

  // Validate structure
  const errors = validateConfig(parsed);
  if (errors.length > 0) {
    throw new Error(`Invalid config: ${errors.join(", ")}`);
  }

  return parsed as MultiKernelConfig;
}

/**
 * Convert MultiKernelConfig to compact format for CLI/API
 */
export function configToCompact(config: MultiKernelConfig): {
  k: Array<{
    s: string;
    r: number;
    p: number[];
    w: number;
  }>;
  g: Array<{
    t: string;
    m: number;
    s: number;
  }>;
  c: string;
  dt: number;
} {
  return {
    k: config.kernels.map((k) => ({
      s: k.shape,
      r: k.radius,
      p: k.peaks,
      w: k.weight,
    })),
    g: config.growthParams.map((g) => ({
      t: g.type,
      m: g.mu,
      s: g.sigma,
    })),
    c: config.combinationMode,
    dt: config.dt,
  };
}

/**
 * Convert compact format back to MultiKernelConfig
 */
export function compactToConfig(compact: {
  k: Array<{
    s: string;
    r: number;
    p: number[];
    w: number;
  }>;
  g: Array<{
    t: string;
    m: number;
    s: number;
  }>;
  c: string;
  dt: number;
}): MultiKernelConfig {
  return {
    kernels: compact.k.map((k, i) => ({
      id: `kernel-${i}`,
      shape: k.s as KernelShape,
      radius: k.r,
      peaks: k.p,
      weight: k.w,
    })),
    growthParams: compact.g.map((g) => ({
      type: g.t as GrowthFunction,
      mu: g.m,
      sigma: g.s,
    })),
    combinationMode: compact.c as KernelCombinationMode,
    dt: compact.dt,
    maxKernels: 4,
  };
}
