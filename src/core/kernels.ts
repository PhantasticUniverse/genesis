/**
 * Kernel System for Continuous CA
 * Generates convolution kernels for Lenia, SmoothLife, and custom rules
 */

export type KernelShape = "gaussian" | "ring" | "polynomial" | "custom";

export interface KernelConfig {
  shape: KernelShape;
  radius: number; // Kernel radius in cells
  peaks?: number[]; // For polynomial kernels (Lenia beta values)
  ringWidth?: number; // For ring kernels (SmoothLife)
  customWeights?: Float32Array; // For custom kernels
}

export interface KernelData {
  weights: Float32Array;
  size: number; // Width/height of kernel (2*radius + 1)
  radius: number;
  sum: number; // Sum of all weights (for normalization)
}

/**
 * Gaussian function
 */
function gaussian(x: number, mu: number, sigma: number): number {
  const d = (x - mu) / sigma;
  return Math.exp(-0.5 * d * d);
}

/**
 * Polynomial bump function (Lenia style)
 * Creates smooth bumps at specified peak positions
 */
function polynomialBump(x: number, peaks: number[]): number {
  let sum = 0;
  for (const peak of peaks) {
    const d = Math.abs(x - peak);
    if (d < 1) {
      // Smooth polynomial bump: (1 - d^2)^4
      const t = 1 - d * d;
      sum += t * t * t * t;
    }
  }
  return sum;
}

/**
 * Ring kernel function (SmoothLife style)
 * Creates a ring-shaped kernel with smooth falloff
 */
function ringKernel(
  r: number,
  innerRadius: number,
  outerRadius: number,
): number {
  if (r < innerRadius || r > outerRadius) return 0;

  const mid = (innerRadius + outerRadius) / 2;
  const width = (outerRadius - innerRadius) / 2;

  // Smooth polynomial falloff from ring center
  const d = Math.abs(r - mid) / width;
  if (d >= 1) return 0;

  const t = 1 - d * d;
  return t * t;
}

/**
 * Generate a 2D convolution kernel
 */
export function generateKernel(config: KernelConfig): KernelData {
  const { shape, radius } = config;
  const size = 2 * radius + 1;
  const weights = new Float32Array(size * size);
  let sum = 0;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - radius;
      const dy = y - radius;
      const r = Math.sqrt(dx * dx + dy * dy) / radius; // Normalized distance [0, 1+]

      let weight = 0;

      switch (shape) {
        case "gaussian":
          // Gaussian kernel centered at 0.5 radius
          weight = gaussian(r, 0.5, 0.15);
          break;

        case "ring":
          // Ring kernel (SmoothLife inner/outer neighborhoods)
          const ringWidth = config.ringWidth ?? 0.5;
          weight = ringKernel(r, 1 - ringWidth, 1);
          break;

        case "polynomial":
          // Lenia-style polynomial bump kernel
          const peaks = config.peaks ?? [0.5];
          weight = polynomialBump(r, peaks);
          break;

        case "custom":
          // Use provided weights
          if (config.customWeights) {
            weight = config.customWeights[y * size + x];
          }
          break;
      }

      // Zero out the very center for some kernel types
      if (r < 0.01) {
        weight = 0;
      }

      weights[y * size + x] = weight;
      sum += weight;
    }
  }

  return { weights, size, radius, sum };
}

/**
 * Normalize kernel weights so they sum to 1
 */
export function normalizeKernel(kernel: KernelData): KernelData {
  const normalized = new Float32Array(kernel.weights.length);
  const factor = kernel.sum > 0 ? 1 / kernel.sum : 0;

  for (let i = 0; i < kernel.weights.length; i++) {
    normalized[i] = kernel.weights[i] * factor;
  }

  return {
    weights: normalized,
    size: kernel.size,
    radius: kernel.radius,
    sum: 1,
  };
}

/**
 * Create a GPU texture from kernel data
 */
export function createKernelTexture(
  device: GPUDevice,
  kernel: KernelData,
): GPUTexture {
  const texture = device.createTexture({
    label: "kernel-texture",
    size: [kernel.size, kernel.size],
    format: "r32float",
    usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
  });

  device.queue.writeTexture(
    { texture },
    kernel.weights,
    { bytesPerRow: kernel.size * 4 },
    { width: kernel.size, height: kernel.size },
  );

  return texture;
}

/**
 * Generate a simple Gaussian kernel as Float32Array
 * Convenience function for quick kernel creation
 */
