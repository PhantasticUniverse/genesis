---
name: advanced
description: Particle-Lenia hybrid systems, bioelectric patterns, and Flow-Lenia mass-conserving dynamics. Use when implementing hybrid simulations, reaction-diffusion systems, or mass-conserving CA.
---

# Advanced Features

## Particle-Lenia Hybrid

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
```

### Interaction Presets

| Preset       | Behavior                         |
| ------------ | -------------------------------- |
| `attractive` | All types attract each other     |
| `clustering` | Same types attract, others repel |
| `chain`      | Sequential attraction (A→B→C→A)  |
| `random`     | Random interaction matrix        |

### Field Coupling

```typescript
// Particles add mass to Lenia field
depositToField(state, leniaField);

// Particles respond to field gradients
const gradient = calculateFieldGradient(leniaField, width, height);
updateParticleSystem(state, gradient);
```

### GPU Particle Pipeline

```typescript
import { createParticlePipeline } from "./compute/webgpu/particle-pipeline";

const pipeline = createParticlePipeline(device, {
  maxParticles: 1000,
  numTypes: 4,
});

pipeline.setParticles(particles);
pipeline.step(commandEncoder);
const positions = await pipeline.getPositions();
```

## Bioelectric Patterns

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

// Apply stimulus to channel 0
applyStimulus(state, 0, 128, 128, 20, 0.5);

// Create patterns
createVoltageWave(state, 0, "radial", 30, 0.3);
createGradient(state, 1, "left-right", 0, 1);

// Step simulation
stepBioelectricN(state, 100);

// Render to RGB
const rgba = bioelectricToRGB(state, true);
```

### Bioelectric Presets

| Preset               | Channels | Description                            |
| -------------------- | -------- | -------------------------------------- |
| `voltage-only`       | 1        | Simple membrane potential              |
| `voltage-calcium`    | 2        | Vm + Ca2+ signaling                    |
| `ion-channels`       | 3        | Vm + Na+ + K+ full model               |
| `morphogen-gradient` | 2        | Diffusible signaling molecules         |
| `turing-pattern`     | 2        | Activator-inhibitor reaction-diffusion |

## Flow-Lenia (Mass-Conserving)

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

### Flow Modes

| Mode                 | Description                                  |
| -------------------- | -------------------------------------------- |
| `main`               | Standard advection                           |
| `flow_reintegration` | Explicit flux tracking (better conservation) |

### Flow Parameters

```typescript
interface FlowLeniaConfig {
  flowStrength: number; // 0-1, gradient response strength
  diffusion: number; // 0-0.1, smoothing
  useReintegration: boolean; // Better mass tracking
  growthType: 0 | 1; // 0=polynomial, 1=gaussian
}
```

## Core Files

| File                                    | Purpose                        |
| --------------------------------------- | ------------------------------ |
| `core/particles.ts`                     | Particle system implementation |
| `core/bioelectric.ts`                   | Bioelectric simulation         |
| `compute/webgpu/particle-pipeline.ts`   | GPU particle physics           |
| `compute/webgpu/flow-lenia-pipeline.ts` | Mass-conserving flow           |
