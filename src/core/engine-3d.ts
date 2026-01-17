/**
 * GENESIS 3D Engine
 * Engine for running 3D Lenia cellular automata simulations
 */

import type {
  Grid3DConfig,
  Lenia3DParams,
  Kernel3DConfig,
  View3DConfig,
  SlicePlane,
} from "./types-3d";
import {
  DEFAULT_GRID_3D_CONFIG,
  DEFAULT_LENIA_3D_PARAMS,
  DEFAULT_KERNEL_3D_CONFIG,
  DEFAULT_VIEW_3D_CONFIG,
} from "./types-3d";
import { initWebGPU } from "../compute/webgpu/context";
import {
  createLenia3DPipeline,
  generateSphericalBlob,
  extract3DSlice,
  LENIA_3D_PRESETS,
  type Lenia3DPipeline,
} from "../compute/webgpu/lenia-3d-pipeline";
import {
  createSliceRenderer,
  getSliceDimensions,
  type SliceRenderer,
} from "../render/slice-renderer";
import {
  ORGANISM_3D_PRESETS,
  createOrganism3D,
  type Organism3DPreset,
} from "../patterns/lenia-3d-library";

export interface Engine3DConfig {
  canvas: HTMLCanvasElement;
  gridConfig?: Grid3DConfig;
  params?: Lenia3DParams;
  kernel?: Kernel3DConfig;
}

export interface Engine3D {
  /** Whether simulation is running */
  running: boolean;
  /** Current step count */
  step: number;
  /** Current FPS */
  fps: number;

  /** Start simulation */
  start(): void;
  /** Stop simulation */
  stop(): void;
  /** Toggle running state */
  toggle(): void;
  /** Execute one step */
  stepOnce(): void;

  /** Reset with optional preset */
  reset(presetName?: string): void;
  /** Load a specific organism preset */
  loadPreset(presetName: string): void;
  /** Set initial state from Float32Array */
  setState(state: Float32Array): void;

  /** Update simulation parameters */
  setParams(params: Partial<Lenia3DParams>): void;
  /** Update kernel configuration */
  setKernel(config: Kernel3DConfig): void;

  /** Set view configuration */
  setView(view: Partial<View3DConfig>): void;
  /** Get current view configuration */
  getView(): View3DConfig;
  /** Set slice plane */
  setSlicePlane(plane: SlicePlane): void;
  /** Set slice position */
  setSlicePosition(position: number): void;

  /** Set colormap for rendering */
  setColormap(name: string): void;
  /** Get current colormap */
  getColormap(): string;

  /** Read current state from GPU */
  getState(): Promise<Float32Array>;
  /** Get a 2D slice of current state */
  getSlice(plane?: SlicePlane, position?: number): Promise<Float32Array>;

  /** Get current parameters */
  getParams(): Lenia3DParams;
  /** Get grid configuration */
  getGridConfig(): Grid3DConfig;
  /** Get available presets */
  getPresets(): Record<string, Organism3DPreset>;

  /** Clean up resources */
  destroy(): void;
}

/**
 * Create a 3D Lenia engine
 */
