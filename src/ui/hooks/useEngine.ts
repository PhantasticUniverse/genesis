/**
 * useEngine Hook
 * React hook for managing the GENESIS engine lifecycle
 * Includes CPU fallback when WebGPU is unavailable
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { createEngine, type Engine } from "../../core/engine";
import { createCPUEngine, type CPUEngine } from "../../core/cpu-engine";
import { createCanvas2DRenderer } from "../../render/canvas2d-renderer";
import { useSimulationStore } from "../stores/simulation-store";
import type { GridConfig, DiscreteRule } from "../../core/types";

/** Combined engine type for both WebGPU and CPU fallback */
export type AnyEngine = Engine | CPUEngine;

interface UseEngineOptions {
  gridConfig?: GridConfig;
  autoStart?: boolean;
  /** Allow CPU fallback when WebGPU is unavailable (default: true) */
  allowCPUFallback?: boolean;
}

interface UseEngineResult {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  engine: AnyEngine | null;
  error: Error | null;
  isLoading: boolean;
  /** True if running in CPU fallback mode */
  isCPUMode: boolean;
}

/** Type guard to check if engine is CPU fallback */
export function isCPUEngine(engine: AnyEngine | null): engine is CPUEngine {
  return engine !== null && "isCPUFallback" in engine && engine.isCPUFallback;
}

export function useEngine(options: UseEngineOptions = {}): UseEngineResult {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<AnyEngine | null>(null);
  const rendererRef = useRef<ReturnType<typeof createCanvas2DRenderer> | null>(
    null,
  );
  const [engine, setEngine] = useState<AnyEngine | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCPUMode, setIsCPUMode] = useState(false);

  const { setRunning, setStep, setFps } = useSimulationStore();
  const allowCPUFallback = options.allowCPUFallback ?? true;

  // Initialize engine
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let mounted = true;

    async function init() {
      try {
        setIsLoading(true);
        setError(null);
        setIsCPUMode(false);

        // Try WebGPU first
        const engine = await createEngine({
          canvas,
          gridConfig: options.gridConfig,
          paradigm: "discrete",
        });

        if (!mounted) {
          engine.destroy();
          return;
        }

        engineRef.current = engine;
        setEngine(engine);
        setIsLoading(false);

        if (options.autoStart) {
          engine.start();
          setRunning(true);
        }
      } catch (err) {
        // WebGPU failed - try CPU fallback
        if (mounted && allowCPUFallback) {
          console.warn("WebGPU unavailable, using CPU fallback:", err);

          try {
            const gridConfig = options.gridConfig ?? {
              width: 512,
              height: 512,
              channels: 1,
              precision: "f32" as const,
            };

            // Create CPU engine
            const cpuEngine = createCPUEngine({
              canvas,
              gridConfig,
              paradigm: "continuous",
            });

            // Create Canvas 2D renderer
            const renderer = createCanvas2DRenderer(canvas, {
              width: gridConfig.width,
              height: gridConfig.height,
              colormap: "viridis",
            });
            rendererRef.current = renderer;

            // Connect CPU engine to renderer
            cpuEngine.onRender((state) => {
              renderer.render(state);
            });

            if (!mounted) {
              cpuEngine.destroy();
              renderer.destroy();
              return;
            }

            engineRef.current = cpuEngine;
            setEngine(cpuEngine);
            setIsCPUMode(true);
            setIsLoading(false);

            if (options.autoStart) {
              cpuEngine.start();
              setRunning(true);
            }
          } catch (cpuErr) {
            if (mounted) {
              setError(
                cpuErr instanceof Error ? cpuErr : new Error(String(cpuErr)),
              );
              setIsLoading(false);
            }
          }
        } else if (mounted) {
          setError(err instanceof Error ? err : new Error(String(err)));
          setIsLoading(false);
        }
      }
    }

    init();

    return () => {
      mounted = false;
      if (engineRef.current) {
        engineRef.current.destroy();
        engineRef.current = null;
        setEngine(null);
      }
      if (rendererRef.current) {
        rendererRef.current.destroy();
        rendererRef.current = null;
      }
    };
  }, [options.gridConfig, options.autoStart, setRunning, allowCPUFallback]);

  // Sync engine state with store
  useEffect(() => {
    if (!engine) return;

    const interval = setInterval(() => {
      if (engine) {
        setStep(engine.step);
        setFps(engine.fps);
        setRunning(engine.running);
      }
    }, 100);

    return () => clearInterval(interval);
  }, [engine, setStep, setFps, setRunning]);

  return {
    canvasRef,
    engine,
    error,
    isLoading,
    isCPUMode,
  };
}

/**
 * Hook for engine controls
 * Works with both WebGPU and CPU engines
 */
export function useEngineControls(engine: AnyEngine | null) {
  const start = useCallback(() => engine?.start(), [engine]);
  const stop = useCallback(() => engine?.stop(), [engine]);
  const toggle = useCallback(() => engine?.toggle(), [engine]);
  const stepOnce = useCallback(() => engine?.stepOnce(), [engine]);
  const reset = useCallback(
    (
      pattern?: "glider" | "blinker" | "random" | "center-blob" | "lenia-seed",
    ) => engine?.reset(pattern),
    [engine],
  );
  const setRule = useCallback(
    (rule: DiscreteRule) => engine?.setRule(rule),
    [engine],
  );

  return { start, stop, toggle, stepOnce, reset, setRule };
}
