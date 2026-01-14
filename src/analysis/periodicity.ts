/**
 * Period Detection for Cellular Automata
 * Detects oscillation periods and cyclic behavior in patterns
 *
 * Techniques:
 * - Auto-correlation analysis
 * - FFT-based period detection
 * - State hashing for exact periodicity
 */

/** Result of period detection */
export interface PeriodResult {
  /** Detected period in steps (0 if aperiodic) */
  period: number;
  /** Confidence in the detected period (0-1) */
  confidence: number;
  /** Whether pattern is exactly periodic (hash match) */
  isExactPeriod: boolean;
  /** Multiple candidate periods with their strengths */
  candidates: Array<{ period: number; strength: number }>;
  /** Classification of behavior */
  behavior: 'static' | 'periodic' | 'quasi-periodic' | 'chaotic';
  /** Auto-correlation values */
  autocorrelation: number[];
}

/** Configuration for period detection */
export interface PeriodConfig {
  /** Maximum period to search for (default: 100) */
  maxPeriod: number;
  /** Minimum correlation for period detection (default: 0.8) */
  correlationThreshold: number;
  /** Whether to use FFT for correlation (default: false for small maxPeriod) */
  useFFT: boolean;
  /** Whether to check for exact state matches (default: true) */
  checkExactMatch: boolean;
  /** Tolerance for "static" classification (default: 0.001) */
  staticThreshold: number;
}

export const DEFAULT_PERIOD_CONFIG: PeriodConfig = {
  maxPeriod: 100,
  correlationThreshold: 0.8,
  useFFT: false,
  checkExactMatch: true,
  staticThreshold: 0.001,
};

/**
 * Calculate auto-correlation of a time series
 * Returns correlation for each lag from 1 to maxLag
 */
export function autocorrelation(
  series: number[],
  maxLag: number
): number[] {
  const n = series.length;
  if (n < 2) return [];

  // Calculate mean
  const mean = series.reduce((a, b) => a + b, 0) / n;

  // Calculate variance
  let variance = 0;
  for (let i = 0; i < n; i++) {
    variance += (series[i] - mean) ** 2;
  }
  variance /= n;

  if (variance < 1e-10) {
    // Constant series - all correlations are 1 (or undefined)
    return new Array(Math.min(maxLag, n - 1)).fill(1);
  }

  const result: number[] = [];

  for (let lag = 1; lag <= Math.min(maxLag, n - 1); lag++) {
    let covariance = 0;
    for (let i = 0; i < n - lag; i++) {
      covariance += (series[i] - mean) * (series[i + lag] - mean);
    }
    covariance /= (n - lag);
    result.push(covariance / variance);
  }

  return result;
}

/**
 * Calculate cross-correlation between two time series
 */
export function crossCorrelation(
  series1: number[],
  series2: number[]
): number {
  if (series1.length !== series2.length || series1.length === 0) {
    return 0;
  }

  const n = series1.length;
  const mean1 = series1.reduce((a, b) => a + b, 0) / n;
  const mean2 = series2.reduce((a, b) => a + b, 0) / n;

  let cov = 0;
  let var1 = 0;
  let var2 = 0;

  for (let i = 0; i < n; i++) {
    const d1 = series1[i] - mean1;
    const d2 = series2[i] - mean2;
    cov += d1 * d2;
    var1 += d1 * d1;
    var2 += d2 * d2;
  }

  const denom = Math.sqrt(var1 * var2);
  return denom > 1e-10 ? cov / denom : 0;
}

/**
 * Find peaks in autocorrelation that indicate periods
 */
export function findAutocorrelationPeaks(
  acf: number[],
  threshold: number = 0.5
): Array<{ lag: number; value: number }> {
  const peaks: Array<{ lag: number; value: number }> = [];

  for (let i = 1; i < acf.length - 1; i++) {
    // Check if this is a local maximum above threshold
    if (acf[i] > threshold && acf[i] > acf[i - 1] && acf[i] > acf[i + 1]) {
      peaks.push({ lag: i + 1, value: acf[i] }); // lag is 1-indexed
    }
  }

  // Sort by correlation value (strongest first)
  peaks.sort((a, b) => b.value - a.value);

  return peaks;
}

/**
 * Simple hash for Float32Array state (for exact period detection)
 * Uses sampling for large arrays
 */
