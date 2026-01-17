/**
 * Performance Monitoring Component
 * Displays real-time performance metrics including FPS, step count, and memory usage
 */

import { useState, useEffect, useCallback } from "react";
import { useSimulationStore } from "../stores/simulation-store";
import { ExpandablePanel, StatGrid } from "./common";

interface PerformanceMonitorProps {
  /** Optional engine for memory stats */
  engine: {
    step: number;
    fps: number;
    running: boolean;
  } | null;
  /** Whether to show as a floating overlay */
  floating?: boolean;
  /** Initial expanded state */
  defaultExpanded?: boolean;
}

interface PerformanceMetrics {
  fps: number;
  step: number;
  avgFps: number;
  minFps: number;
  maxFps: number;
  fpsHistory: number[];
}

/**
 * FPS color based on performance
 */
function getFpsColor(fps: number): string {
  if (fps >= 55) return "text-green-400";
  if (fps >= 30) return "text-yellow-400";
  if (fps >= 15) return "text-orange-400";
  return "text-red-400";
}

/**
 * Performance bar visualization
 */
function PerformanceBar({
  value,
  max,
  label,
  color,
}: {
  value: number;
  max: number;
  label: string;
  color: string;
}) {
  const percentage = Math.min(100, (value / max) * 100);

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-zinc-500">{label}</span>
        <span className={color}>{value.toFixed(1)}</span>
      </div>
      <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${color.replace("text-", "bg-")}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

/**
 * Mini FPS graph
 */
function FpsGraph({ history, max = 60 }: { history: number[]; max?: number }) {
  if (history.length === 0) return null;

  const width = 100;
  const height = 24;
  const points = history.slice(-50); // Last 50 samples

  const pathData = points
    .map((fps, i) => {
      const x = (i / (points.length - 1)) * width;
      const y = height - (Math.min(fps, max) / max) * height;
      return `${i === 0 ? "M" : "L"} ${x} ${y}`;
    })
    .join(" ");

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full h-6 mt-1"
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id="fpsGradient" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="rgb(74, 222, 128)" stopOpacity="0.5" />
          <stop offset="100%" stopColor="rgb(74, 222, 128)" stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* Fill under the line */}
      <path
        d={`${pathData} L ${width} ${height} L 0 ${height} Z`}
        fill="url(#fpsGradient)"
      />
      {/* The line itself */}
      <path
        d={pathData}
        fill="none"
        stroke="rgb(74, 222, 128)"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Target line at 60fps */}
      <line
        x1="0"
        y1={height - (60 / max) * height}
        x2={width}
        y2={height - (60 / max) * height}
        stroke="rgb(113, 113, 122)"
        strokeWidth="0.5"
        strokeDasharray="2,2"
      />
    </svg>
  );
}

