/**
 * GENESIS Engine v2
 * Slim state-machine-based engine coordinator
 *
 * This is a refactored version of the original engine.ts that:
 * - Uses a state machine for lifecycle management
 * - Delegates to mode handlers for simulation logic
 * - Shares GPU resources via engine context
 * - Reduces complexity from 1900+ to ~350 lines
 */

import type { GridConfig, DiscreteRule, CAParadigm } from "../types";
import { DEFAULT_GRID_CONFIG, GAME_OF_LIFE_RULE } from "../types";
import {
  createEngineContext,
  type EngineContext,
  type ColormapName,
  COLORMAP_IDS,
} from "./engine-context";
import {
  EngineStateManager,
  type EngineState,
  type SimulationMode,
} from "./engine-state";
import {
  createModeRegistry,
  registerDefaultModes,
  type SimulationModeHandler,
  type ModeRegistry,
} from "./modes";
import {
  DiscreteModeHandler,
  ContinuousModeHandler,
  MultiKernelModeHandler,
} from "./modes";
import type { ContinuousCAParams, BoundaryMode } from "./modes/continuous-mode";
import type {
  MultiKernelConfig,
  SingleKernelParams,
  GrowthParams,
} from "./modes/multikernel-mode";
import { CONTINUOUS_PRESETS } from "../../compute/webgpu/continuous-pipeline";

/**
 * Engine configuration
 */
export interface EngineConfig {
  canvas: HTMLCanvasElement;
  gridConfig?: GridConfig;
  paradigm?: CAParadigm;
  discreteRule?: DiscreteRule;
}

/**
 * Engine v2 interface
 * Maintains API compatibility with the original engine
 */
export interface EngineV2 {
  // State
  readonly running: boolean;
  readonly step: number;
  readonly fps: number;

  // Lifecycle
  start(): void;
  stop(): void;
  toggle(): void;
  stepOnce(): void;
  reset(pattern?: string): void;
  destroy(): void;

  // Mode management
  getMode(): SimulationMode;
  setMode(mode: SimulationMode): Promise<void>;
  setParadigm(paradigm: CAParadigm): void;

  // Discrete mode
  setRule(rule: DiscreteRule): void;

  // Continuous mode
  setContinuousParams(params: Partial<ContinuousCAParams>): void;
  setContinuousPreset(presetName: keyof typeof CONTINUOUS_PRESETS): void;
  setBoundaryMode(mode: BoundaryMode): void;
  getBoundaryMode(): BoundaryMode;

  // Multi-kernel mode
  enableMultiKernel(config?: MultiKernelConfig): void;
  disableMultiKernel(): void;
  isMultiKernelEnabled(): boolean;
  setMultiKernelConfig(config: MultiKernelConfig): void;
  getMultiKernelConfig(): MultiKernelConfig | null;
  setMultiKernelPreset(name: string): void;
  updateMultiKernel(index: number, params: Partial<SingleKernelParams>): void;
  updateMultiKernelGrowth(index: number, params: Partial<GrowthParams>): void;
  addMultiKernel(params?: SingleKernelParams, growth?: GrowthParams): void;
  removeMultiKernel(index: number): void;

  // Rendering
  setColormap(colormap: ColormapName): void;
  getColormap(): ColormapName;

  // State access
  readState(): Promise<Float32Array | null>;
  requestStateReadback(): void;
  pollState(): Float32Array | null;
  isReadbackPending(): boolean;

  // Getters
  getConfig(): GridConfig;
  getGridConfig(): GridConfig;
  getParadigm(): CAParadigm;
  getDevice(): GPUDevice;
  getState(): EngineState;
}

/**
 * Create Engine v2
 */
