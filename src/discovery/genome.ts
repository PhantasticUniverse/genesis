/**
 * Lenia Genome
 * Encodes the parameters of a Lenia organism for genetic algorithm search
 */

import { random, randomInt, randomFloat, randomBool } from "../core/random";

export interface LeniaGenome {
  // Kernel parameters
  R: number; // Radius (10-50)
  T: number; // Time resolution (5-30)
  b: number[]; // Kernel peaks (1-5 values, each 0-1)

  // Growth function parameters
  m: number; // Growth center μ (0.05-0.5)
  s: number; // Growth width σ (0.005-0.1)

  // Kernel type
  kn: 1 | 2 | 3 | 4; // Kernel core: 1=bump, 2=step, 3=staircase, 4=gaussian

  // Growth type
  gn: 1 | 2 | 3; // Growth function: 1=polynomial, 2=exponential, 3=step
}

// Parameter ranges for mutation/initialization
export const GENOME_RANGES = {
  R: { min: 8, max: 30 },
  T: { min: 5, max: 20 },
  b: { min: 0.1, max: 1.0 },
  m: { min: 0.05, max: 0.4 },
  s: { min: 0.005, max: 0.08 },
  kn: { min: 1, max: 4 },
  gn: { min: 1, max: 3 },
} as const;

/**
 * Generate a random genome
 */
export function randomGenome(): LeniaGenome {
  const numPeaks = randomInt(1, 3); // 1-3 peaks
  const peaks: number[] = [];
  for (let i = 0; i < numPeaks; i++) {
    peaks.push(randomFloat(GENOME_RANGES.b.min, GENOME_RANGES.b.max));
  }
  peaks.sort();

  return {
    R: randomInt(GENOME_RANGES.R.min, GENOME_RANGES.R.max),
    T: randomInt(GENOME_RANGES.T.min, GENOME_RANGES.T.max),
    b: peaks,
    m: randomFloat(GENOME_RANGES.m.min, GENOME_RANGES.m.max),
    s: randomFloat(GENOME_RANGES.s.min, GENOME_RANGES.s.max),
    kn: randomInt(1, 4) as 1 | 2 | 3 | 4,
    gn: randomInt(1, 3) as 1 | 2 | 3,
  };
}

/**
 * Clone a genome
 */
export function cloneGenome(genome: LeniaGenome): LeniaGenome {
  return {
    ...genome,
    b: [...genome.b],
  };
}

/**
 * Mutate a genome
 */
export function mutateGenome(
  genome: LeniaGenome,
  mutationRate: number = 0.1,
): LeniaGenome {
  const mutated = cloneGenome(genome);

  // Gaussian mutation helper
  const gaussMutate = (
    value: number,
    min: number,
    max: number,
    sigma: number,
  ): number => {
    if (!randomBool(mutationRate)) return value;
    const delta = (random() * 2 - 1) * sigma * (max - min);
    return Math.max(min, Math.min(max, value + delta));
  };

  mutated.R = Math.round(
    gaussMutate(mutated.R, GENOME_RANGES.R.min, GENOME_RANGES.R.max, 0.2),
  );
  mutated.T = Math.round(
    gaussMutate(mutated.T, GENOME_RANGES.T.min, GENOME_RANGES.T.max, 0.2),
  );
  mutated.m = gaussMutate(
    mutated.m,
    GENOME_RANGES.m.min,
    GENOME_RANGES.m.max,
    0.15,
  );
  mutated.s = gaussMutate(
    mutated.s,
    GENOME_RANGES.s.min,
    GENOME_RANGES.s.max,
    0.15,
  );

  // Mutate peaks
  for (let i = 0; i < mutated.b.length; i++) {
    mutated.b[i] = gaussMutate(
      mutated.b[i],
      GENOME_RANGES.b.min,
      GENOME_RANGES.b.max,
      0.15,
    );
  }
  mutated.b.sort();

  // Occasionally add/remove a peak
  if (randomBool(mutationRate * 0.5)) {
    if (randomBool(0.5) && mutated.b.length < 4) {
      // Add a peak
      mutated.b.push(randomFloat(GENOME_RANGES.b.min, GENOME_RANGES.b.max));
      mutated.b.sort();
    } else if (mutated.b.length > 1) {
      // Remove a peak
      const idx = randomInt(0, mutated.b.length - 1);
      mutated.b.splice(idx, 1);
    }
  }

  // Occasionally change kernel/growth type
  if (randomBool(mutationRate * 0.3)) {
    mutated.kn = randomInt(1, 4) as 1 | 2 | 3 | 4;
  }
  if (randomBool(mutationRate * 0.3)) {
    mutated.gn = randomInt(1, 3) as 1 | 2 | 3;
  }

  return mutated;
}

