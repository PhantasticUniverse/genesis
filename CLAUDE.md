# GENESIS - Artificial Life Observatory

WebGPU-powered artificial life simulation platform with a bioluminescent scientific interface.

## Quick Start

```bash
bun install && bun run dev
```

## Stack

React 19, TypeScript, Tailwind CSS, Zustand | WebGPU + WGSL | Vite + Bun

**UI Theme:** Bioluminescent Observatory with Orbitron, Inter, JetBrains Mono fonts

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
├── ui/components/  # React panels (Bioluminescent theme)
├── cli/            # CLI + parameter sweep
├── mcp/            # MCP server for AI interaction
└── patterns/       # Lenia presets
```

## UI Architecture

### Theme System (src/index.css)

CSS custom properties define the bioluminescent color system:

```css
/* Cosmic Blacks */
--genesis-void: #030306;      /* Deepest background */
--genesis-abyss: #0a0a12;     /* Main background */
--genesis-depth: #12121c;     /* Panel backgrounds */
--genesis-surface: #1a1a28;   /* Elevated surfaces */

/* Bioluminescent Accents */
--bio-cyan: #00f5ff;          /* Primary accent */
--bio-magenta: #ff00ff;       /* Discovery/evolution */
--bio-amber: #ffaa00;         /* Warnings, CPU mode */
--bio-green: #00ff88;         /* Running state */
```

### Key UI Components

| Component | File | Purpose |
|-----------|------|---------|
| `Canvas` | `Canvas.tsx` | Observatory Portal with corner brackets, breathing glow |
| `ExpandablePanel` | `common/ExpandablePanel.tsx` | Glass morphism collapsible panels |
| `Controls` | `Controls.tsx` | Playback buttons with glow effects |
| `PerformanceMonitor` | `PerformanceMonitor.tsx` | HUD-style floating FPS display |
| `RangeSlider` | `common/RangeSlider.tsx` | Custom slider with gradient fill |
| `StatGrid` | `common/StatGrid.tsx` | Stat cards with glass styling |

### CSS Utility Classes

```css
.glass-panel      /* Backdrop blur + border */
.btn-glow         /* Button with hover glow */
.btn-start        /* Green gradient start button */
.btn-stop         /* Red gradient stop button */
.genesis-select   /* Styled dropdown with cyan accent */
.genesis-slider   /* Custom range input */
.stat-card        /* Individual stat display */
.observatory-portal  /* Canvas wrapper with effects */
.status-dot       /* Pulsing status indicator */
```

### Animation Keyframes

- `fadeInUp` - Page element entrance
- `breathingGlow` - Running state canvas glow
- `portalPulse` - Idle portal border animation
- `gradientShift` - Title gradient movement
- `letterReveal` - Staggered title animation

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
import { setSeed, random, randomInt, randomFloat, randomBool } from "./core/random";

setSeed(12345); // Set global seed for reproducibility
random();       // 0-1 float
randomInt(min, max);    // Integer in [min, max]
randomFloat(min, max);  // Float in [min, max]
randomBool(0.5);        // Boolean with probability
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

| Skill        | Description                                   |
| ------------ | --------------------------------------------- |
| `lenia-core` | Engine API, parameters, boundary modes        |
| `analysis`   | Symmetry, chaos, periodicity, statistics      |
| `discovery`  | GA, fitness, novelty, MAP-Elites, replication |
| `webgpu`     | GPU pipelines, async readback, spatial hash   |
| `3d-lenia`   | 3D engine and presets                         |
| `advanced`   | Particles, bioelectric, flow-lenia            |
| `cli`        | CLI commands, parameter sweep, CPU testing    |

## MCP Server (AI Interaction)

```typescript
import { createGenesisMCPServer } from "./mcp/server";
const server = createGenesisMCPServer();
// Tools: genesis_start_simulation, genesis_step, genesis_analyze_*, etc.
```

## Known Limitations

- Sensorimotor obstacles: Visual rendering subtle
- WebGPU types: Show compile errors but work at runtime
- WebGPU initialization: Times out after 5s if GPU unavailable (shows compatibility modal)
