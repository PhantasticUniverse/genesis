/**
 * Continuous CA Mode
 * Handles single-kernel Lenia and SmoothLife simulations
 */

import type { EngineContext } from "../engine-context";
import type { SimulationMode } from "../engine-state";
import {
  BaseModeHandler,
  type ModeInitOptions,
  type ModeStepResult,
} from "./base-mode";
import type { KernelConfig } from "../../types";
import { DEFAULT_LENIA_KERNEL } from "../../types";
import { initializePattern } from "../../buffer-manager";
import {
  createContinuousPipeline,
  type ContinuousPipeline,
  type ContinuousCAParams,
  type BoundaryMode,
  CONTINUOUS_PRESETS,
} from "../../../compute/webgpu/continuous-pipeline";

/**
 * Continuous CA mode configuration
 */
export interface ContinuousModeConfig {
  kernelConfig: KernelConfig;
  params: ContinuousCAParams;
  boundaryMode: BoundaryMode;
}

/**
 * Continuous CA Mode Handler (Single-Kernel Lenia)
 */
export class ContinuousModeHandler extends BaseModeHandler {
  readonly id: SimulationMode = "continuous";
  readonly name = "Lenia (Single Kernel)";
  readonly description =
    "Continuous cellular automata with smooth growth functions";

  private pipeline: ContinuousPipeline | null = null;
  private kernelConfig: KernelConfig = DEFAULT_LENIA_KERNEL;
  private params: ContinuousCAParams = {
    kernelRadius: 13,
    growthCenter: 0.12,
    growthWidth: 0.04,
    dt: 0.1,
    growthType: 1, // gaussian
    boundaryMode: "periodic",
  };

  async initialize(
    ctx: EngineContext,
    options?: ModeInitOptions,
  ): Promise<void> {
    // Create continuous pipeline
    this.pipeline = createContinuousPipeline(
      this.device,
      this.gridWidth,
      this.gridHeight,
      {
        shape: this.kernelConfig.shape,
        radius: this.kernelConfig.radius,
        peaks: this.kernelConfig.peaks,
      },
    );

    // Update params
    this.pipeline.updateParams(this.params);

    // Initialize pattern
    const pattern = options?.pattern ?? "lenia-seed";
    initializePattern(
      this.device,
      ctx.bufferManager.getReadTexture(),
      this.gridWidth,
      this.gridHeight,
      pattern,
    );

    this.ready = true;
  }

  step(ctx: EngineContext): ModeStepResult {
    if (!this.ready || !this.pipeline) {
      return {
        success: false,
        error: new Error("Continuous mode not initialized"),
      };
    }

    try {
      const readTexture = ctx.bufferManager.getReadTexture();
      const writeTexture = ctx.bufferManager.getWriteTexture();
      const commandEncoder = this.device.createCommandEncoder();

      const { x, y } = this.getWorkgroupDimensions();
      this.pipeline.dispatch(commandEncoder, readTexture, writeTexture, x, y);

      this.device.queue.submit([commandEncoder.finish()]);

      // Swap buffers
      ctx.bufferManager.swap();

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  reset(ctx: EngineContext, pattern = "lenia-seed"): void {
    initializePattern(
      this.device,
      ctx.bufferManager.getReadTexture(),
      this.gridWidth,
      this.gridHeight,
      pattern as "random" | "center-blob" | "lenia-seed" | "glider" | "blinker",
    );
  }

  cleanup(): void {
    if (this.pipeline) {
      this.pipeline.destroy();
      this.pipeline = null;
    }
    this.ready = false;
  }

  /**
   * Update continuous CA parameters
   */
  setParams(params: Partial<ContinuousCAParams>): void {
    this.params = { ...this.params, ...params };
    if (this.pipeline) {
      this.pipeline.updateParams(params);
    }
  }

  /**
   * Get current parameters
   */
  getParams(): ContinuousCAParams {
    return { ...this.params };
  }

  /**
   * Update kernel configuration
   */
  setKernelConfig(config: KernelConfig): void {
    this.kernelConfig = config;
    if (this.pipeline) {
      this.pipeline.updateKernel({
        shape: config.shape,
        radius: config.radius,
        peaks: config.peaks,
      });
      this.pipeline.updateParams({
        kernelRadius: config.radius,
        growthCenter: config.mu,
        growthWidth: config.sigma,
        dt: config.dt,
      });
    }
  }

  /**
   * Get current kernel configuration
   */
  getKernelConfig(): KernelConfig {
    return { ...this.kernelConfig };
  }

  /**
   * Set boundary mode
   */
  setBoundaryMode(mode: BoundaryMode): void {
    this.params.boundaryMode = mode;
    if (this.pipeline) {
      this.pipeline.setBoundaryMode(mode);
    }
  }

  /**
   * Get boundary mode
   */
  getBoundaryMode(): BoundaryMode {
    return this.pipeline?.getBoundaryMode() ?? "periodic";
  }

  /**
   * Apply a preset configuration
   */
  setPreset(presetName: keyof typeof CONTINUOUS_PRESETS): void {
    const preset = CONTINUOUS_PRESETS[presetName];
    if (preset && this.pipeline) {
      this.pipeline.updateKernel(preset.kernel);
      this.pipeline.updateParams({
        ...preset.params,
        kernelRadius: preset.kernel.radius,
      });
      this.params = {
        ...this.params,
        ...preset.params,
        kernelRadius: preset.kernel.radius,
      };
    }
  }

  /**
   * Check if using FFT for convolution
   */
  isUsingFFT(): boolean {
    return this.pipeline?.isUsingFFT() ?? false;
  }

  /**
   * Set normalization factor for mass conservation
   */
  setNormalizationFactor(factor: number): void {
    if (this.pipeline) {
      this.pipeline.setNormalizationFactor(factor);
    }
  }

  /**
   * Get underlying pipeline (for advanced usage)
   */
  getPipeline(): ContinuousPipeline | null {
    return this.pipeline;
  }

  override getConfig(): Record<string, unknown> {
    return {
      kernelConfig: this.kernelConfig,
      params: this.params,
      boundaryMode: this.getBoundaryMode(),
    };
  }

  override setConfig(config: Record<string, unknown>): void {
    if (config.kernelConfig && typeof config.kernelConfig === "object") {
      this.setKernelConfig(config.kernelConfig as KernelConfig);
    }
    if (config.params && typeof config.params === "object") {
      this.setParams(config.params as Partial<ContinuousCAParams>);
    }
    if (config.boundaryMode && typeof config.boundaryMode === "string") {
      this.setBoundaryMode(config.boundaryMode as BoundaryMode);
    }
  }
}

/**
 * Factory function for continuous mode
 */
export function createContinuousModeHandler(
  device: GPUDevice,
  gridConfig: { width: number; height: number },
): ContinuousModeHandler {
  return new ContinuousModeHandler(device, gridConfig);
}

// Re-export types
export type { ContinuousCAParams, BoundaryMode };
export { CONTINUOUS_PRESETS };