/**
 * Crossover two genomes (BLX-alpha blend)
 */
export function crossoverGenomes(
  parent1: LeniaGenome,
  parent2: LeniaGenome,
): LeniaGenome {
  const alpha = 0.3;

  const blend = (v1: number, v2: number, min: number, max: number): number => {
    const minVal = Math.min(v1, v2);
    const maxVal = Math.max(v1, v2);
    const range = maxVal - minVal;
    const lower = Math.max(min, minVal - alpha * range);
    const upper = Math.min(max, maxVal + alpha * range);
    return randomFloat(lower, upper);
  };

  // Blend continuous parameters
  const child: LeniaGenome = {
    R: Math.round(
      blend(parent1.R, parent2.R, GENOME_RANGES.R.min, GENOME_RANGES.R.max),
    ),
    T: Math.round(
      blend(parent1.T, parent2.T, GENOME_RANGES.T.min, GENOME_RANGES.T.max),
    ),
    m: blend(parent1.m, parent2.m, GENOME_RANGES.m.min, GENOME_RANGES.m.max),
    s: blend(parent1.s, parent2.s, GENOME_RANGES.s.min, GENOME_RANGES.s.max),
    b: [],
    kn: randomBool(0.5) ? parent1.kn : parent2.kn,
    gn: randomBool(0.5) ? parent1.gn : parent2.gn,
  };

  // Blend peaks - average number of peaks
  const numPeaks = Math.round((parent1.b.length + parent2.b.length) / 2);
  for (let i = 0; i < numPeaks; i++) {
    const p1Peak = parent1.b[Math.min(i, parent1.b.length - 1)];
    const p2Peak = parent2.b[Math.min(i, parent2.b.length - 1)];
    child.b.push(
      blend(p1Peak, p2Peak, GENOME_RANGES.b.min, GENOME_RANGES.b.max),
    );
  }
  child.b.sort();

  return child;
}

/**
 * Convert genome to engine parameters
 */
export function genomeToParams(genome: LeniaGenome) {
  return {
    kernelRadius: genome.R,
    growthCenter: genome.m,
    growthWidth: genome.s,
    dt: 1 / genome.T,
    growthType: genome.gn - 1, // 0-indexed
    peaks: genome.b,
  };
}

/**
 * Encode genome as a compact string (for sharing/storage)
 */
export function encodeGenome(genome: LeniaGenome): string {
  const parts = [
    genome.R.toString(),
    genome.T.toString(),
    genome.b.map((p) => p.toFixed(3)).join(","),
    genome.m.toFixed(4),
    genome.s.toFixed(4),
    genome.kn.toString(),
    genome.gn.toString(),
  ];
  return btoa(parts.join("|"));
}

/**
 * Decode genome from compact string
 */
export function decodeGenome(encoded: string): LeniaGenome {
  let decoded: string;
  try {
    decoded = atob(encoded);
  } catch {
    throw new Error(
      `Invalid genome string: not valid base64 encoding. ` +
        `Expected a genome string from 'encodeGenome()' or exported from evolution results.`
    );
  }

  const parts = decoded.split("|");
  if (parts.length < 7) {
    throw new Error(
      `Invalid genome format: expected 7 parts but got ${parts.length}. ` +
        `The genome string may be corrupted or from an incompatible version.`
    );
  }

  return {
    R: parseInt(parts[0]),
    T: parseInt(parts[1]),
    b: parts[2].split(",").map(parseFloat),
    m: parseFloat(parts[3]),
    s: parseFloat(parts[4]),
    kn: parseInt(parts[5]) as 1 | 2 | 3 | 4,
    gn: parseInt(parts[6]) as 1 | 2 | 3,
  };
}

