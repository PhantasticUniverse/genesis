/**
 * 3D Lenia Panel Component
 * Controls for 3D Lenia simulation
 */

import { useState, useEffect, useCallback, useRef } from "react";
import type { Engine3D } from "../../core/engine-3d";
import type { SlicePlane } from "../../core/types-3d";
import {
  getSliceDimensions,
  getPlaneLabel,
  getSliceAxisName,
} from "../../render/slice-renderer";
import { ExpandablePanel, ToggleButton, RangeSlider, StatGrid } from "./common";
import { COLORMAPS } from "../../render/colormaps";

interface Lenia3DPanelProps {
  engine: Engine3D | null;
  onInit?: () => void;
}

export function Lenia3DPanel({ engine, onInit }: Lenia3DPanelProps) {
  const [isRunning, setIsRunning] = useState(false);
  const [step, setStep] = useState(0);
  const [fps, setFps] = useState(0);
  const [slicePlane, setSlicePlane] = useState<SlicePlane>("xy");
  const [slicePosition, setSlicePosition] = useState(32);
  const [colormap, setColormap] = useState("viridis");
  const [selectedPreset, setSelectedPreset] = useState("stable-sphere");
  const pollRef = useRef<number | null>(null);

  // Poll engine state when running
  useEffect(() => {
    if (!engine) return;

    const poll = () => {
      setIsRunning(engine.running);
      setStep(engine.step);
      setFps(engine.fps);
      pollRef.current = requestAnimationFrame(poll);
    };

    pollRef.current = requestAnimationFrame(poll);

    return () => {
      if (pollRef.current) {
        cancelAnimationFrame(pollRef.current);
      }
    };
  }, [engine]);

  // Sync view state with engine
  useEffect(() => {
    if (!engine) return;
    const view = engine.getView();
    setSlicePlane(view.slicePlane);
    setSlicePosition(view.slicePosition);
    setColormap(engine.getColormap());
  }, [engine]);

  const handleStart = useCallback(() => {
    engine?.start();
  }, [engine]);

  const handleStop = useCallback(() => {
    engine?.stop();
  }, [engine]);

  const handleStep = useCallback(() => {
    engine?.stepOnce();
  }, [engine]);

  const handleReset = useCallback(() => {
    engine?.reset(selectedPreset);
  }, [engine, selectedPreset]);

  const handleSlicePlaneChange = useCallback(
    (plane: SlicePlane) => {
      if (engine) {
        engine.setSlicePlane(plane);
        setSlicePlane(plane);
        // Update position slider range
        const dims = getSliceDimensions(engine.getGridConfig(), plane);
        setSlicePosition(Math.min(slicePosition, dims.maxPosition));
      }
    },
    [engine, slicePosition],
  );

  const handleSlicePositionChange = useCallback(
    (position: number) => {
      if (engine) {
        engine.setSlicePosition(position);
        setSlicePosition(position);
      }
    },
    [engine],
  );

  const handleColormapChange = useCallback(
    (name: string) => {
      if (engine) {
        engine.setColormap(name);
        setColormap(name);
      }
    },
    [engine],
  );

  const handlePresetChange = useCallback((preset: string) => {
    setSelectedPreset(preset);
  }, []);

  const handleLoadPreset = useCallback(() => {
    if (engine) {
      engine.loadPreset(selectedPreset);
    }
  }, [engine, selectedPreset]);

  if (!engine) {
    return (
      <ExpandablePanel
        title="3D Lenia"
        titleColor="text-purple-400"
        defaultExpanded={false}
      >
        <div className="text-center py-4">
          <p className="text-zinc-500 text-sm mb-3">
            3D Lenia simulation not initialized
          </p>
          {onInit && (
            <button
              onClick={onInit}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-500 rounded text-sm"
            >
              Initialize 3D Engine
            </button>
          )}
        </div>
      </ExpandablePanel>
    );
  }

  const gridConfig = engine.getGridConfig();
  const sliceDims = getSliceDimensions(gridConfig, slicePlane);
  const presets = engine.getPresets();
  const params = engine.getParams();

  return (
    <ExpandablePanel
      title="3D Lenia"
      titleColor="text-purple-400"
      statusBadge={
        isRunning
          ? { text: "Running", color: "bg-green-900 text-green-400" }
          : undefined
      }
      defaultExpanded={true}
    >
      <div className="space-y-4">
        {/* Stats */}
        <StatGrid
          stats={[
            { label: "Step", value: step.toLocaleString() },
            {
              label: "FPS",
              value: fps,
              color:
                fps > 30
                  ? "text-green-400"
                  : fps > 15
                    ? "text-yellow-400"
                    : "text-red-400",
            },
            { label: "Grid", value: `${gridConfig.width}³` },
          ]}
          columns={3}
        />

        {/* Playback Controls */}
        <div className="flex gap-2">
          {isRunning ? (
            <button
              onClick={handleStop}
              className="flex-1 px-3 py-2 bg-red-600 hover:bg-red-500 rounded text-sm"
            >
              Stop
            </button>
          ) : (
            <button
              onClick={handleStart}
              className="flex-1 px-3 py-2 bg-green-600 hover:bg-green-500 rounded text-sm"
            >
              Start
            </button>
          )}
          <button
            onClick={handleStep}
            disabled={isRunning}
            className="px-3 py-2 bg-zinc-700 hover:bg-zinc-600 rounded text-sm disabled:opacity-50"
          >
            Step
          </button>
          <button
            onClick={handleReset}
            className="px-3 py-2 bg-zinc-700 hover:bg-zinc-600 rounded text-sm"
          >
            Reset
          </button>
        </div>

        {/* Preset Selector */}
        <div className="space-y-2">
          <label className="text-sm text-zinc-400">Organism Preset</label>
          <div className="flex gap-2">
            <select
              value={selectedPreset}
              onChange={(e) => handlePresetChange(e.target.value)}
              className="flex-1 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-sm"
            >
              {Object.entries(presets).map(([key, preset]) => (
                <option key={key} value={key}>
                  {preset.name}
                </option>
              ))}
            </select>
            <button
              onClick={handleLoadPreset}
              className="px-3 py-2 bg-purple-600 hover:bg-purple-500 rounded text-sm"
            >
              Load
            </button>
          </div>
          <p className="text-xs text-zinc-600">
            {presets[selectedPreset]?.description}
          </p>
        </div>

        {/* Slice View Controls */}
        <div className="space-y-3">
          <div className="text-sm text-zinc-400">Slice View</div>

          {/* Plane Selector */}
          <div className="flex gap-1">
            {(["xy", "xz", "yz"] as SlicePlane[]).map((plane) => (
              <button
                key={plane}
                onClick={() => handleSlicePlaneChange(plane)}
                className={`flex-1 px-2 py-1.5 rounded text-xs ${
                  slicePlane === plane
                    ? "bg-purple-600 text-white"
                    : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                }`}
              >
                {getPlaneLabel(plane)}
              </button>
            ))}
          </div>

          {/* Slice Position */}
          <RangeSlider
            label={`${getSliceAxisName(slicePlane)} Position`}
            value={slicePosition}
            min={0}
            max={sliceDims.maxPosition}
            step={1}
            onChange={handleSlicePositionChange}
            formatValue={(v) => `${v}`}
            accentColor="accent-purple-500"
          />
        </div>

        {/* Colormap Selector */}
        <div className="space-y-2">
          <label className="text-sm text-zinc-400">Colormap</label>
          <select
            value={colormap}
            onChange={(e) => handleColormapChange(e.target.value)}
            className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-sm"
          >
            {Object.entries(COLORMAPS).map(([key, { name }]) => (
              <option key={key} value={key}>
                {name}
              </option>
            ))}
          </select>
        </div>

        {/* Current Parameters */}
        <div className="space-y-2">
          <div className="text-sm text-zinc-400">Parameters</div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="p-2 bg-zinc-800 rounded">
              <div className="text-zinc-500">Kernel R</div>
              <div className="font-mono text-purple-400">
                {params.kernelRadius}
              </div>
            </div>
            <div className="p-2 bg-zinc-800 rounded">
              <div className="text-zinc-500">Growth μ</div>
              <div className="font-mono text-purple-400">
                {params.growthCenter.toFixed(3)}
              </div>
            </div>
            <div className="p-2 bg-zinc-800 rounded">
              <div className="text-zinc-500">Growth σ</div>
              <div className="font-mono text-purple-400">
                {params.growthWidth.toFixed(3)}
              </div>
            </div>
            <div className="p-2 bg-zinc-800 rounded">
              <div className="text-zinc-500">dt</div>
              <div className="font-mono text-purple-400">
                {params.dt.toFixed(2)}
              </div>
            </div>
          </div>
        </div>

        {/* Keyboard Shortcuts */}
        <div className="mt-4 p-3 bg-zinc-800 rounded text-xs text-zinc-500">
          <strong className="text-zinc-400">Keyboard:</strong>
          <span className="ml-2">Space: Toggle • S: Step • R: Reset</span>
        </div>
      </div>
    </ExpandablePanel>
  );
}
