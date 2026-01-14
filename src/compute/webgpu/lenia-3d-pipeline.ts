/**
 * 3D Lenia Pipeline
 * Handles 3D cellular automata compute shaders
 */

import {
  generate3DKernel,
  normalize3DKernel,
  createKernel3DTexture,
  KERNEL_3D_PRESETS,
} from '../../core/kernels-3d';
import type { Grid3DConfig, Lenia3DParams, Kernel3DConfig } from '../../core/types-3d';
import { DEFAULT_LENIA_3D_PARAMS, DEFAULT_KERNEL_3D_CONFIG } from '../../core/types-3d';
import { createShaderModule } from './context';
import continuousCA3DShader from './shaders/continuous-ca-3d.wgsl?raw';

export interface Lenia3DPipeline {
  /** Update simulation parameters */
  updateParams(params: Partial<Lenia3DParams>): void;

  /** Update kernel configuration */
  updateKernel(config: Kernel3DConfig): void;

  /** Set initial state from Float32Array */
  setState(state: Float32Array): void;

  /** Get current state as Float32Array (async GPU readback) */
  getState(): Promise<Float32Array>;

  /** Execute one simulation step */
  step(commandEncoder: GPUCommandEncoder): void;

  /** Get the current state texture for rendering */
  getStateTexture(): GPUTexture;

  /** Get current ping-pong buffer index (0 or 1) */
  getCurrentBufferIndex(): 0 | 1;

  /** Get grid configuration */
  getGridConfig(): Grid3DConfig;

  /** Get current parameters */
  getParams(): Lenia3DParams;

  /** Clean up GPU resources */
  destroy(): void;
}

/**
 * Create a 3D Lenia compute pipeline
 */
