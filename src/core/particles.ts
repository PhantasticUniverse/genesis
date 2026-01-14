/**
 * Particle System for Particle-Lenia Hybrid
 * Point entities that interact with each other and the Lenia field
 */

/** Single particle state */
export interface Particle {
  /** Unique ID */
  id: number;
  /** X position in grid coordinates */
  x: number;
  /** Y position in grid coordinates */
  y: number;
  /** X velocity */
  vx: number;
  /** Y velocity */
  vy: number;
  /** Particle type (for interaction rules) */
  type: number;
  /** Mass/influence of this particle */
  mass: number;
  /** Whether particle is active */
  active: boolean;
}

/** Interaction rule between two particle types */
export interface InteractionRule {
  /** Strength of attraction (positive) or repulsion (negative) */
  strength: number;
  /** Optimal distance (particles will tend toward this distance) */
  equilibriumDistance: number;
  /** Maximum interaction range */
  maxRange: number;
}

/** Particle system configuration */
export interface ParticleSystemConfig {
  /** Maximum number of particles */
  maxParticles: number;
  /** Number of particle types */
  numTypes: number;
  /** Grid width for spatial boundaries */
  gridWidth: number;
  /** Grid height for spatial boundaries */
  gridHeight: number;
  /** Whether boundaries wrap (toroidal) */
  wrapBoundaries: boolean;
  /** Global friction coefficient (0-1, higher = more friction) */
  friction: number;
  /** Time step for physics integration */
  dt: number;
}

/** Particle-field coupling configuration */
export interface FieldCouplingConfig {
  /** Whether particles deposit mass to field */
  depositEnabled: boolean;
  /** Amount of mass deposited per particle per step */
  depositAmount: number;
  /** Radius of mass deposit (Gaussian spread) */
  depositRadius: number;
  /** Whether particles respond to field gradients */
  gradientResponseEnabled: boolean;
  /** Strength of gradient response */
  gradientStrength: number;
}

/** Complete particle system state */
export interface ParticleSystemState {
  particles: Particle[];
  interactionMatrix: InteractionRule[][];
  config: ParticleSystemConfig;
  fieldCoupling: FieldCouplingConfig;
}

// Default configurations

export const DEFAULT_PARTICLE_CONFIG: ParticleSystemConfig = {
  maxParticles: 500,
  numTypes: 3,
  gridWidth: 512,
  gridHeight: 512,
  wrapBoundaries: true,
  friction: 0.02,
  dt: 0.5,
};

export const DEFAULT_FIELD_COUPLING: FieldCouplingConfig = {
  depositEnabled: true,
  depositAmount: 0.1,
  depositRadius: 5,
  gradientResponseEnabled: true,
  gradientStrength: 0.5,
};

/**
 * Create default interaction matrix
 * By default: same types attract weakly, different types repel
 */
export function createDefaultInteractionMatrix(numTypes: number): InteractionRule[][] {
  const matrix: InteractionRule[][] = [];

  for (let i = 0; i < numTypes; i++) {
    matrix[i] = [];
    for (let j = 0; j < numTypes; j++) {
      if (i === j) {
        // Same type: weak attraction
        matrix[i][j] = {
          strength: 0.5,
          equilibriumDistance: 20,
          maxRange: 50,
        };
      } else {
        // Different types: weak repulsion
        matrix[i][j] = {
          strength: -0.3,
          equilibriumDistance: 30,
          maxRange: 40,
        };
      }
    }
  }

  return matrix;
}

/**
 * Create particle system state
 */
export function createParticleSystem(
  config: Partial<ParticleSystemConfig> = {},
  fieldCoupling: Partial<FieldCouplingConfig> = {}
): ParticleSystemState {
  const fullConfig = { ...DEFAULT_PARTICLE_CONFIG, ...config };
  const fullCoupling = { ...DEFAULT_FIELD_COUPLING, ...fieldCoupling };

  return {
    particles: [],
    interactionMatrix: createDefaultInteractionMatrix(fullConfig.numTypes),
    config: fullConfig,
    fieldCoupling: fullCoupling,
  };
}

/**
 * Add a particle to the system
 */