// ============================================================================
// Multi-Kernel Genome
// ============================================================================

import type {
  MultiKernelConfig,
  KernelCombinationMode,
  KernelShape,
  GrowthFunction,
} from "../core/types";

/**
 * Multi-Kernel Lenia Genome
 * Encodes parameters for organisms with multiple convolution kernels
 */
export interface MultiKernelGenome {
  T: number; // Time resolution (5-20)
  kernelCount: number; // Number of kernels (1-4)
  combinationMode: number; // 0=sum, 1=average, 2=weighted
  R: number[]; // Radii per kernel (8-30 each)
  b: number[][]; // Peaks per kernel (1-4 values each)
  h: number[]; // Weights per kernel (0-1.5)
  m: number[]; // Growth centers per kernel (0.05-0.4)
  s: number[]; // Growth widths per kernel (0.005-0.08)
  kn: number[]; // Kernel types per kernel (1-4)
  gn: number[]; // Growth types per kernel (1-3)
}

// Parameter ranges for multi-kernel genomes
export const MULTIKERNEL_GENOME_RANGES = {
  T: { min: 5, max: 20 },
  kernelCount: { min: 1, max: 4 },
  combinationMode: { min: 0, max: 2 },
  R: { min: 8, max: 30 },
  b: { min: 0.1, max: 1.0 },
  h: { min: 0.1, max: 1.5 },
  m: { min: 0.05, max: 0.4 },
  s: { min: 0.005, max: 0.08 },
  kn: { min: 1, max: 4 },
  gn: { min: 1, max: 3 },
} as const;

/**
 * Generate a random multi-kernel genome
 */
export function randomMultiKernelGenome(
  kernelCount?: number,
): MultiKernelGenome {
  const numKernels =
    kernelCount ??
    randomInt(
      MULTIKERNEL_GENOME_RANGES.kernelCount.min,
      MULTIKERNEL_GENOME_RANGES.kernelCount.max,
    );

  const R: number[] = [];
  const b: number[][] = [];
  const h: number[] = [];
  const m: number[] = [];
  const s: number[] = [];
  const kn: number[] = [];
  const gn: number[] = [];

  for (let i = 0; i < numKernels; i++) {
    // Radius
    R.push(
      randomInt(
        MULTIKERNEL_GENOME_RANGES.R.min,
        MULTIKERNEL_GENOME_RANGES.R.max,
      ),
    );

    // Peaks (1-3 per kernel)
    const numPeaks = randomInt(1, 3);
    const peaks: number[] = [];
    for (let j = 0; j < numPeaks; j++) {
      peaks.push(
        randomFloat(
          MULTIKERNEL_GENOME_RANGES.b.min,
          MULTIKERNEL_GENOME_RANGES.b.max,
        ),
      );
    }
    peaks.sort();
    b.push(peaks);

    // Weight
    h.push(
      randomFloat(
        MULTIKERNEL_GENOME_RANGES.h.min,
        MULTIKERNEL_GENOME_RANGES.h.max,
      ),
    );

    // Growth center
    m.push(
      randomFloat(
        MULTIKERNEL_GENOME_RANGES.m.min,
        MULTIKERNEL_GENOME_RANGES.m.max,
      ),
    );

    // Growth width
    s.push(
      randomFloat(
        MULTIKERNEL_GENOME_RANGES.s.min,
        MULTIKERNEL_GENOME_RANGES.s.max,
      ),
    );

    // Kernel type
    kn.push(randomInt(1, 4));

    // Growth type
    gn.push(randomInt(1, 3));
  }

  return {
    T: randomInt(
      MULTIKERNEL_GENOME_RANGES.T.min,
      MULTIKERNEL_GENOME_RANGES.T.max,
    ),
    kernelCount: numKernels,
    combinationMode: randomInt(0, 2),
    R,
    b,
    h,
    m,
    s,
    kn,
    gn,
  };
}

