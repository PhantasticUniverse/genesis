/**
 * Sensorimotor CA Mode
 * Handles Lenia organisms with agency - sensing gradients, avoiding obstacles,
 * and exhibiting directed movement through chemotaxis
 */

import type { EngineContext } from "../engine-context";
import type { SimulationMode } from "../engine-state";
import {
  BaseModeHandler,
  type ModeInitOptions,
  type ModeStepResult,
} from "./base-mode";
import {
  createSensorimotorPipeline,
  type SensorimotorPipeline,
  type SensorimotorParams,
} from "../../../compute/webgpu/sensorimotor-pipeline";

/**
 * Sensorimotor CA mode configuration
 */
export interface SensorimotorModeConfig {
  params: SensorimotorParams;
  showObstacles: boolean;
  showGradient: boolean;
}

/**
 * Default sensorimotor parameters
 */
const DEFAULT_SENSORIMOTOR_PARAMS: SensorimotorParams = {
  kernelRadius: 15,
  dt: 0.1,
  growthCenter: 0.15,
  growthWidth: 0.03,
  obstacleRepulsion: 2.0,
  motorInfluence: 0.3,
  gradientDiffusion: 0.1,
  gradientDecay: 0.01,
  proximityRadius: 20,
  pheromoneEmission: 0.05,
  pheromoneDiffusion: 0.15,
  pheromoneDecay: 0.02,
};

/**
 * Sensorimotor CA Mode Handler
 * Provides agency to Lenia organisms via:
 * - Gradient sensing (chemotaxis)
 * - Obstacle avoidance
 * - Motor field for directed movement
 * - Pheromone trails for swarm behavior
 */
export class SensorimotorModeHandler extends BaseModeHandler {
  readonly id: SimulationMode = "sensorimotor";
  readonly name = "Sensorimotor Lenia";
  readonly description =
    "Lenia organisms with agency - sensing, obstacle avoidance, and directed movement";

  private pipeline: SensorimotorPipeline | null = null;
  private params: SensorimotorParams = { ...DEFAULT_SENSORIMOTOR_PARAMS };

  // Double-buffered textures for main (RGBA) and aux (RGBA) channels
  private mainTextureA: GPUTexture | null = null;
  private mainTextureB: GPUTexture | null = null;
  private auxTextureA: GPUTexture | null = null;
  private auxTextureB: GPUTexture | null = null;

  // Current buffer index (0=A, 1=B)
  private currentBuffer = 0;

  // Visual options
  private showObstacles = true;
  private showGradient = false;

  async initialize(
    ctx: EngineContext,
    options?: ModeInitOptions,
  ): Promise<void> {
    // Create sensorimotor pipeline
    this.pipeline = createSensorimotorPipeline(
      this.device,
      this.gridWidth,
      this.gridHeight,
      this.params,
    );

    // Create double-buffered RGBA textures
    const textureDescriptor: GPUTextureDescriptor = {
      size: { width: this.gridWidth, height: this.gridHeight },
      format: "rgba32float",
      usage:
        GPUTextureUsage.STORAGE_BINDING |
        GPUTextureUsage.TEXTURE_BINDING |
        GPUTextureUsage.COPY_SRC |
        GPUTextureUsage.COPY_DST,
    };

    this.mainTextureA = this.device.createTexture({
      ...textureDescriptor,
      label: "sensorimotor-main-A",
    });
    this.mainTextureB = this.device.createTexture({
      ...textureDescriptor,
      label: "sensorimotor-main-B",
    });
    this.auxTextureA = this.device.createTexture({
      ...textureDescriptor,
      label: "sensorimotor-aux-A",
    });
    this.auxTextureB = this.device.createTexture({
      ...textureDescriptor,
      label: "sensorimotor-aux-B",
    });

    // Initialize with default pattern
    const pattern = options?.pattern ?? "lenia-seed";
    this.initializeCreaturePattern(pattern);

    this.ready = true;
  }

