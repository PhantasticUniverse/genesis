/**
 * Tests for 3D Organism Importer
 * Tests the RLE decoder and import functionality for 3D Lenia organisms
 */

import { describe, it, expect } from "vitest";
import {
  decode3DRLE,
  inferDimensions3D,
  importReferenceOrganism3D,
  filterByCategory3D,
  getOrganisms3D,
  CATEGORIES_3D,
  type ReferenceOrganism3D,
} from "../../patterns/organism-importer-3d";
import {
  REFERENCE_3D_ORGANISMS,
  getAllReference3DOrganisms,
  getReference3DOrganismByCode,
  getReference3DOrganismsByFamily,
  FAMILY_3D_DESCRIPTIONS,
} from "../../patterns/reference-organisms-3d";

describe("3D Organism Importer", () => {
  describe("inferDimensions3D", () => {
    it("should infer dimensions from simple 3D RLE", () => {
      // 2x2x2 cube
      const rle = "AB$CD%EF$GH";
      const [width, height, depth] = inferDimensions3D(rle);

      expect(width).toBeGreaterThan(0);
      expect(height).toBeGreaterThan(0);
      expect(depth).toBe(2); // Two layers separated by %
    });

    it("should handle multiple layers", () => {
      const rle = "A$B$C%D$E$F%G$H$I";
      const [, , depth] = inferDimensions3D(rle);

      expect(depth).toBe(3); // Three layers
    });

    it("should handle run-length encoded values", () => {
      const rle = "5A$3B%2C$4D";
      const [width, height, depth] = inferDimensions3D(rle);

      expect(width).toBe(5); // 5A is the widest row
      expect(height).toBe(2); // 2 rows per layer
      expect(depth).toBe(2);
    });

    it("should handle empty layers", () => {
      const rle = "A%B%C";
      const [width, height, depth] = inferDimensions3D(rle);

      expect(depth).toBe(3);
      expect(width).toBe(1);
      expect(height).toBe(1);
    });

    it("should handle pattern terminator", () => {
      const rle = "AB$CD%EF!";
      const [, , depth] = inferDimensions3D(rle);

      expect(depth).toBe(2);
    });
  });

  describe("decode3DRLE", () => {
    it("should decode simple pattern", () => {
      const rle = "A";
      const result = decode3DRLE(rle, 8, 8, 8);

      expect(result.width).toBe(8);
      expect(result.height).toBe(8);
      expect(result.depth).toBe(8);
      expect(result.cells.length).toBe(8 * 8 * 8);
    });

    it("should decode dead cells as zeros", () => {
      const rle = ".%.%.";
      const result = decode3DRLE(rle, 4, 4, 4);

      // All cells should be close to 0
      let sum = 0;
      for (let i = 0; i < result.cells.length; i++) {
        sum += result.cells[i];
      }
      expect(sum).toBe(0);
    });

    it("should decode value characters correctly", () => {
      // 'A' should decode to 1/64, 'z' should decode to 62/64
      const rle = "A";
      const result = decode3DRLE(rle, 4, 4, 4);

      // Find non-zero cells
      let nonZeroCount = 0;
      let totalValue = 0;
      for (let i = 0; i < result.cells.length; i++) {
        if (result.cells[i] > 0) {
          nonZeroCount++;
          totalValue += result.cells[i];
        }
      }

      expect(nonZeroCount).toBeGreaterThan(0);
      // 'A' = 1/64 ≈ 0.0156
      expect(totalValue / nonZeroCount).toBeCloseTo(1 / 64, 2);
    });

    it("should handle run-length encoding", () => {
      const rle = "3A";
      const result = decode3DRLE(rle, 8, 8, 8);

      // Should have 3 consecutive cells with value
      let consecutiveNonZero = 0;
      for (let i = 0; i < result.cells.length; i++) {
        if (result.cells[i] > 0) {
          consecutiveNonZero++;
        }
      }

      expect(consecutiveNonZero).toBe(3);
    });

    it("should handle row terminator $", () => {
      const rle = "A$A$A";
      const result = decode3DRLE(rle, 8, 8, 8);

      // Should have values on 3 different rows
      let nonZeroCount = 0;
      for (let i = 0; i < result.cells.length; i++) {
        if (result.cells[i] > 0) {
          nonZeroCount++;
        }
      }

      expect(nonZeroCount).toBe(3);
    });

    it("should handle layer terminator %", () => {
      const rle = "A%A%A";
      const result = decode3DRLE(rle, 8, 8, 8);

      // Should have values on 3 different layers
      const layersWithValues = new Set<number>();
      const { width, height, depth, cells } = result;

      for (let z = 0; z < depth; z++) {
        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            const idx = z * width * height + y * width + x;
            if (cells[idx] > 0) {
              layersWithValues.add(z);
            }
          }
        }
      }

      expect(layersWithValues.size).toBe(3);
    });

    it("should center pattern in grid", () => {
      const rle = "A";
      const result = decode3DRLE(rle, 16, 16, 16);

      // Pattern should be roughly centered
      const { width, height, depth, cells } = result;
      let sumX = 0,
        sumY = 0,
        sumZ = 0,
        count = 0;

      for (let z = 0; z < depth; z++) {
        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            const idx = z * width * height + y * width + x;
            if (cells[idx] > 0) {
              sumX += x;
              sumY += y;
              sumZ += z;
              count++;
            }
          }
        }
      }

      if (count > 0) {
        const avgX = sumX / count;
        const avgY = sumY / count;
        const avgZ = sumZ / count;

        // Should be roughly centered (within 3 cells of center)
        expect(Math.abs(avgX - width / 2)).toBeLessThan(width / 3);
        expect(Math.abs(avgY - height / 2)).toBeLessThan(height / 3);
        expect(Math.abs(avgZ - depth / 2)).toBeLessThan(depth / 3);
      }
    });
  });

  describe("importReferenceOrganism3D", () => {
    const sampleOrganism: ReferenceOrganism3D = {
      code: "Test1",
      name: "Test Organism",
      params: {
        R: 10,
        T: 8,
        b: "1,0.5",
        m: 0.15,
        s: 0.02,
        kn: 1,
        gn: 1,
      },
      cells: "A$B%C$D",
    };

    it("should import organism with correct name", () => {
      const imported = importReferenceOrganism3D(sampleOrganism, 16);

      expect(imported.name).toBe("Test Organism");
    });

    it("should import organism with correct dimensions", () => {
      const imported = importReferenceOrganism3D(sampleOrganism, 32);

      expect(imported.width).toBe(32);
      expect(imported.height).toBe(32);
      expect(imported.depth).toBe(32);
    });

    it("should parse Lenia parameters correctly", () => {
      const imported = importReferenceOrganism3D(sampleOrganism, 16);

      expect(imported.params.kernelRadius).toBe(10);
      expect(imported.params.growthCenter).toBe(0.15);
      expect(imported.params.growthWidth).toBe(0.02);
      expect(imported.params.dt).toBeCloseTo(1 / 8, 5);
    });

    it("should handle fraction beta values", () => {
      const organismWithFractions: ReferenceOrganism3D = {
        code: "Test2",
        name: "Fraction Test",
        params: {
          R: 12,
          T: 10,
          b: "1/3,2/3,1",
          m: 0.2,
          s: 0.03,
        },
        cells: "A",
      };

      const imported = importReferenceOrganism3D(organismWithFractions, 16);

      // Should parse without error
      expect(imported.name).toBe("Fraction Test");
      expect(imported.params.kernelRadius).toBe(12);
    });

    it("should handle array beta values", () => {
      const organismWithArray: ReferenceOrganism3D = {
        code: "Test3",
        name: "Array Test",
        params: {
          R: 8,
          T: 10,
          b: [1, 0.5, 0.25],
          m: 0.18,
          s: 0.025,
        },
        cells: "A",
      };

      const imported = importReferenceOrganism3D(organismWithArray, 16);

      expect(imported.name).toBe("Array Test");
      expect(imported.params.kernelRadius).toBe(8);
    });

    it("should use cname as description when available", () => {
      const organismWithCname: ReferenceOrganism3D = {
        code: "Test4",
        name: "Named Organism",
        cname: "Japanese/Chinese Name",
        params: {
          R: 10,
          T: 10,
          b: "1",
          m: 0.15,
          s: 0.02,
        },
        cells: "A",
      };

      const imported = importReferenceOrganism3D(organismWithCname, 16);

      expect(imported.description).toBe("Japanese/Chinese Name");
    });

    it("should use code as description when cname not available", () => {
      const imported = importReferenceOrganism3D(sampleOrganism, 16);

      expect(imported.description).toBe("Test1");
    });
  });

  describe("filterByCategory3D", () => {
    const testOrganisms: ReferenceOrganism3D[] = [
      {
        code: "Gu1",
        name: "Guttidae 1",
        params: { R: 10, T: 10, b: "1", m: 0.15, s: 0.02 },
        cells: "A",
      },
      {
        code: "Sp1",
        name: "Sphaeridae 1",
        params: { R: 12, T: 10, b: "1", m: 0.14, s: 0.016 },
        cells: "A",
      },
      {
        code: ">1",
        name: "Header",
        params: { R: 10, T: 10, b: "1", m: 0.15, s: 0.02 },
        cells: "",
      },
      {
        code: "Gu2",
        name: "Guttidae 2",
        params: { R: 10, T: 10, b: "1", m: 0.12, s: 0.01 },
        cells: "A",
      },
    ];

    it("should filter by prefix", () => {
      const guttidae = filterByCategory3D(testOrganisms, "Gu");

      expect(guttidae.length).toBe(2);
      expect(guttidae[0].code).toBe("Gu1");
      expect(guttidae[1].code).toBe("Gu2");
    });

    it("should exclude taxonomy headers", () => {
      const all = filterByCategory3D(testOrganisms, ">");

      // Headers start with > but filterByCategory excludes them
      expect(all.length).toBe(0);
    });
  });

  describe("getOrganisms3D", () => {
    const testData: ReferenceOrganism3D[] = [
      {
        code: ">1",
        name: "Taxonomy Header",
        params: { R: 10, T: 10, b: "1", m: 0.15, s: 0.02 },
        cells: "",
      },
      {
        code: "Org1",
        name: "Organism 1",
        params: { R: 10, T: 10, b: "1", m: 0.15, s: 0.02 },
        cells: "A",
      },
      {
        code: ">2",
        name: "Another Header",
        params: { R: 10, T: 10, b: "1", m: 0.15, s: 0.02 },
        cells: "",
      },
    ];

    it("should filter out taxonomy headers", () => {
      const organisms = getOrganisms3D(testData);

      expect(organisms.length).toBe(1);
      expect(organisms[0].code).toBe("Org1");
    });
  });

  describe("CATEGORIES_3D", () => {
    it("should have expected categories", () => {
      expect(CATEGORIES_3D.Gu).toBeDefined();
      expect(CATEGORIES_3D.Sp).toBeDefined();
      expect(CATEGORIES_3D.Ov).toBeDefined();
      expect(CATEGORIES_3D.Pl).toBeDefined();
    });

    it("categories should have descriptive names", () => {
      expect(CATEGORIES_3D.Gu).toContain("droplet");
      expect(CATEGORIES_3D.Sp).toContain("sphere");
    });
  });
});