export function addParticle(
  state: ParticleSystemState,
  x: number,
  y: number,
  type: number = 0,
  vx: number = 0,
  vy: number = 0,
  mass: number = 1
): Particle | null {
  if (state.particles.length >= state.config.maxParticles) {
    return null;
  }

  const particle: Particle = {
    id: state.particles.length,
    x,
    y,
    vx,
    vy,
    type: type % state.config.numTypes,
    mass,
    active: true,
  };

  state.particles.push(particle);
  return particle;
}

/**
 * Remove a particle by ID
 */
export function removeParticle(state: ParticleSystemState, id: number): boolean {
  const particle = state.particles.find(p => p.id === id);
  if (particle) {
    particle.active = false;
    return true;
  }
  return false;
}

/**
 * Get active particles
 */
export function getActiveParticles(state: ParticleSystemState): Particle[] {
  return state.particles.filter(p => p.active);
}

/**
 * Calculate force between two particles
 */
export function calculateForce(
  p1: Particle,
  p2: Particle,
  rule: InteractionRule,
  config: ParticleSystemConfig
): { fx: number; fy: number } {
  let dx = p2.x - p1.x;
  let dy = p2.y - p1.y;

  // Handle wrapping
  if (config.wrapBoundaries) {
    if (dx > config.gridWidth / 2) dx -= config.gridWidth;
    if (dx < -config.gridWidth / 2) dx += config.gridWidth;
    if (dy > config.gridHeight / 2) dy -= config.gridHeight;
    if (dy < -config.gridHeight / 2) dy += config.gridHeight;
  }

  const distance = Math.sqrt(dx * dx + dy * dy);

  if (distance < 0.01 || distance > rule.maxRange) {
    return { fx: 0, fy: 0 };
  }

  // Normalize direction
  const nx = dx / distance;
  const ny = dy / distance;

  // Calculate force magnitude using Lennard-Jones-like potential
  // F = strength * (equilibriumDistance/distance - 1)
  const relativeDistance = distance / rule.equilibriumDistance;
  let forceMagnitude: number;

  if (relativeDistance < 1) {
    // Repulsive at close range (regardless of attraction/repulsion setting)
    forceMagnitude = -Math.abs(rule.strength) * (1 / relativeDistance - 1);
  } else {
    // Attraction or repulsion based on rule
    // Positive strength = attraction (force toward other particle)
    // Negative strength = repulsion (force away from other particle)
    forceMagnitude = rule.strength * (relativeDistance - 1) / relativeDistance;
  }

  // Clamp force magnitude
  forceMagnitude = Math.max(-10, Math.min(10, forceMagnitude));

  return {
    fx: nx * forceMagnitude * p2.mass,
    fy: ny * forceMagnitude * p2.mass,
  };
}

/**
 * Update particle system for one time step (CPU version)
 */
