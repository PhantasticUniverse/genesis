/**
 * Multi-Kernel Lenia Pipeline
 * GPU pipeline for simulating Lenia with multiple convolution kernels
 *
 * Supports two convolution paths:
 * - Direct: O(N^2 * sum(R_i^2)) - better when max kernel radius < 16
 * - FFT: O(N^2 * K * log N) - better when max kernel radius >= 16
 */

import {
  generateMultiKernels,
  createKernelTextureArray,
  type MultiKernelData,
} from "../../core/kernels";
import type { MultiKernelConfig, GrowthParams } from "../../core/types";
import { shouldUseFFT } from "../../core/multi-kernel";
import { createShaderModule } from "./context";
import { createFFTPipeline, type FFTPipeline } from "./fft-pipeline";
import multiKernelCAShader from "./shaders/multi-kernel-ca.wgsl?raw";
import multiKernelGrowthShader from "./shaders/multi-kernel-growth.wgsl?raw";

/** Combination mode constants matching shader */
const COMBINATION_MODES = {
  sum: 0,
  average: 1,
  weighted: 2,
} as const;

/** Growth type constants matching shader */
const GROWTH_TYPES = {
  polynomial: 0,
  gaussian: 1,
  step: 2,
} as const;

export interface MultiKernelPipeline {
  /** Update the multi-kernel configuration */
  updateConfig(config: MultiKernelConfig): void;

  /** Update a single kernel's parameters */
  updateKernelParams(index: number, radius: number, weight: number): void;

  /** Update growth parameters for a kernel */
  updateGrowthParams(index: number, params: GrowthParams): void;

  /** Dispatch compute pass */
  dispatch(
    commandEncoder: GPUCommandEncoder,
    readTexture: GPUTexture,
    writeTexture: GPUTexture,
    workgroupsX: number,
    workgroupsY: number,
  ): void;

  /** Check if using FFT path */
  isUsingFFT(): boolean;

  /** Get current configuration */
  getConfig(): MultiKernelConfig;

  /** Clean up GPU resources */
  destroy(): void;
}

/**
 * Create a multi-kernel Lenia pipeline
 */
