/**
 * RLE (Run-Length Encoding) for Lenia Patterns
 * Compatible with Lenia Zoo format
 *
 * Format: cells_rle$code_rle
 * - cells_rle: Standard Golly RLE format for pattern
 * - code_rle: Parameter encoding (R,T,m,s,b)
 */

import type { LeniaGenome } from '../discovery/genome';

export interface LeniaPattern {
  // Pattern data
  cells: Float32Array;
  width: number;
  height: number;

  // Lenia parameters
  genome: LeniaGenome;

  // Metadata
  name?: string;
  description?: string;
  author?: string;
}

/**
 * Standard Golly RLE format characters
 */
const RLE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/**
 * Encode a floating-point value (0-1) to base64-like character
 */
function encodeValue(value: number): string {
  const v = Math.max(0, Math.min(1, value));
  const idx = Math.round(v * 63);
  return RLE_CHARS[idx];
}

/**
 * Decode a base64-like character to floating-point value (0-1)
 */
function decodeValue(char: string): number {
  const idx = RLE_CHARS.indexOf(char);
  if (idx === -1) return 0;
  return idx / 63;
}

/**
 * Encode cells using RLE
 * Groups consecutive cells with same value
 */
export function encodeCellsRLE(cells: Float32Array, width: number, height: number): string {
  const result: string[] = [];
  let runLength = 0;
  let lastValue = -1;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      const value = Math.round(cells[idx] * 63);

      if (value === lastValue) {
        runLength++;
      } else {
        if (runLength > 0) {
          if (runLength > 1) {
            result.push(runLength.toString());
          }
          if (lastValue === 0) {
            result.push('b'); // dead/background
          } else {
            result.push(RLE_CHARS[lastValue]);
          }
        }
        lastValue = value;
        runLength = 1;
      }
    }

    // End of row
    if (runLength > 0 && lastValue !== 0) {
      if (runLength > 1) {
        result.push(runLength.toString());
      }
      result.push(RLE_CHARS[lastValue]);
    }

    // Row terminator (except last row)
    if (y < height - 1) {
      result.push('$');
    }
    runLength = 0;
    lastValue = -1;
  }

  // Pattern terminator
  result.push('!');

  return result.join('');
}

/**
 * Decode RLE to cells
 */
export function decodeCellsRLE(rle: string, width: number, height: number): Float32Array {
  const cells = new Float32Array(width * height);
  let x = 0;
  let y = 0;
  let runLength = 0;

  for (let i = 0; i < rle.length; i++) {
    const char = rle[i];

    if (char === '!') {
      break; // End of pattern
    }

    if (char === '$') {
      // End of row
      y++;
      x = 0;
      runLength = 0;
      continue;
    }

    if (char >= '0' && char <= '9') {
      // Run length
      runLength = runLength * 10 + parseInt(char, 10);
      continue;
    }

    // Cell value
    const count = runLength || 1;
    runLength = 0;

    let value = 0;
    if (char === 'b' || char === '.') {
      value = 0; // dead
    } else if (char === 'o') {
      value = 1; // alive (binary)
    } else {
      value = decodeValue(char);
    }

    for (let j = 0; j < count && x < width; j++) {
      if (y < height) {
        cells[y * width + x] = value;
      }
      x++;
    }
  }

  return cells;
}

/**
 * Encode Lenia parameters to compact string
 */
export function encodeParams(genome: LeniaGenome): string {
  const parts = [
    genome.R.toString(),
    genome.T.toString(),
    genome.m.toFixed(3),
    genome.s.toFixed(3),
    genome.b.map(v => v.toFixed(2)).join(','),
  ];
  return parts.join(';');
}

/**
 * Decode Lenia parameters from string
 */
export function decodeParams(paramStr: string): LeniaGenome {
  const parts = paramStr.split(';');
  return {
    R: parseInt(parts[0], 10) || 13,
    T: parseInt(parts[1], 10) || 10,
    m: parseFloat(parts[2]) || 0.15,
    s: parseFloat(parts[3]) || 0.015,
    b: parts[4]?.split(',').map(v => parseFloat(v) || 1) || [1],
    kn: 1,
    gn: 1,
  };
}

/**
 * Encode full Lenia pattern (cells + parameters)
 */
