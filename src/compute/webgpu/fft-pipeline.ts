/**
 * FFT Convolution Pipeline
 * Efficient convolution for large kernel radii using FFT
 *
 * For kernel radius R > 16, FFT convolution is more efficient than
 * direct convolution. This pipeline implements:
 * 1. Convert real state to complex format
 * 2. Forward 2D FFT of state
 * 3. Pointwise multiplication with pre-computed kernel FFT
 * 4. Inverse 2D FFT to get convolution result
 * 5. Extract real part back to r32float
 */

import { createShaderModule } from "./context";
import fftButterflyShader from "./shaders/fft-butterfly.wgsl?raw";
import fftMultiplyShader from "./shaders/fft-multiply.wgsl?raw";
import fftConvertShader from "./shaders/fft-convert.wgsl?raw";

export interface FFTPipeline {
  // Perform FFT convolution
  convolve: (
    commandEncoder: GPUCommandEncoder,
    inputTexture: GPUTexture,
    outputTexture: GPUTexture,
  ) => void;

  // Update kernel (precomputes kernel FFT)
  setKernel: (kernelData: Float32Array, kernelSize: number) => void;

  // Get size
  getSize: () => number;

  // Cleanup
  destroy: () => void;
}

/**
 * Create FFT convolution pipeline
 * @param device WebGPU device
 * @param size Grid size (must be power of 2)
 */
