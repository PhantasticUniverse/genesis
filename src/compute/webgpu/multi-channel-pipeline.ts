/**
 * Multi-Channel CA Pipeline
 * Handles multi-species/field simulations
 */

import { createShaderModule } from './context';
import type { MultiChannelConfig, ChannelInteraction } from '../../core/channels';
import { MULTICHANNEL_PRESETS } from '../../core/channels';
import multiChannelShader from './shaders/multi-channel.wgsl?raw';

// Extended interaction with type field
interface ExtendedChannelInteraction extends ChannelInteraction {
  interactionType?: number;  // 0=lenia, 1=predation, 2=symbiosis
}

export interface EcologyParams {
  decay: [number, number, number, number];      // Per-channel decay rates
  diffusion: [number, number, number, number];  // Per-channel diffusion rates
  pheromoneSource: number;   // Which channel emits pheromones
  pheromoneTarget: number;   // Which channel receives pheromones
  pheromoneRate: number;     // Emission rate
}

export interface MultiChannelPipeline {
  computePipeline: GPUComputePipeline;
  bindGroupLayout: GPUBindGroupLayout;
  uniformBuffer: GPUBuffer;
  interactionBuffer: GPUBuffer;

  updateConfig(config: MultiChannelConfig): void;
  updateEcologyParams(params: Partial<EcologyParams>): void;
  createBindGroup(readTexture: GPUTexture, writeTexture: GPUTexture): GPUBindGroup;
  destroy(): void;
}

/**
 * Create multi-channel compute pipeline
 */
