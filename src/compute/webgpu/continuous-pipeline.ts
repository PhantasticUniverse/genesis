/**
 * Continuous CA Pipeline
 * Handles Lenia and SmoothLife compute shaders
 *
 * Supports two convolution paths:
 * - Direct: O(N^2 * R^2) - better for small kernels (R < 16)
 * - FFT: O(N^2 * log N) - better for large kernels (R >= 16)
 */

import {
  generateKernel,
  normalizeKernel,
  createKernelTexture,
  type KernelConfig,
} from "../../core/kernels";
import { createShaderModule } from "./context";
import {
  createFFTPipeline,
  shouldUseFFT,
  type FFTPipeline,
} from "./fft-pipeline";
import continuousCAShader from "./shaders/continuous-ca.wgsl?raw";
import continuousGrowthShader from "./shaders/continuous-growth.wgsl?raw";

export type BoundaryMode = "periodic" | "clamped" | "reflected" | "zero";

export interface ContinuousCAParams {
  kernelRadius: number;
  growthCenter: number; // μ
  growthWidth: number; // σ
  dt: number; // Time step
  growthType: number; // 0=polynomial, 1=gaussian, 2=step
  massConservation?: boolean; // Enable mass conservation
  normalizationFactor?: number; // Mass normalization factor (computed externally)
  boundaryMode?: BoundaryMode; // Boundary condition mode (default: periodic)
}

// Map boundary mode names to shader enum values
function boundaryModeToValue(mode: BoundaryMode): number {
  switch (mode) {
    case "periodic":
      return 0;
    case "clamped":
      return 1;
    case "reflected":
      return 2;
    case "zero":
      return 3;
    default:
      return 0;
  }
}

export interface ContinuousPipeline {
  computePipeline: GPUComputePipeline;
  bindGroupLayout: GPUBindGroupLayout;
  uniformBuffer: GPUBuffer;
  kernelTexture: GPUTexture;
  kernelSize: number;

  updateParams(params: Partial<ContinuousCAParams>): void;
  updateKernel(config: KernelConfig): void;
  createBindGroup(
    readTexture: GPUTexture,
    writeTexture: GPUTexture,
  ): GPUBindGroup;

  // New method for dispatching compute with automatic FFT selection
  dispatch(
    commandEncoder: GPUCommandEncoder,
    readTexture: GPUTexture,
    writeTexture: GPUTexture,
    workgroupsX: number,
    workgroupsY: number,
  ): void;

  // Check if using FFT path
  isUsingFFT(): boolean;

  // Mass conservation methods
  setNormalizationFactor(factor: number): void;
  isMassConservationEnabled(): boolean;

  // Boundary mode methods
  setBoundaryMode(mode: BoundaryMode): void;
  getBoundaryMode(): BoundaryMode;

  destroy(): void;
}

/**
 * Create a continuous CA compute pipeline
 */
