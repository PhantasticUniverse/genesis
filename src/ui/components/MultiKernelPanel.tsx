/**
 * Multi-Kernel Panel Component
 * Controls for Multi-Kernel Lenia simulation
 */

import { useState, useCallback } from "react";
import { ExpandablePanel, ToggleButton, RangeSlider, StatGrid } from "./common";
import type {
  MultiKernelConfig,
  SingleKernelParams,
  GrowthParams,
  KernelShape,
  GrowthFunction,
  KernelCombinationMode,
} from "../../core/types";
import { MULTIKERNEL_PRESETS } from "../../core/multi-kernel";

interface MultiKernelPanelProps {
  enabled: boolean;
  config: MultiKernelConfig | null;
  onEnable: (config?: MultiKernelConfig) => void;
  onDisable: () => void;
  onConfigChange: (config: MultiKernelConfig) => void;
  onKernelUpdate: (index: number, params: Partial<SingleKernelParams>) => void;
  onGrowthUpdate: (index: number, params: Partial<GrowthParams>) => void;
  onAddKernel: (params?: SingleKernelParams, growth?: GrowthParams) => void;
  onRemoveKernel: (index: number) => void;
  onPresetSelect: (name: string) => void;
}

const KERNEL_SHAPES: KernelShape[] = [
  "polynomial",
  "gaussian",
  "ring",
  "step",
  "custom",
];

const GROWTH_TYPES: GrowthFunction[] = ["polynomial", "gaussian", "step"];

const COMBINATION_MODES: KernelCombinationMode[] = [
  "sum",
  "average",
  "weighted",
];

interface KernelCardProps {
  index: number;
  kernel: SingleKernelParams;
  growth: GrowthParams;
  canRemove: boolean;
  onKernelChange: (params: Partial<SingleKernelParams>) => void;
  onGrowthChange: (params: Partial<GrowthParams>) => void;
  onRemove: () => void;
}