export function createMultiKernelPipeline(
  device: GPUDevice,
  width: number,
  height: number,
  initialConfig: MultiKernelConfig,
): MultiKernelPipeline {
  let currentConfig = { ...initialConfig };
  let useFFT = shouldUseFFT(currentConfig);

  // Generate initial kernel data
  let multiKernelData = generateMultiKernels(currentConfig);
  let kernelTextureArray = createKernelTextureArray(device, multiKernelData);

  // Create shader modules
  const directShaderModule = createShaderModule(
    device,
    multiKernelCAShader,
    "multi-kernel-ca",
  );
  const growthShaderModule = createShaderModule(
    device,
    multiKernelGrowthShader,
    "multi-kernel-growth",
  );

  // =========================================================================
  // Direct Convolution Path
  // =========================================================================

  // Bind group layout for direct path
  const directBindGroupLayout = device.createBindGroupLayout({
    label: "multi-kernel-direct-bind-group-layout",
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
      {
        binding: 3,
        visibility: GPUShaderStage.COMPUTE,
        texture: {
          sampleType: "unfilterable-float",
          viewDimension: "2d-array",
        },
      },
    ],
  });

  const directPipeline = device.createComputePipeline({
    label: "multi-kernel-direct-pipeline",
    layout: device.createPipelineLayout({
      bindGroupLayouts: [directBindGroupLayout],
    }),
    compute: {
      module: directShaderModule,
      entryPoint: "main",
    },
  });

  // Uniform buffer for direct path
  // Size calculation:
  // - width, height, num_kernels, combination_mode: 4 x u32 = 16 bytes
  // - dt, kernel_max_size, padding x 2: 4 x 4 bytes = 16 bytes
  // - kernel_radii: vec4<u32> = 16 bytes
  // - growth_params[4]: 4 x (4 x f32) = 64 bytes
  // Total: 112 bytes, round up to 128 for alignment
  const directUniformBuffer = device.createBuffer({
    label: "multi-kernel-direct-uniform-buffer",
    size: 128,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  // =========================================================================
  // FFT Growth Path
  // =========================================================================

  // Bind group layout for FFT growth phase
  const growthBindGroupLayout = device.createBindGroupLayout({
    label: "multi-kernel-growth-bind-group-layout",
    entries: [
      {
        binding: 0,
        visibility: GPUShaderStage.COMPUTE,
        texture: { sampleType: "unfilterable-float" }, // current state
      },
      {
        binding: 1,
        visibility: GPUShaderStage.COMPUTE,
        texture: {
          sampleType: "unfilterable-float",
          viewDimension: "2d-array",
        }, // convolution results
      },
      {
        binding: 2,
        visibility: GPUShaderStage.COMPUTE,
        storageTexture: { access: "write-only", format: "r32float" }, // output
      },
      {
        binding: 3,
        visibility: GPUShaderStage.COMPUTE,
        buffer: { type: "uniform" },
      },
    ],
  });

  const growthPipeline = device.createComputePipeline({
    label: "multi-kernel-growth-pipeline",
    layout: device.createPipelineLayout({
      bindGroupLayouts: [growthBindGroupLayout],
    }),
    compute: {
      module: growthShaderModule,
      entryPoint: "main",
    },
  });

  // Uniform buffer for growth phase
  // Size: width, height, num_kernels, combination_mode, dt, padding x 3 + growth_params[4]
  // = 8 x 4 + 64 = 96 bytes, round to 128
  const growthUniformBuffer = device.createBuffer({
    label: "multi-kernel-growth-uniform-buffer",
    size: 128,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  // =========================================================================
  // FFT Resources (created lazily)
  // =========================================================================

  let fftPipelines: FFTPipeline[] = [];
  let convolutionResultsTexture: GPUTexture | null = null;

  function getFFTSize(): number {
    const maxDim = Math.max(width, height);
    return Math.pow(2, Math.ceil(Math.log2(maxDim)));
  }

  function initFFTIfNeeded() {
    const shouldUse = shouldUseFFT(currentConfig);

    if (shouldUse && fftPipelines.length === 0) {
      const fftSize = getFFTSize();
      const numKernels = currentConfig.kernels.length;

      // Create FFT pipeline for each kernel
      for (let i = 0; i < numKernels; i++) {
        const pipeline = createFFTPipeline(device, fftSize);
        fftPipelines.push(pipeline);
      }

      // Create texture array for convolution results (one layer per kernel)
      convolutionResultsTexture = device.createTexture({
        label: "multi-kernel-convolution-results",
        size: [width, height, numKernels],
        format: "r32float",
        dimension: "2d",
        usage:
          GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.STORAGE_BINDING,
      });

      // Initialize FFT kernels
      updateFFTKernels();
    }

    useFFT = shouldUse;
  }

  function updateFFTKernels() {
    if (fftPipelines.length === 0) return;

    for (let i = 0; i < currentConfig.kernels.length; i++) {
      if (i < fftPipelines.length) {
        const kernel = multiKernelData.kernels[i];
        fftPipelines[i].setKernel(kernel.weights, kernel.size);
      }
    }
  }

  function destroyFFT() {
    for (const pipeline of fftPipelines) {
      pipeline.destroy();
    }
    fftPipelines = [];

    if (convolutionResultsTexture) {
      convolutionResultsTexture.destroy();
      convolutionResultsTexture = null;
    }
  }

  // =========================================================================
  // Uniform Writing
  // =========================================================================

  function writeDirectUniforms() {
    const data = new ArrayBuffer(128);
    const u32View = new Uint32Array(data);
    const f32View = new Float32Array(data);

    // Basic params (offset 0-15)
    u32View[0] = width;
    u32View[1] = height;
    u32View[2] = currentConfig.kernels.length;
    u32View[3] = COMBINATION_MODES[currentConfig.combinationMode];

    // dt and kernel_max_size (offset 16-31)
    f32View[4] = currentConfig.dt;
    u32View[5] = multiKernelData.maxSize;
    // padding at 6, 7

    // Kernel radii (offset 32-47, vec4<u32>)
    for (let i = 0; i < 4; i++) {
      u32View[8 + i] =
        i < currentConfig.kernels.length ? currentConfig.kernels[i].radius : 0;
    }

    // Growth params (offset 48-111, 4 x KernelGrowthParams)
    // Each KernelGrowthParams: growth_center, growth_width, weight, growth_type
    for (let i = 0; i < 4; i++) {
      const baseOffset = 12 + i * 4;
      if (i < currentConfig.kernels.length) {
        const gp = currentConfig.growthParams[i];
        const kernel = currentConfig.kernels[i];
        f32View[baseOffset + 0] = gp.mu;
        f32View[baseOffset + 1] = gp.sigma;
        f32View[baseOffset + 2] = kernel.weight;
        u32View[baseOffset + 3] = GROWTH_TYPES[gp.type] ?? 0;
      } else {
        f32View[baseOffset + 0] = 0;
        f32View[baseOffset + 1] = 0;
        f32View[baseOffset + 2] = 0;
        u32View[baseOffset + 3] = 0;
      }
    }

    device.queue.writeBuffer(directUniformBuffer, 0, data);
  }

  function writeGrowthUniforms() {
    const data = new ArrayBuffer(128);
    const u32View = new Uint32Array(data);
    const f32View = new Float32Array(data);

    // Basic params (offset 0-31)
    u32View[0] = width;
    u32View[1] = height;
    u32View[2] = currentConfig.kernels.length;
    u32View[3] = COMBINATION_MODES[currentConfig.combinationMode];
    f32View[4] = currentConfig.dt;
    // padding at 5, 6, 7

    // Growth params (offset 32-95, 4 x KernelGrowthParams)
    for (let i = 0; i < 4; i++) {
      const baseOffset = 8 + i * 4;
      if (i < currentConfig.kernels.length) {
        const gp = currentConfig.growthParams[i];
        const kernel = currentConfig.kernels[i];
        f32View[baseOffset + 0] = gp.mu;
        f32View[baseOffset + 1] = gp.sigma;
        f32View[baseOffset + 2] = kernel.weight;
        u32View[baseOffset + 3] = GROWTH_TYPES[gp.type] ?? 0;
      } else {
        f32View[baseOffset + 0] = 0;
        f32View[baseOffset + 1] = 0;
        f32View[baseOffset + 2] = 0;
        u32View[baseOffset + 3] = 0;
      }
    }

    device.queue.writeBuffer(growthUniformBuffer, 0, data);
  }

  // Initialize
  writeDirectUniforms();
  writeGrowthUniforms();
  initFFTIfNeeded();

  // =========================================================================
  // Pipeline Interface
  // =========================================================================

  return {
    updateConfig(config: MultiKernelConfig) {
      // Check if kernel structure changed (requiring new textures)
      const kernelCountChanged =
        config.kernels.length !== currentConfig.kernels.length;
      const radiiChanged = config.kernels.some(
        (k, i) =>
          !currentConfig.kernels[i] ||
          k.radius !== currentConfig.kernels[i].radius,
      );

      currentConfig = { ...config };

      if (kernelCountChanged || radiiChanged) {
        // Regenerate kernel textures
        kernelTextureArray.destroy();
        multiKernelData = generateMultiKernels(currentConfig);
        kernelTextureArray = createKernelTextureArray(device, multiKernelData);

        // Reinitialize FFT if needed
        destroyFFT();
        initFFTIfNeeded();
      }

      writeDirectUniforms();
      writeGrowthUniforms();
    },

    updateKernelParams(index: number, radius: number, weight: number) {
      if (index < 0 || index >= currentConfig.kernels.length) return;

      const radiusChanged = currentConfig.kernels[index].radius !== radius;

      currentConfig.kernels[index] = {
        ...currentConfig.kernels[index],
        radius,
        weight,
      };

      if (radiusChanged) {
        // Regenerate kernel textures
        kernelTextureArray.destroy();
        multiKernelData = generateMultiKernels(currentConfig);
        kernelTextureArray = createKernelTextureArray(device, multiKernelData);

        // Check if FFT status changed
        const newUseFFT = shouldUseFFT(currentConfig);
        if (newUseFFT !== useFFT) {
          destroyFFT();
          initFFTIfNeeded();
        } else if (useFFT) {
          updateFFTKernels();
        }
      }

      writeDirectUniforms();
      writeGrowthUniforms();
    },

    updateGrowthParams(index: number, params: GrowthParams) {
      if (index < 0 || index >= currentConfig.growthParams.length) return;

      currentConfig.growthParams[index] = { ...params };
      writeDirectUniforms();
      writeGrowthUniforms();
    },

    dispatch(
      commandEncoder: GPUCommandEncoder,
      readTexture: GPUTexture,
      writeTexture: GPUTexture,
      workgroupsX: number,
      workgroupsY: number,
    ) {
      if (useFFT && fftPipelines.length > 0 && convolutionResultsTexture) {
        // FFT Path: Compute convolution for each kernel, then apply growth

        // Stage 1: FFT convolution for each kernel
        for (let i = 0; i < currentConfig.kernels.length; i++) {
          // Create a view of the output layer
          const layerView = convolutionResultsTexture.createView({
            dimension: "2d",
            baseArrayLayer: i,
            arrayLayerCount: 1,
          });

          // Need to create a temporary texture for this layer's output
          // since fftPipeline expects a 2D texture, not a layer
          const tempTexture = device.createTexture({
            label: `fft-temp-output-${i}`,
            size: [width, height],
            format: "r32float",
            usage:
              GPUTextureUsage.TEXTURE_BINDING |
              GPUTextureUsage.STORAGE_BINDING |
              GPUTextureUsage.COPY_SRC,
          });

          fftPipelines[i].convolve(commandEncoder, readTexture, tempTexture);

          // Copy to the correct layer in the array
          commandEncoder.copyTextureToTexture(
            { texture: tempTexture },
            { texture: convolutionResultsTexture, origin: [0, 0, i] },
            { width, height, depthOrArrayLayers: 1 },
          );

          // Note: We should pool these temp textures for performance
          // For now, let them be cleaned up by GC
        }

        // Stage 2: Apply growth function
        const growthBindGroup = device.createBindGroup({
          label: "multi-kernel-growth-bind-group",
          layout: growthBindGroupLayout,
          entries: [
            { binding: 0, resource: readTexture.createView() },
            {
              binding: 1,
              resource: convolutionResultsTexture.createView({
                dimension: "2d-array",
              }),
            },
            { binding: 2, resource: writeTexture.createView() },
            { binding: 3, resource: { buffer: growthUniformBuffer } },
          ],
        });

        const growthPass = commandEncoder.beginComputePass();
        growthPass.setPipeline(growthPipeline);
        growthPass.setBindGroup(0, growthBindGroup);
        growthPass.dispatchWorkgroups(workgroupsX, workgroupsY);
        growthPass.end();
      } else {
        // Direct Path: Single pass with all kernels
        const bindGroup = device.createBindGroup({
          label: "multi-kernel-direct-bind-group",
          layout: directBindGroupLayout,
          entries: [
            { binding: 0, resource: readTexture.createView() },
            { binding: 1, resource: writeTexture.createView() },
            { binding: 2, resource: { buffer: directUniformBuffer } },
            {
              binding: 3,
              resource: kernelTextureArray.createView({
                dimension: "2d-array",
              }),
            },
          ],
        });

        const pass = commandEncoder.beginComputePass();
        pass.setPipeline(directPipeline);
        pass.setBindGroup(0, bindGroup);
        pass.dispatchWorkgroups(workgroupsX, workgroupsY);
        pass.end();
      }
    },

    isUsingFFT() {
      return useFFT;
    },

    getConfig() {
      return { ...currentConfig };
    },

    destroy() {
      directUniformBuffer.destroy();
      growthUniformBuffer.destroy();
      kernelTextureArray.destroy();
      destroyFFT();
    },
  };
}
