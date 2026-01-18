/**
 * CPU Engine for Browser Fallback
 * Provides a WebGPU-like interface but runs on CPU
 * Used when WebGPU is not available
 */

import type { GridConfig, DiscreteRule, CAParadigm } from "./types";
import { DEFAULT_GRID_CONFIG, GAME_OF_LIFE_RULE } from "./types";
import { type KernelConfig, generateKernel, normalizeKernel } from "./kernels";
import { gaussianGrowth, polynomialGrowth, applyGrowth } from "./growth";

export interface CPUEngineConfig {
  canvas: HTMLCanvasElement;
  gridConfig?: GridConfig;
  paradigm?: CAParadigm;
  discreteRule?: DiscreteRule;
}

export interface ContinuousCAParams {
  kernelRadius: number;
  growthCenter: number;
  growthWidth: number;
  dt: number;
  growthType: "gaussian" | "polynomial";
}

/**
 * CPU Engine interface - subset of full Engine for fallback
 */
export interface CPUEngine {
  // State
  running: boolean;
  step: number;
  fps: number;
  isCPUFallback: true;

  // Core methods
  start(): void;
  stop(): void;
  toggle(): void;
  stepOnce(): void;
  reset(
    pattern?: "glider" | "blinker" | "random" | "center-blob" | "lenia-seed",
  ): void;
  setRule(rule: DiscreteRule): void;
  setParadigm(paradigm: CAParadigm): void;
  setContinuousParams(params: Partial<ContinuousCAParams>): void;
  readState(): Promise<Float32Array | null>;
  getMass(): Promise<number>;
  destroy(): void;

  // Getters
  getConfig(): GridConfig;
  getGridConfig(): GridConfig;
  getParadigm(): CAParadigm;

  // Render callback for Canvas2D
  onRender(callback: (state: Float32Array) => void): void;
}

/**
 * Create CPU Lenia simulation context
 */
function createLeniaContext(
  width: number,
  height: number,
  params: ContinuousCAParams,
) {
  const kernelConfig: KernelConfig = {
    shape: "polynomial",
    radius: params.kernelRadius,
    peaks: [0.148, 0.335, 0.81],
  };
  const rawKernel = generateKernel(kernelConfig);
  const kernel = normalizeKernel(rawKernel);

  return {
    kernel,
    state: new Float32Array(width * height),
    convolution: new Float32Array(width * height),
    params,
  };
}

/**
 * Compute convolution using direct spatial convolution
 */
function computeConvolution(
  ctx: ReturnType<typeof createLeniaContext>,
  width: number,
  height: number,
) {
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
function applyGrowthStep(
  ctx: ReturnType<typeof createLeniaContext>,
  width: number,
  height: number,
) {
  const { state, convolution, params } = ctx;

  for (let i = 0; i < width * height; i++) {
    const n = convolution[i];
    let growth: number;

    if (params.growthType === "gaussian") {
      growth = gaussianGrowth(n, params.growthCenter, params.growthWidth);
    } else {
      growth = polynomialGrowth(n, params.growthCenter, params.growthWidth);
    }

    state[i] = applyGrowth(state[i], growth, params.dt);
  }
}

/**
 * Apply Game of Life rules
 */
function applyDiscreteStep(
  state: Float32Array,
  rule: DiscreteRule,
  width: number,
  height: number,
) {
  const newState = new Float32Array(state.length);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let neighbors = 0;

      // Count neighbors (Moore neighborhood)
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nx = (x + dx + width) % width;
          const ny = (y + dy + height) % height;
          if (state[ny * width + nx] > 0.5) neighbors++;
        }
      }

      const current = state[y * width + x] > 0.5 ? 1 : 0;
      const idx = y * width + x;

      if (current === 1) {
        // Alive: check survival
        newState[idx] = rule.survival.includes(neighbors) ? 1 : 0;
      } else {
        // Dead: check birth
        newState[idx] = rule.birth.includes(neighbors) ? 1 : 0;
      }
    }
  }

  state.set(newState);
}

/**
 * Initialize state with a pattern
 */
function initializePattern(
  state: Float32Array,
  width: number,
  height: number,
  pattern: string,
) {
  state.fill(0);

  const cx = Math.floor(width / 2);
  const cy = Math.floor(height / 2);

  switch (pattern) {
    case "glider": {
      const gliderCells = [
        [1, 0],
        [2, 1],
        [0, 2],
        [1, 2],
        [2, 2],
      ];
      for (const [dx, dy] of gliderCells) {
        state[(cy + dy) * width + (cx + dx)] = 1;
      }
      break;
    }

    case "blinker": {
      state[cy * width + (cx - 1)] = 1;
      state[cy * width + cx] = 1;
      state[cy * width + (cx + 1)] = 1;
      break;
    }

    case "center-blob":
    case "lenia-seed": {
      const radius = 25;
      const intensity = 0.8;
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
      break;
    }

    case "random":
    default: {
      const density = 0.3;
      const randRadius = Math.min(width, height) / 4;
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const dx = x - cx;
          const dy = y - cy;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < randRadius && Math.random() < density) {
            state[y * width + x] = Math.random();
          }
        }
      }
      break;
    }
  }
}

