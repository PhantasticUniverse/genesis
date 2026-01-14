/**
 * Buffer Manager
 * Handles ping-pong buffer allocation and management for CA state
 */

import type { GridConfig } from './types';

export type TextureMode = 'single' | 'multi';  // r32float or rgba32float

export interface CABuffers {
  // Ping-pong state textures
  stateA: GPUTexture;
  stateB: GPUTexture;

  // Staging buffer for CPU read/write
  stagingBuffer: GPUBuffer;

  // Uniform buffer for parameters
  uniformBuffer: GPUBuffer;
}

export interface BufferManager {
  config: GridConfig;
  buffers: CABuffers;
  currentBuffer: 'A' | 'B';
  mode: TextureMode;

  // Methods
  getReadTexture(): GPUTexture;
  getWriteTexture(): GPUTexture;
  swap(): void;
  destroy(): void;
}

/**
 * Create the buffer manager with ping-pong textures
 */
export function createBufferManager(
  device: GPUDevice,
  config: GridConfig,
  mode: TextureMode = 'single'
): BufferManager {
  const { width, height } = config;

  // Choose format based on mode
  let format: GPUTextureFormat;
  if (mode === 'multi') {
    format = 'rgba32float';  // 4 channels for multi-channel mode
  } else {
    format = config.precision === 'f32' ? 'r32float' : 'r16float';
  }

  // Create state textures (ping-pong pair)
  const textureDescriptor: GPUTextureDescriptor = {
    size: { width, height },
    format,
    usage:
      GPUTextureUsage.STORAGE_BINDING |
      GPUTextureUsage.TEXTURE_BINDING |
      GPUTextureUsage.COPY_SRC |
      GPUTextureUsage.COPY_DST,
  };

  const stateA = device.createTexture({
    ...textureDescriptor,
    label: 'state-texture-A',
  });

  const stateB = device.createTexture({
    ...textureDescriptor,
    label: 'state-texture-B',
  });

  // Staging buffer for CPU read/write
  const bytesPerPixel = mode === 'multi' ? 16 : (config.precision === 'f32' ? 4 : 2);
  const bufferSize = width * height * bytesPerPixel;

  const stagingBuffer = device.createBuffer({
    label: 'staging-buffer',
    size: bufferSize,
    usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
  });

  // Uniform buffer for simulation parameters
  // Layout: [width, height, step, dt, ...]
  const uniformBuffer = device.createBuffer({
    label: 'uniform-buffer',
    size: 64, // Enough for basic params
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  const buffers: CABuffers = {
    stateA,
    stateB,
    stagingBuffer,
    uniformBuffer,
  };

  let currentBuffer: 'A' | 'B' = 'A';

  return {
    config,
    buffers,
    currentBuffer,
    mode,

    getReadTexture() {
      return currentBuffer === 'A' ? buffers.stateA : buffers.stateB;
    },

    getWriteTexture() {
      return currentBuffer === 'A' ? buffers.stateB : buffers.stateA;
    },

    swap() {
      currentBuffer = currentBuffer === 'A' ? 'B' : 'A';
    },

    destroy() {
      buffers.stateA.destroy();
      buffers.stateB.destroy();
      buffers.stagingBuffer.destroy();
      buffers.uniformBuffer.destroy();
    },
  };
}

/**
 * Initialize texture with random values
 */
export async function initializeRandom(
  device: GPUDevice,
  texture: GPUTexture,
  width: number,
  height: number,
  density: number = 0.3
): Promise<void> {
  const data = new Float32Array(width * height);

  for (let i = 0; i < data.length; i++) {
    data[i] = Math.random() < density ? 1.0 : 0.0;
  }

  device.queue.writeTexture(
    { texture },
    data,
    { bytesPerRow: width * 4 },
    { width, height }
  );
}

/**
 * Initialize texture with a pattern (for testing)
 */
export function initializePattern(
  device: GPUDevice,
  texture: GPUTexture,
  width: number,
  height: number,
  pattern: 'glider' | 'blinker' | 'random' | 'center-blob' | 'lenia-seed'
): void {
  const data = new Float32Array(width * height);

  const setCell = (x: number, y: number, value: number = 1.0) => {
    if (x >= 0 && x < width && y >= 0 && y < height) {
      data[y * width + x] = value;
    }
  };

  switch (pattern) {
    case 'glider': {
      // Glider at center
      const cx = Math.floor(width / 4);
      const cy = Math.floor(height / 4);
      setCell(cx + 1, cy);
      setCell(cx + 2, cy + 1);
      setCell(cx, cy + 2);
      setCell(cx + 1, cy + 2);
      setCell(cx + 2, cy + 2);
      break;
    }

    case 'blinker': {
      // Blinker at center
      const cx = Math.floor(width / 2);
      const cy = Math.floor(height / 2);
      setCell(cx - 1, cy);
      setCell(cx, cy);
      setCell(cx + 1, cy);
      break;
    }

    case 'center-blob': {
      // Gaussian blob at center (for Lenia)
      const cx = Math.floor(width / 2);
      const cy = Math.floor(height / 2);
      const radius = 20;

      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const dx = x - cx;
          const dy = y - cy;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const value = Math.exp(-(dist * dist) / (2 * radius * radius));
          data[y * width + x] = value > 0.01 ? value : 0;
        }
      }
      break;
    }

    case 'lenia-seed': {
      // Dense ring seed for Lenia - produces convolution values in growth window
      const cx = Math.floor(width / 2);
      const cy = Math.floor(height / 2);
      const radius = 13;

      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const dx = x - cx;
          const dy = y - cy;
          const r = Math.sqrt(dx * dx + dy * dy);
          const angle = Math.atan2(dy, dx);

          // Add asymmetry for directional movement
          const asymmetry = 1 + 0.2 * Math.cos(angle);

          // Create wider ring at distance ~0.5*radius (where kernel peaks)
          const peakR = radius * 0.5;
          const ringWidth = radius * 0.4;  // Wider ring (was 0.25)
          const distFromPeak = Math.abs(r / asymmetry - peakR);

          if (distFromPeak < ringWidth) {
            // Smooth polynomial bump with higher values for denser pattern
            const t = 1 - (distFromPeak / ringWidth);
            data[y * width + x] = 0.9 * t * t;  // Higher max (was 0.6)
          }
        }
      }
      break;
    }

    case 'random':
    default: {
      for (let i = 0; i < data.length; i++) {
        data[i] = Math.random() < 0.3 ? 1.0 : 0.0;
      }
      break;
    }
  }

  device.queue.writeTexture(
    { texture },
    data,
    { bytesPerRow: width * 4 },
    { width, height }
  );
}

