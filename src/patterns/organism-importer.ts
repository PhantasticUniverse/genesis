/**
 * Organism Importer
 * Imports organisms from the reference Lenia project's animals.json format
 */

import type { LeniaGenome } from "../discovery/genome";
import type { LeniaPattern } from "../utils/rle";

/**
 * Reference format organism entry (from animals.json)
 */
export interface ReferenceOrganism {
  code: string;
  name: string;
  cname?: string; // Chinese/Japanese name
  params: {
    R: number;
    T: number;
    b: string | number[]; // Can be "1" or [1, 0.5, ...]
    m: number;
    s: number;
    kn?: number;
    gn?: number;
  };
  cells: string; // RLE-encoded pattern
}

/**
 * Character set for RLE decoding (base64-like)
 * Values 0-63 map to characters
 */
const RLE_DECODE_MAP: { [key: string]: number } = {};

// Build decode map: A=10, B=11, ..., Z=35, a=36, ..., z=61, +=62, /=63
// But in Lenia's RLE: A=1/64, B=2/64, etc. (normalized to 0-1)
// Actually the Lenia format uses: characters encode cell intensity levels
// The pattern "7.MD6.qL" means: 7 dead, M, D, 6 dead, q, L
// Where . represents empty/dead cells

const VALUE_CHARS =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
for (let i = 0; i < VALUE_CHARS.length; i++) {
  // Map to values 1-64 (0 is dead, represented by .)
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
 * Calculate pattern dimensions from RLE string
 * Returns [width, height]
 */
export function inferDimensionsFromRLE(rle: string): [number, number] {
  let maxWidth = 0;
  let currentWidth = 0;
  let height = 1;

  let i = 0;
  while (i < rle.length) {
    const char = rle[i];

    if (char === "!") {
      break;
    }

    if (char === "$") {
      // End of row
      maxWidth = Math.max(maxWidth, currentWidth);
      currentWidth = 0;
      height++;
      i++;
      continue;
    }

    // Check for run count
    const [count, newPos] = parseRunCount(rle, i);
    if (newPos > i) {
      // Had a number, next char is the value
      i = newPos;
      currentWidth += count;
      i++; // skip the value char
    } else {
      // Single cell
      if (char !== ".") {
        currentWidth++;
      } else {
        currentWidth++;
      }
      i++;
    }
  }

  // Final row width
  maxWidth = Math.max(maxWidth, currentWidth);

  return [maxWidth, height];
}

/**
 * Decode RLE pattern from reference format
 * The format uses:
 * - . for dead cells (value 0)
 * - A-Za-z0-9+/ for values 1/64 to 64/64
 * - Numbers prefix for run length
 * - $ for row terminator
 * - ! for pattern end
 */
export function decodeReferenceRLE(
  rle: string,
  targetWidth?: number,
  targetHeight?: number,
): {
  cells: Float32Array;
  width: number;
  height: number;
} {
  // Infer dimensions if not provided
  const [inferredWidth, inferredHeight] = inferDimensionsFromRLE(rle);
  const width = targetWidth || Math.max(inferredWidth, 64);
  const height = targetHeight || Math.max(inferredHeight, 64);

  // Center the pattern in the grid
  const offsetX = Math.floor((width - inferredWidth) / 2);
  const offsetY = Math.floor((height - inferredHeight) / 2);

  const cells = new Float32Array(width * height);
  let x = 0;
  let y = 0;

  let i = 0;
  while (i < rle.length) {
    const char = rle[i];

    if (char === "!") {
      break;
    }

    if (char === "$") {
      // End of row
      y++;
      x = 0;
      i++;
      continue;
    }

    // Check for run count
    const [count, newPos] = parseRunCount(rle, i);
    i = newPos;

    // Get the value character
    const valueChar = rle[i];
    i++;

    if (!valueChar || valueChar === "!") {
      break;
    }

    // Decode value
    let value = 0;
    if (valueChar === ".") {
      value = 0; // dead cell
    } else if (valueChar in RLE_DECODE_MAP) {
      value = RLE_DECODE_MAP[valueChar];
    }

    // Fill cells
    for (let j = 0; j < count && x < width; j++) {
      const gridX = x + offsetX;
      const gridY = y + offsetY;

      if (gridX >= 0 && gridX < width && gridY >= 0 && gridY < height) {
        cells[gridY * width + gridX] = value;
      }
      x++;
    }
  }

  return { cells, width, height };
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
 * Can be "1", "1,0.5", "1,1/3", or [1, 0.5]
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
 * Convert reference organism to Genesis LeniaPattern
 */
export function importReferenceOrganism(
  organism: ReferenceOrganism,
  gridSize: number = 128,
): LeniaPattern {
  const { cells, width, height } = decodeReferenceRLE(
    organism.cells,
    gridSize,
    gridSize,
  );

  const genome: LeniaGenome = {
    R: organism.params.R || 13,
    T: organism.params.T || 10,
    m: organism.params.m || 0.15,
    s: organism.params.s || 0.015,
    b: parseBetaValues(organism.params.b),
    kn: (organism.params.kn || 1) as 1 | 2 | 3 | 4,
    gn: (organism.params.gn || 1) as 1 | 2 | 3,
  };

  return {
    cells,
    width,
    height,
    genome,
    name: organism.name,
    description: organism.cname || organism.code,
  };
}

/**
 * Filter organisms by category (prefix codes)
 * O = Orbidae, G = Geminidae, etc.
 */
export function filterByCategory(
  organisms: ReferenceOrganism[],
  prefix: string,
): ReferenceOrganism[] {
  return organisms.filter(
    (o) => o.code.startsWith(prefix) && !o.code.startsWith(">"),
  );
}

/**
 * Get unique organisms (skip taxonomic headers)
 */
export function getOrganisms(data: ReferenceOrganism[]): ReferenceOrganism[] {
  return data.filter((o) => !o.code.startsWith(">"));
}

/**
 * Taxonomic categories in the reference data
 */
export const CATEGORIES = {
  O: "Orbidae (spherical gliders)",
  G: "Geminidae (twin-lobed)",
  P: "Paronitidae (multi-lobed)",
  S: "Scintillidae (oscillators)",
  R: "Rotatoridae (rotating)",
  T: "Triculidae (three-lobed)",
  L: "Lunatidae (crescent)",
  K: "Keridae (complex)",
} as const;
