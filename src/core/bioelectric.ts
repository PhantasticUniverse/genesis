/**
 * Bioelectric Pattern Dynamics
 * Simple bioelectric signaling inspired by BETSE (Bioelectric Tissue Simulation Engine)
 *
 * Models voltage-gated ion dynamics and gap junction coupling for
 * cell-to-cell communication and pattern formation.
 *
 * Reference: Levin, M. (2012) "Morphogenetic fields in embryogenesis"
 */

/** Bioelectric channel types */
export type BioelectricChannelType =
  | 'voltage'      // Membrane potential (Vm)
  | 'sodium'       // Na+ ion concentration
  | 'potassium'    // K+ ion concentration
  | 'calcium'      // Ca2+ ion concentration
  | 'morphogen';   // Generic morphogen/signaling molecule

/** Configuration for a bioelectric channel */
export interface BioelectricChannelConfig {
  type: BioelectricChannelType;
  name: string;
  color: [number, number, number];

  /** Resting/equilibrium value (default: varies by type) */
  restingValue: number;

  /** Decay rate toward resting value (default: 0.01) */
  decayRate: number;

  /** Diffusion coefficient (default: 0.05) */
  diffusionRate: number;

  /** Gap junction conductance (default: 0.1) */
  gapJunctionConductance: number;
}

/** Configuration for bioelectric simulation */
export interface BioelectricConfig {
  /** Grid dimensions */
  width: number;
  height: number;

  /** Channels to simulate */
  channels: BioelectricChannelConfig[];

  /** Time step for integration (default: 0.1) */
  dt: number;

  /** Whether to wrap at boundaries (default: true) */
  wrapBoundaries: boolean;

  /** Global leak conductance (default: 0.01) */
  leakConductance: number;
}

/** Default channel configurations by type */
export const DEFAULT_CHANNEL_CONFIGS: Record<BioelectricChannelType, Omit<BioelectricChannelConfig, 'name' | 'color'>> = {
  voltage: {
    type: 'voltage',
    restingValue: -0.07,  // -70mV normalized to ~-0.07
    decayRate: 0.02,
    diffusionRate: 0.02,
    gapJunctionConductance: 0.15,
  },
  sodium: {
    type: 'sodium',
    restingValue: 0.14,   // ~140mM outside / normalized
    decayRate: 0.01,
    diffusionRate: 0.03,
    gapJunctionConductance: 0.1,
  },
  potassium: {
    type: 'potassium',
    restingValue: 0.5,    // ~5mM outside, 140mM inside
    decayRate: 0.01,
    diffusionRate: 0.02,
    gapJunctionConductance: 0.1,
  },
  calcium: {
    type: 'calcium',
    restingValue: 0.001,  // Very low resting Ca2+
    decayRate: 0.05,      // Ca2+ actively pumped out
    diffusionRate: 0.01,
    gapJunctionConductance: 0.05,
  },
  morphogen: {
    type: 'morphogen',
    restingValue: 0,
    decayRate: 0.005,
    diffusionRate: 0.08,
    gapJunctionConductance: 0,  // Morphogens don't use gap junctions
  },
};

export const DEFAULT_BIOELECTRIC_CONFIG: BioelectricConfig = {
  width: 256,
  height: 256,
  channels: [
    {
      ...DEFAULT_CHANNEL_CONFIGS.voltage,
      name: 'Membrane Potential',
      color: [100, 200, 255],
    },
  ],
  dt: 0.1,
  wrapBoundaries: true,
  leakConductance: 0.01,
};

/** State of a bioelectric simulation */
export interface BioelectricState {
  /** Channel data (one Float32Array per channel) */
  channels: Float32Array[];

  /** Current step number */
  step: number;

  /** Configuration */
  config: BioelectricConfig;
}

/**
 * Create initial bioelectric state
 */
export function createBioelectricState(config: Partial<BioelectricConfig> = {}): BioelectricState {
  const fullConfig = { ...DEFAULT_BIOELECTRIC_CONFIG, ...config };
  const { width, height, channels: channelConfigs } = fullConfig;

  const channels = channelConfigs.map(channelConfig => {
    const data = new Float32Array(width * height);
    // Initialize to resting value
    data.fill(channelConfig.restingValue);
    return data;
  });

  return {
    channels,
    step: 0,
    config: fullConfig,
  };
}

/**
 * Apply stimulus to a region
 */
