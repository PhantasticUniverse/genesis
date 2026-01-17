/**
 * Sensorimotor Channel System
 * 6-channel architecture for creature sensing and navigation
 */

export enum ChannelRole {
  CREATURE = 0, // Primary body mass (C0)
  OBSTACLE = 1, // Environmental barriers (C1)
  GRADIENT = 2, // Chemical gradient field (C2)
  PROXIMITY = 3, // Proximity sensor output (C3)
  MOTOR = 4, // Motor actuator field (C4)
  PHEROMONE = 5, // Inter-creature signaling (C5)
}

export interface ChannelConfig {
  role: ChannelRole;
  name: string;
  description: string;
  isFixed: boolean; // If true, channel doesn't update via CA rules
  diffusionRate: number; // How quickly values spread
  decayRate: number; // How quickly values decay
  renderColor: [number, number, number]; // RGB for visualization
}

export const CHANNEL_CONFIGS: ChannelConfig[] = [
  {
    role: ChannelRole.CREATURE,
    name: "Creature",
    description: "Primary organism body mass",
    isFixed: false,
    diffusionRate: 0,
    decayRate: 0,
    renderColor: [0, 255, 128], // Green
  },
  {
    role: ChannelRole.OBSTACLE,
    name: "Obstacle",
    description: "Fixed environmental barriers",
    isFixed: true,
    diffusionRate: 0,
    decayRate: 0,
    renderColor: [128, 128, 128], // Gray
  },
  {
    role: ChannelRole.GRADIENT,
    name: "Gradient",
    description: "Chemical gradient for navigation",
    isFixed: false,
    diffusionRate: 0.1,
    decayRate: 0.01,
    renderColor: [255, 128, 0], // Orange
  },
  {
    role: ChannelRole.PROXIMITY,
    name: "Proximity",
    description: "Distance sensor output",
    isFixed: false,
    diffusionRate: 0.05,
    decayRate: 0.1,
    renderColor: [255, 0, 128], // Pink
  },
  {
    role: ChannelRole.MOTOR,
    name: "Motor",
    description: "Movement actuator field",
    isFixed: false,
    diffusionRate: 0.02,
    decayRate: 0.05,
    renderColor: [0, 128, 255], // Blue
  },
  {
    role: ChannelRole.PHEROMONE,
    name: "Pheromone",
    description: "Inter-creature signaling",
    isFixed: false,
    diffusionRate: 0.15,
    decayRate: 0.02,
    renderColor: [255, 255, 0], // Yellow
  },
];

export interface SensorimotorConfig {
  // Creature parameters (Lenia-style)
  creatureRadius: number;
  creatureGrowthCenter: number;
  creatureGrowthWidth: number;
  creatureDt: number;

  // Sensor parameters
  gradientStrength: number; // How strongly creature emits gradient
  proximitySensorRadius: number;
  proximityDecay: number;

  // Motor parameters
  motorInfluence: number; // How motor field affects growth asymmetry
  motorBias: number; // Base movement direction bias

  // Interaction parameters
  obstacleRepulsion: number; // How strongly obstacles inhibit growth
  pheromoneEmission: number; // Rate of pheromone emission
}

export const DEFAULT_SENSORIMOTOR_CONFIG: SensorimotorConfig = {
  creatureRadius: 15,
  creatureGrowthCenter: 0.15,
  creatureGrowthWidth: 0.03,
  creatureDt: 0.1,

  gradientStrength: 1.0,
  proximitySensorRadius: 20,
  proximityDecay: 0.95,

  motorInfluence: 0.3,
  motorBias: 0.0,

  obstacleRepulsion: 2.0,
  pheromoneEmission: 0.1,
};

/**
 * Create initial state for sensorimotor system
 */
export function createSensorimotorState(
  width: number,
  height: number,
): Float32Array {
  // 6 channels packed into RGBA pairs (2 textures with RGBA)
  // Or we can use a single texture array with 6 layers
  // For simplicity, we'll use 2 RGBA textures (8 channels, using 6)
  return new Float32Array(width * height * 4 * 2); // 2 RGBA textures
}

/**
 * Generate obstacle field
 */
export function generateObstacles(
  width: number,
  height: number,
  pattern: "walls" | "maze" | "random" | "ring" = "walls",
): Float32Array {
  const obstacles = new Float32Array(width * height);

  switch (pattern) {
    case "walls":
      // Create walls with a gap
      const wallY1 = Math.floor(height * 0.3);
      const wallY2 = Math.floor(height * 0.7);
      const gapStart = Math.floor(width * 0.4);
      const gapEnd = Math.floor(width * 0.6);

      for (let x = 0; x < width; x++) {
        if (x < gapStart || x > gapEnd) {
          obstacles[wallY1 * width + x] = 1;
          obstacles[wallY2 * width + x] = 1;
        }
      }
      break;

    case "ring":
      // Create a ring obstacle
      const centerX = width / 2;
      const centerY = height / 2;
      const outerRadius = Math.min(width, height) * 0.35;
      const innerRadius = outerRadius - 10;

      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const dx = x - centerX;
          const dy = y - centerY;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist > innerRadius && dist < outerRadius) {
            obstacles[y * width + x] = 1;
          }
        }
      }
      break;

    case "maze":
      // Simple maze-like pattern
      const cellSize = 30;
      for (let cy = 0; cy < Math.floor(height / cellSize); cy++) {
        for (let cx = 0; cx < Math.floor(width / cellSize); cx++) {
          if ((cx + cy) % 3 === 0) {
            // Draw vertical wall segment
            const wallX = cx * cellSize + cellSize / 2;
            for (let y = cy * cellSize; y < (cy + 1) * cellSize; y++) {
              if (wallX < width && y < height) {
                obstacles[y * width + Math.floor(wallX)] = 1;
              }
            }
          }
        }
      }
      break;

    case "random":
      // Random circular obstacles
      const numObstacles = 8;
      for (let i = 0; i < numObstacles; i++) {
        const ox = Math.random() * width;
        const oy = Math.random() * height;
        const radius = 15 + Math.random() * 25;

        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            const dx = x - ox;
            const dy = y - oy;
            if (dx * dx + dy * dy < radius * radius) {
              obstacles[y * width + x] = 1;
            }
          }
        }
      }
      break;
  }

  return obstacles;
}

/**
 * Generate a target/goal gradient field
 */
export function generateTargetGradient(
  width: number,
  height: number,
  targetX: number,
  targetY: number,
  radius: number = 50,
): Float32Array {
  const gradient = new Float32Array(width * height);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const dx = x - targetX;
      const dy = y - targetY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      // Gaussian falloff from target
      gradient[y * width + x] = Math.exp(
        (-dist * dist) / (2 * radius * radius),
      );
    }
  }

  return gradient;
}
