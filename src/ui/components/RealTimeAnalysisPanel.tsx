/**
 * Real-Time Analysis Panel
 *
 * HUD-style analysis widgets for monitoring simulation state:
 * - Symmetry gauge (circular)
 * - Chaos meter (Lyapunov classification)
 * - Mass sparkline
 * - Entropy indicator
 * - Behavior radar chart
 */

import { useEffect, useRef, useState, useCallback } from "react";
import type { SymmetryResult } from "../../analysis/symmetry";
import type { LyapunovResult } from "../../analysis/chaos";

// ============================================================================
// Types
// ============================================================================

export interface AnalysisMetrics {
  symmetry: SymmetryResult | null;
  chaos: LyapunovResult | null;
  mass: number;
  entropy: number;
  complexity: number;
  activity: number;
}

export interface RealTimeAnalysisPanelProps {
  metrics: AnalysisMetrics;
  massHistory: number[];
  isRunning: boolean;
  updateInterval?: number;
  onClose?: () => void;
}

// ============================================================================
// Symmetry Gauge Component
// ============================================================================

interface SymmetryGaugeProps {
  symmetry: SymmetryResult | null;
  size?: number;
}

function SymmetryGauge({ symmetry, size = 100 }: SymmetryGaugeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.scale(dpr, dpr);

    const centerX = size / 2;
    const centerY = size / 2;
    const radius = size / 2 - 8;

    // Clear
    ctx.clearRect(0, 0, size, size);

    // Draw background ring
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(0, 245, 255, 0.1)";
    ctx.lineWidth = 6;
    ctx.stroke();

    if (!symmetry) {
      // Draw placeholder
      ctx.fillStyle = "rgba(0, 245, 255, 0.3)";
      ctx.font = "12px Inter";
      ctx.textAlign = "center";
      ctx.fillText("--", centerX, centerY + 4);
      return;
    }

    // Draw symmetry order segments
    const order = symmetry.order;
    const strength = symmetry.strength;

    // Draw k-fold symmetry indicator (petals)
    for (let i = 0; i < order; i++) {
      const angle = (i * Math.PI * 2) / order - Math.PI / 2;
      const innerRadius = radius * 0.4;
      const outerRadius = radius * (0.4 + 0.5 * strength);

      ctx.beginPath();
      ctx.moveTo(
        centerX + Math.cos(angle) * innerRadius,
        centerY + Math.sin(angle) * innerRadius,
      );
      ctx.lineTo(
        centerX + Math.cos(angle) * outerRadius,
        centerY + Math.sin(angle) * outerRadius,
      );
      ctx.strokeStyle = `rgba(0, 245, 255, ${0.3 + 0.7 * strength})`;
      ctx.lineWidth = 3;
      ctx.lineCap = "round";
      ctx.stroke();
    }

    // Draw strength arc
    const strengthAngle = strength * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(
      centerX,
      centerY,
      radius,
      -Math.PI / 2,
      -Math.PI / 2 + strengthAngle,
    );
    const gradient = ctx.createLinearGradient(0, 0, size, size);
    gradient.addColorStop(0, "#00f5ff");
    gradient.addColorStop(1, "#ff00ff");
    ctx.strokeStyle = gradient;
    ctx.lineWidth = 6;
    ctx.lineCap = "round";
    ctx.stroke();

    // Draw center text
    ctx.fillStyle = "#00f5ff";
    ctx.font = "bold 16px Orbitron";
    ctx.textAlign = "center";
    ctx.fillText(`${order}`, centerX, centerY - 2);
    ctx.font = "10px Inter";
    ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
    ctx.fillText("fold", centerX, centerY + 12);
  }, [symmetry, size]);

  return (
    <div className="flex flex-col items-center gap-2">
      <canvas
        ref={canvasRef}
        style={{ width: size, height: size }}
        className="drop-shadow-[0_0_10px_rgba(0,245,255,0.3)]"
      />
      <span className="text-xs text-white/60 uppercase tracking-wider">
        Symmetry
      </span>
    </div>
  );
}

// ============================================================================
// Chaos Meter Component
// ============================================================================

interface ChaosMeterProps {
  chaos: LyapunovResult | null;
  width?: number;
  height?: number;
}

