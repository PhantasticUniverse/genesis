/**
 * GENESIS Engine
 * Main cellular automata simulation engine
 */

import type { GridConfig, DiscreteRule, CAParadigm } from './types';
import { DEFAULT_GRID_CONFIG, GAME_OF_LIFE_RULE } from './types';
import { initWebGPU, createShaderModule } from '../compute/webgpu/context';
import { createBufferManager, initializePattern, type BufferManager } from './buffer-manager';
import { createContinuousPipeline, type ContinuousPipeline, type ContinuousCAParams, CONTINUOUS_PRESETS } from '../compute/webgpu/continuous-pipeline';
import { createConservationPipeline, type ConservationConfig, DEFAULT_CONSERVATION_CONFIG } from './conservation';
import type { KernelConfig } from './kernels';
import {
  createTrackerState,
  updateTracker,
  getLargestCreature,
  type TrackerState,
  type Creature,
} from '../agency/creature-tracker';
import {
  createTrajectoryCollector,
  updateTrajectories,
  extractBehaviorVector,
  type TrajectoryCollector,
  type BehaviorVector,
  type TrajectoryPoint,
} from '../agency/behavior';
import {
  createSensorimotorPipeline,
  type SensorimotorPipeline,
  type SensorimotorParams,
} from '../compute/webgpu/sensorimotor-pipeline';
import {
  createMultiChannelPipeline,
  type EcologyParams,
} from '../compute/webgpu/multi-channel-pipeline';
import type { MultiChannelConfig } from './channels';
import { MULTICHANNEL_PRESETS } from './channels';

// Import shaders as raw text
import discreteCAShader from '../compute/webgpu/shaders/discrete-ca.wgsl?raw';
import renderShader from '../compute/webgpu/shaders/render.wgsl?raw';
import multiChannelRenderShader from '../compute/webgpu/shaders/multi-channel-render.wgsl?raw';

export interface EngineConfig {
  canvas: HTMLCanvasElement;
  gridConfig?: GridConfig;
  paradigm?: CAParadigm;
  discreteRule?: DiscreteRule;
}

// Colormap IDs matching the render shader
export const COLORMAP_IDS = {
  grayscale: 0,
  classic: 1,
  viridis: 2,
  plasma: 3,
  inferno: 4,
  fire: 5,
  ocean: 6,
  rainbow: 7,
  neon: 8,
  turbo: 9,
  earth: 10,
  magma: 11,
} as const;

export type ColormapName = keyof typeof COLORMAP_IDS;

export interface Engine {
  // State
  running: boolean;
  step: number;
  fps: number;

  // Methods
  start(): void;
  stop(): void;
  toggle(): void;
  stepOnce(): void;
  reset(pattern?: 'glider' | 'blinker' | 'random' | 'center-blob' | 'lenia-seed'): void;
  setRule(rule: DiscreteRule): void;
  setParadigm(paradigm: CAParadigm): void;
  setContinuousParams(params: Partial<ContinuousCAParams>): void;
  setContinuousPreset(presetName: keyof typeof CONTINUOUS_PRESETS): void;
  setColormap(colormap: ColormapName): void;
  readState(): Promise<Float32Array | null>;
  destroy(): void;

  // Conservation methods
  setConservationConfig(config: Partial<ConservationConfig>): void;
  getConservationConfig(): ConservationConfig;
  getMass(): Promise<number>;

  // Creature tracking methods
  enableTracking(config?: TrackingConfig): void;
  disableTracking(): void;
  isTrackingEnabled(): boolean;
  getTrackerState(): TrackerState | null;
  getLargestCreature(): Creature | null;
  getBehaviorVector(creatureId?: number): BehaviorVector | null;
  onCreatureUpdate(callback: CreatureUpdateCallback | null): void;

  // Sensorimotor methods
  enableSensorimotor(): void;
  disableSensorimotor(): void;
  isSensorimotorEnabled(): boolean;
  setObstacles(pattern: ObstaclePattern): void;
  setTargetGradient(targetX: number, targetY: number): void;
  setSensorimotorParams(params: Partial<SensorimotorParams>): void;

  // Multi-channel ecology methods
  enableMultiChannel(config?: MultiChannelConfig): void;
  disableMultiChannel(): void;
  isMultiChannelEnabled(): boolean;
  setEcologyParams(params: Partial<EcologyParams>): void;
  setMultiChannelPreset(presetName: string): void;

  // Getters
  getConfig(): GridConfig;
  getGridConfig(): GridConfig;
  getParadigm(): CAParadigm;
  getColormap(): ColormapName;
  getDevice(): GPUDevice;
}

export interface TrackingConfig {
  threshold: number;        // Minimum value to consider as creature
  minMass: number;          // Minimum mass to track
  updateInterval: number;   // How often to update tracking (in steps)
}

