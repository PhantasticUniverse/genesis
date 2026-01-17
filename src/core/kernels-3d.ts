/**
 * 3D Kernel System for 3D Lenia
 * Generates spherical convolution kernels for 3D cellular automata
 */

import type { Kernel3DConfig, Grid3DConfig } from "./types-3d";

export interface Kernel3DData {
  weights: Float32Array;
  size: number; // Width/height/depth of kernel (2*radius + 1)
  radius: number;
  sum: number; // Sum of all weights (for normalization verification)
}

/**
 * Polynomial bump function for 3D kernels (matches LeniaNDK)
 * Uses the formula: (1 - d^2)^4 centered at peak position
 * Maximum at d=0 (peak position), decays smoothly to 0 at d=1 (edge)
 */
function polynomialBump3D(
  r: number,
  peakPosition: number,
  peakWidth: number,
): number {
  const d = Math.abs(r - peakPosition) / peakWidth;
  if (d >= 1) return 0;

  // Smooth polynomial bump: (1 - d^2)^4
  // Maximum value of 1 at d=0, smoothly decays to 0 at d=1
  const t = 1 - d * d;
  return Math.pow(t, 4);
}

/**
 * Generate a 3D spherical convolution kernel
 * Kernel values are based on normalized radial distance from center
 */
export function generate3DKernel(config: Kernel3DConfig): Kernel3DData {
  const { radius, peakPositions, peakWidths, peakWeights } = config;
  const size = 2 * radius + 1;
  const totalVoxels = size * size * size;
  const weights = new Float32Array(totalVoxels);
  let sum = 0;

  for (let z = 0; z < size; z++) {
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const dx = x - radius;
        const dy = y - radius;
        const dz = z - radius;

        // Normalized spherical distance [0, 1+]
        const r = Math.sqrt(dx * dx + dy * dy + dz * dz) / radius;

        let weight = 0;

        // Only compute for voxels within the kernel radius
        if (r <= 1) {
          // Sum contributions from all peaks
          for (let i = 0; i < peakPositions.length; i++) {
            const peakPos = peakPositions[i];
            const peakWidth = peakWidths[i];
            const peakWeight = peakWeights[i];

            weight += peakWeight * polynomialBump3D(r, peakPos, peakWidth);
          }
        }

        // Zero out the very center (r < 0.01) to avoid self-influence
        if (r < 0.01) {
          weight = 0;
        }

        const index = z * size * size + y * size + x;
        weights[index] = weight;
        sum += weight;
      }
    }
  }

  return { weights, size, radius, sum };
}

/**
 * Normalize 3D kernel weights so they sum to 1
 */
export function normalize3DKernel(kernel: Kernel3DData): Kernel3DData {
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
 * Generate a 3D Gaussian kernel
 * Useful for smoothing and basic convolution operations
 */
export function generateGaussian3DKernel(
  radius: number,
  sigma?: number,
): Kernel3DData {
  const size = 2 * radius + 1;
  const s = sigma ?? radius / 3;
  const totalVoxels = size * size * size;
  const weights = new Float32Array(totalVoxels);
  let sum = 0;

  for (let z = 0; z < size; z++) {
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const dx = x - radius;
        const dy = y - radius;
        const dz = z - radius;
        const r = Math.sqrt(dx * dx + dy * dy + dz * dz);
        const weight = Math.exp(-(r * r) / (2 * s * s));

        const index = z * size * size + y * size + x;
        weights[index] = weight;
        sum += weight;
      }
    }
  }

  // Normalize
  for (let i = 0; i < weights.length; i++) {
    weights[i] /= sum;
  }

  return { weights, size, radius, sum: 1 };
}

/**
 * Generate a spherical shell kernel
 * Creates a ring/shell at a specific radius
 */
export function generateShell3DKernel(
  radius: number,
  shellPosition: number,
  shellWidth: number,
): Kernel3DData {
  return generate3DKernel({
    radius,
    peakPositions: [shellPosition],
    peakWidths: [shellWidth],
    peakWeights: [1],
  });
}

/**
 * Create a GPU 3D texture from kernel data
 */
export function createKernel3DTexture(
  device: GPUDevice,
  kernel: Kernel3DData,
): GPUTexture {
  const texture = device.createTexture({
    label: "kernel-3d-texture",
    size: [kernel.size, kernel.size, kernel.size],
    format: "r32float",
    dimension: "3d",
    usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
  });

  device.queue.writeTexture(
    { texture },
    kernel.weights,
    {
      bytesPerRow: kernel.size * 4,
      rowsPerImage: kernel.size,
    },
    {
      width: kernel.size,
      height: kernel.size,
      depthOrArrayLayers: kernel.size,
    },
  );

  return texture;
}

/**
 * Extract a 2D slice from a 3D kernel for visualization
 */
export function extractKernelSlice(
  kernel: Kernel3DData,
  plane: "xy" | "xz" | "yz",
  position: number,
): Float32Array {
  const { size, weights } = kernel;
  const slice = new Float32Array(size * size);
  const clampedPos = Math.max(0, Math.min(size - 1, position));

  for (let a = 0; a < size; a++) {
    for (let b = 0; b < size; b++) {
      let index: number;

      switch (plane) {
        case "xy":
          // Z = position, iterate X and Y
          index = clampedPos * size * size + a * size + b;
          break;
        case "xz":
          // Y = position, iterate X and Z
          index = a * size * size + clampedPos * size + b;
          break;
        case "yz":
          // X = position, iterate Y and Z
          index = a * size * size + b * size + clampedPos;
          break;
      }

      slice[a * size + b] = weights[index];
    }
  }

  return slice;
}

/**
 * Calculate statistics about a 3D kernel
 */
export function getKernel3DStats(kernel: Kernel3DData): {
  min: number;
  max: number;
  mean: number;
  nonZeroCount: number;
  totalVoxels: number;
} {
  let min = Infinity;
  let max = -Infinity;
  let sum = 0;
  let nonZeroCount = 0;

  for (const weight of kernel.weights) {
    if (weight < min) min = weight;
    if (weight > max) max = weight;
    sum += weight;
    if (weight > 0) nonZeroCount++;
  }

  return {
    min,
    max,
    mean: sum / kernel.weights.length,
    nonZeroCount,
    totalVoxels: kernel.weights.length,
  };
}

// Preset 3D kernel configurations
export const KERNEL_3D_PRESETS: Record<string, Kernel3DConfig> = {
  // Standard Lenia-style single peak at 0.5 radius
  "lenia-standard": {
    radius: 13,
    peakPositions: [0.5],
    peakWidths: [0.23],
    peakWeights: [1],
  },

  // Narrower kernel for more localized interactions
  "lenia-narrow": {
    radius: 10,
    peakPositions: [0.5],
    peakWidths: [0.15],
    peakWeights: [1],
  },

  // Dual-ring kernel for complex patterns
  "lenia-dual-ring": {
    radius: 15,
    peakPositions: [0.3, 0.7],
    peakWidths: [0.15, 0.15],
    peakWeights: [0.6, 0.4],
  },

  // Outer shell kernel (SmoothLife-like)
  shell: {
    radius: 12,
    peakPositions: [0.8],
    peakWidths: [0.2],
    peakWeights: [1],
  },
};
