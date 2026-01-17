# GENESIS - Cellular Automata Platform

WebGPU-powered artificial life simulation platform optimized for both human and AI researchers.

## Quick Start

```bash
bun install && bun run dev
```

## Stack

React 19, TypeScript, Tailwind, Zustand | WebGPU + WGSL | Vite + Bun

## Directory Structure

```
src/
├── core/           # Engine, types, kernels, random (seeded RNG)
├── compute/webgpu/ # GPU pipelines + shaders/
├── agency/         # Creature tracking (Hungarian algorithm), sensors
├── discovery/      # GA, fitness, novelty, MAP-Elites, phylogeny
├── training/       # Neural CA (GPU + CPU)
├── analysis/       # Symmetry, chaos, periodicity, statistics
├── persistence/    # Save/load organisms
├── ui/components/  # React panels + ErrorBoundary
├── cli/            # CLI + parameter sweep
├── mcp/            # MCP server for AI interaction
└── patterns/       # Lenia presets
```

## Key Parameters (Stable Lenia)

```typescript
kernelRadius: 13;
growthCenter: 0.12; // μ
growthWidth: 0.04; // σ (NOT 0.015)
dt: 0.1;
```

FFT auto-activates when `kernelRadius >= 16`.

## Engine Quick Ref

```typescript
engine.start() / stop() / reset(pattern)
engine.setParadigm('discrete' | 'continuous')
engine.enableMultiChannel(config) / disableMultiChannel()
engine.enableMultiKernel(config) / disableMultiKernel()
engine.getMass(): Promise<number>
engine.setBoundaryMode('periodic' | 'clamped' | 'reflected' | 'zero')
```

## Seeded RNG

```typescript
import { setSeed, random, randomInt, randomFloat, randomBool } from './core/random';

setSeed(12345);           // Set global seed for reproducibility
random();                 // 0-1 float
randomInt(min, max);      // Integer in [min, max]
randomFloat(min, max);    // Float in [min, max]
randomBool(0.5);          // Boolean with probability
```

CLI commands support `--seed` for reproducible experiments:
```bash
bun run cli evolve run --seed 42 --generations 10
bun run cli multikernel evolve --seed 42 --generations 5
```

## Commands

```bash
bun run dev           # Dev server (:5173)
bun run build         # Production build
bun run lint          # ESLint
bun run test          # Run tests
bun run test:coverage # Coverage report
bun run cli           # CLI (no WebGPU required)
```

## Testing

1215 tests covering: core, discovery, agency, compute, analysis, persistence, render, cli, mcp

```bash
bun run test              # Run all tests
bun run test:coverage     # With coverage report
```

## Keyboard

- `Space` - Toggle simulation
- `S` - Step once
- `R` - Reset

## Skills (Detailed Docs)

Domain-specific documentation is in `.claude/skills/`:

| Skill        | Description                                    |
| ------------ | ---------------------------------------------- |
| `lenia-core` | Engine API, parameters, boundary modes         |
| `analysis`   | Symmetry, chaos, periodicity, statistics       |
| `discovery`  | GA, fitness, novelty, MAP-Elites, replication  |
| `webgpu`     | GPU pipelines, async readback, spatial hash    |
| `3d-lenia`   | 3D engine and presets                          |
| `advanced`   | Particles, bioelectric, flow-lenia             |
| `cli`        | CLI commands, parameter sweep, CPU testing     |

## MCP Server (AI Interaction)

```typescript
import { createGenesisMCPServer } from './mcp/server';
const server = createGenesisMCPServer();
// Tools: genesis_start_simulation, genesis_step, genesis_analyze_*, etc.
```

## Known Limitations

- Sensorimotor obstacles: Visual rendering subtle
- WebGPU types: Show compile errors but work at runtime
- WebGPU initialization: Times out after 5s if GPU unavailable (shows compatibility modal)
