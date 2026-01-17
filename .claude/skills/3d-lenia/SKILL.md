---
name: 3d-lenia
description: 3D volumetric Lenia engine, presets, slice visualization, and GPU pipeline. Use when working on 3D simulation, volumetric rendering, or 3D organism presets.
---

# 3D Lenia Engine

## Creating 3D Engine

```typescript
import { createEngine3D } from "./core/engine-3d";

const engine3D = await createEngine3D({
  canvas,
  size: 64, // Grid size (32, 64, or 128)
});
```

## Engine API

```typescript
// Lifecycle
engine3D.start();
engine3D.stop();
engine3D.stepOnce();

// Load preset organism
engine3D.loadPreset("stable-sphere");

// Slice visualization
engine3D.setSlicePlane("xy" | "xz" | "yz");
engine3D.setSlicePosition(32); // Position along slice axis

// Rendering
engine3D.setColormap("viridis");

// State access
const state = await engine3D.getState(); // Full 3D state (Float32Array)
const slice = await engine3D.getSlice("xy", 32); // 2D slice
```

## 3D Presets

| Preset               | Description               |
| -------------------- | ------------------------- |
| `orbium-3d`          | Classic Orbium in 3D      |
| `stable-sphere`      | Stable spherical organism |
| `ellipsoid-glider`   | Moving ellipsoidal glider |
| `dual-orbium`        | Two interacting Orbiums   |
| `torus-3d`           | Toroidal organism         |
| `dual-ring-blob`     | Two ring-shaped blobs     |
| `primordial-soup-3d` | Random initial conditions |
| `small-orbium`       | Compact Orbium variant    |

### Loading Presets

```typescript
import { LENIA_3D_PRESETS } from "./patterns/lenia-3d-presets";

const preset = LENIA_3D_PRESETS["stable-sphere"];
engine3D.loadPreset(preset.name);
```

## Grid Sizes

| Size | Total Cells | Use Case          |
| ---- | ----------- | ----------------- |
| 32³  | 32,768      | Quick testing     |
| 64³  | 262,144     | Default, balanced |
| 128³ | 2,097,152   | High detail, slow |

## Types

```typescript
import type {
  Grid3DConfig,
  Lenia3DParams,
  Kernel3DConfig,
  SlicePlane,
} from "./core/types-3d";

interface Grid3DConfig {
  size: number; // Cube dimension
  kernelRadius: number;
  growthCenter: number;
  growthWidth: number;
  dt: number;
}

type SlicePlane = "xy" | "xz" | "yz";
```

## 3D GPU Pipeline

```typescript
import { createLenia3DPipeline } from "./compute/webgpu/lenia-3d-pipeline";

const pipeline = createLenia3DPipeline(device, {
  size: 64,
  kernelRadius: 7,
  growthCenter: 0.12,
  growthWidth: 0.04,
});

// Step simulation
pipeline.step(commandEncoder);

// Get slice for visualization
const sliceData = await pipeline.getSlice("xy", 32);
```

## Core Files

| File                                  | Purpose                 |
| ------------------------------------- | ----------------------- |
| `core/engine-3d.ts`                   | 3D engine orchestrator  |
| `core/types-3d.ts`                    | 3D type definitions     |
| `core/kernels-3d.ts`                  | 3D kernel generation    |
| `compute/webgpu/lenia-3d-pipeline.ts` | 3D GPU compute pipeline |
| `patterns/lenia-3d-presets.ts`        | 3D organism presets     |
