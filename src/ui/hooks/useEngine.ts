/**
 * useEngine Hook
 * React hook for managing the GENESIS engine lifecycle
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { createEngine, type Engine } from '../../core/engine';
import { useSimulationStore } from '../stores/simulation-store';
import type { GridConfig, DiscreteRule } from '../../core/types';

interface UseEngineOptions {
  gridConfig?: GridConfig;
  autoStart?: boolean;
}

interface UseEngineResult {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  engine: Engine | null;
  error: Error | null;
  isLoading: boolean;
}

export function useEngine(options: UseEngineOptions = {}): UseEngineResult {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<Engine | null>(null);
  const [engine, setEngine] = useState<Engine | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const { setRunning, setStep, setFps } = useSimulationStore();

  // Initialize engine
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let mounted = true;

    async function init() {
      try {
        setIsLoading(true);
        setError(null);

        const engine = await createEngine({
          canvas,
          gridConfig: options.gridConfig,
          paradigm: 'discrete',
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
        if (mounted) {
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
    };
  }, [options.gridConfig, options.autoStart, setRunning]);

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
  };
}

/**
 * Hook for engine controls
 */
export function useEngineControls(engine: Engine | null) {
  const start = useCallback(() => engine?.start(), [engine]);
  const stop = useCallback(() => engine?.stop(), [engine]);
  const toggle = useCallback(() => engine?.toggle(), [engine]);
  const stepOnce = useCallback(() => engine?.stepOnce(), [engine]);
  const reset = useCallback(
    (pattern?: 'glider' | 'blinker' | 'random' | 'center-blob') => engine?.reset(pattern),
    [engine]
  );
  const setRule = useCallback(
    (rule: DiscreteRule) => engine?.setRule(rule),
    [engine]
  );

  return { start, stop, toggle, stepOnce, reset, setRule };
}
