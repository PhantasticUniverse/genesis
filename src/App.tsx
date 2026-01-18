/**
 * GENESIS - Artificial Life Observatory
 * Bioluminescent Observatory Theme
 */

import { useState, useEffect, useCallback, useMemo } from "react";
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
import { PresetBrowser } from "./ui/components/PresetBrowser";
import { usePresetStore } from "./ui/stores/preset-store";
import type { PresetData } from "./patterns/registry/preset-types";
import {
  WebGPUCompatibilityModal,
  useWebGPUCheck,
} from "./ui/components/WebGPUCheck";
import { PerformanceMonitor } from "./ui/components/PerformanceMonitor";
import {
  AppErrorBoundary,
  PanelErrorBoundary,
} from "./ui/components/ErrorBoundary";
import { createGAController } from "./discovery/genetic-algorithm";
import { useEngine } from "./ui/hooks/useEngine";
import { useEngine3D } from "./ui/hooks/useEngine3D";
import { DEFAULT_GRID_CONFIG } from "./core/types";
import { genomeToParams, type LeniaGenome } from "./discovery/genome";

type SimulationMode = "2d" | "3d";

/** Animated title with staggered letter reveal */
function GenesisTitle() {
  const letters = "GENESIS".split("");
  return (
    <h1 className="genesis-title">
      {letters.map((letter, i) => (
        <span
          key={i}
          className="genesis-title-letter"
          style={{ animationDelay: `${i * 80}ms` }}
        >
          {letter}
        </span>
      ))}
    </h1>
  );
}

/** Ambient background orbs for depth effect */
function AmbientOrbs() {
  return (
    <>
      <div
        className="ambient-orb cyan"
        style={{
          width: "400px",
          height: "400px",
          top: "10%",
          left: "-5%",
          animationDelay: "0s",
        }}
      />
      <div
        className="ambient-orb magenta"
        style={{
          width: "300px",
          height: "300px",
          top: "60%",
          right: "-10%",
          animationDelay: "-8s",
        }}
      />
      <div
        className="ambient-orb amber"
        style={{
          width: "250px",
          height: "250px",
          bottom: "5%",
          left: "30%",
          animationDelay: "-15s",
        }}
      />
    </>
  );
}

