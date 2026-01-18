/**
 * Sensorimotor Mode Tests
 * Tests for sensorimotor mode handler, presets, and utilities
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  SENSORIMOTOR_PRESETS,
  getSensorimotorPresets,
  getSensorimotorPresetById,
} from "../../patterns/registry/sensorimotor-presets";
import {
  validatePresetConfig,
  type SensorimotorPresetConfig,
} from "../../patterns/registry/preset-types";
import { DEFAULT_MODE_FACTORIES } from "../../core/engine/modes";

describe("sensorimotor-mode", () => {
  describe("SENSORIMOTOR_PRESETS", () => {
    it("has chemotaxis-basic preset", () => {
      const preset = SENSORIMOTOR_PRESETS.find(
        (p) => p.metadata.id === "sm-chemotaxis-basic",
      );

      expect(preset).toBeDefined();
      expect(preset?.metadata.mode).toBe("sensorimotor");
      expect(preset?.metadata.name).toBe("Chemotaxis Basic");
    });

    it("has maze-navigation preset", () => {
      const preset = SENSORIMOTOR_PRESETS.find(
        (p) => p.metadata.id === "sm-maze-navigation",
      );

      expect(preset).toBeDefined();
      expect(preset?.config.type).toBe("sensorimotor");
    });

    it("has swarm-following preset", () => {
      const preset = SENSORIMOTOR_PRESETS.find(
        (p) => p.metadata.id === "sm-swarm-following",
      );

      expect(preset).toBeDefined();
      expect(
        (preset?.config as SensorimotorPresetConfig).params.pheromoneEmission,
      ).toBeGreaterThan(0.05);
    });

    it("has wall-bouncer preset", () => {
      const preset = SENSORIMOTOR_PRESETS.find(
        (p) => p.metadata.id === "sm-wall-bouncer",
      );

      expect(preset).toBeDefined();
      expect(
        (preset?.config as SensorimotorPresetConfig).params.obstacleRepulsion,
      ).toBeGreaterThan(3);
    });

    it("has predator-evasion preset", () => {
      const preset = SENSORIMOTOR_PRESETS.find(
        (p) => p.metadata.id === "sm-predator-evasion",
      );

      expect(preset).toBeDefined();
      expect(
        (preset?.config as SensorimotorPresetConfig).params.motorInfluence,
      ).toBeGreaterThan(0.4);
    });

    it("has gentle-explorer preset", () => {
      const preset = SENSORIMOTOR_PRESETS.find(
        (p) => p.metadata.id === "sm-gentle-explorer",
      );

      expect(preset).toBeDefined();
      expect(
        (preset?.config as SensorimotorPresetConfig).params.dt,
      ).toBeLessThan(0.1);
    });

    it("all presets have valid configs", () => {
      for (const preset of SENSORIMOTOR_PRESETS) {
        expect(preset.config.type).toBe("sensorimotor");
        expect(
          (preset.config as SensorimotorPresetConfig).params,
        ).toBeDefined();
        expect(
          (preset.config as SensorimotorPresetConfig).params.kernelRadius,
        ).toBeGreaterThan(0);
        expect(
          (preset.config as SensorimotorPresetConfig).params.dt,
        ).toBeGreaterThan(0);
      }
    });

    it("all presets pass validation", () => {
      for (const preset of SENSORIMOTOR_PRESETS) {
        const result = validatePresetConfig(preset.config);
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      }
    });

    it("all presets have correct mode in metadata", () => {
      for (const preset of SENSORIMOTOR_PRESETS) {
        expect(preset.metadata.mode).toBe("sensorimotor");
      }
    });
  });

  describe("getSensorimotorPresets", () => {
    it("returns all sensorimotor presets", () => {
      const presets = getSensorimotorPresets();

      expect(presets).toHaveLength(SENSORIMOTOR_PRESETS.length);
      expect(presets.every((p) => p.metadata.mode === "sensorimotor")).toBe(
        true,
      );
    });
  });

  describe("getSensorimotorPresetById", () => {
    it("returns preset by ID", () => {
      const preset = getSensorimotorPresetById("sm-chemotaxis-basic");

      expect(preset).toBeDefined();
      expect(preset?.metadata.id).toBe("sm-chemotaxis-basic");
    });

    it("returns undefined for unknown ID", () => {
      const preset = getSensorimotorPresetById("unknown-preset");

      expect(preset).toBeUndefined();
    });
  });

  describe("SensorimotorPresetConfig validation", () => {
    it("validates valid config", () => {
      const config: SensorimotorPresetConfig = {
        type: "sensorimotor",
        params: {
          kernelRadius: 15,
          dt: 0.1,
          growthCenter: 0.15,
          growthWidth: 0.03,
          obstacleRepulsion: 2.0,
          motorInfluence: 0.3,
          gradientDiffusion: 0.1,
          gradientDecay: 0.01,
          proximityRadius: 20,
          pheromoneEmission: 0.05,
          pheromoneDiffusion: 0.15,
          pheromoneDecay: 0.02,
        },
      };

      const result = validatePresetConfig(config);
      expect(result.valid).toBe(true);
    });

    it("warns for kernel radius outside range", () => {
      const config: SensorimotorPresetConfig = {
        type: "sensorimotor",
        params: {
          kernelRadius: 3, // Too small
          dt: 0.1,
          growthCenter: 0.15,
          growthWidth: 0.03,
          obstacleRepulsion: 2.0,
          motorInfluence: 0.3,
          gradientDiffusion: 0.1,
          gradientDecay: 0.01,
          proximityRadius: 20,
          pheromoneEmission: 0.05,
          pheromoneDiffusion: 0.15,
          pheromoneDecay: 0.02,
        },
      };

      const result = validatePresetConfig(config);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings.some((w) => w.includes("radius"))).toBe(true);
    });
  });

  describe("mode factory registration", () => {
    it("has sensorimotor factory registered", () => {
      expect(DEFAULT_MODE_FACTORIES.sensorimotor).toBeDefined();
      expect(typeof DEFAULT_MODE_FACTORIES.sensorimotor).toBe("function");
    });
  });

  describe("preset param ranges", () => {
    it("all presets have kernel radius in valid range", () => {
      for (const preset of SENSORIMOTOR_PRESETS) {
        const params = (preset.config as SensorimotorPresetConfig).params;
        expect(params.kernelRadius).toBeGreaterThanOrEqual(5);
        expect(params.kernelRadius).toBeLessThanOrEqual(30);
      }
    });

    it("all presets have dt in valid range", () => {
      for (const preset of SENSORIMOTOR_PRESETS) {
        const params = (preset.config as SensorimotorPresetConfig).params;
        expect(params.dt).toBeGreaterThan(0);
        expect(params.dt).toBeLessThanOrEqual(0.2);
      }
    });

    it("all presets have growth params in valid range", () => {
      for (const preset of SENSORIMOTOR_PRESETS) {
        const params = (preset.config as SensorimotorPresetConfig).params;
        expect(params.growthCenter).toBeGreaterThan(0);
        expect(params.growthCenter).toBeLessThan(1);
        expect(params.growthWidth).toBeGreaterThan(0);
        expect(params.growthWidth).toBeLessThan(0.2);
      }
    });

    it("all presets have motor influence in valid range", () => {
      for (const preset of SENSORIMOTOR_PRESETS) {
        const params = (preset.config as SensorimotorPresetConfig).params;
        expect(params.motorInfluence).toBeGreaterThanOrEqual(0);
        expect(params.motorInfluence).toBeLessThanOrEqual(1);
      }
    });

    it("all presets have obstacle repulsion in valid range", () => {
      for (const preset of SENSORIMOTOR_PRESETS) {
        const params = (preset.config as SensorimotorPresetConfig).params;
        expect(params.obstacleRepulsion).toBeGreaterThanOrEqual(0);
        expect(params.obstacleRepulsion).toBeLessThanOrEqual(10);
      }
    });
  });

  describe("preset metadata", () => {
    it("all presets have required metadata fields", () => {
      for (const preset of SENSORIMOTOR_PRESETS) {
        expect(preset.metadata.id).toBeDefined();
        expect(preset.metadata.name).toBeDefined();
        expect(preset.metadata.description).toBeDefined();
        expect(preset.metadata.mode).toBe("sensorimotor");
        expect(preset.metadata.category).toBeDefined();
        expect(preset.metadata.tags).toBeDefined();
        expect(Array.isArray(preset.metadata.tags)).toBe(true);
      }
    });

    it("all presets have behavior descriptors", () => {
      for (const preset of SENSORIMOTOR_PRESETS) {
        expect(preset.metadata.behavior).toBeDefined();
        expect(typeof preset.metadata.behavior.mobile).toBe("boolean");
      }
    });

    it("all presets are marked as verified", () => {
      for (const preset of SENSORIMOTOR_PRESETS) {
        expect(preset.metadata.verified).toBe(true);
      }
    });
  });
});

describe("sensorimotor-mode WebGPU", () => {
  let mockDevice: GPUDevice;

  beforeEach(async () => {
    // Skip if WebGPU not available
    if (!navigator.gpu) {
      return;
    }
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) {
      return;
    }
    mockDevice = await adapter.requestDevice();
  });

  afterEach(() => {
    if (mockDevice) {
      mockDevice.destroy();
    }
  });

  it("can create sensorimotor mode handler", async () => {
    if (!mockDevice) {
      return; // Skip if no WebGPU
    }

    const handler = DEFAULT_MODE_FACTORIES.sensorimotor!(mockDevice, {
      width: 256,
      height: 256,
    });

    expect(handler).toBeDefined();
    expect(handler.id).toBe("sensorimotor");
    expect(handler.name).toBe("Sensorimotor Lenia");
    expect(handler.isReady()).toBe(false); // Not initialized yet
  });
});