export type CreatureUpdateCallback = (
  creatures: Creature[],
  largestCreature: Creature | null,
  tracker: TrackerState
) => void;

export type ObstaclePattern = 'walls' | 'maze' | 'random' | 'ring' | 'none';

/**
 * Generate obstacles based on pattern
 */
function generateObstacleData(
  width: number,
  height: number,
  pattern: ObstaclePattern
): Float32Array {
  const data = new Float32Array(width * height);

  switch (pattern) {
    case 'walls':
      // Create walls around the edges
      for (let x = 0; x < width; x++) {
        data[x] = 1; // Top wall
        data[(height - 1) * width + x] = 1; // Bottom wall
      }
      for (let y = 0; y < height; y++) {
        data[y * width] = 1; // Left wall
        data[y * width + width - 1] = 1; // Right wall
      }
      break;

    case 'ring':
      // Create a ring obstacle in the center
      const centerX = width / 2;
      const centerY = height / 2;
      const innerRadius = Math.min(width, height) * 0.2;
      const outerRadius = Math.min(width, height) * 0.25;
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const dx = x - centerX;
          const dy = y - centerY;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist >= innerRadius && dist <= outerRadius) {
            data[y * width + x] = 1;
          }
        }
      }
      break;

    case 'maze':
      // Simple maze-like pattern with horizontal and vertical bars
      const spacing = 64;
      const gapSize = 40;
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          // Horizontal bars (every spacing pixels)
          if (y % spacing < 4 && y > 20 && y < height - 20) {
            // Leave gaps
            const gapPos = ((Math.floor(y / spacing) + 1) * 137) % (width - gapSize);
            if (x < gapPos || x > gapPos + gapSize) {
              data[y * width + x] = 1;
            }
          }
          // Vertical bars offset
          if (x % spacing < 4 && x > 20 && x < width - 20) {
            const gapPos = ((Math.floor(x / spacing) + 2) * 97) % (height - gapSize);
            if (y < gapPos || y > gapPos + gapSize) {
              data[y * width + x] = 1;
            }
          }
        }
      }
      break;

    case 'random':
      // Random scattered obstacles (about 5% coverage)
      for (let i = 0; i < data.length; i++) {
        if (Math.random() < 0.05) {
          data[i] = 1;
        }
      }
      break;

    case 'none':
    default:
      // No obstacles - array is already zeroed
      break;
  }

  return data;
}

/**
 * Generate target gradient field
 * Creates a gradient that increases toward the target position
 */
function generateGradientData(
  width: number,
  height: number,
  targetX: number,
  targetY: number
): Float32Array {
  const data = new Float32Array(width * height);
  const maxDist = Math.sqrt(width * width + height * height);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const dx = x - targetX;
      const dy = y - targetY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      // Normalize to 0-1 range, higher values closer to target
      data[y * width + x] = 1 - (dist / maxDist);
    }
  }

  return data;
}

/**
 * Convert B/S rule arrays to bitmasks
 */
function ruleToBitmask(rule: number[]): number {
  let mask = 0;
  for (const n of rule) {
    if (n >= 0 && n <= 8) {
      mask |= 1 << n;
    }
  }
  return mask;
}

/**
 * Create the GENESIS engine
 */
