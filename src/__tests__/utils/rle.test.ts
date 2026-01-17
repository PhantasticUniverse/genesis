/**
 * RLE Encoding/Decoding Tests
 * Tests for Run-Length Encoding of Lenia patterns
 */

import { describe, it, expect } from "vitest";
import {
  encodeCellsRLE,
  decodeCellsRLE,
  encodeParams,
  decodeParams,
  encodeLeniaPattern,
  decodeLeniaPattern,
  patternToURLParam,
  urlParamToPattern,
  exportToJSON,
  importFromJSON,
  compressPattern,
  decompressPattern,
  type LeniaPattern,
} from "../../utils/rle";
import type { LeniaGenome } from "../../discovery/genome";

describe("RLE encoding/decoding", () => {
  describe("encodeCellsRLE / decodeCellsRLE", () => {
    it("round-trips empty grid", () => {
      const width = 10;
      const height = 10;
      const cells = new Float32Array(width * height);

      const encoded = encodeCellsRLE(cells, width, height);
      const decoded = decodeCellsRLE(encoded, width, height);

      // All zeros should round-trip
      expect(decoded.length).toBe(cells.length);
      decoded.forEach((val) => expect(val).toBe(0));
    });

    it("round-trips single cell", () => {
      const width = 5;
      const height = 5;
      const cells = new Float32Array(width * height);
      cells[12] = 1; // Center cell

      const encoded = encodeCellsRLE(cells, width, height);
      const decoded = decodeCellsRLE(encoded, width, height);

      expect(decoded[12]).toBeCloseTo(1, 1);

      // Other cells should be 0
      for (let i = 0; i < decoded.length; i++) {
        if (i !== 12) {
          expect(decoded[i]).toBe(0);
        }
      }
    });

    it("round-trips row of cells", () => {
      const width = 10;
      const height = 5;
      const cells = new Float32Array(width * height);

      // Fill middle row
      for (let x = 0; x < width; x++) {
        cells[2 * width + x] = 0.5;
      }

      const encoded = encodeCellsRLE(cells, width, height);
      const decoded = decodeCellsRLE(encoded, width, height);

      // Middle row should have values
      for (let x = 0; x < width; x++) {
        expect(decoded[2 * width + x]).toBeCloseTo(0.5, 1);
      }
    });

    it("handles varying cell values", () => {
      const width = 5;
      const height = 1;
      const cells = new Float32Array(width * height);
      cells[0] = 0.0;
      cells[1] = 0.25;
      cells[2] = 0.5;
      cells[3] = 0.75;
      cells[4] = 1.0;

      const encoded = encodeCellsRLE(cells, width, height);
      const decoded = decodeCellsRLE(encoded, width, height);

      // Values are quantized to 64 levels, so tolerance needed
      expect(decoded[0]).toBeCloseTo(0.0, 1);
      expect(decoded[1]).toBeCloseTo(0.25, 1);
      expect(decoded[2]).toBeCloseTo(0.5, 1);
      expect(decoded[3]).toBeCloseTo(0.75, 1);
      expect(decoded[4]).toBeCloseTo(1.0, 1);
    });

    it("compresses runs of same value", () => {
      const width = 100;
      const height = 1;
      const cells = new Float32Array(width * height);
      cells.fill(0.5);

      const encoded = encodeCellsRLE(cells, width, height);

      // Should be much shorter than 100 characters
      expect(encoded.length).toBeLessThan(20);
    });

    it("ends with pattern terminator", () => {
      const cells = new Float32Array(25);
      const encoded = encodeCellsRLE(cells, 5, 5);
      expect(encoded.endsWith("!")).toBe(true);
    });

    it("handles row separators", () => {
      const cells = new Float32Array(4);
      cells[0] = 1;
      cells[2] = 1; // Row 2

      const encoded = encodeCellsRLE(cells, 2, 2);
      expect(encoded.includes("$")).toBe(true);
    });
  });

  describe("encodeParams / decodeParams", () => {
    it("round-trips genome parameters", () => {
      const genome: LeniaGenome = {
        R: 15,
        T: 10,
        m: 0.12,
        s: 0.04,
        b: [0.3, 0.6],
        kn: 2,
        gn: 3,
      };

      const encoded = encodeParams(genome);
      const decoded = decodeParams(encoded);

      expect(decoded.R).toBe(15);
      expect(decoded.T).toBe(10);
      expect(decoded.m).toBeCloseTo(0.12, 2);
      expect(decoded.s).toBeCloseTo(0.04, 2);
      expect(decoded.b.length).toBe(2);
      expect(decoded.b[0]).toBeCloseTo(0.3, 1);
      expect(decoded.b[1]).toBeCloseTo(0.6, 1);
    });

    it("uses defaults for missing values", () => {
      const decoded = decodeParams(";;");

      expect(decoded.R).toBe(13);
      expect(decoded.T).toBe(10);
      expect(decoded.m).toBe(0.15);
      expect(decoded.s).toBe(0.015);
    });

    it("handles single peak", () => {
      const genome: LeniaGenome = {
        R: 13,
        T: 10,
        m: 0.15,
        s: 0.015,
        b: [0.5],
        kn: 1,
        gn: 1,
      };

      const decoded = decodeParams(encodeParams(genome));
      expect(decoded.b.length).toBe(1);
      expect(decoded.b[0]).toBeCloseTo(0.5, 1);
    });

    it("handles multiple peaks", () => {
      const genome: LeniaGenome = {
        R: 13,
        T: 10,
        m: 0.15,
        s: 0.015,
        b: [0.2, 0.4, 0.6, 0.8],
        kn: 1,
        gn: 1,
      };

      const decoded = decodeParams(encodeParams(genome));
      expect(decoded.b.length).toBe(4);
    });
  });

  describe("encodeLeniaPattern / decodeLeniaPattern", () => {
    it("round-trips full pattern", () => {
      const pattern: LeniaPattern = {
        cells: new Float32Array(100),
        width: 10,
        height: 10,
        genome: {
          R: 15,
          T: 10,
          m: 0.12,
          s: 0.04,
          b: [0.5],
          kn: 1,
          gn: 2,
        },
      };
      pattern.cells[55] = 0.8;

      const encoded = encodeLeniaPattern(pattern);
      const decoded = decodeLeniaPattern(encoded);

      expect(decoded.width).toBe(10);
      expect(decoded.height).toBe(10);
      expect(decoded.cells.length).toBe(100);
      expect(decoded.cells[55]).toBeCloseTo(0.8, 1);
      expect(decoded.genome.R).toBe(15);
    });

    it("throws on invalid format", () => {
      expect(() => decodeLeniaPattern("invalid")).toThrow(
        "Invalid Lenia pattern format",
      );
    });

    it("encodes with header format", () => {
      const pattern: LeniaPattern = {
        cells: new Float32Array(25),
        width: 5,
        height: 5,
        genome: {
          R: 13,
          T: 10,
          m: 0.15,
          s: 0.015,
          b: [1],
          kn: 1,
          gn: 1,
        },
      };

      const encoded = encodeLeniaPattern(pattern);
      expect(encoded.startsWith("5,5#")).toBe(true);
    });
  });

  describe("patternToURLParam / urlParamToPattern", () => {
    it("round-trips pattern through URL encoding", () => {
      const pattern: LeniaPattern = {
        cells: new Float32Array(64),
        width: 8,
        height: 8,
        genome: {
          R: 13,
          T: 10,
          m: 0.15,
          s: 0.015,
          b: [0.5],
          kn: 1,
          gn: 1,
        },
      };
      pattern.cells[27] = 0.7;

      const urlParam = patternToURLParam(pattern);
      const decoded = urlParamToPattern(urlParam);

      expect(decoded.width).toBe(8);
      expect(decoded.height).toBe(8);
      expect(decoded.cells[27]).toBeCloseTo(0.7, 1);
    });

    it("produces valid base64", () => {
      const pattern: LeniaPattern = {
        cells: new Float32Array(16),
        width: 4,
        height: 4,
        genome: {
          R: 13,
          T: 10,
          m: 0.15,
          s: 0.015,
          b: [1],
          kn: 1,
          gn: 1,
        },
      };

      const urlParam = patternToURLParam(pattern);

      // Should be valid base64
      expect(() => atob(urlParam)).not.toThrow();
    });
  });

  describe("exportToJSON / importFromJSON", () => {
    it("round-trips pattern metadata through JSON", () => {
      const pattern: LeniaPattern = {
        cells: new Float32Array(64),
        width: 8,
        height: 8,
        genome: {
          R: 15,
          T: 12,
          m: 0.12,
          s: 0.04,
          b: [0.3, 0.7],
          kn: 2,
          gn: 3,
        },
        name: "Test Pattern",
        description: "A test organism",
        author: "GENESIS",
      };

      const json = exportToJSON(pattern);
      const imported = importFromJSON(json);

      expect(imported.name).toBe("Test Pattern");
      expect(imported.description).toBe("A test organism");
      expect(imported.author).toBe("GENESIS");
      expect(imported.width).toBe(8);
      expect(imported.height).toBe(8);
      expect(imported.genome.R).toBe(15);
      expect(imported.genome.T).toBe(12);
      expect(imported.genome.m).toBeCloseTo(0.12, 2);
      expect(imported.genome.s).toBeCloseTo(0.04, 2);
      expect(imported.genome.b.length).toBe(2);
    });

    it("produces valid JSON", () => {
      const pattern: LeniaPattern = {
        cells: new Float32Array(16),
        width: 4,
        height: 4,
        genome: {
          R: 13,
          T: 10,
          m: 0.15,
          s: 0.015,
          b: [1],
          kn: 1,
          gn: 1,
        },
      };

      const json = exportToJSON(pattern);

      // Should parse without error
      expect(() => JSON.parse(json)).not.toThrow();
    });

    it("handles missing optional fields on import", () => {
      const json = JSON.stringify({
        params: { R: 13, T: 10, m: 0.15, s: 0.015, b: [1] },
        cells: { width: 8, height: 8 },
      });

      const imported = importFromJSON(json);

      expect(imported.name).toBeUndefined();
      expect(imported.description).toBeUndefined();
      expect(imported.cells.length).toBe(64);
    });

    it("uses defaults for missing params", () => {
      const json = JSON.stringify({
        cells: { width: 8, height: 8 },
      });

      const imported = importFromJSON(json);

      expect(imported.genome.R).toBe(13);
      expect(imported.genome.T).toBe(10);
    });
  });

  describe("compressPattern / decompressPattern", () => {
    it("round-trips pattern data", () => {
      const cells = new Float32Array(100);
      cells[25] = 0.3;
      cells[50] = 0.6;
      cells[75] = 0.9;

      const compressed = compressPattern(cells);
      const decompressed = decompressPattern(compressed, cells.length);

      // 8-bit quantization causes some loss
      expect(decompressed[25]).toBeCloseTo(0.3, 1);
      expect(decompressed[50]).toBeCloseTo(0.6, 1);
      expect(decompressed[75]).toBeCloseTo(0.9, 1);
    });

    it("handles zeros", () => {
      const cells = new Float32Array(100);
      // All zeros

      const compressed = compressPattern(cells);
      const decompressed = decompressPattern(compressed, cells.length);

      decompressed.forEach((val) => expect(val).toBe(0));
    });

    it("handles full ones", () => {
      const cells = new Float32Array(100);
      cells.fill(1);

      const compressed = compressPattern(cells);
      const decompressed = decompressPattern(compressed, cells.length);

      decompressed.forEach((val) => expect(val).toBeCloseTo(1, 1));
    });

    it("clamps values to 0-1 range", () => {
      const cells = new Float32Array(5);
      cells[0] = -0.5; // Below 0
      cells[1] = 0;
      cells[2] = 0.5;
      cells[3] = 1;
      cells[4] = 1.5; // Above 1

      const compressed = compressPattern(cells);
      const decompressed = decompressPattern(compressed, cells.length);

      expect(decompressed[0]).toBe(0); // Clamped to 0
      expect(decompressed[4]).toBeCloseTo(1, 1); // Clamped to 1
    });

    it("produces base64 output", () => {
      const cells = new Float32Array(100);
      cells.fill(0.5);

      const compressed = compressPattern(cells);

      // Should be valid base64
      expect(() => atob(compressed)).not.toThrow();
    });
  });
});
