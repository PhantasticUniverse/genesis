---
name: lenia-core
description: Core Lenia engine API, stable parameters, multi-species presets, and growth functions. Use when working on the simulation engine, configuring organisms, or debugging parameter issues.
---

# Lenia Core Engine

## Key Parameters (Stable Lenia)

```typescript
kernelRadius: 13;
growthCenter: 0.12; // μ - center of growth function
growthWidth: 0.04; // σ - width (NOT 0.015, too narrow)
dt: 0.1;
```

- Blob radius: 25 (not 15)
- FFT auto-activates when `kernelRadius >= 16`

## Engine API

```typescript
import { createEngine } from "./core/engine";

const engine = await createEngine({ canvas });

// Lifecycle
engine.start();
engine.stop();
engine.reset(pattern);
engine.stepOnce();

// Paradigm
engine.setParadigm("discrete" | "continuous");

// Multi-channel
engine.enableMultiChannel(config);
engine.disableMultiChannel();

// Sensorimotor
engine.enableSensorimotor();
engine.disableSensorimotor();

// Mass conservation
engine.setConservationConfig({ enabled: true });
engine.getMass(): Promise<number>;
```

## Multi-Species Presets

| Preset          | Species | Dynamics                        |
| --------------- | ------- | ------------------------------- |
| `single`        | 1       | Standard Lenia                  |
| `two-species`   | 2       | Competitive inhibition          |
| `predator-prey` | 2       | Predator hunts prey             |
| `food-chain`    | 3       | Plants → Herbivores → Predators |
| `symbiosis`     | 2       | Mutual benefit                  |
| `creature-food` | 2       | Creature consumes food          |
| `pheromone`     | 3       | Chemical trail signaling        |

### Loading Presets

```typescript
import { MULTI_SPECIES_PRESETS } from "./core/channels";

const config = MULTI_SPECIES_PRESETS["predator-prey"];
engine.enableMultiChannel(config);
```

## Mass Conservation

```typescript
// Enable mass conservation with auto-normalization
engine.setConservationConfig({ enabled: true });

// Conservation pipeline (internal)
pipeline.computeAndNormalize(device, stateTexture, outputTexture);
pipeline.setTargetMass(mass); // Lock target mass
pipeline.getCachedMass(); // Non-blocking mass read
```

## Core Files

| File               | Purpose                         |
| ------------------ | ------------------------------- |
| `core/engine.ts`   | Main orchestrator               |
| `core/channels.ts` | Multi-species preset configs    |
| `core/kernels.ts`  | Kernel generation functions     |
| `core/growth.ts`   | Growth function implementations |
| `core/types.ts`    | TypeScript type definitions     |