export async function createEngine(config: EngineConfig): Promise<Engine> {
  const { canvas } = config;
  const gridConfig = config.gridConfig ?? DEFAULT_GRID_CONFIG;
  let currentParadigm: CAParadigm = config.paradigm ?? 'discrete';
  let discreteRule = config.discreteRule ?? GAME_OF_LIFE_RULE;

  // Initialize WebGPU
  const { device } = await initWebGPU();

  // Configure canvas context
  const context = canvas.getContext('webgpu');
  if (!context) {
    throw new Error('Failed to get WebGPU canvas context');
  }

  const presentationFormat = navigator.gpu.getPreferredCanvasFormat();
  context.configure({
    device,
    format: presentationFormat,
    alphaMode: 'premultiplied',
  });

  // Create buffer manager
  const bufferManager = createBufferManager(device, gridConfig);

  // Create staging buffer for GPU -> CPU readback
  const bytesPerRow = Math.ceil((gridConfig.width * 4) / 256) * 256; // Must be multiple of 256
  const stagingBuffer = device.createBuffer({
    label: 'staging-buffer',
    size: bytesPerRow * gridConfig.height,
    usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
  });

  // Create compute shader module
  const computeShaderModule = createShaderModule(device, discreteCAShader, 'discrete-ca');

  // Create render shader module
  const renderShaderModule = createShaderModule(device, renderShader, 'render');

  // Create bind group layout for compute
  const computeBindGroupLayout = device.createBindGroupLayout({
    label: 'compute-bind-group-layout',
    entries: [
      {
        binding: 0,
        visibility: GPUShaderStage.COMPUTE,
        texture: { sampleType: 'unfilterable-float' },
      },
      {
        binding: 1,
        visibility: GPUShaderStage.COMPUTE,
        storageTexture: { access: 'write-only', format: 'r32float' },
      },
      {
        binding: 2,
        visibility: GPUShaderStage.COMPUTE,
        buffer: { type: 'uniform' },
      },
    ],
  });

  // Create compute pipeline
  const computePipeline = device.createComputePipeline({
    label: 'discrete-ca-pipeline',
    layout: device.createPipelineLayout({
      bindGroupLayouts: [computeBindGroupLayout],
    }),
    compute: {
      module: computeShaderModule,
      entryPoint: 'main',
    },
  });

  // Create continuous CA pipeline
  const continuousPipeline = createContinuousPipeline(
    device,
    gridConfig.width,
    gridConfig.height
  );

  // Create conservation pipeline for Flow-Lenia
  const conservationPipeline = createConservationPipeline(
    device,
    gridConfig.width,
    gridConfig.height
  );

  // Create sensorimotor pipeline
  const sensorimotorPipeline = createSensorimotorPipeline(
    device,
    gridConfig.width,
    gridConfig.height
  );

  // Create multi-channel pipeline
  const multiChannelPipeline = createMultiChannelPipeline(
    device,
    gridConfig.width,
    gridConfig.height,
    MULTICHANNEL_PRESETS['single']
  );
  let multiChannelEnabled = false;
  let currentMultiChannelConfig = MULTICHANNEL_PRESETS['single'];

  // Create multi-channel textures (RGBA for up to 4 species)
  const createMultiChannelTexture = (label: string) => device.createTexture({
    label,
    size: [gridConfig.width, gridConfig.height],
    format: 'rgba32float',
    usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.COPY_DST,
  });

  let multiChannelTextureA = createMultiChannelTexture('multi-channel-a');
  let multiChannelTextureB = createMultiChannelTexture('multi-channel-b');
  let multiChannelRead = multiChannelTextureA;
  let multiChannelWrite = multiChannelTextureB;

  // Create sensorimotor textures (RGBA32float for multi-channel state)
  // Main: R=creature, G=obstacle, B=gradient, A=motor
  // Aux: R=proximity, G=pheromone, B=reserved, A=reserved
  const createSensorimotorTexture = (label: string) => device.createTexture({
    label,
    size: [gridConfig.width, gridConfig.height],
    format: 'rgba32float',
    usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.COPY_DST,
  });

  let sensorimotorMainA = createSensorimotorTexture('sensorimotor-main-a');
  let sensorimotorMainB = createSensorimotorTexture('sensorimotor-main-b');
  let sensorimotorAuxA = createSensorimotorTexture('sensorimotor-aux-a');
  let sensorimotorAuxB = createSensorimotorTexture('sensorimotor-aux-b');
  let sensorimotorMainRead = sensorimotorMainA;
  let sensorimotorMainWrite = sensorimotorMainB;
  let sensorimotorAuxRead = sensorimotorAuxA;
  let sensorimotorAuxWrite = sensorimotorAuxB;
  let sensorimotorEnabled = false;

  // Mass conservation state
  let targetMass: number | null = null;  // Set when conservation is enabled

  // Create render bind group layout (using unfilterable-float for r32float textures)
  const renderBindGroupLayout = device.createBindGroupLayout({
    label: 'render-bind-group-layout',
    entries: [
      {
        binding: 0,
        visibility: GPUShaderStage.FRAGMENT,
        texture: { sampleType: 'unfilterable-float' },
      },
      {
        binding: 1,
        visibility: GPUShaderStage.FRAGMENT,
        buffer: { type: 'uniform' },
      },
    ],
  });

  // Create render uniform buffer for texture size and colormap
  const renderUniformBuffer = device.createBuffer({
    label: 'render-uniform-buffer',
    size: 16, // 2 x u32 (size) + u32 (colormap) + u32 (padding) = 16 bytes
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  let currentColormap: ColormapName = 'viridis';
  device.queue.writeBuffer(renderUniformBuffer, 0, new Uint32Array([
    gridConfig.width,
    gridConfig.height,
    COLORMAP_IDS[currentColormap],
    0, // padding
  ]));

  // Create render pipeline
  const renderPipeline = device.createRenderPipeline({
    label: 'render-pipeline',
    layout: device.createPipelineLayout({
      bindGroupLayouts: [renderBindGroupLayout],
    }),
    vertex: {
      module: renderShaderModule,
      entryPoint: 'vs_main',
    },
    fragment: {
      module: renderShaderModule,
      entryPoint: 'fs_main',
      targets: [{ format: presentationFormat }],
    },
    primitive: {
      topology: 'triangle-list',
    },
  });

  // Create multi-channel render shader module and pipeline
  const multiChannelRenderShaderModule = createShaderModule(device, multiChannelRenderShader, 'multi-channel-render');

  const multiChannelRenderBindGroupLayout = device.createBindGroupLayout({
    label: 'multi-channel-render-bind-group-layout',
    entries: [
      {
        binding: 0,
        visibility: GPUShaderStage.FRAGMENT,
        texture: { sampleType: 'unfilterable-float' },
      },
      {
        binding: 1,
        visibility: GPUShaderStage.FRAGMENT,
        buffer: { type: 'uniform' },
      },
      {
        binding: 2,
        visibility: GPUShaderStage.FRAGMENT,
        buffer: { type: 'uniform' },
      },
    ],
  });

  const multiChannelRenderPipeline = device.createRenderPipeline({
    label: 'multi-channel-render-pipeline',
    layout: device.createPipelineLayout({
      bindGroupLayouts: [multiChannelRenderBindGroupLayout],
    }),
    vertex: {
      module: multiChannelRenderShaderModule,
      entryPoint: 'vs_main',
    },
    fragment: {
      module: multiChannelRenderShaderModule,
      entryPoint: 'fs_main',
      targets: [{ format: presentationFormat }],
    },
    primitive: {
      topology: 'triangle-list',
    },
  });

  // Multi-channel render uniforms
  const multiChannelSizeBuffer = device.createBuffer({
    label: 'multi-channel-size-buffer',
    size: 8, // 2 x u32
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(multiChannelSizeBuffer, 0, new Uint32Array([gridConfig.width, gridConfig.height]));

  const multiChannelColorsBuffer = device.createBuffer({
    label: 'multi-channel-colors-buffer',
    size: 64, // 4 x vec4<f32>
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  // Default colors for channels (will be updated based on config)
  function updateMultiChannelColors() {
    const colors = new Float32Array(16);
    for (let i = 0; i < 4; i++) {
      if (i < currentMultiChannelConfig.channels.length) {
        const channel = currentMultiChannelConfig.channels[i];
        colors[i * 4 + 0] = channel.color[0] / 255;
        colors[i * 4 + 1] = channel.color[1] / 255;
        colors[i * 4 + 2] = channel.color[2] / 255;
        colors[i * 4 + 3] = 1.0; // intensity
      }
    }
    device.queue.writeBuffer(multiChannelColorsBuffer, 0, colors);
  }
  updateMultiChannelColors();

  // Initialize state with a pattern
  initializePattern(device, bufferManager.getReadTexture(), gridConfig.width, gridConfig.height, 'random');

  // Engine state
  let running = false;
  let step = 0;
  let fps = 0;
  let lastTime = performance.now();
  let frameCount = 0;
  let animationFrameId: number | null = null;

  // Creature tracking state
  let trackingEnabled = false;
  let trackerState: TrackerState | null = null;
  let trajectoryCollector: TrajectoryCollector | null = null;
  let trackingConfig: TrackingConfig = {
    threshold: 0.1,
    minMass: 50,
    updateInterval: 5,
  };
  let creatureUpdateCallback: CreatureUpdateCallback | null = null;

  /**
   * Create bind groups for current buffer configuration
   */
  function createBindGroups() {
    const readTexture = bufferManager.getReadTexture();
    const writeTexture = bufferManager.getWriteTexture();

    const computeBindGroup = device.createBindGroup({
      label: 'compute-bind-group',
      layout: computeBindGroupLayout,
      entries: [
        { binding: 0, resource: readTexture.createView() },
        { binding: 1, resource: writeTexture.createView() },
        { binding: 2, resource: { buffer: bufferManager.buffers.uniformBuffer } },
      ],
    });

    const renderBindGroup = device.createBindGroup({
      label: 'render-bind-group',
      layout: renderBindGroupLayout,
      entries: [
        { binding: 0, resource: readTexture.createView() },
        { binding: 1, resource: { buffer: renderUniformBuffer } },
      ],
    });

    return { computeBindGroup, renderBindGroup };
  }

  /**
   * Update uniform buffer with current parameters
   */
  function updateUniforms() {
    const data = new Uint32Array([
      gridConfig.width,
      gridConfig.height,
      ruleToBitmask(discreteRule.birth),
      ruleToBitmask(discreteRule.survival),
    ]);
    device.queue.writeBuffer(bufferManager.buffers.uniformBuffer, 0, data);
  }

  // Initial uniform update
  updateUniforms();

  /**
   * Perform one simulation step
   */
  function doStep() {
    const readTexture = bufferManager.getReadTexture();
    const writeTexture = bufferManager.getWriteTexture();

    const commandEncoder = device.createCommandEncoder();

    // Dispatch workgroups dimensions (16x16 threads per workgroup)
    const workgroupsX = Math.ceil(gridConfig.width / 16);
    const workgroupsY = Math.ceil(gridConfig.height / 16);

    if (multiChannelEnabled) {
      // Multi-channel ecology mode
      const multiBindGroup = multiChannelPipeline.createBindGroup(multiChannelRead, multiChannelWrite);
      const computePass = commandEncoder.beginComputePass();
      computePass.setPipeline(multiChannelPipeline.computePipeline);
      computePass.setBindGroup(0, multiBindGroup);
      computePass.dispatchWorkgroups(workgroupsX, workgroupsY);
      computePass.end();

      // Swap multi-channel textures
      const temp = multiChannelRead;
      multiChannelRead = multiChannelWrite;
      multiChannelWrite = temp;
    } else if (currentParadigm === 'continuous') {
      // Continuous CA (Lenia/SmoothLife)
      // Use the dispatch method which handles FFT vs direct convolution automatically
      continuousPipeline.dispatch(
        commandEncoder,
        readTexture,
        writeTexture,
        workgroupsX,
        workgroupsY
      );
    } else {
      // Discrete CA (Game of Life)
      const computePass = commandEncoder.beginComputePass();
      const { computeBindGroup } = createBindGroups();
      computePass.setPipeline(computePipeline);
      computePass.setBindGroup(0, computeBindGroup);
      computePass.dispatchWorkgroups(workgroupsX, workgroupsY);
      computePass.end();
    }

    // Swap buffers
    bufferManager.swap();

    // Compute mass if conservation is enabled (every 10 steps for display)
    // Note: Actual mass conservation (normalization) is not yet implemented
    // The mass display shows how mass evolves over time
    if (conservationPipeline.getConfig().enabled && step % 10 === 0) {
      const massCommandEncoder = device.createCommandEncoder();
      conservationPipeline.computeMass(massCommandEncoder, bufferManager.getReadTexture());
      device.queue.submit([massCommandEncoder.finish()]);
    }

    // Render pass
    const renderPass = commandEncoder.beginRenderPass({
      colorAttachments: [
        {
          view: context!.getCurrentTexture().createView(),
          clearValue: { r: 0, g: 0, b: 0, a: 1 },
          loadOp: 'clear',
          storeOp: 'store',
        },
      ],
    });

    if (multiChannelEnabled) {
      // Multi-channel render with species colors
      const multiRenderBindGroup = device.createBindGroup({
        label: 'multi-channel-render-bind-group',
        layout: multiChannelRenderBindGroupLayout,
        entries: [
          { binding: 0, resource: multiChannelRead.createView() },
          { binding: 1, resource: { buffer: multiChannelSizeBuffer } },
          { binding: 2, resource: { buffer: multiChannelColorsBuffer } },
        ],
      });
      renderPass.setPipeline(multiChannelRenderPipeline);
      renderPass.setBindGroup(0, multiRenderBindGroup);
    } else {
      // Standard single-channel render
      const { renderBindGroup: newRenderBindGroup } = createBindGroups();
      renderPass.setPipeline(renderPipeline);
      renderPass.setBindGroup(0, newRenderBindGroup);
    }

    renderPass.draw(3); // Full-screen triangle
    renderPass.end();

    device.queue.submit([commandEncoder.finish()]);

    step++;

    // Creature tracking (async, doesn't block rendering)
    if (trackingEnabled && step % trackingConfig.updateInterval === 0) {
      updateCreatureTracking();
    }
  }

  /**
   * Update creature tracking asynchronously
   */
  async function updateCreatureTracking() {
    if (!trackingEnabled || !trackerState || !trajectoryCollector) return;

    try {
      // Read current state from GPU
      const state = await engineInstance.readState();
      if (!state) return;

      // Update tracker with new state
      trackerState = updateTracker(
        trackerState,
        state,
        gridConfig.width,
        gridConfig.height,
        trackingConfig.threshold,
        trackingConfig.minMass
      );

      // Update trajectory collector
      updateTrajectories(trajectoryCollector, trackerState);

      // Call callback if registered
      if (creatureUpdateCallback) {
        const creatures = Array.from(trackerState.creatures.values());
        const largest = getLargestCreature(trackerState);
        creatureUpdateCallback(creatures, largest, trackerState);
      }
    } catch (e) {
      // Silently handle tracking errors - don't disrupt simulation
      console.warn('Tracking update failed:', e);
    }
  }

  /**
   * Animation loop
   */
  function animate() {
    if (!running) return;

    doStep();

    // Update FPS counter
    frameCount++;
    const now = performance.now();
    if (now - lastTime >= 1000) {
      fps = frameCount;
      frameCount = 0;
      lastTime = now;
    }

    animationFrameId = requestAnimationFrame(animate);
  }

  /**
   * Render current state without stepping
   */
  function render() {
    const { renderBindGroup } = createBindGroups();

    const commandEncoder = device.createCommandEncoder();
    const renderPass = commandEncoder.beginRenderPass({
      colorAttachments: [
        {
          view: context!.getCurrentTexture().createView(),
          clearValue: { r: 0, g: 0, b: 0, a: 1 },
          loadOp: 'clear',
          storeOp: 'store',
        },
      ],
    });
    renderPass.setPipeline(renderPipeline);
    renderPass.setBindGroup(0, renderBindGroup);
    renderPass.draw(3);
    renderPass.end();

    device.queue.submit([commandEncoder.finish()]);
  }

  // Initial render
  render();

  const engine: Engine = {
    get running() { return running; },
    get step() { return step; },
    get fps() { return fps; },

    start() {
      if (!running) {
        running = true;
        lastTime = performance.now();
        frameCount = 0;
        animate();
      }
    },

    stop() {
      running = false;
      if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
      }
    },

    toggle() {
      if (running) {
        this.stop();
      } else {
        this.start();
      }
    },

    stepOnce() {
      if (!running) {
        doStep();
      }
    },

    reset(pattern = 'random') {
      this.stop();
      step = 0;
      initializePattern(device, bufferManager.getReadTexture(), gridConfig.width, gridConfig.height, pattern);

      // Also reinitialize multi-channel textures if ecology mode is enabled
      if (multiChannelEnabled && currentMultiChannelConfig) {
        const initData = new Float32Array(gridConfig.width * gridConfig.height * 4);
        const centerX = gridConfig.width / 2;
        const centerY = gridConfig.height / 2;
        const spacing = 80;

        for (let c = 0; c < currentMultiChannelConfig.channels.length && c < 4; c++) {
          const offsetX = (c % 2 === 0 ? -1 : 1) * spacing * (c < 2 ? 0.5 : 1.5);
          const offsetY = (c < 2 ? -1 : 1) * spacing * 0.5;
          const speciesCenterX = centerX + offsetX;
          const speciesCenterY = centerY + offsetY;
          const radius = 25;

          for (let y = 0; y < gridConfig.height; y++) {
            for (let x = 0; x < gridConfig.width; x++) {
              const dx = x - speciesCenterX;
              const dy = y - speciesCenterY;
              const dist = Math.sqrt(dx * dx + dy * dy);
              if (dist < radius) {
                const value = Math.exp(-(dist * dist) / (radius * radius * 0.5));
                initData[(y * gridConfig.width + x) * 4 + c] = value;
              }
            }
          }
        }

        device.queue.writeTexture(
          { texture: multiChannelRead },
          initData,
          { bytesPerRow: gridConfig.width * 16 },
          { width: gridConfig.width, height: gridConfig.height }
        );
      }

      // Reset target mass for conservation
      targetMass = null;

      render();
    },

    setRule(rule: DiscreteRule) {
      discreteRule = rule;
      updateUniforms();
    },

    setParadigm(paradigm: CAParadigm) {
      currentParadigm = paradigm;
    },

    setContinuousParams(params: Partial<ContinuousCAParams>) {
      continuousPipeline.updateParams(params);
    },

    setContinuousPreset(presetName: keyof typeof CONTINUOUS_PRESETS) {
      const preset = CONTINUOUS_PRESETS[presetName];
      if (preset) {
        continuousPipeline.updateKernel(preset.kernel);
        continuousPipeline.updateParams({
          ...preset.params,
          kernelRadius: preset.kernel.radius,
        });
      }
    },

    setColormap(colormap: ColormapName) {
      currentColormap = colormap;
      device.queue.writeBuffer(renderUniformBuffer, 0, new Uint32Array([
        gridConfig.width,
        gridConfig.height,
        COLORMAP_IDS[colormap],
        0, // padding
      ]));
      // Re-render to show new colormap immediately
      render();
    },

    // Conservation methods
    setConservationConfig(config: Partial<ConservationConfig>) {
      conservationPipeline.setConfig(config);
      // Reset target mass when conservation is disabled
      if (config.enabled === false) {
        targetMass = null;
      }
    },

    getConservationConfig(): ConservationConfig {
      return conservationPipeline.getConfig();
    },

    async getMass(): Promise<number> {
      return conservationPipeline.getMass();
    },

    async readState(): Promise<Float32Array | null> {
      try {
        const readTexture = bufferManager.getReadTexture();

        const commandEncoder = device.createCommandEncoder();
        commandEncoder.copyTextureToBuffer(
          { texture: readTexture },
          { buffer: stagingBuffer, bytesPerRow },
          { width: gridConfig.width, height: gridConfig.height }
        );
        device.queue.submit([commandEncoder.finish()]);

        await stagingBuffer.mapAsync(GPUMapMode.READ);
        const mappedRange = stagingBuffer.getMappedRange();

        // Copy data (accounting for row padding)
        const result = new Float32Array(gridConfig.width * gridConfig.height);
        const sourceData = new Float32Array(mappedRange);

        const actualBytesPerRow = bytesPerRow / 4; // Convert to float count
        for (let y = 0; y < gridConfig.height; y++) {
          const srcOffset = y * actualBytesPerRow;
          const dstOffset = y * gridConfig.width;
          for (let x = 0; x < gridConfig.width; x++) {
            result[dstOffset + x] = sourceData[srcOffset + x];
          }
        }

        stagingBuffer.unmap();
        return result;
      } catch (e) {
        console.error('Failed to read state:', e);
        return null;
      }
    },

    destroy() {
      this.stop();

      // Wrap each destroy in try/catch to ensure all resources get cleaned up
      const safeDestroy = (fn: () => void, name: string) => {
        try {
          fn();
        } catch (e) {
          console.warn(`Failed to destroy ${name}:`, e);
        }
      };

      safeDestroy(() => bufferManager.destroy(), 'bufferManager');
      safeDestroy(() => continuousPipeline.destroy(), 'continuousPipeline');
      safeDestroy(() => conservationPipeline.destroy(), 'conservationPipeline');
      safeDestroy(() => sensorimotorPipeline.destroy(), 'sensorimotorPipeline');
      safeDestroy(() => multiChannelPipeline.destroy(), 'multiChannelPipeline');
      safeDestroy(() => stagingBuffer.destroy(), 'stagingBuffer');
      safeDestroy(() => sensorimotorMainA.destroy(), 'sensorimotorMainA');
      safeDestroy(() => sensorimotorMainB.destroy(), 'sensorimotorMainB');
      safeDestroy(() => sensorimotorAuxA.destroy(), 'sensorimotorAuxA');
      safeDestroy(() => sensorimotorAuxB.destroy(), 'sensorimotorAuxB');
      safeDestroy(() => multiChannelTextureA.destroy(), 'multiChannelTextureA');
      safeDestroy(() => multiChannelTextureB.destroy(), 'multiChannelTextureB');
      safeDestroy(() => multiChannelSizeBuffer.destroy(), 'multiChannelSizeBuffer');
      safeDestroy(() => multiChannelColorsBuffer.destroy(), 'multiChannelColorsBuffer');
    },

    getConfig() {
      return gridConfig;
    },

    getGridConfig() {
      return gridConfig;
    },

    getParadigm() {
      return currentParadigm;
    },

    getColormap() {
      return currentColormap;
    },

    getDevice() {
      return device;
    },

    // Creature tracking methods
    enableTracking(config?: TrackingConfig) {
      if (config) {
        trackingConfig = { ...trackingConfig, ...config };
      }
      trackingEnabled = true;
      trackerState = createTrackerState();
      trajectoryCollector = createTrajectoryCollector(
        gridConfig.width,
        gridConfig.height
      );
    },

    disableTracking() {
      trackingEnabled = false;
      trackerState = null;
      trajectoryCollector = null;
    },

    isTrackingEnabled() {
      return trackingEnabled;
    },

    getTrackerState() {
      return trackerState;
    },

    getLargestCreature() {
      if (!trackerState) return null;
      return getLargestCreature(trackerState);
    },

    getBehaviorVector(creatureId?: number) {
      if (!trackerState || !trajectoryCollector) return null;

      // If no creature ID specified, use the largest creature
      let targetId = creatureId;
      if (targetId === undefined) {
        const largest = getLargestCreature(trackerState);
        if (!largest) return null;
        targetId = largest.id;
      }

      const trajectory = trajectoryCollector.trajectories.get(targetId);
      if (!trajectory || trajectory.length < 2) return null;

      return extractBehaviorVector(
        trajectory,
        gridConfig.width,
        gridConfig.height
      );
    },

    onCreatureUpdate(callback: CreatureUpdateCallback | null) {
      creatureUpdateCallback = callback;
    },

    // Sensorimotor methods
    enableSensorimotor() {
      sensorimotorEnabled = true;
      // Initialize sensorimotor textures with current state
      // Copy creature state from main buffer to R channel
      const initData = new Float32Array(gridConfig.width * gridConfig.height * 4);
      // Initialize with zeros - creatures will be copied from main state
      device.queue.writeTexture(
        { texture: sensorimotorMainRead },
        initData,
        { bytesPerRow: gridConfig.width * 16 }, // 4 floats * 4 bytes
        { width: gridConfig.width, height: gridConfig.height }
      );
      device.queue.writeTexture(
        { texture: sensorimotorAuxRead },
        initData,
        { bytesPerRow: gridConfig.width * 16 },
        { width: gridConfig.width, height: gridConfig.height }
      );
    },

    disableSensorimotor() {
      sensorimotorEnabled = false;
    },

    isSensorimotorEnabled() {
      return sensorimotorEnabled;
    },

    setObstacles(pattern: ObstaclePattern) {
      const obstacleData = generateObstacleData(gridConfig.width, gridConfig.height, pattern);

      // Read current main texture, update G channel with obstacles, write back
      // For simplicity, create new RGBA data with obstacles in G channel
      const rgbaData = new Float32Array(gridConfig.width * gridConfig.height * 4);
      for (let i = 0; i < obstacleData.length; i++) {
        rgbaData[i * 4 + 1] = obstacleData[i]; // G channel = obstacle
      }

      device.queue.writeTexture(
        { texture: sensorimotorMainRead },
        rgbaData,
        { bytesPerRow: gridConfig.width * 16 },
        { width: gridConfig.width, height: gridConfig.height }
      );
    },

    setTargetGradient(targetX: number, targetY: number) {
      const gradientData = generateGradientData(gridConfig.width, gridConfig.height, targetX, targetY);

      // Read current main texture, update B channel with gradient
      // For now, create fresh RGBA data with gradient in B channel
      const rgbaData = new Float32Array(gridConfig.width * gridConfig.height * 4);
      for (let i = 0; i < gradientData.length; i++) {
        rgbaData[i * 4 + 2] = gradientData[i]; // B channel = gradient
      }

      device.queue.writeTexture(
        { texture: sensorimotorMainRead },
        rgbaData,
        { bytesPerRow: gridConfig.width * 16 },
        { width: gridConfig.width, height: gridConfig.height }
      );
    },

    setSensorimotorParams(params: Partial<SensorimotorParams>) {
      sensorimotorPipeline.updateParams(params);
    },

    // Multi-channel ecology methods
    enableMultiChannel(config?: MultiChannelConfig) {
      const targetConfig = config ?? MULTICHANNEL_PRESETS['single'];
      currentMultiChannelConfig = targetConfig;
      multiChannelPipeline.updateConfig(targetConfig);
      multiChannelEnabled = true;
      updateMultiChannelColors();

      // Initialize multi-channel textures with species patterns
      const initData = new Float32Array(gridConfig.width * gridConfig.height * 4);

      // Place initial species blobs
      const centerX = gridConfig.width / 2;
      const centerY = gridConfig.height / 2;
      const spacing = 80;

      for (let c = 0; c < targetConfig.channels.length && c < 4; c++) {
        // Offset each species from center
        const offsetX = (c % 2 === 0 ? -1 : 1) * spacing * (c < 2 ? 0.5 : 1.5);
        const offsetY = (c < 2 ? -1 : 1) * spacing * 0.5;
        const speciesCenterX = centerX + offsetX;
        const speciesCenterY = centerY + offsetY;

        // Create a blob for this species - larger radius for stable organisms
        const radius = 25;
        for (let y = 0; y < gridConfig.height; y++) {
          for (let x = 0; x < gridConfig.width; x++) {
            const dx = x - speciesCenterX;
            const dy = y - speciesCenterY;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < radius) {
              const value = Math.exp(-(dist * dist) / (radius * radius * 0.5));
              initData[(y * gridConfig.width + x) * 4 + c] = value;
            }
          }
        }
      }

      device.queue.writeTexture(
        { texture: multiChannelRead },
        initData,
        { bytesPerRow: gridConfig.width * 16 }, // 4 floats * 4 bytes
        { width: gridConfig.width, height: gridConfig.height }
      );
    },

    disableMultiChannel() {
      multiChannelEnabled = false;
      currentMultiChannelConfig = MULTICHANNEL_PRESETS['single'];
    },

    isMultiChannelEnabled() {
      return multiChannelEnabled;
    },

    setEcologyParams(params: Partial<EcologyParams>) {
      multiChannelPipeline.updateEcologyParams(params);
    },

    setMultiChannelPreset(presetName: string) {
      const preset = MULTICHANNEL_PRESETS[presetName];
      if (preset) {
        this.enableMultiChannel(preset);
      }
    },
  };

  // Store reference for async tracking updates
  engineInstance = engine;

  return engine;
}

// Engine instance reference for async tracking
let engineInstance: Engine;

// Re-export conservation types for use by UI components
export type { ConservationConfig };
export { DEFAULT_CONSERVATION_CONFIG };

// Re-export tracking types
export type { TrackerState, Creature };
export type { BehaviorVector, TrajectoryPoint };

// Re-export sensorimotor types
export type { SensorimotorParams };
export type { ObstaclePattern };

// Re-export multi-channel types
export type { EcologyParams };
export type { MultiChannelConfig };
