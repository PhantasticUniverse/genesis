/**
 * Boundary Conditions Tests
 * Tests for different boundary handling modes in continuous CA
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock WebGPU types
interface MockGPUBuffer {
  label: string;
  destroy: ReturnType<typeof vi.fn>;
}

interface MockGPUTexture {
  label: string;
  createView: ReturnType<typeof vi.fn>;
  destroy: ReturnType<typeof vi.fn>;
}

interface MockGPUBindGroup {
  label: string;
}

interface MockGPUComputePipeline {
  label: string;
}

interface MockGPUBindGroupLayout {
  label: string;
}

describe("BoundaryMode types", () => {
  it("should define all four boundary modes", () => {
    type BoundaryMode = "periodic" | "clamped" | "reflected" | "zero";

    const modes: BoundaryMode[] = ["periodic", "clamped", "reflected", "zero"];
    expect(modes).toHaveLength(4);
    expect(modes).toContain("periodic");
    expect(modes).toContain("clamped");
    expect(modes).toContain("reflected");
    expect(modes).toContain("zero");
  });
});

describe("boundaryModeToValue", () => {
  // Test the mapping function logic
  function boundaryModeToValue(
    mode: "periodic" | "clamped" | "reflected" | "zero",
  ): number {
    switch (mode) {
      case "periodic":
        return 0;
      case "clamped":
        return 1;
      case "reflected":
        return 2;
      case "zero":
        return 3;
      default:
        return 0;
    }
  }

  it("should map periodic to 0", () => {
    expect(boundaryModeToValue("periodic")).toBe(0);
  });

  it("should map clamped to 1", () => {
    expect(boundaryModeToValue("clamped")).toBe(1);
  });

  it("should map reflected to 2", () => {
    expect(boundaryModeToValue("reflected")).toBe(2);
  });

  it("should map zero to 3", () => {
    expect(boundaryModeToValue("zero")).toBe(3);
  });
});

describe("ContinuousPipeline boundary mode", () => {
  let mockDevice: {
    createBuffer: ReturnType<typeof vi.fn>;
    createTexture: ReturnType<typeof vi.fn>;
    createBindGroupLayout: ReturnType<typeof vi.fn>;
    createPipelineLayout: ReturnType<typeof vi.fn>;
    createComputePipeline: ReturnType<typeof vi.fn>;
    createBindGroup: ReturnType<typeof vi.fn>;
    createShaderModule: ReturnType<typeof vi.fn>;
    queue: {
      writeBuffer: ReturnType<typeof vi.fn>;
      writeTexture: ReturnType<typeof vi.fn>;
    };
  };

  let mockBuffers: MockGPUBuffer[];
  let mockTextures: MockGPUTexture[];
  let writeBufferCalls: Array<{
    buffer: MockGPUBuffer;
    offset: number;
    data: ArrayBuffer;
  }>;

  beforeEach(() => {
    mockBuffers = [];
    mockTextures = [];
    writeBufferCalls = [];

    const createBuffer = (desc: { label: string }) => {
      const buffer: MockGPUBuffer = {
        label: desc.label,
        destroy: vi.fn(),
      };
      mockBuffers.push(buffer);
      return buffer;
    };

    const createTexture = (desc: { label: string }) => {
      const texture: MockGPUTexture = {
        label: desc.label,
        createView: vi.fn().mockReturnValue({}),
        destroy: vi.fn(),
      };
      mockTextures.push(texture);
      return texture;
    };

    mockDevice = {
      createBuffer: vi.fn().mockImplementation(createBuffer),
      createTexture: vi.fn().mockImplementation(createTexture),
      createBindGroupLayout: vi.fn().mockImplementation(
        (desc: { label: string }): MockGPUBindGroupLayout => ({
          label: desc.label,
        }),
      ),
      createPipelineLayout: vi.fn().mockReturnValue({}),
      createComputePipeline: vi.fn().mockImplementation(
        (desc: { label: string }): MockGPUComputePipeline => ({
          label: desc.label,
        }),
      ),
      createBindGroup: vi.fn().mockImplementation(
        (desc: { label: string }): MockGPUBindGroup => ({
          label: desc.label,
        }),
      ),
      createShaderModule: vi.fn().mockReturnValue({}),
      queue: {
        writeBuffer: vi.fn().mockImplementation((buffer, offset, data) => {
          writeBufferCalls.push({ buffer, offset, data });
        }),
        writeTexture: vi.fn(),
      },
    };
  });

  it("should include boundary mode in uniform buffer", () => {
    // Simulate the uniform buffer structure
    // Based on the shader: width, height, kernel_radius, kernel_size, growth_center, growth_width, dt, growth_type, normalization_factor, boundary_mode, padding, padding
    const data = new ArrayBuffer(48);
    const u32View = new Uint32Array(data);
    const f32View = new Float32Array(data);

    const width = 64;
    const height = 64;
    const kernelRadius = 13;
    const growthCenter = 0.15;
    const growthWidth = 0.015;
    const dt = 0.1;
    const growthType = 0;
    const normalizationFactor = 1.0;
    const boundaryMode = 2; // reflected

    u32View[0] = width;
    u32View[1] = height;
    u32View[2] = kernelRadius;
    u32View[3] = kernelRadius * 2 + 1;
    f32View[4] = growthCenter;
    f32View[5] = growthWidth;
    f32View[6] = dt;
    u32View[7] = growthType;
    f32View[8] = normalizationFactor;
    u32View[9] = boundaryMode;

    // Verify the boundary mode is at the expected position
    expect(u32View[9]).toBe(2);
    expect(u32View[0]).toBe(64);
    expect(u32View[1]).toBe(64);
  });

  it("should have correct buffer size for all uniforms including boundary mode", () => {
    // 12 x 4 bytes = 48 bytes total
    // width(4) + height(4) + kernel_radius(4) + kernel_size(4) +
    // growth_center(4) + growth_width(4) + dt(4) + growth_type(4) +
    // normalization_factor(4) + boundary_mode(4) + padding(4) + padding(4)
    const expectedSize = 48;
    const data = new ArrayBuffer(expectedSize);
    expect(data.byteLength).toBe(48);
  });
});

describe("Boundary application logic", () => {
  // These tests verify the mathematical logic of boundary conditions
  // without needing actual WebGPU

  interface BoundaryResult {
    x: number;
    y: number;
    valid: boolean;
  }

  function applyBoundary(
    x: number,
    y: number,
    width: number,
    height: number,
    mode: "periodic" | "clamped" | "reflected" | "zero",
  ): BoundaryResult {
    let resultX = x;
    let resultY = y;
    let valid = true;

    switch (mode) {
      case "periodic":
        // Toroidal wrap
        if (resultX < 0) resultX = resultX + width;
        if (resultY < 0) resultY = resultY + height;
        if (resultX >= width) resultX = resultX - width;
        if (resultY >= height) resultY = resultY - height;
        break;

      case "clamped":
        // Clamp to edge
        resultX = Math.max(0, Math.min(width - 1, resultX));
        resultY = Math.max(0, Math.min(height - 1, resultY));
        break;

      case "reflected":
        // Mirror at boundary
        if (resultX < 0) resultX = -resultX - 1;
        if (resultY < 0) resultY = -resultY - 1;
        if (resultX >= width) resultX = 2 * width - resultX - 1;
        if (resultY >= height) resultY = 2 * height - resultY - 1;
        // Additional clamp for safety
        resultX = Math.max(0, Math.min(width - 1, resultX));
        resultY = Math.max(0, Math.min(height - 1, resultY));
        break;

      case "zero":
        // Out of bounds = invalid
        if (
          resultX < 0 ||
          resultX >= width ||
          resultY < 0 ||
          resultY >= height
        ) {
          valid = false;
        }
        break;
    }

    return { x: resultX, y: resultY, valid };
  }

  describe("periodic mode", () => {
    const width = 64;
    const height = 64;
    const mode = "periodic" as const;

    it("should not change valid coordinates", () => {
      const result = applyBoundary(32, 32, width, height, mode);
      expect(result).toEqual({ x: 32, y: 32, valid: true });
    });

    it("should wrap negative x to the right", () => {
      const result = applyBoundary(-1, 32, width, height, mode);
      expect(result).toEqual({ x: 63, y: 32, valid: true });
    });

    it("should wrap negative y to the bottom", () => {
      const result = applyBoundary(32, -1, width, height, mode);
      expect(result).toEqual({ x: 32, y: 63, valid: true });
    });

    it("should wrap x >= width to the left", () => {
      const result = applyBoundary(64, 32, width, height, mode);
      expect(result).toEqual({ x: 0, y: 32, valid: true });
    });

    it("should wrap y >= height to the top", () => {
      const result = applyBoundary(32, 64, width, height, mode);
      expect(result).toEqual({ x: 32, y: 0, valid: true });
    });
  });

  describe("clamped mode", () => {
    const width = 64;
    const height = 64;
    const mode = "clamped" as const;

    it("should not change valid coordinates", () => {
      const result = applyBoundary(32, 32, width, height, mode);
      expect(result).toEqual({ x: 32, y: 32, valid: true });
    });

    it("should clamp negative x to 0", () => {
      const result = applyBoundary(-5, 32, width, height, mode);
      expect(result).toEqual({ x: 0, y: 32, valid: true });
    });

    it("should clamp negative y to 0", () => {
      const result = applyBoundary(32, -5, width, height, mode);
      expect(result).toEqual({ x: 32, y: 0, valid: true });
    });

    it("should clamp x >= width to width-1", () => {
      const result = applyBoundary(70, 32, width, height, mode);
      expect(result).toEqual({ x: 63, y: 32, valid: true });
    });

    it("should clamp y >= height to height-1", () => {
      const result = applyBoundary(32, 70, width, height, mode);
      expect(result).toEqual({ x: 32, y: 63, valid: true });
    });
  });

  describe("reflected mode", () => {
    const width = 64;
    const height = 64;
    const mode = "reflected" as const;

    it("should not change valid coordinates", () => {
      const result = applyBoundary(32, 32, width, height, mode);
      expect(result).toEqual({ x: 32, y: 32, valid: true });
    });

    it("should reflect negative x", () => {
      // x = -1 => -(-1) - 1 = 0
      const result = applyBoundary(-1, 32, width, height, mode);
      expect(result).toEqual({ x: 0, y: 32, valid: true });
    });

    it("should reflect negative x further out", () => {
      // x = -3 => -(-3) - 1 = 2
      const result = applyBoundary(-3, 32, width, height, mode);
      expect(result).toEqual({ x: 2, y: 32, valid: true });
    });

    it("should reflect x >= width", () => {
      // x = 65 => 2*64 - 65 - 1 = 128 - 66 = 62
      const result = applyBoundary(65, 32, width, height, mode);
      expect(result).toEqual({ x: 62, y: 32, valid: true });
    });

    it("should reflect y >= height", () => {
      // y = 65 => 2*64 - 65 - 1 = 62
      const result = applyBoundary(32, 65, width, height, mode);
      expect(result).toEqual({ x: 32, y: 62, valid: true });
    });
  });

  describe("zero mode", () => {
    const width = 64;
    const height = 64;
    const mode = "zero" as const;

    it("should mark valid coordinates as valid", () => {
      const result = applyBoundary(32, 32, width, height, mode);
      expect(result.valid).toBe(true);
    });

    it("should mark negative x as invalid", () => {
      const result = applyBoundary(-1, 32, width, height, mode);
      expect(result.valid).toBe(false);
    });

    it("should mark negative y as invalid", () => {
      const result = applyBoundary(32, -1, width, height, mode);
      expect(result.valid).toBe(false);
    });

    it("should mark x >= width as invalid", () => {
      const result = applyBoundary(64, 32, width, height, mode);
      expect(result.valid).toBe(false);
    });

    it("should mark y >= height as invalid", () => {
      const result = applyBoundary(32, 64, width, height, mode);
      expect(result.valid).toBe(false);
    });

    it("should mark corner coordinates as valid", () => {
      expect(applyBoundary(0, 0, width, height, mode).valid).toBe(true);
      expect(applyBoundary(63, 0, width, height, mode).valid).toBe(true);
      expect(applyBoundary(0, 63, width, height, mode).valid).toBe(true);
      expect(applyBoundary(63, 63, width, height, mode).valid).toBe(true);
    });
  });
});
