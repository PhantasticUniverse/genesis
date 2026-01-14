/**
 * GPU Training Pipeline
 * Enables gradient-based training of CA parameters using WebGPU compute shaders
 */

import { createShaderModule } from './context';
import trainingForwardShader from './shaders/training-forward.wgsl?raw';
import trainingBackwardShader from './shaders/training-backward.wgsl?raw';

export interface TrainingParams {
  kernelRadius: number;
  growthCenter: number;   // μ
  growthWidth: number;    // σ
  dt: number;
}

export interface TrainingGradients {
  growthCenter: number;   // dL/dμ
  growthWidth: number;    // dL/dσ
  dt: number;             // dL/d(dt)
}

export interface GPUTrainingPipeline {
  // Run forward pass for multiple steps, storing cache
  forward(
    inputTexture: GPUTexture,
    steps: number
  ): Promise<{
    finalState: GPUTexture;
    cache: TrainingCache;
  }>;

  // Run backward pass through cached states
  backward(
    targetTexture: GPUTexture,
    cache: TrainingCache
  ): Promise<TrainingGradients>;

  // Compute MSE loss between textures
  computeLoss(
    predictionTexture: GPUTexture,
    targetTexture: GPUTexture
  ): Promise<number>;

  // Update training parameters
  setParams(params: Partial<TrainingParams>): void;

  // Get current parameters
  getParams(): TrainingParams;

  // Update kernel
  setKernel(kernelData: Float32Array, kernelSize: number): void;

  // Cleanup
  destroy(): void;
}

interface TrainingCache {
  states: GPUTexture[];         // State at each time step
  neighborSums: GPUTexture[];   // Convolution results
  growthValues: GPUTexture[];   // Growth function outputs
}

/**
 * Create GPU training pipeline
 */