export function createContinuousPipeline(
  device: GPUDevice,
  width: number,
  height: number,
  initialKernel: KernelConfig = {
    shape: "polynomial",
    radius: 13,
    peaks: [0.5],
  },
): ContinuousPipeline {
  // Generate and normalize kernel
  const kernelData = normalizeKernel(generateKernel(initialKernel));
  const kernelTexture = createKernelTexture(device, kernelData);

  // Create shader modules
  const shaderModule = createShaderModule(
    device,
    continuousCAShader,
    "continuous-ca",
  );
  const growthShaderModule = createShaderModule(
    device,
    continuousGrowthShader,
    "continuous-growth",
  );

  // Create bind group layout for direct convolution
  const bindGroupLayout = device.createBindGroupLayout({
    label: "continuous-ca-bind-group-layout",
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
        texture: { sampleType: "unfilterable-float" },
      },
    ],
  });

  // Create bind group layout for FFT growth phase
  const growthBindGroupLayout = device.createBindGroupLayout({
    label: "continuous-growth-bind-group-layout",
    entries: [
      {
        binding: 0,
        visibility: GPUShaderStage.COMPUTE,
        texture: { sampleType: "unfilterable-float" }, // current state
      },
      {
        binding: 1,
        visibility: GPUShaderStage.COMPUTE,
        texture: { sampleType: "unfilterable-float" }, // convolution result
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

  // Create compute pipelines
  const computePipeline = device.createComputePipeline({
    label: "continuous-ca-pipeline",
    layout: device.createPipelineLayout({
      bindGroupLayouts: [bindGroupLayout],
    }),
    compute: {
      module: shaderModule,
      entryPoint: "main",
    },
  });

  const growthPipeline = device.createComputePipeline({
    label: "continuous-growth-pipeline",
    layout: device.createPipelineLayout({
      bindGroupLayouts: [growthBindGroupLayout],
    }),
    compute: {
      module: growthShaderModule,
      entryPoint: "main",
    },
  });

  // Create uniform buffer for direct path
  // Layout: width, height, kernel_radius, kernel_size, growth_center, growth_width, dt, growth_type,
  //         normalization_factor, padding, padding, padding
  const uniformBuffer = device.createBuffer({
    label: "continuous-ca-uniform-buffer",
    size: 48, // 12 x 4 bytes
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  // Create uniform buffer for growth phase (FFT path)
  // Layout: width, height, growth_center, growth_width, dt, growth_type, normalization_factor, padding
  const growthUniformBuffer = device.createBuffer({
    label: "continuous-growth-uniform-buffer",
    size: 32, // 8 x 4 bytes
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  // Initial params
  let currentParams: ContinuousCAParams = {
    kernelRadius: initialKernel.radius,
    growthCenter: 0.15,
    growthWidth: 0.015,
    dt: 0.1,
    growthType: 0, // polynomial
    massConservation: false,
    normalizationFactor: 1.0, // 1.0 = no normalization
    boundaryMode: "periodic", // default to toroidal
  };

  // FFT pipeline (created lazily when needed)
  let fftPipeline: FFTPipeline | null = null;
  let convolutionResultTexture: GPUTexture | null = null;
  let useFFT = false;

  // Get FFT size (must be power of 2)
  function getFFTSize(): number {
    // Use next power of 2 >= max(width, height)
    const maxDim = Math.max(width, height);
    return Math.pow(2, Math.ceil(Math.log2(maxDim)));
  }

  // Initialize or reinitialize FFT pipeline
  function initFFTIfNeeded() {
    const shouldUse = shouldUseFFT(currentParams.kernelRadius, width);

    if (shouldUse && !fftPipeline) {
      const fftSize = getFFTSize();
      fftPipeline = createFFTPipeline(device, fftSize);

      // Create intermediate texture for convolution result
      convolutionResultTexture = device.createTexture({
        label: "convolution-result",
        size: [width, height],
        format: "r32float",
        usage:
          GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.STORAGE_BINDING,
      });

      // Precompute kernel FFT
      updateFFTKernel();
    }

    useFFT = shouldUse;
  }

  // Update FFT kernel when kernel changes
  function updateFFTKernel() {
    if (!fftPipeline) return;

    // Generate flat kernel array
    const flatKernel = new Float32Array(kernelData.size * kernelData.size);
    for (let y = 0; y < kernelData.size; y++) {
      for (let x = 0; x < kernelData.size; x++) {
        flatKernel[y * kernelData.size + x] =
          kernelData.weights[y * kernelData.size + x];
      }
    }

    fftPipeline.setKernel(flatKernel, kernelData.size);
  }

  // Write uniforms for direct path
  function writeUniforms() {
    const data = new ArrayBuffer(48);
    const u32View = new Uint32Array(data);
    const f32View = new Float32Array(data);

    u32View[0] = width;
    u32View[1] = height;
    u32View[2] = currentParams.kernelRadius;
    u32View[3] = currentParams.kernelRadius * 2 + 1; // kernel size
    f32View[4] = currentParams.growthCenter;
    f32View[5] = currentParams.growthWidth;
    f32View[6] = currentParams.dt;
    u32View[7] = currentParams.growthType;
    f32View[8] = currentParams.normalizationFactor ?? 1.0;
    u32View[9] = boundaryModeToValue(currentParams.boundaryMode ?? "periodic");
    // padding at 10, 11

    device.queue.writeBuffer(uniformBuffer, 0, data);
  }

  // Write uniforms for growth phase (FFT path)
  function writeGrowthUniforms() {
    const data = new ArrayBuffer(32);
    const u32View = new Uint32Array(data);
    const f32View = new Float32Array(data);

    u32View[0] = width;
    u32View[1] = height;
    f32View[2] = currentParams.growthCenter;
    f32View[3] = currentParams.growthWidth;
    f32View[4] = currentParams.dt;
    u32View[5] = currentParams.growthType;
    f32View[6] = currentParams.normalizationFactor ?? 1.0;
    // padding at 7

    device.queue.writeBuffer(growthUniformBuffer, 0, data);
  }

  writeUniforms();
  writeGrowthUniforms();
  initFFTIfNeeded();

  let currentKernelTexture = kernelTexture;
  let currentKernelSize = kernelData.size;

  // Track current kernel data for FFT updates
  let currentKernelData = kernelData;

  return {
    computePipeline,
    bindGroupLayout,
    uniformBuffer,
    kernelTexture: currentKernelTexture,
    kernelSize: currentKernelSize,

    updateParams(params: Partial<ContinuousCAParams>) {
      currentParams = { ...currentParams, ...params };
      writeUniforms();
      writeGrowthUniforms();

      // Reinitialize FFT if kernel radius changed significantly
      if (params.kernelRadius !== undefined) {
        initFFTIfNeeded();
      }
    },

    updateKernel(config: KernelConfig) {
      // Destroy old kernel texture
      currentKernelTexture.destroy();

      // Generate new kernel
      const newKernelData = normalizeKernel(generateKernel(config));
      currentKernelTexture = createKernelTexture(device, newKernelData);
      currentKernelSize = newKernelData.size;
      currentKernelData = newKernelData;

      // Update params
      currentParams.kernelRadius = config.radius;
      writeUniforms();

      // Reinitialize FFT if needed
      initFFTIfNeeded();

      // Update FFT kernel if using FFT
      if (useFFT && fftPipeline) {
        const flatKernel = new Float32Array(
          currentKernelData.size * currentKernelData.size,
        );
        for (let y = 0; y < currentKernelData.size; y++) {
          for (let x = 0; x < currentKernelData.size; x++) {
            flatKernel[y * currentKernelData.size + x] =
              currentKernelData.weights[y * currentKernelData.size + x];
          }
        }
        fftPipeline.setKernel(flatKernel, currentKernelData.size);
      }
    },

    createBindGroup(
      readTexture: GPUTexture,
      writeTexture: GPUTexture,
    ): GPUBindGroup {
      return device.createBindGroup({
        label: "continuous-ca-bind-group",
        layout: bindGroupLayout,
        entries: [
          { binding: 0, resource: readTexture.createView() },
          { binding: 1, resource: writeTexture.createView() },
          { binding: 2, resource: { buffer: uniformBuffer } },
          { binding: 3, resource: currentKernelTexture.createView() },
        ],
      });
    },

    dispatch(
      commandEncoder: GPUCommandEncoder,
      readTexture: GPUTexture,
      writeTexture: GPUTexture,
      workgroupsX: number,
      workgroupsY: number,
    ) {
      if (useFFT && fftPipeline && convolutionResultTexture) {
        // FFT Path: Two stages
        // Stage 1: FFT convolution (input -> convolution result)
        fftPipeline.convolve(
          commandEncoder,
          readTexture,
          convolutionResultTexture,
        );

        // Stage 2: Apply growth function (current state + convolution result -> output)
        const growthBindGroup = device.createBindGroup({
          label: "continuous-growth-bind-group",
          layout: growthBindGroupLayout,
          entries: [
            { binding: 0, resource: readTexture.createView() },
            { binding: 1, resource: convolutionResultTexture.createView() },
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
        // Direct Path: Single combined shader
        const bindGroup = this.createBindGroup(readTexture, writeTexture);

        const pass = commandEncoder.beginComputePass();
        pass.setPipeline(computePipeline);
        pass.setBindGroup(0, bindGroup);
        pass.dispatchWorkgroups(workgroupsX, workgroupsY);
        pass.end();
      }
    },

    isUsingFFT() {
      return useFFT;
    },

    setNormalizationFactor(factor: number) {
      currentParams.normalizationFactor = factor;
      writeUniforms();
      writeGrowthUniforms();
    },

    isMassConservationEnabled() {
      return currentParams.massConservation ?? false;
    },

    setBoundaryMode(mode: BoundaryMode) {
      currentParams.boundaryMode = mode;
      writeUniforms();
    },

    getBoundaryMode(): BoundaryMode {
      return currentParams.boundaryMode ?? "periodic";
    },

    destroy() {
      uniformBuffer.destroy();
      growthUniformBuffer.destroy();
      currentKernelTexture.destroy();

      if (fftPipeline) {
        fftPipeline.destroy();
      }
      if (convolutionResultTexture) {
        convolutionResultTexture.destroy();
      }
    },
  };
}

// Preset configurations for continuous CA
export const CONTINUOUS_PRESETS = {
  "lenia-orbium": {
    kernel: {
      shape: "polynomial" as const,
      radius: 13,
      peaks: [0.5],
    },
    params: {
      growthCenter: 0.12,
      growthWidth: 0.04,
      dt: 0.1,
      growthType: 0,
    },
  },

  "lenia-geminium": {
    kernel: {
      shape: "polynomial" as const,
      radius: 10,
      peaks: [0.25, 0.75],
    },
    params: {
      growthCenter: 0.1,
      growthWidth: 0.035,
      dt: 0.1,
      growthType: 0,
    },
  },

  smoothlife: {
    kernel: {
      shape: "ring" as const,
      radius: 21,
      ringWidth: 0.5,
    },
    params: {
      growthCenter: 0.28,
      growthWidth: 0.06,
      dt: 0.1,
      growthType: 1, // gaussian
    },
  },

  "gaussian-smooth": {
    kernel: {
      shape: "gaussian" as const,
      radius: 10,
    },
    params: {
      growthCenter: 0.5, // High center for dense seeds
      growthWidth: 0.15, // Wide window for stability
      dt: 0.1,
      growthType: 1,
    },
  },
} as const;
