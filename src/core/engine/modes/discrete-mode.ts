/**
 * Discrete CA Mode
 * Handles Game of Life and other discrete cellular automata
 */

import type { EngineContext } from "../engine-context";
import type { SimulationMode } from "../engine-state";
import {
  BaseModeHandler,
  type ModeInitOptions,
  type ModeStepResult,
} from "./base-mode";
import type { DiscreteRule } from "../../types";
import { GAME_OF_LIFE_RULE } from "../../types";
import { initializePattern } from "../../buffer-manager";
import { createShaderModule } from "../../../compute/webgpu/context";
import discreteCAShader from "../../../compute/webgpu/shaders/discrete-ca.wgsl?raw";

/**
 * Convert B/S rule arrays to bitmasks
 */
function ruleToBitmask(rule: number[]): number {
  let mask = 0;
  for (const n of rule) {
    if (n >= 0 && n <= 8) {
      mask |= 1 << n;
    }
  }
  return mask;
}

/**
 * Discrete CA mode configuration
 */
export interface DiscreteModeConfig {
  rule: DiscreteRule;
}

/**
 * Discrete CA Mode Handler
 */
export class DiscreteModeHandler extends BaseModeHandler {
  readonly id: SimulationMode = "discrete";
  readonly name = "Discrete CA";
  readonly description =
    "Game of Life and other discrete cellular automata (B/S rules)";

  private computePipeline: GPUComputePipeline | null = null;
  private computeBindGroupLayout: GPUBindGroupLayout | null = null;
  private uniformBuffer: GPUBuffer | null = null;
  private rule: DiscreteRule = GAME_OF_LIFE_RULE;

  async initialize(
    ctx: EngineContext,
    options?: ModeInitOptions,
  ): Promise<void> {
    // Create compute shader module
    const computeShaderModule = createShaderModule(
      this.device,
      discreteCAShader,
      "discrete-ca",
    );

    // Create bind group layout
    this.computeBindGroupLayout = this.device.createBindGroupLayout({
      label: "discrete-ca-bind-group-layout",
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.COMPUTE,
          texture: { sampleType: "unfilterable-float" },
        },
        {
          binding: 1,
          visibility: GPUShaderStage.COMPUTE,
          storageTexture: { access: "write-only", format: "r32float" },
        },
        {
          binding: 2,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: "uniform" },
        },
      ],
    });

    // Create compute pipeline
    this.computePipeline = this.device.createComputePipeline({
      label: "discrete-ca-pipeline",
      layout: this.device.createPipelineLayout({
        bindGroupLayouts: [this.computeBindGroupLayout],
      }),
      compute: {
        module: computeShaderModule,
        entryPoint: "main",
      },
    });

    // Create uniform buffer
    this.uniformBuffer = this.device.createBuffer({
      label: "discrete-ca-uniform-buffer",
      size: 16, // 4 x u32
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    // Initialize uniforms
    this.updateUniforms();

    // Initialize pattern
    const pattern = options?.pattern ?? "random";
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
    if (
      !this.ready ||
      !this.computePipeline ||
      !this.computeBindGroupLayout ||
      !this.uniformBuffer
    ) {
      return {
        success: false,
        error: new Error("Discrete mode not initialized"),
      };
    }

    try {
      const readTexture = ctx.bufferManager.getReadTexture();
      const writeTexture = ctx.bufferManager.getWriteTexture();

      // Create bind group
      const computeBindGroup = this.device.createBindGroup({
        label: "discrete-ca-bind-group",
        layout: this.computeBindGroupLayout,
        entries: [
          { binding: 0, resource: readTexture.createView() },
          { binding: 1, resource: writeTexture.createView() },
          { binding: 2, resource: { buffer: this.uniformBuffer } },
        ],
      });

      const commandEncoder = this.device.createCommandEncoder();
      const computePass = commandEncoder.beginComputePass();
      computePass.setPipeline(this.computePipeline);
      computePass.setBindGroup(0, computeBindGroup);

      const { x, y } = this.getWorkgroupDimensions();
      computePass.dispatchWorkgroups(x, y);
      computePass.end();

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

  reset(ctx: EngineContext, pattern = "random"): void {
    initializePattern(
      this.device,
      ctx.bufferManager.getReadTexture(),
      this.gridWidth,
      this.gridHeight,
      pattern as "random" | "center-blob" | "lenia-seed" | "glider" | "blinker",
    );
  }

  cleanup(): void {
    if (this.uniformBuffer) {
      this.uniformBuffer.destroy();
      this.uniformBuffer = null;
    }
    this.computePipeline = null;
    this.computeBindGroupLayout = null;
    this.ready = false;
  }

  /**
   * Set the discrete rule (B/S format)
   */
  setRule(rule: DiscreteRule): void {
    this.rule = rule;
    this.updateUniforms();
    this.config = { ...this.config, rule };
  }

  /**
   * Get current rule
   */
  getRule(): DiscreteRule {
    return this.rule;
  }

  private updateUniforms(): void {
    if (!this.uniformBuffer) return;

    const data = new Uint32Array([
      this.gridWidth,
      this.gridHeight,
      ruleToBitmask(this.rule.birth),
      ruleToBitmask(this.rule.survival),
    ]);
    this.device.queue.writeBuffer(this.uniformBuffer, 0, data);
  }

  override getConfig(): Record<string, unknown> {
    return {
      rule: this.rule,
    };
  }

  override setConfig(config: Record<string, unknown>): void {
    if (config.rule && typeof config.rule === "object") {
      this.setRule(config.rule as DiscreteRule);
    }
  }
}

/**
 * Factory function for discrete mode
 */
export function createDiscreteModeHandler(
  device: GPUDevice,
  gridConfig: { width: number; height: number },
): DiscreteModeHandler {
  return new DiscreteModeHandler(device, gridConfig);
}
