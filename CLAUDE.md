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
│   └── common/     # Shared UI components
└── patterns/       # Lenia presets
```

## Core Files

| File                                       | Purpose                                         |
| ------------------------------------------ | ----------------------------------------------- |
| `core/engine.ts`                           | Main orchestrator - GPU, sim loop, all features |
| `core/engine-3d.ts`                        | 3D Lenia engine - volumetric simulation         |
| `core/channels.ts`                         | Multi-species preset configs                    |
| `compute/webgpu/continuous-pipeline.ts`    | Lenia convolution + FFT                         |
| `compute/webgpu/lenia-3d-pipeline.ts`      | 3D Lenia GPU pipeline                           |
| `compute/webgpu/multi-channel-pipeline.ts` | Multi-species ecology                           |
| `discovery/genetic-algorithm.ts`           | GA + novelty search                             |
| `training/gpu-trainer.ts`                  | Neural CA training                              |
| `persistence/storage.ts`                   | LocalStorage save/load                          |

## Key Parameters

### Lenia (Stable)

```typescript
kernelRadius: 13;
growthCenter: 0.12; // μ - center of growth function
growthWidth: 0.04; // σ - width (NOT 0.015, too narrow)
dt: 0.1;
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

| Preset        | Species | Dynamics                        |
| ------------- | ------- | ------------------------------- |
| single        | 1       | Standard Lenia                  |
| two-species   | 2       | Competitive inhibition          |
| predator-prey | 2       | Predator hunts prey             |
| food-chain    | 3       | Plants → Herbivores → Predators |
| symbiosis     | 2       | Mutual benefit                  |
| creature-food | 2       | Creature consumes food          |
| pheromone     | 3       | Chemical trail signaling        |

## Testing

```bash
bun run test           # Run all tests (Vitest)
bun run test:coverage  # Run with coverage report
```

**Test Coverage:** 727 tests, 30% coverage across:

- `src/__tests__/core/` - kernels, kernels-3d, growth, conservation, bioelectric, particles
- `src/__tests__/discovery/` - fitness, genome, GA, phylogeny, replication
- `src/__tests__/agency/` - behavior, spatial-hash
- `src/__tests__/compute/` - texture-pool, flow-lenia
- `src/__tests__/analysis/` - symmetry, chaos, periodicity
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
pipeline.setTargetMass(mass); // Lock target mass
pipeline.getCachedMass(); // Non-blocking mass read
```

### Symmetry Detection

```typescript
import { calculateSymmetry } from "./discovery/fitness";
// Returns 0-1 score: 30% horizontal + 30% vertical + 40% rotational
const score = calculateSymmetry(state, width, height);
```

### Advanced Symmetry Analysis

```typescript
import {
  analyzeSymmetry,
  quickSymmetryScore,
  detectSymmetryType,
  calculateKFoldSymmetry,
} from "./analysis/symmetry";

// Full symmetry analysis
const result = analyzeSymmetry(state, width, height, { maxOrder: 8 });
console.log(`Order: ${result.order}`); // Dominant k-fold (1-8)
console.log(`Strength: ${result.strength}`); // 0-1 strength
console.log(`Horizontal: ${result.horizontal}`);
console.log(`Vertical: ${result.vertical}`);
console.log(`Rotational180: ${result.rotational180}`);

// Quick symmetry score (faster, less detailed)
const score = quickSymmetryScore(state, width, height);

// Detect symmetry types
const types = detectSymmetryType(result);
// Returns: ['bilateral-horizontal', '4-fold-rotational', 'radial'] etc.
```

**Symmetry Types Detected:**

- `bilateral-horizontal` / `bilateral-vertical` - reflection symmetry
- `point-symmetric` - 180° rotational
- `k-fold-rotational` - k-fold rotational (2, 4, 6, 8...)
- `radial` - high-order circular symmetry
- `asymmetric` - no significant symmetry

### Lyapunov Exponent (Chaos Analysis)

```typescript
import {
  calculateLyapunovExponent,
  wolfLyapunovEstimate,
  quickStabilityCheck,
  classifyDynamics,
} from "./analysis/chaos";

// Define step function for your CA
const stepFunction = (state: Float32Array) => {
  /* evolve state */
};

// Full Lyapunov calculation
const result = calculateLyapunovExponent(initialState, stepFunction, {
  steps: 100,
  perturbationMagnitude: 0.001,
  renormalize: true,
});
console.log(`Exponent: ${result.exponent}`);
console.log(`Classification: ${result.classification}`); // stable/periodic/chaotic/hyperchaotic
console.log(`Confidence: ${result.confidence}`);

