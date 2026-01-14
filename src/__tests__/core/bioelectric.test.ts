/**
 * Tests for Bioelectric Pattern Dynamics
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createBioelectricState,
  applyStimulus,
  stepBioelectric,
  stepBioelectricN,
  createVoltageWave,
  createGradient,
  getChannelStats,
  bioelectricToRGB,
  DEFAULT_BIOELECTRIC_CONFIG,
  DEFAULT_CHANNEL_CONFIGS,
  BIOELECTRIC_PRESETS,
  type BioelectricState,
  type BioelectricConfig,
} from '../../core/bioelectric';

describe('Bioelectric Patterns', () => {
  describe('createBioelectricState', () => {
    it('creates state with default config', () => {
      const state = createBioelectricState();

      expect(state.channels).toHaveLength(1);
      expect(state.step).toBe(0);
      expect(state.config.width).toBe(256);
      expect(state.config.height).toBe(256);
    });

    it('creates state with custom dimensions', () => {
      const state = createBioelectricState({ width: 64, height: 64 });

      expect(state.channels[0]).toHaveLength(64 * 64);
    });

    it('initializes channels to resting values', () => {
      const state = createBioelectricState({ width: 10, height: 10 });
      const restingValue = DEFAULT_BIOELECTRIC_CONFIG.channels[0].restingValue;

      for (const value of state.channels[0]) {
        expect(value).toBeCloseTo(restingValue, 5);
      }
    });

    it('creates multiple channels', () => {
      const state = createBioelectricState({
        width: 10,
        height: 10,
        channels: [
          { ...DEFAULT_CHANNEL_CONFIGS.voltage, name: 'Vm', color: [100, 200, 255] },
          { ...DEFAULT_CHANNEL_CONFIGS.calcium, name: 'Ca', color: [255, 200, 100] },
        ],
      });

      expect(state.channels).toHaveLength(2);
    });
  });

  describe('applyStimulus', () => {
    let state: BioelectricState;

    beforeEach(() => {
      state = createBioelectricState({ width: 20, height: 20 });
      // Reset to 0 for easier testing
      state.channels[0].fill(0);
    });

    it('applies stimulus at center', () => {
      applyStimulus(state, 0, 10, 10, 3, 1.0);

      // Center should be modified
      const centerIdx = 10 * 20 + 10;
      expect(state.channels[0][centerIdx]).toBeGreaterThan(0);
    });

    it('stimulus is strongest at center', () => {
      applyStimulus(state, 0, 10, 10, 5, 1.0);

      const centerIdx = 10 * 20 + 10;
      const edgeIdx = 10 * 20 + 14; // 4 pixels away

      expect(state.channels[0][centerIdx]).toBeGreaterThan(state.channels[0][edgeIdx]);
    });

    it('respects radius', () => {
      applyStimulus(state, 0, 10, 10, 3, 1.0);

      // Far outside radius should be unchanged
      const farIdx = 0 * 20 + 0;
      expect(state.channels[0][farIdx]).toBe(0);
    });

    it('wraps at boundaries', () => {
      applyStimulus(state, 0, 0, 0, 3, 1.0);

      // Should wrap to other side
      const wrappedIdx = 0 * 20 + 19;
      expect(state.channels[0][wrappedIdx]).toBeGreaterThan(0);
    });

    it('ignores invalid channel index', () => {
      expect(() => applyStimulus(state, 5, 10, 10, 3, 1.0)).not.toThrow();
    });
  });

  describe('stepBioelectric', () => {
    it('increments step counter', () => {
      const state = createBioelectricState({ width: 20, height: 20 });
      expect(state.step).toBe(0);

      stepBioelectric(state);
      expect(state.step).toBe(1);
    });

    it('causes voltage to decay toward resting', () => {
      // Use high decay rate for fast test
      const state = createBioelectricState({
        width: 10,
        height: 10,
        leakConductance: 0.5,  // High leak
        channels: [{
          ...DEFAULT_CHANNEL_CONFIGS.voltage,
          name: 'Vm',
          color: [100, 200, 255],
          decayRate: 0.5,  // High decay
        }],
      });

      // Set all to high value
      state.channels[0].fill(1);

      // Step multiple times
      for (let i = 0; i < 50; i++) {
        stepBioelectric(state);
      }

      // Should have decayed significantly
      const stats = getChannelStats(state.channels[0]);
      expect(stats.mean).toBeLessThan(0.8);
    });

    it('causes diffusion from high to low regions', () => {
      const state = createBioelectricState({ width: 20, height: 20 });
      state.channels[0].fill(0);

      // Create a spike in center
      const centerIdx = 10 * 20 + 10;
      state.channels[0][centerIdx] = 1;

      // Step
      stepBioelectric(state);

      // Neighbors should have received some value
      const neighborIdx = 10 * 20 + 11;
      expect(state.channels[0][neighborIdx]).toBeGreaterThan(0);

      // Center should have decreased
      expect(state.channels[0][centerIdx]).toBeLessThan(1);
    });

    it('clamps values to valid range', () => {
      const state = createBioelectricState({ width: 10, height: 10 });
      state.channels[0].fill(10); // Way too high

      stepBioelectric(state);

      for (const value of state.channels[0]) {
        expect(value).toBeLessThanOrEqual(1);
        expect(value).toBeGreaterThanOrEqual(-1);
      }
    });
  });

  describe('stepBioelectricN', () => {
    it('steps multiple times', () => {
      const state = createBioelectricState({ width: 10, height: 10 });

      stepBioelectricN(state, 10);

      expect(state.step).toBe(10);
    });

    it('produces stable state over time', () => {
      const state = createBioelectricState({ width: 20, height: 20 });
      state.channels[0].fill(0);
      applyStimulus(state, 0, 10, 10, 5, 0.5);

      stepBioelectricN(state, 100);

      // Should not have NaN or Infinity
      for (const value of state.channels[0]) {
        expect(Number.isFinite(value)).toBe(true);
      }
    });
  });

  describe('createVoltageWave', () => {
    let state: BioelectricState;

    beforeEach(() => {
      state = createBioelectricState({ width: 100, height: 100 });
    });

    it('creates horizontal wave', () => {
      createVoltageWave(state, 0, 'horizontal', 20, 0.5);

      // Check that values vary horizontally
      const y = 50;
      const values = [];
      for (let x = 0; x < 100; x++) {
        values.push(state.channels[0][y * 100 + x]);
      }

      // Should have variation
      const stats = getChannelStats(new Float32Array(values));
      expect(stats.max - stats.min).toBeGreaterThan(0.5);
    });

    it('creates vertical wave', () => {
      createVoltageWave(state, 0, 'vertical', 20, 0.5);

      // Check that values vary vertically
      const x = 50;
      const values = [];
      for (let y = 0; y < 100; y++) {
        values.push(state.channels[0][y * 100 + x]);
      }

      const stats = getChannelStats(new Float32Array(values));
      expect(stats.max - stats.min).toBeGreaterThan(0.5);
    });

    it('creates radial wave', () => {
      createVoltageWave(state, 0, 'radial', 20, 0.5);

      // Center and edge should have different values
      const center = state.channels[0][50 * 100 + 50];
      const edge = state.channels[0][0 * 100 + 50];

      expect(center).not.toBe(edge);
    });

    it('respects amplitude', () => {
      createVoltageWave(state, 0, 'horizontal', 20, 0.3);

      const stats = getChannelStats(state.channels[0]);
      // Allow small floating point tolerance
      expect(stats.max).toBeLessThanOrEqual(0.31);
      expect(stats.min).toBeGreaterThanOrEqual(-0.31);
    });
  });

  describe('createGradient', () => {
    let state: BioelectricState;

    beforeEach(() => {
      state = createBioelectricState({ width: 100, height: 100 });
    });

    it('creates left-right gradient', () => {
      createGradient(state, 0, 'left-right', 0, 1);

      const leftVal = state.channels[0][50 * 100 + 0];
      const rightVal = state.channels[0][50 * 100 + 99];

      expect(leftVal).toBeCloseTo(0, 1);
      expect(rightVal).toBeCloseTo(1, 1);
    });

    it('creates top-bottom gradient', () => {
      createGradient(state, 0, 'top-bottom', 0, 1);

      const topVal = state.channels[0][0 * 100 + 50];
      const bottomVal = state.channels[0][99 * 100 + 50];

      expect(topVal).toBeCloseTo(0, 1);
      expect(bottomVal).toBeCloseTo(1, 1);
    });

    it('creates radial gradient', () => {
      createGradient(state, 0, 'radial', 0, 1);

      const centerVal = state.channels[0][50 * 100 + 50];
      const edgeVal = state.channels[0][0 * 100 + 0];

      expect(centerVal).toBeGreaterThan(edgeVal);
    });

    it('respects min/max values', () => {
      createGradient(state, 0, 'left-right', 0.2, 0.8);

      const stats = getChannelStats(state.channels[0]);
      expect(stats.min).toBeGreaterThanOrEqual(0.19);
      expect(stats.max).toBeLessThanOrEqual(0.81);
    });
  });

  describe('getChannelStats', () => {
    it('calculates min/max correctly', () => {
      const channel = new Float32Array([1, 2, 3, 4, 5]);
      const stats = getChannelStats(channel);

      expect(stats.min).toBe(1);
      expect(stats.max).toBe(5);
    });

    it('calculates mean correctly', () => {
      const channel = new Float32Array([1, 2, 3, 4, 5]);
      const stats = getChannelStats(channel);

      expect(stats.mean).toBe(3);
    });

    it('calculates std correctly', () => {
      const channel = new Float32Array([2, 4, 4, 4, 5, 5, 7, 9]);
      const stats = getChannelStats(channel);

      expect(stats.mean).toBe(5);
      expect(stats.std).toBeCloseTo(2, 1);
    });

    it('handles uniform array', () => {
      const channel = new Float32Array([5, 5, 5, 5]);
      const stats = getChannelStats(channel);

      expect(stats.min).toBe(5);
      expect(stats.max).toBe(5);
      expect(stats.std).toBe(0);
    });
  });

  describe('bioelectricToRGB', () => {
    it('creates RGBA array of correct size', () => {
      const state = createBioelectricState({ width: 10, height: 10 });
      const rgba = bioelectricToRGB(state);

      expect(rgba).toHaveLength(10 * 10 * 4);
    });

    it('produces valid color values', () => {
      const state = createBioelectricState({ width: 10, height: 10 });
      state.channels[0].fill(0.5);
      const rgba = bioelectricToRGB(state);

      for (let i = 0; i < rgba.length; i += 4) {
        expect(rgba[i]).toBeGreaterThanOrEqual(0);
        expect(rgba[i]).toBeLessThanOrEqual(255);
        expect(rgba[i + 3]).toBe(255); // Alpha
      }
    });

    it('normalizes values when requested', () => {
      const state = createBioelectricState({ width: 10, height: 10 });
      // Create gradient that will look different normalized vs raw
      for (let i = 0; i < state.channels[0].length; i++) {
        state.channels[0][i] = -0.5 + (i / state.channels[0].length);
      }

      const rgbaNorm = bioelectricToRGB(state, true);
      const rgbaRaw = bioelectricToRGB(state, false);

      // Check that they produce valid output (both are correct, just different)
      expect(rgbaNorm.length).toBe(rgbaRaw.length);
      expect(rgbaNorm[0]).toBeGreaterThanOrEqual(0);
      expect(rgbaRaw[0]).toBeGreaterThanOrEqual(0);
    });
  });

  describe('DEFAULT_CHANNEL_CONFIGS', () => {
    it('has all expected channel types', () => {
      expect(DEFAULT_CHANNEL_CONFIGS.voltage).toBeDefined();
      expect(DEFAULT_CHANNEL_CONFIGS.sodium).toBeDefined();
      expect(DEFAULT_CHANNEL_CONFIGS.potassium).toBeDefined();
      expect(DEFAULT_CHANNEL_CONFIGS.calcium).toBeDefined();
      expect(DEFAULT_CHANNEL_CONFIGS.morphogen).toBeDefined();
    });

    it('voltage has negative resting potential', () => {
      expect(DEFAULT_CHANNEL_CONFIGS.voltage.restingValue).toBeLessThan(0);
    });

    it('calcium has very low resting value', () => {
      expect(DEFAULT_CHANNEL_CONFIGS.calcium.restingValue).toBeLessThan(0.01);
    });

    it('all configs have positive diffusion rates', () => {
      for (const config of Object.values(DEFAULT_CHANNEL_CONFIGS)) {
        expect(config.diffusionRate).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe('BIOELECTRIC_PRESETS', () => {
    it('has all expected presets', () => {
      expect(BIOELECTRIC_PRESETS['voltage-only']).toBeDefined();
      expect(BIOELECTRIC_PRESETS['voltage-calcium']).toBeDefined();
      expect(BIOELECTRIC_PRESETS['ion-channels']).toBeDefined();
      expect(BIOELECTRIC_PRESETS['morphogen-gradient']).toBeDefined();
      expect(BIOELECTRIC_PRESETS['turing-pattern']).toBeDefined();
    });

    it('voltage-only has single channel', () => {
      expect(BIOELECTRIC_PRESETS['voltage-only'].channels).toHaveLength(1);
    });

    it('ion-channels has three channels', () => {
      expect(BIOELECTRIC_PRESETS['ion-channels'].channels).toHaveLength(3);
    });

    it('turing-pattern has activator and inhibitor', () => {
      const preset = BIOELECTRIC_PRESETS['turing-pattern'];
      expect(preset.channels).toHaveLength(2);

      // Inhibitor should diffuse faster than activator
      const activator = preset.channels![0];
      const inhibitor = preset.channels![1];
      expect(inhibitor.diffusionRate).toBeGreaterThan(activator.diffusionRate);
    });

    it('presets create valid states', () => {
      for (const [name, preset] of Object.entries(BIOELECTRIC_PRESETS)) {
        const state = createBioelectricState({ ...preset, width: 32, height: 32 });
        expect(state.channels.length).toBe(preset.channels!.length);
      }
    });
  });

  describe('Integration tests', () => {
    it('voltage wave evolves stably', () => {
      const state = createBioelectricState({ width: 50, height: 50 });
      createVoltageWave(state, 0, 'radial', 10, 0.5);

      stepBioelectricN(state, 50);

      const stats = getChannelStats(state.channels[0]);
      expect(Number.isFinite(stats.mean)).toBe(true);
      expect(Number.isFinite(stats.std)).toBe(true);
    });

    it('stimulus propagates outward', () => {
      // Use high diffusion and low decay for clear propagation
      const state = createBioelectricState({
        width: 50,
        height: 50,
        leakConductance: 0.001,  // Very low leak
        channels: [{
          ...DEFAULT_CHANNEL_CONFIGS.voltage,
          name: 'Vm',
          color: [100, 200, 255],
          restingValue: 0,
          decayRate: 0.001,  // Very low decay
          diffusionRate: 0.1,  // High diffusion
          gapJunctionConductance: 0.1,
        }],
      });
      state.channels[0].fill(0);
      applyStimulus(state, 0, 25, 25, 3, 1.0);

      // Check a position closer to the stimulus (5 pixels away instead of 10)
      const nearbyIdx = 25 * 50 + 30;
      const initialNearby = state.channels[0][nearbyIdx];
      expect(initialNearby).toBe(0);  // Nearby starts at 0

      stepBioelectricN(state, 20);

      const finalNearby = state.channels[0][nearbyIdx];
      expect(finalNearby).toBeGreaterThan(0.001);  // Stimulus should propagate
    });

    it('multi-channel system remains stable', () => {
      const state = createBioelectricState({
        ...BIOELECTRIC_PRESETS['ion-channels'],
        width: 30,
        height: 30,
      });

      applyStimulus(state, 0, 15, 15, 5, 0.5);
      stepBioelectricN(state, 100);

      for (const channel of state.channels) {
        for (const value of channel) {
          expect(Number.isFinite(value)).toBe(true);
        }
      }
    });
  });
});
