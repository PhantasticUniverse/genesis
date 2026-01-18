# GENESIS

**Artificial Life Observatory**

A next-generation cellular automata platform powered by WebGPU, featuring a bioluminescent scientific interface for exploring digital life.

## Features

### Simulation Modes
- **Discrete CA** - Game of Life and 18 life-like rules (B/S notation)
- **Continuous CA** - Lenia and SmoothLife with smooth dynamics
- **Multi-Kernel Lenia** - 1-4 weighted kernels with composite growth functions
- **Ecosystem Simulation** - Lotka-Volterra predator-prey dynamics, food chains, mutualism

### Discovery & Evolution
- **Pattern Discovery** - Genetic algorithm with novelty search and MAP-Elites
- **Phylogenetic Tracking** - Full genealogy trees with lineage visualization
- **Preset Registry** - 20+ builtin presets across all modes with import/export

### Analysis Tools
- **Real-Time Analysis** - Symmetry gauge, chaos meter, mass sparkline, behavior radar
- **Mass Conservation** - GPU parallel reduction for accurate mass tracking
- **Creature Tracking** - Hungarian algorithm matching for organism identification

### Research Infrastructure
- **Experiment Database** - IndexedDB tracking with runs, snapshots, genealogy
- **Adaptive Quality** - Auto-adjusts grid size (128-4096) based on performance
- **CLI Tools** - Full feature parity for automation and batch processing
- **MCP Server** - AI interaction via Model Context Protocol

### Agency & Training
- **Sensorimotor Agency** - Creature tracking with obstacle avoidance and target navigation
- **Neural CA Training** - GPU-accelerated IMGEP curriculum learning
- **Organism Library** - Save, load, and export organisms to JSON

## UI Design: Bioluminescent Observatory

The interface is designed as a "Bioluminescent Observatory" - a window into digital life that feels like peering through a scientific instrument into another world.

### Visual Aesthetic

- **Cosmic Blacks** - Deep space backgrounds create infinite depth
- **Bioluminescent Accents** - Cyan, magenta, amber, and green emerge like life from darkness
- **Glass Morphism** - Panels feel like holographic scientific displays
- **Observatory Portal** - Canvas wrapped with decorative corner brackets and breathing glow effects
- **Organic Animations** - Micro-animations give the UI a sense of living presence

### Typography

- **Orbitron** - Display font for titles (futuristic, scientific)
- **Inter** - Body font for UI labels (highly legible)
- **JetBrains Mono** - Monospace for data values and parameters

### Color System

```css
/* Cosmic Blacks */
--genesis-void: #030306;
--genesis-abyss: #0a0a12;
--genesis-depth: #12121c;

/* Bioluminescent Accents */
--bio-cyan: #00f5ff;
--bio-magenta: #ff00ff;
--bio-amber: #ffaa00;
--bio-green: #00ff88;
```

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

# Multi-kernel evolution
bun run cli multikernel evolve --generations 10 --seed 42

# Analyze organism behavior
bun run cli analyze full --random --seed 42

# Parameter sweeps
bun run cli sweep run --config sweep.json

# Preset management
bun run cli preset list --mode continuous
bun run cli preset info lenia-orbium
bun run cli preset export --output my-presets.gpreset

# Experiment tracking
bun run cli experiment create "my-research" --paradigm continuous
bun run cli experiment list
bun run cli experiment export <id>
```

## Tech Stack

- React 19 + TypeScript + Tailwind CSS + Zustand
- WebGPU compute shaders (WGSL)
- Google Fonts (Orbitron, Inter, JetBrains Mono)
- Vite + Bun

## License

MIT
