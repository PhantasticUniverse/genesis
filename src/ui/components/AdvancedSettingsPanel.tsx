/**
 * Advanced Settings Panel
 *
 * Power user controls for:
 * - Grid size configuration
 * - Precision settings
 * - RNG seed control
 * - Performance monitoring
 * - Export options
 * - Quality presets
 */

import { useState, useCallback } from "react";
import { ExpandablePanel } from "./common/ExpandablePanel";
import type { Engine } from "../../core/engine";

interface AdvancedSettingsPanelProps {
  engine: Engine | null;
  currentGridSize?: number;
  currentSeed?: number;
  onGridSizeChange?: (size: number) => void;
  onSeedChange?: (seed: number) => void;
}

// Grid size options with memory estimates
const GRID_SIZE_OPTIONS = [
  { label: "128×128 (Fast)", size: 128, memory: "~4MB", recommended: false },
  { label: "256×256 (Light)", size: 256, memory: "~16MB", recommended: false },
  { label: "512×512 (Default)", size: 512, memory: "~64MB", recommended: true },
  { label: "1024×1024 (HD)", size: 1024, memory: "~256MB", recommended: true },
  {
    label: "2048×2048 (Ultra)",
    size: 2048,
    memory: "~1GB",
    recommended: false,
    warning: "Requires modern GPU",
  },
  {
    label: "4096×4096 (Max)",
    size: 4096,
    memory: "~4GB",
    recommended: false,
    warning: "May cause slowdowns",
  },
] as const;

// Quality presets
const QUALITY_PRESETS = {
  performance: {
    name: "Performance",
    description: "Maximum FPS, reduced detail",
    gridSize: 256,
    targetFps: 60,
    fftThreshold: 12,
    creatureTrackingInterval: 10,
    analysisInterval: 30,
  },
  balanced: {
    name: "Balanced",
    description: "Good visuals and performance",
    gridSize: 512,
    targetFps: 60,
    fftThreshold: 16,
    creatureTrackingInterval: 5,
    analysisInterval: 15,
  },
  quality: {
    name: "Quality",
    description: "Higher resolution, 30fps target",
    gridSize: 1024,
    targetFps: 30,
    fftThreshold: 16,
    creatureTrackingInterval: 5,
    analysisInterval: 10,
  },
  ultra: {
    name: "Ultra",
    description: "Maximum resolution",
    gridSize: 2048,
    targetFps: 30,
    fftThreshold: 14,
    creatureTrackingInterval: 10,
    analysisInterval: 20,
  },
} as const;

type QualityPreset = keyof typeof QUALITY_PRESETS;

// Detect recommended quality preset based on device memory
function detectRecommendedPreset(): QualityPreset {
  if (typeof navigator !== "undefined" && "deviceMemory" in navigator) {
    const memory = (navigator as { deviceMemory?: number }).deviceMemory ?? 4;
    if (memory >= 8) return "quality";
    if (memory >= 4) return "balanced";
    return "performance";
  }
  return "balanced";
}

