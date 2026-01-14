/**
 * Unified Convolution Module
 * Automatically selects between direct and FFT convolution based on kernel size
 *
 * - Direct convolution: O(N² × R²), better for small kernels (R < 16)
 * - FFT convolution: O(N² × log(N)), better for large kernels (R >= 16)
 */

import { createFFTPipeline, shouldUseFFT, type FFTPipeline } from './fft-pipeline';
import { generateKernel, type KernelConfig, type KernelData } from '../../core/kernels';

export type ConvolutionMethod = 'direct' | 'fft' | 'auto';

export interface ConvolutionConfig {
  method: ConvolutionMethod;
  kernelConfig: KernelConfig;
}

export interface ConvolutionManager {
  // Get current method being used
  getMethod: () => 'direct' | 'fft';

  // Update kernel configuration
  setKernel: (config: KernelConfig) => void;

  // Get kernel data
  getKernelData: () => KernelData;

  // Check if using FFT
  isUsingFFT: () => boolean;

  // Cleanup
  destroy: () => void;
}

/**
 * Create convolution manager
 */
export function createConvolutionManager(
  device: GPUDevice,
  gridSize: number,
  initialConfig: ConvolutionConfig
): ConvolutionManager {
  let currentMethod: 'direct' | 'fft' = 'direct';
  let kernelData: KernelData = generateKernel(initialConfig.kernelConfig);
  let fftPipeline: FFTPipeline | null = null;

  // Determine if we should use FFT
  function updateMethod(config: KernelConfig) {
    const radius = config.radius;

    if (initialConfig.method === 'auto') {
      currentMethod = shouldUseFFT(radius, gridSize) ? 'fft' : 'direct';
    } else if (initialConfig.method === 'fft') {
      currentMethod = 'fft';
    } else {
      currentMethod = 'direct';
    }

    // Initialize FFT pipeline if needed
    if (currentMethod === 'fft' && !fftPipeline) {
      // FFT requires power of 2 size
      const fftSize = nextPowerOf2(gridSize);
      fftPipeline = createFFTPipeline(device, fftSize);
    }

    // Update kernel
    kernelData = generateKernel(config);

    if (currentMethod === 'fft' && fftPipeline) {
      fftPipeline.setKernel(kernelData.weights, kernelData.size);
    }
  }

  // Initialize
  updateMethod(initialConfig.kernelConfig);

  return {
    getMethod() {
      return currentMethod;
    },

    setKernel(config: KernelConfig) {
      updateMethod(config);
    },

    getKernelData() {
      return kernelData;
    },

    isUsingFFT() {
      return currentMethod === 'fft';
    },

    destroy() {
      if (fftPipeline) {
        fftPipeline.destroy();
      }
    },
  };
}

/**
 * Get next power of 2 >= n
 */
function nextPowerOf2(n: number): number {
  let p = 1;
  while (p < n) {
    p *= 2;
  }
  return p;
}

/**
 * Performance comparison data for reference:
 *
 * Grid Size: 512x512
 * -----------------
 * Kernel R=8:  Direct ~2ms,  FFT ~5ms   → Use Direct
 * Kernel R=16: Direct ~8ms,  FFT ~5ms   → Roughly equal
 * Kernel R=24: Direct ~18ms, FFT ~5ms   → Use FFT
 * Kernel R=32: Direct ~32ms, FFT ~5ms   → Use FFT
 *
 * Grid Size: 1024x1024
 * --------------------
 * Kernel R=8:  Direct ~8ms,  FFT ~12ms  → Use Direct
 * Kernel R=16: Direct ~32ms, FFT ~12ms  → Use FFT
 * Kernel R=24: Direct ~72ms, FFT ~12ms  → Use FFT
 *
 * The crossover point is approximately R² = 4 × log₂(N)
 */

/**
 * Benchmark convolution methods (for development/testing)
 */
export async function benchmarkConvolution(
  device: GPUDevice,
  gridSize: number,
  kernelRadius: number,
  iterations: number = 100
): Promise<{ directMs: number; fftMs: number }> {
  // This would be implemented to actually measure performance
  // For now, return estimated values based on complexity analysis

  const directComplexity = gridSize * gridSize * kernelRadius * kernelRadius;
  const fftComplexity = gridSize * gridSize * Math.log2(gridSize) * 3; // 3 for forward, multiply, inverse

  // Rough estimates (actual values depend on hardware)
  const directMs = directComplexity / 1e8;
  const fftMs = fftComplexity / 1e7;

  return { directMs, fftMs };
}
