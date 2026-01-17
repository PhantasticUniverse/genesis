/**
 * Differentiable Cellular Automata
 * Enables gradient-based training of CA parameters
 *
 * Key concepts:
 * - Soft growth functions with smooth derivatives
 * - Gradient accumulation through time steps
 * - Parameter optimization via backpropagation
 */

export interface CAParameters {
  // Kernel parameters (learnable)
  kernelWeights: Float32Array; // Kernel shape weights
  kernelRadius: number;

  // Growth function parameters (learnable)
  growthCenter: number; // μ
  growthWidth: number; // σ

  // Time step (learnable or fixed)
  dt: number;
}

export interface CAGradients {
  kernelWeights: Float32Array;
  growthCenter: number;
  growthWidth: number;
  dt: number;
}

/**
 * Soft growth function with smooth derivative
 * g(n) = 2 * sigmoid((1 - ((n - μ) / (3σ))²)⁴ * 10) - 1
 * This is differentiable everywhere
 */
export function softGrowth(n: number, mu: number, sigma: number): number {
  const x = (n - mu) / (3 * sigma);
  if (Math.abs(x) >= 1) {
    return -1;
  }
  const t = 1 - x * x;
  const t4 = t * t * t * t;
  return 2 * t4 - 1;
}

/**
 * Derivative of soft growth function with respect to n
 * Used for backpropagation
 */
export function softGrowthDerivative(
  n: number,
  mu: number,
  sigma: number,
): number {
  const x = (n - mu) / (3 * sigma);
  if (Math.abs(x) >= 1) {
    return 0;
  }
  const t = 1 - x * x;
  const t3 = t * t * t;
  // d/dn of 2*(1-x²)⁴ - 1 = 2*4*(1-x²)³*(-2x)*dx/dn
  // where dx/dn = 1/(3σ)
  return 2 * 4 * t3 * (-2 * x) * (1 / (3 * sigma));
}

/**
 * Derivative of soft growth with respect to μ
 */
export function softGrowthDerivativeMu(
  n: number,
  mu: number,
  sigma: number,
): number {
  // dx/dμ = -1/(3σ)
  return -softGrowthDerivative(n, mu, sigma);
}

/**
 * Derivative of soft growth with respect to σ
 */
export function softGrowthDerivativeSigma(
  n: number,
  mu: number,
  sigma: number,
): number {
  const x = (n - mu) / (3 * sigma);
  if (Math.abs(x) >= 1) {
    return 0;
  }
  const t = 1 - x * x;
  const t3 = t * t * t;
  // dx/dσ = -(n-μ)/(3σ²) = -x/σ
  const dxds = -x / sigma;
  return 2 * 4 * t3 * (-2 * x) * dxds;
}

/**
 * Forward pass state
 * Stores intermediate values needed for backpropagation
 */
export interface ForwardCache {
  states: Float32Array[]; // State at each time step
  neighborSums: Float32Array[]; // Convolution results
  growthValues: Float32Array[]; // Growth function outputs
}

/**
 * Differentiable CA forward pass (CPU implementation for training)
 * In production, this would be a GPU shader
 */
export function forwardPass(
  initialState: Float32Array,
  params: CAParameters,
  width: number,
  height: number,
  steps: number,
): { finalState: Float32Array; cache: ForwardCache } {
  const cache: ForwardCache = {
    states: [new Float32Array(initialState)],
    neighborSums: [],
    growthValues: [],
  };

  let state = new Float32Array(initialState);
  const kernelSize = params.kernelRadius * 2 + 1;

  for (let step = 0; step < steps; step++) {
    const neighborSums = new Float32Array(width * height);
    const growthValues = new Float32Array(width * height);
    const newState = new Float32Array(width * height);

    // Convolution
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let sum = 0;
        let kernelSum = 0;

        for (let ky = 0; ky < kernelSize; ky++) {
          for (let kx = 0; kx < kernelSize; kx++) {
            const nx = (x + kx - params.kernelRadius + width) % width;
            const ny = (y + ky - params.kernelRadius + height) % height;
            const kernelWeight = params.kernelWeights[ky * kernelSize + kx];
            sum += state[ny * width + nx] * kernelWeight;
            kernelSum += kernelWeight;
          }
        }

        neighborSums[y * width + x] = kernelSum > 0 ? sum / kernelSum : 0;
      }
    }

    // Growth function
    for (let i = 0; i < width * height; i++) {
      growthValues[i] = softGrowth(
        neighborSums[i],
        params.growthCenter,
        params.growthWidth,
      );
    }

    // State update
    for (let i = 0; i < width * height; i++) {
      newState[i] = Math.max(
        0,
        Math.min(1, state[i] + params.dt * growthValues[i]),
      );
    }

    cache.neighborSums.push(neighborSums);
    cache.growthValues.push(growthValues);
    cache.states.push(new Float32Array(newState));
    state = newState;
  }

  return { finalState: state, cache };
}

