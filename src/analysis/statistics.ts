/**
 * Statistical Analysis Module
 * Publication-quality statistical functions for research
 */

/**
 * Bootstrap configuration
 */
export interface BootstrapConfig {
  /** Number of bootstrap samples */
  nBootstrap: number;
  /** Confidence level (e.g., 0.95 for 95% CI) */
  confidenceLevel: number;
  /** Random seed for reproducibility */
  seed?: number;
}

/**
 * Confidence interval result
 */
export interface ConfidenceInterval {
  lower: number;
  upper: number;
  point: number;
  confidenceLevel: number;
}

/**
 * Effect size result
 */
export interface EffectSize {
  value: number;
  interpretation: "negligible" | "small" | "medium" | "large";
  ci?: ConfidenceInterval;
}

/**
 * Statistical test result
 */
export interface TestResult {
  statistic: number;
  pValue: number;
  significant: boolean;
  alpha: number;
  effectSize?: EffectSize;
}

// ============================================================================
// Basic Statistics
// ============================================================================

/**
 * Compute arithmetic mean
 */
export function mean(values: number[]): number {
  if (values.length === 0) return NaN;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/**
 * Compute sample variance (using n-1 for unbiased estimate)
 */
export function variance(values: number[], ddof: number = 1): number {
  if (values.length <= ddof) return NaN;
  const m = mean(values);
  const sumSquaredDiff = values.reduce((acc, v) => acc + (v - m) ** 2, 0);
  return sumSquaredDiff / (values.length - ddof);
}

/**
 * Compute sample standard deviation
 */
export function std(values: number[], ddof: number = 1): number {
  return Math.sqrt(variance(values, ddof));
}

/**
 * Compute standard error of the mean
 */
export function sem(values: number[]): number {
  return std(values) / Math.sqrt(values.length);
}

/**
 * Compute median
 */
export function median(values: number[]): number {
  if (values.length === 0) return NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Compute percentile (0-100)
 */
export function percentile(values: number[], p: number): number {
  if (values.length === 0) return NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const index = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index - lower;
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

/**
 * Compute interquartile range
 */
export function iqr(values: number[]): number {
  return percentile(values, 75) - percentile(values, 25);
}

/**
 * Compute skewness (Fisher's definition)
 */
export function skewness(values: number[]): number {
  const n = values.length;
  if (n < 3) return NaN;

  const m = mean(values);
  const s = std(values);
  if (s === 0) return NaN;

  const m3 = values.reduce((acc, v) => acc + ((v - m) / s) ** 3, 0) / n;
  return (Math.sqrt(n * (n - 1)) / (n - 2)) * m3;
}

/**
 * Compute kurtosis (excess kurtosis, Fisher's definition)
 */
export function kurtosis(values: number[]): number {
  const n = values.length;
  if (n < 4) return NaN;

  const m = mean(values);
  const s = std(values);
  if (s === 0) return NaN;

  const m4 = values.reduce((acc, v) => acc + ((v - m) / s) ** 4, 0) / n;

  // Excess kurtosis with sample correction
  return (
    ((n - 1) / ((n - 2) * (n - 3))) *
    ((n + 1) * m4 - 3 * (n - 1))
  );
}

// ============================================================================
// Simple PRNG for bootstrapping
// ============================================================================

/**
 * Simple seeded random number generator (xorshift128+)
 */
class SeededRandom {
  private s0: number;
  private s1: number;

  constructor(seed: number) {
    // Initialize with splitmix64
    this.s0 = this.splitmix64(seed);
    this.s1 = this.splitmix64(this.s0);
  }

  private splitmix64(x: number): number {
    x = (x + 0x9e3779b97f4a7c15) >>> 0;
    x = Math.imul(x ^ (x >>> 30), 0xbf58476d1ce4e5b9) >>> 0;
    x = Math.imul(x ^ (x >>> 27), 0x94d049bb133111eb) >>> 0;
    return (x ^ (x >>> 31)) >>> 0;
  }

  random(): number {
    const s0 = this.s0;
    let s1 = this.s1;

    const result = (s0 + s1) >>> 0;

    s1 ^= s0;
    this.s0 = ((s0 << 55) | (s0 >>> 9)) ^ s1 ^ (s1 << 14);
    this.s1 = (s1 << 36) | (s1 >>> 28);

    return result / 0xffffffff;
  }

  randInt(min: number, max: number): number {
    return min + Math.floor(this.random() * (max - min + 1));
  }
}

// ============================================================================
// Bootstrap Confidence Intervals
// ============================================================================

/**
 * Generate a bootstrap sample (resample with replacement)
 */
export function bootstrapSample<T>(
  data: T[],
  rng: { random: () => number },
): T[] {
  const n = data.length;
  const sample: T[] = [];
  for (let i = 0; i < n; i++) {
    const idx = Math.floor(rng.random() * n);
    sample.push(data[idx]);
  }
  return sample;
}

/**
 * Compute bootstrap confidence interval (percentile method)
 */
export function bootstrapCI(
  values: number[],
  statistic: (v: number[]) => number = mean,
  config: Partial<BootstrapConfig> = {},
): ConfidenceInterval {
  const { nBootstrap = 10000, confidenceLevel = 0.95, seed } = config;

  const rng = seed !== undefined ? new SeededRandom(seed) : { random: Math.random };

  // Generate bootstrap distribution
  const bootstrapStats: number[] = [];
  for (let i = 0; i < nBootstrap; i++) {
    const sample = bootstrapSample(values, rng);
    bootstrapStats.push(statistic(sample));
  }

  // Sort for percentile calculation
  bootstrapStats.sort((a, b) => a - b);

  const alpha = 1 - confidenceLevel;
  const lowerIndex = Math.floor((alpha / 2) * nBootstrap);
  const upperIndex = Math.floor((1 - alpha / 2) * nBootstrap);

  return {
    lower: bootstrapStats[lowerIndex],
    upper: bootstrapStats[upperIndex],
    point: statistic(values),
    confidenceLevel,
  };
}

/**
 * Compute BCa (bias-corrected and accelerated) bootstrap confidence interval
 */
export function bootstrapBCaCI(
  values: number[],
  statistic: (v: number[]) => number = mean,
  config: Partial<BootstrapConfig> = {},
): ConfidenceInterval {
  const { nBootstrap = 10000, confidenceLevel = 0.95, seed } = config;

  const rng = seed !== undefined ? new SeededRandom(seed) : { random: Math.random };
  const n = values.length;
  const thetaHat = statistic(values);

  // Generate bootstrap distribution
  const bootstrapStats: number[] = [];
  for (let i = 0; i < nBootstrap; i++) {
    const sample = bootstrapSample(values, rng);
    bootstrapStats.push(statistic(sample));
  }

  // Bias correction factor
  const countLess = bootstrapStats.filter((t) => t < thetaHat).length;
  const z0 = normalQuantile(countLess / nBootstrap);

  // Acceleration factor (jackknife)
  const jackValues: number[] = [];
  for (let i = 0; i < n; i++) {
    const subset = [...values.slice(0, i), ...values.slice(i + 1)];
    jackValues.push(statistic(subset));
  }
  const jackMean = mean(jackValues);
  const num = jackValues.reduce((acc, v) => acc + (jackMean - v) ** 3, 0);
  const denom = jackValues.reduce((acc, v) => acc + (jackMean - v) ** 2, 0);
  const a = num / (6 * Math.pow(denom, 1.5));

  // Adjusted percentiles
  const alpha = 1 - confidenceLevel;
  const zAlphaLower = normalQuantile(alpha / 2);
  const zAlphaUpper = normalQuantile(1 - alpha / 2);

  const alphaLower = normalCDF(
    z0 + (z0 + zAlphaLower) / (1 - a * (z0 + zAlphaLower)),
  );
  const alphaUpper = normalCDF(
    z0 + (z0 + zAlphaUpper) / (1 - a * (z0 + zAlphaUpper)),
  );

  // Sort bootstrap stats for percentile calculation
  bootstrapStats.sort((a, b) => a - b);

  const lowerIndex = Math.max(
    0,
    Math.min(nBootstrap - 1, Math.floor(alphaLower * nBootstrap)),
  );
  const upperIndex = Math.max(
    0,
    Math.min(nBootstrap - 1, Math.floor(alphaUpper * nBootstrap)),
  );

  return {
    lower: bootstrapStats[lowerIndex],
    upper: bootstrapStats[upperIndex],
    point: thetaHat,
    confidenceLevel,
  };
}

// ============================================================================
// Effect Sizes
// ============================================================================

/**
 * Compute Cohen's d effect size
 */
export function cohensD(group1: number[], group2: number[]): EffectSize {
  const m1 = mean(group1);
  const m2 = mean(group2);
  const n1 = group1.length;
  const n2 = group2.length;

  // Pooled standard deviation
  const s1 = std(group1);
  const s2 = std(group2);
  const pooledStd = Math.sqrt(
    ((n1 - 1) * s1 * s1 + (n2 - 1) * s2 * s2) / (n1 + n2 - 2),
  );

  const d = (m1 - m2) / pooledStd;

  return {
    value: d,
    interpretation: interpretCohensD(Math.abs(d)),
  };
}

/**
 * Compute Hedges' g effect size (corrected for small samples)
 */
export function hedgesG(group1: number[], group2: number[]): EffectSize {
  const d = cohensD(group1, group2);
  const n = group1.length + group2.length;

  // Correction factor for small samples
  const correction = 1 - 3 / (4 * (n - 2) - 1);
  const g = d.value * correction;

  return {
    value: g,
    interpretation: interpretCohensD(Math.abs(g)),
  };
}

/**
 * Compute Cliff's delta (non-parametric effect size)
 */
export function cliffsDelta(group1: number[], group2: number[]): EffectSize {
  const n1 = group1.length;
  const n2 = group2.length;

  let dominance = 0;
  for (const x1 of group1) {
    for (const x2 of group2) {
      if (x1 > x2) dominance++;
      else if (x1 < x2) dominance--;
    }
  }

  const delta = dominance / (n1 * n2);

  return {
    value: delta,
    interpretation: interpretCliffsDelta(Math.abs(delta)),
  };
}

/**
 * Interpret Cohen's d magnitude
 */
function interpretCohensD(
  d: number,
): "negligible" | "small" | "medium" | "large" {
  if (d < 0.2) return "negligible";
  if (d < 0.5) return "small";
  if (d < 0.8) return "medium";
  return "large";
}

/**
 * Interpret Cliff's delta magnitude
 */
function interpretCliffsDelta(
  delta: number,
): "negligible" | "small" | "medium" | "large" {
  if (delta < 0.147) return "negligible";
  if (delta < 0.33) return "small";
  if (delta < 0.474) return "medium";
  return "large";
}

// ============================================================================
// Statistical Tests
// ============================================================================

/**
 * Mann-Whitney U test (Wilcoxon rank-sum test)
 * Non-parametric test for comparing two independent groups
 */
export function mannWhitneyU(
  group1: number[],
  group2: number[],
  alpha: number = 0.05,
): TestResult {
  const n1 = group1.length;
  const n2 = group2.length;
  const combined = [
    ...group1.map((v) => ({ value: v, group: 1 })),
    ...group2.map((v) => ({ value: v, group: 2 })),
  ];

  // Assign ranks
  combined.sort((a, b) => a.value - b.value);

  // Handle ties by averaging ranks
  const ranks: number[] = [];
  let i = 0;
  while (i < combined.length) {
    let j = i;
    while (j < combined.length && combined[j].value === combined[i].value) {
      j++;
    }
    const avgRank = (i + j + 1) / 2; // Average of ranks i+1 to j
    for (let k = i; k < j; k++) {
      ranks[k] = avgRank;
    }
    i = j;
  }

  // Compute U statistic
  let R1 = 0;
  for (let k = 0; k < combined.length; k++) {
    if (combined[k].group === 1) {
      R1 += ranks[k];
    }
  }

  const U1 = R1 - (n1 * (n1 + 1)) / 2;
  const U2 = n1 * n2 - U1;
  const U = Math.min(U1, U2);

  // Normal approximation for large samples
  const mu = (n1 * n2) / 2;
  const sigma = Math.sqrt((n1 * n2 * (n1 + n2 + 1)) / 12);
  const z = (U - mu) / sigma;

  // Two-tailed p-value
  const pValue = 2 * (1 - normalCDF(Math.abs(z)));

  return {
    statistic: U,
    pValue,
    significant: pValue < alpha,
    alpha,
    effectSize: cliffsDelta(group1, group2),
  };
}

/**
 * Kruskal-Wallis H test
 * Non-parametric test for comparing multiple independent groups
 */
export function kruskalWallis(
  groups: number[][],
  alpha: number = 0.05,
): TestResult {
  const n = groups.reduce((sum, g) => sum + g.length, 0);

  // Combine and rank
  const combined: Array<{ value: number; groupIndex: number }> = [];
  for (let i = 0; i < groups.length; i++) {
    for (const value of groups[i]) {
      combined.push({ value, groupIndex: i });
    }
  }
  combined.sort((a, b) => a.value - b.value);

  // Handle ties by averaging ranks
  const ranks: number[] = [];
  let i = 0;
  while (i < combined.length) {
    let j = i;
    while (j < combined.length && combined[j].value === combined[i].value) {
      j++;
    }
    const avgRank = (i + j + 1) / 2;
    for (let k = i; k < j; k++) {
      ranks[k] = avgRank;
    }
    i = j;
  }

  // Compute rank sums for each group
  const rankSums: number[] = Array(groups.length).fill(0);
  for (let k = 0; k < combined.length; k++) {
    rankSums[combined[k].groupIndex] += ranks[k];
  }

  // Compute H statistic
  let H = 0;
  for (let i = 0; i < groups.length; i++) {
    const ni = groups[i].length;
    if (ni > 0) {
      H += (rankSums[i] ** 2) / ni;
    }
  }
  H = (12 / (n * (n + 1))) * H - 3 * (n + 1);

  // Approximate p-value using chi-square distribution
  const df = groups.length - 1;
  const pValue = 1 - chiSquareCDF(H, df);

  return {
    statistic: H,
    pValue,
    significant: pValue < alpha,
    alpha,
  };
}

// ============================================================================
// Multiple Comparison Corrections
// ============================================================================

/**
 * Apply Bonferroni correction to p-values
 */
export function bonferroniCorrection(
  pValues: number[],
): { corrected: number[]; significant: boolean[] } {
  const m = pValues.length;
  const corrected = pValues.map((p) => Math.min(1, p * m));
  const significant = corrected.map((p) => p < 0.05);
  return { corrected, significant };
}

/**
 * Apply Holm-Bonferroni step-down correction
 */
export function holmCorrection(
  pValues: number[],
): { corrected: number[]; significant: boolean[] } {
  const m = pValues.length;
  const indexed = pValues.map((p, i) => ({ p, i }));
  indexed.sort((a, b) => a.p - b.p);

  const corrected = new Array(m).fill(1);
  let maxCorrected = 0;

  for (let k = 0; k < m; k++) {
    const multiplier = m - k;
    const correctedP = Math.min(1, indexed[k].p * multiplier);
    maxCorrected = Math.max(maxCorrected, correctedP);
    corrected[indexed[k].i] = maxCorrected;
  }

  const significant = corrected.map((p) => p < 0.05);
  return { corrected, significant };
}

/**
 * Apply Benjamini-Hochberg FDR correction
 */
export function benjaminiHochbergCorrection(
  pValues: number[],
): { corrected: number[]; significant: boolean[] } {
  const m = pValues.length;
  const indexed = pValues.map((p, i) => ({ p, i }));
  indexed.sort((a, b) => a.p - b.p);

  const corrected = new Array(m).fill(1);
  let minCorrected = 1;

  // Work backwards to ensure monotonicity
  for (let k = m - 1; k >= 0; k--) {
    const multiplier = m / (k + 1);
    const correctedP = Math.min(1, indexed[k].p * multiplier);
    minCorrected = Math.min(minCorrected, correctedP);
    corrected[indexed[k].i] = minCorrected;
  }

  const significant = corrected.map((p) => p < 0.05);
  return { corrected, significant };
}

// ============================================================================
// Helper Functions - Distribution Functions
// ============================================================================

/**
 * Standard normal CDF (using error function approximation)
 */
export function normalCDF(x: number): number {
  return 0.5 * (1 + erf(x / Math.SQRT2));
}

/**
 * Standard normal quantile (inverse CDF)
 * Using Abramowitz and Stegun rational approximation
 */
export function normalQuantile(p: number): number {
  if (p <= 0) return -Infinity;
  if (p >= 1) return Infinity;

  // Coefficients for rational approximation
  const a = [
    -3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2,
    1.383577518672690e2, -3.066479806614716e1, 2.506628277459239e0,
  ];
  const b = [
    -5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2,
    6.680131188771972e1, -1.328068155288572e1,
  ];
  const c = [
    -7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838e0,
    -2.549732539343734e0, 4.374664141464968e0, 2.938163982698783e0,
  ];
  const d = [
    7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996e0,
    3.754408661907416e0,
  ];

  const pLow = 0.02425;
  const pHigh = 1 - pLow;

  let q: number;
  let r: number;

  if (p < pLow) {
    q = Math.sqrt(-2 * Math.log(p));
    return (
      (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
    );
  } else if (p <= pHigh) {
    q = p - 0.5;
    r = q * q;
    return (
      ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) *
        q) /
      (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1)
    );
  } else {
    q = Math.sqrt(-2 * Math.log(1 - p));
    return (
      -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
    );
  }
}

/**
 * Error function approximation (Horner's method)
 */
function erf(x: number): number {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x);

  const t = 1.0 / (1.0 + p * x);
  const y =
    1.0 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

  return sign * y;
}

/**
 * Chi-square CDF approximation
 * Using Wilson-Hilferty transformation
 */
export function chiSquareCDF(x: number, df: number): number {
  if (x <= 0) return 0;

  // Wilson-Hilferty transformation
  const z = Math.pow(x / df, 1 / 3) - (1 - 2 / (9 * df));
  const sigma = Math.sqrt(2 / (9 * df));

  return normalCDF(z / sigma);
}

// ============================================================================
// Summary Statistics Object
// ============================================================================

/**
 * Compute comprehensive summary statistics
 */
export function summarize(values: number[]): {
  n: number;
  mean: number;
  std: number;
  sem: number;
  median: number;
  min: number;
  max: number;
  q1: number;
  q3: number;
  iqr: number;
  skewness: number;
  kurtosis: number;
  ci95: ConfidenceInterval;
} {
  const sorted = [...values].sort((a, b) => a - b);

  return {
    n: values.length,
    mean: mean(values),
    std: std(values),
    sem: sem(values),
    median: median(values),
    min: sorted[0] ?? NaN,
    max: sorted[sorted.length - 1] ?? NaN,
    q1: percentile(values, 25),
    q3: percentile(values, 75),
    iqr: iqr(values),
    skewness: skewness(values),
    kurtosis: kurtosis(values),
    ci95: bootstrapCI(values, mean, { nBootstrap: 2000, confidenceLevel: 0.95 }),
  };
}
