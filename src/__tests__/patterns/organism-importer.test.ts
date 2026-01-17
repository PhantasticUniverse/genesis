/**
 * Tests for organism importer
 */

import { describe, it, expect } from "vitest";
import {
  decodeReferenceRLE,
  inferDimensionsFromRLE,
  importReferenceOrganism,
} from "../../patterns/organism-importer";
import { REFERENCE_ORGANISMS } from "../../patterns/reference-organisms";

describe("organism-importer", () => {
  describe("inferDimensionsFromRLE", () => {
    it("should infer dimensions from simple RLE", () => {
      const rle = "ABC$DEF$GHI!";
      const [width, height] = inferDimensionsFromRLE(rle);
      expect(width).toBe(3);
      expect(height).toBe(3);
    });

    it("should handle run counts", () => {
      const rle = "5.AB$3.CD!";
      const [width, height] = inferDimensionsFromRLE(rle);
      expect(width).toBe(7); // 5 dots + 2 chars
      expect(height).toBe(2);
    });

    it("should handle complex Orbium RLE", () => {
      const orbiumRLE = REFERENCE_ORGANISMS[0].cells;
      const [width, height] = inferDimensionsFromRLE(orbiumRLE);
      expect(width).toBeGreaterThan(10);
      expect(height).toBeGreaterThan(10);
    });
  });

  describe("decodeReferenceRLE", () => {
    it("should decode simple pattern", () => {
      const rle = "ABC!";
      const result = decodeReferenceRLE(rle, 64, 64);

      expect(result.width).toBe(64);
      expect(result.height).toBe(64);
      expect(result.cells.length).toBe(64 * 64);

      // Should have some non-zero values
      const sum = result.cells.reduce((a, b) => a + b, 0);
      expect(sum).toBeGreaterThan(0);
    });

    it("should decode Orbium pattern", () => {
      const orbium = REFERENCE_ORGANISMS[0];
      const result = decodeReferenceRLE(orbium.cells, 128, 128);

      expect(result.width).toBe(128);
      expect(result.height).toBe(128);

      // Orbium should have significant mass
      const mass = result.cells.reduce((a, b) => a + b, 0);
      expect(mass).toBeGreaterThan(50);
    });

    it("should center pattern in grid", () => {
      const rle = "yO!"; // Single max-value cell
      const result = decodeReferenceRLE(rle, 64, 64);

      // The cell should be near the center - check a region around center
      let foundNearCenter = false;
      for (let y = 28; y < 36; y++) {
        for (let x = 28; x < 36; x++) {
          if (result.cells[y * 64 + x] > 0) {
            foundNearCenter = true;
            break;
          }
        }
        if (foundNearCenter) break;
      }
      expect(foundNearCenter).toBe(true);
    });

    it("should handle row terminators", () => {
      const rle = "A$A$A!"; // 3 rows
      const result = decodeReferenceRLE(rle, 64, 64);

      const sum = result.cells.reduce((a, b) => a + b, 0);
      expect(sum).toBeGreaterThan(0);
    });

    it("should handle dead cells with dots", () => {
      const rle = "3.A!"; // 3 dead cells, then A
      const result = decodeReferenceRLE(rle, 64, 64);

      // First cells in pattern should be 0
      // Only the 4th position should have a value
      const sum = result.cells.reduce((a, b) => a + b, 0);
      expect(sum).toBeGreaterThan(0);
    });
  });

  describe("importReferenceOrganism", () => {
    it("should import Orbium correctly", () => {
      const orbium = REFERENCE_ORGANISMS[0];
      const pattern = importReferenceOrganism(orbium);

      expect(pattern.name).toBe("Orbium unicaudatus");
      expect(pattern.genome.R).toBe(13);
      expect(pattern.genome.m).toBe(0.15);
      expect(pattern.genome.s).toBe(0.015);
      expect(pattern.cells.length).toBe(128 * 128);
    });

    it("should parse beta values from string", () => {
      const organism = REFERENCE_ORGANISMS.find((o) => o.code === "K4s");
      if (organism) {
        const pattern = importReferenceOrganism(organism);
        expect(pattern.genome.b).toEqual([1, 1 / 3]);
      }
    });

    it("should handle custom grid size", () => {
      const orbium = REFERENCE_ORGANISMS[0];
      const pattern = importReferenceOrganism(orbium, 256);

      expect(pattern.width).toBe(256);
      expect(pattern.height).toBe(256);
      expect(pattern.cells.length).toBe(256 * 256);
    });
  });

  describe("REFERENCE_ORGANISMS", () => {
    it("should have at least 10 organisms", () => {
      expect(REFERENCE_ORGANISMS.length).toBeGreaterThanOrEqual(10);
    });

    it("should have organisms from different families", () => {
      const families = new Set(REFERENCE_ORGANISMS.map((o) => o.code[0]));
      expect(families.size).toBeGreaterThanOrEqual(3);
    });

    it("all organisms should have valid params", () => {
      for (const org of REFERENCE_ORGANISMS) {
        expect(org.params.R).toBeGreaterThan(0);
        expect(org.params.T).toBeGreaterThan(0);
        expect(org.params.m).toBeGreaterThan(0);
        expect(org.params.s).toBeGreaterThan(0);
        expect(org.cells).toBeTruthy();
      }
    });
  });
});