export function applyStimulus(
  state: BioelectricState,
  channelIndex: number,
  centerX: number,
  centerY: number,
  radius: number,
  magnitude: number
): void {
  const { width, height } = state.config;
  const channel = state.channels[channelIndex];
  if (!channel) return;

  const r2 = radius * radius;

  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      const d2 = dx * dx + dy * dy;
      if (d2 > r2) continue;

      let x = centerX + dx;
      let y = centerY + dy;

      if (state.config.wrapBoundaries) {
        x = ((x % width) + width) % width;
        y = ((y % height) + height) % height;
      } else {
        if (x < 0 || x >= width || y < 0 || y >= height) continue;
      }

      const idx = y * width + x;
      // Gaussian-weighted stimulus
      const weight = Math.exp(-d2 / (2 * (radius / 2) ** 2));
      channel[idx] += magnitude * weight;
    }
  }
}

/**
 * Calculate Laplacian (diffusion term) at a point
 */
function laplacian(
  channel: Float32Array,
  x: number,
  y: number,
  width: number,
  height: number,
  wrap: boolean
): number {
  const getVal = (px: number, py: number): number => {
    if (wrap) {
      px = ((px % width) + width) % width;
      py = ((py % height) + height) % height;
    } else {
      if (px < 0 || px >= width || py < 0 || py >= height) {
        return channel[y * width + x]; // Neumann boundary
      }
    }
    return channel[py * width + px];
  };

  const center = channel[y * width + x];
  const left = getVal(x - 1, y);
  const right = getVal(x + 1, y);
  const up = getVal(x, y - 1);
  const down = getVal(x, y + 1);

  // 5-point stencil Laplacian
  return left + right + up + down - 4 * center;
}

/**
 * Single integration step for bioelectric dynamics
 *
 * Dynamics equation:
 * dVm/dt = -g_leak * (Vm - V_rest) + g_gap * Laplacian(Vm) + D * Laplacian(Vm)
 */
export function stepBioelectric(state: BioelectricState): void {
  const { width, height, channels: channelConfigs, dt, wrapBoundaries, leakConductance } = state.config;

  // Create temporary arrays for updates
  const updates = state.channels.map(ch => new Float32Array(ch.length));

  for (let c = 0; c < state.channels.length; c++) {
    const channel = state.channels[c];
    const config = channelConfigs[c];
    const update = updates[c];

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;
        const value = channel[idx];

        // Leak current (decay toward resting value)
        const leak = -leakConductance * config.decayRate * (value - config.restingValue);

        // Diffusion (Laplacian)
        const lap = laplacian(channel, x, y, width, height, wrapBoundaries);
        const diffusion = config.diffusionRate * lap;

        // Gap junction coupling (similar to diffusion but with different conductance)
        const gapCoupling = config.gapJunctionConductance * lap;

        // Update
        update[idx] = value + dt * (leak + diffusion + gapCoupling);

        // Clamp to reasonable range
        update[idx] = Math.max(-1, Math.min(1, update[idx]));
      }
    }
  }

  // Apply updates
  for (let c = 0; c < state.channels.length; c++) {
    state.channels[c].set(updates[c]);
  }

  state.step++;
}

/**
 * Step multiple times
 */
export function stepBioelectricN(state: BioelectricState, n: number): void {
  for (let i = 0; i < n; i++) {
    stepBioelectric(state);
  }
}

/**
 * Create a voltage wave pattern (for testing/demo)
 */
export function createVoltageWave(
  state: BioelectricState,
  channelIndex: number,
  direction: 'horizontal' | 'vertical' | 'radial',
  wavelength: number = 50,
  amplitude: number = 0.5
): void {
  const { width, height } = state.config;
  const channel = state.channels[channelIndex];
  if (!channel) return;

  const centerX = width / 2;
  const centerY = height / 2;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;

      let phase: number;
      switch (direction) {
        case 'horizontal':
          phase = (x / wavelength) * 2 * Math.PI;
          break;
        case 'vertical':
          phase = (y / wavelength) * 2 * Math.PI;
          break;
        case 'radial':
          const r = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);
          phase = (r / wavelength) * 2 * Math.PI;
          break;
      }

      channel[idx] = amplitude * Math.sin(phase);
    }
  }
}

/**
 * Create gradient pattern
 */
export function createGradient(
  state: BioelectricState,
  channelIndex: number,
  direction: 'left-right' | 'top-bottom' | 'radial',
  minValue: number = 0,
  maxValue: number = 1
): void {
  const { width, height } = state.config;
  const channel = state.channels[channelIndex];
  if (!channel) return;

  const centerX = width / 2;
  const centerY = height / 2;
  const maxR = Math.sqrt(centerX ** 2 + centerY ** 2);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;

      let t: number;
      switch (direction) {
        case 'left-right':
          t = x / (width - 1);
          break;
        case 'top-bottom':
          t = y / (height - 1);
          break;
        case 'radial':
          const r = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);
          t = 1 - r / maxR;
          break;
      }

      channel[idx] = minValue + t * (maxValue - minValue);
    }
  }
}

