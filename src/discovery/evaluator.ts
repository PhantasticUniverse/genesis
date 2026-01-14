/**
 * Pattern Evaluator
 * Runs organisms in simulation and calculates fitness metrics
 */

import type { Engine } from '../core/engine';
import type { LeniaGenome } from './genome';
import { genomeToParams } from './genome';
import {
  type FitnessMetrics,
  type BehaviorVector,
  calculateMass,
  calculateCentroid,
  calculateEntropy,
  calculateBoundingBox,
  calculateSymmetry,
  calculateSurvivalFitness,
  calculateStabilityFitness,
  calculateMovementFitness,
  calculateOverallFitness,
  calculateBehaviorVector,
} from './fitness';

export interface EvaluationConfig {
  simulationSteps: number;    // How many steps to run
  warmupSteps: number;        // Steps before collecting metrics
  sampleInterval: number;     // Collect metrics every N steps
  minSurvivalMass: number;    // Minimum mass to be considered alive
}

const DEFAULT_CONFIG: EvaluationConfig = {
  simulationSteps: 200,
  warmupSteps: 20,
  sampleInterval: 5,
  minSurvivalMass: 10,
};

export interface EvaluationResult {
  fitness: FitnessMetrics;
  behavior: BehaviorVector;
  finalState: Float32Array | null;
  survived: boolean;
}

/**
 * Evaluate a genome by running simulation
 */
export async function evaluateGenome(
  engine: Engine,
  genome: LeniaGenome,
  config: Partial<EvaluationConfig> = {}
): Promise<EvaluationResult> {
  const cfg = { ...DEFAULT_CONFIG, ...config };

  // Convert genome to engine parameters
  const params = genomeToParams(genome);

  // Configure engine for continuous mode with genome params
  engine.setParadigm('continuous');
  engine.setContinuousParams({
    kernelRadius: params.kernelRadius,
    growthCenter: params.growthCenter,
    growthWidth: params.growthWidth,
    dt: params.dt,
    growthType: params.growthType,
  });

  // Reset with a seed pattern
  engine.reset('lenia-seed');

  // Get grid dimensions
  const width = engine.getConfig().width;
  const height = engine.getConfig().height;

  // Metric collection arrays
  const massHistory: number[] = [];
  const entropyHistory: number[] = [];
  const centroidHistory: { x: number; y: number }[] = [];
  const boundingHistory: number[] = [];

  let initialMass = 0;

  // Run simulation
  for (let step = 0; step < cfg.simulationSteps; step++) {
    engine.stepOnce();

    // Skip warmup period
    if (step < cfg.warmupSteps) {
      if (step === cfg.warmupSteps - 1) {
        // Capture initial mass at end of warmup
        const state = await engine.readState();
        if (state) {
          initialMass = calculateMass(state);
        }
      }
      continue;
    }

    // Sample metrics at interval
    if ((step - cfg.warmupSteps) % cfg.sampleInterval === 0) {
      const state = await engine.readState();
      if (state) {
        const mass = calculateMass(state);
        const entropy = calculateEntropy(state);
        const centroid = calculateCentroid(state, width, height);
        const bbox = calculateBoundingBox(state, width, height);

        massHistory.push(mass);
        entropyHistory.push(entropy);
        centroidHistory.push(centroid);
        boundingHistory.push(bbox.size);

        // Early termination if organism dies
        if (mass < cfg.minSurvivalMass) {
          break;
        }
      }
    }

    // Allow UI to update occasionally
    if (step % 50 === 0) {
      await new Promise(resolve => setTimeout(resolve, 0));
    }
  }

  // Get final state (used for symmetry calculation and return value)
  const finalState = await engine.readState();

  // Calculate fitness metrics
  const survival = calculateSurvivalFitness(massHistory, initialMass);
  const stability = calculateStabilityFitness(massHistory);
  const complexity = entropyHistory.length > 0
    ? entropyHistory.reduce((a, b) => a + b, 0) / entropyHistory.length
    : 0;
  const movement = calculateMovementFitness(centroidHistory, width, height);

  // Calculate actual symmetry from final state
  const symmetry = finalState
    ? calculateSymmetry(finalState, width, height)
    : 0;

  const fitness = calculateOverallFitness({
    survival,
    stability,
    complexity,
    symmetry,
    movement,
  });

  // Calculate behavior vector for novelty search
  const behavior = massHistory.length > 0
    ? calculateBehaviorVector(
        massHistory,
        entropyHistory,
        centroidHistory,
        boundingHistory,
        width,
        height
      )
    : {
        avgMass: 0,
        massVariance: 0,
        avgSpeed: 0,
        avgEntropy: 0,
        boundingSize: 0,
        lifespan: 0,
      };

  return {
    fitness,
    behavior,
    finalState,
    survived: massHistory.length > 0 && massHistory[massHistory.length - 1] > cfg.minSurvivalMass,
  };
}

/**
 * Batch evaluate multiple genomes
 * Returns results in same order as input
 */
export async function evaluatePopulation(
  engine: Engine,
  genomes: LeniaGenome[],
  config: Partial<EvaluationConfig> = {},
  onProgress?: (completed: number, total: number) => void
): Promise<EvaluationResult[]> {
  const results: EvaluationResult[] = [];

  for (let i = 0; i < genomes.length; i++) {
    const result = await evaluateGenome(engine, genomes[i], config);
    results.push(result);
    onProgress?.(i + 1, genomes.length);
  }

  return results;
}