export function createLenia3DPipeline(
  device: GPUDevice,
  config: Grid3DConfig,
  initialParams: Lenia3DParams = DEFAULT_LENIA_3D_PARAMS,
  initialKernel: Kernel3DConfig = DEFAULT_KERNEL_3D_CONFIG
): Lenia3DPipeline {
  const { width, height, depth } = config;

  // Generate and normalize initial kernel
  let kernelData = normalize3DKernel(generate3DKernel(initialKernel));
  let kernelTexture = createKernel3DTexture(device, kernelData);

  // Create shader module
  const shaderModule = createShaderModule(device, continuousCA3DShader, 'continuous-ca-3d');

  // Create state textures (ping-pong buffers)
  const createStateTexture = (label: string): GPUTexture => {
    return device.createTexture({
      label,
      size: [width, height, depth],
      format: 'r32float',
      dimension: '3d',
      usage:
        GPUTextureUsage.TEXTURE_BINDING |
        GPUTextureUsage.STORAGE_BINDING |
        GPUTextureUsage.COPY_SRC |
        GPUTextureUsage.COPY_DST,
    });
  };

  const stateTextures: [GPUTexture, GPUTexture] = [
    createStateTexture('lenia-3d-state-0'),
    createStateTexture('lenia-3d-state-1'),
  ];

  let currentBuffer: 0 | 1 = 0;

  // Create bind group layout
  const bindGroupLayout = device.createBindGroupLayout({
    label: 'lenia-3d-bind-group-layout',
    entries: [
      {
        binding: 0,
        visibility: GPUShaderStage.COMPUTE,
        texture: { sampleType: 'unfilterable-float', viewDimension: '3d' },
      },
      {
        binding: 1,
        visibility: GPUShaderStage.COMPUTE,
        storageTexture: { access: 'write-only', format: 'r32float', viewDimension: '3d' },
      },
      {
        binding: 2,
        visibility: GPUShaderStage.COMPUTE,
        buffer: { type: 'uniform' },
      },
      {
        binding: 3,
        visibility: GPUShaderStage.COMPUTE,
        texture: { sampleType: 'unfilterable-float', viewDimension: '3d' },
      },
    ],
  });

  // Create compute pipeline
  const computePipeline = device.createComputePipeline({
    label: 'lenia-3d-pipeline',
    layout: device.createPipelineLayout({
      bindGroupLayouts: [bindGroupLayout],
    }),
    compute: {
      module: shaderModule,
      entryPoint: 'main',
    },
  });

  // Create uniform buffer
  // Layout: width, height, depth, kernel_radius, growth_center, growth_width, dt, padding
  const uniformBuffer = device.createBuffer({
    label: 'lenia-3d-uniform-buffer',
    size: 32, // 8 x 4 bytes
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  // Create staging buffer for GPU readback
  const stagingBuffer = device.createBuffer({
    label: 'lenia-3d-staging-buffer',
    size: width * height * depth * 4, // Float32
    usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
  });

  // Current parameters
  let currentParams: Lenia3DParams = { ...initialParams };

  // Write uniforms to GPU
  function writeUniforms() {
    const data = new ArrayBuffer(32);
    const u32View = new Uint32Array(data);
    const f32View = new Float32Array(data);

    u32View[0] = width;
    u32View[1] = height;
    u32View[2] = depth;
    u32View[3] = currentParams.kernelRadius;
    f32View[4] = currentParams.growthCenter;
    f32View[5] = currentParams.growthWidth;
    f32View[6] = currentParams.dt;
    u32View[7] = 0; // padding

    device.queue.writeBuffer(uniformBuffer, 0, data);
  }

  // Initialize uniforms
  writeUniforms();

  // Create bind groups for ping-pong
  function createBindGroup(readIndex: 0 | 1): GPUBindGroup {
    const writeIndex = readIndex === 0 ? 1 : 0;
    return device.createBindGroup({
      label: `lenia-3d-bind-group-${readIndex}`,
      layout: bindGroupLayout,
      entries: [
        { binding: 0, resource: stateTextures[readIndex].createView({ dimension: '3d' }) },
        { binding: 1, resource: stateTextures[writeIndex].createView({ dimension: '3d' }) },
        { binding: 2, resource: { buffer: uniformBuffer } },
        { binding: 3, resource: kernelTexture.createView({ dimension: '3d' }) },
      ],
    });
  }

  // Calculate workgroup counts
  const workgroupSize = 4; // 4x4x4 workgroups
  const workgroupsX = Math.ceil(width / workgroupSize);
  const workgroupsY = Math.ceil(height / workgroupSize);
  const workgroupsZ = Math.ceil(depth / workgroupSize);

  return {
    updateParams(params: Partial<Lenia3DParams>) {
      currentParams = { ...currentParams, ...params };
      writeUniforms();
    },

    updateKernel(kernelConfig: Kernel3DConfig) {
      // Destroy old kernel texture
      kernelTexture.destroy();

      // Generate new kernel
      kernelData = normalize3DKernel(generate3DKernel(kernelConfig));
      kernelTexture = createKernel3DTexture(device, kernelData);

      // Update kernel radius in params
      currentParams.kernelRadius = kernelConfig.radius;
      writeUniforms();
    },

    setState(state: Float32Array) {
      if (state.length !== width * height * depth) {
        throw new Error(
          `State size mismatch: expected ${width * height * depth}, got ${state.length}`
        );
      }

      // Write to current state texture
      device.queue.writeTexture(
        { texture: stateTextures[currentBuffer] },
        state,
        {
          bytesPerRow: width * 4,
          rowsPerImage: height,
        },
        { width, height, depthOrArrayLayers: depth }
      );
    },

    async getState(): Promise<Float32Array> {
      // Copy current state to staging buffer
      const commandEncoder = device.createCommandEncoder();
      commandEncoder.copyTextureToBuffer(
        { texture: stateTextures[currentBuffer] },
        {
          buffer: stagingBuffer,
          bytesPerRow: width * 4,
          rowsPerImage: height,
        },
        { width, height, depthOrArrayLayers: depth }
      );
      device.queue.submit([commandEncoder.finish()]);

      // Map and read staging buffer
      await stagingBuffer.mapAsync(GPUMapMode.READ);
      const copyArrayBuffer = stagingBuffer.getMappedRange();
      const data = new Float32Array(copyArrayBuffer.slice(0));
      stagingBuffer.unmap();

      return data;
    },

    step(commandEncoder: GPUCommandEncoder) {
      const bindGroup = createBindGroup(currentBuffer);

      const pass = commandEncoder.beginComputePass();
      pass.setPipeline(computePipeline);
      pass.setBindGroup(0, bindGroup);
      pass.dispatchWorkgroups(workgroupsX, workgroupsY, workgroupsZ);
      pass.end();

      // Swap buffers
      currentBuffer = currentBuffer === 0 ? 1 : 0;
    },

    getStateTexture(): GPUTexture {
      return stateTextures[currentBuffer];
    },

    getCurrentBufferIndex(): 0 | 1 {
      return currentBuffer;
    },

    getGridConfig(): Grid3DConfig {
      return { width, height, depth };
    },

    getParams(): Lenia3DParams {
      return { ...currentParams };
    },

    destroy() {
      stateTextures[0].destroy();
      stateTextures[1].destroy();
      kernelTexture.destroy();
      uniformBuffer.destroy();
      stagingBuffer.destroy();
    },
  };
}

/**
 * Generate initial state: spherical blob with Gaussian falloff
 */
export function generateSphericalBlob(
  config: Grid3DConfig,
  centerX?: number,
  centerY?: number,
  centerZ?: number,
  radius?: number,
  peak?: number
): Float32Array {
  const { width, height, depth } = config;
  const state = new Float32Array(width * height * depth);

  const cx = centerX ?? width / 2;
  const cy = centerY ?? height / 2;
  const cz = centerZ ?? depth / 2;
  const r = radius ?? Math.min(width, height, depth) / 6;
  const p = peak ?? 1.0;

  for (let z = 0; z < depth; z++) {
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const dx = x - cx;
        const dy = y - cy;
        const dz = z - cz;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

        // Gaussian falloff
        const sigma = r / 2;
        const value = p * Math.exp(-(dist * dist) / (2 * sigma * sigma));

        const index = z * width * height + y * width + x;
        state[index] = Math.min(1, Math.max(0, value));
      }
    }
  }

  return state;
}

