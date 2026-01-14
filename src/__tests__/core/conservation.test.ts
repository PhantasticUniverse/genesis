/**
 * Conservation Pipeline Tests
 * Tests for mass conservation system with double-buffered readback
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createConservationPipeline,
  DEFAULT_CONSERVATION_CONFIG,
  type ConservationConfig,
  type ConservationPipeline,
} from '../../core/conservation';

describe('conservation', () => {
  describe('DEFAULT_CONSERVATION_CONFIG', () => {
    it('has expected default values', () => {
      expect(DEFAULT_CONSERVATION_CONFIG.enabled).toBe(false);
      expect(DEFAULT_CONSERVATION_CONFIG.flowStrength).toBe(0.5);
      expect(DEFAULT_CONSERVATION_CONFIG.diffusion).toBe(0.01);
      expect(DEFAULT_CONSERVATION_CONFIG.useReintegration).toBe(true);
    });

    it('does not have targetMass by default', () => {
      expect(DEFAULT_CONSERVATION_CONFIG.targetMass).toBeUndefined();
    });
  });

  describe('ConservationConfig interface', () => {
    it('allows setting targetMass', () => {
      const config: ConservationConfig = {
        enabled: true,
        targetMass: 1000,
        flowStrength: 0.3,
        diffusion: 0.02,
        useReintegration: false,
      };

      expect(config.targetMass).toBe(1000);
      expect(config.enabled).toBe(true);
    });

    it('allows partial config with spread', () => {
      const config: ConservationConfig = {
        ...DEFAULT_CONSERVATION_CONFIG,
        enabled: true,
      };

      expect(config.enabled).toBe(true);
      expect(config.flowStrength).toBe(0.5);
    });
  });

  describe('createConservationPipeline (mock GPU)', () => {
    let mockDevice: GPUDevice;
    let mockTexture: GPUTexture;
    let mockTextureView: GPUTextureView;
    let mockCommandEncoder: GPUCommandEncoder;
    let mockComputePassEncoder: GPUComputePassEncoder;

    beforeEach(async () => {
      // Get mock device from navigator.gpu
      const adapter = await navigator.gpu.requestAdapter();
      mockDevice = await adapter!.requestDevice();

      // Create mock texture view
      mockTextureView = {} as GPUTextureView;

      // Create mock texture
      mockTexture = {
        createView: () => mockTextureView,
        destroy: () => {},
      } as unknown as GPUTexture;

      // Create mock compute pass encoder
      mockComputePassEncoder = {
        setPipeline: () => {},
        setBindGroup: () => {},
        dispatchWorkgroups: () => {},
        end: () => {},
      } as unknown as GPUComputePassEncoder;

      // Create mock command encoder
      mockCommandEncoder = {
        beginComputePass: () => mockComputePassEncoder,
        copyBufferToBuffer: () => {},
        finish: () => ({} as GPUCommandBuffer),
      } as unknown as GPUCommandEncoder;
    });

    it('creates pipeline with default config', () => {
      const pipeline = createConservationPipeline(mockDevice, 128, 128);

      expect(pipeline).toBeDefined();
      expect(pipeline.computeMass).toBeDefined();
      expect(pipeline.getMass).toBeDefined();
      expect(pipeline.getCachedMass).toBeDefined();
      expect(pipeline.syncMass).toBeDefined();
      expect(pipeline.computeAndNormalize).toBeDefined();
      expect(pipeline.normalizeMass).toBeDefined();
      expect(pipeline.flowUpdate).toBeDefined();
      expect(pipeline.setConfig).toBeDefined();
      expect(pipeline.getConfig).toBeDefined();
      expect(pipeline.setTargetMass).toBeDefined();
      expect(pipeline.getTargetMass).toBeDefined();
      expect(pipeline.destroy).toBeDefined();

      pipeline.destroy();
    });

    it('creates pipeline with custom config', () => {
      const config: ConservationConfig = {
        enabled: true,
        targetMass: 500,
        flowStrength: 0.7,
        diffusion: 0.05,
        useReintegration: false,
      };

      const pipeline = createConservationPipeline(mockDevice, 64, 64, config);
      const returnedConfig = pipeline.getConfig();

      expect(returnedConfig.enabled).toBe(true);
      expect(returnedConfig.flowStrength).toBe(0.7);
      expect(returnedConfig.diffusion).toBe(0.05);
      expect(returnedConfig.useReintegration).toBe(false);

      pipeline.destroy();
    });

    it('setConfig updates configuration', () => {
      const pipeline = createConservationPipeline(mockDevice, 128, 128);

      pipeline.setConfig({ enabled: true, flowStrength: 0.8 });
      const config = pipeline.getConfig();

      expect(config.enabled).toBe(true);
      expect(config.flowStrength).toBe(0.8);
      // Other values should remain default
      expect(config.diffusion).toBe(0.01);

      pipeline.destroy();
    });

    it('setTargetMass and getTargetMass work correctly', () => {
      const pipeline = createConservationPipeline(mockDevice, 128, 128);

      // Initially null (not set from config)
      expect(pipeline.getTargetMass()).toBeNull();

      // Set target mass
      pipeline.setTargetMass(1500);
      expect(pipeline.getTargetMass()).toBe(1500);

      // Can update target mass
      pipeline.setTargetMass(2000);
      expect(pipeline.getTargetMass()).toBe(2000);

      pipeline.destroy();
    });

    it('getCachedMass returns 0 initially', () => {
      const pipeline = createConservationPipeline(mockDevice, 128, 128);

      expect(pipeline.getCachedMass()).toBe(0);

      pipeline.destroy();
    });

    it('getMass returns cached value when no computation pending', async () => {
      const pipeline = createConservationPipeline(mockDevice, 128, 128);

      const mass = await pipeline.getMass();
      expect(mass).toBe(0);

      pipeline.destroy();
    });

    it('destroy cleans up resources', () => {
      const pipeline = createConservationPipeline(mockDevice, 128, 128);

      // Should not throw
      expect(() => pipeline.destroy()).not.toThrow();
    });

    it('respects targetMass from initial config', () => {
      const config: ConservationConfig = {
        enabled: true,
        targetMass: 999,
        flowStrength: 0.5,
        diffusion: 0.01,
        useReintegration: true,
      };

      const pipeline = createConservationPipeline(mockDevice, 128, 128, config);

      expect(pipeline.getTargetMass()).toBe(999);

      pipeline.destroy();
    });
  });
});
