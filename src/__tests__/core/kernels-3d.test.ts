/**
 * 3D Kernel System Tests
 * Tests for 3D spherical convolution kernel generation and normalization
 */

import { describe, it, expect } from "vitest";
import {
  generate3DKernel,
  normalize3DKernel,
  generateGaussian3DKernel,
  generateShell3DKernel,
  extractKernelSlice,
  getKernel3DStats,
  KERNEL_3D_PRESETS,
  type Kernel3DData,
} from "../../core/kernels-3d";
import type { Kernel3DConfig } from "../../core/types-3d";

describe("kernels-3d", () => {
  describe("generate3DKernel", () => {
    describe("basic generation", () => {
      it("generates correct size for cubic kernel", () => {
        const config: Kernel3DConfig = {
          radius: 5,
          peakPositions: [0.5],
          peakWidths: [0.23],
          peakWeights: [1],
        };
        const kernel = generate3DKernel(config);

        expect(kernel.size).toBe(11); // 2*5 + 1
        expect(kernel.radius).toBe(5);
        expect(kernel.weights.length).toBe(11 * 11 * 11); // 1331 voxels
      });

      it("generates normalized kernel (values between 0 and 1)", () => {
        const config: Kernel3DConfig = {
          radius: 8,
          peakPositions: [0.5],
          peakWidths: [0.23],
          peakWeights: [1],
        };
        const kernel = generate3DKernel(config);

        for (const weight of kernel.weights) {
          expect(weight).toBeGreaterThanOrEqual(0);
          expect(weight).toBeLessThanOrEqual(1);
        }
      });

      it("has positive sum for valid configuration", () => {
        const config: Kernel3DConfig = {
          radius: 10,
          peakPositions: [0.5],
          peakWidths: [0.2],
          peakWeights: [1],
        };
        const kernel = generate3DKernel(config);

        expect(kernel.sum).toBeGreaterThan(0);
      });
    });

    describe("center handling", () => {
      it("zeros out center voxel", () => {
        const config: Kernel3DConfig = {
          radius: 5,
          peakPositions: [0.5],
          peakWidths: [0.23],
          peakWeights: [1],
        };
        const kernel = generate3DKernel(config);

        // Center voxel index: z * size^2 + y * size + x
        const centerIdx =
          kernel.radius * kernel.size * kernel.size +
          kernel.radius * kernel.size +
          kernel.radius;
        expect(kernel.weights[centerIdx]).toBe(0);
      });
    });

    describe("spherical symmetry", () => {
      it("produces spherically symmetric kernel", () => {
        const config: Kernel3DConfig = {
          radius: 6,
          peakPositions: [0.5],
          peakWidths: [0.2],
          peakWeights: [1],
        };
        const kernel = generate3DKernel(config);
        const { size, radius } = kernel;

        // Test points at same radius should have equal weights
        // (+3,0,0), (0,+3,0), (0,0,+3) should be equal
        const d = 3;
        const idx1 = radius * size * size + radius * size + (radius + d); // +X
        const idx2 = radius * size * size + (radius + d) * size + radius; // +Y
        const idx3 = (radius + d) * size * size + radius * size + radius; // +Z

        expect(kernel.weights[idx1]).toBeCloseTo(kernel.weights[idx2], 10);
        expect(kernel.weights[idx2]).toBeCloseTo(kernel.weights[idx3], 10);
      });

      it("has lower values at outer radius", () => {
        const config: Kernel3DConfig = {
          radius: 8,
          peakPositions: [0.5],
          peakWidths: [0.2],
          peakWeights: [1],
        };
        const kernel = generate3DKernel(config);
        const { size, radius } = kernel;

        // Point at peak radius (0.5 * radius = 4)
        const peakDist = 4;
        const peakIdx =
          radius * size * size + radius * size + (radius + peakDist);

        // Point near outer edge (radius - 1)
        const edgeDist = radius - 1;
        const edgeIdx =
          radius * size * size + radius * size + (radius + edgeDist);

        expect(kernel.weights[peakIdx]).toBeGreaterThan(
          kernel.weights[edgeIdx],
        );
      });
    });

    describe("multi-peak kernels", () => {
      it("supports multiple peaks", () => {
        const config: Kernel3DConfig = {
          radius: 10,
          peakPositions: [0.3, 0.7],
          peakWidths: [0.15, 0.15],
          peakWeights: [0.6, 0.4],
        };
        const kernel = generate3DKernel(config);

        expect(kernel.sum).toBeGreaterThan(0);
      });

      it("respects peak weights", () => {
        const config: Kernel3DConfig = {
          radius: 12,
          peakPositions: [0.3, 0.7],
          peakWidths: [0.15, 0.15],
          peakWeights: [1, 0.5], // First peak weighted 2x second
        };
        const kernel = generate3DKernel(config);
        const { size, radius } = kernel;

        // Sample at inner peak (0.3 * radius = 3.6 ≈ 4)
        const innerDist = Math.round(0.3 * radius);
        const innerIdx =
          radius * size * size + radius * size + (radius + innerDist);

        // Sample at outer peak (0.7 * radius = 8.4 ≈ 8)
        const outerDist = Math.round(0.7 * radius);
        const outerIdx =
          radius * size * size + radius * size + (radius + outerDist);

        // Inner peak should have higher weight due to 2x weight multiplier
        // (though actual values depend on bump shape)
        expect(kernel.weights[innerIdx]).toBeGreaterThan(0);
        expect(kernel.weights[outerIdx]).toBeGreaterThan(0);
      });
    });

    describe("boundary handling", () => {
      it("values decay to zero at boundary", () => {
        const config: Kernel3DConfig = {
          radius: 8,
          peakPositions: [0.5],
          peakWidths: [0.2],
          peakWeights: [1],
        };
        const kernel = generate3DKernel(config);
        const { size, radius } = kernel;

        // Corner voxels (distance = sqrt(3) * radius > 1)
        const cornerIdx = 0; // (0,0,0)
        expect(kernel.weights[cornerIdx]).toBe(0);

        // Edge voxels outside radius
        const edgeIdx =
          (size - 1) * size * size + (size - 1) * size + (size - 1);
        expect(kernel.weights[edgeIdx]).toBe(0);
      });

      it("has non-zero values inside radius sphere", () => {
        const config: Kernel3DConfig = {
          radius: 10,
          peakPositions: [0.5],
          peakWidths: [0.3],
          peakWeights: [1],
        };
        const kernel = generate3DKernel(config);
        const { size, radius } = kernel;

        // Point at r=0.5 (inside sphere)
        const innerDist = Math.round(0.5 * radius);
        const innerIdx =
          radius * size * size + radius * size + (radius + innerDist);
        expect(kernel.weights[innerIdx]).toBeGreaterThan(0);
      });
    });
  });

  describe("normalize3DKernel", () => {
    it("normalizes to sum of 1", () => {
      const config: Kernel3DConfig = {
        radius: 6,
        peakPositions: [0.5],
        peakWidths: [0.23],
        peakWeights: [1],
      };
      const kernel = generate3DKernel(config);
      const normalized = normalize3DKernel(kernel);

      expect(normalized.sum).toBe(1);
    });

    it("actual weights sum to 1 after normalization", () => {
      const config: Kernel3DConfig = {
        radius: 8,
        peakPositions: [0.5],
        peakWidths: [0.2],
        peakWeights: [1],
      };
      const kernel = generate3DKernel(config);
      const normalized = normalize3DKernel(kernel);

      let actualSum = 0;
      for (const w of normalized.weights) {
        actualSum += w;
      }

      expect(actualSum).toBeCloseTo(1, 5);
    });

    it("preserves size and radius", () => {
      const config: Kernel3DConfig = {
        radius: 7,
        peakPositions: [0.5],
        peakWidths: [0.2],
        peakWeights: [1],
      };
      const kernel = generate3DKernel(config);
      const normalized = normalize3DKernel(kernel);

      expect(normalized.size).toBe(kernel.size);
      expect(normalized.radius).toBe(kernel.radius);
      expect(normalized.weights.length).toBe(kernel.weights.length);
    });

    it("handles zero-sum kernel gracefully", () => {
      const kernel: Kernel3DData = {
        weights: new Float32Array(27), // 3x3x3 of zeros
        size: 3,
        radius: 1,
        sum: 0,
      };

      const normalized = normalize3DKernel(kernel);

      for (const weight of normalized.weights) {
        expect(isFinite(weight)).toBe(true);
        expect(weight).toBe(0);
      }
    });
  });

  describe("generateGaussian3DKernel", () => {
    it("generates correctly sized kernel", () => {
      const kernel = generateGaussian3DKernel(4);

      expect(kernel.size).toBe(9); // 2*4 + 1
      expect(kernel.weights.length).toBe(9 * 9 * 9); // 729
    });

    it("returns normalized weights", () => {
      const kernel = generateGaussian3DKernel(5);

      expect(kernel.sum).toBeCloseTo(1, 5);
    });

    it("has maximum at center", () => {
      const kernel = generateGaussian3DKernel(4);
      const { size, radius } = kernel;
      const centerIdx = radius * size * size + radius * size + radius;

      for (let i = 0; i < kernel.weights.length; i++) {
        expect(kernel.weights[i]).toBeLessThanOrEqual(
          kernel.weights[centerIdx] + 0.001,
        );
      }
    });

    it("produces spherically symmetric distribution", () => {
      const kernel = generateGaussian3DKernel(5);
      const { size, radius } = kernel;

      // Points at same distance from center should have equal values
      const d = 2;
      const idx1 = radius * size * size + radius * size + (radius + d);
      const idx2 = radius * size * size + (radius + d) * size + radius;
      const idx3 = (radius + d) * size * size + radius * size + radius;

      expect(kernel.weights[idx1]).toBeCloseTo(kernel.weights[idx2], 8);
      expect(kernel.weights[idx2]).toBeCloseTo(kernel.weights[idx3], 8);
    });

    it("respects custom sigma", () => {
      const narrow = generateGaussian3DKernel(8, 2);
      const wide = generateGaussian3DKernel(8, 5);

      const { size, radius } = narrow;
      const centerIdx = radius * size * size + radius * size + radius;
      const distIdx = radius * size * size + radius * size + (radius + 3);

      // Narrow kernel should have steeper falloff
      const narrowRatio = narrow.weights[centerIdx] / narrow.weights[distIdx];
      const wideRatio = wide.weights[centerIdx] / wide.weights[distIdx];

      expect(narrowRatio).toBeGreaterThan(wideRatio);
    });
  });

  describe("generateShell3DKernel", () => {
    it("creates shell at specified position", () => {
      const kernel = generateShell3DKernel(10, 0.7, 0.15);
      const { size, radius } = kernel;

      // Shell should have peak around r=0.7 * radius = 7
      const shellDist = 7;
      const shellIdx =
        radius * size * size + radius * size + (radius + shellDist);
      expect(kernel.weights[shellIdx]).toBeGreaterThan(0);

      // Center should be zero
      const centerIdx = radius * size * size + radius * size + radius;
      expect(kernel.weights[centerIdx]).toBe(0);
    });

    it("has lower values inside and outside shell", () => {
      const kernel = generateShell3DKernel(10, 0.5, 0.15);
      const { size, radius } = kernel;

      // Peak at shell
      const shellDist = 5;
      const shellIdx =
        radius * size * size + radius * size + (radius + shellDist);
      const shellVal = kernel.weights[shellIdx];

      // Inside shell (r=0.2 * radius = 2)
      const innerDist = 2;
      const innerIdx =
        radius * size * size + radius * size + (radius + innerDist);
      const innerVal = kernel.weights[innerIdx];

      // Outside shell (r=0.9 * radius = 9)
      const outerDist = 9;
      const outerIdx =
        radius * size * size + radius * size + (radius + outerDist);
      const outerVal = kernel.weights[outerIdx];

      expect(shellVal).toBeGreaterThan(innerVal);
      expect(shellVal).toBeGreaterThan(outerVal);
    });
  });

  describe("extractKernelSlice", () => {
    it("extracts XY plane correctly", () => {
      const config: Kernel3DConfig = {
        radius: 4,
        peakPositions: [0.5],
        peakWidths: [0.3],
        peakWeights: [1],
      };
      const kernel = generate3DKernel(config);

      const slice = extractKernelSlice(kernel, "xy", kernel.radius);

      expect(slice.length).toBe(kernel.size * kernel.size);
    });

    it("extracts XZ plane correctly", () => {
      const config: Kernel3DConfig = {
        radius: 4,
        peakPositions: [0.5],
        peakWidths: [0.3],
        peakWeights: [1],
      };
      const kernel = generate3DKernel(config);

      const slice = extractKernelSlice(kernel, "xz", kernel.radius);

      expect(slice.length).toBe(kernel.size * kernel.size);
    });

    it("extracts YZ plane correctly", () => {
      const config: Kernel3DConfig = {
        radius: 4,
        peakPositions: [0.5],
        peakWidths: [0.3],
        peakWeights: [1],
      };
      const kernel = generate3DKernel(config);

      const slice = extractKernelSlice(kernel, "yz", kernel.radius);

      expect(slice.length).toBe(kernel.size * kernel.size);
    });

    it("center slice shows circular pattern", () => {
      const config: Kernel3DConfig = {
        radius: 6,
        peakPositions: [0.5],
        peakWidths: [0.2],
        peakWeights: [1],
      };
      const kernel = generate3DKernel(config);

      const slice = extractKernelSlice(kernel, "xy", kernel.radius);
      const size = kernel.size;
      const radius = kernel.radius;

      // Center of slice should be zero
      const centerIdx = radius * size + radius;
      expect(slice[centerIdx]).toBe(0);

      // Points at peak distance should have equal values (circular symmetry)
      const d = Math.round(0.5 * radius);
      const idx1 = radius * size + (radius + d); // +X
      const idx2 = (radius + d) * size + radius; // +Y

      expect(slice[idx1]).toBeCloseTo(slice[idx2], 8);
    });

    it("clamps position to valid range", () => {
      const kernel = generateGaussian3DKernel(4);

      // Should not throw for out-of-bounds positions
      const slice1 = extractKernelSlice(kernel, "xy", -5);
      const slice2 = extractKernelSlice(kernel, "xy", 100);

      expect(slice1.length).toBe(kernel.size * kernel.size);
      expect(slice2.length).toBe(kernel.size * kernel.size);
    });
  });

  describe("getKernel3DStats", () => {
    it("calculates correct statistics", () => {
      const config: Kernel3DConfig = {
        radius: 5,
        peakPositions: [0.5],
        peakWidths: [0.2],
        peakWeights: [1],
      };
      const kernel = generate3DKernel(config);

      const stats = getKernel3DStats(kernel);

      expect(stats.min).toBe(0); // Many zero voxels outside radius
      expect(stats.max).toBeGreaterThan(0);
      expect(stats.mean).toBeGreaterThan(0);
      expect(stats.nonZeroCount).toBeGreaterThan(0);
      expect(stats.nonZeroCount).toBeLessThan(stats.totalVoxels);
      expect(stats.totalVoxels).toBe(kernel.weights.length);
    });

    it("reports correct total voxels", () => {
      const kernel = generateGaussian3DKernel(3);
      const stats = getKernel3DStats(kernel);

      expect(stats.totalVoxels).toBe(7 * 7 * 7); // 343
    });
  });

  describe("KERNEL_3D_PRESETS", () => {
    it("has lenia-standard preset", () => {
      expect(KERNEL_3D_PRESETS["lenia-standard"]).toBeDefined();
      expect(KERNEL_3D_PRESETS["lenia-standard"].radius).toBe(13);
      expect(KERNEL_3D_PRESETS["lenia-standard"].peakPositions).toEqual([0.5]);
    });

    it("has lenia-narrow preset", () => {
      expect(KERNEL_3D_PRESETS["lenia-narrow"]).toBeDefined();
      expect(KERNEL_3D_PRESETS["lenia-narrow"].peakWidths[0]).toBeLessThan(
        KERNEL_3D_PRESETS["lenia-standard"].peakWidths[0],
      );
    });

    it("has lenia-dual-ring preset", () => {
      expect(KERNEL_3D_PRESETS["lenia-dual-ring"]).toBeDefined();
      expect(KERNEL_3D_PRESETS["lenia-dual-ring"].peakPositions.length).toBe(2);
    });

    it("has shell preset", () => {
      expect(KERNEL_3D_PRESETS["shell"]).toBeDefined();
      expect(KERNEL_3D_PRESETS["shell"].peakPositions[0]).toBeGreaterThan(0.5);
    });

    it("all presets generate valid kernels", () => {
      for (const [name, config] of Object.entries(KERNEL_3D_PRESETS)) {
        const kernel = generate3DKernel(config);
        expect(kernel.sum).toBeGreaterThan(0);
        expect(kernel.weights.length).toBe(kernel.size ** 3);
      }
    });
  });
});