/**
 * Get statistics for a channel
 */
export function getChannelStats(channel: Float32Array): {
  min: number;
  max: number;
  mean: number;
  std: number;
} {
  let min = Infinity;
  let max = -Infinity;
  let sum = 0;

  for (let i = 0; i < channel.length; i++) {
    const v = channel[i];
    min = Math.min(min, v);
    max = Math.max(max, v);
    sum += v;
  }

  const mean = sum / channel.length;

  let variance = 0;
  for (let i = 0; i < channel.length; i++) {
    variance += (channel[i] - mean) ** 2;
  }
  variance /= channel.length;

  return { min, max, mean, std: Math.sqrt(variance) };
}

/**
 * Render bioelectric state to RGB
 */
export function bioelectricToRGB(
  state: BioelectricState,
  normalize: boolean = true
): Uint8ClampedArray {
  const { width, height, channels: channelConfigs } = state.config;
  const rgba = new Uint8ClampedArray(width * height * 4);

  // Get normalization ranges if needed
  const ranges = normalize
    ? state.channels.map(ch => getChannelStats(ch))
    : state.channels.map(() => ({ min: -1, max: 1, mean: 0, std: 1 }));

  for (let i = 0; i < width * height; i++) {
    let r = 0, g = 0, b = 0;

    for (let c = 0; c < state.channels.length; c++) {
      const value = state.channels[c][i];
      const config = channelConfigs[c];
      const range = ranges[c];

      // Normalize to 0-1
      let normalized: number;
      if (range.max - range.min > 0.001) {
        normalized = (value - range.min) / (range.max - range.min);
      } else {
        normalized = 0.5;
      }
      normalized = Math.max(0, Math.min(1, normalized));

      r += normalized * config.color[0];
      g += normalized * config.color[1];
      b += normalized * config.color[2];
    }

    rgba[i * 4 + 0] = Math.min(255, r);
    rgba[i * 4 + 1] = Math.min(255, g);
    rgba[i * 4 + 2] = Math.min(255, b);
    rgba[i * 4 + 3] = 255;
  }

  return rgba;
}

/** Preset bioelectric configurations */
export const BIOELECTRIC_PRESETS: Record<string, Partial<BioelectricConfig>> = {
  /** Simple voltage diffusion */
  'voltage-only': {
    channels: [
      {
        ...DEFAULT_CHANNEL_CONFIGS.voltage,
        name: 'Membrane Potential',
        color: [100, 200, 255],
      },
    ],
  },

  /** Voltage with calcium signaling */
  'voltage-calcium': {
    channels: [
      {
        ...DEFAULT_CHANNEL_CONFIGS.voltage,
        name: 'Vm',
        color: [100, 150, 255],
      },
      {
        ...DEFAULT_CHANNEL_CONFIGS.calcium,
        name: 'Ca2+',
        color: [255, 200, 50],
      },
    ],
  },

  /** Full ion channel model */
  'ion-channels': {
    channels: [
      {
        ...DEFAULT_CHANNEL_CONFIGS.voltage,
        name: 'Vm',
        color: [100, 150, 255],
      },
      {
        ...DEFAULT_CHANNEL_CONFIGS.sodium,
        name: 'Na+',
        color: [255, 100, 100],
      },
      {
        ...DEFAULT_CHANNEL_CONFIGS.potassium,
        name: 'K+',
        color: [100, 255, 100],
      },
    ],
  },

  /** Morphogen gradient formation */
  'morphogen-gradient': {
    channels: [
      {
        ...DEFAULT_CHANNEL_CONFIGS.morphogen,
        name: 'Morphogen A',
        color: [255, 150, 50],
        diffusionRate: 0.1,
        decayRate: 0.01,
      },
      {
        ...DEFAULT_CHANNEL_CONFIGS.morphogen,
        name: 'Morphogen B',
        color: [50, 150, 255],
        diffusionRate: 0.05,
        decayRate: 0.02,
      },
    ],
  },

  /** Reaction-diffusion-like (Turing patterns) */
  'turing-pattern': {
    channels: [
      {
        ...DEFAULT_CHANNEL_CONFIGS.morphogen,
        name: 'Activator',
        color: [255, 200, 100],
        diffusionRate: 0.05,
        decayRate: 0.01,
        restingValue: 0.5,
      },
      {
        ...DEFAULT_CHANNEL_CONFIGS.morphogen,
        name: 'Inhibitor',
        color: [100, 100, 255],
        diffusionRate: 0.2,  // Inhibitor diffuses faster
        decayRate: 0.02,
        restingValue: 0.5,
      },
    ],
    leakConductance: 0.005,
  },
};
