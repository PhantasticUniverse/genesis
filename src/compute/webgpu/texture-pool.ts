/**
 * Texture Pool Manager
 * Manages GPU texture allocation to reduce memory fragmentation
 *
 * Features:
 * - Pools textures by size and format
 * - Tracks usage to allow cleanup of stale textures
 * - Reduces GPU memory churn on mode switches
 */

export interface PooledTexture {
  texture: GPUTexture;
  key: string;
  lastUsedFrame: number;
  inUse: boolean;
}

export interface TexturePoolConfig {
  /** Frames of non-use before texture is eligible for cleanup */
  staleFrames: number;
  /** Maximum textures per pool key */
  maxPerKey: number;
  /** Enable debug logging */
  debug: boolean;
}

const DEFAULT_CONFIG: TexturePoolConfig = {
  staleFrames: 300,
  maxPerKey: 4,
  debug: false,
};

/**
 * Generate a pool key from texture descriptor
 */
export function texturePoolKey(
  width: number,
  height: number,
  format: GPUTextureFormat,
): string {
  return `${width}x${height}-${format}`;
}

/**
 * Texture Pool for efficient GPU texture management
 */
export class TexturePool {
  private device: GPUDevice;
  private config: TexturePoolConfig;
  private pools: Map<string, PooledTexture[]> = new Map();
  private currentFrame = 0;
  private totalCreated = 0;
  private totalReused = 0;

  constructor(device: GPUDevice, config: Partial<TexturePoolConfig> = {}) {
    this.device = device;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Acquire a texture from the pool or create a new one
   */
  acquire(
    width: number,
    height: number,
    format: GPUTextureFormat,
    usage: GPUTextureUsageFlags,
    label?: string,
  ): GPUTexture {
    const key = texturePoolKey(width, height, format);
    let pool = this.pools.get(key);

    if (!pool) {
      pool = [];
      this.pools.set(key, pool);
    }

    // Look for an available texture in the pool
    for (const pooled of pool) {
      if (!pooled.inUse) {
        pooled.inUse = true;
        pooled.lastUsedFrame = this.currentFrame;
        this.totalReused++;

        if (this.config.debug) {
          console.log(`[TexturePool] Reused texture: ${key}`);
        }

        return pooled.texture;
      }
    }

    // No available texture, create a new one
    const texture = this.device.createTexture({
      label: label ?? `pooled-${key}`,
      size: [width, height],
      format,
      usage,
    });

    const pooledTexture: PooledTexture = {
      texture,
      key,
      lastUsedFrame: this.currentFrame,
      inUse: true,
    };

    // Add to pool if under limit
    if (pool.length < this.config.maxPerKey) {
      pool.push(pooledTexture);
    }

    this.totalCreated++;

    if (this.config.debug) {
      console.log(
        `[TexturePool] Created texture: ${key} (total: ${this.totalCreated})`,
      );
    }

    return texture;
  }

  /**
   * Release a texture back to the pool
   */
  release(texture: GPUTexture): void {
    for (const pool of this.pools.values()) {
      for (const pooled of pool) {
        if (pooled.texture === texture) {
          pooled.inUse = false;
          pooled.lastUsedFrame = this.currentFrame;

          if (this.config.debug) {
            console.log(`[TexturePool] Released texture: ${pooled.key}`);
          }

          return;
        }
      }
    }

    // Texture not in pool, just destroy it
    texture.destroy();
  }

  /**
   * Advance frame counter (call once per frame)
   */
  tick(): void {
    this.currentFrame++;
  }

  /**
   * Clean up stale textures that haven't been used recently
   */
  cleanup(): number {
    let cleaned = 0;
    const staleThreshold = this.currentFrame - this.config.staleFrames;

    for (const [key, pool] of this.pools.entries()) {
      // Remove stale textures
      const remaining: PooledTexture[] = [];

      for (const pooled of pool) {
        if (!pooled.inUse && pooled.lastUsedFrame < staleThreshold) {
          pooled.texture.destroy();
          cleaned++;

          if (this.config.debug) {
            console.log(`[TexturePool] Cleaned stale texture: ${key}`);
          }
        } else {
          remaining.push(pooled);
        }
      }

      if (remaining.length === 0) {
        this.pools.delete(key);
      } else {
        this.pools.set(key, remaining);
      }
    }

    return cleaned;
  }

  /**
   * Get pool statistics
   */
  getStats(): {
    totalCreated: number;
    totalReused: number;
    pooledCount: number;
    inUseCount: number;
    poolKeys: string[];
  } {
    let pooledCount = 0;
    let inUseCount = 0;

    for (const pool of this.pools.values()) {
      pooledCount += pool.length;
      inUseCount += pool.filter((p) => p.inUse).length;
    }

    return {
      totalCreated: this.totalCreated,
      totalReused: this.totalReused,
      pooledCount,
      inUseCount,
      poolKeys: Array.from(this.pools.keys()),
    };
  }

  /**
   * Destroy all pooled textures
   */
  destroy(): void {
    for (const pool of this.pools.values()) {
      for (const pooled of pool) {
        pooled.texture.destroy();
      }
    }
    this.pools.clear();

    if (this.config.debug) {
      console.log("[TexturePool] Destroyed all textures");
    }
  }
}

/**
 * Create a texture pool
 */
export function createTexturePool(
  device: GPUDevice,
  config?: Partial<TexturePoolConfig>,
): TexturePool {
  return new TexturePool(device, config);
}