function ChaosMeter({ chaos, width = 120 }: ChaosMeterProps) {
  const classification = chaos?.classification ?? "unknown";
  const exponent = chaos?.exponent ?? 0;
  const confidence = chaos?.confidence ?? 0;

  const getClassificationColor = () => {
    switch (classification) {
      case "stable":
        return "#00ff88";
      case "periodic":
        return "#00f5ff";
      case "chaotic":
        return "#ffaa00";
      case "hyperchaotic":
        return "#ff0066";
      default:
        return "rgba(255, 255, 255, 0.3)";
    }
  };

  const getClassificationLabel = () => {
    switch (classification) {
      case "stable":
        return "STABLE";
      case "periodic":
        return "PERIODIC";
      case "chaotic":
        return "CHAOTIC";
      case "hyperchaotic":
        return "HYPER-CHAOTIC";
      default:
        return "--";
    }
  };

  // Normalize exponent for display (-2 to 2 range)
  const normalizedExp = Math.max(-2, Math.min(2, exponent));
  const position = ((normalizedExp + 2) / 4) * 100;

  return (
    <div className="flex flex-col gap-2" style={{ width }}>
      {/* Classification label */}
      <div
        className="text-center text-xs font-bold tracking-wider"
        style={{ color: getClassificationColor() }}
      >
        {getClassificationLabel()}
      </div>

      {/* Meter bar */}
      <div className="relative h-2 rounded-full bg-white/10 overflow-hidden">
        {/* Gradient background */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to right, #00ff88, #00f5ff, #ffaa00, #ff0066)",
            opacity: 0.3,
          }}
        />

        {/* Position indicator */}
        <div
          className="absolute top-0 h-full w-1 rounded-full transition-all duration-300"
          style={{
            left: `${position}%`,
            backgroundColor: getClassificationColor(),
            boxShadow: `0 0 8px ${getClassificationColor()}`,
            transform: "translateX(-50%)",
          }}
        />
      </div>

      {/* Exponent value */}
      <div className="flex justify-between text-[10px] text-white/40">
        <span>λ: {exponent.toFixed(3)}</span>
        <span>conf: {(confidence * 100).toFixed(0)}%</span>
      </div>

      <span className="text-xs text-white/60 uppercase tracking-wider text-center">
        Lyapunov
      </span>
    </div>
  );
}

// ============================================================================
// Mass Sparkline Component
// ============================================================================

interface MassSparklineProps {
  history: number[];
  current: number;
  width?: number;
  height?: number;
}

function MassSparkline({
  history,
  current,
  width = 140,
  height = 50,
}: MassSparklineProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    // Clear
    ctx.clearRect(0, 0, width, height);

    if (history.length < 2) {
      ctx.fillStyle = "rgba(0, 245, 255, 0.3)";
      ctx.font = "12px Inter";
      ctx.textAlign = "center";
      ctx.fillText("Collecting...", width / 2, height / 2);
      return;
    }

    // Find min/max for scaling
    const min = Math.min(...history) * 0.9;
    const max = Math.max(...history) * 1.1 || 1;
    const range = max - min || 1;

    // Draw grid lines
    ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
    ctx.lineWidth = 1;
    for (let i = 0; i < 3; i++) {
      const y = (height / 2) * (1 - (i - 1) * 0.4);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Draw sparkline
    const points: Array<{ x: number; y: number }> = history.map((v, i) => ({
      x: (i / (history.length - 1)) * width,
      y: height - ((v - min) / range) * (height - 4) - 2,
    }));

    // Gradient fill
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, "rgba(0, 245, 255, 0.3)");
    gradient.addColorStop(1, "rgba(0, 245, 255, 0)");

    ctx.beginPath();
    ctx.moveTo(points[0].x, height);
    points.forEach((p) => ctx.lineTo(p.x, p.y));
    ctx.lineTo(points[points.length - 1].x, height);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();

    // Draw line
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    points.forEach((p) => ctx.lineTo(p.x, p.y));
    ctx.strokeStyle = "#00f5ff";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Draw end point
    const lastPoint = points[points.length - 1];
    ctx.beginPath();
    ctx.arc(lastPoint.x, lastPoint.y, 3, 0, Math.PI * 2);
    ctx.fillStyle = "#00f5ff";
    ctx.fill();
    ctx.strokeStyle = "rgba(0, 245, 255, 0.5)";
    ctx.lineWidth = 4;
    ctx.stroke();
  }, [history, width, height]);

  return (
    <div className="flex flex-col items-center gap-1">
      <canvas ref={canvasRef} style={{ width, height }} className="rounded" />
      <div className="flex justify-between w-full text-[10px] text-white/40 px-1">
        <span>Mass</span>
        <span className="text-cyan-400 font-mono">{current.toFixed(2)}</span>
      </div>
    </div>
  );
}

