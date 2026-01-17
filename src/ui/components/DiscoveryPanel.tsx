/**
 * Discovery Panel Component - Bioluminescent Theme
 * UI for genetic algorithm organism search with magenta accent
 */

import { useState, useCallback, useEffect, useRef } from "react";
import {
  type GAController,
  type Individual,
} from "../../discovery/genetic-algorithm";
import { genomeToParams, type LeniaGenome } from "../../discovery/genome";
import { evaluateGenome } from "../../discovery/evaluator";
import type { Engine } from "../../core/engine";
import { ExpandablePanel } from "./common";

/**
 * Fitness history entry for charting
 */
interface FitnessHistoryEntry {
  generation: number;
  best: number;
  avg: number;
}

/**
 * Mini fitness chart showing evolution progress with magenta theme
 */
function FitnessChart({ history }: { history: FitnessHistoryEntry[] }) {
  if (history.length < 2) return null;

  const width = 120;
  const height = 40;
  const padding = 2;

  // Find max fitness for scaling
  const maxFitness = Math.max(...history.map((h) => h.best), 0.1);

  // Create path for best fitness line
  const bestPath = history
    .map((entry, i) => {
      const x = padding + (i / (history.length - 1)) * (width - padding * 2);
      const y =
        height - padding - (entry.best / maxFitness) * (height - padding * 2);
      return `${i === 0 ? "M" : "L"} ${x} ${y}`;
    })
    .join(" ");

  // Create path for average fitness line
  const avgPath = history
    .map((entry, i) => {
      const x = padding + (i / (history.length - 1)) * (width - padding * 2);
      const y =
        height - padding - (entry.avg / maxFitness) * (height - padding * 2);
      return `${i === 0 ? "M" : "L"} ${x} ${y}`;
    })
    .join(" ");

  return (
    <div className="p-3 bg-genesis-surface rounded-lg border border-[rgba(255,0,255,0.1)]">
      <div className="flex items-center justify-between text-xs mb-2">
        <span className="text-bio-magenta font-display tracking-wide uppercase">
          Fitness History
        </span>
        <span className="text-zinc-500 font-mono">{history.length} gen</span>
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-10"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="bestFitnessGradient" x1="0" x2="0" y1="0" y2="1">
            <stop
              offset="0%"
              stopColor="var(--bio-magenta)"
              stopOpacity="0.4"
            />
            <stop
              offset="100%"
              stopColor="var(--bio-magenta)"
              stopOpacity="0"
            />
          </linearGradient>
        </defs>
        {/* Fill under best line */}
        <path
          d={`${bestPath} L ${width - padding} ${height - padding} L ${padding} ${height - padding} Z`}
          fill="url(#bestFitnessGradient)"
        />
        {/* Average fitness line (dimmer) */}
        <path
          d={avgPath}
          fill="none"
          stroke="rgba(113, 113, 122, 0.5)"
          strokeWidth="1"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray="2,2"
        />
        {/* Best fitness line */}
        <path
          d={bestPath}
          fill="none"
          stroke="var(--bio-magenta)"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <div className="flex justify-between text-xs mt-2">
        <span className="text-zinc-500">
          Avg:{" "}
          <span className="text-zinc-400 font-mono">
            {(history[history.length - 1]?.avg * 100).toFixed(0)}%
          </span>
        </span>
        <span className="text-zinc-500">
          Best:{" "}
          <span className="text-bio-magenta font-mono">
            {(history[history.length - 1]?.best * 100).toFixed(0)}%
          </span>
        </span>
      </div>
    </div>
  );
}

interface DiscoveryPanelProps {
  engine: Engine | null;
  gaController: GAController;
  onSelectOrganism?: (
    params: ReturnType<typeof genomeToParams>,
    genome?: LeniaGenome,
  ) => void;
}

