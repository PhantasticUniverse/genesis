/**
 * WebGPU Context Manager
 * Handles device initialization and capability detection
 */

import type { WebGPUCapabilities } from '../../core/types';

export interface WebGPUContext {
  adapter: GPUAdapter;
  device: GPUDevice;
  capabilities: WebGPUCapabilities;
}

/**
 * Check if WebGPU is available in this browser
 */
export function isWebGPUAvailable(): boolean {
  return typeof navigator !== 'undefined' && 'gpu' in navigator;
}

/**
 * Initialize WebGPU context with device and adapter
 */
export async function initWebGPU(): Promise<WebGPUContext> {
  if (!isWebGPUAvailable()) {
    throw new Error(
      'WebGPU is not supported in this browser. ' +
      'Please use Chrome 113+, Firefox 121+, Safari 18+, or Edge 113+.'
    );
  }

  // Request adapter (connection to GPU)
  const adapter = await navigator.gpu.requestAdapter({
    powerPreference: 'high-performance',
  });

  if (!adapter) {
    throw new Error(
      'Failed to get WebGPU adapter. ' +
      'Your GPU may not support WebGPU.'
    );
  }

  // Request device (logical connection for issuing commands)
  const device = await adapter.requestDevice({
    requiredFeatures: [],
    requiredLimits: {
      maxStorageBufferBindingSize: adapter.limits.maxStorageBufferBindingSize,
      maxComputeWorkgroupsPerDimension: adapter.limits.maxComputeWorkgroupsPerDimension,
    },
  });

  // Handle device loss
  device.lost.then((info) => {
    console.error('WebGPU device lost:', info.message);
    if (info.reason !== 'destroyed') {
      // Attempt to reinitialize
      console.log('Attempting to reinitialize WebGPU...');
    }
  });

  // Get capabilities (requestAdapterInfo may not be available in all browsers)
  let adapterInfo: GPUAdapterInfo | undefined;
  try {
    if ('requestAdapterInfo' in adapter) {
      adapterInfo = await (adapter as any).requestAdapterInfo();
    }
  } catch {
    // Ignore - not all browsers support this
  }

  const capabilities: WebGPUCapabilities = {
    available: true,
    adapterInfo,
    limits: device.limits,
    features: device.features,
  };

  console.log('WebGPU initialized:', {
    vendor: adapterInfo?.vendor ?? 'unknown',
    architecture: adapterInfo?.architecture ?? 'unknown',
    maxTextureSize: capabilities.limits?.maxTextureDimension2D,
    maxWorkgroupSize: capabilities.limits?.maxComputeWorkgroupSizeX,
  });

  return { adapter, device, capabilities };
}

/**
 * Create a shader module from WGSL source
 */
export function createShaderModule(
  device: GPUDevice,
  code: string,
  label?: string
): GPUShaderModule {
  return device.createShaderModule({
    label: label || 'shader',
    code,
  });
}

/**
 * Create a compute pipeline
 */
export function createComputePipeline(
  device: GPUDevice,
  shaderModule: GPUShaderModule,
  entryPoint: string,
  bindGroupLayout: GPUBindGroupLayout,
  label?: string
): GPUComputePipeline {
  return device.createComputePipeline({
    label: label || 'compute-pipeline',
    layout: device.createPipelineLayout({
      bindGroupLayouts: [bindGroupLayout],
    }),
    compute: {
      module: shaderModule,
      entryPoint,
    },
  });
}