export function updateParticleSystem(
  state: ParticleSystemState,
  fieldGradient?: { gx: Float32Array; gy: Float32Array }
): void {
  const { particles, interactionMatrix, config, fieldCoupling } = state;
  const activeParticles = particles.filter(p => p.active);

  // Calculate forces for each particle
  const forces = activeParticles.map(() => ({ fx: 0, fy: 0 }));

  // Particle-particle interactions
  for (let i = 0; i < activeParticles.length; i++) {
    const p1 = activeParticles[i];

    for (let j = i + 1; j < activeParticles.length; j++) {
      const p2 = activeParticles[j];
      const rule = interactionMatrix[p1.type][p2.type];
      const force = calculateForce(p1, p2, rule, config);

      forces[i].fx += force.fx;
      forces[i].fy += force.fy;
      forces[j].fx -= force.fx;
      forces[j].fy -= force.fy;
    }
  }

  // Field gradient response
  if (fieldCoupling.gradientResponseEnabled && fieldGradient) {
    const { gx, gy } = fieldGradient;
    const { gridWidth, gridHeight } = config;

    for (let i = 0; i < activeParticles.length; i++) {
      const p = activeParticles[i];
      const px = Math.floor(p.x) % gridWidth;
      const py = Math.floor(p.y) % gridHeight;
      const idx = py * gridWidth + px;

      if (idx >= 0 && idx < gx.length) {
        forces[i].fx += gx[idx] * fieldCoupling.gradientStrength;
        forces[i].fy += gy[idx] * fieldCoupling.gradientStrength;
      }
    }
  }

  // Update velocities and positions
  for (let i = 0; i < activeParticles.length; i++) {
    const p = activeParticles[i];

    // Apply forces (F = ma, assume m=1 for simplicity, so a = F/mass)
    p.vx += (forces[i].fx / p.mass) * config.dt;
    p.vy += (forces[i].fy / p.mass) * config.dt;

    // Apply friction
    p.vx *= (1 - config.friction);
    p.vy *= (1 - config.friction);

    // Clamp velocity
    const maxSpeed = 10;
    const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
    if (speed > maxSpeed) {
      p.vx = (p.vx / speed) * maxSpeed;
      p.vy = (p.vy / speed) * maxSpeed;
    }

    // Update position
    p.x += p.vx * config.dt;
    p.y += p.vy * config.dt;

    // Handle boundaries
    if (config.wrapBoundaries) {
      p.x = ((p.x % config.gridWidth) + config.gridWidth) % config.gridWidth;
      p.y = ((p.y % config.gridHeight) + config.gridHeight) % config.gridHeight;
    } else {
      // Bounce off walls
      if (p.x < 0) { p.x = 0; p.vx = -p.vx * 0.5; }
      if (p.x >= config.gridWidth) { p.x = config.gridWidth - 1; p.vx = -p.vx * 0.5; }
      if (p.y < 0) { p.y = 0; p.vy = -p.vy * 0.5; }
      if (p.y >= config.gridHeight) { p.y = config.gridHeight - 1; p.vy = -p.vy * 0.5; }
    }
  }
}

/**
 * Deposit particle mass onto a field (CPU version)
 */
export function depositToField(
  state: ParticleSystemState,
  field: Float32Array
): void {
  const { particles, config, fieldCoupling } = state;
  const { gridWidth, gridHeight } = config;
  const { depositAmount, depositRadius } = fieldCoupling;

  if (!fieldCoupling.depositEnabled) return;

  const activeParticles = particles.filter(p => p.active);
  const r = Math.ceil(depositRadius);

  for (const p of activeParticles) {
    const px = Math.floor(p.x);
    const py = Math.floor(p.y);

    // Deposit in a Gaussian pattern
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        let nx = px + dx;
        let ny = py + dy;

        // Wrap or skip out-of-bounds
        if (config.wrapBoundaries) {
          nx = ((nx % gridWidth) + gridWidth) % gridWidth;
          ny = ((ny % gridHeight) + gridHeight) % gridHeight;
        } else if (nx < 0 || nx >= gridWidth || ny < 0 || ny >= gridHeight) {
          continue;
        }

        const dist = Math.sqrt(dx * dx + dy * dy);
        const sigma = depositRadius / 2;
        const weight = Math.exp(-(dist * dist) / (2 * sigma * sigma));

        const idx = ny * gridWidth + nx;
        field[idx] = Math.min(1, field[idx] + depositAmount * weight * p.mass);
      }
    }
  }
}

/**
 * Calculate field gradient for particle response
 */
export function calculateFieldGradient(
  field: Float32Array,
  width: number,
  height: number
): { gx: Float32Array; gy: Float32Array } {
  const gx = new Float32Array(width * height);
  const gy = new Float32Array(width * height);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;

      // Sobel-like gradient
      const xm = ((x - 1) + width) % width;
      const xp = (x + 1) % width;
      const ym = ((y - 1) + height) % height;
      const yp = (y + 1) % height;

      gx[idx] = (field[y * width + xp] - field[y * width + xm]) / 2;
      gy[idx] = (field[yp * width + x] - field[ym * width + x]) / 2;
    }
  }

  return { gx, gy };
}

/**
 * Spawn particles in a random pattern
 */
