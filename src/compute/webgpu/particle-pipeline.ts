/**
 * GPU Particle Pipeline
 * WebGPU compute pipeline for parallel particle physics
 */

import type {
  Particle,
  ParticleSystemConfig,
  InteractionRule,
  FieldCouplingConfig,
} from "../../core/particles";
import {
  DEFAULT_PARTICLE_CONFIG,
  DEFAULT_FIELD_COUPLING,
} from "../../core/particles";

/** GPU-friendly particle structure (aligned to 32 bytes) */
export interface GPUParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  type: number;
  mass: number;
  active: number; // 0 or 1 (bool as float for GPU)
  _padding: number;
}

/** GPU particle pipeline interface */
export interface ParticlePipeline {
  /** Set particles from CPU array */
  setParticles(particles: Particle[]): void;
  /** Read particles back to CPU */
  getParticles(): Promise<Particle[]>;
  /** Set interaction matrix */
  setInteractionMatrix(matrix: InteractionRule[][]): void;
  /** Set field coupling config */
  setFieldCoupling(config: FieldCouplingConfig): void;
  /** Execute one physics step */
  step(commandEncoder: GPUCommandEncoder, fieldTexture?: GPUTexture): void;
  /** Get particle positions for rendering (non-blocking, returns cached) */
  getParticlePositions(): Float32Array;
  /** Get storage buffer for rendering */
  getParticleBuffer(): GPUBuffer;
  /** Get number of active particles */
  getActiveCount(): number;
  /** Clean up GPU resources */
  destroy(): void;
}

/** Bytes per particle in GPU buffer */
const PARTICLE_STRIDE = 32; // 8 floats * 4 bytes

/** Max interaction types supported */
const MAX_TYPES = 8;

/**
 * Create GPU particle pipeline
 */