export async function createEngine3D(
  config: Engine3DConfig,
): Promise<Engine3D> {
  const { canvas } = config;
  const gridConfig = config.gridConfig ?? DEFAULT_GRID_3D_CONFIG;
  const initialParams = config.params ?? DEFAULT_LENIA_3D_PARAMS;
  const initialKernel = config.kernel ?? DEFAULT_KERNEL_3D_CONFIG;

  // Initialize WebGPU
  const { device, context } = await initWebGPU(canvas);

  // Create 3D pipeline
  let pipeline: Lenia3DPipeline = createLenia3DPipeline(
    device,
    gridConfig,
    initialParams,
    initialKernel,
  );

  // Create slice renderer
  const renderer = createSliceRenderer({
    canvas,
    gridConfig,
    colormap: "viridis",
  });

  // State
  let running = false;
  let step = 0;
  let fps = 0;
  let lastFrameTime = performance.now();
  let frameCount = 0;
  let animationId: number | null = null;
  let currentView: View3DConfig = { ...DEFAULT_VIEW_3D_CONFIG };
  let currentParams: Lenia3DParams = { ...initialParams };
  let cachedState: Float32Array | null = null;

  // Initialize with default blob
  pipeline.setState(generateSphericalBlob(gridConfig));

  // Render current state
  async function render() {
    if (!cachedState) {
      cachedState = await pipeline.getState();
    }
    renderer.render(cachedState, currentView);
  }

  // Update FPS counter
  function updateFPS() {
    const now = performance.now();
    const elapsed = now - lastFrameTime;
    frameCount++;

    if (elapsed >= 1000) {
      fps = Math.round((frameCount * 1000) / elapsed);
      frameCount = 0;
      lastFrameTime = now;
    }
  }

  // Animation loop
  function animate() {
    if (!running) return;

    // Execute compute step
    const commandEncoder = device.createCommandEncoder();
    pipeline.step(commandEncoder);
    device.queue.submit([commandEncoder.finish()]);

    step++;
    cachedState = null; // Invalidate cached state

    // Render
    render();
    updateFPS();

    animationId = requestAnimationFrame(animate);
  }

  // Initial render
  await render();

  return {
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
      if (running) return;
      running = true;
      lastFrameTime = performance.now();
      frameCount = 0;
      animate();
    },

    stop() {
      running = false;
      if (animationId !== null) {
        cancelAnimationFrame(animationId);
        animationId = null;
      }
    },

    toggle() {
      if (running) {
        this.stop();
      } else {
        this.start();
      }
    },

    async stepOnce() {
      if (running) return;

      const commandEncoder = device.createCommandEncoder();
      pipeline.step(commandEncoder);
      device.queue.submit([commandEncoder.finish()]);

      step++;
      cachedState = null;
      await render();
    },

    reset(presetName?: string) {
      this.stop();
      step = 0;
      cachedState = null;

      if (presetName && ORGANISM_3D_PRESETS[presetName]) {
        this.loadPreset(presetName);
      } else {
        // Reset to default spherical blob
        pipeline.setState(generateSphericalBlob(gridConfig));
        render();
      }
    },

    loadPreset(presetName: string) {
      const preset = ORGANISM_3D_PRESETS[presetName];
      if (!preset) {
        console.warn(`Unknown preset: ${presetName}`);
        return;
      }

      // Update parameters
      currentParams = { ...preset.params };
      pipeline.updateParams(preset.params);
      pipeline.updateKernel(preset.kernel);

      // Generate and set initial state
      const state = preset.generateState(gridConfig);
      pipeline.setState(state);

      step = 0;
      cachedState = null;
      render();
    },

    setState(state: Float32Array) {
      pipeline.setState(state);
      cachedState = null;
      render();
    },

    setParams(params: Partial<Lenia3DParams>) {
      currentParams = { ...currentParams, ...params };
      pipeline.updateParams(params);
    },

    setKernel(kernelConfig: Kernel3DConfig) {
      pipeline.updateKernel(kernelConfig);
      currentParams.kernelRadius = kernelConfig.radius;
    },

    setView(view: Partial<View3DConfig>) {
      currentView = { ...currentView, ...view };
      render();
    },

    getView(): View3DConfig {
      return { ...currentView };
    },

    setSlicePlane(plane: SlicePlane) {
      currentView.slicePlane = plane;
      // Adjust slice position to be in valid range for new plane
      const dims = getSliceDimensions(gridConfig, plane);
      currentView.slicePosition = Math.min(
        currentView.slicePosition,
        dims.maxPosition,
      );
      render();
    },

    setSlicePosition(position: number) {
      const dims = getSliceDimensions(gridConfig, currentView.slicePlane);
      currentView.slicePosition = Math.max(
        0,
        Math.min(position, dims.maxPosition),
      );
      render();
    },

    setColormap(name: string) {
      renderer.setColormap(name);
      render();
    },

    getColormap(): string {
      return renderer.getColormap();
    },

    async getState(): Promise<Float32Array> {
      if (!cachedState) {
        cachedState = await pipeline.getState();
      }
      return cachedState;
    },

    async getSlice(
      plane?: SlicePlane,
      position?: number,
    ): Promise<Float32Array> {
      const state = await this.getState();
      const p = plane ?? currentView.slicePlane;
      const pos = position ?? currentView.slicePosition;
      return extract3DSlice(state, gridConfig, p, pos);
    },

    getParams(): Lenia3DParams {
      return { ...currentParams };
    },

    getGridConfig(): Grid3DConfig {
      return { ...gridConfig };
    },

    getPresets(): Record<string, Organism3DPreset> {
      return ORGANISM_3D_PRESETS;
    },

    destroy() {
      this.stop();
      pipeline.destroy();
      renderer.destroy();
    },
  };
}

// Re-export useful types and functions
export { ORGANISM_3D_PRESETS } from "../patterns/lenia-3d-library";
export { LENIA_3D_PRESETS } from "../compute/webgpu/lenia-3d-pipeline";
export {
  getSliceDimensions,
  getPlaneLabel,
  getSliceAxisName,
} from "../render/slice-renderer";
