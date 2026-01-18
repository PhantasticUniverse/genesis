/**
 * Multi-Kernel Lenia Mode
 * Handles simulations with multiple convolution kernels
 */

import type { EngineContext } from "../engine-context";
import type { SimulationMode } from "../engine-state";
import {
  BaseModeHandler,
  type ModeInitOptions,
  type ModeStepResult,
} from "./base-mode";
import type {
  MultiKernelConfig,
  SingleKernelParams,
  GrowthParams,
} from "../../types";
import { DEFAULT_MULTIKERNEL_CONFIG } from "../../types";
import { initializePattern } from "../../buffer-manager";
import {
  createMultiKernelPipeline,
  type MultiKernelPipeline,
} from "../../../compute/webgpu/multi-kernel-pipeline";
import { MULTIKERNEL_PRESETS } from "../../multi-kernel";

/**
 * Multi-Kernel Lenia Mode Handler
 */
export class MultiKernelModeHandler extends BaseModeHandler {
  readonly id: SimulationMode = "multikernel";
  readonly name = "Multi-Kernel Lenia";
  readonly description =
    "Lenia with multiple weighted convolution kernels (up to 4)";

  private pipeline: MultiKernelPipeline | null = null;
  private multiKernelConfig: MultiKernelConfig = {
    ...DEFAULT_MULTIKERNEL_CONFIG,
  };

  async initialize(
    ctx: EngineContext,
    options?: ModeInitOptions,
  ): Promise<void> {
    // Create multi-kernel pipeline
    this.pipeline = createMultiKernelPipeline(
      this.device,
      this.gridWidth,
      this.gridHeight,
      this.multiKernelConfig,
    );

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
        error: new Error("Multi-kernel mode not initialized"),
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
   * Set multi-kernel configuration
   */
  setMultiKernelConfig(config: MultiKernelConfig): void {
    this.multiKernelConfig = { ...config };
    if (this.pipeline) {
      this.pipeline.updateConfig(config);
    }
  }

  /**
   * Get multi-kernel configuration
   */
  getMultiKernelConfig(): MultiKernelConfig {
    return { ...this.multiKernelConfig };
  }

  /**
   * Apply a preset configuration
   */
  setPreset(presetName: string): void {
    const preset = MULTIKERNEL_PRESETS[presetName];
    if (preset) {
      this.setMultiKernelConfig(preset);
    }
  }

  /**
   * Update a specific kernel's parameters
   */
  updateKernel(index: number, params: Partial<SingleKernelParams>): void {
    if (index < 0 || index >= this.multiKernelConfig.kernels.length) return;

    const kernel = this.multiKernelConfig.kernels[index];
    const updatedKernel = { ...kernel, ...params };
    this.multiKernelConfig.kernels[index] = updatedKernel;

    if (this.pipeline) {
      this.pipeline.updateKernelParams(
        index,
        updatedKernel.radius,
        updatedKernel.weight,
      );
    }
  }

  /**
   * Update a specific kernel's growth parameters
   */
  updateGrowth(index: number, params: Partial<GrowthParams>): void {
    if (index < 0 || index >= this.multiKernelConfig.growthParams.length)
      return;

    const growth = this.multiKernelConfig.growthParams[index];
    const updatedGrowth = { ...growth, ...params };
    this.multiKernelConfig.growthParams[index] = updatedGrowth;

    if (this.pipeline) {
      this.pipeline.updateGrowthParams(index, updatedGrowth);
    }
  }

  /**
   * Add a new kernel
   */
  addKernel(params?: SingleKernelParams, growth?: GrowthParams): boolean {
    if (
      this.multiKernelConfig.kernels.length >= this.multiKernelConfig.maxKernels
    ) {
      return false;
    }

    const newIndex = this.multiKernelConfig.kernels.length;
    const newKernel = params ?? {
      id: `kernel-${newIndex}`,
      shape: "polynomial" as const,
      radius: 13,
      peaks: [0.5],
      weight: 0.5,
    };
    const newGrowth = growth ?? {
      type: "gaussian" as const,
      mu: 0.12,
      sigma: 0.04,
    };

    this.multiKernelConfig = {
      ...this.multiKernelConfig,
      kernels: [...this.multiKernelConfig.kernels, newKernel],
      growthParams: [...this.multiKernelConfig.growthParams, newGrowth],
    };

    if (this.pipeline) {
      this.pipeline.updateConfig(this.multiKernelConfig);
    }

    return true;
  }

  /**
   * Remove a kernel
   */
  removeKernel(index: number): boolean {
    if (this.multiKernelConfig.kernels.length <= 1) return false;
    if (index < 0 || index >= this.multiKernelConfig.kernels.length)
      return false;

    this.multiKernelConfig = {
      ...this.multiKernelConfig,
      kernels: this.multiKernelConfig.kernels.filter((_, i) => i !== index),
      growthParams: this.multiKernelConfig.growthParams.filter(
        (_, i) => i !== index,
      ),
    };

    if (this.pipeline) {
      this.pipeline.updateConfig(this.multiKernelConfig);
    }

    return true;
  }

  /**
   * Get number of active kernels
   */
  getKernelCount(): number {
    return this.multiKernelConfig.kernels.length;
  }

  /**
   * Get underlying pipeline (for advanced usage)
   */
  getPipeline(): MultiKernelPipeline | null {
    return this.pipeline;
  }

  override getConfig(): Record<string, unknown> {
    return {
      multiKernelConfig: this.multiKernelConfig,
    };
  }

  override setConfig(config: Record<string, unknown>): void {
    if (
      config.multiKernelConfig &&
      typeof config.multiKernelConfig === "object"
    ) {
      this.setMultiKernelConfig(config.multiKernelConfig as MultiKernelConfig);
    }
  }
}

/**
 * Factory function for multi-kernel mode
 */
export function createMultiKernelModeHandler(
  device: GPUDevice,
  gridConfig: { width: number; height: number },
): MultiKernelModeHandler {
  return new MultiKernelModeHandler(device, gridConfig);
}

// Re-export types
export type { MultiKernelConfig, SingleKernelParams, GrowthParams };
export { MULTIKERNEL_PRESETS };