export function encodeLeniaPattern(pattern: LeniaPattern): string {
  const cellsRLE = encodeCellsRLE(pattern.cells, pattern.width, pattern.height);
  const paramsStr = encodeParams(pattern.genome);

  // Format: width,height#cells_rle#params
  const header = `${pattern.width},${pattern.height}`;
  return `${header}#${cellsRLE}#${paramsStr}`;
}

/**
 * Decode full Lenia pattern
 */
export function decodeLeniaPattern(encoded: string): LeniaPattern {
  const parts = encoded.split('#');

  if (parts.length < 3) {
    throw new Error('Invalid Lenia pattern format');
  }

  const [sizeStr, cellsRLE, paramsStr] = parts;
  const [width, height] = sizeStr.split(',').map(v => parseInt(v, 10));

  const cells = decodeCellsRLE(cellsRLE, width, height);
  const genome = decodeParams(paramsStr);

  return {
    cells,
    width,
    height,
    genome,
  };
}

/**
 * Convert pattern to shareable URL parameter
 */
export function patternToURLParam(pattern: LeniaPattern): string {
  const encoded = encodeLeniaPattern(pattern);
  return btoa(encoded);
}

/**
 * Convert URL parameter to pattern
 */
export function urlParamToPattern(param: string): LeniaPattern {
  const encoded = atob(param);
  return decodeLeniaPattern(encoded);
}

/**
 * Export pattern as JSON (Lenia-compatible format)
 */
export function exportToJSON(pattern: LeniaPattern): string {
  return JSON.stringify({
    name: pattern.name || 'Unnamed',
    description: pattern.description || '',
    author: pattern.author || 'GENESIS',
    params: {
      R: pattern.genome.R,
      T: pattern.genome.T,
      m: pattern.genome.m,
      s: pattern.genome.s,
      b: pattern.genome.b,
      kn: pattern.genome.kn,
      gn: pattern.genome.gn,
    },
    cells: {
      width: pattern.width,
      height: pattern.height,
      rle: encodeCellsRLE(pattern.cells, pattern.width, pattern.height),
    },
  }, null, 2);
}

/**
 * Import pattern from JSON
 */
export function importFromJSON(json: string): LeniaPattern {
  const data = JSON.parse(json);

  const genome: LeniaGenome = {
    R: data.params?.R || 13,
    T: data.params?.T || 10,
    m: data.params?.m || 0.15,
    s: data.params?.s || 0.015,
    b: data.params?.b || [1],
    kn: data.params?.kn || 1,
    gn: data.params?.gn || 1,
  };

  const width = data.cells?.width || 64;
  const height = data.cells?.height || 64;
  const cells = data.cells?.rle
    ? decodeCellsRLE(data.cells.rle, width, height)
    : new Float32Array(width * height);

  return {
    cells,
    width,
    height,
    genome,
    name: data.name,
    description: data.description,
    author: data.author,
  };
}

/**
 * Compress pattern for efficient storage
 * Uses simple difference encoding + base64
 */
export function compressPattern(cells: Float32Array): string {
  // Quantize to 8 bits
  const bytes = new Uint8Array(cells.length);
  for (let i = 0; i < cells.length; i++) {
    bytes[i] = Math.round(Math.max(0, Math.min(1, cells[i])) * 255);
  }

  // Delta encode
  const deltas = new Int16Array(cells.length);
  deltas[0] = bytes[0];
  for (let i = 1; i < bytes.length; i++) {
    deltas[i] = bytes[i] - bytes[i - 1];
  }

  // Convert to base64
  const deltaBytes = new Uint8Array(deltas.buffer);
  return btoa(String.fromCharCode(...deltaBytes));
}

/**
 * Decompress pattern
 */
export function decompressPattern(compressed: string, size: number): Float32Array {
  const deltaBytes = new Uint8Array(
    atob(compressed).split('').map(c => c.charCodeAt(0))
  );
  const deltas = new Int16Array(deltaBytes.buffer);

  const bytes = new Uint8Array(size);
  bytes[0] = deltas[0];
  for (let i = 1; i < size && i < deltas.length; i++) {
    bytes[i] = bytes[i - 1] + deltas[i];
  }

  const cells = new Float32Array(size);
  for (let i = 0; i < size; i++) {
    cells[i] = bytes[i] / 255;
  }

  return cells;
}