export function PerformanceMonitor({
  engine,
  floating = false,
  defaultExpanded = false,
}: PerformanceMonitorProps) {
  const storeState = useSimulationStore();

  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    fps: 0,
    step: 0,
    avgFps: 0,
    minFps: 60,
    maxFps: 0,
    fpsHistory: [],
  });

  // Update metrics from engine or store
  useEffect(() => {
    const interval = setInterval(() => {
      const currentFps = engine?.fps ?? storeState.fps;
      const currentStep = engine?.step ?? storeState.step;

      setMetrics((prev) => {
        const newHistory = [...prev.fpsHistory, currentFps].slice(-100);

        // Calculate statistics
        const validFps = newHistory.filter((f) => f > 0);
        const avgFps =
          validFps.length > 0
            ? validFps.reduce((a, b) => a + b, 0) / validFps.length
            : 0;
        const minFps = validFps.length > 0 ? Math.min(...validFps) : 0;
        const maxFps = validFps.length > 0 ? Math.max(...validFps) : 0;

        return {
          fps: currentFps,
          step: currentStep,
          avgFps,
          minFps,
          maxFps,
          fpsHistory: newHistory,
        };
      });
    }, 100);

    return () => clearInterval(interval);
  }, [engine, storeState.fps, storeState.step]);

  const isRunning = engine?.running ?? storeState.running;

  if (floating) {
    // Floating overlay version (compact)
    return (
      <div className="fixed top-4 right-4 bg-zinc-900/95 backdrop-blur-sm border border-zinc-700 rounded-lg p-3 shadow-lg z-40 min-w-[140px]">
        <div className="flex items-center gap-2 mb-2">
          <div
            className={`w-2 h-2 rounded-full ${isRunning ? "bg-green-500 animate-pulse" : "bg-zinc-600"}`}
          />
          <span className="text-xs text-zinc-400">
            {isRunning ? "Running" : "Paused"}
          </span>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between items-baseline">
            <span className="text-xs text-zinc-500">FPS</span>
            <span
              className={`text-xl font-mono font-bold ${getFpsColor(metrics.fps)}`}
            >
              {Math.round(metrics.fps)}
            </span>
          </div>

          <div className="flex justify-between items-baseline">
            <span className="text-xs text-zinc-500">Step</span>
            <span className="text-sm font-mono text-zinc-300">
              {metrics.step.toLocaleString()}
            </span>
          </div>
        </div>

        <FpsGraph history={metrics.fpsHistory} />
      </div>
    );
  }

  // Panel version (detailed)
  return (
    <ExpandablePanel
      title="Performance"
      titleColor="text-cyan-400"
      defaultExpanded={defaultExpanded}
      statusBadge={
        isRunning
          ? {
              text: `${Math.round(metrics.fps)} FPS`,
              color:
                metrics.fps >= 30
                  ? "bg-green-900 text-green-400"
                  : "bg-yellow-900 text-yellow-400",
            }
          : undefined
      }
    >
      <div className="space-y-4">
        {/* Primary Stats */}
        <StatGrid
          stats={[
            {
              label: "FPS",
              value: Math.round(metrics.fps),
              color: getFpsColor(metrics.fps),
            },
            {
              label: "Step",
              value: metrics.step.toLocaleString(),
            },
            {
              label: "Avg FPS",
              value: Math.round(metrics.avgFps),
              color: "text-zinc-400",
            },
          ]}
          columns={3}
        />

        {/* FPS Graph */}
        <div>
          <div className="text-xs text-zinc-500 mb-1">FPS History</div>
          <div className="p-2 bg-zinc-800 rounded">
            <FpsGraph history={metrics.fpsHistory} />
          </div>
        </div>

        {/* Detailed Stats */}
        <div className="grid grid-cols-2 gap-3">
          <PerformanceBar
            value={metrics.fps}
            max={60}
            label="Current"
            color={getFpsColor(metrics.fps)}
          />
          <PerformanceBar
            value={metrics.avgFps}
            max={60}
            label="Average"
            color={getFpsColor(metrics.avgFps)}
          />
        </div>

        {/* Min/Max Range */}
        <div className="flex justify-between text-xs p-2 bg-zinc-800 rounded">
          <span className="text-zinc-500">
            Min:{" "}
            <span className="text-orange-400">
              {Math.round(metrics.minFps)}
            </span>
          </span>
          <span className="text-zinc-500">
            Max:{" "}
            <span className="text-green-400">{Math.round(metrics.maxFps)}</span>
          </span>
        </div>

        {/* Status Indicator */}
        <div className="flex items-center gap-2 p-2 bg-zinc-800 rounded">
          <div
            className={`w-2.5 h-2.5 rounded-full ${
              isRunning
                ? metrics.fps >= 30
                  ? "bg-green-500"
                  : "bg-yellow-500"
                : "bg-zinc-600"
            }`}
          />
          <span className="text-xs text-zinc-400">
            {isRunning
              ? metrics.fps >= 55
                ? "Optimal performance"
                : metrics.fps >= 30
                  ? "Good performance"
                  : metrics.fps >= 15
                    ? "Reduced performance"
                    : "Low performance"
              : "Simulation paused"}
          </span>
        </div>
      </div>
    </ExpandablePanel>
  );
}

/**
 * Simple FPS counter for minimal display
 */
export function FpsCounter({ engine }: { engine: { fps: number } | null }) {
  const storeFps = useSimulationStore((s) => s.fps);
  const fps = engine?.fps ?? storeFps;

  return (
    <div className={`font-mono text-sm ${getFpsColor(fps)}`}>
      {Math.round(fps)} FPS
    </div>
  );
}
