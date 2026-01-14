/**
 * Conservation Panel Component
 * Controls for Flow-Lenia mass conservation settings
 */

import { useState, useEffect, useCallback } from 'react';
import type { Engine } from '../../core/engine';
import type { ConservationConfig } from '../../core/conservation';
import { ToggleButton, RangeSlider } from './common';

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

  // Poll mass when conservation is enabled AND panel is expanded
  // This optimization prevents unnecessary polling when user isn't looking
  useEffect(() => {
    if (!engine || !config?.enabled || !isExpanded) {
      setMass(null);
      return;
    }

    // Initial fetch
    engine.getMass().then(setMass).catch(() => {});

    const interval = setInterval(async () => {
      try {
        const currentMass = await engine.getMass();
        setMass(currentMass);
      } catch {
        // Ignore errors during mass polling
      }
    }, 500);

    return () => clearInterval(interval);
  }, [engine, config?.enabled, isExpanded]);

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
          <ToggleButton
            label="Enable Conservation"
            value={config.enabled}
            onChange={(enabled) => updateConfig({ enabled })}
            activeColor="bg-cyan-600"
          />

          {/* Mass Display */}
          {config.enabled && mass !== null && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-zinc-400">Current Mass</span>
              <span className="font-mono text-cyan-400">{mass.toFixed(4)}</span>
            </div>
          )}

          {/* Flow Strength */}
          <RangeSlider
            label="Flow Strength"
            value={config.flowStrength}
            min={0}
            max={1}
            step={0.01}
            onChange={(flowStrength) => updateConfig({ flowStrength })}
            disabled={!config.enabled}
            description="How much growth gradient affects mass flow (0 = no flow, 1 = strong flow)"
            accentColor="accent-cyan-500"
          />

          {/* Diffusion */}
          <RangeSlider
            label="Diffusion"
            value={config.diffusion}
            min={0}
            max={0.1}
            step={0.001}
            onChange={(diffusion) => updateConfig({ diffusion })}
            disabled={!config.enabled}
            formatValue={(v) => v.toFixed(3)}
            description="Diffusion coefficient for smoothing (0 = none, 0.1 = high)"
            accentColor="accent-cyan-500"
          />

          {/* Reintegration Mode */}
          <ToggleButton
            label="Reintegration Mode"
            description="More stable mass tracking"
            value={config.useReintegration}
            onChange={(useReintegration) => updateConfig({ useReintegration })}
            disabled={!config.enabled}
            activeColor="bg-cyan-600"
          />

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