  /**
   * Initialize creature pattern in the main texture
   */
  private initializeCreaturePattern(pattern: string): void {
    if (!this.mainTextureA) return;

    const data = new Float32Array(this.gridWidth * this.gridHeight * 4);
    const cx = Math.floor(this.gridWidth / 2);
    const cy = Math.floor(this.gridHeight / 2);

    // Channel layout: R=creature, G=obstacle, B=gradient, A=motor
    const setPixel = (
      x: number,
      y: number,
      r: number,
      g: number,
      b: number,
      a: number,
    ) => {
      if (x >= 0 && x < this.gridWidth && y >= 0 && y < this.gridHeight) {
        const idx = (y * this.gridWidth + x) * 4;
        data[idx + 0] = r; // creature
        data[idx + 1] = g; // obstacle
        data[idx + 2] = b; // gradient
        data[idx + 3] = a; // motor
      }
    };

    if (pattern === "lenia-seed" || pattern === "center-blob") {
      // Create a Lenia-style ring seed for the creature
      const radius = this.params.kernelRadius;
      for (let y = 0; y < this.gridHeight; y++) {
        for (let x = 0; x < this.gridWidth; x++) {
          const dx = x - cx;
          const dy = y - cy;
          const r = Math.sqrt(dx * dx + dy * dy);
          const angle = Math.atan2(dy, dx);

          // Asymmetric ring for directional tendency
          const asymmetry = 1 + 0.2 * Math.cos(angle);
          const peakR = radius * 0.5;
          const ringWidth = radius * 0.4;
          const distFromPeak = Math.abs(r / asymmetry - peakR);

          let creature = 0;
          if (distFromPeak < ringWidth) {
            const t = 1 - distFromPeak / ringWidth;
            creature = 0.9 * t * t;
          }

          setPixel(x, y, creature, 0, 0, 0);
        }
      }
    } else if (pattern === "random") {
      // Random sparse pattern
      for (let y = 0; y < this.gridHeight; y++) {
        for (let x = 0; x < this.gridWidth; x++) {
          const creature = Math.random() < 0.15 ? Math.random() * 0.8 : 0;
          setPixel(x, y, creature, 0, 0, 0);
        }
      }
    }

    // Write to texture
    this.device.queue.writeTexture(
      { texture: this.mainTextureA },
      data,
      { bytesPerRow: this.gridWidth * 16 }, // 4 floats * 4 bytes
      { width: this.gridWidth, height: this.gridHeight },
    );

    // Initialize aux texture with zeros
    const auxData = new Float32Array(this.gridWidth * this.gridHeight * 4);
    this.device.queue.writeTexture(
      { texture: this.auxTextureA },
      auxData,
      { bytesPerRow: this.gridWidth * 16 },
      { width: this.gridWidth, height: this.gridHeight },
    );

    this.currentBuffer = 0;
  }

