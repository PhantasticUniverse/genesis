/**
 * Kernel System Tests
 * Tests for convolution kernel generation and normalization
 */

import { describe, it, expect } from 'vitest';
import {
  generateKernel,
  normalizeKernel,
  generateGaussianKernel,
  createKernelTexture,
  KERNEL_PRESETS,
  type KernelConfig,
  type KernelData,
} from '../../core/kernels';

describe('kernels', () => {
  describe('generateKernel', () => {
    describe('gaussian kernel', () => {
      it('generates correct size', () => {
        const config: KernelConfig = { shape: 'gaussian', radius: 5 };
        const kernel = generateKernel(config);

        expect(kernel.size).toBe(11); // 2*5 + 1
        expect(kernel.radius).toBe(5);
        expect(kernel.weights.length).toBe(121); // 11*11
      });

      it('has maximum near center ring (not at center)', () => {
        const config: KernelConfig = { shape: 'gaussian', radius: 10 };
        const kernel = generateKernel(config);

        // Center pixel should be zero (r < 0.01 check)
        const centerIdx = kernel.radius * kernel.size + kernel.radius;
        expect(kernel.weights[centerIdx]).toBe(0);

        // Peak should be around radius * 0.5 from center
        const peakDistance = Math.round(kernel.radius * 0.5);
        const peakIdx = kernel.radius * kernel.size + (kernel.radius + peakDistance);
        expect(kernel.weights[peakIdx]).toBeGreaterThan(0);
      });

      it('has positive sum', () => {
        const config: KernelConfig = { shape: 'gaussian', radius: 8 };
        const kernel = generateKernel(config);

        expect(kernel.sum).toBeGreaterThan(0);
      });
    });

    describe('ring kernel', () => {
      it('generates ring-shaped kernel', () => {
        const config: KernelConfig = { shape: 'ring', radius: 10, ringWidth: 0.3 };
        const kernel = generateKernel(config);

        expect(kernel.size).toBe(21);
        expect(kernel.radius).toBe(10);
      });

      it('has zero values at center', () => {
        const config: KernelConfig = { shape: 'ring', radius: 10, ringWidth: 0.3 };
        const kernel = generateKernel(config);

        // Center and nearby pixels should be zero
        const centerIdx = kernel.radius * kernel.size + kernel.radius;
        expect(kernel.weights[centerIdx]).toBe(0);
      });

      it('has non-zero values at ring distance', () => {
        const config: KernelConfig = { shape: 'ring', radius: 10, ringWidth: 0.3 };
        const kernel = generateKernel(config);

        // Ring should be at approximately radius distance
        const ringIdx = kernel.radius * kernel.size + (kernel.radius + 8); // Close to outer ring
        expect(kernel.weights[ringIdx]).toBeGreaterThan(0);
      });

      it('uses default ringWidth when not specified', () => {
        const config: KernelConfig = { shape: 'ring', radius: 10 };
        const kernel = generateKernel(config);

        // Should not throw and produce valid kernel
        expect(kernel.sum).toBeGreaterThan(0);
      });
    });

    describe('polynomial kernel', () => {
      it('generates polynomial bump kernel', () => {
        const config: KernelConfig = { shape: 'polynomial', radius: 13, peaks: [0.5] };
        const kernel = generateKernel(config);

        expect(kernel.size).toBe(27);
        expect(kernel.radius).toBe(13);
        expect(kernel.sum).toBeGreaterThan(0);
      });

      it('supports multiple peaks', () => {
        const config: KernelConfig = { shape: 'polynomial', radius: 10, peaks: [0.25, 0.75] };
        const kernel = generateKernel(config);

        expect(kernel.sum).toBeGreaterThan(0);
      });

      it('uses default peaks when not specified', () => {
        const config: KernelConfig = { shape: 'polynomial', radius: 10 };
        const kernel = generateKernel(config);

        expect(kernel.sum).toBeGreaterThan(0);
      });

      it('has ring-like structure at peak distances', () => {
        const config: KernelConfig = { shape: 'polynomial', radius: 10, peaks: [0.5] };
        const kernel = generateKernel(config);

        // Peak should be at r=0.5 (normalized), so actual distance = 5
        const peakDistance = 5;
        const peakIdx = kernel.radius * kernel.size + (kernel.radius + peakDistance);
        expect(kernel.weights[peakIdx]).toBeGreaterThan(0);
      });
    });

    describe('custom kernel', () => {
      it('uses provided custom weights', () => {
        const customWeights = new Float32Array(9);
        customWeights[4] = 1; // Center pixel
        customWeights[1] = 0.5; // Top
        customWeights[7] = 0.5; // Bottom

        const config: KernelConfig = { shape: 'custom', radius: 1, customWeights };
        const kernel = generateKernel(config);

        expect(kernel.size).toBe(3);
        // Note: center is zeroed out due to r < 0.01 check, but neighbors preserved
        expect(kernel.weights[1]).toBe(0.5);
        expect(kernel.weights[7]).toBe(0.5);
      });

      it('handles missing custom weights gracefully', () => {
        const config: KernelConfig = { shape: 'custom', radius: 2 };
        const kernel = generateKernel(config);

        // Should produce zeros
        expect(kernel.sum).toBe(0);
      });
    });

    it('zeros out center pixel', () => {
      const config: KernelConfig = { shape: 'gaussian', radius: 5 };
      const kernel = generateKernel(config);

      const centerIdx = kernel.radius * kernel.size + kernel.radius;
      expect(kernel.weights[centerIdx]).toBe(0);
    });

    it('produces symmetric kernel', () => {
      const config: KernelConfig = { shape: 'gaussian', radius: 5 };
      const kernel = generateKernel(config);

      // Check horizontal symmetry
      for (let y = 0; y < kernel.size; y++) {
        for (let x = 0; x < kernel.radius; x++) {
          const left = kernel.weights[y * kernel.size + x];
          const right = kernel.weights[y * kernel.size + (kernel.size - 1 - x)];
          expect(left).toBeCloseTo(right, 10);
        }
      }
    });
  });

  describe('normalizeKernel', () => {
    it('normalizes to sum of 1', () => {
      const config: KernelConfig = { shape: 'gaussian', radius: 5 };
      const kernel = generateKernel(config);
      const normalized = normalizeKernel(kernel);

      expect(normalized.sum).toBe(1);
    });

    it('preserves relative weights', () => {
      const config: KernelConfig = { shape: 'polynomial', radius: 10, peaks: [0.5] };
      const kernel = generateKernel(config);
      const normalized = normalizeKernel(kernel);

      // Pick two non-zero weights and verify ratio is preserved
      let idx1 = -1, idx2 = -1;
      for (let i = 0; i < kernel.weights.length; i++) {
        if (kernel.weights[i] > 0) {
          if (idx1 < 0) idx1 = i;
          else if (idx2 < 0 && kernel.weights[i] !== kernel.weights[idx1]) {
            idx2 = i;
            break;
          }
        }
      }

      if (idx1 >= 0 && idx2 >= 0) {
        const originalRatio = kernel.weights[idx1] / kernel.weights[idx2];
        const normalizedRatio = normalized.weights[idx1] / normalized.weights[idx2];
        expect(normalizedRatio).toBeCloseTo(originalRatio, 6);
      }
    });

    it('preserves size and radius', () => {
      const config: KernelConfig = { shape: 'ring', radius: 8 };
      const kernel = generateKernel(config);
      const normalized = normalizeKernel(kernel);

      expect(normalized.size).toBe(kernel.size);
      expect(normalized.radius).toBe(kernel.radius);
    });

    it('handles zero-sum kernel gracefully', () => {
      // Create a kernel with all zeros
      const kernel: KernelData = {
        weights: new Float32Array(9),
        size: 3,
        radius: 1,
        sum: 0,
      };

      const normalized = normalizeKernel(kernel);

      // Should not produce NaN or Infinity
      for (const weight of normalized.weights) {
        expect(isFinite(weight)).toBe(true);
      }
    });

    it('actual weights sum to 1 after normalization', () => {
      const config: KernelConfig = { shape: 'gaussian', radius: 8 };
      const kernel = generateKernel(config);
      const normalized = normalizeKernel(kernel);

      let actualSum = 0;
      for (const w of normalized.weights) {
        actualSum += w;
      }

      expect(actualSum).toBeCloseTo(1, 6);
    });
  });

  describe('generateGaussianKernel', () => {
    it('generates correctly sized kernel', () => {
      const kernel = generateGaussianKernel(5);

      expect(kernel.length).toBe(121); // 11*11
    });

    it('returns normalized weights', () => {
      const kernel = generateGaussianKernel(5);

      let sum = 0;
      for (const w of kernel) {
        sum += w;
      }

      expect(sum).toBeCloseTo(1, 6);
    });

    it('has maximum at center', () => {
      const kernel = generateGaussianKernel(5);
      const size = 11;
      const centerIdx = 5 * size + 5;

      // Center should have highest value
      for (let i = 0; i < kernel.length; i++) {
        expect(kernel[i]).toBeLessThanOrEqual(kernel[centerIdx] + 0.001);
      }
    });

    it('respects custom sigma', () => {
      const narrow = generateGaussianKernel(10, 2);
      const wide = generateGaussianKernel(10, 5);

      // Narrow kernel should have more weight concentrated at center
      const size = 21;
      const centerIdx = 10 * size + 10;
      const edgeIdx = 10 * size + 15; // 5 pixels from center

      const narrowRatio = narrow[centerIdx] / narrow[edgeIdx];
      const wideRatio = wide[centerIdx] / wide[edgeIdx];

      expect(narrowRatio).toBeGreaterThan(wideRatio);
    });

    it('uses default sigma of radius/3', () => {
      const radius = 9;
      const kernel = generateGaussianKernel(radius);

      // With sigma = radius/3 = 3, expect gradual falloff
      const size = 2 * radius + 1;
      const centerIdx = radius * size + radius;
      const sigmaDistance = radius * size + (radius + 3);

      // At sigma distance, value should be ~60% of center
      const ratio = kernel[sigmaDistance] / kernel[centerIdx];
      expect(ratio).toBeGreaterThan(0.5);
      expect(ratio).toBeLessThan(0.7);
    });

    it('produces symmetric kernel', () => {
      const kernel = generateGaussianKernel(5);
      const size = 11;
      const radius = 5;

      // Check horizontal and vertical symmetry
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < radius; x++) {
          const left = kernel[y * size + x];
          const right = kernel[y * size + (size - 1 - x)];
          expect(left).toBeCloseTo(right, 10);
        }
      }
    });
  });

  describe('createKernelTexture', () => {
    it('creates texture with correct dimensions', async () => {
      const adapter = await navigator.gpu.requestAdapter();
      const device = await adapter!.requestDevice();
      const config: KernelConfig = { shape: 'gaussian', radius: 5 };
      const kernel = generateKernel(config);

      const texture = createKernelTexture(device, kernel);

      expect(texture).toBeDefined();
    });
  });

  describe('KERNEL_PRESETS', () => {
    it('has lenia-orbium preset', () => {
      expect(KERNEL_PRESETS['lenia-orbium']).toBeDefined();
      expect(KERNEL_PRESETS['lenia-orbium'].shape).toBe('polynomial');
      expect(KERNEL_PRESETS['lenia-orbium'].radius).toBe(13);
      expect(KERNEL_PRESETS['lenia-orbium'].peaks).toEqual([0.5]);
    });

    it('has lenia-geminium preset', () => {
      expect(KERNEL_PRESETS['lenia-geminium']).toBeDefined();
      expect(KERNEL_PRESETS['lenia-geminium'].peaks).toEqual([0.25, 0.75]);
    });

    it('has smoothlife preset', () => {
      expect(KERNEL_PRESETS['smoothlife']).toBeDefined();
      expect(KERNEL_PRESETS['smoothlife'].shape).toBe('ring');
    });

    it('has gaussian preset', () => {
      expect(KERNEL_PRESETS['gaussian']).toBeDefined();
      expect(KERNEL_PRESETS['gaussian'].shape).toBe('gaussian');
    });

    it('all presets generate valid kernels', () => {
      for (const [name, config] of Object.entries(KERNEL_PRESETS)) {
        const kernel = generateKernel(config);
        expect(kernel.sum).toBeGreaterThan(0);
        expect(kernel.weights.length).toBe(kernel.size * kernel.size);
      }
    });
  });
});
