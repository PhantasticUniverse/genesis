/**
 * Pattern Encoding Utilities
 * RLE, Base64, and procedural pattern encoding/decoding
 */

import type { PatternData } from "./preset-types";

// ============================================================================
// RLE Encoding (Run-Length Encoding)
// Compatible with Golly/Life pattern format
// ============================================================================

/**
 * Encode a 2D state array to RLE format
 */
export function encodeRLE(
  state: Float32Array,
  width: number,
  height: number,
  threshold = 0.5,
): string {
  const lines: string[] = [];

  for (let y = 0; y < height; y++) {
    let line = "";
    let runValue = -1;
    let runLength = 0;

    for (let x = 0; x < width; x++) {
      const value = state[y * width + x] >= threshold ? 1 : 0;

      if (value === runValue) {
        runLength++;
      } else {
        if (runLength > 0) {
          line += runToRLE(runValue, runLength);
        }
        runValue = value;
        runLength = 1;
      }
    }

    // Emit final run
    if (runLength > 0) {
      line += runToRLE(runValue, runLength);
    }

    // Trim trailing dead cells
    line = line.replace(/b+$/, "");

    lines.push(line);
  }

  // Remove trailing empty lines
  while (lines.length > 0 && lines[lines.length - 1] === "") {
    lines.pop();
  }

  return lines.join("$") + "!";
}

/**
 * Convert a run to RLE notation
 */
function runToRLE(value: number, length: number): string {
  const char = value === 1 ? "o" : "b";
  if (length === 1) {
    return char;
  }
  return `${length}${char}`;
}

/**
 * Decode RLE format to a 2D state array
 */
export function decodeRLE(
  rle: string,
  width: number,
  height: number,
): Float32Array {
  const state = new Float32Array(width * height);

  // Remove header comments and whitespace
  let pattern = rle.replace(/^#.*$/gm, "").replace(/\s+/g, "");

  // Remove trailing !
  if (pattern.endsWith("!")) {
    pattern = pattern.slice(0, -1);
  }

  let x = 0;
  let y = 0;
  let count = 0;

  for (const char of pattern) {
    if (char >= "0" && char <= "9") {
      count = count * 10 + parseInt(char);
    } else if (char === "b" || char === ".") {
      // Dead cell
      const n = count === 0 ? 1 : count;
      x += n;
      count = 0;
    } else if (char === "o" || char === "O" || char === "*") {
      // Live cell
      const n = count === 0 ? 1 : count;
      for (let i = 0; i < n && x < width; i++) {
        if (y < height) {
          state[y * width + x] = 1.0;
        }
        x++;
      }
      count = 0;
    } else if (char === "$") {
      // End of row
      const n = count === 0 ? 1 : count;
      y += n;
      x = 0;
      count = 0;
    }
  }

  return state;
}

/**
 * Parse RLE header to get dimensions
 */
export function parseRLEHeader(
  rle: string,
): { width: number; height: number } | null {
  const match = rle.match(/x\s*=\s*(\d+)\s*,\s*y\s*=\s*(\d+)/i);
  if (match) {
    return {
      width: parseInt(match[1]),
      height: parseInt(match[2]),
    };
  }
  return null;
}

// ============================================================================
// Base64 Encoding
// ============================================================================

/**
 * Encode state to Base64
 */
export function encodeBase64(state: Float32Array, compress = false): string {
  const bytes = new Uint8Array(state.buffer);

  if (compress) {
    // Simple run-length compression for repeated values
    const compressed = compressBytes(bytes);
    return btoa(String.fromCharCode(...compressed));
  }

  return btoa(String.fromCharCode(...bytes));
}

/**
 * Decode Base64 to state
 */
export function decodeBase64(
  encoded: string,
  compressed = false,
): Float32Array {
  const binaryString = atob(encoded);
  let bytes = new Uint8Array(binaryString.length);

  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  if (compressed) {
    bytes = decompressBytes(bytes);
  }

  return new Float32Array(bytes.buffer);
}

/**
 * Simple RLE compression for bytes
 */
function compressBytes(bytes: Uint8Array): Uint8Array {
  const result: number[] = [];
  let i = 0;

  while (i < bytes.length) {
    let runLength = 1;
    const value = bytes[i];

    while (
      i + runLength < bytes.length &&
      bytes[i + runLength] === value &&
      runLength < 255
    ) {
      runLength++;
    }

    if (runLength >= 4) {
      // Use RLE: 0xFF marker, length, value
      result.push(0xff, runLength, value);
    } else {
      // Store raw bytes
      for (let j = 0; j < runLength; j++) {
        if (value === 0xff) {
          result.push(0xff, 1, value); // Escape 0xFF
        } else {
          result.push(value);
        }
      }
    }

    i += runLength;
  }

  return new Uint8Array(result);
}

/**
 * Decompress RLE bytes
 */
function decompressBytes(bytes: Uint8Array): Uint8Array {
  const result: number[] = [];
  let i = 0;

  while (i < bytes.length) {
    if (bytes[i] === 0xff && i + 2 < bytes.length) {
      const length = bytes[i + 1];
      const value = bytes[i + 2];
      for (let j = 0; j < length; j++) {
        result.push(value);
      }
      i += 3;
    } else {
      result.push(bytes[i]);
      i++;
    }
  }

  return new Uint8Array(result);
}

// ============================================================================
// Procedural Pattern Generators
// ============================================================================

/**
 * Pattern generator types
 */
export type GeneratorType =
  | "gaussian-blob"
  | "ring"
  | "noise"
  | "gradient"
  | "custom";

/**
 * Generator parameters
 */
export interface GeneratorParams {
  type: GeneratorType;
  params: Record<string, number>;
  seed?: number;
}

/**
 * Generate a pattern procedurally
 */
export function generatePattern(
  generator: GeneratorParams,
  width: number,
  height: number,
): Float32Array {
  const state = new Float32Array(width * height);
  const centerX = width / 2;
  const centerY = height / 2;

  // Simple seeded RNG
  let seed = generator.seed ?? Date.now();
  const random = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };

  switch (generator.type) {
    case "gaussian-blob": {
      const radius = generator.params.radius ?? Math.min(width, height) / 4;
      const sigma = generator.params.sigma ?? radius / 3;
      const offsetX = generator.params.offsetX ?? 0;
      const offsetY = generator.params.offsetY ?? 0;

      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const dx = x - centerX - offsetX;
          const dy = y - centerY - offsetY;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const value = Math.exp(-(dist * dist) / (2 * sigma * sigma));
          state[y * width + x] = value;
        }
      }
      break;
    }

    case "ring": {
      const innerRadius =
        generator.params.innerRadius ?? Math.min(width, height) / 6;
      const outerRadius =
        generator.params.outerRadius ?? Math.min(width, height) / 4;

      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const dx = x - centerX;
          const dy = y - centerY;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist >= innerRadius && dist <= outerRadius) {
            const ringWidth = outerRadius - innerRadius;
            const distFromRingCenter = Math.abs(
              dist - (innerRadius + outerRadius) / 2,
            );
            const value = 1 - distFromRingCenter / (ringWidth / 2);
            state[y * width + x] = Math.max(0, value);
          }
        }
      }
      break;
    }

    case "noise": {
      const scale = generator.params.scale ?? 0.5;
      const threshold = generator.params.threshold ?? 0.5;

      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const value = random() * scale;
          state[y * width + x] = value > threshold * scale ? value : 0;
        }
      }
      break;
    }

    case "gradient": {
      const direction = generator.params.direction ?? 0; // 0=horizontal, 1=vertical, 2=radial
      const reverse = generator.params.reverse ?? 0;

      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          let value: number;

          if (direction === 0) {
            value = x / width;
          } else if (direction === 1) {
            value = y / height;
          } else {
            const dx = x - centerX;
            const dy = y - centerY;
            const maxDist = Math.sqrt(centerX * centerX + centerY * centerY);
            value = 1 - Math.sqrt(dx * dx + dy * dy) / maxDist;
          }

          if (reverse) {
            value = 1 - value;
          }

          state[y * width + x] = value;
        }
      }
      break;
    }

    default:
      // Unknown generator, return empty state
      break;
  }

  return state;
}

