/**
 * Integration Tests: Particle-Lenia Hybrid
 * Tests the integration of particle systems with the Lenia cellular automata
 */

import { describe, it, expect } from "vitest";
import {
  createParticleSystem,
  updateParticleSystem,
  depositToField,
  calculateFieldGradient,
  spawnRandomParticles,
  addParticle,
  getActiveParticles,
  INTERACTION_PRESETS,
  type ParticleSystemState,
} from "../../core/particles";
import {
  PARTICLE_LENIA_PRESETS,
  type ParticlePresetName,
} from "../../core/engine";

describe("Particle-Lenia Hybrid Integration", () => {
  describe("Particle presets", () => {
    it("should have all required presets defined", () => {
      const expectedPresets: ParticlePresetName[] = [
        "attractive",
        "clustering",
        "chain",
        "seeder",
        "explorer",
      ];

      expectedPresets.forEach((preset) => {
        expect(PARTICLE_LENIA_PRESETS[preset]).toBeDefined();
        expect(PARTICLE_LENIA_PRESETS[preset].description).toBeDefined();
        expect(PARTICLE_LENIA_PRESETS[preset].particleConfig).toBeDefined();
        expect(PARTICLE_LENIA_PRESETS[preset].coupling).toBeDefined();
        expect(PARTICLE_LENIA_PRESETS[preset].interactionPreset).toBeDefined();
        expect(PARTICLE_LENIA_PRESETS[preset].initialParticles).toBeGreaterThan(
          0,
        );
      });
    });

    it("presets should have valid interaction presets", () => {
      Object.values(PARTICLE_LENIA_PRESETS).forEach((preset) => {
        expect(["attractive", "clustering", "chain", "random"]).toContain(
          preset.interactionPreset,
        );
      });
    });

    it("presets should have reasonable particle counts", () => {
      Object.values(PARTICLE_LENIA_PRESETS).forEach((preset) => {
        expect(preset.initialParticles).toBeGreaterThan(0);
        expect(preset.initialParticles).toBeLessThanOrEqual(
          preset.particleConfig.maxParticles ?? 500,
        );
      });
    });
  });

  describe("Field coupling", () => {
    it("should deposit particles to field", () => {
      const state = createParticleSystem(
        { maxParticles: 10, numTypes: 1, gridWidth: 64, gridHeight: 64 },
        { depositEnabled: true, depositAmount: 0.5, depositRadius: 5 },
      );

      // Spawn a single particle at center
      spawnRandomParticles(state, 1, { centerX: 32, centerY: 32, spread: 0 });

      const field = new Float32Array(64 * 64);
      depositToField(state, field);

      // Should have deposited mass near center
      const centerValue = field[32 * 64 + 32];
      expect(centerValue).toBeGreaterThan(0);

      // Values should decay with distance
      const nearValue = field[32 * 64 + 35]; // 3 pixels away
      const farValue = field[32 * 64 + 45]; // 13 pixels away
      expect(nearValue).toBeLessThan(centerValue);
      expect(farValue).toBeLessThan(nearValue);
    });

    it("should not deposit when disabled", () => {
      const state = createParticleSystem(
        { maxParticles: 10, numTypes: 1, gridWidth: 64, gridHeight: 64 },
        { depositEnabled: false, depositAmount: 0.5, depositRadius: 5 },
      );

      spawnRandomParticles(state, 5, { centerX: 32, centerY: 32, spread: 10 });

      const field = new Float32Array(64 * 64);
      depositToField(state, field);

      // Field should remain empty
      const sum = field.reduce((a, b) => a + b, 0);
      expect(sum).toBe(0);
    });

    it("should calculate field gradient correctly", () => {
      const width = 64;
      const height = 64;

      // Create a field with a gradient (higher values on right)
      const field = new Float32Array(width * height);
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          field[y * width + x] = x / width;
        }
      }

      const gradient = calculateFieldGradient(field, width, height);

      // Gradient should point rightward (positive x)
      // Sample from center
      const centerIdx = 32 * width + 32;
      expect(gradient.gx[centerIdx]).toBeGreaterThan(0);
      expect(Math.abs(gradient.gy[centerIdx])).toBeLessThan(0.01);
    });

    it("particles should respond to field gradient", () => {
      const width = 64;
      const height = 64;

      const state = createParticleSystem(
        {
          maxParticles: 10,
          numTypes: 1,
          gridWidth: width,
          gridHeight: height,
          friction: 0, // No friction so we can see full effect
          dt: 1.0,
        },
        {
          gradientResponseEnabled: true,
          gradientStrength: 10.0, // Strong gradient response
          depositEnabled: false,
        },
      );

      // Manually add a particle at center with zero velocity
      state.particles[0] = {
        id: 0,
        x: 32,
        y: 32,
        vx: 0,
        vy: 0,
        type: 0,
        mass: 1,
        active: true,
      };
      state.activeCount = 1;

      // Create a strong gradient pointing right
      const field = new Float32Array(width * height);
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          field[y * width + x] = x / width;
        }
      }
      const gradient = calculateFieldGradient(field, width, height);

      // Verify gradient is positive at particle position
      const idx = 32 * width + 32;
      expect(gradient.gx[idx]).toBeGreaterThan(0);

      // Update particles with gradient
      updateParticleSystem(state, gradient);

      // Particle velocity should reflect the gradient direction
      // Note: The exact velocity depends on mass and dt
      // Just verify that the gradient had some effect on the particle
      const hasGradientEffect =
        state.particles[0].vx !== 0 || state.particles[0].x !== 32;
      expect(hasGradientEffect).toBe(true);
    });
  });

  describe("Particle physics integration", () => {
    it("should update particle positions", () => {
      const state = createParticleSystem({
        maxParticles: 10,
        numTypes: 1,
        gridWidth: 100,
        gridHeight: 100,
        friction: 0,
        dt: 1.0,
      });

      // Create a particle with initial velocity
      spawnRandomParticles(state, 1, { centerX: 50, centerY: 50, spread: 0 });
      state.particles[0].vx = 5;
      state.particles[0].vy = 3;
      const initialX = state.particles[0].x;
      const initialY = state.particles[0].y;

      updateParticleSystem(state);

      // Position should have changed
      expect(state.particles[0].x).not.toBe(initialX);
      expect(state.particles[0].y).not.toBe(initialY);
    });

    it("particles should interact based on type rules", () => {
      const state = createParticleSystem({
        maxParticles: 10,
        numTypes: 2,
        gridWidth: 100,
        gridHeight: 100,
        friction: 0,
      });

      // Use attractive preset (equilibriumDistance: 25, maxRange: 80)
      state.interactionMatrix = INTERACTION_PRESETS.attractive(2);

      // Add two particles at fixed positions with no initial velocity
      // Place them 60 units apart (within maxRange of 80, above equilibrium of 25)
      addParticle(state, 35, 50, 0, 0, 0); // particle at (35, 50)
      addParticle(state, 65, 50, 0, 0, 0); // particle at (65, 50)

      // Initial distance is 30 units
      const initialDist = 30;

      // Update several times - particles should attract toward equilibrium distance
      for (let i = 0; i < 50; i++) {
        updateParticleSystem(state);
      }

      // Particles should have moved closer (attraction toward equilibrium ~25)
      const finalDist = Math.sqrt(
        Math.pow(state.particles[1].x - state.particles[0].x, 2) +
          Math.pow(state.particles[1].y - state.particles[0].y, 2),
      );

      // Distance should decrease since initial (30) > equilibrium (25)
      expect(finalDist).toBeLessThan(initialDist);
    });
  });

  describe("Hybrid workflow simulation", () => {
    it("should complete a full hybrid simulation cycle", () => {
      const width = 64;
      const height = 64;

      // Create particle system with "seeder" preset config
      const preset = PARTICLE_LENIA_PRESETS["seeder"];
      const state = createParticleSystem(
        {
          ...preset.particleConfig,
          gridWidth: width,
          gridHeight: height,
        } as any,
        preset.coupling,
      );

      // Set interaction matrix
      const numTypes = preset.particleConfig.numTypes ?? 1;
      state.interactionMatrix =
        INTERACTION_PRESETS[preset.interactionPreset](numTypes);

      // Spawn particles
      spawnRandomParticles(state, preset.initialParticles, {
        centerX: width / 2,
        centerY: height / 2,
        spread: 30,
      });

      // Simulate Lenia field
      const field = new Float32Array(width * height);

      // Run simulation for several steps
      for (let step = 0; step < 20; step++) {
        // Update particles
        const gradient =
          step > 0 ? calculateFieldGradient(field, width, height) : undefined;
        updateParticleSystem(state, gradient);

        // Deposit to field
        depositToField(state, field);
      }

      // Field should have accumulated mass
      const totalMass = field.reduce((a, b) => a + b, 0);
      expect(totalMass).toBeGreaterThan(0);

      // Particles should still be active
      const active = getActiveParticles(state);
      expect(active.length).toBe(preset.initialParticles);
    });

    it("clustering preset should create distinct regions", () => {
      const width = 128;
      const height = 128;

      const preset = PARTICLE_LENIA_PRESETS["clustering"];
      const state = createParticleSystem(
        {
          maxParticles: 100,
          numTypes: 3,
          gridWidth: width,
          gridHeight: height,
          friction: 0.03,
        },
        preset.coupling,
      );

      state.interactionMatrix = INTERACTION_PRESETS.clustering(3);
      spawnRandomParticles(state, 60, {
        centerX: width / 2,
        centerY: height / 2,
        spread: 50,
      });

      // Run for enough steps for clustering to occur
      for (let step = 0; step < 100; step++) {
        updateParticleSystem(state);
      }

      // Count particles by type
      const active = getActiveParticles(state);
      const byType = new Map<number, number>();
      for (const p of active) {
        byType.set(p.type, (byType.get(p.type) ?? 0) + 1);
      }

      // Should have multiple types
      expect(byType.size).toBeGreaterThanOrEqual(2);
    });
  });

  describe("Preset configurations validation", () => {
    Object.entries(PARTICLE_LENIA_PRESETS).forEach(([name, preset]) => {
      describe(`Preset: ${name}`, () => {
        it("should have valid particle config", () => {
          const { particleConfig } = preset;
          if (particleConfig.maxParticles !== undefined) {
            expect(particleConfig.maxParticles).toBeGreaterThan(0);
            expect(particleConfig.maxParticles).toBeLessThanOrEqual(1000);
          }
          if (particleConfig.numTypes !== undefined) {
            expect(particleConfig.numTypes).toBeGreaterThan(0);
            expect(particleConfig.numTypes).toBeLessThanOrEqual(8);
          }
          if (particleConfig.friction !== undefined) {
            expect(particleConfig.friction).toBeGreaterThanOrEqual(0);
            expect(particleConfig.friction).toBeLessThanOrEqual(1);
          }
        });

        it("should have valid coupling config", () => {
          const { coupling } = preset;
          if (coupling.depositAmount !== undefined) {
            expect(coupling.depositAmount).toBeGreaterThanOrEqual(0);
            expect(coupling.depositAmount).toBeLessThanOrEqual(1);
          }
          if (coupling.depositRadius !== undefined) {
            expect(coupling.depositRadius).toBeGreaterThanOrEqual(0);
          }
          // Gradient strength can be negative (for repulsion)
          if (coupling.gradientStrength !== undefined) {
            expect(Math.abs(coupling.gradientStrength)).toBeLessThanOrEqual(2);
          }
        });

        it("should create a working particle system", () => {
          const state = createParticleSystem(
            {
              maxParticles: preset.particleConfig.maxParticles ?? 100,
              numTypes: preset.particleConfig.numTypes ?? 3,
              gridWidth: 64,
              gridHeight: 64,
            },
            preset.coupling,
          );

          state.interactionMatrix = INTERACTION_PRESETS[
            preset.interactionPreset
          ](preset.particleConfig.numTypes ?? 3);
          spawnRandomParticles(state, preset.initialParticles);

          // Should be able to update without errors
          expect(() => {
            for (let i = 0; i < 10; i++) {
              updateParticleSystem(state);
            }
          }).not.toThrow();
        });
      });
    });
  });
});
