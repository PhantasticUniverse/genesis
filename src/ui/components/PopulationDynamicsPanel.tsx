/**
 * Population Dynamics Panel
 *
 * Visualizes ecosystem population dynamics:
 * - Time series population graph
 * - Phase space plot (predator vs prey)
 * - Ecosystem health metrics
 * - Species population bars
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { ExpandablePanel } from "./common/ExpandablePanel";
import type {
  PopulationTimeSeries,
  PhasePoint,
  EcosystemHealth,
} from "../../ecology/types";

interface PopulationDynamicsPanelProps {
  timeSeries: PopulationTimeSeries[];
  phaseTrajectory: PhasePoint[];
  health?: EcosystemHealth;
  speciesColors: Record<string, [number, number, number]>;
  maxSteps?: number;
  isRunning?: boolean;
}

type ViewMode = "timeseries" | "phase" | "health";

export function PopulationDynamicsPanel({
  timeSeries,
  phaseTrajectory,
  health,
  speciesColors,
  maxSteps = 500,
  isRunning = false,
}: PopulationDynamicsPanelProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("timeseries");
  const [showMean, setShowMean] = useState(true);
  const timeSeriesCanvasRef = useRef<HTMLCanvasElement>(null);
  const phaseCanvasRef = useRef<HTMLCanvasElement>(null);

  // Color utility
  const getColor = useCallback(
    (speciesId: string): string => {
      const rgb = speciesColors[speciesId] ?? [200, 200, 200];
      return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
    },
    [speciesColors],
  );

  // Draw time series graph
  useEffect(() => {
    if (viewMode !== "timeseries") return;

    const canvas = timeSeriesCanvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // Clear
    ctx.fillStyle = "#0a0a12";
    ctx.fillRect(0, 0, width, height);

    if (timeSeries.length === 0) {
      ctx.fillStyle = "#444";
      ctx.font = "12px Inter";
      ctx.textAlign = "center";
      ctx.fillText("No population data", width / 2, height / 2);
      return;
    }

    // Find max population for scaling
    let maxPop = 0;
    for (const series of timeSeries) {
      for (const pop of series.populations) {
        if (pop > maxPop) maxPop = pop;
      }
    }
    maxPop = Math.max(maxPop, 0.1); // Avoid division by zero

    // Draw grid
    ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
    ctx.lineWidth = 1;

    // Horizontal grid lines
    for (let i = 0; i <= 4; i++) {
      const y = (height / 4) * i;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Draw each species
    for (const series of timeSeries) {
      const data = showMean ? series.means : series.populations;
      if (data.length < 2) continue;

      ctx.strokeStyle = getColor(series.speciesId);
      ctx.lineWidth = 2;
      ctx.beginPath();

      const startIdx = Math.max(0, data.length - maxSteps);

      for (let i = startIdx; i < data.length; i++) {
        const x = ((i - startIdx) / maxSteps) * width;
        const y = height - (data[i] / maxPop) * height * 0.9 - 5;

        if (i === startIdx) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();

      // Draw raw data as lighter line if showing mean
      if (showMean && series.populations.length > 1) {
        ctx.strokeStyle = getColor(series.speciesId)
          .replace("rgb", "rgba")
          .replace(")", ", 0.3)");
        ctx.lineWidth = 1;
        ctx.beginPath();

        for (let i = startIdx; i < series.populations.length; i++) {
          const x = ((i - startIdx) / maxSteps) * width;
          const y =
            height - (series.populations[i] / maxPop) * height * 0.9 - 5;

          if (i === startIdx) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }
        ctx.stroke();
      }
    }

    // Draw legend
    let legendY = 12;
    ctx.font = "11px JetBrains Mono";
    for (const series of timeSeries) {
      ctx.fillStyle = getColor(series.speciesId);
      ctx.fillRect(5, legendY - 8, 12, 12);
      ctx.fillStyle = "#888";
      ctx.textAlign = "left";
      const lastPop = series.populations[series.populations.length - 1] ?? 0;
      ctx.fillText(
        `${series.speciesId}: ${lastPop.toFixed(2)}`,
        22,
        legendY + 2,
      );
      legendY += 16;
    }

    // Y-axis label
    ctx.fillStyle = "#666";
    ctx.font = "10px Inter";
    ctx.save();
    ctx.translate(10, height / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = "center";
    ctx.fillText("Population", 0, 0);
    ctx.restore();

    // X-axis label
    ctx.fillStyle = "#666";
    ctx.textAlign = "right";
    ctx.fillText("Time →", width - 5, height - 5);
  }, [timeSeries, viewMode, showMean, maxSteps, speciesColors, getColor]);

  // Draw phase space
  useEffect(() => {
    if (viewMode !== "phase") return;

    const canvas = phaseCanvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // Clear
    ctx.fillStyle = "#0a0a12";
    ctx.fillRect(0, 0, width, height);

    if (phaseTrajectory.length < 2) {
      ctx.fillStyle = "#444";
      ctx.font = "12px Inter";
      ctx.textAlign = "center";
      ctx.fillText("Collecting phase data...", width / 2, height / 2);
      return;
    }

    // Find max values for scaling
    let maxPrey = 0;
    let maxPredator = 0;
    for (const point of phaseTrajectory) {
      if (point.preyDensity > maxPrey) maxPrey = point.preyDensity;
      if (point.predatorDensity > maxPredator)
        maxPredator = point.predatorDensity;
    }
    maxPrey = Math.max(maxPrey, 0.1);
    maxPredator = Math.max(maxPredator, 0.1);

    // Draw axes
    ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(40, height - 30);
    ctx.lineTo(width - 10, height - 30);
    ctx.moveTo(40, height - 30);
    ctx.lineTo(40, 10);
    ctx.stroke();

    // Axis labels
    ctx.fillStyle = "#666";
    ctx.font = "10px Inter";
    ctx.textAlign = "center";
    ctx.fillText("Prey Density", width / 2, height - 5);

    ctx.save();
    ctx.translate(12, height / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText("Predator Density", 0, 0);
    ctx.restore();

    // Draw trajectory with gradient (older = darker)
    const recentCount = Math.min(phaseTrajectory.length, maxSteps);
    const startIdx = phaseTrajectory.length - recentCount;

    for (let i = startIdx + 1; i < phaseTrajectory.length; i++) {
      const prev = phaseTrajectory[i - 1];
      const curr = phaseTrajectory[i];

      const progress = (i - startIdx) / recentCount;
      const alpha = 0.2 + progress * 0.8;

      const x1 = 40 + (prev.preyDensity / maxPrey) * (width - 60);
      const y1 =
        height - 30 - (prev.predatorDensity / maxPredator) * (height - 50);
      const x2 = 40 + (curr.preyDensity / maxPrey) * (width - 60);
      const y2 =
        height - 30 - (curr.predatorDensity / maxPredator) * (height - 50);

      ctx.strokeStyle = `rgba(0, 245, 255, ${alpha})`;
      ctx.lineWidth = 1 + progress;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }

    // Draw current position
    if (phaseTrajectory.length > 0) {
      const current = phaseTrajectory[phaseTrajectory.length - 1];
      const x = 40 + (current.preyDensity / maxPrey) * (width - 60);
      const y =
        height - 30 - (current.predatorDensity / maxPredator) * (height - 50);

      // Glow effect
      const gradient = ctx.createRadialGradient(x, y, 0, x, y, 10);
      gradient.addColorStop(0, "rgba(0, 255, 136, 0.8)");
      gradient.addColorStop(1, "rgba(0, 255, 136, 0)");
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(x, y, 10, 0, Math.PI * 2);
      ctx.fill();

      // Center point
      ctx.fillStyle = "#00ff88";
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }, [phaseTrajectory, viewMode, maxSteps]);

  // Health metrics display
  const renderHealth = () => {
    if (!health) {
      return (
        <div className="text-center text-zinc-500 text-sm py-8">
          No health data available
        </div>
      );
    }

    const metrics = [
      {
        label: "Biodiversity",
        value: health.biodiversity,
        max: 10,
        color: "cyan",
        format: (v: number) => v.toFixed(0),
      },
      {
        label: "Evenness",
        value: health.evenness,
        max: 1,
        color: "green",
        format: (v: number) => (v * 100).toFixed(0) + "%",
      },
      {
        label: "Productivity",
        value: Math.min(1, Math.max(-1, health.productivity)),
        max: 1,
        color: health.productivity > 0 ? "green" : "red",
        format: (v: number) => (v > 0 ? "+" : "") + (v * 100).toFixed(1) + "%",
        showNegative: true,
      },
      {
        label: "Stability",
        value: health.stability,
        max: 1,
        color: "amber",
        format: (v: number) => (v * 100).toFixed(0) + "%",
      },
      {
        label: "Resilience",
        value: health.resilience,
        max: 1,
        color: "magenta",
        format: (v: number) => (v * 100).toFixed(0) + "%",
      },
    ];

    return (
      <div className="space-y-3">
        {metrics.map((metric) => (
          <div key={metric.label} className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-zinc-400">{metric.label}</span>
              <span
                className={`font-mono ${
                  metric.color === "cyan"
                    ? "text-bio-cyan"
                    : metric.color === "green"
                      ? "text-bio-green"
                      : metric.color === "amber"
                        ? "text-bio-amber"
                        : metric.color === "magenta"
                          ? "text-bio-magenta"
                          : "text-red-400"
                }`}
              >
                {metric.format(metric.value)}
              </span>
            </div>
            <div className="h-2 bg-genesis-depth rounded overflow-hidden">
              <div
                className={`h-full transition-all duration-300 ${
                  metric.color === "cyan"
                    ? "bg-bio-cyan"
                    : metric.color === "green"
                      ? "bg-bio-green"
                      : metric.color === "amber"
                        ? "bg-bio-amber"
                        : metric.color === "magenta"
                          ? "bg-bio-magenta"
                          : "bg-red-400"
                }`}
                style={{
                  width: `${Math.abs(metric.value / metric.max) * 100}%`,
                  marginLeft:
                    metric.showNegative && metric.value < 0 ? "50%" : "0",
                  transform:
                    metric.showNegative && metric.value < 0
                      ? "translateX(-100%)"
                      : "none",
                }}
              />
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <ExpandablePanel
      title="Population Dynamics"
      icon="📊"
      defaultExpanded={true}
      badge={isRunning ? "Live" : undefined}
      badgeColor="green"
    >
      <div className="space-y-4">
        {/* View mode tabs */}
        <div className="flex gap-1 p-1 bg-genesis-depth rounded-lg">
          {(["timeseries", "phase", "health"] as ViewMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`flex-1 px-3 py-1.5 rounded text-xs font-medium transition-all ${
                viewMode === mode
                  ? "bg-bio-cyan/20 text-bio-cyan"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {mode === "timeseries"
                ? "Time Series"
                : mode === "phase"
                  ? "Phase Space"
                  : "Health"}
            </button>
          ))}
        </div>

        {/* Canvas container */}
        <div className="relative">
          {viewMode === "timeseries" && (
            <>
              <canvas
                ref={timeSeriesCanvasRef}
                width={280}
                height={180}
                className="w-full rounded border border-zinc-800"
              />
              <div className="absolute top-2 right-2">
                <button
                  onClick={() => setShowMean(!showMean)}
                  className={`px-2 py-0.5 text-xs rounded transition-all ${
                    showMean
                      ? "bg-bio-cyan/20 text-bio-cyan"
                      : "bg-genesis-depth text-zinc-500"
                  }`}
                >
                  {showMean ? "Mean" : "Raw"}
                </button>
              </div>
            </>
          )}

          {viewMode === "phase" && (
            <canvas
              ref={phaseCanvasRef}
              width={280}
              height={200}
              className="w-full rounded border border-zinc-800"
            />
          )}

          {viewMode === "health" && (
            <div className="p-3 bg-genesis-depth rounded border border-zinc-800">
              {renderHealth()}
            </div>
          )}
        </div>

        {/* Population bars */}
        {timeSeries.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs text-zinc-500 uppercase tracking-wider">
              Current Populations
            </div>
            {timeSeries.map((series) => {
              const current =
                series.populations[series.populations.length - 1] ?? 0;
              const maxPop = Math.max(...series.populations, 0.1);

              return (
                <div key={series.speciesId} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span
                      className="font-mono"
                      style={{ color: getColor(series.speciesId) }}
                    >
                      {series.speciesId}
                    </span>
                    <span className="text-zinc-400">{current.toFixed(2)}</span>
                  </div>
                  <div className="h-1.5 bg-genesis-depth rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-150"
                      style={{
                        width: `${(current / maxPop) * 100}%`,
                        backgroundColor: getColor(series.speciesId),
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </ExpandablePanel>
  );
}