export function hashState(state: Float32Array, sampleSize: number = 100): string {
  const step = Math.max(1, Math.floor(state.length / sampleSize));
  const samples: number[] = [];

  for (let i = 0; i < state.length; i += step) {
    // Round to 3 decimal places to handle floating point noise
    samples.push(Math.round(state[i] * 1000));
  }

  return samples.join(',');
}

/**
 * Extract time series features from state history
 */
export interface StateFeatures {
  mass: number;
  centroidX: number;
  centroidY: number;
  spread: number;
}

export function extractFeatures(
  state: Float32Array,
  width: number,
  height: number
): StateFeatures {
  let mass = 0;
  let sumX = 0;
  let sumY = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const val = state[y * width + x];
      if (val > 0) {
        mass += val;
        sumX += x * val;
        sumY += y * val;
      }
    }
  }

  if (mass === 0) {
    return { mass: 0, centroidX: width / 2, centroidY: height / 2, spread: 0 };
  }

  const centroidX = sumX / mass;
  const centroidY = sumY / mass;

  // Calculate spread (standard deviation from centroid)
  let spreadSum = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const val = state[y * width + x];
      if (val > 0) {
        const dx = x - centroidX;
        const dy = y - centroidY;
        spreadSum += val * (dx * dx + dy * dy);
      }
    }
  }

  return {
    mass,
    centroidX,
    centroidY,
    spread: Math.sqrt(spreadSum / mass),
  };
}

/**
 * Detect period using state hash comparison
 * Returns exact period if states repeat exactly
 */
export function detectExactPeriod(
  stateHistory: Float32Array[],
  maxPeriod: number
): number {
  if (stateHistory.length < 2) return 0;

  const hashes = stateHistory.map(s => hashState(s));
  const lastHash = hashes[hashes.length - 1];

  // Look for exact matches going backwards
  for (let period = 1; period <= Math.min(maxPeriod, stateHistory.length - 1); period++) {
    const compareIdx = stateHistory.length - 1 - period;
    if (hashes[compareIdx] === lastHash) {
      // Verify the period by checking more states
      let isValidPeriod = true;
      for (let i = 0; i < Math.min(period, compareIdx); i++) {
        const idx1 = stateHistory.length - 1 - i;
        const idx2 = idx1 - period;
        if (idx2 >= 0 && hashes[idx1] !== hashes[idx2]) {
          isValidPeriod = false;
          break;
        }
      }
      if (isValidPeriod) {
        return period;
      }
    }
  }

  return 0;
}

/**
 * Detect period from feature time series
 */
export function detectPeriodFromFeatures(
  features: StateFeatures[],
  config: Partial<PeriodConfig> = {}
): PeriodResult {
  const fullConfig = { ...DEFAULT_PERIOD_CONFIG, ...config };
  const { maxPeriod, correlationThreshold, staticThreshold } = fullConfig;

  if (features.length < 3) {
    return {
      period: 0,
      confidence: 0,
      isExactPeriod: false,
      candidates: [],
      behavior: 'static',
      autocorrelation: [],
    };
  }

  // Extract mass series (most reliable feature for period detection)
  const massSeries = features.map(f => f.mass);

  // Check if static (constant mass)
  const massRange = Math.max(...massSeries) - Math.min(...massSeries);
  const massMax = Math.max(...massSeries);
  if (massMax > 0 && massRange / massMax < staticThreshold) {
    return {
      period: 0,
      confidence: 1,
      isExactPeriod: false,
      candidates: [],
      behavior: 'static',
      autocorrelation: [],
    };
  }

  // Calculate autocorrelation
  const acf = autocorrelation(massSeries, Math.min(maxPeriod, features.length - 1));

  // Find peaks
  const peaks = findAutocorrelationPeaks(acf, correlationThreshold * 0.5);

  // Build candidates list
  const candidates = peaks
    .filter(p => p.value >= correlationThreshold * 0.5)
    .slice(0, 5)
    .map(p => ({ period: p.lag, strength: p.value }));

  // Determine best period
  let bestPeriod = 0;
  let confidence = 0;
  let behavior: 'static' | 'periodic' | 'quasi-periodic' | 'chaotic' = 'chaotic';

  if (peaks.length > 0 && peaks[0].value >= correlationThreshold) {
    bestPeriod = peaks[0].lag;
    confidence = peaks[0].value;
    behavior = 'periodic';

    // Check for quasi-periodicity (multiple incommensurate periods)
    if (peaks.length >= 2 && peaks[1].value >= correlationThreshold * 0.8) {
      const ratio = peaks[0].lag / peaks[1].lag;
      // If ratio is not close to an integer, it's quasi-periodic
      if (Math.abs(ratio - Math.round(ratio)) > 0.1) {
        behavior = 'quasi-periodic';
      }
    }
  }

  return {
    period: bestPeriod,
    confidence,
    isExactPeriod: false,
    candidates,
    behavior,
    autocorrelation: acf,
  };
}

