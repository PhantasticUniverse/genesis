/**
 * Flow-Lenia Pipeline
 * Mass-conserving continuous CA with advection dynamics
 */

import flowLeniaShader from "./shaders/flow-lenia.wgsl?raw";

/** Flow-Lenia configuration */
export interface FlowLeniaConfig {
  /** Grid width */
  width: number;
  /** Grid height */
  height: number;
  /** Growth center (μ) */
  growthCenter: number;
  /** Growth width (σ) */
  growthWidth: number;
  /** Time step */
  dt: number;
  /** Flow strength - how much growth gradient affects mass flow */
  flowStrength: number;
  /** Diffusion coefficient for smoothing */
  diffusion: number;
  /** Growth function type: 0 = polynomial, 1 = gaussian */
  growthType: number;
  /** Whether to use reintegration method (better mass conservation) */
  useReintegration: boolean;
}

export const DEFAULT_FLOW_CONFIG: FlowLeniaConfig = {
  width: 512,
  height: 512,
  growthCenter: 0.15,
  growthWidth: 0.015,
  dt: 0.1,
  flowStrength: 0.5,
  diffusion: 0.01,
  growthType: 1, // Gaussian
  useReintegration: true,
};

/** Flow-Lenia pipeline interface */
export interface FlowLeniaPipeline {
  /** Set state from Float32Array */
  setState(state: Float32Array): void;
  /** Get current state */
  getState(): Promise<Float32Array>;
  /** Update configuration */
  setConfig(config: Partial<FlowLeniaConfig>): void;
  /** Get current configuration */
  getConfig(): FlowLeniaConfig;
  /** Execute one compute step (uses external convolution result) */
  step(commandEncoder: GPUCommandEncoder, convolutionResult: GPUTexture): void;
  /** Get output texture for rendering */
  getOutputTexture(): GPUTexture;
  /** Get input texture for external convolution */
  getInputTexture(): GPUTexture;
  /** Calculate total mass (for conservation verification) */
  getMass(): Promise<number>;
  /** Clean up GPU resources */
  destroy(): void;
}

/**
 * Create a Flow-Lenia pipeline
 */
