/**
 * Tests for Particle System
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  createParticleSystem,
  addParticle,
  removeParticle,
  getActiveParticles,
  calculateForce,
  updateParticleSystem,
  depositToField,
  calculateFieldGradient,
  spawnRandomParticles,
  createDefaultInteractionMatrix,
  INTERACTION_PRESETS,
  type Particle,
  type ParticleSystemState,
  type InteractionRule,
  DEFAULT_PARTICLE_CONFIG,
} from "../../core/particles";

describe("Particle System", () => {
  describe("createParticleSystem", () => {
    it("creates empty system with default config", () => {
      const state = createParticleSystem();
      expect(state.particles).toHaveLength(0);
      expect(state.config.maxParticles).toBe(500);
      expect(state.config.numTypes).toBe(3);
    });

    it("accepts custom config", () => {
      const state = createParticleSystem({
        maxParticles: 100,
        numTypes: 5,
        gridWidth: 256,
        gridHeight: 256,
      });
      expect(state.config.maxParticles).toBe(100);
      expect(state.config.numTypes).toBe(5);
      expect(state.config.gridWidth).toBe(256);
    });

    it("creates interaction matrix of correct size", () => {
      const state = createParticleSystem({ numTypes: 4 });
      expect(state.interactionMatrix).toHaveLength(4);
      expect(state.interactionMatrix[0]).toHaveLength(4);
    });
  });

  describe("addParticle", () => {
    let state: ParticleSystemState;

    beforeEach(() => {
      state = createParticleSystem({ maxParticles: 10 });
    });

    it("adds particle with correct properties", () => {
      const p = addParticle(state, 100, 200, 1, 0.5, -0.5, 2);
      expect(p).not.toBeNull();
      expect(p!.x).toBe(100);
      expect(p!.y).toBe(200);
      expect(p!.type).toBe(1);
      expect(p!.vx).toBe(0.5);
      expect(p!.vy).toBe(-0.5);
      expect(p!.mass).toBe(2);
      expect(p!.active).toBe(true);
    });

    it("returns null when at max capacity", () => {
      for (let i = 0; i < 10; i++) {
        addParticle(state, i, i);
      }
      const p = addParticle(state, 100, 100);
      expect(p).toBeNull();
    });

    it("wraps type to valid range", () => {
      const p = addParticle(state, 0, 0, 5); // numTypes is 3
      expect(p!.type).toBe(2); // 5 % 3 = 2
    });

    it("assigns sequential IDs", () => {
      const p1 = addParticle(state, 0, 0);
      const p2 = addParticle(state, 1, 1);
      const p3 = addParticle(state, 2, 2);
      expect(p1!.id).toBe(0);
      expect(p2!.id).toBe(1);
      expect(p3!.id).toBe(2);
    });
  });

  describe("removeParticle", () => {
    it("marks particle as inactive", () => {
      const state = createParticleSystem();
      addParticle(state, 0, 0);
      expect(removeParticle(state, 0)).toBe(true);
      expect(state.particles[0].active).toBe(false);
    });

    it("returns false for non-existent particle", () => {
      const state = createParticleSystem();
      expect(removeParticle(state, 999)).toBe(false);
    });
  });

  describe("getActiveParticles", () => {
    it("returns only active particles", () => {
      const state = createParticleSystem();
      addParticle(state, 0, 0);
      addParticle(state, 1, 1);
      addParticle(state, 2, 2);
      removeParticle(state, 1);

      const active = getActiveParticles(state);
      expect(active).toHaveLength(2);
      expect(active.map((p) => p.id)).toEqual([0, 2]);
    });
  });

  describe("calculateForce", () => {
    const config = DEFAULT_PARTICLE_CONFIG;
    const attractiveRule: InteractionRule = {
      strength: 1.0,
      equilibriumDistance: 20,
      maxRange: 50,
    };
    const repulsiveRule: InteractionRule = {
      strength: -1.0,
      equilibriumDistance: 20,
      maxRange: 50,
    };

    it("returns zero force for particles at same position", () => {
      const p1: Particle = {
        id: 0,
        x: 100,
        y: 100,
        vx: 0,
        vy: 0,
        type: 0,
        mass: 1,
        active: true,
      };
      const p2: Particle = {
        id: 1,
        x: 100,
        y: 100,
        vx: 0,
        vy: 0,
        type: 0,
        mass: 1,
        active: true,
      };
      const force = calculateForce(p1, p2, attractiveRule, config);
      expect(force.fx).toBe(0);
      expect(force.fy).toBe(0);
    });

    it("returns zero force beyond maxRange", () => {
      const p1: Particle = {
        id: 0,
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        type: 0,
        mass: 1,
        active: true,
      };
      const p2: Particle = {
        id: 1,
        x: 100,
        y: 0,
        vx: 0,
        vy: 0,
        type: 0,
        mass: 1,
        active: true,
      };
      const force = calculateForce(p1, p2, attractiveRule, config);
      expect(force.fx).toBe(0);
      expect(force.fy).toBe(0);
    });

    it("attractive force points toward other particle", () => {
      const p1: Particle = {
        id: 0,
        x: 100,
        y: 100,
        vx: 0,
        vy: 0,
        type: 0,
        mass: 1,
        active: true,
      };
      const p2: Particle = {
        id: 1,
        x: 130,
        y: 100,
        vx: 0,
        vy: 0,
        type: 0,
        mass: 1,
        active: true,
      }; // 30 units away, past equilibrium
      const force = calculateForce(p1, p2, attractiveRule, config);
      expect(force.fx).toBeGreaterThan(0); // Positive = toward p2
      expect(force.fy).toBeCloseTo(0, 5);
    });

    it("repulsive force points away from other particle", () => {
      const p1: Particle = {
        id: 0,
        x: 100,
        y: 100,
        vx: 0,
        vy: 0,
        type: 0,
        mass: 1,
        active: true,
      };
      const p2: Particle = {
        id: 1,
        x: 130,
        y: 100,
        vx: 0,
        vy: 0,
        type: 0,
        mass: 1,
        active: true,
      };
      const force = calculateForce(p1, p2, repulsiveRule, config);
      expect(force.fx).toBeLessThan(0); // Negative = away from p2
    });

    it("force is repulsive at close range regardless of rule", () => {
      const p1: Particle = {
        id: 0,
        x: 100,
        y: 100,
        vx: 0,
        vy: 0,
        type: 0,
        mass: 1,
        active: true,
      };
      const p2: Particle = {
        id: 1,
        x: 110,
        y: 100,
        vx: 0,
        vy: 0,
        type: 0,
        mass: 1,
        active: true,
      }; // 10 units, less than equilibrium
      const force = calculateForce(p1, p2, attractiveRule, config);
      expect(force.fx).toBeLessThan(0); // Repulsive even with attractive rule
    });

    it("handles wrapping boundaries", () => {
      const wrappingConfig = {
        ...config,
        wrapBoundaries: true,
        gridWidth: 100,
        gridHeight: 100,
      };
      const p1: Particle = {
        id: 0,
        x: 5,
        y: 50,
        vx: 0,
        vy: 0,
        type: 0,
        mass: 1,
        active: true,
      };
      const p2: Particle = {
        id: 1,
        x: 95,
        y: 50,
        vx: 0,
        vy: 0,
        type: 0,
        mass: 1,
        active: true,
      };
      // Actual distance is 10 (wrapped via boundary), not 90
      // p2 is effectively 10 units to the LEFT of p1 (dx = -10)
      // Distance 10 < equilibrium 20, so repulsion applies
      // Repulsion pushes p1 AWAY from p2 (to the right = positive fx)
      const force = calculateForce(p1, p2, attractiveRule, wrappingConfig);
      expect(force.fx).toBeGreaterThan(0); // Repels away from p2 (to the right)
    });

    it("scales force by other particle mass", () => {
      const p1: Particle = {
        id: 0,
        x: 100,
        y: 100,
        vx: 0,
        vy: 0,
        type: 0,
        mass: 1,
        active: true,
      };
      const p2Light: Particle = {
        id: 1,
        x: 130,
        y: 100,
        vx: 0,
        vy: 0,
        type: 0,
        mass: 1,
        active: true,
      };
      const p2Heavy: Particle = {
        id: 2,
        x: 130,
        y: 100,
        vx: 0,
        vy: 0,
        type: 0,
        mass: 3,
        active: true,
      };

      const forceLight = calculateForce(p1, p2Light, attractiveRule, config);
      const forceHeavy = calculateForce(p1, p2Heavy, attractiveRule, config);

      expect(Math.abs(forceHeavy.fx)).toBeCloseTo(
        Math.abs(forceLight.fx) * 3,
        5,
      );
    });
  });

  describe("updateParticleSystem", () => {
    it("updates positions based on velocity", () => {
      const state = createParticleSystem({ friction: 0, dt: 1 });
      addParticle(state, 100, 100, 0, 5, 3);

      // Clear interaction matrix to isolate velocity test
      state.interactionMatrix = createDefaultInteractionMatrix(3);
      for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
          state.interactionMatrix[i][j].strength = 0;
        }
      }

      updateParticleSystem(state);

      expect(state.particles[0].x).toBeCloseTo(105, 0);
      expect(state.particles[0].y).toBeCloseTo(103, 0);
    });

    it("applies friction", () => {
      const state = createParticleSystem({ friction: 0.1, dt: 1 });
      addParticle(state, 100, 100, 0, 10, 0);

      // Zero out interactions
      state.interactionMatrix = createDefaultInteractionMatrix(3);
      for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
          state.interactionMatrix[i][j].strength = 0;
        }
      }

      updateParticleSystem(state);

      expect(state.particles[0].vx).toBe(9); // 10 * (1 - 0.1)
    });

    it("wraps positions at boundaries", () => {
      const state = createParticleSystem({
        gridWidth: 100,
        gridHeight: 100,
        wrapBoundaries: true,
        friction: 0,
        dt: 1,
      });
      addParticle(state, 99, 50, 0, 5, 0);

      // Zero out interactions
      state.interactionMatrix = createDefaultInteractionMatrix(3);
      for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
          state.interactionMatrix[i][j].strength = 0;
        }
      }

      updateParticleSystem(state);

      expect(state.particles[0].x).toBeCloseTo(4, 0); // Wrapped around
    });

    it("clamps velocity to max speed", () => {
      const state = createParticleSystem({ friction: 0, dt: 1 });
      addParticle(state, 100, 100, 0, 100, 100); // Very high velocity

      updateParticleSystem(state);

      const speed = Math.sqrt(
        state.particles[0].vx ** 2 + state.particles[0].vy ** 2,
      );
      expect(speed).toBeLessThanOrEqual(10);
    });
  });

  describe("depositToField", () => {
    it("deposits mass at particle positions", () => {
      const state = createParticleSystem({
        gridWidth: 10,
        gridHeight: 10,
        numTypes: 1,
      });
      state.fieldCoupling.depositEnabled = true;
      state.fieldCoupling.depositAmount = 0.5;
      state.fieldCoupling.depositRadius = 1;

      addParticle(state, 5, 5);

      const field = new Float32Array(100);
      depositToField(state, field);

      // Center should have highest value
      expect(field[5 * 10 + 5]).toBeGreaterThan(0);

      // Neighbors should have some deposit (due to Gaussian spread)
      expect(field[5 * 10 + 4]).toBeGreaterThan(0);
      expect(field[4 * 10 + 5]).toBeGreaterThan(0);
    });

    it("does nothing when deposit is disabled", () => {
      const state = createParticleSystem({ gridWidth: 10, gridHeight: 10 });
      state.fieldCoupling.depositEnabled = false;
      addParticle(state, 5, 5);

      const field = new Float32Array(100);
      depositToField(state, field);

      expect(field.every((v) => v === 0)).toBe(true);
    });

    it("clamps field values to 1", () => {
      const state = createParticleSystem({
        gridWidth: 10,
        gridHeight: 10,
        numTypes: 1,
      });
      state.fieldCoupling.depositEnabled = true;
      state.fieldCoupling.depositAmount = 10; // Very high amount

      addParticle(state, 5, 5);

      const field = new Float32Array(100);
      depositToField(state, field);

      expect(Math.max(...field)).toBeLessThanOrEqual(1);
    });
  });

  describe("calculateFieldGradient", () => {
    it("calculates correct gradient for simple pattern", () => {
      const width = 5;
      const height = 5;
      const field = new Float32Array(width * height);

      // Create a ramp in x direction: values increase from left to right
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          field[y * width + x] = x / (width - 1);
        }
      }

      const { gx, gy } = calculateFieldGradient(field, width, height);

      // gx should be positive (increasing right)
      expect(gx[2 * width + 2]).toBeGreaterThan(0);

      // gy should be near zero (no vertical gradient)
      expect(Math.abs(gy[2 * width + 2])).toBeLessThan(0.01);
    });

    it("handles toroidal wrapping", () => {
      const width = 5;
      const height = 5;
      const field = new Float32Array(width * height);
      // Create a pattern where gradient at boundary is non-zero
      // Set values so wrapping produces different neighbors
      field[1] = 1; // x=1, y=0
      // At x=0: gx = (field[1] - field[width-1]) / 2 = (1 - 0) / 2 = 0.5

      const { gx, gy } = calculateFieldGradient(field, width, height);

      // Gradient at x=0 should be non-zero due to neighbor at x=1
      expect(gx[0]).toBeCloseTo(0.5);
    });
  });

  describe("spawnRandomParticles", () => {
    it("spawns correct number of particles", () => {
      const state = createParticleSystem({ maxParticles: 100 });
      spawnRandomParticles(state, 50);
      expect(state.particles).toHaveLength(50);
    });

    it("respects max particles limit", () => {
      const state = createParticleSystem({ maxParticles: 10 });
      spawnRandomParticles(state, 100);
      expect(state.particles).toHaveLength(10);
    });

    it("spawns particles near specified center", () => {
      const state = createParticleSystem({ gridWidth: 1000, gridHeight: 1000 });
      spawnRandomParticles(state, 100, {
        centerX: 100,
        centerY: 100,
        spread: 10,
      });

      const avgX = state.particles.reduce((sum, p) => sum + p.x, 0) / 100;
      const avgY = state.particles.reduce((sum, p) => sum + p.y, 0) / 100;

      expect(avgX).toBeGreaterThan(50);
      expect(avgX).toBeLessThan(150);
      expect(avgY).toBeGreaterThan(50);
      expect(avgY).toBeLessThan(150);
    });

    it("respects type distribution", () => {
      const state = createParticleSystem({ numTypes: 3, maxParticles: 1000 });
      spawnRandomParticles(state, 900, {
        typeDistribution: [0.5, 0.3, 0.2], // 50% type 0, 30% type 1, 20% type 2
      });

      const typeCounts = [0, 0, 0];
      for (const p of state.particles) {
        typeCounts[p.type]++;
      }

      // Allow some variance from random distribution
      expect(typeCounts[0]).toBeGreaterThan(350);
      expect(typeCounts[0]).toBeLessThan(550);
      expect(typeCounts[1]).toBeGreaterThan(200);
      expect(typeCounts[1]).toBeLessThan(370);
    });
  });

  describe("createDefaultInteractionMatrix", () => {
    it("creates matrix of correct size", () => {
      const matrix = createDefaultInteractionMatrix(5);
      expect(matrix).toHaveLength(5);
      for (const row of matrix) {
        expect(row).toHaveLength(5);
      }
    });

    it("same types attract", () => {
      const matrix = createDefaultInteractionMatrix(3);
      expect(matrix[0][0].strength).toBeGreaterThan(0);
      expect(matrix[1][1].strength).toBeGreaterThan(0);
    });

    it("different types repel", () => {
      const matrix = createDefaultInteractionMatrix(3);
      expect(matrix[0][1].strength).toBeLessThan(0);
      expect(matrix[1][2].strength).toBeLessThan(0);
    });
  });

  describe("INTERACTION_PRESETS", () => {
    describe("attractive", () => {
      it("all interactions are positive", () => {
        const matrix = INTERACTION_PRESETS.attractive(3);
        for (let i = 0; i < 3; i++) {
          for (let j = 0; j < 3; j++) {
            expect(matrix[i][j].strength).toBeGreaterThan(0);
          }
        }
      });
    });

    describe("clustering", () => {
      it("same types attract strongly", () => {
        const matrix = INTERACTION_PRESETS.clustering(3);
        expect(matrix[0][0].strength).toBeGreaterThan(0.5);
        expect(matrix[1][1].strength).toBeGreaterThan(0.5);
      });

      it("different types repel", () => {
        const matrix = INTERACTION_PRESETS.clustering(3);
        expect(matrix[0][1].strength).toBeLessThan(0);
        expect(matrix[1][2].strength).toBeLessThan(0);
      });
    });

    describe("chain", () => {
      it("type N attracts to type N+1", () => {
        const matrix = INTERACTION_PRESETS.chain(3);
        expect(matrix[0][1].strength).toBeGreaterThan(0); // 0 -> 1
        expect(matrix[1][2].strength).toBeGreaterThan(0); // 1 -> 2
        expect(matrix[2][0].strength).toBeGreaterThan(0); // 2 -> 0 (wraps)
      });

      it("same types repel weakly", () => {
        const matrix = INTERACTION_PRESETS.chain(3);
        expect(matrix[0][0].strength).toBeLessThan(0);
      });
    });

    describe("random", () => {
      it("produces varied interactions", () => {
        const matrix = INTERACTION_PRESETS.random(3);
        const strengths = new Set<number>();
        for (let i = 0; i < 3; i++) {
          for (let j = 0; j < 3; j++) {
            strengths.add(matrix[i][j].strength);
          }
        }
        // Should have variety (very unlikely to be all same)
        expect(strengths.size).toBeGreaterThan(1);
      });
    });
  });
});
