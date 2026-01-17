/**
 * Sensorimotor Pipeline
 * WebGPU compute pipeline for sensorimotor CA
 */

import sensorimotorShader from "./shaders/sensorimotor-ca.wgsl?raw";
import { createShaderModule } from "./context";
import { generateGaussianKernel } from "../../core/kernels";

export interface SensorimotorParams {
  kernelRadius: number;
  dt: number;
  growthCenter: number;
  growthWidth: number;
  obstacleRepulsion: number;
  motorInfluence: number;
  gradientDiffusion: number;
  gradientDecay: number;
  proximityRadius: number;
  pheromoneEmission: number;
  pheromoneDiffusion: number;
  pheromoneDecay: number;
}

const DEFAULT_PARAMS: SensorimotorParams = {
  kernelRadius: 15,
  dt: 0.1,
  growthCenter: 0.15,
  growthWidth: 0.03,
  obstacleRepulsion: 2.0,
  motorInfluence: 0.3,
  gradientDiffusion: 0.1,
  gradientDecay: 0.01,
  proximityRadius: 20,
  pheromoneEmission: 0.05,
  pheromoneDiffusion: 0.15,
  pheromoneDecay: 0.02,
};

export interface SensorimotorPipeline {
  computePipeline: GPUComputePipeline;
  createBindGroup: (
    inputMain: GPUTexture,
    inputAux: GPUTexture,
    outputMain: GPUTexture,
    outputAux: GPUTexture,
  ) => GPUBindGroup;
  updateParams: (params: Partial<SensorimotorParams>) => void;
  updateKernel: (radius: number) => void;
  getParams: () => SensorimotorParams;
  destroy: () => void;
}

export function createSensorimotorPipeline(
  device: GPUDevice,
  width: number,
  height: number,
  initialParams: Partial<SensorimotorParams> = {},
): SensorimotorPipeline {
  let params: SensorimotorParams = { ...DEFAULT_PARAMS, ...initialParams };

  // Create shader module
  const shaderModule = createShaderModule(
    device,
    sensorimotorShader,
    "sensorimotor-ca",
  );

  // Create uniform buffer (padded to 16 bytes alignment)
  // Total params: width, height, kernelRadius, dt, growthCenter, growthWidth,
  //               obstacleRepulsion, motorInfluence, gradientDiffusion, gradientDecay,
  //               proximityRadius, pheromoneEmission, pheromoneDiffusion, pheromoneDecay
  // = 14 values = 56 bytes, padded to 64
  const uniformBuffer = device.createBuffer({
    label: "sensorimotor-uniform-buffer",
    size: 64,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  // Create kernel texture
  let kernelSize = params.kernelRadius * 2 + 1;
  let kernelTexture = createKernelTexture(device, params.kernelRadius);

  function createKernelTexture(device: GPUDevice, radius: number): GPUTexture {
    const size = radius * 2 + 1;
    const kernelData = generateGaussianKernel(radius, radius / 3);

    const texture = device.createTexture({
      label: "kernel-texture",
      size: [size, size],
      format: "r32float",
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
    });

    device.queue.writeTexture(
      { texture },
      kernelData,
      { bytesPerRow: size * 4 },
      { width: size, height: size },
    );

    return texture;
  }

  // Write initial uniforms
  function writeUniforms() {
    const data = new ArrayBuffer(64);
    const u32View = new Uint32Array(data);
    const f32View = new Float32Array(data);

    u32View[0] = width;
    u32View[1] = height;
    u32View[2] = params.kernelRadius;
    f32View[3] = params.dt;
    f32View[4] = params.growthCenter;
    f32View[5] = params.growthWidth;
    f32View[6] = params.obstacleRepulsion;
    f32View[7] = params.motorInfluence;
    f32View[8] = params.gradientDiffusion;
    f32View[9] = params.gradientDecay;
    f32View[10] = params.proximityRadius;
    f32View[11] = params.pheromoneEmission;
    f32View[12] = params.pheromoneDiffusion;
    f32View[13] = params.pheromoneDecay;

    device.queue.writeBuffer(uniformBuffer, 0, data);
  }

  writeUniforms();

  // Create bind group layout
  const bindGroupLayout = device.createBindGroupLayout({
    label: "sensorimotor-bind-group-layout",
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
        storageTexture: { access: "write-only", format: "rgba32float" },
      },
      {
        binding: 3,
        visibility: GPUShaderStage.COMPUTE,
        storageTexture: { access: "write-only", format: "rgba32float" },
      },
      {
        binding: 4,
        visibility: GPUShaderStage.COMPUTE,
        texture: { sampleType: "unfilterable-float" },
      },
      {
        binding: 5,
        visibility: GPUShaderStage.COMPUTE,
        buffer: { type: "uniform" },
      },
    ],
  });

  // Create compute pipeline
  const computePipeline = device.createComputePipeline({
    label: "sensorimotor-compute-pipeline",
    layout: device.createPipelineLayout({
      bindGroupLayouts: [bindGroupLayout],
    }),
    compute: {
      module: shaderModule,
      entryPoint: "main",
    },
  });

  return {
    computePipeline,

    createBindGroup(
      inputMain: GPUTexture,
      inputAux: GPUTexture,
      outputMain: GPUTexture,
      outputAux: GPUTexture,
    ): GPUBindGroup {
      return device.createBindGroup({
        label: "sensorimotor-bind-group",
        layout: bindGroupLayout,
        entries: [
          { binding: 0, resource: inputMain.createView() },
          { binding: 1, resource: inputAux.createView() },
          { binding: 2, resource: outputMain.createView() },
          { binding: 3, resource: outputAux.createView() },
          { binding: 4, resource: kernelTexture.createView() },
          { binding: 5, resource: { buffer: uniformBuffer } },
        ],
      });
    },

    updateParams(newParams: Partial<SensorimotorParams>) {
      params = { ...params, ...newParams };
      writeUniforms();
    },

    updateKernel(radius: number) {
      if (radius !== params.kernelRadius) {
        params.kernelRadius = radius;
        kernelTexture.destroy();
        kernelTexture = createKernelTexture(device, radius);
        writeUniforms();
      }
    },

    getParams(): SensorimotorParams {
      return { ...params };
    },

    destroy() {
      uniformBuffer.destroy();
      kernelTexture.destroy();
    },
  };
}
