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
├── core/                    # Engine, types, kernels, random (seeded RNG)
│   └── engine/              # State machine engine architecture
│       ├── engine-state.ts  # Engine state machine definition
│       ├── engine-context.ts# Shared GPU resources
│       ├── engine-v2.ts     # Slim coordinator (~350 lines)
│       └── modes/           # Pluggable simulation modes
├── compute/webgpu/          # GPU pipelines + shaders/
│   └── shaders/             # WGSL compute shaders
│       └── resource-diffusion.wgsl # Ecology resource dynamics
├── agency/                  # Creature tracking (Hungarian algorithm), sensors
├── discovery/               # GA, fitness, novelty, MAP-Elites, phylogeny
├── training/                # Neural CA (GPU + CPU)
├── analysis/                # Symmetry, chaos, periodicity, statistics
├── ecology/                 # Multi-species ecosystem simulation
│   ├── types.ts             # Species, interactions, ecosystem config
│   ├── lotka-volterra.ts    # Population dynamics (RK4 integration)
│   ├── population-tracker.ts# Time series, phase space, health metrics
│   └── ecosystem-presets.ts # Predator-prey, food chain, mutualism
├── persistence/             # Save/load organisms + experiments
│   └── experiment-db.ts     # IndexedDB experiment tracking
├── patterns/                # Lenia presets
│   └── registry/            # Unified preset system
│       ├── preset-types.ts  # Type definitions for all modes
│       ├── preset-registry.ts# Central registry management
│       ├── encoding.ts      # RLE, Base64, pattern generators
│       ├── builtin-presets.ts# 28+ builtin presets
│       └── sensorimotor-presets.ts # Agency-enabled presets
├── ui/
│   ├── components/          # React panels (Bioluminescent theme)
│   └── stores/              # Zustand state management
│       ├── preset-store.ts  # Preset browser state
│       └── quality-store.ts # Adaptive quality settings
├── cli/                     # CLI + parameter sweep
│   └── commands/            # Command implementations
│       ├── preset.ts        # Preset management CLI
│       └── experiment.ts    # Experiment tracking CLI
└── mcp/                     # MCP server for AI interaction
```

## UI Architecture

### Theme System (src/index.css)

CSS custom properties define the bioluminescent color system:

```css
/* Cosmic Blacks */
--genesis-void: #030306; /* Deepest background */
--genesis-abyss: #0a0a12; /* Main background */
--genesis-depth: #12121c; /* Panel backgrounds */
--genesis-surface: #1a1a28; /* Elevated surfaces */

/* Bioluminescent Accents */
--bio-cyan: #00f5ff; /* Primary accent */
--bio-magenta: #ff00ff; /* Discovery/evolution */
--bio-amber: #ffaa00; /* Warnings, CPU mode */
--bio-green: #00ff88; /* Running state */
```

### Key UI Components

| Component                 | File                          | Purpose                                                 |
| ------------------------- | ----------------------------- | ------------------------------------------------------- |
| `Canvas`                  | `Canvas.tsx`                  | Observatory Portal with corner brackets, breathing glow |
| `ExpandablePanel`         | `common/ExpandablePanel.tsx`  | Glass morphism collapsible panels                       |
| `Controls`                | `Controls.tsx`                | Playback buttons with glow effects                      |
| `PerformanceMonitor`      | `PerformanceMonitor.tsx`      | HUD-style floating FPS display                          |
| `RangeSlider`             | `common/RangeSlider.tsx`      | Custom slider with gradient fill                        |
| `StatGrid`                | `common/StatGrid.tsx`         | Stat cards with glass styling                           |
| `LeniaParameterPanel`     | `LeniaParameterPanel.tsx`     | Full Lenia parameter controls with kernel/growth viz    |
| `PresetBrowser`           | `PresetBrowser.tsx`           | Unified preset browser with search/filter/favorites     |
| `AdvancedSettingsPanel`   | `AdvancedSettingsPanel.tsx`   | Grid size, quality, RNG seed, precision controls        |
| `RealTimeAnalysisPanel`   | `RealTimeAnalysisPanel.tsx`   | HUD analysis: symmetry gauge, chaos meter, mass chart   |
| `PopulationDynamicsPanel` | `PopulationDynamicsPanel.tsx` | Ecology time series, phase space, ecosystem health      |

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

## Grid Size & Quality

Configurable grid sizes with adaptive quality:

```typescript
// Quality presets
type QualityLevel = "performance" | "balanced" | "quality" | "ultra";

