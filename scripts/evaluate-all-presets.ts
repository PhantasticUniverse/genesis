/**
 * Evaluate all reference organisms and output detailed baseline fitness scores
 */
import { REFERENCE_ORGANISMS } from "../src/patterns/reference-organisms";
import { encodeGenome, type LeniaGenome } from "../src/discovery/genome";
import {
  calculateSymmetry,
  calculateEntropy,
  calculateMass,
  calculateCentroid,
  calculateBoundingBox,
  calculateSurvivalFitness,
  calculateStabilityFitness,
  calculateMovementFitness,
  calculateOverallFitness,
} from "../src/discovery/fitness";
import { analyzeSymmetry, detectSymmetryType } from "../src/analysis/symmetry";
import {
  detectPeriod,
  classifyPeriodBehavior,
} from "../src/analysis/periodicity";
import {
  createCPULenia,
  initializeBlob,
  step,
  getState,
} from "../src/cli/utils/cpu-step";
import { setSeed } from "../src/core/random";

// Parse b string (e.g., "1" -> [1.0], "1,1/3" -> [1.0, 0.333])
function parsePeaks(bString: string): number[] {
  return bString.split(",").map((peak) => {
    if (peak.includes("/")) {
      const [num, denom] = peak.split("/").map(Number);
      return num / denom;
    }
    return parseFloat(peak);
  });
}

// Convert reference organism to LeniaGenome
function toGenome(organism: (typeof REFERENCE_ORGANISMS)[0]): LeniaGenome {
  return {
    R: organism.params.R,
    T: organism.params.T,
    b: parsePeaks(organism.params.b),
    m: organism.params.m,
    s: organism.params.s,
    kn: organism.params.kn as 1 | 2 | 3 | 4,
    gn: organism.params.gn as 1 | 2 | 3,
  };
}

interface EvaluationResult {
  code: string;
  name: string;
  R: number;
  m: number;
  s: number;
  overall: number;
  survival: number;
  stability: number;
  complexity: number;
  symmetry: number;
  movement: number;
  massChange: number;
  period: string;
  symmetryType: string;
  encoded: string;
}

function evaluateOrganism(
  organism: (typeof REFERENCE_ORGANISMS)[0],
  config: { width: number; height: number; steps: number },
): EvaluationResult {
  const genome = toGenome(organism);
  const { width, height, steps } = config;

  // Create Lenia context
  const ctx = createCPULenia({
    width,
    height,
    kernelRadius: Math.round(genome.R),
    growthCenter: genome.m,
    growthWidth: genome.s,
    dt: 1 / genome.T,
  });

  // Initialize with blob
  const blobRadius = Math.min(width, height) / 6;
  initializeBlob(ctx, blobRadius, 0.8);

  // Collect metrics
  const massHistory: number[] = [];
  const entropyHistory: number[] = [];
  const centroidHistory: { x: number; y: number }[] = [];
  const boundingHistory: number[] = [];
  const stateHistory: Float32Array[] = [];

  const initialMass = calculateMass(ctx.state);
  massHistory.push(initialMass);
  stateHistory.push(getState(ctx));

  for (let i = 0; i < steps; i++) {
    step(ctx);
    massHistory.push(calculateMass(ctx.state));
    entropyHistory.push(calculateEntropy(ctx.state));
    centroidHistory.push(calculateCentroid(ctx.state, width, height));
    boundingHistory.push(calculateBoundingBox(ctx.state, width, height).size);
    if (i % 5 === 0) {
      stateHistory.push(getState(ctx));
    }
  }

  const finalState = getState(ctx);
  const finalMass = calculateMass(finalState);

  // Calculate fitness metrics
  const survival = calculateSurvivalFitness(
    massHistory,
    initialMass,
    steps / 2,
  );
  const stability = calculateStabilityFitness(massHistory);
  const complexity = calculateEntropy(finalState);
  const symmetryScore = calculateSymmetry(finalState, width, height);
  const movement = calculateMovementFitness(centroidHistory, width, height);

  const fitness = calculateOverallFitness({
    survival,
    stability,
    complexity,
    symmetry: symmetryScore,
    movement,
    replication: 0,
  });

  // Advanced symmetry analysis
  const advancedSymmetry = analyzeSymmetry(finalState, width, height);
  const symmetryTypes = detectSymmetryType(advancedSymmetry);

  // Period detection
  const periodResult = detectPeriod(stateHistory, width, height);

  return {
    code: organism.code,
    name: organism.name,
    R: genome.R,
    m: genome.m,
    s: genome.s,
    overall: fitness.overall,
    survival: fitness.survival,
    stability: fitness.stability,
    complexity: fitness.complexity,
    symmetry: fitness.symmetry,
    movement: fitness.movement,
    massChange: ((finalMass - initialMass) / initialMass) * 100,
    period: classifyPeriodBehavior(periodResult),
    symmetryType: symmetryTypes.join(", ") || "none",
    encoded: encodeGenome(genome),
  };
}

