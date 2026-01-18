/**
 * Engine Context
 * Shared GPU resources and configuration for all simulation modes
 */

import type { GridConfig } from "../types";
import { DEFAULT_GRID_CONFIG } from "../types";
import { createBufferManager, type BufferManager } from "../buffer-manager";
import {
  createAsyncReadbackManager,
  type AsyncReadbackManager,
} from "../async-readback";
import { initWebGPU, createShaderModule } from "../../compute/webgpu/context";
import type { TexturePool } from "../../compute/webgpu/texture-pool";
import { createTexturePool } from "../../compute/webgpu/texture-pool";
import renderShader from "../../compute/webgpu/shaders/render.wgsl?raw";

/**
 * Colormap IDs matching the render shader
 */
export const COLORMAP_IDS = {
  grayscale: 0,
  classic: 1,
  viridis: 2,
  plasma: 3,
  inferno: 4,
  fire: 5,
  ocean: 6,
  rainbow: 7,
  neon: 8,
  turbo: 9,
  earth: 10,
  magma: 11,
} as const;

export type ColormapName = keyof typeof COLORMAP_IDS;

/**
 * Engine context configuration
 */
export interface EngineContextConfig {
  canvas: HTMLCanvasElement;
  gridConfig?: GridConfig;
}

/**
 * Engine context - shared resources across all modes
 */
export interface EngineContext {
  // WebGPU core resources
  device: GPUDevice;
  context: GPUCanvasContext;
  presentationFormat: GPUTextureFormat;

  // Grid configuration
  gridConfig: GridConfig;

  // Buffer management
  bufferManager: BufferManager;
  asyncReadback: AsyncReadbackManager;
  texturePool: TexturePool;

  // Legacy staging buffer (for synchronous readback)
  stagingBuffer: GPUBuffer;
  bytesPerRow: number;

  // Render resources
  renderPipeline: GPURenderPipeline;
  renderBindGroupLayout: GPUBindGroupLayout;
  renderUniformBuffer: GPUBuffer;

  // State
  colormap: ColormapName;
  showObstacles: boolean;

  // Methods
  updateRenderUniforms(): void;
  render(): void;
  readState(): Promise<Float32Array | null>;
  requestStateReadback(): void;
  pollState(): Float32Array | null;
  isReadbackPending(): boolean;
  destroy(): void;
}

/**
 * Create engine context with all shared GPU resources
 */