// Wolf algorithm (more robust for noisy systems)
const wolfResult = wolfLyapunovEstimate(initialState, stepFunction);

// Quick stability check (fast but less accurate)
const stability = quickStabilityCheck(initialState, stepFunction, 20);
// Returns: 'stable' | 'unstable' | 'unknown'
```

**Lyapunov Classification:**

- `λ < -0.01` → **stable** (perturbations decay)
- `|λ| ≤ 0.01` → **periodic** (marginally stable)
- `λ > 0.01` → **chaotic** (perturbations grow)
- `λ > 1` → **hyperchaotic** (rapid divergence)

### Period Detection

```typescript
import {
  detectPeriod,
  PeriodTracker,
  classifyPeriodBehavior,
} from "./analysis/periodicity";

// Detect period from state history
const result = detectPeriod(stateHistory, width, height, {
  maxPeriod: 100,
  correlationThreshold: 0.8,
});
console.log(`Period: ${result.period}`);
console.log(`Exact: ${result.isExactPeriod}`);
console.log(`Behavior: ${result.behavior}`); // static/periodic/quasi-periodic/chaotic
console.log(classifyPeriodBehavior(result));

// Incremental tracking (for real-time detection)
const tracker = new PeriodTracker(width, height, { maxPeriod: 50 });
// In simulation loop:
tracker.push(currentState);
const analysis = tracker.analyze();
```

**Period Behaviors:**

- `static` - Fixed point (no change)
- `periodic` - Exact or approximate cycle
- `quasi-periodic` - Multiple incommensurate frequencies
- `chaotic` - No detectable period

### Bioelectric Patterns

```typescript
import {
  createBioelectricState,
  applyStimulus,
  stepBioelectric,
  stepBioelectricN,
  createVoltageWave,
  createGradient,
  bioelectricToRGB,
  BIOELECTRIC_PRESETS,
} from "./core/bioelectric";

// Create bioelectric simulation
const state = createBioelectricState({
  width: 256,
  height: 256,
  ...BIOELECTRIC_PRESETS["voltage-calcium"],
});

// Apply stimulus
applyStimulus(state, 0, 128, 128, 20, 0.5);

// Create patterns
createVoltageWave(state, 0, "radial", 30, 0.3);
createGradient(state, 1, "left-right", 0, 1);

// Step simulation
stepBioelectricN(state, 100);

// Render to RGB
const rgba = bioelectricToRGB(state, true);
```

**Bioelectric Presets:**

- `voltage-only` - Simple membrane potential
- `voltage-calcium` - Vm + Ca2+ signaling
- `ion-channels` - Vm + Na+ + K+ full model
- `morphogen-gradient` - Diffusible signaling molecules
- `turing-pattern` - Activator-inhibitor reaction-diffusion

### GPU Trainer Error Handling

```typescript
trainer.onError((error, state) => {
  console.log(`Step ${error.step}: ${error.message}`);
  console.log(`Consecutive errors: ${state.consecutiveErrors}`);
});
trainer.clearErrors(); // Reset error count to resume
// Training auto-stops after 3 consecutive errors
```

### Performance Optimizations (Phase 2)

```typescript
// KD-Tree for novelty search (O(n²) → O(n log n))
import { BehaviorKDTree, createBehaviorIndex } from "./discovery/spatial-index";
const kdTree = createBehaviorIndex(individuals);
const novelty = kdTree.noveltyScore(behavior, k);

// Texture pool to reduce GPU memory churn
import { createTexturePool } from "./compute/webgpu/texture-pool";
const pool = createTexturePool(device, { staleFrames: 300, maxPerKey: 4 });
const texture = pool.acquire(256, 256, "r32float", usage);
pool.release(texture);
pool.cleanup(); // Remove stale textures

// Spatial hash for creature tracking (O(n) → O(1) average)
import { createSpatialHash } from "./agency/spatial-hash";
const hash = createSpatialHash(worldWidth, worldHeight, cellSize);
hash.insert(creature);
const nearby = hash.queryRadius(x, y, radius);
const nearest = hash.findNearest(x, y);
```

### Shared UI Components

```typescript
import { ExpandablePanel, ToggleButton, RangeSlider, StatGrid } from './ui/components/common';

