/**
 * Simulation Modes Index
 * Exports all available simulation mode handlers
 */

// Base mode interface
export {
  type SimulationModeHandler,
  type ModeInitOptions,
  type ModeStepResult,
  type ModeFactory,
  BaseModeHandler,
  ModeRegistry,
  createModeRegistry,
} from "./base-mode";

// Discrete CA mode (Game of Life, etc.)
export {
  DiscreteModeHandler,
  createDiscreteModeHandler,
  type DiscreteModeConfig,
} from "./discrete-mode";

// Continuous CA mode (Single-kernel Lenia)
export {
  ContinuousModeHandler,
  createContinuousModeHandler,
  type ContinuousModeConfig,
  type ContinuousCAParams,
  type BoundaryMode,
  CONTINUOUS_PRESETS,
} from "./continuous-mode";

// Multi-kernel Lenia mode
export {
  MultiKernelModeHandler,
  createMultiKernelModeHandler,
  type MultiKernelConfig,
  type SingleKernelParams,
  type GrowthParams,
  MULTIKERNEL_PRESETS,
} from "./multikernel-mode";

import type { SimulationMode } from "../engine-state";
import type { ModeFactory } from "./base-mode";
import { createDiscreteModeHandler } from "./discrete-mode";
import { createContinuousModeHandler } from "./continuous-mode";
import { createMultiKernelModeHandler } from "./multikernel-mode";

/**
 * Default mode factories for all simulation modes
 */
export const DEFAULT_MODE_FACTORIES: Record<
  SimulationMode,
  ModeFactory | null
> = {
  discrete: createDiscreteModeHandler,
  continuous: createContinuousModeHandler,
  multikernel: createMultiKernelModeHandler,
  multichannel: null, // TODO: Implement
  particle: null, // TODO: Implement
  sensorimotor: null, // TODO: Implement
};

/**
 * Register all default modes with a mode registry
 */
export function registerDefaultModes(
  registry: import("./base-mode").ModeRegistry,
): void {
  for (const [mode, factory] of Object.entries(DEFAULT_MODE_FACTORIES)) {
    if (factory) {
      registry.registerFactory(mode as SimulationMode, factory);
    }
  }
}
