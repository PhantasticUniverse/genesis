/**
 * Advanced Symmetry Analysis
 * K-fold symmetry detection using polar coordinate analysis
 *
 * Based on techniques from:
 * - Bert Chan's LeniaNDK symmetry analysis
 * - Polar Fourier descriptors for shape analysis
 */

/** Symmetry analysis result */
export interface SymmetryResult {
  /** Dominant symmetry order (1 = no symmetry, 2 = bilateral, etc.) */
  order: number;
  /** Strength of dominant symmetry (0-1) */
  strength: number;
  /** Strengths for each order tested */
  orderStrengths: Map<number, number>;
  /** Horizontal reflection symmetry (0-1) */
  horizontal: number;
  /** Vertical reflection symmetry (0-1) */
  vertical: number;
  /** 180° rotational symmetry (0-1) */
  rotational180: number;
  /** Center of mass used for analysis */
  center: { x: number; y: number };
}

/** Configuration for symmetry analysis */
export interface SymmetryConfig {
  /** Maximum order to test (default: 8) */
  maxOrder: number;
  /** Number of angular bins for polar analysis (default: 360) */
  angularBins: number;
  /** Number of radial bins (default: 50) */
  radialBins: number;
  /** Minimum mass threshold for analysis (default: 0.01) */
  massThreshold: number;
}

export const DEFAULT_SYMMETRY_CONFIG: SymmetryConfig = {
  maxOrder: 8,
  angularBins: 360,
  radialBins: 50,
  massThreshold: 0.01,
};

/**
 * Calculate center of mass for the pattern
 */
export function calculateCenterOfMass(
  state: Float32Array,
  width: number,
  height: number
): { x: number; y: number; mass: number } {
  let sumX = 0, sumY = 0, totalMass = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const value = state[y * width + x];
      if (value > 0) {
        sumX += x * value;
        sumY += y * value;
        totalMass += value;
      }
    }
  }

  if (totalMass === 0) {
    return { x: width / 2, y: height / 2, mass: 0 };
  }

  return {
    x: sumX / totalMass,
    y: sumY / totalMass,
    mass: totalMass,
  };
}

/**
 * Convert Cartesian coordinates to polar relative to center
 */
function toPolar(
  x: number,
  y: number,
  centerX: number,
  centerY: number
): { r: number; theta: number } {
  const dx = x - centerX;
  const dy = y - centerY;
  const r = Math.sqrt(dx * dx + dy * dy);
  let theta = Math.atan2(dy, dx);
  if (theta < 0) theta += 2 * Math.PI;
  return { r, theta };
}

/**
 * Create polar representation of the pattern
 * Returns a 2D array of [radial][angular] density values
 */
export function createPolarRepresentation(
  state: Float32Array,
  width: number,
  height: number,
  center: { x: number; y: number },
  config: SymmetryConfig
): Float32Array[] {
  const { angularBins, radialBins } = config;
  const maxRadius = Math.min(width, height) / 2;

  // Initialize polar grid
  const polar: Float32Array[] = [];
  const counts: number[][] = [];
  for (let r = 0; r < radialBins; r++) {
    polar.push(new Float32Array(angularBins));
    counts.push(new Array(angularBins).fill(0));
  }

  // Bin values into polar grid
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const value = state[y * width + x];
      if (value < config.massThreshold) continue;

      const { r, theta } = toPolar(x, y, center.x, center.y);

      if (r >= maxRadius) continue;

      const rBin = Math.min(radialBins - 1, Math.floor((r / maxRadius) * radialBins));
      const thetaBin = Math.floor((theta / (2 * Math.PI)) * angularBins) % angularBins;

      polar[rBin][thetaBin] += value;
      counts[rBin][thetaBin]++;
    }
  }

  // Normalize by counts
  for (let r = 0; r < radialBins; r++) {
    for (let t = 0; t < angularBins; t++) {
      if (counts[r][t] > 0) {
        polar[r][t] /= counts[r][t];
      }
    }
  }

  return polar;
}

/**
 * Calculate k-fold symmetry strength using polar DFT
 * Uses the magnitude of the k-th Fourier coefficient
 */
export function calculateKFoldSymmetry(
  polar: Float32Array[],
  k: number
): number {
  let totalPower = 0;
  let kPower = 0;

  // For each radial bin, calculate angular DFT
  for (const ring of polar) {
    const n = ring.length;

    // Calculate k-th Fourier coefficient
    let realK = 0, imagK = 0;
    let dc = 0; // DC component (average)

    for (let t = 0; t < n; t++) {
      const angle = (2 * Math.PI * k * t) / n;
      realK += ring[t] * Math.cos(angle);
      imagK += ring[t] * Math.sin(angle);
      dc += ring[t];
    }

    realK /= n;
    imagK /= n;
    dc /= n;

    const kMagnitude = Math.sqrt(realK * realK + imagK * imagK);

    // Normalize by DC component to get relative symmetry strength
    if (dc > 0.001) {
      kPower += kMagnitude / dc;
      totalPower += 1;
    }
  }

  if (totalPower === 0) return 0;

  // Average across all radial bins
  return Math.min(1, (kPower / totalPower) * 2);
}

/**
 * Calculate reflection symmetry (horizontal, vertical, or at arbitrary angle)
 */