/**
 * Clone a multi-kernel genome
 */
export function cloneMultiKernelGenome(
  genome: MultiKernelGenome,
): MultiKernelGenome {
  return {
    T: genome.T,
    kernelCount: genome.kernelCount,
    combinationMode: genome.combinationMode,
    R: [...genome.R],
    b: genome.b.map((peaks) => [...peaks]),
    h: [...genome.h],
    m: [...genome.m],
    s: [...genome.s],
    kn: [...genome.kn],
    gn: [...genome.gn],
  };
}

/**
 * Mutate a multi-kernel genome
 */
export function mutateMultiKernelGenome(
  genome: MultiKernelGenome,
  mutationRate: number = 0.1,
): MultiKernelGenome {
  const mutated = cloneMultiKernelGenome(genome);

  // Gaussian mutation helper
  const gaussMutate = (
    value: number,
    min: number,
    max: number,
    sigma: number,
  ): number => {
    if (!randomBool(mutationRate)) return value;
    const delta = (random() * 2 - 1) * sigma * (max - min);
    return Math.max(min, Math.min(max, value + delta));
  };

  // Mutate global params
  mutated.T = Math.round(
    gaussMutate(
      mutated.T,
      MULTIKERNEL_GENOME_RANGES.T.min,
      MULTIKERNEL_GENOME_RANGES.T.max,
      0.2,
    ),
  );

  // Occasionally change combination mode
  if (randomBool(mutationRate * 0.3)) {
    mutated.combinationMode = randomInt(0, 2);
  }

  // Mutate per-kernel params
  for (let i = 0; i < mutated.kernelCount; i++) {
    mutated.R[i] = Math.round(
      gaussMutate(
        mutated.R[i],
        MULTIKERNEL_GENOME_RANGES.R.min,
        MULTIKERNEL_GENOME_RANGES.R.max,
        0.2,
      ),
    );

    mutated.h[i] = gaussMutate(
      mutated.h[i],
      MULTIKERNEL_GENOME_RANGES.h.min,
      MULTIKERNEL_GENOME_RANGES.h.max,
      0.15,
    );

    mutated.m[i] = gaussMutate(
      mutated.m[i],
      MULTIKERNEL_GENOME_RANGES.m.min,
      MULTIKERNEL_GENOME_RANGES.m.max,
      0.15,
    );

    mutated.s[i] = gaussMutate(
      mutated.s[i],
      MULTIKERNEL_GENOME_RANGES.s.min,
      MULTIKERNEL_GENOME_RANGES.s.max,
      0.15,
    );

    // Mutate peaks
    for (let j = 0; j < mutated.b[i].length; j++) {
      mutated.b[i][j] = gaussMutate(
        mutated.b[i][j],
        MULTIKERNEL_GENOME_RANGES.b.min,
        MULTIKERNEL_GENOME_RANGES.b.max,
        0.15,
      );
    }
    mutated.b[i].sort();

    // Occasionally add/remove a peak
    if (randomBool(mutationRate * 0.5)) {
      if (randomBool(0.5) && mutated.b[i].length < 4) {
        mutated.b[i].push(
          randomFloat(
            MULTIKERNEL_GENOME_RANGES.b.min,
            MULTIKERNEL_GENOME_RANGES.b.max,
          ),
        );
        mutated.b[i].sort();
      } else if (mutated.b[i].length > 1) {
        const idx = randomInt(0, mutated.b[i].length - 1);
        mutated.b[i].splice(idx, 1);
      }
    }

    // Occasionally change kernel/growth type
    if (randomBool(mutationRate * 0.3)) {
      mutated.kn[i] = randomInt(1, 4);
    }
    if (randomBool(mutationRate * 0.3)) {
      mutated.gn[i] = randomInt(1, 3);
    }
  }

  // Occasionally add/remove a kernel
  if (randomBool(mutationRate * 0.2)) {
    if (
      randomBool(0.5) &&
      mutated.kernelCount < MULTIKERNEL_GENOME_RANGES.kernelCount.max
    ) {
      // Add a kernel
      mutated.kernelCount++;
      mutated.R.push(
        randomInt(
          MULTIKERNEL_GENOME_RANGES.R.min,
          MULTIKERNEL_GENOME_RANGES.R.max,
        ),
      );
      mutated.b.push([0.5]);
      mutated.h.push(0.5);
      mutated.m.push(0.12);
      mutated.s.push(0.04);
      mutated.kn.push(1);
      mutated.gn.push(1);
    } else if (mutated.kernelCount > 1) {
      // Remove a kernel
      const idx = randomInt(0, mutated.kernelCount - 1);
      mutated.kernelCount--;
      mutated.R.splice(idx, 1);
      mutated.b.splice(idx, 1);
      mutated.h.splice(idx, 1);
      mutated.m.splice(idx, 1);
      mutated.s.splice(idx, 1);
      mutated.kn.splice(idx, 1);
      mutated.gn.splice(idx, 1);
    }
  }

  return mutated;
}

