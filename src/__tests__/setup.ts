/**
 * Test Setup
 * Configures test environment with WebGPU mocks and global utilities
 */

import { vi } from 'vitest';

// Mock WebGPU types and objects
class MockGPUBuffer {
  label: string;
  size: number;
  usage: number;

  constructor(descriptor: GPUBufferDescriptor) {
    this.label = descriptor.label ?? '';
    this.size = descriptor.size;
    this.usage = descriptor.usage;
  }

  destroy(): void {}

  getMappedRange(): ArrayBuffer {
    return new ArrayBuffer(this.size);
  }

  unmap(): void {}

  async mapAsync(_mode: number): Promise<void> {
    return Promise.resolve();
  }
}

class MockGPUTexture {
  label: string;
  width: number;
  height: number;
  format: string;

  constructor(descriptor: GPUTextureDescriptor) {
    this.label = descriptor.label ?? '';
    this.width = (descriptor.size as GPUExtent3DDict).width ?? 256;
    this.height = (descriptor.size as GPUExtent3DDict).height ?? 256;
    this.format = descriptor.format;
  }

  createView(): MockGPUTextureView {
    return new MockGPUTextureView();
  }

  destroy(): void {}
}

class MockGPUTextureView {}

class MockGPUShaderModule {
  label: string;

  constructor(descriptor: GPUShaderModuleDescriptor) {
    this.label = descriptor.label ?? '';
  }
}

class MockGPUComputePassEncoder {
  setPipeline(_pipeline: GPUComputePipeline): void {}
  setBindGroup(_index: number, _bindGroup: GPUBindGroup): void {}
  dispatchWorkgroups(_x: number, _y?: number, _z?: number): void {}
  end(): void {}
}

class MockGPURenderPassEncoder {
  setPipeline(_pipeline: GPURenderPipeline): void {}
  setBindGroup(_index: number, _bindGroup: GPUBindGroup): void {}
  draw(_vertexCount: number): void {}
  end(): void {}
}

class MockGPUCommandEncoder {
  beginComputePass(): MockGPUComputePassEncoder {
    return new MockGPUComputePassEncoder();
  }

  beginRenderPass(_descriptor: GPURenderPassDescriptor): MockGPURenderPassEncoder {
    return new MockGPURenderPassEncoder();
  }

  copyTextureToBuffer(
    _source: GPUImageCopyTexture,
    _destination: GPUImageCopyBuffer,
    _copySize: GPUExtent3DStrict
  ): void {}

  copyBufferToBuffer(
    _source: GPUBuffer,
    _sourceOffset: number,
    _destination: GPUBuffer,
    _destinationOffset: number,
    _size: number
  ): void {}

  finish(): MockGPUCommandBuffer {
    return new MockGPUCommandBuffer();
  }
}

class MockGPUCommandBuffer {}

class MockGPUQueue {
  submit(_commandBuffers: GPUCommandBuffer[]): void {}

  writeBuffer(
    _buffer: GPUBuffer,
    _bufferOffset: number,
    _data: BufferSource
  ): void {}

  writeTexture(
    _destination: GPUImageCopyTexture,
    _data: BufferSource,
    _dataLayout: GPUImageDataLayout,
    _size: GPUExtent3DStrict
  ): void {}

  async onSubmittedWorkDone(): Promise<void> {
    return Promise.resolve();
  }
}

class MockGPUBindGroupLayout {
  label: string;

  constructor(descriptor: GPUBindGroupLayoutDescriptor) {
    this.label = descriptor.label ?? '';
  }
}

class MockGPUBindGroup {
  label: string;

  constructor(descriptor: GPUBindGroupDescriptor) {
    this.label = descriptor.label ?? '';
  }
}

class MockGPUPipelineLayout {
  label: string;

  constructor(descriptor: GPUPipelineLayoutDescriptor) {
    this.label = descriptor.label ?? '';
  }
}

class MockGPUComputePipeline {
  label: string;

  constructor(descriptor: GPUComputePipelineDescriptor) {
    this.label = descriptor.label ?? '';
  }
}

class MockGPURenderPipeline {
  label: string;

  constructor(descriptor: GPURenderPipelineDescriptor) {
    this.label = descriptor.label ?? '';
  }
}

class MockGPUDevice {
  queue: MockGPUQueue = new MockGPUQueue();

  createBuffer(descriptor: GPUBufferDescriptor): MockGPUBuffer {
    return new MockGPUBuffer(descriptor);
  }

