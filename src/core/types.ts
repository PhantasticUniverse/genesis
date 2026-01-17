/**
 * GENESIS Core Types
 * Type definitions for the cellular automata engine
 */

/** Grid configuration */
export interface GridConfig {
  width: number;
  height: number;
  channels: number;
  precision: "f16" | "f32";
}

/** CA paradigm types */
export type CAParadigm = "discrete" | "continuous" | "neural";

/** Discrete CA rule format (Birth/Survival) */
export interface DiscreteRule {
  birth: number[]; // e.g., [3] for Game of Life
  survival: number[]; // e.g., [2, 3] for Game of Life
  neighborhood: "moore" | "vonNeumann";
  states: number; // 2 for binary, more for cyclic
}

/** Kernel shape types */
export type KernelShape =
  | "gaussian"
  | "ring"
  | "polynomial"
  | "step"
  | "custom";

/** Growth function types */
export type GrowthFunction = "gaussian" | "polynomial" | "step";

/** Continuous CA kernel configuration */
export interface KernelConfig {
  id: string;
  shape: KernelShape;
  radius: number; // R: kernel radius in pixels
  peaks: number[]; // b: kernel bump heights [0-1]

  // Growth function parameters
  growthType: GrowthFunction;
  mu: number; // growth center
  sigma: number; // growth width

  // Time and weight
  dt: number; // time step
  weight: number; // kernel weight (h)
}

/** Multi-channel interaction */
export interface ChannelInteraction {
  sourceChannel: number;
  targetChannel: number;
  kernel: KernelConfig;
}

/** Simulation state */
export interface SimulationState {
  running: boolean;
  step: number;
  fps: number;
  paradigm: CAParadigm;
  gridConfig: GridConfig;
}

/** WebGPU capabilities */
export interface WebGPUCapabilities {
  available: boolean;
  adapterInfo?: GPUAdapterInfo;
  limits?: GPUSupportedLimits;
  features?: GPUSupportedFeatures;
}

/** Colormap definition */
export interface Colormap {
  name: string;
  colors: [number, number, number, number][]; // RGBA values
}

/** Preset configurations */
export interface CAPreset {
  id: string;
  name: string;
  description: string;
  paradigm: CAParadigm;
  discreteRule?: DiscreteRule;
  kernelConfig?: KernelConfig;
  initialPattern?: string; // RLE encoded
}

// Default configurations
export const DEFAULT_GRID_CONFIG: GridConfig = {
  width: 512,
  height: 512,
  channels: 1,
  precision: "f32",
};

export const GAME_OF_LIFE_RULE: DiscreteRule = {
  birth: [3],
  survival: [2, 3],
  neighborhood: "moore",
  states: 2,
};

export const DEFAULT_LENIA_KERNEL: KernelConfig = {
  id: "default-lenia",
  shape: "gaussian",
  radius: 13,
  peaks: [1],
  growthType: "gaussian",
  mu: 0.15,
  sigma: 0.015,
  dt: 0.1,
  weight: 1,
};

// ============================================================================
// Multi-Kernel Lenia Types
// ============================================================================

/** Single kernel parameters for Multi-Kernel Lenia */
export interface SingleKernelParams {
  id: string;
  shape: KernelShape;
  radius: number; // R: kernel radius in pixels (5-30)
  peaks: number[]; // b: kernel bump heights [0-1]
  weight: number; // h: contribution weight (0-1.5)
}

/** Growth parameters for Multi-Kernel Lenia */
export interface GrowthParams {
  type: GrowthFunction;
  mu: number; // growth center (0.05-0.4)
  sigma: number; // growth width (0.005-0.1)
}

/** Kernel combination modes */
export type KernelCombinationMode = "sum" | "average" | "weighted";

/** Multi-Kernel Lenia configuration */
export interface MultiKernelConfig {
  kernels: SingleKernelParams[];
  growthParams: GrowthParams[];
  combinationMode: KernelCombinationMode;
  dt: number;
  maxKernels: number; // default 4
}

/** Default Multi-Kernel configuration (single kernel, backward compatible) */
export const DEFAULT_MULTIKERNEL_CONFIG: MultiKernelConfig = {
  kernels: [
    {
      id: "kernel-0",
      shape: "polynomial",
      radius: 13,
      peaks: [0.5],
      weight: 1.0,
    },
  ],
  growthParams: [
    {
      type: "gaussian",
      mu: 0.12,
      sigma: 0.04,
    },
  ],
  combinationMode: "sum",
  dt: 0.1,
  maxKernels: 4,
};
