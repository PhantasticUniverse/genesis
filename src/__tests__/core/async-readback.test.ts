/**
 * Async Readback Manager Tests
 * Tests for non-blocking GPU state readback
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createAsyncReadbackManager,
  type AsyncReadbackConfig,
} from "../../core/async-readback";

// Mock WebGPU types
interface MockGPUBuffer {
  label: string;
  mapAsync: ReturnType<typeof vi.fn>;
  getMappedRange: ReturnType<typeof vi.fn>;
  unmap: ReturnType<typeof vi.fn>;
  destroy: ReturnType<typeof vi.fn>;
}

interface MockGPUCommandEncoder {
  copyTextureToBuffer: ReturnType<typeof vi.fn>;
}

describe("AsyncReadbackManager", () => {
  let mockDevice: {
    createBuffer: ReturnType<typeof vi.fn>;
  };
  let mockBuffers: MockGPUBuffer[];
  let config: AsyncReadbackConfig;

  beforeEach(() => {
    mockBuffers = [];

    mockDevice = {
      createBuffer: vi.fn().mockImplementation((desc: { label: string }) => {
        const buffer: MockGPUBuffer = {
          label: desc.label,
          mapAsync: vi.fn().mockResolvedValue(undefined),
          getMappedRange: vi.fn().mockReturnValue(new ArrayBuffer(64 * 64 * 4)),
          unmap: vi.fn(),
          destroy: vi.fn(),
        };
        mockBuffers.push(buffer);
        return buffer;
      }),
    };

    config = {
      width: 64,
      height: 64,
    };
  });

  describe("creation", () => {
    it("should create two staging buffers", () => {
      createAsyncReadbackManager(mockDevice as unknown as GPUDevice, config);
      expect(mockDevice.createBuffer).toHaveBeenCalledTimes(2);
    });

    it("should create buffers with correct size", () => {
      createAsyncReadbackManager(mockDevice as unknown as GPUDevice, config);

      // Row should be 256-byte aligned
      const expectedBytesPerRow = 256; // 64 * 4 = 256, already aligned
      const expectedSize = expectedBytesPerRow * 64;

      expect(mockDevice.createBuffer).toHaveBeenCalledWith(
        expect.objectContaining({
          size: expectedSize,
        }),
      );
    });

    it("should start in idle state", () => {
      const manager = createAsyncReadbackManager(
        mockDevice as unknown as GPUDevice,
        config,
      );
      expect(manager.getState()).toBe("idle");
    });
  });

  describe("requestReadback", () => {
    it("should copy texture to buffer", () => {
      const manager = createAsyncReadbackManager(
        mockDevice as unknown as GPUDevice,
        config,
      );

      const mockEncoder: MockGPUCommandEncoder = {
        copyTextureToBuffer: vi.fn(),
      };

      const mockTexture = {} as GPUTexture;
      manager.requestReadback(
        mockEncoder as unknown as GPUCommandEncoder,
        mockTexture,
      );

      expect(mockEncoder.copyTextureToBuffer).toHaveBeenCalled();
    });

    it("should transition to copying state", () => {
      const manager = createAsyncReadbackManager(
        mockDevice as unknown as GPUDevice,
        config,
      );

      const mockEncoder: MockGPUCommandEncoder = {
        copyTextureToBuffer: vi.fn(),
      };

      manager.requestReadback(
        mockEncoder as unknown as GPUCommandEncoder,
        {} as GPUTexture,
      );

      expect(manager.getState()).toBe("copying");
    });
  });

  describe("pollResult", () => {
    it("should return null initially", () => {
      const manager = createAsyncReadbackManager(
        mockDevice as unknown as GPUDevice,
        config,
      );

      expect(manager.pollResult()).toBeNull();
    });

    it("should return cached result if available", async () => {
      const manager = createAsyncReadbackManager(
        mockDevice as unknown as GPUDevice,
        config,
      );

      const mockEncoder: MockGPUCommandEncoder = {
        copyTextureToBuffer: vi.fn(),
      };

      // Request and wait for result
      manager.requestReadback(
        mockEncoder as unknown as GPUCommandEncoder,
        {} as GPUTexture,
      );

      // Poll triggers mapping
      const result1 = manager.pollResult();

      // Wait for map to complete
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Second poll should return data
      const result2 = manager.pollResult();

      // Since map was mocked to resolve, we should get a result
      expect(result2).not.toBeNull();
    });
  });

  describe("state management", () => {
    it("should report pending when copying", () => {
      const manager = createAsyncReadbackManager(
        mockDevice as unknown as GPUDevice,
        config,
      );

      const mockEncoder: MockGPUCommandEncoder = {
        copyTextureToBuffer: vi.fn(),
      };

      manager.requestReadback(
        mockEncoder as unknown as GPUCommandEncoder,
        {} as GPUTexture,
      );

      expect(manager.isPending()).toBe(true);
    });

    it("should not be pending when idle", () => {
      const manager = createAsyncReadbackManager(
        mockDevice as unknown as GPUDevice,
        config,
      );

      expect(manager.isPending()).toBe(false);
    });
  });

  describe("cached result", () => {
    it("should initially have no cached result", () => {
      const manager = createAsyncReadbackManager(
        mockDevice as unknown as GPUDevice,
        config,
      );

      expect(manager.getCachedResult()).toBeNull();
    });
  });

  describe("destroy", () => {
    it("should destroy all staging buffers", () => {
      const manager = createAsyncReadbackManager(
        mockDevice as unknown as GPUDevice,
        config,
      );

      manager.destroy();

      for (const buffer of mockBuffers) {
        expect(buffer.destroy).toHaveBeenCalled();
      }
    });
  });

  describe("row padding", () => {
    it("should handle non-aligned widths correctly", () => {
      const narrowConfig = {
        width: 100, // Not aligned to 256 bytes
        height: 64,
      };

      createAsyncReadbackManager(
        mockDevice as unknown as GPUDevice,
        narrowConfig,
      );

      // 100 * 4 = 400 bytes, should round up to 512 (next multiple of 256)
      const expectedBytesPerRow = 512;
      const expectedSize = expectedBytesPerRow * 64;

      expect(mockDevice.createBuffer).toHaveBeenCalledWith(
        expect.objectContaining({
          size: expectedSize,
        }),
      );
    });
  });
});
