/**
 * Base Mode Interface
 * Abstract interface for all simulation modes (discrete, continuous, multikernel, etc.)
 */

import type { EngineContext } from "../engine-context";
import type { SimulationMode } from "../engine-state";

/**
 * Mode initialization options
 */
export interface ModeInitOptions {
  // Common options
  pattern?: "random" | "center-blob" | "lenia-seed" | "glider" | "blinker";
}

/**
 * Mode step result
 */
export interface ModeStepResult {
  success: boolean;
  error?: Error;
}

/**
 * Base simulation mode interface
 * All modes must implement this interface
 */
export interface SimulationModeHandler {
  /**
   * Mode identifier
   */
  readonly id: SimulationMode;

  /**
   * Human-readable name
   */
  readonly name: string;

  /**
   * Description of what this mode does
   */
  readonly description: string;

  /**
   * Initialize the mode with the engine context
   * Called when switching to this mode
   */
  initialize(ctx: EngineContext, options?: ModeInitOptions): Promise<void>;

  /**
   * Perform one simulation step
   * Returns step result with success/error status
   */
  step(ctx: EngineContext): ModeStepResult;

  /**
   * Render the current state
   * May use custom rendering for this mode (e.g., multi-channel colors)
   */
  render(ctx: EngineContext): void;

  /**
   * Reset the simulation state
   */
  reset(ctx: EngineContext, pattern?: string): void;

  /**
   * Clean up mode-specific resources
   * Called when switching away from this mode
   */
  cleanup(): void;

  /**
   * Get mode-specific configuration (for UI/serialization)
   */
  getConfig(): Record<string, unknown>;

  /**
   * Update mode-specific configuration
   */
  setConfig(config: Record<string, unknown>): void;

  /**
   * Check if mode is ready to run
   */
  isReady(): boolean;
}

/**
 * Mode factory function type
 */
export type ModeFactory = (
  device: GPUDevice,
  gridConfig: { width: number; height: number },
) => SimulationModeHandler;

/**
 * Mode registry for dynamic mode loading
 */
export class ModeRegistry {
  private modes: Map<SimulationMode, SimulationModeHandler> = new Map();
  private factories: Map<SimulationMode, ModeFactory> = new Map();

  /**
   * Register a mode factory
   */
  registerFactory(id: SimulationMode, factory: ModeFactory): void {
    this.factories.set(id, factory);
  }

  /**
   * Get or create a mode handler
   */
  getMode(
    id: SimulationMode,
    device: GPUDevice,
    gridConfig: { width: number; height: number },
  ): SimulationModeHandler | null {
    // Return cached mode if exists
    if (this.modes.has(id)) {
      return this.modes.get(id)!;
    }

    // Create new mode from factory
    const factory = this.factories.get(id);
    if (!factory) {
      console.warn(`No factory registered for mode: ${id}`);
      return null;
    }

    const mode = factory(device, gridConfig);
    this.modes.set(id, mode);
    return mode;
  }

  /**
   * Check if a mode is registered
   */
  hasMode(id: SimulationMode): boolean {
    return this.factories.has(id);
  }

  /**
   * Get all registered mode IDs
   */
  getModeIds(): SimulationMode[] {
    return Array.from(this.factories.keys());
  }

  /**
   * Clean up all modes
   */
  cleanup(): void {
    for (const mode of this.modes.values()) {
      try {
        mode.cleanup();
      } catch (e) {
        console.warn(`Failed to cleanup mode ${mode.id}:`, e);
      }
    }
    this.modes.clear();
  }

  /**
   * Clean up a specific mode
   */
  cleanupMode(id: SimulationMode): void {
    const mode = this.modes.get(id);
    if (mode) {
      try {
        mode.cleanup();
      } catch (e) {
        console.warn(`Failed to cleanup mode ${id}:`, e);
      }
      this.modes.delete(id);
    }
  }
}

/**
 * Create a new mode registry
 */
export function createModeRegistry(): ModeRegistry {
  return new ModeRegistry();
}

/**
 * Base class with common functionality for modes
 * Modes can extend this or implement SimulationModeHandler directly
 */
export abstract class BaseModeHandler implements SimulationModeHandler {
  abstract readonly id: SimulationMode;
  abstract readonly name: string;
  abstract readonly description: string;

  protected device: GPUDevice;
  protected gridWidth: number;
  protected gridHeight: number;
  protected ready = false;
  protected config: Record<string, unknown> = {};

  constructor(
    device: GPUDevice,
    gridConfig: { width: number; height: number },
  ) {
    this.device = device;
    this.gridWidth = gridConfig.width;
    this.gridHeight = gridConfig.height;
  }

  abstract initialize(
    ctx: EngineContext,
    options?: ModeInitOptions,
  ): Promise<void>;
  abstract step(ctx: EngineContext): ModeStepResult;
  abstract reset(ctx: EngineContext, pattern?: string): void;
  abstract cleanup(): void;

  /**
   * Default render uses the context's render method
   * Override for custom rendering (e.g., multi-channel)
   */
  render(ctx: EngineContext): void {
    ctx.render();
  }

  getConfig(): Record<string, unknown> {
    return { ...this.config };
  }

  setConfig(config: Record<string, unknown>): void {
    this.config = { ...this.config, ...config };
  }

  isReady(): boolean {
    return this.ready;
  }

  /**
   * Helper to calculate workgroup dimensions
   */
  protected getWorkgroupDimensions(): { x: number; y: number } {
    return {
      x: Math.ceil(this.gridWidth / 16),
      y: Math.ceil(this.gridHeight / 16),
    };
  }
}
