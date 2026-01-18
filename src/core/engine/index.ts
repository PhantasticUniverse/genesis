/**
 * GENESIS Engine Module
 * Re-exports engine components for easy importing
 */

// Engine v2 (new state-machine architecture)
export {
  createEngineV2,
  type EngineV2,
  type EngineConfig,
  type EngineState,
  type SimulationMode,
  type ColormapName,
  COLORMAP_IDS,
} from "./engine-v2";

// Engine state machine
export {
  EngineStateManager,
  createStateManager,
  getNextState,
  STATE_TRANSITIONS,
  type StateEvent,
  type StateChangeCallback,
  type StateTransitionResult,
} from "./engine-state";

// Engine context (shared GPU resources)
export {
  createEngineContext,
  type EngineContext,
  type EngineContextConfig,
} from "./engine-context";

// Mode system
export {
  // Base mode interface
  type SimulationModeHandler,
  type ModeInitOptions,
  type ModeStepResult,
  type ModeFactory,
  BaseModeHandler,
  ModeRegistry,
  createModeRegistry,
  registerDefaultModes,
  DEFAULT_MODE_FACTORIES,

  // Discrete mode
  DiscreteModeHandler,
  createDiscreteModeHandler,
  type DiscreteModeConfig,

  // Continuous mode
  ContinuousModeHandler,
  createContinuousModeHandler,
  type ContinuousModeConfig,
  type ContinuousCAParams,
  type BoundaryMode,
  CONTINUOUS_PRESETS,

  // Multi-kernel mode
  MultiKernelModeHandler,
  createMultiKernelModeHandler,
  type MultiKernelConfig,
  type SingleKernelParams,
  type GrowthParams,
  MULTIKERNEL_PRESETS,
} from "./modes";
