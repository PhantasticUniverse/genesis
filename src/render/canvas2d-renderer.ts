/**
 * Canvas 2D Renderer
 * Renders Float32Array state to a canvas using Canvas 2D API
 * Used as fallback when WebGPU is not available
 */

import { type ColormapFunction, COLORMAPS, viridis } from "./colormaps";

export interface Canvas2DRendererConfig {
  width: number;
  height: number;
  colormap?: string;
}

export interface Canvas2DRenderer {
  /** Render state to canvas */
  render(state: Float32Array): void;
  /** Set colormap by name */
  setColormap(name: string): void;
  /** Get current colormap name */
  getColormap(): string;
  /** Destroy renderer and free resources */
  destroy(): void;
}

/**
 * Create a Canvas 2D renderer for CPU fallback
 */
export function createCanvas2DRenderer(
  canvas: HTMLCanvasElement,
  config: Canvas2DRendererConfig,
): Canvas2DRenderer {
  const { width, height } = config;

  // Get 2D context
  const ctx = canvas.getContext("2d", { willReadFrequently: false });
  if (!ctx) {
    throw new Error("Failed to get Canvas 2D context");
  }

  // Set canvas size
  canvas.width = width;
  canvas.height = height;

  // Create ImageData for efficient rendering
  let imageData = ctx.createImageData(width, height);

  // Current colormap
  let currentColormapName = config.colormap ?? "viridis";
  let colormapFn: ColormapFunction =
    COLORMAPS[currentColormapName]?.fn ?? viridis;

  /**
   * Render state to canvas using colormap
   */
  function render(state: Float32Array): void {
    const data = imageData.data;

    for (let i = 0; i < state.length; i++) {
      const value = state[i];
      const color = colormapFn(value);

      const pixelIndex = i * 4;
      data[pixelIndex] = color.r;
      data[pixelIndex + 1] = color.g;
      data[pixelIndex + 2] = color.b;
      data[pixelIndex + 3] = 255;
    }

    ctx.putImageData(imageData, 0, 0);
  }

  /**
   * Set colormap by name
   */
  function setColormap(name: string): void {
    const colormap = COLORMAPS[name];
    if (colormap) {
      currentColormapName = name;
      colormapFn = colormap.fn;
    }
  }

  /**
   * Get current colormap name
   */
  function getColormap(): string {
    return currentColormapName;
  }

  /**
   * Destroy renderer
   */
  function destroy(): void {
    // Clear the canvas
    ctx.clearRect(0, 0, width, height);
  }

  return {
    render,
    setColormap,
    getColormap,
    destroy,
  };
}

/**
 * Check if Canvas 2D is available
 */
export function isCanvas2DAvailable(): boolean {
  if (typeof document === "undefined") return false;

  try {
    const testCanvas = document.createElement("canvas");
    const ctx = testCanvas.getContext("2d");
    return ctx !== null;
  } catch {
    return false;
  }
}
