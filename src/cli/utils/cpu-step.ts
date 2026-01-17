/**
 * CPU-Based Lenia Step Function
 * Pure TypeScript implementation for testing without WebGPU
 */

import {
  type KernelConfig,
  type KernelData,
  generateKernel,
  normalizeKernel,
} from "../../core/kernels";
import {
  type GrowthConfig,
  gaussianGrowth,
  polynomialGrowth,
  applyGrowth,
} from "../../core/growth";

export interface CPULeniaConfig {
  width: number;
  height: number;
  kernelRadius: number;
  growthCenter: number; // μ
  growthWidth: number; // σ
  dt: number;
  growthFunction: "gaussian" | "polynomial";
  kernelShape: KernelConfig["shape"];
}

export const DEFAULT_CPU_CONFIG: CPULeniaConfig = {
  width: 128,
  height: 128,
  kernelRadius: 13,
  growthCenter: 0.12,
  growthWidth: 0.04,
  dt: 0.1,
  growthFunction: "gaussian",
  kernelShape: "polynomial",
};

/**
 * CPU Lenia simulation context
 */
export interface CPULeniaContext {
  config: CPULeniaConfig;
  kernel: KernelData;
  state: Float32Array;
  convolution: Float32Array;
}

/**
 * Create a CPU Lenia simulation context
 */
export function createCPULenia(
  config: Partial<CPULeniaConfig> = {},
): CPULeniaContext {
  const fullConfig = { ...DEFAULT_CPU_CONFIG, ...config };
  const { width, height, kernelRadius, kernelShape } = fullConfig;

  // Generate and normalize kernel
  const kernelConfig: KernelConfig = {
    shape: kernelShape,
    radius: kernelRadius,
    peaks: [0.5], // Standard Lenia peak
  };
  const rawKernel = generateKernel(kernelConfig);
  const kernel = normalizeKernel(rawKernel);

  // Initialize state and convolution buffers
  const size = width * height;
  const state = new Float32Array(size);
  const convolution = new Float32Array(size);

  return {
    config: fullConfig,
    kernel,
    state,
    convolution,
  };
}

/**
 * Initialize state with a centered blob
 */
export function initializeBlob(
  ctx: CPULeniaContext,
  radius: number = 25,
  intensity: number = 0.8,
): void {
  const { width, height } = ctx.config;
  const cx = width / 2;
  const cy = height / 2;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < radius) {
        // Smooth falloff from center
        const falloff = 1 - dist / radius;
        ctx.state[y * width + x] = intensity * falloff * falloff;
      } else {
        ctx.state[y * width + x] = 0;
      }
    }
  }
}

/**
 * Initialize state with random values
 */
export function initializeRandom(
  ctx: CPULeniaContext,
  density: number = 0.1,
): void {
  const { width, height } = ctx.config;
  const cx = width / 2;
  const cy = height / 2;
  const radius = Math.min(width, height) / 4;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < radius && Math.random() < density) {
        ctx.state[y * width + x] = Math.random();
      } else {
        ctx.state[y * width + x] = 0;
      }
    }
  }
}

/**
 * Set state directly
 */
export function setState(ctx: CPULeniaContext, state: Float32Array): void {
  if (state.length !== ctx.state.length) {
    throw new Error(
      `State size mismatch: expected ${ctx.state.length}, got ${state.length}`,
    );
  }
  ctx.state.set(state);
}

/**
 * Get current state (copy)
 */
export function getState(ctx: CPULeniaContext): Float32Array {
  return new Float32Array(ctx.state);
}

/**
 * Compute convolution using direct spatial convolution
 * This is O(n*k²) where n is grid size and k is kernel size
 */
export function computeConvolution(ctx: CPULeniaContext): void {
  const { width, height } = ctx.config;
  const { kernel, state, convolution } = ctx;
  const { weights, radius } = kernel;
  const kernelSize = 2 * radius + 1;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0;

      for (let ky = 0; ky < kernelSize; ky++) {
        for (let kx = 0; kx < kernelSize; kx++) {
          // Toroidal wrap
          const sx = (x + kx - radius + width) % width;
          const sy = (y + ky - radius + height) % height;

          sum += state[sy * width + sx] * weights[ky * kernelSize + kx];
        }
      }

      convolution[y * width + x] = sum;
    }
  }
}

/**
 * Apply growth function and update state
 */
export function applyGrowthStep(ctx: CPULeniaContext): void {
  const { width, height, growthCenter, growthWidth, dt, growthFunction } =
    ctx.config;
  const { state, convolution } = ctx;

  for (let i = 0; i < width * height; i++) {
    const n = convolution[i];
    let growth: number;

    if (growthFunction === "gaussian") {
      growth = gaussianGrowth(n, growthCenter, growthWidth);
    } else {
      growth = polynomialGrowth(n, growthCenter, growthWidth);
    }

    state[i] = applyGrowth(state[i], growth, dt);
  }
}

/**
 * Perform a single Lenia step
 */
export function step(ctx: CPULeniaContext): void {
  computeConvolution(ctx);
  applyGrowthStep(ctx);
}

/**
 * Perform N steps
 */
export function stepN(ctx: CPULeniaContext, n: number): void {
  for (let i = 0; i < n; i++) {
    step(ctx);
  }
}

/**
 * Create a step function for use with analysis tools (e.g., Lyapunov calculation)
 */
export function createStepFunction(
  config: Partial<CPULeniaConfig> = {},
): (state: Float32Array) => Float32Array {
  const ctx = createCPULenia(config);

  return (inputState: Float32Array): Float32Array => {
    setState(ctx, inputState);
    step(ctx);
    return getState(ctx);
  };
}

/**
 * Calculate mass of current state
 */
export function calculateMass(ctx: CPULeniaContext): number {
  let sum = 0;
  for (let i = 0; i < ctx.state.length; i++) {
    sum += ctx.state[i];
  }
  return sum;
}

/**
 * Generate a random state array
 */
export function generateRandomState(
  width: number,
  height: number,
  density: number = 0.1,
): Float32Array {
  const state = new Float32Array(width * height);
  const cx = width / 2;
  const cy = height / 2;
  const radius = Math.min(width, height) / 4;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < radius && Math.random() < density) {
        state[y * width + x] = Math.random();
      }
    }
  }

  return state;
}

/**
 * Generate a blob state array
 */
export function generateBlobState(
  width: number,
  height: number,
  radius: number = 25,
  intensity: number = 0.8,
): Float32Array {
  const state = new Float32Array(width * height);
  const cx = width / 2;
  const cy = height / 2;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < radius) {
        const falloff = 1 - dist / radius;
        state[y * width + x] = intensity * falloff * falloff;
      }
    }
  }

  return state;
}

/**
 * Run simulation for N steps, collecting state history
 */
export function runSimulation(
  ctx: CPULeniaContext,
  steps: number,
  recordInterval: number = 1,
): Float32Array[] {
  const history: Float32Array[] = [getState(ctx)];

  for (let i = 0; i < steps; i++) {
    step(ctx);
    if ((i + 1) % recordInterval === 0) {
      history.push(getState(ctx));
    }
  }

  return history;
}