describe("Reference 3D Organisms Library", () => {
  describe("REFERENCE_3D_ORGANISMS", () => {
    it("should have organisms from multiple families", () => {
      const families = new Set<string>();

      for (const org of REFERENCE_3D_ORGANISMS) {
        // Extract 2-letter family code
        const match = org.code.match(/[A-Z][a-z]/);
        if (match) {
          families.add(match[0]);
        }
      }

      expect(families.size).toBeGreaterThanOrEqual(4);
    });

    it("all organisms should have valid params", () => {
      for (const org of REFERENCE_3D_ORGANISMS) {
        expect(org.params.R).toBeGreaterThan(0);
        expect(org.params.T).toBeGreaterThan(0);
        expect(org.params.m).toBeGreaterThan(0);
        expect(org.params.s).toBeGreaterThan(0);
        expect(org.params.b).toBeDefined();
      }
    });

    it("all organisms should have cell data", () => {
      for (const org of REFERENCE_3D_ORGANISMS) {
        expect(org.cells).toBeDefined();
        expect(org.cells.length).toBeGreaterThan(0);
      }
    });

    it("all organisms should have names", () => {
      for (const org of REFERENCE_3D_ORGANISMS) {
        expect(org.name).toBeDefined();
        expect(org.name.length).toBeGreaterThan(0);
      }
    });
  });

  describe("getAllReference3DOrganisms", () => {
    it("should return all organisms", () => {
      const all = getAllReference3DOrganisms();

      expect(all.length).toBe(REFERENCE_3D_ORGANISMS.length);
      expect(all.length).toBeGreaterThan(5);
    });
  });

  describe("getReference3DOrganismByCode", () => {
    it("should find organism by exact code", () => {
      const organism = getReference3DOrganismByCode("1Sp1l");

      expect(organism).toBeDefined();
      expect(organism?.name).toBe("Sphaerome lithos");
    });

    it("should return undefined for unknown code", () => {
      const organism = getReference3DOrganismByCode("UNKNOWN");

      expect(organism).toBeUndefined();
    });
  });

  describe("getReference3DOrganismsByFamily", () => {
    it("should find Guttidae organisms", () => {
      const guttidae = getReference3DOrganismsByFamily("Gu");

      expect(guttidae.length).toBeGreaterThan(0);
      for (const org of guttidae) {
        expect(org.code).toContain("Gu");
      }
    });

    it("should find Sphaeridae organisms", () => {
      const sphaeridae = getReference3DOrganismsByFamily("Sp");

      expect(sphaeridae.length).toBeGreaterThan(0);
    });
  });

  describe("FAMILY_3D_DESCRIPTIONS", () => {
    it("should have descriptions for major families", () => {
      expect(FAMILY_3D_DESCRIPTIONS.Gu).toBeDefined();
      expect(FAMILY_3D_DESCRIPTIONS.Sp).toBeDefined();
      expect(FAMILY_3D_DESCRIPTIONS.Ov).toBeDefined();
      expect(FAMILY_3D_DESCRIPTIONS.Pl).toBeDefined();
      expect(FAMILY_3D_DESCRIPTIONS.As).toBeDefined();
    });
  });

  describe("Import real reference organisms", () => {
    it("should successfully import Diguttome saliens", () => {
      const organism = getReference3DOrganismByCode("4Gu2s");
      expect(organism).toBeDefined();

      const imported = importReferenceOrganism3D(organism!, 32);

      expect(imported.name).toBe("Diguttome saliens");
      expect(imported.width).toBe(32);
      expect(imported.height).toBe(32);
      expect(imported.depth).toBe(32);
      expect(imported.cells.length).toBe(32 * 32 * 32);

      // Should have non-zero cells
      let hasNonZero = false;
      for (let i = 0; i < imported.cells.length; i++) {
        if (imported.cells[i] > 0) {
          hasNonZero = true;
          break;
        }
      }
      expect(hasNonZero).toBe(true);
    });

    it("should successfully import Sphaerome lithos", () => {
      const organism = getReference3DOrganismByCode("1Sp1l");
      expect(organism).toBeDefined();

      const imported = importReferenceOrganism3D(organism!, 32);

      expect(imported.name).toBe("Sphaerome lithos");
      expect(imported.params.kernelRadius).toBe(12);
      expect(imported.params.growthCenter).toBe(0.14);
    });

    it("should successfully import all reference organisms", () => {
      const all = getAllReference3DOrganisms();

      for (const org of all) {
        expect(() => {
          const imported = importReferenceOrganism3D(org, 32);
          expect(imported.cells.length).toBe(32 * 32 * 32);
        }).not.toThrow();
      }
    });
  });
});