function KernelCard({
  index,
  kernel,
  growth,
  canRemove,
  onKernelChange,
  onGrowthChange,
  onRemove,
}: KernelCardProps) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="border border-gray-700 rounded-lg p-3 mb-3 bg-gray-800/50">
      <div className="flex items-center justify-between mb-2">
        <button
          className="flex items-center gap-2 text-sm font-medium text-gray-200"
          onClick={() => setExpanded(!expanded)}
        >
          <span
            className={`transform transition-transform ${expanded ? "rotate-90" : ""}`}
          >
            &#9654;
          </span>
          Kernel {index + 1}
        </button>
        {canRemove && (
          <button
            className="text-red-400 hover:text-red-300 text-sm px-2"
            onClick={onRemove}
          >
            Remove
          </button>
        )}
      </div>

      {expanded && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-gray-400">Shape</label>
              <select
                className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm"
                value={kernel.shape}
                onChange={(e) =>
                  onKernelChange({ shape: e.target.value as KernelShape })
                }
              >
                {KERNEL_SHAPES.map((shape) => (
                  <option key={shape} value={shape}>
                    {shape.charAt(0).toUpperCase() + shape.slice(1)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-400">Growth Type</label>
              <select
                className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm"
                value={growth.type}
                onChange={(e) =>
                  onGrowthChange({ type: e.target.value as GrowthFunction })
                }
              >
                {GROWTH_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <RangeSlider
            label="Radius (R)"
            value={kernel.radius}
            min={5}
            max={30}
            step={1}
            onChange={(value) => onKernelChange({ radius: value })}
            formatValue={(v) => v.toString()}
          />

          <RangeSlider
            label="Weight (h)"
            value={kernel.weight}
            min={0}
            max={1.5}
            step={0.05}
            onChange={(value) => onKernelChange({ weight: value })}
            formatValue={(v) => v.toFixed(2)}
          />

          <RangeSlider
            label={`Growth Center (\u03BC)`}
            value={growth.mu}
            min={0.05}
            max={0.4}
            step={0.01}
            onChange={(value) => onGrowthChange({ mu: value })}
            formatValue={(v) => v.toFixed(2)}
          />

          <RangeSlider
            label={`Growth Width (\u03C3)`}
            value={growth.sigma}
            min={0.005}
            max={0.1}
            step={0.005}
            onChange={(value) => onGrowthChange({ sigma: value })}
            formatValue={(v) => v.toFixed(3)}
          />
        </div>
      )}
    </div>
  );
}

export function MultiKernelPanel({
  enabled,
  config,
  onEnable,
  onDisable,
  onConfigChange,
  onKernelUpdate,
  onGrowthUpdate,
  onAddKernel,
  onRemoveKernel,
  onPresetSelect,
}: MultiKernelPanelProps) {
  const [selectedPreset, setSelectedPreset] = useState("orbium-dual");

  const handleEnableToggle = useCallback(
    (value: boolean) => {
      if (value) {
        onEnable(MULTIKERNEL_PRESETS[selectedPreset]);
      } else {
        onDisable();
      }
    },
    [selectedPreset, onEnable, onDisable],
  );

  const handlePresetChange = useCallback(
    (preset: string) => {
      setSelectedPreset(preset);
      onPresetSelect(preset);
    },
    [onPresetSelect],
  );

  const handleCombinationModeChange = useCallback(
    (mode: KernelCombinationMode) => {
      if (config) {
        onConfigChange({ ...config, combinationMode: mode });
      }
    },
    [config, onConfigChange],
  );

  const handleDtChange = useCallback(
    (dt: number) => {
      if (config) {
        onConfigChange({ ...config, dt });
      }
    },
    [config, onConfigChange],
  );

  const canAddKernel = config
    ? config.kernels.length < config.maxKernels
    : false;
  const canRemoveKernel = config ? config.kernels.length > 1 : false;

  return (
    <ExpandablePanel title="Multi-Kernel Lenia" defaultExpanded={false}>
      <div className="space-y-4">
        <ToggleButton
          label="Enable Multi-Kernel"
          value={enabled}
          onChange={handleEnableToggle}
        />

        {!enabled && (
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Preset</label>
            <select
              className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm"
              value={selectedPreset}
              onChange={(e) => setSelectedPreset(e.target.value)}
            >
              {Object.keys(MULTIKERNEL_PRESETS).map((name) => (
                <option key={name} value={name}>
                  {name
                    .split("-")
                    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
                    .join(" ")}
                </option>
              ))}
            </select>
          </div>
        )}

        {enabled && config && (
          <>
            <StatGrid
              stats={[
                { label: "Kernels", value: config.kernels.length.toString() },
                { label: "Mode", value: config.combinationMode },
                { label: "dt", value: config.dt.toFixed(2) },
                {
                  label: "Max R",
                  value: Math.max(
                    ...config.kernels.map((k) => k.radius),
                  ).toString(),
                },
              ]}
            />

            <div>
              <label className="text-xs text-gray-400 mb-1 block">
                Load Preset
              </label>
              <select
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm"
                value=""
                onChange={(e) => {
                  if (e.target.value) {
                    handlePresetChange(e.target.value);
                    e.target.value = "";
                  }
                }}
              >
                <option value="">Select preset...</option>
                {Object.keys(MULTIKERNEL_PRESETS).map((name) => (
                  <option key={name} value={name}>
                    {name
                      .split("-")
                      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
                      .join(" ")}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-gray-400 mb-1 block">
                  Combination Mode
                </label>
                <select
                  className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm"
                  value={config.combinationMode}
                  onChange={(e) =>
                    handleCombinationModeChange(
                      e.target.value as KernelCombinationMode,
                    )
                  }
                >
                  {COMBINATION_MODES.map((mode) => (
                    <option key={mode} value={mode}>
                      {mode.charAt(0).toUpperCase() + mode.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">
                  Time Step (dt)
                </label>
                <input
                  type="number"
                  className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm"
                  value={config.dt}
                  min={0.01}
                  max={0.5}
                  step={0.01}
                  onChange={(e) => handleDtChange(parseFloat(e.target.value))}
                />
              </div>
            </div>

            <div className="border-t border-gray-700 pt-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-300">
                  Kernels ({config.kernels.length}/{config.maxKernels})
                </span>
                {canAddKernel && (
                  <button
                    className="text-green-400 hover:text-green-300 text-sm px-2 py-1 border border-green-600 rounded"
                    onClick={() => onAddKernel()}
                  >
                    + Add Kernel
                  </button>
                )}
              </div>

              {config.kernels.map((kernel, index) => (
                <KernelCard
                  key={kernel.id}
                  index={index}
                  kernel={kernel}
                  growth={config.growthParams[index]}
                  canRemove={canRemoveKernel}
                  onKernelChange={(params) => onKernelUpdate(index, params)}
                  onGrowthChange={(params) => onGrowthUpdate(index, params)}
                  onRemove={() => onRemoveKernel(index)}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </ExpandablePanel>
  );
}
