/**
 * 3D Organism Importer
 * Imports 3D organisms from reference Lenia project's animals3D.json format
 * Key difference from 2D: uses '%' as layer separator
 */

import type { Lenia3DParams, Grid3DConfig } from "../core/types-3d";

/**
 * Reference format 3D organism entry (from animals3D.json)
 */
export interface ReferenceOrganism3D {
  code: string;
  name: string;
  cname?: string; // Chinese/Japanese name
  params: {
    R: number;
    T: number;
    b: string | number[]; // Can be "1", "1,0.5", "2/3,1,5/6", or [1, 0.5, ...]
    m: number;
    s: number;
    kn?: number;
    gn?: number;
  };
  cells: string; // 3D RLE-encoded pattern with % as layer separator
}

/**
 * Imported 3D pattern
 */
export interface Imported3DPattern {
  name: string;
  description: string;
  cells: Float32Array;
  width: number;
  height: number;
  depth: number;
  params: Lenia3DParams;
}

/**
 * Character set for RLE decoding
 * A=1/64, B=2/64, ..., z=62/64, etc.
 */
const RLE_DECODE_MAP: { [key: string]: number } = {};
const VALUE_CHARS =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
for (let i = 0; i < VALUE_CHARS.length; i++) {
  RLE_DECODE_MAP[VALUE_CHARS[i]] = (i + 1) / 64;
}

/**
 * Parse run count from string starting at position
 * Returns [count, endPosition]
 */
function parseRunCount(rle: string, startPos: number): [number, number] {
  let count = 0;
  let pos = startPos;

  while (pos < rle.length) {
    const char = rle[pos];
    if (char >= "0" && char <= "9") {
      count = count * 10 + parseInt(char, 10);
      pos++;
    } else {
      break;
    }
  }

  return [count || 1, pos];
}

/**
 * Infer 3D dimensions from RLE string
 * Returns [width, height, depth]
 */
export function inferDimensions3D(rle: string): [number, number, number] {
  const layers = rle.split("%");
  const depth = layers.length;

  let maxWidth = 0;
  let maxHeight = 0;

  for (const layer of layers) {
    if (layer.includes("!")) {
      // Remove everything after !
      const cleanLayer = layer.split("!")[0];
      const [w, h] = inferLayerDimensions(cleanLayer);
      maxWidth = Math.max(maxWidth, w);
      maxHeight = Math.max(maxHeight, h);
    } else {
      const [w, h] = inferLayerDimensions(layer);
      maxWidth = Math.max(maxWidth, w);
      maxHeight = Math.max(maxHeight, h);
    }
  }

  return [maxWidth, maxHeight, depth];
}

/**
 * Infer dimensions of a single 2D layer
 */
function inferLayerDimensions(layerRle: string): [number, number] {
  let maxWidth = 0;
  let currentWidth = 0;
  let height = 1;

  let i = 0;
  while (i < layerRle.length) {
    const char = layerRle[i];

    if (char === "!" || char === "%") {
      break;
    }

    if (char === "$") {
      maxWidth = Math.max(maxWidth, currentWidth);
      currentWidth = 0;
      height++;
      i++;
      continue;
    }

    const [count, newPos] = parseRunCount(layerRle, i);
    if (newPos > i) {
      i = newPos;
      currentWidth += count;
      i++; // skip the value char
    } else {
      currentWidth++;
      i++;
    }
  }

  maxWidth = Math.max(maxWidth, currentWidth);
  return [maxWidth, height];
}

/**
 * Decode 3D RLE pattern
 * Format uses:
 * - . for dead cells (value 0)
 * - A-Za-z0-9+/ for values 1/64 to 64/64
 * - Numbers prefix for run length
 * - $ for row terminator (end of X row)
 * - % for layer terminator (end of Y layer, start next Z layer)
 * - ! for pattern end
 */
