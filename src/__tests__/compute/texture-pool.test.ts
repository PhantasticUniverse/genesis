/**
 * Texture Pool Tests
 * Tests for GPU texture pooling and lifecycle management
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  TexturePool,
  createTexturePool,
  texturePoolKey,
} from "../../compute/webgpu/texture-pool";

describe("texture-pool", () => {
  let mockDevice: GPUDevice;

  beforeEach(async () => {
    const adapter = await navigator.gpu.requestAdapter();
    mockDevice = await adapter!.requestDevice();
  });

  describe("texturePoolKey", () => {
    it("creates key from dimensions and format", () => {
      const key = texturePoolKey(256, 256, "r32float");
      expect(key).toBe("256x256-r32float");
    });

    it("different dimensions produce different keys", () => {
      const key1 = texturePoolKey(256, 256, "r32float");
      const key2 = texturePoolKey(512, 256, "r32float");
      expect(key1).not.toBe(key2);
    });

    it("different formats produce different keys", () => {
      const key1 = texturePoolKey(256, 256, "r32float");
      const key2 = texturePoolKey(256, 256, "rgba8unorm");
      expect(key1).not.toBe(key2);
    });
  });

  describe("TexturePool", () => {
    describe("acquire", () => {
      it("creates new texture when pool is empty", () => {
        const pool = createTexturePool(mockDevice);
        const texture = pool.acquire(
          256,
          256,
          "r32float",
          GPUTextureUsage.STORAGE_BINDING,
        );

        expect(texture).toBeDefined();
        expect(pool.getStats().totalCreated).toBe(1);
        expect(pool.getStats().totalReused).toBe(0);

        pool.destroy();
      });

      it("reuses released texture", () => {
        const pool = createTexturePool(mockDevice);

        const texture1 = pool.acquire(
          256,
          256,
          "r32float",
          GPUTextureUsage.STORAGE_BINDING,
        );
        pool.release(texture1);

        const texture2 = pool.acquire(
          256,
          256,
          "r32float",
          GPUTextureUsage.STORAGE_BINDING,
        );

        expect(texture2).toBe(texture1);
        expect(pool.getStats().totalCreated).toBe(1);
        expect(pool.getStats().totalReused).toBe(1);

        pool.destroy();
      });

      it("creates new texture when all are in use", () => {
        const pool = createTexturePool(mockDevice);

        const texture1 = pool.acquire(
          256,
          256,
          "r32float",
          GPUTextureUsage.STORAGE_BINDING,
        );
        const texture2 = pool.acquire(
          256,
          256,
          "r32float",
          GPUTextureUsage.STORAGE_BINDING,
        );

        expect(texture1).not.toBe(texture2);
        expect(pool.getStats().totalCreated).toBe(2);

        pool.destroy();
      });

      it("respects maxPerKey limit", () => {
        const pool = createTexturePool(mockDevice, { maxPerKey: 2 });

        // Acquire 3 textures
        const textures = [
          pool.acquire(256, 256, "r32float", GPUTextureUsage.STORAGE_BINDING),
          pool.acquire(256, 256, "r32float", GPUTextureUsage.STORAGE_BINDING),
          pool.acquire(256, 256, "r32float", GPUTextureUsage.STORAGE_BINDING),
        ];

        // Only 2 should be in the pool
        expect(pool.getStats().pooledCount).toBe(2);
        expect(pool.getStats().totalCreated).toBe(3);

        pool.destroy();
      });

      it("uses separate pools for different formats", () => {
        const pool = createTexturePool(mockDevice);

        const texture1 = pool.acquire(
          256,
          256,
          "r32float",
          GPUTextureUsage.STORAGE_BINDING,
        );
        pool.release(texture1);

        const texture2 = pool.acquire(
          256,
          256,
          "rgba8unorm",
          GPUTextureUsage.STORAGE_BINDING,
        );

        // Should create new texture since format differs
        expect(texture2).not.toBe(texture1);
        expect(pool.getStats().poolKeys).toContain("256x256-r32float");
        expect(pool.getStats().poolKeys).toContain("256x256-rgba8unorm");

        pool.destroy();
      });
    });

    describe("release", () => {
      it("marks texture as available", () => {
        const pool = createTexturePool(mockDevice);

        const texture = pool.acquire(
          256,
          256,
          "r32float",
          GPUTextureUsage.STORAGE_BINDING,
        );
        expect(pool.getStats().inUseCount).toBe(1);

        pool.release(texture);
        expect(pool.getStats().inUseCount).toBe(0);

        pool.destroy();
      });

      it("destroys texture not in pool", () => {
        const pool = createTexturePool(mockDevice);

        // Create texture outside pool
        const texture = mockDevice.createTexture({
          size: [256, 256],
          format: "r32float",
          usage: GPUTextureUsage.STORAGE_BINDING,
        });

        // Should not throw
        expect(() => pool.release(texture)).not.toThrow();

        pool.destroy();
      });
    });

    describe("cleanup", () => {
      it("removes textures unused for staleFrames", () => {
        const pool = createTexturePool(mockDevice, { staleFrames: 10 });

        const texture = pool.acquire(
          256,
          256,
          "r32float",
          GPUTextureUsage.STORAGE_BINDING,
        );
        pool.release(texture);

        // Advance 15 frames
        for (let i = 0; i < 15; i++) {
          pool.tick();
        }

        const cleaned = pool.cleanup();
        expect(cleaned).toBe(1);
        expect(pool.getStats().pooledCount).toBe(0);

        pool.destroy();
      });

      it("keeps recently used textures", () => {
        const pool = createTexturePool(mockDevice, { staleFrames: 10 });

        const texture = pool.acquire(
          256,
          256,
          "r32float",
          GPUTextureUsage.STORAGE_BINDING,
        );
        pool.release(texture);

        // Advance only 5 frames
        for (let i = 0; i < 5; i++) {
          pool.tick();
        }

        const cleaned = pool.cleanup();
        expect(cleaned).toBe(0);
        expect(pool.getStats().pooledCount).toBe(1);

        pool.destroy();
      });

      it("keeps textures that are in use", () => {
        const pool = createTexturePool(mockDevice, { staleFrames: 10 });

        const texture = pool.acquire(
          256,
          256,
          "r32float",
          GPUTextureUsage.STORAGE_BINDING,
        );
        // Don't release it

        // Advance many frames
        for (let i = 0; i < 50; i++) {
          pool.tick();
        }

        const cleaned = pool.cleanup();
        expect(cleaned).toBe(0);
        expect(pool.getStats().inUseCount).toBe(1);

        pool.destroy();
      });
    });

    describe("getStats", () => {
      it("returns accurate statistics", () => {
        const pool = createTexturePool(mockDevice);

        pool.acquire(256, 256, "r32float", GPUTextureUsage.STORAGE_BINDING);
        pool.acquire(256, 256, "r32float", GPUTextureUsage.STORAGE_BINDING);
        pool.acquire(512, 512, "r32float", GPUTextureUsage.STORAGE_BINDING);

        const stats = pool.getStats();
        expect(stats.totalCreated).toBe(3);
        expect(stats.pooledCount).toBe(3);
        expect(stats.inUseCount).toBe(3);
        expect(stats.poolKeys).toHaveLength(2);

        pool.destroy();
      });
    });

    describe("destroy", () => {
      it("clears all pools", () => {
        const pool = createTexturePool(mockDevice);

        pool.acquire(256, 256, "r32float", GPUTextureUsage.STORAGE_BINDING);
        pool.acquire(512, 512, "r32float", GPUTextureUsage.STORAGE_BINDING);

        pool.destroy();

        const stats = pool.getStats();
        expect(stats.pooledCount).toBe(0);
        expect(stats.poolKeys).toHaveLength(0);
      });
    });
  });

  describe("createTexturePool", () => {
    it("creates pool with default config", () => {
      const pool = createTexturePool(mockDevice);
      expect(pool).toBeInstanceOf(TexturePool);
      pool.destroy();
    });

    it("creates pool with custom config", () => {
      const pool = createTexturePool(mockDevice, {
        staleFrames: 100,
        maxPerKey: 10,
      });
      expect(pool).toBeInstanceOf(TexturePool);
      pool.destroy();
    });
  });
});