export function createFFTPipeline(
  device: GPUDevice,
  size: number,
): FFTPipeline {
  // Validate size is power of 2
  if ((size & (size - 1)) !== 0) {
    throw new Error(`FFT size must be power of 2, got ${size}`);
  }

  const numStages = Math.log2(size);

  // Create shader modules
  const butterflyModule = createShaderModule(
    device,
    fftButterflyShader,
    "fft-butterfly",
  );
  const multiplyModule = createShaderModule(
    device,
    fftMultiplyShader,
    "fft-multiply",
  );
  const convertModule = createShaderModule(
    device,
    fftConvertShader,
    "fft-convert",
  );

  // Create textures for intermediate FFT results (complex values = rg32float)
  const createComplexTexture = (label: string) =>
    device.createTexture({
      label,
      size: [size, size],
      format: "rg32float",
      usage:
        GPUTextureUsage.TEXTURE_BINDING |
        GPUTextureUsage.STORAGE_BINDING |
        GPUTextureUsage.COPY_DST |
        GPUTextureUsage.COPY_SRC,
    });

  // Ping-pong textures for FFT passes
  const fftTextureA = createComplexTexture("fft-texture-a");
  const fftTextureB = createComplexTexture("fft-texture-b");

  // Kernel FFT texture (precomputed)
  const kernelFFTTexture = createComplexTexture("kernel-fft");

  // Uniform buffers
  const butterflyUniformBuffer = device.createBuffer({
    label: "fft-butterfly-uniform",
    size: 16, // 4 x u32
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  const multiplyUniformBuffer = device.createBuffer({
    label: "fft-multiply-uniform",
    size: 16, // 2 x u32 + f32 + padding
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  const convertUniformBuffer = device.createBuffer({
    label: "fft-convert-uniform",
    size: 16, // width, height, scale, padding
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  // Write convert uniforms once (size doesn't change)
  const convertData = new ArrayBuffer(16);
  const convertU32 = new Uint32Array(convertData);
  const convertF32 = new Float32Array(convertData);
  convertU32[0] = size;
  convertU32[1] = size;
  convertF32[2] = 1.0 / (size * size); // Normalization scale for inverse FFT
  device.queue.writeBuffer(convertUniformBuffer, 0, convertData);

  // Create bind group layouts
  const butterflyBindGroupLayout = device.createBindGroupLayout({
    label: "fft-butterfly-bind-group-layout",
    entries: [
      {
        binding: 0,
        visibility: GPUShaderStage.COMPUTE,
        texture: { sampleType: "unfilterable-float" },
      },
      {
        binding: 1,
        visibility: GPUShaderStage.COMPUTE,
        storageTexture: { access: "write-only", format: "rg32float" },
      },
      {
        binding: 2,
        visibility: GPUShaderStage.COMPUTE,
        buffer: { type: "uniform" },
      },
    ],
  });

  const multiplyBindGroupLayout = device.createBindGroupLayout({
    label: "fft-multiply-bind-group-layout",
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
        storageTexture: { access: "write-only", format: "rg32float" },
      },
      {
        binding: 3,
        visibility: GPUShaderStage.COMPUTE,
        buffer: { type: "uniform" },
      },
    ],
  });

  // Real-to-complex conversion bind group layout
  const realToComplexBindGroupLayout = device.createBindGroupLayout({
    label: "fft-real-to-complex-bind-group-layout",
    entries: [
      {
        binding: 0,
        visibility: GPUShaderStage.COMPUTE,
        texture: { sampleType: "unfilterable-float" },
      },
      {
        binding: 1,
        visibility: GPUShaderStage.COMPUTE,
        storageTexture: { access: "write-only", format: "rg32float" },
      },
      {
        binding: 2,
        visibility: GPUShaderStage.COMPUTE,
        buffer: { type: "uniform" },
      },
    ],
  });

  // Complex-to-real extraction bind group layout
  const complexToRealBindGroupLayout = device.createBindGroupLayout({
    label: "fft-complex-to-real-bind-group-layout",
    entries: [
      {
        binding: 0,
        visibility: GPUShaderStage.COMPUTE,
        texture: { sampleType: "unfilterable-float" },
      },
      {
        binding: 1,
        visibility: GPUShaderStage.COMPUTE,
        storageTexture: { access: "write-only", format: "rg32float" },
      }, // dummy - shader needs this binding
      {
        binding: 2,
        visibility: GPUShaderStage.COMPUTE,
        buffer: { type: "uniform" },
      },
      {
        binding: 3,
        visibility: GPUShaderStage.COMPUTE,
        storageTexture: { access: "write-only", format: "r32float" },
      },
    ],
  });

  // Create pipelines
  const butterflyPipeline = device.createComputePipeline({
    label: "fft-butterfly-pipeline",
    layout: device.createPipelineLayout({
      bindGroupLayouts: [butterflyBindGroupLayout],
    }),
    compute: { module: butterflyModule, entryPoint: "main" },
  });

  const multiplyPipeline = device.createComputePipeline({
    label: "fft-multiply-pipeline",
    layout: device.createPipelineLayout({
      bindGroupLayouts: [multiplyBindGroupLayout],
    }),
    compute: { module: multiplyModule, entryPoint: "main" },
  });

  const realToComplexPipeline = device.createComputePipeline({
    label: "fft-real-to-complex-pipeline",
    layout: device.createPipelineLayout({
      bindGroupLayouts: [realToComplexBindGroupLayout],
    }),
    compute: { module: convertModule, entryPoint: "real_to_complex" },
  });

  const complexToRealPipeline = device.createComputePipeline({
    label: "fft-complex-to-real-pipeline",
    layout: device.createPipelineLayout({
      bindGroupLayouts: [complexToRealBindGroupLayout],
    }),
    compute: { module: convertModule, entryPoint: "complex_to_real" },
  });

  const workgroupsPerDim = Math.ceil(size / 16);

  /**
   * Perform 1D FFT passes (horizontal or vertical)
   */
  function performFFT1D(
    commandEncoder: GPUCommandEncoder,
    input: GPUTexture,
    output: GPUTexture,
    horizontal: boolean,
    inverse: boolean,
  ): GPUTexture {
    let currentInput = input;
    let currentOutput = output;

    for (let stage = 0; stage < numStages; stage++) {
      // Update uniforms
      const uniformData = new Uint32Array([
        size,
        stage,
        inverse ? -1 : 1, // direction as i32
        horizontal ? 1 : 0,
      ]);
      device.queue.writeBuffer(butterflyUniformBuffer, 0, uniformData);

      // Create bind group
      const bindGroup = device.createBindGroup({
        layout: butterflyBindGroupLayout,
        entries: [
          { binding: 0, resource: currentInput.createView() },
          { binding: 1, resource: currentOutput.createView() },
          { binding: 2, resource: { buffer: butterflyUniformBuffer } },
        ],
      });

      // Dispatch
      const pass = commandEncoder.beginComputePass();
      pass.setPipeline(butterflyPipeline);
      pass.setBindGroup(0, bindGroup);
      pass.dispatchWorkgroups(workgroupsPerDim, workgroupsPerDim);
      pass.end();

      // Swap textures for next stage
      const temp = currentInput;
      currentInput = currentOutput;
      currentOutput = temp;
    }

    // Return the texture containing the result
    return currentInput;
  }

  /**
   * Convert real input (r32float) to complex format (rg32float)
   */
  function realToComplex(
    commandEncoder: GPUCommandEncoder,
    realTexture: GPUTexture,
    complexTexture: GPUTexture,
  ) {
    const bindGroup = device.createBindGroup({
      layout: realToComplexBindGroupLayout,
      entries: [
        { binding: 0, resource: realTexture.createView() },
        { binding: 1, resource: complexTexture.createView() },
        { binding: 2, resource: { buffer: convertUniformBuffer } },
      ],
    });

    const pass = commandEncoder.beginComputePass();
    pass.setPipeline(realToComplexPipeline);
    pass.setBindGroup(0, bindGroup);
    pass.dispatchWorkgroups(workgroupsPerDim, workgroupsPerDim);
    pass.end();
  }

  /**
   * Extract real part from complex texture (rg32float -> r32float)
   * Applies normalization for inverse FFT
   */
  function complexToReal(
    commandEncoder: GPUCommandEncoder,
    complexTexture: GPUTexture,
    realTexture: GPUTexture,
  ) {
    const bindGroup = device.createBindGroup({
      layout: complexToRealBindGroupLayout,
      entries: [
        { binding: 0, resource: complexTexture.createView() },
        { binding: 1, resource: fftTextureA.createView() }, // dummy binding (shader signature requires it)
        { binding: 2, resource: { buffer: convertUniformBuffer } },
        { binding: 3, resource: realTexture.createView() },
      ],
    });

    const pass = commandEncoder.beginComputePass();
    pass.setPipeline(complexToRealPipeline);
    pass.setBindGroup(0, bindGroup);
    pass.dispatchWorkgroups(workgroupsPerDim, workgroupsPerDim);
    pass.end();
  }

  /**
   * Precompute kernel FFT
   */
  function computeKernelFFT(kernelData: Float32Array, kernelSize: number) {
    // Pad kernel to FFT size and center it
    const paddedKernel = new Float32Array(size * size * 2); // Complex format

    const offset = Math.floor((size - kernelSize) / 2);
    for (let y = 0; y < kernelSize; y++) {
      for (let x = 0; x < kernelSize; x++) {
        const srcIdx = y * kernelSize + x;
        // Wrap to center in FFT (shift for proper convolution)
        const dstX = (x - Math.floor(kernelSize / 2) + size) % size;
        const dstY = (y - Math.floor(kernelSize / 2) + size) % size;
        const dstIdx = (dstY * size + dstX) * 2;
        paddedKernel[dstIdx] = kernelData[srcIdx]; // Real part
        paddedKernel[dstIdx + 1] = 0; // Imaginary part
      }
    }

    // Write to texture
    device.queue.writeTexture(
      { texture: fftTextureA },
      paddedKernel,
      { bytesPerRow: size * 8 }, // 2 floats per pixel * 4 bytes
      { width: size, height: size },
    );

    // Perform 2D FFT on kernel
    const commandEncoder = device.createCommandEncoder();

    // Horizontal FFT
    let result = performFFT1D(
      commandEncoder,
      fftTextureA,
      fftTextureB,
      true,
      false,
    );

    // Vertical FFT (ping-pong handled by selecting opposite texture as output)
    result = performFFT1D(
      commandEncoder,
      result,
      result === fftTextureA ? fftTextureB : fftTextureA,
      false,
      false,
    );

    // Copy to kernel FFT texture
    commandEncoder.copyTextureToTexture(
      { texture: result },
      { texture: kernelFFTTexture },
      { width: size, height: size },
    );

    device.queue.submit([commandEncoder.finish()]);
  }

  return {
    convolve(
      commandEncoder: GPUCommandEncoder,
      inputTexture: GPUTexture,
      outputTexture: GPUTexture,
    ) {
      // Step 1: Convert real input (r32float) to complex (rg32float)
      realToComplex(commandEncoder, inputTexture, fftTextureA);

      // Step 2: Forward 2D FFT
      // Horizontal forward FFT
      let stateFFT = performFFT1D(
        commandEncoder,
        fftTextureA,
        fftTextureB,
        true,
        false,
      );

      // Vertical forward FFT
      stateFFT = performFFT1D(
        commandEncoder,
        stateFFT,
        stateFFT === fftTextureA ? fftTextureB : fftTextureA,
        false,
        false,
      );

      // Step 3: Multiply in frequency domain
      const multiplyUniformData = new ArrayBuffer(16);
      const u32View = new Uint32Array(multiplyUniformData);
      const f32View = new Float32Array(multiplyUniformData);
      u32View[0] = size;
      u32View[1] = size;
      f32View[2] = 1.0; // Scale factor (normalization done in complexToReal)
      device.queue.writeBuffer(multiplyUniformBuffer, 0, multiplyUniformData);

      const multiplyOutput =
        stateFFT === fftTextureA ? fftTextureB : fftTextureA;

      const multiplyBindGroup = device.createBindGroup({
        layout: multiplyBindGroupLayout,
        entries: [
          { binding: 0, resource: stateFFT.createView() },
          { binding: 1, resource: kernelFFTTexture.createView() },
          { binding: 2, resource: multiplyOutput.createView() },
          { binding: 3, resource: { buffer: multiplyUniformBuffer } },
        ],
      });

      const multiplyPass = commandEncoder.beginComputePass();
      multiplyPass.setPipeline(multiplyPipeline);
      multiplyPass.setBindGroup(0, multiplyBindGroup);
      multiplyPass.dispatchWorkgroups(workgroupsPerDim, workgroupsPerDim);
      multiplyPass.end();

      // Step 4: Inverse 2D FFT
      // Horizontal inverse FFT
      let result = performFFT1D(
        commandEncoder,
        multiplyOutput,
        stateFFT,
        true,
        true,
      );

      // Vertical inverse FFT
      result = performFFT1D(
        commandEncoder,
        result,
        result === fftTextureA ? fftTextureB : fftTextureA,
        false,
        true,
      );

      // Step 5: Extract real part back to r32float with normalization
      complexToReal(commandEncoder, result, outputTexture);
    },

    setKernel(kernelData: Float32Array, kernelSize: number) {
      computeKernelFFT(kernelData, kernelSize);
    },

    getSize() {
      return size;
    },

    destroy() {
      fftTextureA.destroy();
      fftTextureB.destroy();
      kernelFFTTexture.destroy();
      butterflyUniformBuffer.destroy();
      multiplyUniformBuffer.destroy();
      convertUniformBuffer.destroy();
    },
  };
}

/**
 * Check if FFT convolution would be more efficient than direct convolution
 * Rule of thumb: FFT is faster when kernel radius >= 16
 */
export function shouldUseFFT(kernelRadius: number, gridSize: number): boolean {
  // FFT complexity: O(N^2 * log(N)) for 2D FFT
  // Direct convolution: O(N^2 * R^2) where R is kernel radius
  // Use simple threshold: FFT for large kernels (radius >= 16)
  // This avoids potential boundary artifacts in FFT for smaller kernels
  return kernelRadius >= 16;
}
