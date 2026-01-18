/**
 * Async GPU Readback Manager v2
 * Implements request-tracking queue for non-blocking GPU state reads
 *
 * Improvements over v1:
 * - Request ID tracking for specific readback correlation
 * - Queue-based management to never drop requests
 * - Buffer availability tracking
 * - Explicit request lifecycle management
 *
 * Uses a multi-buffer rotation pattern:
 * - N buffers (default 3) rotate through states
 * - Each buffer can be: available → copying → mapping → ready → consumed → available
 * - Requests are queued when no buffer is available
 */

export type ReadbackRequestStatus =
  | "pending" // Waiting for buffer
  | "copying" // GPU copy in progress
  | "mapping" // Buffer mapping in progress
  | "ready" // Data ready to read
  | "consumed" // Data has been read
  | "failed"; // Request failed

export interface ReadbackRequest {
  id: number;
  bufferIndex: number;
  status: ReadbackRequestStatus;
  createdAt: number;
  completedAt?: number;
  data?: Float32Array;
  error?: Error;
}

export interface AsyncReadbackConfig {
  width: number;
  height: number;
  bytesPerPixel?: number; // Default: 4 (r32float)
  numBuffers?: number; // Default: 3
  maxQueueSize?: number; // Default: 10
}

export interface AsyncReadbackStats {
  totalRequests: number;
  completedRequests: number;
  failedRequests: number;
  droppedRequests: number;
  pendingRequests: number;
  avgLatencyMs: number;
}

export interface AsyncReadbackManagerV2 {
  /**
   * Request a new readback. Returns request ID.
   * Returns -1 if queue is full (request dropped).
   */
  requestReadback(
    commandEncoder: GPUCommandEncoder,
    sourceTexture: GPUTexture,
  ): number;

  /**
   * Poll for the latest ready result. Non-blocking.
   * Returns the most recent data, or null if none available.
   */
  pollResult(): Float32Array | null;

  /**
   * Poll for a specific request's result.
   * Returns null if request not found or not ready.
   */
  pollRequest(requestId: number): Float32Array | null;

  /**
   * Get the status of a specific request.
   */
  getRequestStatus(requestId: number): ReadbackRequestStatus | null;

  /**
   * Wait for any pending readback to complete.
   */
  awaitResult(): Promise<Float32Array | null>;

  /**
   * Wait for a specific request to complete.
   */
  awaitRequest(requestId: number): Promise<Float32Array | null>;

  /**
   * Check if any readback is pending.
   */
  isPending(): boolean;

  /**
   * Check if a specific request is pending.
   */
  isRequestPending(requestId: number): boolean;

  /**
   * Get the number of pending requests.
   */
  getPendingCount(): number;

  /**
   * Get the last successfully read result (cached).
   */
  getCachedResult(): Float32Array | null;

  /**
   * Get statistics about readback operations.
   */
  getStats(): AsyncReadbackStats;

  /**
   * Process pending operations. Call periodically to advance state machine.
   */
  tick(): void;

  /**
   * Cleanup resources.
   */
  destroy(): void;
}

interface BufferState {
  buffer: GPUBuffer;
  status: "available" | "copying" | "mapping" | "ready";
  requestId: number;
  mapPromise: Promise<void> | null;
}

/**
 * Create an async readback manager with request tracking
 */
