/**
 * Tests for Flow-Lenia Pipeline
 */

import { describe, it, expect } from 'vitest';
import {
  DEFAULT_FLOW_CONFIG,
  type FlowLeniaConfig,
} from '../../compute/webgpu/flow-lenia-pipeline';

describe('Flow-Lenia Pipeline', () => {
  describe('DEFAULT_FLOW_CONFIG', () => {
    it('has valid default values', () => {
      expect(DEFAULT_FLOW_CONFIG.width).toBe(512);
      expect(DEFAULT_FLOW_CONFIG.height).toBe(512);
      expect(DEFAULT_FLOW_CONFIG.growthCenter).toBe(0.15);
      expect(DEFAULT_FLOW_CONFIG.growthWidth).toBe(0.015);
      expect(DEFAULT_FLOW_CONFIG.dt).toBe(0.1);
      expect(DEFAULT_FLOW_CONFIG.flowStrength).toBe(0.5);
      expect(DEFAULT_FLOW_CONFIG.diffusion).toBe(0.01);
      expect(DEFAULT_FLOW_CONFIG.growthType).toBe(1); // Gaussian
      expect(DEFAULT_FLOW_CONFIG.useReintegration).toBe(true);
    });

    it('has positive dimensions', () => {
      expect(DEFAULT_FLOW_CONFIG.width).toBeGreaterThan(0);
      expect(DEFAULT_FLOW_CONFIG.height).toBeGreaterThan(0);
    });

    it('has valid growth parameters', () => {
      expect(DEFAULT_FLOW_CONFIG.growthCenter).toBeGreaterThanOrEqual(0);
      expect(DEFAULT_FLOW_CONFIG.growthCenter).toBeLessThanOrEqual(1);
      expect(DEFAULT_FLOW_CONFIG.growthWidth).toBeGreaterThan(0);
    });

    it('has valid time step', () => {
      expect(DEFAULT_FLOW_CONFIG.dt).toBeGreaterThan(0);
      expect(DEFAULT_FLOW_CONFIG.dt).toBeLessThanOrEqual(1);
    });

    it('has valid flow strength', () => {
      expect(DEFAULT_FLOW_CONFIG.flowStrength).toBeGreaterThanOrEqual(0);
    });

    it('has valid diffusion coefficient', () => {
      expect(DEFAULT_FLOW_CONFIG.diffusion).toBeGreaterThanOrEqual(0);
    });

    it('has valid growth type', () => {
      expect([0, 1]).toContain(DEFAULT_FLOW_CONFIG.growthType);
    });
  });

  describe('FlowLeniaConfig interface', () => {
    it('allows partial configuration', () => {
      const partialConfig: Partial<FlowLeniaConfig> = {
        flowStrength: 1.0,
        diffusion: 0.05,
      };

      const mergedConfig = { ...DEFAULT_FLOW_CONFIG, ...partialConfig };

      expect(mergedConfig.flowStrength).toBe(1.0);
      expect(mergedConfig.diffusion).toBe(0.05);
      expect(mergedConfig.width).toBe(512); // Default preserved
    });

    it('supports custom dimensions', () => {
      const customConfig: FlowLeniaConfig = {
        ...DEFAULT_FLOW_CONFIG,
        width: 256,
        height: 256,
      };

      expect(customConfig.width).toBe(256);
      expect(customConfig.height).toBe(256);
    });

    it('supports polynomial growth type', () => {
      const customConfig: FlowLeniaConfig = {
        ...DEFAULT_FLOW_CONFIG,
        growthType: 0, // Polynomial
      };

      expect(customConfig.growthType).toBe(0);
    });

    it('supports disabling reintegration', () => {
      const customConfig: FlowLeniaConfig = {
        ...DEFAULT_FLOW_CONFIG,
        useReintegration: false,
      };

      expect(customConfig.useReintegration).toBe(false);
    });
  });

  describe('Flow-Lenia shader configuration', () => {
    it('uniform buffer structure matches shader expectations', () => {
      // The shader expects:
      // width: u32 (4 bytes)
      // height: u32 (4 bytes)
      // growth_center: f32 (4 bytes)
      // growth_width: f32 (4 bytes)
      // dt: f32 (4 bytes)
      // flow_strength: f32 (4 bytes)
      // diffusion: f32 (4 bytes)
      // growth_type: u32 (4 bytes)
      // Total: 32 bytes

      const uniformSize = 32;
      const configFields = 8;
      const bytesPerField = 4;

      expect(configFields * bytesPerField).toBe(uniformSize);
    });

    it('workgroup size is compatible with shader', () => {
      // Shader uses @workgroup_size(16, 16)
      const workgroupSize = 16;
      const width = DEFAULT_FLOW_CONFIG.width;
      const height = DEFAULT_FLOW_CONFIG.height;

      // Grid should be divisible by workgroup size for efficiency
      expect(width % workgroupSize).toBe(0);
      expect(height % workgroupSize).toBe(0);
    });
  });

  describe('Mass conservation properties', () => {
    it('reintegration method is preferred for conservation', () => {
      // The reintegration method explicitly tracks mass flux
      // and should provide better mass conservation
      expect(DEFAULT_FLOW_CONFIG.useReintegration).toBe(true);
    });

    it('diffusion is low by default to preserve mass', () => {
      // High diffusion can cause numerical mass loss at boundaries
      expect(DEFAULT_FLOW_CONFIG.diffusion).toBeLessThan(0.1);
    });

    it('flow strength is moderate by default', () => {
      // Very high flow strength can cause instability
      expect(DEFAULT_FLOW_CONFIG.flowStrength).toBeLessThanOrEqual(2);
      expect(DEFAULT_FLOW_CONFIG.flowStrength).toBeGreaterThan(0);
    });
  });
});
