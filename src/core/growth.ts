/**
 * Growth Functions for Continuous CA
 * Defines how cell state changes based on neighborhood sum
 */

export type GrowthFunction = "polynomial" | "gaussian" | "step" | "smooth-step";

export interface GrowthConfig {
  function: GrowthFunction;
  center: number; // μ - center of growth function (typically 0.1-0.3)
  width: number; // σ - width of growth function (typically 0.01-0.1)
  // For step function
  birthLow?: number;
  birthHigh?: number;
  deathLow?: number;
  deathHigh?: number;
}

/**
 * Polynomial growth function (Lenia style)
 * g(n) = 2 * (1 - ((n - μ) / (3σ))^2)^4 - 1
 * Returns value in [-1, 1]
 */
export function polynomialGrowth(n: number, mu: number, sigma: number): number {
  const x = (n - mu) / (3 * sigma);
  if (Math.abs(x) >= 1) return -1;
  const t = 1 - x * x;
  return 2 * t * t * t * t - 1;
}

/**
 * Gaussian growth function
 * g(n) = 2 * exp(-((n - μ)^2) / (2σ^2)) - 1
 * Returns value in [-1, 1]
 */
export function gaussianGrowth(n: number, mu: number, sigma: number): number {
  const d = (n - mu) / sigma;
  return 2 * Math.exp(-0.5 * d * d) - 1;
}

/**
 * Step growth function (SmoothLife style)
 * Used with separate birth/death thresholds
 */
export function stepGrowth(
  n: number,
  currentState: number,
  birthLow: number,
  birthHigh: number,
  deathLow: number,
  deathHigh: number,
): number {
  // If alive, use survival range
  if (currentState > 0.5) {
    if (n >= deathLow && n <= deathHigh) {
      return 1; // Stay alive
    }
    return -1; // Die
  }
  // If dead, use birth range
  if (n >= birthLow && n <= birthHigh) {
    return 1; // Birth
  }
  return -1; // Stay dead
}

/**
 * Smooth step function with sigmoid transitions
 */
export function smoothStepGrowth(
  n: number,
  currentState: number,
  birthLow: number,
  birthHigh: number,
  deathLow: number,
  deathHigh: number,
): number {
  const sigmoid = (x: number, c: number, w: number) =>
    1 / (1 + Math.exp(-(x - c) / w));
  const width = 0.02; // Transition width

  // Smooth step functions for birth and survival
  const birthP =
    sigmoid(n, birthLow, width) * (1 - sigmoid(n, birthHigh, width));
  const surviveP =
    sigmoid(n, deathLow, width) * (1 - sigmoid(n, deathHigh, width));

  // Interpolate based on current state
  const p = currentState * surviveP + (1 - currentState) * birthP;

  // Return growth value in [-1, 1]
  return 2 * p - 1;
}

/**
 * Apply growth and update cell state
 * newState = clamp(state + dt * growth, 0, 1)
 */
export function applyGrowth(state: number, growth: number, dt: number): number {
  const newState = state + dt * growth;
  return Math.max(0, Math.min(1, newState));
}

/**
 * Calculate growth based on configuration
 */
export function calculateGrowth(
  n: number,
  currentState: number,
  config: GrowthConfig,
): number {
  switch (config.function) {
    case "polynomial":
      return polynomialGrowth(n, config.center, config.width);

    case "gaussian":
      return gaussianGrowth(n, config.center, config.width);

    case "step":
      return stepGrowth(
        n,
        currentState,
        config.birthLow ?? 0.15,
        config.birthHigh ?? 0.25,
        config.deathLow ?? 0.12,
        config.deathHigh ?? 0.42,
      );

    case "smooth-step":
      return smoothStepGrowth(
        n,
        currentState,
        config.birthLow ?? 0.15,
        config.birthHigh ?? 0.25,
        config.deathLow ?? 0.12,
        config.deathHigh ?? 0.42,
      );

    default:
      return 0;
  }
}

// Preset growth configurations
export const GROWTH_PRESETS = {
  // Lenia default (optimized from evolution experiments)
  "lenia-default": {
    function: "gaussian" as GrowthFunction,
    center: 0.12,
    width: 0.04,
  },

  // Lenia alternative
  "lenia-wide": {
    function: "polynomial" as GrowthFunction,
    center: 0.2,
    width: 0.03,
  },

  // SmoothLife
  smoothlife: {
    function: "smooth-step" as GrowthFunction,
    center: 0.15,
    width: 0.015,
    birthLow: 0.257,
    birthHigh: 0.336,
    deathLow: 0.365,
    deathHigh: 0.549,
  },

  // Gaussian (smooth, stable)
  "gaussian-stable": {
    function: "gaussian" as GrowthFunction,
    center: 0.12,
    width: 0.04,
  },
} as const;
