/**
 * Conservation Panel Component
 * Controls for Flow-Lenia mass conservation settings
 */

import { useState, useEffect, useCallback } from 'react';
import type { Engine } from '../../core/engine';
import type { ConservationConfig } from '../../core/conservation';

interface ConservationPanelProps {
  engine: Engine | null;
}

export function ConservationPanel({ engine }: ConservationPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [config, setConfig] = useState<ConservationConfig | null>(null);
  const [mass, setMass] = useState<number | null>(null);

  // Load initial config when engine is available
  useEffect(() => {
    if (engine) {
      setConfig(engine.getConservationConfig());
    }
  }, [engine]);

  // Poll mass when conservation is enabled
  useEffect(() => {
    if (!engine || !config?.enabled) {
      setMass(null);
      return;
    }

    const interval = setInterval(async () => {
      try {
        const currentMass = await engine.getMass();
        setMass(currentMass);
      } catch {
        // Ignore errors during mass polling
      }
    }, 500);

    return () => clearInterval(interval);
  }, [engine, config?.enabled]);

  const updateConfig = useCallback((updates: Partial<ConservationConfig>) => {
    if (engine && config) {
      const newConfig = { ...config, ...updates };
      engine.setConservationConfig(updates);
      setConfig(newConfig);
    }
  }, [engine, config]);

  if (!engine) return null;

  return (
    <div className="mt-4 p-4 bg-zinc-900 rounded-lg border border-zinc-800">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between text-left"
      >
        <h3 className="font-medium text-cyan-400">Mass Conservation</h3>
        <span className="text-zinc-500">{isExpanded ? '−' : '+'}</span>
      </button>

      {isExpanded && config && (
        <div className="mt-4 space-y-4">
          {/* Description */}
          <p className="text-xs text-zinc-500">
            Flow-Lenia style mass conservation. Enables advection dynamics
            where mass flows toward regions of higher growth potential.
          </p>

          {/* Enable Toggle */}
          <div className="flex items-center justify-between">
            <label className="text-sm text-zinc-400">Enable Conservation</label>
            <button
              onClick={() => updateConfig({ enabled: !config.enabled })}
              className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                config.enabled
                  ? 'bg-cyan-600 text-white'
                  : 'bg-zinc-700 text-zinc-400'
              }`}
            >
              {config.enabled ? 'ON' : 'OFF'}
            </button>
          </div>

          {/* Mass Display */}
          {config.enabled && mass !== null && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-zinc-400">Current Mass</span>
              <span className="font-mono text-cyan-400">{mass.toFixed(4)}</span>
            </div>
          )}

          {/* Flow Strength */}
          <div className="space-y-1">
            <div className="flex justify-between text-sm">
              <label className="text-zinc-400">Flow Strength</label>
              <span className="font-mono text-zinc-500">{config.flowStrength.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={config.flowStrength}
              onChange={(e) => updateConfig({ flowStrength: parseFloat(e.target.value) })}
              disabled={!config.enabled}
              className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-cyan-500 disabled:opacity-50"
            />
            <p className="text-xs text-zinc-600">
              How much growth gradient affects mass flow (0 = no flow, 1 = strong flow)
            </p>
          </div>

          {/* Diffusion */}
          <div className="space-y-1">
            <div className="flex justify-between text-sm">
              <label className="text-zinc-400">Diffusion</label>
              <span className="font-mono text-zinc-500">{config.diffusion.toFixed(3)}</span>
            </div>
            <input
              type="range"
              min="0"
              max="0.1"
              step="0.001"
              value={config.diffusion}
              onChange={(e) => updateConfig({ diffusion: parseFloat(e.target.value) })}
              disabled={!config.enabled}
              className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-cyan-500 disabled:opacity-50"
            />
            <p className="text-xs text-zinc-600">
              Diffusion coefficient for smoothing (0 = none, 0.1 = high)
            </p>
          </div>

          {/* Reintegration Mode */}
          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm text-zinc-400">Reintegration Mode</label>
              <p className="text-xs text-zinc-600">More stable mass tracking</p>
            </div>
            <button
              onClick={() => updateConfig({ useReintegration: !config.useReintegration })}
              disabled={!config.enabled}
              className={`px-3 py-1 rounded text-sm font-medium transition-colors disabled:opacity-50 ${
                config.useReintegration
                  ? 'bg-cyan-600 text-white'
                  : 'bg-zinc-700 text-zinc-400'
              }`}
            >
              {config.useReintegration ? 'ON' : 'OFF'}
            </button>
          </div>

          {/* Info */}
          <div className="mt-4 p-3 bg-zinc-800 rounded text-xs text-zinc-500">
            <strong className="text-zinc-400">Note:</strong> Conservation is most effective
            with continuous CA (Lenia). The flow field redistributes mass toward regions
            of higher growth potential, creating more realistic dynamics.
          </div>
        </div>
      )}
    </div>
  );
}