  createTexture(descriptor: GPUTextureDescriptor): MockGPUTexture {
    return new MockGPUTexture(descriptor);
  }

  createShaderModule(descriptor: GPUShaderModuleDescriptor): MockGPUShaderModule {
    return new MockGPUShaderModule(descriptor);
  }

  createBindGroupLayout(descriptor: GPUBindGroupLayoutDescriptor): MockGPUBindGroupLayout {
    return new MockGPUBindGroupLayout(descriptor);
  }

  createBindGroup(descriptor: GPUBindGroupDescriptor): MockGPUBindGroup {
    return new MockGPUBindGroup(descriptor);
  }

  createPipelineLayout(descriptor: GPUPipelineLayoutDescriptor): MockGPUPipelineLayout {
    return new MockGPUPipelineLayout(descriptor);
  }

  createComputePipeline(descriptor: GPUComputePipelineDescriptor): MockGPUComputePipeline {
    return new MockGPUComputePipeline(descriptor);
  }

  createRenderPipeline(descriptor: GPURenderPipelineDescriptor): MockGPURenderPipeline {
    return new MockGPURenderPipeline(descriptor);
  }

  createCommandEncoder(): MockGPUCommandEncoder {
    return new MockGPUCommandEncoder();
  }

  destroy(): void {}
}

class MockGPUAdapter {
  async requestDevice(): Promise<MockGPUDevice> {
    return new MockGPUDevice();
  }
}

class MockGPU {
  async requestAdapter(): Promise<MockGPUAdapter> {
    return new MockGPUAdapter();
  }

  getPreferredCanvasFormat(): string {
    return 'bgra8unorm';
  }
}

// Install mocks globally
const mockGPU = new MockGPU();

// Mock navigator.gpu
Object.defineProperty(globalThis.navigator, 'gpu', {
  value: mockGPU,
  writable: true,
  configurable: true,
});

// Mock GPUTextureUsage constants
(globalThis as Record<string, unknown>).GPUTextureUsage = {
  COPY_SRC: 0x01,
  COPY_DST: 0x02,
  TEXTURE_BINDING: 0x04,
  STORAGE_BINDING: 0x08,
  RENDER_ATTACHMENT: 0x10,
};

// Mock GPUBufferUsage constants
(globalThis as Record<string, unknown>).GPUBufferUsage = {
  MAP_READ: 0x0001,
  MAP_WRITE: 0x0002,
  COPY_SRC: 0x0004,
  COPY_DST: 0x0008,
  INDEX: 0x0010,
  VERTEX: 0x0020,
  UNIFORM: 0x0040,
  STORAGE: 0x0080,
  INDIRECT: 0x0100,
  QUERY_RESOLVE: 0x0200,
};

// Mock GPUShaderStage constants
(globalThis as Record<string, unknown>).GPUShaderStage = {
  VERTEX: 0x1,
  FRAGMENT: 0x2,
  COMPUTE: 0x4,
};

// Mock GPUMapMode constants
(globalThis as Record<string, unknown>).GPUMapMode = {
  READ: 0x0001,
  WRITE: 0x0002,
};

// Export mocks for direct use in tests
export {
  MockGPUDevice,
  MockGPUBuffer,
  MockGPUTexture,
  MockGPUCommandEncoder,
  MockGPUQueue,
  mockGPU,
};

// Global test utilities
export function createTestGrid(width: number, height: number, fillValue = 0): Float32Array {
  const grid = new Float32Array(width * height);
  if (fillValue !== 0) {
    grid.fill(fillValue);
  }
  return grid;
}

export function createSymmetricPattern(size: number): Float32Array {
  const grid = new Float32Array(size * size);
  const center = Math.floor(size / 2);

  // Create a symmetric cross pattern
  for (let i = 0; i < size; i++) {
    grid[center * size + i] = 1; // Horizontal line
    grid[i * size + center] = 1; // Vertical line
  }

  return grid;
}

export function createAsymmetricPattern(size: number): Float32Array {
  const grid = new Float32Array(size * size);

  // Create an asymmetric L-shape in top-left
  for (let y = 0; y < size / 3; y++) {
    for (let x = 0; x < size / 3; x++) {
      grid[y * size + x] = 1;
    }
  }
  for (let y = 0; y < size / 2; y++) {
    grid[y * size] = 1;
  }

  return grid;
}

// Console spy for error tracking
beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});
