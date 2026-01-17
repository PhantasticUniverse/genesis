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
import { Lenia3DPanel } from "./ui/components/Lenia3DPanel";
import {
  WebGPUCompatibilityModal,
  useWebGPUCheck,
} from "./ui/components/WebGPUCheck";
import { PerformanceMonitor } from "./ui/components/PerformanceMonitor";
import { createGAController } from "./discovery/genetic-algorithm";
import { useEngine } from "./ui/hooks/useEngine";
import { useEngine3D } from "./ui/hooks/useEngine3D";
import { DEFAULT_GRID_CONFIG } from "./core/types";
import { genomeToParams, type LeniaGenome } from "./discovery/genome";

type SimulationMode = "2d" | "3d";

function App() {
  // WebGPU compatibility check
  const { result: webgpuCheck, checking: webgpuChecking } = useWebGPUCheck();
  const [dismissedCompatibilityWarning, setDismissedCompatibilityWarning] =
    useState(false);

  // Simulation mode (2D or 3D)
  const [mode, setMode] = useState<SimulationMode>("2d");

  // 2D Engine
  const { canvasRef, engine, error, isLoading } = useEngine({
    gridConfig: DEFAULT_GRID_CONFIG,
    autoStart: false,
  });

  // 3D Engine (lazy initialization)
  const {
    canvasRef: canvas3DRef,
    engine: engine3D,
    error: error3D,
    isLoading: isLoading3D,
    initialize: initialize3D,
  } = useEngine3D({ autoStart: false });

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

  // Handle mode switch - stop current engine and switch
  const handleModeSwitch = useCallback(
    (newMode: SimulationMode) => {
      // Stop current engines
      if (mode === "2d" && engine?.running) {
        engine.stop();
      } else if (mode === "3d" && engine3D?.running) {
        engine3D.stop();
      }

      setMode(newMode);
      // Note: 3D initialization happens via useEffect after mode change renders
    },
    [mode, engine, engine3D],
  );

  // Initialize 3D engine when switching to 3D mode (after render)
  useEffect(() => {
    if (mode === "3d" && !engine3D && !isLoading3D) {
      // Small delay to ensure canvas is fully rendered and visible
      const timer = setTimeout(() => {
        initialize3D();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [mode, engine3D, isLoading3D, initialize3D]);

  // Get the current active engine based on mode
  const activeEngine = mode === "2d" ? engine : null;
  const currentError = mode === "2d" ? error : error3D;
  const currentLoading = mode === "2d" ? isLoading : isLoading3D;

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

      // Use current active engine based on mode
      const currentEngine = mode === "2d" ? engine : engine3D;
      if (!currentEngine) return;

      switch (event.key.toLowerCase()) {
        case " ":
          event.preventDefault();
          currentEngine.toggle();
          break;
        case "s":
          event.preventDefault();
          currentEngine.stepOnce();
          break;
        case "r":
          event.preventDefault();
          currentEngine.reset();
          break;
      }
    },
    [mode, engine, engine3D],
  );

  // Set up keyboard shortcut listener
  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleKeyDown]);

  // Get current engine based on mode
  const currentEngineForMonitor = mode === "2d" ? engine : engine3D;

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-8">
      {/* Floating Performance Monitor */}
      <PerformanceMonitor engine={currentEngineForMonitor} floating />

      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <header className="mb-8">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-green-400 to-emerald-500 bg-clip-text text-transparent">
                GENESIS
              </h1>
              <p className="text-zinc-400 mt-2">
                Generative Evolution & Neural Emergence System for Intelligent
                Simulation
              </p>
            </div>

            {/* 2D/3D Mode Toggle */}
            <div className="flex items-center gap-2 bg-zinc-900 p-1 rounded-lg border border-zinc-800">
              <button
                onClick={() => handleModeSwitch("2d")}
                className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
                  mode === "2d"
                    ? "bg-green-600 text-white"
                    : "text-zinc-400 hover:text-white hover:bg-zinc-800"
                }`}
              >
                2D
              </button>
              <button
                onClick={() => handleModeSwitch("3d")}
                className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
                  mode === "3d"
                    ? "bg-purple-600 text-white"
                    : "text-zinc-400 hover:text-white hover:bg-zinc-800"
                }`}
              >
                3D
              </button>
            </div>
          </div>
        </header>

        {/* Error Display */}
        {currentError && (
          <div className="mb-6 p-4 bg-red-900/50 border border-red-700 rounded-lg">
            <h3 className="font-bold text-red-400">Error</h3>
            <p className="text-red-300 text-sm mt-1">{currentError.message}</p>
          </div>
        )}

        {/* Loading State */}
        {currentLoading && (
          <div className="mb-6 p-4 bg-zinc-800 rounded-lg animate-pulse">
            <p className="text-zinc-400">
              Initializing WebGPU {mode === "3d" ? "(3D)" : ""}...
            </p>
          </div>
        )}

        {/* Main Content */}
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Canvas */}
          <div className="flex-shrink-0">
            {/* 2D Canvas */}
            <Canvas
              ref={canvasRef}
              width={DEFAULT_GRID_CONFIG.width}
              height={DEFAULT_GRID_CONFIG.height}
              className={`w-full max-w-[512px] aspect-square ${mode !== "2d" ? "hidden" : ""}`}
            />
            {/* 3D Canvas */}
            <Canvas
              ref={canvas3DRef}
              width={512}
              height={512}
              className={`w-full max-w-[512px] aspect-square ${mode !== "3d" ? "hidden" : ""}`}
            />
          </div>

          {/* Controls */}
          <div className="flex-1">
            {/* Mode-specific controls */}
            {mode === "2d" ? (
              <>
                <Controls engine={engine} />

                {/* Info Panel */}
                <div className="mt-6 p-4 bg-zinc-900 rounded-lg border border-zinc-800">
                  <h3 className="font-medium text-zinc-300 mb-2">About</h3>
                  <p className="text-sm text-zinc-500">
                    GENESIS is a next-generation cellular automata platform
                    powered by WebGPU. Features{" "}
                    <span className="text-green-400">Discrete CA</span>,{" "}
                    <span className="text-purple-400">Continuous CA</span>{" "}
                    (Lenia),{" "}
                    <span className="text-orange-400">Neural CA Training</span>,{" "}
                    <span className="text-emerald-400">
                      Multi-Species Ecology
                    </span>
                    , and{" "}
                    <span className="text-blue-400">Pattern Discovery</span>.
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
              </>
            ) : (
              <>
                {/* 3D Lenia Panel */}
                <Lenia3DPanel engine={engine3D} onInit={initialize3D} />

                {/* 3D Info Panel */}
                <div className="mt-6 p-4 bg-zinc-900 rounded-lg border border-zinc-800">
                  <h3 className="font-medium text-zinc-300 mb-2">3D Lenia</h3>
                  <p className="text-sm text-zinc-500">
                    Explore volumetric cellular automata in 3D space. Use the{" "}
                    <span className="text-purple-400">slice viewer</span> to see
                    cross-sections through the simulation, or select different{" "}
                    <span className="text-purple-400">organism presets</span> to
                    observe different behaviors.
                  </p>
                </div>
              </>
            )}

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

      {/* WebGPU Compatibility Modal */}
      {!webgpuChecking &&
        webgpuCheck &&
        !webgpuCheck.available &&
        !dismissedCompatibilityWarning && (
          <WebGPUCompatibilityModal
            checkResult={webgpuCheck}
            onDismiss={() => setDismissedCompatibilityWarning(true)}
          />
        )}
    </div>
  );
}

export default App;
