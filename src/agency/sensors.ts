/**
 * Sensor Systems
 * Gradient detection and proximity sensing for creatures
 */

/**
 * Sobel-like gradient detection kernels
 * Returns dx, dy components of gradient
 */
export const SOBEL_X = new Float32Array([-1, 0, 1, -2, 0, 2, -1, 0, 1]);

export const SOBEL_Y = new Float32Array([-1, -2, -1, 0, 0, 0, 1, 2, 1]);

/**
 * Larger gradient kernel for smoother sensing
 */
export function createGradientKernel(radius: number): {
  kernelX: Float32Array;
  kernelY: Float32Array;
  size: number;
} {
  const size = radius * 2 + 1;
  const kernelX = new Float32Array(size * size);
  const kernelY = new Float32Array(size * size);

  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      const idx = (dy + radius) * size + (dx + radius);
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist > 0 && dist <= radius) {
        // Weight by inverse distance, normalized direction
        const weight = 1 / (1 + dist);
        kernelX[idx] = (dx / dist) * weight;
        kernelY[idx] = (dy / dist) * weight;
      }
    }
  }

  return { kernelX, kernelY, size };
}

/**
 * Proximity sensor kernel
 * Detects nearby objects with distance falloff
 */
export function createProximityKernel(
  radius: number,
  decay: number = 0.9,
): Float32Array {
  const size = radius * 2 + 1;
  const kernel = new Float32Array(size * size);
  let sum = 0;

  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      const idx = (dy + radius) * size + (dx + radius);
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist <= radius) {
        // Exponential falloff with distance
        const value = Math.pow(decay, dist);
        kernel[idx] = value;
        sum += value;
      }
    }
  }

  // Normalize
  for (let i = 0; i < kernel.length; i++) {
    kernel[i] /= sum;
  }

  return kernel;
}

/**
 * Asymmetric motor kernel for directional movement
 * Creates growth bias in a particular direction
 */
export function createMotorKernel(
  radius: number,
  direction: { x: number; y: number },
  strength: number = 1.0,
): Float32Array {
  const size = radius * 2 + 1;
  const kernel = new Float32Array(size * size);

  // Normalize direction
  const dirLen = Math.sqrt(
    direction.x * direction.x + direction.y * direction.y,
  );
  const normDir =
    dirLen > 0
      ? { x: direction.x / dirLen, y: direction.y / dirLen }
      : { x: 0, y: 0 };

  let sum = 0;
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      const idx = (dy + radius) * size + (dx + radius);
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist > 0 && dist <= radius) {
        // Dot product with direction gives directional bias
        const dot = (dx * normDir.x + dy * normDir.y) / dist;
        // Gaussian base + directional bias
        const gaussValue = Math.exp(
          (-dist * dist) / (2 * (radius / 2) * (radius / 2)),
        );
        const biasedValue = gaussValue * (1 + strength * dot);
        kernel[idx] = Math.max(0, biasedValue);
        sum += kernel[idx];
      }
    }
  }

  // Normalize
  if (sum > 0) {
    for (let i = 0; i < kernel.length; i++) {
      kernel[i] /= sum;
    }
  }

  return kernel;
}

/**
 * Configuration for sensor system
 */
export interface SensorConfig {
  gradientRadius: number;
  proximityRadius: number;
  proximityDecay: number;
  motorRadius: number;
  motorStrength: number;
}

export const DEFAULT_SENSOR_CONFIG: SensorConfig = {
  gradientRadius: 5,
  proximityRadius: 15,
  proximityDecay: 0.85,
  motorRadius: 10,
  motorStrength: 0.5,
};

/**
 * Create all sensor kernels for the system
 */
export function createSensorKernels(
  config: SensorConfig = DEFAULT_SENSOR_CONFIG,
) {
  return {
    gradient: createGradientKernel(config.gradientRadius),
    proximity: createProximityKernel(
      config.proximityRadius,
      config.proximityDecay,
    ),
    motorBase: createMotorKernel(config.motorRadius, { x: 0, y: 0 }, 0),
  };
}