/**
 * Generate initial state: random noise
 */
export function generateRandom3DState(
  config: Grid3DConfig,
  density: number = 0.1
): Float32Array {
  const { width, height, depth } = config;
  const state = new Float32Array(width * height * depth);

  for (let i = 0; i < state.length; i++) {
    state[i] = Math.random() < density ? Math.random() : 0;
  }

  return state;
}

/**
 * Extract a 2D slice from 3D state for visualization
 */
export function extract3DSlice(
  state: Float32Array,
  config: Grid3DConfig,
  plane: 'xy' | 'xz' | 'yz',
  position: number
): Float32Array {
  const { width, height, depth } = config;
  let sliceWidth: number, sliceHeight: number;
  const slice = (() => {
    switch (plane) {
      case 'xy':
        sliceWidth = width;
        sliceHeight = height;
        return new Float32Array(sliceWidth * sliceHeight);
      case 'xz':
        sliceWidth = width;
        sliceHeight = depth;
        return new Float32Array(sliceWidth * sliceHeight);
      case 'yz':
        sliceWidth = height;
        sliceHeight = depth;
        return new Float32Array(sliceWidth * sliceHeight);
    }
  })();

  const clampedPos = Math.max(0, Math.min(position, (() => {
    switch (plane) {
      case 'xy': return depth - 1;
      case 'xz': return height - 1;
      case 'yz': return width - 1;
    }
  })()));

  for (let a = 0; a < sliceHeight; a++) {
    for (let b = 0; b < sliceWidth; b++) {
      let index: number;
      switch (plane) {
        case 'xy':
          // Z = position, iterate X (b) and Y (a)
          index = clampedPos * width * height + a * width + b;
          break;
        case 'xz':
          // Y = position, iterate X (b) and Z (a)
          index = a * width * height + clampedPos * width + b;
          break;
        case 'yz':
          // X = position, iterate Y (b) and Z (a)
          index = a * width * height + b * width + clampedPos;
          break;
      }
      slice[a * sliceWidth + b] = state[index];
    }
  }

  return slice;
}

// Preset configurations for 3D Lenia
export const LENIA_3D_PRESETS = {
  'orbium-3d': {
    kernel: KERNEL_3D_PRESETS['lenia-standard'],
    params: {
      kernelRadius: 13,
      growthCenter: 0.15,
      growthWidth: 0.015,
      dt: 0.1,
    } as Lenia3DParams,
  },

  'stable-blob': {
    kernel: KERNEL_3D_PRESETS['lenia-narrow'],
    params: {
      kernelRadius: 10,
      growthCenter: 0.12,
      growthWidth: 0.04,
      dt: 0.1,
    } as Lenia3DParams,
  },

  'dual-ring-3d': {
    kernel: KERNEL_3D_PRESETS['lenia-dual-ring'],
    params: {
      kernelRadius: 15,
      growthCenter: 0.13,
      growthWidth: 0.025,
      dt: 0.08,
    } as Lenia3DParams,
  },
} as const;