export function AdvancedSettingsPanel({
  // engine prop available for future use
  engine: _engine,
  currentGridSize = 512,
  currentSeed = 12345,
  onGridSizeChange,
  onSeedChange,
}: AdvancedSettingsPanelProps) {
  const [selectedGridSize, setSelectedGridSize] = useState(currentGridSize);
  const [seed, setSeed] = useState(currentSeed.toString());
  const [qualityPreset, setQualityPreset] = useState<QualityPreset>(
    detectRecommendedPreset,
  );
  const [useFft, setUseFft] = useState(true);
  const [showGpuStats, setShowGpuStats] = useState(false);
  const [precision, setPrecision] = useState<"f32" | "f16">("f32");
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pendingGridSize, setPendingGridSize] = useState<number | null>(null);

  // Re-used for future engine-related functionality
  void _engine;

  const handleGridSizeSelect = useCallback(
    (size: number) => {
      if (size !== selectedGridSize) {
        setPendingGridSize(size);
        setShowConfirmDialog(true);
      }
    },
    [selectedGridSize],
  );

  const confirmGridSizeChange = useCallback(() => {
    if (pendingGridSize !== null) {
      setSelectedGridSize(pendingGridSize);
      onGridSizeChange?.(pendingGridSize);
      setShowConfirmDialog(false);
      setPendingGridSize(null);
    }
  }, [pendingGridSize, onGridSizeChange]);

  const handleSeedChange = useCallback(() => {
    const numSeed = parseInt(seed, 10);
    if (!isNaN(numSeed)) {
      onSeedChange?.(numSeed);
    }
  }, [seed, onSeedChange]);

  const generateRandomSeed = useCallback(() => {
    const newSeed = Math.floor(Math.random() * 2147483647);
    setSeed(newSeed.toString());
    onSeedChange?.(newSeed);
  }, [onSeedChange]);

  const copySeed = useCallback(() => {
    navigator.clipboard?.writeText(seed);
  }, [seed]);

  const applyQualityPreset = useCallback(
    (preset: QualityPreset) => {
      setQualityPreset(preset);
      const config = QUALITY_PRESETS[preset];
      setSelectedGridSize(config.gridSize);
      onGridSizeChange?.(config.gridSize);
    },
    [onGridSizeChange],
  );

  return (
    <ExpandablePanel
      title="Advanced Settings"
      icon="⚙️"
      defaultExpanded={false}
    >
      <div className="space-y-5">
        {/* Quality Presets */}
        <div className="space-y-2">
          <div className="text-xs text-zinc-400 uppercase tracking-wider font-display">
            Quality Preset
          </div>
          <div className="grid grid-cols-2 gap-2">
            {(
              Object.entries(QUALITY_PRESETS) as [
                QualityPreset,
                (typeof QUALITY_PRESETS)[QualityPreset],
              ][]
            ).map(([key, preset]) => (
              <button
                key={key}
                onClick={() => applyQualityPreset(key)}
                className={`p-2 rounded border text-left transition-all ${
                  qualityPreset === key
                    ? "border-bio-cyan bg-bio-cyan/10 text-bio-cyan"
                    : "border-zinc-700 text-zinc-400 hover:border-zinc-500"
                }`}
              >
                <div className="text-sm font-medium">{preset.name}</div>
                <div className="text-xs opacity-60">{preset.description}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Grid Size */}
        <div className="space-y-2">
          <div className="text-xs text-zinc-400 uppercase tracking-wider font-display">
            Grid Size
          </div>
          <select
            value={selectedGridSize}
            onChange={(e) => handleGridSizeSelect(Number(e.target.value))}
            className="genesis-select w-full"
          >
            {GRID_SIZE_OPTIONS.map((option) => (
              <option
                key={option.size}
                value={option.size}
                disabled={option.warning !== undefined}
              >
                {option.label} {option.memory}
                {option.recommended && " ✓"}
              </option>
            ))}
          </select>
          {GRID_SIZE_OPTIONS.find((o) => o.size === selectedGridSize)
            ?.warning && (
            <div className="text-xs text-bio-amber flex items-center gap-1">
              ⚠️{" "}
              {
                GRID_SIZE_OPTIONS.find((o) => o.size === selectedGridSize)
                  ?.warning
              }
            </div>
          )}
        </div>

        {/* Precision */}
        <div className="space-y-2">
          <div className="text-xs text-zinc-400 uppercase tracking-wider font-display">
            Precision
          </div>
          <div className="flex gap-2">
            {(["f32", "f16"] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPrecision(p)}
                className={`flex-1 py-1.5 rounded text-sm font-mono transition-all ${
                  precision === p
                    ? "bg-bio-cyan/20 text-bio-cyan border border-bio-cyan/30"
                    : "bg-genesis-depth text-zinc-500 border border-zinc-700 hover:border-zinc-500"
                }`}
              >
                {p === "f32" ? "32-bit (Default)" : "16-bit (Fast)"}
              </button>
            ))}
          </div>
        </div>

        {/* Reproducibility */}
        <div className="space-y-2">
          <div className="text-xs text-zinc-400 uppercase tracking-wider font-display">
            RNG Seed
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={seed}
              onChange={(e) => setSeed(e.target.value)}
              onBlur={handleSeedChange}
              onKeyDown={(e) => e.key === "Enter" && handleSeedChange()}
              className="flex-1 px-3 py-2 bg-genesis-depth border border-zinc-700 rounded text-sm font-mono text-bio-cyan focus:border-bio-cyan focus:outline-none"
              placeholder="12345"
            />
            <button
              onClick={generateRandomSeed}
              className="px-3 py-2 bg-genesis-depth border border-zinc-700 rounded text-zinc-400 hover:text-bio-cyan hover:border-bio-cyan/30 transition-all"
              title="Generate random seed"
            >
              🎲
            </button>
            <button
              onClick={copySeed}
              className="px-3 py-2 bg-genesis-depth border border-zinc-700 rounded text-zinc-400 hover:text-bio-cyan hover:border-bio-cyan/30 transition-all"
              title="Copy seed"
            >
              📋
            </button>
          </div>
          <div className="text-xs text-zinc-600">
            Set seed for reproducible simulations
          </div>
        </div>

        {/* Performance */}
        <div className="space-y-2">
          <div className="text-xs text-zinc-400 uppercase tracking-wider font-display">
            Performance
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-zinc-400">Use FFT (R≥16)</span>
              <button
                onClick={() => setUseFft(!useFft)}
                className={`px-3 py-1 rounded text-xs font-medium transition-all ${
                  useFft
                    ? "bg-bio-green/20 text-bio-green border border-bio-green/30"
                    : "bg-genesis-depth text-zinc-500 border border-zinc-700"
                }`}
              >
                {useFft ? "Enabled" : "Disabled"}
              </button>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-zinc-400">Show GPU Stats</span>
              <button
                onClick={() => setShowGpuStats(!showGpuStats)}
                className={`px-3 py-1 rounded text-xs font-medium transition-all ${
                  showGpuStats
                    ? "bg-bio-cyan/20 text-bio-cyan border border-bio-cyan/30"
                    : "bg-genesis-depth text-zinc-500 border border-zinc-700"
                }`}
              >
                {showGpuStats ? "On" : "Off"}
              </button>
            </div>
          </div>
        </div>

        {/* GPU Info */}
        {showGpuStats && (
          <div className="p-3 bg-genesis-depth rounded border border-zinc-800">
            <div className="text-xs text-zinc-400 mb-2">GPU Information</div>
            <div className="space-y-1 font-mono text-xs">
              <div className="flex justify-between">
                <span className="text-zinc-500">Adapter:</span>
                <span className="text-bio-cyan">WebGPU</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Grid:</span>
                <span className="text-bio-cyan">
                  {selectedGridSize}×{selectedGridSize}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Buffer Size:</span>
                <span className="text-bio-cyan">
                  {(
                    (selectedGridSize * selectedGridSize * 4) /
                    1024 /
                    1024
                  ).toFixed(1)}{" "}
                  MB
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">FFT:</span>
                <span className={useFft ? "text-bio-green" : "text-zinc-500"}>
                  {useFft ? "Active" : "Inactive"}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Export Options */}
        <div className="space-y-2">
          <div className="text-xs text-zinc-400 uppercase tracking-wider font-display">
            Export
          </div>
          <div className="flex gap-2">
            <select
              className="genesis-select flex-1 text-sm"
              defaultValue="png"
            >
              <option value="png">PNG</option>
              <option value="jpeg">JPEG</option>
              <option value="webp">WebP</option>
            </select>
            <button className="px-4 py-2 bg-genesis-surface border border-zinc-700 rounded text-sm text-zinc-400 hover:text-white hover:border-bio-cyan/30 transition-all">
              Export Frame
            </button>
          </div>
        </div>

        {/* Confirmation Dialog */}
        {showConfirmDialog && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-genesis-surface border border-zinc-700 rounded-lg p-6 max-w-sm mx-4">
              <div className="text-lg font-display text-white mb-2">
                Change Grid Size?
              </div>
              <p className="text-sm text-zinc-400 mb-4">
                Changing the grid size will reset the current simulation. This
                action cannot be undone.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowConfirmDialog(false)}
                  className="flex-1 px-4 py-2 bg-genesis-depth border border-zinc-700 rounded text-zinc-400 hover:text-white transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmGridSizeChange}
                  className="flex-1 px-4 py-2 bg-bio-cyan/20 border border-bio-cyan/30 rounded text-bio-cyan hover:bg-bio-cyan/30 transition-all"
                >
                  Confirm
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </ExpandablePanel>
  );
}
