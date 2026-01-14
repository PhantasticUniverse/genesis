/**
 * Discovery Panel Component
 * UI for genetic algorithm organism search
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { type GAController, type Individual } from '../../discovery/genetic-algorithm';
import { genomeToParams, type LeniaGenome } from '../../discovery/genome';
import { evaluateGenome } from '../../discovery/evaluator';
import type { Engine } from '../../core/engine';

interface DiscoveryPanelProps {
  engine: Engine | null;
  gaController: GAController;
  onSelectOrganism?: (params: ReturnType<typeof genomeToParams>, genome?: LeniaGenome) => void;
}

export function DiscoveryPanel({ engine, gaController: controller, onSelectOrganism }: DiscoveryPanelProps) {

  const [isSearching, setIsSearching] = useState(false);
  const [currentIndividual, setCurrentIndividual] = useState<Individual | null>(null);
  const [discovered, setDiscovered] = useState<Individual[]>([]);
  const [evaluationProgress, setEvaluationProgress] = useState({ current: 0, total: 0 });
  const searchAbortRef = useRef(false);
  const isMountedRef = useRef(true);

  // Cleanup: abort search on unmount to prevent memory leaks
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      searchAbortRef.current = true;
    };
  }, []);

  // Get GA state - only access when needed to avoid stale references
  const getState = useCallback(() => controller.getState(), [controller]);
  const state = getState();

  // Main search loop
  const runSearchLoop = useCallback(async () => {
    if (!engine) return;

    searchAbortRef.current = false;

    while (!searchAbortRef.current && isMountedRef.current) {
      // Get next individual to evaluate
      const individual = controller.getNextToEvaluate();

      if (individual) {
        // Check mounted before state updates
        if (!isMountedRef.current) break;

        const currentState = getState();
        setCurrentIndividual(individual);
        setEvaluationProgress({
          current: currentState.population.filter(i => i.fitness !== null).length + 1,
          total: currentState.population.length,
        });

        try {
          // Evaluate the individual
          const result = await evaluateGenome(engine, individual.genome, {
            simulationSteps: 150,
            warmupSteps: 10,
            sampleInterval: 5,
          });

          // Report fitness back to GA
          controller.setFitness(individual.id, result.fitness, result.behavior);

        } catch (e) {
          console.error('Evaluation error:', e);
          // Skip this individual
          controller.setFitness(individual.id, {
            survival: 0,
            stability: 0,
            complexity: 0,
            symmetry: 0,
            movement: 0,
            overall: 0,
          }, {
            avgMass: 0,
            massVariance: 0,
            avgSpeed: 0,
            avgEntropy: 0,
            boundingSize: 0,
            lifespan: 0,
          });
        }
      } else if (controller.isGenerationComplete()) {
        // Evolve to next generation
        controller.evolve();
        if (isMountedRef.current) {
          setDiscovered(controller.getArchive().slice(0, 10));
        }
      }

      // Small delay to allow UI updates
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  }, [engine, controller, getState]);

  const handleStartSearch = useCallback(() => {
    setIsSearching(true);
    controller.reset();
    runSearchLoop();
  }, [controller, runSearchLoop]);

  const handleStopSearch = useCallback(() => {
    searchAbortRef.current = true;
    setIsSearching(false);
    setCurrentIndividual(null);
  }, []);

  const handleSelectOrganism = useCallback((individual: Individual) => {
    const params = genomeToParams(individual.genome);
    onSelectOrganism?.(params, individual.genome);
  }, [onSelectOrganism]);

  // Update discovered list when generation changes
  useEffect(() => {
    if (isMountedRef.current) {
      setDiscovered(controller.getArchive().slice(0, 10));
    }
  }, [state.generation, controller]);

  return (
    <div className="flex flex-col gap-4 p-4 bg-zinc-900 rounded-lg border border-zinc-800">
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-zinc-300">Pattern Discovery</h3>
        <span className="text-xs text-zinc-500">
          Gen {state.generation} | Best: {(state.bestFitness * 100).toFixed(1)}%
        </span>
      </div>

      {/* Control buttons */}
      <div className="flex gap-2">
        {!isSearching ? (
          <button
            onClick={handleStartSearch}
            className="px-3 py-1.5 text-sm rounded bg-purple-600 hover:bg-purple-700 text-white transition-colors"
          >
            Start Search
          </button>
        ) : (
          <button
            onClick={handleStopSearch}
            className="px-3 py-1.5 text-sm rounded bg-red-600 hover:bg-red-700 text-white transition-colors"
          >
            Stop
          </button>
        )}
      </div>

      {/* Current evaluation */}
      {isSearching && currentIndividual && (
        <div className="p-2 bg-zinc-800 rounded text-xs">
          <div className="flex items-center justify-between">
            <span className="text-zinc-400">Evaluating: {currentIndividual.id}</span>
            <span className="text-purple-400">{evaluationProgress.current}/{evaluationProgress.total}</span>
          </div>
          <div className="text-zinc-500 font-mono mt-1">
            R={currentIndividual.genome.R} μ={currentIndividual.genome.m.toFixed(3)} σ={currentIndividual.genome.s.toFixed(3)}
          </div>
          <div className="mt-2 h-1 bg-zinc-700 rounded overflow-hidden">
            <div
              className="h-full bg-purple-500 transition-all duration-300"
              style={{ width: `${(evaluationProgress.current / evaluationProgress.total) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Population stats */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="p-2 bg-zinc-800 rounded">
          <div className="text-zinc-500">Population</div>
          <div className="text-zinc-300 font-mono">{state.population.length}</div>
        </div>
        <div className="p-2 bg-zinc-800 rounded">
          <div className="text-zinc-500">Archive</div>
          <div className="text-zinc-300 font-mono">{state.archive.length}</div>
        </div>
      </div>

      {/* Best individual */}
      {state.bestIndividual && (
        <div className="p-2 bg-green-900/30 border border-green-800 rounded">
          <div className="flex items-center justify-between">
            <span className="text-xs text-green-400 font-medium">Best Found</span>
            <button
              onClick={() => handleSelectOrganism(state.bestIndividual!)}
              className="text-xs px-2 py-0.5 bg-green-600 hover:bg-green-700 rounded text-white"
            >
              Load
            </button>
          </div>
          <div className="mt-1 text-xs text-zinc-400 font-mono">
            R={state.bestIndividual.genome.R} T={state.bestIndividual.genome.T}
          </div>
          <div className="mt-1 text-xs text-zinc-500">
            Fitness: {(state.bestFitness * 100).toFixed(1)}%
          </div>
        </div>
      )}

      {/* Discovered organisms */}
      {discovered.length > 0 && (
        <div>
          <div className="text-xs text-zinc-500 mb-2">Discovered Organisms</div>
          <div className="flex flex-wrap gap-1">
            {discovered.map((ind, i) => (
              <button
                key={ind.id}
                onClick={() => handleSelectOrganism(ind)}
                className="px-2 py-1 text-xs bg-zinc-800 hover:bg-zinc-700 rounded text-zinc-300 transition-colors"
                title={`R=${ind.genome.R} μ=${ind.genome.m.toFixed(3)}`}
              >
                #{i + 1}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Help text */}
      <div className="text-xs text-zinc-600">
        Uses genetic algorithm with novelty search to discover stable Lenia organisms.
      </div>
    </div>
  );
}
