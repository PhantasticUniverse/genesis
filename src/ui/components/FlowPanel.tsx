/**
 * Flow-Lenia Panel Component
 * Controls for Flow-Lenia simulation parameters
 */

import { useCallback } from 'react';
import { ExpandablePanel, ToggleButton, RangeSlider, StatGrid } from './common';
import type { FlowLeniaConfig } from '../../compute/webgpu/flow-lenia-pipeline';

interface FlowPanelProps {
  config: FlowLeniaConfig;
  enabled: boolean;
  mass?: number;
  initialMass?: number;
  onConfigChange: (config: Partial<FlowLeniaConfig>) => void;
  onEnabledChange: (enabled: boolean) => void;
}

export function FlowPanel({
  config,
  enabled,
  mass,
  initialMass,
  onConfigChange,
  onEnabledChange,
}: FlowPanelProps) {
  const handleFlowStrengthChange = useCallback((value: number) => {
    onConfigChange({ flowStrength: value });
  }, [onConfigChange]);

  const handleDiffusionChange = useCallback((value: number) => {
    onConfigChange({ diffusion: value });
  }, [onConfigChange]);

  const handleReintegrationToggle = useCallback((value: boolean) => {
    onConfigChange({ useReintegration: value });
  }, [onConfigChange]);

  const handleGrowthTypeChange = useCallback((type: number) => {
    onConfigChange({ growthType: type });
  }, [onConfigChange]);

  // Calculate mass conservation percentage
  const massConservation = mass !== undefined && initialMass !== undefined && initialMass > 0
    ? ((mass / initialMass) * 100).toFixed(1)
    : '--';

  const massStatus = mass !== undefined && initialMass !== undefined
    ? Math.abs(mass - initialMass) / initialMass < 0.01 ? 'text-green-400' : 'text-yellow-400'
    : 'text-zinc-400';

  return (
    <ExpandablePanel
      title="Flow-Lenia"
      titleColor="text-teal-400"
      statusBadge={enabled ? { text: 'Active', color: 'bg-teal-900 text-teal-400' } : undefined}
      defaultExpanded={false}
    >
      <div className="space-y-4">
        {/* Enable/Disable */}
        <ToggleButton
          label="Enable Flow Mode"
          value={enabled}
          onChange={onEnabledChange}
          activeColor="bg-teal-600"
        />

        {enabled && (
          <>
            {/* Mass Conservation Stats */}
            <StatGrid
              stats={[
                { label: 'Current Mass', value: mass?.toFixed(1) ?? '--' },
                { label: 'Initial Mass', value: initialMass?.toFixed(1) ?? '--' },
                { label: 'Conservation', value: `${massConservation}%`, color: massStatus },
              ]}
              columns={3}
            />

            {/* Flow Parameters */}
            <div className="space-y-3 pt-2 border-t border-zinc-800">
              <div className="text-sm text-zinc-400">Flow Parameters</div>

              <RangeSlider
                label="Flow Strength"
                value={config.flowStrength}
                min={0}
                max={2}
                step={0.1}
                onChange={handleFlowStrengthChange}
                formatValue={(v) => v.toFixed(1)}
                accentColor="accent-teal-500"
              />

              <RangeSlider
                label="Diffusion"
                value={config.diffusion}
                min={0}
                max={0.1}
                step={0.005}
                onChange={handleDiffusionChange}
                formatValue={(v) => v.toFixed(3)}
                accentColor="accent-teal-500"
              />
            </div>

            {/* Advanced Options */}
            <div className="space-y-3 pt-2 border-t border-zinc-800">
              <div className="text-sm text-zinc-400">Advanced</div>

              <ToggleButton
                label="Reintegration Method"
                value={config.useReintegration}
                onChange={handleReintegrationToggle}
                activeColor="bg-teal-600"
              />
              <p className="text-xs text-zinc-600 mt-1">
                Better mass conservation via explicit flux tracking
              </p>

              <div className="space-y-2">
                <label className="text-sm text-zinc-400">Growth Function</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleGrowthTypeChange(0)}
                    className={`flex-1 px-3 py-1.5 rounded text-sm ${
                      config.growthType === 0
                        ? 'bg-teal-600 text-white'
                        : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                    }`}
                  >
                    Polynomial
                  </button>
                  <button
                    onClick={() => handleGrowthTypeChange(1)}
                    className={`flex-1 px-3 py-1.5 rounded text-sm ${
                      config.growthType === 1
                        ? 'bg-teal-600 text-white'
                        : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                    }`}
                  >
                    Gaussian
                  </button>
                </div>
              </div>
            </div>

            {/* Info */}
            <div className="mt-4 p-3 bg-zinc-800 rounded text-xs text-zinc-500">
              <strong className="text-zinc-400">Flow-Lenia:</strong>
              <span className="ml-2">
                Mass flows toward regions of higher growth potential.
                Divergence form ensures mass conservation.
              </span>
            </div>
          </>
        )}
      </div>
    </ExpandablePanel>
  );
}