/**
 * Full period detection from state history
 */
export function detectPeriod(
  stateHistory: Float32Array[],
  width: number,
  height: number,
  config: Partial<PeriodConfig> = {}
): PeriodResult {
  const fullConfig = { ...DEFAULT_PERIOD_CONFIG, ...config };

  if (stateHistory.length < 3) {
    return {
      period: 0,
      confidence: 0,
      isExactPeriod: false,
      candidates: [],
      behavior: 'static',
      autocorrelation: [],
    };
  }

  // First try exact period detection
  let exactPeriod = 0;
  if (fullConfig.checkExactMatch) {
    exactPeriod = detectExactPeriod(stateHistory, fullConfig.maxPeriod);
  }

  // Extract features for correlation-based detection
  const features = stateHistory.map(s => extractFeatures(s, width, height));
  const result = detectPeriodFromFeatures(features, fullConfig);

  // If exact period found, use it
  if (exactPeriod > 0) {
    return {
      ...result,
      period: exactPeriod,
      isExactPeriod: true,
      confidence: 1,
      behavior: exactPeriod === 1 ? 'static' : 'periodic',
    };
  }

  return result;
}

/**
 * Track periodicity incrementally (for real-time detection)
 */
export class PeriodTracker {
  private features: StateFeatures[] = [];
  private hashes: string[] = [];
  private width: number;
  private height: number;
  private config: PeriodConfig;
  private maxHistory: number;

  constructor(
    width: number,
    height: number,
    config: Partial<PeriodConfig> = {},
    maxHistory: number = 500
  ) {
    this.width = width;
    this.height = height;
    this.config = { ...DEFAULT_PERIOD_CONFIG, ...config };
    this.maxHistory = maxHistory;
  }

  /**
   * Add a new state to the tracker
   */
  push(state: Float32Array): void {
    this.features.push(extractFeatures(state, this.width, this.height));
    this.hashes.push(hashState(state));

    // Trim to max history
    if (this.features.length > this.maxHistory) {
      this.features.shift();
      this.hashes.shift();
    }
  }

  /**
   * Get current period analysis
   */
  analyze(): PeriodResult {
    if (this.features.length < 3) {
      return {
        period: 0,
        confidence: 0,
        isExactPeriod: false,
        candidates: [],
        behavior: 'static',
        autocorrelation: [],
      };
    }

    // Check for exact period using hashes
    let exactPeriod = 0;
    if (this.config.checkExactMatch && this.hashes.length >= 2) {
      const lastHash = this.hashes[this.hashes.length - 1];
      for (let period = 1; period <= Math.min(this.config.maxPeriod, this.hashes.length - 1); period++) {
        const idx = this.hashes.length - 1 - period;
        if (this.hashes[idx] === lastHash) {
          exactPeriod = period;
          break;
        }
      }
    }

    const result = detectPeriodFromFeatures(this.features, this.config);

    if (exactPeriod > 0) {
      return {
        ...result,
        period: exactPeriod,
        isExactPeriod: true,
        confidence: 1,
        behavior: exactPeriod === 1 ? 'static' : 'periodic',
      };
    }

    return result;
  }

  /**
   * Clear history
   */
  clear(): void {
    this.features = [];
    this.hashes = [];
  }

  /**
   * Get current history length
   */
  get historyLength(): number {
    return this.features.length;
  }
}

/**
 * Classify period behavior
 */
export function classifyPeriodBehavior(
  result: PeriodResult
): string {
  if (result.behavior === 'static') {
    return 'Fixed point (no change)';
  }

  if (result.isExactPeriod) {
    if (result.period === 1) {
      return 'Fixed point (static)';
    } else if (result.period === 2) {
      return 'Period-2 oscillator';
    } else {
      return `Period-${result.period} cycle`;
    }
  }

  switch (result.behavior) {
    case 'periodic':
      return `Approximately period-${result.period} (${(result.confidence * 100).toFixed(0)}% confidence)`;
    case 'quasi-periodic':
      return 'Quasi-periodic (multiple frequencies)';
    case 'chaotic':
      return 'Aperiodic/chaotic';
    default:
      return 'Unknown';
  }
}
