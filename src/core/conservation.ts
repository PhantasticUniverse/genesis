/**
 * Mass Conservation System
 * Implements Flow-Lenia style mass conservation for continuous CA
 *
 * Features:
 * - Mass tracking via parallel reduction
 * - Mass normalization to maintain target mass
 * - Flow-based advection for mass redistribution
 */

import { createShaderModule } from '../compute/webgpu/context';
import massReductionShader from '../compute/webgpu/shaders/mass-reduction.wgsl?raw';
import flowLeniaShader from '../compute/webgpu/shaders/flow-lenia.wgsl?raw';

export interface ConservationConfig {
  enabled: boolean;
  targetMass?: number;        // If set, normalize to this mass
  flowStrength: number;       // How much growth affects flow (0-1)
  diffusion: number;          // Diffusion coefficient (0-0.1)
  useReintegration: boolean;  // Use reintegration tracking (more stable)
}

export const DEFAULT_CONSERVATION_CONFIG: ConservationConfig = {
  enabled: false,
  flowStrength: 0.5,
  diffusion: 0.01,
  useReintegration: true,
};

export interface ConservationPipeline {
  // Compute total mass in the grid
  computeMass(
    commandEncoder: GPUCommandEncoder,
    stateTexture: GPUTexture
  ): void;

  // Get the last computed mass (must call computeMass first)
  getMass(): Promise<number>;

  // Get cached mass value (non-blocking, returns last known value)
  getCachedMass(): number;

  // Sync mass value with GPU (call after GPU commands complete)
  syncMass(): Promise<number>;

  // Compute mass and normalize if drift exceeds threshold
  // This properly sequences GPU operations
  computeAndNormalize(
    device: GPUDevice,
    stateTexture: GPUTexture,
    outputTexture: GPUTexture,
    driftThreshold?: number  // Default 1% (0.01)
  ): Promise<{ mass: number; normalized: boolean }>;

  // Set target mass (captured from first computation if not set)
  setTargetMass(mass: number): void;

  // Get target mass
  getTargetMass(): number | null;

  // Normalize state to target mass
  normalizeMass(
    commandEncoder: GPUCommandEncoder,
    inputTexture: GPUTexture,
    outputTexture: GPUTexture,
    targetMass: number,
    currentMass: number
  ): void;

  // Run flow-based update (alternative to standard growth)
  flowUpdate(
    commandEncoder: GPUCommandEncoder,
    stateTexture: GPUTexture,
    neighborSumTexture: GPUTexture,
    outputTexture: GPUTexture,
    params: FlowUpdateParams
  ): void;

  // Update configuration
  setConfig(config: Partial<ConservationConfig>): void;

  // Get current configuration
  getConfig(): ConservationConfig;

  // Cleanup
  destroy(): void;
}

export interface FlowUpdateParams {
  growthCenter: number;
  growthWidth: number;
  dt: number;
  flowStrength: number;
  diffusion: number;
  growthType: number;
}

/**
 * Create mass conservation pipeline
 */