/**
 * Initialize RGBA texture for multi-channel patterns
 */
export function initializeMultiChannelPattern(
  device: GPUDevice,
  texture: GPUTexture,
  width: number,
  height: number,
  pattern: 'two-blobs' | 'predator-prey' | 'random-multi'
): void {
  // RGBA = 4 floats per pixel
  const data = new Float32Array(width * height * 4);

  const setPixel = (x: number, y: number, r: number, g: number, b: number, a: number) => {
    if (x >= 0 && x < width && y >= 0 && y < height) {
      const idx = (y * width + x) * 4;
      data[idx + 0] = r;
      data[idx + 1] = g;
      data[idx + 2] = b;
      data[idx + 3] = a;
    }
  };

  switch (pattern) {
    case 'two-blobs': {
      // Two species as blobs in different locations
      const cx1 = Math.floor(width / 3);
      const cy1 = Math.floor(height / 2);
      const cx2 = Math.floor(2 * width / 3);
      const cy2 = Math.floor(height / 2);
      const radius = 15;

      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          // Species A (channel 0) - left blob
          const d1 = Math.sqrt((x - cx1) ** 2 + (y - cy1) ** 2) / radius;
          const v1 = d1 < 1 ? Math.pow(1 - d1 * d1, 2) : 0;

          // Species B (channel 1) - right blob
          const d2 = Math.sqrt((x - cx2) ** 2 + (y - cy2) ** 2) / radius;
          const v2 = d2 < 1 ? Math.pow(1 - d2 * d2, 2) : 0;

          setPixel(x, y, v1, v2, 0, 0);
        }
      }
      break;
    }

    case 'predator-prey': {
      // Prey (channel 0) spread out, predator (channel 1) in center
      const cx = Math.floor(width / 2);
      const cy = Math.floor(height / 2);

      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          // Prey - random distribution
          const prey = Math.random() < 0.15 ? 0.8 : 0;

          // Predator - small central blob
          const d = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2) / 10;
          const predator = d < 1 ? Math.pow(1 - d * d, 2) : 0;

          setPixel(x, y, prey, predator, 0, 0);
        }
      }
      break;
    }

    case 'random-multi':
    default: {
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const r = Math.random() < 0.2 ? Math.random() : 0;
          const g = Math.random() < 0.2 ? Math.random() : 0;
          setPixel(x, y, r, g, 0, 0);
        }
      }
      break;
    }
  }

  device.queue.writeTexture(
    { texture },
    data,
    { bytesPerRow: width * 16 }, // 4 floats * 4 bytes = 16 bytes per pixel
    { width, height }
  );
}