// ============================================================================
// Pattern Data Utilities
// ============================================================================

/**
 * Create PatternData from a Float32Array
 */
export function createPatternData(
  state: Float32Array,
  width: number,
  height: number,
  format: "rle" | "base64" = "base64",
  compress = true,
): PatternData {
  const patternData: PatternData = {
    format,
    width,
    height,
  };

  if (format === "rle") {
    patternData.rle = encodeRLE(state, width, height);
  } else {
    patternData.base64 = encodeBase64(state, compress);
    if (compress) {
      patternData.compression = "gzip";
    }
  }

  return patternData;
}

/**
 * Extract state from PatternData
 */
export function extractPatternState(data: PatternData): Float32Array {
  const { width, height } = data;

  if (data.format === "rle" && data.rle) {
    return decodeRLE(data.rle, width, height);
  }

  if (data.format === "base64" && data.base64) {
    return decodeBase64(data.base64, data.compression === "gzip");
  }

  if (data.format === "cells" && data.cells) {
    const state = new Float32Array(width * height);
    for (const cell of data.cells) {
      if (cell.x >= 0 && cell.x < width && cell.y >= 0 && cell.y < height) {
        state[cell.y * width + cell.x] = cell.value;
      }
    }
    return state;
  }

  if (data.format === "generator" && data.generator) {
    return generatePattern(
      {
        type: data.generator.type as GeneratorType,
        params: data.generator.params,
        seed: data.generator.seed,
      },
      width,
      height,
    );
  }

  // Return empty state
  return new Float32Array(width * height);
}

/**
 * Estimate pattern complexity
 */
export function estimateComplexity(
  state: Float32Array,
  width: number,
  height: number,
): number {
  let nonZero = 0;
  let transitions = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const value = state[y * width + x];
      if (value > 0) nonZero++;

      // Count horizontal transitions
      if (x < width - 1) {
        const next = state[y * width + x + 1];
        if (value > 0 !== next > 0) transitions++;
      }

      // Count vertical transitions
      if (y < height - 1) {
        const below = state[(y + 1) * width + x];
        if (value > 0 !== below > 0) transitions++;
      }
    }
  }

  const density = nonZero / (width * height);
  const edgeDensity = transitions / (width * height * 2);

  // Complexity is a combination of density and edge density
  return density * 0.5 + edgeDensity * 0.5;
}
