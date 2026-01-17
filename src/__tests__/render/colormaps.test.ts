/**
 * Colormap Tests
 * Tests for CA visualization color functions
 */

import { describe, it, expect } from "vitest";
import {
  grayscale,
  classic,
  viridis,
  plasma,
  inferno,
  magma,
  ocean,
  fire,
  rainbow,
  twilight,
  turbo,
  neon,
  earth,
  COLORMAPS,
  DEFAULT_COLORMAP,
  generateColormapLUT,
  rgbToCSS,
  colormapToGradientCSS,
  type RGB,
} from "../../render/colormaps";

describe("colormaps", () => {
  describe("grayscale", () => {
    it("returns black for value 0", () => {
      const color = grayscale(0);
      expect(color).toEqual({ r: 0, g: 0, b: 0 });
    });

    it("returns white for value 1", () => {
      const color = grayscale(1);
      expect(color).toEqual({ r: 255, g: 255, b: 255 });
    });

    it("returns gray for value 0.5", () => {
      const color = grayscale(0.5);
      expect(color.r).toBeCloseTo(128, 0);
      expect(color.r).toBe(color.g);
      expect(color.g).toBe(color.b);
    });

    it("clamps values below 0", () => {
      const color = grayscale(-0.5);
      expect(color).toEqual({ r: 0, g: 0, b: 0 });
    });

    it("clamps values above 1", () => {
      const color = grayscale(1.5);
      expect(color).toEqual({ r: 255, g: 255, b: 255 });
    });
  });

  describe("classic", () => {
    it("returns black for value 0", () => {
      const color = classic(0);
      expect(color).toEqual({ r: 0, g: 0, b: 0 });
    });

    it("returns green-ish for value 1", () => {
      const color = classic(1);
      expect(color.g).toBe(255);
      expect(color.r).toBeLessThan(color.g);
      expect(color.b).toBeLessThan(color.g);
    });

    it("has green as dominant channel", () => {
      const color = classic(0.5);
      expect(color.g).toBeGreaterThan(color.r);
      expect(color.g).toBeGreaterThan(color.b);
    });
  });

  describe("gradient colormaps", () => {
    const gradientMaps = {
      viridis,
      plasma,
      inferno,
      magma,
      ocean,
      fire,
      rainbow,
      twilight,
      turbo,
      neon,
      earth,
    };

    for (const [name, colormap] of Object.entries(gradientMaps)) {
      describe(name, () => {
        it("returns valid RGB at value 0", () => {
          const color = colormap(0);
          expect(color.r).toBeGreaterThanOrEqual(0);
          expect(color.r).toBeLessThanOrEqual(255);
          expect(color.g).toBeGreaterThanOrEqual(0);
          expect(color.g).toBeLessThanOrEqual(255);
          expect(color.b).toBeGreaterThanOrEqual(0);
          expect(color.b).toBeLessThanOrEqual(255);
        });

        it("returns valid RGB at value 1", () => {
          const color = colormap(1);
          expect(color.r).toBeGreaterThanOrEqual(0);
          expect(color.r).toBeLessThanOrEqual(255);
          expect(color.g).toBeGreaterThanOrEqual(0);
          expect(color.g).toBeLessThanOrEqual(255);
          expect(color.b).toBeGreaterThanOrEqual(0);
          expect(color.b).toBeLessThanOrEqual(255);
        });

        it("interpolates smoothly across range", () => {
          const colors: RGB[] = [];
          for (let i = 0; i <= 10; i++) {
            colors.push(colormap(i / 10));
          }

          // Check that colors change (not all the same)
          let colorChanges = 0;
          for (let i = 1; i < colors.length; i++) {
            if (
              colors[i].r !== colors[i - 1].r ||
              colors[i].g !== colors[i - 1].g ||
              colors[i].b !== colors[i - 1].b
            ) {
              colorChanges++;
            }
          }
          expect(colorChanges).toBeGreaterThan(5);
        });

        it("clamps values outside 0-1 range", () => {
          const negColor = colormap(-0.5);
          const zeroColor = colormap(0);
          expect(negColor).toEqual(zeroColor);

          const overColor = colormap(1.5);
          const oneColor = colormap(1);
          expect(overColor).toEqual(oneColor);
        });
      });
    }
  });

  describe("twilight (cyclic)", () => {
    it("starts and ends at same color", () => {
      const start = twilight(0);
      const end = twilight(1);

      expect(start.r).toBeCloseTo(end.r, 0);
      expect(start.g).toBeCloseTo(end.g, 0);
      expect(start.b).toBeCloseTo(end.b, 0);
    });
  });

  describe("COLORMAPS registry", () => {
    it("contains all expected colormaps", () => {
      expect(COLORMAPS.grayscale).toBeDefined();
      expect(COLORMAPS.classic).toBeDefined();
      expect(COLORMAPS.viridis).toBeDefined();
      expect(COLORMAPS.plasma).toBeDefined();
      expect(COLORMAPS.inferno).toBeDefined();
      expect(COLORMAPS.magma).toBeDefined();
      expect(COLORMAPS.ocean).toBeDefined();
      expect(COLORMAPS.fire).toBeDefined();
      expect(COLORMAPS.rainbow).toBeDefined();
      expect(COLORMAPS.twilight).toBeDefined();
      expect(COLORMAPS.turbo).toBeDefined();
      expect(COLORMAPS.neon).toBeDefined();
      expect(COLORMAPS.earth).toBeDefined();
    });

    it("each entry has name and function", () => {
      for (const [key, value] of Object.entries(COLORMAPS)) {
        expect(value.name).toBeDefined();
        expect(typeof value.name).toBe("string");
        expect(value.fn).toBeDefined();
        expect(typeof value.fn).toBe("function");
      }
    });

    it("all colormap functions work correctly", () => {
      for (const [key, value] of Object.entries(COLORMAPS)) {
        const color = value.fn(0.5);
        expect(color.r).toBeGreaterThanOrEqual(0);
        expect(color.r).toBeLessThanOrEqual(255);
      }
    });
  });

  describe("DEFAULT_COLORMAP", () => {
    it("is viridis", () => {
      expect(DEFAULT_COLORMAP).toBe("viridis");
    });

    it("exists in COLORMAPS", () => {
      expect(COLORMAPS[DEFAULT_COLORMAP]).toBeDefined();
    });
  });

  describe("generateColormapLUT", () => {
    it("generates 256 RGBA entries", () => {
      const lut = generateColormapLUT(grayscale);
      expect(lut.length).toBe(256 * 4);
    });

    it("first entry matches colormap(0)", () => {
      const lut = generateColormapLUT(viridis);
      const firstColor = viridis(0);

      expect(lut[0]).toBe(firstColor.r);
      expect(lut[1]).toBe(firstColor.g);
      expect(lut[2]).toBe(firstColor.b);
      expect(lut[3]).toBe(255); // Alpha
    });

    it("last entry matches colormap(1)", () => {
      const lut = generateColormapLUT(viridis);
      const lastColor = viridis(1);
      const lastIndex = 255 * 4;

      expect(lut[lastIndex + 0]).toBe(lastColor.r);
      expect(lut[lastIndex + 1]).toBe(lastColor.g);
      expect(lut[lastIndex + 2]).toBe(lastColor.b);
      expect(lut[lastIndex + 3]).toBe(255); // Alpha
    });

    it("middle entry matches colormap(0.5)", () => {
      const lut = generateColormapLUT(grayscale);
      const midColor = grayscale(128 / 255);
      const midIndex = 128 * 4;

      expect(lut[midIndex + 0]).toBe(midColor.r);
      expect(lut[midIndex + 1]).toBe(midColor.g);
      expect(lut[midIndex + 2]).toBe(midColor.b);
    });

    it("all alpha values are 255", () => {
      const lut = generateColormapLUT(plasma);
      for (let i = 0; i < 256; i++) {
        expect(lut[i * 4 + 3]).toBe(255);
      }
    });
  });

  describe("rgbToCSS", () => {
    it("converts RGB to CSS string", () => {
      const color: RGB = { r: 255, g: 128, b: 0 };
      expect(rgbToCSS(color)).toBe("rgb(255, 128, 0)");
    });

    it("handles black", () => {
      expect(rgbToCSS({ r: 0, g: 0, b: 0 })).toBe("rgb(0, 0, 0)");
    });

    it("handles white", () => {
      expect(rgbToCSS({ r: 255, g: 255, b: 255 })).toBe("rgb(255, 255, 255)");
    });
  });

  describe("colormapToGradientCSS", () => {
    it("generates linear-gradient CSS", () => {
      const css = colormapToGradientCSS(grayscale);
      expect(css.startsWith("linear-gradient(to right,")).toBe(true);
    });

    it("contains color stops with percentages", () => {
      const css = colormapToGradientCSS(grayscale, 10);

      expect(css.includes("0%")).toBe(true);
      expect(css.includes("100%")).toBe(true);
      expect(css.includes("50%")).toBe(true);
    });

    it("respects custom step count", () => {
      const fewSteps = colormapToGradientCSS(grayscale, 2);
      const manySteps = colormapToGradientCSS(grayscale, 20);

      // More steps = more commas in the result
      const fewCommas = (fewSteps.match(/,/g) || []).length;
      const manyCommas = (manySteps.match(/,/g) || []).length;

      expect(manyCommas).toBeGreaterThan(fewCommas);
    });

    it("starts with black for grayscale", () => {
      const css = colormapToGradientCSS(grayscale);
      expect(css.includes("rgb(0, 0, 0) 0%")).toBe(true);
    });

    it("ends with white for grayscale", () => {
      const css = colormapToGradientCSS(grayscale);
      expect(css.includes("rgb(255, 255, 255) 100%")).toBe(true);
    });
  });
});