// Grid size options
const GRID_SIZES = [128, 256, 512, 1024, 2048, 4096];

// Quality store
import { useQualityStore } from "./ui/stores/quality-store";
const { currentLevel, setQualityLevel, autoQuality } = useQualityStore();
```

| Quality     | Grid | Target FPS | Use Case               |
| ----------- | ---- | ---------- | ---------------------- |
| Performance | 256  | 60         | Mobile, weak GPU       |
| Balanced    | 512  | 60         | Default                |
| Quality     | 1024 | 30         | High-res visualization |
| Ultra       | 2048 | 30         | Research, screenshots  |

## Engine Quick Ref

```typescript
engine.start() / stop() / reset(pattern)
engine.setParadigm('discrete' | 'continuous')
engine.enableMultiChannel(config) / disableMultiChannel()
engine.enableMultiKernel(config) / disableMultiKernel()
engine.getMass(): Promise<number>
engine.setBoundaryMode('periodic' | 'clamped' | 'reflected' | 'zero')

// Sensorimotor mode (agency)
engine.enableSensorimotor() / disableSensorimotor()
engine.setSensorimotorParams(params) / getSensorimotorParams()
engine.setObstacles(pattern) / clearObstacles()
engine.setTargetGradient(x, y, radius?, strength?)
engine.addObstacleRect(x, y, width, height)
```

## Seeded RNG

```typescript
import {
  setSeed,
  random,
  randomInt,
  randomFloat,
  randomBool,
} from "./core/random";

setSeed(12345); // Set global seed for reproducibility
random(); // 0-1 float
randomInt(min, max); // Integer in [min, max]
randomFloat(min, max); // Float in [min, max]
randomBool(0.5); // Boolean with probability
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

## CLI Commands

```bash
# Analysis
genesis analyze <file>           # Analyze organism state
genesis analyze --symmetry       # Symmetry analysis
genesis analyze --chaos          # Lyapunov exponent

# Evolution
genesis evolve --generations 100 --population 30
genesis evolve --fitness survival,complexity

# Parameter Sweep
genesis sweep --param mu --range 0.05,0.4 --steps 20

# Benchmarking
genesis bench --grid 512 --steps 1000

# Presets
genesis preset list              # List all presets
genesis preset list --mode continuous
genesis preset info <name>       # Show preset details
genesis preset export --output presets.gpreset
genesis preset import <file>     # Import preset file
genesis preset validate <file>   # Validate preset file
genesis preset stats             # Registry statistics

# Experiments
genesis experiment create <name> # Create experiment
genesis experiment list          # List experiments
genesis experiment info <id>     # Show experiment details
genesis experiment export <id>   # Export experiment data
genesis experiment delete <id>   # Delete experiment
genesis experiment status <id> <status>
genesis experiment clear         # Clear all experiments
genesis experiment export-all    # Export all data

# Multi-kernel
genesis multikernel --kernels 2 --preset dual-orbium
```

## Testing

1239 tests covering: core, discovery, agency, compute, analysis, persistence, render, cli, mcp

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

## Preset Registry

Unified preset system for all simulation modes:

```typescript
import { getPresetRegistry } from "./patterns/registry/preset-registry";

const registry = getPresetRegistry();
registry.getAllPresets(); // All available presets
registry.getPresetsByMode("continuous"); // Filter by mode
registry.getPreset("lenia-orbium"); // Get specific preset
registry.loadPreset("lenia-orbium"); // Load into simulation
registry.importPresets(file); // Import from .gpreset file
registry.exportPresets(ids); // Export to shareable format
```

