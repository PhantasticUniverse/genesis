/**
 * Performance Monitoring Component - HUD Style
 * Bioluminescent HUD-style display with real-time metrics
 */

import { useState, useEffect, memo } from "react";
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
  if (fps >= 55) return "text-bio-green";
  if (fps >= 30) return "text-bio-amber";
  if (fps >= 15) return "text-bio-amber";
  return "text-[var(--state-error)]";
}

/**
 * FPS numeric color for CSS
 */
function getFpsColorHex(fps: number): string {
  if (fps >= 55) return "#00ff88";
  if (fps >= 30) return "#ffaa00";
  if (fps >= 15) return "#ffaa00";
  return "#ff4466";
}

/**
 * Mini FPS graph with gradient fill
 */
const FpsGraph = memo(function FpsGraph({
  history,
  max = 60,
}: {
  history: number[];
  max?: number;
}) {
  if (history.length === 0) return null;

  const width = 100;
  const height = 24;
  const points = history.slice(-50);

  if (points.length < 2) return null;

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
        <linearGradient id="fpsGradientHUD" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="var(--bio-cyan)" stopOpacity="0.5" />
          <stop offset="100%" stopColor="var(--bio-cyan)" stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* Fill under the line */}
      <path
        d={`${pathData} L ${width} ${height} L 0 ${height} Z`}
        fill="url(#fpsGradientHUD)"
      />
      {/* The line itself */}
      <path
        d={pathData}
        fill="none"
        stroke="var(--bio-cyan)"
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
        stroke="rgba(0, 245, 255, 0.3)"
        strokeWidth="0.5"
        strokeDasharray="2,2"
      />
    </svg>
  );
});

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
        <span className="text-zinc-500 font-display tracking-wide uppercase">
          {label}
        </span>
        <span className={color} style={{ fontFamily: "var(--font-mono)" }}>
          {value.toFixed(1)}
        </span>
      </div>
      <div className="h-1.5 bg-genesis-surface rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{
            width: `${percentage}%`,
            background: `linear-gradient(90deg, ${getFpsColorHex(value)}80, ${getFpsColorHex(value)})`,
          }}
        />
      </div>
    </div>
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
  // Optimized: Use 500ms interval to reduce CPU usage (was 100ms)
  const isRunning = engine?.running ?? storeState.running;

  useEffect(() => {
    const interval = setInterval(() => {
      const currentFps = engine?.fps ?? storeState.fps;
      const currentStep = engine?.step ?? storeState.step;
      const running = engine?.running ?? storeState.running;

      setMetrics((prev) => {
        // Skip update if nothing changed (paused state optimization)
        if (!running && prev.fps === currentFps && prev.step === currentStep) {
          return prev;
        }

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
    }, 500);

    return () => clearInterval(interval);
  }, [engine, storeState.fps, storeState.step, storeState.running]);

  if (floating) {
    // HUD-style floating overlay
    return (
      <div className="fixed top-4 right-4 hud-monitor p-4 shadow-lg z-40 min-w-[160px]">
        <div className="flex items-center gap-2 mb-3">
          <span className={`status-dot ${isRunning ? "running" : ""}`} />
          <span className="text-xs text-zinc-400 font-display tracking-wide uppercase">
            {isRunning ? "Observing" : "Paused"}
          </span>
        </div>

        <div className="space-y-3">
          {/* Large FPS Display */}
          <div className="text-center">
            <span
              className={`text-3xl font-mono font-bold ${getFpsColor(metrics.fps)}`}
              style={{
                textShadow: `0 0 20px ${getFpsColorHex(metrics.fps)}40`,
              }}
            >
              {Math.round(metrics.fps)}
            </span>
            <span className="text-xs text-zinc-500 ml-1 font-display">FPS</span>
          </div>

          {/* Step Counter */}
          <div className="flex justify-between items-baseline px-1">
            <span className="text-xs text-zinc-500 font-display tracking-wide uppercase">
              Step
            </span>
            <span className="font-mono text-bio-cyan text-sm">
              {metrics.step.toLocaleString()}
            </span>
          </div>
        </div>

        {/* Mini Graph */}
        <div className="mt-2 pt-2 border-t border-[rgba(0,245,255,0.1)]">
          <FpsGraph history={metrics.fpsHistory} />
        </div>
      </div>
    );
  }

  // Panel version (detailed)
  return (
    <ExpandablePanel
      title="Performance"
      titleColor="text-bio-cyan"
      defaultExpanded={defaultExpanded}
      accent="cyan"
      statusBadge={
        isRunning
          ? {
              text: `${Math.round(metrics.fps)} FPS`,
              color:
                metrics.fps >= 30
                  ? "bg-[rgba(0,255,136,0.15)] border-bio-green text-bio-green"
                  : "bg-[rgba(255,170,0,0.15)] border-bio-amber text-bio-amber",
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
          <div className="text-xs text-bio-cyan font-display tracking-wide uppercase mb-2">
            FPS History
          </div>
          <div className="p-3 bg-genesis-surface rounded-lg border border-[rgba(0,245,255,0.1)]">
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
        <div className="flex justify-between text-xs p-3 bg-genesis-surface rounded-lg border border-[rgba(0,245,255,0.1)]">
          <span className="text-zinc-500">
            Min:{" "}
            <span className="text-bio-amber font-mono">
              {Math.round(metrics.minFps)}
            </span>
          </span>
          <span className="text-zinc-500">
            Max:{" "}
            <span className="text-bio-green font-mono">
              {Math.round(metrics.maxFps)}
            </span>
          </span>
        </div>

        {/* Status Indicator */}
        <div className="flex items-center gap-2 p-3 bg-genesis-surface rounded-lg border border-[rgba(0,245,255,0.1)]">
          <span className={`status-dot ${isRunning ? "running" : ""}`} />
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