export function spawnRandomParticles(
  state: ParticleSystemState,
  count: number,
  options: {
    centerX?: number;
    centerY?: number;
    spread?: number;
    typeDistribution?: number[];
  } = {}
): void {
  const { config } = state;
  const cx = options.centerX ?? config.gridWidth / 2;
  const cy = options.centerY ?? config.gridHeight / 2;
  const spread = options.spread ?? Math.min(config.gridWidth, config.gridHeight) / 4;
  const typeDist = options.typeDistribution ?? Array(config.numTypes).fill(1 / config.numTypes);

  for (let i = 0; i < count; i++) {
    // Random position with Gaussian distribution from center
    const angle = Math.random() * Math.PI * 2;
    const radius = spread * Math.sqrt(-2 * Math.log(Math.random()));
    const x = cx + radius * Math.cos(angle);
    const y = cy + radius * Math.sin(angle);

    // Random type based on distribution
    let type = 0;
    const r = Math.random();
    let cumulative = 0;
    for (let t = 0; t < typeDist.length; t++) {
      cumulative += typeDist[t];
      if (r < cumulative) {
        type = t;
        break;
      }
    }

    // Small random initial velocity
    const vx = (Math.random() - 0.5) * 2;
    const vy = (Math.random() - 0.5) * 2;

    addParticle(state, x, y, type, vx, vy);
  }
}

/**
 * Preset interaction matrices for common behaviors
 */
export const INTERACTION_PRESETS = {
  /** All particles attract each other */
  'attractive': (numTypes: number): InteractionRule[][] => {
    const matrix: InteractionRule[][] = [];
    for (let i = 0; i < numTypes; i++) {
      matrix[i] = [];
      for (let j = 0; j < numTypes; j++) {
        matrix[i][j] = {
          strength: 0.8,
          equilibriumDistance: 25,
          maxRange: 80,
        };
      }
    }
    return matrix;
  },

  /** Particles of same type cluster, different types repel */
  'clustering': (numTypes: number): InteractionRule[][] => {
    const matrix: InteractionRule[][] = [];
    for (let i = 0; i < numTypes; i++) {
      matrix[i] = [];
      for (let j = 0; j < numTypes; j++) {
        if (i === j) {
          matrix[i][j] = {
            strength: 1.0,
            equilibriumDistance: 15,
            maxRange: 60,
          };
        } else {
          matrix[i][j] = {
            strength: -0.5,
            equilibriumDistance: 40,
            maxRange: 50,
          };
        }
      }
    }
    return matrix;
  },

  /** Chain-like: A->B->C->A attraction */
  'chain': (numTypes: number): InteractionRule[][] => {
    const matrix: InteractionRule[][] = [];
    for (let i = 0; i < numTypes; i++) {
      matrix[i] = [];
      for (let j = 0; j < numTypes; j++) {
        const nextType = (i + 1) % numTypes;
        if (j === nextType) {
          // Attract to next type in chain
          matrix[i][j] = {
            strength: 1.2,
            equilibriumDistance: 20,
            maxRange: 100,
          };
        } else if (i === j) {
          // Mild same-type repulsion
          matrix[i][j] = {
            strength: -0.2,
            equilibriumDistance: 30,
            maxRange: 40,
          };
        } else {
          // Neutral
          matrix[i][j] = {
            strength: 0,
            equilibriumDistance: 30,
            maxRange: 30,
          };
        }
      }
    }
    return matrix;
  },

  /** Random interactions for emergence */
  'random': (numTypes: number): InteractionRule[][] => {
    const matrix: InteractionRule[][] = [];
    for (let i = 0; i < numTypes; i++) {
      matrix[i] = [];
      for (let j = 0; j < numTypes; j++) {
        matrix[i][j] = {
          strength: (Math.random() - 0.5) * 2,
          equilibriumDistance: 15 + Math.random() * 30,
          maxRange: 40 + Math.random() * 60,
        };
      }
    }
    return matrix;
  },
};

/** Particle type colors for rendering */
export const PARTICLE_COLORS: [number, number, number][] = [
  [255, 100, 100],  // Type 0: Red
  [100, 255, 100],  // Type 1: Green
  [100, 100, 255],  // Type 2: Blue
  [255, 255, 100],  // Type 3: Yellow
  [255, 100, 255],  // Type 4: Magenta
  [100, 255, 255],  // Type 5: Cyan
  [255, 180, 100],  // Type 6: Orange
  [180, 100, 255],  // Type 7: Purple
];