export function createAsyncReadbackManagerV2(
  device: GPUDevice,
  config: AsyncReadbackConfig,
): AsyncReadbackManagerV2 {
  const {
    width,
    height,
    bytesPerPixel = 4,
    numBuffers = 3,
    maxQueueSize = 10,
  } = config;

  // Calculate row padding for WebGPU alignment (256 byte alignment)
  const unalignedBytesPerRow = width * bytesPerPixel;
  const bytesPerRow = Math.ceil(unalignedBytesPerRow / 256) * 256;
  const bufferSize = bytesPerRow * height;

  // Create staging buffers
  const bufferStates: BufferState[] = [];
  for (let i = 0; i < numBuffers; i++) {
    bufferStates.push({
      buffer: device.createBuffer({
        label: `async-readback-staging-${i}`,
        size: bufferSize,
        usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
      }),
      status: "available",
      requestId: -1,
      mapPromise: null,
    });
  }

  // Request tracking
  let nextRequestId = 1;
  const requests = new Map<number, ReadbackRequest>();
  const pendingQueue: number[] = []; // Request IDs waiting for buffer

  // Statistics
  let totalRequests = 0;
  let completedRequests = 0;
  let failedRequests = 0;
  let droppedRequests = 0;
  let totalLatencyMs = 0;

  // Cached result
  let cachedResult: Float32Array | null = null;

  /**
   * Copy data from mapped buffer to result array (handles row padding)
   */
  function copyBufferData(mappedRange: ArrayBuffer): Float32Array {
    const result = new Float32Array(width * height);
    const sourceData = new Float32Array(mappedRange);
    const floatsPerRow = bytesPerRow / 4;

    for (let y = 0; y < height; y++) {
      const srcOffset = y * floatsPerRow;
      const dstOffset = y * width;
      for (let x = 0; x < width; x++) {
        result[dstOffset + x] = sourceData[srcOffset + x];
      }
    }

    return result;
  }

  /**
   * Find an available buffer
   */
  function findAvailableBuffer(): BufferState | null {
    return bufferStates.find((b) => b.status === "available") ?? null;
  }

  /**
   * Process a request that's waiting for a buffer
   */
  function processQueuedRequest(
    requestId: number,
    commandEncoder: GPUCommandEncoder,
    sourceTexture: GPUTexture,
  ): boolean {
    const request = requests.get(requestId);
    if (!request || request.status !== "pending") {
      return false;
    }

    const bufferState = findAvailableBuffer();
    if (!bufferState) {
      return false; // No buffer available yet
    }

    // Assign buffer to request
    const bufferIndex = bufferStates.indexOf(bufferState);
    bufferState.status = "copying";
    bufferState.requestId = requestId;

    request.bufferIndex = bufferIndex;
    request.status = "copying";

    // Copy texture to staging buffer
    commandEncoder.copyTextureToBuffer(
      { texture: sourceTexture },
      { buffer: bufferState.buffer, bytesPerRow },
      { width, height },
    );

    return true;
  }

  /**
   * Try to complete mapping for a buffer
   */
  async function tryCompleteMapping(bufferState: BufferState): Promise<void> {
    if (bufferState.status !== "mapping" || !bufferState.mapPromise) {
      return;
    }

    const request = requests.get(bufferState.requestId);
    if (!request) {
      bufferState.status = "available";
      bufferState.requestId = -1;
      bufferState.mapPromise = null;
      return;
    }

    try {
      await bufferState.mapPromise;

      const mappedRange = bufferState.buffer.getMappedRange();
      const data = copyBufferData(mappedRange);
      bufferState.buffer.unmap();

      request.status = "ready";
      request.data = data;
      request.completedAt = performance.now();
      cachedResult = data;

      // Update stats
      completedRequests++;
      totalLatencyMs += request.completedAt - request.createdAt;

      bufferState.status = "ready";
    } catch (error) {
      request.status = "failed";
      request.error = error instanceof Error ? error : new Error(String(error));
      failedRequests++;

      bufferState.status = "available";
      bufferState.requestId = -1;
      bufferState.mapPromise = null;
    }
  }

  /**
   * Process all buffers in copying state
   */
  function processCopyingBuffers(): void {
    for (const bufferState of bufferStates) {
      if (bufferState.status === "copying") {
        const request = requests.get(bufferState.requestId);
        if (!request) {
          bufferState.status = "available";
          bufferState.requestId = -1;
          continue;
        }

        // Start mapping
        bufferState.mapPromise = bufferState.buffer.mapAsync(GPUMapMode.READ);
        bufferState.status = "mapping";
        request.status = "mapping";

        // Handle completion asynchronously
        void tryCompleteMapping(bufferState);
      }
    }
  }

  /**
   * Clean up consumed requests and free buffers
   */
  function cleanupConsumedRequests(): void {
    for (const bufferState of bufferStates) {
      if (bufferState.status === "ready") {
        const request = requests.get(bufferState.requestId);
        if (request && request.status === "consumed") {
          bufferState.status = "available";
          bufferState.requestId = -1;
          requests.delete(request.id);
        }
      }
    }

    // Clean up old consumed/failed requests (keep last 100)
    if (requests.size > 100) {
      const sortedIds = Array.from(requests.keys()).sort((a, b) => a - b);
      const toRemove = sortedIds.slice(0, requests.size - 100);
      for (const id of toRemove) {
        const req = requests.get(id);
        if (req && (req.status === "consumed" || req.status === "failed")) {
          requests.delete(id);
        }
      }
    }
  }

  return {
    requestReadback(
      commandEncoder: GPUCommandEncoder,
      sourceTexture: GPUTexture,
    ): number {
      // Check queue size limit
      if (pendingQueue.length >= maxQueueSize) {
        droppedRequests++;
        return -1;
      }

      // Create request
      const requestId = nextRequestId++;
      const request: ReadbackRequest = {
        id: requestId,
        bufferIndex: -1,
        status: "pending",
        createdAt: performance.now(),
      };
      requests.set(requestId, request);
      totalRequests++;

      // Try to process immediately
      const bufferState = findAvailableBuffer();
      if (bufferState) {
        const bufferIndex = bufferStates.indexOf(bufferState);
        bufferState.status = "copying";
        bufferState.requestId = requestId;

        request.bufferIndex = bufferIndex;
        request.status = "copying";

        commandEncoder.copyTextureToBuffer(
          { texture: sourceTexture },
          { buffer: bufferState.buffer, bytesPerRow },
          { width, height },
        );
      } else {
        // Queue for later
        pendingQueue.push(requestId);
      }

      return requestId;
    },

    pollResult(): Float32Array | null {
      // Process state machine
      this.tick();

      // Find the most recent ready request
      let latestReady: ReadbackRequest | null = null;
      for (const request of requests.values()) {
        if (request.status === "ready" && request.data) {
          if (!latestReady || request.id > latestReady.id) {
            latestReady = request;
          }
        }
      }

      if (latestReady && latestReady.data) {
        latestReady.status = "consumed";
        return latestReady.data;
      }

      return cachedResult;
    },

    pollRequest(requestId: number): Float32Array | null {
      this.tick();

      const request = requests.get(requestId);
      if (!request || request.status !== "ready" || !request.data) {
        return null;
      }

      request.status = "consumed";
      return request.data;
    },

    getRequestStatus(requestId: number): ReadbackRequestStatus | null {
      const request = requests.get(requestId);
      return request?.status ?? null;
    },

    async awaitResult(): Promise<Float32Array | null> {
      // Process until a result is ready
      const maxAttempts = 100;
      for (let i = 0; i < maxAttempts; i++) {
        this.tick();

        for (const request of requests.values()) {
          if (request.status === "ready" && request.data) {
            request.status = "consumed";
            return request.data;
          }
        }

        // Wait a bit before retrying
        await new Promise((resolve) => setTimeout(resolve, 1));
      }

      return cachedResult;
    },

    async awaitRequest(requestId: number): Promise<Float32Array | null> {
      const maxAttempts = 100;
      for (let i = 0; i < maxAttempts; i++) {
        this.tick();

        const request = requests.get(requestId);
        if (!request) {
          return null;
        }

        if (request.status === "ready" && request.data) {
          request.status = "consumed";
          return request.data;
        }

        if (request.status === "failed") {
          return null;
        }

        await new Promise((resolve) => setTimeout(resolve, 1));
      }

      return null;
    },

    isPending(): boolean {
      return (
        pendingQueue.length > 0 ||
        bufferStates.some(
          (b) => b.status === "copying" || b.status === "mapping",
        )
      );
    },

    isRequestPending(requestId: number): boolean {
      const request = requests.get(requestId);
      if (!request) return false;
      return (
        request.status === "pending" ||
        request.status === "copying" ||
        request.status === "mapping"
      );
    },

    getPendingCount(): number {
      let count = pendingQueue.length;
      for (const request of requests.values()) {
        if (
          request.status === "pending" ||
          request.status === "copying" ||
          request.status === "mapping"
        ) {
          count++;
        }
      }
      return count;
    },

    getCachedResult(): Float32Array | null {
      return cachedResult;
    },

    getStats(): AsyncReadbackStats {
      const pendingCount = this.getPendingCount();
      return {
        totalRequests,
        completedRequests,
        failedRequests,
        droppedRequests,
        pendingRequests: pendingCount,
        avgLatencyMs:
          completedRequests > 0 ? totalLatencyMs / completedRequests : 0,
      };
    },

    tick(): void {
      // Process copying → mapping transitions
      processCopyingBuffers();

      // Clean up consumed requests
      cleanupConsumedRequests();
    },

    destroy(): void {
      for (const bufferState of bufferStates) {
        try {
          bufferState.buffer.destroy();
        } catch {
          // Buffer may already be destroyed
        }
      }
      requests.clear();
      pendingQueue.length = 0;
    },
  };
}

export default createAsyncReadbackManagerV2;