export function generateGaussianKernel(
  radius: number,
  sigma?: number,
): Float32Array {
  const size = 2 * radius + 1;
  const s = sigma ?? radius / 3;
  const weights = new Float32Array(size * size);
  let sum = 0;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - radius;
      const dy = y - radius;
      const r = Math.sqrt(dx * dx + dy * dy);
      const weight = Math.exp(-(r * r) / (2 * s * s));
      weights[y * size + x] = weight;
      sum += weight;
    }
  }

  // Normalize
  for (let i = 0; i < weights.length; i++) {
    weights[i] /= sum;
  }

  return weights;
}

// Preset kernel configurations for common CA types
export const KERNEL_PRESETS = {
  // Lenia Orbium (classic glider-like organism)
  "lenia-orbium": {
    shape: "polynomial" as KernelShape,
    radius: 13,
    peaks: [0.5],
  },

  // Lenia Geminium (replicating pattern)
  "lenia-geminium": {
    shape: "polynomial" as KernelShape,
    radius: 10,
    peaks: [0.25, 0.75],
  },

  // SmoothLife ring kernel
  smoothlife: {
    shape: "ring" as KernelShape,
    radius: 12,
    ringWidth: 0.3,
  },

  // Simple Gaussian (for testing)
  gaussian: {
    shape: "gaussian" as KernelShape,
    radius: 8,
  },
} as const;

// ============================================================================
// Multi-Kernel Support
// ============================================================================

import type { MultiKernelConfig, SingleKernelParams } from "./types";

/**
 * Multi-kernel data containing all kernels for GPU upload
 */
export interface MultiKernelData {
  kernels: KernelData[];
  maxSize: number; // Size of largest kernel
  textureArrayData: Float32Array; // Flattened data for texture array
}

/**
 * Generate all kernels for a multi-kernel configuration
 */
export function generateMultiKernels(
  config: MultiKernelConfig,
): MultiKernelData {
  const kernels: KernelData[] = [];

  // Generate each kernel
  for (const kernelParams of config.kernels) {
    const kernelConfig: KernelConfig = {
      shape: kernelParams.shape,
      radius: kernelParams.radius,
      peaks: kernelParams.peaks,
    };

    const kernel = generateKernel(kernelConfig);
    const normalized = normalizeKernel(kernel);
    kernels.push(normalized);
  }

  // Find maximum size for texture array
  const maxSize = Math.max(...kernels.map((k) => k.size));

  // Create texture array data (padded to max size)
  const numKernels = kernels.length;
  const textureArrayData = new Float32Array(numKernels * maxSize * maxSize);

  for (let i = 0; i < numKernels; i++) {
    const kernel = kernels[i];
    const offset = i * maxSize * maxSize;

    // Center the kernel in the padded area
    const padding = Math.floor((maxSize - kernel.size) / 2);

    for (let y = 0; y < kernel.size; y++) {
      for (let x = 0; x < kernel.size; x++) {
        const srcIdx = y * kernel.size + x;
        const dstIdx = (y + padding) * maxSize + (x + padding);
        textureArrayData[offset + dstIdx] = kernel.weights[srcIdx];
      }
    }
  }

  return { kernels, maxSize, textureArrayData };
}

/**
 * Create a GPU texture array from multi-kernel data
 */
export function createKernelTextureArray(
  device: GPUDevice,
  multiKernelData: MultiKernelData,
): GPUTexture {
  const { kernels, maxSize, textureArrayData } = multiKernelData;
  const numKernels = kernels.length;

  const texture = device.createTexture({
    label: "multi-kernel-texture-array",
    size: [maxSize, maxSize, numKernels],
    format: "r32float",
    dimension: "2d",
    usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
  });

  // Upload each kernel layer
  for (let i = 0; i < numKernels; i++) {
    const offset = i * maxSize * maxSize;
    const layerData = textureArrayData.slice(
      offset,
      offset + maxSize * maxSize,
    );

    device.queue.writeTexture(
      { texture, origin: [0, 0, i] },
      layerData,
      { bytesPerRow: maxSize * 4 },
      { width: maxSize, height: maxSize, depthOrArrayLayers: 1 },
    );
  }

  return texture;
}

/**
 * Generate kernel weights as a Float32Array for a single kernel
 * Useful for CPU-based simulation in CLI
 */
export function generateKernelWeights(
  params: SingleKernelParams,
): Float32Array {
  const config: KernelConfig = {
    shape: params.shape,
    radius: params.radius,
    peaks: params.peaks,
  };

  const kernel = generateKernel(config);
  const normalized = normalizeKernel(kernel);
  return normalized.weights;
}