export function createGPUTrainingPipeline(
  device: GPUDevice,
  width: number,
  height: number,
  initialParams: Partial<TrainingParams> = {}
): GPUTrainingPipeline {
  // Default parameters
  let params: TrainingParams = {
    kernelRadius: 13,
    growthCenter: 0.15,
    growthWidth: 0.015,
    dt: 0.1,
    ...initialParams,
  };

  // Create shader modules
  const forwardModule = createShaderModule(device, trainingForwardShader, 'training-forward');
  const backwardModule = createShaderModule(device, trainingBackwardShader, 'training-backward');

  // Create uniform buffer for parameters
  const uniformBuffer = device.createBuffer({
    label: 'training-uniform-buffer',
    size: 32, // 8 x f32
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  // Create kernel texture (initial placeholder)
  let kernelSize = params.kernelRadius * 2 + 1;
  let kernelTexture = createKernelTexture(device, kernelSize);

  function createKernelTexture(device: GPUDevice, size: number): GPUTexture {
    const texture = device.createTexture({
      label: 'training-kernel-texture',
      size: [size, size],
      format: 'r32float',
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
    });

    // Initialize with gaussian kernel
    const data = new Float32Array(size * size);
    const center = size / 2;
    const sigma = size / 4;
    let sum = 0;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const dx = x - center;
        const dy = y - center;
        const r = Math.sqrt(dx * dx + dy * dy) / center;
        const val = Math.exp(-r * r * 2);
        data[y * size + x] = val;
        sum += val;
      }
    }
    // Normalize
    for (let i = 0; i < data.length; i++) {
      data[i] /= sum;
    }

    device.queue.writeTexture(
      { texture },
      data,
      { bytesPerRow: size * 4 },
      { width: size, height: size }
    );

    return texture;
  }

  // Create state texture (for intermediate states)
  function createStateTexture(label: string): GPUTexture {
    return device.createTexture({
      label,
      size: [width, height],
      format: 'r32float',
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.COPY_SRC | GPUTextureUsage.COPY_DST,
    });
  }

  // Create gradient accumulation buffer
  const gradientBuffer = device.createBuffer({
    label: 'gradient-accumulation-buffer',
    size: 16, // 4 x u32 (fixed-point: μ, σ, dt, count)
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
  });

  // Staging buffer for reading gradients back
  const gradientStagingBuffer = device.createBuffer({
    label: 'gradient-staging-buffer',
    size: 16,
    usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
  });

  // Loss computation buffer
  const lossBuffer = device.createBuffer({
    label: 'loss-buffer',
    size: 4, // f32
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
  });

  const lossStagingBuffer = device.createBuffer({
    label: 'loss-staging-buffer',
    size: 4,
    usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
  });

  // Create bind group layouts
  const forwardBindGroupLayout = device.createBindGroupLayout({
    label: 'training-forward-bind-group-layout',
    entries: [
      { binding: 0, visibility: GPUShaderStage.COMPUTE, texture: { sampleType: 'unfilterable-float' } },
      { binding: 1, visibility: GPUShaderStage.COMPUTE, storageTexture: { access: 'write-only', format: 'r32float' } },
      { binding: 2, visibility: GPUShaderStage.COMPUTE, storageTexture: { access: 'write-only', format: 'r32float' } },
      { binding: 3, visibility: GPUShaderStage.COMPUTE, storageTexture: { access: 'write-only', format: 'r32float' } },
      { binding: 4, visibility: GPUShaderStage.COMPUTE, texture: { sampleType: 'unfilterable-float' } },
      { binding: 5, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } },
    ],
  });

  const backwardBindGroupLayout = device.createBindGroupLayout({
    label: 'training-backward-bind-group-layout',
    entries: [
      { binding: 0, visibility: GPUShaderStage.COMPUTE, texture: { sampleType: 'unfilterable-float' } },
      { binding: 1, visibility: GPUShaderStage.COMPUTE, texture: { sampleType: 'unfilterable-float' } },
      { binding: 2, visibility: GPUShaderStage.COMPUTE, texture: { sampleType: 'unfilterable-float' } },
      { binding: 3, visibility: GPUShaderStage.COMPUTE, texture: { sampleType: 'unfilterable-float' } },
      { binding: 4, visibility: GPUShaderStage.COMPUTE, texture: { sampleType: 'unfilterable-float' } },
      { binding: 5, visibility: GPUShaderStage.COMPUTE, storageTexture: { access: 'write-only', format: 'r32float' } },
      { binding: 6, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
      { binding: 7, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } },
    ],
  });

  // Create compute pipelines
  const forwardPipeline = device.createComputePipeline({
    label: 'training-forward-pipeline',
    layout: device.createPipelineLayout({ bindGroupLayouts: [forwardBindGroupLayout] }),
    compute: { module: forwardModule, entryPoint: 'main' },
  });

  const backwardPipeline = device.createComputePipeline({
    label: 'training-backward-pipeline',
    layout: device.createPipelineLayout({ bindGroupLayouts: [backwardBindGroupLayout] }),
    compute: { module: backwardModule, entryPoint: 'main' },
  });

  const workgroupsX = Math.ceil(width / 16);
  const workgroupsY = Math.ceil(height / 16);

  // Write uniform buffer
  function writeUniforms() {
    const data = new ArrayBuffer(32);
    const u32View = new Uint32Array(data);
    const f32View = new Float32Array(data);

    u32View[0] = width;
    u32View[1] = height;
    u32View[2] = params.kernelRadius;
    f32View[3] = params.growthCenter;
    f32View[4] = params.growthWidth;
    f32View[5] = params.dt;
    // padding at 6, 7

    device.queue.writeBuffer(uniformBuffer, 0, data);
  }

  writeUniforms();

  // Texture pool for caching (to avoid reallocating)
  const texturePool: GPUTexture[] = [];

  function getPooledTexture(): GPUTexture {
    if (texturePool.length > 0) {
      return texturePool.pop()!;
    }
    return createStateTexture('pooled-state');
  }

  function returnToPool(texture: GPUTexture) {
    texturePool.push(texture);
  }

  return {
    async forward(inputTexture: GPUTexture, steps: number) {
      const cache: TrainingCache = {
        states: [],
        neighborSums: [],
        growthValues: [],
      };

      // Copy input to first state
      let currentState = getPooledTexture();
      const commandEncoder = device.createCommandEncoder();
      commandEncoder.copyTextureToTexture(
        { texture: inputTexture },
        { texture: currentState },
        { width, height }
      );
      device.queue.submit([commandEncoder.finish()]);

      cache.states.push(currentState);

      for (let step = 0; step < steps; step++) {
        const nextState = getPooledTexture();
        const neighborSums = getPooledTexture();
        const growthValues = getPooledTexture();

        // Create bind group for this step
        const bindGroup = device.createBindGroup({
          layout: forwardBindGroupLayout,
          entries: [
            { binding: 0, resource: currentState.createView() },
            { binding: 1, resource: nextState.createView() },
            { binding: 2, resource: neighborSums.createView() },
            { binding: 3, resource: growthValues.createView() },
            { binding: 4, resource: kernelTexture.createView() },
            { binding: 5, resource: { buffer: uniformBuffer } },
          ],
        });

        // Dispatch
        const encoder = device.createCommandEncoder();
        const pass = encoder.beginComputePass();
        pass.setPipeline(forwardPipeline);
        pass.setBindGroup(0, bindGroup);
        pass.dispatchWorkgroups(workgroupsX, workgroupsY);
        pass.end();
        device.queue.submit([encoder.finish()]);

        cache.states.push(nextState);
        cache.neighborSums.push(neighborSums);
        cache.growthValues.push(growthValues);

        currentState = nextState;
      }

      return {
        finalState: currentState,
        cache,
      };
    },

    async backward(targetTexture: GPUTexture, cache: TrainingCache) {
      // Validate cache integrity
      if (!cache || !cache.states || cache.states.length === 0) {
        throw new Error('Invalid cache: states array is empty or undefined');
      }
      if (!cache.neighborSums || !cache.growthValues) {
        throw new Error('Invalid cache: neighborSums or growthValues is undefined');
      }

      const steps = cache.states.length - 1;

      if (steps === 0) {
        // No steps taken, return zero gradients
        return { growthCenter: 0, growthWidth: 0, dt: 0 };
      }

      // Validate array lengths match
      if (cache.neighborSums.length !== steps || cache.growthValues.length !== steps) {
        throw new Error(`Cache array length mismatch: states=${cache.states.length}, neighborSums=${cache.neighborSums.length}, growthValues=${cache.growthValues.length}`);
      }

      // Clear gradient buffer
      device.queue.writeBuffer(gradientBuffer, 0, new Uint32Array([0, 0, 0, 0]));

      // Compute initial loss gradient: dL/dState_final = 2 * (state - target)
      // For simplicity, we'll compute this as part of the first backward step
      // by initializing state_gradient to point to a texture with loss gradients

      // Create loss gradient texture
      const lossGradTexture = getPooledTexture();

      // Compute loss gradient (2 * (pred - target)) on CPU for now
      // In a full implementation, this would be another shader
      const bytesPerRow = Math.ceil(width * 4 / 256) * 256;
      const stagingBuffer = device.createBuffer({
        size: bytesPerRow * height,
        usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
      });

      // Read final state and target
      const encoder1 = device.createCommandEncoder();
      encoder1.copyTextureToBuffer(
        { texture: cache.states[steps] },
        { buffer: stagingBuffer, bytesPerRow },
        { width, height }
      );
      device.queue.submit([encoder1.finish()]);

      await stagingBuffer.mapAsync(GPUMapMode.READ);
      const finalRawData = new Float32Array(stagingBuffer.getMappedRange().slice(0));
      // Extract only valid data (bytesPerRow includes padding)
      const floatsPerRow = bytesPerRow / 4;
      const finalData = new Float32Array(width * height);
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          finalData[y * width + x] = finalRawData[y * floatsPerRow + x];
        }
      }
      stagingBuffer.unmap();

      // Read target
      const encoder2 = device.createCommandEncoder();
      encoder2.copyTextureToBuffer(
        { texture: targetTexture },
        { buffer: stagingBuffer, bytesPerRow },
        { width, height }
      );
      device.queue.submit([encoder2.finish()]);

      await stagingBuffer.mapAsync(GPUMapMode.READ);
      const targetRawData = new Float32Array(stagingBuffer.getMappedRange().slice(0));
      const targetData = new Float32Array(width * height);
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          targetData[y * width + x] = targetRawData[y * floatsPerRow + x];
        }
      }
      stagingBuffer.unmap();
      stagingBuffer.destroy();

      // Compute loss gradient
      const lossGradData = new Float32Array(width * height);
      for (let i = 0; i < width * height; i++) {
        lossGradData[i] = 2 * (finalData[i] - targetData[i]);
      }

      // Write to texture
      device.queue.writeTexture(
        { texture: lossGradTexture },
        lossGradData,
        { bytesPerRow: width * 4 },
        { width, height }
      );

      let currentGradient = lossGradTexture;

      // Backpropagate through time
      for (let step = steps - 1; step >= 0; step--) {
        const prevGradient = getPooledTexture();

        const bindGroup = device.createBindGroup({
          layout: backwardBindGroupLayout,
          entries: [
            { binding: 0, resource: currentGradient.createView() },
            { binding: 1, resource: cache.states[step].createView() },
            { binding: 2, resource: cache.neighborSums[step].createView() },
            { binding: 3, resource: cache.growthValues[step].createView() },
            { binding: 4, resource: kernelTexture.createView() },
            { binding: 5, resource: prevGradient.createView() },
            { binding: 6, resource: { buffer: gradientBuffer } },
            { binding: 7, resource: { buffer: uniformBuffer } },
          ],
        });

        const encoder = device.createCommandEncoder();
        const pass = encoder.beginComputePass();
        pass.setPipeline(backwardPipeline);
        pass.setBindGroup(0, bindGroup);
        pass.dispatchWorkgroups(workgroupsX, workgroupsY);
        pass.end();
        device.queue.submit([encoder.finish()]);

        // Return previous gradient texture to pool (except the initial loss grad)
        if (step < steps - 1) {
          returnToPool(currentGradient);
        }
        currentGradient = prevGradient;
      }

      // Return textures to pool
      returnToPool(currentGradient);
      returnToPool(lossGradTexture);
      for (const tex of cache.states) returnToPool(tex);
      for (const tex of cache.neighborSums) returnToPool(tex);
      for (const tex of cache.growthValues) returnToPool(tex);

      // Read gradients from buffer
      const copyEncoder = device.createCommandEncoder();
      copyEncoder.copyBufferToBuffer(gradientBuffer, 0, gradientStagingBuffer, 0, 16);
      device.queue.submit([copyEncoder.finish()]);

      await gradientStagingBuffer.mapAsync(GPUMapMode.READ);
      const gradData = new Int32Array(gradientStagingBuffer.getMappedRange().slice(0));
      gradientStagingBuffer.unmap();

      // Convert from fixed-point
      const count = gradData[3] || 1;
      return {
        growthCenter: (gradData[0] / 65536) / count,
        growthWidth: (gradData[1] / 65536) / count,
        dt: (gradData[2] / 65536) / count,
      };
    },

    async computeLoss(predictionTexture: GPUTexture, targetTexture: GPUTexture) {
      // Read both textures and compute MSE on CPU
      // In a full implementation, this would be a reduction shader
      const bytesPerRow = Math.ceil(width * 4 / 256) * 256;
      const floatsPerRow = bytesPerRow / 4;
      const stagingBuffer = device.createBuffer({
        size: bytesPerRow * height,
        usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
      });

      // Read prediction
      const encoder1 = device.createCommandEncoder();
      encoder1.copyTextureToBuffer(
        { texture: predictionTexture },
        { buffer: stagingBuffer, bytesPerRow },
        { width, height }
      );
      device.queue.submit([encoder1.finish()]);

      await stagingBuffer.mapAsync(GPUMapMode.READ);
      const predRawData = new Float32Array(stagingBuffer.getMappedRange().slice(0));
      // Extract only valid data (bytesPerRow includes padding)
      const predData = new Float32Array(width * height);
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          predData[y * width + x] = predRawData[y * floatsPerRow + x];
        }
      }
      stagingBuffer.unmap();

      // Read target
      const encoder2 = device.createCommandEncoder();
      encoder2.copyTextureToBuffer(
        { texture: targetTexture },
        { buffer: stagingBuffer, bytesPerRow },
        { width, height }
      );
      device.queue.submit([encoder2.finish()]);

      await stagingBuffer.mapAsync(GPUMapMode.READ);
      const targetRawData = new Float32Array(stagingBuffer.getMappedRange().slice(0));
      const targetData = new Float32Array(width * height);
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          targetData[y * width + x] = targetRawData[y * floatsPerRow + x];
        }
      }
      stagingBuffer.unmap();
      stagingBuffer.destroy();

      // Compute MSE
      let sum = 0;
      for (let i = 0; i < width * height; i++) {
        const diff = predData[i] - targetData[i];
        sum += diff * diff;
      }

      return sum / (width * height);
    },

    setParams(newParams: Partial<TrainingParams>) {
      params = { ...params, ...newParams };
      writeUniforms();
    },

    getParams() {
      return { ...params };
    },

    setKernel(kernelData: Float32Array, newKernelSize: number) {
      if (newKernelSize !== kernelSize) {
        kernelTexture.destroy();
        kernelSize = newKernelSize;
        kernelTexture = device.createTexture({
          label: 'training-kernel-texture',
          size: [kernelSize, kernelSize],
          format: 'r32float',
          usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
        });
      }

      device.queue.writeTexture(
        { texture: kernelTexture },
        kernelData,
        { bytesPerRow: kernelSize * 4 },
        { width: kernelSize, height: kernelSize }
      );
    },

    destroy() {
      uniformBuffer.destroy();
      kernelTexture.destroy();
      gradientBuffer.destroy();
      gradientStagingBuffer.destroy();
      lossBuffer.destroy();
      lossStagingBuffer.destroy();
      for (const tex of texturePool) {
        tex.destroy();
      }
    },
  };
}