export function createMultiChannelPipeline(
  device: GPUDevice,
  width: number,
  height: number,
  initialConfig: MultiChannelConfig = MULTICHANNEL_PRESETS['single']
): MultiChannelPipeline {
  // Create shader module
  const shaderModule = createShaderModule(device, multiChannelShader, 'multi-channel');

  // Create bind group layout
  const bindGroupLayout = device.createBindGroupLayout({
    label: 'multi-channel-bind-group-layout',
    entries: [
      {
        binding: 0,
        visibility: GPUShaderStage.COMPUTE,
        texture: { sampleType: 'unfilterable-float' },
      },
      {
        binding: 1,
        visibility: GPUShaderStage.COMPUTE,
        storageTexture: { access: 'write-only', format: 'rgba32float' },
      },
      {
        binding: 2,
        visibility: GPUShaderStage.COMPUTE,
        buffer: { type: 'uniform' },
      },
      {
        binding: 3,
        visibility: GPUShaderStage.COMPUTE,
        buffer: { type: 'read-only-storage' },
      },
    ],
  });

  // Create compute pipeline
  const computePipeline = device.createComputePipeline({
    label: 'multi-channel-pipeline',
    layout: device.createPipelineLayout({
      bindGroupLayouts: [bindGroupLayout],
    }),
    compute: {
      module: shaderModule,
      entryPoint: 'main',
    },
  });

  // Create uniform buffer (params struct - expanded for ecology)
  // Params: width, height, num_channels, num_interactions, dt,
  //         decay_r, decay_g, decay_b, decay_a,
  //         diffuse_r, diffuse_g, diffuse_b, diffuse_a,
  //         pheromone_source, pheromone_target, pheromone_rate, _pad
  // Total: 17 fields × 4 bytes = 68 bytes, rounded up to 80 for alignment
  const uniformBuffer = device.createBuffer({
    label: 'multi-channel-uniform-buffer',
    size: 80, // 17 fields × 4 bytes = 68, padded to 80 for 16-byte alignment
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  // Create interaction buffer (max 16 interactions)
  const maxInteractions = 16;
  const interactionBuffer = device.createBuffer({
    label: 'multi-channel-interaction-buffer',
    size: maxInteractions * 32, // 8 floats per interaction
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  });

  let currentConfig = initialConfig;

  // Ecology parameters with defaults
  let ecologyParams: EcologyParams = {
    decay: [0, 0, 0, 0],
    diffusion: [0, 0, 0, 0],
    pheromoneSource: 0,
    pheromoneTarget: 3,
    pheromoneRate: 0,
  };

  // Extract decay/diffusion from channel config
  function syncEcologyFromConfig() {
    for (let i = 0; i < currentConfig.channels.length && i < 4; i++) {
      ecologyParams.decay[i] = currentConfig.channels[i].decayRate;
      ecologyParams.diffusion[i] = currentConfig.channels[i].diffusionRate;
    }
  }

  function writeBuffers() {
    // Write uniforms (80 bytes total - 17 fields + padding for alignment)
    const uniformData = new ArrayBuffer(80);
    const u32View = new Uint32Array(uniformData);
    const f32View = new Float32Array(uniformData);

    u32View[0] = width;
    u32View[1] = height;
    u32View[2] = currentConfig.channels.length;
    u32View[3] = currentConfig.interactions.length;
    f32View[4] = 0.1; // dt

    // Decay rates
    f32View[5] = ecologyParams.decay[0];
    f32View[6] = ecologyParams.decay[1];
    f32View[7] = ecologyParams.decay[2];
    f32View[8] = ecologyParams.decay[3];

    // Diffusion rates
    f32View[9] = ecologyParams.diffusion[0];
    f32View[10] = ecologyParams.diffusion[1];
    f32View[11] = ecologyParams.diffusion[2];
    f32View[12] = ecologyParams.diffusion[3];

    // Pheromone params
    u32View[13] = ecologyParams.pheromoneSource;
    u32View[14] = ecologyParams.pheromoneTarget;
    f32View[15] = ecologyParams.pheromoneRate;
    f32View[16] = 0; // _pad field

    device.queue.writeBuffer(uniformBuffer, 0, uniformData);

    // Write interactions
    const interactionData = new ArrayBuffer(currentConfig.interactions.length * 32);
    const interactionF32 = new Float32Array(interactionData);
    const interactionU32 = new Uint32Array(interactionData);

    for (let i = 0; i < currentConfig.interactions.length; i++) {
      const interaction = currentConfig.interactions[i];
      const offset = i * 8;

      interactionU32[offset + 0] = interaction.sourceChannel;
      interactionU32[offset + 1] = interaction.targetChannel;
      interactionF32[offset + 2] = interaction.kernelRadius;
      interactionF32[offset + 3] = interaction.growthCenter;
      interactionF32[offset + 4] = interaction.growthWidth;
      interactionF32[offset + 5] = interaction.weight;
      interactionU32[offset + 6] = (interaction as ExtendedChannelInteraction).interactionType ?? 0;
      interactionF32[offset + 7] = 0; // padding
    }

    device.queue.writeBuffer(interactionBuffer, 0, interactionData);
  }

  syncEcologyFromConfig();
  writeBuffers();

  return {
    computePipeline,
    bindGroupLayout,
    uniformBuffer,
    interactionBuffer,

    updateConfig(config: MultiChannelConfig) {
      currentConfig = config;
      syncEcologyFromConfig();
      writeBuffers();
    },

    updateEcologyParams(params: Partial<EcologyParams>) {
      ecologyParams = { ...ecologyParams, ...params };
      writeBuffers();
    },

    createBindGroup(readTexture: GPUTexture, writeTexture: GPUTexture): GPUBindGroup {
      return device.createBindGroup({
        label: 'multi-channel-bind-group',
        layout: bindGroupLayout,
        entries: [
          { binding: 0, resource: readTexture.createView() },
          { binding: 1, resource: writeTexture.createView() },
          { binding: 2, resource: { buffer: uniformBuffer } },
          { binding: 3, resource: { buffer: interactionBuffer } },
        ],
      });
    },

    destroy() {
      uniformBuffer.destroy();
      interactionBuffer.destroy();
    },
  };
}
