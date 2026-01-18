/**
 * Lenia Parameter Panel
 * Exposes all continuous CA parameters with intuitive controls
 *
 * Features:
 * - Kernel shape and radius controls
 * - Growth function parameters (μ, σ)
 * - Time step control
 * - Mass conservation toggle
 * - Real-time kernel preview
 * - Growth curve visualization
 */

import { useState, useEffect, useCallback, useRef } from "react";
import type { Engine } from "../../core/engine";
import type { KernelShape, GrowthFunction } from "../../core/types";

interface LeniaParameterPanelProps {
  engine: Engine | null;
  isExpanded?: boolean;
  onToggle?: () => void;
}

interface LeniaParams {
  // Kernel parameters
  kernelShape: KernelShape;
  kernelRadius: number;
  kernelPeaks: number[];

  // Growth function parameters
  growthType: GrowthFunction;
  growthCenter: number; // μ
  growthWidth: number; // σ

  // Dynamics
  dt: number;
  massConservation: boolean;
}

const DEFAULT_PARAMS: LeniaParams = {
  kernelShape: "polynomial",
  kernelRadius: 13,
  kernelPeaks: [0.5],
  growthType: "gaussian",
  growthCenter: 0.12,
  growthWidth: 0.04,
  dt: 0.1,
  massConservation: false,
};

// Parameter ranges and labels
const PARAM_CONFIG = {
  kernelRadius: { min: 5, max: 30, step: 1, label: "Kernel Radius (R)" },
  growthCenter: { min: 0.05, max: 0.4, step: 0.01, label: "Growth Center (μ)" },
  growthWidth: { min: 0.005, max: 0.1, step: 0.005, label: "Growth Width (σ)" },
  dt: { min: 0.01, max: 0.5, step: 0.01, label: "Time Step (dt)" },
} as const;

const KERNEL_SHAPES: { value: KernelShape; label: string }[] = [
  { value: "polynomial", label: "Polynomial" },
  { value: "gaussian", label: "Gaussian" },
  { value: "ring", label: "Ring" },
  { value: "step", label: "Step" },
];

const GROWTH_TYPES: { value: GrowthFunction; label: string }[] = [
  { value: "gaussian", label: "Gaussian" },
  { value: "polynomial", label: "Polynomial" },
  { value: "step", label: "Step" },
];