export function decode3DRLE(
  rle: string,
  targetWidth?: number,
  targetHeight?: number,
  targetDepth?: number,
): {
  cells: Float32Array;
  width: number;
  height: number;
  depth: number;
} {
  // Infer dimensions if not provided
  const [inferredWidth, inferredHeight, inferredDepth] = inferDimensions3D(rle);
  const width = targetWidth || Math.max(inferredWidth + 4, 16);
  const height = targetHeight || Math.max(inferredHeight + 4, 16);
  const depth = targetDepth || Math.max(inferredDepth + 4, 16);

  // Center the pattern in the grid
  const offsetX = Math.floor((width - inferredWidth) / 2);
  const offsetY = Math.floor((height - inferredHeight) / 2);
  const offsetZ = Math.floor((depth - inferredDepth) / 2);

  const cells = new Float32Array(width * height * depth);

  // Split into layers
  const layers = rle.split("%");

  for (let z = 0; z < layers.length && z + offsetZ < depth; z++) {
    const layerRle = layers[z];
    let x = 0;
    let y = 0;

    let i = 0;
    while (i < layerRle.length) {
      const char = layerRle[i];

      if (char === "!" || char === "%") {
        break;
      }

      if (char === "$") {
        y++;
        x = 0;
        i++;
        continue;
      }

      const [count, newPos] = parseRunCount(layerRle, i);
      i = newPos;

      const valueChar = layerRle[i];
      i++;

      if (!valueChar || valueChar === "!" || valueChar === "%") {
        break;
      }

      // Decode value
      let value = 0;
      if (valueChar === ".") {
        value = 0;
      } else if (valueChar in RLE_DECODE_MAP) {
        value = RLE_DECODE_MAP[valueChar];
      }

      // Fill cells
      for (let j = 0; j < count && x < width; j++) {
        const gridX = x + offsetX;
        const gridY = y + offsetY;
        const gridZ = z + offsetZ;

        if (
          gridX >= 0 &&
          gridX < width &&
          gridY >= 0 &&
          gridY < height &&
          gridZ >= 0 &&
          gridZ < depth
        ) {
          const index = gridZ * width * height + gridY * width + gridX;
          cells[index] = value;
        }
        x++;
      }
    }
  }

  return { cells, width, height, depth };
}

/**
 * Parse a single value that might be a fraction like "1/3"
 */
function parseFractionOrNumber(s: string): number {
  const trimmed = s.trim();
  if (trimmed.includes("/")) {
    const [num, den] = trimmed.split("/").map((v) => parseFloat(v.trim()));
    if (den && !isNaN(num) && !isNaN(den)) {
      return num / den;
    }
    return 1;
  }
  const val = parseFloat(trimmed);
  return isNaN(val) ? 1 : val;
}

/**
 * Parse beta values from reference format
 * Can be "1", "1,0.5", "1,1/3", "2/3,1,5/6", or [1, 0.5]
 */
function parseBetaValues(b: string | number[]): number[] {
  if (Array.isArray(b)) {
    return b;
  }
  if (typeof b === "string") {
    return b.split(",").map(parseFractionOrNumber);
  }
  return [1];
}

/**
 * Import a 3D reference organism into Genesis format
 */
export function importReferenceOrganism3D(
  organism: ReferenceOrganism3D,
  gridSize: number = 32,
): Imported3DPattern {
  const { cells, width, height, depth } = decode3DRLE(
    organism.cells,
    gridSize,
    gridSize,
    gridSize,
  );

  const params: Lenia3DParams = {
    kernelRadius: organism.params.R || 13,
    growthCenter: organism.params.m || 0.15,
    growthWidth: organism.params.s || 0.015,
    dt: 1 / (organism.params.T || 10),
  };

  return {
    name: organism.name,
    description: organism.cname || organism.code,
    cells,
    width,
    height,
    depth,
    params,
  };
}

/**
 * Filter organisms by category prefix
 */
export function filterByCategory3D(
  organisms: ReferenceOrganism3D[],
  prefix: string,
): ReferenceOrganism3D[] {
  return organisms.filter(
    (o) => o.code.startsWith(prefix) && !o.code.startsWith(">"),
  );
}

/**
 * Get unique organisms (skip taxonomy headers)
 */
export function getOrganisms3D(
  data: ReferenceOrganism3D[],
): ReferenceOrganism3D[] {
  return data.filter((o) => !o.code.startsWith(">") && o.params);
}

/**
 * 3D Taxonomic categories in the reference data
 */
export const CATEGORIES_3D = {
  Gu: "Guttidae (droplet-shaped)",
  Sp: "Sphaeridae (spheres)",
  Ov: "Ovidae (ovoid/egg-shaped)",
  Me: "Membranidae (membrane structures)",
  Pl: "Platidae (plate/flat structures)",
  Cy: "Cylindridae (cylindrical)",
  St: "Stellidae (star-shaped)",
} as const;
