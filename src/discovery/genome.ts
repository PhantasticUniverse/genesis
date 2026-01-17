/**
 * Lenia Genome
 * Encodes the parameters of a Lenia organism for genetic algorithm search
 */

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
  const numPeaks = 1 + Math.floor(Math.random() * 3); // 1-3 peaks
  const peaks: number[] = [];
  for (let i = 0; i < numPeaks; i++) {
    peaks.push(
      GENOME_RANGES.b.min +
        Math.random() * (GENOME_RANGES.b.max - GENOME_RANGES.b.min),
    );
  }
  peaks.sort();

  return {
    R: Math.round(
      GENOME_RANGES.R.min +
        Math.random() * (GENOME_RANGES.R.max - GENOME_RANGES.R.min),
    ),
    T: Math.round(
      GENOME_RANGES.T.min +
        Math.random() * (GENOME_RANGES.T.max - GENOME_RANGES.T.min),
    ),
    b: peaks,
    m:
      GENOME_RANGES.m.min +
      Math.random() * (GENOME_RANGES.m.max - GENOME_RANGES.m.min),
    s:
      GENOME_RANGES.s.min +
      Math.random() * (GENOME_RANGES.s.max - GENOME_RANGES.s.min),
    kn: (1 + Math.floor(Math.random() * 4)) as 1 | 2 | 3 | 4,
    gn: (1 + Math.floor(Math.random() * 3)) as 1 | 2 | 3,
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
    if (Math.random() > mutationRate) return value;
    const delta = (Math.random() * 2 - 1) * sigma * (max - min);
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
  if (Math.random() < mutationRate * 0.5) {
    if (Math.random() < 0.5 && mutated.b.length < 4) {
      // Add a peak
      mutated.b.push(
        GENOME_RANGES.b.min +
          Math.random() * (GENOME_RANGES.b.max - GENOME_RANGES.b.min),
      );
      mutated.b.sort();
    } else if (mutated.b.length > 1) {
      // Remove a peak
      const idx = Math.floor(Math.random() * mutated.b.length);
      mutated.b.splice(idx, 1);
    }
  }

  // Occasionally change kernel/growth type
  if (Math.random() < mutationRate * 0.3) {
    mutated.kn = (1 + Math.floor(Math.random() * 4)) as 1 | 2 | 3 | 4;
  }
  if (Math.random() < mutationRate * 0.3) {
    mutated.gn = (1 + Math.floor(Math.random() * 3)) as 1 | 2 | 3;
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
    return lower + Math.random() * (upper - lower);
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
    kn: Math.random() < 0.5 ? parent1.kn : parent2.kn,
    gn: Math.random() < 0.5 ? parent1.gn : parent2.gn,
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
  const parts = atob(encoded).split("|");
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
