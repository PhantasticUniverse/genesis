/**
 * 3D Slice Renderer
 * Renders 2D slices from 3D Lenia state for visualization
 */

import type { Grid3DConfig, SlicePlane, View3DConfig } from "../core/types-3d";
import {
  COLORMAPS,
  DEFAULT_COLORMAP,
  type ColormapFunction,
} from "./colormaps";

export interface SliceRendererConfig {
  /** Canvas element to render to */
  canvas: HTMLCanvasElement;
  /** 3D grid configuration */
  gridConfig: Grid3DConfig;
  /** Initial colormap name */
  colormap?: string;
}

export interface SliceRenderer {
  /** Render a slice from the provided state */
  render(state: Float32Array, view: View3DConfig): void;

  /** Render directly from a 2D slice array */
  renderSlice(slice: Float32Array, width: number, height: number): void;

  /** Set the colormap by name */
  setColormap(name: string): void;

  /** Get current colormap name */
  getColormap(): string;

  /** Resize the renderer to match canvas */
  resize(): void;

  /** Clean up resources */
  destroy(): void;
}

/**
 * Extract a 2D slice from 3D state data
 */
export function extractSlice(
  state: Float32Array,
  config: Grid3DConfig,
  plane: SlicePlane,
  position: number,
): { data: Float32Array; width: number; height: number } {
  const { width, height, depth } = config;

  let sliceWidth: number;
  let sliceHeight: number;
  let maxPos: number;

  switch (plane) {
    case "xy":
      sliceWidth = width;
      sliceHeight = height;
      maxPos = depth - 1;
      break;
    case "xz":
      sliceWidth = width;
      sliceHeight = depth;
      maxPos = height - 1;
      break;
    case "yz":
      sliceWidth = height;
      sliceHeight = depth;
      maxPos = width - 1;
      break;
  }

  const clampedPos = Math.max(0, Math.min(position, maxPos));
  const data = new Float32Array(sliceWidth * sliceHeight);

  for (let a = 0; a < sliceHeight; a++) {
    for (let b = 0; b < sliceWidth; b++) {
      let index: number;

      switch (plane) {
        case "xy":
          // Z = position, iterate X (b) and Y (a)
          index = clampedPos * width * height + a * width + b;
          break;
        case "xz":
          // Y = position, iterate X (b) and Z (a)
          index = a * width * height + clampedPos * width + b;
          break;
        case "yz":
          // X = position, iterate Y (b) and Z (a)
          index = a * width * height + b * width + clampedPos;
          break;
      }

      data[a * sliceWidth + b] = state[index];
    }
  }

  return { data, width: sliceWidth, height: sliceHeight };
}

/**
 * Create a slice renderer using Canvas 2D
 */
export function createSliceRenderer(
  config: SliceRendererConfig,
): SliceRenderer {
  const { canvas, gridConfig } = config;
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    throw new Error("Failed to get 2D canvas context");
  }

  let currentColormap = config.colormap ?? DEFAULT_COLORMAP;
  let colormapFn: ColormapFunction =
    COLORMAPS[currentColormap]?.fn ?? COLORMAPS[DEFAULT_COLORMAP].fn;

  // Image data for rendering
  let imageData: ImageData | null = null;

  function ensureImageData(width: number, height: number): ImageData {
    if (
      !imageData ||
      imageData.width !== width ||
      imageData.height !== height
    ) {
      imageData = ctx!.createImageData(width, height);
    }
    return imageData;
  }

  return {
    render(state: Float32Array, view: View3DConfig) {
      const { data, width, height } = extractSlice(
        state,
        gridConfig,
        view.slicePlane,
        view.slicePosition,
      );
      this.renderSlice(data, width, height);
    },

    renderSlice(slice: Float32Array, width: number, height: number) {
      const imgData = ensureImageData(width, height);
      const pixels = imgData.data;

      // Convert float values to RGBA using colormap
      for (let i = 0; i < slice.length; i++) {
        const value = Math.max(0, Math.min(1, slice[i]));
        const color = colormapFn(value);

        const pixelIndex = i * 4;
        pixels[pixelIndex + 0] = color.r;
        pixels[pixelIndex + 1] = color.g;
        pixels[pixelIndex + 2] = color.b;
        pixels[pixelIndex + 3] = 255;
      }

      // Scale to canvas size
      const scaleX = canvas.width / width;
      const scaleY = canvas.height / height;
      const scale = Math.min(scaleX, scaleY);

      const scaledWidth = width * scale;
      const scaledHeight = height * scale;
      const offsetX = (canvas.width - scaledWidth) / 2;
      const offsetY = (canvas.height - scaledHeight) / 2;

      // Clear canvas
      ctx!.fillStyle = "#000";
      ctx!.fillRect(0, 0, canvas.width, canvas.height);

      // Create temporary canvas for the slice
      const tempCanvas = document.createElement("canvas");
      tempCanvas.width = width;
      tempCanvas.height = height;
      const tempCtx = tempCanvas.getContext("2d");
      if (tempCtx) {
        tempCtx.putImageData(imgData, 0, 0);

        // Draw scaled to main canvas with nearest-neighbor interpolation
        ctx!.imageSmoothingEnabled = false;
        ctx!.drawImage(
          tempCanvas,
          0,
          0,
          width,
          height,
          offsetX,
          offsetY,
          scaledWidth,
          scaledHeight,
        );
      }
    },

    setColormap(name: string) {
      if (COLORMAPS[name]) {
        currentColormap = name;
        colormapFn = COLORMAPS[name].fn;
      }
    },

    getColormap(): string {
      return currentColormap;
    },

    resize() {
      // Canvas size might have changed, nothing to do here
      // as we recalculate scaling on each render
    },

    destroy() {
      // Clear the canvas
      ctx!.clearRect(0, 0, canvas.width, canvas.height);
      imageData = null;
    },
  };
}

/**
 * Get the slice dimensions for a given plane
 */
export function getSliceDimensions(
  config: Grid3DConfig,
  plane: SlicePlane,
): { width: number; height: number; maxPosition: number } {
  const { width, height, depth } = config;

  switch (plane) {
    case "xy":
      return { width, height, maxPosition: depth - 1 };
    case "xz":
      return { width, height: depth, maxPosition: height - 1 };
    case "yz":
      return { width: height, height: depth, maxPosition: width - 1 };
  }
}

/**
 * Get a human-readable label for a slice plane
 */
export function getPlaneLabel(plane: SlicePlane): string {
  switch (plane) {
    case "xy":
      return "XY (Top View)";
    case "xz":
      return "XZ (Front View)";
    case "yz":
      return "YZ (Side View)";
  }
}

/**
 * Get the axis name for the slice position
 */
export function getSliceAxisName(plane: SlicePlane): string {
  switch (plane) {
    case "xy":
      return "Z";
    case "xz":
      return "Y";
    case "yz":
      return "X";
  }
}
