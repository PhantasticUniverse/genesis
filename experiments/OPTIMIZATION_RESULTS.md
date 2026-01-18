# Genesis Preset Optimization Results

**Date:** 2026-01-17
**Seed:** 42 (reproducible)
**Grid:** 64x64
**Steps:** 200

---

## Executive Summary

| Approach                        | Best Fitness | Improvement              |
| ------------------------------- | ------------ | ------------------------ |
| Reference organisms (blob init) | 0.005        | Baseline - organisms die |
| Single-kernel optimized         | 0.5648       | 112x improvement         |
| Multi-kernel optimized          | 0.9999       | 200x improvement         |

**Key Finding:** Multi-kernel Lenia with 2 kernels achieves near-perfect fitness (0.9999) from blob initialization, vastly outperforming both reference organisms and single-kernel configurations.

---

## Phase 1: Baseline Evaluation

### Reference Organisms (14 presets)

All 14 reference organisms **die** when initialized with a blob instead of their precise RLE patterns.

| Family                 | Members            | Avg Fitness | Best          |
| ---------------------- | ------------------ | ----------- | ------------- |
| Orbidae (Gliders)      | O2u, O2ui, O2b     | 0.0054      | O2ui (0.0062) |
| Scutidae (Oscillators) | S1s, S1v, S2s, S4s | 0.0050      | All equal     |
| Pterae (Winged)        | PG1a, PG1c, PV1    | 0.0050      | All equal     |
| Kronidae (Complex)     | K4s, K4t, K4v, K5s | 0.0050      | All equal     |

**Conclusion:** Reference organisms require their exact initial patterns to survive. With blob initialization, mass change = -100% (total death).

---

## Phase 2: Analysis

### Default Parameters Analysis (Blob Init)

With default parameters (R=13, μ=0.12, σ=0.04):

- **Initial Symmetry:** 4-fold, strength 0.46
- **Final Symmetry:** 4-fold, strength 0.85 (emergent)
- **Symmetry Types:** bilateral-horizontal, bilateral-vertical, 4-fold-rotational, radial
- **Period Behavior:** Aperiodic/chaotic
- **Chaos Classification:** Unknown (quick stability)

---

## Phase 3: Optimization Results

### Single-Kernel Evolution (15 generations, 20 population)

**Best Genome (Fitness: 0.5648)**

```json
{
  "kernelRadius": 12,
  "growthCenter": 0.1055,
  "growthWidth": 0.0257,
  "timeResolution": 11,
  "peaks": [0.148, 0.335, 0.810],
  "kernelType": 3 (staircase),
  "growthType": 1 (polynomial)
}
```

**Encoded:** `MTJ8MTF8MC4xNDgsMC4zMzUsMC44MTB8MC4xMDU1fDAuMDI1N3wzfDE=`

**Fitness Breakdown:**

- Survival: 1.0 (perfect)
- Stability: 0.4955
- Complexity: 0.4740
- Symmetry: 1.0 (perfect, 4-fold rotational + radial)
- Movement: 0.4375
- Period: 2 (oscillating, 83% confidence)
- Mass Growth: +735%

### Multi-Kernel Evolution (15 generations, 20 population)

**Best Genome (Fitness: 0.9999)**

```json
{
  "T": 18,
  "kernelCount": 2,
  "combinationMode": "average",
  "kernels": [
    {
      "shape": "step",
      "radius": 30,
      "peaks": [0.865],
      "weight": 0.379
    },
    {
      "shape": "polynomial",
      "radius": 28,
      "peaks": [0.114, 0.373, 0.64],
      "weight": 1.386
    }
  ],
  "growthParams": [
    { "type": "gaussian", "mu": 0.235, "sigma": 0.048 },
    { "type": "gaussian", "mu": 0.092, "sigma": 0.07 }
  ],
  "dt": 0.0556
}
```

**Encoded:** `MTh8MnwxfDMwLDI4fDAuODY1LDAuMTE0OjAuMzczOjAuNjQwfDAuMzc5LDEuMzg2fDAuMjM1MSwwLjA5MjB8MC4wNDgyLDAuMDcwMXwyLDF8Miwy`

**Key Characteristics:**

- Uses large radii (30, 28) - activates FFT for efficiency
- Combination mode: average
- Unequal kernel weights (0.379 vs 1.386)
- Different growth parameters per kernel
- Gaussian growth functions for both kernels

---

## Parameter Comparison

| Parameter         | Reference (O2u) | Single-Kernel Opt     | Multi-Kernel Opt               |
| ----------------- | --------------- | --------------------- | ------------------------------ |
| Radius            | 13              | 12                    | 30, 28                         |
| Growth Center (μ) | 0.15            | 0.1055                | 0.235, 0.092                   |
| Growth Width (σ)  | 0.015           | 0.0257                | 0.048, 0.070                   |
| Time Resolution   | 10              | 11                    | 18                             |
| Peaks             | [1.0]           | [0.148, 0.335, 0.810] | [0.865], [0.114, 0.373, 0.640] |
| **Fitness**       | 0.005           | 0.5648                | 0.9999                         |

---

## Key Insights

1. **Multi-kernel >> Single-kernel:** The second kernel with different parameters enables much richer dynamics (0.9999 vs 0.5648 fitness).

2. **Large radii benefit multi-kernel:** The optimal multi-kernel uses R=30,28 vs R=12 for single-kernel.

3. **Multiple peaks important:** Both optimized genomes use 3 peaks in their primary kernel.

4. **Growth width larger than reference:** Optimized σ values (0.026-0.070) are larger than reference organisms (0.012-0.015).

5. **FFT auto-activates:** With R ≥ 16, the engine uses FFT convolution for better performance.

---

## Reproducibility

All experiments used seed=42 for reproducibility. To reproduce:

```bash
# Single-kernel evolution
bun run cli evolve run --generations 15 --population 20 --seed 42 --size 64 --steps 200

# Multi-kernel evolution
bun run cli multikernel evolve --generations 15 --population 20 --kernels 2 --seed 42 --size 64 --steps 200

# Evaluate genomes
bun run cli evaluate genome --genome "<encoded>" --size 64 --steps 200
```

---

## Files Generated

- `experiments/optimized-genomes.json` - Single-kernel evolution results
- `experiments/multikernel-optimized.json` - Multi-kernel evolution results
- `experiments/exp_*.json` - Experiment manifests with metadata
