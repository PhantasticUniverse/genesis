/**
 * Integration Tests: Multi-Channel Ecology
 * Tests multi-species ecology configuration and parameter validation
 */

import { describe, it, expect } from "vitest";
import {
  MULTICHANNEL_PRESETS,
  type MultiChannelConfig,
  type ChannelConfig,
  type InteractionConfig,
} from "../../core/channels";
import { organismToParams } from "../../patterns/lenia-library";
import { ALL_ORGANISMS } from "../../patterns/lenia-library";
import type { LeniaGenome } from "../../discovery/genome";

describe("Multi-Channel Ecology Integration", () => {
  describe("Preset configurations", () => {
    it("should have valid single preset", () => {
      const single = MULTICHANNEL_PRESETS["single"];

      expect(single.channels.length).toBe(1);
      expect(single.interactions.length).toBe(1); // Self-interaction
      expect(single.channels[0].name).toBe("Main");
    });

    it("should have valid two-species preset", () => {
      const twoSpecies = MULTICHANNEL_PRESETS["two-species"];

      expect(twoSpecies.channels.length).toBe(2);
      expect(twoSpecies.interactions.length).toBeGreaterThan(0);

      // Check interaction structure
      twoSpecies.interactions.forEach((interaction) => {
        expect(interaction.sourceChannel).toBeGreaterThanOrEqual(0);
        expect(interaction.targetChannel).toBeGreaterThanOrEqual(0);
        expect(interaction.sourceChannel).toBeLessThan(
          twoSpecies.channels.length,
        );
        expect(interaction.targetChannel).toBeLessThan(
          twoSpecies.channels.length,
        );
      });
    });

    it("should have valid predator-prey preset", () => {
      const predatorPrey = MULTICHANNEL_PRESETS["predator-prey"];

      expect(predatorPrey.channels.length).toBe(2);

      // Should have predator and prey channels
      const names = predatorPrey.channels.map((c) => c.name);
      expect(names).toContain("Predator");
      expect(names).toContain("Prey");

      // Should have predation interaction type
      const predationInteraction = predatorPrey.interactions.find(
        (i) => i.interactionType === "predation",
      );
      expect(predationInteraction).toBeDefined();
    });

    it("should have valid food-chain preset", () => {
      const foodChain = MULTICHANNEL_PRESETS["food-chain"];

      expect(foodChain.channels.length).toBe(3);

      // Should have hierarchy
      const names = foodChain.channels.map((c) => c.name);
      expect(names).toContain("Plants");
      expect(names).toContain("Herbivore");
      expect(names).toContain("Predator");

      // Multiple predation interactions
      const predations = foodChain.interactions.filter(
        (i) => i.interactionType === "predation",
      );
      expect(predations.length).toBeGreaterThan(0);
    });

    it("should have valid symbiosis preset", () => {
      const symbiosis = MULTICHANNEL_PRESETS["symbiosis"];

      // Symbiosis should have mutual benefit interactions
      const symbioticInteractions = symbiosis.interactions.filter(
        (i) => i.interactionType === "symbiosis" || i.weight > 0,
      );
      expect(symbioticInteractions.length).toBeGreaterThan(0);
    });

    it("all presets should have valid channel config", () => {
      Object.entries(MULTICHANNEL_PRESETS).forEach(([name, preset]) => {
        preset.channels.forEach((channel, i) => {
          expect(channel.id).toBeDefined();
          expect(channel.name).toBeDefined();
          expect(channel.role).toBeDefined();
          expect(channel.color.length).toBe(3);

          // Color values should be 0-255
          channel.color.forEach((c) => {
            expect(c).toBeGreaterThanOrEqual(0);
            expect(c).toBeLessThanOrEqual(255);
          });
        });

        // Check interactions have valid parameters
        preset.interactions.forEach((interaction) => {
          expect(interaction.kernelRadius).toBeGreaterThan(0);
          expect(interaction.growthCenter).toBeGreaterThan(0);
          expect(interaction.growthWidth).toBeGreaterThan(0);
        });
      });
    });
  });

  describe("Channel configuration validation", () => {
    it("should have consistent interaction indices", () => {
      Object.values(MULTICHANNEL_PRESETS).forEach((preset) => {
        preset.interactions.forEach((interaction) => {
          expect(interaction.sourceChannel).toBeLessThan(
            preset.channels.length,
          );
          expect(interaction.targetChannel).toBeLessThan(
            preset.channels.length,
          );
        });
      });
    });

    it("should have valid interaction weights", () => {
      Object.values(MULTICHANNEL_PRESETS).forEach((preset) => {
        preset.interactions.forEach((interaction) => {
          // Weight can be negative for inhibition, but should be a number
          expect(typeof interaction.weight).toBe("number");
          expect(isNaN(interaction.weight)).toBe(false);
        });
      });
    });

    it("channels should have unique colors within preset", () => {
      Object.entries(MULTICHANNEL_PRESETS).forEach(([name, preset]) => {
        if (preset.channels.length > 1) {
          const colorStrings = preset.channels.map((c) => c.color.join(","));
          const uniqueColors = new Set(colorStrings);
          expect(uniqueColors.size).toBe(preset.channels.length);
        }
      });
    });
  });

  describe("Organism parameter conversion", () => {
    it("should convert classic organisms to engine params", () => {
      ALL_ORGANISMS.forEach((organism) => {
        const params = organismToParams(organism);

        expect(params.kernelRadius).toBe(organism.genome.R);
        expect(params.growthCenter).toBe(organism.genome.m);
        expect(params.growthWidth).toBe(organism.genome.s);
        expect(params.dt).toBeCloseTo(1 / organism.genome.T);
      });
    });

    it("should handle different growth types", () => {
      // gn=1 should be polynomial
      const polyOrganism = ALL_ORGANISMS.find((o) => o.genome.gn === 1);
      if (polyOrganism) {
        const params = organismToParams(polyOrganism);
        expect(params.growthType).toBe("polynomial");
      }

      // gn=2 should be exponential
      const expOrganism = ALL_ORGANISMS.find((o) => o.genome.gn === 2);
      if (expOrganism) {
        const params = organismToParams(expOrganism);
        expect(params.growthType).toBe("exponential");
      }
    });
  });

  describe("Ecology parameter ranges", () => {
    it("interactions should have stable Lenia parameters", () => {
      Object.values(MULTICHANNEL_PRESETS).forEach((preset) => {
        preset.interactions.forEach((interaction) => {
          // Typical stable ranges from CLAUDE.md
          expect(interaction.kernelRadius).toBeGreaterThanOrEqual(5);
          expect(interaction.kernelRadius).toBeLessThanOrEqual(30);
          expect(interaction.growthCenter).toBeGreaterThan(0);
          expect(interaction.growthCenter).toBeLessThan(1);
          expect(interaction.growthWidth).toBeGreaterThan(0);
          expect(interaction.growthWidth).toBeLessThan(0.2);
        });
      });
    });

    it("channels should have valid decay and diffusion rates", () => {
      Object.values(MULTICHANNEL_PRESETS).forEach((preset) => {
        preset.channels.forEach((channel) => {
          expect(channel.decayRate).toBeGreaterThanOrEqual(0);
          expect(channel.diffusionRate).toBeGreaterThanOrEqual(0);
        });
      });
    });
  });
});