// Main
async function main() {
  // Set seed for reproducibility
  setSeed(42);

  const size = 64;
  const steps = 200;

  console.log("=".repeat(80));
  console.log("  GENESIS: Reference Organisms Baseline Evaluation");
  console.log("=".repeat(80));
  console.log(`\nGrid: ${size}x${size}, Steps: ${steps}, Seed: 42\n`);

  const results: EvaluationResult[] = [];

  for (let i = 0; i < REFERENCE_ORGANISMS.length; i++) {
    const org = REFERENCE_ORGANISMS[i];
    process.stdout.write(
      `Evaluating ${i + 1}/${REFERENCE_ORGANISMS.length}: ${org.code} (${org.name})...`,
    );
    const result = evaluateOrganism(org, { width: size, height: size, steps });
    results.push(result);
    console.log(` fitness=${result.overall.toFixed(4)}`);
  }

  // Sort by overall fitness
  results.sort((a, b) => b.overall - a.overall);

  // Print table
  console.log("\n" + "=".repeat(80));
  console.log("  Results (sorted by fitness)");
  console.log("=".repeat(80) + "\n");

  console.log(
    "Code   | Name                        | R  | m      | s      | Overall | Surv  | Stab  | Symm  | Move  | Period",
  );
  console.log(
    "-------|-----------------------------|----|--------|--------|---------|-------|-------|-------|-------|--------",
  );

  for (const r of results) {
    console.log(
      `${r.code.padEnd(6)} | ${r.name.padEnd(27)} | ${r.R.toString().padStart(2)} | ${r.m.toFixed(4)} | ${r.s.toFixed(4)} | ${r.overall.toFixed(4).padStart(7)} | ${r.survival.toFixed(2).padStart(5)} | ${r.stability.toFixed(2).padStart(5)} | ${r.symmetry.toFixed(2).padStart(5)} | ${r.movement.toFixed(2).padStart(5)} | ${r.period}`,
    );
  }

  // Summary by family
  console.log("\n" + "=".repeat(80));
  console.log("  Summary by Family");
  console.log("=".repeat(80) + "\n");

  const families: Record<string, EvaluationResult[]> = {};
  for (const r of results) {
    const family = r.code[0];
    if (!families[family]) families[family] = [];
    families[family].push(r);
  }

  const familyNames: Record<string, string> = {
    O: "Orbidae (Gliders)",
    S: "Scutidae (Oscillators)",
    P: "Pterae (Winged)",
    K: "Kronidae (Complex)",
  };

  for (const [prefix, members] of Object.entries(families)) {
    const avgFitness =
      members.reduce((a, b) => a + b.overall, 0) / members.length;
    const best = members.reduce((a, b) => (a.overall > b.overall ? a : b));
    console.log(`${familyNames[prefix] || prefix}:`);
    console.log(`  Members: ${members.map((m) => m.code).join(", ")}`);
    console.log(`  Avg fitness: ${avgFitness.toFixed(4)}`);
    console.log(`  Best: ${best.code} (${best.overall.toFixed(4)})`);
    console.log();
  }

  // Output JSON
  console.log("\n" + "=".repeat(80));
  console.log("  JSON Output");
  console.log("=".repeat(80) + "\n");
  console.log(JSON.stringify(results, null, 2));
}

main();