// ============================================================================
// Behavior Radar Component
// ============================================================================

interface BehaviorRadarProps {
  metrics: {
    symmetry: number;
    chaos: number;
    complexity: number;
    activity: number;
    entropy: number;
  };
  size?: number;
}

const BEHAVIOR_DIMENSIONS = [
  { key: "symmetry", label: "SYM", color: "#00f5ff" },
  { key: "chaos", label: "CHS", color: "#ff00ff" },
  { key: "complexity", label: "CPX", color: "#ffaa00" },
  { key: "activity", label: "ACT", color: "#00ff88" },
  { key: "entropy", label: "ENT", color: "#ff6b6b" },
] as const;

function BehaviorRadar({ metrics, size = 100 }: BehaviorRadarProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.scale(dpr, dpr);

    const centerX = size / 2;
    const centerY = size / 2;
    const radius = size / 2 - 16;

    // Clear
    ctx.clearRect(0, 0, size, size);

    // Draw background circles
    for (let i = 1; i <= 3; i++) {
      ctx.beginPath();
      ctx.arc(centerX, centerY, (radius * i) / 3, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(255, 255, 255, ${0.05 * i})`;
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Draw axes
    BEHAVIOR_DIMENSIONS.forEach((dim, i) => {
      const angle = (i * Math.PI * 2) / BEHAVIOR_DIMENSIONS.length - Math.PI / 2;
      const x = centerX + Math.cos(angle) * radius;
      const y = centerY + Math.sin(angle) * radius;

      // Axis line
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.lineTo(x, y);
      ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
      ctx.lineWidth = 1;
      ctx.stroke();

      // Label
      const labelX = centerX + Math.cos(angle) * (radius + 10);
      const labelY = centerY + Math.sin(angle) * (radius + 10);
      ctx.font = "8px JetBrains Mono";
      ctx.fillStyle = dim.color;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(dim.label, labelX, labelY);
    });

    // Draw data polygon
    ctx.beginPath();
    BEHAVIOR_DIMENSIONS.forEach((dim, i) => {
      const value = metrics[dim.key] ?? 0;
      const angle = (i * Math.PI * 2) / BEHAVIOR_DIMENSIONS.length - Math.PI / 2;
      const r = radius * Math.max(0.05, Math.min(1, value));
      const x = centerX + Math.cos(angle) * r;
      const y = centerY + Math.sin(angle) * r;

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    ctx.closePath();

    // Fill
    const gradient = ctx.createRadialGradient(
      centerX,
      centerY,
      0,
      centerX,
      centerY,
      radius,
    );
    gradient.addColorStop(0, "rgba(0, 245, 255, 0.4)");
    gradient.addColorStop(1, "rgba(255, 0, 255, 0.1)");
    ctx.fillStyle = gradient;
    ctx.fill();

    // Stroke
    ctx.strokeStyle = "rgba(0, 245, 255, 0.8)";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Draw data points
    BEHAVIOR_DIMENSIONS.forEach((dim, i) => {
      const value = metrics[dim.key] ?? 0;
      const angle = (i * Math.PI * 2) / BEHAVIOR_DIMENSIONS.length - Math.PI / 2;
      const r = radius * Math.max(0.05, Math.min(1, value));
      const x = centerX + Math.cos(angle) * r;
      const y = centerY + Math.sin(angle) * r;

      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fillStyle = dim.color;
      ctx.fill();
    });
  }, [metrics, size]);

  return (
    <div className="flex flex-col items-center gap-2">
      <canvas
        ref={canvasRef}
        style={{ width: size, height: size }}
        className="drop-shadow-[0_0_10px_rgba(0,245,255,0.2)]"
      />
      <span className="text-xs text-white/60 uppercase tracking-wider">
        Behavior
      </span>
    </div>
  );
}

// ============================================================================
// Entropy Indicator Component
// ============================================================================

interface EntropyIndicatorProps {
  entropy: number;
  width?: number;
}

function EntropyIndicator({ entropy, width = 80 }: EntropyIndicatorProps) {
  // Normalize entropy to 0-1 range (assuming max around 8 bits)
  const normalized = Math.min(1, entropy / 8);

  // Color based on entropy level
  const getColor = () => {
    if (normalized < 0.3) return "#00ff88"; // Low entropy - ordered
    if (normalized < 0.6) return "#00f5ff"; // Medium entropy
    if (normalized < 0.8) return "#ffaa00"; // High entropy
    return "#ff0066"; // Very high entropy - random
  };

  return (
    <div className="flex flex-col items-center gap-2" style={{ width }}>
      {/* Vertical bar */}
      <div className="relative w-3 h-16 rounded-full bg-white/10 overflow-hidden">
        <div
          className="absolute bottom-0 w-full rounded-full transition-all duration-300"
          style={{
            height: `${normalized * 100}%`,
            backgroundColor: getColor(),
            boxShadow: `0 0 10px ${getColor()}`,
          }}
        />

        {/* Tick marks */}
        {[0.25, 0.5, 0.75].map((tick) => (
          <div
            key={tick}
            className="absolute w-full h-px bg-white/20"
            style={{ bottom: `${tick * 100}%` }}
          />
        ))}
      </div>

      {/* Value */}
      <div
        className="text-sm font-mono font-bold"
        style={{ color: getColor() }}
      >
        {entropy.toFixed(2)}
      </div>

      <span className="text-xs text-white/60 uppercase tracking-wider">
        Entropy
      </span>
    </div>
  );
}

// ============================================================================
// Main Panel Component
// ============================================================================

export function RealTimeAnalysisPanel({
  metrics,
  massHistory,
  isRunning,
  onClose,
}: RealTimeAnalysisPanelProps) {
  const [collapsed, setCollapsed] = useState(false);

  // Compute radar metrics from analysis results
  const radarMetrics = {
    symmetry: metrics.symmetry?.strength ?? 0,
    chaos: metrics.chaos
      ? Math.min(1, Math.max(0, (metrics.chaos.exponent + 1) / 2))
      : 0,
    complexity: metrics.complexity,
    activity: metrics.activity,
    entropy: Math.min(1, metrics.entropy / 8),
  };

  if (collapsed) {
    return (
      <div
        className="glass-panel p-2 cursor-pointer"
        onClick={() => setCollapsed(false)}
      >
        <div className="flex items-center gap-2 text-cyan-400">
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
            />
          </svg>
          <span className="text-xs uppercase tracking-wider">Analysis</span>
        </div>
      </div>
    );
  }

  return (
    <div className="glass-panel p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div
            className={`w-2 h-2 rounded-full ${
              isRunning ? "bg-green-500 animate-pulse" : "bg-gray-500"
            }`}
          />
          <h3 className="text-sm font-bold text-cyan-400 uppercase tracking-wider">
            Real-Time Analysis
          </h3>
        </div>
        <div className="flex gap-1">
          <button
            onClick={() => setCollapsed(true)}
            className="p-1 text-white/40 hover:text-white/80 transition-colors"
            title="Collapse"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M20 12H4"
              />
            </svg>
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1 text-white/40 hover:text-white/80 transition-colors"
              title="Close"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Top row: Symmetry gauge and Chaos meter */}
      <div className="flex justify-around items-start">
        <SymmetryGauge symmetry={metrics.symmetry} size={90} />
        <EntropyIndicator entropy={metrics.entropy} />
        <ChaosMeter chaos={metrics.chaos} width={110} />
      </div>

      {/* Middle: Mass sparkline */}
      <div className="border-t border-white/10 pt-4">
        <MassSparkline
          history={massHistory}
          current={metrics.mass}
          width={260}
          height={50}
        />
      </div>

      {/* Bottom: Behavior radar */}
      <div className="border-t border-white/10 pt-4 flex justify-center">
        <BehaviorRadar metrics={radarMetrics} size={110} />
      </div>

      {/* Metric summary */}
      <div className="grid grid-cols-3 gap-2 text-[10px] text-white/60 border-t border-white/10 pt-3">
        <div className="flex flex-col items-center">
          <span className="text-cyan-400 font-mono text-sm">
            {metrics.symmetry?.order ?? "-"}
          </span>
          <span>Sym Order</span>
        </div>
        <div className="flex flex-col items-center">
          <span
            className="text-magenta-400 font-mono text-sm"
            style={{ color: "#ff00ff" }}
          >
            {metrics.complexity.toFixed(2)}
          </span>
          <span>Complexity</span>
        </div>
        <div className="flex flex-col items-center">
          <span className="text-green-400 font-mono text-sm">
            {(metrics.activity * 100).toFixed(0)}%
          </span>
          <span>Activity</span>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Hook for computing metrics
// ============================================================================

export interface UseAnalysisMetricsOptions {
  state: Float32Array | null;
  width: number;
  height: number;
  isRunning: boolean;
  updateInterval?: number;
}

export function useAnalysisMetrics({
  state,
  width,
  height,
  isRunning,
  updateInterval = 500,
}: UseAnalysisMetricsOptions) {
  const [metrics, setMetrics] = useState<AnalysisMetrics>({
    symmetry: null,
    chaos: null,
    mass: 0,
    entropy: 0,
    complexity: 0,
    activity: 0,
  });

  const [massHistory, setMassHistory] = useState<number[]>([]);
  const previousStateRef = useRef<Float32Array | null>(null);

  const computeMetrics = useCallback(async () => {
    if (!state || state.length === 0) return;

    // Import analysis functions dynamically
    // Note: Chaos analysis requires a step function, so we only import symmetry here
    const symmetryModule = await import("../../analysis/symmetry");

    // Compute mass and entropy histogram
    let mass = 0;
    let entropy = 0;
    const bins = new Array(256).fill(0);

    for (let i = 0; i < state.length; i++) {
      const v = state[i];
      mass += v;
      const bin = Math.floor(v * 255);
      bins[Math.min(255, bin)]++;
    }

    // Calculate entropy from histogram
    const total = state.length;
    for (let i = 0; i < 256; i++) {
      if (bins[i] > 0) {
        const p = bins[i] / total;
        entropy -= p * Math.log2(p);
      }
    }

    // Compute activity (change from previous state)
    let activity = 0;
    if (
      previousStateRef.current &&
      previousStateRef.current.length === state.length
    ) {
      let diff = 0;
      for (let i = 0; i < state.length; i++) {
        diff += Math.abs(state[i] - previousStateRef.current[i]);
      }
      activity = diff / state.length;
    }
    previousStateRef.current = new Float32Array(state);

    // Compute complexity (edge density as a proxy)
    let edgeSum = 0;
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = y * width + x;
        const v = state[idx];
        const neighbors =
          state[idx - 1] +
          state[idx + 1] +
          state[idx - width] +
          state[idx + width];
        edgeSum += Math.abs(v * 4 - neighbors);
      }
    }
    const complexity = Math.min(1, edgeSum / (width * height * 2));

    // Compute symmetry (expensive, so sample less frequently)
    let symmetry: SymmetryResult | null = null;
    try {
      symmetry = symmetryModule.analyzeSymmetry(state, width, height, {
        maxOrder: 6,
        angularBins: 180,
        radialBins: 25,
      });
    } catch {
      // Ignore errors
    }

    setMetrics({
      symmetry,
      chaos: null, // Chaos is expensive, would need step function
      mass,
      entropy,
      complexity,
      activity,
    });

    setMassHistory((prev) => {
      const next = [...prev, mass];
      return next.slice(-60); // Keep last 60 samples
    });
  }, [state, width, height]);

  useEffect(() => {
    if (!isRunning) return;

    const interval = setInterval(computeMetrics, updateInterval);
    return () => clearInterval(interval);
  }, [isRunning, computeMetrics, updateInterval]);

  // Compute once when state changes and not running
  useEffect(() => {
    if (!isRunning && state) {
      computeMetrics();
    }
  }, [state, isRunning, computeMetrics]);

  return { metrics, massHistory };
}

export default RealTimeAnalysisPanel;