**Modes:** `discrete` | `continuous` | `multikernel` | `3d` | `particle` | `ecology` | `sensorimotor`

## Experiment Database

IndexedDB-backed experiment tracking:

```typescript
import * as db from "./persistence/experiment-db";

const exp = await db.createExperiment("my-research", config);
await db.createRun(exp.id, seed, params);
await db.createSnapshot(runId, step, state, metrics);
await db.listExperiments({ status: "running" });
await db.getGenealogy(experimentId);
```

## Ecology System

Multi-species ecosystem simulation with Lotka-Volterra dynamics:

```typescript
import { classicLotkaVolterra, simulateRK4 } from "./ecology/lotka-volterra";
import { PopulationTracker } from "./ecology/population-tracker";
import { ECOSYSTEM_PRESETS } from "./ecology/ecosystem-presets";

// Predator-prey dynamics
const { dPrey, dPredator } = classicLotkaVolterra(prey, predator, params);

// Full simulation with RK4 integration
const trajectory = simulateRK4(100, 20, params, 1000, 0.01);

// Track populations over time
const tracker = new PopulationTracker(2);
tracker.update([preyCount, predatorCount]);
const health = tracker.computeHealth();
```

**Presets:** `predator-prey` | `food-chain` | `competition` | `mutualism` | `resource-gradient` | `seasonal`

## Sensorimotor Mode (Agency)

Lenia organisms with agency - sensing gradients, avoiding obstacles, and directed movement:

```typescript
import { SensorimotorModeHandler } from "./core/engine/modes/sensorimotor-mode";
import type { SensorimotorParams } from "./compute/webgpu/sensorimotor-pipeline";

// Enable sensorimotor mode
engine.enableSensorimotor();

// Set parameters
engine.setSensorimotorParams({
  kernelRadius: 15,
  obstacleRepulsion: 2.0,
  motorInfluence: 0.3,
  pheromoneEmission: 0.05,
});

// Set target gradient (creature moves toward it)
engine.setTargetGradient(256, 256, 50, 1.0);

// Add obstacles
engine.addObstacleRect(100, 100, 50, 200);
```

**Channel Layout (RGBA textures):**
- Main: R=creature, G=obstacle, B=gradient, A=motor
- Aux: R=proximity, G=pheromone, B/A=reserved

**Presets:** `sm-chemotaxis-basic` | `sm-maze-navigation` | `sm-swarm-following` | `sm-wall-bouncer` | `sm-predator-evasion` | `sm-gentle-explorer`

## MCP Server (AI Interaction)

```typescript
import { createGenesisMCPServer } from "./mcp/server";
const server = createGenesisMCPServer();
```

**Core Tools:**

- `genesis_start_simulation`, `genesis_stop_simulation`, `genesis_step`
- `genesis_get_state`, `genesis_set_parameters`, `genesis_reset`
- `genesis_analyze_symmetry`, `genesis_analyze_chaos`, `genesis_calculate_fitness`

**Evolution Tools:**

- `genesis_start_evolution`, `genesis_get_generation_stats`
- `genesis_get_best_genome`, `genesis_load_genome`

**Preset Tools:**

- `genesis_preset_list`, `genesis_preset_load`, `genesis_preset_info`

**Experiment Tools:**

- `genesis_experiment_create`, `genesis_experiment_list`, `genesis_experiment_info`

**Quality/Grid Tools:**

- `genesis_grid_resize`, `genesis_set_quality`

**Ecology Tools:**

- `genesis_ecology_enable`, `genesis_ecology_stats`

## Known Limitations

- Sensorimotor obstacles: Visual rendering subtle
- WebGPU types: Show compile errors but work at runtime
- WebGPU initialization: Times out after 5s if GPU unavailable (shows compatibility modal)
