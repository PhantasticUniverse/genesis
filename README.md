# GENESIS

**Generative Evolution & Neural Emergence System for Intelligent Simulation**

A next-generation cellular automata platform powered by WebGPU.

## Features

- **Discrete CA** - Game of Life and 18 life-like rules (B/S notation)
- **Continuous CA** - Lenia and SmoothLife with smooth dynamics
- **Multi-Species Ecology** - Up to 4 interacting species with predator-prey, symbiosis, and chemical signaling
- **Pattern Discovery** - Genetic algorithm with novelty search, phylogenetic tree tracking, and real-time fitness history visualization
- **Sensorimotor Agency** - Creature tracking with obstacle avoidance and target navigation
- **Neural CA Training** - GPU-accelerated IMGEP curriculum learning
- **Mass Conservation** - Real-time mass tracking via GPU parallel reduction
- **Organism Library** - Save, load, and export organisms to JSON

## Quick Start

```bash
bun install
bun run dev
```

Open http://localhost:5173 in a WebGPU-capable browser (Chrome, Edge, Firefox 121+, Safari 18+).

## Usage

1. Select **Mode**: Discrete (Game of Life) or Continuous (Lenia)
2. Choose a **Preset** and **Pattern**
3. Click **Start** to run the simulation
4. Enable **Multi-Species Ecology** to simulate interacting species
5. Enable **Sensorimotor Agency** to track creatures with obstacles/targets
6. Use **Pattern Discovery** to evolve new organisms
7. **Save** interesting organisms to the library

## Keyboard Shortcuts

- `Space` - Toggle simulation
- `S` - Step once
- `R` - Reset

## CLI Tools

Run experiments without WebGPU using the CLI:

```bash
# Evolve organisms
bun run cli evolve run --generations 20 --seed 42

# Multi-kernel evolution (higher fitness)
bun run cli multikernel evolve --generations 10 --seed 42

# Analyze organism behavior
bun run cli analyze full --random --seed 42

# Parameter sweeps
bun run cli sweep run --config sweep.json
```

## Tech Stack

- React 19 + TypeScript + Tailwind CSS + Zustand
- WebGPU compute shaders (WGSL)
- Vite + Bun

## License

MIT
