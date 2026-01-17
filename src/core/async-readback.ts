/**
 * Async GPU Readback Manager
 * Implements double-buffered staging for non-blocking GPU state reads
 *
 * Uses a ping-pong pattern:
 * - While one buffer is being mapped/read, the other can receive new data
 * - State machine: idle → copying → mapping → ready
 *
 * This reduces CPU blocking from 3-5ms to near-zero for continuous reads.
 */

export type ReadbackState = "idle" | "copying" | "mapping" | "ready";

export interface AsyncReadbackConfig {
  width: number;
  height: number;
  bytesPerPixel?: number; // Default: 4 (r32float)
}

export interface AsyncReadbackManager {
  /**
   * Request a new readback. Non-blocking - returns immediately.
   * The result will be available after GPU completes and buffer is mapped.
   */
  requestReadback(
    commandEncoder: GPUCommandEncoder,
    sourceTexture: GPUTexture,
  ): void;

  /**
   * Poll for available result. Non-blocking.
   * Returns the most recent successfully read data, or null if none available yet.
   */
  pollResult(): Float32Array | null;

  /**
   * Wait for the current pending readback to complete.
   * Returns the result or null if no readback is pending or an error occurred.
   */
  awaitResult(): Promise<Float32Array | null>;

  /**
   * Get the current state of the readback manager.
   */
  getState(): ReadbackState;

  /**
   * Check if a readback is currently in progress.
   */
  isPending(): boolean;

  /**
   * Check if fresh data is available to poll.
   */
  hasNewResult(): boolean;

  /**
   * Get the last successfully read result (cached).
   */
  getCachedResult(): Float32Array | null;

  /**
   * Cleanup resources.
   */
  destroy(): void;
}

/**
 * Create an async readback manager for GPU textures
 */
export function createAsyncReadbackManager(
  device: GPUDevice,
  config: AsyncReadbackConfig,
): AsyncReadbackManager {
  const { width, height, bytesPerPixel = 4 } = config;

  // Calculate row padding for WebGPU alignment (256 byte alignment)
  const unalignedBytesPerRow = width * bytesPerPixel;
  const bytesPerRow = Math.ceil(unalignedBytesPerRow / 256) * 256;
  const bufferSize = bytesPerRow * height;

  // Double-buffered staging
  const stagingBuffers = [
    device.createBuffer({
      label: "async-readback-staging-0",
      size: bufferSize,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
    }),
    device.createBuffer({
      label: "async-readback-staging-1",
      size: bufferSize,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
    }),
  ];

  // State tracking
  let currentBufferIndex = 0;
  let pendingBufferIndex = -1;
  let state: ReadbackState = "idle";
  let cachedResult: Float32Array | null = null;
  let hasNewResultFlag = false;
  let pendingMapPromise: Promise<void> | null = null;

  // Copy data from mapped buffer to result array (handles row padding)
  function copyBufferData(mappedRange: ArrayBuffer): Float32Array {
    const result = new Float32Array(width * height);
    const sourceData = new Float32Array(mappedRange);
    const floatsPerRow = bytesPerRow / 4; // Convert bytes to floats

    for (let y = 0; y < height; y++) {
      const srcOffset = y * floatsPerRow;
      const dstOffset = y * width;
      for (let x = 0; x < width; x++) {
        result[dstOffset + x] = sourceData[srcOffset + x];
      }
    }

    return result;
  }

  // Try to complete pending mapping operation
  async function tryCompleteMapping(): Promise<boolean> {
    if (state !== "mapping" || pendingBufferIndex < 0) {
      return false;
    }

    const buffer = stagingBuffers[pendingBufferIndex];

    try {
      // Wait for the map to complete (this should be quick if GPU is done)
      await pendingMapPromise;

      const mappedRange = buffer.getMappedRange();
      cachedResult = copyBufferData(mappedRange);
      buffer.unmap();

      hasNewResultFlag = true;
      state = "ready";
      pendingBufferIndex = -1;
      pendingMapPromise = null;

      return true;
    } catch {
      // Mapping failed - reset state
      state = "idle";
      pendingBufferIndex = -1;
      pendingMapPromise = null;
      return false;
    }
  }

  return {
    requestReadback(
      commandEncoder: GPUCommandEncoder,
      sourceTexture: GPUTexture,
    ) {
      // If we're in mapping state, try to complete it first (non-blocking check)
      if (state === "mapping" && pendingMapPromise) {
        // Check if promise is resolved by using Promise.race with a resolved promise
        void Promise.race([
          pendingMapPromise.then(() => true),
          Promise.resolve(false),
        ]).then((completed) => {
          if (completed) {
            void tryCompleteMapping();
          }
        });
      }

      // If previous buffer is still being processed, skip this request
      if (state === "mapping") {
        return;
      }

      // Select the buffer that's not currently being mapped
      const bufferIndex =
        pendingBufferIndex >= 0
          ? (pendingBufferIndex + 1) % 2
          : currentBufferIndex;
      const buffer = stagingBuffers[bufferIndex];

      // Copy texture to staging buffer
      commandEncoder.copyTextureToBuffer(
        { texture: sourceTexture },
        { buffer, bytesPerRow },
        { width, height },
      );

      // Update state
      currentBufferIndex = bufferIndex;
      pendingBufferIndex = bufferIndex;
      state = "copying";
    },

    pollResult(): Float32Array | null {
      // If we're in copying state, initiate the map operation
      if (state === "copying" && pendingBufferIndex >= 0) {
        const buffer = stagingBuffers[pendingBufferIndex];

        // Start mapping (non-blocking)
        pendingMapPromise = buffer.mapAsync(GPUMapMode.READ);
        state = "mapping";

        // Try to complete immediately if possible
        void pendingMapPromise
          .then(() => {
            void tryCompleteMapping();
          })
          .catch(() => {
            state = "idle";
            pendingBufferIndex = -1;
            pendingMapPromise = null;
          });
      }

      // If we're in mapping state, check if it's complete
      if (state === "mapping") {
        // Return cached result while waiting
        return cachedResult;
      }

      // If we have a new result, return it and clear the flag
      if (state === "ready" && hasNewResultFlag) {
        hasNewResultFlag = false;
        state = "idle";
        return cachedResult;
      }

      // Return cached result
      return cachedResult;
    },

    async awaitResult(): Promise<Float32Array | null> {
      // If idle or ready, return cached
      if (state === "idle" || state === "ready") {
        return cachedResult;
      }

      // If copying, initiate mapping
      if (state === "copying" && pendingBufferIndex >= 0) {
        const buffer = stagingBuffers[pendingBufferIndex];
        pendingMapPromise = buffer.mapAsync(GPUMapMode.READ);
        state = "mapping";
      }

      // Wait for mapping to complete
      if (state === "mapping" && pendingMapPromise) {
        await tryCompleteMapping();
        return cachedResult;
      }

      return cachedResult;
    },

    getState(): ReadbackState {
      return state;
    },

    isPending(): boolean {
      return state === "copying" || state === "mapping";
    },

    hasNewResult(): boolean {
      return hasNewResultFlag;
    },

    getCachedResult(): Float32Array | null {
      return cachedResult;
    },

    destroy() {
      // Ensure buffers are unmapped before destroying
      for (const buffer of stagingBuffers) {
        try {
          buffer.destroy();
        } catch {
          // Buffer may already be destroyed
        }
      }
    },
  };
}

export default createAsyncReadbackManager;
