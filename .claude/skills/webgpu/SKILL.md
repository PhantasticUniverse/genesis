---
name: webgpu
description: WebGPU compute pipelines, texture pooling, buffer management, and spatial hashing. Use when working on GPU shaders, optimizing performance, or debugging rendering issues.
---

# WebGPU Pipelines

## Pipeline Architecture

```
compute/webgpu/
├── continuous-pipeline.ts    # Lenia convolution + FFT
├── multi-channel-pipeline.ts # Multi-species ecology
├── lenia-3d-pipeline.ts      # 3D Lenia compute
├── particle-pipeline.ts      # Particle physics
├── flow-lenia-pipeline.ts    # Mass-conserving flow
├── texture-pool.ts           # GPU memory management
├── buffer-manager.ts         # Buffer lifecycle
└── shaders/                  # WGSL shader code
```

## Texture Pool (Memory Optimization)

```typescript
import { createTexturePool } from "./compute/webgpu/texture-pool";

const pool = createTexturePool(device, {
  staleFrames: 300, // Frames before texture considered stale
  maxPerKey: 4, // Max textures per size/format combo
});

// Acquire texture from pool
const texture = pool.acquire(256, 256, "r32float", usage);

// Release back to pool when done
pool.release(texture);

// Periodic cleanup (call in render loop)
pool.cleanup();

// Get pool statistics
const stats = pool.getStats();
console.log(`Active: ${stats.activeCount}, Pooled: ${stats.pooledCount}`);
```

## Buffer Manager

```typescript
import { createBufferManager } from "./compute/webgpu/buffer-manager";

const buffers = createBufferManager(device);

// Create managed buffer
const buffer = buffers.create("myBuffer", {
  size: 1024,
  usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
});

// Get existing buffer
const existing = buffers.get("myBuffer");

// Release buffer
buffers.release("myBuffer");

// Cleanup all
buffers.destroy();
```

## Async GPU Readback

```typescript
import { createAsyncReadbackManager } from "./core/async-readback";

const readback = createAsyncReadbackManager(device, width, height);

// Request non-blocking readback
readback.requestReadback(device, commandEncoder, stateTexture);

// Poll for result (returns cached data while new data maps)
const state = readback.pollResult();

// Check if new data is pending
if (readback.isPending()) {
  // Use cached result while waiting
}

// Get last cached result
const cached = readback.getCachedResult();

// Cleanup
readback.destroy();
```

## Spatial Hash (Creature Tracking)

```typescript
import { createSpatialHash } from "./agency/spatial-hash";

const hash = createSpatialHash(worldWidth, worldHeight, cellSize);

// Insert creatures
hash.insert(creature); // Requires { x, y, id }

// Query by radius
const nearby = hash.queryRadius(x, y, radius);

// Find nearest
const nearest = hash.findNearest(x, y);

// Update position
hash.update(creature, newX, newY);

// Remove
hash.remove(creature.id);

// Clear all
hash.clear();
```

## Hungarian Algorithm (Optimal Creature Matching)

```typescript
import {
  hungarianAlgorithm,
  matchCreaturesHungarian,
  computeTrackingCostMatrix,
} from "./agency/hungarian";

// Low-level: solve assignment problem
const result = hungarianAlgorithm(costMatrix, maxCost);
// result.assignment[i] = j means row i assigned to column j

// High-level: match creatures across frames
const matches = matchCreaturesHungarian(previousCreatures, newComponents, 50);
// Returns Map<componentLabel, creatureId>

// Compute cost matrix with velocity prediction
const costs = computeTrackingCostMatrix(prevCreatures, newComponents, {
  distanceWeight: 1.0,
  massWeight: 0.3,
  velocityWeight: 0.5,
  maxDistance: 50,
});
```

## KD-Tree for Novelty Search

```typescript
import { BehaviorKDTree, createBehaviorIndex } from "./discovery/spatial-index";

// Create from individuals
const kdTree = createBehaviorIndex(individuals);

// Query k-nearest neighbors
const neighbors = kdTree.kNearest(behaviorVector, k);

// Calculate novelty score
const novelty = kdTree.noveltyScore(behavior, k);

// Insert new point
kdTree.insert(behaviorVector, individual);
```

## FFT Pipeline

```typescript
// FFT auto-activates when kernelRadius >= 16
// Manual control:
pipeline.setUseFFT(true);
pipeline.setKernelTexture(kernelTexture);
```

## Shader Conventions

WGSL shaders are in `compute/webgpu/shaders/`:

```wgsl
// Workgroup size convention
@compute @workgroup_size(16, 16)
fn main(@builtin(global_invocation_id) id: vec3<u32>) {
    let x = id.x;
    let y = id.y;
    // ...
}

// Texture sampling with wrapping
fn sample_wrapped(tex: texture_2d<f32>, x: i32, y: i32, size: vec2<i32>) -> f32 {
    let wx = ((x % size.x) + size.x) % size.x;
    let wy = ((y % size.y) + size.y) % size.y;
    return textureLoad(tex, vec2<i32>(wx, wy), 0).r;
}
```

## Performance Tips

1. **Use texture pool** - Reduces GPU memory allocation churn
2. **Batch operations** - Combine multiple passes when possible
3. **Prefer r32float** - Single channel for Lenia state
4. **Workgroup size 16x16** - Good default for 2D compute
5. **Avoid readback** - Use `getMass()` sparingly, prefer cached values

## Known Issues

- **WebGPU types**: Show compile errors but work at runtime
- **FFT threshold**: `kernelRadius >= 16` triggers FFT mode automatically
