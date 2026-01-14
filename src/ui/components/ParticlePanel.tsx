/**
 * Particle Panel Component
 * Controls for Particle-Lenia hybrid simulation
 */

import { useState, useCallback } from 'react';
import { ExpandablePanel, ToggleButton, RangeSlider, StatGrid } from './common';
import type {
  ParticleSystemState,
  ParticleSystemConfig,
  FieldCouplingConfig,
} from '../../core/particles';
import {
  INTERACTION_PRESETS,
  spawnRandomParticles,
  getActiveParticles,
  PARTICLE_COLORS,
} from '../../core/particles';

interface ParticlePanelProps {
  state: ParticleSystemState | null;
  onStateChange?: (state: ParticleSystemState) => void;
  onSpawnParticles?: (count: number, options?: {
    centerX?: number;
    centerY?: number;
    spread?: number;
  }) => void;
  onClearParticles?: () => void;
  onConfigChange?: (config: Partial<ParticleSystemConfig>) => void;
  onCouplingChange?: (coupling: Partial<FieldCouplingConfig>) => void;
  onInteractionPresetChange?: (preset: string) => void;
}

export function ParticlePanel({
  state,
  onStateChange,
  onSpawnParticles,
  onClearParticles,
  onConfigChange,
  onCouplingChange,
  onInteractionPresetChange,
}: ParticlePanelProps) {
  const [spawnCount, setSpawnCount] = useState(50);
  const [selectedPreset, setSelectedPreset] = useState('clustering');

  const activeParticles = state ? getActiveParticles(state) : [];
  const particleCount = activeParticles.length;

  // Count particles by type
  const typeCounts: number[] = [];
  if (state) {
    for (let i = 0; i < state.config.numTypes; i++) {
      typeCounts[i] = activeParticles.filter(p => p.type === i).length;
    }
  }

  const handleSpawn = useCallback(() => {
    if (onSpawnParticles) {
      onSpawnParticles(spawnCount);
    } else if (state && onStateChange) {
      spawnRandomParticles(state, spawnCount);
      onStateChange({ ...state });
    }
  }, [spawnCount, state, onSpawnParticles, onStateChange]);

  const handleClear = useCallback(() => {
    if (onClearParticles) {
      onClearParticles();
    } else if (state && onStateChange) {
      state.particles = [];
      onStateChange({ ...state });
    }
  }, [state, onClearParticles, onStateChange]);

  const handlePresetChange = useCallback((preset: string) => {
    setSelectedPreset(preset);
    if (onInteractionPresetChange) {
      onInteractionPresetChange(preset);
    } else if (state && onStateChange) {
      const presetFn = INTERACTION_PRESETS[preset as keyof typeof INTERACTION_PRESETS];
      if (presetFn) {
        state.interactionMatrix = presetFn(state.config.numTypes);
        onStateChange({ ...state });
      }
    }
  }, [state, onInteractionPresetChange, onStateChange]);

  const handleFrictionChange = useCallback((value: number) => {
    if (onConfigChange) {
      onConfigChange({ friction: value });
    } else if (state && onStateChange) {
      state.config.friction = value;
      onStateChange({ ...state });
    }
  }, [state, onConfigChange, onStateChange]);

  const handleDepositToggle = useCallback((enabled: boolean) => {
    if (onCouplingChange) {
      onCouplingChange({ depositEnabled: enabled });
    } else if (state && onStateChange) {
      state.fieldCoupling.depositEnabled = enabled;
      onStateChange({ ...state });
    }
  }, [state, onCouplingChange, onStateChange]);

  const handleDepositAmountChange = useCallback((value: number) => {
    if (onCouplingChange) {
      onCouplingChange({ depositAmount: value });
    } else if (state && onStateChange) {
      state.fieldCoupling.depositAmount = value;
      onStateChange({ ...state });
    }
  }, [state, onCouplingChange, onStateChange]);

  const handleGradientToggle = useCallback((enabled: boolean) => {
    if (onCouplingChange) {
      onCouplingChange({ gradientResponseEnabled: enabled });
    } else if (state && onStateChange) {
      state.fieldCoupling.gradientResponseEnabled = enabled;
      onStateChange({ ...state });
    }
  }, [state, onCouplingChange, onStateChange]);

  const handleGradientStrengthChange = useCallback((value: number) => {
    if (onCouplingChange) {
      onCouplingChange({ gradientStrength: value });
    } else if (state && onStateChange) {
      state.fieldCoupling.gradientStrength = value;
      onStateChange({ ...state });
    }
  }, [state, onCouplingChange, onStateChange]);

  if (!state) {
    return (
      <ExpandablePanel
        title="Particles"
        titleColor="text-orange-400"
        defaultExpanded={false}
      >
        <div className="text-center py-4">
          <p className="text-zinc-500 text-sm">Particle system not initialized</p>
        </div>
      </ExpandablePanel>
    );
  }

  const { config, fieldCoupling } = state;

  return (
    <ExpandablePanel
      title="Particles"
      titleColor="text-orange-400"
      statusBadge={particleCount > 0 ? { text: `${particleCount}`, color: 'bg-orange-900 text-orange-400' } : undefined}
      defaultExpanded={true}
    >
      <div className="space-y-4">
        {/* Stats */}
        <StatGrid
          stats={[
            { label: 'Particles', value: particleCount },
            { label: 'Types', value: config.numTypes },
            { label: 'Max', value: config.maxParticles },
          ]}
          columns={3}
        />

        {/* Type breakdown with colors */}
        {particleCount > 0 && (
          <div className="flex gap-2 flex-wrap">
            {typeCounts.map((count, type) => {
              const color = PARTICLE_COLORS[type % PARTICLE_COLORS.length];
              return (
                <div
                  key={type}
                  className="flex items-center gap-1 text-xs"
                >
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: `rgb(${color[0]}, ${color[1]}, ${color[2]})` }}
                  />
                  <span className="text-zinc-400">{count}</span>
                </div>
              );
            })}
          </div>
        )}

        {/* Spawn Controls */}
        <div className="space-y-2">
          <div className="text-sm text-zinc-400">Spawn Particles</div>
          <div className="flex gap-2">
            <input
              type="number"
              value={spawnCount}
              onChange={(e) => setSpawnCount(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-20 px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-sm"
              min={1}
              max={config.maxParticles - particleCount}
            />
            <button
              onClick={handleSpawn}
              disabled={particleCount >= config.maxParticles}
              className="flex-1 px-3 py-1 bg-orange-600 hover:bg-orange-500 disabled:opacity-50 rounded text-sm"
            >
              Spawn
            </button>
            <button
              onClick={handleClear}
              disabled={particleCount === 0}
              className="px-3 py-1 bg-zinc-700 hover:bg-zinc-600 disabled:opacity-50 rounded text-sm"
            >
              Clear
            </button>
          </div>
        </div>

        {/* Interaction Preset */}
        <div className="space-y-2">
          <label className="text-sm text-zinc-400">Interaction Preset</label>
          <select
            value={selectedPreset}
            onChange={(e) => handlePresetChange(e.target.value)}
            className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-sm"
          >
            <option value="attractive">Attractive - All attract</option>
            <option value="clustering">Clustering - Same types cluster</option>
            <option value="chain">Chain - A→B→C→A attraction</option>
            <option value="random">Random - Emergent behavior</option>
          </select>
        </div>

        {/* Physics Config */}
        <RangeSlider
          label="Friction"
          value={config.friction}
          min={0}
          max={0.2}
          step={0.01}
          onChange={handleFrictionChange}
          formatValue={(v) => v.toFixed(2)}
          accentColor="accent-orange-500"
        />

        {/* Field Coupling */}
        <div className="space-y-3 pt-2 border-t border-zinc-800">
          <div className="text-sm text-zinc-400">Field Coupling</div>

          <ToggleButton
            label="Deposit to Field"
            value={fieldCoupling.depositEnabled}
            onChange={handleDepositToggle}
            activeColor="bg-orange-600"
          />

          {fieldCoupling.depositEnabled && (
            <RangeSlider
              label="Deposit Amount"
              value={fieldCoupling.depositAmount}
              min={0}
              max={0.5}
              step={0.01}
              onChange={handleDepositAmountChange}
              formatValue={(v) => v.toFixed(2)}
              accentColor="accent-orange-500"
            />
          )}

          <ToggleButton
            label="Respond to Gradient"
            value={fieldCoupling.gradientResponseEnabled}
            onChange={handleGradientToggle}
            activeColor="bg-orange-600"
          />

          {fieldCoupling.gradientResponseEnabled && (
            <RangeSlider
              label="Gradient Strength"
              value={fieldCoupling.gradientStrength}
              min={0}
              max={2}
              step={0.1}
              onChange={handleGradientStrengthChange}
              formatValue={(v) => v.toFixed(1)}
              accentColor="accent-orange-500"
            />
          )}
        </div>

        {/* Info */}
        <div className="mt-4 p-3 bg-zinc-800 rounded text-xs text-zinc-500">
          <strong className="text-zinc-400">Particle-Lenia Hybrid:</strong>
          <span className="ml-2">Particles interact with each other and the Lenia field</span>
        </div>
      </div>
    </ExpandablePanel>
  );
}
