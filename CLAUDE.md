# GENESIS - Cellular Automata Platform

WebGPU-powered artificial life simulation platform.

## Quick Start

```bash
bun install && bun run dev
```

## Stack

React 19, TypeScript, Tailwind, Zustand | WebGPU + WGSL | Vite + Bun

## Directory Structure

```
src/
├── core/           # Engine, types, kernels, channels
├── compute/webgpu/ # GPU pipelines + shaders/
├── agency/         # Creature tracking, sensors
├── discovery/      # GA, fitness, novelty, phylogeny
├── training/       # Neural CA (GPU + CPU)
├── analysis/       # Symmetry, chaos, periodicity
├── persistence/    # Save/load organisms
├── ui/components/  # React panels
├── cli/            # CLI for testing & benchmarking
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

951 tests covering: core, discovery, agency, compute, analysis, persistence, render, cli

## Keyboard

- `Space` - Toggle simulation
- `S` - Step once
- `R` - Reset

## Skills (Detailed Docs)

Domain-specific documentation is in `.claude/skills/`:

| Skill        | Description                               |
| ------------ | ----------------------------------------- |
| `lenia-core` | Engine API, parameters, multi-species     |
| `analysis`   | Symmetry, chaos (Lyapunov), periodicity   |
| `discovery`  | GA, fitness, novelty search, replication  |
| `webgpu`     | GPU pipelines, texture pool, spatial hash |
| `3d-lenia`   | 3D engine and presets                     |
| `advanced`   | Particles, bioelectric, flow-lenia        |
| `cli`        | CLI commands, CPU testing                 |

## Known Limitations

- Sensorimotor obstacles: Visual rendering subtle
- WebGPU types: Show compile errors but work at runtime
