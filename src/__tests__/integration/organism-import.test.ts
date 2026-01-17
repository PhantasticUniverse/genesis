/**
 * Integration Tests: Organism Import Workflow
 * Tests the full workflow of importing reference organisms,
 * converting to Genesis format, and validating parameters
 */

import { describe, it, expect } from "vitest";
import {
  REFERENCE_ORGANISMS,
  getOrganismByCode,
  getOrganismsByFamily,
  ORGANISM_FAMILIES,
} from "../../patterns/reference-organisms";
import {
  importReferenceOrganism,
  decodeReferenceRLE,
  inferDimensionsFromRLE,
} from "../../patterns/organism-importer";
import { organismToParams, ALL_ORGANISMS } from "../../patterns/lenia-library";
import type { LeniaPattern } from "../../utils/rle";

describe("Organism Import Integration", () => {
  describe("Reference organism library", () => {
    it("should have diverse organism families", () => {
      const families = new Set(REFERENCE_ORGANISMS.map((o) => o.code[0]));

      // Should have at least 3 different families
      expect(families.size).toBeGreaterThanOrEqual(3);

      // Should include core families
      const familyArray = Array.from(families);
      expect(familyArray).toContain("O"); // Orbidae
      expect(familyArray).toContain("S"); // Scutidae
    });

    it("should allow lookup by code", () => {
      const orbium = getOrganismByCode("O2u");

      expect(orbium).toBeDefined();
      expect(orbium!.name).toBe("Orbium unicaudatus");
      expect(orbium!.params.R).toBe(13);
    });

    it("should filter by family", () => {
      const orbidae = getOrganismsByFamily("O");
      const scutidae = getOrganismsByFamily("S");

      expect(orbidae.length).toBeGreaterThan(0);
      expect(scutidae.length).toBeGreaterThan(0);

      // All filtered should start with family prefix
      orbidae.forEach((o) => expect(o.code.startsWith("O")).toBe(true));
      scutidae.forEach((o) => expect(o.code.startsWith("S")).toBe(true));
    });

    it("family descriptions should be complete", () => {
      Object.entries(ORGANISM_FAMILIES).forEach(([key, family]) => {
        expect(family.name).toBeDefined();
        expect(family.description).toBeDefined();
        expect(family.name.length).toBeGreaterThan(0);
        expect(family.description.length).toBeGreaterThan(0);
      });
    });
  });

  describe("Full import workflow", () => {
    it("should import and convert Orbium correctly", () => {
      const refOrbium = getOrganismByCode("O2u")!;

      // Import to Genesis format
      const pattern = importReferenceOrganism(refOrbium);

      // Verify structure
      expect(pattern.name).toBe("Orbium unicaudatus");
      expect(pattern.width).toBe(128);
      expect(pattern.height).toBe(128);
      expect(pattern.cells.length).toBe(128 * 128);

      // Verify genome conversion
      expect(pattern.genome.R).toBe(13);
      expect(pattern.genome.T).toBe(10);
      expect(pattern.genome.m).toBe(0.15);
      expect(pattern.genome.s).toBe(0.015);

      // Verify pattern has content (non-zero mass)
      const mass = pattern.cells.reduce((a, b) => a + b, 0);
      expect(mass).toBeGreaterThan(50);
    });

    it("should import organisms with fractional beta values", () => {
      const kronium = getOrganismByCode("K4s");

      if (kronium) {
        const pattern = importReferenceOrganism(kronium);

        // K4s has b: "1,1/3" which should become [1, 0.333...]
        expect(pattern.genome.b.length).toBe(2);
        expect(pattern.genome.b[0]).toBe(1);
        expect(pattern.genome.b[1]).toBeCloseTo(1 / 3, 5);
      }
    });

    it("should handle various grid sizes", () => {
      const orbium = getOrganismByCode("O2u")!;

      const small = importReferenceOrganism(orbium, 64);
      const medium = importReferenceOrganism(orbium, 128);
      const large = importReferenceOrganism(orbium, 256);

      expect(small.cells.length).toBe(64 * 64);
      expect(medium.cells.length).toBe(128 * 128);
      expect(large.cells.length).toBe(256 * 256);

      // All should have content
      expect(small.cells.reduce((a, b) => a + b, 0)).toBeGreaterThan(0);
      expect(medium.cells.reduce((a, b) => a + b, 0)).toBeGreaterThan(0);
      expect(large.cells.reduce((a, b) => a + b, 0)).toBeGreaterThan(0);
    });

    it("should import all reference organisms without errors", () => {
      REFERENCE_ORGANISMS.forEach((ref) => {
        expect(() => {
          const pattern = importReferenceOrganism(ref);

          // Basic validation
          expect(pattern.cells.length).toBeGreaterThan(0);
          expect(pattern.genome.R).toBeGreaterThan(0);
        }).not.toThrow();
      });
    });
  });

  describe("RLE decoding validation", () => {
    it("should infer correct dimensions for all reference organisms", () => {
      REFERENCE_ORGANISMS.forEach((ref) => {
        const [width, height] = inferDimensionsFromRLE(ref.cells);

        expect(width).toBeGreaterThan(0);
        expect(height).toBeGreaterThan(0);
        expect(width).toBeLessThan(200); // Reasonable upper bound
        expect(height).toBeLessThan(200);
      });
    });

    it("should decode to centered patterns", () => {
      const orbium = getOrganismByCode("O2u")!;
      const result = decodeReferenceRLE(orbium.cells, 128, 128);

      // Calculate center of mass
      let totalMass = 0;
      let comX = 0;
      let comY = 0;

      for (let y = 0; y < 128; y++) {
        for (let x = 0; x < 128; x++) {
          const val = result.cells[y * 128 + x];
          totalMass += val;
          comX += x * val;
          comY += y * val;
        }
      }

      comX /= totalMass;
      comY /= totalMass;

      // Center of mass should be near grid center
      expect(comX).toBeGreaterThan(32);
      expect(comX).toBeLessThan(96);
      expect(comY).toBeGreaterThan(32);
      expect(comY).toBeLessThan(96);
    });
  });

  describe("Parameter compatibility", () => {
    it("imported organisms should have engine-compatible params", () => {
      REFERENCE_ORGANISMS.forEach((ref) => {
        const pattern = importReferenceOrganism(ref);
        const params = organismToParams({
          name: ref.name,
          description: ref.cname || "",
          category: "glider",
          genome: pattern.genome,
        });

        // All params should be valid numbers
        expect(isNaN(params.kernelRadius)).toBe(false);
        expect(isNaN(params.growthCenter)).toBe(false);
        expect(isNaN(params.growthWidth)).toBe(false);
        expect(isNaN(params.dt)).toBe(false);

        // dt should be derived from T correctly
        expect(params.dt).toBeCloseTo(1 / pattern.genome.T);
      });
    });

    it("reference organism params should be in stable ranges", () => {
      REFERENCE_ORGANISMS.forEach((ref) => {
        // Based on CLAUDE.md stable parameters
        expect(ref.params.R).toBeGreaterThanOrEqual(8);
        expect(ref.params.R).toBeLessThanOrEqual(30);
        expect(ref.params.m).toBeGreaterThan(0);
        expect(ref.params.m).toBeLessThan(1);
        expect(ref.params.s).toBeGreaterThan(0);
        expect(ref.params.s).toBeLessThan(0.2);
      });
    });
  });

  describe("Genesis library compatibility", () => {
    it("imported patterns should match Genesis organism format", () => {
      const orbium = getOrganismByCode("O2u")!;
      const imported = importReferenceOrganism(orbium);

      // Should match LeniaPattern interface
      expect(typeof imported.name).toBe("string");
      expect(imported.cells).toBeInstanceOf(Float32Array);
      expect(typeof imported.width).toBe("number");
      expect(typeof imported.height).toBe("number");
      expect(imported.genome).toBeDefined();
      expect(imported.genome.R).toBeDefined();
      expect(imported.genome.T).toBeDefined();
      expect(imported.genome.m).toBeDefined();
      expect(imported.genome.s).toBeDefined();
      expect(Array.isArray(imported.genome.b)).toBe(true);
    });

    it("reference organisms should complement existing library", () => {
      // Genesis library has its own organisms
      const genesisNames = ALL_ORGANISMS.map((o) => o.name.toLowerCase());

      // Reference organisms should add variety
      const refNames = REFERENCE_ORGANISMS.map((o) => o.name.toLowerCase());

      // Should have some new unique names
      const newNames = refNames.filter((n) => !genesisNames.includes(n));
      expect(newNames.length).toBeGreaterThan(0);
    });
  });
});