/**
 * Create the CPU Engine (fallback for when WebGPU is unavailable)
 */
export function createCPUEngine(config: CPUEngineConfig): CPUEngine {
  const gridConfig = config.gridConfig ?? DEFAULT_GRID_CONFIG;
  const { width, height } = gridConfig;

  let currentParadigm: CAParadigm = config.paradigm ?? "discrete";
  let discreteRule = config.discreteRule ?? GAME_OF_LIFE_RULE;

  // Continuous CA params
  let continuousParams: ContinuousCAParams = {
    kernelRadius: 12,
    growthCenter: 0.12,
    growthWidth: 0.04,
    dt: 0.1,
    growthType: "gaussian",
  };

  // Create Lenia context
  let leniaCtx = createLeniaContext(width, height, continuousParams);

  // Discrete state (shared with lenia for simplicity)
  const discreteState = new Float32Array(width * height);

  // Engine state
  let running = false;
  let step = 0;
  let fps = 0;
  let lastTime = performance.now();
  let frameCount = 0;
  let animationFrameId: number | null = null;

  // Render callback
  let renderCallback: ((state: Float32Array) => void) | null = null;

  /**
   * Get the current state array based on paradigm
   */
  function getCurrentState(): Float32Array {
    return currentParadigm === "continuous" ? leniaCtx.state : discreteState;
  }

  /**
   * Perform one simulation step
   */
  function doStep() {
    if (currentParadigm === "continuous") {
      computeConvolution(leniaCtx, width, height);
      applyGrowthStep(leniaCtx, width, height);
    } else {
      applyDiscreteStep(discreteState, discreteRule, width, height);
    }

    step++;

    // Notify render callback
    if (renderCallback) {
      renderCallback(getCurrentState());
    }
  }

  /**
   * Animation loop
   */
  function animate() {
    if (!running) return;

    doStep();

    // Update FPS counter
    frameCount++;
    const now = performance.now();
    if (now - lastTime >= 1000) {
      fps = frameCount;
      frameCount = 0;
      lastTime = now;
    }

    animationFrameId = requestAnimationFrame(animate);
  }

  /**
   * Initial render
   */
  function render() {
    if (renderCallback) {
      renderCallback(getCurrentState());
    }
  }

  // Initialize with default pattern
  initializePattern(leniaCtx.state, width, height, "lenia-seed");
  initializePattern(discreteState, width, height, "random");

  const engine: CPUEngine = {
    isCPUFallback: true,

    get running() {
      return running;
    },
    get step() {
      return step;
    },
    get fps() {
      return fps;
    },

    start() {
      if (!running) {
        running = true;
        lastTime = performance.now();
        frameCount = 0;
        animate();
      }
    },

    stop() {
      running = false;
      if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
      }
    },

    toggle() {
      if (running) {
        this.stop();
      } else {
        this.start();
      }
    },

    stepOnce() {
      if (!running) {
        doStep();
      }
    },

    reset(pattern = "random") {
      this.stop();
      step = 0;

      if (currentParadigm === "continuous") {
        initializePattern(leniaCtx.state, width, height, pattern);
      } else {
        initializePattern(discreteState, width, height, pattern);
      }

      render();
    },

    setRule(rule: DiscreteRule) {
      discreteRule = rule;
    },

    setParadigm(paradigm: CAParadigm) {
      currentParadigm = paradigm;
      render();
    },

    setContinuousParams(params: Partial<ContinuousCAParams>) {
      const needsKernelRebuild =
        params.kernelRadius !== undefined &&
        params.kernelRadius !== continuousParams.kernelRadius;

      continuousParams = { ...continuousParams, ...params };

      if (needsKernelRebuild) {
        // Rebuild kernel with new radius
        const oldState = new Float32Array(leniaCtx.state);
        leniaCtx = createLeniaContext(width, height, continuousParams);
        leniaCtx.state.set(oldState);
      } else {
        leniaCtx.params = continuousParams;
      }
    },

    async readState(): Promise<Float32Array | null> {
      return new Float32Array(getCurrentState());
    },

    async getMass(): Promise<number> {
      const state = getCurrentState();
      let sum = 0;
      for (let i = 0; i < state.length; i++) {
        sum += state[i];
      }
      return sum;
    },

    destroy() {
      this.stop();
    },

    getConfig() {
      return gridConfig;
    },

    getGridConfig() {
      return gridConfig;
    },

    getParadigm() {
      return currentParadigm;
    },

    onRender(callback: (state: Float32Array) => void) {
      renderCallback = callback;
      // Trigger initial render
      render();
    },
  };

  return engine;
}