export function createConservationPipeline(
  device: GPUDevice,
  width: number,
  height: number,
  initialConfig: ConservationConfig = DEFAULT_CONSERVATION_CONFIG
): ConservationPipeline {
  let config = { ...initialConfig };

  // Create shader modules
  const massReductionModule = createShaderModule(device, massReductionShader, 'mass-reduction');
  const flowLeniaModule = createShaderModule(device, flowLeniaShader, 'flow-lenia');

  // Calculate workgroup dimensions
  const workgroupsX = Math.ceil(width / 16);
  const workgroupsY = Math.ceil(height / 16);
  const numWorkgroups = workgroupsX * workgroupsY;

  // Create buffers for mass reduction
  const partialSumsBuffer = device.createBuffer({
    label: 'partial-sums',
    size: numWorkgroups * 4, // f32 per workgroup
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
  });

  const totalMassBuffer = device.createBuffer({
    label: 'total-mass',
    size: 4, // Single f32
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
  });

  // Double-buffered readback for non-blocking mass retrieval
  const massReadbackBuffers = [
    device.createBuffer({
      label: 'mass-readback-0',
      size: 4,
      usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
    }),
    device.createBuffer({
      label: 'mass-readback-1',
      size: 4,
      usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
    }),
  ];
  let currentReadbackIndex = 0;
  let pendingReadbackIndex = -1;

  // Uniform buffers
  const reductionUniformBuffer = device.createBuffer({
    label: 'reduction-uniform',
    size: 16, // width, height, num_workgroups, padding
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  const normalizeUniformBuffer = device.createBuffer({
    label: 'normalize-uniform',
    size: 16, // width, height, target_mass, current_mass
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  const flowUniformBuffer = device.createBuffer({
    label: 'flow-uniform',
    size: 32, // 8 x f32
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  // Write initial reduction uniforms
  const reductionData = new Uint32Array([width, height, numWorkgroups, 0]);
  device.queue.writeBuffer(reductionUniformBuffer, 0, reductionData);

  // Create bind group layouts
  const reduceFirstPassLayout = device.createBindGroupLayout({
    label: 'reduce-first-pass-layout',
    entries: [
      { binding: 0, visibility: GPUShaderStage.COMPUTE, texture: { sampleType: 'unfilterable-float' } },
      { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
      { binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } },
    ],
  });

  const reduceSecondPassLayout = device.createBindGroupLayout({
    label: 'reduce-second-pass-layout',
    entries: [
      { binding: 0, visibility: GPUShaderStage.COMPUTE, texture: { sampleType: 'unfilterable-float' } },
      { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
      { binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } },
      { binding: 3, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
    ],
  });

  const normalizeLayout = device.createBindGroupLayout({
    label: 'normalize-layout',
    entries: [
      { binding: 0, visibility: GPUShaderStage.COMPUTE, texture: { sampleType: 'unfilterable-float' } },
      { binding: 1, visibility: GPUShaderStage.COMPUTE, storageTexture: { access: 'write-only', format: 'r32float' } },
      { binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } },
    ],
  });

  const flowLayout = device.createBindGroupLayout({
    label: 'flow-layout',
    entries: [
      { binding: 0, visibility: GPUShaderStage.COMPUTE, texture: { sampleType: 'unfilterable-float' } },
      { binding: 1, visibility: GPUShaderStage.COMPUTE, texture: { sampleType: 'unfilterable-float' } },
      { binding: 2, visibility: GPUShaderStage.COMPUTE, storageTexture: { access: 'write-only', format: 'r32float' } },
      { binding: 3, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } },
    ],
  });

  // Create pipelines
  const reduceFirstPassPipeline = device.createComputePipeline({
    label: 'reduce-first-pass-pipeline',
    layout: device.createPipelineLayout({ bindGroupLayouts: [reduceFirstPassLayout] }),
    compute: { module: massReductionModule, entryPoint: 'reduce_first_pass' },
  });

  const reduceSecondPassPipeline = device.createComputePipeline({
    label: 'reduce-second-pass-pipeline',
    layout: device.createPipelineLayout({ bindGroupLayouts: [reduceSecondPassLayout] }),
    compute: { module: massReductionModule, entryPoint: 'reduce_second_pass' },
  });

  const normalizePipeline = device.createComputePipeline({
    label: 'normalize-pipeline',
    layout: device.createPipelineLayout({ bindGroupLayouts: [normalizeLayout] }),
    compute: { module: massReductionModule, entryPoint: 'normalize_mass' },
  });

  const flowPipeline = device.createComputePipeline({
    label: 'flow-pipeline',
    layout: device.createPipelineLayout({ bindGroupLayouts: [flowLayout] }),
    compute: { module: flowLeniaModule, entryPoint: config.useReintegration ? 'flow_reintegration' : 'main' },
  });

  // Track last computed mass
  let lastComputedMass = 0;
  let massComputationPending = false;
  let targetMass: number | null = initialConfig.targetMass ?? null;

  return {
    computeMass(
      commandEncoder: GPUCommandEncoder,
      stateTexture: GPUTexture
    ) {
      // First pass: reduce grid to partial sums
      const firstPassBindGroup = device.createBindGroup({
        layout: reduceFirstPassLayout,
        entries: [
          { binding: 0, resource: stateTexture.createView() },
          { binding: 1, resource: { buffer: partialSumsBuffer } },
          { binding: 2, resource: { buffer: reductionUniformBuffer } },
        ],
      });

      const firstPass = commandEncoder.beginComputePass();
      firstPass.setPipeline(reduceFirstPassPipeline);
      firstPass.setBindGroup(0, firstPassBindGroup);
      firstPass.dispatchWorkgroups(workgroupsX, workgroupsY);
      firstPass.end();

      // Second pass: sum partial sums
      // Note: This requires a dummy texture for binding 0 due to layout requirements
      // In practice, we'd create a separate layout without the texture binding
      const secondPassBindGroup = device.createBindGroup({
        layout: reduceSecondPassLayout,
        entries: [
          { binding: 0, resource: stateTexture.createView() }, // Unused but required
          { binding: 1, resource: { buffer: partialSumsBuffer } },
          { binding: 2, resource: { buffer: reductionUniformBuffer } },
          { binding: 3, resource: { buffer: totalMassBuffer } },
        ],
      });

      const secondPass = commandEncoder.beginComputePass();
      secondPass.setPipeline(reduceSecondPassPipeline);
      secondPass.setBindGroup(0, secondPassBindGroup);
      secondPass.dispatchWorkgroups(1);
      secondPass.end();

      // Copy result to readback buffer (using double buffering)
      const readbackBuffer = massReadbackBuffers[currentReadbackIndex];
      commandEncoder.copyBufferToBuffer(totalMassBuffer, 0, readbackBuffer, 0, 4);
      pendingReadbackIndex = currentReadbackIndex;
      currentReadbackIndex = (currentReadbackIndex + 1) % 2;
      massComputationPending = true;
    },

    async getMass(): Promise<number> {
      if (!massComputationPending || pendingReadbackIndex < 0) {
        return lastComputedMass;
      }

      const readbackBuffer = massReadbackBuffers[pendingReadbackIndex];
      await readbackBuffer.mapAsync(GPUMapMode.READ);
      const data = new Float32Array(readbackBuffer.getMappedRange());
      lastComputedMass = data[0];
      readbackBuffer.unmap();
      massComputationPending = false;
      pendingReadbackIndex = -1;

      // Capture target mass on first computation if not set
      if (targetMass === null) {
        targetMass = lastComputedMass;
      }

      return lastComputedMass;
    },

    getCachedMass(): number {
      return lastComputedMass;
    },

    async syncMass(): Promise<number> {
      if (!massComputationPending || pendingReadbackIndex < 0) {
        return lastComputedMass;
      }

      const readbackBuffer = massReadbackBuffers[pendingReadbackIndex];

      // Check if buffer is already mapped
      try {
        await readbackBuffer.mapAsync(GPUMapMode.READ);
        const data = new Float32Array(readbackBuffer.getMappedRange());
        lastComputedMass = data[0];
        readbackBuffer.unmap();
        massComputationPending = false;
        pendingReadbackIndex = -1;

        // Capture target mass on first computation if not set
        if (targetMass === null) {
          targetMass = lastComputedMass;
        }
      } catch {
        // Buffer may still be in use by GPU, return cached value
      }

      return lastComputedMass;
    },

    async computeAndNormalize(
      device: GPUDevice,
      stateTexture: GPUTexture,
      outputTexture: GPUTexture,
      driftThreshold: number = 0.01
    ): Promise<{ mass: number; normalized: boolean }> {
      // Create command encoder and compute mass
      const encoder1 = device.createCommandEncoder();
      this.computeMass(encoder1, stateTexture);
      device.queue.submit([encoder1.finish()]);

      // Wait for GPU to complete and read mass
      await device.queue.onSubmittedWorkDone();
      const mass = await this.getMass();

      // Set target mass on first call
      if (targetMass === null) {
        targetMass = mass;
      }

      // Check if normalization is needed
      const drift = Math.abs(mass - targetMass) / targetMass;
      if (drift > driftThreshold && config.enabled) {
        // Normalize mass
        const encoder2 = device.createCommandEncoder();
        this.normalizeMass(encoder2, stateTexture, outputTexture, targetMass, mass);
        device.queue.submit([encoder2.finish()]);
        await device.queue.onSubmittedWorkDone();
        return { mass, normalized: true };
      }

      return { mass, normalized: false };
    },

    setTargetMass(mass: number): void {
      targetMass = mass;
    },

    getTargetMass(): number | null {
      return targetMass;
    },

    normalizeMass(
      commandEncoder: GPUCommandEncoder,
      inputTexture: GPUTexture,
      outputTexture: GPUTexture,
      targetMass: number,
      currentMass: number
    ) {
      // Update uniform buffer
      const uniformData = new ArrayBuffer(16);
      const u32View = new Uint32Array(uniformData);
      const f32View = new Float32Array(uniformData);
      u32View[0] = width;
      u32View[1] = height;
      f32View[2] = targetMass;
      f32View[3] = currentMass;
      device.queue.writeBuffer(normalizeUniformBuffer, 0, uniformData);

      const bindGroup = device.createBindGroup({
        layout: normalizeLayout,
        entries: [
          { binding: 0, resource: inputTexture.createView() },
          { binding: 1, resource: outputTexture.createView() },
          { binding: 2, resource: { buffer: normalizeUniformBuffer } },
        ],
      });

      const pass = commandEncoder.beginComputePass();
      pass.setPipeline(normalizePipeline);
      pass.setBindGroup(0, bindGroup);
      pass.dispatchWorkgroups(workgroupsX, workgroupsY);
      pass.end();
    },

    flowUpdate(
      commandEncoder: GPUCommandEncoder,
      stateTexture: GPUTexture,
      neighborSumTexture: GPUTexture,
      outputTexture: GPUTexture,
      params: FlowUpdateParams
    ) {
      // Update uniform buffer
      const uniformData = new ArrayBuffer(32);
      const u32View = new Uint32Array(uniformData);
      const f32View = new Float32Array(uniformData);
      u32View[0] = width;
      u32View[1] = height;
      f32View[2] = params.growthCenter;
      f32View[3] = params.growthWidth;
      f32View[4] = params.dt;
      f32View[5] = params.flowStrength;
      f32View[6] = params.diffusion;
      u32View[7] = params.growthType;
      device.queue.writeBuffer(flowUniformBuffer, 0, uniformData);

      const bindGroup = device.createBindGroup({
        layout: flowLayout,
        entries: [
          { binding: 0, resource: stateTexture.createView() },
          { binding: 1, resource: neighborSumTexture.createView() },
          { binding: 2, resource: outputTexture.createView() },
          { binding: 3, resource: { buffer: flowUniformBuffer } },
        ],
      });

      const pass = commandEncoder.beginComputePass();
      pass.setPipeline(flowPipeline);
      pass.setBindGroup(0, bindGroup);
      pass.dispatchWorkgroups(workgroupsX, workgroupsY);
      pass.end();
    },

    setConfig(newConfig: Partial<ConservationConfig>) {
      config = { ...config, ...newConfig };
    },

    getConfig() {
      return { ...config };
    },

    destroy() {
      partialSumsBuffer.destroy();
      totalMassBuffer.destroy();
      massReadbackBuffers[0].destroy();
      massReadbackBuffers[1].destroy();
      reductionUniformBuffer.destroy();
      normalizeUniformBuffer.destroy();
      flowUniformBuffer.destroy();
    },
  };
}
