/**
 * GENESIS 3D Lenia Types
 * Type definitions for 3D cellular automata simulation
 */

/** 3D Grid configuration */
export interface Grid3DConfig {
  width: number;
  height: number;
  depth: number;
  precision?: "f16" | "f32";
}

/** 3D Kernel configuration (spherical) */
export interface Kernel3DConfig {
  /** Kernel radius R in voxels */
  radius: number;
  /** Peak positions (beta values, 0-1 normalized distance from center) */
  peakPositions: number[];
  /** Peak widths for each peak */
  peakWidths: number[];
  /** Relative weights for each peak */
  peakWeights: number[];
}

/** 3D Lenia simulation parameters */
export interface Lenia3DParams {
  /** Kernel radius R (default: 13) */
  kernelRadius: number;
  /** Growth function center mu (default: 0.15) */
  growthCenter: number;
  /** Growth function width sigma (default: 0.015) */
  growthWidth: number;
  /** Time step dt (default: 0.1) */
  dt: number;
}

/** 3D Organism definition */
export interface Organism3D {
  /** Display name */
  name: string;
  /** Simulation parameters */
  params: Lenia3DParams;
  /** Kernel configuration */
  kernel: Kernel3DConfig;
  /** Initial state as flattened 3D array (z * height * width + y * width + x) */
  initialState: Float32Array;
  /** Grid dimensions for the initial state */
  gridSize: Grid3DConfig;
}

/** 3D View modes */
export type View3DMode = "slice" | "volume";

/** Slice plane orientations */
export type SlicePlane = "xy" | "xz" | "yz";

/** 3D View configuration */
export interface View3DConfig {
  mode: View3DMode;
  slicePlane: SlicePlane;
  slicePosition: number;
  /** Camera rotation for volume rendering (degrees) */
  cameraRotationX: number;
  cameraRotationY: number;
  /** Camera zoom level */
  cameraZoom: number;
}

/** 3D Lenia state */
export interface Lenia3DState {
  enabled: boolean;
  config: Grid3DConfig;
  params: Lenia3DParams;
  view: View3DConfig;
  currentOrganism?: string;
}

// Default configurations

export const DEFAULT_GRID_3D_CONFIG: Grid3DConfig = {
  width: 64,
  height: 64,
  depth: 64,
  precision: "f32",
};

export const DEFAULT_LENIA_3D_PARAMS: Lenia3DParams = {
  kernelRadius: 13,
  growthCenter: 0.15,
  growthWidth: 0.015,
  dt: 0.1,
};

export const DEFAULT_KERNEL_3D_CONFIG: Kernel3DConfig = {
  radius: 13,
  peakPositions: [0.5],
  peakWidths: [0.23],
  peakWeights: [1],
};

export const DEFAULT_VIEW_3D_CONFIG: View3DConfig = {
  mode: "slice",
  slicePlane: "xy",
  slicePosition: 32, // Middle of 64-depth grid
  cameraRotationX: 30,
  cameraRotationY: 45,
  cameraZoom: 1.0,
};

/** Preset grid sizes for 3D simulation */
export const GRID_3D_PRESETS: Record<string, Grid3DConfig> = {
  small: { width: 32, height: 32, depth: 32, precision: "f32" },
  medium: { width: 64, height: 64, depth: 64, precision: "f32" },
  large: { width: 128, height: 128, depth: 128, precision: "f32" },
};

/** Calculate total voxel count */
export function getVoxelCount(config: Grid3DConfig): number {
  return config.width * config.height * config.depth;
}

/** Calculate memory usage in bytes (for ping-pong buffers) */
export function getMemoryUsage(config: Grid3DConfig): number {
  const bytesPerVoxel = config.precision === "f16" ? 2 : 4;
  return getVoxelCount(config) * bytesPerVoxel * 2; // x2 for ping-pong
}

/** Convert 3D coordinates to flat array index */
export function coords3DToIndex(
  x: number,
  y: number,
  z: number,
  config: Grid3DConfig,
): number {
  return z * config.width * config.height + y * config.width + x;
}

/** Convert flat array index to 3D coordinates */
export function indexToCoords3D(
  index: number,
  config: Grid3DConfig,
): { x: number; y: number; z: number } {
  const z = Math.floor(index / (config.width * config.height));
  const remainder = index % (config.width * config.height);
  const y = Math.floor(remainder / config.width);
  const x = remainder % config.width;
  return { x, y, z };
}