export function createFlowLeniaPipeline(
  device: GPUDevice,
  config: Partial<FlowLeniaConfig> = {},
): FlowLeniaPipeline {
  const fullConfig: FlowLeniaConfig = { ...DEFAULT_FLOW_CONFIG, ...config };
  const { width, height } = fullConfig;

  // Create textures for ping-pong buffer
  const stateTextures: [GPUTexture, GPUTexture] = [
    device.createTexture({
      size: [width, height],
      format: "r32float",
      usage:
        GPUTextureUsage.TEXTURE_BINDING |
        GPUTextureUsage.STORAGE_BINDING |
        GPUTextureUsage.COPY_DST |
        GPUTextureUsage.COPY_SRC,
    }),
    device.createTexture({
      size: [width, height],
      format: "r32float",
      usage:
        GPUTextureUsage.TEXTURE_BINDING |
        GPUTextureUsage.STORAGE_BINDING |
        GPUTextureUsage.COPY_DST |
        GPUTextureUsage.COPY_SRC,
    }),
  ];

  // Staging buffer for CPU readback
  const stagingBuffer = device.createBuffer({
    size: width * height * 4,
    usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
  });

  // Uniform buffer for parameters
  const uniformBuffer = device.createBuffer({
    size: 32, // 8 floats (aligned to 16)
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  // Create shader module
  const shaderModule = device.createShaderModule({
    code: flowLeniaShader,
  });

  // Create bind group layout
  const bindGroupLayout = device.createBindGroupLayout({
    entries: [
      {
        binding: 0,
        visibility: GPUShaderStage.COMPUTE,
        texture: { sampleType: "unfilterable-float" },
      },
      {
        binding: 1,
        visibility: GPUShaderStage.COMPUTE,
        texture: { sampleType: "unfilterable-float" },
      },
      {
        binding: 2,
        visibility: GPUShaderStage.COMPUTE,
        storageTexture: { access: "write-only", format: "r32float" },
      },
      {
        binding: 3,
        visibility: GPUShaderStage.COMPUTE,
        buffer: { type: "uniform" },
      },
    ],
  });

  const pipelineLayout = device.createPipelineLayout({
    bindGroupLayouts: [bindGroupLayout],
  });

  // Create compute pipelines for both entry points
  const mainPipeline = device.createComputePipeline({
    layout: pipelineLayout,
    compute: {
      module: shaderModule,
      entryPoint: "main",
    },
  });

  const reintegrationPipeline = device.createComputePipeline({
    layout: pipelineLayout,
    compute: {
      module: shaderModule,
      entryPoint: "flow_reintegration",
    },
  });

  // State
  let currentBuffer = 0;

  // Update uniform buffer
  function updateUniforms() {
    const data = new Float32Array([
      fullConfig.width,
      fullConfig.height,
      fullConfig.growthCenter,
      fullConfig.growthWidth,
      fullConfig.dt,
      fullConfig.flowStrength,
      fullConfig.diffusion,
      fullConfig.growthType,
    ]);
    // Convert first two values to uint32 for the shader
    const view = new DataView(data.buffer);
    view.setUint32(0, fullConfig.width, true);
    view.setUint32(4, fullConfig.height, true);
    device.queue.writeBuffer(uniformBuffer, 0, data);
  }

  updateUniforms();

  return {
    setState(state: Float32Array) {
      device.queue.writeTexture(
        { texture: stateTextures[currentBuffer] },
        state,
        { bytesPerRow: width * 4, rowsPerImage: height },
        [width, height],
      );
    },

    async getState(): Promise<Float32Array> {
      const commandEncoder = device.createCommandEncoder();
      commandEncoder.copyTextureToBuffer(
        { texture: stateTextures[currentBuffer] },
        { buffer: stagingBuffer, bytesPerRow: width * 4, rowsPerImage: height },
        [width, height],
      );
      device.queue.submit([commandEncoder.finish()]);

      await stagingBuffer.mapAsync(GPUMapMode.READ);
      const data = new Float32Array(stagingBuffer.getMappedRange().slice(0));
      stagingBuffer.unmap();

      return data;
    },

    setConfig(newConfig: Partial<FlowLeniaConfig>) {
      Object.assign(fullConfig, newConfig);
      updateUniforms();
    },

    getConfig(): FlowLeniaConfig {
      return { ...fullConfig };
    },

    step(commandEncoder: GPUCommandEncoder, convolutionResult: GPUTexture) {
      const inputTexture = stateTextures[currentBuffer];
      const outputTexture = stateTextures[1 - currentBuffer];

      // Create bind group for this step
      const bindGroup = device.createBindGroup({
        layout: bindGroupLayout,
        entries: [
          { binding: 0, resource: inputTexture.createView() },
          { binding: 1, resource: convolutionResult.createView() },
          { binding: 2, resource: outputTexture.createView() },
          { binding: 3, resource: { buffer: uniformBuffer } },
        ],
      });

      // Choose pipeline based on reintegration setting
      const pipeline = fullConfig.useReintegration
        ? reintegrationPipeline
        : mainPipeline;

      const passEncoder = commandEncoder.beginComputePass();
      passEncoder.setPipeline(pipeline);
      passEncoder.setBindGroup(0, bindGroup);

      // Dispatch with 16x16 workgroups
      const workgroupsX = Math.ceil(width / 16);
      const workgroupsY = Math.ceil(height / 16);
      passEncoder.dispatchWorkgroups(workgroupsX, workgroupsY);
      passEncoder.end();

      // Swap buffers
      currentBuffer = (1 - currentBuffer) as 0 | 1;
    },

    getOutputTexture(): GPUTexture {
      return stateTextures[currentBuffer];
    },

    getInputTexture(): GPUTexture {
      return stateTextures[currentBuffer];
    },

    async getMass(): Promise<number> {
      const state = await this.getState();
      let sum = 0;
      for (let i = 0; i < state.length; i++) {
        sum += state[i];
      }
      return sum;
    },

    destroy() {
      stateTextures[0].destroy();
      stateTextures[1].destroy();
      stagingBuffer.destroy();
      uniformBuffer.destroy();
    },
  };
}