export function createParticlePipeline(
  device: GPUDevice,
  config: ParticleSystemConfig = DEFAULT_PARTICLE_CONFIG,
): ParticlePipeline {
  const { maxParticles, numTypes, gridWidth, gridHeight } = config;

  // Create particle storage buffers (ping-pong)
  const particleBufferSize = maxParticles * PARTICLE_STRIDE;
  const particleBuffers: [GPUBuffer, GPUBuffer] = [
    device.createBuffer({
      size: particleBufferSize,
      usage:
        GPUBufferUsage.STORAGE |
        GPUBufferUsage.COPY_DST |
        GPUBufferUsage.COPY_SRC,
    }),
    device.createBuffer({
      size: particleBufferSize,
      usage:
        GPUBufferUsage.STORAGE |
        GPUBufferUsage.COPY_DST |
        GPUBufferUsage.COPY_SRC,
    }),
  ];

  // Staging buffer for CPU readback
  const stagingBuffer = device.createBuffer({
    size: particleBufferSize,
    usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
  });

  // Interaction matrix buffer (flattened MAX_TYPES x MAX_TYPES x 3 floats per rule)
  const interactionBufferSize = MAX_TYPES * MAX_TYPES * 3 * 4; // 3 floats: strength, equilibrium, maxRange
  const interactionBuffer = device.createBuffer({
    size: interactionBufferSize,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  });

  // Uniform buffer for config
  const uniformBuffer = device.createBuffer({
    size: 64, // Padded for alignment
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  // Create compute shader
  const shaderModule = device.createShaderModule({
    code: PARTICLE_COMPUTE_SHADER,
  });

  // Create compute pipeline
  const computePipeline = device.createComputePipeline({
    layout: "auto",
    compute: {
      module: shaderModule,
      entryPoint: "main",
    },
  });

  // State
  let currentBuffer = 0;
  let activeParticleCount = 0;
  const cachedPositions = new Float32Array(maxParticles * 2);
  let fieldCouplingConfig = { ...DEFAULT_FIELD_COUPLING };

  // Create bind groups (will be recreated when needed)
  let bindGroups: [GPUBindGroup, GPUBindGroup];

  function createBindGroups(fieldTexture?: GPUTexture) {
    const entries = (
      inputIdx: number,
      outputIdx: number,
    ): GPUBindGroupEntry[] => [
      { binding: 0, resource: { buffer: particleBuffers[inputIdx] } },
      { binding: 1, resource: { buffer: particleBuffers[outputIdx] } },
      { binding: 2, resource: { buffer: interactionBuffer } },
      { binding: 3, resource: { buffer: uniformBuffer } },
    ];

    bindGroups = [
      device.createBindGroup({
        layout: computePipeline.getBindGroupLayout(0),
        entries: entries(0, 1),
      }),
      device.createBindGroup({
        layout: computePipeline.getBindGroupLayout(0),
        entries: entries(1, 0),
      }),
    ];
  }

  // Initialize with empty bind groups
  createBindGroups();

  // Update uniform buffer
  function updateUniforms() {
    const uniforms = new Float32Array([
      // Config
      gridWidth,
      gridHeight,
      config.wrapBoundaries ? 1 : 0,
      config.friction,
      config.dt,
      activeParticleCount,
      numTypes,
      0, // padding
      // Field coupling
      fieldCouplingConfig.gradientResponseEnabled ? 1 : 0,
      fieldCouplingConfig.gradientStrength,
      fieldCouplingConfig.depositEnabled ? 1 : 0,
      fieldCouplingConfig.depositAmount,
      fieldCouplingConfig.depositRadius,
      0,
      0,
      0, // padding
    ]);
    device.queue.writeBuffer(uniformBuffer, 0, uniforms);
  }

  updateUniforms();

  return {
    setParticles(particles: Particle[]) {
      activeParticleCount = particles.length;

      // Convert to GPU format
      const gpuData = new Float32Array(maxParticles * 8);
      for (let i = 0; i < Math.min(particles.length, maxParticles); i++) {
        const p = particles[i];
        const offset = i * 8;
        gpuData[offset + 0] = p.x;
        gpuData[offset + 1] = p.y;
        gpuData[offset + 2] = p.vx;
        gpuData[offset + 3] = p.vy;
        gpuData[offset + 4] = p.type;
        gpuData[offset + 5] = p.mass;
        gpuData[offset + 6] = p.active ? 1 : 0;
        gpuData[offset + 7] = 0; // padding
      }

      device.queue.writeBuffer(particleBuffers[currentBuffer], 0, gpuData);

      // Update cached positions
      for (let i = 0; i < particles.length; i++) {
        cachedPositions[i * 2] = particles[i].x;
        cachedPositions[i * 2 + 1] = particles[i].y;
      }

      updateUniforms();
    },

    async getParticles(): Promise<Particle[]> {
      // Copy current buffer to staging
      const commandEncoder = device.createCommandEncoder();
      commandEncoder.copyBufferToBuffer(
        particleBuffers[currentBuffer],
        0,
        stagingBuffer,
        0,
        activeParticleCount * PARTICLE_STRIDE,
      );
      device.queue.submit([commandEncoder.finish()]);

      // Map and read
      await stagingBuffer.mapAsync(GPUMapMode.READ);
      const data = new Float32Array(stagingBuffer.getMappedRange().slice(0));
      stagingBuffer.unmap();

      // Convert back to Particle[]
      const particles: Particle[] = [];
      for (let i = 0; i < activeParticleCount; i++) {
        const offset = i * 8;
        particles.push({
          id: i,
          x: data[offset + 0],
          y: data[offset + 1],
          vx: data[offset + 2],
          vy: data[offset + 3],
          type: Math.floor(data[offset + 4]),
          mass: data[offset + 5],
          active: data[offset + 6] > 0.5,
        });
      }

      return particles;
    },

    setInteractionMatrix(matrix: InteractionRule[][]) {
      // Flatten to GPU format
      const data = new Float32Array(MAX_TYPES * MAX_TYPES * 3);
      for (let i = 0; i < Math.min(matrix.length, MAX_TYPES); i++) {
        for (let j = 0; j < Math.min(matrix[i]?.length ?? 0, MAX_TYPES); j++) {
          const rule = matrix[i][j];
          const offset = (i * MAX_TYPES + j) * 3;
          data[offset + 0] = rule.strength;
          data[offset + 1] = rule.equilibriumDistance;
          data[offset + 2] = rule.maxRange;
        }
      }
      device.queue.writeBuffer(interactionBuffer, 0, data);
    },

    setFieldCoupling(coupling: FieldCouplingConfig) {
      fieldCouplingConfig = { ...coupling };
      updateUniforms();
    },

    step(commandEncoder: GPUCommandEncoder, _fieldTexture?: GPUTexture) {
      if (activeParticleCount === 0) return;

      const passEncoder = commandEncoder.beginComputePass();
      passEncoder.setPipeline(computePipeline);
      passEncoder.setBindGroup(0, bindGroups[currentBuffer]);

      // Dispatch one thread per particle
      const workgroupSize = 64;
      const numWorkgroups = Math.ceil(activeParticleCount / workgroupSize);
      passEncoder.dispatchWorkgroups(numWorkgroups);
      passEncoder.end();

      // Swap buffers
      currentBuffer = (1 - currentBuffer) as 0 | 1;
    },

    getParticlePositions(): Float32Array {
      return cachedPositions;
    },

    getParticleBuffer(): GPUBuffer {
      return particleBuffers[currentBuffer];
    },

    getActiveCount(): number {
      return activeParticleCount;
    },

    destroy() {
      particleBuffers[0].destroy();
      particleBuffers[1].destroy();
      stagingBuffer.destroy();
      interactionBuffer.destroy();
      uniformBuffer.destroy();
    },
  };
}

/** WGSL Compute Shader for Particle Physics */
const PARTICLE_COMPUTE_SHADER = /* wgsl */ `
struct Particle {
  x: f32,
  y: f32,
  vx: f32,
  vy: f32,
  particleType: f32,
  mass: f32,
  active: f32,
  _padding: f32,
}

struct InteractionRule {
  strength: f32,
  equilibriumDistance: f32,
  maxRange: f32,
}

struct Config {
  gridWidth: f32,
  gridHeight: f32,
  wrapBoundaries: f32,
  friction: f32,
  dt: f32,
  particleCount: f32,
  numTypes: f32,
  _padding1: f32,
  gradientEnabled: f32,
  gradientStrength: f32,
  depositEnabled: f32,
  depositAmount: f32,
  depositRadius: f32,
  _padding2: f32,
  _padding3: f32,
  _padding4: f32,
}

@group(0) @binding(0) var<storage, read> inputParticles: array<Particle>;
@group(0) @binding(1) var<storage, read_write> outputParticles: array<Particle>;
@group(0) @binding(2) var<storage, read> interactions: array<InteractionRule>;
@group(0) @binding(3) var<uniform> config: Config;

const MAX_TYPES: u32 = 8u;
const MAX_SPEED: f32 = 10.0;
const MIN_DIST: f32 = 0.01;

fn getInteraction(type1: u32, type2: u32) -> InteractionRule {
  let idx = type1 * MAX_TYPES + type2;
  return interactions[idx];
}

fn wrapDistance(d: f32, size: f32) -> f32 {
  var result = d;
  if (config.wrapBoundaries > 0.5) {
    if (result > size / 2.0) { result -= size; }
    if (result < -size / 2.0) { result += size; }
  }
  return result;
}

fn wrapPosition(p: f32, size: f32) -> f32 {
  if (config.wrapBoundaries > 0.5) {
    return ((p % size) + size) % size;
  }
  return clamp(p, 0.0, size - 1.0);
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let idx = global_id.x;
  let particleCount = u32(config.particleCount);

  if (idx >= particleCount) {
    return;
  }

  var p = inputParticles[idx];

  if (p.active < 0.5) {
    outputParticles[idx] = p;
    return;
  }

  // Calculate forces from other particles
  var fx: f32 = 0.0;
  var fy: f32 = 0.0;

  for (var j: u32 = 0u; j < particleCount; j++) {
    if (j == idx) { continue; }

    let other = inputParticles[j];
    if (other.active < 0.5) { continue; }

    // Distance with wrapping
    let dx = wrapDistance(other.x - p.x, config.gridWidth);
    let dy = wrapDistance(other.y - p.y, config.gridHeight);
    let dist = sqrt(dx * dx + dy * dy);

    if (dist < MIN_DIST) { continue; }

    // Get interaction rule
    let rule = getInteraction(u32(p.particleType), u32(other.particleType));

    if (dist > rule.maxRange) { continue; }

    // Normalize direction
    let nx = dx / dist;
    let ny = dy / dist;

    // Calculate force (Lennard-Jones-like)
    let relDist = dist / rule.equilibriumDistance;
    var forceMag: f32;

    if (relDist < 1.0) {
      // Repulsive at close range
      forceMag = -abs(rule.strength) * (1.0 / relDist - 1.0);
    } else {
      // Attraction (positive strength) or repulsion (negative strength)
      forceMag = rule.strength * (relDist - 1.0) / relDist;
    }

    // Clamp force magnitude
    forceMag = clamp(forceMag, -10.0, 10.0);

    fx += nx * forceMag * other.mass;
    fy += ny * forceMag * other.mass;
  }

  // Apply forces (a = F/m)
  p.vx += (fx / p.mass) * config.dt;
  p.vy += (fy / p.mass) * config.dt;

  // Apply friction
  let frictionFactor = 1.0 - config.friction;
  p.vx *= frictionFactor;
  p.vy *= frictionFactor;

  // Clamp velocity
  let speed = sqrt(p.vx * p.vx + p.vy * p.vy);
  if (speed > MAX_SPEED) {
    p.vx = (p.vx / speed) * MAX_SPEED;
    p.vy = (p.vy / speed) * MAX_SPEED;
  }

  // Update position
  p.x += p.vx * config.dt;
  p.y += p.vy * config.dt;

  // Handle boundaries
  if (config.wrapBoundaries > 0.5) {
    p.x = wrapPosition(p.x, config.gridWidth);
    p.y = wrapPosition(p.y, config.gridHeight);
  } else {
    // Bounce off walls
    if (p.x < 0.0) { p.x = 0.0; p.vx = -p.vx * 0.5; }
    if (p.x >= config.gridWidth) { p.x = config.gridWidth - 1.0; p.vx = -p.vx * 0.5; }
    if (p.y < 0.0) { p.y = 0.0; p.vy = -p.vy * 0.5; }
    if (p.y >= config.gridHeight) { p.y = config.gridHeight - 1.0; p.vy = -p.vy * 0.5; }
  }

  outputParticles[idx] = p;
}
`;

export { PARTICLE_COMPUTE_SHADER };