// Collapsible panel with header
<ExpandablePanel title="Settings" titleColor="text-cyan-400" defaultExpanded={false}>
  {children}
</ExpandablePanel>

// ON/OFF toggle
<ToggleButton label="Enable Feature" value={enabled} onChange={setEnabled} activeColor="bg-cyan-600" />

// Labeled range slider
<RangeSlider label="Value" value={0.5} min={0} max={1} step={0.01} onChange={setValue} />

// Grid of statistics
<StatGrid stats={[{ label: 'Count', value: 42 }, { label: 'Score', value: '85%' }]} columns={2} />
```

### 3D Lenia (Phase 3)

```typescript
// Create 3D engine
import { createEngine3D } from "./core/engine-3d";
const engine3D = await createEngine3D({ canvas });

// Control simulation
engine3D.start() / stop() / stepOnce();
engine3D.loadPreset("stable-sphere"); // Load organism preset
engine3D.setSlicePlane("xy" | "xz" | "yz"); // View slice plane
engine3D.setSlicePosition(32); // Slice position along axis
engine3D.setColormap("viridis"); // Set colormap

// Get state
const state = await engine3D.getState(); // Full 3D state (Float32Array)
const slice = await engine3D.getSlice("xy", 32); // 2D slice
```

**3D Presets:** orbium-3d, stable-sphere, ellipsoid-glider, dual-orbium, torus-3d, dual-ring-blob, primordial-soup-3d, small-orbium

**3D Grid Sizes:** 32³ (small), 64³ (default), 128³ (large)

**3D Types:**

```typescript
import type {
  Grid3DConfig,
  Lenia3DParams,
  Kernel3DConfig,
  SlicePlane,
} from "./core/types-3d";
```

### Particle-Lenia Hybrid

```typescript
import {
  createParticleSystem,
  addParticle,
  spawnRandomParticles,
  updateParticleSystem,
  depositToField,
  calculateFieldGradient,
  INTERACTION_PRESETS,
} from "./core/particles";

// Create particle system
const state = createParticleSystem({
  maxParticles: 500,
  numTypes: 3,
  gridWidth: 512,
  gridHeight: 512,
});

// Spawn particles
spawnRandomParticles(state, 100, { spread: 50 });

// Set interaction preset
state.interactionMatrix = INTERACTION_PRESETS.clustering(3);

// Physics step
updateParticleSystem(state, fieldGradient);

// Deposit particles to Lenia field
depositToField(state, field);

// GPU Pipeline (for performance)
import { createParticlePipeline } from "./compute/webgpu/particle-pipeline";
const pipeline = createParticlePipeline(device, config);
pipeline.setParticles(particles);
pipeline.step(commandEncoder);
```

**Interaction Presets:** attractive, clustering, chain, random

**Field Coupling:**

- `depositEnabled`: Particles add mass to Lenia field
- `gradientResponseEnabled`: Particles respond to field gradients

### Self-Replication Detection

```typescript
import {
  createReplicationDetector,
  findConnectedComponents,
  calculateReplicationFitness,
} from "./discovery/replication";

// Create detector
const detector = createReplicationDetector(width, height, {
  minMass: 10,
  activationThreshold: 0.1,
  minSimilarity: 0.6,
});

// Process each frame
const events = detector.update(stateArray, stepNumber);

// Check for replication events
for (const event of events) {
  console.log(`Replication at step ${event.step}`);
  console.log(`Similarity: ${event.similarity}`);
}

// Use in fitness evaluation
const replicationFitness = calculateReplicationFitness(detector.getEvents());
```

**Fitness Metrics:** survival, stability, complexity, symmetry, movement, replication

### Flow-Lenia (Mass-Conserving)

```typescript
import {
  createFlowLeniaPipeline,
  type FlowLeniaConfig,
} from "./compute/webgpu/flow-lenia-pipeline";

// Create flow pipeline
const flowPipeline = createFlowLeniaPipeline(device, {
  flowStrength: 0.5, // How much growth gradient affects flow
  diffusion: 0.01, // Smoothing coefficient
  useReintegration: true, // Better mass conservation
  growthType: 1, // 0=polynomial, 1=gaussian
});

// Execute step (requires external convolution result)
flowPipeline.step(commandEncoder, convolutionTexture);

// Verify mass conservation
const currentMass = await flowPipeline.getMass();
```

**Flow Modes:** main (advection), flow_reintegration (explicit flux tracking)

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