export async function createEngineV2(config: EngineConfig): Promise<EngineV2> {
  const { canvas } = config;
  const gridConfig = config.gridConfig ?? DEFAULT_GRID_CONFIG;

  // Create engine context (shared GPU resources)
  const ctx = await createEngineContext({ canvas, gridConfig });

  // Create state manager
  const stateManager = new EngineStateManager();

  // Create mode registry and register default modes
  const modeRegistry = createModeRegistry();
  registerDefaultModes(modeRegistry);

  // Track current mode handler
  let currentModeHandler: SimulationModeHandler | null = null;

  // Animation state
  let stepCount = 0;
  let fps = 0;
  let lastTime = performance.now();
  let frameCount = 0;
  let animationFrameId: number | null = null;

  // Map paradigm to mode
  function paradigmToMode(paradigm: CAParadigm): SimulationMode {
    switch (paradigm) {
      case "discrete":
        return "discrete";
      case "continuous":
        return "continuous";
      case "neural":
        return "continuous"; // Neural uses continuous pipeline
      default:
        return "discrete";
    }
  }

  // Initialize default mode
  const initialMode = paradigmToMode(config.paradigm ?? "discrete");
  await initializeMode(initialMode);

  // Transition to idle state
  stateManager.transition("INITIALIZE");

  /**
   * Initialize a simulation mode
   */
  async function initializeMode(mode: SimulationMode): Promise<void> {
    // Clean up current mode if exists
    if (currentModeHandler) {
      currentModeHandler.cleanup();
    }

    // Get or create mode handler
    const handler = modeRegistry.getMode(mode, ctx.device, gridConfig);
    if (!handler) {
      throw new Error(`Unknown mode: ${mode}`);
    }

    // Initialize the handler
    await handler.initialize(ctx);

    currentModeHandler = handler;
    stateManager.setMode(mode);
  }

  /**
   * Perform one simulation step
   */
  function doStep(): void {
    if (!currentModeHandler || !currentModeHandler.isReady()) {
      return;
    }

    const result = currentModeHandler.step(ctx);
    if (!result.success) {
      console.error("Step failed:", result.error);
      stateManager.transition("ERROR");
      return;
    }

    stepCount++;

    // Render
    currentModeHandler.render(ctx);
  }

  /**
   * Animation loop
   */
  function animate(): void {
    if (!stateManager.isRunning()) return;

    doStep();

    // Update FPS counter
    frameCount++;
    const now = performance.now();
    if (now - lastTime >= 1000) {
      fps = frameCount;
      frameCount = 0;
      lastTime = now;
    }

    animationFrameId = requestAnimationFrame(animate);
  }

  // Initial render
  if (currentModeHandler) {
    currentModeHandler.render(ctx);
  }

  // Engine interface
  const engine: EngineV2 = {
    get running() {
      return stateManager.isRunning();
    },

    get step() {
      return stepCount;
    },

    get fps() {
      return fps;
    },

    start() {
      if (stateManager.canStart()) {
        stateManager.transition("START");
        lastTime = performance.now();
        frameCount = 0;
        animate();
      }
    },

    stop() {
      if (stateManager.canStop()) {
        stateManager.transition("STOP");
        if (animationFrameId !== null) {
          cancelAnimationFrame(animationFrameId);
          animationFrameId = null;
        }
      }
    },

    toggle() {
      if (stateManager.isRunning()) {
        this.stop();
      } else {
        this.start();
      }
    },

    stepOnce() {
      if (stateManager.canStep()) {
        doStep();
      }
    },

    reset(pattern = "random") {
      this.stop();
      stepCount = 0;
      if (currentModeHandler) {
        currentModeHandler.reset(ctx, pattern);
        currentModeHandler.render(ctx);
      }
    },

    destroy() {
      this.stop();
      stateManager.transition("DESTROY");
      modeRegistry.cleanup();
      ctx.destroy();
    },

    getMode() {
      return stateManager.getMode();
    },

    async setMode(mode: SimulationMode) {
      if (stateManager.getMode() === mode) return;

      const wasRunning = stateManager.isRunning();
      if (wasRunning) {
        this.stop();
      }

      stateManager.transition("CHANGE_MODE");
      await initializeMode(mode);
      stateManager.transition("START");

      if (wasRunning) {
        this.start();
      } else {
        stateManager.transition("STOP");
      }
    },

    setParadigm(paradigm: CAParadigm) {
      const mode = paradigmToMode(paradigm);
      void this.setMode(mode);
    },

    // Discrete mode methods
    setRule(rule: DiscreteRule) {
      if (currentModeHandler instanceof DiscreteModeHandler) {
        currentModeHandler.setRule(rule);
      }
    },

    // Continuous mode methods
    setContinuousParams(params: Partial<ContinuousCAParams>) {
      if (currentModeHandler instanceof ContinuousModeHandler) {
        currentModeHandler.setParams(params);
      }
    },

    setContinuousPreset(presetName: keyof typeof CONTINUOUS_PRESETS) {
      if (currentModeHandler instanceof ContinuousModeHandler) {
        currentModeHandler.setPreset(presetName);
      }
    },

    setBoundaryMode(mode: BoundaryMode) {
      if (currentModeHandler instanceof ContinuousModeHandler) {
        currentModeHandler.setBoundaryMode(mode);
      }
    },

    getBoundaryMode(): BoundaryMode {
      if (currentModeHandler instanceof ContinuousModeHandler) {
        return currentModeHandler.getBoundaryMode();
      }
      return "periodic";
    },

    // Multi-kernel mode methods
    enableMultiKernel(config?: MultiKernelConfig) {
      void this.setMode("multikernel").then(() => {
        if (config && currentModeHandler instanceof MultiKernelModeHandler) {
          currentModeHandler.setMultiKernelConfig(config);
        }
      });
    },

    disableMultiKernel() {
      if (stateManager.getMode() === "multikernel") {
        void this.setMode("continuous");
      }
    },

    isMultiKernelEnabled() {
      return stateManager.getMode() === "multikernel";
    },

    setMultiKernelConfig(config: MultiKernelConfig) {
      if (currentModeHandler instanceof MultiKernelModeHandler) {
        currentModeHandler.setMultiKernelConfig(config);
      }
    },

    getMultiKernelConfig() {
      if (currentModeHandler instanceof MultiKernelModeHandler) {
        return currentModeHandler.getMultiKernelConfig();
      }
      return null;
    },

    setMultiKernelPreset(name: string) {
      if (currentModeHandler instanceof MultiKernelModeHandler) {
        currentModeHandler.setPreset(name);
      }
    },

    updateMultiKernel(index: number, params: Partial<SingleKernelParams>) {
      if (currentModeHandler instanceof MultiKernelModeHandler) {
        currentModeHandler.updateKernel(index, params);
      }
    },

    updateMultiKernelGrowth(index: number, params: Partial<GrowthParams>) {
      if (currentModeHandler instanceof MultiKernelModeHandler) {
        currentModeHandler.updateGrowth(index, params);
      }
    },

    addMultiKernel(params?: SingleKernelParams, growth?: GrowthParams) {
      if (currentModeHandler instanceof MultiKernelModeHandler) {
        currentModeHandler.addKernel(params, growth);
      }
    },

    removeMultiKernel(index: number) {
      if (currentModeHandler instanceof MultiKernelModeHandler) {
        currentModeHandler.removeKernel(index);
      }
    },

    // Rendering
    setColormap(colormap: ColormapName) {
      ctx.colormap = colormap;
      if (currentModeHandler) {
        currentModeHandler.render(ctx);
      }
    },

    getColormap() {
      return ctx.colormap;
    },

    // State access
    readState() {
      return ctx.readState();
    },

    requestStateReadback() {
      ctx.requestStateReadback();
    },

    pollState() {
      return ctx.pollState();
    },

    isReadbackPending() {
      return ctx.isReadbackPending();
    },

    // Getters
    getConfig() {
      return gridConfig;
    },

    getGridConfig() {
      return gridConfig;
    },

    getParadigm() {
      const mode = stateManager.getMode();
      switch (mode) {
        case "discrete":
          return "discrete";
        case "continuous":
        case "multikernel":
          return "continuous";
        default:
          return "continuous";
      }
    },

    getDevice() {
      return ctx.device;
    },

    getState() {
      return stateManager.getState();
    },
  };

  return engine;
}

// Re-export types
export type { EngineState, SimulationMode, ColormapName };
export { COLORMAP_IDS };