/**
 * Backward pass - compute gradients through time
 */
export function backwardPass(
  cache: ForwardCache,
  params: CAParameters,
  targetState: Float32Array,
  width: number,
  height: number,
): CAGradients {
  const steps = cache.states.length - 1;
  const kernelSize = params.kernelRadius * 2 + 1;

  const gradients: CAGradients = {
    kernelWeights: new Float32Array(kernelSize * kernelSize),
    growthCenter: 0,
    growthWidth: 0,
    dt: 0,
  };

  // Loss gradient: dL/dState_final = 2 * (state - target)
  let stateGradient = new Float32Array(width * height);
  for (let i = 0; i < width * height; i++) {
    stateGradient[i] = 2 * (cache.states[steps][i] - targetState[i]);
  }

  // Backpropagate through time
  for (let step = steps - 1; step >= 0; step--) {
    const state = cache.states[step];
    const neighborSums = cache.neighborSums[step];
    const growthValues = cache.growthValues[step];

    // Gradient through clamp (pass through if within [0, 1])
    const clampGradient = new Float32Array(width * height);
    for (let i = 0; i < width * height; i++) {
      const newVal = state[i] + params.dt * growthValues[i];
      clampGradient[i] = newVal > 0 && newVal < 1 ? stateGradient[i] : 0;
    }

    // Gradient through state update: new = old + dt * growth
    // dL/dold = dL/dnew * 1
    // dL/ddt = dL/dnew * growth
    // dL/dgrowth = dL/dnew * dt
    const growthGradient = new Float32Array(width * height);
    for (let i = 0; i < width * height; i++) {
      growthGradient[i] = clampGradient[i] * params.dt;
      gradients.dt += clampGradient[i] * growthValues[i];
    }

    // Gradient through growth function
    const neighborSumGradient = new Float32Array(width * height);
    for (let i = 0; i < width * height; i++) {
      const dgdn = softGrowthDerivative(
        neighborSums[i],
        params.growthCenter,
        params.growthWidth,
      );
      const dgdmu = softGrowthDerivativeMu(
        neighborSums[i],
        params.growthCenter,
        params.growthWidth,
      );
      const dgdsigma = softGrowthDerivativeSigma(
        neighborSums[i],
        params.growthCenter,
        params.growthWidth,
      );

      neighborSumGradient[i] = growthGradient[i] * dgdn;
      gradients.growthCenter += growthGradient[i] * dgdmu;
      gradients.growthWidth += growthGradient[i] * dgdsigma;
    }

    // Gradient through convolution
    const newStateGradient = new Float32Array(width * height);
    for (let i = 0; i < width * height; i++) {
      newStateGradient[i] = clampGradient[i]; // Gradient from state update
    }

    // Backprop through convolution to kernel weights and previous state
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;
        let kernelSum = 0;
        for (let i = 0; i < kernelSize * kernelSize; i++) {
          kernelSum += params.kernelWeights[i];
        }
        if (kernelSum === 0) continue;

        for (let ky = 0; ky < kernelSize; ky++) {
          for (let kx = 0; kx < kernelSize; kx++) {
            const nx = (x + kx - params.kernelRadius + width) % width;
            const ny = (y + ky - params.kernelRadius + height) % height;
            const kidx = ky * kernelSize + kx;

            // Gradient to kernel weight
            gradients.kernelWeights[kidx] +=
              (neighborSumGradient[idx] * state[ny * width + nx]) / kernelSum;

            // Gradient to previous state
            newStateGradient[ny * width + nx] +=
              (neighborSumGradient[idx] * params.kernelWeights[kidx]) /
              kernelSum;
          }
        }
      }
    }

    stateGradient = newStateGradient;
  }

  return gradients;
}

/**
 * Mean squared error loss
 */
export function mseLoss(
  prediction: Float32Array,
  target: Float32Array,
): number {
  let sum = 0;
  for (let i = 0; i < prediction.length; i++) {
    const diff = prediction[i] - target[i];
    sum += diff * diff;
  }
  return sum / prediction.length;
}

/**
 * Create target state for training (e.g., move to position)
 */
export function createTargetState(
  currentState: Float32Array,
  width: number,
  height: number,
  targetX: number,
  targetY: number,
): Float32Array {
  // Shift the pattern toward target position
  const target = new Float32Array(width * height);

  // Calculate current center of mass
  let cx = 0,
    cy = 0,
    total = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const val = currentState[y * width + x];
      cx += x * val;
      cy += y * val;
      total += val;
    }
  }
  if (total > 0) {
    cx /= total;
    cy /= total;
  }

  // Shift toward target
  const shiftX = Math.round((targetX - cx) * 0.5);
  const shiftY = Math.round((targetY - cy) * 0.5);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const srcX = (x - shiftX + width) % width;
      const srcY = (y - shiftY + height) % height;
      target[y * width + x] = currentState[srcY * width + srcX];
    }
  }

  return target;
}
