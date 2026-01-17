/**
 * Seedable Random Number Generator
 * Implements xorshift128+ for reproducible experiments
 *
 * Key features:
 * - Deterministic output given a seed
 * - High-quality randomness (passes BigCrush)
 * - Fast (suitable for real-time use)
 * - Full Math.random() API compatibility
 */

// Internal state for xorshift128+
let state0: bigint = BigInt(0);
let state1: bigint = BigInt(0);

// Current seed for logging/reproducibility
let currentSeed: number = 0;

/**
 * Seed the random number generator
 * @param seed - Integer seed value. If undefined, uses current time.
 * @returns The seed used (useful when auto-generated)
 */
export function setSeed(seed?: number): number {
  const actualSeed = seed ?? Math.floor(Date.now() * Math.random());
  currentSeed = actualSeed;

  // Initialize state from seed using splitmix64
  // This ensures good initial state distribution
  let s = BigInt(actualSeed) & BigInt("0xFFFFFFFFFFFFFFFF");

  // First splitmix64 iteration for state0
  s = (s + BigInt("0x9E3779B97F4A7C15")) & BigInt("0xFFFFFFFFFFFFFFFF");
  let z = s;
  z =
    ((z ^ (z >> BigInt(30))) * BigInt("0xBF58476D1CE4E5B9")) &
    BigInt("0xFFFFFFFFFFFFFFFF");
  z =
    ((z ^ (z >> BigInt(27))) * BigInt("0x94D049BB133111EB")) &
    BigInt("0xFFFFFFFFFFFFFFFF");
  state0 = z ^ (z >> BigInt(31));

  // Second splitmix64 iteration for state1
  s = (s + BigInt("0x9E3779B97F4A7C15")) & BigInt("0xFFFFFFFFFFFFFFFF");
  z = s;
  z =
    ((z ^ (z >> BigInt(30))) * BigInt("0xBF58476D1CE4E5B9")) &
    BigInt("0xFFFFFFFFFFFFFFFF");
  z =
    ((z ^ (z >> BigInt(27))) * BigInt("0x94D049BB133111EB")) &
    BigInt("0xFFFFFFFFFFFFFFFF");
  state1 = z ^ (z >> BigInt(31));

  return actualSeed;
}

/**
 * Get the current seed
 */
export function getSeed(): number {
  return currentSeed;
}

/**
 * xorshift128+ core algorithm
 * Returns a random 64-bit unsigned integer as BigInt
 */
function xorshift128plus(): bigint {
  let s1 = state0;
  const s0 = state1;
  const result = (s0 + s1) & BigInt("0xFFFFFFFFFFFFFFFF");

  state0 = s0;
  s1 ^= s1 << BigInt(23);
  s1 ^= s1 >> BigInt(17);
  s1 ^= s0;
  s1 ^= s0 >> BigInt(26);
  state1 = s1;

  return result;
}

/**
 * Generate a random float in [0, 1) - drop-in replacement for Math.random()
 */
export function random(): number {
  const value = xorshift128plus();
  // Convert to float in [0, 1) using the upper 53 bits
  // (JavaScript numbers have 53 bits of precision)
  return Number(value >> BigInt(11)) / 9007199254740992; // 2^53
}

/**
 * Generate a random integer in [min, max] (inclusive)
 */
export function randomInt(min: number, max: number): number {
  return Math.floor(random() * (max - min + 1)) + min;
}

/**
 * Generate a random float in [min, max]
 */
export function randomFloat(min: number, max: number): number {
  return min + random() * (max - min);
}

/**
 * Generate a random boolean with given probability of true
 */
export function randomBool(probability: number = 0.5): boolean {
  return random() < probability;
}

/**
 * Pick a random element from an array
 */
export function randomChoice<T>(array: T[]): T {
  return array[Math.floor(random() * array.length)];
}

/**
 * Pick n random elements from an array (without replacement)
 */