/**
 * Crossover two multi-kernel genomes
 */
export function crossoverMultiKernelGenomes(
  parent1: MultiKernelGenome,
  parent2: MultiKernelGenome,
): MultiKernelGenome {
  const alpha = 0.3;

  const blend = (v1: number, v2: number, min: number, max: number): number => {
    const minVal = Math.min(v1, v2);
    const maxVal = Math.max(v1, v2);
    const range = maxVal - minVal;
    const lower = Math.max(min, minVal - alpha * range);
    const upper = Math.min(max, maxVal + alpha * range);
    return randomFloat(lower, upper);
  };

  // Average kernel count
  const kernelCount = Math.round(
    (parent1.kernelCount + parent2.kernelCount) / 2,
  );

  const R: number[] = [];
  const b: number[][] = [];
  const h: number[] = [];
  const m: number[] = [];
  const s: number[] = [];
  const kn: number[] = [];
  const gn: number[] = [];

  for (let i = 0; i < kernelCount; i++) {
    const p1Idx = Math.min(i, parent1.kernelCount - 1);
    const p2Idx = Math.min(i, parent2.kernelCount - 1);

    // Blend numeric params
    R.push(
      Math.round(
        blend(
          parent1.R[p1Idx],
          parent2.R[p2Idx],
          MULTIKERNEL_GENOME_RANGES.R.min,
          MULTIKERNEL_GENOME_RANGES.R.max,
        ),
      ),
    );

    h.push(
      blend(
        parent1.h[p1Idx],
        parent2.h[p2Idx],
        MULTIKERNEL_GENOME_RANGES.h.min,
        MULTIKERNEL_GENOME_RANGES.h.max,
      ),
    );

    m.push(
      blend(
        parent1.m[p1Idx],
        parent2.m[p2Idx],
        MULTIKERNEL_GENOME_RANGES.m.min,
        MULTIKERNEL_GENOME_RANGES.m.max,
      ),
    );

    s.push(
      blend(
        parent1.s[p1Idx],
        parent2.s[p2Idx],
        MULTIKERNEL_GENOME_RANGES.s.min,
        MULTIKERNEL_GENOME_RANGES.s.max,
      ),
    );

    // Blend peaks
    const numPeaks = Math.round(
      (parent1.b[p1Idx].length + parent2.b[p2Idx].length) / 2,
    );
    const peaks: number[] = [];
    for (let j = 0; j < numPeaks; j++) {
      const p1Peak = parent1.b[p1Idx][Math.min(j, parent1.b[p1Idx].length - 1)];
      const p2Peak = parent2.b[p2Idx][Math.min(j, parent2.b[p2Idx].length - 1)];
      peaks.push(
        blend(
          p1Peak,
          p2Peak,
          MULTIKERNEL_GENOME_RANGES.b.min,
          MULTIKERNEL_GENOME_RANGES.b.max,
        ),
      );
    }
    peaks.sort();
    b.push(peaks);

    // Pick kernel/growth types from one parent
    kn.push(randomBool(0.5) ? parent1.kn[p1Idx] : parent2.kn[p2Idx]);
    gn.push(randomBool(0.5) ? parent1.gn[p1Idx] : parent2.gn[p2Idx]);
  }

  return {
    T: Math.round(
      blend(
        parent1.T,
        parent2.T,
        MULTIKERNEL_GENOME_RANGES.T.min,
        MULTIKERNEL_GENOME_RANGES.T.max,
      ),
    ),
    kernelCount,
    combinationMode: randomBool(0.5)
      ? parent1.combinationMode
      : parent2.combinationMode,
    R,
    b,
    h,
    m,
    s,
    kn,
    gn,
  };
}

