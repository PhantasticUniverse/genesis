---
name: cli
description: CLI commands for testing, benchmarking, and evolution without WebGPU. Use when running headless tests, CPU-only simulation, or batch processing.
---

# CLI Tool

The CLI runs tests and benchmarks without browser/WebGPU dependencies.

## Quick Start

```bash
bun run cli --help                    # Show all commands
bun run cli analyze --help            # Analysis commands
bun run cli bench --help              # Benchmark commands
bun run cli evolve --help             # Evolution commands
bun run cli evaluate --help           # Fitness evaluation
bun run cli sweep --help              # Parameter sweep
```

## Analysis Commands

```bash
# Symmetry analysis
bun run cli analyze symmetry --random --size 128

# Chaos (Lyapunov exponent)
bun run cli analyze chaos --steps 50 --perturbation 0.001

# Period detection
bun run cli analyze period --steps 200

# Full analysis (all metrics)
bun run cli analyze full --steps 100 --size 64
```

## Evolution Commands

```bash
# Quick test evolution
bun run cli evolve test

# Full GA evolution
bun run cli evolve run --population 50 --generations 50 --output results.json

# Resume from results
bun run cli evolve resume -i results.json --generations 20
```

## Benchmark Commands

```bash
# KD-tree novelty search scaling
bun run cli bench kdtree --sizes 100,500,1000,5000

# Symmetry analysis at different resolutions
bun run cli bench symmetry --sizes 64,128,256

# Fitness evaluation throughput
bun run cli bench fitness --population 100

# CPU Lenia step performance
bun run cli bench cpu-step --sizes 64,128,256

# Run all benchmarks
bun run cli bench all
```

## Evaluation Commands

```bash
# Evaluate a genome from encoded string
bun run cli evaluate genome -g "MjB8NXwwLjI1Myw..."

# Evaluate genome from file
bun run cli evaluate genome -i genome.json --steps 100

# Batch evaluation
bun run cli evaluate batch -n 20 --size 64

# Compare two genomes
bun run cli evaluate compare -a "genome1..." -b "genome2..."
```

## Parameter Sweep Commands

```bash
# Run parameter sweep from config
bun run cli sweep run --config sweep_config.json --parallel 4 -o results/

# Validate sweep config
bun run cli sweep validate --config sweep_config.json

# Analyze sweep results
bun run cli sweep analyze -i results/

# Generate sample config
bun run cli sweep generate-config -o sweep_config.json
```

### Sweep Config Format

```json
{
  "command": "evolve run",
  "parameters": {
    "population": { "values": [20, 50, 100] },
    "mutation_rate": { "min": 0.01, "max": 0.2, "steps": 5 },
    "novelty_weight": { "values": [0.0, 0.3, 0.5, 1.0] }
  },
  "repeats": 5,
  "metrics": ["best_fitness", "coverage", "generations_to_converge"]
}
```

## CPU Lenia (No WebGPU)

Pure CPU implementation for testing:

```typescript
import {
  createCPULenia,
  initializeBlob,
  step,
  getState,
} from "./cli/utils/cpu-step";

const ctx = createCPULenia({
  width: 64,
  height: 64,
  kernelRadius: 13,
  growthCenter: 0.12,
  growthWidth: 0.04,
  dt: 0.1,
});

initializeBlob(ctx, 10, 0.8);
for (let i = 0; i < 100; i++) step(ctx);
const finalState = getState(ctx);
```

### CPU Lenia API

```typescript
interface CPULeniaConfig {
  width: number;
  height: number;
  kernelRadius: number;
  growthCenter: number; // μ
  growthWidth: number; // σ
  dt: number;
}

// Create context
const ctx = createCPULenia(config);

// Initialize with blob
initializeBlob(ctx, radius, intensity);

// Step simulation
step(ctx);

// Get current state
const state: Float32Array = getState(ctx);

// Set state
setState(ctx, newState);
```

## Directory Structure

```
src/cli/
├── index.ts              # CLI entry point
├── commands/
│   ├── analyze.ts        # Analysis commands
│   ├── bench.ts          # Benchmark commands
│   ├── evolve.ts         # Evolution commands
│   ├── evaluate.ts       # Fitness evaluation
│   └── sweep.ts          # Parameter sweep
├── sweep-executor.ts     # Sweep execution engine
├── experiment-tracker.ts # Experiment manifest tracking
└── utils/
    ├── cpu-step.ts       # CPU Lenia implementation
    └── reporters.ts      # Output formatting
```

## Core Files

| File                        | Purpose                     |
| --------------------------- | --------------------------- |
| `cli/index.ts`              | CLI entry point             |
| `cli/commands/*.ts`         | Command implementations     |
| `cli/sweep-executor.ts`     | Parameter sweep engine      |
| `cli/experiment-tracker.ts` | Experiment manifest/logging |
| `cli/utils/cpu-step.ts`     | CPU Lenia (no WebGPU)       |
| `cli/utils/reporters.ts`    | Output formatting utilities |