export function randomSample<T>(array: T[], n: number): T[] {
  const copy = [...array];
  const result: T[] = [];
  for (let i = 0; i < Math.min(n, array.length); i++) {
    const idx = Math.floor(random() * copy.length);
    result.push(copy.splice(idx, 1)[0]);
  }
  return result;
}

/**
 * Shuffle an array in-place using Fisher-Yates
 */
export function shuffle<T>(array: T[]): T[] {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

/**
 * Generate a normally distributed random number using Box-Muller transform
 */
export function randomGaussian(mean: number = 0, stdDev: number = 1): number {
  let u1: number, u2: number;
  do {
    u1 = random();
  } while (u1 === 0);
  u2 = random();

  const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return z0 * stdDev + mean;
}

/**
 * RNG class for isolated random streams
 * Useful when you need multiple independent random sequences
 */
export class SeededRNG {
  private state0: bigint;
  private state1: bigint;
  public readonly seed: number;

  constructor(seed?: number) {
    this.seed = seed ?? Math.floor(Date.now() * Math.random());

    // Initialize using splitmix64
    let s = BigInt(this.seed) & BigInt("0xFFFFFFFFFFFFFFFF");

    s = (s + BigInt("0x9E3779B97F4A7C15")) & BigInt("0xFFFFFFFFFFFFFFFF");
    let z = s;
    z =
      ((z ^ (z >> BigInt(30))) * BigInt("0xBF58476D1CE4E5B9")) &
      BigInt("0xFFFFFFFFFFFFFFFF");
    z =
      ((z ^ (z >> BigInt(27))) * BigInt("0x94D049BB133111EB")) &
      BigInt("0xFFFFFFFFFFFFFFFF");
    this.state0 = z ^ (z >> BigInt(31));

    s = (s + BigInt("0x9E3779B97F4A7C15")) & BigInt("0xFFFFFFFFFFFFFFFF");
    z = s;
    z =
      ((z ^ (z >> BigInt(30))) * BigInt("0xBF58476D1CE4E5B9")) &
      BigInt("0xFFFFFFFFFFFFFFFF");
    z =
      ((z ^ (z >> BigInt(27))) * BigInt("0x94D049BB133111EB")) &
      BigInt("0xFFFFFFFFFFFFFFFF");
    this.state1 = z ^ (z >> BigInt(31));
  }

  private xorshift128plus(): bigint {
    let s1 = this.state0;
    const s0 = this.state1;
    const result = (s0 + s1) & BigInt("0xFFFFFFFFFFFFFFFF");

    this.state0 = s0;
    s1 ^= s1 << BigInt(23);
    s1 ^= s1 >> BigInt(17);
    s1 ^= s0;
    s1 ^= s0 >> BigInt(26);
    this.state1 = s1;

    return result;
  }

  random(): number {
    const value = this.xorshift128plus();
    return Number(value >> BigInt(11)) / 9007199254740992;
  }

  randomInt(min: number, max: number): number {
    return Math.floor(this.random() * (max - min + 1)) + min;
  }

  randomFloat(min: number, max: number): number {
    return min + this.random() * (max - min);
  }

  randomBool(probability: number = 0.5): boolean {
    return this.random() < probability;
  }

  randomChoice<T>(array: T[]): T {
    return array[Math.floor(this.random() * array.length)];
  }

  randomGaussian(mean: number = 0, stdDev: number = 1): number {
    let u1: number;
    do {
      u1 = this.random();
    } while (u1 === 0);
    const u2 = this.random();
    const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    return z0 * stdDev + mean;
  }
}

// Initialize with a random seed on module load
setSeed();

// Export a default instance for convenience
export default {
  setSeed,
  getSeed,
  random,
  randomInt,
  randomFloat,
  randomBool,
  randomChoice,
  randomSample,
  shuffle,
  randomGaussian,
  SeededRNG,
};
