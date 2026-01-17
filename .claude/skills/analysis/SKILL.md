---
name: analysis
description: Symmetry analysis, Lyapunov exponent chaos detection, and period detection APIs. Use when analyzing CA states, detecting patterns, measuring stability, or classifying dynamic behavior.
---

# Analysis APIs

## Symmetry Detection

### Quick Symmetry Score

```typescript
import { calculateSymmetry } from "./discovery/fitness";
// Returns 0-1 score: 30% horizontal + 30% vertical + 40% rotational
const score = calculateSymmetry(state, width, height);
```

### Advanced Symmetry Analysis

```typescript
import {
  analyzeSymmetry,
  quickSymmetryScore,
  detectSymmetryType,
  calculateKFoldSymmetry,
} from "./analysis/symmetry";

// Full symmetry analysis
const result = analyzeSymmetry(state, width, height, { maxOrder: 8 });
console.log(`Order: ${result.order}`); // Dominant k-fold (1-8)
console.log(`Strength: ${result.strength}`); // 0-1 strength
console.log(`Horizontal: ${result.horizontal}`);
console.log(`Vertical: ${result.vertical}`);
console.log(`Rotational180: ${result.rotational180}`);

// Quick symmetry score (faster, less detailed)
const score = quickSymmetryScore(state, width, height);

// Detect symmetry types
const types = detectSymmetryType(result);
// Returns: ['bilateral-horizontal', '4-fold-rotational', 'radial'] etc.
```

### Symmetry Types

- `bilateral-horizontal` / `bilateral-vertical` - reflection symmetry
- `point-symmetric` - 180° rotational
- `k-fold-rotational` - k-fold rotational (2, 4, 6, 8...)
- `radial` - high-order circular symmetry
- `asymmetric` - no significant symmetry

## Lyapunov Exponent (Chaos Analysis)

```typescript
import {
  calculateLyapunovExponent,
  wolfLyapunovEstimate,
  quickStabilityCheck,
  classifyDynamics,
} from "./analysis/chaos";

// Define step function for your CA
const stepFunction = (state: Float32Array) => {
  /* evolve state */
};

// Full Lyapunov calculation
const result = calculateLyapunovExponent(initialState, stepFunction, {
  steps: 100,
  perturbationMagnitude: 0.001,
  renormalize: true,
});
console.log(`Exponent: ${result.exponent}`);
console.log(`Classification: ${result.classification}`);
console.log(`Confidence: ${result.confidence}`);

// Wolf algorithm (more robust for noisy systems)
const wolfResult = wolfLyapunovEstimate(initialState, stepFunction);

// Quick stability check (fast but less accurate)
const stability = quickStabilityCheck(initialState, stepFunction, 20);
// Returns: 'stable' | 'unstable' | 'unknown'
```

### Lyapunov Classification

| Exponent (λ) | Classification   | Meaning             |
| ------------ | ---------------- | ------------------- | ------------ | ----------------- |
| `λ < -0.01`  | **stable**       | Perturbations decay |
| `            | λ                | ≤ 0.01`             | **periodic** | Marginally stable |
| `λ > 0.01`   | **chaotic**      | Perturbations grow  |
| `λ > 1`      | **hyperchaotic** | Rapid divergence    |

## Period Detection

```typescript
import {
  detectPeriod,
  PeriodTracker,
  classifyPeriodBehavior,
} from "./analysis/periodicity";

// Detect period from state history
const result = detectPeriod(stateHistory, width, height, {
  maxPeriod: 100,
  correlationThreshold: 0.8,
});
console.log(`Period: ${result.period}`);
console.log(`Exact: ${result.isExactPeriod}`);
console.log(`Behavior: ${result.behavior}`);
console.log(classifyPeriodBehavior(result));

// Incremental tracking (for real-time detection)
const tracker = new PeriodTracker(width, height, { maxPeriod: 50 });
// In simulation loop:
tracker.push(currentState);
const analysis = tracker.analyze();
```

### Period Behaviors

| Behavior         | Description                         |
| ---------------- | ----------------------------------- |
| `static`         | Fixed point (no change)             |
| `periodic`       | Exact or approximate cycle          |
| `quasi-periodic` | Multiple incommensurate frequencies |
| `chaotic`        | No detectable period                |

## Statistical Analysis

```typescript
import {
  mean,
  variance,
  std,
  sem,
  median,
  percentile,
  iqr,
  skewness,
  kurtosis,
  bootstrapCI,
  bootstrapBCaCI,
  cohensD,
  hedgesG,
  cliffsD,
  mannWhitneyU,
  kruskalWallis,
  bonferroniCorrection,
  holmCorrection,
  benjaminiHochberg,
} from "./analysis/statistics";

// Basic statistics
const m = mean(data);
const s = std(data);
const ci = bootstrapBCaCI(data, mean, { confidence: 0.95 });

// Effect sizes
const d = cohensD(group1, group2);
console.log(`Effect: ${d.interpretation}`); // 'small' | 'medium' | 'large'

// Non-parametric tests
const uTest = mannWhitneyU(group1, group2, 0.05);
console.log(`p-value: ${uTest.pValue}, significant: ${uTest.significant}`);

// Multiple comparison correction
const { corrected, significant } = holmCorrection(pValues);
```

### Effect Size Interpretation

| Cohen's d | Interpretation |
| --------- | -------------- |
| < 0.2     | Negligible     |
| 0.2 - 0.5 | Small          |
| 0.5 - 0.8 | Medium         |
| > 0.8     | Large          |

## Core Files

| File                      | Purpose                       |
| ------------------------- | ----------------------------- |
| `analysis/symmetry.ts`    | Symmetry detection algorithms |
| `analysis/chaos.ts`       | Lyapunov exponent calculation |
| `analysis/periodicity.ts` | Period detection and tracking |
| `analysis/statistics.ts`  | Statistical analysis module   |
| `analysis/experiment.ts`  | Experiment comparison         |
| `discovery/fitness.ts`    | Quick symmetry score          |