export async function createEngineContext(
  config: EngineContextConfig,
): Promise<EngineContext> {
  const { canvas } = config;
  const gridConfig = config.gridConfig ?? DEFAULT_GRID_CONFIG;

  // Initialize WebGPU
  const { device } = await initWebGPU();

  // Configure canvas context
  const context = canvas.getContext("webgpu");
  if (!context) {
    throw new Error("Failed to get WebGPU canvas context");
  }

  const presentationFormat = navigator.gpu.getPreferredCanvasFormat();
  context.configure({
    device,
    format: presentationFormat,
    alphaMode: "premultiplied",
  });

  // Create buffer manager
  const bufferManager = createBufferManager(device, gridConfig);

  // Create staging buffer for GPU -> CPU readback (legacy synchronous)
  const bytesPerRow = Math.ceil((gridConfig.width * 4) / 256) * 256;
  const stagingBuffer = device.createBuffer({
    label: "staging-buffer",
    size: bytesPerRow * gridConfig.height,
    usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
  });

  // Create async readback manager
  const asyncReadback = createAsyncReadbackManager(device, {
    width: gridConfig.width,
    height: gridConfig.height,
  });

  // Create texture pool for efficient memory management
  const texturePool = createTexturePool(device);

  // Create render shader module
  const renderShaderModule = createShaderModule(device, renderShader, "render");

  // Create render bind group layout (using unfilterable-float for r32float textures)
  const renderBindGroupLayout = device.createBindGroupLayout({
    label: "render-bind-group-layout",
    entries: [
      {
        binding: 0,
        visibility: GPUShaderStage.FRAGMENT,
        texture: { sampleType: "unfilterable-float" },
      },
      {
        binding: 1,
        visibility: GPUShaderStage.FRAGMENT,
        buffer: { type: "uniform" },
      },
      {
        binding: 2,
        visibility: GPUShaderStage.FRAGMENT,
        texture: { sampleType: "unfilterable-float" },
      },
    ],
  });

  // Create render uniform buffer
  const renderUniformBuffer = device.createBuffer({
    label: "render-uniform-buffer",
    size: 16, // 2 x u32 (size) + u32 (colormap) + u32 (show_obstacles)
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  // Create render pipeline
  const renderPipeline = device.createRenderPipeline({
    label: "render-pipeline",
    layout: device.createPipelineLayout({
      bindGroupLayouts: [renderBindGroupLayout],
    }),
    vertex: {
      module: renderShaderModule,
      entryPoint: "vs_main",
    },
    fragment: {
      module: renderShaderModule,
      entryPoint: "fs_main",
      targets: [{ format: presentationFormat }],
    },
    primitive: {
      topology: "triangle-list",
    },
  });

  // State
  let colormap: ColormapName = "viridis";
  let showObstacles = false;

  // Create a dummy obstacle texture for initial render binding
  const dummyObstacleTexture = device.createTexture({
    label: "dummy-obstacle-texture",
    size: [gridConfig.width, gridConfig.height],
    format: "rgba32float",
    usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
  });

  /**
   * Update render uniforms
   */
  function updateRenderUniforms() {
    device.queue.writeBuffer(
      renderUniformBuffer,
      0,
      new Uint32Array([
        gridConfig.width,
        gridConfig.height,
        COLORMAP_IDS[colormap],
        showObstacles ? 1 : 0,
      ]),
    );
  }

  // Initial uniform update
  updateRenderUniforms();

  /**
   * Render current state
   */
  function render() {
    const readTexture = bufferManager.getReadTexture();

    const renderBindGroup = device.createBindGroup({
      label: "render-bind-group",
      layout: renderBindGroupLayout,
      entries: [
        { binding: 0, resource: readTexture.createView() },
        { binding: 1, resource: { buffer: renderUniformBuffer } },
        { binding: 2, resource: dummyObstacleTexture.createView() },
      ],
    });

    const commandEncoder = device.createCommandEncoder();
    const renderPass = commandEncoder.beginRenderPass({
      colorAttachments: [
        {
          view: context!.getCurrentTexture().createView(),
          clearValue: { r: 0, g: 0, b: 0, a: 1 },
          loadOp: "clear",
          storeOp: "store",
        },
      ],
    });
    renderPass.setPipeline(renderPipeline);
    renderPass.setBindGroup(0, renderBindGroup);
    renderPass.draw(3);
    renderPass.end();

    device.queue.submit([commandEncoder.finish()]);
  }

  /**
   * Read state synchronously (blocking)
   */
  async function readState(): Promise<Float32Array | null> {
    try {
      const readTexture = bufferManager.getReadTexture();

      const commandEncoder = device.createCommandEncoder();
      commandEncoder.copyTextureToBuffer(
        { texture: readTexture },
        { buffer: stagingBuffer, bytesPerRow },
        { width: gridConfig.width, height: gridConfig.height },
      );
      device.queue.submit([commandEncoder.finish()]);

      await stagingBuffer.mapAsync(GPUMapMode.READ);
      const mappedRange = stagingBuffer.getMappedRange();

      // Copy data (accounting for row padding)
      const result = new Float32Array(gridConfig.width * gridConfig.height);
      const sourceData = new Float32Array(mappedRange);

      const actualBytesPerRow = bytesPerRow / 4;
      for (let y = 0; y < gridConfig.height; y++) {
        const srcOffset = y * actualBytesPerRow;
        const dstOffset = y * gridConfig.width;
        for (let x = 0; x < gridConfig.width; x++) {
          result[dstOffset + x] = sourceData[srcOffset + x];
        }
      }

      stagingBuffer.unmap();
      return result;
    } catch (e) {
      console.error("Failed to read state:", e);
      return null;
    }
  }

  /**
   * Request async state readback
   */
  function requestStateReadback() {
    const readTexture = bufferManager.getReadTexture();
    const commandEncoder = device.createCommandEncoder();
    asyncReadback.requestReadback(commandEncoder, readTexture);
    device.queue.submit([commandEncoder.finish()]);
  }

  /**
   * Poll for async readback result
   */
  function pollState(): Float32Array | null {
    return asyncReadback.pollResult();
  }

  /**
   * Check if readback is pending
   */
  function isReadbackPending(): boolean {
    return asyncReadback.isPending();
  }

  /**
   * Destroy all resources
   */
  function destroy() {
    const safeDestroy = (fn: () => void, name: string) => {
      try {
        fn();
      } catch (e) {
        console.warn(`Failed to destroy ${name}:`, e);
      }
    };

    safeDestroy(() => bufferManager.destroy(), "bufferManager");
    safeDestroy(() => stagingBuffer.destroy(), "stagingBuffer");
    safeDestroy(() => asyncReadback.destroy(), "asyncReadback");
    safeDestroy(() => texturePool.destroy(), "texturePool");
    safeDestroy(() => dummyObstacleTexture.destroy(), "dummyObstacleTexture");
  }

  const engineContext: EngineContext = {
    device,
    context,
    presentationFormat,
    gridConfig,
    bufferManager,
    asyncReadback,
    texturePool,
    stagingBuffer,
    bytesPerRow,
    renderPipeline,
    renderBindGroupLayout,
    renderUniformBuffer,

    get colormap() {
      return colormap;
    },
    set colormap(value: ColormapName) {
      colormap = value;
      updateRenderUniforms();
    },

    get showObstacles() {
      return showObstacles;
    },
    set showObstacles(value: boolean) {
      showObstacles = value;
      updateRenderUniforms();
    },

    updateRenderUniforms,
    render,
    readState,
    requestStateReadback,
    pollState,
    isReadbackPending,
    destroy,
  };

  return engineContext;
}