export function DiscoveryPanel({
  engine,
  gaController: controller,
  onSelectOrganism,
}: DiscoveryPanelProps) {
  const [isSearching, setIsSearching] = useState(false);
  const [currentIndividual, setCurrentIndividual] = useState<Individual | null>(
    null,
  );
  const [discovered, setDiscovered] = useState<Individual[]>([]);
  const [evaluationProgress, setEvaluationProgress] = useState({
    current: 0,
    total: 0,
  });
  const [fitnessHistory, setFitnessHistory] = useState<FitnessHistoryEntry[]>(
    [],
  );
  const searchAbortRef = useRef(false);
  const isMountedRef = useRef(true);
  const lastRecordedGenRef = useRef(-1);

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
          current:
            currentState.population.filter((i) => i.fitness !== null).length +
            1,
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
          console.error("Evaluation error:", e);
          // Skip this individual
          controller.setFitness(
            individual.id,
            {
              survival: 0,
              stability: 0,
              complexity: 0,
              symmetry: 0,
              movement: 0,
              replication: 0,
              overall: 0,
            },
            {
              avgMass: 0,
              massVariance: 0,
              avgSpeed: 0,
              avgEntropy: 0,
              boundingSize: 0,
              lifespan: 0,
            },
          );
        }
      } else if (controller.isGenerationComplete()) {
        // Record fitness history before evolving
        const currentState = getState();
        if (
          isMountedRef.current &&
          currentState.generation > lastRecordedGenRef.current
        ) {
          lastRecordedGenRef.current = currentState.generation;

          // Calculate average fitness of evaluated individuals
          const evaluated = currentState.population.filter(
            (ind) => ind.fitness !== null,
          );
          const avgFitness =
            evaluated.length > 0
              ? evaluated.reduce(
                  (sum, ind) => sum + (ind.fitness?.overall ?? 0),
                  0,
                ) / evaluated.length
              : 0;

          setFitnessHistory((prev) => [
            ...prev,
            {
              generation: currentState.generation,
              best: currentState.bestFitness,
              avg: avgFitness,
            },
          ]);
        }

        // Evolve to next generation
        controller.evolve();
        if (isMountedRef.current) {
          setDiscovered(controller.getArchive().slice(0, 10));
        }
      }

      // Small delay to allow UI updates
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
  }, [engine, controller, getState]);

  const handleStartSearch = useCallback(() => {
    setIsSearching(true);
    setFitnessHistory([]);
    lastRecordedGenRef.current = -1;
    controller.reset();
    runSearchLoop();
  }, [controller, runSearchLoop]);

  const handleStopSearch = useCallback(() => {
    searchAbortRef.current = true;
    setIsSearching(false);
    setCurrentIndividual(null);
  }, []);

  const handleSelectOrganism = useCallback(
    (individual: Individual) => {
      const params = genomeToParams(individual.genome);
      onSelectOrganism?.(params, individual.genome);
    },
    [onSelectOrganism],
  );

  // Update discovered list when generation changes
  useEffect(() => {
    if (isMountedRef.current) {
      setDiscovered(controller.getArchive().slice(0, 10));
    }
  }, [state.generation, controller]);

  return (
    <ExpandablePanel
      title="Pattern Discovery"
      titleColor="text-bio-magenta"
      accent="magenta"
      className="mt-4"
      statusBadge={{
        text: `Gen ${state.generation}`,
        color: "bg-[rgba(255,0,255,0.15)] border-bio-magenta text-bio-magenta",
      }}
    >
      <div className="space-y-4">
        {/* Header stats */}
        <div className="flex items-center justify-between text-xs">
          <span className="text-zinc-500">
            Best:{" "}
            <span className="text-bio-magenta font-mono">
              {(state.bestFitness * 100).toFixed(1)}%
            </span>
          </span>
        </div>

        {/* Control buttons */}
        <div className="flex gap-2">
          {!isSearching ? (
            <button
              onClick={handleStartSearch}
              className="btn-glow flex-1 px-4 py-2 text-sm rounded-lg bg-gradient-to-r from-fuchsia-600 to-purple-600 text-white border border-bio-magenta transition-all duration-300 hover:shadow-[0_0_20px_rgba(255,0,255,0.4)]"
            >
              Start Search
            </button>
          ) : (
            <button
              onClick={handleStopSearch}
              className="btn-glow flex-1 px-4 py-2 text-sm rounded-lg bg-gradient-to-r from-red-600 to-rose-600 text-white border border-[var(--state-error)] transition-all duration-300"
            >
              Stop
            </button>
          )}
        </div>

        {/* Current evaluation */}
        {isSearching && currentIndividual && (
          <div className="p-3 bg-genesis-surface rounded-lg border border-[rgba(255,0,255,0.15)]">
            <div className="flex items-center justify-between text-xs">
              <span className="text-zinc-400">
                Evaluating:{" "}
                <span className="text-bio-magenta">{currentIndividual.id}</span>
              </span>
              <span className="text-bio-magenta font-mono">
                {evaluationProgress.current}/{evaluationProgress.total}
              </span>
            </div>
            <div className="text-xs text-zinc-500 font-mono mt-2">
              R={currentIndividual.genome.R} μ=
              {currentIndividual.genome.m.toFixed(3)} σ=
              {currentIndividual.genome.s.toFixed(3)}
            </div>
            <div className="progress-bar mt-3">
              <div
                className="progress-fill"
                style={{
                  width: `${(evaluationProgress.current / evaluationProgress.total) * 100}%`,
                  background:
                    "linear-gradient(90deg, var(--bio-magenta-dim), var(--bio-magenta))",
                }}
              />
            </div>
          </div>
        )}

        {/* Population stats */}
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="stat-card">
            <div className="stat-label">Population</div>
            <div className="stat-value text-bio-magenta">
              {state.population.length}
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Archive</div>
            <div className="stat-value text-bio-magenta">
              {state.archive.length}
            </div>
          </div>
        </div>

        {/* Fitness history chart */}
        {fitnessHistory.length >= 2 && (
          <FitnessChart history={fitnessHistory} />
        )}

        {/* Best individual */}
        {state.bestIndividual && (
          <div className="p-3 bg-[rgba(0,255,136,0.05)] border border-bio-green rounded-lg">
            <div className="flex items-center justify-between">
              <span className="text-xs text-bio-green font-display tracking-wide uppercase">
                Best Found
              </span>
              <button
                onClick={() => handleSelectOrganism(state.bestIndividual!)}
                className="text-xs px-3 py-1 bg-gradient-to-r from-emerald-600 to-green-600 rounded text-white hover:shadow-[0_0_15px_rgba(0,255,136,0.3)] transition-all duration-300"
              >
                Load
              </button>
            </div>
            <div className="mt-2 text-xs text-zinc-400 font-mono">
              R={state.bestIndividual.genome.R} T=
              {state.bestIndividual.genome.T}
            </div>
            <div className="mt-1 text-xs text-zinc-500">
              Fitness:{" "}
              <span className="text-bio-green">
                {(state.bestFitness * 100).toFixed(1)}%
              </span>
            </div>
          </div>
        )}

        {/* Discovered organisms */}
        {discovered.length > 0 && (
          <div>
            <div className="text-xs text-bio-magenta font-display tracking-wide uppercase mb-2">
              Discovered Organisms
            </div>
            <div className="flex flex-wrap gap-2">
              {discovered.map((ind, i) => (
                <button
                  key={ind.id}
                  onClick={() => handleSelectOrganism(ind)}
                  className="px-3 py-1.5 text-xs bg-genesis-surface border border-[rgba(255,0,255,0.2)] hover:border-bio-magenta rounded text-zinc-300 transition-all duration-300 hover:shadow-[0_0_10px_rgba(255,0,255,0.2)]"
                  title={`R=${ind.genome.R} μ=${ind.genome.m.toFixed(3)}`}
                >
                  #{i + 1}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Help text */}
        <div className="text-xs text-zinc-600 leading-relaxed">
          Uses genetic algorithm with novelty search to discover stable Lenia
          organisms.
        </div>
      </div>
    </ExpandablePanel>
  );
}
