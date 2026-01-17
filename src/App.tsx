/**
 * GENESIS - Ultimate Cellular Automata Platform
 * Main Application Component
 */

import { useState, useEffect, useCallback } from "react";
import { Canvas } from "./ui/components/Canvas";
import { Controls } from "./ui/components/Controls";
import { DiscoveryPanel } from "./ui/components/DiscoveryPanel";
import { PhylogenyPanel } from "./ui/components/PhylogenyPanel";
import { AgencyPanel } from "./ui/components/AgencyPanel";
import { TrainingPanel } from "./ui/components/TrainingPanel";
import { ConservationPanel } from "./ui/components/ConservationPanel";
import { SaveLoadPanel } from "./ui/components/SaveLoadPanel";
import { EcologyPanel } from "./ui/components/EcologyPanel";
import { createGAController } from "./discovery/genetic-algorithm";
import { useEngine } from "./ui/hooks/useEngine";
import { DEFAULT_GRID_CONFIG } from "./core/types";
import { genomeToParams, type LeniaGenome } from "./discovery/genome";

function App() {
  const { canvasRef, engine, error, isLoading } = useEngine({
    gridConfig: DEFAULT_GRID_CONFIG,
    autoStart: false,
  });

  // Track the current genome for save/load
  const [currentGenome, setCurrentGenome] = useState<LeniaGenome | null>(null);

  // Create GA controller (shared between discovery and phylogeny panels)
  const [gaController] = useState(() =>
    createGAController({
      populationSize: 20,
      eliteCount: 2,
      noveltyWeight: 0.3,
    }),
  );

  const handleSelectOrganism = useCallback(
    (params: ReturnType<typeof genomeToParams>, genome?: LeniaGenome) => {
      if (engine) {
        engine.setParadigm("continuous");
        engine.setContinuousParams({
          kernelRadius: params.kernelRadius,
          growthCenter: params.growthCenter,
          growthWidth: params.growthWidth,
          dt: params.dt,
          growthType: params.growthType,
        });
        engine.reset("lenia-seed");

        // Track the genome if provided
        if (genome) {
          setCurrentGenome(genome);
        }
      }
    },
    [engine],
  );

  const handleLoadGenome = useCallback((genome: LeniaGenome) => {
    setCurrentGenome(genome);
  }, []);

  // Keyboard shortcuts handler
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      // Ignore if typing in an input field
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement ||
        event.target instanceof HTMLSelectElement
      ) {
        return;
      }

      if (!engine) return;

      switch (event.key.toLowerCase()) {
        case " ":
          event.preventDefault();
          engine.toggle();
          break;
        case "s":
          event.preventDefault();
          engine.stepOnce();
          break;
        case "r":
          event.preventDefault();
          engine.reset();
          break;
      }
    },
    [engine],
  );

  // Set up keyboard shortcut listener
  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleKeyDown]);

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <header className="mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-green-400 to-emerald-500 bg-clip-text text-transparent">
            GENESIS
          </h1>
          <p className="text-zinc-400 mt-2">
            Generative Evolution & Neural Emergence System for Intelligent
            Simulation
          </p>
        </header>

        {/* Error Display */}
        {error && (
          <div className="mb-6 p-4 bg-red-900/50 border border-red-700 rounded-lg">
            <h3 className="font-bold text-red-400">Error</h3>
            <p className="text-red-300 text-sm mt-1">{error.message}</p>
          </div>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="mb-6 p-4 bg-zinc-800 rounded-lg animate-pulse">
            <p className="text-zinc-400">Initializing WebGPU...</p>
          </div>
        )}

        {/* Main Content */}
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Canvas */}
          <div className="flex-shrink-0">
            <Canvas
              ref={canvasRef}
              width={DEFAULT_GRID_CONFIG.width}
              height={DEFAULT_GRID_CONFIG.height}
              className="w-full max-w-[512px] aspect-square"
            />
          </div>

          {/* Controls */}
          <div className="flex-1">
            <Controls engine={engine} />

            {/* Info Panel */}
            <div className="mt-6 p-4 bg-zinc-900 rounded-lg border border-zinc-800">
              <h3 className="font-medium text-zinc-300 mb-2">About</h3>
              <p className="text-sm text-zinc-500">
                GENESIS is a next-generation cellular automata platform powered
                by WebGPU. Features{" "}
                <span className="text-green-400">Discrete CA</span>,{" "}
                <span className="text-purple-400">Continuous CA</span> (Lenia),{" "}
                <span className="text-orange-400">Neural CA Training</span>,{" "}
                <span className="text-emerald-400">Multi-Species Ecology</span>,
                and <span className="text-blue-400">Pattern Discovery</span>.
              </p>
            </div>

            {/* Discovery Panel */}
            <DiscoveryPanel
              engine={engine}
              gaController={gaController}
              onSelectOrganism={handleSelectOrganism}
            />

            {/* Phylogeny Panel */}
            <PhylogenyPanel
              gaController={gaController}
              onSelectOrganism={handleSelectOrganism}
            />

            {/* Agency Panel */}
            <AgencyPanel engine={engine} />

            {/* Training Panel */}
            <TrainingPanel engine={engine} />

            {/* Conservation Panel */}
            <ConservationPanel engine={engine} />

            {/* Ecology Panel */}
            <EcologyPanel engine={engine} />

            {/* Save/Load Panel */}
            <SaveLoadPanel
              engine={engine}
              currentGenome={currentGenome}
              onLoadGenome={handleLoadGenome}
            />

            {/* Keyboard Shortcuts */}
            <div className="mt-4 text-xs text-zinc-600">
              <p className="font-medium text-zinc-500 mb-1">
                Keyboard Shortcuts
              </p>
              <ul className="space-y-1">
                <li>
                  <kbd className="px-1.5 py-0.5 bg-zinc-800 rounded">Space</kbd>{" "}
                  Toggle simulation
                </li>
                <li>
                  <kbd className="px-1.5 py-0.5 bg-zinc-800 rounded">S</kbd>{" "}
                  Step once
                </li>
                <li>
                  <kbd className="px-1.5 py-0.5 bg-zinc-800 rounded">R</kbd>{" "}
                  Reset
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="mt-12 text-center text-zinc-600 text-sm">
          <p>Built with WebGPU + React + TypeScript</p>
        </footer>
      </div>
    </div>
  );
}

export default App;