export function calculateReflectionSymmetry(
  state: Float32Array,
  width: number,
  height: number,
  center: { x: number; y: number },
  angle: number = 0 // 0 = horizontal, PI/2 = vertical
): number {
  let matchSum = 0;
  let totalSum = 0;

  const cosA = Math.cos(angle);
  const sinA = Math.sin(angle);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const value = state[y * width + x];
      if (value < 0.01) continue;

      // Translate to center
      const dx = x - center.x;
      const dy = y - center.y;

      // Reflect across line at angle
      // Reflection formula: p' = 2(p·n)n - p where n is line normal
      const dotProduct = dx * cosA + dy * sinA;
      const rx = dx - 2 * dotProduct * cosA;
      const ry = dy - 2 * dotProduct * sinA;

      // Translate back
      const reflectedX = Math.round(rx + center.x);
      const reflectedY = Math.round(ry + center.y);

      if (reflectedX >= 0 && reflectedX < width && reflectedY >= 0 && reflectedY < height) {
        const reflectedValue = state[reflectedY * width + reflectedX];
        matchSum += Math.min(value, reflectedValue);
        totalSum += value;
      } else {
        totalSum += value;
      }
    }
  }

  if (totalSum === 0) return 0;
  return matchSum / totalSum;
}

/**
 * Calculate 180° rotational symmetry
 */
export function calculateRotationalSymmetry(
  state: Float32Array,
  width: number,
  height: number,
  center: { x: number; y: number }
): number {
  let matchSum = 0;
  let totalSum = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const value = state[y * width + x];
      if (value < 0.01) continue;

      // Rotate 180° around center
      const rx = Math.round(2 * center.x - x);
      const ry = Math.round(2 * center.y - y);

      if (rx >= 0 && rx < width && ry >= 0 && ry < height) {
        const rotatedValue = state[ry * width + rx];
        matchSum += Math.min(value, rotatedValue);
        totalSum += value;
      } else {
        totalSum += value;
      }
    }
  }

  if (totalSum === 0) return 0;
  return matchSum / totalSum;
}

/**
 * Comprehensive symmetry analysis
 */
export function analyzeSymmetry(
  state: Float32Array,
  width: number,
  height: number,
  config: Partial<SymmetryConfig> = {}
): SymmetryResult {
  const fullConfig = { ...DEFAULT_SYMMETRY_CONFIG, ...config };

  // Find center of mass
  const { x: centerX, y: centerY, mass } = calculateCenterOfMass(state, width, height);
  const center = { x: centerX, y: centerY };

  // If no significant mass, return default
  if (mass < fullConfig.massThreshold * width * height) {
    return {
      order: 1,
      strength: 0,
      orderStrengths: new Map([[1, 0]]),
      horizontal: 0,
      vertical: 0,
      rotational180: 0,
      center,
    };
  }

  // Create polar representation
  const polar = createPolarRepresentation(state, width, height, center, fullConfig);

  // Calculate k-fold symmetry for each order
  const orderStrengths = new Map<number, number>();
  let maxOrder = 1;
  let maxStrength = 0;

  for (let k = 1; k <= fullConfig.maxOrder; k++) {
    const strength = calculateKFoldSymmetry(polar, k);
    orderStrengths.set(k, strength);

    if (strength > maxStrength) {
      maxStrength = strength;
      maxOrder = k;
    }
  }

  // Calculate reflection symmetries
  const horizontal = calculateReflectionSymmetry(state, width, height, center, Math.PI / 2);
  const vertical = calculateReflectionSymmetry(state, width, height, center, 0);
  const rotational180 = calculateRotationalSymmetry(state, width, height, center);

  return {
    order: maxOrder,
    strength: maxStrength,
    orderStrengths,
    horizontal,
    vertical,
    rotational180,
    center,
  };
}

/**
 * Quick symmetry check (faster, less detailed)
 * Returns a single 0-1 score combining all symmetry measures
 */
export function quickSymmetryScore(
  state: Float32Array,
  width: number,
  height: number
): number {
  const { x: centerX, y: centerY, mass } = calculateCenterOfMass(state, width, height);

  if (mass < 0.01 * width * height) return 0;

  const center = { x: centerX, y: centerY };

  // Quick check of 2-fold, 4-fold symmetry and reflections
  const horizontal = calculateReflectionSymmetry(state, width, height, center, Math.PI / 2);
  const vertical = calculateReflectionSymmetry(state, width, height, center, 0);
  const rotational = calculateRotationalSymmetry(state, width, height, center);

  // Weighted combination (matches original calculateSymmetry weights)
  return horizontal * 0.3 + vertical * 0.3 + rotational * 0.4;
}

/**
 * Detect specific symmetry types
 */
export function detectSymmetryType(result: SymmetryResult): string[] {
  const types: string[] = [];

  if (result.horizontal > 0.8) types.push('bilateral-horizontal');
  if (result.vertical > 0.8) types.push('bilateral-vertical');
  if (result.rotational180 > 0.8) types.push('point-symmetric');

  if (result.order >= 2 && result.strength > 0.6) {
    types.push(`${result.order}-fold-rotational`);
  }

  if (result.order >= 4 && result.strength > 0.7) {
    types.push('radial');
  }

  if (types.length === 0) {
    types.push('asymmetric');
  }

  return types;
}