  step(ctx: EngineContext): ModeStepResult {
    if (!this.ready || !this.pipeline) {
      return {
        success: false,
        error: new Error("Sensorimotor mode not initialized"),
      };
    }

    if (
      !this.mainTextureA ||
      !this.mainTextureB ||
      !this.auxTextureA ||
      !this.auxTextureB
    ) {
      return {
        success: false,
        error: new Error("Sensorimotor textures not initialized"),
      };
    }

    try {
      // Get current read/write textures
      const [inputMain, outputMain] =
        this.currentBuffer === 0
          ? [this.mainTextureA, this.mainTextureB]
          : [this.mainTextureB, this.mainTextureA];

      const [inputAux, outputAux] =
        this.currentBuffer === 0
          ? [this.auxTextureA, this.auxTextureB]
          : [this.auxTextureB, this.auxTextureA];

      // Create bind group and dispatch compute
      const bindGroup = this.pipeline.createBindGroup(
        inputMain,
        inputAux,
        outputMain,
        outputAux,
      );

      const commandEncoder = this.device.createCommandEncoder();
      const { x, y } = this.getWorkgroupDimensions();

      const passEncoder = commandEncoder.beginComputePass();
      passEncoder.setPipeline(this.pipeline.computePipeline);
      passEncoder.setBindGroup(0, bindGroup);
      passEncoder.dispatchWorkgroups(x, y);
      passEncoder.end();

      // Copy creature channel (R) to the engine's main buffer for rendering
      const readTexture = ctx.bufferManager.getReadTexture();

      // We need to copy just the R channel from our RGBA output to the single-channel render texture
      // For now, we'll do a custom blit
      this.copyCreatureToRenderTexture(commandEncoder, outputMain, readTexture);

      this.device.queue.submit([commandEncoder.finish()]);

      // Swap buffers
      this.currentBuffer = 1 - this.currentBuffer;

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  /**
   * Copy creature channel from RGBA texture to render texture
   */
  private copyCreatureToRenderTexture(
    encoder: GPUCommandEncoder,
    source: GPUTexture,
    dest: GPUTexture,
  ): void {
    // For r32float destination, we just copy the first channel
    // This is a simplified approach - ideally we'd use a compute shader
    // For now we copy the whole texture and rely on the format conversion
    encoder.copyTextureToTexture(
      { texture: source },
      { texture: dest },
      { width: this.gridWidth, height: this.gridHeight },
    );
  }

  reset(ctx: EngineContext, pattern = "lenia-seed"): void {
    this.initializeCreaturePattern(pattern);
  }

  cleanup(): void {
    if (this.pipeline) {
      this.pipeline.destroy();
      this.pipeline = null;
    }

    this.mainTextureA?.destroy();
    this.mainTextureB?.destroy();
    this.auxTextureA?.destroy();
    this.auxTextureB?.destroy();

    this.mainTextureA = null;
    this.mainTextureB = null;
    this.auxTextureA = null;
    this.auxTextureB = null;

    this.ready = false;
  }

  // ============================================================================
  // Sensorimotor-specific methods
  // ============================================================================

  /**
   * Set obstacles in the simulation
   * @param pattern - 2D array of obstacle values (0-1)
   */
  setObstacles(pattern: Float32Array | number[][]): void {
    if (!this.mainTextureA) return;

    // Read current texture, modify obstacle channel, write back
    const data = new Float32Array(this.gridWidth * this.gridHeight * 4);

    // For simplicity, we'll initialize obstacles directly
    // In production, we'd async readback the current state first

    if (Array.isArray(pattern)) {
      // 2D array
      for (let y = 0; y < Math.min(pattern.length, this.gridHeight); y++) {
        for (let x = 0; x < Math.min(pattern[y].length, this.gridWidth); x++) {
          const idx = (y * this.gridWidth + x) * 4;
          data[idx + 1] = pattern[y][x]; // G channel = obstacle
        }
      }
    } else {
      // Flat array (already formatted)
      for (
        let i = 0;
        i < pattern.length && i < this.gridWidth * this.gridHeight;
        i++
      ) {
        data[i * 4 + 1] = pattern[i]; // G channel = obstacle
      }
    }

    // We need to merge with existing creature data
    // For now, just set obstacles on current buffer
    const currentTexture =
      this.currentBuffer === 0 ? this.mainTextureA : this.mainTextureB;

    this.device.queue.writeTexture(
      { texture: currentTexture },
      data,
      { bytesPerRow: this.gridWidth * 16 },
      { width: this.gridWidth, height: this.gridHeight },
    );
  }

  /**
   * Set a target gradient point
   * Creates a radial gradient centered at the given coordinates
   */
  setTargetGradient(x: number, y: number, radius = 50, strength = 1.0): void {
    if (!this.mainTextureA) return;

    // Create gradient data
    const data = new Float32Array(this.gridWidth * this.gridHeight * 4);

    for (let py = 0; py < this.gridHeight; py++) {
      for (let px = 0; px < this.gridWidth; px++) {
        const dx = px - x;
        const dy = py - y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        // Gradient value: higher closer to target
        const gradient = dist < radius ? strength * (1 - dist / radius) : 0;

        const idx = (py * this.gridWidth + px) * 4;
        data[idx + 2] = gradient; // B channel = gradient
      }
    }

    // Merge with current texture (we'd ideally readback first)
    const currentTexture =
      this.currentBuffer === 0 ? this.mainTextureA : this.mainTextureB;

    // For now, just write the gradient channel
    // This is simplified - production code would blend with existing data
    this.device.queue.writeTexture(
      { texture: currentTexture },
      data,
      { bytesPerRow: this.gridWidth * 16 },
      { width: this.gridWidth, height: this.gridHeight },
    );
  }

  /**
   * Clear the target gradient
   */
  clearGradient(): void {
    if (!this.mainTextureA || !this.mainTextureB) return;

    // Create zero gradient data
    const data = new Float32Array(this.gridWidth * this.gridHeight * 4);

    // Write to both textures
    const writeOptions = {
      bytesPerRow: this.gridWidth * 16,
    };
    const size = { width: this.gridWidth, height: this.gridHeight };

    this.device.queue.writeTexture(
      { texture: this.mainTextureA },
      data,
      writeOptions,
      size,
    );
    this.device.queue.writeTexture(
      { texture: this.mainTextureB },
      data,
      writeOptions,
      size,
    );
  }

  /**
   * Add a rectangular obstacle
   */
  addObstacleRect(x: number, y: number, width: number, height: number): void {
    if (!this.mainTextureA) return;

    const currentTexture =
      this.currentBuffer === 0 ? this.mainTextureA : this.mainTextureB;

    // Create obstacle data for the region
    const data = new Float32Array(width * height * 4);
    for (let i = 0; i < width * height; i++) {
      data[i * 4 + 1] = 1.0; // G channel = obstacle
    }

    this.device.queue.writeTexture(
      { texture: currentTexture, origin: { x, y } },
      data,
      { bytesPerRow: width * 16 },
      { width, height },
    );
  }

  /**
   * Clear all obstacles
   */
  clearObstacles(): void {
    // Re-initialize without obstacles
    this.initializeCreaturePattern("lenia-seed");
  }

  /**
   * Update sensorimotor parameters
   */
  setParams(params: Partial<SensorimotorParams>): void {
    this.params = { ...this.params, ...params };
    if (this.pipeline) {
      this.pipeline.updateParams(params);
    }
  }

  /**
   * Get current parameters
   */
  getParams(): SensorimotorParams {
    return { ...this.params };
  }

  /**
   * Set whether to show obstacles in visualization
   */
  setShowObstacles(show: boolean): void {
    this.showObstacles = show;
  }

  /**
   * Set whether to show gradient field in visualization
   */
  setShowGradient(show: boolean): void {
    this.showGradient = show;
  }

  /**
   * Get current main texture for custom rendering
   */
  getMainTexture(): GPUTexture | null {
    return this.currentBuffer === 0 ? this.mainTextureB : this.mainTextureA;
  }

  /**
   * Get current aux texture (proximity, pheromone)
   */
  getAuxTexture(): GPUTexture | null {
    return this.currentBuffer === 0 ? this.auxTextureB : this.auxTextureA;
  }

  override getConfig(): Record<string, unknown> {
    return {
      params: this.params,
      showObstacles: this.showObstacles,
      showGradient: this.showGradient,
    };
  }

  override setConfig(config: Record<string, unknown>): void {
    if (config.params && typeof config.params === "object") {
      this.setParams(config.params as Partial<SensorimotorParams>);
    }
    if (typeof config.showObstacles === "boolean") {
      this.showObstacles = config.showObstacles;
    }
    if (typeof config.showGradient === "boolean") {
      this.showGradient = config.showGradient;
    }
  }
}

/**
 * Factory function for sensorimotor mode
 */
export function createSensorimotorModeHandler(
  device: GPUDevice,
  gridConfig: { width: number; height: number },
): SensorimotorModeHandler {
  return new SensorimotorModeHandler(device, gridConfig);
}

// Re-export types
export type { SensorimotorParams };