export function LeniaParameterPanel({
  engine,
  isExpanded = true,
  onToggle,
}: LeniaParameterPanelProps) {
  const [params, setParams] = useState<LeniaParams>(DEFAULT_PARAMS);
  const [newPeakValue, setNewPeakValue] = useState(0.5);
  const kernelCanvasRef = useRef<HTMLCanvasElement>(null);
  const growthCanvasRef = useRef<HTMLCanvasElement>(null);

  // Apply parameters to engine
  const applyParams = useCallback(() => {
    if (!engine) return;

    engine.setContinuousParams({
      kernelRadius: params.kernelRadius,
      growthCenter: params.growthCenter,
      growthWidth: params.growthWidth,
      dt: params.dt,
      growthType:
        params.growthType === "gaussian"
          ? 1
          : params.growthType === "polynomial"
            ? 0
            : 2,
    });

    // Mass conservation would be set separately if supported
  }, [engine, params]);

  // Apply params when they change
  useEffect(() => {
    applyParams();
  }, [applyParams]);

  // Draw kernel preview
  useEffect(() => {
    const canvas = kernelCanvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const centerX = width / 2;
    const centerY = height / 2;

    // Clear canvas
    ctx.fillStyle = "#0a0a12";
    ctx.fillRect(0, 0, width, height);

    // Draw kernel
    const maxRadius = Math.min(width, height) / 2 - 10;
    const normalizedRadius = params.kernelRadius / 30; // Normalize to 0-1

    ctx.beginPath();
    for (let angle = 0; angle < Math.PI * 2; angle += 0.02) {
      // Compute kernel value at this angle (simplified)
      let r = maxRadius * normalizedRadius;

      // Add some variation based on peaks for visual interest
      if (params.kernelPeaks.length > 0) {
        r *= 0.5 + params.kernelPeaks[0] * 0.5;
      }

      const x = centerX + Math.cos(angle) * r;
      const y = centerY + Math.sin(angle) * r;

      if (angle === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.closePath();

    // Fill with gradient
    const gradient = ctx.createRadialGradient(
      centerX,
      centerY,
      0,
      centerX,
      centerY,
      maxRadius,
    );
    gradient.addColorStop(0, "rgba(0, 245, 255, 0.8)");
    gradient.addColorStop(0.5, "rgba(0, 245, 255, 0.4)");
    gradient.addColorStop(1, "rgba(0, 245, 255, 0.1)");
    ctx.fillStyle = gradient;
    ctx.fill();

    // Draw outline
    ctx.strokeStyle = "rgba(0, 245, 255, 0.6)";
    ctx.lineWidth = 2;
    ctx.stroke();
  }, [params.kernelRadius, params.kernelPeaks, params.kernelShape]);

  // Draw growth curve
  useEffect(() => {
    const canvas = growthCanvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // Clear canvas
    ctx.fillStyle = "#0a0a12";
    ctx.fillRect(0, 0, width, height);

    // Draw axes
    ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(10, height / 2);
    ctx.lineTo(width - 10, height / 2);
    ctx.stroke();

    // Draw growth curve
    ctx.strokeStyle = "rgba(0, 255, 136, 0.8)";
    ctx.lineWidth = 2;
    ctx.beginPath();

    const mu = params.growthCenter;
    const sigma = params.growthWidth;

    for (let i = 0; i < width; i++) {
      const x = i / width; // 0 to 1

      // Gaussian growth function
      let g: number;
      if (params.growthType === "gaussian") {
        g = 2 * Math.exp(-((x - mu) ** 2) / (2 * sigma ** 2)) - 1;
      } else if (params.growthType === "polynomial") {
        const diff = Math.abs(x - mu);
        g = diff < sigma ? 4 * (diff / sigma) * (1 - diff / sigma) * 2 - 1 : -1;
      } else {
        // Step
        g = Math.abs(x - mu) < sigma ? 1 : -1;
      }

      const y = height / 2 - g * height * 0.4;

      if (i === 0) {
        ctx.moveTo(i, y);
      } else {
        ctx.lineTo(i, y);
      }
    }
    ctx.stroke();

    // Mark μ position
    const muX = mu * width;
    ctx.strokeStyle = "rgba(255, 170, 0, 0.6)";
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(muX, 5);
    ctx.lineTo(muX, height - 5);
    ctx.stroke();
    ctx.setLineDash([]);

    // Label
    ctx.fillStyle = "rgba(255, 170, 0, 0.8)";
    ctx.font = "10px JetBrains Mono";
    ctx.fillText("μ", muX + 4, 14);
  }, [params.growthCenter, params.growthWidth, params.growthType]);

  const updateParam = <K extends keyof LeniaParams>(
    key: K,
    value: LeniaParams[K],
  ) => {
    setParams((prev) => ({ ...prev, [key]: value }));
  };

  const addPeak = () => {
    if (params.kernelPeaks.length < 5) {
      setParams((prev) => ({
        ...prev,
        kernelPeaks: [...prev.kernelPeaks, newPeakValue],
      }));
    }
  };

  const removePeak = (index: number) => {
    if (params.kernelPeaks.length > 1) {
      setParams((prev) => ({
        ...prev,
        kernelPeaks: prev.kernelPeaks.filter((_, i) => i !== index),
      }));
    }
  };

  const updatePeak = (index: number, value: number) => {
    setParams((prev) => ({
      ...prev,
      kernelPeaks: prev.kernelPeaks.map((p, i) => (i === index ? value : p)),
    }));
  };

  const resetToDefaults = () => {
    setParams(DEFAULT_PARAMS);
  };

  if (!isExpanded) {
    return (
      <div className="glass-panel p-3">
        <button
          onClick={onToggle}
          className="flex items-center justify-between w-full text-left"
        >
          <span className="text-sm font-display text-bio-cyan tracking-wider uppercase">
            🔬 Lenia Parameters
          </span>
          <span className="text-xs text-zinc-500">Click to expand</span>
        </button>
      </div>
    );
  }

  return (
    <div className="glass-panel p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-display text-bio-cyan tracking-wider uppercase">
          🔬 Lenia Parameters
        </h3>
        <button
          onClick={resetToDefaults}
          className="text-xs text-zinc-500 hover:text-bio-cyan transition-colors px-2 py-1 border border-zinc-700 rounded hover:border-bio-cyan/30"
        >
          Reset
        </button>
      </div>

      {/* Kernel Section */}
      <div className="space-y-3 pb-3 border-b border-zinc-800">
        <div className="text-xs text-zinc-400 uppercase tracking-wider font-display">
          Kernel
        </div>

        {/* Kernel Shape */}
        <div className="flex flex-col gap-1">
          <label className="text-xs text-zinc-500">Shape</label>
          <select
            value={params.kernelShape}
            onChange={(e) =>
              updateParam("kernelShape", e.target.value as KernelShape)
            }
            className="genesis-select text-sm"
          >
            {KERNEL_SHAPES.map((shape) => (
              <option key={shape.value} value={shape.value}>
                {shape.label}
              </option>
            ))}
          </select>
        </div>

        {/* Kernel Radius */}
        <div className="flex flex-col gap-1">
          <div className="flex justify-between">
            <label className="text-xs text-zinc-500">
              {PARAM_CONFIG.kernelRadius.label}
            </label>
            <span className="text-xs text-bio-cyan font-mono">
              {params.kernelRadius}
            </span>
          </div>
          <input
            type="range"
            min={PARAM_CONFIG.kernelRadius.min}
            max={PARAM_CONFIG.kernelRadius.max}
            step={PARAM_CONFIG.kernelRadius.step}
            value={params.kernelRadius}
            onChange={(e) =>
              updateParam("kernelRadius", Number(e.target.value))
            }
            className="genesis-slider"
          />
        </div>

        {/* Kernel Peaks */}
        <div className="flex flex-col gap-2">
          <label className="text-xs text-zinc-500">Peaks (β)</label>
          <div className="flex flex-wrap gap-2">
            {params.kernelPeaks.map((peak, index) => (
              <div
                key={index}
                className="flex items-center gap-1 bg-genesis-depth rounded px-2 py-1"
              >
                <input
                  type="number"
                  min={0}
                  max={1}
                  step={0.05}
                  value={peak.toFixed(2)}
                  onChange={(e) => updatePeak(index, Number(e.target.value))}
                  className="w-14 bg-transparent text-xs text-center font-mono text-bio-cyan border-none outline-none"
                />
                {params.kernelPeaks.length > 1 && (
                  <button
                    onClick={() => removePeak(index)}
                    className="text-zinc-500 hover:text-red-400 text-xs"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
            {params.kernelPeaks.length < 5 && (
              <button
                onClick={addPeak}
                className="px-2 py-1 text-xs border border-dashed border-zinc-700 rounded hover:border-bio-cyan/50 text-zinc-500 hover:text-bio-cyan transition-colors"
              >
                + Add
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Growth Function Section */}
      <div className="space-y-3 py-3 border-b border-zinc-800">
        <div className="text-xs text-zinc-400 uppercase tracking-wider font-display">
          Growth Function
        </div>

        {/* Growth Type */}
        <div className="flex flex-col gap-1">
          <label className="text-xs text-zinc-500">Type</label>
          <select
            value={params.growthType}
            onChange={(e) =>
              updateParam("growthType", e.target.value as GrowthFunction)
            }
            className="genesis-select text-sm"
          >
            {GROWTH_TYPES.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </div>

        {/* Growth Center (μ) */}
        <div className="flex flex-col gap-1">
          <div className="flex justify-between">
            <label className="text-xs text-zinc-500">
              {PARAM_CONFIG.growthCenter.label}
            </label>
            <span className="text-xs text-bio-cyan font-mono">
              {params.growthCenter.toFixed(2)}
            </span>
          </div>
          <input
            type="range"
            min={PARAM_CONFIG.growthCenter.min}
            max={PARAM_CONFIG.growthCenter.max}
            step={PARAM_CONFIG.growthCenter.step}
            value={params.growthCenter}
            onChange={(e) =>
              updateParam("growthCenter", Number(e.target.value))
            }
            className="genesis-slider"
          />
        </div>

        {/* Growth Width (σ) */}
        <div className="flex flex-col gap-1">
          <div className="flex justify-between">
            <label className="text-xs text-zinc-500">
              {PARAM_CONFIG.growthWidth.label}
            </label>
            <span className="text-xs text-bio-cyan font-mono">
              {params.growthWidth.toFixed(3)}
            </span>
          </div>
          <input
            type="range"
            min={PARAM_CONFIG.growthWidth.min}
            max={PARAM_CONFIG.growthWidth.max}
            step={PARAM_CONFIG.growthWidth.step}
            value={params.growthWidth}
            onChange={(e) => updateParam("growthWidth", Number(e.target.value))}
            className="genesis-slider"
          />
        </div>
      </div>

      {/* Dynamics Section */}
      <div className="space-y-3 py-3 border-b border-zinc-800">
        <div className="text-xs text-zinc-400 uppercase tracking-wider font-display">
          Dynamics
        </div>

        {/* Time Step (dt) */}
        <div className="flex flex-col gap-1">
          <div className="flex justify-between">
            <label className="text-xs text-zinc-500">
              {PARAM_CONFIG.dt.label}
            </label>
            <span className="text-xs text-bio-cyan font-mono">
              {params.dt.toFixed(2)}
            </span>
          </div>
          <input
            type="range"
            min={PARAM_CONFIG.dt.min}
            max={PARAM_CONFIG.dt.max}
            step={PARAM_CONFIG.dt.step}
            value={params.dt}
            onChange={(e) => updateParam("dt", Number(e.target.value))}
            className="genesis-slider"
          />
        </div>

        {/* Mass Conservation Toggle */}
        <div className="flex items-center justify-between">
          <label className="text-xs text-zinc-500">Mass Conservation</label>
          <button
            onClick={() =>
              updateParam("massConservation", !params.massConservation)
            }
            className={`px-3 py-1 rounded text-xs font-medium transition-all ${
              params.massConservation
                ? "bg-bio-green/20 text-bio-green border border-bio-green/30"
                : "bg-genesis-depth text-zinc-500 border border-zinc-700"
            }`}
          >
            {params.massConservation ? "Enabled" : "Disabled"}
          </button>
        </div>
      </div>

      {/* Visualizations */}
      <div className="pt-3 grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-zinc-500 text-center">
            Kernel Preview
          </label>
          <canvas
            ref={kernelCanvasRef}
            width={80}
            height={80}
            className="rounded border border-zinc-800 mx-auto"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-zinc-500 text-center">
            Growth Curve
          </label>
          <canvas
            ref={growthCanvasRef}
            width={80}
            height={80}
            className="rounded border border-zinc-800 mx-auto"
          />
        </div>
      </div>

      {/* Current Config Display */}
      <div className="mt-3 pt-3 border-t border-zinc-800">
        <span className="text-xs text-zinc-600 font-mono">
          R={params.kernelRadius} μ={params.growthCenter} σ={params.growthWidth}{" "}
          dt={params.dt}
        </span>
      </div>
    </div>
  );
}
