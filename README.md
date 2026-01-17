# GENESIS

**Artificial Life Observatory**

A next-generation cellular automata platform powered by WebGPU, featuring a bioluminescent scientific interface for exploring digital life.

## Features

- **Discrete CA** - Game of Life and 18 life-like rules (B/S notation)
- **Continuous CA** - Lenia and SmoothLife with smooth dynamics
- **Multi-Species Ecology** - Up to 4 interacting species with predator-prey, symbiosis, and chemical signaling
- **Pattern Discovery** - Genetic algorithm with novelty search, phylogenetic tree tracking, and real-time fitness history visualization
- **Sensorimotor Agency** - Creature tracking with obstacle avoidance and target navigation
- **Neural CA Training** - GPU-accelerated IMGEP curriculum learning
- **Mass Conservation** - Real-time mass tracking via GPU parallel reduction
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
- Google Fonts (Orbitron, Inter, JetBrains Mono)
- Vite + Bun

## License

MIT
