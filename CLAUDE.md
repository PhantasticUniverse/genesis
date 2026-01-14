# GENESIS - Cellular Automata Platform

WebGPU-powered artificial life simulation platform.

## Quick Start
```bash
bun install && bun run dev
```

## Stack
- React 19 + TypeScript + Tailwind + Zustand
- WebGPU compute shaders (WGSL)
- Vite + Bun

## Directory Structure
```
src/
├── core/           # Engine, types, kernels, channels
├── compute/webgpu/ # GPU pipelines + shaders/
├── agency/         # Creature tracking, sensors
├── discovery/      # GA, fitness, novelty, phylogeny
├── training/       # Neural CA (GPU + CPU)
├── persistence/    # Save/load organisms
├── ui/components/  # React panels
└── patterns/       # Lenia presets
```

## Core Files

| File | Purpose |
|------|---------|
| `core/engine.ts` | Main orchestrator - GPU, sim loop, all features |
| `core/channels.ts` | Multi-species preset configs |
| `compute/webgpu/continuous-pipeline.ts` | Lenia convolution + FFT |
| `compute/webgpu/multi-channel-pipeline.ts` | Multi-species ecology |
| `discovery/genetic-algorithm.ts` | GA + novelty search |
| `training/gpu-trainer.ts` | Neural CA training |
| `persistence/storage.ts` | LocalStorage save/load |

## Key Parameters

### Lenia (Stable)
```typescript
kernelRadius: 13
growthCenter: 0.12  // μ - center of growth function
growthWidth: 0.04   // σ - width (NOT 0.015, too narrow)
dt: 0.1
```

### Multi-Species
- Use `growthCenter: 0.12`, `growthWidth: 0.04` for stable organisms
- Blob radius: 25 (not 15)
- FFT activates automatically when R >= 16

## Engine API (Quick Ref)
```typescript
engine.start() / stop() / reset(pattern)
engine.setParadigm('discrete' | 'continuous')
engine.enableMultiChannel(config) / disableMultiChannel()
engine.enableSensorimotor() / disableSensorimotor()
engine.setConservationConfig({ enabled: true })
engine.getMass(): Promise<number>
```

## Multi-Species Presets
| Preset | Species | Dynamics |
|--------|---------|----------|
| single | 1 | Standard Lenia |
| two-species | 2 | Competitive inhibition |
| predator-prey | 2 | Predator hunts prey |
| food-chain | 3 | Plants → Herbivores → Predators |
| symbiosis | 2 | Mutual benefit |
| creature-food | 2 | Creature consumes food |
| pheromone | 3 | Chemical trail signaling |

## Testing
```bash
bun run test           # Run all tests (Vitest)
bun run test:coverage  # Run with coverage report
```

**Test Coverage:** 460 tests, 30% coverage across:
- `src/__tests__/core/` - kernels, growth, conservation
- `src/__tests__/discovery/` - fitness, genome, GA, phylogeny
- `src/__tests__/agency/` - behavior, spatial-hash
- `src/__tests__/compute/` - texture-pool
- `src/__tests__/persistence/` - storage
- `src/__tests__/render/` - colormaps
- `src/__tests__/utils/` - RLE encoding

## Key APIs

### Mass Conservation
```typescript
// Enable mass conservation with auto-normalization
engine.setConservationConfig({ enabled: true });

// Conservation pipeline (internal)
pipeline.computeAndNormalize(device, stateTexture, outputTexture);
pipeline.setTargetMass(mass);  // Lock target mass
pipeline.getCachedMass();      // Non-blocking mass read
```

### Symmetry Detection
```typescript
import { calculateSymmetry } from './discovery/fitness';
// Returns 0-1 score: 30% horizontal + 30% vertical + 40% rotational
const score = calculateSymmetry(state, width, height);
```

### GPU Trainer Error Handling
```typescript
trainer.onError((error, state) => {
  console.log(`Step ${error.step}: ${error.message}`);
  console.log(`Consecutive errors: ${state.consecutiveErrors}`);
});
trainer.clearErrors();  // Reset error count to resume
// Training auto-stops after 3 consecutive errors
```

### Performance Optimizations (Phase 2)
```typescript
// KD-Tree for novelty search (O(n²) → O(n log n))
import { BehaviorKDTree, createBehaviorIndex } from './discovery/spatial-index';
const kdTree = createBehaviorIndex(individuals);
const novelty = kdTree.noveltyScore(behavior, k);

// Texture pool to reduce GPU memory churn
import { createTexturePool } from './compute/webgpu/texture-pool';
const pool = createTexturePool(device, { staleFrames: 300, maxPerKey: 4 });
const texture = pool.acquire(256, 256, 'r32float', usage);
pool.release(texture);
pool.cleanup();  // Remove stale textures

// Spatial hash for creature tracking (O(n) → O(1) average)
import { createSpatialHash } from './agency/spatial-hash';
const hash = createSpatialHash(worldWidth, worldHeight, cellSize);
hash.insert(creature);
const nearby = hash.queryRadius(x, y, radius);
const nearest = hash.findNearest(x, y);
```

## Known Limitations
- **Sensorimotor obstacles**: Visual rendering subtle, may not be clearly visible
- **WebGPU types**: Show compile errors but work at runtime
- **FFT threshold**: kernelRadius >= 16 triggers FFT mode

## Commands
```bash
bun run dev           # Dev server (usually :5173)
bun run build         # Production build
bun run lint          # ESLint
bun run test          # Run tests
bun run test:coverage # Coverage report
```

## Keyboard
- `Space` - Toggle simulation
- `S` - Step once
- `R` - Reset
