/**
 * useEngine3D Hook
 * React hook for managing the GENESIS 3D engine lifecycle
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { createEngine3D, type Engine3D } from "../../core/engine-3d";
import type { Grid3DConfig } from "../../core/types-3d";
import { DEFAULT_GRID_3D_CONFIG } from "../../core/types-3d";

interface UseEngine3DOptions {
  gridConfig?: Grid3DConfig;
  autoStart?: boolean;
}

interface UseEngine3DResult {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  engine: Engine3D | null;
  error: Error | null;
  isLoading: boolean;
  initialize: () => Promise<void>;
}

export function useEngine3D(
  options: UseEngine3DOptions = {},
): UseEngine3DResult {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<Engine3D | null>(null);
  const [engine, setEngine] = useState<Engine3D | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const initializingRef = useRef(false);

  const initialize = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas || initializingRef.current || engineRef.current) return;

    initializingRef.current = true;

    try {
      setIsLoading(true);
      setError(null);

      const engine3D = await createEngine3D({
        canvas,
        gridConfig: options.gridConfig ?? DEFAULT_GRID_3D_CONFIG,
      });

      engineRef.current = engine3D;
      setEngine(engine3D);
      setIsLoading(false);

      if (options.autoStart) {
        engine3D.start();
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
      setIsLoading(false);
    } finally {
      initializingRef.current = false;
    }
  }, [options.gridConfig, options.autoStart]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (engineRef.current) {
        engineRef.current.destroy();
        engineRef.current = null;
        setEngine(null);
      }
    };
  }, []);

  return {
    canvasRef,
    engine,
    error,
    isLoading,
    initialize,
  };
}

/**
 * Hook for 3D engine controls
 */
export function useEngine3DControls(engine: Engine3D | null) {
  const start = useCallback(() => engine?.start(), [engine]);
  const stop = useCallback(() => engine?.stop(), [engine]);
  const toggle = useCallback(() => engine?.toggle(), [engine]);
  const stepOnce = useCallback(() => engine?.stepOnce(), [engine]);
  const reset = useCallback(
    (presetName?: string) => engine?.reset(presetName),
    [engine],
  );
  const loadPreset = useCallback(
    (presetName: string) => engine?.loadPreset(presetName),
    [engine],
  );

  return { start, stop, toggle, stepOnce, reset, loadPreset };
}