function App() {
  // WebGPU compatibility check
  const { result: webgpuCheck, checking: webgpuChecking } = useWebGPUCheck();
  const [dismissedCompatibilityWarning, setDismissedCompatibilityWarning] =
    useState(false);

  // Simulation mode (2D or 3D)
  const [mode, setMode] = useState<SimulationMode>("2d");

  // 2D Engine (with CPU fallback)
  const { canvasRef, engine, error, isLoading, isCPUMode } = useEngine({
    gridConfig: DEFAULT_GRID_CONFIG,
    autoStart: false,
    allowCPUFallback: true,
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

  // Get preset store for addToRecent
  const { addToRecent } = usePresetStore();

  // Check if engine supports WebGPU features (not CPU fallback)
  const isWebGPUEngine = useMemo(() => {
    return engine && "enableSensorimotor" in engine;
  }, [engine]);

  // Handle loading presets from PresetBrowser
  const handleLoadPreset = useCallback(
    (preset: PresetData) => {
      if (!engine) return;

      if (preset.config.type === "sensorimotor") {
        // Sensorimotor only works with WebGPU engine
        if (!isWebGPUEngine) {
          console.warn(
            "Sensorimotor mode requires WebGPU - not available in CPU mode",
          );
          return;
        }
        const gpuEngine = engine as typeof engine & {
          enableSensorimotor: () => void;
          setSensorimotorParams: (params: unknown) => void;
          setObstacles: (pattern: unknown) => void;
          setTargetGradient: (
            x: number,
            y: number,
            radius?: number,
            strength?: number,
          ) => void;
        };
        gpuEngine.enableSensorimotor();
        if (preset.config.params) {
          gpuEngine.setSensorimotorParams(preset.config.params);
        }
        if (preset.config.obstacles?.pattern) {
          gpuEngine.setObstacles(preset.config.obstacles.pattern);
        }
        if (preset.config.gradient) {
          gpuEngine.setTargetGradient(
            preset.config.gradient.x,
            preset.config.gradient.y,
            preset.config.gradient.radius,
            preset.config.gradient.strength,
          );
        }
        engine.reset("lenia-seed");
      } else if (preset.config.type === "continuous") {
        engine.setParadigm("continuous");
        if (preset.config.params) {
          engine.setContinuousParams(preset.config.params);
        }
        engine.reset("lenia-seed");
      } else if (preset.config.type === "discrete") {
        engine.setParadigm("discrete");
        if (preset.config.rule) {
          engine.setRule(preset.config.rule);
        }
        engine.reset();
      } else if (preset.config.type === "multikernel") {
        // Multi-kernel only works with WebGPU engine
        if (!isWebGPUEngine) {
          console.warn(
            "Multi-kernel mode requires WebGPU - not available in CPU mode",
          );
          return;
        }
        const gpuEngine = engine as typeof engine & {
          enableMultiKernel: (config: unknown) => void;
        };
        if (preset.config.config) {
          gpuEngine.enableMultiKernel(preset.config.config);
        }
        engine.reset("lenia-seed");
      }

      addToRecent(preset.metadata.id);
    },
    [engine, isWebGPUEngine, addToRecent],
  );

  // Check if sensorimotor mode is active (only available on WebGPU engine)
  const isSensorimotorActive = useMemo(() => {
    if (!engine || !("isSensorimotorEnabled" in engine)) return false;
    return engine.isSensorimotorEnabled();
  }, [engine]);

  // Handle canvas click for setting target gradient in sensorimotor mode
  const handleCanvasClick = useCallback(
    (normalizedX: number, normalizedY: number) => {
      if (!engine || !isSensorimotorActive || !isWebGPUEngine) return;

      const gpuEngine = engine as typeof engine & {
        setTargetGradient: (
          x: number,
          y: number,
          radius?: number,
          strength?: number,
        ) => void;
      };
      const gridConfig = engine.getGridConfig();
      const gridX = Math.floor(normalizedX * gridConfig.width);
      const gridY = Math.floor(normalizedY * gridConfig.height);

      gpuEngine.setTargetGradient(gridX, gridY, 50, 1.0);
    },
    [engine, isSensorimotorActive, isWebGPUEngine],
  );

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
  const _activeEngine = mode === "2d" ? engine : null; // Used for future features
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

  // Check if simulation is running for visual effects
  const isRunning = mode === "2d" ? engine?.running : engine3D?.running;

  return (
    <div className="min-h-screen bg-genesis-abyss text-white p-6 md:p-8 relative overflow-hidden">
      {/* Ambient Background Orbs */}
      <AmbientOrbs />

      {/* Floating Performance Monitor */}
      <PerformanceMonitor engine={currentEngineForMonitor} floating />

      <div className="max-w-5xl mx-auto relative z-10">
        {/* Header */}
        <header className="mb-8 animate-fade-in-up">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <div className="flex items-center gap-4">
                <GenesisTitle />
                {isCPUMode && mode === "2d" && (
                  <span className="badge-glow amber">
                    <span
                      className="status-dot"
                      style={{
                        background: "var(--bio-amber)",
                        width: "6px",
                        height: "6px",
                      }}
                    />
                    CPU Mode
                  </span>
                )}
              </div>
              <p className="genesis-subtitle mt-2">
                Artificial Life Observatory
              </p>
            </div>

            {/* 2D/3D Mode Toggle */}
            <div className="flex items-center gap-1 bg-glass rounded-lg p-1">
              <button
                onClick={() => handleModeSwitch("2d")}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-all duration-300 ${
                  mode === "2d"
                    ? "bg-gradient-to-r from-cyan-600 to-teal-600 text-white glow-cyan-subtle"
                    : "text-zinc-400 hover:text-bio-cyan hover:bg-genesis-surface"
                }`}
              >
                2D
              </button>
              <button
                onClick={() => handleModeSwitch("3d")}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-all duration-300 ${
                  mode === "3d"
                    ? "bg-gradient-to-r from-purple-600 to-fuchsia-600 text-white glow-magenta-subtle"
                    : "text-zinc-400 hover:text-bio-magenta hover:bg-genesis-surface"
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
        <div className="flex flex-col lg:flex-row gap-6 animate-fade-in-up animate-delay-200">
          {/* Canvas */}
          <div className="flex-shrink-0">
            {/* 2D Canvas */}
            <Canvas
              ref={canvasRef}
              width={DEFAULT_GRID_CONFIG.width}
              height={DEFAULT_GRID_CONFIG.height}
              className={`w-full max-w-[512px] aspect-square ${mode !== "2d" ? "hidden" : ""}`}
              isRunning={mode === "2d" && !!engine?.running}
              onCanvasClick={
                isSensorimotorActive ? handleCanvasClick : undefined
              }
            />
            {/* 3D Canvas */}
            <Canvas
              ref={canvas3DRef}
              width={512}
              height={512}
              className={`w-full max-w-[512px] aspect-square ${mode !== "3d" ? "hidden" : ""}`}
              isRunning={mode === "3d" && !!engine3D?.running}
            />
          </div>

          {/* Controls */}
          <div className="flex-1">
            {/* Mode-specific controls */}
            {mode === "2d" ? (
              <>
                <PanelErrorBoundary panelName="Controls">
                  <Controls engine={engine} />
                </PanelErrorBoundary>

                {/* Preset Browser */}
                <PanelErrorBoundary panelName="Preset Browser">
                  <PresetBrowser onLoadPreset={handleLoadPreset} />
                </PanelErrorBoundary>

                {/* Info Panel */}
                <div className="mt-6 p-4 glass-panel">
                  <h3 className="font-medium text-bio-cyan mb-2 font-display text-sm tracking-wide">
                    About
                  </h3>
                  <p className="text-sm text-zinc-400 leading-relaxed">
                    GENESIS is a next-generation cellular automata platform
                    powered by WebGPU. Features{" "}
                    <span className="text-bio-green">Discrete CA</span>,{" "}
                    <span className="text-bio-magenta">Continuous CA</span>{" "}
                    (Lenia),{" "}
                    <span className="text-bio-amber">Neural CA Training</span>,{" "}
                    <span className="text-bio-cyan">Multi-Species Ecology</span>
                    , and{" "}
                    <span className="text-bio-magenta">Pattern Discovery</span>.
                  </p>
                </div>

                {/* Discovery Panel */}
                <PanelErrorBoundary panelName="Discovery">
                  <DiscoveryPanel
                    engine={engine}
                    gaController={gaController}
                    onSelectOrganism={handleSelectOrganism}
                  />
                </PanelErrorBoundary>

                {/* Phylogeny Panel */}
                <PanelErrorBoundary panelName="Phylogeny">
                  <PhylogenyPanel
                    gaController={gaController}
                    onSelectOrganism={handleSelectOrganism}
                  />
                </PanelErrorBoundary>

                {/* Agency Panel */}
                <PanelErrorBoundary panelName="Agency">
                  <AgencyPanel engine={engine} />
                </PanelErrorBoundary>

                {/* Training Panel */}
                <PanelErrorBoundary panelName="Training">
                  <TrainingPanel engine={engine} />
                </PanelErrorBoundary>

                {/* Conservation Panel */}
                <PanelErrorBoundary panelName="Conservation">
                  <ConservationPanel engine={engine} />
                </PanelErrorBoundary>

                {/* Ecology Panel */}
                <PanelErrorBoundary panelName="Ecology">
                  <EcologyPanel engine={engine} />
                </PanelErrorBoundary>

                {/* Save/Load Panel */}
                <PanelErrorBoundary panelName="Save/Load">
                  <SaveLoadPanel
                    engine={engine}
                    currentGenome={currentGenome}
                    onLoadGenome={handleLoadGenome}
                  />
                </PanelErrorBoundary>
              </>
            ) : (
              <>
                {/* 3D Lenia Panel */}
                <PanelErrorBoundary panelName="3D Lenia">
                  <Lenia3DPanel engine={engine3D} onInit={initialize3D} />
                </PanelErrorBoundary>

                {/* 3D Info Panel */}
                <div className="mt-6 p-4 glass-panel">
                  <h3 className="font-medium text-bio-magenta mb-2 font-display text-sm tracking-wide">
                    3D Lenia
                  </h3>
                  <p className="text-sm text-zinc-400 leading-relaxed">
                    Explore volumetric cellular automata in 3D space. Use the{" "}
                    <span className="text-bio-magenta">slice viewer</span> to
                    see cross-sections through the simulation, or select
                    different{" "}
                    <span className="text-bio-cyan">organism presets</span> to
                    observe different behaviors.
                  </p>
                </div>
              </>
            )}

            {/* Keyboard Shortcuts */}
            <div className="mt-6 p-4 glass-panel">
              <p className="font-display text-xs text-bio-cyan tracking-wide mb-3">
                Keyboard Shortcuts
              </p>
              <div className="flex flex-wrap gap-4 text-xs">
                <div className="flex items-center gap-2">
                  <kbd className="px-2 py-1 bg-genesis-surface border border-[rgba(0,245,255,0.2)] rounded font-mono text-bio-cyan">
                    Space
                  </kbd>
                  <span className="text-zinc-400">Toggle</span>
                </div>
                <div className="flex items-center gap-2">
                  <kbd className="px-2 py-1 bg-genesis-surface border border-[rgba(0,245,255,0.2)] rounded font-mono text-bio-cyan">
                    S
                  </kbd>
                  <span className="text-zinc-400">Step</span>
                </div>
                <div className="flex items-center gap-2">
                  <kbd className="px-2 py-1 bg-genesis-surface border border-[rgba(0,245,255,0.2)] rounded font-mono text-bio-cyan">
                    R
                  </kbd>
                  <span className="text-zinc-400">Reset</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="mt-12 text-center animate-fade-in-up animate-delay-500">
          <p className="text-xs text-zinc-600 tracking-wider">
            Built with <span className="text-bio-cyan">WebGPU</span> +{" "}
            <span className="text-bio-magenta">React</span> +{" "}
            <span className="text-bio-green">TypeScript</span>
          </p>
        </footer>
      </div>

      {/* WebGPU Compatibility Modal - only show if not in CPU fallback mode */}
      {!webgpuChecking &&
        webgpuCheck &&
        !webgpuCheck.available &&
        !isCPUMode &&
        !dismissedCompatibilityWarning && (
          <WebGPUCompatibilityModal
            checkResult={webgpuCheck}
            onDismiss={() => setDismissedCompatibilityWarning(true)}
            isCPUFallback={false}
          />
        )}
    </div>
  );
}

// Wrap App with top-level error boundary
function AppWithErrorBoundary() {
  return (
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  );
}

export default AppWithErrorBoundary;