/**
 * Convert multi-kernel genome to engine configuration
 */
export function multiKernelGenomeToConfig(
  genome: MultiKernelGenome,
): MultiKernelConfig {
  const kernelShapes: KernelShape[] = [
    "polynomial",
    "step",
    "polynomial",
    "gaussian",
  ];
  const growthTypes: GrowthFunction[] = ["polynomial", "gaussian", "step"];
  const combinationModes: KernelCombinationMode[] = [
    "sum",
    "average",
    "weighted",
  ];

  return {
    kernels: genome.R.map((radius, i) => ({
      id: `kernel-${i}`,
      shape: kernelShapes[genome.kn[i] - 1] || "polynomial",
      radius,
      peaks: genome.b[i],
      weight: genome.h[i],
    })),
    growthParams: genome.m.map((mu, i) => ({
      type: growthTypes[genome.gn[i] - 1] || "gaussian",
      mu,
      sigma: genome.s[i],
    })),
    combinationMode: combinationModes[genome.combinationMode] || "weighted",
    dt: 1 / genome.T,
    maxKernels: 4,
  };
}

/**
 * Encode multi-kernel genome as a compact string
 */
export function encodeMultiKernelGenome(genome: MultiKernelGenome): string {
  const parts = [
    genome.T.toString(),
    genome.kernelCount.toString(),
    genome.combinationMode.toString(),
    genome.R.join(","),
    genome.b.map((peaks) => peaks.map((p) => p.toFixed(3)).join(":")).join(","),
    genome.h.map((w) => w.toFixed(3)).join(","),
    genome.m.map((mu) => mu.toFixed(4)).join(","),
    genome.s.map((sigma) => sigma.toFixed(4)).join(","),
    genome.kn.join(","),
    genome.gn.join(","),
  ];
  return btoa(parts.join("|"));
}

/**
 * Decode multi-kernel genome from compact string
 */
export function decodeMultiKernelGenome(encoded: string): MultiKernelGenome {
  let decoded: string;
  try {
    decoded = atob(encoded);
  } catch {
    throw new Error(
      `Invalid multi-kernel genome string: not valid base64 encoding. ` +
        `Expected a genome string from 'encodeMultiKernelGenome()' or exported from evolution results.`
    );
  }

  const parts = decoded.split("|");
  if (parts.length < 10) {
    throw new Error(
      `Invalid multi-kernel genome format: expected 10 parts but got ${parts.length}. ` +
        `The genome string may be corrupted or from an incompatible version.`
    );
  }

  return {
    T: parseInt(parts[0]),
    kernelCount: parseInt(parts[1]),
    combinationMode: parseInt(parts[2]),
    R: parts[3].split(",").map((v) => parseInt(v)),
    b: parts[4].split(",").map((p) => p.split(":").map(parseFloat)),
    h: parts[5].split(",").map(parseFloat),
    m: parts[6].split(",").map(parseFloat),
    s: parts[7].split(",").map(parseFloat),
    kn: parts[8].split(",").map((v) => parseInt(v)),
    gn: parts[9].split(",").map((v) => parseInt(v)),
  };
}
